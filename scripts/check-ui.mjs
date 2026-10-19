// Exercise the packaged app's own renderer via its temporary debugging socket.
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const executable = path.resolve(process.argv[2]);
const userData = await fs.mkdtemp(path.join(os.tmpdir(), 'wb-ui-'));
const env = { ...process.env, WORKBENCH_ROOT: process.cwd(), WORKBENCH_USER_DATA: userData };
delete env.ELECTRON_RUN_AS_NODE; delete env.WORKBENCH_SMOKE;
const child = spawn(executable, [...(process.argv[3] ? [process.argv[3]] : []), '--remote-debugging-port=0'], { env, stdio: ['ignore', 'ignore', 'pipe'] });
let socket;
try {
  const endpoint = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('应用调试端口超时')), 15000);
    child.on('error', reject);
    child.stderr.on('data', bytes => { const match = /DevTools listening on (ws:\/\/[^\s]+)/.exec(bytes.toString()); if (match) { clearTimeout(timer); resolve(match[1]); } });
  });
  let target;
  for (let i = 0; i < 100 && !target; i++) {
    const targets = await (await fetch(`http://127.0.0.1:${new URL(endpoint).port}/json/list`)).json();
    target = targets.find(x => x.type === 'page' && x.url.endsWith('/src/ui/index.html'));
    if (!target) await new Promise(resolve => setTimeout(resolve, 100));
  }
  if (!target) throw new Error('未找到刚启动工作台的页面');
  socket = new WebSocket(target.webSocketDebuggerUrl); await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let id = 0; const pending = new Map();
  socket.onmessage = event => { const result = JSON.parse(event.data); if (!result.id) return; const task = pending.get(result.id); pending.delete(result.id); result.error ? task.reject(new Error(result.error.message)) : task.resolve(result.result); };
  const send = (method, params) => new Promise((resolve, reject) => { const next = ++id; pending.set(next, { resolve, reject }); socket.send(JSON.stringify({ id: next, method, params })); });
  const response = await send('Runtime.evaluate', { awaitPromise: true, returnByValue: true, expression: `(async()=>{
    for(let i=0;i<100&&!window.smokeReady;i++)await new Promise(r=>setTimeout(r,100));
    const {activate,loadOracleOptions,predict,queryArb}=await import('./app.js');
    activate('oracle');await loadOracleOptions();
    document.getElementById('username').value='WorkbenchTest';
    await predict();await queryArb();
    const result={offers:document.querySelectorAll('.offer').length,arbitrations:document.querySelectorAll('.arb-entry').length,historyInputs:document.querySelectorAll('#observed select').length};
    result.ok=result.offers===3&&result.arbitrations===24&&result.historyInputs===3;
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    return result;
  })()` });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.text);
  const result = response.result.value;
  await fs.mkdir('artifacts', { recursive: true });
  const screenshot = await send('Page.captureScreenshot', { format: 'png' });
  await fs.writeFile('artifacts/ui-oracle.png', Buffer.from(screenshot.data, 'base64'));
  await fs.writeFile('artifacts/ui-result.json', JSON.stringify(result, null, 2));
  console.log(result); if (!result.ok) process.exitCode = 1;
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally { socket?.close(); child.kill('SIGTERM'); await new Promise(resolve => child.once('exit', resolve)); await fs.rm(userData, { recursive: true, force: true }); }
