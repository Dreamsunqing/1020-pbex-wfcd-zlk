import {decorateImages} from './images.js';
import {appendMarketLink} from './market-links.js';
const el=(tag,cl,text)=>{const n=document.createElement(tag);if(cl)n.className=cl;if(text!==undefined)n.textContent=text;return n;};
const btn=(text,cl,fn)=>{const n=el('button',cl,text);n.type='button';n.onclick=fn;return n;};
const pct=n=>Number.isFinite(n)?Number(n.toFixed(4))+'%':'—';
export function createDropTablesUI({api,guarded,openLibrary,openWM}){
 const root=document.getElementById('drops'),state={locale:'zh-CN',query:'',section:'',offset:0,seq:0,loaded:false};let timer,dialog,restoreScroll=0;
 const zh=()=>state.locale==='zh-CN';
 const toolbar=el('div','dt-toolbar'),intro=el('div'),heading=el('h1','', '掉落表'),meta=el('p','dt-meta'),search=el('input'),lang=el('select'),sections=el('select'),refresh=btn('刷新','primary',()=>guarded(()=>load(true))),body=el('div','dt-groups'),more=btn('载入更多','dt-more',()=>guarded(()=>load(false,true))),error=el('p','dt-error');
 intro.append(heading,meta);search.type='search';search.placeholder='搜索物品、敌人、地点';search.setAttribute('aria-label','搜索掉落表');for(const [v,t] of [['zh-CN','中文'],['en','English']])lang.append(new Option(t,v));lang.setAttribute('aria-label','掉落表语言');sections.setAttribute('aria-label','掉落表分类');toolbar.append(search,sections,lang,refresh);root.append(intro,toolbar,error,body,more);error.hidden=true;
 const note=el('p','dt-note');root.insertBefore(note,body);
 function close(){dialog?.close();requestAnimationFrame(()=>{root.scrollTop=restoreScroll;});}
 function openRewards(group){
  restoreScroll=root.scrollTop;
  if(!dialog){dialog=el('dialog','dt-dialog');dialog.setAttribute('aria-labelledby','dt-dialog-title');root.append(dialog);dialog.onclose=()=>{root.scrollTop=restoreScroll;};dialog.onclick=e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();}};}
  const head=el('header','dt-dialog-head'),copy=el('div'),title=el('h2','',group.label.text);title.id='dt-dialog-title';copy.append(title,el('small','dt-meta',group.rows.length+(zh()?' 项奖励 / 来源':' rewards / sources')));head.append(copy,btn(zh()?'关闭 · Esc':'Close · Esc','',close));
  const content=el('div','dt-dialog-body'),grid=el('div','dt-rewards');content.append(grid);let offset=0;
  const next=btn(zh()?'更多奖励':'More rewards','dt-more',append);
  function append(){const images=[];for(const row of group.rows.slice(offset,offset+36)){
   const reward=el('article','dt-reward'),subject=el('div','dt-reward-subject'),art=el('div','dt-reward-art'),text=el('div','dt-reward-copy');
   const label=row.label.id?btn(row.label.text+' →','link',()=>guarded(async()=>{close();await openLibrary(row.label.id);})):el('strong','',row.label.text);label.title=row.name;text.append(label);
   const tags=[row.rotationLabel,row.stageLabel].filter(Boolean);if(tags.length)text.append(el('small','dt-tags',tags.join(' · ')));subject.append(art,text);reward.append(subject);
   const chance=el('strong','dt-probability',pct(row.chance));if(Number.isFinite(row.sourceChance)){chance.title=(zh()?'掉落池触发率 ':'Pool rate ')+pct(row.sourceChance)+' × '+(zh()?'池内概率 ':'Within pool ')+pct(row.conditionalChance);reward.append(el('small','dt-condition',(zh()?'触发率 ':'Pool ')+pct(row.sourceChance)+' · '+(zh()?'池内 ':'Within ')+pct(row.conditionalChance)));}
   reward.append(chance);const bar=el('div','dt-bar'),fill=el('span');fill.style.width=Math.max(0,Math.min(100,row.chance??row.conditionalChance??0))+'%';bar.append(fill);reward.append(bar);reward.dataset.rarity=row.rarity;grid.append(reward);
   if(row.label.id)images.push({...row.image,id:row.label.id,card:art,label:row.label.text});
   void appendMarketLink({api,item:{id:row.label.id,title:row.label.text,english:row.english,tradable:row.tradable},container:reward,openWM,guarded,beforeOpen:close});
  }offset+=36;next.hidden=offset>=group.rows.length;void decorateImages(api,images);}
  content.append(next);dialog.replaceChildren(head,content);if(!dialog.open)dialog.showModal();append();
 }
 function renderGroup(group){const card=el('section','dt-group'),open=btn('','dt-group-open',()=>openRewards(group)),copy=el('div'),title=el('h2','',group.label.text),rotations=[...new Set(group.rows.flatMap(r=>[r.rotationLabel,r.stageLabel]).filter(Boolean))];copy.append(title,el('small','dt-tags',rotations.join(' · ')|| (zh()?'静态掉落来源':'Static drop source')));open.append(copy,el('span','dt-count',group.rows.length+(zh()?' 项 →':' entries →')));card.append(open);return card;}
 async function load(refreshData=false,append=false,preserve=false){const seq=++state.seq,offset=append?state.offset:0;refresh.disabled=true;more.disabled=true;error.hidden=true;try{
  const data=await api.call('dropTables',{locale:state.locale,query:state.query,section:state.section,offset,limit:18,refresh:refreshData});if(seq!==state.seq)return;
  if(preserve&&state.loaded&&state.hash===data.hash)return;
  state.loaded=true;state.hash=data.hash;heading.textContent=zh()?'掉落表':'Drop tables';note.textContent=zh()?'官方静态掉落表，不代表当前活动开放。点击来源查看奖励；触发率与池内概率分开保留。':'Official static tables; current availability varies. Open a source for rewards. Pool rate and conditional chance are distinct.';
  meta.textContent=new Date(data.fetchedAt).toLocaleString()+' · '+data.rowCount.toLocaleString()+(zh()?' 条记录 · ':' entries · ')+data.total+(zh()?' 组匹配':' matching groups');refresh.textContent=zh()?'刷新':'Refresh';search.placeholder=zh()?'搜索物品、敌人、地点':'Search item, enemy, location';sections.replaceChildren(new Option(zh()?'全部分类':'All categories',''),...data.sections.map(s=>new Option(s.label,s.id)));sections.value=state.section;
  if(!append){close();body.replaceChildren();}body.append(...data.groups.map(renderGroup));if(!data.total)body.append(el('p','',zh()?'没有匹配结果':'No matches'));state.offset=offset+data.groups.length;more.hidden=!data.hasMore;more.textContent=zh()?'载入更多':'Load more';
 }catch(e){error.textContent=e.message;error.hidden=false;}finally{if(seq===state.seq){refresh.disabled=false;more.disabled=false;}}}
 search.oninput=()=>{clearTimeout(timer);state.query=search.value;timer=setTimeout(()=>void load(),200);};sections.onchange=()=>{state.section=sections.value;void load();};lang.onchange=()=>{state.locale=lang.value;void load();};return {state,load,async enter(){await load(false,false,true);}};
}
