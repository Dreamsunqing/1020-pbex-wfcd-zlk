import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { HEX_BIRTHDAYS, createCalendarMount, createCalendarSession, createMemorySelectionStore, createWorldStateCalendarSource,
  validateCalendarCapabilities, validateCalendarDocument } from '../../src/features/calendar-1999/index.mjs';
import { buildSeasonMonths, dateToOrdinal, ordinalToDate } from '../../src/features/calendar-1999/domain/calendar.mjs';
import { buildCalendarViewModel } from '../../src/features/calendar-1999/application/view-model.mjs';
import { createCalendar1999Host } from '../../src/ui/calendar-1999.js';
import { indexPortraitArt, portraitArtKey } from '../../src/ui/calendar-1999-art.js';
import PORTRAIT_ART from '../../src/ui/assets/calendar-1999/portrait-art.js';
import { PORTRAIT_MAPPING_FILE, checkCalendarPortraitArt, describePortraitArtCheck, writtenKeys } from '../../scripts/check-calendar-reward-art.mjs';
import { createWorldCatalog } from '../../src/core/live-state/catalog.mjs';
import { buildWorldView } from '../../src/core/live-state/view.mjs';

// Birthdays of the six Hex members and their portraits (CAL-11, #37). The rules are listed in
// 文档/深入/51-1999日历六人组生日与角色图.md: the verified table, the adapter's recognition rules, the calendar data that
// reaches the view, the host's portrait lookup and the portrait check. Pages are checked by scripts/check-calendar-ui.mjs.
const projection = () => JSON.parse(readFileSync(new URL('./fixtures/world-state/projection-de.json', import.meta.url), 'utf8'));
const contract = () => JSON.parse(readFileSync(new URL('./fixtures/contracts/valid-document.json', import.meta.url), 'utf8'));
const calendarModule = view => view.modules.find(module => module.id === 'calendar');
const read = (view, options) => createWorldStateCalendarSource(view, options).read();
const flush = async (rounds = 5) => { for (let round = 0; round < rounds; round++) await new Promise(resolve => setImmediate(resolve)); };
const ROOM = name => `/Lotus/Types/Gameplay/1999Wf/Dialogue/${name}`;
const plot = (dialogueName, where = 'extensions') => ({
  type: 'CET_PLOT', challengeKey: null, rewardKey: null, upgradeKey: null,
  ...(where === 'top' ? { dialogueName, extensions: {} } : { extensions: dialogueName === undefined ? {} : { dialogueName } })
});
const reward = { type: 'CET_REWARD', challengeKey: null, rewardKey: '/Lotus/StoreItems/Types/Items/MiscItems/Forma', upgradeKey: null, extensions: {} };

// Adds a projected day to the winter fixture, listing it as the host does for every day it projects.
function withDay(view, day, events) {
  const module = calendarModule(view);
  const entry = structuredClone(module.entries[0]);
  Object.assign(entry, { title: `游戏日 ${day}`, rewards: [], terms: [] });
  entry.reference = { ...entry.reference, day, events };
  module.entries.push(entry);
  if (!view.calendarSeasons[0].listedDays.includes(day)) view.calendarSeasons[0].listedDays.push(day);
  return view;
}
const entryOn = (document, day) => document.seasons[0].entries.find(entry => entry.ordinal === day);
const birthdaysOf = document => document.seasons[0].birthdays.map(birthday => [birthday.ordinal, birthday.characterId, birthday.basis]);

// --- the verified table ----------------------------------------------------------------------------------------------

test('the table holds the six Hex members with stable IDs, verified dates, their sources and picture keys of their own', () => {
  assert.deepEqual(HEX_BIRTHDAYS.map(row => [row.id, row.englishName, row.name, row.month, row.day, row.ordinal]), [
    ['hex-lettie', 'Lettie', '莱蒂', 2, 14, 45],
    ['hex-amir', 'Amir', '阿米尔', 5, 23, 143],
    ['hex-aoi', 'Aoi', '碧', 7, 10, 191],
    ['hex-eleanor', 'Eleanor', '埃莉诺', 11, 2, 306],
    ['hex-arthur', 'Arthur', '亚瑟', 11, 3, 307],
    ['hex-quincy', 'Quincy', '昆西', 12, 4, 338]
  ]);
  assert.ok(Object.isFrozen(HEX_BIRTHDAYS));
  for (const row of HEX_BIRTHDAYS) {
    assert.ok(Object.isFrozen(row) && Object.isFrozen(row.dialogues) && Object.isFrozen(row.sources), row.id);
    // The annual day comes from the domain's 1999 rule, never from a hand-written number.
    assert.equal(row.ordinal, dateToOrdinal(row.month, row.day), row.id);
    assert.deepEqual([ordinalToDate(row.ordinal).month, ordinalToDate(row.ordinal).day], [row.month, row.day], row.id);
    // In-game KIM profile and in-game calendar, both read and dated; the KIM line names the character and the date.
    assert.deepEqual(row.sources.map(source => source.kind), ['kim-profile', 'calendar', 'chat-room', 'character-page', 'hex-treasure'], row.id);
    for (const source of row.sources) assert.match(source.checkedAt, /^\d{4}-\d{2}-\d{2}$/, row.id);
    const month = new Date(Date.UTC(1999, row.month - 1, 1)).toLocaleString('en', { month: 'long', timeZone: 'UTC' });
    assert.ok(row.sources[0].quote.includes(`${row.englishName} / ${month} ${row.day}`), `${row.id}: ${row.sources[0].quote}`);
    assert.ok(row.sources[1].quote.includes(`${month} ${row.day}`), `${row.id}: ${row.sources[1].quote}`);
    // The picture key is a resource key of its own, valid for the host's portrait mapping.
    assert.equal(portraitArtKey(row.portraitKey), row.portraitKey, row.id);
    assert.doesNotMatch(row.portraitKey, /^\/Lotus\//, row.id);
    assert.match(row.nameSource, /^dict\.zh \/Lotus\/Language\//, row.id);
    for (const room of row.dialogues) assert.match(room, /^[A-Za-z]+Dialogue_rom\.dialogue$/, row.id);
  }
  assert.equal(new Set(HEX_BIRTHDAYS.map(row => row.id)).size, 6);
  assert.equal(new Set(HEX_BIRTHDAYS.map(row => row.portraitKey)).size, 6);
  const rooms = HEX_BIRTHDAYS.flatMap(row => row.dialogues);
  assert.equal(new Set(rooms).size, rooms.length, 'a chat room names one character only');
  // Amir's chat room is not named after him, which is why rooms are listed as written and never guessed from a name.
  assert.deepEqual(HEX_BIRTHDAYS.find(row => row.id === 'hex-amir').dialogues, ['JabirDialogue_rom.dialogue']);
  assert.ok(!rooms.includes('HexDialogue_rom.dialogue'), 'the group chat names no one');
});

test('every member has a role with the official protoframe, a personality line, and the Hex Treasure themed after them', () => {
  const official = JSON.parse(readFileSync(new URL('../../世界状态上游/git/warframe-public-export-plus/ExportResources.json', import.meta.url), 'utf8'));
  const zh = JSON.parse(readFileSync(new URL('../../世界状态上游/git/warframe-public-export-plus/dict.zh.json', import.meta.url), 'utf8'));
  assert.deepEqual(HEX_BIRTHDAYS.map(row => [row.id, row.role.match(/（(\S+) 原型战甲）$/)?.[1], row.gifts.map(gift => [gift.id, gift.name])]), [
    ['hex-lettie', 'Trinity', [['/Lotus/Types/Gameplay/1999Wf/Resources/HexDogTagLettie', '切达芝士皇冠麦片']]],
    ['hex-amir', 'Volt', [['/Lotus/Types/Gameplay/1999Wf/Resources/HexDogTagAmir', '女伯爵漫画']]],
    ['hex-aoi', 'Mag', [['/Lotus/Types/Gameplay/1999Wf/Resources/HexDogTagAoi', '线上时代 CD']]],
    ['hex-eleanor', 'Nyx', [['/Lotus/Types/Gameplay/1999Wf/Resources/HexDogTagEleanor', '心情水晶']]],
    ['hex-arthur', 'Excalibur', [['/Lotus/Types/Gameplay/1999Wf/Resources/HexDogTagArthur', '酌趣六瓶装啤酒']]],
    ['hex-quincy', 'Cyte-09', [['/Lotus/Types/Gameplay/1999Wf/Resources/HexDogTagQuincy', '35 毫米胶片']]]
  ]);
  for (const row of HEX_BIRTHDAYS) {
    assert.ok(Object.isFrozen(row.gifts) && row.gifts.every(Object.isFrozen), row.id);
    assert.ok(row.personality.length > 10 && row.personality.endsWith('。'), row.id);
    for (const gift of row.gifts) {
      // Each gift is an item of the official export, and its name is that item's dict.zh name.
      assert.ok(Object.hasOwn(official, gift.id), gift.id);
      assert.equal(gift.name, zh[official[gift.id].name], gift.id);
      assert.ok(gift.note.endsWith('。'), gift.id);
    }
  }
});

// --- recognition in the world-state adapter --------------------------------------------------------------------------

test('a listed day that is a verified birthday gets that character, even without events; other days get nothing', () => {
  const view = projection();
  const before = structuredClone(view);
  const document = read(view);
  assert.deepEqual(validateCalendarDocument(document).issues, []);
  const [lettie] = document.seasons[0].birthdays;
  assert.deepEqual(lettie, {
    ordinal: 45, characterId: 'hex-lettie', name: '莱蒂', portraitKey: 'hex-lettie', basis: 'table',
    role: HEX_BIRTHDAYS[0].role, personality: HEX_BIRTHDAYS[0].personality,
    gifts: [{ id: '/Lotus/Types/Gameplay/1999Wf/Resources/HexDogTagLettie', name: '切达芝士皇冠麦片', note: '她养的老鼠最爱的零食。' }],
    evidence: { rule: 'listed-day', table: { id: 'hex-lettie', englishName: 'Lettie', month: 2, day: 14, sources: structuredClone(HEX_BIRTHDAYS[0].sources) }, listedDay: 45 }
  });
  assert.notEqual(lettie.gifts, HEX_BIRTHDAYS[0].gifts, 'gifts are copies of the table');
  // The empty day keeps its meaning: listed, no entry, no kind. Day 1 is listed and empty too, and is no birthday.
  assert.equal(entryOn(document, 45), undefined);
  assert.deepEqual(document.seasons[0].birthdays.map(birthday => birthday.ordinal), [45]);
  assert.deepEqual(view, before, 'the projection is never mutated');

  // Without a table nothing changes but the empty birthday list: entries, kinds, listed days and context stay the same.
  const plain = read(projection(), { birthdays: [] });
  assert.deepEqual(plain.seasons[0].birthdays, []);
  const { birthdays: _, ...withoutBirthdays } = document.seasons[0];
  const { birthdays: __, ...plainSeason } = plain.seasons[0];
  assert.deepEqual([withoutBirthdays, document.contextId, document.data], [plainSeason, plain.contextId, plain.data]);

  // A birthday the season does not list gets nothing, even inside the season's months.
  const unlisted = projection();
  unlisted.calendarSeasons[0].listedDays = [1, 3, 19, 20];
  assert.deepEqual(read(unlisted).seasons[0].birthdays, []);
  assert.throws(() => createWorldStateCalendarSource(projection(), { birthdays: 'table' }), TypeError);
});

test('a birthday and the events of its day are both kept, and the day keeps its own kind', () => {
  const document = read(withDay(projection(), 45, [reward]));
  assert.deepEqual([entryOn(document, 45).kind, entryOn(document, 45).notes], ['reward', undefined]);
  assert.deepEqual(birthdaysOf(document), [[45, 'hex-lettie', 'table']]);
  const state = createCalendarSession({ source: { read: () => document }, selectionStore: createMemorySelectionStore() }).selectMonth(1);
  const day = state.month.days.find(value => value.ordinal === 45);
  assert.deepEqual([day.kind, day.entries.length, day.birthdays.map(birthday => birthday.characterId), state.month.eventDays], ['reward', 1, ['hex-lettie'], 1]);
});

test('an upstream plot event that names a character on the verified day is adopted, with its events as evidence', () => {
  for (const where of ['extensions', 'top']) {
    const event = plot(ROOM('LettieDialogue_rom.dialogue'), where);
    const document = read(withDay(projection(), 45, [event]));
    const [lettie] = document.seasons[0].birthdays;
    assert.deepEqual([lettie.ordinal, lettie.characterId, lettie.basis, lettie.evidence.rule], [45, 'hex-lettie', 'upstream', 'upstream-event'], where);
    assert.deepEqual(lettie.evidence.events, [event], where);
    // The event itself stays an entry of the closed vocabulary, unchanged and without a note.
    assert.deepEqual([entryOn(document, 45).kind, entryOn(document, 45).evidence.events, entryOn(document, 45).notes], ['other', [event], undefined], where);
  }
  // Amir by his own chat room, in a spring season.
  const spring = projection();
  spring.calendarSeasons[0] = { ...spring.calendarSeasons[0], season: 'CST_SPRING', listedDays: [] };
  const module = calendarModule(spring);
  module.entries = [module.entries[0]];
  module.entries[0].reference = { ...module.entries[0].reference, season: 'CST_SPRING', day: 143, events: [plot(ROOM('JabirDialogue_rom.dialogue'))] };
  spring.calendarSeasons[0].listedDays.push(143);
  assert.deepEqual(birthdaysOf(read(spring)), [[143, 'hex-amir', 'upstream']]);
});

test('conflicting sources leave the character out and keep the original event with a diagnostic', () => {
  const conflict = { code: 'BIRTHDAY_CONFLICT', characterId: 'hex-lettie', name: '莱蒂', expectedOrdinal: 45, expectedDate: '1999-02-14' };
  // Lettie named on February 15 while the table says February 14: no birthday on either day.
  const event = plot(ROOM('LettieDialogue_rom.dialogue'));
  const wrongDay = read(withDay(projection(), 46, [event]));
  assert.deepEqual(wrongDay.seasons[0].birthdays, []);
  assert.deepEqual([entryOn(wrongDay, 46).kind, entryOn(wrongDay, 46).evidence.events, entryOn(wrongDay, 46).notes], ['other', [event], [conflict]]);
  assert.deepEqual(validateCalendarDocument(wrongDay).issues, []);
  // Named on both days: both original events carry the note, and still no birthday.
  const both = read(withDay(withDay(projection(), 45, [event]), 46, [event]));
  assert.deepEqual(both.seasons[0].birthdays, []);
  assert.deepEqual([entryOn(both, 45).notes, entryOn(both, 46).notes], [[conflict], [conflict]]);
  // A named event outside every annual day conflicts as well; it stays an unmapped entry with its note.
  const lost = read(withDay(projection(), 400, [event]));
  assert.deepEqual([lost.seasons[0].birthdays, entryOn(lost, 400).notes], [[], [conflict]]);
});

test('a plot event that names no one in the table keeps a note, and the date rule still applies', () => {
  const unrecognized = [{ code: 'UNRECOGNIZED_PLOT', characterId: null, name: null, expectedOrdinal: null, expectedDate: null }];
  // The group chat on Lettie's day: the table still gives her birthday, and the event keeps its note.
  const group = read(withDay(projection(), 45, [plot(ROOM('HexDialogue_rom.dialogue'))]));
  assert.deepEqual(birthdaysOf(group), [[45, 'hex-lettie', 'table']]);
  assert.deepEqual(entryOn(group, 45).notes, unrecognized);
  // Never a guess: no room, a room named after a character that is not hers or his, part of a room, inherited names, other types.
  for (const dialogueName of [undefined, 42, '', ROOM('AmirDialogue_rom.dialogue'), ROOM('NotLettieDialogue_rom.dialogue'), 'LettieDialogue_rom.dialogue.bak',
    'LettieDialogue_rom', 'Lettie', 'constructor', '__proto__', 'toString', ROOM('KayaDialogue_rom.dialogue')]) {
    const document = read(withDay(projection(), 50, [plot(dialogueName)]));
    assert.deepEqual([birthdaysOf(document), entryOn(document, 50).notes], [[[45, 'hex-lettie', 'table']], unrecognized], String(dialogueName));
  }
  // A dialogue on another event type is not a birthday event and gets no note.
  const notPlot = read(withDay(projection(), 50, [{ ...reward, extensions: { dialogueName: ROOM('ArthurDialogue_rom.dialogue') } }]));
  assert.deepEqual([birthdaysOf(notPlot), entryOn(notPlot, 50).notes], [[[45, 'hex-lettie', 'table']], undefined]);
});

test('the real host projection carries an upstream dialogueName through the normalizer to the adapter', () => {
  const weeklyRules = JSON.parse(readFileSync(new URL('../../src/data/live-state/weekly-semantics.json', import.meta.url), 'utf8'));
  const date = ms => ({ $date: { $numberLong: String(ms) } });
  const raw = {
    Time: 1792700000, ActiveMissions: [], SyndicateMissions: [], Sorties: [],
    KnownCalendarSeasons: [{
      Activation: date(Date.UTC(2026, 9, 19)), Expiry: date(Date.UTC(2026, 9, 26)), Season: 'CST_WINTER', YearIteration: 24, Version: 19,
      UpgradeAvaliabilityRequirements: [],
      Days: [
        { day: 1, events: [] }, { day: 74, events: [] },
        { day: 45, events: [{ type: 'CET_PLOT', dialogueName: ROOM('LettieDialogue_rom.dialogue'), dialogueConvo: 'TestBirthdayConvo' }] }
      ]
    }]
  };
  const before = structuredClone(raw);
  const view = buildWorldView({ raw, kind: 'sample', server: 'de', source: 'fixture', hash: 'test', fetchedAt: null }, createWorldCatalog({ weeklyRules }));
  const document = createWorldStateCalendarSource(view).read();
  assert.deepEqual(validateCalendarDocument(document).issues, []);
  assert.deepEqual(birthdaysOf(document), [[45, 'hex-lettie', 'upstream']]);
  assert.deepEqual(document.seasons[0].birthdays[0].evidence.events[0].extensions, { dialogueName: ROOM('LettieDialogue_rom.dialogue'), dialogueConvo: 'TestBirthdayConvo' });
  assert.deepEqual(raw, before);
});

test('another verified table can be handed in, and its records are matched by the same rules', () => {
  const newYear = Object.freeze({ id: 'test-new-year', name: '测试角色', englishName: 'Test', month: 1, day: 1, ordinal: 1, portraitKey: null, dialogues: ['TestDialogue_rom.dialogue'], sources: [] });
  const document = read(projection(), { birthdays: [newYear] });
  assert.deepEqual(document.seasons[0].birthdays.map(birthday => [birthday.ordinal, birthday.characterId, birthday.portraitKey]), [[1, 'test-new-year', null]]);
  // A record without a profile or gifts gives none, instead of anything invented.
  assert.deepEqual(['role', 'personality', 'gifts'].map(field => document.seasons[0].birthdays[0][field]), [null, null, []]);
  assert.deepEqual(validateCalendarDocument(document).issues, []);
});

// --- contract, domain, session and view model -------------------------------------------------------------------------

test('1.2.0 birthdays and notes are checked when present, and documents without them stay valid', () => {
  assert.deepEqual(validateCalendarDocument(contract()).issues, []);
  const document = contract();
  const birthday = { ordinal: 91, characterId: 'hex-test', name: '测试', portraitKey: null, basis: 'table', evidence: {} };
  document.seasons[0].birthdays = [birthday, { ...birthday, characterId: 'hex-profile', role: '职位', personality: null, gifts: [{ id: '/Test/Gift', name: '礼物', note: null }, { id: '/Test/Other', name: '' }] }];
  document.seasons[0].entries[0].notes = [{ code: 'BIRTHDAY_CONFLICT', characterId: 'hex-test', name: '测试', expectedOrdinal: 91, expectedDate: '1999-04-01' }, { code: 'FUTURE_CODE' }];
  assert.deepEqual(validateCalendarDocument(document).issues, []);
  document.seasons[0].birthdays = [
    { ...birthday, ordinal: 0, characterId: '', name: '', portraitKey: '', basis: 'guess', role: 1, personality: {}, gifts: [{ id: '' }, { id: '/Test/Gift', name: 2, note: 3 }, 'x'], evidence: undefined },
    birthday, { ...birthday }, 'x', { ...birthday, characterId: 'hex-gifts', gifts: {} }
  ];
  document.seasons[0].entries[0].notes = [{ code: '' }, { code: 'X', expectedOrdinal: 400, name: 7 }, null];
  const issues = validateCalendarDocument(document).issues.map(issue => [issue.path, issue.code]);
  assert.deepEqual(issues, [
    ['seasons[0].entries[0].notes[0]', 'INVALID_NOTE'],
    ['seasons[0].entries[0].notes[1].name', 'INVALID_NOTE'],
    ['seasons[0].entries[0].notes[1].expectedOrdinal', 'INVALID_NOTE'],
    ['seasons[0].entries[0].notes[2]', 'INVALID_NOTE'],
    ['seasons[0].birthdays[0].ordinal', 'INVALID_BIRTHDAY'],
    ['seasons[0].birthdays[0].characterId', 'INVALID_BIRTHDAY'],
    ['seasons[0].birthdays[0].name', 'INVALID_BIRTHDAY'],
    ['seasons[0].birthdays[0].portraitKey', 'INVALID_BIRTHDAY'],
    ['seasons[0].birthdays[0].basis', 'INVALID_BIRTHDAY'],
    ['seasons[0].birthdays[0].role', 'INVALID_BIRTHDAY'],
    ['seasons[0].birthdays[0].personality', 'INVALID_BIRTHDAY'],
    ['seasons[0].birthdays[0].gifts[0]', 'INVALID_GIFT'],
    ['seasons[0].birthdays[0].gifts[0].name', 'INVALID_GIFT'],
    ['seasons[0].birthdays[0].gifts[1].name', 'INVALID_GIFT'],
    ['seasons[0].birthdays[0].gifts[1].note', 'INVALID_GIFT'],
    ['seasons[0].birthdays[0].gifts[2]', 'INVALID_GIFT'],
    ['seasons[0].birthdays[0].evidence', 'MISSING_EVIDENCE'],
    ['seasons[0].birthdays[3]', 'INVALID_BIRTHDAY'],
    ['seasons[0].birthdays[4].gifts', 'INVALID_GIFT'],
    ['seasons[0].birthdays', 'DUPLICATE_BIRTHDAY']
  ]);
  document.seasons[0].birthdays = {};
  document.seasons[0].entries[0].notes = 'x';
  assert.deepEqual(validateCalendarDocument(document).issues.map(issue => issue.code), ['INVALID_NOTE', 'INVALID_BIRTHDAY']);
});

test('the domain puts birthdays on their days next to entries, without changing a kind or the event days', () => {
  const lettie = { ordinal: 45, characterId: 'hex-lettie' }, test = { ordinal: 45, characterId: 'hex-test' }, amir = { ordinal: 143, characterId: 'hex-amir' };
  const season = { code: 'CST_WINTER', listedDays: [45], entries: [], birthdays: [lettie, test, amir] };
  const before = structuredClone(season);
  const { months, unmapped } = buildSeasonMonths(season);
  const day = months[1].days.find(value => value.ordinal === 45);
  assert.deepEqual([day.listed, day.kind, day.entries, day.birthdays], [true, null, [], [lettie, test]]);
  assert.equal(day.birthdays[0], lettie, 'the same objects, in source order');
  // Outside the season's months a birthday is not shown and never becomes an unmapped entry.
  assert.ok(months.every(month => month.days.every(value => !value.birthdays.includes(amir))));
  assert.deepEqual([months.map(month => month.eventDays), unmapped], [[0, 0, 0], []]);
  assert.deepEqual(season, before);
  assert.deepEqual(buildSeasonMonths({ code: 'CST_WINTER' }).months[0].days[0].birthdays, []);
  assert.throws(() => buildSeasonMonths({ code: 'CST_WINTER', birthdays: {} }), TypeError);
});

test('a session opens on the first event day, not on a birthday, and the view model carries birthdays to cells and the detail', () => {
  const document = read(projection());
  const session = createCalendarSession({ source: { read: () => document }, selectionStore: createMemorySelectionStore() });
  assert.equal(session.read().selection.ordinal, 3, 'a birthday is no event day');
  const model = buildCalendarViewModel(session.selectMonth(1));
  const cell = model.grid.cells.find(value => value?.ordinal === 45);
  assert.deepEqual([cell.kind, cell.entryCount, cell.birthdays.map(birthday => birthday.characterId)], [null, 0, ['hex-lettie']]);
  // January has its three event days; February's birthday adds none.
  assert.deepEqual(model.monthTabs.map(tab => tab.eventDays), [3, 0, 0]);
  const detail = buildCalendarViewModel(session.selectDay(45)).selectedDay;
  assert.deepEqual([detail.kind, detail.entries, detail.birthdays.map(birthday => [birthday.name, birthday.portraitKey, birthday.basis])], [null, [], [['莱蒂', 'hex-lettie', 'table']]]);
  assert.ok(Object.isFrozen(detail.birthdays[0].evidence), 'birthdays are the session\'s frozen data');
});

// --- mount and App host ----------------------------------------------------------------------------------------------

const baseCapabilities = () => ({
  close() {}, openItem: () => true, loadArt: () => Promise.resolve({ status: 'missing' }), renderText(target, text) { target.textContent = text; },
  formatDeadline: () => ({ text: '', ended: false }), now: () => 0
});
function captured(capabilities, onError) {
  let deps;
  const mount = createCalendarMount({ view: (container, value) => { deps = value; return { update() {}, destroy() {} }; }, capabilities, onError });
  mount.mount({}, { read() {} });
  return { mount, guarded: deps.capabilities };
}

test('the guarded copy always has loadPortrait: it asks the host by key, maps every failure to missing and drops late answers', async () => {
  assert.deepEqual(validateCalendarCapabilities(baseCapabilities()).issues, [], 'loadPortrait is optional');
  assert.deepEqual(validateCalendarCapabilities({ ...baseCapabilities(), loadPortrait: 'x' }).issues.map(issue => [issue.path, issue.code]), [['loadPortrait', 'INVALID_CAPABILITY']]);
  const errors = [], asked = [];
  const answers = { found: Promise.resolve({ status: 'found', src: 'data:x' }), empty: Promise.resolve({ status: 'found', src: '' }), garbage: Promise.resolve(42), rejects: Promise.reject(new Error('no')) };
  answers.rejects.catch(() => {});
  const { guarded } = captured({ ...baseCapabilities(), loadPortrait(ref) { asked.push(ref); if (ref.key === 'throws') throw new Error('sync'); return answers[ref.key]; } }, (error, where) => errors.push(where));
  assert.deepEqual(await guarded.loadPortrait({ key: 'found' }), { status: 'found', src: 'data:x' });
  for (const key of ['empty', 'garbage', 'rejects', 'throws']) assert.deepEqual(await guarded.loadPortrait({ key }), { status: 'missing' }, key);
  assert.deepEqual(asked.map(ref => ref.key), ['found', 'empty', 'garbage', 'rejects', 'throws']);
  assert.deepEqual(errors, ['loadPortrait', 'loadPortrait']);
  // Without a host capability, every portrait is missing.
  assert.deepEqual(await captured(baseCapabilities()).guarded.loadPortrait({ key: 'hex-arthur' }), { status: 'missing' });
  // After unmount a pending or new request never settles.
  let resolve;
  const late = captured({ ...baseCapabilities(), loadPortrait: () => new Promise(done => { resolve = done; }) });
  let settled = false;
  late.guarded.loadPortrait({ key: 'hex-arthur' }).then(() => { settled = true; });
  late.mount.unmount();
  resolve({ status: 'found', src: 'data:x' });
  late.guarded.loadPortrait({ key: 'hex-arthur' }).then(() => { settled = true; });
  await flush();
  assert.equal(settled, false);
});

function host({ portraitArt, readPicture }) {
  const record = { pictures: [], errors: [], images: 0 };
  let deps;
  const value = createCalendar1999Host({
    api: { images: () => { record.images++; return Promise.resolve([{ dataUrl: 'data:library' }]); } },
    back() {},
    view: (container, given) => { deps = given; return { update() {}, destroy() {} }; },
    onError: (error, where) => record.errors.push([where, error.code, error.portraitKey ?? null, error.path ?? null, error.cause?.message ?? null]),
    rewardArt: {},
    portraitArt,
    readPicture: src => { record.pictures.push(src); return readPicture(src); }
  });
  return { record, show: () => { assert.equal(value.show({}, projection()), true); return deps.capabilities; }, hide: () => value.hide() };
}

test('the App host finds a portrait by its key in the portrait mapping only, once per mount, and reports an unreadable file', async () => {
  const file = 'calendar-1999/portraits/hex-lettie.png';
  const app = host({ portraitArt: { 'hex-lettie': file, '/Lotus/Types/X': 'x.png', 'hex-amir': '../x.png' }, readPicture: () => Promise.resolve() });
  // Refused entries are reported once, when the host is created, and left out.
  assert.deepEqual(app.record.errors, [['portraitArt', 'INVALID_KEY', '/Lotus/Types/X', 'x.png', null], ['portraitArt', 'INVALID_PATH', 'hex-amir', '../x.png', null]]);
  const capabilities = app.show();
  const found = await capabilities.loadPortrait({ key: 'hex-lettie' });
  assert.equal(found.status, 'found');
  assert.ok(found.src.endsWith(`/src/ui/assets/${file}`), found.src);
  await capabilities.loadPortrait({ key: 'hex-lettie' });
  assert.equal(app.record.pictures.length, 1, 'one read per portrait and mount');
  // A key without a valid entry, or no key at all, is missing without reading anything and without the image service.
  for (const key of ['hex-amir', 'hex-arthur', 'Hex-Lettie', '/Lotus/Types/X', null, undefined]) assert.deepEqual(await capabilities.loadPortrait({ key }), { status: 'missing' }, String(key));
  assert.deepEqual([app.record.pictures.length, app.record.images], [1, 0]);
  // The next mount asks again.
  app.hide();
  await app.show().loadPortrait({ key: 'hex-lettie' });
  assert.equal(app.record.pictures.length, 2);

  const broken = host({ portraitArt: { 'hex-lettie': file }, readPicture: () => Promise.reject(new Error('decode failed')) });
  assert.deepEqual(await broken.show().loadPortrait({ key: 'hex-lettie' }), { status: 'missing' });
  assert.deepEqual(broken.record.errors, [['loadPortrait', 'PORTRAIT_FILE_UNREADABLE', 'hex-lettie', file, 'decode failed']]);
});

// --- portrait mapping and its check ------------------------------------------------------------------------------------

test('portrait keys are resource keys of their own, and the mapping follows the reward art path rules', () => {
  for (const key of ['hex-arthur', 'a', 'a1-b2-c3']) assert.equal(portraitArtKey(key), key, key);
  for (const key of ['Hex-Arthur', 'hex_arthur', 'hex--arthur', '-hex', 'hex-', '', ' hex', '/Lotus/Types/X', 'hex/arthur', null, 7]) assert.equal(portraitArtKey(key), null, String(key));
  const { entries, issues } = indexPortraitArt({ 'hex-aoi': 'calendar-1999/portraits/hex-aoi.png', 'hex-amir': 'x.gif', Amir: 'x.png' });
  assert.deepEqual([...entries.keys()], ['hex-aoi']);
  assert.deepEqual(issues.map(issue => [issue.code, issue.id]), [['UNSUPPORTED_TYPE', 'hex-amir'], ['INVALID_KEY', 'Amir']]);
  assert.deepEqual(indexPortraitArt(null).issues.map(issue => issue.code), ['INVALID_TABLE']);
});

test('the bundled portrait mapping passes its check, and the check names characters still without a portrait', async () => {
  const result = await checkCalendarPortraitArt();
  assert.deepEqual(result.issues, []);
  assert.equal(result.ok, true);
  assert.deepEqual(result.unused, [], 'every bundled portrait is mapped');
  assert.equal(result.entries, Object.keys(PORTRAIT_ART).length);
  assert.deepEqual([...result.keys, ...result.withoutPicture].sort(), HEX_BIRTHDAYS.map(row => row.portraitKey).sort());
  assert.deepEqual(writtenKeys(await readFile(PORTRAIT_MAPPING_FILE, 'utf8')), Object.keys(PORTRAIT_ART));
  assert.equal(describePortraitArtCheck(result).at(-1), `1999 日历角色图映射检查通过：${result.entries} 笔`);
  const check = await readFile(new URL('../../scripts/check.mjs', import.meta.url), 'utf8');
  assert.match(check, /checkCalendarPortraitArt\(\)/);
  assert.match(check, /if \(!portraits\.ok\) process\.exit\(1\);/);
});

test('the portrait check fails on unknown keys, reward IDs, missing files and duplicates, and lists unused pictures', async t => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'cal99-portrait-art-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const assets = path.join(dir, 'assets');
  await mkdir(path.join(assets, 'calendar-1999/portraits'), { recursive: true });
  await writeFile(path.join(assets, 'calendar-1999/portraits/hex-aoi.png'), Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex'));
  await writeFile(path.join(assets, 'calendar-1999/portraits/spare.png'), Buffer.from('89504e470d0a1a0a', 'hex'));
  let files = 0;
  const check = async source => {
    const file = path.join(dir, `portraits-${++files}.js`);
    await writeFile(file, source);
    return checkCalendarPortraitArt({ file, assets });
  };
  const codes = result => result.issues.map(issue => [issue.code, issue.id]);
  const good = await check(`export default {\n  'hex-aoi': 'calendar-1999/portraits/hex-aoi.png'\n};\n`);
  assert.deepEqual([good.ok, good.unused, good.withoutPicture], [true, ['calendar-1999/portraits/spare.png'], ['hex-lettie', 'hex-amir', 'hex-eleanor', 'hex-arthur', 'hex-quincy']]);
  assert.ok(describePortraitArtCheck(good).includes('… 尚无角色图，日历显示占位图：hex-lettie'));
  const bad = await check(`export default {\n  'hex-velimir': 'calendar-1999/portraits/hex-aoi.png',\n  '/Lotus/Types/X': 'calendar-1999/portraits/hex-aoi.png',\n  'hex-amir': 'calendar-1999/portraits/missing.png',\n  'hex-aoi': 'calendar-1999/portraits/hex-aoi.png',\n  'hex-aoi': 'calendar-1999/portraits/hex-aoi.png'\n};\n`);
  assert.deepEqual(codes(bad), [['INVALID_KEY', '/Lotus/Types/X'], ['DUPLICATE_KEY', 'hex-aoi'], ['MISSING_FILE', 'hex-amir'], ['UNKNOWN_PORTRAIT_KEY', 'hex-velimir']]);
  assert.equal(bad.ok, false);
  assert.match(describePortraitArtCheck(bad).at(-1), /^1999 日历角色图映射检查失败：4 个问题$/);
});
