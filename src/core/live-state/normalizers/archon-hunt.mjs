import {
  createStaticLocalizationContext,
  hasStructuralWarnings,
  localizeBoss,
  localizeStaticKey,
} from "../localization/static-worldstate-resolver.mjs";
import { readExtendedJsonDate } from "../raw/extended-json.mjs";

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

function readObjectId(value) {
  if (typeof value === "string" && value.length > 0) return value;
  if (
    value &&
    typeof value === "object" &&
    typeof value.$oid === "string" &&
    value.$oid.length > 0
  ) {
    return value.$oid;
  }
  return null;
}

function readRequiredDate(entry, rawField, id, warnings) {
  if (!hasOwn(entry, rawField)) {
    warnings.add(`ARCHON_HUNT_MISSING_DATE:${id}:${rawField}`);
    return null;
  }

  const value = readExtendedJsonDate(entry[rawField]);
  if (value === null) {
    warnings.add(`ARCHON_HUNT_INVALID_DATE:${id}:${rawField}`);
  }
  return value;
}

function readString(value, warning, warnings) {
  if (typeof value === "string") return value;
  warnings.add(warning);
  return null;
}

function readSeed(value, id, warnings) {
  if (value === undefined) return null;
  if (Number.isSafeInteger(value)) return value;
  warnings.add(`ARCHON_HUNT_INVALID_SEED:${id}`);
  return null;
}

function normalizeMission(mission, index, huntId, context, warnings) {
  if (!mission || typeof mission !== "object" || Array.isArray(mission)) {
    warnings.add(`ARCHON_HUNT_INVALID_MISSION_SKIPPED:${huntId}:${index + 1}`);
    return null;
  }

  const missionTypeKey = readString(
    mission.missionType,
    `ARCHON_HUNT_INVALID_MISSION_TYPE:${huntId}:${index + 1}`,
    warnings,
  );
  const nodeKey = readString(
    mission.node,
    `ARCHON_HUNT_INVALID_NODE:${huntId}:${index + 1}`,
    warnings,
  );

  return {
    sequence: index + 1,
    node: localizeStaticKey(nodeKey, "nodes", context, warnings),
    missionType: localizeStaticKey(
      missionTypeKey,
      "missionTypes",
      context,
      warnings,
    ),
  };
}

function normalizeArchonHunt(entry, context, warnings) {
  const id = readObjectId(entry?._id);
  if (!id) {
    warnings.add("ARCHON_HUNT_WITHOUT_ID_SKIPPED");
    return null;
  }

  const bossKey = readString(
    entry.Boss,
    `ARCHON_HUNT_INVALID_BOSS:${id}`,
    warnings,
  );
  const missions = Array.isArray(entry.Missions) ? entry.Missions : [];
  if (!Array.isArray(entry.Missions)) {
    warnings.add(`ARCHON_HUNT_MISSIONS_IS_NOT_ARRAY:${id}`);
  }

  return {
    id,
    activation: readRequiredDate(entry, "Activation", id, warnings),
    expiry: readRequiredDate(entry, "Expiry", id, warnings),
    rewardKey: readString(
      entry.Reward,
      `ARCHON_HUNT_INVALID_REWARD:${id}`,
      warnings,
    ),
    seed: readSeed(entry.Seed, id, warnings),
    boss: localizeBoss(bossKey, context, warnings),
    missions: missions
      .map((mission, index) =>
        normalizeMission(mission, index, id, context, warnings),
      )
      .filter(Boolean),
  };
}

export function normalizeArchonHunts(raw, options = {}) {
  const server = options.server;
  if (server !== "de" && server !== "wg") {
    throw new Error(`Archon Hunt normalizer 不支持服务器: ${server}`);
  }

  const context = createStaticLocalizationContext(options, "ARCHON_HUNT");
  if (!context) {
    return {
      status: "error",
      source: `${server}-world-state`,
      lossy: false,
      languageCode: options.language ?? null,
      data: null,
      warnings: [
        `ARCHON_HUNT_UNSUPPORTED_LANGUAGE:${options.language ?? "null"}`,
      ],
    };
  }

  if (!Array.isArray(raw?.LiteSorties)) {
    return {
      status: "error",
      source: `${server}-world-state`,
      lossy: false,
      languageCode: context.language,
      data: null,
      warnings: ["RAW_LITE_SORTIES_IS_NOT_ARRAY"],
    };
  }

  const warnings = new Set();
  const data = raw.LiteSorties
    .map((entry) => normalizeArchonHunt(entry, context, warnings))
    .filter(Boolean);
  const lossy = hasStructuralWarnings(warnings);

  return {
    status: lossy ? "partial" : "ok",
    source: `${server}-world-state`,
    lossy,
    languageCode: context.language,
    data,
    warnings: [...warnings],
  };
}
