# 订阅

实时市场订阅的命令与事件。

## 订阅新订单

`Command @wfm|cmd/subscribe/newOrders`

订阅来自在线用户的新发布可见订单实时流。

标记：命令

### 客户端消息

```json
{
  "route": "@wfm|cmd/subscribe/newOrders",
  "id": "message-id",
  "payload": {
    "platform": "pc",
    "crossplay": true
  }
}
```

### 载荷字段

| 字段 | 类型 | 说明 |
| ----------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `platform` | `Platform` | 可选。取值为 `pc`、`ps4`、`xbox`、`switch`、`mobile` 之一。省略时订阅全部平台。 |
| `crossplay` | `bool` | 可选。默认 `true`。如果 `platform` 为 `switch`，服务器强制将 `crossplay` 设为 `false`。 |

可以同时拥有多个有效订阅，例如分别订阅 `pc` 和 `xbox`。

### 成功消息

```json
{
  "route": "@wfm|cmd/subscribe/newOrders:ok",
  "id": "message-id"
}
```

### 错误消息

```json
{
  "route": "@wfm|cmd/subscribe/newOrders:error",
  "payload": "app.errors.alreadySubscribed",
  "id": "message-id"
}
```

## 取消新订单订阅

`Command @wfm|cmd/unsubscribe/newOrders`

取消某个新订单订阅。

标记：命令

必须发送与订阅时相同的载荷，因为一个客户端可以同时拥有多个有效订阅。

### 客户端消息

```json
{
  "route": "@wfm|cmd/unsubscribe/newOrders",
  "id": "message-id",
  "payload": {
    "platform": "pc",
    "crossplay": true
  }
}
```

### 载荷字段

| 字段 | 类型 | 说明 |
| ----------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `platform` | `Platform` | 可选。必须与订阅载荷匹配。仅在取消全平台订阅时可省略。 |
| `crossplay` | `bool` | 可选。默认 `true`。如果 `platform` 为 `switch`，服务器强制将 `crossplay` 设为 `false`。 |

### 成功消息

```json
{
  "route": "@wfm|cmd/unsubscribe/newOrders:ok",
  "id": "message-id"
}
```

### 错误消息

```json
{
  "route": "@wfm|cmd/unsubscribe/newOrders:error",
  "payload": "app.errors.notSubscribed",
  "id": "message-id"
}
```

## 新订单事件

`Event @wfm|event/subscriptions/newOrder`

向订阅者发送匹配的新建可见订单。

标记：事件

非离线用户创建可见订单时，向匹配的新订单订阅发送此事件。

```ts
{
  route: "@wfm|event/subscriptions/newOrder",
  payload: Order,
}
```

载荷为 [Order](../data-models.md#order) 结构。

## 尚未实现

后端目前包含物品和个人资料订单订阅的占位实现，但这些命令尚未注册为公开 WebSocket 路由。在文档明确其已启用前，请勿依赖。
