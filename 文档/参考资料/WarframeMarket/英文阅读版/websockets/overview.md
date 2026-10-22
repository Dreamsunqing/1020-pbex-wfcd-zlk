# Overview

Realtime public contracts for Warframe.market WebSocket clients.

**Legacy Auth Scope**

Authorization tokens obtained from the v1 API currently have scope `all`. That means v1-authenticated clients can ignore scope requirements for now. OAuth 2.0 will replace the v1 login flow in the future.

## Version

This documentation describes WebSocket API version `v0.13.0`.

## Connection

| Environment | URL                               |
| ----------- | --------------------------------- |
| Production  | `wss://ws.warframe.market/socket` |

The server requires the `wfm` WebSocket subprotocol. Connections without this subprotocol are rejected.

```ts
const socket = new WebSocket('wss://ws.warframe.market/socket', 'wfm');
```

All messages are JSON-encoded.

## Message Envelope

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

| Field           | Type                                        | Description                                                                             |
| --------------- | ------------------------------------------- | --------------------------------------------------------------------------------------- |
| `route`         | `string`  | Route that selects the server or client handler.                                        |
| `payload`       | `unknown` | Route-specific message body. Omitted when empty.                                        |
| `id`            | `string`  | Optional message ID. Command responses reuse the incoming command `id` for correlation. |
| `meta`          | `object`  | Optional stream metadata for ordered or deduplicated realtime events.                   |
| `meta.stream`   | `string`  | Stream name. Status messages use `status:{userId}`.                                     |
| `meta.revision` | `number`  | Monotonic stream revision.                                                              |

## Message Types

| Marker                                                       | Meaning                                                                    |
| ------------------------------------------------------------ | -------------------------------------------------------------------------- |
| `Command`        | Client request that expects `:ok`, `:error`, or protection error response. |
| `Event`          | One-way server message that does not expect a response.                    |
| `Stream`         | Event sequence with `meta.stream` and `meta.revision` for ordering.        |
| `Auth required`     | Message requires an authenticated and authorized client.                   |
| `Not implemented` | Route or behavior exists only as a planned/stubbed feature.                |

## Generic Errors

The server may send generic errors before a route handler runs.

| Route                   | When it is sent                                                        |
| ----------------------- | ---------------------------------------------------------------------- |
| `@ws:error/cmd/type`    | Incoming message is not valid JSON for the WebSocket message envelope. |
| `@ws:error/cmd/route`   | Incoming `route` is unknown.                                           |
| `@ws:error/cmd/handler` | Route handler returned an unhandled error.                             |
| `@wfm\|protect/error`   | Protected route failed authentication or authorization checks.         |

Example protection error:

```json
{
  "route": "@wfm|protect/error",
  "payload": "app.errors.userNotVerified",
  "id": "message-id"
}
```
