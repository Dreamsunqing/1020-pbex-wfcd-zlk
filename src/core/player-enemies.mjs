import {allItems} from './merge/repository.mjs';
const cache=new WeakMap();
const fraction=v=>Number.isFinite(v)&&v>=0&&v<=1?v:null;
const escape=v=>v.replaceAll('~','~0').replaceAll('/','~1');
// Use the immutable, hash-verified P3 reference, never an unrelated live file.
export function enemyLootIndex(data,acquisition={entries:{}}){
  if(data.output['player/enemy-loot.json'])return data.output['player/enemy-loot.json'];
  if(cache.has(data.output))return cache.get(data.output);
  const all=allItems(data),byId=new Map(all.map(i=>[i.id,i])),entries={},report={exact:0,fallback:0,unresolved:0};
  const file=data.output['reports/coverage.json']?.files?.find(f=>f.source==='plus'&&f.file.endsWith('/ExportEnemies.json'));
  const raw=file&&data.output[file.reference];
  for(const enemy of all.filter(i=>i.kind==='enemy')){
    const tableId=enemy.attributes?.droptable,pools=raw?.droptables?.[tableId];
    if(!Array.isArray(pools))continue;
    const rows=[];
    for(const [p,pool]of pools.entries())for(const [r,reward]of (pool.items??[]).entries()){
      const target=byId.get(reward.type);if(!target||target.kind==='reference'||target.unresolved){report.unresolved++;continue;}
      const categoryChance=fraction(pool.chance),conditionalChance=fraction(reward.probability);
      rows.push({id:target.id,category:pool.type,categoryChance,conditionalChance,chance:categoryChance!==null&&conditionalChance!==null?categoryChance*conditionalChance*100:null,quantity:Number.isFinite(reward.itemCount)?reward.itemCount:null,basis:'exact-enemy-table',source:'Plus',evidence:{file:file.file,pointer:'/droptables/'+escape(tableId)+'/'+p+'/items/'+r}});
    }
    entries[enemy.id]=rows;report.exact+=rows.length;
  }
  // Reverse only item-owned, identity-checked acquisition rows. A shared name
  // remains explicitly uncertain; it must not overwrite an avatar's own table.
  for(const [id,rows]of Object.entries(acquisition.entries))for(const row of rows){
    if(row.method!=='drop')continue;
    for(const enemyId of [...row.links,...(row.nameCandidates??[])]){
      if(byId.get(enemyId)?.kind!=='enemy'||Object.hasOwn(entries,enemyId)&&!entries[enemyId].some(r=>r.basis!=='exact-enemy-table'))continue;
      const list=entries[enemyId]??=[];
      if(list.some(r=>r.id===id&&r.chance===row.chance))continue;
      list.push({id,chance:row.chance,quantity:row.quantity,category:'item',basis:row.nameCandidates?.length?'shared-name-source':'reverse-acquisition',source:'WFCD',evidence:row.evidence});report.fallback++;
    }
  }
  const result={entries,report};cache.set(data.output,result);return result;
}
export function enemyVariant(item){
 const id=item.id.split('/').at(-1);
 if(/HardMode|SteelPath/i.test(id))return '钢铁之路变体';
 if(/TMW/i.test(id))return 'TMW 任务变体';
 if(/Quest/i.test(id))return '系列任务变体';
 return '敌人变体';
}
