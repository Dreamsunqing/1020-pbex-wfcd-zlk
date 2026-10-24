import {dropTableSource} from './drop-table-store.mjs';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import lzma from 'lzma';
import { fetch, EnvHttpProxyAgent, ProxyAgent } from 'undici';
import { atomicJson, blobSha1, mapLimit, readJson, sha256, withLock } from './io.mjs';
import { allowedText, parseDocument, readLibraryFile, scanLibrary } from './library.mjs';
import { changesBetween, Store } from './store.mjs';
import { parseIncursions } from './browse.mjs';

const envAgent = new EnvHttpProxyAgent();
const proxies = new Map();
export async function requestBytes(url, { github = false, maxBytes = 96 * 1024 * 1024, proxyUrl = null } = {}) {
  let last;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const headers = { 'User-Agent': 'WorldStateSourceWorkbench/0.1', Accept: github ? 'application/vnd.github+json' : '*/*' };
      if (github && process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
      if (proxyUrl && !proxies.has(proxyUrl)) proxies.set(proxyUrl, new ProxyAgent(proxyUrl));
      const response = await fetch(url, { headers, dispatcher: proxyUrl ? proxies.get(proxyUrl) : envAgent, signal: AbortSignal.timeout(45000) });
      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}：${new URL(url).hostname}${new URL(url).pathname}`);
        error.noRetry = response.status < 500 && response.status !== 429;
        await response.body?.cancel(); throw error;
      }
      if (Number(response.headers.get('content-length')) > maxBytes) { await response.body.cancel(); throw new Error('远端文件超过大小上限'); }
      const chunks = []; let size = 0;
      for await (const chunk of response.body) { size += chunk.length; if (size > maxBytes) throw new Error('远端文件超过大小上限'); chunks.push(chunk); }
      return Buffer.concat(chunks);
    } catch (error) { last = error; if (error.noRetry) break; if (attempt < 2) await new Promise(r => setTimeout(r, 500 * 2 ** attempt)); }
  }
  throw new Error(`${new URL(url).hostname}：${last.message}${last.cause?.code ? ` (${last.cause.code})` : ''}`);
}
export const decompressIndex = bytes => new Promise((resolve, reject) => {
  if (bytes.length > 1024 * 1024) return reject(new Error('官方索引压缩体过大'));
  lzma.decompress(bytes, (value, error) => { if (error) reject(new Error('LZMA 索引解压失败')); else resolve(typeof value === 'string' ? value : Buffer.from(value).toString('utf8')); });
});
export function parseIndex(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  if (!lines.length || lines.some(x => !/^Export[\w]*\.json![^\s/\\]+$/.test(x))) throw new Error('官方索引内容无效');
  if (new Set(lines.map(x => x.split('!')[0])).size !== lines.length) throw new Error('官方索引有重复文件');
  return lines;
}
const pathUrl = name => name.split('/').map(encodeURIComponent).join('/');
function validateBytes(bytes, name) {
  if (/\.jsonc?$/i.test(name)) parseDocument(bytes.toString('utf8'), name);
  if (/(?:^|\/)sp-incursions\.txt$/.test(name)) parseIncursions(bytes.toString('utf8'));
  if (/arbys(?:-old)?\.txt$/.test(name)) {
    const rows = bytes.toString('utf8').trim().split(/\r?\n/); let previous;
    for (const row of rows) { const match = /^(\d+),([A-Za-z0-9_]+)$/.exec(row); if (!match || (previous !== undefined && Number(match[1]) !== previous + 3600)) throw new Error('仲裁排期不是连续逐小时数据'); previous = Number(match[1]); }
  }
}
async function githubSource(source, previous, config, store, get, report = () => {}) {
  const api = `https://api.github.com/repos/${source.repository}`;
  const commit = JSON.parse((await get(`${api}/commits/${encodeURIComponent(source.branch)}`, { github: true })).toString());
  if (!/^[a-f0-9]{40}$/.test(commit.sha)) throw new Error('GitHub 未返回有效提交');
  const specHash = sha256(JSON.stringify(source));
  if (previous?.version === commit.sha && previous.specHash === specHash) return previous;
  const tree = JSON.parse((await get(`${api}/git/trees/${commit.sha}?recursive=1`, { github: true })).toString());
  if (tree.truncated || !Array.isArray(tree.tree)) throw new Error('GitHub 文件树不完整');
  const entries = tree.tree.filter(x => x.type === 'blob' && x.mode !== '120000' && x.mode !== '160000' && allowedText(x.path));
  if (!entries.length) throw new Error('来源没有可用文本资料');
  let completed = 0;
  const files = Object.fromEntries(await mapLimit(entries.sort((a, b) => a.path.localeCompare(b.path)), config.concurrency, async entry => {
    if (previous?.files[entry.path]?.upstreamBlob === entry.sha) return [entry.path, previous.files[entry.path]];
    const old = previous?.files[entry.path];
    if (old && !old.upstreamBlob) {
      const cached = await store.bytes(old);
      if (cached.length === entry.size && blobSha1(cached) === entry.sha) return [entry.path, { ...old, upstreamBlob: entry.sha }];
    }
    const url = `https://raw.githubusercontent.com/${source.repository}/${commit.sha}/${pathUrl(entry.path)}`;
    const bytes = await get(url);
    if (bytes.length !== entry.size || blobSha1(bytes) !== entry.sha) throw new Error(`Git blob 校验失败：${source.id}/${entry.path}`);
    validateBytes(bytes, entry.path);
    const result = [entry.path, { ...await store.put(bytes), upstreamBlob: entry.sha, url }];
    if (++completed % 10 === 0 || completed === entries.length) report({ source: source.id, message: `${source.label}：已下载并校验 ${completed}/${entries.length} 个文本文件` });
    return result;
  }));
  return { kind: source.kind, label: source.label, repository: source.repository, version: commit.sha, specHash, files };
}
async function officialSource(source, previous, config, store, get, report = () => {}) {
  const files = {}; const indexes = {};
  for (const language of config.languages) {
    report({ source: source.id, message: `检查官方 ${language} 索引与 Manifest` });
    const url = `https://origin.warframe.com/PublicExport/index_${language}.txt.lzma`;
    const bytes = await get(url, { maxBytes: 1024 * 1024 });
    const text = await decompressIndex(bytes); const lines = parseIndex(text);
    indexes[language] = { url, compressedHash: sha256(bytes), indexHash: sha256(text), names: lines };
    const entries = await mapLimit(lines, config.concurrency, async versionedName => {
      const filename = versionedName.split('!')[0]; const relative = `manifests/${language}/${filename}`;
      const old = previous?.files[relative];
      if (old?.versionedName === versionedName) return [relative, old];
      const manifestUrl = `https://content.warframe.com/PublicExport/Manifest/${encodeURIComponent(versionedName)}`;
      const content = await get(manifestUrl); validateBytes(content, filename);
      return [relative, { ...await store.put(content), versionedName, url: manifestUrl }];
    });
    for (const [name, entry] of entries) files[name] = entry;
  }
  const version = sha256(JSON.stringify(indexes));
  return { kind: source.kind, label: source.label, version, indexes, files };
}
export async function importLocal({ libraryRoot, storeRoot, config, onProgress = () => {} }) {
  const store = new Store(storeRoot);
  return withLock(store.root, async () => {
    const current = await store.current();
    const library = await scanLibrary(libraryRoot, config); const sources = {};
    for (const source of config.sources.filter(s => s.enabled)) {
      const entries = library.files.filter(x => x.source === source.id && (source.kind !== 'official' || x.id.includes('/manifests/')));
      if (!entries.length) throw new Error('本地缺少来源：' + source.label);
      onProgress({ message: `导入 ${source.label}（${entries.length} 个文本文件）` });
      const files = Object.fromEntries(await mapLimit(entries, config.concurrency, async entry => {
        const { bytes } = await readLibraryFile(library.root, entry.id); validateBytes(bytes, entry.id);
        return [entry.id.slice(source.localPath.length + 1), { ...await store.put(bytes), ...(source.kind === 'github' ? { upstreamBlob: blobSha1(bytes) } : {}), origin: 'local-import' }];
      }));
      sources[source.id] = { kind: source.kind, label: source.label, version: `local:${sha256(JSON.stringify(files))}`, files };
    }
    const release = await store.publish(sources, current?.id); const changes = changesBetween(current, release);
    await store.collectObjects();
    await store.event({ type: 'imported', releaseId: release.id, count: changes.length });
    return { releaseId: release.id, changes };
  });
}
export async function runUpdate({ storeRoot, config, onProgress = () => {}, get = requestBytes }) {
  const store = new Store(storeRoot);
  return withLock(store.root, async () => {
    const before = await store.current();
    try {
      await atomicJson(path.join(store.root, 'status.json'), { state: 'running', startedAt: new Date().toISOString() });
      const sources = {};
      for (const source of config.sources.filter(s => s.enabled)) {
        onProgress({ source: source.id, message: `检查 ${source.label}` });
        const candidatePath = path.join(store.root, 'candidates', `${source.id}.json`);
        const previous = await readJson(candidatePath).catch(() => before?.sources[source.id]);
        const configuredGet = (url, options) => get(url, { ...options, proxyUrl: config.network?.proxyUrl });
        sources[source.id] = await (source.kind === 'official' ? officialSource : source.kind === 'droptables' ? dropTableSource : githubSource)(source, previous, config, store, configuredGet, onProgress);
        await atomicJson(candidatePath, sources[source.id]);
      }
      const candidate = { sources }; const changes = changesBetween(before, candidate);
      const differs = !before || sha256(JSON.stringify({ schemaVersion: 1, sources })) !== before.id;
      const release = differs ? await store.publish(sources, before?.id) : before;
      await store.collectObjects();
      const result = { state: 'ok', checkedAt: new Date().toISOString(), releaseId: release.id, changed: differs, fileChanges: changes.length, sources: Object.fromEntries(Object.entries(sources).map(([id, s]) => [id, { version: s.version, files: Object.keys(s.files).length }])), email: 'reserved-not-implemented' };
      const previousFailure = await fs.readFile(path.join(store.root, 'last-failure.json'), 'utf8').then(JSON.parse, () => null);
      await store.event({ type: previousFailure ? 'recovered' : differs ? 'updated' : 'checked', ...result });
      await atomicJson(path.join(store.root, 'status.json'), result);
      await fs.rm(path.join(store.root, 'last-failure.json'), { force: true });
      return { ...result, changes };
    } catch (error) {
      const fingerprint = sha256(error.message);
      const failurePath = path.join(store.root, 'last-failure.json');
      const previous = await readJson(failurePath).catch(() => null);
      const failure = { state: 'error', checkedAt: new Date().toISOString(), message: error.message, fingerprint, attempts: previous?.fingerprint === fingerprint ? previous.attempts + 1 : 1, releaseId: before?.id ?? null };
      await atomicJson(failurePath, failure); await atomicJson(path.join(store.root, 'status.json'), failure);
      if (previous?.fingerprint !== fingerprint) await store.event({ type: 'update-failed', ...failure });
      throw error;
    }
  });
}
export async function rollback({ storeRoot, releaseId }) {
  const store = new Store(storeRoot);
  return withLock(store.root, async () => {
    const before = await store.current(); const target = await store.release(releaseId);
    const release = await store.publish(target.sources, before?.id);
    await store.collectObjects();
    await store.event({ type: 'rollback', from: before?.id, releaseId: release.id }); return release.id;
  });
}
