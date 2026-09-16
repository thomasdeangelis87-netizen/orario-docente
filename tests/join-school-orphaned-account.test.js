import test from 'node:test';
import assert from 'node:assert/strict';
import {checkPreviousOwners,inspectPreviousOwners,replaceOrphanedEmailRows} from '../netlify/functions/_join_school_core.js';

const email='docente@example.it',newId='new-identity',oldId='deleted-identity';
const obsolete={userId:oldId,email,code:'VAIS-32128',role:'admin',status:'active'};
const incoming={userId:newId,email,code:'VAIS-32128',role:'teacher',status:'active'};

test('Identity eliminata: collegamento per codice associa il nuovo ID come docente e preserva altre utenze',async()=>{
 let lookups=0;
 const list=[obsolete,{userId:'another',email:'another@example.it',status:'active'}];
 const ok=await checkPreviousOwners({email,currentId:newId,invitation:obsolete,list,
  getIdentityUser:async id=>{assert.equal(id,oldId);lookups++;throw {status:404}}});
 assert.equal(ok,true);assert.equal(lookups,1);
 const updated=replaceOrphanedEmailRows(list,email,incoming);
 assert.equal(updated.length,2);assert.equal(updated.find(x=>x.email===email).userId,newId);
 assert.equal(updated.find(x=>x.email===email).role,'teacher');
 assert.equal(updated[0].userId,'another');
});

test('Identity precedente ancora presente: nuovo ID non acquisisce account o ruolo',async()=>{
 const ok=await checkPreviousOwners({email,currentId:newId,invitation:obsolete,list:[obsolete],
  getIdentityUser:async id=>({id,email})});
 assert.equal(ok,false);
});

test('Identity non disponibile o collegamento senza ID: la pulizia non avviene',async()=>{
 await assert.rejects(()=>checkPreviousOwners({email,currentId:newId,invitation:obsolete,list:[],
  getIdentityUser:async()=>{throw {status:503}}}),e=>e.status===503);
 assert.equal(await checkPreviousOwners({email,currentId:newId,
  invitation:{email,status:'active'},list:[],getIdentityUser:async()=>{throw Error('should not lookup')}}),false);
});

test('puntatore email legacy riconciliato con ID precedente sulla stessa scuola, cancellato in Identity',async()=>{
 const invitation={email,code:'VAIS-32128',role:'teacher',status:'active',joinedAt:'2026-09-12'};
 const result=await inspectPreviousOwners({email,currentId:newId,invitation,list:[obsolete],
  getIdentityUser:async id=>{assert.equal(id,oldId);throw {status:404}}});
 assert.deepEqual(result,{allowed:true,reason:'orphan-verified'});
});

test('puntatore legacy senza ID collegabile, o ID ancora attivo, non viene riassegnato',async()=>{
 const invitation={email,code:'VAIS-32128',status:'active'};
 const unbound=await inspectPreviousOwners({email,currentId:newId,invitation,list:[invitation],
  getIdentityUser:async()=>{throw Error('should not call')}});
 assert.equal(unbound.reason,'legacy-unverifiable');
 const active=await inspectPreviousOwners({email,currentId:newId,invitation,list:[obsolete],
  getIdentityUser:async id=>({id,email})});
 assert.equal(active.reason,'identity-active');
});
