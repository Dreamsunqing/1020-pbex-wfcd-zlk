// Shared player/card projection. A card previews one equipped piece, not a loadout.
export function modSetBonus(set, count = 1, locale = 'zh-CN') {
  const info = set?.modSetInfo;
  if (!info || !Number.isInteger(count) || count < 1 || count > info.size) return null;
  for (const language of [...new Set([locale, 'en'])]) {
    const text = info.bonuses?.[language]?.[count - 1];
    if (typeof text === 'string' && text) return { count, text, locale: language, fallback: language !== locale };
  }
  return { count, text: '', locale, missing: true };
}
