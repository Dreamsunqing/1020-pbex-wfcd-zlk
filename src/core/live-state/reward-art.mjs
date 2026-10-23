import {allItems} from '../merge/repository.mjs';
import {imageDescriptors} from '../merge/service.mjs';
import {storeItemId} from '../merge/contract.mjs';
const caches=new WeakMap();
const boosterIds={credits:'/Lotus/Types/StoreItems/Boosters/CreditBoosterStoreItem',resources:'/Lotus/Types/StoreItems/Boosters/ResourceAmountBoosterStoreItem',affinity:'/Lotus/Types/StoreItems/Boosters/AffinityBoosterStoreItem'};
function index(data){if(!caches.has(data.output)){const items=allItems(data),byId=new Map(items.map(i=>[i.id,i])),names=new Map();for(const item of items)for(const name of new Set(Object.values(item.name??{}))){if(typeof name!=='string')continue;const key=name.toLocaleLowerCase();names.set(key,!names.has(key)||names.get(key)===item.id?item.id:null);}caches.set(data.output,{byId,names});}return caches.get(data.output);}
// Only enrich the normalized view. The world-state snapshot and P3 entities stay intact.
export function enrichWorldRewardArt(view,data){const {byId,names}=index(data),targets=[];
 const visit=row=>{if(!row||typeof row!=='object')return;if(Array.isArray(row)){row.forEach(visit);return;}
  let id=typeof row.id==='string'?storeItemId(row.id):null;
  if(!byId.has(id)&&(typeof row.id!=='string'||!row.id.startsWith('/'))&&typeof row.name==='string')id=names.get(row.name.toLocaleLowerCase());
  const item=byId.get(id);if(item)targets.push({row,item,link:true});
  for(const [key,value] of Object.entries(row))if(key!=='reference'&&value&&typeof value==='object')visit(value);
 };
 for(const module of view.modules){visit(module.entries);if(module.id==='boosters')for(const row of module.entries){const item=byId.get(boosterIds[row.kind]);if(item)targets.push({row,item,link:false});}}
 const descriptors=imageDescriptors(data,[...new Map(targets.map(t=>[t.item.id,t.item])).values()]);
 for(const {row,item,link} of targets){for(const [key,value] of Object.entries(descriptors[item.id]??{}))if(key!=='id'&&value!==undefined&&value!==null)row[key]=value;row.imageId=item.id;if(link){row.libraryId=item.id;row.libraryVersion=data.manifest.datasetVersion;}if(typeof row.name==='string'&&!/\p{Script=Han}/u.test(row.name)&&item.name?.['zh-CN'])row.name=item.name['zh-CN'];}
 return view;
}
