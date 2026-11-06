import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createCalendarMount, createCalendarSession, createMemorySelectionStore, validateCalendarCapabilities } from '../../src/features/calendar-1999/index.mjs';
import { createCalendar1999Host } from '../../src/ui/calendar-1999.js';
import { formatCountdown } from '../../src/core/live-state/presentation.mjs';

// Composition tests (CAL-07). The first half checks the feature mount with recording views and fake capabilities; the
// second half drives the App composition root with the world-state fixture, a fake App bridge and a recording view.
// No DOM is needed: containers and text targets are plain objects, which is all a mount and its capabilities may assume.
const root = new URL('../../', import.meta.url);
const featureDir = new URL('src/features/calendar-1999/', root);
const fixture = file => JSON.parse(readFileSync(new URL(`./fixtures/${file}`, import.meta.url), 'utf8'));
const flush = async (rounds = 5) => { for (let round = 0; round < rounds; round++) await new Promise(resolve => setImmediate(resolve)); };
const FORMA = '/Lotus/Types/Items/MiscItems/Forma';

async function isPending(promise) {
  let settled = false;
  promise.then(() => { settled = true; }, () => { settled = true; });
  await flush();
  return !settled;
}

function deferred() {
  let resolve, reject;
  const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

// Records every handle it creates. A handle counts as live, with its listeners and DOM, until it is destroyed.
function recordingView(behavior = {}) {
  const log = { handles: [], live: new Set() };
  const view = (container, deps) => {
    const handle = {
      container, deps, updates: 0, destroyed: 0,
      update() { handle.updates++; behavior.onUpdate?.(handle); },
      destroy() { handle.destroyed++; log.live.delete(handle); }
    };
    log.handles.push(handle);
    log.live.add(handle);
    behavior.onMount?.(handle);
    return handle;
  };
  return { view, log };
}

function fakeCapabilities(overrides = {}) {
  const calls = [];
  const capabilities = {
    close: () => { calls.push(['close']); },
    openItem: ref => { calls.push(['openItem', ref.libraryId]); return true; },
    loadArt: ref => { calls.push(['loadArt', ref.libraryId]); return Promise.resolve({ status: 'found', src: 'data:image/png;base64,AA' }); },
    renderText: (target, text, mode) => { calls.push(['renderText', text, mode]); target.textContent = text; },
    formatDeadline: (startsAt, endsAt, now) => ({ text: `deadline at ${now}`, ended: false }),
    now: () => 1_000,
    ...overrides
  };
  return { capabilities, calls };
}

const sessionOf = (document = fixture('contracts/valid-document.json')) =>
  createCalendarSession({ source: { read: () => structuredClone(document) }, selectionStore: createMemorySelectionStore() });

test('capabilities are a checked contract: every member must be a function, and extra members are ignored', () => {
  const { capabilities } = fakeCapabilities();
  assert.deepEqual(validateCalendarCapabilities(capabilities), { valid: true, issues: [] });
  assert.equal(validateCalendarCapabilities({ ...capabilities, extra: 1 }).valid, true);
  for (const value of [null, undefined, [], 'capabilities']) {
    assert.deepEqual(validateCalendarCapabilities(value).issues.map(issue => issue.code), ['INVALID_CAPABILITIES']);
  }
  const { now, loadArt, ...rest } = capabilities;
  const result = validateCalendarCapabilities({ ...rest, loadArt: 'not a function' });
  assert.equal(result.valid, false);
  assert.deepEqual(result.issues.map(issue => [issue.path, issue.code]), [['loadArt', 'MISSING_CAPABILITY'], ['now', 'MISSING_CAPABILITY']]);
});

test('a mount refuses a missing view, a bad onError or incomplete capabilities, and lists every missing capability', () => {
  const { capabilities } = fakeCapabilities();
  const { view } = recordingView();
  assert.throws(() => createCalendarMount({ capabilities }), TypeError);
  assert.throws(() => createCalendarMount({ view, capabilities, onError: 'log' }), TypeError);
  assert.throws(() => createCalendarMount(), TypeError);
  const { close, ...withoutClose } = capabilities;
  assert.throws(() => createCalendarMount({ view, capabilities: withoutClose }), error =>
    error instanceof TypeError && error.issues.some(issue => issue.path === 'close' && issue.code === 'MISSING_CAPABILITY'));
  const mount = createCalendarMount({ view, capabilities });
  assert.throws(() => mount.mount({}, null), TypeError, 'a mount needs a session');
  assert.equal(mount.isMounted(), false);
});

test('mounting hands the view the session and a guarded copy of the capabilities; update repaints and unmount destroys once', async () => {
  const { capabilities, calls } = fakeCapabilities();
  const { view, log } = recordingView();
  const mount = createCalendarMount({ view, capabilities });
  const container = {};
  const session = sessionOf();
  assert.equal(mount.update(), false, 'nothing to repaint yet');
  mount.mount(container, session);
  const [handle] = log.handles;
  assert.equal(handle.container, container);
  assert.equal(handle.deps.session, session);
  const guarded = handle.deps.capabilities;
  // The view never receives the host object, only a frozen copy with exactly the contract members. The optional
  // loadPortrait (CAL-11) is always there; this host has none, so every portrait is missing.
  assert.notEqual(guarded, capabilities);
  assert.ok(Object.isFrozen(guarded));
  assert.deepEqual(Object.keys(guarded).sort(), ['close', 'formatDeadline', 'loadArt', 'loadPortrait', 'now', 'openItem', 'renderText']);
  assert.deepEqual(await guarded.loadPortrait({ key: 'hex-arthur' }), { status: 'missing' });
  assert.equal(guarded.openItem({ libraryId: FORMA }), true);
  assert.deepEqual(await guarded.loadArt({ libraryId: FORMA }), { status: 'found', src: 'data:image/png;base64,AA' });
  assert.deepEqual(guarded.formatDeadline('2026-10-19T00:00:00Z', '2026-10-26T00:00:00Z', guarded.now()), { text: 'deadline at 1000', ended: false });
  assert.deepEqual(calls, [['openItem', FORMA], ['loadArt', FORMA]]);
  assert.equal(mount.isMounted(), true);
  assert.equal(mount.update(), true);
  assert.equal(handle.updates, 1);
  mount.unmount();
  mount.unmount();
  assert.equal(handle.destroyed, 1, 'unmount is idempotent');
  assert.equal(mount.isMounted(), false);
  assert.equal(mount.update(), false);
  assert.equal(handle.updates, 1, 'update after unmount never reaches the old view');
});

test('opening again, in the same or another container, destroys the previous view first, so views never pile up', () => {
  const { capabilities } = fakeCapabilities();
  const { view, log } = recordingView();
  const mount = createCalendarMount({ view, capabilities });
  const containers = [{}, {}];
  for (let index = 0; index < 20; index++) {
    mount.mount(containers[index % 2], sessionOf());
    assert.equal(log.live.size, 1, `open #${index + 1}`);
  }
  assert.equal(log.handles.length, 20);
  assert.deepEqual(log.handles.map(handle => handle.destroyed), [...Array(19).fill(1), 0]);
  mount.unmount();
  assert.equal(log.live.size, 0);
});

test('a released view cannot reach the host: close, openItem and renderText do nothing, and openItem answers false', () => {
  const { capabilities, calls } = fakeCapabilities();
  const { view, log } = recordingView();
  const mount = createCalendarMount({ view, capabilities });
  mount.mount({}, sessionOf());
  const old = log.handles[0].deps.capabilities;
  mount.mount({}, sessionOf());
  const target = { textContent: 'before' };
  old.close();
  assert.equal(old.openItem({ libraryId: FORMA }), false);
  old.renderText(target, '<DT_FIRE>', 'description');
  assert.deepEqual(calls, []);
  assert.equal(target.textContent, 'before');
  // The current view keeps working, and pure capabilities stay pure for everyone.
  assert.equal(log.handles[1].deps.capabilities.openItem({ libraryId: FORMA }), true);
  assert.equal(old.now(), 1_000);
  assert.deepEqual(old.formatDeadline('a', 'b', 5), { text: 'deadline at 5', ended: false });
});

test('a picture that arrives after unmount never reaches the old view, while one that arrives in time does', async () => {
  const pending = [];
  const { capabilities } = fakeCapabilities({ loadArt: () => { const request = deferred(); pending.push(request); return request.promise; } });
  const { view, log } = recordingView();
  const mount = createCalendarMount({ view, capabilities });
  mount.mount({}, sessionOf());
  const guarded = log.handles[0].deps.capabilities;
  const inTime = guarded.loadArt({ libraryId: FORMA });
  const late = guarded.loadArt({ libraryId: FORMA });
  const failedLate = guarded.loadArt({ libraryId: FORMA });
  pending[0].resolve({ status: 'found', src: 'data:in-time' });
  assert.deepEqual(await inTime, { status: 'found', src: 'data:in-time' });
  mount.unmount();
  pending[1].resolve({ status: 'found', src: 'data:late' });
  pending[2].reject(new Error('gallery closed'));
  assert.equal(await isPending(late), true, 'a late picture never settles');
  assert.equal(await isPending(failedLate), true, 'a late failure never settles either');
  // Asking a released lease does not even reach the host.
  assert.equal(await isPending(guarded.loadArt({ libraryId: FORMA })), true);
  assert.equal(pending.length, 3);
});

test('guarded capabilities keep the failure rules of the contract even when the host breaks them', async () => {
  const errors = [];
  const fail = message => () => { throw new Error(message); };
  const host = fakeCapabilities({
    close: fail('close'),
    openItem: ref => ref.libraryId === 'throws' ? fail('openItem')() : 'yes',
    loadArt: ref => ({ throws: fail('loadArt'), rejects: () => Promise.reject(new Error('rejected')), empty: () => Promise.resolve({ status: 'found', src: '' }),
      garbage: () => Promise.resolve(42), plain: () => ({ status: 'found', src: 'data:plain' }) })[ref.libraryId](),
    renderText: fail('renderText'),
    formatDeadline: (startsAt) => startsAt === 'throws' ? fail('formatDeadline')() : { text: 7, ended: 'yes' },
    now: fail('now')
  });
  const { view, log } = recordingView();
  createCalendarMount({ view, capabilities: host.capabilities, onError: (error, capability) => errors.push(capability) }).mount({}, sessionOf());
  const guarded = log.handles[0].deps.capabilities;
  assert.doesNotThrow(() => guarded.close());
  assert.equal(guarded.openItem({ libraryId: 'throws' }), false);
  assert.equal(guarded.openItem({ libraryId: 'returns yes' }), false, 'only true means the host accepted');
  for (const id of ['throws', 'rejects', 'empty', 'garbage']) assert.deepEqual(await guarded.loadArt({ libraryId: id }), { status: 'missing' }, id);
  assert.deepEqual(await guarded.loadArt({ libraryId: 'plain' }), { status: 'found', src: 'data:plain' }, 'a plain value is accepted like a promise');
  assert.doesNotThrow(() => guarded.renderText({}, 'text', 'name'));
  assert.deepEqual(guarded.formatDeadline('throws', 'b', 0), { text: '', ended: false });
  assert.deepEqual(guarded.formatDeadline('a', 'b', 0), { text: '', ended: false });
  assert.ok(Number.isNaN(guarded.now()));
  assert.deepEqual(errors, ['close', 'openItem', 'loadArt', 'loadArt', 'renderText', 'formatDeadline', 'now']);
  // A reporter that fails itself changes nothing for the calendar.
  const { view: second, log: secondLog } = recordingView();
  createCalendarMount({ view: second, capabilities: host.capabilities, onError: fail('reporter') }).mount({}, sessionOf());
  assert.equal(secondLog.handles[0].deps.capabilities.openItem({ libraryId: 'throws' }), false);
});

test('a view that throws or returns no handle leaves nothing mounted and its capabilities released', () => {
  const { capabilities, calls } = fakeCapabilities();
  let leaked;
  const throwing = createCalendarMount({ view: (container, deps) => { leaked = deps.capabilities; throw new Error('paint failed'); }, capabilities });
  assert.throws(() => throwing.mount({}, sessionOf()), /paint failed/);
  assert.equal(throwing.isMounted(), false);
  assert.equal(leaked.openItem({ libraryId: FORMA }), false);
  for (const handle of [undefined, {}, { update() {} }]) {
    const broken = createCalendarMount({ view: (container, deps) => { leaked = deps.capabilities; return handle; }, capabilities });
    assert.throws(() => broken.mount({}, sessionOf()), TypeError);
    assert.equal(broken.isMounted(), false);
    leaked.close();
  }
  assert.deepEqual(calls, []);
  // A failed mount still released the previous view first.
  const { view, log } = recordingView();
  let fail = false;
  const mount = createCalendarMount({ view: (container, deps) => { if (fail) throw new Error('second view failed'); return view(container, deps); }, capabilities });
  mount.mount({}, sessionOf());
  fail = true;
  assert.throws(() => mount.mount({}, sessionOf()));
  assert.equal(log.handles[0].destroyed, 1);
  assert.equal(mount.isMounted(), false);
});

test('a view that closes the calendar while mounting or repainting is destroyed exactly once', () => {
  let mount;
  const { capabilities } = fakeCapabilities({ close: () => mount.unmount() });
  const { view, log } = recordingView({
    onMount: handle => { if (handle.container.closeWhileMounting) handle.deps.capabilities.close(); },
    onUpdate: handle => handle.deps.capabilities.close()
  });
  mount = createCalendarMount({ view, capabilities });
  mount.mount({ closeWhileMounting: true }, sessionOf());
  assert.equal(mount.isMounted(), false, 'the view closed itself before it was mounted');
  assert.equal(log.handles[0].destroyed, 1);
  mount.mount({}, sessionOf());
  assert.equal(mount.update(), true);
  assert.equal(log.handles[1].destroyed, 1);
  assert.equal(mount.isMounted(), false);
  mount.unmount();
  assert.equal(log.handles[1].destroyed, 1);
});

// --- App composition root -------------------------------------------------------------------------------------------

// readPicture stands in for the browser reading a bundled picture: by default it reads the file the URL names, so a
// mapped path that points nowhere fails here as it would in the App.
function app({ view = recordingView().view, images, openLibrary, guarded, now = () => Date.parse('2026-10-22T19:32:27.000Z'), renderText, rewardArt, readPicture } = {}) {
  const record = { backs: 0, images: [], library: [], guarded: 0, errors: [], texts: [], pictures: [], problems: [], raw: [] };
  const api = { images: images ?? (requests => { record.images.push(requests); return Promise.resolve([{ dataUrl: `data:${requests[0].id}` }]); }) };
  const host = createCalendar1999Host({
    api,
    back: () => { record.backs++; },
    openLibrary: openLibrary ?? (async (id, version) => { record.library.push([id, version]); }),
    guarded: guarded ?? (async work => { record.guarded++; try { return await work(); } catch (error) { record.errors.push(['guarded', error.message]); } }),
    view,
    renderText: renderText ?? ((target, text, mode) => { record.texts.push([text, mode]); target.textContent = text; }),
    now,
    onError: (error, where) => {
      record.errors.push([where, error.message]);
      record.raw.push(error);
      if (error?.code) record.problems.push([where, error.code, error.rewardId, error.path]);
    },
    ...(rewardArt === undefined ? {} : { rewardArt }),
    readPicture: readPicture ?? (src => { record.pictures.push(src); return access(fileURLToPath(src)); })
  });
  return { host, record, api };
}

const projection = (changes = {}) => ({ ...fixture('world-state/projection-de.json'), ...changes });

test('the App composition root keeps the legacy cards when the view is set to null, and builds nothing for them', () => {
  const record = [];
  const host = createCalendar1999Host({ api: { images: requests => { record.push(requests); return Promise.resolve([]); } }, back: () => record.push('back'), view: null });
  assert.equal(host.show({}, projection()), false);
  assert.equal(host.tick(), false);
  assert.doesNotThrow(() => host.hide());
  assert.deepEqual(record, []);
  assert.throws(() => createCalendar1999Host({ api: {} }), TypeError, 'back is required');
});

test('by default the App composition root mounts the feature view (CAL-08), and a view that cannot mount keeps the legacy cards', () => {
  const composition = code(fileURLToPath(new URL('src/ui/calendar-1999.js', root)));
  assert.match(composition, /\bview = createCalendarView\b/, 'the default view is the feature presentation');
  // A container that is not a DOM element makes the real view refuse to mount; show() reports it and answers false.
  const errors = [];
  const host = createCalendar1999Host({ api: {}, back: () => {}, onError: (error, where) => errors.push([where, error.constructor.name]) });
  assert.equal(host.show({}, projection()), false);
  assert.deepEqual(errors, [['show', 'TypeError']]);
  assert.equal(host.tick(), false);
  // The App page links the view's stylesheet exactly once; no other App stylesheet styles the calendar root.
  const page = readFileSync(new URL('src/ui/index.html', root), 'utf8');
  assert.equal(page.match(/<link rel="stylesheet" href="\.\.\/features\/calendar-1999\/presentation\/calendar\.css">/g)?.length, 1);
  const ui = fileURLToPath(new URL('src/ui/', root));
  for (const file of readdirSync(ui).filter(name => name.endsWith('.css'))) assert.doesNotMatch(readFileSync(path.join(ui, file), 'utf8'), /\.cal99/, file);
});

test('show builds a session from the world-state projection and mounts the view; hide unmounts it', () => {
  const { view, log } = recordingView();
  const { host } = app({ view });
  const container = {};
  assert.equal(host.show(container, projection()), true);
  const [handle] = log.handles;
  assert.equal(handle.container, container);
  const state = handle.deps.session.read();
  assert.equal(state.data.server, 'de');
  assert.equal(state.season.code, 'CST_WINTER');
  assert.equal(state.selected.ordinal, 3, 'the session opens on the first event day');
  host.hide();
  assert.equal(handle.destroyed, 1);
  assert.equal(host.tick(), false);
});

test('one store serves every session: a new snapshot of the same context restores the selection, another server starts apart', () => {
  const { view, log } = recordingView();
  const { host } = app({ view });
  const session = () => log.handles.at(-1).deps.session;
  host.show({}, projection());
  session().selectDay(19);
  host.show({}, projection({ sourceTime: '2026-10-22T20:00:00.000Z', kind: 'network', stale: false }));
  assert.equal(session().read().selection.ordinal, 19, 'freshness is not part of the context');
  host.show({}, projection({ server: 'wg' }));
  assert.equal(session().read().selection.ordinal, 3, 'WG never sees the DE selection');
  host.show({}, projection());
  assert.equal(session().read().selection.ordinal, 19);
  assert.equal(log.live.size, 1);
});

test('a projection the adapter refuses, or a failing view, falls back to the legacy cards and is reported', () => {
  const { view, log } = recordingView();
  const { host, record } = app({ view });
  host.show({}, projection());
  assert.equal(host.show({}, { server: 'de', modules: 'not a list' }), false);
  assert.equal(log.handles[0].destroyed, 1, 'the old calendar is gone before the fallback');
  assert.equal(log.live.size, 0);
  assert.equal(record.errors.length, 1);
  assert.equal(record.errors[0][0], 'show');
  const broken = app({ view: () => { throw new Error('paint failed'); } });
  assert.equal(broken.host.show({}, projection()), false);
  assert.deepEqual(broken.record.errors, [['show', 'paint failed']]);
});

test('item navigation opens the library with the full ID and version, and is refused without a library target', async () => {
  const { view, log } = recordingView();
  const { host, record } = app({ view });
  host.show({}, projection());
  const { openItem } = log.handles[0].deps.capabilities;
  const [reward] = log.handles[0].deps.session.read().seasons[0].entries.find(entry => entry.ordinal === 19).rewards;
  assert.equal(reward.libraryId, FORMA);
  assert.equal(openItem(reward), true);
  assert.equal(openItem({ ...reward, libraryVersion: null }), true);
  assert.equal(openItem({ id: '/Lotus/StoreItems/Types/Gameplay/NarmerSorties/ArchonCrystalOrange', name: 'ArchonCrystalOrange', libraryId: null }), false);
  await flush();
  assert.deepEqual(record.library, [[FORMA, 'fixture-library-v1'], [FORMA, undefined]]);
  assert.equal(record.guarded, 2, 'the App reports a failed jump through guarded');
  // A refused jump, such as a library on another dataset version, never reaches the calendar as an error.
  const refusing = app({ view, openLibrary: async () => { throw new Error('世界状态所用资料版本已变化，请刷新世界状态'); } });
  refusing.host.show({}, projection());
  assert.equal(log.handles.at(-1).deps.capabilities.openItem(reward), true);
  await flush();
  assert.deepEqual(refusing.record.errors, [['guarded', '世界状态所用资料版本已变化，请刷新世界状态']]);
  const withoutLibrary = createCalendar1999Host({ api: {}, back: () => {}, view });
  withoutLibrary.show({}, projection());
  assert.equal(log.handles.at(-1).deps.capabilities.openItem(reward), false);
});

test('pictures come from the App image service by library ID, once per mount, and every failure is missing', async () => {
  let answer = requests => [{ dataUrl: `data:${requests[0].id}` }];
  const { view, log } = recordingView();
  const { host, record } = app({ view, images: requests => { record.images.push(requests); return Promise.resolve().then(() => answer(requests)); } });
  host.show({}, projection());
  const loadArt = () => log.handles.at(-1).deps.capabilities.loadArt;
  assert.deepEqual(await loadArt()({ libraryId: FORMA }), { status: 'found', src: `data:${FORMA}` });
  assert.deepEqual(await loadArt()({ libraryId: FORMA }), { status: 'found', src: `data:${FORMA}` });
  assert.deepEqual(record.images, [[{ id: FORMA }]], 'repaints reuse the picture');
  assert.deepEqual(await loadArt()({ libraryId: null }), { status: 'missing' });
  assert.deepEqual(await loadArt()({ libraryId: '' }), { status: 'missing' });
  assert.equal(record.images.length, 1, 'no request without a library target');
  answer = () => [{ kind: 'blueprint', layers: [{ role: 'base', dataUrl: 'data:base' }, { role: 'item', dataUrl: 'data:item' }] }];
  assert.deepEqual(await loadArt()({ libraryId: 'blueprint' }), { status: 'found', src: 'data:item' });
  // RewardRef has no image fields, so the host asks with the request the legacy cards send for the same reward.
  const enriched = projection();
  enriched.modules.find(module => module.id === 'calendar').entries[1].rewards.push({
    id: '/Lotus/StoreItems/Types/Recipes/Bp', name: '蓝图', quantity: 1, imageId: '/Lotus/Types/Recipes/Bp', libraryId: '/Lotus/Types/Recipes/Bp',
    imageName: 'bp.png', blueprint: true, resultId: '/Lotus/Types/Product', resultImageName: 'product.png', libraryVersion: 'fixture-library-v1'
  });
  host.show({}, enriched);
  await loadArt()({ libraryId: '/Lotus/Types/Recipes/Bp' });
  assert.deepEqual(record.images.at(-1), [{ id: '/Lotus/Types/Recipes/Bp', imageName: 'bp.png', blueprint: true, resultId: '/Lotus/Types/Product', resultImageName: 'product.png' }]);
  await loadArt()({ libraryId: FORMA });
  assert.deepEqual(record.images.at(-1), [{ id: FORMA }], 'a reward without image fields is asked by its ID');
  answer = () => [null];
  assert.deepEqual(await loadArt()({ libraryId: 'unknown' }), { status: 'missing' });
  answer = () => { throw new Error('image service down'); };
  assert.deepEqual(await loadArt()({ libraryId: 'down' }), { status: 'missing' });
  answer = requests => [{ dataUrl: `data:${requests[0].id}` }];
  assert.deepEqual(await loadArt()({ libraryId: 'down' }), { status: 'found', src: 'data:down' }, 'a failed request is asked again');
  const before = record.images.length;
  host.show({}, projection());
  await loadArt()({ libraryId: FORMA });
  assert.equal(record.images.length, before + 1, 'a new mount asks again');
  const noImages = createCalendar1999Host({ api: {}, back: () => {}, view });
  noImages.show({}, projection());
  assert.deepEqual(await loadArt()({ libraryId: FORMA }), { status: 'missing' });
});

// --- Reward art mapping (CAL-10) ----------------------------------------------------------------------------------------

const PACK_STORE = '/Lotus/StoreItems/Types/BoosterPacks/CalendarMajorArtifactPack';
const PACK = '/Lotus/Types/BoosterPacks/CalendarMajorArtifactPack';
const PACK_FILE = 'calendar-1999/rewards/CalendarMajorArtifactPack.png';
const artProjection = () => fixture('world-state/projection-reward-art.json');
// The fixture's four rewards as the session hands them to the view: the pack in both spellings (day 56 without a library
// item, day 57 with one), Forma with a library item and no mapping, and an archon crystal with neither.
function artRewards(handle) {
  const entries = handle.deps.session.read().seasons[0].entries;
  const [packStore, forma] = entries.find(entry => entry.ordinal === 56).rewards;
  const [pack, crystal] = entries.find(entry => entry.ordinal === 57).rewards;
  return { packStore, forma, pack, crystal };
}
// What the view sends for a reward: its full ID and its library target.
const askArt = (handle, reward) => handle.deps.capabilities.loadArt({ id: reward.id, libraryId: reward.libraryId });

test('reward art: a valid mapping comes first, serves both ID spellings, and needs no library item', async () => {
  const { view, log } = recordingView();
  const { host, record } = app({ view });
  assert.deepEqual(record.errors, [], 'the bundled mapping is valid');
  host.show({}, artProjection());
  const handle = log.handles[0];
  const { packStore, forma, pack, crystal } = artRewards(handle);
  assert.deepEqual([packStore.id, packStore.libraryId, pack.id, pack.libraryId], [PACK_STORE, null, PACK, PACK]);
  const mapped = await askArt(handle, packStore);
  assert.deepEqual(mapped, { status: 'found', src: new URL(`src/ui/assets/${PACK_FILE}`, root).href });
  assert.deepEqual(await askArt(handle, pack), mapped, 'the /Lotus/ spelling finds the same picture');
  assert.deepEqual(record.images, [], 'the mapping wins over the image service, even for a reward the service knows');
  assert.deepEqual(record.pictures, [mapped.src, mapped.src], 'the picture was read from the App image root');
  // Picture and jump are apart: the pack without a library item shows its picture and still has no jump.
  const { openItem } = handle.deps.capabilities;
  assert.equal(openItem(packStore), false);
  assert.equal(openItem(pack), true);
  await flush();
  assert.deepEqual(record.library, [[PACK, 'fixture-library-v1']]);
  // Without a mapping a library item asks the image service, and a reward with neither keeps the placeholder.
  assert.deepEqual(await askArt(handle, forma), { status: 'found', src: `data:${FORMA}` });
  assert.deepEqual(await askArt(handle, crystal), { status: 'missing' });
  assert.deepEqual(record.images, [[{ id: FORMA }]], 'a reward without a library item never reaches the service');
  await askArt(handle, packStore);
  assert.equal(record.pictures.length, 2, 'repaints reuse the answer of this mount');
  assert.deepEqual(record.errors, []);
});

test('reward art: without the mapping, or when its file cannot be read, the image service answers; with neither, the placeholder', async () => {
  const { view, log } = recordingView();
  const ask = reward => askArt(log.handles.at(-1), reward);
  // The mapping removed.
  const removed = app({ view, rewardArt: {} });
  removed.host.show({}, artProjection());
  const { packStore, pack } = artRewards(log.handles.at(-1));
  assert.deepEqual(await ask(pack), { status: 'found', src: `data:${PACK}` });
  assert.deepEqual(await ask(packStore), { status: 'missing' });
  assert.deepEqual(removed.record.images, [[{ id: PACK }]]);
  assert.deepEqual(removed.record.pictures, []);
  // The mapped file is missing: the reason is reported with the entry, and the lookup goes on without the mapping.
  const gone = app({ view, rewardArt: { [PACK_STORE]: 'calendar-1999/rewards/Gone.png' } });
  assert.deepEqual(gone.record.errors, [], 'a well-formed entry is only found unreadable when it is asked for');
  gone.host.show({}, artProjection());
  assert.deepEqual(await ask(pack), { status: 'found', src: `data:${PACK}` });
  assert.deepEqual(await ask(packStore), { status: 'missing' });
  assert.deepEqual(gone.record.problems, [
    ['loadArt', 'ART_FILE_UNREADABLE', PACK_STORE, 'calendar-1999/rewards/Gone.png'],
    ['loadArt', 'ART_FILE_UNREADABLE', PACK_STORE, 'calendar-1999/rewards/Gone.png']
  ]);
  assert.match(gone.record.errors[0][1], /图档无法读取，改用 App 图片服务：\/Lotus\/StoreItems\/Types\/BoosterPacks\/CalendarMajorArtifactPack → src\/ui\/assets\/calendar-1999\/rewards\/Gone\.png$/);
  assert.equal(gone.record.raw[0].cause.code, 'ENOENT', 'the reason keeps its cause');
  assert.match(gone.record.raw[0].src, /src\/ui\/assets\/calendar-1999\/rewards\/Gone\.png$/);
  assert.deepEqual(gone.record.images, [[{ id: PACK }]]);
  // A picture the browser cannot decode is unreadable too; with no service picture either, the placeholder stays.
  const broken = app({ view, readPicture: () => Promise.reject(new Error('decode failed')), images: () => Promise.resolve([null]) });
  broken.host.show({}, artProjection());
  assert.deepEqual(await ask(pack), { status: 'missing' });
  assert.deepEqual(broken.record.problems, [['loadArt', 'ART_FILE_UNREADABLE', PACK_STORE, PACK_FILE]]);
  assert.equal(broken.record.raw[0].cause.message, 'decode failed');
  // A host without an image service still shows mapped pictures.
  const offline = createCalendar1999Host({ api: {}, back: () => {}, view, readPicture: () => Promise.resolve() });
  offline.show({}, artProjection());
  assert.equal((await ask(pack)).status, 'found');
  assert.deepEqual(await ask(artRewards(log.handles.at(-1)).forma), { status: 'missing' });
});

test('reward art: the mapping is read once; every refused entry is reported and left out, and the others still work', async () => {
  const { view, log } = recordingView();
  const { host, record } = app({ view, rewardArt: {
    [PACK_STORE]: PACK_FILE,
    [PACK]: PACK_FILE,
    '/Lotus/StoreItems/Types/Items/MiscItems/Forma': '../../desktop/main.mjs',
    Forma: 'calendar-1999/rewards/Forma.png',
    '/Lotus/StoreItems/Types/Gameplay/NarmerSorties/ArchonCrystalOrange': 'calendar-1999/rewards/ArchonCrystalOrange.PNG'
  } });
  const refused = [
    ['rewardArt', 'INVALID_PATH', '/Lotus/StoreItems/Types/Items/MiscItems/Forma', '../../desktop/main.mjs'],
    ['rewardArt', 'INVALID_ID', 'Forma', 'calendar-1999/rewards/Forma.png'],
    ['rewardArt', 'UNSUPPORTED_TYPE', '/Lotus/StoreItems/Types/Gameplay/NarmerSorties/ArchonCrystalOrange', 'calendar-1999/rewards/ArchonCrystalOrange.PNG'],
    ['rewardArt', 'DUPLICATE_ID', PACK_STORE, PACK_FILE],
    ['rewardArt', 'DUPLICATE_ID', PACK, PACK_FILE]
  ];
  assert.deepEqual(record.problems, refused);
  assert.match(record.errors[3][1], /奖励图片映射有一笔无效，已略过：\/Lotus\/StoreItems\/Types\/BoosterPacks\/CalendarMajorArtifactPack：与 \/Lotus\/Types\/BoosterPacks\/CalendarMajorArtifactPack 是同一物品/);
  host.show({}, artProjection());
  host.show({}, artProjection());
  const handle = log.handles.at(-1);
  const { packStore, forma, pack, crystal } = artRewards(handle);
  // Two spellings of one item are ambiguous, so neither is used; the refused paths never reach a picture read.
  assert.deepEqual(await askArt(handle, pack), { status: 'found', src: `data:${PACK}` });
  assert.deepEqual(await askArt(handle, packStore), { status: 'missing' });
  assert.deepEqual(await askArt(handle, forma), { status: 'found', src: `data:${FORMA}` });
  assert.deepEqual(await askArt(handle, crystal), { status: 'missing' });
  assert.deepEqual(record.pictures, []);
  assert.deepEqual(record.problems, refused, 'showing again reports nothing new');
  // A table that is not an object leaves no mapping at all, and the image service still works.
  const none = app({ view, rewardArt: null });
  assert.deepEqual(none.record.problems, [['rewardArt', 'INVALID_TABLE', null, null]]);
  none.host.show({}, artProjection());
  assert.deepEqual(await askArt(log.handles.at(-1), artRewards(log.handles.at(-1)).pack), { status: 'found', src: `data:${PACK}` });
});

test('game text goes through the App renderer and stays readable when the renderer fails', () => {
  const { view, log } = recordingView();
  const { host, record } = app({ view });
  host.show({}, projection());
  const target = {};
  log.handles[0].deps.capabilities.renderText(target, '<DT_FIRE> 火焰', 'description');
  assert.deepEqual(record.texts, [['<DT_FIRE> 火焰', 'description']]);
  const failing = app({ view, renderText: () => { throw new Error('token table missing'); } });
  failing.host.show({}, projection());
  const plain = {};
  log.handles.at(-1).deps.capabilities.renderText(plain, '<UNKNOWN_TOKEN> 原文', 'name');
  assert.equal(plain.textContent, '<UNKNOWN_TOKEN> 原文');
  assert.deepEqual(failing.record.errors, [['renderText', 'token table missing']]);
});

test('countdowns use the shared host rule with the supplied time, never the clock', () => {
  const { view, log } = recordingView();
  const at = Date.parse('2026-10-22T19:32:27.000Z');
  const { host } = app({ view, now: () => at });
  host.show({}, projection());
  const { formatDeadline, now } = log.handles[0].deps.capabilities;
  const startsAt = '2026-10-19T00:00:00.000Z', endsAt = '2026-10-26T00:00:00.000Z';
  assert.equal(now(), at);
  assert.deepEqual(formatDeadline(startsAt, endsAt, now()), { text: '3天 4时后结束', ended: false });
  assert.deepEqual(formatDeadline(startsAt, endsAt, Date.parse(startsAt) - 90 * 60000), { text: '还有 1时 30分开始', ended: false });
  assert.deepEqual(formatDeadline(startsAt, endsAt, Date.parse(endsAt)), { text: '已结束', ended: true });
  assert.deepEqual(formatDeadline('not a time', 'never', at), { text: '', ended: false });
  // The App badges and the calendar share one rule, so they never disagree.
  assert.equal(formatDeadline(startsAt, endsAt, at).text, formatCountdown(startsAt, endsAt, at));
});

test('close returns to the world-state page, and does nothing once the calendar is hidden', () => {
  const { view, log } = recordingView();
  const { host, record } = app({ view });
  host.show({}, projection());
  log.handles[0].deps.capabilities.close();
  assert.equal(record.backs, 1);
  host.hide();
  log.handles[0].deps.capabilities.close();
  assert.equal(record.backs, 1);
});

test('the clock repaints the shown calendar, and a snapshot that turns stale in place gets a new session', () => {
  const { view, log } = recordingView();
  const { host } = app({ view });
  const live = projection({ kind: 'network', stale: false });
  host.show({}, live);
  log.handles[0].deps.session.selectDay(20);
  assert.equal(host.tick(), true);
  assert.equal(log.handles[0].updates, 1);
  // The App marks an old network snapshot stale in place; the calendar must not keep calling it current.
  live.stale = true;
  assert.equal(host.tick(), true);
  assert.equal(log.handles[0].destroyed, 1);
  const state = log.handles[1].deps.session.read();
  assert.equal(state.data.stale, true);
  assert.equal(state.selection.ordinal, 20, 'the same context restores the selection');
  assert.equal(log.handles[1].container, log.handles[0].container);
  assert.equal(host.tick(), true);
  assert.equal(log.handles[1].updates, 1);
  host.hide();
  assert.equal(host.tick(), false);
});

test('opening and closing the calendar again and again creates no timer and keeps at most one view', () => {
  const { view, log } = recordingView();
  const { host } = app({ view });
  const timers = [];
  const saved = { setTimeout: globalThis.setTimeout, setInterval: globalThis.setInterval };
  globalThis.setTimeout = (...args) => { timers.push('setTimeout'); return saved.setTimeout(...args); };
  globalThis.setInterval = (...args) => { timers.push('setInterval'); return saved.setInterval(...args); };
  try {
    for (let index = 0; index < 25; index++) {
      host.show({}, projection({ server: index % 2 ? 'wg' : 'de' }));
      host.tick();
      if (index % 3 === 0) host.hide();
      assert.ok(log.live.size <= 1);
    }
    host.hide();
  } finally {
    Object.assign(globalThis, saved);
  }
  assert.deepEqual(timers, []);
  assert.equal(log.live.size, 0);
  assert.ok(log.handles.every(handle => handle.destroyed === 1));
});

// --- Boundaries ------------------------------------------------------------------------------------------------------

const sourceFiles = dir => readdirSync(dir, { recursive: true }).filter(file => /\.(mjs|cjs|js)$/.test(file)).map(file => path.join(dir, file));
const specifiers = file => [...readFileSync(file, 'utf8').matchAll(/\bfrom\s+['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]/g)].map(match => match[1] ?? match[2]);
const code = file => readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

test('the feature never calls the App bridge or imports App entry points, and the mount owns no timer, clock or global', () => {
  const feature = path.resolve(fileURLToPath(featureDir));
  for (const file of sourceFiles(feature)) {
    assert.doesNotMatch(code(file), /\bworkbench\b|\bwindow\b|\bipcRenderer\b|\belectron\b/, file);
    for (const specifier of specifiers(file)) {
      const target = path.resolve(path.dirname(file), specifier);
      assert.ok(target.startsWith(feature + path.sep), `${path.relative(feature, file)} imports ${specifier} from outside the feature`);
    }
  }
  const mount = code(path.join(feature, 'application', 'calendar-mount.mjs'));
  assert.doesNotMatch(mount, /\b(setTimeout|setInterval|requestAnimationFrame|queueMicrotask|Date|document|globalThis|addEventListener|process)\b/);
  for (const specifier of specifiers(path.join(feature, 'application', 'calendar-mount.mjs'))) assert.match(specifier, /^\.\/[\w-]+\.mjs$/, specifier);
});

test('the App reaches the calendar only through its composition root, and only through the public entry point', () => {
  const src = path.resolve(fileURLToPath(new URL('src/', root)));
  const feature = path.resolve(fileURLToPath(featureDir));
  const importers = sourceFiles(src)
    .filter(file => !file.startsWith(feature))
    .filter(file => specifiers(file).some(specifier => specifier.includes('features/calendar-1999')))
    .map(file => path.relative(src, file).replaceAll(path.sep, '/'));
  assert.deepEqual(importers, ['ui/calendar-1999.js']);
  const composition = path.join(src, 'ui', 'calendar-1999.js');
  assert.deepEqual(specifiers(composition).filter(specifier => specifier.includes('features/')), ['../features/calendar-1999/index.mjs']);
  // The composition root adapts App functions it is handed; it never reaches for the bridge or the App entry itself.
  assert.doesNotMatch(code(composition), /\bwindow\b|\bdocument\b|\bworkbench\b|from\s+['"]\.\/(app|live-state)\.js['"]/);
  const liveState = readFileSync(path.join(src, 'ui', 'live-state.js'), 'utf8');
  assert.match(liveState, /import \{ createCalendar1999Host \} from '\.\/calendar-1999\.js';/);
  assert.equal(liveState.match(/createCalendar1999Host\(/g).length, 1, 'one host for the whole world-state page');
  // The few App entry points: shown in the calendar detail, ticked with the countdowns, hidden wherever the content is replaced.
  const body = name => liveState.slice(liveState.indexOf(`function ${name}(`)).split(/\n (?:function|async function|const|let) /)[0];
  assert.equal(liveState.match(/calendar\.show\(/g).length, 1);
  assert.match(body('renderDetail'), /if\(module\.id==='calendar'\)\{const slot=[^}]+calendar\.show\(slot,state\.data\)\)\{container\.append\(head,slot\);return container;\}\}/);
  assert.match(body('render'), /^function render\(\)\{\s*const data=state\.data;if\(!data\)return;\s*calendar\.hide\(\);/);
  assert.match(body('updateTimes'), /calendar\.tick\(\);\}$/m);
  assert.match(body('reset'), /^function reset\(\)\{calendar\.hide\(\);/);
  assert.match(liveState, /if\(state\.server===n\.dataset\.wsServer\)return;calendar\.hide\(\);/, 'switching servers hides before the content is replaced');
  assert.match(liveState, /addEventListener\('beforeunload',\(\)=>\{calendar\.hide\(\);/);
  assert.equal(liveState.match(/calendar\.hide\(\)/g).length, 4);
  assert.equal(liveState.match(/calendar\.tick\(\)/g).length, 1);
});
