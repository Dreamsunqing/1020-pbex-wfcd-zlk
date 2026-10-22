# wfm-electron

[GitHub 仓库](https://github.com/42bytes-team/wfm-electron)

`wfm-electron` 是 Warframe.market 集成的桌面应用示例，主要演示第三方 Electron 应用如何认证用户、处理带 PKCE 的 OAuth 风格流程，以及从桌面环境调用 Warframe.market API。

此仓库是集成示例，不是 Warframe.market 主前端。

## 当前状态

OAuth 2.0 尚未开放第三方客户端公开注册。因此，此仓库的部分内容可能超前于目前公共集成实际可用的能力。

此项目仍可作为桌面应用结构、本地回调处理、令牌存储考量和未来集成模式的参考。

## 适合贡献的内容

- 修复 Windows、macOS 或 Linux 上的平台特有行为。
- 公开 OAuth 行为变化时，改进 OAuth／PKCE 演示流程。
- 改进授权、令牌刷新和网络故障的错误处理。
- 改进项目结构、TypeScript 类型、React 组件或状态管理。
- 改进打包和构建脚本。
- 补充更清楚的运行、构建或调试说明。
- 修复演示中的界面缺陷或无障碍问题。

## 开始之前

应至少熟悉以下部分工具：

- [Electron](https://www.electronjs.org/)
- [React](https://react.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- 带 PKCE 的 OAuth 授权码流程
- 桌面应用打包

大型修改前先发起 issue 或讨论。涉及认证行为、令牌存储或安全模型变化时尤其如此。

## 本地运行

安装依赖：

```bash
yarn install
```

启动应用：

```bash
yarn start
```

构建／打包应用：

```bash
yarn make && yarn package
```

项目使用 Electron Forge 构建和打包。

## 安全要求

应谨慎对待认证示例。

修改认证相关代码时：

- 不要记录访问令牌、刷新令牌、授权码或密钥。
- 不要明文存储令牌，除非仓库已因纯演示目的这样做，且文档已明确说明。
- 不要削弱 PKCE 或重定向校验。
- 不要硬编码生产环境凭据。
- 优先采用简单、明确的流程，避免过度抽象。

## 拉取请求要求

好的拉取请求会说明：

- 测试平台。
- 运行过的命令。
- 修改是否影响认证行为。
- 界面修改的截图或录屏。
- 发现的限制。

尤其欢迎跨平台修复，因为原始演示并未在每种操作系统上深入测试。

## 避免事项

- 不要将此仓库描述为 Warframe.market 官方桌面客户端。
- 不要提交凭据、令牌或本地环境文件。
- 重大 OAuth 行为修改前，应确认当前公开 OAuth 的可用性。
- 没有明确理由时，不要添加重型依赖。
- 不要将纯格式重写和行为变更混在一起。
