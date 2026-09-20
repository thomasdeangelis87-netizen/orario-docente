import test from 'node:test';
import assert from 'node:assert/strict';
import {clearDepartingTeacherProfile,leaveSchool} from '../netlify/functions/leave-school.js';

const code='VAIS-32128',user={id:'teacher-1',email:'talerico@example.it'};

test('un docente può scollegarsi senza cancellare l’orario ufficiale della scuola',async()=>{
 const membership={...user,userId:user.id,code,role:'teacher',status:'active'},schedule={version:7,entries:[{teacher:'TALERICO L.'}]};
 const request={userId:user.id,email:user.email,code,status:'approved'};
 const profile={state:{meta:{firstName:'Luigi',school:'Pietro Verri',schoolCode:code,schoolRole:'teacher',schoolTeacherName:'TALERICO L.',schoolScheduleVersion:7,periodTimes:['08:00 – 09:00'],maxPeriods:8,validFrom:'20/09/2026',validFromSource:'school'},slots:{'0-0':['2AB','08:00 – 09:00']}}};
 const store=new Map([[`school-members/${code}`,[membership]],[`schedules/${code}`,schedule],[`profiles-by-user/${encodeURIComponent(user.id)}`,profile],[`link-requests-by-user/${encodeURIComponent(user.id)}`,request],[`school-link-requests/${code}`,[request]]]);
 let saved=null;
 const outcome=await leaveSchool(user,{read:async key=>store.get(key)||null,write:async(key,value)=>store.set(key,value),membershipFor:async()=>membership,saveMembership:async(email,value)=>{saved={email,value}},now:()=> '2026-09-20T12:00:00.000Z'});
 assert.equal(outcome.status,200);assert.equal(saved.value.status,'left');assert.equal(store.get(`school-members/${code}`)[0].status,'left');
 assert.equal(store.get(`link-requests-by-user/${encodeURIComponent(user.id)}`).status,'withdrawn');assert.equal(store.get(`schedules/${code}`),schedule);
 const cleared=store.get(`profiles-by-user/${encodeURIComponent(user.id)}`).state;
 assert.deepEqual(cleared.slots,{});assert.equal(cleared.meta.school,'');assert.equal(cleared.meta.schoolCode,'');assert.equal(cleared.meta.maxPeriods,6);assert.equal(cleared.meta.periodTimes,undefined);assert.equal(cleared.meta.validFrom,'');assert.equal(cleared.meta.firstName,'Luigi');
});

test('la pulizia del profilo conserva i dati anagrafici e non modifica profili non validi',()=>{
 const profile={state:{meta:{firstName:'Luigi',lastName:'Talerico',teaching:'Sala',subject:'B020',school:'Verri',schoolCode:code,schoolRole:'teacher',validFrom:'01/09/2026'},slots:{'0-0':['2AB','08:00 – 09:00']}}};
 const cleared=clearDepartingTeacherProfile(profile);
 assert.equal(cleared.state.meta.firstName,'Luigi');assert.equal(cleared.state.meta.lastName,'Talerico');assert.equal(cleared.state.meta.teaching,'Sala');assert.equal(cleared.state.meta.subject,'B020');assert.deepEqual(cleared.state.slots,{});
 assert.equal(clearDepartingTeacherProfile(null),null);
});

test('amministratore e referente non possono lasciare la scuola con il comando docente',async()=>{
 for(const role of ['admin','coordinator']){const outcome=await leaveSchool(user,{membershipFor:async()=>({userId:user.id,email:user.email,code,role,status:'active'})});assert.equal(outcome.status,409)}
});
