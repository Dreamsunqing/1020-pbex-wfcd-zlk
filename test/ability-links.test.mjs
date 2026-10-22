import test from 'node:test';
import assert from 'node:assert/strict';
import { wikiRecords, buildAbilityLinks } from '../src/core/merge/ability-links.mjs';
const wiki = (id, fields) => `return {\n\tMods = {\n\t\tTest = {\n\t\t\tInternalName = ${JSON.stringify(id)},\n${Object.entries(fields).map(([key,value]) => `\t\t\t${key} = ${JSON.stringify(value)},`).join('\n')}\n\t\t},\n\t},\n}`;
test('Wiki 元数据只读解析：忽略注释与嵌套伪字段，保留真实行号，不执行 Lua', () => {
  const input = wiki('/Lotus/Frame', { Name: 'Frame', Subsumed: 'Skill' }).replace('\t\t\tName', '\t\t\t-- Subsumed = "wrong",\n\t\t\tName');
  const rows = wikiRecords(input); assert.equal(rows.length, 1); assert.equal(rows[0].value.Subsumed, 'Skill');
  assert.equal(input.split('\n')[rows[0].lines.Subsumed-1].trim(), 'Subsumed = "Skill",');
  assert.equal(wikiRecords('os.execute("touch /tmp/unwanted")').length, 0);
  assert.equal(wikiRecords(input.replace('Subsumed = "Skill"', '-- Subsumed = "Skill"'))[0].value.Subsumed, undefined);
});
test('强化与移植精确关联：检查父类及屏蔽标签、显式技能范围、Prime 共享但不可献出、无相似名称猜测', () => {
  const frame='/Lotus/Frame', prime='/Lotus/FramePrime', skill='/Lotus/Skill', mod='/Lotus/SkillAugment', weapon='/Lotus/Gun', blocked='/Lotus/GunPrime', weaponMod='/Lotus/Upgrades/Mods/Syndicate/GunMod';
  const items=[{id:frame,kind:'warframe',name:{en:'Frame'},abilities:[{itemId:skill}]},{id:prime,kind:'warframe',name:{en:'Frame Prime'},abilities:[{itemId:skill}]},{id:skill,kind:'ability',name:{en:'Skill'}},{id:mod,kind:'mod'}, {id:weapon,kind:'weapon'}, {id:blocked,kind:'weapon'}, {id:weaponMod,kind:'mod'}];
  const raw={ [frame]:{parentName:'/Lotus/BaseFrame'},[prime]:{parentName:'/Lotus/BaseFrame'},[skill]:{name:'/Language/SkillName'},[mod]:{compat:'/Lotus/BaseFrame',name:'/Language/SkillAugment1Name'},[weapon]:{parentName:'/Lotus/BaseGun'},[blocked]:{parentName:'/Lotus/BaseGun',compatibilityTags:['BLOCK']},[weaponMod]:{compat:'/Lotus/BaseGun',incompatibilityTags:['BLOCK']} };
  const index=new Map(Object.entries(raw).map(([id,value])=>[id,[{value,source:{source:'plus',file:'plus/Test.json',hash:'a'.repeat(64),pointer:'/'+id}}]]));
  const documents=[{source:'plus-gen',file:'plus-gen/extras/wiki/Mods.lua',hash:'b'.repeat(64),value:wiki(mod,{IsAbilityAugment:true,Description:'Skill Augment: effect'})+wiki(weaponMod,{IsWeaponAugment:true})},{source:'plus-gen',file:'plus-gen/extras/wiki/Warframes.lua',hash:'c'.repeat(64),value:wiki(frame,{Subsumed:'Skill'})+wiki(prime,{Subsumed:'Skill'})}];
  const args={documents,index,items,itemMap:new Map(items.map(i=>[i.id,i])),relations:[],provenance:[],issue:()=>{}};
  const report=buildAbilityLinks(args); assert.equal(report.skillAugments,1);assert.equal(report.weaponAugments,1);assert.equal(report.transferableAbilities,1);
  assert.equal(items.find(i=>i.id===blocked).augments,undefined);assert.deepEqual(items.find(i=>i.id===skill).helminth.donorFrames,[frame]);assert.equal(args.relations.find(r=>r.kind==='subsumed-ability'&&r.from===prime).donor,false);
  assert.equal(args.relations.find(r=>r.kind==='augmented-by'&&r.from===skill).to,mod);
  raw[mod].name='/Language/UnknownAugmentName';documents[0].value=wiki(mod,{IsAbilityAugment:true,Description:'Skillish Augment: effect'});
  args.relations=[];args.provenance=[];const unmatched=buildAbilityLinks(args);assert.equal(unmatched.skillAugments,0);assert.ok(unmatched.unmatched.some(r=>r.id===mod));
});
