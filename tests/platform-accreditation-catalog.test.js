import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {accreditedCatalog,requestedSchoolCode} from '../netlify/functions/_accredited_catalog.js';

const CODE='VAIS-32128';
const approval={id:'legacy-falcone',status:'approved',schoolCode:CODE,
  schoolName:'Istituto professionale Giovanni Falcone di Gallarate',mechanicalCode:'VAIS32128',
  accountEmail:'amministratore@example.it',accountUserId:'falcone-admin',
  approvedAt:'2026-09-14T12:00:00Z'};
test('GET platform-schools senza parametro code non cerca la scuola inesistente NULL',()=>{
 assert.equal(requestedSchoolCode('https://preview.example.it/.netlify/functions/platform-schools'),'');
 assert.equal(requestedSchoolCode('https://preview.example.it/.netlify/functions/platform-schools?code=VAIS-32128'),CODE);
});
function storage({school,schoolMembers}={}){
 const schedule={schoolCode:CODE,version:3,entries:[{teacher:'Raiola'}],teachers:['Raiola']};
 const data=new Map([['accreditations-index',[approval.id]],
  [`accreditations/${approval.id}`,approval],[`schedules/${CODE}`,schedule]]);
 if(school)data.set(`schools/${CODE}`,school);
 if(schoolMembers)data.set(`school-members/${CODE}`,schoolMembers);
 return {schedule,data,read:async key=>data.get(key)||null,write:async(key,value)=>data.set(key,value),
  list:async prefix=>[...data.keys()].filter(key=>key.startsWith(prefix))};
}

test('una scuola legacy con orario o membri viene resa recuperabile anche fuori dagli indici',async()=>{
 const code='ANCE-48291',data=new Map([
  [`schedules/${code}`,{schoolCode:code,schoolName:'Istituto Omnicomprensivo Ancel Keys',version:2,entries:[]}],
  [`school-members/${code}`,[{userId:'teacher-id',email:'teacher@example.it',code,role:'teacher',status:'active'}]]
 ]);
 const read=async key=>data.get(key)||null,list=async prefix=>[...data.keys()].filter(key=>key.startsWith(prefix));
 const schools=await accreditedCatalog({read,list});
 assert.equal(schools.length,1);
 assert.equal(schools[0].school.code,code);
 assert.equal(schools[0].school.name,'Istituto Omnicomprensivo Ancel Keys');
 assert.equal(schools[0].school.status,'legacy');
 assert.equal(schools[0].recoveryNeeded,true);
 assert.equal(schools[0].hasSchedule,true);
 assert.equal(schools[0].members[0].userId,'teacher-id');
});

test('Falcone approvato VAIS-32128 compare nel catalogo anche se schools-index è mancante',async()=>{
 const s=storage({school:{code:CODE,name:approval.schoolName,status:'active',mechanicalCode:'VAIS32128'}});
 const schools=await accreditedCatalog({read:s.read});
 assert.equal(schools.length,1);
 assert.equal(schools[0].school.code,CODE);
 assert.equal(schools[0].school.status,'active');
 assert.equal(schools[0].administrativeEmail,approval.accountEmail);
 assert.equal(schools[0].school.mechanicalCode,'VAIS32128');
 assert.equal(s.data.get(`schedules/${CODE}`),s.schedule);
});

test('storico approvato proiettato senza scrivere sul GET; migrazione crea solo documento scuola mancante',async()=>{
 const s=storage();
 assert.equal((await accreditedCatalog({read:s.read},CODE))[0].school.name,approval.schoolName);
 assert.equal(s.data.has(`schools/${CODE}`),false);
 const projected=await accreditedCatalog({read:s.read,write:s.write},CODE);
 assert.equal(projected[0].school.code,CODE);
 assert.equal(s.data.get(`schools/${CODE}`).accreditationId,approval.id);
 assert.equal(s.data.get(`school-members/${CODE}`)[0].userId,'falcone-admin');
 assert.equal(s.data.get(`schedules/${CODE}`),s.schedule);
});

test('revoca preesistente rimane autorevole, approvazione storica non la riattiva',async()=>{
 const revoked={code:CODE,name:approval.schoolName,status:'revoked'};
 const s=storage({school:revoked});
 const items=await accreditedCatalog({read:s.read,write:s.write});
 assert.equal(items[0].school.status,'revoked');
 assert.equal(s.data.get(`schools/${CODE}`),revoked);
 assert.equal(s.data.get(`schedules/${CODE}`),s.schedule);
});

test('rendering effettivo admin.html mostra Falcone solo tra accreditate con quattro azioni',async()=>{
 const html=fs.readFileSync(new URL('../admin.html',import.meta.url),'utf8');
 const script=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
 const elements=new Map(),element=id=>{
  if(!elements.has(id))elements.set(id,{innerHTML:'',textContent:'',value:'',classList:{add(){},remove(){}},querySelectorAll(){return []}});
  return elements.get(id);
 };
 const schools=await accreditedCatalog({read:storage().read});
 const ctx=vm.createContext({document:{getElementById:element},navigator:{clipboard:{}},
  fetch:async url=>({ok:true,text:async()=>JSON.stringify(url.endsWith('platform-schools')?{schools}:{items:[approval,{id:'new-request',status:'pending',schoolName:'Scuola nuova',createdAt:'2026-09-15'}]})}),
  console});
 new vm.Script(script,{filename:'admin.html'}).runInContext(ctx);
 await vm.runInContext('schoolsRefresh()',ctx);
 await vm.runInContext('refresh()',ctx);
 const accredited=element('accreditedSchools').innerHTML,requests=element('requests').innerHTML;
 assert.match(accredited,/data-school-code="VAIS-32128"/);
 assert.match(accredited,/Istituto professionale Giovanni Falcone/);
 for(const action of ['Copia codice','Reinvia email','Modifica email account','Revoca accredito'])assert.ok(accredited.includes(action));
 assert.doesNotMatch(requests,/Falcone|APPROVATA|VAIS-32128/);
 assert.match(requests,/Scuola nuova|IN ATTESA|Rifiuta richiesta/);
});

test('admin offre creazione manuale e recupero sullo stesso codice senza cancellazioni',()=>{
 const html=fs.readFileSync(new URL('../admin.html',import.meta.url),'utf8');
 const server=fs.readFileSync(new URL('../netlify/functions/platform-admin-school.js',import.meta.url),'utf8');
 assert.match(html,/Nuovo accredito \/ recupero scuola/);
 assert.match(html,/id="existingCode"/);
 assert.match(html,/Recupera accredito/);
 assert.match(server,/previousSchedule=await getJSON\(`schedules\/\$\{code\}`\)/);
 assert.match(server,/previousMembers=await getJSON\(`school-members\/\$\{code\}`\)/);
 assert.doesNotMatch(server,/deleteJSON|\.delete\(/);
});
