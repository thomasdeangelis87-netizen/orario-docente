import {json,currentUser,requireMember,getJSON,setJSON} from './_lib.js';
import {normalizeActivity,profileClassNames,visibleTo,sortActivities} from './_school_activities.js';

const key=code=>`school-activities/${code}`;

export default async (req,context)=>{
  try{
    const user=await currentUser(req,context);
    if(!user)return json(401,{error:'Accesso richiesto'});
    const member=await requireMember(user);
    if(member.error)return member.error;
    const {membership,school}=member;
    const canManage=['admin','coordinator'].includes(membership.role);

    if(req.method==='GET'){
      const stored=await getJSON(key(membership.code));
      const all=Array.isArray(stored)?stored:[];
      let classes=[];
      if(!canManage){
        const profile=await getJSON(`profiles-by-user/${encodeURIComponent(user.id)}`);
        classes=profileClassNames(profile);
      }
      return json(200,{school,membership,canManage,activities:sortActivities(all.filter(item=>visibleTo(item,membership,classes)))});
    }
    if(req.method!=='POST')return json(405,{error:'Metodo non consentito'});
    if(!canManage)return json(403,{error:'Solo amministratori e referenti possono gestire gli impegni.'});
    let body={};
    try{body=await req.json()}catch{return json(400,{error:'Dati non validi'});}
    const stored=await getJSON(key(membership.code));
    const all=Array.isArray(stored)?stored:[];
    if(body.action==='delete'){
      const id=String(body.id||'');
      const next=all.filter(item=>item.id!==id);
      if(next.length===all.length)return json(404,{error:'Impegno non trovato'});
      await setJSON(key(membership.code),next);
      return json(200,{ok:true,activities:sortActivities(next)});
    }
    if(body.action!=='upsert')return json(400,{error:'Azione non valida'});
    const requestedId=String(body.activity?.id||'');
    const index=requestedId?all.findIndex(item=>item.id===requestedId):-1;
    if(requestedId&&index<0)return json(404,{error:'Impegno non trovato'});
    let activity;
    try{activity=normalizeActivity(body.activity,index>=0?all[index]:null,user)}
    catch(error){return json(400,{error:error.message});}
    if(index>=0)all[index]=activity;else all.push(activity);
    if(all.length>3000)return json(409,{error:'Limite massimo di impegni raggiunto.'});
    await setJSON(key(membership.code),all);
    return json(200,{ok:true,activity,activities:sortActivities(all)});
  }catch(error){
    console.error('school-activities error',error);
    return json(500,{error:'Errore nel piano delle attività',detail:String(error?.message||error)});
  }
};
