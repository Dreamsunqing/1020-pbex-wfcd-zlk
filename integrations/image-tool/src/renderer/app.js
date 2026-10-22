'use strict';
const $ = selector => document.querySelector(selector);
const PAGE_SIZE = 72;
const state = { items: [], lookup: new Map(), meta: null, categories: new Map(), selected: new Set(),
  active: null, category: '', query: '', imageFilter: 'available', sort: 'name', page: 0,
  selectedOnly: false, results: [], settings: { background: 'checker', thumbnail: 'medium', naming: 'both' }, busy: false };
let toastTimer;
let settingTimer;
let searchTimer;
let zoom = 0;
function imageUrl(id) { return 'guide-image://library/' + encodeURIComponent(id); }
function number(value) { return value.toLocaleString('zh-CN'); }
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function toast(message, error = false) {
  clearTimeout(toastTimer);
  $('#toast').textContent = message;
  $('#toast').classList.toggle('error', error);
  $('#toast').hidden = false;
  toastTimer = setTimeout(() => { $('#toast').hidden = true; }, error ? 6500 : 2800);
}
async function action(button, fn, success) {
  const wasDisabled = button?.disabled;
  if (button) button.disabled = true;
  try { const value = await fn(); if (success) toast(typeof success === 'function' ? success(value) : success); return value; }
  catch (error) { toast(error.message, true); }
  finally { if (button?.isConnected) button.disabled = wasDisabled; }
}
function applySettings(save = false) {
  document.body.dataset.background = state.settings.background;
  document.body.dataset.size = state.settings.thumbnail;
  $('#thumbnail-size').value = state.settings.thumbnail;
  $('#naming').value = state.settings.naming;
  document.querySelectorAll('[data-bg]').forEach(button => {
    const active = button.dataset.bg === state.settings.background;
    button.classList.toggle('active', active); button.setAttribute('aria-pressed', active);
  });
  if (save) {
    clearTimeout(settingTimer);
    settingTimer = setTimeout(() => window.guide.saveSettings({ ...state.settings }).catch(error => toast(error.message, true)), 300);
  }
}
const symbols = { Warframes: '♙', Primary: '⌁', Secondary: '⌁', Melee: '⚔', Mods: '▤', Arcanes: '◇',
  Resources: '⬡', Components: '⚙', Relics: '◈', Gear: '▣', Skins: '✧', Pets: '♧', Sentinels: '◉',
  Glyphs: '▧', Enemy: '♟', Node: '⌖', Fish: '≈', Quests: '⚑', Railjack: '⟐' };
function renderCategories() {
  const nav = $('#categories'); nav.replaceChildren();
  const entries = [{ id: '', label: '全部素材', count: state.items.length, withImages: state.meta.itemsWithImages }, ...state.meta.categories];
  for (const category of entries) {
    if (category.id === 'Warframes') nav.append(el('div', 'category-separator', '按类别浏览'));
    const button = el('button', 'category-button'); button.dataset.category = category.id;
    button.classList.toggle('active', category.id === state.category);
    button.setAttribute('aria-current', category.id === state.category ? 'true' : 'false');
    const count = state.imageFilter === 'available' ? category.withImages : state.imageFilter === 'missing'
      ? category.count - category.withImages : category.count;
    button.append(el('span', 'category-symbol', category.id ? symbols[category.id] || '◇' : '▦'),
      el('span', 'category-name', category.label), el('span', 'category-count', number(count)));
    button.addEventListener('click', () => { state.category = category.id; filter(); renderCategories(); });
    nav.append(button);
  }
}
function filter(resetPage = true) {
  if (!state.meta) return;
  if (resetPage) state.page = 0;
  state.results = GuideSearch.filter(state.items, { ...state, selected: state.selected });
  state.page = Math.max(0, Math.min(state.page, Math.ceil(state.results.length / PAGE_SIZE) - 1));
  $('#category-title').textContent = state.selectedOnly ? '已选素材' : state.category ? state.categories.get(state.category) : '全部素材';
  $('#result-count').textContent = number(state.results.length);
  $('#show-selected').setAttribute('aria-pressed', state.selectedOnly);
  const enemy = state.meta.enemyImages;
  $('#enemy-coverage').hidden = state.category !== 'Enemy' || !enemy;
  if (enemy) $('#enemy-coverage-text').textContent = `WFCD 敌人 ${number(enemy.total)} 条 · 原图 ${number(enemy.original)} 条 · 角色参考图 ${number(enemy.reference)} 条 · 暂无可靠对应 ${number(enemy.missing)} 条`;
  $('#view-missing-enemies').textContent = state.imageFilter === 'missing' ? '查看有图条目' : '查看未对应条目';
  renderGrid();
}
function currentItems() { return state.results.slice(state.page * PAGE_SIZE, (state.page + 1) * PAGE_SIZE); }
function renderGrid() {
  const grid = $('#grid'); grid.replaceChildren();
  const items = currentItems();
  const fragment = document.createDocumentFragment();
  for (const item of items) {
    const card = el('article', 'image-card'); card.dataset.id = item.id;
    card.classList.toggle('focused', state.active === item.id);
    card.classList.toggle('selected', state.selected.has(item.id));
    const open = el('button', 'card-open'); open.title = `查看 ${item.label}${item.imageKind === 'reference' ? '（参考图，来源：' + item.imageSourceLabel + '）' : ''}`;
    const surface = el('div', 'card-image image-surface');
    if (item.hasImage) {
      const image = el('img'); image.src = imageUrl(item.id); image.alt = item.label; image.loading = 'lazy'; image.decoding = 'async';
      image.addEventListener('error', () => surface.classList.add('missing'), { once: true });
      surface.append(image);
    } else surface.classList.add('missing');
    surface.append(el('span', 'missing-icon', '暂无图片'));
    const text = el('div', 'card-text');
    text.append(el('div', 'card-name', item.label), el('div', 'card-english', item.englishLabel), el('div', 'card-category', state.categories.get(item.category)));
    if (item.imageKind === 'reference') text.querySelector('.card-category').append(el('span', 'reference-badge', '参考图'));
    open.append(surface, text); open.addEventListener('click', () => showDetails(item.id)); card.append(open);
    const label = el('label', 'card-checkbox'); label.title = '选择图片';
    const checkbox = el('input'); checkbox.type = 'checkbox'; checkbox.checked = state.selected.has(item.id);
    checkbox.disabled = !item.hasImage; checkbox.setAttribute('aria-label', `选择 ${item.label}`);
    checkbox.addEventListener('change', () => { checkbox.checked ? state.selected.add(item.id) : state.selected.delete(item.id);
      if (state.selectedOnly) filter(false); else card.classList.toggle('selected', checkbox.checked); updateSelection(); });
    label.append(checkbox); card.append(label);
    if (item.hasImage) {
      const quick = el('button', 'card-quick-copy', '复制'); quick.title = '复制图片';
      quick.setAttribute('aria-label', `复制图片 ${item.label}`);
      quick.addEventListener('click', () => copyImage(item.id, quick)); card.append(quick);
    }
    fragment.append(card);
  }
  grid.append(fragment);
  $('#empty').hidden = !!items.length;
  const pages = Math.max(1, Math.ceil(state.results.length / PAGE_SIZE));
  $('#page-info').textContent = `${state.page + 1} / ${number(pages)}`;
  $('#prev').disabled = state.page <= 0; $('#next').disabled = state.page >= pages - 1;
  $('#range-info').textContent = state.results.length ? `显示 ${number(state.page * PAGE_SIZE + 1)}–${number(state.page * PAGE_SIZE + items.length)} / ${number(state.results.length)} 个素材` : '没有符合条件的素材';
  $('#page-hint').textContent = items.length ? `本页 ${items.length} 个` : '';
  $('#grid-scroll').scrollTop = 0;
  updateSelection();
}
function updateSelection() {
  $('#selected-count').textContent = number(state.selected.size);
  $('#clear-selection').disabled = !state.selected.size || state.busy;
  $('#export').disabled = !state.selected.size || state.busy;
  const available = currentItems().filter(item => item.hasImage);
  const selectedCount = available.filter(item => state.selected.has(item.id)).length;
  $('#select-page').checked = !!available.length && selectedCount === available.length;
  $('#select-page').indeterminate = selectedCount > 0 && selectedCount < available.length;
  $('#select-page').disabled = !available.length;
  const select = $('#detail-select');
  if (select) { select.textContent = state.selected.has(state.active) ? '✓ 已加入选择' : '＋ 加入选择'; select.setAttribute('aria-pressed', state.selected.has(state.active)); }
}
function relationSection(title, ids) {
  if (!ids.length) return null;
  const section = el('section', 'relations'); section.append(el('h3', '', `${title} · ${ids.length}`));
  const list = el('div');
  const add = id => {
    const related = state.lookup.get(id); if (!related) return;
    const button = el('button', 'relation-button', related.label); button.title = related.englishLabel;
    button.addEventListener('click', () => showDetails(id)); list.append(button);
  };
  ids.slice(0, 12).forEach(add); section.append(list);
  if (ids.length > 12) {
    const more = el('button', 'text-button', `展开其余 ${ids.length - 12} 个`);
    more.addEventListener('click', () => { ids.slice(12).forEach(add); more.remove(); }); section.append(more);
  }
  return section;
}
function showDetails(id) {
  const item = state.lookup.get(id); if (!item) return;
  state.active = id;
  document.querySelectorAll('.image-card').forEach(card => card.classList.toggle('focused', card.dataset.id === id));
  const detail = $('#details'); detail.replaceChildren(); detail.scrollTop = 0;
  const top = el('div', 'detail-top'); top.append(el('span', '', '素材详情'), el('span', 'detail-tag', state.categories.get(item.category) + (item.imageKind === 'reference' ? ' · 参考图' : ''))); detail.append(top);
  const preview = el('button', 'detail-image image-surface'); preview.setAttribute('aria-label', '查看大图');
  if (item.hasImage) {
    const image = el('img'); image.src = imageUrl(id); image.alt = item.label; preview.append(image, el('span', 'preview-expand', '⤢ 查看大图'));
    preview.addEventListener('click', () => openLightbox());
  } else { preview.textContent = item.category === 'Enemy' ? 'WFCD 素材库暂无可靠对应图片' : '这个条目暂无图片'; preview.disabled = true; preview.classList.add('missing'); }
  detail.append(preview, el('h2', 'detail-title', item.label), el('p', 'detail-english', item.englishLabel));
  const meta = el('div', 'detail-meta', item.hasImage ? '正在读取原图信息…' : '暂无图片 · 可以复制名称'); detail.append(meta);
  if (item.hasImage) window.guide.imageInfo(id).then(info => {
    if (state.active === id) meta.textContent = `${info.width} × ${info.height} px　·　${info.extension}　·　${info.bytes < 1024 * 1024 ? (info.bytes / 1024).toFixed(1) + ' KB' : (info.bytes / 1024 / 1024).toFixed(1) + ' MB'}`;
  }).catch(() => { if (state.active === id) meta.textContent = '图片读取失败，请确认已完整解压'; });
  const actions = el('div', 'detail-actions');
  const copy = el('button', 'button primary', '复制图片'); copy.id = 'detail-copy'; copy.disabled = !item.hasImage;
  copy.addEventListener('click', () => copyImage(id, copy));
  const save = el('button', 'button secondary', '保存原图'); save.id = 'detail-save'; save.disabled = !item.hasImage;
  save.addEventListener('click', () => saveImage(id, save)); actions.append(copy, save); detail.append(actions);
  const select = el('button', 'button secondary wide'); select.id = 'detail-select'; select.disabled = !item.hasImage;
  select.addEventListener('click', () => { state.selected.has(id) ? state.selected.delete(id) : state.selected.add(id); filter(false); }); detail.append(select);
  detail.append(el('div', 'copy-name-label', '复制名称'));
  const names = el('div', 'name-buttons');
  for (const [kind, label] of [['zh', '中文名'], ['en', '英文名'], ['both', '中英名称']]) {
    const button = el('button', 'button secondary', label); button.id = `copy-${kind}`;
    button.addEventListener('click', () => action(button, () => window.guide.copyName(id, kind), '名称已复制'));
    names.append(button);
  }
  detail.append(names, el('p', 'detail-note', item.hasImage ? '复制后可在支持图片粘贴的编辑器中按 Ctrl + V。预览底色不会加入原图。' : '上游暂未提供对应图片，名称检索和复制仍可使用。'));
  if (item.imageKind === 'reference') {
    const reference = el('div', 'reference-note');
    reference.append(el('strong', '', '角色参考图'), el('p', '', item.imageNote));
    const source = state.lookup.get(item.imageSourceId);
    if (source) {
      const sourceButton = el('button', 'text-button', `查看图片来源：${item.imageSourceLabel}`);
      sourceButton.addEventListener('click', () => showDetails(source.id)); reference.append(sourceButton);
    }
    detail.append(reference);
  }
  if (item.description) detail.append(el('p', 'detail-description', item.description));
  const children = relationSection('制作所需部件与材料', item.children); if (children) detail.append(children);
  const parents = relationSection('用于制作', item.parents); if (parents) detail.append(parents);
  updateSelection();
}
async function copyImage(id, button) { await action(button, () => window.guide.copyImage(id), '图片已复制，可在编辑器中按 Ctrl + V 粘贴'); }
async function saveImage(id, button) { await action(button, () => window.guide.saveImage(id, state.settings.naming), result => result.canceled ? '已取消保存' : `已保存：${result.filename}`); }
function setZoom(next) {
  zoom = next;
  const canvas = $('#lightbox-canvas'); const image = $('#lightbox-img');
  canvas.classList.toggle('fit', !zoom);
  image.style.width = zoom ? Math.round(image.naturalWidth * zoom) + 'px' : '';
  image.style.maxWidth = zoom ? 'none' : '';
  $('#zoom-value').textContent = zoom ? `${Math.round(zoom * 100)}%` : '适应窗口';
}
function changeZoom(direction) {
  const image = $('#lightbox-img'); const canvas = $('#lightbox-canvas');
  const current = zoom || Math.min(1, (canvas.clientWidth - 44) / image.naturalWidth, (canvas.clientHeight - 44) / image.naturalHeight);
  setZoom(Math.min(8, Math.max(0.1, current * direction)));
}
function openLightbox() {
  const item = state.lookup.get(state.active); if (!item?.hasImage) return;
  $('#lightbox-title').textContent = item.label; $('#lightbox-img').src = imageUrl(item.id); $('#lightbox-img').alt = item.label;
  setZoom(0); $('#lightbox').showModal();
}
async function exportSelected() {
  if (state.busy || !state.selected.size) return;
  state.busy = true; updateSelection();
  $('#export-message').textContent = '请选择保存文件夹…'; $('#export-progress').value = 0;
  $('#cancel-export').disabled = false; $('#cancel-export').textContent = '停止导出'; $('#export-dialog').showModal();
  try {
    const result = await window.guide.exportImages([...state.selected], state.settings.naming);
    $('#export-dialog').close();
    if (result.canceled && result.count === 0 && !result.failed.length) { toast('已取消导出'); return; }
    $('#export-result-title').textContent = result.canceled ? '导出已停止' : result.failed.length ? '导出完成，部分未成功' : '导出完成';
    $('#export-result-message').textContent = `已保存 ${number(result.count)} 张原图。${result.failed.length ? `有 ${number(result.failed.length)} 张未成功，可查看下方原因。` : ''}${result.canceled ? '尚未导出的图片仍保留在选择中。' : ''}`;
    $('#export-errors').hidden = !result.failed.length;
    $('#export-errors').textContent = result.failed.map(item => `${item.name}：${item.error}`).join('\n');
    $('#open-export-folder').disabled = !result.count;
    $('#result-dialog').showModal();
  } catch (error) { $('#export-dialog').close(); toast(error.message, true); }
  finally { state.busy = false; updateSelection(); }
}
function resetFilters() {
  clearTimeout(searchTimer); state.category = ''; state.query = ''; state.imageFilter = 'available'; state.selectedOnly = false; state.sort = 'name';
  $('#search').value = ''; $('#image-filter').value = 'available'; $('#sort').value = 'name'; renderCategories(); filter();
}
function setup() {
  $('#search').addEventListener('input', event => { clearTimeout(searchTimer); const value = event.target.value;
    searchTimer = setTimeout(() => { state.query = value; filter(); }, 120); });
  $('#image-filter').addEventListener('change', event => { state.imageFilter = event.target.value; renderCategories(); filter(); });
  $('#sort').addEventListener('change', event => { state.sort = event.target.value; filter(); });
  $('#view-missing-enemies').addEventListener('click', () => {
    clearTimeout(searchTimer); state.imageFilter = state.imageFilter === 'missing' ? 'available' : 'missing';
    state.query = ''; state.selectedOnly = false; $('#search').value = ''; $('#image-filter').value = state.imageFilter;
    renderCategories(); filter();
  });
  $('#clear-filters').addEventListener('click', resetFilters); $('#empty-reset').addEventListener('click', resetFilters);
  $('#thumbnail-size').addEventListener('change', event => { state.settings.thumbnail = event.target.value; applySettings(true); });
  document.querySelectorAll('[data-bg]').forEach(button => button.addEventListener('click', () => { state.settings.background = button.dataset.bg; applySettings(true); }));
  $('#naming').addEventListener('change', event => { state.settings.naming = event.target.value; applySettings(true); });
  $('#show-selected').addEventListener('click', () => { state.selectedOnly = !state.selectedOnly; filter(); });
  $('#clear-selection').addEventListener('click', () => { state.selected.clear(); filter(false); });
  $('#select-page').addEventListener('change', event => { for (const item of currentItems().filter(item => item.hasImage)) {
    event.target.checked ? state.selected.add(item.id) : state.selected.delete(item.id); } filter(false); });
  $('#prev').addEventListener('click', () => { state.page--; filter(false); });
  $('#next').addEventListener('click', () => { state.page++; filter(false); });
  $('#export').addEventListener('click', exportSelected);
  $('#help').addEventListener('click', () => $('#help-dialog').showModal());
  $('#retry').addEventListener('click', () => location.reload());
  document.querySelectorAll('.close-dialog').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
  $('#zoom-in').addEventListener('click', () => changeZoom(1.25)); $('#zoom-out').addEventListener('click', () => changeZoom(0.8));
  $('#zoom-fit').addEventListener('click', () => setZoom(0));
  $('#lightbox-canvas').addEventListener('wheel', event => { event.preventDefault(); changeZoom(event.deltaY < 0 ? 1.12 : 1 / 1.12); }, { passive: false });
  $('#lightbox-copy').addEventListener('click', event => copyImage(state.active, event.currentTarget));
  $('#lightbox-save').addEventListener('click', event => saveImage(state.active, event.currentTarget));
  $('#export-dialog').addEventListener('cancel', event => event.preventDefault());
  $('#cancel-export').addEventListener('click', async event => { event.currentTarget.disabled = true; $('#cancel-export').textContent = '正在停止…';
    try { await window.guide.cancelExport(); } catch (error) { toast(error.message, true); } });
  $('#open-export-folder').addEventListener('click', event => action(event.currentTarget, () => window.guide.openExportFolder()));
  window.guide.onProgress(progress => { $('#export-message').textContent = `已处理 ${number(progress.done)} / ${number(progress.total)} 张，已保存 ${number(progress.count)} 张`;
    $('#export-progress').value = progress.done / progress.total * 100; });
  window.guide.onExportClose(() => toast('正在导出图片。需要退出时，请先点击「停止导出」。'));
  document.addEventListener('keydown', event => {
    const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName);
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      if (!document.querySelector('dialog[open]')) { event.preventDefault(); $('#search').focus(); $('#search').select(); }
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c' && !typing && !window.getSelection().toString() && state.active
      && !document.querySelector('dialog[open]:not(#lightbox)')) { event.preventDefault(); if (state.lookup.get(state.active)?.hasImage) copyImage(state.active); }
  });
}
async function boot() {
  try {
    const data = await window.guide.load();
    state.items = GuideSearch.prepare(data.items); state.lookup = new Map(state.items.map(item => [item.id, item]));
    state.meta = data.meta; state.categories = new Map(data.meta.categories.map(category => [category.id, category.label]));
    for (const [key, choices] of Object.entries({ background: ['checker', 'light', 'dark'], thumbnail: ['small', 'medium', 'large'], naming: ['both', 'zh', 'en'] })) {
      if (choices.includes(data.settings[key])) state.settings[key] = data.settings[key];
    }
    const date = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(data.meta.sourceDate));
    $('#category-total').textContent = data.meta.categories.length;
    $('#sidebar-version').textContent = `v${data.version}`;
    $('#data-version').textContent = `数据 ${date} · ${number(data.meta.itemCount)} 条记录 · ${number(data.meta.imageCount)} 张图片`;
    $('#data-version').title = `数据版本：${data.meta.commit}`;
    applySettings(); renderCategories(); filter();
    document.body.dataset.ready = 'true';
  } catch (error) { $('#load-error').hidden = false; $('#load-error-message').textContent = error.message + '。请确认已完整解压，且附带的文件未被移动。'; $('#empty').hidden = true; $('#range-info').textContent = '图片库未加载'; }
}
setup(); boot();
