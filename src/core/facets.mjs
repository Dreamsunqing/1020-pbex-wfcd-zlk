// File-level metadata only: original documents and snapshots remain unchanged.
export const FACETS = {
  source: { label: '来源', values: {} },
  kind: { label: '类型', values: { dictionary: '字典', data: '数据', index: '索引', config: '配置', code: '源码', document: '文档', unknown: '未分类' } },
  language: { label: '语言', values: { zh: '简体中文', tc: '繁體中文', en: '英语', de: '德语', es: '西班牙语', fr: '法语', it: '意大利语', ja: '日语', ko: '韩语', pl: '波兰语', pt: '葡萄牙语', ru: '俄语', th: '泰语', tr: '土耳其语', uk: '乌克兰语', neutral: '语言无关', unknown: '语言未标明' } },
  category: { label: '数据类别', values: { weapons: '武器', warframes: '战甲', companions: '同伴', archwing: 'Archwing', railjack: '航道星舰', abilities: '技能', mods: 'MOD', arcanes: '赋能', relics: '遗物', resources: '资源 / 部件', gear: '消耗品 / 装备', cosmetics: '外观', missions: '任务 / 星图', rewards: '掉落 / 奖励', enemies: '敌人', factions: '派系 / 集团', recipes: '蓝图 / 配方', progression: '成长 / 挑战', shop: '商店 / 礼包', images: '图像索引', mixed: '综合', unknown: '未分类' } }
};
const languageCodes = Object.keys(FACETS.language.values).filter(x => !['neutral', 'unknown'].includes(x));
const categories = {
  weapons: ['weapons'], railjackweapons: ['weapons', 'railjack'], primary: ['weapons'], secondary: ['weapons'], melee: ['weapons'], 'arch-gun': ['weapons', 'archwing'], 'arch-melee': ['weapons', 'archwing'], sentinelweapons: ['weapons', 'companions'],
  warframes: ['warframes', 'archwing', 'abilities'], archwing: ['archwing'], sentinels: ['companions'], pets: ['companions'], animals: ['companions'], fish: ['resources'],
  abilities: ['abilities'], upgrades: ['mods'], 'upgrades-missing': ['mods'], mods: ['mods'], modset: ['mods'], focusupgrades: ['mods', 'progression'], avionics: ['mods', 'railjack'], arcanes: ['arcanes'], relics: ['relics'], relicarcane: ['relics', 'arcanes'],
  resources: ['resources'], components: ['resources'], gear: ['gear'], drones: ['gear'], keys: ['missions', 'gear'], railjack: ['railjack'],
  customs: ['cosmetics'], flavour: ['cosmetics'], skins: ['cosmetics'], glyphs: ['cosmetics'], sigils: ['cosmetics'], honoria: ['cosmetics'], palettes: ['cosmetics'],
  regions: ['missions'], node: ['missions'], systems: ['missions'], tilesets: ['missions'], missiontypes: ['missions'], emissiontype: ['missions'], 'starchart-export': ['missions'], bounties: ['missions', 'rewards'], quests: ['missions'],
  sortierewards: ['rewards'], rewards: ['rewards'], enemies: ['enemies'], enemy: ['enemies'], factions: ['factions'], efaction: ['factions'], syndicates: ['factions'],
  recipes: ['recipes'], dojorecipes: ['recipes'], achievements: ['progression'], challenges: ['progression'], intrinsics: ['progression'], nightwave: ['progression', 'rewards'],
  bundles: ['shop'], boosterpacks: ['shop'], boosters: ['shop'], creditbundles: ['shop'], fusionbundles: ['shop', 'resources'], vendors: ['shop'], emailitems: ['shop'],
  images: ['images'], manifest: ['images'], texticons: ['images'], codex: ['mixed'], virtuals: ['mixed'], misc: ['mixed'], 'riven_unrollables': ['weapons', 'mods'], 'resource-supplementals': ['resources'], 'gifting-bonuses': ['shop']
};

export function classifyFile(relative, source = 'archive') {
  const file = relative.replaceAll('\\', '/').toLowerCase();
  const name = file.split('/').at(-1); const json = /\.jsonc?$/.test(name);
  let stem = name.replace(/\.jsonc?$/, '');
  let kind = json ? 'data' : /\.(md|txt)$/.test(name) ? 'document' : 'code';
  let language = 'unknown'; let category = [];
  const dictionary = /(?:^|\/)dict[.\/s]/.test(file) || /(?:^|\/)i18n\//.test(file);
  const suffix = new RegExp(`(?:^|[._-])(${languageCodes.join('|')})$`).exec(stem);
  if (suffix) { language = suffix[1]; stem = stem.slice(0, suffix.index); }
  if (dictionary && json) { kind = 'dictionary'; category = ['mixed']; }
  else if (json && (/^(?:package(?:-lock)?|tsconfig(?:\..*)?|\.babelrc|.*\.schema)$/.test(stem) || /(?:^|\/)config\//.test(file))) kind = 'config';
  else if (json && (/(?:^|\/)data\/cache\//.test(file) || /^(?:exportmanifest|manifest|exportimages)$/.test(stem))) kind = 'index';
  if (!category.length && json) category = categories[stem.replace(/^export/, '')] ?? [];
  if (source === 'wfcd' && stem === 'warframes') category = ['warframes', 'abilities'];
  if (/jobmanifest$/.test(stem) || name === 'arbys.txt') { kind = 'data'; category = ['missions', 'rewards']; }
  if (name === '.images.json') category = ['images'];
  if (name === '.export.json') category = ['mixed'];
  // ExportManifest is repeated in language folders but contains image paths, not translations.
  if (['config', 'index', 'code'].includes(kind)) language = 'neutral';
  else if (language === 'unknown' && source === 'plus' && json) language = 'neutral';
  else if (language === 'unknown' && source === 'wfcd' && /(?:^|\/)data\/json\//.test(file) && json) language = 'en';
  else if (language === 'unknown' && /jobmanifest$/.test(stem)) language = 'neutral';
  return { kind: [kind], language: [language], category: category.length ? category : ['unknown'] };
}

export function facetValues(file, key) { return key === 'source' ? [file.source] : file.facets?.[key] ?? ['unknown']; }
export function matchesFacets(file, selections, omit) {
  return Object.entries(selections).every(([key, selected]) => key === omit || selected.size === 0 || facetValues(file, key).some(value => selected.has(value)));
}
// Counts ignore the picker's own selection so alternatives remain available when checked.
export function facetCounts(files, selections, key) {
  const counts = new Map();
  for (const file of files) if (matchesFacets(file, selections, key)) for (const value of new Set(facetValues(file, key))) counts.set(value, (counts.get(value) ?? 0) + 1);
  return counts;
}
