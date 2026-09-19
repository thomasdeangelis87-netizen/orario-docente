import {json,currentUser,requireMember,getJSON,schoolScheduleKey} from './_lib.js';

// Read-only check of the very same site-scoped document used by connected teachers.
export default async (req, context) => {
  const requestId=context?.requestId||'';
  let stage='start';
  console.info('school-storage-audit start',{requestId,deployContext:context?.deploy?.context||''});
  try{
    if(req.method!=='GET')return json(405,{error:'Metodo non consentito'});
    stage='identity';
    const user=await currentUser(req);
    if(!user)return json(401,{error:'Accesso richiesto'});
    stage='membership';
    const r=await requireMember(user,['admin','coordinator']);
    if(r.error)return r.error;
    const code=r.membership.code;
    stage='schedule-read';
    const data=await getJSON(schoolScheduleKey(code));
    if(data?.schoolCode && data.schoolCode!==code)
      return json(500,{error:'Il dataset nella chiave scuola appartiene a un altro istituto. Non modificarlo.'});
    console.info('school-storage-audit success',{requestId,hasSchedule:!!data});
    return json(200,{
      schoolCode:code,schoolName:r.school.name,role:r.membership.role,storageScope:'site',
      status:data?'present':'missing',
      summary:data?{
        version:data.version||1,validFrom:data.validFrom||'',
        source:data.source||'',loadedAt:data.loadedAt||'',
        teachers:Array.isArray(data.teachers)?data.teachers.length:0,
        classCells:Array.isArray(data.classCells)?data.classCells.length:0,
        entries:Array.isArray(data.entries)?data.entries.length:0
      }:null
    });
  }catch(e){
    console.error('school-storage-audit failure',{requestId,stage,name:e?.name,code:e?.code,message:String(e?.message||e).slice(0,400)});
    return json(500,{error:'Verifica storage scuola non riuscita',requestId,stage});
  }
};
