import { filterOrders, buildWhisper, orderAttributes } from '../core/wm/model.mjs';
import { decorateImages } from './images.js';
import { createRivenUI } from './wm-rivens.js';
const el = (tag, cl, text) => {const n=document.createElement(tag);if(cl)n.className=cl;if(text!==undefined)n.textContent=text;return n;};
const button = (text,cl,fn) => {const n=el('button',cl,text);n.type='button';n.onclick=fn;return n;};
const date = value => value ? new Date(value).toLocaleString('zh-CN',{hour12:false}) : '尚未获取';
const number = value => Number.isFinite(value) ? value.toLocaleString('zh-CN',{maximumFractionDigits:2}) : '—';
const statusNames={ingame:'游戏中',online:'在线',offline:'离线'};
const svg = (tag,attrs={},text) => {const n=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,String(v));if(text!==undefined)n.textContent=text;return n;};
export function createWmUI({api,guarded,notify}) {
 const $=id=>document.getElementById(id);
 const state={loaded:false,item:null,orders:null,stats:null,tab:'orders',mode:'items',setData:null,setSeq:0,suggestions:[],active:-1,searchSeq:0,orderSeq:0,statsSeq:0,offset:0,busy:false,statsBusy:false,window:'90days',statsRank:'',series:{median:true,moving_avg:true,donch:true,candles:false,avg_price:false}};
 const rivens=createRivenUI({api,guarded});
 let timer;
 function context(){return {platform:$('wm-platform').value,crossplay:$('wm-crossplay').checked};}
 function message(node,text,error=false){node.textContent=text;node.classList.toggle('error',error);node.hidden=!text;}
 function meta(result){return `${result.stale?'旧缓存 · ':result.cached?'缓存 · ':''}更新于 ${date(result.fetchedAt)}`;}
 function hideHints(){state.active=-1;$('wm-suggestions').hidden=true;$('wm-search').setAttribute('aria-expanded','false');$('wm-search').removeAttribute('aria-activedescendant');}
 function highlight(){const nodes=$('wm-suggestions').querySelectorAll('[role=option]');nodes.forEach((n,i)=>{n.classList.toggle('active',i===state.active);n.setAttribute('aria-selected',String(i===state.active));});if(state.active>=0){$('wm-search').setAttribute('aria-activedescendant','wm-option-'+state.active);nodes[state.active]?.scrollIntoView({block:'nearest'});}else $('wm-search').removeAttribute('aria-activedescendant');}
 async function search(refresh=false) {
  const query=$('wm-search').value,seq=++state.searchSeq;
  try {
   const data=await api.call('wmSearch',{query,refresh});if(seq!==state.searchSeq)return;
   state.loaded=true;state.suggestions=data.items;state.active=-1;
   $('wm-catalog-meta').textContent=`${data.total.toLocaleString()} 件可交易物品 · ${meta(data)}`;
   message($('wm-catalog-error'),data.error?`目录更新失败：${data.error}，正在使用已有目录。`:'');
   const box=$('wm-suggestions');box.replaceChildren();
   if(!query.trim()){hideHints();return;}
   for(const [i,item] of data.items.entries()) {
    const b=button('','wm-suggestion',()=>guarded(()=>choose(item)));b.id='wm-option-'+i;b.setAttribute('role','option');b.setAttribute('aria-selected','false');b.tabIndex=-1;
    b.append(el('strong','',item.name),el('small','',item.english));box.append(b);
   }
   if(!data.items.length)box.append(el('p','wm-no-hints','没有找到物品，试试英文名或名称的一部分。'));
   box.hidden=false;$('wm-search').setAttribute('aria-expanded','true');
  }catch(error){if(seq!==state.searchSeq)return;hideHints();message($('wm-catalog-error'),error.message+'。可点击“刷新物品目录”重试。',true);}
 }
 function setTab(tab){state.tab=tab;for(const b of document.querySelectorAll('[data-wm-tab]')){b.classList.toggle('selected',b.dataset.wmTab===tab);b.setAttribute('aria-selected',String(b.dataset.wmTab===tab));}$('wm-order-panel').hidden=tab!=='orders';$('wm-stat-panel').hidden=tab!=='statistics';if(tab==='statistics'&&state.item&&!state.stats&&!state.statsBusy)void guarded(()=>loadStats());}
 async function choose(item){
  item=state.setData?.items.find(i=>i.id===item.id)??item;
  clearTimeout(timer);state.searchSeq++;state.orderSeq++;hideHints();state.suggestions=[];state.item=item;state.orders=null;state.stats=null;state.statsSeq++;state.statsBusy=false;state.statsRank='';state.offset=0;
  $('wm-search').value=item.name;$('wm-item').hidden=false;$('wm-welcome').hidden=true;
  const title=el('div','wm-item-heading');title.id='wm-item-heading';$('wm-item-heading').replaceWith(title);title.append(el('h2','',item.name),el('p','muted',item.english));
  if(item.gameRef)void decorateImages(api,[{id:item.gameRef,card:title,label:item.name}]);
  $('wm-item-tags').textContent=[item.maxRank!==null?`最高等级 ${item.maxRank}`:'',...item.tags.slice(0,4)].filter(Boolean).join(' · ');
  const ranks=$('wm-rank');ranks.replaceChildren(new Option('全部等级',''));if(item.maxRank!==null)for(let i=0;i<=item.maxRank;i++)ranks.append(new Option(`等级 ${i}${i===item.maxRank?'（满级）':''}`,String(i)));
  $('wm-rank-label').hidden=item.maxRank===null;
  $('wm-stat-chart').replaceChildren();message($('wm-stat-error'),'');
  void loadSet();setTab(state.tab);await loadOrders();
 }
 function renderSet(){
  const box=$('wm-set-members');box.replaceChildren();const data=state.setData;if(!data)return;
  $('wm-set-meta').textContent=(data.items.length>1?'套装与部件 · ':'此物品没有套装成员 · ')+meta(data);
  message($('wm-set-error'),data.error?`${data.error}；以下为已缓存的套装关系。`:'',!!data.error);
  if(data.items.length<2)return;
  const pictures=[];
  for(const item of data.items){
   const b=button('','wm-set-member',()=>guarded(()=>choose(item)));b.dataset.slug=item.slug;b.classList.toggle('selected',item.id===state.item?.id);b.setAttribute('aria-pressed',String(item.id===state.item?.id));
   b.append(el('strong','',item.name),el('small','',item.setRoot?'整套':item.quantityInSet?`套装需要 ×${item.quantityInSet}`:item.english));box.append(b);
   if(item.gameRef)pictures.push({id:item.gameRef,card:b,label:item.name});
  }
  void decorateImages(api,pictures);
 }
 async function loadSet(refresh=false){
  const seq=++state.setSeq,slug=state.item?.slug;if(!slug)return;
  if(!refresh&&state.setData?.items.some(i=>i.slug===slug)){renderSet();return;}
  state.setData=null;$('wm-set-members').replaceChildren();$('wm-set-meta').textContent='正在读取套装关系…';message($('wm-set-error'),'');$('wm-set-refresh').disabled=true;
  try{const data=await api.call('wmItemSet',{slug,refresh});if(seq!==state.setSeq)return;state.setData=data;renderSet();}
  catch(error){if(seq!==state.setSeq)return;$('wm-set-meta').textContent='套装关系暂不可用';message($('wm-set-error'),error.message+'；仍可搜索物品和查看订单。',true);}
  finally{if(seq===state.setSeq)$('wm-set-refresh').disabled=false;}
 }
 async function loadOrders(refresh=false){
  if(!state.item)return;const seq=++state.orderSeq,slug=state.item.slug,args=context();state.busy=true;$('wm-orders-refresh').disabled=true;
  $('wm-order-list').replaceChildren(el('p','wm-empty','正在读取订单…'));message($('wm-order-error'),'');$('wm-order-meta').textContent='';
  try{const data=await api.call('wmOrders',{slug,...args,refresh});if(seq!==state.orderSeq)return;state.orders=data;state.offset=0;renderOrders();}
  catch(error){if(seq!==state.orderSeq)return;state.orders=null;$('wm-order-list').replaceChildren(el('p','wm-empty','订单暂时不可用，请稍后刷新。'));message($('wm-order-error'),error.message,true);$('wm-previous').disabled=true;$('wm-next').disabled=true;$('wm-order-count').textContent='';}
  finally{if(seq===state.orderSeq){state.busy=false;$('wm-orders-refresh').disabled=false;}}
 }
 function renderOrders(){
  const data=state.orders;if(!data)return;
  $('wm-order-meta').textContent=meta(data);message($('wm-order-error'),data.error?`${data.error}；以下为上次成功获取的订单，复制前请注意更新时间。`:'',!!data.error);
  let rows;try{rows=filterOrders(data.orders,{type:$('wm-order-type').value,status:$('wm-status').value,rank:$('wm-rank').value,min:$('wm-min').value,max:$('wm-max').value,sort:$('wm-sort').value});}
  catch(error){message($('wm-order-error'),error.message,true);rows=[];}
  const box=$('wm-order-list');box.replaceChildren();const size=40;state.offset=Math.min(state.offset,Math.max(0,Math.floor((rows.length-1)/size)*size));
  const table=el('table','wm-orders-table'),head=el('thead'),tr=el('tr');for(const t of ['玩家','在线状态','声望','交易价格','库存数量','物品属性',''])tr.append(el('th','',t));head.append(tr);table.append(head);const body=el('tbody');
  for(const order of rows.slice(state.offset,state.offset+size)){
   const row=el('tr');row.dataset.order=order.id;
   const user=el('td'),name=el('strong','wm-player',order.user.ingameName);user.append(name,el('small','wm-user-platform',order.user.platform.toUpperCase()+(order.user.crossplay?' · 跨平台':'')));
   const status=el('td');status.append(el('span','wm-status-dot '+order.user.status,statusNames[order.user.status]));
   const price=el('td','wm-price');price.append(el('strong','',`${number(order.platinum)} 白金`),el('small','',order.perTrade>1?`每 ${order.perTrade} 件 · 单件 ${number(order.platinum/order.perTrade)}`:'每件'));
   const attributes=el('td','wm-attributes',orderAttributes(order).join(' · ')||'—');if(order.rank!==null&&state.item.maxRank!==null)attributes.textContent=attributes.textContent.replace(`等级 ${order.rank}`,`等级 ${order.rank}/${state.item.maxRank}`);
   const action=el('td');action.append(button(order.type==='sell'?'复制购买私聊':'复制出售私聊','wm-copy small',()=>guarded(async()=>{await api.copy(buildWhisper(data.item,order));notify('已复制，在游戏聊天中粘贴即可联系玩家');})));
   row.append(user,status,el('td','',number(order.user.reputation)),price,el('td','',`${order.quantity}${order.perTrade>1?'（每次 '+order.perTrade+'）':''}`),attributes,action);body.append(row);
  }
  table.append(body);if(rows.length)box.append(table);else box.append(el('p','wm-empty','没有符合条件的订单。可以放宽在线状态、价格或等级筛选。'));
  $('wm-order-count').textContent=`共 ${rows.length.toLocaleString()} 条${rows.length?` · ${state.offset+1}–${Math.min(rows.length,state.offset+size)}`:''} · 单件价按每次交易件数折算`;
  $('wm-previous').disabled=state.offset===0;$('wm-next').disabled=state.offset+size>=rows.length;
 }
 async function loadStats(refresh=false){
  if(!state.item)return;const seq=++state.statsSeq,slug=state.item.slug,platform=context().platform;
  state.statsBusy=true;$('wm-stat-refresh').disabled=true;$('wm-stat-chart').replaceChildren(el('p','wm-empty','正在读取历史统计…'));message($('wm-stat-error'),'');$('wm-stat-meta').textContent='';
  try {
   const data=await api.call('wmStatistics',{slug,platform,refresh});if(seq!==state.statsSeq)return;state.stats=data;
   const ranks=[...new Set(Object.values(data.windows).flat().map(r=>r.rank).filter(r=>r!==null))].sort((a,b)=>a-b),select=$('wm-stat-rank');
   select.replaceChildren();if(ranks.length){for(const rank of ranks)select.append(new Option(`等级 ${rank}`,String(rank)));state.statsRank=ranks.includes(Number(state.statsRank))&&state.statsRank!==''?state.statsRank:String(ranks.includes(0)?0:ranks[0]);select.value=state.statsRank;}
   else{select.append(new Option('上游未区分等级',''));state.statsRank='';}
   $('wm-stat-rank-label').hidden=!ranks.length;renderStats();
  }catch(error){if(seq!==state.statsSeq)return;state.stats=null;$('wm-stat-chart').replaceChildren(el('p','wm-empty','历史统计暂时不可用。'));message($('wm-stat-error'),error.message,true);}
  finally{if(seq===state.statsSeq){state.statsBusy=false;$('wm-stat-refresh').disabled=false;}}
 }
 function renderStats(){
  const data=state.stats;if(!data)return;
  $('wm-stat-meta').textContent=data.fetchedAt?`${meta(data)} · ${data.platform.toUpperCase()} · 旧版统计接口`:'旧版统计接口暂时不可用';
  message($('wm-stat-error'),data.error?`${data.error}${data.stale?'；显示上次成功缓存。':'。订单查询仍可使用。'}`:'',!!data.error);
  const box=$('wm-stat-chart');box.replaceChildren();
  const rows=(data.windows[state.window]??[]).filter(r=>state.statsRank===''?r.rank===null:r.rank===Number(state.statsRank));
  for(const node of document.querySelectorAll('[data-wm-window]')){node.classList.toggle('selected',node.dataset.wmWindow===state.window);node.setAttribute('aria-pressed',String(node.dataset.wmWindow===state.window));}
  const available={median:rows.some(r=>r.median!==null),moving_avg:rows.some(r=>r.moving_avg!==null),avg_price:rows.some(r=>r.avg_price!==null),donch:rows.some(r=>r.donch_top!==null&&r.donch_bot!==null),candles:rows.some(r=>[r.open_price,r.closed_price,r.min_price,r.max_price].every(Number.isFinite))};
  for(const node of document.querySelectorAll('[data-wm-series]')){node.disabled=!available[node.dataset.wmSeries];node.checked=state.series[node.dataset.wmSeries];node.parentElement.title=node.disabled?'上游没有提供此序列':'';}
  if(!data.available){box.append(el('p','wm-empty','暂未取得 WM 历史统计。请稍后重试，或打开 WM 原站查看。'));return;}
  if(!rows.length){box.append(el('p','wm-empty','此时间范围与等级没有历史统计记录。'));return;}
  drawChart(box,rows,available);
 }
 function drawChart(box,rows,available){
  const W=1120,H=530,L=65,R=40,T=28,B=320,VT=365,VB=465,xmin=rows[0].timestamp,xmax=rows.at(-1).timestamp;
  const x=t=>L+(t-xmin)/Math.max(1,xmax-xmin)*(W-L-R);
  const values=rows.flatMap(r=>Object.keys(state.series).flatMap(k=>!state.series[k]||!available[k]?[]:k==='donch'?[r.donch_top,r.donch_bot]:k==='candles'?[r.min_price,r.max_price]:[r[k]])).filter(Number.isFinite);
  let min=values.length?Math.min(...values):0,max=values.length?Math.max(...values):1;const pad=(max-min||Math.max(1,max*.1))*.1;min=Math.max(0,min-pad);max+=pad;
  const y=p=>B-(p-min)/Math.max(.01,max-min)*(B-T),volumeMax=Math.max(1,...rows.map(r=>r.volume??0)),vy=v=>VB-v/volumeMax*(VB-VT);
  const wrap=el('div','wm-chart-wrap'),chart=svg('svg',{viewBox:`0 0 ${W} ${H}`,role:'img','aria-label':'WM 历史价格与已关闭订单数量图'});wrap.append(chart);box.append(wrap);
  for(let i=0;i<=5;i++){const p=min+(max-min)*i/5;chart.append(svg('line',{x1:L,y1:y(p),x2:W-R,y2:y(p),class:'wm-gridline'}),svg('text',{x:L-12,y:y(p)+4,'text-anchor':'end',class:'wm-axis'},number(p)));}
  chart.append(svg('text',{x:L,y:16,class:'wm-axis'},'白金'),svg('text',{x:W-R,y:VT-12,'text-anchor':'end',class:'wm-axis'},'数量'));
  for(let i=0;i<=2;i++){const v=volumeMax*i/2;chart.append(svg('line',{x1:L,y1:vy(v),x2:W-R,y2:vy(v),class:'wm-gridline'}),svg('text',{x:W-R+5,y:vy(v)+4,class:'wm-axis'},number(v)));}
  for(let i=0;i<=6;i++){const t=xmin+(xmax-xmin)*i/6;chart.append(svg('text',{x:x(t),y:VB+28,'text-anchor':'middle',class:'wm-axis'},new Date(t).toLocaleString('zh-CN',state.window==='48hours'?{month:'numeric',day:'numeric',hour:'2-digit'}:{month:'numeric',day:'numeric'})));}
  const groups=(fields)=>{const result=[];let group=[];for(const r of rows){if(fields.every(f=>Number.isFinite(r[f])))group.push(r);else if(group.length){result.push(group);group=[];}}if(group.length)result.push(group);return result;};
  if(state.series.donch&&available.donch)for(const group of groups(['donch_top','donch_bot'])){const points=[...group.map(r=>`${x(r.timestamp)},${y(r.donch_top)}`),...group.slice().reverse().map(r=>`${x(r.timestamp)},${y(r.donch_bot)}`)].join(' ');chart.append(svg('polygon',{points,class:'wm-donch'}));}
  for(const key of ['median','moving_avg','avg_price'])if(state.series[key]&&available[key])for(const group of groups([key])){chart.append(svg('polyline',{points:group.map(r=>`${x(r.timestamp)},${y(r[key])}`).join(' '),class:'wm-line wm-line-'+key}));if(group.length===1)chart.append(svg('circle',{cx:x(group[0].timestamp),cy:y(group[0][key]),r:3,class:'wm-dot-'+key}));}
  const bw=Math.max(1,Math.min(14,(W-L-R)/rows.length*.55));
  for(const r of rows){if(r.volume!==null&&r.volume>=0)chart.append(svg('rect',{x:x(r.timestamp)-bw/2,y:vy(r.volume),width:bw,height:Math.max(0,VB-vy(r.volume)),class:'wm-volume'}));if(state.series.candles&&available.candles&&[r.open_price,r.closed_price,r.min_price,r.max_price].every(Number.isFinite)){const cl=r.closed_price>=r.open_price?'wm-candle-up':'wm-candle-down';chart.append(svg('line',{x1:x(r.timestamp),x2:x(r.timestamp),y1:y(r.max_price),y2:y(r.min_price),class:cl}),svg('rect',{x:x(r.timestamp)-bw/2,y:Math.min(y(r.open_price),y(r.closed_price)),width:bw,height:Math.max(1,Math.abs(y(r.open_price)-y(r.closed_price))),class:cl}));}}
  const cross=svg('line',{y1:T,y2:VB,class:'wm-crosshair',visibility:'hidden'});chart.append(cross);const tip=el('div','wm-chart-tip');tip.hidden=true;wrap.append(tip);
  let index=rows.length-1;
  function inspect(i){index=Math.max(0,Math.min(rows.length-1,i));const row=rows[index];cross.setAttribute('x1',x(row.timestamp));cross.setAttribute('x2',x(row.timestamp));cross.setAttribute('visibility','visible');tip.hidden=false;tip.replaceChildren(el('strong','',date(row.datetime)));const fields=[['median','中间价'],['moving_avg','简单移动平均线'],['avg_price','平均价格'],['open_price','开盘价'],['closed_price','收盘价'],['min_price','最低价'],['max_price','最高价'],['donch_bot','通道下界'],['donch_top','通道上界'],['volume','数量']];for(const [key,label] of fields)if(row[key]!==null)tip.append(el('span','',`${label}：${number(row[key])}`));tip.style.left=(index<rows.length/2?'auto':'12px');tip.style.right=(index<rows.length/2?'12px':'auto');}
  const overlay=svg('rect',{x:L,y:T,width:W-L-R,height:VB-T,fill:'transparent',tabindex:'0',role:'group','aria-label':'价格图，左右方向键查看各时间点'});chart.append(overlay);
  overlay.onpointermove=event=>{const rect=chart.getBoundingClientRect(),tx=(event.clientX-rect.left)/rect.width*W,t=xmin+(tx-L)/(W-L-R)*(xmax-xmin);let nearest=0;for(let i=1;i<rows.length;i++)if(Math.abs(rows[i].timestamp-t)<Math.abs(rows[nearest].timestamp-t))nearest=i;inspect(nearest);};
  overlay.onpointerleave=()=>{tip.hidden=true;cross.setAttribute('visibility','hidden');};overlay.onfocus=()=>inspect(index);overlay.onblur=()=>{tip.hidden=true;cross.setAttribute('visibility','hidden');};overlay.onkeydown=e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();inspect(e.key==='Home'?0:e.key==='End'?rows.length-1:index+(e.key==='ArrowLeft'?-1:1));}};
  const latest=rows.at(-1),summary=el('div','wm-stat-summary');for(const [label,value] of [['记录点',rows.length],['最近中间价',latest.median],['最近平均价',latest.avg_price],['统计数量',rows.reduce((s,r)=>s+(r.volume??0),0)]]){const card=el('div');card.append(el('small','',label),el('strong','',number(value)));summary.append(card);}box.append(summary);
 }
 $('wm-search').oninput=()=>{clearTimeout(timer);state.searchSeq++;state.active=-1;state.suggestions=[];hideHints();timer=setTimeout(()=>void search(),180);};
 $('wm-search').onkeydown=event=>{if(event.key==='Escape'){hideHints();return;}if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();if(state.suggestions.length){$('wm-suggestions').hidden=false;$('wm-search').setAttribute('aria-expanded','true');state.active=(state.active+(event.key==='ArrowDown'?1:-1)+state.suggestions.length)%state.suggestions.length;highlight();}}if(event.key==='Enter'){event.preventDefault();clearTimeout(timer);if(! $('wm-suggestions').hidden&&state.suggestions.length)void guarded(()=>choose(state.suggestions[Math.max(0,state.active)]));else void search();}};
 $('wm-search').onfocus=()=>{if(state.suggestions.length&&$('wm-search').value.trim()){$('wm-suggestions').hidden=false;$('wm-search').setAttribute('aria-expanded','true');}};
 document.addEventListener('pointerdown',event=>{if(!$('wm-search-box').contains(event.target))hideHints();});
 $('wm-catalog-refresh').onclick=()=>guarded(async()=>{const b=$('wm-catalog-refresh');b.disabled=true;try{await search(true);}finally{b.disabled=false;}});
 $('wm-orders-refresh').onclick=()=>guarded(()=>loadOrders(true));$('wm-stat-refresh').onclick=()=>guarded(()=>loadStats(true));
 $('wm-set-refresh').onclick=()=>guarded(()=>loadSet(true));
 for(const b of document.querySelectorAll('[data-wm-mode]'))b.onclick=()=>guarded(async()=>{
  state.mode=b.dataset.wmMode;hideHints();
  for(const n of document.querySelectorAll('[data-wm-mode]')){n.classList.toggle('selected',n===b);n.setAttribute('aria-pressed',String(n===b));}
  $('wm-items-view').hidden=state.mode!=='items';$('wm-rivens-view').hidden=state.mode!=='rivens';
  $('wm-catalog-refresh').hidden=state.mode==='rivens';
  if(state.mode==='rivens')await rivens.enter();
 });
 for(const id of ['wm-order-type','wm-status','wm-rank','wm-sort','wm-min','wm-max'])$(id).addEventListener(['wm-min','wm-max'].includes(id)?'input':'change',()=>{state.offset=0;renderOrders();});
 function pageOrders(delta){state.offset=Math.max(0,state.offset+delta);renderOrders();$('wm-order-list').scrollIntoView({block:'start'});}
 $('wm-previous').onclick=()=>pageOrders(-40);$('wm-next').onclick=()=>pageOrders(40);
 async function changeContext(){state.orderSeq++;state.statsSeq++;state.statsBusy=false;state.stats=null;state.orders=null;$('wm-crossplay').disabled=$('wm-platform').value==='switch';if($('wm-crossplay').disabled)$('wm-crossplay').checked=false;await loadOrders();if(state.tab==='statistics')await loadStats();}
 $('wm-platform').onchange=()=>guarded(changeContext);$('wm-crossplay').onchange=()=>guarded(async()=>{await loadOrders();});
 for(const node of document.querySelectorAll('[data-wm-tab]'))node.onclick=()=>setTab(node.dataset.wmTab);
 for(const node of document.querySelectorAll('[data-wm-window]'))node.onclick=()=>{state.window=node.dataset.wmWindow;renderStats();};
 $('wm-stat-rank').onchange=()=>{state.statsRank=$('wm-stat-rank').value;renderStats();};
 for(const node of document.querySelectorAll('[data-wm-series]'))node.onchange=()=>{state.series[node.dataset.wmSeries]=node.checked;renderStats();};
 $('wm-original').onclick=()=>guarded(()=>api.openDocumentLink(state.mode==='rivens'?'https://warframe.market/auctions/search?type=riven'+(rivens.state.weapon?'&weapon_url_name='+encodeURIComponent(rivens.state.weapon.slug):''):state.item?'https://warframe.market/items/'+state.item.slug:'https://warframe.market/'));
 async function openFromItem(item){
  state.mode='items';for(const b of document.querySelectorAll('[data-wm-mode]')){b.classList.toggle('selected',b.dataset.wmMode==='items');b.setAttribute('aria-pressed',String(b.dataset.wmMode==='items'));}
  $('wm-items-view').hidden=false;$('wm-rivens-view').hidden=true;$('wm-catalog-refresh').hidden=false;
  const seq=++state.searchSeq,data=await api.call('wmEligibility',{ids:[item.id]});if(seq!==state.searchSeq)return;
  const target=data.matches[item.id];if(!target?.eligible)throw Error('该具体物品未确认可交易或没有唯一对应的 WM 条目');
  $('wm-search').value=target.market.english;state.loaded=true;
  $('wm-catalog-meta').textContent=`${data.total.toLocaleString()} 件可交易物品 · ${meta(data)}`;
  message($('wm-catalog-error'),data.error?`目录更新失败：${data.error}，正在使用已有目录。`:'');
  await choose(target.market);
 }

 return {state,rivens,search,choose,openFromItem,loadOrders,loadStats,loadSet,renderOrders,renderStats,async enter(){if(state.mode==='rivens'){await rivens.enter();return;}if(!state.loaded){$('wm-catalog-meta').textContent='正在获取可交易物品目录…';await search();}}};
}
