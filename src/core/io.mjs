import { createHash, randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

export const sha256 = value => createHash('sha256').update(value).digest('hex');
export const blobSha1 = value => createHash('sha1').update(`blob ${value.length}\0`).update(value).digest('hex');
export const exists = async file => fs.access(file).then(() => true, () => false);
export const readJson = async file => JSON.parse(await fs.readFile(file, 'utf8'));
export function safeRelative(value) {
  if (typeof value !== 'string' || !value || value.includes('\\') || value.includes('\0') || value.includes(':') || value.startsWith('/') || value.split('/').some(p => !p || p === '.' || p === '..')) throw new Error('不允许的相对路径');
  return value;
}
export async function contained(root, relative) {
  safeRelative(relative);
  const realRoot = await fs.realpath(root);
  const file = await fs.realpath(path.join(realRoot, relative));
  if (!file.startsWith(realRoot + path.sep)) throw new Error('文件超出资料目录');
  return file;
}
export async function atomicJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${randomUUID()}.tmp`;
  try {
    const handle = await fs.open(temp, 'wx');
    try { await handle.writeFile(JSON.stringify(value, null, 2) + '\n'); await handle.sync(); } finally { await handle.close(); }
    await fs.rename(temp, file);
  } finally { await fs.rm(temp, { force: true }); }
}
export async function mapLimit(values, limit, work) {
  const results = new Array(values.length); let next = 0;
  // Wait for every in-flight worker even when one fails, before releasing locks.
  const workers = Array.from({ length: Math.min(limit, values.length) }, async () => {
    while (next < values.length) { const i = next++; try { results[i] = { value: await work(values[i], i) }; } catch (error) { results[i] = { error }; } }
  });
  await Promise.all(workers);
  const failure = results.find(r => r.error);
  if (failure) throw failure.error;
  return results.map(r => r.value);
}
export async function withLock(root, work) {
  await fs.mkdir(root, { recursive: true });
  const file = path.join(root, 'update.lock');
  let handle;
  try { handle = await fs.open(file, 'wx'); }
  catch (error) {
    if (error.code !== 'EEXIST') throw error;
    let old;
    try { old = await readJson(file); } catch { throw new Error('更新锁不完整，请确认没有更新进程后删除 update.lock'); }
    try { process.kill(old.pid, 0); } catch (e) {
      if (e.code === 'ESRCH') { await fs.rm(file); return withLock(root, work); }
    }
    throw new Error('另一个更新任务正在运行');
  }
  try { await handle.writeFile(JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() })); return await work(); }
  finally { await handle.close(); await fs.rm(file, { force: true }); }
}
