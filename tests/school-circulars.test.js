import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {normalizeCircular,sortCirculars} from '../netlify/functions/_school_circulars.js';

const base={title:'Convocazione collegio',publishedDate:'2026-09-22',audienceType:'all'};

test('normalizza circolare, destinatari e collegamento al calendario',()=>{
  const item=normalizeCircular({...base,number:'42/2026',externalUrl:'https://scuola.example/circolare',calendarEnabled:true,calendarDate:'2026-10-01',calendarStart:'14:30',calendarEnd:'16:30'},null,{id:'admin-1'});
  assert.equal(item.number,'42/2026');
  assert.equal(item.calendarEnabled,true);
  assert.equal(item.createdBy,'admin-1');
  assert.throws(()=>normalizeCircular({...base,audienceType:'teachers'}),/docente/);
  assert.throws(()=>normalizeCircular({...base,externalUrl:'javascript:alert(1)'}),/link/);
  assert.throws(()=>normalizeCircular({...base,calendarEnabled:true}),/data dell’impegno/);
});

test('ordina le circolari dalla più recente',()=>{
  const items=sortCirculars([{title:'Vecchia',publishedDate:'2026-09-01'},{title:'Nuova',publishedDate:'2026-09-20'}]);
  assert.equal(items[0].title,'Nuova');
});

test('UI e Functions supportano PDF, Word, link e download protetto',()=>{
  const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const api=fs.readFileSync(new URL('../netlify/functions/school-circulars.js',import.meta.url),'utf8');
  const download=fs.readFileSync(new URL('../netlify/functions/school-circular-file.js',import.meta.url),'utf8');
  assert.match(html,/id="circularsView"/);
  assert.match(html,/accept="\.pdf,\.doc,\.docx/);
  assert.match(html,/Inserisci anche una scadenza o un impegno/);
  assert.match(api,/Solo amministratori e referenti/);
  assert.match(api,/4\*1024\*1024/);
  assert.match(download,/visibleTo\(circular/);
  assert.match(download,/cache-control':'private, no-store'/);
});
