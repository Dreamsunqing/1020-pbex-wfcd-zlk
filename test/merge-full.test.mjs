import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { FULL_CONTRACT, RuleStore, validateRules } from '../src/core/merge/rules.mjs';
import { buildMerged } from '../src/core/merge/build.mjs';
import { allItems, MergeRepository } from '../src/core/merge/repository.mjs';
import { mergedDetail, mergedList, expandEvidence } from '../src/core/merge/service.mjs';
import { scanLibrary, readLibraryFile, pointerValue } from '../src/core/library.mjs';
import { sha256 } from '../src/core/io.mjs';
import { Store } from '../src/core/store.mjs';
import { retainPackages } from '../scripts/retain-packages.mjs';
const temp = async t => { const root = await fs.mkdtemp(path.join(os.tmpdir(), 'wb-full-')); t.after(() => fs.rm(root, { recursive: true, force: true })); return root; };
function fixture() {
  const id = '/Lotus/Test/Weapon', material = '/Lotus/Test/Material', blueprint = '/Lotus/Test/BP';
  const docs = new Map([
    ['plus/ExportWeapons.json', { [id]: { name: '/Language/W', criticalChance: .32, nested: { unknown: [1, 2] } } }],
    ['official/manifests/zh/ExportWeapons_zh.json', { ExportWeapons: [{ uniqueName: id, name: '官方标题', criticalChance: .31999999 }] }],
    ['plus/dict.zh.json', { '/Language/W': '社区标题', '/Language/M': '材料' }],
    ['plus/ExportResources.json', { [material]: { name: '/Language/M' } }],
    ['plus/ExportRecipes.json', { [blueprint]: { resultType: id, ingredients: [{ ItemType: material, ItemCount: 2 }], num: 1, buildPrice: 100, buildTime: 60 } }],
    ['plus/ExportRewards.json', { '/Lotus/Rewards/Test': [[{ type: '/Lotus/StoreItems/Test/Weapon', itemCount: 1, rarity: 'COMMON' }, { type: '/Lotus/Missing', itemCount: 2, probability: .5 }]] }],
    ['wfcd/data/json/Node.json', [{ uniqueName: 'SolNode1', name: 'Node' }]],
    ['official/manifests/en/ExportWarframes_en.json', { ExportAbilities: [{ abilityUniqueName: '/Lotus/Test/Ability', abilityName: 'Ability', description: 'Effect' }] }]
  ]);
  const files = [...docs].map(([id]) => ({ id, source: id.split('/')[0] }));
  const read = async file => { const bytes = Buffer.from(JSON.stringify(docs.get(file))); return { bytes, hash: sha256(bytes) }; };
  return { docs, files, read, id, blueprint, contract: structuredClone(FULL_CONTRACT) };
}
test('共享 Blueprint 标签通过精确配方成品生成完整名称，独立蓝图标题保持优先', async () => {
  const f=fixture(),file='wfcd/data/json/Components.json',english='official/manifests/en/ExportWeapons_en.json';
  f.docs.set(file,[{uniqueName:f.blueprint,name:'Blueprint'}]);f.files.push({id:file,source:'wfcd'});
  f.docs.set(english,{ExportWeapons:[{uniqueName:f.id,name:'Test Weapon'}]});f.files.push({id:english,source:'official'});
  let data=await buildMerged(f);assert.equal(mergedDetail(data,f.blueprint).item.name.en,'Test Weapon Blueprint');assert.equal(mergedDetail(data,f.blueprint).item.name['zh-CN'],'官方标题 蓝图');
  f.docs.get(file)[0].name='Distinct Recipe';data=await buildMerged(f);assert.equal(mergedDetail(data,f.blueprint).item.name.en,'Distinct Recipe');
});
test('全量模式涵盖非样本、节点标识、技能、未知字段、稀有度奖励和缺失引用；压缩溯源可还原', async () => {
  const f = fixture(), a = await buildMerged(f), b = await buildMerged(f);
  assert.equal(a.manifest.datasetVersion, b.manifest.datasetVersion);
  assert.equal(a.manifest.summary.rewardItems, 2); assert.equal(a.manifest.summary.unresolved, 1);
  assert.equal(allItems(a).find(i => i.kind === 'ability').name.en, 'Ability');
  assert.ok(allItems(a).some(i => i.id === 'wf:region/SolNode1'));
  const detail = mergedDetail(a, f.id); assert.equal(detail.item.name['zh-CN'], '官方标题');
  assert.equal(detail.item.stats.criticalChance, .32); assert.deepEqual(detail.item.attributes.nested, { unknown: [1, 2] });
  assert.deepEqual(detail.fields.find(p => p.field === 'attributes.nested.unknown').value, [1, 2]);
  assert.ok(detail.sources.every(s => s.value && s.source.hash.length === 64));
  const rewards = expandEvidence(a, a.output['reward-tables.json'])[0].pools[0].items;
  assert.equal(rewards[0].itemId, f.id); assert.equal(rewards[0].probability, null); assert.equal(rewards[0].rarity, 'COMMON');
  assert.equal(mergedList(a, { kind: 'ability' }).total, 1);
  const ids = new Set(allItems(a).map(i => i.id)); assert.ok(a.output['relations.json'].every(r => ids.has(r.to)));
  const definition = f.contract.fields.find(r => r.path === 'stats.criticalChance'); definition.priority = ['plus', 'official', 'wfcd', 'oracle'];
  f.docs.get('plus/ExportWeapons.json')[f.id].criticalChance = .5;
  assert.equal(mergedDetail(await buildMerged(f), f.id).item.stats.criticalChance, .5);
});
test('规则校验、并发修订保护、只保留一个历史规则；过期源哈希不能覆盖已构建资料', async t => {
  const root = await temp(t), rules = new RuleStore(path.join(root, 'rules')), a = await rules.get();
  const saved = await rules.save({ ...a, expectedRevision: a.revision, note: '首次配置' });
  const c = structuredClone(saved.contract); c.mappingVersion = 'test-2';
  const b = await rules.save({ contract: c, overrides: saved.overrides, expectedRevision: saved.revision, note: '改版' });
  assert.equal((await rules.previous()).contract.mappingVersion, saved.contract.mappingVersion);
  await assert.rejects(rules.save({ ...saved, expectedRevision: '0'.repeat(64), note: '过期窗口' }), /其他窗口/);
  assert.equal((await fs.readdir(rules.root)).filter(n => n.endsWith('.json')).length, 2);
  const invalid = structuredClone(b); invalid.contract.fields.push({ path: '__proto__.polluted' }); assert.throws(() => validateRules(invalid), /字段/);
  invalid.contract = structuredClone(b.contract); invalid.contract.catalogs[0].file = '../bad.json'; assert.throws(() => validateRules(invalid), /相对路径/);
  const f = fixture(), repo = new MergeRepository(path.join(root, 'merged')), first = await repo.build(f);
  const hash = (await f.read('plus/ExportWeapons.json')).hash;
  const patch = { entityId: f.id, field: 'stats.criticalChance', expectedSourceHash: hash, value: .7, reason: '核对' };
  const second = await repo.build({ ...f, overrides: { version: 1, entries: [patch] } }); assert.equal(mergedDetail(second, f.id).item.stats.criticalChance, .7);
  f.docs.get('plus/ExportWeapons.json')[f.id].criticalChance = .9;
  await assert.rejects(repo.build({ ...f, overrides: { version: 1, entries: [patch] } }), /哈希已过期/);
  assert.equal((await repo.current()).manifest.datasetVersion, second.manifest.datasetVersion);
  const third = await repo.build(f); assert.equal(third.previousVersion, second.manifest.datasetVersion);
  await assert.rejects(repo.version(first.manifest.datasetVersion), /ENOENT/);
});
test('快照及对象只保留当前和上一版，包轮换只保留当前和上一版 x64 ZIP', async t => {
  const root = await temp(t), store = new Store(path.join(root, 'store'));
  const publish = async n => store.publish({ plus: { files: { 'a.json': await store.put(Buffer.from(JSON.stringify({ n }))) } } });
  const a = await publish(1), b = await publish(2), c = await publish(3);
  assert.equal((await store.history()).length, 2); await assert.rejects(store.release(a.id), /ENOENT/);
  await store.collectObjects(); await assert.rejects(store.bytes(a.sources.plus.files['a.json']), /ENOENT/);
  assert.equal((await store.bytes(b.sources.plus.files['a.json'])).toString(), '{"n":2}');
  await store.publish(c.sources); assert.equal((await store.history()).length, 2);
  const dist = path.join(root, 'dist'); await fs.mkdir(dist);
  for (const version of ['0.7.2', '0.8.0', '0.9.0']) for (const target of ['mac-x64', 'win-x64', 'mac-arm64']) await fs.writeFile(path.join(dist, `SourceWorkbench-${version}-${target}.zip`), 'fixture');
  const result = await retainPackages(dist, '0.9.0'); assert.equal(result.previous, '0.8.0'); assert.equal(result.kept.length, 4); assert.ok(result.kept.every(f => f.includes('x64')));
});
test('真实全量静态资料覆盖全部规则、全部奖励及可回查源字段', { timeout: 180000 }, async () => {
  const library = await scanLibrary('.'); const data = await buildMerged({ files: library.files, read: id => readLibraryFile(library.root, id), contract: FULL_CONTRACT });
  assert.equal(data.manifest.summary.entities, 32941); assert.equal(data.manifest.summary.recipes, 2024); assert.equal(data.manifest.summary.rewardTables, 1102); assert.equal(data.manifest.summary.rewardItems, 11509);
  const coverage = data.output['reports/coverage.json']; assert.equal(coverage.kinds.arcane, 177); assert.equal(coverage.modSetLinks.sets,19); assert.equal(coverage.modSetLinks.members,72); assert.equal(coverage.modSetLinks.unmatched.length,0); assert.equal(coverage.incarnonLinks.adapters,45); assert.equal(coverage.incarnonLinks.weapons,89); assert.equal(coverage.incarnonLinks.unmatched.length,0); assert.equal(coverage.files.length, library.files.length);
  assert.ok(!data.output['reports/issues.json'].some(i => i.code === 'optional-input-missing'));
  const names = mergedList(data, { query: '迅发电浆炮' }); assert.ok(names.rows.length > 0);
  const detail = mergedDetail(data, '/Lotus/Weapons/Tenno/LongGuns/SapientPrimary/SapientPrimaryWeapon');
  assert.ok(detail.fields.some(f => f.field === 'stats.rivenCoefficient'));
  const cache = new Map();
  for (const field of detail.fields) for (const candidate of field.candidates) {
    const source = candidate.source;
    if (!cache.has(source.file)) cache.set(source.file, await readLibraryFile(library.root, source.file));
    const input = cache.get(source.file); assert.equal(input.hash, source.hash); assert.deepEqual(pointerValue(JSON.parse(input.bytes), source.pointer), candidate.rawValue);
  }
  assert.equal(detail.item.stats.criticalChance, .32);
  const ids = new Set(allItems(data).map(i => i.id)); assert.ok(data.output['relations.json'].every(r => ids.has(r.to)));
  const skill = mergedDetail(data, '/Lotus/Powersuits/Runner/Abilities/RunnerTransferAbility');
  assert.equal(skill.item.helminth.transferable, true); assert.equal(skill.badges[skill.item.id].augments[0].title, '热能传递');
  assert.ok(data.output['ExportAbilities.json'][skill.item.id]);
  const helminthSource = skill.fields.find(f => f.field.startsWith('helminth.')).candidates[0].source;
  assert.ok(helminthSource.line > 1); assert.ok((await readLibraryFile(library.root, helminthSource.file)).bytes.toString().split('\n')[helminthSource.line - 1].includes('Subsumed = "Thermal Sunder"'));
});

test('嵌套对象逐叶合并、ID 数组按身份对齐，匿名数组不按下标拼接；深层候选可回查', async () => {
  const f = fixture(), plus = f.docs.get('plus/ExportWeapons.json')[f.id], official = f.docs.get('official/manifests/zh/ExportWeapons_zh.json').ExportWeapons[0];
  plus.nested = { inner: { a: 1, b: 2 }, keyed: [{ uniqueName: '/Lotus/B', amount: 2 }, { uniqueName: '/Lotus/A', amount: 1, extra: 'kept' }], list: [{ name: 'mode', damage: 1 }] };
  official.nested = { inner: { a: 3, c: 4 }, keyed: [{ uniqueName: '/Lotus/A', amount: 5 }, { uniqueName: '/Lotus/B', amount: 6 }], list: [{ name: 'other-mode', speed: 2 }] };
  const before = JSON.stringify([...f.docs]), data = await buildMerged(f), detail = mergedDetail(data, f.id), nested = detail.item.attributes.nested;
  assert.deepEqual(nested.inner, { a: 3, b: 2, c: 4 });
  assert.deepEqual(nested.keyed.map(r => [r.uniqueName, r.amount]), [['/Lotus/A', 5], ['/Lotus/B', 6]]); assert.equal(nested.keyed[0].extra, 'kept');
  assert.deepEqual(nested.list, official.nested.list);
  assert.equal(detail.fields.find(row => row.field === 'attributes.nested.inner.a').status, 'conflict');
  for (const field of detail.fields.filter(row => row.field.startsWith('attributes.nested'))) for (const candidate of field.candidates) assert.deepEqual(pointerValue(f.docs.get(candidate.source.file), candidate.source.pointer), candidate.rawValue);
  assert.equal(JSON.stringify([...f.docs]), before);
  const again = await buildMerged(f); assert.equal(again.manifest.datasetVersion, data.manifest.datasetVersion);
});

test('内嵌技能与独立技能同 ID 合并；组件双向归属去重且保留数量、缺失目标与精确来源', async () => {
  const f = fixture(), frame = '/Lotus/Test/Frame', ability = '/Lotus/Test/Skill', ability2 = '/Lotus/Test/Skill2', component = '/Lotus/Test/Material';
  f.docs.set('plus/ExportWarframes.json', { [frame]: { name: '/Language/F', passiveDescription: '/Language/Passive', abilities: { [ability]: { name: '/Language/S', description: '/Language/D', energyRequiredToActivate: 15 }, [ability2]: { uniqueName: ability2, name: '/Language/S' } }, components: [{ uniqueName: component, itemCount: 3 }] } });
  f.docs.set('official/manifests/en/ExportWarframes_en.json', { ExportWarframes: [{ uniqueName: frame, name: 'Frame', components: [{ uniqueName: component }], abilities: [{ abilityUniqueName: ability, abilityName: 'Official Skill', description: 'English' }] }] });
  f.docs.set('wfcd/data/json/Components.json', [{ uniqueName: component, parentUniqueNames: [frame] }]);
  Object.assign(f.docs.get('plus/dict.zh.json'), { '/Language/F': '测试战甲', '/Language/S': '冲刺', '/Language/D': '中文效果', '/Language/Passive': '中文被动效果' });
  f.files = [...f.docs].map(([id]) => ({ id, source: id.split('/')[0] }));
  const data = await buildMerged(f), detail = mergedDetail(data, frame), skill = mergedDetail(data, ability), material = mergedDetail(data, component);
  assert.equal(skill.item.kind, 'ability'); assert.equal(skill.item.name['zh-CN'], '冲刺'); assert.equal(skill.item.name.en, 'Official Skill'); assert.equal(skill.item.description['zh-CN'], '中文效果'); assert.equal(skill.item.stats.activationEnergy, 15);
  assert.equal(detail.item.passiveDescription['zh-CN'], '中文被动效果');
  assert.equal(allItems(data).filter(row => row.id === ability).length, 1);
  assert.equal(detail.item.abilities.length, 2); assert.equal(detail.relations.filter(r => r.kind === 'has-ability' && r.from === frame).length, 2);
  const link = detail.relations.find(r => r.kind === 'has-component' && r.to === component);
  assert.equal(link.quantity, 3); assert.equal(link.sources.length, 3); assert.equal(link.navigable, true);
  assert.equal(detail.relations.filter(r => r.kind === 'has-component').length, 1);
  const countField = detail.fields.find(row => row.field.startsWith('components[')); assert.equal(countField.candidates[countField.selected].value.count, 3);
  assert.ok(material.relations.some(r => r.kind === 'has-component' && r.from === frame));
  assert.ok(skill.relations.some(r => r.kind === 'has-ability' && r.from === frame));
  assert.ok(skill.sources.some(row => row.source.pointer.includes('/abilities/')));
  for (const field of detail.fields) for (const candidate of field.candidates) assert.deepEqual(pointerValue(f.docs.get(candidate.source.file), candidate.source.pointer), candidate.rawValue);
  assert.equal(detail.references[component], material.item.name['zh-CN']);
  f.contract.nested = f.contract.nested.map(rule => ({ ...rule, enabled: false }));
  const disabled = await buildMerged(f); assert.ok(!disabled.output['relations.json'].some(r => r.kind === 'has-ability')); assert.equal(allItems(disabled).some(row => row.id === ability2), false);
  delete f.contract.nested; const compatible = await buildMerged(f); assert.ok(compatible.output['relations.json'].some(r => r.kind === 'has-ability'));
  const invalid = { contract: structuredClone(f.contract), overrides: { version: 1, entries: [] } }; invalid.contract.nested = structuredClone(FULL_CONTRACT.nested); invalid.contract.nested[0].path = '__proto__'; assert.throws(() => validateRules(invalid), /嵌套/);
});

test('蓝图通过配方成品继承同语言描述并保留字典证据；独立蓝图描述优先',async()=>{const f=fixture();f.docs.get('plus/ExportWeapons.json')[f.id].description='/Language/WeaponDescription';f.docs.get('plus/dict.zh.json')['/Language/WeaponDescription']='成品中文说明';const data=await buildMerged(f);const detail=mergedDetail(data,f.blueprint);assert.equal(detail.item.description['zh-CN'],'成品中文说明');const field=detail.fields.find(f=>f.field==='description.zh-CN');assert.equal(field.candidates[0].transform,'derived-blueprint-description');assert.equal(field.candidates[0].resultSource.dictionary.pointer,'/~1Language~1WeaponDescription');assert.equal(field.candidates[0].source.pointer,'/'+f.blueprint.replaceAll('~','~0').replaceAll('/','~1')+'/resultType');f.docs.get('plus/ExportRecipes.json')[f.blueprint].description='/Language/RecipeDescription';f.docs.get('plus/dict.zh.json')['/Language/RecipeDescription']='独立蓝图说明';assert.equal(mergedDetail(await buildMerged(f),f.blueprint).item.description['zh-CN'],'独立蓝图说明');});
