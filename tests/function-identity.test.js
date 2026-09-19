import test from 'node:test';
import assert from 'node:assert/strict';
import {currentUser} from '../netlify/functions/_lib.js';

test('la Function valida nf_jwt con Identity e conserva l ID univoco',async()=>{
  const calls=[];
  const req=new Request('https://deploy-preview-6--example.netlify.app/.netlify/functions/profile',{
    headers:{cookie:'theme=light; nf_jwt=signed%2Etoken%2Evalue'}
  });
  const user=await currentUser(req,{}, {identityOrigin:'https://orariodocente.it',fetchImpl:async(url,options)=>{
    calls.push({url,options});
    return Response.json({id:'identity-123',email:'Teacher@Example.it',created_at:'2026-09-01',user_metadata:{full_name:'Docente'}});
  }});
  assert.deepEqual(calls,[{
    url:'https://orariodocente.it/.netlify/identity/user',
    options:{headers:{authorization:'Bearer signed.token.value'}}
  }]);
  assert.deepEqual(user,{id:'identity-123',email:'teacher@example.it',createdAt:'2026-09-01',metadata:{full_name:'Docente'}});
});

test('un token rifiutato da Identity non autentica la Function',async()=>{
  const req=new Request('https://example.netlify.app/.netlify/functions/profile',{headers:{cookie:'nf_jwt=invalid'}});
  assert.equal(await currentUser(req,{}, {fetchImpl:async()=>new Response('',{status:401})}),null);
});

test('usa direttamente l utente verificato dal runtime quando disponibile',async()=>{
  const req=new Request('https://example.netlify.app/.netlify/functions/profile');
  const user=await currentUser(req,{clientContext:{user:{sub:'identity-runtime',email:'Runtime@Example.it'}}},{
    fetchImpl:async()=>{throw new Error('non deve interrogare Identity')}
  });
  assert.equal(user.id,'identity-runtime');
  assert.equal(user.email,'runtime@example.it');
});
