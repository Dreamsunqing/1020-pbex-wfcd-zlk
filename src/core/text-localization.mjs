// Source language codes are explicit aliases; identifiers and text are separate namespaces.
export const localeAliases = Object.freeze({ zh: 'zh-CN', tc: 'zh-TW' });
export const normalizeLocale = code => localeAliases[code] ?? code;
export const validLocale = code => typeof code === 'string' && /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(code);
export const localizedField = field => /(?:^|[.\[])(?:name|abilityName|description|passiveDescription|displayName|title|label|compatName|levelStats|trigger|systemName|locTag|descriptionKey|nameKey)(?:[.\[\]]|$)/i.test(field);
const escape = value => String(value).replaceAll('~', '~0').replaceAll('/', '~1');
export function createTextLocalizer({ dictionaries, priority, locales }) {
  const indexes = new Map(locales.map(locale => [locale, new Map()]));
  for (const doc of [...dictionaries].filter(d => d.shape === 'language').sort((a,b) => priority.indexOf(a.source)-priority.indexOf(b.source) || a.file.localeCompare(b.file))) {
    const index = indexes.get(doc.locale); if (!index) continue;
    for (const [key,value] of Object.entries(doc.value)) if (typeof value === 'string' && value.trim() && !index.has(key)) index.set(key,{value,source:{source:doc.source,file:doc.file,hash:doc.hash,pointer:'/'+escape(key)}});
  }
  function translate(value, locale, source, field) {
    const dictionarySources = []; let hasText = false;
    const visit = (node, at, textPath) => {
      if (typeof node === 'string') {
        if (localizedField(textPath) && !node.startsWith('/')) hasText = true;
        const match = node.startsWith('/') ? indexes.get(locale)?.get(node) : null;
        if (match) { dictionarySources.push({key:node,source:{...source,pointer:at},dictionary:match.source});return match.value; }
        return node;
      }
      if (Array.isArray(node)) return node.map((child,i)=>visit(child,at+'/'+i,textPath+'.'+i));
      if (node && typeof node === 'object') return Object.fromEntries(Object.entries(node).map(([key,child])=>[key,visit(child,at+'/'+escape(key),textPath+'.'+key)]));
      return node;
    };
    const result=visit(value,source.pointer,field);return {value:result,dictionarySources,hasText};
  }
  return { candidates(field,candidates,locale) {
    return candidates.flatMap(candidate=>{
      const translated=translate(candidate.value,locale,candidate.source,field);
      if (translated.dictionarySources.length) {
        // Never relabel an English paragraph as Chinese after replacing one key.
        if(translated.hasText && candidate.locale && candidate.locale!==locale)return [];
        return [{...candidate,value:translated.value,dictionarySources:translated.dictionarySources,locale,transform:'nested-language-keys',...(translated.hasText&&!candidate.locale?{partial:true}:{})}];
      }
      if (candidate.locale===locale && translated.hasText) return [{...candidate,locale}];
      return [];
    });
  } };
}
export function selectLocalizedField(data, id, field, locale='zh-CN') {
  const languages=[...new Set([locale,'en',...(data.manifest.locales ?? [])])];
  for (const language of languages) {
    const entry=data.output['localizations/'+language+'.json']?.[id]?.[field];
    if(entry)return {...entry,requestedLocale:locale,locale:language,fallback:language!==locale};
  }
  return null;
}

// Only walk existing modeled paths. Keys containing dots or slashes use JSON brackets.
export function applyLocalizedFields(item, entries) {
  const result=structuredClone(item);
  for(const [field,entry] of Object.entries(entries ?? {})) {
    const keys=[];let at=0;const pattern=/([A-Za-z0-9_]+)|\[("(?:[^"\\]|\\.)*")\]/gy;
    while(at<field.length) { if(field[at]==='.')at++;pattern.lastIndex=at;const m=pattern.exec(field);if(!m)break;keys.push(m[1]??JSON.parse(m[2]));at=pattern.lastIndex; }
    if(at!==field.length || keys.some(key=>['__proto__','prototype','constructor'].includes(key)))continue;
    let parent=result;for(const key of keys.slice(0,-1))parent=parent&&Object.hasOwn(parent,key)?parent[key]:null;
    const key=keys.at(-1);if(parent&&Object.hasOwn(parent,key))parent[key]=structuredClone(entry.value);
  }
  return result;
}
