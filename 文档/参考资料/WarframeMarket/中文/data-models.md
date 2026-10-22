# 数据模型

Warframe.market API 使用的可复用公开 JSON 结构和枚举值。

- 可选／依上下文返回
- 所有者／本人
- 版主及以上
- 第一方
- 需要认证
- 不稳定

**字段标记**

`Flags` 为空表示字段公开且通常存在于该模型中。`optional/contextual` 表示仅在特定物品类型、用户上下文、接口结构、语言／平台上下文或数据存在时返回。

## Item

包含全部可能字段的完整物品模型。

| 字段 | 标记 | 类型 | 说明 |
| ---------------- | ------------------------------------------------------- | ----------------------------------------------------------- | -------------------------------------------- |
| `id` |  | `string` | 唯一标识符。 |
| `slug` |  | `string` | URL 安全的 slug。 |
| `gameRef` |  | `string` | Warframe 游戏内部引用路径。 |
| `tags` |  | `[]string` | 物品标签。 |
| `setRoot` | `optional/contextual` | `boolean` | 该物品是否为套装根物品。 |
| `setParts` | `optional/contextual` | `[]string` | 套装成员物品 ID。 |
| `quantityInSet` | `optional/contextual` | `int` | 套装内的物品数量。 |
| `rarity` | `optional/contextual` | `string` | 物品稀有度。 |
| `bulkTradable` | `optional/contextual` | `boolean` | 物品是否支持批量交易。 |
| `subtypes` | `optional/contextual` | `[]string` | 物品子类型。 |
| `maxRank` | `optional/contextual` | `int` | 最高等级。 |
| `maxCharges` | `optional/contextual` | `int` | 最大使用次数。 |
| `maxAmberStars` | `optional/contextual` | `int` | 最大琥珀星数。 |
| `maxCyanStars` | `optional/contextual` | `int` | 最大青蓝星数。 |
| `baseEndo` | `optional/contextual` | `int` | 基础 Endo（内融核心）值。 |
| `endoMultiplier` | `optional/contextual` | `number` | Endo（内融核心）倍率。 |
| `ducats` | `optional/contextual` | `int` | 杜卡德金币价值。 |
| `vosfor` | `optional/contextual` | `int` | Vosfor 价值。 |
| `reqMasteryRank` | `optional/contextual` | `int` | 所需段位。 |
| `vaulted` | `optional/contextual` | `boolean` | 物品是否已入库。 |
| `tradingTax` | `optional/contextual` | `int` | 交易税。 |
| `i18n` | `optional/contextual` | `map[string]ItemI18NJson` | 本地化物品数据，以语言代码为键。 |
| `tradable` | `optional/contextual` | `boolean` | 物品是否可交易。 |

### ItemI18NJson

| 字段 | 标记 | 类型 | 说明 |
| ------------- | ------------------------------------------------------- | ------------------------------------------ | ---------------------- |
| `name` |  | `string` | 显示名称。 |
| `description` | `optional/contextual` | `string` | 物品说明。 |
| `wikiLink` | `optional/contextual` | `string` | Wiki 页面链接。 |
| `icon` |  | `string` | 图标图片路径。 |
| `thumb` |  | `string` | 缩略图路径。 |
| `subIcon` | `optional/contextual` | `string` | 子图标图片路径。 |

## Riven Item

包含全部可能字段的完整紫卡武器模型。`rivenType` 目前包含 `kitgun`、`melee`、`pistol`、`rifle`、`shotgun` 和 `zaw`，未来可能增加新值。前端用 `group` 进行显示分组。

| 字段 | 标记 | 类型 | 说明 |
| ---------------- | ------------------------------------------------------- | ------------------------------------------ | -------------------------------------- |
| `id` |  | `string` | 唯一标识符。 |
| `slug` |  | `string` | URL 安全的 slug。 |
| `gameRef` |  | `string` | Warframe 游戏内部引用路径。 |
| `group` | `optional/contextual` | `string` | 分组类别。 |
| `rivenType` | `optional/contextual` | `string` | 武器类型。 |
| `disposition` |  | `number` | 倾向值。 |
| `reqMasteryRank` |  | `int` | 所需段位。 |

### RivenItemI18NJson

| 字段 | 标记 | 类型 | 说明 |
| ---------- | ------------------------------------------------------- | ------------------------------------------ | ---------------------- |
| `name` |  | `string` | 显示名称。 |
| `wikiLink` | `optional/contextual` | `string` | Wiki 页面链接。 |
| `icon` |  | `string` | 图标图片路径。 |
| `thumb` |  | `string` | 缩略图路径。 |
| `subIcon` |  | `string` | 子图标图片路径。 |

## Riven Attribute

包含全部可能字段的完整紫卡属性模型。

| 字段 | 标记 | 类型 | 说明 |
| -------------------- | ------------------------------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------- |
| `id` |  | `string` | 唯一标识符。 |
| `slug` |  | `string` | URL 安全的 slug。 |
| `gameRef` |  | `string` | Warframe 游戏内部引用路径。 |
| `group` | `optional/contextual` | `string` | 分组类别。 |
| `prefix` |  | `string` | 前缀名称。 |
| `suffix` |  | `string` | 后缀名称。 |
| `exclusiveTo` | `optional/contextual` | `[]string` | 此属性专属的紫卡类型。 |
| `positiveIsNegative` | `optional/contextual` | `boolean` | 正值是否视为负面效果。 |
| `unit` | `optional/contextual` | `string` | 计量单位。 |
| `positiveOnly` | `optional/contextual` | `boolean` | 此属性是否只能有正值。 |
| `negativeOnly` | `optional/contextual` | `boolean` | 此属性是否只能有负值。 |
| `i18n` | `optional/contextual` | `map[string]RivenAttributeI18NJson` | 以语言代码为键的本地化文字映射。 |

### RivenAttributeI18NJson

| 字段 | 标记 | 类型 | 说明 |
| ------- | ------------------------------------------------------- | ------------------------------------------ | ---------------------- |
| `name` | `optional/contextual` | `string` | 属性效果名称。 |
| `icon` | `optional/contextual` | `string` | 图标图片路径。 |
| `thumb` | `optional/contextual` | `string` | 缩略图路径。 |

## Lich Weapon

| 字段 | 标记 | 类型 | 说明 |
| ---------------- | ------------------------------------------------------- | ----------------------------------------------------------------- | -------------------------------------- |
| `id` |  | `string` | 唯一标识符。 |
| `slug` |  | `string` | URL 安全的 slug。 |
| `gameRef` |  | `string` | Warframe 游戏内部引用路径。 |
| `reqMasteryRank` |  | `int` | 所需段位。 |
| `i18n` | `optional/contextual` | `map[string]LichWeaponI18NJson` | 以语言代码为键的本地化文字映射。 |

### LichWeaponI18NJson

| 字段 | 标记 | 类型 | 说明 |
| ---------- | ----- | ------------------------------------------ | ---------------------- |
| `name` |  | `string` | 显示名称。 |
| `wikiLink` |  | `string` | Wiki 页面链接。 |
| `icon` |  | `string` | 图标图片路径。 |
| `thumb` |  | `string` | 缩略图路径。 |

## Lich Ephemera

| 字段 | 标记 | 类型 | 说明 |
| ----------- | ------------------------------------------------------- | ------------------------------------------------------------------- | -------------------------------------- |
| `id` |  | `string` | 唯一标识符。 |
| `slug` |  | `string` | URL 安全的 slug。 |
| `gameRef` |  | `string` | Warframe 游戏内部引用路径。 |
| `animation` |  | `string` | 动画路径。 |
| `element` |  | `string` | 元素类型。 |
| `i18n` | `optional/contextual` | `map[string]LichEphemeraI18NJson` | 以语言代码为键的本地化文字映射。 |

### LichEphemeraI18NJson

| 字段 | 标记 | 类型 | 说明 |
| ------- | ----- | ------------------------------------------ | --------------------- |
| `name` |  | `string` | 显示名称。 |
| `icon` |  | `string` | 图标图片路径。 |
| `thumb` |  | `string` | 缩略图路径。 |

## Lich Quirk

| 字段 | 标记 | 类型 | 说明 |
| ------- | ------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------ |
| `id` |  | `string` | 唯一标识符。 |
| `slug` |  | `string` | URL 安全的 slug。 |
| `group` | `optional/contextual` | `string` | 分组类别。 |
| `i18n` | `optional/contextual` | `map[string]LichQuirkI18NJson` | 以语言代码为键的本地化文字映射。 |

### LichQuirkI18NJson

| 字段 | 标记 | 类型 | 说明 |
| ------------- | ----- | ------------------------------------------ | --------------------- |
| `name` |  | `string` | 显示名称。 |
| `description` |  | `string` | 怪癖说明。 |
| `icon` |  | `string` | 图标图片路径。 |
| `thumb` |  | `string` | 缩略图路径。 |

## Sister Weapon

| 字段 | 标记 | 类型 | 说明 |
| ---------------- | ------------------------------------------------------- | ------------------------------------------------------------------- | -------------------------------------- |
| `id` |  | `string` | 唯一标识符。 |
| `slug` |  | `string` | URL 安全的 slug。 |
| `gameRef` |  | `string` | Warframe 游戏内部引用路径。 |
| `reqMasteryRank` |  | `int` | 所需段位。 |
| `i18n` | `optional/contextual` | `map[string]SisterWeaponI18NJson` | 以语言代码为键的本地化文字映射。 |

### SisterWeaponI18NJson

| 字段 | 标记 | 类型 | 说明 |
| ---------- | ----- | ------------------------------------------ | ---------------------- |
| `name` |  | `string` | 显示名称。 |
| `wikiLink` |  | `string` | Wiki 页面链接。 |
| `icon` |  | `string` | 图标图片路径。 |
| `thumb` |  | `string` | 缩略图路径。 |

## Sister Ephemera

| 字段 | 标记 | 类型 | 说明 |
| ----------- | ------------------------------------------------------- | --------------------------------------------------------------------- | -------------------------------------- |
| `id` |  | `string` | 唯一标识符。 |
| `slug` |  | `string` | URL 安全的 slug。 |
| `gameRef` |  | `string` | Warframe 游戏内部引用路径。 |
| `animation` |  | `string` | 动画路径。 |
| `element` |  | `string` | 元素类型。 |
| `i18n` | `optional/contextual` | `map[string]SisterEphemeraI18NJson` | 以语言代码为键的本地化文字映射。 |

### SisterEphemeraI18NJson

| 字段 | 标记 | 类型 | 说明 |
| ------- | ----- | ------------------------------------------ | --------------------- |
| `name` |  | `string` | 显示名称。 |
| `icon` |  | `string` | 图标图片路径。 |
| `thumb` |  | `string` | 缩略图路径。 |

## Sister Quirk

| 字段 | 标记 | 类型 | 说明 |
| ------- | ------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------ |
| `id` |  | `string` | 唯一标识符。 |
| `slug` |  | `string` | URL 安全的 slug。 |
| `group` | `optional/contextual` | `string` | 分组类别。 |
| `i18n` | `optional/contextual` | `map[string]SisterQuirkI18NJson` | 以语言代码为键的本地化文字映射。 |

### SisterQuirkI18NJson

| 字段 | 标记 | 类型 | 说明 |
| ------------- | ----- | ------------------------------------------ | --------------------- |
| `name` |  | `string` | 显示名称。 |
| `description` |  | `string` | 怪癖说明。 |
| `icon` |  | `string` | 图标图片路径。 |
| `thumb` |  | `string` | 缩略图路径。 |

## Npc

| 字段 | 标记 | 类型 | 说明 |
| --------- | ------------------------------------------------------- | ---------------------------------------------------------- | -------------------------------------- |
| `id` |  | `string` | 唯一标识符。 |
| `slug` |  | `string` | URL 安全的 slug。 |
| `gameRef` |  | `string` | Warframe 游戏内部引用路径。 |
| `i18n` | `optional/contextual` | `map[string]NpcI18NJson` | 以语言代码为键的本地化文字映射。 |

### NpcI18NJson

| 字段 | 标记 | 类型 | 说明 |
| ------- | ----- | ------------------------------------------ | --------------------- |
| `name` |  | `string` | 显示名称。 |
| `icon` |  | `string` | 图标图片路径。 |
| `thumb` |  | `string` | 缩略图路径。 |

## Location

| 字段 | 标记 | 类型 | 说明 |
| ---------- | ------------------------------------------------------- | --------------------------------------------------------------- | -------------------------------------- |
| `id` |  | `string` | 唯一标识符。 |
| `slug` |  | `string` | URL 安全的 slug。 |
| `gameRef` |  | `string` | Warframe 游戏内部引用路径。 |
| `faction` | `optional/contextual` | `string` | 派系名称。 |
| `minLevel` | `optional/contextual` | `int` | 任务最低等级。 |
| `maxLevel` | `optional/contextual` | `int` | 任务最高等级。 |
| `i18n` | `optional/contextual` | `map[string]LocationI18NJson` | 以语言代码为键的本地化文字映射。 |

### LocationI18NJson

| 字段 | 标记 | 类型 | 说明 |
| ------------ | ----- | ------------------------------------------ | --------------------- |
| `nodeName` |  | `string` | 节点显示名称。 |
| `systemName` |  | `string` | 星系名称。 |
| `icon` |  | `string` | 图标图片路径。 |
| `thumb` |  | `string` | 缩略图路径。 |

## Mission

| 字段 | 标记 | 类型 | 说明 |
| --------- | ------------------------------------------------------- | -------------------------------------------------------------- | -------------------------------------- |
| `id` |  | `string` | 唯一标识符。 |
| `slug` |  | `string` | URL 安全的 slug。 |
| `gameRef` |  | `string` | Warframe 游戏内部引用路径。 |
| `i18n` | `optional/contextual` | `map[string]MissionI18NJson` | 以语言代码为键的本地化文字映射。 |

### MissionI18NJson

| 字段 | 标记 | 类型 | 说明 |
| ------- | ----- | ------------------------------------------ | --------------------- |
| `name` |  | `string` | 显示名称。 |
| `icon` |  | `string` | 图标图片路径。 |
| `thumb` |  | `string` | 缩略图路径。 |

## Order

不指定所有者的订单。用于所有者已知的上下文，例如用户个人资料或自己的个人资料。

| 字段 | 标记 | 类型 | 说明 |
| ------------ | ------------------------------------------------------- | --------------------------------------------- | ------------------------------------------------- |
| `id` |  | `string` | 唯一标识符。 |
| `type` |  | `string` | `buy` 或 `sell`。 |
| `platinum` |  | `int` | 白金总额。 |
| `quantity` |  | `int` | 物品数量。 |
| `perTrade` | `optional/contextual` | `int` | 每次交易的物品数量。 |
| `subtype` | `optional/contextual` | `string` | 具体子类型或类别。 |
| `rank` | `optional/contextual` | `int` | 物品的等级。 |
| `charges` | `optional/contextual` | `int` | 剩余使用次数。 |
| `amberStars` | `optional/contextual` | `int` | 雕塑中的琥珀星数。 |
| `cyanStars` | `optional/contextual` | `int` | 雕塑中的青蓝星数。 |
| `visible` |  | `boolean` | 订单是否公开可见。 |
| `createdAt` |  | `string` | 创建时间戳。 |
| `updatedAt` |  | `string` | 最近修改时间戳。 |
| `itemId` | `optional/contextual` | `string` | 物品标识符。 |
| `groupId` | `optional/contextual` | `string` | 用户定义的分组。默认分组名为 `all`。 |
| `user` | `optional/contextual` | `UserShort` | 创建订单的用户。 |

## Transaction

表示已全部或部分关闭的订单。

| 字段 | 标记 | 类型 | 说明 |
| ----------- | ------------------------------------------------------- | --------------------------------------------- | ----------------------------------------- |
| `id` |  | `string` | 唯一标识符。 |
| `type` |  | `string` | 交易类型。 |
| `originId` |  | `string` | 原订单标识符。 |
| `platinum` |  | `number` | 白金数量。 |
| `quantity` |  | `int` | 物品数量。 |
| `createdAt` |  | `string` | 创建时间戳。 |
| `updatedAt` |  | `string` | 最近修改时间戳。 |
| `item` | `optional/contextual` | `TxItem` | 交易涉及的物品详情。 |
| `user` | `optional/contextual` | `UserShort` | 交易涉及的用户。 |

### TxItem

| 字段 | 标记 | 类型 | 说明 |
| ------------ | ------------------------------------------------------- | ------------------------------------------ | --------------------- |
| `id` | `optional/contextual` | `string` | 物品标识符。 |
| `rank` | `optional/contextual` | `int` | 物品等级。 |
| `charges` | `optional/contextual` | `int` | 使用次数。 |
| `subtype` | `optional/contextual` | `string` | 物品子类型。 |
| `amberStars` | `optional/contextual` | `int` | 琥珀星数。 |
| `cyanStars` | `optional/contextual` | `int` | 青蓝星数。 |

## UserShort

订单、交易和其他嵌入式用户引用中返回的精简用户模型。

| 字段 | 标记 | 类型 | 说明 |
| ------------ | ------------------------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------- |
| `id` |  | `string` | 唯一标识符。 |
| `ingameName` |  | `string` | 游戏内名称。 |
| `slug` |  | `string` | URL 安全的 slug。 |
| `reputation` |  | `int` | 声望分数。 |
| `platform` |  | `string` | 游戏平台。 |
| `crossplay` |  | `boolean` | 用户是否支持跨平台交易。 |
| `locale` |  | `string` | 首选交流语言。 |
| `status` |  | `string` | 当前在线状态。`invisible` 对外显示为 `offline`。 |
| `avatar` | `optional/contextual` | `string` | 头像图片路径。 |
| `activity` |  | `Activity or null` | 当前活动；未设置活动时为 `null`。 |
| `lastSeen` |  | `string` | 最后在线时间戳。 |

## User

公开用户资料。

| 字段 | 标记 | 类型 | 说明 |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------- |
| `id` |  | `string` | 唯一用户标识符。 |
| `role` |  | `Role` | 用户角色。 |
| `tier` |  | `Tier` | 订阅／支持等级。 |
| `ingameName` |  | `string` | 用户的游戏内名称。 |
| `slug` |  | `string` | URL 安全的用户 slug。 |
| `avatar` | `optional/contextual` | `string` | 头像图片路径。 |
| `background` | `optional/contextual` | `string` | 个人资料背景图片路径。 |
| `about` |  | `string` | 经过清理的 HTML 个人简介。 |
| `reputation` |  | `int` | 用户声望分数。 |
| `masteryRank` |  | `int` | Warframe 段位；未设置时为 `0`。 |
| `status` |  | `Status` | 当前在线状态。对公开访问者，`invisible` 显示为 `offline`。 |
| `activity` |  | `Activity or null` | 当前丰富活动信息；未设置活动时为 `null`。 |
| `lastSeen` |  | `string` | 最后在线时间戳。 |
| `platform` |  | `Platform` | 用户平台。 |
| `crossplay` |  | `boolean` | 用户是否支持跨平台交易。 |
| `locale` |  | `Language` | 用户语言区域。 |
| `banned` | `optional/contextual` | `boolean` | 公开封禁标记。 |
| `banUntil` | `optional/contextual` | `string` | 公开封禁到期时间戳。 |
| `banMessage` | `optional/contextual` `owner/self` `moderator+` | `string` | 封禁原因，向受影响用户或版主及以上用户返回。 |
| `createdAt` | `optional/contextual` `moderator+` | `string` | 账号创建时间戳，向版主及以上用户返回。 |
| `warned` | `optional/contextual` `owner/self` `moderator+` | `boolean` | 警告标记，向受影响用户或版主及以上用户返回。 |
| `warnMessage` | `optional/contextual` `owner/self` `moderator+` | `string` | 警告消息，向受影响用户或版主及以上用户返回。 |
| `warnedBy` | `optional/contextual` `owner/self` `moderator+` | `string` | 发出警告的版主／管理员用户 ID。 |
| `warnedAt` | `optional/contextual` `owner/self` `moderator+` | `string` | 警告时间戳。 |
| `bannedBy` | `optional/contextual` `owner/self` `moderator+` | `string` | 实施封禁的版主／管理员用户 ID。 |
| `bannedAt` | `optional/contextual` `owner/self` `moderator+` | `string` | 封禁时间戳。 |
| `nameHistory` | `optional/contextual` `moderator+` | `[]NameHistory` | 曾用名；存在时向版主及以上用户返回。 |
| `uid` | `optional/contextual` `moderator+` | `string` | 平台专属唯一用户标识符；可用时向版主及以上用户返回。 |

## UserPrivate

向已认证用户返回的本人私有资料。

| 字段 | 标记 | 类型 | 说明 |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------- |
| `id` |  | `string` | 唯一标识符。 |
| `role` |  | `string` | 用户角色。 |
| `tier` |  | `string` | 订阅等级。 |
| `subscription` |  | `boolean` | 订阅状态。 |
| `ingameName` |  | `string` | 游戏内名称。 |
| `slug` |  | `string` | URL 安全的 slug。 |
| `avatar` | `optional/contextual` | `string` | 头像图片路径。 |
| `background` | `optional/contextual` | `string` | 个人资料背景图片路径。 |
| `about` |  | `string` | 经过清理的 HTML 个人简介。 |
| `aboutRaw` |  | `string` | 原始 Markdown 个人简介。 |
| `reputation` |  | `int` | 声望分数。 |
| `masteryRank` |  | `int` | Warframe 段位。 |
| `credits` |  | `int` | 游戏内货币余额。 |
| `lastSeen` |  | `string` | 最后在线时间戳。 |
| `platform` |  | `string` | 游戏平台。 |
| `crossplay` |  | `boolean` | 用户是否支持跨平台交易。 |
| `locale` |  | `string` | 首选交流语言。 |
| `theme` |  | `string` | 首选界面配色方案。 |
| `syncLocale` |  | `boolean` | 跨设备同步语言区域。 |
| `syncTheme` |  | `boolean` | 跨设备同步主题。 |
| `verification` |  | `boolean` | 验证状态。 |
| `checkCode` |  | `string` | 用户唯一校验码。 |
| `createdAt` | `moderator+` | `string` | 账号创建时间戳。 |
| `warned` | `optional/contextual` `owner/self` `moderator+` | `boolean` | 警告标记。 |
| `warnMessage` | `optional/contextual` `owner/self` `moderator+` | `string` | 警告消息。 |
| `warnedBy` | `optional/contextual` `owner/self` `moderator+` | `string` | 发出警告的版主。 |
| `banned` | `optional/contextual` `owner/self` `moderator+` | `boolean` | 封禁状态。 |
| `banUntil` | `optional/contextual` `owner/self` `moderator+` | `string` | 封禁到期时间戳。 |
| `banMessage` | `optional/contextual` `owner/self` `moderator+` | `string` | 封禁原因。 |
| `bannedBy` | `optional/contextual` `owner/self` `moderator+` | `string` | 实施封禁的版主。 |
| `unreadNotifications` |  | `int` | 未读通知数。 |
| `deleteInProgress` | `optional/contextual` | `boolean` | 待删除账号标记。 |
| `deleteAt` | `optional/contextual` | `string` | 计划删除日期。 |
| `linkedAccounts` |  | `object` | 与用户资料关联的账号。 |
| `hasEmail` | `optional/contextual` | `boolean` | 用户是否有邮箱地址。 |
| `email` | `optional/contextual` `first-party` | `string` | 邮箱地址。 |

## Activity

| 字段 | 标记 | 类型 | 说明 |
| ----------- | ------------------------------------------------------- | ------------------------------------------ | -------------------------------------- |
| `type` |  | `string` | 活动类型。 |
| `details` | `optional/contextual` | `string` | 可选的活动详情。 |
| `startedAt` | `optional/contextual` | `string` | 活动开始时间戳。 |

活动类型目前包含 `on_mission`、`dojo`、`unknown` 和空字符串。

## Achievement

| 字段 | 标记 | 类型 | 说明 |
| ----------------- | ------------------------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------- |
| `id` |  | `string` | 唯一标识符。 |
| `slug` |  | `string` | URL 安全的 slug。 |
| `type` |  | `string` | 成就类型。 |
| `secret` | `optional/contextual` | `boolean` | 若为 true，则不向公众显示。 |
| `reputationBonus` | `optional/contextual` | `int` | 成就带来的声望加成。 |
| `goal` | `optional/contextual` | `int` | 需要达成的目标。 |
| `i18n` |  | `object` | 以语言代码为键的本地化文字映射。 |
| `state` | `optional/contextual` | `AchievementState or null` | 当前状态，仅在用户专属成就中存在。 |

### AchievementState

| 字段 | 标记 | 类型 | 说明 |
| ------------- | ------------------------------------------------------- | ----------------------------------------------- | ------------------------------------- |
| `featured` | `optional/contextual` | `boolean` | 若为 true，则为精选成就。 |
| `hidden` | `optional/contextual` | `boolean` | 若为 true，则不向公众显示。 |
| `progress` | `optional/contextual` | `int or null` | 达成目标的当前进度。 |
| `completedAt` | `optional/contextual` | `string` | 达成时间戳。 |

## DashboardShowcase

移动应用主屏幕仪表盘，包含精选物品。

| 字段 | 标记 | 类型 | 说明 |
| ------- | ------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------ |
| `i18n` | `optional/contextual` | `object or null` | 以语言代码为键的本地化文字映射。 |
| `items` |  | `DashboardShowcaseItem[]` | 精选物品。 |

### DashboardShowcaseItem

| 字段 | 标记 | 类型 | 说明 |
| --------------- | ------------------------------------------------------- | ------------------------------------------- | -------------------------------- |
| `item` |  | `string` | 物品 slug／键。 |
| `background` |  | `string` | 背景图片路径。 |
| `bigCard` |  | `boolean` | 是否渲染为大卡片。 |
| `label` | `optional/contextual` | `string` | 标签文字。 |
| `labelPosition` | `optional/contextual` | `string` | 标签位置。 |

## Client

OAuth 客户端模型。

| 字段 | 标记 | 类型 | 说明 |
| ------------- | ------------------------------------------------------- | -------------------------------------------------- | ------------------------------------- |
| `id` |  | `string` | 唯一标识符。 |
| `slug` |  | `string` | URL 安全的 slug。 |
| `active` | `optional/contextual` | `bool or null` | 客户端是否启用。 |
| `firstParty` | `optional/contextual` | `bool or null` | 是否为第一方客户端。 |
| `logo` | `optional/contextual` | `string` | 客户端标志图片路径。 |
| `redirectUri` | `optional/contextual` | `string[]` | 允许的重定向 URI。 |
| `scopes` | `optional/contextual` | `string[]` | 已授予的 scope。 |
| `secret` | `optional/contextual` | `string` | 客户端密钥。 |
| `i18n` | `optional/contextual` | `object or null` | 本地化客户端信息。 |

### ClientI18N

| 字段 | 标记 | 类型 | 说明 |
| ------------- | ------------------------------------------------------- | ------------------------------------------ | ---------------------- |
| `name` | `optional/contextual` | `string` | 本地化客户端名称。 |
| `description` | `optional/contextual` | `string` | 本地化说明。 |

## Group

用户定义的订单或合约分组。

| 字段 | 标记 | 类型 | 说明 |
| -------- | ----- | ------------------------------------------ | ------------------------ |
| `id` |  | `string` | 唯一标识符。 |
| `userId` |  | `string` | 所有者用户 ID。 |
| `kind` |  | `string` | `orders` 或 `contracts`。 |
| `name` |  | `string` | 显示名称。 |

## RichStatus

状态接口使用的丰富用户状态。

| 字段 | 标记 | 类型 | 说明 |
| ------------- | ------------------------------------------------------- | ---------------------------------------------------- | ---------------------------- |
| `status` |  | `string` | 状态字符串。 |
| `statusUntil` | `optional/contextual` | `string` | 状态到期时间戳。 |
| `statusSetAt` |  | `string` | 状态设置时间。 |
| `activity` | `optional/contextual` | `Activity or null` | 当前活动。 |

## Versions

应用和集合的版本信息。

| 字段 | 标记 | 类型 | 说明 |
| ------------- | ----- | ------------------------------------------ | -------------------------- |
| `id` |  | `string` | 唯一标识符。 |
| `apps` |  | `object` | 应用版本信息。 |
| `collections` |  | `object` | 集合版本哈希。 |
| `updatedAt` |  | `string` | 最近更新时间戳。 |

### VersionApps

| 字段 | 标记 | 类型 | 说明 |
| ------------ | ----- | ------------------------------------------ | ---------------------------------- |
| `ios` |  | `string` | 最新 iOS 版本。 |
| `android` |  | `string` | 最新 Android 版本。 |
| `minIos` |  | `string` | 最低受支持 iOS 版本。 |
| `minAndroid` |  | `string` | 最低受支持 Android 版本。 |

### VersionCollections

| 字段 | 标记 | 类型 | 说明 |
| ----------- | ----- | ------------------------------------------ | ---------------------------------- |
| `items` |  | `string` | 物品集合版本哈希。 |
| `rivens` |  | `string` | 紫卡集合版本哈希。 |
| `liches` |  | `string` | 赤毒玄骸集合版本哈希。 |
| `sisters` |  | `string` | 帕尔沃斯姐妹集合版本哈希。 |
| `missions` |  | `string` | 任务集合版本哈希。 |
| `npcs` |  | `string` | NPC 集合版本哈希。 |
| `locations` |  | `string` | 地点集合版本哈希。 |

## 枚举与常量

| 名称 | 值 |
| -------------- | -------------------------------------------------------------------------------------------- |
| `Status` | `invisible`, `offline`, `online`, `ingame` |
| `ActivityType` | `UNKNOWN`, `IDLE`, `ON_MISSION`, `IN_DOJO`, `IN_ORBITER`, `IN_RELAY` |
| `Role` | `none`, `user`, `moderator`, `admin` |
| `Tier` | `none`, `bronze`, `silver`, `gold`, `platinum`, `diamond` |
| `Language` | `ko`, `ru`, `de`, `fr`, `pt`, `zh-hans`, `zh-hant`, `es`, `it`, `pl`, `uk`, `tr`, `ja`, `en` |
| `Platform` | `pc`, `ps4`, `xbox`, `switch`, `mobile` |
| `Scope` | `all`, `orders`, `contracts`, `chats`, `inventory`, `advanceSub` |
