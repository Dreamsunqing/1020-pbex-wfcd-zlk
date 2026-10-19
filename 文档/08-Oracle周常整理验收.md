# Oracle 周常整理 · 0.4.0

在原有五组入口后新增“06 实验室／Hex 周常”，标签页改为“推算与周常 · Oracle”。桌面和 CLI `weekly` 共用 `src/core/oracle-weekly.mjs`，可读取当前目录或历史快照中的规则、任务类型表和字典。

## 整理规则

依据本包 `wf.browse.oracle/weekly.php`，只整理参考时间内有效的 `CT_LAB` 和 `CT_HEX`，开始时刻包含、结束时刻不包含。读取 `difficulties[1]` 的变体和全部风险，个人限制读取 `Variables`。不计算未发布的下周任务。

| 输入 | 转换后 | 范围 |
| --- | --- | --- |
| `Defense` | `DualDefense` | 仅实验室任务类型 |
| `EMPBlackHole` | `MagneticHounds` | 风险 |
| `DullBlades` | `ComboCountChance` | 个人限制 |
| `Undersupplied` | `MaxAmmo` | 个人限制 |

类型先通过 Oracle `data/ExportMissionTypes.json` 映射；中文名称和说明来自所选 Plus 字典与 Oracle 补充字典。未知类型或缺失翻译保留原始标识。所有转换保留原始值，说明中的格式标签以纯文本处理。

结果 JSON 同时包含 Oracle 兼容的四个任务／限制数组，以及两组带有效窗口、原始字段、中文说明的 `sections`。有结果时，汇总 `expiry` 为当前有效组中最早的结束时间（Unix 秒），各组窗口单独记录；没有有效组时为 null。重复重叠的同类有效条目拒绝处理。

世界状态缓存新增 `Conquests` 必要字段，继续独立于静态资料快照。0.3.0 的旧缓存仍可读取，周常会提示缺少字段并要求刷新或重新导入。刷新失败保留旧缓存；错误查询清除对应结果，切换目录／快照清空全部结果。规则源码只读、不执行 PHP；规范化换行后的审阅 SHA-256 为 `9af5e427443e98151c5d75edd2686fc6df17059cfcd33cf75473b76406b52e48`，变化时要求重新核对兼容实现。

## 验证

真实官方世界状态与 Oracle `weekly.php` 响应于 2026-10-19 19:13 UTC 取样，固定在 `test/fixtures/oracle-weekly-service.json`。CLI 的 `expiry`、实验室和 Hex 的所有任务、变体、风险和个人限制，与响应逐字段一致。本次取样为 6 个任务、12 条风险和 8 条个人限制。

`npm run check`：34 个代码文件。`npm test`：40 项通过，包括新增 5 项周常测试；桌面 worker 的既有测试扩展验证两份快照中的任务类型映射独立生效。覆盖开始／结束边界、未知类型、缺字段、空列表、重叠窗口、第二档与普通档不一致、四项名称转换、中文降级、损坏字段、旧缓存兼容与失败保留。

桌面界面检查验证 6 个入口、两组分栏、6 任务／12 风险／8 限制、中文说明和原始值、复制 JSON 数据、手填 seed 不干扰周常、过期清除与目录刷新清空。1080 宽度检查无横向溢出。真实“刷新官方世界状态”按钮请求通过，赏金、入侵、周常和 browse.wf 回归正常。记录位于忽略目录 `artifacts/weekly/`。

## 使用与成品

桌面点击“推算实验室 → 推算与周常 · Oracle → 刷新官方世界状态”，随后使用“06 实验室／Hex 周常”快捷按钮定位。也可导入包含 `Conquests` 的官方 JSON，在参考时间内回放。

```bash
npm run cli -- oracle-world-state
npm run cli -- weekly
npm run cli -- weekly --world-state /path/to/worldState.json --at 2026-10-19T19:13:08Z
```

0.4.0 成品位于 `dist/`，包含 Mac arm64、Mac x64 和 Windows x64 ZIP；大小、SHA-256 和 CRC 记录在 `dist/交付校验-0.4.0.json`。Mac 两种架构运行烟雾测试，x64 使用 Rosetta；Windows 只验证包结构及内容，尚未实机运行。GitHub 保持 v0.1.1，本次为本地交付。合并汇总与邮件继续暂缓。
