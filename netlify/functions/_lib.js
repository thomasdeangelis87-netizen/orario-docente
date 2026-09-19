import crypto from 'node:crypto';
import {mayClaimLegacy} from './_member_ops.js';

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store'
    }
  });

const normalizeEmail = (v='') => String(v).trim().toLowerCase();
const normalizeCode = (v='') => String(v).trim().toUpperCase().replace(/[^A-Z0-9-]/g,'');
const emailKey = email => crypto.createHash('sha256').update(normalizeEmail(email)).digest('hex');
// A single site-scoped document per accredited school, never per user or deploy.
const schoolScheduleKey = code => `schedules/${normalizeCode(code)}`;

function cookieValue(header,name){
  for(const part of String(header||'').split(';')){
    const index=part.indexOf('=');
    if(index<0)continue;
    if(part.slice(0,index).trim()===name){
      try{return decodeURIComponent(part.slice(index+1).trim())}catch{return part.slice(index+1).trim()}
    }
  }
  return '';
}

async function currentUser(req,{fetchImpl=fetch}={}){
  // @netlify/identity's browser client stores the signed session in nf_jwt.
  // Validate that token with the site's Identity endpoint instead of trusting
  // decoded claims. This also avoids a Deploy Preview runtime crash observed
  // before the Function handler could emit logs.
  const auth=String(req?.headers?.get?.('authorization')||'');
  const token=auth.match(/^Bearer\s+(.+)$/i)?.[1]||cookieValue(req?.headers?.get?.('cookie'),'nf_jwt');
  if(!token)return null;
  let origin='';
  try{origin=new URL(req.url).origin}catch{return null}
  const response=await fetchImpl(`${origin}/.netlify/identity/user`,{
    headers:{authorization:`Bearer ${token}`}
  });
  if(!response.ok)return null;
  const u=await response.json();
  if(!u || !u.email) return null;
  return {
    id: u.id || u.sub || '',
    email: normalizeEmail(u.email),
    createdAt: u.createdAt || u.created_at || '',
    metadata: u.userMetadata || u.user_metadata || {}
  };
}

async function store(){
  const {getStore}=await import('@netlify/blobs');
  // Site-scoped store; this is the same document on main and deploy previews.
  return getStore('orario-docente-cloud');
}

async function getJSON(key){
  return await (await store()).get(key,{type:'json',consistency:'strong'});
}
async function setJSON(key,value){
  return await (await store()).setJSON(key,value);
}
async function deleteJSON(key){
  return await (await store()).delete(key);
}
async function listKeys(prefix){
  const result=await (await store()).list({prefix});
  return (result.blobs||[]).map(item=>item.key);
}
const memberIdKey=id=>`members-by-user/${encodeURIComponent(String(id||''))}`;
async function getMembership(identity){
  if(typeof identity==='string')return await getJSON(`members-by-email/${emailKey(identity)}`);
  if(!identity?.id)return null;
  const bound=await getJSON(memberIdKey(identity.id));
  if(bound){
    if(bound.status==='active'&&normalizeEmail(bound.email)!==identity.email){
      const change=await getJSON(`identity-email-changes/${encodeURIComponent(identity.id)}`);
      if(change?.status==='requested'&&change.userId===identity.id&&
          normalizeEmail(change.newEmail)===identity.email&&normalizeCode(change.code)===normalizeCode(bound.code)){
        const {finishEmailChange}=await import('./_school_email_change.js');
        return await finishEmailChange(change,{getJSON,setJSON});
      }
    }
    return bound.status==='active'&&normalizeEmail(bound.email)===identity.email?bound:null;
  }
  const legacy=await getMembership(identity.email);
  if(!mayClaimLegacy(identity,legacy))return null;
  // Fail closed on an account recreated with an old email. Invitation-only
  // records are deliberately not auto-claimed by a new account.
  const migrated={...legacy,userId:identity.id,email:identity.email};
  await setMembership(identity.email,migrated);
  const members=(await getJSON(`school-members/${normalizeCode(legacy.code)}`))||[];
  const ix=members.findIndex(m=>normalizeEmail(m.email)===identity.email);
  if(ix>=0){members[ix]={...members[ix],...migrated};await setJSON(`school-members/${normalizeCode(legacy.code)}`,members)}
  return migrated;
}
async function setMembership(email,m){
  const record={...m,email:normalizeEmail(email)};
  if(record.userId)await setJSON(memberIdKey(record.userId),record);
  return await setJSON(`members-by-email/${emailKey(email)}`,record);
}
async function requireMember(user, roles=[]){
  const membership=await getMembership(user);
  if(!membership) return {error:json(403,{error:'Account non collegato a una scuola.'})};
  if(membership.status!=='active'||roles.length && !roles.includes(membership.role)) return {error:json(403,{error:'Permessi insufficienti.'})};
  const school=await getJSON(`schools/${normalizeCode(membership.code)}`);
  if(!school || school.status!=='active') return {error:json(403,{error:'Scuola non attiva.'})};
  return {membership:{...membership,code:normalizeCode(membership.code)},school};
}

export {json,normalizeEmail,normalizeCode,emailKey,memberIdKey,schoolScheduleKey,cookieValue,currentUser,getJSON,setJSON,deleteJSON,listKeys,getMembership,setMembership,requireMember};
