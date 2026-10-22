import test from 'node:test';import assert from 'node:assert/strict';
import { internalItems } from '../src/core/merge/display-policy.mjs';
import { LocalImages } from '../src/core/local-images.mjs';
import { shardPairs } from '../src/core/image-presentation.mjs';
import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';
test('仅隐藏 Virtuals 独占记录；缺图、未翻译、真实来源及 Base 名称不作为隐藏条件',()=>{
 const sources=[{source:'plus',file:'plus/ExportVirtuals.json'},{source:'plus',file:'plus/ExportWeapons.json'}];
 const rows=[{entityId:'virtual',source:{input:0}},{entityId:'realBase',source:{input:0}},{entityId:'realBase',source:{input:1}},{entityId:'noImage',source:{input:1}}];
 const data={manifest:{inputs:sources},output:{'reports/source-records.json':rows}};
 const hidden=internalItems(data);assert.ok(hidden.has('virtual'));assert.ok(!hidden.has('realBase'));assert.ok(!hidden.has('noImage'));assert.equal(rows.length,4);
});
test('六色 Tau 源力石叠普通底图和 Tau 光效，Forma 替换不影响原始映射',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'wb-shard-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));await fs.mkdir(path.join(root,'img'));
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jvXcAAAAASUVORK5CYII=','base64');
 for(const file of ['base.png','glow.png','old.png','forma.png'])await fs.writeFile(path.join(root,'img',file),png);
 const rows=Object.entries(shardPairs).flatMap(([tau,base])=>[{id:base,assetName:'base.png',imageName:'Base.png',hasImage:true,imageKind:'original'},{id:tau,assetName:'glow.png',imageName:'Glow.png',hasImage:true,imageKind:'original'}]);
 rows.push({id:'/Lotus/Types/Items/MiscItems/Forma',assetName:'old.png',imageName:'GenericComponent.png',hasImage:true,imageKind:'original'},{id:'/OtherForma',assetName:'forma.png',imageName:'Forma.png',hasImage:true,imageKind:'original'});
 const original=JSON.stringify({items:rows});await fs.writeFile(path.join(root,'catalog.json'),original);const images=new LocalImages();await images.select(root);
 for(const id of Object.keys(shardPairs)){const [image]=await images.batch([{id}]);assert.equal(image.kind,'tau-shard');assert.deepEqual(image.layers.map(x=>[x.file,x.role]),[['base.png','base'],['glow.png','overlay']]);}
 const [forma]=await images.batch([{id:'/Lotus/Types/Items/MiscItems/Forma'}]);assert.equal(forma.file,'forma.png');assert.equal(forma.method,'reviewed-display-override');assert.equal(await fs.readFile(path.join(root,'catalog.json'),'utf8'),original);
});
