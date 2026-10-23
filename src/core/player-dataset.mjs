import path from 'node:path';
import {readJson} from './io.mjs';
import {digest} from './merge/contract.mjs';

// A different hash is not proof of a newer build. Legacy local caches must not
// hide features already shipped in the bundled player projection.
export async function resolvePlayerDataset(bundled,repository,expectedVersion) {
  if(expectedVersion===bundled.manifest.datasetVersion)return bundled;
  if(repository){
    const current=await readJson(path.join(repository.root,'current.json')).catch(e=>{if(e.code==='ENOENT')return null;throw e;});
    if(current&&current.datasetVersion!==bundled.manifest.datasetVersion){
      const manifest=await readJson(path.join(repository.directory(current.datasetVersion),'manifest.json'));
      const {datasetVersion,...identity}=manifest;
      if(datasetVersion!==current.datasetVersion||digest(identity)!==datasetVersion)throw new Error('合并资料清单校验失败');
      if(bundled.manifest.modelingVersion&&manifest.modelingVersion===bundled.manifest.modelingVersion&&manifest.scope?.mode==='full'){
        if(expectedVersion&&expectedVersion!==datasetVersion)throw new Error('资料库版本已变化，请重新进入资料库');
        return repository.version(datasetVersion);
      }
    }
  }
  if(expectedVersion&&expectedVersion!==bundled.manifest.datasetVersion)throw new Error('资料库版本已变化，请重新进入资料库');
  return bundled;
}
