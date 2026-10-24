import test from 'node:test';
import assert from 'node:assert/strict';
import { acquisitionIndex, playerAcquisition, playerWikiLinks } from '../src/core/player-acquisition.mjs';
import { createPlayerBundle, loadPlayerBundle } from '../src/core/player-bundle.mjs';
import { allItems } from '../src/core/merge/repository.mjs';
import { playerLibraryDetail } from '../src/core/player-library.mjs';

function fixture() {
  const item={id:'/Lotus/Test/Mod',kind:'mod',name:{en:'Test Mod','zh-CN':'测试 Mod'},attributes:{wikiaUrl:'https://wiki.warframe.com/w/Test_Mod',drops:[
    {location:'Earth/Cambria (Spy), Rotation B',type:'2X Test Mod',chance:.29},
    {location:'Earth/Cambria (Spy), Rotation B',type:'2X Test Mod',chance:.29},
    {location:'Earth/Cambria (Spy), Rotation B',type:'Test Mod',chance:0},
    {location:'Unknown Enemy',type:'Test Mod',chance:140},
    {location:'Conclave',type:'Test Mod Skin',chance:100}
  ]}},node={id:'wf:region/SolNode1',kind:'region',name:{en:'Cambria','zh-CN':'Cambria'},attributes:{systemName:'Earth',missionName:'Spy'}};
  const table='/Lotus/Rewards/SpyMissionRewards/Test';
  return {item,table,data:{manifest:{datasetVersion:'fixture',locales:['zh-CN','en'],inputs:[{file:'plus/ExportRegions.json',source:'plus',hash:'a'.repeat(64)}]},output:{
    'items/all.json':[item,node], 'relations.json':[], 'recipes.json':[], 'contract.json':{fields:[]},
    'reports/source-records.json':[], 'reports/provenance.json':[],
    'reports/coverage.json':{files:[{file:'plus/ExportRegions.json',source:'plus',reference:'ref'}]},
    'ref':{SolNode1:{name:'Cambria',systemName:'Earth',rewardManifests:[table]}},
    'reward-tables.json':[{id:table,pools:[{index:7,items:[{itemId:item.id,probability:.1,quantity:1}]}]}],
    'localizations/zh-CN.json':{[node.id]:{'attributes.systemName':{value:'地球'},'attributes.missionName':{value:'间谍'}}},
    'localizations/en.json':{[node.id]:{'attributes.systemName':{value:'Earth'},'attributes.missionName':{value:'Spy'}}}
  }}};
}

test('Wiki uses validated upstream URLs and separately encoded Chinese/English huiji titles',()=>{
  const {item}=fixture(),links=playerWikiLinks(item);
  assert.equal(links.length,3);assert.equal(links[0].basis,'source-field');
  assert.equal(decodeURIComponent(new URL(links[1].url).pathname),'/wiki/测试_Mod');
  assert.equal(decodeURIComponent(new URL(links[2].url).pathname),'/wiki/Test_Mod');
  for(const url of ['javascript:alert(1)','file:///etc/passwd','https://wiki.warframe.com.evil.example/x','https://name:pass@wiki.warframe.com/w/Test','https://evil.example']){
    assert.ok(playerWikiLinks({...item,attributes:{wikiaUrl:url}}).every(l=>l.basis==='name-derived'));
  }
  assert.equal(playerWikiLinks({name:{en:'Volt','zh-CN':'Volt'}}).length,1);
});

test('drops validate reward identity, dedupe equal rows, preserve zero/unknown odds and exact node context',()=>{
  const {data,item}=fixture(),before=JSON.stringify(data),index=acquisitionIndex(data),rows=playerAcquisition(data,item);
  assert.equal(index.report.drops,3);assert.equal(index.report.rejectedDrops.length,1);
  const first=rows[0];assert.equal(first.title,'地球 · Cambria · 间谍');assert.equal(first.rotation,'B');assert.equal(first.chance,.29);assert.equal(first.quantity,2);assert.equal(first.links[0].id,'wf:region/SolNode1');
  assert.equal(rows[1].chance,0);assert.equal(rows[2].chance,null);assert.equal(rows[2].title,'Unknown Enemy');assert.equal(rows[2].links.length,0);
  const pool=rows.find(r=>r.method==='pool');assert.equal(pool.chance,10);assert.equal(pool.pool,7);assert.equal(pool.rotation,null);assert.equal(pool.links[0].id,'wf:region/SolNode1');
  assert.equal(JSON.stringify(data),before);
});

test('embedded index retains acquisition evidence and Wiki links without duplicating raw drop arrays',()=>{
  const {data,item}=fixture(),slim=createPlayerBundle(data);
  assert.equal(allItems(slim)[0].attributes.drops,undefined);assert.equal(allItems(slim)[0].attributes.wikiaUrl,item.attributes.wikiaUrl);
  assert.deepEqual(playerAcquisition(slim,allItems(slim)[0]),playerAcquisition(data,item));
  assert.equal(playerLibraryDetail(slim,item.id).wikiLinks.length,3);
  assert.equal(playerLibraryDetail(slim,item.id).acquisition[0].links[0].title,'Cambria');
});

test('actual bundle exposes Mod drop sources, generic relic acquisition, and suppresses weapon skin false drops',async()=>{
  const data=await loadPlayerBundle();
  assert.ok(data.output['player/acquisition.json']);
  const items=allItems(data),accelerated=items.find(i=>i.name.en==='Accelerated Blast');
  const detail=playerLibraryDetail(data,accelerated.id);assert.ok(detail.wikiLinks.some(l=>l.basis==='source-field'));assert.ok(detail.acquisition.some(r=>r.method==='drop'&&r.chance===18.97));
  const strun=items.find(i=>i.kind==='weapon'&&i.name.en?.toLowerCase()==='strun');assert.ok(strun);assert.ok(!playerLibraryDetail(data,strun.id).acquisition.some(r=>r.method==='drop'));
  const relic=items.find(i=>i.kind==='relic'&&i.name.en==='Axi A21 Relic'&&i.id.endsWith('Bronze'));assert.ok(relic);assert.ok(playerLibraryDetail(data,relic.id).acquisition.some(r=>r.method==='drop'));
  const blueprint=items.find(i=>i.kind==='blueprint'&&i.name.en==='Forma Blueprint');assert.ok(blueprint);assert.ok(playerLibraryDetail(data,blueprint.id).wikiLinks.some(l=>l.url.endsWith('/Forma_Blueprint')));
  const radiant=playerLibraryDetail(data,blueprint.id).acquisition.find(r=>r.original==='Axi A22 Relic (Radiant)');assert.equal(radiant.basis,'exact-relic-source-id');assert.ok(radiant.title.endsWith('光辉'));assert.ok(radiant.links[0].id.endsWith('Platinum'));assert.equal(radiant.chance,20);
});

test('recipe product identity resolves generic blueprints; explicit relic quality is retained; enemy loot is not enemy acquisition',()=>{
  const {data}=fixture();data.output['reward-tables.json']=[];
  const product={id:'/Lotus/Test/Weapon',kind:'weapon',name:{en:'Test Weapon'}},blueprint={id:'/Lotus/Test/Recipe',kind:'blueprint',name:{en:'Blueprint'},attributes:{drops:[{location:'Mission',type:'Test Weapon Blueprint',chance:10}]}},relic={id:'/Lotus/Types/Game/Projections/T1VoidProjectionTestBronze',kind:'relic',name:{en:'Lith T1 Relic'},attributes:{drops:[{location:'Mission',type:'Lith T1 Relic (Radiant)',chance:5}]}},enemy={id:'/Lotus/Test/Enemy',kind:'enemy',name:{en:'Enemy'},attributes:{drops:[{location:'Test Mod',type:'Mod Locations',chance:.001}]}};
  data.output['items/all.json'].push(product,blueprint,relic,enemy);data.output['recipes.json']=[{id:blueprint.id,resultId:product.id}];
  const index=acquisitionIndex(data);assert.equal(index.entries[blueprint.id][0].chance,10);assert.equal(index.entries[relic.id][0].rewardVariant,'光辉遗物');assert.equal(index.entries[enemy.id],undefined);assert.equal(index.report.skippedCollections,1);
});
