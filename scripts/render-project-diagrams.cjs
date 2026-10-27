const {app,BrowserWindow}=require('electron');
const fs=require('node:fs/promises');
app.on('window-all-closed',()=>{});
app.whenReady().then(async()=>{const specs=JSON.parse(await fs.readFile(process.argv[2] || '文档/图示/manifest.json','utf8'));for(const spec of specs){const w=new BrowserWindow({show:false,width:spec.width,height:spec.height,useContentSize:true,webPreferences:{offscreen:true}});await w.loadFile(spec.file);await w.webContents.executeJavaScript('document.fonts.ready');await new Promise(r=>setTimeout(r,100));await fs.writeFile(spec.file.replace(/svg$/,'png'),(await w.webContents.capturePage()).toPNG());w.destroy();}app.quit();}).catch(e=>{console.error(e);app.exit(1);});
