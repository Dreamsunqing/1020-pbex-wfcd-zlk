import { escapePointer, parseDocument } from './library.mjs';

const chinese = value => typeof value === 'string' && /\p{Script=Han}/u.test(value);
const nameFields = ['name', 'title', 'displayName', 'label', 'Name', 'Title'];
const imageField = key => /(?:image|icon|thumbnail|^img$|^svg$|base64)/i.test(key);
const lotus = value => typeof value === 'string' && /^\/(?:Lotus|louts)\//i.test(value);
const normalize = value => value.replace(/^\/(?:Lotus|louts)\//i, '/Lotus/');
const shorten = (value, limit) => value.length > limit ? value.slice(0, limit) + '…' : value;

export function dictionaryFiles(files) {
  return files.filter(file => file.format === 'json' && file.facets?.kind?.includes('dictionary') && file.facets?.language?.includes('zh'));
}

// Cache parsed indexes by content hash. Bytes are rechecked for every page so local
// dictionary edits are visible without reopening the selected JSON file.
export class PreviewTitles {
  cache = new Map();
  async load(files, read, selectedSource) {
    const warnings = [], indexes = [];
    const priority = file => file.source === selectedSource ? -1 : ({ plus: 0, wfcd: 1, oracle: 2 })[file.source] ?? 3;
    const candidates = dictionaryFiles(files).sort((a, b) => priority(a) - priority(b) || a.id.localeCompare(b.id));
    for (const file of candidates) {
      try {
        const { bytes, hash } = await read(file.id);
        let entry = this.cache.get(file.id);
        if (entry?.hash !== hash) {
          const value = parseDocument(bytes.toString('utf8'), file.id).value, index = new Map();
          if (value && typeof value === 'object' && !Array.isArray(value)) for (const [key, item] of Object.entries(value)) {
            if (!lotus(key)) continue;
            const field = item && typeof item === 'object' ? nameFields.find(name => chinese(item[name])) : null;
            const text = field ? item[field] : item;
            if (chinese(text)) index.set(normalize(key), { text, file: file.id, pointer: `/${escapePointer(key)}${field ? '/' + escapePointer(field) : ''}`, hash });
          }
          entry = { hash, index }; this.cache.set(file.id, entry);
        }
        indexes.push(entry.index);
      } catch (error) { warnings.push(`中文字典不可用：${file.id}（${error.message}）`); }
    }
    // Retain only dictionaries in this library/snapshot.
    const active = new Set(candidates.map(file => file.id));
    for (const key of this.cache.keys()) if (!active.has(key)) this.cache.delete(key);
    return { warnings, resolve: (item, key, pointer, file) => resolveTitle(item, key, pointer, file, indexes) };
  }
}

export function resolveTitle(item, key, pointer, file, indexes = []) {
  const names = item && typeof item === 'object' && !Array.isArray(item) ? nameFields.filter(field => typeof item[field] === 'string').map(field => ({ value: item[field], pointer: `${pointer}/${escapePointer(field)}` })) : [];
  const native = names.find(entry => chinese(entry.value)) ?? (chinese(item) ? { value: item, pointer } : null);
  if (native) return { text: shorten(native.value, 140), original: names[0]?.value ?? key, status: 'original', sources: [{ file, pointer: native.pointer }] };
  const refs = [...names.map(entry => entry.value), item?.uniqueName, item?.type, item?.Type, key, typeof item === 'string' ? item : null].filter(lotus);
  for (const ref of refs) for (const index of indexes) {
    const entry = index.get(normalize(ref));
    if (entry) return { text: shorten(entry.text, 140), original: names[0]?.value ?? ref, status: 'dictionary', reference: ref, sources: [{ file: entry.file, pointer: entry.pointer, hash: entry.hash }] };
  }
  const original = names[0]?.value ?? key;
  return { text: shorten(original, 140), original, status: 'missing', sources: [] };
}

export function cardFields(item) {
  if (item === null || typeof item !== 'object') return { fields: [{ key: '值', value: shorten(typeof item === 'string' ? item : JSON.stringify(item), 400) }], omitted: 0 };
  const entries = Object.entries(item).filter(([key]) => !imageField(key));
  return { fields: entries.slice(0, 8).map(([key, value]) => ({ key, value: shorten(typeof value === 'string' ? value : JSON.stringify(value), 400) })), omitted: Math.max(0, entries.length - 8) };
}
