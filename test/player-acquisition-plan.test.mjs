import test from 'node:test';
import assert from 'node:assert/strict';
import { playerAcquisitionPlan } from '../src/core/player-acquisition-plan.mjs';
import { playerLibraryDetail } from '../src/core/player-library.mjs';
import { loadPlayerBundle } from '../src/core/player-bundle.mjs';
import { allItems } from '../src/core/merge/repository.mjs';

function fixture() {
  const make=(id,kind,prime=false)=>({id,kind,name:{en:id+(prime?' Prime':''),'zh-CN':'中文 '+id},attributes:{isPrime:prime}});
  const root=make('/root','weapon',true),bp=make('/bp','blueprint'),part=make('/part','resource',true),partBP=make('/partBP','blueprint'),cell=make('/cell','resource'),cellBP=make('/cellBP','blueprint');
  const items=[root,bp,part,partBP,cell,cellBP];
  const relics=['Bronze','Silver','Gold','Platinum'].map((q,n)=>({id:'/Lotus/Types/Game/Projections/T1VoidProjectionPlan'+q,kind:'relic',name:{en:'Lith P1 Relic','zh-CN':'古纪 P1 遗物'},attributes:{category:'Plan',rewards:[{item:{uniqueName:bp.id},chance:[2,4,6,10][n]},{item:{uniqueName:partBP.id},chance:[25.33,23.33,20,16.67][n]}]}}));
  return {root,data:{manifest:{datasetVersion:'fixture',locales:['zh-CN','en'],inputs:[]},output:{'items/all.json':[...items,...relics],'relations.json':[{from:bp.id,to:root.id,kind:'produces'},{from:root.id,to:bp.id,kind:'has-component',quantity:1},{from:root.id,to:part.id,kind:'has-component',quantity:1},{from:root.id,to:cell.id,kind:'has-component',quantity:5}], 'recipes.json':[{id:bp.id,resultId:root.id,quantity:1,materials:[{itemId:part.id,count:1},{itemId:part.id,count:1},{itemId:cell.id,count:5}]},{id:partBP.id,resultId:part.id,quantity:1,materials:[{itemId:cell.id,count:999}]},{id:cellBP.id,resultId:cell.id,quantity:1,materials:[]}], 'player/acquisition.json':{entries:{'/cell':[{method:'drop',links:[],title:{en:'Enemy','zh-CN':'敌人'},original:'Enemy',chance:10}]}},'contract.json':{fields:[]},'reports/source-records.json':[],'reports/coverage.json':{files:[]}}}};
}

test('Prime plan follows exact recipes, distinguishes blueprint rewards, and never doubles mirrored components',()=>{
  const {data,root}=fixture(),before=JSON.stringify(data),plan=playerAcquisitionPlan(data,root);
  assert.equal(plan.componentMode,true);assert.deepEqual(plan.groups.map(g=>g.id),['/bp','/partBP','/cell']);
  const bp=plan.groups[0],part=plan.groups[1];assert.equal(bp.role,'blueprint');assert.deepEqual(bp.forIds,['/root']);assert.equal(part.role,'component-blueprint');assert.deepEqual(part.forIds,['/part']);assert.equal(part.quantity,2);assert.equal(plan.groups[2].quantity,5);
  assert.deepEqual(part.sources[0].probabilities.map(q=>q.probability),[25.33,23.33,20,16.67]);assert.equal(plan.groups[2].sources[0].title,'敌人');assert.ok(!plan.groups.some(g=>g.id==='/cellBP'));assert.equal(JSON.stringify(data),before);
  const detail=playerLibraryDetail(data,root.id);assert.equal(detail.acquisition.length,0);assert.equal(detail.acquisitionGroups[1].forItems[0].title,'中文 /part');assert.equal(detail.acquisitionGroups[1].item.title,'中文 /partBP');assert.equal(playerAcquisitionPlan(data,root,'en').groups[2].sources[0].title,'Enemy');
});

test('missing sources remain explicit for known Prime components; ordinary items do not inherit every ingredient drop',()=>{
  const {data,root}=fixture();data.output['items/all.json'].push({id:'/unknown',kind:'resource',name:{en:'Unknown Prime'},attributes:{isPrime:true}});data.output['recipes.json'][0].materials.push({itemId:'/unknown',count:3});
  const unknown=playerAcquisitionPlan(data,root).groups.find(g=>g.id==='/unknown');assert.equal(unknown.quantity,3);assert.deepEqual(unknown.sources,[]);
  const other=structuredClone(data),ordinary=other.output['items/all.json'][0];ordinary.attributes.isPrime=false;ordinary.name.en='Ordinary';const plan=playerAcquisitionPlan(other,ordinary);assert.equal(plan.componentMode,false);assert.deepEqual(plan.groups.map(g=>g.id),['/bp']);
});

test('recipe cycles terminate and alternative quantities remain unknown instead of added',()=>{
  const {data,root}=fixture();const part=data.output['items/all.json'].find(i=>i.id==='/part');part.kind='weapon';data.output['recipes.json'][1].materials.push({itemId:root.id,count:1});data.output['recipes.json'].push({id:'/alt',resultId:root.id,quantity:1,materials:[{itemId:'/part',count:4}]});
  const groups=playerAcquisitionPlan(data,root).groups;assert.equal(new Set(groups.map(g=>g.id)).size,groups.length);assert.equal(groups.find(g=>g.id==='/partBP').quantity,null);
});

test('bundled Prime weapons and frames expose all actual parts and refinement odds offline',async()=>{
  const data=await loadPlayerBundle(),items=allItems(data),get=name=>playerLibraryDetail(data,items.find(i=>i.name.en===name&&['weapon','warframe'].includes(i.kind)).id);
  const ak=get('Akarius Prime');assert.equal(ak.componentAcquisition,true);assert.equal(ak.acquisitionGroups.length,4);assert.deepEqual(ak.acquisitionGroups.map(g=>g.quantity),[1,2,1,2]);assert.equal(ak.acquisitionGroups.find(g=>g.item.english==='Akarius Prime Barrel').sources.length,8);
  const ivara=get('Ivara Prime');assert.equal(ivara.acquisitionGroups.length,5);const parts=ivara.acquisitionGroups.filter(g=>g.role==='component-blueprint');assert.equal(parts.length,3);for(const g of parts){assert.equal(g.forItems.length,1);assert.ok(g.sources.some(r=>r.method==='relic'&&r.probabilities.length===4));assert.ok(g.item.title.includes('蓝图'));}
  const dual=get('Akbronco Prime');assert.equal(dual.acquisitionGroups.find(g=>g.item.english==='Bronco Prime Blueprint').quantity,2);assert.equal(dual.acquisitionGroups.find(g=>g.item.english==='Bronco Prime Barrel').quantity,2);
});
