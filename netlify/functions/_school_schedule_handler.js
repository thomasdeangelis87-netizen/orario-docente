import {json,currentUser,requireMember,getJSON,setJSON} from './_lib.js';
import {getOfficialSchedule,publishOfficialSchedule} from './_school_schedule_core.js';

export function makeSchoolScheduleHandler(deps={currentUser,requireMember,getJSON,setJSON}){
  return async (req,context={})=>{
    const requestId=context.requestId||'';
    let stage='request';
    console.info('school-schedule request',{requestId,method:req.method,deployContext:context.deploy?.context||''});
    try{
      if(!['GET','POST'].includes(req.method))return json(405,{error:'Metodo non consentito'});
      stage='identity';
      const user=await deps.currentUser(req);
      if(!user)return json(401,{error:'Accesso richiesto'});
      stage='membership';
      const access=await deps.requireMember(user,req.method==='POST'?['admin','coordinator']:[]);
      if(access.error)return access.error;
      const code=String(access.membership.code).trim().toUpperCase();
      if(!/^[A-Z0-9-]{3,40}$/.test(code))return json(403,{error:'Codice scuola non valido'});
      if(req.method==='GET'){
        stage='storage-read';
        const schedule=await getOfficialSchedule(code,deps.getJSON);
        console.info('school-schedule read',{requestId,found:!!schedule,version:schedule?.version||null});
        return json(200,{school:access.school,membership:access.membership,schedule,storageScope:'site',scheduleStatus:schedule?'present':'missing'});
      }
      stage='payload';
      let body;
      try{body=await req.json()}catch{return json(400,{error:'Dati non validi'})}
      stage='storage-publish';
      const outcome=await publishOfficialSchedule({code,body,read:deps.getJSON,write:deps.setJSON});
      console.info('school-schedule publish',{requestId,status:outcome.status,version:outcome.version||null});
      const {status,...result}=outcome;
      return json(status,result);
    }catch(error){
      console.error('school-schedule failure',{requestId,stage,name:error?.name,code:error?.code,message:String(error?.message||error).slice(0,300)});
      return json(500,{error:'Storage scuola non disponibile; nessun orario esistente è stato cancellato.',requestId,stage});
    }
  };
}
