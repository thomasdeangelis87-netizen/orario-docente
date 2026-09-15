import {json,getJSON,setJSON,setMembership,normalizeCode,normalizeEmail} from './_lib.js';
import {mayRevoke,lookupIdentityAccount} from './_member_ops.js';
import {changeManagerLogin} from './_school_email_change.js';
import {sendSchoolApprovalEmail} from './_brevo.js';
import {changeAccreditation} from './_accreditation_status.js';
import {accreditedCatalog,requestedSchoolCode} from './_accredited_catalog.js';

function authorized(req){
  let secret='';try{secret=Netlify.env.get('PLATFORM_ADMIN_KEY')||''}catch{}
  return !!secret && req.headers.get('x-platform-admin-key')===secret;
}
export default async (req,context={})=>{
  let stage='authorization';
  try{
    if(!authorized(req))return json(403,{error:'Accesso piattaforma non autorizzato'});
    if(req.method==='GET'){
      stage='catalog';
      const code=requestedSchoolCode(req.url);
      const schools=await accreditedCatalog({read:getJSON},code);
      if(code)return schools[0]?json(200,schools[0]):json(404,{error:'Scuola non trovata'});
      return json(200,{schools});
    }
    if(req.method!=='POST')return json(405,{error:'Metodo non consentito'});
    let body;try{body=await req.json()}catch{return json(400,{error:'Dati non validi'});}
    stage='school-lookup';
    const code=normalizeCode(body.code), data=(await accreditedCatalog({read:getJSON,write:setJSON},code))[0];
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
  }catch(error){
    console.error('platform-schools failure',{requestId:context.requestId||'',stage,name:error?.name,
      code:error?.code,message:String(error?.message||error).slice(0,300)});
    return json(500,{error:'Gestione scuole non disponibile',requestId:context.requestId||'',stage});
  }
};
