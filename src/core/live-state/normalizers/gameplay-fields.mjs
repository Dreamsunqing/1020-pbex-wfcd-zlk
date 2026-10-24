import { readExtendedJsonDate } from "../raw/extended-json.mjs";
import {
  createStaticLocalizationContext,
  hasStructuralWarnings,
  localizeStaticKey,
  localizeFissureModifier,
} from "../localization/static-worldstate-resolver.mjs";

const object = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const own = (v, k) => Object.prototype.hasOwnProperty.call(v, k);
const idOf = (v) => typeof v === "string" && v.length ? v : object(v) && typeof v.$oid === "string" && v.$oid.length ? v.$oid : null;
const snake = (v) => v.replace(/([a-z])([A-Z])/g, "$1_$2").toUpperCase();

// Preserve nested opaque payloads and stable item/resource keys, but unwrap dates/IDs.
function payload(value, path, warnings) {
  if (object(value) && own(value, "$date")) {
    const date = readExtendedJsonDate(value);
    if (!date) warnings.add(`INVALID_DATE:${path}`);
    return date;
  }
  if (object(value) && own(value, "$oid")) {
    const id = idOf(value);
    if (!id) warnings.add(`INVALID_ID:${path}`);
    return id;
  }
  if (Array.isArray(value)) return value.map((v, i) => payload(v, `${path}.${i}`, warnings));
  if (object(value)) return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, payload(v, `${path}.${k}`, warnings)]));
  return value;
}

function read(entry, key, type, path, warnings, required = false) {
  if (!own(entry, key)) {
    if (required) warnings.add(`MISSING_FIELD:${path}.${key}`);
    return null;
  }
  const value = entry[key];
  if (type === "date") {
    const date = readExtendedJsonDate(value);
    if (!date) warnings.add(`INVALID_DATE:${path}.${key}`);
    return date;
  }
  if (type === "id") {
    const id = idOf(value);
    if (!id) warnings.add(`INVALID_ID:${path}.${key}`);
    return id;
  }
  const valid = type === "array" ? Array.isArray(value) : type === "object" ? object(value) : type === "reward" ? object(value) || (Array.isArray(value) && value.length === 0) : typeof value === type && (type !== "number" || Number.isFinite(value));
  if (!valid) {
    warnings.add(`INVALID_FIELD:${path}.${key}:${type}`);
    return null;
  }
  if (required && type === "string" && value.length === 0) warnings.add(`INVALID_FIELD:${path}.${key}:nonempty-string`);
  return payload(value, `${path}.${key}`, warnings);
}

function mission(value, context, path, warnings) {
  if (value === null) return null;
  const result = payload(value, path, warnings);
  for (const [key, category, output] of [["location", "nodes", "node"], ["missionType", "missionTypes", "missionType"], ["faction", "factions", "faction"]]) {
    if (own(value, key)) {
      const stable = read(value, key, "string", path, warnings);
      result[output] = localizeStaticKey(stable, category, context, warnings);
    }
  }
  validateKnown(value, {
    location: "string", missionType: "string", faction: "string", seed: "number", difficulty: "number", minEnemyLevel: "number", maxEnemyLevel: "number", missionReward: "reward",
    levelOverride: "string", enemySpec: "string", extraEnemySpec: "string", descText: "string", exclusiveWeapon: "string", archwingRequired: "boolean", requiredItems: "array", consumeRequiredItems: "boolean", vipAgent: "string", leadersAlwaysAllowed: "boolean", goalTag: "string", levelAuras: "array", icon: "string",
  }, path, warnings);
  return result;
}

function validateKnown(value, types, path, warnings) {
  for (const key of Object.keys(value)) {
    if (!own(types, key)) { warnings.add(`UNMODELED_FIELD:${path}.${key}`); continue; }
    const checked = read(value, key, types[key], path, warnings);
    if (types[key] === "reward" && checked !== null) validateReward(checked, `${path}.${key}`, warnings);
  }
}

function validateReward(value, path, warnings) {
  if (Array.isArray(value)) return; // Official absence marker is an empty array.
  validateKnown(value, { credits: "number", items: "array", countedItems: "array", randomizedItems: "string" }, path, warnings);
  for (const [i, item] of (Array.isArray(value.items) ? value.items : []).entries()) {
    if (typeof item !== "string") warnings.add(`INVALID_FIELD:${path}.items.${i}:string`);
  }
  for (const [i, item] of (Array.isArray(value.countedItems) ? value.countedItems : []).entries()) {
    if (!object(item)) { warnings.add(`INVALID_FIELD:${path}.countedItems.${i}:object`); continue; }
    read(item, "ItemType", "string", `${path}.countedItems.${i}`, warnings, true);
    read(item, "ItemCount", "number", `${path}.countedItems.${i}`, warnings, true);
  }
}

function normalize(raw, options, field, schema, required = [], localized = true) {
  const { server } = options;
  if (server !== "de" && server !== "wg") throw new Error(`${field} normalizer 不支持服务器: ${server}`);
  const prefix = snake(field);
  const context = localized ? createStaticLocalizationContext(options, prefix) : null;
  const base = { source: `${server}-world-state`, lossy: false, ...(localized ? { languageCode: context?.language ?? options.language ?? null } : {}) };
  if (localized && !context) return { ...base, status: "error", data: null, warnings: [`${prefix}_UNSUPPORTED_LANGUAGE:${options.language ?? "null"}`] };
  if (!Array.isArray(raw?.[field])) return { ...base, status: "error", data: null, warnings: [`RAW_${prefix}_IS_NOT_ARRAY`] };
  const warnings = new Set();
  const data = [];
  for (const [i, entry] of raw[field].entries()) {
    const path = `${field}.${i}`;
    if (!object(entry) || !idOf(entry._id)) {
      warnings.add(`${prefix}_INVALID_ENTRY_SKIPPED:${i}`);
      continue;
    }
    const item = { id: idOf(entry._id) };
    if (field === "GlobalUpgrades") item.scopeKnown = !own(entry, "Nodes") || (Array.isArray(entry.Nodes) && entry.Nodes.every(v => typeof v === "string" && v.length > 0));
    for (const [key, [output, type]] of Object.entries(schema)) {
      const value = read(entry, key, type === "node" || type === "faction" || type === "missionType" || type === "tier" ? "string" : type === "mission" ? "object" : type, path, warnings, required.includes(key));
      item[output] = type === "node" || type === "faction" || type === "missionType" ? localizeStaticKey(value, type === "node" ? "nodes" : type === "missionType" ? "missionTypes" : "factions", context, warnings) : type === "tier" ? localizeFissureModifier(value, context, warnings) : type === "mission" ? mission(value, context, `${path}.${key}`, warnings) : value;
      if (type === "reward" && value !== null) validateReward(value, `${path}.${key}`, warnings);
      if (field === "Alerts" && key === "MissionInfo" && value !== null) {
        for (const requiredKey of ["location", "missionType", "faction"]) read(value, requiredKey, "string", `${path}.${key}`, warnings, true);
      }
      if (key === "ContinuousHubEvent" && value !== null) validateKnown(value, { Transmissions: "array", Activation: "date", Expiry: "date", RepeatInterval: "number" }, `${path}.${key}`, warnings);
      if (type === "array" && value && ["CustomNpcEncounters", "ArchwingDrops", "Regions"].includes(key)) {
        const elementType = key === "Regions" ? "number" : "string";
        if (value.some((v) => typeof v !== elementType || (elementType === "number" && !Number.isFinite(v)))) warnings.add(`INVALID_FIELD:${path}.${key}:${elementType}[]`);
      }
      if (type === "array" && ["Nodes", "Jobs", "PreviousJobs"].includes(key) && value) {
        item[output] = value.map((v, j) => {
          if (key === "Nodes") {
            if (typeof v !== "string") { warnings.add(`INVALID_FIELD:${path}.${key}.${j}:string`); return null; }
            return field === "GlobalUpgrades" ? v : localizeStaticKey(v, "nodes", context, warnings);
          }
          if (!object(v)) { warnings.add(`INVALID_FIELD:${path}.${key}.${j}:object`); return null; }
          validateKnown(v, { jobType: "string", rewards: "string", masteryReq: "number", minEnemyLevel: "number", maxEnemyLevel: "number", xpAmounts: "array", endless: "boolean", locationTag: "string", isVault: "boolean", requiredItems: "array", useRequiredItemsAsMiscItemFee: "boolean" }, `${path}.${key}.${j}`, warnings);
          if (Array.isArray(v.xpAmounts) && v.xpAmounts.some((amount) => typeof amount !== "number" || !Number.isFinite(amount))) warnings.add(`INVALID_FIELD:${path}.${key}.${j}.xpAmounts:number[]`);
          return v;
        });
      }
    }
    const extra = Object.fromEntries(Object.entries(entry).filter(([k]) => k !== "_id" && !own(schema, k)).map(([k, v]) => [k, payload(v, `${path}.${k}`, warnings)]));
    if (Object.keys(extra).length) {
      item.extra = extra;
      for (const key of Object.keys(extra)) warnings.add(`${prefix}_UNMODELED_FIELD:${key}`);
    }
    data.push(item);
  }
  const lossy = hasStructuralWarnings(warnings);
  return { ...base, status: lossy ? "partial" : "ok", lossy, data, warnings: [...warnings] };
}

const dates = { Activation: ["activation", "date"], Expiry: ["expiry", "date"] };

export function normalizeAlerts(raw, options = {}) {
  return normalize(raw, options, "Alerts", { ...dates, Tag: ["tag", "string"], MissionInfo: ["mission", "mission"] }, ["Activation", "Expiry", "MissionInfo"]);
}

export function normalizeInvasions(raw, options = {}) {
  return normalize(raw, options, "Invasions", {
    Activation: ["activation", "date"], Node: ["node", "node"], Faction: ["attackerFaction", "faction"], DefenderFaction: ["defenderFaction", "faction"],
    Count: ["count", "number"], Goal: ["goal", "number"], LocTag: ["descriptionKey", "string"], Completed: ["completed", "boolean"], ChainID: ["chainId", "id"],
    AttackerReward: ["attackerReward", "reward"], DefenderReward: ["defenderReward", "reward"], AttackerMissionInfo: ["attackerMission", "mission"], DefenderMissionInfo: ["defenderMission", "mission"],
  }, ["Activation", "Node", "Faction", "DefenderFaction", "Count", "Goal", "Completed"]);
}

export function normalizeSyndicateMissions(raw, options = {}) {
  return normalize(raw, options, "SyndicateMissions", { ...dates, Tag: ["tag", "string"], Seed: ["seed", "number"], Nodes: ["nodes", "array"], Jobs: ["jobs", "array"] }, ["Activation", "Expiry", "Tag", "Nodes"]);
}

export function normalizeGoals(raw, options = {}) {
  return normalize(raw, options, "Goals", {
    ...dates, Tag: ["tag", "string"], Node: ["node", "node"], VictimNode: ["victimNode", "node"], Faction: ["faction", "faction"],
    Count: ["count", "number"], Goal: ["goal", "number"], HealthPct: ["healthPct", "number"], Success: ["success", "number"], RegionIdx: ["region", "number"], Regions: ["regions", "array"],
    Fomorian: ["fomorian", "boolean"], Personal: ["personal", "boolean"], Best: ["best", "boolean"], ScoreTagBlocksGuildTierChanges: ["scoreTagBlocksGuildTierChanges", "boolean"],
    ScoreVar: ["scoreVar", "string"], ScoreMaxTag: ["scoreMaxTag", "string"], ScoreLocTag: ["scoreDescriptionKey", "string"], Desc: ["descriptionKey", "string"], ToolTip: ["tooltipKey", "string"], Icon: ["icon", "string"],
    RegionDrops: ["regionDrops", "array"], ArchwingDrops: ["archwingDrops", "array"], Reward: ["reward", "reward"], MissionInfo: ["mission", "mission"], ContinuousHubEvent: ["continuousHubEvent", "object"],
    JobAffiliationTag: ["jobAffiliationTag", "string"], JobCurrentVersion: ["jobCurrentVersion", "id"], JobPreviousVersion: ["jobPreviousVersion", "id"], Jobs: ["jobs", "array"], PreviousJobs: ["previousJobs", "array"],
    Transmission: ["transmission", "string"], InstructionalItem: ["instructionalItem", "string"],
  }, ["Activation", "Expiry"]);
}

export function normalizeGlobalUpgrades(raw, options = {}) {
  return normalize(raw, options, "GlobalUpgrades", {
    Activation: ["activation", "date"], ExpiryDate: ["expiry", "date"], UpgradeType: ["upgradeType", "string"], OperationType: ["operationType", "string"], Value: ["value", "number"], LocalizeTag: ["nameKey", "string"], LocalizeDescTag: ["descriptionKey", "string"], Nodes: ["nodes", "array"],
  }, ["Activation", "ExpiryDate", "UpgradeType", "OperationType", "Value"], false);
}

export function normalizeNodeOverrides(raw, options = {}) {
  return normalize(raw, options, "NodeOverrides", {
    ...dates, Node: ["node", "node"], Hide: ["hide", "boolean"], Seed: ["seed", "number"], LevelOverride: ["levelOverride", "string"], ExtraEnemySpec: ["extraEnemySpec", "string"], CustomNpcEncounters: ["customNpcEncounters", "array"],
  }, ["Node"]);
}

/** Both supplied snapshots are empty: nonempty records remain explicitly unmodeled. */
export function normalizePersistentEnemies(raw, options = {}) {
  const result = normalize(raw, options, "PersistentEnemies", {}, [], false);
  if (Array.isArray(raw?.PersistentEnemies) && raw.PersistentEnemies.length) {
    result.status = "partial";
    result.lossy = true;
    result.warnings.push("PERSISTENT_ENEMIES_SCHEMA_UNOBSERVED_IN_SNAPSHOTS");
  }
  return result;
}

export function normalizeVoidStorms(raw, options = {}) {
  return normalize(raw, options, "VoidStorms", { ...dates, MissionType:["missionType","missionType"], Node: ["node", "node"], ActiveMissionTier: ["tier", "tier"] }, ["Activation", "Expiry", "Node", "ActiveMissionTier"]);
}
