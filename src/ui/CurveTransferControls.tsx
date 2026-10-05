import { copySelectedCurve, getCurveClipboard, pasteSelectedCurve, reverseSelectedCurve } from './curve-clipboard';
import type { CurveSegment } from './curve-editor';
import { useEditor } from './store';

/** 在时间轴曲线工作区提供独立于姿态关键帧的缓动复制、粘贴和反转。 */
export function CurveTransferControls(props: { segment: CurveSegment | null }) {
  useEditor();
  const hasOutgoing = !!props.segment && props.segment.nextTime !== undefined;
  return <div className="curve-transfer-controls"><button disabled={!hasOutgoing} onClick={copySelectedCurve} title="仅复制此段的插值和控制点">复制曲线</button>
    <button disabled={!hasOutgoing || !getCurveClipboard()} onClick={pasteSelectedCurve} title="将缓动应用到当前段，姿态数值保持">粘贴曲线</button>
    <button disabled={!hasOutgoing} onClick={reverseSelectedCurve} title="反转缓入缓出；不改变关键帧的先后和姿态">反转缓动</button></div>;
}
