import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {DocumentLibrary} from '../src/core/documents.mjs';
test('WM notes and reference translations share a separate category, project documents retain theirs',async()=>{const root=await fs.mkdtemp(path.join(os.tmpdir(),'wb-docs-'));try{for(const id of ['文档/WM/README.md','文档/参考资料/WarframeMarket/中文/guide.md','文档/深入/flow.md']){await fs.mkdir(path.dirname(path.join(root,id)),{recursive:true});await fs.writeFile(path.join(root,id),'# '+id+'\n说明');}const library=new DocumentLibrary(root);assert.equal((await library.list({group:'WM'})).total,2);assert.equal((await library.list({group:'深入理解'})).total,1);assert.equal((await library.list({group:'总览'})).total,0);assert.equal((await library.read('文档/WM/README.md')).group,'WM');assert.equal((await library.list({group:'WM',query:'guide'})).total,1);await assert.rejects(()=>library.read('../elsewhere.md'));}finally{await fs.rm(root,{recursive:true,force:true});}});

test('document figures read bounded local bitmap assets and reject remote, traversal, symlink and active files',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'wb-doc-figures-'));
 try{
  await fs.mkdir(path.join(root,'文档/深入'),{recursive:true});await fs.mkdir(path.join(root,'文档/图示'));
  await fs.writeFile(path.join(root,'文档/深入/guide.md'),'# Guide');
  const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=','base64');
  await fs.writeFile(path.join(root,'文档/图示/图.png'),bytes);
  const lib=new DocumentLibrary(root),documentId='文档/深入/guide.md';
  const image=await lib.image({documentId,href:'../图示/图.png'});assert.equal(image.dataUrl,'data:image/png;base64,'+bytes.toString('base64'));
  for(const href of ['https://evil.example/a.png','data:image/png;base64,AA','../../secret.png','../图示/图.svg','../图示/图.png?x=1','../图示/图.png#x','../图示/\\图.png'])await assert.rejects(()=>lib.image({documentId,href}));
  await assert.rejects(()=>lib.image({documentId:'../secret.md',href:'../图示/图.png'}));
  await fs.writeFile(path.join(root,'outside.png'),bytes);await fs.symlink(path.join(root,'outside.png'),path.join(root,'文档/图示/escape.png'));
  await assert.rejects(()=>lib.image({documentId,href:'../图示/escape.png'}));
  await fs.writeFile(path.join(root,'文档/图示/fake.png'),'<svg onload="alert(1)"/>');await assert.rejects(()=>lib.image({documentId,href:'../图示/fake.png'}));
  await fs.writeFile(path.join(root,'文档/图示/large.png'),Buffer.alloc(8*1024*1024+1));await assert.rejects(()=>lib.image({documentId,href:'../图示/large.png'}));
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
