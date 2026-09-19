import {json,currentUser,getJSON,setJSON,setMembership,normalizeEmail,normalizeCode} from './_lib.js';
import {lookupIdentityAccount} from './_member_ops.js';

function makeCode(mech='SCUOLA'){
  const root=normalizeCode(mech).replace(/[^A-Z]/g,'').slice(0,4)||'SCU';
  return `${root}-${Math.floor(10000+Math.random()*90000)}`;
}

export default async (req) => {
  try{
    if(req.method!=='POST') return json(405,{error:'Metodo non consentito'});
    const user=await currentUser(req);
    if(!user) return json(401,{error:'Accesso richiesto'});

    const key=req.headers.get('x-platform-admin-key') || '';
    const expected=process.env.PLATFORM_ADMIN_KEY || '';
    if(!expected || key!==expected) return json(403,{error:'Chiave amministratore piattaforma non valida'});

    let body={};
    try{ body=await req.json(); }catch{ return json(400,{error:'Dati non validi'}); }

    const name=String(body.name||'').trim();
    const mechanical=String(body.mechanicalCode||'').trim().toUpperCase();
    const adminEmail=normalizeEmail(body.adminEmail);
    if(!name||!mechanical||!adminEmail)
      return json(400,{error:'Nome scuola, codice meccanografico ed email amministratore sono obbligatori'});

    let code=normalizeCode(body.code)||makeCode(mechanical);
    let tries=0;
    while(await getJSON(`schools/${code}`)){
      if(++tries>10) return json(409,{error:'Impossibile generare un codice univoco'});
      code=makeCode(mechanical);
    }

    const now=new Date().toISOString();
    const school={
      code,name,mechanicalCode:mechanical,
      city:String(body.city||''),
      province:String(body.province||'').toUpperCase(),
      status:'active',createdAt:now,createdBy:user.email,inviteCode:code
    };
    await setJSON(`schools/${code}`,school);
    let directory=await getJSON('schools-index');
    if(!Array.isArray(directory))directory=[];
    await setJSON('schools-index',[code,...directory.filter(x=>x!==code)].slice(0,2000));

    const account=await lookupIdentityAccount(adminEmail);
    const membership={
      userId:account?.confirmedAt?account.id:'',email:adminEmail,code,role:'admin',status:account?.confirmedAt?'active':'pending',
      joinedAt:now,assignedBy:user.email,displayName:String(body.adminName||'')
    };
    await setMembership(adminEmail,membership);
    await setJSON(`school-members/${code}`,[membership]);

    return json(200,{ok:true,school,membership});
  }catch(e){
    console.error('admin-school error', e);
    return json(500,{
      error:'Errore backend durante l’attivazione della scuola',
      detail:String(e?.message || e)
    });
  }
};
