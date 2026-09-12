const { getStore } = require('@netlify/blobs');
const crypto = require('crypto');

const store = () => getStore('orario-docente-cloud');
const json = (statusCode, body) => ({ statusCode, headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}, body:JSON.stringify(body) });
const normalizeEmail = (v='') => String(v).trim().toLowerCase();
const normalizeCode = (v='') => String(v).trim().toUpperCase().replace(/[^A-Z0-9-]/g,'');
const emailKey = email => crypto.createHash('sha256').update(normalizeEmail(email)).digest('hex');
function userFromContext(context){
  const u = context && context.clientContext && context.clientContext.user;
  if(!u || !u.email) return null;
  return { id:u.sub || u.id || '', email:normalizeEmail(u.email), metadata:u.user_metadata||{} };
}
async function getJSON(key){ try{return await store().get(key,{type:'json'});}catch(e){return null;} }
async function setJSON(key,value){ return store().setJSON(key,value); }
async function getMembership(email){ return getJSON(`members-by-email/${emailKey(email)}`); }
async function setMembership(email,m){ return setJSON(`members-by-email/${emailKey(email)}`,m); }
async function requireMember(user, roles=[]){
  const membership=await getMembership(user.email);
  if(!membership) return {error:json(403,{error:'Account non collegato a una scuola.'})};
  if(roles.length && !roles.includes(membership.role)) return {error:json(403,{error:'Permessi insufficienti.'})};
  const school=await getJSON(`schools/${normalizeCode(membership.code)}`);
  if(!school || school.status!=='active') return {error:json(403,{error:'Scuola non attiva.'})};
  return {membership,school};
}
module.exports={json,normalizeEmail,normalizeCode,userFromContext,getJSON,setJSON,getMembership,setMembership,requireMember,emailKey};
