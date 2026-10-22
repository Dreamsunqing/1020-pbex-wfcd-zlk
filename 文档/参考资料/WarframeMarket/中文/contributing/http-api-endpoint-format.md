# HTTP API 接口格式

本页是 HTTP 接口文档风格的 Markdown／MDX 参考。示例仅演示格式，不属于公开 API 契约。

## 视觉表达

接口页面应以 Markdown 为主，路由使用 `ApiEndpoint` 卡片，徽标、提示框和字段类型使用 API 界面组件。

- 需要认证
- 支持语言切换
- 支持平台／跨平台筛选
- 有缓存
- 仅限第一方
- 删除数据

### 约定

- 每个记录的路由行为都使用 `ApiEndpoint`。
- 标准路由放入 `path`，路由变体放入 `aliases`。
- `aliases` 中不要包含 HTTP 方法。
- 徽标以文字为主；图标和表情只作视觉辅助，不能作为唯一含义来源。
- 每个接口分为 `Request` 和 `Response` 两节。
- 在这两节内，用 `####` 标题组织 URL 参数、查询参数、请求头、正文、字段、约束、错误和响应字段。
- 具体且可复制的载荷使用 `json`。
- 包含可复用模型类型的示意响应（如 `data: Order[]`）使用 `ts`。
- 链接到[数据模型](../data-models.md)中的可复用模型，不重复完整结构定义。
- 使用 `ApiCallout` 说明认证要求、限制、响应上下文和实现注释。
- 除非已验证指令渲染，否则不要直接使用 `:::warning` 块。

## 徽标表

解释接口行为时，直接在表格中呈现标记。

| 标记 | 含义 |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| `Auth required` | 接口需要认证，或返回仅认证后可访问的数据。 |
| `Language aware` | 响应随 `Language` 请求头变化。 |
| `Platform/crossplay aware` | 响应随 `Platform` 或 `Crossplay` 请求头变化。 |
| `Cached` | 响应具有已记录的缓存或新鲜度行为。 |
| `First-party only` | 接口仅限第一方客户端或特殊权限访问。 |
| `Deletes data` | 接口会删除数据或执行破坏性操作。 |

## JSON 接口示例

`PATCH /v2/example/{id}`

更新示例资源并返回更新后的模型。

别名：`/v2/exampleSlug/{slug}`

标记：需要认证，支持平台／跨平台筛选，支持语言切换，缓存 60 秒

**前置要求**

- 身份认证
- 权限范围：`examples.update`

**响应上下文**

响应数据取决于 `Platform`、`Crossplay` 和 `Language` 请求头。响应缓存 `60s`。

### 请求

#### URL 参数

| 名称 | 类型 | 说明 |
| ------ | ------------------------------------------ | ----------------------------------------------- |
| `id` | `string` | 所链接模型的 `id` 字段。 |
| `slug` | `string` | 所链接模型中用作替代标识的 `slug` 字段。 |

#### 查询参数

| 名称 | 类型 | 说明 |
| -------- | ------------------------------------------ | ------------------------------------------------------------------------- |
| `limit` | `int` | 可选。记录数上限。默认 `50`，最小 `1`，最大 `100`。 |
| `cursor` | `string` | 可选。上一响应的分页游标。 |

#### 请求头

| 名称 | 类型 | 说明 |
| --------------- | -------------------------------------------- | ----------------------------------------------------------- |
| `Authorization` | `string` | JWT 访问令牌，格式为 `Bearer YourJWTAccessToken`。 |
| `Language` | `Language` | 翻译语言。默认 `en`。 |
| `Platform` | `Platform` | 平台上下文。默认 `pc`。 |
| `Crossplay` | `bool` | 跨平台上下文。默认值取决于接口行为。 |

#### 正文

```json
{
  "name": "Example",
  "visible": true,
  "note": "Optional note"
}
```

#### 请求体字段

| 字段 | 类型 | 说明 |
| --------- | -------------------------------------------------- | --------------------------------------------------- |
| `name` | `string` | 必需。显示名称。最少 `3`，最多 `32`。 |
| `visible` | `bool` | 可选。资源是否可见。 |
| `note` | `string or null` | 可选。仅所有者可见的备注。发送 `null` 可清空。 |

#### 约束

- `name` 对已认证用户必须唯一。
- 提供 `cursor` 时忽略 `limit`。

### 响应

#### 正文

```json
{
  "apiVersion": "x.x.x",
  "data": {
    "id": "example-id",
    "name": "Example",
    "visible": true,
    "note": "Optional note"
  },
  "error": null
}
```

#### 数据字段

| 字段 | 访问权限 | 类型 | 说明 |
| --------- | ------------------------------------------------ | -------------------------------------------------- | -------------------------------- |
| `id` |  | `string` | 示例的唯一标识符。 |
| `name` |  | `string` | 显示名称。 |
| `visible` |  | `bool` | 资源是否可见。 |
| `note` | `owner` | `string or null` | 仅所有者可见的备注。 |

## 模型响应示例

响应体是示意结构且引用可复用模型时，使用 `ts`。

`GET /v2/examples`

获取示例资源列表。

标记：支持语言切换

### 请求

#### URL 参数

无。

### 响应

#### 正文

```ts
{
  apiVersion: "x.x.x",
  data: Example[],
  error: null,
}
```

`data` 是所链接可复用模型结构的数组。

## Multipart 接口示例

`POST /v2/example/{id}/image`

为示例资源上传图像。

标记：需要认证，仅限第一方

**限制**

仅供第一方应用使用。

### 请求

#### URL 参数

| 名称 | 类型 | 说明 |
| ---- | ------------------------------------------ | --------------------------------- |
| `id` | `string` | 所链接模型的 `id` 字段。 |

#### 正文

Content-Type：`multipart/form-data`

```http
form-data; name="image"; filename="example.png"
```

#### 请求体字段

| 字段 | 类型 | 说明 |
| ------- | ---------------------------------------- | --------------------- |
| `image` | `file` | 要上传的图像文件。 |

#### 约束

- 接受的图像格式：`.png`、`.jpg`、`.jpeg`、`.webp`、`.gif`、`.bmp`、`.avif`。
- 上传大小上限为 `5 MiB`。
- 以图像中心为重点，缩放至 `256x256` 像素。

### 响应

#### 正文

```json
{
  "apiVersion": "x.x.x",
  "data": {
    "id": "example-id",
    "imageUrl": "https://example.com/example.png"
  },
  "error": null
}
```

## 空响应示例

`DELETE /v2/example/{id}`

删除示例资源。

标记：需要认证，删除数据

### 请求

#### URL 参数

| 名称 | 类型 | 说明 |
| ---- | ------------------------------------------ | --------------------------------- |
| `id` | `string` | 所链接模型的 `id` 字段。 |

### 响应

**空响应**

响应体为空，状态码为 `200`。

## 可复制的骨架

新接口可使用此骨架。

````mdx
## Endpoint Name

<ApiEndpoint
  method="GET"
  path="/v2/example/{id}"
  aliases={['/v2/exampleSlug/{slug}']}
  summary="Short behavior description."
  badges={[{ kind: 'auth', icon: '🔒', label: 'Auth required' }]}
/>

<ApiCallout kind="warning" icon="🔒" title="Requires">

- Authentication

</ApiCallout>

### Request

#### URL Parameters

| Name | Type                                       | Description            |
| ---- | ------------------------------------------ | ---------------------- |
| `id` | <ApiBadge kind="neutral" label="string" /> | Parameter description. |

#### Query Parameters

| Name    | Type                                    | Description              |
| ------- | --------------------------------------- | ------------------------ |
| `limit` | <ApiBadge kind="neutral" label="int" /> | Optional. Default: `50`. |

#### Body

```json
{
  "field": "value"
}
```

#### Body Fields

| Field   | Type                                       | Description        |
| ------- | ------------------------------------------ | ------------------ |
| `field` | <ApiBadge kind="neutral" label="string" /> | Field description. |

### Response

#### Body

```ts
{
  apiVersion: "x.x.x",
  data: Example,
  error: null,
}
```
````

## 禁止事项

- 不要记录尚未实现的路由。
- 不要在 `aliases` 中包含 HTTP 方法。
- 不要在路由文字前散放徽标行；使用 `ApiEndpoint`。
- 不要将 `json` 用于 `"data": "Order"` 或 `"data": ["Order"]` 等模型占位符；使用 `ts` 并链接模型。
- 不要在接口页面重复可复用模型结构。
- 不要为每个小节创建嵌套自定义容器。
- 不要使用仅适用于旧 Notion 的彩色 span。
