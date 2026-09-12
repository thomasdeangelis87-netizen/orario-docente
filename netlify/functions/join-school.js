const {json,userFromContext,getJSON,setJSON,setMembership,normalizeCode,normalizeEmail}=require('./_lib');
exports.handler=async(event,context)=>{
  if(event.httpMethod!=='POST') return json(405,{error:'Metodo non consentito'});
  const user=userFromContext(context); if(!user) return json(401,{error:'Accesso richiesto'});
  let body={}; try{body=JSON.parse(event.body||'{}')}catch(e){return json(400,{error:'Dati non validi'})}
  const code=normalizeCode(body.code); if(!code) return json(400,{error:'Inserisci il codice scuola'});
  const school=await getJSON(`schools/${code}`); if(!school||school.status!=='active') return json(404,{error:'Codice scuola non valido o scuola non ancora attiva'});
  const current=await getJSON(`members-by-email/${require('./_lib').emailKey(user.email)}`);
  if(current && current.code!==code) return json(409,{error:'Questo account è già collegato a un’altra scuola. Scollegalo prima di cambiare istituto.'});
  const membership={email:user.email,code,role:(current&&current.role)||'teacher',status:'active',joinedAt:new Date().toISOString(),displayName:String(body.displayName||'').slice(0,120)};
  await setMembership(user.email,membership);
  const list=(await getJSON(`school-members/${code}`))||[];
  const ix=list.findIndex(x=>normalizeEmail(x.email)===user.email);
  if(ix>=0) list[ix]={...list[ix],...membership}; else list.push(membership);
  await setJSON(`school-members/${code}`,list.slice(0,1500));
  return json(200,{ok:true,school,membership});
};
