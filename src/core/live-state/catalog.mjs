import { readFile } from 'node:fs/promises';
import { sha256 } from '../io.mjs';
import { createWeeklyResolver } from './weekly.mjs';
const readBundled = async name => JSON.parse(await readFile(new URL('../../data/' + name, import.meta.url), 'utf8'));
const tail = value => typeof value === 'string' ? value.split('/').at(-1) : '';
const han = value => typeof value === 'string' && /\p{Script=Han}/u.test(value);
export const safeName = value => typeof value === 'string' && !value.startsWith('/') ? value : '名称待补充';
export async function loadWorldCatalog(files, read) {
  const plus = {}, official = [], evidence = [], warnings = [];
  const selected = files.filter(file => file.format === 'json' && (
    file.source === 'plus' && /\/(?:dict\.(?:zh|en)|Export(?:FusionBundles|CreditBundles|EmailItems|BoosterPacks|Regions|MissionTypes|Factions|Resources|Weapons|Warframes|Recipes|Upgrades|Relics|Arcanes|Sentinels|Drones|Customs|Flavour|Keys|Bundles|Boosters|Gear|Virtuals|Bounties|Challenges|Nightwave|Syndicates|Rewards))\.json$/.test(file.id)
    || file.source === 'oracle' && /\/dicts\/zh\.json$/.test(file.id)
    || file.source === 'wfcd' && /\/i18n\/zh\.json$/.test(file.id)
    || file.source === 'official' && /\/manifests\/zh\/Export.*_zh\.json$/.test(file.id)));
  for (const file of selected) try {
    const {bytes,hash} = await read(file.id), data = JSON.parse(bytes.toString('utf8'));
    evidence.push({file:file.id,hash:hash ?? sha256(bytes)});
    if (file.source === 'plus') plus[tail(file.id).replace('.json','')] = data;
    else if (file.source === 'official') official.push(data);
    else plus[file.source === 'oracle' ? 'oracleZh' : 'wfcdZh'] = data;
  } catch (error) { warnings.push(`${file.name}：${error.message}`); }
  const [fallback,wg,supplement,contract,weeklyRules] = await Promise.all(['live-state/community-fallback.json','live-state/wg-nodes.json','oracle-weekly.zh.json','merge-full-contract.json','live-state/weekly-semantics.json'].map(readBundled));
  evidence.push({file:'bundled/live-state/weekly-semantics.json',hash:sha256(Buffer.from(JSON.stringify(weeklyRules)))});
  return createWorldCatalog({plus,official,fallback,wg,supplement,weeklyRules,aliases:contract.aliases,evidence,warnings});
}
export function createWorldCatalog({plus={},official=[],fallback={},wg={},supplement={},weeklyRules={},aliases=[],evidence=[],warnings=[]}={}) {
  const dictionary = {...plus.oracleZh,...plus['dict.zh']}, english = plus['dict.en'] ?? {}, objects = new Map(), englishNames = new Map();
  const canonical = value => {
    const alias = [...aliases].sort((a,b)=>b.from.length-a.from.length).find(a=>a.mode==='exact'?value===a.from:value?.startsWith(a.from));
    return alias ? alias.mode==='exact'?alias.to:alias.to+value.slice(alias.from.length) : value;
  };
  const text = (key, missing='') => {if(typeof key!=='string')return missing;const value=dictionary[key] ?? supplement.entries?.[key];return typeof value==='string'?value:!key.startsWith('/')?key:missing;};
  const add = (id,record,source,prefer=false) => {
    if (!id || !record || typeof record !== 'object') return;
    const key=canonical(id), current=objects.get(key);
    const en=english[record.name] ?? (typeof record.name==='string' && !record.name.startsWith('/') && !han(record.name) ? record.name : null);
    if (en) {const k=en.toLocaleLowerCase();englishNames.set(k,!englishNames.has(k)||englishNames.get(k)===key?key:null);}
    if (!current || prefer) objects.set(key,{...current,...record,_source:source});
  };
  for (const [file,data] of Object.entries(plus)) if (file.startsWith('Export') && data && typeof data==='object') {
    for (const [key,record] of Object.entries(data)) if (key.startsWith('/')) add(key,record,file);
  }
  // Nightwave challenges have a distinct nested dictionary, not a flat item map.
  for (const [key,record] of Object.entries(plus.ExportNightwave?.challenges ?? {})) add(key,record,'ExportNightwave.challenges');
  for (const [key,record] of Object.entries(plus.wfcdZh ?? {})) add(key,record,'wfcd/i18n/zh',true);
  const visit = value => {
    if (!value || typeof value!=='object') return;
    if (value.uniqueName || value.abilityUniqueName) add(value.uniqueName ?? value.abilityUniqueName,value,'official/zh',true);
    if (Array.isArray(value)) value.forEach(visit);
    else for (const child of Object.values(value)) if (child && typeof child==='object') visit(child);
  };
  official.forEach(visit);
  for (const [id,record] of objects) {
    const name = english[record.name] ?? (typeof record.name==='string' && !record.name.startsWith('/') ? record.name : null);
    if (name) {const key=name.toLocaleLowerCase();englishNames.set(key,!englishNames.has(key)||englishNames.get(key)===id?id:null);}
  }
  const item = raw => {
    const id=canonical(raw), record=objects.get(id) ?? {}, translated=text(record.name,'');
    const name=translated || (typeof raw==='string' && !raw.startsWith('/') ? raw : tail(raw)) || '名称待补充';
    return {id,name,description:text(record.description,''),icon:record.icon ?? record.textureLocation, imageName:record.imageName,
      resultId:record.resultType ? canonical(record.resultType) : undefined,blueprint:Boolean(record.resultType),
      localized:Boolean(translated),source:record._source ?? null};
  };
  const label = (key,category,server='de') => {
    if (!key) return {key:null,name:null,fallback:false};
    let name,source;
    if (category==='nodes') {
      const row=plus.ExportRegions?.[key];
      const base=text(row?.name), system=text(row?.systemName);
      name=base ? `${base}${system?' · '+system:''}` : null;source=name?'plus/ExportRegions + dict.zh':null;
      if (server==='wg' && wg.nodes?.[key]) {name=wg.nodes[key];source='wg/regional-override';}
    } else if (['missionTypes','factions','syndicates'].includes(category)) {
      const row=plus[{missionTypes:'ExportMissionTypes',factions:'ExportFactions',syndicates:'ExportSyndicates'}[category]]?.[key];name=text(row?.name);source=name?'plus + dict.zh':null;
    } else if (category==='bosses') name=fallback.sortie?.bosses?.[key]?.name;
    else if (category==='modifiers') name=fallback.sortie?.modifierTypes?.[key];
    else if (category==='fissureModifiers') name=fallback.fissureModifiers?.[key]?.value;
    const shared=category==='nodes'?fallback.solNodes?.[key]?.value:fallback[category]?.[key]?.value;
    name ||= shared;
    return {key,name:name || key,fallback:!name,source:name?(source ?? 'community-fallback'):null};
  };
  const challenge = (key,params={})=>{const record=objects.get(canonical(key)) ?? {};const value=item(key);const count=record.required ?? record.requiredCount;
    return {...value,standing:record.standing,required:count,description:value.description.replace(/\|([A-Z_]+)\|/g,(all,token)=>String(params[token] ?? (token==='COUNT'?count ?? all:all)))};};
  return {plus,dictionary,objects,evidence,warnings,canonical,text,item,label,challenge,
    weekly:createWeeklyResolver({rules:weeklyRules,item,challenge,dictionary}),
    modifierDescription:key=>fallback.sortie?.modifierDescriptions?.[key] ?? null,
    choice:name=>{const id=englishNames.get(name?.toLocaleLowerCase());return id?item(id):{id:null,name,description:'',localized:han(name)};},
  };
}
