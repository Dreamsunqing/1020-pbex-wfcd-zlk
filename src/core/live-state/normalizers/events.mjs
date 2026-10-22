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

function normalizeMessages(messages) {
  if (!Array.isArray(messages)) return [];

  return messages
    .filter(
      (entry) =>
        entry &&
        typeof entry === "object" &&
        typeof entry.LanguageCode === "string" &&
        typeof entry.Message === "string",
    )
    .map((entry) => ({
      languageCode: entry.LanguageCode.toLowerCase(),
      message: entry.Message,
    }));
}

function normalizeLinks(links, language, id, warnings) {
  if (links === undefined) return [];
  if (!Array.isArray(links)) {
    warnings.push(`EVENT_INVALID_LINKS:${id}`);
    return [];
  }

  let hasInvalidEntry = false;
  const normalized = [];

  for (const entry of links) {
    if (
      !entry ||
      typeof entry !== "object" ||
      typeof entry.LanguageCode !== "string" ||
      typeof entry.Link !== "string"
    ) {
      hasInvalidEntry = true;
      continue;
    }

    const link = {
      languageCode: entry.LanguageCode.toLowerCase(),
      url: entry.Link,
    };

    if (link.languageCode === language) normalized.push(link);
  }

  if (hasInvalidEntry) warnings.push(`EVENT_INVALID_LINK_SKIPPED:${id}`);
  return normalized;
}

function normalizeDate(event, rawField, id, warnings) {
  if (!hasOwn(event, rawField)) return null;

  const value = readExtendedJsonDate(event[rawField]);
  if (value === null) warnings.push(`EVENT_INVALID_DATE:${id}:${rawField}`);
  return value;
}

function normalizeBoolean(event, rawField, id, warnings) {
  if (!hasOwn(event, rawField)) return false;
  if (typeof event[rawField] === "boolean") return event[rawField];

  warnings.push(`EVENT_INVALID_BOOLEAN:${id}:${rawField}`);
  return false;
}

function normalizeOptionalString(event, rawField, id, warnings) {
  if (!hasOwn(event, rawField)) return null;
  if (typeof event[rawField] === "string") return event[rawField];

  warnings.push(`EVENT_INVALID_STRING:${id}:${rawField}`);
  return null;
}

function normalizeEvent(event, server, language, warnings) {
  const id = readObjectId(event?._id);
  if (!id) {
    warnings.push("EVENT_WITHOUT_ID_SKIPPED");
    return null;
  }

  const validMessages = normalizeMessages(event.Messages);
  if (validMessages.length === 0) {
    warnings.push(`EVENT_WITHOUT_SUPPORTED_MESSAGE:${id}`);
    return null;
  }

  const messages = validMessages.filter(
    (entry) => entry.languageCode === language,
  );
  // LanguageCode 是事件的展示目标；没有请求语言的事件不应回退到其他语言。
  if (messages.length === 0) return null;

  return {
    id,
    messages,
    prop: normalizeOptionalString(event, "Prop", id, warnings),
    links: normalizeLinks(event.Links, language, id, warnings),
    imageUrl:
      server === "de"
        ? normalizeOptionalString(event, "ImageUrl", id, warnings)
        : null,
    liveUrl: normalizeOptionalString(event, "EventLiveUrl", id, warnings),
    publishedAt: normalizeDate(event, "Date", id, warnings),
    startsAt: normalizeDate(event, "EventStartDate", id, warnings),
    endsAt: normalizeDate(event, "EventEndDate", id, warnings),
    priority: normalizeBoolean(event, "Priority", id, warnings),
    mobileOnly: normalizeBoolean(event, "MobileOnly", id, warnings),
    community: normalizeBoolean(event, "Community", id, warnings),
    hideEndDateModifier: normalizeBoolean(
      event,
      "HideEndDateModifier",
      id,
      warnings,
    ),
  };
}

export function normalizeEvents(raw, options) {
  const server = options?.server;
  if (server !== "de" && server !== "wg") {
    throw new Error(`Events normalizer 不支持服务器: ${server}`);
  }

  if (!Array.isArray(raw?.Events)) {
    return {
      status: "error",
      source: `${server}-world-state`,
      lossy: false,
      data: null,
      warnings: ["RAW_EVENTS_IS_NOT_ARRAY"],
    };
  }

  const warnings = [];
  const language = (options?.language ?? "zh").toLowerCase();
  const data = raw.Events
    .map((event) => normalizeEvent(event, server, language, warnings))
    .filter(Boolean);

  return {
    status: "ok",
    source: `${server}-world-state`,
    lossy: warnings.length > 0,
    data,
    warnings,
  };
}
