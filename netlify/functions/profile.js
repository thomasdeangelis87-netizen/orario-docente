import { json, currentUser, getJSON, setJSON, emailKey } from './_lib.js';
import {canMigrateLegacyProfile} from './_profile_migration.js';

function validState(x){
  return !!(x && x.meta && x.slots && typeof x.slots === 'object');
}

export default async (req,context) => {
  try{
    const user=await currentUser(req,context);
    if(!user) return json(401,{error:'Accesso richiesto'});

    if(!user.id)return json(403,{error:'ID account non disponibile'});
    const key=`profiles-by-user/${encodeURIComponent(user.id)}`;

    if(req.method==='GET'){
      let profile=await getJSON(key);
      if(!profile){
        const legacy=await getJSON(`profiles/${emailKey(user.email)}`);
        if(canMigrateLegacyProfile(user,legacy)){
          profile={...legacy,userId:user.id,migratedFrom:'legacy-email'};
          await setJSON(key,profile);
        }
      }
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
        updatedAt:new Date().toISOString(),
        userId:user.id
      };

      await setJSON(key,profile);
      return json(200,{ok:true,profile});
    }

    return json(405,{error:'Metodo non consentito'});
  }catch(e){
    console.error('profile function error',e);
    return json(500,{error:'Errore salvataggio profilo',detail:String(e?.message||e)});
  }
};
