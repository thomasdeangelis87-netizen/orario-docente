import {json,currentUser,requireMember,getJSON,setJSON,setMembership,getMembership,normalizeEmail} from './_lib.js';
import {mayRevoke,lookupIdentityAccount} from './_member_ops.js';

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
      const request=requests[ix];
      if(body.action==='approve-request'&&!request.userId)return json(409,{error:'Richiesta legacy: il docente deve inviarne una nuova dal suo account attuale.'});
      const applicant=await getMembership(email);
      if(applicant?.status==='active'&&applicant.userId!==request.userId)return json(409,{error:'Email già associata a un altro account. Intervento piattaforma necessario.'});
      request.status=body.action==='approve-request'?'approved':'rejected';
      request.decidedAt=new Date().toISOString();request.decidedBy=user.email;
      if(request.status==='approved'){
        const membership={userId:request.userId,email,code,role:'teacher',status:'active',joinedAt:request.decidedAt,assignedBy:user.id,displayName:request.displayName};
        await setMembership(email,membership);
        const list=(await getJSON(`school-members/${code}`))||[];
        const memberIx=list.findIndex(x=>normalizeEmail(x.email)===email);
        if(memberIx>=0)list[memberIx]=membership;else list.push(membership);
        await setJSON(`school-members/${code}`,list.slice(0,1500));
      }
      requests[ix]=request;
      await setJSON(`school-link-requests/${code}`,requests);
      if(request.userId)await setJSON(`link-requests-by-user/${encodeURIComponent(request.userId)}`,request);
      return json(200,{ok:true,request});
    }
    const email=normalizeEmail(body.email);
    if(!email||!email.includes('@')) return json(400,{error:'Email non valida'});
    const list=(await getJSON(`school-members/${code}`))||[];
    const ix=list.findIndex(x=>normalizeEmail(x.email)===email);
    const current=ix>=0?list[ix]:null;
    if(current?.code&&current.code!==code)return json(409,{error:'Account associato a un altro istituto'});
    if(body.action==='revoke'){
      if(r.membership.role!=='admin')return json(403,{error:'Solo un amministratore può revocare i gestori'});
      if(!mayRevoke(list,email))return json(409,{error:'L’ultimo amministratore attivo non può essere revocato. Assegnane prima un altro.'});
      const updated={...current,status:'revoked',revokedAt:new Date().toISOString(),revokedBy:user.id};
      await setMembership(email,updated);
      list[ix]=updated;await setJSON(`school-members/${code}`,list);
      return json(200,{ok:true,membership:updated,members:list});
    }
    let role=String(body.role||'teacher');
    if(!['teacher','coordinator','admin'].includes(role)) role='teacher';
    if(r.membership.role!=='admin' && role!=='teacher')
      return json(403,{error:'Solo un amministratore scuola può assegnare ruoli di gestione'});
    if(current?.role==='admin'&&current.status==='active'&&role!=='admin'&&!mayRevoke(list,email))
      return json(409,{error:'L’ultimo amministratore attivo non può essere declassato.'});
    if(current?.role==='admin'&&r.membership.role!=='admin')return json(403,{error:'Solo un amministratore può modificare i gestori'});
    const account=await lookupIdentityAccount(email);
    if(current?.userId&&account?.id&&current.userId!==account.id)
      return json(409,{error:'Email riutilizzata da un nuovo account. Chiedi l’intervento dell’amministratore piattaforma.'});

    const membership={
      userId:account?.confirmedAt?account.id:'',email,code,role,
      status:account?.confirmedAt?'active':'pending',joinedAt:new Date().toISOString(),
      displayName:String(body.displayName||'').slice(0,120),assignedBy:user.id
    };
    await setMembership(email,membership);

    if(ix>=0) list[ix]={...list[ix],...membership}; else list.push(membership);
    await setJSON(`school-members/${code}`,list.slice(0,1500));
    return json(200,{ok:true,membership,members:list});
  }catch(e){
    console.error('school-members error',e);
    return json(500,{error:'Errore backend nella gestione membri',detail:String(e?.message||e)});
  }
};
