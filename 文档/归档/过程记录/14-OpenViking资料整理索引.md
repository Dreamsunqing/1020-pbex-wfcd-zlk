> 历史归档：本篇保留当时的版本、路径与验收结果；当前规范请从 [文档总览](../../README.md) 阅读。

# Warframe／星际战甲／仓鼠互助洞资料索引与整理记录

整理日期：2026-10-20（Asia/Shanghai）。本索引用于区分项目归属、检索映射说明及解读旧资料。它不是对所有历史结论的重新验收。

## 一、先选项目

| 项目 | 已知定位／路径 | 归属边界 |
| --- | --- | --- |
| 仓鼠互助洞 App（仓鼠洞、cangshu） | 存在前端会话 -Users-dream-Desktop-hole-VUE-Web-new-hole；本次没有确认当前实际仓库路径或重新验收 App | 不能根据会话名 cangshu、浏览器端口或历史资料目录名，认定下面 API 或工作台的代码属于 App |
| 独立世界状态重构 API／world-state-beta | /Users/dream/Desktop/世界状态数据/世界状态重构；历史服务端口 32151；32152 为该 API 的数据查看器 | API 数据源优先级、构建与发布、后台管理、科研及沉沦奖励等历史资料归到此处 |
| SourceWorkbench／世界状态资料库上游资料包 | /Users/dream/Desktop/tools/世界状态资料库上游资料包；https://github.com/Dreamsunqing/1020-pbex-wfcd-zlk | 本对话的 JSON 浏览、来源更新、推算实验室、0.6.0 赏金奖励及本文映射实现 |

用户归属纠正的原始事件：
[2026-10-04：目标是独立 API，不是仓鼠洞 App](viking://user/default/peers/codeup.aliyun.com-63311ce4cc40ef8169941f36-cangshu/memories/events/2026/10/04/repo_attribution_correction.md)。

历史资源保留在 resources/projects/cangshu/ 原地址，避免已有链接失效；该目录是存储历史，不是项目归属证据。未移动或删除旧资源、会话、同伴记忆。

## 二、本次新增的映射参考（SourceWorkbench）

[字段、字典与赏金奖励映射，2026-10-20](viking://resources/projects/source-workbench/field-dictionary-reward-mapping-2026-10-20.md)

本地副本：文档/13-字段字典与赏金奖励映射.md。

包含：来源文件登记；通用预览标题候选字段与字典顺序；任务节点／挑战／地区任务；Oracle 01／02 奖励表选择；8 个物品目录；StoreItems 前缀转换；蓝图 resultType；Endo／现金数量；概率与多池边界；字段级来源与哈希；科研代号、说明键与补译；其他推算输入映射。

快速检索词：uniqueName、dict.zh.json、dicts/zh.json、i18n/zh.json、ExportRewards、ExportRecipes、resultType、fusionPoints、credits、rewardManifests、ChallengeMissionDifficultyTiers、JobDifficultyTiers、NoPets、RangeDebuff、AnemicShields、中文来源、赏金奖励映射。

## 三、独立 API 的历史资料按主题检索

以下链接保留原有 cangshu 存储路径；按内容归到独立 API 或上游资料研究。日期表示报告当时的观察，不是当前代码状态。

### 数据源、内部键与文件流

- [官方 Public Export 参考（2026-10-01）](viking://resources/projects/cangshu/de-public-export-reference-2026-10-01.md)
- [Plus 评估（2026-10-03）](viking://resources/projects/cangshu/warframe-public-export-plus-评估.md)
- [Oracle seed 推导（2026-10-03）](viking://resources/projects/cangshu/wf-browse-oracle-seed-derivation-2026-10-03.md)
- [文件级数据流与陷阱（2026-10-03）](viking://resources/projects/cangshu/world-state-file-level-dataflow-and-pitfalls-2026-10-03.md)
- [仓库索引与重构路线](viking://resources/projects/cangshu/repository-index-and-refactor-roadmap.md)
- [接口链接审计（2026-09-30）](viking://resources/projects/cangshu/world-state-link-audit-2026-09-30.md)
- [v2 原始字段覆盖（2026-10-01）](viking://resources/projects/cangshu/world-state-api-v2-raw-field-coverage-2026-10-01.md)

### 本地化、路径、奖励语义

- [本地化来源策略（2026-10-01）](viking://resources/projects/cangshu/world-state-localization-source-strategy-2026-10-01.md)
- [本地化架构（2026-10-01）](viking://resources/projects/cangshu/world-state-localization-architecture-2026-10-01.md)
- [构建、本地化与 Oracle 计划（2026-10-04）](viking://resources/projects/cangshu/world-state-build-localization-and-oracle-plan-2026-10-04.md)
- [奖励表派生标签决策（2026-10-01）](viking://resources/projects/cangshu/reward-table-derived-label-decision-2026-10-01.md)
- [科研修正本地化缺口（2026-10-04）](viking://resources/projects/cangshu/科研修正本地化缺口分析-2026-10-04.md)
- [科研与沉沦奖励本地化审计资料目录](viking://resources/projects/cangshu/科研与沉沦之地任务奖励本地化审计-2026-10-04/)
- [奖励表路径处理缺口资料目录](viking://resources/projects/cangshu/奖励表路径处理缺口分析-2026-10-04/)

### API 验收、工程与管理端

- [Beta 审计与路线（2026-10-08）](viking://resources/projects/cangshu/world-state-beta-audit-and-roadmap-2026-10-08.md)
- [Beta 综合审计（2026-10-08）](viking://resources/projects/cangshu/world-state-beta-consolidated-audit-2026-10-08.md)
- [Beta 验收问题（2026-10-08）](viking://resources/projects/cangshu/world-state-beta-acceptance-issues-2026-10-08.md)
- [Beta 实施手册（2026-10-08）](viking://resources/projects/cangshu/world-state-beta-implementation-playbook-2026-10-08.md)
- [已核验事实（2026-10-09）](viking://resources/projects/cangshu/world-state-beta-verified-facts-2026-10-09.md)
- [开发陷阱（2026-10-09）](viking://resources/projects/cangshu/world-state-beta-development-pitfalls-2026-10-09.md)
- [新管理端规格（2026-10-09）](viking://resources/projects/cangshu/world-state-admin-console-spec-2026-10-09.md)
- [inline token 中间件（2026-10-09）](viking://resources/projects/cangshu/world-state-inline-token-middleware-2026-10-09.md)
- [限流与内容去重（2026-10-03）](viking://resources/projects/cangshu/world-state-throttling-and-content-dedup-2026-10-03.md)

## 四、常用实体入口

- [SourceWorkbench](viking://user/default/memories/entities/项目/source_workbench.md)：本地交付版本、功能、测试与发布记录。
- [独立 Warframe API](viking://user/default/memories/entities/software/warframe_api.md)：接口职责及动态事实边界。
- [世界状态重构](viking://user/default/memories/entities/软件/世界状态重构.md)、[world-state-beta](viking://user/default/memories/entities/项目/world_state_beta.md)：分阶段历史；不能将早期规划当成现状。
- [API 奖励规则子系统](viking://user/default/memories/entities/项目/world_state_reward_pipeline.md)：2026-10-09 的征服 profile 与沉沦奖励节点，须绑定版本。
- [WFCD](viking://user/default/memories/entities/数据源/wfcd_warframe_items.md)、[Plus](viking://user/default/memories/entities/数据源/warframe_public_export_plus.md)、[Oracle](viking://user/default/memories/entities/开源项目/wf_browse_oracle.md)：来源身份、历史评估及用途。
- [Warframe 游戏实体](viking://user/default/memories/entities/游戏/warframe.md)：已有武器分类、紫卡系数／星级等领域记录。与项目实现状态分开检索。

## 五、冲突和旧记录如何解释

1. **项目名冲突**：先看用户明确纠正与实际目标路径，再看报告正文；不按 peer 名或 cangshu 目录名归属。
2. **不同实现的优先级**：独立 API 的 WG 覆盖、多层语义解析与工作台预览／奖励／周常优先级分别记录。两套规则不能拼成一条“全局统一规则”。
3. **“未实现奖励”与“已有奖励”**：2026-10-01 API 记录只派生奖励表标签；2026-10-20 工作台本地 0.6.0 已展开奖励池。实现项目和日期均不同，不构成相互覆盖。
4. **动态事实与静态候选**：唯一有效世界状态匹配称当前轮次已确认；清单只有一表称固定；多表未确认则候选。种子生成任务不等于预测实际掉落。
5. **科研分数与概率覆盖**：旧 profile 的 [34,37] 门槛、U44 分数上限变化、某张表的概率缺口都是版本／快照限定事实；以构建版本、日期、来源证据判读。没有重新取证就不擅自删除或选一个作为全时期真值。
6. **覆盖率**：WFCD 某批武器中文样本 100%、某次敌人图片 37/638 等仅适用于当次样本。zh 字典与社区仓库不能自动等同全部官方中文。
7. **测试与发布**：API 历史测试数、工作台 50 项测试、Windows 包内容验证与实机运行是不同证据；本地交付和 GitHub 发布分开记录。0.5.x 的“Intel 待检查”是旧阶段记录，工作台 0.6.0 已有双 Mac 架构运行记录。
8. **后台与调度**：早期“无需数据库”“每日 launchd”属于对应日期的规划／运行记录，不能直接描述后续 Beta 或当前工作台；工作台定时检查仅在应用运行且用户开启时工作。

## 六、本次整理执行范围

- 新建本索引、工作台详细映射文档及历史 cangshu 目录导航说明。
- 修订 8 份全局实体：SourceWorkbench、资料更新与推算工具链、推算实验室、world_state_reward_pipeline、WFCD、Plus、Oracle、Warframe API。
- 新增一份精简长期记忆入口，指向本索引与映射文档。
- 保留原始导入文档、历史日期、提交证据、会话和 peer 记录；不复制整库、不自动删除重复文档。通过统一入口和适用范围标记，减少检索时的混淆。
- 本次只核对当前 SourceWorkbench 的映射实现，没有重新审计独立 API 或仓鼠互助洞 App，不宣称已修复这些项目的代码。

