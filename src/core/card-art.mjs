// Layout data only. PNG assets are copied locally by scripts/sync-card-assets.mjs.
const prefixes={COMMON:'Bronze',UNCOMMON:'Silver',RARE:'Gold',LEGENDARY:'Legendary'};
const polarities={AP_ATTACK:'Madurai',AP_DEFENSE:'Vazarin',AP_TACTIC:'Naramon',AP_POWER:'Zenurik',AP_PRECEPT:'Penjaga',AP_UMBRA:'Umbra',madurai:'Madurai',vazarin:'Vazarin',naramon:'Naramon',zenurik:'Zenurik',unairu:'Unairu',penjaga:'Penjaga',umbra:'Umbra'};
export function cardArt(item,locale='zh-CN') {
  const rarity=String(item.rarity??'').toUpperCase(),prefix=prefixes[rarity];if(!prefix)return null;
  if(item.kind==='arcane')return {kind:'arcane',background:'arcanes/'+({COMMON:'Common',UNCOMMON:'Uncommon',RARE:'Rare',LEGENDARY:'Rare-Legendary'}[rarity])+'.png'};
  if(item.kind!=='mod')return null;
  const a=item.attributes??{},stats=item.stats??{},name=item.name?.en??'',identity=name+' '+(a.type??'')+' '+item.id;
  let variant=prefix.toLowerCase(),files={};
  const standard=Object.fromEntries(['background','frameTop','frameBottom','cornerLights','sideLight','lowerTab','drainBacker'].map((k,i)=>[k,prefix+['Background','FrameTop','FrameBottom','CornerLights','SideLight','LowerTab','TopRightBacker'][i]+'.png']));
  if(/\bRiven\b/i.test(identity)){variant='riven';files={frameTop:'RivenFrameTop.png',frameBottom:'RivenFrameBottom.png',cornerLights:'RivenCornerLights.png',sideLight:'RivenSideLight.png',lowerTab:'RivenLowerTab.png',drainBacker:'RivenTopRightBacker.png'};}
  else if(/^Amalgam\b/i.test(name)){variant='amalgam';files={background:'AmalgamBackground.png',frameTop:'AmalgamFrameTop.png',frameBottom:'AmalgamFrameBottom.png'};}
  else if(/^Galvanized\b/i.test(name)){variant='galvanized';files={background:'GalvanizedBackground.png',frameTop:'GalvanizedFrameTop.png',frameBottom:'GalvanizedFrameBottom.png',sideLight:'GalvanizedSideLight.png',bottomLight:'GalvanizedBottomLight.png'};}
  else if(['Plexus Mod','Railjack Mod'].includes(a.type)){variant='plexus';const tier=rarity==='COMMON'?'Bronze':rarity==='UNCOMMON'?'Silver':'Gold';files={background:standard.background,frameTop:'AvionicModsFrameTop'+tier+'.png',frameBottom:'AvionicModsFrameBottom'+tier+'.png'};}
  else files=standard;
  files.lowerTab??=standard.lowerTab;files.drainBacker??=standard.drainBacker;
  const rank=stats.fusionLimit??a.fusionLimit,base=stats.baseDrain??a.baseDrain,slots=Number.isInteger(rank)&&rank>=0&&rank<=20?rank:0;
  const lines=a.levelStats?.at(-1)?.stats;
  return {kind:'mod',locale,title:item.name?.[locale]??item.name?.en??'',variant,assets:Object.fromEntries(Object.entries(files).map(([k,v])=>[k,'mods/wiki/'+v])),slots,drain:Number.isFinite(base)?Math.abs(base+(base<0?-slots:slots)):null,polarity:polarities[a.polarity]?'mods/polarities/'+polarities[a.polarity]+'.png':null,polarityText:['AP_UNIVERSAL','universal'].includes(a.polarity)?'◎':['aura'].includes(a.polarity)?'A':'',type:a.compatName??a.type??'',effects:Array.isArray(lines)?lines:[],description:item.description??{}};
}
