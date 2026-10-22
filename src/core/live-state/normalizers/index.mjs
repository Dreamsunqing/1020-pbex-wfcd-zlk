import { normalizeArchonHunts } from "./archon-hunt.mjs";
import {
  normalizeConquests,
  normalizeConstructionProjects,
  normalizeDailyDeals,
  normalizeFlashSales,
  normalizeInGameMarket,
  normalizePrimeAccessAvailability,
  normalizePrimeVaultTraders,
  normalizeProjectPct,
  normalizeVoidTraders,
  normalizeWeeklyVaultBonusRewards,
} from "./commerce-fields.mjs";
import { normalizeCycles } from "./cycles.mjs";
import { normalizeEvents } from "./events.mjs";
import { normalizeFissures } from "./fissures.mjs";
import {
  normalizeAlerts,
  normalizeGlobalUpgrades,
  normalizeGoals,
  normalizeInvasions,
  normalizeNodeOverrides,
  normalizePersistentEnemies,
  normalizeSyndicateMissions,
  normalizeVoidStorms,
} from "./gameplay-fields.mjs";
import {
  normalizeDescents,
  normalizeEndlessXpSchedule,
  normalizeExperimentRecommended,
  normalizeFeaturedGuilds,
  normalizeHubEvents,
  normalizeKnownCalendarSeasons,
  normalizeLibraryInfo,
  normalizePVPActiveTournaments,
  normalizePVPAlternativeModes,
  normalizePVPChallengeInstances,
  normalizeSeasonInfo,
  normalizeSkuSales,
  normalizeTwitchPromos,
} from "./season-social-fields.mjs";
import { normalizeSorties } from "./sorties.mjs";
import {
  normalizeBountyMissions,
  normalizeSyndicateStandingMissions,
} from "./syndicate-projections.mjs";
import {
  normalizeBuildLabel,
  normalizeForceLogoutVersion,
  normalizeMobileVersion,
  normalizeSourceTime,
  normalizeTemporaryConfig,
  normalizeWorldSeed,
  normalizeWorldStateVersion,
} from "./system-fields.mjs";

export {
  normalizeAlerts,
  normalizeArchonHunts,
  normalizeBuildLabel,
  normalizeBountyMissions,
  normalizeConquests,
  normalizeConstructionProjects,
  normalizeCycles,
  normalizeDailyDeals,
  normalizeDescents,
  normalizeEndlessXpSchedule,
  normalizeEvents,
  normalizeExperimentRecommended,
  normalizeFeaturedGuilds,
  normalizeFissures,
  normalizeFlashSales,
  normalizeForceLogoutVersion,
  normalizeGlobalUpgrades,
  normalizeGoals,
  normalizeHubEvents,
  normalizeInGameMarket,
  normalizeInvasions,
  normalizeKnownCalendarSeasons,
  normalizeLibraryInfo,
  normalizeMobileVersion,
  normalizeNodeOverrides,
  normalizePersistentEnemies,
  normalizePrimeAccessAvailability,
  normalizePrimeVaultTraders,
  normalizeProjectPct,
  normalizePVPActiveTournaments,
  normalizePVPAlternativeModes,
  normalizePVPChallengeInstances,
  normalizeSeasonInfo,
  normalizeSkuSales,
  normalizeSorties,
  normalizeSourceTime,
  normalizeSyndicateMissions,
  normalizeSyndicateStandingMissions,
  normalizeTemporaryConfig,
  normalizeTwitchPromos,
  normalizeVoidStorms,
  normalizeVoidTraders,
  normalizeWeeklyVaultBonusRewards,
  normalizeWorldSeed,
  normalizeWorldStateVersion,
};

export {
  isLocalizedModuleLanguageSupported,
  LOCALIZED_MODULE_LANGUAGES,
} from "../localization/static-worldstate-resolver.mjs";

/** 官方 world-state 顶层字段到公共 API 模块的一对一覆盖表。 */
export const RAW_FIELD_MODULES = Object.freeze({
  ActiveMissions: "fissures",
  Alerts: "alerts",
  BuildLabel: "buildLabel",
  Conquests: "conquests",
  ConstructionProjects: "constructionProjects",
  DailyDeals: "dailyDeals",
  Descents: "descents",
  EndlessXpSchedule: "endlessXpSchedule",
  Events: "events",
  ExperimentRecommended: "experimentRecommended",
  FeaturedGuilds: "featuredGuilds",
  FlashSales: "flashSales",
  ForceLogoutVersion: "forceLogoutVersion",
  GlobalUpgrades: "globalUpgrades",
  Goals: "goals",
  HubEvents: "hubEvents",
  InGameMarket: "inGameMarket",
  Invasions: "invasions",
  KnownCalendarSeasons: "knownCalendarSeasons",
  LibraryInfo: "libraryInfo",
  LiteSorties: "archonHunt",
  MobileVersion: "mobileVersion",
  NodeOverrides: "nodeOverrides",
  PVPActiveTournaments: "pvpActiveTournaments",
  PVPAlternativeModes: "pvpAlternativeModes",
  PVPChallengeInstances: "pvpChallengeInstances",
  PersistentEnemies: "persistentEnemies",
  PrimeAccessAvailability: "primeAccessAvailability",
  PrimeVaultTraders: "primeVaultTraders",
  ProjectPct: "projectPct",
  SeasonInfo: "seasonInfo",
  SkuSales: "skuSales",
  Sorties: "sortie",
  SyndicateMissions: "syndicateMissions",
  Time: "sourceTime",
  Tmp: "temporaryConfig",
  TwitchPromos: "twitchPromos",
  Version: "worldStateVersion",
  VoidStorms: "voidStorms",
  VoidTraders: "voidTraders",
  WeeklyVaultBonusRewards: "weeklyVaultBonusRewards",
  WorldSeed: "worldSeed",
});

/** 已实现模块到 normalizer 的注册表，由服务统一执行并隔离异常。 */
export const IMPLEMENTED_MODULE_NORMALIZERS = Object.freeze({
  alerts: normalizeAlerts,
  archonHunt: normalizeArchonHunts,
  bountyMissions: normalizeBountyMissions,
  buildLabel: normalizeBuildLabel,
  conquests: normalizeConquests,
  constructionProjects: normalizeConstructionProjects,
  cycles: normalizeCycles,
  dailyDeals: normalizeDailyDeals,
  descents: normalizeDescents,
  endlessXpSchedule: normalizeEndlessXpSchedule,
  events: normalizeEvents,
  experimentRecommended: normalizeExperimentRecommended,
  featuredGuilds: normalizeFeaturedGuilds,
  fissures: normalizeFissures,
  flashSales: normalizeFlashSales,
  forceLogoutVersion: normalizeForceLogoutVersion,
  globalUpgrades: normalizeGlobalUpgrades,
  goals: normalizeGoals,
  hubEvents: normalizeHubEvents,
  inGameMarket: normalizeInGameMarket,
  invasions: normalizeInvasions,
  knownCalendarSeasons: normalizeKnownCalendarSeasons,
  libraryInfo: normalizeLibraryInfo,
  mobileVersion: normalizeMobileVersion,
  nodeOverrides: normalizeNodeOverrides,
  persistentEnemies: normalizePersistentEnemies,
  primeAccessAvailability: normalizePrimeAccessAvailability,
  primeVaultTraders: normalizePrimeVaultTraders,
  projectPct: normalizeProjectPct,
  pvpActiveTournaments: normalizePVPActiveTournaments,
  pvpAlternativeModes: normalizePVPAlternativeModes,
  pvpChallengeInstances: normalizePVPChallengeInstances,
  seasonInfo: normalizeSeasonInfo,
  skuSales: normalizeSkuSales,
  sortie: normalizeSorties,
  sourceTime: normalizeSourceTime,
  syndicateMissions: normalizeSyndicateMissions,
  syndicateStandingMissions: normalizeSyndicateStandingMissions,
  temporaryConfig: normalizeTemporaryConfig,
  twitchPromos: normalizeTwitchPromos,
  voidStorms: normalizeVoidStorms,
  voidTraders: normalizeVoidTraders,
  weeklyVaultBonusRewards: normalizeWeeklyVaultBonusRewards,
  worldSeed: normalizeWorldSeed,
  worldStateVersion: normalizeWorldStateVersion,
});

/** 所有已实现模块都可能补充语义名称；DE 可选语言，WG 固定中文。 */
export const LOCALIZED_MODULE_NAMES = Object.freeze(
  Object.keys(IMPLEMENTED_MODULE_NORMALIZERS),
);

/** 已实现但不对应单一 raw 顶层字段的派生模块。 */
export const IMPLEMENTED_DERIVED_MODULES = Object.freeze([
  "bountyMissions",
  "cycles",
  "syndicateStandingMissions",
]);

/** 非 raw 派生模块仍保留扩展位，不影响 42 个官方字段的覆盖率。 */
export const FUTURE_DERIVED_MODULES = Object.freeze([
  "calendar",
  "constructionProgress",
  "nightwave",
  "steelPath",
  "voidTrader",
]);

export const PLANNED_MODULES = Object.freeze([
  ...Object.keys(IMPLEMENTED_MODULE_NORMALIZERS),
  ...FUTURE_DERIVED_MODULES,
]);

/** 为已实现但未取到 raw、以及尚未实现的派生模块建立不同占位。 */
export function createUnimplementedModules() {
  return {
    ...Object.fromEntries(
      Object.keys(IMPLEMENTED_MODULE_NORMALIZERS).map((name) => [
        name,
        {
          status: "initializing",
          source: null,
          lossy: false,
          data: null,
          warnings: ["NO_RAW_SNAPSHOT_AVAILABLE"],
        },
      ]),
    ),
    ...Object.fromEntries(
      FUTURE_DERIVED_MODULES.map((name) => [
      name,
      {
        status: "initializing",
        source: null,
        lossy: false,
        data: null,
        warnings: ["NORMALIZER_NOT_IMPLEMENTED"],
      },
      ]),
    ),
  };
}
