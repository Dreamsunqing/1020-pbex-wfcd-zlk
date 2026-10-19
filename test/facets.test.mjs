import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyFile, facetCounts, matchesFacets } from '../src/core/facets.mjs';
import { scanLibrary, snapshotFiles } from '../src/core/library.mjs';

test('文件分类：字典、语言、基础数据、复合类别和索引', () => {
  for (const [file, source] of [['dict.zh.json', 'plus'], ['dicts/zh.json', 'oracle'], ['data/json/i18n/zh.json', 'wfcd']]) {
    assert.deepEqual(classifyFile(file, source), { kind: ['dictionary'], language: ['zh'], category: ['mixed'] });
  }
  assert.deepEqual(classifyFile('manifests/tc/ExportWeapons_tc.json', 'official'), { kind: ['data'], language: ['tc'], category: ['weapons'] });
  assert.deepEqual(classifyFile('data/json/SentinelWeapons.json', 'wfcd'), { kind: ['data'], language: ['en'], category: ['weapons', 'companions'] });
  assert.equal(classifyFile('ExportWeapons.json', 'plus').language[0], 'neutral');
  assert.deepEqual(classifyFile('manifests/zh/ExportManifest.json', 'official'), { kind: ['index'], language: ['neutral'], category: ['images'] });
  assert.equal(classifyFile('data/cache/.export.json', 'wfcd').kind[0], 'index');
  assert.equal(classifyFile('config/damageTypes.json', 'wfcd').kind[0], 'config');
  assert.equal(classifyFile('package-lock.json', 'plus').kind[0], 'config');
  assert.deepEqual(classifyFile('new-file.json'), { kind: ['data'], language: ['unknown'], category: ['unknown'] });
});

test('实际 JSON 多选：同维或、跨维且；计数不限制当前维度', async () => {
  const { files } = await scanLibrary('.'); const json = files.filter(file => file.format === 'json');
  const selected = { source: new Set(['official', 'wfcd']), kind: new Set(['data']), language: new Set(['zh', 'en']), category: new Set(['weapons', 'warframes']) };
  const matches = json.filter(file => matchesFacets(file, selected));
  assert.equal(matches.length, 11); // official zh/en × weapons/warframes + WFCD six weapon families & Warframes.
  assert.ok(matches.some(file => file.name === 'ExportWeapons_zh.json'));
  assert.ok(matches.some(file => file.name === 'Warframes.json'));
  assert.ok(!matches.some(file => file.name === 'Pets.json' || file.name === 'dict.zh.json'));
  const counts = facetCounts(json, selected, 'category');
  assert.ok(counts.get('companions') > 0); assert.ok(counts.get('resources') > 0);
  selected.category = new Set(['weapons']);
  assert.ok(json.filter(file => matchesFacets(file, selected)).length < matches.length);
  selected.kind = new Set(['dictionary']); assert.equal(json.filter(file => matchesFacets(file, selected)).length, 0);
  for (const values of Object.values(selected)) values.clear(); assert.equal(json.filter(file => matchesFacets(file, selected)).length, 403);
});

test('本地与历史快照按同一相对文件路径标记，不改写原快照', async () => {
  const local = await scanLibrary('.');
  const release = { sources: { plus: { label: 'Public Export Plus', files: { 'dict.zh.json': { size: 1, hash: 'original' }, 'ExportWeapons.json': { size: 2, hash: 'original2' } } } } };
  const before = JSON.stringify(release); const snapshot = await snapshotFiles(null, release);
  for (const file of snapshot) assert.deepEqual(file.facets, local.files.find(item => item.source === 'plus' && item.name === file.name).facets);
  assert.equal(JSON.stringify(release), before);
});
