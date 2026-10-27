import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const asar = createRequire(import.meta.url)('@electron/asar');
const pkg = JSON.parse(await fs.readFile('package.json', 'utf8'));
const platforms = { 'mac-x64': 'dist/mac/Source Workbench.app/Contents/Resources/app.asar', 'win-x64': 'dist/win-unpacked/resources/app.asar' };
async function files(root) { const result = []; for (const entry of await fs.readdir(root, { withFileTypes: true })) { if (entry.name.startsWith('.')) continue; const file = path.join(root, entry.name); if (entry.isDirectory()) result.push(...await files(file)); else result.push(file); } return result; }
const sources = [...await files('src'), ...await files('文档').then(rows => rows.filter(file => file.endsWith('.md') || (file.startsWith('文档/图示/') && /\.(png|svg|json)$/.test(file)))), 'config/default.json', 'README.md', '使用说明.md', '工具/README.md'], results = [];
for (const [platform, archive] of Object.entries(platforms)) {
  for (const file of sources) assert.ok(asar.extractFile(archive, file).equals(await fs.readFile(file)), platform + ' 源码不符 ' + file);
  // electron-builder strips development metadata and rewrites package.json formatting.
  const built = JSON.parse(asar.extractFile(archive, 'package.json'));
  for (const key of ['name', 'version', 'main', 'type', 'dependencies']) assert.deepEqual(built[key], pkg[key], platform + ' 元数据不符 ' + key);
  const zip = `dist/SourceWorkbench-${pkg.version}-${platform.startsWith('mac') ? 'mac' : 'win'}-${platform.endsWith('arm64') ? 'arm64' : 'x64'}.zip`, bytes = await fs.readFile(zip);
  results.push({ platform, version: built.version, sourceFiles: sources.length, sourceMatches: true, packageMetadataMatches: true, file: zip, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
}
await fs.writeFile(`dist/交付校验-${pkg.version}.json`, JSON.stringify({ checkedAt: new Date().toISOString(), packages: results, windowsRuntime: 'not-tested-on-Windows' }, null, 2));
console.log(JSON.stringify(results, null, 2));
