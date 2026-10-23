import test from 'node:test';import assert from 'node:assert/strict';
import {loadPlayerBundle} from '../src/core/player-bundle.mjs';
import {playerLibraryList,playerLibraryDetail} from '../src/core/player-library.mjs';
import {playerFacetValues} from '../src/core/player-facets.mjs';

test('pet category moves into companion resources without changing kind, IDs or relationships',async()=>{
 const data=await loadPlayerBundle(),all=data.output['items/all.json'],source=all.filter(i=>i.kind==='weapon'&&i.attributes?.category==='Pets'),page=playerLibraryList(data,{group:'companion',selected:{category:'Companion Resources'},limit:72});
 assert.equal(source.length,49);assert.equal(page.total,49);assert.deepEqual(page.rows.map(i=>i.id).sort(),source.map(i=>i.id).sort());
 assert.equal(playerLibraryList(data,{group:'weapon'}).options.category.some(o=>o.value==='Pets'),false);
 assert.equal(playerLibraryList(data,{group:'companion'}).total,87);assert.equal(playerLibraryList(data,{group:'weapon'}).total,952);
 const record=source[0],before=JSON.stringify(record),detail=playerLibraryDetail(data,record.id);assert.equal(detail.item.group,'companion');assert.equal(detail.item.kind,'weapon');assert.equal(detail.item.facets.category,'Companion Resources');assert.equal(JSON.stringify(record),before);
 // Actual sentinel weapons retain their separate source classification.
 assert.ok(playerLibraryList(data,{group:'weapon',selected:{type:'Companion Weapon'}}).total>0);
});

test('Mod normalized options merge all Riven identities and recover structured unknown groups',async()=>{
 const data=await loadPlayerBundle(),mods=playerLibraryList(data,{group:'mod'}),types=mods.options.type;
 assert.equal(types.filter(o=>/Riven/.test(o.value)).length,1);assert.equal(types.find(o=>o.value==='Riven Mod').count,15);
 for(const [type,total] of [['Operator Mod',20],['Necramech Mod',28],['K-Drive Mod',23],['---',5],['Railjack Mod',10]]){
  const page=playerLibraryList(data,{group:'mod',selected:{type},limit:72}),english=playerLibraryList(data,{group:'mod',selected:{type},locale:'en',limit:72});assert.equal(page.total,total);assert.deepEqual(page.rows.map(i=>i.id).sort(),english.rows.map(i=>i.id).sort());
 }
 const unknown=playerLibraryList(data,{group:'mod',selected:{type:'---'}});assert.ok(unknown.rows.every(i=>/转换核心$/.test(i.title)||i.english==='Sampleantiqueupgrade'));
 assert.equal(types.at(-1).label,'未融合的神器');assert.deepEqual(types.slice(0,11).map(o=>o.value),['AURA','WARFRAME','Necramech Mod','ARCHWING','PRIMARY','SECONDARY','MELEE','STANCE','ARCH-GUN','ARCH-MELEE','SENTINEL']);
 assert.deepEqual(mods.options.rarity.map(o=>o.value),['COMMON','UNCOMMON','RARE','LEGENDARY']);
 assert.equal(playerFacetValues({id:'/Lotus/Upgrades/Mods/Hoverboard/HBJumpChargeTimeMod',kind:'mod',name:{'zh-CN':'瞬满'},attributes:{type:'---'}}).type,'K-Drive Mod');
 assert.equal(playerFacetValues({id:'/Future/Unknown',kind:'mod',attributes:{type:'---'}}).type,'---');
});

test('normalized filters preserve totals and intersect correctly across all player picker dimensions',async()=>{
 const data=await loadPlayerBundle();
 for(const group of ['warframe','weapon','companion','mod','arcane']){
  const page=playerLibraryList(data,{group});
  for(const [key,options] of Object.entries(page.options))for(const option of options){const filtered=playerLibraryList(data,{group,selected:{[key]:option.value}});assert.equal(filtered.total,option.count,group+'/'+key+'/'+option.value);}
 }
 const base=playerLibraryList(data,{group:'mod',selected:{type:'Riven Mod'},limit:72});
 for(const option of base.options.rarity){const p=playerLibraryList(data,{group:'mod',selected:{type:'Riven Mod',rarity:option.value},limit:72});assert.equal(p.total,base.rows.filter(i=>i.facets.rarity===option.value).length);assert.equal(p.total,option.count);}
});
