const text = value => typeof value === 'string' ? value : '';
const finite = value => typeof value === 'number' && Number.isFinite(value);
const compact = value => text(value).normalize('NFKC').toLocaleLowerCase().replace(/[\s_\-·]+/g, '');
export const PLATFORMS = ['pc', 'ps4', 'xbox', 'switch', 'mobile'];
export function checkSlug(slug) {
  if (typeof slug !== 'string' || !/^[a-z0-9][a-z0-9_]{0,180}$/.test(slug)) throw new Error('WM 物品标识无效');
  return slug;
}
export function checkContext(platform = 'pc', crossplay = false) {
  if (!PLATFORMS.includes(platform) || typeof crossplay !== 'boolean') throw new Error('WM 平台参数无效');
  return { platform, crossplay: platform === 'switch' ? false : crossplay };
}
export function normalizeItems(data) {
  if (!Array.isArray(data) || !data.length || data.length > 30000) throw new Error('WM 物品目录格式无效');
  const rows = data.filter(i => i && typeof i.id === 'string' && /^[a-z0-9][a-z0-9_]{0,180}$/.test(i.slug ?? '') && text(i.i18n?.en?.name)).map(i => ({
    id: i.id, slug: i.slug, name: text(i.i18n?.['zh-hans']?.name) || i.i18n.en.name, english: i.i18n.en.name,
    gameRef: text(i.gameRef), tags: Array.isArray(i.tags) ? i.tags.filter(t => typeof t === 'string') : [],
    maxRank: Number.isInteger(i.maxRank) && i.maxRank >= 0 && i.maxRank <= 100 ? i.maxRank : null,
    maxCharges: Number.isInteger(i.maxCharges) ? i.maxCharges : null,
    subtypes: Array.isArray(i.subtypes) ? i.subtypes : [], bulkTradable: !!i.bulkTradable,
  }));
  if (!rows.length) throw new Error('WM 目录没有有效物品');
  return rows;
}
export function searchItems(items, query, limit = 12) {
  if (typeof query !== 'string' || query.length > 180 || !Number.isInteger(limit) || limit < 1 || limit > 30) throw new Error('WM 搜索参数无效');
  const q = compact(query); if (!q) return [];
  return items.map(item => {
    const names = [item.name, item.english, item.slug].map(compact);
    const score = names.some(n => n === q) ? 0 : names.some(n => n.startsWith(q)) ? 1 : names.some(n => n.includes(q)) ? 2 : compact(item.gameRef).includes(q) ? 3 : 99;
    return { item, score };
  }).filter(x => x.score < 99).sort((a, b) => a.score - b.score || a.item.name.localeCompare(b.item.name, 'zh-CN')).slice(0, limit).map(x => x.item);
}
export function normalizeOrders(data, itemId) {
  if (!Array.isArray(data) || data.length > 50000) throw new Error('WM 订单响应格式无效');
  return data.filter(o => o && o.visible !== false && (!o.itemId || o.itemId === itemId) && ['buy', 'sell'].includes(o.type) && finite(o.platinum) && o.platinum > 0 && Number.isInteger(o.quantity) && o.quantity > 0 && text(o.user?.ingameName)).map(o => ({
    id: text(o.id), type: o.type, platinum: o.platinum, quantity: o.quantity,
    perTrade: Number.isInteger(o.perTrade) && o.perTrade >= 1 && o.perTrade <= 6 ? o.perTrade : 1,
    rank: Number.isInteger(o.rank) ? o.rank : null, charges: Number.isInteger(o.charges) ? o.charges : null,
    amberStars: Number.isInteger(o.amberStars) ? o.amberStars : null, cyanStars: Number.isInteger(o.cyanStars) ? o.cyanStars : null,
    subtype: text(o.subtype), updatedAt: text(o.updatedAt), user: {
      ingameName: o.user.ingameName, reputation: finite(o.user.reputation) ? o.user.reputation : 0,
      platform: text(o.user.platform), status: ['online', 'ingame'].includes(o.user.status) ? o.user.status : 'offline',
      crossplay: o.user.crossplay === true, lastSeen: text(o.user.lastSeen),
    },
  }));
}
export function filterOrders(rows, {type = 'sell', status = 'online', rank = '', min = '', max = '', sort = 'price'} = {}) {
  const low = min === '' ? null : Number(min), high = max === '' ? null : Number(max);
  if ((low !== null && (!Number.isFinite(low) || low < 0)) || (high !== null && (!Number.isFinite(high) || high < 0)) || (low !== null && high !== null && low > high)) throw new Error('价格范围无效');
  const statusRank = {ingame: 0, online: 1, offline: 2};
  return rows.filter(o => o.type === type && (status === 'all' || (status === 'online' ? o.user.status !== 'offline' : o.user.status === 'ingame')) && (rank === '' || o.rank === Number(rank)) && (low === null || o.platinum >= low) && (high === null || o.platinum <= high)).sort((a, b) => {
    const price = type === 'sell' ? a.platinum / a.perTrade - b.platinum / b.perTrade : b.platinum / b.perTrade - a.platinum / a.perTrade;
    if (sort === 'status') return statusRank[a.user.status] - statusRank[b.user.status] || price;
    if (sort === 'reputation') return b.user.reputation - a.user.reputation || price;
    return price || statusRank[a.user.status] - statusRank[b.user.status] || b.user.reputation - a.user.reputation;
  });
}
export function orderAttributes(order) {
  return [order.rank !== null && order.rank !== undefined ? `等级 ${order.rank}` : '', order.charges !== null && order.charges !== undefined ? `剩余 ${order.charges} 次` : '', order.subtype || '', order.amberStars !== null && order.amberStars !== undefined ? `琥珀星 ${order.amberStars}` : '', order.cyanStars !== null && order.cyanStars !== undefined ? `青蓝星 ${order.cyanStars}` : ''].filter(Boolean);
}
export function buildWhisper(item, order) {
  const safe = value => typeof value === 'string' && value.length > 0 && value.length <= 180 && !/[\r\n\x00-\x1f]/.test(value);
  if (!safe(order?.user?.ingameName) || /\s|\//.test(order.user.ingameName) || !safe(item?.english) || !['buy','sell'].includes(order.type) || !finite(order.platinum) || order.platinum <= 0) throw new Error('订单缺少有效交易信息，无法生成私聊');
  const attrs = [order.rank != null ? `rank ${order.rank}` : '', order.charges != null ? `${order.charges} charges` : '', order.subtype || '', order.amberStars != null ? `${order.amberStars} amber stars` : '', order.cyanStars != null ? `${order.cyanStars} cyan stars` : ''].filter(Boolean);
  if (attrs.some(a => !safe(a))) throw new Error('订单属性无效');
  const count = order.perTrade > 1 ? `${order.perTrade} x ` : '';
  return `/w ${order.user.ingameName} Hi! I want to ${order.type === 'sell' ? 'buy' : 'sell'}: ${count}${item.english}${attrs.length ? ' ('+attrs.join(', ')+')' : ''} for ${order.platinum} platinum. (warframe.market)`;
}
export function normalizeStatistics(raw) {
  const source = raw?.payload?.statistics_closed;
  if (!source || typeof source !== 'object' || !['48hours', '90days'].some(k => Array.isArray(source[k]))) throw new Error('WM 历史统计响应没有已关闭订单数据');
  const result = {};
  for (const window of ['48hours', '90days']) {
    const rows = source[window] ?? []; if (!Array.isArray(rows) || rows.length > 100000) throw new Error('WM 历史统计格式无效');
    result[window] = rows.filter(r => r && Number.isFinite(Date.parse(r.datetime))).map(r => {
      const row = { datetime: r.datetime, timestamp: Date.parse(r.datetime), rank: Number.isInteger(r.mod_rank) ? r.mod_rank : Number.isInteger(r.rank) ? r.rank : null };
      for (const field of ['volume','min_price','max_price','open_price','closed_price','avg_price','wa_price','median','moving_avg','donch_top','donch_bot']) row[field] = finite(r[field]) ? r[field] : null;
      return row;
    }).sort((a,b) => a.timestamp - b.timestamp);
  }
  return result;
}
