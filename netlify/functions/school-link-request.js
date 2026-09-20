import {json,currentUser,getMembership,getJSON,setJSON,normalizeCode,normalizeEmail} from './_lib.js';
import {sendSchoolLinkRequestEmail} from './_brevo.js';

async function notifySchoolManagers({code,school,request}){
 const members=(await getJSON(`school-members/${code}`))||[];
 const recipients=[...new Set(members.filter(m=>m?.status==='active'&&['admin','coordinator'].includes(m.role)&&String(m.email||'').includes('@')).map(m=>normalizeEmail(m.email)))];
 for(const to of recipients){try{await sendSchoolLinkRequestEmail({to,schoolName:school.name,teacherName:request.displayName,teacherEmail:request.email})}catch(error){console.error('school link request email failed',{code,to,name:error?.name,errorCode:error?.code||'',message:String(error?.message||error).slice(0,180)})}}
}

export default async(req,context)=>{
 try{
  const user=await currentUser(req,context);if(!user)return json(401,{error:'Accesso richiesto'});
  if(!user.id)return json(403,{error:'ID account non disponibile'});
  const requestKey=`link-requests-by-user/${encodeURIComponent(user.id)}`;
  if(req.method==='GET'){
   const existing=await getJSON(requestKey);
   return json(200,{request:existing||null});
  }
  if(req.method!=='POST')return json(405,{error:'Metodo non consentito'});
  const body=await req.json();
  if(body.action==='cancel-request'){
   const old=await getJSON(requestKey);
   if(!old||old.status!=='pending')return json(404,{error:'Nessuna richiesta in attesa da annullare'});
   old.status='cancelled';old.decidedAt=new Date().toISOString();old.decidedBy=user.id;
   await setJSON(requestKey,old);
   const requests=(await getJSON(`school-link-requests/${normalizeCode(old.code)}`))||[];
   const ix=requests.findIndex(x=>x.userId===user.id&&x.status==='pending');if(ix>=0){requests[ix]=old;await setJSON(`school-link-requests/${normalizeCode(old.code)}`,requests)}
   return json(200,{ok:true,request:old});
  }
  const code=normalizeCode(body.schoolId);
  const school=await getJSON(`schools/${code}`);
  if(!code||!school||school.status!=='active')return json(404,{error:'Scuola non accreditata'});
  const membership=await getMembership(user);
  if(membership?.status==='active')return json(409,{error:'Account già collegato a una scuola'});
  const old=await getJSON(requestKey);
  if(old?.status==='pending')return json(409,{error:'Hai già una richiesta in attesa. Attendi la risposta della scuola.'});
  const request={userId:user.id,email:normalizeEmail(user.email),code,schoolName:school.name,status:'pending',displayName:String(body.displayName||'').trim().slice(0,120),requestedAt:new Date().toISOString()};
  await setJSON(requestKey,request);
  const requests=await getJSON(`school-link-requests/${code}`);
  const list=Array.isArray(requests)?requests:[];
  const ix=list.findIndex(x=>normalizeEmail(x.email)===request.email);
  if(ix>=0)list[ix]=request;else list.push(request);
  await setJSON(`school-link-requests/${code}`,list.slice(0,1500));
  const notification=notifySchoolManagers({code,school,request});
  if(typeof context?.waitUntil==='function')context.waitUntil(notification);else await notification;
  return json(200,{ok:true,request});
 }catch(e){console.error('school-link-request error',e);return json(500,{error:'Errore richiesta collegamento'});}
};
