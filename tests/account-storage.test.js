import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import '../account-storage.js';

const {personalStorageKey}=globalThis.OrarioAccountStorage;

test('isola la copia locale personale per id account',()=>{
  assert.equal(personalStorageKey({id:'teacher-1',email:'same@example.it'}),'orarioDocenteStateV6:teacher-1');
  assert.equal(personalStorageKey({id:'school-admin',email:'same@example.it'}),'orarioDocenteStateV6:school-admin');
  assert.notEqual(personalStorageKey({id:'teacher-1'}),personalStorageKey({id:'school-admin'}));
});

test('non usa email riciclata o chiavi guest per salvare dati personali',()=>{
  assert.equal(personalStorageKey({email:' Michelangelo.Raiola@Example.it '}),'');
  assert.equal(personalStorageKey(null),'');
});

test('azzera anteprima personale a ogni cambio account e apertura importazione',()=>{
  const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.match(html,/async function handleUser\(user\)\{\s*resetImportUi\(\)/);
  assert.match(html,/importBtn\.onclick=\(\)=>\{resetImportUi\(\);openModal\('importModal'\)\}/);
  assert.match(html,/logoutBtn\.onclick=async\(\)=>\{resetImportUi\(\);try\{await window\.OrarioIdentity\.logout\(\)/);
});
