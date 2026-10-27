# Wiki 图库增量维护与交易校验

适用 0.17.1，2026-10-25。此章替代旧版把 Wiki 敌人图片放到 `wfcd/img` 的约定。项目根目录运行下列命令；同步器使用进程锁防止同时更新同一目录；异常退出后可识别失效锁。

**2026-10-26 访问规则复核：**站方条款要求自动化访问先取得同意，当前 robots 通用规则禁止 `api.php`。以下15/18在线命令是既有实现说明，尚无站方许可时暂停使用；原并发、重试参数不是站方认可的额度。全站图片改用19先做零请求的离线预检，许可与限制见 [第37章](37-Wiki全站图片归档与访问许可.md)。

## 文件与来源

```text
assets/content/
  wfcd/img/                 WFCD 原图
  official/img/             DE 原图
  wiki/
    img/<完整SHA256>.png|jpg|webp
    index.json              实际下载原图、实体关联、证据、失败与缺失
    inventory.json          Wiki 全站文件元数据目录，不代表全站图片已下载
.cache/wiki-images/
  inventory-checkpoint.json 分页断点
  pageimages.json           明确 Wiki 页面对应的首图元数据
  legacy-enemy-image-index.json 迁移前的敌人索引备份
artifacts/wiki-images/
  report.json               实际获取、去重、关联和未解决项目
  coverage.json             项目图片覆盖与地点映射审计
```

本地图库被 Git 忽略。普通 Mac/Windows 包使用外部共享图库；Windows 含图库版打入以上三来源目录和索引。每个页面通过同一完整 ID 请求图片，不为资料库、世界状态、组件、技能、掉落表分别复制文件。

`index.json` 保留站点、文件名、原始 URL、Wiki 页面、文件时间戳、获取时间、SHA1/SHA256、字节数及 `original`。实体映射记录完整 ID、依据、来源文件／模块、修订或模块内容哈希、行号；旧缩略图迁入后标为 `original:false`，新同步用 `imageinfo.url` 替换为原图。已有文字的 Wiki Mod 原图保留原貌，不再套一层项目卡面。内容相同仅存一份，不能把同文件名当成同内容。

## 获取与续传

```sh
# 全量枚举文件元数据，下载有可靠实体关系的原图；后续运行增量更新
node 工具/18-维护Wiki图片.mjs
# 恢复未完成枚举，已有原图按时间戳及本地 SHA256 校验复用
node 工具/18-维护Wiki图片.mjs --resume
# 只枚举全站文件目录
node 工具/18-维护Wiki图片.mjs --inventory-only --resume
# 只迁移旧 Wiki 敌人图，不联网
node 工具/18-维护Wiki图片.mjs --migrate-only
# 兼容旧工具编号，只处理敌人来源
node 工具/15-获取敌人图片.mjs
# 项目覆盖及地点映射审计，不加载全部图片字节
node scripts/audit-drop-images.mjs
```

实现为 `scripts/sync-wiki-images.mjs`。`allimages` 每页 500 条，保存 `aicontinue` 和完整 continuation 字段；新运行重新枚举，`--resume` 沿断点继续。遵循 [MediaWiki Allimages API](https://www.mediawiki.org/wiki/API:Allimages) 的分页约定，再用 `imageinfo` 取原始 URL，绝不把 `thumburl` 作为原图。

下载并发为 3，最多重试 4 次，指数退避，35 秒单次超时，32 MiB 响应上限，只允许可信 Wiki HTTPS 主机。每 40 个文件串行排队、随机临时文件原子写进度；失败记录后继续，已有有效关联保留。后续运行重新尝试失败项；相同文件时间戳且本地内容哈希正确则复用。仅处理 PNG/JPEG/WebP，其他媒体保留目录元数据和跳过原因，不把 SVG、视频或站点装饰强塞入图片卡。

全量目录可能包含用户上传、站点装饰和无关媒体；**枚举完成不等于下载完成**。默认下载与本项目有可靠关系的文件，不把全部文件盲目绑定到实体。报告分别列目录总量、下载数、复用数、成功关联、失败和缺失。未确认的项目保留缺图。

## 身份依据与迁移

只接受以下依据：

1. Wiki Lua 的 `InternalName` 与本项目 ID 完全相等，并有明确 `Image`；Lua 仅当文本解析，不执行。
2. 敌人 Wiki agent ID 经 Plus `agents[InternalName].avatarTypes` 显式关联当前敌人。
3. WFCD 当前实体明确提供的 `wikiaThumbnail` 文件身份；通过 Wiki API 再核验原文件。
4. 当前实体明确的 Wiki 页面 URL，经 API `pageimages.original` 得到该页面首图；保留页面 ID、规范化／重定向后的标题，不能从页面图集选“看起来相似”的第一张。

同一 ID 出现冲突文件时不新建关联。旧索引迁移先逐一验证 SHA256，复制到新目录并原子发布新索引；之后才清理没有被 WFCD catalog／inventory 引用的旧文件。保留旧索引备份。运行时保留旧索引兼容读取，但新工具只向 Wiki 独立目录写入。

`LocalImages` 和 `ImageGallery` 都读取 Wiki 索引；敌人优先使用明确立绘，避免同名纹章；其他实体已有合适 WFCD 图片则复用，缺图再按明确 ID 使用 Wiki。所有文件仍受真实路径、格式和读取大小约束。图片资源工具新增 **Warframe Wiki** 来源、**Wiki 来源敌人图片**／**Wiki 游戏素材** 类别，可查文件名、ID、来源、哈希及版本。仅渲染当前批次，不一次性解码全图库。

## WM搜索的唯一判断入口

核心为 `src/core/wm/eligibility.mjs`，桌面 IPC `wmEligibility`；UI 共用 `src/ui/market-links.js`。资料库详情、组件／获取方式弹窗、世界状态奖励弹窗和掉落表都使用此入口。

先从当前玩家数据按完整 ID 读取**这个实体本身**的 `tradable===true`，再查完整 WM 目录。优先唯一、非套装根的 `gameRef` 精确匹配（只规范官方 StoreItems 前缀）。仅当 WM 条目没有 `gameRef` 时，允许唯一的完整英文名匹配。WM 已给出不同 ID 时不能降级到名称；两个候选、未知交易状态、目录不可用，都不展示按钮。进入 WM 时再次校验，避免缓存或页面状态变化后误跳。

部件可交易不等于成品可交易；Prime 字样、类别、同名变体和配方关联都不能充当交易证据。上游字段冲突沿用 P3 字段决策，不修改原始 JSON；这里采用“具体实体明确可交易”与“WM 精确存在”的交集。可交易 Prime 部件、不可交易完整武器／战甲、未知物品、与标准版同名的初级／中级 Mod 都有回归样本。

## 地点和图片排错

`src/core/drop-localization.mjs` 按活动前缀、星球、节点或模式、变体、尾部条件解析，先核对星球再生成节点链接。指数之场的括号风险等级属于模式，不能当成可丢弃备注。九重天缓存条件不被静态节点的默认任务类型覆盖。活动历史来源不链接当前节点。

`node scripts/prepare-drop-terms.mjs` 从 Plus 中英字典生成短语索引，当前不运行网络翻译。Lunaro 短名依据官方“扎里曼月动球场场景”等中文字段审阅提取。未知名称／条件保留原文和 `unmapped` 原因。英文界面仍保留物品 ID、图片和跳转，只切换显示文字。

掉落表默认展示来源、轮次／阶段及数量摘要，奖励在独立滚动弹窗按 36 项批次加载。图片 `object-fit:contain` 且 opacity=1，原图自身 alpha 保留；未知概率为 `—`，真实零为 `0%`，触发率与池内概率分列。关闭弹窗不重建列表，返回入口时相同快照保留筛选和滚动；快照回滚导致哈希变化则重新读取当前表。

仲裁总览、完整列表和日历日期列表共用可换行 Flex，卡片基础宽度 290px，同行伸缩并等高，窄窗口自然换行。收益接口、待评级和未知高质量数量保持原有语义。

验证命令：

```sh
npm test
npm run check
node scripts/check-drop-navigation-ui.mjs
# 对已打包 Mac 再运行同一回归
node scripts/check-drop-navigation-ui.mjs 'dist/mac/Source Workbench.app/Contents/MacOS/Source Workbench'
```
