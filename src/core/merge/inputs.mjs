import { parseDocument } from '../library.mjs';
import { sha256 } from '../io.mjs';
import { pointer } from './contract.mjs';

const catalogs = [
  ['ExportWeapons', 'weapon'], ['ExportWarframes', 'warframe'], ['ExportResources', 'resource'],
  ['ExportRecipes', 'blueprint'], ['ExportUpgrades', 'mod'], ['ExportGear', 'resource'],
  ['ExportCreditBundles', 'resource'], ['ExportFusionBundles', 'resource']
];
export function inputSpecs(contract) {
  const specs = catalogs.map(([name, kind]) => ({ source: 'plus', relative: `${name}.json`, shape: 'map', kind, required: true }));
  for (const locale of ['zh', 'en']) for (const [name, kind] of catalogs) specs.push({ source: 'official', relative: `manifests/${locale}/${name}_${locale}.json`, shape: 'groups', group: name, kind, locale: locale === 'zh' ? 'zh-CN' : 'en' });
  for (const [name, kind] of [['Primary', 'weapon'], ['Warframes', 'warframe'], ['Resources', 'resource'], ['Components', 'resource']]) specs.push({ source: 'wfcd', relative: `data/json/${name}.json`, shape: 'array', kind, locale: 'en' });
  specs.push(
    { source: 'plus', relative: 'dict.zh.json', shape: 'dictionary', locale: 'zh-CN', required: true },
    { source: 'plus', relative: 'dict.en.json', shape: 'dictionary', locale: 'en' },
    { source: 'wfcd', relative: 'data/json/i18n/zh.json', shape: 'item-dictionary', locale: 'zh-CN' },
    { source: 'oracle', relative: 'dicts/zh.json', shape: 'dictionary', locale: 'zh-CN' },
    { source: 'plus', relative: 'ExportRewards.json', shape: 'rewards', required: true },
    { source: 'oracle', relative: contract.scope.manifest, shape: 'manifest', required: true }
  );
  return specs;
}
export async function captureInputs({ files, read, contract }) {
  const documents = [], missing = [];
  for (const spec of inputSpecs(contract)) {
    const matches = files.filter(file => file.source === spec.source && (file.id === `${spec.source}/${spec.relative}` || file.id.endsWith('/' + spec.relative)));
    if (matches.length > 1) throw new Error(`来源文件不唯一：${spec.source}/${spec.relative}`);
    if (!matches.length) { if (spec.required) throw new Error(`小闭环缺少必需输入：${spec.source}/${spec.relative}`); missing.push({ source: spec.source, relative: spec.relative }); continue; }
    const id = matches[0].id, data = await read(id), hash = sha256(data.bytes);
    if (data.hash !== hash) throw new Error(`输入哈希不一致：${id}`);
    const parsed = parseDocument(data.bytes.toString('utf8'), id);
    if (parsed.format === 'text' || !parsed.value || typeof parsed.value !== 'object') throw new Error(`输入不是 JSON 对象或数组：${id}`);
    documents.push({ ...spec, file: id, hash, bytes: data.bytes.length, value: parsed.value });
  }
  return { documents, missing };
}
export async function verifyInputs(documents, read) {
  for (const doc of documents) if (sha256((await read(doc.file)).bytes) !== doc.hash) throw new Error(`构建期间输入发生变化，请重新构建：${doc.file}`);
}
export function adaptInputs(documents) {
  const index = new Map(), dictionaries = [], duplicate = [];
  for (const doc of documents) {
    if (['dictionary', 'item-dictionary'].includes(doc.shape)) { dictionaries.push(doc); continue; }
    const entries = doc.shape === 'map' ? Object.entries(doc.value).map(([id, value]) => [id, value, `/${pointer(id)}`])
      : doc.shape === 'array' ? doc.value.map((value, i) => [value?.uniqueName, value, `/${i}`])
        : doc.shape === 'groups' ? (doc.value[doc.group] ?? []).map((value, i) => [value?.uniqueName, value, `/${doc.group}/${i}`]) : [];
    const seen = new Set();
    for (const [id, value, at] of entries) {
      if (typeof id !== 'string' || !id.startsWith('/') || !value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`物品标识或记录结构无效：${doc.file}${at}`);
      if (seen.has(id)) duplicate.push({ id, file: doc.file, pointer: at }); seen.add(id);
      const candidate = { id, value, kind: doc.kind, locale: doc.locale ?? null, source: { source: doc.source, file: doc.file, pointer: at, hash: doc.hash } };
      if (!index.has(id)) index.set(id, []); index.get(id).push(candidate);
    }
  }
  return { index, dictionaries, duplicate };
}
