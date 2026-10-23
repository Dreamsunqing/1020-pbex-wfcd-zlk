// Public riven listings only. No authenticated or write endpoints are exposed.
const text = v => typeof v === 'string' ? v : '';
const finite = v => typeof v === 'number' && Number.isFinite(v);
const integer = v => Number.isInteger(v) && v >= 0 ? v : null;
const safeSlug = v => typeof v === 'string' && /^[a-z0-9][a-z0-9_()\-]{0,180}$/.test(v);
export const POLARITIES = {madurai:'Madurai（V）',vazarin:'Vazarin（D）',naramon:'Naramon（—）',zenurik:'Zenurik（＝）'};
export function normalizeRivenWeapons(raw) {
  if (raw?.error || !Array.isArray(raw?.data) || !raw.data.length || raw.data.length > 5000) throw new Error('WM 裂罅武器目录格式无效');
  return raw.data.filter(i => safeSlug(i?.slug) && text(i.i18n?.en?.name)).map(i => ({
    id:text(i.id),slug:i.slug,name:text(i.i18n?.['zh-hans']?.name)||i.i18n.en.name,english:i.i18n.en.name,gameRef:text(i.gameRef),rivenType:text(i.rivenType)
  }));
}
export function normalizeRivenAttributes(raw) {
  if (raw?.error || !Array.isArray(raw?.data) || !raw.data.length || raw.data.length > 500) throw new Error('WM 裂罅词条目录格式无效');
  return raw.data.filter(i => text(i?.slug) && i.slug.length <= 180 && text(i.i18n?.en?.name)).map(i => ({
    slug:i.slug,name:text(i.i18n?.['zh-hans']?.name)||i.i18n.en.name,english:i.i18n.en.name,unit:text(i.unit),
    positiveOnly:i.positiveOnly === true,positiveIsNegative:i.positiveIsNegative === true,exclusiveTo:Array.isArray(i.exclusiveTo)?i.exclusiveTo.filter(x=>typeof x==='string'):[]
  }));
}
export function compatibleAttributes(attributes, weapon) {
  return attributes.filter(a => !weapon || !a.exclusiveTo.length || a.exclusiveTo.includes(weapon.rivenType));
}
export function auctionQuery(input = {}, weapons, attributes) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('拍卖筛选参数无效');
  const allowed = new Set(['weapon','positive','negative','polarity','masteryMin','masteryMax','rollsMin','rollsMax','rank','kind','sort']);
  if (Object.keys(input).some(k=>!allowed.has(k))) throw new Error('未知拍卖筛选条件');
  const {weapon='',positive=[],negative='',polarity='',rank='',kind='',sort='price_asc'} = input;
  const selected = weapon === '' ? null : weapons.find(w=>w.slug===weapon);
  if (typeof weapon !== 'string' || (weapon && !selected)) throw new Error('请从提示中选择裂罅武器');
  const available = compatibleAttributes(attributes,selected), stats = new Map(available.map(a=>[a.slug,a]));
  if (!Array.isArray(positive) || positive.length > 3 || new Set(positive).size!==positive.length || positive.some(s=>!stats.has(s))) throw new Error('请选择最多 3 个适用于该武器的正面词条');
  if (typeof negative!=='string' || (negative && !['none','has'].includes(negative) && (!stats.has(negative)||stats.get(negative).positiveOnly))) throw new Error('负面词条不适用于该武器');
  if (positive.includes(negative)) throw new Error('同一词条不能同时作为正面和负面条件');
  if (typeof polarity!=='string' || (polarity && !Object.hasOwn(POLARITIES,polarity))) throw new Error('极性无效');
  if (!['','maxed'].includes(rank) || !['','direct','auction'].includes(kind) || !['price_asc','price_desc'].includes(sort)) throw new Error('等级、类别或排序无效');
  const params = new URLSearchParams({type:'riven',sort_by:sort});
  for (const [key,value] of [['weapon_url_name',weapon],['positive_stats',positive.join(',')],['negative_stats',negative],['polarity',polarity],['mod_rank',rank],['buyout_policy',kind]]) if(value) params.set(key,value);
  const bounds = {};
  for (const [field,param,max] of [['masteryMin','mastery_rank_min',16],['masteryMax','mastery_rank_max',16],['rollsMin','re_rolls_min',1000000],['rollsMax','re_rolls_max',1000000]]) {
    const v = input[field];
    if (v === '' || v === undefined) continue;
    if (!Number.isInteger(v) || v < (field.startsWith('mastery')?7:0) || v > max) throw new Error('段位或循环次数范围无效');
    bounds[field]=v;params.set(param,String(v));
  }
  if ((bounds.masteryMin??7)>(bounds.masteryMax??16) || (bounds.rollsMin??0)>(bounds.rollsMax??1000000)) throw new Error('范围下限不能大于上限');
  return params;
}
export function normalizeAuctions(raw) {
  const rows = raw?.payload?.auctions;
  if (raw?.error || !Array.isArray(rows) || rows.length > 10000) throw new Error('WM 裂罅拍卖响应格式无效');
  const seen = new Set();
  return rows.filter(a => {
    if (!a || !/^[a-z0-9_-]{1,100}$/i.test(a.id??'') || seen.has(a.id) || a.private === true || a.visible === false || a.closed === true || a.item?.type!=='riven' || !safeSlug(a.item.weapon_url_name) || !text(a.owner?.ingame_name) || !Array.isArray(a.item.attributes)) return false;
    seen.add(a.id);return true;
  }).map(a => ({
    id:a.id,weapon:a.item.weapon_url_name,name:text(a.item.name),polarity:text(a.item.polarity),rank:integer(a.item.mod_rank),mastery:integer(a.item.mastery_level),rolls:integer(a.item.re_rolls),
    attributes:a.item.attributes.filter(x => text(x?.url_name) && finite(x.value) && typeof x.positive==='boolean').map(x=>({slug:x.url_name,value:x.value,positive:x.positive})),
    startingPrice:finite(a.starting_price)&&a.starting_price>=0?a.starting_price:null,buyoutPrice:finite(a.buyout_price)&&a.buyout_price>=0?a.buyout_price:null,topBid:finite(a.top_bid)&&a.top_bid>=0?a.top_bid:null,
    direct:a.is_direct_sell===true,created:text(a.created),updated:text(a.updated),platform:text(a.platform),
    owner:{name:a.owner.ingame_name,status:['online','ingame'].includes(a.owner.status)?a.owner.status:'offline',reputation:finite(a.owner.reputation)?a.owner.reputation:null},
  }));
}
export function filterAuctions(rows, status='online') {
  if (!['all','online','ingame'].includes(status)) throw new Error('在线状态无效');
  return rows.filter(a=>status==='all'||(status==='ingame'?a.owner.status==='ingame':a.owner.status!=='offline'));
}
// The legacy search requires a weapon or positive stat. Other queries use the
// latest public window, and must never claim to filter the entire marketplace.
export function filterAuctionWindow(rows, filters={}) {
  const inRange=(v,min,max)=>(min===''||min===undefined||v!==null&&v>=min)&&(max===''||max===undefined||v!==null&&v<=max);
  const result=rows.filter(a=>{
    if(filters.polarity&&a.polarity!==filters.polarity)return false;
    if(filters.rank==='maxed'&&a.rank!==8)return false;
    if(filters.kind==='direct'&&!a.direct||filters.kind==='auction'&&a.direct)return false;
    if(!inRange(a.mastery,filters.masteryMin,filters.masteryMax)||!inRange(a.rolls,filters.rollsMin,filters.rollsMax))return false;
    const negatives=a.attributes.filter(x=>!x.positive);
    return !filters.negative || (filters.negative==='none'?!negatives.length:filters.negative==='has'?!!negatives.length:negatives.some(x=>x.slug===filters.negative));
  });
  const price=a=>a.buyoutPrice??a.startingPrice;
  return result.sort((a,b)=>{
    const x=price(a),y=price(b);if(x===null||y===null)return Number(x===null)-Number(y===null);
    return (filters.sort==='price_desc'?y-x:x-y)||a.id.localeCompare(b.id);
  });
}
export function attributeValue(attribute, definition) {
  const unit = definition?.unit;
  if(unit==='multiply')return `×${attribute.value.toLocaleString('zh-CN',{maximumFractionDigits:2})}`;
  const suffix = unit === 'percent' || unit === '%' ? '%' : unit === 'seconds' ? ' 秒' : unit ? ' '+unit : '';
  return `${attribute.value>0?'+':''}${attribute.value.toLocaleString('zh-CN',{maximumFractionDigits:2})}${suffix}`;
}
