export interface Asset {
  id: string;
  name: string;
  dataUrl: string;
  width: number;
  height: number;
}

export interface Bone {
  id: string;
  name: string;
  parentId: string | null;
  x: number;
  y: number;
  rotation: number;
  length: number;
}

export interface Attachment {
  id: string;
  name: string;
  assetId: string;
  boneId: string | null;
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  anchorX: number;
  anchorY: number;
  opacity: number;
  zIndex: number;
}

export interface BoneKeyframe {
  time: number;
  x: number;
  y: number;
  rotation: number;
}

export type Interpolation = 'linear' | 'smooth' | 'step';

export interface BoneTrack {
  boneId: string;
  keyframes: BoneKeyframe[];
  interpolation: Interpolation;
}

export interface Animation {
  id: string;
  name: string;
  duration: number;
  fps: number;
  loop: boolean;
  tracks: BoneTrack[];
}

export interface TargetKeyframe {
  time: number;
  x: number;
  y: number;
}

export interface IKConstraint {
  id: string;
  name: string;
  rootBoneId: string;
  tipBoneId: string;
  targetX: number;
  targetY: number;
  bendDirection: 1 | -1;
  enabled: boolean;
  targetKeys: TargetKeyframe[];
  animationId?: string;
}

export interface Project {
  version: 1;
  id: string;
  name: string;
  width: number;
  height: number;
  assets: Asset[];
  bones: Bone[];
  attachments: Attachment[];
  animations: Animation[];
  ikConstraints: IKConstraint[];
}

export interface WorldBone extends Bone {
  endX: number;
  endY: number;
}

export interface IKDiagnostic {
  constraintId: string;
  reachable: boolean;
  distance: number;
}

export interface Pose {
  bones: Record<string, WorldBone>;
  ikDiagnostics: IKDiagnostic[];
  ikTargets: Record<string, { x: number; y: number }>;
}

export interface SamplePoseOptions {
  project: Project;
  animationId?: string | null;
  time: number;
}

export interface TwoBoneIKOptions {
  rootX: number;
  rootY: number;
  targetX: number;
  targetY: number;
  rootLength: number;
  tipLength: number;
  bendDirection: 1 | -1;
  fallbackRotation?: number;
}

export interface TwoBoneIKResult {
  rootRotation: number;
  tipRotation: number;
  reachable: boolean;
  endX: number;
  endY: number;
  distance: number;
}

export type ProjectCommand =
  | { type: 'project.update'; changes: Partial<Pick<Project, 'name' | 'width' | 'height'>> }
  | { type: 'asset.add'; asset: Asset }
  | { type: 'bone.add'; bone: Bone }
  | { type: 'bone.update'; boneId: string; changes: Partial<Omit<Bone, 'id'>> }
  | { type: 'bone.remove'; boneId: string }
  | { type: 'attachment.add'; attachment: Attachment }
  | { type: 'attachment.update'; attachmentId: string; changes: Partial<Omit<Attachment, 'id'>> }
  | { type: 'attachment.remove'; attachmentId: string }
  | { type: 'animation.add'; animation: Animation }
  | { type: 'animation.update'; animationId: string; changes: Partial<Omit<Animation, 'id'>> }
  | { type: 'animation.remove'; animationId: string }
  | { type: 'keyframe.set'; animationId: string; boneId: string; keyframe: BoneKeyframe; interpolation?: Interpolation }
  | { type: 'keyframe.remove'; animationId: string; boneId: string; time: number }
  | { type: 'ik.add'; constraint: IKConstraint }
  | { type: 'ik.update'; constraintId: string; changes: Partial<Omit<IKConstraint, 'id'>> }
  | { type: 'ik.remove'; constraintId: string }
  | { type: 'ik.keyframe.set'; constraintId: string; keyframe: TargetKeyframe }
  | { type: 'ik.keyframe.remove'; constraintId: string; time: number };

export interface ExecuteCommandOptions {
  project: Project;
  command: unknown;
}

export interface ExecuteCommandsOptions {
  project: Project;
  commands: unknown[];
}
