import {allItems} from './merge/repository.mjs';
import {dropNameKey} from './drop-localization.mjs';
import {storeItemId} from './merge/contract.mjs';
const caches=new WeakMap(),norm=dropNameKey;
export function officialRelicOdds(data){
 if(data.output['player/relic-odds.json'])return data.output['player/relic-odds.json'];if(caches.has(data.output))return caches.get(data.output);
 const source=data.output['reports/coverage.json']?.files?.find(f=>f.source==='droptables'&&f.file.endsWith('/parsed.json')),snapshot=source&&data.output[source.reference],odds={};
 if(snapshot?.schemaVersion===1){const items=allItems(data),byId=new Map(items.map(i=>[i.id,i])),tables=new Map();for(const g of snapshot.groups.filter(g=>g.section==='relicRewards')){const k=norm(g.title);if(!tables.has(k))tables.set(k,[]);tables.get(k).push(g);}
 for(const relic of items.filter(i=>i.kind==='relic')){const quality=/(Bronze|Silver|Gold|Platinum)$/.exec(relic.id)?.[1],name=norm(relic.name?.en).replace(/ (?:relic|intact|exceptional|flawless|radiant)$/,'');if(!quality)continue;const key=name+' relic ('+({Bronze:'intact',Silver:'exceptional',Gold:'flawless',Platinum:'radiant'})[quality]+')',matches=tables.get(key);if(matches?.length!==1)continue;
  for(const r of relic.attributes?.relicRewards??[]){const id=storeItemId(r.rewardName),target=byId.get(id);if(!target?.name?.en)continue;const name=norm(target.name.en),rows=matches[0].rows.filter(row=>norm(row.name.replace(/^\d+(?:,\d{3})*(?:X\s*|\s+)/,''))===name),values=new Set(rows.map(row=>row.chance));if(values.size===1){const p=[...values][0];if(Number.isFinite(p)&&p>=0&&p<=100)(odds[relic.id]??={})[id]=p;}}
 }}caches.set(data.output,odds);return odds;
}
