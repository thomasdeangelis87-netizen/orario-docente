import test from 'node:test';
import assert from 'node:assert/strict';
import '../schedule-file-type.js';

const {detectScheduleFileKind}=globalThis.OrarioScheduleFileType;

test('riconosce il PDF reale per estensione',async()=>{
  const file={name:'Orario docenti in vigore dal 14-9-26.pdf',type:'',slice:()=>new Blob([])};
  assert.equal(await detectScheduleFileKind(file),'pdf');
});

test('riconosce un PDF anche dal MIME type o dalla firma del file',async()=>{
  assert.equal(await detectScheduleFileKind({name:'orario',type:'application/pdf'}),'pdf');
  const blob=new Blob(['%PDF-1.7 contenuto']);blob.name='orario-senza-estensione';
  assert.equal(await detectScheduleFileKind(blob),'pdf');
});

test('mantiene il percorso Excel per xlsx e xls',async()=>{
  assert.equal(await detectScheduleFileKind({name:'scuola.xlsx',type:''}),'excel');
  assert.equal(await detectScheduleFileKind({name:'scuola.xls',type:'application/vnd.ms-excel'}),'excel');
});
