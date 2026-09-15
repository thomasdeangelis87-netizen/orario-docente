import crypto from 'node:crypto';

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
async function listKeys(prefix){
  const result=await (await store()).list({prefix});
  return (result.blobs||[]).map(item=>item.key);
}
async function getMembership(email){
  return await getJSON(`members-by-email/${emailKey(email)}`);
}
async function setMembership(email,m){
  return await setJSON(`members-by-email/${emailKey(email)}`,m);
}
async function requireMember(user, roles=[]){
  const membership=await getMembership(user.email);
  if(!membership) return {error:json(403,{error:'Account non collegato a una scuola.'})};
  if(roles.length && !roles.includes(membership.role)) return {error:json(403,{error:'Permessi insufficienti.'})};
  const school=await getJSON(`schools/${normalizeCode(membership.code)}`);
  if(!school || school.status!=='active') return {error:json(403,{error:'Scuola non attiva.'})};
  return {membership:{...membership,code:normalizeCode(membership.code)},school};
}

export {json,normalizeEmail,normalizeCode,emailKey,schoolScheduleKey,currentUser,getJSON,setJSON,listKeys,getMembership,setMembership,requireMember};
