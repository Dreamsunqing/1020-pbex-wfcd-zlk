import { sha256 } from './io.mjs';

const EPOCH = 1391990400, WEEK = 604800;
export const ALGORITHM_VERSION = 'oracle-compat-1';
export function crc32(text) {
  let crc = 0xffffffff;
  for (const byte of Buffer.from(text, 'utf8')) { crc ^= byte; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
  return (crc ^ 0xffffffff) >>> 0;
}
export class OracleRandom {
  constructor(seed) { this.seed = BigInt(seed); }
  churn() { this.seed = BigInt.asUintN(64, 0x5851f42d4c957f2dn * this.seed + 0x14057b7ef767814fn); return Number((this.seed >> 32n) & 0xffffffffn); }
  int(min, max) { return max === min ? min : min + (this.churn() & 0x3fffffff) % (max - min + 1); }
  float(min, max) {
    if (min > max) [min, max] = [max, min];
    const add = (a, b) => Math.fround(Math.fround(a) + Math.fround(b));
    const mul = (a, b) => Math.fround(Math.fround(a) * Math.fround(b));
    return add(mul(mul((this.churn() >>> 6) & 0xffffff, 0.000000059604645), add(max, -min)), min);
  }
}
const off = '/Lotus/Upgrades/Invigorations/Offensive/OffensiveInvigoration';
const def = '/Lotus/Upgrades/Invigorations/Utility/UtilityInvigoration';
function stat(prefix, name, label, value, unit, operation = 'add') { return { key: prefix + name, label, value, unit, operation }; }
export const OFFENSIVE = [
  stat(off, 'PowerStrength', '技能强度', 200, '%'), stat(off, 'PowerRange', '技能范围', 100, '%'), stat(off, 'PowerDuration', '技能持续时间', 100, '%'),
  stat(off, 'MeleeDamage', '近战伤害', 250, '%'), stat(off, 'PrimaryDamage', '主武器伤害', 250, '%'), stat(off, 'SecondaryDamage', '副武器伤害', 250, '%'),
  stat(off, 'PrimaryCritChance', '主武器暴击率', 200, '%'), stat(off, 'SecondaryCritChance', '副武器暴击率', 200, '%'), stat(off, 'MeleeCritChance', '近战暴击率', 200, '%')
];
export const DEFENSIVE = [
  stat(def, 'PowerEfficiency', '技能效率', 75, '%'), stat(def, 'MovementSpeed', '冲刺速度', 75, '%'), stat(def, 'ParkourSpeed', '跑酷速度', 75, '%'),
  stat(def, 'Health', '生命值', 1000, ''), stat(def, 'Energy', '能量上限', 200, '%'), stat(def, 'StatusResistance', '异常状态免疫', 1, '', 'enable'),
  stat(def, 'ReloadSpeed', '装填速度', 75, '%'), stat(def, 'HealthRegen', '生命回复', 25, '/秒'), stat(def, 'Armor', '护甲', 1000, ''),
  stat(def, 'Jumps', '跳跃重置次数', 5, '', 'set'), stat(def, 'EnergyRegen', '能量回复', 2, '/秒')
];
export function warframePool(warframes, dictionary = {}) {
  const suits = []; const seen = new Set(); const details = new Map();
  for (const [key, item] of Object.entries(warframes)) {
    if (item.productCategory !== 'Suits' || !item.parentName || item.parentName === '/Lotus/Powersuits/Excalibur/DarkExcalibur' || seen.has(item.parentName)) continue;
    seen.add(item.parentName); suits.unshift(item.parentName);
    details.set(item.parentName, { key: item.parentName, label: dictionary[item.name] ?? item.name ?? key });
  }
  const excalibur = '/Lotus/Powersuits/Excalibur/ExcaliburBaseSuit';
  const pool = [excalibur, ...suits.filter(x => x !== excalibur)];
  if (pool.length < 4 || !details.has(excalibur)) throw new Error('活化战甲池不完整');
  return pool.map(key => details.get(key));
}
function sample(pool, rng, count = 3) {
  pool = pool.map(x => ({ item: x.item, weight: x.weight }));
  const result = []; let total = pool.reduce((n, x) => n + x.weight, 0);
  for (let i = 0; i < count; i++) {
    let remaining = rng.float(0, 1) * total; let found = false;
    for (let j = 0; j < pool.length; j++) {
      if (remaining < pool[j].weight) { result.push(pool[j].item); total -= pool[j].weight; pool.splice(j, 1); found = true; break; }
      remaining -= pool[j].weight;
    }
    if (!found) throw new Error('抽样越界，输入池或随机数不符合预期');
  }
  return result;
}
export function invigorations({ username, observedSuitTypes = [], target = 'current', at = Date.now() }, warframes, dictionary = {}, dataVersion = null) {
  if (typeof username !== 'string') throw new Error('请填写区分大小写的游戏名');
  username = username.split('#')[0];
  if (Buffer.byteLength(username) < 4 || Buffer.byteLength(username) > 128) throw new Error('游戏名长度应为 4–128 字节');
  if (!['current', 'next'].includes(target) || !Number.isFinite(at)) throw new Error('推算时间或目标无效');
  const pool = warframePool(warframes, dictionary);
  if (!Array.isArray(observedSuitTypes) || observedSuitTypes.length > 3 || new Set(observedSuitTypes).size !== observedSuitTypes.length || observedSuitTypes.some(x => !pool.some(s => s.key === x))) throw new Error('历史战甲应为池中 0–3 个不重复战甲');
  const weekIndex = Math.floor((Math.floor(at / 1000) - EPOCH) / WEEK) + (target === 'next' ? 1 : 0);
  const weekly = new OracleRandom(weekIndex).int(1, 1000000);
  const seed = Math.trunc(Math.fround(Math.fround(crc32(username)) + Math.fround(weekly)));
  const rng = new OracleRandom(seed);
  const suits = sample(pool.map(item => ({ item, weight: observedSuitTypes.includes(item.key) ? 0 : 1 })), rng);
  const offensive = sample(OFFENSIVE.map(item => ({ item, weight: 1 })), rng);
  const noEnergy = suits.some(x => ['/Lotus/Powersuits/IronFrame/IronFrameBaseSuit', '/Lotus/Powersuits/Alchemist/AlchemistBaseSuit'].includes(x.key));
  const defensive = sample(DEFENSIVE.filter(x => !noEnergy || ![def + 'Energy', def + 'EnergyRegen'].includes(x.key)).map(item => ({ item, weight: 1 })), rng);
  return { algorithm: ALGORITHM_VERSION, dataVersion, poolHash: sha256(JSON.stringify(pool.map(x => x.key))), weekIndex, startsAt: new Date((EPOCH + weekIndex * WEEK) * 1000).toISOString(), endsAt: new Date((EPOCH + (weekIndex + 1) * WEEK) * 1000).toISOString(), confidence: observedSuitTypes.length === 3 ? 'exact-assuming-inputs' : 'conditional', warnings: [observedSuitTypes.length < 3 ? '历史输入不完整，结果为条件推算；请在游戏中核对' : '假定历史输入和当前规则正确，尚需游戏实测核对'], offers: suits.map((suit, i) => ({ suit, offensive: offensive[i], defensive: defensive[i] })) };
}
export function parseArbitrations(text) {
  const rows = text.trim().split(/\r?\n/).map((line, i) => { const match = /^(\d+),([A-Za-z0-9_]+)$/.exec(line); if (!match) throw new Error(`仲裁排期第 ${i + 1} 行无效`); return { seconds: Number(match[1]), node: match[2] }; });
  if (!rows.length || rows.some((row, i) => row.seconds % 3600 || (i && row.seconds !== rows[i - 1].seconds + 3600))) throw new Error('仲裁排期不连续或未对齐整点');
  return rows;
}
export function arbitrations(text, { at = Date.now(), count = 24 } = {}, regions = {}, dictionary = {}, dataVersion = null) {
  if (!Number.isFinite(at) || !Number.isInteger(count) || count < 1 || count > 168) throw new Error('仲裁查询参数无效');
  const rows = parseArbitrations(text); const hour = Math.floor(at / 3600000) * 3600;
  const index = (hour - rows[0].seconds) / 3600;
  if (index < 0 || index >= rows.length) throw new Error('查询时间超出当前仲裁排期覆盖范围');
  const entries = rows.slice(index, index + count).map(row => {
    const region = regions[row.node];
    return { node: row.node, name: region ? dictionary[region.name] ?? region.name : null, system: region ? dictionary[region.systemName] ?? region.systemName : null, missionType: region?.missionType ?? null, missionName: region ? dictionary[region.missionName] ?? region.missionName : null, startsAt: new Date(row.seconds * 1000).toISOString(), endsAt: new Date((row.seconds + 3600) * 1000).toISOString() };
  });
  return { algorithm: 'arbitration-schedule-1', mode: 'schedule-lookup', dataVersion, scheduleHash: sha256(text), coverage: { startsAt: new Date(rows[0].seconds * 1000).toISOString(), endsAt: new Date((rows.at(-1).seconds + 3600) * 1000).toISOString() }, truncated: entries.length < count, warnings: ['基于已缓存排期查询；游戏更新后应核对排期有效性'], entries };
}
