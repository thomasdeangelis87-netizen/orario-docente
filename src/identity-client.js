import {getUser,handleAuthCallback,onAuthChange,login,signup,logout,requestPasswordRecovery,updateUser} from '@netlify/identity';
import {createAuthEventBridge} from './auth-event-bridge.js';

window.OrarioIdentity={getUser,login,signup,logout,requestPasswordRecovery,updateUser};
onAuthChange(createAuthEventBridge(getUser,(event,user)=>{
 if(event==='login')window.dispatchEvent(new CustomEvent('orario-login',{detail:user}));
 if(event==='logout')window.dispatchEvent(new Event('orario-logout'));
}));
try{
 const callback=await handleAuthCallback();
 if(callback?.type==='recovery')window.dispatchEvent(new Event('orario-recovery'));
 if(callback?.type==='confirmation'){
  window.dispatchEvent(new Event('orario-confirmation'));
 }
 const user=await getUser();
 window.dispatchEvent(new CustomEvent('orario-auth-ready',{detail:user}));
 if(callback?.type==='email_change')window.dispatchEvent(new CustomEvent('orario-email-change',{detail:user}));
}catch(e){
 console.error('Identity initialization error',e);
 window.dispatchEvent(new CustomEvent('orario-auth-error',{detail:e.message||'Accesso non disponibile'}));
}
