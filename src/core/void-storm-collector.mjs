import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fetch, EnvHttpProxyAgent } from 'undici';
import { atomicJson, readJson, withLock } from './io.mjs';
import { LIVE_SOURCES, validateWorldState } from './live-state/service.mjs';
import { voidStormRecords, mergeStormRecords } from './void-storm-records.mjs';

const MINUTE = 60000, WEEK = 7 * 86400000;
const iso = time => new Date(time).toISOString();
async function optionalJson(file) {
  try { return await readJson(file); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

export async function requestStormState(server, timeoutMs = 18000) {
  const dispatcher = new EnvHttpProxyAgent();
  try {
    const response = await fetch(LIVE_SOURCES[server], { dispatcher, signal: AbortSignal.timeout(timeoutMs), headers: { Accept: 'application/json', 'User-Agent': 'SourceWorkbench/0.17.1 VoidStormCollector' } });
    if (!response.ok) {
      const retry = response.headers.get('retry-after');
      const retryAfterMs = retry ? (/^\d+$/.test(retry) ? Number(retry) * 1000 : Math.max(0, Date.parse(retry) - Date.now())) : 0;
      await response.body?.cancel();
      throw Object.assign(new Error(`HTTP ${response.status}`), { status: response.status, retryAfterMs });
    }
    const chunks = []; let bytes = 0;
    for await (const chunk of response.body) {
      bytes += chunk.length;
      if (bytes > 16 * 1024 * 1024) { await response.body.cancel().catch(() => {}); throw new Error('世界状态响应超过 16 MiB'); }
      chunks.push(chunk);
    }
    return { raw: validateWorldState(Buffer.concat(chunks)), bytes };
  } finally { await dispatcher.close(); }
}

export class VoidStormCollector {
  constructor(root, output, catalog, { now = Date.now, request = requestStormState } = {}) {
    Object.assign(this, { root, output, catalog, now, request });
    this.stateFile = path.join(root, 'state.json');
  }
  summary(state) {
    const due = Object.values(state.servers).map(row => Date.parse(row.nextFetchAt)).filter(Number.isFinite);
    return { status: state.status, startedAt: state.startedAt, endsAt: state.endsAt, output: state.output,
      nextFetchAt: state.status === 'active' && due.length ? iso(Math.min(...due)) : null,
      servers: state.servers };
  }
  async status() {
    const state = await readJson(this.stateFile);
    return this.summary(state);
  }
  async tick({ start = false, stop = false } = {}) {
    return withLock(this.root, async () => {
      let state = await optionalJson(this.stateFile);
      if (!state) {
        if (!start) throw new Error('尚未初始化采集；只能由人工启动 --start，定时运行不能重启七天窗口');
        if (await optionalJson(this.output)) throw new Error('结果文件已存在，拒绝覆盖；请指定新的输出路径');
        const at = this.now();
        state = { schemaVersion: 1, status: 'active', startedAt: iso(at), endsAt: iso(at + WEEK), output: this.output,
          missionTypeBasis: '实例 MissionType 优先；否则按本地九重天节点 missionName 映射，未实测确认该轮任务',
          servers: Object.fromEntries(['de', 'wg'].map(server => [server, { source: LIVE_SOURCES[server], nextFetchAt: iso(at), attempts: 0, successes: 0, failures: 0, consecutiveFailures: 0, count: 0, downloadedBytes: 0 }])) };
        await atomicJson(this.output, { de: { storms: [] }, wg: { storms: [] } });
        await atomicJson(this.stateFile, state);
      }
      if (stop && state.status === 'active') { state.status = 'stopped'; state.stoppedAt = iso(this.now()); }
      if (state.status === 'active' && this.now() >= Date.parse(state.endsAt)) { state.status = 'completed'; state.stoppedAt = iso(this.now()); }
      if (state.status !== 'active') { await atomicJson(this.stateFile, state); return this.summary(state); }
      const result = await readJson(state.output), deadline = Date.parse(state.endsAt);
      for (const [server, progress] of Object.entries(state.servers)) {
        const at = this.now();
        if (at >= deadline) break;
        if (at < Date.parse(progress.nextFetchAt)) continue;
        if (progress.lastAttemptAt && at - Date.parse(progress.lastAttemptAt) < 5 * MINUTE) continue;
        // Checkpoint before network access: a crash/repeated wake cannot retry immediately.
        progress.lastAttemptAt = iso(at); progress.attempts++;
        progress.nextFetchAt = iso(Math.min(deadline, at + 5 * MINUTE));
        await atomicJson(this.stateFile, state);
        try {
          const { raw, bytes = 0 } = await this.request(server, Math.max(1, Math.min(18000, deadline - this.now())));
          const receivedAt = this.now();
          if (receivedAt >= deadline) break;
          if (!Number.isFinite(raw?.Time) || receivedAt - raw.Time * 1000 > 15 * MINUTE || raw.Time * 1000 - receivedAt > 5 * MINUTE) throw new Error('上游世界状态时间陈旧或无效，本次不写入');
          if (progress.lastUpstreamTime && raw.Time < progress.lastUpstreamTime) throw new Error('上游时间倒退，本次不写入');
          const incoming = voidStormRecords(raw, this.catalog, server, { observedAt: receivedAt });
          const merged = mergeStormRecords(result[server].storms, incoming);
          const added = merged.length - result[server].storms.length;
          result[server].storms = merged;
          await atomicJson(state.output, result);
          Object.assign(progress, { count: merged.length, successes: progress.successes + 1, consecutiveFailures: 0, lastSuccessAt: iso(receivedAt), lastUpstreamTime: raw.Time, downloadedBytes: progress.downloadedBytes + bytes, lastError: null });
          const future = incoming.map(row => Date.parse(row.expiry)).filter(time => time > receivedAt);
          // Millisecond differences within a batch collapse into a single request.
          const next = future.length ? Math.min(...future) + MINUTE : receivedAt + 30 * MINUTE;
          progress.nextFetchAt = iso(Math.min(deadline, Math.max(next, at + 5 * MINUTE)));
          await fs.appendFile(path.join(this.root, 'events.jsonl'), JSON.stringify({ at: iso(receivedAt), server, added, total: merged.length, bytes, nextFetchAt: progress.nextFetchAt }) + '\n');
        } catch (error) {
          progress.failures++; progress.consecutiveFailures++; progress.lastError = error.message;
          const delay = Math.max(error.status === 429 ? 15 * MINUTE : 0, Math.min(30, 5 * 3 ** (progress.consecutiveFailures - 1)) * MINUTE, Number.isFinite(error.retryAfterMs) ? error.retryAfterMs : 0);
          progress.nextFetchAt = iso(Math.min(deadline, this.now() + delay));
          await fs.appendFile(path.join(this.root, 'events.jsonl'), JSON.stringify({ at: iso(this.now()), server, error: error.message, nextFetchAt: progress.nextFetchAt }) + '\n');
        }
        await atomicJson(this.stateFile, state);
      }
      if (this.now() >= deadline) { state.status = 'completed'; state.stoppedAt = iso(this.now()); }
      await atomicJson(this.stateFile, state);
      return this.summary(state);
    });
  }
}
