# 资料包工具箱

这里是可以直接运行的统一入口。业务实现仍复用 `scripts`、`src/core`，没有再复制一套图库或处理逻辑。

## 打开

Mac 双击 `打开工具箱.command`；Windows 双击 `打开工具箱.cmd`。或在完整项目中运行：

```sh
node 工具/资料工具.mjs
```

Node.js 22.19+ 和项目依赖是前提；WFCD 获取／完整图片整理还需要 Python 3。安装依赖用 `npm ci`，不要为了浏览本地图库重复运行下载命令。

## 分别运行

```sh
node 工具/01-获取数据.mjs
node 工具/02-处理数据.mjs
node 工具/03-合并数据.mjs
node 工具/04-获取WFCD图片.mjs
node 工具/05-获取官方图片.mjs
node 工具/06-处理图片.mjs
node 工具/07-合成蓝图.mjs --id /Lotus/Types/Recipes/WarframeRecipes/RunnerBlueprint --result-id /Lotus/Powersuits/Runner/Runner
node 工具/08-启动工作台.mjs
node 工具/09-打包程序.mjs
node 工具/10-文本标记清单.mjs
node 工具/11-获取文本图标.mjs
node 工具/12-校验语言映射.mjs
node 工具/15-获取敌人图片.mjs
```

这些是独立命令清单，不是要求依次全部执行。01、04、05、11、15 会联网；02、03、06、10 可能耗时。已有资料和图库可以直接启动 08。测试已恢复；排错仍不默认重新扫描大图库。

所有编号入口支持 `--预览命令`，只打印工作目录和调用参数，不执行维护。总入口支持中文任务名或编号。蓝图不带参数时只显示用法，缺成品关系不会猜图。

## 写到哪里

- 数据快照：`.workbench`；默认合并本地原件，想用在线快照需显式 `--release`。
- 字段清单：`输出/数据处理/字段结构清单.json`。
- 合并导出：`输出/合并数据`，构建存储在 `.workbench/merged`。
- WFCD：`assets/content/wfcd/img`，目录和索引在 `wfcd`。
- 官方：`assets/content/official/img`，Manifest 和索引在 `official`。
- 蓝图 PNG：`输出/蓝图合成`，或 `--out` 指定的位置。同名自动编号，不覆盖源图。
- 文本图标：`src/ui/assets/text-icons`；映射与下载来源在 `src/data/text-icon-assets.json`，属于应用运行时小资源。
- 应用：`dist`，Mac x64、Windows x64，保留当前和上一版。

原有 `按快照重新获取.py`、`缓存WFCD无图片.py`、`校验资料包.py` 继续保留，专门处理早期固定原始包，不自动加入新流水线。

深入：[脚本地图](../文档/深入/00-数据与图片流水线脚本地图.md)、[全部参数和协作](../文档/深入/06-工具运行与协作手册.md)、[蓝图与图片](../文档/深入/04-图片获取处理与蓝图合成.md)。

10 只扫描资料 JSON 中的文本标记，输出 `输出/文本处理/文本标记清单.json`（次数、来源指针、未知项），不改人工登记表、不扫描图片。登记与展示说明见 [文本标记中间件](../文档/深入/08-展示规则文本标记与配图修复.md)。

11 读取本地 Plus ExportTextIcons，优先复用官方精确纹理路径，缺失时从 browse.wf 获取；按内容哈希去重，已有正确文件不重下，然后生成离线 JS 登记表。只改人工中文登记表时，运行 `npm run prepare:text-icons` 即可。详见 [启动与真实文本图标](../文档/深入/09-启动故障与真实文本图标.md)。

12 核对当前合并缓存中的语言字段、字典指针、官方已有中文的映射和中间件汉字保真；输出 `输出/本地化/映射审计.json`。需先用新版重新构建，不扫描图库。详见 [多语言映射](../文档/深入/10-字段字典与多语言映射.md)。

沉沦之地静态奖励更新：`python3 工具/更新沉沦之地奖励.py`。仅提取官方掉落表中的沉沦之地候选池，不生成本周实际奖励、不下载图库；支持 `--html /absolute/path/droptables.html` 离线提取。详见 [双难度与奖励维护](../文档/深入/16-沉沦之地双难度与奖励节点.md)。


- `13-准备卡面素材.mjs <cangshuClient目录>`：复制小型 Mod／赋能拼图组件及来源哈希。
- `14-预构建资料库.mjs <merged/context目录>`：从已验证 P3 生成随程序附带的玩家资料。说明见 [卡面与快照维护](../文档/深入/21-Mod赋能卡面拼图与内置资料.md)。
- `15-获取敌人图片.mjs`：Wiki 完整敌人 ID → Plus Avatar → 图片 URL，按内容哈希补充到共享 `wfcd/img`；独立索引保存实际来源。跨站同名图片不直接复用；见 [敌人立绘与 UI 规范](../文档/深入/29-敌人掉落图片与装备详情规范.md)。
- `Windows远端环境检查.ps1 [-GameCache <缓存目录>]`：在另一台 Windows PC 上只读列出命令路径、会话与指定缓存配对数量。没有安装或运行 DeepSeek，也不读凭据。传输和调用见 [远端调试指南](../文档/深入/30-游戏资源提取与Windows远端调试.md)。本机未运行 Windows PowerShell，脚本尚待目标 PC 验证。

## 0.17.0 新维护入口

- `node 工具/16-刷新官方掉落表.mjs`：更新 `.workbench` 当前／上一版快照，原文和规范化表一起保存，失败保留旧版。
- `node scripts/prepare-drop-tables.mjs`：把已验证当前表写入程序内置 gzip 和校验清单；更新发布包之前执行。
- `node 工具/17-维护项目图示.mjs`：重画项目三张 PNG；加 `--write-vault` 同步当前打开的 Obsidian 库 Canvas。

完整规则：[掉落表与仲裁](../文档/深入/31-官方掉落表与跨模块关联.md)、[Wiki 资源与画板](../文档/深入/32-资源维护踩坑与项目Canvas.md)。

## Wiki 原图与地点审计（0.17.1）

```sh
node 工具/18-维护Wiki图片.mjs --resume
node scripts/audit-drop-images.mjs
node scripts/prepare-drop-terms.mjs
```

Wiki 独立目录 `assets/content/wiki/` 替代旧敌人图混入 WFCD 的约定。工具 15 仍可用，调用新同步器的 `--enemies-only` 模式。原始文件目录不等于已下载量，实际数量和失败见 `artifacts/wiki-images/report.json`，覆盖与未映射地点见 `coverage.json`。参数、迁移、索引与更新策略见 [维护文档](../文档/深入/33-Wiki图库增量维护与交易校验.md)。
