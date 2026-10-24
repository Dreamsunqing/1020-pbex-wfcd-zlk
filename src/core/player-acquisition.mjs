import { allItems } from './merge/repository.mjs';
import { rewardContexts } from './merge/reward-context.mjs';
import { selectLocalizedField } from './text-localization.mjs';
import { plainGameText } from './inline-tokens.mjs';
import { relicIdentity, relicIndex, relicDrops, RELIC_QUALITIES } from './player-relics.mjs';

const normalize = value => plainGameText(value, 'name').trim().replace(/[’]/g, "'").replace(/\s+/g, ' ').toLowerCase();
const cache = new WeakMap();
const relicCache = new WeakMap();
function sourceRelics(data) {
  if (!relicCache.has(data.output)) relicCache.set(data.output, relicIndex(allItems(data)));
  return relicCache.get(data.output);
}
const title = (item, locale) => plainGameText(item?.name?.[locale] ?? item?.name?.en ?? '', 'name');
const field = (data, item, key, locale) => selectLocalizedField(data, item.id, 'attributes.' + key, locale)?.value ?? item.attributes?.[key];

export function playerWikiLinks(item) {
  const links = [];
  const raw = item.attributes?.wikiaUrl ?? item.attributes?.wikiUrl;
  if (typeof raw === 'string') try {
    const url = new URL(raw);
    if (['https:', 'http:'].includes(url.protocol) && !url.username && !url.password && !url.port && ['wiki.warframe.com', 'warframe.fandom.com'].includes(url.hostname)) links.push({ label: 'Warframe Wiki ↗', url: url.href, basis: 'source-field' });
  } catch { /* A malformed upstream URL is not an executable link. */ }
  const seen = new Set();
  for (const [locale, label] of [['zh-CN', '灰机 Wiki · 中文 ↗'], ['en', '灰机 Wiki · English ↗']]) {
    const name = item.name?.[locale] && title(item, locale);
    if (!name || name.startsWith('/') || seen.has(name)) continue;
    seen.add(name);
    links.push({ label, url: 'https://warframe.huijiwiki.com/wiki/' + encodeURIComponent(name.replaceAll(' ', '_')), basis: 'name-derived' });
  }
  return links;
}

// The compact index is built once from the full P3 snapshot and embedded in the
// application. Runtime uses the identical projection for a user-built dataset.
export function acquisitionIndex(data) {
  if (data.output['player/acquisition.json']) return data.output['player/acquisition.json'];
  if (cache.has(data.output)) return cache.get(data.output);
  const items = allItems(data), byId = new Map(items.map(i => [i.id, i])), entries = {}, report = { drops: 0, poolRows: 0, rejectedDropRows: 0, rejectedDrops: [], skippedCollections: 0 }, rejected = new Map();
  const recipes = new Map((data.output['recipes.json'] ?? []).map(r => [r.id, r]));
  const relics = sourceRelics(data);
  const expand = source => Number.isInteger(source?.input) ? { ...data.manifest.inputs[source.input], pointer: source.pointer } : source;
  const dropSources = new Map((data.output['reports/provenance.json'] ?? []).filter(p => p.field === 'attributes.drops').map(p => [p.entityId, expand(p.candidates?.[p.selected ?? 0]?.source)]));
  const add = (id, row) => { (entries[id] ??= []).push(row); };
  const names = new Map();
  for (const item of items.filter(i => ['region', 'enemy'].includes(i.kind))) {
    const name = normalize(item.name?.en ?? '');
    if (name) { if (!names.has(name)) names.set(name, []); names.get(name).push(item); }
  }
  for (const item of items) {
    // Enemy.drops is an outgoing loot table with different labels/units, not
    // a way to acquire that enemy. Node/animal tables must not masquerade as loot.
    if (['enemy', 'region', 'animal', 'quest', 'mod-set'].includes(item.kind)) { if (item.attributes?.drops?.length) report.skippedCollections++; continue; }
    const expected = new Set([normalize(item.name?.en ?? '')].filter(Boolean));
    const product = byId.get(recipes.get(item.id)?.resultId);
    if (item.kind === 'blueprint' && product?.name?.en) expected.add(normalize(product.name.en + ' Blueprint'));
    const relic = relicIdentity(item);
    const baseRelic = value => value.replace(/\s*\((intact|exceptional|flawless|radiant)\)$/, '').replace(/ (intact|exceptional|flawless|radiant|relic)$/, '');
    const seen = new Set();
    for (const [at, drop] of (Array.isArray(item.attributes?.drops) ? item.attributes.drops : []).entries()) {
      if (!drop || typeof drop.location !== 'string' || !drop.location.trim() || typeof drop.type !== 'string') continue;
      const quantity = /^(\d+(?:\.\d+)?)\s*[xX×]\s*/.exec(drop.type), reward = normalize(drop.type.replace(/^(\d+(?:\.\d+)?)\s*[xX×]\s*/, ''));
      if (![...expected].some(name => reward === name || relic && baseRelic(reward) === baseRelic(name))) {
        report.rejectedDropRows++;
        const key=item.id+'\0'+drop.type;
        if(!rejected.has(key)){const row={id:item.id,at,reward:drop.type,occurrences:0,reason:'奖励名称与拥有此 drops 的物品不符'};rejected.set(key,row);report.rejectedDrops.push(row);}
        rejected.get(key).occurrences++;continue;
      }
      const rotation = /,\s*Rotation\s+([A-Z])$/i.exec(drop.location), place = drop.location.replace(/,\s*Rotation\s+[A-Z]$/i, '');
      const node = /^([^/]+)\/([^()]+?)(?:\s*\((.*)\))?$/.exec(place);
      let matches = names.get(normalize(node?.[2] ?? place)) ?? [];
      if (node) matches = matches.filter(i => i.kind === 'region' && normalize(field(data, i, 'systemName', 'en') ?? '') === normalize(node[1]));
      let target = matches.length === 1 ? matches[0] : null;
      // WFCD component drops carry the source relic's full identity; that
      // identity points to Bronze even when location explicitly says Radiant.
      const family = relics.byId.get(drop.uniqueName), sourceQuality = /\((Intact|Exceptional|Flawless|Radiant)\)$/i.exec(place)?.[1]?.toLowerCase();
      const qualityKey = ({intact:'Bronze',exceptional:'Silver',flawless:'Gold',radiant:'Platinum'})[sourceQuality] ?? relicIdentity(byId.get(drop.uniqueName) ?? {})?.quality;
      if (family) target = family.variants.get(qualityKey) ?? family.item;
      const localized = {};
      if (target) for (const locale of data.manifest.locales ?? ['zh-CN', 'en']) localized[locale] = [target.kind === 'region' ? field(data, target, 'systemName', locale) : '', title(target, locale), target.kind === 'region' ? field(data, target, 'missionName', locale) : '', family ? (locale.startsWith('zh') ? RELIC_QUALITIES.find(([key])=>key===qualityKey)?.[1] : ({Bronze:'Intact',Silver:'Exceptional',Gold:'Flawless',Platinum:'Radiant'})[qualityKey]) : ''].filter(Boolean).join(' · ');
      const chance = Number.isFinite(drop.chance) && drop.chance >= 0 && drop.chance <= 100 ? drop.chance : null;
      const quality = relic ? /(?:\s|\()(Intact|Exceptional|Flawless|Radiant)\)?$/i.exec(drop.type)?.[1] : null;
      const row = { method: 'drop', title: localized, original: place, rotation: rotation?.[1] ?? null, ...(quality ? { rewardVariant: { intact:'完整遗物',exceptional:'无暇遗物',flawless:'良好遗物',radiant:'光辉遗物' }[quality.toLowerCase()] } : {}), chance, quantity: quantity && Number(quantity[1]) > 0 ? Number(quantity[1]) : null, links: target ? [target.id] : [], source: 'WFCD', basis: family ? 'exact-relic-source-id' : target ? 'unique-location' : 'source-text' };
      const key = JSON.stringify(row); if (seen.has(key)) continue; seen.add(key);
      const source = dropSources.get(item.id); if (source) row.evidence = { source: source.source, file: source.file, hash: source.hash, pointer: source.pointer + '/' + at };
      add(item.id, row); report.drops++;
    }
  }
  const tables = data.output['reward-tables.json'] ?? [];
  const contexts = tables.length ? rewardContexts(data) : new Map();
  for (const table of tables) {
    const context = contexts.get(table.id), links = [];
    for (const origin of context?.origins ?? []) {
      const key = origin.source?.pointer?.split('/')[1]?.replaceAll('~1', '/').replaceAll('~0', '~');
      const id = key?.startsWith('/') ? key : 'wf:region/' + key;
      if (byId.has(id) && !links.includes(id)) links.push(id);
    }
    for (const pool of table.pools) for (const reward of pool.items) {
      if (!byId.has(reward.itemId)) continue;
      const source = expand(reward.source);
      add(reward.itemId, { method: 'pool', title: { 'zh-CN': context?.title ?? '任务奖励池', en: 'Mission reward pool' }, original: table.id, pool: pool.index, rotation: null, chance: Number.isFinite(reward.probability) ? reward.probability * 100 : null, quantity: reward.quantity ?? null, unit: reward.unit, rarity: reward.rarity, links, source: 'Plus', basis: context?.basis ?? 'unknown', ...(source ? { evidence: { source: source.source, file: source.file, hash: source.hash, pointer: source.pointer } } : {}) });
      report.poolRows++;
    }
  }
  const result = { entries, report }; cache.set(data.output, result); return result;
}

export function playerAcquisition(data, item, locale = 'zh-CN') {
  const index = acquisitionIndex(data), rows = index.entries[item.id] ?? [], relics = sourceRelics(data), groups = new Map(), result = [];
  function group(family) {
    if (!groups.has(family.key)) {
      const row = { method: 'relic', basis: 'relic-family', relicKey: family.key, title: title(family.item, locale), original: family.key, links: [{ id: family.item.id }], probabilities: [] };
      groups.set(family.key, { family, row, drops: [] }); result.push(row);
    }
    return groups.get(family.key);
  }
  for (const row of rows) {
    const families = new Set(row.links.map(id => relics.byId.get(id)));
    // Collapse only an unambiguous family. Never merge different relics merely
    // because their names or reward tables happen to look alike.
    if (families.size === 1 && !families.has(undefined)) {
      const entry = group([...families][0]); entry.drops.push(row);
      entry.row.evidence ??= row.evidence;
    } else result.push({ ...row, title: row.title?.[locale] ?? row.title?.en ?? row.original, links: row.links.map(id => ({ id })) });
  }
  // Exact reward IDs in the relic model are sufficient even if no WFCD drops
  // or Plus reward-pool row was available for this item.
  for (const family of relics.sources.get(item.id)?.values() ?? []) group(family);
  for (const { family, row, drops } of groups.values()) {
    const qualities = RELIC_QUALITIES.some(([key]) => family.variants.has(key)) ? RELIC_QUALITIES : [['Unrefinable', '固定品质']];
    row.probabilities = qualities.map(([key, label]) => {
      const variant = family.variants.get(key), rewards = variant ? relicDrops(variant).filter(r => r.id === item.id) : [];
      const values = new Set(rewards.map(r => r.probability));
      let probability = values.size === 1 ? [...values][0] : null;
      // Explicit WFCD source-quality odds can fill a missing value, but an
      // unqualified pool probability must never be copied into all qualities.
      if (variant && probability === null && rewards.length <= 1) {
        const known = new Set(drops.filter(r => r.method === 'drop' && r.basis === 'exact-relic-source-id' && r.links.length === 1 && relicIdentity({ id: r.links[0], kind: 'relic' })?.quality === key && Number.isFinite(r.chance) && r.chance >= 0 && r.chance <= 100).map(r => r.chance));
        if (known.size === 1) probability = [...known][0];
      }
      return { key, label, available: !!variant, probability };
    });
  }
  return result;
}
