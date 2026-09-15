(function(root){
  function normalizeIdentity(value){
    return String(value||'').trim().toLowerCase();
  }

  function personalStorageKey(user){
    const identity=normalizeIdentity(user&&user.id);
    return identity?`orarioDocenteStateV6:${identity}`:'';
  }

  root.OrarioAccountStorage={normalizeIdentity,personalStorageKey};
})(typeof window!=='undefined'?window:globalThis);
