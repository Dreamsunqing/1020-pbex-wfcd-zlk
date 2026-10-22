#!/usr/bin/env python3
"""Audit tools data and optionally share identical immutable bytes with APFS clones.

Does not delete user files or link mutable files together. APFS clones are copy on
write: future edits to either pathname do not change the other file.
"""
import argparse
import collections
import ctypes
import hashlib
import json
import os
from pathlib import Path
import shutil
import sys
import uuid
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
DATA = {'.json', '.png', '.jpg', '.jpeg', '.webp', '.txt', '.md', '.csv', '.tsv', '.js', '.mjs', '.cjs', '.css', '.ts'}
SKIP = {'.git', 'node_modules', '__pycache__'}


def sha(file):
    digest = hashlib.sha256()
    with file.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=ROOT.parent)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    directory = args.root.resolve()
    groups = collections.defaultdict(list)
    file_count = 0
    for current, directories, files in os.walk(directory, followlinks=False):
        directories[:] = [d for d in directories if d not in SKIP and not d.endswith('.app') and not (Path(current) / d).is_symlink()]
        for name in files:
            file = Path(current) / name
            if file.is_symlink() or file.suffix.lower() not in DATA or name in {'storage-audit.json', 'storage-audit-before.json'}:
                continue
            size = file.stat().st_size
            if size < 4096:
                continue
            groups[size].append(file)
            file_count += 1
    matches = []
    for size, files in groups.items():
        if len(files) < 2:
            continue
        hashed = collections.defaultdict(list)
        for file in files:
            hashed[sha(file)].append(file)
        for digest, copies in hashed.items():
            if len(copies) < 2:
                continue
            copies.sort(key=lambda p: (0 if '/assets/content/' in str(p) else 1 if '/世界状态上游/' in str(p) else 2, len(str(p)), str(p)))
            matches.append({'sha256': digest, 'bytes': size, 'files': [str(p.relative_to(directory)) for p in copies]})
    shared_files = 0
    shared_bytes = 0
    failures = []
    if args.apply:
        if sys.platform != 'darwin':
            raise RuntimeError('APFS clone deduplication is available only on macOS; audit mode works elsewhere')
        libc = ctypes.CDLL('/usr/lib/libSystem.B.dylib', use_errno=True)
        libc.clonefile.argtypes = [ctypes.c_char_p, ctypes.c_char_p, ctypes.c_int]
        libc.clonefile.restype = ctypes.c_int
        for match in matches:
            source = directory / match['files'][0]
            for name in match['files'][1:]:
                target = directory / name
                temp = target.with_name('.clone-' + uuid.uuid4().hex)
                try:
                    stat = target.stat()
                    if sha(source) != match['sha256'] or sha(target) != match['sha256']:
                        raise RuntimeError('Content changed during audit; skipped')
                    if libc.clonefile(os.fsencode(source), os.fsencode(temp), 0):
                        error = ctypes.get_errno()
                        raise OSError(error, os.strerror(error))
                    shutil.copystat(target, temp, follow_symlinks=False)
                    if sha(temp) != match['sha256'] or target.stat().st_mtime_ns != stat.st_mtime_ns or target.stat().st_size != stat.st_size:
                        raise RuntimeError('File changed before replacement; skipped')
                    os.replace(temp, target)
                    shared_files += 1
                    shared_bytes += match['bytes']
                except Exception as error:
                    failures.append({'file': name, 'error': str(error)})
                finally:
                    temp.unlink(missing_ok=True)
    report = {'checkedAt': datetime.now(timezone.utc).isoformat(), 'root': str(directory),
              'scope': 'Regular data/text files >=4KiB; excludes Git history, dependencies, app bundles, symlinks and runtime binaries. Version ZIPs are retained separately by policy.',
              'mode': 'APFS-copy-on-write' if args.apply else 'audit', 'scannedDataFiles': file_count,
              'duplicateGroups': len(matches), 'duplicateContentBytes': sum(m['bytes'] * (len(m['files']) - 1) for m in matches),
              'sharedFiles': shared_files, 'sharedLogicalBytes': shared_bytes,
              'note': 'Shared byte count is logical duplicate content, not a measurement of physical disk free-space change. Clone paths remain independent on future writes.',
              'failures': failures, 'groups': sorted(matches, key=lambda m: m['bytes'] * (len(m['files']) - 1), reverse=True)}
    output = ROOT / 'artifacts/storage-audit.json'
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print(json.dumps({k: v for k, v in report.items() if k != 'groups'}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
