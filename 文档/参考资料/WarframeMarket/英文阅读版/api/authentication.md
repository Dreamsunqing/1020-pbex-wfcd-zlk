# Authentication

Session endpoints for first-party clients. OAuth 2.0 authorization-code endpoints are documented separately in [OAuth 2.0](../oauth/overview.md).

## Sign In

`POST /auth/signin`

Sign in with a first-party client and create a session.

Markers: First-party only

**Restriction**

First-party applications only. The client must be a registered first-party client and the request must pass Firebase App Check.

### Request

#### Headers

| Name                  | Type                                       | Description                            |
| --------------------- | ------------------------------------------ | -------------------------------------- |
| `Content-Type`        | `string` | Must be `application/json`.            |
| `X-Firebase-AppCheck` | `string` | Firebase App Check verification token. |

#### Body

```json
{
  "email": "whatever@gmail.com",
  "password": "12345",
  "clientId": "wfm-0000",
  "deviceId": "random unique id",
  "deviceName": "My cool Nokia 3310"
}
```

#### Body Fields

| Field        | Type                                       | Description                                                                                           |
| ------------ | ------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `email`      | `string` | User email. Normalized to lowercase. Max: `128` characters.                                           |
| `password`   | `string` | User password. Min: `1` character for legacy compatibility. Max: `128` characters.                    |
| `clientId`   | `string` | Registered first-party client ID. Min: `6` characters. Max: `64` characters.                          |
| `deviceId`   | `string` | Unique device ID used to bind the session to this device. Min: `6` characters. Max: `256` characters. |
| `deviceName` | `string` | Human-readable device name. Defaults to `Unknown`. Max: `128` characters.                             |

### Response

#### Body

```json
{
  "apiVersion": "x.x.x",
  "data": {
    "accessToken": "...",
    "refreshToken": "...",
    "tokenType": "Bearer",
    "expiresIn": 12345
  },
  "error": null
}
```

#### Data Fields

| Field          | Type                                       | Description                                  |
| -------------- | ------------------------------------------ | -------------------------------------------- |
| `accessToken`  | `string` | JWT access token for authenticated requests. |
| `refreshToken` | `string` | Refresh token for this session.              |
| `tokenType`    | `Bearer` | Token type for the `Authorization` header.   |
| `expiresIn`    | `int`    | Access token lifetime in seconds.            |

## Sign Up

`POST /auth/signup`

Register a new user with a first-party client and create a session.

Markers: First-party only

**Restriction**

First-party applications only. The client must be a registered first-party client and the request must pass Firebase App Check.

### Request

#### Headers

| Name                  | Type                                       | Description                            |
| --------------------- | ------------------------------------------ | -------------------------------------- |
| `Content-Type`        | `string` | Must be `application/json`.            |
| `X-Firebase-AppCheck` | `string` | Firebase App Check verification token. |

#### Body

```json
{
  "email": "whatever@gmail.com",
  "password": "123456",
  "passwordConfirmation": "123456",
  "clientId": "wfm-0000",
  "deviceId": "random unique id",
  "deviceName": "My Nokia 3310",
  "platform": "pc",
  "locale": "ko"
}
```

#### Body Fields

| Field                  | Type                                         | Description                                                                                           |
| ---------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `email`                | `string`   | User email. Normalized to lowercase. Max: `128` characters.                                           |
| `password`             | `string`   | User password. Min: `6` characters. Max: `128` characters.                                            |
| `passwordConfirmation` | `string`   | Must match `password`. Min: `6` characters. Max: `128` characters.                                    |
| `clientId`             | `string`   | Registered first-party client ID. Min: `6` characters. Max: `64` characters.                          |
| `deviceId`             | `string`   | Unique device ID used to bind the session to this device. Min: `6` characters. Max: `256` characters. |
| `deviceName`           | `string`   | Human-readable device name. Defaults to `Unknown`. Max: `128` characters.                             |
| `platform`             | `Platform` | User's starting platform. Must be one of the supported platforms.                                     |
| `locale`               | `Language` | Preferred communication language.                                                                     |

### Response

#### Body

```json
{
  "apiVersion": "x.x.x",
  "data": {
    "accessToken": "...",
    "refreshToken": "...",
    "tokenType": "Bearer",
    "expiresIn": 12345
  },
  "error": null
}
```

## Refresh Session

`POST /auth/refresh`

Refresh a session using a refresh token.

This endpoint does not use the `Authorization` header.

**App Check**

First-party clients must include `X-Firebase-AppCheck`. Third-party clients do not use this header.

### Request

#### Headers

| Name                  | Type                                       | Description                                                    |
| --------------------- | ------------------------------------------ | -------------------------------------------------------------- |
| `Content-Type`        | `string` | Must be `application/json`.                                    |
| `X-Firebase-AppCheck` | `string` | Required only when `clientId` belongs to a first-party client. |

#### Body

```json
{
  "grantType": "refresh_token",
  "clientId": "wfm-0000",
  "deviceId": "BASD001-KSADFDG",
  "refreshToken": "JwtRefreshToken"
}
```

#### Body Fields

| Field          | Type                                              | Description                                                                         |
| -------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `grantType`    | `refresh_token` | OAuth-style grant type for refresh-token flow.                                      |
| `clientId`     | `string`        | Registered client ID. Min: `6` characters. Max: `64` characters.                    |
| `deviceId`     | `string`        | Device ID bound to the session. Min: `6` characters. Max: `256` characters.         |
| `refreshToken` | `string`        | Refresh token for the existing session. Min: `6` characters. Max: `256` characters. |

### Response

#### Body

```json
{
  "apiVersion": "x.x.x",
  "data": {
    "accessToken": "...",
    "refreshToken": "...",
    "tokenType": "Bearer",
    "expiresIn": 12345
  },
  "error": null
}
```

## Sign Out

`POST /auth/signout`

Terminate the current session.

Markers: Auth required

The current access token and its session refresh tokens become unusable.

**Requires**

- Authentication

### Request

#### Headers

| Name            | Type                                    | Description                                                 |
| --------------- | --------------------------------------- | ----------------------------------------------------------- |
| `Authorization` | `string` | JWT access token in the format `Bearer YourJWTAccessToken`. |

### Response

Empty response body with status code `200`.
