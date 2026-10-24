// Explicit maintenance command. Never contacts a Wiki while the app is browsing.
import fs from 'node:fs/promises';import path from 'node:path';import {createHash} from 'node:crypto';
import {fetch,EnvHttpProxyAgent} from 'undici';import {wikiRecords} from '../src/core/merge/ability-links.mjs';import {loadPlayerBundle} from '../src/core/player-bundle.mjs';import {allItems} from '../src/core/merge/repository.mjs';
if(process.argv.includes('--help')){console.log('用法：node 工具/15-获取敌人图片.mjs\n需在项目根目录运行，已有内置资料和 Plus ExportEnemies。显式联网补图；索引写入 assets/content/wfcd/enemy-image-index.json。');process.exit(0);}
const agent=new EnvHttpProxyAgent(),root=path.resolve('assets/content/wfcd'),cache=path.resolve('.cache/enemy-images');
const sha=b=>createHash('sha256').update(b).digest('hex');const read=async p=>JSON.parse(await fs.readFile(p,'utf8'));
async function get(url,max=8*1024*1024){const u=new URL(url);if(u.protocol!=='https:'||u.hostname!=='wiki.warframe.com')throw new Error('Unsupported image origin');const r=await fetch(u,{dispatcher:agent,signal:AbortSignal.timeout(25000),redirect:'error',headers:{'User-Agent':'SourceWorkbench/0.16.9 (local enemy illustration maintenance)'}});if(!r.ok){await r.body?.cancel();throw new Error('HTTP '+r.status);}let length=0;const chunks=[];for await(const c of r.body){length+=c.length;if(length>max)throw new Error('Response too large');chunks.push(c);}return Buffer.concat(chunks);}
async function api(args){return JSON.parse(await get('https://wiki.warframe.com/api.php?'+new URLSearchParams({format:'json',...args})));}
await fs.mkdir(cache,{recursive:true});await fs.mkdir(path.join(root,'img'),{recursive:true});
try{
const data=await loadPlayerBundle(),enemies=allItems(data).filter(i=>i.kind==='enemy'),ids=new Set(enemies.map(i=>i.id));
const plus=await read('世界状态上游/git/warframe-public-export-plus/ExportEnemies.json');
const inventory=await read(path.join(root,'wfcd-image-index.json')),localHashes=new Map(inventory.images.filter(i=>i.sha256).map(i=>[i.sha256,i]));
const old=await read(path.join(root,'enemy-image-index.json')).catch(()=>({mappings:[]})),prior=new Map(old.mappings.map(i=>[i.id,i]));
const candidates=new Map(),failures=[];const factions=['grineer','corpus','infestation','orokin','sentient','stalker','narmer','themurmur','techrot','scaldra','anarchs','unaffiliated'];
for(const faction of factions){const title='Module:Enemies/data/'+faction,result=await api({action:'query',titles:title,prop:'revisions',rvprop:'content|ids',rvslots:'main'}),page=Object.values(result.query.pages)[0],revision=page.revisions?.[0];if(!revision){failures.push({title,error:'Module unavailable'});continue;}const text=revision.slots.main['*'];await fs.writeFile(path.join(cache,faction+'.lua'),text);
for(const row of wikiRecords(text,{depth:2,fields:['InternalName','Image','Name','Link']})){
 const raw=row.value;if(!raw.Image||!/^[/\w .()'’\-]+\.(png|jpe?g|webp)$/i.test(raw.Image)||raw.Image.includes('/'))continue;
 const targets=new Set([raw.InternalName,...Object.values(plus.agents?.[raw.InternalName]?.avatarTypes??{})]);
 for(const id of targets)if(ids.has(id)){if(!candidates.has(id))candidates.set(id,[]);candidates.get(id).push({id,name:raw.Name,imageName:raw.Image,wikiPage:raw.Link??raw.Name,source:{url:'https://wiki.warframe.com/w/'+title,revision:revision.revid,line:row.lines.Image,moduleSha256:sha(text)},basis:raw.InternalName===id?'wiki-internal-id':'wiki-agent-avatar-id'});}
}console.log('Metadata',faction,candidates.size);}
const selected=[...candidates.values()].filter(rows=>new Set(rows.map(r=>r.imageName)).size===1).map(rows=>rows[0]),images=new Map();
for(const row of selected)images.set(row.imageName,null);
const names=[...images.keys()];for(let at=0;at<names.length;at+=25){const batch=names.slice(at,at+25),result=await api({action:'query',titles:batch.map(n=>'File:'+n).join('|'),prop:'imageinfo',iiprop:'url',iiurlwidth:'512'}),normalized=new Map((result.query.normalized??[]).map(r=>[r.from,r.to])),pages=new Map(Object.values(result.query.pages).map(p=>[p.title,p]));for(const name of batch){const title='File:'+name,info=pages.get(normalized.get(title)??title)?.imageinfo?.[0];if(info)images.set(name,info.thumburl??info.url);}}
const mappings=[],queue=selected.slice(),downloaded=new Map();let done=0;
await Promise.all(Array.from({length:4},async()=>{while(queue.length){const row=queue.shift();try{
 const url=images.get(row.imageName);if(!url)throw new Error('Wiki file missing');
 const existing=prior.get(row.id);if(existing?.provider==='wiki'&&existing.url===url&&existing.imageName===row.imageName&&/^[\w.-]+$/.test(existing.assetName)&&await fs.readFile(path.join(root,'img',existing.assetName)).then(b=>sha(b)===existing.sha256,()=>false)){mappings.push({...existing,...row});continue;}
 // Identical filenames can refer to an enemy sigil in WFCD and a portrait in Wiki.
 // Reuse only verified identical bytes, never an image-name match across providers.
 if(!downloaded.has(url))downloaded.set(url,(async()=>{const bytes=await get(url,2*1024*1024);const format=bytes.subarray(0,8).toString('hex')==='89504e470d0a1a0a'?'png':bytes[0]===255&&bytes[1]===216?'jpg':null;if(!format)throw new Error('Unsupported bitmap');const hash=sha(bytes),local=localHashes.get(hash),reusable=local&&/^[\w.-]+$/.test(local.assetName)&&await fs.readFile(path.join(root,'img',local.assetName)).then(b=>sha(b)===hash,()=>false),assetName=reusable?local.assetName:hash.slice(0,24)+'.'+format;if(!reusable)await fs.writeFile(path.join(root,'img',assetName),bytes);return {assetName,sha256:hash,bytes:bytes.length,url,provider:'wiki'};})());mappings.push({...row,...await downloaded.get(url)});
}catch(e){failures.push({id:row.id,imageName:row.imageName,error:e.message});}finally{done++;if(done%30===0)console.log('Images',done+'/'+selected.length);}}}));
mappings.sort((a,b)=>a.id.localeCompare(b.id));const index={schemaVersion:1,checkedAt:new Date().toISOString(),basis:'Wiki General.InternalName exact ID; explicit Plus agent.avatarTypes join only; no fuzzy-name match',mappings,failures,summary:{enemies:enemies.length,matched: selected.length,available:mappings.length,files:new Set(mappings.map(r=>r.assetName)).size,missing:enemies.length-mappings.length}};
const indexFile=path.join(root,'enemy-image-index.json'),temporary=indexFile+'.'+process.pid+'.tmp';await fs.writeFile(temporary,JSON.stringify(index,null,2)+'\n');await fs.rename(temporary,indexFile);await fs.mkdir('artifacts/enemy-images',{recursive:true});await fs.writeFile('artifacts/enemy-images/report.json',JSON.stringify(index,null,2)+'\n');console.log(JSON.stringify(index.summary));
}finally{await agent.close();}
