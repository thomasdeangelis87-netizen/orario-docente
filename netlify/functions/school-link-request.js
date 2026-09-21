import {json,currentUser,getMembership,setMembership,getJSON,setJSON,normalizeCode,normalizeEmail} from './_lib.js';

async function connectSelectedSchool({user,school,request}){
 const code=normalizeCode(request.code),email=normalizeEmail(user.email);
 const now=new Date().toISOString();
 const membership={userId:user.id,email,code,role:'teacher',status:'active',joinedAt:now,assignedBy:'self-service-school-directory',displayName:request.displayName};
 await setMembership(email,membership);
 const members=(await getJSON(`school-members/${code}`))||[];
 const memberIx=members.findIndex(item=>item?.userId===user.id||normalizeEmail(item?.email)===email);
 if(memberIx>=0)members[memberIx]=membership;else members.push(membership);
 await setJSON(`school-members/${code}`,members.slice(0,1500));
 const approved={...request,status:'approved',decidedAt:now,decidedBy:'self-service-school-directory'};
 await setJSON(`link-requests-by-user/${encodeURIComponent(user.id)}`,approved);
 const requests=(await getJSON(`school-link-requests/${code}`))||[];
 const ix=requests.findIndex(item=>item?.userId===user.id);
 if(ix>=0)requests[ix]=approved;else requests.push(approved);
 await setJSON(`school-link-requests/${code}`,requests.slice(0,1500));
 return {request:approved,membership,school:{code,name:school.name}};
}

export default async(req,context)=>{
 try{
  const user=await currentUser(req,context);if(!user)return json(401,{error:'Accesso richiesto'});
  if(!user.id)return json(403,{error:'ID account non disponibile'});
  const requestKey=`link-requests-by-user/${encodeURIComponent(user.id)}`;
  if(req.method==='GET'){
   const existing=await getJSON(requestKey);
   if(existing?.status==='pending'){
    const code=normalizeCode(existing.code),school=await getJSON(`schools/${code}`);
    if(school?.status==='active'){
     const connected=await connectSelectedSchool({user,school,request:existing});
     if(connected)return json(200,{ok:true,connected:true,...connected});
    }
   }
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
  if(old?.status==='pending'){
   const oldCode=normalizeCode(old.code),oldSchool=await getJSON(`schools/${oldCode}`);
   if(oldSchool?.status==='active'){
    const connected=await connectSelectedSchool({user,school:oldSchool,request:old});
    return json(200,{ok:true,connected:true,...connected});
   }
  }
  const request={userId:user.id,email:normalizeEmail(user.email),code,schoolName:school.name,status:'pending',displayName:String(body.displayName||'').trim().slice(0,120),requestedAt:new Date().toISOString()};
  await setJSON(requestKey,request);
  const requests=await getJSON(`school-link-requests/${code}`);
  const list=Array.isArray(requests)?requests:[];
  const ix=list.findIndex(x=>normalizeEmail(x.email)===request.email);
  if(ix>=0)list[ix]=request;else list.push(request);
  await setJSON(`school-link-requests/${code}`,list.slice(0,1500));
  const connected=await connectSelectedSchool({user,school,request});
  return json(200,{ok:true,connected:true,...connected});
 }catch(e){console.error('school-link-request error',e);return json(500,{error:'Errore richiesta collegamento'});}
};
