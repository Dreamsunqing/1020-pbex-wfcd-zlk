# Prime 部件、遗物品质与蓝图中文

更新：2026-10-24，0.16.0。使用方式见 [玩家资料库](20-玩家资料库.md)，内置快照流程见 [预构建与卡面](21-Mod赋能卡面拼图与内置资料.md)。

## 给使用者

资料库新增“Prime 部件”，包含 Prime 制造部件及蓝图，和原“资源与部件”“蓝图”有交叉，不移动或复制实体。进入部件或蓝图，点击“获取遗物”；遗物奖励卡片可返回相应物品。需要制造的 Prime 组件，沿其制作蓝图补充“蓝图获取遗物”，卡上标注蓝图名称，避免误认为遗物直接掉成品。

虚空遗物列表按基础遗物展示一张卡。纪元选择器按古纪、前纪、中纪、后纪、先锋、安魂排列；先锋与后纪分开。详情中相同奖励只出现一次，四列比较完整、无暇、良好、光辉的实际掉落概率。“良好”在本界面对应 Gold / Flawless，“无暇”对应 Silver / Exceptional；这是本次用户指定的显示名称，其他模块的既有中文称呼不因此改变。

“安魂·永恒”是特殊记录，没有常规品质后缀。保留一张卡及本身提供的概率，不伪造四个品质。没有概率的格子显示破折号，不当作 0%。

本次快照核对：763 项 Prime 部件／蓝图、799 项遗物（古 202、前 195、中 196、后 197、先锋 4、安魂 5）。数量描述本地快照，不表示所有物品当前可获取，也不表示遗物仍在轮换中。

## 蓝图中文从哪里来

问题是蓝图已有 WFCD 英文介绍，但对应中文通常在成品记录中。全量合并 `full-build.mjs` 的 `texts()` 现在遵循：

1. 优先使用蓝图自身该语言的说明（官方文本、字典键及既有来源优先级不变）。
2. 该语言缺失时，沿 `ExportRecipes.<蓝图ID>.resultType` 找到成品，以同语言解析其 `description`；语言键继续查 Plus `dict.<语言>.json` 等既有字典。
3. 记录 `derived-blueprint-description` 候选，来源指向配方 `resultType`，`resultSource` 保留实际成品字段及字典来源。递归有访问集合，遇到循环停止。
4. 不沿材料或名称相似关系继承，不把英文放进 `zh-CN`，不改原始 JSON。

例如 `/Lotus/Types/Recipes/Weapons/BratonPrimeBlueprint` 的成品是 `/Lotus/Weapons/Tenno/Rifle/BratonPrime`，中文说明取成品的同语言描述。详情标注“成品介绍”，可点击进入成品。

本次 2,024 份蓝图中 1,842 份可补齐中文，182 份无可用介绍，保留为空。资料库仍兼容旧 P3：旧构建未带蓝图中文时，读取 `recipes.json[].resultId` 做同样的只读回退。预构建快照的 `player/description-sources.json` 仅保存继承来源的实体 ID 与语言，让界面保留“成品介绍”标识。新增语言也按语言分别解析，缺失时按项目既有规则回退英文。

## Prime 与遗物的准确关联

| 数据 | 字段／关系 | 用途 |
| --- | --- | --- |
| 统一实体 | `attributes.isPrime`、`attributes.variantType=VT_PRIME`，以及明确的 Prime 名称 | 识别已建模的 Prime 物品 |
| `relations.json` | `has-component`、`produces` | Prime 成品关联制造部件与蓝图；普通通用材料不混入 Prime 分类 |
| 遗物实体 | `attributes.relicRewards[].rewardName/itemCount/rarity` | 官方奖励实体、数量和稀有度 |
| 遗物实体 | `attributes.rewards[].item.uniqueName/chance` | WFCD 同一物品的品质概率；官方奖励列表缺失时也作奖励身份回退 |
| 精确前缀转换 | `/Lotus/StoreItems/` → `/Lotus/` | 沿用 `storeItemId()`，再按完整 ID 查实体 |
| 反向索引 | 奖励 ID → 基础遗物；成品 → 制作蓝图 → 基础遗物 | 生成部件详情“获取遗物”，不依赖 WM 商品名或中文模糊匹配 |

Prime 分类只接纳已关联的 `blueprint`、`resource` 实体。完整 Prime 战甲、武器、Prime Mod，以及配方里的普通奥罗金电池不属于该分类。遗物源还可以包含 Forma 等非 Prime 奖励；它们能查看获取遗物，但不因此成为 Prime 部件。缺失实体保留原数据，不生成指向不存在实体的链接。

## 遗物身份与品质

`player-relics.mjs` 用投射路径末尾 `Bronze / Silver / Gold / Platinum` 分出品质，去掉该后缀作为基础身份；不把翻译名称当主键。`T1 / T2 / T3 / T4 / T5` 分别是古、前、中、后、安魂；`T4Vanguard...` 明确归先锋。

少数官方路径是同一遗物的别名。本次古纪 G12 的两个路径，在同纪元、同编号、四种品质的奖励完整 ID、数量、稀有度及概率完全一致时合并。任何一个分布不同都保持独立，不能仅因同名合并。旧路径仍可进入详情并跳转。

品质概率逐个奖励 ID 从对应品质记录读取，不按数组序号拼接，不把四档概率相加，不从稀有度推算缺失概率。官方稀有度与 WFCD 稀有度在部分记录存在差异，显示与关联不据此覆盖实际概率。

## 维护文件与验证

| 文件 | 责任 |
| --- | --- |
| `src/core/merge/full-build.mjs` | 蓝图同语言说明继承及来源证据 |
| `src/core/player-library.mjs` | 玩家投影、Prime 分类、双向关系、筛选 |
| `src/core/player-relics.mjs` | 品质身份、别名去重、奖励及反向索引 |
| `src/core/player-labels.mjs` | 选择器展示中文，原始枚举保持不变 |
| `src/core/player-bundle.mjs` | 预构建裁剪、蓝图介绍来源映射 |
| `src/ui/player-library.js`、`.css` | 纪元选择器和紧凑四档概率卡片 |
| `test/player-relics.test.mjs`、`test/player-bundle.test.mjs` | 关联、概率、中文、特殊遗物与真实快照回归 |
| `scripts/check-player-library-ui.mjs` | 打包界面的筛选、跳转、概率卡片、文档分类和窄屏检查 |

选择器根据实际数据补齐中文，包括赋能类型、裂罅类别、鱼类材料、装饰、主题和交易状态。Prime、Mod 等通用名称保留；值仍使用原枚举，因此筛选与关系 ID 不受翻译影响。

WM 分类与项目说明分离见 [WM 文档](../WM/README.md)。
