import { renderGameText } from './game-text.js';
import { decorateImages } from './images.js';
const groups=[['all','总览'],['missions','任务'],['weekly','周常'],['trade','商店'],['activity','动态']];
const svgPaths={world:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM3 12h18M12 3c-5 5-5 13 0 18M12 3c5 5 5 13 0 18',sun:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5',moon:'M20 14a8.5 8.5 0 0 1-10-10 8.5 8.5 0 1 0 10 10Z',spark:'m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7Z',target:'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm0 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM12 1v5m0 12v5M1 12h5m12 0h5',calendar:'M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm-2 5h18M8 2v4m8-4v4M7 13h3m4 0h3m-10 4h3',shop:'m3 9 2-6h14l2 6M3 9v11h18V9M3 9c0 4 4 4 4 0 0 4 5 4 5 0 0 4 5 4 5 0 0 4 4 4 4 0M8 20v-6h8v6',arrow:'M4 12h16m-6-6 6 6-6 6',back:'M20 12H4m6-6-6 6 6 6',refresh:'M20 8a8 8 0 1 0 0 8M20 3v5h-5',clock:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4v5l3 2',info:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 7v7m0-10v1'};
function icon(kind='spark'){const node=document.createElementNS('http://www.w3.org/2000/svg','svg');node.setAttribute('viewBox','0 0 24 24');node.setAttribute('fill','none');node.setAttribute('stroke','currentColor');node.setAttribute('stroke-width','1.5');node.setAttribute('stroke-linecap','round');node.setAttribute('stroke-linejoin','round');node.setAttribute('aria-hidden','true');const p=document.createElementNS(node.namespaceURI,'path');p.setAttribute('d',svgPaths[kind] ?? svgPaths.spark);node.append(p);return node;}
const el=(tag,cl,text)=>{const n=document.createElement(tag);if(cl)n.className=cl;if(text!==undefined)renderGameText(n,text,/^h/.test(tag)?'name':'description');return n;};
const button=(text,cl,fn)=>{const n=el('button',cl,text);n.type='button';n.onclick=fn;return n;};
const when=time=>time?new Date(time).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}):'';
function countdown(start,end){const now=Date.now();let left=(Date.parse(start)>now?Date.parse(start):Date.parse(end))-now;if(!Number.isFinite(left))return '';const prefix=Date.parse(start)>now?'还有 ':'';if(left<=0)return '已结束';const m=Math.floor(left/60000),h=Math.floor(m/60),d=Math.floor(h/24);return prefix+(d?`${d}天 ${h%24}时`:h?`${h}时 ${m%60}分`:`${m}分`)+(prefix?'开始':'后结束');}
function nestedCount(row){return (row.rewards?.length??0)+(row.items?.length??0)+(row.terms?.length??0)+(row.steps?.reduce((sum,s)=>sum+(s.terms?.length??0),0)??0);}
export function createLiveStateUI({api,guarded,notify}){
 const $=id=>document.getElementById(id),state={server:'de',group:'all',query:'',data:null,detail:null,offset:0,filters:{},sequence:0,busy:false,loaded:false,scroll:0,auto:false},cache=new Map();
 let timer=null;
 const page=()=> $('world');
 function image(row,card,images){if(row.id||row.icon||row.imageName)images.push({...row,card,label:row.name??row.title});}
 function timeBadge(row){const n=el('span','ws-time');n.dataset.start=row.startsAt??'';n.dataset.end=row.endsAt??'';n.title=[when(row.startsAt),when(row.endsAt)].filter(Boolean).join(' — ');n.append(icon('clock'),document.createTextNode(countdown(row.startsAt,row.endsAt)));return n;}
 function chips(values){const n=el('div','ws-chips');for(const value of values??[])if(value)n.append(el('span','ws-chip',value));return n;}
 function loot(values,images,full=false){const grid=el('div','ws-loot-grid');for(const row of full?values:values.slice(0,4)){
   const card=el('div','ws-loot');image(row,card,images);card.append(el('strong','ws-loot-name',row.name??row.title),el('span','ws-loot-quantity',(row.quantity!==undefined?'×'+row.quantity:'')));
   if(Number.isFinite(row.probability))card.append(el('small','ws-probability',(row.probability*100).toFixed(2).replace(/\.00$/,'')+'%'+(row.pool?' · 池 '+row.pool:'')));
   if(row.stats?.length)card.append(el('small','ws-item-price',row.stats.join(' · ')));grid.append(card);
 }return grid;}
 function terms(values,full=false){const box=el('div','ws-terms');for(const row of values??[]){const n=el('div','ws-term');n.append(el('strong','',row.name));if(row.description)n.append(el('p','',row.description));box.append(n);}return box;}
 function renderEntry(row,module,images,full=false){
   const card=el('article','ws-entry');image(row,card,images);card.dataset.moduleEntry=module.id;
   const head=el('div','ws-entry-head');head.append(el('h3','ws-entry-title',row.title));if(row.endsAt||row.startsAt)head.append(timeBadge(row));card.append(head);
   if(row.subtitle)card.append(el('p','ws-entry-subtitle',row.subtitle));
   if(row.chips?.length)card.append(chips(row.chips));
   if(row.description)card.append(el('p','ws-description',row.description));
   if(row.steps?.length){const steps=el('ol','ws-steps');for(const [index,step] of row.steps.entries()){
     const li=el('li','ws-step');li.append(el('span','ws-step-index',String(index+1)));const content=el('div','ws-step-body');content.append(el('strong','',step.title),el('span','ws-step-subtitle',step.subtitle));
     if(step.description && !step.terms?.length)content.append(el('p','ws-step-note',step.description));
     if(step.detail){const hint=el('span','ws-info-icon','ⓘ');hint.title=step.detail;hint.tabIndex=0;hint.setAttribute('aria-label',step.detail);content.append(hint);}
     if(step.terms?.length)content.append(full?terms(step.terms,true):chips(step.terms.map(t=>t.name)));li.append(content);steps.append(li);
   }card.append(steps);}
   if(row.sides){const sides=el('div','ws-sides');for(const side of row.sides){const block=el('div','ws-side');block.append(el('strong','',side.name),loot(side.rewards,images,true));sides.append(block);}card.append(sides);}
   if(row.terms?.length)card.append(full?terms(row.terms,true):chips(row.terms.map(t=>t.name)));
   if(row.rewards?.length){const heading=el('div','ws-mini-heading',module.id==='circuit'?'本周可选':'奖励 · '+row.rewards.length+' 项');card.append(heading,loot(row.rewards,images,full||module.id==='circuit'));}
   if(row.items?.length){const list=el('div','ws-items');for(const r of full?row.items:row.items.slice(0,3)){
     const child=el('div','ws-shop-item');image(r,child,images);child.append(el('strong','',r.title??r.name));if(r.description&&full)child.append(el('p','ws-description',r.description));if(r.stats?.length)child.append(el('p','ws-item-price',r.stats.join(' · ')));if(r.rewards?.length)child.append(el('small','ws-item-price',r.rewards.length+' 项候选奖励'));if(full&&r.rewards?.length)child.append(loot(r.rewards,images,true));list.append(child);
   }card.append(list);}
   if(row.stats?.length)card.append(chips(row.stats));
   if(Number.isFinite(row.progress)){const track=el('progress','ws-progress');track.max=100;track.value=row.progress;track.setAttribute('aria-label',row.note??'进度');card.append(track);}
   if(row.note)card.append(el('p','ws-entry-note',row.note));
   if(row.url){try{const u=new URL(row.url);if(['https:','http:'].includes(u.protocol)&&!u.username&&!u.password)card.append(button('阅读公告 ↗','ws-news-link',()=>guarded(()=>api.openDocumentLink(u.href))));}catch{}}
   return card;
 }
 function filteredEntries(module){const f=state.filters[module.id]??'all';return module.entries.filter(row=>(f==='all'||row.kind===f)&&(!state.query||JSON.stringify([row.title,row.subtitle,row.description,row.steps,row.rewards,row.items,row.chips,row.terms]).toLocaleLowerCase().includes(state.query.toLocaleLowerCase())));}
 function openDetail(module){state.scroll=page().scrollTop;state.detail=module.id;state.offset=0;render();page().scrollTop=0;}
 function back(){state.detail=null;state.offset=0;render();page().scrollTop=state.scroll;}
 function renderCycles(module){const strip=el('div','ws-cycles');strip.setAttribute('aria-label','区域周期 · 依快照时间与周期规则推算');for(const row of module.entries){const card=el('article','ws-cycle ws-cycle-'+row.tone);card.title='周期推算 · '+row.basis;card.append(icon(['night','cold','vome'].includes(row.tone)?'moon':row.tone==='day'||row.tone==='warm'?'sun':'spark'));const copy=el('div','ws-cycle-copy');copy.append(el('small','',row.title),el('strong','',row.subtitle),el('span','ws-cycle-next','下一阶段 · '+row.next));card.append(copy,timeBadge(row));strip.append(card);}return strip;}
 function renderModule(module,images){
   const entries=filteredEntries(module);if(!entries.length&&state.query)return null;
   const section=el('section','ws-module'+(module.wide?' ws-wide':''));section.dataset.module=module.id;
   const head=el('div','ws-module-head'),title=el('div','ws-module-title');title.append(icon(module.group==='weekly'?'calendar':module.group==='trade'?'shop':module.group==='activity'?'world':'target'),el('h2','',module.title),el('span','ws-count',String(entries.length)));head.append(title);
   const isLong=entries.length>module.preview||entries.some(r=>nestedCount(r)>4||(r.items?.length??0)>3);
   if(isLong){const action=button(entries.length>module.preview?'全部 '+entries.length+' 项':'完整内容','ws-more',()=>openDetail(module));action.append(icon('arrow'));head.append(action);}
   section.append(head);
   if(module.filters){const filter=el('div','ws-module-filters');for(const [value,label] of module.filters){const b=button(label,(state.filters[module.id]??'all')===value?'selected':'',()=>{state.filters[module.id]=value;render();});b.setAttribute('aria-pressed',String((state.filters[module.id]??'all')===value));filter.append(b);}section.append(filter);}
   if(module.note)section.append(el('p','ws-module-note',module.note));
   const body=el('div','ws-module-body ws-layout-'+module.layout);
   if(!entries.length)body.append(el('p','ws-empty',module.empty));else for(const row of entries.slice(0,module.preview))body.append(renderEntry(row,module,images,!isLong));
   section.append(body);return section;
 }
 function renderDetail(module,images){
   const container=el('div','ws-detail');const head=el('div','ws-detail-head');head.append(button('← 返回世界状态','ws-back',back),el('h2','',module.title));
   const all=filteredEntries(module);head.append(el('span','ws-count',all.length+' 项'));container.append(head);
   if(module.note)container.append(el('p','ws-module-note',module.note));
   const body=el('div','ws-detail-grid');for(const row of all.slice(state.offset,state.offset+24))body.append(renderEntry(row,module,images,true));container.append(body);
   if(all.length>24){const pager=el('div','ws-pagination');const previous=button('上一页','',()=>{state.offset-=24;render();page().scrollTop=0;});previous.disabled=state.offset===0;const next=button('下一页','',()=>{state.offset+=24;render();page().scrollTop=0;});next.disabled=state.offset+24>=all.length;pager.append(previous,el('span','',`${state.offset+1}–${Math.min(all.length,state.offset+24)} / ${all.length}`),next);container.append(pager);}
   return container;
 }
 function render(){
   const data=state.data;if(!data)return;
   $('ws-server-label').textContent=state.server==='de'?'国际服 · DE':'国服 · WG';
   const status=data.kind==='sample'?'离线样本':data.kind==='import'?'导入快照':data.stale?'缓存快照':'实时快照';
   $('ws-status').textContent=status;$('ws-status').classList.toggle('is-live',!data.stale);$('ws-status').classList.toggle('is-stale',data.stale);$('ws-timestamp').textContent='状态时间 '+when(data.sourceTime);$('ws-timestamp').title=data.sourceTime;
   $('ws-date').textContent=new Date(data.sourceTime).toLocaleDateString('zh-CN',{month:'long',day:'numeric',weekday:'long'});
   const banner=$('ws-banner');banner.hidden=!data.stale&&!data.refreshError;banner.textContent=data.refreshError?'刷新失败，保留已有快照 · '+data.refreshError:data.kind==='sample'?'当前为离线样本，刷新获取最新状态。':data.kind==='import'?'正在查看导入快照。':'快照已过期，刷新获取最新状态。';
   $('ws-tabs').replaceChildren(...groups.map(([value,label])=>{const b=button(label,'ws-tab'+(state.group===value?' selected':''),()=>{state.group=value;state.detail=null;state.offset=0;render();});b.setAttribute('aria-pressed',String(state.group===value));const count=data.modules.filter(m=>value==='all'||m.group===value).length;b.append(el('span','',String(count)));return b;}));
   for(const [id,title,value,group] of [['missions','裂缝与入侵',data.summary.missions,'missions'],['weekly','周常模块',data.summary.weekly,'weekly'],['trade','交易与特惠',data.summary.trade,'trade']]){const target=$('ws-stat-'+id);target.replaceChildren(el('strong','',String(value)),el('span','',title));target.onclick=()=>{state.group=group;state.detail=null;render();};}
   $('ws-source-info').textContent=`${data.diagnostics.normalizers} 个解析模块 · ${data.diagnostics.rawFields} 个上游字段 · ${data.diagnostics.dictionaries.length} 份本地字典／数据`;
   $('ws-diagnostics').textContent=JSON.stringify({source:data.source,sourceTime:data.sourceTime,fetchedAt:data.fetchedAt,hash:data.hash,kind:data.kind,...data.diagnostics},null,2);
   const content=$('ws-content'),images=[];content.replaceChildren();const detail=data.modules.find(m=>m.id===state.detail);
   if(detail)content.append(renderDetail(detail,images));else{
     const cycles=data.modules.find(m=>m.id==='cycles');if(cycles&&(state.group==='all'||state.group==='now')&&!state.query)content.append(renderCycles(cycles));
     const grid=el('div','ws-module-grid');for(const module of data.modules){if(module.id==='cycles'||state.group!=='all'&&module.group!==state.group)continue;const n=renderModule(module,images);if(n)grid.append(n);}if(!grid.childElementCount)grid.append(el('p','ws-empty','没有匹配的状态'));content.append(grid);
   }
   decorateImages(api,images);updateTimes();
 }
 function updateTimes(){if(state.data?.kind==='network'&&!state.data.stale&&Math.abs(Date.now()-Date.parse(state.data.sourceTime))>=600000){state.data.stale=true;$('ws-status').textContent='缓存快照';$('ws-status').classList.remove('is-live');$('ws-status').classList.add('is-stale');$('ws-banner').hidden=false;$('ws-banner').textContent='快照已过期，刷新获取最新状态。';}for(const n of $('ws-content').querySelectorAll('.ws-time')){const content=countdown(n.dataset.start,n.dataset.end);n.lastChild.textContent=content;n.classList.toggle('ended',content==='已结束');}}
 async function load(refresh=false,silent=false){
   const sequence=++state.sequence,server=state.server;state.busy=true;$('ws-refresh').disabled=true;$('ws-refresh').classList.toggle('loading',true);$('ws-content').setAttribute('aria-busy','true');
   try{const data=await api.call('liveState',{server,refresh});cache.set(server,data);if(sequence!==state.sequence)return;state.data=data;state.loaded=true;render();if(refresh&&!silent)notify(data.refreshError?'刷新失败，保留已有快照':'世界状态已更新',Boolean(data.refreshError));}
   catch(error){if(sequence!==state.sequence)return;if(!state.data)$('ws-content').replaceChildren(el('p','ws-empty',error.message));throw error;}
   finally{if(sequence===state.sequence){state.busy=false;$('ws-refresh').disabled=false;$('ws-refresh').classList.remove('loading');$('ws-content').setAttribute('aria-busy','false');}}
 }
 async function enter(){if(!state.loaded)await load();}
 function reset(){state.loaded=false;cache.clear();state.sequence++;state.data=null;state.detail=null;state.busy=false;$('ws-refresh').disabled=false;$('ws-refresh').classList.remove('loading');if(page().classList.contains('active'))guarded(()=>load());}
 $('ws-refresh').append(icon('refresh'),document.createTextNode('刷新世界状态'));$('ws-refresh').onclick=()=>guarded(()=>load(true));
 for(const n of document.querySelectorAll('[data-ws-server]'))n.onclick=()=>guarded(async()=>{if(state.server===n.dataset.wsServer)return;state.sequence++;state.server=n.dataset.wsServer;state.detail=null;state.offset=0;state.data=cache.get(state.server)??null;for(const b of document.querySelectorAll('[data-ws-server]')){b.classList.toggle('selected',b.dataset.wsServer===state.server);b.setAttribute('aria-pressed',String(b.dataset.wsServer===state.server));}if(state.data)render();else {$('ws-server-label').textContent=state.server==='de'?'国际服 · DE':'国服 · WG';$('ws-status').textContent='读取中';$('ws-timestamp').textContent='';$('ws-date').textContent='';$('ws-banner').hidden=true;$('ws-content').replaceChildren(el('p','ws-empty','正在读取状态…'));}await load();});
 let searchTimer; $('ws-search').oninput=()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>{state.query=$('ws-search').value.trim();state.offset=0;render();},150);};
 $('ws-import').onclick=()=>guarded(async()=>{if(state.busy)return;const sequence=++state.sequence,server=state.server;const data=await api.importLiveState(server);if(data&&sequence===state.sequence){cache.set(server,data);state.data=data;state.detail=null;render();notify('已导入'+(server==='de'?'国际服':'国服')+'快照');}});
 $('ws-auto').onchange=()=>{state.auto=$('ws-auto').checked;clearInterval(timer);if(state.auto)timer=setInterval(()=>{if(page().classList.contains('active')&&!state.busy)guarded(()=>load(true,true));},60000);};
 const clock=setInterval(()=>{if(page().classList.contains('active'))updateTimes();},30000);window.addEventListener('beforeunload',()=>{clearInterval(clock);clearInterval(timer);});
 return{state,enter,load,reset,render};
}
