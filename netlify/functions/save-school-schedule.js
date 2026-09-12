import {json,currentUser,requireMember,setJSON} from './_lib.js';

export default async (req) => {
  try{
    if(req.method!=='POST') return json(405,{error:'Metodo non consentito'});
    const user=await currentUser();
    if(!user) return json(401,{error:'Accesso richiesto'});
    const r=await requireMember(user,['admin','coordinator']);
    if(r.error) return r.error;

    let body={};
    try{body=await req.json();}catch{return json(400,{error:'Dati non validi'});}
    const data=body.schedule;
    if(!data||!Array.isArray(data.entries)||!Array.isArray(data.teachers))
      return json(400,{error:'Formato orario non valido'});
    if(data.entries.length>50000||data.teachers.length>5000)
      return json(413,{error:'Orario troppo grande'});

    const clean={...data,cloudUpdatedAt:new Date().toISOString(),cloudUpdatedBy:user.email,schoolCode:r.membership.code};
    await setJSON(`schedules/${r.membership.code}`,clean);
    await setJSON(`schools/${r.membership.code}`,{...r.school,lastScheduleAt:clean.cloudUpdatedAt,lastScheduleBy:user.email});
    return json(200,{ok:true,updatedAt:clean.cloudUpdatedAt});
  }catch(e){
    console.error('save-school-schedule error',e);
    return json(500,{error:'Errore backend nel salvataggio dell’orario',detail:String(e?.message||e)});
  }
};
