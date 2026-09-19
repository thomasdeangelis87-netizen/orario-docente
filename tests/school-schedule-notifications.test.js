import test from 'node:test';
import assert from 'node:assert/strict';
import {notifyChangedTeachers,scheduleFingerprint,schoolScheduleNotificationKeys} from '../netlify/functions/_school_schedule_notifications.js';

const code='VAIS-32128';
const oldEntries=[{teacher:'ROSSI MARIO',day:0,period:1,activity:'1A',subject:'ITALIANO',time:'08:00'}];
const newEntries=[{teacher:'ROSSI MARIO',day:0,period:2,activity:'2A',subject:'ITALIANO',time:'09:00'}];

function fixture({entries=newEntries,fingerprint=scheduleFingerprint(oldEntries),version=2}={}){
  const docs=new Map([
    [`school-members/${code}`,[{userId:'teacher-1',email:'rossi@example.test',status:'active',role:'teacher'}]],
    [schoolScheduleNotificationKeys.profileKey('teacher-1'),{fullName:'Mario Rossi',state:{meta:{firstName:'Mario',schoolTeacherName:'ROSSI MARIO',schoolScheduleVersion:1,schoolScheduleFingerprint:fingerprint,schoolScheduleEntries:oldEntries}}}]
  ]);
  const sent=[];
  return {docs,sent,run:()=>notifyChangedTeachers({code,school:{name:'Falcone'},schedule:{version,validFrom:'2026-09-21',entries},read:async key=>docs.get(key)||null,write:async(key,value)=>docs.set(key,value),send:async message=>sent.push(message),now:()=> '2026-09-19T10:00:00.000Z'})};
}

test('invia una sola email quando il nuovo orario del docente è realmente cambiato',async()=>{
  const f=fixture();
  const first=await f.run();
  assert.deepEqual(first,{eligible:1,sent:1,failed:0,skipped:0});
  assert.equal(f.sent.length,1);
  assert.equal(f.sent[0].to,'rossi@example.test');
  assert.equal(f.sent[0].schoolName,'Falcone');
  const second=await f.run();
  assert.equal(second.sent,0);
  assert.equal(second.skipped,1);
  assert.equal(f.sent.length,1);
});

test('non invia email quando gli impegni del docente sono invariati',async()=>{
  const f=fixture({entries:oldEntries});
  const result=await f.run();
  assert.equal(result.sent,0);
  assert.equal(result.eligible,0);
  assert.equal(f.sent.length,0);
});

test('un errore Brevo viene registrato ma non fa fallire il dispatcher',async()=>{
  const f=fixture();
  const result=await notifyChangedTeachers({code,school:{name:'Falcone'},schedule:{version:2,entries:newEntries},read:async key=>f.docs.get(key)||null,write:async(key,value)=>f.docs.set(key,value),send:async()=>{throw new Error('provider unavailable')}});
  assert.equal(result.failed,1);
  assert.equal(result.sent,0);
  assert.equal(f.docs.has(schoolScheduleNotificationKeys.markerKey(code,2,'teacher-1')),false);
});

test('l’avviso principale offre confronto e aggiornamento esplicito senza sostituzione automatica',async()=>{
  const html=(await import('node:fs')).readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.match(html,/id="homeSchoolUpdateNotice"[^>]*school-change-prominent/);
  assert.match(html,/id="homeSeeSchoolChangesBtn">Vedi modifiche/);
  assert.match(html,/id="homeUpdateMySchoolScheduleBtn">Aggiorna il mio orario/);
  assert.match(html,/non verrà sostituito finché non confermi/);
});
