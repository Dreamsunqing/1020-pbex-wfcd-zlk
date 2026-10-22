# Achievements

Endpoints for public achievements and user achievement progress.

## List Achievements

`GET /v2/achievements`

Get all available achievements.

Markers: Language aware

Secret achievements are omitted unless the requester has role `admin`.

### Request

#### URL Parameters

None.

### Response

#### Body

```ts
{
  apiVersion: "x.x.x",
  data: Achievement[],
  error: null,
}
```

`data` is an array of [Achievement](../data-models.md#achievement) models.

## Get User Achievements

`GET /v2/achievements/user/{slug}`

Get a user's achievements.

Alternative: `/v2/achievements/userId/{userId}`

Markers: Language aware

Anonymous users and unrelated users do not receive hidden achievements. The requested user and users with role `moderator` or higher can receive hidden achievements.

### Request

#### URL Parameters

| Name     | Type                                       | Description                                                  |
| -------- | ------------------------------------------ | ------------------------------------------------------------ |
| `slug`   | `string` | `slug` field from the [User](../data-models.md#user) model. |
| `userId` | `string` | `id` field from the [User](../data-models.md#user) model.   |

#### Query Parameters

| Name       | Type                                              | Description                                                                                                                                   |
| ---------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `featured` | `presence flag` | When present, return only achievements where `state.featured` is `true`. The value is ignored, so `?featured=false` still enables the filter. |

### Response

#### Body

```ts
{
  apiVersion: "x.x.x",
  data: Achievement[],
  error: null,
}
```

`data` is an array of [Achievement](../data-models.md#achievement) models.
