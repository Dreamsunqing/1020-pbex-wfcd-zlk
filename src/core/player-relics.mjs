// The projection path is the stable identity; names and reward order are not keys.
import {storeItemId} from './merge/contract.mjs';
export const RELIC_ERAS = [['Lith','古纪'],['Meso','前纪'],['Neo','中纪'],['Axi','后纪'],['Vanguard','先锋'],['Requiem','安魂']];
export const RELIC_QUALITIES = [['Bronze','完整'],['Silver','无暇'],['Gold','良好'],['Platinum','光辉']];
export function relicIdentity(item) {
  if(item.kind!=='relic')return null;
  const m=item.id.match(/^(\/Lotus\/Types\/Game\/Projections\/(T[1-5])[^/]+?)(Bronze|Silver|Gold|Platinum)$/);
  if(!m)return item.id==='/Lotus/Types/Game/Projections/T5VoidProjectionImmortalOmniA'?{key:item.id,quality:'Unrefinable',era:'Requiem'}:null;
  return {key:m[1],quality:m[3],era:m[1].includes('/T4Vanguard')?'Vanguard':({T1:'Lith',T2:'Meso',T3:'Neo',T4:'Axi',T5:'Requiem'})[m[2]]};
}
export function relicDrops(item,odds={}) {
  const official=item.attributes?.relicRewards ?? [],wfcd=item.attributes?.rewards ?? [];
  return (official.length?official:wfcd).map(r=>{
    const id=storeItemId(r.rewardName ?? r.item?.uniqueName);
    const chance=odds[item.id]?.[id]??wfcd.find(v=>storeItemId(v.item?.uniqueName)===id)?.chance;
    return {id,quantity:r.itemCount,rarity:r.rarity,probability:Number.isFinite(chance)&&chance>=0&&chance<=100?chance:null};
  }).filter(r=>r.id);
}
export function relicIndex(items,odds={}) {
  const families=new Map(),byId=new Map(),sources=new Map();
  for(const item of items){const identity=relicIdentity(item);if(!identity)continue;
    if(!families.has(identity.key))families.set(identity.key,{key:identity.key,era:identity.era,variants:new Map()});
    const family=families.get(identity.key);family.variants.set(identity.quality,item);byId.set(item.id,family);
  }
  // Some official aliases have another path but exactly the same era/code,
  // reward IDs, amounts, rarities and probabilities in every quality.
  const signatures=new Map();
  for(const [key,family] of families){
    const variants=RELIC_QUALITIES.map(([q])=>[q,family.variants.get(q)]);
    const signature=JSON.stringify([family.era,[...family.variants.values()][0].attributes?.category,variants.map(([q,i])=>[q,i?relicDrops(i,odds).sort((a,b)=>a.id.localeCompare(b.id)):null])]);
    const existing=signatures.get(signature);
    if(existing&&variants.every(([,i])=>i)&&[...family.variants.values()][0].attributes?.category){for(const item of family.variants.values())byId.set(item.id,existing);families.delete(key);}else signatures.set(signature,family);
  }
  for(const family of families.values()){
    family.item=RELIC_QUALITIES.map(([q])=>family.variants.get(q)).find(Boolean)??[...family.variants.values()][0];
    for(const item of family.variants.values())for(const drop of relicDrops(item,odds)){
      if(!sources.has(drop.id))sources.set(drop.id,new Map());sources.get(drop.id).set(family.key,family);
    }
  }
  return {families,byId,sources};
}
