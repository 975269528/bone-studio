import { createDemoProject, createEmptyProject } from '@/core/api';
import { downloadFile } from './files';
import { getDocumentSessionReady, getEditorState, replaceProject, reportError, updateEditor } from './store';

/** Save to the authorized desktop path; saveAs explicitly asks for a new destination. */
export async function saveProject(options?: { saveAs?: boolean }): Promise<void> {
  if (getEditorState().isSaving) return;
  const state = getEditorState(); const serialized = JSON.stringify(state.project, null, 2);
  updateEditor({ isSaving: true });
  try {
    if (window.boneStudio) {
      await getDocumentSessionReady();
      if (state.documentId !== getEditorState().documentId) return;
      const path = await window.boneStudio.saveProject({ documentId: state.documentId, suggestedName: `${state.project.name}.bonestudio.json`, data: serialized, saveAs: options?.saveAs });
      if (!path) return;
      if (state.documentId !== getEditorState().documentId) return;
      updateEditor({ documentPath: path });
    } else downloadFile({ data: serialized, name: `${state.project.name}.bonestudio.json`, type: 'application/json' });
    if (state.documentId !== getEditorState().documentId) return;
    updateEditor({ isDirty: state.revision !== getEditorState().revision, message: '项目已保存' });
  } catch (error) { if (state.documentId === getEditorState().documentId) reportError(error); }
  finally { if (state.documentId === getEditorState().documentId) updateEditor({ isSaving: false }); }
}

/** Open and validate a project chosen in the desktop file dialog. */
export async function openDesktopProject(): Promise<void> {
  const documentId = getEditorState().documentId;
  try {
    await getDocumentSessionReady();
    if (documentId !== getEditorState().documentId) return;
    const file = await window.boneStudio?.openProject({ documentId });
    if (file && documentId === getEditorState().documentId) replaceProject(JSON.parse(file.text) as unknown, file);
  }
  catch (error) { if (documentId === getEditorState().documentId) reportError(error); }
}

/** Start a new empty document after the caller has handled unsaved changes. */
export function newProject(): void { replaceProject(createEmptyProject()); }

/** Load the built-in character after the caller has handled unsaved changes. */
export function loadDemoProject(): void { replaceProject(createDemoProject()); }
