import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { stormObservation, forecastVoidStorms, backtestVoidStorms } from '../src/core/void-storm-forecast.mjs';
import { contentIdentity, fitStormContent, forecastStormContent, backtestStormContent } from '../src/core/void-storm-content.mjs';

const start = Date.parse('2026-09-01T00:20:03Z');
const catalog = { nodes: { CrewBattleNode501: { name: '甲（土星）', missionType: '前哨战' }, CrewBattleNode511: { name: '乙（金星）', missionType: '爆发' } }, missionTypes: { MT_SURVIVAL: '生存' }, aliases: { '甲(土星)': 'CrewBattleNode501' } };
const sample = (offset, node, server = 'de', tier = 1) => stormObservation({
  VoidStorms: [{ Node: node, ActiveMissionTier: `VoidT${tier}`, Activation: start + offset, Expiry: start + offset + 5400000 }],
}, { server, observedAt: start + offset + 600000, id: `${server}:${offset}`, hash: `${server}:${offset}` });

test('内容提取兼容官方和每日快照；精确别名规范括号，未知译名保留，不以同名猜ID', () => {
  assert.equal(sample(0, 'CrewBattleNode501').storms[0].tier, 1);
  const daily = stormObservation({ last_updated: new Date(start).toISOString(), data: [{ node: '甲（土星）', tierNum: 1, type: '旧类型', activation: start, expiry: start + 5400000, isStorm: true }] }, { server: 'de' });
  const identity = contentIdentity(daily.storms[0], catalog);
  assert.equal(identity.node, 'CrewBattleNode501'); assert.equal(identity.missionType, '前哨战');
  const unknown = contentIdentity({ ...daily.storms[0], node: '甲（地球）' }, catalog);
  assert.equal(unknown.node, null); assert.equal(unknown.missionType, '旧类型');
  assert.equal(contentIdentity({ ...daily.storms[0], missionType: 'MT_SURVIVAL' }, catalog).missionType, '生存');
  assert.equal(contentIdentity({ ...daily.storms[0], missionType: 'MT_UNKNOWN' }, catalog).missionType, null);
  assert.equal(contentIdentity({ ...daily.storms[0], node: '未知译名（土星）', missionType: '遭遇战' }, catalog).missionType, '前哨战');
  assert.equal(contentIdentity({ ...daily.storms[0], tier: null }, catalog), null);
});

test('训练严格按采集时间截断、去重并隔离服务器；未来内容改变不影响旧预测', () => {
  const first = sample(0, 'CrewBattleNode501'), later = sample(3600000, 'CrewBattleNode511'), wg = sample(0, 'CrewBattleNode511', 'wg');
  const options = { server: 'de', at: first.observedAt, catalog };
  assert.deepEqual(fitStormContent([first, later, wg, first], options), fitStormContent([first], options));
  const model = fitStormContent([first, later], { ...options, at: later.observedAt });
  assert.equal(model.sourceRows, 2); assert.equal(model.groups[0].trainingRows, 2);
  assert.equal(model.groups[0].missionCandidates.length, 2);
});

test('回测不泄露目标节点、新增纪元与新增时间组；无候选计未命中', () => {
  const first = sample(0, 'CrewBattleNode501'), second = sample(3600000, 'CrewBattleNode511'), third = sample(7200000, 'CrewBattleNode511', 'de', 2);
  const history = [first, second, third], time = backtestVoidStorms(history, { server: 'de' });
  const result = backtestStormContent(history, time, catalog);
  assert.equal(result.nodeTop1.total, 2); assert.equal(result.nodeTop1.hits, 0);
  assert.equal(result.nodeTop3.hits, 0); assert.equal(result.missionTop1.hits, 0);
  assert.equal(result.unavailableRows, 1); assert.equal(result.evaluations[0].trainingRows, 1);
  assert.equal(result.evaluations[1].groupRows, 0);
  const empty = backtestStormContent([first], backtestVoidStorms([first], { server: 'de' }), catalog);
  assert.equal(empty.nodeTop1.rate, null);
  const forecast = forecastStormContent(forecastVoidStorms(first), history, catalog);
  assert.ok(forecast.entries.every(entry => entry.contentCandidates[0].trainingRows === 1));
});

test('节点前三与类型首选分开核验，不把候选的静态类型查表当作预测准确率', () => {
  const a = sample(0, 'CrewBattleNode501'), b = sample(3600000, 'CrewBattleNode511'), c = sample(7200000, 'CrewBattleNode511');
  const result = backtestStormContent([a, b, c], backtestVoidStorms([a, b, c], { server: 'de' }), catalog);
  assert.equal(result.nodeTop1.hits, 0); assert.equal(result.nodeTop3.hits, 1);
  assert.equal(result.missionTop1.total, 2);
  assert.ok(result.evaluations.every(row => row.leadHours > 0 && row.leadHours < 24));
});

test('真实104份快照有内容与字典来源哈希；回测分母及命中可复算', async () => {
  const history = JSON.parse(gunzipSync(await fs.readFile(new URL('../src/data/void-storm-history.json.gz', import.meta.url))));
  assert.equal(history.schemaVersion, 2); assert.equal(history.samples.length, 104);
  assert.equal(history.catalog.provenance.length, 4);
  assert.ok(history.catalog.provenance.every(row => /^[a-f0-9]{64}$/.test(row.hash)));
  assert.equal(history.samples.flatMap(row => row.storms).length, 1112);
  for (const server of ['de', 'wg']) {
    const time = backtestVoidStorms(history.samples, { server });
    const result = backtestStormContent(history.samples, time, history.catalog);
    const expected = server === 'de' ? [76, 226, 208, 450] : [101, 328, 268, 476];
    assert.deepEqual([result.nodeTop1.hits, result.nodeTop3.hits, result.missionTop1.hits, result.nodeTop1.total], expected);
    assert.equal(result.bands.reduce((sum, band) => sum + band.nodeTop1.total, 0), result.nodeTop1.total);
  }
});
