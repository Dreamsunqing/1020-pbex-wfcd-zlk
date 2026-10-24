# 游戏资源提取与 Windows 远端调试

核对日期 2026-10-24。本文保留可继续实施的项目与操作路线；本轮没有连接另一台 PC，没有安装远控服务，也没有调用其 DeepSeek。已有 SSH 可继续使用，实施时只需确定主机别名、项目目录、游戏缓存目录和实际 CLI 路径，无需在聊天中提交密码或 API key。

## 要找的资源项目

[Puxtril / Warframe-Exporter](https://github.com/Puxtril/Warframe-Exporter) 很可能是此前提到的项目。它提供 GUI 与 CLI，将 Warframe 缓存的自定义格式转换为标准图片、模型等；底层读取库是 [LotusLib](https://github.com/Puxtril/LotusLib)。[下载入口](https://github.com/Puxtril/Warframe-Exporter/releases/latest) 和源码 README 已保留在本文，不复制整个第三方仓库或游戏缓存。

游戏资源在安装目录的 `Cache.Windows` 等缓存目录中，以配对的 `.toc`、`.cache` 保存。`.toc` 索引本身不包含完整纹理；必须有对应 `.cache` 与所需解压依赖。Mac 没有游戏缓存时，这个工具不能凭空提取资源。建议在已有游戏的 Windows PC 上提取选中的小批图，再传回 Mac；无需在 Mac 安装完整游戏或复制几十 GB 缓存。格式与依赖以 [LotusLib 说明](https://github.com/Puxtril/LotusLib) 为准。

首次流程：

1. 在 Windows 确认真实游戏安装位置、缓存版本和配对文件；显式选择目录，不默认递归搜全盘。
2. 获取匹配 Windows 的 Exporter 发布文件，先运行 GUI 查看目录，或对实际 CLI 执行 `--help`，按当前版本帮助确定参数。不要假设两个程序参数完全相同。
3. 以缺失敌人的 Plus `icon` 完整虚拟路径（例如 `/Lotus/Interface/Icons/Npcs/...png`）查询缓存，只提取小批 PNG；测试成功再批量。
4. 记录虚拟路径、游戏版本、工具版本、源缓存标识、输出哈希。用完整 ID → 官方 icon 路径 → 提取文件建立关联，不能改名后只靠中文名匹配。
5. 回传选定文件与映射清单，落在本项目 `assets/content/official/img`，按内容哈希去重。未来应增加单独 `game-cache-image-index.json` 读取层；**当前尚未实现这一导入器**，不要覆盖 Public Export `index.json` 或伪造 Manifest URL。

官方 Public Export 已公布纹理可继续用现有 Manifest 下载；游戏缓存用于补它没有公开的图片。Wiki 补图当前已可用，见 [敌人图片流程](29-敌人掉落图片与装备详情规范.md)。

## 哪种控制方式适合这项工作

| 方式 | 适合的工作 | 当前边界 |
| --- | --- | --- |
| Mac SSH → Windows OpenSSH | Git、Node 核心测试、打包、资源提取 CLI、远程 DeepSeek CLI、读日志 | 推荐作为日常基础；可直接用已有连接。SSH 的会话不等于登录中的图形桌面 |
| VS Code Remote SSH | 人工看远端代码、终端、修改与调试 | 适合你同步检查，仍复用 SSH；不是让当前 AI 自动看到屏幕的桥 |
| RDP／VNC 等桌面连接 | 你预览 Windows 实际界面、首次设置工具 | 人的远程桌面；不能仅靠连接就让当前 AI 获得截图／点击工具 |
| Windows 用户桌面中的自动化代理 | 截图、窗口树、按控件点击、键盘输入、Electron UI 回归 | 需要另行部署，让代理运行在已登录的交互会话，再通过受控命令／桥接调用 |

Windows OpenSSH 与 Remote SSH 的连接方式分别见 [Microsoft](https://learn.microsoft.com/en-us/windows-server/administration/openssh/openssh_install_firstuse)、[VS Code 官方说明](https://code.visualstudio.com/docs/remote/ssh)。RDP 主机支持 Pro／Enterprise／Server 等，Home 不能按相同方式作为 RDP 主机，见 [支持表](https://learn.microsoft.com/en-us/windows-server/remote/remote-desktop-services/remotepc/remote-desktop-supported-config)。

对于 AI，优先“SSH 执行可重复脚本 → 输出 JSON、日志、截图文件 → Mac 读取”。核心测试、文件与命令行工作无需远程鼠标。Windows Electron 的有界面截图测试，应由登录桌面中的代理启动；不要承诺从 SSH 直接启动就能控制桌面。

若后续需要通用 Windows GUI 控制，可使用 UI Automation／[pywinauto](https://pywinauto.readthedocs.io/en/latest/index.html) 读取窗口控件，再补截图、坐标点击。其 [远程执行指南](https://pywinauto.readthedocs.io/en/latest/remote_execution.html) 明确讨论了 SSH／服务会话、锁屏及 RDP 断开对 GUI 的影响。建议代理暴露少量明确动作：列窗口、读取窗口树、截图、点击指定控件、输入文本、运行登记脚本；不要把一个能执行任意命令的裸 HTTP 接口直接开放到局域网。可由 SSH 转发通道承载请求，返回 PNG 和 JSON，才成为 AI 可使用的桥。此桥仍需配置，本轮未安装。

[OmniParser](https://github.com/microsoft/OmniParser) 可以协助识别截图控件，但它本身不是远程访问协议，也不能替代截图／点击执行代理。当前项目已有 Playwright Electron 定点检查，能按 DOM 操作本工作台，比识图坐标更稳定；原生导出器再考虑 UI Automation。

## 沿用已有 SSH 的最小操作

以下 `windows-dev` 是示例别名，须替换为已经配置好的连接；不改现有 SSH 设置。先在远端建立 `C:\Workbench`，然后在 Mac 发送本项目只读探测脚本：

```sh
scp 工具/Windows远端环境检查.ps1 windows-dev:C:/Workbench/remote-check.ps1
ssh windows-dev powershell.exe -NoProfile -File C:/Workbench/remote-check.ps1
```

脚本只返回命令安装路径、PowerShell 版本、当前会话和明确指定缓存目录的配对数量，不读凭据或启动模型。带游戏目录时，在远端 PowerShell 中运行：

```powershell
& 'C:\Workbench\remote-check.ps1' -GameCache 'D:\Games\Warframe\Cache.Windows'
```

在自己的工作副本目录运行 `npm ci`、`npm test`、`npm run pack:win`。有改动时先检查工作区，用指定提交或补丁同步；不让两台机器同时改同一共享目录。把本次报告写入独立 `artifacts`，用 `scp` 拉回 Mac。不要同步 `node_modules`、`.workbench`、游戏缓存或整个图库；所需新增图片按哈希清单增量传回。

## 调用另一台 PC 的 DeepSeek CLI

可以，通过 SSH 调用远端**实际安装的** CLI，让 PC 使用它自己的环境与模型配置。先由探测脚本确认 `deepseek`、`codex` 或其他命令的完整路径，再在远端执行该程序的 `--help`。`deepseek` 没出现在 PATH 不等于未安装，非交互 SSH 的 PATH 也可能和桌面终端不同。

流程：任务文本保存为文件并传过去 → 远端脚本进入指定仓库 → 按那个 CLI 的帮助运行非交互模式 → 输出日志、完成说明和补丁 → Mac 审查／测试。CLI 的 prompt 文件、stdin、`exec` 等参数以远端实际版本为准；本机 DeepSeek Codex worker 封装只代表本机，不能直接当另一台 PC 的命令语法。

首轮适合分配“列出指定缓存里匹配的图标路径”或“实现一个边界明确的脚本并输出补丁”。任务写清输入路径、允许修改文件、验收命令和不得自动 push／发布。调用现有远端模型配置，不把 token 写进命令、任务文件或日志。图形操作与 CLI 推理是两个通道：能够调用 DeepSeek，不意味着它已有桌面控制能力。

当前还缺具体连接别名、远端目录、CLI 名称／路径与游戏缓存位置；确定这些非敏感信息后可按本文建立实际闭环。本文不要求现在再次安装 SSH 或更改防火墙。
