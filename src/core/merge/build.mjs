import { buildFull } from './full-build.mjs';
import { CONTRACT, DEFAULT_OVERRIDES, assign, compareText, digest, normalize, pointer, stable, storeItemId, valid } from './contract.mjs';
import { adaptInputs, captureInputs, verifyInputs } from './inputs.mjs';

const own = (value, key) => Object.hasOwn(value, key);
const labelTail = id => id.split('/').at(-1);
const textField = { type: 'string' };
const nonnegative = { type: 'number', min: 0 };
const positiveInteger = { type: 'integer', min: 1 };
const clone = value => JSON.parse(JSON.stringify(value));

export async function buildMerged(options) {
  if (options.contract?.scope?.mode === 'full') return buildFull(options);
  return buildPilot(options);
}
async function buildPilot({ files, read, contract = CONTRACT, overrides = DEFAULT_OVERRIDES }) {
  if (contract.schemaVersion !== 1 || !Array.isArray(contract.scope?.seeds) || !Number.isInteger(contract.scope.maxEntities) || contract.scope.maxEntities < 1) throw new Error('不支持的合并规范');
  if (overrides.version !== 1 || !Array.isArray(overrides.entries)) throw new Error('人工补丁格式无效');
  const captured = await captureInputs({ files, read, contract });
  const { documents } = captured, { index, dictionaries, duplicate } = adaptInputs(documents);
  const provenance = [], issues = [], recipes = [], tables = [], relations = [], sourceRecords = [], usedOverrides = new Set();
  const issue = (code, entityId, field, message, sources = [], severity = 'warning') => issues.push({ code, severity, entityId, field, message, sources });
  const rank = source => { const at = contract.priority.indexOf(source); return at < 0 ? 99 : at; };
  const ordered = candidates => [...candidates].sort((a, b) => rank(a.source.source) - rank(b.source.source) || (a.locale === 'zh-CN' ? 0 : 1) - (b.locale === 'zh-CN' ? 0 : 1) || compareText(a.source.file, b.source.file) || compareText(a.source.pointer, b.source.pointer));
  const candidatesFor = id => ordered(index.get(id) ?? []);
  const fieldSource = (record, key) => ({ ...record.source, pointer: record.source.pointer + '/' + pointer(key) });
  const candidate = (record, key, value = record.value[key], transform = 'identity') => ({ value, rawValue: clone(record.value[key]), source: fieldSource(record, key), transform });
  const mappings = new Map();
  const patchFields = new Set([...contract.fields.map(f => f.path), ...contract.locales.flatMap(locale => [`name.${locale}`, `description.${locale}`]), 'recipe.credits', 'recipe.seconds', 'recipe.quantity']);
  for (const patch of overrides.entries) {
    if (!patch || typeof patch.entityId !== 'string' || typeof patch.field !== 'string' || typeof patch.reason !== 'string' || !patch.reason.trim() || !/^[a-f0-9]{64}$/.test(patch.expectedSourceHash) || !own(patch, 'value')) throw new Error('人工补丁必须包含实体、字段、原因、预期源哈希和取值');
    if (!patchFields.has(patch.field)) throw new Error('人工补丁仅支持已建模标量，不支持修改标识或关系结构：' + patch.field);
    const key = `${patch.entityId}\0${patch.field}`;
    if (mappings.has(key)) throw new Error('人工补丁字段重复：' + patch.field); mappings.set(key, patch);
  }
  function resolve(entityId, field, candidates, definition = null, rule = '按字段来源优先级') {
    const accepted = [];
    for (const c of candidates) {
      if (definition && !valid(c.value, definition)) { issue('invalid-value', entityId, field, '候选值类型、范围或单位不符合规范，未采用', [c.source]); continue; }
      accepted.push({ ...c, value: definition ? normalize(c.value, definition) : c.value });
    }
    const patchKey = `${entityId}\0${field}`, patch = mappings.get(patchKey);
    let value = accepted[0]?.value, selected = accepted.length ? 0 : null, status = accepted.length ? 'resolved' : 'missing';
    if (patch) {
      usedOverrides.add(patchKey);
      if (!accepted.some(c => c.source.hash === patch.expectedSourceHash)) throw new Error(`人工补丁已失效或没有匹配源：${entityId} ${field}`);
      if (!definition || !valid(patch.value, definition)) throw new Error(`人工补丁取值无效：${entityId} ${field}`);
      value = normalize(patch.value, definition); selected = null; status = 'override';
    } else if (accepted.length > 1 && accepted.some(c => stable(c.value) !== stable(value))) {
      if (['recipe.resultId', 'recipe.materials'].includes(field)) throw new Error(`关键配方关系存在冲突，停止构建：${entityId} ${field}`);
      status = 'conflict'; issue('field-conflict', entityId, field, '候选值存在差异，暂取优先来源；需复核', accepted.map(c => c.source));
    }
    provenance.push({ entityId, field, value: value ?? null, status, selected, rule, candidates: accepted, ...(patch ? { override: patch } : {}) });
    return value;
  }
  for (const missing of captured.missing) issue('optional-input-missing', null, null, `未提供可选输入 ${missing.source}/${missing.relative}`, [], 'info');
  const manifestDoc = documents.find(doc => doc.shape === 'manifest'), rewardsDoc = documents.find(doc => doc.shape === 'rewards');
  const tier = manifestDoc.value.data?.ChallengeMissionDifficultyTiers?.[contract.scope.tier];
  if (!tier || !contract.scope.rewardTables.includes(tier.rewards)) throw new Error('赏金清单档位与样本奖励表不一致，需复核范围规范');
  const selected = new Set(), pending = [...contract.scope.seeds], recipeByResult = new Map();
  for (const [id, entries] of index) {
    const record = entries.find(c => c.source.source === 'plus' && c.kind === 'blueprint');
    if (record && typeof record.value.resultType === 'string') {
      const result = record.value.resultType;
      if (!recipeByResult.has(result)) recipeByResult.set(result, []); recipeByResult.get(result).push(id);
    }
  }
  for (const tableId of contract.scope.rewardTables) {
    const pools = rewardsDoc.value[tableId];
    if (!Array.isArray(pools) || !pools.length || pools.some(pool => !Array.isArray(pool))) throw new Error('奖励表缺失或结构无效：' + tableId);
    for (const pool of pools) for (const entry of pool) {
      const id = storeItemId(entry?.type);
      if (!id || !valid(entry.itemCount, positiveInteger) || !valid(entry.probability, { ...nonnegative, max: 1 })) throw new Error('样本奖励项结构、数量或概率无效：' + tableId);
      pending.push(id);
    }
  }
  while (pending.length) {
    const id = pending.shift(); if (selected.has(id)) continue;
    const entries = candidatesFor(id);
    if (!entries.length) throw new Error('关联物品不存在，停止构建：' + id);
    selected.add(id);
    if (selected.size > contract.scope.maxEntities) throw new Error('关系扩展超出范围上限，停止构建');
    if (new Set(entries.filter(c => ['weapon', 'warframe', 'blueprint'].includes(c.kind)).map(c => c.kind)).size > 1) throw new Error('实体类别冲突：' + id);
    const rec = entries.find(c => c.kind === 'blueprint' && c.source.source === 'plus');
    if (rec) {
      if (typeof rec.value.resultType !== 'string' || !Array.isArray(rec.value.ingredients)) throw new Error('配方结构无效：' + id);
      pending.push(rec.value.resultType);
      for (const ingredient of rec.value.ingredients) {
        if (typeof ingredient.ItemType !== 'string' || !valid(ingredient.ItemCount, positiveInteger)) throw new Error('配方材料结构无效：' + id);
        pending.push(ingredient.ItemType);
      }
    }
    pending.push(...(recipeByResult.get(id) ?? []).sort());
  }
  for (const entry of duplicate.filter(x => selected.has(x.id))) throw new Error(`同一文件出现重复实体标识：${entry.file} ${entry.id}`);

  function translations(id, key, locale, visiting = new Set()) {
    if (visiting.has(id)) return [];
    const records = candidatesFor(id), results = [];
    for (const sourceId of contract.priority) {
      for (const record of records.filter(r => r.source.source === sourceId)) {
        const value = record.value[key];
        if (record.locale === locale && valid(value, textField) && !value.startsWith('/')) results.push(candidate(record, key));
      }
      for (const record of records) {
        const ref = record.value[key];
        if (typeof ref !== 'string' || !ref.startsWith('/')) continue;
        for (const doc of dictionaries.filter(d => d.shape === 'dictionary' && d.source === sourceId && d.locale === locale)) {
          const value = doc.value[ref];
          if (valid(value, textField) && !value.startsWith('/')) results.push({ value, rawValue: ref, source: fieldSource(record, key), dictionary: { source: doc.source, file: doc.file, hash: doc.hash, pointer: '/' + pointer(ref) }, transform: 'language-key' });
        }
      }
      if (sourceId === 'wfcd') for (const doc of dictionaries.filter(d => d.shape === 'item-dictionary' && d.locale === locale)) {
        const value = doc.value[id]?.[key];
        if (valid(value, textField)) results.push({ value, rawValue: value, source: { source: doc.source, file: doc.file, hash: doc.hash, pointer: '/' + pointer(id) + '/' + key }, transform: 'item-localization' });
      }
    }
    if (!results.length && key === 'name') {
      const recipe = records.find(c => c.kind === 'blueprint' && typeof c.value.resultType === 'string');
      if (recipe) {
        const names = translations(recipe.value.resultType, key, locale, new Set([...visiting, id]));
        if (names.length) results.push({ ...candidate(recipe, 'resultType', names[0].value + (locale === 'zh-CN' ? ' 蓝图' : ' Blueprint'), 'derived-blueprint-name'), resultSource: names[0] });
      }
    }
    return results;
  }
  const items = [...selected].sort().map(id => {
    const records = candidatesFor(id), kind = records.find(c => ['weapon', 'warframe', 'blueprint'].includes(c.kind))?.kind ?? records[0].kind;
    const item = { id, kind, name: {}, description: {} };
    for (const locale of contract.locales) for (const key of ['name', 'description']) {
      const values = translations(id, key, locale), value = resolve(id, `${key}.${locale}`, values, textField, '官方对应语言原文 → Plus 语言键 → WFCD 物品本地化／原文 → Oracle 字典；蓝图可派生成品名');
      if (value !== undefined) item[key][locale] = value;
      else if (key === 'name' && locale === 'zh-CN') issue('missing-translation', id, `${key}.${locale}`, '缺少中文名称，界面回退英文或路径末段');
    }
    for (const field of contract.fields.filter(f => f.kinds.includes('*') || f.kinds.includes(kind))) {
      const candidates = records.filter(c => own(c.value, field.key)).map(c => candidate(c, field.key));
      if (!candidates.length) { if (field.required) throw new Error('缺少必需规范字段：' + id + ' ' + field.path); continue; }
      const value = resolve(id, field.path, candidates, field);
      if (value !== undefined) assign(item, field.path, value);
      else if (field.required) throw new Error('缺少必需规范字段：' + id + ' ' + field.path);
    }
    const mapped = new Set(['uniqueName', 'name', 'description', ...contract.fields.filter(f => f.kinds.includes('*') || f.kinds.includes(kind)).map(f => f.key)]);
    if (kind === 'blueprint') for (const key of ['resultType', 'ingredients', 'buildPrice', 'buildTime', 'num']) mapped.add(key);
    for (const record of records) {
      const unmodeled = Object.keys(record.value).filter(key => !mapped.has(key));
      sourceRecords.push({ entityId: id, source: record.source, locale: record.locale, unmodeled, value: record.value });
      for (const key of ['attacks', 'behaviours']) if (own(record.value, key)) issue('unmapped-attack-modes', id, key, '攻击模式保留于来源记录，尚未对齐语义，不与基础面板合并', [fieldSource(record, key)], 'info');
    }
    return item;
  });
  const itemMap = new Map(items.map(item => [item.id, item]));
  function edge(from, to, kind, source, extra = {}) {
    if (!itemMap.has(to)) throw new Error('关系目标缺失：' + to);
    relations.push({ from, to, kind, source, ...extra });
  }
  for (const item of items.filter(x => x.kind === 'blueprint')) {
    const records = candidatesFor(item.id).filter(c => c.kind === 'blueprint');
    const values = key => records.filter(c => own(c.value, key)).map(c => candidate(c, key));
    const recipe = { id: item.id, resultId: resolve(item.id, 'recipe.resultId', values('resultType'), textField), materials: [] };
    const materialCandidates = records.filter(c => Array.isArray(c.value.ingredients)).map(c => candidate(c, 'ingredients', c.value.ingredients.map(x => ({ itemId: x.ItemType, count: x.ItemCount })).sort((a, b) => compareText(String(a.itemId), String(b.itemId))), 'recipe-materials'));
    const selectedMaterials = resolve(item.id, 'recipe.materials', materialCandidates);
    if (!recipe.resultId || !selectedMaterials) throw new Error('配方缺少成品或材料：' + item.id);
    recipe.materials = selectedMaterials;
    if (new Set(recipe.materials.map(m => m.itemId)).size !== recipe.materials.length) throw new Error('配方材料标识重复：' + item.id);
    for (const [field, key, definition] of [['credits', 'buildPrice', { type: 'integer', min: 0 }], ['seconds', 'buildTime', nonnegative], ['quantity', 'num', positiveInteger]]) {
      const value = resolve(item.id, `recipe.${field}`, values(key), definition);
      if (value === undefined) throw new Error('配方缺少必要数值：' + item.id + ' ' + key); recipe[field] = value;
    }
    recipes.push(recipe);
    const productSource = provenance.find(p => p.entityId === item.id && p.field === 'recipe.resultId');
    edge(item.id, recipe.resultId, 'produces', productSource.candidates[0].source);
    const ingredientSource = provenance.find(p => p.entityId === item.id && p.field === 'recipe.materials').candidates[0].source;
    for (const material of recipe.materials) {
      if (!valid(material.count, positiveInteger)) throw new Error('合并配方材料数量无效');
      // Canonical materials are sorted; keep the pointer to the original ingredients array.
      edge(item.id, material.itemId, 'requires', ingredientSource, { quantity: material.count });
    }
  }
  // Reject ingredient cycles, while allowing a recipe to point at its own product as a separate entity.
  const graph = new Map();
  for (const recipe of recipes) { if (!graph.has(recipe.resultId)) graph.set(recipe.resultId, []); graph.get(recipe.resultId).push(...recipe.materials.map(m => m.itemId)); }
  const completed = new Set(), active = new Set();
  function visit(id) { if (active.has(id)) throw new Error('配方材料存在循环：' + id); if (completed.has(id)) return; active.add(id); for (const next of graph.get(id) ?? []) visit(next); active.delete(id); completed.add(id); }
  for (const id of graph.keys()) visit(id);

  for (const tableId of contract.scope.rewardTables) {
    const at = '/' + pointer(tableId), tableSource = { source: rewardsDoc.source, file: rewardsDoc.file, hash: rewardsDoc.hash, pointer: at };
    const pools = rewardsDoc.value[tableId].map((pool, i) => ({ index: i + 1, items: pool.map((entry, j) => {
      const itemId = storeItemId(entry.type), item = itemMap.get(itemId), source = { ...tableSource, pointer: `${at}/${i}/${j}` };
      const conversionField = item.bundle?.credits !== undefined ? 'credits' : item.bundle?.endo !== undefined ? 'endo' : null;
      const perItem = conversionField ? item.bundle[conversionField] : null, quantity = perItem === null ? entry.itemCount : perItem * entry.itemCount;
      if (!Number.isFinite(quantity)) throw new Error('奖励数量换算溢出');
      const reward = { itemId, rawType: entry.type, itemCount: entry.itemCount, quantity, unit: conversionField === 'credits' ? '现金' : conversionField === 'endo' ? '内融核心' : '件', probability: entry.probability, conversion: conversionField ? { field: `bundle.${conversionField}`, perItem } : null };
      provenance.push({ entityId: tableId, field: `pools.${i}.items.${j}`, value: reward, status: 'resolved', selected: 0, rule: '限定 StoreItems 前缀转换；原始概率与包数保留；按 bundle 数值换算', candidates: [{ source, rawValue: entry, value: reward, transform: 'reward-item' }] });
      edge(tableId, itemId, 'rewards', source, { pool: i + 1, probability: entry.probability, quantity });
      return reward;
    }) }));
    tables.push({ id: tableId, scope: 'complete-source-table', pools, source: tableSource, stageMapping: 'unconfirmed', manifest: { file: manifestDoc.file, hash: manifestDoc.hash, pointer: `/data/ChallengeMissionDifficultyTiers/${contract.scope.tier}`, tier: contract.scope.tier + 1 } });
  }
  for (const key of mappings.keys()) if (!usedOverrides.has(key)) throw new Error('人工补丁未匹配本次范围或规范字段：' + key.replace('\0', ' '));
  const inputManifest = documents.map(({ source, file, hash, bytes }) => ({ source, file, hash, bytes })).sort((a, b) => compareText(a.file, b.file));
  const coverage = {
    scope: contract.scope, entities: items.length, recipes: recipes.length, rewardTables: tables.length, relations: relations.length,
    kinds: Object.fromEntries([...new Set(items.map(x => x.kind))].sort().map(kind => [kind, items.filter(x => x.kind === kind).length])),
    fields: provenance.length, conflicts: issues.filter(x => x.code === 'field-conflict').length, missingTranslations: issues.filter(x => x.code === 'missing-translation').length,
    unmodeled: sourceRecords.map(r => ({ entityId: r.entityId, source: r.source, fields: r.unmodeled })),
    limitations: ['仅指定样本及配方／奖励引用闭包，不代表全量物品库', '攻击模式未统一；来源记录完整保留', '奖励池尚未对应具体任务阶段', '静态目录不确认实时轮次，也不预测实际掉落']
  };
  const output = {};
  for (const [kind, file] of [['weapon', 'weapons'], ['warframe', 'warframes'], ['resource', 'resources'], ['blueprint', 'blueprints'], ['mod', 'mods']]) output[`items/${file}.json`] = items.filter(item => item.kind === kind);
  output['recipes.json'] = recipes;
  output['reward-tables.json'] = tables;
  output['relations.json'] = relations;
  output['search.zh-CN.json'] = items.map(item => ({ id: item.id, kind: item.kind, title: item.name['zh-CN'] ?? item.name.en ?? labelTail(item.id), english: item.name.en ?? null }));
  output['reports/provenance.json'] = provenance;
  output['reports/issues.json'] = issues;
  output['reports/coverage.json'] = coverage;
  output['reports/source-records.json'] = sourceRecords;
  output['contract.json'] = contract;
  output['overrides.json'] = overrides;
  const filesManifest = Object.entries(output).sort(([a], [b]) => compareText(a, b)).map(([file, value]) => ({ file, hash: digest(value), bytes: Buffer.byteLength(stable(value)) }));
  const identity = { schemaVersion: contract.schemaVersion, mappingVersion: contract.mappingVersion, builderVersion: contract.builderVersion, contractHash: digest(contract), overridesHash: digest(overrides), inputs: inputManifest, files: filesManifest, scope: contract.scope, quality: issues.some(x => x.severity === 'warning') ? 'review-required' : 'pilot', summary: { entities: items.length, recipes: recipes.length, rewardTables: tables.length, relations: relations.length, issues: issues.length, conflicts: coverage.conflicts } };
  const manifest = { ...identity, datasetVersion: digest(identity) };
  await verifyInputs(documents, read);
  return { manifest, output };
}
