import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { ImageGallery } from '../src/core/gallery.mjs';
import { copyWithoutOverwrite, exportFilename } from '../src/core/image-export.cjs';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jvXcAAAAASUVORK5CYII=', 'base64');
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'wb-gallery-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, 'wfcd/img'), { recursive: true }); await fs.mkdir(path.join(root, 'official/img'), { recursive: true });
  for (const name of ['item.png', 'skill.png', 'orphan.png']) await fs.writeFile(path.join(root, 'wfcd/img', name), png);
  await fs.writeFile(path.join(root, 'official/img/official.png'), png);
  const save = (file, value) => fs.writeFile(path.join(root, file), JSON.stringify(value));
  await save('wfcd/catalog.json', { meta: { categories: [{ id: 'Primary', label: '主武器' }] }, items: [
    { id: '/Lotus/A', name: 'Acceltra', englishLabel: 'Acceltra', zh: '迅发电浆炮', label: '迅发电浆炮', imageName: 'A.png', assetName: 'item.png', category: 'Primary', hasImage: true, imageKind: 'original', parents: [], children: [] },
    { id: '/Lotus/Enemy', name: 'Enemy', label: '参考敌人', imageName: 'enemy.png', assetName: 'item.png', category: 'Enemy', hasImage: true, imageKind: 'reference', imageNote: '已审核参考图', parents: [], children: [] }
  ] });
  await save('wfcd/wfcd-image-index.json', { images: [{ imageName: 'A.png', assetName: 'item.png' }, { imageName: 'Skill.png', assetName: 'skill.png' }, { imageName: 'Other.png', assetName: 'orphan.png' }], mappings: [{ id: '/Lotus/Skill', imageName: 'Skill.png', assetName: 'skill.png' }] });
  await save('official/index.json', { entries: [{ uniqueName: '/Lotus/A', textureLocation: '/Lotus/A.png!version' }, { uniqueName: '/Lotus/Missing', textureLocation: '/Lotus/Missing.png!version' }], assets: [{ textureLocation: '/Lotus/A.png!version', file: 'official.png' }] });
  return { root, gallery: new ImageGallery(root) };
}
test('图片来源独立：中英文及全角搜索、嵌套技能、未引用素材、缺图和跨页选择', async t => {
  const { gallery } = await fixture(t);
  const result = await gallery.list({ provider: 'all', query: 'ＡＣＣＥＬＴＲＡ' });
  assert.equal(result.total, 2); assert.deepEqual(new Set(result.rows.map(r => r.provider)), new Set(['wfcd', 'official']));
  assert.equal((await gallery.list({ query: '迅发' })).total, 1);
  assert.equal((await gallery.list({ category: 'Abilities' })).rows[0].id, '/Lotus/Skill');
  assert.equal((await gallery.list({ category: 'Unreferenced' })).rows[0].imageName, 'Other.png');
  assert.equal((await gallery.list({ provider: 'official', availability: 'missing' })).rows[0].id, '/Lotus/Missing');
  const selected = await gallery.list({ provider: 'all', selectedKeys: ['wfcd:/Lotus/A', 'official:/Lotus/A'], offset: 1, limit: 1 });
  assert.equal(selected.total, 2); assert.equal(selected.rows.length, 1);
  assert.equal((await gallery.detail('wfcd:/Lotus/Enemy')).imageKind, 'reference');
  assert.equal(Object.keys(result.rows[0]).some(k => k.startsWith('_')), false);
  await assert.rejects(gallery.list({ offset: -1 }), /无效/);
  await assert.rejects(gallery.asset('official:/Lotus/Missing'), /暂无/);
});
test('图片读取拒绝路径逃逸、外链和伪图片', async t => {
  const { gallery, root } = await fixture(t); await gallery.load();
  assert.equal((await gallery.asset('wfcd:/Lotus/A')).mime, 'image/png');
  await assert.rejects(gallery.asset('../../private.png'), /暂无/);
  await fs.writeFile(path.join(root, 'wfcd/img/item.png'), 'HTML error');
  await assert.rejects(gallery.asset('wfcd:/Lotus/A'), /有效图片/);
  await fs.rm(path.join(root, 'wfcd/img/item.png')); await fs.writeFile(path.join(root, 'outside.png'), png);
  await fs.symlink(path.join(root, 'outside.png'), path.join(root, 'wfcd/img/item.png'));
  await assert.rejects(gallery.asset('wfcd:/Lotus/A'), /不属于/);
});
test('原图导出保留字节、共享图片的同名导出不覆盖，命名兼容 Windows', async t => {
  const { gallery, root } = await fixture(t); const asset = await gallery.asset('wfcd:/Lotus/A');
  const filename = exportFilename(asset.item, 'both'); assert.equal(filename, '迅发电浆炮_Acceltra.png');
  const first = await copyWithoutOverwrite(asset.file, root, filename), second = await copyWithoutOverwrite(asset.file, root, filename);
  assert.notEqual(first, second); assert.deepEqual(await fs.readFile(first), png); assert.deepEqual(await fs.readFile(second), png);
  assert.equal(exportFilename({ label: 'CON', imageName: 'a.png' }, 'zh'), '_CON.png');
});
test('完整本地资源库可精确查到两种来源及技能，全部索引文件存在', async () => {
  const root = path.resolve('assets/content');
  if (!await fs.stat(root).then(() => true, () => false)) return;
  const gallery = new ImageGallery(root, path.resolve('世界状态上游'));
  const result = await gallery.list({ provider: 'all', query: '迅发电浆炮' });
  assert.ok(result.rows.some(r => r.provider === 'wfcd')); assert.ok(result.rows.some(r => r.provider === 'official'));
  const skills = await gallery.list({ category: 'Abilities', query: 'RunnerRushAbility' });
  assert.equal(skills.total, 1); assert.equal(skills.rows[0].label, '马赫冲驰');
  const files = new Set(await fs.readdir(path.join(root, 'wfcd/img')));
  const officialFiles = new Set(await fs.readdir(path.join(root, 'official/img')));
  const wikiFiles=new Set(await fs.readdir(path.join(root,'wiki/img')).catch(()=>[]));
  const runtimeFiles=new Set(await fs.readdir(new URL('../src/ui/assets/text-icons/',import.meta.url)));
  for (const row of gallery.rows.filter(r => r.hasImage)) assert.ok((row.provider === 'text-icons'?runtimeFiles:row.provider === 'wfcd' ? files : row.provider==='wiki'?wikiFiles:officialFiles).has(row._asset), row.key);
});

test('图库按完整 ID 读取官方中文描述及等级效果，递归补齐 WFCD 字典技能，不复用英文描述冒充中文',async t=>{
 const {root}=await fixture(t),dataRoot=path.join(root,'data');
 const save=async(file,value)=>{const at=path.join(dataRoot,file);await fs.mkdir(path.dirname(at),{recursive:true});await fs.writeFile(at,JSON.stringify(value));};
 await save('wfcd-items/data/json/i18n/zh.json',{'/Lotus/Parent':{abilities:[{abilityUniqueName:'/Lotus/Skill',abilityName:'字典技能',description:'嵌套中文技能描述'}]}});
 await save('official-public-export/manifests/zh/ExportWeapons_zh.json',{ExportWeapons:[{uniqueName:'/Lotus/A',name:'官方中文名',levelStats:[{stats:['+15% <DT_ELECTRICITY_COLOR>电击伤害']},{stats:['+60% <DT_ELECTRICITY_COLOR>电击伤害']}]}]});
 const gallery=new ImageGallery(root,dataRoot),detail=await gallery.detail('official:/Lotus/A');
 assert.equal(detail.label,'官方中文名');assert.equal(detail.description,'+60% <DT_ELECTRICITY_COLOR>电击伤害');assert.equal(detail.descriptionLocale,'zh-CN');assert.match(detail.descriptionSource.pointer,/\/levelStats\/1\/stats$/);
 const skill=await gallery.detail('wfcd:/Lotus/Skill');assert.equal(skill.label,'字典技能');assert.equal(skill.description,'嵌套中文技能描述');assert.match(skill.descriptionSource.pointer,/\/abilities\/0\/description$/);
});

test('文本图标独立分类、可按原标记检索；别名共享图片，离开外部图库仍可读取导出',async t=>{
 const {gallery,root}=await fixture(t),result=await gallery.list({provider:'text-icons',category:'TextIcons',query:'<DT_ELECTRICITY_COLOR>'});
 assert.equal(result.total,1);const row=result.rows[0];assert.equal(row.token,'<DT_ELECTRICITY_COLOR>');assert.equal(row.categoryLabel,'文本图标');assert.equal(row.englishLabel,'DT_ELECTRICITY_COLOR');assert.equal(row.provider,'text-icons');assert.ok(row.textureLocation.endsWith('ElectricitySymbol.png'));
 const asset=await gallery.asset(row.key);assert.equal(asset.mime,'image/png');assert.match(asset.file,/src\/ui\/assets\/text-icons/);
 const exported=await copyWithoutOverwrite(asset.file,root,exportFilename(row,'en'));assert.equal(path.basename(exported),'DT_ELECTRICITY_COLOR.png');assert.deepEqual(await fs.readFile(exported),await fs.readFile(asset.file));
 assert.equal((await gallery.asset('text-icon:DT_HEAT')).file,(await gallery.asset('text-icon:DT_FIRE')).file);assert.equal((await gallery.detail(row.key)).relations.length,0);
 const isolated=new ImageGallery(null),icons=await isolated.list({provider:'text-icons'});assert.equal(icons.status.libraryMissing,true);assert.equal(icons.total,623);assert.equal((await isolated.list({provider:'text-icons',query:'<LOWER_IS_BETTER>'})).total,0);assert.equal((await isolated.asset(row.key)).mime,'image/png');await assert.rejects(isolated.asset('text-icon:../../package.json'),/暂无/);
});
