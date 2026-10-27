import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createWorldCatalog } from '../src/core/live-state/catalog.mjs';
import { VoidStormCollector } from '../src/core/void-storm-collector.mjs';

const project = fileURLToPath(new URL('../', import.meta.url));
const root = path.join(project, '.workbench/void-storm-collection');
const output = path.join(project, '输出/九重天采集/九重天七天采集.json');
const read = async file => JSON.parse(await fs.readFile(file, 'utf8'));
let catalog;
// Pin the small mapping dictionaries at startup so the seven-day export is consistent.
if (!process.argv.includes('--status') && !process.argv.includes('--stop')) {
  const pinned = path.join(root, 'catalog.json');
  let data;
  try { data = await read(pinned); } catch (error) {
    if (error.code !== 'ENOENT' || !process.argv.includes('--start')) throw error;
    const base = path.join(project, '世界状态上游/git/warframe-public-export-plus');
    const regions = await read(path.join(base, 'ExportRegions.json')), dictionary = await read(path.join(base, 'dict.zh.json'));
    const missionTypes = await read(path.join(base, 'ExportMissionTypes.json'));
    const selected = Object.fromEntries(Object.entries(regions).filter(([key]) => key.startsWith('CrewBattleNode')));
    const keys = new Set([...Object.values(selected).flatMap(row => [row.name, row.systemName, row.missionName]), ...Object.values(missionTypes).map(row => row.name)]);
    data = { plus: { ExportRegions: selected, ExportMissionTypes: missionTypes, 'dict.zh': Object.fromEntries(Object.entries(dictionary).filter(([key]) => keys.has(key))) },
      fallback: await read(path.join(project, 'src/data/live-state/community-fallback.json')), wg: await read(path.join(project, 'src/data/live-state/wg-nodes.json')) };
    await fs.mkdir(root, { recursive: true });
    await fs.writeFile(pinned, JSON.stringify(data));
  }
  catalog = createWorldCatalog(data);
}
const collector = new VoidStormCollector(root, output, catalog);
const result = process.argv.includes('--status') ? await collector.status() : await collector.tick({ start: process.argv.includes('--start'), stop: process.argv.includes('--stop') });
console.log(JSON.stringify(result, null, 2));
