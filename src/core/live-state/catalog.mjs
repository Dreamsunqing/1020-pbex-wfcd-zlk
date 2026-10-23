import { browseRules } from '../browse.mjs';
import { readFile } from 'node:fs/promises';
import { sha256 } from '../io.mjs';
import { createWeeklyResolver } from './weekly.mjs';
import { createDescentRewardResolver } from './descent-rewards.mjs';
import { loadOracleData } from '../oracle-data.mjs';
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
  const [fallback,wg,supplement,contract,weeklyRules,descentRules,descentTables] = await Promise.all(['live-state/community-fallback.json','live-state/wg-nodes.json','oracle-weekly.zh.json','merge-full-contract.json','live-state/weekly-semantics.json','live-state/descent-reward-rules.json','live-state/descent-reward-tables.json'].map(readBundled));
  evidence.push({file:'bundled/live-state/weekly-semantics.json',hash:sha256(Buffer.from(JSON.stringify(weeklyRules)))});
  for(const [file,data] of [['descent-reward-rules',descentRules],['descent-reward-tables',descentTables]])evidence.push({file:`bundled/live-state/${file}.json`,hash:sha256(Buffer.from(JSON.stringify(data)))});
  const oracleData={}, sourceCache=new Map();
  const readSource=async(source,name)=>{
    const key=source+'/'+name;
    if(!sourceCache.has(key))sourceCache.set(key,(async()=>{
      const file=files.find(f=>f.source===source&&f.id.endsWith('/'+name));
      if(!file)throw new Error('缺少 '+key);
      const {bytes,hash}=await read(file.id);
      if(!evidence.some(e=>e.file===file.id))evidence.push({file:file.id,hash:hash??sha256(bytes)});
      return bytes.toString('utf8');
    })());
    return sourceCache.get(key);
  };
  for(const scope of ['cycle','locations'])try{oracleData[scope]=await loadOracleData(readSource,scope);}catch(error){warnings.push('Oracle '+scope+'：'+error.message);}
  let circuitRules=null;try{circuitRules=browseRules(await readSource('browse','live.ts'));}catch(error){warnings.push('回廊轮换：'+error.message);}
  return createWorldCatalog({circuitRules,plus,official,fallback,wg,supplement,weeklyRules,descentRules,descentTables,oracleData,aliases:contract.aliases,evidence,warnings});
}
export function createWorldCatalog({circuitRules=null,plus={},official=[],fallback={},wg={},supplement={},weeklyRules={},descentRules={},descentTables={},oracleData={},aliases=[],evidence=[],warnings=[]}={}) {
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
    if (!current || prefer) objects.set(key,{...current,...record,_source:source,
      _nameCandidates:[...(current?._nameCandidates??[]),{value:record.name,source}],
      _descriptionCandidates:[...(current?._descriptionCandidates??[]),{value:record.description,source}]});
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
    const field=(record,key)=>{
      const direct=text(record?.[key],'');if(han(direct))return {value:direct,source:record?._source};
      const candidate=[...(record?.[key==='name'?'_nameCandidates':'_descriptionCandidates']??[])].reverse().find(row=>han(text(row.value,'')));
      return candidate?{value:text(candidate.value,''),source:candidate.source}:{value:direct,source:record?._source};
    };
    const id=canonical(raw),record=objects.get(id)??{},translated=field(record,'name'),description=field(record,'description');
    const resultName=record.resultType?field(objects.get(canonical(record.resultType)),'name').value:'';
    const era={Lith:'古纪',Meso:'前纪',Neo:'中纪',Axi:'后纪',Requiem:'安魂'}[record.era],quality={VPQ_BRONZE:'完整',VPQ_SILVER:'优良',VPQ_GOLD:'无暇',VPQ_PLATINUM:'光辉'}[record.quality];
    const relic=era&&record.category&&quality?`${era} ${record.category} 遗物（${quality}）`:'';
    const name=(han(translated.value)?translated.value:'') || (resultName ? resultName+' 蓝图' : '') || relic || translated.value || (typeof raw==='string' && !raw.startsWith('/') ? raw : tail(raw)) || '名称待补充';
    return {id,name,description:description.value,icon:record.icon ?? record.textureLocation, imageName:record.imageName,
      resultId:record.resultType ? canonical(record.resultType) : undefined,blueprint:Boolean(record.resultType),
      localized:Boolean(translated.value || resultName || relic),source:translated.source ?? record._source ?? null,
      nameSource:relic&&name===relic?'ExportRelics.era/category/quality + 工作台中文标签':translated.source??null,descriptionSource:description.source??null};
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
  const choice=name=>{const id=englishNames.get(name?.toLocaleLowerCase());return id?item(id):{id:null,name,description:'',localized:han(name)};};
  const circuitChoice=(name,hard=false)=>{
    if(!hard)return choice(name);
    const candidates=[...objects].filter(([id,r])=>id.includes('/IncarnonAdapters/')&&!id.includes('/UnlockerBlueprints/')&&(id.endsWith('/'+name.replace(/[^a-z0-9]/gi,'')+'IncarnonUnlocker')||english[r.name]===name+' Incarnon Genesis'));
    return candidates.length===1?{...item(candidates[0][0]),choiceName:name}:{...choice(name),id:null,icon:undefined,imageName:undefined,choiceName:name,imageNote:'灵化之源图片待关联'};
  };
  const circuitRotation=(choices,hard=false)=>{
    const sets=circuitRules?.[hard?'weapons':'frames'];if(!sets)return null;
    const names=sets.map(set=>set.map(key=>english[key]??key));
    const matches=names.flatMap((set,i)=>set.length===choices.length&&set.every(name=>choices.includes(name))?[i]:[]);
    if(matches.length!==1)return {matched:false,note:'当前选项不在已知轮换表中'};
    const index=matches[0];return {matched:true,index:index+1,total:sets.length,basis:'当前服公开选项匹配完整轮换组',weeks:Array.from({length:4},(_,offset)=>({offset,index:(index+offset)%sets.length+1,rewards:names[(index+offset)%sets.length].map(name=>circuitChoice(name,hard))}))};
  };
  return {circuitChoice,circuitRotation,plus,dictionary,objects,evidence,warnings,canonical,text,item,label,challenge,oracleData,
    weekly:createWeeklyResolver({rules:weeklyRules,item,challenge,dictionary}),
    descentRewards:createDescentRewardResolver({rules:descentRules,tables:descentTables,item}),
    modifierDescription:key=>fallback.sortie?.modifierDescriptions?.[key] ?? null,
    choice,
  };
}
