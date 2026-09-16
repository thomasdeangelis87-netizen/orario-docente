import {emailKey,normalizeCode,normalizeEmail,memberIdKey} from './_lib.js';
import {mayClaimLegacy} from './_member_ops.js';

export const changeKey=id=>`identity-email-changes/${encodeURIComponent(String(id))}`;

export async function reconcileEmailChange(change,{read,write,identityAdmin}){
  const account=await identityAdmin.getUser(change.userId);
  if(account.id!==change.userId)throw new Error('Identity ID unexpectedly changed');
  if(normalizeEmail(account.email)===normalizeEmail(change.newEmail)){
    await finishEmailChange(change,{getJSON:read,setJSON:write});
    return {status:'complete',email:normalizeEmail(change.newEmail)};
  }
  return {status:'pending',email:normalizeEmail(account.email),newEmail:normalizeEmail(change.newEmail),
    confirmationRequired:normalizeEmail(account.pendingEmail)===normalizeEmail(change.newEmail)};
}

export async function finishEmailChange(change,{getJSON,setJSON}){
  const {userId,code,oldEmail,newEmail}=change;
  const record=await getJSON(memberIdKey(userId));
  if(!record||record.userId!==userId||normalizeCode(record.code)!==code||
      ![oldEmail,newEmail].includes(normalizeEmail(record.email)))
    throw new Error('Membership ownership changed; email sync stopped');
  const list=(await getJSON(`school-members/${code}`))||[];
  const index=list.findIndex(m=>m.userId===userId || !m.userId&&normalizeEmail(m.email)===oldEmail);
  if(index<0||!['admin','coordinator'].includes(list[index].role))
    throw new Error('School manager no longer present');
  const existing=await getJSON(`members-by-email/${emailKey(newEmail)}`);
  if(existing && (existing.userId!==userId||normalizeCode(existing.code)!==code))
    throw new Error('New email already owns another school association');
  const revised={...record,email:newEmail};
  await setJSON(memberIdKey(userId),revised);
  await setJSON(`members-by-email/${emailKey(newEmail)}`,revised);
  list[index]={...list[index],...revised};
  await setJSON(`school-members/${code}`,list);
  const previous=await getJSON(`members-by-email/${emailKey(oldEmail)}`);
  if(previous?.userId===userId&&normalizeCode(previous.code)===code)
    await setJSON(`members-by-email/${emailKey(oldEmail)}`,{...previous,status:'renamed',newEmail,renamedAt:new Date().toISOString()});
  const school=await getJSON(`schools/${code}`);
  if(school?.accreditationId){
    const key=`accreditations/${school.accreditationId}`,approval=await getJSON(key);
    if(approval?.accountUserId===userId||!approval?.accountUserId&&normalizeEmail(approval?.accountEmail)===oldEmail){
      await setJSON(key,{...approval,accountEmail:newEmail,
        contactEmail:normalizeEmail(approval.contactEmail)===oldEmail?newEmail:approval.contactEmail});
    }
  }
  await setJSON(changeKey(userId),{...change,status:'complete',completedAt:new Date().toISOString()});
  return revised;
}

export async function changeManagerLogin({code,membership,newEmail,read,write,identityAdmin,findByEmail}){
  const oldEmail=normalizeEmail(membership.email),destination=normalizeEmail(newEmail);
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destination)||destination===oldEmail)
    return {status:400,error:'Inserisci una nuova email valida e diversa da quella attuale.'};
  if(!['admin','coordinator'].includes(membership.role)||membership.status!=='active')
    return {status:409,error:'Seleziona un gestore attivo della scuola.'};
  const account=membership.userId?await identityAdmin.getUser(membership.userId):await findByEmail(oldEmail);
  if(!account?.id || !membership.userId&&!mayClaimLegacy({id:account.id,email:oldEmail,createdAt:account.createdAt},membership))
    return {status:409,error:'ID Identity del vecchio gestore non verificabile; assegna prima l’account corretto.'};
  if(![oldEmail,destination].includes(normalizeEmail(account.email)))
    return {status:409,error:'Email Identity diversa dal collegamento scuola; modifica interrotta.'};
  const previousChange=await read(changeKey(account.id));
  if(previousChange?.status==='requested'&&normalizeEmail(previousChange.newEmail)!==destination)
    return {status:409,error:'Un altro cambio email è in attesa di conferma per questo account.'};
  const occupant=await findByEmail(destination);
  if(occupant?.id && occupant.id!==account.id)return {status:409,error:'Nuova email già utilizzata da un altro account Identity.'};
  const pointer=await read(`members-by-email/${emailKey(destination)}`);
  if(pointer && (pointer.userId!==account.id||normalizeCode(pointer.code)!==code))
    return {status:409,error:'Nuova email già associata a un altro account o scuola.'};
  if(!membership.userId){
    const members=(await read(`school-members/${code}`))||[];
    const index=members.findIndex(m=>normalizeEmail(m.email)===oldEmail&&m.role===membership.role&&m.status==='active');
    if(index<0)return {status:409,error:'Gestore legacy non verificabile nell’elenco della scuola.'};
    const verified={...membership,userId:account.id};
    await write(memberIdKey(account.id),verified);
    members[index]={...members[index],userId:account.id};
    await write(`school-members/${code}`,members);
    await write(`members-by-email/${emailKey(oldEmail)}`,verified);
  }
  const change={userId:account.id,code,oldEmail,newEmail:destination,status:'requested',requestedAt:new Date().toISOString()};
  await write(changeKey(account.id),change);
  // A retry after verification must not issue a second email-change request.
  const updated=normalizeEmail(account.email)===destination||normalizeEmail(account.pendingEmail)===destination?
    account:await identityAdmin.updateUser(account.id,{email:destination});
  if(updated.id!==account.id)throw new Error('Identity ID unexpectedly changed');
  // The PUT response can describe a requested change. Read Identity again:
  // only its authoritative login email is allowed to update school records.
  const verified=await reconcileEmailChange(change,{read,write,identityAdmin});
  if(verified.status==='pending')
    return {status:202,ok:true,pending:true,userId:account.id,
      message:verified.confirmationRequired?
        'Cambio email in attesa: conferma il link inviato al nuovo indirizzo, poi aggiorna la pagina. Fino alla conferma il login usa la vecchia email.':
        'Identity non ha ancora confermato la nuova email di login. Verifica le impostazioni email di Identity; il vecchio login rimane attivo.'};
  return {status:200,ok:true,pending:false,userId:account.id,email:destination};
}
