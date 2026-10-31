import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createCalendarSession, createWorldStateCalendarSource } from '../../src/features/calendar-1999/index.mjs';
import { buildCalendarViewModel } from '../../src/features/calendar-1999/application/view-model.mjs';

// Application tests for the calendar session and view model (CAL-03). Every test runs on a fake source and a fake
// store, except the isolation test, which goes through the world-state adapter to prove contexts end to end.
const applicationDir = new URL('../../src/features/calendar-1999/application/', import.meta.url);
const fixture = path => JSON.parse(readFileSync(new URL(`./fixtures/${path}`, import.meta.url), 'utf8'));
const entry = (ordinal, kind, extra = {}) => ({ ordinal, kind, title: `day ${ordinal}`, rewards: [], terms: [], evidence: { day: ordinal }, ...extra });
const at = (seasonIndex, monthIndex, ordinal) => ({ seasonIndex, monthIndex, ordinal });

// Spring 1999 of loop 24 with events in all three months: April 6 (96, challenge), 11 (101, reward) and 14 (104, upgrade),
// May 10 (130, reward and challenge) and June 24 (175, other), plus day 400, which cannot be shown.
// April 1 (91) is listed without events. Then a summer season without events and a season the domain cannot map.
function springDocument() {
  const document = fixture('contracts/valid-document.json');
  const [spring] = document.seasons;
  spring.listedDays.push(130, 175);
  spring.entries.push(entry(130, 'reward'), entry(130, 'challenge'), entry(175, 'other'), entry(400, 'reward'));
  document.seasons.push(
    { code: 'CST_SUMMER', label: '夏季', yearIteration: 24, startsAt: '2026-11-02T00:00:00.000Z', endsAt: '2026-11-09T00:00:00.000Z', listedDays: [], entries: [] },
    { code: 'CST_UNKNOWN', label: '未知季节', yearIteration: 24, startsAt: '2026-11-09T00:00:00.000Z', endsAt: '2026-11-16T00:00:00.000Z',
      listedDays: [], entries: [entry(200, 'challenge')] }
  );
  return document;
}

// Hands out the same object on every read, like a careless host, so the session has to protect itself.
function fakeSource(document) {
  const source = { reads: 0, read: () => { source.reads++; return document; } };
  return source;
}

function fakeStore(values = []) {
  const store = { values: new Map(values), writes: [] };
  store.read = key => store.values.get(key);
  store.write = (key, value) => { store.writes.push([key, value]); store.values.set(key, value); };
  return store;
}

function start(document = springDocument(), store = fakeStore()) {
  const source = fakeSource(document);
  return { source, store, session: createCalendarSession({ source, selectionStore: store }) };
}

function deepFreeze(value) {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

test('a session reads its source once and opens on the first event day of the first month, without writing', () => {
  const { session, source, store } = start();
  assert.equal(source.reads, 1);
  const state = session.read();
  assert.deepEqual(state.selection, at(0, 0, 96));
  assert.deepEqual([state.season.code, state.months.map(month => month.month), state.month.month], ['CST_SPRING', [4, 5, 6], 4]);
  assert.deepEqual([state.selected.date, state.selected.kind, state.selected.entries.length], ['1999-04-06', 'challenge', 1]);
  assert.deepEqual(state.unmapped.map(item => item.ordinal), [400]);
  assert.deepEqual(state.data, springDocument().data);
  assert.equal(state.seasons.length, 3);
  // read() is pure: repeated reads are equal, the source is not read again and nothing is written.
  assert.deepEqual(session.read(), state);
  assert.equal(source.reads, 1);
  assert.deepEqual(store.writes, []);

  // A first month without events opens with no selected day; the session never invents one.
  const summerOnly = springDocument();
  summerOnly.seasons.splice(0, 1);
  const summer = start(summerOnly).session.read();
  assert.deepEqual([summer.selection, summer.month.month, summer.selected], [at(0, 0, null), 7, null]);

  // A document without seasons still gives a usable, empty state.
  const empty = springDocument();
  empty.seasons = [];
  const { session: none } = start(empty);
  assert.deepEqual(none.read(), { seasons: [], season: null, months: [], month: null, selected: null, unmapped: [], data: empty.data, selection: at(0, 0, null) });
  assert.throws(() => none.selectSeason(0), RangeError);
  assert.equal(none.move('ArrowRight'), false);
});

test('missing ports and invalid documents are rejected with a TypeError that lists every issue', () => {
  const store = fakeStore();
  const source = fakeSource(springDocument());
  for (const ports of [undefined, {}, { selectionStore: store }, { source: {}, selectionStore: store }, { source },
    { source, selectionStore: { read: () => undefined } }, { source, selectionStore: { write: () => {} } }]) {
    assert.throws(() => createCalendarSession(ports), TypeError);
  }
  assert.equal(source.reads, 0);
  const invalid = fakeSource(fixture('contracts/invalid-entry.json'));
  assert.throws(() => createCalendarSession({ source: invalid, selectionStore: store }),
    error => error instanceof TypeError && ['UNKNOWN_KIND', 'INVALID_REWARD'].every(code => error.issues.some(issue => issue.code === code)));
  assert.throws(() => createCalendarSession({ source: fakeSource(null), selectionStore: store }), TypeError);
  assert.equal(invalid.reads, 1);
  assert.deepEqual(store.writes, []);
});

test('season, month and day selection follow the contract and are written before returning', () => {
  const { session, store } = start();
  const key = springDocument().contextId;
  let state = session.selectDay(104);
  assert.deepEqual([state.selection, state.selected.kind], [at(0, 0, 104), 'upgrade']);
  assert.deepEqual(store.writes.at(-1), [key, at(0, 0, 104)]);
  // Switching the month clears the day.
  state = session.selectMonth(1);
  assert.deepEqual([state.selection, state.month.month, state.selected], [at(0, 1, null), 5, null]);
  state = session.selectDay(130);
  assert.deepEqual([state.selected.date, state.selected.kind, state.selected.entries.map(item => item.kind)], ['1999-05-10', 'mixed', ['reward', 'challenge']]);
  // Switching the season resets the month and clears the day.
  state = session.selectSeason(1);
  assert.deepEqual([state.selection, state.season.code, state.month.month, state.selected, state.unmapped], [at(1, 0, null), 'CST_SUMMER', 7, null, []]);
  // A season the domain cannot map has no months, and its entries stay visible as unmapped.
  state = session.selectSeason(2);
  assert.deepEqual([state.selection, state.season.code, state.months, state.month, state.selected], [at(2, 0, null), 'CST_UNKNOWN', [], null, null]);
  assert.deepEqual(state.unmapped.map(item => item.ordinal), [200]);

  assert.deepEqual(store.writes, [[key, at(0, 0, 104)], [key, at(0, 1, null)], [key, at(0, 1, 130)], [key, at(1, 0, null)], [key, at(2, 0, null)]]);
  assert.deepEqual(store.values.get(key), session.read().selection);
  // The written value is a copy: changing it later does not reach the session.
  store.writes.at(-1)[1].seasonIndex = 0;
  assert.deepEqual(session.read().selection, at(2, 0, null));
});

test('choosing the active season, month or day again keeps the selection and writes nothing', () => {
  const { session, store } = start();
  session.selectMonth(1);
  session.selectDay(130);
  const before = session.read();
  const writes = store.writes.length;
  assert.deepEqual(session.selectSeason(0), before);
  assert.deepEqual(session.selectMonth(1), before);
  assert.deepEqual(session.selectDay(130), before);
  assert.equal(store.writes.length, writes);
});

test('invalid arguments throw RangeError and leave the state and the store unchanged', () => {
  const { session, store } = start();
  const before = session.read();
  for (const index of [-1, 3, 1.5, '0', null, undefined, NaN, Infinity, true, [0]]) {
    assert.throws(() => session.selectSeason(index), RangeError, `season ${String(index)}`);
  }
  for (const index of [-1, 3, 0.5, '1', null, undefined, NaN]) assert.throws(() => session.selectMonth(index), RangeError, `month ${String(index)}`);
  // 130 is a spring day but not an April day; 1, 90 and 400 are outside the season.
  for (const ordinal of [130, 121, 1, 90, 400, 366, 0, 96.5, '96', null, undefined]) {
    assert.throws(() => session.selectDay(ordinal), RangeError, `day ${String(ordinal)}`);
  }
  assert.deepEqual(session.read(), before);
  assert.deepEqual(store.writes, []);

  // In a season without months there is no month or day to choose, and no key can move.
  session.selectSeason(2);
  const writes = store.writes.length;
  assert.throws(() => session.selectMonth(0), RangeError);
  assert.throws(() => session.selectDay(200), RangeError);
  assert.equal(session.move('ArrowRight'), false);
  assert.equal(store.writes.length, writes);
});

test('a failing store write leaves the session unchanged', () => {
  const failing = { read: () => undefined, write: () => { throw new Error('quota exceeded'); } };
  const session = createCalendarSession({ source: fakeSource(springDocument()), selectionStore: failing });
  const before = session.read();
  assert.throws(() => session.selectDay(104), /quota exceeded/);
  assert.throws(() => session.selectMonth(1), /quota exceeded/);
  assert.throws(() => session.move('ArrowRight'), /quota exceeded/);
  assert.deepEqual(session.read(), before);
});

test('arrow keys move by day and week across the months of the active season, never into another season', () => {
  const { session, store } = start();
  const step = key => [session.move(key), session.read().selection];
  session.selectDay(104); // Wednesday, April 14
  assert.deepEqual(step('ArrowDown'), [true, at(0, 0, 111)]);
  assert.deepEqual(step('ArrowLeft'), [true, at(0, 0, 110)]);
  assert.deepEqual(step('ArrowUp'), [true, at(0, 0, 103)]);
  session.selectDay(120); // April 30
  assert.deepEqual(step('ArrowRight'), [true, at(0, 1, 121)]);
  assert.equal(session.read().month.month, 5);
  session.selectDay(123); // May 3, one week after April 26
  assert.deepEqual(step('ArrowUp'), [true, at(0, 0, 116)]);

  // The season edges stop the selection instead of entering winter or summer.
  const writes = () => store.writes.length;
  session.selectDay(91); // April 1
  let count = writes();
  for (const key of ['ArrowLeft', 'ArrowUp']) assert.deepEqual(step(key), [false, at(0, 0, 91)], key);
  session.selectMonth(2);
  session.selectDay(181); // June 30
  for (const key of ['ArrowRight', 'ArrowDown']) assert.deepEqual(step(key), [false, at(0, 2, 181)], key);
  session.selectDay(179); // June 28; a week later is July 5
  assert.deepEqual(step('ArrowDown'), [false, at(0, 2, 179)]);
  count += 3;
  assert.equal(writes(), count);
});

test('Home and End stay in the selected week row of the active month', () => {
  const { session, store } = start();
  const step = key => [session.move(key), session.read().selection];
  session.selectDay(104); // Wednesday, April 14: its row runs from Sunday 11 to Saturday 17
  assert.deepEqual(step('Home'), [true, at(0, 0, 101)]);
  assert.deepEqual(step('End'), [true, at(0, 0, 107)]);
  // Already at the end of the row: the key is handled, nothing changes and nothing is written.
  const writes = store.writes.length;
  assert.deepEqual(step('End'), [true, at(0, 0, 107)]);
  assert.equal(store.writes.length, writes);
  session.selectDay(92); // Friday, April 2: the row starts in March
  assert.deepEqual(step('Home'), [true, at(0, 0, 91)]);
  session.selectDay(119); // Thursday, April 29: the row ends in May
  assert.deepEqual(step('End'), [true, at(0, 0, 120)]);
});

test('without a selected day the keys enter the month, and unknown keys return false without side effects', () => {
  const { session, store } = start();
  const step = key => [session.move(key), session.read().selection];
  session.selectMonth(1);
  assert.deepEqual(step('ArrowDown'), [true, at(0, 1, 121)]);
  session.selectMonth(0);
  assert.deepEqual(step('End'), [true, at(0, 0, 120)]);
  session.selectMonth(2);
  assert.deepEqual(step('ArrowLeft'), [true, at(0, 2, 152)]);

  const before = session.read();
  const writes = store.writes.length;
  for (const key of ['Enter', ' ', 'PageDown', 'arrowleft', 'Left', 'home', '', 'constructor', 'toString', '__proto__', undefined, null, 37, {}, Symbol('ArrowLeft')]) {
    assert.equal(session.move(key), false, String(key));
  }
  assert.deepEqual(session.read(), before);
  assert.equal(store.writes.length, writes);
});

test('a stored selection is restored for its context, and a value that no longer fits falls back part by part', () => {
  const document = springDocument();
  const restore = stored => {
    const store = fakeStore([[document.contextId, stored], ['another context', at(1, 2, null)]]);
    const selection = createCalendarSession({ source: fakeSource(document), selectionStore: store }).read().selection;
    assert.deepEqual(store.writes, [], `creation never writes (${JSON.stringify(stored)})`);
    return selection;
  };
  const initial = at(0, 0, 96);
  const cases = [
    // Values that fit come back as stored, including a month without a selected day and a season without months.
    [at(0, 1, 130), at(0, 1, 130)],
    [at(0, 2, null), at(0, 2, null)],
    [at(2, 0, null), at(2, 0, null)],
    // A selection is a date, never progress: extra fields are not carried into the session.
    [{ ...at(0, 1, 130), completed: true }, at(0, 1, 130)],
    // Untrusted values and unknown seasons use the initial strategy.
    [undefined, initial], [null, initial], ['0,1,130', initial], [{ seasonIndex: '0', monthIndex: 1, ordinal: 130 }, initial],
    [at(0, 3, 130), initial], [at(0, 1, 366), initial], [at(-1, 0, null), initial], [at(3, 0, null), initial],
    // The season still exists, so it is kept; only the part that no longer fits is chosen again.
    [at(2, 1, null), at(2, 0, null)],
    [at(1, 0, 104), at(1, 0, null)],
    [at(0, 0, 130), at(0, 0, 96)],
    [at(0, 1, 96), at(0, 1, 130)],
    [at(0, 2, 104), at(0, 2, 175)]
  ];
  for (const [stored, expected] of cases) assert.deepEqual(restore(stored), expected, JSON.stringify(stored));

  // The session copies the stored value, so a later change in the store does not reach it.
  const stored = at(0, 1, 130);
  const session = createCalendarSession({ source: fakeSource(document), selectionStore: fakeStore([[document.contextId, stored]]) });
  Object.assign(stored, { monthIndex: 2, ordinal: 175 });
  assert.deepEqual(session.read().selection, at(0, 1, 130));
});

test('servers, seasons and loops keep isolated selections, and a new snapshot of the same context restores the date', () => {
  const projection = () => fixture('world-state/projection-de.json');
  const variant = change => {
    const view = projection();
    const module = view.modules.find(row => row.id === 'calendar');
    change(view, module.calendarSeasons[0], module.entries);
    return view;
  };
  const store = fakeStore();
  const open = view => createCalendarSession({ source: createWorldStateCalendarSource(view), selectionStore: store });

  // The DE winter of loop 24 has events on January 3, 19 and 20. The user picks January 19.
  const de = open(projection());
  assert.deepEqual(de.read().selection, at(0, 0, 3));
  de.selectDay(19);

  // Another server, the next loop and the next season window each start on their own initial selection.
  const nextWindow = { startsAt: '2026-10-26T00:00:00.000Z', endsAt: '2026-11-02T00:00:00.000Z' };
  const others = [
    variant(view => { view.server = 'wg'; }),
    variant((view, season, entries) => { season.yearIteration = 25; for (const row of entries) row.reference.yearIteration = 25; }),
    variant((view, season, entries) => { for (const row of [season, ...entries]) Object.assign(row, nextWindow); })
  ].map(open);
  for (const session of others) {
    assert.deepEqual(session.read().selection, at(0, 0, 3));
    session.selectDay(20);
  }
  assert.equal(store.values.size, 4);

  // A fresh network snapshot of the same season keeps the context, restores January 19 and reports its freshness.
  const fresh = open(variant(view => Object.assign(view, { kind: 'network', stale: false, sourceTime: '2026-10-23T00:00:00.000Z' }))).read();
  assert.deepEqual([fresh.selection, fresh.selected.kind, fresh.data.kind, fresh.data.stale], [at(0, 0, 19), 'reward', 'network', false]);
  // When the selected day loses its events, the date is still restored, with no events and nothing invented.
  const emptied = open(variant((view, season, entries) => { entries.splice(entries.findIndex(row => row.reference.day === 19), 1); })).read();
  assert.deepEqual([emptied.selection, emptied.selected.date, emptied.selected.listed, emptied.selected.kind, emptied.selected.entries],
    [at(0, 0, 19), '1999-01-19', true, null, []]);
  // Opening the other contexts again returns their own choices.
  assert.deepEqual(open(variant(view => { view.server = 'wg'; })).read().selection, at(0, 0, 20));
  assert.equal(store.values.size, 4);
});

test('the session copies and freezes its snapshot, so neither the source nor callers can change it', () => {
  const document = springDocument();
  const before = structuredClone(document);
  const { session, store } = start(document);
  session.selectMonth(1);
  session.selectDay(130);
  session.move('ArrowRight');
  assert.deepEqual(document, before);

  // The host changing its object afterwards does not reach the session, which keeps its own contextId.
  const state = session.read();
  document.seasons[0].entries.length = 0;
  document.seasons.length = 0;
  document.contextId = 'changed';
  assert.deepEqual(session.read(), state);
  session.selectDay(140);
  assert.equal(store.writes.at(-1)[0], before.contextId);

  // ES modules run in strict mode, so every write to the frozen state throws.
  for (const change of [() => state.seasons.pop(), () => { state.selection.ordinal = 1; }, () => { state.selected.entries[0].title = 'x'; },
    () => state.unmapped.push(entry(1, 'other')), () => { state.month.days[0].kind = 'reward'; }, () => { state.data.stale = false; }]) {
    assert.throws(change, TypeError);
  }
  // A source that hands out a frozen document works too.
  assert.equal(start(deepFreeze(springDocument())).session.read().selection.ordinal, 96);
});

test('the view model lays a month on 42 slots and carries the selection without dropping entries', () => {
  const { session } = start();
  const model = buildCalendarViewModel(session.read());
  assert.deepEqual(model.seasonOptions, [{ label: '春季', yearIteration: 24 }, { label: '夏季', yearIteration: 24 }, { label: '未知季节', yearIteration: 24 }]);
  assert.equal(model.activeSeasonIndex, 0);
  assert.deepEqual(model.activeSeason, { code: 'CST_SPRING', label: '春季', yearIteration: 24, startsAt: '2026-10-26T00:00:00.000Z', endsAt: '2026-11-02T00:00:00.000Z' });
  assert.deepEqual(model.monthTabs, [{ month: 4, selected: true, eventDays: 3 }, { month: 5, selected: false, eventDays: 1 }, { month: 6, selected: false, eventDays: 1 }]);
  assert.deepEqual(model.status, { server: 'de', sourceKind: 'sample', stale: true, sourceTime: '2026-10-29T00:00:00.000Z' });
  assert.deepEqual(model.unmapped.map(item => item.ordinal), [400]);

  // April 1, 1999 is a Thursday: four empty slots lead, then 30 days, then eight empty slots.
  const { cells } = model.grid;
  assert.deepEqual([model.grid.month, cells.length], [4, 42]);
  assert.deepEqual(cells.slice(0, 4), [null, null, null, null]);
  assert.deepEqual(cells.slice(4, 34).map(cell => cell.day), Array.from({ length: 30 }, (_, index) => index + 1));
  assert.deepEqual(cells.slice(34), Array(8).fill(null));
  assert.deepEqual(cells[4], { day: 1, ordinal: 91, date: '1999-04-01', weekday: 4, listed: true, kind: null, selected: false, entryCount: 0 });
  assert.deepEqual(cells[9], { day: 6, ordinal: 96, date: '1999-04-06', weekday: 2, listed: true, kind: 'challenge', selected: true, entryCount: 1 });
  assert.deepEqual(cells.filter(cell => cell?.selected).map(cell => cell.ordinal), [96]);
  assert.deepEqual(model.selectedDay, { ordinal: 96, date: '1999-04-06', weekday: 2, kind: 'challenge', listed: true, entries: session.read().selected.entries });

  // Full reward IDs and evidence reach the model unchanged.
  const reward = buildCalendarViewModel(session.selectDay(101)).selectedDay.entries[0];
  assert.deepEqual([reward.rewards[0].id, reward.rewards[0].libraryId, reward.evidence], ['/Test/Reward', '/Test/Reward', { season: 'CST_SPRING', yearIteration: 24, day: 101 }]);

  // May 1, 1999 is a Saturday. Both entries of May 10 are kept, and the day is mixed.
  session.selectMonth(1);
  const may = buildCalendarViewModel(session.selectDay(130));
  assert.deepEqual(may.grid.cells.slice(0, 6), Array(6).fill(null));
  assert.equal(may.grid.cells[6].date, '1999-05-01');
  assert.deepEqual([may.grid.cells[15].ordinal, may.grid.cells[15].kind, may.grid.cells[15].entryCount], [130, 'mixed', 2]);
  assert.deepEqual([may.selectedDay.kind, may.selectedDay.entries.length], ['mixed', 2]);
});

test('the view model is pure and covers months without a selection, seasons without months and empty documents', () => {
  const { session } = start();
  const state = session.read();
  const before = structuredClone(state);
  assert.deepEqual(buildCalendarViewModel(state), buildCalendarViewModel(session.read()));
  assert.notEqual(buildCalendarViewModel(state).grid.cells, buildCalendarViewModel(state).grid.cells);
  assert.deepEqual(state, before);

  const june = buildCalendarViewModel(session.selectMonth(2));
  assert.deepEqual([june.grid.month, june.selectedDay, june.monthTabs.map(tab => tab.selected)], [6, null, [false, false, true]]);
  assert.ok(june.grid.cells.every(cell => !cell?.selected));
  // June 1, 1999 is a Tuesday.
  assert.deepEqual([june.grid.cells[1], june.grid.cells[2].date], [null, '1999-06-01']);

  const unknown = buildCalendarViewModel(session.selectSeason(2));
  assert.deepEqual([unknown.activeSeasonIndex, unknown.activeSeason.code, unknown.monthTabs, unknown.grid, unknown.selectedDay], [2, 'CST_UNKNOWN', [], null, null]);
  assert.deepEqual(unknown.unmapped.map(item => item.ordinal), [200]);

  const empty = springDocument();
  empty.seasons = [];
  assert.deepEqual(buildCalendarViewModel(start(empty).session.read()), {
    seasonOptions: [], activeSeasonIndex: 0, activeSeason: null, monthTabs: [], grid: null, selectedDay: null, unmapped: [],
    status: { server: 'de', sourceKind: 'sample', stale: true, sourceTime: '2026-10-29T00:00:00.000Z' }
  });
  for (const value of [null, undefined, 'state']) assert.throws(() => buildCalendarViewModel(value), TypeError);
});

test('the application layer touches no DOM, storage, Electron or clock, and depends only inward', () => {
  // Every application module imports only its own layer or the domain.
  for (const name of readdirSync(applicationDir).filter(file => file.endsWith('.mjs'))) {
    const source = readFileSync(new URL(name, applicationDir), 'utf8');
    const specifiers = [...source.matchAll(/\bfrom\s+['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]/g)].map(match => match[1] ?? match[2]);
    for (const specifier of specifiers) assert.match(specifier, /^\.\/[\w-]+\.mjs$|^\.\.\/domain\/[\w-]+\.mjs$/, `${name} imports ${specifier}`);
  }
  // The CAL-03 modules name no platform global. contract-validation.mjs parses UTC instants with Date, so it is
  // covered by the runtime check below instead.
  const forbidden = /\b(Date|performance|process|globalThis|window|document|navigator|fetch|XMLHttpRequest|WebSocket|localStorage|sessionStorage|indexedDB|require|electron)\b/;
  for (const name of ['calendar-session.mjs', 'view-model.mjs']) {
    const code = readFileSync(new URL(name, applicationDir), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    assert.doesNotMatch(code, forbidden, name);
  }

  // At run time, any read of the clock or of a browser global throws.
  const RealDate = globalThis.Date;
  const clock = () => { throw new Error('application read the clock'); };
  const trapped = ['document', 'window', 'navigator', 'localStorage', 'sessionStorage', 'fetch'];
  const saved = trapped.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]);
  const touched = [];
  for (const name of trapped) Object.defineProperty(globalThis, name, { configurable: true, get: () => { touched.push(name); throw new Error(`application read ${name}`); } });
  globalThis.Date = new Proxy(RealDate, {
    // Converting a given instant is allowed; only "now" is the clock.
    construct: (target, args) => args.length ? Reflect.construct(target, args) : clock(),
    apply: clock,
    get: (target, key) => key === 'now' ? clock : Reflect.get(target, key)
  });
  try {
    const { session } = start();
    for (const key of ['ArrowRight', 'ArrowDown', 'Home', 'End', 'ArrowUp']) session.move(key);
    session.selectMonth(1);
    session.selectDay(130);
    session.selectSeason(2);
    buildCalendarViewModel(session.selectSeason(0));
  } finally {
    globalThis.Date = RealDate;
    for (const [name, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  }
  assert.deepEqual(touched, []);
});
