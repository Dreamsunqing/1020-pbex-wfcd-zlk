import {allItems} from './merge/repository.mjs';
import {selectLocalizedField} from './text-localization.mjs';
import {plainGameText} from './inline-tokens.mjs';
export const dropNameKey=v=>plainGameText(String(v??'').replace(/^<ARCHWING>\s*/i,''),'name').normalize('NFKC').replace(/[’]/g,"'").replace(/\s+/g,' ').trim().toLowerCase();
const norm=dropNameKey;
const cache=new WeakMap();
const field=(data,i,k,l)=>selectLocalizedField(data,i.id,'attributes.'+k,l)?.value??i.attributes?.[k];
export function dropNameIndex(data){if(cache.has(data.output))return cache.get(data.output);const names=new Map(),nodes=new Map();for(const item of allItems(data)){const en=item.name?.en;if(!en)continue;const target=item.kind==='region'?nodes:names,key=norm(en);if(!target.has(key))target.set(key,[]);target.get(key).push(item);}const result={names,nodes};cache.set(data.output,result);return result;}
export function dropLocation(data,value,locale='zh-CN'){
 const node=/^([^/]+)\/([^()]+?)(?:\s*\(([^()]*)\))?(?:\s+(Extra))?$/.exec(value);if(!node)return null;
 const {nodes}=dropNameIndex(data),matches=(nodes.get(norm(node[2]))??[]).filter(i=>{const system=norm(field(data,i,'systemName','en'));return system===norm(node[1])||i.id.startsWith('wf:region/CrewBattleNode')&&system===norm(node[1]+' Proxima');});
 if(matches.length!==1)return null;const item=matches[0],condition=node[3]??'',missions={Survival:'生存',Defense:'防御',Exterminate:'歼灭',Capture:'捕获',Rescue:'救援',Spy:'间谍',Sabotage:'破坏',Interception:'拦截',Disruption:'中断',Excavation:'挖掘',Defection:'叛逃',Assassination:'刺杀',Volatile:'爆发',Orphix:'奥影',Skirmish:'前哨战'};
 const extras=locale==='en'?condition:missions[condition]??(norm(condition)===norm(field(data,item,'missionName','en'))?field(data,item,'missionName',locale):condition.replace(/Resource Cache/gi,'资源储藏舱').replace(/Caches/gi,'缓存箱'));
 // Condition belongs to the drop entry, not the node's default mission type.
 return {id:item.id,text:[field(data,item,'systemName',locale),item.name?.[locale]??item.name?.en,extras, node[4]?.trim()].filter(Boolean).join(' · ')};
}
export function dropLabel(data,value,locale='zh-CN',domain='auto'){
 if(locale==='en')return {text:value};const location=dropLocation(data,value,locale);if(location)return location;
 const {names,nodes}=dropNameIndex(data),all=names.get(norm(value))??nodes.get(norm(value))??[],matches=all.filter(i=>domain==='enemy'?i.kind==='enemy':domain==='reward'?!['enemy','region','mission-type','faction','ability','mod-set','challenge','conquest','calendar'].includes(i.kind):!all.some(a=>!['mission-type','faction'].includes(a.kind))||!['mission-type','faction'].includes(i.kind)),translated=matches.map(i=>i.name?.[locale]).filter(Boolean);
 if(translated.length===matches.length&&new Set(translated).size===1&&translated.length)return {text:plainGameText(translated[0],'name'),...(matches.length===1?{id:matches[0].id}:{}),candidates:matches.map(i=>i.id)};
 const numbered=/^([\d,]+)(?:X\s*|\s+)(.+)$/.exec(value);if(numbered){const translated=dropLabel(data,numbered[2],locale,domain);return {...translated,text:numbered[1]+' × '+translated.text};}
 const relic=/^(Lith|Meso|Neo|Axi|Requiem) (.+?) Relic(?: \((Intact|Exceptional|Flawless|Radiant)\))?$/.exec(value);if(relic)return {text:({Lith:'古纪',Meso:'前纪',Neo:'中纪',Axi:'后纪',Requiem:'安魂'})[relic[1]]+' '+relic[2]+' 遗物'+(relic[3]?' · '+({Intact:'完整',Exceptional:'无暇',Flawless:'良好',Radiant:'光辉'})[relic[3]]:'')};
 const words={'Region Resource':'地区资源','Credits Cache':'现金奖励',Credits:'现金',Caches:'缓存箱',Arbitrations:'仲裁',Sortie:'每日突击',Endo:'内融核心',Kuva:'赤毒','Final stage':'最终阶段','Cetus Bounty':'希图斯赏金','Orb Vallis Bounty':'奥布山谷赏金','Cambion Drift Bounty':'魔胎之境赏金','Zariman Bounty':'扎里曼赏金','Entrati Lab Bounty':'英择谛实验室赏金','WF1999 Bounty':'1999 赏金'};
 let text=value;for(const [en,zh] of Object.entries(words))text=text.replaceAll(en,zh);text=text.replace(/^Level\s+/,'等级 ').replace(/^Rotation /,'轮次 ').replace(/Stage /g,'阶段 ').replace(/Extra$/,'额外奖励');return {text,untranslated:text===value};
}
