const {json,userFromContext,requireMember,setJSON}=require('./_lib');
exports.handler=async(event,context)=>{
  if(event.httpMethod!=='POST') return json(405,{error:'Metodo non consentito'});
  const user=userFromContext(context); if(!user) return json(401,{error:'Accesso richiesto'});
  const r=await requireMember(user,['admin','coordinator']); if(r.error) return r.error;
  let body={}; try{body=JSON.parse(event.body||'{}')}catch(e){return json(400,{error:'Dati non validi'})}
  const data=body.schedule;
  if(!data||!Array.isArray(data.entries)||!Array.isArray(data.teachers)) return json(400,{error:'Formato orario non valido'});
  if(data.entries.length>50000||data.teachers.length>5000) return json(413,{error:'Orario troppo grande'});
  const clean={...data,cloudUpdatedAt:new Date().toISOString(),cloudUpdatedBy:user.email,schoolCode:r.membership.code};
  await setJSON(`schedules/${r.membership.code}`,clean);
  const school={...r.school,lastScheduleAt:clean.cloudUpdatedAt,lastScheduleBy:user.email};
  await setJSON(`schools/${r.membership.code}`,school);
  return json(200,{ok:true,updatedAt:clean.cloudUpdatedAt});
};
