import { decorateImages } from './images.js';
import { renderGameText } from './game-text.js';
import { FACETS, facetValues, matchesFacets, facetCounts } from '../core/facets.mjs';
import { describeField } from '../core/field-guide.mjs';
import { createRulesUI } from './rules.js';
import { createMergeUI } from './merge.js';
import { createGalleryUI } from './gallery.js';
import { createDocumentsUI } from './documents.js';
import { createLiveStateUI } from './live-state.js';
import { createWmUI } from './wm.js';
const api = window.workbench;
const $ = id => document.getElementById(id);
const mergeUI = createMergeUI({ api, guarded, notify, openSource: async source => {
  const file = state.files.find(file => file.id === source.file);
  if (!file) throw new Error('来源文件不属于当前资料目录或快照');
  const current = await api.call('raw', { id: file.id });
  if (current.hash !== source.hash) throw new Error('来源文件已变化，请重新构建或打开匹配的历史快照');
  state.view = 'tree'; await selectFile(file); await go(source.pointer, source.line ?? null); activate('browser');
} });
const rulesUI = createRulesUI({ api, guarded, notify });
const galleryUI = createGalleryUI({ api, guarded, notify, openEntity: async id => {
  await mergeUI.enter(); await mergeUI.showDetail(id); activate('merged');
} });
const documentsUI = createDocumentsUI({ api, guarded, notify });
const liveUI = createLiveStateUI({ api, guarded, notify });
const wmUI = createWmUI({ api, guarded, notify });
const state = { files: [], selected: null, pointer: '', query: '', offset: 0, view: 'table', page: null, requests: 0, releases: [], busy: false, cardReturn: null };
const element = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) { if (tag === 'pre' || tag === 'code') node.textContent = text; else renderGameText(node, text, /^h[1-6]$/.test(tag) || /title|original|heading/.test(className ?? '') ? 'name' : 'description'); } return node; };
const size = bytes => bytes < 1024 ? `${bytes} B` : bytes < 1048576 ? `${(bytes / 1024).toFixed(1)} KiB` : `${(bytes / 1048576).toFixed(1)} MiB`;
const date = value => new Date(value).toLocaleString('zh-CN', { hour12: false });
const selections = Object.fromEntries(Object.keys(FACETS).map(key => [key, new Set()]));
const pickers = new Map();
let browseLoaded = false;
let oracleLoaded = false, libraryGeneration = 0;
const browseRequests = new Map(), oracleRequests = new Map(), editedLabTimes = new Set();
const oracleResults = {};
let sourceLabels = {};
const facetLabel = (key, value) => key === 'source' ? sourceLabels[value] ?? value : FACETS[key].values[value] ?? value;
function baseFiles() {
  const query = $('file-filter').value.trim().toLocaleLowerCase();
  return state.files.filter(file => (!$('json-only').checked || file.format === 'json') && file.id.toLocaleLowerCase().includes(query));
}
function filteredFiles() { return baseFiles().filter(file => matchesFacets(file, selections)); }
function resetFilters() {
  for (const selected of Object.values(selections)) selected.clear();
  for (const picker of pickers.values()) picker.search.value = '';
  $('file-filter').value = ''; renderFiles(true);
}
function createPickers() {
  for (const [key, facet] of Object.entries(FACETS)) {
    const button = element('button', 'facet-trigger'); button.id = `picker-${key}`;
    const title = element('span', 'facet-title', facet.label); const summary = element('span', 'facet-summary', '全部');
    button.append(title, summary, element('span', 'facet-chevron', '⌄'));
    const popup = element('div', 'facet-popup'); popup.id = `options-${key}`; popup.setAttribute('popover', 'auto');
    popup.setAttribute('role', 'dialog'); popup.setAttribute('aria-label', `${facet.label}多选`); button.setAttribute('aria-haspopup', 'dialog'); button.setAttribute('aria-controls', popup.id); button.setAttribute('aria-expanded', 'false');
    const heading = element('div', 'picker-heading'); const clear = element('button', 'link', '清空本项');
    clear.onclick = () => { selections[key].clear(); renderFiles(true); };
    heading.append(element('strong', '', `${facet.label} · 可多选`), clear);
    const search = element('input', 'picker-search'); search.placeholder = `搜索${facet.label}…`; search.setAttribute('aria-label', `搜索${facet.label}选项`);
    const options = element('div', 'picker-options');
    popup.append(heading, search, options, element('p', 'picker-help', '同项多选取并集，不同项取交集'));
    button.onclick = () => {
      if (popup.matches(':popover-open')) { popup.hidePopover(); return; }
      const rect = button.getBoundingClientRect();
      popup.style.left = `${Math.max(8, Math.min(rect.left, innerWidth - 328))}px`;
      popup.style.top = `${Math.min(rect.bottom + 6, innerHeight - 350)}px`;
      popup.showPopover(); search.focus();
    };
    popup.addEventListener('toggle', event => button.setAttribute('aria-expanded', String(event.newState === 'open')));
    search.oninput = () => renderPickerOptions(key);
    $('facet-pickers').append(button); document.body.append(popup);
    pickers.set(key, { button, summary, popup, search, options, counts: new Map() });
  }
  window.addEventListener('resize', () => { for (const picker of pickers.values()) if (picker.popup.matches(':popover-open')) picker.popup.hidePopover(); });
}
function renderPickerOptions(key) {
  const picker = pickers.get(key); const query = picker.search.value.trim().toLocaleLowerCase();
  const values = [...new Set(state.files.flatMap(file => facetValues(file, key)))];
  const ordered = key === 'source' ? Object.keys(sourceLabels) : Object.keys(FACETS[key].values);
  values.sort((a, b) => ordered.indexOf(a) - ordered.indexOf(b) || a.localeCompare(b));
  picker.options.replaceChildren();
  for (const value of values) {
    const label = facetLabel(key, value); if (query && !`${label} ${value}`.toLocaleLowerCase().includes(query)) continue;
    const row = element('label', 'picker-option'); const input = element('input'); input.type = 'checkbox'; input.value = value;
    input.checked = selections[key].has(value); const count = picker.counts.get(value) ?? 0;
    input.disabled = count === 0 && !input.checked;
    input.onchange = () => {
      input.checked ? selections[key].add(value) : selections[key].delete(value);
      renderFiles(true);
      // Keep keyboard focus on the changed option after counts are refreshed.
      [...picker.options.querySelectorAll('input')].find(node => node.value === value)?.focus();
    };
    row.classList.toggle('unavailable', input.disabled);
    row.append(input, element('span', '', label), element('span', 'option-count', String(count))); picker.options.append(row);
  }
  if (!picker.options.childElementCount) picker.options.append(element('p', 'picker-empty', '没有匹配的选项'));
}
function renderPickers(base) {
  $('filter-chips').replaceChildren(); let selectedCount = 0;
  for (const [key, selected] of Object.entries(selections)) {
    const picker = pickers.get(key); picker.counts = facetCounts(base, selections, key);
    picker.summary.textContent = !selected.size ? '全部' : selected.size === 1 ? facetLabel(key, [...selected][0]) : `已选 ${selected.size} 项`;
    picker.button.classList.toggle('has-selection', selected.size > 0);
    picker.button.title = `${FACETS[key].label}：${selected.size ? [...selected].map(value => facetLabel(key, value)).join('、') : '全部'}（可多选）`;
    renderPickerOptions(key);
    for (const value of selected) {
      selectedCount++; const chip = element('button', 'filter-chip', `${facetLabel(key, value)} ×`);
      chip.setAttribute('aria-label', `移除${FACETS[key].label}：${facetLabel(key, value)}`);
      chip.onclick = () => { selected.delete(value); renderFiles(true); }; $('filter-chips').append(chip);
    }
  }
  $('filter-chips').hidden = !selectedCount;
  $('clear-filters').disabled = !selectedCount && !$('file-filter').value;
}
function fileBadges(file) {
  const row = element('span', 'file-badges');
  for (const key of ['source', 'kind', 'language', 'category']) {
    const values = facetValues(file, key); const text = values.map(value => facetLabel(key, value));
    const badge = element('span', `file-badge badge-${key}`, text.length > 2 ? `${text[0]} +${text.length - 1}` : text.join(' · '));
    badge.title = `${FACETS[key].label}：${text.join('、')}`; row.append(badge);
  }
  return row;
}
function notify(message, error = false) { $('notice').textContent = message; $('notice').classList.toggle('error', error); $('notice').hidden = false; clearTimeout(notify.timer); notify.timer = setTimeout(() => $('notice').hidden = true, error ? 10000 : 5000); }
function log(message) { const line = `[${new Date().toLocaleTimeString('zh-CN')}] ${message}`; $('status-text').textContent = message; $('operation-log').textContent = (line + '\n' + $('operation-log').textContent).slice(0, 12000); }
async function guarded(work) { try { return await work(); } catch (error) { notify(error.message, true); log(error.message); return undefined; } }
function debounce(fn, ms = 200) { let timer; return (...args) => { clearTimeout(timer); timer = setTimeout(() => guarded(() => fn(...args)), ms); }; }
function activate(panel) {
  for (const node of document.querySelectorAll('.panel')) node.classList.toggle('active', node.id === panel);
  for (const node of document.querySelectorAll('.nav')) { node.classList.toggle('active', node.dataset.panel === panel); node.setAttribute('aria-current', node.dataset.panel === panel ? 'page' : 'false'); }
  if (panel === 'world') guarded(() => liveUI.enter());
  if (panel === 'wm') guarded(() => wmUI.enter());
  if (panel === 'updates') guarded(loadHistory);
  if (panel === 'merged') guarded(() => mergeUI.enter());
  if (panel === 'rules') guarded(() => rulesUI.enter());
  if (panel === 'gallery') guarded(() => galleryUI.enter());
  if (panel === 'documents') guarded(() => documentsUI.enter());
  if (panel === 'oracle') { if (!$('oracle-legacy').hidden) guarded(prepareOracle); else if (!browseLoaded) guarded(queryBrowse); }
  if (panel === 'settings') guarded(async () => { await loadImageStatus(); $('config-text').value = JSON.stringify(await api.call('config'), null, 2); });
}
function applyLibrary(data) {
  if (!data) return;
  state.files = data.files; state.selected = null; state.requests++; state.pointer = ''; state.offset = 0; state.cardReturn = null;
  mergeUI.reset(); liveUI.reset();
  browseLoaded = false;
  oracleLoaded = false; libraryGeneration++;
  for (const key of Object.keys(oracleResults)) delete oracleResults[key];
  for (const id of ['cycles-result', 'teshin-result', 'circuit-result', 'incursions-result', 'inv-result', 'arb-result', 'oracle-cycle-result', 'oracle-locations-result', 'oracle-invasions-result', 'oracle-weekly-result', 'observed']) $(id).replaceChildren();
  $('root').textContent = data.root; $('root').title = data.root; $('store-path').textContent = data.storeRoot;
  $('interval').textContent = `每 ${data.intervalMinutes} 分钟`; $('auto-update').checked = data.autoUpdate;
  $('footer-context').textContent = data.mode === 'snapshot' ? `快照 ${data.releaseId.slice(0, 12)} · ${data.files.length} 个文本文件` : `本地目录 · ${data.files.length} 个文本文件`;
  sourceLabels = Object.fromEntries([...data.sources, { id: 'archive', label: '其他文件' }].map(source => [source.id, source.label]));
  for (const file of data.files) sourceLabels[file.source] ??= file.label ?? file.source;
  for (const [key, selected] of Object.entries(selections)) {
    const available = new Set(data.files.flatMap(file => facetValues(file, key)));
    for (const value of selected) if (!available.has(value)) selected.delete(value);
  }
  $('document').hidden = true; $('empty').hidden = false; renderFiles(); showStatus(data.status);
}
function renderFiles(resetScroll = false) {
  const scrollTop = resetScroll ? 0 : $('files').scrollTop;
  const base = baseFiles(); const files = base.filter(file => matchesFacets(file, selections));
  renderPickers(base);
  const total = state.files.filter(file => !$('json-only').checked || file.format === 'json').length;
  $('file-count').textContent = `${files.length} / ${total} 个文件`; $('files').replaceChildren(); $('files').onscroll = null;
  if (!files.length) { $('files').append(element('p', 'file-empty', '没有符合条件的文件，可移除条件或清空筛选。')); return; }
  // File rows are bounded; JSON record paging is performed in the background worker.
  const render = limit => { for (const file of files.slice($('files').childElementCount, limit)) {
    const button = element('button', 'file' + (file.id === state.selected?.id ? ' active' : '')); button.title = file.id;
    button.setAttribute('role', 'listitem');
    button.append(element('span', 'file-name', file.name), fileBadges(file), element('small', '', `${size(file.size)} · ${file.id}`));
    button.onclick = () => guarded(() => selectFile(file)); $('files').append(button);
  } };
  render(Math.max(100, files.findIndex(file => file.id === state.selected?.id) + 1));
  $('files').scrollTop = scrollTop;
  $('files').onscroll = () => { if ($('files').scrollTop + $('files').clientHeight > $('files').scrollHeight - 250) render($('files').childElementCount + 100); };
}
async function selectFile(file) {
  state.sourceLine = null;
  state.selected = file; state.pointer = ''; state.offset = 0; state.query = ''; state.cardReturn = null; $('content-filter').value = ''; $('pointer').value = '';
  $('empty').hidden = true; $('document').hidden = false; $('file-source').textContent = file.label ?? file.source;
  $('file-title').textContent = file.name; $('file-path').textContent = file.id;
  renderFiles(); await renderDocument();
}
function translationSource(title) {
  if (!title || title.status === 'missing') return element('span', 'title-missing', '未匹配中文');
  const source = element('span', 'translation-source', `${title.status === 'original' ? '原文' : '字典'} · ${title.sources.map(item => item.file.split('/').at(-1)).join('、')}`);
  source.title = title.sources.map(item => `${item.file}\nJSON Pointer: ${item.pointer}${item.hash ? '\nSHA-256: ' + item.hash : ''}`).join('\n\n');
  const details = element('details', 'translation-details'), summary = element('summary', '', source.textContent);
  summary.title = source.title; details.append(summary);
  for (const item of title.sources) details.append(element('code', '', `${item.file}\n${item.pointer}${item.hash ? '\nSHA-256: ' + item.hash : ''}`));
  details.onclick = event => event.stopPropagation(); return details;
}
function renderJsonCards(rows) {
  const grid = element('div', 'json-card-grid'), images = [];
  for (const row of rows) {
    const card = element('article', 'json-preview-card');
    card.append(element('span', 'json-card-key', `${row.key} · ${row.type}${row.count !== undefined ? ` [${row.count}]` : ''}`), element('h2', 'json-card-title', row.title.text));
    card.querySelector('.json-card-title').title = row.title.text;
    if (row.title.original !== row.title.text) card.append(element('p', 'json-card-original', row.title.original));
    const origin = element('span', 'json-card-origin', row.title.status === 'missing' ? '未匹配中文' : `${row.title.status === 'original' ? '原文' : '字典'} · ${row.title.sources.map(item => item.file.split('/').at(-1)).join('、')}`);
    origin.title = row.title.sources.map(item => `${item.file}\nJSON Pointer: ${item.pointer}${item.hash ? '\nSHA-256: ' + item.hash : ''}`).join('\n\n'); card.append(origin);
    const open = element('button', 'small json-card-open', row.collection || row.type === 'array' ? '查看集合' : '查看详情');
    open.onclick = event => { event.stopPropagation(); return guarded(() => openCard(row.pointer)); };
    card.onclick = () => guarded(() => openCard(row.pointer)); card.append(open); grid.append(card); if (row.image && !row.collection) images.push({ ...row.image, card, label: row.title.text });
  }
  $('data-view').append(grid); void decorateImages(api, images);
}
async function openCard(pointer) {
  const row = state.page?.rows.find(item => item.pointer === pointer);
  if (row?.collection || row?.type === 'array') {
    state.query = ''; $('content-filter').value = '';
    return go(pointer);
  }
  state.cardReturn = { pointer: state.pointer, query: state.query, offset: state.offset };
  state.pointer = pointer; state.query = ''; state.offset = 0; $('content-filter').value = '';
  await renderDocument();
}
async function backToCards() {
  if (!state.cardReturn) return;
  Object.assign(state, state.cardReturn); state.cardReturn = null; $('content-filter').value = state.query;
  await renderDocument();
}
function detailFields(rows, sequence, hash) {
  const list = element('div', 'record-fields');
  for (const row of rows) {
    const field = element('section', 'record-field'), heading = element('div', 'field-heading');
    const meta = element('div', 'record-field-label'), content = element('div', 'record-field-content');
    const label = element('strong', '', row.guide.label); label.title = `${row.key}\n${row.guide.description}\n${row.guide.source}`;
    heading.append(label, element('code', '', row.key), element('span', 'type', `${row.type}${row.count !== undefined ? ` [${row.count}]` : ''}`));
    if (row.guide.status === 'unknown') heading.append(element('span', 'title-missing', '释义待补充'));
    meta.append(heading, element('p', 'field-description', row.guide.description));
    if ('value' in row) {
      if (row.meaning) content.append(element('strong', 'field-meaning', row.meaning));
      if (row.title?.status === 'dictionary') { content.append(element('p', 'field-translation', row.title.text), translationSource(row.title)); }
      const value = element('pre', 'field-value'); renderGameText(value, row.value === null ? 'null' : String(row.value), /^(name|abilityName|title|displayName)$/i.test(row.key) ? 'name' : 'description'); content.append(value);
    } else {
      const details = element('details', 'nested-fields'), summary = element('summary', '', `展开全部${row.type === 'array' ? '元素' : '子字段'} · ${row.count} 项`), body = element('div');
      details.append(summary, body); let loaded = false, loading = false, offset = 0;
      const id = state.selected.id;
      const load = async () => {
        if (loading || sequence !== state.requests) return; loading = true;
        const more = body.querySelector(':scope > .load-fields'); if (more) more.disabled = true;
        try {
          const page = await api.call('detail', { id, pointer: row.pointer, offset, limit: 80 });
          if (sequence !== state.requests) return;
          if (page.hash !== hash) throw new Error('原文件已发生变化，请重新打开完整记录');
          more?.remove(); body.querySelector(':scope > .field-load-error')?.remove();
          body.append(detailFields(page.rows, sequence, hash)); offset += page.rows.length; loaded = true;
          if (!page.rows.length) body.append(element('p', 'muted', '空容器，无子字段。'));
          if (page.hasMore) { const button = element('button', 'small load-fields', `继续显示 · 已展示 ${offset} / ${page.total} 项`); button.onclick = () => guarded(load); body.append(button); }
        } catch (error) {
          if (sequence === state.requests) { const retry = element('button', 'small field-load-error', `读取失败：${error.message} · 点击重试`); retry.onclick = () => { retry.remove(); guarded(load); }; body.append(retry); }
        } finally { loading = false; if (more?.isConnected) more.disabled = false; }
      };
      details.ontoggle = () => { if (details.open && !loaded) guarded(load); }; content.append(details);
    }
    meta.append(element('small', 'field-source', `字段说明：${row.guide.source}`)); field.append(meta, content); list.append(field);
  }
  return list;
}
function renderRecord(page, sequence) {
  const container = element('article', 'json-preview-card json-record-card record-detail'), heading = element('div', 'record-heading');
  heading.append(element('h2', 'json-record-title', page.title.text), translationSource(page.title));
  container.append(element('span', 'json-card-key', `${page.pointer || '/'} · ${page.type}${page.count !== undefined ? ` [${page.count}]` : ''}`), heading);
  if (page.title.original !== page.title.text) container.append(element('p', 'json-record-original', page.title.original));
  container.append(element('p', 'record-help', '完整卡片 · 悬停字段名查看中文说明，对象和数组可在卡片内展开。'));
  if ('value' in page) { const key = page.pointer.split('/').at(-1)?.replaceAll('~1', '/').replaceAll('~0', '~') ?? '$'; const guide = describeField(key, page.pointer, state.selected.id); const value = element('pre', 'field-value'); renderGameText(value, page.value === null ? 'null' : String(page.value)); container.append(element('p', 'field-description', guide.description), value); }
  else container.append(detailFields(page.rows, sequence, page.hash));
  $('data-view').append(container); if (page.image) void decorateImages(api, [{ ...page.image, card: container, label: page.title.text }], true);
}
function renderSchema(page) {
  const container = element('div', 'schema-view');
  container.append(element('p', 'detail-note', `整份 JSON · ${page.visited.toLocaleString()} 个值 · ${page.fields.toLocaleString()} 个结构节点 · ${page.unknown} 项释义待补充。[] 合并所有数组元素，{key} 合并同类动态键；所有条目均参与扫描。空容器只能显示已观察到的结构。`));
  const table = element('table', 'schema-table'), head = element('thead'), tr = element('tr');
  for (const text of ['字段 / 中文名称', '类型 / 观察次数', '作用 / 样例 / 依据']) tr.append(element('th', '', text));
  head.append(tr); table.append(head); const body = element('tbody');
  for (const row of page.rows) {
    const tr = element('tr'), name = element('td'), type = element('td'), info = element('td');
    name.append(element('strong', '', row.guide.label), element('code', 'schema-path', row.path));
    const sample = element('button', 'link', '查看实际值 ↗'); sample.onclick = () => guarded(async () => { state.view = 'tree'; state.cardReturn = null; state.query = ''; $('content-filter').value = ''; await go(row.pointer); }); name.append(sample);
    type.append(element('code', '', row.types.join(' | ')), element('small', '', `观察 ${row.seen.toLocaleString()} 次${row.key !== '[]' && row.key !== '{key}' && row.parentObjects ? ` / 父对象 ${row.parentObjects.toLocaleString()} 次` : ''}`));
    if (row.empty) type.append(element('small', '', `${row.empty} 个空容器`));
    info.append(element('p', '', row.guide.description));
    if (row.guide.status === 'unknown') info.append(element('span', 'title-missing', '释义待补充'));
    if (row.examples.length) info.append(element('pre', 'schema-examples', row.examples.join('\n')));
    if (row.keyExamples.length) info.append(element('pre', 'schema-examples', '实际键样例：\n' + row.keyExamples.join('\n')));
    info.append(element('small', 'field-source', row.guide.source)); tr.append(name, type, info); body.append(tr);
  }
  table.append(body); container.append(table); if (!page.rows.length) container.append(element('p', 'muted', '没有匹配的字段。')); $('data-view').append(container);
}
async function renderDocument() {
  if (!state.selected) return;
  const sequence = ++state.requests; const id = state.selected.id;
  $('data-view').replaceChildren(element('p', 'raw', '读取中…'));
  $('data-view').scrollTop = 0;
  $('pointer').value = state.pointer; $('parent').disabled = !state.pointer && !state.cardReturn;
  $('parent').textContent = state.view === 'cards' && state.cardReturn ? '← 返回卡片' : '↑ 上一级';
  $('pointer').disabled = state.view === 'schema'; $('go-pointer').disabled = state.view === 'schema';
  if (state.view === 'schema') $('parent').disabled = true;
  $('content-filter').placeholder = state.view === 'schema' ? '搜索整份 JSON 的字段、中文说明或类型…' : state.view === 'cards' && state.cardReturn ? '搜索当前记录的字段、中文说明或原值…' : '搜索当前层级的键、名称或记录内容…';
  for (const button of document.querySelectorAll('[data-view]')) button.classList.toggle('selected', button.dataset.view === state.view);
  if (state.view === 'raw' || state.selected.format === 'text') {
    const raw = await api.call('raw', { id, pointer: state.pointer, line: state.sourceLine ?? null }); if (sequence !== state.requests) return;
    $('data-view').replaceChildren(element('pre', 'raw', raw.text)); $('page-info').textContent = raw.targetLine ? `原文定位第 ${raw.targetLine} 行 · 显示第 ${raw.startLine}–${raw.endLine} 行 · 原文只读` : raw.truncated ? '显示前 200,000 字符，导出可获取完整内容' : `${raw.totalCharacters.toLocaleString()} 字符 · 原文只读`;
    $('previous').disabled = true; $('next').disabled = true; showStats([{ text: size(state.selected.size) }, { text: 'SHA-256 ' + raw.hash.slice(0, 16) }]);
    $('doc-warning').hidden = true; return;
  }
  if (state.view === 'schema' || state.view === 'cards' && state.cardReturn) {
    let page;
    try { page = await api.call(state.view === 'schema' ? 'schema' : 'detail', { id, pointer: state.pointer, query: state.query, offset: state.offset, limit: 80 }); }
    catch (error) { if (sequence === state.requests) { $('data-view').replaceChildren(element('p', 'hint', error.message)); $('previous').disabled = true; $('next').disabled = true; $('page-info').textContent = '请切换原文视图检查文件'; $('doc-warning').hidden = true; } return; }
    if (sequence !== state.requests) return; state.page = page;
    $('data-view').replaceChildren(); $('doc-warning').hidden = !page.warnings.length; $('doc-warning').textContent = page.warnings.join('；');
    showStats([{ text: state.view === 'schema' ? '整份 JSON · 结构与字段释义' : '完整记录 · 原值只读', accent: true }, { text: 'SHA-256 ' + page.hash.slice(0, 12) }]);
    state.view === 'schema' ? renderSchema(page) : renderRecord(page, sequence);
    $('previous').disabled = state.offset === 0; $('next').disabled = !page.hasMore;
    $('page-info').textContent = page.rows.length ? `第 ${state.offset + 1}–${state.offset + page.rows.length} 项 · 共 ${page.total} 项${state.query ? ' · 已筛选' : ''}` : '无匹配字段';
    return;
  }
  const page = await api.call('page', { id, pointer: state.pointer, query: state.query, offset: state.offset, limit: 80 });
  if (sequence !== state.requests) return; state.page = page;
  showStats([{ text: page.format.toUpperCase(), accent: true }, { text: page.type + (page.count !== undefined ? ` · ${page.count.toLocaleString()} 项` : '') }, { text: size(state.selected.size) }, { text: 'SHA-256 ' + page.hash.slice(0, 12) }]);
  $('doc-warning').hidden = !page.warnings.length; $('doc-warning').textContent = page.warnings.join('；');
  $('data-view').replaceChildren();
  if (!page.rows.length) $('data-view').append(element('pre', 'raw', page.scalar ?? '没有匹配的记录。'));
  else if (state.view === 'cards') renderJsonCards(page.rows);
  else if (state.view === 'tree') {
    for (const row of page.rows) { const node = element('div', 'tree-row'); node.append(element('span', 'tree-key', `${['array', 'object'].includes(row.type) ? '▸ ' : '· '}${row.key}`), element('span', 'type', `${row.type}${row.count !== undefined ? ` [${row.count}]` : ''}`), element('span', 'tree-preview', row.preview)); node.onclick = () => guarded(() => go(row.pointer)); $('data-view').append(node); }
  } else {
    const table = element('table'); const head = element('thead'); const tr = element('tr');
    for (const [label, width] of [['键 / 序号', '13%'], ['类型', '7%'], ['内容预览', '65%'], ['中文来源', '15%']]) { const th = element('th', '', label); th.width = width; tr.append(th); }
    head.append(tr); table.append(head); const body = element('tbody');
    for (const row of page.rows) {
      const tr = element('tr', 'clickable'), content = element('td', 'value'), source = element('td', 'source');
      if (row.title.status !== 'missing') content.append(element('strong', 'json-row-title', row.title.text));
      content.append(element('span', '', row.preview)); source.append(translationSource(row.title));
      tr.append(element('td', 'key', row.key), element('td', 'type', row.type + (row.count !== undefined ? ` [${row.count}]` : '')), content, source);
      tr.onclick = () => guarded(() => go(row.pointer)); body.append(tr);
    }
    table.append(body); $('data-view').append(table);
  }
  $('previous').disabled = state.offset === 0; $('next').disabled = !page.hasMore;
  $('page-info').textContent = page.rows.length ? `第 ${state.offset + 1}–${state.offset + page.rows.length} 项 · 当前层级 ${page.total.toLocaleString()} 项${state.query ? ' · 已应用筛选' : ''}` : '当前层级无记录';
}
function showStats(items) { $('document-stats').replaceChildren(...items.map(x => element('span', 'badge' + (x.accent ? ' accent' : ''), x.text))); }
async function go(pointer, line = null) { state.pointer = pointer; state.sourceLine = line; state.offset = 0; state.cardReturn = null; await renderDocument(); }
function showStatus(status) { if (!status) return; $('update-state').textContent = ({ idle: '尚未检查', running: '检查中', ok: '检查成功', error: '检查失败' })[status.state] ?? status.state; $('update-detail').textContent = status.message ?? (status.checkedAt ? `${date(status.checkedAt)} · ${status.fileChanges ?? 0} 个文件变更` : '导入本地基线后，可查看和回滚历史版本。'); }
async function loadHistory() {
  const data = await api.call('history'); state.releases = data.releases; showStatus(data.status); $('releases').replaceChildren();
  for (const release of data.releases) {
    const row = element('div', 'release'); const text = element('div'); const title = element('code', '', release.id.slice(0, 20));
    if (release.id === data.current) title.append(element('span', 'badge accent', ' 当前发布'));
    text.append(title, element('p', '', `${date(release.createdAt)} · ${release.sources.join(' / ')}`)); const actions = element('div', 'actions');
    const open = element('button', 'small', '浏览快照'); open.onclick = () => guarded(async () => { applyLibrary(await api.call('snapshot', { id: release.id })); activate('browser'); });
    const rollback = element('button', 'small', '设为当前版本'); rollback.disabled = release.id === data.current; rollback.onclick = () => guarded(async () => { await api.call('rollback', { id: release.id }); notify('已切换当前版本'); await loadHistory(); });
    actions.append(open, rollback); row.append(text, actions); $('releases').append(row);
  }
  if (!data.releases.length) $('releases').append(element('p', 'muted', '尚无快照。可先导入本地资料，或检查上游获取新版本。'));
  for (const id of ['diff-before', 'diff-after']) { const select = $(id); select.replaceChildren(); for (const release of data.releases) { const option = element('option', '', release.id.slice(0, 16)); option.value = release.id; select.append(option); } }
  if (data.releases.length > 1) $('diff-before').selectedIndex = 1;
}
async function loadOracleOptions() {
  const generation = libraryGeneration, pool = await api.call('oracleOptions'); if (generation !== libraryGeneration) return; $('observed').replaceChildren();
  for (let i = 0; i < 3; i++) { const select = element('select'); select.setAttribute('aria-label', `历史战甲 ${i + 1}`); const empty = element('option', '', '未提供'); empty.value = ''; select.append(empty); for (const suit of pool.toSorted((a, b) => a.label.localeCompare(b.label, 'zh'))) { const option = element('option', '', suit.label); option.value = suit.key; select.append(option); } $('observed').append(select); }
}
function localInputDate(seconds = false) { const value = new Date(); return new Date(value.getTime() - value.getTimezoneOffset() * 60000).toISOString().slice(0, seconds ? 19 : 16); }
function statText(stat) { return `${stat.label}${stat.operation === 'enable' ? '' : ` ${stat.operation === 'set' ? '' : '+'}${stat.value}${stat.unit}`}`; }
function renderInvigorations(result) {
  $('inv-result').replaceChildren();
  const hint = element('div', 'hint', result.warnings.join('；')); $('inv-result').append(hint, element('p', 'muted', `${date(result.startsAt)} — ${date(result.endsAt)} · ${result.algorithm}`));
  for (const offer of result.offers) { const card = element('div', 'offer'); card.append(element('strong', '', offer.suit.label), element('p', '', statText(offer.offensive)), element('p', '', statText(offer.defensive))); $('inv-result').append(card); }
}
function renderArbitration(result) {
  $('arb-result').replaceChildren(element('div', 'hint', result.warnings.join('；')), element('p', 'muted', `排期覆盖至 ${date(result.coverage.endsAt)}${result.truncated ? ' · 结果已到排期末尾' : ''}`));
  const list = element('div', 'arb-list');
  for (const entry of result.entries) { const row = element('div', 'arb-entry'); const info = element('div', '', `${entry.name ?? entry.node}${entry.system ? ` · ${entry.system}` : ''}`); info.append(element('small', '', `${entry.missionName ?? entry.missionType ?? '任务未匹配'} · ${entry.node}`)); row.append(element('time', '', date(entry.startsAt)), info); list.append(row); } $('arb-result').append(list);
}
async function predict() { return queryOracle('invig'); }
async function queryArb() { return queryOracle('arb'); }
function browseMeta(result, hash) {
  const version = result.dataVersion?.releaseId ? `快照 ${result.dataVersion.releaseId.slice(0, 12)}` : '当前本地资料';
  return element('p', 'browse-meta', `${version} · SHA-256 ${hash.slice(0, 12)} · ${result.algorithm}`);
}
function renderCycles(result) {
  const grid = element('div', 'cycle-tiles');
  for (const entry of result.entries) {
    const tile = element('div', 'cycle-tile' + (entry.endsAt ? '' : ' unavailable')); tile.dataset.cycle = entry.id;
    tile.append(element('small', '', entry.label), element('strong', '', entry.state));
    if (entry.endsAt) {
      const minutes = Math.ceil((Date.parse(entry.endsAt) - Date.parse(result.at)) / 60000);
      tile.append(element('span', '', `${date(entry.endsAt)} 结束`), element('small', '', `距参考时间 ${minutes} 分钟 · ${entry.basis === 'fixed-rule' ? '固定规则' : '世界状态基准'}`));
    } else tile.append(element('span', '', entry.reason));
    grid.append(tile);
  }
  $('cycles-result').replaceChildren(grid);
  const anchor = result.anchor;
  const info = anchor ? `基准 ${date(anchor.startsAt)} — ${date(anchor.endsAt)} · 获取于 ${date(anchor.fetchedAt)} · ${result.anchorStatus === 'covered' ? '覆盖参考时间' : '未覆盖参考时间'}` : '尚无世界状态基准。双衍王境与山谷可离线查询；平原／火卫二请先刷新基准。';
  $('cycles-result').append(element('p', 'hint', info));
  if (anchor) $('cycles-result').append(element('p', 'browse-meta', `${anchor.source} · ${anchor.tag} · SHA-256 ${anchor.payloadHash.slice(0, 12)}`));
  $('cycles-result').append(browseMeta(result, result.sourceHash), element('p', 'browse-meta', result.warnings.join('；')));
}
function renderWeekly(result, target) {
  const teshinList = element('div', 'rotation-list'), circuitList = element('div', 'rotation-list');
  for (const entry of result.entries) {
    const range = `${date(entry.startsAt)} — ${date(entry.endsAt)}`;
    const offer = element('div', 'rotation-row teshin-row'); offer.append(element('time', '', range), element('strong', '', entry.teshin.label)); offer.title = entry.teshin.key; teshinList.append(offer);
    const circuit = element('div', 'rotation-row circuit-row'); circuit.append(element('time', '', range));
    for (const [label, items] of [['普通', entry.circuit.frames], ['钢铁', entry.circuit.weapons]]) {
      const line = element('p', 'circuit-options'); line.append(element('span', 'badge', label));
      for (const item of items) { const name = element('span', 'rotation-item', item.label); name.title = item.key; line.append(name); }
      circuit.append(line);
    }
    circuitList.append(circuit);
  }
  for (const [id, list] of [['teshin-result', teshinList], ['circuit-result', circuitList]]) if (id === target) $(id).replaceChildren(list, browseMeta(result, result.sourceHash), element('p', 'browse-meta', result.warnings.join('；')));
}
function renderIncursions(result) {
  const list = element('div', 'incursion-days');
  for (const entry of result.entries) {
    const day = element('details', 'incursion-day'); if (list.childElementCount === 0) day.open = true;
    day.append(element('summary', '', `${date(entry.startsAt)} — ${date(entry.endsAt)} · ${entry.nodes.length} 个节点`));
    const nodes = element('div', 'incursion-nodes');
    for (const node of entry.nodes) {
      const row = element('div', 'incursion-node');
      row.append(element('strong', '', `${node.name}${node.system ? ` · ${node.system}` : ''}`), element('span', '', `${node.missionName ?? '任务未匹配'}${node.minLevel !== null && node.maxLevel !== null ? ` · Lv. ${node.minLevel}–${node.maxLevel}` : ''}`), element('code', '', node.node)); nodes.append(row);
    }
    day.append(nodes); list.append(day);
  }
  $('incursions-result').replaceChildren(element('p', 'hint', `排期覆盖 ${date(result.coverage.startsAt)} — ${date(result.coverage.endsAt)}${result.truncated ? ' · 已到排期末尾' : ''}`), list, browseMeta(result, result.scheduleHash), element('p', 'browse-meta', result.warnings.join('；')));
}
async function queryBrowse(only) {
  const generation = libraryGeneration, at = new Date($('browse-time').value).getTime(); browseLoaded = true;
  const groups = [
    ['cycles', 'browseCycles', { at }, 'cycles-result', renderCycles],
    ['teshin', 'browseWeekly', { at, count: Number($('browse-weeks').value) }, 'teshin-result', result => renderWeekly(result, 'teshin-result')],
    ['circuit', 'browseWeekly', { at, count: Number($('browse-circuit-weeks').value) }, 'circuit-result', result => renderWeekly(result, 'circuit-result')],
    ['incursions', 'browseIncursions', { at, count: Number($('browse-days').value) }, 'incursions-result', renderIncursions]
  ];
  await Promise.all(groups.filter(([scope]) => !only || scope === only).map(async ([scope, method, args, id, render]) => {
    const sequence = (browseRequests.get(scope) ?? 0) + 1; browseRequests.set(scope, sequence);
    const current = () => generation === libraryGeneration && sequence === browseRequests.get(scope);
    $(id).replaceChildren(element('p', 'muted', '查询中…'));
    try { const result = await api.call(method, args); if (current()) render(result); }
    catch (error) { if (current()) $(id).replaceChildren(element('p', 'hint error', error.message)); }
  }));
}
function selectLab(id) {
  for (const node of document.querySelectorAll('[data-lab]')) node.classList.toggle('selected', node.dataset.lab === id);
  for (const lab of ['browse-lab', 'oracle-legacy']) $(lab).hidden = lab !== id;
  if (id === 'oracle-legacy') guarded(prepareOracle);
  else if (!browseLoaded) guarded(queryBrowse);
}
async function prepareOracle() {
  if (oracleLoaded) return;
  oracleLoaded = true; const generation = libraryGeneration;
  await Promise.allSettled([loadOracleOptions(), loadOracleState()]);
  if (generation === libraryGeneration) await queryOracle();
}
async function loadOracleState() {
  const status = await api.call('oracleStateStatus');
  if (!status.available) {
    $('oracle-state-info').textContent = '尚无世界状态。可刷新／导入 JSON，或手填 seed 先复算赏金。';
    for (const scope of ['cycle', 'locations', 'invasions']) if (!$(`oracle-${scope}-result`).childElementCount) $(`oracle-${scope}-result`).append(element('p', 'muted', scope === 'invasions' ? '请先刷新官方世界状态，或导入包含 Invasions 的 JSON。' : '填写 seed 后点击推算，或先获取世界状态。'));
    $('oracle-weekly-result').replaceChildren(element('p', 'muted', '请先刷新官方世界状态，或导入包含 Conquests 的 JSON。'));
  } else {
    const seeds = status.syndicates.map(x => `${x.tag.replace('Syndicate', '')} seed ${x.seed}`).join(' · ');
    $('oracle-state-info').textContent = `${status.source} · 采集时间 ${date(status.observedAt)} · 载入时间 ${date(status.loadedAt)} · ${status.invasions === null ? '未包含入侵字段' : `${status.invasions} 个未完成入侵`} · ${status.conquests === null ? '未包含周常字段，请刷新或导入' : `${status.conquests.length} 组周常窗口`} · ${seeds} · SHA-256 ${status.payloadHash.slice(0, 12)}`;
  }
  return status;
}
function oracleMeta(container, result) {
  const info = `${result.seed !== undefined ? `seed ${result.seed} · ` : ''}${result.input === 'manual-seed' ? '手填 seed · 离线复算' : '世界状态输入'}${result.endsAt ? ` · ${date(result.startsAt)} — ${date(result.endsAt)}` : ''}`;
  container.append(element('p', 'oracle-meta', info));
  if (result.worldState) container.append(element('p', 'oracle-meta', `${result.worldState.source} · 采集于 ${date(result.worldState.observedAt)} · SHA-256 ${result.worldState.payloadHash.slice(0, 12)}`));
  container.append(browseMeta(result, result.sourceHash), element('p', 'oracle-meta', result.warnings.join('；')));
}
function renderOracleWeekly(result) {
  const container = $('oracle-weekly-result'), grid = element('div', 'oracle-weekly-grid');
  const identifiers = (text, notes = []) => {
    const details = element('details', 'oracle-source-details'); details.append(element('summary', '', '原始标识与翻译来源'), element('small', 'oracle-raw', text));
    for (const note of notes) details.append(element('small', 'oracle-raw', note));
    return details;
  };
  const detail = (value, className) => {
    const node = element('div', className), sources = { upstream: '来源字典', supplement: '补充译文', missing: '中文待补充' };
    const localized = value.localization;
    node.append(element('strong', '', localized?.name === 'missing' ? '中文名称待补充' : value.name));
    if (localized?.name === 'supplement' || localized?.description === 'supplement') node.append(element('span', 'oracle-translation-badge', '补充译文'));
    if (value.description) node.append(element('p', 'oracle-challenge-desc', value.description));
    else node.append(element('p', 'muted', '中文说明待补充'));
    const notes = localized ? [`名称：${sources[localized.name]} · 说明：${sources[localized.description]}`, localized.nameKey, localized.descriptionKey] : [];
    if (localized?.name === 'supplement' || localized?.description === 'supplement') notes.push(result.localization.supplementSourceTitle, result.localization.supplementSource);
    node.append(identifiers(value.raw === value.key ? value.key : `${value.raw} → ${value.key}`, notes));
    return node;
  };
  for (const section of result.sections) {
    const group = element('section', 'oracle-weekly-section'); group.append(element('h3', '', `${section.id === 'lab' ? '实验室' : '六人组'} · ${section.name}`));
    if (section.status !== 'active') { group.append(element('p', 'hint', '没有覆盖参考时间的周常，请刷新或调整时间。')); grid.append(group); continue; }
    group.append(element('p', 'oracle-meta', `${date(section.startsAt)} — ${date(section.endsAt)}`));
    section.missions.forEach((mission, i) => {
      const row = element('article', 'oracle-weekly-mission');
      row.append(element('h4', '', `${i + 1}. ${mission.typeLocalization === 'missing' ? '任务名称待补充' : mission.typeName}`), identifiers(`${mission.raw.missionType} → ${mission.type}`), element('span', 'oracle-field-label', '任务变体'), detail(mission.variantDetails, 'oracle-weekly-variant'), element('span', 'oracle-field-label', '风险（第二档难度）'));
      for (const condition of mission.conditionDetails) row.append(detail(condition, 'oracle-weekly-risk'));
      if (!mission.conditionDetails.length) row.append(element('p', 'muted', '无风险条件'));
      group.append(row);
    });
    group.append(element('h4', '', '个人限制'));
    for (const variable of section.variableDetails) group.append(detail(variable, 'oracle-weekly-variable'));
    if (!section.variableDetails.length) group.append(element('p', 'muted', '无个人限制'));
    grid.append(group);
  }
  container.replaceChildren(grid); oracleMeta(container, result);
}
const oracleZones = { ZarimanSyndicate: '扎里曼', EntratiLabSyndicate: '英择谛实验室', HexSyndicate: '1999', CetusSyndicate: '夜灵平原', SolarisSyndicate: '奥布山谷', EntratiSyndicate: '火卫二' };
function oracleGroup(label) { const group = element('details', 'oracle-group'); group.open = true; group.append(element('summary', '', label)); const list = element('div', 'oracle-group-list'); group.append(list); return { group, list }; }
function rewardSources(value) {
  const details = element('details', 'oracle-reward-source'); details.append(element('summary', '', '原始标识与来源'));
  details.addEventListener('toggle', () => {
    if (!details.open || details.childElementCount > 1) return;
    details.append(element('pre', 'oracle-raw', JSON.stringify(value, null, 2)));
  });
  return details;
}
function renderRewardTable(table, label = '随机奖励') {
  const details = element('details', 'oracle-reward-table'), count = table.pools.reduce((sum, pool) => sum + pool.items.length, 0);
  details.append(element('summary', '', `${label} · ${table.pools.length} 个池 · ${count} 项${table.status === 'available' ? '' : ' · 数据待补充'}`));
  details.addEventListener('toggle', () => {
    if (!details.open || details.childElementCount > 1) return;
    const body = element('div', 'oracle-reward-body');
    if (table.pools.length > 1) body.append(element('p', 'oracle-reward-note', '奖励池按源文件顺序列出；池号不代表任务阶段。'));
    for (const pool of table.pools) {
      body.append(element('h5', '', `奖励池 ${pool.index}`));
      const items = element('div', 'reward-item-grid');
      for (const item of pool.items) {
        const row = element('article', 'oracle-reward-item'), heading = element('div', 'oracle-reward-heading');
        heading.append(element('span', '', `${item.name}${item.localization === 'missing' ? '（中文待补充）' : ''} × ${item.quantity ?? '数量待补充'}`), element('span', 'oracle-reward-chance', item.probability === null ? '概率待补充' : `${Number((item.probability * 100).toFixed(2))}%`));
        row.append(heading, rewardSources({ type: item.type, key: item.key, itemCount: item.itemCount, probability: item.rawProbability, rarity: item.rarity ?? null, source: item.source, nameSource: item.nameSource, conversion: item.conversion })); items.append(row);
      }
      body.append(items);
      if (!pool.items.length) body.append(element('p', 'muted', '源文件中的奖励池为空'));
    }
    for (const warning of table.warnings) body.append(element('p', 'oracle-reward-note', warning));
    body.append(rewardSources({ key: table.key, source: table.source })); details.append(body);
  });
  return details;
}
function renderFixedRewards(fixed) {
  const parts = [];
  if (fixed.xpAmount !== null) parts.push(`${fixed.xpItem?.name ?? '声望'} ${Array.isArray(fixed.xpAmount) ? fixed.xpAmount.join('—') : fixed.xpAmount}`);
  if (fixed.chemistryAmount > 0) parts.push(`好感度 ${fixed.chemistryAmount}`);
  return element('p', 'oracle-reward-note', `清单基础报酬：${parts.join(' · ') || '未列出'}（未计额外加成）`);
}
function renderLocationRewards(catalog) {
  const box = element('div', 'oracle-location-rewards'); box.append(element('h4', '', '按难度查看奖励'), element('p', 'oracle-reward-note', catalog.note));
  const label = element('label', 'oracle-reward-picker', '奖励难度'), select = element('select'), panel = element('div', 'oracle-reward-panel');
  for (const tier of catalog.tiers) { const option = element('option', '', `第 ${tier.tier} 档 · 等级 ${tier.enemyLevel?.join('—') ?? '待补充'} · ${tier.stageCount ?? '?'} 阶段`); option.value = String(tier.tier); select.append(option); }
  const render = () => {
    const tier = catalog.tiers.find(item => String(item.tier) === select.value); panel.replaceChildren();
    if (!tier) { panel.append(element('p', 'muted', '这些任务没有可关联的普通难度清单')); return; }
    panel.append(element('p', 'oracle-reward-status', { 'world-state': '当前轮次：已由该地区世界状态确认', fixed: '固定奖励表：清单仅列出一张表', unconfirmed: '轮次待确认：展示候选奖励表' }[tier.status]), renderFixedRewards(tier.fixed));
    if (tier.reason) panel.append(element('p', 'oracle-reward-note', tier.reason));
    tier.tables.forEach((table, i) => panel.append(renderRewardTable(table, `${tier.status === 'unconfirmed' ? '候选' : ''}奖励表 ${i + 1}`)));
    panel.append(rewardSources({ source: tier.source, candidateKeys: tier.candidateKeys, worldState: catalog.worldState, xpItem: tier.fixed.xpItem }));
  };
  select.onchange = render; label.append(select); box.append(label, panel); render(); return box;
}
function renderOracleCycle(result) {
  const container = $('oracle-cycle-result'), grid = element('div', 'oracle-zone-grid'), stats = element('div', 'oracle-rotation-stats');
  for (const text of [`平原奖励轮次 ${result.rot ?? '待世界状态确认'}`, `隔离库轮次 ${result.vaultRot ?? '待世界状态确认'}`, `扎里曼阵营 ${result.zarimanFaction === 'FC_GRINEER' ? 'Grineer' : 'Corpus'}`]) stats.append(element('span', 'badge', text));
  for (const [tag, rows] of Object.entries(result.bounties)) {
    const { group, list } = oracleGroup(`${oracleZones[tag] ?? tag} · ${rows.length} 档`);
    rows.forEach((row, i) => {
      const item = element('div', 'oracle-bounty-row'); item.title = `${row.node}\n${row.challenge}${row.ally ? `\n${row.ally}` : ''}`;
      item.append(element('small', '', `TIER ${i + 1}${row.allyName ? ` · ${row.allyName}` : ''}`), element('strong', '', row.nodeName), element('span', 'oracle-mission', row.missionName ?? row.node), element('p', 'oracle-challenge-name', row.challengeName));
      if (row.challengeDescription) item.append(element('p', 'oracle-challenge-desc', row.challengeDescription));
      if (row.rewardDetails) item.append(element('p', 'oracle-reward-context', `${oracleZones[tag] ?? tag} · 第 ${i + 1} 档赏金报酬；对应上方任务与挑战。`), renderFixedRewards(row.rewardDetails.fixed), renderRewardTable(row.rewardDetails.table), rewardSources({ source: row.rewardDetails.source, fixed: row.rewardDetails.fixed }));
      list.append(item);
    }); grid.append(group);
  }
  container.replaceChildren(stats, grid); oracleMeta(container, result);
}
function renderOracleLocations(result) {
  const container = $('oracle-locations-result'), grid = element('div', 'oracle-zone-grid');
  for (const [tag, rows] of Object.entries(result.locations)) {
    const { group, list } = oracleGroup(`${oracleZones[tag] ?? tag} · ${rows.length} 个地区`);
    if (result.rewardCatalog?.[tag]) list.append(renderLocationRewards(result.rewardCatalog[tag]));
    for (const row of rows) {
      const location = element('div', 'oracle-location-row'); location.append(element('strong', '', row.location));
      for (const job of row.jobDetails) { const item = element('p', 'oracle-job', job.name); item.title = `${job.key}\n${job.description}`; location.append(item); }
      if (!row.jobs.length) location.append(element('p', 'muted', '该地区没有展示任务')); list.append(location);
    }
    grid.append(group);
  }
  container.replaceChildren(grid); oracleMeta(container, result);
}
function renderOracleInvasions(result) {
  const container = $('oracle-invasions-result'), list = element('div', 'oracle-invasion-list');
  for (const entry of result.entries) {
    const row = element('div', 'oracle-invasion-row'); row.title = `${entry.id}\n${entry.node}`;
    row.append(element('strong', '', `${entry.nodeName}${entry.system ? ` · ${entry.system}` : ''} · 支援${entry.side === 'attacker' ? '进攻方' : '防守方'} ${entry.allyName}`), element('p', '', `报酬：${entry.rewardDetails.map(x => `${x.ItemCount} × ${x.name}`).join('、') || '无物品'}`));
    const steps = element('div', 'oracle-invasion-steps');
    result.windows.forEach((window, i) => { const step = element('div', 'oracle-invasion-step'); step.append(element('small', '', `${i === 0 ? '当前轮' : `后续第 ${i} 轮`} · ${date(window.startsAt)}`), element('span', '', entry.missionNames[i])); step.title = `${window.startsAt} — ${window.endsAt}\n${entry.missions[i]}`; steps.append(step); });
    row.append(steps); list.append(row);
  }
  container.replaceChildren(result.entries.length ? list : element('p', 'hint', '输入中没有带物品奖励的未完成入侵。')); oracleMeta(container, result);
}
async function queryOracle(only) {
  const generation = libraryGeneration, at = new Date($('oracle-time').value).getTime();
  const groups = [
    ['cycle', 'oracleCycle', { at, seed: $('oracle-cycle-seed').value.trim() || undefined }, 'oracle-cycle-result', renderOracleCycle],
    ['locations', 'oracleLocations', { at, seed: $('oracle-locations-seed').value.trim() || undefined }, 'oracle-locations-result', renderOracleLocations],
    ['invasions', 'oracleInvasions', { at, count: Number($('oracle-invasion-count').value) }, 'oracle-invasions-result', renderOracleInvasions],
    ['weekly', 'oracleWeekly', { at }, 'oracle-weekly-result', renderOracleWeekly],
    ['invig', 'invigorations', { at, username: $('username').value, target: $('target').value, observedSuitTypes: [...$('observed').querySelectorAll('select')].map(node => node.value).filter(Boolean) }, 'inv-result', renderInvigorations],
    ['arb', 'arbitration', { at, count: Number($('arb-count').value) }, 'arb-result', renderArbitration]
  ];
  await Promise.all(groups.filter(([scope]) => !only || scope === only).map(async ([scope, method, args, id, render]) => {
    const sequence = (oracleRequests.get(scope) ?? 0) + 1; oracleRequests.set(scope, sequence);
    const current = () => generation === libraryGeneration && sequence === oracleRequests.get(scope);
    const container = $(id); delete oracleResults[scope]; container.replaceChildren(element('p', 'muted', '推算中…'));
    try { const result = await api.call(method, args); if (current()) { oracleResults[scope] = result; render(result); } }
    catch (error) { if (current()) container.replaceChildren(element('p', 'hint error', error.message)); }
  }));
}
async function refreshAndQuery(lab) {
  const oracle = lab === 'oracle', button = $(oracle ? 'query-oracle' : 'query-browse'), time = oracle ? 'oracle-time' : 'browse-time';
  if (button.disabled) return;
  const generation = libraryGeneration;
  button.disabled = true; button.textContent = '刷新并查询中…';
  let failure;
  try {
    try { await api.call(oracle ? 'refreshOracleState' : 'refreshWorldState'); }
    catch (error) { failure = error; }
    if (generation !== libraryGeneration) return;
    if (!editedLabTimes.has(time)) $(time).value = localInputDate(true);
    if (oracle) await loadOracleState();
    await (oracle ? queryOracle() : queryBrowse());
    notify(failure ? `刷新失败，已使用已有缓存查询：${failure.message}` : '已刷新世界状态并查询全部模块', Boolean(failure));
  } finally { button.disabled = false; button.textContent = '刷新并查询'; }
}
async function changeOracleState() {
  const input = $('import-oracle-state'); input.disabled = true;
  const generation = libraryGeneration;
  try {
    const status = await api.importOracleState({ at: new Date($('oracle-time').value).getTime() });
    if (!status || generation !== libraryGeneration) return;
    editedLabTimes.add('oracle-time');
    await loadOracleState(); await queryOracle(); notify('已导入世界状态，以参考时间作为采集时间');
  } finally { input.disabled = false; }
}
async function longTask(method) {
  if (state.busy) return; state.busy = true; $('update-now').disabled = true; $('import').disabled = true;
  try { const result = await api.call(method); log(`${method === 'import' ? '导入' : '检查'}完成，版本 ${result.releaseId.slice(0, 12)}，${result.changes?.length ?? 0} 个文件变更`); notify('操作完成，可在版本列表中浏览快照'); await loadHistory(); }
  finally { state.busy = false; $('update-now').disabled = false; $('import').disabled = false; }
}
for (const node of document.querySelectorAll('.nav')) node.onclick = () => activate(node.dataset.panel);
for (const node of document.querySelectorAll('[data-view]')) node.onclick = () => guarded(async () => { state.view = node.dataset.view; state.query = ''; state.offset = 0; $('content-filter').value = ''; await renderDocument(); });
const choose = () => guarded(async () => applyLibrary(await api.chooseRoot())); $('choose').onclick = choose; $('empty-choose').onclick = choose;
createPickers();
$('json-only').onchange = () => renderFiles(true); $('file-filter').oninput = debounce(() => renderFiles(true)); $('clear-filters').onclick = resetFilters;
$('refresh').onclick = () => guarded(async () => applyLibrary(await api.call('refresh')));
$('content-filter').oninput = debounce(async () => { state.query = $('content-filter').value; state.offset = 0; await renderDocument(); });
$('go-pointer').onclick = () => guarded(() => go($('pointer').value)); $('pointer').onkeydown = event => { if (event.key === 'Enter') guarded(() => go($('pointer').value)); };
$('parent').onclick = () => guarded(() => state.view === 'cards' && state.cardReturn ? backToCards() : go(state.pointer.slice(0, state.pointer.lastIndexOf('/'))));
$('previous').onclick = () => guarded(async () => { state.offset = Math.max(0, state.offset - 80); await renderDocument(); }); $('next').onclick = () => guarded(async () => { state.offset += 80; await renderDocument(); });
$('copy').onclick = () => guarded(async () => { if (!state.selected) return; const result = await api.call('raw', { id: state.selected.id, pointer: state.pointer }); if (result.truncated) throw new Error('内容超过复制上限，请使用导出获取完整内容'); await api.copy(result.text); notify('已复制'); });
$('export').onclick = () => guarded(async () => { if (state.selected && await api.exportFile({ id: state.selected.id, pointer: state.pointer })) notify('已导出'); });
$('update-now').onclick = () => guarded(() => longTask('update')); $('import').onclick = () => guarded(() => longTask('import')); $('history-refresh').onclick = () => guarded(loadHistory);
$('auto-update').onchange = () => guarded(async () => { const enabled = $('auto-update').checked; const data = await api.call('autoUpdate', { enabled }); $('auto-update').checked = data.autoUpdate; notify(enabled ? '已启用应用内定时检查' : '已停用定时检查'); });
$('diff').onclick = () => guarded(async () => { if (!$('diff-before').value || !$('diff-after').value) throw new Error('请先创建两个版本'); const changes = await api.call('diff', { before: $('diff-before').value, after: $('diff-after').value }); $('diff-result').replaceChildren(element('p', 'muted', `${changes.length} 个文件变化`)); const table = element('table'); for (const change of changes) { const row = element('tr'); row.append(element('td', '', ({ added: '新增', removed: '删除', changed: '修改' })[change.kind]), element('td', '', `${change.source}/${change.file}`), element('td', 'value', `${change.before?.hash.slice(0, 12) ?? '—'} → ${change.after?.hash.slice(0, 12) ?? '—'}`)); table.append(row); } $('diff-result').append(table); });
$('target').onchange = () => { $('observed-label').textContent = $('target').value === 'next' ? '本周已观察到的战甲（可选）' : '上一周已观察到的战甲（可选）'; return guarded(predict); };
for (const node of document.querySelectorAll('[data-lab]')) node.onclick = () => selectLab(node.dataset.lab);
for (const node of document.querySelectorAll('[data-oracle-card]')) node.onclick = () => $(node.dataset.oracleCard).scrollIntoView({ block: 'start', behavior: 'smooth' });
for (const node of document.querySelectorAll('[data-copy-oracle]')) node.onclick = () => guarded(async () => { const result = oracleResults[node.dataset.copyOracle]; if (!result) throw new Error('请先成功推算该模块'); await api.copy(JSON.stringify(result, null, 2)); notify('推算结果 JSON 已复制'); });
$('query-oracle').onclick = () => guarded(() => refreshAndQuery('oracle'));
$('import-oracle-state').onclick = () => guarded(changeOracleState);
$('query-browse').onclick = () => guarded(() => refreshAndQuery('browse'));
for (const [id, scope] of [['browse-weeks', 'teshin'], ['browse-circuit-weeks', 'circuit'], ['browse-days', 'incursions']]) $(id).onchange = () => guarded(() => queryBrowse(scope));
for (const [id, scope] of [['oracle-cycle-seed', 'cycle'], ['oracle-locations-seed', 'locations'], ['oracle-invasion-count', 'invasions'], ['username', 'invig'], ['arb-count', 'arb']]) {
  $(id).onchange = () => guarded(() => queryOracle(scope));
  if ($(id).tagName === 'INPUT') $(id).onkeydown = event => { if (event.key === 'Enter') { event.preventDefault(); guarded(() => queryOracle(scope)); } };
}
$('observed').onchange = () => guarded(predict);
for (const [id, query] of [['browse-time', queryBrowse], ['oracle-time', queryOracle]]) {
  $(id).oninput = () => editedLabTimes.add(id);
  $(id).onchange = () => { editedLabTimes.add(id); return guarded(query); };
}
$('save-config').onclick = () => guarded(async () => { await api.call('saveConfig', { text: $('config-text').value }); notify('配置已保存，下次检查生效'); });
$('browse-time').value = localInputDate(true);
$('oracle-time').value = localInputDate(true);
api.onEvent(message => { if (message.event === 'progress') log(message.value.message); if (message.event === 'updated') { showStatus(message.value); log(`上游检查成功：${message.value.fileChanges} 个文件变化`); } });
async function loadImageStatus() { const status = await api.imageStatus(); $('image-path').textContent = status.available ? `${status.root} · ${status.files} 张图片` : '未配置，卡片仅显示文字'; }
$('choose-images').onclick = () => guarded(async () => { if (await api.chooseImages()) { await loadImageStatus(); galleryUI.state.entered = false; notify('图片资源目录已切换'); } });
document.addEventListener('keydown', event => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    const active = document.querySelector('.panel.active')?.id;
    const target = ({ wm: 'wm-search', documents: 'docs-search', gallery: 'gallery-search', merged: 'merge-search', browser: 'file-filter' })[active];
    if (target) { $(target).focus(); $(target).select(); }
  }
});
window.runSmoke = async () => {
  const report = { ok: false, files: state.files.length };
  const file = state.files.find(f => f.id.endsWith('/ExportResources_zh.json')); if (!file) throw new Error('烟雾测试缺少资料包');
  await selectFile(file); report.rootRows = state.page.rows.length; await go('/ExportResources'); report.resourceCount = state.page.count;
  state.query = 'Forma'; await renderDocument(); report.searchRows = state.page.rows.length; state.query = ''; await go('/ExportResources');
  const data = await api.call('invigorations', { username: 'WorkbenchTest', at: Date.parse('2026-10-19T12:00:00Z') }); report.offers = data.offers.length;
  const arb = await api.call('arbitration', { at: Date.parse('2026-10-19T12:00:00Z'), count: 24 }); report.arbitrations = arb.entries.length;
  const browseAt = Date.parse('2026-10-19T12:00:00Z');
  const cycles = await api.call('browseCycles', { at: browseAt }); report.cycles = cycles.entries.length;
  const weekly = await api.call('browseWeekly', { at: browseAt, count: 4 }); report.teshin = weekly.entries.length; report.circuitFrames = weekly.entries[0].circuit.frames.length; report.circuitWeapons = weekly.entries[0].circuit.weapons.length;
  const incursions = await api.call('browseIncursions', { at: browseAt, count: 7 }); report.incursionDays = incursions.entries.length; report.incursionNodes = incursions.entries[0].nodes.length;
  const bounty = await api.call('oracleCycle', { seed: '24091' }); report.oracleBounties = Object.values(bounty.bounties).reduce((sum, rows) => sum + rows.length, 0);
  const locations = await api.call('oracleLocations', { seed: '24091' }); report.oracleLocations = Object.values(locations.locations).reduce((sum, rows) => sum + rows.length, 0);
  const merged = await api.call('mergeBuild', { profile: 'pilot' }); report.mergedEntities = merged.manifest.summary.entities; report.mergedRecipes = merged.manifest.summary.recipes;
  report.isolated = typeof window.require === 'undefined' && typeof window.process === 'undefined';
  report.ok = report.mergedEntities === 51 && report.mergedRecipes === 14 && report.files >= 403 && report.resourceCount === 3549 && report.offers === 3 && report.arbitrations === 24 && report.cycles === 4 && report.teshin === 4 && report.circuitFrames === 3 && report.circuitWeapons === 5 && report.incursionDays === 7 && report.incursionNodes === 6 && report.oracleBounties === 17 && report.oracleLocations > 0 && report.isolated; return report;
};
guarded(async () => { applyLibrary(await api.call('init')); window.smokeReady = true; });
export { $, state, mergeUI, rulesUI, galleryUI, documentsUI, liveUI, wmUI, selections, filteredFiles, resetFilters, renderFiles, selectFile, go, openCard, renderDocument, activate, loadOracleOptions, predict, queryArb, queryBrowse, selectLab, applyLibrary, queryOracle, loadOracleState, oracleResults, refreshAndQuery };
