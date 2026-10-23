import { readExtendedJsonDate } from "../raw/extended-json.mjs";

const SECOND_MS = 1_000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;

const EARTH_STATE_MS = 4 * HOUR_MS;
const EARTH_CYCLE_MS = 2 * EARTH_STATE_MS;

const OPEN_WORLD_DAY_MS = 100 * MINUTE_MS;
const OPEN_WORLD_NIGHT_MS = 50 * MINUTE_MS;
const OPEN_WORLD_CYCLE_MS = OPEN_WORLD_DAY_MS + OPEN_WORLD_NIGHT_MS;

const VALLIS_ANCHOR_MS = Date.parse("2026-02-04T19:46:48.000Z");
const VALLIS_WARM_MS = 400 * SECOND_MS;
const VALLIS_COLD_MS = 1_200 * SECOND_MS;
const VALLIS_CYCLE_MS = VALLIS_WARM_MS + VALLIS_COLD_MS;

const ZARIMAN_ANCHOR_MS = 1_655_182_800_000;
const ZARIMAN_STATE_MS = 150 * MINUTE_MS;
const ZARIMAN_CYCLE_MS = 2 * ZARIMAN_STATE_MS;

const DUVIRI_ANCHOR_MS = 52 * SECOND_MS;
const DUVIRI_STATE_MS = 2 * HOUR_MS;
const DUVIRI_STATES = Object.freeze([
  "sorrow",
  "fear",
  "joy",
  "anger",
  "envy",
]);
const DUVIRI_CYCLE_MS = DUVIRI_STATE_MS * DUVIRI_STATES.length;

const REGION_NAMES = Object.freeze({
  en: Object.freeze({
    earth: "Earth",
    cetus: "Plains of Eidolon",
    cambion: "Cambion Drift",
    vallis: "Orb Vallis",
    zariman: "Zariman",
    duviri: "Duviri",
  }),
  zh: Object.freeze({
    earth: "地球",
    cetus: "夜灵平原",
    cambion: "魔胎之境",
    vallis: "奥布山谷",
    zariman: "扎里曼号",
    duviri: "双衍王境",
  }),
});

const STATE_NAMES = Object.freeze({
  en: Object.freeze({
    day: "Day",
    night: "Night",
    fass: "Fass",
    vome: "Vome",
    warm: "Warm",
    cold: "Cold",
    corpus: "Corpus",
    grineer: "Grineer",
    sorrow: "Sorrow",
    fear: "Fear",
    joy: "Joy",
    anger: "Anger",
    envy: "Envy",
  }),
  zh: Object.freeze({
    day: "白昼",
    night: "夜晚",
    fass: "Fass",
    vome: "Vome",
    warm: "温暖",
    cold: "寒冷",
    corpus: "Corpus",
    grineer: "Grineer",
    sorrow: "悲伤",
    fear: "恐惧",
    joy: "喜悦",
    anger: "愤怒",
    envy: "嫉妒",
  }),
});

const positiveModulo = (value, divisor) => ((value % divisor) + divisor) % divisor;
const toIso = (value) => new Date(value).toISOString();

/** 周期内容目前只有项目审核过的中英文标签，其他语言不伪造英文回退。 */
function labelProfile(language) {
  if (language === "zh") return "zh";
  if (language === "en") return "en";
  return null;
}

/** 从 raw Time 取上游服务器时间，避免使用 API 机器本地时钟。 */
function sourceTimeMs(raw) {
  if (typeof raw?.Time !== "number" || !Number.isFinite(raw.Time)) return null;
  const value = raw.Time * SECOND_MS;
  return Number.isFinite(value) ? value : null;
}

/** 读取指定集团任务的到期时间，它是部分开放世界周期的 raw 边界。 */
function syndicateExpiryMs(raw, tag, warnings) {
  if (!Array.isArray(raw?.SyndicateMissions)) return null;
  const entries = raw.SyndicateMissions.filter(mission => mission?.Tag === tag);
  if (!entries.length) { warnings.push(`CYCLE_SYNDICATE_MISSING:${tag}`); return null; }
  const now = sourceTimeMs(raw);
  const current = entries.flatMap(entry => {
    const expiry = Date.parse(readExtendedJsonDate(entry.Expiry) ?? '');
    const activation = entry.Activation ? Date.parse(readExtendedJsonDate(entry.Activation) ?? '') : -Infinity;
    return activation <= now && now < expiry ? [expiry] : [];
  });
  const expiries = [...new Set(current)];
  if (expiries.length !== 1) {
    warnings.push(`CYCLE_SYNDICATE_${expiries.length ? 'AMBIGUOUS' : 'NO_ACTIVE_WINDOW'}:${tag}`);
    return null;
  }
  return expiries[0];
}

/** 输出六类周期共用的稳定 DTO，名称字段始终紧跟 raw 状态键。 */
function cycleEntry({
  id,
  state,
  activationMs,
  expiryMs,
  nextState,
  durationMs,
  sourceFields,
  syndicateTag = null,
}, language) {
  const profile = labelProfile(language);
  return {
    id,
    region: id,
    regionName: profile ? REGION_NAMES[profile][id] : null,
    state,
    stateName: profile ? STATE_NAMES[profile][state] : null,
    activation: toIso(activationMs),
    expiry: toIso(expiryMs),
    nextState,
    nextStateName: profile ? STATE_NAMES[profile][nextState] : null,
    durationSeconds: durationMs / SECOND_MS,
    sourceFields,
    ...(syndicateTag ? { syndicateTag } : {}),
  };
}

/** 地球昼夜以 Unix epoch 为固定锚点，每个状态持续 4 小时。 */
function earthCycle(nowMs, language) {
  const phase = positiveModulo(nowMs, EARTH_CYCLE_MS);
  const isDay = phase < EARTH_STATE_MS;
  const statePhase = phase % EARTH_STATE_MS;
  const activationMs = nowMs - statePhase;
  const state = isDay ? "day" : "night";
  return cycleEntry({
    id: "earth",
    state,
    activationMs,
    expiryMs: activationMs + EARTH_STATE_MS,
    nextState: isDay ? "night" : "day",
    durationMs: EARTH_STATE_MS,
    sourceFields: ["Time"],
  }, language);
}

/** 夜灵平原/魔胎之境使用各自集团 raw 窗口：前 100 分钟与后 50 分钟为两个状态。 */
function splitOpenWorldCycle(nowMs, rawExpiryMs, config, language) {
  const cycleEndMs = Math.floor(rawExpiryMs / MINUTE_MS) * MINUTE_MS;
  const remainingMs = cycleEndMs - nowMs;
  if (remainingMs <= 0 || remainingMs > OPEN_WORLD_CYCLE_MS) return null;

  const firstState = remainingMs > OPEN_WORLD_NIGHT_MS;
  const activationMs = firstState
    ? cycleEndMs - OPEN_WORLD_CYCLE_MS
    : cycleEndMs - OPEN_WORLD_NIGHT_MS;
  const expiryMs = firstState ? cycleEndMs - OPEN_WORLD_NIGHT_MS : cycleEndMs;
  return cycleEntry({
    id: config.id,
    state: firstState ? config.firstState : config.secondState,
    activationMs,
    expiryMs,
    nextState: firstState ? config.secondState : config.firstState,
    durationMs: firstState ? OPEN_WORLD_DAY_MS : OPEN_WORLD_NIGHT_MS,
    sourceFields: ["Time", "SyndicateMissions"],
    syndicateTag: config.syndicateTag,
  }, language);
}

/** 奥布山谷每 26 分 40 秒一轮，温暖 6 分 40 秒、寒冷 20 分钟。 */
function vallisCycle(nowMs, language) {
  const phase = positiveModulo(nowMs - VALLIS_ANCHOR_MS, VALLIS_CYCLE_MS);
  const cycleStartMs = nowMs - phase;
  const isWarm = phase < VALLIS_WARM_MS;
  const activationMs = cycleStartMs + (isWarm ? 0 : VALLIS_WARM_MS);
  return cycleEntry({
    id: "vallis",
    state: isWarm ? "warm" : "cold",
    activationMs,
    expiryMs: cycleStartMs + (isWarm ? VALLIS_WARM_MS : VALLIS_CYCLE_MS),
    nextState: isWarm ? "cold" : "warm",
    durationMs: isWarm ? VALLIS_WARM_MS : VALLIS_COLD_MS,
    sourceFields: ["Time"],
  }, language);
}

/** 扎里曼每 150 分钟切换 Corpus/Grineer，集团到期时间就是当前切换点。 */
function zarimanCycle(nowMs, rawExpiryMs, language) {
  const expiryMs = Math.round((rawExpiryMs - 5 * SECOND_MS) / MINUTE_MS) * MINUTE_MS;
  if (expiryMs <= nowMs || expiryMs - nowMs > ZARIMAN_STATE_MS) return null;

  const phase = positiveModulo(
    rawExpiryMs - 5 * SECOND_MS - ZARIMAN_ANCHOR_MS,
    ZARIMAN_CYCLE_MS,
  );
  const isCorpus = ZARIMAN_CYCLE_MS - phase > ZARIMAN_STATE_MS;
  return cycleEntry({
    id: "zariman",
    state: isCorpus ? "corpus" : "grineer",
    activationMs: expiryMs - ZARIMAN_STATE_MS,
    expiryMs,
    nextState: isCorpus ? "grineer" : "corpus",
    durationMs: ZARIMAN_STATE_MS,
    sourceFields: ["Time", "SyndicateMissions"],
    syndicateTag: "ZarimanSyndicate",
  }, language);
}

/** 双衍王境每 2 小时切换一种情绪，五种情绪构成 10 小时循环。 */
function duviriCycle(nowMs, language) {
  const phase = positiveModulo(nowMs - DUVIRI_ANCHOR_MS, DUVIRI_CYCLE_MS);
  const stateIndex = Math.floor(phase / DUVIRI_STATE_MS);
  const activationMs = nowMs - (phase % DUVIRI_STATE_MS);
  return cycleEntry({
    id: "duviri",
    state: DUVIRI_STATES[stateIndex],
    activationMs,
    expiryMs: activationMs + DUVIRI_STATE_MS,
    nextState: DUVIRI_STATES[(stateIndex + 1) % DUVIRI_STATES.length],
    durationMs: DUVIRI_STATE_MS,
    sourceFields: ["Time"],
  }, language);
}

/** 从 DE/WG 官方 raw 生成统一的开放世界与区域周期列表。 */
export function normalizeCycles(raw, options = {}) {
  const server = options.server;
  if (server !== "de" && server !== "wg") {
    throw new Error(`Cycles normalizer 不支持服务器: ${server}`);
  }

  const nowMs = sourceTimeMs(raw);
  if (nowMs === null) {
    return {
      status: "error",
      source: `${server}-world-state`,
      lossy: false,
      data: null,
      warnings: ["RAW_TIME_INVALID_FOR_CYCLES"],
    };
  }

  const warnings = [];
  if (!Array.isArray(raw?.SyndicateMissions)) {
    warnings.push("RAW_SYNDICATE_MISSIONS_IS_NOT_ARRAY_FOR_CYCLES");
  }
  const language = options.language ?? "zh";
  const data = [earthCycle(nowMs, language)];

  const cetusExpiry = syndicateExpiryMs(raw, "CetusSyndicate", warnings);
  if (cetusExpiry !== null) {
    const cetus = splitOpenWorldCycle(nowMs, cetusExpiry, {
      id: "cetus",
      firstState: "day",
      secondState: "night",
      syndicateTag: "CetusSyndicate",
    }, language);
    if (cetus) data.push(cetus);
    else warnings.push("CYCLE_WINDOW_INVALID:CetusSyndicate");
  }

  const cambionExpiry = syndicateExpiryMs(raw, "EntratiSyndicate", warnings);
  if (cambionExpiry !== null) {
    const cambion = splitOpenWorldCycle(nowMs, cambionExpiry, {
      id: "cambion",
      firstState: "fass",
      secondState: "vome",
      syndicateTag: "EntratiSyndicate",
    }, language);
    if (cambion) data.push(cambion);
    else warnings.push("CYCLE_WINDOW_INVALID:EntratiSyndicate");
  }

  data.push(vallisCycle(nowMs, language));

  const zarimanExpiry = syndicateExpiryMs(raw, "ZarimanSyndicate", warnings);
  if (zarimanExpiry !== null) {
    const zariman = zarimanCycle(nowMs, zarimanExpiry, language);
    if (zariman) data.push(zariman);
    else warnings.push("CYCLE_WINDOW_INVALID:ZarimanSyndicate");
  }

  data.push(duviriCycle(nowMs, language));

  return {
    status: warnings.length > 0 ? "partial" : "ok",
    source: `${server}-world-state`,
    lossy: warnings.length > 0,
    data,
    warnings,
  };
}
