'use strict';
const { app, BrowserWindow, ipcMain, protocol, dialog, clipboard, ClipboardItem, nativeImage, shell, Menu } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { resolveImage, exportFilename, copyWithoutOverwrite, validateIds } = require('./core.cjs');

protocol.registerSchemesAsPrivileged([{ scheme: 'guide-image', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
const testing = !app.isPackaged && process.env.GUIDE_TEST_MODE === '1';
if (testing && process.env.GUIDE_TEST_USERDATA) app.setPath('userData', process.env.GUIDE_TEST_USERDATA);
const contentDir = app.isPackaged ? path.join(process.resourcesPath, 'content') : path.join(__dirname, '../assets/content');
let win;
let catalog;
let lookup;
let exporting = false;
let exportCanceled = false;
let lastExportDir;
let settingsWrite = Promise.resolve();
let settings = { background: 'checker', thumbnail: 'medium', naming: 'both' };
const indexFile = path.join(__dirname, 'renderer/index.html');

function requireItem(id) {
  const item = lookup.get(id);
  if (!item) throw new Error('没有找到该物品，请重新搜索');
  return item;
}

function friendlyError(error) {
  if (error.code === 'ENOSPC') return '磁盘空间不足，请清理空间后重试';
  if (error.code === 'EACCES' || error.code === 'EPERM') return '无法写入这个位置，请选择有写入权限的文件夹';
  if (error.code === 'ENOENT') return '找不到图片或目标文件夹，请确认压缩包已完整解压';
  return error.message || '操作失败，请重试';
}

function handle(channel, fn) {
  ipcMain.handle(channel, async (event, ...args) => {
    if (event.sender !== win?.webContents || event.senderFrame !== win.webContents.mainFrame) {
      return { ok: false, error: '操作来源无效' };
    }
    try { return { ok: true, value: await fn(...args) }; }
    catch (error) { console.error(channel, error); return { ok: false, error: friendlyError(error) }; }
  });
}

async function chooseDirectory() {
  if (testing && process.env.GUIDE_TEST_EXPORT_DIR) return process.env.GUIDE_TEST_EXPORT_DIR;
  const result = await dialog.showOpenDialog(win, { title: '选择图片保存文件夹',
    buttonLabel: '保存到这里', properties: ['openDirectory', 'createDirectory'], defaultPath: lastExportDir || app.getPath('pictures') });
  return result.canceled ? null : result.filePaths[0];
}

function registerHandlers() {
  handle('catalog', () => ({ ...catalog, settings, version: app.getVersion() }));
  handle('copy-name', async (id, kind) => {
    const item = requireItem(id);
    const zh = item.label || item.zh || item.name;
    const en = item.englishLabel || item.name;
    const text = kind === 'en' ? en : kind === 'both' && zh !== en ? `${zh}（${en}）` : zh;
    await clipboard.writeText(text);
  });
  handle('copy-image', async id => {
    const image = nativeImage.createFromPath(resolveImage(contentDir, requireItem(id)));
    if (image.isEmpty()) throw new Error('这张图片无法读取，请尝试保存原图');
    const bytes = image.toPNG();
    await clipboard.write([new ClipboardItem({ 'image/png': new Blob([bytes], { type: 'image/png' }) })]);
    return { width: image.getSize().width, height: image.getSize().height };
  });
  handle('image-info', async id => {
    const imagePath = resolveImage(contentDir, requireItem(id));
    const stat = await fs.stat(imagePath);
    const image = nativeImage.createFromPath(imagePath);
    if (image.isEmpty()) throw new Error('这张图片无法预览');
    return { ...image.getSize(), bytes: stat.size, extension: path.extname(imagePath).slice(1).toUpperCase() };
  });
  handle('save-image', async (id, naming) => {
    const item = requireItem(id);
    const source = resolveImage(contentDir, item);
    const filename = exportFilename(item, naming);
    let destination;
    if (testing && process.env.GUIDE_TEST_EXPORT_DIR) {
      destination = await copyWithoutOverwrite(source, process.env.GUIDE_TEST_EXPORT_DIR, filename);
    } else {
      const result = await dialog.showSaveDialog(win, { title: '保存原图',
        defaultPath: path.join(lastExportDir || app.getPath('pictures'), filename),
        filters: [{ name: '图片', extensions: [path.extname(filename).slice(1)] }] });
      if (result.canceled || !result.filePath) return { canceled: true };
      destination = result.filePath;
      await fs.copyFile(source, destination);
    }
    lastExportDir = path.dirname(destination);
    return { filename: path.basename(destination) };
  });
  handle('export-images', async (ids, naming) => {
    if (exporting) throw new Error('正在导出，请稍候');
    const items = validateIds(ids, lookup);
    exporting = true;
    exportCanceled = false;
    try {
      const directory = await chooseDirectory();
      if (!directory) return { canceled: true, count: 0, failed: [] };
      lastExportDir = directory;
      const failed = [];
      let count = 0;
      for (let i = 0; i < items.length; i++) {
        if (exportCanceled) break;
        const item = items[i];
        try {
          await copyWithoutOverwrite(resolveImage(contentDir, item), directory, exportFilename(item, naming));
          count++;
        } catch (error) { failed.push({ name: item.label, error: friendlyError(error), code: error.code }); }
        win?.webContents.send('export-progress', { done: i + 1, total: items.length, count });
        // A missing destination, full disk or denied folder cannot recover per image.
        if (failed.length && ['ENOSPC', 'EACCES', 'EPERM'].includes(failed.at(-1).code)) break;
      }
      return { canceled: exportCanceled, count, failed };
    } finally { exporting = false; }
  });
  handle('cancel-export', () => { exportCanceled = true; });
  handle('open-export-folder', async () => {
    if (!lastExportDir) throw new Error('请先保存或导出图片');
    const error = await shell.openPath(lastExportDir);
    if (error) throw new Error('无法打开文件夹，请在资源管理器中查看保存位置');
  });
  handle('settings', async value => {
    const next = { ...settings };
    for (const [key, choices] of Object.entries({ background: ['checker', 'light', 'dark'],
      thumbnail: ['small', 'medium', 'large'], naming: ['both', 'zh', 'en'] })) {
      if (choices.includes(value?.[key])) next[key] = value[key];
    }
    settings = next;
    const filename = path.join(app.getPath('userData'), 'preferences.json');
    const serialized = JSON.stringify(settings);
    settingsWrite = settingsWrite.catch(() => {}).then(async () => {
      await fs.mkdir(path.dirname(filename), { recursive: true });
      await fs.writeFile(filename + '.tmp', serialized);
      await fs.rename(filename + '.tmp', filename);
    });
    await settingsWrite;
    return settings;
  });
}

async function createWindow() {
  Menu.setApplicationMenu(null);
  win = new BrowserWindow({ width: 1440, height: 960, minWidth: 1050, minHeight: 700,
    title: '星际战甲 · 攻略图片工具', backgroundColor: '#f4f7fb', show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true,
      nodeIntegration: false, sandbox: true, webSecurity: true, spellcheck: false } });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event, url) => {
    if (url !== pathToFileURL(indexFile).href) event.preventDefault();
  });
  win.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  win.webContents.session.webRequest.onBeforeRequest((details, callback) => {
    callback({ cancel: /^https?:|^wss?:|^ftp:/i.test(details.url) });
  });
  win.on('close', event => {
    if (exporting) { event.preventDefault(); win.webContents.send('close-during-export'); }
  });
  win.once('ready-to-show', () => win.show());
  await win.loadFile(indexFile);
}

app.whenReady().then(async () => {
  try {
    catalog = JSON.parse(await fs.readFile(path.join(contentDir, 'catalog.json'), 'utf8'));
    if (catalog.meta.schemaVersion !== 1 || !catalog.items.length) throw new Error('图片库格式错误');
    lookup = new Map(catalog.items.map(item => [item.id, item]));
    try {
      const prefs = JSON.parse(await fs.readFile(path.join(app.getPath('userData'), 'preferences.json'), 'utf8'));
      for (const key of Object.keys(settings)) if (typeof prefs[key] === 'string') settings[key] = prefs[key];
    } catch { /* First launch or damaged settings use defaults. */ }
    protocol.handle('guide-image', async request => {
      try {
        const url = new URL(request.url);
        if (url.hostname !== 'library') return new Response(null, { status: 404 });
        const item = requireItem(decodeURIComponent(url.pathname.slice(1)));
        const bytes = await fs.readFile(resolveImage(contentDir, item));
        const extension = path.extname(item.imageName).toLowerCase();
        const type = ({ '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif' })[extension];
        return new Response(bytes, { headers: { 'Content-Type': type || 'application/octet-stream', 'Cache-Control': 'public, max-age=31536000' } });
      } catch { return new Response(null, { status: 404 }); }
    });
    registerHandlers();
    await createWindow();
  } catch (error) {
    console.error(error);
    dialog.showErrorBox('无法打开图片库', '请完整解压压缩包后再启动程序。\n\n' + friendlyError(error));
    app.quit();
  }
});
app.on('window-all-closed', () => app.quit());
