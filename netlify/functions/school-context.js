import {json,currentUser,requireMember,getJSON} from './_lib.js';

export default async (req) => {
  try{
    if(req.method!=='GET') return json(405,{error:'Metodo non consentito'});
    const user=await currentUser();
    if(!user) return json(401,{error:'Accesso richiesto'});
    const r=await requireMember(user);
    if(r.error) return r.error;
    const schedule=await getJSON(`schedules/${r.membership.code}`);
    return json(200,{school:r.school,membership:r.membership,schedule:schedule||null});
  }catch(e){
    console.error('school-context error',e);
    return json(500,{error:'Errore backend nel caricamento della scuola',detail:String(e?.message||e)});
  }
};
