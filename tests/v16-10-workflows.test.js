import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import '../school-permissions.js';
import '../school-update.js';
import {scheduleVersion} from '../netlify/functions/_schedule-version.js';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const functionsPath=new URL('../netlify/functions/',import.meta.url);
const code=name=>fs.readFileSync(new URL(name,functionsPath),'utf8');

test('un docente normale non vede il portale, mentre admin e referente lo gestiscono',()=>{
 const {canManageSchool}=globalThis.OrarioSchoolPermissions;
 assert.equal(canManageSchool('teacher',true),false);
 assert.equal(canManageSchool('admin',true),true);
 assert.equal(canManageSchool('coordinator',true),true);
 assert.equal(canManageSchool('admin',false),true);
 assert.match(html,/schoolPortalBtn\.classList\.toggle\('hidden',!authorized\)/);
 assert.match(html,/id="schoolPortalView"/);
 assert.match(html,/schoolPortalBtn\.onclick=\(\)=>switchView\('schoolPortalView'\)/);
 assert.match(html,/id="schoolPortalNavBtn" data-view="schoolPortalView"/);
 assert.match(html,/if\(id==='schoolPortalView'&&!window\.OrarioSchoolPermissions\.canManageSchool/);
 assert.doesNotMatch(html,/schoolPortalBtn\.onclick=\(\)=>\{switchView\('schoolView'\)/);
 assert.match(code('save-school-schedule.js'),/requireMember\(user,\['admin','coordinator'\]\)/);
 assert.match(code('school-members.js'),/requireMember\(user,\['admin','coordinator'\]\)/);
});

test('cloud non cancella la copia locale della scuola in caso di 500 o risposta senza orario',()=>{
 assert.match(html,/schoolCloudError=msg/);
 assert.match(html,/if\(!schoolData\.entries\?\.length \|\| schoolData\.schoolCode/);
 assert.match(html,/Le copie locali non sono state cancellate/);
 assert.match(code('school-context.js'),/schedule=await getJSON\(`schedules\/\$\{r\.membership\.code\}`\)/);
});

test('registrazione e accesso hanno due moduli distinti e non esiste pre-registrazione',()=>{
 assert.match(html,/id="signupForm"[^>]*>[\s\S]*?signupEmail[^>]*type="email"|id="signupEmail" type="email"/);
 assert.match(html,/id="loginForm"/);
 assert.match(html,/OrarioIdentity\.signup\(/);
 assert.match(html,/OrarioIdentity\.login\(/);
 assert.doesNotMatch(html,/registerProfileModal|onboardingModal|PendingRegistration/);
 assert.doesNotMatch(html,/identity\.netlify\.com\/v1\/netlify-identity-widget/);
});

test('aggiornamento scuola notifica solo lezioni diverse e non sostituisce automaticamente',()=>{
 const old=[{day:0,period:1,activity:'5° BE',subject:'Cucina',teacher:'ROSSI',time:'08:00 – 09:00'}];
 const unchanged=[{...old[0]}],changed=[{...old[0],activity:'DISPOSIZIONE'}];
 assert.equal(globalThis.OrarioSchoolUpdate.fingerprint(old),globalThis.OrarioSchoolUpdate.fingerprint(unchanged));
 assert.notEqual(globalThis.OrarioSchoolUpdate.fingerprint(old),globalThis.OrarioSchoolUpdate.fingerprint(changed));
 assert.equal(globalThis.OrarioSchoolUpdate.changes(old,changed).added.length,1);
 assert.match(html,/version<=Number\(state\.meta\.schoolScheduleVersion\)/);
 assert.match(html,/fingerprint===state\.meta\.schoolScheduleFingerprint/);
 assert.match(html,/updateMySchoolScheduleBtn\.onclick=async/);
 assert.match(html,/confirm\(`Trovati \$\{entries\.length\} impegni/);
});

test('scuole directory non mostrano codice rapido; richieste sono approvate lato server',()=>{
 assert.match(html,/id="schoolDirectorySearch"/);
 assert.match(html,/Hai ricevuto un codice dalla scuola\? Inserisci codice/);
 assert.match(code('school-directory.js'),/Invite codes must not be disclosed/);
 assert.match(code('school-link-request.js'),/status:'pending'/);
 assert.match(code('school-members.js'),/body\.action==='approve-request'/);
 assert.match(code('school-members.js'),/body\.action==='reject-request'/);
  assert.equal(scheduleVersion(null,true),1);
  assert.equal(scheduleVersion({entries:[{}]},true),2);
  assert.equal(scheduleVersion({entries:[{}],version:5},false),5);
  assert.equal(scheduleVersion({entries:[{}],version:5},true),6);
});

test('UI conserva viste mobile e dispatcher import PDF Excel senza riscrivere i parser',()=>{
 assert.match(html,/data-mobile-schedule-mode="complete"/);
 assert.match(html,/data-mobile-schedule-mode="day"/);
 assert.match(html,/data-mobile-schedule-mode="week"/);
 assert.match(html,/schoolFile" type="file" accept="\.xlsx,\.xls,\.pdf"/);
 assert.match(html,/dispatchSchoolScheduleFile\(selectedFile\)/);
 assert.doesNotMatch(html,/id="areaSchoolBtn"|href="\/area-scuola\.html"/);
});
