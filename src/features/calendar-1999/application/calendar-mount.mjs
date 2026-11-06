import { validateCalendarCapabilities } from './contract-validation.mjs';

// Calendar mount (CAL-07): the lifecycle of the one calendar slot a host shows. The host composition root decides when
// to mount, update and unmount; this module guarantees what then happens, whatever the view or the host capabilities do.
//
// Rules, also listed in 文档/深入/47-1999日历App能力转接与组装入口.md:
// - One view at a time. mount() unmounts the current view first, whatever its container, so opening again never stacks
//   listeners or timers. A view that throws or returns no handle leaves nothing mounted.
// - Each mount gets its own guarded copy of the capabilities, a lease. unmount() releases the lease before it destroys the
//   view, so nothing the old view started can reach the host or the old DOM: close, openItem and renderText do nothing,
//   and a pending loadArt never settles.
// - The guarded copy also enforces the failure rules of CalendarCapabilities: openItem answers a boolean, loadArt and
//   loadPortrait never reject and answer found or missing, formatDeadline answers text and ended. Absorbed errors go to
//   onError. loadPortrait is optional for a host (CAL-11); the copy always has it and answers missing without it.
// - The mount owns no timer, listener, clock or data. Countdowns are repainted by the host calling update() (ADR-009).

// A fresh promise every time: nothing keeps it, so the continuation of a released view is collected instead of piling up.
const never = () => new Promise(() => {});
const artResult = value => value?.status === 'found' && typeof value.src === 'string' && value.src !== ''
  ? { status: 'found', src: value.src }
  : { status: 'missing' };

function lease(capabilities, report) {
  let alive = true;
  const attempt = (name, run, fallback) => {
    try { return run(); } catch (error) { report(error, name); return fallback; }
  };
  // The executor also turns a synchronous throw into a rejection, which then maps to missing like any other failure.
  const picture = (name, ask) => new Promise(resolve => resolve(ask()))
    .then(artResult, error => { report(error, name); return { status: 'missing' }; })
    .then(result => alive ? result : never());
  return {
    release() { alive = false; },
    capabilities: Object.freeze({
      close() {
        if (alive) attempt('close', () => { capabilities.close(); });
      },
      openItem(ref) {
        return alive && attempt('openItem', () => capabilities.openItem(ref) === true, false);
      },
      loadArt(ref) {
        return alive ? picture('loadArt', () => capabilities.loadArt(ref)) : never();
      },
      loadPortrait(ref) {
        if (!alive) return never();
        return typeof capabilities.loadPortrait === 'function' ? picture('loadPortrait', () => capabilities.loadPortrait(ref)) : Promise.resolve({ status: 'missing' });
      },
      renderText(target, text, mode) {
        if (alive) attempt('renderText', () => { capabilities.renderText(target, text, mode); });
      },
      // Pure, so both stay available after release; a released view never asks for them anyway.
      formatDeadline(startsAt, endsAt, now) {
        return attempt('formatDeadline', () => {
          const result = capabilities.formatDeadline(startsAt, endsAt, now);
          return { text: typeof result?.text === 'string' ? result.text : '', ended: result?.ended === true };
        }, { text: '', ended: false });
      },
      now() {
        return attempt('now', () => { const value = capabilities.now(); return typeof value === 'number' ? value : Number.NaN; }, Number.NaN);
      }
    })
  };
}

/**
 * Creates the lifecycle of one calendar slot. See CalendarMount and CalendarMountFactory in ports.mjs.
 * @param {{view: import('./ports.mjs').CalendarViewFactory, capabilities: import('./ports.mjs').CalendarCapabilities,
 *   onError?: (error: unknown, capability: string) => void}} deps
 * @returns {import('./ports.mjs').CalendarMount}
 * @throws {TypeError} When the view is not a function or a capability is missing. `error.issues` lists every missing capability.
 */
export function createCalendarMount({ view, capabilities, onError } = {}) {
  if (typeof view !== 'function') throw new TypeError('Calendar mount needs a CalendarViewFactory function');
  if (onError !== undefined && typeof onError !== 'function') throw new TypeError('Calendar mount onError must be a function');
  const { valid, issues } = validateCalendarCapabilities(capabilities);
  if (!valid) {
    throw Object.assign(new TypeError(`Calendar mount needs every CalendarCapabilities member: ${issues.map(issue => `${issue.path} ${issue.code}`).join(', ')}`), { issues });
  }
  const report = (error, capability) => {
    try { onError?.(error, capability); } catch { /* A failing reporter must not break the calendar. */ }
  };
  let current = null;
  // Counts every mount and unmount, so a view that closes or reopens the slot while it is still mounting is caught.
  let generation = 0;

  function unmount() {
    generation++;
    if (!current) return;
    const { handle, release } = current;
    current = null;
    release();
    handle.destroy();
  }

  function mount(container, session) {
    if (typeof session?.read !== 'function') throw new TypeError('Calendar mount needs a session from createCalendarSession');
    unmount();
    const ticket = generation;
    const { capabilities: guarded, release } = lease(capabilities, report);
    let handle;
    try {
      handle = view(container, { session, capabilities: guarded });
    } catch (error) {
      release();
      throw error;
    }
    if (typeof handle?.update !== 'function' || typeof handle?.destroy !== 'function') {
      release();
      throw new TypeError('Calendar view must return a handle with update() and destroy()');
    }
    if (ticket !== generation) {
      // The slot was unmounted or mounted again while this view was mounting. This view is already out of date.
      release();
      handle.destroy();
      return;
    }
    current = { handle, release };
  }

  function update() {
    if (!current) return false;
    current.handle.update();
    return true;
  }

  return Object.freeze({ mount, update, unmount, isMounted: () => current !== null });
}
