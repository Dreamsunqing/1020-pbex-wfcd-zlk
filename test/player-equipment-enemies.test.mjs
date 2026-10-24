import test from 'node:test';import assert from 'node:assert/strict';
import {equipmentTrade,equipmentPolarities,attackFacts,equipmentFacts} from '../src/core/player-equipment.mjs';
import {enemyLootIndex} from '../src/core/player-enemies.mjs';import {loadPlayerBundle} from '../src/core/player-bundle.mjs';import {playerLibraryDetail} from '../src/core/player-library.mjs';import {allItems} from '../src/core/merge/repository.mjs';
test('equipment keeps zero, separates finished-item trading, polarities and attack-local values',()=>{
 const item={kind:'weapon',tradable:false,attributes:{category:'Secondary',accuracy:0,multishot:1,polarities:['naramon','naramon'],exilusPolarity:'madurai',behaviours:[{burst:{count:2,delay:0}}]}};
 assert.equal(equipmentTrade(item,[{kind:'resource',tradable:true,attributes:{category:'Components'}},{kind:'blueprint',tradable:true}]),'部件及蓝图可交易；成品不参与交易');assert.equal(equipmentTrade({kind:'weapon'},[{kind:'blueprint',tradable:true}]),'蓝图可交易');assert.equal(equipmentTrade(item,[{kind:'resource',tradable:true,attributes:{category:'Resources'}}]),'成品不可交易');assert.equal(equipmentTrade({kind:'blueprint',tradable:true},[]),'可交易');assert.equal(equipmentFacts(item).find(r=>r.key==='accuracy').value,0);assert.equal(equipmentPolarities(item)[0].values.length,2);
 const rows=attackFacts({damage:{impact:68,total:68},crit_chance:0,shot_speed:80,flight:80,falloff:{start:0,end:7.8,reduction:.7}},item);
 assert.equal(rows.find(r=>r.key==='total').value,68);assert.equal(rows.find(r=>r.key==='crit_chance').value,0);assert.equal(rows.find(r=>r.key==='burstDelay').value,0);assert.equal(rows.find(r=>r.key==='burstDamage').value,136);assert.equal(rows.filter(r=>r.label==='投射物速度').length,1);assert.ok(Math.abs(rows.find(r=>r.key==='falloffRemaining').value-30)<1e-10);
 const multi=attackFacts({damage:{impact:68}},{...item,attributes:{behaviours:[{},{}]}});assert.ok(!multi.some(r=>r.key==='burstCount'));
});
test('enemy exact-ID loot multiplies two probabilities, preserves zero and excludes unresolved targets',()=>{
 const enemy={id:'/Lotus/Types/Enemies/Test',kind:'enemy',attributes:{droptable:'/Drops/Test'}},reward={id:'/Reward',kind:'mod'};
 const data={output:{'items/all.json':[enemy,reward], 'reports/coverage.json':{files:[{source:'plus',file:'plus/ExportEnemies.json',reference:'reference.json'}]},'reference.json':{droptables:{'/Drops/Test':[{type:'mod',chance:.03,items:[{type:'/Reward',probability:.2},{type:'/Reward',probability:0},{type:'/Unknown',probability:1}]}]}}}};
 const before=JSON.stringify(data),index=enemyLootIndex(data);assert.deepEqual(index.entries[enemy.id].map(r=>r.chance),[.6,0]);assert.equal(index.report.unresolved,1);assert.equal(JSON.stringify(data),before);
});
test('bundled Akarius exposes actual polarity, burst and falloff; enemies expose linked outgoing loot',async()=>{
 const data=await loadPlayerBundle(),all=allItems(data),find=name=>all.find(i=>i.name.en===name),ak=playerLibraryDetail(data,find('Akarius Prime').id);
 assert.equal(ak.trade,'部件及蓝图可交易；成品不参与交易');assert.equal(ak.polarities[0].values.length,3);assert.equal(ak.polarities[1].values[0],'madurai');assert.equal(ak.equipmentFacts.find(r=>r.key==='accuracy').value,26.666666);assert.equal(ak.attackDetails[0].find(r=>r.key==='burstDelay').value,.12);assert.equal(ak.attackDetails[1].find(r=>r.key==='burstDamage').value,1018);assert.ok(!ak.equipmentFacts.some(r=>r.key==='ammoMax'));
 const enemy=playerLibraryDetail(data,find('Butcher').id);assert.ok(enemy.enemyLoot.length>0);assert.ok(enemy.enemyLoot.every(r=>r.item.id&&r.item.title));assert.ok(enemy.enemyFacts.length>0);
 const source=playerLibraryDetail(data,find('Esti Vel-Ikha').id).acquisition.find(r=>r.basis==='enemy-name-consensus');assert.ok(source.enemyChoices.length>1);assert.equal(source.links.length,0);assert.ok(source.enemyChoices.every(r=>r.id&&r.variant));
});
