import { chromium, expect as baseExpect } from '@playwright/test';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PAGE_FILE_PREFIXES } from './serve-calendar-standalone.mjs';

// Browser check of the 1999 calendar standalone page (CAL-09). It starts from a clean environment: the server script and
// the folders it may serve are copied into an empty temporary folder, without node_modules, upstream data, gzip data,
// images, Electron or the rest of the App, and the server is started there with plain Node, as
// `npm run calendar:standalone` does. Chromium then drives the page through every scenario on both servers and through
// each control. Every request must go to that server and succeed; anything else fails the check.
//
//   node scripts/check-calendar-standalone-ui.mjs            screenshots and report go to artifacts/calendar-standalone/
//   node scripts/check-calendar-standalone-ui.mjs --headed   watch it in a visible browser
const expect = baseExpect.configure({ timeout: 10000 });
const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'artifacts/calendar-standalone');
const SERVER_SCRIPT = 'scripts/serve-calendar-standalone.mjs';
const checks = [], errors = [], unexpected = [], failed = [], served = new Set();
const pass = message => { checks.push(message); console.log('PASS', message); };

async function listFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true, recursive: true });
  return entries.filter(entry => entry.isFile()).map(entry => path.relative(dir, path.join(entry.parentPath, entry.name)).split(path.sep).join('/'));
}

// Starts the copied server and resolves with its URL once it prints the ready line.
function startServer(cwd) {
  // A minimal environment: no NODE_PATH or npm variables leak into the clean copy.
  const env = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot };
  const child = spawn(process.execPath, [SERVER_SCRIPT, '--port', '0'], { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
  const lines = [];
  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`server did not start: ${lines.join(' | ')}`)), 15000);
    child.stdout.setEncoding('utf8').on('data', chunk => {
      lines.push(...chunk.split(/\r?\n/).filter(Boolean));
      const url = lines.join('\n').match(/http:\/\/127\.0\.0\.1:\d+\//)?.[0];
      if (url) { clearTimeout(timer); resolve(url); }
    });
    child.stderr.setEncoding('utf8').on('data', chunk => lines.push(chunk.trim()));
    child.once('exit', code => { clearTimeout(timer); reject(new Error(`server exited with ${code}: ${lines.join(' | ')}`)); });
  });
  return { child, lines, ready };
}

await fs.mkdir(output, { recursive: true });
const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'calendar-standalone-'));
let browser, server;
try {
  // 0. The clean environment: only the server script and the allowed folders.
  await fs.mkdir(path.join(temp, 'scripts'));
  await fs.copyFile(path.join(root, SERVER_SCRIPT), path.join(temp, SERVER_SCRIPT));
  for (const prefix of PAGE_FILE_PREFIXES) await fs.cp(path.join(root, prefix), path.join(temp, prefix), { recursive: true });
  const copied = await listFiles(temp);
  const bytes = (await Promise.all(copied.map(file => fs.stat(path.join(temp, file))))).reduce((sum, stat) => sum + stat.size, 0);
  const environment = { files: copied.length, bytes, folders: (await fs.readdir(temp)).sort() };
  baseExpect(environment.folders).toEqual(['scripts', 'src', 'test']);
  baseExpect(copied.filter(file => !file.startsWith('scripts/') && !PAGE_FILE_PREFIXES.some(prefix => file.startsWith(prefix)))).toEqual([]);
  baseExpect(copied.some(file => /node_modules|\.gz$|\.png$|electron/i.test(file))).toBe(false);
  server = startServer(temp);
  const base = await server.ready;
  pass(`干净环境：只复制伺服器脚本与允许范围（${copied.length} 个文件，${Math.round(bytes / 1024)} KiB），不含 node_modules、上游资料、gzip、图库或 Electron，以 Node 直接启动`);

  browser = await chromium.launch({ headless: !process.argv.includes('--headed') });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'zh-CN', deviceScaleFactor: 1 });
  await context.route('**/*', route => {
    const url = route.request().url();
    if (!url.startsWith(base)) { unexpected.push(url); return route.abort(); }
    served.add(new URL(url).pathname.slice(1));
    return route.continue();
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('response', response => { if (response.status() >= 400) failed.push(`${response.status()} ${response.url()}`); });

  const cal = page.locator('#slot .cal99');
  const detail = cal.locator('.cal99-detail');
  const day = ordinal => cal.locator(`[data-calendar-day="${ordinal}"]`);
  const log = page.locator('#log');
  // The sticky banner would cover the top of the frame in an element shot, so it scrolls away for the picture. The page's
  // CSP blocks injected style elements (Playwright's `style` option), so the banner is changed through CSSOM instead.
  const frameShot = async name => {
    const banner = page.locator('.sa-banner');
    await banner.evaluate(node => { node.style.position = 'static'; });
    await page.locator('.sa-frame').screenshot({ path: path.join(output, name + '.png') });
    await banner.evaluate(node => { node.style.position = ''; });
  };
  const state = (name, scenario, server) => expect(page.locator(`html[data-state=${name}][data-scenario="${scenario}"][data-server="${server}"]`)).toHaveCount(1);
  // Each change mounts again; the page marks itself loading at once, so waiting for "mounted" waits for the new mount.
  const choose = async (scenario, server) => {
    if (await page.locator('#scenario').inputValue() !== scenario) {
      await page.locator('#scenario').selectOption(scenario);
      await expect(page.locator(`html[data-state=mounted][data-scenario="${scenario}"]`)).toHaveCount(1);
    }
    const radio = page.locator(`#server input[value=${server}]`);
    if (!await radio.isChecked()) await radio.check();
    await state('mounted', scenario, server);
  };

  // 1. The page says what it is before anything else.
  const response = await page.goto(base);
  await expect(page.locator('html[data-ready=true]')).toHaveCount(1);
  baseExpect(new URL(page.url()).pathname).toBe('/test/calendar/browser/standalone.html');
  baseExpect(response.headers()['content-security-policy']).toContain("frame-ancestors 'none'");
  await expect(page).toHaveTitle('1999 日历独立测试页（测试资料，非正式排程）');
  await expect(page.locator('html')).toHaveAttribute('data-purpose', 'test');
  await expect(page.locator('meta[name=robots]')).toHaveAttribute('content', 'noindex, nofollow');
  await expect(page.locator('.sa-banner')).toContainText('不是任何服务器的正式排程');
  await expect(page.locator('.sa-banner')).toBeInViewport();
  await state('mounted', 'winter', 'de');
  await expect(page.locator('#frame-label')).toHaveText('测试资料 · 正常冬季 · 国际服 DE · 不是正式排程');
  await expect(page.locator('#scenario-facts')).toContainText('test/calendar/fixtures/scenarios/winter.json');
  await expect(page.locator('#scenario-facts')).toContainText('不是任何服务器的正式排程');
  await expect(cal.locator('.cal99-notice')).toContainText('离线样本');
  pass('根路径转到独立测试页：标题、横幅、框线与情境说明都标示测试资料、非正式排程；预设情境为正常冬季、国际服');

  // 2. Every scenario on both servers, through the public entry.
  const scenarios = await page.locator('#scenario option').evaluateAll(options => options.map(option => option.value));
  baseExpect(scenarios.length).toBe(17);
  const expectations = {
    winter: () => expect(cal.locator('[data-calendar-month]')).toHaveText(['1月', '2月', '3月']),
    spring: () => expect(cal.locator('[data-calendar-month]')).toHaveText(['4月', '5月', '6月']),
    seasons: () => expect(cal.locator('.cal99-season-picker option')).toHaveCount(2),
    multi: () => expect(day(101).locator('.cal99-day-count')).toHaveText('×3'),
    mixedEntry: () => expect(day(19)).toHaveAttribute('data-event-kind', 'mixed'),
    unknown: () => expect(cal.locator('.cal99-day')).toHaveCount(0),
    unmapped: () => expect(detail.locator('.cal99-unmapped > summary')).toContainText('2 笔事件的日期无法对应本季'),
    quiet: () => expect(cal.locator('.cal99-day.has-event')).toHaveCount(0),
    empty: () => expect(cal.locator('.cal99-empty')).toHaveText('这份快照没有可用的 1999 日历。'),
    long: () => expect(cal.locator('.cal99-season-title')).toContainText('一个非常非常长的季度名称'),
    stale: () => expect(cal.locator('.cal99-notice')).toContainText('快照已过期'),
    imported: () => expect(cal.locator('.cal99-notice')).toContainText('导入快照'),
    live: () => expect(cal.locator('.cal99-notice')).toHaveCount(0),
    failure: async () => baseExpect([await page.locator('#art').inputValue(), await page.locator('#open').inputValue(), await page.locator('#close').inputValue()]).toEqual(['error', 'error', 'error']),
    // CAL-11: four seasons with the six Hex members; the same data without portraits; and a conflict in autumn.
    birthdays: () => expect(cal.locator('.cal99-season-picker option')).toHaveCount(4),
    birthdayNoPortrait: async () => baseExpect(await page.locator('#portrait').inputValue()).toBe('missing'),
    birthdayConflict: () => expect(cal.locator('[data-calendar-month]')).toHaveText(['10月', '11月', '12月'])
  };
  baseExpect(Object.keys(expectations).sort()).toEqual([...scenarios].sort());
  for (const scenario of scenarios) {
    for (const [server, label] of [['de', '国际服 DE'], ['wg', '国服 WG']]) {
      await choose(scenario, server);
      await expect(cal.locator('.cal99-statusbar')).toContainText(label);
      await expect(page.locator('#frame-label')).toContainText(`· ${label} · 不是正式排程`);
      await expectations[scenario]();
      if (server === 'de') await frameShot(`scenario-${scenario}`);
    }
  }
  pass(`${scenarios.length} 个情境 × 2 个伺服器都经公开入口挂载，状态列显示所选伺服器，各情境的关键画面成立（正常冬／春季、同日多事件、未知季节、空资料、缺图与长文字、过期快照、外部操作失败、角色生日）`);

  // 3. Each server keeps its own selection in the page's store.
  await choose('spring', 'de');
  await page.locator('#reset-store').click();
  await state('mounted', 'spring', 'de');
  await expect(page.locator('#store')).toContainText('还没有写入');
  await day(104).click();
  await choose('spring', 'wg');
  await expect(cal.locator('.cal99-day[aria-pressed=true]')).toHaveAttribute('data-calendar-day', '96');
  await day(101).click();
  await choose('spring', 'de');
  await expect(cal.locator('.cal99-day[aria-pressed=true]')).toHaveAttribute('data-calendar-day', '104');
  await choose('spring', 'wg');
  await expect(cal.locator('.cal99-day[aria-pressed=true]')).toHaveAttribute('data-calendar-day', '101');
  await expect(page.locator('#store li')).toHaveCount(2);
  await expect(page.locator('#store li.is-current')).toContainText('游戏日 101');
  await expect(page.locator('#store')).toContainText('游戏日 104');
  pass('切换伺服器重建会话：DE 与 WG 的选取按 contextId 分开保存、各自恢复；存储面板只列出正在查看的日期');

  // 4. Fake pictures: found, missing, failed, broken, late and never.
  await choose('spring', 'de');
  await page.locator('#art').selectOption('found');
  await state('mounted', 'spring', 'de');
  await day(101).click();
  const reward = detail.getByRole('button', { name: '测试奖励，在资料库查看' });
  await expect(reward.locator('.cal99-reward-image')).toHaveAttribute('src', /^data:image\/png/);
  for (const mode of ['missing', 'error', 'broken']) {
    await page.locator('#art').selectOption(mode);
    await state('mounted', 'spring', 'de');
    await expect(day(101)).toHaveAttribute('aria-pressed', 'true');
    await expect(reward.locator('.cal99-reward-art.is-missing svg')).toHaveCount(1);
  }
  await expect(log).toContainText('loadArt 失败，已由日历的能力副本吸收：测试：图片服务无法连线');
  await page.locator('#art').selectOption('slow');
  await state('mounted', 'spring', 'de');
  await expect(reward.locator('.cal99-reward-art.is-loading svg')).toHaveCount(1);
  await expect(reward.locator('.cal99-reward-image')).toHaveAttribute('src', /^data:image\/png/, { timeout: 5000 });
  await page.locator('#art').selectOption('pending');
  await state('mounted', 'spring', 'de');
  await expect(reward.locator('.cal99-reward-art.is-loading svg')).toHaveCount(1);
  await page.locator('#art').selectOption('found');
  await state('mounted', 'spring', 'de');
  pass('假图片能力：找到显示图片；缺图、请求失败、坏图显示占位图；延迟时先显示载入中再显示图片；一直载入保持载入中；失败记入纪录');

  // 4b. Fake portraits (CAL-11): found shows the test picture of the character's key; missing, failed and broken keep the
  // name with the placeholder; the store brings the birthday back after each remount; failures go to the log.
  await choose('birthdays', 'de');
  await cal.locator('[data-action="month"][data-index="1"]').click();
  await day(45).click();
  const lettie = detail.locator('.cal99-birthday[data-character-id="hex-lettie"]');
  await expect(lettie.locator('.cal99-portrait-image')).toHaveAttribute('src', /^data:image\/svg\+xml,.*hex-lettie/);
  await expect(log).toContainText('loadPortrait：hex-lettie → 找到角色图');
  for (const mode of ['missing', 'error', 'broken']) {
    await page.locator('#portrait').selectOption(mode);
    await state('mounted', 'birthdays', 'de');
    await expect(day(45)).toHaveAttribute('aria-pressed', 'true');
    await expect(lettie.locator('.cal99-portrait.is-missing svg')).toHaveCount(1);
    await expect(lettie.locator('.cal99-birthday-name')).toHaveText('莱蒂');
  }
  await expect(log).toContainText('loadPortrait 失败，已由日历的能力副本吸收：测试：角色图无法载入');
  await page.locator('#portrait').selectOption('found');
  await state('mounted', 'birthdays', 'de');
  await frameShot('portrait-found');
  pass('假角色图能力：找到时显示该资源键的测试图；缺图、请求失败、坏图保留角色名并显示占位图；重新挂载后经存储回到 2 月 14 日；失败记入纪录');
  // The next steps continue on the spring reward day of step 4.
  await choose('spring', 'de');
  await day(101).click();

  // 5. Fake library navigation.
  await reward.click();
  await expect(log).toContainText('openItem：/Test/Reward（资料库 /Test/Reward）→ 接受跳转');
  await expect(page.locator('#last-call')).toContainText('openItem：/Test/Reward');
  await expect(detail.locator('.cal99-action-status')).toHaveCount(0);
  await page.locator('#open').selectOption('unavailable');
  await reward.click();
  await expect(detail.locator('.cal99-action-status')).toHaveText('资料库暂时无法打开「测试奖励」。');
  await page.locator('#log + .sa-buttons button').click();
  await page.locator('#open').selectOption('error');
  await reward.click();
  await expect(detail.locator('.cal99-action-status')).toHaveText('资料库暂时无法打开「测试奖励」。');
  await expect(log).toContainText('openItem 失败，已由日历的能力副本吸收：测试：资料库跳转失败');
  await page.locator('#open').selectOption('accept');
  pass('假资料库跳转：接受时带完整物品 ID 记入纪录；不可用或抛错时日历显示状态讯息，抛错由能力副本吸收并记入纪录');

  // 6. Closing: the page plays the host, and a failing close leaves the calendar where it is.
  await page.locator('#close').selectOption('error');
  await cal.locator('[data-action=close]').click();
  await expect(log).toContainText('close 失败，已由日历的能力副本吸收：测试：关闭失败');
  await state('mounted', 'spring', 'de');
  await page.locator('#close').selectOption('accept');
  await cal.locator('[data-action=close]').click();
  await state('closed', 'spring', 'de');
  await expect(cal).toHaveCount(0);
  await expect(page.locator('#slot .sa-placeholder')).toContainText('日历已经由 close 能力关闭');
  await page.locator('#slot .sa-placeholder button').click();
  await state('mounted', 'spring', 'de');
  await expect(day(101)).toHaveAttribute('aria-pressed', 'true');
  pass('关闭：正常时宿主卸载日历并可重新打开，选取经存储恢复；关闭抛错时日历留在原位，错误记入纪录');

  // 7. The fake clock: the host beat repaints through update() without a new mount.
  const deadline = cal.locator('.cal99-deadline');
  await expect(deadline).toContainText('114时 0分后结束');
  await day(104).evaluate(node => { node.dataset.marked = 'yes'; });
  await page.getByRole('button', { name: '+1 天' }).click();
  await expect(deadline).toContainText('90时 0分后结束');
  await expect(day(104)).toHaveAttribute('data-marked', 'yes');
  await expect(page.locator('#clock-text')).toHaveText('2026-10-29 06:00 UTC');
  baseExpect(new URL(page.url()).searchParams.get('now')).toBe('2026-10-29T06:00:00.000Z');
  await page.locator('#clock').fill('2026-11-03T00:00');
  await page.locator('#clock').dispatchEvent('change');
  await expect(deadline).toContainText('已结束');
  await page.getByRole('button', { name: '情境默认' }).click();
  await expect(deadline).toContainText('114时 0分后结束');
  await page.locator('#update').click();
  await expect(log.locator('li').last()).toHaveText('宿主调用 update()：只依目前会话重画');
  await page.locator('#unmount').click();
  await state('unmounted', 'spring', 'de');
  await page.locator('#update').click();
  await expect(log.locator('li').last()).toHaveText('没有挂载中的日历，update() 返回 false');
  await page.locator('#remount').click();
  await state('mounted', 'spring', 'de');
  pass('假时钟：调整时间后宿主调用 update() 只刷新倒数（日期格未重建）；卸载后 update() 返回 false；重新挂载恢复');

  // 8. The URL keeps every control, and invalid values fall back and say so.
  await page.goto(`${base}test/calendar/browser/standalone.html?scenario=long&server=wg&art=missing&portrait=missing&width=600&theme=dark`);
  await state('mounted', 'long', 'wg');
  baseExpect([await page.locator('#scenario').inputValue(), await page.locator('#art').inputValue(), await page.locator('#portrait').inputValue(), await page.locator('#width').inputValue(), await page.locator('#theme').inputValue()])
    .toEqual(['long', 'missing', 'missing', '600', 'dark']);
  await expect(page.locator('body')).toHaveClass(/dark/);
  await expect(cal.locator('.cal99-statusbar')).toContainText('国服 WG');
  const layout = await page.evaluate(() => ({ slot: Math.round(document.getElementById('slot').getBoundingClientRect().width), page: document.documentElement.scrollWidth <= innerWidth }));
  baseExpect(layout).toEqual({ slot: 600, page: true });
  await frameShot('url-long-wg-600-dark');
  await page.goto(`${base}test/calendar/browser/standalone.html?scenario=nope&art=bad`);
  await state('mounted', 'winter', 'de');
  await expect(log).toContainText('网址参数 scenario=nope 无效，改用默认值');
  await expect(log).toContainText('网址参数 art=bad 无效，改用默认值');
  pass('网址保留情境、伺服器、能力、时钟、主题与宽度，可重新整理或分享；无效参数回退默认值并记入纪录');

  // 9. A phone-sized window: the controls stack above the calendar, and nothing scrolls sideways.
  await page.setViewportSize({ width: 420, height: 900 });
  await page.goto(`${base}test/calendar/browser/standalone.html?scenario=spring`);
  await state('mounted', 'spring', 'de');
  const narrow = await page.evaluate(() => ({
    page: document.documentElement.scrollWidth <= innerWidth,
    stacked: document.querySelector('.sa-controls').getBoundingClientRect().bottom <= document.querySelector('.sa-stage').getBoundingClientRect().top + 1
  }));
  baseExpect(narrow).toEqual({ page: true, stacked: true });
  await page.screenshot({ path: path.join(output, 'narrow-420.png'), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  pass('420px 视窗：控制项排在日历上方，页面没有水平溢出');

  // 10. Slow loads. The old calendar goes at once, so the new labels never sit next to a calendar that can still be used,
  // and a load that arrives after a newer choice is dropped. A fresh page has imported only the default fixture, so the
  // held files really go to the server (JSON modules are cached per page).
  const held = new Map();
  const hold = file => {
    const opened = new Promise(resolve => held.set(file, resolve));
    return page.route(url => url.pathname.endsWith(`/fixtures/scenarios/${file}`), async route => { await opened; await route.fallback(); });
  };
  await page.goto(`${base}test/calendar/browser/standalone.html`);
  await state('mounted', 'winter', 'de');
  await hold('spring.json');
  await page.locator('#scenario').selectOption('spring');
  await state('loading', 'spring', 'de');
  await expect(cal).toHaveCount(0);
  await expect(page.locator('#slot .sa-placeholder[role=status]')).toHaveText('正在载入「正常春季 · 国际服 DE」的测试资料…');
  await expect(page.locator('#frame-label')).toHaveText('测试资料 · 正常春季 · 国际服 DE · 不是正式排程');
  await expect(page.locator('#scenario-title')).toHaveText('正常排程 · 正常春季');
  await expect(page.locator('#scenario-facts')).toHaveText(/载入中：test\/calendar\/fixtures\/scenarios\/spring\.json/);
  await page.locator('#update').click();
  await expect(log.locator('li').last()).toHaveText('没有挂载中的日历，update() 返回 false');
  held.get('spring.json')();
  await state('mounted', 'spring', 'de');
  await expect(cal.locator('[data-calendar-month]')).toHaveText(['4月', '5月', '6月']);
  await expect(page.locator('#scenario-facts')).toContainText('test/calendar/fixtures/scenarios/spring.json（CalendarDocument）');

  await hold('quiet.json');
  await page.locator('#scenario').selectOption('quiet');
  await state('loading', 'quiet', 'de');
  await page.locator('#scenario').selectOption('multi');
  await state('mounted', 'multi', 'de');
  const late = page.waitForResponse(response => response.url().endsWith('/fixtures/scenarios/quiet.json'));
  held.get('quiet.json')();
  await late;
  await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 100)));
  await state('mounted', 'multi', 'de');
  await expect(cal).toHaveCount(1);
  await expect(day(101).locator('.cal99-day-count')).toHaveText('×3');
  await expect(page.locator('#scenario-title')).toHaveText('同日多事件 · 同日多笔独立条目');
  await expect(log).not.toContainText('切换情境：季度没有事件');
  await page.unrouteAll();
  pass('延迟载入：切换后立即卸载旧日历并显示载入中，标签、情境说明与日历不会混用两个情境；载入期间 update() 无作用；晚到的旧载入被较新的选择取代、不会挂载');

  // 11. Only the copied server was asked, only for allowed files, and nothing failed.
  // The server script exists in the copy but lies outside the allowed folders.
  baseExpect((await fetch(`${base}${SERVER_SCRIPT}`)).status).toBe(404);
  baseExpect(unexpected).toEqual([]);
  baseExpect(failed).toEqual([]);
  // "" is the root, which only redirects to the page.
  baseExpect([...served].filter(file => file && !PAGE_FILE_PREFIXES.some(prefix => file.startsWith(prefix)))).toEqual([]);
  baseExpect(server.lines.filter(line => line.startsWith('拒绝'))).toEqual([`拒绝 404 GET /${SERVER_SCRIPT}（不在允许范围）`]);
  baseExpect(errors).toEqual([]);
  pass(`只向本机测试伺服器请求允许范围内的 ${served.size} 个路径，全部成功；伺服器脚本本身也拿不到（404）；无外部请求、无页面错误`);

  await fs.writeFile(path.join(output, 'report.json'), JSON.stringify({ ok: true, checks, environment, served: [...served].sort(), errors, unexpected, failed, server: server.lines }, null, 2));
} catch (error) {
  process.exitCode = 1;
  console.error(error);
  await fs.writeFile(path.join(output, 'report.json'), JSON.stringify({ ok: false, checks, error: String(error?.stack ?? error), errors, unexpected, failed, server: server?.lines }, null, 2)).catch(() => {});
} finally {
  await browser?.close();
  server?.child.kill();
  await fs.rm(temp, { recursive: true, force: true }).catch(() => {});
}
