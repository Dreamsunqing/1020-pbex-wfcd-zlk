import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as calendar from '../../src/features/calendar-1999/index.mjs';
import { validateCalendarDocument, validateSelectionValue } from '../../src/features/calendar-1999/application/contract-validation.mjs';
import { EVENT_KINDS } from '../../src/features/calendar-1999/domain/event-kind.mjs';

const fixture = name => JSON.parse(readFileSync(new URL(`./fixtures/contracts/${name}`, import.meta.url), 'utf8'));

test('valid examples satisfy the document contract without any world-state raw data', () => {
  for (const name of ['valid-document.json', 'valid-unmapped-entry.json']) {
    const result = validateCalendarDocument(fixture(name));
    assert.deepEqual(result.issues, [], name);
    assert.equal(result.valid, true, name);
  }
});

test('invalid examples report each expected code with a precise path', () => {
  const cases = {
    'invalid-server.json': ['UNKNOWN_SERVER'],
    'invalid-entry.json': ['UNKNOWN_KIND', 'INVALID_REWARD'],
    'invalid-season-window.json': ['INVALID_WINDOW', 'DUPLICATE_LISTED_DAY', 'INVALID_LISTED_DAY'],
    'invalid-source.json': ['INVALID_SOURCE_KIND', 'INVALID_SOURCE', 'INVALID_SOURCE_TIME']
  };
  for (const [name, codes] of Object.entries(cases)) {
    const result = validateCalendarDocument(fixture(name));
    assert.equal(result.valid, false, name);
    for (const code of codes) assert.ok(result.issues.some(issue => issue.code === code), `${name} should report ${code}`);
    assert.ok(result.issues.every(issue => typeof issue.path === 'string' && issue.path.length > 0), name);
  }
});

test('a reward without a full ID and an entry without evidence are both rejected', () => {
  const document = fixture('valid-document.json');
  delete document.seasons[0].entries[0].evidence;
  document.seasons[0].entries[1].rewards[0].id = '';
  const result = validateCalendarDocument(document);
  assert.deepEqual(result.issues.map(issue => issue.path), [
    'seasons[0].entries[0].evidence',
    'seasons[0].entries[1].rewards[0].id'
  ]);
});

test('out-of-range and null ordinals are valid data, because unmapped records must be kept', () => {
  const document = fixture('valid-document.json');
  document.seasons[0].entries.push({ ...document.seasons[0].entries[0], ordinal: 400 }, { ...document.seasons[0].entries[0], ordinal: null });
  assert.equal(validateCalendarDocument(document).valid, true);
});

test('time fields accept only existing UTC instants in the documented format', () => {
  const accepted = ['2026-10-29T00:00:00.000Z', '2026-10-29T00:00:00Z', '2026-10-29T23:59:59.999Z', '2028-02-29T12:00:00Z'];
  const rejected = ['123', 'yesterday', 'Oct 29 2026', '2026-10-29', '2026-02-30', '2026-02-30T00:00:00.000Z', '2027-02-29T00:00:00Z',
    '2026-13-01T00:00:00Z', '2026-10-29T24:00:00Z', '2026-10-29T00:60:00Z', '2026-10-29T00:00:00+08:00', '2026-10-29T00:00:00.5Z',
    ' 2026-10-29T00:00:00Z', 1793232000000, null];
  const withTime = (field, value) => {
    const document = fixture('valid-document.json');
    if (field === 'sourceTime') document.data.sourceTime = value;
    // Keep the window ordered so only the format decides the result.
    else Object.assign(document.seasons[0], { startsAt: value, endsAt: '2099-01-01T00:00:00Z' });
    return validateCalendarDocument(document).issues.map(issue => issue.code);
  };
  for (const value of accepted) {
    assert.deepEqual(withTime('sourceTime', value), [], `sourceTime ${value}`);
    assert.deepEqual(withTime('startsAt', value), [], `startsAt ${value}`);
  }
  for (const value of rejected) {
    assert.deepEqual(withTime('sourceTime', value), ['INVALID_SOURCE_TIME'], `sourceTime ${JSON.stringify(value)}`);
    assert.deepEqual(withTime('startsAt', value), ['INVALID_WINDOW'], `startsAt ${JSON.stringify(value)}`);
  }
});

test('validators never mutate their inputs', () => {
  for (const name of ['valid-document.json', 'invalid-entry.json']) {
    const document = fixture(name);
    const before = structuredClone(document);
    validateCalendarDocument(document);
    assert.deepEqual(document, before, name);
  }
  const selection = { seasonIndex: 0, monthIndex: 1, ordinal: 104 };
  validateSelectionValue(selection);
  assert.deepEqual(selection, { seasonIndex: 0, monthIndex: 1, ordinal: 104 });
});

test('stored selection values are untrusted until they pass the selection contract', () => {
  assert.equal(validateSelectionValue({ seasonIndex: 0, monthIndex: 2, ordinal: 91 }).valid, true);
  assert.equal(validateSelectionValue({ seasonIndex: 0, monthIndex: 2, ordinal: null }).valid, true);
  for (const value of [undefined, null, 'x', { seasonIndex: -1, monthIndex: 0, ordinal: 1 }, { seasonIndex: 0, monthIndex: 3, ordinal: 1 },
    { seasonIndex: 0, monthIndex: 0, ordinal: '104' }, { seasonIndex: 0, monthIndex: 0, ordinal: 366 }]) {
    assert.equal(validateSelectionValue(value).valid, false, JSON.stringify(value));
  }
});

test('1.1.0 optional fields are checked when present, and 1.0.0 documents without them stay valid', () => {
  const document = fixture('valid-document.json');
  Object.assign(document.seasons[0].entries[1].rewards[0], { libraryVersion: 'v1' });
  Object.assign(document.seasons[0].entries[2].terms[0], { key: '/Test/Upgrade', source: null });
  assert.deepEqual(validateCalendarDocument(document).issues, []);
  Object.assign(document.seasons[0].entries[1].rewards[0], { libraryVersion: '' });
  Object.assign(document.seasons[0].entries[2].terms[0], { key: 7, source: {} });
  assert.deepEqual(validateCalendarDocument(document).issues.map(issue => issue.path), [
    'seasons[0].entries[1].rewards[0].libraryVersion',
    'seasons[0].entries[2].terms[0].key',
    'seasons[0].entries[2].terms[0].source'
  ]);
});

test('public entry exposes only the contract surface, and the vocabulary is closed', () => {
  assert.deepEqual(Object.keys(calendar).sort(), ['CALENDAR_CONTRACT_VERSION', 'EVENT_KINDS', 'createCalendarSession', 'createMemorySelectionStore',
    'createWorldStateCalendarSource', 'isEventKind', 'validateCalendarDocument', 'validateSelectionValue']);
  assert.equal(calendar.CALENDAR_CONTRACT_VERSION, '1.1.0');
  assert.deepEqual([...EVENT_KINDS], ['challenge', 'reward', 'upgrade', 'mixed', 'other']);
  assert.ok(Object.isFrozen(EVENT_KINDS));
  assert.equal(calendar.isEventKind('festival'), false);
});
