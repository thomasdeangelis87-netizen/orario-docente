import {json,currentUser,requireMember,getJSON,schoolScheduleKey} from './_lib.js';

export default async (req) => {
  try{
    if(req.method!=='GET') return json(405,{error:'Metodo non consentito'});
    const user=await currentUser();
    if(!user) return json(401,{error:'Accesso richiesto'});
    const r=await requireMember(user);
    if(r.error) return r.error;
    let schedule=null;
    try{
      schedule=await getJSON(schoolScheduleKey(r.membership.code));
      if(schedule?.schoolCode && schedule.schoolCode!==r.membership.code)
        return json(500,{error:'Il dataset salvato non appartiene alla scuola collegata. Non è stato mostrato né modificato.'});
    }catch(e){
      console.error('school-context schedule read error',e);
      return json(500,{error:'Errore nel caricamento dell’orario condiviso della scuola',detail:String(e?.message||e)});
    }
    return json(200,{school:r.school,membership:r.membership,schedule:schedule||null,storageScope:'site',scheduleStatus:schedule?'present':'missing'});
  }catch(e){
    console.error('school-context error',e);
    return json(500,{error:'Errore backend nel caricamento della scuola',detail:String(e?.message||e)});
  }
};
