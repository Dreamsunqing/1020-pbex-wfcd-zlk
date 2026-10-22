// Offline evidence for P3: inspect every JSON independently, without rewriting upstream data.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { parseDocument, readLibraryFile, scanLibrary } from '../src/core/library.mjs';
import { scanStructure } from '../src/core/json-structure.mjs';
const library = await scanLibrary(process.argv[2] ?? '.');
const files = [], unknown = new Map();
for (const file of library.files.filter(file => file.format === 'json')) {
  try {
    const { bytes, hash } = await readLibraryFile(library.root, file.id), doc = parseDocument(bytes.toString('utf8'), file.id);
    const result = scanStructure(doc.value, file.id);
    for (const row of result.rows.filter(row => row.guide.status === 'unknown')) {
      if (!unknown.has(row.key)) unknown.set(row.key, { key: row.key, files: new Set(), example: { file: file.id, pointer: row.pointer, types: row.types } });
      unknown.get(row.key).files.add(file.id);
    }
    files.push({ id: file.id, hash, bytes: bytes.length, fields: result.fields, unknown: result.unknown, values: result.visited, warnings: doc.warnings });
  } catch (error) { files.push({ id: file.id, error: error.message }); }
}
const report = { generatedAt: new Date().toISOString(), root: library.root, total: files.length, parsed: files.filter(file => !file.error).length, files, unknown: [...unknown.values()].map(item => ({ ...item, files: [...item.files] })).sort((a, b) => b.files.length - a.files.length || a.key.localeCompare(b.key)) };
const output = path.resolve(process.argv[3] ?? 'artifacts/json-structure/inventory.json');
await fs.mkdir(path.dirname(output), { recursive: true }); await fs.writeFile(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ output, total: report.total, parsed: report.parsed, unknownKeys: report.unknown.length, errors: files.filter(file => file.error), commonUnknown: report.unknown.slice(0, 25).map(item => ({ key: item.key, files: item.files.length })) }, null, 2));
if (report.parsed !== report.total) process.exitCode = 1;
