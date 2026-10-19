// Exercise the app's own local renderer, including native popovers and checkboxes.
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const executable = path.resolve(process.argv[2]);
const userData = await fs.mkdtemp(path.join(os.tmpdir(), 'wb-facets-'));
const env = { ...process.env, WORKBENCH_ROOT: process.cwd(), WORKBENCH_USER_DATA: userData };
delete env.ELECTRON_RUN_AS_NODE; delete env.WORKBENCH_SMOKE;
const child = spawn(executable, [...(process.argv[3] ? [process.argv[3]] : []), '--remote-debugging-port=0'], { env, stdio: ['ignore', 'ignore', 'pipe'] });
let socket;
try {
  const endpoint = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('调试端口超时')), 15000);
    child.on('error', reject);
    child.stderr.on('data', bytes => { const match = /DevTools listening on (ws:\/\/[^\s]+)/.exec(bytes.toString()); if (match) { clearTimeout(timer); resolve(match[1]); } });
  });
  let target;
  for (let i = 0; i < 100 && !target; i++) {
    const targets = await (await fetch(`http://127.0.0.1:${new URL(endpoint).port}/json/list`)).json();
    target = targets.find(item => item.type === 'page' && item.url.endsWith('/src/ui/index.html'));
    if (!target) await new Promise(resolve => setTimeout(resolve, 100));
  }
  if (!target) throw new Error('未找到本次启动的工作台');
  socket = new WebSocket(target.webSocketDebuggerUrl); await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let id = 0; const pending = new Map();
  socket.onmessage = event => { const message = JSON.parse(event.data); if (!message.id) return; const task = pending.get(message.id); pending.delete(message.id); message.error ? task.reject(new Error(message.error.message)) : task.resolve(message.result); };
  const send = (method, params) => new Promise((resolve, reject) => { const next = ++id; pending.set(next, { resolve, reject }); socket.send(JSON.stringify({ id: next, method, params })); });
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
    return result.result.value;
  };
  const result = await evaluate(`(async()=>{
    for(let i=0;i<100&&!window.smokeReady;i++)await new Promise(r=>setTimeout(r,100));
    if(!window.smokeReady)throw new Error('界面未就绪');
    const ui=await import('./app.js');const $=ui.$;
    const choose=(key,value)=>{const box=[...document.querySelectorAll('#options-'+key+' input[type=checkbox]')].find(node=>node.value===value);if(!box||box.disabled)throw new Error('选项不可用 '+key+'/'+value);box.click();};
    const assert=(condition,message)=>{if(!condition)throw new Error(message);};
    ui.resetFilters();
    $('picker-source').click();assert($('options-source').matches(':popover-open'),'picker 未打开');
    choose('source','official');choose('source','wfcd');choose('kind','data');
    choose('language','zh');choose('language','en');choose('category','weapons');choose('category','warframes');
    const combined=ui.filteredFiles().length;assert(combined===11,'多选结果错误 '+combined);
    assert(document.querySelectorAll('#files .file').length===11,'目录结果错误');
    assert(document.querySelectorAll('#files .file-badge').length===44,'目录缺少四维徽章');
    $('options-source').hidePopover();
    $('file-filter').value='no-such-json-file';ui.renderFiles(true);assert(ui.filteredFiles().length===0&&$('files').textContent.includes('没有符合条件'),'空结果提示错误');
    $('clear-filters').click();assert(ui.filteredFiles().length===403,'清空未恢复');
    choose('source','plus');choose('source','wfcd');choose('source','oracle');choose('kind','dictionary');choose('language','zh');
    const dictionaries=ui.filteredFiles().length;assert(dictionaries===3,'字典分类错误 '+dictionaries);
    // Search inside a picker without losing checked options; remove via a chip.
    const search=$('options-language').querySelector('.picker-search');search.value='英语';search.dispatchEvent(new Event('input'));
    assert($('options-language').querySelectorAll('input[type=checkbox]').length===1,'picker 搜索错误');
    const chip=[...document.querySelectorAll('#filter-chips button')].find(node=>node.getAttribute('aria-label')==='移除语言：简体中文');chip.click();
    assert(ui.filteredFiles().length===44,'移除标签未生效');
    ui.resetFilters();choose('source','official');choose('source','wfcd');choose('kind','data');choose('language','zh');choose('language','en');choose('category','weapons');choose('category','warframes');
    await ui.selectFile(ui.filteredFiles().find(file=>file.name==='ExportWeapons_zh.json'));await ui.go('/ExportWeapons');
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    const widths=[...document.querySelectorAll('#data-view th')].map(node=>node.getBoundingClientRect().width);
    assert(widths[2]/widths.reduce((a,b)=>a+b,0)>.74,'内容列不足 75%');
    return {ok:true,combined,dictionaries,badges:document.querySelectorAll('#files .file-badge').length,widths};
  })()`);
  await fs.mkdir('artifacts/facets', { recursive: true });
  const capture = async name => { const screenshot = await send('Page.captureScreenshot', { format: 'png' }); await fs.writeFile(`artifacts/facets/${name}.png`, Buffer.from(screenshot.data, 'base64')); };
  await capture('browser');
  await evaluate(`document.getElementById('picker-category').click()`); await capture('picker');
  await evaluate(`document.getElementById('options-category').hidePopover()`);
  await send('Emulation.setDeviceMetricsOverride', { width: 1080, height: 720, deviceScaleFactor: 1, mobile: false });
  result.narrow = await evaluate(`(async()=>{await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const aside=document.querySelector('aside').getBoundingClientRect();const viewer=document.querySelector('.viewer').getBoundingClientRect();document.getElementById('picker-language').click();const popup=document.getElementById('options-language').getBoundingClientRect();return {noHorizontalOverflow:document.documentElement.scrollWidth===innerWidth,aside:aside.width,viewer:viewer.width,popupFits:popup.left>=0&&popup.right<=innerWidth&&popup.top>=0&&popup.bottom<=innerHeight};})()`);
  result.ok &&= result.narrow.noHorizontalOverflow && result.narrow.popupFits;
  await capture('narrow');
  await fs.writeFile('artifacts/facets/result.json', JSON.stringify(result, null, 2)); console.log(result); if (!result.ok) process.exitCode = 1;
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally { socket?.close(); if (child.exitCode === null && child.signalCode === null) { const exited = new Promise(resolve => child.once('exit', resolve)); child.kill('SIGTERM'); await exited; } await fs.rm(userData, { recursive: true, force: true }); }
