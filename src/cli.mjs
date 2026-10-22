#!/usr/bin/env node
import path from 'node:path';
import { parseArgs } from 'node:util';
import { loadConfig } from './core/config.mjs';
import { Store, changesBetween } from './core/store.mjs';
import { importLocal, rollback, runUpdate } from './core/updater.mjs';
import { parseDocument, preview, readLibraryFile, scanLibrary } from './core/library.mjs';
import { arbitrations, invigorations } from './core/oracle.mjs';
import { loadBrowseData } from './core/browse-data.mjs';
import { incursions, weeklyRotations, worldCycles, anchorFromWorldState } from './core/browse.mjs';
import { cachedAnchor, refreshAnchor } from './core/world-state.mjs';
import { readFile } from 'node:fs/promises';
import { bountyCycle, locationBounties } from './core/oracle-bounties.mjs';
import { invasionForecast } from './core/oracle-invasions.mjs';
import { weeklyConquests } from './core/oracle-weekly.mjs';
import { loadOracleData, describeOracle } from './core/oracle-data.mjs';
import { cachedOracleState, refreshOracleState, selectOracleState, oracleStateStatus } from './core/oracle-state.mjs';

const { positionals, values } = parseArgs({ allowPositionals: true, options: {
  config: { type: 'string' }, store: { type: 'string' }, root: { type: 'string' }, file: { type: 'string' }, query: { type: 'string' }, pointer: { type: 'string' }, release: { type: 'string' }, before: { type: 'string' }, after: { type: 'string' }, username: { type: 'string' }, observed: { type: 'string' }, target: { type: 'string' }, at: { type: 'string' }, count: { type: 'string' }, 'world-state': { type: 'string' }, seed: { type: 'string' }, help: { type: 'boolean' }
} });
const command = positionals[0] ?? 'help';
const storeRoot = path.resolve(values.store ?? '.workbench');
const root = path.resolve(values.root ?? '.');
const print = value => console.log(JSON.stringify(value, null, 2));
const progress = value => console.error(value.message);
try {
  if (command === 'help' || values.help) console.log(`上游资料工作台 0.9.0\n\n命令：\n  scan --root <资料包或上游目录>\n  preview --root <目录> --file <相对路径> [--query <文本>] [--pointer /路径]\n  import --root <目录> [--store <快照目录>]\n  update [--config <JSON>] [--store <目录>]\n  watch  [--config <JSON>] [--store <目录>]  按配置间隔检查；Ctrl+C 退出\n  status | history [--store <目录>]\n  rollback --release <完整版本ID> [--store <目录>]\n  diff --before <ID> --after <ID> [--store <目录>]\n  arbitration [--at <ISO时间>] [--count 24] [--root <目录>]\n  invigorations --username <游戏名> [--observed <路径,路径,路径>] [--target current|next] [--at <ISO时间>] [--root <目录>]\n  cycles [--at <ISO时间>] [--world-state <本地世界状态JSON>] [--root <目录>]\n  teshin | circuit [--at <ISO时间>] [--count 4] [--root <目录>]\n  incursions [--at <ISO时间>] [--count 7] [--root <目录>]\n  world-state [--store <目录>]  联网刷新周期基准\n  oracle-world-state [--store <目录>]  联网刷新 Oracle 世界状态\n  bounty-cycle | location-bounties [--seed <十进制整数>] [--at <ISO时间>] [--world-state <文件>] [--root <目录>]\n  weekly [--at <ISO时间>] [--world-state <文件>] [--root <目录>]  整理实验室／Hex 周常\n  invasions [--at <ISO时间>] [--count 2] [--world-state <文件>] [--root <目录>]\n\nP3 全量构建：npm run build:data -- --root <目录> --out <导出位置>。邮件发送仍预留。原始资料快照保持独立。`);
  else {
    const config = await loadConfig(values.config); const store = new Store(storeRoot);
    const options = { config, storeRoot, libraryRoot: root, onProgress: progress };
    if (command === 'scan') print(await scanLibrary(root, config));
    else if (command === 'preview') { const library = await scanLibrary(root, config); const { bytes } = await readLibraryFile(library.root, values.file); const doc = parseDocument(bytes.toString('utf8'), values.file); print({ format: doc.format, warnings: doc.warnings, ...preview(doc.value, { pointer: values.pointer, query: values.query }) }); }
    else if (command === 'import') print(await importLocal(options));
    else if (command === 'update') print(await runUpdate(options));
    else if (command === 'watch') {
      let stop = false; let wake;
      for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { stop = true; wake?.(); });
      while (!stop) {
        try { print(await runUpdate(options)); } catch (e) { console.error(e.message); }
        if (!stop) await new Promise(resolve => { const timer = setTimeout(resolve, config.intervalMinutes * 60000); wake = () => { clearTimeout(timer); resolve(); }; });
      }
    }
    else if (command === 'status') print(await store.status());
    else if (command === 'history') print(await store.history());
    else if (command === 'rollback') print({ releaseId: await rollback({ storeRoot, releaseId: values.release }) });
    else if (command === 'diff') print(changesBetween(await store.release(values.before), await store.release(values.after)));
    else if (command === 'oracle-world-state') print(oracleStateStatus(await refreshOracleState(path.join(storeRoot, 'runtime', 'oracle-world-state.json'), { proxyUrl: config.network?.proxyUrl })));
    else if (['bounty-cycle', 'location-bounties', 'invasions', 'weekly'].includes(command)) {
      const library = await scanLibrary(root, config);
      const readSource = async (id, filename) => {
        const source = config.sources.find(x => x.id === id); if (!source) throw new Error(`缺少来源配置 ${id}`);
        return (await readLibraryFile(library.root, `${source.localPath}/${filename}`)).bytes.toString('utf8');
      };
      const scope = { 'bounty-cycle': 'cycle', 'location-bounties': 'locations', invasions: 'invasions', weekly: 'weekly' }[command], data = await loadOracleData(readSource, scope);
      const at = values.at ? Date.parse(values.at) : Date.now();
      const state = values['world-state'] ? selectOracleState(await readFile(values['world-state'], 'utf8'), { at, source: `本地文件：${path.basename(values['world-state'])}` }) : await cachedOracleState(path.join(storeRoot, 'runtime', 'oracle-world-state.json'));
      const input = { at, seed: values.seed, state, count: Number(values.count ?? 2) };
      const result = scope === 'cycle' ? bountyCycle(data.manifests, input, 'local') : scope === 'locations' ? locationBounties(data.manifests, input, 'local') : scope === 'weekly' ? weeklyConquests(data.missionTypes, input, 'local') : invasionForecast(data.rules, input, 'local');
      print(describeOracle(result, data, scope, input));
    }
    else if (command === 'world-state') print(await refreshAnchor(path.join(storeRoot, 'runtime', 'world-state.json'), { proxyUrl: config.network?.proxyUrl }));
    else if (['cycles', 'teshin', 'circuit', 'incursions'].includes(command)) {
      const library = await scanLibrary(root, config);
      const readSource = async (id, filename) => {
        const source = config.sources.find(x => x.id === id); if (!source) throw new Error(`缺少来源配置 ${id}`);
        return (await readLibraryFile(library.root, `${source.localPath}/${filename}`)).bytes.toString('utf8');
      };
      const data = await loadBrowseData(readSource, { schedule: command === 'incursions' });
      const at = values.at ? Date.parse(values.at) : Date.now(); let result;
      if (command === 'incursions') result = incursions(data.text, { at, count: Number(values.count ?? 7) }, data.regions, data.dictionary, 'local');
      else if (command === 'cycles') {
        const anchor = values['world-state'] ? anchorFromWorldState(await readFile(values['world-state'], 'utf8'), { fetchedAt: at, source: path.resolve(values['world-state']) }) : await cachedAnchor(path.join(storeRoot, 'runtime', 'world-state.json'));
        result = worldCycles(data.rules, { at, anchor }, data.dictionary, 'local');
      } else {
        result = weeklyRotations(data.rules, { at, count: Number(values.count ?? 4) }, data.dictionary, 'local');
        result.entries = result.entries.map(({ startsAt, endsAt, teshin, circuit }) => ({ startsAt, endsAt, [command]: command === 'teshin' ? teshin : circuit }));
      }
      result.warnings.push(...data.warnings); print(result);
    }
    else if (['arbitration', 'invigorations'].includes(command)) {
      const library = await scanLibrary(root, config);
      const read = async name => (await readLibraryFile(library.root, name)).bytes.toString('utf8');
      const plus = config.sources.find(s => s.id === 'plus').localPath;
      const dictionary = JSON.parse(await read(`${plus}/dict.zh.json`));
      const at = values.at ? Date.parse(values.at) : Date.now();
      if (command === 'arbitration') print(arbitrations(await read(`${config.sources.find(s => s.id === 'browse').localPath}/arbys.txt`), { at, count: Number(values.count ?? 24) }, JSON.parse(await read(`${plus}/ExportRegions.json`)), dictionary, 'local'));
      else print(invigorations({ username: values.username, observedSuitTypes: values.observed?.split(',').filter(Boolean), target: values.target, at }, JSON.parse(await read(`${plus}/ExportWarframes.json`)), dictionary, 'local'));
    }
    else throw new Error('未知命令：' + command);
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
