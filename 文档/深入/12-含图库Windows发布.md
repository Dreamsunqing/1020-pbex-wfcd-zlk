# 含图库 Windows 发布

0.13.3 起，GitHub Release 同时提供 Mac x64 普通包、Windows x64 普通包和额外的 Windows x64 含图库包。源码 Git 不包含 `assets/content` 大图库，文本图标运行时仍随源码维护。

## 给使用者

下载 `SourceWorkbench-0.13.3-win-x64-with-images.zip`，完整解压后运行 `Source Workbench.exe`。不要只提取 EXE。包中额外包含：

```text
assets/content/wfcd/img/       本地已有 WFCD 原图
assets/content/wfcd/           catalog、完整 ID 图片索引、来源说明等
assets/content/official/img/   本地已有官方原图
assets/content/official/       Manifest、索引等
assets/content/wiki/img/       Wiki 原图（0.17.1 起）
assets/content/wiki/           实体证据索引和文件目录
含图库版使用说明.txt
```

主进程已有的 `locateDirectory('assets/content')` 会从可执行文件所在目录向上查找，因此不依赖开发机绝对路径或启动时的工作目录。若个人配置之前选择了其他图库，可以在程序里重新选择解压目录下的 `assets/content`。

“含图库”表示携带当前本地已有图片，不保证所有游戏物品均有图片。不另打包 `世界状态上游` JSON、个人规则、合并缓存和用户配置；资料浏览、P3 合并仍需选择资料包或按现有流程获取数据。图片资源可直接浏览；文本图标始终内置。蓝图和 Tau 仍由现有逻辑分层合成，不生成一套重复原图。

## 给发布维护者

```sh
npm run pack:all
python3 scripts/package-win-images.py
npm run retain:packages
```

也可以用 `npm run pack:win:images` 执行第二步（需要 Python 3；Windows 可直接用 `py -3 scripts/package-win-images.py`）。第一步生成并验证两个普通包；第二步验证普通 Windows ZIP 的 SHA-256 与交付报告一致，在临时 ZIP 中追加 `assets/content`，成功后原子替换含图版目标。不创建第二套解压图库，不改原图。

脚本排除隐藏文件，拒绝文件符号链接，验证必需 JSON 索引、两套非空 img、条目路径唯一和打包大小，并对 ZIP 所有文件做 CRC 完整性校验，不逐张解码图片。结果输出 `dist/含图库校验-版本.json`，包含来源普通包哈希、含图版哈希、字节数和两套图片数量。普通包的源码一致性另见 `dist/交付校验-版本.json`。

`scripts/retain-packages.mjs` 对普通包和 `with-images` 包统一执行“当前版本 + 一个上一版”保留策略。含图 ZIP 是明确用于跨机分发的压缩交付件，不另留含图解压目录。Windows 只在本机做包文件验证，实机运行验证需在 Windows 上进行，不能以 CRC 或打包成功代替。
