import fs from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {withLock,sha256} from './io.mjs';

import {parseDropTables,DROP_URL} from './drop-tables.mjs';
export async function dropTableSource(source,previous,config,store,get=null){
 get??=(await import('./updater.mjs')).requestBytes;
 const bytes=await get(DROP_URL,{maxBytes:32*1024*1024}),html=bytes.toString('utf8'),hash=sha256(html);
 if(previous?.version===hash&&previous.parserVersion===1)return previous;
 const parsed=parseDropTables(html);
 if(!/<\/html\s*>/i.test(html)||!parsed.groups.some(g=>g.section==='missionRewards')||!parsed.groups.some(g=>g.section==='relicRewards'))throw new Error('官方掉落表不完整；保留旧快照');
 return {kind:'droptables',parserVersion:1,label:source.label,version:hash,files:{'droptables.html.txt':{...await store.put(bytes),url:DROP_URL},'parsed.json':{...await store.put(Buffer.from(JSON.stringify(parsed))),url:DROP_URL}}};
}
export async function currentDropTables(store){
 const release=await store.current(),entry=release?.sources?.droptables?.files?.['parsed.json'];
 if(entry)return JSON.parse((await store.bytes(entry)).toString());
 const bytes=await fs.readFile(new URL('../data/drop-tables/snapshot.json.gz',import.meta.url)),manifest=JSON.parse(await fs.readFile(new URL('../data/drop-tables/manifest.json',import.meta.url),'utf8'));
 if(bytes.length!==manifest.bytes||sha256(bytes)!==manifest.sha256)throw new Error('内置掉落表校验失败，请重新安装程序');
 return JSON.parse(gunzipSync(bytes,{maxOutputLength:64*1024*1024}).toString());
}
export async function refreshDropTables(store,{proxyUrl}={}){return withLock(store.root,async()=>{const {requestBytes}=await import('./updater.mjs');const before=await store.current(),source=await dropTableSource({label:'DE 官方掉落表'},before?.sources?.droptables,{},store,(url,opts)=>requestBytes(url,{...opts,proxyUrl}));const release=await store.publish({...before?.sources,droptables:source},before?.id);await store.collectObjects();await store.event({type:'drop-tables-refreshed',releaseId:release.id,source:'droptables'});return JSON.parse((await store.bytes(source.files['parsed.json'])).toString());});}
