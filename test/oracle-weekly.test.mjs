import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { weeklyConquests } from '../src/core/oracle-weekly.mjs';
import { selectOracleState, cachedOracleState, refreshOracleState, importOracleState } from '../src/core/oracle-state.mjs';
import { loadOracleData, describeOracle } from '../src/core/oracle-data.mjs';
import { sha256 } from '../src/core/io.mjs';

const fixture = JSON.parse(await fs.readFile(new URL('fixtures/oracle-weekly-service.json', import.meta.url), 'utf8'));
const readSource = (source, file) => fs.readFile(new URL(`../世界状态上游/git/${source === 'plus' ? 'warframe-public-export-plus' : 'wf.browse.oracle'}/${file}`, import.meta.url), 'utf8');
const data = await loadOracleData(readSource, 'weekly');
const stateFor = world => selectOracleState(JSON.stringify(world), { at: fixture.queryAt, loadedAt: fixture.queryAt });
const state = stateFor(fixture.worldState);
const run = (selected = state, at = fixture.queryAt) => weeklyConquests(data.missionTypes, { state: selected, at });

test('实验室／Hex 周常与 Oracle weekly.php 实际响应逐字段一致，保留原始数据', () => {
  const before = JSON.stringify(state), result = run();
  assert.deepEqual(Object.fromEntries(Object.keys(fixture.expected).map(key => [key, result[key]])), fixture.expected);
  assert.equal(JSON.stringify(state), before);
  assert.equal(result.sections.length, 2);
  assert.equal(result.sections[0].missions[0].conditions[1], 'MagneticHounds');
  assert.equal(result.sections[0].missions[0].raw.risks[1], 'EMPBlackHole');
  assert.deepEqual(result.sections[0].variables[1], { key: 'ComboCountChance', raw: 'DullBlades' });
});

test('周常开始／结束边界、未来条目、缺失与空列表、重叠和未知类型', () => {
  const start = Date.parse(state.data.Conquests[0].startsAt), end = Date.parse(state.data.Conquests[0].endsAt);
  assert.ok(run(state, start).sections.every(row => row.status === 'active'));
  assert.ok(run(state, end - 1).sections.every(row => row.status === 'active'));
  assert.ok(run(state, start - 1).sections.every(row => row.status === 'unavailable'));
  assert.ok(run(state, end).sections.every(row => row.status === 'unavailable'));
  assert.equal(run(state, end).expiry, null); assert.deepEqual(run(state, end).labConquestMissions, []);
  assert.throws(() => run(stateFor({ Invasions: [] })), /Conquests/);
  assert.equal(run(stateFor({ Conquests: [] })).sections.length, 2);
  const duplicate = structuredClone(fixture.worldState); duplicate.Conquests.push(duplicate.Conquests[0]);
  assert.throws(() => run(stateFor(duplicate)), /重叠/);
  const other = structuredClone(fixture.worldState); other.Conquests.push({ Type: 'CT_FUTURE' });
  assert.equal(run(stateFor(other)).sections.length, 2);
  const partial = stateFor({ Conquests: [fixture.worldState.Conquests[0]] });
  assert.equal(run(partial).sections[1].status, 'unavailable'); assert.equal(run(partial).sections[0].missions.length, 3);
});

test('仅实验室 Defense 改名，严格读取第二档，所有别名及未知值不丢失', () => {
  const world = structuredClone(fixture.worldState);
  for (const section of world.Conquests) {
    section.Missions[0].missionType = 'MT_DEFENSE';
    section.Missions[0].difficulties[0] = { deviation: 'NORMAL_ONLY', risks: ['NORMAL_ONLY'] };
    section.Missions[0].difficulties[1] = { deviation: 'HARD_ONLY', risks: ['EMPBlackHole', 'UnknownRisk', 'DullBlades'] };
    section.Variables = ['DullBlades', 'Undersupplied', 'UnknownVariable', 'EMPBlackHole'];
  }
  const result = run(stateFor(world));
  assert.equal(result.sections[0].missions[0].type, 'DualDefense'); assert.equal(result.sections[1].missions[0].type, 'Defense');
  assert.equal(result.sections[0].missions[0].variant, 'HARD_ONLY');
  assert.deepEqual(result.sections[0].missions[0].conditions, ['MagneticHounds', 'UnknownRisk', 'DullBlades']);
  assert.deepEqual(result.labConquestFrameVariables, ['ComboCountChance', 'MaxAmmo', 'UnknownVariable', 'EMPBlackHole']);
  world.Conquests[0].Missions[0].missionType = 'MT_NEW';
  const unknown = run(stateFor(world)); assert.equal(unknown.sections[0].missions[0].type, 'MT_NEW'); assert.ok(unknown.warnings.some(x => x.includes('MT_NEW')));
});

test('周常中文名称与说明按实验室／Hex 类型查找，缺字典降级并保留哈希和兼容字段', async () => {
  const result = describeOracle(run(), data, 'weekly');
  assert.equal(result.sections[0].missions[0].conditionDetails[1].name, '迷人弧犬');
  assert.equal(result.sections[0].variableDetails[1].name, '钝重兵刃');
  assert.ok(result.sections.every(section => section.missions.every(row => row.variantDetails.description && row.typeName !== row.type)));
  assert.equal(result.sections[0].missions[0].conditions[1], 'MagneticHounds');
  assert.ok(result.inputHashes['oracle/data/ExportMissionTypes.json']);
  const empty = { ...data, dictionary: {} }, fallback = describeOracle(run(), empty, 'weekly');
  assert.equal(fallback.sections[0].missions[0].variantDetails.name, fallback.sections[0].missions[0].variant);
  const markup = { ...data, dictionary: { '/Lotus/Language/Conquest/PersonalMod_NoPets_Desc': '<b>文本</b><img src=x>' } };
  assert.equal(describeOracle(run(), markup, 'weekly').sections[0].variableDetails[0].description, '文本');
  await assert.rejects(loadOracleData(async (id, file) => (await readSource(id, file)) + (file === 'weekly.php' ? 'changed' : ''), 'weekly'), /源码已变化/);
  await assert.rejects(loadOracleData(async (id, file) => file === 'data/ExportMissionTypes.json' ? '[]' : readSource(id, file), 'weekly'), /键值对象/);
});

test('新增限制使用有来源的中文补译，上游优先，缺失明确标记且原始键保留', () => {
  const result = describeOracle(run(), data, 'weekly');
  const entries = result.sections.flatMap(section => section.variableDetails);
  const expected = { NoPets: ['禁止携带同伴', 'Venari'], RangeDebuff: ['范围缩减', '50%'], AnemicShields: ['贫弱护盾', '500'] };
  for (const [key, [name, excerpt]] of Object.entries(expected)) {
    const value = entries.find(entry => entry.raw === key);
    assert.equal(value.name, name); assert.ok(value.description.includes(excerpt));
    assert.equal(value.key, key); assert.equal(value.localization.name, 'supplement');
    assert.equal(value.localization.description, 'supplement');
  }
  assert.ok(result.localization.supplementSource.startsWith('https://www.warframe.com/'));
  assert.ok(result.inputHashes['workbench/oracle-weekly.zh.json']);
  assert.deepEqual(result.localization.missingKeys, []);
  const nameKey = '/Lotus/Language/Conquest/PersonalMod_NoPets';
  const upstream = { ...data, dictionary: { ...data.dictionary, [nameKey]: '上游中文名称', [nameKey + '_Desc']: '上游中文说明' } };
  const chosen = describeOracle(run(), upstream, 'weekly').sections[0].variableDetails[0];
  assert.equal(chosen.name, '上游中文名称'); assert.equal(chosen.description, '上游中文说明'); assert.equal(chosen.localization.name, 'upstream');
  const world = structuredClone(fixture.worldState); world.Conquests[0].Variables.push('FutureModifier');
  const future = describeOracle(run(stateFor(world)), data, 'weekly');
  const pending = future.sections[0].variableDetails.at(-1);
  assert.equal(pending.raw, 'FutureModifier'); assert.equal(pending.localization.name, 'missing');
  assert.equal(pending.description, ''); assert.ok(future.localization.missingKeys.some(key => key.endsWith('FutureModifier')));
});

test('周常字段校验与失败保留缓存，旧版缓存仍可读取，导入只保留所需字段', async t => {
  for (const change of [w => { w.Conquests = {}; }, w => { w.Conquests[0].Missions[0].difficulties.pop(); }, w => { w.Conquests[0].Variables = 'bad'; }, w => { w.Conquests[0].Missions[0].difficulties[1].risks = null; }, w => { w.Conquests[0].Expiry = w.Conquests[0].Activation; }]) {
    const world = structuredClone(fixture.worldState); change(world); assert.throws(() => stateFor(world), /周常|Conquests/);
  }
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'wb-weekly-')); t.after(() => fs.rm(root, { recursive: true, force: true }));
  const file = path.join(root, 'cache.json'), input = path.join(root, 'input.json');
  await fs.writeFile(input, JSON.stringify(fixture.worldState));
  const first = await importOracleState(file, input, { at: fixture.queryAt });
  assert.equal(first.data.Conquests[0].RandomSeed, undefined);
  assert.deepEqual(await cachedOracleState(file), first);
  await fs.writeFile(input, '{"Conquests":{}}'); await assert.rejects(importOracleState(file, input), /Conquests/);
  assert.deepEqual(await cachedOracleState(file), first);
  const legacy = structuredClone(first); delete legacy.data.Conquests; legacy.dataHash = sha256(JSON.stringify(legacy.data));
  await fs.writeFile(file, JSON.stringify(legacy)); assert.deepEqual(await cachedOracleState(file), legacy);
  const oldService = JSON.parse(await fs.readFile(new URL('fixtures/oracle-service.json', import.meta.url), 'utf8'));
  const raw = JSON.stringify({ ...oldService.worldState, ...fixture.worldState });
  await refreshOracleState(file, { now: () => oldService.queryAt, request: async () => Buffer.from(raw) });
  assert.equal((await cachedOracleState(file)).data.Conquests.length, 2);
});
