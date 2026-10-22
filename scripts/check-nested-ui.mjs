import { spawn } from 'node:child_process';
import { promises as fs, constants } from 'node:fs';
import { scanLibrary } from '../src/core/library.mjs';
import { digest } from '../src/core/merge/contract.mjs';
import os from 'node:os';
import path from 'node:path';
const executable = path.resolve(process.argv[2] ?? 'node_modules/electron/dist/Electron.app/Contents/MacOS/Electron');
const userData = await fs.mkdtemp(path.join(os.tmpdir(), 'wb-nested-ui-'));
// Seed only the current verified build with copy-on-write; all UI edits remain temporary.
const library = await scanLibrary(process.cwd());
const frameRecords = JSON.parse((await fs.readFile(path.join(library.root, 'wfcd-items/data/json/Warframes.json'))).toString());
const gaussIndex = frameRecords.findIndex(record => record.uniqueName === '/Lotus/Powersuits/Runner/Runner');
const context = digest({ mode: 'local', root: library.root });
const cache = path.join('.workbench', 'merged', context), destination = path.join(userData, 'snapshots/merged', context);
let seeded = false;
try {
  const current = JSON.parse(await fs.readFile(path.join(cache, 'current.json'), 'utf8'));
  const source = path.join(cache, 'builds', current.datasetVersion);
  const manifest = JSON.parse(await fs.readFile(path.join(source, 'manifest.json'), 'utf8'));
  if (manifest.modelingVersion === 'localized-text-3') {
    await fs.cp(source, path.join(destination, 'builds', current.datasetVersion), { recursive: true, mode: constants.COPYFILE_FICLONE });
    await fs.writeFile(path.join(destination, 'current.json'), JSON.stringify({ ...current, previousVersion: null })); seeded = true;
  }
} catch { /* A source checkout without a local build can build it in the isolated profile. */ }
const env = { ...process.env, WORKBENCH_ROOT: process.cwd(), WORKBENCH_USER_DATA: userData }; delete env.ELECTRON_RUN_AS_NODE; delete env.WORKBENCH_SMOKE;
const child = spawn(executable, [...(process.argv[3] ? [process.argv[3]] : []), '--remote-debugging-port=0'], { env, stdio: ['ignore', 'ignore', 'pipe'] });
let socket;
try {
  const endpoint = await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error('应用启动超时')), 60000); child.on('error', reject); child.stderr.on('data', bytes => { const match = /DevTools listening on (ws:\/\/[^\s]+)/.exec(String(bytes)); if (match) { clearTimeout(timer); resolve(match[1]); } }); });
  let target;
  for (let i = 0; i < 150 && !target; i++) { try { target = (await (await fetch(`http://127.0.0.1:${new URL(endpoint).port}/json/list`)).json()).find(t => t.type === 'page' && t.url.endsWith('/src/ui/index.html')); } catch {} if (!target) await new Promise(r => setTimeout(r, 100)); }
  if (!target) throw new Error('未找到工作台页面');
  socket = new WebSocket(target.webSocketDebuggerUrl); await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let serial = 0; const pending = new Map();
  socket.onmessage = event => { const reply = JSON.parse(event.data); if (!reply.id) return; const task = pending.get(reply.id); pending.delete(reply.id); reply.error ? task.reject(new Error(reply.error.message)) : task.resolve(reply.result); };
  const send = (method, params) => new Promise((resolve, reject) => { const id = ++serial; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
  const evaluate = async expression => { const reply = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (reply.exceptionDetails) throw new Error(reply.exceptionDetails.exception?.description ?? reply.exceptionDetails.text); return reply.result.value; };
  await fs.mkdir('artifacts/nested-ui', { recursive: true });
  const shot = async name => { await fs.writeFile(`artifacts/nested-ui/${name}.png`, Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64')); };
  const report = {};
  report.rules = await evaluate(`(async()=>{
    for(let i=0;i<200&&!window.smokeReady;i++)await new Promise(r=>setTimeout(r,100));
    const ui=await import('./app.js');ui.activate('rules');await ui.rulesUI.enter();await document.querySelector('[data-rules-tab=nested]').onclick();
    const rows=document.querySelectorAll('.rules-table tbody tr');if(rows.length!==5)throw new Error('嵌套规则缺失');return {rows:rows.length};
  })()`); await shot('rules');
  report.previewChinese = await evaluate(`(async()=>{
    const ui=await import('./app.js');ui.activate('browser');ui.state.view='cards';await ui.selectFile(ui.state.files.find(file=>file.source==='wfcd'&&file.id.endsWith('/data/json/Warframes.json')));await ui.go('/${gaussIndex}/abilities');
    const names=[...document.querySelectorAll('#data-view .json-card-title')].map(n=>n.textContent);if(names.join(',')!=='马赫冲驰,动能镀层,热能抽离,赤限')throw new Error('原 JSON 技能未展示中文');return {names};
  })()`); await shot('preview-chinese');
  report.frame = await evaluate(`(async()=>{
    const ui=await import('./app.js');ui.activate('merged');await ui.mergeUI.enter();if(!ui.mergeUI.state.status?.available)await ui.mergeUI.build();
    if(ui.mergeUI.state.status?.manifest.modelingVersion!=='localized-text-3')throw new Error('仍是旧模型');
    await ui.mergeUI.showDetail('/Lotus/Powersuits/Runner/Runner');
    const skills=document.querySelectorAll('[data-relation-kind=has-ability]'),components=document.querySelectorAll('[data-relation-kind=has-component]');
    if(skills.length!==4||components.length<5)throw new Error('技能或组件不完整');
    for(let i=0;i<150&&[...skills].some(card=>!card.querySelector('img')?.naturalWidth);i++)await new Promise(r=>setTimeout(r,30));
    if([...skills].some(card=>!card.querySelector('img')?.naturalWidth))throw new Error('WFCD 技能图片缺失');
    const names=[...skills].map(card=>card.querySelector('.merge-relation-target').textContent);if(names.join(',')!=='马赫冲驰,动能镀层,热能抽离,赤限')throw new Error('技能未展示中文');
    if([...skills,...components].some(card=>!card.classList.contains('navigable')||!card.querySelector('.merge-card-open')))throw new Error('技能组件卡片跳转样式不一致');
    const namedBadge=skills[0].querySelector('[data-augment-target]');if(!namedBadge?.querySelector('.merge-augment-name')?.textContent)throw new Error('集团卡未显示中文 Mod 名');
    if(!document.querySelector('#merge-content').textContent.includes('数量 ×3'))throw new Error('组件数量丢失');
    return {skills:skills.length,skillImages:4,components:components.length,model:ui.mergeUI.state.status.manifest.modelingVersion};
  })()`); await shot('frame');
  await evaluate(`document.querySelector('.merge-relations').scrollIntoView({block:'start'})`);await shot('relationships');
  report.skill = await evaluate(`(async()=>{
    const ui=await import('./app.js');const card=document.querySelector('[data-relation-kind=has-ability]');await card.onkeydown({key:'Enter',target:card,preventDefault(){}});
    const text=document.querySelector('#merge-content').textContent;
    if(!text.includes('技能启动能量')||!text.includes('15')||!ui.mergeUI.state.selected.endsWith('RunnerRushAbility'))throw new Error('技能跳转或能量缺失');
    const nestedSource=[...document.querySelectorAll('.merge-source-link')].find(b=>b.title.includes('/abilities/0/energyRequiredToActivate'));
    if(!nestedSource)throw new Error('技能深层溯源缺失');await nestedSource.onclick();
    if(!ui.state.pointer.includes('/abilities/0/energyRequiredToActivate'))throw new Error('深层源指针跳转错误');
    ui.activate('merged');await ui.mergeUI.enter();await document.querySelector('.merge-previous').onclick();
    if(ui.mergeUI.state.selected!=='/Lotus/Powersuits/Runner/Runner')throw new Error('未返回战甲');return {energy:15,nestedSource:true,back:true};
  })()`);
  report.badges = await evaluate(`(async()=>{
    const ui=await import('./app.js');await ui.mergeUI.showDetail('/Lotus/Powersuits/Runner/Runner');
    const augment=document.querySelector('[data-relation-kind=has-ability] [data-augment-target]');if(!augment)throw new Error('技能名后缺少集团卡徽章');
    await augment.onclick();if(!ui.mergeUI.state.selected.endsWith('RunnerRushAugmentCard'))throw new Error('集团卡跳转错误');
    await document.querySelector('.merge-previous').onclick();
    const transferable=document.querySelector('[data-relation-kind=has-ability] [data-ability-target]');if(!transferable)throw new Error('缺少可移植标记');await transferable.onclick();
    if(!document.querySelector('.merge-ability-directory')||!ui.mergeUI.state.selected.endsWith('RunnerTransferAbility'))throw new Error('技能目录跳转错误');
    const source=[...document.querySelectorAll('.merge-source-link')].find(b=>b.title.includes('Warframes.lua')&&b.title.includes('行号'));if(!source)throw new Error('缺少移植来源行号');await source.onclick();
    if(!document.querySelector('#data-view').textContent.includes('Subsumed = "Thermal Sunder"')||!document.querySelector('#page-info').textContent.includes('原文定位'))throw new Error('元数据原文定位失败');
    ui.activate('merged');await ui.mergeUI.enter();await ui.mergeUI.showDetail('/Lotus/Powersuits/Runner/GaussPrime');
    if(!document.querySelector('[data-relation-kind=has-ability] .transferable')?.textContent.includes('同系'))throw new Error('Prime 移植说明错误');
    await ui.mergeUI.showDetail('/Lotus/Weapons/Tenno/Shotgun/QuadShotgun');
    const weaponBadge=[...document.querySelectorAll('.json-record-title [data-augment-target]')].find(b=>b.dataset.augmentTarget.endsWith('/HekMod'));if(!weaponBadge)throw new Error('武器名缺少集团卡');await weaponBadge.onclick();
    if(!ui.mergeUI.state.selected.endsWith('/HekMod'))throw new Error('武器集团卡跳转失败');
    await ui.mergeUI.showDetail('/Lotus/Powersuits/Runner/Runner');return {skillAugment:true,weaponAugment:true,transfer:true,prime:true,sourceLine:true};
  })()`); await shot('badges');
  report.component = await evaluate(`(async()=>{
    const ui=await import('./app.js');const target='/Lotus/Types/Recipes/WarframeRecipes/GaussChassisComponent';
    const button=[...document.querySelectorAll('.merge-relation-target')].find(n=>n.dataset.mergeTarget===target);if(!button)throw new Error('缺少机体组件');const card=button.closest('.merge-connection-card');await card.onclick({target:card});
    if(ui.mergeUI.state.selected!==target||!document.querySelector('#merge-content').textContent.includes('用于物品'))throw new Error('组件反向归属缺失');
    const parent=[...document.querySelectorAll('.merge-relation-target')].find(n=>n.dataset.mergeTarget==='/Lotus/Powersuits/Runner/Runner');await parent.onclick();
    if(ui.mergeUI.state.selected!=='/Lotus/Powersuits/Runner/Runner')throw new Error('反向跳转失败');return {component:true,reverse:true,history:ui.mergeUI.state.history.length};
  })()`); await shot('component-return');
  report.tree = await evaluate(`(async()=>{
    const ui=await import('./app.js');await ui.mergeUI.showDetail('/Lotus/Weapons/Tenno/LongGuns/SapientPrimary/SapientPrimaryWeapon');
    const code=[...document.querySelectorAll('.field-heading code')].find(n=>n.textContent==='attributes.introduced.aliases');if(!code)throw new Error('对象子字段未建模');
    const row=code.closest('.record-field'), tree=row.querySelector('.merge-value-tree');if(!tree)throw new Error('数组未结构展示');tree.open=true;await new Promise(r=>setTimeout(r,50));
    if(!tree.querySelectorAll('.merge-value-entry').length)throw new Error('数组内容无法展开');
    const fieldSource=row.querySelector('.merge-source-link');if(!fieldSource.title.includes('/introduced/aliases'))throw new Error('深层原字段证据缺失');
    row.scrollIntoView({block:'center'});
    return {leaf:true,expandable:true,entries:tree.querySelectorAll('.merge-value-entry').length,source:true};
  })()`); await shot('nested-fields');
  report.archwingImage = await evaluate(`(async()=>{const ui=await import('./app.js');await ui.mergeUI.showDetail('/Lotus/Powersuits/Archwing/ArchwingAbilities/SupportDronesAbility');for(let i=0;i<100&&!document.querySelector('.merge-record > img')?.naturalWidth;i++)await new Promise(r=>setTimeout(r,30));const img=document.querySelector('.merge-record > img');if(!img?.naturalWidth||!img.title.includes('ArchwingFourSecurity.png'))throw new Error('Archwing 技能图片缺失');return {loaded:true,width:img.naturalWidth};})()`);
  report.rewards = await evaluate(`(async()=>{
    const ui=await import('./app.js');await document.querySelector('[data-merge-view=rewards]').onclick();
    if(document.querySelectorAll('.merge-reward-table').length!==40||document.querySelector('.merge-reward-fold[open]')||document.querySelector('.merge-reward-row'))throw new Error('奖励未默认折叠或分页不完整');
    ui.mergeUI.state.query='扎里曼';ui.mergeUI.state.offset=0;await ui.mergeUI.render();
    const text=document.getElementById('merge-content').textContent;if(!text.includes('任务清单直接引用')||!text.includes('赏金第'))throw new Error('赏金中文任务说明缺失：'+text.slice(0,2400));
    const fold=document.querySelector('.merge-reward-fold');fold.open=true;await new Promise(r=>setTimeout(r,200));
    const cards=[...fold.querySelectorAll('.merge-reward-row')];if(cards.length<2)throw new Error('奖励卡片缺失');
    const cols=getComputedStyle(fold.querySelector('.reward-item-grid')).gridTemplateColumns.split(' ').length;if(cols<2)throw new Error('奖励未一行多卡');
    const raw=document.querySelector('.merge-reward-provenance');raw.open=true;await new Promise(r=>setTimeout(r,30));
    if(!raw.querySelector('.merge-source-link')?.title.includes('ExportRewards'))throw new Error('奖励证据缺失');
    document.querySelector('.merge-reward-table').scrollIntoView({block:'start'});
    return {defaultCollapsed:true,chineseSearch:true,description:true,cards:cards.length,columns:cols,source:true};
  })()`);await shot('rewards');
  await send('Emulation.setDeviceMetricsOverride',{width:1080,height:800,deviceScaleFactor:1,mobile:false});
  report.narrow=await evaluate(`(async()=>{const ui=await import('./app.js');ui.mergeUI.state.view='rewards';await ui.mergeUI.render();const fold=document.querySelector('.merge-reward-fold');fold.open=true;await new Promise(r=>setTimeout(r,200));if(document.documentElement.scrollWidth>innerWidth)throw new Error('窄屏溢出');return {width:innerWidth,fits:true};})()`);
  report.ok=true;report.seeded=seeded;await fs.writeFile('artifacts/nested-ui/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
} finally { socket?.close(); child.kill('SIGTERM'); await new Promise(resolve => child.exitCode !== null ? resolve() : child.once('exit', resolve)); await fs.rm(userData, { recursive: true, force: true }); }
