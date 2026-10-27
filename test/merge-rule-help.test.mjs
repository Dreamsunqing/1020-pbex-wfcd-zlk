import test from 'node:test';
import assert from 'node:assert/strict';
import { RULE_HELP } from '../src/core/merge/rule-help.mjs';
import { FULL_CONTRACT, validateRules } from '../src/core/merge/rules.mjs';
import { buildMerged } from '../src/core/merge/build.mjs';
import { mergedDetail } from '../src/core/merge/service.mjs';
import { sha256 } from '../src/core/io.mjs';
import { syncGuide } from '../scripts/sync-merge-rule-help.mjs';

test('合同实际属性全部有选项说明，默认映射与 Markdown 同步', async () => {
  const groups = { general: [FULL_CONTRACT], scope: [FULL_CONTRACT.scope], catalogs: FULL_CONTRACT.catalogs, fields: [...FULL_CONTRACT.fields, { required: true, priority: [] }], nested: FULL_CONTRACT.nested, aliases: FULL_CONTRACT.aliases, overrides: [{ version: 1, entries: [] }, { entityId: '', field: '', expectedSourceHash: '', value: '', reason: '' }] };
  for (const [section, rows] of Object.entries(groups)) for (const key of new Set(rows.flatMap(Object.keys))) {
    const help = RULE_HELP[section][key]; assert.ok(help, `缺少 ${section}.${key} 的说明`);
    assert.equal(help.length, 3); assert.ok(help.every(text => typeof text === 'string' && text.length > 0));
  }
  await syncGuide({ check: true });
});

test('新增标量字段按类型、范围、精度和优先级处理；必需字段只报告缺失', async () => {
  const id = '/Lotus/Test/RuleHelp', contract = structuredClone(FULL_CONTRACT);
  contract.fields.push({ path: 'custom.accuracy', key: 'accuracy', label: '精准度', kinds: ['weapon'], type: 'number', min: 0.25, max: 100, precision: 2, priority: ['plus', 'official', 'wfcd', 'oracle'], required: true });
  const docs = new Map([
    ['plus/ExportWeapons.json', { [id]: { name: 'Sample', accuracy: 12.345, attack: { damage: 999 } } }],
    ['official/manifests/en/ExportWeapons_en.json', { ExportWeapons: [{ uniqueName: id, name: 'Sample', accuracy: 40 }] }],
    ['plus/ExportRewards.json', { '/Lotus/Rewards/Test': [[{ type: id, itemCount: 1 }]] }]
  ]);
  const options = { contract, files: [...docs.keys()].map(id => ({ id, source: id.split('/')[0] })), read: async file => { const bytes = Buffer.from(JSON.stringify(docs.get(file))); return { bytes, hash: sha256(bytes) }; } };
  let data = await buildMerged(options); assert.equal(mergedDetail(data, id).item.custom.accuracy, 12.35);
  docs.get('plus/ExportWeapons.json')[id].accuracy = '12.345';
  data = await buildMerged(options); assert.equal(mergedDetail(data, id).item.custom.accuracy, 40);
  assert.ok(data.output['reports/issues.json'].some(issue => issue.code === 'invalid-value' && issue.field === 'custom.accuracy'));
  docs.get('plus/ExportWeapons.json')[id].accuracy = .1;
  data = await buildMerged(options); assert.equal(mergedDetail(data, id).item.custom.accuracy, 40);
  delete docs.get('plus/ExportWeapons.json')[id].accuracy;
  delete docs.get('official/manifests/en/ExportWeapons_en.json').ExportWeapons[0].accuracy;
  data = await buildMerged(options); assert.equal(mergedDetail(data, id).item.custom?.accuracy, undefined);
  assert.ok(data.output['reports/issues.json'].some(issue => issue.code === 'required-field-missing' && issue.field === 'custom.accuracy'));
  // A dot in key means a literal top-level property; it does not traverse attack.
  contract.fields.at(-1).key = 'attack.damage';
  data = await buildMerged(options); assert.equal(mergedDetail(data, id).item.custom?.accuracy, undefined);
});

test('新增必需字段开关拒绝字符串，避免 false 字符串被当作开启', () => {
  const value = { contract: structuredClone(FULL_CONTRACT), overrides: { version: 1, entries: [] } };
  value.contract.fields[0].required = 'false'; assert.throws(() => validateRules(value), /布尔值/);
  value.contract.fields[0].required = false; assert.equal(validateRules(value).valid, true);
});
