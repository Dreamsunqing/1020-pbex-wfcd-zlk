import {plainGameText} from './inline-tokens.mjs';
// Family names are English source labels; remove reviewed, whole-word variant
// affixes only. Never join by a substring, translated suffix, or internal path.
const equipmentPrefixes=['MK1-','Kuva ','Tenet ','Prisma ','Dex ','Coda ','Mara ','Ceti ','Vaykor ','Telos ','Synoid ','Secura ','Rakta ','Sancti '];
const modPrefixes=['Primed ','Amalgam ','Galvanized ','Archon ','Umbral ','Sacrificial ','Flawed '];
export function variantFamily(item){
 if(!['warframe','weapon','companion','pet','sentinel','archwing','mod'].includes(item.kind))return null;
 let name=item.name?.en;if(typeof name!=='string'||!name.trim())return null;name=plainGameText(name,'name');
 for(const prefix of item.kind==='mod'?modPrefixes:equipmentPrefixes)if(name.toLowerCase().startsWith(prefix.toLowerCase())){name=name.slice(prefix.length);break;}
 if(item.kind!=='mod')name=name.replace(/ (?:Prime|Umbra|Vandal|Wraith)$/i,'');
 return item.kind+'\0'+(item.attributes?.category??'')+'\0'+name.trim().toLowerCase();
}
export function variantIndex(items){const families=new Map(),result=new Map();for(const item of items){const family=variantFamily(item);if(!family)continue;if(!families.has(family))families.set(family,[]);families.get(family).push(item);}for(const rows of families.values())if(rows.length>1)for(const item of rows)result.set(item.id,rows.filter(row=>row.id!==item.id));return result;}
