import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { LocalImages } from '../src/core/local-images.mjs';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jvXcAAAAASUVORK5CYII=', 'base64');
test('enemy portraits require explicit IDs; same-named sigils and unreviewed mappings cannot become portraits',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'wb-enemy-image-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));await fs.mkdir(path.join(root,'img'));for(const name of ['sigil.png','portrait.png'])await fs.writeFile(path.join(root,'img',name),png);
 await fs.writeFile(path.join(root,'catalog.json'),JSON.stringify({items:[{id:'/Sigil',assetName:'sigil.png',imageName:'AladV.png',hasImage:true,imageKind:'original'}]}));
 await fs.writeFile(path.join(root,'enemy-image-index.json'),JSON.stringify({mappings:[{id:'/Lotus/Types/Enemies/AladV',assetName:'portrait.png',imageName:'AladV.png',basis:'wiki-internal-id',provider:'wiki',source:{url:'https://wiki.warframe.com/w/Module:Enemies/data/corpus'}},{id:'/Lotus/Types/Enemies/Guess',assetName:'sigil.png',basis:'name-guess'}]}));
 const images=new LocalImages();await images.select(root);const [enemy,missing,guess,sigil]=await images.batch([{id:'/Lotus/Types/Enemies/AladV',imageName:'AladV.png'},{id:'/Lotus/Types/Enemies/Unknown',imageName:'AladV.png'},{id:'/Lotus/Types/Enemies/Guess',imageName:'AladV.png'},{id:'/Sigil'}]);assert.equal(enemy.file,'portrait.png');assert.equal(enemy.provider,'wiki');assert.equal(missing,null);assert.equal(guess,null);assert.equal(sigil.file,'sigil.png');
 await fs.writeFile(path.join(root,'enemy-image-index.json'),'{broken');await images.select(root);assert.equal((await images.batch([{id:'/Sigil'}]))[0].file,'sigil.png');assert.equal((await images.batch([{id:'/Lotus/Types/Enemies/AladV',imageName:'AladV.png'}]))[0],null);
});
test('local imagery: exact IDs, original catalog assets, safe paths, ambiguous case and missing files', async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'wb-images-'));
  try {
    const root = path.join(temp, 'content'); await fs.mkdir(path.join(root, 'img'), { recursive: true });
    for (const name of ['asset.png', 'Jackal.png', 'Both.png', 'BOTH.PNG']) await fs.writeFile(path.join(root, 'img', name), png);
    await fs.writeFile(path.join(root, 'img/fake.png'), 'not a bitmap');
    await fs.writeFile(path.join(temp, 'secret.png'), png);
    await fs.symlink(path.join(temp, 'secret.png'), path.join(root, 'img/escape.png'));
    await fs.writeFile(path.join(root, 'catalog.json'), JSON.stringify({ items: [
      { id: '/Lotus/Original', hasImage: true, imageKind: 'original', assetName: 'asset.png', imageName: 'Original.png' },
      { id: '/Lotus/Reference', hasImage: true, imageKind: 'reference', assetName: 'asset.png' },
      { id: '/Lotus/Bad', hasImage: true, imageKind: 'original', assetName: '../../secret.png' }
    ] }));
    const images = new LocalImages();
    assert.deepEqual(await images.batch([{ id: '/Lotus/Original' }]), [null]);
    await images.select(path.join(root, 'img'));
    // macOS volumes often cannot hold case-distinct siblings; exercise that index state explicitly.
    images.folded.set('both.png', null);
    const results = await images.batch([{ id: '/Lotus/Original' }, { imageName: 'jackal.png' }, { imageName: 'both.png' }, { imageName: 'Both.png' }, { imageName: '../secret.png' }, { imageName: 'fake.png' }, { imageName: 'escape.png' }, { id: '/Lotus/Reference' }, { id: '/Lotus/Bad' }, { imageName: 'absent.png' }]);
    assert.equal(results[0].method, 'catalog-id'); assert.match(results[0].dataUrl, /^data:image\/png;base64,/);
    assert.equal(results[1].method, 'case-insensitive'); assert.equal(results[3].method, 'exact');
    for (const i of [2, 4, 5, 6, 7, 8, 9]) assert.equal(results[i], null);
    await assert.rejects(images.batch(Array(81).fill({})), /无效/);
    const status = images.status(); await assert.rejects(images.select(path.join(temp, 'absent'))); assert.deepEqual(images.status(), status);
  } finally { await fs.rm(temp, { recursive: true, force: true }); }
});

test('蓝图用通用底图叠加精确成品；配方优先，缺图及歧义保留底图，不猜名称', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'wb-blueprints-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, 'img'));
  for (const name of ['base.png', 'gauss.png', 'gem.png', 'ordinary.png']) await fs.writeFile(path.join(root, 'img', name), png);
  const item = (id, assetName, imageName, parents = []) => ({ id, assetName, imageName, parents, hasImage: true, imageKind: 'original' });
  await fs.writeFile(path.join(root, 'catalog.json'), JSON.stringify({ items: [
    item('/GaussBlueprint', 'base.png', 'blueprint.png', ['/Gauss']),
    item('/Gauss', 'gauss.png', 'Gauss.png'), item('/Gem', 'gem.png', 'Gem.png'),
    item('/Ambiguous', 'base.png', 'blueprint.png', ['/Gauss', '/Gem']),
    item('/Missing', 'base.png', 'blueprint.png', ['/Absent']),
    item('/Self', 'base.png', 'blueprint.png', ['/Self']),
    item('/Repeated', 'base.png', 'blueprint.png', ['/Gauss']), item('/Repeated', 'base.png', 'blueprint.png', ['/Gem']),
    item('/OrdinaryBlueprint', 'ordinary.png', 'ordinary.png', ['/Gauss']),
    { ...item('/Reference', 'gem.png', 'Gem.png'), imageKind: 'reference' }
  ] }));
  const images = new LocalImages(); await images.select(root);
  const [gauss, recipe, ambiguous, missing, self, repeated, ordinary, reference, explicitMissing] = await images.batch([
    { id: '/GaussBlueprint' }, { id: '/Ambiguous', blueprint: true, resultId: '/Gem' },
    { id: '/Ambiguous' }, { id: '/Missing' }, { id: '/Self' }, { id: '/Repeated' },
    { id: '/OrdinaryBlueprint' }, { id: '/Missing', resultId: '/Reference' },
    { id: '/GaussBlueprint', resultId: '/Absent' }
  ]);
  assert.equal(gauss.kind, 'blueprint'); assert.deepEqual(gauss.layers.map(i => i.file), ['base.png', 'gauss.png']);
  assert.deepEqual(gauss.layers.map(i => i.role), ['base', 'item']); assert.equal(gauss.layers[1].itemId, '/Gauss');
  assert.equal(recipe.layers[1].file, 'gem.png');
  for (const fallback of [ambiguous, missing, self, repeated, reference, explicitMissing]) { assert.equal(fallback.file, 'base.png'); assert.equal(fallback.layers, undefined); }
  assert.equal(ordinary.file, 'ordinary.png'); assert.equal(ordinary.layers, undefined);
  await assert.rejects(images.batch([{ resultId: {} }]), /无效/);
  await assert.rejects(images.batch([{ blueprint: 'true' }]), /无效/);
});

test('普通 WFCD 图片目录按 resultImageName 合成，缺底图只用成品；路径校验适用于两层', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'wb-blueprint-names-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.writeFile(path.join(root, 'blueprint.png'), png); await fs.writeFile(path.join(root, 'Gauss.png'), png);
  const images = new LocalImages(); await images.select(root);
  const request = { id: '/Recipe', blueprint: true, resultId: '/Gauss', resultImageName: 'Gauss.png' };
  assert.deepEqual((await images.batch([request]))[0].layers.map(i => i.file), ['blueprint.png', 'Gauss.png']);
  assert.equal((await images.batch([{ ...request, resultImageName: '../Gauss.png' }]))[0].file, 'blueprint.png');
  await fs.rm(path.join(root, 'blueprint.png')); await images.select(root);
  assert.equal((await images.batch([request]))[0].file, 'Gauss.png');
  assert.equal((await images.batch([{ ...request, resultImageName: 'Missing.png' }]))[0], null);
});

test('哈希图集可按精确原图名关联嵌套技能；同名多图歧义不匹配，不使用 reference 图', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'wb-skill-names-')); t.after(()=>fs.rm(root,{recursive:true,force:true}));
  await fs.mkdir(path.join(root,'img'));for(const name of ['hash-a.png','hash-b.png'])await fs.writeFile(path.join(root,'img',name),png);
  const item=(id,name,assetName)=>({id,imageName:name,assetName,hasImage:true,imageKind:'original'});
  await fs.writeFile(path.join(root,'catalog.json'),JSON.stringify({items:[item('/Original','Skill.png','hash-a.png'),item('/A','Ambiguous.png','hash-a.png'),item('/B','Ambiguous.png','hash-b.png'),{...item('/Reference','Reference.png','hash-a.png'),imageKind:'reference'}]}));
  const images=new LocalImages();await images.select(root);
  const [skill,ambiguous,reference]=await images.batch([{id:'/Nested/Ability',imageName:'Skill.png'},{imageName:'Ambiguous.png'},{imageName:'Reference.png'}]);
  assert.equal(skill.method,'catalog-image-name');assert.equal(skill.file,'hash-a.png');assert.equal(ambiguous,null);assert.equal(reference,null);
});
