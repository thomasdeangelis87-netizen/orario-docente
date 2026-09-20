import test from 'node:test';
import assert from 'node:assert/strict';
import {leaveSchool} from '../netlify/functions/leave-school.js';

const code='VAIS-32128',user={id:'teacher-1',email:'talerico@example.it'};

test('un docente può scollegarsi senza cancellare orario scuola o orario personale',async()=>{
 const membership={...user,userId:user.id,code,role:'teacher',status:'active'},schedule={version:7,entries:[{teacher:'TALERICO L.'}]};
 const request={userId:user.id,email:user.email,code,status:'approved'};
 const store=new Map([[`school-members/${code}`,[membership]],[`schedules/${code}`,schedule],[`link-requests-by-user/${encodeURIComponent(user.id)}`,request],[`school-link-requests/${code}`,[request]]]);
 let saved=null;
 const outcome=await leaveSchool(user,{read:async key=>store.get(key)||null,write:async(key,value)=>store.set(key,value),membershipFor:async()=>membership,saveMembership:async(email,value)=>{saved={email,value}},now:()=> '2026-09-20T12:00:00.000Z'});
 assert.equal(outcome.status,200);assert.equal(saved.value.status,'left');assert.equal(store.get(`school-members/${code}`)[0].status,'left');
 assert.equal(store.get(`link-requests-by-user/${encodeURIComponent(user.id)}`).status,'withdrawn');assert.equal(store.get(`schedules/${code}`),schedule);
});

test('amministratore e referente non possono lasciare la scuola con il comando docente',async()=>{
 for(const role of ['admin','coordinator']){const outcome=await leaveSchool(user,{membershipFor:async()=>({userId:user.id,email:user.email,code,role,status:'active'})});assert.equal(outcome.status,409)}
});
