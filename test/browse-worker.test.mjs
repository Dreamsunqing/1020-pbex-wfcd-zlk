import test from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { Store } from '../src/core/store.mjs';

test('桌面后台在历史快照与本地目录间读取各自规则和排期，响应带版本 ID', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'wb-browse-worker-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const storeRoot = path.join(root, 'snapshots'), store = new Store(storeRoot);
  const original = await fs.readFile(new URL('../世界状态上游/git/browse.wf/live.ts', import.meta.url), 'utf8');
  const schedule = await fs.readFile(new URL('../世界状态上游/git/browse.wf/sp-incursions.txt', import.meta.url), 'utf8');
  const publish = async live => store.publish({
    browse: { label: 'Browse', version: 'fixture', files: { 'live.ts': await store.put(Buffer.from(live)), 'sp-incursions.txt': await store.put(Buffer.from(schedule)) } },
    plus: { label: 'Plus', version: 'fixture', files: { 'dict.zh.json': await store.put(Buffer.from('{}')), 'ExportRegions.json': await store.put(Buffer.from('{}')) } }
  });
  const first = await publish(original), second = await publish(original.replace('30,000x Endo', 'Snapshot Endo'));
  const worker = new Worker(new URL('../src/desktop/worker.mjs', import.meta.url), { workerData: { userData: root, storeRoot, defaultRoot: process.cwd() } });
  t.after(() => worker.terminate());
  const pending = new Map(); let serial = 0;
  worker.on('message', message => { const task = pending.get(message.id); if (!task) return; pending.delete(message.id); message.error ? task.reject(new Error(message.error)) : task.resolve(message.result); });
  worker.on('error', error => { for (const task of pending.values()) task.reject(error); pending.clear(); });
  const call = (method, args = {}) => new Promise((resolve, reject) => { const id = ++serial; pending.set(id, { resolve, reject }); worker.postMessage({ id, method, args }); });
  await call('init');
  const args = { at: Date.parse('2026-10-19T12:00Z'), count: 1 };
  await call('snapshot', { id: first.id });
  const before = await call('browseWeekly', args); assert.equal(before.entries[0].teshin.key, '30,000x Endo'); assert.equal(before.dataVersion.releaseId, first.id);
  await call('snapshot', { id: second.id });
  const after = await call('browseWeekly', args); assert.equal(after.entries[0].teshin.key, 'Snapshot Endo'); assert.equal(after.dataVersion.releaseId, second.id); assert.notEqual(after.sourceHash, before.sourceHash);
  const incursions = await call('browseIncursions', args); assert.equal(incursions.dataVersion.releaseId, second.id); assert.equal(incursions.entries[0].nodes.length, 6);
  await call('refresh'); assert.equal((await call('browseWeekly', args)).entries[0].teshin.key, 'Snapshot Endo');
  await call('chooseRoot', { root: process.cwd() });
  const local = await call('browseWeekly', args); assert.equal(local.dataVersion.releaseId, null); assert.equal(local.entries[0].teshin.key, '30,000x Endo');
});
