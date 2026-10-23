import { wikiRecords } from './ability-links.mjs';
import { pointer, compareText } from './contract.mjs';

// Compatibility is derived from explicit Wiki family + Incarnon-form metadata,
// not from substring names, weapon parent classes or the existence of an attack.
export function buildIncarnonLinks({ documents, index, items, itemMap, relations, provenance, issue }) {
  const report={adapters:0,weapons:0,unmatched:[],limitations:['家族名精确对应灵化之源英文基础名，并要求该武器有 IncarnonImage；不扩散到同父类或相似名称','这是社区 Wiki 元数据推导的适配索引，不是官方安装兼容字段；自带灵化武器不因此关联灵化之源']};
  const adapters=new Map(),linkedAdapters=new Set(),candidates=new Map();
  for(const item of items){
    if(item.kind!=='resource'||!/^\/Lotus\/Types\/Items\/MiscItems\/IncarnonAdapters\/(Primary|Secondary|Melee)\/[^/]+$/.test(item.id))continue;
    const name=/^(.+) Incarnon Genesis$/.exec(item.name?.en??'')?.[1];if(!name)continue;
    if(!adapters.has(name))adapters.set(name,[]);adapters.get(name).push(item);
  }
  const fail=(id,reason,sources=[])=>{report.unmatched.push({id,reason,sources});issue('incarnon-link-unmatched',id,'links',reason,sources,'info');};
  for(const doc of documents.filter(d=>d.source==='plus-gen'&&/\/extras\/wiki\/Weapons\/(primary|secondary|melee)\.lua$/.test(d.file))){
    const slot={primary:'Primary',secondary:'Secondary',melee:'Melee'}[doc.file.match(/([^/]+)\.lua$/)[1]];
    for(const row of wikiRecords(doc.value,{depth:1,fields:['InternalName','Family','IncarnonImage']})){
      const {InternalName:id,Family:family,IncarnonImage:image}=row.value;
      if(typeof image!=='string'||!image.trim())continue;
      const target=itemMap.get(id);if(target?.kind!=='weapon')continue;
      const sources=['InternalName','Family','IncarnonImage'].filter(k=>row.lines[k]).map(k=>({source:doc.source,file:doc.file,hash:doc.hash,pointer:'',line:row.lines[k]}));
      const matches=(adapters.get(family)??[]).filter(a=>a.id.includes('/'+slot+'/'));
      if(matches.length!==1){fail(id,'灵化形态记录没有唯一同家族、同槽位的灵化之源，未猜测关联',sources);continue;}
      const adapter=matches[0],raw=index.get(adapter.id)?.find(r=>r.source.source==='plus')??index.get(adapter.id)?.[0];
      if(raw)sources.push({...raw.source,pointer:raw.source.pointer+'/'+pointer('name')});
      // Retain the dictionary evidence that supplied the exact English join key.
      const english=provenance.find(p=>p.entityId===adapter.id&&p.field==='name.en');
      const selected=english?.candidates?.[english.selected??0];if(selected?.dictionary)sources.push(selected.dictionary);
      if(!candidates.has(id))candidates.set(id,[]);candidates.get(id).push({adapter,sources});
    }
  }
  for(const[id,rows]of [...candidates].sort(([a],[b])=>compareText(a,b))){
    if(new Set(rows.map(r=>r.adapter.id)).size!==1){fail(id,'同一武器的家族元数据冲突，未生成灵化关联',rows.flatMap(r=>r.sources));continue;}
    const {adapter}=rows[0],sources=rows.flatMap(r=>r.sources),rule='Wiki InternalName 完整 ID → weapon；Family 精确等于灵化之源英文名去掉固定后缀；同槽位且存在 IncarnonImage';
    relations.push({from:id,to:adapter.id,kind:'incarnon-adapter',source:sources[0],sources,rule});
    provenance.push({entityId:id,field:'links.incarnonAdapter',value:adapter.id,status:'resolved',selected:0,rule,candidates:sources.map(source=>({value:adapter.id,transform:'explicit-incarnon-family',source}))});
    linkedAdapters.add(adapter.id);report.weapons++;
  }
  report.adapters=linkedAdapters.size;
  for(const adapter of [...adapters.values()].flat())if(!linkedAdapters.has(adapter.id))fail(adapter.id,'灵化之源暂无明确的可用武器元数据');
  return report;
}
