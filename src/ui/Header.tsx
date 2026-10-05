import { useRef, useState } from 'react';
import { Bone, FolderOpen, Save, Undo2, Redo2, Download, Plus, ChevronRight, Radio } from 'lucide-react';
import { Modal } from './controls';
import { ExportDialog } from './ExportDialog';
import { ThemeToggle } from './ThemeToggle';
import { loadDemoProject, newProject, openDesktopProject, saveProject } from './project-actions';
import { redo, replaceProject, reportError, undo, useEditor } from './store';

/** Document toolbar with native open/save, history, and animation export controls. */
export function Header() {
  const state = useEditor(); const input = useRef<HTMLInputElement>(null);
  const [isExportOpen, setIsExportOpen] = useState(false); const [isNewOpen, setIsNewOpen] = useState(false);
  const [pending, setPending] = useState<'open' | 'new' | 'demo' | null>(null);
  const handleAction = (action: 'open' | 'new' | 'demo') => {
    setIsNewOpen(false);
    if (state.isDirty) { setPending(action); return; }
    performAction(action);
  };
  const performAction = (action: 'open' | 'new' | 'demo') => {
    if (action === 'new') newProject();
    else if (action === 'demo') loadDemoProject();
    else if (window.boneStudio) void openDesktopProject(); else input.current?.click();
    setPending(null);
  };
  return <header className="app-header"><div className="brand"><div className="brand-mark"><Bone size={21} /></div><span>BONE<span className="brand-light">STUDIO</span><small>2D ANIMATION WORKSPACE</small></span></div>
    <div className="header-separator" /><div className="project-title" title={state.documentPath ?? '尚未选择保存位置'}><span className="breadcrumb">工作区 <ChevronRight size={11} /> 动画项目</span><strong>{state.project.name}{state.isDirty && <i className="dirty-dot" title="未保存的修改" />}</strong></div>
    <div className="header-actions"><span className="bridge-status"><Radio size={12} />{window.boneStudio ? '本地接口已就绪' : '浏览器预览'}</span>
      <button className="icon-button" aria-label="撤销" title="撤销 Ctrl+Z" disabled={!state.past.length} onClick={undo}><Undo2 size={16} /></button><button className="icon-button" aria-label="重做" title="重做 Ctrl+Shift+Z" disabled={!state.future.length} onClick={redo}><Redo2 size={16} /></button>
      <span className="header-separator small" /><button aria-label="新建项目" className="icon-button" title="新建项目 / 加载示例人物" onClick={() => setIsNewOpen(true)}><Plus size={17} /></button><button onClick={() => handleAction('open')}><FolderOpen size={15} />打开</button><button disabled={state.isSaving} onClick={() => { void saveProject(); }}><Save size={15} />{state.isSaving ? '保存中…' : '保存'}</button>
      <button className="icon-button" aria-label="另存为" title="另存为 Ctrl+Shift+S" disabled={state.isSaving} onClick={() => { void saveProject({ saveAs: true }); }}><Save size={15} /><Plus size={10} /></button><button className="primary" disabled={!state.animationId} onClick={() => setIsExportOpen(true)}><Download size={15} />导出动画</button><ThemeToggle /></div>
    <input ref={input} type="file" accept=".json" hidden onChange={event => {
      const file = event.target.files?.[0]; if (file) void file.text().then(text => replaceProject(JSON.parse(text) as unknown)).catch(reportError);
      event.target.value = '';
    }} />{isExportOpen && <ExportDialog onClose={() => setIsExportOpen(false)} />}{isNewOpen && <Modal title="新建项目" onClose={() => setIsNewOpen(false)}><p className="modal-copy">选择空白骨架，或加载内置人物示例查看骨骼绑定与挥手动作。</p><footer><button onClick={() => setIsNewOpen(false)}>取消</button><button onClick={() => handleAction('new')}>空白项目</button><button className="primary" onClick={() => handleAction('demo')}>加载示例人物</button></footer></Modal>}{pending && <Modal title="当前项目尚未保存" onClose={() => setPending(null)}>
      <p className="modal-copy">继续{pending === 'new' ? '新建' : pending === 'demo' ? '加载示例' : '打开'}会替换当前文档。请先保存需要保留的修改。</p><footer><button onClick={() => setPending(null)}>取消</button><button onClick={() => { void saveProject(); setPending(null); }}>保存当前项目</button><button className="danger-solid" onClick={() => performAction(pending)}>继续{pending === 'new' ? '新建' : pending === 'demo' ? '加载示例' : '打开'}</button></footer>
    </Modal>}</header>;
}
