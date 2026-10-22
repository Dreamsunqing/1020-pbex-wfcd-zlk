# Groups

Groups are used to manage order and contract collections.

Currently, two virtual groups are available for endpoints that accept a `groupId`:

| Group ID    | Description                                                           |
| ----------- | --------------------------------------------------------------------- |
| `all`       | Includes all orders or contracts, whether grouped or ungrouped.       |
| `ungrouped` | Includes only orders or contracts that are not assigned to any group. |

Group management endpoints for creating, updating, and deleting custom groups will be published later.

See [Update Order Group Visibility](./orders.md#update-order-group-visibility) for the currently documented group-related endpoint.
