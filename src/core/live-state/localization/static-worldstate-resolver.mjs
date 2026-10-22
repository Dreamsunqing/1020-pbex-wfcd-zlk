// Compatibility adapter for the imported pure normalizers. All lookups use this
// request's Workbench catalog, never the old API's mutable global dictionaries.
export const LOCALIZED_MODULE_LANGUAGES = Object.freeze({ de: ['zh'], wg: ['zh'] });
export const isLocalizedModuleLanguageSupported = (server, language) => ['de','wg'].includes(server) && language === 'zh';
export const hasStructuralWarnings = warnings => [...warnings].some(w => !w.includes('_LOCALIZATION_MISSING:') && !w.includes('_DESCRIPTION_MISSING:'));
export function createStaticLocalizationContext(options, warningPrefix) {
  return isLocalizedModuleLanguageSupported(options.server, options.language ?? 'zh') ? { ...options, warningPrefix } : null;
}
export function localizeStaticKey(key, category, context, warnings) {
  const result = context.catalog?.label(key, category, context.server) ?? { key, name: key, fallback: true };
  if (key && result.fallback) warnings.add(`${context.warningPrefix}_LOCALIZATION_MISSING:${category}:${key}`);
  return result;
}
export const localizeBoss = (key, context, warnings) => localizeStaticKey(key, 'bosses', context, warnings);
export function localizeSortieModifier(key, context, warnings) {
  const result = localizeStaticKey(key, 'modifiers', context, warnings);
  return { ...result, description: context.catalog?.modifierDescription(key) ?? null };
}
export function localizeFissureModifier(key, context, warnings) {
  const result = localizeStaticKey(key, 'fissureModifiers', context, warnings);
  return { ...result, tier: /^VoidT[1-6]$/.test(key) ? Number(key.slice(-1)) : null };
}
