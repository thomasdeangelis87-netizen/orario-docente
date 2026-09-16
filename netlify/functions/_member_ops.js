const normalizeEmail=v=>String(v||'').trim().toLowerCase();

export function activeAdministrators(list){
  return list.filter(m=>m.role==='admin'&&m.status==='active'&&!!m.userId);
}
export function mayRevoke(list,email){
  const target=list.find(m=>normalizeEmail(m.email)===normalizeEmail(email));
  return !!target && !(target.role==='admin'&&target.status==='active'&&activeAdministrators(list).length<=1);
}
export function mayClaimLegacy(identity,legacy){
  if(!identity?.id||!identity.email||!legacy||legacy.status!=='active'||
      normalizeEmail(legacy.email)!==normalizeEmail(identity.email)||
      legacy.userId&&legacy.userId!==identity.id)return false;
  const created=Date.parse(identity.createdAt||''),assigned=Date.parse(legacy.joinedAt||'');
  return Number.isFinite(created)&&Number.isFinite(assigned)&&created<=assigned;
}
export async function lookupIdentityAccount(email){
  const {admin}=await import('@netlify/identity');
  for(let page=1;page<=20;page++){
    const batch=await admin.listUsers({page,perPage:100});
    const found=batch.find(u=>normalizeEmail(u.email)===normalizeEmail(email));
    if(found)return found;
    if(batch.length<100)break;
  }
  return null;
}
