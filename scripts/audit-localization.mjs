import fs from 'node:fs/promises';import path from 'node:path';
import {parseArgs} from 'node:util';
import {scanLibrary,pointerValue} from '../src/core/library.mjs';
import {digest,stable} from '../src/core/merge/contract.mjs';
import {MergeRepository,allItems} from '../src/core/merge/repository.mjs';
import {expandEvidence} from '../src/core/merge/service.mjs';
import {plainGameText} from '../src/core/inline-tokens.mjs';
const {values}=parseArgs({options:{root:{type:'string',default:'.'},store:{type:'string',default:'.workbench'},out:{type:'string',default:'输出/本地化/映射审计.json'}}});
const library=await scanLibrary(values.root),repository=new MergeRepository(path.join(path.resolve(values.store),'merged',digest({mode:'local',root:library.root}))),data=await repository.current();
if(!data || data.manifest.modelingVersion!=='localized-text-3')throw Error('请先用新版工具重新构建全量资料');
const files=new Map(data.output['reports/coverage.json'].files.map(row=>[row.file,row])),items=new Map(allItems(data).map(row=>[row.id,row]));
const raw=source=>pointerValue(data.output[files.get(source.file)?.reference],source.pointer);
const failures=[],check=(ok,detail)=>{if(!ok&&failures.length<100)failures.push(detail);};let strings=0,hanStrings=0,projectionFields=0,namedFields=0,officialRows=0;
const walk=node=>{if(typeof node==='string'){strings++;const han=[...node.matchAll(/[\u3400-\u9fff]/g)].map(m=>m[0]).join('');if(han){hanStrings++;const output=[...plainGameText(node).matchAll(/[\u3400-\u9fff]/g)].map(m=>m[0]).join('');let at=0;for(const char of output)if(char===han[at])at++;check(at===han.length,{kind:'middleware-text-loss',value:node,output});}}else if(node&&typeof node==='object')for(const child of Object.values(node))walk(child);};
function replacePointer(root,pointer,value){if(!pointer)return value;const keys=pointer.slice(1).split('/').map(key=>key.replaceAll('~1','/').replaceAll('~0','~'));let parent=root;for(const key of keys.slice(0,-1))parent=parent[key];parent[keys.at(-1)]=value;return root;}
for(const locale of data.manifest.locales)for(const [id,fields]of Object.entries(data.output['localizations/'+locale+'.json']??{}))for(const [field,compact]of Object.entries(fields)){
 const entry=expandEvidence(data,compact);let expected=structuredClone(raw(entry.source));
 for(const ref of entry.dictionarySources??[]) {check(ref.source.pointer.startsWith(entry.source.pointer),{kind:'dictionary-pointer',id,field,ref});expected=replacePointer(expected,ref.source.pointer.slice(entry.source.pointer.length),raw(ref.dictionary));}
 check(stable(expected)===stable(entry.value),{kind:'projection-mismatch',id,locale,field,source:entry.source});projectionFields++;walk(entry.value);
}
for(const field of expandEvidence(data,data.output['reports/provenance.json']))if(/^(name|description|passiveDescription)\./.test(field.field)&&field.selected!==null&&field.candidates[field.selected]){
 const candidate=field.candidates[field.selected];let expected=candidate.dictionary?raw(candidate.dictionary):raw(candidate.source);
 if(['max-rank-stats','text-lines'].includes(candidate.transform))expected=expected.join('\n');
 if(candidate.transform==='derived-blueprint-name')continue;
 const value=field.value??candidate.value??expected;check(stable(value)===stable(expected),{kind:'named-text-mismatch',id:field.entityId,field:field.field,source:candidate.source});namedFields++;walk(value);
}
for(const record of expandEvidence(data,data.output['reports/source-records.json']))if(record.locale==='zh-CN'&&record.source.source==='official'){
 const value=raw(record.source),item=items.get(record.entityId);if(!value||!item)continue;officialRows++;walk(value);
 for(const [sourceKey,target]of [['name','name'],['abilityName','name'],['description','description'],['passiveDescription','passiveDescription']])if(typeof value[sourceKey]==='string'&&value[sourceKey].trim()&&!value[sourceKey].startsWith('/'))check(Boolean(item[target]?.['zh-CN']),{kind:'official-text-unmapped',id:item.id,sourceKey,source:record.source});
 if(Array.isArray(value.levelStats)&&value.levelStats.length)check(Boolean(data.output['localizations/zh-CN.json']?.[item.id]?.['attributes.levelStats']),{kind:'official-ranks-unmapped',id:item.id,source:record.source});
}
const missingKeys=new Map();for(const item of items.values()){
 const find=(node,field)=>{if(typeof node==='string'&&node.startsWith('/Lotus/Language/')){const row=missingKeys.get(node)??{key:node,count:0,examples:[]};row.count++;if(row.examples.length<3)row.examples.push({id:item.id,field});missingKeys.set(node,row);}else if(node&&typeof node==='object')for(const [key,child]of Object.entries(node))find(child,field+'/'+key);};find(item,'');
}
const result={ok:failures.length===0,datasetVersion:data.manifest.datasetVersion,modelingVersion:data.manifest.modelingVersion,coverage:data.output['reports/localization.json'],checks:{projectionFields,namedFields,officialChineseRecords:officialRows,strings,hanStrings},failures,remainingLanguageKeys:{distinct:missingKeys.size,examples:[...missingKeys.values()].slice(0,50)},limits:['逐字段验证已选值及字典指针，不宣称上游缺失的翻译已齐全','匿名数组保留整组语言版本；不根据下标跨源拼接','原字段与非展示业务枚举可能保留语言键，清单用于后续规则维护']};
const out=path.resolve(values.out);await fs.mkdir(path.dirname(out),{recursive:true});await fs.writeFile(out,JSON.stringify(result,null,2));console.log(JSON.stringify({...result,remainingLanguageKeys:{distinct:missingKeys.size},output:out},null,2));if(!result.ok)process.exitCode=1;
