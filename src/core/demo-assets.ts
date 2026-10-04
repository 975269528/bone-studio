import type { Asset } from './types';

function svgAsset(options: { id: string; name: string; width: number; height: number; content: string }): Asset {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${options.width}" height="${options.height}" viewBox="0 0 ${options.width} ${options.height}">${options.content}</svg>`;
  return { id: options.id, name: options.name, width: options.width, height: options.height,
    dataUrl: `data:image/svg+xml;base64,${btoa(svg)}` };
}

function limb(options: { id: string; name: string; length: number; color: string }): Asset {
  return svgAsset({ id: options.id, name: options.name, width: options.length + 28, height: 34,
    content: `<rect x="1" y="2" width="${options.length + 26}" height="30" rx="15" fill="${options.color}" stroke="#183245" stroke-width="2"/><rect x="22" y="6" width="${options.length - 15}" height="8" rx="4" fill="#fff" opacity=".26"/><circle cx="14" cy="17" r="8" fill="#163b50"/><circle cx="14" cy="17" r="4" fill="#8de4ee"/><circle cx="${options.length + 14}" cy="17" r="7" fill="#163b50"/>` });
}

/** 生成透明、分开的机器人素材；不依赖文件、网络或图像生成服务。 */
export function createDemoAssets(): Asset[] {
  return [
    svgAsset({ id: 'asset-head', name: '机器人 · 头', width: 114, height: 102,
      content: '<path d="M57 4v12" stroke="#263f4f" stroke-width="4"/><circle cx="57" cy="5" r="5" fill="#fdad62"/><rect x="4" y="25" width="106" height="68" rx="26" fill="#dbeef2" stroke="#183245" stroke-width="3"/><rect x="16" y="39" width="82" height="31" rx="13" fill="#173b50"/><circle cx="39" cy="54" r="7" fill="#66e3de"/><circle cx="75" cy="54" r="7" fill="#66e3de"/><path d="M45 80h24" stroke="#345b6b" stroke-width="4" stroke-linecap="round"/><rect x="1" y="48" width="9" height="25" rx="4" fill="#ffb76b"/><rect x="104" y="48" width="9" height="25" rx="4" fill="#ffb76b"/>' }),
    svgAsset({ id: 'asset-torso', name: '机器人 · 躯干', width: 116, height: 136,
      content: '<rect x="39" y="1" width="38" height="20" rx="9" fill="#1e4153"/><path d="M12 24Q58 6 104 24L100 113Q58 141 16 113Z" fill="#3b8096" stroke="#183245" stroke-width="3"/><path d="M24 32Q58 21 92 32L88 82H28Z" fill="#7dc9d5"/><circle cx="58" cy="57" r="18" fill="#163b50"/><path d="M58 44v14l9 7" fill="none" stroke="#ffbd73" stroke-width="5" stroke-linecap="round"/><rect x="32" y="97" width="52" height="14" rx="7" fill="#183b50"/><circle cx="42" cy="104" r="3" fill="#5fe1d5"/><circle cx="58" cy="104" r="3" fill="#ffbd73"/><circle cx="74" cy="104" r="3" fill="#5fe1d5"/>' }),
    limb({ id: 'asset-upper-arm', name: '机器人 · 上臂', length: 58, color: '#70bccb' }),
    limb({ id: 'asset-lower-arm', name: '机器人 · 前臂', length: 52, color: '#a8dce3' }),
    limb({ id: 'asset-thigh', name: '机器人 · 大腿', length: 58, color: '#5a94a9' }),
    limb({ id: 'asset-shin', name: '机器人 · 小腿', length: 55, color: '#93cbd8' }),
    svgAsset({ id: 'asset-hand', name: '机器人 · 手掌', width: 38, height: 46,
      content: '<path d="M10 12V7a4 4 0 0 1 8 0v4-6a4 4 0 0 1 8 0v7-3a4 4 0 0 1 8 0v20q-2 14-17 14Q5 40 4 29L1 21q-1-5 4-5Z" fill="#ffbf7b" stroke="#183245" stroke-width="2"/>' }),
    svgAsset({ id: 'asset-foot', name: '机器人 · 鞋', width: 68, height: 32,
      content: '<path d="M4 8q17-11 30 0l8 7h15q10 0 10 12H3Z" fill="#173b50" stroke="#122937" stroke-width="2"/><path d="M6 26h56" stroke="#69b8c8" stroke-width="4" stroke-linecap="round"/>' }),
  ];
}
