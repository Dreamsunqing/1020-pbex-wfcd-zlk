#!/usr/bin/env python3
"""Extract only official Descendia drop tables. Usage: python3 工具/更新沉沦之地奖励.py [--html downloaded.html]"""
import argparse
import hashlib
import json
import re
import urllib.request
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path

URL = 'https://www.warframe.com/droptables'
ROOT = Path(__file__).resolve().parent.parent


class Tables(HTMLParser):
    def __init__(self):
        super().__init__()
        self.groups, self.current, self.cells, self.cell = {}, None, [], None
        self.row_id = None

    def handle_starttag(self, tag, attrs):
        if tag == 'tr':
            self.cells = []
            self.row_id = dict(attrs).get('id')
            if self.row_id:
                self.current = None
        elif tag in ('th', 'td'):
            self.cell = []

    def handle_data(self, data):
        if self.cell is not None:
            self.cell.append(data)

    def handle_endtag(self, tag):
        if tag in ('th', 'td') and self.cell is not None:
            self.cells.append(''.join(self.cell).strip())
            self.cell = None
        elif tag == 'tr':
            if self.row_id and self.cells and self.cells[0].startswith('The Descendia:'):
                self.current = self.cells[0]
                self.groups[self.current] = {'anchor': self.row_id, 'rows': []}
            elif self.current and len(self.cells) == 2 and self.cells[0]:
                self.groups[self.current]['rows'].append(self.cells)


def build(html_bytes):
    parser = Tables()
    parser.feed(html_bytes.decode('utf-8'))
    expected = [
        'Infernum 20 Triple Arcane Rewards', 'Infernum 6 and 13 Arcane Rewards (Steel Path)',
        'Common Rewards (Steel Path)', 'Rare Rewards (Steel Path)', 'Uncommon Rewards (Steel Path)',
        'Steel Essence Rewards (Steel Path)', 'Infernum 20 Triple Arcane Rewards (Steel Path)', 'Roathe'
    ]
    if any('The Descendia: ' + name not in parser.groups for name in expected):
        raise ValueError('官方页面缺少已知沉沦之地表，拒绝覆盖')
    base = ROOT / '世界状态上游/git/warframe-public-export-plus'
    read = lambda name: json.loads((base / (name + '.json')).read_text())
    english = read('dict.en')
    entities, names = {}, {}
    for filename in ['ExportResources', 'ExportArcanes', 'ExportUpgrades', 'ExportBoosters', 'ExportCreditBundles', 'ExportWeapons', 'ExportWarframes']:
        entities.update(read(filename))
    for key, record in entities.items():
        name = english.get(record.get('name'), record.get('name', ''))
        name = re.sub(r'<[^>]+>\s*', '', name)
        if name:
            names.setdefault(name.casefold(), set()).add(key)
    # Exact result ID + exact English result name; never fuzzy-match filenames.
    for key, record in read('ExportRecipes').items():
        result = entities.get(record.get('resultType'), {})
        name = english.get(result.get('name'), result.get('name', ''))
        if name:
            names.setdefault((name + ' Blueprint').casefold(), set()).add(key)
    overrides = {
        'Melee Riven Mod': '/Lotus/Upgrades/Mods/Randomized/RawMeleeRandomMod',
        'Pistol Riven Mod': '/Lotus/Upgrades/Mods/Randomized/RawPistolRandomMod',
        'Rifle Riven Mod': '/Lotus/Upgrades/Mods/Randomized/RawRifleRandomMod',
        'Shotgun Riven Mod': '/Lotus/Upgrades/Mods/Randomized/RawShotgunRandomMod',
        'Zaw Riven Mod': '/Lotus/Upgrades/Mods/Randomized/RawModularMeleeRandomMod',
        'Kitgun Riven Mod': '/Lotus/Upgrades/Mods/Randomized/RawModularPistolRandomMod',
        'Steel Essence': '/Lotus/Types/Items/MiscItems/SteelEssence',
    }
    output, unresolved = {}, []
    for name, group in parser.groups.items():
        rewards = []
        for raw, chance in group['rows']:
            match = re.search(r'\(([\d.]+)%\)', chance)
            if not match:
                raise ValueError('无法识别概率：' + chance)
            count = re.match(r'^(\d+)X\s+(.+)$', raw)
            quantity, item_name = (int(count[1]), count[2]) if count else (1, raw)
            duration = re.match(r'^(\d+) Day (.+)$', item_name)
            stats = [duration[1] + ' 天'] if duration else []
            lookup = duration[2] if duration else item_name
            ids = names.get(lookup.casefold(), set())
            item_id = overrides.get(lookup) or (next(iter(ids)) if len(ids) == 1 else None)
            if not item_id:
                unresolved.append({'table': name, 'name': lookup, 'candidates': sorted(ids)})
            rewards.append({'id': item_id, 'englishName': item_name, 'rawName': raw, 'quantity': quantity,
                            'probability': float(match[1]) / 100, 'stats': stats})
        if not rewards or abs(sum(r['probability'] for r in rewards) - 1) > .005:
            raise ValueError('奖励表为空或概率总和异常：' + name)
        output[name] = {'source': URL + '#' + group['anchor'], 'rewards': rewards}
    return {'schemaVersion': 1, 'source': URL, 'retrievedAt': datetime.now(timezone.utc).isoformat(),
            'sourceHash': hashlib.sha256(html_bytes).hexdigest(), 'tables': output, 'unresolved': unresolved}


if __name__ == '__main__':
    args = argparse.ArgumentParser(description=__doc__)
    args.add_argument('--html', type=Path, help='从已下载的官方 HTML 离线提取')
    parsed = args.parse_args()
    data = parsed.html.read_bytes() if parsed.html else urllib.request.urlopen(URL, timeout=30).read()
    result = build(data)
    target = ROOT / 'src/data/live-state/descent-reward-tables.json'
    temporary = target.with_suffix('.tmp')
    temporary.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    temporary.replace(target)
    print(f'已更新 {len(result["tables"])} 张表；未精确关联 {len(result["unresolved"])} 项。{target}')
