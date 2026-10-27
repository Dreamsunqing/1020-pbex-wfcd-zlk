// Minimal read-only catalog for the independent collector. All data is pinned
// at installation; this module has no Workbench, UI, or source-tree dependency.
export function createStormCollectionCatalog({ plus = {}, fallback = {}, wg = {} }) {
  const text = (key, missing = '') => typeof key !== 'string' ? missing : plus['dict.zh']?.[key] ?? (!key.startsWith('/') ? key : missing);
  const label = (key, category, server) => {
    let name;
    if (category === 'nodes') {
      const row = plus.ExportRegions?.[key], base = text(row?.name), system = text(row?.systemName);
      name = base ? base + (system ? ' · ' + system : '') : null;
      if (server === 'wg' && wg.nodes?.[key]) name = wg.nodes[key];
      name ||= fallback.solNodes?.[key]?.value;
    } else if (category === 'missionTypes') name = text(plus.ExportMissionTypes?.[key]?.name) || fallback.missionTypes?.[key]?.value;
    else if (category === 'fissureModifiers') name = fallback.fissureModifiers?.[key]?.value;
    return { key, name: name || key, fallback: !name };
  };
  return { plus, text, label };
}
