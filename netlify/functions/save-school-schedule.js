import {json,currentUser,requireMember,getJSON,setJSON,schoolScheduleKey} from './_lib.js';
import {scheduleVersion} from './_schedule-version.js';

export default async (req, context) => {
  const requestId=context?.requestId||'';
  let stage='start';
  console.info('save-school-schedule start',{requestId,deployContext:context?.deploy?.context||''});
  try{
    if(req.method!=='POST') return json(405,{error:'Metodo non consentito'});
    stage='identity';
    const user=await currentUser();
    if(!user) return json(401,{error:'Accesso richiesto'});
    stage='membership';
    const r=await requireMember(user,['admin','coordinator']);
    if(r.error) return r.error;

    let body={};
    try{body=await req.json();}catch{return json(400,{error:'Dati non validi'});}
    const data=body.schedule;
    if(!data||!Array.isArray(data.entries)||!Array.isArray(data.teachers))
      return json(400,{error:'Formato orario non valido'});
    if(data.entries.length>50000||data.teachers.length>5000)
      return json(413,{error:'Orario troppo grande'});

    const key=schoolScheduleKey(r.membership.code);
    stage='previous-read';
    const previous=await getJSON(key);
    if(previous?.schoolCode && previous.schoolCode!==r.membership.code)
      return json(409,{error:'Il dataset già salvato non appartiene a questa scuola. Caricamento bloccato.'});
    const isPublication=body.publish===true;
    if(!isPublication && !previous)
      return json(409,{error:'Nessun orario scolastico pubblicato: prima carica un orario completo.'});
    const version=scheduleVersion(previous,isPublication);
    const validFrom=isPublication?String(body.validFrom||'').trim().slice(0,32):String(previous?.validFrom||'').trim();
    const clean={...data,version,validFrom,publishedAt:isPublication?new Date().toISOString():(previous?.publishedAt||''),cloudUpdatedAt:new Date().toISOString(),cloudUpdatedBy:user.email,schoolCode:r.membership.code};
    stage='schedule-write';
    await setJSON(key,clean);
    stage='schedule-verify';
    const verified=await getJSON(key);
    if(!verified || verified.schoolCode!==r.membership.code || verified.version!==version || verified.entries?.length!==clean.entries.length || verified.teachers?.length!==clean.teachers.length)
      return json(500,{error:'L’orario è stato scritto ma non è verificabile nello storage scolastico. Non considerarlo pubblicato.'});
    stage='school-metadata-write';
    await setJSON(`schools/${r.membership.code}`,{...r.school,lastScheduleAt:clean.cloudUpdatedAt,lastScheduleBy:user.email});
    console.info('save-school-schedule success',{requestId,version,entries:verified.entries.length});
    return json(200,{ok:true,schoolCode:r.membership.code,storageScope:'site',entries:verified.entries.length,teachers:verified.teachers.length,updatedAt:clean.cloudUpdatedAt,version,validFrom,publishedAt:clean.publishedAt});
  }catch(e){
    console.error('save-school-schedule failure',{requestId,stage,name:e?.name,code:e?.code,message:String(e?.message||e).slice(0,400)});
    return json(500,{error:'Errore backend nel salvataggio dell’orario',requestId,stage});
  }
};
