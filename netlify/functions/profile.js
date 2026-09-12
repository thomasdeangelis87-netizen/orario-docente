import { getStore } from '@netlify/blobs';
import { json, currentUser, emailKey } from './_lib.js';

function store(){
  return getStore('orario-docente-cloud',{consistency:'strong'});
}

function validState(x){
  return !!(x && x.meta && x.slots && typeof x.slots === 'object');
}

export default async (req) => {
  try{
    const user=await currentUser();
    if(!user) return json(401,{error:'Accesso richiesto'});

    const key=`profiles/${emailKey(user.email)}`;

    if(req.method==='GET'){
      const profile=await store().get(key,{type:'json'});
      return json(200,{profile:profile||null});
    }

    if(req.method==='POST'){
      let body={};
      try{body=await req.json()}catch{
        return json(400,{error:'Dati profilo non validi'});
      }

      if(!validState(body.state)){
        return json(400,{error:'Profilo non valido'});
      }

      const profile={
        state:body.state,
        profileCompleted:body.profileCompleted===true,
        fullName:String(body.fullName||'').slice(0,200),
        updatedAt:new Date().toISOString()
      };

      await store().setJSON(key,profile);
      return json(200,{ok:true,profile});
    }

    return json(405,{error:'Metodo non consentito'});
  }catch(e){
    console.error('profile function error',e);
    return json(500,{error:'Errore salvataggio profilo',detail:String(e?.message||e)});
  }
};
