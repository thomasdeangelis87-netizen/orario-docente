(function(root){
 function canManageSchool(role){return ['admin','coordinator'].includes(role)}
 root.OrarioSchoolPermissions={canManageSchool};
})(typeof window!=='undefined'?window:globalThis);
