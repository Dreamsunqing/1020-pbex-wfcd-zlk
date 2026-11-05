import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { REWARD_ART_ROOT, indexRewardArt } from '../src/ui/calendar-1999-art.js';

// Validation of the 1999 calendar's reward art mapping (CAL-10). The App applies the same rules at runtime
// (src/ui/calendar-1999-art.js) and skips what they refuse; this check makes the same problems fail the validation flow,
// and adds what only the file system can tell.
//
//   node scripts/check-calendar-reward-art.mjs      also `npm run check:calendar-art`, and part of `npm run check`
//
// It fails on: an unloadable mapping file; an entry the runtime rules refuse (INVALID_TABLE, INVALID_ID, INVALID_PATH,
// UNSUPPORTED_TYPE, DUPLICATE_ID for two spellings of one item); a key written twice (DUPLICATE_KEY, which an object
// literal would hide by keeping the last one); a key not written as a quoted string on its own (UNCHECKED_FORMAT); a
// missing picture (MISSING_FILE); a path whose letter case differs from the file (CASE_MISMATCH: Windows would find it,
// the packaged app.asar would not); a file that is not the picture its extension says (NOT_PICTURE).
// Pictures under calendar-1999/rewards/ that no entry uses are listed as unused, without failing.

const root = fileURLToPath(new URL('../', import.meta.url));
export const MAPPING_FILE = path.join(root, 'src/ui/assets/calendar-1999/reward-art.js');
export const ASSET_ROOT = path.join(root, REWARD_ART_ROOT);
const REWARDS_DIR = 'calendar-1999/rewards';
const starts = (bytes, ...signature) => signature.every((byte, index) => bytes[index] === byte);
const SIGNATURES = Object.freeze({
  png: bytes => starts(bytes, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a),
  jpg: bytes => starts(bytes, 0xff, 0xd8, 0xff),
  jpeg: bytes => starts(bytes, 0xff, 0xd8, 0xff),
  webp: bytes => bytes.subarray(0, 4).toString('latin1') === 'RIFF' && bytes.subarray(8, 12).toString('latin1') === 'WEBP'
});
let loads = 0;

/** Keys as written in the mapping source, comments left out. */
export function writtenKeys(source) {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
  return [...code.matchAll(/(['"])((?:(?!\1)[^\\\n])*)\1\s*:/g)].map(match => match[2]);
}

// Each segment must exist with exactly this name, whatever the file system's case rules are.
async function caseMismatch(base, parts) {
  let dir = base;
  for (const part of parts) {
    const names = await readdir(dir).catch(() => []);
    if (!names.includes(part)) return names.find(name => name.toLowerCase() === part.toLowerCase()) ?? null;
    dir = path.join(dir, part);
  }
  return null;
}

/**
 * @param {{file?: string, assets?: string}} [options]  The mapping module and the App image root it is relative to.
 * @returns {Promise<{ok: boolean, entries: number, issues: {code: string, id: string|null, path: unknown, message: string}[], unused: string[]}>}
 */
export async function checkCalendarRewardArt({ file = MAPPING_FILE, assets = ASSET_ROOT } = {}) {
  let source, table;
  try {
    source = await readFile(file, 'utf8');
    table = (await import(`${pathToFileURL(file).href}?check=${++loads}`)).default;
  } catch (error) {
    return { ok: false, entries: 0, issues: [{ code: 'MAPPING_UNREADABLE', id: null, path: null, message: `映射档无法载入：${error.message}` }], unused: [] };
  }
  const { entries, issues } = indexRewardArt(table);
  const counts = new Map();
  for (const key of writtenKeys(source)) counts.set(key, (counts.get(key) ?? 0) + 1);
  for (const [key, count] of counts) {
    if (count > 1) issues.push({ code: 'DUPLICATE_KEY', id: key, path: table?.[key] ?? null, message: `同一个键写了 ${count} 次，执行时只会保留最后一笔` });
  }
  const unseen = table !== null && typeof table === 'object' && !Array.isArray(table) ? Object.keys(table).filter(key => !counts.has(key)) : [];
  if (unseen.length) issues.push({ code: 'UNCHECKED_FORMAT', id: unseen.join('、'), path: null, message: '键必须写成带引号的字串，否则无法检查是否重复' });

  const used = new Set();
  for (const entry of entries.values()) {
    const parts = entry.path.split('/');
    used.add(entry.path);
    // Letter case first, so a wrong case is told apart from a missing file on every file system.
    const actual = await caseMismatch(assets, parts);
    if (actual !== null) {
      issues.push({ code: 'CASE_MISMATCH', id: entry.id, path: entry.path, message: `大小写与实际档名「${actual}」不同；打包后的 app.asar 区分大小写，会找不到这个图档` });
      continue;
    }
    let bytes;
    try { bytes = await readFile(path.join(assets, ...parts)); } catch (error) {
      issues.push({ code: 'MISSING_FILE', id: entry.id, path: entry.path, message: `找不到图档 ${REWARD_ART_ROOT}${entry.path}（${error.code ?? error.message}）` });
      continue;
    }
    const type = entry.path.slice(entry.path.lastIndexOf('.') + 1);
    if (!SIGNATURES[type](bytes)) issues.push({ code: 'NOT_PICTURE', id: entry.id, path: entry.path, message: `图档内容不是 ${type.toUpperCase()}` });
  }
  const pictures = await readdir(path.join(assets, REWARDS_DIR)).catch(() => []);
  const unused = pictures.map(name => `${REWARDS_DIR}/${name}`).filter(name => !used.has(name)).sort();
  return { ok: issues.length === 0, entries: entries.size, issues, unused };
}

/** Console lines for a check result, problems first. */
export function describeRewardArtCheck(result) {
  const lines = result.issues.map(issue => `✗ ${issue.code} ${issue.id ?? '（整个映射）'}${typeof issue.path === 'string' ? ` → ${issue.path}` : ''}：${issue.message}`);
  for (const name of result.unused) lines.push(`… 未被映射使用的图档：${REWARD_ART_ROOT}${name}`);
  lines.push(result.ok ? `1999 日历奖励图片映射检查通过：${result.entries} 笔` : `1999 日历奖励图片映射检查失败：${result.issues.length} 个问题`);
  return lines;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = await checkCalendarRewardArt();
  for (const line of describeRewardArtCheck(result)) (result.ok ? console.log : console.error)(line);
  if (!result.ok) process.exitCode = 1;
}
