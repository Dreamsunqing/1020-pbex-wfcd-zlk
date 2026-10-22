# Reports

Server-generated reporting events.

## Online Count

`Event @wfm|event/reports/online`

Report current WebSocket connection and authorized-user counts.

Markers: Event

The server sends this event on connect and broadcasts it about once every `30s`.

```json
{
  "route": "@wfm|event/reports/online",
  "payload": {
    "connections": 1,
    "authorizedUsers": 1
  }
}
```

### Payload Fields

| Field             | Type                                    | Description                         |
| ----------------- | --------------------------------------- | ----------------------------------- |
| `connections`     | `int` | Current WebSocket connection count. |
| `authorizedUsers` | `int` | Current count of authorized users.  |
