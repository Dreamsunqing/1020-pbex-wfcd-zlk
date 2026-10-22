import json
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from image_resolver import ImageResolver


def item(uid, name, filename, category='Enemy'):
    return {'id': uid, 'name': name, 'zh': '', 'imageName': filename, 'category': category}


class ImageAssociationTests(unittest.TestCase):
    def test_unique_unowned_case_and_punctuation_can_resolve(self):
        enemy = item('e', 'Example', 'example-unit.png')
        resolver = ImageResolver({'ExampleUnit.png'}, {'e': enemy}, {})
        self.assertEqual(resolver.resolve(enemy)['file'], 'ExampleUnit.png')
        enemy['imageName'] = 'exampleunit.png'
        self.assertEqual(resolver.resolve(enemy)['method'], 'case-insensitive')

    def test_sigils_and_same_name_companions_are_not_enemies(self):
        for name, category in [('Jackal', 'Sigils'), ('Carrier', 'Sentinels'), ('Kuva', 'Misc')]:
            enemy = item('e', name, name.lower() + '.png')
            owner = item('o', name + ' actual item', name + '.png', category)
            result = ImageResolver({name + '.png'}, {'e': enemy, 'o': owner}, {}).resolve(enemy)
            self.assertFalse(result['file'])
            self.assertEqual(result['rejectedCandidates'][0]['file'], name + '.png')

    def test_ambiguous_candidates_and_near_names_are_not_guessed(self):
        enemy = item('e', 'Alad V', 'alad-v.png')
        result = ImageResolver({'AladV.png', 'Alad_V.png'}, {'e': enemy}, {}).resolve(enemy)
        self.assertEqual(result['method'], 'ambiguous')
        result = ImageResolver({'MutalistAladV.png'}, {'e': enemy}, {}).resolve(enemy)
        self.assertFalse(result['file'])

    def test_reviewed_reference_retains_original_field_and_has_provenance(self):
        enemy = item('enemy', 'Alad V', 'alad-v.png')
        portrait = item('portrait', 'Alad V Glyph', 'CorpusAvatarAladV.png', 'Glyphs')
        override = {'enemy': {'sourceId': 'portrait', 'expectedImageName': 'CorpusAvatarAladV.png', 'note': '头像参考图'}}
        result = ImageResolver({'CorpusAvatarAladV.png'}, {'enemy': enemy, 'portrait': portrait}, override).resolve(enemy)
        self.assertEqual(result['file'], 'CorpusAvatarAladV.png')
        self.assertEqual(result['kind'], 'reference')
        self.assertEqual(result['sourceId'], 'portrait')
        self.assertEqual(enemy['imageName'], 'alad-v.png')

    def test_changed_reviewed_source_fails_instead_of_silently_remapping(self):
        enemy = item('e', 'Enemy', 'enemy.png')
        source = item('source', 'Source', 'changed.png', 'Gear')
        resolver = ImageResolver({'changed.png'}, {'e': enemy, 'source': source}, {
            'e': {'sourceId': 'source', 'expectedImageName': 'reviewed.png', 'note': 'reference'}})
        with self.assertRaises(ValueError):
            resolver.resolve(enemy)

    def test_real_data_has_no_false_boss_sigil_or_carrier_associations(self):
        catalog = json.loads((ROOT / 'assets/content/catalog.json').read_text())
        enemies = [row for row in catalog['items'] if row['category'] == 'Enemy']
        by_id = {row['id']: row for row in catalog['items']}
        overrides = json.loads((ROOT / 'assets/enemy-image-overrides.json').read_text())['overrides']
        self.assertEqual(len(enemies), 638)
        self.assertEqual(sum(row['hasImage'] for row in enemies), len(overrides))
        for row in enemies:
            if row['hasImage']:
                source = by_id[row['imageSourceId']]
                self.assertEqual(row['resolvedImageName'], source['imageName'])
                self.assertEqual(row['imageKind'], 'reference')
                self.assertTrue(row['imageNote'])
                self.assertNotEqual(source['category'], 'Sigils')
            if row['name'] in ('Carrier', 'Kuva', 'Ambulas', 'Lephantis', 'Lynx', 'Phorid'):
                self.assertFalse(row['hasImage'], row['name'])
            if row['name'] == 'Jackal':
                self.assertEqual(row['resolvedImageName'], 'CorpusAvatarJackal.png')
            if row['name'] == 'Alad V':
                self.assertEqual(row['resolvedImageName'], 'CorpusAvatarAladV.png')
        report = json.loads((ROOT / 'assets/content/enemy-image-report.json').read_text())
        self.assertEqual({r['id'] for r in report['items']}, {r['id'] for r in enemies})
        readme = (ROOT / 'README.md').read_text()
        for row in enemies:
            if not row['hasImage']:
                self.assertIn(row['name'], readme)


if __name__ == '__main__':
    unittest.main()
