# 报告

服务器生成的报告事件。

## 在线数量

`Event @wfm|event/reports/online`

报告当前 WebSocket 连接数和已授权用户数。

标记：事件

服务器在连接建立时发送此事件，之后约每 `30s` 广播一次。

```json
{
  "route": "@wfm|event/reports/online",
  "payload": {
    "connections": 1,
    "authorizedUsers": 1
  }
}
```

### 载荷字段

| 字段 | 类型 | 说明 |
| ----------------- | --------------------------------------- | ----------------------------------- |
| `connections` | `int` | 当前 WebSocket 连接数。 |
| `authorizedUsers` | `int` | 当前已授权用户数。 |
