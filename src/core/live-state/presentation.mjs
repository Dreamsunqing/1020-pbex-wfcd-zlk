// Presentation projections retain source identity; they never rewrite upstream data.
const minute=60000;
const phases={earth:[['day','白昼',240],['night','夜晚',240]],cetus:[['day','白昼',100],['night','夜晚',50]],cambion:[['fass','Fass',100],['vome','Vome',50]],vallis:[['warm','温暖',400/60],['cold','寒冷',1200/60]],zariman:[['grineer','Grineer',150],['corpus','Corpus',150]],duviri:[['sorrow','悲伤',120],['fear','恐惧',120],['joy','喜悦',120],['anger','愤怒',120],['envy','嫉妒',120]]};
export function cycleTimeline(row,at,hours=24){
  const pattern=phases[row.id],end=at+hours*3600000;
  let index=pattern?.findIndex(p=>p[0]===row.state),start=Date.parse(row.activation);
  if(!pattern||index<0||!Number.isFinite(start)||!Number.isFinite(at)||hours<=0||hours>48)return [];
  const period=pattern.reduce((sum,p)=>sum+p[2]*minute,0);
  start+=Math.floor((at-start)/period)*period;
  const result=[];
  for(let n=0;start<end&&n<500;n++){
    const [state,name,duration]=pattern[index],finish=start+duration*minute;
    if(finish>at)result.push({state,name,startsAt:new Date(Math.max(start,at)).toISOString(),endsAt:new Date(Math.min(finish,end)).toISOString(),current:start<=at&&at<finish});
    start=finish;index=(index+1)%pattern.length;
  }
  return result;
}
export const factionTone=key=>({FC_CORPUS:'corpus',FC_GRINEER:'grineer',FC_INFESTATION:'infested',FC_INFESTED:'infested'})[key]??'other';
export function invasionProgress(count,goal,infested=false){
  if(!Number.isFinite(count)||!Number.isFinite(goal)||goal<=0)return null;
  return Math.max(0,Math.min(100,infested?100*(1+count/goal):50+50*count/goal));
}
export function traderPrices(row,prime=false){
  const result=[];
  const add=(v,currency)=>{if(Number.isFinite(v)&&v>=0)result.push({amount:v,currency});};
  if(prime){add(row.primePrice,'御品阿耶');add(row.regularPrice,'阿耶精华');}
  // DE's two traders share field names, not currencies. Explicit legacy aliases
  // remain fallbacks; never let them replace a valid official value (including 0).
  else{add(Number.isFinite(row.primePrice)?row.primePrice:row.ducats,'杜卡德金币');add(Number.isFinite(row.regularPrice)?row.regularPrice:row.regularCredits,'现金');}
  return result;
}
export function salePrices(row){
  if(Number.isFinite(row.regularOverride))return [{amount:row.regularOverride,currency:'现金'}];
  if(Number.isFinite(row.premiumOverride))return [{amount:row.premiumOverride,currency:'白金'}];
  // No override is not a price of 1: the base store price is absent from this API.
  return [];
}
export function resurgenceNames(items){
  return [...new Set(items.filter(i=>!/(?:双重|双人|DualPack|Dual Pack)/i.test(i.id+' '+i.name)&&/(?:SinglePack|Prime\s*(?:组合包|礼包|Pack))/i.test(i.id+' '+i.name)).map(i=>i.name.replace(/\s*(?:组合包|礼包|Pack).*$/i,'').trim()).filter(Boolean))];
}
// Seven public nodes form five overlapping windows: rank r sees nodes r..r+2.
// Source: DE, Specters of the Rail patch notes. No personal rank is exposed publicly.
export function syndicateTasks(steps,rank=5){
  const level=Math.max(1,Math.min(5,Math.trunc(Number(rank)||1)));
  return steps.slice(level-1,level+2);
}

// Counts use complete projected entries, independently of preview limits or UI filters.
export function worldStatistics(modules=[]){
  const rows=id=>modules.find(m=>m.id===id)?.entries??[];
  const metric=(id,label,value,unit='项',filter)=>({id,label,value,unit,filter});
  return [
    {label:'任务',metrics:[...[["normal","始源裂缝"],["hard","钢铁裂缝"],["storm","九重天"]].map(([kind,label])=>metric('fissures',label,rows('fissures').filter(r=>r.kind===kind).length,'个',kind)),metric('alerts','警报',rows('alerts').length),metric('invasions','入侵',rows('invasions').length),metric('bounties','赏金',rows('bounties').reduce((n,r)=>n+(r.items?.length??0),0))]},
    {label:'周常',metrics:[metric('nightwave','电波挑战',rows('nightwave').length),metric('conquests','科研任务',rows('conquests').reduce((n,r)=>n+(r.steps?.length??0),0)),metric('calendar','日历奖励日',rows('calendar').filter(r=>r.rewards?.length).length,'天'),metric('descents','沉沦之地',rows('descents').length,'层')]},
    {label:'商店',metrics:[...[["voidTraders","虚空商人"],["primeVaultTraders","Prime 重生"]].map(([id,label])=>metric(id,label,rows(id).reduce((n,r)=>n+(r.items?.length??0),0),'件')),metric('flashSales','限时商品',rows('flashSales').length,'件'),metric('dailyDeals','每日特惠',rows('dailyDeals').length,'件')]}
  ];
}

export function fleetProgress(percentages=[]){
 return [['fomorian','巨人战舰','G · Grineer','grineer'],['razorback','利刃豺狼战舰','C · Corpus','corpus']].map(([id,title,subtitle,faction],index)=>({id,title,subtitle,faction,progress:Number.isFinite(percentages[index])?Math.max(0,Math.min(100,percentages[index])):null,reference:{field:'ProjectPct',index,value:percentages[index]??null}}));
}
const boosterKinds={
 GAMEPLAY_MONEY_REWARD_AMOUNT:{kind:'credits',name:'现金',effect:'任务现金奖励',iconToken:'CREDITS'},
 GAMEPLAY_MONEY_PICKUP_AMOUNT:{kind:'credits',name:'现金',effect:'现金拾取',iconToken:'CREDITS'},
 GAMEPLAY_PICKUP_AMOUNT:{kind:'resources',name:'资源',effect:'资源获取数量',iconToken:'BOOSTER'},
 GAMEPLAY_KILL_XP_AMOUNT:{kind:'affinity',name:'经验',effect:'任务击杀经验',iconToken:'BOOSTER'}
};
export function worldBoosters(upgrades,at,{translate=(_,fallback)=>fallback,node=key=>key}={}){
 const available=Array.isArray(upgrades),result=[],globalKinds=new Set();
 for(const row of upgrades??[]){
  const start=Date.parse(row.activation),end=Date.parse(row.expiry);if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start||end<=at)continue;
  const known=boosterKinds[row.upgradeType],nodes=(row.nodes??[]).filter(n=>typeof n==='string'&&n),scope=row.scopeKnown===false?'unknown':nodes.length?'nodes':'global',future=start>at;
  if(known&&scope==='global')globalKinds.add(known.kind);
  const multiply=row.operationType==='MULTIPLY'&&Number.isFinite(row.value)&&row.value>0;
  const title=known?known.name+(multiply&&row.value===2?'双倍':'加成'):translate(row.nameKey,row.upgradeType??'其他加成');
  result.push({id:row.id,title,subtitle:known?.effect??translate(row.descriptionKey,''),kind:known?.kind??'other',scope,status:future?'upcoming':'active',startsAt:row.activation,endsAt:row.expiry,iconToken:known?.iconToken??'BOOSTER',
   chips:[scope==='nodes'?'节点限定':scope==='unknown'?'范围待确认':'全星系',future?'即将开始':'生效中',...nodes.map(node)],
   stats:[multiply?row.value+'×':Number.isFinite(row.value)?(row.operationType??'运算待确认')+' '+row.value:'数值未提供'],description:multiply&&known?(future?'生效后，':'')+'搭配同类个人加成 2× → '+(row.value*2)+'×':'' ,reference:{upgradeType:row.upgradeType,operationType:row.operationType,value:row.value,nodes:row.nodes,scopeKnown:row.scopeKnown}});
 }
 for(const [kind,title] of [['credits','现金'],['resources','资源'],['affinity','经验']])if(!globalKinds.has(kind))result.push({id:kind+'-inactive',title:title+'双倍',subtitle:available?'当前未开启全星系加成':'当前快照未提供加成数据',kind,scope:'global',status:available?'inactive':'unavailable'});
 return result.sort((a,b)=>({active:0,upcoming:1,inactive:2,unavailable:3})[a.status]-({active:0,upcoming:1,inactive:2,unavailable:3})[b.status]);
}
