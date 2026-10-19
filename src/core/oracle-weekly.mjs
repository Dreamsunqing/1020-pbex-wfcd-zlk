import { oracleTime, stateProvenance } from './oracle-bounties.mjs';

const TYPES = { CT_LAB: 'lab', CT_HEX: 'hex' };
const MISSION_PREFIX = '/Lotus/Language/Missions/MissionName_';
const riskAlias = key => key === 'EMPBlackHole' ? 'MagneticHounds' : key;
const variableAlias = key => key === 'DullBlades' ? 'ComboCountChance' : key === 'Undersupplied' ? 'MaxAmmo' : key;

// weekly.php uses difficulties[1], even when the normal-tier deviation differs.
export function weeklyConquests(missionTypes, { state, at = Date.now() } = {}, dataVersion = null) {
  oracleTime(at);
  if (!Array.isArray(state?.data?.Conquests)) throw new Error('缺少 Conquests 周常世界状态，请刷新官方状态或导入 JSON');
  const sections = [], warnings = [], compatible = {};
  for (const [type, id] of Object.entries(TYPES)) {
    const active = state.data.Conquests.filter(row => row.Type === type && Date.parse(row.startsAt) <= at && at < Date.parse(row.endsAt));
    if (active.length > 1) throw new Error(`${type} 有多个重叠的有效周常，请核对世界状态`);
    const selected = active[0];
    const missions = (selected?.Missions ?? []).map(mission => {
      const name = missionTypes[mission.missionType]?.name;
      let display = typeof name === 'string' && name.startsWith(MISSION_PREFIX) ? name.slice(MISSION_PREFIX.length) : mission.missionType;
      if (display === mission.missionType) warnings.push(`任务类型 ${mission.missionType} 缺少名称映射，保留原始值`);
      if (display === 'Defense' && type === 'CT_LAB') display = 'DualDefense';
      const difficulty = mission.difficulties[1];
      return { type: display, variant: difficulty.deviation, conditions: difficulty.risks.map(riskAlias), raw: { missionType: mission.missionType, difficultyIndex: 1, variant: difficulty.deviation, risks: [...difficulty.risks] } };
    });
    const variables = (selected?.Variables ?? []).map(raw => ({ key: variableAlias(raw), raw }));
    sections.push({ id, type, status: selected ? 'active' : 'unavailable', startsAt: selected?.startsAt ?? null, endsAt: selected?.endsAt ?? null, missions, variables });
    compatible[`${id}ConquestMissions`] = missions.map(({ raw, ...row }) => row);
    compatible[`${id}ConquestFrameVariables`] = variables.map(row => row.key);
    if (!selected) warnings.push(`${type} 没有覆盖参考时间的周常；请刷新或调整参考时间，不外推下周任务`);
  }
  const ends = sections.filter(row => row.endsAt).map(row => Date.parse(row.endsAt));
  return { algorithm: 'oracle-weekly-1', input: 'world-state', dataVersion, worldState: stateProvenance(state), at: new Date(at).toISOString(), expiry: ends.length ? Math.min(...ends) / 1000 : null, sections, ...compatible, warnings };
}

export function describeWeekly(result, dictionary, supplement = {}) {
  const plain = value => value.replace(/<[^>]*>/g, '');
  const usable = value => typeof value === 'string' && value.trim().length > 0 && /[\u3400-\u9fff]/.test(value);
  const lookup = (key, fallback) => {
    if (usable(dictionary[key])) return { text: plain(dictionary[key]), source: 'upstream' };
    if (usable(supplement.entries?.[key])) return { text: plain(supplement.entries[key]), source: 'supplement' };
    return { text: fallback, source: 'missing' };
  };
  const label = (key, fallback) => lookup(key, fallback).text;
  const missing = new Set();
  const detail = (prefix, key, raw = key) => {
    const name = lookup(prefix + key, key), description = lookup(prefix + key + '_Desc', '');
    if (name.source === 'missing') missing.add(prefix + key);
    if (description.source === 'missing') missing.add(prefix + key + '_Desc');
    return { key, raw, name: name.text, description: description.text, localization: { name: name.source, description: description.source, nameKey: prefix + key, descriptionKey: prefix + key + '_Desc' } };
  };
  for (const section of result.sections) {
    section.name = label(section.id === 'lab' ? '/Lotus/Language/Conquest/SolarMapLabConquestNode' : '/Lotus/Language/1999Echoes/1999HexConquestNode', section.id === 'lab' ? '实验室周常' : 'Hex 周常');
    const variantPrefix = `/Lotus/Language/Conquest/MissionVariant_${section.id === 'lab' ? 'Lab' : 'Hex'}Conquest_`;
    for (const row of section.missions) {
      const missionName = lookup(MISSION_PREFIX + row.type, row.type);
      row.typeName = missionName.text; row.typeLocalization = missionName.source;
      if (missionName.source === 'missing') missing.add(MISSION_PREFIX + row.type);
      row.variantDetails = detail(variantPrefix, row.variant);
      row.conditionDetails = row.conditions.map((key, i) => detail('/Lotus/Language/Conquest/Condition_', key, row.raw.risks[i]));
    }
    section.variableDetails = section.variables.map(({ key, raw }) => detail('/Lotus/Language/Conquest/PersonalMod_', key, raw));
  }
  result.localization = { supplementVersion: supplement.version ?? null, supplementSource: supplement.source ?? null, supplementSourceTitle: supplement.sourceTitle ?? null, missingKeys: [...missing] };
  if (missing.size) result.warnings.push(`有 ${missing.size} 项中文名称或说明待补充，原始标识保留在详情与 JSON 中`);
  return result;
}
