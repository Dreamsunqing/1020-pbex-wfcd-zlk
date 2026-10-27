import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {archiveWikiImages,robotsPolicy,sha1Hex,originalURL,SITE} from '../scripts/archive-wiki-images.mjs';

const png=Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000b49444154789c636000020000050001a5f645400000000049454e44ae426082','hex');
const hash=(b,algorithm)=>createHash(algorithm).update(b).digest('hex');
async function fixture(t) {
  const projectRoot=await fs.mkdtemp(path.join(os.tmpdir(),'wiki-archive-'));
  t.after(()=>fs.rm(projectRoot,{recursive:true,force:true}));
  const root=path.join(projectRoot,'assets/content/wiki');await fs.mkdir(root,{recursive:true});
  const files=['A','B'].map(name=>({name:name+'.png',url:SITE+'/images/'+name+'.png',mime:'image/png',size:png.length,sha1:hash(png,'sha1'),timestamp:'2026-01-01T00:00:00Z'}));
  await fs.writeFile(path.join(root,'inventory.json'),JSON.stringify({site:SITE,complete:true,files}));
  const consentFile=path.join(projectRoot,'consent.json');
  await fs.writeFile(consentFile,JSON.stringify({site:SITE,scope:'all-original-images',approvedBy:'Test fixture only',reference:'Offline test; no real permission',grantedAt:'2020-01-01',expiresAt:'2099-01-01',minIntervalMs:3000}));
  return {projectRoot,root,consentFile,wait:async()=>{},log:()=>{}};
}
test('default and missing consent never contact the network',async t=>{
  const options=await fixture(t);let calls=0;
  const fetchImpl=async()=>{calls++;throw Error('must stay offline');};
  const plan=await archiveWikiImages({...options,fetchImpl});assert.equal(plan.pendingFiles,2);assert.equal(plan.networkRequests,0);
  const blocked=await archiveWikiImages({...options,consentFile:undefined,download:true,fetchImpl});
  assert.equal(blocked.status,'awaiting-site-consent');assert.equal(calls,0);
});
test('explicit user request can download without claiming website approval, retaining robots checks',async t=>{
  const options=await fixture(t);const urls=[];
  const fetchImpl=async url=>{urls.push(url);return url.endsWith('robots.txt')?new Response('User-agent: *\nDisallow: /*api.php\n',{headers:{'content-type':'text/plain'}}):new Response(png,{headers:{'content-type':'image/png'}});};
  const result=await archiveWikiImages({...options,consentFile:undefined,download:true,userRequestedDownload:true,fetchImpl});
  assert.equal(result.status,'complete');assert.equal(result.authorizationKind,'user-requested');
  assert.equal(result.siteConsentObtained,false);assert.equal(result.downloadedFiles,1);
  assert.equal(urls.length,2);assert.ok(urls[0].endsWith('robots.txt'));
  const policy=JSON.parse(await fs.readFile(path.join(options.projectRoot,'artifacts/wiki-images/archive-policy.json'),'utf8'));
  assert.equal(policy.siteConsentObtained,false);assert.equal(policy.consentReference,undefined);
});
test('explicit CDN transformations retain separate source hashes, are never labelled originals, and resume locally',async t=>{
  const options=await fixture(t),inventoryFile=path.join(options.root,'inventory.json');
  const inventory=JSON.parse(await fs.readFile(inventoryFile,'utf8'));
  for(const file of inventory.files){file.sha1='b'.repeat(40);file.size=png.length+10;}
  await fs.writeFile(inventoryFile,JSON.stringify(inventory));
  let calls=0;const fetchImpl=async url=>{calls++;return url.endsWith('robots.txt')?new Response('User-agent: *\nAllow: /\n',{headers:{'content-type':'text/plain'}}):new Response(png,{headers:{'content-type':'image/png','cf-polished':'origSize=100; status=lossless'}});};
  const first=await archiveWikiImages({...options,download:true,fetchImpl});assert.equal(first.status,'complete');assert.equal(first.downloadedDeliveryVariants,1);
  const receipt=JSON.parse((await fs.readFile(path.join(options.root,'archive-receipts.jsonl'),'utf8')).split('\n')[0]);
  assert.equal(receipt.original,false);assert.equal(receipt.deliveryVariant,true);assert.equal(receipt.sourceSha1,'b'.repeat(40));assert.equal(receipt.sha1,hash(png,'sha1'));
  const next=await archiveWikiImages({...options,fetchImpl});assert.equal(next.cachedFiles,2);assert.equal(calls,2);
});
test('archive preserves original bytes, deduplicates upstream aliases and resumes without image requests',async t=>{
  const options=await fixture(t),calls=[],waits=[];
  const fetchImpl=async (url,init)=>{
    assert.match(init.headers['User-Agent'],/contact: dream_demo@outlook\.com/);
    assert.match(init.headers['User-Agent'],/slow image downloads for personal use only, to practice creating video assets/);
    calls.push(url);return url.endsWith('robots.txt')?new Response('User-agent: *\nDisallow: /*api.php\nCrawl-delay: 6\n',{headers:{'content-type':'text/plain'}}):new Response(png,{headers:{'content-type':'image/png'}});
  };
  const first=await archiveWikiImages({...options,download:true,fetchImpl,wait:async ms=>waits.push(ms)});
  assert.equal(first.status,'complete');assert.equal(first.downloadedFiles,1);assert.equal(first.cachedFiles,1);assert.equal(calls.length,2);
  assert.ok(waits.some(ms=>ms>=5900));
  assert.ok(waits.every(ms=>ms<=10000));
  assert.deepEqual(first.delayPolicy,{minMs:6000,maxMs:10000,meanMs:8000});
  assert.deepEqual(await fs.readFile(path.join(options.root,'img',hash(png,'sha256')+'.png')),png);
  const next=await archiveWikiImages({...options,download:true,fetchImpl});assert.equal(next.cachedFiles,2);assert.equal(next.downloadedFiles,0);assert.equal(calls.length,3);
  // Corruption is detected by content hash on the next offline preflight.
  await fs.writeFile(path.join(options.root,'img',hash(png,'sha256')+'.png'),'corrupt');
  assert.equal((await archiveWikiImages({...options,fetchImpl})).pendingFiles,2);
});
test('site minimum beyond ten seconds overrides the requested random range',async t=>{
  const options=await fixture(t),waits=[];
  const fetchImpl=async url=>url.endsWith('robots.txt')?new Response('User-agent: *\nCrawl-delay: 12\n',{headers:{'content-type':'text/plain'}}):new Response(png,{headers:{'content-type':'image/png'}});
  const result=await archiveWikiImages({...options,download:true,fetchImpl,wait:async ms=>waits.push(ms)});
  assert.equal(result.status,'complete');assert.deepEqual(result.delayPolicy,{minMs:12000,maxMs:12000,meanMs:12000});
  assert.ok(waits.some(ms=>ms>=11900));
});
test('robots denial stops before any image request',async t=>{
  const options=await fixture(t);let calls=0;
  const report=await archiveWikiImages({...options,download:true,fetchImpl:async()=>{calls++;return new Response('User-agent: *\nDisallow: /images/\n',{headers:{'content-type':'text/plain'}});}});
  assert.equal(calls,1);assert.equal(report.status,'paused');assert.match(report.error,/robots/);
});
for (const status of [403,429,503]) test('HTTP '+status+' stops all downloads and persists the pause across runs',async t=>{
  const options=await fixture(t);let calls=0;
  const fetchImpl=async url=>{calls++;return url.endsWith('robots.txt')?new Response('User-agent: *\nDisallow: /*api.php\n',{headers:{'content-type':'text/plain'}}):new Response('',{status,headers:{'retry-after':'600'}});};
  const first=await archiveWikiImages({...options,download:true,fetchImpl});assert.equal(first.status,'paused');assert.equal(calls,2);
  assert.ok(Date.parse(first.pause.resumeAfter)>Date.now());assert.equal(first.pause.manualReviewRequired,status===403);
  const next=await archiveWikiImages({...options,download:true,fetchImpl});assert.equal(next.status,'paused');assert.equal(calls,2);
});
test('unexpected HTML or stale file hash stops without publishing an original',async t=>{
  const options=await fixture(t);
  const fetchImpl=async url=>url.endsWith('robots.txt')?new Response('User-agent: *\nAllow: /\n',{headers:{'content-type':'text/plain'}}):new Response('<html>challenge</html>',{headers:{'content-type':'text/html'}});
  const result=await archiveWikiImages({...options,download:true,fetchImpl});assert.equal(result.status,'paused');assert.equal(result.downloadedFiles,0);
  assert.equal(await fs.stat(path.join(options.root,'img')).then(()=>true,()=>false),false);
});
test('path and robots rules handle specific agents, percent escapes and wildcard/end matching',()=>{
  assert.equal(originalURL(SITE+'/api.php'),false);assert.equal(originalURL(SITE+'/images/thumb/A.png'),false);
  assert.equal(originalURL(SITE+'/images/A.svg?abcde'),true);assert.equal(originalURL('https://elsewhere.test/images/A.png'),false);
  assert.equal(originalURL(SITE+'/images/Sortie_9%2F3%2F2016.jpg?abc'),true);
  assert.equal(originalURL(SITE+'/images/%2e%2e%2fapi.php'),false);
  const rules='User-agent: *\nDisallow: /*api.php\nDisallow: /images/private/\nAllow: /images/private/open.png$\n';
  assert.equal(robotsPolicy(rules,SITE+'/api.php?action=query').allowed,false);
  assert.equal(robotsPolicy(rules,SITE+'/images/%70rivate/no.png').allowed,false);
  assert.equal(robotsPolicy(rules,SITE+'/images/private/open.png').allowed,true);
  assert.equal(robotsPolicy(rules,SITE+'/images/private/open.png?x').allowed,false);
  assert.equal(robotsPolicy(rules+'User-agent: SourceWorkbenchWikiArchive\nDisallow: /\n',SITE+'/images/A.png').allowed,false);
  const hex=hash(png,'sha1');assert.equal(sha1Hex(BigInt('0x'+hex).toString(36)),hex);
});
test('reuse is based on real bytes when old source SHA1 is wrong; original index stays untouched',async t=>{
  const options=await fixture(t),assetName=hash(png,'sha256')+'.png';
  await fs.mkdir(path.join(options.root,'img'));await fs.writeFile(path.join(options.root,'img',assetName),png);
  const old=JSON.stringify({assets:[{original:true,assetName,sha256:hash(png,'sha256'),sha1:'a'.repeat(40),bytes:png.length,mime:'image/png'}],mappings:[{id:'/keep/me'}]});
  await fs.writeFile(path.join(options.root,'index.json'),old);
  const plan=await archiveWikiImages(options);assert.equal(plan.cachedFiles,2);assert.equal(plan.localAudit.sourceSha1Mismatches,1);
  assert.equal(await fs.readFile(path.join(options.root,'index.json'),'utf8'),old);
});
test('resume repairs a torn final receipt while retaining complete records',async t=>{
  const options=await fixture(t),journal=path.join(options.root,'archive-receipts.jsonl');
  const complete=JSON.stringify({status:'failed',imageName:'previous.png'});
  await fs.writeFile(journal,complete+'\n{"status":');
  await archiveWikiImages(options);assert.equal(await fs.readFile(journal,'utf8'),complete+'\n');
});
test('an interrupted first receipt leaves an empty recoverable journal',async t=>{
  const options=await fixture(t),journal=path.join(options.root,'archive-receipts.jsonl');
  await fs.writeFile(journal,'{"status":');
  await archiveWikiImages(options);assert.equal(await fs.readFile(journal,'utf8'),'');
  assert.equal((await archiveWikiImages(options)).pendingFiles,2);
});
