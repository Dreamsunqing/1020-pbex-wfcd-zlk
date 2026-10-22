// Offline inventory; --probe performs only the bounded sample requests listed below.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
const root = path.resolve(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : '世界状态上游');
const out = path.resolve('artifacts/p3'); await fs.mkdir(out, { recursive: true });
const load = async file => JSON.parse(await fs.readFile(path.join(root, file), 'utf8'));
const manifest = (await load('official-public-export/manifests/en/ExportManifest.json')).Manifest;
const counts = {}, keys = {}, examples = {};
for (const file of await fs.readdir(path.join(root, 'official-public-export/manifests/en'))) {
  if (!file.endsWith('.json')) continue;
  const walk = (value, pointer = '') => {
    if (Array.isArray(value)) value.forEach((v, i) => walk(v, pointer + '/' + i));
    else if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) {
      const at = pointer + '/' + key.replaceAll('~', '~0').replaceAll('/', '~1');
      if (/png|img|image|icon|texture/i.test(key)) { const field = file + ':' + key; keys[field] = (keys[field] ?? 0) + 1; examples[field] ??= { pointer: at, value: child }; }
      walk(child, at);
    }
    else if (typeof value === 'string' && /\.(png|jpe?g|webp)(!|$)/i.test(value)) counts[file] = (counts[file] ?? 0) + 1;
  };
  walk(await load('official-public-export/manifests/en/' + file));
}
const formats = {};
for (const entry of manifest) { const format = entry.textureLocation.split('!')[0].split('.').at(-1).toLowerCase(); formats[format] = (formats[format] ?? 0) + 1; }
const images = await load('git/warframe-public-export-plus/ExportImages.json');
const report = { basis: 'local snapshot, one language; image manifest duplicated in other language folders', entries: manifest.length, uniqueIds: new Set(manifest.map(e => e.uniqueName)).size, uniqueTextures: new Set(manifest.map(e => e.textureLocation)).size, formats, imageLikeKeys: keys, examples, imageValueOccurrences: counts, plus: { entries: Object.keys(images).length, contentHash: Object.values(images).filter(v => v.contentHash).length, forumName: Object.values(images).filter(v => v.forumName).length } };
await fs.writeFile(path.join(out, 'official-image-inventory.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (process.argv.includes('--probe')) {
  const samples = [
    ['weapon', '/Lotus/Weapons/Tenno/LongGuns/SapientPrimary/SapientPrimaryWeapon'],
    ['warframe', '/Lotus/Powersuits/Runner/Runner'],
    ['blueprint', '/Lotus/Types/Recipes/WarframeRecipes/GyreHelmetBlueprint'],
    ['resource', '/Lotus/Types/Items/MiscItems/Neurode'],
    ['mod', '/Lotus/Powersuits/Runner/RunnerRushAugmentCard']
  ].map(([label, id]) => { const entry = manifest.find(e => e.uniqueName === id); if (!entry) throw new Error('样本缺失：' + id); return { label, entry, url: 'https://content.warframe.com/PublicExport/' + entry.textureLocation.replace(/^\//, '') }; });
  samples.push({ label: 'without-hash', url: samples[0].url.split('!')[0] });
  const glyph = '/Lotus/Interface/Icons/Player/DanteGlyph.png', glyphInfo = images[glyph];
  if (glyphInfo?.contentHash) samples.push({ label: 'plus-official-hash', url: 'https://content.warframe.com/PublicExport' + glyph + '!' + glyphInfo.contentHash });
  if (glyphInfo?.forumName) samples.push({ label: 'plus-forum', url: 'https://media.invisioncic.com/Mwarframe/pages_media/' + encodeURIComponent(glyphInfo.forumName) + '.png' });
  samples.push({ label: 'community-browse', url: 'https://browse.wf' + glyph });
  await fs.mkdir(path.join(out, 'image-probes'), { recursive: true });
  const probes = await Promise.all(samples.map(async sample => {
    try {
      const response = await fetch(sample.url, { signal: AbortSignal.timeout(20000) });
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length > 4 * 1024 * 1024) throw new Error('样本响应超出 4 MiB');
      const result = { ...sample, status: response.status, contentType: response.headers.get('content-type'), bytes: bytes.length, signature: bytes.subarray(0, 12).toString('hex'), sha256: createHash('sha256').update(bytes).digest('hex') };
      if (response.ok) await fs.writeFile(path.join(out, 'image-probes', sample.label + '.bin'), bytes);
      return result;
    } catch (error) { return { ...sample, error: error.message }; }
  }));
  await fs.writeFile(path.join(out, 'official-image-probes.json'), JSON.stringify({ checkedAt: new Date().toISOString(), probes }, null, 2));
  console.log(JSON.stringify(probes.map(({ entry, ...value }) => value), null, 2));
}
