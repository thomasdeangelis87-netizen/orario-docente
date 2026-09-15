(function(root){
 function canManageSchool(role,cloudReady){return cloudReady===true&&['admin','coordinator'].includes(role)}
 root.OrarioSchoolPermissions={canManageSchool};
})(typeof window!=='undefined'?window:globalThis);
