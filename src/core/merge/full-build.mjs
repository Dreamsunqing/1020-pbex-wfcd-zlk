import { createTextLocalizer } from '../text-localization.mjs';
import { maxRankText } from '../localized-text.mjs';
import { buildAbilityLinks } from './ability-links.mjs';
import { buildIncarnonLinks } from './incarnon-links.mjs';
import { sha256 } from '../io.mjs';
import { FULL_MODELING_VERSION, assign, compareText, digest, normalize, pointer, stable, valid } from './contract.mjs';
import { fullInputs, entityId } from './full-inputs.mjs';
import { verifyInputs } from './inputs.mjs';
import { validateRules } from './rules.mjs';
import { mergeNested, nestedEntries, nestedRules, object } from './nested.mjs';

export async function buildFull(options) {
  const { contract, overrides = { version: 1, entries: [] }, read, onProgress = () => {} } = options;
  validateRules({ contract, overrides }); onProgress({ message: '读取全量分类、字典与参考资料…' });
  const captured = await fullInputs({ ...options, contract }), { documents, index, dictionaries } = captured;
  const localizations = Object.fromEntries(contract.locales.map(locale=>[locale,{}]));
  const localizer = createTextLocalizer({dictionaries,priority:contract.priority,locales:contract.locales});
  const provenance = [], issues = [], records = [], recipes = [], relations = [], rewardTables = [];
  const patches = new Map(overrides.entries.map(p => [p.entityId + '\0' + p.field, p])), usedPatches = new Set();
  const issue = (code, id, field, message, sources = [], severity = 'warning') => issues.push({ code, entityId: id, field, message, sources, severity });
  for (const duplicate of captured.duplicates) issue('duplicate-record', duplicate.entityId, null, '同文件重复标识；保留全部候选并按稳定指针顺序选择', [{ file: duplicate.file, pointer: duplicate.pointer }]);
  for (const rule of captured.missingRules) issue('optional-input-missing', null, null, '规则输入不存在：' + rule.source + '/' + rule.file, [], 'info');
  const rank = (record, priority = contract.priority) => { const at = priority.indexOf(record.source.source); return at < 0 ? 99 : at; };
  for (const rows of index.values()) rows.sort((a, b) => rank(a) - rank(b) || compareText(a.source.file, b.source.file) || compareText(a.source.pointer, b.source.pointer));
  const sourceAt = (record, key) => ({ ...record.source, pointer: record.source.pointer + '/' + pointer(key) });
  const candidate = (record, key, value = record.value[key], transform = 'identity') => ({ value, rawValue: record.value[key], transform, locale: record.locale, localized: Boolean(record.dictionary), source: sourceAt(record, key) });
  const resolve = (id, field, candidates, definition = null, compact = false) => {
    const priority = definition?.priority ?? contract.priority;
    const isNamedText = /^(name|description|passiveDescription)\./.test(field);
    const byLocale = new Map();
    if (!isNamedText) for (const locale of contract.locales) {
      const localized = localizer.candidates(field,candidates,locale).sort((a,b)=>rank(a,priority)-rank(b,priority));
      if (localized.length) { byLocale.set(locale,localized); const selected=localized[0];
        (localizations[locale][id] ??= {})[field] = {value:selected.value,source:selected.source,transform:selected.transform,dictionarySources:selected.dictionarySources ?? [],...(selected.partial?{partial:true}:{})};
      }
    }
    const preferred = byLocale.get(contract.locales[0]) ?? byLocale.get('en');
    const accepted = isNamedText ? candidates : preferred ? [...preferred,...candidates.filter(c=>!preferred.some(p=>p.source.file===c.source.file&&p.source.pointer===c.source.pointer))] : [...candidates].sort((a,b)=>rank(a,priority)-rank(b,priority));
    const validCandidates = accepted.filter(c => {
      if (!definition || valid(c.value, definition)) return true;
      issue('invalid-value', id, field, '候选不满足字段类型或范围，已保留原记录并跳过该候选', [c.source]); return false;
    }).map(c => ({ ...c, value: definition ? normalize(c.value, definition) : c.value }));
    let value = validCandidates[0]?.value, status = value === undefined ? 'missing' : 'resolved', selected = value === undefined ? null : 0;
    const patch = patches.get(id + '\0' + field);
    if (patch) {
      if (!validCandidates.some(c => c.source.hash === patch.expectedSourceHash)) throw new Error('人工修订哈希已过期或没有对应候选：' + id + ' ' + field);
      value = normalize(patch.value, definition); selected = null; status = 'override'; usedPatches.add(id + '\0' + field);
      for(const entries of Object.values(localizations)) if(entries[id])delete entries[id][field];
    } else if (validCandidates.length > 1 && validCandidates.some(c => !((isNamedText || preferred) && c.locale && validCandidates[0]?.locale && c.locale !== validCandidates[0].locale) && stable(c.value) !== stable(value))) {
      status = 'conflict'; issue('field-conflict', id, field, '不同来源存在差异，按字段／全局优先级暂选，等待复核', validCandidates.map(c => c.source));
    }
    provenance.push({ entityId: id, field, value: compact && validCandidates.every(c=>c.transform==='identity') ? undefined : value ?? null, status, selected, rule: definition?.priority ? '字段指定来源优先级' : '规则来源优先级；保留所有候选和原记录', candidates: validCandidates.map(c => compact && c.transform==='identity' ? { source: c.source, locale:c.locale, transform: c.transform, compact: true } : c), ...(patch ? { override: patch } : {}) });
    return value;
  };
  const dictionariesByLocale = new Map(contract.locales.map(locale => [locale, dictionaries.filter(d => d.locale === locale).sort((a, b) => contract.priority.indexOf(a.source) - contract.priority.indexOf(b.source))]));
  function texts(id, key, locale, visiting = new Set()) {
    if (visiting.has(id)) return [];
    const result = [], rows = index.get(id) ?? [];
    for (const source of contract.priority) {
      for (const row of rows.filter(row => row.source.source === source)) {
        const actualKey = key === 'name' && row.value.abilityName ? 'abilityName' : key;
        const raw = row.value[actualKey];
        const value=Array.isArray(raw)&&raw.length&&raw.every(v=>typeof v==='string'&&!v.startsWith('/'))?raw.join('\n'):raw;
        if (typeof value === 'string' && value.trim() && !value.startsWith('/') && row.locale === locale) result.push(candidate(row, actualKey,value,Array.isArray(raw)?'text-lines':'identity'));
      }
      for (const row of rows) {
        const actualKey = key === 'name' && row.value.abilityName ? 'abilityName' : key;
        const ref = row.value[actualKey]; if (typeof ref !== 'string' || !ref.startsWith('/')) continue;
        for (const dictionary of dictionariesByLocale.get(locale).filter(d => d.shape === 'language' && d.source === source)) {
          const value = dictionary.value[ref]; if (typeof value === 'string' && value.trim() && !value.startsWith('/')) result.push({ ...candidate(row, actualKey, value, 'language-key'), dictionary: { source, file: dictionary.file, hash: dictionary.hash, pointer: '/' + pointer(ref) } });
        }
      }

    }
    if (!result.length && key === 'description') {
      for (const source of contract.priority) for (const row of rows.filter(r => r.source.source === source && r.locale === locale)) {
        const ranked = maxRankText(row.value); if (!ranked) continue;
        result.push({ value: ranked.text, rawValue: ranked.lines, locale, rank: ranked.rank, transform: 'max-rank-stats', source: { ...row.source, pointer: row.source.pointer + ranked.pointer } });
      }
    }
    if (!result.length && key === 'description') {
      const recipe=rows.find(r=>r.kind==='blueprint'&&typeof r.value.resultType==='string');
      if(recipe){
        const raw=recipe.value.resultType,alias=[...contract.aliases].sort((a,b)=>b.from.length-a.from.length).find(a=>a.mode==='exact'?raw===a.from:raw.startsWith(a.from));
        const resultId=alias?(alias.mode==='exact'?alias.to:alias.to+raw.slice(alias.from.length)):raw;
        const descriptions=texts(resultId,key,locale,new Set([...visiting,id]));
        if(descriptions.length)result.push({...candidate(recipe,'resultType',descriptions[0].value,'derived-blueprint-description'),resultSource:descriptions[0]});
      }
    }
    if (!result.length && key === 'name' && ['zh-CN','en'].includes(locale)) {
      const recipe = rows.find(r => typeof r.value.resultType === 'string');
      if (recipe) { const names = texts(recipe.value.resultType, key, locale, new Set([...visiting, id])); if (names.length) result.push({ ...candidate(recipe, 'resultType', names[0].value + (locale === 'zh-CN' ? ' 蓝图' : ' Blueprint'), 'derived-blueprint-name'), resultSource: names[0] }); }
    }
    return result;
  }
  const items = [], itemMap = new Map();
  onProgress({ message: `逐字段合并 ${index.size} 个实体…` });
  for (const [id, rows] of [...index].sort(([a], [b]) => compareText(a, b))) {
    // A broad WFCD Components/Misc classification must not override a specific upstream kind.
    const specificity = r => r.classificationPriority;
    const classification = [...rows].sort((a, b) => specificity(a) - specificity(b) || rank(a) - rank(b))[0];
    const kind = classification.kind, item = { id, kind, name: {}, description: {}, attributes: {} };
    const kinds = [...new Set(rows.map(r => r.kind))];
    if (kinds.length > 1) issue('category-difference', id, 'kind', '来源分类不同，采用更具体的规则分类：' + kind, rows.map(r => r.source), 'info');
    for (const locale of contract.locales) for (const key of ['name', 'description']) {
      const value = resolve(id, `${key}.${locale}`, texts(id, key, locale).map(c=>({...c,locale})), { type: 'string' }); if (value !== undefined) item[key][locale] = value;
    }
    if (!item.name['zh-CN']) issue('missing-translation', id, 'name.zh-CN', '没有中文名称，保留英文或完整标识', [], 'info');
    const mapped = new Set(['uniqueName', 'name', 'description', ...nestedRules(contract).filter(r => r.enabled).map(r => r.key)]);
    if (rows.some(r => typeof r.value.passiveDescription === 'string')) {
      item.passiveDescription = {}; mapped.add('passiveDescription');
      for (const locale of contract.locales) { const value = resolve(id, 'passiveDescription.' + locale, texts(id, 'passiveDescription', locale).map(c=>({...c,locale})), { type: 'string' }); if (value !== undefined) item.passiveDescription[locale] = value; }
    }
    for (const field of contract.fields.filter(f => f.kinds.includes('*') || f.kinds.includes(kind))) {
      const candidates = rows.filter(r => Object.hasOwn(r.value, field.key)).map(r => candidate(r, field.key)); mapped.add(field.key);
      if (candidates.length) { const value = resolve(id, field.path, candidates, field); if (value !== undefined) assign(item, field.path, value); }
      else if (field.required) issue('required-field-missing', id, field.path, '此类型缺少规则标记的必需字段', rows.map(r => r.source));
    }
    const keys = [...new Set(rows.flatMap(r => Object.keys(r.value)))].filter(k => !mapped.has(k)).sort();
    for (const key of keys) {
      const value = mergeNested(id, 'attributes.' + key, rows.filter(r => Object.hasOwn(r.value, key)).map(r => candidate(r, key)), resolve);
      Object.defineProperty(item.attributes, key, { value, enumerable: true });
    }
    for (const row of rows) records.push({ entityId: id, source: row.source, locale: row.locale, unmodeled: Object.keys(row.value).filter(k => !mapped.has(k)), value: row.value });
    items.push(item); itemMap.set(id, item);
  }
  const refId = raw => {
    if (typeof raw !== 'string') return null;
    const alias = [...contract.aliases].sort((a, b) => b.from.length - a.from.length).find(a => a.mode === 'exact' ? raw === a.from : raw.startsWith(a.from));
    return alias ? alias.mode === 'exact' ? alias.to : alias.to + raw.slice(alias.from.length) : raw;
  };
  const addReference = (raw, source, owner, field) => {
    const id = refId(raw); if (!id) { issue('invalid-reference', owner, field, '引用不是字符串', [source]); return null; }
    if (!itemMap.has(id)) { const item = { id, kind: 'reference', name: {}, description: {}, attributes: {}, unresolved: true }; items.push(item); itemMap.set(id, item); issue('unresolved-reference', owner, field, '缺少实体资料，显式保留待补引用：' + id, [source]); }
    return id;
  };
  const edge = (from, to, kind, source, extra = {}) => { if (to) relations.push({ from, to, kind, source, ...extra }); };
  for (const item of [...items]) {
    const rows = index.get(item.id) ?? [], recipeRows = rows.filter(r => r.kind === 'blueprint' && typeof r.value.resultType === 'string');
    if (!recipeRows.length) continue;
    const row = recipeRows[0], source = row.source, value = row.value;
    const resultId = addReference(value.resultType, sourceAt(row, 'resultType'), item.id, 'recipe.resultId');
    if (!Array.isArray(value.ingredients)) { issue('recipe-invalid', item.id, 'ingredients', '缺少材料数组，配方保留为来源属性', [source]); continue; }
    const recipe = { id: item.id, resultId, materials: [] };
    for (const [i, ingredient] of value.ingredients.entries()) {
      const at = { ...source, pointer: source.pointer + '/ingredients/' + i }, target = addReference(ingredient.ItemType, at, item.id, 'recipe.materials');
      if (!target || !Number.isFinite(ingredient.ItemCount) || ingredient.ItemCount <= 0) { issue('recipe-invalid', item.id, 'materials', '材料数量无效，记录在问题中', [at]); continue; }
      recipe.materials.push({ itemId: target, count: ingredient.ItemCount }); edge(item.id, target, 'requires', at, { quantity: ingredient.ItemCount });
    }
    for (const [field, key] of [['credits', 'buildPrice'], ['seconds', 'buildTime'], ['quantity', 'num']]) {
      const selected = resolve(item.id, 'recipe.' + field, recipeRows.filter(r => Object.hasOwn(r.value, key)).map(r => candidate(r, key)), { type: 'number', min: 0 });
      recipe[field] = selected ?? null; if (selected === undefined) issue('recipe-value-missing', item.id, field, '来源未提供，不推测默认值', [source]);
    }
    const normalizedRecipe = r => ({ result: refId(r.resultType), materials: (r.ingredients ?? []).map(m => ({ itemId: refId(m.ItemType), count: m.ItemCount })).sort((a, b) => compareText(String(a.itemId), String(b.itemId))) });
    if (recipeRows.some(r => stable(normalizedRecipe(r.value)) !== stable(normalizedRecipe(value)))) issue('recipe-conflict', item.id, 'recipe', '配方关系候选有差异，暂用优先来源并保留问题', recipeRows.map(r => r.source));
    recipe.materials.sort((a, b) => compareText(String(a.itemId), String(b.itemId))); recipes.push(recipe); edge(item.id, resultId, 'produces', sourceAt(row, 'resultType'));
  }
  // Explicit membership is independent of recipe ingredients. A WFCD blueprint
  // in components is a required blueprint, not a recursively counted material.
  const memberships = new Map();
  for (const [owner, rows] of index) for (const row of rows) for (const rule of nestedRules(contract).filter(r => r.enabled)) {
    for (const child of nestedEntries(row.value[rule.key], row.source.pointer + '/' + pointer(rule.key))) {
      if (!child.id) { issue('nested-reference-invalid', owner, rule.key, '嵌套关联缺少完整内部 ID，保留原始记录', [{ ...row.source, pointer: child.pointer }]); continue; }
      const source = { ...row.source, pointer: child.pointer };
      const childId = addReference(child.id, source, owner, rule.path);
      const from = rule.reverse ? childId : owner, to = rule.reverse ? owner : childId;
      if (!to || from === to) continue;
      const key = from + '\0' + rule.relation + '\0' + to;
      if (!memberships.has(key)) memberships.set(key, { from, to, kind: rule.relation, path: rule.path, candidates: [] });
      const quantity = object(child.value) ? child.value.itemCount ?? child.value.count : undefined;
      memberships.get(key).candidates.push({ source, quantity, slot: child.slot, rawValue: child.value, reverse: Boolean(rule.reverse) });
    }
  }
  for (const membership of memberships.values()) {
    // Forward collection entries carry ordering and counts. Reverse parent lists
    // supply evidence only and must not overwrite them with their own array index.
    const candidates = membership.candidates.sort((a, b) => Number(a.reverse) - Number(b.reverse) || rank(a) - rank(b) || compareText(a.source.file, b.source.file) || compareText(a.source.pointer, b.source.pointer));
    const first = candidates[0], quantities = candidates.filter(c => c.quantity !== undefined), preferred = quantities[0];
    let quantity;
    if (preferred) {
      quantity = Number.isFinite(preferred.quantity) && preferred.quantity > 0 ? preferred.quantity : null;
      if (quantity === null) issue('component-count-invalid', membership.from, membership.path, '组件数量无效，不推测为 1', quantities.map(c => c.source));
      if (quantities.some(c => c.quantity !== preferred.quantity)) issue('component-count-conflict', membership.from, membership.path, '组件数量候选有差异，暂取优先来源', quantities.map(c => c.source));
    }
    const link = { itemId: membership.to, ...(quantity !== undefined ? { count: quantity } : {}), ...(membership.kind === 'has-ability' ? { slot: first.slot + 1 } : {}) };
    const owner = itemMap.get(membership.from); owner[membership.path] ??= []; owner[membership.path].push(link);
    edge(membership.from, membership.to, membership.kind, preferred?.source ?? first.source, { ...(quantity !== undefined ? { quantity } : {}), ...(link.slot ? { slot: link.slot } : {}), sources: candidates.map(c => c.source) });
    provenance.push({ entityId: membership.from, field: membership.path + '[' + JSON.stringify(membership.to) + ']', value: link, status: quantities.some(c => c.quantity !== preferred?.quantity) ? 'conflict' : 'resolved', selected: preferred ? candidates.indexOf(preferred) : 0, rule: '按完整内部 ID 关联；正向集合提供顺序与数量，反向父级提供补充证据', candidates: candidates.map(c => ({ value: { itemId: membership.to, ...(c.quantity !== undefined ? { count: c.quantity } : {}) }, rawValue: c.rawValue, transform: 'entity-reference', source: c.source })) });
  }
  for (const item of items) if (item.abilities) item.abilities.sort((a, b) => a.slot - b.slot || compareText(a.itemId, b.itemId));
  const abilityLinks = buildAbilityLinks({ documents, index, items, itemMap, relations, provenance, issue });
  const incarnonLinks = buildIncarnonLinks({ documents, index, items, itemMap, relations, provenance, issue });
  const rewardsDoc = documents.find(d => d.source === 'plus' && /\/ExportRewards.json$/.test(d.file));
  onProgress({ message: '关联全部奖励表、赏金清单和图片索引…' });
  for (const [id, rawPools] of Object.entries(rewardsDoc.value).sort(([a], [b]) => compareText(a, b))) {
    const source = { source: 'plus', file: rewardsDoc.file, hash: rewardsDoc.hash, pointer: '/' + pointer(id) }, pools = [];
    if (!Array.isArray(rawPools)) { issue('reward-invalid', id, null, '奖励池结构无效', [source]); continue; }
    for (const [i, rawPool] of rawPools.entries()) {
      const rewards = [];
      if (!Array.isArray(rawPool)) { issue('reward-invalid', id, String(i), '奖励池不是数组', [source]); continue; }
      for (const [j, raw] of rawPool.entries()) {
        const at = { ...source, pointer: `${source.pointer}/${i}/${j}` }, itemId = addReference(raw.type, at, id, `pools.${i}.${j}`), item = itemMap.get(itemId);
        const conversionField = item?.bundle?.credits !== undefined ? 'credits' : item?.bundle?.endo !== undefined ? 'endo' : null;
        const perItem = conversionField ? item.bundle[conversionField] : null;
        const count = Number.isFinite(raw.itemCount) && raw.itemCount > 0 ? raw.itemCount : null;
        const quantity = count === null ? null : perItem === null ? count : perItem * count;
        const probability = typeof raw.probability === 'number' && raw.probability >= 0 && raw.probability <= 1 ? raw.probability : null;
        if (raw.probability !== undefined && probability === null) issue('reward-probability-invalid', id, `${i}.${j}`, '概率无效，不作为有效概率展示', [at]);
        if (count === null) issue('reward-count-invalid', id, `${i}.${j}`, '奖励数量无效', [at]);
        const reward = { itemId, rawType: raw.type, itemCount: count, quantity, unit: conversionField === 'credits' ? '现金' : conversionField === 'endo' ? '内融核心' : '件', probability, rarity: raw.rarity ?? null, conversion: conversionField ? { field: 'bundle.' + conversionField, perItem } : null, source: at };
        rewards.push(reward); edge(id, itemId, 'rewards', at, { pool: i + 1, probability, quantity });
      }
      pools.push({ index: i + 1, items: rewards });
    }
    rewardTables.push({ id, scope: 'complete-source-table', pools, source, stageMapping: 'unconfirmed', manifests: [] });
  }
  const tableMap = new Map(rewardTables.map(t => [t.id, t])), tableRefs = [];
  for (const doc of documents.filter(d => d.source === 'oracle' && /JobManifest.json$/.test(d.file))) {
    const scan = (value, at = '') => {
      if (Array.isArray(value)) value.forEach((v, i) => scan(v, at + '/' + i));
      else if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) {
        const next = at + '/' + pointer(key);
        if (typeof child === 'string' && tableMap.has(child)) { const ref = { tableId: child, file: doc.file, hash: doc.hash, pointer: next, source: 'oracle' }; tableRefs.push(ref); tableMap.get(child).manifests.push(ref); }
        else if (child && typeof child === 'object') scan(child, next);
      }
    }; scan(doc.value);
  }
  // Iterative graph traversal avoids a stack overflow on unusual source graphs.
  const graph = new Map(); for (const recipe of recipes) { if (!graph.has(recipe.resultId)) graph.set(recipe.resultId, []); graph.get(recipe.resultId).push(...recipe.materials.map(m => m.itemId)); }
  const done = new Set();
  for (const id of graph.keys()) {
    if (done.has(id)) continue;
    const active = new Set(), stack = [[id, false]];
    while (stack.length) { const [node, finish] = stack.pop(); if (finish) { active.delete(node); done.add(node); continue; } if (active.has(node)) { issue('recipe-cycle', node, 'recipe', '材料依赖形成循环，不执行自动递归成本计算'); continue; } if (done.has(node)) continue; active.add(node); stack.push([node, true]); for (const next of graph.get(node) ?? []) stack.push([next, false]); }
  }
  for (const key of patches.keys()) if (!usedPatches.has(key)) throw new Error('人工修订未匹配实体或有效字段：' + key.replace('\0', ' '));
  if (items.length > contract.scope.maxEntities) throw new Error('全量实体与引用数量超出规则上限');
  items.sort((a, b) => compareText(a.id, b.id));
  const imageDoc = documents.find(d => d.source === 'official' && /\/ExportManifest.json$/.test(d.file));
  const images = imageDoc?.value.Manifest?.map((r, i) => ({ itemId: r.uniqueName, textureLocation: r.textureLocation, source: { source: 'official', file: imageDoc.file, hash: imageDoc.hash, pointer: '/Manifest/' + i } })) ?? [];
  const nestedRecords = records.filter(r => index.get(r.entityId)?.some(v => v.embedded && v.source.file === r.source.file && v.source.pointer === r.source.pointer));
  const coverage = { scope: contract.scope, entities: items.length, recipes: recipes.length, rewardTables: rewardTables.length, rewardItems: rewardTables.reduce((n, t) => n + t.pools.reduce((m, p) => m + p.items.length, 0), 0), relations: relations.length, fields: provenance.length, conflicts: issues.filter(i => i.code === 'field-conflict').length, unresolved: items.filter(i => i.unresolved).length, missingTranslations: items.filter(i => !i.name['zh-CN']).length, kinds: Object.fromEntries([...new Set(items.map(i => i.kind))].sort().map(kind => [kind, items.filter(i => i.kind === kind).length])), files: captured.inventory, nestedEntities: new Set(nestedRecords.map(r => r.entityId)).size, nestedRecords: nestedRecords.length, abilityLinks, incarnonLinks, relationKinds: Object.fromEntries([...new Set(relations.map(r => r.kind))].sort().map(kind => [kind, relations.filter(r => r.kind === kind).length])), unmodeled: [...new Set(records.flatMap(r => r.unmodeled))].sort(), limitations: ['嵌套对象按子字段合并；完整 ID 数组按身份合并，无 ID 数组保留整组候选' , '按 contract.locales 输出名称、描述和嵌套字段本地化；未配置语言保存在 reference；缺失回退需标记语言', '来源缺失引用显式标记 reference；存在数据问题则 review-required', '稀有度不猜概率；不确认实时轮次或任务阶段'] };
  const localizationReport={schemaVersion:1,locales:contract.locales,identity:'full-upstream-id',fallback:['requested','en','explicitly-labeled-available-locale'],languages:{}};
  for(const locale of contract.locales) {
    const fields=Object.values(localizations[locale]).flatMap(Object.values);
    localizationReport.languages[locale]={names:items.filter(i=>i.name[locale]).length,descriptions:items.filter(i=>i.description[locale]).length,passives:items.filter(i=>i.passiveDescription?.[locale]).length,nestedEntities:Object.keys(localizations[locale]).length,nestedFields:fields.length,dictionaryFields:fields.filter(f=>f.dictionarySources.length).length,derivedRankDescriptions:provenance.filter(f=>f.field==='description.'+locale && f.candidates[f.selected]?.transform==='max-rank-stats').length,missingNames:items.filter(i=>!i.name[locale]).length,missingDescriptions:items.filter(i=>!i.description[locale]).length};
  }
  const output = {'reports/localization.json':localizationReport};
  for(const [locale,entries] of Object.entries(localizations)) output['localizations/'+locale+'.json']=entries;
  for (const [kind] of Object.entries(coverage.kinds)) output[`items/${kind === 'weapon' ? 'weapons' : kind === 'warframe' ? 'warframes' : kind === 'resource' ? 'resources' : kind === 'blueprint' ? 'blueprints' : kind === 'mod' ? 'mods' : kind === 'ability' ? 'abilities' : kind + 's'}.json`] = items.filter(i => i.kind === kind);
  Object.assign(output, { 'ExportAbilities.json': Object.fromEntries(items.filter(i => i.kind === 'ability').map(i => [i.id, i])), 'reports/ability-links.json': abilityLinks, 'reports/incarnon-links.json': incarnonLinks, 'recipes.json': recipes, 'reward-tables.json': rewardTables, 'relations.json': relations, 'search.zh-CN.json': items.map(i => ({ id: i.id, kind: i.kind, title: i.name['zh-CN'] ?? i.name.en ?? i.id.split('/').at(-1), english: i.name.en ?? null })), 'images.json': images, 'bounty-references.json': tableRefs, 'reports/provenance.json': provenance, 'reports/issues.json': issues, 'reports/coverage.json': coverage, 'reports/source-records.json': records, 'contract.json': contract, 'overrides.json': overrides, ...captured.references });
  // File identity lives once in manifest.inputs; pointers retain exact field provenance.
  const inputIndex = new Map(documents.map((doc, i) => [doc.file, i]));
  function compactEvidence(node) {
    if (!node || typeof node !== 'object') return node;
    if (!Array.isArray(node) && typeof node.file === 'string' && typeof node.hash === 'string' && typeof node.pointer === 'string' && inputIndex.has(node.file)) return { input: inputIndex.get(node.file), pointer: node.pointer, ...(Number.isInteger(node.line) ? { line: node.line } : {}) };
    if (Array.isArray(node)) return node.map(compactEvidence);
    return Object.fromEntries(Object.entries(node).map(([key, value]) => [key, compactEvidence(value)]));
  }
  // Full records can be reconstructed from the immutable reference file and source pointer.
  output['reports/source-records.json'] = records.map(({ value, ...record }) => record);
  for (const file of ['reports/provenance.json', 'reports/issues.json', 'reports/source-records.json', 'relations.json', 'reward-tables.json', 'images.json', 'bounty-references.json']) output[file] = compactEvidence(output[file]);
  for (const file of Object.keys(output).filter(file=>file.startsWith('localizations/'))) output[file]=compactEvidence(output[file]);
  onProgress({ message: `校验 ${documents.length} 份输入与 ${items.length} 个实体，准备发布…` });
  const files = Object.entries(output).sort(([a], [b]) => compareText(a, b)).map(([file, value]) => ({ file, hash: sha256(stable(value, true)), bytes: Buffer.byteLength(stable(value, true)) }));
  const identity = { modelingVersion: FULL_MODELING_VERSION, schemaVersion: contract.schemaVersion, locales:contract.locales, encoding: 'compact-json', mappingVersion: contract.mappingVersion, builderVersion: contract.builderVersion, contractHash: digest(contract), overridesHash: digest(overrides), inputs: documents.map(({ file, source, hash, bytes }) => ({ file, source, hash, bytes })), files, scope: contract.scope, quality: issues.some(i => i.severity === 'warning') ? 'review-required' : 'full-static', summary: { entities: items.length, recipes: recipes.length, rewardTables: rewardTables.length, relations: relations.length, issues: issues.length, conflicts: coverage.conflicts, unresolved: coverage.unresolved, rewardItems: coverage.rewardItems } };
  await verifyInputs(documents, read);
  return { manifest: { ...identity, datasetVersion: digest(identity) }, output };
}
