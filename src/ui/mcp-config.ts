import type { McpConfiguration } from './desktop';

type McpBridge = Pick<NonNullable<Window['boneStudio']>, 'getMcpConfiguration'>;

/** Load native configuration and reject malformed client JSON; never construct a machine path. */
export async function readMcpConfiguration(bridge: McpBridge | undefined): Promise<McpConfiguration> {
  if (!bridge?.getMcpConfiguration) throw new Error('请使用最新版 BoneStudio 桌面版查看 MCP 配置。');
  const result = await bridge.getMcpConfiguration();
  let parsed: unknown;
  try { parsed = JSON.parse(result.configuration) as unknown; }
  catch { throw new Error('生成的 MCP 配置不是有效 JSON，请重新加载。'); }
  if (!parsed || typeof parsed !== 'object' || !('mcpServers' in parsed)
    || !parsed.mcpServers || typeof parsed.mcpServers !== 'object' || Array.isArray(parsed.mcpServers)
    || Object.keys(parsed.mcpServers).length === 0) {
    throw new Error('生成的 MCP 配置缺少服务信息，请重新加载。');
  }
  return result;
}
