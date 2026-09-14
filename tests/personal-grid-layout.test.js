import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');

test('il testo delle celle personali resta contenuto nella propria colonna',()=>{
  assert.match(html,/\.slot \.subject\{[^}]*overflow-wrap:anywhere;[^}]*word-break:break-word;[^}]*white-space:normal/);
  assert.match(html,/\.slot>div\{[^}]*max-width:100%;[^}]*overflow:hidden/);
  assert.match(html,/\.cell\{[^}]*min-width:0;[^}]*overflow:hidden/);
});

test('attivita lunghe ricevono automaticamente font piu piccolo',()=>{
  assert.match(html,/function subjectSizeClass\(value\)/);
  assert.match(html,/length>=11\?'subject-long'/);
  assert.match(html,/subject \$\{subjectSizeClass\(v\[0\]\)\}/);
  assert.match(html,/\.subject\.subject-long\{font-size:clamp\(13px,1vw,14px\)\}/);
  assert.match(html,/\.subject\.subject-xlong\{font-size:clamp\(12px,\.92vw,13px\)\}/);
});

test('orario separato e leggibile anche su mobile',()=>{
  assert.match(html,/\.slot \.time\{font-size:15px;[^}]*white-space:nowrap/);
  assert.match(html,/@media\(max-width:720px\)[^{]*\{[\s\S]*?\.slot \.subject\{font-size:14px\}[\s\S]*?\.slot \.time\{font-size:13px\}/);
});

test('su smartphone completo e giorno usano schede verticali senza scroll orizzontale',()=>{
  assert.match(html,/data-mobile-schedule-mode="complete">COMPLETO/);
  assert.match(html,/data-mobile-schedule-mode="day">GIORNO/);
  assert.match(html,/data-mobile-schedule-mode="week">SETTIMANA/);
  assert.match(html,/\.mobile-timetable\{[^}]*overflow-x:hidden/);
  assert.match(html,/\.mobile-lesson\{[^}]*grid-template-columns:minmax\(82px,96px\) minmax\(0,1fr\)/);
  assert.match(html,/\.mobile-lesson-content\{[^}]*overflow-wrap:anywhere;[^}]*word-break:break-word;[^}]*white-space:normal/);
});

test('la vista giorno sceglie oggi o il prossimo giorno con lezioni',()=>{
  assert.match(html,/function defaultPersonalMobileDay\(\)/);
  assert.match(html,/new Date\(\)\.getDay\(\)/);
  assert.match(html,/if\(day<6&&personalDayHasLessons\(day\)\)return day/);
  assert.match(html,/mobileDaySelect\.onchange/);
});

test('completo omette le ore libere ma conserva tutti i giorni',()=>{
  assert.match(html,/DAYS\.map\(\(_,day\)=>mobileDayCardHtml\(day\)\)/);
  assert.match(html,/if\(value&&value\[0\]\)lessons\+=mobileLessonHtml/);
  assert.match(html,/Nessuna lezione/);
});
