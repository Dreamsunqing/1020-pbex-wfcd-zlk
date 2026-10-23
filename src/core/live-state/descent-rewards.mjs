export function createDescentRewardResolver({ rules = {}, tables = {}, item }) {
  const pool = key => {
    const rule = rules.pools?.[key];
    if (!rule) return null;
    const table = tables.tables?.[rule.table];
    const candidates = rule.candidates ?? table?.rewards ?? [];
    return {
      key, label: rule.label, source: rule.source ?? table?.source,
      note: rule.note ?? '', selection: 'candidate-pool',
      rewards: candidates.map(row => {
        const info = row.id ? item(row.id) : {};
        return { ...info, name: info.localized ? info.name : row.englishName ?? info.name ?? '名称待补充',
          quantity: rule.quantityOverride ?? row.quantity ?? undefined,
          probability: rule.omitProbability ? undefined : row.probability, stats: row.stats ?? [] };
      })
    };
  };
  return (floor, server) => {
    const checkpoint = rules.checkpoints?.includes(floor) ?? false;
    if (!rules.verifiedForServers?.includes(server)) return { checkpoint, verified: false, normal: null, steel: null, boss: null };
    return { checkpoint, verified: true, source: rules.milestoneSource,
      normal: pool(rules.floors?.normal?.[floor]), steel: pool(rules.floors?.steel?.[floor]),
      boss: floor === 21 ? pool('roathe') : null };
  };
}
