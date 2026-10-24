import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMerged } from '../src/core/merge/build.mjs';
import { FULL_CONTRACT } from '../src/core/merge/rules.mjs';
import { allItems } from '../src/core/merge/repository.mjs';
import { createPlayerBundle, loadPlayerBundle } from '../src/core/player-bundle.mjs';
import { playerLibraryDetail, playerLibraryList } from '../src/core/player-library.mjs';
import { modSetBonus } from '../src/core/mod-sets.mjs';
import { sha256 } from '../src/core/io.mjs';
import { plainGameText } from '../src/core/inline-tokens.mjs';

test('套装按完整 modSet ID 关联，同语言模板按件数代入非线性参数，压缩后仍可双向跳转', async () => {
  const set='/Lotus/Test/Set', a='/Lotus/Test/A', b='/Lotus/Test/B', unrelated='/Lotus/Test/C';
  const docs=new Map([
    ['plus/ExportModSet.json',{[set]:{description:'/Language/Bonus',numUpgradesInSet:2,levelStats:[{RANGE:'7.5',TIME:'60'},{RANGE:'22',TIME:'15'}]}}],
    ['plus/ExportUpgrades.json',{[a]:{name:'/Language/A',modSet:set,rarity:'COMMON',fusionLimit:5,baseDrain:2},[b]:{name:'/Language/B',modSet:set},[unrelated]:{name:'/Language/C'}}],
    ['plus/dict.zh.json',{'/Language/A':'测试 甲','/Language/B':'测试 乙','/Language/C':'测试 丙','/Language/Bonus':'每 |TIME| 秒作用于 |RANGE| 米内目标。'}],
    ['plus/dict.en.json',{'/Language/A':'Test Alpha','/Language/B':'Test Beta','/Language/Bonus':'Every |TIME|s within |RANGE|m.'}],
    ['wfcd/data/json/Mods.json',[{uniqueName:set,type:'Mod Set Mod',name:'Testsetmod',stats:['Wrong 10','Wrong 20'],numUpgradesInSet:2}]],
    ['plus/ExportRewards.json',{'/Lotus/Test/Rewards':[[]]}]
  ]);
  const read=async id=>{const bytes=Buffer.from(JSON.stringify(docs.get(id)));return {bytes,hash:sha256(bytes)};};
  const data=await buildMerged({files:[...docs.keys()].map(id=>({id,source:id.split('/')[0]})),read,contract:structuredClone(FULL_CONTRACT)});
  const info=allItems(data).find(i=>i.id===set);
  assert.equal(info.name['zh-CN'],'测试 套装');assert.equal(info.name.en,'Test Set');
  assert.deepEqual(info.modSetInfo.bonuses['zh-CN'],['每 60 秒作用于 7.5 米内目标。','每 15 秒作用于 22 米内目标。']);
  assert.equal(data.output['reports/mod-set-links.json'].members,2);
  assert.ok(!data.output['relations.json'].some(r=>r.from===unrelated));
  const slim=createPlayerBundle(data), detail=playerLibraryDetail(slim,a);
  assert.equal(detail.relations.find(r=>r.label==='所属套装').rows[0].id,set);
  assert.equal(detail.modSet.levels[1].text,'每 15 秒作用于 22 米内目标。');
  assert.equal(detail.item.image.cardArt.set.count,1);
  assert.equal(playerLibraryDetail(slim,set).relations.find(r=>r.label==='套装成员').rows.length,2);
  assert.equal(playerLibraryDetail(slim,set).levelStats.length,0);
  assert.equal(playerLibraryDetail(slim,a,{locale:'en'}).modSet.levels[1].text,'Every 15s within 22m.');
});

test('内置 19 套 / 72 张成员全部命名、中文逐件效果与卡面徽记；暗影牺牲保留增强说明', async () => {
  const data=await loadPlayerBundle(), all=allItems(data), sets=all.filter(i=>i.kind==='mod-set'), mods=all.filter(i=>i.modSetId);
  assert.equal(sets.length,19);assert.equal(mods.length,72);
  for(const set of sets){
    assert.ok(set.name['zh-CN']);assert.ok(!/setmod$/i.test(set.name.en));
    assert.equal(set.modSetInfo.memberIds.length,set.modSetInfo.size);
    for(let count=1;count<=set.modSetInfo.size;count++){
      const bonus=modSetBonus(set,count);assert.equal(bonus.locale,'zh-CN');assert.ok(bonus.text);assert.doesNotMatch(bonus.text,/\|[^|]+\|/);
    }
    const detail=playerLibraryDetail(data,set.id);assert.equal(detail.relations.find(g=>g.label==='套装成员').rows.length,set.modSetInfo.size);
    assert.ok(set.modSetInfo.memberIds.every(id=>mods.some(m=>m.id===id&&m.modSetId===set.id)));
  }
  const augur=sets.find(s=>s.name.en==='Augur Set');assert.match(modSetBonus(augur,6).text,/240%/);
  const member=mods.find(m=>m.modSetId===augur.id), detail=playerLibraryDetail(data,member.id), art=detail.item.image.cardArt;
  assert.equal(art.set.id,augur.id);assert.match(art.set.icon.imageName,/AugurHeader/);assert.match(art.set.bonus,/40%/);
  assert.match(playerLibraryDetail(data,member.id,{locale:'en'}).item.image.cardArt.set.bonus,/Shields/);
  for(const family of ['Umbral Set','Sacrificial Set']){
    const set=sets.find(s=>s.name.en===family);assert.equal(set.modSetInfo.buffSet,true);assert.equal(modSetBonus(set,1).text,'增强这个组合中的 MOD。');
  }
  assert.equal(playerLibraryList(data,{group:'mod',selected:{type:'Mod Set Mod'}}).total,19);
});

test('缺失语言明确回退，不把未知参数或缺失档位猜成零；格式标记不吞中文',()=>{
  const set={modSetInfo:{size:2,bonuses:{en:['First',null]}}};
  assert.deepEqual(modSetBonus(set,1),{count:1,text:'First',locale:'en',fallback:true});
  assert.equal(modSetBonus(set,2).missing,true);assert.equal(modSetBonus(set,3),null);
  assert.equal(plainGameText('每隔 <LOWER_IS_BETTER>15 秒触发一次。'),'每隔 15 秒触发一次。');
  assert.equal(plainGameText('保留 <UNKNOWN_SET_TOKEN> 描述'),'保留 <UNKNOWN_SET_TOKEN> 描述');
});
