#!/usr/bin/env node
import path from 'node:path';
import { parseArgs } from 'node:util';
import { loadConfig } from './core/config.mjs';
import { Store, changesBetween } from './core/store.mjs';
import { importLocal, rollback, runUpdate } from './core/updater.mjs';
import { parseDocument, preview, readLibraryFile, scanLibrary } from './core/library.mjs';
import { arbitrations, invigorations } from './core/oracle.mjs';

const { positionals, values } = parseArgs({ allowPositionals: true, options: {
  config: { type: 'string' }, store: { type: 'string' }, root: { type: 'string' }, file: { type: 'string' }, query: { type: 'string' }, pointer: { type: 'string' }, release: { type: 'string' }, before: { type: 'string' }, after: { type: 'string' }, username: { type: 'string' }, observed: { type: 'string' }, target: { type: 'string' }, at: { type: 'string' }, count: { type: 'string' }, help: { type: 'boolean' }
} });
const command = positionals[0] ?? 'help';
const storeRoot = path.resolve(values.store ?? '.workbench');
const root = path.resolve(values.root ?? '.');
const print = value => console.log(JSON.stringify(value, null, 2));
const progress = value => console.error(value.message);
try {
  if (command === 'help' || values.help) console.log(`上游资料工作台 0.1.1\n\n命令：\n  scan --root <资料包或上游目录>\n  preview --root <目录> --file <相对路径> [--query <文本>] [--pointer /路径]\n  import --root <目录> [--store <快照目录>]\n  update [--config <JSON>] [--store <目录>]\n  watch  [--config <JSON>] [--store <目录>]  按配置间隔检查；Ctrl+C 退出\n  status | history [--store <目录>]\n  rollback --release <完整版本ID> [--store <目录>]\n  diff --before <ID> --after <ID> [--store <目录>]\n  arbitration [--at <ISO时间>] [--count 24] [--root <目录>]\n  invigorations --username <游戏名> [--observed <路径,路径,路径>] [--target current|next] [--at <ISO时间>] [--root <目录>]\n\n第一版不实现跨来源合并汇总、邮件发送。资料快照只保存各来源原始文本。`);
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
