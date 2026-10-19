#!/usr/bin/env python3
"""导出 WFCD/warframe-items 的固定提交，排除图片文件及图片目录，不克隆 .git。"""
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import time
from urllib.parse import quote
from urllib.request import Request, urlopen

REPOSITORY = "WFCD/warframe-items"
IMAGE_EXTENSIONS = frozenset({
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".ico", ".bmp",
    ".avif", ".tif", ".tiff", ".dds", ".ktx", ".ktx2", ".tga", ".icns",
})
EMBEDDED_IMAGE_PATHS = frozenset({"data/logo.json"})  # 上游 JSON 内嵌 SVG data URI
IMAGE_DIRECTORIES = frozenset({"images", "image", "img", "imgs", "icons", "screenshots"})


def is_image(path):
    path = PurePosixPath(path)
    return str(path) in EMBEDDED_IMAGE_PATHS or path.suffix.lower() in IMAGE_EXTENSIONS or any(
        part.lower() in IMAGE_DIRECTORIES for part in path.parts[:-1]
    )


def get(url):
    error = None
    for attempt in range(3):
        try:
            request = Request(url, headers={"User-Agent": "Warframe-Upstream-Archive/1.0"})
            with urlopen(request, timeout=120) as response:
                return response.read()
        except Exception as caught:
            error = caught
            if attempt < 2:
                time.sleep(attempt + 1)
    raise RuntimeError(f"下载失败：{url}\n{error}")


def fetch_file(entry, output):
    relative = PurePosixPath(entry["path"])
    if relative.is_absolute() or ".." in relative.parts or is_image(relative):
        raise ValueError(f"导出文件路径无效：{relative}")
    data = get(entry["rawUrl"])
    blob = hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest()
    if len(data) != entry["size"] or blob != entry["gitBlobSha1"]:
        raise ValueError(f"大小或 Git blob SHA-1 不符：{relative}")
    digest = hashlib.sha256(data).hexdigest()
    if entry.get("sha256") and entry["sha256"] != digest:
        raise ValueError(f"SHA-256 不符：{relative}")
    target = output / str(relative)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
    entry = dict(entry, sha256=digest)
    return entry


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True, help="必须是不存在的新目录")
    parser.add_argument("--manifest-output", type=Path, required=True, help="输出来源清单，文件必须不存在")
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--commit", help="固定的 40 位提交；未指定时查询 master")
    group.add_argument("--snapshot", type=Path, help="按此前来源清单的固定文件重新获取")
    parser.add_argument("--workers", type=int, default=6)
    args = parser.parse_args()
    if not 1 <= args.workers <= 12:
        parser.error("workers 必须为 1–12")
    if args.output.exists() or args.manifest_output.exists():
        parser.error("输出目录或清单已存在；请使用新的路径")
    if args.commit and not re.fullmatch(r"[0-9a-f]{40}", args.commit):
        parser.error("commit 必须是完整的 40 位小写十六进制提交")
    if args.snapshot:
        metadata = json.loads(args.snapshot.read_text(encoding="utf-8"))
        if metadata["repository"] != REPOSITORY:
            raise ValueError("来源清单仓库不符")
        entries = metadata["files"]
    else:
        api = f"https://api.github.com/repos/{REPOSITORY}"
        commit = json.loads(get(f"{api}/commits/{args.commit or 'master'}"))
        revision = commit["sha"]
        tree = json.loads(get(f"{api}/git/trees/{revision}?recursive=1"))
        if tree.get("truncated"):
            raise ValueError("GitHub 树清单不完整，停止导出")
        entries, excluded = [], []
        for item in tree["tree"]:
            if item["type"] != "blob":
                continue
            if is_image(item["path"]):
                excluded.append({"path": item["path"], "size": item["size"], "gitBlobSha1": item["sha"]})
                continue
            if item["mode"] not in ("100644", "100755"):
                raise ValueError(f"不支持的文件模式：{item['path']}")
            entries.append({
                "path": item["path"], "size": item["size"], "gitBlobSha1": item["sha"],
                "githubUrl": f"https://github.com/{REPOSITORY}/blob/{revision}/{quote(item['path'], safe='/')}",
                "rawUrl": f"https://raw.githubusercontent.com/{REPOSITORY}/{revision}/{quote(item['path'], safe='/')}",
            })
        metadata = {
            "schemaVersion": 1, "repository": REPOSITORY,
            "url": f"https://github.com/{REPOSITORY}", "branch": "master",
            "commit": revision, "commitDate": commit["commit"]["committer"]["date"],
            "exportMode": "tracked-files-without-images-and-without-git-history",
            "excludedImageExtensions": sorted(IMAGE_EXTENSIONS),
            "excludedImageDirectories": sorted(IMAGE_DIRECTORIES),
            "excludedEmbeddedImagePaths": sorted(EMBEDDED_IMAGE_PATHS),
            "excludedFiles": excluded,
        }
    args.output.mkdir(parents=True)
    completed = []
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        pending = [pool.submit(fetch_file, entry, args.output) for entry in entries]
        for future in as_completed(pending):
            completed.append(future.result())
            if len(completed) % 20 == 0 or len(completed) == len(entries):
                print(f"WFCD 非图片文件：{len(completed)}/{len(entries)}", flush=True)
    metadata["files"] = sorted(completed, key=lambda item: item["path"])
    metadata["fetchedAt"] = datetime.now(timezone.utc).isoformat()
    metadata["fileCount"] = len(completed)
    metadata["totalBytes"] = sum(item["size"] for item in completed)
    metadata["excludedFileCount"] = len(metadata["excludedFiles"])
    metadata["excludedBytes"] = sum(item["size"] for item in metadata["excludedFiles"])
    args.manifest_output.parent.mkdir(parents=True, exist_ok=True)
    args.manifest_output.write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"完成：{len(completed)} 个文件，排除 {metadata['excludedFileCount']} 个图片载体；提交 {metadata['commit']}")


if __name__ == "__main__":
    main()
