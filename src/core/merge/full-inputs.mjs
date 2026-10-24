import { normalizeLocale } from '../text-localization.mjs';
import { parseDocument } from '../library.mjs';
import { sha256 } from '../io.mjs';
import { pointer, compareText } from './contract.mjs';
import { indexNested } from './nested.mjs';
export const entityId = (id, kind) => typeof id === 'string' && id.startsWith('/') ? id : `wf:${kind}/${String(id)}`;
export async function fullInputs({ files, read, contract }) {
  const documents = [], inventory = [], index = new Map(), dictionaries = [], references = {}, duplicates = [];
  const rules = contract.catalogs.filter(r => r.enabled).map(r => ({...r}));
  const codes = { 'zh-CN':'zh', 'zh-TW':'tc' };
  for (const locale of contract.locales) if (!['zh-CN','en'].includes(locale)) {
    const code = codes[locale] ?? locale;
    for (const template of contract.catalogs.filter(r=>r.enabled && r.source==='official' && r.locale==='en' && /manifests\/en\//.test(r.file))) {
      const file=template.file.replace('manifests/en/','manifests/'+code+'/').replace(/_en\.json$/,'_'+code+'.json');
      if(!rules.some(r=>r.source==='official' && r.file===file && r.group===template.group))rules.push({...template,file,locale});
    }
  }
  for (const file of [...files].sort((a, b) => compareText(a.id, b.id))) {
    const wikiMetadata = file.source === 'plus-gen' && /\/extras\/wiki\/(Warframes|Mods|Weapons\/(primary|secondary|melee))\.lua$/.test(file.id);
    if (!/\.jsonc?$/.test(file.id) && !wikiMetadata) { inventory.push({ file: file.id, source: file.source, status: 'excluded', reason: '说明／源码／排期文本，继续由原模块使用' }); continue; }
    const matched = rules.filter(r => file.source === r.source && (file.id === `${r.source}/${r.file}` || file.id.endsWith('/' + r.file)));
    const dictionary = (file.source === 'plus' && /\/dict\.[a-z]+\.json$/.test(file.id)) || (file.source === 'oracle' && /\/dicts\/[a-z]+\.json$/.test(file.id));
    const itemDictionary = file.source === 'wfcd' && /\/i18n\/[a-z]+\.json$/.test(file.id);
    const official = file.source === 'official' && /\/manifests\//.test(file.id);
    const plus = file.source === 'plus' && /\/Export[^/]+\.json$/.test(file.id);
    const oracle = file.source === 'oracle' && /\/(data|dicts)\//.test(file.id);
    const auxiliary = file.source==='droptables' && file.id.endsWith('/parsed.json') || (file.source === 'browse' && !/package(-lock)?\.json$/.test(file.id)) || (file.source === 'plus-gen' && !/package(-lock)?\.json$/.test(file.id));
    if (!matched.length && !dictionary && !itemDictionary && !official && !plus && !oracle && !auxiliary) { inventory.push({ file: file.id, source: file.source, status: 'excluded', reason: '构建配置、缓存索引或来源清单；不作为游戏实体' }); continue; }
    const { bytes, hash } = await read(file.id); if (sha256(bytes) !== hash) throw new Error('输入哈希不一致：' + file.id);
    const { value, format } = parseDocument(bytes.toString('utf8'), file.id);
    if (!wikiMetadata && (!value || typeof value !== 'object' || format === 'text')) throw new Error('全量输入结构无效：' + file.id);
    const doc = { file: file.id, source: file.source, hash, bytes: bytes.length, value };
    documents.push(doc);
    const reference = `reference/${file.source}/${hash}.json`;
    // Full source files also retain groups not yet normalized, other locales and uncommon fields.
    references[reference] = value;
    const item = { file: file.id, source: file.source, status: matched.length ? 'merged' : dictionary || itemDictionary ? 'dictionary' : 'reference', reference, records: 0, reason: matched.length ? '按分类规则统一实体，完整原结构另行保留' : '完整保留参考／其他语言／规则数据，不伪装成物品' };
    inventory.push(item);
    const lang = dictionary ? /(?:dict\.|dicts\/)([a-z]+)\.json$/.exec(file.id)?.[1] : itemDictionary ? /\/i18n\/([a-z]+)\.json$/.exec(file.id)?.[1] : null;
    if (lang && contract.locales.includes(normalizeLocale(lang))) dictionaries.push({ ...doc, locale: normalizeLocale(lang), shape: itemDictionary ? 'item' : 'language' });
    if (wikiMetadata) { item.status = 'metadata'; item.reason = '只读提取技能、强化及武器家族／灵化元数据；Lua 不执行，原文另行保留'; continue; }
    const seen = new Set();
    for (const rule of matched) {
      const add = (key, record, at) => {
        if (!record || typeof record !== 'object' || Array.isArray(record)) return;
        const raw = rule.shape === 'map' ? key : record[rule.idKey ?? 'uniqueName'] ?? key;
        if ((typeof raw !== 'string' && typeof raw !== 'number') || raw === '') throw new Error('实体标识缺失：' + file.id + at);
        const id = entityId(raw, rule.kind), duplicate = id + '\0' + at;
        if (seen.has(duplicate)) return; seen.add(duplicate);
        if (!index.has(id)) index.set(id, []);
        if (index.get(id).some(r => r.source.file === file.id && r.source.pointer !== at)) duplicates.push({ entityId: id, file: file.id, pointer: at });
        index.get(id).push({ id, rawId: raw, kind: rule.kind, classificationPriority: rule.classificationPriority ?? 1, locale: rule.locale ?? (file.source === 'wfcd' ? 'en' : null), value: record, source: { source: file.source, file: file.id, hash, pointer: at } }); item.records++;
      };
      if (rule.shape === 'map') for (const [key, record] of Object.entries(value)) add(key, record, '/' + pointer(key));
      else if (['array', 'group'].includes(rule.shape)) {
        const rows = rule.shape === 'group' ? value[rule.group] : value;
        if (!Array.isArray(rows)) { if (rule.shape === 'group' && rows === undefined) continue; throw new Error('分类规则要求数组：' + file.id); }
        rows.forEach((record, i) => add(record?.[rule.idKey ?? 'uniqueName'], record, `${rule.shape === 'group' ? '/' + pointer(rule.group) : ''}/${i}`));
      } else {
        const visit = (node, at = '', depth = 0) => {
          if (depth > 5 || !node || typeof node !== 'object') return;
          if (Array.isArray(node)) { node.forEach((record, i) => { if (record?.uniqueName) add(record.uniqueName, record, `${at}/${i}`); }); return; }
          for (const [key, record] of Object.entries(node)) {
            const next = at + '/' + pointer(key);
            if (key.startsWith('/') && record && !Array.isArray(record) && typeof record === 'object') add(key, record, next);
            else if (!key.startsWith('/')) visit(record, next, depth + 1);
          }
        }; visit(value);
      }
    }
    if (index.size > contract.scope.maxEntities) throw new Error('全量实体数超出规则上限');
  }
  if (!documents.some(d => d.source === 'plus' && /\/ExportRewards.json$/.test(d.file) && !Array.isArray(d.value) && Object.keys(d.value).length > 0) || !index.size) throw new Error('全量构建需要 Plus 奖励表及有效分类数据');
  // WFCD translations mirror item fields (including abilities/levelStats); they
  // are not a flat language-key dictionary. Attach only to known identities.
  for(const dictionary of dictionaries.filter(d=>d.shape==='item')) for(const [id,value] of Object.entries(dictionary.value)) {
    const parent=index.get(id)?.[0];if(!parent || !value || typeof value!=='object' || Array.isArray(value))continue;
    index.get(id).push({...parent,locale:dictionary.locale,dictionary:true,value,source:{source:dictionary.source,file:dictionary.file,hash:dictionary.hash,pointer:'/'+pointer(id)}});
  }
  indexNested(index, contract);
  if (index.size > contract.scope.maxEntities) throw new Error('全量嵌套实体数超出规则上限');
  const missingRules = rules.filter(rule => !documents.some(d => d.source === rule.source && (d.file === `${rule.source}/${rule.file}` || d.file.endsWith('/' + rule.file))));
  return { documents, inventory, index, dictionaries, references, duplicates, missingRules };
}
