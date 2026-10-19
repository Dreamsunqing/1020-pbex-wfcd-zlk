import { app, BrowserWindow, clipboard, dialog, ipcMain, Menu, session } from 'electron';
import { Worker } from 'node:worker_threads';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
let win, worker, serial = 0;
const pending = new Map();
if (!app.requestSingleInstanceLock()) app.quit();
else app.whenReady().then(async () => {
  app.on('second-instance', () => { if (win) { win.restore(); win.focus(); } });
  const smoke = process.env.WORKBENCH_SMOKE === '1';
  const userData = process.env.WORKBENCH_USER_DATA || app.getPath('userData');
  await fs.mkdir(userData, { recursive: true });
  worker = new Worker(new URL('./worker.mjs', import.meta.url), { workerData: { userData, storeRoot: path.join(userData, 'snapshots'), defaultRoot: process.env.WORKBENCH_ROOT || (app.isPackaged ? path.dirname(app.getPath('exe')) : process.cwd()) } });
  const invoke = (method, args) => new Promise((resolve, reject) => { const id = ++serial; pending.set(id, { resolve, reject }); worker.postMessage({ id, method, args }); });
  worker.on('message', message => {
    if (message.event) { win?.webContents.send('workbench:event', message); return; }
    const task = pending.get(message.id); if (!task) return; pending.delete(message.id);
    if (message.error) task.reject(new Error(message.error)); else task.resolve(message.result);
  });
  function rejectPending(error) { for (const task of pending.values()) task.reject(error); pending.clear(); }
  worker.on('error', error => { rejectPending(error); win?.webContents.send('workbench:event', { event: 'progress', value: { error: true, message: '后台进程错误：' + error.message } }); });
  worker.on('exit', code => rejectPending(new Error(`后台进程已退出（${code}），请重启应用`)));
  const allowed = new Set(['init', 'refresh', 'page', 'raw', 'update', 'import', 'history', 'snapshot', 'rollback', 'diff', 'oracleOptions', 'invigorations', 'arbitration', 'browseCycles', 'browseWeekly', 'browseIncursions', 'refreshWorldState', 'oracleCycle', 'oracleLocations', 'oracleInvasions', 'oracleWeekly', 'oracleStateStatus', 'refreshOracleState', 'autoUpdate', 'config', 'saveConfig']);
  function checkSender(event) { if (event.sender !== win?.webContents || event.senderFrame !== win.webContents.mainFrame) throw new Error('不允许的调用来源'); }
  ipcMain.handle('workbench:call', (event, method, args) => { checkSender(event); if (!allowed.has(method)) throw new Error('不允许的操作'); return invoke(method, args); });
  ipcMain.handle('workbench:choose-root', async event => { checkSender(event); const result = await dialog.showOpenDialog(win, { title: '选择资料包或上游资料目录', properties: ['openDirectory'] }); return result.canceled ? null : invoke('chooseRoot', { root: result.filePaths[0] }); });
  ipcMain.handle('workbench:oracle-state', async (event, args) => { checkSender(event); const result = await dialog.showOpenDialog(win, { title: '导入世界状态 JSON（以页面参考时间作为采集时间）', properties: ['openFile'], filters: [{ name: '世界状态 JSON', extensions: ['json'] }] }); return result.canceled ? null : invoke('importOracleState', { file: result.filePaths[0], at: args?.at }); });
  ipcMain.handle('workbench:export', async (event, args) => { checkSender(event); const result = await invoke('export', args); const save = await dialog.showSaveDialog(win, { defaultPath: result.name }); if (save.canceled) return false; await fs.writeFile(save.filePath, result.text); return true; });
  ipcMain.handle('workbench:copy', (event, text) => { checkSender(event); if (typeof text !== 'string' || text.length > 2000000) throw new Error('复制内容过大'); clipboard.writeText(text); return true; });
  session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  Menu.setApplicationMenu(Menu.buildFromTemplate([{ label: '工作台', submenu: [{ role: 'about' }, { role: 'quit' }] }, { label: '编辑', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] }, { label: '视图', submenu: [{ role: 'reload' }, { role: 'toggleDevTools' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }] }]));
  win = new BrowserWindow({ width: 1440, height: 960, minWidth: 1080, minHeight: 720, show: !smoke, backgroundColor: '#10141d', title: '上游资料工作台', webPreferences: { preload: path.join(here, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
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
