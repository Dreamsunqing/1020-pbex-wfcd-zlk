import { _electron as electron, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
const root = process.cwd(), output = path.resolve('artifacts/unified-ui');
const userData = await fs.mkdtemp(path.join(os.tmpdir(), 'wb-unified-'));
const exportsDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'wb-gallery-exports-'));
const executable = process.argv[2];
const checks = [], errors = [], network = []; let instance, clipboardBefore;
await fs.mkdir(output, { recursive: true });
const pass = text => { checks.push(text); console.log('PASS', text); };
async function launch(useConfiguredImages = false) {
 const env = { ...process.env, WORKBENCH_ROOT: root, WORKBENCH_IMAGE_ROOT: path.join(root,'assets/content'), WORKBENCH_USER_DATA: userData };delete env.ELECTRON_RUN_AS_NODE;if(useConfiguredImages)delete env.WORKBENCH_IMAGE_ROOT;
 instance = await electron.launch({ ...(executable ? { executablePath: path.resolve(executable), args: [] } : { args: [root] }), env, timeout: 60000 });
 const page = await instance.firstWindow();page.on('pageerror', error => errors.push(error.message));page.on('request', r => { if (/^https?:/.test(r.url()))network.push(r.url()); });
 await page.waitForFunction(()=>window.smokeReady === true, { timeout: 90000 }); return page;
}
try {
 const catalog=JSON.parse(await fs.readFile(path.join(root,'assets/content/wfcd/catalog.json'),'utf8'));const sourceItem=catalog.items.find(row=>row.name==='Acceltra');const originalImage=path.join(root,'assets/content/wfcd/img',sourceItem.assetName);
 let page=await launch();
 // Preserve the clipboard so verification does not discard the user's existing content.
 clipboardBefore=await instance.evaluate(async({clipboard})=>{const items=await clipboard.read();return Promise.all(items.map(async item=>Promise.all(item.types.map(async type=>({type,bytes:Array.from(new Uint8Array(await(await item.getType(type)).arrayBuffer()))})))));});
 await page.locator('#theme-select').selectOption('system');await page.emulateMedia({colorScheme:'dark'});await expect(page.locator('html')).toHaveAttribute('data-theme','dark');await page.emulateMedia({colorScheme:'light'});await expect(page.locator('html')).toHaveAttribute('data-theme','light');await page.locator('#theme-select').selectOption('dark');await expect(page.locator('html')).toHaveAttribute('data-theme','dark');
 await page.locator('[data-panel=gallery]').click();await expect(page.locator('.gallery-card')).toHaveCount(72,{timeout:60000});
 await expect.poll(()=>page.locator('.gallery-picture img').first().evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true);
 await page.screenshot({path:path.join(output,'gallery-dark.png')});pass('图库首屏72卡、原图加载、暗色主题');
 await page.locator('#gallery-search').fill('ＡＣＣＥＬＴＲＡ');await expect(page.locator('.gallery-card-title').first()).toContainText('迅发电浆炮');
 await page.locator('#gallery-search').fill('迅发电浆炮');await expect.poll(()=>page.locator('.gallery-card').count()).toBeGreaterThan(0);
 const exact=page.locator('.gallery-card').filter({has:page.locator('.gallery-card-english',{hasText:/^Acceltra$/})});
 await expect(exact).toHaveCount(1);await exact.locator('input').check();
 await page.locator('#gallery-category').selectOption('Abilities');await page.locator('#gallery-search').fill('RunnerRushAbility');
 await expect(page.locator('.gallery-card')).toHaveCount(1);await expect(page.locator('.gallery-card-title')).toHaveText('马赫冲驰');await expect(page.locator('.gallery-card-english')).toHaveText('Mach Rush');await page.locator('.gallery-card>input').check();
 await expect(page.locator('#gallery-selection-count')).toHaveText('已选 2 项');pass('中英及全角搜索、技能中文、跨分类选择保留');
 await page.locator('.gallery-card-open').click();await expect(page.locator('#gallery-dialog')).toBeVisible();await expect(page.locator('#gallery-detail-title')).toHaveText('马赫冲驰');
 await expect(page.locator('#gallery-detail-dimensions')).toContainText('512');await page.locator('#gallery-zoom').focus();await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowRight');
 await page.screenshot({path:path.join(output,'skill-detail-dark.png')});await page.keyboard.press('Escape');
 await page.locator('#gallery-category').selectOption('');await page.locator('#gallery-search').fill('迅发电浆炮');await exact.locator('.gallery-card-open').click();
 await page.locator('#gallery-copy-image').click();
 let copied;await expect.poll(async()=>{copied=await instance.evaluate(async({clipboard,nativeImage},original)=>{const items=await clipboard.read();for(const item of items)if(item.types.includes('image/png')){const b=Buffer.from(await(await item.getType('image/png')).arrayBuffer());const n=nativeImage.createFromBuffer(b);return{...n.getSize(),size:b.length,samePixels:n.toBitmap().equals(nativeImage.createFromPath(original).toBitmap())};}return null;},originalImage);return copied?.width??0;}).toBeGreaterThan(0);
 if(!copied?.width||!copied?.height||!copied.samePixels)throw new Error('剪贴板中无有效图片');pass('图片详情、缩放、Esc关闭及系统图片剪贴板');
 await instance.evaluate(async({dialog},dir)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[dir]});dialog.showSaveDialog=async()=>({canceled:false,filePath:dir+'/saved.png'});},exportsDirectory);
 await page.locator('#gallery-save').click();await expect.poll(()=>fs.stat(path.join(exportsDirectory,'saved.png')).then(s=>s.size,()=>0)).toBeGreaterThan(0);
 if(!(await fs.readFile(path.join(exportsDirectory,'saved.png'))).equals(await fs.readFile(originalImage)))throw new Error('保存原图字节不一致');
 await page.keyboard.press('Escape');await page.locator('#gallery-export').click();await expect(page.locator('#gallery-cancel-export')).toBeHidden();
 await expect.poll(async()=> (await fs.readdir(exportsDirectory)).length).toBe(3);
 await page.locator('#gallery-export').click();await expect(page.locator('#gallery-cancel-export')).toBeHidden();await expect.poll(async()=> (await fs.readdir(exportsDirectory)).length).toBe(5);pass('原图保存与批量导出、重名编号不覆盖');
 await page.locator('#gallery-clear').click();await page.locator('#gallery-provider').selectOption('official');await expect.poll(()=>page.locator('.gallery-card').count()).toBeGreaterThan(0);
 await page.locator('.gallery-card-open').first().click();await expect(page.locator('#gallery-detail-source')).toContainText('DE 官方');
 await expect.poll(()=>page.locator('#gallery-detail-picture img').evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true);await page.keyboard.press('Escape');const comparison=JSON.parse(await fs.readFile(path.join(root,'assets/content/image-library-comparison.json'),'utf8'));const fallbackId=comparison.officialOnly.find(row=>row.officialAvailable&&!row.exactFilenameCandidate).id;
 const fallback=await page.evaluate(async id=>{const [img]=await window.workbench.images([{id}]);return{provider:img?.provider,method:img?.method};},fallbackId);if(fallback.provider!=='official'||fallback.method!=='official-exact-id')throw new Error('普通资料卡片的官方精确ID补图失败');pass('官方来源切换、官方原图读取及普通资料卡精确ID补图');
 await page.keyboard.press(process.platform==='darwin'?'Meta+k':'Control+k');await expect(page.locator('#gallery-search')).toBeFocused();await page.locator('#gallery-reset').click();await expect(page.locator('.gallery-card')).toHaveCount(72);await page.locator('#gallery-next').click();await expect(page.locator('#gallery-page-info')).toContainText('第 73');
 await page.locator('#gallery-size').selectOption('small');await page.locator('#gallery-background').selectOption('dark');
 await instance.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1080,800));
 const overflow=await page.evaluate(()=>({body:document.body.scrollWidth>innerWidth,header:document.querySelector('header').scrollWidth>innerWidth}));
 if(overflow.body||overflow.header)throw new Error('1080窗口出现横向溢出 '+JSON.stringify(overflow));await page.screenshot({path:path.join(output,'gallery-1080-dark.png')});
 await page.locator('#theme-select').selectOption('light');await expect(page.locator('html')).toHaveAttribute('data-theme','light');const lightColors=await page.evaluate(()=>({title:getComputedStyle(document.querySelector('.gallery-card-title')).color,button:getComputedStyle(document.querySelector('#gallery-reset')).backgroundColor}));if(lightColors.title!=='rgb(35, 50, 68)'||lightColors.button!=='rgb(255, 255, 255)')throw new Error('浅色主题颜色未同步 '+JSON.stringify(lightColors));await page.screenshot({path:path.join(output,'gallery-light.png')});
 await page.locator('#theme-select').selectOption('dark');await instance.close();instance=null;page=await launch();
 await expect(page.locator('html')).toHaveAttribute('data-theme','dark');await page.locator('[data-panel=gallery]').click();await expect(page.locator('#gallery-size')).toHaveValue('small');await expect(page.locator('#gallery-background')).toHaveValue('dark');pass('分页、1080窄窗口、浅色/暗色及重启偏好持久化');
 await page.locator('[data-panel=browser]').click();await expect.poll(()=>page.locator('#files .file').count()).toBeGreaterThan(0);await page.screenshot({path:path.join(output,'browser-dark.png')});
 for(const panel of ['rules','merged','updates']){await page.locator('[data-panel='+panel+']').click();await page.screenshot({path:path.join(output,panel+'-dark.png')});}
 await page.locator('[data-panel=settings]').click();await expect(page.locator('#image-path')).toContainText('12543');pass('资料浏览与整合后图片目录状态正常');
 const alternate=path.join(exportsDirectory,'alternate-content');await fs.mkdir(path.join(alternate,'img'),{recursive:true});await fs.copyFile(originalImage,path.join(alternate,'img',sourceItem.assetName));await fs.writeFile(path.join(alternate,'catalog.json'),JSON.stringify({...catalog,items:[sourceItem]}));
 await instance.evaluate(({dialog},directory)=>{globalThis.__galleryDialog=directory;dialog.showOpenDialog=async()=>{globalThis.__galleryDialogCalls=(globalThis.__galleryDialogCalls??0)+1;return{canceled:false,filePaths:[directory]};};},alternate);await page.locator('#choose-images').click();await expect(page.locator('#image-path')).toContainText('1 张图片',{timeout:20000});await page.locator('[data-panel=gallery]').click();await expect(page.locator('.gallery-card')).toHaveCount(1);
 await instance.close();instance=null;page=await launch(true);await page.locator('[data-panel=gallery]').click();await expect(page.locator('.gallery-card')).toHaveCount(1);await expect(page.locator('.gallery-card-title')).toHaveText('迅发电浆炮');await page.locator('[data-panel=settings]').click();await expect(page.locator('#image-path')).toContainText(alternate);pass('手动图库切换后，重启保持图库与资料卡相同目录');
 if(errors.length)throw new Error(errors.join('\n'));if(network.length)throw new Error('图库出现外网请求');
 console.log(JSON.stringify({ok:true,checks,clipboard:copied},null,2));
 await fs.writeFile(path.join(output,'report.json'),JSON.stringify({ok:true,checks,errors,network,executable:executable??'source'},null,2));
} catch(error){if(instance){try{await(await instance.firstWindow()).screenshot({path:path.join(output,'failure.png')});}catch{}}console.error(error);if(instance){try{console.error('DIAGNOSTICS',await instance.evaluate(()=>({directory:globalThis.__galleryDialog,calls:globalThis.__galleryDialogCalls})),await(await instance.firstWindow()).evaluate(async()=>({imageStatus:await window.workbench.imageStatus(),notice:document.querySelector('#notice').textContent})));}catch{}}process.exitCode=1;}
finally{
 if(instance&&clipboardBefore){try{await instance.evaluate(async({clipboard,ClipboardItem},data)=>{const entries=data.filter(items=>items.length);if(entries.length)await clipboard.write(entries.map(items=>new ClipboardItem(Object.fromEntries(items.map(({type,bytes})=>[type,new Blob([new Uint8Array(bytes)],{type})])))));else await clipboard.clear();},clipboardBefore);}catch(error){console.error('Clipboard restore:',error.message);}}
 if(instance)await instance.close();await fs.rm(userData,{recursive:true,force:true});await fs.rm(exportsDirectory,{recursive:true,force:true});
}
