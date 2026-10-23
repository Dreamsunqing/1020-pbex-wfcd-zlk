// Weekly enums are separate identities from item paths. Never resolve by a leaf-name guess.
export function createWeeklyResolver({rules={},item,challenge,dictionary={}}) {
  const term=(record,key,missing)=>({key,name:record?.name ?? missing,description:record?.description ?? '',source:record?.source ?? null,localized:Boolean(record?.name)});
  const preferItem=(key,fallback)=>{const value=item(key);return value.localized?{...fallback,...value,key}:fallback;};
  return {
    season:key=>term(rules.seasons?.[key],key,'季节待补充'),
    calendarEvent:event=>{
      const key=event.challengeKey ?? event.upgradeKey;
      if(event.type==='CET_CHALLENGE')return {...challenge(key),key,eventType:'挑战'};
      if(event.type!=='CET_UPGRADE')return {name:'日历事件待补充',description:'',source:null,localized:false,key,eventType:event.type};
      const record=rules.calendarUpgrades?.[key];
      return {...preferItem(key,term(record,key,'强化名称待补充')),eventType:'强化选项'};
    },
    descent:row=>{
      // Scoped overrides avoid confusing a boss, blessing, noncombat event and a penance.
      const scoped=rules.descentChallenges?.[`${row.type}:${row.challengeKey}`];
      const record=scoped ?? rules.descentChallenges?.[row.challengeKey];
      const type=term(rules.descentTypes?.[row.type],row.type,'任务类型待补充');
      const detail=preferItem(row.challengeKey,term(record,row.challengeKey,'附加条件待补充'));
      // Full language paths and full object paths only. Do not match suffixes or infer MT_*.
      const lookup=key=>typeof dictionary[key]==='string'?{key,name:dictionary[key],description:'',source:'plus/dict.zh',localized:true}:preferItem(key,term(null,key,'名称待补充'));
      return {type,detail,auras:(row.auras ?? []).map(lookup),specs:(row.specs ?? []).map(lookup),level:row.levelKey};
    }
  };
}
