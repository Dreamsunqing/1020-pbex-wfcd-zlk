# Manifests And Collections

Endpoints for version metadata and public collection manifests.

## Get Versions

`GET /v2/versions`

Get current server, app, and collection versions.

Clients can poll this endpoint to detect when local cached collections should be refreshed.

### Request

#### URL Parameters

None.

### Response

#### Body

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

#### Data Fields

| Field         | Type                                                   | Description                                        |
| ------------- | ------------------------------------------------------ | -------------------------------------------------- |
| `apps`        | `VersionApps`        | Current and minimum supported mobile app versions. |
| `collections` | `VersionCollections` | Collection version hashes.                         |
| `updatedAt`   | `string`             | Last version update timestamp.                     |

See [Versions](../data-models.md#versions).

## List Items

`GET /v2/items`

Get all tradable items.

Markers: Language aware

### Request

#### URL Parameters

None.

### Response

#### Body

```ts
{
  apiVersion: "x.x.x",
  data: Item[],
  error: null,
}
```

`data` is an array of [Item](../data-models.md#item) models.

## Get Item

`GET /v2/item/{slug}`

Get full information about one item.

Alternative: `/v2/itemId/{itemId}`

Markers: Language aware

### Request

#### URL Parameters

| Name     | Type                                       | Description                                                  |
| -------- | ------------------------------------------ | ------------------------------------------------------------ |
| `slug`   | `string` | `slug` field from the [Item](../data-models.md#item) model. |
| `itemId` | `string` | `id` field from the [Item](../data-models.md#item) model.   |

### Response

#### Body

```ts
{
  apiVersion: "x.x.x",
  data: Item,
  error: null,
}
```

`data` is an [Item](../data-models.md#item) model.

## Get Item Set

`GET /v2/item/{slug}/set`

Get the requested item and related set items.

Alternative: `/v2/itemId/{itemId}/set`

Markers: Language aware

If the requested item is not part of a set, the response contains only that item. If the item is part of a set or is the set root, the response contains all items in that set.

### Request

#### URL Parameters

| Name     | Type                                       | Description                                                  |
| -------- | ------------------------------------------ | ------------------------------------------------------------ |
| `slug`   | `string` | `slug` field from the [Item](../data-models.md#item) model. |
| `itemId` | `string` | `id` field from the [Item](../data-models.md#item) model.   |

### Response

#### Body

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

#### Data Fields

| Field   | Type                                       | Description                                                                |
| ------- | ------------------------------------------ | -------------------------------------------------------------------------- |
| `id`    | `string` | ID of the requested item.                                                  |
| `items` | `Item[]` | Items in the set, or only the requested item when it is not part of a set. |

## List Riven Weapons

`GET /v2/riven/weapons`

Get all tradable riven weapons.

Markers: Language aware

### Request

#### URL Parameters

None.

### Response

#### Body

```ts
{
  apiVersion: "x.x.x",
  data: RivenItem[],
  error: null,
}
```

`data` is an array of [Riven Item](../data-models.md#riven-item) models.

## Get Riven Weapon

`GET /v2/riven/weapon/{slug}`

Get full information about one riven weapon.

Markers: Language aware

### Request

#### URL Parameters

| Name   | Type                                       | Description                                                              |
| ------ | ------------------------------------------ | ------------------------------------------------------------------------ |
| `slug` | `string` | `slug` field from the [Riven Item](../data-models.md#riven-item) model. |

### Response

#### Body

```ts
{
  apiVersion: "x.x.x",
  data: RivenItem,
  error: null,
}
```

`data` is a [Riven Item](../data-models.md#riven-item) model.

## List Riven Attributes

`GET /v2/riven/attributes`

Get all riven weapon attributes.

Markers: Language aware

### Request

#### URL Parameters

None.

### Response

#### Body

```ts
{
  apiVersion: "x.x.x",
  data: RivenAttribute[],
  error: null,
}
```

`data` is an array of [Riven Attribute](../data-models.md#riven-attribute) models.

## List Lich Weapons

`GET /v2/lich/weapons`

Get all tradable lich weapons.

Markers: Language aware

### Request

#### URL Parameters

None.

### Response

#### Body

```ts
{
  apiVersion: "x.x.x",
  data: LichWeapon[],
  error: null,
}
```

`data` is an array of [Lich Weapon](../data-models.md#lich-weapon) models.

## Get Lich Weapon

`GET /v2/lich/weapon/{slug}`

Get full information about one lich weapon.

Markers: Language aware

### Request

#### URL Parameters

| Name   | Type                                       | Description                                                                |
| ------ | ------------------------------------------ | -------------------------------------------------------------------------- |
| `slug` | `string` | `slug` field from the [Lich Weapon](../data-models.md#lich-weapon) model. |

### Response

#### Body

```ts
{
  apiVersion: "x.x.x",
  data: LichWeapon,
  error: null,
}
```

`data` is a [Lich Weapon](../data-models.md#lich-weapon) model.

## List Lich Ephemeras

`GET /v2/lich/ephemeras`

Get all tradable lich ephemeras.

Markers: Language aware

### Response

#### Body

```ts
{
  apiVersion: "x.x.x",
  data: LichEphemera[],
  error: null,
}
```

`data` is an array of [Lich Ephemera](../data-models.md#lich-ephemera) models.

## List Lich Quirks

`GET /v2/lich/quirks`

Get all tradable lich quirks.

Markers: Language aware

### Response

#### Body

```ts
{
  apiVersion: "x.x.x",
  data: LichQuirk[],
  error: null,
}
```

`data` is an array of [Lich Quirk](../data-models.md#lich-quirk) models.

## List Sister Weapons

`GET /v2/sister/weapons`

Get all tradable sister weapons.

Markers: Language aware

### Response

#### Body

```ts
{
  apiVersion: "x.x.x",
  data: SisterWeapon[],
  error: null,
}
```

`data` is an array of [Sister Weapon](../data-models.md#sister-weapon) models.

## Get Sister Weapon

`GET /v2/sister/weapon/{slug}`

Get full information about one sister weapon.

Markers: Language aware

### Request

#### URL Parameters

| Name   | Type                                       | Description                                                                    |
| ------ | ------------------------------------------ | ------------------------------------------------------------------------------ |
| `slug` | `string` | `slug` field from the [Sister Weapon](../data-models.md#sister-weapon) model. |

### Response

#### Body

```ts
{
  apiVersion: "x.x.x",
  data: SisterWeapon,
  error: null,
}
```

`data` is a [Sister Weapon](../data-models.md#sister-weapon) model.

## List Sister Ephemeras

`GET /v2/sister/ephemeras`

Get all tradable sister ephemeras.

Markers: Language aware

### Response

#### Body

```ts
{
  apiVersion: "x.x.x",
  data: SisterEphemera[],
  error: null,
}
```

`data` is an array of [Sister Ephemera](../data-models.md#sister-ephemera) models.

## List Sister Quirks

`GET /v2/sister/quirks`

Get all tradable sister quirks.

Markers: Language aware

### Response

#### Body

```ts
{
  apiVersion: "x.x.x",
  data: SisterQuirk[],
  error: null,
}
```

`data` is an array of [Sister Quirk](../data-models.md#sister-quirk) models.

## List Locations

`GET /v2/locations`

Get all known locations.

Markers: Language aware

### Response

#### Body

```ts
{
  apiVersion: "x.x.x",
  data: Location[],
  error: null,
}
```

`data` is an array of [Location](../data-models.md#location) models.

## List NPCs

`GET /v2/npcs`

Get all known NPCs.

Markers: Language aware

### Response

#### Body

```ts
{
  apiVersion: "x.x.x",
  data: Npc[],
  error: null,
}
```

`data` is an array of [Npc](../data-models.md#npc) models.

## List Missions

`GET /v2/missions`

Get all known missions.

Markers: Language aware

### Response

#### Body

```ts
{
  apiVersion: "x.x.x",
  data: Mission[],
  error: null,
}
```

`data` is an array of [Mission](../data-models.md#mission) models.
