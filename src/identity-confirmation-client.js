import {acceptInvite,handleAuthCallback} from '@netlify/identity';
import {confirmationTokenFromLocation,confirmationErrorMessage,invitePasswordRequired} from './identity-confirmation.js';

const status=document.getElementById('confirmationStatus');
const detail=document.getElementById('confirmationDetail');
const actions=document.getElementById('confirmationActions');
const spinner=document.querySelector('.spinner');
const passwordForm=document.getElementById('invitePasswordForm');
const passwordInput=document.getElementById('invitePassword');
const passwordConfirm=document.getElementById('invitePasswordConfirm');
const passwordError=document.getElementById('invitePasswordError');
let confirmationToken='';

function show(title,message,{success=false}={}){
  status.textContent=title;
  status.classList.toggle('success',success);
  status.classList.toggle('error',!success);
  detail.textContent=message;
  spinner?.classList.add('hidden');
  actions.hidden=false;
}

function requestInvitePassword(){
  status.textContent='Completa l’attivazione';
  status.classList.remove('error','success');
  detail.textContent='Questo account era già stato predisposto come invito. Scegli ora la password per confermare l’email e attivare lo stesso account.';
  spinner?.classList.add('hidden');
  actions.hidden=true;
  passwordForm.hidden=false;
  passwordInput.focus();
}

async function confirmEmail(){
  confirmationToken=confirmationTokenFromLocation(window.location);
  if(!confirmationToken){
    show('Link incompleto','Nel collegamento non è presente il codice di conferma. Apri direttamente l’ultimo link ricevuto via email.');
    return;
  }
  // @netlify/identity legge il token dal fragment. Normalizziamo anche i link
  // che lo consegnano come query parameter senza mai inviarlo al server.
  if(!new URLSearchParams(location.hash.slice(1)).has('confirmation_token')){
    history.replaceState(null,'',`${location.pathname}#confirmation_token=${encodeURIComponent(confirmationToken)}`);
  }
  try{
    const result=await handleAuthCallback();
    if(result?.type!=='confirmation')throw new Error('Il collegamento non contiene una conferma valida.');
    show('Email confermata','Conferma completata. Ora puoi entrare nel tuo account.',{success:true});
    setTimeout(()=>location.replace('/?email_confermata=1'),900);
  }catch(error){
    console.error('Identity email confirmation failed',error);
    if(invitePasswordRequired(error)){
      requestInvitePassword();
      return;
    }
    show('Conferma non completata',confirmationErrorMessage(error));
  }
}

passwordForm.addEventListener('submit',async event=>{
  event.preventDefault();
  passwordError.textContent='';
  const password=passwordInput.value;
  if(password.length<8){passwordError.textContent='La password deve contenere almeno 8 caratteri.';return}
  if(password!==passwordConfirm.value){passwordError.textContent='Le due password non coincidono.';return}
  const button=passwordForm.querySelector('button');button.disabled=true;
  try{
    await acceptInvite(confirmationToken,password);
    passwordForm.hidden=true;
    show('Email confermata','Account attivato correttamente. Accesso in corso…',{success:true});
    setTimeout(()=>location.replace('/?email_confermata=1'),900);
  }catch(error){
    console.error('Identity invited user activation failed',error);
    passwordError.textContent=confirmationErrorMessage(error);
  }finally{button.disabled=false}
});

confirmEmail();
