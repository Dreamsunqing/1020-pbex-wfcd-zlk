import {_electron as electron,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {auctionQuery,normalizeRivenWeapons,normalizeRivenAttributes} from '../src/core/wm/auctions.mjs';

const root=process.cwd(),profile=await fs.mkdtemp(path.join(os.tmpdir(),'wb-wm-extension-ui-')),output=path.resolve('artifacts/wm-extension/ui');
await fs.mkdir(path.join(profile,'wm'),{recursive:true});await fs.mkdir(output,{recursive:true});
// Explicit fixtures in a disposable profile; live verification is recorded separately.
const named=(id,slug,name,extra={})=>({id,slug,i18n:{en:{name:name.replace('一套','Set').replace('蓝图','Blueprint')},'zh-hans':{name}},...extra});
const items=[named('root','gauss_prime_set','Gauss Prime 一套',{setRoot:true}),...['blueprint','chassis_blueprint','neuroptics_blueprint','systems_blueprint'].map((s,i)=>named('part-'+i,'gauss_prime_'+s,['Gauss Prime 蓝图','Gauss Prime 机体 蓝图','Gauss Prime 头部 蓝图','Gauss Prime 系统 蓝图'][i],{setRoot:false,quantityInSet:1}))];
const rawWeapons={data:[named('torid','torid','托里德',{rivenType:'rifle'}),named('okina','okina','翁',{rivenType:'melee'})]};
const rawAttributes={data:[named('cc','critical_chance','暴击率',{unit:'percent'}),named('cd','critical_damage','暴击伤害',{unit:'percent'}),named('ms','multishot','多重射击',{exclusiveTo:['rifle'],unit:'percent'}),named('zoom','zoom','变焦',{exclusiveTo:['rifle'],unit:'percent'})]};
const weapons=normalizeRivenWeapons(rawWeapons),attributes=normalizeRivenAttributes(rawAttributes);
const auctions=Array.from({length:43},(_,i)=>({id:'test-auction-'+i,visible:true,private:false,closed:false,is_direct_sell:i%2===0,starting_price:20+i,buyout_price:i%2===0?200+i:null,top_bid:i%2===0?null:50+i,platform:'pc',owner:{ingame_name:'FixtureSeller'+i,status:i===0?'offline':i%3?'ingame':'online',reputation:i},item:{type:'riven',weapon_url_name:'torid',name:'critatis',mod_rank:8,mastery_level:12,re_rolls:i,polarity:'naramon',attributes:[{url_name:'critical_chance',value:156,positive:true},{url_name:'zoom',value:-50,positive:false}]}}));
async function cache(name,url,raw){await fs.writeFile(path.join(profile,'wm',name+'.json'),JSON.stringify({source:'https://api.warframe.market'+url,raw,fetchedAt:new Date().toISOString()}));}
await cache('items-zh-hans','/v2/items',{data:items});
for(const i of items){
 await cache('set-'+i.slug,'/v2/item/'+i.slug+'/set',{data:{id:i.id,items}});
 await cache('orders-pc-false-'+i.slug,'/v2/orders/item/'+i.slug,{data:['buy','sell'].map((type,j)=>({id:i.id+'-'+type,itemId:i.id,type,visible:true,platinum:10+j,quantity:2,user:{ingameName:'Trader-'+i.id,status:'ingame',reputation:1,platform:'pc'}}))});
 await cache('statistics-pc-'+i.slug,'/v1/items/'+i.slug+'/statistics',{payload:{statistics_closed:{'90days':[{datetime:'2026-10-22T00:00:00Z',median:20,avg_price:21,volume:5},{datetime:'2026-10-23T00:00:00Z',median:22,avg_price:23,volume:8}]}}});
}
await cache('riven-weapons','/v2/riven/weapons',rawWeapons);await cache('riven-attributes','/v2/riven/attributes',rawAttributes);
async function auctionCache(filters,platform='pc',rows=auctions){const p=auctionQuery(filters,weapons,attributes),q=p.toString(),hash=createHash('sha256').update(q).digest('hex'),latest=!p.has('weapon_url_name')&&!p.has('positive_stats');await cache(latest?'auctions-latest-'+platform:'auctions-'+platform+'-'+hash,latest?'/v1/auctions?type=riven':'/v1/auctions/search?'+q,{payload:{auctions:rows}});}
await auctionCache({});await auctionCache({weapon:'okina'},'xbox',[]);
const checks=[],errors=[],network=[];let app;const pass=s=>{checks.push(s);console.log('PASS',s);};
try{
 const env={...process.env,WORKBENCH_ROOT:root,WORKBENCH_USER_DATA:profile};delete env.ELECTRON_RUN_AS_NODE;
 app=await electron.launch({args:[root],env,timeout:60000});const page=await app.firstWindow();
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url());});
 await page.waitForFunction(()=>window.smokeReady||window.smokeError,null,{timeout:30000});expect(await page.evaluate(()=>window.smokeError)).toBeUndefined();
 await page.locator('[data-panel=wm]').click();await page.locator('#wm-search').fill('Gauss Prime 一套');await page.locator('.wm-suggestion').first().click();
 await expect(page.locator('.wm-set-member')).toHaveCount(5);await expect(page.locator('.wm-set-member.selected')).toHaveAttribute('data-slug','gauss_prime_set');
 await page.locator('#wm-order-type').selectOption('buy');await page.locator('#wm-status').selectOption('ingame');await page.locator('#wm-max').fill('100');
 await page.locator('[data-wm-tab=statistics]').click();await expect(page.locator('.wm-chart-wrap')).toBeVisible();
 await page.locator('.wm-set-member[data-slug=gauss_prime_chassis_blueprint]').click();await expect(page.locator('#wm-search')).toHaveValue('Gauss Prime 机体 蓝图');
 await expect(page.locator('#wm-item-heading h2')).toHaveText('Gauss Prime 机体 蓝图');await expect(page.locator('.wm-set-member.selected')).toHaveAttribute('data-slug','gauss_prime_chassis_blueprint');await expect(page.locator('#wm-stat-panel')).toBeVisible();await expect(page.locator('.wm-chart-wrap')).toBeVisible();
 await expect(page.locator('#wm-order-type')).toHaveValue('buy');await expect(page.locator('#wm-status')).toHaveValue('ingame');await expect(page.locator('#wm-max')).toHaveValue('100');
 await page.locator('[data-wm-tab=orders]').click();await expect(page.locator('.wm-copy')).toHaveText('复制出售私聊');await page.locator('.wm-copy').click();const copied=await app.evaluate(({clipboard})=>clipboard.readText());expect(copied).toContain('sell: Gauss Prime 机体 Blueprint');expect(copied).not.toContain('Set');pass('整套与部件切换同步搜索框、标题、统计和复制物品；保留一般筛选');
 await page.locator('.wm-set-member[data-slug=gauss_prime_set]').click();await page.locator('.wm-set-member[data-slug=gauss_prime_systems_blueprint]').click();await expect(page.locator('#wm-item-heading h2')).toHaveText('Gauss Prime 系统 蓝图');await expect(page.locator('.wm-orders-table')).toContainText('Trader-part-3');pass('快速切换成员后只显示最后物品订单');
 await page.locator('[data-wm-mode=rivens]').click();await expect(page.locator('.wm-auction-card')).toHaveCount(20);await expect(page.locator('#wm-auction-count')).toContainText('42 条');await expect(page.locator('.wm-riven-stats').first()).toContainText('+156% 暴击率');
 await expect(page.locator('#wm-auction-list')).toContainText('起拍价');await expect(page.locator('#wm-auction-list')).toContainText('当前出价');
 await page.locator('#wm-auction-next').click();await expect(page.locator('#wm-auction-count')).toContainText('21–40');await expect(page.locator('#wm-auction-list')).toContainText('一口价');await page.locator('#wm-auction-status').selectOption('all');await expect(page.locator('#wm-auction-count')).toContainText('43 条');pass('拍卖属性、价格类型、卖家状态和本次结果分页');
 await page.locator('#wm-riven-weapon').fill('weng');await expect(page.locator('.wm-no-hints')).toContainText('没有匹配');await page.locator('#wm-riven-weapon').fill('okina');await page.locator('#wm-riven-weapon').press('ArrowDown');await page.locator('#wm-riven-weapon').press('Enter');await expect(page.locator('#wm-riven-weapon')).toHaveValue('翁');
 await expect(page.locator('#wm-riven-positive-1 option[value=multishot]')).toHaveCount(0);await page.locator('#wm-auction-platform').selectOption('xbox');await expect(page.locator('#wm-auction-list')).toContainText('没有符合条件');pass('中英文武器提示、键盘选择、词条适用类型及平台切换空结果');
 await page.locator('#wm-riven-weapon').fill('未选中的武器');await page.locator('#wm-auction-search').click();await expect(page.locator('#wm-auction-error')).toContainText('请从搜索提示中选择武器');await page.locator('#wm-riven-clear').click();
 await page.locator('#wm-riven-positive-1').selectOption('critical_chance');await page.locator('#wm-riven-positive-2').selectOption('critical_chance');await page.locator('#wm-auction-search').click();await expect(page.locator('#wm-auction-error')).toContainText('最多 3');pass('未选中武器和重复词条明确校验，不误查任何武器');
 // Deterministic asynchronous UI race and fault checks; no remote data involved.
 await page.evaluate(async()=>{
  const {createRivenUI}=await import('./wm-rivens.js');const ui=(await import('./app.js')).wmUI.rivens;
  const catalog=ui.state.catalog;
  const testUI=createRivenUI({api:{call:async(method,args)=>{if(method==='wmRivenCatalog')return catalog;if(args.platform==='ps4')throw new Error('HTTP 502');await new Promise(r=>setTimeout(r,args.platform==='pc'?120:5));return {auctions:[],platform:args.platform,fetchedAt:new Date().toISOString()};},images:async()=>[]},guarded:fn=>fn()});
  window.wmRaceUI=testUI;await testUI.enter();document.getElementById('wm-auction-platform').value='pc';const old=testUI.search();document.getElementById('wm-auction-platform').value='xbox';await testUI.search();await old;
 });
 await expect(page.locator('#wm-auction-meta')).toContainText('XBOX');await page.locator('#wm-auction-platform').selectOption('ps4');await expect(page.locator('#wm-auction-error')).toContainText('HTTP 502');await expect(page.locator('#wm-auction-list')).toContainText('本次查询未完成');pass('异步旧查询不能覆盖新平台；失败清除旧列表并显示错误');
 await page.setViewportSize({width:1080,height:1000});await page.locator('#theme-select').selectOption('light');await page.locator('#wm').evaluate(n=>n.scrollTop=0);expect(await page.locator('#wm').evaluate(n=>n.scrollWidth<=n.clientWidth+1)).toBe(true);await page.screenshot({path:path.join(output,'rivens-light-1080.png')});
 await page.setViewportSize({width:800,height:950});await page.locator('#theme-select').selectOption('dark');expect(await page.locator('#wm').evaluate(n=>n.scrollWidth<=n.clientWidth+1)).toBe(true);await page.screenshot({path:path.join(output,'rivens-dark-800.png')});pass('1080 与 800 宽度无页面横向溢出，深浅主题');
 expect(errors).toEqual([]);expect(network).toEqual([]);await fs.writeFile(path.join(output,'report.json'),JSON.stringify({ok:true,fixtures:true,checks,errors,rendererExternalRequests:network},null,2));
}catch(error){process.exitCode=1;console.error(error);if(app)await(await app.firstWindow()).screenshot({path:path.join(output,'failure.png')});}
finally{await app?.close();await fs.rm(profile,{recursive:true,force:true});}
