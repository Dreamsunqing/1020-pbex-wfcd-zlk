import { sha256 } from './io.mjs';
import { readFile } from 'node:fs/promises';
import { CHALLENGE_MANIFESTS, LOCATION_MANIFESTS } from './oracle-bounties.mjs';
import { invasionRules } from './oracle-invasions.mjs';
import { describeWeekly } from './oracle-weekly.mjs';
import { REWARD_CATALOG_FILES, describeBountyRewards } from './oracle-rewards.mjs';

// Upstream compatibility rules are audited against these source revisions. Never execute them.
const reviewed = {
  cycle: ['bounty-cycle.pluto', 'fdd5203b11936cf83b63a56f6edc1652c25ebaf35d5a795d6fefb073f6cd3261'],
  locations: ['location-bounties.pluto', 'c1240b58f50ab804ab597a514b40fe3b14a3000e733600e8c28d05c0df2f2b77'],
  invasions: ['invasions.pluto', 'e223632716779fedb1bc514c82a1dabe32a755b26fe6432b322885e5817f1ae7'],
  weekly: ['weekly.php', '9af5e427443e98151c5d75edd2686fc6df17059cfcd33cf75473b76406b52e48']
};
export async function loadOracleData(readSource, scope) {
  if (!Object.hasOwn(reviewed, scope)) throw new Error('未知 Oracle 模块');
  const [file, expected] = reviewed[scope], code = await readSource('oracle', file), normalizedHash = sha256(code.replace(/\r\n/g, '\n'));
  if (normalizedHash !== expected) throw new Error(`${file} 源码已变化，需要核对 Oracle 兼容算法后再推算`);
  const inputHashes = { [file]: sha256(code) }, warnings = [];
  const json = async (source, name, required = false) => {
    try { const raw = await readSource(source, name), value = JSON.parse(raw); if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('应为键值对象'); inputHashes[`${source}/${name}`] = sha256(raw); return value; }
    catch (error) { if (required) throw error; warnings.push(`${name} 无法读取，保留原始标识：${error.message}`); return {}; }
  };
  const manifests = {};
  for (const name of scope === 'cycle' ? Object.values(CHALLENGE_MANIFESTS) : scope === 'locations' ? Object.values(LOCATION_MANIFESTS).map(x => x[0]) : []) {
    const doc = await json('oracle', `data/${name}`, true); if (!doc.data || typeof doc.data !== 'object') throw new Error(`${name} 缺少 data`); manifests[name] = doc.data;
  }
  const plusDictionary = await json('plus', 'dict.zh.json'), oracleDictionary = await json('oracle', 'dicts/zh.json');
  const dictionary = { ...plusDictionary, ...oracleDictionary };
  if (scope === 'weekly') {
    const raw = await readFile(new URL('../data/oracle-weekly.zh.json', import.meta.url), 'utf8');
    inputHashes['workbench/oracle-weekly.zh.json'] = sha256(raw);
    return { missionTypes: await json('oracle', 'data/ExportMissionTypes.json', true), dictionary, weeklyTranslations: JSON.parse(raw), warnings, inputHashes, sourceHash: sha256(code) };
  }
  const regions = await json('plus', 'ExportRegions.json');
  const details = scope === 'cycle' ? await json('plus', 'ExportChallenges.json') : scope === 'locations' ? await json('plus', 'ExportBounties.json') : {};
  const factions = scope === 'invasions' ? await json('plus', 'ExportFactions.json') : {};
  const resources = scope === 'invasions' ? await json('plus', 'ExportResources.json') : {};
  const recipes = scope === 'invasions' ? await json('plus', 'ExportRecipes.json') : {};
  const weapons = scope === 'invasions' ? await json('plus', 'ExportWeapons.json') : {};
  const rewardCatalogs = {}, bounty = ['cycle', 'locations'].includes(scope);
  if (bounty) for (const name of REWARD_CATALOG_FILES) rewardCatalogs[name] = await json('plus', name);
  const rewardTables = bounty ? await json('plus', 'ExportRewards.json') : {};
  return { rewardTables, rewardCatalogs, rewardDictionaries: { 'oracle/dicts/zh.json': oracleDictionary, 'plus/dict.zh.json': plusDictionary }, manifests, rules: scope === 'invasions' ? invasionRules(code) : null, dictionary, regions, details, factions, resources, recipes, weapons, warnings, inputHashes, sourceHash: sha256(code) };
}
const tail = key => key?.split('/').at(-1) ?? '';
const allyNames = { AmirAllyAgent: '阿米尔', AoiAllyAgent: '碧', ArthurAllyAgent: '亚瑟', EleanorAllyAgent: '埃莉诺', LettieAllyAgent: '莱蒂', QuincyAllyAgent: '昆西' };
const missions = { Exterminate: '歼灭', Sabotage: '破坏', Capture: '捕获', Territory: '拦截', Survival: '生存', MobileDefense: '移动防御', Defense: '防御', Spy: '间谍', Rescue: '救援', Assassination: '刺杀' };
export function describeOracle(result, data, scope, context = {}) {
  if (scope === 'weekly') { describeWeekly(result, data.dictionary, data.weeklyTranslations); result.sourceHash = data.sourceHash; result.inputHashes = data.inputHashes; result.warnings.push(...data.warnings); return result; }
  const translate = (key, fallback) => data.dictionary[key] ?? fallback ?? key;
  const nodeInfo = node => { const region = data.regions[node]; return { nodeName: translate(region?.name, node), system: translate(region?.systemName, null) ?? null, missionName: translate(region?.missionName, null) ?? null }; };
  const details = key => { const value = data.details[key]; return { name: translate(value?.name, tail(key)), description: translate(value?.description, '') }; };
  if (scope === 'cycle') for (const rows of Object.values(result.bounties)) for (const row of rows) {
    Object.assign(row, nodeInfo(row.node)); const info = details(row.challenge), count = data.details[row.challenge]?.requiredCount;
    row.challengeName = info.name; row.allyName = row.ally ? allyNames[tail(row.ally)] ?? tail(row.ally) : null;
    row.challengeDescription = info.description.replace(/\|(?:OPEN_COLOR|CLOSE_COLOR)\|/g, '').replace(/\|COUNT\|/g, count === undefined ? '|COUNT|' : String(count)).replace(/\|ALLY\|/g, row.allyName ?? '|ALLY|');
  }
  if (scope === 'locations') for (const rows of Object.values(result.locations)) for (const row of rows) row.jobDetails = row.jobs.map(key => ({ key, ...details(key) }));
  if (scope === 'invasions') for (const row of result.entries) {
    Object.assign(row, nodeInfo(row.node)); row.allyName = translate(data.factions[row.ally]?.name, row.ally); row.missionNames = row.missions.map(key => missions[key] ?? key);
    row.rewardDetails = row.allyPay.map(item => {
      const recipe = data.recipes[item.ItemType], direct = data.resources[item.ItemType]?.name ?? recipe?.name, resultName = data.weapons[recipe?.resultType]?.name;
      return { ...item, name: direct ? translate(direct) : resultName ? `${translate(resultName)} 蓝图` : tail(item.ItemType) };
    });
  }
  if (['cycle', 'locations'].includes(scope)) describeBountyRewards(result, data, scope, context);
  result.sourceHash = data.sourceHash; result.inputHashes = data.inputHashes; result.warnings.push(...data.warnings); return result;
}
