import { pointerValue } from '../library.mjs';
const pointer = key => String(key).replaceAll('~', '~0').replaceAll('/', '~1');
const regions = { Eidolon: '夜灵平原', Venus: '奥布山谷', Microplanet: '火卫二', Zariman: '扎里曼', EntratiLabs: '英择谛实验室', WF1999: '1999 · Hex' };
// Human explanations of exact upstream path families; these do not prove live availability.
const families = {
  EidolonJobMissionRewards: ['夜灵平原赏金', '赏金'], VenusJobMissionRewards: ['奥布山谷赏金', '赏金'], DeimosMissionRewards: ['火卫二赏金／任务', '赏金／任务'], ZarimanJobMissionRewards: ['扎里曼赏金', '赏金'], EntratiLabJobMissionReward: ['英择谛实验室赏金', '赏金'],
  '1999MissionRewards': ['1999 任务', '任务'], '1999ConquestRewards': ['Hex 时光科研', '周常'], EntratiLabConquestRewards: ['实验室深层科研', '周常'],
  VoidKeyMissionRewards: ['虚空遗物奖励', '遗物'], ImmortalRelicRewards: ['安魂遗物奖励', '遗物'], VoidPrimeVault: ['Prime 宝库奖励', '遗物／活动'],
  SurvivalMissionRewards: ['生存任务', '任务'], DefenseMissionRewards: ['防御任务', '任务'], DisruptionMissionRewards: ['中断任务', '任务'], InterceptionMissionRewards: ['拦截任务', '任务'], SpyMissionRewards: ['间谍任务', '任务'], RescueMissionRewards: ['救援任务', '任务'], ExtractionMissionRewards: ['挖掘任务', '任务'], EvacMissionRewards: ['叛逃任务', '任务'], BossMissionRewards: ['首领任务', '任务'], RailjackMissionRewards: ['九重天任务', '任务'], HeistJobMissionRewards: ['奥布山谷劫掠', '赏金'], EliteAlertMissionRewards: ['仲裁任务', '任务'], DuviriEncounterRewards: ['双衍王境遭遇', '任务'], DuviriEndlessCircuitRewards: ['双衍王境回廊', '任务'], EntratiMissionRewards: ['英择谛实验室任务', '任务'], ZarimanMissionRewards: ['扎里曼任务', '任务'], EventMissionRewards: ['活动任务', '活动'], JadeShadowsConstellationsRewards: ['翡翠之影活动', '活动'], AscensionMissionRewards: ['Ascension 任务', '任务'], KuvaMissionRewards: ['赤毒任务', '任务'], PVPMissionRewards: ['竞技任务', '任务'], TheNewWar: ['新纪之战任务', '剧情'], DagathMissionRewards: ['Dagath 相关任务', '任务']
};
const cache = new WeakMap();
export function rewardContexts(data) {
  if (cache.has(data.output)) return cache.get(data.output);
  const tables = data.output['reward-tables.json'], ids = new Set(tables.map(t => t.id)), origins = new Map(tables.map(t => [t.id, []]));
  const entityNames = new Map((data.output['search.zh-CN.json'] ?? []).map(r => [r.id, r.title]));
  const inventory = data.output['reports/coverage.json']?.files ?? [], inputs = new Map(data.manifest.inputs.map(i => [i.file, i]));
  const docs = inventory.map(f => ({ ...f, value: data.output[f.reference] }));
  const dictionaries = docs.filter(f => /(?:dict\.zh\.json|dicts\/zh\.json)$/.test(f.file)).map(f => f.value);
  const localize = text => { if (typeof text !== 'string') return ''; for (const dict of dictionaries) if (typeof dict?.[text] === 'string') return dict[text]; return text.startsWith('/Lotus/Language/') ? '' : text; };
  const evidence = (doc, at) => ({ source: doc.source, file: doc.file, hash: inputs.get(doc.file)?.hash, pointer: at });
  for (const doc of docs.filter(f => f.source === 'plus' && /Export(Relics|Regions|Keys|Bounties)\.json$/.test(f.file))) {
    for (const [key, record] of Object.entries(doc.value ?? {})) {
      if (!record || typeof record !== 'object') continue;
      const name = localize(record.name) || entityNames.get(key); if (!name) continue;
      const kind = /Relics/.test(doc.file) ? '遗物' : /Regions/.test(doc.file) ? '星图任务' : /Bounties/.test(doc.file) ? '赏金任务' : '剧情／钥匙任务';
      const title = [localize(record.systemName), name, localize(record.missionName)].filter(Boolean).join(' · ');
      const scan = (value, at) => {
        if (typeof value === 'string' && ids.has(value)) origins.get(value).push({ title, category: kind, description: localize(record.description) || `此奖励表由“${title}”记录直接引用。`, source: evidence(doc, at), nameSource: evidence(doc, '/' + pointer(key) + '/name') });
        else if (value && typeof value === 'object') for (const [k,v] of Object.entries(value)) scan(v, at + '/' + pointer(k));
      }; scan(record, '/' + pointer(key));
    }
  }
  for (const table of tables) for (const stored of table.manifests ?? (table.manifest ? [table.manifest] : [])) {
    const ref = Number.isInteger(stored.input) ? { ...data.manifest.inputs[stored.input], pointer: stored.pointer } : stored;
    const doc = docs.find(f => f.file === ref.file), region = regions[ref.file?.split('/').at(-1)?.replace('JobManifest.json','')];
    if (!doc || !region) continue;
    const match = /\/(JobDifficultyTiers|ChallengeMissionDifficultyTiers)\/(\d+)(?:\/|$)/.exec(ref.pointer);
    const tier = match ? pointerValue(doc.value, ref.pointer.slice(0, match.index) + '/' + match[1] + '/' + match[2]) : null;
    const qualifiers = tier ? [Array.isArray(tier.enemyLevel) ? '敌人等级 ' + tier.enemyLevel.join('—') : '', Number.isFinite(tier.stageCount) ? tier.stageCount + ' 阶段' : '', tier.endless ? '无尽任务' : '', tier.useExtraJobs ? '额外任务' : ''].filter(Boolean) : [];
    origins.get(table.id).unshift({ title: region + (match ? ' · 赏金第 ' + (Number(match[2]) + 1) + ' 档' : ' · 赏金清单奖励'), category: '赏金', description: `此表由${region}任务清单直接引用${qualifiers.length ? '；' + qualifiers.join(' · ') : ''}。同档可有多张候选表，当前轮次与奖励池对应阶段尚未确认。`, source: ref });
  }
  const result = new Map(tables.map(table => {
    const direct = origins.get(table.id), family = table.id.split('/').at(-2), fallback = families[family];
    const primary = direct[0];
    return [table.id, { title: primary?.title ?? (fallback ? fallback[0] : '任务／活动奖励（来源待补充）'), category: primary?.category ?? fallback?.[1] ?? '待分类', description: primary?.description ?? (fallback ? `按上游路径目录“${family}”标注为${fallback[0]}；具体任务、活动状态与发放条件需继续核对。` : '原表未提供可直接关联的中文任务说明，保留完整路径供复核。'), basis: primary ? 'exact-reference' : fallback ? 'path-family' : 'unknown', origins: direct }];
  }));
  cache.set(data.output, result); return result;
}
