import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createAuthEventBridge} from '../src/auth-event-bridge.js';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');

test('una scheda che modifica lo storage non nasconde una sessione ancora valida',async()=>{
 const events=[];
 const bridge=createAuthEventBridge(async()=>({id:'user-1'}),(event,user)=>events.push([event,user?.id]));
 await bridge('logout',null);
 assert.deepEqual(events,[['login','user-1']]);
});

test('il logout effettivo mostra il login e una verifica obsoleta non prevale sul nuovo accesso',async()=>{
 const events=[];
 let resolveOld;
 let checks=0;
 const bridge=createAuthEventBridge(()=>++checks===1 ? new Promise(resolve=>{resolveOld=resolve}) : Promise.resolve({id:'user-2'}),(event,user)=>events.push([event,user?.id]));
 const old=bridge('logout',null);
 // A newer login supersedes a pending, older storage notification.
 const newLogin=bridge('login',{id:'user-2'});
 resolveOld(null);
 await Promise.all([old,newLogin]);
 assert.deepEqual(events,[['login','user-2']]);
 const loggedOut=[];
 await createAuthEventBridge(async()=>null,event=>loggedOut.push(event))('logout',null);
 assert.deepEqual(loggedOut,['logout']);
});

test('all’avvio il form di accesso resta nascosto fino alla verifica Identity',()=>{
 assert.match(html,/<section id="bootView" class="auth-shell"/);
 assert.match(html,/<section id="authView" class="auth-shell hidden"/);
 assert.match(html,/function showLoading\(\)\{bootView\.classList\.remove\('hidden'\);authView\.classList\.add\('hidden'\)/);
 assert.match(html,/async function handleUser\(user\)[\s\S]*?if\(!user\?\.id\)\{showAuth\(\);return\}[\s\S]*?showLoading\(\)/);
 assert.match(html,/String\(user\.id\)===String\(currentUser\?\.id\|\|''\)/);
 assert.doesNotMatch(html,/showAuth\(\);\s*<\/script>/);
});

test('il caricamento iniziale non viene scambiato per una modifica da salvare',()=>{
 assert.match(html,/function render\(\{save=true\}=\{\}\)/);
 assert.match(html,/render\(\{save:false\}\);renderSchool\(\);renderMyClasses\(\)/);
 assert.match(html,/await loadSchoolCloud\(\{saveProfile:false\}\)/);
 assert.match(html,/if\(saveProfile\)scheduleCloudSave\(\)/);
 assert.match(html,/if\(!migrated\)\{setCloudStatus\('Errore salvataggio online',false\);return\}/);
});

test('le Function ricevono il token senza il cookie che blocca la Preview',()=>{
 assert.match(html,/jwtCookie=document\.cookie\.split\(';'\)/);
 assert.match(html,/headers\['X-Orario-Identity'\]/);
 assert.match(html,/credentials:'omit'/);
});
