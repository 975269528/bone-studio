import { reverseEasing } from '@/core/curves';
import type { EasingSettings } from '@/core/curves';
import { applyCommands, getEditorState, reportError, updateEditor } from './store';
import { curveEditCommand, selectedCurveSegment } from './curve-editor';
import type { CurveSegment } from './curve-editor';

let clipboard: EasingSettings | null = null;

function selectedOutgoingCurve(): CurveSegment {
  const segment = selectedCurveSegment(getEditorState());
  if (!segment || segment.nextTime === undefined) throw new Error('请先选择一个有下一帧的关键帧出段。');
  return segment;
}

function commitEasing(easing: EasingSettings): void {
  const segment = selectedOutgoingCurve();
  const sameCurve = !easing.curve || (['x1', 'y1', 'x2', 'y2'] as const).every(key => easing.curve?.[key] === segment.curve[key]);
  if (segment.interpolation === easing.interpolation && sameCurve) return;
  applyCommands([curveEditCommand({ segment, ...easing })]);
  updateEditor({ isPlaying: false });
}

/** 读取与内部缓动剪贴板独立的副本，不使用系统剪贴板。 */
export function getCurveClipboard(): EasingSettings | null { return clipboard ? structuredClone(clipboard) : null; }

/** 复制所选出段的实际插值及贝塞尔控制点，跨轨道粘贴时保持源内容。 */
export function copySelectedCurve(): boolean {
  try {
    const segment = selectedOutgoingCurve();
    clipboard = structuredClone({ interpolation: segment.interpolation, curve: segment.curve });
    updateEditor({ message: '已复制当前段缓动，可选择另一关键帧粘贴曲线。' }); return true;
  } catch (error) { reportError(error); return false; }
}

/** 在所选出段粘贴缓动，仅更新插值和控制点，一次完整事务可撤销。 */
export function pasteSelectedCurve(): boolean {
  try {
    if (!clipboard) throw new Error('缓动剪贴板为空，请先复制曲线。');
    commitEasing(structuredClone(clipboard));
    updateEditor({ message: '已粘贴缓动曲线。' }); return true;
  } catch (error) { reportError(error); return false; }
}

/** 反转当前出段的时间与变化进度，交换缓入缓出及阶梯起跳/末尾跳变。 */
export function reverseSelectedCurve(): boolean {
  try {
    const segment = selectedOutgoingCurve();
    commitEasing(reverseEasing({ interpolation: segment.interpolation, curve: segment.keyframe.curve }));
    updateEditor({ message: '已反转当前段缓动。' }); return true;
  } catch (error) { reportError(error); return false; }
}
