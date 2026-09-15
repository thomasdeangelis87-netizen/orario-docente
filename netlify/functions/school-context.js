import {json,currentUser,requireMember,getJSON,schoolScheduleKey} from './_lib.js';

export default async (req, context) => {
  const requestId=context?.requestId||'';
  let stage='start';
  console.info('school-context start',{requestId,deployContext:context?.deploy?.context||''});
  try{
    if(req.method!=='GET') return json(405,{error:'Metodo non consentito'});
    stage='identity';
    const user=await currentUser();
    if(!user) return json(401,{error:'Accesso richiesto'});
    stage='membership';
    const r=await requireMember(user);
    if(r.error) return r.error;
    let schedule=null;
    try{
      stage='schedule-read';
      schedule=await getJSON(schoolScheduleKey(r.membership.code));
      if(schedule?.schoolCode && schedule.schoolCode!==r.membership.code)
        return json(500,{error:'Il dataset salvato non appartiene alla scuola collegata. Non è stato mostrato né modificato.'});
    }catch(e){
      console.error('school-context failure',{requestId,stage,name:e?.name,code:e?.code,message:String(e?.message||e).slice(0,400)});
      return json(500,{error:'Errore nel caricamento dell’orario condiviso della scuola',requestId,stage});
    }
    stage='response';
    console.info('school-context success',{requestId,hasSchedule:!!schedule});
    return json(200,{school:r.school,membership:r.membership,schedule:schedule||null,storageScope:'site',scheduleStatus:schedule?'present':'missing'});
  }catch(e){
    console.error('school-context failure',{requestId,stage,name:e?.name,code:e?.code,message:String(e?.message||e).slice(0,400)});
    return json(500,{error:'Errore backend nel caricamento della scuola',requestId,stage});
  }
};
