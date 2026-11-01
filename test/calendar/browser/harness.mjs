import { createCalendarMount, createCalendarSession, createCalendarView, createMemorySelectionStore, createWorldStateCalendarSource } from '/src/features/calendar-1999/index.mjs';

// Browser harness for scripts/check-calendar-ui.mjs (CAL-08). It mounts the real view through the public entry and the
// real mount, with recording fake capabilities and small fixed scenarios. Test data only: never a current schedule.
// CAL-09 builds the interactive standalone page; this harness only exposes window.calendarHarness to the check.

// Count every timer the page asks for: the calendar must never create one (ADR-009).
const timers = [];
for (const name of ['setTimeout', 'setInterval', 'requestAnimationFrame', 'requestIdleCallback']) {
  const original = window[name];
  if (typeof original === 'function') window[name] = (...args) => { timers.push(name); return original.apply(window, args); };
}

const PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const calls = [];
const operations = [];
let now = Date.parse('2026-10-28T06:00:00.000Z');
let artMode = 'found';
let openResult = true;

const capabilities = {
  close: () => { calls.push(['close']); },
  openItem: ref => { calls.push(['openItem', ref.id, ref.libraryId, ref.libraryVersion ?? null]); return openResult; },
  loadArt: ref => {
    calls.push(['loadArt', ref.libraryId]);
    if (artMode === 'pending') return new Promise(() => {});
    if (artMode === 'broken') return Promise.resolve({ status: 'found', src: 'data:image/png;base64,broken' });
    return Promise.resolve(artMode === 'found' ? { status: 'found', src: PIXEL } : { status: 'missing' });
  },
  renderText: (target, text, mode) => { calls.push(['renderText', mode]); target.textContent = text; },
  // Same wording as the App's shared formatCountdown, kept small: hours only.
  formatDeadline: (startsAt, endsAt, at) => {
    const start = Date.parse(startsAt), upcoming = start > at, left = (upcoming ? start : Date.parse(endsAt)) - at;
    if (!Number.isFinite(left)) return { text: '', ended: false };
    if (left <= 0) return { text: '已结束', ended: true };
    return { text: `${upcoming ? '还有 ' : ''}${Math.floor(left / 3600000)}时 ${Math.floor(left / 60000) % 60}分${upcoming ? '开始' : '后结束'}`, ended: false };
  },
  now: () => now
};
const mount = createCalendarMount({ view: createCalendarView, capabilities, onError: (error, where) => calls.push(['error', where, String(error?.message ?? error)]) });
// The store and the sources count their use, so the check can prove that update() neither writes nor reads again.
const memory = createMemorySelectionStore();
const usage = { writes: 0, sourceReads: 0 };
const store = { read: key => memory.read(key), write: (key, value) => { usage.writes++; memory.write(key, value); } };
const slot = document.getElementById('slot');
let current = null;

const fixture = async file => (await fetch(`/test/calendar/fixtures/${file}`)).json();
const documentSource = document => ({ read: () => structuredClone(document) });
const LONG = '超长名称'.repeat(12) + 'Lotus/Types/Items/MiscItems/ThisIsAnUnbrokenIdentifierWithoutSpacesThatMustWrapInsteadOfOverflowing';

async function spring(data = {}) {
  const document = await fixture('contracts/valid-document.json');
  return { ...document, data: { ...document.data, ...data } };
}

// Each scenario returns a CalendarSource. live, stale and spring share one contextId: a new snapshot of one season.
const scenarios = {
  winter: async () => createWorldStateCalendarSource(await fixture('world-state/projection-de.json')),
  spring: async () => documentSource(await spring()),
  live: async () => documentSource(await spring({ kind: 'network', stale: false })),
  stale: async () => documentSource(await spring({ kind: 'network', stale: true })),
  imported: async () => documentSource(await spring({ kind: 'import', stale: true })),
  // One projected day holding a reward event and three upgrade events: the adapter makes it a single 'mixed' entry.
  // multi, below, is the other case: several independent entries on one day, each with its own kind.
  async mixedEntry() {
    const projection = await fixture('world-state/projection-de.json');
    const module = projection.modules.find(row => row.id === 'calendar');
    const reward = module.entries.find(entry => entry.reference.day === 19);
    const upgrade = module.entries.find(entry => entry.reference.day === 20);
    reward.terms = upgrade.terms;
    reward.reference.events = [...reward.reference.events, ...upgrade.reference.events];
    module.entries = module.entries.filter(entry => entry !== upgrade);
    return createWorldStateCalendarSource(projection);
  },
  async multi() {
    const document = await spring();
    const [challenge, reward, upgrade] = document.seasons[0].entries;
    document.contextId = 'multi';
    // Three entries on day 101, in source order, plus the mixed day the domain would build from them.
    document.seasons[0].entries = [challenge, { ...reward }, { ...challenge, ordinal: 101 }, { ...upgrade, ordinal: 101 }, upgrade];
    return documentSource(document);
  },
  unknown: async () => documentSource(await fixture('contracts/valid-unmapped-entry.json')),
  async unmapped() {
    const document = await spring();
    document.contextId = 'unmapped';
    document.seasons[0].entries.push(
      { ordinal: 366, kind: 'other', title: '超出全年范围', rewards: [], terms: [], evidence: { day: 366 } },
      { ordinal: 200, kind: 'challenge', title: '不在本季月份', rewards: [], terms: [{ name: '季外挑战' }], evidence: { day: 200 } });
    return documentSource(document);
  },
  async empty() {
    const document = await spring();
    return documentSource({ ...document, contextId: 'empty', seasons: [] });
  },
  async quiet() {
    const document = await spring();
    document.contextId = 'quiet';
    document.seasons[0].entries = [];
    return documentSource(document);
  },
  async seasons() {
    const document = await spring();
    document.contextId = 'seasons';
    document.seasons.push({ ...document.seasons[0], code: 'CST_SUMMER', label: '夏季', yearIteration: 25, listedDays: [190],
      entries: [{ ordinal: 190, kind: 'reward', title: '夏季奖励', rewards: [{ id: '/Test/Summer', name: '夏季奖励', quantity: 2, libraryId: '/Test/Summer' }], terms: [], evidence: { day: 190 } }] });
    return documentSource(document);
  },
  async long() {
    const document = await spring();
    document.contextId = 'long';
    const season = document.seasons[0];
    season.label = '一个非常非常长的季度名称用来检查标题不会溢出也不会被静默截断';
    season.entries[1] = { ...season.entries[1], rewards: [
      { id: '/Test/Long', name: LONG, quantity: 12345, libraryId: '/Test/Long' },
      { id: '/Test/Unlinked/' + 'X'.repeat(60), name: '资料库没有收录的奖励', quantity: null, libraryId: null }
    ] };
    season.entries[2] = { ...season.entries[2], terms: season.entries[2].terms.map((term, index) => ({ ...term, name: `${LONG} ${index + 1}`, description: '很长的说明文字，'.repeat(30) + 'https://example.invalid/' + 'path/'.repeat(30) })) };
    return documentSource(document);
  }
};

// The session is wrapped so the check can see every operation the view performs, including any after destroy.
function recorded(session) {
  const wrap = name => (...args) => { operations.push([name, ...args]); return session[name](...args); };
  return { read: session.read, selectSeason: wrap('selectSeason'), selectMonth: wrap('selectMonth'), selectDay: wrap('selectDay'), move: wrap('move') };
}

function counted(source) {
  return { read: () => { usage.sourceReads++; return source.read(); } };
}

window.calendarHarness = Object.freeze({
  async mount(name) {
    current = createCalendarSession({ source: counted(await scenarios[name]()), selectionStore: store });
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
    const session = createCalendarSession({ source: await scenarios.spring(), selectionStore: createMemorySelectionStore() });
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
  setArt: mode => { artMode = mode; },
  setOpenItem: value => { openResult = value; },
  takeCalls: () => calls.splice(0),
  takeOperations: () => operations.splice(0),
  timers: () => [...timers]
});
document.documentElement.dataset.ready = 'true';
