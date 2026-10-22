# 用户

用于已认证用户数据、公开个人资料和个人资料媒体上传的接口。

## 获取当前用户

`GET /v2/me`

获取已认证用户的信息。

标记：需要认证

**前置要求**

- 身份认证

### 请求

#### URL 参数

无。

### 响应

#### 正文

```ts
{
  apiVersion: "x.x.x",
  data: UserPrivate,
  error: null,
}
```

`data` 是 [UserPrivate](../data-models.md#userprivate) 模型。

## 更新当前用户

`PATCH /v2/me`

更新已认证用户的个人资料偏好。

标记：需要认证

**前置要求**

- 身份认证

### 请求

#### 正文

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

#### 请求体字段

| 字段 | 类型 | 说明 |
| ------------ | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `about` | `string` | Markdown 格式的个人简介。最多 `300` 个字符。以 HTML 格式的 `about` 和 Markdown 格式的 `aboutRaw` 返回。 |
| `platform` | `Platform` | 用户主要游玩的平台。 |
| `crossplay` | `bool` | 用户 Warframe 账号是否启用跨平台联机。实际平台为 `switch` 时不能为 `true`。 |
| `locale` | `Language` | 界面语言及首选交流语言。 |
| `theme` | `light, dark, or system` | 界面主题偏好。 |
| `syncLocale` | `bool` | 是否在设备间同步语言设置。 |
| `syncTheme` | `bool` | 是否在设备间同步主题设置。 |

#### 约束

- 忽略被省略或值为 `null` 的字段。
- 如果 `platform` 为 `switch` 且省略 `crossplay`，则将 `crossplay` 设为 `false`。
- 实际平台为 `switch` 时，若 `crossplay` 为 `true`，请求会被拒绝。

### 响应

#### 正文

```ts
{
  apiVersion: "x.x.x",
  data: UserPrivate,
  error: null,
}
```

## 上传头像

`POST /v2/me/avatar`

更新已认证用户的头像。

标记：需要认证，文件上传

上传图像将居中裁剪至目标宽高比，缩放为 `256x256` 像素，编码为 WebP，并保存为新头像。

### 请求

#### 正文

Content-Type：`multipart/form-data`

```http
form-data; name="avatar"; filename="whatever.png"
```

#### 请求体字段

| 字段 | 类型 | 说明 |
| -------- | ---------------------------------------- | --------------------------------------- |
| `avatar` | `file` | 用于新头像的上传图像文件。 |

#### 约束

- 接受的图像格式：`.png`、`.jpg`、`.jpeg`、`.webp`、`.gif`、`.bmp`、`.avif`。
- 上传大小上限为 `5 MiB`。

### 响应

#### 正文

```ts
{
  apiVersion: "x.x.x",
  data: UserPrivate,
  error: null,
}
```

## 上传背景

`POST /v2/me/background`

更新已认证用户的个人资料背景。

标记：需要认证，白银及以上订阅等级，文件上传

**订阅要求**

用户至少需要白银订阅等级。

上传图像将居中裁剪至目标宽高比，缩放为 `1920x820` 像素，编码为 WebP，并保存为新背景。

### 请求

#### 正文

Content-Type：`multipart/form-data`

```http
form-data; name="background"; filename="whatever.png"
```

#### 请求体字段

| 字段 | 类型 | 说明 |
| ------------ | ---------------------------------------- | ------------------------------------------- |
| `background` | `file` | 用于新背景的上传图像文件。 |

#### 约束

- 接受的图像格式：`.png`、`.jpg`、`.jpeg`、`.webp`、`.gif`、`.bmp`、`.avif`。
- 上传大小上限为 `8 MiB`。

### 响应

#### 正文

```ts
{
  apiVersion: "x.x.x",
  data: UserPrivate,
  error: null,
}
```

## 获取用户

`GET /v2/user/{slug}`

获取用户的公开信息。

别名：`/v2/userId/{userId}`

角色为 `moderator` 或更高的用户可能收到 `User` 模型中描述的管理字段。

### 请求

#### URL 参数

| 名称 | 类型 | 说明 |
| -------- | ------------------------------------------ | ------------------------------------------------------------ |
| `slug` | `string` | [User](../data-models.md#user) 模型的 `slug` 字段。 |
| `userId` | `string` | [User](../data-models.md#user) 模型的 `id` 字段。 |

### 响应

#### 正文

```ts
{
  apiVersion: "x.x.x",
  data: User,
  error: null,
}
```

`data` 是 [User](../data-models.md#user) 模型。
