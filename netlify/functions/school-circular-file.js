import {currentUser,requireMember,getJSON,getBlob,json} from './_lib.js';
import {profileClassNames,visibleTo} from './_school_activities.js';

export default async (req,context)=>{
  try{
    const user=await currentUser(req,context);if(!user)return json(401,{error:'Accesso richiesto'});
    const access=await requireMember(user);if(access.error)return access.error;
    if(req.method!=='GET')return json(405,{error:'Metodo non consentito'});
    const id=new URL(req.url).searchParams.get('id')||'',stored=await getJSON(`school-circulars/${access.membership.code}`),all=Array.isArray(stored)?stored:[];
    const circular=all.find(item=>item.id===id);if(!circular||!circular.fileKey)return json(404,{error:'Documento non trovato'});
    if(!['admin','coordinator'].includes(access.membership.role)){
      const profile=await getJSON(`profiles-by-user/${encodeURIComponent(user.id)}`),classes=profileClassNames(profile);
      if(!visibleTo(circular,access.membership,classes))return json(403,{error:'Circolare non destinata a questo account'});
    }
    const data=await getBlob(circular.fileKey,{type:'arrayBuffer'});if(!data)return json(404,{error:'Documento non disponibile'});
    const inline=circular.contentType==='application/pdf',filename=encodeURIComponent(circular.fileName||'circolare');
    return new Response(data,{status:200,headers:{'content-type':circular.contentType||'application/octet-stream','content-disposition':`${inline?'inline':'attachment'}; filename*=UTF-8''${filename}`,'cache-control':'private, no-store','x-content-type-options':'nosniff'}});
  }catch(error){console.error('school-circular-file error',error);return json(500,{error:'Errore nell’apertura della circolare'});}
};
