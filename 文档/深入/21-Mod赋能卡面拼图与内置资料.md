# Mod、赋能卡面拼图与内置资料

更新：2026-10-24；首次发布版本 0.15.0。

## 给使用者

资料库使用随程序附带的离线快照，首次进入无需构建、无需源 JSON、无需网络。当前快照有 32,941 个实体；实体总数包含关联需要的内部定义，列表仍应用隐藏规则，因此分类数字之和不等于实体总数。0.16.5 快照压缩约 5.30 MiB，解压 JSON 约 77.5 MiB；后台校验、解压并缓存一次。大图库仍走共享 `assets/content`，不随小型数据快照重复打包。

自 0.16.3 起，Mod 列表、详情及其他共享图片入口统一展示完整竖版卡面，包括中文名称、最高等级效果、适用类型、容量、极性及等级点。等级滑块展示其他等级的数值说明，卡面本身固定最高等级。赋能使用稀有度底图叠加独立图标。没有插画、稀有度不明确或组件读取失败时回退原有图片／文字卡，不伪造卡面。

## 素材获取与来源

实际参考 App：本机 `/Users/dream/Documents/仓鼠互助洞/主APP/cangshu/cangshuClient`。只读参考，运行时不依赖该路径。

| App 文件 | 本项目实现 |
| --- | --- |
| `pages/wf-items/common/mod-assets.js` | `src/core/card-art.mjs` 选择器 |
| `pages/wf-items/common/ModArtFrame.vue` | 早期列表小卡框参考，现已统一为完整卡面 |
| `pages/wf-items/common/ModCard.vue` | 完整卡面图层与容量算法 |
| `pages/wf-items/common/arcane-assets.js`、`itemDetail/arcanes.vue` | 赋能底图和图标位置 |
| `static/images/mods/wiki/*.png` | `src/ui/assets/card-frames/mods/wiki/` |
| `static/images/mods/polarities/*.png` | `src/ui/assets/card-frames/mods/polarities/` |
| `static/images/arcanes/*.png` | `src/ui/assets/card-frames/arcanes/` |

共复制 61 张 PNG，1,654,953 字节；逐张校验 PNG 签名，`src/ui/assets/card-frames/manifest.json` 记录相对来源、字节数、SHA-256。没有复制整套 App 图片。素材是从本地 App 取得，并非本次重新向 Wiki 下载。

App README 记录：Mod 组件源自 Warframe Fandom Wiki 的 Mod Components，2026-07-25 经 MediaWiki API 获取；极性为 SVG 缩略图转换后的 PNG，颜色已统一为浅色。赋能底图的原始外部出处未登记，保持“App 本地素材”来源，不标成 DE 官方图。原始插画／赋能图标继续由本项目 WFCD、官方图库解析。

重新取素材：

```sh
node 工具/13-准备卡面素材.mjs '/实际路径/cangshuClient'
```

只取上述三个目录中的 PNG，更新本项目同名文件和来源清单；不访问 App 数据库或修改 App。新增素材需同步选择器和测试，未经验证的外部素材不要覆盖当前图层。

## 拼图规则

`cardArt(item)` 输入 P3 实体，稀有度大小写归一。普通 Mod：COMMON→Bronze、UNCOMMON→Silver、RARE→Gold、LEGENDARY→Legendary。先按英文身份识别 Riven、Amalgam、Galvanized，再处理 Plexus／Railjack 专用框；不能用中文标题猜框。未知稀有度返回空，不统一塞金框。

| 特殊类型 | 规则 |
| --- | --- |
| Riven | 紫框、专用光效／底签／容量板；无背景文件时使用紫色底 |
| Amalgam | 专用背景、顶框、底框；底签和容量板回退已有稀有度 |
| Galvanized | 专用背景、顶底框、侧光、底光及不同尺寸 |
| Plexus / Railjack Mod | Avionic 铜／银／金顶底框；保留本稀有度背景和标签 |

Mod 统一使用 300×440 逻辑画布，以 2 倍像素输出 600×880 PNG（宽高比 15:22）。列表不再生成 116×108 无字缩略图。基础顺序为背景→原始插画→侧光→文字区域暗底→顶底卡框→名称／效果→类型底签→容量与极性→角光／底光→等级线与点。文案经 `plainGameText` 中间件转为安全文本后换行、按区域缩小字号；原始 JSON 不被修改，完整字段仍在详情正文展示。

### 统一卡面与显示比例

- 共享渲染：`src/ui/card-art.js` 的 `composeCardArt` 对 Mod 始终生成完整卡面，不再按列表／详情分支；相同插画和文本复用同一份组合缓存。
- 文本来源：`src/core/merge/service.mjs` 的 `localizedCardArt` 根据请求语言投影 `attributes.levelStats`、`attributes.compatName` 等嵌套字段，再调用 `cardArt`。名称使用实体名称，避免把奖励数量或其他页面的标题画进 Mod。最高等级效果、类型、容量、极性和等级点沿用结构化字段。
- 入口覆盖：`src/ui/images.js` 为资料库、技能／武器强化关联、合并汇总、赏金与世界状态奖励／商店、JSON 卡片预览和 WM 统一装饰图片。JSON／WM 仅传完整 ID 时，后台 `images` 用当前玩家数据补充卡面元信息；调用方已有元信息时保持其数据版本和语言。
- 外卡不变：资料库保留原网格、留白和文本区域；主列表图片槽仍高 135 px，关联图片槽仍高 90 px。竖图等比缩放、完整包含，禁止裁切或拉伸。详情保留 225×330 显示区；紧凑奖励和 WM 沿用各自图槽，使用同一带字卡面，点击原有入口看大图。
- 数据边界：拼接只产生内存中的 PNG，不覆盖 WFCD／官方插画；图片资源页和原图导出继续呈现来源原图。未知稀有度或缺图沿用原回退，不伪造效果、图框或翻译。赋能、蓝图叠底和 Tau 叠层规则保持原实现。

容量读取 `stats.baseDrain`／`stats.fusionLimit`，再回退属性字段；负容量光环为 `abs(baseDrain-fusionLimit)`，其他为 `abs(baseDrain+fusionLimit)`。缺失容量不补 0；升级次数必须为 0–20 的整数。只对明确映射的极性使用图标，未知极性不猜图片；通用极性为 ◎。

赋能画布 248×228：稀有度底图居底，104×104 的图标居中下移 13 像素。COMMON／UNCOMMON／RARE／LEGENDARY 对应 `Common.png`／`Uncommon.png`／`Rare.png`／`Rare-Legendary.png`。本机 App 当前 JSON 为 162 条，本项目赋能为 177 条；其中 160 条可按完整 ID 比较且有 App 稀有度标记，全部与 P3 一致。实际使用 P3 明确稀有度，不把 App 旧 README 的 172 条当作当前统计。

`src/ui/card-art.js` 在 Canvas 中实际拼成 PNG data URL，`src/ui/images.js` 将结果用于资料库、合并汇总等共享图片展示。依赖资源打包在源码目录，离线可用，兼容现有 CSP，无网络请求。素材解码缓存仅覆盖这套小素材；组合结果最多缓存 80 个，离开页面不落一份新图库。蓝图／Tau 已有多层图片直接沿用原规则，不重复套 Mod 框；原图及图库导出保持不变。

## 预构建数据的生产与读取

```sh
# 先用现有“合并汇总”或工具/03-合并数据.mjs 完成 P3 构建
node 工具/14-预构建资料库.mjs .workbench/merged/<context摘要>
# 发布前验证；打包钩子自动执行这一项
node scripts/prepare-player-library.mjs --check
```

`src/core/player-bundle.mjs` 从通过完整仓库校验的 P3 构建提取：玩家实体字段、关联、配方、字段定义、多语言嵌套投影、内部定义隐藏清单以及预计算图片描述符。移除开发专用溯源／冲突报告和玩家页面不用的属性。0.16.5 增加套装关系、Wiki 字段及 `player/acquisition.json` 获取索引；后者保留每条来源所需的精简证据，不复制整个 drops 原数组。见 [套装 Mod](26-套装Mod关联效果与卡面.md) 和 [Wiki 与获取](27-资料库Wiki与掉落获取.md)。保持源 datasetVersion，`src/data/player-library/manifest.json` 另记输入文件哈希、生成时间、压缩字节数及 SHA-256；`data.json.gz` 随源码和发布包保存。更新原始数据不会自动改变该快照，发布维护者必须重新运行生成命令并提交两个文件。

桌面后台 `playerLibraryStatus/List/Detail` 优先复用内置快照；当前目录或快照仓库中，只有建模版本与内置资料一致的完整 P3 构建可覆盖内置数据。旧结构或试点构建继续保留在合并汇总，避免遮盖新功能。先轻量检查 current 指针和清单，避免为相同数据加载近 800 MB 的开发报告。页面请求带 datasetVersion 防止混版；切换目录重置页面状态。源目录不存在或未构建仍可看内置资料；存在但损坏的不同版本构建会报错，不静默伪装成已更新。该精简数据只能供玩家查询，不能代替可追溯的合并仓库进行编辑、差异和导出。

## 检查

- `test/card-art.test.mjs`：特殊框、容量边界、未知稀有度、61 张素材哈希及中英文嵌套卡面文本投影。
- `test/player-bundle.test.mjs`：包内快照校验、无源数据浏览、战甲四技能关联和多层中文 Mod 效果。
- `scripts/check-player-library-ui.mjs`：空白用户目录真实打开；不链接合并缓存、不构建；列表、详情、筛选、关联、蓝图、拼图、深浅模式和窄窗口截图；另验证列表／关联／奖励／商店／合并／WM 完整卡面、600×880 输出比例及外卡尺寸不变。

更多入口见 [玩家资料库](20-玩家资料库.md)、[原图与蓝图规则](04-图片获取处理与蓝图合成.md)、[语言映射](10-字段字典与多语言映射.md)。
