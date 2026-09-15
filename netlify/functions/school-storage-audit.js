import {json,currentUser,requireMember,getJSON,schoolScheduleKey} from './_lib.js';

// Read-only check of the very same site-scoped document used by connected teachers.
export default async (req) => {
  try{
    if(req.method!=='GET')return json(405,{error:'Metodo non consentito'});
    const user=await currentUser();
    if(!user)return json(401,{error:'Accesso richiesto'});
    const r=await requireMember(user,['admin','coordinator']);
    if(r.error)return r.error;
    const code=r.membership.code;
    const data=await getJSON(schoolScheduleKey(code));
    if(data?.schoolCode && data.schoolCode!==code)
      return json(500,{error:'Il dataset nella chiave scuola appartiene a un altro istituto. Non modificarlo.'});
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
    console.error('school-storage-audit error',e);
    return json(500,{error:'Verifica storage scuola non riuscita',detail:String(e?.message||e)});
  }
};
