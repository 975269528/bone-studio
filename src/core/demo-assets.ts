import type { Asset } from './types';
import { headArtwork } from './demo-head';
import { apronArtwork, shirtArtwork } from './demo-clothes';
import { createLimbAssets } from './demo-limbs';
import { DEMO_PALETTE, DEMO_RIG } from './demo-style';

/** 本地透明分件的原生 SVG 描述；尺寸与绑定锚点共同确定关节重叠。 */
export interface DemoArtwork {
  id: string;
  name: string;
  width: number;
  height: number;
  content: string;
}

/** 将透明矢量分件封装为可保存素材；内部 SVG 只包含本地绘图。 */
export function createVectorAsset(artwork: DemoArtwork): Asset {
  const palette = DEMO_PALETTE;
  const definitions = `<defs><linearGradient id="skin" x2=".3" y2="1"><stop stop-color="${palette.skinLight}"/><stop offset="1" stop-color="${palette.skinShadow}"/></linearGradient><linearGradient id="purple" x2=".85" y2="1"><stop stop-color="${palette.purpleLight}"/><stop offset="1" stop-color="${palette.purpleShadow}"/></linearGradient><linearGradient id="linen" x2=".8" y2="1"><stop stop-color="${palette.linenLight}"/><stop offset="1" stop-color="${palette.linenShadow}"/></linearGradient></defs>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${artwork.width}" height="${artwork.height}" viewBox="0 0 ${artwork.width} ${artwork.height}">${definitions}<g stroke="${palette.outline}" stroke-width="${DEMO_RIG.outlineWidth}" stroke-linecap="round" stroke-linejoin="round">${artwork.content}</g></svg>`;
  return { id: artwork.id, name: artwork.name, width: artwork.width, height: artwork.height,
    dataUrl: `data:image/svg+xml;base64,${btoa(svg)}` };
}

/** 生成紫头巾小厨师的独立透明分件，近远侧各有形体与材质细节。 */
export function createDemoAssets(): Asset[] {
  return [createVectorAsset(headArtwork), createVectorAsset(shirtArtwork),
    createVectorAsset(apronArtwork), ...createLimbAssets().map(createVectorAsset)];
}
