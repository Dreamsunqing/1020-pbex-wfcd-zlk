import { buildCalendarViewModel } from '../application/view-model.mjs';
import { calendarIcon } from './icons.js';

// Calendar view (CAL-08): the native DOM CalendarViewFactory. It draws the model that application/view-model.mjs builds
// from the session state and sends every user action back to the session; it keeps the look and the operations of the
// MVP desktop calendar.
//
// Rules, also listed in 文档/深入/48-1999日历画面重整与应用操作接入.md:
// - No calendar rule lives here. Cells, the selected day, unmapped entries and keyboard moves come from the session and
//   the model; the view only formats them. Clicks and keys both go through a session operation, then repaint the same way.
// - The view only uses the capabilities it is handed: the guarded copy of the mount. It reaches no global document,
//   creates no timer and reads no clock; countdowns ask formatDeadline with capabilities.now() on paint and on update().
// - update() draws the session as it is now. Within one session only the selection can change; when it changed outside
//   this view, update() repaints without scrolling, and focus that was inside the calendar moves to the element playing
//   the same part. Otherwise it only refreshes the countdown and keeps the DOM, so focus and open source panels survive
//   the host beat. update() never calls an operation, so it never changes the selection or writes the store.
// - After a user action the new focus is brought into view in its nearest scrolling containers, and only as far as
//   needed. Which day a key reaches, across months included, is decided by session.move(); the view only follows it.
// - destroy() removes the listeners and the generated DOM, drops pending pictures and is idempotent. Mounting again into
//   the same container destroys the previous view first. Nothing measures layout, so the container may be detached.
// - The selected day is told by aria-pressed, a heavier frame and a corner mark, never by colour alone. A selection is a
//   date being viewed: rewards are candidates and the view never suggests personal progress, a claim or a choice made.
// - Stale, sample and imported snapshots say so above the calendar, so an old schedule never passes for the current one.

const WEEKDAYS = Object.freeze(['日', '一', '二', '三', '四', '五', '六']);
// Display labels belong to presentation (ADR-005). "待办" and similar wording is avoided: a day is a schedule, not a task.
const KINDS = Object.freeze({
  challenge: Object.freeze({ label: '挑战', short: '挑战', icon: 'challenge', term: '挑战' }),
  reward: Object.freeze({ label: '候选奖励', short: '奖励', icon: 'reward', term: '内容' }),
  upgrade: Object.freeze({ label: '煞调变 · 三选一', short: '煞调变', icon: 'upgrade', term: '选项' }),
  // Terms of a mixed entry carry no kind of their own (TermRef), so they are numbered as plain content, never as options.
  mixed: Object.freeze({ label: '综合事件', short: '综合', icon: 'mixed', term: '内容' }),
  other: Object.freeze({ label: '其他事件', short: '事件', icon: 'mixed', term: '内容' })
});
// Explanations after an entry's terms. A pure upgrade entry is three options; a mixed entry only may hold one, and the
// view never guesses which of its terms they are from names, text or evidence.
const ENTRY_NOTES = Object.freeze({
  upgrade: '三个选项均为预览；实际选择请在游戏内完成，本页不记录任何选择。',
  mixed: '此处仅预览公开事件。若包含煞调变，候选效果以游戏内三选一为准；本页不记录个人选择或完成进度。'
});
const LEGEND = Object.freeze(['challenge', 'reward', 'upgrade']);
const SERVERS = Object.freeze({ de: '国际服 DE', wg: '国服 WG' });
const MISSING = Object.freeze({ status: 'missing' });
const views = new WeakMap();
let instances = 0;

const pad = value => String(value).padStart(2, '0');
// The model writes dates as YYYY-MM-DD; the view only formats them.
const dateParts = date => date.split('-').slice(1).map(Number);
const daySelector = ordinal => `[data-calendar-day="${ordinal}"]`;
const linked = reward => typeof reward.libraryId === 'string' && reward.libraryId !== '';

function sourceLabel(status) {
  if (status.sourceKind === 'sample') return '离线样本';
  if (status.sourceKind === 'import') return '导入快照';
  return status.stale ? '缓存快照' : '实时快照';
}

function snapshotNotice(status) {
  if (status.sourceKind === 'sample') return '离线样本：仅供预览，不代表目前的排程。';
  if (status.sourceKind === 'import') return '导入快照：排程以快照时间为准，可能不是目前的排程。';
  return status.stale ? '快照已过期：以下是快照当时的排程，目前可能已经改变。' : null;
}

function dayLabel(month, cell) {
  const kind = cell.kind ? KINDS[cell.kind].label : cell.listed ? '上游列出，没有事件内容' : '未列出事件';
  return `${month}月${cell.day}日 星期${WEEKDAYS[cell.weekday]}，${kind}${cell.entryCount > 1 ? `，${cell.entryCount} 笔事件` : ''}`;
}

/**
 * The calendar presentation. See CalendarViewFactory and CalendarViewHandle in ../application/ports.mjs.
 * @param {Element} container  Receives the calendar root; nothing else in it is touched.
 * @param {{session: import('../application/ports.mjs').CalendarOperations,
 *   capabilities: import('../application/ports.mjs').CalendarCapabilities}} deps
 * @returns {import('../application/ports.mjs').CalendarViewHandle}
 */
export function createCalendarView(container, { session, capabilities } = {}) {
  const doc = container?.ownerDocument;
  if (!doc || typeof container.append !== 'function') throw new TypeError('Calendar view needs a DOM element as its container');
  if (typeof session?.read !== 'function') throw new TypeError('Calendar view needs a session from createCalendarSession');
  if (capabilities === null || typeof capabilities !== 'object') throw new TypeError('Calendar view needs the calendar capabilities');
  views.get(container)?.destroy();

  const uid = `cal99-${++instances}`;
  const open = new Set();
  const art = new Map();
  const asked = new Set();
  let model = null;
  let destroyed = false;

  const el = (tag, className, text) => {
    const node = doc.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = String(text);
    return node;
  };
  const button = (className, text, action, data = {}) => {
    const node = el('button', className, text);
    node.type = 'button';
    node.dataset.action = action;
    for (const [key, value] of Object.entries(data)) node.dataset[key] = String(value);
    return node;
  };
  const icon = kind => calendarIcon(doc, kind);

  const root = el('section', 'cal99');
  root.setAttribute('aria-label', '1999 日历');

  function titlebar() {
    const bar = el('div', 'cal99-titlebar');
    const title = el('div', 'cal99-app-title');
    title.append(icon('mixed'), el('strong', '', '日历'), el('span', 'cal99-app-code', 'POM-2 / 1999'));
    const close = button('cal99-close', '×', 'close');
    close.setAttribute('aria-label', '关闭日历');
    close.title = '关闭日历';
    bar.append(title, close);
    return bar;
  }

  function notice() {
    const text = snapshotNotice(model.status);
    if (!text) return [];
    const row = el('p', 'cal99-notice', text);
    row.setAttribute('role', 'note');
    return [row];
  }

  function statusbar() {
    const { status } = model;
    const bar = el('div', 'cal99-statusbar');
    const source = el('span', '', `${SERVERS[status.server] ?? status.server} · ${sourceLabel(status)} · 快照日期 ${status.sourceTime.slice(0, 10)}（UTC）`);
    source.title = status.sourceTime;
    bar.append(source, el('span', '', '排程预览 · 不含个人完成进度'));
    return bar;
  }

  function heading() {
    const season = model.activeSeason;
    const head = el('div', 'cal99-heading');
    const copy = el('div', 'cal99-season');
    const title = el('h3', 'cal99-season-title');
    title.append(el('strong', '', '1999'), el('span', '', season.label || season.code));
    const ornament = el('div', 'cal99-ornament');
    ornament.setAttribute('aria-hidden', 'true');
    ornament.append(icon('flower'), el('span', '', '✦ · ✧ ·'), icon('flower'), el('span', '', '· ✧ · ✦'));
    copy.append(title, ornament);
    if (model.seasonOptions.length > 1) {
      const picker = el('select', 'cal99-season-picker');
      picker.dataset.action = 'season';
      picker.setAttribute('aria-label', '选择季度');
      model.seasonOptions.forEach((option, index) => {
        const choice = el('option', '', `${option.label || '未命名季度'} · 轮回 ${option.yearIteration}`);
        choice.value = String(index);
        picker.append(choice);
      });
      picker.value = String(model.activeSeasonIndex);
      copy.append(picker);
    }
    const controls = el('div', 'cal99-month-controls');
    if (model.monthTabs.length) {
      const months = el('div', 'cal99-months');
      months.setAttribute('role', 'group');
      months.setAttribute('aria-label', '当季月份');
      model.monthTabs.forEach((tab, index) => {
        const choice = button('cal99-month' + (tab.selected ? ' is-selected' : ''), `${tab.month}月`, 'month', { index, calendarMonth: tab.month });
        choice.setAttribute('aria-pressed', String(tab.selected));
        choice.setAttribute('aria-label', `${tab.month}月，${tab.eventDays ? `${tab.eventDays} 个事件日` : '没有事件日'}`);
        choice.append(icon('mixed'));
        months.append(choice);
      });
      controls.append(months);
    }
    const deadline = el('div', 'cal99-deadline');
    deadline.append(el('span', '', '换季：'), el('span', 'cal99-countdown'));
    controls.append(deadline);
    head.append(copy, controls);
    return head;
  }

  function grid() {
    const { month, cells } = model.grid;
    const box = el('div', 'cal99-grid');
    box.setAttribute('role', 'group');
    box.setAttribute('aria-label', `1999 年 ${month} 月日期`);
    for (const weekday of WEEKDAYS) {
      const head = el('div', 'cal99-weekday', '星期' + weekday);
      head.setAttribute('aria-hidden', 'true');
      box.append(head);
    }
    // One tab stop for the whole month: the selected day, or the first day when none is selected. Arrows do the rest.
    const entry = cells.find(cell => cell?.selected) ?? cells.find(Boolean);
    for (const cell of cells) {
      if (!cell) {
        const blank = el('div', 'cal99-blank');
        blank.setAttribute('aria-hidden', 'true');
        box.append(blank);
        continue;
      }
      const kind = cell.kind ? KINDS[cell.kind] : null;
      const classes = ['cal99-day', kind && 'has-event', cell.listed && 'is-listed', cell.selected && 'is-selected'].filter(Boolean).join(' ');
      const day = button(classes, undefined, 'day', { ordinal: cell.ordinal, calendarDay: cell.ordinal, date: cell.date });
      if (cell.kind) day.dataset.eventKind = cell.kind;
      day.tabIndex = cell === entry ? 0 : -1;
      day.setAttribute('aria-pressed', String(cell.selected));
      day.setAttribute('aria-label', dayLabel(month, cell));
      day.append(el('span', 'cal99-day-number', cell.day));
      if (kind) day.append(icon(kind.icon), el('span', 'cal99-day-label', kind.short));
      else if (cell.listed) day.append(el('span', 'cal99-day-listed'));
      if (cell.entryCount > 1) day.append(el('span', 'cal99-day-count', `×${cell.entryCount}`));
      box.append(day);
    }
    return box;
  }

  function legend() {
    const box = el('div', 'cal99-legend');
    for (const kind of LEGEND) {
      const item = el('span');
      item.append(icon(KINDS[kind].icon), el('span', '', KINDS[kind].short));
      box.append(item);
    }
    const selected = el('span');
    selected.append(el('span', 'cal99-legend-swatch'), el('span', '', '粗框：正在查看'));
    box.append(selected, el('span', 'cal99-legend-hint', '点选日期查看内容'));
    return box;
  }

  function applyArt(slot, result) {
    slot.classList.remove('is-loading', 'is-missing');
    if (result?.status === 'found') {
      const image = el('img', 'cal99-reward-image');
      image.alt = '';
      image.decoding = 'async';
      image.onerror = () => applyArt(slot, MISSING);
      image.src = result.src;
      slot.replaceChildren(image);
      slot.removeAttribute('title');
      return;
    }
    slot.replaceChildren(icon('reward'));
    slot.classList.add(result ? 'is-missing' : 'is-loading');
    if (result) slot.title = '暂无图片';
  }

  function requestArt(key, reward) {
    asked.add(key);
    const settle = result => {
      if (destroyed) return;
      art.set(key, result?.status === 'found' ? result : MISSING);
      for (const slot of root.querySelectorAll('.cal99-reward-art[data-art-id]')) if (slot.dataset.artId === key) applyArt(slot, art.get(key));
    };
    // The guarded copy never rejects; the second handler only keeps a view used without the mount from leaking a rejection.
    capabilities.loadArt({ id: reward.id, libraryId: linked(reward) ? reward.libraryId : null }).then(settle, () => settle(MISSING));
  }

  function artSlot(reward) {
    const slot = el('span', 'cal99-reward-art');
    // Every reward asks for its picture by its full ID and its library target, and the host decides where the picture
    // comes from (CAL-10): a reward without a library target can still have one. The jump depends on libraryId alone.
    // Until the answer arrives, and when there is none, the slot keeps the code-native placeholder (HANDOFF-01).
    const key = JSON.stringify([reward.id, linked(reward) ? reward.libraryId : null]);
    slot.dataset.artId = key;
    applyArt(slot, art.get(key));
    if (!art.has(key) && !asked.has(key)) requestArt(key, reward);
    return slot;
  }

  function rewardView(reward, source, entryIndex, rewardIndex) {
    const card = linked(reward)
      ? button('cal99-reward is-linked', undefined, 'item', { source, entry: entryIndex, reward: rewardIndex })
      : el('div', 'cal99-reward');
    card.dataset.itemId = reward.id;
    card.title = reward.id;
    const name = el('strong', 'cal99-reward-name');
    capabilities.renderText(name, reward.name || reward.id, 'name');
    card.append(name);
    if (Number.isInteger(reward.quantity)) card.append(el('span', 'cal99-reward-quantity', `×${reward.quantity}`));
    card.append(el('span', 'cal99-reward-hint', linked(reward) ? '资料库 →' : '资料库未收录'), artSlot(reward));
    if (linked(reward)) card.setAttribute('aria-label', `${name.textContent}，在资料库查看`);
    return card;
  }

  function termView(term, index, kind) {
    const offer = el('article', 'cal99-offer');
    offer.append(el('span', 'cal99-offer-index', `${KINDS[kind].term} ${pad(index + 1)}`));
    const name = el('h5');
    capabilities.renderText(name, term.name, 'name');
    offer.append(name);
    if (term.description) {
      const description = el('p');
      capabilities.renderText(description, term.description, 'description');
      offer.append(description);
    }
    if (term.source) offer.title = '翻译来源：' + term.source;
    return offer;
  }

  function evidenceView(entry, key) {
    const details = el('details', 'cal99-evidence');
    details.dataset.key = key;
    details.open = open.has(key);
    details.append(el('summary', '', '资料来源与原始事件'));
    if (entry.rewards.length) {
      // Full item IDs stay readable even when a card shows only the name.
      const ids = el('ul', 'cal99-evidence-ids');
      for (const reward of entry.rewards) ids.append(el('li', '', `${reward.name || '未命名物品'}：${reward.id}`));
      details.append(el('p', 'cal99-evidence-label', '完整物品 ID'), ids);
    }
    details.append(el('pre', '', JSON.stringify(entry.evidence, null, 2)));
    return details;
  }

  function entryView(entry, index, count, source, key) {
    const kind = KINDS[entry.kind];
    const article = el('article', 'cal99-entry');
    article.dataset.entryKind = entry.kind;
    if (count > 1 || source === 'unmapped') {
      const title = el('h5', 'cal99-entry-title');
      const text = source === 'unmapped'
        ? `${entry.title || '未命名事件'} · 原始日序 ${entry.ordinal ?? '缺失'} · ${kind.label}`
        : `事件 ${pad(index + 1)} · ${kind.label}`;
      title.append(icon(kind.icon), el('span', '', text));
      article.append(title);
    }
    if (entry.rewards.length) {
      const intro = (source === 'day' ? '本日' : '') + '公开的候选奖励' + (entry.rewards.some(linked) ? ' · 点选物品查看资料库' : '');
      const list = el('div', 'cal99-rewards');
      entry.rewards.forEach((reward, rewardIndex) => list.append(rewardView(reward, source, index, rewardIndex)));
      article.append(el('p', 'cal99-intro', intro), list);
    }
    entry.terms.forEach((term, termIndex) => article.append(termView(term, termIndex, entry.kind)));
    if (Object.hasOwn(ENTRY_NOTES, entry.kind)) article.append(el('p', 'cal99-detail-note', ENTRY_NOTES[entry.kind]));
    article.append(evidenceView(entry, key));
    return article;
  }

  function unmappedView() {
    const { unmapped } = model;
    const details = el('details', 'cal99-evidence cal99-unmapped');
    details.dataset.key = 'unmapped';
    details.open = open.has('unmapped');
    details.append(el('summary', '', `${unmapped.length} 笔事件的日期无法对应本季，已原样保留`));
    unmapped.forEach((entry, index) => details.append(entryView(entry, index, unmapped.length, 'unmapped', `unmapped-${index}`)));
    return details;
  }

  function detail() {
    const section = el('section', 'cal99-detail');
    const day = model.selectedDay;
    const top = el('div', 'cal99-detail-top');
    // The panel is named by its date heading, so whatever the panel shows, it is read as the detail of that date.
    const dateHeading = el('h3');
    dateHeading.id = `${uid}-date`;
    section.setAttribute('aria-labelledby', dateHeading.id);
    top.append(el('span', 'cal99-kicker', 'SELECTED DATE / 所选日期'), dateHeading);
    section.append(top);
    if (!day) {
      dateHeading.textContent = '尚未选择日期';
      top.append(el('p', '', '点选日期查看当天内容。'));
    } else {
      const [month, date] = dateParts(day.date);
      dateHeading.textContent = `${month} 月 ${date} 日`;
      top.append(el('p', '', `星期${WEEKDAYS[day.weekday]} · 游戏日 ${day.ordinal}`));
      const kind = day.kind ? KINDS[day.kind] : null;
      const title = el('div', 'cal99-event-title');
      title.append(icon(kind?.icon ?? 'mixed'), el('h4', '', kind ? kind.label : '没有列出的事件'));
      if (day.entries.length > 1) title.append(el('span', 'cal99-event-count', `${day.entries.length} 笔事件`));
      section.append(title);
      if (!day.entries.length) {
        section.append(el('p', 'cal99-empty', day.listed ? '上游列有这个日期，但没有提供事件内容。' : '这份快照未在这一天列出事件，请选择有图示的日期查看。'));
      }
      day.entries.forEach((entry, index) => section.append(entryView(entry, index, day.entries.length, 'day', `day-${day.ordinal}-${index}`)));
    }
    if (model.unmapped.length) section.append(unmappedView());
    return section;
  }

  function unmappedSeason() {
    const { activeSeason: season, unmapped } = model;
    const section = el('section', 'cal99-detail');
    section.setAttribute('aria-label', '未对应日期的事件');
    section.append(el('p', 'cal99-empty', unmapped.length
      ? `这个季度（${season.code || '未知代码'}）还没有日期对应规则，以下按原始顺序保留全部 ${unmapped.length} 笔事件。`
      : `这个季度（${season.code || '未知代码'}）还没有日期对应规则，也没有事件。`));
    unmapped.forEach((entry, index) => section.append(entryView(entry, index, unmapped.length, 'unmapped', `unmapped-${index}`)));
    return section;
  }

  function workspace() {
    const box = el('div', 'cal99-workspace');
    if (!model.seasonOptions.length) {
      box.classList.add('is-single');
      box.append(el('p', 'cal99-empty', '这份快照没有可用的 1999 日历。'));
      return box;
    }
    const calendar = el('div', 'cal99-calendar');
    calendar.append(heading());
    if (!model.grid) {
      box.classList.add('is-single');
      box.append(calendar, unmappedSeason());
      return box;
    }
    calendar.append(grid(), legend());
    box.append(calendar, detail());
    return box;
  }

  function syncDeadline() {
    const box = root.querySelector('.cal99-deadline');
    const season = model?.activeSeason;
    if (!box || !season) return;
    const { text, ended } = capabilities.formatDeadline(season.startsAt, season.endsAt, capabilities.now());
    box.hidden = !text;
    box.classList.toggle('is-ended', ended);
    box.title = `${season.startsAt} — ${season.endsAt}`;
    box.querySelector('.cal99-countdown').textContent = text;
  }

  function draw(next, focus, { reveal }) {
    model = next;
    root.replaceChildren(titlebar(), ...notice(), workspace(), statusbar());
    syncDeadline();
    const selector = typeof focus === 'function' ? focus() : focus;
    const target = selector ? root.querySelector(selector) : null;
    if (!target) return;
    target.focus({ preventScroll: true });
    // "nearest" leaves a visible element where it is and scrolls a hidden one just enough, in every scrolling ancestor.
    if (reveal) target.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
  }
  // The state is only ever handed to the model builder; focus targets are read from the new model.
  const paint = (state, focus) => draw(buildCalendarViewModel(state), focus, { reveal: true });
  const selectedDay = () => model.selectedDay && daySelector(model.selectedDay.ordinal);
  const TAB_STOP = '.cal99-day[tabindex="0"]';
  // The selection a model shows. Within a session nothing else changes, so equal selections draw the same calendar.
  const shownSelection = value => [value.activeSeasonIndex, value.monthTabs.findIndex(tab => tab.selected), value.selectedDay?.ordinal ?? null].join();

  // Where focus goes when update() repaints. Focus elsewhere in the host is never taken; focus inside the calendar moves to
  // the element that plays the same part in the new DOM, or else to the month's tab stop or the close button.
  function refocus() {
    const active = doc.activeElement;
    if (!active || !root.contains(active)) return null;
    const { action, index, source, entry, reward } = active.dataset ?? {};
    const key = active.tagName === 'SUMMARY' ? active.parentElement?.dataset.key : undefined;
    const same = action === 'day' ? TAB_STOP
      : action === 'month' ? `[data-action="month"][data-index="${index}"]`
      : action === 'season' ? '.cal99-season-picker'
      : action === 'close' ? '.cal99-close'
      : action === 'item' ? `[data-action="item"][data-source="${source}"][data-entry="${entry}"][data-reward="${reward}"]`
      : key ? `details[data-key="${key}"] > summary`
      : null;
    return () => [same, TAB_STOP, '.cal99-close'].find(selector => selector && root.querySelector(selector));
  }

  function showStatus(text) {
    const detailPanel = root.querySelector('.cal99-detail');
    if (!detailPanel) return;
    let status = detailPanel.querySelector('.cal99-action-status');
    if (!status) {
      status = el('p', 'cal99-action-status');
      status.setAttribute('role', 'status');
      const top = detailPanel.querySelector('.cal99-detail-top');
      if (top) top.after(status);
      else detailPanel.prepend(status);
    }
    status.textContent = text;
  }

  function openReward(target) {
    const { source, entry, reward } = target.dataset;
    const entries = source === 'unmapped' ? model.unmapped : model.selectedDay?.entries ?? [];
    const ref = entries[Number(entry)]?.rewards[Number(reward)];
    if (!ref) return;
    // false means the host cannot open it now; true means the host took over, and reports a later failure itself.
    if (!capabilities.openItem(ref)) showStatus(`资料库暂时无法打开「${target.querySelector('.cal99-reward-name')?.textContent || ref.id}」。`);
  }

  function onClick(event) {
    const target = event.target?.closest?.('[data-action]');
    if (!target || !root.contains(target)) return;
    const { action } = target.dataset;
    if (action === 'close') capabilities.close();
    else if (action === 'month') paint(session.selectMonth(Number(target.dataset.index)), `[data-action="month"][data-index="${target.dataset.index}"]`);
    else if (action === 'day') paint(session.selectDay(Number(target.dataset.ordinal)), selectedDay);
    else if (action === 'item') openReward(target);
  }

  function onKeyDown(event) {
    if (event.target?.dataset?.action !== 'day' || event.altKey || event.ctrlKey || event.metaKey) return;
    // Enter and Space reach onClick as the button's own click; the session decides every other key.
    if (!session.move(event.key)) return;
    event.preventDefault();
    paint(session.read(), selectedDay);
  }

  function onChange(event) {
    const target = event.target;
    if (target?.dataset?.action !== 'season' || !root.contains(target)) return;
    paint(session.selectSeason(Number(target.value)), '.cal99-season-picker');
  }

  function onToggle(event) {
    const key = event.target?.dataset?.key;
    if (event.target?.tagName !== 'DETAILS' || !key) return;
    if (event.target.open) open.add(key);
    else open.delete(key);
  }

  root.addEventListener('click', onClick);
  root.addEventListener('keydown', onKeyDown);
  root.addEventListener('change', onChange);
  // toggle does not bubble, so it is caught on the way down.
  root.addEventListener('toggle', onToggle, true);
  paint(session.read());
  container.append(root);

  const handle = Object.freeze({
    update() {
      if (destroyed) return;
      const next = buildCalendarViewModel(session.read());
      if (shownSelection(next) === shownSelection(model)) syncDeadline();
      else draw(next, refocus(), { reveal: false });
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      root.removeEventListener('click', onClick);
      root.removeEventListener('keydown', onKeyDown);
      root.removeEventListener('change', onChange);
      root.removeEventListener('toggle', onToggle, true);
      root.remove();
      art.clear();
      asked.clear();
      open.clear();
      model = null;
      if (views.get(container) === handle) views.delete(container);
    }
  });
  views.set(container, handle);
  return handle;
}
