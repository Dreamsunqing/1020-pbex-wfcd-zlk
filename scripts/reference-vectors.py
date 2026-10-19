"""独立 Python/IEEE754 参考实现，生成固定测试向量；不属于应用运行依赖。"""
import json, pathlib, re, struct, zlib, hashlib

root = pathlib.Path(__file__).resolve().parents[1]
warframe_file = root / '世界状态上游/git/warframe-public-export-plus/ExportWarframes.json'
oracle_file = root / '世界状态上游/git/wf.browse.oracle/invigorations.pluto'
frames = json.loads(warframe_file.read_text())
source = oracle_file.read_text()
pool = []
for item in frames.values():
    suit = item.get('parentName')
    if item.get('productCategory') == 'Suits' and suit != '/Lotus/Powersuits/Excalibur/DarkExcalibur' and suit not in pool:
        pool.insert(0, suit)
excal = '/Lotus/Powersuits/Excalibur/ExcaliburBaseSuit'
pool = [excal] + [x for x in pool if x != excal]
off = re.findall(r'ItemType = "([^"]+)"', source.split('local WeightedOffensiveUpgrades = {')[1].split('response.offensiveUpgrades')[0])
defense = re.findall(r'ItemType = "([^"]+)"', source.split('local WeightedDefensiveUpgrades = {')[1].split('if "/Lotus/Powersuits/IronFrame')[0])

def f32(x):
    return struct.unpack('<f', struct.pack('<f', x))[0]

class Rng:
    def __init__(self, seed):
        self.seed = seed
    def next(self):
        self.seed = (0x5851F42D4C957F2D * self.seed + 0x14057B7EF767814F) % (2**64)
        return (self.seed >> 32) & 0xffffffff
    def integer(self, a, b):
        return a + (self.next() & 0x3fffffff) % (b-a+1)
    def random(self):
        return f32(f32(f32((self.next() >> 6) & 0xffffff) * f32(0.000000059604645)))

def sample(values, rng, excluded=()):
    items = [[x, 0 if x in excluded else 1] for x in values]
    total = sum(x[1] for x in items)
    result = []
    for _ in range(3):
        value = rng.random() * total
        for i, (item, weight) in enumerate(items):
            if value < weight:
                result.append(item)
                total -= weight
                items.pop(i)
                break
            value -= weight
        else:
            raise ValueError('sampling overflow')
    return result

cases = []
for name, week, observed in [('WorkbenchTest',662,[]),('workbenchtest',662,[]),('Test0',661,[]),('Test19',663,[]),('账号CaseTest',662,pool[:3]),('WorkbenchTest',662,pool[5:8])]:
    seed = int(f32(f32(zlib.crc32(name.encode())) + f32(Rng(week).integer(1,1000000))))
    rng = Rng(seed)
    suits = sample(pool, rng, observed)
    offensive = sample(off, rng)
    special = any('/IronFrame/' in x or '/Alchemist/' in x for x in suits)
    defensive = sample([x for x in defense if not special or not re.search(r'InvigorationEnergy(Regen)?$',x)], rng)
    cases.append(dict(username=name,week=week,observed=observed,suits=suits,offensive=offensive,defensive=defensive))
result = dict(provenance='Independent Python struct float32 + zlib CRC32 port of cached Oracle semantics; not game observation',sourceSha256=hashlib.sha256(oracle_file.read_bytes()).hexdigest(),warframesSha256=hashlib.sha256(warframe_file.read_bytes()).hexdigest(),cases=cases)
output=root/'test/fixtures/oracle-vectors.json'
output.parent.mkdir(parents=True,exist_ok=True)
output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(output)
