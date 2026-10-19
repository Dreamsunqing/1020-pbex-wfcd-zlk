# 世界状态上游数据副本

此目录复制自世界状态重构项目的上游缓存，原缓存保留。整理日期：2026-10-19。

- `official-public-export/lzma/`：15 种语言的原始压缩索引。
- `official-public-export/indexes/`：15 份解压索引，保留版本化文件名。
- `official-public-export/manifests/<lang>/`：240 份阅读版 JSON，已去掉文件名 `!…`，以 2 空格缩进。
- `git/`：Plus、Plus 生成器、Oracle、browse.wf 四个仓库，保留已有 `.git` 历史。
- `snapshot-manifest.json`：2026-10-04 的原采集记录，URL、大小和 SHA-256 对应下载时的原始版本正文。

完整说明见上级 `文档/01-数据来源与获取方法.md` 与 `文档/02-各类JSON内容说明.md`。

本地格式化使官方 JSON 的字节大小和哈希变化；对照 `../文档/官方文件来源与当前文件映射.json`。
请勿把原项目的 `npm run upstreams:cache` 当成本独立资料包的命令；该命令依赖原项目，而且原脚本会按旧版本化文件名重新创建缓存。独立重新获取使用上级 `工具/按快照重新获取.py`。

## WFCD 无图片补充快照

- `wfcd-items/`：WFCD/warframe-items 的非图片源码与数据快照，无 `.git`，图片名称/路径/哈希等文本保留。
- `wfcd-items-snapshot.json`：该部分的固定提交、获取时间、文件哈希及排除的图片路径清单。

原来的 `snapshot-manifest.json` 继续保留官方 Public Export 和原四个仓库的历史记录。独立获取工具会自动识别旁边的 WFCD 来源清单，并按排除图片的口径恢复此部分。
