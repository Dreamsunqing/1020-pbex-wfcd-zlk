import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadOracleData, describeOracle } from '../src/core/oracle-data.mjs';
import { bountyCycle, locationBounties } from '../src/core/oracle-bounties.mjs';
import { selectOracleState } from '../src/core/oracle-state.mjs';
import { rewardResolver } from '../src/core/oracle-rewards.mjs';
const readSource = (id, file) => readFile(new URL(`../世界状态上游/git/${id === 'plus' ? 'warframe-public-export-plus' : 'wf.browse.oracle'}/${file}`, import.meta.url), 'utf8');
const cycle = await loadOracleData(readSource, 'cycle'), locations = await loadOracleData(readSource, 'locations');
const fixture = JSON.parse(await readFile(new URL('fixtures/oracle-service.json', import.meta.url)));
const state = selectOracleState(JSON.stringify(fixture.worldState), { at: fixture.queryAt });
const input = { state, at: fixture.queryAt };
const describeLocations = (context = input, data = locations) => describeOracle(locationBounties(data.manifests, context), data, 'locations', context);

test('01 全部 17 档从清单关联原始奖励表，中文、概率和来源完整且不改变输入', () => {
  const original = JSON.stringify(cycle);
  const result = describeOracle(bountyCycle(cycle.manifests, { seed: '24091' }), cycle, 'cycle');
  const rewards = Object.values(result.bounties).flat().map(row => row.rewardDetails);
  assert.equal(rewards.length, 17);
  assert.ok(rewards.every(row => row.basis === 'manifest-tier' && row.table.status === 'available' && row.table.pools.length > 0));
  assert.ok(rewards.flatMap(row => row.table.pools.flatMap(pool => pool.items)).every(item => item.localization === 'upstream' && item.probability !== null && item.nameSource?.dictionary.file && item.source.pointer));
  assert.equal(rewards[0].fixed.xpItem.name, '虚空刺翎');
  assert.equal(result.bounties.HexSyndicate[0].rewardDetails.fixed.chemistryAmount, 20);
  assert.ok(result.inputHashes['plus/ExportRewards.json']); assert.ok(result.inputHashes['plus/ExportFusionBundles.json']);
  assert.equal(JSON.stringify(cycle), original);
});

test('奖励数量换算 Endo 和现金，蓝图按 resultType 关联成品名，保留原始包数和指针', () => {
  const resolver = rewardResolver(cycle), key = '/Lotus/Types/Game/MissionDecks/ZarimanJobMissionRewards/TierATableRewards';
  const items = resolver.table(key).pools[0].items;
  const endo = items.find(item => item.itemCount === 10 && item.conversion?.field === 'fusionPoints');
  assert.equal(endo.quantity, 500); assert.equal(endo.name, '内融核心'); assert.equal(endo.probability, 0.1739); assert.equal(endo.conversion.perItem, 50);
  const credits = items.find(item => item.conversion?.field === 'credits'); assert.equal(credits.quantity, 15000); assert.equal(credits.itemCount, 1);
  const blueprint = items.find(item => item.nameSource?.resultSource); assert.match(blueprint.name, /蓝图$/); assert.match(blueprint.nameSource.file, /ExportRecipes/); assert.ok(blueprint.nameSource.resultSource.pointer);
  assert.equal(items.filter(item => item.conversion?.field === 'fusionPoints').length, 2); // same item path, different bundle counts stay separate
});

test('02 各地区独立匹配完整世界状态奖励路径，缺失山谷轮次显示候选，排除无尽和额外任务', () => {
  const result = describeLocations();
  assert.equal(result.rewardCatalog.CetusSyndicate.tiers.length, 6); assert.equal(result.rewardCatalog.EntratiSyndicate.tiers.length, 5);
  assert.ok(result.rewardCatalog.CetusSyndicate.tiers.every(tier => tier.status === 'world-state' && tier.tables.length === 1 && tier.tables[0].key.endsWith('TableCRewards')));
  assert.ok(result.rewardCatalog.SolarisSyndicate.tiers.every(tier => tier.status === 'unconfirmed' && tier.tables.length === 3));
  assert.equal(result.rewardCatalog.EntratiSyndicate.tiers.find(tier => tier.tier === 4).tables[0].key.endsWith('TierDTableARewards'), true);
  assert.ok(!result.rewardCatalog.EntratiSyndicate.tiers.some(tier => tier.tier === 3));
  assert.ok(Object.values(result.rewardCatalog).every(catalog => catalog.applicableJobs.length && catalog.tiers.every(tier => tier.tables.every(table => table.status === 'available'))));
  assert.ok(result.locations.CetusSyndicate.every(row => row.jobDetails.length === 3 && row.jobDetails.every(job => !Object.hasOwn(job, 'rewardDetails'))));
});

test('山谷奖励纳入世界状态缓存但轮次不借用平原；过期、重叠、冲突及手填 seed 不冒充实时', () => {
  const raw = structuredClone(fixture.worldState), venus = structuredClone(raw.SyndicateMissions.find(row => row.Tag === 'CetusSyndicate'));
  venus.Tag = 'SolarisSyndicate'; venus.Jobs = locations.manifests['VenusJobManifest.json'].JobDifficultyTiers.slice(0, 6).map(tier => ({ rewards: tier.rewardManifests[1] })); raw.SyndicateMissions.push(venus);
  const full = selectOracleState(JSON.stringify(raw), { at: fixture.queryAt }), context = { ...input, state: full };
  assert.equal(full.data.SyndicateMissions.filter(row => row.Tag === 'SolarisSyndicate').length, 1);
  assert.ok(describeLocations(context).rewardCatalog.SolarisSyndicate.tiers.every(tier => tier.status === 'world-state' && tier.tables[0].key.endsWith('TableBRewards')));
  const manual = describeLocations({ ...context, seed: '24091' });
  assert.equal(manual.rewardCatalog.SolarisSyndicate.worldState, null); assert.equal(manual.rewardCatalog.CetusSyndicate.tiers[0].status, 'unconfirmed'); assert.equal(manual.rewardCatalog.EntratiSyndicate.tiers.at(-1).status, 'fixed');
  assert.ok(Object.values(manual.rewardCatalog).flatMap(catalog => catalog.tiers.flatMap(tier => tier.tables)).every(table => table.status === 'available' && table.pools.every(pool => pool.items.every(item => item.localization === 'upstream'))));
  const stale = structuredClone(full); stale.data.SyndicateMissions.find(row => row.Tag === 'SolarisSyndicate').endsAt = new Date(fixture.queryAt).toISOString();
  assert.equal(describeLocations({ ...input, state: stale }).rewardCatalog.SolarisSyndicate.tiers[0].status, 'unconfirmed');
  const duplicate = structuredClone(full); duplicate.data.SyndicateMissions.push(duplicate.data.SyndicateMissions.find(row => row.Tag === 'SolarisSyndicate'));
  assert.equal(describeLocations({ ...input, state: duplicate }).rewardCatalog.SolarisSyndicate.tiers[0].status, 'unconfirmed');
  const conflict = structuredClone(full); conflict.data.SyndicateMissions.find(row => row.Tag === 'SolarisSyndicate').jobs.push({ rewards: locations.manifests['VenusJobManifest.json'].JobDifficultyTiers[0].rewardManifests[0] });
  assert.equal(describeLocations({ ...input, state: conflict }).rewardCatalog.SolarisSyndicate.tiers[0].status, 'unconfirmed');
});

test('未知物品、缺表、坏概率和仅有稀有度均明确降级，不猜概率或替换 Supplementals', () => {
  const data = { rewardCatalogs: { 'ExportResources.json': { '/Lotus/Foo': null, '/Lotus/BadArray': [] } }, rewardTables: { '/Known': [[{ type: '/Lotus/StoreItems/Foo', itemCount: 2, rarity: 'RARE' }, { type: '/Lotus/Foo', probability: 2, itemCount: 1 }, null]] } };
  const result = rewardResolver(data).table('/Known'); assert.equal(result.status, 'partial'); assert.equal(result.pools[0].items[0].rarity, 'RARE'); assert.equal(result.pools[0].items[0].probability, null); assert.equal(result.pools[0].items[0].key, '/Lotus/Foo'); assert.equal(result.pools[0].items[1].probability, null);
  assert.equal(rewardResolver(data).table('/Supplementals/Known').status, 'missing');
  assert.equal(rewardResolver({ rewardTables: { Bad: [null] } }).table('Bad').status, 'missing');
});

test('导出缺失时仍保留任务，奖励明确缺失；概率不归一化，池号不映射阶段', async () => {
  const data = await loadOracleData(async (id, file) => { if (file === 'ExportRewards.json') throw new Error('fixture missing'); return readSource(id, file); }, 'cycle');
  const result = describeOracle(bountyCycle(data.manifests, { seed: '24091' }), data, 'cycle');
  assert.equal(Object.values(result.bounties).flat().length, 17); assert.equal(result.bounties.HexSyndicate[0].rewardDetails.table.status, 'missing'); assert.ok(result.warnings.some(row => row.includes('ExportRewards')));
  const table = rewardResolver({ rewardTables: { X: [[{ type: 'a', itemCount: 1, probability: 0.5001 }, { type: 'b', itemCount: 1, probability: 0.5001 }]] } }).table('X');
  assert.equal(table.pools[0].items.reduce((sum, item) => sum + item.probability, 0), 1.0002); assert.ok(!Object.hasOwn(table.pools[0], 'stage'));
});
