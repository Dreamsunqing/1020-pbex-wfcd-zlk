import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createWorldCatalog } from '../src/core/live-state/catalog.mjs';
import { LiveStateStore, validateWorldState } from '../src/core/live-state/service.mjs';
import { buildWorldView } from '../src/core/live-state/view.mjs';
const id='/Lotus/Weapons/Example',lang='/Lotus/Language/Example',key='/Lotus/Challenges/Nested';
const catalog=()=>createWorldCatalog({plus:{'dict.zh':{[lang]:'示例武器',[lang+'Desc']:'造成 <DT_ELECTRICITY> 伤害。',[lang+'Challenge']:'命中 |COUNT| 次。'},'dict.en':{[lang]:'Example'},ExportWeapons:{[id]:{name:lang,description:lang+'Desc',icon:'/Example.png'}},ExportNightwave:{challenges:{[key]:{name:'挑战名称',description:lang+'Challenge',required:15,standing:1000}}},ExportRegions:{SolNode1:{name:lang}},ExportRewards:{'/Lotus/Rewards/Example':[[{type:id,itemCount:2,probability:0.25}]]}},wg:{nodes:{SolNode1:'国服专属节点'}},aliases:[{from:'/Lotus/StoreItems/',to:'/Lotus/',mode:'prefix'}]});
const raw=(time=1700000000)=>({Time:time,ActiveMissions:[],SyndicateMissions:[],Sorties:[]});
const date=ms=>({$date:{$numberLong:String(ms)}});
const snapshot=(r,server='de')=>({raw:r,kind:'network',server,source:'fixture',hash:'test',fetchedAt:new Date(r.Time*1000).toISOString()});
const fixture=async t=>{const dir=await fs.mkdtemp(path.join(os.tmpdir(),'wb-live-test-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));return dir;};
test('字段字典关联、商店别名、嵌套挑战计数与文本图标保留',()=>{
 const c=catalog();assert.equal(c.item('/Lotus/StoreItems/Weapons/Example').name,'示例武器');assert.equal(c.choice('Example').id,id);assert.equal(c.item(id).description,'造成 <DT_ELECTRICITY> 伤害。');assert.equal(c.challenge(key).description,'命中 15 次。');assert.equal(c.label('SolNode1','nodes','wg').name,'国服专属节点');assert.equal(c.label('SolNode1','nodes','de').name,'示例武器');assert.equal(c.item('/Lotus/Missing/Item').name,'Item');assert.equal(c.text('/Lotus/Missing'),'');
});
test('官方中文覆盖时保留英文回廊关联；重名不猜测',()=>{
 const c=createWorldCatalog({plus:{'dict.en':{[lang]:'Example'},ExportWeapons:{[id]:{name:lang}}},official:[{uniqueName:id,name:'示例'}]});assert.equal(c.choice('Example').name,'示例');
 const ambiguous=createWorldCatalog({plus:{ExportWeapons:{'/Lotus/One':{name:'Example'},'/Lotus/Two':{name:'Example'}}}});assert.equal(ambiguous.choice('Example').id,null);
});
test('网络快照双服隔离、并发只下载一次；失败不覆盖缓存',async t=>{
 const dir=await fixture(t);let calls=0,fail=false,release;
 const store=new LiveStateStore(dir,{request:async url=>{calls++;if(fail)throw new Error('测试断网');await new Promise(r=>release=r);return JSON.stringify({...raw(),serverEvidence:url,VendorAddition:{nested:[1,2]}});}});
 const a=store.refresh('de'),b=store.refresh('de');await new Promise(r=>setTimeout(r,15));assert.equal(calls,1);release();const [first,second]=await Promise.all([a,b]);assert.equal(first.hash,second.hash);assert.deepEqual(first.raw.VendorAddition,{nested:[1,2]});assert.equal(await store.cached('wg'),null);fail=true;const fallback=await store.refresh('de');assert.equal(fallback.hash,first.hash);assert.equal(fallback.refreshError,'测试断网');assert.equal((await store.cached('de')).refreshError,undefined);
});
test('拒绝上游时间倒退、损坏缓存回退样本、导入校验不改变有效数据',async t=>{
 const dir=await fixture(t);let time=1700000001;const store=new LiveStateStore(dir,{request:async()=>JSON.stringify(raw(time))});const first=await store.refresh('wg');time--;const old=await store.refresh('wg');assert.equal(old.hash,first.hash);assert.match(old.refreshError,/早于/);const invalid=path.join(dir,'bad.json');await fs.writeFile(invalid,'{}');await assert.rejects(()=>store.import('wg',invalid));assert.equal((await store.cached('wg')).hash,first.hash);await fs.writeFile(store.file('wg'),'{bad');assert.equal((await store.current('wg')).kind,'sample');await assert.rejects(()=>store.current('../de'));
});
test('导入锁与刷新共用单飞状态，保存原始 JSON 不丢字段',async t=>{
 const dir=await fixture(t),store=new LiveStateStore(dir);const file=path.join(dir,'import.json'),r={...raw(),Extra:{deep:{value:'不改动'}}};await fs.writeFile(file,JSON.stringify(r));const importing=store.import('de',file);const refreshing=store.refresh('de');const [a,b]=await Promise.all([importing,refreshing]);assert.equal(a.kind,'import');assert.equal(b.hash,a.hash);assert.deepEqual((await store.current('de')).raw,r);
});
test('校验拒绝数组、无服务器时间和缺少世界状态字段',()=>{
 for(const input of ['[]','{}','{"Time":1}','{"Time":"1","Sorties":[]}'])assert.throws(()=>validateWorldState(input));assert.equal(validateWorldState('\uFEFF'+JSON.stringify(raw())).Time,1700000000);
});
test('未来商人不借用旧商品，赏金奖励表、概率和节点来自当前服',()=>{
 const r=raw(),ms=r.Time*1000;r.VoidTraders=[{_id:{$oid:'trader'},Activation:date(ms+60000),Expiry:date(ms+120000),Node:'SolNode1',Manifest:[{ItemType:id,Ducats:100}]}];r.SyndicateMissions=[{_id:{$oid:'syndicate'},Activation:date(ms-1000),Expiry:date(ms+60000),Tag:'Example',Nodes:[],Jobs:[{jobType:id,rewards:'/Lotus/Rewards/Example',minEnemyLevel:5,maxEnemyLevel:10}]}];
 const view=buildWorldView(snapshot(r,'wg'),catalog(),{now:ms});const trader=view.modules.find(m=>m.id==='voidTraders').entries[0];assert.deepEqual(trader.items,[]);assert.equal(trader.subtitle,'国服专属节点');const bounty=view.modules.find(m=>m.id==='bounties').entries[0].items[0];assert.equal(bounty.title,'示例武器');assert.equal(bounty.rewards[0].name,'示例武器');assert.equal(bounty.rewards[0].quantity,2);assert.equal(bounty.rewards[0].probability,0.25);
});
test('旧快照保留捕获时有效项目，缺失/新增字段不会导致整个页面失败',()=>{
 const r=raw();r.ActiveMissions=[{_id:{$oid:'f'},Activation:date(r.Time*1000-60000),Expiry:date(r.Time*1000+60000),Node:'SolNode1',MissionType:'MT_EXTERMINATION',Modifier:'VoidT1',Hard:false}];r.FutureFeature={info:'retained'};
 const view=buildWorldView(snapshot(r),catalog(),{now:r.Time*1000+86400000});assert.equal(view.stale,true);assert.ok(view.diagnostics.extraFields.includes('FutureFeature'));assert.equal(view.modules.find(m=>m.id==='fissures').count,1);assert.deepEqual(r.FutureFeature,{info:'retained'});
});

test('多层结构含空记录或错误字段时，其他模块和原始数据仍可用',()=>{
 const r=raw();r.Conquests=[{Activation:date(r.Time*1000-1000),Expiry:date(r.Time*1000+60000),Type:'CT_LAB',Missions:[null],Variables:[],RandomSeed:1}];r.InGameMarket={LandingPage:{Categories:[null]}};r.ActiveMissions='invalid';const c=catalog();const result=buildWorldView(snapshot(r),c,{now:r.Time*1000});assert.ok(result.modules.find(m=>m.id==='cycles'));assert.ok(result.diagnostics.errors.includes('fissures'));assert.equal(r.ActiveMissions,'invalid');assert.equal(createWorldCatalog({plus:{ExportWeapons:{[id]:{name:123}}}}).item(id).name,'Example');
});

test('日历依事件类型关联挑战、强化和奖励；中文保留计数、来源且不修改原始事件',async()=>{
 const weeklyRules=JSON.parse(await fs.readFile(new URL('../src/data/live-state/weekly-semantics.json',import.meta.url),'utf8'));
 const c=createWorldCatalog({weeklyRules,plus:{'dict.zh':{'/Lotus/Language/TestName':'近战挑战','/Lotus/Language/TestDesc':'击杀 |COUNT| 名敌人'},ExportChallenges:{[key]:{name:'/Lotus/Language/TestName',description:'/Lotus/Language/TestDesc',requiredCount:300}}}});
 const r=raw(),ms=r.Time*1000;r.KnownCalendarSeasons=[{Activation:date(ms-1),Expiry:date(ms+1000),Season:'CST_WINTER',YearIteration:24,Version:19,UpgradeAvaliabilityRequirements:[],Days:[{day:3,events:[{type:'CET_CHALLENGE',challenge:key}]},{day:20,events:[{type:'CET_UPGRADE',upgrade:'/Lotus/Upgrades/Calendar/GasChanceToPrimaryAndSecondary'}]},{day:21,events:[{type:'CET_REWARD',reward:id}]}]}];
 const original=structuredClone(r),entries=buildWorldView(snapshot(r),c,{now:ms}).modules.find(m=>m.id==='calendar').entries;
 assert.equal(entries[0].subtitle,'冬季');assert.equal(entries[0].terms[0].description,'击杀 300 名敌人');assert.equal(entries[1].terms[0].name,'毒气射击');assert.match(entries[1].terms[0].description,/25%/);assert.equal(entries[1].reference.localization[0].source,'wfcd-calendar-project-translation');assert.equal(entries[2].rewards[0].id,id);assert.deepEqual(r,original);
 // Official entities take precedence over maintained community translations.
 const official=createWorldCatalog({weeklyRules,official:[{uniqueName:'/Lotus/Upgrades/Calendar/AbilityStrength',name:'官方强化',description:'官方说明'}]});assert.equal(official.weekly.calendarEvent({type:'CET_UPGRADE',upgradeKey:'/Lotus/Upgrades/Calendar/AbilityStrength'}).name,'官方强化');
});

test('沉沦之地按类型区分同名键、保留全部光环配置；未知键不按叶名或前缀猜中文',async()=>{
 const weeklyRules=JSON.parse(await fs.readFile(new URL('../src/data/live-state/weekly-semantics.json',import.meta.url),'utf8'));
 const c=createWorldCatalog({weeklyRules,plus:{ExportResources:{'/Lotus/AuraOne':{name:'光环一',description:'第一条说明'},'/Lotus/AuraTwo':{name:'光环二',description:'第二条说明'},'/Lotus/Unrelated/FreezeInShoot':{name:'不相关物品'}}}});
 const r=raw(),ms=r.Time*1000;const row={Index:1,Type:'DT_EXTERMINATE',Challenge:'FreezeInShoot',Level:'/Lotus/Level',Specs:['/Lotus/EnemySpec'],Auras:['/Lotus/AuraOne','/Lotus/AuraTwo']};
 r.Descents=[{Activation:date(ms-1),Expiry:date(ms+1000),RandSeed:5,Challenges:[row,{...row,Index:2,Type:'DT_PROTOFRAME',Challenge:'Wisp'},{...row,Index:3,Type:'DT_RACE',Challenge:'NC_NewUnverified'}]}];
 const original=structuredClone(r),entries=buildWorldView(snapshot(r),c,{now:ms}).modules.find(m=>m.id==='descents').entries;
 assert.equal(entries[0].subtitle,'歼灭');assert.equal(entries[0].terms[0].name,'冰封之光');assert.equal(entries[0].terms[1].description,'第一条说明');assert.equal(entries[0].terms[2].description,'第二条说明');assert.equal(entries[0].reference.localization.specs.length,1);assert.equal(entries[1].terms[0].name,'玛丽的祝福');assert.equal(entries[2].terms[0].localized,false);assert.equal(entries[2].terms[0].name,'附加条件待补充');assert.equal(entries[2].reference.challengeKey,'NC_NewUnverified');assert.deepEqual(r,original);
 assert.equal(c.weekly.descent({type:'DT_EXTERMINATE',challengeKey:'Wisp'}).detail.localized,false);
});
