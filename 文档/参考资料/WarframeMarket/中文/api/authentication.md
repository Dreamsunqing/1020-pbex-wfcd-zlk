# 身份认证

供第一方客户端使用的会话接口。OAuth 2.0 授权码接口另见 [OAuth 2.0](../oauth/overview.md)。

## 登录

`POST /auth/signin`

通过第一方客户端登录并创建会话。

标记：仅限第一方

**限制**

仅供第一方应用使用。客户端必须是已注册的第一方客户端，请求必须通过 Firebase App Check。

### 请求

#### 请求头

| 名称 | 类型 | 说明 |
| --------------------- | ------------------------------------------ | -------------------------------------- |
| `Content-Type` | `string` | 必须为 `application/json`。 |
| `X-Firebase-AppCheck` | `string` | Firebase App Check 验证令牌。 |

#### 正文

```json
{
  "email": "whatever@gmail.com",
  "password": "12345",
  "clientId": "wfm-0000",
  "deviceId": "random unique id",
  "deviceName": "My cool Nokia 3310"
}
```

#### 请求体字段

| 字段 | 类型 | 说明 |
| ------------ | ------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `email` | `string` | 用户邮箱。统一转为小写。最多 `128` 个字符。 |
| `password` | `string` | 用户密码。为兼容旧版，最少 `1` 个字符。最多 `128` 个字符。 |
| `clientId` | `string` | 已注册的第一方客户端 ID。最少 `6` 个字符，最多 `64` 个字符。 |
| `deviceId` | `string` | 将会话绑定到此设备的唯一设备 ID。最少 `6` 个字符，最多 `256` 个字符。 |
| `deviceName` | `string` | 便于人阅读的设备名称。默认为 `Unknown`，最多 `128` 个字符。 |

### 响应

#### 正文

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

#### 数据字段

| 字段 | 类型 | 说明 |
| -------------- | ------------------------------------------ | -------------------------------------------- |
| `accessToken` | `string` | 用于已认证请求的 JWT 访问令牌。 |
| `refreshToken` | `string` | 此会话的刷新令牌。 |
| `tokenType` | `Bearer` | `Authorization` 请求头使用的令牌类型。 |
| `expiresIn` | `int` | 访问令牌的有效期，单位为秒。 |

## 注册

`POST /auth/signup`

通过第一方客户端注册新用户并创建会话。

标记：仅限第一方

**限制**

仅供第一方应用使用。客户端必须是已注册的第一方客户端，请求必须通过 Firebase App Check。

### 请求

#### 请求头

| 名称 | 类型 | 说明 |
| --------------------- | ------------------------------------------ | -------------------------------------- |
| `Content-Type` | `string` | 必须为 `application/json`。 |
| `X-Firebase-AppCheck` | `string` | Firebase App Check 验证令牌。 |

#### 正文

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

#### 请求体字段

| 字段 | 类型 | 说明 |
| ---------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `email` | `string` | 用户邮箱。统一转为小写。最多 `128` 个字符。 |
| `password` | `string` | 用户密码。最少 `6` 个字符，最多 `128` 个字符。 |
| `passwordConfirmation` | `string` | 必须与 `password` 一致。最少 `6` 个字符，最多 `128` 个字符。 |
| `clientId` | `string` | 已注册的第一方客户端 ID。最少 `6` 个字符，最多 `64` 个字符。 |
| `deviceId` | `string` | 将会话绑定到此设备的唯一设备 ID。最少 `6` 个字符，最多 `256` 个字符。 |
| `deviceName` | `string` | 便于人阅读的设备名称。默认为 `Unknown`，最多 `128` 个字符。 |
| `platform` | `Platform` | 用户的初始平台，必须是受支持的平台之一。 |
| `locale` | `Language` | 首选交流语言。 |

### 响应

#### 正文

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

## 刷新会话

`POST /auth/refresh`

使用刷新令牌刷新会话。

此接口不使用 `Authorization` 请求头。

**App Check**

第一方客户端必须提供 `X-Firebase-AppCheck`。第三方客户端不使用此请求头。

### 请求

#### 请求头

| 名称 | 类型 | 说明 |
| --------------------- | ------------------------------------------ | -------------------------------------------------------------- |
| `Content-Type` | `string` | 必须为 `application/json`。 |
| `X-Firebase-AppCheck` | `string` | 仅当 `clientId` 属于第一方客户端时必需。 |

#### 正文

```json
{
  "grantType": "refresh_token",
  "clientId": "wfm-0000",
  "deviceId": "BASD001-KSADFDG",
  "refreshToken": "JwtRefreshToken"
}
```

#### 请求体字段

| 字段 | 类型 | 说明 |
| -------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `grantType` | `refresh_token` | 用于刷新令牌流程的 OAuth 风格授权类型。 |
| `clientId` | `string` | 已注册的客户端 ID。最少 `6` 个字符，最多 `64` 个字符。 |
| `deviceId` | `string` | 绑定到会话的设备 ID。最少 `6` 个字符，最多 `256` 个字符。 |
| `refreshToken` | `string` | 现有会话的刷新令牌。最少 `6` 个字符，最多 `256` 个字符。 |

### 响应

#### 正文

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

## 退出登录

`POST /auth/signout`

终止当前会话。

标记：需要认证

当前访问令牌及此会话的刷新令牌都会失效。

**前置要求**

- 身份认证

### 请求

#### 请求头

| 名称 | 类型 | 说明 |
| --------------- | --------------------------------------- | ----------------------------------------------------------- |
| `Authorization` | `string` | JWT 访问令牌，格式为 `Bearer YourJWTAccessToken`。 |

### 响应

响应体为空，状态码为 `200`。
