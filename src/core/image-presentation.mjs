// Explicit display rules; source catalogues and image bytes remain unchanged.
export const imageOverrides = Object.freeze({
  '/Lotus/Types/Items/MiscItems/Forma': { imageName: 'Forma.png', reason: '普通 Forma 使用现有 WFCD Forma.png；原始 GenericComponent.png 保留。' }
});
export const shardPairs = Object.freeze(Object.fromEntries(['Amar', 'Boreal', 'Nira', 'Green', 'Orange', 'Violet'].map(color => {
  const base = '/Lotus/Types/Gameplay/NarmerSorties/ArchonCrystal' + color;
  return [base + 'Mythic', base];
})));
export const iconFilename = value => typeof value === 'string' && /^\/Lotus\/Interface\//.test(value) ? value.split('/').at(-1) : undefined;
export const isAbilityIcon = (icon, imageName) => /\/Icons\/Abilities\//.test(icon ?? '') || imageName === 'AtlasRockPunch.png';
// Illustration-only fallback for generic boosters absent from the public image manifest.
// Keep the reward ID, duration and library target unchanged; never alias timed variants.
export const boosterArtAliases = Object.freeze(Object.fromEntries([
  ['AffinityBoosterStoreItem','AffinityBooster3DayStoreItem'],
  ['CreditBoosterStoreItem','CreditBooster3DayStoreItem'],
  ['ResourceAmountBoosterStoreItem','ResourceAmount3DayStoreItem'],
  ['ResourceDropChanceBoosterStoreItem','ResourceDropChance3DayStoreItem'],
  ['ModDropChanceBoosterStoreItem','ModDropChanceBooster3DayStoreItem']
].map(([from,to])=>['/Lotus/Types/StoreItems/Boosters/'+from,'/Lotus/Types/StoreItems/Boosters/'+to])));
