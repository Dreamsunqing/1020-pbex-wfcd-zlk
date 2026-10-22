# Authentication And Account Events

Authentication commands and account-level server events.

## Sign In

`Command @wfm|cmd/auth/signIn`

Authorize the WebSocket client.

Markers: Command

This command supports auth tokens from the v1 API. If `token` is an empty string, the server attempts legacy cookie-based authorization.

### Client Message

```json
{
  "route": "@wfm|cmd/auth/signIn",
  "id": "message-id",
  "payload": {
    "token": "jwtToken"
  }
}
```

### Payload Fields

| Field      | Type                                       | Description                                                    |
| ---------- | ------------------------------------------ | -------------------------------------------------------------- |
| `token`    | `string` | JWT access token. Empty string enables legacy cookie fallback. |
| `deviceId` | `string` | Optional. Device identifier accepted by the payload shape.     |

### Success Message

```json
{
  "route": "@wfm|cmd/auth/signIn:ok",
  "id": "message-id"
}
```

After successful sign-in, the server sends the current status with `@wfm|event/status/set`.

### Error Message

```json
{
  "route": "@wfm|cmd/auth/signIn:error",
  "payload": "app.errors.unauthorized",
  "id": "message-id"
}
```

## Sign Out

`Command @wfm|cmd/auth/signOut`

Remove the current actor from this WebSocket client.

Markers: Command

### Client Message

```json
{
  "route": "@wfm|cmd/auth/signOut",
  "id": "message-id"
}
```

### Success Message

```json
{
  "route": "@wfm|cmd/auth/signOut:ok",
  "id": "message-id"
}
```

### Error Message

```json
{
  "route": "@wfm|cmd/auth/signOut:error",
  "payload": "app.errors.wsNotAuthenticated",
  "id": "message-id"
}
```

## Account Patch

`Event @wfm|event/account/patch`

Notify connected clients that account data was patched by backend systems.

Markers: Event

```ts
{
  route: "@wfm|event/account/patch",
  payload: UserPatch,
}
```
