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
