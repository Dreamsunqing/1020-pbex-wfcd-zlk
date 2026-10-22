import test from 'node:test';import assert from 'node:assert/strict';
import {FULL_CONTRACT} from '../src/core/merge/rules.mjs';
import {buildMerged} from '../src/core/merge/build.mjs';
import {mergedDetail} from '../src/core/merge/service.mjs';
import {sha256} from '../src/core/io.mjs';
import {inlineText,plainGameText} from '../src/core/inline-tokens.mjs';
import {createTextLocalizer,applyLocalizedFields} from '../src/core/text-localization.mjs';
function fixture(){
 const id='/Lotus/Test/Weapon',skill='/Lotus/Test/Skill';
 const docs=new Map([
 ['official/manifests/en/ExportWeapons_en.json',{ExportWeapons:[{uniqueName:id,name:'Weapon',levelStats:[{stats:['+15% <DT_ELECTRICITY_COLOR>Electricity']},{stats:['+60% <DT_ELECTRICITY_COLOR>Electricity']}],deep:{nested:{description:'English leaf'},modes:[{name:'Primary',description:'English mode'}]},criticalChance:.1}]}],
 ['official/manifests/zh/ExportWeapons_zh.json',{ExportWeapons:[{uniqueName:id,name:'中文武器',levelStats:[{stats:['+15% <DT_ELECTRICITY_COLOR>电击伤害']},{stats:['+60% <DT_ELECTRICITY_COLOR>电击伤害']}],deep:{nested:{description:'中文叶子'},modes:[{name:'主要',description:'中文模式'}]},criticalChance:.2}]}],
 ['official/manifests/fr/ExportWeapons_fr.json',{ExportWeapons:[{uniqueName:id,name:'Arme',levelStats:[{stats:['+60% Électricité']}],deep:{nested:{description:'Texte français'}}}]}],
 ['plus/ExportWeapons.json',{[id]:{name:'/Language/Name',deep:{map:{'a.b':{description:'/Language/Description',target:id}}}}}],
 ['plus/dict.zh.json',{'/Language/Name':'字典武器','/Language/Description':'递归中文'}],
 ['plus/dict.en.json',{'/Language/Name':'Dictionary Weapon','/Language/Description':'Recursive English'}],
 ['plus/dict.fr.json',{'/Language/Name':'Arme dictionnaire','/Language/Description':'Récursif'}],
 ['wfcd/data/json/Warframes.json',[{uniqueName:'/Lotus/Test/Frame',name:'Frame',abilities:[{abilityUniqueName:skill,abilityName:'Skill',description:'English skill'}]}]],
 ['wfcd/data/json/i18n/zh.json',{'/Lotus/Test/Frame':{name:'中文战甲',passiveDescription:'中文被动',abilities:[{abilityUniqueName:skill,abilityName:'中文技能',description:'中文技能描述<DT_FIRE_COLOR>火焰'}]},[id]:{description:['第一行中文','第二行中文']}}],
 ['plus/ExportRewards.json',{'/Lotus/Rewards/Test':[[{type:id,itemCount:1}]]}]
 ]);
 const contract=structuredClone(FULL_CONTRACT);contract.locales=['zh-CN','en','fr'];
 const files=[...docs.keys()].map(id=>({id,source:id.split('/')[0]}));
 const read=async file=>{const bytes=Buffer.from(JSON.stringify(docs.get(file)));return{bytes,hash:sha256(bytes)}};
 return {id,skill,docs,contract,files,read};
}
test('三语言按源结构递归映射：官方文本、语言键、WFCD 嵌套技能/数组描述；身份和原数据不变',async()=>{
 const f=fixture(),before=JSON.stringify([...f.docs]),data=await buildMerged(f);
 const zh=mergedDetail(data,f.id),en=mergedDetail(data,f.id,{locale:'en'}),fr=mergedDetail(data,f.id,{locale:'fr'});
 assert.equal(zh.item.name['zh-CN'],'中文武器');assert.equal(fr.item.name.fr,'Arme');
 assert.equal(zh.item.description['zh-CN'],'第一行中文\n第二行中文');
 assert.equal(zh.item.attributes.deep.nested.description,'中文叶子');assert.equal(en.item.attributes.deep.nested.description,'English leaf');assert.equal(fr.item.attributes.deep.nested.description,'Texte français');
 assert.equal(zh.item.attributes.deep.modes[0].description,'中文模式');assert.equal(en.item.attributes.deep.modes[0].name,'Primary');
 const field=zh.fields.find(f=>f.field==='attributes.deep.map["a.b"].description');assert.equal(field.value,'递归中文');assert.equal(field.localization.dictionarySources[0].dictionary.file,'plus/dict.zh.json');
 assert.equal(field.localization.dictionarySources[0].source.pointer,'/~1Lotus~1Test~1Weapon/deep/map/a.b/description');
 assert.equal(en.item.attributes.deep.map['a.b'].description,'Recursive English');assert.equal(fr.item.attributes.deep.map['a.b'].description,'Récursif');
 assert.equal(zh.item.attributes.deep.map['a.b'].target,f.id);
 assert.equal(mergedDetail(data,f.skill).item.description['zh-CN'],'中文技能描述<DT_FIRE_COLOR>火焰');
 const frame=mergedDetail(data,'/Lotus/Test/Frame');assert.equal(frame.item.passiveDescription['zh-CN'],'中文被动');assert.equal(frame.relations.find(r=>r.to===f.skill).toLabel,'中文技能');
 assert.ok(data.output['reports/issues.json'].some(i=>i.field==='stats.criticalChance'&&i.code==='field-conflict'));
 assert.equal(JSON.stringify([...f.docs]),before);
 assert.throws(()=>mergedDetail(data,f.id,{locale:'ja'}),/未构建/);
});
test('Mod 全等级中文保留；满级描述显式派生并溯源；缺少语言时仅明确回退英文；人工值不被投影覆盖',async()=>{
 const f=fixture();f.docs.delete('wfcd/data/json/i18n/zh.json');f.files=f.files.filter(row=>f.docs.has(row.id));
 const data=await buildMerged(f),zh=mergedDetail(data,f.id),en=mergedDetail(data,f.id,{locale:'en'});
 assert.equal(zh.item.description['zh-CN'],'+60% <DT_ELECTRICITY_COLOR>电击伤害');assert.equal(zh.item.attributes.levelStats[0].stats[0],'+15% <DT_ELECTRICITY_COLOR>电击伤害');
 const d=zh.fields.find(f=>f.field==='description.zh-CN');assert.equal(d.candidates[d.selected].transform,'max-rank-stats');assert.match(d.candidates[d.selected].source.pointer,/\/levelStats\/1\/stats$/);
 assert.match(en.item.attributes.levelStats[1].stats[0],/Electricity/);
 const fr=mergedDetail(data,f.id,{locale:'fr'});assert.equal(fr.item.attributes.deep.modes[0].name,'Primary');assert.equal(fr.fields.find(f=>f.field==='attributes.deep.modes').localization.fallback,true);
 const source=(await f.read('plus/ExportWeapons.json')).hash;
 f.contract.fields.push({key:'label',path:'custom.label',type:'string',label:'标签',kinds:['*']});f.docs.get('plus/ExportWeapons.json')[f.id].label='/Language/Description';
 const hash=(await f.read('plus/ExportWeapons.json')).hash;
 const patched=await buildMerged({...f,overrides:{version:1,entries:[{entityId:f.id,field:'custom.label',value:'审核值',reason:'人工审阅',expectedSourceHash:hash}]}});
 assert.equal(mergedDetail(patched,f.id,{locale:'en'}).fields.find(f=>f.field==='custom.label').value,'审核值');
 assert.equal(source.length,64);
});
test('颜色后缀伤害标记使用真实图标；未知标记及嵌套中文不吞字，安全应用带特殊字符的字段路径',()=>{
 const cases=['+60% <DT_ELECTRICITY_COLOR>电击伤害','中文<DT_FIRE_COLOR>火焰<UNKNOWN>说明','<DT_DEFAULT_COLOR>保留未知'];
 for(const value of cases)assert.deepEqual([...plainGameText(value).matchAll(/[\u3400-\u9fff]/g)].map(m=>m[0]),[...value.matchAll(/[\u3400-\u9fff]/g)].map(m=>m[0]));
 assert.equal(inlineText.parse('<DT_ELECTRICITY_COLOR>')[0].kind,'icon');assert.match(inlineText.parse('<DT_ELECTRICITY_COLOR>')[0].image,/\.png$/);assert.equal(inlineText.parse('<DT_DEFAULT_COLOR>')[0].kind,'unknown');
 const item={attributes:{map:{'a.b':{description:'old'}}}};assert.equal(applyLocalizedFields(item,{'attributes.map["a.b"].description':{value:'新'}}).attributes.map['a.b'].description,'新');assert.equal(item.attributes.map['a.b'].description,'old');
});

test('混合数组不把另一语言的整段文字误标为请求语言；来源语言未知时显式标记部分原文',()=>{
 const localizer=createTextLocalizer({locales:['zh-CN','en'],priority:['plus'],dictionaries:[{shape:'language',source:'plus',locale:'zh-CN',file:'dict.zh.json',hash:'a'.repeat(64),value:{'/Language/Desc':'字典中文'}}]});
 const source={source:'official',file:'en.json',hash:'b'.repeat(64),pointer:'/0/modes'},value=[{name:'English mode',description:'/Language/Desc'}];
 assert.deepEqual(localizer.candidates('attributes.modes',[{locale:'en',source,value}],'zh-CN'),[]);
 const partial=localizer.candidates('attributes.modes',[{locale:null,source,value}],'zh-CN')[0];assert.equal(partial.partial,true);assert.equal(partial.value[0].description,'字典中文');assert.equal(partial.value[0].name,'English mode');
});
