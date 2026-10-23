// Player-facing facets only. P3 kinds, source enums and relationships stay intact.
const companionResource = item => item.kind==='weapon' && item.attributes?.category==='Pets';
export const playerGroupOverride = item => companionResource(item) ? 'companion' : null;

function modType(item) {
  const type=item.attributes?.type??'',id=item.id??'',name=item.name?.['zh-CN']??'';
  if(/Riven Mod$/.test(type)||/^\/Lotus\/Upgrades\/Mods\/Randomized\/Raw/.test(id))return 'Riven Mod';
  if(type && type!=='---')return type;
  // Classify by collection as well as name: 瞬满 is a two-character K-Drive Mod.
  if(/转换核心$/.test(name)||/\/SampleAntiqueUpgrade$/i.test(id))return '---';
  if(/^\/Lotus\/Upgrades\/Mods\/Hoverboard\//.test(id))return 'K-Drive Mod';
  if(/^\/Lotus\/Upgrades\/Mods\/Necr[oa]mech\//.test(id)||name.startsWith('殁世机甲'))return 'Necramech Mod';
  if(/^\/Lotus\/Upgrades\/Mods\/Antiques\//.test(id)&&/^\p{Script=Han}{2}$/u.test(name))return 'Operator Mod';
  if(/^\/Lotus\/Upgrades\/Mods\/Rifle\//.test(id))return 'PRIMARY';
  return '---';
}
export function playerFacetValues(item) {
  const a=item.attributes??{};
  return {
    category:companionResource(item)?'Companion Resources':typeof a.category==='string'?a.category:'',
    type:item.kind==='mod'?modType(item):typeof a.type==='string'?a.type:''
  };
}

// Source aliases share a position. Unlisted facets retain a deterministic Chinese order.
const order=[
 ['AURA'],['WARFRAME','Warframe','Warframes','Warframe Arcane'],['Necramech','Necramech Mod'],['ARCHWING','Archwing'],
 ['PRIMARY','Primary','Primary Arcane','Rifle','Shotgun','Sniper','Bow','Launcher','Shotgun Arcane','Bow Arcane'],
 ['SECONDARY','Secondary','Secondary Arcane','Pistol','Dual Pistols','Throwing'],['MELEE','Melee','Melee Arcane'],['STANCE'],
 ['ARCH-GUN','Arch-Gun'],['ARCH-MELEE','Arch-Melee'],['SENTINEL','Sentinel','Sentinels','Companion Weapon'],
 ['Pets','KUBROW','KAVAT','HELMINTH CHARGER'],['Companion Resources','Pet Parts','Pet Resource','Pet Collar'],
 ['Operator Mod','Operator Arcane','Amp','Amp Arcane'],['K-Drive Mod','K-Drive Component'],['Plexus Mod','Railjack','Railjack Turret'],
 ['PARAZON'],['Riven Mod'],['Mod Set Mod'],['Kitgun Arcane','Kitgun Component'],['Zaw Arcane','Zaw Component']
];
const ranks=new Map(order.flatMap((values,i)=>values.map((value,j)=>[value,[i,j]])));
export function comparePlayerFacets(key,a,b,label) {
  const rank=value=>key==='rarity'?['COMMON','UNCOMMON','RARE','LEGENDARY'].indexOf(value):key==='variant'?['NORMAL','PRIME','KUVA','SYNDICATE','STARTER','VARIANT'].indexOf(value):-1;
  if(['type','category'].includes(key)) {
    // Artifact definitions always follow unknowns and every other category.
    const r=value=>value==='Railjack Mod'?[1000,0]:value==='---'?[999,0]:ranks.get(value)??[100,0];
    const x=r(a),y=r(b);if(x[0]!==y[0]||x[1]!==y[1])return x[0]-y[0]||x[1]-y[1];
  } else if(['rarity','variant'].includes(key)) {
    const x=rank(a),y=rank(b);if(x!==y)return (x<0?999:x)-(y<0?999:y);
  }
  return label(a).localeCompare(label(b),'zh-CN')||a.localeCompare(b);
}
