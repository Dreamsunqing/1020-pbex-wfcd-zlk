# Dashboard

Endpoints for dashboard content used by Warframe.market clients.

## Get Dashboard Showcase

`GET /v2/dashboard/showcase`

Get mobile app main screen dashboard content with featured items.

Markers: Language aware

### Request

#### URL Parameters

None.

### Response

#### Body

```ts
{
  apiVersion: "x.x.x",
  data: DashboardShowcase,
  error: null,
}
```

`data` is a [DashboardShowcase](../data-models.md#dashboardshowcase) model.
