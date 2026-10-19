import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { browseRules, weeklyRotations, worldCycles, incursions, parseIncursions, anchorFromWorldState, WORLD_STATE_URL } from '../src/core/browse.mjs';
import { loadBrowseData } from '../src/core/browse-data.mjs';
import { cachedAnchor, refreshAnchor } from '../src/core/world-state.mjs';
import { importLocal } from '../src/core/updater.mjs';
import { Store } from '../src/core/store.mjs';

const source = await fs.readFile(new URL('../世界状态上游/git/browse.wf/live.ts', import.meta.url), 'utf8');
const schedule = await fs.readFile(new URL('../世界状态上游/git/browse.wf/sp-incursions.txt', import.meta.url), 'utf8');
const rules = browseRules(source), WEEK = 604800000;
const at = Date.parse('2026-10-19T12:00:00Z');
const activation = Date.parse('2026-10-19T12:00:00Z'), expiry = activation + 9000000;
const stamp = value => ({ $date: { $numberLong: String(value) } });
const payload = (start = activation, end = expiry) => JSON.stringify({ SyndicateMissions: [{ Tag: 'HexSyndicate', Activation: stamp(start), Expiry: stamp(end) }] });

test('只提取上游 JSON 规则表；公式变更与可执行数组拒绝兼容', () => {
  assert.deepEqual([rules.frames.length, rules.weapons.length, rules.offers.length], [11, 9, 8]);
  assert.equal(rules.teshinEpoch, Date.parse('2025-01-06T00:00Z'));
  assert.equal(rules.circuitEpoch, Date.parse('2024-12-16T00:00Z'));
  assert.throws(() => browseRules(source.replace(' / 1600000', ' / 1600001')), /规则已变化/);
  assert.throws(() => browseRules(source.replace('duviri_mood_index % 5', 'duviri_mood_index % 4')), /规则已变化/);
  assert.throws(() => browseRules(source.replace('"Umbra Forma Blueprint",', 'globalThis.unsafe(),')), /JSON|Unexpected/);
  const normalized = browseRules(source.replace(/\r\n/g, '\n'));
  assert.deepEqual({ ...normalized, sourceHash: rules.sourceHash }, rules);
});
test('周轮换基准、8/11/9 周回绕、UTC 周一边界与已知日期', () => {
  const first = weeklyRotations(rules, { at: rules.teshinEpoch, count: 1 }).entries[0];
  assert.equal(first.teshin.key, 'Umbra Forma Blueprint');
  assert.equal(weeklyRotations(rules, { at: rules.teshinEpoch + 8 * WEEK, count: 1 }).entries[0].teshin.key, first.teshin.key);
  const frameStart = weeklyRotations(rules, { at: rules.teshinEpoch, count: 1 }).entries[0].circuit;
  assert.deepEqual(weeklyRotations(rules, { at: rules.teshinEpoch + 11 * WEEK, count: 1 }).entries[0].circuit.frames, frameStart.frames);
  assert.deepEqual(weeklyRotations(rules, { at: rules.teshinEpoch + 9 * WEEK, count: 1 }).entries[0].circuit.weapons, frameStart.weapons);
  const last = weeklyRotations(rules, { at: at - 12 * 3600000 - 1, count: 1 }).entries[0];
  const now = weeklyRotations(rules, { at, count: 1 }).entries[0];
  assert.equal(last.endsAt, now.startsAt); assert.equal(now.startsAt, '2026-10-19T00:00:00.000Z');
  assert.equal(now.teshin.key, '30,000x Endo');
  assert.deepEqual([now.circuit.normalIndex, now.circuit.steelIndex], [8, 6]);
  assert.ok(now.circuit.frames[0].key.endsWith('/HydroidName'));
  assert.throws(() => weeklyRotations(rules, { at: NaN }));
  assert.throws(() => weeklyRotations(rules, { at: rules.teshinEpoch - 1 }), /基准/);
  assert.throws(() => weeklyRotations(rules, { count: 53 }));
});
test('双衍王境两小时与山谷温暖/寒冷严格切换边界', () => {
  const epoch = Date.parse('2018-11-10T08:13:48Z');
  const vallis = at => worldCycles(rules, { at }).entries[1];
  assert.equal(vallis(epoch).state, '温暖'); assert.equal(vallis(epoch + 399999).state, '温暖');
  assert.equal(vallis(epoch + 400000).state, '寒冷'); assert.equal(vallis(epoch + 1599999).state, '寒冷');
  assert.equal(vallis(epoch + 1600000).state, '温暖');
  assert.equal(vallis(epoch + 400000).endsAt, new Date(epoch + 1600000).toISOString());
  const before = worldCycles(rules, { at: Date.parse('2026-10-19T01:59:59.999Z') }).entries[0];
  const after = worldCycles(rules, { at: Date.parse('2026-10-19T02:00Z') }).entries[0];
  assert.notEqual(before.key, after.key); assert.equal(before.endsAt, after.startsAt);
  assert.equal(worldCycles(rules, { at: Date.parse('2026-10-19T18:00Z') }).entries[0].state, '嫉妒');
});
test('平原/火卫二按 Hex 基准切换；缺失、过期和范围外不伪造周期', () => {
  const anchor = anchorFromWorldState(payload(), { fetchedAt: activation + 1 });
  const cycles = at => worldCycles(rules, { at, anchor });
  assert.deepEqual(cycles(activation).entries.slice(2).map(x => x.state), ['白昼', 'Fass']);
  assert.deepEqual(cycles(expiry - 3000000).entries.slice(2).map(x => x.state), ['夜晚', 'Vome']);
  assert.equal(cycles(expiry - 1).anchorStatus, 'covered'); assert.equal(cycles(expiry).anchorStatus, 'outside-window');
  assert.equal(cycles(activation - 1).entries[2].endsAt, null);
  assert.equal(worldCycles(rules, { at }).anchorStatus, 'missing');
  assert.throws(() => anchorFromWorldState(payload(), { fetchedAt: expiry }), /有效/);
  assert.throws(() => anchorFromWorldState(payload(activation, expiry + 10001), { fetchedAt: activation }), /长度/);
  assert.throws(() => anchorFromWorldState('{"SyndicateMissions":[]}', { fetchedAt: at }), /时间基准/);
});
test('每日突袭 UTC 边界、已知六节点、等级+100、排期首尾及错误行', () => {
  const rows = parseIncursions(schedule); assert.equal(rows[0].seconds, 1736726400);
  const result = incursions(schedule, { at, count: 2 }, { SolNode94: { name: 'n', systemName: 's', missionName: 'm', minEnemyLevel: 10, maxEnemyLevel: 15 } }, { n: '节点', s: '星球', m: '歼灭' });
  assert.deepEqual(result.entries[0].nodes.map(x => x.node), ['SolNode94', 'SettlementNode11', 'SolNode64', 'SolNode746', 'SolNode172', 'SolNode717']);
  assert.deepEqual([result.entries[0].nodes[0].name, result.entries[0].nodes[0].minLevel, result.entries[0].nodes[0].maxLevel], ['节点', 110, 115]);
  assert.equal(result.entries[0].startsAt, '2026-10-19T00:00:00.000Z');
  const end = Date.parse(result.coverage.endsAt); assert.equal(incursions(schedule, { at: end - 1 }).truncated, true);
  assert.throws(() => incursions(schedule, { at: end }), /覆盖范围/);
  assert.throws(() => incursions(schedule, { at: rows[0].seconds * 1000 - 1 }), /覆盖范围/);
  for (const bad of ['', '0;A,B,C,D,E', '0;A,B,C,D,E,E', '1;A,B,C,D,E,F', '0;A,B,C,D,E,F\n172800;A,B,C,D,E,F']) assert.throws(() => parseIncursions(bad));
});
test('选定来源中的规则、字典与快照标签独立生效，缺失翻译可降级', async () => {
  const data = await loadBrowseData(async (id, filename) => { if (id === 'browse') return source.replace('Umbra Forma Blueprint', 'Changed offer'); throw new Error('missing'); });
  assert.equal(data.warnings.length, 1);
  const result = weeklyRotations(data.rules, { at: rules.teshinEpoch, count: 1 }, { [rules.frames[3][0]]: '测试翻译' }, { releaseId: 'selected' });
  assert.equal(result.entries[0].teshin.label, 'Changed offer'); assert.equal(result.dataVersion.releaseId, 'selected');
  assert.equal(result.entries[0].circuit.frames[0].label, '测试翻译'); assert.notEqual(result.sourceHash, rules.sourceHash);
});
test('世界状态缓存原子写入；请求/验证失败保留旧基准，损坏缓存不使用', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'wb-anchor-')); t.after(() => fs.rm(root, { recursive: true, force: true }));
  const file = path.join(root, 'runtime', 'world-state.json'); assert.equal(await cachedAnchor(file), null);
  const anchor = await refreshAnchor(file, { now: () => activation + 1, proxyUrl: 'http://proxy.invalid', request: async (url, options) => { assert.equal(url, WORLD_STATE_URL); assert.equal(options.proxyUrl, 'http://proxy.invalid'); return Buffer.from(payload()); } });
  assert.deepEqual(await cachedAnchor(file), anchor);
  await assert.rejects(refreshAnchor(file, { request: async () => { throw new Error('offline'); } }), /offline/);
  await assert.rejects(refreshAnchor(file, { now: () => at, request: async () => Buffer.from('{}') }), /时间基准/);
  assert.deepEqual(await cachedAnchor(file), anchor);
  await fs.writeFile(file, '{}'); assert.equal(await cachedAnchor(file), null);
});
test('导入拒绝损坏每日排期，保留原发布版本', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'wb-incursions-')); t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, 'browse')); const file = path.join(root, 'browse', 'sp-incursions.txt');
  await fs.writeFile(file, '0;A,B,C,D,E,F\n');
  const config = { concurrency: 2, sources: [{ id: 'browse', localPath: 'browse', enabled: true, kind: 'github', label: 'Browse' }] }, storeRoot = path.join(root, 'store');
  const first = await importLocal({ libraryRoot: root, config, storeRoot });
  await fs.writeFile(file, '0;A,B,C,D,E\n');
  await assert.rejects(importLocal({ libraryRoot: root, config, storeRoot }), /6 个节点/);
  assert.equal((await new Store(storeRoot).current()).id, first.releaseId);
});
