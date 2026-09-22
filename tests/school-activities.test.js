import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {normalizeActivity,profileClassNames,visibleTo,sortActivities} from '../netlify/functions/_school_activities.js';

const base={title:'Collegio docenti',date:'2026-10-01',startTime:'14:30',endTime:'16:30',audienceType:'all'};

test('normalizza e convalida un impegno',()=>{
  const item=normalizeActivity(base,null,{id:'admin-1'});
  assert.equal(item.title,'Collegio docenti');
  assert.equal(item.createdBy,'admin-1');
  assert.throws(()=>normalizeActivity({...base,endTime:'13:00'}),/successivo/);
  assert.throws(()=>normalizeActivity({...base,audienceType:'teachers'}),/docente/);
});

test('filtra destinatari individuali e classi senza esporli agli altri',()=>{
  const everyone=normalizeActivity(base);
  const teachers=normalizeActivity({...base,audienceType:'teachers',teacherIds:['u1']});
  const classes=normalizeActivity({...base,audienceType:'classes',classNames:['2° B']});
  assert.equal(visibleTo(everyone,{role:'teacher',userId:'u2'},[]),true);
  assert.equal(visibleTo(teachers,{role:'teacher',userId:'u1'},[]),true);
  assert.equal(visibleTo(teachers,{role:'teacher',userId:'u2'},[]),false);
  assert.equal(visibleTo(classes,{role:'teacher',userId:'u2'},['2 B']),true);
  assert.equal(visibleTo(classes,{role:'teacher',userId:'u2'},['5° BE']),false);
  assert.equal(visibleTo(classes,{role:'coordinator',userId:'u3'},[]),true);
});

test('legge le classi dal profilo e ordina cronologicamente',()=>{
  assert.deepEqual(profileClassNames({state:{slots:{a:['2° B','08:00'],b:['5° BE','09:00'],c:['2° B','10:00']}}}),['2° B','5° BE']);
  const items=sortActivities([{title:'B',date:'2026-10-02',startTime:'09:00'},{title:'A',date:'2026-10-01',startTime:'15:00'}]);
  assert.equal(items[0].title,'A');
});

test('la UI espone prossimo impegno, calendario e gestione scuola',()=>{
  const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.match(html,/id="nextActivityCard"/);
  assert.match(html,/data-activity-mode="day"/);
  assert.match(html,/data-activity-mode="week"/);
  assert.match(html,/data-activity-mode="month"/);
  assert.match(html,/id="schoolActivitiesAdmin"/);
  assert.match(html,/audienceType:'all'|activityAudienceInput\.value/);
});
