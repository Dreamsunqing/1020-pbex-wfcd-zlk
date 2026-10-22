# WebSocket 消息格式

本页是 WebSocket 文档风格的 Markdown／MDX 参考。示例仅演示格式，不属于公开 API 契约。

## 视觉表达

WebSocket 页面应以 Markdown 为主，消息路由使用 `WsMessage` 卡片，徽标、提示框和字段类型使用 API 界面组件。

- 命令
- 事件
- 流
- 需要认证
- 尚未实现

### 约定

- 每个已记录路由都使用 `WsMessage`。
- 徽标以文字为主；图标和表情只作视觉辅助，不能作为唯一含义来源。
- 命令文档分为 `Client Message`、`Payload Fields`、`Success Message` 和 `Error Message` 章节。
- 事件文档给出消息示例；内联载荷增加 `Payload Fields` 章节。
- 具体且可复制的消息使用 `json`。
- 包含可复用模型类型的示意消息（如 `payload: Order`）使用 `ts`。
- 链接到[数据模型](../data-models.md)中的可复用模型，不重复完整结构定义。
- 使用 `ApiCallout` 说明认证要求、限制、流行为和实现注释。
- 除非已验证指令渲染，否则不要直接使用 `:::warning` 块。

## 消息类型表

解释消息类型时，直接在表格中呈现消息标记。

| 标记 | 含义 |
| ------------------------------------------------------------ | -------------------------------------------------------------------------- |
| `Command` | 客户端请求，预期收到 `:ok`、`:error` 或防护错误响应。 |
| `Event` | 无需响应的单向服务器消息。 |
| `Stream` | 使用 `meta.stream` 和 `meta.revision` 排序的事件序列。 |
| `Auth required` | 消息需要已认证且已授权的客户端。 |
| `Not implemented` | 路由或行为仅存在于计划或占位实现中。 |

## 命令示例

`Command @wfm|cmd/example/doThing`

执行示例操作并返回命令响应。

标记：命令，需要认证

**前置要求**

- 身份认证
- 账号已验证
- 权限范围：`example.scope`

### 客户端消息

```json
{
  "route": "@wfm|cmd/example/doThing",
  "id": "message-id",
  "payload": {
    "name": "Example",
    "enabled": true
  }
}
```

### 载荷字段

| 字段 | 类型 | 说明 |
| --------- | ------------------------------------------ | ----------------------------------------------------------- |
| `name` | `string` | 必需。显示名称，最多 `32` 个字符。 |
| `enabled` | `bool` | 可选。是否启用示例。默认 `false`。 |

### 成功消息

```json
{
  "route": "@wfm|cmd/example/doThing:ok",
  "payload": {
    "updated": true
  },
  "id": "message-id"
}
```

### 错误消息

```json
{
  "route": "@wfm|cmd/example/doThing:error",
  "payload": {
    "name": "app.field.tooLong"
  },
  "id": "message-id"
}
```

## 事件示例

`Event @wfm|event/example/changed`

通知客户端某个示例资源发生变化。

标记：事件

```json
{
  "route": "@wfm|event/example/changed",
  "payload": {
    "id": "example-id",
    "changedAt": "2026-06-19T00:00:00Z"
  }
}
```

### 载荷字段

| 字段 | 类型 | 说明 |
| ----------- | ------------------------------------------ | ---------------------------- |
| `id` | `string` | 发生变化的资源标识符。 |
| `changedAt` | `string` | 变更时间戳。 |

## 流示例

`Stream @wfm|event/example/state`

广播某条流中有序的状态更新。

标记：事件，流

仅在后端发送 `meta.stream` 和 `meta.revision` 时使用流元数据。

```json
{
  "route": "@wfm|event/example/state",
  "payload": {
    "state": "ready"
  },
  "meta": {
    "stream": "example:example-id",
    "revision": 7
  }
}
```

### 元数据字段

| 字段 | 类型 | 说明 |
| ---------- | ------------------------------------------ | ----------------------------------------------- |
| `stream` | `string` | 用于排序或去重的流名称。 |
| `revision` | `number` | 流内单调递增的修订号。 |

## 模型载荷示例

消息体是示意结构且引用可复用模型时，使用 `ts`。

`Event @wfm|event/subscriptions/newOrder`

向订阅者发送匹配的新建可见订单。

标记：事件

```ts
{
  route: "@wfm|event/subscriptions/newOrder",
  payload: Order,
}
```

载荷为 [Order](../data-models.md#order) 结构。

## 尚未实现的示例

`Command @wfm|cmd/example/future`

预留但尚未实现的示例命令。

标记：尚未实现

仅在需要提及规划中或占位的后端路由时使用此模式。不要将占位路由记录为已生效的行为。

## 可复制的骨架

新命令路由可使用此骨架。

````mdx
## Message Name

<WsMessage
  type="Command"
  route="@wfm|cmd/domain/action"
  summary="Short behavior description."
  badges={[{ kind: 'neutral', icon: '💬', label: 'Command' }]}
/>

### Client Message

```json
{
  "route": "@wfm|cmd/domain/action",
  "id": "message-id",
  "payload": {}
}
```

### Payload Fields

| Field   | Type                                       | Description        |
| ------- | ------------------------------------------ | ------------------ |
| `field` | <ApiBadge kind="neutral" label="string" /> | Field description. |

### Success Message

```json
{
  "route": "@wfm|cmd/domain/action:ok",
  "id": "message-id"
}
```

### Error Message

```json
{
  "route": "@wfm|cmd/domain/action:error",
  "payload": "app.errors.example",
  "id": "message-id"
}
```
````

## 禁止事项

- 不要记录只有常量定义的路由；须确认路由已注册。
- 不要将占位处理器记录为已生效的行为。
- 不要记录后端尚未实现的字段，例如 `refId`。
- 不要在路由文字前散放徽标行；使用 `WsMessage`。
- 不要将 `json` 用于 `payload: "Order"` 等模型占位符；使用 `ts` 并链接模型。
- 不要在 WebSocket 页面重复可复用模型结构。
