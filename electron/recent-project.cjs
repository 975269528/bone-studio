const fs = require('node:fs/promises');
const path = require('node:path');
const { z } = require('zod');
const { writeOutput } = require('./files.cjs');
const MAX_SETTINGS_BYTES = 16 * 1024;
const absolutePath = z.string().min(1).max(4096).refine(value => path.isAbsolute(value));
const settingsSchema = z.object({ version: z.literal(1), latestProjectPath: absolutePath, savedProjectPath: absolutePath.optional() }).strict();

/** Persist only paths approved by native project open/save; isolate them in the app profile. */
function createRecentProject(userData) {
  const settingsPath = path.join(userData, 'recent-project.json');
  let pending = Promise.resolve();
  const remember = (filePath, saved) => {
    pending = pending.then(() => rememberPath({ settingsPath, filePath, saved })).catch(error => {
      console.warn('无法记住最近项目：', error.code ?? error.message);
    });
    return pending;
  };
  return {
    read: () => readSettings(settingsPath),
    rememberOpened: filePath => remember(filePath, false),
    rememberSaved: filePath => remember(filePath, true),
    openDefault: () => openDefault(settingsPath),
  };
}

async function readSettings(settingsPath) {
  try {
    const info = await fs.stat(settingsPath);
    if (!info.isFile() || info.size > MAX_SETTINGS_BYTES) throw new Error('最近项目记录格式无效。');
    const text = await fs.readFile(settingsPath, 'utf8');
    if (Buffer.byteLength(text) > MAX_SETTINGS_BYTES) throw new Error('最近项目记录过大。');
    return settingsSchema.parse(JSON.parse(text));
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

async function rememberPath({ settingsPath, filePath, saved }) {
  let previous = null;
  try { previous = await readSettings(settingsPath); }
  catch (error) { console.warn('替换无效的最近项目记录：', error.code ?? error.message); }
  const options = settingsSchema.parse({ version: 1, latestProjectPath: path.resolve(filePath),
    savedProjectPath: saved ? path.resolve(filePath) : previous?.savedProjectPath });
  await writeOutput({ outputPath: settingsPath, data: JSON.stringify(options), replace: true });
}

async function openDefault(settingsPath) {
  try {
    const settings = await readSettings(settingsPath);
    const filePath = settings?.savedProjectPath ?? settings?.latestProjectPath;
    if (!filePath) return undefined;
    return (await fs.stat(filePath)).isFile() ? filePath : undefined;
  } catch (error) {
    if (error.code !== 'ENOENT') console.warn('无法读取打开项目的默认路径：', error.code ?? error.message);
    return undefined;
  }
}

module.exports = { createRecentProject };
