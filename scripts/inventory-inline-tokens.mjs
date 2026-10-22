// Explicit offline JSON maintenance. No image scans, downloads, or registry overwrites.
import fs from 'node:fs/promises';
import path from 'node:path';
import { scanLibrary, readLibraryFile, parseDocument } from '../src/core/library.mjs';
import { scanInlineTokens } from '../src/core/inline-tokens.mjs';
const library = await scanLibrary(process.argv[2] ?? '.');
const tokens = new Map(), errors = []; let sourceCount = 0;
const collect = function* (value, ref) {
  if (typeof value === 'string' && value.includes('<')) yield { ref, text: value };
  else if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) yield* collect(child, ref + '/' + key.replaceAll('~', '~0').replaceAll('/', '~1'));
};
for (const file of library.files.filter(row => row.format === 'json')) {
  try {
    const { bytes } = await readLibraryFile(library.root, file.id), { value } = parseDocument(bytes.toString('utf8'), file.id);
    const sources = [...collect(value, file.id + '#')]; sourceCount += sources.length;
    for (const row of scanInlineTokens(sources)) {
      if (!tokens.has(row.token)) tokens.set(row.token, { ...row, occurrences: 0, sources: [] });
      const current = tokens.get(row.token); current.occurrences += row.occurrences;
      current.sources = [...new Set([...current.sources, ...row.sources])].slice(0, 5);
    }
  } catch (error) { errors.push({ file: file.id, message: error.message }); }
}
const rows = [...tokens.values()].sort((a,b) => a.token < b.token ? -1 : a.token > b.token ? 1 : 0);
const output = path.resolve(process.argv[3] ?? '输出/文本处理/文本标记清单.json');
await fs.mkdir(path.dirname(output), { recursive: true });
await fs.writeFile(output, JSON.stringify({ sourceCount, tokens: rows, unknown: rows.filter(row => row.kind === 'unknown'), errors, note: '仅为观察报告，不覆盖人工登记表。' }, null, 2) + '\n');
console.log(JSON.stringify({ output, sourceCount, tokens: rows.length, unknown: rows.filter(row => row.kind === 'unknown').length, errors: errors.length }, null, 2));
if (errors.length) process.exitCode = 1;
