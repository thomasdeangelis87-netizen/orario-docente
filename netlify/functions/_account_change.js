import crypto from 'node:crypto';
import {emailKey,memberIdKey,normalizeCode,normalizeEmail} from './_lib.js';
import {mayRevoke} from './_member_ops.js';

const queueKey=code=>`school-account-change-requests/${normalizeCode(code)}`;
const userKey=id=>`account-change-by-user/${encodeURIComponent(id)}`;

export async function requestAccountChange({user,code,school,read,write}){
  const key=userKey(user.id),existing=await read(key);
  if(existing?.status==='pending')return existing;
  const request={id:crypto.randomUUID(),userId:user.id,email:normalizeEmail(user.email),
    code:normalizeCode(code),schoolName:school.name,status:'pending',
    requestedAt:new Date().toISOString()};
  await write(key,request);
  const list=(await read(queueKey(code)))||[];
  list.push(request);
  await write(queueKey(code),list.slice(-1500));
  return request;
}

export async function decideAccountChange({code,id,action,read,write,getIdentityUser}){
  const key=queueKey(code),queue=(await read(key))||[];
  const index=queue.findIndex(r=>r.id===id&&r.status==='pending'&&r.code===code);
  if(index<0)return {status:404,error:'Richiesta di cambio account non trovata'};
  const request=queue[index];
  const stored=await read(userKey(request.userId));
  if(stored?.id!==id||stored.status!=='pending')return {status:409,error:'La richiesta non è più attiva'};
  if(action==='approve-account-change'){
    const applicant=await getIdentityUser(request.userId);
    if(applicant?.id!==request.userId||normalizeEmail(applicant.email)!==request.email)
      return {status:409,error:'L’account richiedente non corrisponde più a Identity'};
    const pointer=await read(`members-by-email/${emailKey(request.email)}`);
    const roster=(await read(`school-members/${code}`))||[];
    const old=roster.filter(m=>normalizeEmail(m.email)===request.email&&m.status==='active'&&m.userId!==request.userId);
    if(pointer?.status==='active'&&pointer.userId!==request.userId&&normalizeCode(pointer.code)!==code)
      return {status:409,error:'L’email è associata a un’altra scuola: risolvi prima quel collegamento'};
    if(pointer?.status==='active'&&pointer.userId!==request.userId&&
       !old.some(m=>m.userId===pointer.userId))
      return {status:409,error:'Il collegamento precedente non corrisponde all’elenco scuola: verifica i dati prima di approvare'};
    if(old.length>1||old.some(m=>m.role==='admin'&&!mayRevoke(roster,m.email)))
      return {status:409,error:'Prima assegna un altro amministratore alla scuola'};
    for(const member of old){
      if(!member.userId)continue;
      const bound=await read(memberIdKey(member.userId));
      if(bound?.userId===member.userId&&normalizeCode(bound.code)===code)
        await write(memberIdKey(member.userId),{...bound,status:'revoked',revokedAt:new Date().toISOString(),revokedReason:'account-replaced'});
    }
    const membership={userId:request.userId,email:request.email,code,role:'teacher',
      status:'active',joinedAt:new Date().toISOString(),assignedBy:'platform-admin-account-change'};
    // Identity and personal profiles are never edited; only the membership is reassigned.
    await write(memberIdKey(request.userId),membership);
    await write(`members-by-email/${emailKey(request.email)}`,membership);
    await write(`school-members/${code}`,roster.filter(m=>normalizeEmail(m.email)!==request.email).concat(membership).slice(0,1500));
  }
  const decided={...request,status:action==='approve-account-change'?'approved':'rejected',decidedAt:new Date().toISOString()};
  queue[index]=decided;
  await write(key,queue);
  await write(userKey(request.userId),decided);
  return {status:200,ok:true,request:decided};
}
