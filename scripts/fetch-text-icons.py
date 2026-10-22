#!/usr/bin/env python3
"""Explicit maintenance only: cache AUTO/PC text icons used by browse.wf, never scan the gallery.
Existing exact official texture paths are reused; missing assets are fetched from browse.wf.
Run node scripts/prepare-inline-tokens.mjs afterwards. No network is used by the app.
"""
import concurrent.futures, hashlib, json, pathlib, urllib.request, time
ROOT = pathlib.Path(__file__).resolve().parent.parent
source = ROOT / '世界状态上游/git/warframe-public-export-plus/ExportTextIcons.json'
icons = json.loads(source.read_text())
output = ROOT / 'src/ui/assets/text-icons'
output.mkdir(parents=True, exist_ok=True)
index_path = ROOT / 'src/data/text-icon-assets.json'
previous = json.loads(index_path.read_text()) if index_path.exists() else {'assets': []}
old = {a['texture']: a for a in previous['assets']}
chosen = {k: (v.get('DIT_AUTO') or v.get('DIT_PC')) for k, v in icons.items()}
chosen = {k: v for k, v in chosen.items() if v and v.startswith(('/Lotus/', '/EE/')) and v.endswith('.png')}
paths = sorted(set(chosen.values()))
official_path = ROOT / 'assets/content/official/index.json'
official = json.loads(official_path.read_text()) if official_path.exists() else {}
exact = {a['textureLocation'].split('!')[0]: a for a in official.get('assets', [])}
def obtain(texture):
    cached = old.get(texture)
    if cached and (output / cached['file']).exists():
        data = (output / cached['file']).read_bytes()
        if hashlib.sha256(data).hexdigest() == cached['sha256']:
            return texture, cached, None
    url = 'https://browse.wf' + texture
    for attempt in range(2):
        try:
            local = exact.get(texture)
            if local:
                data = (ROOT / 'assets/content/official/img' / local['file']).read_bytes()
                provenance = 'existing-official-exact-texture'
            else:
                req = urllib.request.Request(url, headers={'User-Agent': 'SourceWorkbench/text-icon-maintenance'})
                with urllib.request.urlopen(req, timeout=15) as response:
                    data = response.read(2 * 1024 * 1024 + 1)
                provenance = 'browse.wf'
            if not data.startswith(b'\x89PNG\r\n\x1a\n') or len(data) > 2 * 1024 * 1024:
                raise ValueError('not a supported PNG')
            digest = hashlib.sha256(data).hexdigest()
            filename = digest + '.png'
            (output / filename).write_bytes(data)
            return texture, {'texture': texture, 'url': url, 'file': filename, 'sha256': digest, 'bytes': len(data), 'source': provenance}, None
        except Exception as error:
            if attempt: return texture, None, str(error)
            time.sleep(.3)
assets, failures = {}, []
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
    for n, (texture, asset, error) in enumerate(pool.map(obtain, paths), 1):
        if asset: assets[texture] = asset
        else: failures.append({'texture': texture, 'error': error})
        if n % 75 == 0: print(f'{n}/{len(paths)} icons processed', flush=True)
manifest = {'mappingSource': str(source.relative_to(ROOT)), 'mappingSha256': hashlib.sha256(source.read_bytes()).hexdigest(), 'reference': '世界状态上游/git/browse.wf/text-icons.php', 'selection': 'DIT_AUTO then DIT_PC; no guessed key bindings or other platform fallback', 'tokens': {k: {'texture': v, 'file': assets[v]['file']} for k, v in chosen.items() if v in assets}, 'assets': list(assets.values()), 'failures': failures}
index_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({'tokens': len(manifest['tokens']), 'textures': len(assets), 'uniqueFiles': len(set(a['file'] for a in assets.values())), 'bytes': sum(p.stat().st_size for p in output.glob('*.png')), 'failures': len(failures)}, ensure_ascii=False), flush=True)
