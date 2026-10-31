import { buildSeasonMonths } from '../domain/calendar.mjs';
import { validateCalendarDocument, validateSelectionValue } from './contract-validation.mjs';

// Calendar session (CAL-03): the only owner of season, month and day selection. Presentation calls these
// operations and draws the returned state through view-model.mjs; it never decides a selection by itself.
//
// Rules, also listed in 文档/深入/44-1999日历应用操作流程.md:
// - The source is read exactly once. Its document is validated, copied and frozen, so neither the source nor a
//   caller can change the session afterwards. New data means a new source and a new session (ADR-007).
// - read() is pure. Only an operation that changes the selection writes it to the SelectionStore. The store is
//   written first and the session commits after, so a failing write leaves the session as it was. The store stays as
//   it was only because SelectionStore.write is atomic (CAL-05); the session never writes again to roll it back.
// - Invalid arguments throw RangeError and change nothing. Choosing the active season, month or day again is a no-op.
// - A selection is a date on the season's calendar, never personal progress. It is keyed by contextId, which isolates
//   servers, seasons and loops, and a stored value is trusted only after it passes validation and fits the document.

const MOVE_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End']);
const STEPS = Object.freeze({ ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 });
const NO_LAYOUT = Object.freeze({ months: Object.freeze([]), unmapped: Object.freeze([]) });
const isIndexOf = (value, list) => Number.isInteger(value) && value >= 0 && value < list.length;
const sameSelection = (a, b) => a.seasonIndex === b.seasonIndex && a.monthIndex === b.monthIndex && a.ordinal === b.ordinal;

function deepFreeze(value) {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

/**
 * Creates the session for one snapshot. See CalendarSessionFactory and CalendarOperations in ports.mjs.
 * @param {{source: import('./ports.mjs').CalendarSource, selectionStore: import('./ports.mjs').SelectionStore}} ports
 * @returns {import('./ports.mjs').CalendarOperations}
 * @throws {TypeError} When a port is missing or the document fails validateCalendarDocument. `error.issues` lists every problem.
 */
export function createCalendarSession({ source, selectionStore } = {}) {
  if (typeof source?.read !== 'function') throw new TypeError('Calendar session needs a CalendarSource with read()');
  if (typeof selectionStore?.read !== 'function' || typeof selectionStore?.write !== 'function') {
    throw new TypeError('Calendar session needs a SelectionStore with read() and write()');
  }
  const snapshot = source.read();
  const { valid, issues } = validateCalendarDocument(snapshot);
  if (!valid) {
    throw Object.assign(new TypeError(`Calendar source did not return a valid CalendarDocument: ${issues.map(issue => `${issue.path} ${issue.code}`).join(', ')}`), { issues });
  }
  const { contextId, data, seasons } = deepFreeze(structuredClone(snapshot));
  // A frozen season always aligns the same way, so each one is aligned once.
  const layouts = seasons.map(season => deepFreeze(buildSeasonMonths(season)));
  const monthsOf = seasonIndex => (layouts[seasonIndex] ?? NO_LAYOUT).months;
  const firstEventDay = month => month?.days.find(day => day.entries.length)?.ordinal ?? null;

  // Initial strategy: the given month of the season, on its first day with events, or on no day when it has none.
  const initial = (seasonIndex, monthIndex = 0) => ({ seasonIndex, monthIndex, ordinal: firstEventDay(monthsOf(seasonIndex)[monthIndex]) });

  // Keeps a stored value as far as it still fits the document. From the first part that does not fit, the
  // initial strategy chooses again: an unknown season restarts everything, a missing month keeps only the season.
  function restore(stored) {
    if (!validateSelectionValue(stored).valid || stored.seasonIndex >= Math.max(seasons.length, 1)) return initial(0);
    const months = monthsOf(stored.seasonIndex);
    if (stored.monthIndex >= Math.max(months.length, 1)) return initial(stored.seasonIndex);
    const days = months[stored.monthIndex]?.days ?? [];
    if (stored.ordinal !== null && !days.some(day => day.ordinal === stored.ordinal)) return initial(stored.seasonIndex, stored.monthIndex);
    return { seasonIndex: stored.seasonIndex, monthIndex: stored.monthIndex, ordinal: stored.ordinal };
  }

  // Creation restores but never writes: the store only ever holds what the user chose.
  let selection = restore(selectionStore.read(contextId));

  function read() {
    const layout = layouts[selection.seasonIndex] ?? NO_LAYOUT;
    const month = layout.months[selection.monthIndex] ?? null;
    return Object.freeze({
      seasons,
      season: seasons[selection.seasonIndex] ?? null,
      months: layout.months,
      month,
      selected: month?.days.find(day => day.ordinal === selection.ordinal) ?? null,
      unmapped: layout.unmapped,
      data,
      selection: Object.freeze({ ...selection })
    });
  }

  function commit(next) {
    if (!sameSelection(next, selection)) {
      selectionStore.write(contextId, { ...next });
      selection = next;
    }
    return read();
  }

  function selectSeason(index) {
    if (!isIndexOf(index, seasons)) throw new RangeError('Calendar season index is out of range');
    return commit(index === selection.seasonIndex ? selection : { seasonIndex: index, monthIndex: 0, ordinal: null });
  }

  function selectMonth(index) {
    if (!isIndexOf(index, monthsOf(selection.seasonIndex))) throw new RangeError('Calendar month index is outside the active season');
    return commit(index === selection.monthIndex ? selection : { ...selection, monthIndex: index, ordinal: null });
  }

  function selectDay(ordinal) {
    const month = monthsOf(selection.seasonIndex)[selection.monthIndex];
    if (!month?.days.some(day => day.ordinal === ordinal)) throw new RangeError('Calendar day is outside the active month');
    return commit({ ...selection, ordinal });
  }

  // Arrow keys move by a day or a week and may cross into another month of the season, never into another season.
  // Home and End go to the start or end of the selected week row, inside the active month.
  // Without a selected day, End enters the month on its last day and every other key on its first day.
  function move(key) {
    const months = monthsOf(selection.seasonIndex);
    const month = months[selection.monthIndex];
    if (!month || !MOVE_KEYS.has(key)) return false;
    const { days } = month;
    const current = days.find(day => day.ordinal === selection.ordinal);
    let target;
    if (!current) target = key === 'End' ? days.at(-1) : days[0];
    else if (key === 'Home') target = days[Math.max(0, current.day - 1 - current.weekday)];
    else if (key === 'End') target = days[Math.min(days.length - 1, current.day - 1 + 6 - current.weekday)];
    else target = months.flatMap(value => value.days).find(day => day.ordinal === current.ordinal + STEPS[key]);
    if (!target) return false;
    commit({ ...selection, monthIndex: months.findIndex(value => value.days.includes(target)), ordinal: target.ordinal });
    return true;
  }

  return Object.freeze({ read, selectSeason, selectMonth, selectDay, move });
}
