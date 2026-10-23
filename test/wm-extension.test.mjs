import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {normalizeSet} from '../src/core/wm/model.mjs';
import {normalizeRivenWeapons,normalizeRivenAttributes,auctionQuery,normalizeAuctions,filterAuctions,filterAuctionWindow,attributeValue} from '../src/core/wm/auctions.mjs';
import {WmService} from '../src/core/wm/service.mjs';

const named=(id,slug,name,extra={})=>({id,slug,i18n:{en:{name},'zh-hans':{name}},...extra});
const set=named('root','gauss_prime_set','Gauss Prime 一套',{setRoot:true,setParts:['part','root']});
const part=named('part','gauss_prime_blueprint','Gauss Prime 蓝图',{quantityInSet:1});
const weapons=normalizeRivenWeapons({data:[named('torid','torid','托里德',{rivenType:'rifle'}),named('okina','okina','翁',{rivenType:'melee'})]});
const attributes=normalizeRivenAttributes({data:[named('cc','critical_chance','暴击率',{unit:'percent'}),named('speed','fire_rate_/_attack_speed','射速/攻击速度',{unit:'percent'}),named('ms','multishot','多重射击',{exclusiveTo:['rifle']}),named('heat','heat_damage','火焰伤害',{positiveOnly:true})]});
const listing=(extra={})=>({id:'auction-1',visible:true,private:false,closed:false,starting_price:100,buyout_price:500,top_bid:120,is_direct_sell:false,platform:'pc',owner:{ingame_name:'Seller',status:'ingame',reputation:2},item:{type:'riven',weapon_url_name:'torid',name:'critatis',mod_rank:8,mastery_level:12,re_rolls:20,attributes:[{url_name:'critical_chance',value:156,positive:true},{url_name:'zoom',value:-50,positive:false}]},...extra});
const temp=async t=>{const dir=await fs.mkdtemp(path.join(os.tmpdir(),'wb-wm-extension-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));return dir;};

test('WM 套装从任意成员返回整组，以 ID 区分整套和部件，不递归制造材料',()=>{
  const r=normalizeSet({data:{id:'part',items:[part,set]}},part.slug);
  assert.equal(r.id,'part');assert.equal(r.items[0].setRoot,true);assert.equal(r.items[1].quantityInSet,1);
  assert.equal(normalizeSet({data:{id:'part',items:[part]}},part.slug).items.length,1);
  assert.throws(()=>normalizeSet({data:{id:'root',items:[part]}},part.slug));
  assert.throws(()=>normalizeSet({data:{id:'part',items:[part,part]}},part.slug));
  assert.throws(()=>normalizeSet({data:{id:'part',items:[part]}},set.slug));
});
test('裂罅参数按目录验证，特殊词条名使用 URL 编码且只包含公开搜索参数',()=>{
  const q=auctionQuery({weapon:'torid',positive:['critical_chance','fire_rate_/_attack_speed'],negative:'none',masteryMin:7,masteryMax:16,rollsMin:0,rollsMax:10,rank:'maxed',kind:'direct',sort:'price_asc'},weapons,attributes);
  assert.equal(q.get('weapon_url_name'),'torid');assert.equal(q.get('positive_stats'),'critical_chance,fire_rate_/_attack_speed');assert.match(q.toString(),/%2F/);
  assert.equal(q.get('negative_stats'),'none');assert.equal(q.get('mod_rank'),'maxed');assert.equal(q.get('re_rolls_min'),'0');
  for(const invalid of [{weapon:'not_a_weapon'},{positive:['critical_chance','critical_chance']},{positive:['a','b','c','d']},{weapon:'okina',positive:['multishot']},{negative:'heat_damage'},{positive:['critical_chance'],negative:'critical_chance'},{masteryMin:6},{rollsMin:20,rollsMax:10},{masteryMin:16,masteryMax:7},{rank:8},{sort:'created_desc'},{url:'https://example.com'},{polarity:'bogus'}])assert.throws(()=>auctionQuery(invalid,weapons,attributes));
});
test('拍卖展示保留起拍、一口价、当前出价及原始词条方向，剔除关闭、隐藏和私人挂单',()=>{
  const rows=normalizeAuctions({payload:{auctions:[listing(),listing(),listing({id:'private',private:true}),listing({id:'hidden',visible:false}),listing({id:'closed',closed:true}),listing({id:'offline',owner:{ingame_name:'Offline',status:'offline'}}),listing({id:'direct',is_direct_sell:true,buyout_price:250,top_bid:null}),listing({id:'invalid',item:{type:'lich'}})]}});
  assert.equal(rows.length,3);assert.equal(rows[0].startingPrice,100);assert.equal(rows[0].buyoutPrice,500);assert.equal(rows[0].topBid,120);assert.equal(rows[2].direct,true);
  assert.equal(filterAuctions(rows).length,2);assert.equal(filterAuctions(rows,'all').length,3);assert.throws(()=>filterAuctions(rows,'invalid'));
  assert.equal(attributeValue(rows[0].attributes[0],attributes[0]),'+156%');assert.equal(attributeValue({value:-2},{unit:'m'}),'-2 m');
  assert.equal(attributeValue({value:1.45},{unit:'multiply'}),'×1.45');assert.equal(attributeValue({value:2},{unit:'seconds'}),'+2 秒');
  const special=normalizeRivenWeapons({data:[named('dark','dark_split_sword_(dual_swords)','Dark Split-Sword')]});assert.equal(special.length,1);assert.equal(auctionQuery({weapon:special[0].slug},special,attributes).get('weapon_url_name'),special[0].slug);
  assert.throws(()=>normalizeAuctions({payload:{}}));
  assert.equal(filterAuctionWindow(rows,{negative:'none'}).length,0);assert.equal(filterAuctionWindow(rows,{negative:'has',kind:'direct'}).length,1);
  assert.equal(filterAuctionWindow(rows,{rollsMax:10}).length,0);assert.equal(filterAuctionWindow(rows,{rank:'maxed',masteryMin:12}).length,3);
});
test('无武器与正面词条时读取最新挂单窗口，明确标记局部筛选并共享窗口缓存',async t=>{
 const dir=await temp(t),urls=[];const service=new WmService(dir,{interval:0,request:async url=>{urls.push(url);if(url.endsWith('/weapons'))return {data:[named('torid','torid','托里德',{rivenType:'rifle'})]};if(url.endsWith('/attributes'))return {data:[named('cc','critical_chance','暴击率')]};assert.equal(url,'https://api.warframe.market/v1/auctions?type=riven');return {payload:{auctions:[listing(),listing({id:'direct',is_direct_sell:true,buyout_price:250})]}};}});
 const all=await service.auctions();assert.equal(all.latest,true);assert.equal(all.windowCount,2);assert.equal(all.auctions[0].id,'direct');
 const direct=await service.auctions({filters:{kind:'direct'}});assert.equal(direct.latest,true);assert.equal(direct.auctions.length,1);assert.equal(urls.length,3);
 const none=await service.auctions({filters:{rollsMax:10}});assert.equal(none.windowCount,2);assert.equal(none.auctions.length,0);
});
test('套装请求合并、关系缓存及失败回退，切换成员不依赖普通搜索目录',async t=>{
  let calls=0,fail=false;const dir=await temp(t),service=new WmService(dir,{interval:0,request:async url=>{calls++;assert.equal(url,'https://api.warframe.market/v2/item/gauss_prime_blueprint/set');if(fail)throw new Error('HTTP 502');return {data:{id:'part',items:[part,set]}};}});
  const [a,b]=await Promise.all([service.itemSet({slug:part.slug}),service.itemSet({slug:part.slug})]);assert.equal(calls,1);assert.equal(a.items.length,2);assert.deepEqual(a,b);
  assert.equal((await service.itemSet({slug:part.slug})).cached,true);fail=true;
  const old=await service.itemSet({slug:part.slug,refresh:true});assert.equal(old.stale,true);assert.equal(old.fetchedAt,a.fetchedAt);assert.equal(old.items.length,2);
  await assert.rejects(()=>service.itemSet({slug:'../escape'}));
});
test('拍卖查询共享限速、目录缓存，按平台和完整筛选隔离缓存，失败只回退同一查询',async t=>{
  const dir=await temp(t),urls=[];let failure=false;
  const service=new WmService(dir,{interval:0,request:async (url,options)=>{
    urls.push({url,platform:options.platform});if(failure)throw new Error('HTTP 502');
    if(url.endsWith('/weapons'))return {data:[named('torid','torid','托里德',{rivenType:'rifle'})]};
    if(url.endsWith('/attributes'))return {data:[named('cc','critical_chance','暴击率')]};
    assert.ok(url.startsWith('https://api.warframe.market/v1/auctions/search?'));
    return {payload:{auctions:[listing({buyout_price:options.platform==='xbox'?900:500})]}};
  }});
  const first=await service.auctions({filters:{weapon:'torid'}});assert.equal(urls.length,3);
  assert.equal((await service.auctions({filters:{weapon:'torid'}})).cached,true);assert.equal(urls.length,3);
  assert.equal((await service.auctions({platform:'xbox',filters:{weapon:'torid'}})).auctions[0].buyoutPrice,900);
  await service.auctions({filters:{weapon:'torid',positive:['critical_chance']}});assert.equal(urls.length,5);
  failure=true;const old=await service.auctions({filters:{weapon:'torid'},refresh:true});assert.equal(old.stale,true);assert.equal(old.fetchedAt,first.fetchedAt);
  await assert.rejects(()=>service.auctions({filters:{weapon:'torid',negative:'has'},refresh:true}),/502/);
  await assert.rejects(()=>service.auctions({platform:'bogus'}));
});
