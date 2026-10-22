// Explicit maintenance/export entrypoint. Run with Electron through 工具/07-合成蓝图.mjs.
import { app, BrowserWindow } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { LocalImages } from '../src/core/local-images.mjs';
import { composeBlueprintLayers } from '../src/core/image-composition.mjs';
import { safeFilename, writeWithoutOverwrite } from '../src/core/image-export.cjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { values } = parseArgs({ args: process.argv.slice(2), options: { id: { type: 'string' }, 'result-id': { type: 'string' }, content: { type: 'string', default: path.join(root, 'assets/content') }, out: { type: 'string' }, size: { type: 'string', default: '512' } } });
let win, profile;
try {
  if (!values.id?.startsWith('/Lotus/')) throw new Error('请传 --id 蓝图完整路径；可用 --result-id 指定经核对的配方成品。');
  const size = Number(values.size); if (!Number.isInteger(size) || size < 64 || size > 2048) throw new Error('size 须为 64～2048 整数');
  const images = new LocalImages(); await images.select(values.content);
  const [image] = await images.batch([{ id: values.id, blueprint: true, resultId: values['result-id'] }]);
  if (image?.kind !== 'blueprint') throw new Error('没有同时找到蓝图底纹和唯一成品图，未输出误导性图片。可检查成品完整 ID 和本地图库。');
  profile = await fs.mkdtemp(path.join(os.tmpdir(), 'workbench-blueprint-')); app.setPath('userData', profile); app.disableHardwareAcceleration();
  await app.whenReady();
  win = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
  await win.loadURL('data:text/html,<meta charset="utf-8"><title>Blueprint export</title>');
  const url = await win.webContents.executeJavaScript(`(${composeBlueprintLayers.toString()})(${JSON.stringify(image.layers)},${size})`);
  const target = values.out ? path.resolve(values.out) : path.join(root, '输出/蓝图合成', safeFilename(values.id.split('/').at(-1)) + '.png');
  if (!target.toLowerCase().endsWith('.png')) throw new Error('合成结果须保存为 .png');
  await fs.mkdir(path.dirname(target), { recursive: true });
  const file = await writeWithoutOverwrite(Buffer.from(url.split(',')[1], 'base64'), path.dirname(target), path.basename(target));
  console.log(JSON.stringify({ file, width: size, height: size, blueprintId: values.id, resultId: image.layers.find(layer => layer.role === 'item').itemId, sourceImagesUnchanged: true }, null, 2));
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally { win?.destroy(); if (profile) await fs.rm(profile, { recursive: true, force: true }).catch(() => {}); app.exit(process.exitCode || 0); }
