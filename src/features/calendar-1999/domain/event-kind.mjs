// The only event-kind vocabulary shared by records, adapters and presentation.
// Display labels belong to presentation; this module only names the kinds.
export const EVENT_KINDS = Object.freeze(['challenge', 'reward', 'upgrade', 'mixed', 'other']);

export function isEventKind(value) {
  return EVENT_KINDS.includes(value);
}

/**
 * Classifies one day from all of its entries.
 * - No entries: null. An empty day is never guessed to be a birthday or any other kind.
 * - Every entry shares one kind, duplicates included: that kind.
 * - Two or more distinct kinds: 'mixed'.
 * A value outside EVENT_KINDS counts as 'other', so the result always stays in the vocabulary.
 * @param {{kind?: unknown}[]} entries
 * @returns {'challenge'|'reward'|'upgrade'|'mixed'|'other'|null}
 */
export function classifyDay(entries) {
  if (!Array.isArray(entries)) throw new TypeError('Day entries must be an array');
  const kinds = new Set(entries.map(entry => isEventKind(entry?.kind) ? entry.kind : 'other'));
  if (kinds.size === 0) return null;
  return kinds.size === 1 ? [...kinds][0] : 'mixed';
}
