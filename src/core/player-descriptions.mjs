// Slim description provenance shared by full builds and packaged player data.
export function blueprintDescriptionSources(data) {
  if(data.output['player/description-sources.json'])return data.output['player/description-sources.json'];
  const recipes=new Map((data.output['recipes.json']??[]).map(r=>[r.id,r.resultId])),sources={};
  for(const row of data.output['reports/provenance.json']??[]){
    const candidate=row.candidates?.[row.selected];
    if(row.field.startsWith('description.')&&candidate?.transform==='derived-blueprint-description'&&recipes.has(row.entityId)){
      const locale=row.field.slice('description.'.length);(sources[row.entityId]??={})[locale]={id:recipes.get(row.entityId),locale};
    }
  }
  return sources;
}
