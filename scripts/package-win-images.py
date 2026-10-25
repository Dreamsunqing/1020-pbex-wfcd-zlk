#!/usr/bin/env python3
"""Append the shared image library to a verified Windows application ZIP."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import zipfile

ROOT = Path(__file__).resolve().parent.parent


def sha256(file):
    result = hashlib.sha256()
    with file.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            result.update(block)
    return result.hexdigest()


def main():
    version = json.loads((ROOT / 'package.json').read_text())['version']
    dist = ROOT / 'dist'
    base = dist / f'SourceWorkbench-{version}-win-x64.zip'
    report = json.loads((dist / f'交付校验-{version}.json').read_text())
    verified = next(row for row in report['packages'] if row['platform'] == 'win-x64')
    if not verified['sourceMatches'] or sha256(base) != verified['sha256']:
        raise ValueError('Windows 普通包尚未通过当前交付校验，请先运行 npm run pack:all')
    content = ROOT / 'assets/content'
    required = ['wfcd/catalog.json', 'wfcd/wfcd-image-index.json', 'official/index.json', 'wiki/index.json']
    for name in required:
        json.loads((content / name).read_text())
    files = []
    for directory, folders, names in os.walk(content, followlinks=False):
        folders[:] = sorted(name for name in folders if not name.startswith('.'))
        for name in sorted(names):
            if name.startswith('.') or name.endswith('.tmp') or name == 'update.lock':
                continue
            file = Path(directory) / name
            if file.is_symlink() or not file.is_file():
                raise ValueError(f'图库只允许普通文件：{file}')
            files.append(file)
    counts = {provider: sum(file.is_relative_to(content / provider / 'img') for file in files)
              for provider in ['wfcd', 'official', 'wiki']}
    if not all(counts[p] for p in ['wfcd', 'official']):
        raise ValueError('WFCD 和官方 img 目录均须包含图片')
    target = dist / f'SourceWorkbench-{version}-win-x64-with-images.zip'
    temporary = target.with_suffix('.zip.partial')
    note = ('Windows x64 含图库版\n\n解压整个 ZIP 后运行 Source Workbench.exe。'
            '保留同级 assets/content 目录，程序会自动查找 WFCD、官方和 Wiki 图库。\n'
            '移动时请移动整个解压目录；只移动 EXE 会丢失依赖和图库。\n'
            '本包包含本地现有图片及索引，不另含世界状态上游 JSON 或个人合并缓存。'
            '资料浏览和合并汇总仍需选择资料包目录或按现有流程获取数据。\n'
            '文本图标已在程序内置；蓝图和 Tau 继续在展示/导出时分层合成，不修改原图。\n'
            '如旧配置指定其他图库，可在程序中重新选择此 assets/content。\n')
    try:
        shutil.copyfile(base, temporary)
        with zipfile.ZipFile(temporary, 'a', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
            for index, file in enumerate(files, 1):
                archive.write(file, file.relative_to(ROOT).as_posix())
                if index % 2000 == 0:
                    print(f'已打包图库 {index}/{len(files)}', flush=True)
            archive.writestr('含图库版使用说明.txt', note.encode('utf-8-sig'))
        with zipfile.ZipFile(temporary) as archive:
            names = archive.namelist()
            if len(names) != len(set(names)):
                raise ValueError('ZIP 中出现重复路径')
            for file in files:
                if archive.getinfo(file.relative_to(ROOT).as_posix()).file_size != file.stat().st_size:
                    raise ValueError(f'图片打包大小不符：{file}')
            print('验证 ZIP 完整性（不解码图片）…', flush=True)
            bad = archive.testzip()
            if bad:
                raise ValueError(f'ZIP CRC 校验失败：{bad}')
        os.replace(temporary, target)
        result = {'version': version, 'file': target.relative_to(ROOT).as_posix(),
                  'bytes': target.stat().st_size, 'sha256': sha256(target),
                  'baseZipSha256': verified['sha256'], 'imageFiles': counts,
                  'libraryFiles': len(files), 'libraryBytes': sum(file.stat().st_size for file in files),
                  'crcVerified': True, 'windowsRuntime': 'not-tested-on-Windows'}
        (dist / f'含图库校验-{version}.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
        print(json.dumps(result, ensure_ascii=False, indent=2))
    finally:
        temporary.unlink(missing_ok=True)


if __name__ == '__main__':
    main()
