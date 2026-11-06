import { createCalendarMount, createCalendarSession, createCalendarView, createMemorySelectionStore } from '../../../src/features/calendar-1999/index.mjs';
import { ART_MODES, CLOSE_MODES, DEFAULT_SETTINGS, OPEN_MODES, PORTRAIT_MODES, createFakeCapabilities } from './fake-capabilities.mjs';
import { DEFAULT_CLOCK, FIXTURE_DIR, SCENARIOS, SCENARIO_GROUPS, SERVERS, findScenario, findServer, loadScenario } from './scenarios.mjs';

// Standalone page of the 1999 calendar (CAL-09), for maintainers who work on the calendar view without the App. It is a
// small host: like src/ui/calendar-1999.js in the App, it mounts the real view through the public entry and the real
// mount, but with the fixed scenarios of scenarios.mjs and the fake capabilities of fake-capabilities.mjs.
// Start it with `npm run calendar:standalone`; 文档/深入/49-1999日历独立执行页面与测试资料.md describes every control.
//
// - Test data only. The banner, the frame label and the title say so, and every scenario file is marked as test data.
// - The page is the host. It owns one SelectionStore for the page, so servers and scenarios keep apart by contextId; the
//   clock, which only the controls change; and the beat: update() after each clock change. The calendar has no timer.
// - Choosing a scenario or a server builds a new source and session and mounts again, as a new snapshot does in the App.
//   Choosing a scenario also applies its capability preset and its clock. The old calendar is unmounted and a loading
//   note is shown first; only the latest choice is ever mounted.
// - Every control is kept in the URL, so a state can be reloaded or shared.

const THEMES = Object.freeze({ light: '浅色', dark: '深色' });
// The calendar stacks at 930px and compacts its grid at 560px of its own width (48 · 第六节).
const WIDTHS = Object.freeze([['auto', '自动（最宽 1400px）'], ['1400', '1400px'], ['900', '900px（上下排列）'], ['600', '600px'], ['500', '500px（精简日期格）'], ['360', '360px']]);
const KIND_LABELS = Object.freeze({ sample: '离线样本', network: '网络快照', import: '导入快照' });

const $ = id => document.getElementById(id);
const slot = $('slot');
const log = $('log');
const controls = { scenario: $('scenario'), server: $('server'), art: $('art'), portrait: $('portrait'), open: $('open'), close: $('close'), clock: $('clock'), theme: $('theme'), width: $('width') };

const settings = { ...DEFAULT_SETTINGS };
let scenario = SCENARIOS[0];
let server = SERVERS[0];
let now = Date.parse(DEFAULT_CLOCK);
let theme = 'light';
let width = 'auto';
// Counts every open, unmount and close, so a scenario that finishes loading after the user moved on is not mounted.
let ticket = 0;
let sequence = 0;

// One store for the page, as the App keeps one for its lifetime. The copy in `stored` only feeds the store panel.
let memory = createMemorySelectionStore();
const stored = new Map();
let currentContext = null;
const store = Object.freeze({
  read: key => memory.read(key),
  write(key, value) {
    memory.write(key, value);
    stored.set(key, { ...value });
    renderStore();
  }
});

const iso = value => new Date(value).toISOString();
const text = (tag, content, className) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.textContent = content;
  return node;
};

// kind: 'call' for capability calls, 'error' for failures the calendar absorbed, 'host' for what this page did.
function note(message, kind = 'call') {
  const item = text('li', message, `is-${kind}`);
  item.value = ++sequence;
  log.append(item);
  while (log.childElementCount > 200) log.firstElementChild.remove();
  log.scrollTop = log.scrollHeight;
  if (kind !== 'host') $('last-call').textContent = `最近的外部操作：${message}`;
}

const capabilities = createFakeCapabilities({
  settings,
  now: () => now,
  record([name, ...args]) {
    if (name === 'close') note(`close：日历请求关闭 → ${CLOSE_MODES[settings.close]}`);
    else if (name === 'openItem') note(`openItem：${args[0]}（资料库 ${args[1] ?? '无'}${args[2] ? ` · 版本 ${args[2]}` : ''}）→ ${OPEN_MODES[settings.openItem]}`);
    else if (name === 'loadArt') note(`loadArt：${args[0]}（资料库 ${args[1] ?? '无'}）→ ${ART_MODES[settings.art]}`);
    else if (name === 'loadPortrait') note(`loadPortrait：${args[0]} → ${PORTRAIT_MODES[settings.portrait]}`);
    // renderText runs for every name and description; listing it would bury the other calls.
  },
  // In the App, close() returns to the world-state page, which hides the calendar.
  onClose() {
    ticket++;
    mount.unmount();
    placeholder('closed', '日历已经由 close 能力关闭；在 App 中这会回到世界状态页。', '重新打开');
  }
});
const mount = createCalendarMount({
  view: createCalendarView,
  capabilities,
  onError: (error, where) => note(`${where} 失败，已由日历的能力副本吸收：${error?.message ?? error}`, 'error')
});

function setState(state) {
  const root = document.documentElement;
  root.dataset.state = state;
  root.dataset.scenario = scenario.id;
  root.dataset.server = server.id;
  $('frame-label').textContent = `测试资料 · ${scenario.title} · ${server.label} · 不是正式排程`;
}

function placeholder(state, message, action, details = []) {
  const box = document.createElement('div');
  box.className = 'sa-placeholder';
  box.append(text('p', message));
  if (details.length) {
    const list = document.createElement('ul');
    list.replaceChildren(...details.map(detail => text('li', detail)));
    box.append(list);
  }
  if (action) {
    const button = text('button', action);
    button.type = 'button';
    button.addEventListener('click', () => open(action));
    box.append(button);
  }
  if (state === 'failed') box.setAttribute('role', 'alert');
  if (state === 'loading') box.setAttribute('role', 'status');
  slot.replaceChildren(box);
  setState(state);
}

// While a scenario loads, the panel already names it, and says that its data is not there yet.
function describeLoading() {
  $('scenario-title').textContent = `${SCENARIO_GROUPS[scenario.group]} · ${scenario.title}`;
  $('scenario-summary').textContent = scenario.summary;
  $('scenario-facts').replaceChildren(text('dt', '测试资料'), text('dd', `载入中：${FIXTURE_DIR}${scenario.file}`));
}

function describe({ fixture, input }, data) {
  $('scenario-title').textContent = `${SCENARIO_GROUPS[scenario.group]} · ${scenario.title}`;
  $('scenario-summary').textContent = scenario.summary;
  const file = document.createElement('dd');
  file.append(text('code', FIXTURE_DIR + scenario.file), input === 'projection' ? '（宿主投影，经 createWorldStateCalendarSource 转换）' : '（CalendarDocument）');
  const preset = Object.entries(scenario.capabilities ?? {});
  const labels = { art: ['图片', ART_MODES], portrait: ['角色图', PORTRAIT_MODES], openItem: ['跳转', OPEN_MODES], close: ['关闭', CLOSE_MODES] };
  const facts = [
    ['测试资料', file],
    ['资料内容', fixture.description],
    ['快照', `${KIND_LABELS[data.kind]} · ${data.stale ? '已过期' : '未过期'} · 快照时间 ${data.sourceTime}${scenario.data ? '（本情境只改写快照状态）' : ''}`],
    ['伺服器', `${server.label}${server.id === 'de' ? '' : '（测试资料以 DE 写成，只替换伺服器与 contextId 的伺服器部分）'}`],
    ['预设能力', preset.length ? preset.map(([key, mode]) => `${labels[key][0]}：${labels[key][1][mode]}`).join(' · ') : '无，全部正常'],
    ['用途', fixture.notice]
  ];
  $('scenario-facts').replaceChildren(...facts.flatMap(([term, value]) => [text('dt', term), typeof value === 'string' ? text('dd', value) : value]));
}

async function open(reason = '挂载') {
  const mine = ++ticket;
  // The mounted calendar shows the previous scenario or server. It goes before anything loads, so the new labels never
  // sit next to a calendar that can still be used; a load that finishes after a newer choice is dropped by the ticket.
  mount.unmount();
  describeLoading();
  placeholder('loading', `正在载入「${scenario.title} · ${server.label}」的测试资料…`);
  let loaded;
  try {
    loaded = await loadScenario(scenario.id, { server: server.id });
  } catch (error) {
    if (mine === ticket) failed(error);
    return;
  }
  if (mine !== ticket) return;
  const snapshot = loaded.source.read();
  describe(loaded, snapshot.data);
  try {
    const session = createCalendarSession({ source: loaded.source, selectionStore: store });
    slot.replaceChildren();
    mount.mount(slot, session);
  } catch (error) {
    failed(error);
    return;
  }
  currentContext = snapshot.contextId;
  renderStore();
  setState('mounted');
  note(`${reason}：${scenario.title} · ${server.label}`, 'host');
}

function failed(error) {
  mount.unmount();
  const issues = Array.isArray(error?.issues) ? error.issues.map(issue => `${issue.path} ${issue.code}`) : [];
  placeholder('failed', `无法建立日历：${error?.message ?? error}`, '重试', issues);
  note(`情境载入失败：${error?.message ?? error}`, 'error');
}

function renderStore() {
  const list = $('store');
  if (stored.size === 0) {
    list.replaceChildren(text('li', '还没有写入：选日期、月份或季度后才会保存。'));
    return;
  }
  list.replaceChildren(...[...stored].map(([key, value]) => {
    const item = document.createElement('li');
    item.classList.toggle('is-current', key === currentContext);
    item.append(text('code', key), text('span', `季度序号 ${value.seasonIndex} · 月份序号 ${value.monthIndex} · 游戏日 ${value.ordinal ?? '未选'}${key === currentContext ? ' · 目前挂载' : ''}`));
    return item;
  }));
}

function renderClock() {
  $('clock-text').textContent = `${iso(now).slice(0, 16).replace('T', ' ')} UTC`;
  controls.clock.value = iso(now).slice(0, 16);
}

function setClock(value) {
  if (!Number.isFinite(value)) return;
  now = value;
  renderClock();
  syncUrl();
  note(`时钟设为 ${iso(now)}；${mount.update() ? '宿主调用 update() 刷新倒数' : '没有挂载中的日历'}`, 'host');
}

function applyPresets() {
  Object.assign(settings, DEFAULT_SETTINGS, scenario.capabilities);
  now = Date.parse(scenario.clock ?? DEFAULT_CLOCK);
}

function renderControls() {
  controls.scenario.value = scenario.id;
  for (const input of controls.server.querySelectorAll('input')) input.checked = input.value === server.id;
  controls.art.value = settings.art;
  controls.portrait.value = settings.portrait;
  controls.open.value = settings.openItem;
  controls.close.value = settings.close;
  controls.theme.value = theme;
  controls.width.value = width;
  document.body.classList.toggle('dark', theme === 'dark');
  slot.style.width = width === 'auto' ? '' : `${width}px`;
  renderClock();
}

function syncUrl() {
  const params = new URLSearchParams({ scenario: scenario.id, server: server.id, art: settings.art, portrait: settings.portrait, open: settings.openItem, close: settings.close, now: iso(now), theme, width });
  history.replaceState(null, '', `${location.pathname}?${params}`);
}

// The URL wins over the scenario preset; an invalid value falls back and says so.
function readUrl() {
  const params = new URLSearchParams(location.search);
  const pick = (name, valid, fallback) => {
    const value = params.get(name);
    if (value === null) return fallback;
    if (valid(value)) return value;
    note(`网址参数 ${name}=${value} 无效，改用默认值`, 'host');
    return fallback;
  };
  scenario = findScenario(pick('scenario', findScenario, SCENARIOS[0].id));
  server = findServer(pick('server', findServer, SERVERS[0].id));
  applyPresets();
  settings.art = pick('art', value => Object.hasOwn(ART_MODES, value), settings.art);
  settings.portrait = pick('portrait', value => Object.hasOwn(PORTRAIT_MODES, value), settings.portrait);
  settings.openItem = pick('open', value => Object.hasOwn(OPEN_MODES, value), settings.openItem);
  settings.close = pick('close', value => Object.hasOwn(CLOSE_MODES, value), settings.close);
  const clock = pick('now', value => /Z$/.test(value) && Number.isFinite(Date.parse(value)), null);
  if (clock) now = Date.parse(clock);
  theme = pick('theme', value => Object.hasOwn(THEMES, value), theme);
  width = pick('width', value => WIDTHS.some(([key]) => key === value), width);
}

function buildControls() {
  const fill = (select, entries) => select.replaceChildren(...entries.map(([value, label]) => new Option(label, value)));
  for (const [group, label] of Object.entries(SCENARIO_GROUPS)) {
    const optgroup = document.createElement('optgroup');
    optgroup.label = label;
    optgroup.append(...SCENARIOS.filter(row => row.group === group).map(row => new Option(row.title, row.id)));
    controls.scenario.append(optgroup);
  }
  for (const { id, label } of SERVERS) {
    const choice = document.createElement('label');
    choice.className = 'sa-choice';
    const input = Object.assign(document.createElement('input'), { type: 'radio', name: 'server', value: id });
    choice.append(input, label);
    controls.server.append(choice);
  }
  fill(controls.art, Object.entries(ART_MODES));
  fill(controls.portrait, Object.entries(PORTRAIT_MODES));
  fill(controls.open, Object.entries(OPEN_MODES));
  fill(controls.close, Object.entries(CLOSE_MODES));
  fill(controls.theme, Object.entries(THEMES));
  fill(controls.width, WIDTHS);

  controls.scenario.addEventListener('change', () => {
    scenario = findScenario(controls.scenario.value);
    applyPresets();
    renderControls();
    syncUrl();
    open('切换情境');
  });
  controls.server.addEventListener('change', event => {
    server = findServer(event.target.value);
    syncUrl();
    open('切换伺服器');
  });
  // Pictures are asked while the view draws, so a new picture mode needs a new mount to show.
  controls.art.addEventListener('change', () => {
    settings.art = controls.art.value;
    syncUrl();
    open(`图片改为「${ART_MODES[settings.art]}」，重新挂载`);
  });
  controls.portrait.addEventListener('change', () => {
    settings.portrait = controls.portrait.value;
    syncUrl();
    open(`角色图改为「${PORTRAIT_MODES[settings.portrait]}」，重新挂载`);
  });
  controls.open.addEventListener('change', () => {
    settings.openItem = controls.open.value;
    syncUrl();
    note(`资料库跳转改为「${OPEN_MODES[settings.openItem]}」`, 'host');
  });
  controls.close.addEventListener('change', () => {
    settings.close = controls.close.value;
    syncUrl();
    note(`关闭改为「${CLOSE_MODES[settings.close]}」`, 'host');
  });
  controls.clock.addEventListener('change', () => setClock(Date.parse(`${controls.clock.value}:00.000Z`)));
  for (const button of document.querySelectorAll('[data-clock]')) {
    button.addEventListener('click', () => {
      const step = button.dataset.clock;
      setClock(step === 'reset' ? Date.parse(scenario.clock ?? DEFAULT_CLOCK) : now + Number(step));
    });
  }
  controls.theme.addEventListener('change', () => {
    theme = controls.theme.value;
    renderControls();
    syncUrl();
    note(`宿主主题改为${THEMES[theme]}`, 'host');
  });
  controls.width.addEventListener('change', () => {
    width = controls.width.value;
    renderControls();
    syncUrl();
    note(`日历容器宽度改为 ${width === 'auto' ? '自动' : `${width}px`}`, 'host');
  });
  $('remount').addEventListener('click', () => open('重新挂载（新快照）'));
  $('update').addEventListener('click', () => note(mount.update() ? '宿主调用 update()：只依目前会话重画' : '没有挂载中的日历，update() 返回 false', 'host'));
  $('unmount').addEventListener('click', () => {
    ticket++;
    mount.unmount();
    placeholder('unmounted', '日历已卸载（App 中由宿主的 hide() 完成）。', '重新挂载');
    note('宿主卸载日历', 'host');
  });
  $('clear-log').addEventListener('click', () => log.replaceChildren());
  $('reset-store').addEventListener('click', () => {
    memory = createMemorySelectionStore();
    stored.clear();
    note('选取存储已清空', 'host');
    open('重新挂载');
  });
}

buildControls();
readUrl();
renderControls();
syncUrl();
renderStore();
await open();
document.documentElement.dataset.ready = 'true';
