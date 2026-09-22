import {emailKey,memberIdKey,normalizeCode,normalizeEmail} from './_lib.js';
import {changeKey,reconcileEmailChange} from './_school_email_change.js';

const validEmail=email=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export async function requestAccountEmailChange({user,newEmail,read,write,identityAdmin,findByEmail}){
  const oldEmail=normalizeEmail(user?.email),destination=normalizeEmail(newEmail);
  if(!user?.id||!oldEmail)return {status:401,error:'Accesso richiesto'};
  if(!validEmail(destination)||destination===oldEmail)
    return {status:400,error:'Inserisci una nuova e-mail valida e diversa da quella attuale.'};

  const account=await identityAdmin.getUser(user.id);
  if(account?.id!==user.id||normalizeEmail(account.email)!==oldEmail)
    return {status:409,error:'Non è stato possibile verificare l’account corrente. Esci e accedi di nuovo.'};

  const previous=await read(changeKey(user.id));
  if(previous?.status==='requested'&&normalizeEmail(previous.newEmail)!==destination)
    return {status:409,error:'Hai già un altro cambio e-mail in attesa di conferma.'};

  const occupant=await findByEmail(destination);
  if(occupant?.id&&occupant.id!==user.id)
    return {status:409,error:'Questa e-mail è già utilizzata da un altro account.'};

  const membership=await read(memberIdKey(user.id));
  if(membership&&membership.status==='active'&&normalizeEmail(membership.email)!==oldEmail)
    return {status:409,error:'Il collegamento alla scuola non corrisponde all’e-mail attuale. Contatta l’assistenza.'};
  const code=normalizeCode(membership?.code);
  if(code){
    const pointer=await read(`members-by-email/${emailKey(destination)}`);
    if(pointer&&(pointer.userId!==user.id||normalizeCode(pointer.code)!==code))
      return {status:409,error:'Questa e-mail è già collegata a un altro account o a un’altra scuola.'};
  }

  const change={userId:user.id,code,oldEmail,newEmail:destination,status:'requested',requestedAt:new Date().toISOString()};
  await write(changeKey(user.id),change);
  return {status:202,ok:true,pending:true,newEmail:destination,
    message:'Conferma il link inviato al nuovo indirizzo. Fino alla conferma il login usa la vecchia e-mail.'};
}

export async function accountEmailChangeStatus({user,read,write,identityAdmin}){
  if(!user?.id)return {status:401,error:'Accesso richiesto'};
  const change=await read(changeKey(user.id));
  if(!change)return {status:200,ok:true,state:'none',email:normalizeEmail(user.email)};
  if(change.status==='complete')return {status:200,ok:true,state:'complete',email:normalizeEmail(change.newEmail)};
  const verified=await reconcileEmailChange(change,{read,write,identityAdmin});
  return {status:200,ok:true,state:verified.status,...verified};
}
