# 状态与活动

用户在线状态和丰富活动信息的命令与事件。

## 设置状态与活动

`Command @wfm|cmd/status/set`

更新已认证用户的状态与活动。

标记：命令，需要认证

**前置要求**

- 身份认证
- 账号已验证
- 用户未被封禁

状态以服务器为准。登录后，客户端应先等待当前 `@wfm|event/status/set` 事件，再决定是否发送状态更新。

### 客户端消息

```json
{
  "route": "@wfm|cmd/status/set",
  "id": "message-id",
  "payload": {
    "status": "ingame",
    "duration": 1800,
    "activity": {
      "type": "ON_MISSION",
      "details": "Plains of Eidolon - Bounty Tier 3",
      "startedAt": 1745424871
    }
  }
}
```

### 载荷字段

| 字段 | 类型 | 说明 |
| ---------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `status` | `string` | 必需。取值为 `online`、`ingame`、`invisible` 之一。 |
| `duration` | `int or null` | 可选。持续时间，单位为秒。最小 `60`，最大 `21600`（`6h`）。发送 `null` 移除已有持续时间。 |
| `activity` | `object or null` | 可选。完整活动对象。发送 `null` 清除已有活动。参见下文活动字段。 |

### 活动字段

`activity` 为对象时，会替换整个当前活动。请发送新活动状态所需的全部字段。

```json
{
  "type": "ON_MISSION",
  "details": "Plains of Eidolon - Bounty Tier 3",
  "startedAt": 1745424871
}
```

| 字段 | 类型 | 说明 |
| ----------- | ------------------------------------------ | -------------------------------------------------------------------------------------- |
| `type` | `string` | 必需。取值为 `UNKNOWN`、`IDLE`、`ON_MISSION`、`IN_DOJO`、`IN_ORBITER`、`IN_RELAY` 之一。 |
| `details` | `string` | 可选。自由格式的活动详情，最多 `64` 个字符。 |
| `startedAt` | `int` | 必需。以秒为单位的 Unix 时间戳，必须位于一天前至当前时间之间。 |

### 成功消息

```json
{
  "route": "@wfm|cmd/status/set:ok",
  "payload": {
    "status": "ingame",
    "statusSetAt": "2017-01-16T23:00:00Z",
    "statusUntil": "2017-01-17T00:00:00Z",
    "activity": {
      "type": "ON_MISSION",
      "details": "Plains of Eidolon - Bounty Tier 3",
      "startedAt": "2017-01-16T23:00:00Z"
    }
  },
  "id": "message-id",
  "meta": {
    "stream": "status:user-id",
    "revision": 1
  }
}
```

载荷为 [RichStatus](../data-models.md#richstatus) 结构。

### 错误消息

```json
{
  "route": "@wfm|cmd/status/set:error",
  "payload": {
    "activity.startedAt": "app.field.tooSmall"
  },
  "id": "message-id"
}
```

### 持续时间行为

- 没有现有状态且未提供 `duration` 时，只要用户保持连接，状态就持续有效。
- 提供 `duration` 时，状态在指定时长内有效。
- 用户在持续时间到期前断开连接时，重连后可短暂恢复状态。
- 持续时间到期而用户仍连接时，服务器将状态设为 `invisible` 并广播更新。
- 发送 `duration: null` 会移除已有持续时间。

### 活动行为

`activity` 整体替换。即使只更新一个活动字段，也须发送完整活动对象。发送 `activity: null` 清除当前活动。

## 状态与活动更新

`Stream @wfm|event/status/set`

广播当前已提交的状态和活动信息。

标记：事件，流

服务器在登录后、用户某个已连接客户端修改状态或活动后，以及定时状态到期时发送此事件。

```json
{
  "route": "@wfm|event/status/set",
  "payload": {
    "status": "ingame",
    "statusSetAt": "2017-01-16T23:00:00Z",
    "statusUntil": "2017-01-17T00:00:00Z",
    "activity": {
      "type": "ON_MISSION",
      "details": "Plains of Eidolon - Bounty Tier 3",
      "startedAt": "2017-01-16T23:00:00Z"
    }
  },
  "meta": {
    "stream": "status:user-id",
    "revision": 1
  }
}
```

载荷为 [RichStatus](../data-models.md#richstatus) 结构。
