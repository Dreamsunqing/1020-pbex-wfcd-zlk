import { readExtendedJsonDate } from './live-state/raw/extended-json.mjs';

const MINUTE = 60_000, HOUR = 60 * MINUTE;
export const STORM_RULE = Object.freeze({ version: 'void-storm-window-1', periodMinutes: 60, durationMinutes: 90, overlapMinutes: 30, toleranceSeconds: 10 });
const iso = time => new Date(time).toISOString();
function time(value, label) {
  const result = typeof value === 'number' ? value : Date.parse(value);
  if (!Number.isFinite(result) || !Number.isFinite(new Date(result).getTime())) throw new Error(`${label}无效`);
  return result;
}
function serverKey(server) { if (!['de', 'wg'].includes(server)) throw new Error('服务器必须为 de 或 wg'); return server; }

// Accept the official VoidStorms array and the daily snapshot's filtered fissure envelope.
// Never use ActiveMissions or infer a storm from a node name.
export function stormObservation(value, { server, observedAt, source = '', hash = '', id = '' } = {}) {
  serverKey(server);
  const rows = Array.isArray(value?.VoidStorms) ? value.VoidStorms : Array.isArray(value?.data) ? value.data.filter(row => row?.isStorm === true) : null;
  if (!rows) throw new Error('缺少 VoidStorms 或带 isStorm 标记的 data 数组');
  const at = time(observedAt ?? value.last_updated ?? (typeof value.Time === 'number' ? value.Time * 1000 : null), '采集时间');
  let invalidRows = 0;
  const storms = rows.flatMap(row => {
    const activation = readExtendedJsonDate(row?.Activation ?? row?.activation), expiry = readExtendedJsonDate(row?.Expiry ?? row?.expiry);
    if (!activation || !expiry || Date.parse(expiry) <= Date.parse(activation)) { invalidRows++; return []; }
    const node = row.Node ?? row.node ?? null;
    const rawTier = row.ActiveMissionTier ?? row.tierNum ?? row.tier;
    const tier = typeof rawTier === 'string' && /^VoidT[1-6]$/.test(rawTier) ? Number(rawTier.slice(5)) : Number(rawTier);
    return [{ activation, expiry, node, tier: Number.isInteger(tier) && tier >= 1 && tier <= 6 ? tier : null,
      missionType: row.MissionType ?? row.missionType ?? row.type ?? null }];
  });
  return { id: id || `${server}:${iso(at)}:${hash}`, server, observedAt: iso(at), source, hash, invalidRows, storms };
}

export function stormWaves(observation) {
  const groups = new Map();
  for (const row of observation.storms) {
    const starts = time(row.activation, '风暴开始时间'), ends = time(row.expiry, '风暴结束时间');
    const key = Math.floor(starts / MINUTE) * MINUTE;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ starts, ends });
  }
  return [...groups].sort(([a], [b]) => a - b).map(([nominalStart, rows]) => ({
    nominalStart, phaseMinute: new Date(nominalStart).getUTCMinutes(),
    startsAt: iso(Math.min(...rows.map(row => row.starts))), endsAt: iso(Math.min(...rows.map(row => row.ends))),
    count: rows.length, rows,
  }));
}

export function forecastVoidStorms(observation, { at = observation.observedAt, hours = 24 } = {}) {
  serverKey(observation.server);
  const issuedAt = time(at, '预测参考时间'), observedAt = time(observation.observedAt, '采集时间');
  const anchorAge = issuedAt - Math.min(observedAt, observation.generatedAt ? time(observation.generatedAt, '上游生成时间') : observedAt);
  if (issuedAt < observedAt) throw new Error('预测参考时间不能早于采集时间');
  if (!Number.isInteger(hours) || hours < 1 || hours > 24) throw new Error('预测范围为 1 至 24 小时');
  const end = issuedAt + hours * HOUR, waves = stormWaves(observation), anchors = new Map();
  for (const wave of waves) anchors.set(wave.phaseMinute, wave);
  const lanes = [...anchors.values()].sort((a, b) => a.phaseMinute - b.phaseMinute).map(wave => ({
    phaseMinute: wave.phaseMinute, anchorStartsAt: wave.startsAt, anchorEndsAt: wave.endsAt, observedCount: wave.count,
  }));
  const entries = [];
  for (const lane of lanes) {
    const anchor = Date.parse(lane.anchorStartsAt);
    const first = anchor + (Math.floor((issuedAt - anchor) / HOUR) + 1) * HOUR;
    for (let starts = first; starts < end; starts += HOUR) entries.push({
      startsAt: iso(starts), endsAt: iso(starts + STORM_RULE.durationMinutes * MINUTE),
      phaseMinute: lane.phaseMinute, kind: 'predicted-window',
    });
  }
  entries.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const warnings = ['仅外推开始／结束时间；节点、纪元、任务与每批数量均未预测。', '沿用锚点的秒级偏移；时间窗口按 ±10 秒容差核验。'];
  if (!lanes.length) warnings.push('当前快照没有可用风暴时间锚点，未生成预测。');
  if (anchorAge > 2 * HOUR) warnings.push('锚点距参考时间超过 2 小时；以下为旧锚点的条件外推，请刷新核验。');
  if (observation.invalidRows) warnings.push(`${observation.invalidRows} 条原始记录时间无效，未用作锚点。`);
  const durationDeviations = waves.flatMap(wave => wave.rows).filter(row => Math.abs(row.ends - row.starts - STORM_RULE.durationMinutes * MINUTE) > STORM_RULE.toleranceSeconds * 1000).length;
  if (durationDeviations) warnings.push(`${durationDeviations} 条实测记录偏离 90 分钟，规则可能已变化。`);
  return {
    algorithm: STORM_RULE.version, server: observation.server, conditional: true, rule: STORM_RULE,
    issuedAt: iso(issuedAt), horizonEndsAt: iso(end), observedAt: observation.observedAt,
    source: observation.source, hash: observation.hash, stale: anchorAge > 2 * HOUR,
    lanes, entries, warnings, durationDeviations,
  };
}

const score = (hits, total) => ({ hits, total, rate: total ? hits / total : null });
export function backtestVoidStorms(observations, { server, hours = 24 } = {}) {
  serverKey(server);
  const samples = observations.filter(row => row.server === server).toSorted((a, b) => a.observedAt.localeCompare(b.observedAt));
  const seen = new Set(), uniqueSamples = samples.filter(row => { const key = `${row.observedAt}:${row.hash || row.id}`; if (seen.has(key)) return false; seen.add(key); return true; });
  const runs = uniqueSamples.map(sample => ({ sample, forecast: forecastVoidStorms(sample, { hours }) }));
  const actual = new Map();
  for (const [index, run] of runs.entries()) for (const wave of stormWaves(run.sample)) {
    if (!actual.has(wave.nominalStart)) actual.set(wave.nominalStart, { wave, firstSeen: index });
  }
  const evaluations = [], tolerance = STORM_RULE.toleranceSeconds * 1000;
  for (const { wave, firstSeen } of actual.values()) {
    // Walk forward: an issuance must predate both the target start and its first observation.
    // A target is never allowed to supply its own anchor or a future lane.
    const starts = Date.parse(wave.startsAt);
    const run = runs.slice(0, firstSeen).findLast(row => Date.parse(row.forecast.issuedAt) < starts && starts < Date.parse(row.forecast.horizonEndsAt));
    if (!run) continue;
    const predicted = run.forecast.entries.find(row => Math.floor(Date.parse(row.startsAt) / MINUTE) * MINUTE === wave.nominalStart);
    const maxErrorSeconds = predicted ? Math.max(...wave.rows.flatMap(row => [Math.abs(Date.parse(predicted.startsAt) - row.starts), Math.abs(Date.parse(predicted.endsAt) - row.ends)])) / 1000 : null;
    evaluations.push({ observedStartsAt: wave.startsAt, observedEndsAt: wave.endsAt, issuedAt: run.forecast.issuedAt,
      anchorId: run.sample.id, actualId: runs[firstSeen].sample.id, leadHours: (starts - Date.parse(run.forecast.issuedAt)) / HOUR,
      matched: maxErrorSeconds !== null && maxErrorSeconds <= STORM_RULE.toleranceSeconds, maxErrorSeconds,
      predictedStartsAt: predicted?.startsAt ?? null, predictedEndsAt: predicted?.endsAt ?? null });
  }
  const matched = evaluations.filter(row => row.matched).length;
  const bands = [[0, 6], [6, 12], [12, 18], [18, 24]].map(([from, to]) => {
    const rows = evaluations.filter(row => row.leadHours > from && row.leadHours <= to);
    return { fromHours: from, toHours: to, ...score(rows.filter(row => row.matched).length, rows.length) };
  });
  const rows = runs.flatMap(run => run.sample.storms), durationHits = rows.filter(row => Math.abs(Date.parse(row.expiry) - Date.parse(row.activation) - 90 * MINUTE) <= tolerance).length;
  const predictedWindows = runs.reduce((n, run) => n + run.forecast.entries.length, 0);
  return {
    server, algorithm: STORM_RULE.version, metric: '已观测未来波次时间命中率', toleranceSeconds: STORM_RULE.toleranceSeconds,
    ...score(matched, evaluations.length), sampleCount: uniqueSamples.length, observedWaves: actual.size,
    notEvaluableWaves: actual.size - evaluations.length, predictedWindows, bands,
    durationConsistency: score(durationHits, rows.length), evaluations,
    firstObservedAt: uniqueSamples[0]?.observedAt ?? null, lastObservedAt: uniqueSamples.at(-1)?.observedAt ?? null,
    limitations: ['固定 60／90 分钟规则；不使用验证样本拟合锚点。', '只核验后续实际采到的波次；未采到的窗口不计对错，无法估计完整误报率。', '命中率是历史回测结果，不是未来每个窗口的成功概率；24 小时全程连续采样尚未完成。'],
  };
}
