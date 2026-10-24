# 套装 Mod：关联、逐件效果与合成卡面

适用 0.16.5。本次只作本地开发与验证，GitHub 发布已暂停。

## 玩家看到什么

“资料库 → Mod 与套装 → 适用类型 → 套装 Mod”展示 19 个套装的中文家族名。套装详情包含全部成员及装备 1…N 件时的效果；成员详情有显眼的“查看套装”链接，可双向跳转。强化等级仍单独控制成员自身效果。

合成 Mod 卡面保留外部卡片尺寸，采用 300×440 的逻辑比例、600×880 PNG 输出。顶部加套装徽记，下方依次显示名称、自身效果、分段件数条、套装加成、适用类型，保留右上容量／极性与底部等级灯。普通 Mod 没有套装区域；长描述自动缩小字号，完整排版，不截断尾部。

卡面默认为 **1/N 件预览**，不是用户已装备状态。详情页把每种件数全部列出。本程序没有配装模拟器，不能据此声称已获得满套加成。

## 来源、字段与关联

| 数据 | 文件 | 字段 → 用途 |
| --- | --- | --- |
| WFCD 成员 | `世界状态上游/wfcd-items/data/json/Mods.json` | `uniqueName` 为 Mod ID；`modSet` 为完整套装 ID；`levelStats[].stats` 为强化等级效果；`name`、`imageName` 为英文名和插画 |
| WFCD 套装 | 同上，`type = Mod Set Mod` | `uniqueName`、`numUpgradesInSet`、`stats[]`、`buffSet`、`imageName` → 套装身份、件数、逐件英文效果、增强成员属性标记和徽记 |
| WFCD 中文 | `世界状态上游/wfcd-items/data/json/i18n/zh.json` | 以完整 ID 索引成员的 `name`、`levelStats` 等；套装记录本身当前是空对象，不能当成已有中文套装标题 |
| Plus 成员 | `世界状态上游/git/warframe-public-export-plus/ExportUpgrades.json` | `modSet` 提供第二份明确关系；`modSetValues` 保留暗影／牺牲成员的增幅参数 |
| Plus 套装 | `世界状态上游/git/warframe-public-export-plus/ExportModSet.json` | 以套装完整 ID 为键；`description` 是语言键；`levelStats[]` 是每种装备件数的参数对象；`icon` 是徽记路径 |
| 中文／英文模板 | 同目录 `dict.zh.json` / `dict.en.json` | 使用上面的 `description` 语言键获取同语言句子，再按键替换 `|STAT1|`、`|RANGE|`、`|COOLDOWN|` 等参数 |

例如：`WarframeAugurMessageMod.modSet` 精确指向 `AugurSetMod`。后者的描述键 `/Lotus/Language/Upgrades/WarframeAugurSetDesc` 在中文字典中得到模板 `|STAT1|% 用在技能上的能量将转化成护盾。`，按六个参数对象分别得到 40、80、120、160、200、240%。这是**逐档读取**，不是乘以件数推测。

参数名大小写有意义，`val` 不等于 `VAL`。不存在的参数不补 0、不线性插值；有同语言 WFCD `stats[]` 时可以用该档原文，否则回退英文并标注。不会把英文替换了部分键之后标为中文。

## 名称规则与证据

WFCD 的套装 `name` 当前是 `Augursetmod` 等生成占位名；真正可用的名称在其成员中。先通过完整 `modSet` ID 建立成员集合，再在同一语言里检查所有成员共有的家族名称，例如“预言 启示／预言 协约”得到“预言 套装”，“欺谋狼主之苦／之鄙／之恨”得到“欺谋狼主 套装”。英文同样从成员共有家族名称派生，去掉所有格后加 Set。

仅处理明确的空格家族名或中文“之…”结构；无唯一共名则保留来源名称，不对新语言硬套中文规则。派生标题在溯源中标记 `member-family-display-name`，可追到成员名称原字段及其语言字典；它是显示名，不冒充官方独立字段。**名字、目录名及图标都不能反过来作为成员关联键。**

19 套在本地数据中的对应关系如下，合计 **72 张成员**：

| 内部家族 | 显示名 | 件数 |
| --- | --- | --- |
| Amar | 欺谋狼主 | 3 |
| Ashen | 肉碾虫 / Carnis | 3 |
| Augur | 预言 | 6 |
| Boneblade | 喉骨刃者 / Jugulus | 3 |
| Boreal | 诡文枭主 | 3 |
| Femur | 重岩者 / Saxum | 3 |
| Gladiator | 角斗士 | 6 |
| Hawk | 空飞 / Aero | 3 |
| Hunter | 猎人 | 6 |
| Mecha | 机甲 | 4 |
| Nira | 混沌蛇主 | 3 |
| Raptor | 跃动 / Motus | 3 |
| Sacrifice | 牺牲 | 2 |
| Spider | 质子 / Proton | 3 |
| Strain | 菌株 | 4 |
| Synth | 合成 | 4 |
| Tek | 技法 | 4 |
| Umbra | 暗影 | 3 |
| Vigilante | 私法 | 6 |

## 暗影、牺牲与边界

这两类来源有 `buffSet: true`，模板为“增强这个组合中的 MOD。”。各成员的 `modSetValues` 不同，例如暗影生命力与聚精会神不同；不能把套装总说明套成所有属性都按相同倍率增长。本版展示来源说明，保留成员参数，不自行将所有描述数字相乘，也不模拟受影响的具体属性、取整或完整配装。

成员所属套装缺失、来源 `modSet` 冲突、声明件数与已关联成员数不一致时进入问题报告，不通过中文同名前缀偷偷补关系。当前真实数据 19 套、72 成员全部匹配，无该类待补关系。

`Mods.lua` 仅作为现有社区参考；其中曾有 Gladiator Set 的 `InternalName` 指向 Augur 的错误，故本次不使用该表的套装行生成关系或覆盖名字。

## 实现位置

- `src/core/merge/mod-set-links.mjs`：完整 ID 关系、派生名称、逐件模板、溯源与覆盖报告。
- `src/core/merge/full-build.mjs`：构建后生成 `modSetId`、`modSetInfo`、`member-of-mod-set` 关系和 `reports/mod-set-links.json`。
- `src/core/mod-sets.mjs`：按装备件数选择效果，语言回退和缺失标志。
- `src/core/player-library.mjs`：套装／成员双向详情，独立于强化等级。
- `src/core/player-bundle.mjs`：保留上述字段、关系、中文与英文效果，内置压缩快照无须启动重建。
- `src/core/merge/service.mjs`：所有调用方共享本地化后的卡面与套装描述。
- `src/ui/images.js`：本地读取套装徽记并缓存，同一管线覆盖资料库、世界状态奖励、合并和 WM 的 Mod 图。
- `src/ui/card-art.js`：徽记、件数条、独立效果区与完整长文排版；原始插画与图库导出不改。
- `src/data/inline-tokens.json`：`LOWER_IS_BETTER` 是显示控制标记，原始数据保留，展示层隐藏；不再把这个空白纹理占位计入文本图标图库。未知标记依然原样保留，中文描述不删除。

徽记使用已有 WFCD 图和官方备用索引，不额外下载第二份。`icon` 与 `imageName` 保持精确来源。缺少徽记时仍能显示带字卡面和链接，不让可选图片阻塞资料查询。

## 构建与验证

```sh
node scripts/build-merge.mjs
node scripts/prepare-player-library.mjs .workbench/merged/<构建输出的上下文目录>
node --test test/mod-sets.test.mjs
node scripts/check-mod-sets-ui.mjs
```

模型版本 `mod-set-acquisition-1`。旧模型本地缓存不会遮住新版内置关系，也不会在打开资料库时自动产生另一份全量构建。包更新前执行 `npm test`、`npm run check`；Mac x64 包可用 `node scripts/check-mod-sets-ui.mjs 'dist/mac/Source Workbench.app/Contents/MacOS/Source Workbench'` 验证。

UI 检查包括 19 套列表、预言 6 档效果与 6 成员、成员返回套装、套装不显示强化滑块、19 徽记读取、明暗模式、600×880 图片、长描述与控制标记。截图与报告位于忽略目录 `artifacts/mod-set-ui/`，不重复归档图库。

视觉参考：[MOD 2.0](https://warframe.huijiwiki.com/wiki/MOD_2.0)、[组合 MOD](https://warframe.huijiwiki.com/wiki/%E7%BB%84%E5%90%88MOD) 及本次用户提供的游戏卡面示意图。数值仍以本项目固定的来源数据为准，旧 Wiki 示例的 +440% 生命值不覆盖当前上游。
