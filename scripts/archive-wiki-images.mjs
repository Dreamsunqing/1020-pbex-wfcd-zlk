// Whole-Wiki originals, separate from the explicit entity bindings of tool 15/18.
// Offline by default. Explicit downloads preserve the actual authorization basis.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash, randomUUID, randomInt} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {fetch, EnvHttpProxyAgent} from 'undici';
import {atomicJson, withLock} from '../src/core/io.mjs';

export const SITE = 'https://wiki.warframe.com';
export const USER_AGENT = 'SourceWorkbenchWikiArchive/1.0 (+https://github.com/Dreamsunqing/1020-pbex-wfcd-zlk; contact: dream_demo@outlook.com; slow image downloads for personal use only, to practice creating video assets)';
export const TYPES = {'image/png':'png', 'image/jpeg':'jpg', 'image/webp':'webp', 'image/gif':'gif', 'image/svg+xml':'svg', 'image/x-icon':'ico'};
const TERMS = 'https://weirdgloop.org/terms/';
const sha = (bytes, algorithm='sha256') => createHash(algorithm).update(bytes).digest('hex');
const read = async (file, fallback) => {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return fallback; throw error; }
};
export function originalURL(value) {
  try {
    const u = new URL(value);
    const decoded=decodeURIComponent(u.pathname);
    return u.origin === SITE && !u.username && !u.password && !u.hash &&
      decoded.startsWith('/images/') && !decoded.startsWith('/images/thumb/') &&
      !decoded.startsWith('/images/archive/') && !decoded.split('/').some(p=>p==='.'||p==='..') &&
      !/[\\\x00-\x1f]/.test(decoded);
  } catch { return false; }
}
// MediaWiki can return hexadecimal SHA1 or a base-36 encoding of that integer.
export function sha1Hex(value) {
  if (typeof value !== 'string') return null;
  if (/^[a-f0-9]{40}$/i.test(value)) return value.toLowerCase();
  if (!/^[a-z0-9]{1,31}$/i.test(value)) return null;
  let result = 0n;
  for (const c of value.toLowerCase()) result = result * 36n + BigInt(parseInt(c, 36));
  const hex = result.toString(16);
  return hex.length <= 40 ? hex.padStart(40, '0') : null;
}
export function checkConsent(consent, now=Date.now()) {
  if (consent?.site !== SITE || consent?.scope !== 'all-original-images' ||
      !['approvedBy','reference'].every(k => typeof consent[k] === 'string' && consent[k].trim()) ||
      !Number.isFinite(Date.parse(consent.grantedAt)) || Date.parse(consent.grantedAt) > now ||
      !Number.isFinite(Date.parse(consent.expiresAt)) || Date.parse(consent.expiresAt) <= now ||
      !Number.isFinite(consent.minIntervalMs) || consent.minIntervalMs < 3000) {
    throw new Error('缺少有效的站方批量图片许可。先取得许可并记录来源、范围、有效期及请求间隔；不发送网络请求。');
  }
  return consent;
}
export function downloadAuthorization(consent,userRequestedDownload=false,now=Date.now()) {
  // An operator instruction is never represented as approval from the website.
  if(consent!=null)return {...checkConsent(consent,now),kind:'site-consent',siteConsentObtained:true};
  if(userRequestedDownload===true)return {kind:'user-requested',siteConsentObtained:false,minIntervalMs:3000};
  return checkConsent(consent,now);
}
export function retryAfter(value, now=Date.now()) {
  if (!value) return now + 3600_000;
  if (/^\d+$/.test(value)) return now + Math.max(60_000, Number(value)*1000);
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(now+60_000, date) : now+3600_000;
}
// Longest matching group/rule, Allow wins ties; unknown request-rate fails closed.
export function robotsPolicy(text, url, product='SourceWorkbenchWikiArchive') {
  const groups=[]; let group={agents:[], rules:[], delays:[], rates:[]}, started=false;
  for (const line of text.split(/\r?\n/)) {
    const match=/^\s*([^:#]+):\s*(.*?)\s*$/.exec(line.replace(/#.*/, ''));
    if (!match) continue;
    const key=match[1].toLowerCase(), value=match[2].trim();
    if (key==='user-agent') {
      if (started) { groups.push(group); group={agents:[],rules:[],delays:[],rates:[]}; started=false; }
      group.agents.push(value.toLowerCase());
    } else if (group.agents.length) {
      started=true;
      if (key==='allow'||key==='disallow') { if (value) group.rules.push({allow:key==='allow',value}); }
      if (key==='crawl-delay') group.delays.push(Number(value));
      if (key==='request-rate') group.rates.push(value);
    }
  }
  groups.push(group);
  const scored=groups.map(g=>({...g,score:Math.max(-1,...g.agents.map(a=>a==='*'?0:product.toLowerCase().includes(a)?a.length:-1))}));
  const best=Math.max(-1,...scored.map(g=>g.score));
  const active=scored.filter(g=>g.score===best&&best>=0);
  const u=new URL(url), target=u.pathname+u.search;
  let winner=null;
  for (const rule of active.flatMap(g=>g.rules)) {
    const end=rule.value.endsWith('$'), source=end?rule.value.slice(0,-1):rule.value;
    const expression='^'+source.split('*').map(s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('.*')+(end?'$':'');
    const matches=new RegExp(expression).test(target)||new RegExp(expression).test(decodeURI(target));
    const length=source.replaceAll('*','').length;
    if (matches&&(!winner||length>winner.length||length===winner.length&&rule.allow)) winner={...rule,length};
  }
  const delays=active.flatMap(g=>g.delays);
  return {allowed:(winner?.allow??true)&&!active.some(g=>g.rates.length)&&delays.every(v=>Number.isFinite(v)&&v>=0),
    minIntervalMs:Math.max(0,...delays.map(v=>v*1000)), matchedRule:winner?.value??null};
}
export function verifyImage(bytes, mime) {
  if (mime==='image/png') return bytes.subarray(0,8).toString('hex')==='89504e470d0a1a0a';
  if (mime==='image/jpeg') return bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
  if (mime==='image/webp') return bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP';
  if (mime==='image/gif') return /^GIF8[79]a$/.test(bytes.subarray(0,6).toString());
  if (mime==='image/x-icon') return bytes.subarray(0,4).toString('hex')==='00000100';
  if (mime==='image/svg+xml') return /^\s*(?:<\?xml[\s\S]*?\?>\s*)?(?:<!--[\s\S]*?-->\s*)*(?:<!DOCTYPE[\s\S]*?>\s*)?<svg(?:\s|>)/i.test(bytes.toString('utf8').replace(/^\uFEFF/,''));
  return false;
}
async function receipts(file) {
  const content=await fs.readFile(file,'utf8').catch(e=>{if(e.code==='ENOENT')return '';throw e;});
  const rows=[]; const lines=content.split('\n');
  for (let n=0;n<lines.length;n++) {
    if (!lines[n]) continue;
    try { rows.push(JSON.parse(lines[n])); }
    catch (e) {
      if (n!==lines.length-1) throw new Error('归档日志中间损坏，停止以保护续传记录');
      // A killed append may leave only the last line incomplete.
      await fs.truncate(file,Buffer.byteLength(lines.slice(0,n).map(line=>line+'\n').join('')));
    }
  }
  if (content && !content.endsWith('\n') && rows.length && lines.at(-1)) {
    // A complete final JSON row still needs a separator before the next append.
    const final=await fs.readFile(file,'utf8');
    if (!final.endsWith('\n')) await fs.appendFile(file,'\n');
  }
  return rows;
}
export async function archiveWikiImages({projectRoot=process.cwd(), download=false, consentFile,userRequestedDownload=false,
  maxFiles=Infinity, fetchImpl=fetch, wait=ms=>new Promise(r=>setTimeout(r,ms)), log=console.log}={}) {
  const root=path.join(projectRoot,'assets/content/wiki'), out=path.join(projectRoot,'artifacts/wiki-images');
  const reportFile=path.join(out,'archive-report.json'), planFile=path.join(out,'archive-plan.json');
  await fs.mkdir(out,{recursive:true});
  return withLock(root,async()=>{
    const inventoryFile=path.join(root,'inventory.json'), inventoryBytes=await fs.readFile(inventoryFile);
    const inventory=JSON.parse(inventoryBytes);
    if (!inventory.complete||inventory.site!==SITE||!Array.isArray(inventory.files)) throw new Error('需要已有完整 Wiki 目录；不会调用 robots 禁止的 api.php 补目录。');
    const index=await read(path.join(root,'index.json'),{assets:[]}), journalFile=path.join(root,'archive-receipts.jsonl');
    const history=await receipts(journalFile), candidates=new Map(), variants=new Map(), verified=new Map(), localChecks=new Map();
    const localAudit={validFiles:0,missingFiles:0,invalidContentHashes:0,sourceSha1Mismatches:0,sourceSha1MismatchExamples:[]};
    log('离线检查目录与现有 Wiki 原图（不联网）…');
    for (const r of [...index.assets,...history.filter(r=>r.status==='complete')]) {
      if ((!r.original&&!r.deliveryVariant)||!sha1Hex(r.sha1)||!/^([a-f0-9]{64})\.(png|jpg|webp|gif|svg|ico)$/.test(r.assetName??'')) continue;
      if (!localChecks.has(r.assetName)) {
        const bytes=await fs.readFile(path.join(root,'img',r.assetName)).catch(e=>{if(e.code==='ENOENT')return null;throw e;});
        if (!bytes) {localAudit.missingFiles++;localChecks.set(r.assetName,null);}
        else if (sha(bytes)!==r.sha256||!verifyImage(bytes,r.mime)) {localAudit.invalidContentHashes++;localChecks.set(r.assetName,null);}
        else {
          const actual=sha(bytes,'sha1');
          const checked={...r,sha1:actual,bytes:bytes.length};
          localChecks.set(r.assetName,checked);verified.set(r.assetName,checked);localAudit.validFiles++;
          if (actual!==sha1Hex(r.sha1)) {
            localAudit.sourceSha1Mismatches++;
            if (localAudit.sourceSha1MismatchExamples.length<20) localAudit.sourceSha1MismatchExamples.push({imageName:r.imageName,recorded:r.sha1,actual});
          }
        }
      }
      const checked=localChecks.get(r.assetName);
      if (checked) {
        candidates.set(checked.sha1,checked);
        if(checked.deliveryVariant&&sha1Hex(checked.sourceSha1)&&originalURL(checked.originURL))variants.set(sha1Hex(checked.sourceSha1),checked);
      }
    }
    const byType={}, files=[];
    let cached=0, cachedBytes=0, totalBytes=0;
    for (const r of inventory.files) {
      if (!r.mime?.startsWith('image/')) continue;
      const ext=TYPES[r.mime], digest=sha1Hex(r.sha1);
      let reason=!ext?'unsupported-image-mime':!originalURL(r.url)?'unsafe-original-url':!digest?'missing-valid-sha1':!Number.isSafeInteger(r.size)||r.size<=0?'invalid-size':null;
      const prior=candidates.get(digest)??variants.get(digest);
      let local=null;
      if (!reason&&prior) {
        local=verified.get(prior.assetName);
        if (local&&!local.deliveryVariant&&local.bytes!==r.size) local=null;
      }
      const state=reason?'blocked':local?'cached':'pending';
      files.push({...r,sha1:digest,status:state,...(reason?{reason}:{}),...(local?{assetName:local.assetName,sha256:local.sha256,deliveryVariant:local.deliveryVariant??false}:{})});
      byType[r.mime]??={files:0,bytes:0,cached:0}; byType[r.mime].files++; byType[r.mime].bytes+=r.size||0;
      totalBytes+=r.size||0;
      if (local) {cached++;cachedBytes+=r.size;byType[r.mime].cached++;}
    }
    const plan={schemaVersion:1,createdAt:new Date().toISOString(),site:SITE,inventoryCheckedAt:inventory.checkedAt,
      inventorySha256:sha(inventoryBytes),inventoryFiles:inventory.files.length,files};
    await atomicJson(planFile,plan);
    const disk=await fs.statfs(root),pending=files.filter(r=>r.status==='pending'),uniquePending=new Map(pending.map(r=>[r.sha1,r]));
    const diskAvailableBytes=disk.bavail*disk.bsize,uniquePendingBytes=[...uniquePending.values()].reduce((n,r)=>n+r.size,0);
    const report={schemaVersion:1,checkedAt:plan.createdAt,status:download?'preflight':'offline-preflight-complete',
      networkRequests:0,termsURL:TERMS,consentRequired:true,site:SITE,inventoryCheckedAt:inventory.checkedAt,
      inventorySha256:plan.inventorySha256,inventoryFiles:inventory.files.length,imageFiles:files.length,totalBytes,
      cachedFiles:cached,cachedBytes,pendingFiles:files.filter(r=>r.status==='pending').length,
      blockedFiles:files.filter(r=>r.status==='blocked').length,pendingBytes:files.filter(r=>r.status==='pending').reduce((n,r)=>n+r.size,0),
      excludedNonImages:inventory.files.length-files.length,uniquePendingFiles:uniquePending.size,uniquePendingBytes,
      minimumRequestHours:uniquePending.size*3/3600,diskAvailableBytes,diskSufficient:diskAvailableBytes>uniquePendingBytes+1024**3,
      delayPolicy:{minMs:3000,maxMs:10000,meanMs:6500},expectedWaitHours:uniquePending.size*6.5/3600,
      localAudit,byType,downloadedFiles:0,downloadedBytes:0,downloadedDeliveryVariants:0,failures:[],
      note:'目录截至所列时间；归档不新增实体关系。源字节一致标为 original；有明确 Cloudflare Polish 转换证据的响应单列 deliveryVariant 并保留源与实收哈希。SVG/GIF/ICO 不接入应用图片渲染。'};
    await atomicJson(reportFile,report);
    if (!download) {log(JSON.stringify(report,null,2));return report;}
    let consent,authorization;
    try {consent=consentFile?await read(path.resolve(consentFile),null):null;authorization=downloadAuthorization(consent,userRequestedDownload);}
    catch (error) {report.status='awaiting-site-consent';report.error=error.message;await atomicJson(reportFile,report);log(error.message);return report;}
    report.authorizationKind=authorization.kind;report.siteConsentObtained=authorization.siteConsentObtained;
    report.consentRequired=!userRequestedDownload;
    if (!report.diskSufficient) {report.status='paused';report.error='可用磁盘不足（需容纳待下载唯一内容及 1 GiB 余量）';await atomicJson(reportFile,report);return report;}
    const pauseFile=path.join(root,'archive-pause.json'), pause=await read(pauseFile,null);
    if (pause&&(pause.manualReviewRequired||Date.parse(pause.resumeAfter)>Date.now())) {
      report.status='paused'; report.pause=pause; await atomicJson(reportFile,report);return report;
    }
    // Use the configured network route consistently; never rotate proxies or identities.
    const agent=fetchImpl===fetch?new EnvHttpProxyAgent():null;
    let lastFinished=0, interval=Math.max(3000,authorization.minIntervalMs), stopped=false;
    const controller=new AbortController(), stop=()=>{stopped=true;controller.abort();};
    process.once('SIGINT',stop);process.once('SIGTERM',stop);
    async function get(url,maxBytes) {
      downloadAuthorization(consent,userRequestedDownload);
      if (stopped) throw new Error('已停止');
      const lower=Math.ceil(interval),upper=Math.max(10000,lower);
      report.delayPolicy={minMs:lower,maxMs:upper,meanMs:(lower+upper)/2};
      report.expectedWaitHours=uniquePending.size*report.delayPolicy.meanMs/3600_000;
      const delay=randomInt(lower,upper+1);
      await wait(lastFinished?Math.max(0,lastFinished+delay-Date.now()):0);
      if (stopped) throw new Error('已停止');
      downloadAuthorization(consent,userRequestedDownload);
      report.networkRequests++;
      try {
        const response=await fetchImpl(url,{...(agent?{dispatcher:agent}:{}),redirect:'error',
          signal:AbortSignal.any([controller.signal,AbortSignal.timeout(60000)]),
          headers:{'User-Agent':USER_AGENT,'Accept':'*/*'}});
        if (!response.ok) {
          await response.body?.cancel();
          const error=new Error('HTTP '+response.status);
          error.status=response.status;error.retryAfter=response.headers.get('retry-after');throw error;
        }
        if (Number(response.headers.get('content-length'))>maxBytes) {await response.body?.cancel();throw new Error('响应超过大小限制');}
        let size=0;const chunks=[];
        for await (const c of response.body) {size+=c.length;if(size>maxBytes){await controller.abort();throw new Error('响应超过大小限制');}chunks.push(c);}
        return {bytes:Buffer.concat(chunks),mime:response.headers.get('content-type')?.split(';')[0].trim(),cfPolished:response.headers.get('cf-polished')};
      } finally {lastFinished=Date.now();}
    }
    const journal=await fs.open(journalFile,'a');
    async function record(row) {await journal.write(JSON.stringify(row)+'\n');await journal.sync();}
    try {
      // Unknown/unavailable robots is a stop condition, never an implicit Allow.
      const {bytes,mime}=await get(SITE+'/robots.txt',1024*1024);
      if (mime!=='text/plain'||!/^\s*(?:#|user-agent:)/i.test(bytes.toString())) throw new Error('无法可靠读取 robots.txt');
      const robots=bytes.toString('utf8');
      await atomicJson(path.join(out,'archive-policy.json'),{checkedAt:new Date().toISOString(),userAgent:USER_AGENT,
        termsURL:TERMS,authorizationKind:authorization.kind,siteConsentObtained:authorization.siteConsentObtained,
        consentReference:consent?.reference,robotsURL:SITE+'/robots.txt',robotsSha256:sha(bytes),robots});
      const policy=robotsPolicy(robots,SITE+'/images/example.png');
      interval=Math.max(interval,policy.minIntervalMs);
      report.minIntervalMs=interval;report.consentReference=consent?.reference;
      report.status='running';report.checkedAt=new Date().toISOString();await atomicJson(reportFile,report);
      let attempted=0;
      for (const row of files) {
        if (stopped||attempted>=maxFiles) break;
        if (row.status!=='pending') continue;
        const policy=robotsPolicy(robots,row.url);
        if (!policy.allowed) throw new Error('robots.txt 禁止原图路径，停止：'+row.url);
        interval=Math.max(interval,policy.minIntervalMs);
        // One original per unique upstream hash, even across different File names.
        const duplicate=candidates.get(row.sha1);
        if (duplicate&&verified.get(duplicate.assetName)) {
          await record({...duplicate,imageName:row.name,timestamp:row.timestamp,originURL:row.url,status:'complete',reused:true});
          report.pendingFiles--;report.pendingBytes-=row.size;report.cachedFiles++;report.cachedBytes+=row.size;continue;
        }
        attempted++;
        try {
          const {bytes,mime,cfPolished}=await get(row.url,Math.max(row.size,32*1024*1024));
          const actualSha1=sha(bytes,'sha1');
          const exact=mime===row.mime&&bytes.length===row.size&&actualSha1===row.sha1&&verifyImage(bytes,row.mime);
          const deliveryVariant=!exact&&TYPES[mime]&&bytes.length<=row.size&&verifyImage(bytes,mime)&&
            /(?:^|[;\s])(?:status=)?(?:lossy|lossless|webp|webp_bigger)(?:[;\s]|$)/i.test(cfPolished??'');
          if (!exact&&!deliveryVariant) throw new Error('原图格式、大小或 SHA1 与目录不符且无明确服务器转换证据：'+row.name);
          const digest=sha(bytes), assetName=digest+'.'+TYPES[mime];
          await fs.mkdir(path.join(root,'img'),{recursive:true});
          const target=path.join(root,'img',assetName),temp=target+'.'+randomUUID()+'.tmp';
          try {await fs.writeFile(temp,bytes,{flag:'wx'});await fs.rename(temp,target);}
          finally {await fs.rm(temp,{force:true});}
          const receipt={status:'complete',imageName:row.name,assetName,sha256:digest,sha1:actualSha1,bytes:bytes.length,
            mime,originURL:row.url,wikiPage:row.descriptionurl,timestamp:row.timestamp,original:exact,
            ...(deliveryVariant?{deliveryVariant:true,sourceSha1:row.sha1,sourceBytes:row.size,sourceMime:row.mime,serverTransformation:{provider:'Cloudflare Polish',header:cfPolished}}:{}),
            retrievedAt:new Date().toISOString(),inventorySha256:plan.inventorySha256};
          await record(receipt);candidates.set(row.sha1,receipt);verified.set(assetName,receipt);
          report.downloadedFiles++;report.downloadedBytes+=bytes.length;report.pendingFiles--;report.pendingBytes-=row.size;
          if(deliveryVariant)report.downloadedDeliveryVariants++;
        } catch (error) {
          if (error.status!==404&&error.status!==410) throw error;
          const failure={imageName:row.name,url:row.url,error:error.message,checkedAt:new Date().toISOString()};
          report.failures.push(failure);await record({status:'failed',...failure});
          if (report.failures.length>=3) throw new Error('连续目录失效风险，停止并等待目录复核');
        }
        if (attempted%25===0) {report.status='running';report.checkedAt=new Date().toISOString();await atomicJson(reportFile,report);log('Wiki 图片 '+report.downloadedFiles+'（服务器转换 '+report.downloadedDeliveryVariants+'）；待下载 '+report.pendingFiles);}
      }
      report.status=stopped?'interrupted':report.pendingFiles===0&&report.blockedFiles===0?'complete':'partial';
    } catch (error) {
      report.status=stopped?'interrupted':'paused';report.error=error.message;
      if (!stopped) {
        const pause={checkedAt:new Date().toISOString(),reason:error.message,
          manualReviewRequired:[401,403].includes(error.status)||!error.status||![429,503].includes(error.status),
          resumeAfter:new Date(retryAfter(error.retryAfter)).toISOString()};
        await atomicJson(pauseFile,pause);report.pause=pause;
      }
    } finally {
      await journal.close();await agent?.close();
      process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop);
      report.checkedAt=new Date().toISOString();await atomicJson(reportFile,report);
    }
    log(JSON.stringify(report,null,2));return report;
  });
}

if (process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const argv=process.argv.slice(2);
  try {
    let download=false,consentFile,maxFiles=Infinity,userRequestedDownload=false;
    for(let i=0;i<argv.length;i++) {
      if (argv[i]==='--download') download=true;
      else if (argv[i]==='--user-requested') userRequestedDownload=true;
      else if (argv[i]==='--plan'||argv[i]==='--resume') continue;
      else if (argv[i]==='--consent') {consentFile=argv[++i];if(!consentFile)throw new Error('--consent 需要文件路径');}
      else if (argv[i]==='--max-files') {maxFiles=Number(argv[++i]);if(!Number.isSafeInteger(maxFiles)||maxFiles<1)throw new Error('--max-files 需要正整数');}
      else if (argv[i]==='--help') {console.log('node 工具/19-获取全部Wiki图片.mjs [--plan] [--download (--consent <站方许可.json> | --user-requested)] [--resume] [--max-files N]\n默认完全离线预检。--user-requested 记录用户直接要求，不能冒充站方许可；仍遵守robots与限流。详见文档第37章。');process.exit(0);}
      else throw new Error('未知参数：'+argv[i]);
    }
    const result=await archiveWikiImages({download,consentFile,maxFiles,userRequestedDownload});
    if (['awaiting-site-consent','paused','interrupted'].includes(result.status)) process.exitCode=2;
  } catch(error) {console.error(error.message);process.exitCode=1;}
}
