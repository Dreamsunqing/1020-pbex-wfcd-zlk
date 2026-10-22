# 清单与集合

用于版本元数据和公开集合清单的接口。

## 获取版本

`GET /v2/versions`

获取当前服务器、应用和集合的版本。

客户端可以轮询此接口，判断何时需要刷新本地缓存的集合。

### 请求

#### URL 参数

无。

### 响应

#### 正文

```json
{
  "apiVersion": "x.x.x",
  "data": {
    "apps": {
      "ios": "x.x.x",
      "android": "x.x.x",
      "minIos": "x.x.x",
      "minAndroid": "x.x.x"
    },
    "collections": {
      "items": "base64",
      "rivens": "base64",
      "liches": "base64",
      "sisters": "base64",
      "missions": "base64",
      "npcs": "base64",
      "locations": "base64"
    },
    "updatedAt": "2021-05-21T14:59:02Z"
  },
  "error": null
}
```

#### 数据字段

| 字段 | 类型 | 说明 |
| ------------- | ------------------------------------------------------ | -------------------------------------------------- |
| `apps` | `VersionApps` | 当前移动应用版本和最低受支持版本。 |
| `collections` | `VersionCollections` | 集合版本哈希。 |
| `updatedAt` | `string` | 最近一次版本更新时间戳。 |

参见 [Versions](../data-models.md#versions)。

## 列出物品

`GET /v2/items`

获取所有可交易物品。

标记：支持语言切换

### 请求

#### URL 参数

无。

### 响应

#### 正文

```ts
{
  apiVersion: "x.x.x",
  data: Item[],
  error: null,
}
```

`data` 是 [Item](../data-models.md#item) 模型数组。

## 获取物品

`GET /v2/item/{slug}`

获取单个物品的完整信息。

别名：`/v2/itemId/{itemId}`

标记：支持语言切换

### 请求

#### URL 参数

| 名称 | 类型 | 说明 |
| -------- | ------------------------------------------ | ------------------------------------------------------------ |
| `slug` | `string` | [Item](../data-models.md#item) 模型的 `slug` 字段。 |
| `itemId` | `string` | [Item](../data-models.md#item) 模型的 `id` 字段。 |

### 响应

#### 正文

```ts
{
  apiVersion: "x.x.x",
  data: Item,
  error: null,
}
```

`data` 是 [Item](../data-models.md#item) 模型。

## 获取物品套装

`GET /v2/item/{slug}/set`

获取请求的物品及其相关套装物品。

别名：`/v2/itemId/{itemId}/set`

标记：支持语言切换

如果请求的物品不属于套装，响应仅包含该物品。如果属于套装或本身是套装根物品，响应包含套装内的所有物品。

### 请求

#### URL 参数

| 名称 | 类型 | 说明 |
| -------- | ------------------------------------------ | ------------------------------------------------------------ |
| `slug` | `string` | [Item](../data-models.md#item) 模型的 `slug` 字段。 |
| `itemId` | `string` | [Item](../data-models.md#item) 模型的 `id` 字段。 |

### 响应

#### 正文

```ts
{
  apiVersion: "x.x.x",
  data: {
    id: "54a73e65e779893a797fff72",
    items: Item[],
  },
  error: null,
}
```

#### 数据字段

| 字段 | 类型 | 说明 |
| ------- | ------------------------------------------ | -------------------------------------------------------------------------- |
| `id` | `string` | 请求物品的 ID。 |
| `items` | `Item[]` | 套装中的物品；若请求物品不属于套装，则仅包含请求物品。 |

## 列出紫卡武器

`GET /v2/riven/weapons`

获取所有可交易的紫卡武器。

标记：支持语言切换

### 请求

#### URL 参数

无。

### 响应

#### 正文

```ts
{
  apiVersion: "x.x.x",
  data: RivenItem[],
  error: null,
}
```

`data` 是 [Riven Item](../data-models.md#riven-item) 模型数组。

## 获取紫卡武器

`GET /v2/riven/weapon/{slug}`

获取单个紫卡武器的完整信息。

标记：支持语言切换

### 请求

#### URL 参数

| 名称 | 类型 | 说明 |
| ------ | ------------------------------------------ | ------------------------------------------------------------------------ |
| `slug` | `string` | [Riven Item](../data-models.md#riven-item) 模型的 `slug` 字段。 |

### 响应

#### 正文

```ts
{
  apiVersion: "x.x.x",
  data: RivenItem,
  error: null,
}
```

`data` 是 [Riven Item](../data-models.md#riven-item) 模型。

## 列出紫卡属性

`GET /v2/riven/attributes`

获取所有紫卡武器属性。

标记：支持语言切换

### 请求

#### URL 参数

无。

### 响应

#### 正文

```ts
{
  apiVersion: "x.x.x",
  data: RivenAttribute[],
  error: null,
}
```

`data` 是 [Riven Attribute](../data-models.md#riven-attribute) 模型数组。

## 列出赤毒玄骸武器

`GET /v2/lich/weapons`

获取所有可交易的赤毒玄骸武器。

标记：支持语言切换

### 请求

#### URL 参数

无。

### 响应

#### 正文

```ts
{
  apiVersion: "x.x.x",
  data: LichWeapon[],
  error: null,
}
```

`data` 是 [Lich Weapon](../data-models.md#lich-weapon) 模型数组。

## 获取赤毒玄骸武器

`GET /v2/lich/weapon/{slug}`

获取单个赤毒玄骸武器的完整信息。

标记：支持语言切换

### 请求

#### URL 参数

| 名称 | 类型 | 说明 |
| ------ | ------------------------------------------ | -------------------------------------------------------------------------- |
| `slug` | `string` | [Lich Weapon](../data-models.md#lich-weapon) 模型的 `slug` 字段。 |

### 响应

#### 正文

```ts
{
  apiVersion: "x.x.x",
  data: LichWeapon,
  error: null,
}
```

`data` 是 [Lich Weapon](../data-models.md#lich-weapon) 模型。

## 列出赤毒玄骸幻纹

`GET /v2/lich/ephemeras`

获取所有可交易的赤毒玄骸幻纹。

标记：支持语言切换

### 响应

#### 正文

```ts
{
  apiVersion: "x.x.x",
  data: LichEphemera[],
  error: null,
}
```

`data` 是 [Lich Ephemera](../data-models.md#lich-ephemera) 模型数组。

## 列出赤毒玄骸怪癖

`GET /v2/lich/quirks`

获取所有可交易的赤毒玄骸怪癖。

标记：支持语言切换

### 响应

#### 正文

```ts
{
  apiVersion: "x.x.x",
  data: LichQuirk[],
  error: null,
}
```

`data` 是 [Lich Quirk](../data-models.md#lich-quirk) 模型数组。

## 列出帕尔沃斯姐妹武器

`GET /v2/sister/weapons`

获取所有可交易的帕尔沃斯姐妹武器。

标记：支持语言切换

### 响应

#### 正文

```ts
{
  apiVersion: "x.x.x",
  data: SisterWeapon[],
  error: null,
}
```

`data` 是 [Sister Weapon](../data-models.md#sister-weapon) 模型数组。

## 获取帕尔沃斯姐妹武器

`GET /v2/sister/weapon/{slug}`

获取单个帕尔沃斯姐妹武器的完整信息。

标记：支持语言切换

### 请求

#### URL 参数

| 名称 | 类型 | 说明 |
| ------ | ------------------------------------------ | ------------------------------------------------------------------------------ |
| `slug` | `string` | [Sister Weapon](../data-models.md#sister-weapon) 模型的 `slug` 字段。 |

### 响应

#### 正文

```ts
{
  apiVersion: "x.x.x",
  data: SisterWeapon,
  error: null,
}
```

`data` 是 [Sister Weapon](../data-models.md#sister-weapon) 模型。

## 列出帕尔沃斯姐妹幻纹

`GET /v2/sister/ephemeras`

获取所有可交易的帕尔沃斯姐妹幻纹。

标记：支持语言切换

### 响应

#### 正文

```ts
{
  apiVersion: "x.x.x",
  data: SisterEphemera[],
  error: null,
}
```

`data` 是 [Sister Ephemera](../data-models.md#sister-ephemera) 模型数组。

## 列出帕尔沃斯姐妹怪癖

`GET /v2/sister/quirks`

获取所有可交易的帕尔沃斯姐妹怪癖。

标记：支持语言切换

### 响应

#### 正文

```ts
{
  apiVersion: "x.x.x",
  data: SisterQuirk[],
  error: null,
}
```

`data` 是 [Sister Quirk](../data-models.md#sister-quirk) 模型数组。

## 列出地点

`GET /v2/locations`

获取所有已知地点。

标记：支持语言切换

### 响应

#### 正文

```ts
{
  apiVersion: "x.x.x",
  data: Location[],
  error: null,
}
```

`data` 是 [Location](../data-models.md#location) 模型数组。

## 列出 NPC

`GET /v2/npcs`

获取所有已知 NPC。

标记：支持语言切换

### 响应

#### 正文

```ts
{
  apiVersion: "x.x.x",
  data: Npc[],
  error: null,
}
```

`data` 是 [Npc](../data-models.md#npc) 模型数组。

## 列出任务

`GET /v2/missions`

获取所有已知任务。

标记：支持语言切换

### 响应

#### 正文

```ts
{
  apiVersion: "x.x.x",
  data: Mission[],
  error: null,
}
```

`data` 是 [Mission](../data-models.md#mission) 模型数组。
