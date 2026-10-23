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
  add('cycles','世界周期','now',rows('cycles').map(row=>entry(row.regionName,row.stateName,{...windowOf(row),endsAt:row.expiry,startsAt:row.activation,tone:row.state,basis:row.sourceFields.join(' + '),derived:true,iconToken:{day:'SUN',night:'MOON',warm:'SUN',cold:'DT_FREEZE',fass:'DT_VIRAL',vome:'DT_RADIANT',corpus:'DT_ELECTRICITY',grineer:'DT_FIRE'}[row.state],next:row.nextStateName})),{layout:'cycles',preview:6});
  const fissures=[...rows('fissures').filter(active).map(row=>entry(good(row.node),good(row.missionType),{...windowOf(row),chips:[good(row.modifier),row.isHard?'钢铁之路':'普通星图'],tier:row.modifier?.tier,kind:row.isHard?'hard':'normal',iconToken:'VOID'})),...rows('voidStorms').filter(active).map(row=>entry(good(row.node),'虚空风暴',{...windowOf(row),chips:[good(row.tier),'九重天'],kind:'storm',iconToken:'RAILJACK'}))].sort((a,b)=>(a.tier??9)-(b.tier??9)||Date.parse(a.endsAt)-Date.parse(b.endsAt));
  add('fissures','虚空裂缝','missions',fissures,{layout:'tiles',wide:true,preview:6,filters:[['all','全部'],['normal','普通'],['hard','钢铁'],['storm','九重天']]});
  for (const [id,title] of [['sortie','每日突击'],['archonHunt','执刑官猎杀']]) {
    const cards=rows(id).filter(active).map(row=>{const loot=pool(row.rewardKey);return entry(good(row.boss),title,{...windowOf(row),steps:array(row.missions ?? row.variants).map(step=>({title:good(step.node),subtitle:good(step.missionType),description:step.modifier?.fallback?'':step.modifier?.name,detail:step.modifier?.description})),rewards:loot,iconToken:id==='sortie'?'SORTIE':'ARCHON_SHARD'});});
    add(id,title,'missions',cards,{layout:'mission',preview:1});
  }
  add('alerts','警报任务','missions',rows('alerts').filter(active).map(row=>entry(good(row.mission?.node),good(row.mission?.missionType),{...windowOf(row),rewards:reward(row.mission?.missionReward),description:translate(row.mission?.descText),iconToken:'ALERT'})),{layout:'tiles',preview:3});
  add('invasions','入侵','missions',rows('invasions').filter(row=>!row.completed).map(row=>entry(good(row.node),translate(row.descriptionKey),{...windowOf(row),sides:[{name:good(row.attackerFaction),rewards:reward(row.attackerReward)},{name:good(row.defenderFaction),rewards:reward(row.defenderReward)}],stats:row.goal?['目标 '+number(row.goal),'进度计数 '+number(row.count)]:[],iconToken:'INVASION'})),{layout:'tiles',wide:true,preview:3});
  const season=modules.seasonInfo?.data;
  add('nightwave','午夜电波','weekly',array(season?.activeChallenges).filter(active).map(row=>{
    const info=catalog.challenge(row.challengeKey);return entry(info.name,row.daily?'每日挑战':info.standing>=7000?'精英每周挑战':'每周挑战',{...info,...windowOf(row),title:info.name,description:info.description,stats:info.standing?[number(info.standing)+' 声望']:[],iconToken:'NIGHTWAVE'});
  }),{layout:'tiles',wide:true,preview:3});
  add('circuit','双衍回廊','weekly',rows('endlessXpSchedule').filter(active).flatMap(row=>array(row.categoryChoices).map(group=>entry(group.category==='EXC_NORMAL'?'普通回廊':'钢铁回廊',group.category==='EXC_NORMAL'?'战甲可选奖励':'灵化武器轮换',{...windowOf(row),rewards:array(group.choices).map(key=>catalog.choice(key)),iconToken:'DUVIRI'}))),{layout:'choices',preview:2});
  const detailTerm=(prefix,key)=>({name:translate(prefix+key,key),description:translate(prefix+key+'_Desc')});
  add('conquests','深层科研 · 时光科研','weekly',rows('conquests').filter(active).map(row=>{
    const lab=row.type==='CT_LAB',prefix=`/Lotus/Language/Conquest/MissionVariant_${lab?'Lab':'Hex'}Conquest_`;
    const steps=array(row.missions).map(m=>{const d=array(m.difficulties).find(x=>x?.type==='CD_HARD') ?? m.difficulties?.[0];return {title:mission(m.missionType),subtitle:'精英难度',description:detailTerm(prefix,d?.deviation).name,terms:[detailTerm(prefix,d?.deviation),...array(d?.risks).map(k=>detailTerm('/Lotus/Language/Conquest/Condition_',k==='EMPBlackHole'?'MagneticHounds':k))]};});
    return entry(lab?'实验室 · 深层科研':row.type==='CT_HEX'?'Hex · 时光科研':row.type,'本周任务与个人限制',{...windowOf(row),steps,terms:array(row.variables).map(k=>detailTerm('/Lotus/Language/Conquest/PersonalMod_',k==='DullBlades'?'ComboCountChance':k==='Undersupplied'?'MaxAmmo':k)),iconToken:'RESEARCH'});
  }),{layout:'mission',wide:true,preview:2});
  add('calendar','1999 日历','weekly',rows('knownCalendarSeasons').filter(active).flatMap(row=>array(row.days).filter(day=>day.events?.length).map(day=>entry('游戏日 '+day.day,catalog.weekly.season(row.season).name,{
    ...windowOf(row),rewards:array(day.events).filter(e=>e.rewardKey).map(e=>item(e.rewardKey)),
    terms:array(day.events).filter(e=>!e.rewardKey).map(e=>catalog.weekly.calendarEvent(e)),
    reference:{season:row.season,yearIteration:row.yearIteration,day:day.day,events:day.events,localization:array(day.events).filter(e=>!e.rewardKey).map(e=>catalog.weekly.calendarEvent(e)),upgradeAvailabilityRequirements:row.upgradeAvailabilityRequirements},iconToken:'CALENDAR'
  }))),{layout:'tiles',preview:3,showTerms:true,note:'游戏日期；强化为三选一。强化中文为社区资料整理，来源见详情。'});
  add('descents','沉沦之地','weekly',rows('descents').filter(active).flatMap(row=>array(row.challenges).map(c=>{
    const info=catalog.weekly.descent(c),known=info.detail.localized;
    return entry('第 '+c.index+' 层',info.type.name,{...windowOf(row),terms:[info.detail,...info.auras.filter(a=>a.localized),...info.specs.filter(s=>s.localized)].filter(t=>t.name!==info.type.name||t.description),
      reference:{...c,localization:info},note:known?'':'附加条件说明待补充；详情保留上游数据',iconToken:'DESCENT'});
  })),{layout:'tiles',preview:3,showTerms:true,note:'按上游楼层顺序。名称及苦行加护采用明确映射；未核实机制不补写。'});
  for(const [id,title] of [['voidTraders','虚空商人'],['primeVaultTraders','Prime 重生活动']]) {
    const cards=rows(id).map(row=>{const started=Date.parse(row.startsAt)<=at,ended=Date.parse(row.endsAt)<=at;const state=ended?'已离开':started?'正在停留':'即将到来';
      // A future trader's manifest is not the upcoming inventory.
      return entry(id==='voidTraders'?'Baro Ki’Teer':'瓦奇娅',node(row.node),{...windowOf(row),chips:[state],items:started&&!ended?[...array(row.manifest),...array(row.evergreenManifest)].map(m=>({...catalog.item(m.itemType),stats:[m.primePrice!==null?'PrimePrice '+number(m.primePrice):null,m.regularPrice!==null?'RegularPrice '+number(m.regularPrice):null,m.ducats!==null&&m.ducats!==undefined?number(m.ducats)+' 杜卡德':null,m.regularCredits!==null&&m.regularCredits!==undefined?number(m.regularCredits)+' 现金':null].filter(Boolean)})):[],note:!started?'到场后公布本次商品':ended?'该批次已结束':'',iconToken:'DUCATS'});});
    add(id,title,'trade',cards,{layout:'shop',preview:1});
  }
  add('market','商店精选','trade',array(modules.inGameMarket?.data?.landingPage?.categories).map(row=>entry(translate(row.nameKey,'精选分类'),array(row.items).length+' 件商品',{items:array(row.items).map(key=>catalog.item(key))})),{layout:'shop',preview:2});
  add('construction','舰队建造','activity',rows('constructionProjects').filter(active).map(row=>entry(node(row.node),'建造项目',{...windowOf(row),terms:array(row.tooltipKeys).map(key=>({name:translate(key,'项目说明')})),chips:array(row.tasks).map(key=>translate(key,key))})),{layout:'tiles',preview:2});
  add('nodeOverrides','特殊节点','missions',rows('nodeOverrides').filter(row=>active(row)&&!row.hide).map(row=>entry(good(row.node),'当前节点变更',{...windowOf(row),description:translate(row.levelOverride),chips:row.customNpcEncounters?.map(key=>catalog.item(key).name)})),{layout:'tiles',preview:3});
  add('dailyDeals','每日特惠','trade',rows('dailyDeals').filter(active).map(row=>entry(catalog.item(row.itemType).name,'',{...catalog.item(row.itemType),...windowOf(row),title:catalog.item(row.itemType).name,stats:[number(row.salePrice)+' 白金',row.discount!==null?'优惠 '+number(row.discount)+'%':null].filter(Boolean),progress:row.amountTotal?clip(100*(row.amountTotal-row.amountSold)/row.amountTotal):null,note:row.amountTotal?'余量 '+number(Math.max(0,row.amountTotal-row.amountSold))+' / '+number(row.amountTotal):'',iconToken:'PLATINUM'})),{layout:'tiles',preview:2});
  add('flashSales','限时商店','trade',rows('flashSales').filter(row=>active(row)&&!row.hideFromMarket).map(row=>entry(catalog.item(row.itemType).name,'',{...catalog.item(row.itemType),...windowOf(row),title:catalog.item(row.itemType).name,stats:[row.discount!==null?'优惠 '+number(row.discount)+'%':null,row.premiumOverride!==null?'价格 '+number(row.premiumOverride):null].filter(Boolean)})),{layout:'tiles',preview:3});
  add('vaultBonus','每周宝库奖励','weekly',rows('weeklyVaultBonusRewards').flatMap(row=>array(row.rewards).map(r=>entry(catalog.item(r.itemType).name,'需求 '+r.pointThreshold+' 点',{...catalog.item(r.itemType),title:catalog.item(r.itemType).name,stats:['数量 '+r.itemCount],chips:[r.claimed?'已标记领取':'奖励轨道']}))),{layout:'tiles',preview:3});
  const syndicates=rows('syndicateMissions').filter(active);
  add('bounties','地区赏金','missions',syndicates.filter(row=>row.jobs?.length).map(row=>entry(good(catalog.label(row.tag,'syndicates',server)),'赏金任务',{...windowOf(row),items:array(row.jobs).map((job,index)=>{const key=job.jobType ?? job.type ?? job.JobType;const info=catalog.item(key);return {...info,title:info.name==='名称待补充'?'第 '+(index+1)+' 档':info.name,stats:[job.minEnemyLevel!==undefined?'等级 '+job.minEnemyLevel+'–'+job.maxEnemyLevel:null].filter(Boolean),rewards:pool(job.rewards)};}),iconToken:'BOUNTY'})),{layout:'shop',wide:true,preview:3});
  add('syndicates','集团任务','missions',syndicates.filter(row=>row.nodes?.length).map(row=>entry(good(catalog.label(row.tag,'syndicates',server)),row.nodes.length+' 个任务',{...windowOf(row),steps:array(row.nodes).map(n=>({title:good(n),subtitle:mission(catalog.plus.ExportRegions?.[n.key]?.missionType)})),iconToken:'STANDING'})),{layout:'mission',preview:2});
  add('events','新闻与公告','activity',rows('events').map(row=>entry(translate(row.messages?.[0]?.text ?? row.messages?.[0]?.message,row.community?'社区公告':'公告'),'',{icon:array(raw.Events).find(e=>(e._id?.$oid ?? e._id)===row.id)?.Icon,url:row.links?.[0]?.url ?? row.prop ?? row.liveUrl,...windowOf(row)})),{layout:'news',preview:3});
  add('goals','活动与行动','activity',rows('goals').filter(active).map(row=>entry(translate(row.descriptionKey,'限时行动'),row.node?good(row.node):'',{...windowOf(row),description:translate(row.tooltipKey),rewards:reward(row.reward),icon:row.icon,progress:row.healthPct!==null?clip(row.healthPct*100):null,stats:row.goal?['目标 '+number(row.goal),'当前 '+number(row.count)]:[]})),{layout:'tiles',preview:2});
  add('boosters','全服加成','activity',rows('globalUpgrades').filter(active).map(row=>entry(translate(row.nameKey,row.upgradeType),translate(row.descriptionKey),{...windowOf(row),stats:row.value!==null?['数值 '+row.value]:[],iconToken:'BOOSTER'})),{layout:'tiles',preview:2});
  const synth=modules.libraryInfo?.data?.lastCompletedTargetKey;
  add('synthesis','中枢与社交','activity',[
    ...(synth?[entry(catalog.item(synth).name,'中枢 Simaris 最近目标',{...catalog.item(synth),iconToken:'SIMARIS'})]:[]),
    ...rows('featuredGuilds').map(row=>entry(row.name,'精选氏族',{stats:row.tier!==null?['规模 '+row.tier]:[]})),
    ...rows('pvpChallengeInstances').filter(active).map(row=>entry(catalog.challenge(row.challengeKey).name,'武形秘仪',{description:catalog.challenge(row.challengeKey).description,...windowOf(row)}))
  ],{layout:'tiles',preview:3});
  const covered=new Set(Object.keys(RAW_FIELD_MODULES)), extraFields=Object.keys(raw).filter(key=>!covered.has(key));
  const visible=output.filter(module=>module.entries.length || ['fissures','sortie','archonHunt','alerts','voidTraders'].includes(module.id));
  return {server,kind:snapshot.kind,source:snapshot.source,sourceTime:new Date(sourceNow).toISOString(),fetchedAt:snapshot.fetchedAt,hash:snapshot.hash,
    stale:!networkFresh,refreshError:snapshot.refreshError ?? null,at:new Date(at).toISOString(),modules:visible,
    summary:{missions:fissures.length+rows('invasions').filter(r=>!r.completed).length,weekly:visible.filter(m=>m.group==='weekly').length,trade:visible.filter(m=>m.group==='trade').reduce((s,m)=>s+m.count,0)},
    diagnostics:{normalizers:Object.keys(modules).length,rawFields:Object.keys(raw).length,knownFields:covered.size,extraFields,errors,moduleStatus:Object.fromEntries(Object.entries(modules).map(([id,value])=>[id,value.status])),unprojectedModules:['persistentEnemies','projectPct','pvpActiveTournaments','pvpAlternativeModes','hubEvents','experimentRecommended','twitchPromos','skuSales','primeAccessAvailability','temporaryConfig'],
      warnings:[...catalog.warnings,...Object.entries(modules).flatMap(([id,m])=>(m.warnings??[]).map(w=>id+': '+w))],dictionaries:catalog.evidence,buildLabel:raw.BuildLabel,version:raw.Version}};
}
