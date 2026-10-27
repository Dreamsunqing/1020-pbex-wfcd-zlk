// An empirical baseline, not a discovered game RNG or a fixed node rotation.
// The node dictionary is static metadata; only observations available at issuance train counts.
const MINUTE = 60_000, HOUR = 3600_000;
export const CONTENT_MODEL = 'void-storm-frequency-1';
const score = (hits, total) => ({ hits, total, rate: total ? hits / total : null });
const clean = value => String(value ?? '').normalize('NFKC').replace(/\s+/g, ' ').replace(/\s*\(\s*/g, '(').replace(/\s*\)/g, ')').trim();
const missionAliases = { '遭遇战': '前哨战', '不稳定': '爆发', '奧菲斯': '奥影', '奥影母艇': '奥影', '間諜': '间谍', '殲滅': '歼灭' };
const rank = counts => [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'en'));

export function contentIdentity(row, catalog = {}) {
  const raw = row.node;
  const key = catalog.nodes?.[raw] ? raw : catalog.aliases?.[clean(raw)];
  const node = key ? catalog.nodes[key] : null;
  if (!raw || !row.tier) return null;
  // No fuzzy name match, no cross-server name join, no fabricated internal node ID.
  const concrete = typeof row.missionType === 'string' && row.missionType.startsWith('MT_') && row.missionType !== 'MT_RAILJACK';
  const rawType = typeof row.missionType === 'string' && !row.missionType.startsWith('MT_') ? row.missionType : null;
  const missionType = concrete ? catalog.missionTypes?.[row.missionType] || null : node?.missionType || missionAliases[rawType] || rawType;
  return { key: key || `label:${clean(raw)}`, node: key || null, name: node?.name || raw,
    missionType, missionBasis: concrete ? 'instance.MissionType' : node?.missionType ? 'plus/ExportRegions.missionName + dict.zh' : 'daily-snapshot.type + 项目类型译名归一', rawMissionType: row.missionType,
    tier: row.tier, activation: row.activation, expiry: row.expiry, rawNode: raw };
}

export function fitStormContent(samples, { server, at, catalog = {} }) {
  const cutoff = Date.parse(at), groups = new Map(), seen = new Set();
  let sourceRows = 0, resolvedRows = 0, unmappedRows = 0;
  const names = new Map(), waveCounts = new Map();
  for (const sample of samples.filter(s => s.server === server && Date.parse(s.observedAt) <= cutoff).toSorted((a, b) => a.observedAt.localeCompare(b.observedAt))) {
    for (const raw of sample.storms) {
      const row = contentIdentity(raw, catalog);
      if (!row) continue;
      const starts = Date.parse(row.activation);
      if (!Number.isFinite(starts)) continue;
      const wave = Math.floor(starts / MINUTE), identity = `${wave}:${row.tier}:${row.key}`;
      if (seen.has(identity)) continue;
      seen.add(identity); sourceRows++; row.node ? resolvedRows++ : unmappedRows++;
      const phase = new Date(starts).getUTCMinutes(), groupKey = `${phase}:${row.tier}`;
      if (!groups.has(groupKey)) groups.set(groupKey, { phaseMinute: phase, tier: row.tier, counts: new Map(), missions: new Map(), total: 0, missionTotal: 0, waveCounts: new Map() });
      const group = groups.get(groupKey);
      group.total++; group.counts.set(row.key, (group.counts.get(row.key) || 0) + 1); names.set(row.key, row);
      if (row.missionType) { group.missionTotal++; group.missions.set(row.missionType, (group.missions.get(row.missionType) || 0) + 1); }
      const waveKey = `${wave}:${row.tier}`;
      if (!waveCounts.has(waveKey)) waveCounts.set(waveKey, { group, count: 0 });
      waveCounts.get(waveKey).count++;
    }
  }
  for (const { group, count } of waveCounts.values()) group.waveCounts.set(String(count), (group.waveCounts.get(String(count)) || 0) + 1);
  return { algorithm: CONTENT_MODEL, trainedAt: at, sourceRows, resolvedRows, unmappedRows,
    groups: [...groups.values()].sort((a, b) => a.phaseMinute - b.phaseMinute || a.tier - b.tier).map(group => ({
      phaseMinute: group.phaseMinute, tier: group.tier, trainingRows: group.total,
      observedWaves: [...group.waveCounts.values()].reduce((a, b) => a + b, 0),
      expectedCount: Number(rank(group.waveCounts)[0]?.[0] || 0),
      nodeCandidates: rank(group.counts).slice(0, 3).map(([key, count]) => ({
        key, node: names.get(key).node, name: names.get(key).name, missionType: names.get(key).missionType,
        missionBasis: names.get(key).missionBasis, count, share: count / group.total,
      })),
      missionCandidates: rank(group.missions).map(([name, count]) => ({ name, count, share: count / group.missionTotal })),
    })),
  };
}

export function forecastStormContent(forecast, samples, catalog) {
  const model = fitStormContent(samples, { server: forecast.server, at: forecast.issuedAt, catalog });
  return { ...forecast, contentModel: model,
    entries: forecast.entries.map(entry => ({ ...entry, contentCandidates: model.groups.filter(group => group.phaseMinute === entry.phaseMinute) })),
    warnings: [
      '时间按 60／90 分钟规则外推；节点、纪元组合与任务类型仅给历史频次候选，尚未验证。',
      '候选按本服、时间组、已见纪元分别统计；占比是历史频次，不是未来成功概率。相同时间组的候选会重复，未发现固定轮换。',
      ...forecast.warnings.filter(row => !row.startsWith('仅外推')),
    ],
  };
}

export function backtestStormContent(samples, timeBacktest, catalog) {
  const actual = new Map(), models = new Map();
  for (const sample of samples.filter(s => s.server === timeBacktest.server).toSorted((a, b) => a.observedAt.localeCompare(b.observedAt))) {
    for (const raw of sample.storms) {
      const row = contentIdentity(raw, catalog);
      if (!row) continue;
      const wave = Math.floor(Date.parse(row.activation) / MINUTE);
      if (!actual.has(wave)) actual.set(wave, new Map());
      const id = `${row.tier}:${row.key}`;
      if (!actual.get(wave).has(id)) actual.get(wave).set(id, row);
    }
  }
  const evaluations = [];
  for (const test of timeBacktest.evaluations) {
    if (!models.has(test.issuedAt)) models.set(test.issuedAt, fitStormContent(samples, { server: timeBacktest.server, at: test.issuedAt, catalog }));
    const model = models.get(test.issuedAt), starts = Date.parse(test.observedStartsAt);
    for (const row of actual.get(Math.floor(starts / MINUTE))?.values() || []) {
      const group = model.groups.find(g => g.phaseMinute === new Date(starts).getUTCMinutes() && g.tier === row.tier);
      const nodes = group?.nodeCandidates || [], mission = group?.missionCandidates[0]?.name || null;
      evaluations.push({ issuedAt: test.issuedAt, observedStartsAt: test.observedStartsAt, leadHours: (starts - Date.parse(test.issuedAt)) / HOUR,
        node: row.node, actualNode: row.name, tier: row.tier, actualMission: row.missionType,
        predictedNode: nodes[0]?.name || null, predictedMission: mission,
        nodeTop1: nodes[0]?.key === row.key, nodeTop3: nodes.some(candidate => candidate.key === row.key),
        missionTop1: row.missionType ? mission === row.missionType : null,
        trainingRows: model.sourceRows, groupRows: group?.trainingRows || 0, unavailable: !group,
      });
    }
  }
  const metrics = rows => ({
    nodeTop1: score(rows.filter(row => row.nodeTop1).length, rows.length),
    nodeTop3: score(rows.filter(row => row.nodeTop3).length, rows.length),
    missionTop1: score(rows.filter(row => row.missionTop1).length, rows.filter(row => row.missionTop1 !== null).length),
  });
  return { algorithm: CONTENT_MODEL, ...metrics(evaluations), evaluatedWaves: timeBacktest.total,
    unavailableRows: evaluations.filter(row => row.unavailable).length,
    bands: [[0, 6], [6, 12], [12, 18], [18, 24]].map(([fromHours, toHours]) => ({ fromHours, toHours, ...metrics(evaluations.filter(row => row.leadHours > fromHours && row.leadHours <= toHours)) })),
    evaluations,
    limitations: ['逐时序扩展训练，只用预测参考时间及之前收到的快照；同节点、纪元、分钟批次去重。',
      '节点首选和前三覆盖以实测任务为分母；类型首选按该纪元最常见类型核验，与节点首选自带的类型分开计分。',
      '纪元是历史已见的候选分组，数量为历史众数，均非已确定排期；未见纪元无法凭空推导。',
      '类型优先查实例枚举及当前静态节点表；无法精确关联的旧译名保留快照类型证据并统一类型译名，不伪造节点 ID。',
      '这是历史频次基线；每日采样稀疏，未观测窗口不计对错，不能证明固定轮换或未来24小时逐任务准确率。'],
  };
}
