> 历史归档：本篇保留当时的版本、路径与验收结果；当前规范请从 [文档总览](../../README.md) 阅读。

# WFCD 完整图库恢复与官方图库复核

> 后续位置更新：两工具已于 0.11.0 合并，本文所述图库实体统一迁至本项目 `assets/content`，原独立工具已删除；维护和空间整理见 [双工具整合](28-双工具整合与主题及空间整理.md)。

核对日期：2026-10-22。完整逐项报告和两套图库位于用户指定的攻略图片工具 `assets/content/`。

## 本次已完成

- WFCD 图片补到 `给写攻略人员准备的图片提取工具/assets/content/img/`。原有 12,233 个文件逐字节保持一致，新增 310 个文件、2,870,300 字节，现有 12,543 个文件。
- 新增文件中 300 个是技能图，10 个未被当前物品记录引用。完整技能图库共 305 个文件，其中 5 个此前已通过其他条目保留，不能重复算作新增。
- 官方图库实体迁移到 `assets/content/official-public-export/`。12,623 个成功地址按 SHA-256 合并为 12,501 个文件；原有 `.workbench/official-images` 改为指向它的兼容符号链接，实体只保留一份。
- WFCD 完整清单为 `wfcd-image-index.json`；`checksums.json` 补入全部 12,543 个 WFCD 文件。原 `catalog.json` 的顶层物品内容和元数据保持原样，其 `imageCount=12233` 仍表示原目录引用的图片数；完整文件数量请读新清单。
- 新增完整逐项比较 `image-library-comparison.json`，含 606 个官方独有 ID、WFCD 缺图引用、精确同名候选和官方失败 URL。

## 为什么本地少图

原 `prepare-data.py` 先解包 WFCD 的所有 `data/img/`，再按顶层物品 `referenced_images` 删除未被引用的文件。战甲、Archwing 等技能在 `abilities[]` 内，未进入顶层目录，图片被清理掉；另外还清理了没有当前条目引用的素材。

这次从已保存的完整源档案 `.cache/warframe-items.tar.gz` 恢复，不重复下载约 604 MiB 的压缩包。以 `wfcd-items-snapshot.json` 的排除文件清单为独立核对依据，逐文件校验 Git blob SHA-1、长度、PNG/JPEG 签名和 SHA-256；原图字节直接保存，不重新编码。

固定 WFCD 提交：`20f8d9427a5a62268817853eefd8962d18c0b70e`，提交日期 2026-10-18。这里的“完整”指这一固定快照的全部 `data/img/`，不是宣称包括游戏中所有图片。

官方依据当前保存的 `ExportManifest.json`，其 SHA-256 为 `bac6eecd828a358732c82835747da58c8875d7339c5a36edfa116af1d8cf21d4`。资料包总快照记录生成于 2026-10-04，与 WFCD 提交时间不同；差异可能包含版本变化，不能全部归因于数据源缺失。

## 完整图库比较：修正上次结论

| 统一口径 | WFCD 完整快照 | 官方保存的 Manifest |
| --- | ---: | ---: |
| 原始文件名／版本化图片地址 | 12,543 个文件名 | 12,624 个地址，12,623 成功 |
| 实际本地文件 | 12,543 | 12,501（按内容命名并去重） |
| 内容 SHA-256 去重图片 | 12,426 | 12,501 |
| 去重字节 | 622,938,893，约 594.08 MiB | 922,974,823，约 880.22 MiB |
| 可按原始完整 ID 精确关联 | 19,542 | 声明 20,144，实际可用 20,143 |
| 共有完整 ID | 19,538 | 19,538 |
| 各自独有 ID | 4 | 606，其中 605 可取图 |

**按图片内容去重，官方比完整 WFCD 多 75 张。**上次“多 384 张”使用的是被裁剪的本地顶层物品图库。原报告保留为历史记录，本篇与新 JSON 是完整图库复核结果。

文件数、图片内容数和物品 ID 数分别衡量不同事情：多件物品可共用一张图；不同文件名可拥有相同字节；官方不同 URL 也可返回相同图片。比较前必须统一口径。

### 606 个额外官方 ID 的含义

- 480 个组件蓝图 ID，许多复用部件图。
- 126 个其他 ID，包括 29 个头盔、25 个宠物外观礼包、19 个加成、13 个装备资源礼包等。
- 其中 529 个能在完整 WFCD 图库里找到**严格同名**的原始图片文件。这只是复用候选，不能凭同名就改写物品身份、断言同版本或相同像素。
- 余下 77 个 ID 没有同名候选，其中 76 个官方图片有效，1 个头像 404。

比较成功下载图片的原始 basename：双方共有 12,503 个名字，官方另有 76 个名字，WFCD 另有 40 个名字。官方独有部分主要是各档加成、物品栏、补给和资源组合包、宠物配色礼包等。WFCD 独有名字含 `blueprint.png`、`arcane.png`、部分重命名或历史素材、Tennotober 2026 Prex 等；名字独有不等于图案独有。

WFCD 独有的 4 个完整物品 ID 为冰川实验室场景、两个肤色 B-17 [经典] 条目和 Tennotober 2026 Prex。清单见完整 JSON。

### 画质与大小

两库主体均为 512×512。按成功地址与 WFCD 严格同名文件比较，共 12,547 对，其中 12,546 对宽高相同；不能用文件体积推断分辨率提升。

这 12,547 对的文件字节均不同。WFCD 固定源代码 `build.ts` 的 `saveImage()` 会经过 sharp、jpegtran 和 pngquant（PNG quality 设置 `[0.2, 0.4]`），还为 Blueprint / Arcane 使用自定义通用图。因此 WFCD 图往往更小，官方更接近直接导出的原文件。PNG 量化可能改变像素；本轮没有做逐像素或主观画质评分，不把不同字节算成不同图案。

源代码证据可查攻略图片工具 `.cache/build.ts`，以及资料包 `世界状态上游/wfcd-items/build/build.ts`；原文件存储流程在攻略图片工具 `scripts/prepare-data.py`。

## 缺口仍在哪里

递归扫描 WFCD 所有顶层分类 JSON 后，639 个不同 ID 的非空图片引用在完整 `data/img/` 中不存在：638 个敌人原始引用，以及 Deathma666ot 浮印的 `missing.png`。敌人的 37 条已审核参考图继续作为参考图，未冒充独立原图；剩余 601 条敌人记录仍没有可靠配图。

官方唯一失败地址：

```text
https://content.warframe.com/PublicExport/Lotus/Interface/Icons/Player/ContentCreators/DeathMa666ot.png!00_w3OCAqKWH5ngubC29LD+Cw
```

2026-10-22 再次请求仍为 HTTP 404。失败保留在 `official-public-export/index.json`，没有把错误页保存为图片。

## 本地目录与映射规则

```text
assets/content/
  img/                             # WFCD 12,543 个原始字节文件
  catalog.json                     # 原顶层物品目录，保留参考图审查结果
  checksums.json                   # 全部 WFCD 图片与原 catalog 的 SHA-256
  wfcd-image-index.json             # 完整原图名映射、递归 ID 映射、歧义清单
  image-library-comparison.json     # 完整比较、缺图与候选证据
  图库补全说明.md
  official-public-export/
    assets/<完整SHA-256>.png|jpg
    index.json                     # ID → textureLocation → URL → file
    ExportManifest.json            # 本轮官方原始映射副本
```

WFCD 本地文件名继续遵循原工具规则：`SHA256(原始文件名)前24位 + 原始扩展名`，解决上游大小写近似名称在 macOS / Windows 上覆盖的问题。请通过 `wfcd-image-index.json.images[]` 的 `imageName → assetName` 找文件；`mappings[]` 提供 19,542 个完整 ID 的唯一映射，歧义 ID 单独记录。不要尝试直接拼接英文物品名。

官方查图：在 `index.json.entries[]` 按完整 `uniqueName` 找 `textureLocation`，再在 `assets[]` 找相同纹理，得到 `file`，读取 `assets/<file>`。保留 `!版本哈希`，下载 URL 是 `https://content.warframe.com/PublicExport/` 加去掉开头斜杠的完整纹理路径；图片地址不增加 `Manifest/`。

## 后续 P3 建议

维持两套来源和映射，合并层记录 `provider / canonicalId / originalName / textureLocation / sha256 / localFile`。优先使用 WFCD 已确认关联；缺图时按完整 ID 使用官方映射。同名候选进入审查清单，不直接按英文标题模糊绑定。

蓝图继续使用用户已指定的“蓝图底纹 + 精确成品图”组合，通用 `blueprint.png` 与官方部分组件图片不是一回事。技能白色图标仍需适合的底色。后续 `<xxx>` 文本图标统一中间件维持待办，本次未实现。

开发时保留官方大图库，应用发布默认只携带 WFCD 图库；以后若离线包确实需要官方补图，再按精确引用增量挑选。不要让保存一份官方图库变成每个应用 ZIP 自动增加约 880 MiB。

## 维护与验收

工作台维护命令（在资料包项目根目录运行）：

```sh
python3 scripts/complete-image-libraries.py
```

此命令复用固定压缩包与已有官方下载，验证完整树和现存文件，补入缺失 WFCD 图，校验官方文件，生成新报告。官方资源更新下载仍使用 `scripts/fetch-image-libraries.mjs --official-only`；其原比较输出只统计顶层目录，之后需运行本命令得到完整图库比较。

攻略图片工具同步流程也已修复：不再按顶层目录裁剪图片，生成完整 `wfcd-image-index.json` 和所有图片校验项；仅替换 WFCD 自有产物，保留官方子目录与比较报告。未来重新同步时，catalog 的 `imageCount` 表示完整图数，`referencedImageCount` 表示顶层引用图数。打包脚本明确列出 WFCD 交付文件，排除独立官方图库；发布验证兼容原目录和完整图库两种元数据。

实际通过：

- WFCD 12,543 个文件与固定快照 Git blob SHA-1 / 长度一致，已有图片保持原始字节；官方 12,501 个去重文件 SHA-256 / 长度及图片签名验证通过。
- 隔离临时目录完整运行同步脚本，重新生成全部 12,543 图与 19,542 个 ID 映射；逐文件 SHA-256 与恢复图库一致，官方哨兵文件保留，临时旧图及 staging 清理成功。
- 攻略图片工具 5 项 Node 测试、6 项 Python 测试通过；维护 Python 和打包 JavaScript 语法检查通过。
- 本轮只维护图库、整理脚本和文档，没有发布新的应用压缩包，也没有新增大文件备份副本。
