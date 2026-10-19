import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import lzma from 'lzma';
import { Store, changesBetween } from '../src/core/store.mjs';
import { runUpdate, rollback, parseIndex } from '../src/core/updater.mjs';
import { blobSha1, withLock } from '../src/core/io.mjs';

const compressed = text => new Promise((resolve, reject) => lzma.compress(text, 1, (result, error) => error ? reject(error) : resolve(Buffer.from(result))));
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'wb-update-')); t.after(() => fs.rm(root, { recursive: true, force: true }));
  let revision = 1, bad = false; let downloads = 0;
  const index = await compressed('ExportWarframes_zh.json!version1\n');
  const config = { concurrency: 2, languages: ['zh'], sources: [{ id: 'official', kind: 'official', label: 'Official', enabled: true }, { id: 'plus', label: 'Plus', kind: 'github', repository: 'fixture/repo', branch: 'main', enabled: true }] };
  const get = async url => {
    if (url.includes('index_zh')) return index;
    if (url.includes('/Manifest/')) return Buffer.from('{"ExportWarframes":[]}');
    const content = Buffer.from(JSON.stringify({ value: revision }));
    if (url.includes('/commits/')) return Buffer.from(JSON.stringify({ sha: String(revision).repeat(40) }));
    if (url.includes('/git/trees/')) return Buffer.from(JSON.stringify({ tree: [{ path: 'data.json', mode: '100644', type: 'blob', sha: blobSha1(content), size: content.length }, { path: 'data/img/a.png', mode: '100644', type: 'blob' }] }));
    if (url.includes('raw.githubusercontent.com')) { downloads++; if (bad) throw new Error('fixture network failure'); return content; }
    throw new Error('unexpected url ' + url);
  };
  return { root, config, get, setRevision: x => revision = x, fail: () => bad = true, recover: () => bad = false, downloads: () => downloads };
}
test('官方不变、Plus 单独变化能发布；重复检查不重下文件；支持回滚', async t => {
  const f = await fixture(t); const options = { storeRoot: f.root, config: f.config, get: f.get }; const store = new Store(f.root);
  const first = await runUpdate(options); assert.equal(first.changes.length, 2);
  const second = await runUpdate(options); assert.equal(second.changed, false); assert.equal(f.downloads(), 1);
  f.setRevision(2); const third = await runUpdate(options); assert.equal(third.changed, true); assert.equal(third.changes.length, 1); assert.equal(third.changes[0].source, 'plus');
  assert.equal(Object.keys((await store.current()).sources.plus.files).length, 1);
  await rollback({ storeRoot: f.root, releaseId: first.releaseId }); assert.equal((await store.current()).id, first.releaseId);
  assert.equal((await store.history()).length, 2);
});
test('失败保留完整旧版、连续同错只记录一次故障事件', async t => {
  const f = await fixture(t); const options = { storeRoot: f.root, config: f.config, get: f.get }; const store = new Store(f.root);
  const first = await runUpdate(options); f.setRevision(2); f.fail();
  await assert.rejects(runUpdate(options), /network failure/); await assert.rejects(runUpdate(options), /network failure/);
  assert.equal((await store.current()).id, first.releaseId); assert.equal((await store.status()).attempts, 2);
  const events = (await fs.readFile(path.join(f.root, 'events.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse); assert.equal(events.filter(x => x.type === 'update-failed').length, 1);
  f.recover(); await runUpdate(options);
  assert.equal((await store.status()).state, 'ok');
  const recovered = (await fs.readFile(path.join(f.root, 'events.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse);
  assert.equal(recovered.at(-1).type, 'recovered');
});
test('已有本地基线按 Git blob 校验复用', async t => {
  const f = await fixture(t); const store = new Store(f.root);
  const local = await store.put(Buffer.from('{"value":1}'));
  await store.publish({ plus: { kind: 'github', version: 'local:baseline', files: { 'data.json': { ...local, origin: 'local-import' } } } });
  const result = await runUpdate({ storeRoot: f.root, config: f.config, get: f.get });
  assert.equal(f.downloads(), 0); assert.equal(result.changes.filter(x => x.source === 'plus').length, 0);
  const current = await store.current(); assert.ok(current.sources.plus.files['data.json'].upstreamBlob);
});
test('缓存对象损坏不能被指向，锁阻止并发发布', async t => {
  const f = await fixture(t); const store = new Store(f.root); const entry = await store.put(Buffer.from('{}'));
  await fs.writeFile(store.objectPath(entry.hash), 'broken');
  await assert.rejects(store.publish({ a: { files: { 'x.json': entry } } }), /完整性/);
  assert.equal(await store.current(), null);
  await withLock(f.root, () => assert.rejects(withLock(f.root, async () => {}), /正在运行/));
});
test('索引拒绝路径注入与重复；变更包含删除', () => {
  assert.throws(() => parseIndex('../evil.json!v'), /无效/); assert.throws(() => parseIndex('ExportA.json!a\nExportA.json!b'), /重复/);
  assert.deepEqual(changesBetween({ sources: { plus: { files: { 'a.json': { hash: 'a' } } } } }, { sources: {} }).map(x => x.kind), ['removed']);
});
