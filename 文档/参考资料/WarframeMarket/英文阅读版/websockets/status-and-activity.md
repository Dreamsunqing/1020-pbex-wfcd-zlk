# Status And Activity

Commands and events for user online status and rich activity.

## Set Status And Activity

`Command @wfm|cmd/status/set`

Update the authenticated user's status and activity.

Markers: Command, Auth required

**Requires**

- Authentication
- Verified account
- User must not be banned

The server is the source of truth for status. A client should wait for the current `@wfm|event/status/set` event after sign-in before deciding whether to send status updates.

### Client Message

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

### Payload Fields

| Field      | Type                                               | Description                                                                                                |
| ---------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `status`   | `string`         | Required. One of `online`, `ingame`, `invisible`.                                                          |
| `duration` | `int or null`    | Optional. Duration in seconds. Min: `60`. Max: `21600` (`6h`). Send `null` to remove an existing duration. |
| `activity` | `object or null` | Optional. Full activity object. Send `null` to clear existing activity. See Activity Fields below.         |

### Activity Fields

When `activity` is an object, it replaces the whole current activity. Send all fields needed for the new activity state.

```json
{
  "type": "ON_MISSION",
  "details": "Plains of Eidolon - Bounty Tier 3",
  "startedAt": 1745424871
}
```

| Field       | Type                                       | Description                                                                            |
| ----------- | ------------------------------------------ | -------------------------------------------------------------------------------------- |
| `type`      | `string` | Required. One of `UNKNOWN`, `IDLE`, `ON_MISSION`, `IN_DOJO`, `IN_ORBITER`, `IN_RELAY`. |
| `details`   | `string` | Optional. Free-form activity details. Max: `64` characters.                            |
| `startedAt` | `int`    | Required. Unix timestamp in seconds. Must be between one day ago and now.              |

### Success Message

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

Payload is a [RichStatus](../data-models.md#richstatus) shape.

### Error Message

```json
{
  "route": "@wfm|cmd/status/set:error",
  "payload": {
    "activity.startedAt": "app.field.tooSmall"
  },
  "id": "message-id"
}
```

### Duration Behavior

- Without an existing status and without `duration`, the status remains active while the user stays connected.
- With `duration`, the status remains active for that duration.
- If the user disconnects before the duration expires, the status can be restored briefly on reconnect.
- If a duration expires while the user is still connected, the server sets status to `invisible` and broadcasts an update.
- Sending `duration: null` removes an existing duration.

### Activity Behavior

`activity` is replaced as a whole. To update one activity field, send the complete activity object. Send `activity: null` to clear the current activity.

## Status And Activity Update

`Stream @wfm|event/status/set`

Broadcast the current committed status and activity state.

Markers: Event, Stream

The server sends this event after sign-in, after one of the user's connected clients changes status or activity, and when a timed status expires.

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

Payload is a [RichStatus](../data-models.md#richstatus) shape.
