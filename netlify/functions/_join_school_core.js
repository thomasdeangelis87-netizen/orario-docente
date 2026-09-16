import {normalizeEmail} from './_lib.js';

// A reused email is not proof that two Identity IDs belong to the same person.
// Only a definitive 404 for the previous ID permits replacing its association.
export async function obsoleteOwner(owner,currentId,getIdentityUser){
  if(!owner || owner.status!=='active' || owner.userId===currentId)return false;
  if(!owner.userId)return false;
  try{
    const previous=await getIdentityUser(owner.userId);
    return false; // Existing accounts retain their association, even if their email changed.
  }catch(error){
    if(error?.status===404)return true;
    throw error; // Identity outage is not evidence of account deletion.
  }
}

export async function checkPreviousOwners({email,currentId,invitation,list,getIdentityUser}){
  return (await inspectPreviousOwners({email,currentId,invitation,list,getIdentityUser})).allowed;
}

export async function inspectPreviousOwners({email,currentId,invitation,list,getIdentityUser}){
  const rows=list.filter(m=>normalizeEmail(m.email)===email&&m.status==='active');
  const oldOwners=[invitation,...rows].filter(m=>m?.status==='active'&&m.userId!==currentId);
  const knownIds=[...new Set(oldOwners.map(m=>m.userId).filter(Boolean))];
  // Old by-email documents sometimes predate userId. Resolve them only when
  // the school roster provides exactly one matching, bound owner; never treat
  // a bare reused email as proof that the former account was deleted.
  for(const owner of oldOwners){
    if(!owner.userId && (knownIds.length!==1||owner.code!==rows.find(m=>m.userId===knownIds[0])?.code))
      return {allowed:false,reason:'legacy-unverifiable'};
  }
  for(const id of knownIds){
    try{
      const account=await getIdentityUser(id);
      if(account)return {allowed:false,reason:'identity-active'};
      return {allowed:false,reason:'identity-unverifiable'};
    }catch(error){
      if(error?.status!==404)throw error;
    }
  }
  return {allowed:true,reason:knownIds.length?'orphan-verified':'no-conflict'};
}

export function replaceOrphanedEmailRows(list,email,newMembership){
  const matches=list.map((member,index)=>normalizeEmail(member.email)===email?index:-1).filter(index=>index>=0);
  if(!matches.length)return [...list,newMembership];
  // Preserve unrelated accounts. The caller has already checked every matching owner.
  return list.filter((_,index)=>!matches.includes(index)).concat(newMembership);
}
