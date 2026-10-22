// Official Mod descriptions often live in levelStats[].stats[], not description.
// Keep rank and source pointer explicit; never translate arbitrary English strings.
export function maxRankText(value) {
  if (!Array.isArray(value?.levelStats)) return null;
  for (let rank = value.levelStats.length - 1; rank >= 0; rank--) {
    const stats = value.levelStats[rank]?.stats;
    if (!Array.isArray(stats) || !stats.length || !stats.every(line => typeof line === 'string' && line.trim())) continue;
    return { rank, text: stats.join('\n'), lines: [...stats], pointer: '/levelStats/' + rank + '/stats' };
  }
  return null;
}
export function descriptionText(value) {
  return typeof value?.description === 'string' && value.description.trim() ? value.description : maxRankText(value)?.text ?? '';
}
