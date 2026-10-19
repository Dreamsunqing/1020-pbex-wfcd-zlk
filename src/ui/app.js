import { FACETS, facetValues, matchesFacets, facetCounts } from '../core/facets.mjs';
const api = window.workbench;
const $ = id => document.getElementById(id);
const state = { files: [], selected: null, pointer: '', query: '', offset: 0, view: 'table', page: null, requests: 0, releases: [], busy: false };
const element = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; };
const size = bytes => bytes < 1024 ? `${bytes} B` : bytes < 1048576 ? `${(bytes / 1024).toFixed(1)} KiB` : `${(bytes / 1048576).toFixed(1)} MiB`;
const date = value => new Date(value).toLocaleString('zh-CN', { hour12: false });
const selections = Object.fromEntries(Object.keys(FACETS).map(key => [key, new Set()]));
const pickers = new Map();
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
  for (const node of document.querySelectorAll('.nav')) node.classList.toggle('active', node.dataset.panel === panel);
  if (panel === 'updates') guarded(loadHistory);
  if (panel === 'oracle') guarded(loadOracleOptions);
  if (panel === 'settings') guarded(async () => { $('config-text').value = JSON.stringify(await api.call('config'), null, 2); });
}
function applyLibrary(data) {
  if (!data) return;
  state.files = data.files; state.selected = null; state.requests++; state.pointer = ''; state.offset = 0;
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
  state.selected = file; state.pointer = ''; state.offset = 0; state.query = ''; $('content-filter').value = ''; $('pointer').value = '';
  $('empty').hidden = true; $('document').hidden = false; $('file-source').textContent = file.label ?? file.source;
  $('file-title').textContent = file.name; $('file-path').textContent = file.id;
  renderFiles(); await renderDocument();
}
async function renderDocument() {
  if (!state.selected) return;
  const sequence = ++state.requests; const id = state.selected.id;
  $('data-view').replaceChildren(element('p', 'raw', '读取中…'));
  $('pointer').value = state.pointer; $('parent').disabled = !state.pointer;
  for (const button of document.querySelectorAll('[data-view]')) button.classList.toggle('selected', button.dataset.view === state.view);
  if (state.view === 'raw' || state.selected.format === 'text') {
    const raw = await api.call('raw', { id, pointer: state.pointer }); if (sequence !== state.requests) return;
    $('data-view').replaceChildren(element('pre', 'raw', raw.text)); $('page-info').textContent = raw.truncated ? '显示前 200,000 字符，导出可获取完整内容' : `${raw.totalCharacters.toLocaleString()} 字符 · 原文只读`;
    $('previous').disabled = true; $('next').disabled = true; showStats([{ text: size(state.selected.size) }, { text: 'SHA-256 ' + raw.hash.slice(0, 16) }]);
    $('doc-warning').hidden = true; return;
  }
  const page = await api.call('page', { id, pointer: state.pointer, query: state.query, offset: state.offset, limit: 80 });
  if (sequence !== state.requests) return; state.page = page;
  showStats([{ text: page.format.toUpperCase(), accent: true }, { text: page.type + (page.count !== undefined ? ` · ${page.count.toLocaleString()} 项` : '') }, { text: size(state.selected.size) }, { text: 'SHA-256 ' + page.hash.slice(0, 12) }]);
  $('doc-warning').hidden = !page.warnings.length; $('doc-warning').textContent = page.warnings.join('；');
  $('data-view').replaceChildren();
  if (!page.rows.length) $('data-view').append(element('pre', 'raw', page.scalar ?? '没有匹配的记录。'));
  else if (state.view === 'tree') {
    for (const row of page.rows) { const node = element('div', 'tree-row'); node.append(element('span', 'tree-key', `${['array', 'object'].includes(row.type) ? '▸ ' : '· '}${row.key}`), element('span', 'type', `${row.type}${row.count !== undefined ? ` [${row.count}]` : ''}`), element('span', 'tree-preview', row.preview)); node.onclick = () => guarded(() => go(row.pointer)); $('data-view').append(node); }
  } else {
    const table = element('table'); const head = element('thead'); const tr = element('tr');
    for (const [label, width] of [['键 / 序号', '16%'], ['类型', '9%'], ['内容预览', '75%']]) { const th = element('th', '', label); th.width = width; tr.append(th); }
    head.append(tr); table.append(head); const body = element('tbody');
    for (const row of page.rows) { const tr = element('tr', 'clickable'); tr.append(element('td', 'key', row.key), element('td', 'type', row.type + (row.count !== undefined ? ` [${row.count}]` : '')), element('td', 'value', row.preview)); tr.onclick = () => guarded(() => go(row.pointer)); body.append(tr); }
    table.append(body); $('data-view').append(table);
  }
  $('previous').disabled = state.offset === 0; $('next').disabled = !page.hasMore;
  $('page-info').textContent = page.rows.length ? `第 ${state.offset + 1}–${state.offset + page.rows.length} 项 · 当前层级 ${page.total.toLocaleString()} 项${state.query ? ' · 已应用筛选' : ''}` : '当前层级无记录';
}
function showStats(items) { $('document-stats').replaceChildren(...items.map(x => element('span', 'badge' + (x.accent ? ' accent' : ''), x.text))); }
async function go(pointer) { state.pointer = pointer; state.offset = 0; await renderDocument(); }
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
  const pool = await api.call('oracleOptions'); $('observed').replaceChildren();
  for (let i = 0; i < 3; i++) { const select = element('select'); select.setAttribute('aria-label', `历史战甲 ${i + 1}`); const empty = element('option', '', '未提供'); empty.value = ''; select.append(empty); for (const suit of pool.toSorted((a, b) => a.label.localeCompare(b.label, 'zh'))) { const option = element('option', '', suit.label); option.value = suit.key; select.append(option); } $('observed').append(select); }
}
function localInputDate() { const value = new Date(); return new Date(value.getTime() - value.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
function statText(stat) { return `${stat.label}${stat.operation === 'enable' ? '' : ` ${stat.operation === 'set' ? '' : '+'}${stat.value}${stat.unit}`}`; }
async function predict() {
  const args = { username: $('username').value, target: $('target').value, at: new Date($('inv-time').value).getTime(), observedSuitTypes: [...$('observed').querySelectorAll('select')].map(x => x.value).filter(Boolean) };
  const result = await api.call('invigorations', args); $('inv-result').replaceChildren();
  const hint = element('div', 'hint', result.warnings.join('；')); $('inv-result').append(hint, element('p', 'muted', `${date(result.startsAt)} — ${date(result.endsAt)} · ${result.algorithm}`));
  for (const offer of result.offers) { const card = element('div', 'offer'); card.append(element('strong', '', offer.suit.label), element('p', '', statText(offer.offensive)), element('p', '', statText(offer.defensive))); $('inv-result').append(card); }
}
async function queryArb() {
  const result = await api.call('arbitration', { at: new Date($('arb-time').value).getTime(), count: Number($('arb-count').value) }); $('arb-result').replaceChildren(element('div', 'hint', result.warnings.join('；')), element('p', 'muted', `排期覆盖至 ${date(result.coverage.endsAt)}${result.truncated ? ' · 结果已到排期末尾' : ''}`));
  const list = element('div', 'arb-list');
  for (const entry of result.entries) { const row = element('div', 'arb-entry'); const info = element('div', '', `${entry.name ?? entry.node}${entry.system ? ` · ${entry.system}` : ''}`); info.append(element('small', '', `${entry.missionName ?? entry.missionType ?? '任务未匹配'} · ${entry.node}`)); row.append(element('time', '', date(entry.startsAt)), info); list.append(row); } $('arb-result').append(list);
}
async function longTask(method) {
  if (state.busy) return; state.busy = true; $('update-now').disabled = true; $('import').disabled = true;
  try { const result = await api.call(method); log(`${method === 'import' ? '导入' : '检查'}完成，版本 ${result.releaseId.slice(0, 12)}，${result.changes?.length ?? 0} 个文件变更`); notify('操作完成，可在版本列表中浏览快照'); await loadHistory(); }
  finally { state.busy = false; $('update-now').disabled = false; $('import').disabled = false; }
}
for (const node of document.querySelectorAll('.nav')) node.onclick = () => activate(node.dataset.panel);
for (const node of document.querySelectorAll('[data-view]')) node.onclick = () => guarded(async () => { state.view = node.dataset.view; await renderDocument(); });
const choose = () => guarded(async () => applyLibrary(await api.chooseRoot())); $('choose').onclick = choose; $('empty-choose').onclick = choose;
createPickers();
$('json-only').onchange = () => renderFiles(true); $('file-filter').oninput = debounce(() => renderFiles(true)); $('clear-filters').onclick = resetFilters;
$('refresh').onclick = () => guarded(async () => applyLibrary(await api.call('refresh')));
$('content-filter').oninput = debounce(async () => { state.query = $('content-filter').value; state.offset = 0; await renderDocument(); });
$('go-pointer').onclick = () => guarded(() => go($('pointer').value)); $('pointer').onkeydown = event => { if (event.key === 'Enter') guarded(() => go($('pointer').value)); };
$('parent').onclick = () => guarded(() => go(state.pointer.slice(0, state.pointer.lastIndexOf('/'))));
$('previous').onclick = () => guarded(async () => { state.offset = Math.max(0, state.offset - 80); await renderDocument(); }); $('next').onclick = () => guarded(async () => { state.offset += 80; await renderDocument(); });
$('copy').onclick = () => guarded(async () => { if (!state.selected) return; const result = await api.call('raw', { id: state.selected.id, pointer: state.pointer }); if (result.truncated) throw new Error('内容超过复制上限，请使用导出获取完整内容'); await api.copy(result.text); notify('已复制'); });
$('export').onclick = () => guarded(async () => { if (state.selected && await api.exportFile({ id: state.selected.id, pointer: state.pointer })) notify('已导出'); });
$('update-now').onclick = () => guarded(() => longTask('update')); $('import').onclick = () => guarded(() => longTask('import')); $('history-refresh').onclick = () => guarded(loadHistory);
$('auto-update').onchange = () => guarded(async () => { const enabled = $('auto-update').checked; const data = await api.call('autoUpdate', { enabled }); $('auto-update').checked = data.autoUpdate; notify(enabled ? '已启用应用内定时检查' : '已停用定时检查'); });
$('diff').onclick = () => guarded(async () => { if (!$('diff-before').value || !$('diff-after').value) throw new Error('请先创建两个版本'); const changes = await api.call('diff', { before: $('diff-before').value, after: $('diff-after').value }); $('diff-result').replaceChildren(element('p', 'muted', `${changes.length} 个文件变化`)); const table = element('table'); for (const change of changes) { const row = element('tr'); row.append(element('td', '', ({ added: '新增', removed: '删除', changed: '修改' })[change.kind]), element('td', '', `${change.source}/${change.file}`), element('td', 'value', `${change.before?.hash.slice(0, 12) ?? '—'} → ${change.after?.hash.slice(0, 12) ?? '—'}`)); table.append(row); } $('diff-result').append(table); });
$('target').onchange = () => $('observed-label').textContent = $('target').value === 'next' ? '本周已观察到的战甲（可选）' : '上一周已观察到的战甲（可选）';
$('predict').onclick = () => guarded(predict); $('query-arb').onclick = () => guarded(queryArb);
$('save-config').onclick = () => guarded(async () => { await api.call('saveConfig', { text: $('config-text').value }); notify('配置已保存，下次检查生效'); });
$('inv-time').value = localInputDate(); $('arb-time').value = localInputDate();
api.onEvent(message => { if (message.event === 'progress') log(message.value.message); if (message.event === 'updated') { showStatus(message.value); log(`上游检查成功：${message.value.fileChanges} 个文件变化`); } });
window.runSmoke = async () => {
  const report = { ok: false, files: state.files.length };
  const file = state.files.find(f => f.id.endsWith('/ExportResources_zh.json')); if (!file) throw new Error('烟雾测试缺少资料包');
  await selectFile(file); report.rootRows = state.page.rows.length; await go('/ExportResources'); report.resourceCount = state.page.count;
  state.query = 'Forma'; await renderDocument(); report.searchRows = state.page.rows.length; state.query = ''; await go('/ExportResources');
  const data = await api.call('invigorations', { username: 'WorkbenchTest', at: Date.parse('2026-10-19T12:00:00Z') }); report.offers = data.offers.length;
  const arb = await api.call('arbitration', { at: Date.parse('2026-10-19T12:00:00Z'), count: 24 }); report.arbitrations = arb.entries.length;
  report.isolated = typeof window.require === 'undefined' && typeof window.process === 'undefined';
  report.ok = report.files >= 403 && report.resourceCount === 3549 && report.offers === 3 && report.arbitrations === 24 && report.isolated; return report;
};
guarded(async () => { applyLibrary(await api.call('init')); window.smokeReady = true; });
export { $, state, selections, filteredFiles, resetFilters, renderFiles, selectFile, go, activate, loadOracleOptions, predict, queryArb };
