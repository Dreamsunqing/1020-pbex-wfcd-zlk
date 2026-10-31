// Presentation model (CAL-03, ADR-008). Pure: it reads only the CalendarState it is given, never the session, the
// store or the clock, and it never mutates that state. Equal states give equal models.
// Presentation draws this model and sends user actions back to the session; it never derives cells or a selection.

const GRID_SLOTS = 42;

/**
 * @param {import('./ports.mjs').CalendarState} state  From session.read() or the result of an operation.
 * @returns {import('./ports.mjs').CalendarViewModel}
 */
export function buildCalendarViewModel(state) {
  if (state === null || typeof state !== 'object') throw new TypeError('Calendar view model needs a CalendarState');
  const { seasons, season, months, month, selected, unmapped, data, selection } = state;
  return {
    seasonOptions: seasons.map(({ label, yearIteration }) => ({ label, yearIteration })),
    activeSeasonIndex: selection.seasonIndex,
    activeSeason: season && { code: season.code, label: season.label, yearIteration: season.yearIteration, startsAt: season.startsAt, endsAt: season.endsAt },
    monthTabs: months.map((value, index) => ({ month: value.month, selected: index === selection.monthIndex, eventDays: value.eventDays })),
    grid: month && { month: month.month, cells: gridCells(month, selected) },
    selectedDay: selected && { ordinal: selected.ordinal, date: selected.date, weekday: selected.weekday, kind: selected.kind, listed: selected.listed, entries: selected.entries },
    // Entries stay the session's frozen objects, so full reward IDs and evidence reach presentation unchanged.
    unmapped,
    status: { server: data.server, sourceKind: data.kind, stale: data.stale, sourceTime: data.sourceTime }
  };
}

// Six weeks starting on Sunday. Day 1 sits under its UTC weekday; slots before it and after the last day are null.
function gridCells(month, selected) {
  const leading = month.days[0].weekday;
  return Array.from({ length: GRID_SLOTS }, (_, slot) => {
    const day = month.days[slot - leading];
    return day ? {
      day: day.day, ordinal: day.ordinal, date: day.date, weekday: day.weekday, listed: day.listed, kind: day.kind,
      selected: day.ordinal === selected?.ordinal, entryCount: day.entries.length
    } : null;
  });
}
