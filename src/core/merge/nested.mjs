import { compareText, pointer } from './contract.mjs';

export const NESTED_RULES = [
  { key: 'abilities', path: 'abilities', label: '技能', relation: 'has-ability', entityKind: 'ability', enabled: true },
  { key: 'components', path: 'components', label: '组件／制造材料', relation: 'has-component', entityKind: 'resource', enabled: true },
  { key: 'parentUniqueNames', path: 'components', label: '所属物品', relation: 'has-component', reverse: true, enabled: true },
  { key: 'additionalItems', path: 'additionalItems', label: '附带物品', relation: 'includes-item', enabled: true },
  { key: 'exalted', path: 'exaltedItems', label: '显赫武器', relation: 'has-exalted', enabled: true }
];
export const nestedRules = contract => contract.nested ?? NESTED_RULES;
export const nestedId = value => typeof value === 'string' && value.startsWith('/') ? value : value && typeof value === 'object' && !Array.isArray(value) ? ['uniqueName', 'abilityUniqueName', 'ItemType', 'itemId'].map(key => value[key]).find(id => typeof id === 'string' && id.startsWith('/')) : null;
export const object = value => Boolean(value && typeof value === 'object' && !Array.isArray(value));
export const fieldPart = key => /^[A-Za-z0-9_]+$/.test(key) ? '.' + key : '[' + JSON.stringify(key) + ']';

// Collection identity is an upstream ID, never an English title or an array index.
export function nestedEntries(value, at) {
  if (Array.isArray(value)) return value.map((row, slot) => ({ value: row, id: nestedId(row), slot, pointer: at + '/' + slot }));
  if (object(value) && !nestedId(value)) return Object.entries(value).map(([key, row], slot) => ({ value: row, id: nestedId(row) ?? (key.startsWith('/') ? key : null), slot, pointer: at + '/' + pointer(key) }));
  return value === undefined ? [] : [{ value, id: nestedId(value), slot: 0, pointer: at }];
}
export function indexNested(index, contract) {
  const rules = nestedRules(contract).filter(r => r.enabled && r.entityKind);
  const queue = [...index.values()].flat();
  for (let position = 0; position < queue.length; position++) for (const rule of rules) {
    const parent = queue[position];
    for (const child of nestedEntries(parent.value[rule.key], parent.source.pointer + '/' + pointer(rule.key))) {
      // Reference-only components contribute a relationship, not an invented entity.
      if (!child.id || !object(child.value) || !Object.keys(child.value).some(k => !['uniqueName', 'abilityUniqueName', 'ItemType', 'itemId', 'itemCount', 'count'].includes(k))) continue;
      const value = Object.fromEntries(Object.entries(child.value).filter(([k]) => !['itemCount', 'count'].includes(k)));
      const source = { ...parent.source, pointer: child.pointer };
      if (!index.has(child.id)) index.set(child.id, []);
      if (!index.get(child.id).some(row => row.source.file === source.file && row.source.pointer === source.pointer)) {
        const record = { ...parent, id: child.id, rawId: child.id, kind: rule.entityKind, classificationPriority: rule.entityKind === 'ability' ? 0 : 10, value, source, embedded: true };
        index.get(child.id).push(record); queue.push(record);
      }
    }
  }
}

export function mergeNested(id, field, candidates, resolve) {
  const values = candidates.map(c => c.value);
  if (values.length && values.every(object)) {
    const result = {};
    for (const key of [...new Set(values.flatMap(v => Object.keys(v)))].sort(compareText)) {
      const children = candidates.filter(c => Object.hasOwn(c.value, key)).map(c => ({ ...c, value: c.value[key], rawValue: c.value[key], source: { ...c.source, pointer: c.source.pointer + '/' + pointer(key) } }));
      Object.defineProperty(result, key, { value: mergeNested(id, field + fieldPart(key), children, resolve), enumerable: true });
    }
    if (!Object.keys(result).length) return resolve(id, field, candidates, null, true);
    return result;
  }
  const keyed = values.length && values.every(v => Array.isArray(v) && v.every(row => object(row) && nestedId(row)) && new Set(v.map(nestedId)).size === v.length);
  if (keyed && values.some(v => v.length)) {
    const ids = [...new Set(values.flatMap(v => v.map(nestedId)))];
    return ids.map((target, slot) => {
      const children = candidates.flatMap(c => { const at = c.value.findIndex(row => nestedId(row) === target); return at < 0 ? [] : [{ ...c, value: c.value[at], rawValue: c.value[at], source: { ...c.source, pointer: c.source.pointer + '/' + at } }]; });
      return mergeNested(id, field + '.' + slot, children, resolve);
    });
  }
  // Unidentified arrays, including attack modes, remain an atomic candidate.
  return resolve(id, field, candidates, null, true);
}
