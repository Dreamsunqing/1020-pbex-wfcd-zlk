import { parentPort, workerData } from 'node:worker_threads';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { loadConfig } from '../core/config.mjs';
import { atomicJson, exists, readJson, sha256 } from '../core/io.mjs';
import { parseDocument, preview, readLibraryFile, scanLibrary, snapshotEntry, snapshotFiles } from '../core/library.mjs';
import { changesBetween, Store } from '../core/store.mjs';
import { importLocal, rollback, runUpdate } from '../core/updater.mjs';
import { arbitrations, invigorations, warframePool } from '../core/oracle.mjs';

const store = new Store(workerData.storeRoot);
const preferencesFile = path.join(workerData.userData, 'preferences.json');
const configFile = path.join(workerData.userData, 'sources.json');
let config = await loadConfig(await exists(configFile) ? configFile : undefined);
let preferences = await readJson(preferencesFile).catch(() => ({ root: workerData.defaultRoot, autoUpdate: false }));
let library = null, release = null, mode = 'local', cached = null, busy = false;
const progress = value => parentPort.postMessage({ event: 'progress', value });
const savePreferences = () => atomicJson(preferencesFile, preferences);
async function selectRoot(root) { library = await scanLibrary(root, config); mode = 'local'; release = null; cached = null; preferences.root = library.root; await savePreferences(); return summary(); }
async function summary() {
  return { mode, root: mode === 'snapshot' ? `快照 ${release.id.slice(0, 12)}` : library?.root ?? '', files: mode === 'snapshot' ? await snapshotFiles(store, release) : library?.files ?? [], releaseId: release?.id ?? null, storeRoot: store.root, autoUpdate: preferences.autoUpdate, intervalMinutes: config.intervalMinutes, status: await store.status(), sources: config.sources.map(({ id, label }) => ({ id, label })) };
}
async function readFile(id) {
  if (typeof id !== 'string') throw new Error('文件路径无效');
  if (mode === 'snapshot') { const entry = snapshotEntry(release, id); return { bytes: await store.bytes(entry), hash: entry.hash }; }
  if (!library?.files.some(f => f.id === id)) throw new Error('请先选择资料目录中的文件');
  return readLibraryFile(library.root, id);
}
async function document(id) {
  // Recheck the bytes on every page: a changed file invalidates the parsed cache.
  const { bytes, hash } = await readFile(id);
  if (cached?.id === id && cached.hash === hash) return cached;
  const text = bytes.toString('utf8'); let parsed;
  try { parsed = parseDocument(text, id); } catch (error) { parsed = { value: null, format: 'invalid-json', warnings: [error.message], parseError: error.message }; }
  cached = { id, hash, text, ...parsed }; return cached;
}
async function sourceFile(sourceId, filename) {
  const source = config.sources.find(s => s.id === sourceId); if (!source) throw new Error('缺少推算输入来源配置');
  const id = mode === 'snapshot' ? `${sourceId}/${filename}` : `${source.localPath}/${filename}`;
  return (await readFile(id)).bytes.toString('utf8');
}
async function oracleData(includeWarframes = false) {
  const dictionary = JSON.parse(await sourceFile('plus', 'dict.zh.json'));
  if (includeWarframes) {
    const text = await sourceFile('plus', 'ExportWarframes.json');
    return { dictionary, warframes: JSON.parse(text), dataVersion: { releaseId: release?.id ?? null, warframesHash: sha256(text) } };
  }
  return { dictionary, regions: JSON.parse(await sourceFile('plus', 'ExportRegions.json')), text: await sourceFile('browse', 'arbys.txt'), dataVersion: { releaseId: release?.id ?? null } };
}
async function update() {
  if (busy) throw new Error('更新或导入正在进行'); busy = true;
  try { const result = await runUpdate({ config, storeRoot: store.root, onProgress: progress }); parentPort.postMessage({ event: 'updated', value: result }); return result; }
  finally { busy = false; }
}
let timer;
function schedule() {
  clearTimeout(timer); timer = null;
  if (preferences.autoUpdate) timer = setTimeout(async () => { try { await update(); } catch (error) { progress({ message: error.message, error: true }); } finally { schedule(); } }, config.intervalMinutes * 60000);
}
const handlers = {
  async init() { try { await selectRoot(preferences.root ?? workerData.defaultRoot); } catch (error) { progress({ message: '请选择资料包目录：' + error.message }); } schedule(); return summary(); },
  async chooseRoot(args) { return selectRoot(args.root); },
  async refresh() { if (mode === 'snapshot') return handlers.snapshot({ id: release.id }); if (!library) return summary(); return selectRoot(library.root); },
  async page({ id, pointer = '', query = '', offset = 0, limit = 80 }) { const doc = await document(id); if (doc.parseError) return { id, hash: doc.hash, format: doc.format, warnings: doc.warnings, type: 'error', rows: [], total: 0, hasMore: false, scalar: doc.text.slice(0, 200000) }; return { id, hash: doc.hash, format: doc.format, warnings: doc.warnings, ...preview(doc.value, { pointer, query, offset, limit }) }; },
  async raw({ id, pointer = '' }) { const doc = await document(id); const text = pointer ? JSON.stringify((await import('../core/library.mjs')).pointerValue(doc.value, pointer), null, 2) : doc.text; return { text: text.slice(0, 200000), truncated: text.length > 200000, totalCharacters: text.length, hash: doc.hash }; },
  async export({ id, pointer = '' }) { const doc = await document(id); const text = pointer ? JSON.stringify((await import('../core/library.mjs')).pointerValue(doc.value, pointer), null, 2) : doc.text; return { text, name: path.basename(id) }; },
  async update() { return update(); },
  async import() { if (!library || mode !== 'local') throw new Error('请先打开本地资料目录'); if (busy) throw new Error('更新或导入正在进行'); busy = true; try { return await importLocal({ libraryRoot: library.root, config, storeRoot: store.root, onProgress: progress }); } finally { busy = false; } },
  async history() { return { releases: await store.history(), current: (await store.current())?.id ?? null, status: await store.status() }; },
  async snapshot({ id }) { release = id ? await store.release(id) : await store.current(); if (!release) throw new Error('尚无快照，请先导入本地资料或检查更新'); mode = 'snapshot'; cached = null; return summary(); },
  async rollback({ id }) { if (busy) throw new Error('更新或导入正在进行'); const result = await rollback({ storeRoot: store.root, releaseId: id }); return { releaseId: result }; },
  async diff({ before, after }) { return changesBetween(await store.release(before), await store.release(after)); },
  async oracleOptions() { const data = await oracleData(true); return warframePool(data.warframes, data.dictionary); },
  async invigorations(args) { const data = await oracleData(true); return invigorations(args, data.warframes, data.dictionary, data.dataVersion); },
  async arbitration(args) { const data = await oracleData(); return arbitrations(data.text, args, data.regions, data.dictionary, data.dataVersion); },
  async autoUpdate({ enabled }) { if (typeof enabled !== 'boolean') throw new Error('开关无效'); preferences.autoUpdate = enabled; await savePreferences(); schedule(); return summary(); },
  async config() { return config; },
  async saveConfig({ text }) {
    if (busy) throw new Error('请等待更新或导入完成后修改配置');
    if (typeof text !== 'string' || text.length > 100000) throw new Error('配置正文无效');
    const temp = path.join(workerData.userData, 'sources.validate.json'); await atomicJson(temp, JSON.parse(text));
    try { const next = await loadConfig(temp); await atomicJson(configFile, next); config = next; schedule(); }
    finally { await fs.rm(temp, { force: true }); }
    return { saved: true };
  }
};
parentPort.on('message', async ({ id, method, args = {} }) => {
  try { if (!Object.hasOwn(handlers, method)) throw new Error('未知操作'); parentPort.postMessage({ id, result: await handlers[method](args) }); }
  catch (error) { parentPort.postMessage({ id, error: error.message }); }
});
