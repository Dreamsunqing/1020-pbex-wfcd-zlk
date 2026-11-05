// Fake host capabilities for the 1999 calendar test pages (CAL-09), shared by the standalone page and the harness of the
// browser check. Nothing here is the App: no library, no image service, no game text and no real clock.
//
// - Behaviour follows `settings`, read at each call, so a page can switch a mode without building new capabilities.
// - Every call is passed to `record` first, as an array: ['close'], ['openItem', id, libraryId, libraryVersion],
//   ['loadArt', id, libraryId] or ['renderText', mode]. scripts/check-calendar-ui.mjs compares these arrays.
// - The failing modes break the CalendarCapabilities contract of application/ports.mjs on purpose: close and openItem
//   throw, loadArt rejects. They show what the mount's guarded copy turns such failures into (CAL-07).
// - The art mode answers every reward alike, with or without a library target, the way a mapped picture of the App's
//   reward art mapping does (CAL-10). Which source wins in the App is checked by test/calendar/composition.test.mjs.

export const ART_MODES = Object.freeze({
  found: '找到图片',
  missing: '缺图',
  broken: '坏图（无法解码）',
  pending: '一直载入',
  slow: '1.5 秒后找到',
  error: '请求失败'
});
export const OPEN_MODES = Object.freeze({ accept: '接受跳转', unavailable: '跳转不可用', error: '跳转抛错' });
export const CLOSE_MODES = Object.freeze({ accept: '正常关闭', error: '关闭抛错' });
export const DEFAULT_SETTINGS = Object.freeze({ art: 'found', openItem: 'accept', close: 'accept' });

// A 1×1 PNG: enough for the view to show a picture instead of its placeholder.
const PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const SLOW_MS = 1500;

/**
 * @param {object} deps
 * @param {{art: string, openItem: string, close: string}} deps.settings  Read at each call.
 * @param {() => number} deps.now  The page's fake clock, epoch milliseconds.
 * @param {(call: unknown[]) => void} [deps.record]
 * @param {() => void} [deps.onClose]  What the host does when the calendar asks to close.
 * @returns {import('../../../src/features/calendar-1999/application/ports.mjs').CalendarCapabilities}
 */
export function createFakeCapabilities({ settings, now, record = () => {}, onClose = () => {} }) {
  return Object.freeze({
    close() {
      record(['close']);
      if (settings.close === 'error') throw new Error('测试：关闭失败');
      onClose();
    },
    openItem(ref) {
      record(['openItem', ref.id, ref.libraryId, ref.libraryVersion ?? null]);
      if (settings.openItem === 'error') throw new Error('测试：资料库跳转失败');
      return settings.openItem === 'accept';
    },
    loadArt(ref) {
      record(['loadArt', ref.id, ref.libraryId]);
      switch (settings.art) {
        case 'found': return Promise.resolve({ status: 'found', src: PIXEL });
        case 'broken': return Promise.resolve({ status: 'found', src: 'data:image/png;base64,broken' });
        case 'pending': return new Promise(() => {});
        case 'slow': return new Promise(resolve => setTimeout(() => resolve({ status: 'found', src: PIXEL }), SLOW_MS));
        case 'error': return Promise.reject(new Error('测试：图片服务无法连线'));
        default: return Promise.resolve({ status: 'missing' });
      }
    },
    renderText(target, text, mode) {
      record(['renderText', mode]);
      // Game tokens are kept as written, which the contract asks of every host.
      target.textContent = text;
    },
    // Same wording as the App's shared formatCountdown, kept small: hours and minutes only.
    formatDeadline(startsAt, endsAt, at) {
      const start = Date.parse(startsAt), upcoming = start > at, left = (upcoming ? start : Date.parse(endsAt)) - at;
      if (!Number.isFinite(left)) return { text: '', ended: false };
      if (left <= 0) return { text: '已结束', ended: true };
      return { text: `${upcoming ? '还有 ' : ''}${Math.floor(left / 3600000)}时 ${Math.floor(left / 60000) % 60}分${upcoming ? '开始' : '后结束'}`, ended: false };
    },
    now: () => now()
  });
}
