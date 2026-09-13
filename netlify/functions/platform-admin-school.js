import {json,getJSON,setJSON,setMembership,normalizeEmail,normalizeCode} from './_lib.js';

function requirePlatformAdmin(req){
  const key=req.headers.get('x-platform-admin-key') || '';
  const expected=process.env.PLATFORM_ADMIN_KEY || '';
  if(!expected || key!==expected) return {error:json(403,{error:'Chiave amministratore piattaforma non valida'})};
  return {ok:true};
}
function makeCode(mech='SCUOLA'){
  const root=normalizeCode(mech).replace(/[^A-Z]/g,'').slice(0,4)||'SCU';
  return `${root}-${Math.floor(10000+Math.random()*90000)}`;
}
export default async (req)=>{
  try{
    if(req.method!=='POST') return json(405,{error:'Metodo non consentito'});
    const auth=requirePlatformAdmin(req); if(auth.error) return auth.error;
    let body={}; try{body=await req.json();}catch{return json(400,{error:'Dati non validi'});}
    const name=String(body.name||'').trim();
    const mechanicalCode=String(body.mechanicalCode||'').trim().toUpperCase();
    const adminEmail=normalizeEmail(body.adminEmail||'');
    if(!name||!mechanicalCode||!adminEmail) return json(400,{error:'Compila denominazione, codice meccanografico ed email amministratore.'});
    let code=makeCode(mechanicalCode), tries=0;
    while(await getJSON(`schools/${code}`)){
      if(++tries>10) return json(409,{error:'Impossibile generare un codice scuola univoco'});
      code=makeCode(mechanicalCode);
    }
    const now=new Date().toISOString();
    const school={code,name,mechanicalCode,city:String(body.city||'').trim(),province:String(body.province||'').trim().toUpperCase(),status:'active',createdAt:now,createdBy:'platform-admin',inviteCode:code};
    await setJSON(`schools/${code}`,school);
    const membership={email:adminEmail,code,role:'admin',status:'active',joinedAt:now,assignedBy:'platform-admin',displayName:String(body.adminName||'').trim()};
    await setMembership(adminEmail,membership);
    await setJSON(`school-members/${code}`,[membership]);
    return json(200,{ok:true,school,membership});
  }catch(e){
    console.error('platform-admin-school error',e);
    return json(500,{error:'Errore backend amministrazione piattaforma',detail:String(e?.message||e)});
  }
};
