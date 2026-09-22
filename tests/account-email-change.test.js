import test from 'node:test';
import assert from 'node:assert/strict';
import {emailKey,memberIdKey} from '../netlify/functions/_lib.js';
import {accountEmailChangeStatus,requestAccountEmailChange} from '../netlify/functions/_account_email_change.js';
import {changeKey} from '../netlify/functions/_school_email_change.js';

const oldEmail='docente@example.it',newEmail='docente.nuovo@example.it',user={id:'teacher-id',email:oldEmail};
function fixture({linked=true}={}){
 const member={userId:user.id,email:oldEmail,code:'SCUOLA-1',role:'teacher',status:'active'};
 const store=new Map(linked?[[memberIdKey(user.id),member],['school-members/SCUOLA-1',[member]],[`members-by-email/${emailKey(oldEmail)}`,member]]:[]);
 let identity={id:user.id,email:oldEmail};
 return {store,read:async key=>store.get(key)||null,write:async(key,value)=>store.set(key,value),
  admin:{getUser:async()=>identity},
  confirm(){identity={id:user.id,email:newEmail}}};
}

test('richiede conferma senza cambiare ID, profilo o associazione scuola',async()=>{
 const f=fixture();f.store.set('profiles-by-user/teacher-id',{state:{meta:{},slots:{}}});
 const result=await requestAccountEmailChange({user,newEmail,read:f.read,write:f.write,identityAdmin:f.admin,findByEmail:async()=>null});
 assert.equal(result.status,202);assert.equal(result.pending,true);
 assert.equal(f.store.get(memberIdKey(user.id)).email,oldEmail);
 assert.equal(f.store.get('profiles-by-user/teacher-id').state.meta.constructor,Object);
 assert.equal(f.store.get(changeKey(user.id)).userId,user.id);
});

test('dopo conferma riallinea anche un docente e conserva lo stesso collegamento scuola',async()=>{
 const f=fixture();await requestAccountEmailChange({user,newEmail,read:f.read,write:f.write,identityAdmin:f.admin,findByEmail:async()=>null});
 f.confirm();const result=await accountEmailChangeStatus({user:{...user,email:newEmail},read:f.read,write:f.write,identityAdmin:f.admin});
 assert.equal(result.state,'complete');
 assert.equal(f.store.get(memberIdKey(user.id)).email,newEmail);
 assert.equal(f.store.get('school-members/SCUOLA-1')[0].role,'teacher');
 assert.equal(f.store.get(`members-by-email/${emailKey(oldEmail)}`).status,'renamed');
});

test('account senza scuola completa il cambio senza toccare il profilo per ID',async()=>{
 const f=fixture({linked:false});f.store.set('profiles-by-user/teacher-id',{fullName:'Docente'});
 await requestAccountEmailChange({user,newEmail,read:f.read,write:f.write,identityAdmin:f.admin,findByEmail:async()=>null});
 f.confirm();const result=await accountEmailChangeStatus({user:{...user,email:newEmail},read:f.read,write:f.write,identityAdmin:f.admin});
 assert.equal(result.state,'complete');assert.equal(f.store.get('profiles-by-user/teacher-id').fullName,'Docente');
});

test('impedisce destinazioni già occupate senza preparare il cambio',async()=>{
 const f=fixture();
 const result=await requestAccountEmailChange({user,newEmail,read:f.read,write:f.write,identityAdmin:f.admin,findByEmail:async()=>({id:'other-id'})});
 assert.equal(result.status,409);assert.equal(f.store.has(changeKey(user.id)),false);
});
