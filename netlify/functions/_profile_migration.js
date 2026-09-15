export function canMigrateLegacyProfile(user,legacy){
  if(!user?.id||!legacy?.state?.meta||legacy.userId&&legacy.userId!==user.id)return false;
  const created=Date.parse(user.createdAt||''),saved=Date.parse(legacy.updatedAt||'');
  if(!Number.isFinite(created)||!Number.isFinite(saved)||created>saved)return false;
  const clean=v=>String(v||'').trim().replace(/\s+/g,' ').toLocaleLowerCase('it');
  const profileName=clean(legacy.fullName||[legacy.state.meta.firstName,legacy.state.meta.lastName].filter(Boolean).join(' '));
  const identityName=clean(user.metadata?.full_name||'');
  // Email is not identity. A saved timestamp and independently stored Identity
  // signup name must both agree before copying a legacy document to this ID.
  return !!profileName&&profileName===identityName;
}
