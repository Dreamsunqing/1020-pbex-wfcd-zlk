// Railjack's MT_RAILJACK is a generic enum. Its concrete objective is the
// explicit ExportRegions.missionName language key, not ExportMissionTypes.
export function resolveVoidStormMission(nodeKey, missionTypeKey, catalog, server = 'de') {
  if (missionTypeKey && missionTypeKey !== 'MT_RAILJACK') {
    const label = catalog?.label(missionTypeKey, 'missionTypes', server);
    // An explicit instance objective must not silently become the node default.
    return { ...(label ?? { key: missionTypeKey, name: null, fallback: true }), basis: 'instance' };
  }
  const region = catalog?.plus?.ExportRegions?.[nodeKey];
  const key = region?.missionType === 'MT_RAILJACK' ? region.missionName : null;
  const name = typeof key === 'string' && key.startsWith('/') ? catalog.text(key) : '';
  if (name && name !== key && !name.startsWith('/')) return {
    key, name, fallback: false, basis: 'node-mission-name',
    source: 'plus/ExportRegions.missionName + dict.zh',
  };
  return { key: key ?? missionTypeKey ?? null, name: null, fallback: true, basis: 'unavailable', source: null };
}
