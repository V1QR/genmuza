import { clone, hash, validateProject } from './music.mjs';

export const projectKey=project=>String(hash(JSON.stringify([project.config,project.tracks,project.events])));
export function readLibrary(value){
  if(!Array.isArray(value))return [];
  return value.slice(0,30).flatMap(item=>{
    try{return [{id:String(item.id).slice(0,100),project:validateProject(item.project),savedAt:String(item.savedAt),favorite:!!item.favorite}];}catch{return [];}
  });
}
export function storeProject(items,project,{favorite=false,id,savedAt}={}){
  const snapshot=validateProject(project),key=projectKey(snapshot),valid=readLibrary(items);
  const existing=valid.find(item=>projectKey(item.project)===key);
  const result=[{id:existing?.id||id,project:clone(snapshot),savedAt,favorite:favorite||!!existing?.favorite},...valid.filter(item=>projectKey(item.project)!==key)];
  while(result.length>30){const index=result.findLastIndex((item,i)=>i>0&&!item.favorite);if(index<0)throw new Error('Все 30 мест заняты избранным. Сохраните новый проект в JSON.');result.splice(index,1);}
  return result;
}
