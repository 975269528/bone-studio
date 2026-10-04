import { useState } from 'react';
import type { FormEvent } from 'react';
import { Film, Grid2X2, Download, LoaderCircle } from 'lucide-react';
import { exportAnimation } from '@/render';
import { Modal } from './controls';
import { downloadBase64 } from './files';
import { getEditorState, reportError, updateEditor } from './store';

/** Export the active animation as a PNG sequence ZIP or a sprite sheet ZIP. */
export function ExportDialog(props: { onClose: () => void }) {
  const state = getEditorState(); const animation = state.project.animations.find(item => item.id === state.animationId);
  const [format, setFormat] = useState<'sequence' | 'sheet'>('sheet');
  const [fps, setFps] = useState(animation?.fps ?? 24); const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (isSaving || !event.currentTarget.reportValidity() || !animation) return;
    setIsSaving(true); setError('');
    try { const result = await exportAnimation({ project: state.project, animationId: animation.id, format, fps });
      if (window.boneStudio) {
        const path = await window.boneStudio.exportFile({ suggestedName: result.fileName, data: result.base64, encoding: 'base64', filters: [{ name: 'ZIP 动画资源', extensions: ['zip'] }] });
        if (!path) return;
      } else downloadBase64(result);
      updateEditor({ message: `已导出 ${result.frameCount} 帧 · ${format === 'sheet' ? '精灵图' : 'PNG 序列'}` }); props.onClose();
    } catch (failure) { setError(failure instanceof Error ? failure.message : String(failure)); reportError(failure); }
    finally { setIsSaving(false); }
  };
  return <Modal title="导出动画" onClose={() => { if (!isSaving) props.onClose(); }}><form onSubmit={event => { void handleSubmit(event); }}>
    <p className="modal-copy">{animation?.name ?? '请先选择动作'} <span className="muted">· 透明背景 · {state.project.width} × {state.project.height} px</span></p>
    <div className="export-formats"><button type="button" className={format === 'sheet' ? 'selected' : ''} onClick={() => setFormat('sheet')}><Grid2X2 size={24} /><strong>精灵图</strong><span>sprite sheet + 帧坐标 JSON</span></button>
      <button type="button" className={format === 'sequence' ? 'selected' : ''} onClick={() => setFormat('sequence')}><Film size={24} /><strong>PNG 序列</strong><span>逐帧 PNG + 动作元数据</span></button></div>
    <label className="field full"><span>导出帧率 / FPS <b>*</b></span><input type="number" required min={1} max={120} step={1} value={fps} onChange={event => setFps(Number(event.target.value))} /></label>
    <div className="export-summary"><span>预计 {Math.ceil((animation?.duration ?? 0) * fps)} 帧</span><span>打包为 ZIP</span></div>
    {error && <p className="error-copy" role="alert">{error}</p>}<footer><button type="button" disabled={isSaving} onClick={props.onClose}>取消</button><button className="primary" type="submit" disabled={isSaving || !animation}>
      {isSaving ? <LoaderCircle size={15} className="spin" /> : <Download size={15} />}{isSaving ? '正在渲染与打包…' : '导出动画'}</button></footer>
  </form></Modal>;
}
