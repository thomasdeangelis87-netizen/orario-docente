import test from 'node:test';
import assert from 'node:assert/strict';
import {requestAccountChange,decideAccountChange} from '../netlify/functions/_account_change.js';
import {emailKey,memberIdKey} from '../netlify/functions/_lib.js';

const code='VAIS-32128',email='teacher@example.it';
function fixture(role='teacher'){
 const old={userId:'old-id',email,code,role,status:'active'};
 const admin={userId:'manager-id',email:'manager@example.it',code,role:'admin',status:'active'};
 const schedule={schoolCode:code,version:8,teachers:['Teacher'],entries:[{teacher:'Teacher',day:1}]};
 const store=new Map([[`schools/${code}`,{code,name:'Falcone',status:'active'}],
  [`schedules/${code}`,schedule],[`school-members/${code}`,[admin,old]],
  [`members-by-email/${emailKey(email)}`,old],[memberIdKey(old.userId),old]]);
 return {old,admin,store,schedule,read:async k=>store.get(k)||null,write:async(k,v)=>store.set(k,v)};
}

test('richiesta da Identity corrente, approvazione piattaforma, accesso docente sullo stesso orario scuola',async()=>{
 const f=fixture(),user={id:'new-id',email};
 const request=await requestAccountChange({user,code,school:{name:'Falcone'},read:f.read,write:f.write});
 const duplicate=await requestAccountChange({user,code,school:{name:'Falcone'},read:f.read,write:f.write});
 assert.equal(duplicate.id,request.id);
 const outcome=await decideAccountChange({code,id:request.id,action:'approve-account-change',read:f.read,write:f.write,
  getIdentityUser:async id=>({id,email})});
 assert.equal(outcome.status,200);
 assert.equal(f.store.get(memberIdKey('old-id')).status,'revoked');
 assert.equal(f.store.get(memberIdKey('new-id')).role,'teacher');
 assert.equal(f.store.get(`members-by-email/${emailKey(email)}`).userId,'new-id');
 assert.equal(f.store.get(`school-members/${code}`).find(x=>x.email===email).userId,'new-id');
 assert.equal(f.store.get(`schedules/${code}`),f.schedule);
});

test('ID richiedente diverso da Identity e approvazione ripetuta non alterano i collegamenti',async()=>{
 const f=fixture(),request=await requestAccountChange({user:{id:'new-id',email},code,school:{name:'Falcone'},read:f.read,write:f.write});
 const wrong=await decideAccountChange({code,id:request.id,action:'approve-account-change',read:f.read,write:f.write,
  getIdentityUser:async()=>({id:'other-id',email})});
 assert.equal(wrong.status,409);assert.equal(f.store.get(memberIdKey('old-id')).status,'active');
 const rejected=await decideAccountChange({code,id:request.id,action:'reject-account-change',read:f.read,write:f.write});
 assert.equal(rejected.status,200);
 const second=await decideAccountChange({code,id:request.id,action:'approve-account-change',read:f.read,write:f.write,
  getIdentityUser:async()=>({id:'new-id',email})});
 assert.equal(second.status,404);assert.equal(f.store.get(`schedules/${code}`),f.schedule);
});

test('cambio account non può revocare l’ultimo amministratore',async()=>{
 const f=fixture('admin');
 f.store.set(`school-members/${code}`,[f.old]);
 const request=await requestAccountChange({user:{id:'new-id',email},code,school:{name:'Falcone'},read:f.read,write:f.write});
 const outcome=await decideAccountChange({code,id:request.id,action:'approve-account-change',read:f.read,write:f.write,
  getIdentityUser:async()=>({id:'new-id',email})});
 assert.equal(outcome.status,409);assert.equal(f.store.get(memberIdKey('old-id')).status,'active');
 assert.equal(f.store.get(`schedules/${code}`),f.schedule);
});
