import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createWorldStateCalendarSource } from '../../src/features/calendar-1999/index.mjs';
import { validateCalendarDocument } from '../../src/features/calendar-1999/application/contract-validation.mjs';
import { createWorldCatalog } from '../../src/core/live-state/catalog.mjs';
import { buildWorldView } from '../../src/core/live-state/view.mjs';

// Contract tests for the world-state adapter (CAL-04). The fixture is a trimmed host projection of the DE sample;
// no upstream catalog is needed except in the last test, which runs the real projection on a small raw state.
const projection = () => JSON.parse(readFileSync(new URL('./fixtures/world-state/projection-de.json', import.meta.url), 'utf8'));
const calendarModule = view => view.modules.find(module => module.id === 'calendar');
const read = view => createWorldStateCalendarSource(view).read();
const FORMA = '/Lotus/StoreItems/Types/Items/MiscItems/Forma';
const SHARD = '/Lotus/StoreItems/Types/Gameplay/NarmerSorties/ArchonCrystalOrange';

test('a projection becomes a valid document with season windows and annual days, ignoring other modules', () => {
  const document = read(projection());
  assert.deepEqual(validateCalendarDocument(document).issues, []);
  assert.deepEqual(document.data, { server: 'de', kind: 'sample', stale: true, sourceTime: '2026-10-22T19:32:27.000Z' });
  assert.equal(document.seasons.length, 1);
  const { entries, ...season } = document.seasons[0];
  assert.deepEqual(season, {
    code: 'CST_WINTER', label: '冬季', yearIteration: 24,
    startsAt: '2026-10-19T00:00:00.000Z', endsAt: '2026-10-26T00:00:00.000Z', listedDays: [1, 3, 19, 20, 45]
  });
  assert.deepEqual(entries.map(entry => [entry.ordinal, entry.kind, entry.title]), [[3, 'challenge', '游戏日 3'], [19, 'reward', '游戏日 19'], [20, 'upgrade', '游戏日 20']]);
  // Days 1 and 45 are listed without events: they stay listed, and no entry is invented for them.
  assert.ok(!entries.some(entry => [1, 45].includes(entry.ordinal)));
  assert.ok(!JSON.stringify(document).includes('不应进入日历'));
});

test('the document carries contract fields only, so inner layers never read world-state fields', () => {
  const document = read(projection());
  assert.deepEqual(Object.keys(document).sort(), ['contextId', 'data', 'seasons']);
  assert.deepEqual(Object.keys(document.seasons[0]).sort(), ['code', 'endsAt', 'entries', 'label', 'listedDays', 'startsAt', 'yearIteration']);
  for (const entry of document.seasons[0].entries) {
    assert.deepEqual(Object.keys(entry).sort(), ['evidence', 'kind', 'ordinal', 'rewards', 'terms', 'title']);
    for (const reward of entry.rewards) assert.deepEqual(Object.keys(reward).sort(), ['id', 'libraryId', 'libraryVersion', 'name', 'quantity']);
    for (const term of entry.terms) assert.deepEqual(Object.keys(term).sort(), ['description', 'key', 'name', 'source']);
  }
});

test('rewards keep the full upstream ID next to the library link and its dataset version', () => {
  const [, rewardDay] = read(projection()).seasons[0].entries;
  // id is the catalog's full ID; without a store alias it stays the upstream store path. libraryId is resolved
  // separately by reward-art.mjs. Usually both are equal, but neither is ever derived from the other.
  assert.deepEqual(rewardDay.rewards, [
    { id: FORMA, name: '佛玛', quantity: 1, libraryId: '/Lotus/Types/Items/MiscItems/Forma', libraryVersion: 'fixture-library-v1' },
    { id: SHARD, name: 'ArchonCrystalOrange', quantity: 1, libraryId: null, libraryVersion: null }
  ]);
});

test('Chinese text, upstream keys and translation sources are kept, and evidence equals the projected reference', () => {
  const view = projection();
  const [challenge, , upgrade] = read(view).seasons[0].entries;
  assert.deepEqual(upgrade.terms.map(term => [term.name, term.key, term.source]), [
    ['毒气射击', '/Lotus/Upgrades/Calendar/GasChanceToPrimaryAndSecondary', 'wfcd-calendar-project-translation'],
    ['力量增长', '/Lotus/Upgrades/Calendar/AbilityStrength', 'wfcd-calendar-project-translation'],
    ['瓶中闪电', '/Lotus/Upgrades/Calendar/ElectricStatusDamageAndChance', 'wfcd-calendar-project-translation']
  ]);
  assert.equal(upgrade.terms[1].description, '技能强度 +25%。');
  assert.deepEqual(challenge.terms, [{ name: '近战击杀', key: '/Lotus/Types/Challenges/Calendar1999/CalendarKillEnemiesWithMeleeMedium',
    source: 'plus/dict.zh', description: '使用近战武器击杀 150 名敌人' }]);
  calendarModule(view).entries.forEach((entry, index) => assert.deepEqual(read(view).seasons[0].entries[index].evidence, entry.reference));
});

test('the projection is never mutated, and every read returns an equal but independent copy', () => {
  const view = projection();
  const before = structuredClone(view);
  const source = createWorldStateCalendarSource(view);
  assert.ok(Object.isFrozen(source));
  const first = source.read();
  first.seasons[0].entries[0].evidence.events.length = 0;
  first.seasons[0].entries[1].rewards[0].id = '/Changed';
  first.seasons[0].listedDays.push(365);
  first.data.stale = false;
  assert.deepEqual(view, before);
  assert.deepEqual(source.read(), read(before));
  assert.notEqual(source.read(), source.read());
  // The source is a snapshot: later changes to the projection do not reach it.
  calendarModule(view).entries[0].title = '已修改';
  calendarModule(view).entries[0].reference.events.length = 0;
  calendarModule(view).calendarSeasons[0].listedDays.length = 0;
  const later = source.read();
  assert.deepEqual([later.seasons[0].entries[0].title, later.seasons[0].entries[0].evidence.events.length, later.seasons[0].listedDays.length], ['游戏日 3', 1, 5]);
});

test('missing optional values stay missing instead of becoming zero, links or invented events', () => {
  const view = projection();
  const [challenge, rewardDay, upgrade] = calendarModule(view).entries;
  delete rewardDay.rewards[0].quantity;
  rewardDay.rewards[1].quantity = '2';
  delete upgrade.terms[0].description;
  delete upgrade.terms[1].source;
  challenge.terms[0].name = '';
  const [mappedChallenge, mappedRewards, mappedUpgrade] = read(view).seasons[0].entries;
  assert.deepEqual(mappedRewards.rewards.map(reward => reward.quantity), [null, null]);
  assert.equal('description' in mappedUpgrade.terms[0], false);
  assert.equal(mappedUpgrade.terms[1].source, null);
  // A term without a name shows its upstream key as written, never an invented label.
  assert.equal(mappedChallenge.terms[0].name, '/Lotus/Types/Challenges/Calendar1999/CalendarKillEnemiesWithMeleeMedium');

  const withoutCalendar = projection();
  withoutCalendar.modules = withoutCalendar.modules.filter(module => module.id !== 'calendar');
  assert.deepEqual(read(withoutCalendar).seasons, []);
  const withoutEvents = projection();
  calendarModule(withoutEvents).entries = [];
  assert.deepEqual(read(withoutEvents).seasons[0].entries, []);
  assert.deepEqual(read(withoutEvents).seasons[0].listedDays, [1, 3, 19, 20, 45]);
});

test('unknown kinds, out-of-range days and missing days are kept for the unmapped list', () => {
  const view = projection();
  const [challenge, rewardDay, upgrade] = calendarModule(view).entries;
  challenge.cardState = { id: 'festival', label: '未知事件' };
  delete rewardDay.cardState;
  rewardDay.reference.day = 400;
  upgrade.reference.day = '20';
  calendarModule(view).calendarSeasons[0].listedDays.push(400, 0, 2.5, null, 3);
  const [season] = read(view).seasons;
  assert.deepEqual(season.entries.map(entry => [entry.kind, entry.ordinal]), [['other', 3], ['other', 400], ['upgrade', null]]);
  assert.equal(season.entries[1].evidence.day, 400);
  assert.equal(season.entries[2].evidence.day, '20');
  assert.deepEqual(season.listedDays, [1, 3, 19, 20, 45]);
});

test('same-day, duplicate and mixed entries are all kept in source order', () => {
  const view = projection();
  const entries = calendarModule(view).entries;
  entries.push({ ...structuredClone(entries[0]), title: '游戏日 3（重复）' });
  Object.assign(entries[1], { cardState: { id: 'mixed', label: '综合事件日' }, terms: [{ key: '/Lotus/Types/Challenges/Extra', name: '附加挑战' }] });
  const [season] = read(view).seasons;
  assert.deepEqual(season.entries.filter(entry => entry.ordinal === 3).map(entry => entry.title), ['游戏日 3', '游戏日 3（重复）']);
  assert.equal(season.entries[1].kind, 'mixed');
  assert.deepEqual([season.entries[1].rewards.map(reward => reward.id), season.entries[1].terms.map(term => term.name)], [[FORMA, SHARD], ['附加挑战']]);
  assert.deepEqual(season.listedDays, [1, 3, 19, 20, 45]);
});

test('an entry outside every listed season gets its own season instead of joining another season or loop', () => {
  const view = projection();
  const stray = structuredClone(calendarModule(view).entries[1]);
  stray.reference.yearIteration = 25;
  stray.title = '游戏日 19（下一轮回）';
  calendarModule(view).entries.push(stray);
  const document = read(view);
  assert.deepEqual(document.seasons.map(season => [season.code, season.yearIteration, season.listedDays, season.entries.map(entry => entry.title)]), [
    ['CST_WINTER', 24, [1, 3, 19, 20, 45], ['游戏日 3', '游戏日 19', '游戏日 20']],
    ['CST_WINTER', 25, [19], ['游戏日 19（下一轮回）']]
  ]);
  assert.equal(document.seasons[1].label, '冬季');
  // A projection without calendarSeasons derives its seasons from the entries alone.
  const legacy = projection();
  delete calendarModule(legacy).calendarSeasons;
  assert.deepEqual(read(legacy).seasons.map(season => [season.code, season.label, season.endsAt, season.listedDays]), [
    ['CST_WINTER', '冬季', '2026-10-26T00:00:00.000Z', [3, 19, 20]]
  ]);
});

test('servers, loops and season windows get isolated contexts; snapshot freshness keeps the context', () => {
  const de = read(projection());
  const variant = change => {
    const view = projection();
    change(view, [calendarModule(view).calendarSeasons[0], ...calendarModule(view).entries]);
    return read(view);
  };
  // WG runs the same season with its own window, as in src/data/live-state/wg-sample.json.
  const wg = variant((view, rows) => {
    view.server = 'wg';
    for (const row of rows) Object.assign(row, { startsAt: '2026-10-22T00:00:00.000Z', endsAt: '2026-10-29T00:00:00.000Z' });
  });
  const wgSameWindow = variant(view => { view.server = 'wg'; });
  const nextLoop = variant((view, [season, ...entries]) => {
    season.yearIteration = 25;
    for (const entry of entries) entry.reference.yearIteration = 25;
  });
  const nextSeason = variant((view, [season, ...entries]) => {
    season.season = 'CST_SPRING';
    for (const entry of entries) entry.reference.season = 'CST_SPRING';
  });
  const fresh = variant(view => Object.assign(view, { kind: 'network', stale: false, sourceTime: '2026-10-23T00:00:00.000Z' }));
  const contexts = [de, wg, wgSameWindow, nextLoop, nextSeason].map(document => document.contextId);
  assert.equal(new Set(contexts).size, contexts.length);
  assert.equal(fresh.contextId, de.contextId);
  assert.deepEqual([wg.data.server, wg.seasons[0].startsAt, wg.seasons[0].entries.length], ['wg', '2026-10-22T00:00:00.000Z', 3]);
  // A stale sample is never presented as the current schedule.
  assert.deepEqual([de.data.kind, de.data.stale, fresh.data.kind, fresh.data.stale], ['sample', true, 'network', false]);
});

test('names never identify an item: equal names keep their own IDs, and a reward without an ID is rejected', () => {
  const view = projection();
  const [forma, shard] = calendarModule(view).entries[1].rewards;
  shard.name = forma.name;
  assert.deepEqual(read(view).seasons[0].entries[1].rewards.map(reward => [reward.id, reward.name, reward.libraryId]), [
    [FORMA, '佛玛', '/Lotus/Types/Items/MiscItems/Forma'],
    [SHARD, '佛玛', null]
  ]);
  delete shard.id;
  assert.throws(() => createWorldStateCalendarSource(view),
    error => error instanceof TypeError && error.issues.some(issue => issue.path === 'seasons[0].entries[1].rewards[1].id'));
});

test('invalid projections throw a TypeError that lists every issue', () => {
  for (const value of [undefined, null, [], 'view', {}, { modules: {} }]) assert.throws(() => createWorldStateCalendarSource(value), TypeError);
  const broken = projection();
  Object.assign(broken, { server: 'xx', kind: 'live', sourceTime: 'yesterday' });
  calendarModule(broken).calendarSeasons[0].endsAt = '2026-10-01T00:00:00.000Z';
  calendarModule(broken).calendarSeasons[0].yearIteration = '24';
  assert.throws(() => createWorldStateCalendarSource(broken), error => {
    const codes = new Set(error.issues.map(issue => issue.code));
    return error instanceof TypeError && ['UNKNOWN_SERVER', 'INVALID_SOURCE_KIND', 'INVALID_SOURCE_TIME', 'INVALID_WINDOW', 'INVALID_SEASON'].every(code => codes.has(code));
  });
});

test('the real host projection maps end to end, including listed days without events', () => {
  const weeklyRules = JSON.parse(readFileSync(new URL('../../src/data/live-state/weekly-semantics.json', import.meta.url), 'utf8'));
  const date = ms => ({ $date: { $numberLong: String(ms) } });
  const raw = {
    Time: 1792700000, ActiveMissions: [], SyndicateMissions: [], Sorties: [],
    KnownCalendarSeasons: [{
      Activation: date(Date.UTC(2026, 9, 19)), Expiry: date(Date.UTC(2026, 9, 26)), Season: 'CST_WINTER', YearIteration: 24, Version: 19,
      UpgradeAvaliabilityRequirements: [],
      Days: [
        { day: 1, events: [] },
        { day: 20, events: [{ type: 'CET_UPGRADE', upgrade: '/Lotus/Upgrades/Calendar/AbilityStrength' }] },
        { day: 21, events: [{ type: 'CET_REWARD', reward: FORMA }, { type: 'CET_REWARD', reward: SHARD }] },
        { day: 400, events: [{ type: 'CET_NEW', challenge: '/Lotus/Types/Challenges/Calendar1999/Future' }] }
      ]
    }]
  };
  const before = structuredClone(raw);
  const view = buildWorldView({ raw, kind: 'sample', server: 'de', source: 'fixture', hash: 'test', fetchedAt: null }, createWorldCatalog({ weeklyRules }));
  const document = createWorldStateCalendarSource(view).read();
  assert.deepEqual(validateCalendarDocument(document).issues, []);
  const [season] = document.seasons;
  assert.deepEqual([season.code, season.label, season.yearIteration, season.startsAt, season.listedDays],
    ['CST_WINTER', '冬季', 24, '2026-10-19T00:00:00.000Z', [1, 20, 21]]);
  assert.deepEqual(season.entries.map(entry => [entry.ordinal, entry.kind]), [[20, 'upgrade'], [21, 'reward'], [400, 'other']]);
  assert.deepEqual([season.entries[0].terms[0].name, season.entries[0].terms[0].source], ['力量增长', 'wfcd-calendar-project-translation']);
  // Without the library enrichment there is no jump target, and none is invented.
  assert.deepEqual(season.entries[1].rewards.map(reward => [reward.id, reward.libraryId]), [[FORMA, null], [SHARD, null]]);
  assert.equal(season.entries[2].evidence.events[0].type, 'CET_NEW');
  assert.deepEqual([document.data.kind, document.data.stale], ['sample', true]);
  assert.deepEqual(raw, before);
});
