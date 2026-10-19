// Exercise the packaged app's own renderer via its temporary debugging socket.
import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { anchorFromWorldState } from '../src/core/browse.mjs';
import { atomicJson } from '../src/core/io.mjs';
import { selectOracleState } from '../src/core/oracle-state.mjs';
const executable = path.resolve(process.argv[2]);
const userData = await fs.mkdtemp(path.join(os.tmpdir(), 'wb-ui-'));
const activation = Date.parse('2026-10-19T12:00Z');
const stamp = time => ({ $date: { $numberLong: String(time) } });
await atomicJson(path.join(userData, 'snapshots/runtime/world-state.json'), anchorFromWorldState(JSON.stringify({ SyndicateMissions: [{ Tag: 'HexSyndicate', Activation: stamp(activation), Expiry: stamp(activation + 9000000) }] }), { fetchedAt: activation }));
const weeklyFixture = JSON.parse(await fs.readFile(new URL('../test/fixtures/oracle-weekly-service.json', import.meta.url), 'utf8'));
const oracleFixture = JSON.parse(await fs.readFile(new URL('../test/fixtures/oracle-service.json', import.meta.url), 'utf8'));
await atomicJson(path.join(userData, 'snapshots/runtime/oracle-world-state.json'), selectOracleState(JSON.stringify({ ...oracleFixture.worldState, ...weeklyFixture.worldState }), { at: oracleFixture.queryAt, loadedAt: oracleFixture.queryAt }));
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
    const {activate,loadOracleOptions,predict,queryArb,selectLab}=await import('./app.js');
    activate('oracle');selectLab('oracle-legacy');await loadOracleOptions();
    document.getElementById('username').value='WorkbenchTest';
    await predict();await queryArb();
    const result={offers:document.querySelectorAll('.offer').length,arbitrations:document.querySelectorAll('.arb-entry').length,historyInputs:document.querySelectorAll('#observed select').length};
    result.ok=result.offers===3&&result.arbitrations===24&&result.historyInputs===3;
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    return result;
  })()` });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.text);
  const result = response.result.value;
  const layoutReply=await send('Runtime.evaluate',{returnByValue:true,expression:`(()=>{
    const nav=[...document.querySelectorAll('header .nav')].map(node=>node.textContent);
    const order=[...document.querySelectorAll('#oracle-legacy .oracle-grid>.card')].map(node=>node.id);
    const shortcuts=[...document.querySelectorAll('[data-oracle-card]')].map(node=>node.textContent);
    const toolbars=[...document.querySelectorAll('.lab-toolbar')].map(node=>({buttons:node.querySelectorAll('button').length,pickers:node.querySelectorAll('select').length,inputs:node.querySelectorAll('input').length,text:node.querySelector('button').textContent}));
    const primary=[...document.querySelectorAll('#browse-lab,#oracle-legacy')].map(node=>node.querySelectorAll('button.primary').length);
    const local=document.getElementById('browse-weeks').closest('.card').id==='browse-teshin-card'&&document.getElementById('browse-circuit-weeks').closest('.card').id==='browse-circuit-card'&&document.getElementById('oracle-cycle-seed').closest('.card').id==='oracle-cycle-card'&&document.getElementById('oracle-locations-seed').closest('.card').id==='oracle-locations-card'&&document.getElementById('oracle-invasion-count').closest('.card').id==='oracle-invasions-card'&&document.getElementById('import-oracle-state').closest('.card').id==='oracle-weekly-card';
    const ok=nav.join('/')==='资料浏览/推算实验室/更新与版本/配置'&&order.join('/')==='oracle-cycle-card/oracle-locations-card/oracle-invasions-card/oracle-weekly-card/oracle-invig-card/oracle-arb-card'&&shortcuts[4].startsWith('05')&&shortcuts[5].startsWith('06')&&toolbars.every(item=>item.buttons===1&&item.pickers===0&&item.inputs===1&&item.text==='刷新并查询')&&primary.every(count=>count===1)&&local&&document.querySelectorAll('#oracle-legacy input[type=datetime-local]').length===1;
    return {ok,nav,order,shortcuts,toolbars,primary,local};
  })()`});
  result.layout=layoutReply.result.value;if(!result.layout?.ok)throw new Error(JSON.stringify(result.layout));
  await fs.mkdir('artifacts', { recursive: true });
  const screenshot = await send('Page.captureScreenshot', { format: 'png' });
  await fs.writeFile('artifacts/ui-oracle.png', Buffer.from(screenshot.data, 'base64'));
  const evaluate = async expression => {
    const reply = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (reply.exceptionDetails) throw new Error(reply.exceptionDetails.exception?.description ?? reply.exceptionDetails.text);
    return reply.result.value;
  };
  result.oracle = await evaluate(`(async()=>{
    const ui=await import('./app.js'),$=ui.$;
    const at=new Date(${oracleFixture.queryAt});$('oracle-time').value=new Date(at.getTime()-at.getTimezoneOffset()*60000).toISOString().slice(0,19);
    $('oracle-cycle-seed').value='';await ui.loadOracleState();await ui.queryOracle();
    const result={cards:document.querySelectorAll('#oracle-legacy .oracle-grid>.card').length,bounties:document.querySelectorAll('.oracle-bounty-row').length,locations:document.querySelectorAll('.oracle-location-row').length,invasions:document.querySelectorAll('.oracle-invasion-row').length,steps:document.querySelectorAll('.oracle-invasion-step').length,rotations:$('oracle-cycle-result').textContent.includes('平原奖励轮次 C'),localized:!document.querySelector('#oracle-cycle-result .oracle-zone-grid').textContent.includes('/Lotus/')};
    if(result.cards!==6||result.bounties!==17||result.locations!==15||result.invasions!==${oracleFixture.invasions.invasions.length}||result.steps!==${oracleFixture.invasions.invasions.length * 2}||!result.rotations||!result.localized)throw new Error(JSON.stringify(result));
    $('oracle').scrollTop=0;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return result;
  })()`);
  await fs.mkdir('artifacts/oracle', { recursive: true });
  await fs.writeFile('artifacts/oracle/ui-overview.png', Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
  await evaluate(`document.getElementById('oracle-locations-card').scrollIntoView()`);
  await fs.writeFile('artifacts/oracle/ui-locations.png', Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
  result.rewards = await evaluate(`(async()=>{
    const ui=await import('./app.js'),$=ui.$,cycle=$('oracle-cycle-result'),locations=$('oracle-locations-result');
    const first=cycle.querySelector('.oracle-reward-table');first.open=true;await new Promise(r=>setTimeout(r,50));
    const text=first.innerText,endo=text.includes('内融核心 × 500')&&text.includes('17.39%'),chinese=!text.includes('/Lotus/');
    const source=first.querySelector('.oracle-reward-source');source.open=true;await new Promise(r=>setTimeout(r,50));
    const provenance=source.innerText.includes('ExportRewards.json')&&source.innerText.includes('dict.zh.json');source.open=false;
    const pickers=[...locations.querySelectorAll('.oracle-reward-picker select')],before=JSON.stringify(ui.oracleResults.locations);
    pickers[0].value='6';pickers[0].dispatchEvent(new Event('change'));
    const local=before===JSON.stringify(ui.oracleResults.locations)&&pickers[0].value==='6',status=locations.querySelector('.oracle-reward-status').textContent.includes('已由该地区世界状态确认');
    const reward=locations.querySelector('.oracle-reward-table');reward.open=true;await new Promise(r=>setTimeout(r,50));
    const locationItems=reward.querySelectorAll('.oracle-reward-item').length,copy=JSON.stringify(ui.oracleResults.cycle).includes('rewardDetails')&&before.includes('rewardCatalog')&&before.includes('nameSource');
    const report={endo,chinese,provenance,pickers:pickers.length,local,status,locationItems,copy,images:document.querySelectorAll('#oracle-cycle-result img,#oracle-locations-result img').length};
    if(!endo||!chinese||!provenance||pickers.length!==3||!local||!status||!locationItems||!copy||report.images)throw new Error(JSON.stringify(report));
    $('oracle-cycle-card').scrollIntoView();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return report;
  })()`);
  await fs.writeFile('artifacts/oracle/ui-rewards-cycle.png', Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
  await evaluate(`document.getElementById('oracle-locations-card').scrollIntoView()`);
  await fs.writeFile('artifacts/oracle/ui-rewards-locations.png', Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
  await evaluate(`document.getElementById('oracle-invasions-card').scrollIntoView()`);
  await fs.writeFile('artifacts/oracle/ui-invasions.png', Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
  result.weekly = await evaluate(`(async()=>{
    const ui=await import('./app.js'),$=ui.$,result=ui.oracleResults.weekly;
    const report={sections:document.querySelectorAll('.oracle-weekly-section').length,missions:document.querySelectorAll('.oracle-weekly-mission').length,risks:document.querySelectorAll('.oracle-weekly-risk').length,variables:document.querySelectorAll('.oracle-weekly-variable').length,localized:$('oracle-weekly-result').textContent.includes('迷人弧犬')&&$('oracle-weekly-result').textContent.includes('钝重兵刃'),raw:result.sections[0].missions[0].raw.risks.includes('EMPBlackHole'),copy:result.labConquestMissions[0].conditions.includes('MagneticHounds')&&Boolean(document.querySelector('[data-copy-oracle=weekly]'))};
    if(report.sections!==2||report.missions!==6||report.risks!==12||report.variables!==8||!report.localized||!report.raw||!report.copy)throw new Error(JSON.stringify(report));
    const visible=$('oracle-weekly-result').querySelector('.oracle-weekly-grid').innerText;
    report.chinese=visible.includes('禁止携带同伴')&&visible.includes('范围缩减')&&visible.includes('贫弱护盾');
    report.clean=!/MT_EXTERMINATION|FortifiedFoes|NoPets|RangeDebuff|AnemicShields/.test(visible);
    report.supplementBadges=document.querySelectorAll('.oracle-translation-badge').length;
    const rawDetails=document.querySelector('.oracle-weekly-mission .oracle-source-details');rawDetails.open=true;report.expand=rawDetails.innerText.includes('MT_EXTERMINATION');rawDetails.open=false;
    if(!report.chinese||!report.clean||report.supplementBadges!==4||!report.expand)throw new Error(JSON.stringify(report));
    $('oracle-weekly-card').scrollIntoView();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return report;
  })()`);
  await fs.mkdir('artifacts/weekly',{recursive:true});
  await fs.writeFile('artifacts/weekly/ui-weekly.png', Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
  result.moduleInputs = await evaluate(`(async()=>{
    const ui=await import('./app.js'),$=ui.$;
    const beforeLocations=ui.oracleResults.locations,beforeInvasion=ui.oracleResults.invasions;
    $('oracle-cycle-seed').value='24091';await $('oracle-cycle-seed').onchange();
    const cycleOnly=ui.oracleResults.cycle.input==='manual-seed'&&ui.oracleResults.locations===beforeLocations&&ui.oracleResults.invasions===beforeInvasion;
    $('oracle-locations-seed').value='12345';await $('oracle-locations-seed').onchange();
    const independentSeeds=String(ui.oracleResults.cycle.seed)==='24091'&&String(ui.oracleResults.locations.seed)==='12345';
    $('arb-count').value='12';await $('arb-count').onchange();
    const localArb=document.querySelectorAll('.arb-entry').length===12;
    $('arb-count').value='24';$('oracle-cycle-seed').value='';$('oracle-locations-seed').value='';await ui.queryOracle();
    const allSix=Boolean(ui.oracleResults.invig&&ui.oracleResults.arb&&ui.oracleResults.weekly)&&document.querySelectorAll('.offer').length===3&&document.querySelectorAll('.arb-entry').length===24;
    if(!cycleOnly||!independentSeeds||!localArb||!allSix)throw new Error(JSON.stringify({cycleOnly,independentSeeds,localArb,allSix}));return {cycleOnly,independentSeeds,localArb,allSix};
  })()`);
  result.oracleEdges = await evaluate(`(async()=>{
    const ui=await import('./app.js'),$=ui.$;
    $('oracle-cycle-seed').value='24091';await ui.queryOracle();
    const seedIndependent=JSON.stringify(ui.oracleResults.weekly.labConquestMissions)===JSON.stringify(${JSON.stringify(weeklyFixture.expected.labConquestMissions)});
    const manual=seedIndependent&&ui.oracleResults.cycle.input==='manual-seed'&&ui.oracleResults.cycle.rot===null&&$('oracle-cycle-result').textContent.includes('离线复算');
    $('oracle-cycle-seed').value='1.5';await ui.queryOracle();
    const badSeed=ui.oracleResults.weekly?.sections.every(row=>row.status==='active')&&!ui.oracleResults.cycle&&document.querySelectorAll('.oracle-bounty-row').length===0&&$('oracle-cycle-result').textContent.includes('十进制');
    $('oracle-cycle-seed').value='';const at=new Date(${oracleFixture.queryAt + 900000});$('oracle-time').value=new Date(at.getTime()-at.getTimezoneOffset()*60000).toISOString().slice(0,19);await ui.queryOracle();
    const expired=!ui.oracleResults.invasions&&document.querySelectorAll('.oracle-invasion-row').length===0&&$('oracle-invasions-result').textContent.includes('采集窗口');
    let pathBlocked=false;try{await window.workbench.call('importOracleState',{file:'/tmp/ignored.json',at:Date.now()});}catch(e){pathBlocked=true;}
    const base=new Date(${oracleFixture.queryAt});$('oracle-time').value=new Date(base.getTime()-base.getTimezoneOffset()*60000).toISOString().slice(0,19);$('oracle-invasion-count').value='8';await ui.queryOracle();
    const eight=ui.oracleResults.invasions.windows.length===8&&document.querySelectorAll('.oracle-invasion-step').length===${oracleFixture.invasions.invasions.length * 8};
    const expiredAt=new Date(Number(${JSON.stringify(weeklyFixture.expected.expiry)})*1000);$('oracle-time').value=new Date(expiredAt.getTime()-expiredAt.getTimezoneOffset()*60000).toISOString().slice(0,19);await ui.queryOracle();
    const weeklyExpired=ui.oracleResults.weekly.sections.every(row=>row.status==='unavailable')&&document.querySelectorAll('.oracle-weekly-mission').length===0;
    if(!weeklyExpired)throw new Error('过期周常仍展示旧任务');
    if(!manual||!badSeed||!expired||!pathBlocked||!eight)throw new Error(JSON.stringify({manual,badSeed,expired,pathBlocked,eight}));return {manual,badSeed,expired,pathBlocked,eight,weeklyExpired};
  })()`);
  result.browse = await evaluate(`(async()=>{
    const ui=await import('./app.js'),$=ui.$;
    const setTime=iso=>{const time=new Date(iso);$('browse-time').value=new Date(time.getTime()-time.getTimezoneOffset()*60000).toISOString().slice(0,16);};
    ui.selectLab('browse-lab');setTime('2026-10-19T12:00Z');await ui.queryBrowse();
    const result={cycles:document.querySelectorAll('.cycle-tile').length,teshin:document.querySelectorAll('.teshin-row').length,circuit:document.querySelectorAll('.circuit-row').length,days:document.querySelectorAll('.incursion-day').length,nodes:document.querySelectorAll('.incursion-node').length,anchored:document.querySelectorAll('.cycle-tile.unavailable').length===0,localized:!document.querySelector('#circuit-result .rotation-list').textContent.includes('/Lotus/')};
    if(result.cycles!==4||result.teshin!==4||result.circuit!==4||result.days!==7||result.nodes!==42||!result.anchored||!result.localized)throw new Error(JSON.stringify(result));
    $('browse-weeks').value='1';await $('browse-weeks').onchange();
    result.independentWeeks=document.querySelectorAll('.teshin-row').length===1&&document.querySelectorAll('.circuit-row').length===4;
    $('browse-circuit-weeks').value='12';await $('browse-circuit-weeks').onchange();
    result.independentWeeks&&=document.querySelectorAll('.teshin-row').length===1&&document.querySelectorAll('.circuit-row').length===12;
    if(!result.independentWeeks)throw new Error('周数条件互相覆盖');
    $('browse-weeks').value='4';$('browse-circuit-weeks').value='4';await ui.queryBrowse();
    $('oracle').scrollTop=0;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    return result;
  })()`);
  await fs.writeFile('artifacts/ui-browse.png', Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
  await evaluate(`document.getElementById('teshin-result').closest('.card').scrollIntoView()`);
  await fs.writeFile('artifacts/ui-weekly.png', Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
  await evaluate(`document.querySelector('.browse-incursions-card').scrollIntoView()`);
  await fs.writeFile('artifacts/ui-incursions.png', Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
  await send('Emulation.setDeviceMetricsOverride', { width: 1080, height: 720, deviceScaleFactor: 1, mobile: false });
  result.narrow = await evaluate(`(async()=>{
    document.getElementById('oracle').scrollTop=0;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    const panel=document.getElementById('oracle');return {fits:panel.scrollWidth<=panel.clientWidth,tiles:document.querySelector('.cycle-tiles').getBoundingClientRect().width};
  })()`);
  if(!result.narrow.fits)throw new Error('1080px 布局溢出');
  await fs.writeFile('artifacts/ui-browse-narrow.png', Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
  result.oracleNarrow = await evaluate(`(async()=>{
    const ui=await import('./app.js');ui.selectLab('oracle-legacy');const at=new Date(${oracleFixture.queryAt});ui.$('oracle-time').value=new Date(at.getTime()-at.getTimezoneOffset()*60000).toISOString().slice(0,19);await ui.queryOracle();ui.$('oracle').scrollTop=0;
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    const panel=ui.$('oracle'),fits=panel.scrollWidth<=panel.clientWidth;if(!fits)throw new Error('Oracle 1080px 布局溢出');return {fits};
  })()`);
  await evaluate(`document.getElementById('oracle-weekly-card').scrollIntoView()`);
  await fs.writeFile('artifacts/weekly/ui-narrow.png', Buffer.from((await send('Page.captureScreenshot', {format:'png'})).data,'base64'));
  await fs.writeFile('artifacts/oracle/ui-narrow.png', Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
  await evaluate(`(async()=>{const ui=await import('./app.js');ui.selectLab('browse-lab');})()`);
  result.edges = await evaluate(`(async()=>{
    const ui=await import('./app.js'),$=ui.$;
    const setTime=iso=>{const time=new Date(iso);$('browse-time').value=new Date(time.getTime()-time.getTimezoneOffset()*60000).toISOString().slice(0,16);};
    setTime('2026-10-19T15:00Z');await ui.queryBrowse();
    const expired=document.querySelectorAll('.cycle-tile.unavailable').length===2;
    setTime('2030-01-01T00:00Z');await ui.queryBrowse();
    const outOfRange=document.querySelectorAll('.incursion-day').length===0&&$('incursions-result').textContent.includes('覆盖范围');
    setTime('2026-10-19T12:00Z');$('browse-weeks').value='12';$('browse-circuit-weeks').value='12';$('browse-days').value='30';await ui.queryBrowse();
    const limits=document.querySelectorAll('.teshin-row').length===12&&document.querySelectorAll('.circuit-row').length===12&&document.querySelectorAll('.incursion-day').length===30;
    ui.applyLibrary(await window.workbench.call('refresh'));
    const cleared=['cycles-result','teshin-result','circuit-result','incursions-result','oracle-cycle-result','oracle-locations-result','oracle-invasions-result','oracle-weekly-result'].every(id=>!$(id).childElementCount)&&Object.keys(ui.oracleResults).length===0;
    if(!expired||!outOfRange||!limits||!cleared)throw new Error(JSON.stringify({expired,outOfRange,limits,cleared}));
    return {expired,outOfRange,limits,cleared};
  })()`);
  result.refreshFailure = await evaluate(`(async()=>{
    const ui=await import('./app.js'),$=ui.$,api=window.workbench;
    const original=await api.call('config'),bad=structuredClone(original);bad.network={proxyUrl:'http://127.0.0.1:1'};await api.call('saveConfig',{text:JSON.stringify(bad)});
    try{
      const at=new Date(${oracleFixture.queryAt}),time=new Date(at.getTime()-at.getTimezoneOffset()*60000).toISOString().slice(0,19);
      $('oracle-time').value=time;$('oracle-time').oninput();$('browse-time').value=time;$('browse-time').oninput();
      ui.selectLab('browse-lab');await $('query-browse').onclick();
      const browse=document.querySelectorAll('.cycle-tile').length===4&&document.querySelectorAll('.incursion-day').length===30&&!$('query-browse').disabled&&$('query-browse').textContent==='刷新并查询'&&new Date($('browse-time').value).getTime()===new Date(time).getTime()&&$('notice').textContent.includes('刷新失败');
      ui.selectLab('oracle-legacy');await $('query-oracle').onclick();
      const oracle=Boolean(ui.oracleResults.cycle&&ui.oracleResults.locations&&ui.oracleResults.invasions&&ui.oracleResults.weekly&&ui.oracleResults.invig&&ui.oracleResults.arb)&&!$('query-oracle').disabled&&$('query-oracle').textContent==='刷新并查询'&&new Date($('oracle-time').value).getTime()===new Date(time).getTime()&&$('notice').textContent.includes('刷新失败');
      if(!browse||!oracle)throw new Error(JSON.stringify({browse,oracle,cycles:document.querySelectorAll('.cycle-tile').length,days:document.querySelectorAll('.incursion-day').length,results:Object.keys(ui.oracleResults),browseTime:$('browse-time').value,oracleTime:$('oracle-time').value,time,notice:$('notice').textContent,browseDisabled:$('query-browse').disabled,oracleDisabled:$('query-oracle').disabled}));return {browse,oracle,preservedTime:true};
    }finally{await api.call('saveConfig',{text:JSON.stringify(original)});}
  })()`);
  if (process.env.WORKBENCH_NETWORK_TEST === '1') result.live = await evaluate(`(async()=>{
    const ui=await import('./app.js');const now=new Date();const time=new Date(now.getTime()-now.getTimezoneOffset()*60000).toISOString().slice(0,19);ui.$('browse-time').value=time;ui.$('oracle-time').value=time;await ui.$('query-browse').onclick();
    const result={calibrated:document.querySelectorAll('.cycle-tile').length===4&&document.querySelectorAll('.cycle-tile.unavailable').length===0,source:ui.$('cycles-result').textContent.includes('https://api.warframe.com/cdn/worldState.php'),buttonRestored:!ui.$('query-browse').disabled};
    if(!result.calibrated||!result.source||!result.buttonRestored)throw new Error(JSON.stringify(result));
    ui.selectLab('oracle-legacy');ui.$('oracle-cycle-seed').value='';await ui.$('query-oracle').onclick();
    result.oracle=Boolean(ui.oracleResults.cycle?.input==='world-state'&&ui.oracleResults.locations?.input==='world-state'&&ui.oracleResults.invasions?.windows.length===8&&ui.oracleResults.weekly?.sections.every(row=>row.status==='active')&&!ui.$('query-oracle').disabled&&ui.$('oracle-state-info').textContent.includes('https://api.warframe.com/cdn/worldState.php'));
    if(!result.oracle)throw new Error('Oracle 官方世界状态刷新失败');
    result.rewardStates=Object.fromEntries(Object.entries(ui.oracleResults.locations.rewardCatalog).map(([tag,catalog])=>[tag,catalog.tiers.map(tier=>tier.status)]));
    result.solarisCached=(await window.workbench.call('oracleStateStatus')).syndicates.some(row=>row.tag==='SolarisSyndicate');
    if(!result.solarisCached||!Object.values(ui.oracleResults.locations.rewardCatalog).every(catalog=>catalog.tiers.every(tier=>tier.tables.every(table=>table.status==='available'))))throw new Error('官方赏金奖励关联不完整');return result;
  })()`);
  await fs.mkdir('artifacts/weekly',{recursive:true});await fs.writeFile('artifacts/weekly/ui-result.json',JSON.stringify(result,null,2));
  await fs.writeFile('artifacts/ui-result.json', JSON.stringify(result, null, 2));
  await fs.writeFile('artifacts/oracle/ui-result.json', JSON.stringify(result, null, 2));
  console.log(result); if (!result.ok) process.exitCode = 1;
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally { socket?.close(); child.kill('SIGTERM'); await new Promise(resolve => child.once('exit', resolve)); await fs.rm(userData, { recursive: true, force: true }); }
