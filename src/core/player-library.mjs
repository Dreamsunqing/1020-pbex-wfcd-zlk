// Read-only player projection over the verified P3 build. Never mutates source entities.
import { storeItemId } from './merge/contract.mjs';
import { allItems } from './merge/repository.mjs';
import { internalItems } from './merge/display-policy.mjs';
import { imageDescriptors } from './merge/service.mjs';
import { applyLocalizedFields, selectLocalizedField } from './text-localization.mjs';
import { plainGameText } from './inline-tokens.mjs';
export const LIBRARY_GROUPS = [
  ['warframe','战甲与机甲',['warframe'],'驾驭虚空，选择你的作战方式'],
  ['weapon','武器',['weapon'],'从第一发子弹，到最后一击'],
  ['companion','宠物与同伴',['companion'],'与你同行的可靠伙伴'],
  ['mod','Mod 与套装',['mod','mod-set'],'让每一种配装都有可能'],
  ['arcane','赋能',['arcane'],'为配装添上关键一环'],
  ['resource','资源与部件',['resource'],'寻找制造所需的每一块拼图'],
  ['blueprint','蓝图',['blueprint'],'从材料走向成品'],
  ['relic','虚空遗物',['relic'],'探索封存在遗物中的秘密'],
  ['gear','装备与道具',['gear','extractor','booster'],'为下一次行动做好准备'],
  ['cosmetic','外观',['cosmetic'],'你的战甲，你的风格'],
  ['life','生态与敌人',['animal','enemy'],'认识始源星系的生灵'],
  ['explore','星系与成长',['quest','quest-item','focus','intrinsic','syndicate','faction','system','region','tileset','vendor','dojo','bundle','codex','achievement','challenge','bounty','mission-type'],'探索星系、任务与成长路线']
].map(([id,label,kinds,subtitle])=>({id,label,kinds,subtitle}));
const LABELS = {Primary:'主武器',Secondary:'副武器',Melee:'近战',Warframes:'战甲',Warframe:'战甲',Archwing:'Archwing',Necramech:'殁世机甲',Pets:'宠物',Sentinels:'守护',Sentinel:'守护',Misc:'其他',Components:'组件',MiscItems:'资源与物品',Relics:'遗物',Resources:'资源',Gear:'装备',Cosmetics:'外观',WarframeComponent:'战甲组件',Mods:'Mod',Rifle:'步枪',Pistol:'手枪',Launcher:'发射器',Sniper:'狙击枪',Shotgun:'霰弹枪',Bow:'弓',Amp:'增幅器','Dual Pistols':'双持手枪',Throwing:'投掷武器','Exalted Weapon':'显赫武器','Companion Weapon':'同伴武器','Pet Parts':'宠物部件','Pet Resource':'宠物资源','Conservation Prey':'保育动物','K-Drive Component':'K式悬浮板组件','Zaw Component':'Zaw 组件','Kitgun Component':'组合枪组件','Railjack Turret':'九重天炮台',Railjack:'九重天','Railjack Mod':'九重天 Mod','Arch-Gun':'Archwing 枪械','Arch-Melee':'Archwing 近战',COMMON:'常见',UNCOMMON:'罕见',RARE:'稀有',LEGENDARY:'传说',NORMAL:'普通',PRIME:'Prime',VARIANT:'特殊变体',KUVA:'赤毒',STARTER:'入门',SYNDICATE:'集团',Fish:'鱼类',WARFRAME:'战甲',ARCHWING:'Archwing',PRIMARY:'主武器',SECONDARY:'副武器',MELEE:'近战',STANCE:'架势',AURA:'光环',KAVAT:'库娃',KUBROW:'库狛',SENTINEL:'守护',PARAZON:'灭骸之刃','HELMINTH CHARGER':'Helminth 疾冲者'};
export const playerLabel = value => LABELS[value] ?? value;
const groupFor = item => LIBRARY_GROUPS.find(g=>g.kinds.includes(item.kind))?.id;
const title = (item,locale) => plainGameText(item.name?.[locale] ?? item.name?.en ?? '未命名物品','name');
const desc = (item,locale) => item.description?.[locale] ?? item.description?.en ?? '';
const cache = new WeakMap();
function index(data) {
  if(cache.has(data.output))return cache.get(data.output);
  const all=allItems(data), hidden=internalItems(data), byId=new Map(all.map(i=>[i.id,i])), links=new Map();
  for(const r of data.output['relations.json'] ?? [])for(const id of new Set([r.from,r.to])){if(!links.has(id))links.set(id,[]);links.get(id).push(r);}
  const rows=all.filter(i=>groupFor(i)&&!hidden.has(i.id));const result={all,rows,byId,links};cache.set(data.output,result);return result;
}
function projected(data,item,locale) {
  const fields=Object.keys(data.output['localizations/'+locale+'.json']?.[item.id] ?? {});
  // English fallback must cover deeply nested fields too.
  const keys=new Set([...fields,...Object.keys(data.output['localizations/en.json']?.[item.id] ?? {})]);
  return applyLocalizedFields(item,Object.fromEntries([...keys].map(f=>[f,selectLocalizedField(data,item.id,f,locale)]).filter(([,v])=>v)));
}
function facets(item) {
  const a=item.attributes ?? {};
  return {category:typeof a.category==='string'?a.category:'',type:typeof a.type==='string'?a.type:'',trigger:typeof a.trigger==='string'?a.trigger:'',variant:typeof a.variantType==='string'?a.variantType.replace(/^VT_/,''):a.isPrime===true?'PRIME':a.isPrime===false?'NORMAL':'',rarity:item.rarity ?? '',tradable:item.tradable===true?'yes':item.tradable===false?'no':''};
}
function summary(item,locale) {
  const f=facets(item);return {id:item.id,kind:item.kind,group:groupFor(item),title:title(item,locale),english:plainGameText(item.name?.en ?? '', 'name'),description:desc(item,locale),facets:f,tags:[playerLabel(f.type||f.category),f.variant==='PRIME'?'Prime':null,Number.isFinite(item.masteryRank)?'段位 '+item.masteryRank:null,item.helminth?.transferable?'可移植':null].filter(Boolean),masteryRank:item.masteryRank,stats:item.stats ?? {}};
}
const filters=['category','type','trigger','variant','rarity','tradable'];
function validate(data,args) {
  if(!(data.manifest.locales ?? ['zh-CN','en']).includes(args.locale))throw new Error('未构建该语言');
}
export function playerLibraryList(data,{group='warframe',query='',locale='zh-CN',selected={},mastery='',sort='name',offset=0,limit=36}={}) {
  validate(data,{locale});
  if(!LIBRARY_GROUPS.some(g=>g.id===group)||typeof query!=='string'||query.length>200||!selected||typeof selected!=='object'||Array.isArray(selected)||Object.keys(selected).some(k=>!filters.includes(k))||Object.values(selected).some(v=>typeof v!=='string'||v.length>160)||!['','0-4','5-9','10-14','15+'].includes(mastery)||!['name','mastery','damage','crit','fireRate'].includes(sort)||!Number.isInteger(offset)||offset<0||!Number.isInteger(limit)||limit<1||limit>72)throw new Error('资料库筛选参数无效');
  const {rows}=index(data),q=query.trim().toLocaleLowerCase();
  const groups=LIBRARY_GROUPS.map(g=>({...g,count:rows.filter(i=>groupFor(i)===g.id).length}));
  const candidates=rows.filter(i=>groupFor(i)===group&&(!q||plainGameText([...Object.values(i.name ?? {}),...Object.values(i.description ?? {})].join(' ')).toLocaleLowerCase().includes(q))&&(!mastery||(Number.isFinite(i.masteryRank)&&(mastery==='15+'?i.masteryRank>=15:i.masteryRank>=Number(mastery.split('-')[0])&&i.masteryRank<=Number(mastery.split('-')[1])))));
  const match=(i,except)=>{const f=facets(i);return filters.every(k=>k===except||!selected[k]||f[k]===selected[k]);};
  const options=Object.fromEntries(filters.map(key=>{const counts=new Map();for(const i of candidates.filter(i=>match(i,key))){const v=facets(i)[key];if(v)counts.set(v,(counts.get(v)??0)+1);}return [key,[...counts].sort(([a],[b])=>a.localeCompare(b)).map(([value,count])=>({value,label:key==='tradable'?(value==='yes'?'可交易':'不可交易'):playerLabel(value),count}))];}));
  const result=candidates.filter(i=>match(i));
  result.sort((a,b)=>{if(sort==='name')return title(a,locale).localeCompare(title(b,locale),'zh-CN')||a.id.localeCompare(b.id);const val=i=>sort==='mastery'?i.masteryRank:i.stats?.[{damage:'totalDamage',crit:'criticalChance',fireRate:'fireRate'}[sort]];const av=val(a),bv=val(b);return Number.isFinite(av)&&Number.isFinite(bv)?(sort==='mastery'?av-bv:bv-av)||a.id.localeCompare(b.id):Number.isFinite(av)?-1:Number.isFinite(bv)?1:a.id.localeCompare(b.id);});
  const page=result.slice(offset,offset+limit),images=imageDescriptors(data,page);
  return {datasetVersion:data.manifest.datasetVersion,locales:data.manifest.locales,groups,options,total:result.length,offset,hasMore:offset+limit<result.length,rows:page.map(i=>{const row=summary(i,locale);delete row.description;return {...row,image:images[i.id]};})};
}
export function playerRadar(item,peers) {
  const keys=item.kind==='weapon'?['totalDamage','criticalChance','criticalMultiplier','statusChance','fireRate']:['health','shield','armor','energy','sprintSpeed'];
  return keys.flatMap(key=>{const value=item.stats?.[key],values=peers.map(p=>p.stats?.[key]).filter(Number.isFinite);if(!Number.isFinite(value)||values.length<5||new Set(values).size<2)return [];const rank=(values.filter(v=>v<value).length+values.filter(v=>v===value).length/2)/values.length;return [{key,value,rank,samples:values.length}];});
}
const outgoing={produces:'制作成品',requires:'制造材料','has-ability':'技能','has-component':'组件与材料','has-exalted':'显赫武器','includes-item':'附带物品','augmented-by':'强化 Mod','subsumed-ability':'可移植技能'};
const incoming={produces:'制作蓝图',requires:'用于制造','has-ability':'所属战甲','has-component':'用于物品','has-exalted':'所属战甲','augmented-by':'强化对象','subsumed-ability':'献出技能的战甲'};
export function playerLibraryDetail(data,id,{locale='zh-CN'}={}) {
  validate(data,{locale});if(typeof id!=='string'||id.length>2000)throw new Error('物品标识无效');
  const idx=index(data),canonical=idx.byId.get(id);if(!canonical)throw new Error('资料中没有该物品');
  const item=projected(data,canonical,locale),related=new Map();
  for(const relation of idx.links.get(id) ?? []) {
    const out=relation.from===id,label=(out?outgoing:incoming)[relation.kind],target=idx.byId.get(out?relation.to:relation.from);
    if(!label||!target)continue;
    if(!related.has(label))related.set(label,new Map());
    const rows=related.get(label);if(!rows.has(target.id))rows.set(target.id,{...summary(target,locale),quantity:relation.quantity,slot:relation.slot});
  }
  if(item.kind==='relic'){const rewards=item.attributes?.relicRewards ?? [],fallback=item.attributes?.rewards ?? [];const rows=new Map();for(const r of rewards.length?rewards:fallback){const targetId=storeItemId(r.rewardName ?? r.item?.uniqueName),target=idx.byId.get(targetId);if(!target)continue;const probability=fallback.find(v=>v.item?.uniqueName===targetId)?.chance;rows.set(targetId,{...summary(target,locale),quantity:r.itemCount,probability:Number.isFinite(probability)&&probability>=0&&probability<=100?probability:null});}if(rows.size)related.set('遗物内容',rows);}
  const order=['技能','显赫武器','强化 Mod','可移植技能','组件与材料','制造材料','制作成品','制作蓝图','附带物品'];
  const relationGroups=[...related].sort(([a],[b])=>(order.includes(a)?order.indexOf(a):99)-(order.includes(b)?order.indexOf(b):99)).map(([label,rows])=>({label,rows:[...rows.values()].sort((a,b)=>(a.slot??0)-(b.slot??0))}));
  const all=[item,...[...related.values()].flatMap(rows=>[...rows.keys()].map(id=>idx.byId.get(id)))],images=imageDescriptors(data,all);
  for(const g of relationGroups)for(const row of g.rows)row.image=images[row.id];
  const f=facets(item),peers=idx.rows.filter(i=>i.kind===item.kind&&facets(i).category===f.category&&facets(i).type===f.type);
  const definitions=data.output['contract.json']?.fields ?? [];
  const stats=definitions.filter(d=>d.path.startsWith('stats.')&&Number.isFinite(item.stats?.[d.path.slice(6)])).map(d=>({key:d.path.slice(6),label:d.label,unit:d.unit,value:item.stats[d.path.slice(6)]}));
  const radar=['weapon','warframe','companion'].includes(item.kind)?playerRadar(item,peers):[];
  const a=item.attributes ?? {};
  return {datasetVersion:data.manifest.datasetVersion,item:{...summary(item,locale),image:images[id],passive:item.passiveDescription?.[locale] ?? item.passiveDescription?.en ?? '',tradable:item.tradable,rarity:playerLabel(item.rarity),stats},radar:radar.length>=3?radar.map(r=>({...r,label:definitions.find(d=>d.path==='stats.'+r.key)?.label ?? r.key})):[],peerLabel:playerLabel(f.type||f.category),relations:relationGroups,levelStats:a.levelStats ?? [],attacks:a.attacks ?? [],damage:a.damage ?? {},build:{credits:a.buildPrice,seconds:a.buildTime,quantity:a.buildQuantity},introduced:a.releaseDate};
}
