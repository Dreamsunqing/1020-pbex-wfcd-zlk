// Character portrait mapping of the 1999 calendar (CAL-11, #37). To add or replace a portrait, edit this file and the
// picture under portraits/; the steps are in 文档/深入/51-1999日历六人组生日与角色图.md.
//
// - Key: a portraitKey of the birthday table (src/features/calendar-1999/adapters/hex-birthdays.mjs), such as hex-arthur.
//   It is a picture resource key of its own and never a reward ID, so a character picture never mixes with reward art.
// - Value: the picture's path relative to the App image root, src/ui/assets/, under the same rules as reward-art.js:
//   ASCII letters, digits, dot, underscore and hyphen only, segments separated by /, and a lower-case .png, .jpg, .jpeg or
//   .webp extension.
// - One entry per line, key and value as quoted strings. `npm run check:calendar-art`, which `npm run check` also runs,
//   refuses invalid keys, duplicate keys, invalid paths, missing files and files that are not the picture their extension
//   says, and lists the table's portraitKey values that have no picture yet.
// - A character without a picture keeps its name, its birthday mark and a code-native placeholder.
// This file stays a module because the App page forbids fetching (CSP connect-src 'none'), so it cannot load JSON.
export default {
  // Source: Warframe Public Export, /Lotus/Interface/Icons/Player/AoiAccoladeGlyph.png!00_clO9daUXNOA7SxQBRSJphw
  'hex-aoi': 'calendar-1999/portraits/hex-aoi.png'
};
