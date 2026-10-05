const { randomUUID } = require('node:crypto');
const path = require('node:path');
const { z } = require('zod');
const documentSchema = z.object({ documentId: z.uuid() }).strict();
const sessionSchema = documentSchema.extend({ openToken: z.uuid().optional() }).strict();
const projectSaveSchema = documentSchema.extend({
  suggestedName: z.string().min(1).max(200),
  data: z.string().max(64 * 1024 * 1024),
  saveAs: z.boolean().optional(),
}).strict();
const PROJECT_FILTERS = [{ name: 'Bone Studio 项目', extensions: ['json'] }];

/** Bind dialog-approved files to document sessions; never accept renderer-supplied paths. */
function createProjectFiles(dependencies) {
  const state = { dependencies, current: null, pendingOpen: null, saving: new Set(), writes: new Map() };
  return {
    setSession: input => setSession(state, input),
    open: input => openProject(state, input),
    save: input => saveProject(state, input),
  };
}

function setSession(state, input) {
  const options = sessionSchema.parse(input);
  if (options.openToken && options.openToken !== state.pendingOpen?.token) throw new Error('打开文件授权已失效，请重新打开项目。');
  state.current = { documentId: options.documentId, path: options.openToken ? state.pendingOpen.path : null };
  state.pendingOpen = null;
}

function requireSession(state, input) {
  const options = documentSchema.parse(input);
  if (options.documentId !== state.current?.documentId) throw new Error('文档已切换，请重新保存当前项目。');
  return state.current;
}

async function openProject(state, input) {
  const session = requireSession(state, input);
  const { dependencies } = state;
  const result = await dependencies.dialog.showOpenDialog(dependencies.window, { title: '打开骨骼项目', properties: ['openFile'], filters: PROJECT_FILTERS });
  if (result.canceled || !result.filePaths[0] || state.current !== session) return null;
  const filePath = result.filePaths[0];
  const file = await dependencies.readProject(filePath);
  if (state.current !== session) return null;
  const token = randomUUID();
  state.pendingOpen = { path: filePath, token };
  return { ...file, path: filePath, openToken: token };
}

async function saveProject(state, input) {
  const options = projectSaveSchema.parse(input);
  const session = requireSession(state, { documentId: options.documentId });
  if (state.saving.has(session)) return null;
  state.saving.add(session);
  try {
    const outputPath = await chooseDestination(state, { options, session });
    if (!outputPath || state.current !== session) return null;
    const savedPath = await writeProject(state, { outputPath, data: options.data, session });
    if (state.current !== session) return null;
    session.path = savedPath;
    return savedPath;
  } finally { state.saving.delete(session); }
}

async function chooseDestination(state, { options, session }) {
  if (session.path && !options.saveAs) return session.path;
  const { dependencies } = state;
  const result = await dependencies.dialog.showSaveDialog(dependencies.window, { title: options.saveAs ? '项目另存为' : '保存骨骼项目', defaultPath: session.path ?? options.suggestedName, filters: PROJECT_FILTERS });
  return result.canceled ? null : result.filePath;
}

function writeProject(state, options) {
  const absolutePath = path.resolve(options.outputPath);
  const key = process.platform === 'win32' ? absolutePath.toLowerCase() : absolutePath;
  const previous = state.writes.get(key) ?? Promise.resolve();
  // A replacement document can save to the same file while its old write is pending.
  // Order publication so an older snapshot cannot overwrite the newer save.
  const operation = previous.catch(() => undefined).then(() => state.current === options.session
    ? state.dependencies.writeOutput({ outputPath: absolutePath, data: options.data, encoding: 'utf8', replace: true }) : null);
  state.writes.set(key, operation);
  return operation.finally(() => { if (state.writes.get(key) === operation) state.writes.delete(key); });
}

module.exports = { createProjectFiles };
