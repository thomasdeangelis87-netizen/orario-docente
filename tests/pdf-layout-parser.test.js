import test from 'node:test';
import assert from 'node:assert/strict';
import {parseIndexEducationPages} from '../pdf-layout-parser.js';

function item(str,x,y,width=40,height=10){return{str,x,y,width,height}}
function page(number,name,lessonText=''){const items=[item(name,220,35,120),...['Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato'].map((d,i)=>item(d,100+i*80,100,60)),item('08:00 – 09:00',20,145,70),item('09:00 – 10:00',20,205,70),item('10:00 – 11:00',20,265,70)];if(lessonText)items.push(item('3° A',105,130,30),item(lessonText,105,140,55),item('Aula 12',105,150,45),item('ROSSI MARIO',105,160,65));return{number,width:600,height:400,items}}

test('seleziona soltanto la pagina intestata al docente',()=>{const result=parseIndexEducationPages([page(1,'BIANCHI ANNA','Italiano'),page(2,'THOMAS DE ANGELIS','Pasticceria')],{firstName:'Thomas',lastName:'De Angelis',fullName:'Thomas De Angelis'},{maxPeriods:10});assert.equal(result.pageNumber,2);assert.equal(result.lessons[0].className,'3°A');assert.equal(result.lessons[0].room,'12');assert.match(result.lessons[0].subject,/Pasticceria/);assert.deepEqual(result.lessons[0].coTeachers,['ROSSI MARIO'])});

test('mantiene fasce pomeridiane e periodi oltre la sesta ora',()=>{const p=page(1,'THOMAS DE ANGELIS');p.items=p.items.filter(i=>!/^0[89]:|^10:/.test(i.str));for(let i=0;i<8;i++){const h=8+i;p.items.push(item(`${String(h).padStart(2,'0')}:00 – ${String(h+1).padStart(2,'0')}:00`,20,130+i*30,75))}p.items.push(item('5° B',185,340,30),item('Laboratorio',185,348,65));const result=parseIndexEducationPages([p],{fullName:'Thomas De Angelis',firstName:'Thomas',lastName:'De Angelis'},{maxPeriods:10});const lesson=result.lessons.find(l=>l.day===1);assert.equal(lesson.period,7);assert.equal(lesson.time,'15:00 – 16:00')});

test('non dipende dall ordine testuale degli elementi PDF',()=>{const p=page(1,'THOMAS DE ANGELIS','Pasticceria');p.items.reverse();const result=parseIndexEducationPages([p],{fullName:'Thomas De Angelis',firstName:'Thomas',lastName:'De Angelis'});assert.equal(result.lessons[0].day,0);assert.equal(result.lessons[0].period,0)});

test('espande una lezione graficamente alta su piu ore',()=>{const p=page(1,'THOMAS DE ANGELIS','Pasticceria');p.boxes=[{left:90,right:170,top:112,bottom:230}];const result=parseIndexEducationPages([p],{fullName:'Thomas De Angelis',firstName:'Thomas',lastName:'De Angelis'});assert.deepEqual(result.lessons.map(l=>l.period),[0,1])});
