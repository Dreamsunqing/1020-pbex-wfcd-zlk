# 世界状态资料库上游资料包

## 第一版应用

现已加入上游资料工作台：各来源独立预览、自动更新、历史快照和活化/仲裁推算。使用方式见 [使用说明](使用说明.md)，测试与成品状态见 [第一版验收记录](文档/04-第一版验收记录.md)，应用源码在 `src/`。跨来源合并汇总（P3）和邮件通知暂不实现。下文的“尚未生成 ZIP”指原始历史资料包整理记录，不代表工作台应用的打包状态。

0.1.1 增加来源、类型、语言、数据类别四维多选 picker 和文件徽章，内容预览列扩至 75%。本次验证见 [多维筛选验收](文档/05-多维筛选验收.md)。

GitHub 保存地址：[Dreamsunqing/1020-pbex-wfcd-zlk](https://github.com/Dreamsunqing/1020-pbex-wfcd-zlk)。首版发布标签为 `v0.1.1`，桌面安装包见 [Release](https://github.com/Dreamsunqing/1020-pbex-wfcd-zlk/releases/tag/v0.1.1)。

仓库保存工作台源码、文档和 637 个上游资料文件。四个上游仓库以普通文件保存，原始来源与固定提交记录仍在快照清单中；本地保留的上游 `.git` 历史不上传。依赖、运行快照、缓存及打包目录不进入 Git。下文包含 `.git` 的 750 文件规模描述对应原始本地资料包。

```bash
git clone https://github.com/Dreamsunqing/1020-pbex-wfcd-zlk.git
cd 1020-pbex-wfcd-zlk
npm ci
npm start
python3 工具/校验资料包.py
```

克隆后默认核验 637 个资料文件。对仍保留四个上游 `.git` 的原始本地资料包，可运行 `python3 工具/校验资料包.py --include-git` 核验全部 750 个文件。

待确认的目录版资料包，尚未生成 ZIP。整理日期：2026-10-19。

资料包含官方 Public Export、四个保留既有 Git 历史的社区仓库，以及新加入的 WFCD Items 无图片源码与数据快照。可脱离世界状态 API 项目阅读、查询和校验。

## 从这里开始

1. [数据来源与获取方法](文档/01-数据来源与获取方法.md)：来源分工（含 WFCD Items）、来源网址、Fandom Public Export 教程出处、采集时间、固定提交、语言代码、独立下载方法与边界。
2. [各类 JSON 内容说明](文档/02-各类JSON内容说明.md)：官方 16 类、Plus 44 类导出、Oracle 清单、WFCD 26 类物品及 14 种语言数据、字典与配套 JSON 的实际内容和条目数。
3. [JSON 文件清单](文档/JSON文件清单.tsv)：逐文件路径、用途、数量、大小、哈希及 GitHub / browse.wf 两列网址，可用表格工具打开。
4. [JSON 文件结构清单](文档/JSON文件结构清单.json)：各文件字段、分组长度与截断示例。
5. [官方来源映射](文档/官方文件来源与当前文件映射.json)：远端原版本/哈希与本地改名格式化文件的对应关系。

核验记录见 [整理与核验记录](文档/03-整理与核验记录.md)。

## 来源分工

| 来源 | 用途 | GitHub URL | browse.wf URL | 收录状态 |
| --- | --- | --- | --- | --- |
| DE 官方 Public Export | 官方静态物品、星图、配方、奖励及多语言文本 | [社区镜像](https://github.com/calamity-inc/warframe-public-export) | — | 已保存 15 种语言、240 份 Manifest |
| Plus | 增强静态资料与独立语言字典 | [warframe-public-export-plus](https://github.com/calamity-inc/warframe-public-export-plus) | [在线 JSON](https://browse.wf/warframe-public-export-plus/) | 已随包保存 |
| WFCD Items（warframe-items） | 分类物品资料，含图片名称/哈希等元数据、掉落率、更新日志与紫卡关联；npm 包为 `@wfcd/items` | [WFCD/warframe-items](https://github.com/WFCD/warframe-items) | — | 已保存非图片文件，无 `.git` |
| Plus 生成器 | Plus 的生成逻辑与补充输入 | [warframe-public-export-plus-gen](https://github.com/calamity-inc/warframe-public-export-plus-gen) | — | 已随包保存 |
| Oracle | 赏金与挑战清单、补充字典、轮换推算逻辑 | [wf.browse.oracle](https://github.com/calamity-inc/wf.browse.oracle) | [Oracle 服务](https://oracle.browse.wf/) | 已随包保存 |
| browse.wf | 数据展示与消费代码、浮印等配套资料 | [browse.wf](https://github.com/calamity-inc/browse.wf) | [网站入口](https://browse.wf/) | 已随包保存 |

WFCD Items 已缓存到 `世界状态上游/wfcd-items/`：固定提交 `20f8d9427a5a62268817853eefd8962d18c0b70e`，保存 153 个文件（101,250,492 字节），排除 12,543 个 PNG/JPG 文件和 1 个内嵌 SVG 的 JSON。分类数据、语言数据、图片哈希索引、源码、配置和许可证均保留；没有 `.git` 或图片内容（含内嵌 SVG 的 `data/logo.json` 也已排除）。获取及校验信息见 `wfcd-items-snapshot.json`。

## 本包规模

| 项目 | 数量 |
| --- | --- |
| 资料文件（含原四个 Git 内部文件） | 750 |
| 资料总字节数 | 674,590,772（约 643.3 MiB；不代表 ZIP 大小） |
| 官方语言/JSON | 15 种 / 240 个 |
| Plus JSON（含字典和 npm 配置） | 62 |
| Plus 生成器 JSON 后缀文件 | 8 |
| Oracle JSON | 23 |
| browse.wf JSON 后缀文件 | 5 |
| WFCD JSON 后缀文件 | 63 |
| 原快照 JSON / WFCD 来源清单 | 1 / 1 |
| 全部 JSON 后缀文件 | 403（401 个严格 JSON，2 个非严格 JSON，详见结构清单） |

`zh/ExportResources_zh.json` 的 `ExportResources` 数组为 **3549 项**。条目数不是按名称或 uniqueName 去重后的物品数。

## 目录

```text
世界状态资料库上游资料包/
├── README.md
├── 世界状态上游/
│   ├── README.md
│   ├── snapshot-manifest.json
│   ├── official-public-export/  # lzma、indexes、manifests
│   ├── git/                    # 四个原仓库，含 .git
│   ├── wfcd-items/             # WFCD 源码与数据，排除图片，无 .git
│   └── wfcd-items-snapshot.json # 新增来源与排除清单
├── 文档/                       # 两份说明、结构/来源/校验清单
└── 工具/
    ├── 按快照重新获取.py
    ├── 缓存WFCD无图片.py
    └── 校验资料包.py
```

## 离线校验

在本目录运行（只需要 Python 3）：

```bash
python3 工具/校验资料包.py
```

重新获取方法见第一份文档，需要网络、Python 3.10+ 和 Git；本次实际联网获取了 WFCD 部分，原官方数据和原四仓库未重新联网下载。官方 JSON 的格式化哈希与原快照下载哈希口径不同，文档中已分别保留。两份带注释的上游配置保持原状，不作为下载失败。

官方数据与原四仓库沿用 2026-10-04 的来源记录；WFCD Items 是 2026-10-19 新获取的固定提交快照。不含正在更新的世界状态服务运行数据、所有图标二进制或 Plus 完整生成环境。

网址补充于 2026-10-19：[Fandom Public Export 教程](https://warframe.fandom.com/wiki/Public_Export#Details)、[browse.wf 数据浏览说明](https://browse.wf/about)。两份主题文档的表格与 TSV 已同步补充可确认的逐文件链接。
