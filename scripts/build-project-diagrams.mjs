import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

// Positions express relationships, not a fixed card grid. Keep these declarations
// synchronized with editable Canvas sources when changing the project structure.
const node=(id,title,body,x,y,width=400,height=170,color='4')=>({id,title,body,x,y,width,height,color});
const edge=(from,to,label,fromSide='right',toSide='left',color='4')=>({from,to,label,fromSide,toSide,color});
const specs=[
 {name:'资料库-WM-世界状态UI结构',width:2880,height:1910,
  note:'读法：从入口沿箭头看操作；同一物品在多个模块之间复用。',
  nodes:[
   node('nav','总导航','世界状态 / 资料库 / 掉落表 / WM\n更新与版本 / 图片资源 / 文档阅读',1030,150,560,160),
   node('world','世界状态','快速入口 · 总览 · 任务\n周常 · 商店',90,450,450,150),
   node('state','状态详情','裂缝筛选 · 单列仲裁与月历\n长列表 / 商店全宽展示',70,790,410,170),
   node('reward','奖励弹窗','奖励图文卡\n资料库详情 / 可交易物品 WM搜索',590,1110,430,170),
   node('library','资料库列表','类别 Picker → 搜索 / 属性筛选\n物品卡片 → 选择物品',1130,490,460,170),
   node('item','物品详情 · 跨模块汇合处','基础信息 / 攻击模式 / 极性\n套装 / 灵化之源 / 其他变体',1160,930,520,200),
   node('acquisition','掉落与获取弹窗','部件 → 默认 3 处来源\n更多获取方式 / 遗物四品质概率\n可交易部件也能 WM搜索',1080,1530,500,200),
   node('sidebar','资料库侧栏','物品档案\n雷达图 → Wiki 链接',1820,1260,370,170),
   node('wm','WM 对应物品页','物品目录 / 套装部件\n订单 / 统计 / 紫卡',2310,1040,440,190,'5'),
   node('drops','掉落表','语言 / 类别 / 搜索\n分组奖励卡 → 对应物品',2090,480,470,170,'3'),
   node('updates','更新与版本','来源快照 / 构建 / 差异 / 回滚\n官方掉落表刷新也进入快照',2210,150,520,170,'6'),
   node('tools','维护入口','图片资源 / 文档阅读\n来源脚本与说明',2300,1570,430,170,'6')
  ],
  edges:[
   edge('nav','world','进入','left','top'),edge('nav','library','进入','bottom','top'),
   edge('nav','drops','进入','right','top','3'),edge('nav','wm','进入','top','top','5'),
   edge('nav','updates','管理来源','right','left','6'),
   edge('world','state','查看完整模块','bottom','top'),edge('state','reward','查看奖励','bottom','left'),
   edge('library','item','打开物品','bottom','top'),edge('reward','item','奖励关联物品'),
   edge('drops','item','奖励关联物品','bottom','right','3'),
   edge('item','acquisition','查看获取方式','bottom','top'),edge('item','sidebar','阅读附加信息','right','top'),
   edge('item','wm','可交易 → WM搜索','right','left','5'),
   edge('reward','wm','可交易 → WM搜索','bottom','bottom','5'),
   edge('acquisition','wm','可交易部件 → WM搜索','right','bottom','5'),
   edge('drops','updates','刷新 / 快照','right','bottom','6'),edge('nav','tools','其他导航入口','right','right','6')
  ]},
 {name:'数据关联关系',width:3000,height:2020,
  note:'读法：原文进入快照与构建；实时状态、图片和交易身份各有独立来源。',
  nodes:[
   node('upstream','静态上游原文','DE Public Export · Plus · WFCD\nOracle · browse.wf · Plus 生成资料',70,210,530,180,'3'),
   node('drops','官方掉落表','HTML 原文 + parsed.json\n触发率 / 池内概率 / 遗物四品质',100,720,470,180,'3'),
   node('store','版本快照仓库 Store','SHA256 对象 / releases\ncurrent + previous / 失败保留旧版本',790,290,520,190,'3'),
   node('p3','P3 全量合并构建','实体 ID / 本地化字段 / 配方\n奖励池 / 关系 / 来源证据',1120,790,530,200),
   node('dictionary','字典映射','稳定 ID + 字段路径 + 语言\n按嵌套结构映射，不改写原文',720,1200,490,190),
   node('bundle','内置玩家资料','压缩预构建：实体 / 关系 / 获取索引\n敌人掉落 / 遗物品质概率',1760,910,520,190),
   node('images','共享本地图库','wfcd/img + official/img\nWiki 敌人图片复用原目录\n索引记录来源与匹配证据',1050,1600,520,210,'5'),
   node('projection','玩家展示投影','资料库 / 掉落表 / 奖励卡\n统一名称、图片、物品跳转',2370,1320,520,190),
   node('world','世界状态解析','实时原文 → normalizers → view\n奖励按物品关联，再补图与中文',2290,390,530,190),
   node('live','实时世界状态源','DE / WG 独立获取与缓存',2180,150,470,140,'3'),
   node('arbitration','仲裁排期与评级','逐小时节点排期\n独立评级文件：质量 / 收益',1710,650,440,170,'5'),
   node('wm','WM 物品身份','gameRef 精确匹配优先\n完整名称 → 有歧义则展示候选',2320,1720,550,180,'5'),
   node('audit','证据与审计','来源版本 / 文件 hash / 字段路径\n匹配依据可追溯；未知信息不推测',70,1550,630,190,'6')
  ],
  edges:[
   edge('upstream','store','获取并校验','right','left','3'),edge('drops','store','独立刷新也存快照','right','bottom','3'),
   edge('store','p3','读取同版本输入','bottom','top'),edge('dictionary','p3','字段与语言映射','top','left'),
   edge('p3','bundle','生成离线资料'),
   edge('bundle','projection','读取玩家资料','right','top'),edge('images','projection','名称索引 / 图片映射','right','left','5'),
   edge('live','world','仅解析当前实例字段','bottom','top','3'),
   edge('bundle','world','奖励身份与本地化','top','bottom'),edge('arbitration','world','排期 + 独立评级','top','left','5'),
   edge('world','projection','状态与奖励展示','right','right'),
   edge('projection','wm','可交易物品定位','bottom','top','5'),
   edge('store','audit','保留原文与版本','left','top','6'),edge('p3','audit','记录字段与关系证据','left','right','6'),
   edge('images','audit','记录来源与映射依据','left','bottom','6')
  ]},
 {name:'功能关联关系',width:3000,height:2060,
  note:'读法：围绕“找物品”组织使用路径；下方是离线数据与维护的支撑关系。',
  nodes:[
   node('live','看实时状态','周期 / 裂缝 / 警报 / 赏金 / 活动\n从奖励进入物品或交易',100,300,510,180),
   node('planning','规划日周任务','仲裁日历 / 科研 / 沉沦\n回廊 / 1999 日历',850,150,490,170),
   node('find','找物品 · 用户路径汇合处','资料库 Picker / 搜索\n其他变体 / 部件 / 敌人',1070,690,540,210),
   node('acquisition','查获取途径','获取弹窗：部件 / 地点 / 方式\n遗物完整、无暇、良好、光辉概率',170,940,550,190),
   node('drops','查官方掉落','掉落表双语搜索\n与物品关联 / 独立刷新 / 快照',190,1330,520,170,'3'),
   node('trade','查交易','可交易 → WM搜索\n本程序对应物品 / 订单页',2320,650,530,180,'5'),
   node('build','看装备与配装信息','极性 / 攻击模式 / Mod 套装\n灵化之源 / 属性轮廓',1760,220,540,180),
   node('knowledge','补充知识','物品 Wiki 链接\n使用说明 / WM 独立文档 / 开发规范',2360,1100,530,180,'6'),
   node('images','核对与补充图片','官方 / WFCD / 文本图标\nWiki 敌人：显式映射，记录证据',1050,1170,520,190,'5'),
   node('maintenance','维护数据来源','更新与版本 → 快照 → P3 构建\n掉落表刷新 / 差异 / 回滚',1900,1650,540,190,'3'),
   node('offline','离线使用','内置资料 / 掉落表 / 仲裁排期\n运行时读取预构建资料',930,1750,560,180,'3'),
   node('canvas','维护关系画板','构图声明 → Canvas\n项目 PNG / 可编辑源文件\n导航、数据、功能变化同步更新',2530,1510,390,240,'6')
  ],
  edges:[
   edge('live','find','奖励进入资料库'),edge('planning','find','查看任务关联物品','bottom','top'),
   edge('find','acquisition','查看掉落与获取','bottom','right'),edge('acquisition','drops','查奖励池来源','bottom','top','3'),
   edge('drops','find','选择奖励物品','right','bottom','3'),edge('find','trade','可交易物品','right','left','5'),
   edge('find','build','查看装备资料','top','bottom'),edge('find','knowledge','访问 Wiki / 说明','right','top','6'),
   edge('images','find','补图 / 映射校正','top','bottom','5'),
   edge('maintenance','offline','重建内置资料','left','right','3'),
   edge('offline','find','玩家资料','top','bottom','3'),edge('offline','live','状态关联所需字典与资料','left','left','3'),
   edge('maintenance','drops','保存并重建掉落表','left','bottom','3'),
   edge('maintenance','canvas','结构变化同步画板','right','bottom','6')
  ]}
];
const palette={'3':'#e9b663','4':'#7cdbcc','5':'#a6b9ff','6':'#b2bec9'};
const xml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'})[c]);
const textWidth=s=>[...s].reduce((w,c)=>w+(/[^\x00-\xff]/u.test(c)?1:.55),0);
function wrap(s,max){const lines=[];for(const paragraph of s.split('\n')){let line='';for(const c of paragraph){if(textWidth(line+c)>max&&line){lines.push(line);line='';}line+=c;}if(line)lines.push(line);}return lines;}
function anchor(n,side){if(side==='left')return{x:n.x,y:n.y+n.height/2};if(side==='right')return{x:n.x+n.width,y:n.y+n.height/2};if(side==='top')return{x:n.x+n.width/2,y:n.y};return{x:n.x+n.width/2,y:n.y+n.height};}
const directions={left:[-1,0],right:[1,0],top:[0,-1],bottom:[0,1]};
const inside=(p,r)=>p.x>r.x&&p.x<r.x+r.width&&p.y>r.y&&p.y<r.y+r.height;
function blocked(a,b,rects){return rects.some(r=>a.x===b.x?(a.x>r.x&&a.x<r.x+r.width&&Math.max(a.y,b.y)>r.y&&Math.min(a.y,b.y)<r.y+r.height):(a.y>r.y&&a.y<r.y+r.height&&Math.max(a.x,b.x)>r.x&&Math.min(a.x,b.x)<r.x+r.width));}
// Orthogonal shortest paths avoid card bodies. Labels describe each relationship;
// Canvas retains standard node ports and labels and uses Obsidian's own routing.
function route(from,to,spec,index,previous=[]){
 const a=anchor(from,spec.fromSide),b=anchor(to,spec.toSide),d1=directions[spec.fromSide],d2=directions[spec.toSide];
 const offset=44+(index%3)*10,start={x:a.x+d1[0]*offset,y:a.y+d1[1]*offset},end={x:b.x+d2[0]*offset,y:b.y+d2[1]*offset};
 const rects=spec.nodes.map(n=>({x:n.x-26,y:n.y-26,width:n.width+52,height:n.height+52}));
 const xs=[...new Set([35,spec.width-35,start.x,end.x,...rects.flatMap(r=>[r.x,r.x+r.width])])].sort((x,y)=>x-y);
 const ys=[...new Set([120,spec.height-35,start.y,end.y,...rects.flatMap(r=>[r.y,r.y+r.height])])].sort((x,y)=>x-y);
 const taken=previous.flatMap(points=>points.slice(1).map((b,i)=>[points[i],b]));
 const overlap=(a,b)=>taken.reduce((sum,[c,d])=>{if(a.y===b.y&&c.y===d.y&&a.y===c.y)return sum+Math.max(0,Math.min(Math.max(a.x,b.x),Math.max(c.x,d.x))-Math.max(Math.min(a.x,b.x),Math.min(c.x,d.x)));if(a.x===b.x&&c.x===d.x&&a.x===c.x)return sum+Math.max(0,Math.min(Math.max(a.y,b.y),Math.max(c.y,d.y))-Math.max(Math.min(a.y,b.y),Math.min(c.y,d.y)));return sum;},0);
 const key=(x,y,d)=>`${x},${y},${d}`,heap=[];
 function push(v){heap.push(v);let i=heap.length-1;while(i){const p=(i-1)>>1;if(heap[p].score<=v.score)break;heap[i]=heap[p];i=p;}heap[i]=v;}
 function pop(){const root=heap[0],v=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let c=i*2+1;if(c+1<heap.length&&heap[c+1].score<heap[c].score)c++;if(heap[c].score>=v.score)break;heap[i]=heap[c];i=c;}heap[i]=v;}return root;}
 const sx=xs.indexOf(start.x),sy=ys.indexOf(start.y),ex=xs.indexOf(end.x),ey=ys.indexOf(end.y),dist=new Map(),prev=new Map();
 const initial=key(sx,sy,'s');dist.set(initial,0);push({x:sx,y:sy,d:'s',cost:0,score:0,k:initial});let found;
 while(heap.length){const p=pop();if(p.cost!==dist.get(p.k))continue;if(p.x===ex&&p.y===ey){found=p;break;}
  for(const [dx,dy,d]of[[1,0,'h'],[-1,0,'h'],[0,1,'v'],[0,-1,'v']]){const x=p.x+dx,y=p.y+dy;if(x<0||x>=xs.length||y<0||y>=ys.length)continue;const f={x:xs[p.x],y:ys[p.y]},t={x:xs[x],y:ys[y]};if(rects.some(r=>inside(t,r))||blocked(f,t,rects))continue;
   const cost=p.cost+Math.abs(t.x-f.x)+Math.abs(t.y-f.y)+overlap(f,t)*3+(p.d!==d&&p.d!=='s'?75:0),k=key(x,y,d);if(cost>=(dist.get(k)??Infinity))continue;dist.set(k,cost);prev.set(k,p);push({x,y,d,cost,k,score:cost+Math.abs(t.x-end.x)+Math.abs(t.y-end.y)});
  }
 }
 if(!found)throw Error(`无法避开节点连接：${from.id} → ${to.id}`);
 const points=[];for(let p=found;p;p=prev.get(p.k))points.unshift({x:xs[p.x],y:ys[p.y]});points.unshift(a);points.push(b);
 return points.filter((p,i,list)=>!i||i===list.length-1||!((list[i-1].x===p.x&&p.x===list[i+1].x)||(list[i-1].y===p.y&&p.y===list[i+1].y)));
}
const out=path.resolve('文档/图示');await fs.mkdir(out,{recursive:true});let vault=null;
if(process.argv.includes('--write-vault')){const config=JSON.parse(await fs.readFile(path.join(os.homedir(),'Library/Application Support/obsidian/obsidian.json'),'utf8'));const entry=Object.values(config.vaults).find(v=>v.open);if(!entry)throw Error('未找到当前打开的 Obsidian 库');vault=path.join(entry.path,'B-开发/项目/上游资料工作台');await fs.mkdir(vault,{recursive:true});}
const manifest=[];
for(const spec of specs){
 const {name,width,height,nodes,edges}=spec,byId=new Map(nodes.map(n=>[n.id,n]));
 // Catch declaration mistakes before overwriting either exported format.
 if(byId.size!==nodes.length)throw Error(`${name}：节点 ID 重复`);
 for(const n of nodes){if(n.x<0||n.y<120||n.x+n.width>width||n.y+n.height>height)throw Error(`${name}：节点越界 ${n.id}`);for(const other of nodes){if(n.id!==other.id&&n.x<other.x+other.width&&n.x+n.width>other.x&&n.y<other.y+other.height&&n.y+n.height>other.y)throw Error(`${name}：节点重叠 ${n.id}/${other.id}`);}}
 const canvas={nodes:nodes.map(({title,body,...n})=>({...n,type:'text',text:`## ${title}\n\n${body}`})),edges:edges.map((e,i)=>{if(!byId.has(e.from)||!byId.has(e.to))throw Error(`${name}：连线目标不存在`);return{id:`e${i}`,fromNode:e.from,toNode:e.to,fromSide:e.fromSide,toSide:e.toSide,toEnd:'arrow',label:e.label,color:e.color};})};
 const routes=[];for(const [i,e]of edges.entries())routes.push(route(byId.get(e.from),byId.get(e.to),{...spec,...e},i,routes));
 let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs>`;
 for(const [c,color]of Object.entries(palette))svg+=`<marker id="arrow${c}" markerWidth="11" markerHeight="11" refX="10" refY="5" orient="auto"><path d="M1,1 L10,5 L1,9" fill="none" stroke="${color}" stroke-width="1.5"/></marker>`;
 svg+=`</defs><rect width="100%" height="100%" fill="#0d1821"/><g font-family="PingFang SC,sans-serif"><text x="45" y="54" font-size="36" font-weight="600" fill="#ecf5f3">${xml(name)}</text><text x="45" y="94" font-size="21" fill="#b9cfca">${xml(spec.note)}</text>`;
 for(const [i,e]of edges.entries()){const points=routes[i],d=points.map((p,j)=>`${j?'L':'M'}${p.x} ${p.y}`).join(' '),color=palette[e.color];svg+=`<path d="${d}" fill="none" stroke="#0d1821" stroke-width="9"/><path d="${d}" fill="none" stroke="${color}" stroke-width="2.5" marker-end="url(#arrow${e.color})"${e.color==='6'?' stroke-dasharray="9 6"':''}/>`;}
 const occupied=[];
 for(const [i,e]of edges.entries()){
  const segments=routes[i].slice(1).map((b,j)=>({a:routes[i][j],b})).sort((u,v)=>(Math.abs(v.b.x-v.a.x)+Math.abs(v.b.y-v.a.y))-(Math.abs(u.b.x-u.a.x)+Math.abs(u.b.y-u.a.y)));
  let box;
  for(const shifts of[[[0,0]],[[0,-48],[0,48],[-80,0],[80,0],[0,-84],[0,84]]]){
   for(const lines of[[e.label],wrap(e.label,6),wrap(e.label,4),wrap(e.label,3)]){
    const w=Math.max(...lines.map(textWidth))*20+24,h=lines.length*26+8;
    for(const shift of shifts){
     for(const {a,b}of segments){
      for(const t of[.5,.28,.72]){
       const anchorX=a.x+(b.x-a.x)*t,anchorY=a.y+(b.y-a.y)*t;
       const x=anchorX-w/2+shift[0],y=anchorY-h/2+shift[1];
       if(x<10||x+w>width-10||y<115||y+h>height-10)continue;
       const intersects=r=>x<r.x+r.width+8&&x+w>r.x-8&&y<r.y+r.height+8&&y+h>r.y-8;
       if(![...nodes,...occupied].some(intersects)){box={x,y,width:w,height:h,lines,anchorX,anchorY,shifted:Boolean(shift[0]||shift[1])};break;}
      }
      if(box)break;
     }
     if(box)break;
    }
    if(box)break;
   }
   if(box)break;
  }
  if(!box)throw Error(`${name}：关系标签无可用位置 ${e.label}`);
  occupied.push(box);
  if(box.shifted)svg+=`<path d="M${box.anchorX} ${box.anchorY} L${box.x+box.width/2} ${box.y+box.height/2}" stroke="${palette[e.color]}" fill="none" stroke-width="1"/><circle cx="${box.anchorX}" cy="${box.anchorY}" r="3" fill="${palette[e.color]}"/>`;
  svg+=`<rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" rx="4" fill="#0d1821"/>`;
  for(const [j,line]of box.lines.entries())svg+=`<text x="${box.x+box.width/2}" y="${box.y+24+j*26}" text-anchor="middle" font-size="20" fill="${palette[e.color]}">${xml(line)}</text>`;
 }

 for(const n of nodes){const color=palette[n.color];svg+=`<rect x="${n.x}" y="${n.y}" width="${n.width}" height="${n.height}" rx="5" fill="#16232e" stroke="${color}" stroke-width="1.5"/><text x="${n.x+22}" y="${n.y+43}" font-size="27" font-weight="600" fill="${color}">${xml(n.title)}</text>`;const lines=wrap(n.body,(n.width-44)/23);if(75+lines.length*32>n.height+6)throw Error(`${name}：节点文字超高 ${n.id}`);for(const [j,line]of lines.entries())svg+=`<text x="${n.x+22}" y="${n.y+82+j*32}" font-size="23" fill="#e0e9e7">${xml(line)}</text>`;}
 svg+=`<text x="45" y="${height-18}" font-size="18" fill="#a2b8b6">沿箭头与文字识别关系；线条交叉不表示节点之间存在关联。布局随关系变化，不固定行列或卡片尺寸。</text></g></svg>`;
 if(vault)await fs.writeFile(path.join(vault,name+'.canvas'),JSON.stringify(canvas,null,2)+'\n');
 await fs.writeFile(path.join(out,name+'.svg'),svg);manifest.push({name,file:path.join(out,name+'.svg'),width,height});
}
await fs.writeFile(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');console.log(JSON.stringify({diagrams:manifest.length,vaultWritten:Boolean(vault),output:out}));
