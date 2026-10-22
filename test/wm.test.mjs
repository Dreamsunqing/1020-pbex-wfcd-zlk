import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {normalizeItems,searchItems,normalizeOrders,filterOrders,buildWhisper,normalizeStatistics,checkContext} from '../src/core/wm/model.mjs';
import {WmService} from '../src/core/wm/service.mjs';
const rawItem={id:'item-id',slug:'galvanized_chamber',gameRef:'/Lotus/Example',maxRank:10,i18n:{en:{name:'Galvanized Chamber'},'zh-hans':{name:'镀层 分裂膛室'}}};
const item=normalizeItems([rawItem])[0];
const order=(extra={})=>({id:'order-id',itemId:item.id,type:'sell',platinum:30,quantity:4,rank:0,perTrade:1,visible:true,user:{ingameName:'Example-Player',status:'ingame',reputation:5,platform:'pc'},...extra});
const temp=async t=>{const dir=await fs.mkdtemp(path.join(os.tmpdir(),'wb-wm-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));return dir;};
test('中英文搜索去空格并保留 WM 独立 ID，不按中文名合并',()=>{
 const items=normalizeItems([rawItem,{...rawItem,id:'other-id',slug:'another_item',i18n:{en:{name:'Another Item'},'zh-hans':{name:item.name}}}]);
 assert.equal(searchItems(items,'镀层分裂膛室').length,2);assert.equal(searchItems(items,'GALVANIZED CHAMBER')[0].id,item.id);assert.equal(searchItems(items,'galvanized_chamber')[0].slug,item.slug);assert.equal(searchItems(items,'')[0],undefined);assert.throws(()=>searchItems(items,'x'.repeat(181)));
});
test('订单过滤区分离线、等级和买卖方向，批量排序按单件价',()=>{
 const rows=normalizeOrders([order(),order({id:'offline',user:{ingameName:'Offline',status:'offline'}}),order({id:'bulk',perTrade:4,platinum:60,rank:10}),order({id:'buy',type:'buy',platinum:35}),order({id:'hidden',visible:false}),order({id:'wrong-item',itemId:'other'}),order({id:'broken',platinum:'30'})],item.id);
 assert.equal(rows.length,4);assert.deepEqual(filterOrders(rows).map(o=>o.id),['bulk','order-id']);assert.equal(filterOrders(rows,{rank:'0',status:'all'}).length,2);assert.equal(filterOrders(rows,{type:'buy'})[0].id,'buy');assert.equal(filterOrders(rows,{max:'40'}).length,1);assert.throws(()=>filterOrders(rows,{min:'50',max:'20'}));assert.deepEqual(checkContext('switch',true),{platform:'switch',crossplay:false});
});
test('游戏私聊保留英文名、买卖方向、真实价格与物品属性，不接受命令换行',()=>{
 const sell=normalizeOrders([order({perTrade:2,charges:3,subtype:'blueprint',amberStars:1,cyanStars:2})],item.id)[0];
 assert.equal(buildWhisper(item,sell),'/w Example-Player Hi! I want to buy: 2 x Galvanized Chamber (rank 0, 3 charges, blueprint, 1 amber stars, 2 cyan stars) for 30 platinum. (warframe.market)');assert.match(buildWhisper(item,{...sell,type:'buy'}),/want to sell:/);assert.throws(()=>buildWhisper(item,{...sell,user:{ingameName:'Player\n/w Other'}}));assert.throws(()=>buildWhisper(item,{...sell,user:{ingameName:'Player /bad'}}));
});
test('旧版统计保留等级、OHLC 和缺失值，不将挂单或空数据冒充历史成交',()=>{
 const result=normalizeStatistics({payload:{statistics_closed:{'48hours':[{datetime:'2026-10-22T00:00:00Z',mod_rank:0,volume:20,median:30,open_price:28,closed_price:32,min_price:27,max_price:34},{datetime:'bad',median:99}],'90days':[{datetime:'2026-10-21T00:00:00Z',mod_rank:10,volume:12,median:70}]},statistics_live:{'90days':[{median:999}]}}});
 assert.equal(result['48hours'].length,1);assert.equal(result['48hours'][0].rank,0);assert.equal(result['48hours'][0].moving_avg,null);assert.equal(result['90days'][0].median,70);assert.throws(()=>normalizeStatistics({payload:{statistics_live:{}}}));assert.equal(normalizeStatistics({payload:{statistics_closed:{'90days':[]}}})['90days'].length,0);
});
test('目录单飞、后台统一限速，订单与统计按平台隔离缓存',async t=>{
 const dir=await temp(t),starts=[];let calls=0;
 const service=new WmService(dir,{interval:15,request:async (url,options)=>{calls++;starts.push(Date.now());if(url.endsWith('/v2/items'))return {data:[rawItem]};if(url.endsWith('/statistics'))return {payload:{statistics_closed:{'90days':[]}}};return {data:[order({platinum:options.platform==='xbox'?90:30})]};}});
 await Promise.all([service.search({query:'镀层'}),service.search({query:'chamber'})]);assert.equal(calls,1);
 const [pc,xbox]=await Promise.all([service.orders({slug:item.slug}),service.orders({slug:item.slug,platform:'xbox'})]);assert.equal(pc.orders[0].platinum,30);assert.equal(xbox.orders[0].platinum,90);assert.equal((await service.orders({slug:item.slug})).cached,true);assert.equal(calls,3);
 await service.statistics({slug:item.slug});assert.equal(calls,4);assert.ok(starts.slice(1).every((time,i)=>time-starts[i]>=12));
 await assert.rejects(()=>service.orders({slug:'../../escape'}));await assert.rejects(()=>service.orders({slug:item.slug,platform:'bogus'}));
});
test('失败不会覆盖成功缓存；重启可离线读缓存；无历史数据时明确不可用',async t=>{
 const dir=await temp(t);let failure=false,time=Date.now();const service=new WmService(dir,{interval:0,now:()=>time,request:async url=>{if(failure)throw new Error('HTTP 502');return url.endsWith('/items')?{data:[rawItem]}:{data:[order()]};}});
 const first=await service.orders({slug:item.slug});failure=true;time+=31000;
 const old=await service.orders({slug:item.slug,refresh:true});assert.equal(old.stale,true);assert.equal(old.fetchedAt,first.fetchedAt);assert.match(old.error,/502/);assert.equal(JSON.parse(await fs.readFile(path.join(dir,'orders-pc-false-'+item.slug+'.json'))).fetchedAt,first.fetchedAt);
 const reboot=new WmService(dir,{interval:0,request:async()=>{throw new Error('离线');}});const cached=await reboot.orders({slug:item.slug});assert.equal(cached.cached,true);assert.equal(cached.orders[0].platinum,30);
 const stats=await service.statistics({slug:item.slug});assert.equal(stats.available,false);assert.deepEqual(stats.windows,{'48hours':[],'90days':[]});assert.equal(stats.fetchedAt,null);
});
