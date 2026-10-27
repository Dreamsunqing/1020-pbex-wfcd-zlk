// Installed outside Desktop alongside a small frozen runtime. Images stay shared.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {archiveWikiImages,downloadAuthorization} from './archive-wiki-images.mjs';
import {atomicJson,withLock} from '../src/core/io.mjs';

const read=async(file,fallback=null)=>{
  try{return JSON.parse(await fs.readFile(file,'utf8'));}
  catch(e){if(e.code==='ENOENT')return fallback;throw e;}
};
export function serviceAction({consent,pause,report,stop,userRequestedDownload=false,now=Date.now()}) {
  if(stop)return {status:'stopped',reason:'User stopped the background service'};
  if(report?.status==='complete')return {status:'complete'};
  try{downloadAuthorization(consent,userRequestedDownload,now);}catch(e){return {status:'awaiting-site-consent',reason:e.message};}
  if(pause?.manualReviewRequired)return {status:'paused',reason:pause.reason,manualReviewRequired:true};
  if(pause&&Date.parse(pause.resumeAfter)>now)return {status:'cooldown',reason:pause.reason,resumeAfter:pause.resumeAfter};
  return {status:'ready'};
}
export async function serviceSnapshot(config,home) {
  const worker=await read(path.join(home,'state.json'));
  let report=null,pause=null,readError=null;
  try {
    report=await read(path.join(config.projectRoot,'artifacts/wiki-images/archive-report.json'));
    pause=await read(path.join(config.projectRoot,'assets/content/wiki/archive-pause.json'));
  }catch(e){readError=e.message;}
  const alive=worker?.pid?(()=>{try{process.kill(worker.pid,0);return true;}catch{return false;}})():false;
  return {checkedAt:new Date().toISOString(),timezone:'Asia/Shanghai',label:config.label,
    projectRoot:config.projectRoot,workerAlive:alive,worker,readError,pause,
    progress:report?{status:report.status,checkedAt:report.checkedAt,cachedFiles:report.cachedFiles,
      downloadedFiles:report.downloadedFiles,pendingFiles:report.pendingFiles,uniquePendingFiles:report.uniquePendingFiles,
      downloadedBytes:report.downloadedBytes,failedFiles:report.failures?.length??0,error:report.error,
      delayPolicy:report.delayPolicy,networkRequests:report.networkRequests,authorizationKind:report.authorizationKind,
      siteConsentObtained:report.siteConsentObtained}:null};
}
export async function dailyCheck(config,home) {
  const snapshot=await serviceSnapshot(config,home);
  const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  await atomicJson(path.join(home,'daily',day+'.json'),snapshot);
  await atomicJson(path.join(home,'latest-check.json'),snapshot);
  const p=snapshot.progress,w=snapshot.worker;
  await fs.writeFile(path.join(home,'daily',day+'.md'),`# Wiki 图片后台状态\n\n北京时间日期：${day}\n\n- 检查时间（UTC）：${snapshot.checkedAt}\n- 后台进程存活：${snapshot.workerAlive}\n- 后台状态：${w?.status??'unknown'}\n- 原因：${w?.reason??snapshot.readError??'无'}\n- 可复用：${p?.cachedFiles??'未知'}；本次新增：${p?.downloadedFiles??'未知'}；待处理：${p?.pendingFiles??'未知'}\n- 原图进度更新时间（UTC）：${p?.checkedAt??'未知'}\n- 失败：${p?.failedFiles??'未知'}；冷却至：${snapshot.pause?.resumeAfter??'无'}\n\n本检查只读下载状态，不发起图片请求、不解除暂停。\n`);
  return snapshot;
}
export async function runService(config,home,{once=false}={}) {
  return withLock(home,async()=>{
    const stateFile=path.join(home,'state.json'),abort=new AbortController();let stopping=false;
    const stop=()=>{stopping=true;abort.abort();};
    process.once('SIGTERM',stop);process.once('SIGINT',stop);
    const startedAt=new Date().toISOString();
    const state=async value=>atomicJson(stateFile,{pid:process.pid,startedAt,checkedAt:new Date().toISOString(),...value});
    try {
      while(!stopping) {
        let action;
        try {
          // Validate local access even while waiting for site consent.
          await fs.access(path.join(config.projectRoot,'assets/content/wiki/inventory.json'));
          action=serviceAction({consent:await read(config.consentFile),
            userRequestedDownload:config.userRequestedDownload===true,
            pause:await read(path.join(config.projectRoot,'assets/content/wiki/archive-pause.json')),
            report:await read(path.join(config.projectRoot,'artifacts/wiki-images/archive-report.json')),
            stop:await read(path.join(home,'stop.json'))});
        }catch(e){action={status:'local-access-error',reason:e.message};}
        await state(action);
        if(['complete','stopped'].includes(action.status))return action;
        if(action.status==='ready') {
          await state({status:'downloading'});
          let heartbeat=Promise.resolve();
          const timer=setInterval(()=>{heartbeat=heartbeat.then(()=>state({status:'downloading'})).catch(e=>console.error(e.message));},30000);
          let result;
          try {
            result=await archiveWikiImages({projectRoot:config.projectRoot,download:true,consentFile:config.consentFile,
              userRequestedDownload:config.userRequestedDownload===true});
          }catch(e) {
            // The archive lock may belong to a manual run. Never bypass it.
            result={status:'service-error',error:e.message};
          }finally{clearInterval(timer);await heartbeat;}
          await state({status:result.status,reason:result.error});
          if(result.status==='complete')return result;
          // Unexpected errors require local review, rather than retrying a site.
          if(result.status==='service-error') {
            await atomicJson(path.join(config.projectRoot,'assets/content/wiki/archive-pause.json'),{
              checkedAt:new Date().toISOString(),manualReviewRequired:true,reason:result.error});
          }
        }
        if(once)return action;
        if(stopping)break;
        await delay(60000,undefined,{signal:abort.signal}).catch(e=>{if(e.name!=='AbortError')throw e;});
      }
      await state({status:'stopped',reason:'Background worker exited'});
    }finally{process.removeListener('SIGTERM',stop);process.removeListener('SIGINT',stop);}
  });
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const home=fileURLToPath(new URL('../',import.meta.url));
  try {
    const config=await read(path.join(home,'service.json'));
    if(!config)throw new Error('请先运行 scripts/install-wiki-archive-service.py 安装独立运行目录');
    if(process.argv.includes('--status'))console.log(JSON.stringify(await serviceSnapshot(config,home),null,2));
    else if(process.argv.includes('--check'))console.log(JSON.stringify(await dailyCheck(config,home),null,2));
    else if(process.argv.includes('--stop')) {
      await atomicJson(path.join(home,'stop.json'),{stoppedAt:new Date().toISOString()});
      console.log('已设置停止标记；后台退出后仍保留图库和断点。');
    }else await runService(config,home,{once:process.argv.includes('--once')});
  }catch(e){console.error(e.stack);process.exitCode=1;}
}
