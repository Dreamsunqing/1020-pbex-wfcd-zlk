#!/usr/bin/env python3
"""离线核对资料文件的路径、大小和 SHA-256；不写入任何文件。"""
import argparse
import hashlib
import json
from pathlib import Path
import sys


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--include-git", action="store_true", help="额外核验原始资料包保留的上游 .git 历史；GitHub 普通克隆无需此项")
    args = parser.parse_args()
    root = args.root.resolve()
    manifest = json.loads((root / "文档/当前文件校验清单.json").read_text(encoding="utf-8"))
    in_scope = lambda p: args.include_git or ".git" not in Path(p).parts
    expected = {item["path"]: item for item in manifest["files"] if in_scope(item["path"])}
    actual = {str(p.relative_to(root)) for p in (root / "世界状态上游").rglob("*") if p.is_file() and in_scope(p.relative_to(root))}
    errors = [f"缺少：{p}" for p in sorted(expected.keys() - actual)]
    errors += [f"新增：{p}" for p in sorted(actual - expected.keys())]
    for relative, entry in expected.items():
        path = root / relative
        if not path.is_file():
            continue
        data = path.read_bytes()
        if len(data) != entry["size"] or hashlib.sha256(data).hexdigest() != entry["sha256"]:
            errors.append(f"内容不同：{relative}")
    if errors:
        print("\n".join(errors))
        sys.exit(1)
    scope = "含四个上游仓库的 .git" if args.include_git else "不含上游 .git 历史"
    print(f"通过：{len(expected)} 个文件的路径、大小与 SHA-256 全部一致（{scope}）。")


if __name__ == "__main__":
    main()
