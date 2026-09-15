import {json,currentUser,getMembership,getJSON,setJSON,normalizeCode,normalizeEmail,emailKey} from './_lib.js';

export default async(req)=>{
 try{
  const user=await currentUser();if(!user)return json(401,{error:'Accesso richiesto'});
  if(req.method==='GET'){
   const existing=await getJSON(`link-requests-by-email/${emailKey(user.email)}`);
   return json(200,{request:existing||null});
  }
  if(req.method!=='POST')return json(405,{error:'Metodo non consentito'});
  const body=await req.json();const code=normalizeCode(body.schoolId);
  const school=await getJSON(`schools/${code}`);
  if(!code||!school||school.status!=='active')return json(404,{error:'Scuola non accreditata'});
  const membership=await getMembership(user.email);
  if(membership?.status==='active')return json(409,{error:'Account già collegato a una scuola'});
  const old=await getJSON(`link-requests-by-email/${emailKey(user.email)}`);
  if(old?.status==='pending')return json(409,{error:'Hai già una richiesta in attesa. Attendi la risposta della scuola.'});
  const request={email:normalizeEmail(user.email),code,schoolName:school.name,status:'pending',displayName:String(body.displayName||'').trim().slice(0,120),requestedAt:new Date().toISOString()};
  await setJSON(`link-requests-by-email/${emailKey(user.email)}`,request);
  const requests=await getJSON(`school-link-requests/${code}`);
  const list=Array.isArray(requests)?requests:[];
  const ix=list.findIndex(x=>normalizeEmail(x.email)===request.email);
  if(ix>=0)list[ix]=request;else list.push(request);
  await setJSON(`school-link-requests/${code}`,list.slice(0,1500));
  return json(200,{ok:true,request});
 }catch(e){console.error('school-link-request error',e);return json(500,{error:'Errore richiesta collegamento'});}
};
