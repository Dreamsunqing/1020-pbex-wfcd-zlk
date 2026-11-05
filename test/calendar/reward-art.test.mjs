import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { storeItemId as contractStoreItemId } from '../../src/core/merge/contract.mjs';
import { storeItemId } from '../../src/core/merge/store-item-id.mjs';
import { REWARD_ART_ROOT, indexRewardArt, rewardArtKey, rewardArtPathIssue } from '../../src/ui/calendar-1999-art.js';
import REWARD_ART from '../../src/ui/assets/calendar-1999/reward-art.js';
import { ASSET_ROOT, MAPPING_FILE, checkCalendarRewardArt, describeRewardArtCheck, writtenKeys } from '../../scripts/check-calendar-reward-art.mjs';

// Reward art mapping of the 1999 calendar (CAL-10): the rules the App host applies at runtime, and the check that makes
// the same problems, plus missing and mistyped files, fail `npm run check`. The host's lookup order is tested in
// composition.test.mjs; the picture in the real App by scripts/check-calendar-app-ui.mjs.
const PACK_STORE = '/Lotus/StoreItems/Types/BoosterPacks/CalendarMajorArtifactPack';
const PACK = '/Lotus/Types/BoosterPacks/CalendarMajorArtifactPack';
const PACK_FILE = 'calendar-1999/rewards/CalendarMajorArtifactPack.png';
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');

test('the mapping key reuses the App storeItemId rule, so both spellings of an item are one key', () => {
  assert.equal(contractStoreItemId, storeItemId, 'merge/contract.mjs re-exports the one rule');
  assert.equal(rewardArtKey(PACK_STORE), PACK);
  assert.equal(rewardArtKey(PACK), PACK);
  for (const id of ['/Lotus/Types/StoreItems/Boosters/AffinityBoosterStoreItem', '/Lotus/Other/StoreItems/X']) assert.equal(rewardArtKey(id), storeItemId(id), id);
  assert.equal(rewardArtKey('/Lotus/Types/StoreItems/Boosters/AffinityBoosterStoreItem'), '/Lotus/Types/StoreItems/Boosters/AffinityBoosterStoreItem', 'only the leading segment is rewritten');
  for (const id of [undefined, null, '', 'Forma', '/Test/Reward', '/Lotus/', '/Lotus/Types/With Space', 42]) assert.equal(rewardArtKey(id), null, String(id));
});

test('a mapped path stays inside the App image root, is a safe URL as written, and names a picture type', () => {
  for (const value of [PACK_FILE, 'a.png', 'calendar-1999/rewards/x_y-z.1.jpg', 'x.jpeg', 'x.webp']) assert.equal(rewardArtPathIssue(value), null, value);
  for (const value of ['', '/abs.png', 'calendar-1999//x.png', '../x.png', 'calendar-1999/../x.png', './x.png', '.hidden.png', 'a\\b.png',
    'C:/x.png', 'https://example.com/x.png', 'x.png?v=1', 'x.png#a', 'x%2e.png', '图档.png', 'a b.png', null, 1, ['x.png']]) {
    assert.equal(rewardArtPathIssue(value), 'INVALID_PATH', String(value));
  }
  for (const value of ['x.PNG', 'x.gif', 'x.svg', 'x', 'calendar-1999/rewards']) assert.equal(rewardArtPathIssue(value), 'UNSUPPORTED_TYPE', value);
});

test('indexing keeps valid entries by key with their URL, and reports and leaves out every refused one', () => {
  const ok = indexRewardArt({ [PACK_STORE]: PACK_FILE });
  assert.deepEqual(ok.issues, []);
  const entry = ok.entries.get(PACK);
  assert.deepEqual({ ...entry }, { id: PACK_STORE, key: PACK, path: PACK_FILE, src: new URL(`../../src/ui/assets/${PACK_FILE}`, import.meta.url).href });
  assert.ok(Object.isFrozen(entry));
  const mixed = indexRewardArt({ [PACK_STORE]: PACK_FILE, [PACK]: 'calendar-1999/rewards/Other.png', '/Lotus/Types/Items/MiscItems/Forma': 'x.png', bad: 'x.png', '/Lotus/Types/A': '../x.png' });
  assert.deepEqual([...mixed.entries.keys()], ['/Lotus/Types/Items/MiscItems/Forma']);
  assert.deepEqual(mixed.issues.map(issue => [issue.code, issue.id]), [['INVALID_ID', 'bad'], ['INVALID_PATH', '/Lotus/Types/A'], ['DUPLICATE_ID', PACK_STORE], ['DUPLICATE_ID', PACK]]);
  assert.match(mixed.issues[2].message, /与 \/Lotus\/Types\/BoosterPacks\/CalendarMajorArtifactPack 是同一物品，两笔都不生效/);
  for (const table of [null, undefined, [], 'x', 1]) assert.deepEqual(indexRewardArt(table).issues.map(issue => issue.code), ['INVALID_TABLE'], String(table));
  assert.equal(indexRewardArt({}).entries.size, 0);
});

test('the bundled mapping passes the validation flow, and its first entry is the CalendarMajorArtifactPack picture', async () => {
  const result = await checkCalendarRewardArt();
  assert.deepEqual(result.issues, []);
  assert.equal(result.ok, true);
  assert.deepEqual(result.unused, [], 'every bundled reward picture is mapped');
  assert.equal(result.entries, Object.keys(REWARD_ART).length);
  assert.equal(REWARD_ART[PACK_STORE], PACK_FILE);
  assert.equal(MAPPING_FILE, fileURLToPath(new URL('../../src/ui/assets/calendar-1999/reward-art.js', import.meta.url)));
  assert.equal(path.relative(fileURLToPath(new URL('../../', import.meta.url)), ASSET_ROOT).replaceAll(path.sep, '/') + '/', REWARD_ART_ROOT);
  assert.deepEqual(writtenKeys(await readFile(MAPPING_FILE, 'utf8')), Object.keys(REWARD_ART), 'every key is written once, as a quoted string');
  assert.deepEqual(describeRewardArtCheck(result).at(-1), `1999 日历奖励图片映射检查通过：${result.entries} 笔`);
});

test('the validation flow fails on duplicates, invalid paths, missing or mistyped files, letter case and unreadable mappings', async t => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'cal99-reward-art-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const assets = path.join(dir, 'assets');
  await mkdir(path.join(assets, 'calendar-1999/rewards'), { recursive: true });
  await writeFile(path.join(assets, 'calendar-1999/rewards/Pack.png'), PNG);
  await writeFile(path.join(assets, 'calendar-1999/rewards/Text.png'), 'not a picture');
  await writeFile(path.join(assets, 'calendar-1999/rewards/Unused.webp'), 'RIFF\0\0\0\0WEBP');
  let files = 0;
  const check = async source => {
    const file = path.join(dir, `mapping-${++files}.js`);
    await writeFile(file, source);
    return checkCalendarRewardArt({ file, assets });
  };
  const codes = result => result.issues.map(issue => [issue.code, issue.id]);

  const good = await check(`export default {\n  // '${PACK}': 'commented out',\n  '${PACK_STORE}': 'calendar-1999/rewards/Pack.png'\n};\n`);
  assert.deepEqual(good.issues, []);
  assert.deepEqual(good.unused, ['calendar-1999/rewards/Text.png', 'calendar-1999/rewards/Unused.webp'], 'unused pictures are listed without failing');
  assert.equal(good.ok, true);

  const twice = await check(`export default {\n  '${PACK_STORE}': 'calendar-1999/rewards/Pack.png',\n  '${PACK_STORE}': 'calendar-1999/rewards/Pack.png'\n};\n`);
  assert.deepEqual(codes(twice), [['DUPLICATE_KEY', PACK_STORE]], 'an object literal would hide the first line');
  const spellings = await check(`export default {\n  '${PACK_STORE}': 'calendar-1999/rewards/Pack.png',\n  "${PACK}": 'calendar-1999/rewards/Pack.png'\n};\n`);
  assert.deepEqual(codes(spellings), [['DUPLICATE_ID', PACK_STORE], ['DUPLICATE_ID', PACK]]);
  const paths = await check(`export default {\n  '/Lotus/Types/A': '../outside.png',\n  '/Lotus/Types/B': 'calendar-1999/rewards/Pack.gif',\n  'B': 'calendar-1999/rewards/Pack.png'\n};\n`);
  assert.deepEqual(codes(paths), [['INVALID_PATH', '/Lotus/Types/A'], ['UNSUPPORTED_TYPE', '/Lotus/Types/B'], ['INVALID_ID', 'B']]);
  const files404 = await check(`export default {\n  '/Lotus/Types/A': 'calendar-1999/rewards/Missing.png',\n  '/Lotus/Types/B': 'calendar-1999/rewards',\n  '/Lotus/Types/C': 'calendar-1999/rewards/Text.png',\n  '/Lotus/Types/D': 'calendar-1999/rewards/pack.png'\n};\n`);
  // Rule problems come first, then the file problems in mapping order; a wrong letter case is told apart on every system.
  assert.deepEqual(codes(files404), [['UNSUPPORTED_TYPE', '/Lotus/Types/B'], ['MISSING_FILE', '/Lotus/Types/A'], ['NOT_PICTURE', '/Lotus/Types/C'], ['CASE_MISMATCH', '/Lotus/Types/D']]);
  assert.match(files404.issues.find(issue => issue.code === 'CASE_MISMATCH').message, /「Pack\.png」/);
  assert.match(files404.issues.find(issue => issue.code === 'MISSING_FILE').message, /src\/ui\/assets\/calendar-1999\/rewards\/Missing\.png/);
  const computed = await check(`const key = '${PACK_STORE}';\nexport default { [key]: 'calendar-1999/rewards/Pack.png' };\n`);
  assert.deepEqual(codes(computed), [['UNCHECKED_FORMAT', PACK_STORE]]);
  const notObject = await check(`export default ['${PACK_STORE}'];\n`);
  assert.deepEqual(codes(notObject), [['INVALID_TABLE', null]]);
  const broken = await check(`export default {\n  '${PACK_STORE}': \n`);
  assert.deepEqual(codes(broken), [['MAPPING_UNREADABLE', null]]);
  for (const result of [twice, spellings, paths, files404, computed, notObject, broken]) {
    assert.equal(result.ok, false);
    assert.match(describeRewardArtCheck(result).at(-1), /^1999 日历奖励图片映射检查失败：\d+ 个问题$/);
  }
});

test('npm run check runs the mapping check before anything else can stop it', async () => {
  const check = await readFile(new URL('../../scripts/check.mjs', import.meta.url), 'utf8');
  const art = check.indexOf("import('./check-calendar-reward-art.mjs')"), tokens = check.indexOf("import('./prepare-inline-tokens.mjs')");
  assert.ok(art > 0 && art < tokens, 'the reward art check runs before the inline token check');
  assert.match(check, /if \(!art\.ok\) process\.exit\(1\);/);
  const pkg = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.scripts['check:calendar-art'], 'node scripts/check-calendar-reward-art.mjs');
  assert.ok(pkg.build.files.includes('src/**/*'), 'the mapping and its pictures are packaged with the App source');
});
