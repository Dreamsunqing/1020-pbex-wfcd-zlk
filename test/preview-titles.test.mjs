import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Worker } from 'node:worker_threads';
import { PreviewTitles, cardFields, resolveTitle } from '../src/core/preview-titles.mjs';
import { preview, scanLibrary, readLibraryFile } from '../src/core/library.mjs';
import { Store } from '../src/core/store.mjs';

const ref = '/Lotus/Language/Test/WeaponName';
test('标题优先原有中文，再按完整路径匹配；描述和图片不作为标题', () => {
  const index = new Map([[ref, { text: '字典译名', file: 'dict.zh.json', pointer: '/key', hash: 'abc' }]]);
  assert.equal(resolveTitle({ name: '原有中文', uniqueName: ref }, '0', '/0', 'items.json', [index]).text, '原有中文');
  const title = resolveTitle({ name: ref }, '0', '/0', 'items.json', [index]);
  assert.equal(title.text, '字典译名'); assert.equal(title.sources[0].file, 'dict.zh.json');
  assert.equal(resolveTitle({}, ref, '/key', 'items.json', [index]).text, '字典译名');
  assert.equal(resolveTitle(ref, 'type', '/type', 'items.json', [index]).text, '字典译名');
  assert.equal(resolveTitle({ name: 'Unknown', description: ref, icon: ref }, '0', '/0', 'x', [index]).status, 'missing');
  assert.equal(resolveTitle({ name: '/Other/WeaponName' }, '0', '/0', 'x', [index]).status, 'missing');
  assert.deepEqual(cardFields({ name: 'A', img: 'x', icon: 'y', imageName: 'z', wikiaThumbnail: 'url', enabled: false, value: null }).fields.map(x => x.key), ['name', 'enabled', 'value']);
});

test('实际字典兼容 Plus 引用和 WFCD 物品路径，中文搜索先匹配后分页且不改变原始对象', async () => {
  const library = await scanLibrary('.'), titles = new PreviewTitles();
  const file = library.files.find(file => file.id.endsWith('/ExportWeapons.json') && file.source === 'plus');
  const text = (await readLibraryFile(library.root, file.id)).bytes.toString('utf8'), value = JSON.parse(text);
  const loaded = await titles.load(library.files, id => readLibraryFile(library.root, id), 'plus');
  assert.equal(loaded.warnings.length, 0);
  const page = preview(value, { titleFor: (item, key, at) => loaded.resolve(item, key, at, file.id), fieldsFor: cardFields });
  assert.equal(page.rows[0].title.status, 'dictionary');
  assert.ok(page.rows[0].title.sources[0].file.endsWith('dict.zh.json'));
  const query = page.rows[0].title.text;
  const filtered = preview(value, { query, limit: 1, titleFor: (item, key, at) => loaded.resolve(item, key, at, file.id) });
  assert.equal(filtered.rows[0].title.text, query);
  assert.equal(JSON.stringify(value), JSON.stringify(JSON.parse(text)));
  const wfcd = await titles.load(library.files, id => readLibraryFile(library.root, id), 'wfcd');
  const item = JSON.parse(await fs.readFile(path.join(library.root, 'wfcd-items/data/json/Primary.json'), 'utf8'))[0];
  const title = wfcd.resolve(item, '0', '/0', 'Primary.json');
  assert.equal(title.text, '迅发电浆炮'); assert.ok(title.sources[0].file.endsWith('i18n/zh.json'));
});

test('桌面预览字典变动立即生效、坏字典降级，快照字典隔离且原文和导出不变', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'wb-title-worker-')); t.after(() => fs.rm(root, { recursive: true, force: true }));
  const local = path.join(root, 'local'), userData = path.join(root, 'user'), storeRoot = path.join(root, 'store');
  await fs.mkdir(path.join(local, 'dicts'), { recursive: true });
  const original = '[\n  {"name":"/Lotus/Language/Test/WeaponName","icon":"https://example.invalid/a.png"}\n]\n';
  await fs.writeFile(path.join(local, 'items.json'), original);
  const dictFile = path.join(local, 'dicts/zh.json'); await fs.writeFile(dictFile, JSON.stringify({ [ref]: '本地甲' }));
  const worker = new Worker(new URL('../src/desktop/worker.mjs', import.meta.url), { workerData: { userData, storeRoot, defaultRoot: local } }); t.after(() => worker.terminate());
  let serial = 0; const pending = new Map();
  worker.on('message', msg => { const task = pending.get(msg.id); if (task) { pending.delete(msg.id); msg.error ? task.reject(new Error(msg.error)) : task.resolve(msg.result); } });
  worker.on('error', error => { for (const task of pending.values()) task.reject(error); pending.clear(); });
  const call = (method, args = {}) => new Promise((resolve, reject) => { const id = ++serial; pending.set(id, { resolve, reject }); worker.postMessage({ id, method, args }); });
  await call('init');
  assert.equal((await call('page', { id: 'items.json' })).rows[0].title.text, '本地甲');
  await fs.writeFile(dictFile, JSON.stringify({ [ref]: '本地乙' }));
  const updated = await call('page', { id: 'items.json', query: '本地乙' }); assert.equal(updated.rows.length, 1); assert.equal(updated.rows[0].title.text, '本地乙');
  assert.equal((await call('raw', { id: 'items.json' })).text, original); assert.equal((await call('export', { id: 'items.json' })).text, original);
  const store = new Store(storeRoot);
  const release = await store.publish({ plus: { label: 'Plus', version: 'fixture', files: { 'items.json': await store.put(Buffer.from(original)), 'dict.zh.json': await store.put(Buffer.from(JSON.stringify({ [ref]: '快照甲' }))) } } });
  await call('snapshot', { id: release.id });
  assert.equal((await call('page', { id: 'plus/items.json' })).rows[0].title.text, '快照甲');
  await call('chooseRoot', { root: local }); assert.equal((await call('page', { id: 'items.json' })).rows[0].title.text, '本地乙');
  await fs.writeFile(dictFile, '{broken'); const broken = await call('page', { id: 'items.json' });
  assert.equal(broken.rows[0].title.status, 'missing'); assert.match(broken.warnings[0], /中文字典不可用/);
  assert.equal(await fs.readFile(path.join(local, 'items.json'), 'utf8'), original);
});
