"""Independent integer-only reference for the three cached Oracle Pluto programs.

Generate committed vectors; this script is not used by the application.
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
UPSTREAM = ROOT / '世界状态上游/git/wf.browse.oracle'
MASK = (1 << 64) - 1
ALLIES = [f'/Lotus/Types/Gameplay/1999Wf/ProtoframeAllies/{name}AllyAgent'
          for name in ['Amir', 'Aoi', 'Arthur', 'Eleanor', 'Lettie', 'Quincy']]
EXCLUDED = dict(zip(['SolNode851', 'SolNode853', 'SolNode856', 'SolNode850', 'SolNode852', 'SolNode854'], ALLIES))


class Random:
    def __init__(self, seed):
        self.seed = seed

    def churn(self):
        self.seed = (0x5851F42D4C957F2D * self.seed + 0x14057B7EF767814F) & MASK
        return (self.seed >> 32) & 0xffffffff

    def integer(self, minimum, maximum):
        if minimum == maximum:
            return minimum
        return minimum + (self.churn() & 0x3fffffff) % (maximum - minimum + 1)

    def shuffle(self, values):
        values = list(values)
        for size in range(len(values), 1, -1):
            index = self.integer(1, size) - 1
            values[index], values[size - 1] = values[size - 1], values[index]
        return values


def normalise(challenge):
    name = challenge.split('/')[-1]
    for suffix in ['Easy', 'VeryHard', 'Hard', 'Challenge']:
        if suffix in name:
            return name[:name.index(suffix)]
    return name


def challenges(manifest, seed, agents=None):
    rng = Random(seed)
    nodes = rng.shuffle(manifest['ChallengeMissionNodes'])
    lich_nodes = ['SolNode852', 'SolNode850', 'SolNode854'] if agents is not None else list(nodes)
    if agents is not None:
        agents = list(agents)
        if 0 < len(agents) < len(nodes):
            candidates = rng.shuffle(['SolNode851', 'SolNode852', 'SolNode853', 'SolNode854'])
            while len(agents) < len(nodes) and candidates:
                node = candidates.pop(0)
                if node in nodes:
                    nodes.remove(node)
        agents = rng.shuffle(agents)
        for index in range(min(len(nodes), len(agents))):
            if agents[index] == EXCLUDED.get(nodes[index]):
                next_index = (index + 1) % len(agents)
                agents[index], agents[next_index] = agents[next_index], agents[index]
    faction = ['FC_GRINEER', 'FC_CORPUS'][seed & 1]
    seen, result = set(), []
    for index, tier in enumerate(manifest['ChallengeMissionDifficultyTiers']):
        node = nodes[index] if index < len(nodes) else lich_nodes[rng.integer(1, len(lich_nodes)) - 1]
        new, old = [], []
        for entry in tier['challenges']:
            if entry['Node'] not in ['', node] or (entry['CheckFaction'] and entry['Faction'] != faction):
                continue
            for challenge in entry['challenges']:
                (old if normalise(challenge) in seen else new).append(challenge)
        candidates = new or old
        challenge = candidates[rng.integer(1, len(candidates)) - 1]
        seen.add(normalise(challenge))
        row = {'node': node, 'challenge': challenge}
        if agents is not None and index < len(nodes) and index < len(agents):
            row['ally'] = agents[index]
        result.append(row)
    return result


def locations(manifest, seed, prefix):
    rng, result = Random(seed), []
    for row in manifest['LocationSpecificJobs']:
        flags = rng.shuffle([i < row['NumJobsToShow'] for i in range(len(row['Jobs']))])
        result.append({'location': row['LocationTag'], 'jobs': [prefix + job for i, job in enumerate(row['Jobs']) if flags[i]]})
    return result


def main():
    manifest = lambda name: json.loads((UPSTREAM / 'data' / name).read_text())['data']
    challenge_files = ['ZarimanJobManifest.json', 'EntratiLabsJobManifest.json', 'WF1999JobManifest.json']
    location_files = [('EidolonJobManifest.json', 'Eidolon'), ('VenusJobManifest.json', 'Venus'), ('MicroplanetJobManifest.json', 'InfestedMicroplanet')]
    cases = []
    for seed in [0, 1, 24091, -1, 2 ** 32, 2 ** 63 - 1, 2 ** 64 - 1]:
        cases.append({'seed': str(seed), 'challenges': {name: challenges(manifest(name), seed, ALLIES if name == 'WF1999JobManifest.json' else None) for name in challenge_files},
                      'locations': {name: locations(manifest(name), seed, f'/Lotus/Types/Gameplay/{region}/Jobs/') for name, region in location_files}})
    partial = {'seed': '24091', 'allies': ALLIES[:4], 'result': challenges(manifest('WF1999JobManifest.json'), 24091, ALLIES[:4])}
    output = {'source': 'Independent Python port of cached Oracle Pluto, 64-bit wrap, no application imports', 'cases': cases, 'partialAllies': partial}
    (ROOT / 'test/fixtures/oracle-bounty-vectors.json').write_text(json.dumps(output, ensure_ascii=False, indent=2) + '\n')
    print(f'Wrote {len(cases)} seed vectors and a partial-allies case')


if __name__ == '__main__':
    main()
