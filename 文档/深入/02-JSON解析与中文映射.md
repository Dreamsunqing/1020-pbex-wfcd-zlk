# JSON 解析与中文映射

## 原始文件形态不同

同为 JSON，不能直接把两个对象展开后覆盖。工作台先识别文件、记录层级和键，再按用途解析。

| 形态 | 示例 | 记录身份 |
| --- | --- | --- |
| 记录数组 | WFCD `Primary.json`、`Warframes.json` | `uniqueName`；技能、组件可能继续嵌套 |
| 内部路径 → 对象 | Plus `ExportWeapons.json`、`ExportRecipes.json` | 对象键通常就是完整物品路径 |
| Export 分组 → 数组 | 官方 `ExportWarframes_zh.json` 等 | 分组内记录 `uniqueName`；技能可能为 `abilityUniqueName` |
| 语言键 → 字符串 | Plus `dict.zh.json`、Oracle `dicts/zh.json` | 完整语言键 |
| 物品键 → 本地化对象 | WFCD `i18n/zh.json` | 完整物品路径；值里有 name、description 等 |
| 清单包装 | Oracle JobManifest `{parent,data}` | 取 `data`，在具体模块解释嵌套字段 |

JSON、JSONC 和有限的文本解析由 `src/core/library.mjs` 负责。引用位置使用 JSON Pointer，`~`、`/` 分别转义；原文复制和导出仍保留输入原值。

## 三种完整键不能混用

物品键 `/Lotus/Types/...` 用来找物品；语言键 `/Lotus/Language/...` 用来找名称／描述；奖励表路径用来找奖励池。都有 `/Lotus/` 前缀不代表含义相同。路径别名需要明确规则，名称相同或英文相似不能替代键关联。

## 通用中文标题

实现：`src/core/preview-titles.mjs`。

记录自带可用中文标题时优先展示。否则收集名称字段、`uniqueName`、类型、当前对象键等完整引用，依次查询被识别为中文字典的文件。通用字典顺序为当前来源优先，再 Plus、WFCD、Oracle、其他；同级按文件 ID 排序。兼容 `/louts/` 拼写只属于前缀规范化，不做任意路径拼写纠错。

Plus／Oracle 字典值是字符串；WFCD 字典值是对象，需要提取含中文的标题字段。每次命中保留字典文件、JSON Pointer 和内容哈希，表格和详情可看到“中文来源”。名称缺失时保留原名及缺失状态，不凭英文生成译名。

技能额外经过完整 ID 桥接：官方 `abilityUniqueName`、Plus `ExportAbilities`、战甲的嵌套 abilities 及官方中文战甲清单互相关联，补齐技能名称，并保留桥接文件与最终字典来源。这个桥接不是允许所有字段随意跨文件猜测。

## 字段说明与“数据结构”

- `src/core/field-guide.mjs` 给字段中文标题、用途、单位和说明，例如暴击、能量、更新日志、紫卡系数。未知字段保留未知状态，方便人工补充。
- `src/core/json-structure.mjs` 扫描整个 JSON 的结构；同类数组或对象记录合并字段形态，用于理解有哪些字段，而不是把每条记录重复列一遍。
- 原始记录详情继续显示全部字段。数据结构页面是字段说明视图，不能拿结构摘要代替原数据。
- `scripts/inventory-structure.mjs` 用同一套逻辑输出字段清单；工具入口 02 将结果放入 `输出/数据处理`。

通用预览、Oracle 解析和 P3 合并的翻译优先级各有上下文，不能宣称全项目只有一个固定翻译顺序。

## 赏金模块的多跳中文

赏金奖励的 type 经明确路径别名后找到物品记录，其 name 可能还是语言键，再查 Oracle／Plus 字典。蓝图没有直接名称时，可用 `ExportRecipes.resultType` 找成品名称并派生“成品名 + 蓝图”，派生来源要保留。通用 JSON 标题并不对所有物品自动执行相同多跳流程。

当前静态 P3 与实时奖励选择的区别见 [P3 和奖励关系](03-P3合并规则与奖励关系.md)。逐字段历史实例见 [映射原始记录](../归档/过程记录/13-字段字典与赏金奖励映射.md)，其中旧版本边界以原文日期为准。

## P3 多语言字段映射（0.13.2）

P3 现在按来源语言分别选择深层文本与整组匿名数组；WFCD 本地化对象内的技能、等级、被动不再仅提取名称／描述。详情接口提供 locale、语言投影和回退来源。完整规范、脚本与真实数据审计见 [字段、字典与多语言映射](10-字段字典与多语言映射.md)。
