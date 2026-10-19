import { browseRules } from './browse.mjs';

// Shared loader keeps desktop snapshot and CLI source selection consistent.
export async function loadBrowseData(readSource, { schedule = false } = {}) {
  const warnings = [];
  const optional = async name => {
    try { const value = JSON.parse(await readSource('plus', name)); if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('应为键值对象'); return value; }
    catch (error) { warnings.push(`${name} 无法读取，使用原始标识：${error.message}`); return {}; }
  };
  if (schedule) return { text: await readSource('browse', 'sp-incursions.txt'), regions: await optional('ExportRegions.json'), dictionary: await optional('dict.zh.json'), warnings };
  return { rules: browseRules(await readSource('browse', 'live.ts')), dictionary: await optional('dict.zh.json'), warnings };
}
