# 文档风格

本页是面向贡献者的 Warframe.market 公开文档风格指南。

本仓库记录公开契约：HTTP 接口、WebSocket 消息、OAuth 流程、数据模型，以及交易市场／客户端规则。修改应小而集中、有证据、便于审查。

## 贡献方式

### 仅修改措辞

大多数公开贡献者无法访问私有 API 后端仓库。这不妨碍只改进措辞。

仅修改措辞包括：

- 修正语法、拼写和标点。
- 在不改变行为的前提下，让表述更清楚。
- 改善排版和表格可读性。
- 修复失效链接。
- 修正标题、标签或说明中的错字。

没有后端源码证据时，不要改动请求／响应结构、字段、枚举值、认证要求、状态码、校验规则、WebSocket 路由、scope，或暗示行为变化的示例。

### 契约变更

契约变更需要维护者提供后端源码证据。

契约变更包括：

- HTTP 方法、路径、查询参数、请求头、请求字段、响应字段、状态码、错误、排序、缓存或限流。
- 数据模型的字段、类型、可选性、枚举值、可见性标记或示例。
- WebSocket 路由、载荷字段、命令响应、事件时机、流元数据、认证或 scope。
- OAuth scope、重定向行为、令牌有效期、刷新／撤销行为或错误结构。

维护者通常将私有 API 仓库放在文档仓库旁边的 `../Api`。如果该仓库不可用且修改需要后端验证，请咨询维护者，不要猜测。

## 核心原则

- 记录已实现的公开行为，不凭记忆写预期行为。
- 编辑前先阅读相邻文档，保持术语、标题和风格一致。
- 保持改动小而集中。优先定点修改，避免大范围重写。
- 保持标题稳定，因为其他页面和未来更新可能链接到这些标题。
- 使用表格记录结构化字段、请求头、枚举值、模型属性和错误。
- 链接到可复用数据模型，避免在接口或 WebSocket 页面重复大型结构定义。
- 用徽标和提示框提升浏览效率，但不能只靠图标传达含义。
- 示例应贴近实际、简短且便于维护。

## Markdown 与 MDX

纯文档页面使用 `.md`。

页面需要共享界面组件时使用 `.mdx`，例如：

- `ApiEndpoint`
- `WsMessage`
- `ApiBadge`
- `ApiCallout`
- `BadgeGrid`

不要使用仅适用于旧 Notion 的格式，例如彩色 span。

不要直接使用以下提示块：

```md
:::warning
Text
:::
```

需要带样式的警告、注释或要求框时，改用 `ApiCallout`。

## 代码块

仅对具体、可复制的 JSON 载荷使用 `json`。

```json
{
  "route": "@wfm|cmd/example/doThing",
  "id": "message-id",
  "payload": {
    "enabled": true
  }
}
```

包含模型名或类型占位符的示意结构使用 `ts`。

```ts
{
  apiVersion: "x.x.x",
  data: Order[],
  error: null,
}
```

不要把可复用模型占位符写成 JSON 字符串：

```json
{
  "data": ["Order"]
}
```

这种写法表示包含字符串 `Order` 的数组，而非订单模型数组。

原始 HTTP、multipart 或请求头示例使用 `http`。

```http
form-data; name="avatar"; filename="avatar.png"
```

## HTTP API 页面

详细格式指南见 [HTTP API 接口格式](./http-api-endpoint-format.md)。

HTTP 接口页面通常应使用：

- 使用 `ApiEndpoint` 作为路由卡片。
- 使用 `ApiCallout` 说明认证、限制、缓存注意事项和响应上下文。
- 使用 `### Request` 和 `### Response` 作为接口的两大章节。
- 按需使用 `#### URL Parameters`、`#### Query Parameters`、`#### Headers`、`#### Body`、`#### Body Fields`、`#### Constraints`、`#### Errors` 和 `#### Data Fields`。

替代路由中不要包含 HTTP 方法。

## WebSocket 页面

详细格式指南见 [WebSocket 消息格式](./websocket-message-format.md)。

WebSocket 页面通常应使用：

- 使用 `WsMessage` 作为路由卡片。
- 使用 `ApiCallout` 说明认证、限制和流注意事项。
- 命令使用 `Client Message`、`Payload Fields`、`Success Message` 和 `Error Message` 章节。
- 事件给出示例；载荷内联时增加 `Payload Fields`。
- `payload: Order` 等模型载荷示意使用 `ts` 代码块。

不要记录只有常量定义的 WebSocket 路由。须确认路由已注册并实现。

## 数据模型

数据模型位于[数据模型](../data-models.md)。

模型文档应：

- 使用稳定的 `## ModelName` 标题。
- 使用包含 `Field`、`Flags`、`Type` 和 `Description` 的表格。
- 用徽标表示 `optional/contextual`、`owner/self`、`moderator+` 和 `first-party` 标记。
- 在 HTTP 和 WebSocket 文档中链接到模型章节。
- 避免在接口页面重复完整模型结构。

维护者可用的权威源码为 `../Api/src/internal/wfm/entity_*.json.go`。

## 验证

运行与修改相关的最小检查。

对于文档内容、侧栏、MDX 或链接：

```bash
yarn build
```

对于 TypeScript、React 组件、Docusaurus 配置或共享界面修改：

```bash
yarn typecheck
```

若跳过验证，说明原因并列出应运行的命令。

## 审查清单

创建 PR 或交接修改前，请检查：

- 修改是否改变公开行为？若是，是否有后端源码证据？
- 示例是否为有效 JSON，或已明确标记为 `ts` 示意结构？
- 可复用模型是否通过链接引用，而非复制？
- 标题是否稳定且具体？
- 徽标是否以文字为主且便于无障碍访问？
- 新页面是否已加入 `sidebars.ts`？
- `yarn build` 是否通过；若未运行，是否有明确原因？
