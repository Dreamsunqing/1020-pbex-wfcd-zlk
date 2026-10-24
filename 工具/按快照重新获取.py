#!/usr/bin/env python3
"""按已有 snapshot-manifest.json 重新下载；仅写入不存在的新目录。"""
import argparse
import hashlib
import json
import lzma
from pathlib import Path
import re
import subprocess
import sys
import urllib.request


def sha(data):
    return hashlib.sha256(data).hexdigest()


def fetch(url, expected_hash):
    last = None
    for _ in range(3):
        try:
            request = urllib.request.Request(url, headers={"User-Agent": "Warframe-Upstream-Archive/1.0"})
            with urllib.request.urlopen(request, timeout=120) as response:
                data = response.read()
            if sha(data) != expected_hash:
                raise ValueError(f"下载内容 SHA-256 与快照不符：{url}")
            return data
        except Exception as error:
            last = error
    raise RuntimeError(f"无法获取快照文件：{url}\n{last}")


def pretty(text):
    # 仅修改字符串外的空白，保留数字字面量、转义、顺序及重复键。
    json.loads(text)
    tokens = re.findall(r'"(?:[^"\\]|\\.)*"|[^\s{}\[\],:"]+|[{}\[\],:]', text)
    output = []
    depth = 0
    previous = None
    for index, token in enumerate(tokens):
        if token in ("{", "["):
            output.append(token)
            depth += 1
            if tokens[index + 1] not in ("}", "]"):
                output.append("\n" + "  " * depth)
        elif token in ("}", "]"):
            depth -= 1
            if previous not in ("{", "["):
                output.append("\n" + "  " * depth)
            output.append(token)
        elif token == ",":
            output.append(",\n" + "  " * depth)
        elif token == ":":
            output.append(": ")
        else:
            output.append(token)
        previous = token
    result = "".join(output) + "\n"
    json.loads(result)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--snapshot", type=Path, required=True, help="包内原始 snapshot-manifest.json")
    parser.add_argument("--output", type=Path, required=True, help="必须是尚不存在的新目录")
    args = parser.parse_args()
    manifest = json.loads(args.snapshot.read_text(encoding="utf-8"))
    root = args.output.resolve()
    if root.exists():
        parser.error("输出目录已存在；请使用新的目录，失败后也保留已下载内容供排查。")
    # 此工具用于包内受信快照；仍先拒绝绝对路径及目录穿越。
    for entry in manifest["official"]:
        if not re.fullmatch(r"[a-z]{2}", entry["language"]):
            raise ValueError("语言代码无效")
        for key in ("lzmaFile", "indexFile"):
            path = Path(entry[key])
            if path.is_absolute() or ".." in path.parts:
                raise ValueError("索引路径无效")
        for item in entry["files"]:
            if Path(item["versionedName"]).name != item["versionedName"]:
                raise ValueError("Manifest 文件名无效")
    for repo in manifest["repositories"]:
        if not re.fullmatch(r"[A-Za-z0-9_.-]+", repo["name"]):
            raise ValueError("仓库名无效")
        if not re.fullmatch(r"[0-9a-f]{40}", repo["commit"]):
            raise ValueError("仓库提交无效")
    root.mkdir(parents=True)
    for entry in manifest["official"]:
        language = entry["language"]
        # index_<lang> URL 会随上游发布变化，优先复用随快照保存的历史索引。
        saved_index = args.snapshot.resolve().parent / entry["lzmaFile"]
        if saved_index.is_file():
            compressed = saved_index.read_bytes()
            if sha(compressed) != entry["compressedSha256"]:
                raise ValueError(f"{language} 随包压缩索引 SHA-256 不符")
        else:
            compressed = fetch(entry["indexUrl"], entry["compressedSha256"])
        index = lzma.decompress(compressed, format=lzma.FORMAT_ALONE)
        if sha(index) != entry["indexSha256"]:
            raise ValueError(f"{language} 索引 SHA-256 不符")
        for relative, data in [(entry["lzmaFile"], compressed), (entry["indexFile"], index)]:
            target = root / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
        directory = root / "official-public-export" / "manifests" / language
        directory.mkdir(parents=True, exist_ok=True)
        for item in entry["files"]:
            raw = fetch(item["url"], item["sha256"])
            if len(raw) != item["size"]:
                raise ValueError(f"原始大小不符：{item['versionedName']}")
            name = item["versionedName"].split("!", 1)[0]
            if not name.endswith(".json"):
                raise ValueError("Manifest 后缀无效")
            (directory / name).write_bytes(raw)
        print(f"官方 {language}：{len(entry['files'])} 份", flush=True)
    for repo in manifest["repositories"]:
        directory = root / "git" / repo["name"]
        directory.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(["git", "clone", "--", repo["url"], str(directory)], check=True)
        subprocess.run(["git", "-C", str(directory), "checkout", "--detach", repo["commit"]], check=True)
        actual = subprocess.check_output(["git", "-C", str(directory), "rev-parse", "HEAD"], text=True).strip()
        if actual != repo["commit"]:
            raise ValueError("Git 提交不符")
    wfcd_snapshot = args.snapshot.resolve().parent / "wfcd-items-snapshot.json"
    if wfcd_snapshot.is_file():
        subprocess.run([
            sys.executable, str(Path(__file__).resolve().with_name("缓存WFCD无图片.py")),
            "--snapshot", str(wfcd_snapshot),
            "--output", str(root / "wfcd-items"),
            "--manifest-output", str(root / "wfcd-items-snapshot.json"),
        ], check=True)
    for item in manifest.get("droptables", {}).get("files", []):
        relative = Path(item["path"])
        if relative.is_absolute() or ".." in relative.parts:
            raise ValueError("掉落表路径无效")
        saved = args.snapshot.resolve().parent / relative
        if not saved.is_file():
            raise ValueError("恢复固定掉落表需随快照保留原文和解析文件；实时 URL 可能已变，不能代替旧版")
        raw = saved.read_bytes()
        if len(raw) != item["size"] or sha(raw) != item["sha256"]:
            raise ValueError("固定掉落表文件校验失败")
        target = root / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(raw)
    (root / "snapshot-manifest.json").write_bytes(args.snapshot.read_bytes())
    print("完成：数据来源版本已核对。Git 使用 detached HEAD；原始快照记录保持原样。")


if __name__ == "__main__":
    main()
