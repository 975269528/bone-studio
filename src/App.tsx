import { useEffect } from 'react';
import { CircleHelp, Check, Cpu, X } from 'lucide-react';
import { Canvas } from './ui/Canvas';
import { Header } from './ui/Header';
import { Inspector } from './ui/Inspector';
import { Library } from './ui/Library';
import { Timeline } from './ui/Timeline';
import { handleAutomation } from './ui/automation';
import { handleShortcut } from './ui/shortcuts';
import { updateEditor, useEditor } from './ui/store';
import './ui/desktop';

/** The canonical desktop editor shell and its live automation request subscription. */
export function App() {
  const state = useEditor();
  useEffect(() => {
    document.addEventListener('keydown', handleShortcut);
    const unsubscribe = window.boneStudio?.onAutomationRequest(request => {
      void handleAutomation(request).then(result => window.boneStudio?.replyAutomation({ id: request.id, result }))
        .catch((error: unknown) => window.boneStudio?.replyAutomation({ id: request.id, error: error instanceof Error ? error.message : String(error) }));
    });
    return () => { document.removeEventListener('keydown', handleShortcut); unsubscribe?.(); };
  }, [handleAutomation]);
  return <div className="app-shell"><Header /><div className="workspace"><Library /><Canvas /><Inspector /></div><Timeline />
    <footer className="status-bar"><span><Check size={12} />{state.isDirty ? '所有改动保留在当前文档' : '文档就绪'}</span><span className="status-hint"><CircleHelp size={12} />空格 播放 · K 记录帧 · Ctrl+Z 撤销</span><span><Cpu size={12} />本地渲染 <i />v0.1</span></footer>
    {state.message && <div className="toast" role="status"><span>{state.message}</span><button className="icon-button" aria-label="关闭消息" onClick={() => updateEditor({ message: '' })}><X size={14} /></button></div>}
  </div>;
}
