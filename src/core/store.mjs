import { promises as fs } from 'node:fs';
import path from 'node:path';
import { atomicJson, exists, readJson, sha256, safeRelative } from './io.mjs';
import { randomUUID } from 'node:crypto';

export class Store {
  constructor(root) { this.root = path.resolve(root); }
  objectPath(hash) { if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error('无效内容哈希'); return path.join(this.root, 'objects', hash.slice(0, 2), hash); }
  async put(bytes) {
    const hash = sha256(bytes); const file = this.objectPath(hash);
    if (await exists(file)) { if (sha256(await fs.readFile(file)) !== hash) throw new Error('缓存对象已损坏：' + hash); }
    else {
      await fs.mkdir(path.dirname(file), { recursive: true });
      const temp = `${file}.${randomUUID()}.tmp`;
      try {
        const handle = await fs.open(temp, 'wx');
        try { await handle.writeFile(bytes); await handle.sync(); } finally { await handle.close(); }
        await fs.rename(temp, file);
      } finally { await fs.rm(temp, { force: true }); }
    }
    return { hash, size: bytes.length };
  }
  async bytes(entry) { const bytes = await fs.readFile(this.objectPath(entry.hash)); if (sha256(bytes) !== entry.hash || bytes.length !== entry.size) throw new Error('资料对象完整性检查失败'); return bytes; }
  async current() {
    const pointer = path.join(this.root, 'current.json'); if (!await exists(pointer)) return null;
    return this.release((await readJson(pointer)).releaseId);
  }
  async release(id) {
    if (!/^[a-f0-9]{64}$/.test(id)) throw new Error('无效版本 ID');
    const release = await readJson(path.join(this.root, 'releases', `${id}.json`));
    if (release.id !== id || sha256(JSON.stringify({ schemaVersion: release.schemaVersion, sources: release.sources })) !== id) throw new Error('版本清单已损坏');
    return release;
  }
  async publish(sources, previousId = null) {
    const base = { schemaVersion: 1, sources };
    const id = sha256(JSON.stringify(base));
    const release = { ...base, id, createdAt: new Date().toISOString() };
    for (const [sourceId, source] of Object.entries(sources)) {
      safeRelative(sourceId);
      if (!Object.keys(source.files).length) throw new Error(`来源 ${sourceId} 没有文件`);
      for (const [name, entry] of Object.entries(source.files)) { safeRelative(name); await this.bytes(entry); }
    }
    const file = path.join(this.root, 'releases', `${id}.json`);
    if (!await exists(file)) await atomicJson(file, release);
    else await this.release(id);
    const current = await exists(path.join(this.root, 'current.json')) ? await readJson(path.join(this.root, 'current.json')) : null;
    await atomicJson(path.join(this.root, 'current.json'), { releaseId: id, previousId: id === current?.releaseId ? current.previousId : previousId ?? current?.releaseId ?? null, generation: (current?.generation ?? 0) + 1, switchedAt: new Date().toISOString() });
    await this.prune();
    return this.release(id);
  }
  async prune() {
    const pointer = await readJson(path.join(this.root, 'current.json'));
    const keep = new Set([pointer.releaseId, pointer.previousId].filter(Boolean));
    for (const file of await fs.readdir(path.join(this.root, 'releases'))) if (/^[a-f0-9]{64}\.json$/.test(file) && !keep.has(file.slice(0, -5))) await fs.rm(path.join(this.root, 'releases', file));
  }
  async collectObjects() {
    // Called only while holding the update lock, after all candidate writes finish.
    const used = new Set();
    const add = source => { for (const entry of Object.values(source.files ?? {})) used.add(entry.hash); };
    for (const row of await this.history()) for (const source of Object.values((await this.release(row.id)).sources)) add(source);
    const candidates = path.join(this.root, 'candidates');
    if (await exists(candidates)) for (const file of await fs.readdir(candidates)) if (/^[a-zA-Z0-9_-]+\.json$/.test(file)) add(await readJson(path.join(candidates, file)));
    const objects = path.join(this.root, 'objects');
    if (await exists(objects)) for (const prefix of await fs.readdir(objects)) if (/^[a-f0-9]{2}$/.test(prefix)) for (const file of await fs.readdir(path.join(objects, prefix))) if (/^[a-f0-9]{64}$/.test(file) && !used.has(file)) await fs.rm(path.join(objects, prefix, file));
  }
  async event(event) {
    await fs.mkdir(this.root, { recursive: true });
    await fs.appendFile(path.join(this.root, 'events.jsonl'), JSON.stringify({ at: new Date().toISOString(), ...event }) + '\n');
  }
  async status() { return await exists(path.join(this.root, 'status.json')) ? readJson(path.join(this.root, 'status.json')) : { state: 'idle', message: '尚未检查上游', email: 'reserved-not-implemented' }; }
  async history() {
    const dir = path.join(this.root, 'releases'); if (!await exists(dir)) return [];
    const entries = await fs.readdir(dir); const releases = await Promise.all(entries.filter(x => /^[a-f0-9]{64}\.json$/.test(x)).map(x => this.release(x.slice(0, -5))));
    return releases.map(r => ({ id: r.id, createdAt: r.createdAt, sources: Object.keys(r.sources) })).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}
export function changesBetween(before, after) {
  const changes = [];
  for (const source of new Set([...Object.keys(before?.sources ?? {}), ...Object.keys(after?.sources ?? {})])) {
    const old = before?.sources[source]?.files ?? {}; const next = after?.sources[source]?.files ?? {};
    for (const file of new Set([...Object.keys(old), ...Object.keys(next)])) {
      if (old[file]?.hash !== next[file]?.hash) changes.push({ source, file, kind: !old[file] ? 'added' : !next[file] ? 'removed' : 'changed', before: old[file] ?? null, after: next[file] ?? null });
    }
  }
  return changes;
}
