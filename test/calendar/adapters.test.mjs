import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createWorldStateCalendarSource, createCalendarSession, createMemorySelectionStore } from '../../src/features/calendar-1999/index.mjs';
import { validateCalendarDocument } from '../../src/features/calendar-1999/application/contract-validation.mjs';
import { isAnnualDay } from '../../src/features/calendar-1999/domain/calendar.mjs';
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
  const { entries, birthdays, ...season } = document.seasons[0];
  assert.deepEqual(season, {
    code: 'CST_WINTER', label: '冬季', yearIteration: 24,
    startsAt: '2026-10-19T00:00:00.000Z', endsAt: '2026-10-26T00:00:00.000Z', listedDays: [1, 3, 19, 20, 45]
  });
  assert.deepEqual(entries.map(entry => [entry.ordinal, entry.kind, entry.title]), [[3, 'challenge', '游戏日 3'], [19, 'reward', '游戏日 19'], [20, 'upgrade', '游戏日 20']]);
  // Days 1 and 45 are listed without events: they stay listed, and no entry is invented for them.
  assert.ok(!entries.some(entry => [1, 45].includes(entry.ordinal)));
  // Day 45 (February 14) is Lettie's birthday in the verified table (CAL-11); day 1 is no birthday of the six.
  assert.deepEqual(birthdays.map(birthday => [birthday.ordinal, birthday.characterId, birthday.basis]), [[45, 'hex-lettie', 'table']]);
  assert.ok(!JSON.stringify(document).includes('不应进入日历'));
});

test('the document carries contract fields only, so inner layers never read world-state fields', () => {
  const document = read(projection());
  assert.deepEqual(Object.keys(document).sort(), ['contextId', 'data', 'seasons']);
  assert.deepEqual(Object.keys(document.seasons[0]).sort(), ['birthdays', 'code', 'endsAt', 'entries', 'label', 'listedDays', 'startsAt', 'yearIteration']);
  for (const birthday of document.seasons[0].birthdays) {
    assert.deepEqual(Object.keys(birthday).sort(), ['basis', 'characterId', 'evidence', 'gifts', 'name', 'ordinal', 'personality', 'portraitKey', 'role']);
  }
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
  view.calendarSeasons[0].listedDays.length = 0;
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

  // Without the calendar module, the host only hid a card. The season it still lists is not lost, and has no entries.
  const withoutCalendar = projection();
  withoutCalendar.modules = withoutCalendar.modules.filter(module => module.id !== 'calendar');
  assert.deepEqual(read(withoutCalendar).seasons.map(season => [season.code, season.entries, season.listedDays]), [['CST_WINTER', [], [1, 3, 19, 20, 45]]]);
  // Only a projection that lists no season has none.
  delete withoutCalendar.calendarSeasons;
  assert.deepEqual(read(withoutCalendar).seasons, []);
  const withoutEvents = projection();
  calendarModule(withoutEvents).entries = [];
  assert.deepEqual(read(withoutEvents).seasons[0].entries, []);
  assert.deepEqual(read(withoutEvents).seasons[0].listedDays, [1, 3, 19, 20, 45]);
});

test('unknown kinds, out-of-range days and missing days are kept for the unmapped list', () => {
  const view = projection();
  const [challenge, rewardDay, upgrade] = calendarModule(view).entries;
  // An unknown event type and an event that cannot be read both classify as 'other'; the entries and their evidence stay.
  challenge.reference.events[0].type = 'CET_FESTIVAL';
  rewardDay.reference.events = [null];
  rewardDay.reference.day = 400;
  upgrade.reference.day = '20';
  view.calendarSeasons[0].listedDays.push(400, 0, 2.5, null, 3);
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
  // A challenge event next to the two reward events makes the day mixed, whatever the card says.
  entries[1].reference.events.push({ type: 'CET_CHALLENGE', challengeKey: '/Lotus/Types/Challenges/Extra', rewardKey: null, upgradeKey: null, extensions: {} });
  entries[1].terms = [{ key: '/Lotus/Types/Challenges/Extra', name: '附加挑战' }];
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
  delete legacy.calendarSeasons;
  assert.deepEqual(read(legacy).seasons.map(season => [season.code, season.label, season.endsAt, season.listedDays]), [
    ['CST_WINTER', '冬季', '2026-10-26T00:00:00.000Z', [3, 19, 20]]
  ]);
});

test('servers, loops and season windows get isolated contexts; snapshot freshness keeps the context', () => {
  const de = read(projection());
  const variant = change => {
    const view = projection();
    change(view, [view.calendarSeasons[0], ...calendarModule(view).entries]);
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
  broken.calendarSeasons[0].endsAt = '2026-10-01T00:00:00.000Z';
  broken.calendarSeasons[0].yearIteration = '24';
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

// CORE-01: the adapter owns the CET_* mapping. The fixture entry 0 is a challenge day whose card also says 'challenge',
// so every change below has to come from reference.events to change the kind.
const event = type => ({ type, challengeKey: null, rewardKey: null, upgradeKey: null, extensions: {} });
const firstKind = view => read(view).seasons[0].entries[0].kind;
function withEvents(events) {
  const view = projection();
  const [entry] = calendarModule(view).entries;
  if (events === undefined) delete entry.reference.events;
  else entry.reference.events = events;
  return view;
}

test('kind comes from the source events through the CET mapping, and the card state never decides', () => {
  const cases = [
    [['CET_CHALLENGE'], 'challenge'], [['CET_REWARD'], 'reward'], [['CET_UPGRADE'], 'upgrade'],
    // CET_PLOT has no kind of its own in the closed vocabulary, and neither has any unknown or inherited name.
    [['CET_PLOT'], 'other'], [['CET_NEW'], 'other'], [['cet_reward'], 'other'], [['constructor'], 'other'], [['__proto__'], 'other'], [['toString'], 'other'],
    // Equal kinds stay, different mapped kinds mix, and unmapped types classify as 'other' even next to each other.
    [['CET_REWARD', 'CET_REWARD'], 'reward'], [['CET_UPGRADE', 'CET_UPGRADE', 'CET_UPGRADE'], 'upgrade'],
    [['CET_CHALLENGE', 'CET_REWARD'], 'mixed'], [['CET_REWARD', 'CET_UPGRADE'], 'mixed'], [['CET_CHALLENGE', 'CET_PLOT'], 'mixed'],
    [['CET_PLOT', 'CET_FUTURE'], 'other'], [['CET_PLOT', 'CET_PLOT'], 'other']
  ];
  for (const [types, kind] of cases) assert.equal(firstKind(withEvents(types.map(event))), kind, types.join(' + '));

  // The host's card state is not read, whatever it says: wrong, unknown, missing or not even an object.
  for (const cardState of [{ id: 'reward' }, { id: 'mixed' }, { id: 'festival' }, { id: null }, null, 'upgrade', 42, undefined]) {
    const view = projection();
    const [challenge] = calendarModule(view).entries;
    if (cardState === undefined) delete challenge.cardState;
    else challenge.cardState = cardState;
    assert.equal(firstKind(view), 'challenge', JSON.stringify(cardState));
  }

  // A birthday event is 'other', and its dialogue and every other raw field stay in evidence uninterpreted.
  const plot = withEvents([{ ...event('CET_PLOT'), extensions: { dialogue: '/Lotus/Language/Calendar/Birthday', speaker: 'Ordis' } }]);
  const [birthday] = read(plot).seasons[0].entries;
  assert.deepEqual([birthday.kind, birthday.evidence.events[0].extensions], ['other', { dialogue: '/Lotus/Language/Calendar/Birthday', speaker: 'Ordis' }]);
});

test('events that cannot be read stay events of an unknown type, and the card state never fills in', () => {
  const unreadable = [[null], [42], ['CET_CHALLENGE'], [{}], [{ type: null }], [{ type: ['CET_REWARD'] }]];
  for (const events of unreadable) {
    const view = withEvents(events);
    const [source] = calendarModule(view).entries;
    // The card still claims 'challenge'. The entry has events, only unknown ones, so it is kept as 'other'.
    assert.equal(source.cardState.id, 'challenge');
    const [entry, ...rest] = read(view).seasons[0].entries;
    assert.deepEqual([entry.kind, entry.ordinal, entry.title, rest.length], ['other', 3, '游戏日 3', 2], JSON.stringify(events));
    assert.deepEqual(entry.evidence, source.reference);
  }
  // An unreadable event next to a good one is 'other' beside it, so the day is mixed, not silently the good kind.
  assert.equal(firstKind(withEvents([event('CET_REWARD'), null])), 'mixed');
  // Days without events create no entry at all; they stay listed only.
  const { entries, listedDays } = read(projection()).seasons[0];
  assert.deepEqual([entries.length, listedDays.includes(1), entries.some(entry => entry.ordinal === 1)], [3, true, false]);
});

test('an entry without any event is an inconsistent projection and is refused, never counted as an other event', () => {
  // The host projects only days that have events. Missing, wrong-typed and empty events all contradict that.
  for (const events of [undefined, null, [], {}, 'CET_CHALLENGE', 42]) {
    const view = withEvents(events);
    assert.throws(() => createWorldStateCalendarSource(view), error => error instanceof TypeError
      && error.issues.length === 1 && error.issues[0].code === 'INVALID_EVENTS' && error.issues[0].path === 'modules.calendar.entries[0].reference.events', JSON.stringify(events));
  }
  // The issue names the entry that is wrong, and a clean entry next to it is not blamed.
  const later = projection();
  calendarModule(later).entries[2].reference.events = [];
  assert.throws(() => createWorldStateCalendarSource(later), error => error.issues.map(issue => issue.path).join() === 'modules.calendar.entries[2].reference.events');

  // The failure this prevents: an empty day turned into an 'other' event on its own date. It would be counted as an
  // event day and be offered as the first selection, though the day has nothing on it.
  const emptyDay = projection();
  const listed = calendarModule(emptyDay).entries;
  listed.unshift({ ...structuredClone(listed[0]), title: '游戏日 1', reference: { ...structuredClone(listed[0].reference), day: 1, events: [] } });
  assert.throws(() => createWorldStateCalendarSource(emptyDay), error => error.issues[0].code === 'INVALID_EVENTS');
  // Without that entry, day 1 stays a listed day with no event: the session opens on the first real event day.
  const honest = createCalendarSession({ source: createWorldStateCalendarSource(projection()), selectionStore: createMemorySelectionStore() }).read();
  assert.deepEqual([honest.months[0].eventDays, honest.selection.ordinal, honest.months[0].days[0].listed, honest.months[0].days[0].kind], [3, 3, true, null]);
});

test('an entry that names no season fails the whole conversion instead of being guessed into one', () => {
  const changes = [entry => { delete entry.reference; }, entry => { entry.reference = 'x'; }, entry => { delete entry.reference.season; }, entry => { delete entry.reference.yearIteration; }];
  for (const change of changes) {
    const view = projection();
    change(calendarModule(view).entries[0]);
    assert.throws(() => createWorldStateCalendarSource(view), error => error instanceof TypeError && error.issues.some(issue => issue.code === 'INVALID_SEASON'));
  }
});

// CORE-03: one rule for annual days. The adapter filters listedDays with the domain's isAnnualDay and owns no copy of it.
test('listed days follow the domain annual-day rule, and the adapter owns no rule of its own', () => {
  const view = projection();
  const days = [-2, -1, 0, 1, 2, 59, 60, 364, 365, 366, 367, 400, 1.5, 365.0001, NaN, Infinity, '91', null, undefined, true, [], {}];
  view.calendarSeasons[0].listedDays = days;
  assert.deepEqual(read(view).seasons[0].listedDays, [1, 2, 59, 60, 364, 365]);
  assert.deepEqual(read(view).seasons[0].listedDays, [...new Set(days.filter(isAnnualDay))]);

  // Events keep their upstream day even outside the year. They leave the grid as unmapped entries, never as a date.
  const edge = projection();
  const [challenge, rewardDay, upgrade] = calendarModule(edge).entries;
  challenge.reference.day = 365;
  rewardDay.reference.day = 366;
  upgrade.reference.day = 0;
  assert.deepEqual(read(edge).seasons[0].entries.map(entry => entry.ordinal), [365, 366, 0]);

  const source = readFileSync(new URL('../../src/features/calendar-1999/adapters/world-state-source.mjs', import.meta.url), 'utf8');
  assert.match(source, /import \{[^}]*\bisAnnualDay\b[^}]*\} from '\.\.\/domain\/calendar\.mjs'/);
  assert.doesNotMatch(source, /(?:const|function)\s+isAnnualDay\b|DAYS_IN_1999|<=\s*365\b/);
});

// CORE-02: from small raw world states of both servers through the host projection to the adapter.
const weeklyRules = JSON.parse(readFileSync(new URL('../../src/data/live-state/weekly-semantics.json', import.meta.url), 'utf8'));
const rawDate = ms => ({ $date: { $numberLong: String(ms) } });
// Season window and capture time of the real samples: src/data/live-state/de-sample.json and wg-sample.json.
const WORLD = { de: { from: Date.UTC(2026, 9, 19), to: Date.UTC(2026, 9, 26), time: 1792700000 }, wg: { from: Date.UTC(2026, 9, 22), to: Date.UTC(2026, 9, 29), time: 1792697438 } };
const UPGRADE = { type: 'CET_UPGRADE', upgrade: '/Lotus/Upgrades/Calendar/AbilityStrength' };
function rawState(server, days, { expired = false } = {}) {
  const { from, to, time } = WORLD[server];
  const state = { Time: time, ActiveMissions: [], SyndicateMissions: [], Sorties: [] };
  if (days !== null) {
    state.KnownCalendarSeasons = [{
      Activation: rawDate(from), Expiry: rawDate(expired ? time * 1000 - 1000 : to), Season: 'CST_WINTER', YearIteration: 24, Version: 19,
      UpgradeAvaliabilityRequirements: [], Days: days
    }];
  }
  return state;
}
const viewOf = (server, raw) => buildWorldView({ raw, kind: 'sample', server, source: 'fixture', hash: 'test', fetchedAt: null }, createWorldCatalog({ weeklyRules }));
const seasonRows = document => document.seasons.map(season => [season.code, season.label, season.yearIteration, season.startsAt, season.endsAt, season.listedDays, season.entries]);

for (const server of ['de', 'wg']) {
  test(`${server}: a season whose days have no events keeps its window and listed days, and the old page does not change`, () => {
    const { from, to } = WORLD[server];
    const emptyDays = [{ day: 1, events: [] }, { day: 20, events: [] }, { day: 21, events: [] }];
    const empty = viewOf(server, rawState(server, emptyDays));
    // Old page: without events the card is neither shown nor counted. The data does not depend on that.
    assert.equal(empty.modules.some(module => module.id === 'calendar'), false);
    const document = read(empty);
    assert.deepEqual(validateCalendarDocument(document).issues, []);
    assert.deepEqual(seasonRows(document), [['CST_WINTER', '冬季', 24, new Date(from).toISOString(), new Date(to).toISOString(), [1, 20, 21], []]]);
    assert.deepEqual([document.data.server, document.data.kind], [server, 'sample']);

    // The same state with one event day: the card appears with exactly that entry, and nothing else on the page moves.
    const filled = viewOf(server, rawState(server, [emptyDays[0], { day: 20, events: [UPGRADE] }, emptyDays[2]]));
    const card = filled.modules.find(module => module.id === 'calendar');
    assert.deepEqual([card.count, card.entries.map(entry => entry.reference.day)], [1, [20]]);
    assert.deepEqual(filled.modules.filter(module => module.id !== 'calendar').map(module => [module.id, module.count]),
      empty.modules.map(module => [module.id, module.count]));
    assert.equal(filled.summary.weekly, empty.summary.weekly + 1);
    assert.deepEqual(filled.summary.trade, empty.summary.trade);
    // Windows and listed days are the same whether or not the card exists.
    assert.deepEqual(filled.calendarSeasons, empty.calendarSeasons);
    assert.deepEqual(read(filled).seasons[0].listedDays, [1, 20, 21]);
    assert.deepEqual(read(filled).seasons[0].entries.map(entry => [entry.ordinal, entry.kind]), [[20, 'upgrade']]);
    // No event is invented for the listed days that have none.
    assert.deepEqual(read(empty).seasons[0].entries, []);
  });

  test(`${server}: no current season is different from a current season without days or events`, () => {
    // Nothing known, nothing current, and a season that has ended: none of them is a season to show.
    const noKey = rawState(server, []);
    delete noKey.KnownCalendarSeasons;
    for (const raw of [rawState(server, null), noKey, rawState(server, [{ day: 1, events: [] }], { expired: true })]) {
      const view = viewOf(server, raw);
      assert.deepEqual([view.calendarSeasons, read(view).seasons], [[], []]);
    }
    // A current season that lists no day at all is still one season.
    const bare = read(viewOf(server, rawState(server, [])));
    assert.deepEqual(seasonRows(bare).map(([code, , yearIteration, , , listedDays, entries]) => [code, yearIteration, listedDays, entries]), [['CST_WINTER', 24, [], []]]);
  });
}

test('both servers keep their own context when their seasons have no events', () => {
  const days = [{ day: 1, events: [] }, { day: 20, events: [] }];
  const [de, wg] = ['de', 'wg'].map(server => read(viewOf(server, rawState(server, days))));
  assert.notEqual(de.contextId, wg.contextId);
  assert.deepEqual([de.seasons[0].startsAt, wg.seasons[0].startsAt], ['2026-10-19T00:00:00.000Z', '2026-10-22T00:00:00.000Z']);
});
