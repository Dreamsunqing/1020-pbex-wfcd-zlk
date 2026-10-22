# 概览

Warframe.market 提供 HTTP API，用于交易市场数据、面向用户的操作和集成工作流程。

## 版本

本文档描述 API 版本 `v0.25.0`。

## 基础地址

| 资源 | 基础 URL |
| -------------- | ---------------------------------------- |
| 生产 API | `https://api.warframe.market/v2/` |
| 静态资源 | `https://warframe.market/static/assets/` |

部分响应字段是资源路径，例如物品图标、用户头像或个人资料背景。请以静态资源基础 URL 为基准解析这些路径。

## 请求频率限制

当前公开限额为每秒 `3` 次请求。

**防护限制**

超过请求频率限制时，Cloudflare 可能返回 `429`。同一 IP 地址的并发连接过多时，可能返回 `509`。

## 通用请求头

这些请求头仅适用于响应受本地化、平台或跨平台上下文影响的接口。

### 语言

使用 `Language: {lang}` 在英语数据之外请求本地化的 `i18n` 数据。

支持值：`ko`、`ru`、`de`、`fr`、`pt`、`zh-hans`、`zh-hant`、`es`、`it`、`pl`、`uk`、`tr`、`ja`、`en`。

默认值：`en`。

```http
Language: ko
```

### 平台

使用 `Platform: {platform}` 请求特定平台的交易市场数据。

支持值：`pc`、`ps4`、`xbox`、`switch`、`mobile`。

默认值：`pc`。

```http
Platform: pc
```

### 跨平台联机

接口支持跨平台筛选时，使用 `Crossplay: true` 纳入其他平台中兼容跨平台交易的订单。

默认值：`false`。

```http
Platform: pc
Crossplay: true
```

## 响应封装

大多数 JSON 接口使用以下响应封装：

```json
{
  "apiVersion": "x.x.x",
  "data": {},
  "error": null
}
```

| 字段 | 类型 | 说明 |
| ------------ | ---------------------------------------------------------- | ----------------------------------------- |
| `apiVersion` | `string` | 符合 SemVer 的 API 服务器版本。 |
| `data` | `object, array, or null` | 请求成功时的响应载荷。 |
| `error` | `object or null` | 已处理错误的错误载荷。 |

## 错误

### 已处理的错误

已处理的错误仍使用响应封装，且 `data: null`。

```json
{
  "apiVersion": "x.x.x",
  "data": null,
  "error": {
    "request": ["app.errors.unauthorized"],
    "inputs": {
      "platinum": "app.field.tooSmall"
    }
  }
}
```

| 字段 | 类型 | 说明 |
| --------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `request` | `[]string` | 请求层面的通用错误，例如 `app.errors.unauthorized` 或 `app.errors.forbidden`。 |
| `inputs` | `map[string]string` | 请求体、查询参数或 multipart 表单字段的字段级错误。 |

### 未处理的错误

未处理的严重错误返回 `5xx` 状态，未定义其 JSON 响应体。

## 接口标记

接口页面使用带图标的文字标签，方便快速浏览。

- 开发中
- 不稳定
- 有频率限制
- 需要认证
- 仅限第一方
- 支持平台／跨平台筛选
- 支持语言切换
- 已弃用

从 v1 API 获取的 OAuth 令牌目前具有 `all` scope。因此，通过 v1 认证的客户端暂时可以忽略接口的 scope 要求。未来 OAuth 2.0 将替代 v1 登录流程。
