import {json,currentUser,getJSON,listKeys} from './_lib.js';

export default async (req)=>{
 try{
  if(req.method!=='GET')return json(405,{error:'Metodo non consentito'});
  if(!await currentUser(req))return json(401,{error:'Accesso richiesto'});
  const query=String(new URL(req.url).searchParams.get('q')||'').trim().toLocaleLowerCase('it');
  const index=await getJSON('schools-index');
  const codes=Array.isArray(index)?index.slice():[];
  // Backfill previously accredited schools without changing their stored records.
  const oldRequests=await getJSON('accreditations-index');
  if(Array.isArray(oldRequests))for(const id of oldRequests.slice(0,500)){
   const approval=await getJSON(`accreditations/${id}`);
   if(approval?.status==='approved'&&approval.schoolCode&&!codes.includes(approval.schoolCode))codes.push(approval.schoolCode);
  }
  for(const key of await listKeys('schools/')){
   const code=key.slice('schools/'.length);
   if(code&&!codes.includes(code))codes.push(code);
  }
  const schools=[];
  for(const code of codes.slice(0,2000)){
   const school=await getJSON(`schools/${code}`);
   if(!school||school.status!=='active')continue;
   const searchable=[school.name,school.mechanicalCode,school.city,school.province].join(' ').toLocaleLowerCase('it');
   if(query&&!searchable.includes(query))continue;
   // Invite codes must not be disclosed to a teacher browsing the directory.
   schools.push({id:school.code,name:school.name,city:school.city||'',province:school.province||'',mechanicalCode:school.mechanicalCode||''});
   if(schools.length>=150)break;
  }
  return json(200,{schools});
 }catch(e){console.error('school-directory error',e);return json(500,{error:'Errore elenco scuole'});}
};
