import {
  createStaticLocalizationContext,
  hasStructuralWarnings,
  localizeFissureModifier,
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
    warnings.add(`FISSURE_MISSING_DATE:${id}:${rawField}`);
    return null;
  }

  const value = readExtendedJsonDate(entry[rawField]);
  if (value === null) warnings.add(`FISSURE_INVALID_DATE:${id}:${rawField}`);
  return value;
}

function readString(value, warning, warnings) {
  if (typeof value === "string") return value;
  warnings.add(warning);
  return null;
}

function readInteger(value, warning, warnings) {
  if (Number.isSafeInteger(value)) return value;
  warnings.add(warning);
  return null;
}

function readHardFlag(entry, id, warnings) {
  if (!hasOwn(entry, "Hard")) return false;
  if (typeof entry.Hard === "boolean") return entry.Hard;
  warnings.add(`FISSURE_INVALID_HARD_FLAG:${id}`);
  return false;
}

function normalizeFissure(entry, context, warnings) {
  const id = readObjectId(entry?._id);
  if (!id) {
    warnings.add("FISSURE_WITHOUT_ID_SKIPPED");
    return null;
  }

  const nodeKey = readString(
    entry.Node,
    `FISSURE_INVALID_NODE:${id}`,
    warnings,
  );
  const missionTypeKey = readString(
    entry.MissionType,
    `FISSURE_INVALID_MISSION_TYPE:${id}`,
    warnings,
  );
  const modifierKey = readString(
    entry.Modifier,
    `FISSURE_INVALID_MODIFIER:${id}`,
    warnings,
  );

  return {
    id,
    activation: readRequiredDate(entry, "Activation", id, warnings),
    expiry: readRequiredDate(entry, "Expiry", id, warnings),
    region: readInteger(
      entry.Region,
      `FISSURE_INVALID_REGION:${id}`,
      warnings,
    ),
    seed: readInteger(entry.Seed, `FISSURE_INVALID_SEED:${id}`, warnings),
    node: localizeStaticKey(nodeKey, "nodes", context, warnings),
    missionType: localizeStaticKey(
      missionTypeKey,
      "missionTypes",
      context,
      warnings,
    ),
    modifier: localizeFissureModifier(modifierKey, context, warnings),
    isHard: readHardFlag(entry, id, warnings),
  };
}

export function normalizeFissures(raw, options = {}) {
  const server = options.server;
  if (server !== "de" && server !== "wg") {
    throw new Error(`Fissures normalizer 不支持服务器: ${server}`);
  }

  const context = createStaticLocalizationContext(options, "FISSURE");
  if (!context) {
    return {
      status: "error",
      source: `${server}-world-state`,
      lossy: false,
      languageCode: options.language ?? null,
      data: null,
      warnings: [`FISSURE_UNSUPPORTED_LANGUAGE:${options.language ?? "null"}`],
    };
  }

  if (!Array.isArray(raw?.ActiveMissions)) {
    return {
      status: "error",
      source: `${server}-world-state`,
      lossy: false,
      languageCode: context.language,
      data: null,
      warnings: ["RAW_ACTIVE_MISSIONS_IS_NOT_ARRAY"],
    };
  }

  const warnings = new Set();
  const data = raw.ActiveMissions
    .map((entry) => normalizeFissure(entry, context, warnings))
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
