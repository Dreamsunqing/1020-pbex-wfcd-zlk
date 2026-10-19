# 各类 JSON 的内容、结构与条目数

本节的路径均相对于 `世界状态上游/`。数字来自本包实测；对象键数、数组长度、分组数各自说明，不把根对象键数当成物品总数。所有字段表为现有条目的字段并集，不表示每条记录都含这些字段。


网址核对日期：2026-10-19。下表新增 **GitHub URL**、**browse.wf URL** 两列：GitHub 对四个随包仓库使用固定提交链接；官方文件另给社区镜像当前分支链接（`ExportRecipes_<lang>.json` 在镜像中合并为 `ExportRecipes.json`）。官方表第一列文件名可点击到原快照的 DE 版本化下载 URL。browse.wf 列包含同一服务体系的 `oracle.browse.wf`；“—”表示没有已确认可用的同文件公开链接。线上链接对应的内容可能已更新，不以它替换本包快照。

对应依据：[browse.wf 官方说明](https://browse.wf/about)、[Plus 在线文件目录](https://browse.wf/warframe-public-export-plus/)、[Oracle 服务入口](https://oracle.browse.wf/)。官方原始 Manifest 与 Plus 增强 JSON 分开列出，两者结构不同。

## 1. 官方 Public Export：16 类文件

路径模式为 `official-public-export/manifests/<lang>/`。下表与字段示例采用简体中文 `zh`；其他语言逐文件数量见 `JSON文件清单.tsv`，不能直接假定各语言字段和数量完全相同。

| 文件 | 根字段与条目数 | 内容 | GitHub URL | browse.wf URL |
| --- | --- | --- | --- | --- |
| [`ExportCustoms_zh.json`](https://content.warframe.com/PublicExport/Manifest/ExportCustoms_zh.json!00_aJJ2O5FJdAw0HbCfAIxVWA) | `ExportCustoms`：4834 项 | 外观、皮肤、装饰性定制物品 | [GitHub 镜像（当前）](https://github.com/calamity-inc/warframe-public-export/blob/senpai/ExportCustoms_zh.json) | — |
| [`ExportDrones_zh.json`](https://content.warframe.com/PublicExport/Manifest/ExportDrones_zh.json!00_drdgnw2FAjdyNqF+sh2nBQ) | `ExportDrones`：6 项 | 采集机及容量、耐久、采集/修复参数 | [GitHub 镜像（当前）](https://github.com/calamity-inc/warframe-public-export/blob/senpai/ExportDrones_zh.json) | — |
| [`ExportFlavour_zh.json`](https://content.warframe.com/PublicExport/Manifest/ExportFlavour_zh.json!00_Z8uncH5bgugpY6H3cgpoDA) | `ExportFlavour`：2683 项 | 附属展示物品，例如调色板、浮印等，部分含颜色值 | [GitHub 镜像（当前）](https://github.com/calamity-inc/warframe-public-export/blob/senpai/ExportFlavour_zh.json) | — |
| [`ExportFusionBundles_zh.json`](https://content.warframe.com/PublicExport/Manifest/ExportFusionBundles_zh.json!00_6zFK3IslPUqUex7U9GnMMw) | `ExportFusionBundles`：51 项 | 融合能量/内融核心包及 fusionPoints | [GitHub 镜像（当前）](https://github.com/calamity-inc/warframe-public-export/blob/senpai/ExportFusionBundles_zh.json) | — |
| [`ExportGear_zh.json`](https://content.warframe.com/PublicExport/Manifest/ExportGear_zh.json!00_wj6IFgoRo+7W6KM5mwb-7A) | `ExportGear`：180 项 | 消耗品、装备轮盘道具和父类型 | [GitHub 镜像（当前）](https://github.com/calamity-inc/warframe-public-export/blob/senpai/ExportGear_zh.json) | — |
| [`ExportKeys_zh.json`](https://content.warframe.com/PublicExport/Manifest/ExportKeys_zh.json!00_1cgACb8svbDFPOswMHLcIw) | `ExportKeys`：49 项 | 任务钥匙、系列任务、关联任务与奖励 | [GitHub 镜像（当前）](https://github.com/calamity-inc/warframe-public-export/blob/senpai/ExportKeys_zh.json) | — |
| [`ExportManifest.json`](https://content.warframe.com/PublicExport/Manifest/ExportManifest.json!00_11LMFAHtTnZR5s-N9vXyIA) | `Manifest`：20144 项 | 物品 uniqueName 到纹理 textureLocation 的图标映射 | [GitHub 镜像（当前）](https://github.com/calamity-inc/warframe-public-export/blob/senpai/ExportManifest.json) | — |
| [`ExportRecipes_zh.json`](https://content.warframe.com/PublicExport/Manifest/ExportRecipes_zh.json!00_oac+LCAtIyqDxZF8Qe1ZZA) | `ExportRecipes`：1885 项 | 制造配方、产出物、材料、费用与耗时 | [GitHub 镜像（当前）](https://github.com/calamity-inc/warframe-public-export/blob/senpai/ExportRecipes.json) | — |
| [`ExportRegions_zh.json`](https://content.warframe.com/PublicExport/Manifest/ExportRegions_zh.json!00_Ar5BH87G3NFxSCIYqDh3mg) | `ExportRegions`：269 项 | 星图节点、星球、任务、阵营及敌人等级 | [GitHub 镜像（当前）](https://github.com/calamity-inc/warframe-public-export/blob/senpai/ExportRegions_zh.json) | — |
| [`ExportRelicArcane_zh.json`](https://content.warframe.com/PublicExport/Manifest/ExportRelicArcane_zh.json!00_IiCftpg3wZAycJs2RLvHHg) | `ExportRelicArcane`：3369 项 | 官方合并的虚空遗物与赋能，含遗物奖励和赋能效果 | [GitHub 镜像（当前）](https://github.com/calamity-inc/warframe-public-export/blob/senpai/ExportRelicArcane_zh.json) | — |
| [`ExportResources_zh.json`](https://content.warframe.com/PublicExport/Manifest/ExportResources_zh.json!00_qHCXLjOH5W47t2GBzcw2pQ) | `ExportResources`：3549 项 | 资源及其他通用物品，也包含船舱装饰等，不能视为纯材料清单 | [GitHub 镜像（当前）](https://github.com/calamity-inc/warframe-public-export/blob/senpai/ExportResources_zh.json) | — |
| [`ExportSentinels_zh.json`](https://content.warframe.com/PublicExport/Manifest/ExportSentinels_zh.json!00_9XVxUBzLu5VzVKtKO8rVFg) | `ExportSentinels`：34 项 | 守护、伙伴及关联特殊单位，含基础属性 | [GitHub 镜像（当前）](https://github.com/calamity-inc/warframe-public-export/blob/senpai/ExportSentinels_zh.json) | — |
| [`ExportSortieRewards_zh.json`](https://content.warframe.com/PublicExport/Manifest/ExportSortieRewards_zh.json!00_2qiPChHg5OTEylz4HqQh+g) | `ExportSortieRewards`：17 项；`ExportNightwave`：3 键；`ExportRailjack`：1 键；`ExportIntrinsics`：5 项；`ExportOther`：46 项 | 突击奖励以及同文件附带的电波、星舰、内源和其他条目 | [GitHub 镜像（当前）](https://github.com/calamity-inc/warframe-public-export/blob/senpai/ExportSortieRewards_zh.json) | — |
| [`ExportUpgrades_zh.json`](https://content.warframe.com/PublicExport/Manifest/ExportUpgrades_zh.json!00_F5wjh-cLGAjowIgBEL5urA) | `ExportUpgrades`：1603 项；`ExportModSet`：19 项；`ExportAvionics`：82 项；`ExportFocusUpgrades`：105 项 | Mod、极性、稀有度、适用对象、等级和效果 | [GitHub 镜像（当前）](https://github.com/calamity-inc/warframe-public-export/blob/senpai/ExportUpgrades_zh.json) | — |
| [`ExportWarframes_zh.json`](https://content.warframe.com/PublicExport/Manifest/ExportWarframes_zh.json!00_cKcs6HhjvhYKM0WJ55qG7g) | `ExportWarframes`：127 项；`ExportAbilities`：13 项 | 战甲、Archwing、机甲等可装备单位的基础属性与技能 | [GitHub 镜像（当前）](https://github.com/calamity-inc/warframe-public-export/blob/senpai/ExportWarframes_zh.json) | — |
| [`ExportWeapons_zh.json`](https://content.warframe.com/PublicExport/Manifest/ExportWeapons_zh.json!00_+389jITu3rzu8I-rxKaS0g) | `ExportWeapons`：841 项；`ExportRailjackWeapons`：143 项 | 武器及模块部件、基础属性、紫卡倾向与攻击行为 | [GitHub 镜像（当前）](https://github.com/calamity-inc/warframe-public-export/blob/senpai/ExportWeapons_zh.json) | — |

### 官方结构读取方式

```python
import json
from pathlib import Path
path = Path('世界状态上游/official-public-export/manifests/zh/ExportResources_zh.json')
resources = json.loads(path.read_text(encoding='utf-8'))['ExportResources']
print(len(resources))  # 3549
```

例如 `ExportSortieRewards_zh.json` 的根对象有 5 个字段，其中 `ExportNightwave` 有 3 个键；这都不是整个文件的游戏物品总数。`ExportManifest.json` 是图标映射，虽然在 15 个语言目录重复保留，本包 15 份内容完全一致。

### 官方各根字段的具体字段

`ExportNightwave`、`ExportRailjack` 这样的对象组还会包含嵌套列表，下表单独展开。

#### `ExportCustoms_zh.json`

用途：外观、皮肤、装饰性定制物品。

| 根字段/子字段 | 类型及长度 | 条目字段（并集） |
| --- | --- | --- |
| `ExportCustoms` | array，4834 | `codexSecret`, `description`, `excludeFromCodex`, `name`, `uniqueName` |

首个根字段的截断预览（`类型/长度` 是本说明的摘要标记，原数据不含该标记）：

```json
{
  "ExportCustoms": [
    {
      "uniqueName": "/Lotus/Characters/Tenno/Accessory/Scarves/GrnBannerScarf/GrnBannerScarfItem",
      "name": "战败旗帜",
      "codexSecret": false,
      "description": "借 Grineer 自己的旗帜来嘲弄、羞辱他们。"
    }
  ]
}
```

#### `ExportDrones_zh.json`

用途：采集机及容量、耐久、采集/修复参数。

| 根字段/子字段 | 类型及长度 | 条目字段（并集） |
| --- | --- | --- |
| `ExportDrones` | array，6 | `binCapacity`, `binCount`, `capacityMultiplier`, `codexSecret`, `description`, `durability`, `fillRate`, `name`, `repairRate`, `specialities`, `uniqueName` |

首个根字段的截断预览（`类型/长度` 是本说明的摘要标记，原数据不含该标记）：

```json
{
  "ExportDrones": [
    {
      "uniqueName": "/Lotus/Types/Ship/AdvancedResourceDrone",
      "name": "泰坦采集机 Prime",
      "description": "在一个星球上部署采集机来收集大量资源。\r\n\r\n必须定期清理，才能达到最高效率并防止损坏。",
      "binCount": 1,
      "binCapacity": 2,
      "fillRate": 4
    }
  ]
}
```

#### `ExportFlavour_zh.json`

用途：附属展示物品，例如调色板、浮印等，部分含颜色值。

| 根字段/子字段 | 类型及长度 | 条目字段（并集） |
| --- | --- | --- |
| `ExportFlavour` | array，2683 | `codexSecret`, `description`, `excludeFromCodex`, `hexColours`, `name`, `uniqueName` |

首个根字段的截断预览（`类型/长度` 是本说明的摘要标记，原数据不含该标记）：

```json
{
  "ExportFlavour": [
    {
      "uniqueName": "/Lotus/Interface/Graphics/CustomUI/Backgrounds/BaruukBackground",
      "name": "Baruuk 背景",
      "description": "一个用于自定义界面的背景",
      "codexSecret": false,
      "excludeFromCodex": true
    }
  ]
}
```

#### `ExportFusionBundles_zh.json`

用途：融合能量/内融核心包及 fusionPoints。

| 根字段/子字段 | 类型及长度 | 条目字段（并集） |
| --- | --- | --- |
| `ExportFusionBundles` | array，51 | `codexSecret`, `description`, `fusionPoints`, `uniqueName` |

首个根字段的截断预览（`类型/长度` 是本说明的摘要标记，原数据不含该标记）：

```json
{
  "ExportFusionBundles": [
    {
      "uniqueName": "/Lotus/Upgrades/Mods/FusionBundles/CrewShipFusionBundles/DeepSpaceCommonAvionicsEndo",
      "description": "用来升级航道星舰区格和航电设备",
      "codexSecret": false,
      "fusionPoints": 150
    }
  ]
}
```

#### `ExportGear_zh.json`

用途：消耗品、装备轮盘道具和父类型。

| 根字段/子字段 | 类型及长度 | 条目字段（并集） |
| --- | --- | --- |
| `ExportGear` | array，180 | `codexSecret`, `description`, `name`, `parentName`, `uniqueName` |

首个根字段的截断预览（`类型/长度` 是本说明的摘要标记，原数据不含该标记）：

```json
{
  "ExportGear": [
    {
      "uniqueName": "/Lotus/Types/Game/FishBait/Infested/InfestedFishBaitA",
      "name": "\"混乱\"残留物",
      "description": "属于蛟龙'混乱'的一大块东西，是在他爆炸死亡后收集的。可以用来吸引'秩序'期间地面中的狍鸮胶蛳、'混乱'期间地面鱼点中的奥斯蒂剑鱼，以及'秩序'/'混乱'期间洞穴中的璃化脊鳎。\r\n\r\n获取地点：'秩序'活跃时的火卫二魔胎之境",
      "codexSecret": false,
      "parentName": "/Lotus/Types/Game/FishBait/Infested/BaseInfestedFishBait"
    }
  ]
}
```

#### `ExportKeys_zh.json`

用途：任务钥匙、系列任务、关联任务与奖励。

| 根字段/子字段 | 类型及长度 | 条目字段（并集） |
| --- | --- | --- |
| `ExportKeys` | array，49 | `codexSecret`, `description`, `excludeFromCodex`, `name`, `parentName`, `uniqueName` |

首个根字段的截断预览（`类型/长度` 是本说明的摘要标记，原数据不含该标记）：

```json
{
  "ExportKeys": [
    {
      "uniqueName": "/Lotus/Types/Keys/1999PrologueQuest/1999PrologueQuestKeyChain",
      "name": "食莲者",
      "description": "奇异的呼唤从远方传来，不能置之不理。",
      "parentName": "",
      "codexSecret": false
    }
  ]
}
```

#### `ExportManifest.json`

用途：物品 uniqueName 到纹理 textureLocation 的图标映射。

| 根字段/子字段 | 类型及长度 | 条目字段（并集） |
| --- | --- | --- |
| `Manifest` | array，20144 | `textureLocation`, `uniqueName` |

首个根字段的截断预览（`类型/长度` 是本说明的摘要标记，原数据不含该标记）：

```json
{
  "Manifest": [
    {
      "uniqueName": "/Lotus/Characters/Tenno/Accessory/Scarves/GrnBannerScarf/GrnBannerScarfItem",
      "textureLocation": "/Lotus/Interface/Icons/StoreIcons/Cosmetics/Syandanas/VanquishedBanner.png!00_tRfVpDeIxYKopXuvOIooOg"
    }
  ]
}
```

#### `ExportRecipes_zh.json`

用途：制造配方、产出物、材料、费用与耗时。

| 根字段/子字段 | 类型及长度 | 条目字段（并集） |
| --- | --- | --- |
| `ExportRecipes` | array，1885 | `alwaysAvailable`, `buildPrice`, `buildTime`, `codexSecret`, `consumeOnUse`, `excludeFromCodex`, `ingredients`, `num`, `primeSellingPrice`, `resultType`, `secretIngredients`, `skipBuildTimePrice`, `uniqueName` |

首个根字段的截断预览（`类型/长度` 是本说明的摘要标记，原数据不含该标记）：

```json
{
  "ExportRecipes": [
    {
      "uniqueName": "/Lotus/Types/Game/FishBait/Infested/InfestedFishBaitBBlueprint",
      "resultType": "/Lotus/Types/Game/FishBait/Infested/InfestedFishBaitB",
      "buildPrice": 30000,
      "buildTime": 43200,
      "skipBuildTimePrice": 20,
      "consumeOnUse": true
    }
  ]
}
```

#### `ExportRegions_zh.json`

用途：星图节点、星球、任务、阵营及敌人等级。

| 根字段/子字段 | 类型及长度 | 条目字段（并集） |
| --- | --- | --- |
| `ExportRegions` | array，269 | `factionIndex`, `masteryReq`, `maxEnemyLevel`, `minEnemyLevel`, `missionIndex`, `name`, `nodeType`, `systemIndex`, `systemName`, `uniqueName` |

首个根字段的截断预览（`类型/长度` 是本说明的摘要标记，原数据不含该标记）：

```json
{
  "ExportRegions": [
    {
      "uniqueName": "SolNode94",
      "name": "阿波罗多罗斯撞击坑",
      "systemIndex": 0,
      "systemName": "水星",
      "nodeType": 0,
      "masteryReq": 0
    }
  ]
}
```

#### `ExportRelicArcane_zh.json`

用途：官方合并的虚空遗物与赋能，含遗物奖励和赋能效果。

| 根字段/子字段 | 类型及长度 | 条目字段（并集） |
| --- | --- | --- |
| `ExportRelicArcane` | array，3369 | `codexSecret`, `description`, `excludeFromCodex`, `levelStats`, `name`, `rarity`, `relicRewards`, `uniqueName` |

首个根字段的截断预览（`类型/长度` 是本说明的摘要标记，原数据不含该标记）：

```json
{
  "ExportRelicArcane": [
    {
      "uniqueName": "/Lotus/Types/Game/Projections/T5VoidProjectionImmortalOmniA",
      "name": "安魂 永恒 遗物",
      "codexSecret": false,
      "description": "包含安魂 Mod 以及其他神秘物品。",
      "relicRewards": {
        "类型": "array",
        "长度": 8
      }
    }
  ]
}
```

#### `ExportResources_zh.json`

用途：资源及其他通用物品，也包含船舱装饰等，不能视为纯材料清单。

| 根字段/子字段 | 类型及长度 | 条目字段（并集） |
| --- | --- | --- |
| `ExportResources` | array，3549 | `codexSecret`, `description`, `excludeFromCodex`, `longDescription`, `name`, `parentName`, `primeSellingPrice`, `showInInventory`, `uniqueName` |

首个根字段的截断预览（`类型/长度` 是本说明的摘要标记，原数据不含该标记）：

```json
{
  "ExportResources": [
    {
      "uniqueName": "/Lotus/Objects/Tenno/Props/TnoLisetTextProjector",
      "name": "注释立标",
      "description": "一台能显示自定信息的",
      "codexSecret": false,
      "parentName": "/Lotus/Types/Items/ShipDecos/ShipDecoItem",
      "excludeFromCodex": true
    }
  ]
}
```

#### `ExportSentinels_zh.json`

用途：守护、伙伴及关联特殊单位，含基础属性。

| 根字段/子字段 | 类型及长度 | 条目字段（并集） |
| --- | --- | --- |
| `ExportSentinels` | array，34 | `armor`, `codexSecret`, `description`, `excludeFromCodex`, `health`, `name`, `power`, `productCategory`, `shield`, `stamina`, `uniqueName` |

首个根字段的截断预览（`类型/长度` 是本说明的摘要标记，原数据不含该标记）：

```json
{
  "ExportSentinels": [
    {
      "uniqueName": "/Lotus/Powersuits/Khora/Kavat/KhoraPrimeKavatPowerSuit",
      "name": "薇娜丽 Prime",
      "health": 1050,
      "shield": 0,
      "armor": 450,
      "stamina": 8
    }
  ]
}
```

#### `ExportSortieRewards_zh.json`

用途：突击奖励以及同文件附带的电波、星舰、内源和其他条目。

| 根字段/子字段 | 类型及长度 | 条目字段（并集） |
| --- | --- | --- |
| `ExportSortieRewards` | array，17 | `itemCount`, `probability`, `rarity`, `rewardName`, `tier` |
| `ExportNightwave` | object，3 |  |
| `ExportNightwave.challenges` | array，226 | `description`, `name`, `required`, `standing`, `uniqueName` |
| `ExportNightwave.rewards` | array，180 | `components`, `description`, `itemCount`, `name`, `uniqueName` |
| `ExportRailjack` | object，1 |  |
| `ExportRailjack.nodes` | array，10 | `name`, `uniqueName` |
| `ExportIntrinsics` | array，5 | `name`, `ranks` |
| `ExportOther` | array，46 | `description`, `excludeFromCodex`, `name`, `uniqueName` |

首个根字段的截断预览（`类型/长度` 是本说明的摘要标记，原数据不含该标记）：

```json
{
  "ExportSortieRewards": [
    {
      "rewardName": "/Lotus/StoreItems/Types/Items/FusionTreasures/OroFusexF",
      "rarity": "COMMON",
      "tier": 0,
      "itemCount": 1,
      "probability": 0.28
    }
  ]
}
```

#### `ExportUpgrades_zh.json`

用途：Mod、极性、稀有度、适用对象、等级和效果。

| 根字段/子字段 | 类型及长度 | 条目字段（并集） |
| --- | --- | --- |
| `ExportUpgrades` | array，1603 | `availableChallenges`, `baseDrain`, `codexSecret`, `compatName`, `description`, `excludeFromCodex`, `fusionLimit`, `isUtility`, `levelStats`, `modSet`, `modSetValues`, `name`, `polarity`, `rarity`, `subtype`, `tags`, `type`, `uniqueName`, `upgradeEntries` |
| `ExportModSet` | array，19 | `buffSet`, `numUpgradesInSet`, `stats`, `uniqueName` |
| `ExportAvionics` | array，82 | `baseDrain`, `codexSecret`, `excludeFromCodex`, `fusionLimit`, `levelStats`, `name`, `polarity`, `rarity`, `uniqueName` |
| `ExportFocusUpgrades` | array，105 | `baseDrain`, `codexSecret`, `excludeFromCodex`, `fusionLimit`, `levelStats`, `name`, `polarity`, `rarity`, `uniqueName` |

首个根字段的截断预览（`类型/长度` 是本说明的摘要标记，原数据不含该标记）：

```json
{
  "ExportUpgrades": [
    {
      "uniqueName": "/Lotus/Weapons/Tenno/Melee/Polearms/Naginata/ShrineMaidenNaginataAugment",
      "name": "天薙刀 压迫点",
      "polarity": "AP_ATTACK",
      "rarity": "RARE",
      "codexSecret": false,
      "baseDrain": 6
    }
  ]
}
```

#### `ExportWarframes_zh.json`

用途：战甲、Archwing、机甲等可装备单位的基础属性与技能。

| 根字段/子字段 | 类型及长度 | 条目字段（并集） |
| --- | --- | --- |
| `ExportWarframes` | array，127 | `abilities`, `armor`, `codexSecret`, `description`, `exalted`, `excludeFromCodex`, `health`, `longDescription`, `masteryReq`, `name`, `parentName`, `passiveDescription`, `power`, `productCategory`, `shield`, `sprintSpeed`, `stamina`, `uniqueName` |
| `ExportAbilities` | array，13 | `abilityName`, `abilityUniqueName`, `description` |

首个根字段的截断预览（`类型/长度` 是本说明的摘要标记，原数据不含该标记）：

```json
{
  "ExportWarframes": [
    {
      "uniqueName": "/Lotus/Powersuits/Archwing/SupportJetPack/SupportJetPack",
      "name": "<ARCHWING> 圣使",
      "parentName": "/Lotus/Types/Game/FlightJetPackItems/PlayerFlightJetPackItem",
      "description": "（英文：AMESHA）化身成一名飞翼守护者。",
      "health": 650,
      "shield": 220
    }
  ]
}
```

#### `ExportWeapons_zh.json`

用途：武器及模块部件、基础属性、紫卡倾向与攻击行为。

| 根字段/子字段 | 类型及长度 | 条目字段（并集） |
| --- | --- | --- |
| `ExportWeapons` | array，841 | `accuracy`, `blockingAngle`, `codexSecret`, `comboDuration`, `criticalChance`, `criticalMultiplier`, `damagePerShot`, `description`, `excludeFromCodex`, `fireRate`, `followThrough`, `heavyAttackDamage`, `heavySlamAttack`, `heavySlamRadialDamage`, `heavySlamRadius`, `magazineSize`, `masteryReq`, `maxLevelCap`, `multishot`, `name`, `noise`, `omegaAttenuation`, `primeOmegaAttenuation`, `procChance`, `productCategory`, `range`, `reloadTime`, `sentinel`, `slamAttack`, `slamRadialDamage`, `slamRadius`, `slideAttack`, `slot`, `totalDamage`, `trigger`, `uniqueName`, `windUp` |
| `ExportRailjackWeapons` | array，143 | `accuracy`, `codexSecret`, `criticalChance`, `criticalMultiplier`, `damagePerShot`, `description`, `excludeFromCodex`, `fireRate`, `magazineSize`, `masteryReq`, `multishot`, `name`, `noise`, `omegaAttenuation`, `procChance`, `productCategory`, `reloadTime`, `slot`, `totalDamage`, `trigger`, `uniqueName` |

首个根字段的截断预览（`类型/长度` 是本说明的摘要标记，原数据不含该标记）：

```json
{
  "ExportWeapons": [
    {
      "name": "苦痛·德特昂",
      "uniqueName": "/Lotus/Weapons/VoidTrader/VTDetron",
      "codexSecret": true,
      "damagePerShot": {
        "类型": "array",
        "长度": 20
      },
      "totalDamage": 40,
      "description": "（英文：MARA DETRON）对于奥罗金时代的走私者来说，这把令人生畏的手持式霰弹枪是最受他们青睐用来'解决纠纷'的工具。"
    }
  ]
}
```

## 2. Plus：增强静态资料

路径：`git/warframe-public-export-plus/`。大多数 `Export*.json` 是以内部类型路径为键的对象，`name`、`description` 通常是语言键；用 `dict.zh.json` 等字典转成文本。官方导出常见的 `uniqueName` 在 Plus 中往往成为对象键。

### 文件总览

| 文件 | 根类型 | 根长度 | 内容 | GitHub URL | browse.wf URL |
| --- | --- | --- | --- | --- | --- |
| `ExportAbilities.json` | object | 77 | 技能条目、技能名称/说明和激活能量等参数 | [GitHub（本包提交）](https://github.com/calamity-inc/warframe-public-export-plus/blob/8404b343a4ffb3e272564c24ee7abbfbd79445bc/ExportAbilities.json) | [在线 JSON](https://browse.wf/warframe-public-export-plus/ExportAbilities.json) |
| `ExportAchievements.json` | object | 376 | 成就、达成条件、进度要求与子成就 | [GitHub（本包提交）](https://github.com/calamity-inc/warframe-public-export-plus/blob/8404b343a4ffb3e272564c24ee7abbfbd79445bc/ExportAchievements.json) | [在线 JSON](https://browse.wf/warframe-public-export-plus/ExportAchievements.json) |
| `ExportAnimals.json` | object | 159 | 动物、鱼类与保育对象，含生命、经验和保育参数 | [GitHub（本包提交）](https://github.com/calamity-inc/warframe-public-export-plus/blob/8404b343a4ffb3e272564c24ee7abbfbd79445bc/ExportAnimals.json) | [在线 JSON](https://browse.wf/warframe-public-export-plus/ExportAnimals.json) |
| `ExportArcanes.json` | object | 177 | 赋能、稀有度、升级上限与等级效果 | [GitHub（本包提交）](https://github.com/calamity-inc/warframe-public-export-plus/blob/8404b343a4ffb3e272564c24ee7abbfbd79445bc/ExportArcanes.json) | [在线 JSON](https://browse.wf/warframe-public-export-plus/ExportArcanes.json) |
| `ExportAvionics.json` | object | 82 | 航道星舰航电/战斗与综合类 Mod 数据 | [GitHub（本包提交）](https://github.com/calamity-inc/warframe-public-export-plus/blob/8404b343a4ffb3e272564c24ee7abbfbd79445bc/ExportAvionics.json) | [在线 JSON](https://browse.wf/warframe-public-export-plus/ExportAvionics.json) |
| `ExportBoosterPacks.json` | object | 38 | 随机包的组成、抽取权重和重复规则 | [GitHub（本包提交）](https://github.com/calamity-inc/warframe-public-export-plus/blob/8404b343a4ffb3e272564c24ee7abbfbd79445bc/ExportBoosterPacks.json) | [在线 JSON](https://browse.wf/warframe-public-export-plus/ExportBoosterPacks.json) |
| `ExportBoosters.json` | object | 11 | 加成道具的名称、说明与类型 | [GitHub（本包提交）](https://github.com/calamity-inc/warframe-public-export-plus/blob/8404b343a4ffb3e272564c24ee7abbfbd79445bc/ExportBoosters.json) | [在线 JSON](https://browse.wf/warframe-public-export-plus/ExportBoosters.json) |
| `ExportBounties.json` | object | 54 | 赏金任务对象、名称、说明和阶段定义 | [GitHub（本包提交）](https://github.com/calamity-inc/warframe-public-export-plus/blob/8404b343a4ffb3e272564c24ee7abbfbd79445bc/ExportBounties.json) | [在线 JSON](https://browse.wf/warframe-public-export-plus/ExportBounties.json) |
| `ExportBundles.json` | object | 1164 | 商城组合包、组成物品、价格和平台限制 | [GitHub（本包提交）](https://github.com/calamity-inc/warframe-public-export-plus/blob/8404b343a4ffb3e272564c24ee7abbfbd79445bc/ExportBundles.json) | [在线 JSON](https://browse.wf/warframe-public-export-plus/ExportBundles.json) |
| `ExportChallenges.json` | object | 630 | 通用挑战及计数、说明、声望等条件 | [GitHub（本包提交）](https://github.com/calamity-inc/warframe-public-export-plus/blob/8404b343a4ffb3e272564c24ee7abbfbd79445bc/ExportChallenges.json) | [在线 JSON](https://browse.wf/warframe-public-export-plus/ExportChallenges.json) |
| `ExportCodex.json` | object | 4 | 资料库扫描对象、故事碎片、乐曲与战甲斗士碎片 | [GitHub（本包提交）](https://github.com/calamity-inc/warframe-public-export-plus/blob/8404b343a4ffb3e272564c24ee7abbfbd79445bc/ExportCodex.json) | [在线 JSON](https://browse.wf/warframe-public-export-plus/ExportCodex.json) |
| `ExportCreditBundles.json` | object | 26 | Credits 货币包及数量、价格 | [GitHub（本包提交）](https://github.com/calamity-inc/warframe-public-export-plus/blob/8404b343a4ffb3e272564c24ee7abbfbd79445bc/ExportCreditBundles.json) | [在线 JSON](https://browse.wf/warframe-public-export-plus/ExportCreditBundles.json) |
| `ExportCustoms.json` | object | 4766 | 外观、皮肤、装饰性定制物品 | [GitHub（本包提交）](https://github.com/calamity-inc/warframe-public-export-plus/blob/8404b343a4ffb3e272564c24ee7abbfbd79445bc/ExportCustoms.json) | [在线 JSON](https://browse.wf/warframe-public-export-plus/ExportCustoms.json) |
| `ExportDojoRecipes.json` | object | 6 | 氏族研究、制造、房间、装饰、染料与背景配方 | [GitHub（本包提交）](https://github.com/calamity-inc/warframe-public-export-plus/blob/8404b343a4ffb3e272564c24ee7abbfbd79445bc/ExportDojoRecipes.json) | [在线 JSON](https://browse.wf/warframe-public-export-plus/ExportDojoRecipes.json) |
| `ExportDrones.json` | object | 6 | 采集机及容量、耐久、采集/修复参数 | [GitHub（本包提交）](https://github.com/calamity-inc/warframe-public-export-plus/blob/8404b343a4ffb3e272564c24ee7abbfbd79445bc/ExportDrones.json) | [在线 JSON](https://browse.wf/warframe-public-export-plus/ExportDrones.json) |
| `ExportEmailItems.json` | object | 54 | 游戏邮件定义、发送限制和消息内容 | [GitHub（本包提交）](https://github.com/calamity-inc/warframe-public-export-plus/blob/8404b343a4ffb3e272564c24ee7abbfbd79445bc/ExportEmailItems.json) | [在线 JSON](https://browse.wf/warframe-public-export-plus/ExportEmailItems.json) |
| `ExportEnemies.json` | object | 6 | 敌人 agent/avatar、伤害控制器、掉落、命中部位与 AI 武器 | [GitHub（本包提交）](https://github.com/calamity-inc/warframe-public-export-plus/blob/8404b343a4ffb3e272564c24ee7abbfbd79445bc/ExportEnemies.json) | [在线 JSON](https://browse.wf/warframe-public-export-plus/ExportEnemies.json) |
| `ExportFactions.json` | object | 12 | 阵营枚举值与名称语言键 | [GitHub（本包提交）](https://github.com/calamity-inc/warframe-public-export-plus/blob/8404b343a4ffb3e272564c24ee7abbfbd79445bc/ExportFactions.json) | [在线 JSON](https://browse.wf/warframe-public-export-plus/ExportFactions.json) |
| `ExportFlavour.json` | object | 2630 | 附属展示物品，例如调色板、浮印等，部分含颜色值 | [GitHub（本包提交）](https://github.com/calamity-inc/warframe-public-export-plus/blob/8404b343a4ffb3e272564c24ee7abbfbd79445bc/ExportFlavour.json) | [在线 JSON](https://browse.wf/warframe-public-export-plus/ExportFlavour.json) |
| `ExportFocusUpgrades.json` | object | 105 | 专精升级与等级效果 | [GitHub（本包提交）](https://github.com/calamity-inc/warframe-public-export-plus/blob/8404b343a4ffb3e272564c24ee7abbfbd79445bc/ExportFocusUpgrades.json) | [在线 JSON](https://browse.wf/warframe-public-export-plus/ExportFocusUpgrades.json) |
| `ExportFusionBundles.json` | object | 51 | 融合能量/内融核心包及 fusionPoints | [GitHub（本包提交）](https://github.com/calamity-inc/warframe-public-export-plus/blob/8404b343a4ffb3e272564c24ee7abbfbd79445bc/ExportFusionBundles.json) | [在线 JSON](https://browse.wf/warframe-public-export-plus/ExportFusionBundles.json) |
| `ExportGear.json` | object | 180 | 消耗品、装备轮盘道具和父类型 | [GitHub（本包提交）](https://github.com/calamity-inc/warframe-public-export-plus/blob/8404b343a4ffb3e272564c24ee7abbfbd79445bc/ExportGear.json) | [在线 JSON](https://browse.wf/warframe-public-export-plus/ExportGear.json) |
| `ExportImages.json` | object | 12467 | 图标路径对应的官方内容哈希和部分论坛图片名 | [GitHub（本包提交）](https://github.com/calamity-inc/warframe-public-export-plus/blob/8404b343a4ffb3e272564c24ee7abbfbd79445bc/ExportImages.json) | [在线 JSON](https://browse.wf/warframe-public-export-plus/ExportImages.json) |
| `ExportIntrinsics.json` | object | 5 | 内源之力分支与各级名称、说明、效果 | [GitHub（本包提交）](https://github.com/calamity-inc/warframe-public-export-plus/blob/8404b343a4ffb3e272564c24ee7abbfbd79445bc/ExportIntrinsics.json) | [在线 JSON](https://browse.wf/warframe-public-export-plus/ExportIntrinsics.json) |
| `ExportKeys.json` | object | 578 | 任务钥匙、系列任务、关联任务与奖励 | [GitHub（本包提交）](https://github.com/calamity-inc/warframe-public-export-plus/blob/8404b343a4ffb3e272564c24ee7abbfbd79445bc/ExportKeys.json) | [在线 JSON](https://browse.wf/warframe-public-export-plus/ExportKeys.json) |
| `ExportMissionTypes.json` | object | 46 | 任务类型枚举和名称语言键 | [GitHub（本包提交）](https://github.com/calamity-inc/warframe-public-export-plus/blob/8404b343a4ffb3e272564c24ee7abbfbd79445bc/ExportMissionTypes.json) | [在线 JSON](https://browse.wf/warframe-public-export-plus/ExportMissionTypes.json) |
| `ExportModSet.json` | object | 19 | 套装 Mod 的组合数量及套装等级效果 | [GitHub（本包提交）](https://github.com/calamity-inc/warframe-public-export-plus/blob/8404b343a4ffb3e272564c24ee7abbfbd79445bc/ExportModSet.json) | [在线 JSON](https://browse.wf/warframe-public-export-plus/ExportModSet.json) |
| `ExportNightwave.json` | object | 3 | 电波阵营标识、挑战和奖励定义 | [GitHub（本包提交）](https://github.com/calamity-inc/warframe-public-export-plus/blob/8404b343a4ffb3e272564c24ee7abbfbd79445bc/ExportNightwave.json) | [在线 JSON](https://browse.wf/warframe-public-export-plus/ExportNightwave.json) |
| `ExportRailjackWeapons.json` | object | 155 | 航道星舰武器、伤害和攻击行为 | [GitHub（本包提交）](https://github.com/calamity-inc/warframe-public-export-plus/blob/8404b343a4ffb3e272564c24ee7abbfbd79445bc/ExportRailjackWeapons.json) | [在线 JSON](https://browse.wf/warframe-public-export-plus/ExportRailjackWeapons.json) |
| `ExportRecipes.json` | object | 2005 | 制造配方、产出物、材料、费用与耗时 | [GitHub（本包提交）](https://github.com/calamity-inc/warframe-public-export-plus/blob/8404b343a4ffb3e272564c24ee7abbfbd79445bc/ExportRecipes.json) | [在线 JSON](https://browse.wf/warframe-public-export-plus/ExportRecipes.json) |
| `ExportRegions.json` | object | 354 | 星图节点、星球、任务、阵营及敌人等级 | [GitHub（本包提交）](https://github.com/calamity-inc/warframe-public-export-plus/blob/8404b343a4ffb3e272564c24ee7abbfbd79445bc/ExportRegions.json) | [在线 JSON](https://browse.wf/warframe-public-export-plus/ExportRegions.json) |
| `ExportRelics.json` | object | 3089 | 虚空遗物、纪元、精炼品质、奖励表及入库/出库时间信息 | [GitHub（本包提交）](https://github.com/calamity-inc/warframe-public-export-plus/blob/8404b343a4ffb3e272564c24ee7abbfbd79445bc/ExportRelics.json) | [在线 JSON](https://browse.wf/warframe-public-export-plus/ExportRelics.json) |
| `ExportResources.json` | object | 3524 | 资源及其他通用物品，也包含船舱装饰等，不能视为纯材料清单 | [GitHub（本包提交）](https://github.com/calamity-inc/warframe-public-export-plus/blob/8404b343a4ffb3e272564c24ee7abbfbd79445bc/ExportResources.json) | [在线 JSON](https://browse.wf/warframe-public-export-plus/ExportResources.json) |
| `ExportRewards.json` | object | 1102 | 奖励表路径到各轮次奖励列表的映射，含物品、数量、概率或稀有度 | [GitHub（本包提交）](https://github.com/calamity-inc/warframe-public-export-plus/blob/8404b343a4ffb3e272564c24ee7abbfbd79445bc/ExportRewards.json) | [在线 JSON](https://browse.wf/warframe-public-export-plus/ExportRewards.json) |
| `ExportSentinels.json` | object | 38 | 守护、伙伴及关联特殊单位，含基础属性 | [GitHub（本包提交）](https://github.com/calamity-inc/warframe-public-export-plus/blob/8404b343a4ffb3e272564c24ee7abbfbd79445bc/ExportSentinels.json) | [在线 JSON](https://browse.wf/warframe-public-export-plus/ExportSentinels.json) |
| `ExportSyndicates.json` | object | 40 | 集团、关系、声望上限、称号、贡品与兑换 | [GitHub（本包提交）](https://github.com/calamity-inc/warframe-public-export-plus/blob/8404b343a4ffb3e272564c24ee7abbfbd79445bc/ExportSyndicates.json) | [在线 JSON](https://browse.wf/warframe-public-export-plus/ExportSyndicates.json) |
| `ExportSystems.json` | array | 25 | 星球索引、采集机受伤参数与可采集资源 | [GitHub（本包提交）](https://github.com/calamity-inc/warframe-public-export-plus/blob/8404b343a4ffb3e272564c24ee7abbfbd79445bc/ExportSystems.json) | [在线 JSON](https://browse.wf/warframe-public-export-plus/ExportSystems.json) |
| `ExportTextIcons.json` | object | 678 | 游戏内文本图标 token 到各平台图片路径的映射 | [GitHub（本包提交）](https://github.com/calamity-inc/warframe-public-export-plus/blob/8404b343a4ffb3e272564c24ee7abbfbd79445bc/ExportTextIcons.json) | [在线 JSON](https://browse.wf/warframe-public-export-plus/ExportTextIcons.json) |
| `ExportTilesets.json` | object | 28 | 关卡场景集的阵营、任务类型和场景/敌人规格关联 | [GitHub（本包提交）](https://github.com/calamity-inc/warframe-public-export-plus/blob/8404b343a4ffb3e272564c24ee7abbfbd79445bc/ExportTilesets.json) | [在线 JSON](https://browse.wf/warframe-public-export-plus/ExportTilesets.json) |
| `ExportUpgrades.json` | object | 1604 | Mod、极性、稀有度、适用对象、等级和效果 | [GitHub（本包提交）](https://github.com/calamity-inc/warframe-public-export-plus/blob/8404b343a4ffb3e272564c24ee7abbfbd79445bc/ExportUpgrades.json) | [在线 JSON](https://browse.wf/warframe-public-export-plus/ExportUpgrades.json) |
| `ExportVendors.json` | object | 96 | 商人商品池、货币价格、抽选与轮换配置 | [GitHub（本包提交）](https://github.com/calamity-inc/warframe-public-export-plus/blob/8404b343a4ffb3e272564c24ee7abbfbd79445bc/ExportVendors.json) | [在线 JSON](https://browse.wf/warframe-public-export-plus/ExportVendors.json) |
| `ExportVirtuals.json` | object | 172 | 补充的虚拟/继承类型及 parentName 关联 | [GitHub（本包提交）](https://github.com/calamity-inc/warframe-public-export-plus/blob/8404b343a4ffb3e272564c24ee7abbfbd79445bc/ExportVirtuals.json) | [在线 JSON](https://browse.wf/warframe-public-export-plus/ExportVirtuals.json) |
| `ExportWarframes.json` | object | 125 | 战甲、Archwing、机甲等可装备单位的基础属性与技能 | [GitHub（本包提交）](https://github.com/calamity-inc/warframe-public-export-plus/blob/8404b343a4ffb3e272564c24ee7abbfbd79445bc/ExportWarframes.json) | [在线 JSON](https://browse.wf/warframe-public-export-plus/ExportWarframes.json) |
| `ExportWeapons.json` | object | 842 | 武器及模块部件、基础属性、紫卡倾向与攻击行为 | [GitHub（本包提交）](https://github.com/calamity-inc/warframe-public-export-plus/blob/8404b343a4ffb3e272564c24ee7abbfbd79445bc/ExportWeapons.json) | [在线 JSON](https://browse.wf/warframe-public-export-plus/ExportWeapons.json) |

`ExportCodex`、`ExportDojoRecipes`、`ExportEnemies`、`ExportNightwave` 的根长度是分组/字段数，实际各组数量见下方；`ExportSystems` 的根是数组。

### 各文件字段与分组

#### `ExportAbilities.json`

技能条目、技能名称/说明和激活能量等参数。

条目字段：`description`, `energyConsumptionOverTime`, `energyRequiredToActivate`, `icon`, `name`。

截断预览：

```json
{
  "/Lotus/Powersuits/PowersuitAbilities/HelminthEfficiencyAbility": {
    "name": "/Lotus/Language/Suits/HelminthAmmoEfficiencyName",
    "description": "/Lotus/Language/Suits/HelminthAmmoEfficiencyDescription",
    "icon": "/Lotus/Interface/Icons/Abilities/Helminth/HelminthEfficiencyAbility.png",
    "energyRequiredToActivate": 50
  }
}
```

#### `ExportAchievements.json`

成就、达成条件、进度要求与子成就。

条目字段：`children`, `description`, `hidden`, `icon`, `name`, `progressIndicatorFreq`, `requiredCount`, `uniqueName`。

截断预览：

```json
{
  "Own1Sentinel": {
    "uniqueName": "/Lotus/Types/Challenges/Own1Sentinel",
    "name": "/Lotus/Language/Challenges/Challenge_Own1Sentinel_Name",
    "description": "/Lotus/Language/Challenges/Challenge_Own1Sentinel_Description",
    "icon": "/Lotus/Interface/Icons/Achievements/EvenATennoNeedsASidekick.png"
  }
}
```

#### `ExportAnimals.json`

动物、鱼类与保育对象，含生命、经验和保育参数。

条目字段：`conservation`, `description`, `health`, `icon`, `killXPReward`, `name`。

截断预览：

```json
{
  "/Lotus/Types/NeutralCreatures/Conservation/BirdOfPrey/CommonBirdOfPreyAvatar": {
    "name": "/Lotus/Language/EidolonPlains/CondrocCommonName",
    "description": "/Lotus/Language/EidolonPlains/CondrocGenericDesc",
    "icon": "/Lotus/Interface/Icons/Npcs/Neutral/CondrocCommon.png",
    "health": 6,
    "killXPReward": 0,
    "conservation": {
      "itemReward": "/Lotus/Types/Items/Eidolon/AnimalTagCondrocCommon",
      "standingReward": 400
    }
  }
}
```

#### `ExportArcanes.json`

赋能、稀有度、升级上限与等级效果。

条目字段：`codexSecret`, `distillPointValue`, `excludeFromCodex`, `fusionLimit`, `icon`, `levelStats`, `name`, `rarity`。

截断预览：

```json
{
  "/Lotus/Upgrades/CosmeticEnhancers/Defensive/ArmourOnDamage": {
    "name": "/Lotus/Language/Items/ArmourOnDamageName",
    "icon": "/Lotus/Interface/Icons/CosmeticEnhancers/Arcanes/Projections/ArcaneProjectionAA.png",
    "codexSecret": true,
    "rarity": "UNCOMMON",
    "levelStats": [
      {
        "类型": "array",
        "长度": 1
      }
    ],
    "fusionLimit": 5
  }
}
```

#### `ExportAvionics.json`

航道星舰航电/战斗与综合类 Mod 数据。

条目字段：`baseDrain`, `codexSecret`, `excludeFromCodex`, `fusionLimit`, `icon`, `name`, `polarity`, `rarity`。

截断预览：

```json
{
  "/Lotus/Upgrades/Mods/Railjack/Abilities/CrewShipAttackAbilityCard": {
    "name": "/Lotus/Language/Railjack/CrewShipAttackAbility",
    "icon": "/Lotus/Interface/Cards/Images/Railjack/RailjackModGeneric13.png",
    "polarity": "AP_UNIVERSAL",
    "rarity": "UNCOMMON",
    "codexSecret": false,
    "baseDrain": 0
  }
}
```

#### `ExportBoosterPacks.json`

随机包的组成、抽取权重和重复规则。

条目字段：`canGiveDuplicates`, `components`, `description`, `excludeFromMarket`, `icon`, `name`, `platinumCost`, `rarityWeightsPerRoll`。

截断预览：

```json
{
  "/Lotus/Types/BoosterPacks/1999StickersPackEchoesArchimedea": {
    "name": "/Lotus/Language/1999Echoes/1999StickersPackEchoesArchimedeaName",
    "description": "/Lotus/Language/1999Echoes/1999StickersPackEchoesArchimedeaDesc",
    "icon": "/Lotus/Interface/Icons/StoreIcons/Resources/1999Wf/StickerPack.png",
    "components": [
      {
        "类型": "object",
        "长度": 3
      }
    ],
    "rarityWeightsPerRoll": [
      {
        "类型": "object",
        "长度": 4
      }
    ],
    "canGiveDuplicates": false
  }
}
```

#### `ExportBoosters.json`

加成道具的名称、说明与类型。

条目字段：`description`, `icon`, `name`, `typeName`。

截断预览：

```json
{
  "/Lotus/Types/StoreItems/Boosters/AffinityBlessingStoreItem": {
    "name": "/Lotus/Language/Blessings/AffinityBlessingName",
    "description": "/Lotus/Language/Blessings/AffinityBlessingDesc",
    "icon": "/Lotus/Interface/Icons/StoreIcons/Boosters/MasteryRankBlessingAffinityBooster.png",
    "typeName": "/Lotus/Types/Boosters/AffinityBlessing"
  }
}
```

#### `ExportBounties.json`

赏金任务对象、名称、说明和阶段定义。

条目字段：`description`, `icon`, `name`, `stages`。

截断预览：

```json
{
  "/Lotus/Types/Gameplay/Eidolon/Jobs/AssassinateBountyAss": {
    "name": "/Lotus/Language/OstronJobs/AssassinateBountyAssTitle",
    "description": "/Lotus/Language/OstronJobs/AssassinateBountyAssDesc",
    "icon": "/Lotus/Interface/Quests/EidolonNew/AssassinateGeneralJob.png",
    "stages": [
      {
        "类型": "array",
        "长度": 4
      }
    ]
  }
}
```

#### `ExportBundles.json`

商城组合包、组成物品、价格和平台限制。

条目字段：`bundledPlatinum`, `components`, `creditsCost`, `description`, `excludeFromCodex`, `excludeFromMarket`, `excludedPlatforms`, `giftingBonus`, `icon`, `name`, `oneTimePurchasable`, `packageDiscount`, `platinumBundlePair`, `platinumCost`。

截断预览：

```json
{
  "/Lotus/Types/Game/DuviriEndless/CircuitSteelPathBIGKuvaReward": {
    "name": "/Lotus/Language/Duviri/DuviriCircuitSteelPathBIGKuvaRewardName",
    "description": "/Lotus/Language/Duviri/DuviriCircuitSteelPathBIGKuvaRewardDesc",
    "icon": "/Lotus/Interface/Icons/StoreIcons/Currency/Kuva.png",
    "components": [
      {
        "类型": "object",
        "长度": 2
      }
    ],
    "excludeFromMarket": true
  }
}
```

#### `ExportChallenges.json`

通用挑战及计数、说明、声望等条件。

条目字段：`countedRewards`, `description`, `flavour`, `hint`, `icon`, `message`, `name`, `requiredCount`, `standing`。

截断预览：

```json
{
  "/Lotus/Types/Challenges/ByDawnsEarlyLight": {
    "name": "/Lotus/Language/Challenges/Challenge_ByDawnsEarlyLight_Name",
    "description": "/Lotus/Language/Challenges/Challenge_ByDawnsEarlyLight_Description",
    "countedRewards": [
      {
        "类型": "object",
        "长度": 2
      }
    ]
  }
}
```

#### `ExportCodex.json`

资料库扫描对象、故事碎片、乐曲与战甲斗士碎片。

| 根字段 | 类型 | 条目数 | 字段 |
| --- | --- | --- | --- |
| `objects` | object | 169 | `description`, `icon`, `name`, `reqScans`, `secret` |
| `loreFragments` | object | 181 | `description`, `image`, `name`, `reqScans`, `secretTransmission` |
| `songs` | object | 86 | `name`, `reqScans`, `song` |
| `fighterFrames` | object | 44 | `name`, `reqScans`, `suit` |

截断预览：

```json
{
  "objects": {
    "/Lotus/Objects/Tenno/Props/TitaniaCodexEntryADeco": {
      "name": "/Lotus/Language/G1Quests/FairyQuestCodexEntryATitle",
      "description": "/Lotus/Language/G1Quests/FairyQuestCodexEntryABody",
      "icon": "/Lotus/Interface/Icons/Objects/TitaniaCodexEntry.png",
      "reqScans": 1,
      "secret": false
    },
    "/Lotus/Objects/Tenno/Props/TitaniaCodexEntryBDeco": {
      "name": "/Lotus/Language/G1Quests/FairyQuestCodexEntryBTitle",
      "description": "/Lotus/Language/G1Quests/FairyQuestCodexEntryBBody",
      "icon": "/Lotus/Interface/Icons/Objects/TitaniaCodexEntry.png",
      "reqScans": 1,
      "secret": false
    },
    "/Lotus/Objects/Tenno/Props/TitaniaCodexEntryCDeco": {
      "name": "/Lotus/Language/G1Quests/FairyQuestCodexEntryCTitle",
      "description": "/Lotus/Language/G1Quests/FairyQuestCodexEntryCBody",
      "icon": "/Lotus/Interface/Icons/Objects/TitaniaCodexEntry.png",
      "reqScans": 1,
      "secret": false
    },
    "/Lotus/Types/Friendly/Agents/ExcavatorAvatar": {
      "name": "/Lotus/Language/Game/ExcavatorObject",
      "icon": "/Lotus/Interface/Icons/Objects/TennoExcavator.png",
      "reqScans": 20,
      "secret": false
    },
    "/Lotus/Types/Friendly/Agents/DefenseCorePipeAvatar": {
      "name": "/Lotus/Language/Objectives/CoreSabotageCorePipe",
      "icon": "/Lotus/Interface/Icons/Objects/CorePipe.png",
      "reqScans": 20,
      "secret": false
    },
    "/Lotus/Types/Friendly/Agents/DefenseComputerCorpusAvatar": {
      "name": "/Lotus/Language/Game/HackCorpusComputer",
      "icon": "/Lotus/Interface/Icons/Objects/CorpusSystems.png",
      "reqScans": 20,
      "secret": false
    }
  }
}
```

#### `ExportCreditBundles.json`

Credits 货币包及数量、价格。

条目字段：`credits`, `description`, `icon`, `name`, `platinumCost`。

截断预览：

```json
{
  "/Lotus/Types/PickUps/Credits/10000Credits": {
    "name": "/Lotus/Language/Items/10000CreditsName",
    "icon": "/Lotus/Interface/Icons/StoreIcons/Currency/CreditsLarge.png",
    "credits": 10000
  }
}
```

#### `ExportCustoms.json`

外观、皮肤、装饰性定制物品。

条目字段：`additionalItems`, `alwaysAvailable`, `codexSecret`, `description`, `excludeFromCodex`, `excludeFromMarket`, `excludedPlatforms`, `icon`, `name`, `platinumCost`, `productCategory`, `randomisedUpgrades`, `requirement`, `subroutines`, `tradable`。

截断预览：

```json
{
  "/Lotus/Characters/Tenno/Accessory/Scarves/GrnBannerScarf/GrnBannerScarfItem": {
    "name": "/Lotus/Language/Items/GrnBannerCapeName",
    "codexSecret": false,
    "description": "/Lotus/Language/Items/GrnBannerCapeDesc",
    "icon": "/Lotus/Interface/Icons/StoreIcons/Cosmetics/Syandanas/VanquishedBanner.png",
    "productCategory": "WeaponSkins",
    "tradable": false
  }
}
```

#### `ExportDojoRecipes.json`

氏族研究、制造、房间、装饰、染料与背景配方。

| 根字段 | 类型 | 条目数 | 字段 |
| --- | --- | --- | --- |
| `research` | object | 449 | `guildXpValue`, `ingredients`, `price`, `replicatePrice`, `resultType`, `skipTimePrice`, `techPrereq`, `time` |
| `fabrications` | object | 53 | `ingredients`, `price`, `resultType` |
| `rooms` | object | 81 | `capacity`, `decoCapacity`, `description`, `destructionTime`, `energy`, `guildXpValue`, `hidden`, `icon`, `ingredients`, `name`, `price`, `resultType`, `skipTimePrice`, `time` |
| `decos` | object | 2629 | `capacityCost`, `description`, `guildXpValue`, `icon`, `ingredients`, `name`, `price`, `requiredInVault`, `resultType`, `skipTimePrice`, `time` |
| `colours` | object | 40 | `colour`, `name` |
| `backdrops` | object | 12 | `icon`, `name` |

截断预览：

```json
{
  "research": {
    "/Lotus/Levels/ClanDojo/ComponentPropRecipes/NpcPlaceables/OstronFemaleSitting": {
      "price": 1000000,
      "time": 3600,
      "skipTimePrice": 750,
      "replicatePrice": 0,
      "guildXpValue": 1000,
      "ingredients": {
        "类型": "array",
        "长度": 4
      }
    },
    "/Lotus/Levels/ClanDojo/ComponentPropRecipes/NpcPlaceables/OstronFemaleStanding": {
      "price": 1000000,
      "time": 3600,
      "skipTimePrice": 750,
      "replicatePrice": 0,
      "guildXpValue": 1000,
      "ingredients": {
        "类型": "array",
        "长度": 4
      }
    },
    "/Lotus/Levels/ClanDojo/ComponentPropRecipes/NpcPlaceables/OstronMaleStanding": {
      "price": 1000000,
      "time": 3600,
      "skipTimePrice": 750,
      "replicatePrice": 0,
      "guildXpValue": 1000,
      "ingredients": {
        "类型": "array",
        "长度": 4
      }
    },
    "/Lotus/Levels/ClanDojo/ComponentPropRecipes/NpcPlaceables/OstronMaleStandingTwo": {
      "price": 1000000,
      "time": 3600,
      "skipTimePrice": 750,
      "replicatePrice": 0,
      "guildXpValue": 1000,
      "ingredients": {
        "类型": "array",
        "长度": 4
      }
    },
    "/Lotus/Levels/ClanDojo/ComponentPropRecipes/NpcPlaceables/SolarisForeman": {
      "price": 10000,
      "time": 3600,
      "skipTimePrice": 750,
      "replicatePrice": 0,
      "guildXpValue": 1000,
      "ingredients": {
        "类型": "array",
        "长度": 4
      }
    },
    "/Lotus/Levels/ClanDojo/ComponentPropRecipes/NpcPlaceables/SolarisHazard": {
      "price": 10000,
      "time": 3600,
      "skipTimePrice": 750,
      "replicatePrice": 0,
      "guildXpValue": 1000,
      "ingredients": {
        "类型": "array",
        "长度": 4
      }
    }
  }
}
```

#### `ExportDrones.json`

采集机及容量、耐久、采集/修复参数。

条目字段：`binCapacity`, `binCount`, `capacityMultipliers`, `codexSecret`, `description`, `durability`, `fillRate`, `icon`, `name`, `probabilities`, `repairRate`。

截断预览：

```json
{
  "/Lotus/Types/Ship/AdvancedResourceDrone": {
    "name": "/Lotus/Language/Items/AdvancedResourceDrone",
    "description": "/Lotus/Language/Items/AdvancedResourceDroneDesc",
    "icon": "/Lotus/Interface/Icons/StoreIcons/Resources/ResourceDrones/ResourceDronePrime.png",
    "binCount": 1,
    "binCapacity": 2,
    "fillRate": 4
  }
}
```

#### `ExportEmailItems.json`

游戏邮件定义、发送限制和消息内容。

条目字段：`message`, `sendOnlyOnce`。

截断预览：

```json
{
  "/Lotus/Types/Items/EmailItems/1999QuestEmailItem": {
    "sendOnlyOnce": true,
    "message": {
      "sender": "/Lotus/Language/NewWar/P3M1ChooseMara",
      "title": "/Lotus/Language/1999Quest/1999QuestInboxSubject",
      "body": "/Lotus/Language/1999Quest/1999QuestInboxBody",
      "attachments": {
        "类型": "array",
        "长度": 1
      },
      "countedAttachments": {
        "类型": "array",
        "长度": 0
      },
      "icon": "/Lotus/Interface/Icons/Npcs/Operator.png"
    }
  }
}
```

#### `ExportEnemies.json`

敌人 agent/avatar、伤害控制器、掉落、命中部位与 AI 武器。

| 根字段 | 类型 | 条目数 | 字段 |
| --- | --- | --- | --- |
| `agents` | object | 1502 | `avatarTypes`, `baseLevel`, `items` |
| `avatars` | object | 1882 | `codexScansRequired`, `codexSecret`, `damageController`, `description`, `droptable`, `excludeFromSimulacrum`, `faction`, `factionResistanceKeyword`, `health`, `icon`, `isFrivolous`, `killXPReward`, `name` |
| `damageControllers` | object | 746 | `armor`, `hitProxies`, `shield`, `unhandledProcTypes` |
| `droptables` | object | 401 |  |
| `hitProxies` | object | 535 | `criticalChance`, `criticalMultiplier`, `damageAtten` |
| `aiWeapons` | object | 898 | `behaviours`, `description`, `icon`, `name` |

截断预览：

```json
{
  "agents": {
    "/Lotus/Types/Enemies/Acolytes/AreaCasterAcolyteAgent": {
      "baseLevel": 1,
      "avatarTypes": {
        "类型": "object",
        "长度": 1
      },
      "items": {
        "类型": "array",
        "长度": 2
      }
    },
    "/Lotus/Types/Enemies/Acolytes/BaseAcolyteAgent": {
      "baseLevel": 1,
      "avatarTypes": {
        "类型": "object",
        "长度": 1
      }
    },
    "/Lotus/Types/Enemies/Acolytes/CrawlerMinion": {
      "baseLevel": 1,
      "avatarTypes": {
        "类型": "object",
        "长度": 1
      },
      "items": {
        "类型": "array",
        "长度": 1
      }
    },
    "/Lotus/Types/Enemies/Acolytes/DuellistAcolyteAgent": {
      "baseLevel": 1,
      "avatarTypes": {
        "类型": "object",
        "长度": 1
      },
      "items": {
        "类型": "array",
        "长度": 2
      }
    },
    "/Lotus/Types/Enemies/Acolytes/GraspingCrawlerMinion": {
      "baseLevel": 1,
      "avatarTypes": {
        "类型": "object",
        "长度": 1
      },
      "items": {
        "类型": "array",
        "长度": 2
      }
    },
    "/Lotus/Types/Enemies/Acolytes/HeavyAcolyteAgent": {
      "baseLevel": 1,
      "avatarTypes": {
        "类型": "object",
        "长度": 1
      },
      "items": {
        "类型": "array",
        "长度": 3
      }
    }
  }
}
```

#### `ExportFactions.json`

阵营枚举值与名称语言键。

条目字段：`index`, `name`。

截断预览：

```json
{
  "FC_GRINEER": {
    "index": 0,
    "name": "/Lotus/Language/Game/Faction_GrineerUC"
  }
}
```

#### `ExportFlavour.json`

附属展示物品，例如调色板、浮印等，部分含颜色值。

条目字段：`alwaysAvailable`, `base`, `codexSecret`, `description`, `excludeFromCodex`, `excludeFromMarket`, `hexColours`, `icon`, `legacyColours`, `name`, `platinumCost`, `titleTag`。

截断预览：

```json
{
  "/Lotus/Interface/Graphics/CustomUI/Backgrounds/BaruukBackground": {
    "name": "/Lotus/Language/UIStyle/BackgroundStyleBaruuk",
    "description": "/Lotus/Language/UIStyle/BackgroundDescGeneric",
    "icon": "/Lotus/Interface/Icons/StoreIcons/Styles/StyleBaruukBackground.png",
    "base": "/EE/Types/Engine/UIBackground",
    "codexSecret": false,
    "excludeFromCodex": true
  }
}
```

#### `ExportFocusUpgrades.json`

专精升级与等级效果。

条目字段：`baseDrain`, `baseFocusPointCost`, `codexSecret`, `description`, `excludeFromCodex`, `fusionLimit`, `icon`, `levelStats`, `name`, `polarity`, `rarity`。

截断预览：

```json
{
  "/Lotus/Upgrades/Focus/Attack/Active/AttackEfficiencyFocusUpgrade": {
    "name": "/Lotus/Language/Focus/FocusAttackEfficiencyName",
    "icon": "/Lotus/Interface/Icons/FocusNodeIcons/FocusIcon132.png",
    "polarity": "AP_ATTACK",
    "rarity": "UNCOMMON",
    "codexSecret": false,
    "baseDrain": 4
  }
}
```

#### `ExportFusionBundles.json`

融合能量/内融核心包及 fusionPoints。

条目字段：`description`, `fusionPoints`, `icon`, `name`。

截断预览：

```json
{
  "/Lotus/Upgrades/Mods/FusionBundles/CrewShipFusionBundles/DeepSpaceCommonAvionicsEndo": {
    "name": "/Lotus/Language/Menu/CrewShipFusionPointsName",
    "description": "/Lotus/Language/Railjack/AvionicEndoDesc",
    "icon": "/Lotus/Interface/Icons/StoreIcons/Currency/AvionicEndoSmall.png",
    "fusionPoints": 150
  }
}
```

#### `ExportGear.json`

消耗品、装备轮盘道具和父类型。

条目字段：`codexSecret`, `creditsCost`, `description`, `excludeFromMarket`, `icon`, `name`, `parentName`, `platinumCost`, `purchaseQuantity`。

截断预览：

```json
{
  "/Lotus/Types/Game/FishBait/Infested/InfestedFishBaitA": {
    "name": "/Lotus/Language/Fish/DiemosInfestedFishBaitA",
    "description": "/Lotus/Language/Fish/DiemosInfestedFishBaitADesc",
    "icon": "/Lotus/Interface/Icons/StoreIcons/Resources/Deimos/WyrmBaitInfested.png",
    "codexSecret": false,
    "parentName": "/Lotus/Types/Game/FishBait/Infested/BaseInfestedFishBait",
    "excludeFromMarket": true
  }
}
```

#### `ExportImages.json`

图标路径对应的官方内容哈希和部分论坛图片名。

条目字段：`contentHash`, `forumName`。

截断预览：

```json
{
  "/Lotus/Fx/Sigils/EnergySigilA_d.png": {
    "contentHash": "00_g0ej+3KA4O2Cz7MoN-PfRw"
  }
}
```

#### `ExportIntrinsics.json`

内源之力分支与各级名称、说明、效果。

条目字段：`description`, `icon`, `name`, `ranks`。

截断预览：

```json
{
  "LPS_TACTICAL": {
    "name": "/Lotus/Language/Intrinsics/RailjackIntrinsicTactic",
    "description": "/Lotus/Language/Intrinsics/RailjackIntrinsicTacticDesc",
    "icon": "/Lotus/Interface/Icons/Intrinsics/IntrinsicsTacticianIcon.png",
    "ranks": [
      {
        "类型": "object",
        "长度": 2
      }
    ]
  }
}
```

#### `ExportKeys.json`

任务钥匙、系列任务、关联任务与奖励。

条目字段：`cacheRewardManifest`, `chainStages`, `codexSecret`, `description`, `excludeFromCodex`, `icon`, `mission`, `missionReward`, `name`, `parentName`, `replayable`, `rewards`。

截断预览：

```json
{
  "/Lotus/Types/Keys/1999PrologueQuest/1999PrologueQuestKeyChain": {
    "name": "/Lotus/Language/LotusEaters/QuestTitle",
    "description": "/Lotus/Language/LotusEaters/QuestDesc",
    "icon": "/Lotus/Interface/Quests/1999PrologueQuestKeyChain.png",
    "parentName": "/Lotus/Types/Game/KeyChainItem",
    "codexSecret": false,
    "chainStages": [
      {
        "类型": "object",
        "长度": 3
      }
    ]
  }
}
```

#### `ExportMissionTypes.json`

任务类型枚举和名称语言键。

条目字段：`index`, `name`。

截断预览：

```json
{
  "MT_ASSASSINATION": {
    "index": 0,
    "name": "/Lotus/Language/Missions/MissionName_Assassination"
  }
}
```

#### `ExportModSet.json`

套装 Mod 的组合数量及套装等级效果。

条目字段：`buffSet`, `description`, `icon`, `levelStats`, `numUpgradesInSet`。

截断预览：

```json
{
  "/Lotus/Upgrades/Mods/Sets/Vigilante/VigilanteSetMod": {
    "description": "/Lotus/Language/Upgrades/WarframeVigilanteSetDesc",
    "icon": "/Lotus/Interface/Cards/Images/Sets/Vigilante/VigilanteHeader.png",
    "numUpgradesInSet": 6,
    "levelStats": [
      {
        "类型": "object",
        "长度": 1
      }
    ]
  }
}
```

#### `ExportNightwave.json`

电波阵营标识、挑战和奖励定义。

| 根字段 | 类型 | 条目数 | 字段 |
| --- | --- | --- | --- |
| `affiliationTag` | string | 标量 |  |
| `challenges` | object | 226 | `description`, `icon`, `name`, `required`, `standing`, `tip`, `tipIcon` |
| `rewards` | array | 180 | `description`, `icon`, `itemCount`, `name`, `uniqueName` |

截断预览：

```json
{
  "affiliationTag": "RadioLegionIntermission16Syndicate"
}
```

#### `ExportRailjackWeapons.json`

航道星舰武器、伤害和攻击行为。

条目字段：`accuracy`, `behaviours`, `codexSecret`, `compatibilityTags`, `creditsCost`, `criticalChance`, `criticalMultiplier`, `damagePerShot`, `defaultUpgrades`, `description`, `excludeFromCodex`, `excludeFromMarket`, `fireRate`, `icon`, `magazineSize`, `masteryReq`, `multishot`, `name`, `noise`, `omegaAttenuation`, `parentName`, `procChance`, `productCategory`, `reloadTime`, `slot`, `totalDamage`, `trigger`, `variantType`。

截断预览：

```json
{
  "/Lotus/Weapons/CrewShip/Countermeasures/DecoyCountermeasure": {
    "name": "/Lotus/Language/CrewShip/Countermeasure_Decoy",
    "parentName": "/Lotus/Weapons/CrewShip/RailjackWeapon",
    "icon": "/Lotus/Interface/Icons/StoreIcons/PlayerShip/Railjack/Countermeasures/RailjackPayloadRearChaff.png",
    "codexSecret": false,
    "damagePerShot": [
      3.333334
    ],
    "totalDamage": 10
  }
}
```

#### `ExportRecipes.json`

制造配方、产出物、材料、费用与耗时。

条目字段：`alwaysAvailable`, `buildPrice`, `buildTime`, `codexSecret`, `consumeOnUse`, `creditsCost`, `excludeFromCodex`, `excludeFromMarket`, `hidden`, `ingredients`, `num`, `oneTimePurchasable`, `platinumCost`, `primeSellingPrice`, `resultType`, `secretIngredientAction`, `secretIngredients`, `skipBuildTimePrice`, `syndicateStandingChange`, `tradable`。

截断预览：

```json
{
  "/Lotus/Types/Game/FishBait/Infested/InfestedFishBaitBBlueprint": {
    "resultType": "/Lotus/Types/Game/FishBait/Infested/InfestedFishBaitB",
    "buildPrice": 30000,
    "buildTime": 43200,
    "skipBuildTimePrice": 20,
    "consumeOnUse": true,
    "num": 1
  }
}
```

#### `ExportRegions.json`

星图节点、星球、任务、阵营及敌人等级。

条目字段：`cacheRewardManifest`, `challenges`, `customAdvancedSpawners`, `darkSectorData`, `enemySpec`, `extraEnemySpec`, `faction`, `founders`, `hidden`, `levelOverride`, `masteryExp`, `masteryReq`, `maxEnemyLevel`, `minEnemyLevel`, `miscItemFee`, `missionName`, `missionReward`, `missionType`, `name`, `nextNodes`, `nodeType`, `questReq`, `questReqs`, `rewardManifests`, `secondaryFaction`, `systemIndex`, `systemName`, `tileset`, `vipAgent`。

截断预览：

```json
{
  "SolNode94": {
    "name": "/Lotus/Language/Locations/Apollodorus",
    "systemIndex": 0,
    "systemName": "/Lotus/Language/Locations/Mercury",
    "nodeType": 0,
    "masteryReq": 0,
    "missionType": "MT_SURVIVAL"
  }
}
```

#### `ExportRelics.json`

虚空遗物、纪元、精炼品质、奖励表及入库/出库时间信息。

条目字段：`category`, `codexSecret`, `description`, `era`, `icon`, `introducedAt`, `quality`, `rewardManifest`, `vaultedAt`。

截断预览：

```json
{
  "/Lotus/Types/Game/Projections/T5VoidProjectionImmortalOmniA": {
    "category": "Eterna",
    "era": "Requiem",
    "icon": "/Lotus/Interface/Icons/Relics/RelicImmortalC.png",
    "codexSecret": false,
    "description": "/Lotus/Language/Relics/ImmortalProjectionBaseDesc",
    "quality": "VPQ_BRONZE"
  }
}
```

#### `ExportResources.json`

资源及其他通用物品，也包含船舱装饰等，不能视为纯材料清单。

条目字段：`capacityCost`, `codexSecret`, `deco`, `description`, `dissectionParts`, `dojoCapacityCost`, `excludeFromCodex`, `excludeFromMarket`, `helminthSnack`, `icon`, `longDescription`, `name`, `oneTimePurchasable`, `parentName`, `pickupQuantity`, `platinumCost`, `primeSellingPrice`, `productCategory`, `purchaseQuantity`, `rarity`, `showInInventory`, `sockets`, `standingBonus`, `syndicateTag`。

截断预览：

```json
{
  "/Lotus/Objects/Tenno/Props/TnoLisetTextProjector": {
    "name": "/Lotus/Language/ShipDecorations/TnoLisetScreenProjectorName",
    "description": "/Lotus/Language/ShipDecorations/TnoLisetScreenProjectorDesc",
    "icon": "/Lotus/Interface/Icons/StoreIcons/ShipDecos/TextProjector.png",
    "codexSecret": false,
    "parentName": "/Lotus/Types/Items/ShipDecos/ShipDecoItem",
    "productCategory": "ShipDecorations"
  }
}
```

#### `ExportRewards.json`

奖励表路径到各轮次奖励列表的映射，含物品、数量、概率或稀有度。

值结构：奖励表为分轮次嵌套数组，奖励项包含 `type`、`itemCount`、`probability` 或 `rarity`。

截断预览：

```json
{
  "/Lotus/Types/Game/MissionDecks/1999ConquestRewards/1999ConquestArcaneRewards": [
    [
      {
        "类型": "object",
        "长度": 3
      }
    ]
  ]
}
```

#### `ExportSentinels.json`

守护、伙伴及关联特殊单位，含基础属性。

条目字段：`armor`, `codexSecret`, `defaultUpgrades`, `defaultWeapon`, `description`, `exalted`, `excludeFromCodex`, `excludeFromMarket`, `health`, `icon`, `name`, `platinumCost`, `power`, `productCategory`, `shield`, `stamina`。

截断预览：

```json
{
  "/Lotus/Powersuits/Khora/Kavat/KhoraPrimeKavatPowerSuit": {
    "name": "/Lotus/Language/Primes/VenariPrimeName",
    "icon": "/Lotus/Interface/Icons/StoreIcons/Weapons/ExaltedWeapons/VenariPrime.png",
    "health": 1050,
    "shield": 0,
    "armor": 450,
    "stamina": 8
  }
}
```

#### `ExportSyndicates.json`

集团、关系、声望上限、称号、贡品与兑换。

条目字段：`alignments`, `backgroundColour`, `colour`, `dailyChallenges`, `dailyLimitBin`, `description`, `favours`, `icon`, `initiationReward`, `initiationSacrifice`, `medallions`, `medallionsCappedByDailyLimit`, `name`, `titles`, `uniqueName`, `weeklyChallenges`。

截断预览：

```json
{
  "ArbitersSyndicate": {
    "uniqueName": "/Lotus/Syndicates/ArbitersSyndicate",
    "name": "/Lotus/Language/Syndicates/ArbitersName",
    "icon": "/Lotus/Interface/Icons/Syndicates/FactionSigilJudge.png",
    "description": "/Lotus/Language/Syndicates/ArbitersDesc",
    "colour": {
      "value": "0x00D3E4E7"
    },
    "backgroundColour": {
      "value": "0x003A3843"
    }
  }
}
```

#### `ExportSystems.json`

星球索引、采集机受伤参数与可采集资源。

条目字段：`damageChance`, `droneDamage`, `index`, `name`, `resources`。

截断预览：

```json
[
  {
    "index": 0,
    "name": "/Lotus/Language/Locations/Mercury",
    "droneDamage": {
      "minValue": 20,
      "maxValue": 50
    },
    "damageChance": 0.2,
    "resources": [
      {
        "类型": "object",
        "长度": 3
      }
    ]
  }
]
```

#### `ExportTextIcons.json`

游戏内文本图标 token 到各平台图片路径的映射。

条目字段：`DIT_AGNOSTIC`, `DIT_ANDROID`, `DIT_AUTO`, `DIT_IOS`, `DIT_PC`, `DIT_PS4`, `DIT_PS5`, `DIT_STEAM`, `DIT_SWITCH`, `DIT_XBONE`。

截断预览：

```json
{
  "GAMEPAD_LTHUMB": {
    "DIT_PS4": "/EE/Interface/Graphics/PlatformKeys/PS4_L3_d.png",
    "DIT_XBONE": "/EE/Interface/Graphics/PlatformKeys/XboxOneJoystickLClick_d.png",
    "DIT_STEAM": "/EE/Interface/Graphics/PlatformKeys/SteamController/StickClick.png",
    "DIT_AGNOSTIC": "/Lotus/Interface/Graphics/OperatorHud/Empty.png",
    "DIT_SWITCH": "/EE/Interface/Graphics/PlatformKeys/Switch/SwitchLStickPress_d.png"
  }
}
```

#### `ExportTilesets.json`

关卡场景集的阵营、任务类型和场景/敌人规格关联。

条目字段：`faction`, `missions`, `uniqueName`。

截断预览：

```json
{
  "ArchwingCorpusTrenchrunTileset": {
    "uniqueName": "/Lotus/Types/Game/RegionTilesets/ArchwingCorpusTrenchrunTileset",
    "faction": "FC_CORPUS",
    "missions": {
      "MT_EXTERMINATION": {
        "类型": "object",
        "长度": 2
      },
      "MT_SABOTAGE": {
        "类型": "object",
        "长度": 2
      },
      "MT_MOBILE_DEFENSE": {
        "类型": "object",
        "长度": 2
      },
      "MT_RACE": {
        "类型": "object",
        "长度": 2
      }
    }
  }
}
```

#### `ExportUpgrades.json`

Mod、极性、稀有度、适用对象、等级和效果。

条目字段：`availableChallenges`, `baseDrain`, `codexSecret`, `compat`, `compatName`, `compatibilityTags`, `compatibleItems`, `description`, `excludeFromCodex`, `fusionLimit`, `icon`, `incompatibilityTags`, `introducedAt`, `isFrivolous`, `isStarter`, `isUtility`, `levelStats`, `modSet`, `modSetValues`, `name`, `polarity`, `rarity`, `subtype`, `tradable`, `type`, `upgradeEntries`。

截断预览：

```json
{
  "/Lotus/Weapons/Tenno/Melee/Polearms/Naginata/ShrineMaidenNaginataAugment": {
    "name": "/Lotus/Language/Mods/ShrineMaidenNaginataAugmentModName",
    "icon": "/Lotus/Interface/Cards/Images/Unique/ShrineMaidenNaginataAugment.png",
    "polarity": "AP_ATTACK",
    "rarity": "RARE",
    "codexSecret": false,
    "baseDrain": 6
  }
}
```

#### `ExportVendors.json`

商人商品池、货币价格、抽选与轮换配置。

条目字段：`isDynamic`, `isOneBinPerCycle`, `items`, `numItems`, `numItemsPerBin`, `randomItemPricesPerBin`, `randomSeedType`, `requiredGoalTag`。

截断预览：

```json
{
  "/Lotus/Types/Game/VendorManifests/Deimos/ConservationRewardsManifest": {
    "isDynamic": false,
    "items": [
      {
        "类型": "object",
        "长度": 6
      }
    ],
    "randomItemPricesPerBin": [
      {
        "类型": "array",
        "长度": 3
      }
    ]
  }
}
```

#### `ExportVirtuals.json`

补充的虚拟/继承类型及 parentName 关联。

条目字段：`name`, `parentName`。

截断预览：

```json
{
  "/Lotus/Powersuits/Choir/ChoirEruptWeaponBase": {
    "parentName": "/Lotus/Weapons/Tenno/Pistol/LotusPistol"
  }
}
```

#### `ExportWarframes.json`

战甲、Archwing、机甲等可装备单位的基础属性与技能。

条目字段：`abilities`, `additionalItems`, `armor`, `codexSecret`, `description`, `exalted`, `excludeFromCodex`, `excludeFromMarket`, `health`, `icon`, `introducedAt`, `longDescription`, `masteryReq`, `maxLevelCap`, `name`, `nemesisUpgradeTag`, `parentName`, `passiveDescription`, `platinumCost`, `power`, `productCategory`, `shield`, `sprintSpeed`, `stamina`, `variantType`。

截断预览：

```json
{
  "/Lotus/Powersuits/Archwing/SupportJetPack/SupportJetPack": {
    "name": "/Lotus/Language/Items/SupportArchwingName",
    "parentName": "/Lotus/Types/Game/FlightJetPackItems/PlayerFlightJetPackItem",
    "description": "/Lotus/Language/Items/SupportArchwingDesc",
    "icon": "/Lotus/Interface/Icons/StoreIcons/Archwing/Archwings/Amesha.png",
    "health": 650,
    "shield": 220
  }
}
```

#### `ExportWeapons.json`

武器及模块部件、基础属性、紫卡倾向与攻击行为。

条目字段：`accuracy`, `additionalItems`, `bayonetOtherWeaponType`, `behaviours`, `blockingAngle`, `codexSecret`, `comboDuration`, `compatibilityTags`, `creditsCost`, `criticalChance`, `criticalMultiplier`, `damagePerShot`, `defaultUpgrades`, `description`, `donationStandingBonus`, `excludeFromCodex`, `excludeFromMarket`, `fireRate`, `followThrough`, `gunType`, `heavyAttackDamage`, `heavySlamAttack`, `heavySlamRadialDamage`, `heavySlamRadius`, `holsterCategory`, `icon`, `introducedAt`, `magazineSize`, `masteryReq`, `maxLevelCap`, `multishot`, `name`, `noise`, `omegaAttenuation`, `oneTimePurchasable`, `parentName`, `partType`, `platinumCost`, `primeOmegaAttenuation`, `procChance`, `productCategory`, `range`, `reloadTime`, `sentinel`, `slamAttack`, `slamRadialDamage`, `slamRadius`, `slideAttack`, `slot`, `totalDamage`, `tradable`, `trigger`, `variantType`, `windUp`。

截断预览：

```json
{
  "/Lotus/Weapons/VoidTrader/VTDetron": {
    "name": "/Lotus/Language/Items/VTDetronName",
    "parentName": "/Lotus/Weapons/Corpus/Pistols/CorpusHandShotgun/CorpusHandCannon",
    "icon": "/Lotus/Interface/Icons/StoreIcons/Weapons/SecondaryWeapons/Weapons/MaraDetron.png",
    "codexSecret": true,
    "damagePerShot": [
      0
    ],
    "totalDamage": 40
  }
}
```

### Plus 字典与关键关联

| 文件模式 | 内容 | 本包数量 | GitHub URL | browse.wf URL |
| --- | --- | --- | --- | --- |
| `dict.<lang>.json` | 完整语言键 → 对应语言文本 | 15 个语言文件，每份 36,165 键 | [15 个字典（仓库目录）](https://github.com/calamity-inc/warframe-public-export-plus/tree/8404b343a4ffb3e272564c24ee7abbfbd79445bc) | [15 个字典（在线目录）](https://browse.wf/warframe-public-export-plus/) |
| `supplementals/riven_unrollables.json` | 武器路径 → 不可洗出的紫卡词条标识数组 | 336 键 | [GitHub（本包提交）](https://github.com/calamity-inc/warframe-public-export-plus/blob/8404b343a4ffb3e272564c24ee7abbfbd79445bc/supplementals/riven_unrollables.json) | [在线 JSON](https://browse.wf/warframe-public-export-plus/supplementals/riven_unrollables.json) |

```python
objects = json.loads(Path('世界状态上游/git/warframe-public-export-plus/ExportResources.json').read_text())
dictionary = json.loads(Path('世界状态上游/git/warframe-public-export-plus/dict.zh.json').read_text())
for unique_name, item in objects.items():
    name_key = item.get('name')
    name = dictionary.get(name_key, name_key)
```

- `ExportRegions.rewardManifests`、`ExportRelics.rewardManifest` 等字段引用 `ExportRewards`。
- `ExportRecipes.resultType` 和材料引用内部物品类型；这类关联应保留完整路径。
- `ExportRewards` / `ExportVendors` 可能使用 `/Lotus/StoreItems/…` 商城类型；与 `/Lotus/…` 普通类型要按上游约定映射。
- 遗物奖励有按 `rarity` 表示的特殊情况，不能一律当成固定概率。
- `ExportImages` 的键是图标路径，`contentHash` 对应 `https://content.warframe.com/PublicExport` + 路径 + `!` + 哈希；本包含映射，不含所有图片二进制。
- `ExportWeapons` 也有模块部件，上游 README 用是否有 `behaviours` 区分可攻击武器。
- Plus README 说明战甲基础属性按 rank 0 口径，等级缩放可参考 `supplementals/getScaledPowersuitValues.js`。
- Plus README 说明氏族配方费用以月亮氏族为基准，不能不换算直接作为所有氏族价格。
- 同名物品、开发残留和隐藏条目可能并存；名称不适合作为唯一键。

## 3. Oracle：赏金/挑战清单与补充字典

路径：`git/wf.browse.oracle/`。

| 文件 | 具体内容 | 根/内部结构 | GitHub URL | browse.wf URL |
| --- | --- | --- | --- | --- |
| `data/EidolonJobManifest.json` | 希图斯/夜灵平野赏金、狩猎与地区任务定义 | `data.JobDifficultyTiers`：7；`data.HuntJobs`：2；`data.Jobs`：13；`data.ExtraJobs`：4；`data.LocationSpecificJobs`：3 | [GitHub（本包提交）](https://github.com/calamity-inc/wf.browse.oracle/blob/afb0f4b1de6a30d3bcb05901979d830aad848223/data/EidolonJobManifest.json) | — |
| `data/EntratiLabsJobManifest.json` | 源拓氏实验室挑战任务、难度与钢铁奖励表引用 | `data.ChallengeMissionNodes`：6；`data.ChallengeMissionDifficultyTiers`：5；`data.HardModeRewards`：/Lotus/Types/Game/MissionDecks/EntratiLabJobMissionReward/HardModeTableRewards | [GitHub（本包提交）](https://github.com/calamity-inc/wf.browse.oracle/blob/afb0f4b1de6a30d3bcb05901979d830aad848223/data/EntratiLabsJobManifest.json) | — |
| `data/ExportMissionTypes.json` | Oracle 任务类型索引与语言键；独立快照，数量可能与 Plus 不同 | 43 个任务类型键；值含 index、name | [GitHub（本包提交）](https://github.com/calamity-inc/wf.browse.oracle/blob/afb0f4b1de6a30d3bcb05901979d830aad848223/data/ExportMissionTypes.json) | — |
| `data/MicroplanetJobManifest.json` | 殁世幽都/魔胎之境赏金、隔离库与无尽任务定义 | `data.JobDifficultyTiers`：6；`data.Jobs`：7；`data.LocationSpecificJobs`：5；`data.EndlessJobs`：3；`data.VaultJobs`：2；`data.XpItemType`：/Lotus/Types/Items/Deimos/EntratiFragmentUncommonB | [GitHub（本包提交）](https://github.com/calamity-inc/wf.browse.oracle/blob/afb0f4b1de6a30d3bcb05901979d830aad848223/data/MicroplanetJobManifest.json) | — |
| `data/VenusJobManifest.json` | 福尔图娜/奥布山谷赏金、地区与固定任务定义 | `data.JobDifficultyTiers`：7；`data.Jobs`：23；`data.ExtraJobs`：4；`data.LocationSpecificJobs`：7；`data.PermanentJobs`：2 | [GitHub（本包提交）](https://github.com/calamity-inc/wf.browse.oracle/blob/afb0f4b1de6a30d3bcb05901979d830aad848223/data/VenusJobManifest.json) | — |
| `data/WF1999JobManifest.json` | 霍瓦尼亚/1999 挑战任务、难度与钢铁奖励表引用 | `data.ChallengeMissionNodes`：7；`data.ChallengeMissionDifficultyTiers`：7；`data.HardModeRewards`：/Lotus/Types/Game/MissionDecks/1999MissionRewards/HardModeTableRewards | [GitHub（本包提交）](https://github.com/calamity-inc/wf.browse.oracle/blob/afb0f4b1de6a30d3bcb05901979d830aad848223/data/WF1999JobManifest.json) | — |
| `data/ZarimanJobManifest.json` | 扎里曼挑战任务、难度与奖励/声望物品引用 | `data.ChallengeMissionNodes`：5；`data.ChallengeMissionDifficultyTiers`：5；`data.HardModeRewards`：/Lotus/Types/Game/MissionDecks/ZarimanMissionRewards/HardModeTableRewards；`data.XpItemType`：/Lotus/Types/Gameplay/Zariman/Resources/ZarimanDogTagBounty | [GitHub（本包提交）](https://github.com/calamity-inc/wf.browse.oracle/blob/afb0f4b1de6a30d3bcb05901979d830aad848223/data/ZarimanJobManifest.json) | — |

JobManifest 的根是 `{parent, data}`，`parent` 是继承类型，不能计为一条赏金。`JobDifficultyTiers` 是难度档，`Jobs` / `LocationSpecificJobs` 等是任务池；`rewardManifests` 是奖励表引用。静态任务池本身不说明哪条任务现在激活；周期推算需结合 Oracle `.pluto` 代码和实际动态输入。

| 其他文件 | 具体内容 | 数量 | GitHub URL | browse.wf URL |
| --- | --- | --- | --- | --- |
| `dicts/<lang>.json` | 科研等补充语言键 | 15 个文件，每份 227 键 | [15 个字典（目录）](https://github.com/calamity-inc/wf.browse.oracle/tree/afb0f4b1de6a30d3bcb05901979d830aad848223/dicts) | [在线字典目录](https://oracle.browse.wf/dicts/) |
| `redtext.json` | 红字广播历史记录，条目含 `data` 文本 | 402 条 | [GitHub（本包提交）](https://github.com/calamity-inc/wf.browse.oracle/blob/afb0f4b1de6a30d3bcb05901979d830aad848223/redtext.json) | [在线 JSON](https://oracle.browse.wf/redtext.json) |

Oracle `data/ExportMissionTypes.json` 有 43 键，Plus 的对应文件有 46 键，说明两个仓库版本和覆盖范围不同。

## 4. Plus 生成器输入与 browse.wf 配套文件

以下文件为生成器补充输入、应用配置或展示样例；不能把所有 `.json` 都合并为游戏物品。

| 相对路径 | 内容 | 结构/数量 | GitHub URL | browse.wf URL |
| --- | --- | --- | --- | --- |
| `git/browse.wf/package-lock.json` | npm 依赖锁定记录；不是游戏数据 | object 根长度 4；packages: 97 | [GitHub（本包提交）](https://github.com/calamity-inc/browse.wf/blob/d2ac3e2eff2f45583ef07b062d1317ca5e3c54b3/package-lock.json) | [在线 JSON](https://browse.wf/package-lock.json) |
| `git/browse.wf/package.json` | 项目名称、依赖和脚本配置；不是游戏数据 | object 根长度 3；scripts: 2；devDependencies: 8 | [GitHub（本包提交）](https://github.com/calamity-inc/browse.wf/blob/d2ac3e2eff2f45583ef07b062d1317ca5e3c54b3/package.json) | [在线 JSON](https://browse.wf/package.json) |
| `git/browse.wf/supplemental-data/glyphs.json` | 浮印的兑换码/创作者链接等补充信息 | object 根长度 482；逐键结构见 JSON文件结构清单.json | [GitHub（本包提交）](https://github.com/calamity-inc/browse.wf/blob/d2ac3e2eff2f45583ef07b062d1317ca5e3c54b3/supplemental-data/glyphs.json) | [在线 JSON](https://browse.wf/supplemental-data/glyphs.json) |
| `git/browse.wf/supplemental-data/profile-[DE]Rebecca.json` | 仓库自带公开玩家资料响应样例，含 Results、统计与配装；并非当前玩家数据库 | object 根长度 6；Results: 1；TechProjects: 0；XpComponents: 0；XpCacheExpiryDate: 1；Stats: 73 | [GitHub（本包提交）](https://github.com/calamity-inc/browse.wf/blob/d2ac3e2eff2f45583ef07b062d1317ca5e3c54b3/supplemental-data/profile-%5BDE%5DRebecca.json) | [在线 JSON](https://browse.wf/supplemental-data/profile-%5BDE%5DRebecca.json) |
| `git/browse.wf/tsconfig.json` | TypeScript 编译配置；带 // 注释，非严格 JSON | 带注释，严格 JSON 解析失败；保留上游原文件 | [GitHub（本包提交）](https://github.com/calamity-inc/browse.wf/blob/d2ac3e2eff2f45583ef07b062d1317ca5e3c54b3/tsconfig.json) | [在线 JSON](https://browse.wf/tsconfig.json) |
| `git/warframe-public-export-plus/package-lock.json` | npm 依赖锁定记录；不是游戏数据 | object 根长度 5；packages: 106 | [GitHub（本包提交）](https://github.com/calamity-inc/warframe-public-export-plus/blob/8404b343a4ffb3e272564c24ee7abbfbd79445bc/package-lock.json) | [在线 JSON](https://browse.wf/warframe-public-export-plus/package-lock.json) |
| `git/warframe-public-export-plus/package.json` | 项目名称、依赖和脚本配置；不是游戏数据 | object 根长度 7；exports: 1；repository: 2；devDependencies: 2 | [GitHub（本包提交）](https://github.com/calamity-inc/warframe-public-export-plus/blob/8404b343a4ffb3e272564c24ee7abbfbd79445bc/package.json) | [在线 JSON](https://browse.wf/warframe-public-export-plus/package.json) |
| `git/warframe-public-export-plus-gen/extras/ExportCodex.json` | 生成器输入：扫描对象与类型清单 | object 根长度 2；objects: 169；allTypes: 1180 | [GitHub（本包提交）](https://github.com/calamity-inc/warframe-public-export-plus-gen/blob/2df14d28507c996e95d50bec4464ea5ec74f2e92/extras/ExportCodex.json) | — |
| `git/warframe-public-export-plus-gen/extras/ExportUpgrades-missing.json` | 生成器输入：官方遗漏的 Mod 补丁；带 // 注释，非严格 JSON | 带注释，严格 JSON 解析失败；保留上游原文件 | [GitHub（本包提交）](https://github.com/calamity-inc/warframe-public-export-plus-gen/blob/2df14d28507c996e95d50bec4464ea5ec74f2e92/extras/ExportUpgrades-missing.json) | — |
| `git/warframe-public-export-plus-gen/extras/eFaction.json` | 生成器输入：阵营 ID、枚举 tag 和名称语言键 | array 根长度 12 | [GitHub（本包提交）](https://github.com/calamity-inc/warframe-public-export-plus-gen/blob/2df14d28507c996e95d50bec4464ea5ec74f2e92/extras/eFaction.json) | — |
| `git/warframe-public-export-plus-gen/extras/eMissionType.json` | 生成器输入：任务类型 ID、枚举 tag 和名称语言键 | array 根长度 46 | [GitHub（本包提交）](https://github.com/calamity-inc/warframe-public-export-plus-gen/blob/2df14d28507c996e95d50bec4464ea5ec74f2e92/extras/eMissionType.json) | — |
| `git/warframe-public-export-plus-gen/extras/gifting-bonuses.json` | 生成器输入：赠礼组合包对应的额外物品 | object 根长度 20 | [GitHub（本包提交）](https://github.com/calamity-inc/warframe-public-export-plus-gen/blob/2df14d28507c996e95d50bec4464ea5ec74f2e92/extras/gifting-bonuses.json) | — |
| `git/warframe-public-export-plus-gen/extras/palettes.json` | 生成器输入：调色板及颜色信息，GraphQL 响应形状 | object 根长度 1；data: 1 | [GitHub（本包提交）](https://github.com/calamity-inc/warframe-public-export-plus-gen/blob/2df14d28507c996e95d50bec4464ea5ec74f2e92/extras/palettes.json) | — |
| `git/warframe-public-export-plus-gen/extras/resource-supplementals.json` | 生成器输入：资源掉落数量范围等补充字段 | object 根长度 68；逐键结构见 JSON文件结构清单.json | [GitHub（本包提交）](https://github.com/calamity-inc/warframe-public-export-plus-gen/blob/2df14d28507c996e95d50bec4464ea5ec74f2e92/extras/resource-supplementals.json) | — |
| `git/warframe-public-export-plus-gen/extras/starchart-export.json` | 生成器输入：星图节点补充信息 | object 根长度 528；逐键结构见 JSON文件结构清单.json | [GitHub（本包提交）](https://github.com/calamity-inc/warframe-public-export-plus-gen/blob/2df14d28507c996e95d50bec4464ea5ec74f2e92/extras/starchart-export.json) | — |

特别说明：`git/warframe-public-export-plus-gen/extras/ExportCodex.json` 是生成器的 `objects/allTypes` 输入，与 Plus 最终四分组 `ExportCodex.json` 结构不同。`palettes.json` 是 `data.allPalettes.nodes` 形状，根键数 1 不能当作只有 1 套调色板。

两个非严格 JSON 文件为：

1. `git/browse.wf/tsconfig.json`：带注释的 TypeScript 配置。
2. `git/warframe-public-export-plus-gen/extras/ExportUpgrades-missing.json`：带注释的 Mod 补丁输入。

这里不删除注释、不改写上游仓库文件；严格 JSON 扫描将这两项显式标记。

## 5. 快照和完整索引

`snapshot-manifest.json` 根有 `schemaVersion`、`generatedAt`、`output`、`refresh`、`official`、`repositories`。其中 `official` 有 15 个语言记录，每个 `files` 有 16 个原始版本化文件；`repositories` 有 4 个 Git 来源记录。

完整逐文件清单见 [JSON文件清单.tsv](JSON文件清单.tsv)。可编程读取 [JSON文件结构清单.json](JSON文件结构清单.json)：每项含 `path`、`description`、`validJson`、`rootType`、`rootCount`、`sections`、`itemFields`、`sample` 和当前 `sha256`。`sample` 是裁剪的结构预览，读取业务时以原文件为准。

字段说明以随包数据实测为依据，没有把未出现字段写成固定合同；来源的额外语义说明取自随包 Plus README 和生成器代码。

## 6. 语言字典逐文件网址

下面逐项展开上文的语言占位文件名，提供真实可点击地址。

| Plus 文件 | GitHub URL | browse.wf URL |
| --- | --- | --- |
| `dict.de.json` | [GitHub（本包提交）](https://github.com/calamity-inc/warframe-public-export-plus/blob/8404b343a4ffb3e272564c24ee7abbfbd79445bc/dict.de.json) | [在线 JSON](https://browse.wf/warframe-public-export-plus/dict.de.json) |
| `dict.en.json` | [GitHub（本包提交）](https://github.com/calamity-inc/warframe-public-export-plus/blob/8404b343a4ffb3e272564c24ee7abbfbd79445bc/dict.en.json) | [在线 JSON](https://browse.wf/warframe-public-export-plus/dict.en.json) |
| `dict.es.json` | [GitHub（本包提交）](https://github.com/calamity-inc/warframe-public-export-plus/blob/8404b343a4ffb3e272564c24ee7abbfbd79445bc/dict.es.json) | [在线 JSON](https://browse.wf/warframe-public-export-plus/dict.es.json) |
| `dict.fr.json` | [GitHub（本包提交）](https://github.com/calamity-inc/warframe-public-export-plus/blob/8404b343a4ffb3e272564c24ee7abbfbd79445bc/dict.fr.json) | [在线 JSON](https://browse.wf/warframe-public-export-plus/dict.fr.json) |
| `dict.it.json` | [GitHub（本包提交）](https://github.com/calamity-inc/warframe-public-export-plus/blob/8404b343a4ffb3e272564c24ee7abbfbd79445bc/dict.it.json) | [在线 JSON](https://browse.wf/warframe-public-export-plus/dict.it.json) |
| `dict.ja.json` | [GitHub（本包提交）](https://github.com/calamity-inc/warframe-public-export-plus/blob/8404b343a4ffb3e272564c24ee7abbfbd79445bc/dict.ja.json) | [在线 JSON](https://browse.wf/warframe-public-export-plus/dict.ja.json) |
| `dict.ko.json` | [GitHub（本包提交）](https://github.com/calamity-inc/warframe-public-export-plus/blob/8404b343a4ffb3e272564c24ee7abbfbd79445bc/dict.ko.json) | [在线 JSON](https://browse.wf/warframe-public-export-plus/dict.ko.json) |
| `dict.pl.json` | [GitHub（本包提交）](https://github.com/calamity-inc/warframe-public-export-plus/blob/8404b343a4ffb3e272564c24ee7abbfbd79445bc/dict.pl.json) | [在线 JSON](https://browse.wf/warframe-public-export-plus/dict.pl.json) |
| `dict.pt.json` | [GitHub（本包提交）](https://github.com/calamity-inc/warframe-public-export-plus/blob/8404b343a4ffb3e272564c24ee7abbfbd79445bc/dict.pt.json) | [在线 JSON](https://browse.wf/warframe-public-export-plus/dict.pt.json) |
| `dict.ru.json` | [GitHub（本包提交）](https://github.com/calamity-inc/warframe-public-export-plus/blob/8404b343a4ffb3e272564c24ee7abbfbd79445bc/dict.ru.json) | [在线 JSON](https://browse.wf/warframe-public-export-plus/dict.ru.json) |
| `dict.tc.json` | [GitHub（本包提交）](https://github.com/calamity-inc/warframe-public-export-plus/blob/8404b343a4ffb3e272564c24ee7abbfbd79445bc/dict.tc.json) | [在线 JSON](https://browse.wf/warframe-public-export-plus/dict.tc.json) |
| `dict.th.json` | [GitHub（本包提交）](https://github.com/calamity-inc/warframe-public-export-plus/blob/8404b343a4ffb3e272564c24ee7abbfbd79445bc/dict.th.json) | [在线 JSON](https://browse.wf/warframe-public-export-plus/dict.th.json) |
| `dict.tr.json` | [GitHub（本包提交）](https://github.com/calamity-inc/warframe-public-export-plus/blob/8404b343a4ffb3e272564c24ee7abbfbd79445bc/dict.tr.json) | [在线 JSON](https://browse.wf/warframe-public-export-plus/dict.tr.json) |
| `dict.uk.json` | [GitHub（本包提交）](https://github.com/calamity-inc/warframe-public-export-plus/blob/8404b343a4ffb3e272564c24ee7abbfbd79445bc/dict.uk.json) | [在线 JSON](https://browse.wf/warframe-public-export-plus/dict.uk.json) |
| `dict.zh.json` | [GitHub（本包提交）](https://github.com/calamity-inc/warframe-public-export-plus/blob/8404b343a4ffb3e272564c24ee7abbfbd79445bc/dict.zh.json) | [在线 JSON](https://browse.wf/warframe-public-export-plus/dict.zh.json) |

| Oracle 文件 | GitHub URL | browse.wf URL |
| --- | --- | --- |
| `dicts/de.json` | [GitHub（本包提交）](https://github.com/calamity-inc/wf.browse.oracle/blob/afb0f4b1de6a30d3bcb05901979d830aad848223/dicts/de.json) | [在线 JSON](https://oracle.browse.wf/dicts/de.json) |
| `dicts/en.json` | [GitHub（本包提交）](https://github.com/calamity-inc/wf.browse.oracle/blob/afb0f4b1de6a30d3bcb05901979d830aad848223/dicts/en.json) | [在线 JSON](https://oracle.browse.wf/dicts/en.json) |
| `dicts/es.json` | [GitHub（本包提交）](https://github.com/calamity-inc/wf.browse.oracle/blob/afb0f4b1de6a30d3bcb05901979d830aad848223/dicts/es.json) | [在线 JSON](https://oracle.browse.wf/dicts/es.json) |
| `dicts/fr.json` | [GitHub（本包提交）](https://github.com/calamity-inc/wf.browse.oracle/blob/afb0f4b1de6a30d3bcb05901979d830aad848223/dicts/fr.json) | [在线 JSON](https://oracle.browse.wf/dicts/fr.json) |
| `dicts/it.json` | [GitHub（本包提交）](https://github.com/calamity-inc/wf.browse.oracle/blob/afb0f4b1de6a30d3bcb05901979d830aad848223/dicts/it.json) | [在线 JSON](https://oracle.browse.wf/dicts/it.json) |
| `dicts/ja.json` | [GitHub（本包提交）](https://github.com/calamity-inc/wf.browse.oracle/blob/afb0f4b1de6a30d3bcb05901979d830aad848223/dicts/ja.json) | [在线 JSON](https://oracle.browse.wf/dicts/ja.json) |
| `dicts/ko.json` | [GitHub（本包提交）](https://github.com/calamity-inc/wf.browse.oracle/blob/afb0f4b1de6a30d3bcb05901979d830aad848223/dicts/ko.json) | [在线 JSON](https://oracle.browse.wf/dicts/ko.json) |
| `dicts/pl.json` | [GitHub（本包提交）](https://github.com/calamity-inc/wf.browse.oracle/blob/afb0f4b1de6a30d3bcb05901979d830aad848223/dicts/pl.json) | [在线 JSON](https://oracle.browse.wf/dicts/pl.json) |
| `dicts/pt.json` | [GitHub（本包提交）](https://github.com/calamity-inc/wf.browse.oracle/blob/afb0f4b1de6a30d3bcb05901979d830aad848223/dicts/pt.json) | [在线 JSON](https://oracle.browse.wf/dicts/pt.json) |
| `dicts/ru.json` | [GitHub（本包提交）](https://github.com/calamity-inc/wf.browse.oracle/blob/afb0f4b1de6a30d3bcb05901979d830aad848223/dicts/ru.json) | [在线 JSON](https://oracle.browse.wf/dicts/ru.json) |
| `dicts/tc.json` | [GitHub（本包提交）](https://github.com/calamity-inc/wf.browse.oracle/blob/afb0f4b1de6a30d3bcb05901979d830aad848223/dicts/tc.json) | [在线 JSON](https://oracle.browse.wf/dicts/tc.json) |
| `dicts/th.json` | [GitHub（本包提交）](https://github.com/calamity-inc/wf.browse.oracle/blob/afb0f4b1de6a30d3bcb05901979d830aad848223/dicts/th.json) | [在线 JSON](https://oracle.browse.wf/dicts/th.json) |
| `dicts/tr.json` | [GitHub（本包提交）](https://github.com/calamity-inc/wf.browse.oracle/blob/afb0f4b1de6a30d3bcb05901979d830aad848223/dicts/tr.json) | [在线 JSON](https://oracle.browse.wf/dicts/tr.json) |
| `dicts/uk.json` | [GitHub（本包提交）](https://github.com/calamity-inc/wf.browse.oracle/blob/afb0f4b1de6a30d3bcb05901979d830aad848223/dicts/uk.json) | [在线 JSON](https://oracle.browse.wf/dicts/uk.json) |
| `dicts/zh.json` | [GitHub（本包提交）](https://github.com/calamity-inc/wf.browse.oracle/blob/afb0f4b1de6a30d3bcb05901979d830aad848223/dicts/zh.json) | [在线 JSON](https://oracle.browse.wf/dicts/zh.json) |

Oracle `data/*.json` 的在线地址本次全部返回 HTTP 403，因此保留 GitHub 固定提交链接，browse.wf 列留“—”；不把需要执行的赏金服务结果冒充静态 JobManifest。Plus 生成器也没有已确认的 browse.wf 同目录部署。

完整 339 个文件的两个 URL 已同步加入 `JSON文件清单.tsv`，并写入 `JSON文件结构清单.json` 的 `githubUrl` / `browseWfUrl` 字段；官方原始下载地址另记在 `officialSourceUrl`。

## 7. WFCD Items：无图片的固定提交快照

路径：`wfcd-items/`。来源为 [WFCD/warframe-items](https://github.com/WFCD/warframe-items)，固定提交 [`20f8d9427a5a62268817853eefd8962d18c0b70e`](https://github.com/WFCD/warframe-items/commit/20f8d9427a5a62268817853eefd8962d18c0b70e)，提交时间 `2026-10-18T02:44:10Z`，获取时间 `2026-10-19T15:22:01.366324+00:00`。

本包保留该提交全部 153 个非图片的受版本管理文件：分类数据、语言数据、构建代码、配置、README 和许可证，共 101,250,492 字节。不保留 `.git`，以免历史图片对象进入资料包；排除 12,544 个图片载体（含内嵌 SVG 的 `data/logo.json`），共 624,026,156 字节。其余 JSON 中的 `imageName`、图片路径、图片哈希和文本形式的索引保留；这些字段不包含图片内容。

### 分类物品文件

以下是本包实际文件（不假设仓库必须存在 `All.json`）。根为数组时，数量是数组长度。组件引用可能指向 `Components.json`，不把跨分类引用重复算成新增物品。

| 文件 | 内容 | 根类型/条目数 | 常见条目字段（最多展示 14 个；完整字段见结构清单） | GitHub URL | browse.wf URL |
| --- | --- | --- | --- | --- | --- |
| `data/json/Arcanes.json` | WFCD 分类物品数据：赋能 | array / 172 | `buildPrice`, `buildQuantity`, `buildTime`, `category`, `codexSecret`, `components`, `consumeOnBuild`, `drops`, `excludeFromCodex`, `imageName`, `introduced`, `levelStats`, `masterable`, `name` | [固定提交](https://github.com/WFCD/warframe-items/blob/20f8d9427a5a62268817853eefd8962d18c0b70e/data/json/Arcanes.json) | — |
| `data/json/Arch-Gun.json` | WFCD 分类物品数据：Archwing 枪械 | array / 20 | `accuracy`, `attacks`, `bpCost`, `buildPrice`, `buildQuantity`, `buildTime`, `category`, `codexSecret`, `components`, `consumeOnBuild`, `criticalChance`, `criticalMultiplier`, `damage`, `damagePerShot` | [固定提交](https://github.com/WFCD/warframe-items/blob/20f8d9427a5a62268817853eefd8962d18c0b70e/data/json/Arch-Gun.json) | — |
| `data/json/Arch-Melee.json` | WFCD 分类物品数据：Archwing 近战 | array / 9 | `attacks`, `blockingAngle`, `bpCost`, `buildPrice`, `buildQuantity`, `buildTime`, `category`, `codexSecret`, `comboDuration`, `components`, `consumeOnBuild`, `criticalChance`, `criticalMultiplier`, `damage` | [固定提交](https://github.com/WFCD/warframe-items/blob/20f8d9427a5a62268817853eefd8962d18c0b70e/data/json/Arch-Melee.json) | — |
| `data/json/Archwing.json` | WFCD 分类物品数据：Archwing | array / 5 | `abilities`, `armor`, `buildPrice`, `buildQuantity`, `buildTime`, `category`, `codexSecret`, `color`, `components`, `conclave`, `consumeOnBuild`, `description`, `estimatedVaultDate`, `health` | [固定提交](https://github.com/WFCD/warframe-items/blob/20f8d9427a5a62268817853eefd8962d18c0b70e/data/json/Archwing.json) | — |
| `data/json/Components.json` | WFCD 分类物品数据：去重的制造部件目录 | array / 2225 | `category`, `codexSecret`, `description`, `drops`, `ducats`, `excludeFromCodex`, `imageName`, `masterable`, `name`, `parentUniqueNames`, `primeSellingPrice`, `tradable`, `uniqueName` | [固定提交](https://github.com/WFCD/warframe-items/blob/20f8d9427a5a62268817853eefd8962d18c0b70e/data/json/Components.json) | — |
| `data/json/Enemy.json` | WFCD 分类物品数据：敌人/NPC | array / 638 | `armor`, `category`, `description`, `drops`, `faction`, `health`, `imageName`, `name`, `patchlogs`, `regionBits`, `resistances`, `shield`, `tradable`, `type` | [固定提交](https://github.com/WFCD/warframe-items/blob/20f8d9427a5a62268817853eefd8962d18c0b70e/data/json/Enemy.json) | — |
| `data/json/Fish.json` | WFCD 分类物品数据：鱼类 | array / 126 | `category`, `codexSecret`, `description`, `drops`, `excludeFromCodex`, `imageName`, `masterable`, `name`, `parentUniqueNames`, `tradable`, `type`, `uniqueName` | [固定提交](https://github.com/WFCD/warframe-items/blob/20f8d9427a5a62268817853eefd8962d18c0b70e/data/json/Fish.json) | — |
| `data/json/Gear.json` | WFCD 分类物品数据：装备轮盘道具 | array / 184 | `buildPrice`, `buildQuantity`, `buildTime`, `category`, `codexSecret`, `components`, `consumeOnBuild`, `description`, `drops`, `imageName`, `masterable`, `name`, `parentUniqueNames`, `skipBuildTimePrice` | [固定提交](https://github.com/WFCD/warframe-items/blob/20f8d9427a5a62268817853eefd8962d18c0b70e/data/json/Gear.json) | — |
| `data/json/Glyphs.json` | WFCD 分类物品数据：浮印 | array / 1723 | `category`, `codexSecret`, `description`, `drops`, `excludeFromCodex`, `imageName`, `masterable`, `name`, `tradable`, `type`, `uniqueName` | [固定提交](https://github.com/WFCD/warframe-items/blob/20f8d9427a5a62268817853eefd8962d18c0b70e/data/json/Glyphs.json) | — |
| `data/json/Honoria.json` | WFCD 分类物品数据：荣誉头衔 | array / 219 | `category`, `codexSecret`, `description`, `excludeFromCodex`, `imageName`, `masterable`, `name`, `price`, `req`, `tags`, `title`, `titleAffix`, `tradable`, `type` | [固定提交](https://github.com/WFCD/warframe-items/blob/20f8d9427a5a62268817853eefd8962d18c0b70e/data/json/Honoria.json) | — |
| `data/json/Melee.json` | WFCD 分类物品数据：近战武器 | array / 269 | `attacks`, `blockingAngle`, `bpCost`, `buildPrice`, `buildQuantity`, `buildTime`, `category`, `codexSecret`, `comboDuration`, `components`, `consumeOnBuild`, `criticalChance`, `criticalMultiplier`, `damage` | [固定提交](https://github.com/WFCD/warframe-items/blob/20f8d9427a5a62268817853eefd8962d18c0b70e/data/json/Melee.json) | — |
| `data/json/Misc.json` | WFCD 分类物品数据：其他物品 | array / 1264 | `accuracy`, `attacks`, `binCapacity`, `binCount`, `blockingAngle`, `buildPrice`, `buildQuantity`, `buildTime`, `capacityMultiplier`, `category`, `codexSecret`, `comboDuration`, `components`, `consumeOnBuild` | [固定提交](https://github.com/WFCD/warframe-items/blob/20f8d9427a5a62268817853eefd8962d18c0b70e/data/json/Misc.json) | — |
| `data/json/Mods.json` | WFCD 分类物品数据：Mod | array / 1809 | `availableChallenges`, `baseDrain`, `buffSet`, `category`, `codexSecret`, `compatName`, `description`, `drops`, `excludeFromCodex`, `fusionLimit`, `imageName`, `introduced`, `isAugment`, `isExilus` | [固定提交](https://github.com/WFCD/warframe-items/blob/20f8d9427a5a62268817853eefd8962d18c0b70e/data/json/Mods.json) | — |
| `data/json/Node.json` | WFCD 分类物品数据：星图节点 | array / 269 | `category`, `drops`, `factionIndex`, `masterable`, `masteryReq`, `maxEnemyLevel`, `minEnemyLevel`, `missionIndex`, `name`, `nodeType`, `systemIndex`, `systemName`, `tradable`, `type` | [固定提交](https://github.com/WFCD/warframe-items/blob/20f8d9427a5a62268817853eefd8962d18c0b70e/data/json/Node.json) | — |
| `data/json/Pets.json` | WFCD 分类物品数据：兽类伙伴 | array / 66 | `armor`, `buildPrice`, `buildQuantity`, `buildTime`, `category`, `codexSecret`, `components`, `consumeOnBuild`, `criticalChance`, `criticalMultiplier`, `damage`, `damagePerShot`, `description`, `estimatedVaultDate` | [固定提交](https://github.com/WFCD/warframe-items/blob/20f8d9427a5a62268817853eefd8962d18c0b70e/data/json/Pets.json) | — |
| `data/json/Primary.json` | WFCD 分类物品数据：主武器 | array / 197 | `accuracy`, `attacks`, `bpCost`, `buildPrice`, `buildQuantity`, `buildTime`, `category`, `codexSecret`, `components`, `consumeOnBuild`, `criticalChance`, `criticalMultiplier`, `damage`, `damagePerShot` | [固定提交](https://github.com/WFCD/warframe-items/blob/20f8d9427a5a62268817853eefd8962d18c0b70e/data/json/Primary.json) | — |
| `data/json/Quests.json` | WFCD 分类物品数据：系列任务 | array / 49 | `buildPrice`, `buildQuantity`, `buildTime`, `category`, `codexSecret`, `components`, `consumeOnBuild`, `description`, `drops`, `excludeFromCodex`, `imageName`, `masterable`, `name`, `skipBuildTimePrice` | [固定提交](https://github.com/WFCD/warframe-items/blob/20f8d9427a5a62268817853eefd8962d18c0b70e/data/json/Quests.json) | — |
| `data/json/Railjack.json` | WFCD 分类物品数据：航道星舰资料 | array / 143 | `accuracy`, `category`, `codexSecret`, `criticalChance`, `criticalMultiplier`, `damage`, `damagePerShot`, `description`, `drops`, `excludeFromCodex`, `fireRate`, `imageName`, `magazineSize`, `masterable` | [固定提交](https://github.com/WFCD/warframe-items/blob/20f8d9427a5a62268817853eefd8962d18c0b70e/data/json/Railjack.json) | — |
| `data/json/Relics.json` | WFCD 分类物品数据：遗物 | array / 3204 | `category`, `codexSecret`, `description`, `drops`, `excludeFromCodex`, `imageName`, `locations`, `marketInfo`, `masterable`, `name`, `rewards`, `tradable`, `type`, `uniqueName` | [固定提交](https://github.com/WFCD/warframe-items/blob/20f8d9427a5a62268817853eefd8962d18c0b70e/data/json/Relics.json) | — |
| `data/json/Resources.json` | WFCD 分类物品数据：资源 | array / 242 | `buildPrice`, `buildQuantity`, `buildTime`, `category`, `codexSecret`, `components`, `consumeOnBuild`, `description`, `drops`, `excludeFromCodex`, `imageName`, `itemCount`, `masterable`, `name` | [固定提交](https://github.com/WFCD/warframe-items/blob/20f8d9427a5a62268817853eefd8962d18c0b70e/data/json/Resources.json) | — |
| `data/json/Secondary.json` | WFCD 分类物品数据：副武器 | array / 149 | `accuracy`, `attacks`, `bpCost`, `buildPrice`, `buildQuantity`, `buildTime`, `category`, `codexSecret`, `components`, `consumeOnBuild`, `criticalChance`, `criticalMultiplier`, `damage`, `damagePerShot` | [固定提交](https://github.com/WFCD/warframe-items/blob/20f8d9427a5a62268817853eefd8962d18c0b70e/data/json/Secondary.json) | — |
| `data/json/SentinelWeapons.json` | WFCD 分类物品数据：守护武器 | array / 24 | `accuracy`, `attacks`, `blockingAngle`, `buildPrice`, `buildQuantity`, `buildTime`, `category`, `codexSecret`, `components`, `consumeOnBuild`, `criticalChance`, `criticalMultiplier`, `damage`, `damagePerShot` | [固定提交](https://github.com/WFCD/warframe-items/blob/20f8d9427a5a62268817853eefd8962d18c0b70e/data/json/SentinelWeapons.json) | — |
| `data/json/Sentinels.json` | WFCD 分类物品数据：守护 | array / 17 | `armor`, `buildPrice`, `buildQuantity`, `buildTime`, `category`, `codexSecret`, `components`, `consumeOnBuild`, `description`, `estimatedVaultDate`, `health`, `imageName`, `introduced`, `isPrime` | [固定提交](https://github.com/WFCD/warframe-items/blob/20f8d9427a5a62268817853eefd8962d18c0b70e/data/json/Sentinels.json) | — |
| `data/json/Sigils.json` | WFCD 分类物品数据：饰纹 | array / 337 | `category`, `codexSecret`, `description`, `drops`, `excludeFromCodex`, `imageName`, `masterable`, `name`, `tradable`, `type`, `uniqueName` | [固定提交](https://github.com/WFCD/warframe-items/blob/20f8d9427a5a62268817853eefd8962d18c0b70e/data/json/Sigils.json) | — |
| `data/json/Skins.json` | WFCD 分类物品数据：外观/皮肤 | array / 6677 | `buildPrice`, `buildQuantity`, `buildTime`, `category`, `codexSecret`, `components`, `consumeOnBuild`, `description`, `drops`, `excludeFromCodex`, `hexColours`, `imageName`, `itemCount`, `masterable` | [固定提交](https://github.com/WFCD/warframe-items/blob/20f8d9427a5a62268817853eefd8962d18c0b70e/data/json/Skins.json) | — |
| `data/json/Warframes.json` | WFCD 分类物品数据：战甲及相关可装备单位 | array / 123 | `abilities`, `armor`, `aura`, `bpCost`, `buildPrice`, `buildQuantity`, `buildTime`, `category`, `codexSecret`, `color`, `components`, `conclave`, `consumeOnBuild`, `description` | [固定提交](https://github.com/WFCD/warframe-items/blob/20f8d9427a5a62268817853eefd8962d18c0b70e/data/json/Warframes.json) | — |

### 语言数据

语言文件按物品内部路径组织本地化字段，不能把语言记录数直接视为主物品总数。

| 文件 | 根类型/长度 | 条目字段 | GitHub URL | browse.wf URL |
| --- | --- | --- | --- | --- |
| `data/json/i18n/de.json` | object / 19505 | `abilities`, `description`, `levelStats`, `name`, `passiveDescription`, `systemName`, `trigger` | [固定提交](https://github.com/WFCD/warframe-items/blob/20f8d9427a5a62268817853eefd8962d18c0b70e/data/json/i18n/de.json) | — |
| `data/json/i18n/es.json` | object / 19505 | `abilities`, `description`, `levelStats`, `name`, `passiveDescription`, `systemName`, `trigger` | [固定提交](https://github.com/WFCD/warframe-items/blob/20f8d9427a5a62268817853eefd8962d18c0b70e/data/json/i18n/es.json) | — |
| `data/json/i18n/fr.json` | object / 19505 | `abilities`, `description`, `levelStats`, `name`, `passiveDescription`, `systemName`, `trigger` | [固定提交](https://github.com/WFCD/warframe-items/blob/20f8d9427a5a62268817853eefd8962d18c0b70e/data/json/i18n/fr.json) | — |
| `data/json/i18n/it.json` | object / 19505 | `abilities`, `description`, `levelStats`, `name`, `passiveDescription`, `systemName`, `trigger` | [固定提交](https://github.com/WFCD/warframe-items/blob/20f8d9427a5a62268817853eefd8962d18c0b70e/data/json/i18n/it.json) | — |
| `data/json/i18n/ja.json` | object / 19505 | `abilities`, `description`, `levelStats`, `name`, `passiveDescription`, `systemName`, `trigger` | [固定提交](https://github.com/WFCD/warframe-items/blob/20f8d9427a5a62268817853eefd8962d18c0b70e/data/json/i18n/ja.json) | — |
| `data/json/i18n/ko.json` | object / 19505 | `abilities`, `description`, `levelStats`, `name`, `passiveDescription`, `systemName`, `trigger` | [固定提交](https://github.com/WFCD/warframe-items/blob/20f8d9427a5a62268817853eefd8962d18c0b70e/data/json/i18n/ko.json) | — |
| `data/json/i18n/pl.json` | object / 19505 | `abilities`, `description`, `levelStats`, `name`, `passiveDescription`, `systemName`, `trigger` | [固定提交](https://github.com/WFCD/warframe-items/blob/20f8d9427a5a62268817853eefd8962d18c0b70e/data/json/i18n/pl.json) | — |
| `data/json/i18n/pt.json` | object / 19505 | `abilities`, `description`, `levelStats`, `name`, `passiveDescription`, `systemName`, `trigger` | [固定提交](https://github.com/WFCD/warframe-items/blob/20f8d9427a5a62268817853eefd8962d18c0b70e/data/json/i18n/pt.json) | — |
| `data/json/i18n/ru.json` | object / 19505 | `abilities`, `description`, `levelStats`, `name`, `passiveDescription`, `systemName`, `trigger` | [固定提交](https://github.com/WFCD/warframe-items/blob/20f8d9427a5a62268817853eefd8962d18c0b70e/data/json/i18n/ru.json) | — |
| `data/json/i18n/tc.json` | object / 19505 | `abilities`, `description`, `levelStats`, `name`, `passiveDescription`, `systemName`, `trigger` | [固定提交](https://github.com/WFCD/warframe-items/blob/20f8d9427a5a62268817853eefd8962d18c0b70e/data/json/i18n/tc.json) | — |
| `data/json/i18n/th.json` | object / 19505 | `abilities`, `description`, `levelStats`, `name`, `passiveDescription`, `systemName`, `trigger` | [固定提交](https://github.com/WFCD/warframe-items/blob/20f8d9427a5a62268817853eefd8962d18c0b70e/data/json/i18n/th.json) | — |
| `data/json/i18n/tr.json` | object / 19505 | `abilities`, `description`, `levelStats`, `name`, `passiveDescription`, `systemName`, `trigger` | [固定提交](https://github.com/WFCD/warframe-items/blob/20f8d9427a5a62268817853eefd8962d18c0b70e/data/json/i18n/tr.json) | — |
| `data/json/i18n/uk.json` | object / 19505 | `abilities`, `description`, `levelStats`, `name`, `passiveDescription`, `systemName`, `trigger` | [固定提交](https://github.com/WFCD/warframe-items/blob/20f8d9427a5a62268817853eefd8962d18c0b70e/data/json/i18n/uk.json) | — |
| `data/json/i18n/zh.json` | object / 19505 | `abilities`, `description`, `levelStats`, `name`, `passiveDescription`, `systemName`, `trigger` | [固定提交](https://github.com/WFCD/warframe-items/blob/20f8d9427a5a62268817853eefd8962d18c0b70e/data/json/i18n/zh.json) | — |

### 构建、缓存与配置 JSON

| 文件 | 内容 | 结构/数量 | GitHub URL | browse.wf URL |
| --- | --- | --- | --- | --- |
| `.babelrc.json` | WFCD 编译或工具配置：.babelrc.json | object / 2 | [固定提交](https://github.com/WFCD/warframe-items/blob/20f8d9427a5a62268817853eefd8962d18c0b70e/.babelrc.json) | — |
| `build/package.json` | WFCD 项目/构建包元信息、依赖及脚本 | object / 4 | [固定提交](https://github.com/WFCD/warframe-items/blob/20f8d9427a5a62268817853eefd8962d18c0b70e/build/package.json) | — |
| `build/tsconfig.json` | WFCD 编译或工具配置：build/tsconfig.json | object / 3 | [固定提交](https://github.com/WFCD/warframe-items/blob/20f8d9427a5a62268817853eefd8962d18c0b70e/build/tsconfig.json) | — |
| `config/bpConflicts.json` | WFCD 构建配置：bpConflicts | array / 2 | [固定提交](https://github.com/WFCD/warframe-items/blob/20f8d9427a5a62268817853eefd8962d18c0b70e/config/bpConflicts.json) | — |
| `config/damageTypes.json` | WFCD 构建配置：damageTypes | array / 20 | [固定提交](https://github.com/WFCD/warframe-items/blob/20f8d9427a5a62268817853eefd8962d18c0b70e/config/damageTypes.json) | — |
| `config/dropLocations.json` | WFCD 构建配置：dropLocations | array / 13 | [固定提交](https://github.com/WFCD/warframe-items/blob/20f8d9427a5a62268817853eefd8962d18c0b70e/config/dropLocations.json) | — |
| `config/dt_map.json` | WFCD 构建配置：dt_map | object / 14 | [固定提交](https://github.com/WFCD/warframe-items/blob/20f8d9427a5a62268817853eefd8962d18c0b70e/config/dt_map.json) | — |
| `config/endpoints.json` | WFCD 构建配置：endpoints | array / 13 | [固定提交](https://github.com/WFCD/warframe-items/blob/20f8d9427a5a62268817853eefd8962d18c0b70e/config/endpoints.json) | — |
| `config/itemTypes.json` | WFCD 构建配置：itemTypes | array / 301 | [固定提交](https://github.com/WFCD/warframe-items/blob/20f8d9427a5a62268817853eefd8962d18c0b70e/config/itemTypes.json) | — |
| `config/locales.json` | WFCD 构建配置：locales | array / 14 | [固定提交](https://github.com/WFCD/warframe-items/blob/20f8d9427a5a62268817853eefd8962d18c0b70e/config/locales.json) | — |
| `config/masterableCategories.json` | WFCD 构建配置：masterableCategories | object / 2 | [固定提交](https://github.com/WFCD/warframe-items/blob/20f8d9427a5a62268817853eefd8962d18c0b70e/config/masterableCategories.json) | — |
| `config/overrides.json` | WFCD 构建配置：overrides | object / 116 | [固定提交](https://github.com/WFCD/warframe-items/blob/20f8d9427a5a62268817853eefd8962d18c0b70e/config/overrides.json) | — |
| `config/polarities.json` | WFCD 构建配置：polarities | array / 9 | [固定提交](https://github.com/WFCD/warframe-items/blob/20f8d9427a5a62268817853eefd8962d18c0b70e/config/polarities.json) | — |
| `config/relicGrades.json` | WFCD 构建配置：relicGrades | array / 4 | [固定提交](https://github.com/WFCD/warframe-items/blob/20f8d9427a5a62268817853eefd8962d18c0b70e/config/relicGrades.json) | — |
| `config/variants.json` | WFCD 构建配置：variants | object / 2 | [固定提交](https://github.com/WFCD/warframe-items/blob/20f8d9427a5a62268817853eefd8962d18c0b70e/config/variants.json) | — |
| `config/wikiaNameOverrides.json` | WFCD 构建配置：wikiaNameOverrides | array / 1 | [固定提交](https://github.com/WFCD/warframe-items/blob/20f8d9427a5a62268817853eefd8962d18c0b70e/config/wikiaNameOverrides.json) | — |
| `data/cache/.export.json` | 官方 Manifest 的版本哈希缓存索引 | object / 228 | [固定提交](https://github.com/WFCD/warframe-items/blob/20f8d9427a5a62268817853eefd8962d18c0b70e/data/cache/.export.json) | — |
| `data/cache/.images.json` | 图片源哈希索引（纯 JSON 元数据，不含图片文件） | array / 12982 | [固定提交](https://github.com/WFCD/warframe-items/blob/20f8d9427a5a62268817853eefd8962d18c0b70e/data/cache/.images.json) | — |
| `data/warnings.json` | 上游数据构建警告记录 | object / 12 | [固定提交](https://github.com/WFCD/warframe-items/blob/20f8d9427a5a62268817853eefd8962d18c0b70e/data/warnings.json) | — |
| `package-lock.json` | WFCD npm 依赖锁定 | object / 6 | [固定提交](https://github.com/WFCD/warframe-items/blob/20f8d9427a5a62268817853eefd8962d18c0b70e/package-lock.json) | — |
| `package.json` | WFCD 项目/构建包元信息、依赖及脚本 | object / 18 | [固定提交](https://github.com/WFCD/warframe-items/blob/20f8d9427a5a62268817853eefd8962d18c0b70e/package.json) | — |
| `tsconfig.json` | WFCD 编译或工具配置：tsconfig.json | object / 3 | [固定提交](https://github.com/WFCD/warframe-items/blob/20f8d9427a5a62268817853eefd8962d18c0b70e/tsconfig.json) | — |
| `tsconfig.schema.json` | WFCD 编译或工具配置：tsconfig.schema.json | object / 2 | [固定提交](https://github.com/WFCD/warframe-items/blob/20f8d9427a5a62268817853eefd8962d18c0b70e/tsconfig.schema.json) | — |

随包的 `wfcd-items-snapshot.json` 是本次新增的来源记录：记录固定提交、153 个保留文件的 Git blob SHA-1 与 SHA-256、12544 个已排除图片的路径和原大小。排除清单只有文字，不保存被排除的图片内容。原始 `snapshot-manifest.json` 的官方数据与四仓库记录保持原样。

此快照按原始文件字节保存，未执行 npm 安装、构建、图片下载或上游脚本。源码里的图片下载逻辑作为代码保留；运行上游构建命令可能另行下载图片，不属于本次缓存操作。未找到已确认的 browse.wf 同项目直链，因此相应列留“—”。
