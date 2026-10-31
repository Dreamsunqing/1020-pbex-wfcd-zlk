import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { DAYS_IN_YEAR, SEASON_MONTHS, isAnnualDay, ordinalToDate, dateToOrdinal, seasonMonths, monthDates, buildSeasonMonths }
  from '../../src/features/calendar-1999/domain/calendar.mjs';
import { EVENT_KINDS, classifyDay } from '../../src/features/calendar-1999/domain/event-kind.mjs';

const domainDir = new URL('../../src/features/calendar-1999/domain/', import.meta.url);
const fixture = name => JSON.parse(readFileSync(new URL(`./fixtures/contracts/${name}`, import.meta.url), 'utf8'));
const entry = (ordinal, kind = 'other', extra = {}) => ({ ordinal, kind, title: `day ${ordinal}`, rewards: [], terms: [], evidence: { day: ordinal }, ...extra });
const allDays = result => result.months.flatMap(month => month.days);
const dayOf = (result, ordinal) => allDays(result).find(day => day.ordinal === ordinal);
const SEASONS = ['CST_WINTER', 'CST_SPRING', 'CST_SUMMER', 'CST_FALL'];

function deepFreeze(value) {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

test('annual days map to fixed 1999 dates at the year and month edges', () => {
  const cases = { 1: '1999-01-01', 31: '1999-01-31', 32: '1999-02-01', 59: '1999-02-28', 60: '1999-03-01', 91: '1999-04-01', 104: '1999-04-14', 365: '1999-12-31' };
  for (const [ordinal, date] of Object.entries(cases)) assert.equal(ordinalToDate(Number(ordinal)).date, date, ordinal);
  assert.deepEqual(ordinalToDate(1), { ordinal: 1, month: 1, day: 1, date: '1999-01-01', weekday: 5 });
  assert.deepEqual(ordinalToDate(59), { ordinal: 59, month: 2, day: 28, date: '1999-02-28', weekday: 0 });
  assert.deepEqual(ordinalToDate(60), { ordinal: 60, month: 3, day: 1, date: '1999-03-01', weekday: 1 });
  assert.deepEqual(ordinalToDate(365), { ordinal: 365, month: 12, day: 31, date: '1999-12-31', weekday: 5 });
  assert.deepEqual([[2, 28], [3, 1], [4, 14], [12, 31]].map(([month, day]) => dateToOrdinal(month, day)), [59, 60, 104, 365]);
});

test('every day of the year agrees with the UTC getDate reference and round-trips', () => {
  for (let ordinal = 1; ordinal <= DAYS_IN_YEAR; ordinal++) {
    // Same conversion as WFCD Calendar.ts getDate: 1999-01-01 UTC plus (day - 1) days.
    const reference = new Date(Date.UTC(1999, 0, ordinal));
    const date = ordinalToDate(ordinal);
    assert.equal(date.date, reference.toISOString().slice(0, 10), `day ${ordinal}`);
    assert.equal(date.weekday, reference.getUTCDay(), `weekday ${ordinal}`);
    assert.equal(dateToOrdinal(date.month, date.day), ordinal);
  }
  const months = Array.from({ length: 12 }, (_, index) => monthDates(index + 1));
  assert.deepEqual(months.map(dates => dates.length), [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]);
  assert.deepEqual(months.flat().map(date => date.ordinal), Array.from({ length: DAYS_IN_YEAR }, (_, index) => index + 1));
});

test('invalid, non-integer and out-of-range days have no date and never roll over', () => {
  for (const value of [0, -1, 366, 1000, 1.5, 90.0001, '91', '1', null, undefined, NaN, Infinity, -Infinity, true, [91], { ordinal: 91 }, 91n]) {
    assert.equal(ordinalToDate(value), null, String(value));
    assert.equal(isAnnualDay(value), false, String(value));
  }
  // YearIteration never adds a leap day.
  for (const [month, day] of [[2, 29], [4, 31], [13, 1], [0, 1], [1, 0], [1, 32], [1.5, 1], [1, 1.5], ['4', 1], [4, '1'], [null, 1], [undefined, undefined]]) {
    assert.equal(dateToOrdinal(month, day), null, `${month}/${day}`);
  }
  for (const month of [0, 13, 1.5, '4', null, undefined]) assert.throws(() => monthDates(month), RangeError, String(month));
});

test('seasons show three complete months and meet exactly at the quarter boundaries', () => {
  const expected = { CST_WINTER: [1, 90, 5], CST_SPRING: [91, 181, 4], CST_SUMMER: [182, 273, 4], CST_FALL: [274, 365, 5], CST_AUTUMN: [274, 365, 5] };
  for (const [code, [first, last, weekday]] of Object.entries(expected)) {
    const result = buildSeasonMonths({ code });
    const days = allDays(result);
    assert.deepEqual(result.months.map(month => month.month), [...SEASON_MONTHS[code]], code);
    assert.deepEqual(days.map(day => day.ordinal), Array.from({ length: last - first + 1 }, (_, index) => first + index), code);
    assert.equal(days[0].weekday, weekday, code);
    assert.deepEqual(result.unmapped, []);
  }
  assert.deepEqual([90, 91, 181, 182, 273, 274].map(ordinal => ordinalToDate(ordinal).date),
    ['1999-03-31', '1999-04-01', '1999-06-30', '1999-07-01', '1999-09-30', '1999-10-01']);

  const edges = [90, 91, 181, 182, 273, 274].map(ordinal => entry(ordinal));
  const placed = Object.fromEntries(SEASONS.map(code => [code, allDays(buildSeasonMonths({ code, entries: edges })).flatMap(day => day.entries).map(item => item.ordinal)]));
  assert.deepEqual(placed, { CST_WINTER: [90], CST_SPRING: [91, 181], CST_SUMMER: [182, 273], CST_FALL: [274] });
});

test('unknown season codes, including inherited object keys, show no months and keep every entry unmapped', () => {
  const entries = [entry(104, 'upgrade'), entry(1, 'reward'), entry(366)];
  for (const code of ['CST_UNKNOWN', 'cst_spring', 'SPRING', ' CST_SPRING', '', undefined, null, 4, 'constructor', '__proto__', 'toString', 'hasOwnProperty']) {
    const result = buildSeasonMonths({ code, entries });
    assert.deepEqual(result.months, [], String(code));
    assert.equal(result.unmapped.length, entries.length, String(code));
    result.unmapped.forEach((item, index) => assert.equal(item, entries[index]));
    assert.notEqual(result.unmapped, entries, 'unmapped is a new array, never the input array');
    assert.deepEqual(seasonMonths(code), [], String(code));
  }
  const [season] = fixture('valid-unmapped-entry.json').seasons;
  assert.deepEqual(buildSeasonMonths(season), { months: [], unmapped: season.entries });
});

test('same-day mixed and duplicate entries are all kept in source order', () => {
  const upgrade = entry(104, 'upgrade');
  const firstReward = entry(96, 'reward');
  const reward = entry(104, 'reward');
  const duplicate = entry(96, 'reward');
  const result = buildSeasonMonths({ code: 'CST_SPRING', entries: [upgrade, firstReward, reward, duplicate] });
  assert.equal(dayOf(result, 104).kind, 'mixed');
  assert.equal(dayOf(result, 104).entries.length, 2);
  [upgrade, reward].forEach((item, index) => assert.equal(dayOf(result, 104).entries[index], item));
  assert.equal(dayOf(result, 96).kind, 'reward');
  assert.equal(dayOf(result, 96).entries.length, 2);
  [firstReward, duplicate].forEach((item, index) => assert.equal(dayOf(result, 96).entries[index], item));
  assert.deepEqual(result.months.map(month => month.eventDays), [2, 0, 0]);
  // The same object listed twice is still two entries.
  assert.equal(dayOf(buildSeasonMonths({ code: 'CST_SPRING', entries: [upgrade, upgrade] }), 104).entries.length, 2);
});

test('day classification stays inside the closed vocabulary', () => {
  const kinds = (...values) => values.map(kind => ({ kind }));
  assert.equal(classifyDay([]), null);
  for (const kind of EVENT_KINDS) {
    assert.equal(classifyDay(kinds(kind)), kind);
    assert.equal(classifyDay(kinds(kind, kind, kind)), kind, 'duplicates of one kind keep that kind');
  }
  assert.equal(classifyDay(kinds('challenge', 'reward')), 'mixed');
  assert.equal(classifyDay(kinds('other', 'challenge')), 'mixed');
  assert.equal(classifyDay(kinds('mixed', 'reward')), 'mixed');
  // Values outside EVENT_KINDS count as 'other'.
  for (const value of [[{ kind: 'plot' }], [{}], [null], [{ kind: 'Reward' }], kinds('plot', 'other')]) assert.equal(classifyDay(value), 'other');
  assert.equal(classifyDay(kinds('plot', 'reward')), 'mixed');
  for (const value of [undefined, null, {}, 'reward']) assert.throws(() => classifyDay(value), TypeError);
});

test('listed days without entries stay listed with no kind and are not guessed as events', () => {
  const result = buildSeasonMonths({ code: 'CST_SPRING', listedDays: [91, 100, 1, 182], entries: [entry(96, 'challenge')] });
  for (const ordinal of [91, 100]) assert.deepEqual(
    (({ listed, kind, entries }) => ({ listed, kind, entries }))(dayOf(result, ordinal)), { listed: true, kind: null, entries: [] });
  assert.deepEqual([dayOf(result, 92).listed, dayOf(result, 92).kind], [false, null]);
  // Listing and entries are independent facts.
  assert.deepEqual([dayOf(result, 96).listed, dayOf(result, 96).kind], [false, 'challenge']);
  assert.deepEqual(result.months.map(month => month.eventDays), [1, 0, 0]);
  // Listed days outside the season are not shown and do not become unmapped entries.
  assert.deepEqual(allDays(result).filter(day => day.listed).map(day => day.ordinal), [91, 100]);
  assert.deepEqual(result.unmapped, []);
});

test('entries outside the season or without an annual day are unmapped, never dropped', () => {
  const entries = [entry(90, 'reward'), entry(91, 'challenge'), entry(182, 'upgrade'), entry(1), entry(0), entry(366),
    entry(null), entry(1.5), entry('104'), { kind: 'reward' }, null];
  const result = buildSeasonMonths({ code: 'CST_SPRING', entries });
  const mapped = allDays(result).flatMap(day => day.entries);
  assert.equal(mapped.length, 1);
  assert.equal(mapped[0], entries[1]);
  const expected = entries.filter((_, index) => index !== 1);
  assert.equal(result.unmapped.length, expected.length);
  expected.forEach((item, index) => assert.equal(result.unmapped[index], item));
});

test('a contract document aligns without losing evidence or full reward IDs', () => {
  const [season] = fixture('valid-document.json').seasons;
  const result = buildSeasonMonths(season);
  const april = result.months[0];
  assert.deepEqual(result.months.map(month => month.month), [4, 5, 6]);
  assert.deepEqual(april.days.filter(day => day.entries.length).map(day => [day.date, day.weekday, day.kind]),
    [['1999-04-06', 2, 'challenge'], ['1999-04-11', 0, 'reward'], ['1999-04-14', 3, 'upgrade']]);
  assert.deepEqual(april.days.filter(day => day.listed).map(day => day.ordinal), [91, 96, 101, 104]);
  assert.equal(dayOf(result, 101).entries[0], season.entries[1]);
  assert.equal(dayOf(result, 101).entries[0].rewards[0].id, '/Test/Reward');
  assert.deepEqual(dayOf(result, 104).entries[0].evidence, { season: 'CST_SPRING', yearIteration: 24, day: 104 });
  assert.equal(dayOf(result, 104).entries[0].terms.length, 3);
  assert.deepEqual(result.months.map(month => month.eventDays), [3, 0, 0]);
  assert.deepEqual(result.unmapped, []);
});

test('inputs are never mutated, and equal inputs give equal, independent outputs', () => {
  const season = deepFreeze({ code: 'CST_WINTER', listedDays: [1, 45], entries: [entry(3, 'challenge'),
    entry(19, 'reward', { rewards: [{ id: '/Lotus/StoreItems/Test/Reward', name: '测试', quantity: 1, libraryId: null }] }), entry(19, 'reward'), entry(400)] });
  const before = structuredClone(season);
  // ES modules run in strict mode, so any write to the frozen season would throw here.
  const first = buildSeasonMonths(season);
  const second = buildSeasonMonths(season);
  assert.deepEqual(season, before);
  assert.deepEqual(first, second);
  assert.notEqual(first.months, second.months);
  assert.notEqual(first.months[0].days, second.months[0].days);
  assert.notEqual(dayOf(first, 19).entries, dayOf(second, 19).entries);
  assert.notEqual(first.unmapped, second.unmapped);
  // Changing one result never leaks into the next call.
  dayOf(first, 19).entries.push(entry(19));
  first.unmapped.length = 0;
  assert.deepEqual(buildSeasonMonths(season), second);

  assert.ok(Object.isFrozen(SEASON_MONTHS) && Object.values(SEASON_MONTHS).every(Object.isFrozen));
  assert.throws(() => seasonMonths('CST_SPRING').push(7), TypeError);
  assert.throws(() => seasonMonths('CST_UNKNOWN').push(1), TypeError);
});

test('results are identical in every host time zone', () => {
  const calendarUrl = new URL('calendar.mjs', domainDir).href;
  const script = `
    const { buildSeasonMonths, ordinalToDate } = await import(${JSON.stringify(calendarUrl)});
    const entries = [{ ordinal: 1, kind: 'reward' }, { ordinal: 104, kind: 'upgrade' }, { ordinal: 365, kind: 'challenge' }];
    console.log(JSON.stringify({
      offset: new Date(1999, 3, 1).getTimezoneOffset(),
      dates: Array.from({ length: 367 }, (_, ordinal) => ordinalToDate(ordinal)),
      seasons: ${JSON.stringify(SEASONS)}.map(code => buildSeasonMonths({ code, listedDays: [1, 91, 182, 274], entries }))
    }));`;
  const zones = ['UTC', 'Asia/Taipei', 'America/Los_Angeles', 'Pacific/Kiritimati', 'Pacific/Pago_Pago'];
  const runs = zones.map(TZ => JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', script], { env: { ...process.env, TZ }, encoding: 'utf8' })));
  // The child processes really ran in different zones; otherwise this test would prove nothing.
  assert.equal(new Set(runs.map(run => run.offset)).size, zones.length);
  for (const [index, run] of runs.entries()) {
    assert.deepEqual(run.dates, runs[0].dates, zones[index]);
    assert.deepEqual(run.seasons, runs[0].seasons, zones[index]);
  }
});

test('domain rules import nothing outside the domain and never read the clock', () => {
  const forbidden = /\b(Date|performance|process|globalThis|window|document|navigator|fetch|XMLHttpRequest|WebSocket|localStorage|sessionStorage|require|electron)\b/;
  for (const name of readdirSync(domainDir).filter(file => file.endsWith('.mjs'))) {
    const source = readFileSync(new URL(name, domainDir), 'utf8');
    const specifiers = [...source.matchAll(/\bfrom\s+['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]/g)].map(match => match[1] ?? match[2]);
    for (const specifier of specifiers) assert.match(specifier, /^\.\/[\w-]+\.mjs$/, `${name} imports ${specifier}`);
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    assert.doesNotMatch(code, forbidden, name);
  }

  const RealDate = globalThis.Date;
  const clock = () => { throw new Error('domain read the clock'); };
  globalThis.Date = new Proxy(RealDate, { construct: clock, apply: clock, get: (target, key) => key === 'now' ? clock : Reflect.get(target, key) });
  try {
    for (const code of [...SEASONS, 'CST_UNKNOWN']) buildSeasonMonths({ code, listedDays: [1, 91], entries: [entry(1), entry(104), entry(366)] });
    for (let ordinal = 0; ordinal <= 366; ordinal++) ordinalToDate(ordinal);
  } finally {
    globalThis.Date = RealDate;
  }
});
