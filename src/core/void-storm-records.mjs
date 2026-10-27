import { readExtendedJsonDate } from './live-state/raw/extended-json.mjs';
import { resolveVoidStormMission } from './live-state/void-storm-mission.mjs';

function readableNode(key, catalog, server) {
  const label = catalog?.label(key, 'nodes', server);
  if (!label?.name || label.fallback) return null;
  const parts = label.name.split(/\s*·\s*/);
  return parts.length === 2 ? `${parts[0]}（${parts[1].replace(/比邻星域$/, '')}）` : label.name;
}

// Readable columns come first; retain the original six fields for reconciliation.
// Snapshot date is the first observation in Asia/Shanghai, not activation date.
export function voidStormRecords(raw, catalog, server, { observedAt } = {}) {
  if (!Array.isArray(raw?.VoidStorms)) throw new Error('缺少 VoidStorms 数组');
  const at = observedAt ?? (Number.isFinite(raw.Time) ? raw.Time * 1000 : null);
  const snapshotTime = readExtendedJsonDate(at);
  if (!snapshotTime) throw new Error('缺少有效快照时间 Time 或 observedAt');
  const snapshotDate = new Date(Date.parse(snapshotTime) + 8 * 3600000).toISOString().slice(0, 10);
  return raw.VoidStorms.map(row => {
    const id = typeof row?._id === 'string' ? row._id : row?._id?.$oid;
    const activation = readExtendedJsonDate(row?.Activation), expiry = readExtendedJsonDate(row?.Expiry);
    if (!id || !activation || !expiry || Date.parse(expiry) <= Date.parse(activation) || typeof row.Node !== 'string' || typeof row.ActiveMissionTier !== 'string') throw new Error('无效的九重天实例，保留已有采集结果');
    const mission = resolveVoidStormMission(row.Node, row.MissionType, catalog, server);
    const missionType = mission.fallback ? null : mission.name;
    const tier = catalog?.label(row.ActiveMissionTier, 'fissureModifiers', server);
    return {
      快照日期: snapshotDate, 节点: readableNode(row.Node, catalog, server),
      任务: missionType, 遗物等级: tier && !tier.fallback ? tier.name : null,
      id, node: row.Node, tier: row.ActiveMissionTier, activation, expiry, missionType,
    };
  });
}

export function mergeStormRecords(previous, incoming) {
  const rows = new Map(previous.map(row => [row.id, row]));
  for (const row of incoming) rows.set(row.id, { ...row, 快照日期: rows.get(row.id)?.快照日期 ?? row.快照日期 });
  return [...rows.values()].sort((a, b) => a.activation.localeCompare(b.activation) || a.id.localeCompare(b.id));
}
