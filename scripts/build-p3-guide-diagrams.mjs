import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
const n=(id,title,lines,x,y,w=440,h=160,tone='blue')=>({id,title,lines,x,y,w,h,tone});
const e=(from,to,label,fromSide='bottom',toSide='top',via=[],labelAt=null)=>({from,to,label,fromSide,toSide,via,labelAt});
const specs=[
 {name:'P3-01-从上游到界面',subtitle:'JSON 是材料，MJS 是处理逻辑；实线表示读取或产出。',nodes:[
 n('raw','① 原始来源 · 保持只读',['官方 Export*.json / Plus Export*.json','WFCD 分类与 i18n / Oracle 清单','library.mjs → 文件清单与哈希'],30,150,460,190),
 n('inputs','② 识别结构与完整 ID',['full-inputs.mjs','map / array / group 分类','字典单独索引；reference 留原结构'],570,165,440,180),
 n('rules','规则 JSON · 决定怎么处理',['merge-full-contract.json','catalogs / fields / priority / nested','merge-overrides.json · 带哈希的人工修订'],1090,150,480,190,'gold'),
 n('nested','深层字段与关系',['nested.mjs / text-localization.mjs','对象逐字段；有 ID 数组按身份','无 ID 数组保留整组候选'],30,455,460,190,'green'),
 n('merge','③ 合并引擎',['build.mjs → full-build.mjs','选择字段、解析语言、生成关系','冲突与缺失保留可复核状态'],570,455,440,190),
 n('proof','与结果一起保存证据',['reports/provenance.json','原文件 + hash + JSON Pointer','issues / coverage / source-records'],1090,455,480,190,'gold'),
 n('output','④ 校验后切换当前版本',['repository.mjs：暂存 → 逐文件哈希 → current','items/*.json · recipes · relations · rewards','localizations · images · manifest.json'],420,820,660,180,'green'),
 n('ui','⑤ 不同界面按需读取',['service.mjs → 合并汇总 / 来源回查','player-bundle.mjs → 预构建资料库','世界状态 / 掉落表复用实体与图片'],1150,820,420,180)
 ],edges:[e('raw','inputs','读取','right','left'),e('inputs','merge','按实体聚合'),e('rules','merge','分类与优先级','bottom','right',[[1330,395],[1045,395],[1045,550]]),e('nested','merge','递归处理','right','left'),e('merge','proof','字段证据','right','left'),e('merge','output','结构化产物'),e('proof','output','纳入完整工作包','bottom','right',[[1330,735],[1110,735],[1110,910]]),e('output','ui','读取 / 裁剪','bottom','bottom',[[750,1040],[1360,1040]])]},
 {name:'P3-02-实体与奖励关系',subtitle:'连线旁是实际关系或字段；身份、语言键、奖励表路径是三个键空间。',nodes:[
 n('ability','技能实体',['has-ability · 完整 abilityUniqueName','同 ID 的内嵌 / 独立技能可汇合','ability-links.mjs · 强化与移植证据'],560,135,470,165,'green'),
 n('part','组件实体',['has-component / requires','成员关系与配方消耗分别保留','count / slot / source 伴随关系'],30,330,440,165),
 n('item','统一实体 · items/*.json',['完整 /Lotus/... 或 wf:<kind>/<id>','name / description 按语言存','relations.json 连接各实体'],560,430,470,180),
 n('manifest','Oracle · JobManifest.json',['rewards = 完整奖励表路径','bounty-references.json 保留引用','清单引用不等于当前轮次确认'],1110,135,460,165,'gold'),
 n('table','Plus · ExportRewards.json',['表路径 → 池数组 → type / itemCount','reward-tables.json 保留全部表和池','probability 无值时不从 rarity 猜'],1110,460,460,180,'gold'),
 n('recipe','蓝图与配方 · recipes.json',['蓝图 --produces→ 成品','蓝图 --requires→ 材料 × 数量','resultType 是成品身份依据'],30,750,470,180),
 n('art','共享图像描述与文件',['images.json / service.mjs 描述符','蓝图底纹 + recipe.resultId 成品图','LocalImages 读取共享图库，不复制'],560,825,470,175,'green'),
 n('live','实时奖励是另一道判断',['oracle-rewards.mjs','候选表 ∩ 有效世界状态奖励表','仅唯一命中才确认当前表'],1110,820,460,180)
 ],edges:[e('item','ability','has-ability','top','bottom'),e('item','part','has-component','left','top',[[515,520],[515,310],[250,310]],[380,310]),e('recipe','item','produces','top','left',[[265,700],[525,700],[525,520]]),e('recipe','part','requires','top','bottom',[[115,700],[115,540],[250,540]]),e('manifest','table','完整表路径'),e('table','item','type','left','right'),e('item','art','图片元数据'),e('recipe','art','resultId','bottom','bottom',[[265,1035],[795,1035]],[530,1035]),e('table','live','静态候选'),e('live','item','确认后显示奖励','left','right',[[1070,910],[1070,705],[1050,705],[1050,565]])]},
 {name:'P3-03-字段选择与语言',subtitle:'“能显示”与“已确认”分开；规则暂选不抹掉冲突，语言回退不冒充翻译。',nodes:[
 n('candidates','同一完整实体 ID · 来自多个来源的字段候选',['例如：官方中文 levelStats、WFCD 英文 description、Plus 语言键','每个候选都带 file / hash / pointer / locale；原件不修改'],110,145,1380,145),
 n('object','结构：先理解再合并',['nested.mjs','对象 → 子字段递归','有身份数组 → 按完整 ID','匿名数组 → 整组择优'],30,405,470,200),
 n('language','语言：三种输入分别处理',['full-inputs / text-localization','官方语言目录：同 ID 的文本','Plus / Oracle：完整语言键查字典','WFCD i18n：ID → 本地化对象'],565,405,470,200,'green'),
 n('rank','取值：可验证的规则',['full-build.mjs · resolve','字段优先级 ＞ 全局优先级','有效人工修订：值 + 原因 + hash','hash 过期 → 中止，不套旧修订'],1100,405,470,200,'gold'),
 n('resolved','保存结果 + 所有候选的依据',['items/*.json 与 localizations/{locale}.json','reports/provenance.json 记录采用 / 冲突 / 修订'],470,755,660,145,'green'),
 n('missing','缺失和回退仍可辨认',['缺名 / 缺引用 / 缺概率分别记录','请求语言 → 英文 → 其他已构建语言','fallback / partial 显示实际语言'],30,960,660,160,'gold'),
 n('display','展示中间件不参与身份合并',['inline-tokens.mjs + game-text.js','<DT_...> 转图标；未知标记保留','原文仍在 reference，可回查'],850,960,720,160)
 ],edges:[e('candidates','object','结构','bottom','top',[[800,340],[265,340]]),e('candidates','language','语言'),e('candidates','rank','优先级','bottom','top',[[800,340],[1335,340]]),e('object','resolved','递归后的候选','bottom','left',[[265,685],[435,685],[435,825]]),e('language','resolved','按语言保留'),e('rank','resolved','校验并选择','bottom','right',[[1335,685],[1165,685],[1165,825]]),e('resolved','missing','读取时回退','bottom','top',[[800,930],[360,930]]),e('resolved','display','最后才渲染','bottom','top',[[800,930],[1210,930]])]}
];
const out=path.resolve('文档/图示');await fs.mkdir(out,{recursive:true});
const xml=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const colors={blue:['#eaf1fc','#3064a3'],green:['#e5f5ef','#167962'],gold:['#fff3dc','#986a16']};
const anchor=(n,side)=>side==='left'?[n.x,n.y+n.h/2]:side==='right'?[n.x+n.w,n.y+n.h/2]:side==='top'?[n.x+n.w/2,n.y]:[n.x+n.w/2,n.y+n.h];
const manifest=[];
for(const spec of specs){
 const height=spec.name.includes('03')?1180:1080,byId=new Map(spec.nodes.map(n=>[n.id,n]));
 let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="${height}" viewBox="0 0 1600 ${height}"><defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto"><path d="M0 0L10 5L0 10" fill="#536c87"/></marker></defs><rect width="1600" height="${height}" fill="#f5f8fc"/><g font-family="PingFang SC,Arial,sans-serif"><text x="35" y="60" font-size="34" font-weight="700" fill="#20354b">${xml(spec.name.slice(6))}</text><text x="35" y="103" font-size="21" fill="#53677b">${xml(spec.subtitle)}</text>`;
 for(const edge of spec.edges){const a=anchor(byId.get(edge.from),edge.fromSide),b=anchor(byId.get(edge.to),edge.toSide),points=[a,...edge.via,b];let p=points[Math.floor((points.length-1)/2)],q=points[Math.ceil((points.length-1)/2)];if(points.length===2){p=a;q=b;}const x=edge.labelAt?.[0]??(p[0]+q[0])/2,y=edge.labelAt?.[1]??(p[1]+q[1])/2,tw=[...edge.label].reduce((n,c)=>n+(c.charCodeAt(0)<128?10:19),0)+18;svg+=`<polyline points="${points.map(p=>p.join(',')).join(' ')}" fill="none" stroke="#536c87" stroke-width="2.5" marker-end="url(#arrow)"/><rect x="${x-tw/2}" y="${y-15}" width="${tw}" height="30" rx="5" fill="#f5f8fc"/><text x="${x}" y="${y+6}" font-size="18" text-anchor="middle" fill="#344f6b">${xml(edge.label)}</text>`;}
 for(const node of spec.nodes){const [fill,color]=colors[node.tone];svg+=`<rect x="${node.x}" y="${node.y}" width="${node.w}" height="${node.h}" rx="15" fill="${fill}" stroke="${color}" stroke-width="2"/><text x="${node.x+22}" y="${node.y+39}" font-size="25" font-weight="650" fill="${color}">${xml(node.title)}</text>`;for(const [i,line]of node.lines.entries())svg+=`<text x="${node.x+22}" y="${node.y+79+i*30}" font-size="20" fill="#263f55">${xml(line)}</text>`;}
 svg+='</g></svg>';const file=path.join(out,spec.name+'.svg');await fs.writeFile(file,svg);
 const canvas={nodes:spec.nodes.map(n=>({id:n.id,type:'text',x:n.x,y:n.y,width:n.w,height:n.h,text:'## '+n.title+'\n\n'+n.lines.join('\n'),color:n.tone==='gold'?'3':n.tone==='green'?'4':'5'})),edges:spec.edges.map((e,i)=>({id:'p3-e'+i,fromNode:e.from,toNode:e.to,fromSide:e.fromSide,toSide:e.toSide,toEnd:'arrow',label:e.label}))};
 await fs.writeFile(path.join(out,spec.name+'.canvas'),JSON.stringify(canvas,null,2)+'\n');
 if(process.argv.includes('--write-vault')){const config=JSON.parse(await fs.readFile(path.join(os.homedir(),'Library/Application Support/obsidian/obsidian.json'),'utf8'));const entry=Object.values(config.vaults).find(v=>v.open);if(!entry)throw Error('没有打开的 Obsidian 库');const target=path.join(entry.path,'B-开发/项目/上游资料工作台');await fs.mkdir(target,{recursive:true});await fs.writeFile(path.join(target,spec.name+'.canvas'),JSON.stringify(canvas,null,2)+'\n');}
 manifest.push({name:spec.name,file,width:1600,height});
}
await fs.writeFile(path.join(out,'p3-manifest.json'),JSON.stringify(manifest,null,2)+'\n');console.log(`生成 ${manifest.length} 份 P3 SVG / Canvas`);
