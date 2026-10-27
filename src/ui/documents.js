const $ = id => document.getElementById(id);
const el = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; };

export function createDocumentsUI({ api, guarded, notify }) {
  const state = { current: null, entered: false, sequence: 0, listing: 0, history: [] };
  let timer;
  function figure(alt, href) {
    const box = el('figure', 'docs-figure'), button = el('button', 'docs-figure-open'), img = el('img');
    img.alt = alt; img.decoding = 'async'; button.disabled = true; button.title = '点击放大图示';
    button.append(img); box.append(button, el('figcaption', '', alt + ' · 点击放大'));
    api.call('documentsImage', { documentId: state.current.id, href }).then(row => {
      if (!box.isConnected) return;
      img.src = row.dataUrl; button.disabled = false;
      button.onclick = () => {
        const dialog = el('dialog', 'docs-image-dialog'), head = el('div', 'docs-image-head'), close = el('button', 'small', '关闭 · Esc'), full = el('img');
        full.src = row.dataUrl; full.alt = alt; close.onclick = () => dialog.close();
        head.append(el('strong', '', alt), close); dialog.append(head, full); document.body.append(dialog);
        dialog.addEventListener('close', () => dialog.remove(), { once: true }); dialog.showModal(); close.focus();
      };
    }).catch(error => { if (box.isConnected) box.replaceChildren(el('p', 'hint', alt + '：' + error.message)); });
    return box;
  }
  const slug = value => value.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s+/g, '-');
  function anchor(hash) {
    let id; try { id = decodeURIComponent(hash.replace(/^#/, '')); } catch { return; }
    const target = [...$('docs-article').querySelectorAll('[id]')].find(node => node.id === id);
    target?.scrollIntoView({ block: 'start' });
  }
  function follow(href) {
    if (href.startsWith('#')) { anchor(href); return; }
    if (/^https?:\/\//i.test(href)) { guarded(() => api.openDocumentLink(href)); return; }
    try {
      const url = new URL(href.replace(/^<|>$/g, ''), 'https://workbench-docs.invalid/' + state.current.id);
      if (url.origin !== 'https://workbench-docs.invalid') throw new Error('不支持的文档链接');
      const id = decodeURIComponent(url.pathname.slice(1));
      if (!id.endsWith('.md')) { guarded(async () => { await api.copy(id); notify('文件路径已复制，可在项目中打开'); }); return; }
      guarded(() => open(id, url.hash));
    } catch { notify('无法打开这条文档链接', true); }
  }
  function inline(parent, source) {
    const pattern = /(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\([^\n)]+\))/g; let last = 0;
    for (const match of source.matchAll(pattern)) {
      parent.append(document.createTextNode(source.slice(last, match.index)));
      const token = match[0];
      if (token.startsWith('`')) parent.append(el('code', '', token.slice(1, -1)));
      else if (token.startsWith('**')) parent.append(el('strong', '', token.slice(2, -2)));
      else {
        const middle = token.indexOf(']('), label = token.slice(1, middle), href = token.slice(middle + 2, -1);
        const link = el('a', '', label); link.href = '#'; link.title = href;
        link.onclick = event => { event.preventDefault(); follow(href); }; parent.append(link);
      }
      last = match.index + token.length;
    }
    parent.append(document.createTextNode(source.slice(last)));
  }
  function render(text) {
    const article = $('docs-article'), outline = $('docs-outline'); article.replaceChildren(); outline.replaceChildren();
    const lines = text.replace(/\r\n/g, '\n').split('\n'), counts = new Map();
    const cells = line => line.trim().replace(/^\||\|$/g, '').split('|').map(cell => cell.trim());
    for (let i = 0; i < lines.length;) {
      const line = lines[i];
      if (!line.trim() || /^\s*<!--.*-->\s*$/.test(line)) { i++; continue; }
      const picture = /^!\[([^\]]*)\]\(([^\n)]+)\)\s*$/.exec(line.trim());
      if (picture) { article.append(figure(picture[1], picture[2])); i++; continue; }
      if (/^\s*```/.test(line)) {
        const language = line.trim().slice(3), code = []; i++;
        while (i < lines.length && !/^\s*```/.test(lines[i])) code.push(lines[i++]); i++;
        const box = el('div', 'docs-code'), bar = el('div', 'docs-code-bar'); bar.append(el('span', '', language || '文本'));
        const copy = el('button', 'small', '复制'); copy.onclick = () => guarded(async () => { await api.copy(code.join('\n')); notify('代码已复制'); }); bar.append(copy);
        const pre = el('pre'); pre.append(el('code', '', code.join('\n'))); box.append(bar, pre); article.append(box); continue;
      }
      const heading = /^(#{1,6})\s+(.+)$/.exec(line);
      if (heading) {
        const base = slug(heading[2]), count = counts.get(base) ?? 0; counts.set(base, count + 1);
        const node = el('h' + heading[1].length); node.id = base + (count ? '-' + count : ''); inline(node, heading[2]); article.append(node);
        if (heading[1].length <= 3) { const button = el('button', 'docs-outline-link', heading[2].replace(/`|\*\*/g, '')); button.style.paddingLeft = (heading[1].length - 1) * 10 + 'px'; button.onclick = () => anchor(node.id); outline.append(button); }
        i++; continue;
      }
      if (line.includes('|') && i + 1 < lines.length && /^\s*\|?\s*:?-{3,}/.test(lines[i + 1])) {
        const wrap = el('div', 'docs-table'), table = el('table'), head = el('thead'), body = el('tbody'), row = el('tr');
        for (const cell of cells(line)) { const node = el('th'); inline(node, cell); row.append(node); } head.append(row); i += 2;
        while (i < lines.length && lines[i].trim() && lines[i].includes('|')) { const row = el('tr'); for (const cell of cells(lines[i++])) { const node = el('td'); inline(node, cell); row.append(node); } body.append(row); }
        table.append(head, body); wrap.append(table); article.append(wrap); continue;
      }
      if (/^\s*[-*]\s+/.test(line) || /^\s*\d+\.\s+/.test(line)) {
        const ordered = /^\s*\d+\./.test(line), list = el(ordered ? 'ol' : 'ul');
        while (i < lines.length && (ordered ? /^\s*\d+\.\s+/ : /^\s*[-*]\s+/).test(lines[i])) { const item = el('li'); inline(item, lines[i++].replace(/^\s*(?:[-*]|\d+\.)\s+/, '')); list.append(item); }
        article.append(list); continue;
      }
      if (/^>\s?/.test(line)) { const quote = el('blockquote'); inline(quote, line.replace(/^>\s?/, '')); article.append(quote); i++; continue; }
      if (/^\s*(?:---+|\*\*\*+)\s*$/.test(line)) { article.append(el('hr')); i++; continue; }
      const paragraph = el('p'); inline(paragraph, line); article.append(paragraph); i++;
    }
  }
  async function open(id, hash = '', record = true) {
    const sequence = ++state.sequence; $('docs-reading-status').textContent = '正在读取…';
    const row = await api.call('documentsRead', { id }); if (sequence !== state.sequence) return;
    if (record && state.current?.id !== row.id) { if (state.current) state.history.push(state.current.id); if (state.history.length > 50) state.history.shift(); }
    state.current = row; render(row.text);
    $('docs-title').textContent = row.title; $('docs-path').textContent = row.id;
    $('docs-reading-status').textContent = `${row.group} · ${(row.bytes / 1024).toFixed(1)} KiB`;
    $('docs-archive-note').hidden = row.group !== '归档'; $('docs-back').disabled = !state.history.length;
    for (const node of $('docs-list').querySelectorAll('button')) node.classList.toggle('active', node.dataset.id === row.id);
    try { localStorage.setItem('workbench-document', row.id); } catch {}
    $('docs-reading').scrollTop = 0; if (hash) anchor(hash);
  }
  async function list() {
    const listing = ++state.listing, group = $('docs-group').value;
    $('docs-list-status').textContent = '正在查找…';
    const result = await api.call('documentsList', { query: $('docs-search').value, group: group === '当前文档' ? '全部' : group });
    if (listing !== state.listing) return;
    const rows = result.rows.filter(row => group !== '当前文档' || !['归档','WM'].includes(row.group)), container = $('docs-list'); container.replaceChildren();
    for (const name of ['总览', '新人入门', '深入理解', 'AI 协作', '工具', 'WM', '归档']) {
      const entries = rows.filter(row => row.group === name); if (!entries.length) continue;
      container.append(el('h3', '', `${name} · ${entries.length}`));
      for (const row of entries) { const button = el('button', 'docs-file', row.title); button.dataset.id = row.id; button.title = row.id; button.classList.toggle('active', row.id === state.current?.id); button.onclick = () => guarded(() => open(row.id)); container.append(button); }
    }
    if (!rows.length) container.append(el('p', 'muted', '没有匹配文档。可以切换到“全部”搜索归档。'));
    $('docs-list-status').textContent = `${rows.length} 篇 · 搜索标题、路径与全文`;
  }
  $('docs-search').oninput = () => { clearTimeout(timer); timer = setTimeout(() => guarded(list), 180); };
  $('docs-group').onchange = () => guarded(list);
  $('docs-refresh').onclick = () => guarded(async () => { await list(); if (state.current) await open(state.current.id, '', false); });
  $('docs-home').onclick = () => guarded(() => open('文档/README.md'));
  $('docs-back').onclick = () => guarded(async () => { const id = state.history.pop(); if (id) await open(id, '', false); });
  $('docs-copy').onclick = () => guarded(async () => { if (state.current) { await api.copy(state.current.text); notify('完整 Markdown 已复制'); } });
  $('docs-font').onchange = () => { $('docs-article').style.fontSize = $('docs-font').value + 'px'; try { localStorage.setItem('workbench-document-font', $('docs-font').value); } catch {} };
  try { const size = localStorage.getItem('workbench-document-font'); if (['14','16','18'].includes(size)) $('docs-font').value = size; } catch {}
  $('docs-font').onchange();
  return { state, open, async enter() { if (!state.entered) { await list(); let id; try { id = localStorage.getItem('workbench-document'); } catch {} try { await open(id || '文档/README.md', '', false); } catch { await open('文档/README.md', '', false); } state.entered = true; } } };
}
