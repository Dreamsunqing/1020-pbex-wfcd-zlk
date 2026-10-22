import { readExtendedJsonDate } from "../raw/extended-json.mjs";

const own = (value, key) => Object.prototype.hasOwnProperty.call(value ?? {}, key);
const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const descriptor = (key, type, optional = false, fallback = null) => ({ key, type, optional, fallback });
const str = (key, optional = false) => descriptor(key, "string", optional);
const num = (key, optional = false) => descriptor(key, "integer", optional);
const date = (key) => descriptor(key, "date");
const list = (key, type) => descriptor(key, { array: type });
const bool = (key) => descriptor(key, "boolean", true, null);

function source(server) {
  if (!["de", "wg"].includes(server)) throw new Error(`Season/social normalizer 不支持服务器: ${server}`);
  return `${server}-world-state`;
}

function warning(warnings, code, path) { warnings.push(`${code}:${path}`); }

/** Unknown keys keep their original spelling. Extended JSON is still decoded recursively. */
function extended(value, path, warnings) {
  if (Array.isArray(value)) return value.map((item, i) => extended(item, `${path}[${i}]`, warnings));
  if (!object(value)) return value;
  if (own(value, "$date")) {
    const iso = readExtendedJsonDate(value);
    if (iso === null) warning(warnings, "INVALID_DATE", path);
    return iso;
  }
  if (own(value, "$oid")) {
    if (typeof value.$oid === "string" && value.$oid.length) return value.$oid;
    warning(warnings, "INVALID_ID", path);
    return null;
  }
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, extended(item, `${path}.${key}`, warnings)]));
}

function parse(value, type, path, warnings) {
  if (object(type) && own(type, "array")) {
    if (!Array.isArray(value)) { warning(warnings, "INVALID_ARRAY", path); return null; }
    return value.map((item, i) => parse(item, type.array, `${path}[${i}]`, warnings));
  }
  if (object(type)) return record(value, type, path, warnings);
  if (type === "date") {
    const iso = readExtendedJsonDate(value);
    if (iso === null) warning(warnings, "INVALID_DATE", path);
    return iso;
  }
  if (type === "id") {
    const id = typeof value === "string" ? value : object(value) ? value.$oid : null;
    if (typeof id === "string" && id.length) return id;
    warning(warnings, "INVALID_ID", path); return null;
  }
  if (type === "json") return extended(value, path, warnings);
  if (type === "booleanMap") {
    if (!object(value)) { warning(warnings, "INVALID_OBJECT", path); return null; }
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, parse(item, "boolean", `${path}.${key}`, warnings)]));
  }
  if (type === "integer" ? Number.isSafeInteger(value) : typeof value === type) return value;
  warning(warnings, `INVALID_${type.toUpperCase()}`, path); return null;
}

function record(value, schema, path, warnings) {
  if (!object(value)) { warning(warnings, "INVALID_OBJECT", path); return null; }
  const data = {};
  const known = new Set();
  for (const [output, spec] of Object.entries(schema)) {
    known.add(spec.key);
    if (!own(value, spec.key)) {
      data[output] = spec.fallback;
      if (!spec.optional) warning(warnings, "MISSING_FIELD", `${path}.${spec.key}`);
    } else data[output] = parse(value[spec.key], spec.type, `${path}.${spec.key}`, warnings);
  }
  data.extensions = Object.fromEntries(Object.entries(value).filter(([key]) => !known.has(key)).map(([key, item]) => [key, extended(item, `${path}.${key}`, warnings)]));
  const starts = data.startsAt;
  const ends = data.endsAt;
  if (starts && ends && starts > ends) warning(warnings, "INVALID_TIME_RANGE", path);
  const calendarKey = { CET_CHALLENGE: "challengeKey", CET_REWARD: "rewardKey", CET_UPGRADE: "upgradeKey" }[data.type];
  if (calendarKey && !data[calendarKey]) warning(warnings, "MISSING_CALENDAR_EVENT_KEY", `${path}.${calendarKey}`);
  return data;
}

function normalize(raw, options, field, schema, isArray = true, opaque = false) {
  const provider = source(options?.server);
  if (!own(raw, field)) return { status: "error", source: provider, lossy: false, data: null, warnings: [`RAW_${field.toUpperCase()}_MISSING`] };
  if (isArray && !Array.isArray(raw[field])) return {
    status: "error", source: provider, lossy: false, data: null,
    warnings: [`RAW_${field.toUpperCase()}_IS_NOT_ARRAY`],
  };
  if (!isArray && !object(raw[field])) return {
    status: "error", source: provider, lossy: false, data: null,
    warnings: [`RAW_${field.toUpperCase()}_IS_NOT_OBJECT`],
  };
  const warnings = [];
  let data;
  if (opaque) {
    data = extended(raw[field], field, warnings);
    if (data.length) warning(warnings, "SCHEMA_UNVERIFIED", field);
  } else data = parse(raw[field], isArray ? { array: schema } : schema, field, warnings);
  if (Array.isArray(data)) {
    const ids = new Set();
    for (const item of data) if (item?.id) {
      if (ids.has(item.id)) warning(warnings, "DUPLICATE_ID", `${field}.${item.id}`);
      ids.add(item.id);
    }
  }
  return { status: warnings.length ? "partial" : "ok", source: provider, lossy: warnings.length > 0, data, warnings };
}

const windowSchema = { startsAt: date("Activation"), endsAt: date("Expiry") };
const seasonChallengeSchema = {
  id: descriptor("_id", "id"), daily: bool("Daily"), ...windowSchema,
  challengeKey: str("Challenge"), hasPrerequisites: bool("HasPrerequisites"),
};
const seasonSchema = {
  ...windowSchema, affiliationTag: str("AffiliationTag"), season: num("Season"), phase: num("Phase"),
  params: str("Params"), activeChallenges: list("ActiveChallenges", seasonChallengeSchema),
};
const calendarEventSchema = {
  type: str("type"), challengeKey: str("challenge", true), rewardKey: str("reward", true), upgradeKey: str("upgrade", true),
};
const calendarSchema = {
  ...windowSchema, season: str("Season"), yearIteration: num("YearIteration"), version: num("Version"),
  days: list("Days", { day: num("day"), events: list("events", calendarEventSchema) }),
  upgradeAvailabilityRequirements: list("UpgradeAvaliabilityRequirements", "string"),
};
const descentSchema = {
  ...windowSchema, randomSeed: num("RandSeed"), challenges: list("Challenges", {
    index: num("Index"), type: str("Type"), challengeKey: str("Challenge"), levelKey: str("Level"),
    specs: list("Specs", "string"), auras: list("Auras", "string"),
  }),
};
const endlessSchema = {
  ...windowSchema, categoryChoices: list("CategoryChoices", { category: str("Category"), choices: list("Choices", "string") }),
};
const pvpSchema = {
  id: descriptor("_id", "id"), challengeKey: str("challengeTypeRefID"), startsAt: date("startDate"), endsAt: date("endDate"),
  params: list("params", { name: str("n"), value: descriptor("v", "json") }),
  isGenerated: descriptor("isGenerated", "boolean"), mode: str("PVPMode"), subChallengeIds: list("subChallenges", "id"), category: str("Category"),
};
const guildSchema = {
  id: descriptor("_id", "id"), name: str("Name"), tier: num("Tier"), allianceId: descriptor("AllianceId", "id", true),
  emblem: bool("Emblem"), hiddenPlatforms: descriptor("HiddenPlatforms", "booleanMap", true), iconOverride: num("IconOverride", true),
};

/** Options accept server, language and wgCatalog. Stable upstream keys do not require localization. */
export function normalizeSeasonInfo(raw, options = {}) { return normalize(raw, options, "SeasonInfo", seasonSchema, false); }
export function normalizeKnownCalendarSeasons(raw, options = {}) { return normalize(raw, options, "KnownCalendarSeasons", calendarSchema); }
export function normalizeDescents(raw, options = {}) { return normalize(raw, options, "Descents", descentSchema); }
export function normalizeEndlessXpSchedule(raw, options = {}) { return normalize(raw, options, "EndlessXpSchedule", endlessSchema); }
export function normalizeLibraryInfo(raw, options = {}) { return normalize(raw, options, "LibraryInfo", { lastCompletedTargetKey: str("LastCompletedTargetType") }, false); }
export function normalizePVPChallengeInstances(raw, options = {}) { return normalize(raw, options, "PVPChallengeInstances", pvpSchema); }
export function normalizePVPActiveTournaments(raw, options = {}) { return normalize(raw, options, "PVPActiveTournaments", null, true, true); }
export function normalizePVPAlternativeModes(raw, options = {}) { return normalize(raw, options, "PVPAlternativeModes", null, true, true); }
export function normalizeFeaturedGuilds(raw, options = {}) { return normalize(raw, options, "FeaturedGuilds", guildSchema); }
export function normalizeHubEvents(raw, options = {}) { return normalize(raw, options, "HubEvents", null, true, true); }
export function normalizeTwitchPromos(raw, options = {}) { return normalize(raw, options, "TwitchPromos", null, true, true); }
export function normalizeExperimentRecommended(raw, options = {}) { return normalize(raw, options, "ExperimentRecommended", null, true, true); }
export function normalizeSkuSales(raw, options = {}) { return normalize(raw, options, "SkuSales", null, true, true); }
