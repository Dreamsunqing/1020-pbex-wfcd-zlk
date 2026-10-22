import {_electron as electron,expect} from '@playwright/test';
import fs,{constants} from 'node:fs/promises';import path from 'node:path';import os from 'node:os';
import {scanLibrary} from '../src/core/library.mjs';import {digest} from '../src/core/merge/contract.mjs';
const root=process.cwd(),userData=await fs.mkdtemp(path.join(os.tmpdir(),'wb-presentation-')),executable=process.argv[2];
const output=path.resolve('artifacts/presentation-ui'+(executable?'-packaged':''));await fs.mkdir(output,{recursive:true});
const context=digest({mode:'local',root:(await scanLibrary(root)).root});const cache=path.join(root,'.workbench/merged',context),dest=path.join(userData,'snapshots/merged',context);
try{const current=JSON.parse(await fs.readFile(path.join(cache,'current.json'),'utf8'));await fs.cp(path.join(cache,'builds',current.datasetVersion),path.join(dest,'builds',current.datasetVersion),{recursive:true,mode:constants.COPYFILE_FICLONE});await fs.writeFile(path.join(dest,'current.json'),JSON.stringify({...current,previousVersion:null}));}catch{ /* Build in the isolated test profile if no cache exists. */ }
const errors=[],network=[],checks=[];let app;
const pass=message=>{checks.push(message);console.log('PASS',message);};
try{
 const env={...process.env,WORKBENCH_ROOT:root,WORKBENCH_IMAGE_ROOT:path.join(root,'assets/content'),WORKBENCH_USER_DATA:userData};delete env.ELECTRON_RUN_AS_NODE;
 app=await electron.launch({...(executable?{executablePath:path.resolve(executable),args:[]}:{args:[root]}),env,timeout:30000});
 const page=await app.firstWindow();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('requestfailed',r=>errors.push(r.url()+': '+r.failure()?.errorText));page.on('request',r=>{if(/^https?:/.test(r.url()))network.push(r.url());});
 await page.waitForFunction(()=>window.smokeReady||window.smokeError,null,{timeout:20000});
 expect(await page.evaluate(()=>window.smokeError)).toBeUndefined();await expect.poll(()=>page.locator('#files .file').count()).toBeGreaterThan(0);pass('首页初始化和目录正常，无 JSON 模块 CSP 拦截');
 await page.locator('#theme-select').selectOption('dark');
 const icons=await page.evaluate(async()=>{
   const {renderGameText}=await import('./game-text.js'),{inlineText}=await import('../core/inline-tokens.mjs');
   const registry=(await import('../data/inline-tokens.generated.mjs')).default;
   const box=document.createElement('div');box.id='icon-test';document.body.append(box);
   renderGameText(box,Object.keys(registry.entries).filter(k=>registry.entries[k].image).map(k=>'<'+k+'>').join(' '));
   await Promise.all([...box.querySelectorAll('img')].map(img=>img.decode()));
   const count=box.querySelectorAll('img').length;if(count<600)throw Error('真实图标覆盖不完整');
   const unsafe=document.createElement('p');renderGameText(unsafe,'<img src=x onerror=alert(1)>');if(unsafe.querySelector('img'))throw Error('未知 HTML 被执行');
   box.remove();return count;
 });pass(icons+' 个真实文本图标本地加载，无外网请求，未知标记不执行 HTML');
 await page.evaluate(async()=>{const ui=await import('./app.js');ui.activate('merged');await ui.mergeUI.enter();if(!ui.mergeUI.state.status.available)await ui.mergeUI.build();});
 await expect(page.locator('.merge-card-grid>.json-preview-card').first()).toBeVisible();
 const modId='/Lotus/Upgrades/Mods/Archwing/Rifle/ArchwingEventElectricStatusRifleMod';
 await page.evaluate(async id=>{await (await import('./app.js')).mergeUI.showDetail(id);},modId);
 const readField=async field=>page.evaluate(key=>{const row=[...document.querySelectorAll('.record-field')].find(row=>row.querySelector('.field-heading>code')?.textContent===key);return row?{text:row.querySelector('.record-field-content').innerText,icons:row.querySelectorAll('.record-field-content>.field-value img').length,heading:row.querySelector('.field-heading').innerText}:null;},field);
 const chinese=await readField('description.zh-CN');expect(chinese.text).toContain('+60%');expect(chinese.text).toContain('电击伤害');expect(chinese.heading).toContain('满级效果');expect(chinese.icons).toBe(1);
 const ranks=await page.evaluate(async id=>(await window.workbench.call('mergeDetail',{id})).item.attributes.levelStats,modId);expect(ranks.length).toBe(4);expect(ranks[0].stats[0]).toContain('电击伤害');
 await page.locator('#merge-locale').selectOption('en');await expect(page.locator('.json-record-title')).toHaveText('Charged Bullets');const english=await readField('description.en');expect(english.text).toContain('Electricity');expect(english.icons).toBe(1);
 await page.locator('#merge-locale').selectOption('zh-CN');await expect(page.locator('.json-record-title')).toHaveText('带电子弹');await page.locator('.record-field').filter({has:page.locator('.field-heading>code').filter({hasText:'description.zh-CN'})}).scrollIntoViewIfNeeded();await page.screenshot({path:path.join(output,'localized-mod.png')});
 await page.evaluate(async()=>{await (await import('./app.js')).mergeUI.showDetail('/Lotus/Powersuits/Volt/Abilities/ShockAbility');});expect((await readField('description.zh-CN')).text).toContain('一串电弧');await expect(page.locator('.json-record-title')).toContainText('电击');
 pass('带电子弹满级中文、四档等级、真实电击图标；中英文切换与电击技能描述正常');
 await page.evaluate(async()=>{const ui=await import('./app.js');ui.mergeUI.state.selected=null;ui.mergeUI.state.history=[];await ui.mergeUI.render();});
 await page.locator('#merge-search').fill('Neutralizer');await page.waitForFunction(async()=>(await import('./app.js')).mergeUI.state.query==='Neutralizer');await expect(page.locator('.merge-card-grid .json-card-title')).toHaveText(['肃清者']);await expect.poll(()=>page.locator('.merge-augment-link').count()).toBeGreaterThan(0);
 const badge=await page.locator('.merge-list-badges .merge-augment-link').first().evaluate(b=>{const r=b.getBoundingClientRect(),parent=b.closest('.merge-list-badges').getBoundingClientRect(),card=b.closest('.json-preview-card').getBoundingClientRect();return{visible:r.height>=20&&r.top>=parent.top&&r.bottom<=parent.bottom+1&&r.bottom<card.bottom,color:getComputedStyle(b).color};});expect(badge.visible).toBe(true);pass('强化卡按钮独立排布，无标题裁切');
 await page.screenshot({path:path.join(output,'augment-dark.png')});
 await page.locator('#merge-search').fill('ExaltedSniperBase');await expect(page.locator('.merge-card-grid>.json-preview-card')).toHaveCount(0);
 await page.locator('#merge-internal').check();await expect(page.locator('.merge-internal-badge')).toHaveCount(1);await page.locator('#merge-internal').uncheck();pass('内部继承定义默认隐藏，可手动显示');
 await page.locator('#merge-search').fill('');await page.waitForFunction(async()=>(await import('./app.js')).mergeUI.state.query==='');
 for(const view of ['issues','rewards']){
  await page.locator('[data-merge-view='+view+']').click();
  const selector=view==='issues'?'.merge-issue':'.merge-reward-table';await expect(page.locator(selector).first()).toBeVisible();
  const colors=await page.locator(selector).first().evaluate(n=>({actual:getComputedStyle(n).backgroundColor,surface:getComputedStyle(document.documentElement).getPropertyValue('--surface').trim()}));
  expect(colors.actual).not.toBe('rgb(255, 255, 255)');
 }pass('合并问题与赏金奖励模块随暗色主题显示');
 await page.evaluate(async()=>{const ui=await import('./app.js');ui.mergeUI.state.view='catalog';await ui.mergeUI.showDetail('/Lotus/Powersuits/Runner/Runner');});
 const skills=page.locator('[data-relation-kind=has-ability]');await expect(skills).toHaveCount(4);
 await expect.poll(()=>skills.evaluateAll(cards=>cards.filter(c=>c.querySelector('img')?.naturalWidth>0).length),{timeout:30000}).toBe(4);
 expect(await skills.first().innerText()).not.toContain('/Lotus/');pass('四个中文技能关联卡可加载图片，卡面不显示内部路径');
 await page.screenshot({path:path.join(output,'relations-dark.png')});
 const samples=await page.evaluate(async()=>{
  const ids=['/Lotus/Powersuits/Brawler/AtlasPunchWeapon','/Lotus/Types/Gameplay/NarmerSorties/ArchonCrystalAmarMythic','/Lotus/Types/Items/MiscItems/Forma'];
  const results=[];for(const id of ids){const d=await window.workbench.call('mergeDetail',{id});const [image]=await window.workbench.images([d.image]);results.push({id,image:!!image,kind:image?.kind,layers:image?.layers?.length,abilityIcon:image?.abilityIcon,original:image?.original});}
  return results;
 });expect(samples.every(x=>x.image)).toBe(true);expect(samples[0].abilityIcon).toBe(true);expect(samples[1].kind).toBe('tau-shard');expect(samples[1].layers).toBe(2);expect(samples[2].original).toBe('Forma.png');pass('Atlas 白色技能图、Tau 双层、Forma 替换均可读取');
 const recipe=await page.evaluate(async()=>{
  const ui=await import('./app.js');await ui.mergeUI.showDetail('/Lotus/Types/Items/MiscItems/IncarnonAdapters/Secondary/SicarusIncarnonUnlocker');
  const cards=[...document.querySelectorAll('.merge-connection-card')].filter(c=>c.innerText.includes('暗杀者灵化之源'));
  for(let n=0;n<100&&cards.some(c=>!c.querySelector('img')?.naturalWidth);n++)await new Promise(r=>setTimeout(r,30));
  return cards.map(c=>({text:c.innerText,pictures:c.querySelectorAll('img').length,loaded:[...c.querySelectorAll('img')].every(i=>i.naturalWidth>0)}));
 });expect(recipe.length).toBe(1);expect(recipe[0].loaded).toBe(true);expect(recipe[0].pictures).toBe(2);expect(recipe[0].text).not.toContain('/Lotus/');pass('灵化蓝图反向关联合并重复卡，并加载底图与成品两层');
 await page.locator('[data-panel=documents]').click();await expect(page.locator('#docs-article')).not.toBeEmpty();
 await page.locator('[data-panel=gallery]').click();await expect(page.locator('.gallery-card')).toHaveCount(72,{timeout:30000});await expect.poll(()=>page.locator('.gallery-picture img').first().evaluate(i=>i.naturalWidth)).toBeGreaterThan(0);pass('文档阅读和图库首屏可用');
 await page.locator('#theme-select').selectOption('light');await expect(page.locator('html')).toHaveAttribute('data-theme','light');await page.screenshot({path:path.join(output,'gallery-light.png')});
 expect(errors).toEqual([]);expect(network).toEqual([]);
 await fs.writeFile(path.join(output,'report.json'),JSON.stringify({ok:true,checks,errors,network,samples},null,2));
}catch(e){process.exitCode=1;console.error(e);if(app){const page=await app.firstWindow();await page.screenshot({path:path.join(output,'failure.png')});console.error('STATUS',await page.locator('#status-text').textContent(),errors);}}
finally{await app?.close();await fs.rm(userData,{recursive:true,force:true});}
