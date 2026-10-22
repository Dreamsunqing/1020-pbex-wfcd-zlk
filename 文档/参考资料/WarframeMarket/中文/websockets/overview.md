# 概览

面向 Warframe.market WebSocket 客户端的实时公开契约。

**旧版认证权限范围**

从 v1 API 获取的授权令牌目前具有 `all` scope。因此，通过 v1 认证的客户端暂时可以忽略 scope 要求。未来 OAuth 2.0 将替代 v1 登录流程。

## 版本

本文档描述 WebSocket API 版本 `v0.13.0`。

## 连接

| 环境 | URL |
| ----------- | --------------------------------- |
| 生产环境 | `wss://ws.warframe.market/socket` |

服务器要求使用 `wfm` WebSocket 子协议。未使用此子协议的连接会被拒绝。

```ts
const socket = new WebSocket('wss://ws.warframe.market/socket', 'wfm');
```

所有消息均以 JSON 编码。

## 消息封装

```ts
{
  route: string,
  payload?: unknown,
  id?: string,
  meta?: {
    stream?: string,
    revision?: number,
  },
}
```

| 字段 | 类型 | 说明 |
| --------------- | ------------------------------------------- | --------------------------------------------------------------------------------------- |
| `route` | `string` | 用于选择服务器或客户端处理器的路由。 |
| `payload` | `unknown` | 路由专属消息体。为空时省略。 |
| `id` | `string` | 可选消息 ID。命令响应复用传入命令的 `id` 以进行关联。 |
| `meta` | `object` | 可选流元数据，用于实时事件排序或去重。 |
| `meta.stream` | `string` | 流名称。状态消息使用 `status:{userId}`。 |
| `meta.revision` | `number` | 单调递增的流修订号。 |

## 消息类型

| 标记 | 含义 |
| ------------------------------------------------------------ | -------------------------------------------------------------------------- |
| `Command` | 客户端请求，预期收到 `:ok`、`:error` 或防护错误响应。 |
| `Event` | 无需响应的单向服务器消息。 |
| `Stream` | 使用 `meta.stream` 和 `meta.revision` 排序的事件序列。 |
| `Auth required` | 消息需要已认证且已授权的客户端。 |
| `Not implemented` | 路由或行为仅存在于计划或占位实现中。 |

## 通用错误

服务器可能在路由处理器运行前发送通用错误。

| 路由 | 发送时机 |
| ----------------------- | ---------------------------------------------------------------------- |
| `@ws:error/cmd/type` | 传入消息不是符合 WebSocket 消息封装要求的有效 JSON。 |
| `@ws:error/cmd/route` | 传入的 `route` 未知。 |
| `@ws:error/cmd/handler` | 路由处理器返回未处理的错误。 |
| `@wfm\|protect/error` | 受保护路由未通过身份认证或授权检查。 |

防护错误示例：

```json
{
  "route": "@wfm|protect/error",
  "payload": "app.errors.userNotVerified",
  "id": "message-id"
}
```
