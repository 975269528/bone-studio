import { useEffect, useRef, useState } from 'react';
import { Check, Copy, LoaderCircle, RefreshCw } from 'lucide-react';
import type { McpConfiguration } from './desktop';
import { Modal } from './controls';
import { readMcpConfiguration } from './mcp-config';
import './mcp-dialog.css';

function failureMessage(error: unknown): string { return error instanceof Error ? error.message : String(error); }

function useMcpConfiguration() {
  const [configuration, setConfiguration] = useState<McpConfiguration | null>(null);
  const [error, setError] = useState(''); const [isLoading, setIsLoading] = useState(true);
  const [loadVersion, setLoadVersion] = useState(0);
  useEffect(() => {
    let isActive = true;
    setIsLoading(true); setError(''); setConfiguration(null);
    void readMcpConfiguration(window.boneStudio).then(result => { if (isActive) setConfiguration(result); })
      .catch((failure: unknown) => { if (isActive) setError(failureMessage(failure)); })
      .finally(() => { if (isActive) setIsLoading(false); });
    return () => { isActive = false; };
  }, [loadVersion]);
  const handleReload = () => setLoadVersion(version => version + 1);
  return { configuration, error, isLoading, handleReload };
}

function useCopyConfiguration() {
  const [isCopying, setIsCopying] = useState(false); const [isCopied, setIsCopied] = useState(false);
  const [error, setError] = useState(''); const isMounted = useRef(true);
  useEffect(() => { isMounted.current = true; return () => { isMounted.current = false; }; }, []);
  const handleCopy = async () => {
    if (isCopying) return;
    setIsCopying(true); setIsCopied(false); setError('');
    try {
      if (!window.boneStudio?.copyMcpConfiguration) throw new Error('请使用最新版桌面版复制配置。');
      await window.boneStudio.copyMcpConfiguration();
      if (isMounted.current) setIsCopied(true);
    } catch (failure) { if (isMounted.current) setError(failureMessage(failure)); }
    finally { if (isMounted.current) setIsCopying(false); }
  };
  return { isCopying, isCopied, error, handleCopy };
}

function ConfigurationContent(props: { configuration: McpConfiguration }) {
  return <><p className="mcp-intro">将配置合并到支持 MCP stdio 的 Agent 客户端配置中，再刷新或重启客户端。</p>
    <label className="mcp-config-field"><span>MCP 配置 JSON · 可全选并手动复制</span>
      <textarea aria-label="MCP 配置 JSON" readOnly spellCheck={false} value={props.configuration.configuration} rows={12} /></label>
    <h3 className="mcp-heading">接入步骤与要求</h3><ol className="mcp-requirements">{props.configuration.requirements.map((requirement, index) => <li key={index}>{requirement}</li>)}</ol>
    <p className="mcp-note">配置只适用于当前电脑和用户。更改软件数据目录后请重新复制；连接时保持编辑器打开。</p></>;
}

/** Show installation-specific MCP configuration and copy it through the desktop clipboard bridge. */
export function McpDialog(props: { onClose: () => void }) {
  const native = useMcpConfiguration(); const copy = useCopyConfiguration();
  const isDesktop = !!window.boneStudio;
  return <Modal title="连接 AI / MCP" wide onClose={props.onClose}><div className="mcp-dialog">
    {!isDesktop ? <p className="mcp-intro">浏览器预览无法生成桌面 MCP 配置。请启动 BoneStudio 桌面版，再点击右上角“AI / MCP”复制此电脑的接入配置。</p>
      : native.isLoading ? <p className="mcp-loading" role="status"><LoaderCircle size={16} className="spin" />正在加载本机配置…</p>
        : native.configuration ? <ConfigurationContent configuration={native.configuration} />
          : <div className="mcp-load-error"><p className="error-copy" role="alert">加载配置失败：{native.error}</p><button onClick={native.handleReload}><RefreshCw size={14} />重新加载</button></div>}
    {copy.error && <p className="error-copy" role="alert">复制失败：{copy.error} 可在配置框中全选并手动复制。</p>}
    {copy.isCopied && <p className="mcp-copy-success" role="status"><Check size={14} />配置已复制，可以粘贴到 Agent 客户端。</p>}
    <footer><button onClick={props.onClose}>关闭</button>{isDesktop && <button className="primary" disabled={!native.configuration || native.isLoading || copy.isCopying} onClick={() => { void copy.handleCopy(); }}>
      {copy.isCopying ? <LoaderCircle size={14} className="spin" /> : <Copy size={14} />}{copy.isCopying ? '正在复制…' : '复制 MCP 配置'}</button>}</footer>
  </div></Modal>;
}
