import {sha256} from './io.mjs';
import {dropLabel} from './drop-localization.mjs';
export const DROP_URL='https://warframe.com/droptables';
export const DROP_SECTIONS={missionRewards:'任务',relicRewards:'虚空遗物',keyRewards:'钥匙任务',transientRewards:'动态地点',sortieRewards:'每日突击',cetusRewards:'希图斯赏金',solarisRewards:'奥布山谷赏金',deimosRewards:'魔胎之境赏金',zarimanRewards:'扎里曼赏金',entratiLabRewards:'实验室赏金',hexRewards:'1999 赏金',modByAvatar:'敌人 Mod',modByDrop:'Mod 来源',blueprintByAvatar:'敌人蓝图与物品',blueprintByDrop:'蓝图与物品来源',resourceByAvatar:'敌人资源',resourceByDrop:'资源来源',sigilByAvatar:'敌人纹章',additionalItemByAvatar:'敌人额外物品',relicByAvatar:'敌人遗物'};
const EN_SECTIONS=['Missions','Void relics','Key missions','Transient locations','Sorties','Cetus bounties','Orb Vallis bounties','Cambion Drift bounties','Zariman bounties','Entrati Lab bounties','1999 bounties','Enemy Mods','Mod sources','Enemy blueprints and items','Blueprint and item sources','Enemy resources','Resource sources','Enemy sigils','Enemy additional items','Enemy relics'];
const decode=text=>text.replace(/<[^>]*>/g,' ').replace(/&#(x[\da-f]+|\d+);/gi,(_,n)=>{const v=n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n);return v>0&&v<=0x10ffff?String.fromCodePoint(v):'�';}).replace(/&(amp|lt|gt|quot|apos|nbsp);/g,(_,n)=>({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '})[n]).replace(/\s+/g,' ').trim();
const percent=text=>{const m=/(\d+(?:\.\d+)?)\s*%/.exec(text);return m?Number(m[1]):null;};
export function parseDropTables(html,{fetchedAt=new Date().toISOString()}={}){
 if(typeof html!=='string'||html.length>32*1024*1024)throw new Error('掉落表文件无效或过大');
 const groups=[];let section='',group=null,rotation='',stage='';
 for(const token of html.matchAll(/<h3\b[^>]*id=["']([^"']+)["'][^>]*>[\s\S]*?<\/h3>|<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){
  if(token[1]){section=token[1];group=null;rotation='';stage='';continue;}if(!DROP_SECTIONS[section])continue;
  const cells=[...token[2].matchAll(/<(th|td)\b[^>]*>([\s\S]*?)<\/\1>/gi)].map(m=>({header:m[1].toLowerCase()==='th',text:decode(m[2])}));const heads=cells.filter(c=>c.header&&c.text).map(c=>c.text);
  if(heads.length){const h=heads[0];if(h==='Source'&&heads.at(-1)==='Chance')continue;if(/^Rotation\b/i.test(h)){rotation=h;stage='';continue;}if(/^(?:Stage|Final stage)\b/i.test(h)){stage=h;continue;}
   group={id:section+':'+groups.length,section,title:h,sourceChance:heads[1]?.includes('Drop Chance:')?percent(heads[1]):null,rows:[]};groups.push(group);rotation='';stage='';continue;}
  if(!group)continue;const values=cells.map(c=>c.text).filter(Boolean);if(values.length<2)continue;const conditional=percent(values.at(-1));if(conditional===null)continue;
  const reverse=section.endsWith('ByDrop'),trigger=reverse?percent(values[1]):group.sourceChance;
  // Resource pool activation may exceed 100% (multiple rolls); preserve that
  // rate separately instead of presenting >100% as a final probability.
  const chance=trigger===null?conditional:trigger<=100?trigger*conditional/100:null;
  group.rows.push({name:values[0],rotation,stage,chance,conditionalChance:conditional,sourceChance:trigger,rarity:values.at(-1).replace(/\s*\([^)]*\)\s*$/,'')});
 }
 const valid=groups.filter(g=>g.rows.length);if(valid.length<1)throw new Error('掉落表格式已变化，未找到有效奖励；保留旧快照');
 return {schemaVersion:1,parserVersion:1,url:DROP_URL,fetchedAt,hash:sha256(html),groups:valid,rowCount:valid.reduce((s,g)=>s+g.rows.length,0)};
}
export function dropTablePage(snapshot,data,{locale='zh-CN',query='',section='',offset=0,limit=30}={}){
 if(!['zh-CN','en'].includes(locale)||typeof query!=='string'||query.length>500||!Number.isInteger(offset)||offset<0||!Number.isInteger(limit)||limit<1||limit>60)throw new Error('掉落表查询参数无效');
 const titleDomain=g=>g.section.endsWith('ByDrop')?'reward':g.section.endsWith('ByAvatar')?'enemy':'auto',rowDomain=g=>g.section.endsWith('ByDrop')?'enemy':'reward';
 const q=query.trim().toLowerCase(),matches=[];const project=(g,rows)=>({...g,label:dropLabel(data,g.title,locale,titleDomain(g)),rows:rows.map(r=>({...r,label:dropLabel(data,r.name,locale,rowDomain(g)),rotationLabel:dropLabel(data,r.rotation,locale).text,stageLabel:dropLabel(data,r.stage,locale).text}))});
 for(const g of snapshot.groups){if(section&&g.section!==section)continue;const title=dropLabel(data,g.title,locale,titleDomain(g)),all=!q||[g.title,title.text].some(s=>s.toLowerCase().includes(q));const rows=all?g.rows:g.rows.filter(r=>[r.name,dropLabel(data,r.name,locale,rowDomain(g)).text,r.rotation,r.stage].some(s=>s.toLowerCase().includes(q)));if(rows.length)matches.push({...g,rows});}
 return {fetchedAt:snapshot.fetchedAt,hash:snapshot.hash,url:snapshot.url,rowCount:snapshot.rowCount,total:matches.length,offset,hasMore:offset+limit<matches.length,sections:Object.entries(DROP_SECTIONS).map(([id,label],index)=>({id,label:locale==='en'?EN_SECTIONS[index]:label})),groups:matches.slice(offset,offset+limit).map(g=>project(g,g.rows))};
}
