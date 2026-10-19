import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { crc32, invigorations, arbitrations, warframePool } from '../src/core/oracle.mjs';
const warframes = JSON.parse(await readFile(new URL('../世界状态上游/git/warframe-public-export-plus/ExportWarframes.json', import.meta.url)));
const schedule = await readFile(new URL('../世界状态上游/git/browse.wf/arbys.txt', import.meta.url), 'utf8');
const args = { username: 'WorkbenchTest', at: Date.parse('2026-10-19T12:00:00Z') };
test('与独立 Python float32 / CRC32 参考向量逐项一致', async () => {
  const vectors = JSON.parse(await readFile(new URL('fixtures/oracle-vectors.json', import.meta.url)));
  for (const vector of vectors.cases) {
    const result = invigorations({ username: vector.username, at: (1391990400 + vector.week * 604800) * 1000, observedSuitTypes: vector.observed }, warframes);
    assert.deepEqual(result.offers.map(x => x.suit.key), vector.suits);
    assert.deepEqual(result.offers.map(x => x.offensive.key), vector.offensive);
    assert.deepEqual(result.offers.map(x => x.defensive.key), vector.defensive);
  }
});
test('CRC32 标准向量与大小写、跨平台后缀处理', () => {
  assert.equal(crc32('123456789'), 0xcbf43926); assert.notEqual(crc32('Test'), crc32('test'));
  assert.deepEqual(invigorations({ ...args, username: 'WorkbenchTest#123' }, warframes), invigorations(args, warframes));
});
test('活化周边界、历史排除、三个组合不重复、输入校验', () => {
  const first = invigorations(args, warframes); assert.equal(first.weekIndex, 662); assert.equal(first.startsAt, '2026-10-19T00:00:00.000Z'); assert.equal(first.confidence, 'conditional');
  const boundary = Date.parse(first.endsAt); assert.equal(invigorations({ ...args, at: boundary - 1 }, warframes).weekIndex, 662); assert.equal(invigorations({ ...args, at: boundary }, warframes).weekIndex, 663);
  assert.deepEqual(invigorations({ ...args, target: 'next' }, warframes).offers, invigorations({ ...args, at: boundary }, warframes).offers);
  const observed = first.offers.map(x => x.suit.key); const next = invigorations({ ...args, observedSuitTypes: observed }, warframes);
  assert.equal(next.confidence, 'exact-assuming-inputs'); assert.ok(next.offers.every(x => !observed.includes(x.suit.key))); assert.equal(new Set(next.offers.map(x => x.suit.key)).size, 3);
  assert.throws(() => invigorations({ ...args, observedSuitTypes: [observed[0], observed[0]] }, warframes));
  assert.throws(() => invigorations({ ...args, at: NaN }, warframes));
});
test('特殊战甲出现时不选能量属性', () => {
  let special = false;
  for (let i = 0; i < 80; i++) { const result = invigorations({ ...args, username: `Test${i}` }, warframes); if (result.offers.some(x => /\/(IronFrame|Alchemist)\//.test(x.suit.key))) { special = true; assert.ok(result.offers.every(x => !/UtilityInvigorationEnergy(?:Regen)?$/.test(x.defensive.key))); } }
  assert.equal(special, true);
});
test('仲裁 UTC 整点、排期首尾与不连续输入', () => {
  const result = arbitrations(schedule, { at: args.at + 3599000, count: 2 }); assert.equal(result.entries[0].node, 'SolNode212'); assert.equal(result.entries[1].node, 'SolNode195');
  assert.equal(result.entries[0].startsAt, '2026-10-19T12:00:00.000Z');
  const end = Date.parse(result.coverage.endsAt); assert.equal(arbitrations(schedule, { at: end - 1 }).truncated, true);
  assert.throws(() => arbitrations(schedule, { at: end }), /覆盖范围/); assert.throws(() => arbitrations('3600,A\n10800,B', { at: 3600000 }), /不连续/);
});
