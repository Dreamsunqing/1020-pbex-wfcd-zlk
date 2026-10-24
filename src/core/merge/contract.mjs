import { readFile } from 'node:fs/promises';
import { sha256 } from '../io.mjs';
export const FULL_MODELING_VERSION = 'mod-set-acquisition-1';
export const CONTRACT = JSON.parse(await readFile(new URL('../../data/merge-contract.json', import.meta.url), 'utf8'));
export const DEFAULT_OVERRIDES = JSON.parse(await readFile(new URL('../../data/merge-overrides.json', import.meta.url), 'utf8'));
export const stable = (value, compact = false) => JSON.stringify(sort(value), null, compact ? undefined : 2) + '\n';
function sort(value) {
  if (Array.isArray(value)) return value.map(sort);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, sort(value[key])]));
  return value;
}
export const digest = value => sha256(stable(value));
export const compareText = (a, b) => a < b ? -1 : a > b ? 1 : 0;
export const pointer = key => String(key).replaceAll('~', '~0').replaceAll('/', '~1');
export const storeItemId = value => typeof value === 'string' ? value.replace(/^\/Lotus\/StoreItems\//, '/Lotus/') : null;
export function valid(value, field) {
  return (field.type === 'boolean' ? typeof value === 'boolean' : field.type === 'string' ? typeof value === 'string' && value.trim().length > 0 : typeof value === 'number' && Number.isFinite(value) && (field.type !== 'integer' || Number.isInteger(value))) && (field.min === undefined || value >= field.min) && (field.max === undefined || value <= field.max);
}
export function normalize(value, field) { return field.precision === undefined ? value : Number(value.toFixed(field.precision)); }
export function assign(target, field, value) {
  const parts = field.split('.'); let node = target;
  for (const key of parts.slice(0, -1)) { node[key] ??= {}; node = node[key]; }
  node[parts.at(-1)] = value;
}
