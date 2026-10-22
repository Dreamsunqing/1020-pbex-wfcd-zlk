import { promises as fs } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
async function walk(root) { const files = []; for (const entry of await fs.readdir(root, { withFileTypes: true })) { const file = path.join(root, entry.name); if (entry.isDirectory()) files.push(...await walk(file)); else if (/\.(mjs|cjs|js)$/.test(file)) files.push(file); } return files; }
const files = (await Promise.all(['src', 'scripts', 'test'].map(walk))).flat();
for (const file of files) { const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' }); if (result.status !== 0) { console.error(result.stderr); process.exit(1); } }
console.log(`语法检查通过：${files.length} 个文件`);

await (await import('./prepare-inline-tokens.mjs')).prepareInlineTokens({ check: true });
