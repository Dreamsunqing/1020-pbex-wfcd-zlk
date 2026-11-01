import { createCalendarMount, createCalendarSession, createCalendarView, createMemorySelectionStore, createWorldStateCalendarSource } from '../features/calendar-1999/index.mjs';
import { formatCountdown } from '../core/live-state/presentation.mjs';
import { renderGameText } from './game-text.js';

// Composition root of the 1999 calendar (CAL-07). It is the only App module that imports the calendar feature, and the
// feature never reaches back: it sees the App only through the capabilities built here.
//
// Rules, also listed in 文档/深入/47-1999日历App能力转接与组装入口.md:
// - One SelectionStore for the lifetime of the App, shared by every session, so a selection survives a new snapshot of
//   the same context and stays apart for other servers, seasons and loops (HANDOFF-02).
// - show() builds a new source and session from the projection on every call (ADR-007), then mounts the view. The view is
//   the feature's createCalendarView (CAL-08) unless another one is injected. It answers false when the view is set to
//   null, or when the projection or the view fails; the caller then keeps the legacy cards.
// - The view's stylesheet, features/calendar-1999/presentation/calendar.css, is linked by src/ui/index.html.
// - tick() is the countdown beat. The host clock calls it, and it repaints through update(). When the projection's
//   freshness changed in place, it builds a new session instead, so an outdated snapshot never keeps looking current.
// - hide() unmounts. The host calls it whenever it replaces the content that holds the calendar.
// - Capabilities only adapt App functions. No calendar rule is copied here; countdown text is the host's shared rule, and
//   pictures are asked with the same request the legacy cards send.

const MISSING = Object.freeze({ status: 'missing' });
const reportError = (error, where) => console.error(`1999 日历 ${where} 失败`, error);

// The image request the legacy cards send for each calendar reward, by library ID. RewardRef keeps only identity and
// library fields (HANDOFF-01), but the App image service also matches by image name, icon and blueprint result, so the
// host looks them up in its own projection, as enriched by reward-art.mjs. A reward missing here is asked by ID only.
function imageRequests(projection) {
  const requests = new Map();
  const entries = (Array.isArray(projection?.modules) ? projection.modules : []).find(module => module?.id === 'calendar')?.entries;
  for (const entry of Array.isArray(entries) ? entries : []) {
    for (const row of Array.isArray(entry?.rewards) ? entry.rewards : []) {
      if (typeof row?.libraryId !== 'string' || row.libraryId === '' || requests.has(row.libraryId)) continue;
      const { imageName, blueprint, resultId, resultImageName, icon, abilityIcon } = row;
      const request = { id: row.imageId ?? row.libraryId, imageName, blueprint, resultId, resultImageName, icon, abilityIcon };
      requests.set(row.libraryId, Object.fromEntries(Object.entries(request).filter(([, value]) => value !== undefined)));
    }
  }
  return requests;
}

// One picture per reward. A composite image (blueprint, tau shard) shows its item layer, or else its top layer.
function pictureOf(image) {
  if (typeof image?.dataUrl === 'string' && image.dataUrl) return image.dataUrl;
  const layers = Array.isArray(image?.layers) ? image.layers : [];
  const layer = layers.find(value => value?.role === 'item') ?? layers.at(-1);
  return typeof layer?.dataUrl === 'string' && layer.dataUrl ? layer.dataUrl : null;
}

/**
 * @param {object} deps
 * @param {{images?: (requests: object[]) => Promise<object[]>}} deps.api  The App bridge (window.workbench); only images() is used.
 * @param {() => void} deps.back  Returns to the world-state page.
 * @param {(id: string, version?: string) => Promise<void>} [deps.openLibrary]  Opens an item in the library. Without it no
 *        reward can be opened.
 * @param {(work: () => unknown) => Promise<unknown>} [deps.guarded]  Runs App work and reports its failure to the user.
 * @param {Function|null} [deps.view]  The presentation's CalendarViewFactory, as the feature's ports define it. Defaults to
 *        the feature's createCalendarView; null keeps the legacy cards, and show() then answers false.
 * @param {(target: Element, text: string, mode: 'name'|'description') => void} [deps.renderText]
 * @param {() => number} [deps.now]
 * @param {(error: unknown, where: string) => void} [deps.onError]  Receives failures the calendar absorbs.
 */
export function createCalendar1999Host({ api, back, openLibrary, guarded, view = createCalendarView, renderText = renderGameText, now = Date.now, onError = reportError } = {}) {
  if (typeof back !== 'function') throw new TypeError('Calendar host needs back() to return to the world-state page');
  const run = typeof guarded === 'function' ? guarded : work => Promise.resolve().then(work).catch(error => onError(error, 'openItem'));
  const selectionStore = createMemorySelectionStore();
  // Art of the current mount only: repaints reuse it, and the next mount asks again, so a newly chosen gallery is seen.
  const art = new Map();
  let requests = new Map();

  const capabilities = Object.freeze({
    close: () => back(),
    openItem(ref) {
      if (typeof openLibrary !== 'function' || typeof ref?.libraryId !== 'string' || ref.libraryId === '') return false;
      // The library opens asynchronously; a changed dataset version or any other failure is reported by guarded.
      void run(() => openLibrary(ref.libraryId, ref.libraryVersion ?? undefined));
      return true;
    },
    loadArt(ref) {
      const id = ref?.libraryId;
      if (typeof id !== 'string' || id === '' || typeof api?.images !== 'function') return Promise.resolve(MISSING);
      if (!art.has(id)) {
        const request = Promise.resolve().then(() => api.images([requests.get(id) ?? { id }])).then(images => {
          const src = pictureOf(images?.[0]);
          return src ? Object.freeze({ status: 'found', src }) : MISSING;
        }, () => {
          // A failed request is asked again next time; an answered "no picture" is kept for this mount.
          if (art.get(id) === request) art.delete(id);
          return MISSING;
        });
        art.set(id, request);
      }
      return art.get(id);
    },
    renderText(target, text, mode) {
      // Game text must stay readable even when a token cannot be drawn.
      try { renderText(target, text, mode); } catch (error) { onError(error, 'renderText'); target.textContent = String(text ?? ''); }
    },
    formatDeadline(startsAt, endsAt, at) {
      const text = formatCountdown(startsAt, endsAt, at);
      return { text, ended: text === '已结束' };
    },
    now: () => now()
  });

  const mount = view ? createCalendarMount({ view, capabilities, onError }) : null;
  let shown = null;

  function hide() {
    shown = null;
    art.clear();
    requests = new Map();
    mount?.unmount();
  }

  function show(container, projection) {
    hide();
    if (!mount) return false;
    try {
      const session = createCalendarSession({ source: createWorldStateCalendarSource(projection), selectionStore });
      requests = imageRequests(projection);
      mount.mount(container, session);
    } catch (error) {
      onError(error, 'show');
      return false;
    }
    shown = { container, projection, stale: projection.stale };
    return true;
  }

  function tick() {
    if (!shown) return false;
    if (shown.projection.stale !== shown.stale) return show(shown.container, shown.projection);
    return mount.update();
  }

  return Object.freeze({ show, tick, hide });
}
