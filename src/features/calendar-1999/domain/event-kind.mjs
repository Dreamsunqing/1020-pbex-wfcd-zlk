// The only event-kind vocabulary shared by records, adapters and presentation.
// Display labels belong to presentation; this module only names the kinds.
export const EVENT_KINDS = Object.freeze(['challenge', 'reward', 'upgrade', 'mixed', 'other']);

export function isEventKind(value) {
  return EVENT_KINDS.includes(value);
}
