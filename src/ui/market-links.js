const queues=new WeakMap();
function eligibility(api,id){
 let queue=queues.get(api);if(!queue){queue={pending:new Map(),scheduled:false};queues.set(api,queue);}
 return new Promise(resolve=>{
  if(!queue.pending.has(id))queue.pending.set(id,[]);queue.pending.get(id).push(resolve);
  if(queue.scheduled)return;queue.scheduled=true;
  queueMicrotask(async()=>{
   const pending=queue.pending;queue.pending=new Map();queue.scheduled=false;
   const ids=[...pending.keys()];for(let at=0;at<ids.length;at+=80){const batch=ids.slice(at,at+80);let matches={};try{matches=(await api.call('wmEligibility',{ids:batch})).matches;}catch{/* Unknown/offline catalog means no actionable link. */}
    for(const key of batch)for(const done of pending.get(key))done(matches?.[key]);
   }
  });
 });
}
export async function appendMarketLink({api,item,container,openWM,className='codex-wm-link',beforeOpen=()=>{},guarded=fn=>fn()}){
 if(!openWM||!item?.id||item.tradable!==true)return;
 const result=await eligibility(api,item.id);if(!result?.eligible||!container.isConnected)return;
 const button=document.createElement('button');button.type='button';button.className=className;button.textContent='WM搜索';button.dataset.marketBasis=result.basis;
 button.onclick=event=>{event.stopPropagation();guarded(async()=>{await beforeOpen();await openWM(item);});};
 button.onkeydown=event=>event.stopPropagation();container.append(button);
}
