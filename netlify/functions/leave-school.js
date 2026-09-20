import {json,currentUser,getJSON,setJSON,setMembership,getMembership,normalizeCode,normalizeEmail} from './_lib.js';

export async function leaveSchool(user,{read=getJSON,write=setJSON,membershipFor=getMembership,saveMembership=setMembership,now=()=>new Date().toISOString()}={}){
  const membership=await membershipFor(user);
  if(!membership||membership.status!=='active')return {status:404,error:'Account non collegato a una scuola'};
  if(membership.role!=='teacher')return {status:409,error:'Un amministratore o referente deve trasferire il proprio ruolo prima di scollegarsi.'};
  const code=normalizeCode(membership.code),left={...membership,status:'left',leftAt:now(),leftBy:user.id};
  await saveMembership(user.email,left);
  const members=(await read(`school-members/${code}`))||[];
  const ix=members.findIndex(m=>m.userId===user.id||normalizeEmail(m.email)===normalizeEmail(user.email));
  if(ix>=0){members[ix]=left;await write(`school-members/${code}`,members)}
  const requestKey=`link-requests-by-user/${encodeURIComponent(user.id)}`,request=await read(requestKey);
  if(request&&normalizeCode(request.code)===code){request.status='withdrawn';request.decidedAt=left.leftAt;request.decidedBy=user.id;await write(requestKey,request);const requests=(await read(`school-link-requests/${code}`))||[];const ri=requests.findIndex(x=>x.userId===user.id);if(ri>=0){requests[ri]=request;await write(`school-link-requests/${code}`,requests)}}
  return {status:200,membership:left,schoolCode:code};
}

export default async(req,context)=>{
 try{
  if(req.method!=='POST')return json(405,{error:'Metodo non consentito'});
  const user=await currentUser(req,context);if(!user)return json(401,{error:'Accesso richiesto'});
  const outcome=await leaveSchool(user);
  if(outcome.error)return json(outcome.status,{error:outcome.error});
  return json(200,{ok:true,schoolCode:outcome.schoolCode});
 }catch(error){console.error('leave-school error',{requestId:context?.requestId||'',name:error?.name,message:String(error?.message||error).slice(0,200)});return json(500,{error:'Non è stato possibile scollegare la scuola',requestId:context?.requestId||''})}
};
