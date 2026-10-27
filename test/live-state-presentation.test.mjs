import test from 'node:test';
import assert from 'node:assert/strict';
import {cycleTimeline,invasionProgress,traderPrices,salePrices,resurgenceNames,syndicateTasks,worldStatistics} from '../src/core/live-state/presentation.mjs';
import {createWorldCatalog} from '../src/core/live-state/catalog.mjs';
import {buildWorldView} from '../src/core/live-state/view.mjs';
import {normalizeCycles} from '../src/core/live-state/normalizers/cycles.mjs';
import {normalizeFlashSales} from '../src/core/live-state/normalizers/commerce-fields.mjs';
import { readFileSync } from 'node:fs';
import { voidStormRecords, mergeStormRecords } from '../src/core/void-storm-records.mjs';
const date=ms=>({$date:{$numberLong:String(ms)}});
test('六类周期的24小时阶段连续覆盖查询窗，首尾裁剪且保留跨日日期',()=>{
 const at=Date.parse('2026-10-24T23:58:00+08:00');
 for(const [id,state] of [['earth','day'],['cetus','day'],['cambion','fass'],['vallis','cold'],['zariman','corpus'],['duviri','fear']]){
  const timeline=cycleTimeline({id,state,activation:new Date(at-120000).toISOString()},at);
  assert.equal(Date.parse(timeline[0].startsAt),at);assert.equal(Date.parse(timeline.at(-1).endsAt),at+86400000);assert.ok(timeline[0].current);
  for(let n=1;n<timeline.length;n++)assert.equal(timeline[n].startsAt,timeline[n-1].endsAt);
  assert.ok(timeline.every(p=>Date.parse(p.endsAt)>Date.parse(p.startsAt)));
 }
 assert.deepEqual(cycleTimeline({id:'unknown'},at),[]);
});
test('货币依据价格字段；现金1和0不漏掉，缺少覆盖价格不虚构1现金',()=>{
 assert.deepEqual(traderPrices({primePrice:3,regularPrice:1},true),[{amount:3,currency:'御品阿耶'},{amount:1,currency:'阿耶精华'}]);
 assert.deepEqual(traderPrices({ducats:100,regularCredits:20000}),[{amount:100,currency:'杜卡德金币'},{amount:20000,currency:'现金'}]);
 assert.deepEqual(traderPrices({primePrice:100,regularPrice:20000}),[{amount:100,currency:'杜卡德金币'},{amount:20000,currency:'现金'}]);
 assert.deepEqual(traderPrices({primePrice:0,regularPrice:1,ducats:999,regularCredits:999}),[{amount:0,currency:'杜卡德金币'},{amount:1,currency:'现金'}]);
 assert.deepEqual(traderPrices({primePrice:null,regularPrice:null,ducats:100,regularCredits:20000}),[{amount:100,currency:'杜卡德金币'},{amount:20000,currency:'现金'}]);
 assert.deepEqual(traderPrices({}),[]);
 assert.deepEqual(salePrices({regularOverride:1}),[{amount:1,currency:'现金'}]);assert.deepEqual(salePrices({premiumOverride:0}),[{amount:0,currency:'白金'}]);assert.deepEqual(salePrices({}),[]);
 const raw={FlashSales:[{TypeName:'/Lotus/Test',StartDate:date(0),EndDate:date(1000),RegularOverride:1}]};assert.equal(normalizeFlashSales(raw,{server:'de'}).data[0].regularOverride,1);
});
test('重生从单体组合包去重提取，兼容多角色并剔除双重组合包',()=>{
 const items=[{id:'SinglePack',name:'Ivara Prime 组合包'},{id:'SinglePack2',name:'Protea Prime 组合包'},{id:'SinglePack3',name:'Ash Prime 组合包'},{id:'DualPack',name:'Ivara Prime 和 Protea Prime 双重组合包'},{id:'Other',name:'Ivara Prime 组合包'},{id:'Lex',name:'Lex Prime'}];
 assert.deepEqual(resurgenceNames(items),['Ivara Prime','Protea Prime','Ash Prime']);
});
test('集团1–5级对应连续三个任务，各等级互相重叠；入侵进度边界与Infested负计数',()=>{
 const steps=Array.from({length:7},(_,i)=>i+1);for(let rank=1;rank<=5;rank++)assert.deepEqual(syndicateTasks(steps,rank),[rank,rank+1,rank+2]);
 assert.equal(invasionProgress(0,100),50);assert.equal(invasionProgress(-100,100),0);assert.equal(invasionProgress(100,100),100);assert.equal(invasionProgress(-50,100,true),50);assert.equal(invasionProgress(-110,100,true),0);assert.equal(invasionProgress(0,0),null);
});
test('科研普通与精英风险按结构比较，裂缝按结束时间排序；默认隐藏特殊节点及商店精选',()=>{
 const ms=1792800000000,now=new Date(ms).toISOString(),end=date(ms+600000),start=date(ms-1000);
 const catalog=createWorldCatalog({plus:{ExportRegions:{A:{name:'节点A',systemName:'地球',missionType:'MT_EXTERMINATION'}},ExportMissionTypes:{MT_EXTERMINATION:{name:'歼灭'}},ExportRewards:{}}});
 const raw={Time:ms/1000,SyndicateMissions:[],Sorties:[],ActiveMissions:[{_id:'late',Activation:start,Expiry:end,Node:'A',MissionType:'MT_EXTERMINATION',Modifier:'VoidT1'},{_id:'soon',Activation:start,Expiry:date(ms+10000),Node:'A',MissionType:'MT_EXTERMINATION',Modifier:'VoidT4'}],Conquests:[{Activation:start,Expiry:end,Type:'CT_LAB',Variables:[],RandomSeed:1,Missions:[{faction:'FC_MITW',missionType:'MT_EXTERMINATION',difficulties:[{type:'CD_NORMAL',deviation:'X',risks:['A']},{type:'CD_HARD',deviation:'X',risks:['A','B']}]}]}]};
 const original=structuredClone(raw),view=buildWorldView({raw,server:'de',kind:'network',source:'test',fetchedAt:now},{...catalog},{now:ms});
 const fissures=view.modules.find(m=>m.id==='fissures');assert.equal(fissures.preview,3);assert.equal(fissures.noPagination,true);assert.equal(fissures.entries[0].tier,4);assert.equal(fissures.entries[0].planet,'地球');
 const terms=view.modules.find(m=>m.id==='conquests').entries[0].steps[0].terms;assert.deepEqual(terms.map(t=>t.mode),['common','common','elite']);assert.equal(terms[2].label,'精英追加风险');assert.ok(!view.modules.some(m=>['nodeOverrides','market'].includes(m.id)));assert.deepEqual(raw,original);
});
test('回廊以完整选项组识别轮次，各服独立；奖励图标解析到灵化之源而非原武器',()=>{
 const resource='/Lotus/Types/Items/MiscItems/IncarnonAdapters/Secondary/SicarusIncarnonUnlocker';
 const c=createWorldCatalog({circuitRules:{frames:[['F1','F2','F3'],['F4','F5','F6']],weapons:[['W1','W2','W3','W4','W5']]},plus:{'dict.en':{F1:'Hydroid',F2:'Mirage',F3:'Limbo',F4:'Ash',F5:'Frost',F6:'Nyx',W1:'Sicarus',W2:'Dera',W3:'Cestra',W4:'Okina',W5:'Sybaris'},ExportResources:{[resource]:{name:'暗杀者灵化之源',icon:'/Adapter.png'}}}});
 assert.equal(c.circuitRotation(['Limbo','Hydroid','Mirage']).index,1);assert.equal(c.circuitRotation(['Hydroid','Mirage','Ash']).matched,false);assert.equal(c.circuitRotation(['Ash','Frost','Nyx']).index,2);assert.equal(c.circuitChoice('Sicarus',true).id,resource);assert.equal(c.circuitChoice('Sicarus',true).icon,'/Adapter.png');
});

test('周期锚点选覆盖快照的窗口，不误用未来记录，重叠矛盾窗口拒绝推算',()=>{
 const at=Date.parse('2026-10-24T00:00:00Z'),active={Tag:'CetusSyndicate',Activation:date(at-1000),Expiry:date(at+600000)},future={Tag:'CetusSyndicate',Activation:date(at+600000),Expiry:date(at+9600000)};
 const raw={Time:at/1000,SyndicateMissions:[future,active]};
 const result=normalizeCycles(raw,{server:'de',language:'zh'});assert.ok(result.data.some(r=>r.id==='cetus'));
 const ambiguous=normalizeCycles({...raw,SyndicateMissions:[active,{...active,Expiry:date(at+900000)}]},{server:'de',language:'zh'});assert.ok(!ambiguous.data.some(r=>r.id==='cetus'));assert.ok(ambiguous.warnings.includes('CYCLE_SYNDICATE_AMBIGUOUS:CetusSyndicate'));
});

test('统计按完整任务和商品计数，不把地区、商人、科研模块当作条目',()=>{
 const modules=[{id:'fissures',entries:[{kind:'normal'},{kind:'normal'},{kind:'hard'},{kind:'storm'}]},{id:'bounties',entries:[{items:[1,2,3]},{items:[1,2]}]},{id:'conquests',entries:[{steps:[1,2,3]},{steps:[1,2,3]}]},{id:'calendar',entries:[{rewards:[1,2]},{terms:[1]},{rewards:[1]}]},{id:'voidTraders',entries:[{items:[1,2,3]}]},{id:'primeVaultTraders',entries:[{items:[1,2]}]},{id:'flashSales',entries:[1,2,3,4]}];
 const metrics=worldStatistics(modules).flatMap(g=>g.metrics),count=(id,filter)=>metrics.find(m=>m.id===id&&m.filter===filter).value;
 assert.equal(count('fissures','normal'),2);assert.equal(count('fissures','hard'),1);assert.equal(count('bounties'),5);assert.equal(count('conquests'),6);assert.equal(count('calendar'),2);assert.equal(count('voidTraders'),3);assert.equal(count('primeVaultTraders'),2);assert.equal(count('flashSales'),4);assert.equal(count('alerts'),0);assert.equal(worldStatistics().flatMap(g=>g.metrics).every(m=>m.value===0),true);
});

test('九重天未知任务类型不显示占位徽章，节点和纪元仍保留',()=>{
 const at=Date.parse('2026-10-24T00:00:00Z'),raw={Time:at/1000,ActiveMissions:[],Sorties:[],SyndicateMissions:[],VoidStorms:[{_id:{$oid:'storm'},Activation:date(at-1000),Expiry:date(at+60000),Node:'CrewBattle',ActiveMissionTier:1}]},catalog=createWorldCatalog({plus:{ExportRegions:{CrewBattle:{name:'克姆地带',systemName:'地球比邻星域'}}}}),view=buildWorldView({raw,server:'de',kind:'sample'},catalog,{now:at}),storm=view.modules.find(m=>m.id==='fissures').entries[0];
 assert.ok(storm);assert.equal(storm.kind,'storm');assert.equal(storm.missionType,'');assert.equal(storm.subtitle,'');assert.equal(storm.title,'克姆地带 · 地球比邻星域');assert.equal(storm.planet,'地球比邻星域');
});

test('九重天裂缝按实例提供任务类型，同一节点的静态类型不能覆盖实例',()=>{
 const at=Date.parse('2026-10-24T00:00:00Z'),base={Activation:date(at-1000),Expiry:date(at+60000),Node:'CrewBattle',ActiveMissionTier:1},catalog=createWorldCatalog({plus:{ExportRegions:{CrewBattle:{name:'节点',systemName:'地球比邻星域',missionType:'MT_DEFENSE'}},ExportMissionTypes:{MT_DEFENSE:{name:'防御'},MT_EXTERMINATION:{name:'歼灭'},MT_SURVIVAL:{name:'生存'}}}});
 const view=buildWorldView({raw:{Time:at/1000,VoidStorms:[{...base,_id:'a',MissionType:'MT_EXTERMINATION'},{...base,_id:'b',MissionType:'MT_SURVIVAL'},{...base,_id:'c'}]},server:'de',kind:'sample'},catalog,{now:at});
 const rows=view.modules.find(m=>m.id==='fissures').entries;assert.deepEqual(rows.map(r=>r.missionType),['歼灭','生存','']);assert.deepEqual(rows.map(r=>r.missionBasis),['instance','instance','unavailable']);
});

test('九重天使用专用 missionName 语言键，双服真实快照全部显示具体任务类型',()=>{
 const read=name=>JSON.parse(readFileSync(new URL('../世界状态上游/git/warframe-public-export-plus/'+name+'.json',import.meta.url)));
 const fallback=JSON.parse(readFileSync(new URL('../src/data/live-state/community-fallback.json',import.meta.url)));
 const catalog=createWorldCatalog({plus:{ExportRegions:read('ExportRegions'),ExportMissionTypes:read('ExportMissionTypes'),'dict.zh':read('dict.zh')},fallback});
 for(const server of ['de','wg']){
  const raw=JSON.parse(readFileSync(new URL('../src/data/live-state/'+server+'-sample.json',import.meta.url)));
  const rows=buildWorldView({raw,server,kind:'sample'},catalog).modules.find(m=>m.id==='fissures').entries.filter(r=>r.kind==='storm');
  assert.equal(rows.length,raw.VoidStorms.length);assert.ok(rows.every(r=>r.missionType&&r.missionBasis==='node-mission-name'));
  const records=voidStormRecords(raw,catalog,server);assert.equal(records.length,rows.length);
  assert.ok(records.every(r=>r.missionType&&Object.keys(r).length===10&&r.节点&&r.遗物等级));
  assert.ok(records.every(r=>r.快照日期==='2026-10-23'&&r.任务===r.missionType));
  assert.deepEqual(mergeStormRecords(records,records),mergeStormRecords([],records));
  const volatile=records.find(r=>r.node==='CrewBattleNode511');if(volatile){assert.equal(volatile.missionType,'爆发');assert.equal(volatile.节点,'卫标星环（金星）');assert.equal(volatile.遗物等级,'古纪');}
  const midnight=voidStormRecords(raw,catalog,server,{observedAt:'2026-10-25T16:00:00Z'});assert.ok(midnight.every(r=>r.快照日期==='2026-10-26'));
  assert.deepEqual(mergeStormRecords(records,midnight).map(r=>r.快照日期),records.map(r=>r.快照日期));
 }
});

test('九重天实例类型优先，通用枚举可使用专用名称，缺字典不暴露语言键',()=>{
 const at=Date.parse('2026-10-24T00:00:00Z'),key='/Lotus/Language/Missions/MissionName_RailjackVolatile';
 const catalog=createWorldCatalog({plus:{ExportRegions:{CrewBattle:{missionType:'MT_RAILJACK',missionName:key}},'dict.zh':{[key]:'爆发'},ExportMissionTypes:{MT_SURVIVAL:{name:'生存'}}}});
 const row={_id:'a',Activation:date(at),Expiry:date(at+5400000),Node:'CrewBattle',ActiveMissionTier:'VoidT1'},snapshot=rows=>({Time:at/1000,VoidStorms:rows});
 for(const [extra,expected] of [[{},'爆发'],[{MissionType:'MT_RAILJACK'},'爆发'],[{MissionType:'MT_SURVIVAL'},'生存'],[{MissionType:'MT_NEW'},null],[{Node:'missing'},null]])assert.equal(voidStormRecords(snapshot([{...row,...extra}]),catalog,'de')[0].missionType,expected);
 const missing=createWorldCatalog({plus:{ExportRegions:catalog.plus.ExportRegions}});assert.equal(voidStormRecords(snapshot([row]),missing,'de')[0].missionType,null);
 assert.throws(()=>voidStormRecords({},catalog,'de'),/缺少/);assert.throws(()=>voidStormRecords({VoidStorms:[row]},catalog,'de'),/快照时间/);assert.throws(()=>voidStormRecords(snapshot([{...row,Expiry:null}]),catalog,'de'),/无效/);
 const original=voidStormRecords(snapshot([row]),catalog,'de');assert.equal(mergeStormRecords(original,[{...original[0],missionType:'生存'}]).length,1);assert.equal(mergeStormRecords(original,[{...original[0],missionType:'生存'}])[0].missionType,'生存');
});


test('arbitration statistics distinguish unknown, partial and fully rated days',()=>{
 const count=quality=>worldStatistics([{id:'arbitration',quality}]).flatMap(g=>g.metrics).find(m=>m.id==='arbitration').value;
 assert.equal(count({covered:true,unknown:24,high:0}),'—');assert.equal(count({covered:true,unknown:1,high:2}),'2+');assert.equal(count({covered:true,unknown:0,high:2}),2);assert.equal(count({covered:true,unknown:0,high:0}),0);assert.equal(count({covered:false,unknown:0,high:0}),'—');
});
