import type { Pose, Project } from '../core/types';

export interface RenderOverlays {
  grid?: boolean;
  bones?: boolean;
  ik?: boolean;
  selectedBoneId?: string | null;
  selectedAttachmentId?: string | null;
  selectedIKId?: string | null;
}

export interface RenderOptions {
  canvas: HTMLCanvasElement;
  project: Project;
  animationId?: string | null;
  time: number;
  width?: number;
  height?: number;
  overlays?: RenderOverlays;
}

export interface PreviewOptions {
  project: Project;
  animationId?: string | null;
  time: number;
  width?: number;
  height?: number;
}

export interface ExportOptions {
  project: Project;
  animationId: string | null;
  format: 'sequence' | 'sheet';
  fps?: number;
  width?: number;
  height?: number;
}

export interface ExportResult {
  base64: string;
  fileName: string;
  mimeType: string;
  frameCount: number;
  width: number;
  height: number;
}

export interface DrawOptions {
  context: CanvasRenderingContext2D;
  project: Project;
  pose: Pose;
  images: Map<string, HTMLImageElement>;
  overlays?: RenderOverlays;
}
