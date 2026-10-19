import { sha256 } from './io.mjs';

const WEEK = 604800000, DAY = 86400000;
export const WORLD_STATE_URL = 'https://api.warframe.com/cdn/worldState.php';
const iso = time => new Date(time).toISOString();
function timeValue(at) { if (!Number.isFinite(at) || at < 0 || at > 8640000000000000 - 52 * WEEK) throw new Error('查询时间无效'); return at; }
function countValue(count, max) { if (!Number.isInteger(count) || count < 1 || count > max) throw new Error(`查询数量应为 1–${max}`); }

// Read JSON literals only. Upstream TypeScript is data here and is never executed.
function arrayLiteral(text, marker) {
  const offset = text.indexOf(marker); if (offset < 0) throw new Error(`browse.wf 规则缺少 ${marker}`);
  const start = text.indexOf('[', offset + marker.length); let depth = 0, quoted = false, escaped = false;
  for (let i = start; start >= 0 && i < text.length; i++) {
    const c = text[i];
    if (quoted) { if (escaped) escaped = false; else if (c === '\\') escaped = true; else if (c === '"') quoted = false; }
    else if (c === '"') quoted = true;
    else if (c === '[') depth++;
    else if (c === ']' && --depth === 0) return JSON.parse(text.slice(start, i + 1));
  }
  throw new Error('browse.wf 规则数组不完整');
}
function body(text, name) {
  const match = new RegExp(`function ${name}\\([^\\n]*\\r?\\n\\{([\\s\\S]*?)^\\}`, 'm').exec(text);
  if (!match) throw new Error(`browse.wf 缺少规则函数 ${name}`);
  return match[1];
}
function requireFormula(text, expressions) {
  const compact = text.replace(/\s/g, '');
  for (const expression of expressions) if (!compact.includes(expression)) throw new Error('browse.wf 规则已变化，需要更新兼容实现');
}
export function browseRules(text) {
  if (typeof text !== 'string' || text.length > 2 * 1024 * 1024) throw new Error('browse.wf 规则文件无效');
  const teshinBody = body(text, 'updateTeshin'), circuitBody = body(text, 'updateCircuitLocalised');
  const weekEpoch = source => {
    requireFormula(source, ['Math.trunc((Date.now()-EPOCH)/604800000)']);
    const value = /const EPOCH = (\d+) \* 1000;/.exec(source)?.[1];
    if (!value || Number(value) * 1000 % WEEK !== 345600000) throw new Error('周轮换基准应为 UTC 周一');
    return Number(value) * 1000;
  };
  const frames = arrayLiteral(text, 'const frameChoices ='), weapons = arrayLiteral(text, 'const weaponChoices =');
  for (const [groups, width] of [[frames, 3], [weapons, 5]]) {
    if (!Array.isArray(groups) || !groups.length || groups.length > 128 || groups.some(group => !Array.isArray(group) || group.length !== width || new Set(group).size !== width || group.some(key => typeof key !== 'string' || !/^\/Lotus\/Language\/[A-Za-z0-9_/]+$/.test(key)))) throw new Error('回廊轮换表无效');
  }
  requireFormula(circuitBody, ['frameChoices[week%frameChoices.length]', 'weaponChoices[week%weaponChoices.length]']);
  const offers = arrayLiteral(teshinBody, '.textContent =');
  if (!Array.isArray(offers) || !offers.length || offers.length > 128 || offers.some(x => typeof x !== 'string' || !x || x.length > 200)) throw new Error('Teshin 商品轮换表无效');
  requireFormula(teshinBody, [`][week%${offers.length}]`]);
  const vallis = body(text, 'updateVallis');
  requireFormula(vallis, ['newDate("November10,201808:13:48UTC").getTime()', 'Math.trunc((time-EPOCH)/1600000)', 'cycleStart=EPOCH+cycle*1600000', 'cycleEnd=cycleStart+1600000', 'cycleColdStart=cycleStart+400000', 'time>cycleColdStart']);
  requireFormula(body(text, 'updateDuviriMood'), ['Math.trunc(Date.now()/7200000)', 'moodStart=moodIndex*7200000', 'moodEnd=moodStart+7200000']);
  requireFormula(body(text, 'updateDayNightCycle'), ['cycleNightStart=window.bountyCycleExpiry-3_000_000', 'time>=cycleNightStart']);
  const moodBody = body(text, 'updateDuviriMoodLocalised');
  requireFormula(moodBody, ['][window.duviri_mood_index%5]']);
  const moods = arrayLiteral(moodBody, 'osdict[');
  if (JSON.stringify(moods) !== JSON.stringify(['Sad', 'Scared', 'Happy', 'Angry', 'Jealous'].map(x => `/Lotus/Language/Duviri/${x}MoodTitleShort`))) throw new Error('双衍王境情绪轮换已变化');
  return { algorithm: 'browse-compat-1', sourceHash: sha256(text), teshinEpoch: weekEpoch(teshinBody), circuitEpoch: weekEpoch(circuitBody), offers, frames, weapons, moods };
}
const item = (key, dictionary) => ({ key, label: dictionary[key] ?? key });
const offerLabels = { 'Umbra Forma Blueprint': 'Umbra Forma 蓝图', '50,000x Kuva': '50,000 赤毒', 'Kitgun Riven Mod': '组合枪裂罅 Mod', '3x Forma': '3 个 Forma', 'Zaw Riven Mod': 'Zaw 裂罅 Mod', '30,000x Endo': '30,000 内融核心', 'Rifle Riven Mod': '步枪裂罅 Mod', 'Shotgun Riven Mod': '霰弹枪裂罅 Mod' };
export function weeklyRotations(rules, { at = Date.now(), count = 4 } = {}, dictionary = {}, dataVersion = null) {
  timeValue(at); countValue(count, 52);
  if (at < Math.max(rules.teshinEpoch, rules.circuitEpoch)) throw new Error('查询时间早于当前周轮换规则基准');
  const t = Math.floor((at - rules.teshinEpoch) / WEEK), c = Math.floor((at - rules.circuitEpoch) / WEEK);
  return { algorithm: rules.algorithm, dataVersion, sourceHash: rules.sourceHash, warnings: ['按所选 browse.wf 规则表轮换；游戏调整后需更新来源并核对'], entries: Array.from({ length: count }, (_, offset) => ({
    startsAt: iso(rules.teshinEpoch + (t + offset) * WEEK), endsAt: iso(rules.teshinEpoch + (t + offset + 1) * WEEK),
    teshin: { index: (t + offset) % rules.offers.length, key: rules.offers[(t + offset) % rules.offers.length], label: offerLabels[rules.offers[(t + offset) % rules.offers.length]] ?? rules.offers[(t + offset) % rules.offers.length] },
    circuit: { normalIndex: (c + offset) % rules.frames.length, steelIndex: (c + offset) % rules.weapons.length, frames: rules.frames[(c + offset) % rules.frames.length].map(key => item(key, dictionary)), weapons: rules.weapons[(c + offset) % rules.weapons.length].map(key => item(key, dictionary)) }
  })) };
}
export function anchorFromWorldState(text, { fetchedAt = Date.now(), source = WORLD_STATE_URL } = {}) {
  timeValue(fetchedAt);
  const ws = JSON.parse(text);
  const stamp = value => Number(value?.$date?.$numberLong);
  const matches = ws.SyndicateMissions?.filter(x => x.Tag === 'HexSyndicate' && stamp(x.Activation) <= fetchedAt && fetchedAt < stamp(x.Expiry));
  if (!matches || matches.length !== 1) throw new Error('世界状态没有唯一且有效的 HexSyndicate 时间基准');
  const startsAt = stamp(matches[0].Activation), endsAt = stamp(matches[0].Expiry);
  // The service timestamps have millisecond jitter; accept one 150-minute window only.
  if (![startsAt, endsAt].every(Number.isSafeInteger) || Math.abs(endsAt - startsAt - 9000000) > 10000) throw new Error('世界状态周期长度已变化，需要核对规则');
  return { schemaVersion: 1, source, tag: 'HexSyndicate', fetchedAt: iso(fetchedAt), startsAt: iso(startsAt), endsAt: iso(endsAt), payloadHash: sha256(text) };
}
export function validAnchor(anchor) {
  return anchor?.schemaVersion === 1 && anchor.tag === 'HexSyndicate' && typeof anchor.source === 'string' && /^[a-f0-9]{64}$/.test(anchor.payloadHash) && Number.isFinite(Date.parse(anchor.fetchedAt)) && Math.abs(Date.parse(anchor.endsAt) - Date.parse(anchor.startsAt) - 9000000) <= 10000 && Date.parse(anchor.startsAt) <= Date.parse(anchor.fetchedAt) && Date.parse(anchor.fetchedAt) < Date.parse(anchor.endsAt);
}
export function worldCycles(rules, { at = Date.now(), anchor = null } = {}, dictionary = {}, dataVersion = null) {
  timeValue(at); const vallisEpoch = Date.parse('2018-11-10T08:13:48Z');
  if (at < vallisEpoch) throw new Error('查询时间早于奥布山谷规则基准');
  const moodIndex = Math.floor(at / 7200000), vallisStart = vallisEpoch + Math.floor((at - vallisEpoch) / 1600000) * 1600000;
  const cold = at >= vallisStart + 400000;
  const entries = [
    { id: 'duviri', label: '双衍王境', state: dictionary[rules.moods[moodIndex % 5]] ?? ['忧伤', '恐惧', '喜悦', '愤怒', '嫉妒'][moodIndex % 5], key: rules.moods[moodIndex % 5], startsAt: iso(moodIndex * 7200000), endsAt: iso((moodIndex + 1) * 7200000), basis: 'fixed-rule' },
    { id: 'vallis', label: '奥布山谷', state: cold ? '寒冷' : '温暖', startsAt: iso(vallisStart + (cold ? 400000 : 0)), endsAt: iso(vallisStart + (cold ? 1600000 : 400000)), basis: 'fixed-rule' }
  ];
  const usable = validAnchor(anchor), covered = usable && Date.parse(anchor.startsAt) <= at && at < Date.parse(anchor.endsAt);
  const reason = !usable ? '缺少有效世界状态基准，请刷新基准' : '查询时间超出基准有效区间，请刷新或调整时间';
  for (const [id, label] of [['plains', '夜灵平原'], ['deimos', '火卫二']]) {
    const nightStart = usable ? Date.parse(anchor.endsAt) - 3000000 : null, night = covered && at >= nightStart;
    entries.push(covered ? { id, label, state: id === 'plains' ? (night ? '夜晚' : '白昼') : (night ? 'Vome' : 'Fass'), startsAt: night ? iso(nightStart) : anchor.startsAt, endsAt: night ? anchor.endsAt : iso(nightStart), basis: 'world-state' } : { id, label, state: '待校准', reason, startsAt: null, endsAt: null, basis: 'unavailable' });
  }
  return { algorithm: rules.algorithm, dataVersion, sourceHash: rules.sourceHash, at: iso(at), anchor: usable ? anchor : null, anchorStatus: covered ? 'covered' : usable ? 'outside-window' : 'missing', warnings: ['按 browse.wf 周期模型计算；平原和火卫二只在世界状态基准区间内显示'], entries };
}
export function parseIncursions(text) {
  const rows = text.trim().split(/\r?\n/).map((line, i) => {
    const match = /^(\d+);([A-Za-z0-9_]+(?:,[A-Za-z0-9_]+){5})$/.exec(line);
    if (!match) throw new Error(`每日突袭排期第 ${i + 1} 行无效（应有 6 个节点）`);
    return { seconds: Number(match[1]), nodes: match[2].split(',') };
  });
  if (rows.some((row, i) => !Number.isSafeInteger(row.seconds) || row.seconds < 0 || row.seconds * 1000 > 8640000000000000 - DAY || row.seconds % 86400 || new Set(row.nodes).size !== 6 || (i && row.seconds !== rows[i - 1].seconds + 86400))) throw new Error('每日突袭排期重复、不连续或未对齐 UTC 零点');
  return rows;
}
export function incursions(text, { at = Date.now(), count = 7 } = {}, regions = {}, dictionary = {}, dataVersion = null) {
  timeValue(at); countValue(count, 30);
  const rows = parseIncursions(text), day = Math.floor(at / DAY) * 86400, index = (day - rows[0].seconds) / 86400;
  if (index < 0 || index >= rows.length) throw new Error('查询时间超出当前每日突袭排期覆盖范围');
  const entries = rows.slice(index, index + count).map(row => ({ startsAt: iso(row.seconds * 1000), endsAt: iso(row.seconds * 1000 + DAY), nodes: row.nodes.map(node => {
    const region = regions[node];
    return { node, name: region ? dictionary[region.name] ?? region.name : node, system: region ? dictionary[region.systemName] ?? region.systemName : null, missionName: region ? dictionary[region.missionName] ?? region.missionName : null, minLevel: Number.isFinite(region?.minEnemyLevel) ? region.minEnemyLevel + 100 : null, maxLevel: Number.isFinite(region?.maxEnemyLevel) ? region.maxEnemyLevel + 100 : null };
  }) }));
  return { algorithm: 'browse-incursion-schedule-1', mode: 'schedule-lookup', dataVersion, scheduleHash: sha256(text), coverage: { startsAt: iso(rows[0].seconds * 1000), endsAt: iso(rows.at(-1).seconds * 1000 + DAY) }, truncated: entries.length < count, warnings: ['按缓存的 6 节点每日排期查询，等级采用 browse.wf 的基础等级 +100 规则；需在游戏中核对'], entries };
}
