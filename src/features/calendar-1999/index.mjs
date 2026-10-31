// Public entry point for the 1999 calendar feature.
// CAL-01 exposes the contract version, the shared vocabulary and the validators only.
// The CAL-02 date and alignment rules in domain/calendar.mjs stay internal; the application session consumes them.
// Session, adapters and presentation are added by later CAL issues and must be imported through this file.
export { CALENDAR_CONTRACT_VERSION } from './application/ports.mjs';
export { EVENT_KINDS, isEventKind } from './domain/event-kind.mjs';
export { validateCalendarDocument, validateSelectionValue } from './application/contract-validation.mjs';
// CAL-04: the host composition root turns its world-state projection into a CalendarSource with this adapter.
export { createWorldStateCalendarSource } from './adapters/world-state-source.mjs';
// CAL-03: the host composition root creates one session per snapshot from a CalendarSource and its SelectionStore.
// application/view-model.mjs stays internal; presentation inside the feature turns session state into its model.
export { createCalendarSession } from './application/calendar-session.mjs';
