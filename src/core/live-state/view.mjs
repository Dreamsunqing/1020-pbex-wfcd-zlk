import {cycleTimeline,factionTone,invasionProgress,traderPrices,salePrices,resurgenceNames,fleetProgress,worldBoosters} from './presentation.mjs';
import { calendarCardState, descentCardState } from './card-states.mjs';
import { buildWorldBounties } from './bounties.mjs';
import { IMPLEMENTED_MODULE_NORMALIZERS, RAW_FIELD_MODULES } from './normalizers/index.mjs';
const array = value => Array.isArray(value)?value.filter(row=>row!==null&&row!==undefined):[];
const text = label => label?.name ?? '';
const good = label => label?.fallback ? '名称待补充' : text(label);
const number = value => Number.isFinite(value)?value.toLocaleString('zh-CN'):null;
const clip = value => Math.max(0,Math.min(100,value));
export function buildWorldView(snapshot,catalog,{now=Date.now()}={}) {
  const {raw,server}=snapshot, modules={}, errors=[];
  for (const [id,normalize] of Object.entries(IMPLEMENTED_MODULE_NORMALIZERS)) try {modules[id]=normalize(raw,{server,language:'zh',catalog});if(modules[id].status==='error')errors.push(id);}catch(error){modules[id]={status:'error',data:null,warnings:[error.message]};errors.push(id);}
  const sourceNow=raw.Time*1000, networkFresh=snapshot.kind==='network' && Math.abs(now-sourceNow)<10*60000;
  // Offline samples describe their captured time. Countdown still uses real time in UI.
  const at=networkFresh?now:sourceNow;
  const active=row=>(!row?.activation && !row?.startsAt || Date.parse(row.activation ?? row.startsAt)<=at)&&(!row?.expiry && !row?.endsAt || Date.parse(row.expiry ?? row.endsAt)>at);
  const rows=id=>array(modules[id]?.data).filter(Boolean);
  const translate=(key,missing='')=>catalog.text(key,missing);
  const item=(key,count=1)=>({...catalog.item(key),quantity:count});
  const reward=value=>{
    if (!value || typeof value!=='object') return [];
    return [...array(value.items).map(key=>item(key)),...array(value.countedItems).map(row=>item(row.ItemType,row.ItemCount)),...(value.credits?[{name:'现金',quantity:value.credits,iconToken:'CREDITS'}]:[])];
  };
  const pool=key=>array(catalog.plus.ExportRewards?.[key]).flatMap((group,index)=>array(group).map(row=>({...item(row.type,row.itemCount),probability:row.probability,pool:index+1})));
  const windowOf=row=>({startsAt:row?.startsAt ?? row?.activation,endsAt:row?.endsAt ?? row?.expiry});
  const node=key=>good(catalog.label(key,'nodes',server));
  const mission=key=>good(catalog.label(key,'missionTypes',server));
  const entry=(title,subtitle='',rest={})=>({title,subtitle,...rest});
  const output=[];
  const add=(id,title,group,entries,options={})=>output.push({id,title,group,entries,count:entries.length,preview:3,empty:'当前没有可用项目',...options});
  add('cycles','世界周期','now',rows('cycles').map(row=>entry(row.regionName,row.stateName,{...windowOf(row),endsAt:row.expiry,startsAt:row.activation,tone:row.state,timeline:cycleTimeline(row,at),basis:row.sourceFields.join(' + '),derived:true,iconToken:{day:'SUN',night:'MOON',warm:'SUN',cold:'DT_FREEZE',fass:'DT_VIRAL',vome:'DT_RADIANT',corpus:'DT_ELECTRICITY',grineer:'DT_FIRE'}[row.state],next:row.nextStateName})),{layout:'cycles',preview:6});
  const fissureEntry=(row,storm=false)=>{
    const region=catalog.plus.ExportRegions?.[row.node?.key],planet=translate(region?.systemName)||text(row.node).split(/[·(（]/).at(-1)?.replace(/[)）]/g,'').trim()||'未知星球';
    const resolvedType=storm?mission(region?.missionType):good(row.missionType),missionType=storm&&resolvedType==='名称待补充'?'':resolvedType;
    return entry(good(row.node),missionType,{...windowOf(row),planet,missionType,era:good(storm?row.tier:row.modifier),tier:(storm?row.tier:row.modifier)?.tier,kind:storm?'storm':row.isHard?'hard':'normal',iconToken:storm?'RAILJACK':'VOID'});
  };
  const fissures=[...rows('fissures').filter(active).map(r=>fissureEntry(r)),...rows('voidStorms').filter(active).map(r=>fissureEntry(r,true))].sort((a,b)=>Date.parse(a.endsAt)-Date.parse(b.endsAt));
  add('fissures','虚空裂缝','missions',fissures,{layout:'fissures',wide:true,preview:3,noPagination:true,filters:[['all','全部'],['normal','始源'],['hard','钢铁'],['storm','九重天']]});
  for (const [id,title] of [['sortie','每日突击'],['archonHunt','执刑官猎杀']]) {
    const cards=rows(id).filter(active).map(row=>{const loot=pool(row.rewardKey),boss=/SORTIE_BOSS_(AMAR|BOREAL|NIRA)/.exec(row.boss?.key??'')?.[1],shard=boss?catalog.item('/Lotus/Types/Gameplay/NarmerSorties/ArchonCrystal'+({AMAR:'Amar',BOREAL:'Boreal',NIRA:'Nira'})[boss]):null;return entry(good(row.boss),title,{...windowOf(row),steps:array(row.missions ?? row.variants).map(step=>({title:good(step.node),subtitle:good(step.missionType),description:step.modifier?.fallback?'':step.modifier?.name})),rewards:loot,collapsedRewards:true,shard,...(id==='archonHunt'&&shard?{id:shard.id,icon:shard.icon,imageName:shard.imageName}:{}),iconToken:id==='sortie'?'SORTIE':'ARCHON_SHARD'});});
    add(id,title,'missions',cards,{layout:'mission',preview:1});
  }
  add('alerts','警报任务','missions',rows('alerts').filter(active).map(row=>entry(good(row.mission?.node),good(row.mission?.missionType),{...windowOf(row),rewards:reward(row.mission?.missionReward),description:translate(row.mission?.descText),iconToken:'ALERT'})),{layout:'tiles',preview:3});
  add('invasions','入侵','missions',rows('invasions').filter(row=>!row.completed).map(row=>entry(good(row.node),translate(row.descriptionKey),{...windowOf(row),sides:[{name:good(row.attackerFaction),tone:factionTone(row.attackerFaction?.key),rewards:reward(row.attackerReward)},{name:good(row.defenderFaction),tone:factionTone(row.defenderFaction?.key),rewards:reward(row.defenderReward)}],progress:invasionProgress(row.count,row.goal,row.attackerFaction?.key==='FC_INFESTATION'),invasion:true,iconToken:'INVASION'})),{layout:'tiles',wide:true,preview:3});
  const season=modules.seasonInfo?.data;
  add('nightwave','午夜电波','weekly',array(season?.activeChallenges).filter(active).map(row=>{
    const info=catalog.challenge(row.challengeKey);return entry(info.name,row.daily?'每日挑战':info.standing>=7000?'精英每周挑战':'每周挑战',{...info,...windowOf(row),title:info.name,description:info.description,stats:info.standing?[number(info.standing)+' 声望']:[],iconToken:'NIGHTWAVE'});
  }),{layout:'tiles',wide:true,preview:3});
  add('circuit','双衍回廊','weekly',rows('endlessXpSchedule').filter(active).flatMap(row=>array(row.categoryChoices).map(group=>entry(group.category==='EXC_NORMAL'?'普通回廊':'钢铁回廊',group.category==='EXC_NORMAL'?'战甲可选奖励':'灵化武器轮换',{...windowOf(row),rewards:array(group.choices).map(key=>catalog.circuitChoice?.(key,group.category!=='EXC_NORMAL')??catalog.choice(key)),rotation:catalog.circuitRotation?.(array(group.choices),group.category!=='EXC_NORMAL'),iconToken:'DUVIRI'}))),{layout:'choices',preview:2});
  const detailTerm=(prefix,key)=>({name:translate(prefix+key,key),description:translate(prefix+key+'_Desc')});
  add('conquests','深层科研 · 时光科研','weekly',rows('conquests').filter(active).map(row=>{
    const lab=row.type==='CT_LAB',prefix=`/Lotus/Language/Conquest/MissionVariant_${lab?'Lab':'Hex'}Conquest_`;
    const steps=array(row.missions).map(m=>{
      const normal=array(m.difficulties).find(d=>d.type==='CD_NORMAL'),hard=array(m.difficulties).find(d=>d.type==='CD_HARD');
      const risk=key=>detailTerm('/Lotus/Language/Conquest/Condition_',key==='EMPBlackHole'?'MagneticHounds':key);
      const base=normal??hard,terms=[{...detailTerm(prefix,base?.deviation),mode:'common',label:normal&&hard&&normal.deviation!==hard.deviation?'普通任务变体':'任务变体'},...array(base?.risks).map(k=>({...risk(k),mode:'common',label:hard&&array(hard.risks).includes(k)?'普通 / 精英':'普通风险'}))];
      if(hard&&normal){if(hard.deviation!==normal.deviation)terms.push({...detailTerm(prefix,hard.deviation),mode:'elite',label:'精英变体'});for(const key of array(hard.risks).filter(k=>!array(normal.risks).includes(k)))terms.push({...risk(key),mode:'elite',label:'精英追加风险'});}
      return {title:mission(m.missionType),subtitle:normal&&hard?'普通 / 精英':hard?'精英':'普通',terms};
    });
    return entry(lab?'实验室 · 深层科研':row.type==='CT_HEX'?'Hex · 时光科研':row.type,'本周任务与个人限制',{...windowOf(row),steps,terms:array(row.variables).map(k=>detailTerm('/Lotus/Language/Conquest/PersonalMod_',k==='DullBlades'?'ComboCountChance':k==='Undersupplied'?'MaxAmmo':k)),iconToken:'RESEARCH'});
  }),{layout:'mission',wide:true,preview:2});
  add('calendar','1999 日历','weekly',rows('knownCalendarSeasons').filter(active).flatMap(row=>array(row.days).filter(day=>day.events?.length).sort((a,b)=>a.day-b.day).map(day=>entry('游戏日 '+day.day,catalog.weekly.season(row.season).name,{
    ...windowOf(row),cardState:calendarCardState(array(day.events)),rewards:array(day.events).filter(e=>e.rewardKey).map(e=>item(e.rewardKey)),
    terms:array(day.events).filter(e=>!e.rewardKey).map(e=>catalog.weekly.calendarEvent(e)),
    reference:{season:row.season,yearIteration:row.yearIteration,day:day.day,events:day.events,localization:array(day.events).filter(e=>!e.rewardKey).map(e=>catalog.weekly.calendarEvent(e)),upgradeAvailabilityRequirements:row.upgradeAvailabilityRequirements},iconToken:'CALENDAR'
  }))),{layout:'tiles',preview:3,showTerms:true,groupCards:true,note:'按事件分组，组内按游戏日排序；强化为三选一。强化中文为社区资料整理，来源见详情。'});
  add('descents','沉沦之地','weekly',rows('descents').filter(active).flatMap(row=>array(row.challenges).sort((a,b)=>a.index-b.index).map(c=>{
    const info=catalog.weekly.descent(c),known=info.detail.localized;
    return entry('第 '+c.index+' 层',info.type.name,{...windowOf(row),cardState:descentCardState(c.type,info.type.localized),terms:[info.detail,...info.auras.filter(a=>a.localized),...info.specs.filter(s=>s.localized)].filter(t=>t.name!==info.type.name||t.description),
      difficultyRewards:catalog.descentRewards(c.index,server),
      reference:{...c,localization:info},note:known?'':'附加条件说明待补充；详情保留上游数据',iconToken:'DESCENT'});
  })),{layout:'descent-floors',preview:3,showTerms:true,note:server==='de'?'任务共用；普通与钢铁之路的奖励独立。奖励为候选池，两轨每周各 10 次。':'任务共用；国服奖励规则尚待核实。'});
  for(const [id,title] of [['voidTraders','虚空商人'],['primeVaultTraders','Prime 重生']]) {
    const prime=id==='primeVaultTraders';
    const cards=rows(id).map(row=>{
      const started=Date.parse(row.startsAt)<=at,ended=Date.parse(row.endsAt)<=at;
      const products=list=>array(list).map(m=>{const prices=traderPrices(m,prime);return {...catalog.item(m.itemType),prices,stats:prices.map(p=>number(p.amount)+' '+p.currency)};});
      const items=started&&!ended?products(row.manifest):[],evergreen=started&&!ended?products(row.evergreenManifest):[];
      const names=resurgenceNames(items);
      return entry(prime?'瓦奇娅':'Baro Ki’Teer',node(row.node),{...windowOf(row),chips:[ended?'已离开':started?'正在停留':'即将到来'],items:[...items,...evergreen.map(i=>({...i,evergreen:true}))],resurgence:names,shopSummary:prime&&names.length?'当前重生 '+names.join(' 和 '):'商品 '+(items.length+evergreen.length)+' 件',note:!started?'到场后公布本次商品':ended?'该批次已结束':'',iconToken:'DUCATS'});
    });
    add(id,title,'trade',cards,{layout:'shop',preview:1,noPagination:true});
  }
  add('construction','舰队建造','activity',fleetProgress(modules.projectPct?.data??[]),{layout:'fleet',preview:2});
  add('relayConstruction','中继站重建','activity',rows('constructionProjects').filter(active).map(row=>entry(node(row.node),'中继站项目',{...windowOf(row),terms:array(row.tooltipKeys).map(key=>({name:translate(key,'项目说明')})),chips:array(row.tasks).map(key=>translate(key,key))})),{layout:'tiles',preview:2});
  add('dailyDeals','每日特惠','trade',rows('dailyDeals').filter(active).map(row=>entry(catalog.item(row.itemType).name,'',{...catalog.item(row.itemType),...windowOf(row),title:catalog.item(row.itemType).name,stats:[number(row.salePrice)+' 白金',row.discount!==null?'优惠 '+number(row.discount)+'%':null].filter(Boolean),progress:row.amountTotal?clip(100*(row.amountTotal-row.amountSold)/row.amountTotal):null,note:row.amountTotal?'余量 '+number(Math.max(0,row.amountTotal-row.amountSold))+' / '+number(row.amountTotal):'',iconToken:'PLATINUM'})),{layout:'tiles',preview:2});
  add('flashSales','限时商店','trade',rows('flashSales').filter(row=>active(row)&&!row.hideFromMarket).map(row=>{
    const info=catalog.item(row.itemType),prices=salePrices(row);
    return entry(info.name,'',{...info,...windowOf(row),title:info.name,prices,stats:prices.map(p=>number(p.amount)+' '+p.currency),note:!prices.length?'白金 · 原价待查询':null,discount:row.discount,reference:row});
  }),{layout:'sale',preview:3,noPagination:true});
  add('vaultBonus','每周宝库奖励','weekly',rows('weeklyVaultBonusRewards').flatMap(row=>array(row.rewards).map(r=>entry(catalog.item(r.itemType).name,'需求 '+r.pointThreshold+' 点',{...catalog.item(r.itemType),title:catalog.item(r.itemType).name,stats:['数量 '+r.itemCount],chips:[r.claimed?'已标记领取':'奖励轨道']}))),{layout:'tiles',preview:3});
  const syndicates=rows('syndicateMissions').filter(active);
  const bounties=buildWorldBounties(snapshot,catalog,{at,activeSyndicates:syndicates}),bountyEntries=bounties.entries;
  add('bounties','赏金任务','missions',bountyEntries,{layout:'bounties',wide:true,preview:6,
    filters:[['all','全部地区'],...Array.from(new Map(bountyEntries.map(row=>[row.kind,row.title])))],
    note:'当前赏金与 Oracle 挑战／地区任务统一查看；奖励在独立窗口按难度、奖励表及池号区分。'+(bounties.warnings.length?' 部分推算暂不可用，原因见来源诊断。':'')});
  const six=['SteelMeridianSyndicate','ArbitersSyndicate','CephalonSudaSyndicate','PerrinSyndicate','RedVeilSyndicate','NewLokaSyndicate'];
  add('syndicates','集团任务','missions',syndicates.filter(row=>six.includes(row.tag)&&row.nodes?.length).sort((a,b)=>six.indexOf(a.tag)-six.indexOf(b.tag)).map(row=>entry(good(catalog.label(row.tag,'syndicates',server)),'',{
    ...windowOf(row),tag:row.tag,ranks:array(catalog.plus.ExportSyndicates?.[row.tag]?.titles).filter(t=>t.level>=1&&t.level<=5).map(t=>({level:t.level,name:translate(t.name)})),
    steps:array(row.nodes).map((n,index)=>({title:good(n),subtitle:mission(catalog.plus.ExportRegions?.[n.key]?.missionType),ordinal:index+1})),iconToken:'STANDING'
  })),{layout:'syndicates',preview:6,noPagination:true,note:'等级决定可接取的连续 3 个任务；高档任务声望更高，具体数值以游戏结算为准。'});
  add('events','新闻与公告','activity',rows('events').map(row=>entry(translate(row.messages?.[0]?.text ?? row.messages?.[0]?.message,row.community?'社区公告':'公告'),'',{icon:array(raw.Events).find(e=>(e._id?.$oid ?? e._id)===row.id)?.Icon,url:row.links?.[0]?.url ?? row.prop ?? row.liveUrl,...windowOf(row)})),{layout:'news',preview:3});
  add('goals','活动与行动','activity',rows('goals').filter(active).map(row=>entry(translate(row.descriptionKey,'限时行动'),row.node?good(row.node):'',{...windowOf(row),description:translate(row.tooltipKey),rewards:reward(row.reward),icon:row.icon,progress:row.healthPct!==null?clip(row.healthPct*100):null,stats:row.goal?['目标 '+number(row.goal),'当前 '+number(row.count)]:[]})),{layout:'tiles',preview:2});
  add('boosters','全服加成','activity',worldBoosters(modules.globalUpgrades?.status==='error'?null:rows('globalUpgrades'),at,{translate,node}),{layout:'boosters',preview:6,noPagination:true,note:'全服 2× × 同类个人加成 2× = 4×；仅计算这两项。节点限定加成只在标注区域生效。'});
  add('synthesis','精选氏族','activity',rows('featuredGuilds').map(row=>entry(row.name,'',{stats:row.tier!==null?['规模 '+row.tier]:[]})),{layout:'guilds',preview:10,noPagination:true});
  const covered=new Set(Object.keys(RAW_FIELD_MODULES)), extraFields=Object.keys(raw).filter(key=>!covered.has(key));
  const visible=output.filter(module=>module.entries.length || ['fissures','sortie','archonHunt','alerts','voidTraders'].includes(module.id));
  return {server,kind:snapshot.kind,source:snapshot.source,sourceTime:new Date(sourceNow).toISOString(),fetchedAt:snapshot.fetchedAt,hash:snapshot.hash,
    stale:!networkFresh,refreshError:snapshot.refreshError ?? null,at:new Date(at).toISOString(),modules:visible,
    summary:{missions:fissures.length+rows('invasions').filter(r=>!r.completed).length,weekly:visible.filter(m=>m.group==='weekly').length,trade:visible.filter(m=>m.group==='trade').reduce((s,m)=>s+m.count,0)},
    diagnostics:{normalizers:Object.keys(modules).length,rawFields:Object.keys(raw).length,knownFields:covered.size,extraFields,errors,moduleStatus:Object.fromEntries(Object.entries(modules).map(([id,value])=>[id,value.status])),unprojectedModules:['persistentEnemies','projectPct','pvpActiveTournaments','pvpAlternativeModes','hubEvents','experimentRecommended','twitchPromos','skuSales','primeAccessAvailability','temporaryConfig'],
      warnings:[...catalog.warnings,...bounties.warnings,...Object.entries(modules).flatMap(([id,m])=>(m.warnings??[]).map(w=>id+': '+w))],dictionaries:catalog.evidence,buildLabel:raw.BuildLabel,version:raw.Version}};
}
