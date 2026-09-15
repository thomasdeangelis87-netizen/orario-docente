import {json,getJSON,setJSON,listKeys,setMembership,normalizeCode,normalizeEmail} from './_lib.js';
import {mayRevoke,lookupIdentityAccount} from './_member_ops.js';
import {changeManagerLogin} from './_school_email_change.js';
import {sendSchoolApprovalEmail} from './_brevo.js';
import {changeAccreditation} from './_accreditation_status.js';

function authorized(req){
  let secret='';try{secret=Netlify.env.get('PLATFORM_ADMIN_KEY')||''}catch{}
  return !!secret && req.headers.get('x-platform-admin-key')===secret;
}
async function codes(){
  const result=new Set((await getJSON('schools-index'))||[]);
  for(const key of await listKeys('schools/'))result.add(key.slice(8));
  return [...result].filter(Boolean).slice(0,2000);
}
async function snapshot(code){
  const school=await getJSON(`schools/${code}`);
  if(!school)return null;
  const members=(await getJSON(`school-members/${code}`))||[];
  return {school,members,managers:members.filter(m=>['admin','coordinator'].includes(m.role)&&m.status==='active')};
}
export default async req=>{
  try{
    if(!authorized(req))return json(403,{error:'Accesso piattaforma non autorizzato'});
    if(req.method==='GET'){
      const code=normalizeCode(new URL(req.url).searchParams.get('code'));
      if(code){const data=await snapshot(code);return data?json(200,data):json(404,{error:'Scuola non trovata'});}
      const schools=[];
      for(const id of await codes()){
        const data=await snapshot(normalizeCode(id));
        if(data)schools.push({school:data.school,managers:data.managers});
      }
      return json(200,{schools});
    }
    if(req.method!=='POST')return json(405,{error:'Metodo non consentito'});
    let body;try{body=await req.json()}catch{return json(400,{error:'Dati non validi'});}
    const code=normalizeCode(body.code), data=await snapshot(code);
    if(!data)return json(404,{error:'Scuola non trovata'});
    const {school,members}=data, action=String(body.action||'');
    if(['suspend','reactivate','revoke-accreditation'].includes(action)){
      const outcome=await changeAccreditation({school,code,action,confirmation:body.confirmation,write:setJSON});
      const {status,...result}=outcome;
      return json(status,result);
    }
    if(action==='change-manager-email'){
      const oldEmail=normalizeEmail(body.email);
      const manager=members.find(m=>m.status==='active'&&['admin','coordinator'].includes(m.role)&&m.email===oldEmail);
      if(!manager)return json(404,{error:'Account gestore attivo non trovato'});
      const {admin}=await import('@netlify/identity');
      const outcome=await changeManagerLogin({code,membership:manager,newEmail:body.newEmail,
        read:getJSON,write:setJSON,identityAdmin:admin,findByEmail:lookupIdentityAccount});
      const {status,...result}=outcome;
      return json(status,result);
    }
    if(action==='resend-approval-email'){
      if(school.status!=='active')return json(409,{error:'Riattiva l’accreditamento prima di inviare l’email.'});
      const manager=members.find(m=>m.role==='admin'&&m.status==='active');
      if(!manager)return json(409,{error:'Nessun amministratore attivo a cui inviare il codice.'});
      const result=await sendSchoolApprovalEmail({to:manager.email,schoolName:school.name,
        schoolCode:code,contactName:manager.displayName||''});
      return json(200,{ok:true,emailSent:true,messageId:result.messageId||''});
    }
    if(!['assign-manager','revoke-manager'].includes(action))return json(400,{error:'Azione non riconosciuta'});
    const email=normalizeEmail(body.email);
    if(!email.includes('@'))return json(400,{error:'Email non valida'});
    const index=members.findIndex(m=>normalizeEmail(m.email)===email);
    const old=index>=0?members[index]:null;
    if(action==='revoke-manager'){
      if(!old||!['admin','coordinator'].includes(old.role))return json(404,{error:'Gestore non trovato'});
      if(!mayRevoke(members,email))return json(409,{error:'Non puoi revocare l’ultimo amministratore attivo.'});
      const revised={...old,status:'revoked',revokedAt:new Date().toISOString(),revokedBy:'platform-admin'};
      await setMembership(email,revised);members[index]=revised;
    }else{
      const role=String(body.role||'');
      if(!['admin','coordinator'].includes(role))return json(400,{error:'Ruolo gestore non valido'});
      if(old?.role==='admin'&&role!=='admin'&&!mayRevoke(members,email))return json(409,{error:'Non puoi declassare l’ultimo amministratore attivo.'});
      const account=await lookupIdentityAccount(email);
      if(old?.userId&&account?.id&&old.userId!==account.id)return json(409,{error:'Email riutilizzata: un account diverso non eredita il vecchio ruolo. Revoca prima il vecchio account.'});
      const revised={userId:account?.confirmedAt?account.id:'',email,code,role,
        status:account?.confirmedAt?'active':'pending',joinedAt:new Date().toISOString(),assignedBy:'platform-admin',displayName:String(body.displayName||'').slice(0,120)};
      await setMembership(email,revised);
      if(index>=0)members[index]=revised;else members.push(revised);
    }
    await setJSON(`school-members/${code}`,members);
    return json(200,{ok:true,school,members});
  }catch(error){console.error('platform-schools failure',error);return json(500,{error:'Gestione scuole non disponibile'});}
};
