import { searchItems } from '../core/wm/model.mjs';
import { compatibleAttributes, filterAuctions, attributeValue, POLARITIES } from '../core/wm/auctions.mjs';
import { decorateImages } from './images.js';

const el=(tag,cl,text)=>{const n=document.createElement(tag);if(cl)n.className=cl;if(text!==undefined)n.textContent=text;return n;};
const number=v=>Number.isFinite(v)?v.toLocaleString('zh-CN',{maximumFractionDigits:2}):'—';
const date=v=>v&&Number.isFinite(Date.parse(v))?new Date(v).toLocaleString('zh-CN',{hour12:false}):'未知时间';
const statuses={ingame:'游戏中',online:'在线',offline:'离线'};

export function createRivenUI({api,guarded}) {
  const $=id=>document.getElementById(id);
  const state={catalog:null,catalogBusy:false,catalogSeq:0,weapon:null,hints:[],active:-1,result:null,seq:0,busy:false,offset:0,initialSearch:false};
  const positiveIds=['wm-riven-positive-1','wm-riven-positive-2','wm-riven-positive-3'];
  const message=(id,text,error=false)=>{const n=$(id);n.textContent=text;n.hidden=!text;n.classList.toggle('error',error);};
  const updated=r=>`${r.stale?'旧缓存 · ':r.cached?'缓存 · ':''}更新于 ${date(r.fetchedAt)}`;
  function hideHints(){state.active=-1;$('wm-riven-hints').hidden=true;$('wm-riven-weapon').setAttribute('aria-expanded','false');$('wm-riven-weapon').removeAttribute('aria-activedescendant');}
  function renderAttributes(){
    if(!state.catalog)return;
    const available=compatibleAttributes(state.catalog.attributes,state.weapon).sort((a,b)=>a.name.localeCompare(b.name,'zh-CN'));
    for(const id of [...positiveIds,'wm-riven-negative']){
      const n=$(id),previous=n.value,negative=id==='wm-riven-negative';n.replaceChildren(new Option('任何',''));
      if(negative)n.append(new Option('无负面词条','none'),new Option('有任意负面词条','has'));
      for(const a of available)if(!negative||!a.positiveOnly)n.append(new Option(a.name,a.slug));
      if([...n.options].some(o=>o.value===previous))n.value=previous;
    }
  }
  function chooseWeapon(weapon){
    state.weapon=weapon;$('wm-riven-weapon').value=weapon?.name??'';state.hints=[];hideHints();renderAttributes();
  }
  function highlight(){
    const nodes=$('wm-riven-hints').querySelectorAll('[role=option]');
    nodes.forEach((n,i)=>{n.classList.toggle('active',i===state.active);n.setAttribute('aria-selected',String(i===state.active));});
    if(state.active>=0){$('wm-riven-weapon').setAttribute('aria-activedescendant','wm-riven-option-'+state.active);nodes[state.active]?.scrollIntoView({block:'nearest'});}
  }
  function weaponHints(){
    state.weapon=null;state.active=-1;renderAttributes();
    const query=$('wm-riven-weapon').value,box=$('wm-riven-hints');box.replaceChildren();
    state.hints=state.catalog?searchItems(state.catalog.weapons,query.slice(0,180)):[];
    if(!query.trim()){hideHints();return;}
    for(const [i,w] of state.hints.entries()){
      const b=el('button','wm-suggestion');b.type='button';b.id='wm-riven-option-'+i;b.setAttribute('role','option');b.setAttribute('aria-selected','false');b.tabIndex=-1;b.onclick=()=>chooseWeapon(w);
      b.append(el('strong','',w.name),el('small','',w.english));box.append(b);
    }
    if(!state.hints.length)box.append(el('p','wm-no-hints','没有匹配的裂罅武器，请尝试英文名。'));
    box.hidden=false;$('wm-riven-weapon').setAttribute('aria-expanded','true');
  }
  async function loadCatalog(refresh=false){
    if(state.catalogBusy)return;
    const seq=++state.catalogSeq;state.catalogBusy=true;$('wm-riven-catalog-refresh').disabled=true;$('wm-auction-search').disabled=true;
    $('wm-riven-catalog-meta').textContent='正在读取裂罅武器与词条目录…';message('wm-riven-catalog-error','');
    try{
      const data=await api.call('wmRivenCatalog',{refresh});if(seq!==state.catalogSeq)return;state.catalog=data;
      if(state.weapon){state.weapon=data.weapons.find(w=>w.slug===state.weapon.slug)??null;$('wm-riven-weapon').value=state.weapon?.name??'';}
      hideHints();renderAttributes();
      $('wm-riven-catalog-meta').textContent=`${data.weapons.length} 种武器 · ${data.attributes.length} 种词条 · ${updated(data)}`;
      message('wm-riven-catalog-error',data.error?`${data.error}；正在使用已缓存目录。`:'',!!data.error);
    }catch(error){
      message('wm-riven-catalog-error',error.message+'；可点击刷新目录重试。',true);
      $('wm-riven-catalog-meta').textContent=state.catalog?'正在使用此前目录':'目录暂不可用';
      if(!state.result)$('wm-auction-list').replaceChildren(el('p','wm-empty','尚未取得武器与词条目录，请刷新目录后重试。'));
    }finally{state.catalogBusy=false;$('wm-riven-catalog-refresh').disabled=false;$('wm-auction-search').disabled=!state.catalog||state.busy;}
  }
  function queryFilters(){
    if($('wm-riven-weapon').value.trim()&&!state.weapon)throw new Error('请从搜索提示中选择武器，或点击“任何武器”。');
    const filters={weapon:state.weapon?.slug??'',positive:positiveIds.map(id=>$(id).value).filter(Boolean),negative:$('wm-riven-negative').value,polarity:$('wm-riven-polarity').value,rank:$('wm-riven-rank').value,kind:$('wm-riven-kind').value,sort:$('wm-riven-sort').value};
    for(const [field,id] of [['masteryMin','mastery-min'],['masteryMax','mastery-max'],['rollsMin','rolls-min'],['rollsMax','rolls-max']]){const v=$('wm-riven-'+id).value;filters[field]=v===''?'':Number(v);}
    return filters;
  }
  async function search(refresh=true){
    if(!state.catalog)return;
    // Invalidate previous responses even when the next query fails validation.
    const seq=++state.seq;state.busy=true;state.result=null;state.offset=0;
    $('wm-auction-search').disabled=true;$('wm-auction-previous').disabled=true;$('wm-auction-next').disabled=true;
    $('wm-auction-count').textContent='';$('wm-auction-meta').textContent='';message('wm-auction-error','');hideHints();
    try{
      const filters=queryFilters(),platform=$('wm-auction-platform').value;
      $('wm-auction-list').replaceChildren(el('p','wm-empty','正在查询公开裂罅拍卖…'));
      const result=await api.call('wmAuctions',{filters,platform,refresh});if(seq!==state.seq)return;
      state.result=result;state.initialSearch=true;render();
    }catch(error){if(seq!==state.seq)return;message('wm-auction-error',error.message,true);$('wm-auction-list').replaceChildren(el('p','wm-empty','本次查询未完成，请调整条件或稍后刷新。'));}
    finally{if(seq===state.seq){state.busy=false;$('wm-auction-search').disabled=!state.catalog||state.catalogBusy;}}
  }
  function render(){
    const result=state.result;if(!result||!state.catalog)return;
    const rows=filterAuctions(result.auctions,$('wm-auction-status').value),size=20,box=$('wm-auction-list');box.replaceChildren();
    state.offset=Math.min(state.offset,Math.max(0,Math.floor((rows.length-1)/size)*size));
    $('wm-auction-meta').textContent=`${result.latest?'最新挂单窗口 · ':''}${result.platform.toUpperCase()} · 本次窗口 ${result.windowCount??result.auctions.length} 条 · 符合查询 ${result.auctions.length} 条 · ${updated(result)}`;
    const warnings=[result.error?`${result.error}；以下为上次成功获取的列表。`:'',result.catalogError?'目录更新失败，使用已缓存目录。':'',result.latest?'未指定武器且未选择正面词条：筛选和标价排序仅作用于最新挂单窗口，不代表全站结果。标价优先使用一口价，否则使用起拍价。':'',result.limitReached?'已达到本次返回窗口，列表可能不完整；请缩小武器或词条范围。':''].filter(Boolean);
    message('wm-auction-error',warnings.join(' '),!!result.error);
    const weapons=new Map(state.catalog.weapons.map(w=>[w.slug,w])),attributes=new Map(state.catalog.attributes.map(a=>[a.slug,a])),pictures=[];
    for(const a of rows.slice(state.offset,state.offset+size)){
      const w=weapons.get(a.weapon),card=el('article','wm-auction-card');card.dataset.auction=a.id;
      const heading=el('div','wm-auction-card-heading'),title=el('div','wm-auction-title');
      title.append(el('h3','',`${w?.name??a.weapon} ${a.name}`),el('small','',`${w?.english??a.weapon} ${a.name}`));
      const link=el('button','small','在 WM 查看 ↗');link.type='button';link.onclick=()=>guarded(()=>api.openDocumentLink('https://warframe.market/auction/'+encodeURIComponent(a.id)));
      heading.append(title,link);card.append(heading);
      const chips=el('div','wm-riven-stats');
      for(const attr of a.attributes){const def=attributes.get(attr.slug);chips.append(el('span',attr.positive?'positive':'negative',`${attributeValue(attr,def)} ${def?.name??attr.slug}`));}
      card.append(chips);
      const details=el('div','wm-auction-details');details.append(el('p','wm-meta',`段位 ${number(a.mastery)} · 等级 ${number(a.rank)} · 循环 ${number(a.rolls)} · 极性 ${POLARITIES[a.polarity]??(a.polarity||'未知')}`));
      const prices=el('div','wm-auction-prices');
      const price=(label,value)=>{const n=el('span');n.append(el('small','',label),el('strong','',value===null?'未报价':`${number(value)} 白金`));return n;};
      if(a.direct)prices.append(price('一口价',a.buyoutPrice));
      else{prices.append(price('起拍价',a.startingPrice),price('当前出价',a.topBid));if(a.buyoutPrice!==null)prices.append(price('一口价',a.buyoutPrice));}
      details.append(prices);card.append(details);
      const footer=el('div','wm-auction-footer');footer.append(el('strong','wm-player',a.owner.name),el('span','wm-status-dot '+a.owner.status,statuses[a.owner.status]),el('span','wm-meta',`声望 ${number(a.owner.reputation)}`),el('small','wm-meta',`更新于 ${date(a.updated)} · ${a.direct?'直接出售':'拍卖'}`));card.append(footer);box.append(card);
      if(w?.gameRef)pictures.push({id:w.gameRef,card:title,label:w.name});
    }
    if(!rows.length)box.append(el('p','wm-empty',result.auctions.length?'本次结果中没有符合在线状态的卖家，可切换全部状态或缩小查询范围。':'没有符合条件的裂罅拍卖，可以放宽筛选条件。'));
    void decorateImages(api,pictures);
    $('wm-auction-count').textContent=`本次结果中符合状态 ${rows.length} 条${rows.length?` · ${state.offset+1}–${Math.min(state.offset+size,rows.length)}`:''}`;
    $('wm-auction-previous').disabled=state.offset===0;$('wm-auction-next').disabled=state.offset+size>=rows.length;
  }
  $('wm-riven-weapon').oninput=weaponHints;
  $('wm-riven-weapon').onkeydown=e=>{
    if(e.key==='Escape'){hideHints();return;}
    if(['ArrowDown','ArrowUp'].includes(e.key)&&state.hints.length){e.preventDefault();$('wm-riven-hints').hidden=false;$('wm-riven-weapon').setAttribute('aria-expanded','true');state.active=(state.active+(e.key==='ArrowDown'?1:-1)+state.hints.length)%state.hints.length;highlight();}
    if(e.key==='Enter'&&!$('wm-riven-hints').hidden&&state.hints.length){e.preventDefault();chooseWeapon(state.hints[Math.max(0,state.active)]);}
  };
  document.addEventListener('pointerdown',e=>{if(!$('wm-riven-weapon-box').contains(e.target))hideHints();});
  $('wm-riven-clear').onclick=()=>chooseWeapon(null);
  $('wm-riven-catalog-refresh').onclick=()=>guarded(()=>loadCatalog(true));
  $('wm-auction-form').onsubmit=e=>{e.preventDefault();void guarded(()=>search(true));};
  $('wm-auction-status').onchange=()=>{state.offset=0;render();};
  $('wm-auction-platform').onchange=()=>guarded(()=>search(false));
  for(const [id,delta] of [['wm-auction-previous',-20],['wm-auction-next',20]])$(id).onclick=()=>{state.offset=Math.max(0,state.offset+delta);render();$('wm-auction-list').scrollIntoView({block:'start'});};
  return {state,search,render,async enter(){if(!state.catalog)await loadCatalog();if(state.catalog&&!state.initialSearch&&!state.busy)await search(false);}};
}
