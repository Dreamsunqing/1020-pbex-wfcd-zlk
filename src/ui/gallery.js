import { renderGameText, plainGameText } from './game-text.js';
const $ = id => document.getElementById(id);
const el = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) renderGameText(node, text, /title|english/.test(className ?? '') ? 'name' : 'description'); return node; };
const imageUrl = key => 'workbench-image://library/' + encodeURIComponent(key);
const providerLabel = provider => ({wfcd:'WFCD',official:'DE 官方','text-icons':'Plus 文本图标'})[provider] ?? provider;
const bytes = value => value < 1048576 ? `${(value / 1024).toFixed(1)} KiB` : `${(value / 1048576).toFixed(2)} MiB`;

export function createGalleryUI({ api, guarded, notify, openEntity }) {
  const state = { offset: 0, rows: [], total: 0, selected: new Set(), sequence: 0, entered: false, detailKey: null, exporting: false };
  let timer;
  let preferences;
  try { preferences = JSON.parse(localStorage.getItem('gallery-preferences') || '{}'); } catch { preferences = {}; }
  const persist = () => { try { localStorage.setItem('gallery-preferences', JSON.stringify({ background: $('gallery-background').value, size: $('gallery-size').value, naming: $('gallery-naming').value })); } catch {} };
  function countSelected() {
    $('gallery-selection-count').textContent = `已选 ${state.selected.size} 项`;
    $('gallery-export').disabled = !state.selected.size || state.exporting;
    $('gallery-clear').disabled = !state.selected.size;
  }
  function setAppearance() {
    $('gallery').dataset.background = $('gallery-background').value;
    $('gallery').dataset.size = $('gallery-size').value;
    $('gallery-dialog').dataset.background = $('gallery-background').value;
    persist();
  }
  function toggle(row, checked) {
    if (!row.hasImage) return;
    if (checked) state.selected.add(row.key); else state.selected.delete(row.key);
    countSelected();
  }
  function preview(picture, row) {
    picture.classList.toggle('composed-blueprint', Boolean(row.layers));
    for (const layer of row.layers ?? [{ key: row.key, role: 'original' }]) {
      const image = el('img', 'gallery-layer-' + layer.role); image.src = imageUrl(layer.key); image.alt = ''; image.loading = 'lazy'; image.decoding = 'async';
      image.onerror = () => { image.remove(); if (!picture.querySelector('img')) picture.append(el('span', 'gallery-image-missing', '图片暂不可用')); };
      picture.append(image);
    }
  }
  function renderCards() {
    const grid = $('gallery-grid'); grid.replaceChildren();
    for (const row of state.rows) {
      const card = el('article', 'gallery-card'); card.dataset.key = row.key;
      const button = el('button', 'gallery-card-open'); button.setAttribute('aria-label', `查看 ${row.label}`);
      const picture = el('span', `gallery-picture${row.abilityIcon ? ' ability-picture' : ''}`);
      if (row.hasImage) {
        preview(picture, row);
      } else picture.append(el('span', 'gallery-image-missing', '暂无图片'));
      const title = el('strong', 'gallery-card-title', row.label); title.title = row.label;
      const english = el('span', 'gallery-card-english', row.englishLabel); english.title = row.englishLabel;
      button.append(picture, title, english);
      button.onclick = () => guarded(() => detail(row.key));
      const bottom = el('div', 'gallery-card-meta');
      bottom.append(el('span', row.provider === 'official' ? 'gallery-source official' : 'gallery-source', providerLabel(row.provider)));
      const category = el('span', '', row.categoryLabel); category.title = row.categoryLabel; bottom.append(category);
      if (row.imageKind === 'reference') bottom.append(el('span', 'badge', '参考图'));
      const check = el('input'); check.type = 'checkbox'; check.checked = state.selected.has(row.key); check.disabled = !row.hasImage;
      check.setAttribute('aria-label', `选择 ${row.label}`); check.onchange = () => toggle(row, check.checked);
      card.append(button, bottom, check); grid.append(card);
    }
    if (!state.rows.length) grid.append(el('div', 'gallery-empty', '没有匹配的图片。试试中文、英文或原始文件名，也可以清空筛选。'));
    $('gallery-page-info').textContent = state.total ? `第 ${state.offset + 1}–${state.offset + state.rows.length} 项 · 共 ${state.total.toLocaleString()} 项` : '0 项';
    $('gallery-previous').disabled = state.offset === 0;
    $('gallery-next').disabled = state.offset + state.rows.length >= state.total;
    countSelected();
  }
  async function refresh(reset = false) {
    if (reset) state.offset = 0;
    const sequence = ++state.sequence;
    $('gallery-status').textContent = '正在筛选图片…'; $('gallery-grid').setAttribute('aria-busy', 'true');
    try {
      const result = await api.call('galleryList', { provider: $('gallery-provider').value,
        category: $('gallery-category').value, query: $('gallery-search').value,
        availability: $('gallery-availability').value, offset: state.offset, limit: 72,
        selectedKeys: $('gallery-selected-only').checked ? [...state.selected] : null });
      if (sequence !== state.sequence) return;
      if (!result.rows.length && state.offset > 0 && result.total > 0) { state.offset = Math.floor((result.total - 1) / 72) * 72; return refresh(); }
      state.rows = result.rows; state.total = result.total;
      if (!$('gallery-category').dataset.ready) {
        const actual = $('gallery-category').value;
        for (const category of result.status.categories) { const option = el('option', '', category.label); option.value = category.id; $('gallery-category').append(option); }
        $('gallery-category').value = actual; $('gallery-category').dataset.ready = '1';
      }
      $('gallery-status').textContent = `${result.status.libraryMissing?'外部图库未就绪，内置图标可用 · ':''}离线资源库 · WFCD ${result.status.providers.wfcd.toLocaleString()} 条 · DE 官方 ${result.status.providers.official.toLocaleString()} 条 · 文本图标 ${(result.status.providers['text-icons']??0).toLocaleString()} 条` ;
      renderCards(); state.entered = true;
    } catch (error) {
      if (sequence !== state.sequence) return;
      $('gallery-grid').replaceChildren(el('div', 'gallery-empty', `图片资源未就绪：${error.message}。可在配置中选择 assets/content 目录。`));
      $('gallery-status').textContent = '请选择完整图片资源目录'; throw error;
    } finally { if (sequence === state.sequence) $('gallery-grid').setAttribute('aria-busy', 'false'); }
  }
  async function detail(key) {
    const row = await api.call('galleryDetail', { key });
    state.detailKey = key;
    $('gallery-detail-title').textContent = plainGameText(row.label, 'name');
    $('gallery-detail-english').textContent = plainGameText(row.englishLabel, 'name');
    $('gallery-detail-source').textContent = `${row.provider === 'official' ? 'DE 官方 Public Export' : providerLabel(row.provider)} · ${row.categoryLabel}${row.imageKind === 'reference' ? ' · 参考图' : ''}`;
    const picture = $('gallery-detail-picture'); picture.replaceChildren(); picture.classList.remove('composed-blueprint'); picture.classList.toggle('ability-picture', Boolean(row.abilityIcon));
    if (row.hasImage) preview(picture, row);
    else picture.append(el('p', 'muted', row.failure || '当前来源没有可确认图片'));
    $('gallery-zoom').value = '100'; picture.style.setProperty('--image-scale', '1');
    const description = $('gallery-detail-description'); if(row.provider==='text-icons')description.textContent=row.description;else renderGameText(description, row.description || '当前记录没有描述。');
    const fields = $('gallery-detail-fields'); fields.replaceChildren();
    for (const [label, value] of [['文本标记', row.token], ['图像来源',row.imageOrigin], ['原始图名', row.imageName], ['完整 ID', row.id], ['纹理路径', row.textureLocation], ['配图说明', row.imageNote]]) if (value) {
      const raw=el('dd');raw.textContent=value;fields.append(el('dt', '', label), raw);
    }
    const relations = $('gallery-detail-relations'); relations.replaceChildren();
    if (row.relations.length) relations.append(el('h3', '', '关联物品'));
    for (const related of row.relations) { const button = el('button', 'small', related.label); button.onclick = () => guarded(() => detail(related.key)); relations.append(button); }
    for (const id of ['gallery-copy-image', 'gallery-save']) $(id).disabled = !row.hasImage;
    $('gallery-open-entity').hidden = !row.id.startsWith('/Lotus/');
    $('gallery-open-entity').onclick = () => guarded(async () => { await openEntity(row.id); $('gallery-dialog').close(); });
    $('gallery-copy-name').onclick = () => guarded(async () => { const kind = $('gallery-naming').value;
      await api.copy(kind === 'en' ? row.englishLabel : kind === 'zh' || row.label === row.englishLabel ? row.label : `${row.label}（${row.englishLabel}）`); notify('名称已复制'); });
    $('gallery-detail-dimensions').textContent = row.hasImage ? '正在读取尺寸…' : '无图片';
    if (!$('gallery-dialog').open) $('gallery-dialog').showModal();
    if (row.hasImage) {
      try { const info = await api.galleryAction('info', { key }); if (state.detailKey === key) $('gallery-detail-dimensions').textContent = `${info.width} × ${info.height} · ${bytes(info.bytes)} · ${info.mime.replace('image/', '').toUpperCase()}`; }
      catch (error) { if (state.detailKey === key) $('gallery-detail-dimensions').textContent = error.message; }
    }
  }
  $('gallery-close').onclick = () => $('gallery-dialog').close();
  $('gallery-dialog').addEventListener('click', event => { if (event.target === $('gallery-dialog')) { const r = event.target.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) event.target.close(); } });
  $('gallery-copy-image').onclick = () => guarded(async () => { await api.galleryAction('copy', { key: state.detailKey }); notify('图片已复制，可粘贴到文档或聊天'); });
  $('gallery-save').onclick = () => guarded(async () => { const result = await api.galleryAction('save', { key: state.detailKey, naming: $('gallery-naming').value }); if (result) notify('图片已保存'); });
  $('gallery-zoom').oninput = () => $('gallery-detail-picture').style.setProperty('--image-scale', String(Number($('gallery-zoom').value) / 100));
  $('gallery-search').oninput = () => { clearTimeout(timer); timer = setTimeout(() => guarded(() => refresh(true)), 180); };
  for (const id of ['gallery-provider', 'gallery-category', 'gallery-availability', 'gallery-selected-only']) $(id).onchange = () => guarded(() => {
    if(id==='gallery-category'){if($('gallery-category').value==='TextIcons')$('gallery-provider').value='text-icons';else if($('gallery-provider').value==='text-icons')$('gallery-provider').value='all';}
    if(id==='gallery-provider'){if($('gallery-provider').value==='text-icons')$('gallery-category').value='TextIcons';else if($('gallery-category').value==='TextIcons')$('gallery-category').value='';}
    return refresh(true);
  });
  for (const [id, allowed, fallback] of [['gallery-background', ['checker', 'light', 'dark'], 'checker'], ['gallery-size', ['small', 'medium', 'large'], 'medium'], ['gallery-naming', ['both', 'zh', 'en'], 'both']]) {
    const key = id.replace('gallery-', ''); $(id).value = allowed.includes(preferences[key]) ? preferences[key] : fallback; $(id).onchange = setAppearance;
  }
  $('gallery-select-page').onclick = () => { state.rows.forEach(row => toggle(row, true)); renderCards(); };
  $('gallery-clear').onclick = () => { state.selected.clear(); renderCards(); if ($('gallery-selected-only').checked) guarded(() => refresh(true)); };
  $('gallery-reset').onclick = () => { $('gallery-provider').value = 'wfcd'; $('gallery-category').value = ''; $('gallery-search').value = ''; $('gallery-availability').value = 'available'; $('gallery-selected-only').checked = false; guarded(() => refresh(true)); };
  $('gallery-previous').onclick = () => guarded(async () => { state.offset = Math.max(0, state.offset - 72); await refresh(); $('gallery').scrollTop = 0; });
  $('gallery-next').onclick = () => guarded(async () => { state.offset += 72; await refresh(); $('gallery').scrollTop = 0; });
  $('gallery-export').onclick = () => guarded(async () => {
    state.exporting = true; countSelected(); $('gallery-cancel-export').hidden = false;
    try { const result = await api.galleryAction('export', { keys: [...state.selected], naming: $('gallery-naming').value });
      if (result) notify(`${result.canceled ? '已停止，' : ''}已导出 ${result.count} 张${result.failed?.length ? `，失败 ${result.failed.length} 张：${result.failed[0].message}` : ''}`, Boolean(result.failed?.length));
    } finally { state.exporting = false; countSelected(); $('gallery-cancel-export').hidden = true; }
  });
  $('gallery-cancel-export').onclick = () => guarded(() => api.galleryAction('cancel'));
  $('gallery-open-folder').onclick = () => guarded(() => api.galleryAction('open-folder'));
  api.onEvent(message => {
    if (message.event === 'gallery-export' && state.exporting) $('gallery-selection-count').textContent = `正在导出 ${message.value.done}/${message.value.total} · 成功 ${message.value.count}`;
    if (message.event === 'gallery-close-blocked') notify('图片正在导出。可先点“停止导出”，再关闭工作台。');
  });
  setAppearance(); countSelected();
  return { state, enter: () => state.entered ? Promise.resolve() : refresh(), refresh, detail };
}
