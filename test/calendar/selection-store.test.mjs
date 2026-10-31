import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createCalendarSession, createMemorySelectionStore, createWorldStateCalendarSource } from '../../src/features/calendar-1999/index.mjs';

// Contract tests for the memory selection store (CAL-05). The store is checked on its own first, then behind real
// sessions: through the world-state adapter for server, loop and season isolation, and next to another store
// implementation to show that replacing the store changes no calendar rule.
const featureDir = new URL('../../src/features/calendar-1999/', import.meta.url);
const fixture = path => JSON.parse(readFileSync(new URL(`./fixtures/${path}`, import.meta.url), 'utf8'));
const at = (seasonIndex, monthIndex, ordinal) => ({ seasonIndex, monthIndex, ordinal });
const sourceOf = document => ({ read: () => structuredClone(document) });

// Keeps JSON text, as a later persistent adapter would. Text that does not parse reads as no value.
function textStore() {
  const texts = new Map();
  return {
    texts,
    read(contextId) {
      try { return JSON.parse(texts.get(contextId)); } catch { return undefined; }
    },
    write(contextId, value) { texts.set(contextId, JSON.stringify(value)); }
  };
}

test('a new store is empty, and a write keeps the three selection fields under an opaque key', () => {
  const store = createMemorySelectionStore();
  assert.ok(Object.isFrozen(store));
  assert.deepEqual(Object.keys(store).sort(), ['read', 'write']);
  assert.equal(store.read('["de"]'), undefined);
  store.write('["de"]', at(0, 1, 130));
  assert.deepEqual(store.read('["de"]'), at(0, 1, 130));
  // A selection is a date, never progress: extra fields are dropped, and a later write replaces the whole value.
  store.write('["de"]', { ...at(0, 2, null), completed: true, claimedAt: '2026-10-29T00:00:00Z' });
  assert.deepEqual(store.read('["de"]'), at(0, 2, null));
  // Keys are never trimmed or parsed, so near-identical strings are other contexts.
  for (const key of ['["de"] ', '[ "de" ]', '["wg"]', 'de']) assert.equal(store.read(key), undefined, key);
  // Stores never share values.
  assert.equal(createMemorySelectionStore().read('["de"]'), undefined);
});

test('written objects and read results are copies, so a caller cannot change what is stored', () => {
  const store = createMemorySelectionStore();
  const written = at(0, 1, 130);
  store.write('context', written);
  Object.assign(written, { monthIndex: 2, ordinal: 175 });
  assert.deepEqual(store.read('context'), at(0, 1, 130));

  const result = store.read('context');
  result.ordinal = 1;
  delete result.monthIndex;
  assert.deepEqual(store.read('context'), at(0, 1, 130));
  assert.notEqual(store.read('context'), store.read('context'));

  // A frozen value, such as a session's selection, is copied too, and the copy that comes back is the caller's own.
  store.write('context', Object.freeze(at(0, 0, 96)));
  const copy = store.read('context');
  assert.equal(Object.isFrozen(copy), false);
  copy.ordinal = 91;
  assert.deepEqual(store.read('context'), at(0, 0, 96));
});

test('invalid keys and damaged values are refused before anything changes, and reads never throw', () => {
  const store = createMemorySelectionStore();
  store.write('context', at(0, 0, 96));
  for (const key of ['', '   ', null, undefined, 0, {}, ['context'], Symbol('context')]) {
    assert.throws(() => store.write(key, at(0, 1, 130)), TypeError, String(key));
  }
  const damaged = [undefined, null, '0,1,130', [0, 1, 130], { seasonIndex: '0', monthIndex: 1, ordinal: 130 }, { seasonIndex: 0, monthIndex: 1 },
    at(-1, 0, null), at(0.5, 0, null), at(0, 3, null), at(0, 1, 0), at(0, 1, 366), at(0, 1, 96.5), at(0, 1, '130')];
  for (const value of damaged) {
    assert.throws(() => store.write('context', value), error => error instanceof TypeError && error.issues.length > 0, JSON.stringify(value) ?? 'undefined');
  }
  // Every refused write left the earlier value in place, and keys that can never be written read as no value.
  assert.deepEqual(store.read('context'), at(0, 0, 96));
  for (const key of [undefined, null, 0, {}, Symbol('context')]) assert.equal(store.read(key), undefined, String(key));

  // Each field is read once, so a getter cannot pass the check with one value and leave another in the store.
  const shifting = (...values) => {
    let reads = 0;
    return { value: { seasonIndex: 0, monthIndex: 1, get ordinal() { return values[Math.min(reads++, values.length - 1)]; } }, reads: () => reads };
  };
  const valid = shifting(130, '130');
  store.write('context', valid.value);
  assert.deepEqual([store.read('context'), valid.reads()], [at(0, 1, 130), 1]);
  const invalid = shifting('130', 130);
  assert.throws(() => store.write('context', invalid.value), TypeError);
  assert.deepEqual([store.read('context'), invalid.reads()], [at(0, 1, 130), 1]);
});

test('one store keeps servers, loops and season windows apart, and a new snapshot of the same context restores', () => {
  const variant = change => {
    const view = fixture('world-state/projection-de.json');
    const module = view.modules.find(row => row.id === 'calendar');
    change(view, module.calendarSeasons[0], module.entries);
    return view;
  };
  const nextWindow = { startsAt: '2026-10-26T00:00:00.000Z', endsAt: '2026-11-02T00:00:00.000Z' };
  const views = [
    variant(() => {}),
    variant(view => { view.server = 'wg'; }),
    variant((view, season, entries) => { season.yearIteration = 25; for (const row of entries) row.reference.yearIteration = 25; }),
    variant((view, season, entries) => { for (const row of [season, ...entries]) Object.assign(row, nextWindow); })
  ];
  const keys = views.map(view => createWorldStateCalendarSource(view).read().contextId);
  assert.equal(new Set(keys).size, 4);
  const store = createMemorySelectionStore();
  const open = view => createCalendarSession({ source: createWorldStateCalendarSource(view), selectionStore: store });

  // The DE winter of loop 24 opens on January 3 in every context. DE, WG, loop 25 and the next window each choose their own day.
  const [de, wg, nextLoop, later] = views.map(open);
  for (const session of [de, wg, nextLoop, later]) assert.deepEqual(session.read().selection, at(0, 0, 3));
  de.selectDay(19);
  wg.selectDay(20);
  nextLoop.selectDay(1);
  later.selectMonth(1);
  later.selectDay(45);
  const chosen = [at(0, 0, 19), at(0, 0, 20), at(0, 0, 1), at(0, 1, 45)];
  assert.deepEqual(keys.map(key => store.read(key)), chosen);
  assert.deepEqual(views.map(view => open(view).read().selection), chosen);

  // A fresh network snapshot of the DE season keeps its context, restores January 19 and reports its own freshness.
  const fresh = open(variant(view => Object.assign(view, { kind: 'network', stale: false, sourceTime: '2026-10-23T00:00:00.000Z' }))).read();
  assert.deepEqual([fresh.selection, fresh.data.kind, fresh.data.stale], [at(0, 0, 19), 'network', false]);
  // A new DE choice changes only the DE context.
  de.selectDay(20);
  assert.deepEqual(keys.map(key => store.read(key)), [at(0, 0, 20), ...chosen.slice(1)]);
});

test('behind a session the store holds only what the user chose, and an outdated value stays until the user chooses again', () => {
  const document = fixture('contracts/valid-document.json');
  const key = document.contextId;
  const store = createMemorySelectionStore();
  const open = () => createCalendarSession({ source: sourceOf(document), selectionStore: store });

  // Creation and read() never write, so an untouched context has no value.
  const session = open();
  session.read();
  assert.equal(store.read(key), undefined);
  session.selectDay(104);
  assert.deepEqual(store.read(key), at(0, 0, 104));
  // The store and the session never share an object.
  store.read(key).ordinal = 101;
  assert.deepEqual([session.read().selection, open().read().selection], [at(0, 0, 104), at(0, 0, 104)]);

  // A host may keep one contextId while its document changes. The session decides on restore what still fits and falls
  // back part by part; the store keeps the old value, because creation never writes.
  store.write(key, at(2, 1, 130));
  assert.deepEqual(open().read().selection, at(0, 0, 96));
  store.write(key, at(0, 1, 104));
  assert.deepEqual(open().read().selection, at(0, 1, null));
  assert.deepEqual(store.read(key), at(0, 1, 104));
  // The next choice replaces it.
  open().selectDay(130);
  assert.deepEqual(store.read(key), at(0, 1, 130));
});

test('replacing the store implementation changes no calendar rule, and damaged stored data falls back like a missing value', () => {
  const document = fixture('contracts/valid-document.json');
  const open = store => createCalendarSession({ source: sourceOf(document), selectionStore: store });
  const steps = [
    session => session.selectDay(104), session => session.move('ArrowDown'), session => session.move('End'),
    session => session.selectMonth(1), session => session.move('Home'), session => session.selectMonth(2)
  ];
  const run = store => {
    const session = open(store);
    return steps.map(step => { step(session); return session.read(); });
  };
  const memory = createMemorySelectionStore();
  const text = textStore();
  assert.deepEqual(run(memory), run(text));
  assert.deepEqual(open(memory).read(), open(text).read());
  assert.deepEqual(open(memory).read().selection, at(0, 2, null));
  assert.equal(text.texts.get(document.contextId), JSON.stringify(at(0, 2, null)));

  // Text that no longer parses, or parses to a value that is not a SelectionValue, opens on the initial selection.
  const initial = open(createMemorySelectionStore()).read();
  for (const damaged of ['{"seasonIndex":0,"monthIndex":1', '"0,1,130"', 'null', '{"seasonIndex":"0","monthIndex":1,"ordinal":130}', '{"seasonIndex":0,"monthIndex":1,"ordinal":366}']) {
    text.texts.set(document.contextId, damaged);
    assert.deepEqual(open(text).read(), initial, damaged);
  }
});

test('the store depends only on the application contract, and no inner layer depends on an adapter', () => {
  const specifiers = url => [...readFileSync(url, 'utf8').matchAll(/\bfrom\s+['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]/g)].map(match => match[1] ?? match[2]);
  const storeFile = new URL('adapters/memory-selection-store.mjs', featureDir);
  for (const specifier of specifiers(storeFile)) assert.match(specifier, /^\.\.\/application\/[\w-]+\.mjs$/, specifier);
  // No platform storage, browser global, Electron or clock: persistence belongs to another adapter behind the same port.
  const code = readFileSync(storeFile, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.doesNotMatch(code, /\b(localStorage|sessionStorage|indexedDB|window|document|navigator|globalThis|process|require|electron|fetch|Date)\b/);
  for (const layer of ['domain', 'application']) {
    for (const name of readdirSync(new URL(`${layer}/`, featureDir)).filter(file => file.endsWith('.mjs'))) {
      for (const specifier of specifiers(new URL(`${layer}/${name}`, featureDir))) assert.doesNotMatch(specifier, /adapters\//, `${layer}/${name}`);
    }
  }
});
