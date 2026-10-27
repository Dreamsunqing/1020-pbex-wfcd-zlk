import { promises as fs } from 'node:fs';
import path from 'node:path';
import { LiveStateStore } from '../src/core/live-state/service.mjs';
import { VoidStormForecastStore } from '../src/core/void-storm-store.mjs';

const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log('node scripts/forecast-void-storms.mjs [--historical|--cached] [--server de|wg|both] [--at ISO时间] [--out 输出目录]\n默认读取两服官方状态，输出未来24小时 JSON、CSV 和 HTML，含每日快照训练的节点／类型候选及回测。--historical 离线历史演示；--cached 复用官方缓存。'); process.exit(0);
}
const option = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const server = option('--server', 'both'); if (!['de', 'wg', 'both'].includes(server)) throw new Error('服务器必须为 de、wg 或 both');
const out = path.resolve(option('--out', '输出/九重天风暴预测'));
const store = new LiveStateStore(path.resolve('.workbench/void-storm-live'));
const forecasts = new VoidStormForecastStore(path.resolve('.workbench/void-storm-forecast'));
await fs.mkdir(out, { recursive: true });
const results = [];
for (const key of server === 'both' ? ['de', 'wg'] : [server]) {
  let snapshot, at;
  if (args.includes('--historical')) {
    const history = await forecasts.history(), sample = history.samples.filter(row => row.server === key && !row.source.startsWith('https://')).sort((a, b) => a.observedAt.localeCompare(b.observedAt)).at(-1);
    at = Date.parse(sample.observedAt);
    snapshot = { server: key, source: sample.source, hash: sample.hash, kind: 'history', raw: { Time: at / 1000, data: sample.storms.map(row => ({ ...row, isStorm: true })) } };
  } else snapshot = args.includes('--cached') ? await store.current(key) : await store.refresh(key);
  const result = await forecasts.view(snapshot, { at: args.includes('--at') ? Date.parse(option('--at')) : at ?? Date.now() });
  results.push(result);
  await fs.writeFile(path.join(out, `${key}-forecast.json`), JSON.stringify(result, null, 2) + '\n');
  const csv = ['server,startsAt_UTC,endsAt_UTC,status', ...result.entries.map(row => `${key},${row.startsAt},${row.endsAt},unverified`)].join('\r\n');
  await fs.writeFile(path.join(out, `${key}-forecast.csv`), '\uFEFF' + csv + '\r\n');
  const cell = value => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const candidates = [['server', 'startsAt_UTC', 'tier_candidate', 'rank', 'node_id', 'node_name', 'mission_type', 'historical_share', 'training_rows', 'status'],
    ...result.entries.flatMap(entry => entry.contentCandidates.flatMap(group => group.nodeCandidates.map((node, index) => [key, entry.startsAt, group.tier, index + 1, node.node, node.name, node.missionType, node.share, group.trainingRows, 'unverified'])))];
  await fs.writeFile(path.join(out, `${key}-candidates.csv`), '\uFEFF' + candidates.map(row => row.map(cell).join(',')).join('\r\n') + '\r\n');
  console.log(JSON.stringify({ server: key, snapshotKind: result.snapshotKind, observedAt: result.observedAt, windows: result.entries.length, hits: result.backtest.hits, evaluated: result.backtest.total,
    content: { nodeTop1: result.contentBacktest.nodeTop1, nodeTop3: result.contentBacktest.nodeTop3, missionTop1: result.contentBacktest.missionTop1 }, refreshError: result.refreshError }));
}
// Self-contained report reuses the application's renderer; no file fetch or CDN required.
const renderer = (await fs.readFile(new URL('../src/ui/void-storm.js', import.meta.url), 'utf8')).replaceAll('export function ', 'function ');
const css = await fs.readFile(new URL('../src/ui/void-storm.css', import.meta.url), 'utf8');
const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>九重天风暴 · 未来24小时预测</title><style>:root{--muted:#64748b;--line:#dbe4e8;--accent:#11857c}*{box-sizing:border-box}body{background:#f1f5f7;color:#172c36;font:15px/1.6 system-ui,'PingFang SC',sans-serif;margin:28px auto;padding:0 22px;max-width:1200px}.card{background:white;border:1px solid var(--line);border-radius:12px;padding:24px}h1{font-size:28px}h3{margin:0 0 14px}.muted{color:var(--muted)}button{font:inherit;padding:10px 18px;margin-right:10px;cursor:pointer;border:1px solid var(--line);border-radius:8px;background:white}button[aria-pressed=true]{background:var(--accent);color:white}.error{color:#b04438}${css}</style><h1>九重天风暴 · 未来 24 小时</h1><p>时间窗口按固定规则外推；内容按每日快照频次给出候选。北京时间（UTC+8），未来窗口与内容均尚未验证。</p><nav id="servers"></nav><main id="report"></main><script>${renderer}\nconst results=${JSON.stringify(results).replaceAll('<', '\\u003c')};const nav=document.getElementById('servers');for(const result of results){const b=document.createElement('button');b.textContent=result.server==='de'?'国际服':'国服';b.onclick=()=>{for(const child of nav.children)child.setAttribute('aria-pressed',String(child===b));renderStormForecast(document.getElementById('report'),result)};nav.append(b)}nav.firstElementChild.click();</script></html>`;
await fs.writeFile(path.join(out, '九重天风暴预测.html'), html);
console.log(`报告：${path.join(out, '九重天风暴预测.html')}`);
