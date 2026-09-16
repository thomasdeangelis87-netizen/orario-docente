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
  const oldOwners=[invitation,...list.filter(m=>normalizeEmail(m.email)===email)]
    .filter(m=>m?.status==='active'&&m.userId!==currentId);
  for(const owner of oldOwners){
    if(!await obsoleteOwner(owner,currentId,getIdentityUser))return false;
  }
  return true;
}

export function replaceOrphanedEmailRows(list,email,newMembership){
  const matches=list.map((member,index)=>normalizeEmail(member.email)===email?index:-1).filter(index=>index>=0);
  if(!matches.length)return [...list,newMembership];
  // Preserve unrelated accounts. The caller has already checked every matching owner.
  return list.filter((_,index)=>!matches.includes(index)).concat(newMembership);
}
