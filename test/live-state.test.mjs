import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createWorldCatalog, loadWorldCatalog } from '../src/core/live-state/catalog.mjs';
import { scanLibrary, readLibraryFile } from '../src/core/library.mjs';
import { worldBountyRewards } from '../src/core/live-state/bounties.mjs';
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
 const view=buildWorldView(snapshot(r,'wg'),catalog(),{now:ms});const trader=view.modules.find(m=>m.id==='voidTraders').entries[0];assert.deepEqual(trader.items,[]);assert.equal(trader.subtitle,'国服专属节点');const bounty=view.modules.find(m=>m.id==='bounties').entries[0].items[0];assert.equal(bounty.title,'示例武器');assert.equal(bounty.rewardTables[0].pools[0].items[0].name,'示例武器');assert.equal(bounty.rewardTables[0].pools[0].items[0].quantity,2);assert.equal(bounty.rewardTables[0].pools[0].items[0].probability,0.25);
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
 assert.equal(entries[0].cardState.id,'challenge');assert.equal(entries[1].cardState.id,'upgrade');assert.equal(entries[2].cardState.id,'reward');assert.equal(entries[0].subtitle,'冬季');assert.equal(entries[0].terms[0].description,'击杀 300 名敌人');assert.equal(entries[1].terms[0].name,'毒气射击');assert.match(entries[1].terms[0].description,/25%/);assert.equal(entries[1].reference.localization[0].source,'wfcd-calendar-project-translation');assert.equal(entries[2].rewards[0].id,id);assert.deepEqual(r,original);
 // Official entities take precedence over maintained community translations.
 const official=createWorldCatalog({weeklyRules,official:[{uniqueName:'/Lotus/Upgrades/Calendar/AbilityStrength',name:'官方强化',description:'官方说明'}]});assert.equal(official.weekly.calendarEvent({type:'CET_UPGRADE',upgradeKey:'/Lotus/Upgrades/Calendar/AbilityStrength'}).name,'官方强化');
});

test('沉沦之地按类型区分同名键、保留全部光环配置；未知键不按叶名或前缀猜中文',async()=>{
 const weeklyRules=JSON.parse(await fs.readFile(new URL('../src/data/live-state/weekly-semantics.json',import.meta.url),'utf8'));
 const c=createWorldCatalog({weeklyRules,plus:{ExportResources:{'/Lotus/AuraOne':{name:'光环一',description:'第一条说明'},'/Lotus/AuraTwo':{name:'光环二',description:'第二条说明'},'/Lotus/Unrelated/FreezeInShoot':{name:'不相关物品'}}}});
 const r=raw(),ms=r.Time*1000;const row={Index:1,Type:'DT_EXTERMINATE',Challenge:'FreezeInShoot',Level:'/Lotus/Level',Specs:['/Lotus/EnemySpec'],Auras:['/Lotus/AuraOne','/Lotus/AuraTwo']};
 r.Descents=[{Activation:date(ms-1),Expiry:date(ms+1000),RandSeed:5,Challenges:[row,{...row,Index:2,Type:'DT_PROTOFRAME',Challenge:'Wisp'},{...row,Index:3,Type:'DT_RACE',Challenge:'NC_NewUnverified'}]}];
 const original=structuredClone(r),entries=buildWorldView(snapshot(r),c,{now:ms}).modules.find(m=>m.id==='descents').entries;
 assert.equal(entries[0].cardState.id,'mission');assert.equal(entries[1].cardState.id,'protoframe');assert.equal(entries[0].subtitle,'歼灭');assert.equal(entries[0].terms[0].name,'冰封之光');assert.equal(entries[0].terms[1].description,'第一条说明');assert.equal(entries[0].terms[2].description,'第二条说明');assert.equal(entries[0].reference.localization.specs.length,1);assert.equal(entries[1].terms[0].name,'玛丽的祝福');assert.equal(entries[2].terms[0].localized,false);assert.equal(entries[2].terms[0].name,'附加条件待补充');assert.equal(entries[2].reference.challengeKey,'NC_NewUnverified');assert.deepEqual(r,original);
 assert.equal(c.weekly.descent({type:'DT_EXTERMINATE',challengeKey:'Wisp'}).detail.localized,false);
});


test('赏金统一入口按地区筛选，保留不同任务奖励与当前服窗口',()=>{
 const r=raw(),ms=r.Time*1000;
 r.SyndicateMissions=['CetusSyndicate','SolarisSyndicate','EntratiSyndicate','ZarimanSyndicate','UnknownSyndicate'].map((Tag,index)=>({_id:{$oid:'bounty-'+index},Tag,Activation:date(ms-1),Expiry:date(ms+1000),Nodes:[],Jobs:[{jobType:id,rewards:'/Lotus/Rewards/Example',minEnemyLevel:5+index,maxEnemyLevel:10+index}]}));
 const original=structuredClone(r),v=buildWorldView(snapshot(r,'wg'),catalog(),{now:ms}),m=v.modules.find(m=>m.id==='bounties');
 assert.equal(m.title,'赏金任务');assert.equal(m.entries.length,5);assert.deepEqual(m.filters.slice(0,3),[['all','全部地区'],['CetusSyndicate','夜灵平原'],['SolarisSyndicate','奥布山谷']]);
 assert.equal(m.entries[0].chips[0],'开放世界赏金');assert.equal(m.entries[3].chips[0],'地区赏金');assert.equal(m.entries[4].chips[0],'其他赏金');
 assert.equal(m.entries[0].items[0].stats[0],'等级 5–10');assert.equal(m.entries[1].items[0].stats[0],'等级 6–11');assert.equal(m.entries[0].items[0].rewardTables[0].pools[0].items[0].probability,0.25);assert.deepEqual(r,original);
});

test('卡片状态按上游类型划分，混合、未知事件有独立兜底',async()=>{
 const {calendarCardState,descentCardState}=await import('../src/core/live-state/card-states.mjs');
 for(const [type,id] of [['CET_CHALLENGE','challenge'],['CET_REWARD','reward'],['CET_UPGRADE','upgrade'],['CET_NEW','other']])assert.equal(calendarCardState([{type}]).id,id);
 assert.equal(calendarCardState([{type:'CET_REWARD'},{type:'CET_UPGRADE'}]).id,'mixed');assert.equal(calendarCardState([]).id,'mixed');
 assert.equal(descentCardState('DT_BOSS',true).id,'boss');assert.equal(descentCardState('DT_PROTOFRAME',true).id,'protoframe');assert.equal(descentCardState('DT_EXTERMINATE',true).id,'mission');assert.equal(descentCardState('DT_NEW',false).id,'other');
});

test('赏金完整接入两个 Oracle 模块；17 档挑战和 15 个地区的任务保持独立奖励表／池',async()=>{
 const library=await scanLibrary(fileURLToPath(new URL('..',import.meta.url))),c=await loadWorldCatalog(library.files,id=>readLibraryFile(library.root,id));
 const r=JSON.parse(await fs.readFile(new URL('../src/data/live-state/de-sample.json',import.meta.url))),original=structuredClone(r);
 const view=buildWorldView({...snapshot(r),kind:'sample'},c),m=view.modules.find(m=>m.id==='bounties'),tasks=m.entries.flatMap(r=>r.items);
 assert.equal(m.entries.length,6);assert.equal(tasks.filter(t=>t.category==='current').length,23);assert.equal(tasks.filter(t=>t.category==='challenge').length,17);assert.equal(tasks.filter(t=>t.category==='location').length,45);
 assert.equal(new Set(tasks.filter(t=>t.category==='location').map(t=>t.reference.tag+':'+t.reference.location)).size,15);
 for(const t of tasks.filter(t=>t.category==='challenge')){assert.equal(t.rewardTables.length,2);assert.notEqual(t.rewardTables[0].key,t.rewardTables[1].key);assert.match(t.rewardTables[1].label,/钢铁/);assert.ok(t.reference.seed);}
 for(const t of tasks.filter(t=>t.category==='location')){assert.ok(!t.rewardTables);assert.ok(t.rewardTiers.length);assert.ok(t.rewardTiers.every(t=>t.tables.length===1&&t.status==='world-state'));}
 const tables=tasks.flatMap(t=>t.rewardTables??t.rewardTiers?.flatMap(t=>t.tables)??[]);
 assert.ok(tables.filter(t=>!t.label?.includes('钢铁')).every(t=>t.pools.length));assert.ok(tables.filter(t=>!t.pools.length).every(t=>t.label?.includes('钢铁')&&t.status==='missing'));assert.ok(tables.flatMap(t=>t.pools.flatMap(p=>p.items)).every(i=>/\p{Script=Han}/u.test(i.name)));
 assert.ok(tables.some(t=>t.pools.length>1));assert.ok(tables.flatMap(t=>t.pools.flatMap(p=>p.items)).some(i=>i.conversion?.field==='fusionPoints'&&i.quantity>i.itemCount));
 assert.ok(!view.diagnostics.warnings.some(w=>w.startsWith('Oracle')));assert.deepEqual(r,original);
 // Each location confirms its own exact table; no borrowing the plains rotation.
 const missing=structuredClone(r);missing.SyndicateMissions=missing.SyndicateMissions.filter(r=>r.Tag!=='SolarisSyndicate');
 const venus=buildWorldView({...snapshot(missing,'wg'),kind:'sample'},c).modules.find(m=>m.id==='bounties').entries.find(r=>r.kind==='SolarisSyndicate');
 assert.ok(venus.items.every(i=>i.category==='location'));assert.ok(venus.items.every(i=>i.rewardTiers.every(t=>t.status==='unconfirmed'&&t.tables.length===3)));
 const noSeed=structuredClone(r);noSeed.SyndicateMissions=noSeed.SyndicateMissions.filter(r=>r.Tag!=='HexSyndicate');
 const degraded=buildWorldView({...snapshot(noSeed),kind:'sample'},c);assert.ok(degraded.diagnostics.warnings.some(w=>w.includes('Oracle cycle')));assert.equal(degraded.modules.find(m=>m.id==='bounties').entries.flatMap(r=>r.items).filter(i=>i.category==='current').length,23);
 // A changed upstream algorithm must not silently run as a reviewed revision.
 const invalid=await loadWorldCatalog(library.files,async id=>id.endsWith('/bounty-cycle.pluto')?{bytes:Buffer.from('unreviewed revision')}:readLibraryFile(library.root,id));
 assert.equal(invalid.oracleData.cycle,undefined);assert.ok(invalid.oracleData.locations);assert.ok(invalid.warnings.some(w=>w.includes('源码已变化')));
});

test('赏金中文回退按完整物品字段，现金／内融核心换算，不归一化或合并不同奖励池',()=>{
 const recipe='/Lotus/Recipe',result='/Lotus/Product',credit='/Lotus/Credit',endo='/Lotus/Endo',relic='/Lotus/Relic';
 const c=createWorldCatalog({aliases:[{from:'/Lotus/StoreItems/',to:'/Lotus/',mode:'prefix'}],plus:{'dict.zh':{'/Name':'成品','/Desc':'中文说明','/Endo':'内融核心'},ExportResources:{[result]:{name:'/Name',description:'/Desc'}},ExportRecipes:{[recipe]:{resultType:result}},ExportCreditBundles:{[credit]:{credits:1000}},ExportFusionBundles:{[endo]:{name:'/Endo',fusionPoints:50}},ExportRelics:{[relic]:{era:'Lith',category:'K12',quality:'VPQ_PLATINUM'}},ExportRewards:{X:[[{type:'/Lotus/StoreItems/Recipe',itemCount:1,probability:0.5001},{type:credit,itemCount:2,probability:0.5001}],[{type:endo,itemCount:10,rarity:'RARE'},{type:relic,itemCount:1}]]}},official:[{uniqueName:result,name:'English name',description:'English description'}]});
 assert.equal(c.item(result).name,'成品');assert.equal(c.item(result).description,'中文说明');
 const table=worldBountyRewards(c).table('X');assert.equal(table.pools.length,2);assert.equal(table.pools[0].items[0].name,'成品 蓝图');assert.equal(table.pools[0].items[1].name,'现金');assert.equal(table.pools[0].items[1].quantity,2000);assert.equal(table.pools[1].items[0].quantity,500);assert.equal(table.pools[1].items[0].probability,null);assert.equal(table.pools[1].items[1].name,'古纪 K12 遗物（光辉）');assert.equal(table.pools[0].items.reduce((n,i)=>n+i.probability,0),1.0002);
 const missing=worldBountyRewards(c).table('/Missing');assert.equal(missing.status,'missing');assert.deepEqual(missing.pools,[]);
});

test('沉沦之地两轨各十个奖励节点，20层同种三倍、罗瑟掉落独立，不伪造本周选中',async()=>{
 const rules=JSON.parse(await fs.readFile(new URL('../src/data/live-state/descent-reward-rules.json',import.meta.url)));
 const tables=JSON.parse(await fs.readFile(new URL('../src/data/live-state/descent-reward-tables.json',import.meta.url)));
 const c=createWorldCatalog({descentRules:rules,descentTables:tables});
 const floors=Array.from({length:21},(_,i)=>({floor:i+1,...c.descentRewards(i+1,'de')}));
 const expected=[2,4,6,9,11,13,16,18,20,21];
 for(const mode of ['normal','steel'])assert.deepEqual(floors.filter(f=>f[mode]).map(f=>f.floor),expected);
 assert.deepEqual(floors.filter(f=>f.checkpoint).map(f=>f.floor),[7,14]);
 for(const row of floors)for(const mode of ['normal','steel'])if(row[mode])assert.equal(row[mode].selection,'candidate-pool');
 assert.equal(floors[19].normal.rewards.length,27);assert.ok(floors[19].normal.rewards.every(r=>r.quantity===3));assert.ok(floors[19].steel.rewards.every(r=>r.quantity===3));
 assert.ok(floors[5].normal.rewards.every(r=>r.quantity===1&&r.probability===undefined));
 assert.equal(floors[17].steel.rewards[0].quantity,25);assert.equal(floors[17].steel.rewards[0].probability,1);
 assert.equal(floors[1].steel.rewards[0].quantity,75);assert.equal(floors[1].steel.rewards[0].probability,.5);
 assert.equal(floors[1].normal.rewards[3].quantity,undefined); // conflicting zh/en announcement quantities
 assert.equal(floors[20].boss.rewards.length,8);assert.equal(floors[20].normal.key,'normalRare');assert.equal(floors[20].steel.key,'steelRare');
 assert.equal(c.descentRewards(2,'wg').verified,false);assert.equal(c.descentRewards(2,'wg').steel,null);
 assert.deepEqual(tables.unresolved,[]);assert.equal(Object.keys(tables.tables).length,8);
 for(const table of Object.values(tables.tables)){assert.match(table.source,/^https:\/\/www.warframe.com\/droptables#/);assert.ok(Math.abs(table.rewards.reduce((n,r)=>n+r.probability,0)-1)<.005);}
});

test('六个沉沦之地时间窗仅选当期21层，两难度共享排期而非误取未来周；蓝图按精确成品中文派生',async()=>{
 const sample=JSON.parse(await fs.readFile(new URL('../src/data/live-state/de-sample.json',import.meta.url)));
 const original=structuredClone(sample),view=buildWorldView({...snapshot(sample),kind:'sample'},catalog());
 const module=view.modules.find(m=>m.id==='descents');assert.equal(module.entries.length,21);assert.equal(module.layout,'descent-floors');assert.equal(module.groupCards,undefined);
 assert.deepEqual(module.entries.map(r=>r.reference.index),Array.from({length:21},(_,i)=>i+1));assert.deepEqual(sample,original);
 const c=createWorldCatalog({plus:{ExportRecipes:{'/Lotus/TestRecipe':{resultType:id}},ExportResources:{[id]:{name:'测试物品'}}}});
 assert.equal(c.item('/Lotus/TestRecipe').name,'测试物品 蓝图');assert.equal(c.item('/Lotus/TestRecipe').localized,true);
});
