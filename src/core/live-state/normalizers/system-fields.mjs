import { toIsoFromEpochSeconds } from "../raw/raw-envelope.mjs";

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

/** 校验 normalizer 支持的服务器并返回对应 Provider 标识。 */
function providerSource(server) {
  if (server !== "de" && server !== "wg") {
    throw new Error(`System field normalizer 不支持服务器: ${server}`);
  }
  return `${server}-world-state`;
}

/** 构造单个 raw 顶层字段的统一模块结果。 */
function moduleResult(server, data, warnings, status = null) {
  const resolvedStatus = status ?? (warnings.length > 0 ? "partial" : "ok");
  return {
    status: resolvedStatus,
    source: providerSource(server),
    lossy: resolvedStatus === "partial",
    data,
    warnings,
  };
}

/** 在顶层字段缺失时返回 error，避免把缺失误报为有效空值。 */
function missingFieldResult(server, rawField) {
  return moduleResult(
    server,
    null,
    [`RAW_${rawField.toUpperCase()}_MISSING`],
    "error",
  );
}

/** 解析构建标签，并保留未解释的完整原值。 */
export function normalizeBuildLabel(raw, options = {}) {
  const server = options.server;
  providerSource(server);
  if (!hasOwn(raw ?? {}, "BuildLabel")) {
    return missingFieldResult(server, "BuildLabel");
  }

  if (typeof raw.BuildLabel !== "string" || raw.BuildLabel.length === 0) {
    return moduleResult(
      server,
      { label: null, timestampLabel: null, buildId: null },
      ["BUILD_LABEL_INVALID"],
    );
  }

  const separator = raw.BuildLabel.indexOf("/");
  return moduleResult(
    server,
    {
      label: raw.BuildLabel,
      timestampLabel:
        separator >= 0 ? raw.BuildLabel.slice(0, separator) : raw.BuildLabel,
      buildId: separator >= 0 ? raw.BuildLabel.slice(separator + 1) || null : null,
    },
    separator >= 0 ? [] : ["BUILD_LABEL_HAS_NO_BUILD_ID"],
  );
}

/** 解析强制登出协议版本号。 */
export function normalizeForceLogoutVersion(raw, options = {}) {
  const server = options.server;
  providerSource(server);
  if (!hasOwn(raw ?? {}, "ForceLogoutVersion")) {
    return missingFieldResult(server, "ForceLogoutVersion");
  }

  const valid = Number.isSafeInteger(raw.ForceLogoutVersion);
  return moduleResult(
    server,
    { version: valid ? raw.ForceLogoutVersion : null },
    valid ? [] : ["FORCE_LOGOUT_VERSION_INVALID"],
  );
}

/** 解析官方移动端客户端版本字符串。 */
export function normalizeMobileVersion(raw, options = {}) {
  const server = options.server;
  providerSource(server);
  if (!hasOwn(raw ?? {}, "MobileVersion")) {
    return missingFieldResult(server, "MobileVersion");
  }

  const valid = typeof raw.MobileVersion === "string";
  return moduleResult(
    server,
    { version: valid ? raw.MobileVersion : null },
    valid ? [] : ["MOBILE_VERSION_INVALID"],
  );
}

/** 解析上游 epoch 秒时间，同时返回原始秒值和 UTC ISO 时间。 */
export function normalizeSourceTime(raw, options = {}) {
  const server = options.server;
  providerSource(server);
  if (!hasOwn(raw ?? {}, "Time")) return missingFieldResult(server, "Time");

  const timestamp = toIsoFromEpochSeconds(raw.Time);
  const valid = timestamp !== null;
  return moduleResult(
    server,
    {
      epochSeconds:
        typeof raw.Time === "number" && Number.isFinite(raw.Time)
          ? raw.Time
          : null,
      timestamp,
    },
    valid ? [] : ["SOURCE_TIME_INVALID"],
  );
}

/** 将 Tmp JSON 字符串解析为运行时配置对象，不解释动态内部键。 */
export function normalizeTemporaryConfig(raw, options = {}) {
  const server = options.server;
  providerSource(server);
  if (!hasOwn(raw ?? {}, "Tmp")) return missingFieldResult(server, "Tmp");
  if (typeof raw.Tmp !== "string") {
    return moduleResult(server, { config: null }, ["TMP_IS_NOT_STRING"]);
  }

  try {
    const config = JSON.parse(raw.Tmp);
    if (!config || typeof config !== "object" || Array.isArray(config)) {
      return moduleResult(server, { config: null }, ["TMP_JSON_IS_NOT_OBJECT"]);
    }
    return moduleResult(server, { config }, []);
  } catch {
    return moduleResult(server, { config: null }, ["TMP_INVALID_JSON"]);
  }
}

/** 解析世界状态协议版本号。 */
export function normalizeWorldStateVersion(raw, options = {}) {
  const server = options.server;
  providerSource(server);
  if (!hasOwn(raw ?? {}, "Version")) {
    return missingFieldResult(server, "Version");
  }

  const valid = Number.isSafeInteger(raw.Version);
  return moduleResult(
    server,
    { version: valid ? raw.Version : null },
    valid ? [] : ["WORLD_STATE_VERSION_INVALID"],
  );
}

/** 将 WorldSeed 作为不透明种子保存，不尝试解码其内部格式。 */
export function normalizeWorldSeed(raw, options = {}) {
  const server = options.server;
  providerSource(server);
  if (!hasOwn(raw ?? {}, "WorldSeed")) {
    return missingFieldResult(server, "WorldSeed");
  }

  const valid = typeof raw.WorldSeed === "string" && raw.WorldSeed.length > 0;
  return moduleResult(
    server,
    { seed: valid ? raw.WorldSeed : null },
    valid ? [] : ["WORLD_SEED_INVALID"],
  );
}
