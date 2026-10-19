import { promises as fs } from 'node:fs';
import path from 'node:path';
import { atomicJson, readJson, sha256 } from './io.mjs';
import { requestBytes } from './updater.mjs';
import { WORLD_STATE_URL } from './browse.mjs';
import { oracleSeed, oracleTime, stateProvenance, activeSyndicate } from './oracle-bounties.mjs';

const MAX_BYTES = 16 * 1024 * 1024;
function text(value, label, max = 500) { if (typeof value !== 'string' || !value || value.length > max) throw new Error(`世界状态 ${label} 无效`); return value; }
function stamp(value) { const time = Number(value?.$date?.$numberLong); if (!Number.isSafeInteger(time)) throw new Error('世界状态时间戳无效'); oracleTime(time); return new Date(time).toISOString(); }
const factions = value => text(value, '阵营', 80);
function conquest(value) {
  const startsAt = stamp(value.Activation), endsAt = stamp(value.Expiry);
  if (Date.parse(endsAt) <= Date.parse(startsAt)) throw new Error('周常世界状态有效窗口无效');
  const strings = (values, label) => {
    if (!Array.isArray(values) || values.length > 100) throw new Error(`周常 ${label} 格式无效`);
    return values.map(key => text(key, label, 150));
  };
  if (!Array.isArray(value.Missions) || !value.Missions.length || value.Missions.length > 100) throw new Error('周常 Missions 格式无效');
  const Missions = value.Missions.map(mission => {
    if (!Array.isArray(mission.difficulties) || mission.difficulties.length < 2 || mission.difficulties.length > 10) throw new Error('周常缺少第二档难度 difficulties[1]');
    return { missionType: text(mission.missionType, '周常任务类型', 100), difficulties: mission.difficulties.map(difficulty => ({ deviation: text(difficulty?.deviation, '周常变体', 150), risks: strings(difficulty?.risks, '周常风险') })) };
  });
  return { Type: value.Type, startsAt, endsAt, Missions, Variables: strings(value.Variables, '个人限制') };
}
function reward(value) {
  if (!value || value.countedItems === undefined) return {};
  if (!Array.isArray(value.countedItems) || value.countedItems.length > 100) throw new Error('入侵奖励格式无效');
  return { countedItems: value.countedItems.map(item => {
    if (!Number.isSafeInteger(item.ItemCount) || item.ItemCount < 0) throw new Error('入侵奖励数量无效');
    return { ItemType: text(item.ItemType, '奖励路径'), ItemCount: item.ItemCount };
  }) };
}
function invasion(value) {
  if (value.Completed === true) return { Completed: true };
  if (value.Completed !== false) throw new Error('入侵完成状态无效');
  const result = { Completed: false, _id: { $oid: text(value._id?.$oid, '入侵 ID', 100) }, Node: text(value.Node, '入侵节点', 100), Faction: factions(value.Faction), DefenderFaction: factions(value.DefenderFaction), LocTag: text(value.LocTag, '入侵类型'), AttackerReward: reward(value.AttackerReward), DefenderReward: reward(value.DefenderReward) };
  if (result.LocTag !== '/Lotus/Language/Menu/InfestedInvasionBoss') for (const side of ['Attacker', 'Defender']) if (result[`${side}Reward`].countedItems) result[`${side}MissionInfo`] = { seed: oracleSeed(value[`${side}MissionInfo`]?.seed).toString() };
  return result;
}
export function selectOracleState(raw, { at = Date.now(), loadedAt = Date.now(), source = WORLD_STATE_URL } = {}) {
  oracleTime(at); oracleTime(loadedAt);
  if (typeof raw !== 'string' || Buffer.byteLength(raw) > MAX_BYTES) throw new Error('世界状态 JSON 超过 16 MiB 或正文无效');
  const value = JSON.parse(raw); if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('世界状态应为 JSON 对象');
  const selected = { SyndicateMissions: null, Invasions: null, Conquests: null };
  if (value.SyndicateMissions !== undefined) {
    if (!Array.isArray(value.SyndicateMissions) || value.SyndicateMissions.length > 1000) throw new Error('SyndicateMissions 格式无效');
    selected.SyndicateMissions = value.SyndicateMissions.filter(x => ['CetusSyndicate', 'SolarisSyndicate', 'HexSyndicate', 'EntratiSyndicate'].includes(x.Tag)).map(x => {
      const startsAt = stamp(x.Activation), endsAt = stamp(x.Expiry);
      if (Date.parse(endsAt) <= Date.parse(startsAt)) throw new Error('赏金世界状态有效窗口无效');
      if (x.Jobs !== undefined && (!Array.isArray(x.Jobs) || x.Jobs.length > 100)) throw new Error('赏金奖励列表无效');
      return { Tag: x.Tag, seed: oracleSeed(x.Seed).toString(), startsAt, endsAt, jobs: (x.Jobs ?? []).map(job => ({ rewards: text(job.rewards, '赏金奖励路径') })) };
    });
  }
  if (value.Invasions !== undefined) {
    if (!Array.isArray(value.Invasions) || value.Invasions.length > 1000) throw new Error('Invasions 格式无效');
    selected.Invasions = value.Invasions.map(invasion);
  }
  if (value.Conquests !== undefined) {
    if (!Array.isArray(value.Conquests) || value.Conquests.length > 1000) throw new Error('Conquests 格式无效');
    selected.Conquests = value.Conquests.filter(row => ['CT_LAB', 'CT_HEX'].includes(row?.Type)).map(conquest);
  }
  if (selected.SyndicateMissions === null && selected.Invasions === null && selected.Conquests === null) throw new Error('文件缺少 SyndicateMissions、Invasions 和 Conquests 世界状态字段');
  return { schemaVersion: 1, source, observedAt: new Date(at).toISOString(), loadedAt: new Date(loadedAt).toISOString(), payloadHash: sha256(raw), dataHash: sha256(JSON.stringify(selected)), data: selected };
}
export async function cachedOracleState(file) {
  const state = await readJson(file).catch(() => null);
  if (state?.schemaVersion !== 1 || typeof state.source !== 'string' || !Number.isFinite(Date.parse(state.observedAt)) || !Number.isFinite(Date.parse(state.loadedAt)) || !/^[a-f0-9]{64}$/.test(state.payloadHash) || !state.data || !['SyndicateMissions', 'Invasions', 'Conquests'].every(key => state.data[key] == null || Array.isArray(state.data[key])) || state.dataHash !== sha256(JSON.stringify(state.data))) return null;
  return state;
}
export async function refreshOracleState(file, { proxyUrl = null, request = requestBytes, now = Date.now } = {}) {
  const bytes = await request(WORLD_STATE_URL, { proxyUrl, maxBytes: MAX_BYTES }); const at = now();
  const state = selectOracleState(bytes.toString('utf8'), { at, loadedAt: at });
  if (state.data.SyndicateMissions === null || state.data.Invasions === null || state.data.Conquests === null) throw new Error('官方世界状态缺少完整推算字段，保留原缓存');
  for (const tag of ['HexSyndicate', 'CetusSyndicate', 'EntratiSyndicate']) activeSyndicate(state, tag, at);
  await atomicJson(file, state); return state;
}
export async function importOracleState(file, input, { at = Date.now(), now = Date.now } = {}) {
  const stat = await fs.stat(input); if (!stat.isFile() || stat.size > MAX_BYTES) throw new Error('世界状态应为不超过 16 MiB 的 JSON 文件');
  const state = selectOracleState(await fs.readFile(input, 'utf8'), { at, loadedAt: now(), source: `本地导入：${path.basename(input)}` });
  await atomicJson(file, state); return state;
}
export function oracleStateStatus(state) {
  return state ? { available: true, ...stateProvenance(state), syndicates: state.data.SyndicateMissions?.map(({ Tag, seed, startsAt, endsAt }) => ({ tag: Tag, seed, startsAt, endsAt })) ?? [], invasions: state.data.Invasions == null ? null : state.data.Invasions.filter(x => !x.Completed).length, conquests: state.data.Conquests?.map(({ Type, startsAt, endsAt }) => ({ type: Type, startsAt, endsAt })) ?? null } : { available: false };
}
