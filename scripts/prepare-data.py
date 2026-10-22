#!/usr/bin/env python3
"""Maintainer-only: build a self-contained catalogue from a single upstream archive."""
import argparse
import collections
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tarfile
import urllib.request
from image_resolver import ImageResolver
from enemy_report import write_enemy_report

ROOT = Path(__file__).resolve().parents[1]
CATEGORIES = {
    'Warframes': '战甲', 'Primary': '主武器', 'Secondary': '副武器', 'Melee': '近战武器',
    'Arch-Gun': '重型武器', 'Arch-Melee': 'Archwing 近战', 'Archwing': 'Archwing',
    'SentinelWeapons': '守护武器', 'Sentinels': '守护', 'Pets': '同伴',
    'Mods': 'Mod', 'Arcanes': '赋能', 'Resources': '资源', 'Components': '制作部件',
    'Relics': '遗物', 'Gear': '携带道具', 'Skins': '外观', 'Glyphs': '浮印',
    'Sigils': '纹章', 'Honoria': '誉纹', 'Fish': '鱼类', 'Enemy': '敌人',
    'Quests': '系列任务', 'Railjack': '航道星舰', 'Node': '星图节点', 'Misc': '其他物品',
}


def clean(text):
    return re.sub(r'\s+', ' ', re.sub(r'<[^>]*>', '', str(text or ''))).strip()


def disk_name(name):
    # Upstream contains names differing only by case: Windows/macOS would overwrite them.
    return hashlib.sha256(name.encode('utf-8')).hexdigest()[:24] + Path(name).suffix.lower()


def image_references(value):
    if isinstance(value, dict):
        if value.get('uniqueName') and value.get('imageName'):
            yield value['uniqueName'], value['imageName']
        for child in value.values():
            yield from image_references(child)
    elif isinstance(value, list):
        for child in value:
            yield from image_references(child)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--archive', type=Path, default=ROOT / '.cache/warframe-items.tar.gz')
    parser.add_argument('--refresh', action='store_true')
    args = parser.parse_args()
    args.archive.parent.mkdir(parents=True, exist_ok=True)
    if args.refresh or not args.archive.exists():
        snapshot = ROOT / '世界状态上游/wfcd-items-snapshot.json'
        if snapshot.exists() and not args.refresh:
            sha = json.loads(snapshot.read_text(encoding='utf-8'))['commit']
        else:
            sha = subprocess.check_output(['git', 'ls-remote', 'https://github.com/WFCD/warframe-items.git',
                                          'refs/heads/master'], text=True).split()[0]
        url = f'https://codeload.github.com/WFCD/warframe-items/tar.gz/{sha}'
        print(f'Downloading source snapshot {sha}', flush=True)
        request = urllib.request.Request(url, headers={'User-Agent': 'WarframeGuideImages/1.0'})
        temp = args.archive.with_suffix('.download')
        with urllib.request.urlopen(request, timeout=120) as source, temp.open('wb') as output:
            shutil.copyfileobj(source, output)
        os.replace(temp, args.archive)

    staging = ROOT / 'assets/content/wfcd.next'
    if staging.exists():
        shutil.rmtree(staging)
    (staging / 'img').mkdir(parents=True)
    catalogs = {}
    images = set()
    sha = None
    source_time = None
    upstream_license = ''
    print('Reading categories and images…', flush=True)
    # Never extract arbitrary paths from the external tarball.
    with tarfile.open(args.archive, 'r:gz') as archive:
        sha = archive.pax_headers.get('comment')
        for member in archive:
            parts = member.name.split('/', 1)
            if len(parts) != 2 or not member.isfile():
                continue
            path = parts[1]
            if path == 'LICENSE':
                upstream_license = archive.extractfile(member).read().decode('utf-8')
            if path.startswith('data/json/') and path.endswith('.json'):
                relative = path[len('data/json/'):]
                if '/' not in relative or relative == 'i18n/zh.json':
                    catalogs[relative] = json.load(archive.extractfile(member))
                    source_time = max(source_time or 0, member.mtime)
            elif path.startswith('data/img/'):
                name = path[len('data/img/'):]
                if '/' not in name and name and name not in ('.', '..'):
                    images.add(name)
                    with (staging / 'img' / disk_name(name)).open('wb') as output:
                        shutil.copyfileobj(archive.extractfile(member), output)

    if not re.fullmatch(r'[a-f0-9]{40}', sha or ''):
        raise RuntimeError('Archive has no valid commit ID; use --refresh to fetch a pinned snapshot')
    translations = catalogs.pop('i18n/zh.json')
    merged = {}
    conflicts = []
    unknown_categories = []
    for filename, rows in sorted(catalogs.items()):
        category = filename[:-5]
        if not isinstance(rows, list):
            raise RuntimeError(f'Unexpected catalogue shape: {filename}')
        if category not in CATEGORIES:
            unknown_categories.append(category)
        for raw in rows:
            uid = raw.get('uniqueName')
            if not uid:
                raise RuntimeError(f'Missing uniqueName in {filename}')
            if uid in merged:
                merged[uid]['sources'].append(category)
                if merged[uid]['imageName'] != raw.get('imageName', ''):
                    conflicts.append(uid)
                continue
            zh = translations.get(uid, {})
            merged[uid] = {
                'id': uid, 'name': clean(raw.get('name')), 'zh': clean(zh.get('name')),
                'category': category, 'sources': [category],
                'imageName': raw.get('imageName', ''), 'type': clean(raw.get('type')),
                'description': clean(zh.get('description') or raw.get('description')),
                'parents': list(raw.get('parentUniqueNames', [])),
                'children': [ref['uniqueName'] for ref in raw.get('components', []) if ref.get('uniqueName')],
            }

    for row in merged.values():
        for child in row['children']:
            if child in merged and row['id'] not in merged[child]['parents']:
                merged[child]['parents'].append(row['id'])
    missing = []
    untranslated = []
    referenced_images = set()
    override_file = ROOT / 'assets/enemy-image-overrides.json'
    overrides = json.loads(override_file.read_text(encoding='utf-8'))['overrides']
    stale_overrides = set(overrides) - set(merged)
    if stale_overrides:
        raise RuntimeError(f'Stale enemy image overrides: {sorted(stale_overrides)}')
    resolver = ImageResolver(images, merged, overrides)
    enemy_report = []
    for row in merged.values():
        # Other categories retain their existing exact associations; enemy aliases
        # require semantic review so a boss sigil cannot become a boss portrait.
        match = resolver.resolve(row) if row['category'] == 'Enemy' else {
            'file': row['imageName'] if row['imageName'] in images else '', 'method': 'exact',
            'kind': 'original', 'sourceId': row['id'], 'sourceLabel': row['zh'] or row['name'], 'note': '',
        }
        row['resolvedImageName'] = match['file']
        row['hasImage'] = bool(match['file'])
        row['assetName'] = disk_name(match['file']) if row['hasImage'] else ''
        row['imageKind'] = match['kind'] if row['hasImage'] else 'missing'
        row['imageMatch'] = match['method'] if row['hasImage'] else 'missing'
        row['imageNote'] = match['note']
        row['imageSourceId'] = match['sourceId'] if row['hasImage'] else ''
        row['imageSourceLabel'] = match['sourceLabel'] if row['hasImage'] else ''
        if row['category'] == 'Enemy':
            enemy_report.append({'id': row['id'], 'name': row['name'], 'zh': row['zh'],
                                 'originalImageName': row['imageName'], **match})
        if row['hasImage']:
            referenced_images.add(match['file'])
        else:
            missing.append({'id': row['id'], 'imageName': row['imageName']})
        if not row['zh']:
            untranslated.append(row['id'])
        row['parents'] = sorted(set(p for p in row['parents'] if p in merged))
        row['children'] = sorted(set(c for c in row['children'] if c in merged))
        row['label'] = row['zh'] or row['name']
        row['englishLabel'] = row['name']
        if row['category'] == 'Components' and row['parents']:
            parent = merged[row['parents'][0]]
            parent_zh = parent['zh'] or parent['name']
            if parent_zh.casefold() not in row['label'].casefold():
                row['label'] = f"{parent_zh} · {row['label']}"
            if parent['name'].casefold() not in row['englishLabel'].casefold():
                row['englishLabel'] = f"{parent['name']} {row['englishLabel']}"

    # Keep the entire upstream tree. Abilities are nested, and some valid assets
    # currently have no item reference; top-level catalogue reachability is not
    # an image retention policy.
    counts = collections.Counter(row['category'] for row in merged.values())
    with_images = collections.Counter(row['category'] for row in merged.values() if row['hasImage'])
    category_list = [{'id': key, 'label': label, 'count': counts[key], 'withImages': with_images[key]}
                     for key, label in CATEGORIES.items() if counts[key]]
    category_list += [{'id': key, 'label': key, 'count': counts[key], 'withImages': with_images[key]}
                      for key in unknown_categories if counts[key]]
    from datetime import datetime, timezone
    manifest = {
        'schemaVersion': 1, 'source': 'https://github.com/WFCD/warframe-items',
        'commit': sha, 'sourceDate': datetime.fromtimestamp(source_time, timezone.utc).isoformat(),
        'builtAt': datetime.now(timezone.utc).isoformat(),
        'itemCount': len(merged), 'imageCount': len(images),
        'referencedImageCount': len(referenced_images),
        'itemsWithImages': sum(with_images.values()), 'missingImageCount': len(missing),
        'missingTranslationCount': len(untranslated), 'duplicateImageConflicts': len(conflicts),
        'imageBytes': sum((staging / 'img' / disk_name(name)).stat().st_size for name in images),
        'enemyImages': {'total': len(enemy_report),
                        'original': sum(r['kind'] == 'original' and bool(r['file']) for r in enemy_report),
                        'reference': sum(r['kind'] == 'reference' for r in enemy_report),
                        'missing': sum(not r['file'] for r in enemy_report)},
        'categories': category_list,
    }
    (staging / 'catalog.json').write_text(json.dumps({'meta': manifest, 'items': list(merged.values())},
                                                    ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    hashes = {disk_name(name): hashlib.sha256((staging / 'img' / disk_name(name)).read_bytes()).hexdigest()
              for name in sorted(images)}
    hashes['catalog.json'] = hashlib.sha256((staging / 'catalog.json').read_bytes()).hexdigest()
    (staging / 'checksums.json').write_text(json.dumps(hashes, indent=2), encoding='utf-8')
    refs = collections.defaultdict(set)
    for rows in catalogs.values():
        for uid, name in image_references(rows):
            if name in images:
                refs[uid].add(name)
    index = {'schemaVersion': 1, 'source': manifest['source'], 'commit': sha,
             'checkedAt': manifest['builtAt'],
             'images': [{'imageName': name, 'assetName': disk_name(name),
                         'sha256': hashes[disk_name(name)],
                         'bytes': (staging / 'img' / disk_name(name)).stat().st_size}
                        for name in sorted(images)],
             'mappings': [{'id': uid, 'imageName': next(iter(names)),
                           'assetName': disk_name(next(iter(names)))}
                          for uid, names in sorted(refs.items()) if len(names) == 1],
             'ambiguousIds': {uid: sorted(names) for uid, names in refs.items() if len(names) > 1}}
    (staging / 'wfcd-image-index.json').write_text(json.dumps(index, ensure_ascii=False, indent=2), encoding='utf-8')
    (staging / 'UPSTREAM-LICENSE.txt').write_text(upstream_license, encoding='utf-8')
    report = {'meta': manifest, 'missingImages': missing, 'missingTranslations': untranslated,
              'conflictingImageRecords': conflicts, 'unknownCategories': unknown_categories}
    (staging / 'data-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    write_enemy_report(enemy_report, manifest, staging, ROOT)
    target = ROOT / 'assets/content/wfcd'
    if target.exists():
        # Only replace WFCD-owned outputs. The official library and independently
        # generated comparison reports also live in content and must survive sync.
        # Keep the old img tree until its replacement is in place, then remove it.
        old_images = target / 'img.previous-sync'
        if old_images.exists():
            raise RuntimeError('An interrupted image sync requires review: ' + str(old_images))
        (target / 'img').rename(old_images)
        try:
            (staging / 'img').rename(target / 'img')
        except BaseException:
            old_images.rename(target / 'img')
            raise
        shutil.rmtree(old_images)
        for generated in staging.iterdir():
            generated.replace(target / generated.name)
        staging.rmdir()
    else:
        staging.rename(target)
    print(json.dumps(manifest, ensure_ascii=False, indent=2), flush=True)


if __name__ == '__main__':
    main()
