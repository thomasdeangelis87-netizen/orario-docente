import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {confirmationTokenFromLocation,confirmationCallbackUrl,confirmationErrorMessage} from '../src/identity-confirmation.js';

const index=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const callback=fs.readFileSync(new URL('../auth-callback.html',import.meta.url),'utf8');
const identityClient=fs.readFileSync(new URL('../src/identity-client.js',import.meta.url),'utf8');

test('legge il token di conferma dal fragment o dalla query senza perderlo',()=>{
  assert.equal(confirmationTokenFromLocation({hash:'#confirmation_token=abc-123'}),'abc-123');
  assert.equal(confirmationTokenFromLocation({search:'?confirmation_token=query-token'}),'query-token');
  assert.equal(confirmationCallbackUrl({hash:'#confirmation_token=a%2Fb'}),'/auth-callback.html#confirmation_token=a%2Fb');
});

test('la home instrada la conferma nella pagina dedicata prima di caricare l app',()=>{
  const redirect=index.indexOf("location.replace(`/auth-callback.html#confirmation_token=");
  const application=index.indexOf('xlsx.full.min.js');
  assert.ok(redirect>0 && redirect<application);
  assert.match(callback,/identity-confirmation-client\.js\?v=16\.10\.26/);
});

test('la conferma riuscita non viene trasformata in errore da un logout immediato',()=>{
  assert.doesNotMatch(identityClient,/callback\?\.type==='confirmation'[\s\S]{0,80}await logout\(\)/);
});

test('gli errori Identity distinguono link scaduto e non valido',()=>{
  assert.match(confirmationErrorMessage(new Error('Token has expired')),/scaduto/i);
  assert.match(confirmationErrorMessage(new Error('Invalid confirmation token')),/non è valido/i);
});
