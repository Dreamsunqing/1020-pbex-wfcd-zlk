import { modSetBonus } from '../mod-sets.mjs';
import { cardArt } from '../card-art.mjs';
import { selectLocalizedField, applyLocalizedFields } from '../text-localization.mjs';
import path from 'node:path';
import { internalItems } from './display-policy.mjs';
import { plainGameText } from '../inline-tokens.mjs';
import { iconFilename, isAbilityIcon } from '../image-presentation.mjs';
import { KINDS } from './rules.mjs';
import { describeField } from '../field-guide.mjs';
import { nestedRules } from './nested.mjs';
import { pointerValue } from '../library.mjs';
import { FULL_MODELING_VERSION, compareText, digest } from './contract.mjs';
import { allItems, MergeRepository } from './repository.mjs';
import { readLibraryFile, snapshotEntry, snapshotFiles } from '../library.mjs';

export async function mergeContext({ library, release, mode, store }) {
  if (mode !== 'snapshot' && !library) throw new Error('请先打开资料目录');
  const selectedRelease = mode === 'snapshot' ? release : null;
  const context = selectedRelease ? { mode: 'snapshot', releaseId: selectedRelease.id } : { mode: 'local', root: library.root };
  const files = selectedRelease ? await snapshotFiles(store, selectedRelease) : library.files;
  const read = selectedRelease ? async id => { const entry = snapshotEntry(selectedRelease, id); return { bytes: await store.bytes(entry), hash: entry.hash }; } : id => readLibraryFile(library.root, id);
  return { context, files, read, repository: new MergeRepository(path.join(store.root, 'merged', digest(context))) };
}
export async function mergedStatus(ctx) {
  const data = await ctx.repository.current();
  return data ? { available: true, context: ctx.context, manifest: data.manifest, needsRebuild: data.manifest.schemaVersion === 2 && data.manifest.modelingVersion !== FULL_MODELING_VERSION, previousVersion: data.previousVersion } : { available: false, context: ctx.context };
}
export async function datasetFor(ctx, expectedVersion) {
  const data = await ctx.repository.current();
  if (!data) throw new Error('请先构建当前目录或快照的合并数据');
  if (expectedVersion && data.manifest.datasetVersion !== expectedVersion) throw new Error('合并资料版本已变化，请刷新合并汇总');
  return data;
}
const kinds = new Set(['', ...Object.keys(KINDS)]);
export function expandEvidence(data, value) {
  if (!value || typeof value !== 'object') return value;
  if (Number.isInteger(value.input) && typeof value.pointer === 'string') { const input = data.manifest.inputs[value.input]; if (!input) throw new Error('溯源输入索引无效'); return { source: input.source, file: input.file, hash: input.hash, pointer: value.pointer, ...(Number.isInteger(value.line) ? { line: value.line } : {}) }; }
  if (Array.isArray(value)) return value.map(row => expandEvidence(data, row));
  return Object.fromEntries(Object.entries(value).map(([key, row]) => [key, expandEvidence(data, row)]));
}
function sourceRecords(data, id = null) {
  return data.output['reports/source-records.json'].filter(row => id === null || row.entityId === id).map(row => {
    const expanded = expandEvidence(data, row);
    if (!Object.hasOwn(expanded, 'value')) { const file = data.output['reports/coverage.json'].files.find(f => f.file === expanded.source.file); expanded.value = pointerValue(data.output[file.reference], expanded.source.pointer); }
    return expanded;
  });
}
const imageCache = new WeakMap();
const iconCache = new WeakMap();
const modSetCache = new WeakMap();
const imageNames = data => {
  if (!imageCache.has(data.output)) {
    const inventory = new Map((data.output['reports/coverage.json']?.files ?? []).map(f => [f.file, f]));
    const names = {}, icons = {};
    for (const row of data.output['reports/source-records.json']??[]) {
      const source = expandEvidence(data, row.source), reference = inventory.get(source.file)?.reference;
      const value = row.value ?? (reference ? pointerValue(data.output[reference], source.pointer) : null);
      if (!value || typeof value !== 'object') continue;
      if (source.source === 'wfcd' && typeof value.imageName === 'string') names[row.entityId] = value.imageName;
      if (typeof value.icon === 'string' && !icons[row.entityId]) icons[row.entityId] = value.icon;
    }
    iconCache.set(data.output, icons);
    imageCache.set(data.output, names);
  }
  return imageCache.get(data.output);
};
// Project nested effects/type for the requested language before drawing a card.
export function localizedCardArt(data,item,locale='zh-CN') {
  if(!['mod','arcane'].includes(item.kind))return null;
  const keys=new Set(['en',locale].flatMap(language=>Object.keys(data.output['localizations/'+language+'.json']?.[item.id]??{})));
  const fields=Object.fromEntries([...keys].map(field=>[field,selectLocalizedField(data,item.id,field,locale)]).filter(([,entry])=>entry));
  const art=cardArt(applyLocalizedFields(item,fields),locale);
  if(art?.kind==='mod'&&item.modSetId){
    if(!modSetCache.has(data.output))modSetCache.set(data.output,new Map(allItems(data).filter(i=>i.kind==='mod-set').map(i=>[i.id,i])));
    const set=modSetCache.get(data.output).get(item.modSetId),bonus=modSetBonus(set,1,locale);
    if(set?.modSetInfo){const descriptor=data.output['player/images.json']?.[set.id];
      art.set={id:set.id,title:set.name?.[locale]??set.name?.en??'',size:set.modSetInfo.size,count:1,bonus:bonus?.text??'',fallback:bonus?.fallback??false,icon:{id:set.id,imageName:descriptor?.imageName??set.imageName,icon:descriptor?.icon??set.icon??set.attributes?.icon}};
    }
  }
  return art;
}
export const imageDescriptors = (data, items,locale='zh-CN') => {
  if(data.output['player/images.json'])return Object.fromEntries(items.map(item=>[item.id,{...data.output['player/images.json'][item.id],cardArt:localizedCardArt(data,item,locale)}]));
  const names = imageNames(data), recipes = new Map((data.output['recipes.json']??[]).map(row => [row.id, row]));
  return Object.fromEntries(items.map(item => {
    const resultId = recipes.get(item.id)?.resultId;
    const icon = iconCache.get(data.output)?.[item.id];
    return [item.id, { id: item.id, cardArt: localizedCardArt(data,item,locale), imageName: names[item.id] ?? iconFilename(icon), icon, abilityIcon: isAbilityIcon(icon, names[item.id]), blueprint: item.kind === 'blueprint', resultId, resultImageName: names[resultId] }];
  }));
};
const itemTitle = (item,locale) => item?.name?.[locale] ?? item?.name?.en ?? item?.id?.split('/').at(-1);
function itemBadges(data, ids,locale='zh-CN') {
  const items = new Map(allItems(data).map(item => [item.id, item]));
  return Object.fromEntries(ids.map(id => { const item = items.get(id); return [id, { kind: item?.kind, augments: (item?.augments ?? []).filter(a => items.has(a.itemId)).map(a => ({ ...a, title: itemTitle(items.get(a.itemId),locale) })), transferable: Boolean(item?.helminth?.transferable), exportAbilities: item?.kind === 'ability' }]; }));
}
export function mergedList(data, { query = '', kind = '', offset = 0, limit = 80, includeInternal = false, locale = 'zh-CN' } = {}) {
  if (typeof query !== 'string' || query.length > 500 || !kinds.has(kind) || !Number.isInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1 || limit > 200) throw new Error('合并资料筛选参数无效');
  if (!(data.manifest.locales ?? ['zh-CN','en']).includes(locale)) throw new Error('未构建该语言');
  if (typeof includeInternal !== 'boolean') throw new Error('内部项筛选参数无效');
  const search = query.trim().toLocaleLowerCase(), hidden = internalItems(data);
  const kindOrder = Object.keys(KINDS);
  const matching = allItems(data).filter(item => (!kind || item.kind === kind) && (!search || `${item.id} ${Object.values(item.name).join(' ')} ${Object.values(item.name).map(value => plainGameText(value, 'name')).join(' ')}`.toLocaleLowerCase().includes(search)));
  const rows = matching.filter(item => includeInternal || !hidden.has(item.id)).sort((a, b) => kindOrder.indexOf(a.kind) - kindOrder.indexOf(b.kind) || compareText(a.id, b.id));
  const page = rows.slice(offset, offset + limit), names = imageNames(data);
  return { locale, locales:data.manifest.locales ?? ['zh-CN','en'], kinds: KINDS, datasetVersion: data.manifest.datasetVersion, rows: page.map(item => ({ ...item, internalReason: hidden.get(item.id) })), hiddenCount: matching.filter(item => hidden.has(item.id)).length, includeInternal, badges: itemBadges(data, page.map(i => i.id),locale), images: imageDescriptors(data, page,locale), imageNames: Object.fromEntries(page.map(row => [row.id, names[row.id]])), total: rows.length, hasMore: offset + limit < rows.length };
}
export function mergedDetail(data, id, {locale='zh-CN'}={}) {
  if (!(data.manifest.locales ?? ['zh-CN','en']).includes(locale)) throw new Error('未构建该语言');
  const canonicalItem = allItems(data).find(item => item.id === id);
  if (!canonicalItem) throw new Error('合并物品不存在');
  const projections=Object.fromEntries([...new Set((data.manifest.locales ?? ['zh-CN','en']).flatMap(language=>Object.keys(data.output['localizations/'+language+'.json']?.[id] ?? {})))].map(field=>[field,selectLocalizedField(data,id,field,locale)]));
  const item=applyLocalizedFields(canonicalItem,projections);
  const names = new Map(allItems(data).map(row => [row.id, itemTitle(row,locale)]));
  const entities = new Map(allItems(data).map(i => [i.id, i]));
  const sources = sourceRecords(data, id), inventory = new Map((data.output['reports/coverage.json']?.files ?? []).map(file => [file.file, file]));
  const references = {};
  const scan = value => {
    if (typeof value === 'string' && names.has(value)) references[value] = names.get(value);
    else if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) { if (names.has(key)) references[key] = names.get(key); scan(child); }
  }; scan(item);
  const relatedIds = new Set([id, ...Object.keys(references)]);
  for (const relation of data.output['relations.json']) if (relation.from === id || relation.to === id) relatedIds.add(relation.from === id ? relation.to : relation.from);
  return {
    locale, locales:data.manifest.locales ?? ['zh-CN','en'], datasetVersion: data.manifest.datasetVersion, item, internalReason: internalItems(data).get(id), image: imageDescriptors(data, [item],locale)[id], imageName: imageNames(data)[id], recipe: expandEvidence(data, data.output['recipes.json'].find(row => row.id === id) ?? null),
    fields: expandEvidence(data, data.output['reports/provenance.json'].filter(row => row.entityId === id)).map(field => {
      const candidates = field.candidates.map(candidate => {
        if (!candidate.compact) return candidate;
        const reference = inventory.get(candidate.source.file)?.reference;
        const record = sources.find(row => row.source.file === candidate.source.file && (candidate.source.pointer === row.source.pointer || candidate.source.pointer.startsWith(row.source.pointer + '/')));
        const value = reference ? pointerValue(data.output[reference], candidate.source.pointer) : record ? pointerValue(record.value, candidate.source.pointer.slice(record.source.pointer.length)) : null;
        return { ...candidate, value, rawValue: value };
      });
      const key = candidates[0]?.source.pointer.split('/').at(-1)?.replaceAll('~1', '/').replaceAll('~0', '~') ?? field.field;
      const localization=field.status==='override'?null:expandEvidence(data,selectLocalizedField(data,id,field.field,locale));
      let selected=field.selected;
      if(localization){const original=candidates.find(c=>c.source.file===localization.source.file && c.source.pointer===localization.source.pointer);candidates.push({...localization,rawValue:original?.rawValue});selected=candidates.length-1;}
      return { ...field, selected, localization, guide: describeField(key, field.field, candidates[0]?.source.file), candidates, value: localization ? localization.value : field.value === undefined ? field.selected === null ? null : candidates[field.selected]?.value : field.value };
    }),
    issues: expandEvidence(data, data.output['reports/issues.json'].filter(row => row.entityId === id)),
    relations: expandEvidence(data, data.output['relations.json'].filter(row => row.from === id || row.to === id)).map(row => ({ ...row, fromLabel: names.get(row.from) ?? row.from.split('/').at(-1), toLabel: names.get(row.to) ?? row.to.split('/').at(-1), navigable: row.from === id ? names.has(row.to) : names.has(row.from) })),
    sources, references, images: imageDescriptors(data, [...relatedIds].map(id => entities.get(id)).filter(Boolean),locale), badges: itemBadges(data, [...relatedIds],locale),
    relationDefinitions: Object.fromEntries([...nestedRules(data.output['contract.json'])].reverse().map(r => [r.relation, r.label])),
    collectionDefinitions: Object.fromEntries([...nestedRules(data.output['contract.json'])].reverse().map(r => [r.path, r.label]).concat([['augments', '集团卡／强化 Mod'], ['helminth.listedFrames', '可移植技能所属战甲']])),
    definitions: data.output['contract.json'].fields
  };
}
