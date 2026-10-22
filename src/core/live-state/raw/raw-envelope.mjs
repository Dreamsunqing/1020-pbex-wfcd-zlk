export function toIsoFromEpochSeconds(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const date = new Date(value * 1000);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function extractRawEnvelope(raw) {
  return Object.freeze({
    version: raw.Version,
    mobileVersion: raw.MobileVersion ?? null,
    buildLabel: raw.BuildLabel,
    sourceTime: toIsoFromEpochSeconds(raw.Time),
    worldSeed: raw.WorldSeed ?? null,
    topLevelKeyCount: Object.keys(raw).length,
    topLevelKeys: Object.keys(raw),
  });
}
