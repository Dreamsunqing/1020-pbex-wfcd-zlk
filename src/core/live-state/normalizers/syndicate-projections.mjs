import { normalizeSyndicateMissions } from './gameplay-fields.mjs';
// Live jobs come from the selected server. No DE-only seeded rules are applied to WG.
function project(raw, options, jobs) {
  const result = normalizeSyndicateMissions(raw, options);
  return { ...result, data: result.data?.filter(row => jobs ? row.jobs?.length : row.nodes?.length) ?? null };
}
export const normalizeBountyMissions = (raw, options) => project(raw, options, true);
export const normalizeSyndicateStandingMissions = (raw, options) => project(raw, options, false);
