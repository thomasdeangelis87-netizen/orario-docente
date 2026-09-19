import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import '../school-upload-dispatcher.js';
import '../schedule-file-type.js';

const {dispatchSchoolScheduleUpload}=globalThis.OrarioSchoolUploadDispatcher;
const {detectScheduleFileKind}=globalThis.OrarioScheduleFileType;

test('Carica orario completo invia esplicitamente un file .pdf solo al parser PDF',async()=>{
  const calls=[];
  const file={name:'Orario docenti in vigore dal 14-9-26.pdf',type:'application/pdf'};
  const result=await dispatchSchoolScheduleUpload(file,{
    pdf:async received=>{calls.push(['pdf',received.name]);return{importFormat:'pdf'}},
    excel:async received=>{calls.push(['excel',received.name]);throw new Error('Il parser Excel non deve essere chiamato')}
  },detectScheduleFileKind);
  assert.deepEqual(calls,[['pdf',file.name]]);
  assert.equal(result.importFormat,'pdf');
});

test('Carica orario completo invia xlsx e xls solo al parser Excel',async()=>{
  for(const name of ['orario.xlsx','orario.xls']){
    const calls=[];
    await dispatchSchoolScheduleUpload({name,type:''},{pdf:async()=>calls.push('pdf'),excel:async()=>calls.push('excel')},detectScheduleFileKind);
    assert.deepEqual(calls,['excel']);
  }
});

test('la Deploy Preview disattiva service worker e rende visibile la build',()=>{
  const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.match(html,/id="buildVersion"[^>]*>v16\.10\.12</);
  assert.match(html,/IS_DEPLOY_PREVIEW=\/\^deploy-preview-/);
  assert.match(html,/registration=>registration\.unregister\(\)/);
  assert.match(html,/caches\.delete\(key\)/);
  assert.match(html,/schoolFile\.onchange=async event=>/);
  assert.match(html,/schoolData=await dispatchSchoolScheduleFile\(selectedFile\)/);
});
