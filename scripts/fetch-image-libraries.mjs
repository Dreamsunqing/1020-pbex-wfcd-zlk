// Explicit developer maintenance command; never runs during application browsing.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fetch, EnvHttpProxyAgent } from 'undici';
import { atomicJson } from '../src/core/io.mjs';
const sha = value => createHash('sha256').update(value).digest('hex');
const root = path.resolve('世界状态上游'), cache = path.resolve('assets/content/official');
const wfcdRoot = path.resolve(process.env.WORKBENCH_WFCD_IMAGES ?? 'assets/content/wfcd');
const out = path.resolve('artifacts/image-comparison'), skills = path.resolve('.cache/ability-download');
const read = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const signature = b => b.subarray(0,8).toString('hex') === '89504e470d0a1a0a' ? 'png' : b[0] === 255 && b[1] === 216 && b[2] === 255 ? 'jpg' : null;
function dimensions(bytes) {
  if (signature(bytes) === 'png' && bytes.length >= 24) return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
  if (signature(bytes) !== 'jpg') return null;
  let i = 2;
  while (i + 8 < bytes.length) {
    if (bytes[i] !== 255) { i++; continue; }
    const marker = bytes[i + 1]; if (marker === 255) { i++; continue; }
    if ([0xd8, 0xd9].includes(marker)) { i += 2; continue; }
    const size = bytes.readUInt16BE(i + 2); if (size < 2 || i + size + 2 > bytes.length) return null;
    if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)) return [bytes.readUInt16BE(i + 7), bytes.readUInt16BE(i + 5)];
    if (marker === 0xda) return null; i += size + 2;
  }
  return null;
}
const agent = new EnvHttpProxyAgent();
async function bitmap(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(url, { dispatcher: agent, signal: AbortSignal.timeout(30000) });
      if (!r.ok) { await r.body?.cancel(); throw new Error('HTTP ' + r.status); }
      const chunks = []; let length = 0;
      for await (const chunk of r.body) { length += chunk.length; if (length > 8 * 1024 * 1024) throw new Error('响应超出 8 MiB'); chunks.push(chunk); }
      const bytes = Buffer.concat(chunks), format = signature(bytes); if (!format) throw new Error('响应不是 PNG/JPEG');
      return { bytes, format, sha256: sha(bytes), width: dimensions(bytes)?.[0] ?? null, height: dimensions(bytes)?.[1] ?? null };
    } catch (e) { if (attempt === 2 || /HTTP 40[034]/.test(e.message)) throw e; }
  }
}
async function parallel(rows, operation, label) {
  let index = 0, completed = 0;
  await Promise.all(Array.from({ length: 16 }, async () => { while (index < rows.length) { const row = rows[index++]; await operation(row); completed++; if (completed % 200 === 0 || completed === rows.length) console.log(`${label}: ${completed}/${rows.length}`); } }));
}
await fs.mkdir(out, { recursive: true });
try {
  if (!process.argv.includes('--official-only')) {
    const frameFiles = await Promise.all(['Warframes.json','Archwing.json'].map(async name => { const file = 'wfcd-items/data/json/' + name; const bytes = await fs.readFile(path.join(root,file)); return { file, bytes, sha256: sha(bytes) }; }));
    const records = frameFiles.flatMap(input => JSON.parse(input.bytes).flatMap(f => f.abilities ?? [])), imageNames = [...new Set(records.map(a => a.imageName).filter(n => /^[a-zA-Z0-9_. -]+\.(png|jpe?g)$/i.test(n)))];
    await fs.mkdir(skills, { recursive: true }); const downloaded = [], failed = [];
    await parallel(imageNames, async name => {
      const url = 'https://raw.githubusercontent.com/WFCD/warframe-items/20f8d9427a5a62268817853eefd8962d18c0b70e/data/img/' + encodeURIComponent(name), file = path.join(skills, name);
      try { let bytes = await fs.readFile(file).catch(() => null), result = bytes && signature(bytes) ? { bytes, sha256: sha(bytes) } : await bitmap(url); if (!bytes || !signature(bytes)) await fs.writeFile(file, result.bytes); downloaded.push({ name, url, bytes: result.bytes.length, sha256: result.sha256 }); } catch (e) { failed.push({ name, url, error: e.message }); }
    }, 'WFCD 技能');
    const report = { checkedAt: new Date().toISOString(), upstreamCommit: '20f8d9427a5a62268817853eefd8962d18c0b70e', sources: frameFiles.map(({ file, sha256 }) => ({ file, sha256 })), records: records.length, uniqueImages: imageNames.length, downloaded: downloaded.sort((a,b)=>a.name.localeCompare(b.name)), failed, mappings: records.map(a => ({ id: a.uniqueName, imageName: a.imageName })).filter(a => downloaded.some(d => d.name === a.imageName)) };
    await fs.writeFile(path.join(skills, 'index.json'), JSON.stringify(report, null, 2));
    await fs.writeFile(path.join(skills, 'catalog.json'), JSON.stringify({ items: report.mappings.map(r => ({ id: r.id, imageName: r.imageName, assetName: r.imageName, hasImage: true, imageKind: 'original' })) }));
    console.log('WFCD 技能结果', JSON.stringify({ downloaded: downloaded.length, failed: failed.length }));
  }
  if (process.argv.includes('--skills-only')) process.exitCode = 0;
  else {
    await fs.mkdir(path.join(cache, 'img'), { recursive: true });
    const manifestBytes = await fs.readFile(path.join(root, 'official-public-export/manifests/en/ExportManifest.json'));
    const manifest = JSON.parse(manifestBytes).Manifest, textures = [...new Set(manifest.map(r => r.textureLocation))];
    const existingIndex = await read(path.join(cache, 'index.json')).catch(() => null);
    const prior = await read(path.join(cache, 'checkpoint.json')).catch(() => existingIndex ?? { assets: [] });
    const assets = new Map(prior.assets.map(a => [a.textureLocation, a])), failures = [];
    await parallel(textures, async textureLocation => {
      const url = 'https://content.warframe.com/PublicExport/' + textureLocation.replace(/^\/+/, '');
      try {
        const old = assets.get(textureLocation), bytes = old && await fs.readFile(path.join(cache, 'img', old.file)).catch(() => null);
        if (bytes && signature(bytes) && sha(bytes) === old.sha256) return;
        const result = await bitmap(url), file = result.sha256 + '.' + result.format;
        await fs.writeFile(path.join(cache, 'img', file), result.bytes);
        assets.set(textureLocation, { textureLocation, url, file, bytes: result.bytes.length, format: result.format, sha256: result.sha256, width: result.width, height: result.height });
      } catch (e) { assets.delete(textureLocation); failures.push({ textureLocation, url, error: e.message }); }
      if (assets.size % 100 === 0) await atomicJson(path.join(cache, 'checkpoint.json'), { assets: [...assets.values()] });
    }, '官方 Public Export');
    const selected = textures.map(t => assets.get(t)).filter(Boolean);
    const index = { checkedAt: new Date().toISOString(), manifest: { file: 'official-public-export/manifests/en/ExportManifest.json', sha256: sha(manifestBytes) }, entries: manifest, assets: selected, failures };
    if (existingIndex?.manifest && existingIndex.manifest.sha256 !== index.manifest.sha256) await atomicJson(path.join(cache, 'previous.json'), existingIndex);
    await atomicJson(path.join(cache, 'index.json'), index);
    await fs.writeFile(path.join(cache, 'ExportManifest.json'), manifestBytes);
    await fs.rm(path.join(cache, 'checkpoint.json'), { force: true });
    const previous = await read(path.join(cache, 'previous.json')).catch(() => null);
    const kept = new Set([...selected, ...(previous?.assets ?? [])].map(a => a.file));
    for (const file of await fs.readdir(path.join(cache, 'img'))) if (/^[0-9a-f]{64}\.(png|jpg)$/.test(file) && !kept.has(file)) await fs.rm(path.join(cache, 'img', file));
    const catalog = await read(path.join(wfcdRoot, 'catalog.json')), wfcd = new Map();
    for (const row of catalog.items) if (row.hasImage && row.imageKind === 'original' && typeof row.assetName === 'string' && path.basename(row.assetName) === row.assetName) { const file = path.join(wfcdRoot, 'img', row.assetName); if (await fs.stat(file).then(s => s.isFile(), () => false)) wfcd.set(row.id, row); }
    const wfcdNames = [...new Set([...wfcd.values()].map(r => r.assetName))], wfcdHashes = new Map(), wfcdSizes = {}, wfcdBytes = [], wfcdContents = new Map(); 
    for (const name of wfcdNames) { const bytes = await fs.readFile(path.join(wfcdRoot, 'img', name)); wfcdHashes.set(name, sha(bytes)); wfcdContents.set(sha(bytes), bytes.length); wfcdBytes.push(bytes.length); const size = dimensions(bytes)?.join('×') ?? 'unknown'; wfcdSizes[size] = (wfcdSizes[size] ?? 0) + 1; }
    const officialIds = new Set(manifest.map(r=>r.uniqueName)), downloadedIds = new Set(manifest.filter(r => assets.has(r.textureLocation)).map(r=>r.uniqueName));
    const overlap = [], officialOnly = [], wfcdOnly = [], categories = {};
    const kinds = new Map();
    for (const file of await fs.readdir(path.join(root, 'official-public-export/manifests/en'))) {
      if (file === 'ExportManifest.json' || !file.endsWith('.json')) continue;
      const scan = (value, group) => { if (Array.isArray(value)) value.forEach(v=>scan(v,group)); else if (value && typeof value === 'object') { const id = value.uniqueName ?? value.abilityUniqueName; if (id) kinds.set(id, group); for (const [k,v] of Object.entries(value)) if (v && typeof v === 'object') scan(v, group || k); } }; scan(await read(path.join(root,'official-public-export/manifests/en',file)), file.replace(/(_en)?\.json$/,''));
    }
    for (const row of manifest) {
      const available = assets.get(row.textureLocation), local = wfcd.get(row.uniqueName), category = local?.category ?? kinds.get(row.uniqueName) ?? '官方清单其他（外观等）';
      categories[category] ??= { officialIds: 0, overlap: 0, officialOnly: 0 }; categories[category].officialIds++; categories[category][local ? 'overlap' : 'officialOnly']++;
      const result = { id: row.uniqueName, category, textureLocation: row.textureLocation, downloaded: Boolean(available), ...(local ? { wfcdFile: local.assetName, wfcdImageName: local.imageName, sameBytes: available ? available.sha256 === wfcdHashes.get(local.assetName) : null } : {}) };
      (local ? overlap : officialOnly).push(result);
    }
    for (const [id,row] of wfcd) if (!officialIds.has(id)) wfcdOnly.push({ id, category: row.category, name: row.zh || row.name, imageName: row.imageName, file: row.assetName });
    const physical = new Map(selected.map(a=>[a.sha256,a]));
    const skillIndex = await read(path.join(skills, 'index.json')).catch(()=>null);
    const augmentedIds = new Set([...wfcd.keys(), ...(skillIndex?.mappings ?? []).map(r => r.id)]);
    const augmented = { wfcdIds: augmentedIds.size, overlap: [...augmentedIds].filter(id => officialIds.has(id)).length, officialOnly: [...officialIds].filter(id => !augmentedIds.has(id)).length, wfcdOnly: [...augmentedIds].filter(id => !officialIds.has(id)).length };
    const officialSizes = {};
    for (const asset of physical.values()) { if (!asset.width) { const size = dimensions(await fs.readFile(path.join(cache,'img',asset.file))); if(size) { asset.width=size[0];asset.height=size[1]; } } const key = asset.width ? asset.width + '×' + asset.height : 'unknown'; officialSizes[key]=(officialSizes[key]??0)+1; }

    const localOriginalNames = new Set([...wfcd.values()].flatMap(row => [row.imageName, row.resolvedImageName]).filter(Boolean));
    const overlapTextures = new Set(overlap.map(row => row.textureLocation));
    const extraGroups = {};
    for (const row of officialOnly) { const group = row.textureLocation.split('/').slice(0,-1).join('/'); extraGroups[group] = (extraGroups[group] ?? 0) + 1; }
    const extraAnalysis = { uniqueTextureUrls: new Set(officialOnly.map(r=>r.textureLocation)).size, uniqueTexturesNotUsedByCommonIds: new Set(officialOnly.filter(r=>!overlapTextures.has(r.textureLocation)).map(r=>r.textureLocation)).size, exactOriginalFilenameInLocal: officialOnly.filter(r=>localOriginalNames.has(r.textureLocation.split('!')[0].split('/').at(-1))).length, textureDirectories: extraGroups, note: '精确原图名可复用仅代表文件名关联，不能证明不同版本像素相同；未按英文标题模糊匹配。' };
    const report = { extraAnalysis, checkedAt: index.checkedAt, augmented, officialSizes, wfcdSizes, basis: '同一完整物品 ID 比较，WFCD 仅计本机 catalog 原图且文件存在；技能补充库单独计数。图片文件数不能当作物品数。', manifest: index.manifest, official: { ids: officialIds.size, uniqueTextureUrls: textures.length, downloadedUrls: selected.length, downloadedIds: downloadedIds.size, uniqueContentFiles: physical.size, bytes: [...physical.values()].reduce((n,a)=>n+a.bytes,0), failures: failures.length, pngUrls: selected.filter(a=>a.format==='png').length, jpgUrls: selected.filter(a=>a.format==='jpg').length }, wfcd: { ids: wfcd.size, uniqueFiles: wfcdNames.length, uniqueContentFiles: wfcdContents.size, uniqueContentBytes: [...wfcdContents.values()].reduce((n,b)=>n+b,0), bytes: wfcdBytes.reduce((a,b)=>a+b,0), categories: Object.fromEntries([...new Set([...wfcd.values()].map(r=>r.category))].map(c=>[c,[...wfcd.values()].filter(r=>r.category===c).length])) }, skills: skillIndex ? { records:skillIndex.records, images:skillIndex.downloaded.length, mappedIds:new Set(skillIndex.mappings.map(r=>r.id)).size, officialCovered:new Set(skillIndex.mappings.filter(r=>officialIds.has(r.id)).map(r=>r.id)).size, failed:skillIndex.failed.length } : null, counts: { overlap: overlap.length, officialOnly: officialOnly.length, wfcdOnly: wfcdOnly.length, sameBytes: overlap.filter(r=>r.sameBytes).length, differentBytes: overlap.filter(r=>r.sameBytes===false).length }, categories, overlap, officialOnly, wfcdOnly, failures };
    await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(report,null,2));
    console.log(JSON.stringify({ ...report, overlap:undefined,officialOnly:undefined,wfcdOnly:undefined,categories:undefined,failures:failures.length },null,2));
  }
} finally { await agent.close(); }
