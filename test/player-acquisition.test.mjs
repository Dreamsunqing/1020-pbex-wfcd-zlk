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

test('enemy variants share only unanimous localized names, never an arbitrary identity or missing-language fallback',()=>{
  const {data,item}=fixture();data.manifest.locales.push('fr');
  item.attributes.drops=[{location:' Commandeered Ember Prime ',type:'Test Mod',chance:2.5}];
  const enemies=['normal','steel','quest'].map(key=>({id:'/Lotus/Test/Enemy/'+key,kind:'enemy',name:{en:'Commandeered Ember Prime ', 'zh-CN':'被控制的 Ember Prime',fr:key==='quest'?'Autre':'Ennemi'}}));
  data.output['items/all.json'].push(...enemies);
  const before=JSON.stringify(data),raw=acquisitionIndex(data).entries[item.id][0],row=playerAcquisition(data,item)[0];
  assert.equal(row.title,'被控制的 Ember Prime');assert.equal(row.chance,2.5);assert.equal(row.basis,'enemy-name-consensus');assert.deepEqual(row.links,[]);assert.deepEqual(raw.nameCandidates,enemies.map(i=>i.id));assert.equal(raw.title.fr,undefined);assert.equal(playerAcquisition(data,item,'fr')[0].title,'Commandeered Ember Prime');
  const slim=createPlayerBundle(data);assert.deepEqual(playerAcquisition(slim,allItems(slim)[0]),playerAcquisition(data,item));assert.equal(JSON.stringify(data),before);
  const conflict=structuredClone(data);conflict.output['items/all.json'].at(-1).name['zh-CN']='另一个敌人';assert.equal(playerAcquisition(conflict,item)[0].title,'Commandeered Ember Prime');
  const missing=structuredClone(data);delete missing.output['items/all.json'].at(-1).name['zh-CN'];assert.equal(acquisitionIndex(missing).entries[item.id][0].title['zh-CN'],undefined);
  const mixed=structuredClone(data);mixed.output['items/all.json'].at(-1).kind='region';assert.equal(acquisitionIndex(mixed).entries[item.id][0].basis,'source-text');
});

test('actual bundle localizes Commandeered enemy drops through Plus names without conflating variants',async()=>{
  const data=await loadPlayerBundle(),id='/Lotus/Upgrades/Mods/Antiques/DashDistanceSchools';
  const rows=playerLibraryDetail(data,id).acquisition.filter(r=>r.original?.startsWith('Commandeered'));
  assert.equal(rows.length,6);
  for(const row of rows){assert.equal(row.title,'被控制的 '+row.original.slice('Commandeered '.length).trim());assert.equal(row.chance,2.5);assert.equal(row.basis,'enemy-name-consensus');assert.equal(row.links.length,0);assert.ok(row.nameCandidates.length>1);assert.equal(row.evidence.file,'wfcd-items/data/json/Mods.json');}
});

test('actual bundle exposes Mod drop sources, generic relic acquisition, and suppresses weapon skin false drops',async()=>{
  const data=await loadPlayerBundle();
  assert.ok(data.output['player/acquisition.json']);
  const items=allItems(data),accelerated=items.find(i=>i.name.en==='Accelerated Blast');
  const detail=playerLibraryDetail(data,accelerated.id);assert.ok(detail.wikiLinks.some(l=>l.basis==='source-field'));assert.ok(detail.acquisition.some(r=>r.method==='drop'&&r.chance===18.97));
  const strun=items.find(i=>i.kind==='weapon'&&i.name.en?.toLowerCase()==='strun');assert.ok(strun);assert.ok(!playerLibraryDetail(data,strun.id).acquisition.some(r=>r.method==='drop'));
  const relic=items.find(i=>i.kind==='relic'&&i.name.en==='Axi A21 Relic'&&i.id.endsWith('Bronze'));assert.ok(relic);assert.ok(playerLibraryDetail(data,relic.id).acquisition.some(r=>r.method==='drop'));
  const blueprint=items.find(i=>i.kind==='blueprint'&&i.name.en==='Forma Blueprint');assert.ok(blueprint);assert.ok(playerLibraryDetail(data,blueprint.id).wikiLinks.some(l=>l.url.endsWith('/Forma_Blueprint')));
  const source=playerLibraryDetail(data,blueprint.id).acquisition.find(r=>r.title==='后纪 A22 遗物');assert.equal(source.method,'relic');assert.equal(source.links.length,1);assert.ok(source.links[0].id.endsWith('Bronze'));assert.deepEqual(source.probabilities.map(q=>q.probability),[11,13,17,20]);assert.equal(source.chance,undefined);assert.equal(source.pool,undefined);
});

test('recipe product identity resolves generic blueprints; explicit relic quality is retained; enemy loot is not enemy acquisition',()=>{
  const {data}=fixture();data.output['reward-tables.json']=[];
  const product={id:'/Lotus/Test/Weapon',kind:'weapon',name:{en:'Test Weapon'}},blueprint={id:'/Lotus/Test/Recipe',kind:'blueprint',name:{en:'Blueprint'},attributes:{drops:[{location:'Mission',type:'Test Weapon Blueprint',chance:10}]}},relic={id:'/Lotus/Types/Game/Projections/T1VoidProjectionTestBronze',kind:'relic',name:{en:'Lith T1 Relic'},attributes:{drops:[{location:'Mission',type:'Lith T1 Relic (Radiant)',chance:5}]}},enemy={id:'/Lotus/Test/Enemy',kind:'enemy',name:{en:'Enemy'},attributes:{drops:[{location:'Test Mod',type:'Mod Locations',chance:.001}]}};
  data.output['items/all.json'].push(product,blueprint,relic,enemy);data.output['recipes.json']=[{id:blueprint.id,resultId:product.id}];
  const index=acquisitionIndex(data);assert.equal(index.entries[blueprint.id][0].chance,10);assert.equal(index.entries[relic.id][0].rewardVariant,'光辉遗物');assert.equal(index.entries[enemy.id],undefined);assert.equal(index.report.skippedCollections,1);
});


test('relic acquisition collapses qualities and cross-source rows by identity, preserving zero and unknown odds',()=>{
  const {data,item}=fixture(),keys=['Bronze','Silver','Gold','Platinum'],chances=[0,.5,null,10];
  const variants=keys.map((key,n)=>({id:'/Lotus/Types/Game/Projections/T1VoidProjectionTest'+key,kind:'relic',name:{en:'Lith T1 Relic','zh-CN':'古纪 T1 遗物'},attributes:{category:'Lith T1',rewards:[{item:{uniqueName:item.id},chance:chances[n]}]}}));
  data.output['items/all.json'].push(...variants);data.output['player/acquisition.json']={entries:{[item.id]:[
    ...variants.map((v,n)=>({method:'drop',basis:'exact-relic-source-id',links:[v.id],chance:chances[n],title:{en:'Quality '+n}})),
    {method:'pool',links:variants.map(v=>v.id),chance:99,pool:1,quantity:1,rarity:'COMMON'}
  ]}};
  const before=JSON.stringify(data),rows=playerAcquisition(data,item);assert.equal(rows.length,1);assert.equal(rows[0].links.length,1);assert.equal(rows[0].links[0].id,variants[0].id);assert.equal(rows[0].title,'古纪 T1 遗物');assert.deepEqual(rows[0].probabilities.map(q=>q.probability),chances);assert.equal(rows[0].pool,undefined);assert.equal(rows[0].quantity,undefined);assert.equal(JSON.stringify(data),before);
  assert.equal(playerLibraryDetail(data,item.id).acquisition[0].links.length,1);
  assert.equal(playerAcquisition(data,item,'en')[0].title,'Lith T1 Relic');
  // Same text is insufficient to join another family; category and identity differ.
  const other=structuredClone(data);other.output['items/all.json'].push(...variants.map(v=>({...v,id:v.id.replace('Test','Distinct'),attributes:{...v.attributes,category:'distinct'}})));
  assert.equal(playerAcquisition(other,item).filter(r=>r.method==='relic').length,2);
});
