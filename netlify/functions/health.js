import { json, getJSON } from './_lib.js';

export default async () => {
  try{
    // Safe probe: a missing key should simply return null.
    await getJSON('__healthcheck__/probe');
    return json(200,{ok:true,service:'Orario Docente Cloud',version:'16.7.7',blobs:'ok'});
  }catch(e){
    console.error('health blob probe error',e);
    return json(500,{ok:false,service:'Orario Docente Cloud',version:'16.7.7',blobs:'error',detail:String(e?.message||e)});
  }
};
