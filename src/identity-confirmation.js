export function confirmationTokenFromLocation(locationLike={}){
  const hash=new URLSearchParams(String(locationLike.hash||'').replace(/^#/,''));
  const search=new URLSearchParams(String(locationLike.search||'').replace(/^\?/,''));
  return hash.get('confirmation_token')||search.get('confirmation_token')||'';
}

export function confirmationCallbackUrl(locationLike={}){
  const token=confirmationTokenFromLocation(locationLike);
  if(!token)return '';
  return `/auth-callback.html#confirmation_token=${encodeURIComponent(token)}`;
}

export function confirmationErrorMessage(error){
  const detail=String(error?.message||error||'').trim();
  const normalized=detail.toLowerCase();
  if(normalized.includes('expired'))return 'Il link di conferma è scaduto. Registrati nuovamente oppure chiedi un nuovo invio della conferma.';
  if(normalized.includes('invalid')||normalized.includes('token'))return 'Il link di conferma non è valido o è già stato utilizzato. Apri l’ultimo messaggio ricevuto e riprova.';
  return detail||'Identity non ha completato la conferma. Riprova dal link ricevuto via email.';
}
