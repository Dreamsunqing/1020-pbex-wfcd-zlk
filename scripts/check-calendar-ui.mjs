import { chromium, expect as baseExpect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PAGE_FILE_PREFIXES, pageFileOf } from './serve-calendar-standalone.mjs';

// Browser check of the 1999 calendar view (CAL-08). It drives test/calendar/browser/harness.html in Chromium: the real
// view, mount and session from the public entry, fake capabilities and the fixed scenarios of scenarios.mjs (CAL-09). No
// Electron, App bridge, upstream data, image library or network: the page is served from a fake origin that answers
// only for the files the standalone server allows (pageFileOf: the calendar feature, the test pages and the scenario
// fixtures), and every other request fails the check.
//
//   node scripts/check-calendar-ui.mjs            run the checks; screenshots and report go to artifacts/calendar-ui/
//   node scripts/check-calendar-ui.mjs --headed   watch it in a visible browser
const expect = baseExpect.configure({ timeout: 10000 });
const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'artifacts/calendar-ui');
const ORIGIN = 'http://calendar.test';
const checks = [], errors = [], unexpected = [], served = new Set();
const pass = message => { checks.push(message); console.log('PASS', message); };

await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: !process.argv.includes('--headed') });
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, locale: 'zh-CN', deviceScaleFactor: 1 });
await context.route('**/*', async route => {
  const url = new URL(route.request().url());
  const file = url.origin === ORIGIN ? pageFileOf(url.pathname) : null;
  if (!file) {
    unexpected.push(url.href);
    return route.abort();
  }
  served.add(file.relative);
  return route.fulfill({ status: 200, contentType: file.type, body: await fs.readFile(path.join(root, file.relative)) });
});
const page = await context.newPage();
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });

const harness = (name, ...args) => page.evaluate(([name, args]) => window.calendarHarness[name](...args), [name, args]);
const cal = page.locator('#slot .cal99');
const detail = cal.locator('.cal99-detail');
const day = ordinal => cal.locator(`[data-calendar-day="${ordinal}"]`);
const shot = name => cal.screenshot({ path: path.join(output, name + '.png') });
const overflowFree = () => page.evaluate(() => {
  const offenders = [];
  for (const node of document.querySelectorAll('#slot .cal99, #slot .cal99 *')) {
    if (node.closest('pre')) continue;
    if (node.scrollWidth > node.clientWidth + 1 && getComputedStyle(node).overflowX !== 'visible') offenders.push(node.className || node.tagName);
    const box = node.getBoundingClientRect(), frame = document.querySelector('#slot .cal99').getBoundingClientRect();
    if (box.width && (box.right > frame.right + 1 || box.left < frame.left - 1)) offenders.push('outside: ' + (node.className || node.tagName));
  }
  return { offenders, page: document.documentElement.scrollWidth <= innerWidth };
});

try {
  await page.goto(`${ORIGIN}/test/calendar/browser/harness.html`);
  await expect(page.locator('html[data-ready=true]')).toHaveCount(1);

  // 1. The real host projection: winter, opened on its first event day.
  await harness('mount', 'winter');
  await expect(cal.locator('[data-calendar-month]')).toHaveText(['1月', '2月', '3月']);
  await expect(cal.locator('.cal99-day')).toHaveCount(31);
  await expect(cal.locator('.cal99-day[aria-pressed=true]')).toHaveAttribute('data-calendar-day', '3');
  await expect(detail.locator('.cal99-detail-top h3')).toHaveText('1 月 3 日');
  await expect(detail.locator('.cal99-detail-top p')).toHaveText('星期日 · 游戏日 3');
  await expect(detail.locator('.cal99-event-title h4')).toHaveText('挑战');
  await expect(detail.locator('.cal99-offer h5').first()).toHaveText('近战击杀');
  await expect(cal.locator('.cal99-notice')).toContainText('离线样本');
  await expect(cal.locator('.cal99-statusbar')).toContainText('国际服 DE · 离线样本 · 快照日期 2026-10-22（UTC）');
  await expect(cal.locator('.cal99-statusbar')).toContainText('排程预览 · 不含个人完成进度');
  await expect(cal.locator('.cal99-deadline')).toContainText('换季：已结束');
  await shot('calendar-winter');
  pass('宿主投影：冬季三个月、31 格、首个事件日、挑战详情、离线样本提示与已结束倒数');

  // 2. Day, rewards, picture, library and source panel on the contract example.
  await harness('mount', 'spring');
  await expect(cal.locator('[data-calendar-month]')).toHaveText(['4月', '5月', '6月']);
  await expect(cal.locator('.cal99-day')).toHaveCount(30);
  await day(104).click();
  await expect(day(104)).toBeFocused();
  await expect(detail.locator('.cal99-detail-top h3')).toHaveText('4 月 14 日');
  await expect(detail.locator('.cal99-event-title h4')).toHaveText('煞调变 · 三选一');
  await expect(detail.locator('.cal99-offer-index')).toHaveText(['选项 01', '选项 02', '选项 03']);
  await expect(detail.locator('.cal99-detail-note')).toContainText('三个选项均为预览');
  await shot('calendar-spring-upgrade');
  await day(101).click();
  const reward = detail.getByRole('button', { name: '测试奖励，在资料库查看' });
  await expect(reward).toBeVisible();
  await expect(reward.locator('.cal99-reward-image')).toHaveAttribute('src', /^data:image\/png/);
  await expect(reward).toHaveAttribute('data-item-id', '/Test/Reward');
  await harness('takeCalls');
  await reward.click();
  expect((await harness('takeCalls')).filter(call => call[0] === 'openItem')).toEqual([['openItem', '/Test/Reward', '/Test/Reward', null]]);
  await detail.locator('.cal99-evidence summary').first().click();
  await expect(detail.locator('.cal99-evidence').first()).toContainText('完整物品 ID');
  await expect(detail.locator('.cal99-evidence pre').first()).toContainText('"day": 101');
  await shot('calendar-spring-reward');
  pass('点日期更新右侧详情；三选一说明；候选奖励图片、资料库跳转带完整 ID；来源面板保留原始事件');

  // 3. Keyboard and focus follow the session, and give the same result as a click.
  await day(104).click();
  await page.keyboard.press('ArrowRight');
  await expect(day(105)).toBeFocused();
  await expect(day(105)).toHaveAttribute('aria-pressed', 'true');
  await expect(detail.locator('.cal99-detail-top h3')).toHaveText('4 月 15 日');
  await page.keyboard.press('Home');
  await expect(day(101)).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await expect(day(94)).toBeFocused();
  await page.keyboard.press('End');
  await expect(day(100)).toBeFocused();
  for (let index = 0; index < 4; index++) await page.keyboard.press('ArrowDown');
  await expect(day(128)).toBeFocused();
  await expect(cal.locator('[data-calendar-month="5"]')).toHaveAttribute('aria-pressed', 'true');
  expect(await cal.locator('.cal99-day[tabindex="0"]').count()).toBe(1);
  await expect(cal.locator('.cal99-day[tabindex="0"]')).toHaveAttribute('data-calendar-day', '128');
  await cal.locator('[data-calendar-month="4"]').click();
  const viewOf = () => page.evaluate(() => ({
    pressed: [...document.querySelectorAll('#slot .cal99-day[aria-pressed=true]')].map(node => node.dataset.calendarDay),
    detail: document.querySelector('#slot .cal99-detail').innerText,
    focused: document.activeElement?.dataset.calendarDay
  }));
  await day(110).click();
  const byClick = await viewOf();
  await day(109).click();
  await page.keyboard.press('ArrowRight');
  expect(await viewOf()).toEqual(byClick);
  await day(109).focus();
  await page.keyboard.press('Enter');
  await expect(day(109)).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('ArrowLeft');
  expect((await harness('takeOperations')).filter(([name]) => name === 'move').at(-1)).toEqual(['move', 'ArrowLeft']);
  pass('方向键／Home／End／跨月由会话决定，焦点跟随；单一 Tab 停留点；点选与键盘结果一致');

  // 3b. The day a key reaches is focused and visible: in a short window, in a narrow container and inside a scrolling
  // container, moving down and up, with Home/End and across months. A visible day does not move the page.
  const scrollState = () => page.evaluate(() => [scrollX, scrollY, document.getElementById('slot').scrollTop]);
  const focusedInView = () => page.evaluate(() => {
    const node = document.activeElement, box = node.getBoundingClientRect();
    const frames = [{ top: 0, left: 0, bottom: innerHeight, right: innerWidth }];
    for (let parent = node.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
      const style = getComputedStyle(parent);
      if (/auto|scroll|hidden|clip/.test(style.overflowX + style.overflowY)) frames.push(parent.getBoundingClientRect());
    }
    return { day: node.dataset.calendarDay ?? null, visible: box.height > 0 && frames.every(frame => box.top >= frame.top - 1 && box.bottom <= frame.bottom + 1 && box.left >= frame.left - 1 && box.right <= frame.right + 1) };
  });
  // Answers the largest scroll offset seen, which proves the layout really needed scrolling.
  const walk = async (label, steps) => {
    let scrolled = 0;
    for (const [key, ordinal] of steps) {
      await page.keyboard.press(key);
      await expect(day(ordinal), `${label} ${key}`).toBeFocused();
      await expect(day(ordinal)).toHaveAttribute('aria-pressed', 'true');
      expect(await focusedInView(), `${label} ${key} → ${ordinal}`).toEqual({ day: String(ordinal), visible: true });
      scrolled = Math.max(scrolled, ...(await scrollState()));
    }
    return scrolled;
  };
  // From 4/1 down to 5/13, across the month, then Home/End in the row and back up to the first row of April.
  const route = [['ArrowDown', 98], ['ArrowDown', 105], ['ArrowDown', 112], ['ArrowDown', 119], ['ArrowDown', 126], ['ArrowDown', 133],
    ['End', 135], ['Home', 129], ['ArrowUp', 122], ['ArrowUp', 115], ['ArrowUp', 108], ['ArrowUp', 101], ['ArrowUp', 94], ['End', 100], ['ArrowUp', 93]];
  // The page CSP forbids style attributes, so the layouts are set through CSSOM and then measured.
  const layouts = [
    ['短窗口', { width: 1440, height: 480 }, '', { stacked: false, slotScrolls: false }],
    ['窄容器', { width: 1440, height: 520 }, 'width: 480px', { stacked: true, slotScrolls: false }],
    ['滚动容器', { width: 1440, height: 900 }, 'height: 420px; overflow: auto', { stacked: false, slotScrolls: true }]
  ];
  for (const [label, viewport, style, expected] of layouts) {
    await page.setViewportSize(viewport);
    await page.evaluate(style => { const slot = document.getElementById('slot'); slot.style.cssText = style; slot.scrollTop = 0; scrollTo(0, 0); }, style);
    await harness('mount', 'spring');
    const shape = await page.evaluate(() => {
      const slot = document.getElementById('slot'), [calendar, panel] = [...slot.querySelector('.cal99-workspace').children].map(node => node.getBoundingClientRect());
      return { stacked: panel.top >= calendar.bottom - 1, slotScrolls: getComputedStyle(slot).overflowY === 'auto' && slot.scrollHeight > slot.clientHeight };
    });
    expect(shape, label).toEqual(expected);
    await cal.locator('[data-calendar-month="4"]').click();
    await day(91).click();
    expect(await walk(label, route), `${label} needed scrolling`).toBeGreaterThan(0);
  }
  await page.evaluate(() => { document.getElementById('slot').style.cssText = ''; });
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.evaluate(() => scrollTo(0, 0));
  await day(104).click();
  const still = await scrollState();
  await page.keyboard.press('ArrowRight');
  await expect(day(105)).toBeFocused();
  expect(await scrollState()).toEqual(still);
  pass('键盘移动后焦点日期可见：短窗口、窄容器、内部滚动容器，上下、Home／End 与跨月；已可见时不移动画面');

  // 4. Selection is not told by colour alone, and the month bar shows the shown month the same way.
  const marks = await page.evaluate(() => {
    const selected = document.querySelector('#slot .cal99-day.is-selected'), other = document.querySelector('#slot .cal99-day:not(.is-selected)');
    const style = getComputedStyle(selected), before = getComputedStyle(selected, '::before');
    return { pressed: selected.getAttribute('aria-pressed'), width: style.borderTopWidth, otherWidth: getComputedStyle(other).borderTopWidth,
      ring: style.boxShadow, corner: before.content, cornerWidth: before.borderTopWidth,
      month: getComputedStyle(document.querySelector('#slot .cal99-month.is-selected')).boxShadow };
  });
  expect(marks).toMatchObject({ pressed: 'true', width: '2px', otherWidth: '1px', corner: '""', cornerWidth: '13px' });
  expect(marks.ring).toContain('inset');
  expect(marks.month).toContain('inset');
  await expect(cal.locator('.cal99-legend')).toContainText('粗框：正在查看');
  pass('选取以 aria-pressed、加粗边框、内框与角标表示，不只靠颜色；图例说明粗框为正在查看');

  // 5. Month and season choices; a month without a chosen day says so instead of guessing one.
  await cal.locator('[data-calendar-month="6"]').click();
  await expect(cal.locator('[data-calendar-month="6"]')).toBeFocused();
  await expect(cal.locator('.cal99-day')).toHaveCount(30);
  await expect(cal.locator('.cal99-day[aria-pressed=true]')).toHaveCount(0);
  await expect(detail.locator('.cal99-detail-top h3')).toHaveText('尚未选择日期');
  await expect(cal.locator('.cal99-day[tabindex="0"]')).toHaveAttribute('data-calendar-day', '152');
  await harness('mount', 'seasons');
  await cal.locator('.cal99-season-picker').selectOption('1');
  await expect(cal.locator('.cal99-season-picker')).toBeFocused();
  await expect(cal.locator('.cal99-season-title')).toContainText('夏季');
  await expect(cal.locator('[data-calendar-month]')).toHaveText(['7月', '8月', '9月']);
  await expect(cal.locator('.cal99-season-picker option')).toHaveText(['春季 · 轮回 24', '夏季 · 轮回 25']);
  pass('切换月份与季度经会话；未选日期时明确提示，不推定日期');

  // 6. A new snapshot of the same season restores the selection, and an outdated one says so.
  await harness('mount', 'spring');
  // The store kept June from step 5 for this context, so the new session opens there.
  await expect(cal.locator('[data-calendar-month="6"]')).toHaveAttribute('aria-pressed', 'true');
  await cal.locator('[data-calendar-month="4"]').click();
  await day(104).click();
  await harness('mount', 'stale');
  await expect(day(104)).toHaveAttribute('aria-pressed', 'true');
  await expect(cal.locator('.cal99-notice')).toHaveText('快照已过期：以下是快照当时的排程，目前可能已经改变。');
  await expect(cal.locator('.cal99-statusbar')).toContainText('缓存快照');
  await shot('calendar-stale');
  await harness('mount', 'imported');
  await expect(cal.locator('.cal99-notice')).toContainText('导入快照');
  await harness('mount', 'live');
  await expect(cal.locator('.cal99-notice')).toHaveCount(0);
  await expect(cal.locator('.cal99-statusbar')).toContainText('实时快照');
  await expect(day(104)).toHaveAttribute('aria-pressed', 'true');
  pass('同一季度的新快照恢复选取；过期、导入、样本快照显示提示，实时快照不显示');

  // 7. Several events on one day are all kept and counted.
  await harness('mount', 'multi');
  await expect(day(101)).toHaveAttribute('data-event-kind', 'mixed');
  await expect(day(101).locator('.cal99-day-count')).toHaveText('×3');
  await expect(day(101)).toHaveAttribute('aria-label', /3 笔事件/);
  await day(101).click();
  await expect(detail.locator('.cal99-event-count')).toHaveText('3 笔事件');
  await expect(detail.locator(':scope > .cal99-entry > .cal99-entry-title')).toHaveText(['事件 01 · 候选奖励', '事件 02 · 挑战', '事件 03 · 煞调变 · 三选一']);
  // Independent entries keep their own kinds: the upgrade entry keeps its explicit three-option note, and the day being
  // mixed adds no mixed-entry note.
  const upgradeEntry = detail.locator(':scope > .cal99-entry[data-entry-kind=upgrade]');
  await expect(upgradeEntry.locator('.cal99-offer-index')).toHaveText(['选项 01', '选项 02', '选项 03']);
  await expect(upgradeEntry.locator('.cal99-detail-note')).toHaveText('三个选项均为预览；实际选择请在游戏内完成，本页不记录任何选择。');
  await expect(detail.locator(':scope > .cal99-entry[data-entry-kind=mixed]')).toHaveCount(0);
  await expect(detail).not.toContainText('此处仅预览公开事件');
  await shot('calendar-multi');
  pass('同日多笔独立条目全部保留：格内计数、无障碍名称、逐笔类型；煞调变条目保留三选一说明');

  // 7b. One entry made of different source events (a reward and three upgrades on one projected day) is a single mixed
  // entry: its terms are not presented as one set of options, and only the conditional note explains a possible upgrade.
  await harness('mount', 'mixedEntry');
  await expect(day(19)).toHaveAttribute('data-event-kind', 'mixed');
  await expect(day(19).locator('.cal99-day-count')).toHaveCount(0);
  await day(19).click();
  await expect(detail.locator('.cal99-event-title h4')).toHaveText('综合事件');
  await expect(detail.locator(':scope > .cal99-entry')).toHaveCount(1);
  await expect(detail.locator(':scope > .cal99-entry')).toHaveAttribute('data-entry-kind', 'mixed');
  await expect(detail.locator('.cal99-entry-title')).toHaveCount(0);
  await expect(detail.locator('.cal99-reward')).toHaveCount(2);
  await expect(detail.locator('.cal99-offer-index')).toHaveText(['内容 01', '内容 02', '内容 03']);
  await expect(detail.locator('.cal99-detail-note')).toHaveText('此处仅预览公开事件。若包含煞调变，候选效果以游戏内三选一为准；本页不记录个人选择或完成进度。');
  await expect(detail).not.toContainText('三个选项均为预览');
  await expect(detail).not.toContainText('选项 0');
  await shot('calendar-mixed-entry');
  await day(3).click();
  await expect(detail.locator('.cal99-detail-note')).toHaveCount(0);
  pass('单笔混合条目（奖励＋三项煞调变）：不当成同一组选项，只显示条件式说明；纯挑战日不显示说明');

  // 8. Unmapped entries, an unknown season, a season without events and an empty snapshot.
  await harness('mount', 'unmapped');
  await expect(detail.locator('.cal99-unmapped > summary')).toHaveText('2 笔事件的日期无法对应本季，已原样保留');
  await detail.locator('.cal99-unmapped > summary').click();
  await expect(detail.locator('.cal99-unmapped .cal99-entry-title')).toHaveText(['超出全年范围 · 原始日序 366 · 其他事件', '不在本季月份 · 原始日序 200 · 挑战']);
  await harness('mount', 'unknown');
  await expect(cal.locator('.cal99-day')).toHaveCount(0);
  await expect(cal.locator('.cal99-season-title')).toContainText('未知季节');
  await expect(cal.locator('.cal99-detail .cal99-empty').first()).toContainText('这个季度（CST_UNKNOWN）还没有日期对应规则，以下按原始顺序保留全部 2 笔事件。');
  await expect(cal.locator('.cal99-entry-title')).toHaveText(['超出全年范围的事件 · 原始日序 366 · 其他事件', '缺少日序的事件 · 原始日序 缺失 · 其他事件']);
  await shot('calendar-unknown-season');
  await harness('mount', 'quiet');
  await expect(cal.locator('.cal99-day.has-event')).toHaveCount(0);
  await expect(cal.locator('.cal99-day.is-listed')).toHaveCount(4);
  await expect(detail.locator('.cal99-detail-top h3')).toHaveText('尚未选择日期');
  await day(96).click();
  await expect(detail.locator('.cal99-empty')).toHaveText('上游列有这个日期，但没有提供事件内容。');
  await day(97).click();
  await expect(detail.locator('.cal99-empty')).toHaveText('这份快照未在这一天列出事件，请选择有图示的日期查看。');
  await harness('mount', 'empty');
  await expect(cal.locator('.cal99-empty')).toHaveText('这份快照没有可用的 1999 日历。');
  await expect(cal.locator('.cal99-titlebar, .cal99-statusbar')).toHaveCount(2);
  await shot('calendar-empty');
  pass('未映射事件、未知季节、无事件季度、只列出无内容的日期与空快照都有明确画面，不伪造事件');

  // 9. Missing, broken and late pictures; rewards without a library target ask for a picture too (CAL-10), never jump.
  const UNLINKED = '/Test/Unlinked/' + 'X'.repeat(60);
  await harness('setArt', 'missing');
  await harness('takeCalls');
  await harness('mount', 'long');
  await day(101).click();
  const cards = detail.locator('.cal99-reward');
  await expect(cards).toHaveCount(2);
  await expect(cards.nth(0).locator('.cal99-reward-art.is-missing svg')).toHaveCount(1);
  await expect(cards.nth(0).locator('img')).toHaveCount(0);
  await expect(cards.nth(1).locator('.cal99-reward-art.is-missing svg')).toHaveCount(1);
  await expect(cards.nth(1)).not.toHaveAttribute('data-action', /./);
  await expect(cards.nth(1)).toContainText('资料库未收录');
  expect((await harness('takeCalls')).filter(call => call[0] === 'loadArt')).toEqual([['loadArt', '/Test/Long', '/Test/Long'], ['loadArt', UNLINKED, null]]);
  await harness('setArt', 'found');
  await harness('mount', 'long');
  await day(101).click();
  await expect(cards.nth(1).locator('.cal99-reward-image')).toHaveAttribute('src', /^data:image\/png/);
  await expect(cards.nth(1)).not.toHaveAttribute('data-action', /./);
  await expect(cards.nth(1)).toContainText('资料库未收录');
  expect(await cards.nth(1).evaluate(node => node.tagName)).toBe('DIV');
  await harness('setArt', 'broken');
  await harness('mount', 'spring');
  await day(101).click();
  await expect(detail.locator('.cal99-reward-art.is-missing svg')).toHaveCount(1);
  await harness('setArt', 'pending');
  await harness('mount', 'spring');
  await day(101).click();
  await expect(detail.locator('.cal99-reward-art.is-loading svg')).toHaveCount(1);
  await harness('unmount');
  await harness('setArt', 'found');
  pass('缺图、坏图与未完成的图片都显示代码占位图且保留名称；无资料库目标的奖励也按完整 ID 请求图片，有图时显示图片，仍不显示跳转');

  // 9b. Birthdays (CAL-11): the six Hex members on their verified dates in their seasons, next to the day's events; each
  // portrait is asked for by its own key; a missing or broken portrait keeps the name and the mark; other listed days stay
  // as they were; a plot event that names no one, and a conflict, keep the original event with a note.
  await harness('takeCalls');
  await harness('mount', 'birthdays');
  const picker = cal.locator('.cal99-season-picker');
  const monthTab = index => cal.locator(`[data-action="month"][data-index="${index}"]`);
  const birthdayCard = id => detail.locator(`.cal99-birthday[data-character-id="${id}"]`);
  const visit = async (season, monthIndex) => {
    if (await picker.inputValue() !== String(season)) await picker.selectOption(String(season));
    await monthTab(monthIndex).click();
  };
  const TREASURE = name => `/Lotus/Types/Gameplay/1999Wf/Resources/HexDogTag${name}`;
  for (const [season, monthIndex, ordinal, id, name, date, kind, basis, protoframe, gift, giftId] of [
    [0, 1, 45, 'hex-lettie', '莱蒂', '2 月 14 日', null, 'table', 'Trinity', '切达芝士皇冠麦片', TREASURE('Lettie')],
    [1, 1, 143, 'hex-amir', '阿米尔', '5 月 23 日', 'reward', 'table', 'Volt', '女伯爵漫画', TREASURE('Amir')],
    [2, 0, 191, 'hex-aoi', '碧', '7 月 10 日', 'other', 'upstream', 'Mag', '线上时代 CD', TREASURE('Aoi')],
    [3, 1, 306, 'hex-eleanor', '埃莉诺', '11 月 2 日', null, 'table', 'Nyx', '心情水晶', TREASURE('Eleanor')],
    [3, 1, 307, 'hex-arthur', '亚瑟', '11 月 3 日', 'mixed', 'upstream', 'Excalibur', '酌趣六瓶装啤酒', TREASURE('Arthur')],
    [3, 2, 338, 'hex-quincy', '昆西', '12 月 4 日', null, 'table', 'Cyte-09', '35 毫米胶片', TREASURE('Quincy')]
  ]) {
    await visit(season, monthIndex);
    const cell = day(ordinal);
    await expect(cell).toHaveAttribute('data-birthdays', id);
    await expect(cell).toHaveAttribute('aria-label', new RegExp(`${name}生日`));
    if (kind) {
      // The day keeps its event icon and kind; the birthday is the small cake in the corner.
      await expect(cell).toHaveAttribute('data-event-kind', kind);
      await expect(cell.locator('.cal99-day-birthday svg')).toHaveCount(1);
    } else {
      await expect(cell).not.toHaveAttribute('data-event-kind', /./);
      await expect(cell.locator('.cal99-day-label')).toHaveText('生日');
    }
    await cell.click();
    await expect(birthdayCard(id).locator('.cal99-birthday-name')).toHaveText(name);
    await expect(birthdayCard(id).locator('.cal99-birthday-date')).toHaveText(`${date}生日`);
    await expect(birthdayCard(id)).toHaveAttribute('data-birthday-basis', basis);
    await expect(birthdayCard(id).locator('.cal99-portrait-image')).toHaveAttribute('src', new RegExp(`^data:image/svg\\+xml,.*${id}`));
    // The card shows the role and the personality; its basis and sources stay in the data and are not drawn.
    await expect(birthdayCard(id).locator('.cal99-birthday-role')).toHaveText(new RegExp(`^职位：.*（${protoframe} 原型战甲）$`));
    await expect(birthdayCard(id).locator('.cal99-birthday-personality')).toHaveText(/^性格：.+。$/);
    await expect(birthdayCard(id).locator('details, .cal99-evidence')).toHaveCount(0);
    await expect(birthdayCard(id)).not.toContainText('依据');
    // Below the card, a box of the gifts that suit the character: a reward-like card that asks for its picture by the
    // gift's full ID, never a button.
    const gifts = detail.locator(`.cal99-gifts[data-character-id="${id}"]`);
    await expect(gifts.locator('.cal99-gifts-title')).toHaveText(`适合送给${name}的礼物`);
    await expect(gifts.locator('.cal99-gift')).toHaveCount(1);
    await expect(gifts.locator('.cal99-gift-name')).toHaveText(gift);
    await expect(gifts.locator('.cal99-gift')).toHaveAttribute('data-item-id', giftId);
    await expect(gifts.locator('.cal99-gift .cal99-reward-image')).toHaveAttribute('src', /^data:image\/png/);
    expect(await gifts.locator('.cal99-gift').evaluate(node => [node.tagName, node.dataset.action ?? null])).toEqual(['DIV', null]);
    // No explanation under the gifts, and a birthday day without events shows no empty-day explanation either.
    await expect(gifts.locator('.cal99-detail-note')).toHaveCount(0);
    await expect(detail.locator('.cal99-empty')).toHaveCount(0);
    expect(await page.evaluate(([card, box]) => document.querySelector(box).getBoundingClientRect().top >= document.querySelector(card).getBoundingClientRect().bottom,
      [`#slot .cal99-birthday[data-character-id="${id}"]`, `#slot .cal99-gifts[data-character-id="${id}"]`])).toBe(true);
    await expect(detail.locator('.cal99-entry')).toHaveCount(kind ? 1 : 0);
    if (ordinal === 143) await shot('calendar-birthday-with-reward');
  }
  const birthdayCalls = await harness('takeCalls');
  expect(birthdayCalls.filter(call => call[0] === 'loadPortrait')).toEqual(
    ['hex-lettie', 'hex-amir', 'hex-aoi', 'hex-eleanor', 'hex-arthur', 'hex-quincy'].map(key => ['loadPortrait', key]));
  // Gift pictures go through loadArt by full ID and without a library target, once each.
  expect(birthdayCalls.filter(call => call[0] === 'loadArt' && call[1].includes('/1999Wf/Resources/'))).toEqual(
    ['Lettie', 'Amir', 'Aoi', 'Eleanor', 'Arthur', 'Quincy'].map(name => ['loadArt', TREASURE(name), null]));
  // Other listed days without events keep their meaning; the group-chat plot event keeps its note and shows no birthday.
  await visit(0, 0);
  await expect(day(1)).not.toHaveAttribute('data-birthdays', /./);
  await expect(day(1).locator('.cal99-day-listed')).toHaveCount(1);
  await visit(0, 2);
  await expect(day(74)).not.toHaveAttribute('data-birthdays', /./);
  await visit(3, 2);
  await expect(day(340)).not.toHaveAttribute('data-birthdays', /./);
  await day(340).click();
  await expect(detail.locator('.cal99-entry-note[data-note-code="UNRECOGNIZED_PLOT"]')).toContainText('没有指明生日表中的角色');
  await expect(detail.locator('.cal99-birthday')).toHaveCount(0);
  // Missing and broken portraits keep the name, the date and the cell mark, with the code-native placeholder.
  for (const mode of ['missing', 'broken']) {
    await harness('setPortrait', mode);
    await harness('mount', 'birthdays');
    await visit(0, 1);
    await expect(day(45).locator('.cal99-day-label')).toHaveText('生日');
    await day(45).click();
    await expect(birthdayCard('hex-lettie').locator('.cal99-portrait.is-missing svg')).toHaveCount(1);
    await expect(birthdayCard('hex-lettie').locator('.cal99-portrait')).toHaveAttribute('title', '暂无角色图');
    await expect(birthdayCard('hex-lettie').locator('.cal99-birthday-name')).toHaveText('莱蒂');
    await expect(detail.locator('.cal99-event-title h4')).toHaveText('生日');
    if (mode === 'missing') await shot('calendar-birthday-no-portrait');
  }
  await harness('setPortrait', 'found');
  // A conflict: no birthday for Quincy on either day, and the original event carries the diagnostic.
  await harness('mount', 'birthdayConflict');
  await monthTab(2).click();
  await expect(day(337)).not.toHaveAttribute('data-birthdays', /./);
  await expect(day(338)).not.toHaveAttribute('data-birthdays', /./);
  await expect(day(338).locator('.cal99-day-listed')).toHaveCount(1);
  await day(337).click();
  const conflictNote = detail.locator('.cal99-entry-note[data-note-code="BIRTHDAY_CONFLICT"]');
  await expect(conflictNote).toContainText('昆西');
  await expect(conflictNote).toContainText('12 月 4 日');
  await expect(conflictNote).toHaveAttribute('role', 'note');
  await expect(detail.locator('.cal99-event-title h4')).toHaveText('其他事件');
  await expect(detail.locator('.cal99-birthday')).toHaveCount(0);
  await shot('calendar-birthday-conflict');
  // A narrow container keeps the birthday card inside the calendar.
  await harness('mount', 'birthdays');
  await visit(3, 1);
  await day(307).click();
  await page.evaluate(() => { document.getElementById('slot').style.width = '480px'; });
  expect(await overflowFree()).toEqual({ offenders: [], page: true });
  await shot('calendar-birthday-narrow');
  await page.evaluate(() => { document.getElementById('slot').style.width = ''; });
  await harness('unmount');
  pass('六人生日：各季度正确日期显示蛋糕标记；角色卡显示角色图、名称、职位与性格，不显示来源面板；下方礼物框按完整 ID 取图且不可跳转；同日事件并存；缺图与坏图保留名称与占位图；其他空事件日不变；未识别剧情事件与来源冲突保留原事件并附诊断；窄容器无溢出');

  // 10. Long text wraps instead of overflowing or being cut, in wide and narrow containers.
  await harness('mount', 'long');
  await day(101).click();
  for (const width of [1400, 820, 500]) {
    await page.evaluate(width => { document.getElementById('slot').style.width = width + 'px'; }, width);
    const result = await overflowFree();
    expect(result, `width ${width}`).toEqual({ offenders: [], page: true });
    const clipped = await page.evaluate(() => [...document.querySelectorAll('#slot .cal99-reward-name, #slot .cal99-offer h5, #slot .cal99-offer p, #slot .cal99-season-title span')]
      .filter(node => {
        // Text is cut only where overflow is not visible, or by an ellipsis or a line clamp.
        const style = getComputedStyle(node);
        const hides = style.overflowX !== 'visible' || style.overflowY !== 'visible';
        return (hides && (node.scrollHeight > node.clientHeight + 1 || node.scrollWidth > node.clientWidth + 1)) || style.textOverflow === 'ellipsis' || style.webkitLineClamp !== 'none';
      }).map(node => node.className || node.tagName));
    expect(clipped, `width ${width}`).toEqual([]);
  }
  await expect(detail.locator('.cal99-reward-name').first()).toHaveText(/ThisIsAnUnbrokenIdentifierWithoutSpacesThatMustWrapInsteadOfOverflowing$/);
  await shot('calendar-long-text-narrow');
  await day(104).click();
  await expect(detail.locator('.cal99-offer p').first()).toContainText('path/path/path/');
  pass('长季度名、长奖励名与长说明在 1400／820／500px 容器内换行，无溢出、无省略号截断');

  // 11. Narrow containers stack the calendar above the detail; wide ones keep them side by side.
  await harness('mount', 'spring');
  const layout = async width => {
    await page.evaluate(width => { document.getElementById('slot').style.width = width + 'px'; }, width);
    return page.evaluate(() => {
      const [calendar, panel] = [...document.querySelector('#slot .cal99-workspace').children].map(node => node.getBoundingClientRect());
      const label = document.querySelector('#slot .cal99-day-label');
      return { stacked: panel.top >= calendar.bottom - 1, labels: label ? getComputedStyle(label).display !== 'none' : null };
    });
  };
  expect(await layout(1400)).toEqual({ stacked: false, labels: true });
  expect(await layout(900)).toEqual({ stacked: true, labels: true });
  expect(await layout(480)).toEqual({ stacked: true, labels: false });
  expect(await overflowFree()).toEqual({ offenders: [], page: true });
  await shot('calendar-narrow');
  await page.evaluate(() => { document.getElementById('slot').style.width = ''; });
  pass('容器 ≤930px 上下排列、≤560px 精简日期格，按日历自身宽度而非视窗');

  // 12. Failures of host actions stay visible; closing goes through the capability.
  await day(101).click();
  await harness('setOpenItem', false);
  await detail.getByRole('button', { name: '测试奖励，在资料库查看' }).click();
  await expect(detail.locator('.cal99-action-status[role=status]')).toHaveText('资料库暂时无法打开「测试奖励」。');
  await harness('setOpenItem', true);
  await harness('takeCalls');
  await cal.getByRole('button', { name: '关闭日历' }).click();
  expect(await harness('takeCalls')).toEqual([['close']]);
  pass('资料库无法打开时显示状态讯息；关闭只经 close 能力');

  // 13. update() refreshes the countdown and keeps the DOM, the focus and the open source panels.
  await harness('mount', 'spring');
  await harness('setNow', Date.parse('2026-10-26T00:00:00.000Z'));
  await harness('update');
  await day(101).click();
  await detail.locator('.cal99-evidence summary').first().click();
  const before = await cal.locator('.cal99-countdown').textContent();
  await page.evaluate(() => { window.__focused = document.activeElement; window.__root = document.querySelector('#slot .cal99-grid'); scrollTo(0, 120); });
  const usageBefore = await harness('usage');
  const scrolled = await scrollState();
  await harness('takeOperations');
  await harness('setNow', Date.parse('2026-10-31T00:00:00.000Z'));
  await harness('update');
  const after = await cal.locator('.cal99-countdown').textContent();
  expect(before).toBe('168时 0分后结束');
  expect(after).toBe('48时 0分后结束');
  expect(await page.evaluate(() => document.activeElement === window.__focused && document.querySelector('#slot .cal99-grid') === window.__root)).toBe(true);
  await expect(detail.locator('.cal99-evidence').first()).toHaveAttribute('open', '');
  expect(await scrollState()).toEqual(scrolled);
  // Focus in the host stays in the host.
  await page.locator('#host-probe').focus();
  await harness('setNow', Date.parse('2026-11-03T00:00:00.000Z'));
  await harness('update');
  await expect(page.locator('#host-probe')).toBeFocused();
  await expect(cal.locator('.cal99-deadline')).toHaveClass(/is-ended/);
  await expect(cal.locator('.cal99-countdown')).toHaveText('已结束');
  expect(await scrollState()).toEqual(scrolled);
  expect(await harness('takeOperations')).toEqual([]);
  expect(await harness('usage')).toEqual(usageBefore);
  pass('时间推进的 update() 只刷新倒数：不重建画面、不滚动、不抢焦点，焦点与已展开的来源面板保留；不操作会话、不写存储、不重读来源');

  // 13b. When the session changed outside the view, update() draws it: day, month and season, with the grid, the month
  // buttons and the detail agreeing with the session. Focus inside the calendar follows without scrolling; host focus stays.
  await page.evaluate(() => scrollTo(0, 0));
  await harness('setNow', Date.parse('2026-10-28T06:00:00.000Z'));
  await harness('mount', 'spring');
  await cal.locator('[data-calendar-month="4"]').click();
  await day(101).click();
  await harness('takeOperations');
  const external = await harness('usage');
  expect(await harness('external', 'selectDay', 104)).toEqual({ seasonIndex: 0, monthIndex: 0, ordinal: 104 });
  await expect(day(101)).toHaveAttribute('aria-pressed', 'true');
  const quiet = await scrollState();
  expect(await harness('update')).toBe(true);
  await expect(cal.locator('.cal99-day[aria-pressed=true]')).toHaveCount(1);
  await expect(day(104)).toHaveAttribute('aria-pressed', 'true');
  await expect(day(104)).toHaveAttribute('tabindex', '0');
  await expect(detail.locator('.cal99-detail-top h3')).toHaveText('4 月 14 日');
  await expect(detail.locator('.cal99-event-title h4')).toHaveText('煞调变 · 三选一');
  await expect(day(104)).toBeFocused();
  expect(await scrollState()).toEqual(quiet);
  expect(await harness('selection')).toEqual({ seasonIndex: 0, monthIndex: 0, ordinal: 104 });
  // The one store write is the external selectDay; update() itself neither operates, writes nor reads the source.
  expect(await harness('takeOperations')).toEqual([]);
  expect(await harness('usage')).toEqual({ ...external, writes: external.writes + 1 });
  await page.evaluate(() => { window.__grid = document.querySelector('#slot .cal99-grid'); });
  expect(await harness('update')).toBe(true);
  expect(await page.evaluate(() => document.querySelector('#slot .cal99-grid') === window.__grid)).toBe(true);
  // Month, with focus in the host this time.
  await page.locator('#host-probe').focus();
  expect(await harness('external', 'selectMonth', 1)).toEqual({ seasonIndex: 0, monthIndex: 1, ordinal: null });
  await harness('update');
  await expect(cal.locator('[data-calendar-month="5"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(cal.locator('[data-calendar-month="4"]')).toHaveAttribute('aria-pressed', 'false');
  await expect(cal.locator('.cal99-day')).toHaveCount(31);
  await expect(cal.locator('.cal99-day[aria-pressed=true]')).toHaveCount(0);
  await expect(detail.locator('.cal99-detail-top h3')).toHaveText('尚未选择日期');
  await expect(page.locator('#host-probe')).toBeFocused();
  await harness('external', 'selectDay', 130);
  await harness('update');
  await expect(day(130)).toHaveAttribute('aria-pressed', 'true');
  await expect(detail.locator('.cal99-detail-top h3')).toHaveText('5 月 10 日');
  await expect(page.locator('#host-probe')).toBeFocused();
  // Season, with focus on the season picker.
  await harness('mount', 'seasons');
  await cal.locator('.cal99-season-picker').focus();
  expect(await harness('external', 'selectSeason', 1)).toEqual({ seasonIndex: 1, monthIndex: 0, ordinal: null });
  await harness('update');
  await expect(cal.locator('.cal99-season-title')).toContainText('夏季');
  await expect(cal.locator('.cal99-season-picker')).toHaveValue('1');
  await expect(cal.locator('.cal99-season-picker')).toBeFocused();
  await expect(cal.locator('[data-calendar-month]')).toHaveText(['7月', '8月', '9月']);
  await harness('external', 'selectSeason', 0);
  await harness('update');
  await expect(cal.locator('.cal99-season-title')).toContainText('春季');
  await expect(cal.locator('[data-calendar-month]')).toHaveText(['4月', '5月', '6月']);
  expect(await harness('takeOperations')).toEqual([]);
  // After destroy, update() does nothing, even with a changed session.
  expect(await harness('destroyedUpdate')).toEqual({ drawn: 1, children: 0, error: null });
  pass('会话在画面外改变时 update() 同步日期格、月份按钮、季度与详情；焦点在日历内随之移动不滚动，在宿主时不被夺走；destroy 后 update() 无作用');

  // 14. Destroy removes the DOM and the listeners; mounting again never stacks views.
  await harness('mount', 'spring');
  await harness('mount', 'winter');
  await expect(page.locator('#slot .cal99')).toHaveCount(1);
  await page.evaluate(() => { window.__old = document.querySelector('#slot .cal99'); });
  await harness('takeOperations');
  await harness('unmount');
  await expect(page.locator('#slot').locator('*')).toHaveCount(0);
  await page.evaluate(() => { window.__old.querySelector('[data-calendar-day="3"]').click(); window.__old.querySelector('[data-calendar-month="2"]').click(); });
  expect(await harness('takeOperations')).toEqual([]);
  expect(await harness('update')).toBe(false);
  expect(await harness('timers')).toEqual([]);
  pass('卸载移除 DOM 与监听，旧画面不再操作会话；重复挂载只保留一个画面；整个检查未建立计时器');

  // 15. Styles: the calendar keeps its own look inside a dark host, and leaves the host alone.
  await harness('mount', 'spring');
  await cal.locator('[data-calendar-month="4"]').click();
  await page.mouse.move(0, 0);
  await page.evaluate(() => document.body.classList.add('dark'));
  const styles = await page.evaluate(() => {
    const probe = getComputedStyle(document.getElementById('host-probe')), small = getComputedStyle(document.getElementById('host-small'));
    const root = getComputedStyle(document.querySelector('#slot .cal99')), month = getComputedStyle(document.querySelector('#slot .cal99-month:not(.is-selected)'));
    const icon = document.querySelector('#slot .cal99-day > .cal99-icon').getBoundingClientRect();
    const sheet = [...document.styleSheets].find(value => value.href?.endsWith('/presentation/calendar.css'));
    const selectors = [];
    const walk = rules => { for (const rule of rules) { if (rule.selectorText) selectors.push(rule.selectorText); if (rule.cssRules) walk(rule.cssRules); } };
    walk(sheet.cssRules);
    return { probe: [probe.borderRadius, probe.paddingTop, probe.backgroundColor], small: small.letterSpacing,
      calendar: [root.color, root.backgroundColor], month: [month.borderRadius, month.backgroundColor],
      icon: Math.round(icon.width), outside: selectors.filter(value => value.split(',').some(part => !part.trim().startsWith('.cal99'))) };
  });
  expect(styles).toEqual({ probe: ['8px', '9px', 'rgb(27, 37, 48)'], small: '1.6px', calendar: ['rgb(38, 50, 46)', 'rgb(217, 220, 207)'],
    month: ['0px', 'rgb(220, 222, 209)'], icon: 36, outside: [] });
  await shot('calendar-dark-host');
  await page.evaluate(() => document.body.classList.remove('dark'));
  pass('深色宿主下日历维持浅色桌面；宿主按钮与小字不受日历样式影响；样式规则全部限定于 .cal99');

  // Comparison shots: the same spring data and container widths as the MVP baseline pictures 文档/图示/1999日历-对照-MVP-*.png
  // (文档/深入/48 · 第八节). They are for people to compare; nothing is diffed automatically.
  await harness('mount', 'spring');
  await cal.locator('[data-calendar-month="4"]').click();
  for (const [name, width] of [['wide', 1400], ['narrow', 600]]) {
    await page.evaluate(width => { document.getElementById('slot').style.width = width + 'px'; }, width);
    for (const ordinal of [104, 101]) {
      await day(ordinal).click();
      await page.mouse.move(0, 0);
      await cal.screenshot({ path: path.join(output, `compare-new-${name}-${ordinal}.png`) });
    }
  }
  await page.evaluate(() => { document.getElementById('slot').style.width = ''; });
  pass('对照截图：春季资料，1400px 与 600px 容器，4 月 14 日与 4 月 11 日');

  // 16. Only the calendar's own files were requested; no page error.
  expect(unexpected).toEqual([]);
  expect([...served].every(file => PAGE_FILE_PREFIXES.some(prefix => file.startsWith(prefix)))).toBe(true);
  expect(errors).toEqual([]);
  pass(`只请求日历功能、夹具与测试资料（${served.size} 个文件），无其他请求、无页面错误`);

  await fs.writeFile(path.join(output, 'report.json'), JSON.stringify({ ok: true, checks, served: [...served].sort(), errors, unexpected }, null, 2));
} catch (error) {
  process.exitCode = 1;
  console.error(error);
  await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true }).catch(() => {});
  await fs.writeFile(path.join(output, 'report.json'), JSON.stringify({ ok: false, checks, error: String(error?.stack ?? error), errors, unexpected }, null, 2));
} finally {
  await browser.close();
}
