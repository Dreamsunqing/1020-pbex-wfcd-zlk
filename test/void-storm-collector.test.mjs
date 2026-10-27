import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { VoidStormCollector } from '../src/core/void-storm-collector.mjs';
import { createWorldCatalog } from '../src/core/live-state/catalog.mjs';

const MINUTE = 60000;
const catalog = createWorldCatalog({ plus: { ExportRegions: { CrewBattleNode1: { name: '节点', systemName: '地球比邻星域', missionType: 'MT_RAILJACK', missionName: '/mission' } }, 'dict.zh': { '/mission': '前哨战' } }, fallback: { fissureModifiers: { VoidT1: { value: '古纪' } } } });
async function fixture(t, request) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'storm-collector-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  let at = Date.parse('2026-10-26T01:00:00+08:00'), calls = [];
  const raw = server => ({ Time: at / 1000, VoidStorms: [{ _id: server + '-instance', Node: 'CrewBattleNode1', ActiveMissionTier: 'VoidT1', Activation: at - 30 * MINUTE, Expiry: at + 60 * MINUTE }] });
  const collector = new VoidStormCollector(root, path.join(root, 'result.json'), catalog, { now: () => at, request: async server => { calls.push(server); return request ? request(server, raw) : { raw: raw(server), bytes: 100 }; } });
  return { collector, calls, root, advance: ms => { at += ms; } };
}

test('采集按实际到期时间获取，重复唤醒和重复启动不重复请求或重置七天', async t => {
  const f = await fixture(t);
  await assert.rejects(f.collector.tick(), /尚未初始化/);
  const initial = await f.collector.tick({ start: true });
  assert.equal(Date.parse(initial.endsAt) - Date.parse(initial.startedAt), 168 * 3600000);
  assert.equal(initial.nextFetchAt, '2026-10-25T18:01:00.000Z');
  assert.deepEqual(f.calls, ['de', 'wg']);
  f.advance(MINUTE); await f.collector.tick();
  const again = await f.collector.tick({ start: true });
  assert.equal(again.endsAt, initial.endsAt); assert.equal(f.calls.length, 2);
  f.advance(60 * MINUTE); await f.collector.tick();
  assert.equal(f.calls.length, 4);
  const output = JSON.parse(await fs.readFile(path.join(f.root, 'result.json')));
  assert.equal(output.de.storms.length, 1); assert.equal(output.wg.storms.length, 1);
  assert.equal(output.de.storms[0].节点, '节点（地球）');
});

test('固定截止时间后零请求，完成后再次启动不能自动延长', async t => {
  const f = await fixture(t); const started = await f.collector.tick({ start: true });
  f.advance(7 * 86400000);
  const completed = await f.collector.tick();
  assert.equal(completed.status, 'completed'); assert.equal(completed.nextFetchAt, null); assert.equal(f.calls.length, 2);
  assert.equal((await f.collector.tick({ start: true })).endsAt, started.endsAt); assert.equal(f.calls.length, 2);
});

test('429遵守Retry-After，失败不写入旧样本且不会影响另一服', async t => {
  const f = await fixture(t, async (server, raw) => {
    if (server === 'de') throw Object.assign(new Error('HTTP 429'), { status: 429, retryAfterMs: 30 * MINUTE });
    return { raw: raw(server) };
  });
  const state = await f.collector.tick({ start: true });
  assert.equal(state.servers.de.nextFetchAt, '2026-10-25T17:30:00.000Z');
  assert.equal(state.servers.de.count, 0); assert.equal(state.servers.wg.count, 1);
  f.advance(29 * MINUTE); await f.collector.tick(); assert.equal(f.calls.length, 2);
  f.advance(MINUTE); await f.collector.tick(); assert.deepEqual(f.calls, ['de', 'wg', 'de']);
});

test('手动停止保留结果，再次唤醒或启动不访问接口', async t => {
  const f = await fixture(t); await f.collector.tick({ start: true });
  assert.equal((await f.collector.tick({ stop: true })).status, 'stopped');
  f.advance(120 * MINUTE); assert.equal((await f.collector.tick({ start: true })).status, 'stopped');
  assert.equal(f.calls.length, 2); assert.equal(JSON.parse(await fs.readFile(path.join(f.root, 'result.json'))).de.storms.length, 1);
});

test('上游陈旧不冒充新采样，短暂失败退避5/15/30分钟', async t => {
  const f = await fixture(t, async (server, raw) => ({ raw: { ...raw(server), Time: raw(server).Time - 3600 } }));
  let state = await f.collector.tick({ start: true });
  assert.equal(state.servers.de.successes, 0); assert.equal(state.servers.de.count, 0);
  assert.equal(state.servers.de.nextFetchAt, '2026-10-25T17:05:00.000Z');
  f.advance(5 * MINUTE); state = await f.collector.tick(); assert.equal(state.servers.de.nextFetchAt, '2026-10-25T17:20:00.000Z');
  f.advance(15 * MINUTE); state = await f.collector.tick(); assert.equal(state.servers.de.nextFetchAt, '2026-10-25T17:50:00.000Z');
});
