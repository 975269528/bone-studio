import { useSyncExternalStore } from 'react';
import { createDemoProject, executeCommands, parseProject } from '@/core/api';
import type { Project, ProjectCommand } from '@/core/types';

export type Selection = { kind: 'bone' | 'attachment' | 'ik' | 'asset'; id: string } | null;
export type CanvasTool = 'select' | 'rig' | 'draw' | 'rotate' | 'scale' | 'length' | 'pan';
export interface CommitOptions { coalesce?: boolean }
export interface EditorState {
  project: Project;
  revision: number;
  selection: Selection;
  animationId: string | null;
  time: number;
  isPlaying: boolean;
  showBones: boolean;
  zoom: number;
  pan: { x: number; y: number };
  tool: CanvasTool;
  keepImages: boolean;
  past: Project[];
  future: Project[];
  message: string;
  messageVersion: number;
  isDirty: boolean;
  isSaving: boolean;
}

const initialProject = createDemoProject();
let state: EditorState = {
  project: initialProject, revision: 0, selection: null,
  animationId: initialProject.animations[0]?.id ?? null, time: 0, isPlaying: false,
  showBones: true, zoom: 0.85, pan: { x: 0, y: 0 }, tool: 'select', keepImages: true, past: [], future: [], message: '', messageVersion: 0, isDirty: false, isSaving: false,
};
const listeners = new Set<() => void>();
const HISTORY_LIMIT = 80;

/** Read the canonical document shared by editor actions and external automation. */
export function getEditorState(): EditorState { return state; }

/** Subscribe React to changes in the canonical editor state. */
export function useEditor(): EditorState {
  return useSyncExternalStore(listener => {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, getEditorState);
}

/** Update transient editor state without adding document undo entries. */
export function updateEditor(changes: Partial<EditorState>): void {
  state = { ...state, ...changes, messageVersion: changes.message ? state.messageVersion + 1 : state.messageVersion };
  listeners.forEach(listener => listener());
}

/** Apply validated commands atomically and record an undo snapshot. */
export function applyCommands(commands: unknown[], options?: { expectedRevision?: number; coalesce?: boolean }): Project {
  if (options?.expectedRevision !== undefined && options.expectedRevision !== state.revision) {
    throw new Error(`文档版本冲突：当前版本为 ${state.revision}。请重新获取项目。`);
  }
  if (commands.length === 0) return state.project;
  const project = executeCommands({ project: state.project, commands });
  updateEditor({ project, revision: state.revision + 1, isDirty: true, future: [],
    ...validEditorReferences(project),
    past: options?.coalesce ? state.past : [...state.past.slice(-(HISTORY_LIMIT - 1)), state.project] });
  return project;
}

/** Run an editor command and present validation errors in the status area. */
export function runCommand(command: ProjectCommand, options?: CommitOptions): void {
  try { applyCommands([command], options); }
  catch (error) { reportError(error); }
}

/** Replace the current project after validating imported JSON. */
export function replaceProject(project: unknown): void {
  const valid = parseProject(project);
  updateEditor({ project: valid, revision: state.revision + 1, past: [], future: [],
    selection: null, animationId: valid.animations[0]?.id ?? null, tool: valid.animations.length ? 'select' : 'rig', time: 0, isPlaying: false,
    isDirty: false, message: '项目已打开' });
}

/** Restore the preceding document snapshot while retaining monotonic revision numbers. */
export function undo(): void {
  const previous = state.past.at(-1);
  if (!previous) return;
  updateEditor({ project: previous, past: state.past.slice(0, -1),
    future: [...state.future, state.project], ...validEditorReferences(previous), revision: state.revision + 1, isDirty: true });
}

/** Restore the document snapshot most recently undone. */
export function redo(): void {
  const next = state.future.at(-1);
  if (!next) return;
  updateEditor({ project: next, future: state.future.slice(0, -1),
    past: [...state.past, state.project], ...validEditorReferences(next), revision: state.revision + 1, isDirty: true });
}

function validEditorReferences(project: Project): Pick<EditorState, 'selection' | 'animationId' | 'time'> {
  const lists = { bone: project.bones, attachment: project.attachments, ik: project.ikConstraints, asset: project.assets };
  const selection = state.selection && lists[state.selection.kind].some(item => item.id === state.selection?.id) ? state.selection : null;
  const animationId = state.animationId === null ? null : project.animations.some(item => item.id === state.animationId) ? state.animationId : project.animations[0]?.id ?? null;
  const duration = project.animations.find(item => item.id === animationId)?.duration ?? 0;
  return { selection, animationId, time: Math.min(state.time, duration) };
}

/** Report an operation failure without discarding the current document. */
export function reportError(error: unknown): void {
  updateEditor({ message: error instanceof Error ? error.message : String(error) });
}
