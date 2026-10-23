import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
export async function syncCardAssets(appRoot) {
  if (!appRoot) throw new Error('用法：node scripts/sync-card-assets.mjs <cangshuClient 目录>');
  const destination=fileURLToPath(new URL('../src/ui/assets/card-frames/',import.meta.url)), entries=[];
  for(const relative of ['mods/wiki','mods/polarities','arcanes']) {
    const source=path.join(appRoot,'static/images',relative);
    for(const name of (await fs.readdir(source)).filter(n=>n.endsWith('.png')).sort()) {
      const bytes=await fs.readFile(path.join(source,name));
      if(bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw new Error('不是 PNG：'+name);
      const file=relative+'/'+name;await fs.mkdir(path.dirname(path.join(destination,file)),{recursive:true});await fs.writeFile(path.join(destination,file),bytes);
      entries.push({file,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),source:'static/images/'+file});
    }
  }
  const manifest={schemaVersion:1,sourceProject:'仓鼠互助洞 cangshuClient',sourceImplementation:['pages/wf-items/common/mod-assets.js','pages/wf-items/common/ModArtFrame.vue','pages/wf-items/common/ModCard.vue','pages/wf-items/common/arcane-assets.js'],modOrigin:'App README 记录：Warframe Fandom Wiki Mod Components，2026-07-25 MediaWiki API；极性为转换后的 PNG。',arcaneOrigin:'App 本地素材；未登记原始外部来源。',files:entries};
  await fs.writeFile(path.join(destination,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');console.log(JSON.stringify({files:entries.length,bytes:entries.reduce((s,e)=>s+e.bytes,0),destination}));return manifest;
}
if(process.argv[1]===fileURLToPath(import.meta.url))await syncCardAssets(process.argv[2]);
