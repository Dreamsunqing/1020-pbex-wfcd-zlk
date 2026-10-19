import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { ALLIES, CHALLENGE_MANIFESTS, LOCATION_MANIFESTS, oracleSeed, normaliseChallenge, challengeBounties, bountyCycle, locationBounties } from '../src/core/oracle-bounties.mjs';
import { invasionForecast, invasionMission } from '../src/core/oracle-invasions.mjs';
import { loadOracleData, describeOracle } from '../src/core/oracle-data.mjs';
import { selectOracleState, cachedOracleState, refreshOracleState, importOracleState } from '../src/core/oracle-state.mjs';
const readSource = (source, file) => fs.readFile(new URL(`../世界状态上游/git/${source === 'plus' ? 'warframe-public-export-plus' : 'wf.browse.oracle'}/${file}`, import.meta.url), 'utf8');
const [cycleData, locationData, invasionData] = await Promise.all(['cycle', 'locations', 'invasions'].map(scope => loadOracleData(readSource, scope)));
const service = JSON.parse(await fs.readFile(new URL('fixtures/oracle-service.json', import.meta.url), 'utf8'));
const state = selectOracleState(JSON.stringify(service.worldState), { at: service.queryAt, loadedAt: service.queryAt });

test('三块新增核心与实际 Oracle 服务响应逐项一致', () => {
  const result = bountyCycle(cycleData.manifests, { state, at: service.queryAt });
  assert.deepEqual(result.bounties, service.cycle.bounties); assert.equal(result.rot, service.cycle.rot); assert.equal(result.vaultRot, service.cycle.vaultRot); assert.equal(result.zarimanFaction, service.cycle.zarimanFaction); assert.equal(Date.parse(result.endsAt), service.cycle.expiry);
  const locations = locationBounties(locationData.manifests, { seed: service.locationSeed });
  assert.deepEqual(Object.fromEntries(Object.entries(locations.locations).map(([tag, rows]) => [tag, Object.fromEntries(rows.map(x => [x.location, x.jobs]))])), service.locations);
  const invasions = invasionForecast(invasionData.rules, { state, at: service.queryAt });
  assert.deepEqual(invasions.entries.map(({ side, ...row }) => row), service.invasions.invasions);
});
test('与独立 Python 参考向量核对七种 seed、64 位溢出和部分同伴输入', async () => {
  const vectors = JSON.parse(await fs.readFile(new URL('fixtures/oracle-bounty-vectors.json', import.meta.url), 'utf8'));
  for (const vector of vectors.cases) {
    const result = bountyCycle(cycleData.manifests, { seed: vector.seed });
    for (const [tag, file] of Object.entries(CHALLENGE_MANIFESTS)) assert.deepEqual(result.bounties[tag], vector.challenges[file]);
    const locations = locationBounties(locationData.manifests, { seed: vector.seed });
    for (const [tag, [file]] of Object.entries(LOCATION_MANIFESTS)) assert.deepEqual(locations.locations[tag], vector.locations[file]);
  }
  const partial = vectors.partialAllies;
  assert.deepEqual(challengeBounties(cycleData.manifests['WF1999JobManifest.json'], partial.seed, { allies: partial.allies, faction: 'FC_CORPUS' }), partial.result);
});
test('挑战归一化、条件过滤、重复挑战回退及输入不可变', () => {
  assert.equal(normaliseChallenge('/A/GoalVeryHardChallenge'), 'Goal'); assert.equal(normaliseChallenge('/A/GoalEasyChallenge'), 'Goal');
  const original = JSON.stringify(cycleData.manifests), allies = [...ALLIES];
  challengeBounties(cycleData.manifests['WF1999JobManifest.json'], '24091', { allies });
  assert.equal(JSON.stringify(cycleData.manifests), original); assert.deepEqual(allies, ALLIES);
  const manifest = { ChallengeMissionNodes: ['Node'], ChallengeMissionDifficultyTiers: Array.from({ length: 3 }, () => ({ challenges: [{ Node: 'Node', CheckFaction: 1, Faction: 'FC_CORPUS', challenges: ['/A/GoalEasy'] }, { Node: '', CheckFaction: 1, Faction: 'FC_GRINEER', challenges: ['/A/GrineerHard'] }] })) };
  const rows = challengeBounties(manifest, '1', { faction: 'FC_CORPUS' }); assert.equal(rows.length, 3); assert.ok(rows.every(x => x.challenge === '/A/GoalEasy'));
  assert.throws(() => challengeBounties(manifest, '1', { faction: 'unknown' }), /没有匹配/);
});
test('手填 seed 不假冒实时轮次，世界状态窗口边界与重叠明确拒绝', () => {
  const manual = bountyCycle(cycleData.manifests, { seed: '24091', state, at: service.queryAt });
  assert.equal(manual.input, 'manual-seed'); assert.equal(manual.rot, null); assert.equal(manual.worldState, null); assert.equal(manual.endsAt, null);
  const hex = state.data.SyndicateMissions.find(x => x.Tag === 'HexSyndicate');
  assert.doesNotThrow(() => bountyCycle(cycleData.manifests, { state, at: Date.parse(hex.endsAt) - 1 }));
  assert.throws(() => bountyCycle(cycleData.manifests, { state, at: Date.parse(hex.endsAt) }), /覆盖参考时间/);
  assert.throws(() => bountyCycle(cycleData.manifests, { at: service.queryAt }), /世界状态/);
  const duplicate = structuredClone(state); duplicate.data.SyndicateMissions.push(hex);
  assert.throws(() => bountyCycle(cycleData.manifests, { state: duplicate, at: service.queryAt }), /重叠/);
  const locations = locationBounties(locationData.manifests, { state, at: service.queryAt }); assert.equal(locations.seed, String(service.seed)); assert.ok(locations.endsAt);
});
test('seed 不接受精度丢失、浮点或溢出；坏清单和改变的源码不静默继续', async () => {
  for (const value of [NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1, '', '2e8', '0x10', '18446744073709551616', '-9223372036854775809', null, true]) assert.throws(() => oracleSeed(value));
  assert.equal(oracleSeed('18446744073709551615'), (1n << 64n) - 1n);
  assert.throws(() => bountyCycle({}, { seed: '1' }), /缺少/);
  assert.throws(() => locationBounties({}, { seed: '1' }), /结构无效/);
  await assert.rejects(loadOracleData(async (id, file) => (await readSource(id, file)) + (file.endsWith('.pluto') ? '\n-- changed' : ''), 'cycle'), /源码已变化/);
  const normal = await loadOracleData(async (id, file) => (await readSource(id, file)).replace(/\r\n/g, '\n'), 'cycle'); assert.equal(Object.keys(normal.manifests).length, 3);
});
test('入侵按 15 分钟切换、UTC 零点重置；舰船、非舰船、Infested 和首领分支', () => {
  const base = { Node: 'SolNode132', Faction: 'FC_CORPUS', DefenderFaction: 'FC_GRINEER', LocTag: 'normal', AttackerMissionInfo: { seed: '566949' }, DefenderMissionInfo: { seed: '409443' } }, rules = invasionData.rules;
  const midnight = Date.parse('2026-10-20T00:00Z');
  const before = invasionMission(base, true, midnight - 1, rules), after = invasionMission(base, true, midnight, rules);
  assert.equal(after, invasionMission(base, true, midnight + 899999, rules));
  assert.equal(after, invasionMission(base, true, midnight + 86400000, rules)); assert.equal(before, invasionMission(base, true, midnight - 900000, rules));
  const start = service.queryAt;
  assert.equal(invasionMission(base, true, start, rules), invasionMission(base, true, start + 899999, rules));
  const boss = { LocTag: '/Lotus/Language/Menu/InfestedInvasionBoss' }; assert.equal(invasionMission(boss, false, start, rules), 'Assassination');
  const marked = { ...rules, attacker: ['attacker-only'], defender: ['defender-only'], ship: ['ship-only'] };
  assert.equal(invasionMission({ ...base, Node: 'SolNode94' }, true, start, marked), 'ship-only');
  assert.equal(invasionMission({ ...base, Node: 'SolNode94', Faction: 'FC_INFESTATION' }, true, start, marked), 'attacker-only');
  assert.equal(invasionMission(base, false, start, marked), 'defender-only');
  assert.throws(() => invasionForecast(rules, { state, at: start + 900000 }), /采集窗口/);
  assert.throws(() => invasionForecast(rules, { state, at: start, count: 9 }), /1–8/);
  const projected = invasionForecast(rules, { state, at: start, count: 8 }); assert.equal(projected.windows.length, 8); assert.ok(projected.entries.every(x => x.missions.length === 8));
});
test('翻译保留原始节点/挑战路径、奖励路径和完整输入哈希', () => {
  const result = describeOracle(bountyCycle(cycleData.manifests, { seed: '24091' }, { releaseId: 'selected' }), cycleData, 'cycle');
  assert.ok(result.bounties.HexSyndicate.some(x => x.challengeName && x.allyName)); assert.ok(result.bounties.HexSyndicate.every(x => !x.challengeDescription.includes('|COUNT|')));
  assert.ok(result.inputHashes['oracle/data/WF1999JobManifest.json']); assert.equal(result.dataVersion.releaseId, 'selected');
  const locations = describeOracle(locationBounties(locationData.manifests, { seed: '24091' }), locationData, 'locations'); assert.ok(locations.locations.CetusSyndicate[0].jobDetails[0].key.startsWith('/Lotus/'));
  const invasions = describeOracle(invasionForecast(invasionData.rules, { state, at: service.queryAt }), invasionData, 'invasions'); assert.ok(invasions.entries.every(x => x.allyName && x.rewardDetails.every(item => item.ItemType && item.name)));
  assert.ok(invasions.entries.some(x => x.rewardDetails.some(item => item.name.includes('蓝图'))));
});
test('世界状态只缓存必要输入，校验失败保留旧版；支持导入回放与损坏检测', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'wb-oracle-state-')); t.after(() => fs.rm(root, { recursive: true, force: true }));
  const file = path.join(root, 'oracle.json'), raw = JSON.stringify({ ...service.worldState, Conquests: [], Unrelated: 'not retained' });
  assert.equal(await cachedOracleState(file), null);
  const first = await refreshOracleState(file, { now: () => service.queryAt, request: async () => Buffer.from(raw) });
  assert.equal(JSON.stringify(first).includes('not retained'), false); assert.deepEqual(await cachedOracleState(file), first);
  await assert.rejects(refreshOracleState(file, { request: async () => Buffer.from('{"WorldSeed":1}') }), /缺少/); assert.deepEqual(await cachedOracleState(file), first);
  await assert.rejects(refreshOracleState(file, { now: () => service.queryAt, request: async () => Buffer.from('{"SyndicateMissions":[],"Invasions":[],"Conquests":[]}') }), /覆盖参考时间/); assert.deepEqual(await cachedOracleState(file), first);
  await assert.rejects(refreshOracleState(file, { request: async () => { throw new Error('offline'); } }), /offline/); assert.deepEqual(await cachedOracleState(file), first);
  const input = path.join(root, 'input.json'); await fs.writeFile(input, raw);
  const imported = await importOracleState(file, input, { at: service.queryAt, now: () => service.queryAt + 1 }); assert.ok(imported.source.includes('input.json')); assert.equal(imported.loadedAt, new Date(service.queryAt + 1).toISOString());
  const damaged = JSON.parse(await fs.readFile(file, 'utf8')); damaged.data.SyndicateMissions[0].seed = '0'; await fs.writeFile(file, JSON.stringify(damaged)); assert.equal(await cachedOracleState(file), null);
});
