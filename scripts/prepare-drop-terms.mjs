import fs from 'node:fs/promises';
const base='世界状态上游/git/warframe-public-export-plus/',en=JSON.parse(await fs.readFile(base+'dict.en.json')),zh=JSON.parse(await fs.readFile(base+'dict.zh.json')),terms={};
for(const [key,value]of Object.entries(en))if(typeof value==='string'&&typeof zh[key]==='string'&&/\/(Locations|Missions|GameModes|PVP|Pvp|Conclave|Game|UI|Menu|1999|Duviri)\//.test(key)&&value.length<100){const name=value.normalize('NFKC').trim().toLowerCase();if(!terms[name])terms[name]=[];terms[name].push({key,en:value,zh:zh[key]});}
// Reviewed short form from two official captions; not a fabricated node name.
terms['lunaro arena']=[{key:'/Lotus/Language/CapturaScenes/PhotoboothDuviriArenaLunaro',en:'Lunaro Arena',zh:'月动球场',derivedFrom:{en:en['/Lotus/Language/CapturaScenes/PhotoboothDuviriArenaLunaro'],zh:zh['/Lotus/Language/CapturaScenes/PhotoboothDuviriArenaLunaro']}}];
terms.lunaro=[{key:'/Lotus/Language/CapturaScenes/PhotoboothZarLunaroCourt',en:'Lunaro',zh:'月动球',derivedFrom:{en:en['/Lotus/Language/CapturaScenes/PhotoboothZarLunaroCourt'],zh:zh['/Lotus/Language/CapturaScenes/PhotoboothZarLunaroCourt']}}];
await fs.writeFile('src/data/drop-terms.json',JSON.stringify(terms)+'\n');console.log('官方短语索引',Object.keys(terms).length);
