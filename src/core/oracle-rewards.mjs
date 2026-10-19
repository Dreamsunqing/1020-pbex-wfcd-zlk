import { CHALLENGE_MANIFESTS, LOCATION_MANIFESTS, activeSyndicate, stateProvenance } from './oracle-bounties.mjs';

export const REWARD_CATALOG_FILES = ['ExportResources.json', 'ExportRecipes.json', 'ExportWeapons.json', 'ExportWarframes.json', 'ExportUpgrades.json', 'ExportGear.json', 'ExportCreditBundles.json', 'ExportFusionBundles.json'];
const pointer = key => String(key).replace(/~/g, '~0').replace(/\//g, '~1');
const tail = key => key?.split('/').at(-1) ?? '未知物品';
const source = (file, key, field) => ({ file: `plus/${file}`, pointer: `/${pointer(key)}${field ? `/${field}` : ''}` });
const positive = value => Number.isFinite(value) && value >= 0;

// Exact StoreItems -> export path conversion only; table paths are never rewritten.
export function rewardResolver(data) {
  const index = new Map();
  for (const [file, entries] of Object.entries(data.rewardCatalogs ?? {})) for (const [key, entry] of Object.entries(entries)) if (entry && typeof entry === 'object' && !Array.isArray(entry)) index.set(key, { file, entry });
  const localized = key => {
    if (typeof key !== 'string') return null;
    for (const [file, dictionary] of Object.entries(data.rewardDictionaries ?? {})) if (typeof dictionary[key] === 'string' && dictionary[key]) return { name: dictionary[key], dictionary: { file, pointer: `/${pointer(key)}` }, nameKey: key };
    return null;
  };
  const item = raw => {
    const key = typeof raw.type === 'string' ? raw.type.replace(/^\/Lotus\/StoreItems\//, '/Lotus/') : '';
    const found = index.get(key), direct = localized(found?.entry.name), recipeResult = found?.entry.resultType, product = index.get(recipeResult), productName = localized(product?.entry.name);
    const translated = direct ?? productName;
    const nameSource = found ? { ...source(found.file, key, direct ? 'name' : 'resultType'), ...translated, ...(direct || !productName ? {} : { resultSource: source(product.file, recipeResult, 'name'), derived: '成品中文名 + 蓝图' }) } : null;
    if (nameSource) delete nameSource.name;
    const count = positive(raw.itemCount) ? raw.itemCount : null;
    let name = direct?.name ?? (productName ? `${productName.name} 蓝图` : tail(key)), quantity = count, conversion = null;
    for (const [field, unit] of [['fusionPoints', '内融核心'], ['credits', '现金']]) if (positive(found?.entry[field]) && count !== null) {
      quantity = found.entry[field] * count; name = field === 'fusionPoints' ? direct?.name ?? unit : unit;
      conversion = { field, perItem: found.entry[field], originalName: direct?.name ?? null, source: source(found.file, key, field), labelBasis: field === 'credits' ? '工作台数量单位' : '来源字典' };
      break;
    }
    return { ...raw, key, name, localization: translated ? 'upstream' : 'missing', itemCount: raw.itemCount ?? null, quantity, rawProbability: raw.probability ?? null, probability: positive(raw.probability) && raw.probability <= 1 ? raw.probability : null, nameSource, conversion };
  };
  const table = key => {
    const raw = data.rewardTables?.[key];
    if (!Array.isArray(raw) || !raw.length || raw.some(pool => !Array.isArray(pool))) return { key, source: source('ExportRewards.json', key), status: 'missing', pools: [], warnings: ['奖励表缺失或结构无效'] };
    const warnings = [], pools = raw.map((pool, i) => ({ index: i + 1, source: { file: 'plus/ExportRewards.json', pointer: `/${pointer(key)}/${i}` }, items: pool.map((entry, j) => {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) { warnings.push(`奖励池 ${i + 1} 第 ${j + 1} 项结构无效`); return { type: null, name: '无效奖励项', localization: 'missing', itemCount: null, quantity: null, probability: null }; }
      const value = item(entry);
      if (!value.type || value.quantity === null || value.probability === null || value.localization === 'missing') warnings.push(`奖励池 ${i + 1} 第 ${j + 1} 项有待补充字段`);
      return { ...value, source: { file: 'plus/ExportRewards.json', pointer: `/${pointer(key)}/${i}/${j}` } };
    }) }));
    return { key, source: source('ExportRewards.json', key), status: warnings.length ? 'partial' : 'available', pools, warnings };
  };
  const fixed = (manifest, tier) => ({ xpAmount: tier.xpAmount ?? null, xpItem: manifest.XpItemType ? item({ type: manifest.XpItemType, itemCount: 1 }) : null, chemistryAmount: tier.chemistryAmount ?? null });
  return { table, fixed };
}

export function describeBountyRewards(result, data, scope, { state, at = Date.now() } = {}) {
  const resolve = rewardResolver(data);
  if (scope === 'cycle') for (const [tag, rows] of Object.entries(result.bounties)) {
    const file = CHALLENGE_MANIFESTS[tag], manifest = data.manifests[file];
    rows.forEach((row, i) => {
      const tier = manifest.ChallengeMissionDifficultyTiers[i];
      row.rewardDetails = { basis: 'manifest-tier', source: { file: `oracle/data/${file}`, pointer: `/data/ChallengeMissionDifficultyTiers/${i}` }, fixed: resolve.fixed(manifest, tier), table: resolve.table(tier.rewards) };
    });
  }
  if (scope === 'locations') {
    result.rewardCatalog = {};
    for (const [tag, [file, prefix]] of Object.entries(LOCATION_MANIFESTS)) {
      const manifest = data.manifests[file]; let current = null, reason = '手填 seed 为离线复算，未确认实时奖励轮次';
      if (result.input === 'world-state') {
        try { current = activeSyndicate(state, tag, at); reason = ''; }
        catch { reason = '该地区缺少覆盖参考时间的唯一世界状态，请刷新或重新导入；暂按候选奖励表查看。'; }
      }
      const normalJobs = new Set((manifest.Jobs ?? []).map(key => prefix + key));
      const applicableJobs = [...new Set(result.locations[tag].flatMap(row => row.jobs))].filter(key => normalJobs.has(key));
      // LocationSpecificJobs has no difficulty. Offer a shared normal-job tier catalog,
      // never assign tier N to the Nth shuffled job or borrow another planet's rotation.
      const tiers = (manifest.JobDifficultyTiers ?? []).flatMap((tier, i) => {
        if (tier.useExtraJobs || tier.endless || !applicableJobs.length) return [];
        const candidates = tier.rewardManifests ?? [], matches = [...new Set((current?.jobs ?? []).map(job => job.rewards))].filter(key => candidates.includes(key));
        const status = matches.length === 1 ? 'world-state' : candidates.length === 1 ? 'fixed' : 'unconfirmed';
        const selected = status === 'world-state' ? matches : candidates;
        return [{ tier: i + 1, enemyLevel: tier.enemyLevel, stageCount: tier.stageCount, masteryReq: tier.masteryReq, fixed: resolve.fixed(manifest, tier), status, reason: status === 'unconfirmed' ? reason || (matches.length > 1 ? '当前输入匹配多个轮次，展示全部候选' : '当前输入没有匹配的奖励表，展示全部候选') : null, candidateKeys: candidates, tables: selected.map(resolve.table), source: { file: `oracle/data/${file}`, pointer: `/data/JobDifficultyTiers/${i}` } }];
      });
      result.rewardCatalog[tag] = { applicableJobs, jobFamily: 'normal', note: '地区任务没有指定难度；以下是这些普通任务可选的难度奖励，不含额外、无尽及隔离库任务。奖励池按源文件顺序展示，尚未映射到具体阶段。', worldState: current ? { ...stateProvenance(state), startsAt: current.startsAt, endsAt: current.endsAt } : null, tiers };
    }
  }
  return result;
}
