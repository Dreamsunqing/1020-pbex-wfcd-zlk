> 历史归档：本篇保留当时的版本、路径与验收结果；当前规范请从 [文档总览](../../README.md) 阅读。

# 星际战甲攻略图片工具

面向 Windows 攻略作者的离线图片工具。完整解压压缩包后双击 `攻略图片工具.exe`，无需安装开发环境、登录或联网。

功能包括中文/英文名称搜索、26 类素材筛选、图片预览和缩放、透明/浅色/深色底色、原图复制、名称复制、原图保存、跨分类选择、批量导出及重名自动编号。图片缺失或名称未翻译时保留条目并降级展示。

使用说明见 [docs/使用说明.txt](../../../integrations/image-tool/docs/使用说明.txt)。发布包仅包含程序、离线图片库、说明和许可证；源码、测试和构建缓存不随包分发。

## 本地开发（维护者）

需要 Node.js 22.12+、npm、Python 3 和 Git。使用者不需要这些环境。

```sh
npm ci
npm run data:sync
npm start
```

首次整理数据会下载 WFCD/warframe-items 固定提交的完整源档案，写入 `.cache/warframe-items.tar.gz`。现有档案会复用。强制更新：

```sh
python3 scripts/prepare-data.py --refresh
```

该脚本从同一源档案读取所有分类 JSON、中文词典和图片，以 `uniqueName` 关联名称，通常按 `imageName` 精确匹配图片。敌人条目另经大小写及标点匹配核验，并应用逐条审核的参考图例外表，避免把同名纹章或资源误认为敌人图片。`Components.json` 与装备引用建立双向关系。包内图片文件名使用原始名称的 SHA-256 前缀，避免原仓库大小写近似的文件在 Windows/macOS 上发生覆盖或误删。索引保留原始图片名，导出扩展名与文件字节保持不变。

生成的 `assets/content/` 包含：

- `catalog.json`：精简索引、中文名称、部件关系和源版本。
- `img/`：固定 WFCD 快照的全部图片，包括技能等嵌套引用和当前未被条目引用的素材。
- `wfcd-image-index.json`：全部原始图名到本地文件的映射，以及递归物品／技能 ID 映射与歧义清单。2026-10-22 恢复后为 12,543 个文件，按内容去重 12,426 张；原顶层 catalog 仍引用 12,233 个文件。
- `data-report.json`：缺图、缺翻译和合并冲突清单。
- `enemy-image-report.json`、`enemy-images.csv`：全部敌人条目的实际文件、对应方式、来源和缺失状态。
- `checksums.json`：图片及索引 SHA-256 清单。
- `UPSTREAM-LICENSE.txt`：上游许可证副本。

本机另存的 `official-public-export/` 是独立官方图库，含 12,501 个按内容去重的原始文件、`index.json` 与 `ExportManifest.json`。查图按完整 ID → `textureLocation` → `assets[].file`，不与 WFCD 文件混存。`image-library-comparison.json` 和 `图库补全说明.md` 记录完整比较；官方按内容去重比完整 WFCD 多 75 张，不能将其多出的 606 个物品 ID 当作 606 张新图。

`data:sync` 已改为保留完整 WFCD 图片，并保留官方子目录和比较报告。重新同步生成的 catalog 使用 `imageCount` 记录完整文件数，`referencedImageCount` 记录顶层引用数。打包明确选取 WFCD 资源，官方大图库不自动带入应用包。现有发布 ZIP 保持原样。

## 验证

```sh
npm test
npm run test:app
python3 scripts/verify-release.py dist/攻略图片工具-v1.0.1-Windows-x64.zip
```

桌面测试使用真实 Electron 窗口、真实数据和系统剪贴板；验证搜索、分类、预览、名称复制、图片像素及透明度、保存字节一致、跨分类选择、批量导出、缺图降级和偏好持久化。测试的文件对话框使用隔离临时目录替代，手工选择系统文件对话框仍需在目标系统验收。测试会短暂改写系统剪贴板，结束后不恢复此前内容。

`GUIDE_TEST_MODE` 及临时目录注入仅在开发运行时生效，发布版忽略这些环境变量。

`test-results/` 提供桌面测试结果和实际截图。运行环境为 macOS 时，不代表已经在 Windows 实机运行通过。`docs/验收记录.md` 记录本次实际完成的检查和限制。

## 构建 Windows 压缩包

```sh
npm run build:win
```

产物：`dist/攻略图片工具-v1.0.1-Windows-x64.zip`，适用于 Windows 10/11 x64。构建使用 Electron Packager 的 JavaScript PE 资源编辑，无需 Wine。随包携带 Electron 运行环境和全部索引图片，原图库占主要空间。程序无后台服务、运行时网络请求或在线更新。

压缩包同目录提供 `.sha256` 校验文件。应用未购买 Windows 发布者签名，首次分发应由维护者确认可信来源。新版本数据通过维护者重新构建和发包更新。

## 代码位置

| 文件 | 职责 |
| --- | --- |
| `scripts/prepare-data.py` | 固定源快照、中文映射、图片整理和数据质量报告 |
| `scripts/image_resolver.py`、`assets/enemy-image-overrides.json` | 保守匹配与逐条审核的敌人参考图对应表 |
| `scripts/enemy_report.py` | 敌人逐条报告和 README 例外清单 |
| `src/main.cjs` | 应用窗口、图片协议、系统剪贴板、文件对话框和导出 |
| `src/preload.cjs` | 隔离页面与系统功能的窄接口 |
| `src/core.cjs` | Windows 文件名、图片路径和不覆盖的文件复制 |
| `src/renderer/search.js` | 中英文规范化、关键词匹配和排序 |
| `src/renderer/app.js` | 分类、图片网格、选择、详情和大图交互 |
| `src/renderer/index.html`、`styles.css` | 中文桌面界面与布局 |
| `scripts/package.mjs` | Windows/macOS 打包、说明文件、ZIP 与校验值 |
| `scripts/verify-release.py` | Windows 发布包结构、架构、CRC 和图片哈希验证 |

图片及数据来自 [WFCD/warframe-items](https://github.com/WFCD/warframe-items)。游戏素材权益归原权利人；工具代码使用 MIT 许可证。

<!-- ENEMY-IMAGES:START -->
## 敌人图片修复与例外（随数据构建更新）

数据提交：`20f8d9427a5a62268817853eefd8962d18c0b70e`。图片严格来自这一份 WFCD/warframe-items 快照。

共 **638 条敌人记录**：独立原图 **0** 条、明确标注的角色参考图 **37** 条、**601** 条暂无可确认图片。

**仅靠当前仓库无法覆盖大部分敌人。** 修复后的参考图来自同角色的幽魂外观、浮印头像或战甲外观，
界面统一标注「参考图」，详情列出来源；它们不能冒充该敌人条目的独立原图。
同名纹章、资源、守护、徽章、摆件及其他角色图片不会被自动当作敌人图。

原字段（例如 `alad-v.png`）保留不变，实际文件另存于 `resolvedImageName`；
按敌人 `uniqueName` 应用经核对的例外表，源文件或来源条目改变时构建报错。

### 已单独处理的对应关系

| 敌人英文名 | 记录数 | 实际 WFCD 图片 | 来源条目 | 处理 |
| --- | ---: | --- | --- | --- |
| Alad V | 1 | `CorpusAvatarAladV.png` | 阿拉德 V 浮印 | 参考图，非独立敌人原图 |
| Ancient Healer | 2 | `BallSpawnerAncientHealer.png` | 远古守护者魅影 | 参考图，非独立敌人原图 |
| Captain Vor | 1 | `CaptainVorAvatar.png` | 沃尔上尉浮印 | 参考图，非独立敌人原图 |
| Charger | 2 | `BallSpawnerCharger.png` | 疾冲者魅影 | 参考图，非独立敌人原图 |
| Chroma | 1 | `Chroma.png` | Chroma | 参考图，非独立敌人原图 |
| Corrupted Bombard | 2 | `BallSpawnerCorruptedBombard.png` | 堕落轰击者魅影 | 参考图，非独立敌人原图 |
| Corrupted Heavy Gunner | 2 | `BallSpawnerCorruptedHeavyGunner.png` | 堕落重型机枪手魅影 | 参考图，非独立敌人原图 |
| Corrupted Lancer | 2 | `BallSpawnerCorruptedLancer.png` | 堕落枪兵魅影 | 参考图，非独立敌人原图 |
| Crewman | 2 | `CorpusAvatarCrewman.png` | 船员浮印 | 参考图，非独立敌人原图 |
| Desert Skate | 1 | `BallSpawnerSkate.png` | 沙漠鳐鱼魅影 | 参考图，非独立敌人原图 |
| Executioner Dok Thul | 1 | `GrineerChampionHealer.png` | 行刑者多克·图尔的浮印 | 参考图，非独立敌人原图 |
| Executioner Garesh | 1 | `GrineerChampionCharger.png` | 行刑者加雷什的浮印 | 参考图，非独立敌人原图 |
| Executioner Gorth | 1 | `GrineerChampionTank.png` | 行刑者高斯的浮印 | 参考图，非独立敌人原图 |
| Executioner Harkonar | 1 | `GrineerChampionSniper.png` | 行刑者哈库那的浮印 | 参考图，非独立敌人原图 |
| Executioner Nok | 1 | `GrineerChampionGrunt.png` | 行刑者诺克的浮印 | 参考图，非独立敌人原图 |
| Executioner Reth | 1 | `GrineerChampionEngineer.png` | 行刑者莱斯的浮印 | 参考图，非独立敌人原图 |
| Executioner Vay Molta | 1 | `GrineerChampionHellion.png` | 行刑者 Vay Molta 的浮印 | 参考图，非独立敌人原图 |
| Executioner Zura | 1 | `GrineerChampionBeastMaster.png` | 行刑者 Zura 的浮印 | 参考图，非独立敌人原图 |
| Jackal | 3 | `CorpusAvatarJackal.png` | 豺狼浮印 | 参考图，非独立敌人原图 |
| Kela De Thaym | 1 | `KelaDeThaymAvatarAvatar.png` | Kela De Thaym浮印 | 参考图，非独立敌人原图 |
| Moa | 2 | `BallSpawnerMoa.png` | 恐鸟魅影 | 参考图，非独立敌人原图 |
| Roller | 2 | `BallSpawnerRoller.png` | 滚子魅影 | 参考图，非独立敌人原图 |
| Scorpion | 2 | `MacheteWomanAvatar.png` | 毒蝎魅影 | 参考图，非独立敌人原图 |
| Shield Osprey | 2 | `BallSpawnerShieldDrone.png` | 护盾鱼鹰魅影 | 参考图，非独立敌人原图 |
| Stalker | 1 | `Stalker.png` | 追猎者魅影 | 参考图，非独立敌人原图 |

维护表：[assets/enemy-image-overrides.json](../../../integrations/image-tool/assets/enemy-image-overrides.json)。
所有内部变体均按独立 `uniqueName` 记录；基础外观参考不代表变体拥有独立图片。

### 已排除的同名错误对应

| 敌人英文名 | 被排除的文件 | 仓库中实际所属条目 |
| --- | --- | --- |
| Alad V | `AladV.png` | Alad V Sigil |
| Ambulas | `Ambulas.png` | Ambulas Sigil |
| Captain Vor | `CaptainVor.png` | Vor Sigil |
| Carrier | `Carrier.png` | Carrier、Carrier Skin |
| Jackal | `Jackal.png` | Jackal Sigil |
| Kela De Thaym | `KelaDeThaym.png` | Kela De Thaym Sigil |
| Kuva | `Kuva.png` | Kuva |
| Lephantis | `Lephantis.png` | Lephantis Sigil |
| Lynx | `Lynx.png` | Lynx Sigil |
| Phorid | `Phorid.png` | Phorid Sigil |
| Tyl Regor | `TylRegor.png` | Tyl Regor Sigil |

### 暂无可靠对应的条目（601 条，按名称合并列出）

下表未使用其他网站的图片，也未用同阵营或近似敌人图片填充。
内部标识与逐条状态另见构建输出 `assets/content/enemy-images.csv` 和 `enemy-image-report.json`；
发布包中对应文件位于 `resources/content/`。

<details>
<summary>展开全部未对应名称</summary>

| 敌人英文名 | 记录数 | 原始 imageName | 状态 |
| --- | ---: | --- | --- |
| 002-Er | 1 | `002-er.png` | WFCD 当前快照无可确认对应图片 |
| Aerial Commander | 1 | `aerial-commander.png` | WFCD 当前快照无可确认对应图片 |
| Akkalak Turret | 1 | `akkalak-turret.png` | WFCD 当前快照无可确认对应图片 |
| Alpine Monitor Sawgaw | 1 | `alpine-monitor-sawgaw.png` | WFCD 当前快照无可确认对应图片 |
| Amalgam Alkonost | 2 | `amalgam-alkonost.png` | WFCD 当前快照无可确认对应图片 |
| Amalgam Arca Heqet | 1 | `amalgam-arca-heqet.png` | WFCD 当前快照无可确认对应图片 |
| Amalgam Arca Kucumatz | 1 | `amalgam-arca-kucumatz.png` | WFCD 当前快照无可确认对应图片 |
| Amalgam Cinder Machinist | 1 | `amalgam-cinder-machinist.png` | WFCD 当前快照无可确认对应图片 |
| Amalgam Heqet | 2 | `amalgam-heqet.png` | WFCD 当前快照无可确认对应图片 |
| Amalgam Kucumatz | 2 | `amalgam-kucumatz.png` | WFCD 当前快照无可确认对应图片 |
| Amalgam Machinist | 2 | `amalgam-machinist.png` | WFCD 当前快照无可确认对应图片 |
| Amalgam Moa | 2 | `amalgam-moa.png` | WFCD 当前快照无可确认对应图片 |
| Amalgam Osprey | 2 | `amalgam-osprey.png` | WFCD 当前快照无可确认对应图片 |
| Amalgam Phase Moa | 1 | `amalgam-phase-moa.png` | WFCD 当前快照无可确认对应图片 |
| Amalgam Satyr | 2 | `amalgam-satyr.png` | WFCD 当前快照无可确认对应图片 |
| Amalgam Swarm Satyr | 1 | `amalgam-swarm-satyr.png` | WFCD 当前快照无可确认对应图片 |
| Ambulas | 1 | `ambulas.png` | WFCD 当前快照无可确认对应图片 |
| Ancient Disruptor | 2 | `ancient-disruptor.png` | WFCD 当前快照无可确认对应图片 |
| Angst | 1 | `angst.png` | WFCD 当前快照无可确认对应图片 |
| Anti Moa | 2 | `anti-moa.png` | WFCD 当前快照无可确认对应图片 |
| Arbitration Shield Drone | 1 | `arbitration-shield-drone.png` | WFCD 当前快照无可确认对应图片 |
| Arcane Boiler | 1 | `arcane-boiler.png` | WFCD 当前快照无可确认对应图片 |
| Arid Butcher | 2 | `arid-butcher.png` | WFCD 当前快照无可确认对应图片 |
| Arid Eviscerator | 2 | `arid-eviscerator.png` | WFCD 当前快照无可确认对应图片 |
| Arid Heavy Gunner | 2 | `arid-heavy-gunner.png` | WFCD 当前快照无可确认对应图片 |
| Arid Hellion | 1 | `arid-hellion.png` | WFCD 当前快照无可确认对应图片 |
| Arid Lancer | 2 | `arid-lancer.png` | WFCD 当前快照无可确认对应图片 |
| Arid Seeker | 2 | `arid-seeker.png` | WFCD 当前快照无可确认对应图片 |
| Arid Trooper | 2 | `arid-trooper.png` | WFCD 当前快照无可确认对应图片 |
| Armaments Director | 1 | `armaments-director.png` | WFCD 当前快照无可确认对应图片 |
| Armis Ulta | 1 | `armis-ulta.png` | WFCD 当前快照无可确认对应图片 |
| Artificer | 1 | `artificer.png` | WFCD 当前快照无可确认对应图片 |
| Ashen Kuaka | 1 | `ashen-kuaka.png` | WFCD 当前快照无可确认对应图片 |
| Attack Drone | 3 | `attack-drone.png` | WFCD 当前快照无可确认对应图片 |
| Auditor | 1 | `auditor.png` | WFCD 当前快照无可确认对应图片 |
| Azoth | 1 | `azoth.png` | WFCD 当前快照无可确认对应图片 |
| Bailiff | 2 | `bailiff.png` | WFCD 当前快照无可确认对应图片 |
| Ballista | 2 | `ballista.png` | WFCD 当前快照无可确认对应图片 |
| Battalyst | 1 | `battalyst.png` | WFCD 当前快照无可确认对应图片 |
| Black-Banded Bolarola | 1 | `black-banded-bolarola.png` | WFCD 当前快照无可确认对应图片 |
| Boiler | 2 | `boiler.png` | WFCD 当前快照无可确认对应图片 |
| Bombard | 2 | `bombard.png` | WFCD 当前快照无可确认对应图片 |
| Brindle Kubrodon | 1 | `brindle-kubrodon.png` | WFCD 当前快照无可确认对应图片 |
| Brood Mother | 2 | `brood-mother.png` | WFCD 当前快照无可确认对应图片 |
| Butcher | 2 | `butcher.png` | WFCD 当前快照无可确认对应图片 |
| Carabus | 1 | `carabus.png` | WFCD 当前快照无可确认对应图片 |
| Carrier | 1 | `carrier.png` | WFCD 当前快照无可确认对应图片 |
| Carrion Charger | 2 | `carrion-charger.png` | WFCD 当前快照无可确认对应图片 |
| Cinderthresh Hyena | 1 | `cinderthresh-hyena.png` | WFCD 当前快照无可确认对应图片 |
| Clem | 1 | `clem.png` | WFCD 当前快照无可确认对应图片 |
| Coastal Mergoo | 1 | `coastal-mergoo.png` | WFCD 当前快照无可确认对应图片 |
| Commander | 1 | `commander.png` | WFCD 当前快照无可确认对应图片 |
| Common Condroc | 1 | `common-condroc.png` | WFCD 当前快照无可确认对应图片 |
| Conculyst | 1 | `conculyst.png` | WFCD 当前快照无可确认对应图片 |
| Condor Dropship | 1 | `condor-dropship.png` | WFCD 当前快照无可确认对应图片 |
| Condor Storm Dropship | 1 | `condor-storm-dropship.png` | WFCD 当前快照无可确认对应图片 |
| Condroc | 1 | `condroc.png` | WFCD 当前快照无可确认对应图片 |
| Coolant Raknoid | 1 | `coolant-raknoid.png` | WFCD 当前快照无可确认对应图片 |
| Corpus Cestra Target | 1 | `corpus-cestra-target.png` | WFCD 当前快照无可确认对应图片 |
| Corpus Power Carrier | 2 | `corpus-power-carrier.png` | WFCD 当前快照无可确认对应图片 |
| Corpus Sniper Target | 1 | `corpus-sniper-target.png` | WFCD 当前快照无可确认对应图片 |
| Corpus Supra Target | 1 | `corpus-supra-target.png` | WFCD 当前快照无可确认对应图片 |
| Corpus Target | 1 | `corpus-target.png` | WFCD 当前快照无可确认对应图片 |
| Corpus Tech | 2 | `corpus-tech.png` | WFCD 当前快照无可确认对应图片 |
| Corpus Trencher Target | 1 | `corpus-trencher-target.png` | WFCD 当前快照无可确认对应图片 |
| Corpus Warden | 2 | `corpus-warden.png` | WFCD 当前快照无可确认对应图片 |
| Corrupted Ancient | 2 | `corrupted-ancient.png` | WFCD 当前快照无可确认对应图片 |
| Corrupted Butcher | 2 | `corrupted-butcher.png` | WFCD 当前快照无可确认对应图片 |
| Corrupted Crewman | 2 | `corrupted-crewman.png` | WFCD 当前快照无可确认对应图片 |
| Corrupted Drone | 1 | `corrupted-drone.png` | WFCD 当前快照无可确认对应图片 |
| Corrupted Moa | 2 | `corrupted-moa.png` | WFCD 当前快照无可确认对应图片 |
| Corrupted Nullifier | 2 | `corrupted-nullifier.png` | WFCD 当前快照无可确认对应图片 |
| Corrupted Vor | 1 | `corrupted-vor.png` | WFCD 当前快照无可确认对应图片 |
| Corrupted Warden | 2 | `corrupted-warden.png` | WFCD 当前快照无可确认对应图片 |
| Corvette | 2 | `corvette.png` | WFCD 当前快照无可确认对应图片 |
| Councilor Vay Hek | 1 | `councilor-vay-hek.png` | WFCD 当前快照无可确认对应图片 |
| Crawler | 2 | `crawler.png` | WFCD 当前快照无可确认对应图片 |
| Dappled Horrasque | 1 | `dappled-horrasque.png` | WFCD 当前快照无可确认对应图片 |
| Darek Draga | 1 | `darek-draga.png` | WFCD 当前快照无可确认对应图片 |
| Dargyn | 2 | `dargyn.png` | WFCD 当前快照无可确认对应图片 |
| Dargyn Pilot | 1 | `dargyn-pilot.png` | WFCD 当前快照无可确认对应图片 |
| Datalyst | 1 | `datalyst.png` | WFCD 当前快照无可确认对应图片 |
| Decaying Battalyst | 1 | `decaying-battalyst.png` | WFCD 当前快照无可确认对应图片 |
| Decaying Conculyst | 1 | `decaying-conculyst.png` | WFCD 当前快照无可确认对应图片 |
| Delicate Pobber | 1 | `delicate-pobber.png` | WFCD 当前快照无可确认对应图片 |
| Demolyst | 1 | `demolyst.png` | WFCD 当前快照无可确认对应图片 |
| Demolyst Heqet | 1 | `demolyst-heqet.png` | WFCD 当前快照无可确认对应图片 |
| Demolyst Machinist | 1 | `demolyst-machinist.png` | WFCD 当前快照无可确认对应图片 |
| Demolyst Moa | 1 | `demolyst-moa.png` | WFCD 当前快照无可确认对应图片 |
| Demolyst Osprey | 1 | `demolyst-osprey.png` | WFCD 当前快照无可确认对应图片 |
| Demolyst Satyr | 1 | `demolyst-satyr.png` | WFCD 当前快照无可确认对应图片 |
| Denial Bursa | 1 | `denial-bursa.png` | WFCD 当前快照无可确认对应图片 |
| Derim Zahn | 1 | `derim-zahn.png` | WFCD 当前快照无可确认对应图片 |
| Detron Crewman | 2 | `detron-crewman.png` | WFCD 当前快照无可确认对应图片 |
| Draga | 1 | `draga.png` | WFCD 当前快照无可确认对应图片 |
| Drahk | 1 | `drahk.png` | WFCD 当前快照无可确认对应图片 |
| Drahk Master | 1 | `drahk-master.png` | WFCD 当前快照无可确认对应图片 |
| Dreg | 2 | `dreg.png` | WFCD 当前快照无可确认对应图片 |
| Drekar Ballista | 2 | `drekar-ballista.png` | WFCD 当前快照无可确认对应图片 |
| Drekar Butcher | 2 | `drekar-butcher.png` | WFCD 当前快照无可确认对应图片 |
| Drekar Elite Lancer | 2 | `drekar-elite-lancer.png` | WFCD 当前快照无可确认对应图片 |
| Drekar Eviscerator | 2 | `drekar-eviscerator.png` | WFCD 当前快照无可确认对应图片 |
| Drekar Heavy Gunner | 2 | `drekar-heavy-gunner.png` | WFCD 当前快照无可确认对应图片 |
| Drekar Hellion | 1 | `drekar-hellion.png` | WFCD 当前快照无可确认对应图片 |
| Drekar Lancer | 2 | `drekar-lancer.png` | WFCD 当前快照无可确认对应图片 |
| Drekar Manic | 1 | `drekar-manic.png` | WFCD 当前快照无可确认对应图片 |
| Drekar Manic Bombard | 1 | `drekar-manic-bombard.png` | WFCD 当前快照无可确认对应图片 |
| Drekar Scorpion | 2 | `drekar-scorpion.png` | WFCD 当前快照无可确认对应图片 |
| Drekar Seeker | 2 | `drekar-seeker.png` | WFCD 当前快照无可确认对应图片 |
| Drekar Trooper | 2 | `drekar-trooper.png` | WFCD 当前快照无可确认对应图片 |
| Drover Bursa | 1 | `drover-bursa.png` | WFCD 当前快照无可确认对应图片 |
| Dru Pesfor | 1 | `dru-pesfor.png` | WFCD 当前快照无可确认对应图片 |
| Drudge Brazer | 1 | `drudge-brazer.png` | WFCD 当前快照无可确认对应图片 |
| Drudge Foreman | 1 | `drudge-foreman.png` | WFCD 当前快照无可确认对应图片 |
| Drudge Scrapper | 1 | `drudge-scrapper.png` | WFCD 当前快照无可确认对应图片 |
| Dusky-Headed Virmink | 1 | `dusky-headed-virmink.png` | WFCD 当前快照无可确认对应图片 |
| Eidolon Gantulyst | 1 | `eidolon-gantulyst.png` | WFCD 当前快照无可确认对应图片 |
| Eidolon Hydrolyst | 1 | `eidolon-hydrolyst.png` | WFCD 当前快照无可确认对应图片 |
| Eidolon Lure | 1 | `eidolon-lure.png` | WFCD 当前快照无可确认对应图片 |
| Eidolon Teralyst | 1 | `eidolon-teralyst.png` | WFCD 当前快照无可确认对应图片 |
| Eidolon Vomvalyst | 1 | `eidolon-vomvalyst.png` | WFCD 当前快照无可确认对应图片 |
| Electric Crawler | 2 | `electric-crawler.png` | WFCD 当前快照无可确认对应图片 |
| Elite Arid Lancer | 2 | `elite-arid-lancer.png` | WFCD 当前快照无可确认对应图片 |
| Elite Crewman | 2 | `elite-crewman.png` | WFCD 当前快照无可确认对应图片 |
| Elite Frontier Lancer | 2 | `elite-frontier-lancer.png` | WFCD 当前快照无可确认对应图片 |
| Elite Lancer | 2 | `elite-lancer.png` | WFCD 当前快照无可确认对应图片 |
| Ember Specter | 1 | `ember-specter.png` | WFCD 当前快照无可确认对应图片 |
| Emperor Condroc | 1 | `emperor-condroc.png` | WFCD 当前快照无可确认对应图片 |
| Equinox Specter | 1 | `equinox-specter.png` | WFCD 当前快照无可确认对应图片 |
| Eviscerator | 2 | `eviscerator.png` | WFCD 当前快照无可确认对应图片 |
| Excalibur Specter | 1 | `excalibur-specter.png` | WFCD 当前快照无可确认对应图片 |
| Executioner Dhurnam | 1 | `executioner-dhurnam.png` | WFCD 当前快照无可确认对应图片 |
| Exploiter Orb | 1 | `exploiter-orb.png` | WFCD 当前快照无可确认对应图片 |
| Feyarch Specter | 1 | `feyarch-specter.png` | WFCD 当前快照无可确认对应图片 |
| Fire-Veined Stover | 1 | `fire-veined-stover.png` | WFCD 当前快照无可确认对应图片 |
| Flameblade | 1 | `flameblade.png` | WFCD 当前快照无可确认对应图片 |
| Flossy Sawgaw | 1 | `flossy-sawgaw.png` | WFCD 当前快照无可确认对应图片 |
| Fog Comba | 1 | `fog-comba.png` | WFCD 当前快照无可确认对应图片 |
| Fog Scrambus | 1 | `fog-scrambus.png` | WFCD 当前快照无可确认对应图片 |
| Frigate | 2 | `frigate.png` | WFCD 当前快照无可确认对应图片 |
| Frogmouthed Sawgaw | 1 | `frogmouthed-sawgaw.png` | WFCD 当前快照无可确认对应图片 |
| Frontier Butcher | 2 | `frontier-butcher.png` | WFCD 当前快照无可确认对应图片 |
| Frontier Eviscerator | 2 | `frontier-eviscerator.png` | WFCD 当前快照无可确认对应图片 |
| Frontier Heavy Gunner | 2 | `frontier-heavy-gunner.png` | WFCD 当前快照无可确认对应图片 |
| Frontier Hellion | 1 | `frontier-hellion.png` | WFCD 当前快照无可确认对应图片 |
| Frontier Lancer | 2 | `frontier-lancer.png` | WFCD 当前快照无可确认对应图片 |
| Frontier Regulator | 1 | `frontier-regulator.png` | WFCD 当前快照无可确认对应图片 |
| Frontier Seeker | 2 | `frontier-seeker.png` | WFCD 当前快照无可确认对应图片 |
| Frontier Trooper | 2 | `frontier-trooper.png` | WFCD 当前快照无可确认对应图片 |
| Frost Specter | 1 | `frost-specter.png` | WFCD 当前快照无可确认对应图片 |
| Frozen Infested Hive | 1 | `frozen-infested-hive.png` | WFCD 当前快照无可确认对应图片 |
| Fuming Dax Stover | 1 | `fuming-dax-stover.png` | WFCD 当前快照无可确认对应图片 |
| Fusion Moa | 2 | `fusion-moa.png` | WFCD 当前快照无可确认对应图片 |
| Gas Infested Hive | 1 | `gas-infested-hive.png` | WFCD 当前快照无可确认对应图片 |
| General Sargas Ruk | 1 | `general-sargas-ruk.png` | WFCD 当前快照无可确认对应图片 |
| Ghost Kuaka | 1 | `ghost-kuaka.png` | WFCD 当前快照无可确认对应图片 |
| Ghoul Auger | 1 | `ghoul-auger.png` | WFCD 当前快照无可确认对应图片 |
| Ghoul Auger Alpha | 1 | `ghoul-auger-alpha.png` | WFCD 当前快照无可确认对应图片 |
| Ghoul Devourer | 1 | `ghoul-devourer.png` | WFCD 当前快照无可确认对应图片 |
| Ghoul Expired | 1 | `ghoul-expired.png` | WFCD 当前快照无可确认对应图片 |
| Ghoul Expired Deserter | 1 | `ghoul-expired-deserter.png` | WFCD 当前快照无可确认对应图片 |
| Ghoul Rictus | 1 | `ghoul-rictus.png` | WFCD 当前快照无可确认对应图片 |
| Ghoul Rictus Alpha | 1 | `ghoul-rictus-alpha.png` | WFCD 当前快照无可确认对应图片 |
| Ghoul Target | 1 | `ghoul-target.png` | WFCD 当前快照无可确认对应图片 |
| Gox | 1 | `gox.png` | WFCD 当前快照无可确认对应图片 |
| Grineer Manic | 1 | `grineer-manic.png` | WFCD 当前快照无可确认对应图片 |
| Grineer Power Carrier | 1 | `grineer-power-carrier.png` | WFCD 当前快照无可确认对应图片 |
| Grineer Target | 1 | `grineer-target.png` | WFCD 当前快照无可确认对应图片 |
| Grineer Warden | 2 | `grineer-warden.png` | WFCD 当前快照无可确认对应图片 |
| Guardsman | 2 | `guardsman.png` | WFCD 当前快照无可确认对应图片 |
| Gyre Hyena | 1 | `gyre-hyena.png` | WFCD 当前快照无可确认对应图片 |
| Hacked Drone | 1 | `hacked-drone.png` | WFCD 当前快照无可确认对应图片 |
| Heavy Gunner | 2 | `heavy-gunner.png` | WFCD 当前快照无可确认对应图片 |
| Hellion | 1 | `hellion.png` | WFCD 当前快照无可确认对应图片 |
| Hellion Dargyn | 2 | `hellion-dargyn.png` | WFCD 当前快照无可确认对应图片 |
| Hellion Power Carrier | 1 | `hellion-power-carrier.png` | WFCD 当前快照无可确认对应图片 |
| Hemocyte | 1 | `hemocyte.png` | WFCD 当前快照无可确认对应图片 |
| Horrasque Stormer | 1 | `horrasque-stormer.png` | WFCD 当前快照无可确认对应图片 |
| Hyekka | 1 | `hyekka.png` | WFCD 当前快照无可确认对应图片 |
| Hyekka Master | 1 | `hyekka-master.png` | WFCD 当前快照无可确认对应图片 |
| Hyena Ln2 | 1 | `hyena-ln2.png` | WFCD 当前快照无可确认对应图片 |
| Hyena Ng | 1 | `hyena-ng.png` | WFCD 当前快照无可确认对应图片 |
| Hyena Pb | 1 | `hyena-pb.png` | WFCD 当前快照无可确认对应图片 |
| Hyena Th | 1 | `hyena-th.png` | WFCD 当前快照无可确认对应图片 |
| Icemire Hyena | 1 | `icemire-hyena.png` | WFCD 当前快照无可确认对应图片 |
| Infested Mesa | 1 | `infested-mesa.png` | WFCD 当前快照无可确认对应图片 |
| Isolator Bursa | 1 | `isolator-bursa.png` | WFCD 当前快照无可确认对应图片 |
| J3 Jordas Golem | 1 | `j3-jordas-golem.png` | WFCD 当前快照无可确认对应图片 |
| Jad Teran | 1 | `jad-teran.png` | WFCD 当前快照无可确认对应图片 |
| Jen Dro | 1 | `jen-dro.png` | WFCD 当前快照无可确认对应图片 |
| Jordas Golem | 1 | `jordas-golem.png` | WFCD 当前快照无可确认对应图片 |
| Juggernaut | 1 | `juggernaut.png` | WFCD 当前快照无可确认对应图片 |
| Juggernaut Behemoth | 1 | `juggernaut-behemoth.png` | WFCD 当前快照无可确认对应图片 |
| Kavat | 1 | `kavat.png` | WFCD 当前快照无可确认对应图片 |
| Kavor Defector | 4 | `kavor-defector.png` | WFCD 当前快照无可确认对应图片 |
| Knave Specter | 1 | `knave-specter.png` | WFCD 当前快照无可确认对应图片 |
| Kuaka | 1 | `kuaka.png` | WFCD 当前快照无可确认对应图片 |
| Kubrodon Incarnadine | 1 | `kubrodon-incarnadine.png` | WFCD 当前快照无可确认对应图片 |
| Kubrow | 1 | `kubrow.png` | WFCD 当前快照无可确认对应图片 |
| Kuva | 1 | `kuva.png` | WFCD 当前快照无可确认对应图片 |
| Kuva Ballista | 1 | `kuva-ballista.png` | WFCD 当前快照无可确认对应图片 |
| Kuva Bombard | 1 | `kuva-bombard.png` | WFCD 当前快照无可确认对应图片 |
| Kuva Butcher | 1 | `kuva-butcher.png` | WFCD 当前快照无可确认对应图片 |
| Kuva Dargyn | 1 | `kuva-dargyn.png` | WFCD 当前快照无可确认对应图片 |
| Kuva Drahk Master | 1 | `kuva-drahk-master.png` | WFCD 当前快照无可确认对应图片 |
| Kuva Elite Lancer | 1 | `kuva-elite-lancer.png` | WFCD 当前快照无可确认对应图片 |
| Kuva Eviscerator | 1 | `kuva-eviscerator.png` | WFCD 当前快照无可确认对应图片 |
| Kuva Flameblade | 1 | `kuva-flameblade.png` | WFCD 当前快照无可确认对应图片 |
| Kuva Guardian | 1 | `kuva-guardian.png` | WFCD 当前快照无可确认对应图片 |
| Kuva Heavy Gunner | 1 | `kuva-heavy-gunner.png` | WFCD 当前快照无可确认对应图片 |
| Kuva Hellion | 1 | `kuva-hellion.png` | WFCD 当前快照无可确认对应图片 |
| Kuva Hyekka Master | 1 | `kuva-hyekka-master.png` | WFCD 当前快照无可确认对应图片 |
| Kuva Jester | 1 | `kuva-jester.png` | WFCD 当前快照无可确认对应图片 |
| Kuva Lancer | 1 | `kuva-lancer.png` | WFCD 当前快照无可确认对应图片 |
| Kuva Napalm | 1 | `kuva-napalm.png` | WFCD 当前快照无可确认对应图片 |
| Kuva Powerclaw | 1 | `kuva-powerclaw.png` | WFCD 当前快照无可确认对应图片 |
| Kuva Roller | 1 | `kuva-roller.png` | WFCD 当前快照无可确认对应图片 |
| Kuva Scorch | 1 | `kuva-scorch.png` | WFCD 当前快照无可确认对应图片 |
| Kuva Scorpion | 1 | `kuva-scorpion.png` | WFCD 当前快照无可确认对应图片 |
| Kuva Seeker | 1 | `kuva-seeker.png` | WFCD 当前快照无可确认对应图片 |
| Kuva Shield Lancer | 1 | `kuva-shield-lancer.png` | WFCD 当前快照无可确认对应图片 |
| Kuva Siphon | 1 | `kuva-siphon.png` | WFCD 当前快照无可确认对应图片 |
| Kuva Trooper | 1 | `kuva-trooper.png` | WFCD 当前快照无可确认对应图片 |
| Kyta Raknoid | 1 | `kyta-raknoid.png` | WFCD 当前快照无可确认对应图片 |
| Lancer | 2 | `lancer.png` | WFCD 当前快照无可确认对应图片 |
| Lancer Dreg | 2 | `lancer-dreg.png` | WFCD 当前快照无可确认对应图片 |
| Lancing Infested Hive | 1 | `lancing-infested-hive.png` | WFCD 当前快照无可确认对应图片 |
| Latcher | 1 | `latcher.png` | WFCD 当前快照无可确认对应图片 |
| Leaper | 2 | `leaper.png` | WFCD 当前快照无可确认对应图片 |
| Leech Osprey | 2 | `leech-osprey.png` | WFCD 当前快照无可确认对应图片 |
| Leekter | 1 | `leekter.png` | WFCD 当前快照无可确认对应图片 |
| Lephantis | 1 | `lephantis.png` | WFCD 当前快照无可确认对应图片 |
| Lobber Crawler | 2 | `lobber-crawler.png` | WFCD 当前快照无可确认对应图片 |
| Lockjaw & Sol | 1 | `lockjaw-&-sol.png` | WFCD 当前快照无可确认对应图片 |
| Locust Drone | 1 | `locust-drone.png` | WFCD 当前快照无可确认对应图片 |
| Loki Specter | 1 | `loki-specter.png` | WFCD 当前快照无可确认对应图片 |
| Lt Lech Kril | 1 | `lt-lech-kril.png` | WFCD 当前快照无可确认对应图片 |
| Lynx | 1 | `lynx.png` | WFCD 当前快照无可确认对应图片 |
| Lynx Osprey | 1 | `lynx-osprey.png` | WFCD 当前快照无可确认对应图片 |
| Lynx Turret | 1 | `lynx-turret.png` | WFCD 当前快照无可确认对应图片 |
| M-W.A.M. | 1 | `m-w.a.m..png` | WFCD 当前快照无可确认对应图片 |
| Machinist | 1 | `machinist.png` | WFCD 当前快照无可确认对应图片 |
| Mag Specter | 1 | `mag-specter.png` | WFCD 当前快照无可确认对应图片 |
| Maggot | 1 | `maggot.png` | WFCD 当前快照无可确认对应图片 |
| Malice | 1 | `malice.png` | WFCD 当前快照无可确认对应图片 |
| Mania | 1 | `mania.png` | WFCD 当前快照无可确认对应图片 |
| Manic Bombard | 2 | `manic-bombard.png` | WFCD 当前快照无可确认对应图片 |
| Mesa Specter | 1 | `mesa-specter.png` | WFCD 当前快照无可确认对应图片 |
| Mimic | 1 | `mimic.png` | WFCD 当前快照无可确认对应图片 |
| Mine Osprey | 2 | `mine-osprey.png` | WFCD 当前快照无可确认对应图片 |
| Misery | 1 | `misery.png` | WFCD 当前快照无可确认对应图片 |
| Mordda Turret | 1 | `mordda-turret.png` | WFCD 当前快照无可确认对应图片 |
| Mutalist Alad V | 1 | `mutalist-alad-v.png` | WFCD 当前快照无可确认对应图片 |
| Mutalist Osprey | 1 | `mutalist-osprey.png` | WFCD 当前快照无可确认对应图片 |
| Mutalist Osprey Carrier | 1 | `mutalist-osprey-carrier.png` | WFCD 当前快照无可确认对应图片 |
| Nako Xol | 1 | `nako-xol.png` | WFCD 当前快照无可确认对应图片 |
| Napalm | 2 | `napalm.png` | WFCD 当前快照无可确认对应图片 |
| Nauseous Crawler | 2 | `nauseous-crawler.png` | WFCD 当前快照无可确认对应图片 |
| Nemes | 1 | `nemes.png` | WFCD 当前快照无可确认对应图片 |
| Nemes Ranger | 1 | `nemes-ranger.png` | WFCD 当前快照无可确认对应图片 |
| Nemes Rt | 1 | `nemes-rt.png` | WFCD 当前快照无可确认对应图片 |
| Nemes Scout | 1 | `nemes-scout.png` | WFCD 当前快照无可确认对应图片 |
| Nightwatch Bailiff | 1 | `nightwatch-bailiff.png` | WFCD 当前快照无可确认对应图片 |
| Nightwatch Bombard | 1 | `nightwatch-bombard.png` | WFCD 当前快照无可确认对应图片 |
| Nightwatch Brunt Lancer | 1 | `nightwatch-brunt-lancer.png` | WFCD 当前快照无可确认对应图片 |
| Nightwatch Carrier | 1 | `nightwatch-carrier.png` | WFCD 当前快照无可确认对应图片 |
| Nightwatch Flameblade | 1 | `nightwatch-flameblade.png` | WFCD 当前快照无可确认对应图片 |
| Nightwatch Hyekka Master | 1 | `nightwatch-hyekka-master.png` | WFCD 当前快照无可确认对应图片 |
| Nightwatch Lancer | 1 | `nightwatch-lancer.png` | WFCD 当前快照无可确认对应图片 |
| Nightwatch Manic | 1 | `nightwatch-manic.png` | WFCD 当前快照无可确认对应图片 |
| Nightwatch Powerclaw | 1 | `nightwatch-powerclaw.png` | WFCD 当前快照无可确认对应图片 |
| Nightwatch Reaver | 1 | `nightwatch-reaver.png` | WFCD 当前快照无可确认对应图片 |
| Nightwatch Seeker | 1 | `nightwatch-seeker.png` | WFCD 当前快照无可确认对应图片 |
| Nova Specter | 1 | `nova-specter.png` | WFCD 当前快照无可确认对应图片 |
| Nox | 2 | `nox.png` | WFCD 当前快照无可确认对应图片 |
| Nul Comba | 1 | `nul-comba.png` | WFCD 当前快照无可确认对应图片 |
| Nul Scrambus | 1 | `nul-scrambus.png` | WFCD 当前快照无可确认对应图片 |
| Nullifier Crewman | 2 | `nullifier-crewman.png` | WFCD 当前快照无可确认对应图片 |
| Nullifier Target | 1 | `nullifier-target.png` | WFCD 当前快照无可确认对应图片 |
| Oculyst | 1 | `oculyst.png` | WFCD 当前快照无可确认对应图片 |
| Ogma | 1 | `ogma.png` | WFCD 当前快照无可确认对应图片 |
| Orbital Strike Drone | 1 | `orbital-strike-drone.png` | WFCD 当前快照无可确认对应图片 |
| Orokin Drone | 2 | `orokin-drone.png` | WFCD 当前快照无可确认对应图片 |
| Orokin Sentry | 1 | `orokin-sentry.png` | WFCD 当前快照无可确认对应图片 |
| Orokin Spectator | 2 | `orokin-spectator.png` | WFCD 当前快照无可确认对应图片 |
| Orphid Specter | 1 | `orphid-specter.png` | WFCD 当前快照无可确认对应图片 |
| Oxium Osprey | 1 | `oxium-osprey.png` | WFCD 当前快照无可确认对应图片 |
| Pelna Cade | 1 | `pelna-cade.png` | WFCD 当前快照无可确认对应图片 |
| Penta Ranger | 2 | `penta-ranger.png` | WFCD 当前快照无可确认对应图片 |
| Phorid | 1 | `phorid.png` | WFCD 当前快照无可确认对应图片 |
| Plains Commander | 1 | `plains-commander.png` | WFCD 当前快照无可确认对应图片 |
| Plains Kuaka | 1 | `plains-kuaka.png` | WFCD 当前快照无可确认对应图片 |
| Powerfist | 2 | `powerfist.png` | WFCD 当前快照无可确认对应图片 |
| Prod Crewman | 2 | `prod-crewman.png` | WFCD 当前快照无可确认对应图片 |
| Profit-Taker Orb | 1 | `profit-taker-orb.png` | WFCD 当前快照无可确认对应图片 |
| Propaganda Drone | 1 | `propaganda-drone.png` | WFCD 当前快照无可确认对应图片 |
| Pulsing Infested Hive | 1 | `pulsing-infested-hive.png` | WFCD 当前快照无可确认对应图片 |
| Quanta Ranger | 2 | `quanta-ranger.png` | WFCD 当前快照无可确认对应图片 |
| Rabbleback Hyena | 1 | `rabbleback-hyena.png` | WFCD 当前快照无可确认对应图片 |
| Railgun Moa | 2 | `railgun-moa.png` | WFCD 当前快照无可确认对应图片 |
| Rana Del | 1 | `rana-del.png` | WFCD 当前快照无可确认对应图片 |
| Ranger | 2 | `ranger.png` | WFCD 当前快照无可确认对应图片 |
| Raptor Mt | 1 | `raptor-mt.png` | WFCD 当前快照无可确认对应图片 |
| Raptor Ns | 1 | `raptor-ns.png` | WFCD 当前快照无可确认对应图片 |
| Raptor Rv | 1 | `raptor-rv.png` | WFCD 当前快照无可确认对应图片 |
| Raptor Rx | 1 | `raptor-rx.png` | WFCD 当前快照无可确认对应图片 |
| Ratel | 1 | `ratel.png` | WFCD 当前快照无可确认对应图片 |
| Razorback | 1 | `razorback.png` | WFCD 当前快照无可确认对应图片 |
| Recon Commander | 1 | `recon-commander.png` | WFCD 当前快照无可确认对应图片 |
| Red-Crested Virmink | 1 | `red-crested-virmink.png` | WFCD 当前快照无可确认对应图片 |
| Regulator | 1 | `regulator.png` | WFCD 当前快照无可确认对应图片 |
| Remech Osprey | 1 | `remech-osprey.png` | WFCD 当前快照无可确认对应图片 |
| Rhino Specter | 1 | `rhino-specter.png` | WFCD 当前快照无可确认对应图片 |
| Rogue Condroc | 1 | `rogue-condroc.png` | WFCD 当前快照无可确认对应图片 |
| Roller Sentry | 1 | `roller-sentry.png` | WFCD 当前快照无可确认对应图片 |
| Ropalolyst | 1 | `ropalolyst.png` | WFCD 当前快照无可确认对应图片 |
| Runner | 1 | `runner.png` | WFCD 当前快照无可确认对应图片 |
| Sap Comba | 1 | `sap-comba.png` | WFCD 当前快照无可确认对应图片 |
| Sap Scrambus | 1 | `sap-scrambus.png` | WFCD 当前快照无可确认对应图片 |
| Sapping Osprey | 2 | `sapping-osprey.png` | WFCD 当前快照无可确认对应图片 |
| Saryn Specter | 1 | `saryn-specter.png` | WFCD 当前快照无可确认对应图片 |
| Saturn Six Fugitive | 1 | `saturn-six-fugitive.png` | WFCD 当前快照无可确认对应图片 |
| Scavenger Drone | 2 | `scavenger-drone.png` | WFCD 当前快照无可确认对应图片 |
| Scorch | 2 | `scorch.png` | WFCD 当前快照无可确认对应图片 |
| Scyto Raknoid | 1 | `scyto-raknoid.png` | WFCD 当前快照无可确认对应图片 |
| Security Camera | 1 | `security-camera.png` | WFCD 当前快照无可确认对应图片 |
| Security Infested Hive | 1 | `security-infested-hive.png` | WFCD 当前快照无可确认对应图片 |
| Seeker | 2 | `seeker.png` | WFCD 当前快照无可确认对应图片 |
| Sensor Regulator | 2 | `sensor-regulator.png` | WFCD 当前快照无可确认对应图片 |
| Senta Turret | 1 | `senta-turret.png` | WFCD 当前快照无可确认对应图片 |
| Sentient Research Director | 1 | `sentient-research-director.png` | WFCD 当前快照无可确认对应图片 |
| Sentinel Stover | 1 | `sentinel-stover.png` | WFCD 当前快照无可确认对应图片 |
| Shadow Stalker | 1 | `shadow-stalker.png` | WFCD 当前快照无可确认对应图片 |
| Shield Dargyn | 2 | `shield-dargyn.png` | WFCD 当前快照无可确认对应图片 |
| Shield Lancer | 2 | `shield-lancer.png` | WFCD 当前快照无可确认对应图片 |
| Shield-Hellion Dargyn | 2 | `shield-hellion-dargyn.png` | WFCD 当前快照无可确认对应图片 |
| Shik Tal | 1 | `shik-tal.png` | WFCD 当前快照无可确认对应图片 |
| Shock Draga | 1 | `shock-draga.png` | WFCD 当前快照无可确认对应图片 |
| Shockwave Moa | 2 | `shockwave-moa.png` | WFCD 当前快照无可确认对应图片 |
| Sikula | 1 | `sikula.png` | WFCD 当前快照无可确认对应图片 |
| Slo Comba | 1 | `slo-comba.png` | WFCD 当前快照无可确认对应图片 |
| Slo Scrambus | 1 | `slo-scrambus.png` | WFCD 当前快照无可确认对应图片 |
| Sniper Crewman | 2 | `sniper-crewman.png` | WFCD 当前快照无可确认对应图片 |
| Splendid Mergoo | 1 | `splendid-mergoo.png` | WFCD 当前快照无可确认对应图片 |
| Spotted Bolarola | 1 | `spotted-bolarola.png` | WFCD 当前快照无可确认对应图片 |
| Sprag | 1 | `sprag.png` | WFCD 当前快照无可确认对应图片 |
| Stabilization Infested Hive | 1 | `stabilization-infested-hive.png` | WFCD 当前快照无可确认对应图片 |
| Subterranean Pobber | 1 | `subterranean-pobber.png` | WFCD 当前快照无可确认对应图片 |
| Sunny Pobber | 1 | `sunny-pobber.png` | WFCD 当前快照无可确认对应图片 |
| Swarm Mutalist Moa | 2 | `swarm-mutalist-moa.png` | WFCD 当前快照无可确认对应图片 |
| Swimmer Horrasque | 1 | `swimmer-horrasque.png` | WFCD 当前快照无可确认对应图片 |
| Tar Mutalist Moa | 2 | `tar-mutalist-moa.png` | WFCD 当前快照无可确认对应图片 |
| Temporal Dreg | 1 | `temporal-dreg.png` | WFCD 当前快照无可确认对应图片 |
| Terra Ambulas | 1 | `terra-ambulas.png` | WFCD 当前快照无可确认对应图片 |
| Terra Attack Drone | 2 | `terra-attack-drone.png` | WFCD 当前快照无可确认对应图片 |
| Terra Crewman | 2 | `terra-crewman.png` | WFCD 当前快照无可确认对应图片 |
| Terra Elite Crewman | 2 | `terra-elite-crewman.png` | WFCD 当前快照无可确认对应图片 |
| Terra Elite Embattor Moa | 2 | `terra-elite-embattor-moa.png` | WFCD 当前快照无可确认对应图片 |
| Terra Elite Overtaker | 2 | `terra-elite-overtaker.png` | WFCD 当前快照无可确认对应图片 |
| Terra Elite Provisor | 2 | `terra-elite-provisor.png` | WFCD 当前快照无可确认对应图片 |
| Terra Elite Raptor Sx | 1 | `terra-elite-raptor-sx.png` | WFCD 当前快照无可确认对应图片 |
| Terra Elite Trencher | 2 | `terra-elite-trencher.png` | WFCD 当前快照无可确认对应图片 |
| Terra Embattor Moa | 2 | `terra-embattor-moa.png` | WFCD 当前快照无可确认对应图片 |
| Terra Jailer | 1 | `terra-jailer.png` | WFCD 当前快照无可确认对应图片 |
| Terra Manker | 2 | `terra-manker.png` | WFCD 当前快照无可确认对应图片 |
| Terra Moa | 2 | `terra-moa.png` | WFCD 当前快照无可确认对应图片 |
| Terra Overtaker | 2 | `terra-overtaker.png` | WFCD 当前快照无可确认对应图片 |
| Terra Plasmor Crewman | 2 | `terra-plasmor-crewman.png` | WFCD 当前快照无可确认对应图片 |
| Terra Provisor | 2 | `terra-provisor.png` | WFCD 当前快照无可确认对应图片 |
| Terra Raptor Sx | 1 | `terra-raptor-sx.png` | WFCD 当前快照无可确认对应图片 |
| Terra Shield Osprey | 2 | `terra-shield-osprey.png` | WFCD 当前快照无可确认对应图片 |
| Terra Shockwave Moa | 2 | `terra-shockwave-moa.png` | WFCD 当前快照无可确认对应图片 |
| Terra Sniper Crewman | 2 | `terra-sniper-crewman.png` | WFCD 当前快照无可确认对应图片 |
| Terra Trencher | 2 | `terra-trencher.png` | WFCD 当前快照无可确认对应图片 |
| The Hyena Pack | 1 | `the-hyena-pack.png` | WFCD 当前快照无可确认对应图片 |
| The Raptor | 1 | `the-raptor.png` | WFCD 当前快照无可确认对应图片 |
| The Sergeant | 1 | `the-sergeant.png` | WFCD 当前快照无可确认对应图片 |
| Thorny Bolarola | 1 | `thorny-bolarola.png` | WFCD 当前快照无可确认对应图片 |
| Tia Mayn | 1 | `tia-mayn.png` | WFCD 当前快照无可确认对应图片 |
| Tomb Guardian | 1 | `tomb-guardian.png` | WFCD 当前快照无可确认对应图片 |
| Tomb Protector | 1 | `tomb-protector.png` | WFCD 当前快照无可确认对应图片 |
| Tomb Protector Effigy | 1 | `tomb-protector-effigy.png` | WFCD 当前快照无可确认对应图片 |
| Torment | 1 | `torment.png` | WFCD 当前快照无可确认对应图片 |
| Toxic Ancient | 2 | `toxic-ancient.png` | WFCD 当前快照无可确认对应图片 |
| Toxic Crawler | 2 | `toxic-crawler.png` | WFCD 当前快照无可确认对应图片 |
| Trinity Specter | 1 | `trinity-specter.png` | WFCD 当前快照无可确认对应图片 |
| Trooper | 2 | `trooper.png` | WFCD 当前快照无可确认对应图片 |
| Tusk Ballista | 2 | `tusk-ballista.png` | WFCD 当前快照无可确认对应图片 |
| Tusk Bolkor | 1 | `tusk-bolkor.png` | WFCD 当前快照无可确认对应图片 |
| Tusk Bombard | 2 | `tusk-bombard.png` | WFCD 当前快照无可确认对应图片 |
| Tusk Butcher | 2 | `tusk-butcher.png` | WFCD 当前快照无可确认对应图片 |
| Tusk Carabus | 1 | `tusk-carabus.png` | WFCD 当前快照无可确认对应图片 |
| Tusk Command Dargyn | 1 | `tusk-command-dargyn.png` | WFCD 当前快照无可确认对应图片 |
| Tusk Dargyn | 1 | `tusk-dargyn.png` | WFCD 当前快照无可确认对应图片 |
| Tusk Elite Lancer | 2 | `tusk-elite-lancer.png` | WFCD 当前快照无可确认对应图片 |
| Tusk Eviscerator | 2 | `tusk-eviscerator.png` | WFCD 当前快照无可确认对应图片 |
| Tusk Firbolg | 1 | `tusk-firbolg.png` | WFCD 当前快照无可确认对应图片 |
| Tusk Flameblade | 2 | `tusk-flameblade.png` | WFCD 当前快照无可确认对应图片 |
| Tusk Heavy Gunner | 2 | `tusk-heavy-gunner.png` | WFCD 当前快照无可确认对应图片 |
| Tusk Hellion | 2 | `tusk-hellion.png` | WFCD 当前快照无可确认对应图片 |
| Tusk Lancer | 2 | `tusk-lancer.png` | WFCD 当前快照无可确认对应图片 |
| Tusk Mortar Bombard | 1 | `tusk-mortar-bombard.png` | WFCD 当前快照无可确认对应图片 |
| Tusk Napalm | 2 | `tusk-napalm.png` | WFCD 当前快照无可确认对应图片 |
| Tusk Ogma | 1 | `tusk-ogma.png` | WFCD 当前快照无可确认对应图片 |
| Tusk Predator | 2 | `tusk-predator.png` | WFCD 当前快照无可确认对应图片 |
| Tusk Reaver | 1 | `tusk-reaver.png` | WFCD 当前快照无可确认对应图片 |
| Tusk Roller | 1 | `tusk-roller.png` | WFCD 当前快照无可确认对应图片 |
| Tusk Seeker | 2 | `tusk-seeker.png` | WFCD 当前快照无可确认对应图片 |
| Tusk Seeker Drone | 1 | `tusk-seeker-drone.png` | WFCD 当前快照无可确认对应图片 |
| Tusk Shield Dargyn | 1 | `tusk-shield-dargyn.png` | WFCD 当前快照无可确认对应图片 |
| Tusk Shield Lancer | 2 | `tusk-shield-lancer.png` | WFCD 当前快照无可确认对应图片 |
| Tusk Target | 1 | `tusk-target.png` | WFCD 当前快照无可确认对应图片 |
| Tusk Thumper | 1 | `tusk-thumper.png` | WFCD 当前快照无可确认对应图片 |
| Tusk Thumper Bull | 1 | `tusk-thumper-bull.png` | WFCD 当前快照无可确认对应图片 |
| Tusk Thumper Doma | 1 | `tusk-thumper-doma.png` | WFCD 当前快照无可确认对应图片 |
| Tusk Trooper | 2 | `tusk-trooper.png` | WFCD 当前快照无可确认对应图片 |
| Tyl Regor | 1 | `tyl-regor.png` | WFCD 当前快照无可确认对应图片 |
| Valkyr Specter | 1 | `valkyr-specter.png` | WFCD 当前快照无可确认对应图片 |
| Vallis Kubrodon | 1 | `vallis-kubrodon.png` | WFCD 当前快照无可确认对应图片 |
| Vapos Anti Moa | 2 | `vapos-anti-moa.png` | WFCD 当前快照无可确认对应图片 |
| Vapos Aquila | 1 | `vapos-aquila.png` | WFCD 当前快照无可确认对应图片 |
| Vapos Condor Dropship | 1 | `vapos-condor-dropship.png` | WFCD 当前快照无可确认对应图片 |
| Vapos Condor Elite Dropship | 1 | `vapos-condor-elite-dropship.png` | WFCD 当前快照无可确认对应图片 |
| Vapos Crewman | 2 | `vapos-crewman.png` | WFCD 当前快照无可确认对应图片 |
| Vapos Detron Crewman | 2 | `vapos-detron-crewman.png` | WFCD 当前快照无可确认对应图片 |
| Vapos Elite Crewman | 2 | `vapos-elite-crewman.png` | WFCD 当前快照无可确认对应图片 |
| Vapos Elite Ranger | 2 | `vapos-elite-ranger.png` | WFCD 当前快照无可确认对应图片 |
| Vapos Fusion Moa | 2 | `vapos-fusion-moa.png` | WFCD 当前快照无可确认对应图片 |
| Vapos Moa | 2 | `vapos-moa.png` | WFCD 当前快照无可确认对应图片 |
| Vapos Nullifier | 2 | `vapos-nullifier.png` | WFCD 当前快照无可确认对应图片 |
| Vapos Oxium Osprey | 1 | `vapos-oxium-osprey.png` | WFCD 当前快照无可确认对应图片 |
| Vapos Prod Crewman | 2 | `vapos-prod-crewman.png` | WFCD 当前快照无可确认对应图片 |
| Vapos Railgun Moa | 2 | `vapos-railgun-moa.png` | WFCD 当前快照无可确认对应图片 |
| Vapos Sapping Osprey | 2 | `vapos-sapping-osprey.png` | WFCD 当前快照无可确认对应图片 |
| Vapos Shield Osprey | 2 | `vapos-shield-osprey.png` | WFCD 当前快照无可确认对应图片 |
| Vapos Shockwave Moa | 1 | `vapos-shockwave-moa.png` | WFCD 当前快照无可确认对应图片 |
| Vapos Sniper Crewman | 2 | `vapos-sniper-crewman.png` | WFCD 当前快照无可确认对应图片 |
| Vapos Tech | 2 | `vapos-tech.png` | WFCD 当前快照无可确认对应图片 |
| Vay Hek Terra Frame | 1 | `vay-hek-terra-frame.png` | WFCD 当前快照无可确认对应图片 |
| Ved Xol | 1 | `ved-xol.png` | WFCD 当前快照无可确认对应图片 |
| Vem Tabook | 1 | `vem-tabook.png` | WFCD 当前快照无可确认对应图片 |
| Ven'Kra Tel | 1 | `ven'kra-tel.png` | WFCD 当前快照无可确认对应图片 |
| Venin Mutalist | 1 | `venin-mutalist.png` | WFCD 当前快照无可确认对应图片 |
| Violence | 1 | `violence.png` | WFCD 当前快照无可确认对应图片 |
| Vivisect Director | 1 | `vivisect-director.png` | WFCD 当前快照无可确认对应图片 |
| Volatile Runner | 1 | `volatile-runner.png` | WFCD 当前快照无可确认对应图片 |
| Volt Specter | 1 | `volt-specter.png` | WFCD 当前快照无可确认对应图片 |
| Vruush Turret | 1 | `vruush-turret.png` | WFCD 当前快照无可确认对应图片 |
| White-Breasted Virmink | 1 | `white-breasted-virmink.png` | WFCD 当前快照无可确认对应图片 |
| Wolf Of Saturn Six | 1 | `wolf-of-saturn-six.png` | WFCD 当前快照无可确认对应图片 |
| Woodland Mergoo | 1 | `woodland-mergoo.png` | WFCD 当前快照无可确认对应图片 |
| Zanuka | 1 | `zanuka.png` | WFCD 当前快照无可确认对应图片 |
| Zanuka Hunter | 1 | `zanuka-hunter.png` | WFCD 当前快照无可确认对应图片 |
| Zeplen | 1 | `zeplen.png` | WFCD 当前快照无可确认对应图片 |

</details>
<!-- ENEMY-IMAGES:END -->
