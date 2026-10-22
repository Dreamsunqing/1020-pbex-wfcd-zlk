import { describeField, displayMeaning } from './field-guide.mjs';
import { describe, escapePointer, pointerValue } from './library.mjs';

const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const sample = value => typeof value === 'string' ? value.slice(0, 180) : JSON.stringify(value)?.slice(0, 180);

// Only collapse identifiable record maps, never ordinary attribute bags such as damage.impact.
export function isRecordMap(value, context = '', file = '', depth = 0) {
  if (!isObject(value)) return false;
  const keys = Object.keys(value);
  if (!keys.length) return false;
  if (keys.every(key => /^\d+$/.test(key) || /^\//.test(key) || /^[A-Za-z]*Node\d+$/.test(key) || /^[a-f\d]{24,64}$/i.test(key))) return true;
  if (['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies', 'packages'].includes(context)) return true;
  if (depth === 0 && /(?:starchart-export|ExportTextIcons|\.export)\.json$/i.test(file)) return true;
  return keys.length > 1 && keys.every(key => isObject(value[key]) && ('uniqueName' in value[key] || 'name' in value[key]));
}

export function scanStructure(value, file = '') {
  const root = makeNode('$', '$', ''), stack = [{ value, node: root, pointer: '' }];
  let visited = 0, records = 0;
  while (stack.length) {
    const entry = stack.pop(), current = entry.value, node = entry.node;
    const type = describe(current).type;
    visited++; node.seen++; node.types.add(type);
    if (current === null || typeof current !== 'object') {
      const text = sample(current);
      if (node.examples.length < 3 && !node.examples.includes(text)) node.examples.push(text);
      continue;
    }
    if (Array.isArray(current)) {
      if (!current.length) node.empty++;
      for (let i = current.length - 1; i >= 0; i--) {
        const pointer = `${entry.pointer}/${i}`;
        if (!node.children.has('[]')) node.children.set('[]', makeNode('[]', `${node.path}[]`, pointer));
        stack.push({ value: current[i], node: node.children.get('[]'), pointer });
      }
      continue;
    }
    records++; node.objects++;
    const keys = Object.keys(current), dynamic = isRecordMap(current, node.key, file, node === root ? 0 : 1);
    if (!keys.length) node.empty++;
    for (let i = keys.length - 1; i >= 0; i--) {
      const key = keys[i], field = dynamic ? '{key}' : key, pointer = `${entry.pointer}/${escapePointer(key)}`;
      if (!node.children.has(field)) node.children.set(field, makeNode(field, dynamic ? `${node.path}{key}` : `${node.path}[${JSON.stringify(key)}]`, pointer));
      const child = node.children.get(field);
      if (dynamic && child.keyExamples.length < 4 && !child.keyExamples.includes(key)) child.keyExamples.push(key);
      stack.push({ value: current[key], node: child, pointer });
    }
  }
  const rows = [], flatten = [{ node: root, depth: 0, parent: null }];
  while (flatten.length) {
    const { node, depth, parent } = flatten.pop(), guide = describeField(node.key, node.path, file);
    rows.push({ key: node.key, path: node.path, pointer: node.pointer, depth, types: [...node.types].sort(), seen: node.seen, parentObjects: parent?.objects ?? 0, examples: node.examples, keyExamples: node.keyExamples, empty: node.empty, guide });
    const children = [...node.children.values()].sort((a, b) => a.key.localeCompare(b.key));
    for (let i = children.length - 1; i >= 0; i--) flatten.push({ node: children[i], parent: node, depth: depth + 1 });
  }
  return { rows, visited, records, fields: rows.length, unknown: rows.filter(row => row.guide.status === 'unknown').length };
}
function makeNode(key, path, pointer) { return { key, path, pointer, seen: 0, objects: 0, empty: 0, types: new Set(), examples: [], keyExamples: [], children: new Map() }; }

export function sliceStructure(structure, { query = '', offset = 0, limit = 80 } = {}) {
  validatePage(query, offset, limit);
  const needle = query.toLocaleLowerCase(), rows = structure.rows.filter(row => !needle || `${row.path} ${row.guide.label} ${row.guide.description} ${row.types.join(' ')} ${row.keyExamples.join(' ')}`.toLocaleLowerCase().includes(needle));
  return { ...structure, rows: rows.slice(offset, offset + limit), total: rows.length, hasMore: offset + limit < rows.length };
}
function validatePage(query, offset, limit) {
  if (typeof query !== 'string' || query.length > 500 || !Number.isInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1 || limit > 200) throw new Error('分页或搜索参数无效');
}

// Values are complete for scalars; containers are opened on demand and paged, never abbreviated JSON.
export function recordDetail(value, { pointer = '', query = '', offset = 0, limit = 80, file = '' } = {}) {
  validatePage(query, offset, limit);
  const node = pointerValue(value, pointer), metadata = describe(node), container = node !== null && typeof node === 'object';
  const rows = [], needle = query.toLocaleLowerCase(); let total = 0;
  const keys = container ? Object.keys(node) : [];
  for (const key of keys) {
    const item = node[key], at = `${pointer}/${escapePointer(key)}`, guide = describeField(Array.isArray(node) ? '[]' : key, at, file);
    const child = describe(item), nested = item !== null && typeof item === 'object';
    if (needle && !`${key} ${guide.label} ${guide.description} ${nested ? '' : String(item)}`.toLocaleLowerCase().includes(needle)) continue;
    if (total >= offset && rows.length < limit) rows.push({ key, pointer: at, ...child, guide, meaning: displayMeaning(item, guide), ...(nested ? {} : { value: item }) });
    total++;
  }
  return { pointer, ...metadata, rows, total, hasMore: offset + limit < total, ...(container ? {} : { value: node }) };
}
