import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Worker } from 'node:worker_threads';
import { buildMerged } from '../src/core/merge/build.mjs';
import { CONTRACT, digest, stable, storeItemId } from '../src/core/merge/contract.mjs';
import { allItems, compareMerged, exportMerged, MergeRepository } from '../src/core/merge/repository.mjs';
import { mergedList, mergedDetail } from '../src/core/merge/service.mjs';
import { scanLibrary, readLibraryFile, pointerValue } from '../src/core/library.mjs';
import { sha256 } from '../src/core/io.mjs';
import { Store } from '../src/core/store.mjs';
const [W, F] = CONTRACT.scope.seeds, T = CONTRACT.scope.rewardTables[0];
const BP = '/Lotus/Recipes/TestBlueprint', G = '/Lotus/Recipes/RewardBlueprint', M = '/Lotus/Materials/Test', C = '/Lotus/Credit/Test', E = '/Lotus/Endo/Test';
function fixture() {
  const docs = new Map(), put = (source, relative, value) => docs.set(`${source}/${relative}`, { source, value });
  for (const name of ['Weapons', 'Warframes', 'Resources', 'Recipes', 'Upgrades', 'Gear', 'CreditBundles', 'FusionBundles']) put('plus', `Export${name}.json`, {});
  const recipe = (resultType, ingredients) => ({ resultType, ingredients, num: 1, buildPrice: 100, buildTime: 3600 });
  docs.get('plus/ExportWeapons.json').value[W] = { name: '/Lotus/Language/W', description: '/Lotus/Language/Desc', criticalChance: 0.32, criticalMultiplier: 2.8, omegaAttenuation: 0.65, behaviours: [{ impact: { damage: 26 } }] };
  docs.get('plus/ExportWarframes.json').value[F] = { name: '/Lotus/Language/F', power: 175, health: 270 };
  docs.get('plus/ExportResources.json').value[M] = { name: '/Lotus/Language/M' };
  docs.get('plus/ExportRecipes.json').value = { [BP]: recipe(W, [{ ItemType: M, ItemCount: 4 }]), [G]: recipe(M, []) };
  docs.get('plus/ExportCreditBundles.json').value[C] = { name: '/Lotus/Language/C', credits: 15000 };
  docs.get('plus/ExportFusionBundles.json').value[E] = { name: '/Lotus/Language/E', fusionPoints: 50 };
  put('plus', 'dict.zh.json', { '/Lotus/Language/W': '社区武器', '/Lotus/Language/F': '测试战甲', '/Lotus/Language/M': '测试材料', '/Lotus/Language/C': '现金包', '/Lotus/Language/E': '内融核心', '/Lotus/Language/Desc': '社区描述' });
  put('plus', 'ExportRewards.json', { [T]: [[{ type: C.replace('/Lotus/', '/Lotus/StoreItems/'), itemCount: 1, probability: 0.2 }, { type: E, itemCount: 10, probability: 0.3 }, { type: G, itemCount: 1, probability: 0.5 }]] });
  put('oracle', CONTRACT.scope.manifest, { data: { ChallengeMissionDifficultyTiers: [{ rewards: T }] } });
  put('official', 'manifests/zh/ExportWeapons_zh.json', { ExportWeapons: [{ uniqueName: W, name: '官方武器', criticalChance: 0.31999999, omegaAttenuation: 0.64999998 }] });
  put('wfcd', 'data/json/Primary.json', [{ uniqueName: W, name: 'Test Weapon', disposition: 1, attacks: [{ crit_chance: 32, damage: { impact: 35 } }] }]);
  const files = [...docs].map(([id, doc]) => ({ id, source: doc.source }));
  const read = async id => { const bytes = Buffer.from(JSON.stringify(docs.get(id).value)); return { bytes, hash: sha256(bytes) }; };
  return { docs, put, files, read };
}
const temporary = async t => { const root = await fs.mkdtemp(path.join(os.tmpdir(), 'wb-merge-')); t.after(() => fs.rm(root, { recursive: true, force: true })); return root; };

test('小闭环按完整路径合并；中文、比例精度、紫卡档位、配方与奖励保持语义，原对象不变', async () => {
  const f = fixture(), before = stable([...f.docs]);
  const a = await buildMerged(f), b = await buildMerged(f);
  assert.equal(a.manifest.datasetVersion, b.manifest.datasetVersion); assert.equal(stable(a), stable(b));
  assert.equal(stable([...f.docs]), before);
  const weapon = allItems(a).find(i => i.id === W);
  assert.equal(weapon.name['zh-CN'], '官方武器'); assert.equal(weapon.name.en, 'Test Weapon');
  assert.equal(weapon.stats.criticalChance, 0.32); assert.equal(weapon.stats.rivenCoefficient, 0.65); assert.equal(weapon.stats.rivenDisposition, 1);
  assert.equal(a.output['reports/provenance.json'].find(p => p.entityId === W && p.field === 'stats.criticalChance').status, 'resolved');
  assert.ok(a.output['reports/issues.json'].some(i => i.code === 'unmapped-attack-modes'));
  assert.equal(a.output['recipes.json'].find(r => r.id === BP).materials[0].count, 4);
  const rewards = a.output['reward-tables.json'][0].pools[0].items;
  assert.equal(rewards[0].quantity, 15000); assert.equal(rewards[1].quantity, 500); assert.equal(rewards[1].itemCount, 10); assert.equal(rewards[1].probability, 0.3);
  assert.match(allItems(a).find(i => i.id === G).name['zh-CN'], /测试材料 蓝图/);
  assert.equal(storeItemId('/Lotus/Other/StoreItems/X'), '/Lotus/Other/StoreItems/X');
  assert.equal(a.output['reward-tables.json'][0].stageMapping, 'unconfirmed');
  assert.equal(mergedList(a, { query: '官方武器' }).rows[0].id, W);
  assert.equal(mergedList(a, { kind: 'blueprint' }).images[BP].resultId, W);
  assert.equal(mergedDetail(a, BP).image.resultId, W);
  assert.equal(mergedDetail(a, BP).image.blueprint, true);
  assert.equal(mergedDetail(a, W).relations.find(r => r.kind === 'produces').from, BP);
  assert.throws(() => mergedList(a, { kind: '__proto__' }), /参数/);
});

test('字段冲突保留候选；受源哈希保护的补丁可裁决且失效、重复、越界或未匹配时拒绝', async () => {
  const f = fixture(); f.docs.get('plus/ExportWeapons.json').value[W].criticalChance = 0.5;
  const a = await buildMerged(f), field = a.output['reports/provenance.json'].find(p => p.field === 'stats.criticalChance');
  assert.equal(field.status, 'conflict'); assert.equal(field.value, 0.32);
  const patch = { entityId: W, field: 'stats.criticalChance', expectedSourceHash: field.candidates[0].source.hash, value: 0.4, reason: '已核对试验字段' };
  const b = await buildMerged({ ...f, overrides: { version: 1, entries: [patch] } });
  assert.equal(b.output['reports/provenance.json'].find(p => p.field === patch.field).status, 'override');
  assert.equal(allItems(b).find(i => i.id === W).stats.criticalChance, 0.4); assert.notEqual(a.manifest.datasetVersion, b.manifest.datasetVersion);
  for (const entries of [[{ ...patch, expectedSourceHash: '0'.repeat(64) }], [patch, patch], [{ ...patch, value: 2 }], [{ ...patch, field: '__proto__.polluted' }]]) await assert.rejects(buildMerged({ ...f, overrides: { version: 1, entries } }), /补丁/);
});

test('关联缺失、配方循环、奖励概率无效、重复实体与关键关系冲突会阻止构建', async () => {
  let f = fixture(); delete f.docs.get('plus/ExportResources.json').value[M]; await assert.rejects(buildMerged(f), /关联物品不存在/);
  f = fixture(); f.docs.get('plus/ExportRecipes.json').value[G].ingredients = [{ ItemType: M, ItemCount: 1 }]; await assert.rejects(buildMerged(f), /循环/);
  f = fixture(); f.docs.get('plus/ExportRewards.json').value[T][0][0].probability = 2; await assert.rejects(buildMerged(f), /概率/);
  f = fixture(); f.docs.get('wfcd/data/json/Primary.json').value.push({ uniqueName: W, name: '重复' }); await assert.rejects(buildMerged(f), /重复实体/);
  f = fixture(); f.docs.set('official/manifests/zh/ExportRecipes_zh.json', { source: 'official', value: { ExportRecipes: [{ uniqueName: BP, resultType: F, ingredients: [{ ItemType: M, ItemCount: 4 }], num: 1, buildTime: 3600, buildPrice: 100 }] } }); f.files.push({ id: 'official/manifests/zh/ExportRecipes_zh.json', source: 'official' }); await assert.rejects(buildMerged(f), /关键配方关系/);
});

test('构建前后复核输入，源文件中途变化或声明哈希错误时拒绝', async () => {
  const f = fixture(); let count = 0;
  await assert.rejects(buildMerged({ ...f, read: async id => { const r = await f.read(id); if (++count > f.files.length) return { bytes: Buffer.from('{}'), hash: sha256('{}') }; return r; } }), /构建期间输入发生变化/);
  await assert.rejects(buildMerged({ ...f, read: async id => ({ ...await f.read(id), hash: '0'.repeat(64) }) }), /输入哈希/);
});

test('版本原子切换、同输入复用、字段级差异、失败保留旧版，导出文件可独立校验', async t => {
  const repo = new MergeRepository(await temporary(t)), f = fixture();
  const a = await repo.build(f); const first = await repo.changes(a); assert.equal(first.firstBuild, true);
  const missingOptional = { ...a, manifest: { ...a.manifest, inputs: a.manifest.inputs.slice(1) } };
  assert.ok(compareMerged(a, missingOptional).changedInputs.includes(a.manifest.inputs[0].file));
  const repeat = await repo.build(f); assert.equal(repeat.manifest.datasetVersion, a.manifest.datasetVersion); assert.equal(repeat.previousVersion, null);
  f.docs.get('official/manifests/zh/ExportWeapons_zh.json').value.ExportWeapons[0].criticalChance = 0.4;
  const b = await repo.build(f), diff = compareMerged(a, b);
  assert.equal(b.previousVersion, a.manifest.datasetVersion); assert.ok(diff.changes.some(c => c.entityId === W && c.fields.some(f => f.field === 'stats.criticalChance')));
  delete f.docs.get('plus/ExportResources.json').value[M]; await assert.rejects(repo.build(f), /不存在/);
  assert.equal((await repo.current()).manifest.datasetVersion, b.manifest.datasetVersion);
  const out = await temporary(t), exported = await exportMerged(b, out);
  for (const file of b.manifest.files) { const bytes = await fs.readFile(path.join(exported.directory, file.file)); assert.equal(sha256(bytes), file.hash); assert.equal(bytes.length, file.bytes); }
  assert.equal((await exportMerged(b, out)).reused, true);
  await fs.writeFile(path.join(exported.directory, 'items/weapons.json'), '[]'); await assert.rejects(exportMerged(b, out), /不同内容/);
  await fs.writeFile(path.join(repo.directory(b.manifest.datasetVersion), 'items/weapons.json'), '[]'); await assert.rejects(repo.current(), /损坏/);
});

test('真实离线数据：51 实体、14 配方、完整 A 档奖励，全部字段来源与关系可回查', async () => {
  const library = await scanLibrary('.'), result = await buildMerged({ files: library.files, read: id => readLibraryFile(library.root, id) });
  assert.equal(result.manifest.summary.entities, 51); assert.equal(result.manifest.summary.recipes, 14);
  const ids = new Set(allItems(result).map(i => i.id));
  for (const relation of result.output['relations.json']) assert.ok(ids.has(relation.to));
  const cache = new Map();
  const checkSource = async source => {
    if (!cache.has(source.file)) cache.set(source.file, await readLibraryFile(library.root, source.file));
    const data = cache.get(source.file); assert.equal(source.hash, data.hash);
    return pointerValue(JSON.parse(data.bytes), source.pointer);
  };
  for (const record of result.output['reports/source-records.json']) {
    assert.deepEqual(await checkSource(record.source), record.value);
  }
  async function checkCandidate(candidate) {
    assert.deepEqual(await checkSource(candidate.source), candidate.rawValue);
    if (candidate.dictionary) assert.equal(await checkSource(candidate.dictionary), candidate.value);
    if (candidate.resultSource) await checkCandidate(candidate.resultSource);
  }
  for (const field of result.output['reports/provenance.json']) for (const candidate of field.candidates) await checkCandidate(candidate);
  const rewards = result.output['reward-tables.json'][0].pools[0].items;
  assert.equal(rewards.length, 8); assert.ok(rewards.some(r => r.quantity === 750 && r.itemCount === 15));
  assert.equal(result.output['reports/coverage.json'].missingTranslations, 0);
});

test('Worker 的本地／历史快照构建隔离，失败保留旧版，跨版本调用拒绝', async t => {
  const root = await temporary(t), local = path.join(root, 'local'), userData = path.join(root, 'user'), storeRoot = path.join(root, 'store'), f = fixture();
  // Store local fixture under the real configured source paths.
  const paths = { plus: 'git/warframe-public-export-plus', oracle: 'git/wf.browse.oracle', official: 'official-public-export', wfcd: 'wfcd-items' };
  for (const [id, doc] of f.docs) { const [source, ...rest] = id.split('/'); const file = path.join(local, paths[source], ...rest); await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, JSON.stringify(doc.value)); }
  const worker = new Worker(new URL('../src/desktop/worker.mjs', import.meta.url), { workerData: { userData, storeRoot, defaultRoot: local } }); t.after(() => worker.terminate());
  let serial = 0; const pending = new Map();
  worker.on('message', message => { const task = pending.get(message.id); if (!task) return; pending.delete(message.id); message.error ? task.reject(new Error(message.error)) : task.resolve(message.result); });
  worker.on('error', error => { for (const task of pending.values()) task.reject(error); pending.clear(); });
  const call = (method, args = {}) => new Promise((resolve, reject) => { const id = ++serial; pending.set(id, { resolve, reject }); worker.postMessage({ id, method, args }); });
  await call('init'); assert.equal((await call('mergeStatus')).available, false);
  const built = await call('mergeBuild', { profile: 'pilot' }); assert.equal(built.available, true);
  assert.equal((await call('mergeList', { query: '官方武器', kind: 'weapon', datasetVersion: built.manifest.datasetVersion })).rows[0].id, W);
  await assert.rejects(call('mergeDetail', { id: W, datasetVersion: '0'.repeat(64) }), /版本已变化/);
  const store = new Store(storeRoot), sourceGroups = {};
  for (const [id, doc] of f.docs) { const [source, ...rest] = id.split('/'); sourceGroups[source] ??= { label: source, files: {} }; const value = structuredClone(doc.value); if (id === 'official/manifests/zh/ExportWeapons_zh.json') value.ExportWeapons[0].name = '历史武器'; sourceGroups[source].files[rest.join('/')] = await store.put(Buffer.from(JSON.stringify(value))); }
  const release = await store.publish(sourceGroups); await call('snapshot', { id: release.id }); assert.equal((await call('mergeStatus')).available, false);
  const snapshot = await call('mergeBuild', { profile: 'pilot' }); assert.notEqual(snapshot.manifest.datasetVersion, built.manifest.datasetVersion);
  assert.equal((await call('mergeDetail', { id: W })).item.name['zh-CN'], '历史武器');
  await call('chooseRoot', { root: local }); assert.equal((await call('mergeDetail', { id: W })).item.name['zh-CN'], '官方武器');
  await fs.writeFile(path.join(local, paths.plus, 'ExportRewards.json'), '{}'); await assert.rejects(call('mergeBuild', { profile: 'pilot' }), /奖励表/);
  assert.equal((await call('mergeStatus')).manifest.datasetVersion, built.manifest.datasetVersion);
  assert.equal((await call('mergeReport', { type: 'rewards' })).tables.length, 1);
});
