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

async function currentUser(){
  // Load platform SDKs only after the Function request context is active.
  const {getUser}=await import('@netlify/identity');
  const u = await getUser();
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
  if(bound)return bound.status==='active'&&normalizeEmail(bound.email)===identity.email?bound:null;
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

export {json,normalizeEmail,normalizeCode,emailKey,memberIdKey,schoolScheduleKey,currentUser,getJSON,setJSON,deleteJSON,listKeys,getMembership,setMembership,requireMember};
