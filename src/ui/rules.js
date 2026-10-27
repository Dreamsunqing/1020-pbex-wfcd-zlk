import { RULE_HELP, RULE_HELP_TITLES, RULE_GUIDE_ID } from '../core/merge/rule-help.mjs';
function el(tag, cls, text) { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; }
const sources = ['official', 'plus', 'wfcd', 'oracle'];
export function createRulesUI({ api, guarded, notify, openDocument }) {
  const $ = id => document.getElementById(id);
  const state = { loaded: null, draft: null, tab: 'general', dirty: false };
  function changed() { state.dirty = true; $('rules-state').textContent = '有未保存修改；保存后在“合并汇总”重新构建才生效。'; }
  function parseAdvanced() {
    const invalid = $('rules-content').querySelector(':invalid'); if (invalid) { invalid.reportValidity(); throw new Error('请先修正格式错误的输入'); }
 if (state.tab === 'json') { const value = JSON.parse($('rules-json').value); state.draft = { contract: value.contract, overrides: value.overrides }; } }
  async function enter() {
    if (state.loaded) return;
    load(await api.call('rulesGet'));
  }
  function load(value) { state.loaded = value; state.draft = structuredClone({ contract: value.contract, overrides: value.overrides }); state.dirty = false; render(); }
  function input(value, update, type = 'text') {
    const n = el('input'); n.type = type; if (type === 'number') n.step = 'any';
    if (type === 'checkbox') n.checked = Boolean(value); else n.value = value ?? '';
    n.title = n.value;
    n.onchange = () => { try { update(type === 'checkbox' ? n.checked : n.value); n.setCustomValidity(''); n.title = n.value; changed(); } catch (error) { n.setCustomValidity(error.message); notify('值格式错误：' + error.message); } }; return n;
  }
  function select(value, options, update) {
    const n = el('select');
    for (const [key, label] of Object.entries(options)) { const o = el('option', '', label); o.value = key; o.selected = key === value; n.append(o); }
    n.onchange = () => { update(n.value); changed(); }; return n;
  }
  function helpSection(section) {
    const details = el('details', 'rules-option-help'); details.dataset.section = section;
    details.append(el('summary', '', `每个选项的功能 · ${RULE_HELP_TITLES[section]}`));
    const list = el('dl');
    for (const [key, [label, stage, text]] of Object.entries(RULE_HELP[section])) {
      const term = el('dt'); term.append(el('code', '', key), el('strong', '', label), el('span', 'rules-stage', stage));
      list.append(term, el('dd', '', text));
    }
    details.append(list); return details;
  }
  function setting(body, section, key, control) {
    const [label, stage, text] = RULE_HELP[section][key], row = el('label', 'rules-setting');
    const wording = el('span', 'rules-setting-label'); wording.append(el('strong', '', label), el('code', '', section === 'scope' ? `scope.${key}` : key));
    control.setAttribute('aria-label', label); row.append(wording, control);
    body.append(row, el('p', 'rules-setting-help', `${stage} · ${text}`));
  }
  function table(rows, columns, make) {
    const wrap = el('div', 'rules-table-scroll'), table = el('table', 'rules-table'), head = el('tr');
    for (const column of columns) {
      const th = el('th', '', column.label), help = RULE_HELP[state.tab]?.[column.key];
      th.append(el('code', 'rules-column-key', column.key));
      if (help) { th.title = `${help[1]} · ${help[2]}`; th.append(el('small', 'rules-column-stage', help[1])); }
      head.append(th);
    }
    head.append(el('th', '', '操作'));
    const thead = el('thead'); thead.append(head); table.append(thead);
    table.style.minWidth = (columns.length * 190 + 80) + 'px';
    const tbody = el('tbody');
    rows.forEach((row, index) => {
      const tr = el('tr');
      for (const column of columns) {
        const td = el('td'), update = value => { if (column.json) row[column.key] = JSON.parse(value); else if (column.list) { const list = value.split(',').map(s => s.trim()).filter(Boolean); if (!list.length && column.optional) delete row[column.key]; else row[column.key] = list; } else if (column.number) { if (value === '') delete row[column.key]; else row[column.key] = Number(value); } else if (value === '' && column.optional) delete row[column.key]; else row[column.key] = value; };
        const value = column.json ? JSON.stringify(row[column.key]) : column.list ? row[column.key]?.join(',') : row[column.key];
        const control = column.options ? select(value, column.options, update) : input(value, update, column.check ? 'checkbox' : column.number ? 'number' : 'text');
        control.setAttribute('aria-label', `${column.label} ${index + 1}`); td.append(control); tr.append(td);
      }
      const td = el('td'), remove = el('button', 'small', '删除'); remove.onclick = () => { rows.splice(index, 1); changed(); renderContent(); }; td.append(remove); tr.append(td); tbody.append(tr);
    });
    table.append(tbody); wrap.append(table); const add = el('button', 'small', '＋ 添加一条'); add.onclick = () => { rows.push(make()); changed(); renderContent(); }; return [wrap, add];
  }
  function render() {
    $('rules-state').textContent = state.dirty ? '有未保存修改；保存后重新构建生效。' : `规则 ${state.loaded.revision.slice(0, 12)} · ${state.loaded.updatedAt ? new Date(state.loaded.updatedAt).toLocaleString() : '内置版本'} · ${state.loaded.note}`;
    $('rules-previous').disabled = !state.loaded.hasPrevious;
    renderContent();
  }
  function renderContent() {
    for (const b of document.querySelectorAll('[data-rules-tab]')) b.classList.toggle('selected', b.dataset.rulesTab === state.tab);
    const body = $('rules-content'); body.replaceChildren();
    const { contract: c, overrides: o } = state.draft;
    const intro = el('div', 'rules-guide-link'); intro.append(el('span', '', '① 校验 → ② 身份分类 → ③ 语言 → ④ 字段 → ⑤ 配方与关系 → ⑥ 版本产物'));
    if (openDocument) { const guide = el('button', 'small', '配置文档与添加示例 ↗'); guide.onclick = () => guarded(() => openDocument(RULE_GUIDE_ID)); intro.append(guide); }
    body.append(intro, helpSection(state.tab));
    if (state.tab === 'general') body.append(helpSection('scope'));
    if (state.tab === 'json') { const area = el('textarea', 'rules-json'); area.id = 'rules-json'; area.setAttribute('aria-label', '完整合并规则 JSON'); area.value = JSON.stringify(state.draft, null, 2); area.oninput = changed; body.append(el('p', 'hint', '完整配置：contract 为分类、映射与别名；overrides 为人工修订。此处不执行脚本。切换标签时会解析 JSON。'), area); return; }
    if (state.tab === 'general') {
      body.append(el('h2', '', '版本与来源顺序'), el('p', 'hint', '优先级从左到右。中文名称先取指定语言的官方标题，再查语言键对应字典，再查 WFCD 本地化；缺失时保留英文／原标识。字段可单独覆盖来源顺序。'));
      for (const key of ['mappingVersion', 'builderVersion']) setting(body, 'general', key, input(c[key], v => c[key] = v));
      setting(body, 'general', 'priority', input(c.priority.join(','), v => c.priority = v.split(',').map(s => s.trim())));
      setting(body, 'general', 'locales', input(c.locales.join(','), v => c.locales = v.split(',').map(s => s.trim())));
      setting(body, 'scope', 'maxEntities', input(c.scope.maxEntities, v => c.scope.maxEntities = Number(v), 'number'));
      body.append(el('h2', '', '协作流程'), el('p', '', '资料人员维护分类与中文字段说明，开发维护字段语义与引用别名，复核人员填写受源哈希保护的人工修订。修改 → 校验 → 写修改说明 → 保存 → 合并汇总构建 → 检查差异和问题。规则保存在本机，可导出 JSON 进入 Git 后共同评审。'));
    } else if (state.tab === 'catalogs') {
      body.append(el('p', 'hint', '文件路径相对来源目录。map：以键作为 ID；array：数组；group：指定顶层数组；nested：递归收集路径键实体。停用后仍可在参考文件中保留原始资料。'));
      body.append(...table(c.catalogs, [
        { key: 'enabled', label: '启用', check: true }, { key: 'source', label: '来源', options: Object.fromEntries(sources.map(s => [s, s])) }, { key: 'file', label: '来源内文件' }, { key: 'kind', label: '类别', options: state.loaded.kinds }, { key: 'classificationPriority', label: '分类优先级', number: true }, { key: 'shape', label: '结构', options: { map: 'map', array: 'array', group: 'group', nested: 'nested' } }, { key: 'group', label: '顶层分组', optional: true }, { key: 'idKey', label: '标识字段', optional: true }, { key: 'locale', label: '语言', options: { '': '语言键／无', ...Object.fromEntries([...new Set(['zh-CN', 'en', ...c.locales, ...c.catalogs.map(r => r.locale).filter(Boolean)])].map(locale => [locale, ({ 'zh-CN': '中文', en: '英文' })[locale] ?? locale])) }, optional: true }
      ], () => ({ enabled: true, source: 'plus', file: 'ExportNew.json', kind: 'misc', shape: 'map' })));
    } else if (state.tab === 'fields') {
      body.append(el('p', 'hint', '仅合并语义相同的字段。不把紫卡档位当系数，不把攻击模式数组强行相加。类别和优先级使用逗号分隔；空优先级采用全局顺序。'));
      body.append(...table(c.fields, [
        { key: 'path', label: '统一字段路径' }, { key: 'key', label: '来源字段' }, { key: 'label', label: '中文标题' }, { key: 'description', label: '中文说明', optional: true }, { key: 'kinds', label: '适用类别／*', list: true }, { key: 'type', label: '类型', options: { number: 'number', integer: 'integer', string: 'string', boolean: 'boolean' } }, { key: 'unit', label: '单位', optional: true }, { key: 'min', label: '最小值', number: true }, { key: 'max', label: '最大值', number: true }, { key: 'precision', label: '精度', number: true }, { key: 'priority', label: '字段优先级', list: true, optional: true }, { key: 'required', label: '必需字段', check: true }
      ], () => ({ path: 'custom.newField', key: 'newField', label: '新字段', kinds: ['*'], type: 'string' })));
    } else if (state.tab === 'nested') {
      c.nested ??= structuredClone(state.loaded.nestedDefaults);
      body.append(el('p', 'hint', '对象逐子字段合并；有完整内部 ID 的对象数组按 ID 对齐，无 ID 数组保留整组候选，不按序号或同名猜测。下列规则指定哪些嵌套集合建为实体／关联。只含 ID 与数量的组件只建关系；分类和数量仍可回查原字段。旧规则缺少本节时使用内置规则，保存后写入配置。'));
      body.append(...table(c.nested, [
        { key: 'enabled', label: '启用', check: true }, { key: 'key', label: '来源集合字段' }, { key: 'path', label: '统一集合字段' }, { key: 'label', label: '中文标题' }, { key: 'relation', label: '关系类型' }, { key: 'entityKind', label: '嵌套实体类别', options: { '': '仅关联', ...state.loaded.kinds }, optional: true }, { key: 'reverse', label: '反向父级', check: true }
      ], () => ({ enabled: true, key: 'newItems', path: 'customItems', label: '关联物品', relation: 'related-item' })));
    } else if (state.tab === 'aliases') {
      body.append(el('p', 'hint', '别名用于配方和奖励引用。仅应用一次最长匹配，不按同名猜测，也不修改源 JSON。'));
      body.append(...table(c.aliases, [{ key: 'mode', label: '匹配', options: { prefix: '前缀', exact: '完整路径' } }, { key: 'from', label: '来源路径' }, { key: 'to', label: '统一路径' }], () => ({ mode: 'exact', from: '/Lotus/Old', to: '/Lotus/New' })));
    } else {
      body.append(el('p', 'hint', '实体 ID、字段路径和源文件 SHA-256 可从合并详情复制。值必须是 JSON，例如中文写成 "名称"；源哈希过期会阻止构建。必须写明修改依据。'));
      body.append(...table(o.entries, [{ key: 'entityId', label: '实体 ID' }, { key: 'field', label: '统一字段' }, { key: 'expectedSourceHash', label: '预期源 SHA-256' }, { key: 'value', label: '修订值 JSON', json: true }, { key: 'reason', label: '依据' }], () => ({ entityId: '', field: 'name.zh-CN', expectedSourceHash: '', value: '', reason: '' })));
    }
  }
  for (const b of document.querySelectorAll('[data-rules-tab]')) b.onclick = () => guarded(async () => { parseAdvanced(); state.tab = b.dataset.rulesTab; renderContent(); });
  $('rules-validate').onclick = () => guarded(async () => { parseAdvanced(); const result = await api.call('rulesValidate', state.draft); notify(`结构校验通过：${result.catalogs} 条分类、${result.fields} 个字段、${result.overrideCount} 条修订；构建时仍会核验源数据与哈希。`); });
  $('rules-save').onclick = () => guarded(async () => { parseAdvanced(); const saved = await api.call('rulesSave', { ...state.draft, expectedRevision: state.loaded.revision, note: $('rules-note').value }); load(saved); $('rules-note').value = ''; notify('规则已保存；请到合并汇总重新构建。'); });
  $('rules-previous').onclick = () => guarded(async () => { const previous = await api.call('rulesPrevious'); state.draft = { contract: previous.contract, overrides: previous.overrides }; changed(); renderContent(); notify('上一版已载入为草稿，校验并保存后才生效。'); });
  $('rules-export').onclick = () => guarded(async () => { parseAdvanced(); await api.exportRules(state.draft); });
  $('rules-import').onchange = () => guarded(async () => { const file = $('rules-import').files[0]; if (!file) return; if (file.size > 2000000) throw new Error('规则文件须小于 2 MB'); const value = JSON.parse(await file.text()); await api.call('rulesValidate', value); state.draft = { contract: value.contract, overrides: value.overrides }; changed(); renderContent(); $('rules-import').value = ''; notify('已导入为草稿，保存后才生效。'); });
  return { enter, state };
}
