import {allItems} from '../merge/repository.mjs';
import {storeItemId} from '../merge/contract.mjs';
import {dropNameKey} from '../drop-localization.mjs';

// tradable describes this exact entity. A matching market family or a tradable
// recipe ingredient is never evidence that its completed equipment can trade.
export function marketEligibility(item,catalog){
 if(!item||item.tradable!==true)return {eligible:false,reason:item?.tradable===false?'not-tradable':'unknown-tradability'};
 const sameId=catalog.filter(row=>row.gameRef&&storeItemId(row.gameRef)===item.id&&!row.setRoot);
 if(sameId.length===1)return {eligible:true,basis:'exact-game-ref',market:sameId[0]};
 if(sameId.length>1)return {eligible:false,reason:'ambiguous-game-ref'};
 // Full names are usable only when the market did not provide an identity.
 // An explicit conflicting gameRef may be a beginner Mod or another variant.
 const named=catalog.filter(row=>!row.setRoot&&item.name?.en&&dropNameKey(row.english)===dropNameKey(item.name.en));
 const matches=named.length===1&&!named[0].gameRef?named:[];
 return matches.length===1?{eligible:true,basis:'unique-full-name-without-game-ref',market:matches[0]}:{eligible:false,reason:matches.length?'ambiguous-name':'no-exact-market-item'};
}
export function marketEligibilityBatch(data,catalog,ids){
 if(!Array.isArray(ids)||ids.length>80||ids.some(id=>typeof id!=='string'||id.length>600))throw Error('WM 交易校验参数无效');
 const byId=new Map(allItems(data).map(i=>[i.id,i]));
 return Object.fromEntries([...new Set(ids)].map(id=>[id,marketEligibility(byId.get(id),catalog)]));
}
