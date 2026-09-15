import {json,currentUser,requireMember,getJSON,setJSON,setMembership,getMembership,normalizeEmail,emailKey} from './_lib.js';

export default async (req) => {
  try{
    const user=await currentUser();
    if(!user) return json(401,{error:'Accesso richiesto'});
    const r=await requireMember(user,['admin','coordinator']);
    if(r.error) return r.error;
    const code=r.membership.code;

    if(req.method==='GET'){
      const list=(await getJSON(`school-members/${code}`))||[];
      const requests=(await getJSON(`school-link-requests/${code}`))||[];
      return json(200,{school:r.school,members:list,requests:requests.filter(x=>x.status==='pending')});
    }
    if(req.method!=='POST') return json(405,{error:'Metodo non consentito'});

    let body={};
    try{body=await req.json();}catch{return json(400,{error:'Dati non validi'});}
    if(body.action==='approve-request'||body.action==='reject-request'){
      const email=normalizeEmail(body.email);
      const requests=(await getJSON(`school-link-requests/${code}`))||[];
      const ix=requests.findIndex(x=>normalizeEmail(x.email)===email&&x.status==='pending');
      if(ix<0)return json(404,{error:'Richiesta in attesa non trovata'});
      const applicant=await getMembership(email);
      if(applicant?.status==='active')return json(409,{error:'Docente già collegato a una scuola'});
      const request=requests[ix];
      request.status=body.action==='approve-request'?'approved':'rejected';
      request.decidedAt=new Date().toISOString();request.decidedBy=user.email;
      if(request.status==='approved'){
        const membership={email,code,role:'teacher',status:'active',joinedAt:request.decidedAt,assignedBy:user.email,displayName:request.displayName};
        await setMembership(email,membership);
        const list=(await getJSON(`school-members/${code}`))||[];
        const memberIx=list.findIndex(x=>normalizeEmail(x.email)===email);
        if(memberIx>=0)list[memberIx]=membership;else list.push(membership);
        await setJSON(`school-members/${code}`,list.slice(0,1500));
      }
      requests[ix]=request;
      await setJSON(`school-link-requests/${code}`,requests);
      await setJSON(`link-requests-by-email/${emailKey(email)}`,request);
      return json(200,{ok:true,request});
    }
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
