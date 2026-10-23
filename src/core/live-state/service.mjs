import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fetch, EnvHttpProxyAgent, ProxyAgent } from 'undici';
import { atomicJson, sha256 } from '../io.mjs';
export const LIVE_SOURCES = Object.freeze({de:'https://api.warframe.com/cdn/worldState.php',wg:'https://content-zhpt.wf.qq.com/dynamic/worldState.php'});
const MAX = 16 * 1024 * 1024, envAgent = new EnvHttpProxyAgent();
export function validateWorldState(bytes) {
  if (!(typeof bytes === 'string' || Buffer.isBuffer(bytes)) || Buffer.byteLength(bytes)>MAX) throw new Error('世界状态文件需小于 16 MiB');
  const value=JSON.parse(bytes.toString().replace(/^\uFEFF/,''));
  if (!value || typeof value!=='object' || Array.isArray(value) || !Number.isFinite(value.Time) || !Number.isFinite(new Date(value.Time*1000).getTime()) || !['ActiveMissions','SyndicateMissions','Sorties','SeasonInfo'].some(k=>Object.hasOwn(value,k))) throw new Error('不是有效的官方世界状态 JSON');
  return value;
}
export function checkServer(server) {if (!Object.hasOwn(LIVE_SOURCES,server)) throw new Error('服务器必须为 de 或 wg');return server;}
async function download(url,{proxyUrl}={}) {
  const dispatcher=proxyUrl?new ProxyAgent(proxyUrl):envAgent;
  try {
    const response=await fetch(url,{dispatcher,signal:AbortSignal.timeout(18000),headers:{accept:'application/json','User-Agent':'SourceWorkbench/0.14.1'}});
    if (!response.ok) {await response.body?.cancel();throw new Error('HTTP '+response.status);}
    const chunks=[];let size=0;
    for await (const chunk of response.body) {size+=chunk.length;if(size>MAX) {throw new Error('世界状态响应超过 16 MiB');}chunks.push(chunk);}
    return Buffer.concat(chunks);
  } finally {if(proxyUrl) await dispatcher.close();}
}
export class LiveStateStore {
  constructor(root,{request=download,now=Date.now}={}) {this.root=root;this.request=request;this.now=now;this.pending=new Map();}
  file(server) {return path.join(this.root,checkServer(server)+'.json');}
  async cached(server) {
    checkServer(server);
    try {
      const row=JSON.parse(await fs.readFile(this.file(server),'utf8'));
      if(row.server!==server || row.hash!==sha256(JSON.stringify(row.raw))) throw new Error('缓存校验失败');
      validateWorldState(JSON.stringify(row.raw));return row;
    } catch {return null;}
  }
  async sample(server) {
    const bytes=await fs.readFile(new URL(`../../data/live-state/${checkServer(server)}-sample.json`,import.meta.url));
    const raw=validateWorldState(bytes);return {server,kind:'sample',source:LIVE_SOURCES[server],fetchedAt:null,hash:sha256(JSON.stringify(raw)),raw};
  }
  async current(server) {return await this.cached(server) ?? this.sample(server);}
  async refresh(server,options={}) {
    checkServer(server);if(this.pending.has(server)) return this.pending.get(server);
    const task=(async()=>{
      const previous=await this.cached(server);
      try {
        const raw=validateWorldState(await this.request(LIVE_SOURCES[server],options));
        if(previous?.kind==='network' && raw.Time<previous.raw.Time) throw new Error('上游时间早于已有快照，保留原缓存');
        const row={server,kind:'network',source:LIVE_SOURCES[server],fetchedAt:new Date(this.now()).toISOString(),hash:sha256(JSON.stringify(raw)),raw};
        await atomicJson(this.file(server),row);return {...row,refreshError:null};
      } catch(error) {return {...(previous ?? await this.sample(server)),refreshError:error.message};}
    })();this.pending.set(server,task);
    try{return await task;}finally{this.pending.delete(server);}
  }
  async import(server,file) {
    checkServer(server);if(this.pending.has(server)) throw new Error('此服务器正在刷新，请稍后导入');
    const task=(async()=>{
      const stat=await fs.stat(file);if(!stat.isFile()||stat.size>MAX) throw new Error('请选择不超过 16 MiB 的 JSON 文件');
      const raw=validateWorldState(await fs.readFile(file));
      const row={server,kind:'import',source:'local-import',fetchedAt:new Date(this.now()).toISOString(),hash:sha256(JSON.stringify(raw)),raw};
      await atomicJson(this.file(server),row);return row;
    })();
    this.pending.set(server,task);
    try{return await task;}finally{this.pending.delete(server);}
  }
}
