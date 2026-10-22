import {
  createStaticLocalizationContext,
  hasStructuralWarnings,
  isLocalizedModuleLanguageSupported,
  LOCALIZED_MODULE_LANGUAGES,
  localizeBoss,
  localizeSortieModifier,
  localizeStaticKey,
} from "../localization/static-worldstate-resolver.mjs";
import { readExtendedJsonDate } from "../raw/extended-json.mjs";

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

export const SORTIE_LANGUAGES = LOCALIZED_MODULE_LANGUAGES;
export const isSortieLanguageSupported = isLocalizedModuleLanguageSupported;

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

function readRequiredDate(sortie, rawField, id, warnings) {
  if (!hasOwn(sortie, rawField)) {
    warnings.add(`SORTIE_MISSING_DATE:${id}:${rawField}`);
    return null;
  }

  const value = readExtendedJsonDate(sortie[rawField]);
  if (value === null) warnings.add(`SORTIE_INVALID_DATE:${id}:${rawField}`);
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
  warnings.add(`SORTIE_INVALID_SEED:${id}`);
  return null;
}

function readExtraDropKeys(value, id, warnings) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    warnings.add(`SORTIE_INVALID_EXTRA_DROPS:${id}`);
    return [];
  }

  const valid = value.filter((entry) => typeof entry === "string");
  if (valid.length !== value.length) {
    warnings.add(`SORTIE_INVALID_EXTRA_DROP_SKIPPED:${id}`);
  }
  return valid;
}

function normalizeMission(variant, index, sortieId, context, warnings) {
  if (!variant || typeof variant !== "object" || Array.isArray(variant)) {
    warnings.add(`SORTIE_INVALID_MISSION_SKIPPED:${sortieId}:${index + 1}`);
    return null;
  }

  const missionTypeKey = readString(
    variant.missionType,
    `SORTIE_INVALID_MISSION_TYPE:${sortieId}:${index + 1}`,
    warnings,
  );
  const modifierKey = readString(
    variant.modifierType,
    `SORTIE_INVALID_MODIFIER:${sortieId}:${index + 1}`,
    warnings,
  );
  const nodeKey = readString(
    variant.node,
    `SORTIE_INVALID_NODE:${sortieId}:${index + 1}`,
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
    modifier: localizeSortieModifier(modifierKey, context, warnings),
    tilesetKey: readString(
      variant.tileset,
      `SORTIE_INVALID_TILESET:${sortieId}:${index + 1}`,
      warnings,
    ),
  };
}

function normalizeSortie(sortie, context, warnings) {
  const id = readObjectId(sortie?._id);
  if (!id) {
    warnings.add("SORTIE_WITHOUT_ID_SKIPPED");
    return null;
  }

  const bossKey = readString(
    sortie.Boss,
    `SORTIE_INVALID_BOSS:${id}`,
    warnings,
  );
  const variants = Array.isArray(sortie.Variants) ? sortie.Variants : [];
  if (!Array.isArray(sortie.Variants)) {
    warnings.add(`SORTIE_VARIANTS_IS_NOT_ARRAY:${id}`);
  }

  return {
    id,
    activation: readRequiredDate(sortie, "Activation", id, warnings),
    expiry: readRequiredDate(sortie, "Expiry", id, warnings),
    rewardKey: readString(
      sortie.Reward,
      `SORTIE_INVALID_REWARD:${id}`,
      warnings,
    ),
    seed: readSeed(sortie.Seed, id, warnings),
    boss: localizeBoss(bossKey, context, warnings),
    extraDropKeys: readExtraDropKeys(sortie.ExtraDrops, id, warnings),
    missions: variants
      .map((variant, index) =>
        normalizeMission(variant, index, id, context, warnings),
      )
      .filter(Boolean),
  };
}

export function normalizeSorties(raw, options = {}) {
  const server = options.server;
  if (server !== "de" && server !== "wg") {
    throw new Error(`Sorties normalizer 不支持服务器: ${server}`);
  }

  const context = createStaticLocalizationContext(options, "SORTIE");
  if (!context) {
    return {
      status: "error",
      source: `${server}-world-state`,
      lossy: false,
      languageCode: options.language ?? null,
      data: null,
      warnings: [`SORTIE_UNSUPPORTED_LANGUAGE:${options.language ?? "null"}`],
    };
  }

  if (!Array.isArray(raw?.Sorties)) {
    return {
      status: "error",
      source: `${server}-world-state`,
      lossy: false,
      languageCode: context.language,
      data: null,
      warnings: ["RAW_SORTIES_IS_NOT_ARRAY"],
    };
  }

  const warnings = new Set();
  const data = raw.Sorties
    .map((sortie) => normalizeSortie(sortie, context, warnings))
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
