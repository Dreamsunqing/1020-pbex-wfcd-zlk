import fs from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {sha256} from './io.mjs';
import {allItems} from './merge/repository.mjs';
import {internalItems} from './merge/display-policy.mjs';
import {imageDescriptors} from './merge/service.mjs';
const attributes=new Set(['category','type','trigger','variantType','isPrime','attacks','damage','levelStats','releaseDate','buildPrice','buildTime','buildQuantity','polarity','compatName','fusionLimit','baseDrain','relicRewards','rewards']);
export function createPlayerBundle(data){
 const items=allItems(data).map(i=>Object.fromEntries(Object.entries(i).filter(([k])=>['id','kind','name','description','passiveDescription','masteryRank','stats','rarity','tradable','helminth','augments','imageName','icon','attributes'].includes(k)).map(([k,v])=>[k,k==='attributes'?Object.fromEntries(Object.entries(v??{}).filter(([a])=>attributes.has(a))):v])));
 const images=imageDescriptors(data,items);for(const image of Object.values(images))delete image.cardArt;
 const output={'items/all.json':items,'relations.json':data.output['relations.json'],'recipes.json':data.output['recipes.json'],'contract.json':{fields:data.output['contract.json'].fields},'player/hidden.json':[...internalItems(data)],'player/images.json':images,'reports/source-records.json':[],'reports/coverage.json':{files:[]}};
 for(const locale of data.manifest.locales){const localizations={};for(const [id,fields] of Object.entries(data.output['localizations/'+locale+'.json']??{})){const selected=Object.fromEntries(Object.entries(fields).filter(([key])=>!key.startsWith('attributes.')||attributes.has(key.split('.')[1])).map(([key,entry])=>[key,{value:entry.value,locale}]));if(Object.keys(selected).length)localizations[id]=selected;}output['localizations/'+locale+'.json']=localizations;}
 return {manifest:{datasetVersion:data.manifest.datasetVersion,locales:data.manifest.locales,inputs:[],summary:data.manifest.summary,bundled:true},output};
}
let cached;
export async function loadPlayerBundle(directory=new URL('../data/player-library/',import.meta.url)){
 if(!cached)cached=(async()=>{const manifest=JSON.parse(await fs.readFile(new URL('manifest.json',directory),'utf8')),bytes=await fs.readFile(new URL('data.json.gz',directory));if(manifest.schemaVersion!==1||bytes.length!==manifest.bytes||sha256(bytes)!==manifest.sha256)throw new Error('内置资料库校验失败，请重新安装程序');const data=JSON.parse(gunzipSync(bytes,{maxOutputLength:256*1024*1024}));if(data.manifest.datasetVersion!==manifest.datasetVersion)throw new Error('内置资料库版本不符');return data;})().catch(e=>{cached=null;throw e;});
 return cached;
}
