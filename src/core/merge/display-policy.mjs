// Presentation policy only. Hidden rows remain addressable and fully exported.
const cache = new WeakMap();
export function internalItems(data) {
  if (cache.has(data.output)) return cache.get(data.output);
  const origins = new Map();
  for (const row of data.output['reports/source-records.json'] ?? []) {
    const source = Number.isInteger(row.source?.input) ? data.manifest.inputs[row.source.input] : row.source;
    if (!origins.has(row.entityId)) origins.set(row.entityId, []);
    origins.get(row.entityId).push(source);
  }
  const hidden = new Map();
  for (const [id, sources] of origins) if (sources.length && sources.every(source => source?.source === 'plus' && /\/ExportVirtuals\.json$/.test(source.file))) {
    hidden.set(id, '仅来自 ExportVirtuals 的内部继承／兼容定义，无独立物品记录；完整实体与引用仍保留。');
  }
  for (const id of ['/Lotus/Types/Gameplay/NarmerSorties/ArchonCrystal', '/Lotus/Types/Gameplay/NarmerSorties/ArchonCrystalMythic']) hidden.set(id, '源力石通用父类；浏览实际六色普通／Tau 物品即可，父类记录保留。');
  cache.set(data.output, hidden); return hidden;
}
