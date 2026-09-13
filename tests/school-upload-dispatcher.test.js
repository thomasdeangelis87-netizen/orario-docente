import test from 'node:test';
import assert from 'node:assert/strict';
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
