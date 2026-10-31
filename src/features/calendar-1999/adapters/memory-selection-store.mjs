import { validateSelectionValue } from '../application/contract-validation.mjs';

// Memory selection store (CAL-05). It implements the SelectionStore port for the lifetime of the instance: the host
// keeps one store and hands it to every session, so a selection survives a new snapshot with the same contextId.
// Nothing is kept across an App restart; that needs another adapter behind the same port.
//
// Rules, also listed in 文档/深入/45-1999日历选取存储转接器.md:
// - The key is the document's contextId, used as an opaque string. The store never parses it or compares documents,
//   so servers, loops and season windows stay apart exactly as far as the source's contextId rule keeps them apart.
// - A stored value is a SelectionValue: seasonIndex, monthIndex and ordinal. It is a date on the calendar, never
//   personal progress, so any other field is dropped.
// - Values are copied on write and on read. Changing a written object or a read result never reaches the store.
// - write checks the key and the value before it changes anything, so a refused write leaves the store as it was.
//   The value is copied before it is checked, so the map only ever holds the very copy that passed validateSelectionValue.
// - The store never evicts or rewrites a value by itself. Whether a value still fits a new snapshot is decided by the
//   session when it restores, and a value that no longer fits stays until the user chooses again.

const isContextId = value => typeof value === 'string' && value.trim() !== '';
// Reads each field once. A getter or proxy can no longer show the check one value and the map another.
const copyOf = value => value !== null && typeof value === 'object' && !Array.isArray(value)
  ? { seasonIndex: value.seasonIndex, monthIndex: value.monthIndex, ordinal: value.ordinal }
  : value;

/**
 * Creates an empty in-memory SelectionStore. See SelectionStore in ports.mjs.
 * @returns {import('../application/ports.mjs').SelectionStore}
 */
export function createMemorySelectionStore() {
  const values = new Map();
  return Object.freeze({
    read(contextId) {
      const value = values.get(contextId);
      return value && { ...value };
    },
    /** @throws {TypeError} When the key is not a contextId or the value fails validateSelectionValue. `error.issues` lists every problem. */
    write(contextId, value) {
      if (!isContextId(contextId)) throw new TypeError('Selection store key must be a non-empty contextId string');
      const copy = copyOf(value);
      const { valid, issues } = validateSelectionValue(copy);
      if (!valid) {
        throw Object.assign(new TypeError(`Selection store refuses an invalid SelectionValue: ${issues.map(issue => `${issue.path} ${issue.code}`).join(', ')}`), { issues });
      }
      values.set(contextId, copy);
    }
  });
}
