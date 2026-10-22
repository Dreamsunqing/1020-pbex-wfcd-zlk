# Users

Endpoints for authenticated user data, public profiles, and profile media uploads.

## Get Me

`GET /v2/me`

Get information about the authenticated user.

Markers: Auth required

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
  data: UserPrivate,
  error: null,
}
```

`data` is a [UserPrivate](../data-models.md#userprivate) model.

## Update Me

`PATCH /v2/me`

Update the authenticated user's profile preferences.

Markers: Auth required

**Requires**

- Authentication

### Request

#### Body

```json
{
  "about": "something",
  "platform": "mobile",
  "crossplay": true,
  "locale": "pt",
  "theme": "light",
  "syncLocale": true,
  "syncTheme": true
}
```

#### Body Fields

| Field        | Type                                                       | Description                                                                                                             |
| ------------ | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `about`      | `string`                 | Profile description in Markdown. Max: `300` characters. Returned as `about` HTML and `aboutRaw` Markdown.               |
| `platform`   | `Platform`               | Main platform the user plays on.                                                                                        |
| `crossplay`  | `bool`                   | Whether crossplay is enabled for the user's Warframe account. Cannot be `true` when the effective platform is `switch`. |
| `locale`     | `Language`               | UI locale and preferred communication language.                                                                         |
| `theme`      | `light, dark, or system` | UI theme preference.                                                                                                    |
| `syncLocale` | `bool`                   | Whether locale should sync across devices.                                                                              |
| `syncTheme`  | `bool`                   | Whether theme should sync across devices.                                                                               |

#### Constraints

- Omitted or `null` fields are ignored.
- If `platform` is set to `switch` and `crossplay` is omitted, `crossplay` is set to `false`.
- If `crossplay` is `true` while the effective platform is `switch`, the request is rejected.

### Response

#### Body

```ts
{
  apiVersion: "x.x.x",
  data: UserPrivate,
  error: null,
}
```

## Upload Avatar

`POST /v2/me/avatar`

Update the authenticated user's avatar.

Markers: Auth required, File upload

The uploaded image is center-cropped to the target aspect ratio, resized to `256x256` pixels, encoded as WebP, and stored as the new avatar.

### Request

#### Body

Content-Type: `multipart/form-data`

```http
form-data; name="avatar"; filename="whatever.png"
```

#### Body Fields

| Field    | Type                                     | Description                             |
| -------- | ---------------------------------------- | --------------------------------------- |
| `avatar` | `file` | Image file to upload as the new avatar. |

#### Constraints

- Accepts image formats: `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`, `.bmp`, `.avif`.
- Maximum upload size is `5 MiB`.

### Response

#### Body

```ts
{
  apiVersion: "x.x.x",
  data: UserPrivate,
  error: null,
}
```

## Upload Background

`POST /v2/me/background`

Update the authenticated user's profile background.

Markers: Auth required, Silver tier+, File upload

**Subscription Requirement**

Requires the user to have at least a silver subscription tier.

The uploaded image is center-cropped to the target aspect ratio, resized to `1920x820` pixels, encoded as WebP, and stored as the new background.

### Request

#### Body

Content-Type: `multipart/form-data`

```http
form-data; name="background"; filename="whatever.png"
```

#### Body Fields

| Field        | Type                                     | Description                                 |
| ------------ | ---------------------------------------- | ------------------------------------------- |
| `background` | `file` | Image file to upload as the new background. |

#### Constraints

- Accepts image formats: `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`, `.bmp`, `.avif`.
- Maximum upload size is `8 MiB`.

### Response

#### Body

```ts
{
  apiVersion: "x.x.x",
  data: UserPrivate,
  error: null,
}
```

## Get User

`GET /v2/user/{slug}`

Get public information about a user.

Alternative: `/v2/userId/{userId}`

Users with role `moderator` or higher may receive moderation fields described in the `User` model.

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
  data: User,
  error: null,
}
```

`data` is a [User](../data-models.md#user) model.
