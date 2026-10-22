# 身份认证与账号事件

认证命令及账号级服务器事件。

## 登录

`Command @wfm|cmd/auth/signIn`

为 WebSocket 客户端授权。

标记：命令

此命令支持 v1 API 的认证令牌。如果 `token` 为空字符串，服务器会尝试旧版基于 cookie 的授权。

### 客户端消息

```json
{
  "route": "@wfm|cmd/auth/signIn",
  "id": "message-id",
  "payload": {
    "token": "jwtToken"
  }
}
```

### 载荷字段

| 字段 | 类型 | 说明 |
| ---------- | ------------------------------------------ | -------------------------------------------------------------- |
| `token` | `string` | JWT 访问令牌。空字符串启用旧版 cookie 回退。 |
| `deviceId` | `string` | 可选。此载荷结构接受的设备标识符。 |

### 成功消息

```json
{
  "route": "@wfm|cmd/auth/signIn:ok",
  "id": "message-id"
}
```

登录成功后，服务器通过 `@wfm|event/status/set` 发送当前状态。

### 错误消息

```json
{
  "route": "@wfm|cmd/auth/signIn:error",
  "payload": "app.errors.unauthorized",
  "id": "message-id"
}
```

## 退出登录

`Command @wfm|cmd/auth/signOut`

从此 WebSocket 客户端移除当前认证主体。

标记：命令

### 客户端消息

```json
{
  "route": "@wfm|cmd/auth/signOut",
  "id": "message-id"
}
```

### 成功消息

```json
{
  "route": "@wfm|cmd/auth/signOut:ok",
  "id": "message-id"
}
```

### 错误消息

```json
{
  "route": "@wfm|cmd/auth/signOut:error",
  "payload": "app.errors.wsNotAuthenticated",
  "id": "message-id"
}
```

## 账号部分更新

`Event @wfm|event/account/patch`

通知已连接客户端，账号数据已被后端系统部分更新。

标记：事件

```ts
{
  route: "@wfm|event/account/patch",
  payload: UserPatch,
}
```
