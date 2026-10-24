const numeric=v=>Number.isFinite(v);
const labels={ALARMING:'引起警戒',Alarming:'引起警戒',SILENT:'无声',Silent:'无声',Projectile:'投射物',HitScan:'即时命中',Hitscan:'即时命中',AoE:'范围伤害',Physical:'物理命中',BURST:'点射',Burst:'点射',AUTO:'全自动',Auto:'全自动',SEMI:'半自动',Semi:'半自动',CHARGE:'蓄力',Charge:'蓄力'};
export const equipmentLabel=v=>labels[v]??v;
export function equipmentFacts(item){
 const a=item.attributes??{},result=[];
 const add=(key,label,value,unit='')=>{if(value!==undefined&&value!==null&&value!=='')result.push({key,label,value,unit});};
 if(item.kind==='weapon'){add('type','武器类型',a.type);add('category','武器槽位',a.category);add('trigger','扳机类型',equipmentLabel(a.trigger));}
 for(const [key,label,unit]of [['accuracy','精准度',''],['multishot','多重射击',''],['ammo','弹药上限','发'],['ammoMax','弹药上限','发'],['ammoPickup','弹药拾取量','发'],['ammoCost','弹药消耗','发'],['blockingAngle','格挡角度','°'],['comboDuration','连击持续时间','秒'],['followThrough','跟进',''],['range','攻击范围','米']])if(numeric(a[key]))add(key,label,a[key],unit);
 if(a.ammoType)add('ammoType','弹药类型',a.ammoType);
 if(a.noise)add('noise','噪音等级',equipmentLabel(a.noise));
 if(item.kind==='weapon'&&a.category==='Melee')for(const [key,label,unit]of [['slamAttack','震地攻击','点'],['slamRadialDamage','震地范围伤害','点'],['slamRadius','震地半径','米'],['slideAttack','滑行攻击','点'],['heavyAttackDamage','重击伤害','点'],['heavySlamAttack','重击震地伤害','点'],['heavySlamRadialDamage','重击震地范围伤害','点'],['heavySlamRadius','重击震地半径','米'],['windUp','重击准备时间','秒']])if(numeric(a[key]))add(key,label,a[key],unit);
 return result;
}
export function equipmentPolarities(item){const a=item.attributes??{};return [
 {label:'常规槽',values:Array.isArray(a.polarities)?a.polarities:[]},
 {label:'特殊功能槽',values:a.exilusPolarity?[a.exilusPolarity]:[]},
 {label:'光环槽',values:a.aura?[a.aura]:[]},
 {label:'架势槽',values:a.stancePolarity?[a.stancePolarity]:[]}
 ].filter(g=>g.values.length);}
export function equipmentTrade(item,related){
 if(['enemy','region','ability','mod-set'].includes(item.kind))return null;
 const own=item.tradable===true?'可交易':item.tradable===false?'不可交易':null;
 if(!['weapon','warframe','companion'].includes(item.kind))return own;
 const tradable=related.filter(i=>i.tradable===true),blueprints=tradable.some(i=>i.kind==='blueprint'),parts=tradable.some(i=>i.kind!=='blueprint'&&i.attributes?.category==='Components');
 const suffix=parts&&blueprints?'部件及蓝图可交易':blueprints?'蓝图可交易':parts?'部件可交易':null;
 if(suffix&&item.tradable!==true)return suffix+(item.tradable===false?'；成品不参与交易':'');
 return [own?'成品'+own:null,suffix].filter(Boolean).join('；')||null;
}
export function attackFacts(attack,item){
 const a=item.attributes??{},rows=[];const add=(key,label,value,unit='')=>{if(numeric(value)||typeof value==='string'&&value)rows.push({key,label,value,unit});};
 const total=Object.entries(attack.damage??{}).filter(([k,v])=>k!=='total'&&numeric(v)).reduce((n,[,v])=>n+v,0);
 if(total)add('total','总伤害',total,'点');
 for(const [key,label,unit]of [['multishot','多重射击',''],['speed',item.kind==='weapon'&&a.category==='Melee'?'攻击速度':'射速',a.category==='Melee'?'次/秒':'发/秒'],['crit_chance','暴击几率','%'],['crit_mult','暴击倍率','×'],['status_chance','触发几率','%'],['shot_speed','投射物速度','米/秒'],['punch_through','穿透','米'],['range','射程','米'],['radius','爆炸半径','米'],['charge_time','蓄力时间','秒'],['ammo','弹药消耗','发'],['pellets','弹丸数量',''],['combo','连击倍率','×']])add(key,label,attack[key],unit);
 if(!numeric(attack.shot_speed))add('flight','投射物速度',attack.flight,'米/秒');
 for(const [key,label]of [['slide','滑行伤害'],['slam','震地伤害']])add(key,label,attack[key],'点');
 if(!numeric(attack.multishot)&&numeric(a.multishot)&&a.behaviours?.length===1)add('multishot','多重射击',a.multishot);
 add('shot_type','伤害判定类型',equipmentLabel(attack.shot_type));
 if(numeric(attack.falloff?.start)&&numeric(attack.falloff?.end)){add('falloff','伤害衰减',attack.falloff.start+'—'+attack.falloff.end+' 米');if(numeric(attack.falloff.reduction))add('falloffRemaining','最远距离保留伤害',(1-attack.falloff.reduction)*100,'%');}
 // A single firing state applies to both projectile impact and explosion.
 // Multiple states are not guessed onto an unrelated attack mode.
 if(a.behaviours?.length===1){const b=a.behaviours[0];add('burstCount','点射连发',b.burst?.count,'发');add('burstDelay','点射间隔',b.burst?.delay,'秒');if(numeric(b.burst?.count)&&total)add('burstDamage','单次点射总伤害',total*b.burst.count,'点');}
 if(a.noise)add('noise','噪音等级',equipmentLabel(a.noise));
 return rows;
}
