import assert from 'node:assert/strict';
import test from 'node:test';
import { checkPackagedMcpConfiguration } from './check-packaged-mcp.mjs';

const EXPECTED_CONFIGURATION = JSON.stringify({ mcpServers: { 'bone-studio': { command: 'node', args: ['adapter.cjs'] } } });

/** Reproduce Electron's writable ClipboardItem constraint without native clipboard access. */
class FakeClipboardItem {
  constructor(data) {
    this.types = Object.keys(data);
    if (this.types.length === 0) throw new TypeError('At least one MIME type is required.');
    this.data = data;
  }

  async getType(type) { return this.data[type]; }
}

/** Create readonly clipboard snapshots, including Runner entries with no MIME types. */
function createReadItem(data) {
  return { types: Object.keys(data), getType: async type => data[type] };
}

/** Run the real snapshot/cleanup path while every clipboard and Electron operation is simulated. */
async function runCopyFailure(options) {
  const failure = new Error('Simulated copy failure');
  const clipboard = createFakeClipboard(options, failure);
  let disposed = 0;
  const application = { async evaluateHandle(callback, argument) {
    const snapshot = await callback({ clipboard, ClipboardItem: FakeClipboardItem }, argument);
    return { evaluate: (callback, argument) => callback(snapshot, argument), dispose: async () => { disposed += 1; } };
  } };
  const page = {
    evaluate: async () => ({ configuration: EXPECTED_CONFIGURATION, requirements: ['Node.js 22.12+'] }),
    getByRole: (_role, selector) => ({ click: async () => {
      if (selector.name === '复制 MCP 配置') await clipboard.writeText(EXPECTED_CONFIGURATION);
    } }),
  };
  await assert.rejects(checkPackagedMcpConfiguration({ application, page, directory: '', artifacts: '' }), error => error === failure);
  assert.equal(disposed, 1, 'The main-process clipboard snapshot must always be released.');
  return clipboard;
}

/** Model rejected writes both before and after clipboard mutation and user replacement. */
function createFakeClipboard(options, failure) {
  const state = { value: 'Original clipboard', restored: [], cleared: 0 };
  return Object.assign(state, {
    readText: async () => state.value,
    read: async () => options.items,
    writeText: async value => {
      if (!options.isUnchanged) state.value = options.userValue ?? value;
      throw failure;
    },
    write: async items => { state.restored = items; },
    clear: async () => { state.value = ''; state.cleared += 1; },
  });
}

test('An empty clipboard read list is safely cleared after our partial copy failure', async () => {
  const clipboard = await runCopyFailure({ items: [] });
  assert.equal(clipboard.cleared, 1);
  assert.deepEqual(clipboard.restored, []);
});

test('Runner clipboard entries without MIME types are skipped before construction', async () => {
  const clipboard = await runCopyFailure({ items: [createReadItem({})] });
  assert.equal(clipboard.cleared, 1);
  assert.deepEqual(clipboard.restored, []);
});

test('Mixed empty entries preserve all readable text, HTML and image formats', async () => {
  const text = new Blob(['Original text'], { type: 'text/plain' });
  const html = new Blob(['<b>Original text</b>'], { type: 'text/html' });
  const image = new Blob(['PNG fixture'], { type: 'image/png' });
  const clipboard = await runCopyFailure({ items: [createReadItem({}), createReadItem({ 'text/plain': text, 'text/html': html, 'image/png': image }), createReadItem({})] });
  assert.equal(clipboard.restored.length, 1);
  assert.deepEqual(clipboard.restored[0].types, ['text/plain', 'text/html', 'image/png']);
  assert.equal(await clipboard.restored[0].getType('text/plain'), text);
  assert.equal(await clipboard.restored[0].getType('text/html'), html);
  assert.equal(await clipboard.restored[0].getType('image/png'), image);
  assert.equal(clipboard.cleared, 0);
});

test('A rejected copy that did not change the clipboard releases the snapshot without restoring', async () => {
  const clipboard = await runCopyFailure({ items: [createReadItem({ 'text/plain': new Blob(['original']) })], isUnchanged: true });
  assert.equal(clipboard.value, 'Original clipboard');
  assert.deepEqual(clipboard.restored, []);
  assert.equal(clipboard.cleared, 0);
});

test('A user copy made during a failed test is never overwritten by cleanup', async () => {
  const clipboard = await runCopyFailure({ items: [createReadItem({ 'text/plain': new Blob(['original']) })], userValue: 'New user clipboard' });
  assert.equal(clipboard.value, 'New user clipboard');
  assert.deepEqual(clipboard.restored, []);
  assert.equal(clipboard.cleared, 0);
});
