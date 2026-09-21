import {handleAuthCallback} from '@netlify/identity';
import {confirmationTokenFromLocation,confirmationErrorMessage} from './identity-confirmation.js';

const status=document.getElementById('confirmationStatus');
const detail=document.getElementById('confirmationDetail');
const actions=document.getElementById('confirmationActions');
const spinner=document.querySelector('.spinner');

function show(title,message,{success=false}={}){
  status.textContent=title;
  status.classList.toggle('success',success);
  status.classList.toggle('error',!success);
  detail.textContent=message;
  spinner?.classList.add('hidden');
  actions.hidden=false;
}

async function confirmEmail(){
  const token=confirmationTokenFromLocation(window.location);
  if(!token){
    show('Link incompleto','Nel collegamento non è presente il codice di conferma. Apri direttamente l’ultimo link ricevuto via email.');
    return;
  }
  // @netlify/identity legge il token dal fragment. Normalizziamo anche i link
  // che lo consegnano come query parameter senza mai inviarlo al server.
  if(!new URLSearchParams(location.hash.slice(1)).has('confirmation_token')){
    history.replaceState(null,'',`${location.pathname}#confirmation_token=${encodeURIComponent(token)}`);
  }
  try{
    const result=await handleAuthCallback();
    if(result?.type!=='confirmation')throw new Error('Il collegamento non contiene una conferma valida.');
    show('Email confermata','Conferma completata. Ora puoi entrare nel tuo account.',{success:true});
    setTimeout(()=>location.replace('/?email_confermata=1'),900);
  }catch(error){
    console.error('Identity email confirmation failed',error);
    show('Conferma non completata',confirmationErrorMessage(error));
  }
}

confirmEmail();
