import { _electron as electron, expect as baseExpect } from '@playwright/test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Electron integration check of the 1999 calendar (CAL-08) in the real App, with its built-in offline samples. It covers
// what the browser check (check-calendar-ui.mjs) cannot: the App composition root, the real live-state call sites,
// renderGameText, api.images, the library jump, the host's 30-second clock and the App stylesheets around the calendar.
// check-world-state-ui.mjs stops before its calendar step, so this script is the calendar's App evidence.
//
//   node scripts/check-calendar-app-ui.mjs     screenshots and report go to artifacts/calendar-app-ui/
//
// It waits for one real tick of the host clock, so it takes a little over 30 seconds longer than the other steps.
const expect = baseExpect.configure({ timeout: 20000 });
// No trailing separator: on Windows a trailing backslash would escape the closing quote of Electron's app argument.
const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const output = path.join(root, 'artifacts/calendar-app-ui');
const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'wb-calendar-app-'));
const checks = [], errors = [], network = [], facts = {};
const pass = message => { checks.push(message); console.log('PASS', message); };
await fs.mkdir(output, { recursive: true });
let app;
try {
  const env = { ...process.env, WORKBENCH_ROOT: root, WORKBENCH_IMAGE_ROOT: path.join(root, 'assets/content'), WORKBENCH_USER_DATA: profile };
  delete env.ELECTRON_RUN_AS_NODE;
  app = await electron.launch({ args: [root], cwd: root, env, timeout: 60000 });
  const page = await app.firstWindow();
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('request', request => { if (/^https?:/.test(request.url())) network.push(request.url()); });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.waitForFunction(() => window.smokeReady || window.smokeError, null, { timeout: 60000 });
  expect(await page.evaluate(() => window.smokeError)).toBeUndefined();
  await page.locator('[data-panel=world]').click();
  await expect(page.locator('.ws-quick')).toBeVisible({ timeout: 60000 });
  const quickStyle = () => page.locator('.ws-quick-link').first().evaluate(node => { const style = getComputedStyle(node); return [style.borderRadius, style.backgroundColor, style.padding, style.fontSize]; });
  const quickBefore = await quickStyle();
  const cal = page.locator('.ws-detail .cal99');
  const day = ordinal => cal.locator(`[data-calendar-day="${ordinal}"]`);
  const shot = name => page.locator('.ws-detail').screenshot({ path: path.join(output, name + '.png') });

  // 1. The quick entry opens the new view instead of the legacy detail cards.
  await page.locator('[data-quick=calendar]').click();
  await expect(cal).toBeVisible();
  await expect(page.locator('.ws-detail-grid')).toHaveCount(0);
  await expect(page.locator('.ws-detail-head h2')).toHaveText('1999 日历');
  await expect(cal.locator('[data-calendar-month]')).toHaveText(['1月', '2月', '3月']);
  facts.eventDays = await cal.locator('[data-calendar-month]').evaluateAll(nodes => nodes.reduce((sum, node) => sum + Number(node.getAttribute('aria-label').match(/(\d+) 个事件日/)?.[1] ?? 0), 0));
  expect(facts.eventDays).toBe(15);
  await expect(cal.locator('.cal99-day[aria-pressed=true]')).toHaveAttribute('data-calendar-day', '3');
  await expect(cal.locator('.cal99-statusbar')).toContainText('国际服 DE · 离线样本');
  await expect(cal.locator('.cal99-notice')).toContainText('离线样本');
  expect(await page.evaluate(() => [...document.styleSheets].some(sheet => sheet.href?.endsWith('/features/calendar-1999/presentation/calendar.css')))).toBe(true);
  await shot('app-calendar-de');
  pass('快速入口打开新日历：1—3 月共 15 个事件日，首选 1 月 3 日；离线样本提示；功能样式表已由 index.html 载入');

  // 2. Game text and the upgrade explanation through the real App renderer.
  await day(20).click();
  await expect(cal.locator('.cal99-detail .cal99-event-title h4')).toHaveText('煞调变 · 三选一');
  await expect(cal.locator('.cal99-offer')).toHaveCount(3);
  await expect(cal.locator('.cal99-offer p').first()).not.toBeEmpty();
  await expect(cal.locator('.cal99-detail-note')).toContainText('三个选项均为预览');
  pass('煞调变日经 App 的 renderGameText 显示三项名称与说明，并保留三选一说明');

  // 3. Keyboard focus stays visible inside the App's scrolling world page, in a short window and across a month.
  await page.setViewportSize({ width: 1440, height: 620 });
  await page.evaluate(() => { document.getElementById('world').scrollTop = 0; });
  await day(3).click();
  const focusedInView = () => page.evaluate(() => {
    const node = document.activeElement, box = node.getBoundingClientRect();
    const frames = [{ top: 0, left: 0, bottom: innerHeight, right: innerWidth }];
    for (let parent = node.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
      const style = getComputedStyle(parent);
      if (/auto|scroll|hidden|clip/.test(style.overflowX + style.overflowY)) frames.push(parent.getBoundingClientRect());
    }
    return { day: node.dataset.calendarDay ?? null, visible: box.height > 0 && frames.every(frame => box.top >= frame.top - 1 && box.bottom <= frame.bottom + 1 && box.left >= frame.left - 1 && box.right <= frame.right + 1) };
  });
  let scrolled = 0;
  for (const [key, ordinal] of [['ArrowDown', 10], ['ArrowDown', 17], ['ArrowDown', 24], ['ArrowDown', 31], ['ArrowDown', 38], ['End', 44], ['Home', 38],
    ['ArrowUp', 31], ['ArrowUp', 24], ['ArrowUp', 17], ['ArrowUp', 10], ['ArrowUp', 3]]) {
    await page.keyboard.press(key);
    await expect(day(ordinal)).toBeFocused();
    expect(await focusedInView(), `${key} → ${ordinal}`).toEqual({ day: String(ordinal), visible: true });
    scrolled = Math.max(scrolled, await page.evaluate(() => document.getElementById('world').scrollTop));
  }
  expect(scrolled).toBeGreaterThan(0);
  pass('620px 高窗口内用方向键、Home／End 跨月移动：焦点日期始终在世界状态页的滚动区域内可见');

  // 4. One real tick of the host clock (updateTimes → tick → update) refreshes the countdown and moves nothing. Every
  // countdown refresh writes the deadline's title, so the check watches that setter: a write to the watched element is a
  // tick of the mounted view. The host may also re-render (for example when the arbitration data arrives), which mounts a
  // new view and loses focus (48 · 第十二节); the check then counts it, focuses the new tab stop and watches the new view.
  await page.evaluate(() => {
    const tick = window.__calendarTick = { hits: 0, remounts: 0, result: null };
    const arm = () => Object.assign(tick, { box: document.querySelector('.cal99-deadline'), grid: document.querySelector('.cal99-grid'),
      focused: document.activeElement, scroll: document.getElementById('world').scrollTop });
    arm();
    const title = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'title');
    Object.defineProperty(HTMLElement.prototype, 'title', { ...title, set(value) {
      title.set.call(this, value);
      if (!this.classList?.contains('cal99-deadline') || tick.result) return;
      if (this === tick.box) {
        tick.hits++;
        tick.result = { focus: document.activeElement === tick.focused, grid: document.querySelector('.cal99-grid') === tick.grid,
          scroll: document.getElementById('world').scrollTop === tick.scroll, dayFocused: document.activeElement?.dataset.calendarDay ?? null };
      } else if (!tick.box?.isConnected) {
        tick.remounts++;
        queueMicrotask(() => { document.querySelector('.cal99-day[tabindex="0"]')?.focus({ preventScroll: true }); arm(); });
      }
    } });
  });
  // The clock runs every 30 seconds; a re-render or a busy window may push the next tick back, hence the margin.
  await page.waitForFunction(() => window.__calendarTick.result, null, { timeout: 100000 });
  const tick = await page.evaluate(() => ({ ...window.__calendarTick.result, remounts: window.__calendarTick.remounts }));
  facts.hostRemountsWhileWaiting = tick.remounts;
  expect(tick).toMatchObject({ focus: true, grid: true, scroll: true });
  expect(tick.dayFocused).not.toBeNull();
  await page.setViewportSize({ width: 1440, height: 1000 });
  pass(`宿主 30 秒时钟经 tick() 刷新倒数：日期格未重建，焦点（日期 ${tick.dayFocused}）与滚动位置不变；等待期间宿主重绘 ${tick.remounts} 次`);

  // 5. A reward goes to the library by keyboard, and the calendar comes back with its day.
  await day(19).click();
  const reward = cal.locator('.cal99-reward.is-linked').first();
  await expect(reward).toBeVisible();
  await expect.poll(() => reward.locator('.cal99-reward-art').evaluate(node => node.classList.contains('is-loading') ? 'loading' : node.querySelector('img') ? 'found' : 'missing')).not.toBe('loading');
  facts.rewardPicture = await reward.locator('.cal99-reward-art').evaluate(node => node.querySelector('img') ? 'found' : 'missing');
  facts.imageLibrary = await fs.stat(path.join(root, 'assets/content')).then(() => true, () => false);
  facts.rewardName = await reward.locator('.cal99-reward-name').textContent();
  await reward.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#codex')).toHaveClass(/active/);
  facts.libraryTitle = await page.locator('.codex-detail-intro h1').textContent();
  await page.locator('.codex-return-world').click();
  await expect(cal).toBeVisible();
  await expect(day(19)).toHaveAttribute('aria-pressed', 'true');
  pass(`奖励「${facts.rewardName}」以 Enter 打开资料库「${facts.libraryTitle}」，返回后日历恢复 1 月 19 日；图片：${facts.rewardPicture}（本机图库${facts.imageLibrary ? '存在' : '不存在'}）`);

  // 6. A host re-render mounts a new view; the shared store restores the day, and there is one calendar only.
  await day(19).focus();
  await page.keyboard.press('ArrowRight');
  await page.evaluate(async () => (await import('./app.js')).liveUI.render());
  await expect(day(20)).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.cal99')).toHaveCount(1);
  pass('宿主重绘后经共用存储恢复选取（1 月 20 日），页面只有一个日历');

  // 6b. CAL-10: the reward art mapping. On 2 月 25 日 (day 56) the DE sample offers CalendarMajorArtifactPack. World state
  // writes it with /StoreItems/, as the mapping key does, and the App catalog may project the other spelling: either way
  // the mapped picture comes from the App image root and really decodes in the App page. The jump depends on the library.
  await cal.locator('[data-calendar-month]').filter({ hasText: '2月' }).click();
  await day(56).click();
  const pack = cal.locator('.cal99-detail .cal99-reward[data-item-id^="/Lotus/"][data-item-id$="/Types/BoosterPacks/CalendarMajorArtifactPack"]');
  await expect(pack).toHaveCount(1);
  facts.mappedRewardId = await pack.getAttribute('data-item-id');
  const packImage = pack.locator('.cal99-reward-image');
  await expect(packImage).toHaveAttribute('src', /^file:\/\/.*\/src\/ui\/assets\/calendar-1999\/rewards\/CalendarMajorArtifactPack\.png$/);
  await expect.poll(() => packImage.evaluate(node => node.complete && node.naturalWidth > 0 ? [node.naturalWidth, node.naturalHeight] : null)).toEqual([128, 128]);
  facts.mappedPicture = {
    src: (await packImage.getAttribute('src')).replace(/^.*\/src\/ui\//, 'src/ui/'),
    linked: await pack.evaluate(node => node.classList.contains('is-linked')),
    hint: await pack.locator('.cal99-reward-hint').textContent()
  };
  expect(facts.mappedPicture.hint).toBe(facts.mappedPicture.linked ? '资料库 →' : '资料库未收录');
  if (!facts.mappedPicture.linked) await expect(pack).not.toHaveAttribute('data-action', /./);
  await shot('app-calendar-reward-art');
  pass(`映射图片在 App 内载入：${facts.mappedRewardId} 显示 ${facts.mappedPicture.src}（128×128，映射键为 /StoreItems/ 写法）；资料库${facts.mappedPicture.linked ? '有收录，可跳转' : '未收录，维持无跳转'}`);

  // 7. Dark App theme and an 800px window.
  await page.locator('#theme-select').selectOption('dark');
  expect(await cal.evaluate(node => getComputedStyle(node).backgroundColor)).toBe('rgb(217, 220, 207)');
  await shot('app-calendar-dark');
  await page.setViewportSize({ width: 800, height: 1000 });
  expect(await page.evaluate(() => {
    const [calendar, panel] = [...document.querySelector('.cal99-workspace').children].map(node => node.getBoundingClientRect()), world = document.getElementById('world');
    return { stacked: panel.top >= calendar.bottom - 1, overflow: world.scrollWidth > world.clientWidth + 1 };
  })).toEqual({ stacked: true, overflow: false });
  await shot('app-calendar-narrow');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator('#theme-select').selectOption('light');
  pass('深色主题下日历维持浅色桌面；800px 窗口上下排列且无水平溢出');

  // 8. × closes through the App; the world page looks as before the calendar opened.
  await cal.getByRole('button', { name: '关闭日历' }).click();
  await expect(page.locator('.cal99')).toHaveCount(0);
  await expect(page.locator('.ws-quick')).toBeVisible();
  expect(await quickStyle()).toEqual(quickBefore);
  pass('× 经 close 能力回到世界状态，日历卸载；快速入口按钮样式与打开日历前相同');

  // 9. The overview card keeps showing rewards only, and its full-content entry opens the new view.
  await page.locator('#ws-tabs button').filter({ hasText: '总览' }).click();
  await expect(page.locator('[data-module=calendar] .ws-loot').first()).toBeVisible();
  await page.locator('[data-module=calendar] .ws-more').click();
  await expect(cal).toBeVisible();
  await page.locator('.ws-back').click();
  await expect(page.locator('[data-module=calendar]')).toBeVisible();
  pass('总览卡片仍只显示奖励；「完整内容」进入新日历，页面返回键回到总览');

  // 10. The other server has its own calendar.
  await page.locator('[data-ws-server=wg]').click();
  await expect(page.locator('#ws-server-label')).toHaveText('国服 · WG', { timeout: 30000 });
  await page.locator('#ws-tabs button').filter({ hasText: '快速入口' }).click();
  await page.locator('[data-quick=calendar]').click();
  await expect(cal).toBeVisible();
  await expect(cal.locator('.cal99-statusbar')).toContainText('国服 WG');
  await shot('app-calendar-wg');
  pass('国服显示自己的日历与状态列');

  expect(errors).toEqual([]);
  expect(network).toEqual([]);
  pass('无页面错误，网页进程无外网请求');
  await fs.writeFile(path.join(output, 'report.json'), JSON.stringify({ ok: true, checks, facts, errors, network }, null, 2));
} catch (error) {
  process.exitCode = 1;
  console.error(error);
  if (app) await (await app.firstWindow()).screenshot({ path: path.join(output, 'failure.png') }).catch(() => {});
  await fs.writeFile(path.join(output, 'report.json'), JSON.stringify({ ok: false, checks, facts, error: String(error?.stack ?? error), errors, network }, null, 2));
} finally {
  await app?.close();
  await fs.rm(profile, { recursive: true, force: true });
}
