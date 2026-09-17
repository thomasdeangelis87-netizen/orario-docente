import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import accreditation from '../netlify/functions/school-accreditation.js';

test('la chiave viene verificata senza leggere gli archivi delle scuole',async()=>{
 const previous=globalThis.Netlify;
 globalThis.Netlify={env:{get:name=>name==='PLATFORM_ADMIN_KEY'?'test-secret':''}};
 try{
  const url='https://example.test/.netlify/functions/school-accreditation?verify-key';
  const valid=await accreditation(new Request(url,{headers:{'x-platform-admin-key':'test-secret'}}));
  assert.equal(valid.status,200);
  assert.deepEqual(await valid.json(),{ok:true});
  const invalid=await accreditation(new Request(url,{headers:{'x-platform-admin-key':'wrong'}}));
  assert.equal(invalid.status,403);
 }finally{globalThis.Netlify=previous}
});

test('una lettura cloud fallita non impedisce l’accesso e mostra gli errori nel pannello',async()=>{
 const html=fs.readFileSync(new URL('../admin.html',import.meta.url),'utf8');
 const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
 const elements=new Map();
 const el=id=>{
  if(!elements.has(id)){
   const classes=new Set(id==='dashboard'?['hidden']:[]);
   elements.set(id,{value:'',innerHTML:'',textContent:'',disabled:false,
    classList:{add:v=>classes.add(v),remove:v=>classes.delete(v),contains:v=>classes.has(v)}});
  }
  return elements.get(id);
 };
 const calls=[];
 const ctx=vm.createContext({document:{getElementById:el},console,
  fetch:async url=>{
   calls.push(url);
   return url.endsWith('?verify-key')
    ?{ok:true,text:async()=>'{"ok":true}'}
    :{ok:false,status:500,text:async()=>'{"error":"Storage temporaneamente non disponibile"}'};
  }});
 new vm.Script(script,{filename:'admin.html'}).runInContext(ctx);
 el('adminKey').value='test-secret';
 await el('adminLoginBtn').onclick();
 assert.equal(el('dashboard').classList.contains('hidden'),false);
 assert.equal(el('loginPanel').classList.contains('hidden'),true);
 assert.match(el('reqMsg').textContent,/Storage temporaneamente non disponibile/);
 assert.match(el('schoolsMsg').textContent,/Storage temporaneamente non disponibile/);
 assert.equal(vm.runInContext('adminKey',ctx),'test-secret');
 assert.equal(calls[0],'/.netlify/functions/school-accreditation?verify-key');
 assert.match(html,/id="adminBuild"[^>]*>v16\.10\.11</);
});
