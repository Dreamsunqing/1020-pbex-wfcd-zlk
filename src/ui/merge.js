import { decorateImages } from './images.js';
import { renderGameText, plainGameText } from './game-text.js';
let kinds = { weapon: '武器', warframe: '战甲', resource: '资源／部件', blueprint: '蓝图', mod: 'Mod' };
const statuses = { resolved: '已关联', missing: '未提供', conflict: '待复核', override: '人工规则' };
const relations = { produces: '制作成品', requires: '配方材料', rewards: '奖励包含', 'has-ability': '技能', 'has-component': '组件／制造材料', 'includes-item': '附带物品', 'has-exalted': '显赫武器', 'augmented-by': '集团卡／强化 Mod', 'subsumed-ability': '同系可移植技能' };
const incomingRelations = { produces: '制作蓝图', requires: '被配方使用', rewards: '奖励来源', 'has-ability': '所属战甲／物品', 'has-component': '用于物品', 'includes-item': '由物品附带', 'has-exalted': '所属角色', 'augmented-by': '强化对象', 'subsumed-ability': '可移植技能所属战甲' };
const format = value => value === null || value === undefined ? '—' : typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
function node(tag, cls, text) { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) { if (tag === 'code' || tag === 'pre') n.textContent = text; else renderGameText(n, text, /^h[1-6]$/.test(tag) || /title|target|augment-name|original/.test(cls ?? '') ? 'name' : 'description'); } return n; }
export function createMergeUI({ api, openSource, notify, guarded }) {
  const $ = id => document.getElementById(id);
  const state = { status: null, selected: null, history: [], view: 'catalog', query: '', kind: '', offset: 0, generation: 0, request: 0, building: false, includeInternal: false, locale:'zh-CN', rewardTableId:null, returnToRewards:null };
  api.onEvent?.(message => { if (state.building && message.event === 'progress' && message.value?.message) $('merge-summary').textContent = message.value.message; });
  const title = item => plainGameText(item.name?.[state.locale] ?? item.name?.en ?? item.id.split('/').at(-1), 'name');
  const body = () => $('merge-content');
  const version = () => state.status?.manifest?.datasetVersion;
  const invoke = (method, args = {}) => api.call(method, { ...args, locale:state.locale, datasetVersion: version() });
  function controls() {
    $('merge-build').disabled = state.building;
    $('merge-build').textContent = state.building ? '正在构建…' : '构建全量资料';
    $('merge-export').disabled = !version() || state.building;
    $('merge-copy').disabled = !version();
    $('merge-filters').hidden = !version() || Boolean(state.selected) || Boolean(state.rewardTableId);
    $('merge-kind').hidden = state.view !== 'catalog';
    $('merge-internal-filter').hidden = state.view !== 'catalog';
    for (const button of document.querySelectorAll('[data-merge-view]')) button.classList.toggle('selected', button.dataset.mergeView === state.view);
    const status = state.status;
    if (!status?.available) { $('merge-summary').textContent = '尚未构建当前目录或快照。将按保存的规则合并全部静态分类、配方和奖励表。'; return; }
    const m = status.manifest;
    const locales=m.locales ?? ['zh-CN','en'];
    if(!locales.includes(state.locale))state.locale=locales[0];
    $('merge-locale').replaceChildren(...locales.map(locale=>{const option=node('option','',({'zh-CN':'简体中文','zh-TW':'繁體中文',en:'English',fr:'Français'})[locale] ?? locale);option.value=locale;return option;}));
    $('merge-locale').value=state.locale;
    $('merge-locale').disabled=state.view!=='catalog';
    $('merge-summary').textContent = `${m.datasetVersion.slice(0, 12)} · ${m.summary.entities} 个实体 · ${m.summary.recipes} 份配方 · ${m.summary.rewardTables} 张奖励表 · ${m.summary.relations} 条关系 · ${m.summary.issues} 项提示 · ${m.summary.conflicts} 项字段差异`;
    if (status.needsRebuild) $('merge-summary').textContent += ' · 旧版资料：重新构建可更新中文描述与 Mod 等级效果';
    $('merge-summary').title = `schemaVersion ${m.schemaVersion}\nmappingVersion ${m.mappingVersion}\n${m.datasetVersion}`;
  }
  function reset() {
    state.generation++; state.request++; state.status = null; state.selected = null; state.rewardTableId=null;state.returnToRewards=null;state.history = []; state.query = ''; state.kind = ''; state.offset = 0; state.view = 'catalog'; state.building = false;
    $('merge-search').value = ''; $('merge-kind').value = ''; state.includeInternal = false; $('merge-internal').checked = false; controls();
    body().replaceChildren(node('p', 'merge-empty', '选择资料目录后，点击“构建全量资料”生成离线数据。'));
  }
  async function enter() {
    const generation = state.generation, request = ++state.request;
    const status = await api.call('mergeStatus');
    if (generation !== state.generation || request !== state.request) return;
    if (version() && version() !== status.manifest?.datasetVersion) { state.selected = null; state.rewardTableId=null;state.returnToRewards=null;state.history = []; }
    state.status = status; controls(); await render();
  }
  async function build(profile) {
    if (state.building) return;
    const generation = state.generation; state.building = true; controls(); $('merge-error').hidden = true;
    try {
      const status = await api.call('mergeBuild', profile === 'pilot' ? { profile } : {});
      if (generation !== state.generation) return;
      state.status = status; state.selected = null;state.rewardTableId=null;state.returnToRewards=null; state.history = []; state.offset = 0;
      await render(); notify('全量构建完成，请检查问题、覆盖和差异报告');
    } catch (error) {
      if (generation === state.generation) { $('merge-error').textContent = `构建失败，保留上一份成功资料：${error.message}`; $('merge-error').hidden = false; }
    } finally { if (generation === state.generation) { state.building = false; controls(); } }
  }
  function sourceLink(source, text = '查看原字段 ↗') {
    const button = node('button', 'link merge-source-link', text);
    button.title = `${source.file}\n${source.pointer}${source.line ? '\n行号 ' + source.line : ''}\nSHA-256 ${source.hash}`;
    button.onclick = () => guarded(() => openSource(source)); return button;
  }
  function sourceEvidence(source) {
    const wrap = node('div', 'merge-evidence');
    wrap.append(node('code', '', source.file + '\n' + source.pointer), sourceLink(source)); return wrap;
  }
  async function render() {
    controls(); const request = ++state.request, generation = state.generation;
    if (!version()) { body().replaceChildren(node('p', 'merge-empty', '点击“构建全量资料”开始。构建只读取当前资料，不修改原 JSON。')); return; }
    body().replaceChildren(node('p', 'merge-empty', '读取合并资料…'));
    const stillCurrent = () => request === state.request && generation === state.generation;
    if (state.view === 'catalog') {
      if (state.selected) { const detail = await invoke('mergeDetail', { id: state.selected }); if (stillCurrent()) renderDetail(detail); }
      else { const page = await invoke('mergeList', { query: state.query, kind: state.kind, offset: state.offset, limit: 80, includeInternal: state.includeInternal }); if (stillCurrent()) renderList(page); }
    } else {
      const data = await invoke('mergeReport', { type: state.view, offset: state.rewardTableId?0:state.offset, query: state.rewardTableId?'':state.query, tableId:state.view==='rewards'?state.rewardTableId:null });
      if (!stillCurrent()) return;
      if (state.view === 'issues') renderIssues(data);
      else if (state.view === 'changes') renderChanges(data);
      else if(state.rewardTableId)renderRewardDetail(data);else renderRewards(data);
      if(!state.rewardTableId)reportPager(data);
    }
  }
  function renderList(page) {
    if (page.kinds) { kinds = page.kinds; const options = [node('option', '', '全部类别'), ...Object.entries(kinds).map(([key,label]) => { const o = node('option','',label); o.value = key; return o; })]; options[0].value = ''; $('merge-kind').replaceChildren(...options); $('merge-kind').value = state.kind; }
    body().replaceChildren();
    const grid = node('div', 'json-card-grid merge-card-grid'), images = [];
    for (const item of page.rows) {
      const card = node('article', 'json-preview-card'); card.dataset.entityId = item.id;
      const heading = node('h2', 'json-card-title', title(item)); heading.title = title(item);
      card.append(node('span', 'json-card-key', kinds[item.kind] ?? item.kind), heading);
      if (item.name.en && item.name.en !== title(item)) card.append(node('p', 'json-card-original', item.name.en));
      const origin = node('span', 'json-card-origin', item.id.split('/').at(-1)); origin.title = item.id; card.append(origin);
      const badges = node('div', 'merge-list-badges'); appendBadges(badges, item.id, page.badges, undefined, true); card.append(badges);
      if (item.internalReason) { const badge = node('span', 'merge-internal-badge', '内部定义'); badge.title = item.internalReason; badges.append(badge); }
      const open = node('button', 'small json-card-open', '查看合并详情'); card.append(open);
      card.onclick = () => guarded(() => showDetail(item.id)); grid.append(card); images.push({ ...page.images?.[item.id], id: item.id, imageName: page.imageNames?.[item.id] ?? page.images?.[item.id]?.imageName, card, label: title(item) });
    }
    if (!page.rows.length) grid.append(node('p', 'merge-empty', '没有匹配的合并物品。'));
    const pagination = node('div', 'pagination'), actions = node('div');
    const prev = node('button', 'small', '上一页'), next = node('button', 'small', '下一页');
    prev.disabled = state.offset === 0; next.disabled = !page.hasMore;
    prev.onclick = () => guarded(async () => { state.offset = Math.max(0, state.offset - 80); await render(); });
    next.onclick = () => guarded(async () => { state.offset += 80; await render(); });
    actions.append(prev, next); pagination.append(node('span', '', `${page.total} 个实体 · 当前显示 ${page.rows.length} 项${!page.includeInternal && page.hiddenCount ? ` · 已隐藏 ${page.hiddenCount} 个内部定义` : ''}`), actions); body().append(grid, pagination); void decorateImages(api, images);
  }
  async function showDetail(id) {
    if(state.view==='rewards'&&state.rewardTableId)state.returnToRewards={tableId:state.rewardTableId,offset:state.offset,query:state.query};
    if (state.selected && state.selected !== id) state.history.push(state.selected);
    if (!state.selected) state.history = [];
    state.view = 'catalog'; state.selected = id; await render();
  }
  function valueView(value, detail) {
    if (value && typeof value === 'object') {
      const entries = Object.entries(value), tree = node('details', 'merge-value-tree');
      tree.append(node('summary', '', `${Array.isArray(value) ? '数组' : '对象'} · ${entries.length} 项`));
      let offset = 0;
      const children = node('div', 'merge-value-children');
      const more = node('button', 'small', '继续展开');
      const load = () => {
        more.remove();
        for (const [key, child] of entries.slice(offset, offset + 40)) {
          const row = node('div', 'merge-value-entry');
          row.append(detail.references?.[key] ? referenceButton(key, detail) : node('code', '', key), valueView(child, detail)); children.append(row);
        }
        offset += 40; if (offset < entries.length) { more.textContent = `继续展开 · 剩余 ${entries.length - offset} 项`; children.append(more); }
      };
      more.onclick = load;
      tree.ontoggle = () => { if (tree.open && !children.childElementCount) load(); };
      tree.append(children); return tree;
    }
    if (typeof value === 'string' && detail.references?.[value]) return referenceButton(value, detail);
    const display = node('pre', 'field-value'); renderGameText(display, format(value)); return display;
  }
  function referenceButton(id, detail) {
    const button = node('button', 'link merge-reference-link', detail.references[id] + ' ↗'); button.title = id; button.dataset.mergeRef = id;
    button.onclick = () => guarded(() => showDetail(id)); return button;
  }
  function appendBadges(container, id, badges, donor, compact = false) {
    const data = badges?.[id]; if (!data) return;
    const wrap = node('span', 'merge-name-badges' + (compact ? ' compact' : ''));
    for (const augment of data.augments) {
      const button = node('button', 'merge-name-badge merge-augment-link');
      button.append(node('span', 'merge-augment-kind', augment.badge));
      if (!compact) button.append(node('strong', 'merge-augment-name', augment.title));
      const arrow = node('span', 'merge-jump-arrow', '↗'); arrow.setAttribute('aria-hidden', 'true'); button.append(arrow);
      button.setAttribute('aria-label', '查看' + augment.badge + '：' + augment.title);
      button.dataset.augmentTarget = augment.itemId;
      button.title = augment.title + ' · 点击查看 Mod；关联不代表商店当前可购买';
      button.onclick = event => { event?.stopPropagation(); return guarded(() => showDetail(augment.itemId)); }; wrap.append(button);
    }
    if (data.transferable) {
      const button = node('button', 'merge-name-badge transferable', donor === false ? '同系可移植' : '可移植技能'); button.dataset.abilityTarget = id;
      button.title = '跳转合并后的 ExportAbilities 技能记录；仅普通战甲可作为献出材料';
      button.onclick = event => { event?.stopPropagation(); return guarded(() => showDetail(id)); }; wrap.append(button);
    }
    if (wrap.childElementCount) container.append(wrap);
  }
  function linkedCard({ target, label, detail, relation = null, outgoing = true, navigable = true, kind = null, slot, quantity, sources = true }) {
    const card = node('article', 'merge-connection-card'); card.dataset.targetKind = kind ?? ''; 
    if (relation) { card.dataset.relationKind = relation.kind; if (relation.kind === 'augmented-by' && outgoing) card.classList.add('merge-augment-card'); }
    const action = kind === 'ability' ? '查看技能详情' : kind === 'mod' ? '查看 Mod 详情' : relation?.kind === 'has-component' && outgoing ? '查看组件详情' : '查看物品详情';
    if (navigable) {
      card.classList.add('navigable'); card.tabIndex = 0; card.setAttribute('role', 'link'); card.setAttribute('aria-label', action + '：' + label);
      card.onclick = event => { if (!event.target.closest('button, a, summary, details')) return guarded(() => showDetail(target)); };
      card.onkeydown = event => { if (event.target === card && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); return guarded(() => showDetail(target)); } };
    }
    const meta = slot ? '技能 ' + slot : quantity !== undefined ? quantity === null ? '数量待核对' : '数量 ×' + quantity : kinds[kind] ?? '关联物品';
    card.append(node('span', 'muted', meta));
    const button = node('button', 'link merge-relation-target', label); button.disabled = !navigable;
    button.dataset.mergeTarget = target; button.title = target; button.onclick = () => guarded(() => showDetail(target));
    const titleRow = node('div', 'merge-linked-title'); titleRow.append(button);
    const subsumed = detail.relations.find(r => r.kind === 'subsumed-ability' && r.from === detail.item.id && r.to === target);
    appendBadges(titleRow, target, detail.badges, subsumed?.donor);
    card.append(titleRow);
    if (relation?.alsoIngredient) card.append(node('span', 'muted', '亦作为该配方的材料')); 
    card.dataset.imageTarget = target;
    const open = node('button', 'small merge-card-open', action + ' →'); open.disabled = !navigable; open.onclick = () => guarded(() => showDetail(target)); card.append(open);
    if (sources && relation?.source) {
      const evidence = node('details', 'merge-candidates');
      const evidenceSources = relation.sources ?? [relation.source]; evidence.append(node('summary', '', '关联来源 · ' + evidenceSources.length + ' 处'));
      for (const source of evidenceSources) evidence.append(sourceEvidence(source)); card.append(evidence);
    }
    return card;
  }
  function membershipView(field, detail) {
    const collection = field.field.split('[')[0];
    if (!field.field.includes('[') || !detail.collectionDefinitions?.[collection] || !field.value?.itemId) return null;
    const id = field.value.itemId;
    return linkedCard({ target: id, label: detail.references[id] ?? id.split('/').at(-1), detail, kind: detail.badges?.[id]?.kind, slot: field.value.slot, quantity: field.value.count, navigable: Boolean(detail.references[id]), sources: false });
  }
  function renderDetail(detail) {
    body().replaceChildren();
    const back = node('button', 'small merge-back', state.returnToRewards?'← 返回奖励详情':'← 返回统一资料'); back.onclick = () => guarded(async () => { state.selected = null; state.history = []; if(state.returnToRewards){const previous=state.returnToRewards;state.view='rewards';state.rewardTableId=previous.tableId;state.offset=previous.offset;state.query=previous.query;state.returnToRewards=null;} await render(); });
    const navigation = node('div', 'actions merge-detail-nav');
    if (state.history.length) { const previous = node('button', 'small merge-previous', '← 返回上一物品'); previous.onclick = () => guarded(async () => { state.selected = state.history.pop(); await render(); }); navigation.append(previous); }
    navigation.append(back);
    const card = node('article', 'json-preview-card json-record-card merge-record'); card.dataset.entityId = detail.item.id; card.dataset.targetKind = detail.item.kind;
    card.append(node('span', 'json-card-key', kinds[detail.item.kind]), node('h2', 'json-record-title', title(detail.item)), node('code', 'merge-entity-id', detail.item.id));
    appendBadges(card.querySelector('.json-record-title'), detail.item.id, detail.badges);
    if (detail.item.kind === 'ability') card.append(node('p', 'merge-ability-directory', 'ExportAbilities · 合并技能目录（原始来源见各字段）'));
    if (detail.internalReason) card.append(node('p', 'hint', detail.internalReason));
    card.append(node('p', 'muted', '字段值来自当前构建；展开字段来源可查看候选值、转换规则和原文件。'));
    const fields = node('div', 'record-fields');
    const definitions = new Map(detail.definitions.map(d => [d.path, d]));
    for (const field of detail.fields) {
      const textField=/^(name|description|passiveDescription)\.(.+)$/.exec(field.field);
      if(textField) {
        const values=detail.item[textField[1]] ?? {},resolved=Object.hasOwn(values,state.locale)?state.locale:Object.hasOwn(values,'en')?'en':state.locale;
        if(textField[2]!==resolved)continue;
        if(resolved!==state.locale)field.localization={requestedLocale:state.locale,locale:resolved,fallback:true};
      }
      const row = node('section', 'record-field'), label = node('div', 'record-field-label'), content = node('div', 'record-field-content');
      const def = definitions.get(field.field), heading = node('div', 'field-heading');
      const displayName = def?.label ?? (field.field.includes('[') ? detail.collectionDefinitions?.[field.field.split('[')[0]] : null) ?? ({ name: '名称', description: '描述', recipe: '配方' })[field.field.split('.')[0]] ?? (field.guide?.status === 'unknown' ? null : field.guide?.label) ?? field.field;
      const ranked = field.selected === null ? null : field.candidates[field.selected]?.transform === 'max-rank-stats' ? field.candidates[field.selected] : null;
      heading.append(node('strong', '', ranked ? `${displayName}（满级效果 · 等级 ${ranked.rank}）` : displayName), node('code', '', field.field), node('span', 'merge-status ' + field.status, statuses[field.status]));
      label.append(heading, node('p', 'field-description', def?.description ?? (def?.unit ? `单位：${def.unit}` : field.guide?.description ?? field.rule)));
      let display = format(field.value);
      if (def?.unit === '比例' && typeof field.value === 'number') display = `${Number((field.value * 100).toFixed(6))}% · 原比例 ${field.value}`;
      const gameValue = node('pre', 'field-value'); renderGameText(gameValue, display, /(?:^|\.)(?:name|abilityName)(?:\.|$)/.test(field.field) ? 'name' : 'description');
      content.append(membershipView(field, detail) ?? (field.value && typeof field.value === 'object' ? valueView(field.value, detail) : typeof field.value === 'string' && detail.references?.[field.value] ? referenceButton(field.value, detail) : gameValue));
      const evidence = node('details', 'merge-candidates'); evidence.append(node('summary', '', `字段来源 · ${field.candidates.length} 个候选 · ${statuses[field.status]}`), node('p', 'muted', field.rule));
      if (field.override) evidence.append(node('pre', '', '人工规则：' + format(field.override)));
      field.candidates.forEach((candidate, i) => {
        const candidateNode = node('div', 'merge-candidate');
        candidateNode.append(node('strong', '', `${i === field.selected ? '采用' : '候选'} · ${candidate.source.source}`), node('pre', '', `取值：${format(candidate.value)}\n原值：${format(candidate.rawValue)}\n转换：${candidate.transform}`), sourceEvidence(candidate.source));
        if (candidate.dictionary) candidateNode.append(sourceEvidence(candidate.dictionary));
        if (candidate.resultSource) { candidateNode.append(node('p', 'muted', '派生命名的成品来源'), sourceEvidence(candidate.resultSource.source)); if (candidate.resultSource.dictionary) candidateNode.append(sourceEvidence(candidate.resultSource.dictionary)); }
        evidence.append(candidateNode);
      });
      if(field.localization) {
        const info=field.localization;content.prepend(node('p','muted merge-locale-status',`${info.fallback?'缺少 '+info.requestedLocale+'，回退到':'文本语言'}：${info.locale}${info.partial?' · 部分文字保留原文':''}`));
        if(info.source)evidence.append(sourceEvidence(info.source));
        for(const ref of info.dictionarySources ?? []) {evidence.append(node('p','muted','字典键：'+ref.key),sourceEvidence(ref.source),sourceEvidence(ref.dictionary));}
      }
      content.append(evidence); row.append(label, content); fields.append(row);
    }
    card.append(fields);
    const connections = node('section', 'merge-relations'); connections.append(node('h2', '', '技能、组件与关联关系'));
    const groups = new Map();
    const displayRelations = detail.relations.filter(relation => !(relation.kind === 'requires' && relation.to === detail.item.id && detail.relations.some(other => other.kind === 'produces' && other.from === relation.from && other.to === relation.to)));
    for (const original of displayRelations) {
      const relation = { ...original, alsoIngredient: original.kind === 'produces' && detail.relations.some(other => other.kind === 'requires' && other.from === original.from && other.to === original.to) };
      const outgoing = relation.from === detail.item.id, target = outgoing ? relation.to : relation.from;
      const label = outgoing ? relations[relation.kind] ?? detail.relationDefinitions?.[relation.kind] ?? relation.kind : incomingRelations[relation.kind] ?? '被引用 · ' + (detail.relationDefinitions?.[relation.kind] ?? relation.kind);
      if (!groups.has(label)) groups.set(label, []); groups.get(label).push({ relation, outgoing, target });
    }
    const order = ['技能', '集团卡／强化 Mod', '组件／制造材料', '附带物品', '显赫武器'];
    for (const [label, rows] of [...groups].sort(([a], [b]) => (order.includes(a) ? order.indexOf(a) : 99) - (order.includes(b) ? order.indexOf(b) : 99))) {
      const section = node('section', 'merge-connection-group'); section.append(node('h3', '', `${label} · ${rows.length}`));
      const grid = node('div', 'merge-linked-grid');
      rows.sort((a,b) => (a.relation.slot ?? 0) - (b.relation.slot ?? 0));
      for (const { relation, outgoing, target } of rows) {
        const row = linkedCard({ target, label: outgoing ? relation.toLabel : relation.fromLabel, detail, relation, outgoing, navigable: relation.navigable, kind: detail.badges?.[target]?.kind, slot: relation.slot, quantity: relation.quantity });
        grid.append(row);
      }
      section.append(grid); connections.append(section);
    }
    if (!detail.relations.length) connections.append(node('p', 'muted', '当前资料没有该物品的关联记录。'));
    card.insertBefore(connections, fields);
    const extras = node('details', 'merge-source-records'); extras.append(node('summary', '', `来源完整记录与待释义字段 · ${detail.sources.length} 份`));
    for (const source of detail.sources) {
      const record = node('details', 'merge-candidate'); record.append(node('summary', '', `${source.source.source} · ${source.locale ?? '语言键'} · ${source.unmodeled.length} 个待维护业务映射的字段`), sourceEvidence(source.source), node('p', 'muted', '待维护业务映射：' + source.unmodeled.join('、')), node('pre', 'field-value', format(source.value))); extras.append(record);
    }
    card.append(extras); body().append(navigation, card);
    void decorateImages(api, [...card.querySelectorAll('[data-image-target]')].map(link => ({ ...detail.images?.[link.dataset.imageTarget], id: link.dataset.imageTarget, card: link, label: link.querySelector('.merge-relation-target')?.textContent })));
    void decorateImages(api, [{ ...detail.image, id: detail.item.id, imageName: detail.imageName ?? detail.image?.imageName, card, label: title(detail.item) }], true);
  }
  function renderIssues(data) {
    body().replaceChildren(node('p', 'hint', '字段与关系差异保留为待复核，缺失引用显式标记。结构损坏、哈希变化或失效修订会阻止构建切换。'));
    body().append(node('p', 'muted', `中文名缺失 ${data.coverage.missingTranslations} 项；字段差异 ${data.coverage.conflicts} 项。嵌套对象已经逐字段合并；待维护业务释义的字段可在来源完整记录中查看。`));
    const list = node('div', 'merge-issue-list');
    for (const issue of data.issues) {
      const row = node('article', 'merge-issue'); row.append(node('span', 'merge-status ' + issue.severity, issue.code), node('strong', '', issue.field ?? '输入文件'), node('p', '', issue.message));
      if (issue.entityId) { const button = node('button', 'link', issue.entityId.split('/').at(-1)); button.onclick = () => guarded(() => showDetail(issue.entityId)); row.append(button); }
      for (const source of issue.sources) row.append(sourceLink(source)); list.append(row);
    }
    body().append(list);
    if(data.localization){const languages=node('details','merge-candidate');languages.append(node('summary','','语言映射覆盖报告'),node('pre','',format(data.localization)));body().append(languages);}
    const coverage = node('details', 'merge-candidate'); coverage.append(node('summary', '', '完整覆盖报告及未建模字段'), node('pre', '', format(data.coverage))); body().append(coverage);
  }
  function renderChanges(data) {
    body().replaceChildren(node('p', 'hint', data.firstBuild ? '首次构建，以空资料为基线：下列实体均为新增。' : `上一构建 ${data.before.slice(0, 12)} → 当前 ${data.after.slice(0, 12)}`));
    body().append(node('p', 'muted', `${data.changedInputs.length} 个输入文件变化；${data.total ?? data.changes.length} 项实体／配方／奖励表变化。同一输入重复构建保留原比较基线。`));
    for (const change of data.changes) {
      const entry = node('details', 'merge-candidate'); entry.append(node('summary', '', `${({ added: '新增', removed: '删除', changed: '修改' })[change.kind]} · ${change.entityId.split('/').at(-1)} · ${change.file}`), node('pre', '', format(change))); body().append(entry);
    }
    const inputs = node('details', 'merge-candidate'); inputs.append(node('summary', '', '变化的输入文件'), node('pre', '', data.changedInputs.join('\n'))); body().append(inputs);
  }
  async function showRewardDetail(id) {
    state.rewardTableId=id;await render();$('merged').scrollTop=0;
  }
  function renderRewards(data) {
    body().replaceChildren(node('p', 'hint', '完整奖励表 · 点击卡片进入详情，查看任务说明、奖励池和物品来源。'));
    const grid=node('div','merge-reward-catalog');
    for(const table of data.tables) {
      const card=node('article','merge-reward-table'),context=table.context,count=table.pools.reduce((n,p)=>n+p.items.length,0);
      card.dataset.rewardTable=table.id;card.tabIndex=0;
      const heading=node('h2','',context?.title??table.id.split('/').at(-1));heading.title=heading.textContent;
      const description=node('p','merge-reward-description',context?.description??'任务说明待补充');description.title=description.textContent;
      const code=node('code','merge-reward-id',table.id.split('/').at(-1));code.title=table.id;
      const open=node('button','small merge-reward-open','查看奖励详情 →');open.onclick=event=>{event.stopPropagation();return guarded(()=>showRewardDetail(table.id));};
      card.append(node('span','pill',context?.category??'奖励'),heading,description,code,node('span','merge-reward-count',`${table.pools.length} 个池 · ${count} 项奖励`),open);
      card.onclick=()=>guarded(()=>showRewardDetail(table.id));
      card.onkeydown=event=>{if(event.target===card&&['Enter',' '].includes(event.key)){event.preventDefault();guarded(()=>showRewardDetail(table.id));}};
      grid.append(card);
    }
    if(!data.tables.length)grid.append(node('p','merge-empty','没有匹配的奖励表。'));
    body().append(grid);
  }
  function renderRewardDetail(data) {
    const table=data.tables[0];if(!table){body().replaceChildren(node('p','merge-empty','奖励表不存在，请返回列表重试。'));return;}
    const back=node('button','small merge-reward-back','← 返回赏金奖励');back.onclick=()=>guarded(async()=>{state.rewardTableId=null;await render();});
    const detail=node('article','merge-reward-detail'),context=table.context;
    detail.dataset.rewardTable=table.id;
    detail.append(node('span','pill',context?.category??'奖励'),node('h2','',context?.title??table.id.split('/').at(-1)),node('p','merge-reward-description',context?.description??'任务说明待补充'),node('code','merge-entity-id',table.id),node('p','hint','奖励池按来源数组顺序展示；尚未确认任务阶段和当前轮次，稀有度不换算为概率。'));
    const content=node('div','merge-reward-content'),images=[],names=new Map(data.names.map(n=>[n.id,n.title]));
    for(const pool of table.pools) {
      content.append(node('h3','','奖励池 '+pool.index));
      const items=node('div','reward-item-grid');
      for(const reward of pool.items) {
        const row=node('article','merge-reward-row'),name=names.get(reward.itemId)??reward.itemId.split('/').at(-1),button=node('button','link',name);
        button.title=name+'\n'+reward.itemId;button.disabled=!names.has(reward.itemId);button.onclick=()=>guarded(()=>showDetail(reward.itemId));
        row.append(button,node('strong','',reward.quantity===null?'数量待补充':`× ${reward.quantity} ${reward.unit}`),node('span','reward-chance',reward.probability===null?`稀有度：${({COMMON:'常见',UNCOMMON:'罕见',RARE:'稀有',LEGENDARY:'传说'})[reward.rarity]??reward.rarity??'未提供'} · 概率未提供`:Number((reward.probability*100).toFixed(6))+'%'));
        if(reward.conversion)row.append(node('small','',`${reward.itemCount} 包 × ${reward.conversion.perItem}`));
        items.append(row);images.push({...data.images?.[reward.itemId],id:reward.itemId,card:row,label:name});
      }
      if(!pool.items.length)items.append(node('p','muted','此奖励池为空'));content.append(items);
    }
    const raw=node('details','merge-candidates merge-reward-provenance');raw.append(node('summary','','任务说明与奖励来源'));
    raw.addEventListener('toggle',()=>{if(!raw.open||raw.childElementCount>1)return;raw.append(node('p','muted',`说明依据：${({'exact-reference':'完整奖励表 ID 的直接引用','path-family':'路径目录人工中文分类（需复核）',unknown:'待补充'})[context?.basis]??'待补充'}`),sourceEvidence(table.source));for(const origin of context?.origins??[])raw.append(node('p','',origin.title),sourceEvidence(origin.source));raw.append(node('pre','',format(table)));});
    detail.append(content,raw);body().replaceChildren(back,detail);void decorateImages(api,images);
  }
  function reportPager(data) {
    const wrap = node('div', 'pagination'), actions = node('div');
    const prev = node('button', 'small', '上一页'), next = node('button', 'small', '下一页');
    prev.disabled = state.offset === 0; next.disabled = !data.hasMore;
    prev.onclick = () => guarded(async () => { state.offset = Math.max(0, state.offset - 40); await render(); });
    next.onclick = () => guarded(async () => { state.offset += 40; await render(); });
    actions.append(prev, next); wrap.append(node('span', '', `共 ${data.total} 项 · 从第 ${state.offset + 1} 项显示`), actions); body().append(wrap);
  }
  $('merge-locale').onchange=()=>guarded(async()=>{state.locale=$('merge-locale').value;await render();});
  $('merge-build').onclick = () => guarded(build);
  $('merge-export').onclick = () => guarded(async () => { const result = await api.exportMerged({ datasetVersion: version() }); if (result) notify('数据包已导出：' + result.directory); });
  $('merge-copy').onclick = () => guarded(async () => { await api.copy(JSON.stringify(state.status.manifest, null, 2)); notify('已复制数据包清单'); });
  for (const button of document.querySelectorAll('[data-merge-view]')) button.onclick = () => guarded(async () => { state.view = button.dataset.mergeView; state.offset = 0;state.rewardTableId=null;state.returnToRewards=null; state.selected = null; state.history = []; await render(); });
  let searchTimer;
  $('merge-search').oninput = () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => guarded(async () => { state.query = $('merge-search').value; state.offset = 0; await render(); }), 200); };
  $('merge-internal').onchange = () => guarded(async () => { state.includeInternal = $('merge-internal').checked; state.offset = 0; await render(); });
  $('merge-kind').onchange = () => guarded(async () => { state.kind = $('merge-kind').value; state.offset = 0; await render(); });
  return { state, reset, enter, build, render, showDetail, showRewardDetail };
}
