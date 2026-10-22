# 成就

用于公开成就和用户成就进度的接口。

## 列出成就

`GET /v2/achievements`

获取所有可用成就。

标记：支持语言切换

除非请求者拥有 `admin` 角色，否则省略隐藏成就。

### 请求

#### URL 参数

无。

### 响应

#### 正文

```ts
{
  apiVersion: "x.x.x",
  data: Achievement[],
  error: null,
}
```

`data` 是 [Achievement](../data-models.md#achievement) 模型数组。

## 获取用户成就

`GET /v2/achievements/user/{slug}`

获取某个用户的成就。

别名：`/v2/achievements/userId/{userId}`

标记：支持语言切换

匿名用户和无关用户不会收到隐藏成就。被查询用户本人以及角色为 `moderator` 或更高的用户可以收到隐藏成就。

### 请求

#### URL 参数

| 名称 | 类型 | 说明 |
| -------- | ------------------------------------------ | ------------------------------------------------------------ |
| `slug` | `string` | [User](../data-models.md#user) 模型的 `slug` 字段。 |
| `userId` | `string` | [User](../data-models.md#user) 模型的 `id` 字段。 |

#### 查询参数

| 名称 | 类型 | 说明 |
| ---------- | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `featured` | `presence flag` | 只要提供此参数，就只返回 `state.featured` 为 `true` 的成就。参数值会被忽略，因此 `?featured=false` 仍会启用筛选。 |

### 响应

#### 正文

```ts
{
  apiVersion: "x.x.x",
  data: Achievement[],
  error: null,
}
```

`data` 是 [Achievement](../data-models.md#achievement) 模型数组。
