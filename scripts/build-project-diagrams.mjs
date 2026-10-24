import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
const specs=[
 ['资料库-WM-世界状态UI结构',[
  ['总导航','世界状态 · 资料库 · 掉落表 · WM'],['世界状态','快速入口 / 总览 / 任务 / 周常 / 商店'],['资料库','类别 Picker → 搜索 / 属性筛选 → 物品卡片'],['掉落表','语言 / 类别 / 搜索 → 分组奖励卡 → 刷新'],['WM','物品目录 / 套装部件 / 订单 / 统计 / 紫卡'],['状态详情','裂缝筛选 · 单列仲裁与月历 · 商店全宽'],['物品详情','基础信息 / 攻击模式 / 套装 / 其他变体'],['奖励弹窗','图文奖励 → 资料库 / 可交易 WM搜索'],['获取弹窗','部件 → 默认3处来源 → 更多获取方式'],['资料库侧栏','物品档案 → 雷达图 → Wiki'],['更新与版本','来源快照 / 差异 / 回滚 / 官方掉落表'],['工具与说明','图片资源 / 文档阅读 / 来源维护脚本']],
 [[0,1],[0,2],[0,3],[0,4],[1,5],[1,7],[2,6],[6,8],[6,9],[7,2],[7,4],[8,4],[3,10],[10,11]]],
 ['数据关联关系',[
 ['上游原文','DE Public Export · Plus · WFCD · Oracle · browse.wf'],['快照仓库','Store：SHA256 对象 / releases / current + previous'],['官方掉落表','HTML原文 + parsed.json；触发率 / 池内概率'],['P3 全量构建','实体 ID / 本地化字段 / 配方 / 奖励池 / 关系'],['字典映射','稳定 ID + 字段路径 + 语言；不改写原始JSON'],['内置玩家资料','压缩预构建：实体 / 关系 / 获取索引 / 敌人掉落'],['本地图库','wfcd/img + official/img；Wiki敌人复用同目录'],['世界状态','实时原文 → normalizers → view → 奖励补图'],['玩家投影','资料库 / 掉落表：统一名称、图标与跳转'],['WM 物品身份','gameRef精确匹配 → 完整名称 → 候选列表'],['仲裁排期与评级','逐小时节点排期 + 独立可配置收益评级'],['证据与审计','来源版本 / 文件hash / 字段路径 / 图片映射依据']],
 [[0,1],[2,1],[1,3],[4,3],[3,5],[3,11],[6,8],[5,8],[5,7],[7,8],[8,9],[10,7],[1,11]]],
 ['功能关联关系',[
 ['看实时状态','周期 / 裂缝 / 警报 / 赏金 / 活动'],['规划日周任务','仲裁日历 / 科研 / 沉沦 / 回廊 / 日历'],['找物品','资料库 Picker / 搜索 / 其他变体'],['看获取途径','获取弹窗：部件 / 地点 / 遗物四品质概率'],['看官方掉落','掉落表：双语搜索 / 独立刷新 / 快照'],['查交易','可交易物品 WM搜索 → 本程序订单页'],['看配装信息','极性 / 攻击模式 / Mod套装 / 灵化之源'],['看图片来源','官方 / WFCD / 文本图标 / Wiki敌人'],['维护来源','更新与版本 → 全量快照 → P3构建'],['离线启动','随程序内置资料 / 掉落表 / 仲裁排期'],['补充知识','Wiki链接 / 文档入口 / 开发规范'],['维护画板','本脚本 → 项目PNG + Obsidian Canvas']],
 [[0,2],[0,5],[1,2],[2,3],[2,5],[2,6],[3,4],[4,2],[7,2],[8,9],[9,0],[9,2],[2,10],[8,11]]]
];
const xml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'})[c]);
const out=path.resolve('文档/图示');await fs.mkdir(out,{recursive:true});let vault=null;
if(process.argv.includes('--write-vault')){const config=JSON.parse(await fs.readFile(path.join(os.homedir(),'Library/Application Support/obsidian/obsidian.json'),'utf8'));const entry=Object.values(config.vaults).find(v=>v.open);if(!entry)throw Error('未找到当前打开的 Obsidian 库');vault=path.join(entry.path,'B-开发/项目/上游资料工作台');await fs.mkdir(vault,{recursive:true});}
const manifest=[];
for(const [name,labels,links]of specs){const width=1840,height=1250,nodeWidth=510,nodeHeight=190;
 const nodes=labels.map(([title,body],i)=>({id:'n'+i,type:'text',x:55+(i%3)*590,y:120+Math.floor(i/3)*275,width:nodeWidth,height:nodeHeight,color:String(i%6+1),text:'## '+title+'\n\n'+body}));const edges=links.map(([a,b],i)=>({id:'e'+i,fromNode:'n'+a,toNode:'n'+b,fromSide:'bottom',toSide:'top',toEnd:'arrow'}));
 const canvas={nodes,edges};if(vault)await fs.writeFile(path.join(vault,name+'.canvas'),JSON.stringify(canvas,null,2)+'\n');
 let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><marker id="arrow" markerWidth="9" markerHeight="9" refX="8" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8" fill="none" stroke="#739c99"/></marker></defs><rect width="100%" height="100%" fill="#0d1821"/><text x="55" y="60" font-family="PingFang SC,sans-serif" font-size="32" fill="#ecf5f3">${xml(name)}</text><text x="55" y="90" font-family="PingFang SC,sans-serif" font-size="15" fill="#96afad">Source Workbench · 脚本生成，随结构变更维护</text>`;
 for(const [a,b]of links){const f=nodes[a],t=nodes[b],x1=f.x+nodeWidth/2,y1=f.y+nodeHeight,x2=t.x+nodeWidth/2,y2=t.y;svg+=`<path d="M${x1} ${y1} C${x1} ${y1+40},${x2} ${y2-40},${x2} ${y2}" fill="none" stroke="#527c7b" stroke-width="2" opacity=".6" marker-end="url(#arrow)"/>`;}
 for(const [i,n]of nodes.entries()){svg+=`<rect x="${n.x}" y="${n.y}" width="${nodeWidth}" height="${nodeHeight}" rx="14" fill="#182936" stroke="#3e686a" stroke-width="1.5"/><text x="${n.x+24}" y="${n.y+41}" font-family="PingFang SC,sans-serif" font-size="23" font-weight="600" fill="#83dbc5">${xml(labels[i][0])}</text>`;let lines=labels[i][1].match(/.{1,26}/gu)??[];for(const [j,line]of lines.entries())svg+=`<text x="${n.x+24}" y="${n.y+84+j*31}" font-family="PingFang SC,sans-serif" font-size="18" fill="#d7e4e3">${xml(line)}</text>`;}svg+='</svg>';await fs.writeFile(path.join(out,name+'.svg'),svg);manifest.push({name,file:path.join(out,name+'.svg'),width,height});}
await fs.writeFile(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2));console.log(JSON.stringify({diagrams:manifest.length,vaultWritten:Boolean(vault),output:out}));
