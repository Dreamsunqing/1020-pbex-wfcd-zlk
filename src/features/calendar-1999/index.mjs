// Public entry point for the 1999 calendar feature.
// CAL-01 exposes the contract version, the shared vocabulary and the validators only.
// The CAL-02 date and alignment rules in domain/calendar.mjs stay internal; the application session consumes them.
// Session, adapters and presentation are added by later CAL issues and must be imported through this file.
export { CALENDAR_CONTRACT_VERSION } from './application/ports.mjs';
export { EVENT_KINDS, isEventKind } from './domain/event-kind.mjs';
export { validateCalendarDocument, validateSelectionValue, validateCalendarCapabilities } from './application/contract-validation.mjs';
// CAL-04: the host composition root turns its world-state projection into a CalendarSource with this adapter.
export { createWorldStateCalendarSource } from './adapters/world-state-source.mjs';
// CAL-11: the verified birthday table the adapter recognises birthdays with. Read-only; hosts and checks read its
// portraitKey values to map character pictures, and never change a record.
export { HEX_BIRTHDAYS } from './adapters/hex-birthdays.mjs';
// CAL-03: the host composition root creates one session per snapshot from a CalendarSource and its SelectionStore.
// application/view-model.mjs stays internal; presentation inside the feature turns session state into its model.
export { createCalendarSession } from './application/calendar-session.mjs';
// CAL-05: the host keeps one store for every session, so a selection survives a new snapshot of the same context.
export { createMemorySelectionStore } from './adapters/memory-selection-store.mjs';
// CAL-07: the host keeps one mount for its calendar slot and injects the view and the capabilities the mount guards.
// The App composition root is src/ui/calendar-1999.js.
export { createCalendarMount } from './application/calendar-mount.mjs';
// CAL-08: the native DOM CalendarViewFactory the host hands to its mount. Its stylesheet is presentation/calendar.css,
// which the host page links itself; the view never adds styles to a document.
export { createCalendarView } from './presentation/calendar-view.js';
