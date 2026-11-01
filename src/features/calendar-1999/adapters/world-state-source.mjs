import { validateCalendarDocument } from '../application/contract-validation.mjs';
import { isAnnualDay } from '../domain/calendar.mjs';
import { classifyDay } from '../domain/event-kind.mjs';

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

function toCalendarDocument(view) {
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
  const output = [...seasons.values()].map(({ days, derived, ...season }) => ({
    ...season,
    // Days outside 1..365 cannot be shown on a 1999 date. Their events, if any, remain as unmapped entries.
    listedDays: [...new Set(days.filter(isAnnualDay))]
  }));
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
 * @returns {import('../application/ports.mjs').CalendarSource}
 * @throws {TypeError} When the projection does not yield a valid CalendarDocument. `error.issues` lists every problem.
 */
export function createWorldStateCalendarSource(view) {
  const { document, problems } = toCalendarDocument(view);
  const issues = [...problems, ...validateCalendarDocument(document).issues];
  if (issues.length > 0) {
    throw Object.assign(new TypeError(`World-state projection does not form a calendar document: ${issues.map(issue => `${issue.path} ${issue.code}`).join(', ')}`), { issues });
  }
  return Object.freeze({ read: () => structuredClone(document) });
}
