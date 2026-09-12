import {json,currentUser,requireMember,getJSON,setJSON,setMembership,normalizeEmail} from './_lib.js';

export default async (req) => {
  try{
    const user=await currentUser();
    if(!user) return json(401,{error:'Accesso richiesto'});
    const r=await requireMember(user,['admin','coordinator']);
    if(r.error) return r.error;
    const code=r.membership.code;

    if(req.method==='GET'){
      const list=(await getJSON(`school-members/${code}`))||[];
      return json(200,{school:r.school,members:list});
    }
    if(req.method!=='POST') return json(405,{error:'Metodo non consentito'});

    let body={};
    try{body=await req.json();}catch{return json(400,{error:'Dati non validi'});}
    const email=normalizeEmail(body.email);
    if(!email||!email.includes('@')) return json(400,{error:'Email non valida'});
    let role=String(body.role||'teacher');
    if(!['teacher','coordinator','admin'].includes(role)) role='teacher';
    if(r.membership.role!=='admin' && role!=='teacher')
      return json(403,{error:'Solo un amministratore scuola può assegnare ruoli di gestione'});

    const membership={
      email,code,role,status:'active',joinedAt:new Date().toISOString(),
      displayName:String(body.displayName||'').slice(0,120),assignedBy:user.email
    };
    await setMembership(email,membership);

    const list=(await getJSON(`school-members/${code}`))||[];
    const ix=list.findIndex(x=>normalizeEmail(x.email)===email);
    if(ix>=0) list[ix]={...list[ix],...membership}; else list.push(membership);
    await setJSON(`school-members/${code}`,list.slice(0,1500));
    return json(200,{ok:true,membership,members:list});
  }catch(e){
    console.error('school-members error',e);
    return json(500,{error:'Errore backend nella gestione membri',detail:String(e?.message||e)});
  }
};
