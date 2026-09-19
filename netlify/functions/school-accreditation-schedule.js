import {currentUser,getJSON,setJSON,getBlob,setBlob,requireMember,json} from './_lib.js';

const safeId=value=>String(value||'').trim().replace(/[^A-Z0-9._-]/gi,'');

export default async (req,context)=>{
  try{
    const user=await currentUser(req,context);
    if(!user?.id)return json(401,{error:'Accesso richiesto.'});
    if(req.method==='POST'){
      const id=safeId(new URL(req.url).searchParams.get('requestId'));
      const request=id&&await getJSON(`accreditations/${id}`);
      if(!request||request.accountUserId!==user.id)return json(403,{error:'Richiesta di accreditamento non autorizzata.'});
      if(request.status!=='pending')return json(409,{error:'La richiesta non è più in attesa.'});
      const bytes=await req.arrayBuffer();
      if(!bytes.byteLength)return json(400,{error:'File orario vuoto.'});
      if(bytes.byteLength>8*1024*1024)return json(413,{error:'File orario troppo grande (massimo 8 MB).'});
      const name=decodeURIComponent(req.headers.get('x-file-name')||'orario.pdf').slice(0,180);
      const contentType=req.headers.get('content-type')||'application/octet-stream';
      await setBlob(`accreditation-files/${id}`,bytes,{metadata:{name,contentType,uploadedAt:new Date().toISOString(),ownerUserId:user.id}});
      request.scheduleAttachment={name,contentType,size:bytes.byteLength,uploadedAt:new Date().toISOString()};
      await setJSON(`accreditations/${id}`,request);
      return json(200,{ok:true,attachment:request.scheduleAttachment});
    }
    if(req.method==='GET'){
      const access=await requireMember(user,['admin','coordinator']);
      if(access.error)return access.error;
      const accreditationId=safeId(access.school.accreditationId);
      if(!accreditationId)return json(404,{error:'Nessun allegato di accreditamento disponibile.'});
      const request=await getJSON(`accreditations/${accreditationId}`);
      const data=await getBlob(`accreditation-files/${accreditationId}`,{type:'arrayBuffer'});
      if(!data)return json(404,{error:'Nessun allegato di accreditamento disponibile.'});
      const meta=request?.scheduleAttachment||{};
      return new Response(data,{status:200,headers:{'content-type':meta.contentType||'application/octet-stream','content-disposition':`attachment; filename*=UTF-8''${encodeURIComponent(meta.name||'orario.pdf')}`,'x-file-name':encodeURIComponent(meta.name||'orario.pdf'),'cache-control':'no-store'}});
    }
    return json(405,{error:'Metodo non consentito'});
  }catch(error){
    console.error('school-accreditation-schedule error',{message:String(error?.message||error),stack:String(error?.stack||'').slice(0,1200)});
    return json(500,{error:'Errore nel recupero dell’orario allegato.'});
  }
};
