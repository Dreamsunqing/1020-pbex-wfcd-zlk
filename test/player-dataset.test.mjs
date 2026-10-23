import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {Worker} from 'node:worker_threads';
import {resolvePlayerDataset} from '../src/core/player-dataset.mjs';
import {loadPlayerBundle} from '../src/core/player-bundle.mjs';
import {MergeRepository} from '../src/core/merge/repository.mjs';
import {mergedStatus} from '../src/core/merge/service.mjs';
import {digest,stable,FULL_MODELING_VERSION} from '../src/core/merge/contract.mjs';
import {sha256} from '../src/core/io.mjs';
async function fixture(t){const root=await fs.mkdtemp(path.join(os.tmpdir(),'wb-player-dataset-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));return fs.realpath(root);}
async function save(repository,model,scope='full'){
 const output={'items/weapons.json':[{id:'/Custom/Weapon',kind:'weapon',name:{'zh-CN':'自定义武器'},attributes:{}}],'relations.json':[],'recipes.json':[],'reports/source-records.json':[],'reports/coverage.json':{files:[]}},identity={schemaVersion:2,modelingVersion:model,scope:{mode:scope},inputs:[],locales:['zh-CN','en'],files:Object.entries(output).map(([file,value])=>({file,hash:sha256(stable(value)),bytes:Buffer.byteLength(stable(value))}))};
 const version=digest(identity),dir=repository.directory(version);for(const [file,value]of Object.entries({...output,'manifest.json':{...identity,datasetVersion:version}})){await fs.mkdir(path.dirname(path.join(dir,file)),{recursive:true});await fs.writeFile(path.join(dir,file),stable(value));}await fs.writeFile(path.join(repository.root,'current.json'),JSON.stringify({datasetVersion:version}));return version;
}
test('旧本地缓存不会覆盖内置资料；同结构全量构建与请求版本保持一致，旧版仍可在合并汇总查看',async t=>{
 const root=await fixture(t),repo=new MergeRepository(root),bundled=await loadPlayerBundle();assert.equal(bundled.manifest.modelingVersion,FULL_MODELING_VERSION);
 assert.equal(await resolvePlayerDataset(bundled,repo),bundled);
 const old=await save(repo,'localized-text-3');assert.equal(await resolvePlayerDataset(bundled,repo),bundled);assert.equal((await mergedStatus({repository:repo})).needsRebuild,true);assert.equal((await repo.version(old)).output['items/weapons.json'][0].name['zh-CN'],'自定义武器');
 await assert.rejects(resolvePlayerDataset(bundled,repo,old),/版本已变化/);
 const current=await save(repo,FULL_MODELING_VERSION);assert.equal((await resolvePlayerDataset(bundled,repo)).manifest.datasetVersion,current);assert.equal((await mergedStatus({repository:repo})).needsRebuild,false);
 assert.equal((await resolvePlayerDataset(bundled,repo,current)).output['items/weapons.json'][0].id,'/Custom/Weapon');
 assert.equal(await resolvePlayerDataset(bundled,repo,bundled.manifest.datasetVersion),bundled);
 await assert.rejects(resolvePlayerDataset(bundled,repo,'0'.repeat(64)),/版本已变化/);
 await save(repo,FULL_MODELING_VERSION,'pilot');assert.equal(await resolvePlayerDataset(bundled,repo),bundled);
});
test('损坏的缓存清单不能伪装成兼容资料；缺失当前文件使用内置数据',async t=>{
 const root=await fixture(t),repo=new MergeRepository(root),bundled=await loadPlayerBundle(),version=await save(repo,FULL_MODELING_VERSION);const file=path.join(repo.directory(version),'manifest.json'),m=JSON.parse(await fs.readFile(file));m.modelingVersion='corrupt';await fs.writeFile(file,JSON.stringify(m));await assert.rejects(resolvePlayerDataset(bundled,repo),/清单校验失败/);
});
test('Worker 带旧合并缓存启动后，伯斯顿 Prime 能显示灵化之源，武器筛选有“灵化武器”',async t=>{
 const root=await fixture(t),local=path.join(root,'local'),userData=path.join(root,'profile'),storeRoot=path.join(userData,'snapshots');await fs.mkdir(local);await fs.mkdir(userData);const ctx={mode:'local',root:local},repo=new MergeRepository(path.join(storeRoot,'merged',digest(ctx)));const old=await save(repo,'localized-text-3');
 const worker=new Worker(new URL('../src/desktop/worker.mjs',import.meta.url),{workerData:{userData,storeRoot,defaultRoot:local}});t.after(()=>worker.terminate());const pending=new Map();let serial=0;worker.on('message',m=>{const p=pending.get(m.id);if(!p)return;pending.delete(m.id);m.error?p.reject(new Error(m.error)):p.resolve(m.result);});worker.on('error',e=>{for(const p of pending.values())p.reject(e);});const call=(method,args={})=>new Promise((resolve,reject)=>{const id=++serial;pending.set(id,{resolve,reject});worker.postMessage({id,method,args});});
 await call('init');const status=await call('playerLibraryStatus');assert.notEqual(status.manifest.datasetVersion,old);const version=status.manifest.datasetVersion;
 const page=await call('playerLibraryList',{group:'weapon',selected:{incarnon:'genesis'},query:'伯斯顿',datasetVersion:version});assert.equal(page.total,2);assert.equal(page.options.incarnon[0].label,'灵化武器');
 const detail=await call('playerLibraryDetail',{id:'/Lotus/Weapons/Tenno/LongGuns/PrimeBurston/PrimeBurston',datasetVersion:version,locale:'zh-CN'});assert.equal(detail.relations.find(g=>g.label==='灵化之源').rows[0].title,'伯斯顿灵化之源');assert.equal((await call('mergeStatus')).manifest.datasetVersion,old);
});
