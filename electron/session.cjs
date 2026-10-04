const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomBytes, timingSafeEqual } = require('node:crypto');
const { validateRequest } = require('./protocol.cjs');
const { importAssets, writeOutput } = require('./files.cjs');
const MAX_BODY_BYTES = 64 * 1024 * 1024;

/** Reject browser origins, DNS rebinding hosts, and incorrect bearer credentials. */
function authenticate(request, connection) {
  if (request.headers.host !== `127.0.0.1:${connection.port}` || request.headers.origin !== undefined) return false;
  const received = Buffer.from(request.headers.authorization ?? '');
  const expected = Buffer.from(`Bearer ${connection.token}`);
  return received.length === expected.length && timingSafeEqual(received, expected);
}

/** Read bounded JSON without exposing arbitrary filesystem or code execution. */
async function readBody(request) {
  if (!/^application\/json(?:\s*;|$)/i.test(String(request.headers['content-type'] ?? ''))) throw new Error('请求必须使用 application/json。');
  const chunks = [];
  let total = 0;
  for await (const chunk of request) {
    total += chunk.length;
    if (total > MAX_BODY_BYTES) throw new Error('请求超过 64 MiB 限制。');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

/** Apply explicit file operations around renderer-owned session commands. */
async function execute(options) {
  const { method, params, broker } = options;
  if (method === 'import_assets') return broker.request(method, { assets: await importAssets(params.paths) });
  if (method === 'save_project') {
    if (path.extname(params.outputPath).toLowerCase() !== '.json') throw new Error('项目输出路径必须以 .json 结尾。');
    const project = await broker.request(method, {});
    const outputPath = await writeOutput({ ...params, data: JSON.stringify(project, null, 2) });
    return { outputPath };
  }
  if (method === 'export_animation') {
    if (path.extname(params.outputPath).toLowerCase() !== '.zip') throw new Error('动画输出路径必须以 .zip 结尾。');
    const { outputPath, replace, ...renderParams } = params;
    const result = await broker.request(method, renderParams);
    if (!result || typeof result.base64 !== 'string' || !Number.isInteger(result.frameCount)) throw new Error('编辑器没有返回有效导出内容。');
    const savedPath = await writeOutput({ outputPath, replace, data: result.base64, encoding: 'base64' });
    return { outputPath: savedPath, frameCount: result.frameCount, width: result.width, height: result.height };
  }
  return broker.request(method, params);
}

/** Send only JSON with errors scrubbed of local internal stacks. */
function respond(response, status, body) {
  if (response.destroyed) return;
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(body));
}

/** Start an authenticated loopback-only service and publish discovery metadata. */
async function startSession(options) {
  const connection = { version: 1, host: '127.0.0.1', port: 0, token: randomBytes(32).toString('hex'), pid: process.pid };
  const server = http.createServer(async (request, response) => {
    if (!authenticate(request, connection)) return respond(response, 403, { error: '请求认证失败。' });
    if (request.method !== 'POST' || request.url !== '/command') return respond(response, 404, { error: '未知接口。' });
    try {
      const { method, params } = validateRequest(await readBody(request));
      respond(response, 200, { result: await execute({ method, params, broker: options.broker }) });
    } catch (error) {
      const message = error.code ? `文件操作失败（${error.code}）。` : error.message;
      respond(response, 400, { error: message });
    }
  });
  server.requestTimeout = 10000;
  server.headersTimeout = 5000;
  server.timeout = 100000;
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  connection.port = server.address().port;
  const connectionPath = path.join(options.userData, 'ai-connection.json');
  await fs.mkdir(options.userData, { recursive: true });
  await fs.writeFile(connectionPath, JSON.stringify(connection, null, 2), { mode: 0o600 });
  return { close: async () => {
    await new Promise((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
      server.closeAllConnections();
    });
    await fs.rm(connectionPath, { force: true });
  } };
}

module.exports = { startSession };
