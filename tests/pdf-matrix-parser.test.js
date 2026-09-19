import test from 'node:test';
import assert from 'node:assert/strict';
import {parseTeacherMatrixSchoolPages} from '../pdf-layout-parser.js';

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

