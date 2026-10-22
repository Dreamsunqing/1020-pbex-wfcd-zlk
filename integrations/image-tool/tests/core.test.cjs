'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { safeFilename, exportFilename, copyWithoutOverwrite, resolveImage, validateIds } = require('../src/core.cjs');
const Search = require('../src/renderer/search.js');

test('Windows filenames handle reserved devices, unsafe characters and Unicode', () => {
  assert.equal(safeFilename('CON'), '_CON');
  assert.equal(safeFilename('Lpt1.txt'), '_Lpt1.txt');
  assert.equal(safeFilename('甲/乙\\丙:*?"<>|. '), '甲_乙_丙_______');
  assert.equal(safeFilename('...'), '未命名图片');
  assert.equal(safeFilename('迅发电浆炮 Prime'), '迅发电浆炮 Prime');
  assert.ok([...safeFilename('𠮷'.repeat(200))].length <= 90);
  assert.equal(exportFilename({ label: 'Ash', englishLabel: 'Ash', imageName: 'Ash.png' }), 'Ash.png');
  assert.equal(exportFilename({ label: '迅发', englishLabel: 'Acceltra', imageName: 'x.png' }), '迅发_Acceltra.png');
});

test('batch export retains original bytes and never replaces an existing file', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'guide-export-'));
  try {
    const source = path.join(directory, 'source.png');
    await fs.writeFile(source, Buffer.from([137, 80, 78, 71, 0, 1, 2]));
    await fs.writeFile(path.join(directory, '中文.png'), 'keep me');
    const destinations = await Promise.all(Array.from({ length: 4 }, () => copyWithoutOverwrite(source, directory, '中文.png')));
    assert.equal(new Set(destinations).size, 4);
    assert.equal(await fs.readFile(path.join(directory, '中文.png'), 'utf8'), 'keep me');
    for (const destination of destinations) assert.deepEqual(await fs.readFile(destination), await fs.readFile(source));
  } finally { await fs.rm(directory, { recursive: true, force: true }); }
});

test('image resolution rejects traversal and invalid item selections', () => {
  for (const imageName of ['../secret.png', '..\\secret.png', '.', '..', '/tmp/image.png']) {
    assert.throws(() => resolveImage('/library', { hasImage: true, imageName }));
  }
  assert.equal(resolveImage('/library', { hasImage: true, imageName: 'Ash.png' }), '/library/img/Ash.png');
  const lookup = new Map([['a', { id: 'a', hasImage: true }], ['b', { id: 'b', hasImage: false }]]);
  assert.equal(validateIds(['a', 'a'], lookup).length, 1);
  assert.throws(() => validateIds(['b'], lookup)); assert.throws(() => validateIds(['missing'], lookup));
});

test('search joins Chinese, English, normalized text and component parent names', () => {
  const items = Search.prepare([
    { id: 'a', name: 'Acceltra Prime', zh: '迅发电浆炮 Prime', label: '迅发电浆炮 Prime', englishLabel: 'Acceltra Prime', hasImage: true, category: 'Primary', parents: [], sources: ['Primary'] },
    { id: 'b', name: 'Barrel', zh: '枪管', label: '枪管', englishLabel: 'Barrel', hasImage: true, category: 'Components', parents: ['a'], sources: ['Components'] },
    { id: 'c', name: 'Missing', zh: '', label: 'Missing', englishLabel: 'Missing', hasImage: false, category: 'Misc', parents: [], sources: ['Misc'] }
  ]);
  assert.deepEqual(Search.filter(items, { query: 'ＡＣＣＥＬＴＲＡ  prime' }).map(i => i.id), ['a', 'b']);
  assert.equal(Search.filter(items, { query: '迅发 枪管' })[0].id, 'b');
  assert.equal(Search.filter(items, { category: 'Components' }).length, 1);
  assert.equal(Search.filter(items, { imageFilter: 'missing' })[0].id, 'c');
  assert.equal(Search.filter(items, { selectedOnly: true, selected: new Set(['b']) })[0].id, 'b');
  assert.equal(Search.filter(items, { query: '<script>' }).length, 0);
});

test('real catalogue has complete image references and usable localization and part links', async () => {
  const root = path.join(__dirname, '../assets/content');
  const catalog = JSON.parse(await fs.readFile(path.join(root, 'catalog.json'), 'utf8'));
  assert.ok(catalog.items.length > 10000);
  assert.match(catalog.meta.commit, /^[a-f0-9]{40}$/);
  const ids = new Set(catalog.items.map(i => i.id)); assert.equal(ids.size, catalog.items.length);
  const files = new Set(await fs.readdir(path.join(root, 'img')));
  for (const item of catalog.items) {
    assert.equal(item.hasImage, files.has(item.assetName), item.id);
    assert.ok(item.parents.every(p => ids.has(p)), item.id);
    assert.ok(item.children.every(c => ids.has(c)), item.id);
    assert.ok(item.label, item.id);
    assert.ok(!/[<>:"/\\|?*\x00-\x1f]/.test(exportFilename(item)), item.id);
  }
  const searchable = Search.prepare(catalog.items);
  const english = Search.filter(searchable, { query: 'acceltra' });
  const chinese = Search.filter(searchable, { query: '迅发电浆炮' });
  assert.ok(english.some(i => i.name === 'Acceltra')); assert.ok(chinese.some(i => i.name === 'Acceltra'));
  assert.ok(catalog.items.some(i => i.category === 'Components' && i.parents.length));
});
