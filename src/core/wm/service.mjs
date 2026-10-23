import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fetch, EnvHttpProxyAgent, ProxyAgent } from 'undici';
import { atomicJson } from '../io.mjs';
import { checkSlug, checkContext, normalizeItems, normalizeSet, normalizeOrders, normalizeStatistics, searchItems } from './model.mjs';
import { normalizeRivenWeapons, normalizeRivenAttributes, auctionQuery, normalizeAuctions, filterAuctionWindow } from './auctions.mjs';
const API = 'https://api.warframe.market', MAX_BYTES = 16 * 1024 * 1024;
const agent = new EnvHttpProxyAgent();
async function download(url, {platform = 'pc', crossplay = false, proxyUrl} = {}) {
  const dispatcher = proxyUrl ? new ProxyAgent(proxyUrl) : agent;
  try {
    const res = await fetch(url, {dispatcher, signal: AbortSignal.timeout(20000), redirect:'error', headers:{Accept:'application/json', Language:'zh-hans', Platform:platform, Crossplay:String(crossplay), 'User-Agent':'SourceWorkbench/0.14.1 (local Warframe reference tool; WM read-only integration)'}});
    if (!res.ok) { await res.body?.cancel(); throw new Error(`WM 返回 HTTP ${res.status}${res.status === 429 ? '，请稍后刷新' : ''}`); }
    const chunks = []; let size = 0;
    for await (const chunk of res.body) { size += chunk.length; if (size > MAX_BYTES) throw new Error('WM 响应超过 16 MiB'); chunks.push(chunk); }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } finally { if (proxyUrl) await dispatcher.close(); }
}
export class WmService {
  constructor(root, {request = download, now = Date.now, interval = 400} = {}) {
    this.root = root; this.request = request; this.now = now; this.interval = interval; this.pending = new Map(); this.memory = new Map(); this.queue = Promise.resolve(); this.lastStart = 0;
  }
  async network(url, options) {
    const run = this.queue.then(async () => {
      const wait = this.interval - (Date.now() - this.lastStart); if (wait > 0) await new Promise(r => setTimeout(r, wait));
      this.lastStart = Date.now(); return this.request(url, options);
    });
    this.queue = run.catch(() => {}); return run;
  }
  async cached(key, url, ttl, parse, options = {}) {
    if (this.pending.has(key)) return this.pending.get(key);
    const task = (async () => {
      let old = this.memory.get(key);
      if (!old) try {
        const file = path.join(this.root, key+'.json'), stat = await fs.stat(file); if (stat.size > MAX_BYTES * 3) throw new Error('缓存过大');
        const row = JSON.parse(await fs.readFile(file,'utf8'));
        if (row.source === url && Number.isFinite(Date.parse(row.fetchedAt)) && Date.parse(row.fetchedAt) <= this.now()+60000) { parse(row.raw); old = row; this.memory.set(key, old); }
      } catch { /* Missing or malformed caches are not market data. */ }
      if (old && !options.refresh && this.now() - Date.parse(old.fetchedAt) < ttl) return {data:parse(old.raw), fetchedAt:old.fetchedAt, source:url, cached:true, stale:false, error:null};
      try {
        const raw = await this.network(url, options), data = parse(raw), fetchedAt = new Date(this.now()).toISOString();
        const row = {source:url, fetchedAt, raw}; await atomicJson(path.join(this.root,key+'.json'),row); this.memory.set(key,row);
        return {data, fetchedAt, source:url, cached:false, stale:false, error:null};
      } catch (error) {
        const message = error.name === 'TimeoutError' ? 'WM 请求超时，请检查网络或稍后刷新' : error.message;
        if (old) return {data:parse(old.raw), fetchedAt:old.fetchedAt, source:url, cached:true, stale:true, error:message};
        throw new Error(message);
      }
    })();
    this.pending.set(key,task); try {return await task;} finally {this.pending.delete(key);}
  }
  async catalog(options = {}) {
    return this.cached('items-zh-hans', API+'/v2/items', 6*3600000, raw => { if(raw?.error) throw new Error('WM 物品目录返回错误'); return normalizeItems(raw?.data); }, options);
  }
  async search({query = '', refresh = false} = {}, options = {}) {
    if (typeof refresh !== 'boolean') throw new Error('刷新参数无效'); searchItems([], query);
    const result = await this.catalog({...options,refresh}); const {data,...meta} = result;
    return {...meta, total:data.length, items:searchItems(data, query)};
  }
  async item(slug, options) {checkSlug(slug); const catalog = await this.catalog(options); const item = catalog.data.find(i => i.slug === slug); if (!item) throw new Error('WM 目录中没有此物品，请刷新目录'); return item;}
  async itemSet({slug, refresh = false} = {}, options = {}) {
    checkSlug(slug); if (typeof refresh !== 'boolean') throw new Error('刷新参数无效');
    const result = await this.cached('set-'+slug,API+'/v2/item/'+slug+'/set',24*3600000,raw=>normalizeSet(raw,slug),{...options,refresh});
    const {data,...meta}=result;return {...meta,...data};
  }
  async rivenCatalog({refresh = false} = {}, options = {}) {
    if (typeof refresh !== 'boolean') throw new Error('刷新参数无效');
    const [weapons,attributes] = await Promise.all([
      this.cached('riven-weapons',API+'/v2/riven/weapons',24*3600000,normalizeRivenWeapons,{...options,refresh}),
      this.cached('riven-attributes',API+'/v2/riven/attributes',24*3600000,normalizeRivenAttributes,{...options,refresh}),
    ]);
    return {weapons:weapons.data,attributes:attributes.data,fetchedAt:[weapons.fetchedAt,attributes.fetchedAt].sort()[0],stale:weapons.stale||attributes.stale,cached:weapons.cached&&attributes.cached,error:[weapons.error,attributes.error].filter(Boolean).join('；')||null};
  }
  async auctions({platform = 'pc',filters = {},refresh = false} = {}, options = {}) {
    checkContext(platform); if (typeof refresh !== 'boolean') throw new Error('刷新参数无效');
    const catalog = await this.rivenCatalog({},options), params = auctionQuery(filters,catalog.weapons,catalog.attributes), query=params.toString();
    const latest=!params.has('weapon_url_name')&&!params.has('positive_stats');
    const url=API+(latest?'/v1/auctions?type=riven':'/v1/auctions/search?'+query), hash=createHash('sha256').update(query).digest('hex');
    const key=latest?`auctions-latest-${platform}`:`auctions-${platform}-${hash}`;
    const result=await this.cached(key,url,60000,normalizeAuctions,{...options,platform,crossplay:false,refresh});
    const {data,...meta}=result;return {...meta,platform,auctions:latest?filterAuctionWindow(data,filters):data,windowCount:data.length,latest,limitReached:data.length>=100,legacy:true,catalogError:catalog.error};
  }
  async orders({slug, platform = 'pc', crossplay = false, refresh = false} = {}, options = {}) {
    checkSlug(slug); const context = checkContext(platform,crossplay); if (typeof refresh !== 'boolean') throw new Error('刷新参数无效');
    const item = await this.item(slug, options);
    const result = await this.cached(`orders-${platform}-${context.crossplay}-${slug}`, API+'/v2/orders/item/'+slug, 30000, raw => { if(raw?.error) throw new Error('WM 订单接口返回错误'); return normalizeOrders(raw?.data,item.id); }, {...options,...context,refresh});
    const {data,...meta} = result; return {...meta,...context,item,orders:data};
  }
  async statistics({slug, platform = 'pc', refresh = false} = {}, options = {}) {
    checkSlug(slug);checkContext(platform); if (typeof refresh !== 'boolean') throw new Error('刷新参数无效');
    const item = await this.item(slug, options), url = API+'/v1/items/'+slug+'/statistics';
    try {
      const result = await this.cached(`statistics-${platform}-${slug}`,url,5*60000,normalizeStatistics,{...options,platform,crossplay:false,refresh});
      const {data,...meta} = result; return {...meta,platform,item,windows:data,available:true,legacy:true};
    } catch(error) {
      return {platform,item,source:url,fetchedAt:null,available:false,legacy:true,error:error.message,windows:{'48hours':[],'90days':[]}};
    }
  }
}
