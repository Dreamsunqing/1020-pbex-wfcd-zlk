import { bountyCycle, locationBounties, CHALLENGE_MANIFESTS } from '../oracle-bounties.mjs';
import { describeOracle } from '../oracle-data.mjs';
import { rewardResolver } from '../oracle-rewards.mjs';
import { selectOracleState } from '../oracle-state.mjs';
import { bountyRegion } from './card-states.mjs';

const list=value=>Array.isArray(value)?value.filter(Boolean):[];
const han=value=>typeof value==='string'&&/\p{Script=Han}/u.test(value);

// Shared reward translation and quantity conversion; table/pool identities never flatten.
export function worldBountyRewards(catalog){
  const resolve=rewardResolver({rewardTables:catalog.plus.ExportRewards,rewardCatalogs:Object.fromEntries(Object.entries(catalog.plus).filter(([key])=>key.startsWith('Export')).map(([key,value])=>[key+'.json',value])),rewardDictionaries:{'plus/dict.zh.json':catalog.dictionary}});
  const reward=raw=>{
    const info=catalog.item(raw.type??raw.key),converted=Boolean(raw.conversion);
    return {...raw,...info,name:converted?raw.name:han(info.name)?info.name:raw.name,quantity:raw.quantity??undefined,
      localization:han(info.name)||raw.localization==='upstream'?'upstream':'missing',
      nameSource:converted?raw.nameSource:han(info.name)?{file:info.source,rule:info.nameSource??'完整物品 ID → 字段字典／官方中文',base:raw.nameSource}:raw.nameSource};
  };
  const table=key=>{const value=resolve.table(key);return {...value,pools:value.pools.map(pool=>({...pool,items:pool.items.map(reward)}))};};
  return {table,reward};
}

export function buildWorldBounties(snapshot,catalog,{at,activeSyndicates}){
  const regions=new Map(),warnings=[],resolve=worldBountyRewards(catalog);
  const region=tag=>{
    if(!regions.has(tag)){
      const syndicate=catalog.label(tag,'syndicates',snapshot.server),r=bountyRegion(tag,syndicate.fallback?'其他地区':syndicate.name);
      regions.set(tag,{title:r.name,subtitle:syndicate.fallback?'':syndicate.name,kind:tag,chips:[r.category],iconToken:'BOUNTY',items:[]});
    }
    return regions.get(tag);
  };
  for(const row of activeSyndicates){
    if(!row.jobs?.length)continue;
    const r=region(row.tag);Object.assign(r,{startsAt:row.activation,endsAt:row.expiry});
    list(row.jobs).forEach((job,index)=>{
      const key=job.jobType??job.type??job.JobType,info=catalog.item(key),table=resolve.table(job.rewards);
      r.items.push({...info,title:row.tag==='EntratiSyndicate'&&index>=6&&index<=8?'隔离库任务 '+['I','II','III'][index-6]:info.name==='名称待补充'?'第 '+(index+1)+' 档':info.name,category:'current',categoryName:'当前赏金',
        stats:[job.minEnemyLevel!==undefined?'等级 '+job.minEnemyLevel+'–'+job.maxEnemyLevel:null].filter(Boolean),
        rewardTables:[table],rewardStatus:'world-state',
        fixed:{xpAmount:job.xpAmounts},reference:{basis:'SyndicateMissions.Jobs',tag:row.tag,index,job}});
    });
  }
  let state;
  try{state=selectOracleState(JSON.stringify({SyndicateMissions:snapshot.raw.SyndicateMissions??[]}),{at,source:snapshot.source??'snapshot'});}catch(error){warnings.push('赏金种子：'+error.message);}
  const context={state,at};
  for(const scope of ['cycle','locations']){
    const data=catalog.oracleData?.[scope];if(!data||!state)continue;
    try{
      const result=describeOracle(scope==='cycle'?bountyCycle(data.manifests,context):locationBounties(data.manifests,context),data,scope,context);
      if(scope==='cycle')for(const [tag,rows] of Object.entries(result.bounties)){
        const r=region(tag);Object.assign(r,{startsAt:result.startsAt,endsAt:result.endsAt});
        rows.forEach((job,index)=>{
          const manifest=data.manifests[CHALLENGE_MANIFESTS[tag]],tier=manifest.ChallengeMissionDifficultyTiers[index];
          const base=resolve.table(tier.rewards),hard=manifest.HardModeRewards?resolve.table(manifest.HardModeRewards):null;
          r.items.push({title:job.nodeName,description:job.challengeDescription,subtitle:job.challengeName,category:'challenge',categoryName:'挑战赏金',derived:true,
            stats:['第 '+(index+1)+' 档',job.missionName,job.allyName,Number.isFinite(tier.enemyLevelModifier)?'敌人等级修正 +'+tier.enemyLevelModifier:null].filter(Boolean),
            rewardTables:[{...base,label:'任务奖励表'},...(hard?[{...hard,label:'钢铁之路独立奖励表'}]:[])],rewardStatus:'manifest-tier',fixed:job.rewardDetails.fixed,
            reference:{basis:'Oracle bounty-cycle',seed:result.seed,tag,tier:index+1,node:job.node,challenge:job.challenge,source:job.rewardDetails.source,inputHashes:result.inputHashes}});
        });
      }
      if(scope==='locations')for(const [tag,locations] of Object.entries(result.locations)){
        const r=region(tag),shared=result.rewardCatalog[tag];
        // Tiers belong to a normal job family, not the shuffled job's ordinal.
        const tiers=shared.tiers.map(t=>({...t,tables:t.tables.map(table=>resolve.table(table.key))}));
        locations.forEach((location,index)=>location.jobDetails.forEach(job=>{
          const info=catalog.item(job.key),applies=shared.applicableJobs.includes(job.key);
          r.items.push({...info,title:info.name,description:info.description,category:'location',categoryName:'平原内可接取',derived:true,location:'地区 '+(index+1),
            stats:['地区 '+(index+1)],rewardTiers:applies?tiers:[],rewardNote:applies?'平原内可接取未指定难度，请选择难度查看对应奖励。':'该任务不属于普通任务族，暂未确认对应奖励。',
            reference:{basis:'Oracle location-bounties',seed:result.seed,tag,location:location.location,job:job.key,inputHashes:result.inputHashes}});
        }));
      }
    }catch(error){warnings.push('Oracle '+scope+'：'+error.message);}
  }
  for(const r of regions.values()){
    r.description=[['current','当前'],['location','地区'],['challenge','挑战']].map(([key,label])=>{const count=r.items.filter(i=>i.category===key).length;return count?label+' '+count+' 项':null;}).filter(Boolean).join(' · ');
    r.note='奖励按任务、难度和原始池号分别查看';
  }
  const order=['CetusSyndicate','SolarisSyndicate','EntratiSyndicate','ZarimanSyndicate','EntratiLabSyndicate','HexSyndicate'];
  return {entries:[...regions.values()].sort((a,b)=>(order.indexOf(a.kind)<0?99:order.indexOf(a.kind))-(order.indexOf(b.kind)<0?99:order.indexOf(b.kind))),warnings};
}
