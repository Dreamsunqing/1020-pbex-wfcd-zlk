import { validateCalendarDocument } from '../application/contract-validation.mjs';
import { isAnnualDay, ordinalToDate } from '../domain/calendar.mjs';
import { classifyDay } from '../domain/event-kind.mjs';
import { HEX_BIRTHDAYS } from './hex-birthdays.mjs';

// World-state adapter (CAL-04). This is the only module of the feature that knows the host's world-state
// projection: the top-level `calendarSeasons` list and the `calendar` module that src/core/live-state/view.mjs builds
// and reward-art.mjs enriches. Domain, application and presentation only ever see the CalendarDocument it produces.
//
// Mapping rules, also listed in 文档/深入/43-1999日历世界状态转接器.md:
// - A season is identified by its code, yearIteration and startsAt. Seasons come from view.calendarSeasons in order, so a
//   season stays even when the host hides its card because no day has events. An entry that matches none of them gets
//   a season of its own, built from the entry, so it is never dropped and never merged into another season or loop.
// - ordinal is the upstream annual day as projected. Anything that is not an integer becomes null; out-of-range
//   integers are kept. Both end up as unmapped entries in the domain, never as a guessed date.
// - kind comes from the source events in entry.reference.events, never from the host's card state: each CET_* type is
//   mapped below and CAL-02 classifyDay() aggregates the day. An event that is not understood counts as 'other'.
// - An entry projects a day that has events; the host never projects a day without them, and a listed day without
//   events has no entry. An entry whose reference.events is missing, not an array or empty contradicts that. Its day has
//   no event to classify, and calling it 'other' would invent an event, count an event day and offer it as the first
//   selection. The conversion fails with TypeError and the issue INVALID_EVENTS instead.
// - A reward keeps its projected full ID. A name never identifies an item, and a reward without an ID is rejected.
// - Missing optional values stay missing: no library link is null, an unknown quantity is null. A listed day without
//   events stays a listed day; no entry is created for it.
// - An entry that names no season cannot be attributed to any season, and guessing one would mix loops. The conversion
//   then fails as a whole with a TypeError that lists the issues; nothing is silently dropped or defaulted.
// - The projection is never mutated. The document is built from copies once, and every read() returns a new deep copy.
//
// Birthday rules (CAL-11), also listed in 文档/深入/51-1999日历六人组生日与角色图.md:
// - A birthday is calendar data next to the entries (season.birthdays), never an entry and never an event kind. Entries,
//   kinds, listed days and the contextId stay exactly what they were without it.
// - Upstream first: a CET_PLOT event whose dialogueName ends in a chat room file of the verified table names that
//   character. When its day is the table's day, the birthday is taken from that event (basis 'upstream').
// - Date only: when no event names a character, a day the season lists, with or without events, that is a character's
//   birthday in the verified table gets that birthday (basis 'table'). A listed day that is no birthday in the table, and
//   a birthday the season does not list, get nothing, so an empty day is never guessed to be a birthday.
// - Conflict: an event that names a character on another day than the table's leaves that character out of the season.
//   Every entry with such an event keeps its events unchanged and carries a BIRTHDAY_CONFLICT note, so it is shown as
//   the original event with a diagnostic. A CET_PLOT event that names no one in the table (no dialogueName, the group
//   chat, another character) is kept the same way with an UNRECOGNIZED_PLOT note, and the date rule still applies.
// - Evidence keeps the table record with its sources, and the matched listed day or the upstream events, as copies.
// - Each birthday carries the table's profile (role, personality) and suitable gifts as copies. They describe the
//   character, never the day, so they change nothing above.

const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const list = value => Array.isArray(value) ? value : [];
const text = value => typeof value === 'string' ? value : '';
const filled = value => typeof value === 'string' && value.trim() !== '' ? value : null;
const stringOrNull = value => typeof value === 'string' ? value : null;
const seasonKey = (code, yearIteration, startsAt) => JSON.stringify([code ?? null, yearIteration ?? null, startsAt ?? null]);

// The only place that decides what an upstream calendar event type means (42 · 第六节). CET_PLOT, which upstream uses for
// birthdays, has no kind of its own in the closed vocabulary and is 'other', like every type that is not listed here.
const EVENT_KIND_BY_TYPE = Object.freeze({ CET_CHALLENGE: 'challenge', CET_REWARD: 'reward', CET_UPGRADE: 'upgrade' });

function kindOfEvent(event) {
  const type = event?.type;
  return typeof type === 'string' && Object.hasOwn(EVENT_KIND_BY_TYPE, type) ? EVENT_KIND_BY_TYPE[type] : 'other';
}

// One entry is one projected day. Equal mapped kinds stay that kind, different ones make the day 'mixed' and an
// unmapped type is 'other', so CET_PLOT with CET_FUTURE is 'other' where the old card said 'mixed'. Events that cannot be
// read at all (null, numbers, objects without a type) are still events, only unknown ones, so they stay 'other'. The
// caller has already refused an entry with no events, so classifyDay() never sees an empty day and never returns null.
function kindOfDay(events) {
  return classifyDay(events.map(event => ({ kind: kindOfEvent(event) })));
}

function toReward(reward) {
  return {
    id: text(reward?.id),
    name: text(reward?.name),
    quantity: Number.isInteger(reward?.quantity) && reward.quantity >= 0 ? reward.quantity : null,
    libraryId: filled(reward?.libraryId),
    libraryVersion: filled(reward?.libraryVersion)
  };
}

function toTerm(term) {
  // A term without a localized name shows its upstream key as written, like the host's other unresolved labels.
  const result = { name: filled(term?.name) ?? filled(term?.key) ?? '', key: stringOrNull(term?.key), source: stringOrNull(term?.source) };
  if (typeof term?.description === 'string') result.description = term.description;
  return result;
}

function toEntry(entry, reference, events) {
  return {
    ordinal: Number.isInteger(reference.day) ? reference.day : null,
    kind: kindOfDay(events),
    title: text(entry?.title),
    rewards: list(entry?.rewards).map(toReward),
    terms: list(entry?.terms).map(toTerm),
    evidence: structuredClone(reference)
  };
}

// The chat room file an upstream CET_PLOT event names: the last segment of its dialogueName, as written. The host's
// normalizer keeps fields it has no schema for in `extensions`; a top-level field is read first, should it get one.
function chatRoom(event) {
  const value = typeof event?.dialogueName === 'string' ? event.dialogueName
    : isObject(event?.extensions) && Object.hasOwn(event.extensions, 'dialogueName') ? event.extensions.dialogueName : null;
  return typeof value === 'string' ? value.slice(value.lastIndexOf('/') + 1) : null;
}

function birthdayIndex(table) {
  if (!Array.isArray(table)) throw new TypeError('Birthday table must be an array of verified records');
  const byRoom = new Map();
  for (const row of table) for (const room of list(row?.dialogues)) byRoom.set(room, row);
  return { rows: table, byRoom };
}

const birthdayNote = (code, row = null) => ({
  code, characterId: row?.id ?? null, name: row?.name ?? null,
  expectedOrdinal: row?.ordinal ?? null, expectedDate: row ? ordinalToDate(row.ordinal)?.date ?? null : null
});

function tableEvidence(row) {
  return { id: row.id, englishName: row.englishName ?? null, month: row.month, day: row.day, sources: structuredClone(list(row.sources)) };
}

// Applies the birthday rules above to one season. Notes go onto the season's own new entries; nothing else is changed.
function recognizeBirthdays(entries, listedDays, index) {
  const named = new Map(), naming = new Map(), conflicted = new Set();
  for (const entry of entries) {
    const notes = [];
    for (const event of entry.evidence.events) {
      if (event?.type !== 'CET_PLOT') continue;
      const row = index.byRoom.get(chatRoom(event));
      if (!row) { notes.push(birthdayNote('UNRECOGNIZED_PLOT')); continue; }
      if (!naming.has(row.id)) naming.set(row.id, new Set());
      naming.get(row.id).add(entry);
      if (row.ordinal !== entry.ordinal) { notes.push(birthdayNote('BIRTHDAY_CONFLICT', row)); conflicted.add(row.id); continue; }
      if (!named.has(row.id)) named.set(row.id, []);
      named.get(row.id).push(event);
    }
    if (notes.length) entry.notes = notes;
  }
  // An entry that names a conflicted character on the table's day is an original event of the conflict as well.
  for (const id of conflicted) {
    const row = index.rows.find(value => value?.id === id);
    for (const entry of naming.get(id)) {
      if (!entry.notes?.some(note => note.code === 'BIRTHDAY_CONFLICT' && note.characterId === id)) (entry.notes ??= []).push(birthdayNote('BIRTHDAY_CONFLICT', row));
    }
  }
  const listed = new Set(listedDays);
  const birthdays = [];
  for (const row of index.rows) {
    if (conflicted.has(row.id)) continue;
    const events = named.get(row.id);
    const basis = events ? 'upstream' : listed.has(row.ordinal) ? 'table' : null;
    if (!basis) continue;
    birthdays.push({
      ordinal: row.ordinal, characterId: row.id, name: row.name, portraitKey: row.portraitKey ?? null, basis,
      // The profile and the suitable gifts come from the verified table, copied; a record without them has none.
      role: filled(row.role), personality: filled(row.personality),
      gifts: list(row.gifts).map(gift => ({ id: text(gift?.id), name: text(gift?.name), note: filled(gift?.note) })),
      evidence: basis === 'upstream'
        ? { rule: 'upstream-event', table: tableEvidence(row), events: structuredClone(events) }
        : { rule: 'listed-day', table: tableEvidence(row), listedDay: row.ordinal }
    });
  }
  // Day order; within one day the table order stays (Array#sort is stable).
  return birthdays.sort((a, b) => a.ordinal - b.ordinal);
}

function toCalendarDocument(view, birthdayRules) {
  if (!isObject(view)) throw new TypeError('World-state projection must be an object');
  if (!Array.isArray(view.modules)) throw new TypeError('World-state projection needs a modules array');
  // The host leaves out modules without entries, so a missing calendar module only means there are no entries.
  // Whether a season exists is told by view.calendarSeasons, which does not depend on any card being shown.
  const module = view.modules.find(row => row?.id === 'calendar');
  const problems = [];
  const seasons = new Map();
  const seasonFor = (key, create) => {
    if (!seasons.has(key)) seasons.set(key, { ...create(), days: [], entries: [] });
    return seasons.get(key);
  };
  for (const row of list(view.calendarSeasons)) {
    const season = seasonFor(seasonKey(row?.season, row?.yearIteration, row?.startsAt), () => ({
      code: text(row?.season), label: text(row?.label), yearIteration: row?.yearIteration, startsAt: row?.startsAt, endsAt: row?.endsAt
    }));
    season.days.push(...list(row?.listedDays));
  }
  for (const [index, row] of list(module?.entries).entries()) {
    const reference = isObject(row?.reference) ? row.reference : {};
    const season = seasonFor(seasonKey(reference.season, reference.yearIteration, row?.startsAt), () => ({
      code: text(reference.season), label: text(row?.subtitle), yearIteration: reference.yearIteration,
      startsAt: row?.startsAt, endsAt: row?.endsAt, derived: true
    }));
    const { events } = reference;
    if (!Array.isArray(events) || events.length === 0) {
      // No entry is built, so the day gains no event, no event-day count and no first selection. The document is refused below.
      problems.push({ path: `modules.calendar.entries[${index}].reference.events`, code: 'INVALID_EVENTS', message: 'A projected entry needs at least one source event' });
      continue;
    }
    const entry = toEntry(row, reference, events);
    // Projected entries only exist for days the upstream lists, so a derived season lists exactly those days.
    if (season.derived) season.days.push(entry.ordinal);
    season.entries.push(entry);
  }
  const output = [...seasons.values()].map(({ days, derived, ...season }) => {
    // Days outside 1..365 cannot be shown on a 1999 date. Their events, if any, remain as unmapped entries.
    const listedDays = [...new Set(days.filter(isAnnualDay))];
    return { ...season, listedDays, birthdays: recognizeBirthdays(season.entries, listedDays, birthdayRules) };
  });
  return {
    problems,
    document: {
      // Changes with the server or any season's code, yearIteration or startsAt; not with kind or stale (ADR-005).
      contextId: JSON.stringify([view.server ?? null, ...output.map(season => [season.code, season.yearIteration, season.startsAt])]),
      data: { server: view.server, kind: view.kind, stale: view.stale, sourceTime: view.sourceTime },
      seasons: output
    }
  };
}

/**
 * Creates a CalendarSource from one world-state projection: the result of buildWorldView, optionally enriched
 * by enrichWorldRewardArt. One projection belongs to one server, so each server gets its own source.
 *
 * @param {object} view  {server, kind, stale, sourceTime, modules, calendarSeasons}
 * @param {{birthdays?: readonly object[]}} [options]  birthdays: the verified birthday table, HEX_BIRTHDAYS unless a test
 *        or a maintainer check hands in another one with the same record shape.
 * @returns {import('../application/ports.mjs').CalendarSource}
 * @throws {TypeError} When the projection does not yield a valid CalendarDocument. `error.issues` lists every problem.
 */
export function createWorldStateCalendarSource(view, { birthdays = HEX_BIRTHDAYS } = {}) {
  const { document, problems } = toCalendarDocument(view, birthdayIndex(birthdays));
  const issues = [...problems, ...validateCalendarDocument(document).issues];
  if (issues.length > 0) {
    throw Object.assign(new TypeError(`World-state projection does not form a calendar document: ${issues.map(issue => `${issue.path} ${issue.code}`).join(', ')}`), { issues });
  }
  return Object.freeze({ read: () => structuredClone(document) });
}
