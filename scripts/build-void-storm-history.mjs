import { promises as fs } from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { sha256 } from '../src/core/io.mjs';
import { stormObservation, backtestVoidStorms } from '../src/core/void-storm-forecast.mjs';

const inputIndex = process.argv.indexOf('--input');
if (inputIndex < 0 || !process.argv[inputIndex + 1]) throw new Error('用法：node scripts/build-void-storm-history.mjs --input 每日快照根目录');
const root = path.resolve(process.argv[inputIndex + 1]);
const samples = [], missing = [];
const dates = (await fs.readdir(root, { withFileTypes: true })).filter(row => row.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(row.name)).map(row => row.name).sort();
if (!dates.length) throw new Error('未找到 YYYY-MM-DD 日期目录');
for (let at = Date.parse(dates[0]); at <= Date.parse(dates.at(-1)); at += 86400000) {
  const day = new Date(at).toISOString().slice(0, 10);
  for (const server of ['de', 'wg']) {
    const file = `${day}/${server}_fissures.json`;
    let bytes;
    try { bytes = await fs.readFile(path.join(root, file)); } catch (error) { if (error.code !== 'ENOENT') throw error; missing.push(file); continue; }
    samples.push(stormObservation(JSON.parse(bytes), { server, source: file, id: file, hash: sha256(bytes) }));
  }
}
// A compact, exact dictionary: no fuzzy translation join for old server labels.
const plus = path.resolve('世界状态上游/git/warframe-public-export-plus');
const provenance = [];
async function metadata(name) {
  const file = path.join(plus, name), bytes = await fs.readFile(file);
  provenance.push({ file: path.relative(process.cwd(), file), hash: sha256(bytes) });
  return JSON.parse(bytes);
}
const regions = await metadata('ExportRegions.json'), zh = await metadata('dict.zh.json'), en = await metadata('dict.en.json');
const missionTypes = Object.fromEntries(Object.entries(await metadata('ExportMissionTypes.json')).map(([key, row]) => [key, zh[row.name] || null]));
const nodes = {}, aliases = {}, ambiguous = new Set();
const clean = value => value.normalize('NFKC').replace(/\s+/g, ' ').replace(/\s*\(\s*/g, '(').replace(/\s*\)/g, ')').trim();
function alias(name, key) {
  const normalized = clean(name);
  if (ambiguous.has(normalized)) return;
  if (aliases[normalized] && aliases[normalized] !== key) { delete aliases[normalized]; ambiguous.add(normalized); }
  else aliases[normalized] = key;
}
for (const [key, region] of Object.entries(regions)) {
  if (!key.startsWith('CrewBattleNode') || region.missionType !== 'MT_RAILJACK') continue;
  nodes[key] = { name: `${zh[region.name]}（${zh[region.systemName]}）`, missionType: zh[region.missionName] || null, missionName: region.missionName };
  for (const dict of [zh, en]) {
    const name = dict[region.name], system = dict[region.systemName];
    if (!name || !system) continue;
    for (const area of new Set([system, system.replace(/ Proxima$/, '').replace(/比邻星域$/, '')])) {
      alias(`${name} (${area})`, key); alias(`${name}（${area}）`, key); alias(`${name} · ${area}`, key);
    }
  }
}
const bundle = { schemaVersion: 2, sourceLabel: '桌面每日快照（时间、节点、纪元与原始任务类型）', calendarRange: [dates[0], dates.at(-1)], missing, samples,
  catalog: { nodes, missionTypes, aliases, provenance, note: '精确名称及已知括号格式；无法匹配的历史译名保留原始标签，不模糊合并。' } };
const output = new URL('../src/data/void-storm-history.json.gz', import.meta.url);
await fs.writeFile(output, gzipSync(JSON.stringify(bundle), { level: 9 }));
for (const server of ['de', 'wg']) {
  const { evaluations, ...result } = backtestVoidStorms(samples, { server });
  console.log(JSON.stringify(result, null, 2));
}
console.log(`已生成 ${output.pathname}：${samples.length} 份来源快照，${missing.length} 个缺失文件。`);
