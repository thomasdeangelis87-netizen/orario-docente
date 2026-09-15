import { getStore } from '@netlify/blobs';
import { getUser } from '@netlify/identity';
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

async function currentUser(){
  const u = await getUser();
  if(!u || !u.email) return null;
  return {
    id: u.id || u.sub || '',
    email: normalizeEmail(u.email),
    metadata: u.userMetadata || u.user_metadata || {}
  };
}

function store(){
  // IMPORTANT: getStore is created only while a modern Netlify Function request is active.
  return getStore({name:'orario-docente-cloud',consistency:'strong'});
}

async function getJSON(key){
  return await store().get(key,{type:'json'});
}
async function setJSON(key,value){
  return await store().setJSON(key,value);
}
async function listKeys(prefix){
  const result=await store().list({prefix});
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
  return {membership,school};
}

export {json,normalizeEmail,normalizeCode,emailKey,currentUser,getJSON,setJSON,listKeys,getMembership,setMembership,requireMember};
