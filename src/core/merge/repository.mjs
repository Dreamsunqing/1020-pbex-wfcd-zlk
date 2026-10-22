import { promises as fs, constants } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { atomicJson, exists, readJson, safeRelative, sha256, withLock } from '../io.mjs';
import { digest, stable } from './contract.mjs';
import { buildMerged } from './build.mjs';

const verifiedCache = new Map();
const versionPattern = /^[a-f0-9]{64}$/;
export class MergeRepository {
  constructor(root) { this.root = path.resolve(root); }
  directory(version) { if (!versionPattern.test(version)) throw new Error('合并资料版本无效'); return path.join(this.root, 'builds', version); }
  async version(version, trusted = null) {
    const directory = this.directory(version), manifest = await readJson(path.join(directory, 'manifest.json'));
    const { datasetVersion, ...identity } = manifest, { files } = manifest;
    if (datasetVersion !== version || digest(identity) !== version) throw new Error('合并资料清单校验失败');
    if (!Array.isArray(files) || new Set(files.map(f => f.file)).size !== files.length) throw new Error('合并文件清单无效');
    const cacheKey = directory;
    const stats = await Promise.all(files.map(async entry => { safeRelative(entry.file); const stat = await fs.stat(path.join(directory, entry.file)); return `${stat.size}:${stat.mtimeMs}:${stat.ctimeMs}`; }));
    const stamp = digest({ manifest, stats });
    if (verifiedCache.get(cacheKey)?.stamp === stamp) return verifiedCache.get(cacheKey).data;
    if (trusted) { verifiedCache.clear(); verifiedCache.set(cacheKey, { stamp, data: trusted }); return trusted; }
    const output = {};
    for (const entry of files) {
      safeRelative(entry.file);
      const bytes = await fs.readFile(path.join(directory, entry.file));
      if (sha256(bytes) !== entry.hash || bytes.length !== entry.bytes) throw new Error('合并资料文件损坏：' + entry.file);
      Object.defineProperty(output, entry.file, { value: JSON.parse(bytes.toString('utf8')), enumerable: true });
    }
    const data = { manifest, output }; verifiedCache.clear(); verifiedCache.set(cacheKey, { stamp, data }); return data;
  }
  async current() {
    const file = path.join(this.root, 'current.json');
    if (!await exists(file)) return null;
    const current = await readJson(file);
    return { ...await this.version(current.datasetVersion), previousVersion: current.previousVersion ?? null };
  }
  async build(options) {
    return withLock(this.root, async () => {
      const before = await this.current(), result = await buildMerged(options), version = result.manifest.datasetVersion;
      const target = this.directory(version); let created = false;
      if (!await exists(target)) {
        const staging = path.join(this.root, 'builds', '.staging-' + randomUUID());
        try {
          await fs.mkdir(staging, { recursive: true });
          const previousFiles = new Map((before?.manifest.files ?? []).map(entry => [entry.hash, entry.file]));
          const nextFiles = new Map(result.manifest.files.map(entry => [entry.file, entry]));
          for (const [file, value] of Object.entries(result.output)) {
            safeRelative(file); const destination = path.join(staging, file);
            await fs.mkdir(path.dirname(destination), { recursive: true });
            const previousFile = previousFiles.get(nextFiles.get(file)?.hash);
            if (previousFile) await fs.copyFile(path.join(this.directory(before.manifest.datasetVersion), previousFile), destination, constants.COPYFILE_FICLONE);
            else await fs.writeFile(destination, stable(value, result.manifest.encoding === 'compact-json'));
          }
          await fs.writeFile(path.join(staging, 'manifest.json'), stable(result.manifest));
          // Validate every staged byte before making a version addressable.
          for (const entry of result.manifest.files) if (sha256(await fs.readFile(path.join(staging, entry.file))) !== entry.hash) throw new Error('构建暂存校验失败');
          await fs.rename(staging, target); created = true;
        } finally { await fs.rm(staging, { recursive: true, force: true }); }
      }
      await this.version(version, created ? result : null);
      const previousVersion = before?.manifest.datasetVersion === version ? before.previousVersion : before?.manifest.datasetVersion ?? null;
      await atomicJson(path.join(this.root, 'current.json'), { datasetVersion: version, previousVersion, builtAt: new Date().toISOString() });
      // A successful switch retains exactly one previous build in this context.
      for (const name of await fs.readdir(path.join(this.root, 'builds'))) if (versionPattern.test(name) && name !== version && name !== previousVersion) await fs.rm(this.directory(name), { recursive: true, force: true });
      return this.current();
    });
  }
  async changes(current) { return compareMerged(current.previousVersion ? await this.version(current.previousVersion) : null, current); }
}
export function allItems(dataset) { return Object.entries(dataset.output).filter(([file]) => file.startsWith('items/')).flatMap(([, items]) => items); }
export function compareMerged(before, after) {
  const changes = [];
  for (const file of [...new Set([...Object.keys(before?.output ?? {}), ...Object.keys(after.output)])].filter(file => file.startsWith('items/') || ['recipes.json', 'reward-tables.json'].includes(file)).sort()) {
    const previous = new Map((before?.output[file] ?? []).map(item => [item.id, item])), next = new Map((after.output[file] ?? []).map(item => [item.id, item]));
    for (const id of [...new Set([...previous.keys(), ...next.keys()])].sort()) {
      const left = previous.get(id), right = next.get(id);
      if (!left || !right) changes.push({ file, entityId: id, kind: left ? 'removed' : 'added', fields: [] });
      else if (stable(left) !== stable(right)) changes.push({ file, entityId: id, kind: 'changed', fields: fieldDiff(left, right) });
    }
  }
  const oldInputs = new Map((before?.manifest.inputs ?? []).map(input => [input.file, input.hash])), newInputs = new Map(after.manifest.inputs.map(input => [input.file, input.hash]));
  const changedInputs = [...new Set([...oldInputs.keys(), ...newInputs.keys()])].filter(file => oldInputs.get(file) !== newInputs.get(file)).sort();
  return { before: before?.manifest.datasetVersion ?? null, after: after.manifest.datasetVersion, firstBuild: !before, changedInputs, changes };
}
function fieldDiff(before, after, prefix = '') {
  if (stable(before) === stable(after)) return [];
  if (!before || !after || typeof before !== 'object' || typeof after !== 'object' || Array.isArray(before) || Array.isArray(after)) return [{ field: prefix, before: before ?? null, after: after ?? null }];
  return [...new Set([...Object.keys(before), ...Object.keys(after)])].sort().flatMap(key => fieldDiff(before[key], after[key], prefix ? prefix + '.' + key : key));
}
export async function exportMerged(dataset, parent) {
  const target = path.join(path.resolve(parent), 'SourceWorkbench-data-' + dataset.manifest.datasetVersion.slice(0, 12));
  const files = { ...dataset.output, 'manifest.json': dataset.manifest };
  if (await exists(target)) {
    for (const [file, value] of Object.entries(files)) if (await fs.readFile(path.join(target, file), 'utf8') !== stable(value, dataset.manifest.encoding === 'compact-json')) throw new Error('导出目录已有不同内容，请选择其他目录');
    await pruneExports(path.dirname(target), target);
    return { directory: target, reused: true };
  }
  const staging = target + '.tmp-' + randomUUID();
  try {
    for (const [file, value] of Object.entries(files)) { safeRelative(file); await fs.mkdir(path.dirname(path.join(staging, file)), { recursive: true }); await fs.writeFile(path.join(staging, file), stable(value, dataset.manifest.encoding === 'compact-json')); }
    await fs.rename(staging, target);
  } finally { await fs.rm(staging, { recursive: true, force: true }); }
  await pruneExports(path.dirname(target), target);
  return { directory: target, reused: false };
}

async function pruneExports(parent, current) {
  const candidates = [];
  for (const entry of await fs.readdir(parent, { withFileTypes: true })) {
    if (!entry.isDirectory() || !/^SourceWorkbench-data-[a-f0-9]{12}$/.test(entry.name)) continue;
    const directory = path.join(parent, entry.name);
    try {
      const manifest = await readJson(path.join(directory, 'manifest.json'));
      const { datasetVersion, ...identity } = manifest;
      if (digest(identity) !== datasetVersion || entry.name !== 'SourceWorkbench-data-' + datasetVersion.slice(0, 12)) continue;
      const expected = new Set(['manifest.json', ...manifest.files.map(f => safeRelative(f.file))]);
      const walk = async (folder, prefix = '') => { for (const file of await fs.readdir(folder, { withFileTypes: true })) { const relative = prefix + file.name; if (file.isDirectory()) await walk(path.join(folder, file.name), relative + '/'); else if (!file.isFile() || !expected.has(relative)) throw new Error('存在用户文件，跳过自动清理'); } };
      await walk(directory);
      candidates.push({ directory, time: (await fs.stat(directory)).mtimeMs });
    } catch { /* Only recognized, intact generated directories are eligible. */ }
  }
  const previous = candidates.filter(c => c.directory !== current).sort((a, b) => b.time - a.time)[0]?.directory;
  for (const candidate of candidates) if (candidate.directory !== current && candidate.directory !== previous) await fs.rm(candidate.directory, { recursive: true, force: true });
}
