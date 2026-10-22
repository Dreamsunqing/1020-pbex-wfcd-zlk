# Warframe Market 官方开发者文档：原文与中文译文

本目录是为本项目准备的 Warframe Market（WM／WFM）接口文档资料包。下载日期：**2026-10-23（Asia/Shanghai）**。共归档 **25 篇原始文档、25 篇中文译文和 25 篇英文 Markdown 阅读版**。

## 从哪里开始

建议依次阅读[官方简介的中文译文](中文/intro.md)、[客户端规则](中文/rules/overview.md)、[HTTP API 概览](中文/api/overview.md)、[物品清单与集合](中文/api/manifests.md)、[订单接口](中文/api/orders.md)和[数据模型](中文/data-models.md)。需要实时订单时，再读 [WebSocket 概览](中文/websockets/overview.md)与[订阅](中文/websockets/subscriptions.md)。

## 来源与版本

| 项目 | 记录 |
| --- | --- |
| 官方文档网站 | [Warframe.market Docs](https://docs.warframe.market/) |
| 官方文档源仓库 | [42bytes-team/wfm-docs](https://github.com/42bytes-team/wfm-docs) |
| 下载分支 | `master` |
| 固定提交 | [`c76d86937c0aabf6269b7f44f1d32761eeee3030`](https://github.com/42bytes-team/wfm-docs/tree/c76d86937c0aabf6269b7f44f1d32761eeee3030) |
| 提交时间（上游时区） | `2026-06-23T00:08:12+01:00` |
| HTTP API 文档自述版本 | `v0.25.0` |
| WebSocket API 文档自述版本 | `v0.13.0` |
| 下载方式 | 官网直连返回 HTTP 403，改从官方 GitHub 源仓库获取，按提交固定快照 |
| 来源清单 | [来源清单.json](来源清单.json)，记录逐篇来源、路径、字节数与 SHA-256 |
| 完整官方源仓库压缩包 | [wfm-docs-c76d86937c0a.tar.gz](wfm-docs-c76d86937c0a.tar.gz)，由该提交的 `git archive` 生成，不含 `.git` 历史 |

这里的版本号来自文档正文，不代表已对线上服务进行实测。资料包保存的是固定提交，后续官网或仓库更新不会自动同步到本地。

## 本地文件如何使用

| 目录或文件 | 内容与用途 |
| --- | --- |
| `原文/docs/` | 原始英文 `.md`、`.mdx`，目录结构、front matter、组件、代码示例和正文均保持原样 |
| `原文/README.md`、`原文/CONTRIBUTING.md` | 上游仓库说明和贡献说明，保持原样 |
| `原文/sidebars.ts`、`原文/docusaurus.config.ts`、`原文/package.json` | 上游导航、站点及版本构建信息，保持原样 |
| `英文阅读版/` | 将 MDX 路由卡片、类型徽标、提示框转换为普通 Markdown 的英文副本 |
| `中文/` | 对应 25 篇文档的中文译文，使用与英文阅读版一致的目录和文件名 |
| `来源清单.json` | 追溯来源和校验下载／译文文件 |
| `校验记录.md` | 本次完整性、代码保留、链接和阅读器登记的核对结果 |

在项目程序的“文档阅读”中点击“刷新”，搜索 `WarframeMarket 中文` 即可筛选译文；本目录首页也可通过文档总览进入。现有阅读器只登记 `.md`，原始 `.mdx` 请使用编辑器或完整源码包查看；中文和英文阅读版已使用 `.md`。

## 翻译约定

- 译文是本项目整理的中文参考，不是 WM 官方发布的中文版本。原文中的“我们”仍指 Warframe.market 文档作者。
- 翻译标题、正文、字段说明和规则；保留接口路径、HTTP 方法、请求头名、JSON 字段名、scope、枚举值、模型名和代码示例。
- MDX 展示组件转为文字：接口方法／路径、别名、摘要、权限及缓存标记、提示框内容均保留；移除仅用于网站构建的 import 与 front matter。
- 英文阅读版中的本地 `.mdx` 链接改为 `.md`；中文链接同时指向相应中文标题的锚点。
- 数据模型标题保留 `Item`、`Order`、`User` 等原名，便于从接口文档定位。
- 未用第三方 SDK 或过时的社区 v1 规范替代官方文档；未为上游未记录的接口补写契约。

## 接入前可确认的事实

以下内容是文档阅读提示，来源均为本目录对应译文；不表示本地工具已经实现这些接口。

| 主题 | 官方快照中的说明 | 对应文档 |
| --- | --- | --- |
| API 地址 | 生产地址为 `https://api.warframe.market/v2/`，静态资源另有基础地址 | [HTTP 概览](中文/api/overview.md) |
| 中文与平台 | `Language: zh-hans` 请求简体中文 `i18n`；平台和跨平台上下文分别通过 `Platform`、`Crossplay` 设置 | [HTTP 概览](中文/api/overview.md) |
| 请求限制 | 一般限额每秒 3 次；超限可能返回 `429`，同 IP 并发过多可能返回 `509`；部分接口限制可能更严 | [HTTP 概览](中文/api/overview.md)、[规则](中文/rules/overview.md) |
| 缓存集合 | `GET /v2/versions` 提供集合版本哈希，`GET /v2/items` 获取可交易物品 | [清单与集合](中文/api/manifests.md) |
| 物品关联 | `Item` 有 WM 自身 `id`、`slug`，也记录可选的 `gameRef` 游戏内部引用路径 | [数据模型](中文/data-models.md#item) |
| 普通订单 | 按物品取订单不会移除离线用户；与仅返回在线用户订单的 top 接口行为不同 | [订单](中文/api/orders.md) |
| 最优订单 | top 接口最多返回 5 个卖单和 5 个买单；支持等级、使用次数、雕塑星数等筛选，排序包含 Endo 规则 | [订单](中文/api/orders.md) |
| 用户授权 | v1 已弃用且不受支持，但官方仍要求第三方用户授权暂用现有 v1 流程；OAuth 2.0 尚未开放公共注册 | [简介](中文/intro.md)、[OAuth](中文/oauth/overview.md) |
| 第一方登录 | HTTP 认证页记录的登录／注册接口仅供已注册第一方客户端使用，并要求 Firebase App Check | [认证](中文/api/authentication.md) |
| 实时连接 | `wss://ws.warframe.market/socket` 要求 `wfm` 子协议；新订单订阅已有公开文档 | [WebSocket](中文/websockets/overview.md)、[订阅](中文/websockets/subscriptions.md) |
| 应用标识 | 应使用清楚标识应用的专用 `User-Agent`，并复用缓存、避免高频无效轮询 | [规则](中文/rules/overview.md) |

原文的数据模型 `Activity` 一节列出小写的 `on_mission`、`dojo` 等值，而状态命令与 `ActivityType` 枚举列出大写的 `ON_MISSION`、`IN_DOJO` 等值。本译文分别保留，不自行将两套值视为等价；涉及此字段时需进一步核实接口实际契约。

## 全部文档对照目录

“原文”列指向逐字节保留的文件，“英文阅读版”列是普通 Markdown，“中文”列是本次译文。贡献指南也完整保留，示例接口与消息只演示文档格式，不能当作真实公开接口。

| 分类 | 文档 | 中文 | 英文阅读版 | 原文 |
| --- | --- | --- | --- | --- |
| 总览／模型 | 简介 | [中文](中文/intro.md) | [英文](英文阅读版/intro.md) | [原文](原文/docs/intro.md) |
| HTTP API | 概览 | [中文](中文/api/overview.md) | [英文](英文阅读版/api/overview.md) | [原文](原文/docs/api/overview.mdx) |
| HTTP API | 清单与集合 | [中文](中文/api/manifests.md) | [英文](英文阅读版/api/manifests.md) | [原文](原文/docs/api/manifests.mdx) |
| HTTP API | 订单 | [中文](中文/api/orders.md) | [英文](英文阅读版/api/orders.md) | [原文](原文/docs/api/orders.mdx) |
| HTTP API | 分组 | [中文](中文/api/groups.md) | [英文](英文阅读版/api/groups.md) | [原文](原文/docs/api/groups.mdx) |
| HTTP API | 用户 | [中文](中文/api/users.md) | [英文](英文阅读版/api/users.md) | [原文](原文/docs/api/users.mdx) |
| HTTP API | 成就 | [中文](中文/api/achievements.md) | [英文](英文阅读版/api/achievements.md) | [原文](原文/docs/api/achievements.mdx) |
| HTTP API | 身份认证 | [中文](中文/api/authentication.md) | [英文](英文阅读版/api/authentication.md) | [原文](原文/docs/api/authentication.mdx) |
| HTTP API | 仪表盘 | [中文](中文/api/dashboard.md) | [英文](英文阅读版/api/dashboard.md) | [原文](原文/docs/api/dashboard.mdx) |
| WebSocket | 概览 | [中文](中文/websockets/overview.md) | [英文](英文阅读版/websockets/overview.md) | [原文](原文/docs/websockets/overview.mdx) |
| WebSocket | 报告 | [中文](中文/websockets/reports.md) | [英文](英文阅读版/websockets/reports.md) | [原文](原文/docs/websockets/reports.mdx) |
| WebSocket | 身份认证与账号事件 | [中文](中文/websockets/authentication.md) | [英文](英文阅读版/websockets/authentication.md) | [原文](原文/docs/websockets/authentication.mdx) |
| WebSocket | 状态与活动 | [中文](中文/websockets/status-and-activity.md) | [英文](英文阅读版/websockets/status-and-activity.md) | [原文](原文/docs/websockets/status-and-activity.mdx) |
| WebSocket | 订阅 | [中文](中文/websockets/subscriptions.md) | [英文](英文阅读版/websockets/subscriptions.md) | [原文](原文/docs/websockets/subscriptions.mdx) |
| OAuth | 概览 | [中文](中文/oauth/overview.md) | [英文](英文阅读版/oauth/overview.md) | [原文](原文/docs/oauth/overview.md) |
| 总览／模型 | 数据模型 | [中文](中文/data-models.md) | [英文](英文阅读版/data-models.md) | [原文](原文/docs/data-models.mdx) |
| 规则 | 规则 | [中文](中文/rules/overview.md) | [英文](英文阅读版/rules/overview.md) | [原文](原文/docs/rules/overview.md) |
| 贡献指南 | 文档风格 | [中文](中文/contributing/documentation-style.md) | [英文](英文阅读版/contributing/documentation-style.md) | [原文](原文/docs/contributing/documentation-style.md) |
| 贡献指南 | HTTP API 接口格式 | [中文](中文/contributing/http-api-endpoint-format.md) | [英文](英文阅读版/contributing/http-api-endpoint-format.md) | [原文](原文/docs/contributing/http-api-endpoint-format.mdx) |
| 贡献指南 | WebSocket 消息格式 | [中文](中文/contributing/websocket-message-format.md) | [英文](英文阅读版/contributing/websocket-message-format.md) | [原文](原文/docs/contributing/websocket-message-format.mdx) |
| 贡献指南 | wfm-localization | [中文](中文/contributing/wfm-localization.md) | [英文](英文阅读版/contributing/wfm-localization.md) | [原文](原文/docs/contributing/wfm-localization.md) |
| 贡献指南 | wfm-items | [中文](中文/contributing/wfm-items.md) | [英文](英文阅读版/contributing/wfm-items.md) | [原文](原文/docs/contributing/wfm-items.md) |
| 贡献指南 | wfm-electron | [中文](中文/contributing/wfm-electron.md) | [英文](英文阅读版/contributing/wfm-electron.md) | [原文](原文/docs/contributing/wfm-electron.md) |
| 贡献指南 | wfm-themes | [中文](中文/contributing/wfm-themes.md) | [英文](英文阅读版/contributing/wfm-themes.md) | [原文](原文/docs/contributing/wfm-themes.md) |
| 贡献指南 | wfm-docs | [中文](中文/contributing/wfm-docs.md) | [英文](英文阅读版/contributing/wfm-docs.md) | [原文](原文/docs/contributing/wfm-docs.md) |
