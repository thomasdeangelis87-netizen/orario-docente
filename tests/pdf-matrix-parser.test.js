import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseTeacherMatrixSchoolPages} from '../pdf-layout-parser.js';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');

const item=(str,x,y,width=18,height=8)=>({str,x,y,width,height});

test('parses a teacher-row PDF matrix without using the Index Education parser',()=>{
  const items=[item('Docente',18,45,30),...['Lunedi','Martedi','Mercoledi','Giovedi','Venerdi'].map((d,i)=>item(d,95+i*100,45,30))];
  for(let i=0;i<10;i++)items.push(item(`${i%2+1}ª`,90+i*50,58,8));
  items.push(item('ROSSI M.',18,100,42),item('ITALIANO',84,96,35),item('1AA',91,106,15),item('DISP.',134,96,24));
  items.push(item('BIANCHI L.',18,145,48),item('MATEMATICA',184,141,43),item('2BX',191,151,16));
  const result=parseTeacherMatrixSchoolPages([{number:1,width:600,height:240,boxes:[],items}],{maxPeriods:10});
  assert.equal(result.matrixFormat,true);
  assert.equal(result.teachers.length,2);
  assert.deepEqual(result.entries.map(e=>[e.teacher,e.day,e.period,e.activity]),[
    ['ROSSI M.',0,1,'1AA'],['ROSSI M.',0,2,'DISPOSIZIONE'],['BIANCHI L.',1,1,'2BX']
  ]);
  assert.equal(result.classCells.length,2);
});

test('espande un blocco orizzontale su tutte le ore coperte dalle linee della matrice',()=>{
  assert.match(html,/pdfjsLib\.OPS\.lineTo/);
  assert.match(html,/lines:pathLines/);
  const items=[item('Docente',18,45,30),...['Lunedi','Martedi','Mercoledi','Giovedi','Venerdi'].map((d,i)=>item(d,150+i*250,45,40))];
  const centers=[];for(let day=0;day<5;day++)for(let period=0;period<5;period++){const x=90+day*250+period*40;centers.push(x);items.push(item(`${period+1}ª`,x-4,58,8))}
  items.push(item('TALERICO L.',18,100,45),item('SALA+CUC.',126,88,45),item('DE ROSA R.',128,96,42),item('2AB',132,104,18),item('Lab. Cucina1',125,112,50),item('Lab. A.',128,120,30));
  items.push(item('DE ROSA R.',18,160,45));
  items.push(item('SALA+.',204,92,30),item('MART.',208,100,28),item('1AB',212,108,18));
  items.push(item('SC. IN.',244,92,30),item('CAPPI.',248,100,28),item('1AB',252,108,18));
  const lines=[];const top=70,bottom=130;
  for(let day=0;day<5;day++)for(let edge=0;edge<=5;edge++){if(day===0&&(edge===1||edge===2))continue;const x=70+day*250+edge*40;lines.push({x1:x,y1:top,x2:x,y2:bottom})}
  const result=parseTeacherMatrixSchoolPages([{number:1,width:1400,height:240,boxes:[],lines,items}],{maxPeriods:10});
  assert.deepEqual(result.entries.filter(e=>e.teacher==='TALERICO L.').map(e=>[e.day,e.period,e.activity]),[
    [0,1,'2AB'],[0,2,'2AB'],[0,3,'2AB'],[0,4,'1AB'],[0,5,'1AB']
  ]);
  const together=result.entries.filter(e=>e.teacher==='TALERICO L.'&&e.activity==='2AB');
  assert.ok(together.every(e=>e.coTeachers.length===1&&e.coTeachers[0]==='DE ROSA R.'));
  assert.ok(together.every(e=>!e.subject.includes('DE ROSA')));
  assert.ok(together.every(e=>e.subject.includes('Lab. A.')));
  together.forEach(e=>assert.deepEqual(e.sourceLines,['SALA+CUC.','DE ROSA R.','Lab. Cucina1','Lab. A.']));
  assert.deepEqual(result.entries.find(e=>e.teacher==='TALERICO L.'&&e.period===4).sourceLines,['SALA+.','MART.']);
  assert.deepEqual(result.entries.find(e=>e.teacher==='TALERICO L.'&&e.period===5).sourceLines,['SC. IN.','CAPPI.']);
});
