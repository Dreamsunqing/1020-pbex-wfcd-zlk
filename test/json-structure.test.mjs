import test from 'node:test';
import assert from 'node:assert/strict';
import { scanStructure, sliceStructure, recordDetail } from '../src/core/json-structure.mjs';
import { describeField, displayMeaning } from '../src/core/field-guide.mjs';

test('扫描全量记录并合并重复结构；保留稀有字段、混合类型、空容器及伤害分量', () => {
  const value = Array.from({ length: 201 }, (_, i) => ({ name: `item${i}`, damage: { impact: 1, slash: 2 }, effects: i % 2 ? [] : [{ value: null }] }));
  value[200].rare = { nested: true }; value[100].damage.impact = 'variable';
  const original = JSON.stringify(value), structure = scanStructure(value);
  const impact = structure.rows.find(row => row.key === 'impact');
  assert.deepEqual(impact.types, ['number', 'string']); assert.equal(impact.seen, 201);
  assert.equal(structure.rows.filter(row => row.key === 'name').length, 1);
  assert.equal(structure.rows.find(row => row.key === 'rare').seen, 1);
  assert.ok(structure.rows.some(row => row.key === 'nested'));
  assert.ok(structure.rows.some(row => row.key === 'slash'));
  assert.equal(sliceStructure(structure, { query: 'rare' }).rows.length, 2);
  assert.equal(JSON.stringify(value), original);
});

test('数字键及路径字典只保留一个结构，但所有不同子字段参与合并', () => {
  const value = { obj: { 1: { a: 1 }, 2: { a: 2, extra: 'only second' }, 3: { b: false } }, dict: { '/Lotus/A': '甲', '/Lotus/B': '乙' } };
  const structure = scanStructure(value);
  assert.equal(structure.rows.filter(row => row.key === '{key}').length, 2);
  assert.ok(structure.rows.some(row => row.path === '$["obj"]{key}["extra"]'));
  assert.equal(structure.rows.find(row => row.path === '$["dict"]{key}').seen, 2);
  assert.ok(!structure.rows.some(row => row.key === '/Lotus/A'));
  assert.equal(recordDetail(value, { pointer: '/dict' }).rows.length, 2);
  const mixedDictionary = scanStructure({ '/Lotus/A': { name: '甲' }, '/Weapons/B': { description: '乙' }, ClanNode1: { systemName: '丙' } });
  assert.equal(mixedDictionary.rows.filter(row => row.key === '{key}').length, 1);
  assert.equal(mixedDictionary.rows.find(row => row.key === '{key}').seen, 3);
  assert.ok(mixedDictionary.rows.some(row => row.key === 'description'));
});

test('详情保留长文本、图片引用及每个字段，支持分页和中文字段搜索', () => {
  const value = [{ description: '长'.repeat(250000), icon: 'https://example.invalid/p.png', criticalChance: 0.32, omegaAttenuation: 0.65, patchlogs: [{ changes: '内容' }] }];
  const detail = recordDetail(value, { pointer: '/0' });
  assert.equal(detail.rows[0].value.length, 250000);
  assert.equal(detail.rows[1].value, value[0].icon);
  assert.equal(detail.rows[2].meaning, '32%');
  assert.equal(recordDetail(value, { pointer: '/0', query: '紫卡' }).rows[0].key, 'omegaAttenuation');
  assert.equal(recordDetail(value, { pointer: '/0', limit: 2 }).hasMore, true);
  assert.equal(recordDetail(value, { pointer: '/0', offset: 4 }).rows[0].key, 'patchlogs');
  assert.equal(recordDetail(value, { pointer: '/0/patchlogs/0/changes' }).value, '内容');
});

test('上下文区分能量配色与容量、紫卡系数与档位、比例与百分数；未知含义不猜测', () => {
  assert.equal(describeField('power', '/0/power').label, '能量容量');
  assert.equal(describeField('energy', '/0/color/energy').label, '能量配色');
  assert.equal(describeField('energy', '$[]["color"]["energy"]').label, '能量配色');
  assert.equal(displayMeaning(17, describeField('crit_chance')), '17%');
  assert.equal(displayMeaning(0.31999999, describeField('criticalChance')), '32%');
  assert.equal(describeField('omegaAttenuation').label, '紫卡系数');
  assert.equal(describeField('disposition').label, '紫卡倾向评级');
  assert.equal(describeField('mystery').status, 'unknown');
  assert.equal(describeField('name', '/0/patchlogs/0/name').label, '更新版本名称');
});

test('原始键和指针支持转义、原型同名键；空根节点及分页参数受控', () => {
  const value = JSON.parse('{"a/b":{"~":3},"__proto__":{"name":"原型键"},"constructor":false}');
  const structure = scanStructure(value);
  const row = structure.rows.find(row => row.key === '~');
  assert.equal(row.pointer, '/a~1b/~0'); assert.equal(recordDetail(value, { pointer: row.pointer }).value, 3);
  assert.ok(structure.rows.some(row => row.key === '__proto__'));
  assert.equal(scanStructure({}).rows[0].empty, 1);
  assert.deepEqual(scanStructure(null).rows[0].types, ['null']);
  assert.throws(() => sliceStructure(structure, { offset: -1 }), /无效/);
  assert.throws(() => recordDetail(value, { query: 'x'.repeat(501) }), /无效/);
});
