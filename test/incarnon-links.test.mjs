import test from 'node:test';
import assert from 'node:assert/strict';
import {buildIncarnonLinks} from '../src/core/merge/incarnon-links.mjs';
import {wikiRecords} from '../src/core/merge/ability-links.mjs';
import {playerLibraryList,playerLibraryDetail} from '../src/core/player-library.mjs';
const base='/Lotus/Types/Items/MiscItems/IncarnonAdapters/';
const weapon=(id,name)=>({id,kind:'weapon',name:{en:name,'zh-CN':name},attributes:{category:'Primary'}});
const adapter=(id,name)=>({id,kind:'resource',name:{en:name+' Incarnon Genesis','zh-CN':name+'灵化之源'},attributes:{}});
const wiki=(id,family,image='Form.png')=>`\t[${JSON.stringify(id)}] = {\n\t\tFamily = ${JSON.stringify(family)},\n\t\tInternalName = ${JSON.stringify(id)},\n${image?`\t\tIncarnonImage = ${JSON.stringify(image)},\n`:''}\t},\n`;
function build(items,text){const documents=[{source:'plus-gen',file:'plus-gen/extras/wiki/Weapons/primary.lua',hash:'a'.repeat(64),value:'return {\n'+text+'}\n'}],index=new Map(items.map(i=>[i.id,[{value:{},source:{source:'plus',file:'plus/ExportResources.json',hash:'b'.repeat(64),pointer:'/test'}}]])),relations=[],provenance=[],issues=[];const report=buildIncarnonLinks({documents,index,items,itemMap:new Map(items.map(i=>[i.id,i])),relations,provenance,issue:(...v)=>issues.push(v)});return{report,relations,provenance,issues,documents};}
test('灵化适配只读解析、家族与完整 ID 精确匹配，保留行号，拒绝形似名称／缺失形态／错误槽位',()=>{
 const a=adapter(base+'Primary/BratonIncarnonUnlocker','Braton'),w=weapon('/Lotus/Braton','Braton'),p=weapon('/Lotus/Prime','Braton Prime'),native=weapon('/Lotus/Native','Phenmor'),other=weapon('/Lotus/Similar','Braton Skin'),bad=weapon('/Lotus/Bad','Other');
 const items=[a,w,p,native,other,bad],before=JSON.stringify(items);
 const text=wiki(w.id,'Braton')+wiki(p.id,'Braton')+wiki(native.id,'Phenmor')+wiki(other.id,'Braton',null)+wiki(bad.id,'Braton-ish')+wiki('/Lotus/Missing','Braton');
 const r=build(items,text);assert.equal(r.report.adapters,1);assert.equal(r.report.weapons,2);assert.deepEqual(r.relations.map(r=>r.from).sort(),[w.id,p.id].sort());assert.equal(JSON.stringify(items),before);
 const parsed=wikiRecords(r.documents[0].value,{depth:1,fields:['InternalName','Family','IncarnonImage']});assert.equal(parsed.length,6);assert.equal(r.documents[0].value.split('\n')[parsed[0].lines.Family-1].trim(),'Family = "Braton",');
 assert.ok(r.relations[0].sources.some(s=>s.line&&s.hash.length===64));assert.equal(r.provenance[0].value,a.id);
 assert.equal(build([adapter(base+'Secondary/BratonIncarnonUnlocker','Braton'),w],wiki(w.id,'Braton')).relations.length,0);
 const commented=wiki(w.id,'Braton').replace('IncarnonImage =','-- IncarnonImage =');assert.equal(build([a,w],commented).relations.length,0);
 const nested=wiki(w.id,'Braton',null).replace('\t},','\t\tNested = {\n\t\t\tIncarnonImage = "Wrong.png",\n\t\t},\n\t},');assert.equal(build([a,w],nested).relations.length,0);
});
test('冲突或重复的家族名不猜匹配；相同记录去重且允许有明确形态记录的 MK1 版本',()=>{
 const a=adapter(base+'Primary/BratonIncarnonUnlocker','Braton'),b=adapter(base+'Primary/OtherIncarnonUnlocker','Other'),w=weapon('/Lotus/MK1','MK1-Braton');
 assert.equal(build([a,w],wiki(w.id,'Braton')+wiki(w.id,'Braton')).relations.length,1);
 assert.equal(build([a,b,w],wiki(w.id,'Braton')+wiki(w.id,'Other')).relations.length,0);
 assert.equal(build([a,{...a,id:base+'Primary/Duplicate'},w],wiki(w.id,'Braton')).relations.length,0);
});
test('玩家武器筛选与灵化之源双向跳转，分类交集、未知状态与原数据均保留',()=>{
 const a=adapter(base+'Primary/BratonIncarnonUnlocker','Braton'),w=weapon('/Lotus/Braton','Braton'),p={...weapon('/Lotus/Prime','Braton Prime'),attributes:{category:'Primary',variantType:'VT_PRIME'}},n=weapon('/Lotus/Native','Phenmor');const {relations}=build([a,w,p,n],wiki(w.id,'Braton')+wiki(p.id,'Braton'));
 const data={manifest:{locales:['zh-CN','en'],datasetVersion:'fixture'},output:{'items/all.json':[a,w,p,n],'relations.json':relations,'recipes.json':[],'reports/coverage.json':{files:[]},'reports/source-records.json':[]}};const before=JSON.stringify(data);
 assert.equal(playerLibraryList(data,{group:'weapon',selected:{incarnon:'genesis'}}).total,2);
 assert.equal(playerLibraryList(data,{group:'weapon',selected:{incarnon:'genesis',variant:'PRIME'}}).rows[0].id,p.id);
 assert.deepEqual(playerLibraryList(data,{group:'weapon',selected:{incarnon:'unlinked'}}).rows.map(r=>r.id),[n.id]);
 assert.deepEqual(playerLibraryList(data,{group:'weapon'}).options.incarnon.map(o=>o.label).sort(),['灵化武器','其他武器'].sort());assert.equal(playerLibraryList(data,{group:'resource'}).options.incarnon,undefined);
 assert.equal(playerLibraryDetail(data,w.id).relations[0].label,'灵化之源');assert.equal(playerLibraryDetail(data,w.id).relations[0].rows[0].id,a.id);assert.equal(playerLibraryDetail(data,a.id).relations[0].label,'适配武器');assert.equal(playerLibraryDetail(data,a.id).relations[0].rows.length,2);assert.equal(playerLibraryDetail(data,n.id).relations.length,0);assert.equal(JSON.stringify(data),before);
});
