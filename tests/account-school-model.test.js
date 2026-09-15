import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {mayClaimLegacy,mayRevoke,activeAdministrators} from '../netlify/functions/_member_ops.js';
import {scheduleKey,publishOfficialSchedule,getOfficialSchedule} from '../netlify/functions/_school_schedule_core.js';
import '../account-storage.js';

test('nuovo account che riutilizza una email non riceve né profilo né ruolo legacy',()=>{
  const old={id:'deleted-user',email:'same@example.it',createdAt:'2026-01-01T00:00:00Z'};
  const replacement={id:'new-user',email:old.email,createdAt:'2026-09-15T00:00:00Z'};
  const legacy={email:old.email,role:'admin',status:'active',joinedAt:'2026-04-01T00:00:00Z'};
  assert.equal(mayClaimLegacy(old,legacy),true);
  assert.equal(mayClaimLegacy(replacement,legacy),false);
  assert.equal(mayClaimLegacy(replacement,{...legacy,userId:old.id}),false);
  assert.notEqual(globalThis.OrarioAccountStorage.personalStorageKey(old),globalThis.OrarioAccountStorage.personalStorageKey(replacement));
  const backend=fs.readFileSync(new URL('../netlify/functions/profile.js',import.meta.url),'utf8');
  assert.match(backend,/profiles-by-user\/.*user\.id/);
  assert.doesNotMatch(backend,/profiles\/.*emailKey/);
});

test('ultimo amministratore non revocabile; cambio amministratore mantiene codice e orario',async()=>{
  const school='VAIS-32128';
  const members=[{email:'old@example.it',userId:'old',role:'admin',status:'active',code:school}];
  assert.equal(mayRevoke(members,'old@example.it'),false);
  members.push({email:'new@example.it',userId:'new',role:'admin',status:'active',code:school});
  assert.equal(activeAdministrators(members).length,2);
  assert.equal(mayRevoke(members,'old@example.it'),true);
  members[0].status='revoked';
  assert.equal(mayRevoke(members,'new@example.it'),false);
  const storage=new Map([[scheduleKey(school),{schoolCode:school,version:1,entries:[{teacher:'Falcone'}],teachers:['Falcone']}]]);
  const read=k=>storage.get(k),write=(k,v)=>storage.set(k,v);
  assert.equal((await getOfficialSchedule(school,read)).entries.length,1);
  await publishOfficialSchedule({code:school,body:{publish:true,schedule:{entries:[{teacher:'Falcone'}],teachers:['Falcone']}},read,write});
  assert.equal(storage.size,1);
  assert.equal((await getOfficialSchedule(school,read)).version,2);
  assert.equal(storage.has(scheduleKey(school)),true);
});

test('Portale scuola e pannello piattaforma non eliminano orari esistenti per revocare un ruolo',()=>{
  const handlers=['platform-schools.js','school-members.js','join-school.js'].map(name=>fs.readFileSync(new URL('../netlify/functions/'+name,import.meta.url),'utf8'));
  assert.match(handlers[0],/if\(schedule\|\|members\.length/);
  assert.match(handlers[1],/mayRevoke\(list,email\)/);
  assert.match(handlers[2],/prior\?\.status==='revoked'/);
  assert.doesNotMatch(handlers[1],/schedules\/\$\{code\}.*delete/);
  assert.match(fs.readFileSync(new URL('../admin.html',import.meta.url),'utf8'),/Scuole accreditate/);
  assert.match(fs.readFileSync(new URL('../index.html',import.meta.url),'utf8'),/Gestione accessi/);
});
