import {json,getJSON,setJSON,setMembership,normalizeEmail,normalizeCode} from './_lib.js';
import { sendSchoolApprovalEmail } from './_brevo.js';
import {lookupIdentityAccount} from './_member_ops.js';

function env(name){
  try { return Netlify.env.get(name) || ''; }
  catch { return ''; }
}
function requirePlatformAdmin(req){
  const key=req.headers.get('x-platform-admin-key') || '';
  const expected=env('PLATFORM_ADMIN_KEY');
  if(!expected || key!==expected) return {error:json(403,{error:'Chiave amministratore piattaforma non valida'})};
  return {ok:true};
}
function makeCode(mech='SCUOLA'){
  const root=normalizeCode(mech).replace(/[^A-Z]/g,'').slice(0,4)||'SCU';
  return `${root}-${Math.floor(10000+Math.random()*90000)}`;
}
export default async (req)=>{
  try{
    if(req.method!=='POST') return json(405,{error:'Metodo non consentito'});
    const auth=requirePlatformAdmin(req); if(auth.error) return auth.error;
    let body={}; try{body=await req.json();}catch{return json(400,{error:'Dati non validi'});}
    const name=String(body.name||'').trim();
    const mechanicalCode=String(body.mechanicalCode||'').trim().toUpperCase();
    const adminEmail=normalizeEmail(body.adminEmail||'');
    if(!name||!mechanicalCode||!adminEmail) return json(400,{error:'Compila denominazione, codice meccanografico ed email amministratore.'});
    const requestedCode=normalizeCode(body.existingCode||'');
    let code=requestedCode||makeCode(mechanicalCode), tries=0;
    if(!requestedCode)while(await getJSON(`schools/${code}`)){
        if(++tries>10) return json(409,{error:'Impossibile generare un codice scuola univoco'});
        code=makeCode(mechanicalCode);
      }
    const now=new Date().toISOString();
    const previousSchool=await getJSON(`schools/${code}`);
    const previousMembers=await getJSON(`school-members/${code}`);
    const previousSchedule=await getJSON(`schedules/${code}`);
    if(requestedCode&&!previousSchool&&!Array.isArray(previousMembers)&&!previousSchedule)
      return json(404,{error:'Nessun dato legacy trovato per questo codice. Lascia vuoto il codice per creare una nuova scuola.'});
    const school={...(previousSchool||{}),code,name,mechanicalCode,
      city:String(body.city||previousSchool?.city||'').trim(),
      province:String(body.province||previousSchool?.province||'').trim().toUpperCase(),
      status:'active',createdAt:previousSchool?.createdAt||now,
      createdBy:previousSchool?.createdBy||'platform-admin',inviteCode:code,
      recoveredAt:requestedCode?now:previousSchool?.recoveredAt||''};
    await setJSON(`schools/${code}`,school);
    let directory=await getJSON('schools-index');
    if(!Array.isArray(directory))directory=[];
    await setJSON('schools-index',[code,...directory.filter(x=>x!==code)].slice(0,2000));
    const account=await lookupIdentityAccount(adminEmail);
    const membership={userId:account?.confirmedAt?account.id:'',email:adminEmail,code,role:'admin',status:account?.confirmedAt?'active':'pending',joinedAt:now,assignedBy:requestedCode?'platform-admin-recovery':'platform-admin',displayName:String(body.adminName||'').trim()};
    await setMembership(adminEmail,membership);
    const members=Array.isArray(previousMembers)?previousMembers.slice():[];
    const memberIndex=members.findIndex(item=>normalizeEmail(item.email)===adminEmail);
    if(memberIndex>=0)members[memberIndex]={...members[memberIndex],...membership};else members.push(membership);
    await setJSON(`school-members/${code}`,members.slice(0,1500));

    let emailSent=false, emailError='';
    try{
      await sendSchoolApprovalEmail({
        to:adminEmail,
        schoolName:name,
        schoolCode:code,
        contactName:String(body.adminName||'').trim(),
        accountLinked:membership.status==='active'
      });
      emailSent=true;
    }catch(e){
      emailError=String(e?.message||e);
      console.error('manual school approval email error',e);
    }

    return json(200,{ok:true,school,membership,emailSent,emailError,accountLinked:membership.status==='active',recovered:!!requestedCode,
      preservedSchedule:!!previousSchedule,preservedMembers:Array.isArray(previousMembers)?previousMembers.length:0});
  }catch(e){
    console.error('platform-admin-school error',e);
    return json(500,{error:'Errore backend amministrazione piattaforma',detail:String(e?.message||e)});
  }
};
