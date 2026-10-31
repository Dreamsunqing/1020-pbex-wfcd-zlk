import { isEventKind } from '../domain/event-kind.mjs';
import { isAnnualDay } from '../domain/calendar.mjs';

// Pure runtime checks for the contracts in ports.mjs. Inputs are never mutated.
// Each check returns issues instead of throwing, so fixtures and hosts can report every problem at once.

const SERVERS = ['de', 'wg'];
const SOURCE_KINDS = ['network', 'sample', 'import'];
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const isNonEmptyString = value => typeof value === 'string' && value.trim() !== '';
const UTC_INSTANT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{3})?Z$/;

// Date.parse alone accepts "123", date-only values, offsets and rolled-over dates such as 2026-02-30.
// Rebuilding the instant and comparing every field rejects anything that does not exist as written.
function isUtcInstant(value) {
  const match = typeof value === 'string' ? UTC_INSTANT.exec(value) : null;
  if (!match) return false;
  const [year, month, day, hour, minute, second] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    && date.getUTCHours() === hour && date.getUTCMinutes() === minute && date.getUTCSeconds() === second;
}

function check(issues, condition, path, code, message) {
  if (!condition) issues.push({ path, code, message });
}

function validateReward(reward, path, issues) {
  check(issues, isObject(reward), path, 'INVALID_REWARD', 'Reward must be an object');
  if (!isObject(reward)) return;
  check(issues, isNonEmptyString(reward.id), `${path}.id`, 'INVALID_REWARD', 'Reward needs a full item ID');
  check(issues, typeof reward.name === 'string', `${path}.name`, 'INVALID_REWARD', 'Reward name must be a string');
  check(issues, reward.quantity === undefined || reward.quantity === null || (Number.isInteger(reward.quantity) && reward.quantity >= 0),
    `${path}.quantity`, 'INVALID_REWARD', 'Reward quantity must be a non-negative integer, null or absent');
  check(issues, reward.libraryId === null || isNonEmptyString(reward.libraryId), `${path}.libraryId`, 'INVALID_REWARD',
    'libraryId must be a non-empty string or null');
  check(issues, reward.libraryVersion === undefined || reward.libraryVersion === null || isNonEmptyString(reward.libraryVersion),
    `${path}.libraryVersion`, 'INVALID_REWARD', 'libraryVersion must be a non-empty string, null or absent');
}

function validateEntry(entry, path, issues) {
  check(issues, isObject(entry), path, 'INVALID_ENTRY', 'Entry must be an object');
  if (!isObject(entry)) return;
  // Out-of-range ordinals are valid data. They are kept and shown as unmapped.
  check(issues, entry.ordinal === null || Number.isInteger(entry.ordinal), `${path}.ordinal`, 'INVALID_ORDINAL',
    'ordinal must be an integer or null');
  check(issues, isEventKind(entry.kind), `${path}.kind`, 'UNKNOWN_KIND', 'kind must be one of EVENT_KINDS');
  check(issues, typeof entry.title === 'string', `${path}.title`, 'INVALID_ENTRY', 'title must be a string');
  check(issues, Array.isArray(entry.rewards), `${path}.rewards`, 'INVALID_ENTRY', 'rewards must be an array');
  (Array.isArray(entry.rewards) ? entry.rewards : []).forEach((reward, index) => validateReward(reward, `${path}.rewards[${index}]`, issues));
  check(issues, Array.isArray(entry.terms), `${path}.terms`, 'INVALID_ENTRY', 'terms must be an array');
  (Array.isArray(entry.terms) ? entry.terms : []).forEach((term, index) => {
    const termPath = `${path}.terms[${index}]`;
    check(issues, isObject(term) && isNonEmptyString(term.name), termPath, 'INVALID_TERM', 'Term needs a non-empty name');
    check(issues, !isObject(term) || term.description === undefined || typeof term.description === 'string',
      `${termPath}.description`, 'INVALID_TERM', 'description must be a string when present');
    for (const field of ['key', 'source']) {
      check(issues, !isObject(term) || term[field] === undefined || term[field] === null || typeof term[field] === 'string',
        `${termPath}.${field}`, 'INVALID_TERM', `${field} must be a string, null or absent`);
    }
  });
  check(issues, isObject(entry.evidence), `${path}.evidence`, 'MISSING_EVIDENCE', 'evidence must be an object and is never dropped');
}

function validateSeason(season, path, issues) {
  check(issues, isObject(season), path, 'INVALID_SEASON', 'Season must be an object');
  if (!isObject(season)) return;
  check(issues, isNonEmptyString(season.code), `${path}.code`, 'INVALID_SEASON', 'Season code must be a non-empty string');
  check(issues, typeof season.label === 'string', `${path}.label`, 'INVALID_SEASON', 'Season label must be a string');
  check(issues, Number.isInteger(season.yearIteration) && season.yearIteration >= 0, `${path}.yearIteration`, 'INVALID_SEASON',
    'yearIteration must be a non-negative integer');
  const windowValid = isUtcInstant(season.startsAt) && isUtcInstant(season.endsAt) && Date.parse(season.endsAt) > Date.parse(season.startsAt);
  check(issues, windowValid, `${path}.endsAt`, 'INVALID_WINDOW',
    'startsAt and endsAt must be existing UTC instants (YYYY-MM-DDTHH:mm:ss[.sss]Z), with endsAt after startsAt');
  check(issues, Array.isArray(season.listedDays), `${path}.listedDays`, 'INVALID_LISTED_DAY', 'listedDays must be an array');
  if (Array.isArray(season.listedDays)) {
    season.listedDays.forEach((day, index) => check(issues, isAnnualDay(day), `${path}.listedDays[${index}]`, 'INVALID_LISTED_DAY',
      'listed day must be an integer from 1 to 365'));
    check(issues, new Set(season.listedDays).size === season.listedDays.length, `${path}.listedDays`, 'DUPLICATE_LISTED_DAY',
      'listedDays must not contain duplicates');
  }
  check(issues, Array.isArray(season.entries), `${path}.entries`, 'INVALID_SEASON', 'entries must be an array');
  (Array.isArray(season.entries) ? season.entries : []).forEach((entry, index) => validateEntry(entry, `${path}.entries[${index}]`, issues));
}

/**
 * @param {unknown} document
 * @returns {{valid: boolean, issues: {path: string, code: string, message: string}[]}}
 */
export function validateCalendarDocument(document) {
  const issues = [];
  check(issues, isObject(document), '$', 'INVALID_DOCUMENT', 'Document must be an object');
  if (!isObject(document)) return { valid: false, issues };
  check(issues, isNonEmptyString(document.contextId), 'contextId', 'MISSING_CONTEXT', 'contextId must be a non-empty string');
  const data = document.data;
  check(issues, isObject(data), 'data', 'INVALID_SOURCE', 'data must be an object');
  if (isObject(data)) {
    check(issues, SERVERS.includes(data.server), 'data.server', 'UNKNOWN_SERVER', 'server must be "de" or "wg"');
    check(issues, SOURCE_KINDS.includes(data.kind), 'data.kind', 'INVALID_SOURCE_KIND', 'kind must be network, sample or import');
    check(issues, typeof data.stale === 'boolean', 'data.stale', 'INVALID_SOURCE', 'stale must be a boolean');
    check(issues, isUtcInstant(data.sourceTime), 'data.sourceTime', 'INVALID_SOURCE_TIME',
      'sourceTime must be an existing UTC instant (YYYY-MM-DDTHH:mm:ss[.sss]Z)');
  }
  check(issues, Array.isArray(document.seasons), 'seasons', 'INVALID_DOCUMENT', 'seasons must be an array');
  (Array.isArray(document.seasons) ? document.seasons : []).forEach((season, index) => validateSeason(season, `seasons[${index}]`, issues));
  return { valid: issues.length === 0, issues };
}

/**
 * Validates a value read back from SelectionStore. A stored value is untrusted until it passes this check.
 * @param {unknown} value
 * @returns {{valid: boolean, issues: {path: string, code: string, message: string}[]}}
 */
export function validateSelectionValue(value) {
  const issues = [];
  check(issues, isObject(value), '$', 'INVALID_SELECTION', 'Selection must be an object');
  if (isObject(value)) {
    check(issues, Number.isInteger(value.seasonIndex) && value.seasonIndex >= 0, 'seasonIndex', 'INVALID_SELECTION',
      'seasonIndex must be a non-negative integer');
    check(issues, Number.isInteger(value.monthIndex) && value.monthIndex >= 0 && value.monthIndex <= 2, 'monthIndex', 'INVALID_SELECTION',
      'monthIndex must be an integer from 0 to 2');
    check(issues, value.ordinal === null || isAnnualDay(value.ordinal), 'ordinal', 'INVALID_SELECTION',
      'ordinal must be an annual day from 1 to 365, or null');
  }
  return { valid: issues.length === 0, issues };
}
