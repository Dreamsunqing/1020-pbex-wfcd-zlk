import {allItems} from './merge/repository.mjs';
import {selectLocalizedField} from './text-localization.mjs';
import {plainGameText} from './inline-tokens.mjs';
import terms from '../data/drop-terms.json' with {type:'json'};
import {wikiRecords} from './merge/ability-links.mjs';
import {relicIdentity} from './player-relics.mjs';
export const dropNameKey=v=>plainGameText(String(v??'').replace(/^<ARCHWING>\s*/i,''),'name').normalize('NFKC').replace(/[’]/g,"'").replace(/\s+/g,' ').trim().toLowerCase();
const norm=dropNameKey;
const cache=new WeakMap(), identityCache=new WeakMap();
const field=(data,i,k,l)=>selectLocalizedField(data,i.id,'attributes.'+k,l)?.value??i.attributes?.[k];
export function officialDropIdentities(data){
 if(data.output['player/drop-identities.json'])return data.output['player/drop-identities.json'];
 if(identityCache.has(data.output))return identityCache.get(data.output);
 const ids={};for(const f of data.output['reports/coverage.json']?.files??[]){if(!/\/extras\/wiki\/Mods\.lua$/.test(f.file))continue;const raw=data.output[f.reference];if(typeof raw!=='string')continue;for(const {value}of wikiRecords(raw))if(value.Name){const key=norm(value.Name);(ids[key]??=[]).push(value.InternalName);}}
 identityCache.set(data.output,ids);return ids;
}
function term(value,locale){if(locale==='en')return value;const rows=terms[norm(value)]??[],values=new Set(rows.map(r=>r.zh));return values.size===1?[...values][0]:null;}
export function dropNameIndex(data){if(cache.has(data.output))return cache.get(data.output);const names=new Map(),nodes=new Map();for(const item of allItems(data)){const en=item.name?.en;if(!en)continue;const target=item.kind==='region'?nodes:names,key=norm(en);if(!target.has(key))target.set(key,[]);target.get(key).push(item);}const result={names,nodes};cache.set(data.output,result);return result;}
export function dropLocation(data,value,locale='zh-CN'){
 const event=/^Event:\s*/i.test(value),raw=value.replace(/^Event:\s*/i,''),slash=raw.indexOf('/');if(slash<1)return null;
 const planet=raw.slice(0,slash),tail=raw.slice(slash+1).trim(),conditions=[];let name=tail,extra=false;
 if(/\s+Extra$/i.test(name)){extra=true;name=name.replace(/\s+Extra$/i,'');}
 // Remove trailing, balanced condition groups; a leading (Variant) belongs to
 // the mode qualifier rather than making the location parser fail.
 while(/\s+\([^()]*\)$/.test(name)){const match=/\s+\(([^()]*)\)$/.exec(name);conditions.unshift(match[1]);name=name.slice(0,match.index);}
 const variant=/^(?:\(Variant\)|Variant)\s+/i.test(name);name=name.replace(/^(?:\(Variant\)|Variant)\s+/i,'');
 const {nodes}=dropNameIndex(data),matches=(nodes.get(norm(name))??[]).filter(i=>{const system=norm(field(data,i,'systemName','en'));return system===norm(planet)||i.id.startsWith('wf:region/CrewBattleNode')&&system===norm(planet+' Proxima');});
 let item=matches.length===1?matches[0]:null;
 for(let count=conditions.length;count>0;count--){const full=name+conditions.slice(0,count).map(c=>' ('+c+')').join(''),exact=(nodes.get(norm(full))??[]).filter(i=>norm(field(data,i,'systemName','en'))===norm(planet));if(exact.length===1||term(full,'zh-CN')){item=exact.length===1?exact[0]:null;name=full;conditions.splice(0,count);break;}}
 const translatedName=item?(item.name?.[locale]??item.name?.en):term(name,locale)??(norm(name)==='lunaro arena'?term('Lunaro',locale):null)??name;
 const translatedPlanet=item?field(data,item,'systemName',locale):term(planet,locale)??planet;
 const translateCondition=c=>term(c,locale)??(locale==='en'?c:c.replace(/Resource Cache/gi,'资源储藏舱').replace(/Caches/gi,'缓存箱'));
 const parts=[event?(locale==='en'?'Event':'活动'):null,translatedPlanet,variant?(locale==='en'?'Variant':'变体'):null,translatedName,...conditions.map(translateCondition),extra?(locale==='en'?'Extra':'额外奖励'):null].filter(Boolean);
 if(!item&&locale!=='en'&&translatedPlanet===planet&&translatedName===name&&conditions.every(c=>translateCondition(c)===c))return null;
 // Historical event entries and planet mismatches must not become current-node links.
 const unmapped=[...(!item&&!term(name,'zh-CN')?[{field:'node-or-mode',value:name,reason:'No exact node in this planet or unambiguous official term'}]:[]),...conditions.filter(c=>!term(c,'zh-CN')&&translateCondition(c)===c).map(value=>({field:'condition',value,reason:'No official phrase mapping'}))];
 return {...(item&&!event?{id:item.id}:{}),text:parts.join(' · '),...(unmapped.length?{unmapped}:{}),...(!item?{unresolved:['node-id'],basis:'partial-official-terms'}:{basis:'exact-node-and-planet'})};
}
export function dropLabel(data,value,locale='zh-CN',domain='auto'){
 const location=dropLocation(data,value,locale);if(location)return location;
 const {names,nodes}=dropNameIndex(data),all=names.get(norm(value))??nodes.get(norm(value))??[],matches=all.filter(i=>domain==='enemy'?i.kind==='enemy':domain==='reward'?!['enemy','region','mission-type','faction','ability','mod-set','challenge','conquest','calendar'].includes(i.kind):!all.some(a=>!['mission-type','faction'].includes(a.kind))||!['mission-type','faction'].includes(i.kind)),translated=matches.map(i=>i.name?.[locale]).filter(Boolean);
 let chosen=matches.length===1?matches[0]:null;
 const exactIds=officialDropIdentities(data)[norm(value)]??[];const reviewed=matches.filter(i=>exactIds.includes(i.id));if(reviewed.length===1)chosen=reviewed[0];
 if(matches.length&&matches.every(i=>relicIdentity(i)?.key===relicIdentity(matches[0])?.key)&&relicIdentity(matches[0]))chosen=matches.find(i=>relicIdentity(i).quality==='Bronze')??(matches.length===1?matches[0]:null);
 if(chosen)return {text:locale==='en'?value:plainGameText(chosen.name?.[locale]??value,'name'),id:chosen.id,basis:reviewed.length===1?'wiki-explicit-internal-id':'exact-name-or-relic-family'};
 if(locale==='en')return {text:value,...(matches.length?{candidates:matches.map(i=>i.id)}:{})};
 if(translated.length===matches.length&&new Set(translated).size===1&&translated.length)return {text:plainGameText(translated[0],'name'),...(matches.length===1?{id:matches[0].id}:{}),candidates:matches.map(i=>i.id)};
 const numbered=/^([\d,]+)(?:X\s*|\s+)(.+)$/.exec(value);if(numbered){const translated=dropLabel(data,numbered[2],locale,domain);return {...translated,text:numbered[1]+' × '+translated.text};}
 const relic=/^(Lith|Meso|Neo|Axi|Requiem) (.+?) Relic(?: \((Intact|Exceptional|Flawless|Radiant)\))?$/.exec(value);if(relic)return {text:({Lith:'古纪',Meso:'前纪',Neo:'中纪',Axi:'后纪',Requiem:'安魂'})[relic[1]]+' '+relic[2]+' 遗物'+(relic[3]?' · '+({Intact:'完整',Exceptional:'无暇',Flawless:'良好',Radiant:'光辉'})[relic[3]]:'')};
 const words={'Region Resource':'地区资源','Credits Cache':'现金奖励',Credits:'现金',Caches:'缓存箱',Arbitrations:'仲裁',Sortie:'每日突击',Endo:'内融核心',Kuva:'赤毒','Final stage':'最终阶段','Cetus Bounty':'希图斯赏金','Orb Vallis Bounty':'奥布山谷赏金','Cambion Drift Bounty':'魔胎之境赏金','Zariman Bounty':'扎里曼赏金','Entrati Lab Bounty':'英择谛实验室赏金','WF1999 Bounty':'1999 赏金'};
 let text=value;for(const [en,zh] of Object.entries(words))text=text.replaceAll(en,zh);text=text.replace(/^Level\s+/,'等级 ').replace(/^Rotation /,'轮次 ').replace(/Stage /g,'阶段 ').replace(/Extra$/,'额外奖励');return {text,untranslated:text===value};
}
