import { OracleRandom } from './oracle.mjs';
import { oracleSeed, oracleTime, stateProvenance } from './oracle-bounties.mjs';

export function invasionRules(text) {
  const read = name => {
    const match = new RegExp(`local ${name} <const> = \\{([^}]*)\\}`).exec(text);
    if (!match) throw new Error(`Oracle 入侵规则缺少 ${name}`);
    const values = JSON.parse('[' + match[1].trim().replace(/,\s*$/, '') + ']');
    if (!Array.isArray(values) || !values.length || values.length > 1000 || values.some(x => typeof x !== 'string' || !/^[A-Za-z0-9_]+$/.test(x))) throw new Error('入侵候选表无效');
    return values;
  };
  return { attacker: read('attackerMissionTypes'), defender: read('defenderMissionTypes'), ship: read('grineerVsCorpusShipMissionTypes'), shipNodes: read('shipNodes') };
}
export function invasionMission(invasion, attacker, at, rules) {
  oracleTime(at);
  if (invasion.LocTag === '/Lotus/Language/Menu/InfestedInvasionBoss') return 'Assassination';
  const seed = oracleSeed((attacker ? invasion.AttackerMissionInfo : invasion.DefenderMissionInfo)?.seed);
  const rng = new OracleRandom(seed), seconds = Math.floor(at / 1000);
  const cycle = Math.floor((((seconds - 1391990400) % 86400 + 86400) % 86400) / 900);
  for (let i = 0; i < cycle; i++) rng.churn();
  const candidates = invasion.Faction !== 'FC_INFESTATION' && invasion.DefenderFaction !== 'FC_INFESTATION' && rules.shipNodes.includes(invasion.Node) ? rules.ship : attacker ? rules.attacker : rules.defender;
  return candidates[rng.int(1, candidates.length) - 1];
}
export function invasionForecast(rules, { state, at = Date.now(), count = 2 } = {}, dataVersion = null) {
  oracleTime(at);
  if (!Number.isInteger(count) || count < 1 || count > 8) throw new Error('入侵轮次数量应为 1–8');
  if (!state?.data?.Invasions) throw new Error('缺少入侵世界状态，请刷新或导入 JSON');
  const observed = Date.parse(state.observedAt), activation = Math.floor(at / 900000) * 900000;
  if (Math.floor(observed / 900000) !== Math.floor(at / 900000)) throw new Error('参考时间超出入侵数据的 15 分钟采集窗口，请刷新或调整时间');
  const windows = Array.from({ length: count }, (_, i) => ({ startsAt: new Date(activation + i * 900000).toISOString(), endsAt: new Date(activation + (i + 1) * 900000).toISOString() }));
  const entries = [];
  for (const invasion of state.data.Invasions) {
    if (invasion.Completed) continue;
    for (const attacker of [true, false]) {
      const reward = attacker ? invasion.AttackerReward : invasion.DefenderReward;
      if (!Array.isArray(reward?.countedItems)) continue;
      entries.push({ id: invasion._id.$oid, node: invasion.Node, side: attacker ? 'attacker' : 'defender', ally: attacker ? invasion.Faction : invasion.DefenderFaction, allyPay: reward.countedItems, missions: windows.map(window => invasionMission(invasion, attacker, Date.parse(window.startsAt), rules)) });
    }
  }
  return { algorithm: 'oracle-invasion-1', dataVersion, worldState: stateProvenance(state), startsAt: windows[0].startsAt, endsAt: windows.at(-1).endsAt, windows, entries, warnings: ['每 15 分钟切换，UTC 零点重置随机数预推进次数', '后续轮次假定输入中的入侵继续存在；不推算新增、结束或奖励变化', '沿用 Oracle 关于入侵地形支持全部候选任务的假定，需游戏内核对'] };
}
