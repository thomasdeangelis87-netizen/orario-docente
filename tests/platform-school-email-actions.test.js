import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {emailKey,memberIdKey} from '../netlify/functions/_lib.js';
import {changeManagerLogin,finishEmailChange,changeKey} from '../netlify/functions/_school_email_change.js';
import {changeAccreditation} from '../netlify/functions/_accreditation_status.js';

const code='VAIS-32128',oldEmail='school-admin@example.it',newEmail='school-admin-new@example.it';
function fixture(){
 const manager={userId:'stable-id',email:oldEmail,code,role:'admin',status:'active',joinedAt:'2026-09-14T00:00:00Z'};
 const schedule={schoolCode:code,version:3,entries:[{teacher:'Docente Falcone'}],teachers:['Docente Falcone']};
 const store=new Map([
  [`school-members/${code}`,[manager]],
  [memberIdKey('stable-id'),manager],
  [`members-by-email/${emailKey(oldEmail)}`,manager],
  [`schools/${code}`,{code,name:'Istituto Falcone',status:'active',accreditationId:'school-request'}],
  ['accreditations/school-request',{accountUserId:'stable-id',accountEmail:oldEmail,contactEmail:oldEmail}],
  [`schedules/${code}`,schedule],['profiles-by-user/stable-id',{fullName:'Vecchio Nome',userId:'stable-id'}]
 ]);
 return {manager,schedule,store,read:async key=>store.get(key)||null,write:async(key,value)=>store.set(key,value)};
}

test('Identity cambia email dello stesso ID e i riferimenti scuola; orario e profilo non vengono toccati',async()=>{
 const f=fixture(),calls=[];
 const admin={getUser:async id=>({id,email:oldEmail,confirmedAt:'2026-01-01'}),updateUser:async(id,changes)=>{
  calls.push([id,changes]);return {id,email:changes.email};
 }};
 const result=await changeManagerLogin({code,membership:f.manager,newEmail,read:f.read,write:f.write,
  identityAdmin:admin,findByEmail:async()=>null});
 assert.equal(result.status,200);
 assert.deepEqual(calls,[['stable-id',{email:newEmail}]]);
 assert.equal(f.store.get(memberIdKey('stable-id')).email,newEmail);
 assert.equal(f.store.get(`members-by-email/${emailKey(oldEmail)}`).status,'renamed');
 assert.equal(f.store.get(`members-by-email/${emailKey(newEmail)}`).userId,'stable-id');
 assert.equal(f.store.get(`school-members/${code}`)[0].email,newEmail);
 assert.equal(f.store.get('accreditations/school-request').accountEmail,newEmail);
 assert.equal(f.store.get(`schedules/${code}`),f.schedule);
 assert.equal(f.store.get('profiles-by-user/stable-id').fullName,'Vecchio Nome');
});

test('email collisione su Identity non muta il login né l’orario scuola',async()=>{
 const f=fixture();let updates=0;
 const result=await changeManagerLogin({code,membership:f.manager,newEmail,read:f.read,write:f.write,
  identityAdmin:{getUser:async()=>({id:'stable-id',email:oldEmail}),updateUser:async()=>{updates++;}},
  findByEmail:async()=>({id:'another-account',email:newEmail})});
 assert.equal(result.status,409);assert.equal(updates,0);
 assert.equal(f.store.get(`schedules/${code}`),f.schedule);
});

test('cambio Identity in attesa di verifica: autorizzazione riprende dopo la conferma, senza nuovo ID',async()=>{
 const f=fixture();let updates=0;
 const result=await changeManagerLogin({code,membership:f.manager,newEmail,read:f.read,write:f.write,
  identityAdmin:{getUser:async()=>({id:'stable-id',email:oldEmail}),updateUser:async id=>{
   updates++;return {id,email:oldEmail,pendingEmail:newEmail};
  }},findByEmail:async()=>null});
 assert.equal(result.status,202);assert.equal(result.pending,true);
 assert.equal(f.store.get(memberIdKey('stable-id')).email,oldEmail);
 const stage=f.store.get(changeKey('stable-id'));
 assert.equal(stage.newEmail,newEmail);
 await finishEmailChange(stage,{getJSON:f.read,setJSON:f.write});
 assert.equal(f.store.get(memberIdKey('stable-id')).email,newEmail);
 assert.equal(f.store.get(`schedules/${code}`),f.schedule);
 assert.equal(updates,1);
});

test('un cambio email ancora in attesa non può essere sostituito con un’altra destinazione',async()=>{
 const f=fixture(),second='other-new@example.it';
 f.store.set(changeKey('stable-id'),{userId:'stable-id',code,oldEmail,newEmail,status:'requested'});
 let calls=0;
 const result=await changeManagerLogin({code,membership:f.manager,newEmail:second,read:f.read,write:f.write,
  identityAdmin:{getUser:async()=>({id:'stable-id',email:oldEmail,pendingEmail:newEmail}),updateUser:async()=>{calls++}},findByEmail:async()=>null});
 assert.equal(result.status,409);assert.equal(calls,0);
 assert.equal(f.store.get(changeKey('stable-id')).newEmail,newEmail);
});

test('pannello mostra solo azioni non distruttive e richiede conferma esplicita per revoca',()=>{
 const ui=fs.readFileSync(new URL('../admin.html',import.meta.url),'utf8');
 const server=fs.readFileSync(new URL('../netlify/functions/platform-schools.js',import.meta.url),'utf8');
 for(const label of ['Copia codice','Reinvia email','Modifica email account','Revoca accredito','Accreditata','Accredito revocato','Riattiva accredito'])assert.ok(ui.includes(label));
 assert.ok(!ui.includes('Elimina definitivamente'));
 assert.ok(!server.includes("action==='delete-school'"));
 assert.match(server,/changeAccreditation\(/);
 assert.doesNotMatch(server,/deleteJSON\(`schedules/);
});

test('revoca e riattivazione cambiano solo lo stato scuola, non account o orari',async()=>{
 const f=fixture(),school=f.store.get(`schools/${code}`);
 const blocked=await changeAccreditation({school,code,action:'revoke-accreditation',write:f.write});
 assert.equal(blocked.status,400);assert.equal(f.store.get(`schools/${code}`).status,'active');
 const revoked=await changeAccreditation({school,code,action:'revoke-accreditation',confirmation:`REVOCA ACCREDITO ${code}`,write:f.write,now:()=> '2026-09-15T10:00:00Z'});
 assert.equal(revoked.status,200);assert.equal(f.store.get(`schools/${code}`).status,'revoked');
 assert.equal(f.store.get(memberIdKey('stable-id')).status,'active');
 assert.equal(f.store.get(`schedules/${code}`),f.schedule);
 const activated=await changeAccreditation({school:revoked.school,code,action:'reactivate',write:f.write});
 assert.equal(activated.school.status,'active');assert.equal(f.store.get(`schedules/${code}`),f.schedule);
});
