# 简介

欢迎阅读 Warframe.market 开发者文档。

这些文档描述 Warframe.market HTTP API、实时 WebSocket 消息、共享数据模型、OAuth 计划和公开 API 客户端规则的公开契约。

## 当前状态

当前 API 和 WebSocket 契约仍低于 `1.0`。新公共 API 推出过程中可能发生变化，包括破坏性变化。

新 API 接口逐步加入。部分区域已有文档，其他区域可能仍有缺失或不完整。

旧版 v1 API 已弃用且不再受支持。我们不计划发布新的 v1 文档。

## OAuth 2.0 状态

OAuth 2.0 仍在开发中，尚未向公共集成开放。

目前不能注册自己的 OAuth 客户端。需要用户授权的集成暂时仍须依赖现有 v1 授权流程。

我们知道这不理想，也对过渡期的混乱表示歉意。

## 从哪里开始

| 区域 | 用途 |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| [HTTP API](./api/overview.md) | 读取市场数据、管理订单，以及处理用户、成就、清单和仪表盘内容。 |
| [WebSocket](./websockets/overview.md) | 接收实时状态更新、在线报告、账号事件和订单订阅事件。 |
| [数据模型](./data-models.md) | 理解 `Item`、`Order`、`User`、`RichStatus` 等可复用响应结构及共享枚举值。 |
| [OAuth 2.0](./oauth/overview.md) | 规划中的 OAuth 2.0 行为。目前尚未开放公共客户端注册。 |
| [规则](./rules/overview.md) | 了解公开市场及 API 客户端政策。 |

## 问题与支持

第三方开发者问题请前往我们的 Discord 服务器：

[加入 Warframe.market Discord](https://discord.gg/M7BHnPS)

## 参与贡献

欢迎在 GitHub 改进此文档项目。

若要改进措辞、修复错误或补齐文档，请参阅[文档风格](./contributing/documentation-style.md)。
