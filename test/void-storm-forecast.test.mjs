import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { gunzipSync } from 'node:zlib';
import { stormObservation, forecastVoidStorms, backtestVoidStorms } from '../src/core/void-storm-forecast.mjs';
import { VoidStormForecastStore } from '../src/core/void-storm-store.mjs';

const epoch = Date.parse('2026-10-25T06:20:03.351Z');
const make = (offset, phases = [0], observedOffset = offset + 10 * 60000, extra = {}) => stormObservation({
  last_updated: new Date(epoch + observedOffset).toISOString(),
  data: phases.flatMap(phase => Array.from({ length: 6 }, (_, index) => ({
    activation: new Date(epoch + offset + phase + index).toISOString(), expiry: new Date(epoch + offset + phase + index + 5400000).toISOString(), isStorm: true,
    node: 'CrewBattleNode501', tierNum: 1,
  }))),
}, { server: 'de', id: String(offset), ...extra });

test('24 小时预测保持小时节奏、90 分钟窗口及 30 分钟重叠，不生成节点／纪元', () => {
  const result = forecastVoidStorms(make(0));
  assert.equal(result.entries.length, 24);
  assert.equal(result.entries[0].startsAt, '2026-10-25T07:20:03.351Z');
  assert.equal(result.entries[0].endsAt, '2026-10-25T08:50:03.351Z');
  assert.equal(Date.parse(result.entries[0].endsAt) - Date.parse(result.entries[1].startsAt), 1800000);
  assert.ok(result.entries.every(row => !('node' in row) && !('tier' in row) && !('count' in row)));
  assert.ok(result.entries.every(row => Date.parse(row.startsAt) > Date.parse(result.issuedAt) && Date.parse(row.startsAt) < Date.parse(result.horizonEndsAt)));
  assert.throws(() => forecastVoidStorms(make(0), { at: epoch }), /不能早于/);
});

test('预测区间是开区间，恰好开始／结束边界的批次不重复', () => {
  const sample = make(0, [0], 0), result = forecastVoidStorms(sample);
  assert.equal(result.entries.length, 23);
  assert.equal(result.entries[0].startsAt, new Date(epoch + 3600000).toISOString());
  assert.throws(() => forecastVoidStorms(sample, { at: epoch - 1 }), /不能早于/);
  assert.throws(() => forecastVoidStorms(sample, { hours: 25 }), /1 至 24/);
});

test('官方扩展时间、普通裂缝排除、无效记录、空快照及陈旧锚点', () => {
  const sample = stormObservation({ VoidStorms: [{ Activation: { $date: { $numberLong: String(epoch) } }, Expiry: { $date: epoch + 5400000 } }, { Activation: null }] }, { server: 'wg', observedAt: epoch + 60000 });
  assert.equal(sample.storms.length, 1); assert.equal(sample.invalidRows, 1);
  const result = forecastVoidStorms(sample, { at: epoch + 4 * 3600000 }); assert.equal(result.stale, true);
  assert.ok(result.warnings.some(row => row.includes('无效')));
  assert.equal(forecastVoidStorms(stormObservation({ data: [{ isStorm: false }] }, { server: 'de', observedAt: epoch })).entries.length, 0);
  assert.throws(() => stormObservation({ ActiveMissions: [] }, { server: 'de', observedAt: epoch }), /缺少 VoidStorms/);
  assert.throws(() => stormObservation({ VoidStorms: [] }, { server: 'de' }), /采集时间/);
  assert.throws(() => stormObservation({ VoidStorms: [] }, { server: 'bad', observedAt: epoch }), /服务器/);
});

test('国服 :20 与 :40 分组独立预测；保留秒级偏移以免整分截断制造误差', () => {
  const sample = make(0, [0, 20 * 60000 + 8000], 30 * 60000, { server: 'wg' });
  const result = forecastVoidStorms(sample);
  assert.deepEqual(result.lanes.map(row => row.phaseMinute), [20, 40]);
  assert.equal(result.entries.length, 48);
  assert.ok(result.entries.some(row => row.startsAt.endsWith(':40:11.351Z')));
});

test('回测仅用更早快照，不泄露新增时间组；漂移与时长变化计为失败', () => {
  const first = make(0), second = make(3600000, [0, 20 * 60000], 3600000 + 30 * 60000);
  const report = backtestVoidStorms([second, first, first], { server: 'de' });
  assert.equal(report.sampleCount, 2); assert.equal(report.total, 2); assert.equal(report.hits, 1);
  assert.equal(report.evaluations[1].maxErrorSeconds, null);
  const shifted = make(3600000 + 11000);
  assert.equal(backtestVoidStorms([first, shifted], { server: 'de' }).hits, 0);
  const long = structuredClone(make(3600000)); long.storms[0].expiry = new Date(epoch + 3600000 + 5400000 + 60000).toISOString();
  assert.equal(backtestVoidStorms([first, long], { server: 'de' }).hits, 0);
});

test('每日采样空洞不计失败，超过24小时无法核验，单快照不伪造准确率', () => {
  const first = make(0), distant = make(3 * 86400000);
  const result = backtestVoidStorms([first, distant], { server: 'de' });
  assert.equal(result.total, 0); assert.equal(result.rate, null); assert.equal(result.notEvaluableWaves, 2);
  const next = make(3600000), sameServer = backtestVoidStorms([first, { ...next, server: 'wg' }], { server: 'de' });
  assert.equal(sameServer.total, 0);
});

test('打包的真实每日快照逐时序回测，区分持续时间一致性与预测命中率', async () => {
  const history = JSON.parse(gunzipSync(await fs.readFile(new URL('../src/data/void-storm-history.json.gz', import.meta.url))));
  assert.equal(history.samples.length, 104); assert.equal(history.missing.length, 34);
  const de = backtestVoidStorms(history.samples, { server: 'de' }), wg = backtestVoidStorms(history.samples, { server: 'wg' });
  assert.deepEqual([de.hits, de.total, de.observedWaves], [75, 75, 91]);
  assert.deepEqual([wg.hits, wg.total, wg.observedWaves], [163, 163, 192]);
  assert.ok([...de.evaluations, ...wg.evaluations].every(row => row.leadHours > 0 && row.leadHours < 24));
  assert.equal(de.bands[0].rate, null);
});

test('并行采样持久化、重复刷新去重、历史参考时间不读未来证据', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'storm-forecast-')); t.after(() => fs.rm(root, { recursive: true, force: true }));
  const store = new VoidStormForecastStore(root), de = make(0, [0], 60000, { hash: 'de' }), wg = { ...de, server: 'wg', hash: 'wg' };
  await Promise.all([store.record(de), store.record(wg), store.record(de)]);
  const saved = JSON.parse(await fs.readFile(path.join(root, 'observations.json'), 'utf8')); assert.equal(saved.samples.length, 2);
  const view = await store.view({ raw: { Time: (epoch + 60000) / 1000, data: make(0).storms.map(row => ({ ...row, isStorm: true })) }, server: 'de', kind: 'history', hash: 'history', source: 'fixture' }, { at: Date.parse('2026-08-17T00:00:00Z') }).catch(error => error);
  assert.match(view.message, /不能早于/);
});
