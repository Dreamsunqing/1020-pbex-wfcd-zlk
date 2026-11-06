import { storeItemId } from '../core/merge/store-item-id.mjs';

// Rules of the 1999 calendar's reward art mapping (CAL-10). The App host (calendar-1999.js) uses them to pick a picture
// at runtime; scripts/check-calendar-reward-art.mjs uses the same ones to check the mapping file and its pictures.
// No DOM and no file access: whether a file can be read is found out by the caller.
//
// Rules, also listed in 文档/深入/50-1999日历奖励图片映射.md:
// - A key is a full reward ID starting with /Lotus/. It is matched after the App's storeItemId rule, so the
//   /Lotus/StoreItems/ spelling and the plain one find the same entry.
// - Two keys that are the same item are ambiguous. Both are reported and neither is used, so a picture never depends on
//   the order of the file.
// - A value is a path relative to the App image root. Anything that could leave the root, carry a scheme, a query or an
//   escape, or name an unsupported type is refused, so the path is also a safe URL as written.
// - An entry with a problem is left out and reported; the other entries still work.
//
// The portrait mapping of CAL-11 (文档/深入/51-1999日历六人组生日与角色图.md) follows the same path rules. Its keys are the
// birthday table's portraitKey values, never reward IDs: lower-case ASCII letters and digits joined by single hyphens.

export const REWARD_ART_ROOT = 'src/ui/assets/';
const ASSETS = new URL('./assets/', import.meta.url);
const SEGMENT = /^[A-Za-z0-9_-][A-Za-z0-9._-]*$/;
const PICTURE = /\.(png|jpe?g|webp)$/;
const REWARD_ID = /^\/Lotus\/\S+$/;
const PORTRAIT_KEY = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** The lookup key of a reward ID, or null when the value is not a full reward ID. */
export const rewardArtKey = id => typeof id === 'string' && REWARD_ID.test(id) ? storeItemId(id) : null;

/** The lookup key of a character portrait, or null when the value is not a portrait resource key (CAL-11). */
export const portraitArtKey = key => typeof key === 'string' && PORTRAIT_KEY.test(key) ? key : null;

/** The problem code of a mapped path, or null when the path is valid. */
export function rewardArtPathIssue(value) {
  if (typeof value !== 'string' || !value.split('/').every(part => SEGMENT.test(part))) return 'INVALID_PATH';
  return PICTURE.test(value) ? null : 'UNSUPPORTED_TYPE';
}

const MESSAGES = Object.freeze({
  INVALID_TABLE: () => '映射必须是对象：奖励图片映射以奖励 ID 为键，角色图映射以角色图资源键为键',
  INVALID_ID: () => '键必须是以 /Lotus/ 开头、不含空白的完整奖励 ID',
  INVALID_KEY: () => '键必须是角色图资源键：小写 ASCII 字母与数字，以单个连字号连接，例如 hex-arthur',
  INVALID_PATH: () => `路径必须相对于 ${REWARD_ART_ROOT}，以 / 分隔，每段只用 ASCII 字母、数字、点、底线与连字号且不以点开头（不能是绝对路径，也不能含 ..、\\、:、?、#）`,
  UNSUPPORTED_TYPE: () => '图档副档名必须是小写的 .png、.jpg、.jpeg 或 .webp',
  DUPLICATE_ID: others => `与 ${others.join('、')} 是同一物品，两笔都不生效`
});
const issue = (code, id, path, ...details) => Object.freeze({ code, id, path, message: MESSAGES[code](...details) });

/**
 * Reads a mapping table into its valid entries and the problems of the others.
 * @param {unknown} table  {[rewardId]: path relative to src/ui/assets/}
 * @returns {{entries: Map<string, {id: string, key: string, path: string, src: string}>,
 *   issues: {code: string, id: string|null, path: unknown, message: string}[]}}
 *   entries are keyed by rewardArtKey; src is the picture's URL next to this module.
 */
export function indexRewardArt(table) {
  return indexArt(table, rewardArtKey, 'INVALID_ID');
}

/**
 * Reads the portrait mapping (CAL-11) into its valid entries and the problems of the others, by the same rules as
 * indexRewardArt except for the key: a portraitKey of the birthday table instead of a reward ID.
 * @param {unknown} table  {[portraitKey]: path relative to src/ui/assets/}
 */
export function indexPortraitArt(table) {
  return indexArt(table, portraitArtKey, 'INVALID_KEY');
}

function indexArt(table, keyOf, invalidKey) {
  if (table === null || typeof table !== 'object' || Array.isArray(table)) return { entries: new Map(), issues: [issue('INVALID_TABLE', null, null)] };
  const issues = [], byKey = new Map();
  for (const [id, path] of Object.entries(table)) {
    const key = keyOf(id), problem = key ? rewardArtPathIssue(path) : invalidKey;
    if (problem) { issues.push(issue(problem, id, path)); continue; }
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push({ id, key, path });
  }
  const entries = new Map();
  for (const [key, rows] of byKey) {
    if (rows.length === 1) entries.set(key, Object.freeze({ ...rows[0], src: new URL(rows[0].path, ASSETS).href }));
    else for (const row of rows) issues.push(issue('DUPLICATE_ID', row.id, row.path, rows.filter(other => other !== row).map(other => other.id)));
  }
  return { entries, issues };
}
