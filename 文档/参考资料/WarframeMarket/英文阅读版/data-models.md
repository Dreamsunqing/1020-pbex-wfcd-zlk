# Data Models

Reusable public JSON shapes and enum values used by the Warframe.market API.

- optional/contextual
- owner/self
- moderator+
- first-party
- auth required
- unstable

**Field Flags**

Empty `Flags` means the field is public and normally present for that model. `optional/contextual` means the field is returned only for specific item kinds, user context, endpoint shape, language/platform context, or when data exists.

## Item

Full item model with all possible fields.

| Field            | Flags                                                   | Type                                                        | Description                                  |
| ---------------- | ------------------------------------------------------- | ----------------------------------------------------------- | -------------------------------------------- |
| `id`             |                                                         | `string`                  | Unique identifier.                           |
| `slug`           |                                                         | `string`                  | URL-safe slug.                               |
| `gameRef`        |                                                         | `string`                  | Internal Warframe game reference path.       |
| `tags`           |                                                         | `[]string`                | Item tags.                                   |
| `setRoot`        | `optional/contextual` | `boolean`                 | Whether this item is the root of a set.      |
| `setParts`       | `optional/contextual` | `[]string`                | Set member item IDs.                         |
| `quantityInSet`  | `optional/contextual` | `int`                     | Number of items in the set.                  |
| `rarity`         | `optional/contextual` | `string`                  | Item rarity.                                 |
| `bulkTradable`   | `optional/contextual` | `boolean`                 | Whether the item can be traded in bulk.      |
| `subtypes`       | `optional/contextual` | `[]string`                | Item subtypes.                               |
| `maxRank`        | `optional/contextual` | `int`                     | Maximum rank.                                |
| `maxCharges`     | `optional/contextual` | `int`                     | Maximum charges.                             |
| `maxAmberStars`  | `optional/contextual` | `int`                     | Maximum amber stars.                         |
| `maxCyanStars`   | `optional/contextual` | `int`                     | Maximum cyan stars.                          |
| `baseEndo`       | `optional/contextual` | `int`                     | Base endo value.                             |
| `endoMultiplier` | `optional/contextual` | `number`                  | Endo multiplier.                             |
| `ducats`         | `optional/contextual` | `int`                     | Ducat value.                                 |
| `vosfor`         | `optional/contextual` | `int`                     | Vosfor value.                                |
| `reqMasteryRank` | `optional/contextual` | `int`                     | Required mastery rank.                       |
| `vaulted`        | `optional/contextual` | `boolean`                 | Whether the item is vaulted.                 |
| `tradingTax`     | `optional/contextual` | `int`                     | Trading tax.                                 |
| `i18n`           | `optional/contextual` | `map[string]ItemI18NJson` | Localized item data, keyed by language code. |
| `tradable`       | `optional/contextual` | `boolean`                 | Whether the item is tradable.                |

### ItemI18NJson

| Field         | Flags                                                   | Type                                       | Description            |
| ------------- | ------------------------------------------------------- | ------------------------------------------ | ---------------------- |
| `name`        |                                                         | `string` | Display name.          |
| `description` | `optional/contextual` | `string` | Item description.      |
| `wikiLink`    | `optional/contextual` | `string` | Link to the wiki page. |
| `icon`        |                                                         | `string` | Icon image path.       |
| `thumb`       |                                                         | `string` | Thumbnail image path.  |
| `subIcon`     | `optional/contextual` | `string` | Sub-icon image path.   |

## Riven Item

Full riven weapon model with all possible fields. `rivenType` currently includes `kitgun`, `melee`, `pistol`, `rifle`, `shotgun`, and `zaw`, but new values may be added. `group` is used by the frontend for display grouping.

| Field            | Flags                                                   | Type                                       | Description                            |
| ---------------- | ------------------------------------------------------- | ------------------------------------------ | -------------------------------------- |
| `id`             |                                                         | `string` | Unique identifier.                     |
| `slug`           |                                                         | `string` | URL-safe slug.                         |
| `gameRef`        |                                                         | `string` | Internal Warframe game reference path. |
| `group`          | `optional/contextual` | `string` | Group category.                        |
| `rivenType`      | `optional/contextual` | `string` | Weapon type.                           |
| `disposition`    |                                                         | `number` | Disposition value.                     |
| `reqMasteryRank` |                                                         | `int`    | Required mastery rank.                 |

### RivenItemI18NJson

| Field      | Flags                                                   | Type                                       | Description            |
| ---------- | ------------------------------------------------------- | ------------------------------------------ | ---------------------- |
| `name`     |                                                         | `string` | Display name.          |
| `wikiLink` | `optional/contextual` | `string` | Link to the wiki page. |
| `icon`     |                                                         | `string` | Icon image path.       |
| `thumb`    |                                                         | `string` | Thumbnail image path.  |
| `subIcon`  |                                                         | `string` | Sub-icon image path.   |

## Riven Attribute

Full riven attribute model with all possible fields.

| Field                | Flags                                                   | Type                                                                  | Description                                           |
| -------------------- | ------------------------------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------- |
| `id`                 |                                                         | `string`                            | Unique identifier.                                    |
| `slug`               |                                                         | `string`                            | URL-safe slug.                                        |
| `gameRef`            |                                                         | `string`                            | Internal Warframe game reference path.                |
| `group`              | `optional/contextual` | `string`                            | Group category.                                       |
| `prefix`             |                                                         | `string`                            | Prefix name.                                          |
| `suffix`             |                                                         | `string`                            | Suffix name.                                          |
| `exclusiveTo`        | `optional/contextual` | `[]string`                          | Riven types this attribute is exclusive to.           |
| `positiveIsNegative` | `optional/contextual` | `boolean`                           | Whether positive values are treated as negative.      |
| `unit`               | `optional/contextual` | `string`                            | Unit of measurement.                                  |
| `positiveOnly`       | `optional/contextual` | `boolean`                           | Whether this attribute can only have positive values. |
| `negativeOnly`       | `optional/contextual` | `boolean`                           | Whether this attribute can only have negative values. |
| `i18n`               | `optional/contextual` | `map[string]RivenAttributeI18NJson` | Localized text map by language code.                  |

### RivenAttributeI18NJson

| Field   | Flags                                                   | Type                                       | Description            |
| ------- | ------------------------------------------------------- | ------------------------------------------ | ---------------------- |
| `name`  | `optional/contextual` | `string` | Attribute effect name. |
| `icon`  | `optional/contextual` | `string` | Icon image path.       |
| `thumb` | `optional/contextual` | `string` | Thumbnail image path.  |

## Lich Weapon

| Field            | Flags                                                   | Type                                                              | Description                            |
| ---------------- | ------------------------------------------------------- | ----------------------------------------------------------------- | -------------------------------------- |
| `id`             |                                                         | `string`                        | Unique identifier.                     |
| `slug`           |                                                         | `string`                        | URL-safe slug.                         |
| `gameRef`        |                                                         | `string`                        | Internal Warframe game reference path. |
| `reqMasteryRank` |                                                         | `int`                           | Required mastery rank.                 |
| `i18n`           | `optional/contextual` | `map[string]LichWeaponI18NJson` | Localized text map by language code.   |

### LichWeaponI18NJson

| Field      | Flags | Type                                       | Description            |
| ---------- | ----- | ------------------------------------------ | ---------------------- |
| `name`     |       | `string` | Display name.          |
| `wikiLink` |       | `string` | Link to the wiki page. |
| `icon`     |       | `string` | Icon image path.       |
| `thumb`    |       | `string` | Thumbnail image path.  |

## Lich Ephemera

| Field       | Flags                                                   | Type                                                                | Description                            |
| ----------- | ------------------------------------------------------- | ------------------------------------------------------------------- | -------------------------------------- |
| `id`        |                                                         | `string`                          | Unique identifier.                     |
| `slug`      |                                                         | `string`                          | URL-safe slug.                         |
| `gameRef`   |                                                         | `string`                          | Internal Warframe game reference path. |
| `animation` |                                                         | `string`                          | Animation path.                        |
| `element`   |                                                         | `string`                          | Elemental type.                        |
| `i18n`      | `optional/contextual` | `map[string]LichEphemeraI18NJson` | Localized text map by language code.   |

### LichEphemeraI18NJson

| Field   | Flags | Type                                       | Description           |
| ------- | ----- | ------------------------------------------ | --------------------- |
| `name`  |       | `string` | Display name.         |
| `icon`  |       | `string` | Icon image path.      |
| `thumb` |       | `string` | Thumbnail image path. |

## Lich Quirk

| Field   | Flags                                                   | Type                                                             | Description                          |
| ------- | ------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------ |
| `id`    |                                                         | `string`                       | Unique identifier.                   |
| `slug`  |                                                         | `string`                       | URL-safe slug.                       |
| `group` | `optional/contextual` | `string`                       | Group category.                      |
| `i18n`  | `optional/contextual` | `map[string]LichQuirkI18NJson` | Localized text map by language code. |

### LichQuirkI18NJson

| Field         | Flags | Type                                       | Description           |
| ------------- | ----- | ------------------------------------------ | --------------------- |
| `name`        |       | `string` | Display name.         |
| `description` |       | `string` | Quirk description.    |
| `icon`        |       | `string` | Icon image path.      |
| `thumb`       |       | `string` | Thumbnail image path. |

## Sister Weapon

| Field            | Flags                                                   | Type                                                                | Description                            |
| ---------------- | ------------------------------------------------------- | ------------------------------------------------------------------- | -------------------------------------- |
| `id`             |                                                         | `string`                          | Unique identifier.                     |
| `slug`           |                                                         | `string`                          | URL-safe slug.                         |
| `gameRef`        |                                                         | `string`                          | Internal Warframe game reference path. |
| `reqMasteryRank` |                                                         | `int`                             | Required mastery rank.                 |
| `i18n`           | `optional/contextual` | `map[string]SisterWeaponI18NJson` | Localized text map by language code.   |

### SisterWeaponI18NJson

| Field      | Flags | Type                                       | Description            |
| ---------- | ----- | ------------------------------------------ | ---------------------- |
| `name`     |       | `string` | Display name.          |
| `wikiLink` |       | `string` | Link to the wiki page. |
| `icon`     |       | `string` | Icon image path.       |
| `thumb`    |       | `string` | Thumbnail image path.  |

## Sister Ephemera

| Field       | Flags                                                   | Type                                                                  | Description                            |
| ----------- | ------------------------------------------------------- | --------------------------------------------------------------------- | -------------------------------------- |
| `id`        |                                                         | `string`                            | Unique identifier.                     |
| `slug`      |                                                         | `string`                            | URL-safe slug.                         |
| `gameRef`   |                                                         | `string`                            | Internal Warframe game reference path. |
| `animation` |                                                         | `string`                            | Animation path.                        |
| `element`   |                                                         | `string`                            | Elemental type.                        |
| `i18n`      | `optional/contextual` | `map[string]SisterEphemeraI18NJson` | Localized text map by language code.   |

### SisterEphemeraI18NJson

| Field   | Flags | Type                                       | Description           |
| ------- | ----- | ------------------------------------------ | --------------------- |
| `name`  |       | `string` | Display name.         |
| `icon`  |       | `string` | Icon image path.      |
| `thumb` |       | `string` | Thumbnail image path. |

## Sister Quirk

| Field   | Flags                                                   | Type                                                               | Description                          |
| ------- | ------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------ |
| `id`    |                                                         | `string`                         | Unique identifier.                   |
| `slug`  |                                                         | `string`                         | URL-safe slug.                       |
| `group` | `optional/contextual` | `string`                         | Group category.                      |
| `i18n`  | `optional/contextual` | `map[string]SisterQuirkI18NJson` | Localized text map by language code. |

### SisterQuirkI18NJson

| Field         | Flags | Type                                       | Description           |
| ------------- | ----- | ------------------------------------------ | --------------------- |
| `name`        |       | `string` | Display name.         |
| `description` |       | `string` | Quirk description.    |
| `icon`        |       | `string` | Icon image path.      |
| `thumb`       |       | `string` | Thumbnail image path. |

## Npc

| Field     | Flags                                                   | Type                                                       | Description                            |
| --------- | ------------------------------------------------------- | ---------------------------------------------------------- | -------------------------------------- |
| `id`      |                                                         | `string`                 | Unique identifier.                     |
| `slug`    |                                                         | `string`                 | URL-safe slug.                         |
| `gameRef` |                                                         | `string`                 | Internal Warframe game reference path. |
| `i18n`    | `optional/contextual` | `map[string]NpcI18NJson` | Localized text map by language code.   |

### NpcI18NJson

| Field   | Flags | Type                                       | Description           |
| ------- | ----- | ------------------------------------------ | --------------------- |
| `name`  |       | `string` | Display name.         |
| `icon`  |       | `string` | Icon image path.      |
| `thumb` |       | `string` | Thumbnail image path. |

## Location

| Field      | Flags                                                   | Type                                                            | Description                            |
| ---------- | ------------------------------------------------------- | --------------------------------------------------------------- | -------------------------------------- |
| `id`       |                                                         | `string`                      | Unique identifier.                     |
| `slug`     |                                                         | `string`                      | URL-safe slug.                         |
| `gameRef`  |                                                         | `string`                      | Internal Warframe game reference path. |
| `faction`  | `optional/contextual` | `string`                      | Faction name.                          |
| `minLevel` | `optional/contextual` | `int`                         | Minimum level for missions.            |
| `maxLevel` | `optional/contextual` | `int`                         | Maximum level for missions.            |
| `i18n`     | `optional/contextual` | `map[string]LocationI18NJson` | Localized text map by language code.   |

### LocationI18NJson

| Field        | Flags | Type                                       | Description           |
| ------------ | ----- | ------------------------------------------ | --------------------- |
| `nodeName`   |       | `string` | Node display name.    |
| `systemName` |       | `string` | System name.          |
| `icon`       |       | `string` | Icon image path.      |
| `thumb`      |       | `string` | Thumbnail image path. |

## Mission

| Field     | Flags                                                   | Type                                                           | Description                            |
| --------- | ------------------------------------------------------- | -------------------------------------------------------------- | -------------------------------------- |
| `id`      |                                                         | `string`                     | Unique identifier.                     |
| `slug`    |                                                         | `string`                     | URL-safe slug.                         |
| `gameRef` |                                                         | `string`                     | Internal Warframe game reference path. |
| `i18n`    | `optional/contextual` | `map[string]MissionI18NJson` | Localized text map by language code.   |

### MissionI18NJson

| Field   | Flags | Type                                       | Description           |
| ------- | ----- | ------------------------------------------ | --------------------- |
| `name`  |       | `string` | Display name.         |
| `icon`  |       | `string` | Icon image path.      |
| `thumb` |       | `string` | Thumbnail image path. |

## Order

Order without specifying the owner. Used where the owner is already known, such as a user profile or your own profile.

| Field        | Flags                                                   | Type                                          | Description                                       |
| ------------ | ------------------------------------------------------- | --------------------------------------------- | ------------------------------------------------- |
| `id`         |                                                         | `string`    | Unique identifier.                                |
| `type`       |                                                         | `string`    | `buy` or `sell`.                                  |
| `platinum`   |                                                         | `int`       | Total platinum currency.                          |
| `quantity`   |                                                         | `int`       | Number of items.                                  |
| `perTrade`   | `optional/contextual` | `int`       | Items quantity per transaction.                   |
| `subtype`    | `optional/contextual` | `string`    | Specific subtype or category.                     |
| `rank`       | `optional/contextual` | `int`       | Rank or level of the item.                        |
| `charges`    | `optional/contextual` | `int`       | Number of charges left.                           |
| `amberStars` | `optional/contextual` | `int`       | Count of amber stars in a sculpture.              |
| `cyanStars`  | `optional/contextual` | `int`       | Count of cyan stars in a sculpture.               |
| `visible`    |                                                         | `boolean`   | Whether the order is publicly visible.            |
| `createdAt`  |                                                         | `string`    | Creation timestamp.                               |
| `updatedAt`  |                                                         | `string`    | Last modification timestamp.                      |
| `itemId`     | `optional/contextual` | `string`    | Item identifier.                                  |
| `groupId`    | `optional/contextual` | `string`    | User-defined group. Default group is named `all`. |
| `user`       | `optional/contextual` | `UserShort` | User who created the order.                       |

## Transaction

Represents an order that has been fully or partially closed.

| Field       | Flags                                                   | Type                                          | Description                               |
| ----------- | ------------------------------------------------------- | --------------------------------------------- | ----------------------------------------- |
| `id`        |                                                         | `string`    | Unique identifier.                        |
| `type`      |                                                         | `string`    | Trade type.                               |
| `originId`  |                                                         | `string`    | Original order identifier.                |
| `platinum`  |                                                         | `number`    | Platinum amount.                          |
| `quantity`  |                                                         | `int`       | Number of items.                          |
| `createdAt` |                                                         | `string`    | Creation timestamp.                       |
| `updatedAt` |                                                         | `string`    | Last modification timestamp.              |
| `item`      | `optional/contextual` | `TxItem`    | Item details involved in the transaction. |
| `user`      | `optional/contextual` | `UserShort` | User involved in the transaction.         |

### TxItem

| Field        | Flags                                                   | Type                                       | Description           |
| ------------ | ------------------------------------------------------- | ------------------------------------------ | --------------------- |
| `id`         | `optional/contextual` | `string` | Item identifier.      |
| `rank`       | `optional/contextual` | `int`    | Rank of the item.     |
| `charges`    | `optional/contextual` | `int`    | Number of charges.    |
| `subtype`    | `optional/contextual` | `string` | Item subtype.         |
| `amberStars` | `optional/contextual` | `int`    | Count of amber stars. |
| `cyanStars`  | `optional/contextual` | `int`    | Count of cyan stars.  |

## UserShort

Shortened user model returned inside orders, transactions, and other embedded user references.

| Field        | Flags                                                   | Type                                                 | Description                                                 |
| ------------ | ------------------------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------- |
| `id`         |                                                         | `string`           | Unique identifier.                                          |
| `ingameName` |                                                         | `string`           | In-game name.                                               |
| `slug`       |                                                         | `string`           | URL-safe slug.                                              |
| `reputation` |                                                         | `int`              | Reputation score.                                           |
| `platform`   |                                                         | `string`           | Gaming platform.                                            |
| `crossplay`  |                                                         | `boolean`          | Whether the user supports cross-platform trading.           |
| `locale`     |                                                         | `string`           | Preferred communication language.                           |
| `status`     |                                                         | `string`           | Current online status. `invisible` is exposed as `offline`. |
| `avatar`     | `optional/contextual` | `string`           | Avatar image path.                                          |
| `activity`   |                                                         | `Activity or null` | Current activity, or `null` when no activity is set.        |
| `lastSeen`   |                                                         | `string`           | Last seen timestamp.                                        |

## User

Public user profile.

| Field         | Flags                                                                                                                                                               | Type                                                 | Description                                                                       |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------- |
| `id`          |                                                                                                                                                                     | `string`           | Unique user identifier.                                                           |
| `role`        |                                                                                                                                                                     | `Role`             | User role.                                                                        |
| `tier`        |                                                                                                                                                                     | `Tier`             | Subscription/support tier.                                                        |
| `ingameName`  |                                                                                                                                                                     | `string`           | User's in-game name.                                                              |
| `slug`        |                                                                                                                                                                     | `string`           | URL-safe user slug.                                                               |
| `avatar`      | `optional/contextual`                                                                                                             | `string`           | Avatar image path.                                                                |
| `background`  | `optional/contextual`                                                                                                             | `string`           | Profile background image path.                                                    |
| `about`       |                                                                                                                                                                     | `string`           | Sanitized HTML profile text.                                                      |
| `reputation`  |                                                                                                                                                                     | `int`              | User reputation score.                                                            |
| `masteryRank` |                                                                                                                                                                     | `int`              | Warframe mastery rank; `0` when unset.                                            |
| `status`      |                                                                                                                                                                     | `Status`           | Current online status. `invisible` is exposed as `offline` for public viewers.    |
| `activity`    |                                                                                                                                                                     | `Activity or null` | Current rich activity, or `null` when no activity is set.                         |
| `lastSeen`    |                                                                                                                                                                     | `string`           | Last seen timestamp.                                                              |
| `platform`    |                                                                                                                                                                     | `Platform`         | User's platform.                                                                  |
| `crossplay`   |                                                                                                                                                                     | `boolean`          | Whether the user supports cross-platform trading.                                 |
| `locale`      |                                                                                                                                                                     | `Language`         | User's locale.                                                                    |
| `banned`      | `optional/contextual`                                                                                                             | `boolean`          | Public ban flag.                                                                  |
| `banUntil`    | `optional/contextual`                                                                                                             | `string`           | Public ban expiration timestamp.                                                  |
| `banMessage`  | `optional/contextual` `owner/self` `moderator+` | `string`           | Ban reason, returned to the affected user or moderators+.                         |
| `createdAt`   | `optional/contextual` `moderator+`                                                       | `string`           | Account creation timestamp, returned to moderators+.                              |
| `warned`      | `optional/contextual` `owner/self` `moderator+` | `boolean`          | Warning flag, returned to affected user or moderators+.                           |
| `warnMessage` | `optional/contextual` `owner/self` `moderator+` | `string`           | Warning message, returned to affected user or moderators+.                        |
| `warnedBy`    | `optional/contextual` `owner/self` `moderator+` | `string`           | Moderator/admin user ID that issued the warning.                                  |
| `warnedAt`    | `optional/contextual` `owner/self` `moderator+` | `string`           | Warning timestamp.                                                                |
| `bannedBy`    | `optional/contextual` `owner/self` `moderator+` | `string`           | Moderator/admin user ID that issued the ban.                                      |
| `bannedAt`    | `optional/contextual` `owner/self` `moderator+` | `string`           | Ban timestamp.                                                                    |
| `nameHistory` | `optional/contextual` `moderator+`                                                       | `[]NameHistory`    | Previous names, returned to moderators+ when present.                             |
| `uid`         | `optional/contextual` `moderator+`                                                       | `string`           | Platform-specific unique user identifier, returned to moderators+ when available. |

## UserPrivate

Private self profile returned for the authenticated user.

| Field                 | Flags                                                                                                                                                               | Type                                        | Description                                       |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------- |
| `id`                  |                                                                                                                                                                     | `string`  | Unique identifier.                                |
| `role`                |                                                                                                                                                                     | `string`  | User role.                                        |
| `tier`                |                                                                                                                                                                     | `string`  | Subscription tier.                                |
| `subscription`        |                                                                                                                                                                     | `boolean` | Subscription status.                              |
| `ingameName`          |                                                                                                                                                                     | `string`  | In-game name.                                     |
| `slug`                |                                                                                                                                                                     | `string`  | URL-safe slug.                                    |
| `avatar`              | `optional/contextual`                                                                                                             | `string`  | Avatar image path.                                |
| `background`          | `optional/contextual`                                                                                                             | `string`  | Profile background image path.                    |
| `about`               |                                                                                                                                                                     | `string`  | Sanitized HTML profile text.                      |
| `aboutRaw`            |                                                                                                                                                                     | `string`  | About text in raw markdown.                       |
| `reputation`          |                                                                                                                                                                     | `int`     | Reputation score.                                 |
| `masteryRank`         |                                                                                                                                                                     | `int`     | Warframe mastery rank.                            |
| `credits`             |                                                                                                                                                                     | `int`     | In-game currency balance.                         |
| `lastSeen`            |                                                                                                                                                                     | `string`  | Last seen timestamp.                              |
| `platform`            |                                                                                                                                                                     | `string`  | Gaming platform.                                  |
| `crossplay`           |                                                                                                                                                                     | `boolean` | Whether the user supports cross-platform trading. |
| `locale`              |                                                                                                                                                                     | `string`  | Preferred communication language.                 |
| `theme`               |                                                                                                                                                                     | `string`  | Preferred color scheme for UI.                    |
| `syncLocale`          |                                                                                                                                                                     | `boolean` | Sync locale across devices.                       |
| `syncTheme`           |                                                                                                                                                                     | `boolean` | Sync theme across devices.                        |
| `verification`        |                                                                                                                                                                     | `boolean` | Verification status.                              |
| `checkCode`           |                                                                                                                                                                     | `string`  | Unique check code for the user.                   |
| `createdAt`           | `moderator+`                                                                                                               | `string`  | Account creation timestamp.                       |
| `warned`              | `optional/contextual` `owner/self` `moderator+` | `boolean` | Warning flag.                                     |
| `warnMessage`         | `optional/contextual` `owner/self` `moderator+` | `string`  | Warning message.                                  |
| `warnedBy`            | `optional/contextual` `owner/self` `moderator+` | `string`  | Moderator who issued the warning.                 |
| `banned`              | `optional/contextual` `owner/self` `moderator+` | `boolean` | Ban status.                                       |
| `banUntil`            | `optional/contextual` `owner/self` `moderator+` | `string`  | Ban expiration timestamp.                         |
| `banMessage`          | `optional/contextual` `owner/self` `moderator+` | `string`  | Reason for the ban.                               |
| `bannedBy`            | `optional/contextual` `owner/self` `moderator+` | `string`  | Moderator who issued the ban.                     |
| `unreadNotifications` |                                                                                                                                                                     | `int`     | Count of unread notifications.                    |
| `deleteInProgress`    | `optional/contextual`                                                                                                             | `boolean` | Flag for pending account deletion.                |
| `deleteAt`            | `optional/contextual`                                                                                                             | `string`  | Scheduled deletion date.                          |
| `linkedAccounts`      |                                                                                                                                                                     | `object`  | Accounts linked with the user's profile.          |
| `hasEmail`            | `optional/contextual`                                                                                                             | `boolean` | Whether the user has an email address.            |
| `email`               | `optional/contextual` `first-party`                                                 | `string`  | Email address.                                    |

## Activity

| Field       | Flags                                                   | Type                                       | Description                            |
| ----------- | ------------------------------------------------------- | ------------------------------------------ | -------------------------------------- |
| `type`      |                                                         | `string` | Activity type.                         |
| `details`   | `optional/contextual` | `string` | Optional specifics about the activity. |
| `startedAt` | `optional/contextual` | `string` | Timestamp of the activity start.       |

Activity type values currently include `on_mission`, `dojo`, `unknown`, and an empty string.

## Achievement

| Field             | Flags                                                   | Type                                                         | Description                                                 |
| ----------------- | ------------------------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------- |
| `id`              |                                                         | `string`                   | Unique identifier.                                          |
| `slug`            |                                                         | `string`                   | URL-safe slug.                                              |
| `type`            |                                                         | `string`                   | Type of the achievement.                                    |
| `secret`          | `optional/contextual` | `boolean`                  | If true, hidden from the public.                            |
| `reputationBonus` | `optional/contextual` | `int`                      | Reputation bonus for the achievement.                       |
| `goal`            | `optional/contextual` | `int`                      | Goal to achieve.                                            |
| `i18n`            |                                                         | `object`                   | Localized text map by language code.                        |
| `state`           | `optional/contextual` | `AchievementState or null` | Current state, only present for user-specific achievements. |

### AchievementState

| Field         | Flags                                                   | Type                                            | Description                           |
| ------------- | ------------------------------------------------------- | ----------------------------------------------- | ------------------------------------- |
| `featured`    | `optional/contextual` | `boolean`     | If true, the achievement is featured. |
| `hidden`      | `optional/contextual` | `boolean`     | If true, hidden from the public.      |
| `progress`    | `optional/contextual` | `int or null` | Current progress towards the goal.    |
| `completedAt` | `optional/contextual` | `string`      | Timestamp when achieved.              |

## DashboardShowcase

Mobile app main screen dashboard with featured items.

| Field   | Flags                                                   | Type                                                        | Description                          |
| ------- | ------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------ |
| `i18n`  | `optional/contextual` | `object or null`          | Localized text map by language code. |
| `items` |                                                         | `DashboardShowcaseItem[]` | Featured items.                      |

### DashboardShowcaseItem

| Field           | Flags                                                   | Type                                        | Description                      |
| --------------- | ------------------------------------------------------- | ------------------------------------------- | -------------------------------- |
| `item`          |                                                         | `string`  | Item slug/key.                   |
| `background`    |                                                         | `string`  | Background image path.           |
| `bigCard`       |                                                         | `boolean` | Whether to render as a big card. |
| `label`         | `optional/contextual` | `string`  | Label text.                      |
| `labelPosition` | `optional/contextual` | `string`  | Label position.                  |

## Client

OAuth client model.

| Field         | Flags                                                   | Type                                               | Description                           |
| ------------- | ------------------------------------------------------- | -------------------------------------------------- | ------------------------------------- |
| `id`          |                                                         | `string`         | Unique identifier.                    |
| `slug`        |                                                         | `string`         | URL-safe slug.                        |
| `active`      | `optional/contextual` | `bool or null`   | Whether the client is active.         |
| `firstParty`  | `optional/contextual` | `bool or null`   | Whether this is a first-party client. |
| `logo`        | `optional/contextual` | `string`         | Client logo path.                     |
| `redirectUri` | `optional/contextual` | `string[]`       | Allowed redirect URIs.                |
| `scopes`      | `optional/contextual` | `string[]`       | Granted scopes.                       |
| `secret`      | `optional/contextual` | `string`         | Client secret.                        |
| `i18n`        | `optional/contextual` | `object or null` | Localized client info.                |

### ClientI18N

| Field         | Flags                                                   | Type                                       | Description            |
| ------------- | ------------------------------------------------------- | ------------------------------------------ | ---------------------- |
| `name`        | `optional/contextual` | `string` | Localized client name. |
| `description` | `optional/contextual` | `string` | Localized description. |

## Group

User-defined order or contract group.

| Field    | Flags | Type                                       | Description              |
| -------- | ----- | ------------------------------------------ | ------------------------ |
| `id`     |       | `string` | Unique identifier.       |
| `userId` |       | `string` | Owner user ID.           |
| `kind`   |       | `string` | `orders` or `contracts`. |
| `name`   |       | `string` | Display name.            |

## RichStatus

Rich user status for status endpoints.

| Field         | Flags                                                   | Type                                                 | Description                  |
| ------------- | ------------------------------------------------------- | ---------------------------------------------------- | ---------------------------- |
| `status`      |                                                         | `string`           | Status string.               |
| `statusUntil` | `optional/contextual` | `string`           | Status expiration timestamp. |
| `statusSetAt` |                                                         | `string`           | When the status was set.     |
| `activity`    | `optional/contextual` | `Activity or null` | Current activity.            |

## Versions

Version information for apps and collections.

| Field         | Flags | Type                                       | Description                |
| ------------- | ----- | ------------------------------------------ | -------------------------- |
| `id`          |       | `string` | Unique identifier.         |
| `apps`        |       | `object` | App version info.          |
| `collections` |       | `object` | Collection version hashes. |
| `updatedAt`   |       | `string` | Last update timestamp.     |

### VersionApps

| Field        | Flags | Type                                       | Description                        |
| ------------ | ----- | ------------------------------------------ | ---------------------------------- |
| `ios`        |       | `string` | Latest iOS version.                |
| `android`    |       | `string` | Latest Android version.            |
| `minIos`     |       | `string` | Minimum supported iOS version.     |
| `minAndroid` |       | `string` | Minimum supported Android version. |

### VersionCollections

| Field       | Flags | Type                                       | Description                        |
| ----------- | ----- | ------------------------------------------ | ---------------------------------- |
| `items`     |       | `string` | Items collection version hash.     |
| `rivens`    |       | `string` | Rivens collection version hash.    |
| `liches`    |       | `string` | Liches collection version hash.    |
| `sisters`   |       | `string` | Sisters collection version hash.   |
| `missions`  |       | `string` | Missions collection version hash.  |
| `npcs`      |       | `string` | NPCs collection version hash.      |
| `locations` |       | `string` | Locations collection version hash. |

## Enums And Constants

| Name           | Values                                                                                       |
| -------------- | -------------------------------------------------------------------------------------------- |
| `Status`       | `invisible`, `offline`, `online`, `ingame`                                                   |
| `ActivityType` | `UNKNOWN`, `IDLE`, `ON_MISSION`, `IN_DOJO`, `IN_ORBITER`, `IN_RELAY`                         |
| `Role`         | `none`, `user`, `moderator`, `admin`                                                         |
| `Tier`         | `none`, `bronze`, `silver`, `gold`, `platinum`, `diamond`                                    |
| `Language`     | `ko`, `ru`, `de`, `fr`, `pt`, `zh-hans`, `zh-hant`, `es`, `it`, `pl`, `uk`, `tr`, `ja`, `en` |
| `Platform`     | `pc`, `ps4`, `xbox`, `switch`, `mobile`                                                      |
| `Scope`        | `all`, `orders`, `contracts`, `chats`, `inventory`, `advanceSub`                             |
