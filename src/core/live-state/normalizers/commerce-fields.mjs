import { readExtendedJsonDate } from "../raw/extended-json.mjs";

const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
// A descriptor is [DTO key, type, required]. Optional scalars are explicitly null.
const str = (key, required = true) => [key, "string", required];
const num = (key, required = true) => [key, "number", required];
const bool = (key, required = false) => [key, "boolean", required];
const date = (key, required = true) => [key, "date", required];
const list = (key, type, required = true) => [key, { list: type }, required];
const manifest = {
  ItemType: str("itemType"), PrimePrice: num("primePrice", false),
  RegularPrice: num("regularPrice", false), Ducats: num("ducats", false),
  RegularCredits: num("regularCredits", false),
};
const trader = {
  _id: ["id", "id", true], Activation: date("startsAt"), Expiry: date("endsAt"),
  Character: str("character", false), Node: str("node"),
  Manifest: list("manifest", manifest, false),
};
const schemas = {
  VoidTraders: { list: trader },
  PrimeVaultTraders: { list: {
    ...trader, InitialStartDate: date("initialStartsAt"), Manifest: list("manifest", manifest),
    EvergreenManifest: list("evergreenManifest", manifest),
    ScheduleInfo: list("schedule", {
      Expiry: date("endsAt"), PreviewHiddenUntil: date("previewHiddenUntil", false),
      FeaturedItem: str("featuredItem", false),
    }),
  } },
  DailyDeals: { list: {
    StoreItem: str("itemType"), Activation: date("startsAt"), Expiry: date("endsAt"),
    Discount: num("discount"), OriginalPrice: num("originalPrice"), SalePrice: num("salePrice"),
    AmountTotal: num("amountTotal"), AmountSold: num("amountSold"),
  } },
  FlashSales: { list: {
    TypeName: str("itemType"), StartDate: date("startsAt"), EndDate: date("endsAt"),
    Discount: num("discount", false), PremiumOverride: num("premiumOverride", false),
    ShowInMarket: bool("showInMarket"), HideFromMarket: bool("hideFromMarket"),
    DailySaleGenerated: bool("dailySaleGenerated"), UrlOverride: str("urlOverride", false),
  } },
  InGameMarket: {
    LandingPage: ["landingPage", {
      Categories: list("categories", {
        CategoryName: str("categoryKey"), Name: str("nameKey"), Icon: str("icon"),
        Items: list("items", "string"), AddToMenu: bool("addToMenu"),
      }),
    }, true],
  },
  PrimeAccessAvailability: { State: str("state") },
  WeeklyVaultBonusRewards: { list: {
    WeekCount: num("weekCount"), BonusRegion: str("bonusRegionKey"),
    Rewards: list("rewards", {
      RewardClaimed: bool("claimed", true), PointThreshold: num("pointThreshold"),
      ItemCount: num("itemCount"), Reward: str("itemType"),
    }),
  } },
  Conquests: { list: {
    Activation: date("startsAt"), Expiry: date("endsAt"), Type: str("type"),
    Missions: list("missions", {
      faction: str("faction"), missionType: str("missionType"),
      difficulties: list("difficulties", {
        type: str("type"), deviation: str("deviation"), risks: list("risks", "string"),
      }),
    }), Variables: list("variables", "string"), RandomSeed: num("randomSeed"),
  } },
  ConstructionProjects: { list: {
    Tag: str("tag"), Node: str("node"), Activation: date("startsAt"),
    Expiry: date("endsAt", false), Tasks: list("tasks", "string"),
    ToolTips: list("tooltipKeys", "string"), HunterBoostTask: str("hunterBoostTask", false),
  } },
  ProjectPct: { list: "number" },
};

function decode(value, type, path, warnings) {
  if (object(type) && own(type, "list")) {
    if (!Array.isArray(value)) {
      warnings.push(`INVALID_ARRAY:${path}`);
      return [];
    }
    return value.map((entry, index) => decode(entry, type.list, `${path}[${index}]`, warnings));
  }
  if (object(type)) {
    if (!object(value)) {
      warnings.push(`INVALID_OBJECT:${path}`);
      return null;
    }
    const dto = {};
    for (const [rawKey, [key, childType, required]] of Object.entries(type)) {
      if (!own(value, rawKey)) {
        if (required) warnings.push(`MISSING_FIELD:${path}.${rawKey}`);
        dto[key] = object(childType) && own(childType, "list") ? [] : null;
      } else dto[key] = decode(value[rawKey], childType, `${path}.${rawKey}`, warnings);
    }
    const unknown = Object.keys(value).filter((key) => !own(type, key));
    if (unknown.length) {
      // Preserve vendor additions instead of silently discarding fields.
      dto.extensions = Object.fromEntries(unknown.map((key) => [key, value[key]]));
      warnings.push(`UNMAPPED_FIELDS:${path}:${unknown.join(",")}`);
    }
    return dto;
  }
  let valid = false;
  let result = value;
  if (type === "date") {
    result = readExtendedJsonDate(value);
    valid = result !== null;
  } else if (type === "id") {
    result = typeof value === "string" ? value : value?.$oid;
    valid = typeof result === "string" && result.length > 0;
  } else if (type === "number") valid = typeof value === "number" && Number.isFinite(value);
  else if (type === "string") valid = typeof value === "string" && value.length > 0;
  else valid = typeof value === type;
  if (valid) return result;
  warnings.push(`INVALID_${type.toUpperCase()}:${path}`);
  return null;
}

function normalize(raw, field, { server } = {}) {
  if (server !== "de" && server !== "wg") throw new Error(`Commerce normalizer 不支持服务器: ${server}`);
  const source = `${server}-world-state`;
  if (!own(raw ?? {}, field)) return {
    status: "error", source, lossy: false, data: null, warnings: [`RAW_${field.toUpperCase()}_MISSING`],
  };
  const type = schemas[field];
  if (own(type, "list") ? !Array.isArray(raw[field]) : !object(raw[field])) return {
    status: "error", source, lossy: false, data: null,
    warnings: [`RAW_${field.toUpperCase()}_IS_NOT_${own(type, "list") ? "ARRAY" : "OBJECT"}`],
  };
  const warnings = [];
  const data = decode(raw[field], type, field, warnings);
  return { status: warnings.length ? "partial" : "ok", source, lossy: warnings.length > 0, data, warnings };
}

export const normalizeVoidTraders = (raw, options) => normalize(raw, "VoidTraders", options);
export const normalizePrimeVaultTraders = (raw, options) => normalize(raw, "PrimeVaultTraders", options);
export const normalizeDailyDeals = (raw, options) => normalize(raw, "DailyDeals", options);
export const normalizeFlashSales = (raw, options) => normalize(raw, "FlashSales", options);
export const normalizeInGameMarket = (raw, options) => normalize(raw, "InGameMarket", options);
export const normalizePrimeAccessAvailability = (raw, options) => normalize(raw, "PrimeAccessAvailability", options);
export const normalizeWeeklyVaultBonusRewards = (raw, options) => normalize(raw, "WeeklyVaultBonusRewards", options);
export const normalizeConquests = (raw, options) => normalize(raw, "Conquests", options);
export const normalizeConstructionProjects = (raw, options) => normalize(raw, "ConstructionProjects", options);
export const normalizeProjectPct = (raw, options) => normalize(raw, "ProjectPct", options);
