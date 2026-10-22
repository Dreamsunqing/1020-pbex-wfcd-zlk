# Orders

Endpoints for marketplace orders.

## Get Recent Orders

`GET /v2/orders/recent`

Get the most recent visible orders from non-banned users.

Markers: Platform/crossplay aware, 1m refresh

Returns up to `500` visible orders created in the last `4h`, sorted by `createdAt` descending. Results include only users currently online.

### Request

#### URL Parameters

None.

### Response

#### Body

```ts
{
  apiVersion: "x.x.x",
  data: Order[],
  error: null,
}
```

`data` is an array of [Order](../data-models.md#order) models.

## Get Orders By Item

`GET /v2/orders/item/{slug}`

Get visible orders for an item.

Alternative: `/v2/orders/itemId/{itemId}`

Markers: Platform/crossplay aware

Returns visible orders from non-banned users whose `lastSeen` is within the last `48h`, or whose `lastSeen` is missing. Current user status is refreshed in the response, but offline users are not removed by this endpoint.

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
  data: Order[],
  error: null,
}
```

`data` is an array of [Order](../data-models.md#order) models.

## Get Top Orders By Item

`GET /v2/orders/item/{slug}/top`

Get the top buy and sell orders for an item from online users.

Alternative: `/v2/orders/itemId/{itemId}/top`

Markers: Platform/crossplay aware, Custom ranking

The response contains up to `5` `sell` orders and up to `5` `buy` orders.

Sell orders are ranked from the buyer's point of view: Endo listings first, then better Endo-per-platinum ratio for Endo listings, otherwise lower platinum-per-trade first.

Buy orders are ranked from the seller's point of view: Endo listings first, then lower Endo-per-platinum ratio for Endo listings, otherwise higher platinum-per-trade first.

### Request

#### URL Parameters

| Name     | Type                                       | Description                                                  |
| -------- | ------------------------------------------ | ------------------------------------------------------------ |
| `slug`   | `string` | `slug` field from the [Item](../data-models.md#item) model. |
| `itemId` | `string` | `id` field from the [Item](../data-models.md#item) model.   |

#### Query Parameters

| Name           | Type                                       | Description                                                                                                                                       |
| -------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `rank`         | `int`    | Exact item rank. Accepted range: `0` to item max rank. Ignored when the item has no ranks or when `rankLt` is provided.                           |
| `rankLt`       | `int`    | Match ranks lower than this value. Accepted range: `1` to item max rank. Takes precedence over `rank`.                                            |
| `charges`      | `int`    | Exact remaining charges. Accepted range: `0` to item max charges. Ignored when the item has no charges or when `chargesLt` is provided.           |
| `chargesLt`    | `int`    | Match remaining charges lower than this value. Accepted range: `1` to item max charges. Takes precedence over `charges`.                          |
| `amberStars`   | `int`    | Exact amber star count. Accepted range: `0` to item max amber stars. Ignored when the item has no amber stars or when `amberStarsLt` is provided. |
| `amberStarsLt` | `int`    | Match amber star counts lower than this value. Accepted range: `1` to item max amber stars. Takes precedence over `amberStars`.                   |
| `cyanStars`    | `int`    | Exact cyan star count. Accepted range: `0` to item max cyan stars. Ignored when the item has no cyan stars or when `cyanStarsLt` is provided.     |
| `cyanStarsLt`  | `int`    | Match cyan star counts lower than this value. Accepted range: `1` to item max cyan stars. Takes precedence over `cyanStars`.                      |
| `subtype`      | `string` | Exact item subtype. Must be one of the subtypes supported by the item. Ignored when the item has no subtypes.                                     |

### Response

#### Body

```ts
{
  apiVersion: "x.x.x",
  data: {
    sell: Order[],
    buy: Order[],
  },
  error: null,
}
```

#### Data Fields

| Field  | Type                                        | Description                                                                     |
| ------ | ------------------------------------------- | ------------------------------------------------------------------------------- |
| `sell` | `Order[]` | Up to `5` sell orders from online users, sorted from the buyer's point of view. |
| `buy`  | `Order[]` | Up to `5` buy orders from online users, sorted from the seller's point of view. |

## Get Orders By User

`GET /v2/orders/user/{slug}`

Get orders from a specific user.

Alternative: `/v2/orders/userId/{userId}`

Anonymous users and unrelated users receive only visible orders. The requested user and users with role `moderator` or higher receive visible and hidden orders.

### Request

#### URL Parameters

| Name     | Type                                       | Description                                                  |
| -------- | ------------------------------------------ | ------------------------------------------------------------ |
| `slug`   | `string` | `slug` field from the [User](../data-models.md#user) model. |
| `userId` | `string` | `id` field from the [User](../data-models.md#user) model.   |

### Response

#### Body

```ts
{
  apiVersion: "x.x.x",
  data: Order[],
  error: null,
}
```

`data` is an array of compact [Order](../data-models.md#order) models.

## Get My Orders

`GET /v2/orders/my`

Get all orders associated with the authenticated user.

Markers: Auth required

Returns visible and hidden orders.

**Requires**

- Authentication

### Request

#### URL Parameters

None.

### Response

#### Body

```ts
{
  apiVersion: "x.x.x",
  data: Order[],
  error: null,
}
```

`data` is an array of compact [Order](../data-models.md#order) models.

## Get Order

`GET /v2/order/{id}`

Get one order by ID.

### Request

#### URL Parameters

| Name | Type                                       | Description                                                  |
| ---- | ------------------------------------------ | ------------------------------------------------------------ |
| `id` | `string` | `id` field from the [Order](../data-models.md#order) model. |

### Response

#### Body

```ts
{
  apiVersion: "x.x.x",
  data: Order,
  error: null,
}
```

`data` is a compact [Order](../data-models.md#order) model.

## Create Order

`POST /v2/order`

Create a new order.

Markers: Auth required

**Requires**

- Authentication
- Verified account
- User must not be banned

### Request

#### Body

```json
{
  "itemId": "54aae292e7798909064f1575",
  "type": "sell",
  "platinum": 38,
  "quantity": 12,
  "visible": true,
  "perTrade": 6,
  "rank": 5,
  "charges": 3,
  "subtype": "blueprint",
  "amberStars": 3,
  "cyanStars": 3
}
```

#### Body Fields

| Field        | Type                                            | Description                                                                                            |
| ------------ | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `itemId`     | `string`      | Required. Item ID. Item must exist and be tradable.                                                    |
| `type`       | `sell or buy` | Required. Order type.                                                                                  |
| `platinum`   | `int`         | Required. Price in platinum. Min: `1`. Max: `900000`.                                                  |
| `quantity`   | `int`         | Required. Order quantity. Min: `1`. Max: `9999`.                                                       |
| `visible`    | `bool`        | Whether the order is visible. Defaults to `false` when omitted.                                        |
| `perTrade`   | `int`         | Required for bulk-tradable items, forbidden otherwise. Min: `1`. Max: `6`. Must divide `quantity`.     |
| `rank`       | `int`         | Required when the item supports ranks, forbidden otherwise. Min: `0`. Max: item max rank.              |
| `charges`    | `int`         | Required when the item supports charges, forbidden otherwise. Min: `0`. Max: item max charges.         |
| `subtype`    | `string`      | Required when the item has subtypes, forbidden otherwise. Must be one of the item's subtypes.          |
| `amberStars` | `int`         | Required when the item supports amber stars, forbidden otherwise. Min: `0`. Max: item max amber stars. |
| `cyanStars`  | `int`         | Required when the item supports cyan stars, forbidden otherwise. Min: `0`. Max: item max cyan stars.   |

### Response

#### Body

```ts
{
  apiVersion: "x.x.x",
  data: Order,
  error: null,
}
```

`data` is a compact [Order](../data-models.md#order) model.

## Update Order

`PATCH /v2/order/{id}`

Patch an existing order.

Markers: Auth required

**Requires**

- Authentication
- Verified account
- Order owner or role `admin` and higher

### Request

#### URL Parameters

| Name | Type                                       | Description                                                  |
| ---- | ------------------------------------------ | ------------------------------------------------------------ |
| `id` | `string` | `id` field from the [Order](../data-models.md#order) model. |

#### Body

```json
{
  "platinum": 10,
  "quantity": 12,
  "perTrade": 3,
  "rank": 1,
  "charges": 2,
  "amberStars": 2,
  "cyanStars": 2,
  "subtype": "blueprint",
  "visible": false
}
```

#### Body Fields

| Field        | Type                                       | Description                                                                               |
| ------------ | ------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `platinum`   | `int`    | Price in platinum. Min: `1`. Max: `900000`.                                               |
| `quantity`   | `int`    | Order quantity. Min: `1`. Max: `9999`.                                                    |
| `visible`    | `bool`   | Whether the order is visible.                                                             |
| `perTrade`   | `int`    | Allowed only for bulk-tradable items. Min: `1`. Max: `6`. Must divide the final quantity. |
| `rank`       | `int`    | Allowed only when the item supports ranks. Min: `0`. Max: item max rank.                  |
| `charges`    | `int`    | Allowed only when the item supports charges. Min: `0`. Max: item max charges.             |
| `subtype`    | `string` | Allowed only when the item has subtypes. Must be one of the item's subtypes.              |
| `amberStars` | `int`    | Allowed only when the item supports amber stars. Min: `0`. Max: item max amber stars.     |
| `cyanStars`  | `int`    | Allowed only when the item supports cyan stars. Min: `0`. Max: item max cyan stars.       |

### Response

#### Body

```ts
{
  apiVersion: "x.x.x",
  data: Order,
  error: null,
}
```

## Delete Order

`DELETE /v2/order/{id}`

Delete an order.

Markers: Auth required, Deletes data

**Requires**

- Authentication
- Verified account
- Order owner or role `admin` and higher

### Request

#### URL Parameters

| Name | Type                                       | Description                                                  |
| ---- | ------------------------------------------ | ------------------------------------------------------------ |
| `id` | `string` | `id` field from the [Order](../data-models.md#order) model. |

### Response

#### Body

```ts
{
  apiVersion: "x.x.x",
  data: Order,
  error: null,
}
```

## Close Order

`POST /v2/order/{id}/close`

Close a portion or all of an existing order.

Markers: Auth required

If `quantity` is greater than the remaining order quantity, the service closes the remaining quantity. A full close deletes the order; a partial close updates the remaining quantity.

**Requires**

- Authentication
- Verified account
- User must not be banned
- Order owner or role `admin` and higher

### Request

#### URL Parameters

| Name | Type                                       | Description                                                  |
| ---- | ------------------------------------------ | ------------------------------------------------------------ |
| `id` | `string` | `id` field from the [Order](../data-models.md#order) model. |

#### Body

```json
{
  "quantity": 12
}
```

#### Body Fields

| Field      | Type                                    | Description                                                                         |
| ---------- | --------------------------------------- | ----------------------------------------------------------------------------------- |
| `quantity` | `int` | Units to close. Min: `1`. Max: `9999`. Must be divisible by the order's `perTrade`. |

### Response

#### Body

```ts
{
  apiVersion: "x.x.x",
  data: Transaction,
  error: null,
}
```

`data` is a compact [Transaction](../data-models.md#transaction) model.

## Update Order Group Visibility

`PATCH /v2/orders/group/{id}`

Update visibility for a virtual order group.

Markers: Auth required

**Requires**

- Authentication
- Verified account

### Request

#### URL Parameters

| Name | Type                                       | Description                                               |
| ---- | ------------------------------------------ | --------------------------------------------------------- |
| `id` | `string` | Group ID. Currently supported values: `all`, `ungrouped`. |

#### Body

```json
{
  "visible": false,
  "type": "sell"
}
```

#### Body Fields

| Field     | Type                                            | Description                                                       |
| --------- | ----------------------------------------------- | ----------------------------------------------------------------- |
| `visible` | `bool`        | Visibility state to apply. Defaults to `false` when omitted.      |
| `type`    | `sell or buy` | Restrict the update to one order type. Omit to update both types. |

### Response

#### Body

```json
{
  "apiVersion": "x.x.x",
  "data": {
    "updated": 13
  },
  "error": null
}
```

#### Data Fields

| Field     | Type                                    | Description               |
| --------- | --------------------------------------- | ------------------------- |
| `updated` | `int` | Number of orders updated. |
