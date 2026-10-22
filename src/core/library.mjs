import { promises as fs } from 'node:fs';
import path from 'node:path';
import { parse as parseJsonc, printParseErrorCode } from 'jsonc-parser';
import { contained, exists, readJson, safeRelative, sha256 } from './io.mjs';
import { loadConfig } from './config.mjs';
import { classifyFile } from './facets.mjs';

export const TEXT_EXTENSIONS = new Set(['.json', '.jsonc', '.txt', '.pluto', '.md', '.lua', '.php', '.js', '.mjs', '.ts', '.cat']);
export function allowedText(file) {
  return TEXT_EXTENSIONS.has(path.extname(file).toLowerCase()) && !file.split('/').some(x => ['.git', 'node_modules', 'img', 'images', 'screenshots'].includes(x.toLowerCase())) && file !== 'data/logo.json';
}
export function parseDocument(text, name = '') {
  if (!/\.jsonc?$/i.test(name)) return { value: text, format: 'text', warnings: [] };
  try { return { value: JSON.parse(text.replace(/^\uFEFF/, '')), format: 'json', warnings: [] }; }
  catch (strictError) {
    const errors = [];
    const value = parseJsonc(text, errors, { allowTrailingComma: true, disallowComments: false });
    if (errors.length) throw new Error(`JSON 解析失败：${errors.slice(0, 3).map(e => `${printParseErrorCode(e.error)} @${e.offset}`).join('；')}`);
    return { value, format: 'jsonc', warnings: ['包含注释、尾逗号等扩展语法，原文件按原文保留'] };
  }
}
export function pointerValue(value, pointer = '') {
  if (pointer === '') return value;
  if (typeof pointer !== 'string' || !pointer.startsWith('/')) throw new Error('需要 JSON Pointer，例如 /ExportResources');
  for (const token of pointer.slice(1).split('/')) {
    const key = token.replace(/~1/g, '/').replace(/~0/g, '~');
    if (value === null || typeof value !== 'object' || !Object.hasOwn(value, key)) throw new Error('JSON 路径不存在');
    value = value[key];
  }
  return value;
}
export const escapePointer = key => String(key).replace(/~/g, '~0').replace(/\//g, '~1');
function brief(value) { const text = typeof value === 'string' ? value : JSON.stringify(value); return (text ?? 'null').slice(0, 1200); }
export function describe(value) {
  return { type: value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value, count: value && typeof value === 'object' ? Object.keys(value).length : undefined };
}
export function preview(value, { pointer = '', query = '', offset = 0, limit = 80, titleFor, fieldsFor } = {}) {
  if (typeof query !== 'string' || query.length > 500 || !Number.isInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1 || limit > 200) throw new Error('预览参数无效');
  const node = pointerValue(value, pointer); const info = describe(node);
  if (node === null || typeof node !== 'object') return { ...info, rows: [], scalar: brief(node), hasMore: false, total: 0 };
  const rows = []; let matches = 0; let scanned = 0;
  const search = query.trim().toLocaleLowerCase();
  for (const key of Object.keys(node)) {
    scanned++;
    const item = node[key];
    const itemPointer = `${pointer}/${escapePointer(key)}`;
    let title;
    if (search && !key.toLocaleLowerCase().includes(search) && !JSON.stringify(item).toLocaleLowerCase().includes(search)) {
      title = titleFor?.(item, key, itemPointer);
      if (!title?.text.toLocaleLowerCase().includes(search)) continue;
    }
    matches++;
    if (matches <= offset) continue;
    if (rows.length === limit) return { ...info, rows, hasMore: true, total: info.count, scanned };
    rows.push({ key, pointer: itemPointer, ...describe(item), preview: brief(item), label: typeof item?.name === 'string' ? item.name : undefined,
      ...(titleFor ? { title: title ?? titleFor(item, key, itemPointer) } : {}), ...(fieldsFor ? fieldsFor(item, key, itemPointer) : {}) });
  }
  return { ...info, rows, hasMore: false, total: info.count, matched: matches, scanned };
}
export async function resolveLibraryRoot(selected) {
  const root = await fs.realpath(selected);
  return await exists(path.join(root, '世界状态上游')) ? path.join(root, '世界状态上游') : root;
}
export async function scanLibrary(selected, config) {
  const root = await resolveLibraryRoot(selected); config ??= await loadConfig();
  const files = [];
  async function walk(folder, prefix = '') {
    const entries = await fs.readdir(folder, { withFileTypes: true });
    for (const entry of entries) {
      if ((entry.name.startsWith('.') && !entry.isFile()) || ['node_modules', 'dist', 'artifacts'].includes(entry.name) || entry.isSymbolicLink()) continue;
      const relative = prefix + entry.name;
      if (entry.isDirectory()) { if (!['img', 'images', 'screenshots'].includes(entry.name.toLowerCase())) await walk(path.join(folder, entry.name), `${relative}/`); }
      else if (entry.isFile() && allowedText(relative)) {
        const stat = await fs.stat(path.join(folder, entry.name));
        const source = config.sources.find(s => relative.startsWith(s.localPath + '/'));
        files.push({ id: relative, name: entry.name, source: source?.id ?? 'archive', label: source?.label ?? '其他文件', size: stat.size, modifiedAt: stat.mtime.toISOString(), format: /\.jsonc?$/i.test(relative) ? 'json' : 'text', facets: classifyFile(source ? relative.slice(source.localPath.length + 1) : relative, source?.id) });
      }
    }
  }
  await walk(root); files.sort((a, b) => a.id.localeCompare(b.id));
  return { root, files };
}
export async function readLibraryFile(root, id) {
  const file = await contained(root, id); const stat = await fs.stat(file);
  if (!stat.isFile() || stat.size > 96 * 1024 * 1024) throw new Error('文件不是普通文件或超过 96 MiB 上限');
  const bytes = await fs.readFile(file);
  return { bytes, hash: sha256(bytes) };
}
export async function snapshotFiles(store, release) {
  return Object.entries(release.sources).flatMap(([source, state]) => Object.entries(state.files).map(([id, f]) => ({ id: `${source}/${id}`, name: id.split('/').at(-1), source, label: state.label ?? source, size: f.size, hash: f.hash, format: /\.jsonc?$/i.test(id) ? 'json' : 'text', facets: classifyFile(id, source) })));
}
export function snapshotEntry(release, id) {
  safeRelative(id); const cut = id.indexOf('/'); const source = id.slice(0, cut); const file = id.slice(cut + 1);
  const entry = release.sources[source]?.files[file]; if (!entry) throw new Error('快照文件不存在'); return entry;
}
