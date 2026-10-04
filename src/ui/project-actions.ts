import { createDemoProject, createEmptyProject } from '@/core/api';
import { downloadFile } from './files';
import { getEditorState, replaceProject, reportError, updateEditor } from './store';

/** Save the current document using a native desktop dialog when available. */
export async function saveProject(): Promise<void> {
  if (getEditorState().isSaving) return;
  const state = getEditorState(); const serialized = JSON.stringify(state.project, null, 2);
  updateEditor({ isSaving: true });
  try {
    if (window.boneStudio) {
      const path = await window.boneStudio.saveFile({ suggestedName: `${state.project.name}.bonestudio.json`, data: serialized, encoding: 'utf8', filters: [{ name: 'Bone Studio 项目', extensions: ['json'] }] });
      if (!path) return;
    } else downloadFile({ data: serialized, name: `${state.project.name}.bonestudio.json`, type: 'application/json' });
    updateEditor({ isDirty: state.revision !== getEditorState().revision, message: '项目已保存' });
  } catch (error) { reportError(error); } finally { updateEditor({ isSaving: false }); }
}

/** Open and validate a project chosen in the desktop file dialog. */
export async function openDesktopProject(): Promise<void> {
  try { const file = await window.boneStudio?.openProject(); if (file) replaceProject(JSON.parse(file.text) as unknown); }
  catch (error) { reportError(error); }
}

/** Start a new empty document after the caller has handled unsaved changes. */
export function newProject(): void { replaceProject(createEmptyProject()); }

/** Load the built-in character after the caller has handled unsaved changes. */
export function loadDemoProject(): void { replaceProject(createDemoProject()); }
