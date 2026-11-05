import { createCalendarMount, createCalendarSession, createCalendarView, createMemorySelectionStore, createWorldStateCalendarSource } from '../features/calendar-1999/index.mjs';
import { formatCountdown } from '../core/live-state/presentation.mjs';
import { renderGameText } from './game-text.js';
import { REWARD_ART_ROOT, indexRewardArt, rewardArtKey } from './calendar-1999-art.js';
import REWARD_ART from './assets/calendar-1999/reward-art.js';

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
//   the image service is asked with the same request the legacy cards send.
// - Pictures (CAL-10, 文档/深入/50-1999日历奖励图片映射.md) are looked up in this order: a valid entry of the reward art
//   mapping (assets/calendar-1999/reward-art.js), found by the reward's full ID under the storeItemId rule; then the App
//   image service, by library ID; then missing, which the view draws as its placeholder. Picture and jump are apart: a
//   mapped reward without a library target still shows its picture, and openItem still depends on libraryId only.
// - The mapping is read once, when the host is created; each entry it refuses is reported to onError and left out. A
//   mapped file that cannot be read is reported with its reason, and the lookup goes on to the image service.

const MISSING = Object.freeze({ status: 'missing' });
const RETRY = Symbol('retry');
const found = src => Object.freeze({ status: 'found', src });
const reportError = (error, where) => console.error(`1999 日历 ${where} 失败`, error);

// The browser reads a bundled picture as an image: the page allows images from the App, never fetches (connect-src 'none').
function loadPicture(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('浏览器无法载入或解码这个图档'));
    image.src = src;
  });
}

function mappingProblem(problem) {
  const error = new Error(`奖励图片映射有一笔无效，已略过：${problem.id ?? '整个映射'}：${problem.message}`);
  return Object.assign(error, { code: problem.code, rewardId: problem.id, path: problem.path });
}

function unreadablePicture(entry, cause) {
  const error = new Error(`奖励图片映射的图档无法读取，改用 App 图片服务：${entry.id} → ${REWARD_ART_ROOT}${entry.path}`, { cause });
  return Object.assign(error, { code: 'ART_FILE_UNREADABLE', rewardId: entry.id, path: entry.path, src: entry.src });
}

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
 * @param {(error: unknown, where: string) => void} [deps.onError]  Receives failures the calendar absorbs, and the
 *        mapping entries that are left out ('rewardArt') or whose file cannot be read ('loadArt'). Such an error carries
 *        code, rewardId and path.
 * @param {object} [deps.rewardArt]  The reward art mapping, {[rewardId]: path relative to src/ui/assets/}. Defaults to
 *        assets/calendar-1999/reward-art.js.
 * @param {(src: string) => Promise<void>} [deps.readPicture]  Resolves when a mapped picture can be shown, rejects otherwise.
 */
export function createCalendar1999Host({ api, back, openLibrary, guarded, view = createCalendarView, renderText = renderGameText, now = Date.now, onError = reportError, rewardArt = REWARD_ART, readPicture = loadPicture } = {}) {
  if (typeof back !== 'function') throw new TypeError('Calendar host needs back() to return to the world-state page');
  const run = typeof guarded === 'function' ? guarded : work => Promise.resolve().then(work).catch(error => onError(error, 'openItem'));
  const selectionStore = createMemorySelectionStore();
  const mapping = indexRewardArt(rewardArt);
  for (const problem of mapping.issues) onError(mappingProblem(problem), 'rewardArt');
  // Art of the current mount only: repaints reuse it, and the next mount asks again, so a newly chosen gallery is seen.
  const art = new Map();
  let requests = new Map();

  // A mapped picture, or null when the file cannot be read; the reason goes to onError.
  const mappedArt = entry => Promise.resolve().then(() => readPicture(entry.src))
    .then(() => found(entry.src), error => { onError(unreadablePicture(entry, error), 'loadArt'); return null; });
  // The App image service. A failed request is asked again next time; an answered "no picture" is kept for this mount.
  const libraryArt = id => Promise.resolve().then(() => api.images([requests.get(id) ?? { id }]))
    .then(images => { const src = pictureOf(images?.[0]); return src ? found(src) : MISSING; }, () => RETRY);

  const capabilities = Object.freeze({
    close: () => back(),
    openItem(ref) {
      if (typeof openLibrary !== 'function' || typeof ref?.libraryId !== 'string' || ref.libraryId === '') return false;
      // The library opens asynchronously; a changed dataset version or any other failure is reported by guarded.
      void run(() => openLibrary(ref.libraryId, ref.libraryVersion ?? undefined));
      return true;
    },
    loadArt(ref) {
      const entry = mapping.entries.get(rewardArtKey(ref?.id));
      const libraryId = typeof ref?.libraryId === 'string' && ref.libraryId !== '' && typeof api?.images === 'function' ? ref.libraryId : null;
      if (!entry && libraryId === null) return Promise.resolve(MISSING);
      // One answer per mapped item and library target for this mount; both spellings of an item give the same mapped key.
      const key = JSON.stringify([entry?.key ?? null, libraryId]);
      if (!art.has(key)) {
        const request = (entry ? mappedArt(entry) : Promise.resolve(null))
          .then(result => result ?? (libraryId === null ? MISSING : libraryArt(libraryId)))
          .then(result => {
            if (result !== RETRY) return result;
            if (art.get(key) === request) art.delete(key);
            return MISSING;
          });
        art.set(key, request);
      }
      return art.get(key);
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
