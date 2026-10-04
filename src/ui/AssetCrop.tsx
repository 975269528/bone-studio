import { useState } from 'react';
import type { FormEvent } from 'react';
import { Crop, Plus } from 'lucide-react';
import type { Asset } from '@/core/types';
import { Modal } from './controls';
import { loadImage } from './files';
import { applyCommands, reportError, updateEditor } from './store';

interface CropRegion { x: number; y: number; width: number; height: number }

async function createCrop(options: { asset: Asset; region: CropRegion; name: string }): Promise<Asset> {
  const { asset, region, name } = options; const image = await loadImage(asset.dataUrl);
  const canvas = document.createElement('canvas'); canvas.width = region.width; canvas.height = region.height;
  const context = canvas.getContext('2d'); if (!context) throw new Error('无法创建图片画布。');
  context.drawImage(image, region.x, region.y, region.width, region.height, 0, 0, region.width, region.height);
  return { id: crypto.randomUUID(), name, dataUrl: canvas.toDataURL('image/png'), width: region.width, height: region.height };
}

/** Split a source image into named PNG assets while retaining its transparency. */
export function AssetCrop(props: { asset: Asset; onClose: () => void }) {
  const { asset } = props;
  const [region, setRegion] = useState<CropRegion>({ x: 0, y: 0, width: asset.width, height: asset.height });
  const [name, setName] = useState(`${asset.name.replace(/\.[^.]+$/, '')} · 部件`);
  const [isSaving, setIsSaving] = useState(false); const [count, setCount] = useState(0);
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (isSaving || !event.currentTarget.reportValidity()) return;
    if (region.x + region.width > asset.width || region.y + region.height > asset.height) { reportError(new Error('裁切区域超出了原图边界。')); return; }
    setIsSaving(true);
    try { const cropped = await createCrop({ asset, region, name: name.trim() }); applyCommands([{ type: 'asset.add', asset: cropped }]);
      setCount(count + 1); setName(`${asset.name.replace(/\.[^.]+$/, '')} · 部件 ${count + 2}`); updateEditor({ message: `已添加部件 ${cropped.name}，可继续拆分其他区域。` });
    } catch (error) { reportError(error); } finally { setIsSaving(false); }
  };
  return <Modal title="图片拆分 · 裁切部件" onClose={props.onClose} wide><form onSubmit={event => { void handleSubmit(event); }}><div className="crop-layout">
    <div className="crop-image checker"><div style={{ position: 'relative', display: 'inline-block' }}><img src={asset.dataUrl} alt="待拆分原图" />
      <div className="crop-region" style={{ left: `${region.x / asset.width * 100}%`, top: `${region.y / asset.height * 100}%`, width: `${region.width / asset.width * 100}%`, height: `${region.height / asset.height * 100}%` }}><Crop size={20} /></div></div></div>
    <div><p className="field-help">以左上角为原点，输入区域坐标与尺寸。可连续添加多个透明 PNG 部件。</p><label className="field full"><span>部件名称 <b>*</b></span><input autoFocus required value={name} onChange={event => setName(event.target.value)} /></label>
      <div className="property-grid">{(['x', 'y', 'width', 'height'] as const).map(key => <label className="field" key={key}><span>{{ x: 'X 坐标', y: 'Y 坐标', width: '宽度', height: '高度' }[key]}</span>
        <input type="number" required min={key === 'x' || key === 'y' ? 0 : 1} max={key === 'x' || key === 'width' ? asset.width : asset.height} step={1} value={region[key]} onChange={event => setRegion({ ...region, [key]: Number(event.target.value) })} /></label>)}</div>
      <p className="crop-count">已添加 {count} 个部件</p><button className="primary" type="submit" disabled={isSaving || !name.trim()}><Plus size={15} />{isSaving ? '正在处理…' : '添加裁切部件'}</button></div>
    </div><footer><span className="muted">原图 {asset.width} × {asset.height} px</span><button type="button" onClick={props.onClose}>完成拆分</button></footer></form></Modal>;
}
