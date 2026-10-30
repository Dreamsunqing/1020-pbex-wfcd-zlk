/**
 * Feature-owned contracts for the 1999 calendar (CAL-01).
 *
 * Contracts are JSDoc typedefs checked at runtime by contract-validation.mjs.
 * There is no TypeScript build step; the description method is recorded in
 * 文档/深入/41-1999日历架构决策与契约.md (ADR-002).
 *
 * Every port is synchronous except where marked, and none of them touches the DOM,
 * the network, the file system or the ambient clock.
 *
 * @typedef {'de'|'wg'} ServerId
 * @typedef {'network'|'sample'|'import'} SourceKind
 * @typedef {'challenge'|'reward'|'upgrade'|'mixed'|'other'} EventKind
 *
 * @typedef {string} UtcInstant
 * An existing UTC time written as YYYY-MM-DDTHH:mm:ssZ or YYYY-MM-DDTHH:mm:ss.sssZ.
 * Offsets, date-only values, free-form text and rolled-over dates such as 2026-02-30 are invalid.
 *
 * @typedef {object} RewardRef
 * @property {string} id            Full item ID. Never shortened or replaced by a display name.
 * @property {string} name          Display name supplied by the host, already localized.
 * @property {number|null} [quantity]
 * @property {string|null} libraryId  Library target. null means no jump control is shown.
 *
 * @typedef {object} TermRef
 * @property {string} name
 * @property {string} [description]
 *
 * @typedef {object} CalendarEntry
 * @property {number|null} ordinal  1999 annual day (1..365). Out-of-range or null entries are kept as unmapped.
 * @property {EventKind} kind
 * @property {string} title
 * @property {RewardRef[]} rewards  Candidate rewards. Never a personal claim.
 * @property {TermRef[]} terms      Challenges, or the three upgrade choices.
 * @property {object} evidence      Raw reference kept for traceability. Never interpreted by the feature.
 *
 * @typedef {object} CalendarSeason
 * @property {string} code          Upstream season code. Unknown codes are valid and yield unmapped entries.
 * @property {string} label
 * @property {number} yearIteration Loop identifier. Never a Gregorian year.
 * @property {UtcInstant} startsAt
 * @property {UtcInstant} endsAt    Strictly after startsAt.
 * @property {number[]} listedDays  Annual day numbers the upstream lists, without duplicates.
 * @property {CalendarEntry[]} entries
 *
 * @typedef {object} CalendarDocument
 * @property {string} contextId     Opaque key. Changes whenever server, season code, yearIteration or startsAt changes.
 * @property {{server: ServerId, kind: SourceKind, stale: boolean, sourceTime: UtcInstant}} data
 * @property {CalendarSeason[]} seasons
 *
 * @typedef {object} SelectionValue
 * @property {number} seasonIndex
 * @property {number} monthIndex    Index into the season's displayed months (0..2).
 * @property {number|null} ordinal  Selected annual day, or null when none is selected.
 */

/**
 * Supplies one already-loaded snapshot. Must be pure: repeated calls return equal data,
 * and the returned object must pass validateCalendarDocument.
 *
 * A session reads its source exactly once, when the session is created.
 * New data never flows into an existing session; the host creates a new source and session instead.
 * @typedef {object} CalendarSource
 * @property {() => CalendarDocument} read
 */

/**
 * Stores UI selection per contextId. The store is owned by the host and outlives sessions,
 * which is how a selection survives a new snapshot with the same contextId.
 * Keys are opaque; values are copied on both read and write.
 * A read can return anything the host stored before, so callers must validate it
 * with validateSelectionValue and fall back to defaults when invalid.
 * @typedef {object} SelectionStore
 * @property {(contextId: string) => SelectionValue|undefined} read
 * @property {(contextId: string, value: SelectionValue) => void} write
 */

/**
 * Operations the presentation may invoke. The session owns selection state.
 *
 * - Creation reads the source once and restores the stored selection for its contextId.
 * - read() is pure. It never writes to the SelectionStore.
 * - Mutating operations write the new selection to the SelectionStore before returning.
 * - Out-of-range indices or ordinals throw RangeError. Invalid input is never silently clamped.
 * - move() never throws for unknown keys; it returns false instead.
 *
 * @typedef {object} CalendarDay
 * @property {number} day            Day of month, 1-based.
 * @property {number} ordinal        1999 annual day.
 * @property {string} date           YYYY-MM-DD in 1999, UTC.
 * @property {number} weekday        0 = Sunday, UTC.
 * @property {boolean} listed        The upstream lists this day, with or without events.
 * @property {EventKind|null} kind   null when the day has no entries.
 * @property {CalendarEntry[]} entries  All entries of the day, in source order. Same-day entries are never merged away.
 *
 * @typedef {object} CalendarMonth
 * @property {number} month          1..12.
 * @property {CalendarDay[]} days
 * @property {number} eventDays
 *
 * @typedef {object} CalendarState
 * @property {CalendarSeason[]} seasons
 * @property {CalendarSeason|null} season
 * @property {CalendarMonth[]} months  Displayed months for the active season, in order. Empty when the season is unmapped.
 * @property {CalendarMonth|null} month
 * @property {CalendarDay|null} selected
 * @property {CalendarEntry[]} unmapped
 * @property {CalendarDocument['data']} data
 * @property {SelectionValue} selection
 *
 * @typedef {object} CalendarOperations
 * @property {() => CalendarState} read
 * @property {(index: number) => CalendarState} selectSeason
 * @property {(index: number) => CalendarState} selectMonth
 * @property {(ordinal: number) => CalendarState} selectDay
 * @property {(key: 'ArrowLeft'|'ArrowRight'|'ArrowUp'|'ArrowDown'|'Home'|'End') => boolean} move
 *
 * @typedef {(ports: {source: CalendarSource, selectionStore: SelectionStore}) => CalendarOperations} CalendarSessionFactory
 * Throws TypeError when a port is missing or the document fails validateCalendarDocument.
 */

/**
 * Presentation model. The grid always has 42 slots (6 weeks); empty slots are null.
 *
 * The application layer provides a pure BuildCalendarViewModel. Presentation obtains a
 * CalendarState from session.read() or from an operation result, then passes it to the builder.
 * Presentation never derives cells, selection or unmapped entries by itself.
 *
 * @typedef {object} CalendarViewModel
 * @property {{label: string, yearIteration: number}[]} seasonOptions
 * @property {number} activeSeasonIndex
 * @property {{code: string, label: string, yearIteration: number, startsAt: UtcInstant, endsAt: UtcInstant}|null} activeSeason
 * @property {{month: number, selected: boolean, eventDays: number}[]} monthTabs
 * @property {{month: number, cells: ({day: number, ordinal: number, date: string, weekday: number, listed: boolean, kind: EventKind|null, selected: boolean, entryCount: number}|null)[]}|null} grid
 * @property {{ordinal: number, date: string, weekday: number, kind: EventKind|null, listed: boolean, entries: CalendarEntry[]}|null} selectedDay
 * @property {CalendarEntry[]} unmapped
 * @property {{server: ServerId, sourceKind: SourceKind, stale: boolean, sourceTime: UtcInstant}} status
 *
 * @typedef {(state: CalendarState) => CalendarViewModel} BuildCalendarViewModel
 * Pure: no clock, no store access, no mutation of state. Equal states produce equal models.
 */

/**
 * Host-injected capabilities. All of them are required.
 * @typedef {object} CalendarCapabilities
 * @property {() => void} close                                   Return to the previous page. Must not throw.
 * @property {(ref: RewardRef) => boolean} openItem               Returns false when the target is unavailable. Does not throw.
 * @property {(ref: {libraryId: string|null, iconToken?: string|null}) => Promise<{status: 'found', src: string}|{status: 'missing'}>} loadArt
 *           Never rejects. Any failure maps to {status: 'missing'}.
 * @property {(target: Element, text: string, mode: 'name'|'description') => void} renderText
 *           Must keep unknown tokens visible as written.
 * @property {(startsAt: UtcInstant, endsAt: UtcInstant, now: number) => {text: string, ended: boolean}} formatDeadline
 *           `now` is epoch milliseconds supplied by the caller. Core code never reads the clock.
 */

/**
 * @typedef {object} CalendarViewHandle
 * @property {() => void} update   Repaint from the current session only. It does not fetch or accept new data
 *                                 and never changes the selection.
 * @property {() => void} destroy  Remove listeners and generated DOM. Idempotent; update() after destroy() is a no-op.
 *
 * @typedef {(container: Element, deps: {session: CalendarOperations, capabilities: CalendarCapabilities}) => CalendarViewHandle} CalendarViewFactory
 * Mounting into a container that already has a handle destroys the previous handle first.
 * When a new snapshot arrives, the host creates a new source and session and mounts again.
 * The same contextId restores its selection from the SelectionStore; a different contextId starts isolated.
 */

export const CALENDAR_CONTRACT_VERSION = '1.0.0';
