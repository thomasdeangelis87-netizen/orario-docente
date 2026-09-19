import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {sendSchoolApprovalEmail,schoolEmailConfiguration,SchoolEmailError} from '../netlify/functions/_brevo.js';

function netlifyEnv(values={}){
  globalThis.Netlify={env:{get:key=>values[key]||''}};
}

test('configurazione email assente produce un errore diagnostico senza tentare la rete',async()=>{
  netlifyEnv();let calls=0;
  const oldFetch=globalThis.fetch;globalThis.fetch=async()=>{calls++;};
  try{
    await assert.rejects(()=>sendSchoolApprovalEmail({to:'admin@example.it',schoolName:'Scuola',schoolCode:'SCU-12345'}),
      error=>error instanceof SchoolEmailError&&error.code==='email_provider_not_configured');
    assert.equal(calls,0);assert.equal(schoolEmailConfiguration().configured,false);
  }finally{globalThis.fetch=oldFetch;delete globalThis.Netlify;}
});

test('Brevo riceve email informativa che chiarisce account già associato e codice docenti',async()=>{
  netlifyEnv({BREVO_API_KEY:'test-secret',BREVO_SENDER_EMAIL:'scuole@example.it'});
  const oldFetch=globalThis.fetch;let request;
  globalThis.fetch=async(url,options)=>{request={url,options};return new Response(JSON.stringify({messageId:'test-id'}),{status:201});};
  try{
    const result=await sendSchoolApprovalEmail({to:'admin@example.it',schoolName:'Istituto Test',schoolCode:'TEST-12345',accountLinked:true});
    const payload=JSON.parse(request.options.body);
    assert.equal(result.messageId,'test-id');assert.equal(payload.to[0].email,'admin@example.it');
    assert.match(payload.htmlContent,/già stato associato/);assert.match(payload.htmlContent,/TEST-12345/);
    assert.equal(request.options.headers['api-key'],'test-secret');
  }finally{globalThis.fetch=oldFetch;delete globalThis.Netlify;}
});

test('pannello distingue attivazione, associazione ed esito email',()=>{
  const html=fs.readFileSync(new URL('../admin.html',import.meta.url),'utf8');
  assert.match(html,/Account amministratore già associato/);
  assert.match(html,/scuola e l’account restano attivi/i);
  assert.match(html,/Email informativa inviata correttamente/);
});
