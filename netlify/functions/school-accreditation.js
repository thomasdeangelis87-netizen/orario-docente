import {
  json,currentUser,getJSON,setJSON,setMembership,
  normalizeEmail,normalizeCode
} from './_lib.js';
import { sendSchoolApprovalEmail } from './_brevo.js';

function env(name){
  try { return Netlify.env.get(name) || ''; }
  catch { return ''; }
}
function makeCode(mech='SCUOLA'){
  const root=normalizeCode(mech).replace(/[^A-Z]/g,'').slice(0,4)||'SCU';
  return `${root}-${Math.floor(10000+Math.random()*90000)}`;
}
function idFrom(mechanical){
  const safe=normalizeCode(mechanical)||'SCUOLA';
  const t=Date.now().toString(36).toUpperCase();
  return `${safe}-${t}`;
}
function requirePlatformAdmin(req){
  const key=req.headers.get('x-platform-admin-key') || '';
  const expected=env('PLATFORM_ADMIN_KEY');
  if(!expected || key!==expected) return {error:json(403,{error:'Chiave amministratore piattaforma non valida'})};
  return {ok:true};
}
async function sendAndSave(request){
  const to=normalizeEmail(request.accountEmail);
  if(!to) throw new Error('Email account referente mancante');
  const contactName=[request.contactFirstName,request.contactLastName].filter(Boolean).join(' ').trim();

  try{
    const result=await sendSchoolApprovalEmail({
      to,
      schoolName:request.schoolName,
      schoolCode:request.schoolCode,
      contactName
    });
    request.approvalEmail={
      status:'sent',
      sentAt:new Date().toISOString(),
      recipient:to,
      messageId:result.messageId||''
    };
    await setJSON(`accreditations/${request.id}`,request);
    return {sent:true,messageId:result.messageId||''};
  }catch(e){
    request.approvalEmail={
      status:'error',
      attemptedAt:new Date().toISOString(),
      recipient:to,
      error:String(e?.message||e)
    };
    await setJSON(`accreditations/${request.id}`,request);
    return {sent:false,error:String(e?.message||e)};
  }
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

        const id=idFrom(mechanicalCode);
        const now=new Date().toISOString();
        const request={
          id,status:'pending',createdAt:now,
          accountEmail:normalizeEmail(user.email),
          schoolName,mechanicalCode,
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
        const auth=requirePlatformAdmin(req);
        if(auth.error) return auth.error;

        const id=String(body.id||'').trim();
        if(!id) return json(400,{error:'ID richiesta mancante'});
        const request=await getJSON(`accreditations/${id}`);
        if(!request) return json(404,{error:'Richiesta non trovata'});

        if(request.status==='approved' && request.schoolCode){
          return json(200,{
            ok:true,alreadyApproved:true,schoolCode:request.schoolCode,request,
            emailSent:request.approvalEmail?.status==='sent'
          });
        }

        const adminEmail=normalizeEmail(request.accountEmail);
        if(!adminEmail) return json(400,{error:'La richiesta non contiene un account referente valido.'});

        let code=makeCode(request.mechanicalCode), tries=0;
        while(await getJSON(`schools/${code}`)){
          if(++tries>10) return json(409,{error:'Impossibile generare un codice scuola univoco'});
          code=makeCode(request.mechanicalCode);
        }

        const now=new Date().toISOString();
        const school={
          code,name:request.schoolName,
          mechanicalCode:String(request.mechanicalCode||'').toUpperCase(),
          city:request.city||'',province:String(request.province||'').toUpperCase(),
          status:'active',createdAt:now,createdBy:'platform-admin',
          inviteCode:code,accreditationId:id
        };
        await setJSON(`schools/${code}`,school);
        let directory=await getJSON('schools-index');
        if(!Array.isArray(directory))directory=[];
        await setJSON('schools-index',[code,...directory.filter(x=>x!==code)].slice(0,2000));

        const displayName=[request.contactFirstName,request.contactLastName].filter(Boolean).join(' ').trim();
        const membership={
          email:adminEmail,code,role:'admin',status:'active',
          joinedAt:now,assignedBy:'platform-admin',displayName
        };
        await setMembership(adminEmail,membership);
        await setJSON(`school-members/${code}`,[membership]);

        request.status='approved';
        request.approvedAt=now;
        request.approvedBy='platform-admin';
        request.schoolCode=code;
        await setJSON(`accreditations/${id}`,request);

        const email=await sendAndSave(request);
        return json(200,{ok:true,school,membership,request,emailSent:email.sent,emailError:email.error||''});
      }

      if(action==='resend-email'){
        const auth=requirePlatformAdmin(req);
        if(auth.error) return auth.error;

        const id=String(body.id||'').trim();
        if(!id) return json(400,{error:'ID richiesta mancante'});
        const request=await getJSON(`accreditations/${id}`);
        if(!request) return json(404,{error:'Richiesta non trovata'});
        if(request.status!=='approved' || !request.schoolCode)
          return json(409,{error:'La scuola deve essere approvata prima di inviare l’email.'});

        const email=await sendAndSave(request);
        if(!email.sent) return json(502,{error:'Scuola approvata, ma invio email non riuscito.',detail:email.error});
        return json(200,{ok:true,emailSent:true,messageId:email.messageId||''});
      }

      return json(400,{error:'Azione non riconosciuta'});
    }

    if(req.method==='GET'){
      const auth=requirePlatformAdmin(req);
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
