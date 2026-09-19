import { json, getJSON } from './_lib.js';

export default async (req, context) => {
  const requestId=context?.requestId||'';
  console.info('health start',{requestId,deployContext:context?.deploy?.context||''});
  try{
    // Safe probe: a missing key should simply return null.
    await getJSON('__healthcheck__/probe');
    console.info('health blobs ok',{requestId});
    return json(200,{ok:true,service:'Orario Docente Cloud',version:'16.10.13',blobs:'ok',node:process.versions.node});
  }catch(e){
    console.error('health blob probe failure',{requestId,name:e?.name,code:e?.code,message:String(e?.message||e).slice(0,400)});
    return json(500,{ok:false,service:'Orario Docente Cloud',version:'16.10.13',blobs:'error',requestId,node:process.versions.node});
  }
};
