import test from 'node:test';
import assert from 'node:assert/strict';
import { rewardContexts } from '../src/core/merge/reward-context.mjs';
test('奖励说明只按完整引用关联；清单档位、中文节点与遗物名可追溯，未知表不猜活动', () => {
  const bounty = '/Lotus/Types/Game/MissionDecks/Test/Bounty', relic = '/Lotus/Types/Game/MissionDecks/VoidKeyMissionRewards/Test', region = '/Lotus/Types/Game/MissionDecks/SurvivalMissionRewards/Test', unknown = '/NotKnown';
  const files = [
    ['oracle/data/ZarimanJobManifest.json', 'oracle', { data: { ChallengeMissionDifficultyTiers: [{ rewards: bounty, stageCount: 3, enemyLevel: [10,20] }] } }],
    ['plus/ExportRegions.json', 'plus', { Node1: { name: '/Lotus/Language/Name', systemName: '/Lotus/Language/Place', missionName: '/Lotus/Language/Mission', rewardManifests: [region] } }],
    ['plus/ExportRelics.json', 'plus', { '/Relic': { rewardManifest: relic, description: '/Lotus/Language/Desc' } }],
    ['plus/dict.zh.json', 'plus', { '/Lotus/Language/Name': '测试节点', '/Lotus/Language/Place': '水星', '/Lotus/Language/Mission': '生存', '/Lotus/Language/Desc': '开启后获得物品' }]
  ];
  const output = { 'reward-tables.json': [bounty,relic,region,unknown].map(id=>({id,manifests: id===bounty ? [{ input:0,pointer:'/data/ChallengeMissionDifficultyTiers/0/rewards' }] : []})), 'reports/coverage.json': { files:files.map(([file,source],i)=>({file,source,reference:'ref'+i})) }, 'search.zh-CN.json':[{id:'/Relic',title:'古纪 A1 完好遗物'}] };
  files.forEach((f,i)=>output['ref'+i]=f[2]); const data={output,manifest:{inputs:files.map(([file,source])=>({file,source,hash:'a'.repeat(64)}))}};
  const before=JSON.stringify(data), contexts=rewardContexts(data);
  assert.equal(contexts.get(bounty).title,'扎里曼 · 赏金第 1 档');assert.match(contexts.get(bounty).description,/10—20 · 3 阶段/);assert.match(contexts.get(bounty).description,/尚未确认/);
  assert.equal(contexts.get(region).title,'水星 · 测试节点 · 生存');assert.equal(contexts.get(region).basis,'exact-reference');
  assert.equal(contexts.get(relic).title,'古纪 A1 完好遗物');assert.equal(contexts.get(relic).origins[0].source.pointer,'/~1Relic/rewardManifest');
  assert.equal(contexts.get(unknown).basis,'unknown');assert.equal(contexts.get(unknown).origins.length,0);
  assert.equal(JSON.stringify(data),before);assert.equal(rewardContexts(data),contexts);
});
