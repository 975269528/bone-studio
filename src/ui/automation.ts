import { capturePreview, exportAnimation } from '@/render';
import { applyCommands, getEditorState, redo, undo } from './store';
import type { AutomationRequest } from './desktop';

function readParams(value: unknown): Record<string, unknown> {
  if (value === undefined || value === null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) throw new Error('params 必须是对象。');
  return value as Record<string, unknown>;
}

function applyAutomation(params: Record<string, unknown>): unknown {
  if (!Array.isArray(params.commands)) throw new Error('commands 必须是数组。');
  if (params.expectedRevision !== undefined && typeof params.expectedRevision !== 'number') throw new Error('expectedRevision 必须是数字。');
  applyCommands(params.commands, { expectedRevision: params.expectedRevision });
  const state = getEditorState();
  return { project: state.project, revision: state.revision, summary: `已应用 ${params.commands.length} 条命令` };
}

/** Handle desktop MCP requests against the same live document used by the editor. */
export async function handleAutomation(request: AutomationRequest): Promise<unknown> {
  const params = readParams(request.params);
  const state = getEditorState();
  const animationId = typeof params.animationId === 'string' ? params.animationId : state.animationId;
  if (request.method === 'get_project') return { project: state.project, revision: state.revision,
    dirty: state.isDirty, selection: state.selection, animationId: state.animationId, time: state.time };
  if (request.method === 'save_project') return state.project;
  if (request.method === 'apply_commands') return applyAutomation(params);
  if (request.method === 'import_assets') {
    if (!Array.isArray(params.assets)) throw new Error('assets 必须是数组。');
    return applyAutomation({ commands: params.assets.map(asset => ({ type: 'asset.add', asset })) });
  }
  if (request.method === 'undo' || request.method === 'redo') {
    if (request.method === 'undo') undo(); else redo();
    return { project: getEditorState().project, revision: getEditorState().revision };
  }
  if (request.method === 'render_preview') {
    const dataUrl = await capturePreview({ project: state.project, animationId,
      time: typeof params.time === 'number' ? params.time : state.time });
    return { base64: dataUrl.split(',')[1], mimeType: 'image/png', width: state.project.width, height: state.project.height };
  }
  if (request.method === 'export_animation') {
    if (params.format !== 'sequence' && params.format !== 'sheet') throw new Error('format 必须是 sequence 或 sheet。');
    return exportAnimation({ project: state.project, animationId, format: params.format,
      fps: typeof params.fps === 'number' ? params.fps : undefined });
  }
  throw new Error(`未知自动化方法：${request.method}`);
}
