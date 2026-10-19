import { OracleRandom } from './oracle.mjs';

export const ORACLE_RULE_VERSION = 'oracle-bounties-1';
export const ALLIES = ['Amir', 'Aoi', 'Arthur', 'Eleanor', 'Lettie', 'Quincy'].map(name => `/Lotus/Types/Gameplay/1999Wf/ProtoframeAllies/${name}AllyAgent`);
const excludedAllies = Object.fromEntries(['SolNode851', 'SolNode853', 'SolNode856', 'SolNode850', 'SolNode852', 'SolNode854'].map((node, i) => [node, ALLIES[i]]));
export const CHALLENGE_MANIFESTS = { ZarimanSyndicate: 'ZarimanJobManifest.json', EntratiLabSyndicate: 'EntratiLabsJobManifest.json', HexSyndicate: 'WF1999JobManifest.json' };
export const LOCATION_MANIFESTS = { CetusSyndicate: ['EidolonJobManifest.json', '/Lotus/Types/Gameplay/Eidolon/Jobs/'], SolarisSyndicate: ['VenusJobManifest.json', '/Lotus/Types/Gameplay/Venus/Jobs/'], EntratiSyndicate: ['MicroplanetJobManifest.json', '/Lotus/Types/Gameplay/InfestedMicroplanet/Jobs/'] };
export function oracleSeed(value) {
  if (typeof value === 'number' && !Number.isSafeInteger(value)) throw new Error('seed 数字必须为安全整数；较大种子请传十进制字符串');
  if (!['number', 'string', 'bigint'].includes(typeof value) || !/^-?\d{1,20}$/.test(String(value).trim())) throw new Error('seed 应为十进制整数');
  const seed = BigInt(String(value).trim());
  if (seed < -(1n << 63n) || seed > (1n << 64n) - 1n) throw new Error('seed 超出 64 位整数范围');
  return seed;
}
export function oracleTime(at) { if (!Number.isFinite(at) || at < 0 || at > 8640000000000000 - 86400000) throw new Error('推算时间无效'); return at; }
export function shuffle(values, rng) {
  const result = [...values];
  for (let size = result.length; size >= 2; size--) { const index = rng.int(1, size) - 1; [result[index], result[size - 1]] = [result[size - 1], result[index]]; }
  return result;
}
export function normaliseChallenge(path) {
  let name = path.split('/').at(-1);
  // Oracle tests suffixes in this order, rather than choosing the leftmost match.
  for (const suffix of ['Easy', 'VeryHard', 'Hard', 'Challenge']) { const index = name.indexOf(suffix); if (index >= 0) { name = name.slice(0, index); break; } }
  return name;
}
const nonemptyStrings = value => Array.isArray(value) && value.length > 0 && value.length <= 1000 && value.every(x => typeof x === 'string' && x.length > 0 && x.length < 500);
function challengeManifest(manifest) {
  const nodes = manifest?.ChallengeMissionNodes, tiers = manifest?.ChallengeMissionDifficultyTiers;
  if (!nonemptyStrings(nodes) || new Set(nodes).size !== nodes.length || !Array.isArray(tiers) || !tiers.length || tiers.length > 32 || tiers.some(tier => !Array.isArray(tier.challenges) || !tier.challenges.length || tier.challenges.some(entry => typeof entry.Node !== 'string' || ![0, 1].includes(entry.CheckFaction) || (entry.CheckFaction === 1 && typeof entry.Faction !== 'string') || !nonemptyStrings(entry.challenges)))) throw new Error('挑战赏金 JobManifest 结构不受支持');
}
export function challengeBounties(manifest, seed, { faction, allies } = {}) {
  challengeManifest(manifest);
  const rng = new OracleRandom(oracleSeed(seed)); let nodes = shuffle(manifest.ChallengeMissionNodes, rng);
  const lichNodes = allies ? ['SolNode852', 'SolNode850', 'SolNode854'] : [...nodes];
  if (allies) {
    if (!Array.isArray(allies) || allies.length > ALLIES.length || new Set(allies).size !== allies.length || allies.some(x => !ALLIES.includes(x))) throw new Error('1999 同伴列表无效');
    allies = [...allies];
    if (allies.length > 0 && allies.length < nodes.length) {
      const removable = shuffle(['SolNode851', 'SolNode852', 'SolNode853', 'SolNode854'], rng);
      while (allies.length < nodes.length && removable.length) { const index = nodes.indexOf(removable.shift()); if (index >= 0) nodes.splice(index, 1); }
    }
    allies = shuffle(allies, rng);
    for (let i = 0; i < Math.min(allies.length, nodes.length); i++) if (allies[i] === excludedAllies[nodes[i]]) { const next = (i + 1) % allies.length; [allies[i], allies[next]] = [allies[next], allies[i]]; }
  }
  const seen = new Set();
  return manifest.ChallengeMissionDifficultyTiers.map((tier, i) => {
    const node = i < nodes.length ? nodes[i] : lichNodes[rng.int(1, lichNodes.length) - 1];
    const interesting = [], repeated = [];
    for (const entry of tier.challenges) if ((!entry.Node || entry.Node === node) && (!entry.CheckFaction || faction === entry.Faction)) for (const challenge of entry.challenges) (seen.has(normaliseChallenge(challenge)) ? repeated : interesting).push(challenge);
    const candidates = interesting.length ? interesting : repeated;
    if (!candidates.length) throw new Error(`第 ${i + 1} 档赏金没有匹配的挑战（${node}）`);
    const challenge = candidates[rng.int(1, candidates.length) - 1]; seen.add(normaliseChallenge(challenge));
    return { node, challenge, ...(allies && i < nodes.length && allies[i] ? { ally: allies[i] } : {}) };
  });
}
export function activeSyndicate(state, tag, at) {
  oracleTime(at);
  const matches = state?.data?.SyndicateMissions?.filter(x => x.Tag === tag && Date.parse(x.startsAt) <= at && at < Date.parse(x.endsAt));
  if (!matches?.length) throw new Error(`${tag} 缺少覆盖参考时间的世界状态；请刷新、导入或手填 seed`);
  if (matches.length !== 1) throw new Error(`${tag} 有多个重叠的有效窗口，请核对世界状态`);
  return matches[0];
}
export const stateProvenance = state => state ? { source: state.source, observedAt: state.observedAt, loadedAt: state.loadedAt, payloadHash: state.payloadHash, dataHash: state.dataHash } : null;
function rotation(rewards, index, warnings, label) {
  const value = rewards?.[index];
  if (!['A', 'B', 'C'].includes(value)) { warnings.push(`${label}未包含可识别的轮次，不作猜测`); return null; }
  return value;
}
export function bountyCycle(manifests, { seed, at = Date.now(), state = null } = {}, dataVersion = null) {
  oracleTime(at); const manual = seed !== undefined && seed !== null && seed !== '';
  const selected = manual ? null : activeSyndicate(state, 'HexSyndicate', at);
  const usedSeed = oracleSeed(manual ? seed : selected.seed), faction = (usedSeed & 1n) === 0n ? 'FC_GRINEER' : 'FC_CORPUS';
  const warnings = ['按 Oracle 模型与所选 JobManifest 复算；仍需游戏内核对'];
  const bounties = {};
  for (const [tag, file] of Object.entries(CHALLENGE_MANIFESTS)) {
    if (!manifests[file]) throw new Error(`缺少 ${file}`);
    bounties[tag] = challengeBounties(manifests[file], usedSeed, { faction, ...(tag === 'HexSyndicate' ? { allies: ALLIES } : {}) });
  }
  let rot = null, vaultRot = null;
  if (!manual) {
    try { rot = rotation(activeSyndicate(state, 'CetusSyndicate', at).jobs?.[0]?.rewards, 66, warnings, '平原奖励'); } catch (e) { warnings.push(e.message); }
    try { vaultRot = rotation(activeSyndicate(state, 'EntratiSyndicate', at).jobs?.at(-1)?.rewards, 73, warnings, '隔离库奖励'); } catch (e) { warnings.push(e.message); }
  } else warnings.push('手填 seed 只用于离线复算，不表示该轮正在生效；奖励轮次与有效窗口需世界状态提供');
  return { algorithm: ORACLE_RULE_VERSION, dataVersion, input: manual ? 'manual-seed' : 'world-state', seed: usedSeed.toString(), startsAt: selected?.startsAt ?? null, endsAt: selected?.endsAt ?? null, worldState: manual ? null : stateProvenance(state), rot, vaultRot, zarimanFaction: faction, bounties, warnings };
}
export function locationBounties(manifests, { seed, at = Date.now(), state = null } = {}, dataVersion = null) {
  oracleTime(at); const manual = seed !== undefined && seed !== null && seed !== '';
  const selected = manual ? null : activeSyndicate(state, 'CetusSyndicate', at), usedSeed = oracleSeed(manual ? seed : selected.seed), locations = {};
  for (const [tag, [file, prefix]] of Object.entries(LOCATION_MANIFESTS)) {
    const rows = manifests[file]?.LocationSpecificJobs;
    if (!Array.isArray(rows) || !rows.length || rows.length > 100 || new Set(rows.map(x => x.LocationTag)).size !== rows.length || rows.some(x => typeof x.LocationTag !== 'string' || !x.LocationTag || !nonemptyStrings(x.Jobs) || !Number.isInteger(x.NumJobsToShow) || x.NumJobsToShow < 0 || x.NumJobsToShow > x.Jobs.length)) throw new Error(`地区赏金 ${file} 结构无效`);
    const rng = new OracleRandom(usedSeed);
    locations[tag] = rows.map(row => { const selected = shuffle(row.Jobs.map((_, i) => i < row.NumJobsToShow), rng); return { location: row.LocationTag, jobs: row.Jobs.filter((_, i) => selected[i]).map(job => prefix + job) }; });
  }
  return { algorithm: 'oracle-location-bounties-1', dataVersion, seed: usedSeed.toString(), input: manual ? 'manual-seed' : 'world-state', startsAt: selected?.startsAt ?? null, endsAt: selected?.endsAt ?? null, worldState: manual ? null : stateProvenance(state), locations, warnings: ['逐地区连续消耗随机数；各星球重新使用相同 seed', manual ? '手填 seed 为离线复算，未指定当前有效窗口' : '结果只适用于所选世界状态窗口，需游戏内核对'] };
}
