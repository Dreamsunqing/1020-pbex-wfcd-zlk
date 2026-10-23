import {syndicateTasks,worldStatistics} from '../core/live-state/presentation.mjs';
import { renderGameText } from './game-text.js';
import { decorateImages } from './images.js';
const groups=[['quick','快速入口'],['all','总览'],['missions','任务'],['weekly','周常'],['trade','商店'],['activity','动态']];
const moduleOrder=['goals','fissures','sortie','archonHunt','alerts','invasions','bounties','syndicates','nodeOverrides','nightwave','circuit','conquests','calendar','descents','vaultBonus','voidTraders','primeVaultTraders','dailyDeals','flashSales','market','goals','events','boosters','construction','relayConstruction','synthesis'];
const svgPaths={world:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM3 12h18M12 3c-5 5-5 13 0 18M12 3c5 5 5 13 0 18',sun:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5',moon:'M20 14a8.5 8.5 0 0 1-10-10 8.5 8.5 0 1 0 10 10Z',spark:'m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7Z',target:'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm0 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM12 1v5m0 12v5M1 12h5m12 0h5',calendar:'M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm-2 5h18M8 2v4m8-4v4M7 13h3m4 0h3m-10 4h3',shop:'m3 9 2-6h14l2 6M3 9v11h18V9M3 9c0 4 4 4 4 0 0 4 5 4 5 0 0 4 5 4 5 0 0 4 4 4 4 0M8 20v-6h8v6',arrow:'M4 12h16m-6-6 6 6-6 6',back:'M20 12H4m6-6-6 6 6 6',refresh:'M20 8a8 8 0 1 0 0 8M20 3v5h-5',clock:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4v5l3 2',info:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 7v7m0-10v1'};
function icon(kind='spark'){const node=document.createElementNS('http://www.w3.org/2000/svg','svg');node.setAttribute('viewBox','0 0 24 24');node.setAttribute('fill','none');node.setAttribute('stroke','currentColor');node.setAttribute('stroke-width','1.5');node.setAttribute('stroke-linecap','round');node.setAttribute('stroke-linejoin','round');node.setAttribute('aria-hidden','true');const p=document.createElementNS(node.namespaceURI,'path');p.setAttribute('d',svgPaths[kind] ?? svgPaths.spark);node.append(p);return node;}
const el=(tag,cl,text)=>{const n=document.createElement(tag);if(cl)n.className=cl;if(text!==undefined)renderGameText(n,text,/^h/.test(tag)?'name':'description');return n;};
const button=(text,cl,fn)=>{const n=el('button',cl,text);n.type='button';n.onclick=fn;return n;};
const when=time=>time?new Date(time).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}):'';
function countdown(start,end){const now=Date.now();let left=(Date.parse(start)>now?Date.parse(start):Date.parse(end))-now;if(!Number.isFinite(left))return '';const prefix=Date.parse(start)>now?'还有 ':'';if(left<=0)return '已结束';const m=Math.floor(left/60000),h=Math.floor(m/60),d=Math.floor(h/24);return prefix+(d?`${d}天 ${h%24}时`:h?`${h}时 ${m%60}分`:`${m}分`)+(prefix?'开始':'后结束');}
function nestedCount(row){return (row.rewards?.length??0)+(row.items?.length??0)+(row.terms?.length??0)+(row.steps?.reduce((sum,s)=>sum+(s.terms?.length??0),0)??0);}
export function createLiveStateUI({api,guarded,notify}){
 const $=id=>document.getElementById(id),state={server:'de',group:'quick',query:'',data:null,detail:null,offset:0,filters:{},sequence:0,busy:false,loaded:false,scroll:0,auto:false},cache=new Map();
 let timer=null,rewardDialog=null,bountyDetail=null,newsPage=0;
 const facets={},derivedModules=new Map();let ranks={};try{ranks=JSON.parse(localStorage.getItem('ws-syndicate-ranks')||'{}');if(!ranks||typeof ranks!=='object'||Array.isArray(ranks))ranks={};}catch{}
 const stateGridObserver=new ResizeObserver(entries=>{
   for(const {target,contentRect} of entries){
     const count=target.childElementCount,max=Math.max(1,Math.min(count,Math.floor((contentRect.width+12)/(target.classList.contains('ws-descent-floors')?242:292))));
     // Prefer complete rows (6 cards -> 3 columns), without making prime counts a long single column.
     const candidates=Array.from({length:max},(_,i)=>i+1).filter(n=>n>=Math.ceil(max/2));
     candidates.sort((a,b)=>(Math.ceil(count/a)*a-count)-(Math.ceil(count/b)*b-count)||b-a);
     target.style.gridTemplateColumns=`repeat(${candidates[0]},minmax(0,1fr))`;
   }
 });
 const page=()=> $('world');
 function image(row,card,images){if(row.id||row.icon||row.imageName)images.push({...row,card,label:row.name??row.title});}
 function timeBadge(row){const n=el('span','ws-time');n.dataset.start=row.startsAt??'';n.dataset.end=row.endsAt??'';n.title=[when(row.startsAt),when(row.endsAt)].filter(Boolean).join(' — ');const content=countdown(row.startsAt,row.endsAt);n.hidden=!content;n.append(icon('clock'),document.createTextNode(content));return n;}
 function chips(values){const n=el('div','ws-chips');for(const value of values??[])if(value)n.append(el('span','ws-chip',value));return n;}
 function loot(values,images,full=false){const grid=el('div','ws-loot-grid');for(const row of full?values:values.slice(0,4)){
   const card=el('div','ws-loot');image(row,card,images);card.append(el('strong','ws-loot-name',row.name??row.title),el('span','ws-loot-quantity',(Number.isFinite(row.quantity)?'×'+row.quantity:'')));
   if(Number.isFinite(row.probability))card.append(el('small','ws-probability',(row.probability*100).toFixed(2).replace(/\.00$/,'')+'%'+(row.pool?' · 池 '+row.pool:'')));
   if(row.rarity&&!Number.isFinite(row.probability))card.append(el('small','ws-probability',({COMMON:'常见',UNCOMMON:'罕见',RARE:'稀有',LEGENDARY:'传说'})[row.rarity]??row.rarity));
   if(row.localization==='missing')card.append(el('small','ws-entry-note','译名待补充'));
   if(row.stats?.length)card.append(el('small','ws-item-price',row.stats.join(' · ')));grid.append(card);
 }return grid;}
 function terms(values,full=false){const box=el('div','ws-terms');for(const row of values??[]){const n=el('div','ws-term'+(row.mode==='elite'?' ws-elite':''));if(row.label)n.append(el('span','ws-chip ws-mode-label',row.label));if(row.source)n.title='翻译来源：'+row.source;n.append(el('strong','',row.name));if(row.description&&full)n.append(el('p','',row.description));box.append(n);}return box;}
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
     if(step.terms?.length)content.append(module.id==='conquests'?terms(step.terms,full):full?terms(step.terms,true):chips(step.terms.map(t=>t.name)));li.append(content);steps.append(li);
   }card.append(steps);}
   if(row.sides){const sides=el('div','ws-sides');for(const side of row.sides){const block=el('div','ws-side');block.dataset.faction=side.tone;block.append(el('strong','',side.name),loot(side.rewards,images,true));sides.append(block);}card.append(sides);}
   if(row.terms?.length)card.append(full||module.showTerms?terms(row.terms,true):chips(row.terms.map(t=>t.name)));
   if(row.rewards?.length&&row.collapsedRewards){card.append(button('查看奖励 · '+row.rewards.length+' 项 →','ws-reward-link',()=>openLoot(row.title+' · 奖励',row.rewards)));}
   else if(row.rewards?.length){const heading=el('div','ws-mini-heading',module.id==='circuit'?'本周可选':'奖励 · '+row.rewards.length+' 项');card.append(heading,loot(row.rewards,images,full||module.id==='circuit'));}
   if(row.items?.length){const list=el('div','ws-items');for(const r of full?row.items:row.items.slice(0,3)){
     const child=el('div','ws-shop-item');image(r,child,images);child.append(el('strong','',r.title??r.name));if(r.description&&full)child.append(el('p','ws-description',r.description));if(r.stats?.length)child.append(el('p','ws-item-price',r.stats.join(' · ')));if(r.rewards?.length)child.append(el('small','ws-item-price',r.rewards.length+' 项候选奖励'));if(full&&r.rewards?.length)child.append(loot(r.rewards,images,true));list.append(child);
   }card.append(list);}
   if(row.stats?.length)card.append(chips(row.stats));
   if(Number.isFinite(row.progress)&&row.invasion){const track=el('div','ws-invasion-bar');track.setAttribute('role','img');track.setAttribute('aria-label',row.sides.map((side,i)=>side.name+' '+(i?100-row.progress:row.progress).toFixed(1)+'%').join(' / '));for(const [i,side] of row.sides.entries()){const part=el('span','ws-invasion-part');part.dataset.faction=side.tone;part.style.width=(i?100-row.progress:row.progress)+'%';track.append(part);}const labels=el('div','ws-invasion-labels');for(const [i,side] of row.sides.entries()){const label=el('span','',((i?100-row.progress:row.progress).toFixed(1))+'%');label.dataset.faction=side.tone;labels.append(label);}card.append(labels,track);}
   else if(Number.isFinite(row.progress)){const track=el('progress','ws-progress');track.max=100;track.value=row.progress;track.setAttribute('aria-label',row.note??'进度');card.append(track);}
   if(row.note)card.append(el('p','ws-entry-note',row.note));
   if(full&&row.reference){const reference=el('details','ws-reference');reference.append(el('summary','','映射来源与上游字段'));const pre=el('pre','');pre.textContent=JSON.stringify(row.reference,null,2);reference.append(pre);card.append(reference);}
   if(row.url){try{const u=new URL(row.url);if(['https:','http:'].includes(u.protocol)&&!u.username&&!u.password)card.append(button('阅读公告 ↗','ws-news-link',()=>guarded(()=>api.openDocumentLink(u.href))));}catch{}}
   return card;
 }
 function filteredEntries(module){const f=state.filters[module.id]??'all';return module.entries.filter(row=>(f==='all'||row.kind===f)&&(module.id!=='fissures'||Object.entries(facets).every(([key,value])=>!value||row[key]===value))&&(!state.query||JSON.stringify([row.title,row.subtitle,row.description,row.steps,row.rewards,row.items,row.chips,row.terms]).toLocaleLowerCase().includes(state.query.toLocaleLowerCase())));}
 function renderFilters(module){
   const filter=el('div','ws-module-filters'),modes=el('div','ws-mode-filters');
   for(const [value,label] of module.filters??[]){const b=button(label,(state.filters[module.id]??'all')===value?'selected':'',()=>{state.filters[module.id]=value;state.offset=0;render();});b.setAttribute('aria-pressed',String((state.filters[module.id]??'all')===value));modes.append(b);}filter.append(modes);
   if(module.id==='fissures'&&state.detail){
     const fields=el('div','ws-facet-row');
     for(const [key,label] of [['planet','星球'],['missionType','任务类型'],['era','纪元']]){
       const field=el('label','ws-facet'),select=el('select','');field.append(el('span','',label));select.setAttribute('aria-label',label);
       for(const value of ['',...new Set(module.entries.map(r=>r[key]).filter(Boolean))]){const option=el('option','',value||'全部'+label);option.value=value;select.append(option);}
       select.value=facets[key]??'';field.classList.toggle('is-filtered',!!select.value);select.onchange=()=>{facets[key]=select.value;render();};field.append(select);fields.append(field);
     }
     fields.append(button('重置筛选','ws-filter-reset',()=>{for(const key of Object.keys(facets))delete facets[key];state.filters.fissures='all';render();}));filter.append(fields);
   }
   return filter;
 }
 function ensureRewardDialog(){
   if(!rewardDialog){rewardDialog=el('dialog','ws-reward-dialog');rewardDialog.setAttribute('aria-label','奖励详情');document.body.append(rewardDialog);rewardDialog.addEventListener('click',event=>{if(event.target===rewardDialog)rewardDialog.close();});}
   return rewardDialog;
 }
 function showRewardContent(content,images,scroll=0){
   const dialog=ensureRewardDialog();dialog.replaceChildren(content);if(!dialog.open)dialog.showModal();dialog.scrollTop=scroll;decorateImages(api,images);
 }
 function openBountyRegion(region){bountyDetail={region,category:'all',task:null,tier:0,table:0,pool:0,scroll:0};renderBountyDialog();}
 function choiceTabs(values,selected,change,className='ws-bounty-tabs'){
   const box=el('div',className);for(const [value,label] of values){const b=button(label,value===selected?'selected':'',()=>change(value));b.setAttribute('aria-pressed',String(value===selected));box.append(b);}return box;
 }
 function renderBountyDialog(){
   const d=bountyDetail,{region}=d,images=[],content=el('div','ws-bounty-content'),head=el('div','ws-detail-head');
   const task=d.task;
   if(task)head.append(button('← 返回任务列表','ws-bounty-back',()=>{d.task=null;renderBountyDialog();}));
   head.append(el('h2','',task?task.title:region.title+' · 赏金任务'),button('关闭','ws-dialog-close',()=>rewardDialog.close()));content.append(head);
   if(!task){
     if(region.items.some(i=>i.derived))content.append(el('p','ws-entry-note',state.server==='wg'?'Oracle 按当前服种子复算；国服模型差异待游戏内核对。':'Oracle 按快照种子复算；请在游戏内核对。'));
     const categories=[['all','全部任务'],...['current','location','challenge'].filter(key=>region.items.some(i=>i.category===key)).map(key=>[key,region.items.find(i=>i.category===key).categoryName])];
     content.append(choiceTabs(categories,d.category,value=>{d.category=value;d.scroll=0;renderBountyDialog();}));
     const groups=new Map();for(const item of region.items.filter(i=>d.category==='all'||i.category===d.category)){
       const key=item.category==='location'?item.categoryName+' · '+item.location:item.categoryName;
       if(!groups.has(key))groups.set(key,[]);groups.get(key).push(item);
     }
     for(const [label,items] of groups){const section=el('section','ws-bounty-section');section.append(el('h3','ws-bounty-heading',label+' · '+items.length+' 项'));const grid=el('div','ws-bounty-task-grid');
       for(const item of items){const card=el('article','ws-bounty-task');card.append(el('h3','',item.title));if(item.subtitle)card.append(el('p','ws-entry-subtitle',item.subtitle));if(item.description)card.append(el('p','ws-description',item.description));if(item.stats?.length)card.append(chips(item.stats));
         card.append(button('查看奖励 →','ws-reward-link',()=>{d.scroll=rewardDialog.scrollTop;d.task=item;d.tier=0;d.table=0;d.pool=0;renderBountyDialog();}));grid.append(card);
       }section.append(grid);content.append(section);
     }
     showRewardContent(content,images,d.scroll);return;
   }
   if(task.description)content.append(el('p','ws-description',task.description));
   content.append(chips([task.categoryName,task.derived?'Oracle 推算':null,...task.stats??[]]));
   let tables=task.rewardTables??[],fixed=task.fixed,status=task.rewardStatus,note=task.rewardNote;
   if(task.rewardTiers?.length){
     content.append(choiceTabs(task.rewardTiers.map((tier,index)=>[index,`第 ${tier.tier} 档 · 等级 ${Array.isArray(tier.enemyLevel)?tier.enemyLevel.join('–'):tier.enemyLevel??'待补充'}`]),d.tier,value=>{d.tier=value;d.table=0;d.pool=0;renderBountyDialog();}));
     const tier=task.rewardTiers[d.tier];tables=tier.tables;fixed=tier.fixed;status=tier.status;note=tier.reason??note;
     content.append(chips([tier.stageCount?'任务阶段 '+tier.stageCount:null,tier.masteryReq!==undefined?'段位要求 '+tier.masteryReq:null]));
   }
   if(note)content.append(el('p','ws-entry-note',note));
   if(fixed){const stats=[];if(fixed.xpAmount!==null&&fixed.xpAmount!==undefined)stats.push((fixed.xpItem?.name??'声望')+' '+(Array.isArray(fixed.xpAmount)?fixed.xpAmount.join(' / '):fixed.xpAmount));if(fixed.chemistryAmount)stats.push('好感度 '+fixed.chemistryAmount);if(stats.length){content.append(el('h3','ws-bounty-heading','基础报酬'),chips(stats));}}
   if(tables.length){
     content.append(el('h3','ws-bounty-heading','随机奖励'));
     content.append(el('p','ws-entry-note',status==='unconfirmed'?'轮次未确认，分别展示候选奖励表。':'候选掉落，非全部必得。池号沿用源顺序，尚未对应具体阶段。'));
     const tableLabel=(table,index)=>(table.label??((status==='unconfirmed'?'候选':'当前')+'奖励表'+(/Table([ABC])Rewards$/.exec(table.key??'')?.[1]?' '+/Table([ABC])Rewards$/.exec(table.key)[1]:tables.length>1?' '+(index+1):'')))+(table.status==='missing'?' · 待补充':'');
     content.append(choiceTabs(tables.map((table,index)=>[index,tableLabel(table,index)]),d.table,value=>{d.table=value;d.pool=0;renderBountyDialog();}));
     const table=tables[d.table];
     if(table.label?.includes('钢铁'))content.append(el('p','ws-entry-note','清单单独列出的钢铁之路奖励表；不与任务奖励池混合。'));
     if(table.pools.length){
       content.append(choiceTabs(table.pools.map((pool,index)=>[index,`奖励池 ${pool.index} · ${pool.items.length} 项`]),d.pool,value=>{d.pool=value;renderBountyDialog();},'ws-bounty-tabs ws-pool-tabs'));
       content.append(loot(table.pools[d.pool].items,images,true));
     }else content.append(el('p','ws-empty','奖励表缺失或结构无效，暂无法展示。'));
   }else content.append(el('p','ws-empty','当前没有已确认可用的奖励表。'));
   const reference=el('details','ws-reference');reference.append(el('summary','','映射来源与上游字段'));const pre=el('pre','');pre.textContent=JSON.stringify({task:task.reference,table:tables[d.table]?.source,pool:tables[d.table]?.pools[d.pool]?.source,warnings:tables[d.table]?.warnings},null,2);reference.append(pre);content.append(reference);
   showRewardContent(content,images);
 }
 function renderBountyCards(body,rows,limit){
   body.classList.add('ws-bounty-regions');
   for(const row of rows.slice(0,limit)){
     const card=el('article','ws-entry ws-bounty-region');card.dataset.moduleEntry='bounties';card.dataset.region=row.kind;
     const head=el('div','ws-entry-head');head.append(el('h3','ws-entry-title',row.title));if(row.endsAt)head.append(timeBadge(row));card.append(head);
     if(row.subtitle)card.append(el('p','ws-entry-subtitle',row.subtitle));card.append(chips(row.chips),el('p','ws-description',row.description));
     const preview=el('ul','ws-bounty-preview');for(const task of row.items.slice(0,3))preview.append(el('li','',task.title));card.append(preview);
     card.append(button('查看任务与奖励 · '+row.items.length+' 项 →','ws-reward-link ws-bounty-open',()=>openBountyRegion(row)));body.append(card);
   }
 }
 function openLoot(title,values,note=''){
   const images=[],content=el('div','ws-reward-content'),head=el('div','ws-detail-head');head.append(el('h2','',title),button('关闭','ws-dialog-close',()=>rewardDialog.close()));content.append(head);if(note)content.append(el('p','ws-entry-note',note));content.append(loot(values,images,true));showRewardContent(content,images);
 }
 function openCycle(row){
   const content=el('div','ws-cycle-schedule'),head=el('div','ws-detail-head');head.append(el('h2','',row.title+' · 24小时内每阶段时间'),button('关闭','ws-dialog-close',()=>rewardDialog.close()));content.append(head,el('p','ws-entry-note',(state.data.stale?'快照时间':'当前时间')+'起 24 小时 · '+when(state.data.at)));
   for(const phase of row.timeline??[]){const line=el('div','ws-schedule-row');line.append(el('strong','',phase.name+(phase.current?' · 当前':'')),el('span','',when(phase.startsAt)+' — '+when(phase.endsAt)));content.append(line);}showRewardContent(content,[]);
 }
 const priceText=item=>(item.prices??[]).map(p=>p.amount.toLocaleString('zh-CN')+' '+p.currency).join(' + ');
 function shopItem(item,images){
   const card=el('article','ws-product');image(item,card,images);card.tabIndex=0;card.append(el('strong','',item.name??item.title));
   const hint=el('div','ws-product-hint');if(item.description)hint.append(el('p','',item.description));hint.append(el('strong','',priceText(item)||item.note||'价格待公布'));if(Number.isFinite(item.discount)&&item.discount>0)hint.append(el('small','','优惠 '+item.discount+'%'));card.append(hint);return card;
 }
 function renderShop(body,rows,module,images,full,limit){
   body.classList.add('ws-shop-grid');
   if(module.layout==='sale'){for(const row of rows.slice(0,limit))body.append(shopItem(row,images));return;}
   for(const row of rows){
     if(!full){const card=el('article','ws-entry ws-shop-summary');card.append(el('h3','',row.shopSummary),timeBadge(row));if(row.note)card.append(el('p','ws-entry-note',row.note));card.append(button('查看商品 →','ws-reward-link',()=>openDetail(module)));body.append(card);continue;}
     const section=el('section','ws-shop-section');section.append(el('h3','',row.title),timeBadge(row));if(row.note)section.append(el('p','ws-entry-note',row.note));
     const bundles=row.items?.filter(i=>!i.evergreen&&/(?:组合包|礼包|Pack)/i.test(i.name))??[];
     const categories=[['组合包',bundles],['本期商品',(row.items??[]).filter(i=>!i.evergreen&&!bundles.includes(i))],['常驻商品',(row.items??[]).filter(i=>i.evergreen)]];
     for(const [label,items] of categories)if(items.length){const group=el('section','ws-shop-category');group.append(el('h3','ws-bounty-heading',label+' · '+items.length));const grid=el('div','ws-products'+(label==='组合包'?' ws-bundles':''));for(const item of items)grid.append(shopItem(item,images));group.append(grid);section.append(group);}body.append(section);
   }
 }
 function renderFissures(body,rows){
   body.classList.add('ws-fissure-list');for(const row of rows){const card=el('article','ws-fissure ws-kind-'+row.kind);card.dataset.kind=row.kind;
     const name=el('div','ws-fissure-name');name.append(el('strong','',row.title.split(/[·(（]/)[0].trim()),el('span','ws-planet',row.planet));if(row.missionType&&!(row.kind==='storm'&&row.missionType==='名称待补充'))name.append(el('span','ws-mission-badge ws-color-'+colorIndex(row.missionType),row.missionType));
     const badges=el('div','ws-fissure-badges');badges.append(el('span','ws-era-badge ws-color-'+(row.tier??colorIndex(row.era)),row.era),el('small','',({normal:'始源',hard:'钢铁之路',storm:'九重天'})[row.kind]));card.append(name,badges,timeBadge(row));body.append(card);}
 }
 function colorIndex(value){return [...value??''].reduce((sum,c)=>sum+c.charCodeAt(0),0)%6;}
 function renderSyndicates(body,rows){
   body.classList.add('ws-syndicate-grid');for(const row of rows){const card=el('article','ws-entry ws-syndicate');card.append(el('h3','',row.title));const label=el('label','ws-rank-label','我的等级'),select=el('select','');select.setAttribute('aria-label',row.title+'声望等级');
     for(let n=1;n<=5;n++){const rank=row.ranks?.find(r=>r.level===n),option=el('option','',n+' 级'+(rank?.name?' · '+rank.name:''));option.value=String(n);select.append(option);}select.value=String(ranks[row.tag]??5);select.onchange=()=>{ranks[row.tag]=Number(select.value);localStorage.setItem('ws-syndicate-ranks',JSON.stringify(ranks));render();};label.append(select);card.append(label);
     for(const step of syndicateTasks(row.steps,ranks[row.tag]??5)){const line=el('div','ws-syndicate-task');line.append(el('strong','',step.title),el('span','ws-mission-badge ws-color-'+colorIndex(step.subtitle),step.subtitle),el('small','ws-entry-note','任务档位 '+step.ordinal));card.append(line);}body.append(card);
   }
 }
 function renderCircuit(body,rows,images){
   body.classList.add('ws-circuit-grid');for(const row of rows){const card=el('article','ws-entry ws-circuit');card.append(el('h3','',row.title),timeBadge(row));const line=el('div','ws-circuit-options');line.append(el('span','ws-mini-heading','本周可选'));line.append(loot(row.rewards,images,true));card.append(line);
     if(row.rotation?.matched){card.append(button('第 '+row.rotation.index+' / '+row.rotation.total+' 轮 · 查看后续 →','ws-more',()=>{const imgs=[],content=el('div','ws-rotation'),head=el('div','ws-detail-head');head.append(el('h2','',row.title+' · 轮次推算'),button('关闭','ws-dialog-close',()=>rewardDialog.close()));content.append(head,el('p','ws-entry-note','依据当前服完整选项匹配轮次。后续为规则推算，来源调整后可能变化。'));for(const week of row.rotation.weeks){content.append(el('h3','ws-bounty-heading',(week.offset?'+'+week.offset+' 周':'本周')+' · 第 '+week.index+' 轮'),loot(week.rewards,imgs,true));}showRewardContent(content,imgs);}));}
     body.append(card);
   }
 }
 function openRewardPool(row,difficulty,pool){
   ensureRewardDialog();
   const images=[],content=el('div','ws-reward-content'),head=el('div','ws-detail-head');
   head.append(el('h2','',`${row.title} · ${difficulty} · ${pool.label}`),button('关闭','ws-dialog-close',()=>rewardDialog.close()));
   content.append(head,el('p','ws-entry-note',pool.key==='roathe'?'罗瑟独立掉落候选，与每周楼层奖励分开。':'候选奖励池；不代表本周已选中或玩家已获得的奖励。'));
   if(pool.note)content.append(el('p','ws-entry-note',pool.note));
   content.append(loot(pool.rewards,images,true));
   if(pool.source)content.append(button('查看官方依据 ↗','ws-news-link',()=>guarded(()=>api.openDocumentLink(pool.source))));
   showRewardContent(content,images);
 }
 function renderDescentFloors(body,rows,module,images,full,limit){
   body.classList.add('ws-descent-floors');
   const visible=full?rows:rows.filter(r=>r.difficultyRewards?.normal||r.difficultyRewards?.steel||r.difficultyRewards?.boss);
   for(const row of visible.slice(0,full?limit:Infinity)){
     const card=full?renderEntry(row,module,images,true):el('article','ws-entry');card.dataset.moduleEntry='descents';card.dataset.floor=row.reference?.index??'';
     if(!full)card.append(el('h3','ws-entry-title',row.title));const meta=row.difficultyRewards;if(meta?.checkpoint)card.append(el('span','ws-chip','检查点'));
     const rewards=el('div','ws-descent-rewards');for(const [mode,label] of [['normal','普通'],['steel','钢铁']])if(meta?.[mode]){const pool=meta[mode],action=button(label+' · '+pool.label+' →','ws-reward-link ws-'+mode,()=>openRewardPool(row,label,pool));action.dataset.difficulty=mode;action.dataset.rewardKind='weekly';rewards.append(action);}
     if(meta?.boss){const action=button('罗瑟掉落 · 双难度共用 →','ws-reward-link',()=>openRewardPool(row,'普通 / 钢铁',meta.boss));action.dataset.rewardKind='boss';rewards.append(action);}
     if(!meta?.normal&&!meta?.steel&&full)rewards.append(el('span','ws-entry-note','本层无每周奖励节点'));if(!meta?.verified&&!full)rewards.append(el('span','ws-entry-note',meta?.note??'奖励待核实'));
     card.insertBefore(rewards,card.querySelector('.ws-reference'));body.append(card);
   }
   if(!visible.length)body.append(el('p','ws-empty','奖励规则待核实，请进入完整内容查看楼层任务。'));
 }
 function renderResearchOverview(body,rows){
   for(const row of rows){const card=el('article','ws-entry ws-research-summary'),head=el('div','ws-entry-head');head.append(el('h3','ws-entry-title',row.title),timeBadge(row));card.append(head);const list=el('ol','ws-research-lines');for(const [index,step] of (row.steps??[]).entries()){const line=el('li','ws-research-line');line.append(el('span','ws-step-index',String(index+1)),el('strong','',step.title));const risks=(step.terms??[]).filter(t=>t.mode==='elite'&&t.label==='精英追加风险');if(risks.length){line.append(el('span','ws-elite-label','精英追加风险'));for(const risk of risks){const label=el('span','ws-elite ws-research-risk',risk.name);if(risk.description)label.title=risk.description;line.append(label);}}else line.append(el('small','ws-entry-note','无精英追加风险'));list.append(line);}card.append(list);body.append(card);
   }
 }
 function renderFleets(body,rows){
   body.classList.add('ws-fleets');for(const row of rows){const card=el('article','ws-fleet');card.dataset.faction=row.faction;const head=el('div','ws-entry-head'),copy=el('div','');copy.append(el('small','',row.subtitle),el('h3','ws-entry-title',row.title));head.append(copy,el('strong','ws-fleet-value',Number.isFinite(row.progress)?row.progress.toFixed(2)+'%':'数据未提供'));card.append(head);
     if(Number.isFinite(row.progress)){const track=el('progress','ws-fleet-progress');track.max=100;track.value=row.progress;track.setAttribute('aria-label',row.title+'建造进度 '+row.progress.toFixed(2)+'%');card.append(track);}body.append(card);
   }
 }
 function renderCards(body,rows,module,images,full,limit=Infinity){
   if(module.id==='cycles'){body.append(renderCycles(module));return;}
   if(module.id==='conquests'&&!full){renderResearchOverview(body,rows.slice(0,limit));return;}
   if(module.layout==='fleet'){renderFleets(body,rows);return;}
   if(module.layout==='boosters'){for(const row of rows.slice(0,limit)){const card=renderEntry(row,module,images,full);card.classList.add('ws-booster');card.dataset.boosterStatus=row.status;card.dataset.boosterKind=row.kind;card.dataset.scope=row.scope;body.append(card);}return;}
   if(module.id==='invigorations'){renderInvigorations(body,images);return;}
   if(module.id==='fissures'){renderFissures(body,rows.slice(0,limit));return;}
   if(module.layout==='shop'||module.layout==='sale'){renderShop(body,rows,module,images,full,limit);return;}
   if(module.id==='syndicates'){renderSyndicates(body,rows);return;}
   if(module.id==='circuit'){renderCircuit(body,rows,images);return;}
   if(module.id==='calendar'&&!full){const rewards=rows.filter(r=>r.rewards?.length);body.classList.add('ws-calendar-rewards');for(const row of rewards){const card=el('article','ws-entry');card.append(el('h3','ws-entry-title',row.title),loot(row.rewards,images,true));body.append(card);}return;}
   if(module.id==='bounties'){renderBountyCards(body,rows,limit);return;}
   if(module.layout==='descent-floors'){renderDescentFloors(body,rows,module,images,full,limit);return;}
   if(!module.groupCards){for(const row of rows.slice(0,limit))body.append(renderEntry(row,module,images,full));return;}
   body.classList.add('ws-grouped');
   const buckets=new Map();
   for(const row of rows){const state=row.cardState??{id:'other',label:'其他'};if(!buckets.has(state.id))buckets.set(state.id,{...state,rows:[]});buckets.get(state.id).rows.push(row);}
   for(const bucket of buckets.values()){
     const section=el('section','ws-state-group');section.dataset.cardState=bucket.id;
     const heading=el('div','ws-state-heading');heading.append(el('h3','',bucket.label),el('span','ws-count',String(bucket.rows.length)));section.append(heading);
     const grid=el('div','ws-state-grid');
     for(const row of bucket.rows.slice(0,limit)){const card=renderEntry(row,module,images,full);card.dataset.cardState=bucket.id;grid.append(card);}
     section.append(grid);body.append(section);
   }
 }
 function openDetail(module){state.scroll=page().scrollTop;state.detail=module.id;state.offset=0;render();page().scrollTop=0;}
 function back(){state.detail=null;state.offset=0;render();page().scrollTop=state.scroll;}
 function renderCycles(module){const strip=el('div','ws-cycles');strip.setAttribute('aria-label','区域周期 · 依快照时间与周期规则推算');for(const row of module.entries){const card=el('article','ws-cycle ws-cycle-'+row.tone);card.title='点击查看未来 24 小时 · '+row.basis;card.tabIndex=0;card.setAttribute('role','button');card.onclick=()=>openCycle(row);card.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();openCycle(row);}};card.append(icon(['night','cold','vome'].includes(row.tone)?'moon':row.tone==='day'||row.tone==='warm'?'sun':'spark'));const copy=el('div','ws-cycle-copy');copy.append(el('small','',row.title),el('strong','',row.subtitle),el('span','ws-cycle-next','下一阶段 · '+row.next));card.append(copy,timeBadge(row));strip.append(card);}return strip;}
 function renderModule(module,images){
   const entries=filteredEntries(module);if(!entries.length&&state.query)return null;
   const section=el('section','ws-module'+(module.wide?' ws-wide':''));section.dataset.module=module.id;
   const head=el('div','ws-module-head'),title=el('div','ws-module-title');title.append(icon(module.group==='weekly'?'calendar':module.group==='trade'?'shop':module.group==='activity'?'world':'target'),el('h2','',module.title),el('span','ws-count',module.id==='descents'?entries.length+' 层':String(entries.length)));head.append(title);
   const isLong=!['circuit','syndicates','synthesis'].includes(module.id)&&(module.layout==='shop'||module.id==='calendar'||module.id==='conquests'||entries.length>module.preview||entries.some(r=>nestedCount(r)>4||(r.items?.length??0)>3));
   if(isLong){const action=button(module.id==='alerts'?'完整内容':entries.length>module.preview?'全部 '+entries.length+(module.id==='descents'?' 层':' 项'):'完整内容','ws-more',()=>openDetail(module));action.append(icon('arrow'));head.append(action);}
   section.append(head);
   if(module.filters)section.append(renderFilters(module));
   if(module.note)section.append(el('p','ws-module-note',module.note));
   const body=el('div','ws-module-body ws-layout-'+module.layout);
   if(!entries.length)body.append(el('p','ws-empty',module.empty));else renderCards(body,entries,module,images,module.id==='calendar'||module.layout==='shop'||module.id==='descents'?false:!isLong,module.preview);
   section.append(body);return section;
 }
 function renderDetail(module,images){
   const container=el('div','ws-detail');const head=el('div','ws-detail-head');head.append(button('← 返回世界状态','ws-back',back),el('h2','',module.title));
   const all=filteredEntries(module);head.append(el('span','ws-count',all.length+(module.id==='descents'?' 层':' 项')));container.append(head);
   if(module.filters)container.append(renderFilters(module));
   if(module.note)container.append(el('p','ws-module-note',module.note));
   const body=el('div','ws-detail-grid');if(['alerts','invasions'].includes(module.id))body.classList.add('ws-detail-missions');renderCards(body,module.noPagination?all:all.slice(state.offset,state.offset+24),module,images,true);if(!all.length&&module.id!=='invigorations'&&!module.note?.startsWith('读取'))body.append(el('p','ws-empty',module.empty??'当前快照暂无内容'));container.append(body);
   if(all.length>24&&!module.noPagination){const pager=el('div','ws-pagination');const previous=button('上一页','',()=>{state.offset-=24;render();page().scrollTop=0;});previous.disabled=state.offset===0;const next=button('下一页','',()=>{state.offset+=24;render();page().scrollTop=0;});next.disabled=state.offset+24>=all.length;pager.append(previous,el('span','',`${state.offset+1}–${Math.min(all.length,state.offset+24)} / ${all.length}`),next);container.append(pager);}
   return container;
 }
 function render(){
   const data=state.data;if(!data)return;
   if(rewardDialog?.open)rewardDialog.close();
   stateGridObserver.disconnect();
   $('ws-server-label').textContent=state.server==='de'?'国际服 · DE':'国服 · WG';
   const status=data.kind==='sample'?'离线样本':data.kind==='import'?'导入快照':data.stale?'缓存快照':'实时快照';
   $('ws-status').textContent=status;$('ws-status').classList.toggle('is-live',!data.stale);$('ws-status').classList.toggle('is-stale',data.stale);$('ws-timestamp').textContent='状态时间 '+when(data.sourceTime);$('ws-timestamp').title=data.sourceTime;
   $('ws-date').textContent=new Date(data.sourceTime).toLocaleDateString('zh-CN',{month:'long',day:'numeric',weekday:'long'});
   const banner=$('ws-banner');banner.hidden=!data.stale&&!data.refreshError;banner.textContent=data.refreshError?'刷新失败，保留已有快照 · '+data.refreshError:data.kind==='sample'?'当前为离线样本，刷新获取最新状态。':data.kind==='import'?'正在查看导入快照。':'快照已过期，刷新获取最新状态。';
   $('ws-tabs').replaceChildren(...groups.map(([value,label])=>{const b=button(label,'ws-tab'+(state.group===value?' selected':''),()=>{state.group=value;state.detail=null;state.offset=0;render();});b.setAttribute('aria-pressed',String(state.group===value));const count=value==='quick'?4:data.modules.filter(m=>value==='all'||m.group===value).length;b.append(el('span','',String(count)));return b;}));
   const statistics=$('ws-statistics');statistics.replaceChildren();
   for(const group of worldStatistics(data.modules)){
     const section=el('section','ws-stat-group');section.setAttribute('aria-label',group.label+'统计');section.append(el('small','ws-stat-label',group.label));const metrics=el('div','ws-stat-metrics');
     for(const metric of group.metrics){const action=button('','ws-stat',()=>{const module=data.modules.find(m=>m.id===metric.id);if(!module)return;if(metric.id==='fissures'){for(const key of Object.keys(facets))delete facets[key];state.filters.fissures=metric.filter;}openDetail(module);});action.dataset.stat=metric.id+(metric.filter?'-'+metric.filter:'');action.title=metric.label+' '+metric.value+' '+metric.unit+' · 查看完整内容';action.setAttribute('aria-label',action.title);const value=el('strong','',String(metric.value));value.append(el('small','',metric.unit));action.append(value,el('span','',metric.label));metrics.append(action);}section.append(metrics);statistics.append(section);
   }
   $('ws-source-info').textContent=`${data.diagnostics.normalizers} 个解析模块 · ${data.diagnostics.rawFields} 个上游字段 · ${data.diagnostics.dictionaries.length} 份本地字典／数据`;
   $('ws-diagnostics').textContent=JSON.stringify({source:data.source,sourceTime:data.sourceTime,fetchedAt:data.fetchedAt,hash:data.hash,kind:data.kind,...data.diagnostics},null,2);
   renderNews();
   const content=$('ws-content'),images=[];content.replaceChildren();const detail=data.modules.find(m=>m.id===state.detail)??derivedModules.get(state.detail);
   if(detail)content.append(renderDetail(detail,images));else if(state.group==='quick'){content.append(renderQuick());}else{
     const cycles=data.modules.find(m=>m.id==='cycles');if(cycles&&(state.group==='all'||state.group==='now')&&!state.query)content.append(renderCycles(cycles));
     const grid=el('div','ws-module-grid');
     const order=id=>{const index=moduleOrder.indexOf(id);return index<0?moduleOrder.length:index;};
     for(const module of [...data.modules].sort((a,b)=>order(a.id)-order(b.id))){if(['cycles','events'].includes(module.id)||state.group!=='all'&&module.group!==state.group)continue;const n=renderModule(module,images);if(n)grid.append(n);}if(!grid.childElementCount)grid.append(el('p','ws-empty','没有匹配的状态'));content.append(grid);
   }
   for(const grid of content.querySelectorAll('.ws-state-grid,.ws-bounty-regions,.ws-descent-floors,.ws-calendar-rewards'))stateGridObserver.observe(grid);
   decorateImages(api,images);updateTimes();
 }
 const quickGroups=[
   ['实时',[['alerts','警报任务'],['fissures','虚空裂缝'],['cycles','平原状态']]],
   ['日常',[['arbitration','仲裁'],['incursions','钢铁之路每日突袭'],['syndicates','集团任务'],['bounties','赏金任务'],['sortie','每日突击'],['nightwave','电波任务'],['dailyDeals','每日特惠'],['flashSales','限时商店']]],
   ['周常',[['conquests','科研'],['descents','沉沦之地'],['calendar','1999 日历'],['vaultBonus','宝库奖励'],['circuit','双衍回廊'],['teshin','Teshin 周商品'],['invigorations','活化战甲']]],
   ['阶段性',[['voidTraders','虚空商人'],['primeVaultTraders','Prime 重生']]]
 ];
 function renderQuick(){
   const box=el('div','ws-quick');for(const [label,items] of quickGroups){const section=el('section','ws-quick-section');section.append(el('h2','',label));const grid=el('div','ws-quick-grid');
     for(const [id,title] of items){if(state.query&&!title.toLowerCase().includes(state.query.toLowerCase()))continue;const action=button(title,'ws-quick-link',()=>guarded(()=>openQuick(id,title)));action.dataset.quick=id;action.append(icon('arrow'));grid.append(action);}if(grid.childElementCount){section.append(grid);box.append(section);}
   }return box;
 }
 async function openQuick(id,title){
   const existing=state.data.modules.find(m=>m.id===id);if(existing){openDetail(existing);return;}
   const at=Date.parse(state.data.at),server=state.server,sequence=state.sequence;
   const module={id,title,group:'quick',layout:'tiles',noPagination:true,entries:[],note:''};
   if(id==='invigorations'){module.note='账号相关条件推算；复用推算实验室，不会查询账号。';derivedModules.set(id,module);openDetail(module);return;}
   if(!['arbitration','incursions','teshin'].includes(id)){module.note='当前快照暂无内容。';derivedModules.set(id,module);openDetail(module);return;}
   module.note='读取推算实验室规则…';derivedModules.set(id,module);openDetail(module);
   try{
     if(server!=='de')throw new Error('此推算来源仅验证国际服，国服暂不套用国际服排期。');
     const method={arbitration:'arbitration',incursions:'browseIncursions',teshin:'browseWeekly'}[id],result=await api.call(method,{at,count:id==='arbitration'?24:id==='incursions'?7:8});
     module.note=(state.data.stale?'按快照时间查询 · ':'')+(result.warnings??[]).join('；');
     if(id==='arbitration')module.entries=result.entries.map(r=>({title:[r.name,r.system].filter(Boolean).join(' · '),subtitle:r.missionName??r.missionType,startsAt:r.startsAt,endsAt:r.endsAt}));
     if(id==='incursions')module.entries=result.entries.map(r=>({title:new Date(r.startsAt).toLocaleDateString('zh-CN')+' · '+r.nodes.length+' 个任务',startsAt:r.startsAt,endsAt:r.endsAt,steps:r.nodes.map(n=>({title:[n.name,n.system].filter(Boolean).join(' · '),subtitle:n.missionName,description:n.minLevel!==null?'等级 '+n.minLevel+'–'+n.maxLevel:''}))}));
     if(id==='teshin')module.entries=result.entries.map(r=>({title:r.teshin.label,subtitle:'Teshin 周商品 · 规则推算',startsAt:r.startsAt,endsAt:r.endsAt}));
   }catch(error){module.note=error.message;}
   if(state.sequence===sequence&&state.server===server&&state.detail===id)render();
 }
 let invigForm={username:'',observed:[],target:'current'},invigResult=null,invigPool=null,invigBusy=false;
 function renderInvigorations(body,images){
   body.classList.add('ws-invig-form');const form=el('form','ws-derive-form'),nameLabel=el('label','','游戏名（区分大小写）'),name=el('input','');name.name='username';name.required=true;name.value=invigForm.username;name.placeholder='游戏名，不含 # 编号';name.oninput=()=>{invigForm.username=name.value;invigResult=null;body.querySelector('.ws-invig-offers')?.remove();};nameLabel.append(name);form.append(nameLabel);
   const target=el('select','');for(const [value,label] of [['current','本周'],['next','下周']]){const o=el('option','',label);o.value=value;target.append(o);}target.value=invigForm.target;target.onchange=()=>{invigForm.target=target.value;invigResult=null;render();};target.setAttribute('aria-label','推算周次');form.append(target);
   const historical=el('div','ws-invig-history');for(let index=0;index<3;index++){const select=el('select','');select.setAttribute('aria-label','上一周期战甲 '+(index+1));const empty=el('option','','上一周期战甲 '+(index+1)+'（可选）');empty.value='';select.append(empty);for(const suit of invigPool??[]){const o=el('option','',suit.name??suit.label??suit.key);o.value=suit.key;select.append(o);}select.value=invigForm.observed[index]??'';select.onchange=()=>{invigForm.observed[index]=select.value;invigResult=null;render();};historical.append(select);}form.append(historical);
   if(!invigPool){const load=button('载入战甲选项','',()=>guarded(async()=>{const sequence=state.sequence,pool=await api.call('oracleOptions');if(sequence===state.sequence){invigPool=pool;if(state.detail==='invigorations')render();}}));form.append(load);}
   const submit=el('button','primary',invigBusy?'推算中…':'刷新并查询');submit.type='submit';submit.disabled=invigBusy;form.append(submit);
   form.onsubmit=event=>{event.preventDefault();guarded(async()=>{invigBusy=true;submit.disabled=true;submit.textContent='推算中…';const server=state.server,sequence=state.sequence;try{if(server!=='de')throw new Error('该算法仅验证国际服，国服暂不套用。');const result=await api.call('invigorations',{username:invigForm.username,observedSuitTypes:invigForm.observed.filter(Boolean),target:invigForm.target,at:Date.parse(state.data.at)});if(sequence===state.sequence&&server===state.server)invigResult=result;}finally{invigBusy=false;if(state.detail==='invigorations'&&state.server===server)render();}});};body.append(form);
   if(invigResult){body.append(el('p','ws-entry-note',invigResult.warnings.join('；')));const grid=el('div','ws-invig-offers');for(const offer of invigResult.offers){const row={id:offer.suit.key,title:offer.suit.name??offer.suit.label,startsAt:invigResult.startsAt,endsAt:invigResult.endsAt,terms:[{name:(offer.offensive.name??offer.offensive.label)+' '+(offer.offensive.value??'')+(offer.offensive.unit??'')},{name:(offer.defensive.name??offer.defensive.label)+' '+(offer.defensive.value??'')+(offer.defensive.unit??'')}]};grid.append(renderEntry(row,{id:'invigorations',showTerms:true},images,true));}body.append(grid);}
 }
 function renderNews(){
   let target=$('ws-news');if(!target){target=el('div','ws-news');target.id='ws-news';target.setAttribute('aria-label','新闻公告');document.querySelector('.ws-hero-main').after(target);}
   const rows=state.data?.modules.find(m=>m.id==='events')?.entries??[],pages=Math.ceil(rows.length/3);target.hidden=!pages;if(!pages)return;newsPage%=pages;
   const head=el('div','ws-news-head');head.append(el('small','','新闻公告'),button('‹','',()=>{newsPage=(newsPage-1+pages)%pages;renderNews();}),el('small','',newsPage+1+' / '+pages),button('›','',()=>{newsPage=(newsPage+1)%pages;renderNews();}));target.replaceChildren(head);
   for(const row of rows.slice(newsPage*3,newsPage*3+3)){const action=button(row.title,'ws-news-title',()=>guarded(()=>api.openDocumentLink(row.url)));action.title=row.title;action.disabled=!row.url;target.append(action);}
 }
 const newsTimer=setInterval(()=>{if(page().classList.contains('active')&&!document.querySelector('.ws-hero:hover')&&!document.querySelector('.ws-hero:focus-within')){newsPage++;renderNews();}},9000);
 function updateTimes(){if(state.data?.kind==='network'&&!state.data.stale&&Math.abs(Date.now()-Date.parse(state.data.sourceTime))>=600000){state.data.stale=true;$('ws-status').textContent='缓存快照';$('ws-status').classList.remove('is-live');$('ws-status').classList.add('is-stale');$('ws-banner').hidden=false;$('ws-banner').textContent='快照已过期，刷新获取最新状态。';}for(const n of $('ws-content').querySelectorAll('.ws-time')){const content=countdown(n.dataset.start,n.dataset.end);n.lastChild.textContent=content;n.hidden=!content;n.classList.toggle('ended',content==='已结束');}}
 async function load(refresh=false,silent=false){
   const sequence=++state.sequence,server=state.server;state.busy=true;$('ws-refresh').disabled=true;$('ws-refresh').classList.toggle('loading',true);$('ws-content').setAttribute('aria-busy','true');
   try{const data=await api.call('liveState',{server,refresh});cache.set(server,data);if(sequence!==state.sequence)return;state.data=data;derivedModules.clear();invigResult=null;state.loaded=true;render();if(refresh&&!silent)notify(data.refreshError?'刷新失败，保留已有快照':'世界状态已更新',Boolean(data.refreshError));}
   catch(error){if(sequence!==state.sequence)return;if(!state.data)$('ws-content').replaceChildren(el('p','ws-empty',error.message));throw error;}
   finally{if(sequence===state.sequence){state.busy=false;$('ws-refresh').disabled=false;$('ws-refresh').classList.remove('loading');$('ws-content').setAttribute('aria-busy','false');}}
 }
 async function enter(){if(!state.loaded)await load();}
 function reset(){derivedModules.clear();invigPool=null;invigResult=null;invigForm.observed=[];state.loaded=false;cache.clear();state.sequence++;state.data=null;state.detail=null;state.busy=false;$('ws-refresh').disabled=false;$('ws-refresh').classList.remove('loading');if(page().classList.contains('active'))guarded(()=>load());}
 $('ws-refresh').append(icon('refresh'),document.createTextNode('刷新世界状态'));$('ws-refresh').onclick=()=>guarded(()=>load(true));
 for(const n of document.querySelectorAll('[data-ws-server]'))n.onclick=()=>guarded(async()=>{if(state.server===n.dataset.wsServer)return;state.sequence++;derivedModules.clear();invigResult=null;state.server=n.dataset.wsServer;state.detail=null;state.offset=0;state.data=cache.get(state.server)??null;for(const b of document.querySelectorAll('[data-ws-server]')){b.classList.toggle('selected',b.dataset.wsServer===state.server);b.setAttribute('aria-pressed',String(b.dataset.wsServer===state.server));}if(state.data)render();else {$('ws-server-label').textContent=state.server==='de'?'国际服 · DE':'国服 · WG';$('ws-status').textContent='读取中';$('ws-timestamp').textContent='';$('ws-date').textContent='';$('ws-banner').hidden=true;$('ws-content').replaceChildren(el('p','ws-empty','正在读取状态…'));}await load();});
 let searchTimer; $('ws-search').oninput=()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>{state.query=$('ws-search').value.trim();state.offset=0;render();},150);};
 $('ws-import').onclick=()=>guarded(async()=>{if(state.busy)return;const sequence=++state.sequence,server=state.server;const data=await api.importLiveState(server);if(data&&sequence===state.sequence){cache.set(server,data);state.data=data;derivedModules.clear();state.detail=null;render();notify('已导入'+(server==='de'?'国际服':'国服')+'快照');}});
 $('ws-auto').onchange=()=>{state.auto=$('ws-auto').checked;clearInterval(timer);if(state.auto)timer=setInterval(()=>{if(page().classList.contains('active')&&!state.busy)guarded(()=>load(true,true));},60000);};
 const clock=setInterval(()=>{if(page().classList.contains('active'))updateTimes();},30000);window.addEventListener('beforeunload',()=>{clearInterval(clock);clearInterval(newsTimer);clearInterval(timer);stateGridObserver.disconnect();});
 return{state,enter,load,reset,render};
}
