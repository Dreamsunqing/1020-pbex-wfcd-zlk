# Wiki 全站图片归档与访问许可

## 当前执行约定（2026-10-27）

用户明确要求“不等了，直接下吧”，替代此前等待站方许可的执行安排。现已启用独立后台配置 `userRequestedDownload:true`，记录实际指示及时间；不存在或生成任何站方许可文件。报告、策略审计以 `authorizationKind:"user-requested"`、`siteConsentObtained:false` 标明真实依据，不把用户指示伪称站方批准。下文2026-10-26的等待许可说明保留为历史。

命令行可显式运行 `node 工具/19-获取全部Wiki图片.mjs --download --user-requested`，默认命令仍只做离线预检；已有真实站方许可仍走 `--consent` 并遵守其限制。`--user-requested` 不解除robots、原始字节核验、共享更新锁或限流暂停，也不会使用失效或损坏的许可文件。

后台继续用含邮箱与用途说明的真实User-Agent，单连接随机3–10秒，服从更慢的robots间隔；403和内容异常停止人工复核，429/503保存冷却。零点自动化也已更新为检查实际下载进度，不再因缺站方许可恢复等待。

实际下载发现 Cloudflare Polish 会压缩部分图片。源 MIME、大小、SHA1 全部一致的响应记录 `original:true`；只有响应明确带有 Polish 转换状态、图片格式签名有效且大小未超过源记录时，才作为 `deliveryVariant:true` 保存，单独记录源 SHA1/大小/MIME、实收 SHA1/SHA256 和服务器转换头。此类文件不标为源原件；无转换证据的内容差异仍暂停人工复核。续传重新验证本地实收字节，复用已归档的转换版本。

2026-10-26。入口 `工具/19-获取全部Wiki图片.mjs`，实现 `scripts/archive-wiki-images.mjs`。从工具15的独立 Wiki 图库及内容哈希约定扩展到全站图片归档；不新增物品映射，不修改原始目录和现有 `index.json`。本轮用户确认尚无站方许可，先完成脚本与离线预检，未执行批量下载。

## 先遵守站方规则

本轮检查的 [Weird Gloop 使用条款](https://weirdgloop.org/terms/)（页面注明 2025-01-31 更新），Conduct → Misusing our services 明确要求自动化使用站点前取得同意。低并发、公开原图地址、robots 没有禁止某个路径，都不能代替这项同意。

本轮实际读取 [Wiki robots.txt](https://wiki.warframe.com/robots.txt)，通用规则包含 `Disallow: /*api.php`，并禁止 Special、action 查询等路径；针对多个 AI 爬虫另设整站禁止。不得通过更换身份、轮换 IP 或挑战绕过规避限制。新工具不请求 API，不重新枚举站点，只使用已有的完整本地目录；下载时以真实项目身份发送 User-Agent，重新检查该身份对应的 robots 规则，禁止的路径立即停止。

未查到该 Wiki 对本用途公开承诺的数值速率上限。按用户要求，脚本采用单连接、上一次请求结束后随机等待3–10秒（毫秒级均匀分布）。下限取 `max(3秒, 站方许可间隔, 适用robots的Crawl-delay)`，上限取 `max(10秒, 下限)`：例如要求6秒时随机6–10秒，要求12秒时固定至少12秒。此设置不代表站方许可，也不保证不会被限流。许可另有流量、时段或范围要求时，应先调整脚本满足要求，再运行。

2026-10-26 按用户要求将联系邮箱和英文用途加入19的所有网络请求头：

```text
SourceWorkbenchWikiArchive/1.0 (+https://github.com/Dreamsunqing/1020-pbex-wfcd-zlk; contact: dream_demo@outlook.com; slow image downloads for personal use only, to practice creating video assets)
```

含义：慢速获取图片，仅本人用于练习制作视频素材。此说明用于真实标识请求用途，不代替站方同意。

### 下载时间估算

当前采用随机3–10秒，平均6.5秒。54,515份唯一文件的预期等待时间约98.4小时（4.1天）；若平均每份请求与传输耗时1秒，总计约113.6小时（4.7天）；若平均2秒，总计约128.7小时（5.4天）。均假设24小时连续运行，另加校验、写盘及限流停顿。站方要求更慢时，按上文调整后的随机区间均值重算。

以下保留固定间隔的对照情景：

基于本轮离线预检的54,515份待下载唯一内容、约28.21 GB。有效等待间隔取 `max(3秒, 站方许可间隔, 适用robots的Crawl-delay)`，每份文件串行下载后再等待。总耗时约为 `文件数 × (等待间隔 + 平均每份请求与传输耗时)`，另加校验、写盘、限流停顿；下表均假设24小时连续运行。

| 有效等待间隔 | 仅等待时间 | 假设每份请求与传输平均1秒的总时间 |
| --- | ---: | ---: |
| 3秒 | 45.4小时 | 60.6小时，约2.5天 |
| 5秒 | 75.7小时 | 90.9小时，约3.8天 |
| 10秒 | 151.4小时 | 166.6小时，约6.9天 |
| 15秒 | 227.1小时 | 242.3小时，约10.1天 |
| 30秒 | 454.3小时 | 469.4小时，约19.6天 |
| 60秒 | 908.6小时 | 923.7小时，约38.5天 |

这是不同速度的假设情景，并非已取得的许可额度或当前robots声明的Crawl-delay。若许可要求5秒、robots要求10秒，则按10秒行估算。每份请求与传输平均多1秒，全量总耗时增加约15.1小时。尚未做在线测速，不能把假设1秒当作实测结果；若站方仅允许每天若干小时，日历天数还要相应延长。取得许可后可用前5份的实际耗时修正估算。

旧工具15/18仍保留兼容实现，其中的 API 分页和并发方式不能作为已经取得许可的证据；本轮未运行它们。暂停用旧工具刷新 Wiki，待站方明确其允许的 API 用途与访问方式。

站点文本许可与各图片的使用权可能不同。归档保留来源和文件页面链接，不声称所有图片可统一商用或转授权；不要因为站点文本使用 Creative Commons 就把全部图片标成相同许可。相关入口：[站点政策](https://wiki.warframe.com/w/Project:Policy)、[版权说明](https://meta.weirdgloop.org/w/Meta:Copyrights)。版权说明本轮未能读取，不能视为已完成逐图授权审查。

## 本轮可以运行的离线命令

```sh
node 工具/19-获取全部Wiki图片.mjs --plan
node 工具/资料工具.mjs 19 --plan
```

默认不带参数也是离线预检，不发请求。它读取 `assets/content/wiki/inventory.json`，要求 `complete:true`，只选择图片 MIME；音频、视频、PDF 等仅计入排除统计。目录为 2026-10-25 的快照，不能声称代表运行时站点的最新全量。

支持 PNG、JPEG、WebP、GIF、SVG、ICO，按 SHA256 命名保存原始字节。SVG、GIF、ICO 只归档，不执行、不转换、不新增应用渲染入口。文件名中的斜杠不参与本地路径，所有本地名均由哈希生成。相同内容只存一份，名称相似不算关联依据。

预检逐一核对现有索引记录的本地 SHA256，计算实际 SHA1，与目录中的原始 SHA1 比较；只有内容匹配才复用。旧索引源 SHA1 不一致单独报告，不修写旧索引，不删除文件。去重后的待下载体积与请求数另列，逐文件汇总体积可能重复计算别名。磁盘检查保留 1 GiB 余量。报告分别列3秒下限等待时间和随机3–10秒的预期等待时间，不含传输与停顿。

产物：

| 路径 | 内容 |
| --- | --- |
| `artifacts/wiki-images/archive-plan.json` | 所有图片元数据、待下载／可复用／阻止状态及理由；输入目录 SHA256 |
| `artifacts/wiki-images/archive-report.json` | 格式统计、数量、体积、去重计划、磁盘余量、原索引校验差异、执行状态及网络请求数 |
| `artifacts/wiki-images/archive-policy.json` | 仅获许可的下载运行写入：本次 robots 原文及哈希、项目 UA、许可来源 |
| `assets/content/wiki/img/<SHA256>.<ext>` | 与现有 Wiki 图库共享的原件目录 |
| `assets/content/wiki/archive-receipts.jsonl` | 下载成功的来源、字节数、时间戳、SHA1/SHA256 及失败；每条写入后同步落盘 |
| `assets/content/wiki/archive-pause.json` | 限流冷却或人工复核原因；跨进程保存，重启不清除限制 |

`archive-plan.json` 是该次运行开始时的计划。下载后的实时结果以 report 和 receipts 为准；下一次预检会重新核验实际文件。全部文件归档与原有15/18的明确实体关联索引分开，同一图库中不会按全站文件名自动创建实体或猜图片。

## 取得站方同意后

以下只是许可记录结构，不能自行填写成已获同意。请保存站方实际回复、工单或公开许可的依据，再创建本地 JSON。许可有效期、请求间隔需符合对方回复；如许可不是全站原图范围，当前脚本不能直接使用。

```json
{
  "site": "https://wiki.warframe.com",
  "scope": "all-original-images",
  "approvedBy": "实际批准方",
  "reference": "站方回复或许可依据的位置",
  "grantedAt": "实际许可时间（ISO 8601）",
  "expiresAt": "许可复核截止时间（ISO 8601）",
  "minIntervalMs": 3000
}
```

```sh
# 先小批次验证；全量仍按同样的串行速度执行
node 工具/19-获取全部Wiki图片.mjs --download --consent /absolute/path/site-consent.json --max-files 5
# 默认自动续传；--resume 是可读性别名
node 工具/19-获取全部Wiki图片.mjs --download --consent /absolute/path/site-consent.json --resume
```

未提供有效许可时生成 `awaiting-site-consent` 报告，退出码2，零请求。下载前读取 robots，失败或格式异常则停止；不把读取失败当允许。

401/403、验证码或 HTML 响应、哈希不符、网络错误及其他异常会停止并记录人工复核。429/503 立即停止，保存 Retry-After（支持秒数和 HTTP 日期）；无值时至少冷却1小时，不在同一运行里自动重试。连续运行仍遵守已记录的暂停状态。404/410 记录失败，累计达到3项则停止复核目录。目录可能过期，不会为修复旧 URL 改打被禁止的 API。

Ctrl-C／SIGTERM 取消当前请求，已完整写入日志的图片可以续传；遗留进程锁按共享 `withLock` 规则检查失效 PID。不删除其他图库、不清理旧原图。人工复核后，只有在原因已消除且仍符合站方约定时，才处理 `archive-pause.json`；冷却未到期不能通过删文件跳过。

验证：`node --test test/wiki-archive.test.mjs test/wiki-images.test.mjs`。网络响应使用本地模拟，覆盖零请求保护、robots 拒绝、限流续传保护、去重、原始字节、损坏文件检测及旧索引只读。

## macOS 独立后台与每日零点检查

2026-10-26 按用户要求安装，系统时区已核实为 Asia/Shanghai。下载服务和本地每日检查由 launchd 管理，关闭本次聊天、Codex 或终端不影响这两个本地任务。熄屏可继续；用户已设置不休眠，不修改其电源设置。LaunchAgent 在该用户登录会话中运行，重启后登录自动加载，注销用户会停止；不是系统级开机未登录服务。

安装入口：`python3 scripts/install-wiki-archive-service.py`，`--dry-run` 只打印配置。已存在时拒绝重复安装，不覆盖正在运行的服务或许可。实现为 `scripts/run-wiki-archive-service.mjs`。脚本、最小IO模块和undici运行依赖复制到独立目录，不复制图库；图库与断点仍使用同一个项目目录，执行同一Wiki更新锁。后续修改源脚本不会静默改变已安装运行副本，需要安排同步更新。

| 项目 | 已安装位置／标识 |
| --- | --- |
| 独立运行目录 | `/Users/dream/Library/Application Support/WarframeWikiArchive/` |
| 下载服务 | `local.warframe.wiki-image-archive` |
| 本地零点检查服务 | `local.warframe.wiki-image-archive.daily` |
| 用户启动配置 | `~/Library/LaunchAgents/local.warframe.wiki-image-archive*.plist` |
| 当前后台状态 | 独立目录的 `state.json` |
| 每日检查与日志 | 独立目录的 `daily/YYYY-MM-DD.json`、`.md` 和 `logs/` |
| 最新检查 | 独立目录的 `latest-check.json` |
| 实际站方许可文件 | 独立目录的 `site-consent.json`，当前尚不存在，不生成假许可 |

服务每分钟检查本地许可和暂停状态；等待许可时不发网络请求。实际许可文件有效后才进入图库同步，沿用邮箱、用途说明、随机3–10秒与更慢站方限制。401/403或人工复核标记不会自动解除；429/503冷却到期且许可仍有效时才允许续传。下载完成后工作进程正常退出，不无限重新下载。

本地每日检查为北京时间00:00，纯读取下载状态、检查进程存活并保存JSON/Markdown，即使Codex关闭也能留下检查记录。安装后已手动触发同一检查任务验证。另创建Codex聊天自动化“Wiki图片每日零点检查”（id：`wiki`），读取这些本地状态，只在实质进度、完成、失败或新的需用户处理问题时通知；已知的等待许可状态未变则保持安静。Codex自动化访问本地文件仍需桌面应用运行，详见 [官方定时任务说明](https://learn.chatgpt.com/docs/automations?surface=app)；它不承担下载工作，也不会重置后台暂停。

在独立运行目录中双击 `查看Wiki获取状态.command` 或 `立即检查Wiki状态.command` 可随时查看。`停止Wiki后台任务.command` 会设置停止标记、卸载本地两个launchd任务并删除对应启动配置，保留图库、许可和断点；Codex自动化是独立的通知计划，需另外停用。不要在后台执行时同时运行19下载；共享更新锁会防止并行写图库。

后台测试：`node --test test/wiki-archive-service.test.mjs test/wiki-archive.test.mjs`，覆盖缺许可零请求、许可过期、限流冷却、人工复核、停止及每日只读快照。
