import {
  json,currentUser,getJSON,setJSON,setMembership,
  normalizeEmail,normalizeCode
} from './_lib.js';

function makeCode(mech='SCUOLA'){
  const root=normalizeCode(mech).replace(/[^A-Z]/g,'').slice(0,4)||'SCU';
  return `${root}-${Math.floor(10000+Math.random()*90000)}`;
}

function idFrom(userEmail, mechanical){
  const safe=normalizeCode(mechanical)||'SCUOLA';
  const t=Date.now().toString(36).toUpperCase();
  return `${safe}-${t}`;
}

async function requirePlatformAdmin(req){
  const user=await currentUser();
  if(!user) return {error:json(401,{error:'Accesso richiesto'})};
  const key=req.headers.get('x-platform-admin-key') || '';
  const expected=process.env.PLATFORM_ADMIN_KEY || '';
  if(!expected || key!==expected) return {error:json(403,{error:'Chiave amministratore piattaforma non valida'})};
  return {user};
}

export default async (req) => {
  try{
    if(req.method==='POST'){
      let body={};
      try{ body=await req.json(); }catch{ return json(400,{error:'Dati non validi'}); }

      const action=String(body.action||'submit');

      if(action==='submit'){
        const user=await currentUser();
        if(!user) return json(401,{error:'Prima devi accedere al tuo account Orario Docente.'});

        const schoolName=String(body.schoolName||'').trim();
        const mechanicalCode=String(body.mechanicalCode||'').trim().toUpperCase();
        if(!schoolName || !mechanicalCode)
          return json(400,{error:'Denominazione scuola e codice meccanografico sono obbligatori.'});

        const id=idFrom(user.email,mechanicalCode);
        const now=new Date().toISOString();
        const request={
          id,
          status:'pending',
          createdAt:now,
          accountEmail:normalizeEmail(user.email),
          schoolName,
          mechanicalCode,
          schoolType:String(body.schoolType||'').trim(),
          city:String(body.city||'').trim(),
          province:String(body.province||'').trim().toUpperCase(),
          institutionalEmail:String(body.institutionalEmail||'').trim(),
          pec:String(body.pec||'').trim(),
          website:String(body.website||'').trim(),
          contactFirstName:String(body.contactFirstName||'').trim(),
          contactLastName:String(body.contactLastName||'').trim(),
          contactRole:String(body.contactRole||'').trim(),
          contactEmail:String(body.contactEmail||user.email).trim(),
          contactPhone:String(body.contactPhone||'').trim(),
          notes:String(body.notes||'').trim()
        };

        await setJSON(`accreditations/${id}`,request);
        let index=await getJSON('accreditations-index');
        if(!Array.isArray(index)) index=[];
        index=[id,...index.filter(x=>x!==id)].slice(0,500);
        await setJSON('accreditations-index',index);

        return json(200,{ok:true,request});
      }

      if(action==='approve'){
        const auth=await requirePlatformAdmin(req);
        if(auth.error) return auth.error;

        const id=String(body.id||'').trim();
        if(!id) return json(400,{error:'ID richiesta mancante'});
        const request=await getJSON(`accreditations/${id}`);
        if(!request) return json(404,{error:'Richiesta non trovata'});
        if(request.status==='approved' && request.schoolCode){
          return json(200,{ok:true,alreadyApproved:true,schoolCode:request.schoolCode,request});
        }

        const adminEmail=normalizeEmail(request.accountEmail);
        if(!adminEmail) return json(400,{error:'La richiesta non contiene un account referente valido.'});

        let code=makeCode(request.mechanicalCode);
        let tries=0;
        while(await getJSON(`schools/${code}`)){
          if(++tries>10) return json(409,{error:'Impossibile generare un codice scuola univoco'});
          code=makeCode(request.mechanicalCode);
        }

        const now=new Date().toISOString();
        const school={
          code,
          name:request.schoolName,
          mechanicalCode:String(request.mechanicalCode||'').toUpperCase(),
          city:request.city||'',
          province:String(request.province||'').toUpperCase(),
          status:'active',
          createdAt:now,
          createdBy:auth.user.email,
          inviteCode:code,
          accreditationId:id
        };
        await setJSON(`schools/${code}`,school);

        const displayName=[request.contactFirstName,request.contactLastName].filter(Boolean).join(' ').trim();
        const membership={
          email:adminEmail,
          code,
          role:'admin',
          status:'active',
          joinedAt:now,
          assignedBy:auth.user.email,
          displayName
        };
        await setMembership(adminEmail,membership);
        await setJSON(`school-members/${code}`,[membership]);

        request.status='approved';
        request.approvedAt=now;
        request.approvedBy=auth.user.email;
        request.schoolCode=code;
        await setJSON(`accreditations/${id}`,request);

        return json(200,{ok:true,school,membership,request});
      }

      return json(400,{error:'Azione non riconosciuta'});
    }

    if(req.method==='GET'){
      const auth=await requirePlatformAdmin(req);
      if(auth.error) return auth.error;

      let index=await getJSON('accreditations-index');
      if(!Array.isArray(index)) index=[];
      const items=[];
      for(const id of index.slice(0,200)){
        const r=await getJSON(`accreditations/${id}`);
        if(r) items.push(r);
      }
      return json(200,{ok:true,items});
    }

    return json(405,{error:'Metodo non consentito'});
  }catch(e){
    console.error('school-accreditation error',e);
    return json(500,{error:'Errore backend accreditamento scuola',detail:String(e?.message||e)});
  }
};
