import { app, BrowserWindow, clipboard, ClipboardItem, dialog, ipcMain, Menu, session, protocol, nativeImage, nativeTheme, shell } from 'electron';
import { exportFilename, copyWithoutOverwrite, writeWithoutOverwrite } from '../core/image-export.cjs';
import { composeBlueprintLayers } from '../core/image-composition.mjs';
import { Worker } from 'node:worker_threads';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
protocol.registerSchemesAsPrivileged([{ scheme: 'workbench-image', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
async function locateDirectory(name) {
  for (const start of [process.cwd(), path.dirname(app.getPath('exe'))]) {
    let current = start;
    for (let i = 0; i < 9; i++, current = path.dirname(current)) {
      if (await fs.stat(path.join(current, name)).then(s => s.isDirectory(), () => false)) return current;
      if (current === path.dirname(current)) break;
    }
  }
}
let win, worker, serial = 0;
const pending = new Map();
// Isolate Chromium's profile and single-instance lock as well as the worker's files.
if (process.env.WORKBENCH_USER_DATA) {
  const profile = path.resolve(process.env.WORKBENCH_USER_DATA);
  await fs.mkdir(profile, { recursive: true }); app.setPath('userData', profile);
}
if (!app.requestSingleInstanceLock()) app.quit();
else app.whenReady().then(async () => {
  app.on('second-instance', () => { if (win) { win.restore(); win.focus(); } });
  const smoke = process.env.WORKBENCH_SMOKE === '1';
  const userData = process.env.WORKBENCH_USER_DATA || app.getPath('userData');
  await fs.mkdir(userData, { recursive: true });
  const workspace = await locateDirectory('世界状态上游');
  const defaultRoot = process.env.WORKBENCH_ROOT || workspace || process.cwd();
  const imageWorkspace = await locateDirectory('assets/content');
  const contentRoot = process.env.WORKBENCH_IMAGE_ROOT || (imageWorkspace && path.join(imageWorkspace, 'assets/content'));
  const documentsWorkspace = await locateDirectory('文档');
  const documentsRoot = documentsWorkspace || path.resolve(here, '../..');
  worker = new Worker(new URL('./worker.mjs', import.meta.url), { workerData: { userData, storeRoot: path.join(userData, 'snapshots'), imageRoot: process.env.WORKBENCH_IMAGE_ROOT, contentRoot, defaultRoot, documentsRoot } });
  const invoke = (method, args) => new Promise((resolve, reject) => { const id = ++serial; pending.set(id, { resolve, reject }); worker.postMessage({ id, method, args }); });
  worker.on('message', message => {
    if (message.event) { win?.webContents.send('workbench:event', message); return; }
    const task = pending.get(message.id); if (!task) return; pending.delete(message.id);
    if (message.error) task.reject(new Error(message.error)); else task.resolve(message.result);
  });
  function rejectPending(error) { for (const task of pending.values()) task.reject(error); pending.clear(); }
  worker.on('error', error => { rejectPending(error); win?.webContents.send('workbench:event', { event: 'progress', value: { error: true, message: '后台进程错误：' + error.message } }); });
  worker.on('exit', code => rejectPending(new Error(`后台进程已退出（${code}），请重启应用`)));
  const allowed = new Set(['init', 'refresh', 'page', 'detail', 'schema', 'raw', 'galleryList', 'galleryDetail', 'rulesGet', 'rulesValidate', 'rulesSave', 'rulesPrevious', 'mergeStatus', 'mergeBuild', 'mergeList', 'mergeDetail', 'mergeReport', 'update', 'import', 'history', 'snapshot', 'rollback', 'diff', 'oracleOptions', 'invigorations', 'arbitration', 'browseCycles', 'browseWeekly', 'browseIncursions', 'refreshWorldState', 'oracleCycle', 'oracleLocations', 'oracleInvasions', 'oracleWeekly', 'oracleStateStatus', 'refreshOracleState', 'autoUpdate', 'config', 'saveConfig']);
  allowed.add('documentsList'); allowed.add('documentsRead');
  allowed.add('liveState');
  for (const method of ['wmSearch', 'wmOrders', 'wmStatistics', 'wmItemSet', 'wmRivenCatalog', 'wmAuctions']) allowed.add(method);
  function checkSender(event) { if (event.sender !== win?.webContents || event.senderFrame !== win.webContents.mainFrame) throw new Error('不允许的调用来源'); }
  ipcMain.handle('workbench:call', (event, method, args) => { checkSender(event); if (!allowed.has(method)) throw new Error('不允许的操作'); return invoke(method, args); });
  ipcMain.handle('workbench:choose-root', async event => { checkSender(event); const result = await dialog.showOpenDialog(win, { title: '选择资料包或上游资料目录', properties: ['openDirectory'] }); return result.canceled ? null : invoke('chooseRoot', { root: result.filePaths[0] }); });
  ipcMain.handle('workbench:oracle-state', async (event, args) => { checkSender(event); const result = await dialog.showOpenDialog(win, { title: '导入世界状态 JSON（以页面参考时间作为采集时间）', properties: ['openFile'], filters: [{ name: '世界状态 JSON', extensions: ['json'] }] }); return result.canceled ? null : invoke('importOracleState', { file: result.filePaths[0], at: args?.at }); });
  ipcMain.handle('workbench:live-state-import', async (event, server) => {
    checkSender(event); if (!['de', 'wg'].includes(server)) throw new Error('服务器无效');
    const result = await dialog.showOpenDialog(win, { title: `导入${server === 'de' ? '国际服' : '国服'}官方世界状态 JSON`, properties: ['openFile'], filters: [{ name: '世界状态 JSON', extensions: ['json'] }] });
    return result.canceled ? null : invoke('importLiveState', { server, file: result.filePaths[0] });
  });
  ipcMain.handle('workbench:export', async (event, args) => { checkSender(event); const result = await invoke('export', args); const save = await dialog.showSaveDialog(win, { defaultPath: result.name }); if (save.canceled) return false; await fs.writeFile(save.filePath, result.text); return true; });
  ipcMain.handle('workbench:rules-export', async (event, args) => { checkSender(event); await invoke('rulesValidate', args); const save = await dialog.showSaveDialog(win, { defaultPath: 'merge-rules.json', filters: [{ name: 'JSON', extensions: ['json'] }] }); if (save.canceled) return false; await fs.writeFile(save.filePath, JSON.stringify({ contract: args.contract, overrides: args.overrides }, null, 2) + '\n'); return true; });
  ipcMain.handle('workbench:merge-export', async (event, args) => {
    checkSender(event);
    const result = await dialog.showOpenDialog(win, { title: '选择数据包导出位置（创建独立版本目录）', properties: ['openDirectory', 'createDirectory'] });
    return result.canceled ? null : invoke('mergeExport', { ...args, directory: result.filePaths[0] });
  });
  ipcMain.handle('workbench:images', (event, requests) => { checkSender(event); return invoke('images', { requests }); });
  ipcMain.handle('workbench:image-status', event => { checkSender(event); return invoke('imageStatus'); });
  ipcMain.handle('workbench:choose-images', async event => { checkSender(event); const result = await dialog.showOpenDialog(win, { title: '选择共享图片资源 assets/content 目录', properties: ['openDirectory'] }); return result.canceled ? null : invoke('chooseImages', { root: result.filePaths[0] }); });
  ipcMain.handle('workbench:copy', (event, text) => { checkSender(event); if (typeof text !== 'string' || text.length > 2000000) throw new Error('复制内容过大'); clipboard.writeText(text); return true; });
  ipcMain.handle('workbench:theme', (event, value) => { checkSender(event); if (!['system', 'light', 'dark'].includes(value)) throw new Error('主题无效'); nativeTheme.themeSource = value; return true; });
  ipcMain.handle('workbench:document-link', async (event, value) => { checkSender(event); if (typeof value !== 'string' || value.length > 4000) throw new Error('链接无效'); const url = new URL(value); if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('仅支持网页链接'); await shell.openExternal(url.href); return true; });
  protocol.handle('workbench-image', async request => {
    try {
      const url = new URL(request.url); if (url.hostname !== 'library') return new Response(null, { status: 404 });
      const result = await invoke('galleryAsset', { key: decodeURIComponent(url.pathname.slice(1)) });
      return new Response(await fs.readFile(result.file), { headers: { 'Content-Type': result.mime, 'Cache-Control': 'no-cache' } });
    } catch { return new Response(null, { status: 404 }); }
  });
  let exporting = false, exportCanceled = false, lastExportDirectory;
  const image = async key => {
    if (typeof key !== 'string' || key.length > 2000) throw new Error('图片标识无效');
    const asset = await invoke('galleryAsset', { key });
    if (asset.item.layers?.length === 2) {
      const layers = [];
      for (const layer of asset.item.layers) {
        const source = await invoke('galleryAsset', { key: layer.key });
        const bytes = await fs.readFile(source.file);
        if (bytes.length > 8 * 1024 * 1024) throw new Error('合成源图片过大');
        layers.push({ role: layer.role, dataUrl: `data:${source.mime};base64,${bytes.toString('base64')}` });
      }
      const url = await win.webContents.executeJavaScript(`(${composeBlueprintLayers.toString()})(${JSON.stringify(layers)})`);
      const data = Buffer.from(url.split(',')[1], 'base64');
      return { ...asset, data, bytes: data.length, mime: 'image/png', item: { ...asset.item, imageName: 'composite.png' } };
    }
    return asset;
  };
  ipcMain.handle('workbench:gallery-action', async (event, action, args = {}) => {
    checkSender(event);
    if (action === 'cancel') { exportCanceled = true; return true; }
    if (action === 'open-folder') { if (!lastExportDirectory) throw new Error('请先保存或导出图片'); const error = await shell.openPath(lastExportDirectory); if (error) throw new Error(error); return true; }
    if (action === 'info' || action === 'copy') {
      const asset = await image(args.key), bitmap = asset.data ? nativeImage.createFromBuffer(asset.data) : nativeImage.createFromPath(asset.file);
      if (bitmap.isEmpty()) throw new Error('图片无法读取');
      if (action === 'copy') await clipboard.write([new ClipboardItem({ 'image/png': new Blob([bitmap.toPNG()], { type: 'image/png' }) })]);
      return { ...bitmap.getSize(), bytes: asset.bytes, mime: asset.mime };
    }
    if (!['save', 'export'].includes(action)) throw new Error('未知图片操作');
    if (exporting) throw new Error('正在导出，请稍候');
    if (!['both', 'zh', 'en'].includes(args.naming)) throw new Error('命名方式无效');
    if (action === 'save') {
      const asset = await image(args.key), filename = exportFilename(asset.item, args.naming);
      const result = await dialog.showSaveDialog(win, { title: '保存图片', defaultPath: path.join(lastExportDirectory || app.getPath('pictures'), filename) });
      if (result.canceled) return null;
      if (asset.data) await fs.writeFile(result.filePath, asset.data); else await fs.copyFile(asset.file, result.filePath);
      lastExportDirectory = path.dirname(result.filePath);
      return { count: 1, file: path.basename(result.filePath) };
    }
    if (!Array.isArray(args.keys) || !args.keys.length || args.keys.length > 50000 || args.keys.some(k => typeof k !== 'string' || k.length > 2000)) throw new Error('导出选择无效');
    exporting = true; exportCanceled = false;
    try {
      const result = await dialog.showOpenDialog(win, { title: '选择批量导出位置', properties: ['openDirectory', 'createDirectory'], defaultPath: lastExportDirectory });
      if (result.canceled) return null;
      const directory = result.filePaths[0]; lastExportDirectory = directory;
      const keys = [...new Set(args.keys)], failed = []; let count = 0;
      for (let i = 0; i < keys.length && !exportCanceled; i++) {
        try { const asset = await image(keys[i]); const filename = exportFilename(asset.item, args.naming); if (asset.data) await writeWithoutOverwrite(asset.data, directory, filename); else await copyWithoutOverwrite(asset.file, directory, filename); count++; }
        catch (error) { failed.push({ key: keys[i], message: error.message }); if (['ENOSPC', 'EACCES', 'EPERM'].includes(error.code)) break; }
        win?.webContents.send('workbench:event', { event: 'gallery-export', value: { done: i + 1, total: keys.length, count } });
      }
      return { count, failed, canceled: exportCanceled };
    } finally { exporting = false; }
  });
  session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  Menu.setApplicationMenu(Menu.buildFromTemplate([{ label: '工作台', submenu: [{ role: 'about' }, { role: 'quit' }] }, { label: '编辑', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] }, { label: '视图', submenu: [{ role: 'reload' }, { role: 'toggleDevTools' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }] }]));
  win = new BrowserWindow({ width: 1440, height: 960, minWidth: 1080, minHeight: 720, show: !smoke, backgroundColor: '#10141d', title: '上游资料工作台', webPreferences: { preload: path.join(here, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.on('close', event => { if (exporting) { event.preventDefault(); win.webContents.send('workbench:event', { event: 'gallery-close-blocked' }); } });
  win.webContents.on('will-navigate', event => event.preventDefault());
  win.webContents.on('will-attach-webview', event => event.preventDefault());
  win.webContents.on('render-process-gone', (_event, details) => rejectPending(new Error('界面进程退出：' + details.reason)));
  await win.loadFile(path.join(here, '../ui/index.html'));
  if (smoke) {
    try {
      for (let i = 0; i < 100; i++) { if (await win.webContents.executeJavaScript('window.smokeReady === true')) break; await new Promise(r => setTimeout(r, 100)); }
      const result = await win.webContents.executeJavaScript('window.runSmoke()');
      await win.webContents.executeJavaScript('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
      await new Promise(resolve => setTimeout(resolve, 200));
      const output = process.env.WORKBENCH_SMOKE_OUT || path.join(userData, 'smoke'); await fs.mkdir(output, { recursive: true });
      await fs.writeFile(path.join(output, 'desktop.png'), (await win.webContents.capturePage()).toPNG());
      await fs.writeFile(path.join(output, 'result.json'), JSON.stringify(result, null, 2));
      console.log(JSON.stringify(result)); app.exit(result.ok ? 0 : 1);
    } catch (error) { console.error(error); app.exit(1); }
  }
  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', () => { worker?.terminate(); });
}).catch(error => { console.error(error); app.exit(1); });
