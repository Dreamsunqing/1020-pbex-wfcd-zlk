// Presentation states are derived from upstream types, never from text length.
export function calendarCardState(events = []) {
  const types = new Set(events.map(event => event.type));
  if (types.size !== 1) return { id: 'mixed', label: '综合事件日' };
  return {
    CET_CHALLENGE: { id: 'challenge', label: '挑战日' },
    CET_REWARD: { id: 'reward', label: '奖励日' },
    CET_UPGRADE: { id: 'upgrade', label: '强化日 · 三选一' }
  }[[...types][0]] ?? { id: 'other', label: '其他事件日' };
}

export function descentCardState(type, localized) {
  if (type === 'DT_BOSS') return { id: 'boss', label: '首领层' };
  if (type === 'DT_PROTOFRAME') return { id: 'protoframe', label: '原型战甲层' };
  return localized ? { id: 'mission', label: '任务层' } : { id: 'other', label: '其他楼层' };
}

const regions = {
  CetusSyndicate: ['夜灵平原', '开放世界赏金'],
  SolarisSyndicate: ['奥布山谷', '开放世界赏金'],
  EntratiSyndicate: ['魔胎之境', '开放世界赏金'],
  ZarimanSyndicate: ['扎里曼', '地区赏金'],
  EntratiLabSyndicate: ['英择谛实验室', '地区赏金'],
  HexSyndicate: ['霍瓦尼亚', '地区赏金']
};
export function bountyRegion(tag, syndicate) {
  const [name, category] = regions[tag] ?? [syndicate, '其他赏金'];
  return { name, category, key: tag };
}
