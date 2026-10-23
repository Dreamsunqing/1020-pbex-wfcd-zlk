import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {fleetProgress,worldBoosters} from '../src/core/live-state/presentation.mjs';
import {normalizeGlobalUpgrades} from '../src/core/live-state/normalizers/gameplay-fields.mjs';
import {buildWorldView} from '../src/core/live-state/view.mjs';
import {createWorldCatalog} from '../src/core/live-state/catalog.mjs';
const at=Date.parse('2026-10-24T00:00:00Z'),date=ms=>({$date:{$numberLong:String(ms)}});
const upgrade=(type,extra={})=>({_id:{$oid:type},Activation:date(at-1000),ExpiryDate:date(at+60000),UpgradeType:type,OperationType:'MULTIPLY',Value:2,...extra});
const decoded=(rows,server='de')=>normalizeGlobalUpgrades({GlobalUpgrades:rows},{server}).data;
test('G/C舰队按原数组索引直接读取百分比，0不丢失；边界截断，缺失不伪装0，第三项未知不展示',()=>{
 assert.deepEqual(fleetProgress([0,21.894,55]).map(r=>r.progress),[0,21.894]);assert.deepEqual(fleetProgress([-2,103]).map(r=>r.progress),[0,100]);assert.deepEqual(fleetProgress([null,0]).map(r=>r.progress),[null,0]);assert.deepEqual(fleetProgress().map(r=>r.progress),[null,null]);
 for(const server of ['de','wg']){const raw={Time:at/1000,Sorties:[],ActiveMissions:[],SyndicateMissions:[],ProjectPct:[0,25,99],ConstructionProjects:[]},original=structuredClone(raw),view=buildWorldView({raw,server,kind:'sample'},createWorldCatalog(),{now:at});assert.deepEqual(view.modules.find(m=>m.id==='construction').entries.map(r=>r.progress),[0,25]);assert.deepEqual(raw,original);}
});
test('双服原始样本均有两支舰队；中继站重建独立，国服节点加成不能标成全星系现金双倍',async()=>{
 for(const server of ['de','wg']){const raw=JSON.parse(await fs.readFile(new URL('../src/data/live-state/'+server+'-sample.json',import.meta.url))),view=buildWorldView({raw,server,kind:'sample'},createWorldCatalog(),{now:at});assert.deepEqual(view.modules.find(m=>m.id==='construction').entries.map(r=>r.progress),raw.ProjectPct.slice(0,2));if(server==='wg'){assert.ok(view.modules.some(m=>m.id==='relayConstruction'));const rows=view.modules.find(m=>m.id==='boosters').entries;assert.ok(rows.some(r=>r.scope==='nodes'&&r.status==='active'));assert.ok(rows.some(r=>r.kind==='credits'&&r.status==='inactive'));}}
});
test('三类加成根据类型/运算/范围解析，双倍搭配个人加成为4倍，资源数量不当成掉落几率',()=>{
 const raw=['GAMEPLAY_MONEY_REWARD_AMOUNT','GAMEPLAY_PICKUP_AMOUNT','GAMEPLAY_KILL_XP_AMOUNT'].map(t=>upgrade(t)),rows=worldBoosters(decoded(raw),at);
 assert.equal(rows.length,3);assert.deepEqual(rows.map(r=>r.kind),['credits','resources','affinity']);assert.ok(rows.every(r=>r.scope==='global'&&r.status==='active'&&r.stats[0]==='2×'&&r.description.includes('4×')));assert.equal(rows[1].subtitle,'资源获取数量');
 const scoped=worldBoosters(decoded([upgrade('GAMEPLAY_MONEY_PICKUP_AMOUNT',{Nodes:['SolNode1']})]),at,{node:()=> '地球节点'});assert.equal(scoped.length,4);assert.deepEqual(scoped[0].chips,['节点限定','生效中','地球节点']);assert.ok(scoped.some(r=>r.kind==='credits'&&r.status==='inactive'));assert.equal(scoped[0].subtitle,'现金拾取');
});
test('未来/过期/缺数据分别显示，未知运算不猜倍数，限制字段损坏不伪装全服，源记录不改写',()=>{
 const raw=[upgrade('GAMEPLAY_PICKUP_AMOUNT',{Activation:date(at+1000)}),upgrade('GAMEPLAY_KILL_XP_AMOUNT',{ExpiryDate:date(at)}),upgrade('UNKNOWN',{OperationType:'ADD',Value:0}),upgrade('GAMEPLAY_MONEY_REWARD_AMOUNT',{Nodes:'bad'})],original=structuredClone(raw),normal=normalizeGlobalUpgrades({GlobalUpgrades:raw},{server:'wg'}),rows=worldBoosters(normal.data,at);
 assert.ok(rows.some(r=>r.kind==='resources'&&r.status==='upcoming'));assert.ok(rows.some(r=>r.kind==='affinity'&&r.status==='inactive'));assert.equal(rows.find(r=>r.kind==='other').description,'');assert.equal(rows.find(r=>r.kind==='credits'&&r.status==='active').scope,'unknown');assert.ok(rows.some(r=>r.kind==='credits'&&r.status==='inactive'));assert.deepEqual(raw,original);assert.ok(normal.warnings.some(w=>w.includes('Nodes')));
 assert.ok(worldBoosters(null,at).every(r=>r.status==='unavailable'));assert.ok(worldBoosters([],at).every(r=>r.status==='inactive'));
});
