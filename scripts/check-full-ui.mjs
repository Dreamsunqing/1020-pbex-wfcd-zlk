import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const executable = path.resolve(process.argv[2] ?? 'node_modules/electron/dist/Electron.app/Contents/MacOS/Electron');
const userData = await fs.mkdtemp(path.join(os.tmpdir(), 'wb-full-ui-'));
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
  await fs.mkdir('artifacts/full-ui', { recursive: true });
  const shot = async name => { await fs.writeFile(`artifacts/full-ui/${name}.png`, Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64')); };
  const report = {};
  report.rules = await evaluate(`(async()=>{
    for(let i=0;i<150&&!window.smokeReady;i++)await new Promise(r=>setTimeout(r,100));
    const ui=await import('./app.js');ui.activate('rules');await ui.rulesUI.enter();
    const r=ui.rulesUI;if(r.state.draft.contract.catalogs.length!==101)throw new Error('分类规则缺失');
    await document.querySelector('[data-rules-tab=fields]').onclick();
    const tr=[...document.querySelectorAll('.rules-table tr')].find(tr=>[...tr.querySelectorAll('input')].some(n=>n.value==='stats.criticalChance'));
    const label=tr.querySelector('[aria-label^="中文标题"]');label.value='暴击几率（复核示例）';label.dispatchEvent(new Event('change'));
    document.getElementById('rules-note').value='界面验收：核对中文说明';
    await document.getElementById('rules-validate').onclick();await document.getElementById('rules-save').onclick();
    if(r.state.dirty||!r.state.loaded.hasPrevious||r.state.loaded.contract.fields.find(f=>f.path==='stats.criticalChance').label!=='暴击几率（复核示例）')throw new Error('表单保存失败');
    await document.querySelector('[data-rules-tab=json]').onclick();const area=document.getElementById('rules-json');const raw=JSON.parse(area.value);if(raw.overrides.version!==1)throw new Error('JSON 草稿不完整');
    await document.querySelector('[data-rules-tab=fields]').onclick();
    return {catalogs:r.state.loaded.catalogs,fields:r.state.loaded.fields,saved:true,previous:true,json:true};
  })()`); await shot('rules'); console.log('规则表单与保存通过，正在构建全量资料…');
  report.build = await evaluate(`(async()=>{const ui=await import('./app.js');ui.activate('merged');await ui.mergeUI.enter();await ui.mergeUI.build();const m=ui.mergeUI.state.status?.manifest;if(m?.summary.entities!==32941||m?.summary.rewardTables!==1102)throw new Error('全量构建失败：'+document.getElementById('merge-error').textContent);if(document.querySelectorAll('#merge-content .json-preview-card').length!==80)throw new Error('分页不完整');return {...m.summary,datasetVersion:m.datasetVersion,cards:80};})()`); await shot('catalog'); console.log('全量构建与分页通过，正在验证详情和奖励…');
  report.detail = await evaluate(`(async()=>{const ui=await import('./app.js');await ui.mergeUI.showDetail('/Lotus/Weapons/Tenno/LongGuns/SapientPrimary/SapientPrimaryWeapon');const text=document.getElementById('merge-content').textContent;if(!text.includes('暴击几率（复核示例）')||!text.includes('32%')||!text.includes('原值：'))throw new Error('规则未生效或溯源不完整');const source=document.querySelector('.merge-source-link');source.click();for(let i=0;i<150&&!document.querySelector('#browser.active');i++)await new Promise(r=>setTimeout(r,30));if(!document.querySelector('#browser.active')||!ui.state.pointer)throw new Error('压缩溯源跳转失败');ui.activate('merged');await ui.mergeUI.enter();return {savedRuleApplied:true,sourceJump:true,fields:true};})()`); await shot('detail');
  report.reports = await evaluate(`(async()=>{const ui=await import('./app.js');await document.querySelector('[data-merge-view=rewards]').onclick();let count=document.querySelectorAll('.merge-reward-table').length;if(count!==40)throw new Error('奖励分页错误');ui.mergeUI.state.query='ImmortalA';ui.mergeUI.state.offset=0;await ui.mergeUI.render();await document.querySelector('.merge-reward-open').onclick({stopPropagation(){}});await new Promise(r=>setTimeout(r,80));const text=document.getElementById('merge-content').textContent;if(!text.includes('概率未提供'))throw new Error('稀有度被当作概率');ui.mergeUI.state.query='';await document.querySelector('[data-merge-view=issues]').onclick();if(document.querySelectorAll('.merge-issue').length!==40)throw new Error('问题分页错误');await document.querySelector('[data-merge-view=changes]').onclick();if(!document.getElementById('merge-content').textContent.includes('首次构建'))throw new Error('差异报告缺失');return {rewardTables:count,rarity:true,issuePagination:true,changes:true};})()`); await shot('reports');
  await send('Emulation.setDeviceMetricsOverride', { width: 1080, height: 800, deviceScaleFactor: 1, mobile: false });
  report.narrow = await evaluate(`(async()=>{const ui=await import('./app.js');ui.activate('rules');await ui.rulesUI.enter();await document.querySelector('[data-rules-tab=general]').onclick();if(document.body.scrollWidth>innerWidth+2)throw new Error('窄屏整体横向溢出');return {bodyWidth:document.body.scrollWidth,viewport:innerWidth};})()`);
  report.ok = true; await fs.writeFile('artifacts/full-ui/report.json', JSON.stringify(report, null, 2)); console.log(JSON.stringify(report, null, 2));
} finally { socket?.close(); child.kill('SIGTERM'); await new Promise(resolve => child.exitCode !== null ? resolve() : child.once('exit', resolve)); await fs.rm(userData, { recursive: true, force: true }); }
