/** 默认人物的参考风格；暖棕轮廓、柔和肤色和紫色布料沿用于新分件。 */
export const DEMO_PALETTE = {
  outline: '#65483f', skinLight: '#fff3df', skinShadow: '#f1d0b7',
  purpleLight: '#aa8fc2', purpleShadow: '#8075af', linenLight: '#fffdf4', linenShadow: '#e5dce2',
} as const;

/** 512px 画布上的幼儿比例；参考的轻微朝左姿态保留近远侧差异。 */
export const DEMO_RIG = {
  rootX: 256, rootY: 355, upperArmLength: 43, forearmLength: 42, outlineWidth: 2.4,
} as const;
