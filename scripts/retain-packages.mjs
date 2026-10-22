import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
export async function retainPackages(directory, current) {
  const files = await fs.readdir(directory);
  const packages = files.flatMap(file => { const match = /^SourceWorkbench-(\d+\.\d+\.\d+)-(mac|win)-(x64|arm64)(-with-images)?\.zip$/.exec(file); return match ? [{ file, version: match[1], platform: match[2], arch: match[3], withImages: Boolean(match[4]) }] : []; });
  if (!['mac', 'win'].every(platform => packages.some(p => p.version === current && p.platform === platform && p.arch === 'x64' && !p.withImages))) throw new Error('当前 Mac x64 与 Windows x64 ZIP 均成功生成后才能轮换备份');
  const compare = (a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i]; return 0; };
  const prior = [...new Set(packages.filter(p => p.arch === 'x64' && compare(p.version, current) < 0).map(p => p.version))].sort(compare).at(-1);
  const keep = new Set(packages.filter(p => p.arch === 'x64' && [current, prior].includes(p.version)).map(p => p.file));
  let bytes = 0; const removed = [];
  for (const p of packages) if (!keep.has(p.file)) { bytes += (await fs.stat(path.join(directory, p.file))).size; await fs.rm(path.join(directory, p.file)); removed.push(p.file); }
  for (const file of files) if (/^SourceWorkbench-.*\.zip\.blockmap$/.test(file) && (!file.startsWith(`SourceWorkbench-${current}-`) || file.includes('-arm64.'))) { bytes += (await fs.stat(path.join(directory, file))).size; await fs.rm(path.join(directory, file)); removed.push(file); }
  await fs.rm(path.join(directory, 'mac-arm64'), { recursive: true, force: true });
  const report = { current, previous: prior ?? null, kept: [...keep].sort(), removed, freedZipBytes: bytes, policy: '当前版本 + 上一个版本 ZIP；不再生成 Mac arm64' };
  await fs.writeFile(path.join(directory, '备份保留策略.json'), JSON.stringify(report, null, 2) + '\n'); return report;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) { const pkg = JSON.parse(await fs.readFile('package.json', 'utf8')); console.log(JSON.stringify(await retainPackages(path.resolve('dist'), pkg.version), null, 2)); }
