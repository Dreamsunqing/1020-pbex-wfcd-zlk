#!/usr/bin/env python3
"""Restore the complete pinned WFCD image tree, publish the official cache, and audit both.

Maintenance only. Existing catalog entries and image bytes are never rewritten.
The official library is relocated with a compatibility symlink, avoiding a second copy.
"""
import argparse
import collections
import hashlib
import json
import os
from pathlib import Path
import struct
import tarfile
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CONTENT = ROOT / 'assets/content'


def digest(data, algorithm='sha256'):
    return hashlib.new(algorithm, data).hexdigest()


def file_digest(path):
    h = hashlib.sha256()
    with path.open('rb') as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def read(path):
    return json.loads(path.read_text(encoding='utf-8'))


def write(path, data):
    temp = path.with_name(path.name + '.tmp')
    temp.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    temp.replace(path)


def disk_name(name):
    # Match the guide tool. Case-only upstream names remain distinct on macOS/Windows.
    return digest(name.encode())[:24] + Path(name).suffix.lower()


def image_info(data):
    if data[:8] == b'\x89PNG\r\n\x1a\n' and len(data) >= 24:
        return 'png', *struct.unpack('>II', data[16:24])
    if data[:3] == b'\xff\xd8\xff':
        i = 2
        while i + 8 < len(data):
            if data[i] != 255:
                i += 1
                continue
            marker = data[i + 1]
            if marker == 255:
                i += 1
                continue
            if marker in (0xd8, 0xd9):
                i += 2
                continue
            size = int.from_bytes(data[i + 2:i + 4], 'big')
            if size < 2 or i + size + 2 > len(data):
                break
            if marker in (0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf):
                height, width = struct.unpack('>HH', data[i + 5:i + 9])
                return 'jpg', width, height
            if marker == 0xda:
                break
            i += size + 2
    raise ValueError('Not a supported PNG/JPEG image')


def summary(images):
    unique = {r['sha256']: r for r in images}
    return {'files': len(images), 'bytes': sum(r['bytes'] for r in images),
            'uniqueContentFiles': len(unique),
            'uniqueContentBytes': sum(r['bytes'] for r in unique.values()),
            'formats': dict(collections.Counter(r['format'] for r in images)),
            'dimensions': dict(collections.Counter(f"{r['width']}×{r['height']}" for r in images))}


def scan_references(value, source, pointer='', parent=''):
    if isinstance(value, dict):
        uid = value.get('uniqueName')
        name = value.get('imageName')
        if isinstance(uid, str) and isinstance(name, str) and name:
            yield {'id': uid, 'imageName': name, 'source': source, 'pointer': pointer,
                   'name': value.get('name', ''), 'parentId': parent,
                   'kind': 'ability' if '/abilities/' in pointer else 'component' if '/components/' in pointer else 'item'}
        for key, child in value.items():
            escaped = key.replace('~', '~0').replace('/', '~1')
            yield from scan_references(child, source, pointer + '/' + escaped, uid or parent)
    elif isinstance(value, list):
        for index, child in enumerate(value):
            yield from scan_references(child, source, pointer + '/' + str(index), parent)


def source_members(archive, commit, content, expected):
    if archive.exists():
        with tarfile.open(archive, 'r:gz') as source:
            assert source.pax_headers.get('comment') == commit, 'Archive commit differs'
            for member in source:
                if not member.isfile():
                    continue
                relative = member.name.split('/', 1)[-1]
                if relative.startswith('data/img/') or (relative.startswith('data/json/') and relative.endswith('.json') and relative.count('/') == 2):
                    yield relative, source.extractfile(member).read()
    else:
        # The integrated installation keeps one expanded image tree, not another
        # 604 MiB source archive. The independent pinned Git inventory verifies it.
        for file in sorted((ROOT / '世界状态上游/wfcd-items/data/json').glob('*.json')):
            yield 'data/json/' + file.name, file.read_bytes()
        for name in expected:
            file = content / 'img' / disk_name(name)
            yield 'data/img/' + name, file.read_bytes()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--content', type=Path, default=DEFAULT_CONTENT)
    parser.add_argument('--archive', type=Path)
    parser.add_argument('--official-cache', type=Path, default=ROOT / '.workbench/official-images')
    args = parser.parse_args()
    shared = args.content.resolve()
    content = shared / 'wfcd'
    archive = args.archive or ROOT / '.cache/warframe-items.tar.gz'
    snapshot = read(ROOT / '世界状态上游/wfcd-items-snapshot.json')
    expected = {r['path'][9:]: r for r in snapshot['excludedFiles'] if r['path'].startswith('data/img/')}
    catalog_path = content / 'catalog.json'
    catalog_bytes = catalog_path.read_bytes()
    catalog = json.loads(catalog_bytes)
    assert catalog['meta']['commit'] == snapshot['commit'], 'Catalog/snapshot commits differ'
    before = set(p.name for p in (content / 'img').iterdir() if p.is_file())
    print(f"WFCD pinned commit: {snapshot['commit']}; existing files: {len(before)}", flush=True)
    images, references = [], []
    seen = set()
    for relative, data in source_members(archive, snapshot['commit'], content, expected):
            if relative.startswith('data/json/') and relative.endswith('.json') and relative.count('/') == 2:
                references.extend(scan_references(json.loads(data), relative))
            if not relative.startswith('data/img/'):
                continue
            name = relative[9:]
            assert name in expected and '/' not in name and '\\' not in name and name not in seen, name
            seen.add(name)
            blob = digest(b'blob ' + str(len(data)).encode() + b'\0' + data, 'sha1')
            assert blob == expected[name]['gitBlobSha1'] and len(data) == expected[name]['size'], name
            fmt, width, height = image_info(data)
            asset_name = disk_name(name)
            target = content / 'img' / asset_name
            if target.exists():
                assert target.read_bytes() == data, f'Existing image differs; not overwritten: {target}'
            else:
                with target.open('xb') as output:
                    output.write(data)
            images.append({'imageName': name, 'assetName': asset_name, 'bytes': len(data),
                           'sha256': digest(data), 'gitBlobSha1': blob,
                           'format': fmt, 'width': width, 'height': height})
            if len(images) % 3000 == 0:
                print(f'WFCD verified/restored: {len(images)}/{len(expected)}', flush=True)
    assert seen == set(expected), 'Archive image tree is incomplete'
    by_name = {r['imageName']: r for r in images}
    refs_by_id = collections.defaultdict(set)
    for ref in references:
        if ref['imageName'] in by_name:
            refs_by_id[ref['id']].add(ref['imageName'])
    # Conflicting ID references remain explicit; do not choose by traversal order.
    ambiguous = {uid: sorted(names) for uid, names in refs_by_id.items() if len(names) != 1}
    mappings = [{'id': uid, 'imageName': next(iter(names)),
                 'assetName': by_name[next(iter(names))]['assetName']}
                for uid, names in sorted(refs_by_id.items()) if len(names) == 1]
    mapped = {r['id']: r for r in mappings}
    all_assets = {r['assetName'] for r in images}
    assert len(all_assets) == len(images), 'Hashed filename collision'
    assert before <= all_assets, 'Unmanaged existing assets require review'
    added = [r for r in images if r['assetName'] not in before]
    # Keep the first completion delta stable across reruns.
    previous = content / 'wfcd-image-index.json'
    prior = read(previous) if previous.exists() else {}
    if prior.get('commit') == snapshot['commit'] and prior.get('completion'):
        completion = prior['completion']
    else:
        completion = {'existingFiles': len(before), 'addedFiles': len(added),
                      'addedBytes': sum(r['bytes'] for r in added), 'addedImageNames': sorted(r['imageName'] for r in added)}
    now = datetime.now(timezone.utc).isoformat()
    wfcd_index = {'schemaVersion': 1, 'checkedAt': now, 'source': catalog['meta']['source'],
                  'commit': snapshot['commit'], 'archiveSha256': file_digest(archive) if archive.exists() else prior.get('archiveSha256'),
                  'basis': 'Every data/img file in the pinned source tree, verified by Git blob SHA-1 and SHA-256; includes nested/unreferenced images.',
                  'completion': completion, 'summary': summary(images), 'images': images,
                  'mappings': mappings, 'ambiguousIds': ambiguous}
    write(previous, wfcd_index)
    checksums_path = content / 'checksums.json'
    checksums = read(checksums_path)
    assert checksums.get('catalog.json') == digest(catalog_bytes), 'Existing catalog checksum differs'
    for row in images:
        old_hash = checksums.get(row['assetName'])
        assert old_hash is None or old_hash == row['sha256'], row['assetName']
        checksums[row['assetName']] = row['sha256']
    write(checksums_path, checksums)
    print(f"WFCD complete: {len(images)} files; added this run: {len(added)}", flush=True)

    target = shared / 'official'
    source = args.official_cache.absolute()
    official_root = target if target.exists() else source
    official = read(official_root / 'index.json')
    assets_by_file = {r['file']: r for r in official['assets']}
    official_images = []
    for n, (name, row) in enumerate(assets_by_file.items(), 1):
        assert Path(name).name == name
        data = (official_root / 'img' / name).read_bytes()
        assert digest(data) == row['sha256'] and len(data) == row['bytes'], name
        fmt, width, height = image_info(data)
        official_images.append({**row, 'format': fmt, 'width': width, 'height': height})
        if n % 3000 == 0:
            print(f'Official hashes verified: {n}/{len(assets_by_file)}', flush=True)
    manifest_path = ROOT / '世界状态上游' / official['manifest']['file']
    manifest_bytes = manifest_path.read_bytes()
    assert digest(manifest_bytes) == official['manifest']['sha256']
    assert json.loads(manifest_bytes)['Manifest'] == official['entries']
    if not target.exists():
        source.rename(target)
        source.symlink_to(target, target_is_directory=True)
    elif source.exists():
        assert source.samefile(target), 'Two independent official caches exist; not silently replaced'
    else:
        source.parent.mkdir(parents=True, exist_ok=True)
        source.symlink_to(target, target_is_directory=True)
    (target / 'ExportManifest.json').write_bytes(manifest_bytes)
    print(f'Official published: {target} ({len(official_images)} content files)', flush=True)

    official_ids = {r['uniqueName']: r for r in official['entries']}
    textures = {r['textureLocation']: r for r in official['assets']}
    common = set(official_ids) & set(mapped)
    differences = []
    for uid, row in sorted(official_ids.items()):
        if uid in mapped:
            continue
        basename = row['textureLocation'].split('!')[0].rsplit('/', 1)[-1]
        candidate = by_name.get(basename)
        differences.append({'id': uid, 'textureLocation': row['textureLocation'],
                            'officialAvailable': row['textureLocation'] in textures,
                            'exactFilenameCandidate': candidate['assetName'] if candidate else None})
    only_wfcd = sorted(set(mapped) - set(official_ids))
    wfcd_groups = collections.defaultdict(list)
    for row in references:
        wfcd_groups[row['id']].append(row)
    for row in differences:
        row['wfcdReferences'] = wfcd_groups.get(row['id'], [])
    name_pairs = []
    official_names = set()
    official_by_file = {r['file']: r for r in official_images}
    for row in official['assets']:
        name = row['textureLocation'].split('!')[0].rsplit('/', 1)[-1]
        official_names.add(name)
        if name in by_name:
            wf = by_name[name]
            orig = official_by_file[row['file']]
            name_pairs.append({'imageName': name, 'textureLocation': row['textureLocation'],
                               'sameBytes': wf['sha256'] == row['sha256'],
                               'sameDimensions': (wf['width'], wf['height']) == (orig['width'], orig['height'])})
    top_ids = {r['id'] for r in catalog['items'] if r['hasImage'] and r['imageKind'] == 'original'}
    restored_names = set(completion['addedImageNames'])
    missing_refs = [r for r in references if r['imageName'] not in by_name]
    unique_missing_refs = {(r['id'], r['imageName']): r for r in missing_refs}
    by_texture_directory = collections.Counter('/'.join(r['textureLocation'].split('/')[:-1]) for r in differences)
    report = {'checkedAt': now, 'wfcdCommit': snapshot['commit'],
              'officialManifestSha256': official['manifest']['sha256'],
              'basis': 'Complete pinned WFCD data/img tree versus the saved official Manifest. Raw files, unique byte contents, and exact item ID mappings are separate measures. Filename candidates do not prove item identity or identical pixels.',
              'completion': completion, 'wfcd': {**summary(images), 'mappedIds': len(mapped),
                  'topLevelOriginalIds': len(top_ids), 'extraNestedIds': len(set(mapped) - top_ids),
                  'ambiguousIds': len(ambiguous), 'uniqueMissingImageReferences': len(unique_missing_refs)},
              'official': {**summary(official_images), 'declaredIds': len(official_ids),
                  'textureUrls': len({r['textureLocation'] for r in official['entries']}),
                  'downloadedUrls': len(official['assets']),
                  'downloadedIds': sum(r['textureLocation'] in textures for r in official['entries']),
                  'failures': official['failures']},
              'idComparison': {'common': len(common), 'officialOnly': len(differences),
                  'wfcdOnly': len(only_wfcd),
                  'officialOnlyWithExactFilenameCandidate': sum(bool(r['exactFilenameCandidate']) for r in differences)},
              'filenameComparison': {'wfcdNames': len(by_name), 'officialBasenames': len(official_names),
                  'commonNames': len(set(by_name) & official_names),
                  'wfcdOnlyNames': sorted(set(by_name) - official_names),
                  'officialOnlyNames': sorted(official_names - set(by_name)),
                  'matchedTextureUrls': len(name_pairs),
                  'sameBytes': sum(r['sameBytes'] for r in name_pairs),
                  'sameDimensions': sum(r['sameDimensions'] for r in name_pairs)},
              'restoredReferenceKinds': dict(collections.Counter(r['kind'] for r in references if r['imageName'] in restored_names)),
              'restoredUnreferencedNames': sorted(restored_names - {r['imageName'] for r in references}),
              'officialOnlyDirectories': dict(by_texture_directory),
              'officialOnly': differences, 'wfcdOnlyIds': only_wfcd,
              'missingWfcdImageReferences': list(unique_missing_refs.values()),
              'ambiguousIds': ambiguous,
              'validation': {'wfcdGitBlobHashes': len(images), 'officialSha256Hashes': len(official_images),
                  'wfcdChecksumEntries': len(images),
                  'catalogUnchanged': catalog_path.read_bytes() == catalog_bytes,
                  'existingImageBytesUnchanged': True,
                  'officialLegacyPathResolvesToContent': source.samefile(target)}}
    assert report['validation']['catalogUnchanged']
    write(shared / 'image-library-comparison.json', report)
    # Compact report is suitable for versioned documentation; full evidence stays alongside images.
    compact = {k: v for k, v in report.items() if k not in ('officialOnly', 'wfcdOnlyIds', 'missingWfcdImageReferences', 'ambiguousIds')}
    write(ROOT / '文档/归档/数据报告/完整图库比较-2026-10-22.json', compact)
    evidence_dir = ROOT / 'artifacts/image-comparison'
    evidence_dir.mkdir(parents=True, exist_ok=True)
    write(evidence_dir / 'wfcd-reference-audit.json', references)
    print(json.dumps(compact, ensure_ascii=False, indent=2), flush=True)


if __name__ == '__main__':
    main()
