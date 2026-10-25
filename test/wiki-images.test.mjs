import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {validWikiURL,wikiAssetName,uniqueWikiBindings} from '../src/core/wiki-images.mjs';import {LocalImages} from '../src/core/local-images.mjs';import {ImageGallery} from '../src/core/gallery.mjs';
const png=Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000b49444154789c636000020000050001a5f645400000000049454e44ae426082','hex');
test('Wiki bindings accept unique explicit IDs and reject conflicting files, traversal and unsafe origins',()=>{
 assert.equal(validWikiURL('https://wiki.warframe.com/images/A.png?hash'),true);
 for(const u of ['http://wiki.warframe.com/a','https://wiki.warframe.com.evil/a','https://u:p@wiki.warframe.com/a'])assert.equal(validWikiURL(u),false);
 const rows=[{id:'/Lotus/A',imageName:'A.png'},{id:'/Lotus/A',imageName:'B.png'},{id:'/Lotus/B',imageName:'A.png'},{id:'/Lotus/C',imageName:'../A.png'}];assert.deepEqual(uniqueWikiBindings(rows).map(r=>r.id),['/Lotus/B']);
 assert.equal(wikiAssetName('a'.repeat(64),'https://wiki.warframe.com/images/A.png?hash'),'a'.repeat(64)+'.png');assert.throws(()=>wikiAssetName('../x','A.png'));
});
test('shared Wiki images fill missing exact entities, enemy portrait overrides sigil; gallery exposes provenance',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'wb-wiki-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));for(const dir of ['wfcd/img','wiki/img'])await fs.mkdir(path.join(root,dir),{recursive:true});await fs.writeFile(path.join(root,'wfcd/img/sigil.png'),png);await fs.writeFile(path.join(root,'wiki/img/portrait.png'),png);
 const id='/Lotus/Types/Enemies/Test';await fs.writeFile(path.join(root,'wfcd/catalog.json'),JSON.stringify({meta:{categories:[]},items:[{id,hasImage:true,imageKind:'original',assetName:'sigil.png',imageName:'Test.png'}]}));
 await fs.writeFile(path.join(root,'wiki/index.json'),JSON.stringify({assets:[],mappings:[{id,name:'Test',assetName:'portrait.png',imageName:'TestPortrait.png',basis:'wiki-internal-id',source:{url:'https://wiki.warframe.com/w/Test'},sha256:'a'.repeat(64)},{id:'/Lotus/Unknown',assetName:'portrait.png',imageName:'Portrait.png',basis:'fuzzy-name'}]}));
 const images=new LocalImages();await images.select(root);const [enemy,unknown]=await images.batch([{id},{id:'/Lotus/Unknown'}]);assert.equal(enemy.provider,'wiki');assert.equal(enemy.file,'portrait.png');assert.equal(unknown,null);
 const gallery=new ImageGallery(root);const page=await gallery.list({provider:'wiki',category:'WikiEnemies'});assert.equal(page.total,1);assert.match(page.rows[0].imageNote,/wiki-internal-id/);assert.equal((await gallery.asset('wiki:'+id)).mime,'image/png');
});
