# 仪表盘

用于 Warframe.market 客户端仪表盘内容的接口。

## 获取仪表盘展示内容

`GET /v2/dashboard/showcase`

获取移动应用主屏幕的仪表盘内容，包含精选物品。

标记：支持语言切换

### 请求

#### URL 参数

无。

### 响应

#### 正文

```ts
{
  apiVersion: "x.x.x",
  data: DashboardShowcase,
  error: null,
}
```

`data` 是 [DashboardShowcase](../data-models.md#dashboardshowcase) 模型。
