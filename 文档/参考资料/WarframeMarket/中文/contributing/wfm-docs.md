# wfm-docs

[GitHub 仓库](https://github.com/42bytes-team/wfm-docs)

`wfm-docs` 是 Warframe.market 的公开文档站，记录 HTTP API、WebSocket API、OAuth 2.0 计划、共享数据模型、交易市场规则及贡献指南。使用 Docusaurus、React、TypeScript 和 Yarn 4 构建。

这就是你当前正在阅读的仓库。

## 适合贡献的内容

- 修复现有文档中的语法、错字或不通顺的措辞。
- 改善格式，修复失效链接或过时示例。
- 补充新 API 接口、WebSocket 事件或数据模型字段缺失的文档。
- 新增文档页面并在 `sidebars.ts` 中注册。
- 改进贡献指南或文档风格规则。
- 通过 Docusaurus i18n 将文档翻译为新语言。

相比大范围重写，小而集中的拉取请求更易审查。

## 开始之前

应至少熟悉以下部分工具：

- [Markdown](https://www.markdownguide.org/)
- [Docusaurus](https://docusaurus.io/)
- [TypeScript](https://www.typescriptlang.org/)
- [Yarn](https://yarnpkg.com/)

修改前请阅读[文档风格](./documentation-style.md)指南。

## 要求

- Node.js 20 或更高版本。
- Yarn 4.14 或更高版本。
- 建议使用 Corepack，以使用 `package.json` 声明的 Yarn 版本。

若尚未安装 Yarn 4，先启用 Corepack：

```bash
corepack enable
```

## 本地运行

安装依赖：

```bash
yarn install
```

启动本地文档站：

```bash
yarn start
```

此命令会在 `localhost:3000` 启动 Docusaurus，并在浏览器中打开。

**Warframe.market 内部开发者**若运行带 Nginx 代理的完整本地 Docker 环境，应使用：

```bash
yarn start:wfm
```

此命令在 `0.0.0.0:3001` 启动 Docusaurus，服务器就绪后打开 `http://docs.warframe.test/docs/intro`。

构建生产环境静态站点：

```bash
yarn build
```

## 仓库结构

| 区域 | 用途 |
| ---------------------- | ------------------------------------------------------------- |
| `docs/` | 主要文档页面。大部分内容修改发生在这里。 |
| `docs/api/` | HTTP API 文档。 |
| `docs/websockets/` | WebSocket 命令、事件和载荷文档。 |
| `docs/oauth/` | OAuth 2.0 文档。 |
| `docs/contributing/` | 贡献指南和文档风格规则。 |
| `src/` | Docusaurus 页面、React 组件和自定义 CSS。 |
| `static/` | 复制到最终站点的静态资源。 |
| `sidebars.ts` | 侧栏导航顺序。新增文档页面时需更新。 |
| `docusaurus.config.ts` | Docusaurus 站点配置。 |

## 通过 Git 贡献

1. Fork 仓库。
2. 为你的主题创建分支。
3. 编辑 `docs/` 中相关文件。
4. 新增页面时，在 `sidebars.ts` 中注册。
5. 修改文档、侧栏、链接或 MDX 后，运行 `yarn build`。
6. 修改 TypeScript、React 或 Docusaurus 配置后，运行 `yarn typecheck`。
7. 提交拉取请求，简要说明修改内容。

## 公开贡献者规则

大多数公开贡献者无法访问私有 API 后端仓库。没有后端源码证据时，只改进语法、清晰度、格式或错字等措辞问题。

不要改变文档记录的公开行为，包括请求／响应结构、字段、认证要求、scope、状态码、枚举值、校验规则、WebSocket 路由、OAuth 行为，以及暗示契约变化的示例。

## 避免事项

- 不要编造路由、字段、OAuth 行为、WebSocket 事件、scope、限流或规则。
- 能够通过定点修改解决时，不要大范围重写。
- 没有后端源码证据时，不要改变文档记录的公开行为。
- 不要提交密钥、令牌或本地环境文件。
- 不要将纯格式重写和行为变更混在一起。
