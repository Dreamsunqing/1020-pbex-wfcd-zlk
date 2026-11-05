// Reward art mapping of the 1999 calendar (CAL-10, #36). To add or replace a picture, edit this file and the picture
// under rewards/; the steps are in 文档/深入/50-1999日历奖励图片映射.md.
//
// - Key: the full reward ID as world state sends it. /Lotus/StoreItems/… and /Lotus/… are the same item under the App's
//   storeItemId rule, so write one spelling only. Both spellings at once are a duplicate, and neither of them is used.
// - Value: the picture's path relative to the App image root, src/ui/assets/. ASCII letters, digits, dot, underscore and
//   hyphen only, segments separated by /, and a lower-case .png, .jpg, .jpeg or .webp extension.
// - One entry per line, key and value as quoted strings. `npm run check:calendar-art`, which `npm run check` also runs,
//   refuses duplicates, invalid paths, missing files and files that are not the picture their extension says.
// - A valid mapping wins over the App image service. The library jump does not depend on it: it still needs libraryId.
// This file stays a module because the App page forbids fetching (CSP connect-src 'none'), so it cannot load JSON.
export default {
  // Source: browse.wf/Lotus/Interface/Icons/Rewards/ArcaneGenericRareDoubleIcon128.png, the icon ExportBoosterPacks gives this pack.
  '/Lotus/StoreItems/Types/BoosterPacks/CalendarMajorArtifactPack': 'calendar-1999/rewards/CalendarMajorArtifactPack.png'
};
