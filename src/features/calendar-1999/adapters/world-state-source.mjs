import { validateCalendarDocument } from '../application/contract-validation.mjs';
import { isEventKind } from '../domain/event-kind.mjs';

// World-state adapter (CAL-04). This is the only module of the feature that knows the host's world-state
// projection: the `calendar` module that src/core/live-state/view.mjs builds and reward-art.mjs enriches.
// Domain, application and presentation only ever see the CalendarDocument it produces.
//
// Mapping rules, also listed in 文档/深入/43-1999日历世界状态转接器.md:
// - A season is identified by its code, yearIteration and startsAt. Seasons come from module.calendarSeasons in order.
//   An entry that matches none of them gets a season of its own, built from the entry, so it is never dropped
//   and never merged into another season or loop.
// - ordinal is the upstream annual day as projected. Anything that is not an integer becomes null; out-of-range
//   integers are kept. Both end up as unmapped entries in the domain, never as a guessed date.
// - A reward keeps its projected full ID. A name never identifies an item, and a reward without an ID is rejected.
// - Missing optional values stay missing: no library link is null, an unknown quantity is null, an unknown kind is
//   'other'. A listed day without events stays a listed day; no entry is created for it.
// - The projection is never mutated. The document is built from copies once, and every read() returns a new deep copy.

const DAYS_IN_1999 = 365;
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const list = value => Array.isArray(value) ? value : [];
const text = value => typeof value === 'string' ? value : '';
const filled = value => typeof value === 'string' && value.trim() !== '' ? value : null;
const stringOrNull = value => typeof value === 'string' ? value : null;
const isAnnualDay = value => Number.isInteger(value) && value >= 1 && value <= DAYS_IN_1999;
const seasonKey = (code, yearIteration, startsAt) => JSON.stringify([code ?? null, yearIteration ?? null, startsAt ?? null]);

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

function toEntry(entry, reference) {
  return {
    ordinal: Number.isInteger(reference.day) ? reference.day : null,
    kind: isEventKind(entry?.cardState?.id) ? entry.cardState.id : 'other',
    title: text(entry?.title),
    rewards: list(entry?.rewards).map(toReward),
    terms: list(entry?.terms).map(toTerm),
    evidence: structuredClone(reference)
  };
}

function toCalendarDocument(view) {
  if (!isObject(view)) throw new TypeError('World-state projection must be an object');
  if (!Array.isArray(view.modules)) throw new TypeError('World-state projection needs a modules array');
  // The host leaves out modules without entries, so a missing calendar module means no calendar seasons.
  const module = view.modules.find(row => row?.id === 'calendar');
  const seasons = new Map();
  const seasonFor = (key, create) => {
    if (!seasons.has(key)) seasons.set(key, { ...create(), days: [], entries: [] });
    return seasons.get(key);
  };
  for (const row of list(module?.calendarSeasons)) {
    const season = seasonFor(seasonKey(row?.season, row?.yearIteration, row?.startsAt), () => ({
      code: text(row?.season), label: text(row?.label), yearIteration: row?.yearIteration, startsAt: row?.startsAt, endsAt: row?.endsAt
    }));
    season.days.push(...list(row?.listedDays));
  }
  for (const row of list(module?.entries)) {
    const reference = isObject(row?.reference) ? row.reference : {};
    const season = seasonFor(seasonKey(reference.season, reference.yearIteration, row?.startsAt), () => ({
      code: text(reference.season), label: text(row?.subtitle), yearIteration: reference.yearIteration,
      startsAt: row?.startsAt, endsAt: row?.endsAt, derived: true
    }));
    const entry = toEntry(row, reference);
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
    // Changes with the server or any season's code, yearIteration or startsAt; not with kind or stale (ADR-005).
    contextId: JSON.stringify([view.server ?? null, ...output.map(season => [season.code, season.yearIteration, season.startsAt])]),
    data: { server: view.server, kind: view.kind, stale: view.stale, sourceTime: view.sourceTime },
    seasons: output
  };
}

/**
 * Creates a CalendarSource from one world-state projection: the result of buildWorldView, optionally enriched
 * by enrichWorldRewardArt. One projection belongs to one server, so each server gets its own source.
 *
 * @param {object} view  {server, kind, stale, sourceTime, modules}
 * @returns {import('../application/ports.mjs').CalendarSource}
 * @throws {TypeError} When the projection does not yield a valid CalendarDocument. `error.issues` lists every problem.
 */
export function createWorldStateCalendarSource(view) {
  const document = toCalendarDocument(view);
  const { valid, issues } = validateCalendarDocument(document);
  if (!valid) {
    throw Object.assign(new TypeError(`World-state projection does not form a calendar document: ${issues.map(issue => `${issue.path} ${issue.code}`).join(', ')}`), { issues });
  }
  return Object.freeze({ read: () => structuredClone(document) });
}
