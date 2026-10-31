import { classifyDay } from './event-kind.mjs';

// Date, season and alignment rules for the 1999 calendar (CAL-02).
//
// `ordinal` is the one-based day of the fixed year 1999: day 1 is 1999-01-01, as in
// WFCD warframe-worldstate-parser lib/models/Calendar.ts getDate (Date.UTC(1999) + day - 1).
// YearIteration only identifies a loop. It is never a Gregorian year, so no leap day is ever added.
//
// Every value is computed with integer arithmetic over a fixed month table. That is the UTC
// calendar by construction, so results cannot depend on the host time zone, and nothing here
// reads the clock. The tests check every day of the year against Date.UTC.

export const DAYS_IN_YEAR = 365;
const MONTH_LENGTHS = Object.freeze([31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]);
// Days before the first of each month: [0, 31, 59, 90, ...].
const MONTH_OFFSETS = Object.freeze(MONTH_LENGTHS.map((_, index) => MONTH_LENGTHS.slice(0, index).reduce((sum, length) => sum + length, 0)));
// 1999-01-01 was a Friday. 0 = Sunday, matching Date#getUTCDay.
const FIRST_WEEKDAY = 5;

// Each season displays three months, per the DE Update 38 calendar notes.
// The upstream parser accepts any CST_* code; CST_AUTUMN is the alias already kept in src/data/live-state/weekly-semantics.json.
export const SEASON_MONTHS = Object.freeze({
  CST_WINTER: Object.freeze([1, 2, 3]),
  CST_SPRING: Object.freeze([4, 5, 6]),
  CST_SUMMER: Object.freeze([7, 8, 9]),
  CST_FALL: Object.freeze([10, 11, 12]),
  CST_AUTUMN: Object.freeze([10, 11, 12])
});
const NO_MONTHS = Object.freeze([]);

const pad = value => String(value).padStart(2, '0');
const isMonth = value => Number.isInteger(value) && value >= 1 && value <= 12;

export function isAnnualDay(value) {
  return Number.isInteger(value) && value >= 1 && value <= DAYS_IN_YEAR;
}

/**
 * @typedef {object} CalendarDate
 * @property {number} ordinal  1999 annual day.
 * @property {number} month    1..12.
 * @property {number} day      Day of month, 1-based.
 * @property {string} date     YYYY-MM-DD in 1999.
 * @property {number} weekday  0 = Sunday.
 */

/**
 * Converts an annual day to its 1999 date. Anything that is not an integer from 1 to 365
 * (0, 366, 1.5, '91', null, NaN, ...) returns null; nothing is rolled over into 1998 or 2000.
 * @param {unknown} ordinal
 * @returns {CalendarDate|null}
 */
export function ordinalToDate(ordinal) {
  if (!isAnnualDay(ordinal)) return null;
  const month = MONTH_OFFSETS.findLastIndex(offset => offset < ordinal) + 1;
  const day = ordinal - MONTH_OFFSETS[month - 1];
  return { ordinal, month, day, date: `1999-${pad(month)}-${pad(day)}`, weekday: (FIRST_WEEKDAY + ordinal - 1) % 7 };
}

/**
 * Inverse of ordinalToDate. A month or day that does not exist in 1999, such as 2/29 or 4/31, returns null.
 * @returns {number|null}
 */
export function dateToOrdinal(month, day) {
  if (!isMonth(month) || !Number.isInteger(day) || day < 1 || day > MONTH_LENGTHS[month - 1]) return null;
  return MONTH_OFFSETS[month - 1] + day;
}

/**
 * Displayed months of a season, in order. Unknown codes return an empty list,
 * including inherited keys such as "constructor" and differently cased codes.
 * @param {unknown} code
 * @returns {readonly number[]}
 */
export function seasonMonths(code) {
  return typeof code === 'string' && Object.hasOwn(SEASON_MONTHS, code) ? SEASON_MONTHS[code] : NO_MONTHS;
}

/**
 * Every date of one 1999 month, in order. Throws RangeError for anything other than an integer from 1 to 12.
 * @returns {CalendarDate[]}
 */
export function monthDates(month) {
  if (!isMonth(month)) throw new RangeError('Calendar month must be an integer from 1 to 12');
  return Array.from({ length: MONTH_LENGTHS[month - 1] }, (_, index) => ordinalToDate(MONTH_OFFSETS[month - 1] + index + 1));
}

/**
 * Aligns a season's entries with its displayed months. The result has the shape of
 * CalendarMonth[] and CalendarDay in application/ports.mjs; the domain does not import that layer.
 *
 * - Every displayed month is complete, from day 1 to its last day.
 * - Entries keep their identity and source order. Same-day entries, duplicates included, are all kept.
 * - An entry goes to `unmapped`, in source order, when its ordinal is not an annual day, when its date
 *   falls outside the season's months, or when the season code is unknown. No entry is ever dropped.
 * - A listed day without entries stays listed with kind null. Listed days outside the season's months
 *   are not shown and remain only on season.listedDays.
 * - The season, its arrays and its entries are never mutated. Each call returns new months and arrays.
 *
 * @template {{ordinal?: unknown, kind?: unknown}} Entry
 * @param {{code: unknown, listedDays?: unknown[], entries?: Entry[]}} season
 * @returns {{months: {month: number, days: {day: number, ordinal: number, date: string, weekday: number, listed: boolean,
 *   kind: string|null, entries: Entry[]}[], eventDays: number}[], unmapped: Entry[]}}
 */
export function buildSeasonMonths(season) {
  if (season === null || typeof season !== 'object') throw new TypeError('Calendar season must be an object');
  const { entries = [], listedDays = [] } = season;
  if (!Array.isArray(entries) || !Array.isArray(listedDays)) throw new TypeError('Season entries and listedDays must be arrays');
  const months = seasonMonths(season.code);
  const byOrdinal = new Map();
  const unmapped = [];
  for (const entry of entries) {
    const date = ordinalToDate(entry?.ordinal);
    if (!date || !months.includes(date.month)) { unmapped.push(entry); continue; }
    if (!byOrdinal.has(date.ordinal)) byOrdinal.set(date.ordinal, []);
    byOrdinal.get(date.ordinal).push(entry);
  }
  const listed = new Set(listedDays);
  return {
    months: months.map(month => {
      const days = monthDates(month).map(({ day, ordinal, date, weekday }) => {
        const dayEntries = byOrdinal.get(ordinal) ?? [];
        return { day, ordinal, date, weekday, listed: listed.has(ordinal), kind: classifyDay(dayEntries), entries: dayEntries };
      });
      return { month, days, eventDays: days.filter(day => day.entries.length).length };
    }),
    unmapped
  };
}
