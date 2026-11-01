import { createCalendarMount, createCalendarSession, createCalendarView, createMemorySelectionStore } from '/src/features/calendar-1999/index.mjs';
import { createFakeCapabilities, DEFAULT_SETTINGS } from './fake-capabilities.mjs';
import { loadScenario } from './scenarios.mjs';

// Browser harness for scripts/check-calendar-ui.mjs (CAL-08). It mounts the real view through the public entry and the
// real mount, with the recording fake capabilities and the fixed scenarios that the standalone page also uses (CAL-09).
// Test data only: never a current schedule. The page for people is standalone.html; this harness only exposes
// window.calendarHarness to the check, always on the DE server.

// Count every timer the page asks for: the calendar must never create one (ADR-009).
const timers = [];
for (const name of ['setTimeout', 'setInterval', 'requestAnimationFrame', 'requestIdleCallback']) {
  const original = window[name];
  if (typeof original === 'function') window[name] = (...args) => { timers.push(name); return original.apply(window, args); };
}

const calls = [];
const operations = [];
let now = Date.parse('2026-10-28T06:00:00.000Z');
const settings = { ...DEFAULT_SETTINGS };
const capabilities = createFakeCapabilities({ settings, now: () => now, record: call => calls.push(call) });
const mount = createCalendarMount({ view: createCalendarView, capabilities, onError: (error, where) => calls.push(['error', where, String(error?.message ?? error)]) });
// The store and the sources count their use, so the check can prove that update() neither writes nor reads again.
const memory = createMemorySelectionStore();
const usage = { writes: 0, sourceReads: 0 };
const store = { read: key => memory.read(key), write: (key, value) => { usage.writes++; memory.write(key, value); } };
const slot = document.getElementById('slot');
let current = null;

// The session is wrapped so the check can see every operation the view performs, including any after destroy.
function recorded(session) {
  const wrap = name => (...args) => { operations.push([name, ...args]); return session[name](...args); };
  return { read: session.read, selectSeason: wrap('selectSeason'), selectMonth: wrap('selectMonth'), selectDay: wrap('selectDay'), move: wrap('move') };
}

function counted(source) {
  return { read: () => { usage.sourceReads++; return source.read(); } };
}

window.calendarHarness = Object.freeze({
  // A scenario id of scenarios.mjs. stale, imported and live share the spring contextId: new snapshots of one season.
  async mount(name) {
    const { source } = await loadScenario(name);
    current = createCalendarSession({ source: counted(source), selectionStore: store });
    mount.mount(slot, recorded(current));
    return mount.isMounted();
  },
  // Calls an operation on the mounted session from outside the view, as another part of a host could; then answers the
  // session's selection. The view learns about it only through update().
  external: (name, ...args) => { current[name](...args); return { ...current.read().selection }; },
  selection: () => ({ ...current.read().selection }),
  // A view made directly, without the mount: after destroy(), update() must leave nothing behind, even when its session
  // changed in the meantime.
  async destroyedUpdate() {
    const box = document.createElement('div');
    document.body.append(box);
    const { source } = await loadScenario('spring');
    const session = createCalendarSession({ source, selectionStore: createMemorySelectionStore() });
    const handle = createCalendarView(box, { session, capabilities });
    const drawn = box.childElementCount;
    handle.destroy();
    session.selectDay(104);
    let error = null;
    try { handle.update(); handle.destroy(); } catch (failure) { error = String(failure?.message ?? failure); }
    const children = box.childElementCount;
    box.remove();
    return { drawn, children, error };
  },
  usage: () => ({ ...usage }),
  update: () => mount.update(),
  unmount: () => mount.unmount(),
  isMounted: () => mount.isMounted(),
  setNow: value => { now = value; },
  // found, missing, broken or pending; fake-capabilities.mjs lists every mode.
  setArt: mode => { settings.art = mode; },
  setOpenItem: value => { settings.openItem = value ? 'accept' : 'unavailable'; },
  takeCalls: () => calls.splice(0),
  takeOperations: () => operations.splice(0),
  timers: () => [...timers]
});
document.documentElement.dataset.ready = 'true';
