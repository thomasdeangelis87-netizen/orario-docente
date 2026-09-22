import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import '../school-permissions.js';
import '../school-update.js';
import {scheduleVersion} from '../netlify/functions/_schedule-version.js';
import {schoolScheduleKey} from '../netlify/functions/_lib.js';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const functionsPath=new URL('../netlify/functions/',import.meta.url);
const code=name=>fs.readFileSync(new URL(name,functionsPath),'utf8');

test('un docente normale non vede il portale, mentre admin e referente lo gestiscono',()=>{
 const {canManageSchool}=globalThis.OrarioSchoolPermissions;
 assert.equal(canManageSchool('teacher',true),false);
 assert.equal(canManageSchool('admin',true),true);
 assert.equal(canManageSchool('coordinator',true),true);
 assert.equal(canManageSchool('admin',false),true);
 assert.match(html,/id="schoolPortalView"/);
 assert.match(html,/id="schoolPortalNavBtn" data-view="schoolPortalView"/);
 assert.doesNotMatch(html,/id="schoolPortalBtn"/);
 assert.match(html,/if\(id==='schoolPortalView'&&!window\.OrarioSchoolPermissions\.canManageSchool/);
 assert.doesNotMatch(html,/schoolPortalBtn\.onclick=\(\)=>\{switchView\('schoolView'\)/);
 assert.match(code('_school_schedule_handler.js'),/requireMember\(user,req\.method==='POST'\?\['admin','coordinator'\]:\[\]\)/);
 assert.match(code('school-members.js'),/requireMember\(user,\['admin','coordinator'\]\)/);
});

test('cloud non cancella la copia locale della scuola in caso di 500 o risposta senza orario',()=>{
 assert.match(html,/schoolCloudError=msg/);
 assert.match(html,/if\(!schoolData\.entries\?\.length \|\| schoolData\.schoolCode/);
 assert.match(html,/Le copie locali non sono state cancellate/);
 assert.match(code('_school_schedule_handler.js'),/getOfficialSchedule\(code,deps\.getJSON\)/);
});

test('un dataset unico per scuola indipendente da amministratore, docente, browser e deploy',()=>{
 assert.equal(schoolScheduleKey('vais-32128'),'schedules/VAIS-32128');
 assert.equal(schoolScheduleKey('VAIS-32128'),'schedules/VAIS-32128');
 assert.doesNotMatch(schoolScheduleKey('VAIS-32128'),/email|user|guest|preview/);
 assert.match(code('_lib.js'),/getStore\('orario-docente-cloud'\)/);
 assert.match(code('_lib.js'),/\.get\(key,\{type:'json',consistency:'strong'\}\)/);
 assert.match(code('_lib.js'),/await import\('@netlify\/blobs'\)/);
 assert.match(code('_lib.js'),/\/\.netlify\/identity\/user/);
 assert.match(code('_lib.js'),/authorization:`Bearer \$\{token\}`/);
 assert.doesNotMatch(code('_lib.js'),/decodeJwt|JSON\.parse\([^)]*token/);
 assert.doesNotMatch(code('_lib.js'),/^import \{ getStore \} from '@netlify\/blobs'/m);
 assert.doesNotMatch(code('_lib.js'),/getDeployStore\(/);
 assert.match(code('_school_schedule_core.js'),/const previous=await getOfficialSchedule\(code,read\)/);
 assert.match(code('_school_schedule_core.js'),/const verified=await getOfficialSchedule\(code,read\)/);
 assert.match(code('school-storage-audit.js'),/getJSON\(schoolScheduleKey\(code\)\)/);
 assert.match(html,/if\(!schoolCloudVerified\)\{alert\('L’orario condiviso/);
 assert.match(html,/if\(!await loadSchoolCloud\(\)\)throw new Error\('Scrittura verificata/);
});

test('il selettore resta disponibile, ma un errore di lettura impedisce la scrittura',()=>{
 assert.match(html,/schoolUploadBtn\.onclick=async\(\)=>\{[^]*?schoolFile\.click\(\)/);
 assert.doesNotMatch(html,/if\(audit\.status==='present'&&!schoolCloudVerified\)throw new Error/);
 assert.match(html,/schoolAuditStatus='unknown';schoolCloudVerified=false/);
 assert.match(html,/if\(!savedToCloud\)schoolData=previous/);
 assert.match(code('_school_schedule_core.js'),/const previous=await getOfficialSchedule\(code,read\)/);
 assert.match(code('_school_schedule_core.js'),/if\(!publish&&!previous\)/);
 assert.equal(scheduleVersion({entries:[{}],version:3},true),4);
 assert.match(code('_school_schedule_handler.js'),/console\.info\('school-schedule request',\{requestId/);
 assert.match(code('_school_schedule_handler.js'),/console\.error\('school-schedule failure',\{requestId,stage/);
 assert.match(code('_school_schedule_handler.js'),/return json\(500,\{error:[^}]+requestId,stage\}\)/);
});

test('registrazione e accesso hanno due moduli distinti e non esiste pre-registrazione',()=>{
 assert.match(html,/id="signupForm"[^>]*>[\s\S]*?signupEmail[^>]*type="email"|id="signupEmail" type="email"/);
 assert.match(html,/id="loginForm"/);
 assert.match(html,/OrarioIdentity\.signup\(/);
 assert.match(html,/OrarioIdentity\.login\(/);
 assert.doesNotMatch(html,/registerProfileModal|onboardingModal|PendingRegistration/);
 assert.doesNotMatch(html,/identity\.netlify\.com\/v1\/netlify-identity-widget/);
 assert.doesNotMatch(html,/Continua con Google|id="googleBtn"|oauthLogin\(/);
});

test('aggiornamento scuola notifica solo lezioni diverse e non sostituisce automaticamente',()=>{
 const old=[{day:0,period:1,activity:'5° BE',subject:'Cucina',teacher:'ROSSI',time:'08:00 – 09:00'}];
 const unchanged=[{...old[0]}],changed=[{...old[0],activity:'DISPOSIZIONE'}];
 const changedCellText=[{...old[0],sourceLines:['CUCINA','BIANCHI R.','Lab. Cucina1']}];
 assert.equal(globalThis.OrarioSchoolUpdate.fingerprint(old),globalThis.OrarioSchoolUpdate.fingerprint(unchanged));
 assert.notEqual(globalThis.OrarioSchoolUpdate.fingerprint(old),globalThis.OrarioSchoolUpdate.fingerprint(changed));
 assert.notEqual(globalThis.OrarioSchoolUpdate.fingerprint(old),globalThis.OrarioSchoolUpdate.fingerprint(changedCellText));
 assert.equal(globalThis.OrarioSchoolUpdate.changes(old,changed).added.length,1);
 assert.match(html,/version<=Number\(state\.meta\.schoolScheduleVersion\)/);
 assert.match(html,/fingerprint===state\.meta\.schoolScheduleFingerprint/);
 assert.match(html,/updateMySchoolScheduleBtn\.onclick=applyPendingSchoolSchedule/);
 assert.match(html,/homeUpdateMySchoolScheduleBtn\.onclick=applyPendingSchoolSchedule/);
 assert.match(html,/confirm\(`Trovati \$\{entries\.length\} impegni/);
});

test('le compresenze strutturate della scuola arrivano nell’orario personale',()=>{
 assert.match(html,/Array\.isArray\(e\.coTeachers\)\?e\.coTeachers:\[\]/);
 assert.match(html,/👥 Compresenza:/);
 assert.match(html,/const missingTeachers=coTeachers\.filter/);
});

test('le righe originali della matrice arrivano senza reinterpretazione nell’orario personale',()=>{
 assert.match(html,/Array\.isArray\(e\.sourceLines\)\?e\.sourceLines:\[\]/);
 assert.match(html,/function lessonDetailLines\(info\)/);
 assert.match(html,/detailLines\.map\(line=>`<span class="materia">/);
 assert.match(html,/function lessonDetailSizeClass\(lines\)/);
 assert.match(html,/\.slot \.compresenza\.detail-xlong\{font-size:10px/);
 assert.match(html,/\.mobile-lesson-detail\.detail-xlong\{font-size:10px/);
 assert.match(html,/sourceLines:lesson\.sourceLines\|\|\[\]/);
});

test('le sole fasce orarie della scuola si sincronizzano automaticamente nel personale',()=>{
 assert.match(html,/school-hours-sync\.js\?v=16\.10\.19/);
 assert.match(html,/OrarioSchoolHoursSync\.apply\(state,schoolData\)/);
 assert.match(html,/Fasce orarie aggiornate dalla scuola/);
 assert.match(html,/id==='myScheduleView'&&state\.meta\.schoolCode\)loadSchoolCloud/);
});

test('la guida al collegamento è unica nella home e raggiungibile anche da Orario scuola',()=>{
 assert.match(html,/id="scheduleGuideBtn"[^>]*>❓ Guida al mio orario/);
 assert.match(html,/id="schoolConnectionGuideBtn"/);
 assert.doesNotMatch(html,/navConnectionGuideBtn|scheduleConnectionGuideBtn/);
 assert.match(html,/id="connectionGuideModal"/);
 assert.match(html,/Scegli l’istituto dall’elenco e premi “Collega scuola”: il collegamento è immediato/);
 assert.match(html,/Importa il mio orario dalla scuola/);
 assert.match(html,/Se il nome non viene riconosciuto automaticamente/);
 assert.match(html,/id="openSchoolFromGuideBtn"/);
 assert.match(html,/openSchoolFromGuideBtn\.onclick=.*switchView\('schoolView'\)/);
 assert.match(html,/scheduleGuideBtn\.onclick=openConnectionGuide/);
});

test('menu iniziale snello: nessun doppione profilo o portale e nuovo orario nella sua sezione',()=>{
 assert.equal((html.match(/id="schoolPortalNavBtn"/g)||[]).length,1);
 assert.doesNotMatch(html,/data-view="profileView"|id="profileView"/);
 assert.match(html,/id="moreTools"[\s\S]*id="shareBtn"[\s\S]*id="installAppBtn"[\s\S]*id="exportBtn"/);
 assert.match(html,/id="myScheduleView"[\s\S]{0,220}id="resetBtn"/);
 assert.match(html,/id="openEmailChangeBtn"/);
 assert.match(html,/apiCall\('account-email-change'/);
 assert.match(html,/OrarioIdentity\.updateUser\(\{email:next\}\)/);
});

test('la scelta dalla directory collega subito l account Identity alla scuola',()=>{
 assert.match(html,/id="schoolDirectorySearch"/);
 assert.match(html,/Hai ricevuto un codice dalla scuola\? Inserisci codice/);
 assert.match(code('school-directory.js'),/Invite codes must not be disclosed/);
 assert.match(code('school-link-request.js'),/assignedBy:'self-service-school-directory'/);
 assert.match(code('school-link-request.js'),/connected:true/);
 assert.match(code('school-link-request.js'),/connectSelectedSchool/);
 assert.match(code('school-members.js'),/body\.action==='approve-request'/);
 assert.match(code('school-members.js'),/body\.action==='reject-request'/);
 assert.match(html,/Collega scuola/);
 assert.match(html,/il collegamento è immediato/i);
 assert.match(html,/request\.status==='approved'[\s\S]*?loadSchoolCloud\(\{showError:true,saveProfile:true\}\)/);
 assert.match(html,/scheduleSchoolLinkPolling\(\)/);
 assert.match(html,/stopSchoolLinkPolling\(\)/);
 assert.match(html,/id="cancelSchoolLinkRequestBtn"/);
 assert.match(html,/id="disconnectSchoolBtn"/);
 assert.match(html,/apiCall\('leave-school'/);
 assert.match(html,/state\.slots=\{\}/);
 assert.match(html,/orario personale eliminato/);
 assert.match(code('school-link-request.js'),/body\.action==='cancel-request'/);
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
