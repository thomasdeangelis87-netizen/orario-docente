import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {makeSchoolScheduleHandler} from '../netlify/functions/_school_schedule_handler.js';
import {scheduleKey} from '../netlify/functions/_school_schedule_core.js';

const code='VAIS-32128';
const schedule={entries:[{teacher:'DOCENTE',day:0,period:1,activity:'5A'}],teachers:['DOCENTE'],classCells:[]};
function fixture(role='admin',initial=null){
  const docs=new Map();if(initial)docs.set(scheduleKey(code),initial);
  const reads=[],writes=[];
  const deps={currentUser:async()=>({email:'admin@example.test'}),requireMember:async(_user,roles)=>roles.length&&!roles.includes(role)?{error:new Response('Forbidden',{status:403})}:{membership:{code,role},school:{code,name:'Falcone',status:'active'}},getJSON:async key=>{reads.push(key);return docs.get(key)||null},setJSON:async(key,value)=>{writes.push(key);docs.set(key,value)}};
  return {handler:makeSchoolScheduleHandler(deps),docs,reads,writes};
}

test('GET admin e docente usano esattamente lo stesso documento site-scoped',async()=>{
  const old={...schedule,version:1}; // v16.9 did not require schoolCode.
  for(const role of ['admin','teacher']){
    const f=fixture(role,old);
    const response=await f.handler(new Request('https://preview.test/.netlify/functions/school-schedule'),{requestId:'test',deploy:{context:'deploy-preview'}});
    assert.equal(response.status,200);
    assert.deepEqual((await response.json()).schedule,old);
    assert.deepEqual(f.reads,[scheduleKey(code)]);
  }
});

test('solo admin pubblica e il documento rimane dopo una nuova sessione/browser',async()=>{
  const f=fixture('admin',{...schedule,version:1});
  const request=new Request('https://preview.test/.netlify/functions/school-schedule',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({schedule,publish:true,validFrom:'2026-09-14'})});
  const result=await f.handler(request,{requestId:'test'});
  assert.equal(result.status,200);
  assert.equal((await result.json()).version,2);
  assert.deepEqual(f.writes,[scheduleKey(code)]);
  const teacher=fixture('teacher',f.docs.get(scheduleKey(code)));
  const read=await teacher.handler(new Request('https://preview.test/.netlify/functions/school-schedule'));
  assert.equal((await read.json()).schedule.version,2);
  const forbidden=fixture('teacher',schedule);
  const denied=await forbidden.handler(new Request('https://preview.test/.netlify/functions/school-schedule',{method:'POST',body:JSON.stringify({schedule,publish:true})}));
  assert.equal(denied.status,403);assert.equal(forbidden.writes.length,0);
});

test('se la lettura pre-pubblicazione fallisce, il dato preesistente non viene toccato',async()=>{
  const f=fixture('admin',{...schedule,version:7});
  f.handler=makeSchoolScheduleHandler({currentUser:async()=>({email:'admin@example.test'}),requireMember:async()=>({membership:{code,role:'admin'},school:{code}}),getJSON:async()=>{throw new Error('Blob service unavailable')},setJSON:async()=>{throw new Error('Must never write')}});
  const result=await f.handler(new Request('https://preview.test/.netlify/functions/school-schedule',{method:'POST',body:JSON.stringify({schedule,publish:true})}),{requestId:'req-123',deploy:{context:'deploy-preview'}});
  assert.equal(result.status,500);
  const error=await result.json();assert.equal(error.stage,'storage-publish');assert.equal(error.requestId,'req-123');
  assert.equal(f.docs.get(scheduleKey(code)).version,7);
});

test('la lettura Blob forte è una opzione di get, non di getStore',()=>{
  const source=readFileSync(new URL('../netlify/functions/_lib.js',import.meta.url),'utf8');
  assert.match(source,/getStore\('orario-docente-cloud'\)/);
  assert.match(source,/\.get\(key,\{type:'json',consistency:'strong'\}\)/);
  const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.match(index,/apiCall\('school-schedule'\)/);
  assert.match(index,/schoolUploadBtn\.onclick=async\(\)=>\{[^]*?schoolFile\.click\(\);/);
  assert.doesNotMatch(index,/schoolUploadBtn\.onclick=async\(\)=>\{[^]*?auditSchoolStorage\(\)[^]*?schoolFile\.click\(\)/);
});
