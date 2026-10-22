"""Conservative local-only image association; never guess enemies from name alone."""
import collections
from pathlib import Path
import re
import unicodedata


def normalize_image(name):
    stem = Path(name).stem
    return re.sub(r'[^a-z0-9]', '', unicodedata.normalize('NFKC', stem).casefold())


class ImageResolver:
    def __init__(self, images, items, overrides):
        self.images = set(images)
        self.items = items
        self.overrides = overrides
        self.casefold = collections.defaultdict(list)
        self.normalized = collections.defaultdict(list)
        self.owners = collections.defaultdict(list)
        for name in sorted(self.images):
            self.casefold[name.casefold()].append(name)
            self.normalized[normalize_image(name)].append(name)
        for item in items.values():
            if item['imageName'] in self.images:
                self.owners[item['imageName']].append(item)

    def resolve(self, item):
        raw = item['imageName']
        manual = self.overrides.get(item['id'])
        if manual:
            source = self.items.get(manual['sourceId'])
            if not source or source['imageName'] != manual['expectedImageName'] or source['imageName'] not in self.images:
                raise ValueError(f"Reviewed source changed or disappeared: {item['id']}")
            return {'file': source['imageName'], 'method': 'reviewed-reference',
                    'kind': 'reference', 'sourceId': source['id'],
                    'sourceLabel': source['zh'] or source['name'],
                    'note': manual['note'], 'rejectedCandidates': []}

        candidates = [(raw, 'exact')] if raw in self.images else []
        if not candidates:
            candidates = [(name, 'case-insensitive') for name in self.casefold.get(raw.casefold(), [])]
        if not candidates:
            candidates = [(name, 'normalized-name') for name in self.normalized.get(normalize_image(raw), [])]
        rejected = []
        if item['category'] == 'Enemy':
            safe = []
            for name, method in candidates:
                other_owners = [owner for owner in self.owners[name] if owner['category'] != 'Enemy']
                if other_owners:
                    rejected.append({'file': name, 'owners': [owner['name'] for owner in other_owners],
                                     'reason': '同名图片属于其他条目，未作为该敌人的图片使用'})
                else:
                    safe.append((name, method))
            candidates = safe
        if len(candidates) == 1:
            name, method = candidates[0]
            return {'file': name, 'method': method, 'kind': 'original', 'sourceId': item['id'],
                    'sourceLabel': item['zh'] or item['name'], 'note': '', 'rejectedCandidates': rejected}
        return {'file': '', 'method': 'ambiguous' if len(candidates) > 1 else 'missing', 'kind': 'missing',
                'sourceId': '', 'sourceLabel': '',
                'note': '存在多个候选，需单独核对' if len(candidates) > 1 else '当前 WFCD 快照没有可确认对应的敌人图片',
                'rejectedCandidates': rejected}
