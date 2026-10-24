# 资料库 Wiki、掉落与获取关系

适用 0.16.5。玩家在物品详情右侧查看 Wiki，在主栏查看“掉落与获取”。本次沿用已固定的离线来源，不抓取 Wiki 正文，也不把静态奖励表当作实时任务。

## 玩家如何使用

- **Wiki**：有上游字段时展示 Warframe Wiki；灰机 Wiki 分中文、English 两个入口，按该语言物品名生成，重名只显示一次。点击在系统浏览器打开；程序内离线浏览不主动联网。按名称生成的页面可能未收录，悬停有提示。
- **掉落与获取**：可切换“全部／掉落／奖励池”，每次加载 20 条；显示已有轮次、概率、数量和来源。来源遗物有完整 ID，或节点／敌人能唯一匹配时，可进入其资料页，再返回上一个物品。
- **遗物和配方**：继续使用已有“获取遗物／蓝图获取遗物／制作蓝图／制造材料”等双向关系。Prime 部件见 [第 23 章](23-Prime部件遗物与蓝图中文.md)。
- 无可靠获取关系时不显示空模块；“未提供概率”不代表 0%。缺少中文地点时保留来源原文。

## JSON 字段如何对应

| 来源文件 | 原字段 | 处理及结果 |
| --- | --- | --- |
| `世界状态上游/wfcd-items/data/json/*.json` | `uniqueName`、`wikiaUrl` | P3 完整物品 ID 上保留 URL。`wikiaThumbnail` 是缩略图地址，不是文章链接 |
| 同上，含 Mods、Arcanes、Resources、Components、Relics 等 | `drops[].location` | 掉落地点；尾部 `, Rotation A/B/C` 单独展示轮次，其余部分保留原文 |
| 同上 | `drops[].type` | 奖励名，必须与当前物品身份相符；明确的 `2X` 等数量前缀拆成数量，不存在则未知 |
| WFCD `Components.json` | `drops[].uniqueName` | 来源遗物完整 ID，关联其家族；`location` 明确写精炼品质时切到对应品质，显示中文并可跳转四档概率 |
| 同上 | `drops[].chance` | 这些物品掉落记录使用 **0…100 的百分数**；18.97 显示 18.97%，0.29 显示 0.29%，不再乘 100。只接受有限且范围合法的值，0 正常展示 |
| `世界状态上游/git/warframe-public-export-plus/ExportRewards.json` | 奖励表完整 ID → 池数组 → `type`、`itemCount`、显式概率 | P3 解析为 `reward-tables.json` 的 `itemId`、`quantity`、`probability`。此处概率已规范为 0…1，显示时乘 100；只有稀有度不推算概率 |
| Plus 的 `ExportRegions.json`、`ExportKeys.json` 等及现有 Oracle 赏金引用 | `rewardManifests` 等完整奖励表引用 | 复用 `reward-context.mjs` 反查任务背景，精确引用能找到节点／任务实体时建立跳转；路径家族推定与未知背景仍保留证据类型 |
| WFCD `Node.json` 与 Plus `ExportRegions.json` | 节点名、`systemName`、`missionName`、等级 | `Earth/Cambria (Spy)` 先匹配唯一英文节点，再验证星球；展示时取该节点同语言字段，可得到“地球 · Cambria · 间谍”等。有正式中文节点名则使用中文 |
| Plus `ExportRecipes.json` | 蓝图 ID、`resultType`、配方材料 | 精确蓝图 → 成品关系，生成完整蓝图名并辅助验证掉落奖励名；制造关系沿用已有 P3 数据 |

以“加速冲击 / Accelerated Blast”为例：WFCD Mod 的 `drops` 提供 Nightmare Mode 的 A 轮、18.97%；详情直接展示 18.97%，灰机两个地址分别使用“加速冲击”和“Accelerated_Blast”。这与套装装备件数及 Mod 强化等级无关。

## 身份验证与歧义处理

WFCD 部分 `drops` 由名称子串匹配生成，会混入其他物品。例如 Strun 会带入其竞技场皮肤奖励，Guardian 可能带入 Guardian Derision，Kuva 可能带入场景奖励。因此不能不加检查地展示整个数组。

本版用当前物品英文名做规范化的完整奖励名比较，仅统一大小写、弯引号和空白；不做子串关联。蓝图额外允许其**精确配方成品名 + Blueprint**。不同物品即使共享词根，也不能靠名字相近建立跳转。重复的同地点、同概率、同数量记录合并；同地点概率不同保留，不能求和成掉率。

`Enemy.drops` 是“这个敌人掉什么”，而非“如何获得这个敌人”，其结构和单位也不同；节点等记录还可能因名字子串携带无关奖励。本版不将 enemy、region、animal、quest、mod-set 的原始 drops 当作它们自身的获取方式，不套用上述百分数规则。未来若做敌人战利品，应单独建模、核实单位。

组件掉落里的 `uniqueName` 是来源遗物 ID，当前通常指 Bronze。`location` 明确标 Exceptional／Flawless／Radiant 时，按既有遗物家族模型切到对应品质；标题显示中文及品质，跳转后可比较四档概率。未提供这个 ID 时不凭相似名称猜遗物。

WFCD 在不同品质遗物上可能重复给出整族掉落列表。资料库仍按遗物家族默认展示一个；掉落奖励原文明确写 Radiant 等品质时，来源行单独标注“光辉遗物”等，不能把已有精炼奖励误说成完整遗物。遗物内奖励的四档概率仍由 [既有遗物模型](23-Prime部件遗物与蓝图中文.md) 展示。

共享标签 `Blueprint / 蓝图 / 藍圖` 不构成独立物品名称。当存在明确 `resultType` 时，P3 名称候选跳过这类共享标签，沿配方成品生成完整的同语言蓝图名称；来源已有真正独立标题时优先保留。原始 JSON 不改，派生过程保留溯源。此修复也避免生成无意义的 `/wiki/Blueprint`。

## Wiki 地址与语言

上游 `wikiaUrl` 原样使用（也兼容 `wikiUrl`），只允许无账号、无自定义端口的 HTTP(S) Warframe Wiki／Fandom 地址；拒绝可执行协议、文件地址和伪装域名。

灰机使用 `https://warframe.huijiwiki.com/wiki/` 加同语言名称：先通过文本中间件去掉显示控制标记，再将空格替换为下划线，按 URL 路径编码。中文／英文分别生成，不把中文名覆盖英文索引。不拿 `/Lotus/...` 内部路径生成文章地址，不批量探测页面是否存在。

本版 UI 标签以中文呈现；原始掉落地点没有可靠字典映射时仍可能为英文，尤其活动／敌人别名。只在英文名称与节点星球均无歧义时关联已有实体，不把英文短语机械翻译成游戏正式名称。

## 输出、规模和边界

本次快照中：

- 2,855 个实体保留上游 Wiki URL；另按实体已有中英文名生成灰机入口。
- 3,038 个实体有掉落或奖励池记录；55,499 条通过身份检查、去重后的物品掉落记录（其中 15,504 条通过完整来源遗物 ID 关联），11,509 条精确物品 ID 的奖励池记录。遗物各品质实体可能重复承载家族来源，这些是索引记录数，不是不同游戏任务的数量。
- 排除 8,852 条奖励名不符的原始行，合并为 808 类问题；另有 575 个敌人／节点等集合的 drops 未解释为自身获取。
- 内置压缩快照约 5.30 MiB；首次进入无须重建，默认仅渲染 20 条来源，避免一次铺开数千条。

这些是固定上游数据的关系，不承诺全游戏获取方法完整。静态表可能含历史活动、已入库遗物、竞技场及当前未开放的任务；缺少可验证的上线状态时不标“当前可刷”。同一物品多个来源概率不求和。

**候选池编号不是任务阶段、轮次或当前赏金轮换。** 仅 `location` 明确的 Rotation 展示 A/B/C；奖励表引用本身不能推导完整任务条件。本版未新增全商店购买、声望兑换、成就或任务解锁条件的完整模型；已有世界状态商店仍按实时快照展示，不能据静态缺失断言不可购买。

## 代码与维护

- `src/core/player-acquisition.mjs`：Wiki 地址、物品身份验证、掉落索引、奖励表反查、证据和只读投影。
- `src/core/merge/full-build.mjs`：共享蓝图名称修复，完整 ID、同语言成品派生及溯源。
- `src/core/merge/reward-context.mjs`：奖励表引用背景与任务来源。
- `src/core/player-library.mjs`：详情中的 Wiki、来源跳转与节点信息。
- `src/core/player-bundle.mjs`：把来源索引写入 `player/acquisition.json`；保留 Wiki 和节点字段，不再次复制原始 drops 数组。
- `src/ui/player-library.js/.css`：来源筛选、20 条分批列表、外部链接与深浅主题。

当前模型版本 `mod-set-acquisition-1`。修改索引、语言或投影字段后，必须重新生成并一同提交压缩数据与 manifest：

```sh
node scripts/build-merge.mjs
node scripts/prepare-player-library.mjs .workbench/merged/<构建输出的上下文目录>
node --test test/player-acquisition.test.mjs test/merge-full.test.mjs
node scripts/check-player-acquisition-ui.mjs
```

`player/acquisition.json.report` 包含排除数量、首条来源序号及原因，原始文档哈希和 JSON Pointer 保存在每条证据中。完整源记录在合并汇总中查看；玩家精简包不复制原始整份 JSON。UI 检查使用独立临时配置、捕获外链而不打开真实浏览器，截图在忽略目录 `artifacts/player-acquisition-ui/`。Mac 包可将可执行文件路径作为检查脚本参数传入。

相关：[玩家资料库](20-玩家资料库.md)、[卡面与预构建维护](21-Mod赋能卡面拼图与内置资料.md)、[套装 Mod](26-套装Mod关联效果与卡面.md)。
