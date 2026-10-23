import { loadPlayerBundle } from '../core/player-bundle.mjs';
import { playerLibraryList, playerLibraryDetail } from '../core/player-library.mjs';
import { rewardContexts } from '../core/merge/reward-context.mjs';
import { LiveStateStore } from '../core/live-state/service.mjs';
import { WmService } from '../core/wm/service.mjs';
import { loadWorldCatalog } from '../core/live-state/catalog.mjs';
import { buildWorldView } from '../core/live-state/view.mjs';
import { LocalImages } from '../core/local-images.mjs';
import { ImageGallery } from '../core/gallery.mjs';
import { DocumentLibrary } from '../core/documents.mjs';
import { parentPort, workerData } from 'node:worker_threads';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { loadConfig } from '../core/config.mjs';
import { atomicJson, exists, readJson, sha256 } from '../core/io.mjs';
import { parseDocument, preview, readLibraryFile, scanLibrary, snapshotEntry, snapshotFiles } from '../core/library.mjs';
import { changesBetween, Store } from '../core/store.mjs';
import { importLocal, rollback, runUpdate } from '../core/updater.mjs';
import { arbitrations, invigorations, warframePool } from '../core/oracle.mjs';
import { loadBrowseData } from '../core/browse-data.mjs';
import { incursions, weeklyRotations, worldCycles } from '../core/browse.mjs';
import { cachedAnchor, refreshAnchor } from '../core/world-state.mjs';
import { bountyCycle, locationBounties } from '../core/oracle-bounties.mjs';
import { invasionForecast } from '../core/oracle-invasions.mjs';
import { weeklyConquests } from '../core/oracle-weekly.mjs';
import { loadOracleData, describeOracle } from '../core/oracle-data.mjs';
import { cachedOracleState, refreshOracleState, importOracleState, oracleStateStatus } from '../core/oracle-state.mjs';
import { PreviewTitles, cardFields } from '../core/preview-titles.mjs';
import { scanStructure, sliceStructure, recordDetail, isRecordMap } from '../core/json-structure.mjs';
import { pointerValue } from '../core/library.mjs';
import { RuleStore, validateRules } from '../core/merge/rules.mjs';
import { exportMerged } from '../core/merge/repository.mjs';
import { mergeContext, mergedStatus, datasetFor, mergedList, mergedDetail, expandEvidence, imageDescriptors } from '../core/merge/service.mjs';

const store = new Store(workerData.storeRoot);
const liveState = new LiveStateStore(path.join(workerData.userData, 'world-state'));
const wm = new WmService(path.join(workerData.userData, 'wm'));
let liveCatalog = null;
async function liveView(server, refresh = false, imported = null) {
  const snapshot = imported ?? (refresh ? await liveState.refresh(server, { proxyUrl: config.network?.proxyUrl }) : await liveState.current(server));
  // Capture the selected dictionary source. Switching directory/snapshot cannot mix a load.
  const selectedLibrary = library, selectedRelease = mode === 'snapshot' ? release : null;
  const contextKey = selectedRelease?.id ?? selectedLibrary?.root ?? 'empty';
  let catalog = liveCatalog?.key === contextKey && !refresh ? liveCatalog.value : null;
  if (!catalog) {
    const files = selectedRelease ? await snapshotFiles(store, selectedRelease) : selectedLibrary?.files ?? [];
    const read = selectedRelease ? async id => {const entry = snapshotEntry(selectedRelease, id);return {bytes:await store.bytes(entry),hash:entry.hash};} : id => readLibraryFile(selectedLibrary.root,id);
    catalog = await loadWorldCatalog(files, read);
    if ((mode === 'snapshot' ? release?.id : library?.root ?? 'empty') === contextKey) liveCatalog = {key:contextKey,value:catalog};
  }
  return buildWorldView(snapshot, catalog);
}
const ruleStore = new RuleStore(path.join(workerData.userData, 'merge-rules'));
let mergeBusy = false;
const preferencesFile = path.join(workerData.userData, 'preferences.json');
const configFile = path.join(workerData.userData, 'sources.json');
const anchorFile = path.join(store.root, 'runtime', 'world-state.json');
const oracleStateFile = path.join(store.root, 'runtime', 'oracle-world-state.json');
let config = await loadConfig(await exists(configFile) ? configFile : undefined);
let preferences = await readJson(preferencesFile).catch(() => ({ root: workerData.defaultRoot, autoUpdate: false }));
let library = null, release = null, mode = 'local', cached = null, busy = false;
const previewTitles = new PreviewTitles();
let structureCache = null;
const localImages = new LocalImages();
const documents = new DocumentLibrary(workerData.documentsRoot ?? workerData.defaultRoot);
let gallery = new ImageGallery(workerData.contentRoot, path.join(workerData.defaultRoot, '世界状态上游'));
async function initializeImages(root) {
  if (localImages.root) { gallery = new ImageGallery(localImages.root, root); return; }
  const candidates = [workerData.imageRoot, preferences.imageRoot, workerData.contentRoot, path.resolve(root, '../assets/content'), path.resolve(root, 'assets/content')].filter(Boolean);
  for (const candidate of candidates) try { await localImages.select(candidate); gallery = new ImageGallery(localImages.root, root); return; } catch { /* Try the next known local location. */ }
}
// Player pages can start without the source directory or an on-device merge build.
async function playerDataset(expectedVersion) {
  const bundled=await loadPlayerBundle();
  if(expectedVersion===bundled.manifest.datasetVersion)return bundled;
  if(library||mode==='snapshot'){
    const ctx=await mergeContext({library,release,mode,store});
    const current=await readJson(path.join(ctx.repository.root,'current.json')).catch(e=>{if(e.code==='ENOENT')return null;throw e;});
    if(current&&current.datasetVersion!==bundled.manifest.datasetVersion)return datasetFor(ctx,expectedVersion);
  }
  if(expectedVersion&&expectedVersion!==bundled.manifest.datasetVersion)throw new Error('资料库版本已变化，请重新进入资料库');
  return bundled;
}
const progress = value => parentPort.postMessage({ event: 'progress', value });
const savePreferences = () => atomicJson(preferencesFile, preferences);
async function selectRoot(root) { library = await scanLibrary(root, config); await initializeImages(library.root); mode = 'local'; release = null; cached = null; liveCatalog = null; preferences.root = library.root; await savePreferences(); return summary(); }
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
async function previewContext(id) {
  const selectedLibrary = library, selectedRelease = mode === 'snapshot' ? release : null;
  const files = selectedRelease ? await snapshotFiles(store, selectedRelease) : selectedLibrary?.files ?? [];
  const read = selectedRelease ? async file => { const entry = snapshotEntry(selectedRelease, file); return { bytes: await store.bytes(entry), hash: entry.hash }; } : file => readLibraryFile(selectedLibrary.root, file);
  const file = files.find(file => file.id === id);
  if (!file) throw new Error('请先选择资料目录中的文件');
  const { bytes, hash } = await read(id);
  const doc = cached?.id === id && cached.hash === hash ? cached : { id, hash, ...parseDocument(bytes.toString('utf8'), id) };
  // Keep raw text in the existing cache: raw/export always return source bytes.
  cached = { ...doc, text: bytes.toString('utf8') };
  return { doc: cached, file, files, read };
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
async function runOracle(scope, args) {
  const data = await loadOracleData(sourceFile, scope), state = await cachedOracleState(oracleStateFile);
  const version = { releaseId: release?.id ?? null };
  const input = { ...args, state };
  const result = scope === 'cycle' ? bountyCycle(data.manifests, input, version) : scope === 'locations' ? locationBounties(data.manifests, input, version) : scope === 'weekly' ? weeklyConquests(data.missionTypes, input, version) : invasionForecast(data.rules, input, version);
  return describeOracle(result, data, scope, input);
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
  async wmSearch(args) { return wm.search(args, { proxyUrl: config.network?.proxyUrl }); },
  async wmOrders(args) { return wm.orders(args, { proxyUrl: config.network?.proxyUrl }); },
  async wmStatistics(args) { return wm.statistics(args, { proxyUrl: config.network?.proxyUrl }); },
  async wmItemSet(args) { return wm.itemSet(args, { proxyUrl: config.network?.proxyUrl }); },
  async wmRivenCatalog(args) { return wm.rivenCatalog(args, { proxyUrl: config.network?.proxyUrl }); },
  async wmAuctions(args) { return wm.auctions(args, { proxyUrl: config.network?.proxyUrl }); },
  async liveState({ server = 'de', refresh = false } = {}) { if (typeof refresh !== 'boolean') throw new Error('刷新参数无效'); return liveView(server, refresh); },
  async importLiveState({ server, file }) { return liveView(server, false, await liveState.import(server, file)); },
  async documentsList(args) { return documents.list(args); },
  async documentsRead({ id }) { return documents.read(id); },
  async images({ requests }) {
    const images = await localImages.batch(requests);
    let remaining = 16 * 1024 * 1024 - images.flatMap(image => image?.layers ?? (image ? [image] : [])).reduce((sum, image) => sum + Math.ceil((image.dataUrl?.length ?? 0) * 3 / 4), 0);
    for (let i = 0; i < requests.length; i++) if (!images[i] && requests[i].id?.startsWith('/Lotus/') && !requests[i].blueprint && !requests[i].resultId) {
      try {
        const asset = await gallery.asset('official:' + requests[i].id);
        if (asset.bytes > 2 * 1024 * 1024 || asset.bytes > remaining) continue;
        const bytes = await fs.readFile(asset.file); if (bytes.length > remaining || bytes.length > 2 * 1024 * 1024) continue;
        remaining -= bytes.length;
        images[i] = { dataUrl: `data:${asset.mime};base64,${bytes.toString('base64')}`, file: path.basename(asset.file), original: asset.item.imageName, provider: 'official', method: 'official-exact-id', abilityIcon: asset.item.category === 'Abilities' };
      } catch { /* No exact local official match: retain a text card. */ }
    }
    return images;
  },
  async galleryList(args) { return gallery.list(args); },
  async galleryDetail({ key }) { return gallery.detail(key); },
  async galleryAsset({ key }) { return gallery.asset(key); },
  async imageStatus() { return localImages.status(); },
  async chooseImages({ root }) { const status = await localImages.select(root); gallery = new ImageGallery(root, library?.root); preferences.imageRoot = root; await savePreferences(); return status; },
  async mergeStatus() { return mergedStatus(await mergeContext({ library, release, mode, store })); },
  async rulesGet() { return ruleStore.get(); },
  async rulesValidate(args) { return validateRules(args); },
  async rulesSave(args) { return ruleStore.save(args); },
  async rulesPrevious() { return ruleStore.previous(); },
  async mergeBuild(args = {}) {
    if (mergeBusy) throw new Error('已有合并构建正在进行'); mergeBusy = true;
    try {
      const ctx = await mergeContext({ library, release, mode, store });
      const rules = args.profile === 'pilot' ? {} : await ruleStore.get();
      await ctx.repository.build({ ...ctx, ...rules, onProgress: progress });
      return mergedStatus(ctx);
    } finally { mergeBusy = false; }
  },
  async playerLibraryStatus() {const data=await playerDataset();return {available:true,manifest:data.manifest};},
  async playerLibraryList(args = {}) { return playerLibraryList(await playerDataset(args.datasetVersion), args); },
  async playerLibraryDetail(args) { return playerLibraryDetail(await playerDataset(args.datasetVersion), args.id, { locale: args.locale }); },
  async mergeList(args) { const ctx = await mergeContext({ library, release, mode, store }); return mergedList(await datasetFor(ctx, args.datasetVersion), args); },
  async mergeDetail(args) { const ctx = await mergeContext({ library, release, mode, store }); return mergedDetail(await datasetFor(ctx, args.datasetVersion), args.id, {locale:args.locale}); },
  async mergeReport({ type, datasetVersion, offset = 0, limit = 40, query = '', tableId=null }) {
    if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1 || limit > 100 || typeof query !== 'string' || query.length > 500) throw new Error('报告分页参数无效');
    const ctx = await mergeContext({ library, release, mode, store }), data = await datasetFor(ctx, datasetVersion);
    const page = rows => ({ total: rows.length, offset, hasMore: offset + limit < rows.length, rows: rows.slice(offset, offset + limit) });
    if (type === 'changes') { const changes = await ctx.repository.changes(data), paged = page(changes.changes); return { ...changes, ...paged, changes: paged.rows }; }
    if (type === 'issues') { const paged = page(data.output['reports/issues.json'].filter(row => !query || JSON.stringify(row).toLowerCase().includes(query.toLowerCase()))); return { ...paged, issues: expandEvidence(data, paged.rows), coverage: data.output['reports/coverage.json'], localization:data.output['reports/localization.json'] }; }
    if (type === 'rewards') {
      if(tableId!==null&&(typeof tableId!=='string'||tableId.length>2000))throw new Error('奖励表标识无效');
      if(tableId!==null&&!data.output['reward-tables.json'].some(t=>t.id===tableId))throw new Error('奖励表不存在');
      const names = data.output['search.zh-CN.json'], nameMap = new Map(names.map(n => [n.id, n.title])), contexts = rewardContexts(data), search = query.toLowerCase();
      const paged = page(data.output['reward-tables.json'].filter(t => tableId!==null?t.id===tableId:!search || `${t.id} ${JSON.stringify(contexts.get(t.id))}`.toLowerCase().includes(search) || t.pools.some(p => p.items.some(i => (nameMap.get(i.itemId) ?? '').toLowerCase().includes(search)))));
      const ids = new Set(paged.rows.flatMap(t => t.pools.flatMap(p => p.items.map(i => i.itemId))));
      return { ...paged, tables: expandEvidence(data, paged.rows).map(t => ({ ...t, context: contexts.get(t.id) })), names: names.filter(n => ids.has(n.id)), images: imageDescriptors(data, names.filter(n => ids.has(n.id))) };
    }
    throw new Error('合并报告类型无效');
  },
  async mergeExport(args) { const ctx = await mergeContext({ library, release, mode, store }); return exportMerged(await datasetFor(ctx, args.datasetVersion), args.directory); },
  async init() { try { await selectRoot(preferences.root ?? workerData.defaultRoot); } catch (error) { progress({ message: '请选择资料包目录：' + error.message }); } schedule(); return summary(); },
  async chooseRoot(args) { return selectRoot(args.root); },
  async refresh() { if (mode === 'snapshot') return handlers.snapshot({ id: release.id }); if (!library) return summary(); return selectRoot(library.root); },
  async page({ id, pointer = '', query = '', offset = 0, limit = 80 }) {
    // Pin both document and dictionaries to the same selected library/version.
    const selectedLibrary = library, selectedRelease = mode === 'snapshot' ? release : null;
    const files = selectedRelease ? await snapshotFiles(store, selectedRelease) : selectedLibrary?.files ?? [];
    const read = selectedRelease ? async file => { const entry = snapshotEntry(selectedRelease, file); return { bytes: await store.bytes(entry), hash: entry.hash }; } : file => readLibraryFile(selectedLibrary.root, file);
    if (!files.some(file => file.id === id)) throw new Error('请先选择资料目录中的文件');
    const { bytes, hash } = await read(id);
    let parsed;
    try { parsed = cached?.id === id && cached.hash === hash ? cached : { id, hash, text: bytes.toString('utf8'), ...parseDocument(bytes.toString('utf8'), id) }; }
    catch (error) { return { id, hash, format: 'invalid-json', warnings: [error.message], type: 'error', rows: [], total: 0, hasMore: false, scalar: bytes.toString('utf8').slice(0, 200000) }; }
    cached = parsed;
    const titles = await previewTitles.load(files, read, files.find(file => file.id === id).source);
    return { id, hash, format: parsed.format, warnings: [...parsed.warnings, ...titles.warnings], ...preview(parsed.value, { pointer, query, offset, limit, titleFor: (item, key, at) => titles.resolve(item, key, at, id), fieldsFor: (item, key, at) => ({ ...cardFields(item), image: item && typeof item === 'object' ? { id: item.uniqueName ?? item.abilityUniqueName ?? item.type ?? key, imageName: item.imageName, icon: item.icon, ...(typeof item.resultType === 'string' ? { resultId: item.resultType, blueprint: true } : {}) } : null, collection: Array.isArray(item) || isRecordMap(item, key, id, at.split('/').length - 1) }) }) };
  },
  async detail({ id, pointer = '', query = '', offset = 0, limit = 80 }) {
    const { doc, file, files, read } = await previewContext(id);
    if (doc.format === 'text' || doc.parseError) throw new Error('此文件无法解析为 JSON，请使用原文视图');
    const titles = await previewTitles.load(files, read, file.source);
    const result = recordDetail(doc.value, { pointer, query, offset, limit, file: id });
    for (const row of result.rows) if ('value' in row && typeof row.value === 'string') row.title = titles.resolve(row.value, row.key, row.pointer, id);
    return { ...result, id, hash: doc.hash, format: doc.format, image: (() => { const item = pointerValue(doc.value, pointer); return item && typeof item === 'object' ? { id: item.uniqueName ?? item.abilityUniqueName ?? item.type ?? pointer.split('/').at(-1)?.replaceAll('~1', '/').replaceAll('~0', '~'), imageName: item.imageName, icon: item.icon, ...(typeof item.resultType === 'string' ? { resultId: item.resultType, blueprint: true } : {}) } : null; })(), title: titles.resolve(pointerValue(doc.value, pointer), pointer.split('/').at(-1), pointer, id), warnings: [...doc.warnings, ...titles.warnings] };
  },
  async schema({ id, query = '', offset = 0, limit = 80 }) {
    const { doc } = await previewContext(id);
    if (doc.format === 'text' || doc.parseError) throw new Error('此文件无法解析为 JSON，请使用原文视图');
    if (structureCache?.id !== id || structureCache.hash !== doc.hash) structureCache = { id, hash: doc.hash, structure: scanStructure(doc.value, id) };
    return { id, hash: doc.hash, format: doc.format, warnings: doc.warnings, ...sliceStructure(structureCache.structure, { query, offset, limit }) };
  },
  async raw({ id, pointer = '', line = null }) {
    const doc = await document(id); let text = pointer ? JSON.stringify((await import('../core/library.mjs')).pointerValue(doc.value, pointer), null, 2) : doc.text;
    if (line !== null) {
      if (!Number.isInteger(line) || line < 1 || doc.format !== 'text' || pointer) throw new Error('原文行号定位参数无效');
      const lines = text.split('\n'); if (line > lines.length) throw new Error('原文行号超出范围');
      const start = Math.max(0, line - 12), end = Math.min(lines.length, line + 18);
      text = lines.slice(start, end).map((value, i) => `${i + start + 1 === line ? '▶' : ' '} ${i + start + 1}  ${value}`).join('\n');
      return { text: text.slice(0, 200000), truncated: text.length > 200000, totalCharacters: doc.text.length, hash: doc.hash, startLine: start + 1, endLine: end, targetLine: line };
    }
    return { text: text.slice(0, 200000), truncated: text.length > 200000, totalCharacters: text.length, hash: doc.hash };
  },
  async export({ id, pointer = '' }) { const doc = await document(id); const text = pointer ? JSON.stringify((await import('../core/library.mjs')).pointerValue(doc.value, pointer), null, 2) : doc.text; return { text, name: path.basename(id) }; },
  async update() { return update(); },
  async import() { if (!library || mode !== 'local') throw new Error('请先打开本地资料目录'); if (busy) throw new Error('更新或导入正在进行'); busy = true; try { return await importLocal({ libraryRoot: library.root, config, storeRoot: store.root, onProgress: progress }); } finally { busy = false; } },
  async history() { return { releases: await store.history(), current: (await store.current())?.id ?? null, status: await store.status() }; },
  async snapshot({ id }) { release = id ? await store.release(id) : await store.current(); if (!release) throw new Error('尚无快照，请先导入本地资料或检查更新'); mode = 'snapshot'; cached = null; liveCatalog = null; return summary(); },
  async rollback({ id }) { if (busy) throw new Error('更新或导入正在进行'); const result = await rollback({ storeRoot: store.root, releaseId: id }); return { releaseId: result }; },
  async diff({ before, after }) { return changesBetween(await store.release(before), await store.release(after)); },
  async oracleOptions() { const data = await oracleData(true); return warframePool(data.warframes, data.dictionary); },
  async invigorations(args) { const data = await oracleData(true); return invigorations(args, data.warframes, data.dictionary, data.dataVersion); },
  async arbitration(args) { const data = await oracleData(); return arbitrations(data.text, args, data.regions, data.dictionary, data.dataVersion); },
  async browseCycles(args) { const data = await loadBrowseData(sourceFile); const result = worldCycles(data.rules, { at: args.at, anchor: await cachedAnchor(anchorFile) }, data.dictionary, { releaseId: release?.id ?? null }); result.warnings.push(...data.warnings); return result; },
  async browseWeekly(args) { const data = await loadBrowseData(sourceFile); const result = weeklyRotations(data.rules, args, data.dictionary, { releaseId: release?.id ?? null }); result.warnings.push(...data.warnings); return result; },
  async browseIncursions(args) { const data = await loadBrowseData(sourceFile, { schedule: true }); const result = incursions(data.text, args, data.regions, data.dictionary, { releaseId: release?.id ?? null }); result.warnings.push(...data.warnings); return result; },
  async refreshWorldState() { return refreshAnchor(anchorFile, { proxyUrl: config.network?.proxyUrl }); },
  async oracleCycle(args) { return runOracle('cycle', args); },
  async oracleLocations(args) { return runOracle('locations', args); },
  async oracleInvasions(args) { return runOracle('invasions', args); },
  async oracleWeekly(args) { return runOracle('weekly', args); },
  async oracleStateStatus() { return oracleStateStatus(await cachedOracleState(oracleStateFile)); },
  async refreshOracleState() { return oracleStateStatus(await refreshOracleState(oracleStateFile, { proxyUrl: config.network?.proxyUrl })); },
  async importOracleState({ file, at }) { return oracleStateStatus(await importOracleState(oracleStateFile, file, { at })); },
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
