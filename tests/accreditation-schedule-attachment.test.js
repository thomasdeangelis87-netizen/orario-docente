import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const schools=fs.readFileSync(new URL('../scuole.html',import.meta.url),'utf8');
const app=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const fn=fs.readFileSync(new URL('../netlify/functions/school-accreditation-schedule.js',import.meta.url),'utf8');

test('the accreditation upload is bound to its request and recoverable by the school portal',()=>{
  assert.match(schools,/registration\.request\.id/);
  assert.match(schools,/school-accreditation-schedule\?requestId=/);
  assert.match(fn,/request\.accountUserId!==user\.id/);
  assert.match(fn,/requireMember\(user,\['admin','coordinator'\]\)/);
  assert.match(fn,/accreditation-files\/\$\{accreditationId\}/);
  assert.match(app,/downloadAccreditationSchedule\(\)/);
  assert.match(app,/allegato durante l’accreditamento/);
});

