import test from 'node:test';
import assert from 'node:assert/strict';
import '../school-hours-sync.js';

const sync=globalThis.OrarioSchoolHoursSync;
const school={schoolCode:'VAIS-32128',version:4,maxPeriods:2,cloudUpdatedAt:'2026-09-20T08:00:00Z',periodTimes:{0:['08:10 – 09:00','09:00 – 09:50'],1:['08:00 – 08:50','08:50 – 09:40']},breaks:{0:[],1:[]}};

function linkedState(){return {meta:{schoolCode:'VAIS-32128',schoolTeacherName:'ROSSI MARIO',schoolScheduleVersion:3},slots:{'0-0':['1A','08:00 – 09:00',{room:'12'}],'1-1':['2B','09:00 – 10:00',{subjects:['Cucina']} ]}}}

test('aggiorna automaticamente solo le fasce del personale collegato',()=>{
 const state=linkedState(),before=JSON.parse(JSON.stringify(state));
 const result=sync.apply(state,school);
 assert.equal(result.timeChanged,true);
 assert.equal(state.slots['0-0'][1],'08:10 – 09:00');
 assert.equal(state.slots['1-1'][1],'08:50 – 09:40');
 assert.equal(state.slots['0-0'][0],before.slots['0-0'][0]);
 assert.deepEqual(state.slots['0-0'][2],before.slots['0-0'][2]);
 assert.equal(state.meta.schoolHoursUpdatedAt,school.cloudUpdatedAt);
});

test('la seconda sincronizzazione identica non modifica nuovamente il profilo',()=>{
 const state=linkedState();sync.apply(state,school);
 assert.deepEqual(sync.apply(state,school),{eligible:true,changed:false,timeChanged:false,fingerprint:sync.fingerprint(school)});
});

test('non modifica un orario personale non derivato dalla scuola',()=>{
 const state={meta:{schoolCode:'VAIS-32128'},slots:{'0-0':['1A','08:00 – 09:00']}};
 const result=sync.apply(state,school);
 assert.equal(result.eligible,false);assert.equal(state.slots['0-0'][1],'08:00 – 09:00');
});

test('non cancella un orario personale quando la scuola lascia vuota una fascia',()=>{
 const state=linkedState(),missing={...school,periodTimes:{0:[''],1:school.periodTimes[1]}};
 sync.apply(state,missing);
 assert.equal(state.slots['0-0'][1],'08:00 – 09:00');
});
