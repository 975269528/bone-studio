import { expect, it, vi } from 'vitest';
import { readMcpConfiguration } from './mcp-config';

const configuration = { configuration: JSON.stringify({ mcpServers: { 'bone-studio': { command: 'node', args: ['C:\\用户缓存\\BoneStudio\\mcp-adapter.cjs'] } } }), requirements: ['保持编辑器打开'], executablePath: 'C:\\用户软件\\BoneStudio.exe' };

it('preserves native configuration and installation paths without constructing local source paths', async () => {
  const getMcpConfiguration = vi.fn(async () => configuration);
  expect(await readMcpConfiguration({ getMcpConfiguration })).toEqual(configuration);
  expect(getMcpConfiguration).toHaveBeenCalledOnce();
});

it('requires a supported desktop bridge and preserves native load failures', async () => {
  await expect(readMcpConfiguration(undefined)).rejects.toThrow('桌面版');
  await expect(readMcpConfiguration({ getMcpConfiguration: async () => { throw new Error('无法读取软件位置'); } })).rejects.toThrow('无法读取软件位置');
});

it('rejects invalid JSON and missing MCP service information before enabling copying', async () => {
  for (const text of ['broken', '{}', '{"mcpServers":null}', '{"mcpServers":[]}', '{"mcpServers":{}}']) {
    await expect(readMcpConfiguration({ getMcpConfiguration: async () => ({ ...configuration, configuration: text }) })).rejects.toThrow('MCP 配置');
  }
});
