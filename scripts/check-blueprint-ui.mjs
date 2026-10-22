import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const executable = path.resolve(process.argv[2] ?? 'node_modules/electron/dist/Electron.app/Contents/MacOS/Electron');
const userData = await fs.mkdtemp(path.join(os.tmpdir(), 'wb-blueprint-ui-'));
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
  await fs.mkdir('artifacts/blueprint-ui', { recursive: true });
  const shot = async name => { await fs.writeFile(`artifacts/blueprint-ui/${name}.png`, Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64')); };
  const report = {};
  report.catalog = await evaluate(`(async()=>{
    for(let i=0;i<150&&!window.smokeReady;i++)await new Promise(r=>setTimeout(r,100));
    const ui=await import('./app.js');ui.activate('merged');await ui.mergeUI.enter();await ui.mergeUI.build('pilot');
    ui.mergeUI.state.query='Gauss 蓝图';await ui.mergeUI.render();
    for(let i=0;i<150&&!document.querySelector('.blueprint-item')?.complete;i++)await new Promise(r=>setTimeout(r,30));
    const card=document.querySelector('#merge-content .json-preview-card'), layers=[...card.querySelectorAll('.blueprint-layer')];
    if(layers.length!==2||layers.some(n=>!n.complete||!n.naturalWidth))throw new Error('合并列表叠图缺失');
    return {title:card.querySelector('h2').textContent,layers:layers.map(n=>({class:n.className,width:n.naturalWidth})),height:card.offsetHeight};
  })()`); await shot('catalog');
  report.detail = await evaluate(`(async()=>{
    const ui=await import('./app.js');await ui.mergeUI.showDetail('/Lotus/Types/Recipes/WarframeRecipes/GaussBlueprint');
    for(let i=0;i<150&&!document.querySelector('.blueprint-item')?.complete;i++)await new Promise(r=>setTimeout(r,30));
    const picture=document.querySelector('.blueprint-image.detail-image');
    if(!picture||picture.querySelectorAll('img').length!==2)throw new Error('详情未叠图');
    const size=picture.getBoundingClientRect();return {layers:2,width:size.width,height:size.height,role:picture.getAttribute('role')};
  })()`); await shot('detail');
  report.raw = await evaluate(`(async()=>{
    const ui=await import('./app.js');ui.activate('browser');ui.state.view='cards';
    const file=ui.state.files.find(f=>f.id.endsWith('/data/json/Components.json'));if(!file)throw new Error('缺少 Components');
    await ui.selectFile(file);ui.state.query='GaussBlueprint';await ui.renderDocument();
    for(let i=0;i<150&&!document.querySelector('#data-view .blueprint-item')?.complete;i++)await new Promise(r=>setTimeout(r,30));
    if(document.querySelectorAll('#data-view .blueprint-layer').length!==2)throw new Error('原始卡片未叠图');
    const pointer=ui.state.page.rows[0].pointer;await ui.openCard(pointer);
    for(let i=0;i<150&&!document.querySelector('#data-view .blueprint-item')?.complete;i++)await new Promise(r=>setTimeout(r,30));
    if(document.querySelectorAll('#data-view .blueprint-layer').length!==2)throw new Error('原始详情未叠图');
    return {file:file.id,list:true,detail:true,pointer};
  })()`); await shot('raw-detail');
  await send('Emulation.setDeviceMetricsOverride',{width:1080,height:800,deviceScaleFactor:1,mobile:false});
  report.narrow=await evaluate(`(async()=>{const ui=await import('./app.js');ui.activate('merged');await ui.mergeUI.showDetail('/Lotus/Types/Recipes/WarframeRecipes/GaussBlueprint');await new Promise(r=>setTimeout(r,300));if(document.documentElement.scrollWidth>innerWidth)throw new Error('横向溢出');return {width:innerWidth,fits:true};})()`);
  report.ok=true;await fs.writeFile('artifacts/blueprint-ui/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
} finally { socket?.close(); child.kill('SIGTERM'); await new Promise(resolve => child.exitCode !== null ? resolve() : child.once('exit', resolve)); await fs.rm(userData, { recursive: true, force: true }); }
