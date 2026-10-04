import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import http from 'node:http';
const require = createRequire(import.meta.url);
const { startSession } = require('../electron/session.cjs');
const { writeOutput, readProject } = require('../electron/files.cjs');
const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'bone-studio-test-'));
const broker = { request: async (method, params) => ({ method, params, revision: 7 }) };
const session = await startSession({ userData: directory, broker });
const connection = JSON.parse(await fs.readFile(path.join(directory, 'ai-connection.json'), 'utf8'));

/** Exercise the public HTTP boundary while keeping credentials out of output. */
async function post(options = {}) {
  return new Promise((resolve, reject) => {
    const request = http.request({ host: '127.0.0.1', port: connection.port, path: '/command', method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${connection.token}`, ...options.headers } }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve({ status: response.statusCode, json: async () => JSON.parse(Buffer.concat(chunks).toString()) }));
      response.on('error', reject);
    });
    request.on('error', reject);
    request.end(JSON.stringify(options.body ?? { method: 'get_project', params: {} }));
  });
}

try {
  const query = await post();
  assert.equal(query.status, 200);
  assert.equal((await query.json()).result.revision, 7);
  assert.equal((await post({ headers: { Authorization: 'Bearer invalid' } })).status, 403);
  assert.equal((await post({ headers: { Origin: 'http://example.test' } })).status, 403);
  assert.equal((await post({ headers: { Host: `localhost:${connection.port}` } })).status, 403);
  assert.equal((await post({ body: { method: 'execute_code', params: {} } })).status, 400);
  assert.equal((await post({ body: { method: 'get_project', params: { unknown: true } } })).status, 400);
  assert.equal((await post({ headers: { 'Content-Type': 'application/jsonp' } })).status, 400);
  const outputPath = path.join(directory, 'project.json');
  await writeOutput({ outputPath, data: '{"revision":1}' });
  await assert.rejects(writeOutput({ outputPath, data: 'replacement' }), /文件已存在/);
  assert.equal((await readProject(outputPath)).text, '{"revision":1}');
  await writeOutput({ outputPath, data: '{"revision":2}', replace: true });
  assert.equal((await readProject(outputPath)).text, '{"revision":2}');
  assert.deepEqual((await fs.readdir(directory)).sort(), ['ai-connection.json', 'project.json']);
  console.log('本地认证、Host/Origin、防未知字段、内容类型、原子写入和覆盖保护通过。');
} finally {
  await session.close();
  assert.ok(path.resolve(directory).startsWith(path.join(os.tmpdir(), 'bone-studio-test-')));
  await fs.rm(directory, { recursive: true, force: true });
}
