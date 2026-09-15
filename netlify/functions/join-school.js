import {json,currentUser,getJSON,setJSON,setMembership,normalizeCode,normalizeEmail,emailKey} from './_lib.js';

export default async (req) => {
  try{
    if(req.method!=='POST') return json(405,{error:'Metodo non consentito'});
    const user=await currentUser();
    if(!user) return json(401,{error:'Accesso richiesto'});

    let body={};
    try{body=await req.json();}catch{return json(400,{error:'Dati non validi'});}
    const code=normalizeCode(body.code);
    if(!code) return json(400,{error:'Inserisci il codice scuola'});

    const school=await getJSON(`schools/${code}`);
    if(!school||school.status!=='active') return json(404,{error:'Codice scuola non valido o scuola non ancora attiva'});

    const current=await getJSON(`members-by-email/${emailKey(user.email)}`);
    if(current && current.code!==code)
      return json(409,{error:'Questo account è già collegato a un’altra scuola. Scollegalo prima di cambiare istituto.'});

    if(current && current.code===code && current.status==='active'){
      return json(200,{ok:true,school,membership:current,alreadyConnected:true});
    }

    const membership={
      email:user.email,code,role:(current&&current.role)||'teacher',status:'active',
      joinedAt:new Date().toISOString(),displayName:String(body.displayName||'').slice(0,120)
    };
    await setMembership(user.email,membership);
    const oldRequest=await getJSON(`link-requests-by-email/${emailKey(user.email)}`);
    if(oldRequest?.status==='pending'){
      const requestCode=normalizeCode(oldRequest.code);
      const requests=(await getJSON(`school-link-requests/${requestCode}`))||[];
      const requestIx=requests.findIndex(x=>normalizeEmail(x.email)===user.email);
      oldRequest.status=requestCode===code?'approved':'cancelled';
      oldRequest.decidedAt=new Date().toISOString();oldRequest.decidedBy='school-code';
      if(requestIx>=0){requests[requestIx]=oldRequest;await setJSON(`school-link-requests/${requestCode}`,requests)}
      await setJSON(`link-requests-by-email/${emailKey(user.email)}`,oldRequest);
    }

    const list=(await getJSON(`school-members/${code}`))||[];
    const ix=list.findIndex(x=>normalizeEmail(x.email)===user.email);
    if(ix>=0) list[ix]={...list[ix],...membership}; else list.push(membership);
    await setJSON(`school-members/${code}`,list.slice(0,1500));

    return json(200,{ok:true,school,membership});
  }catch(e){
    console.error('join-school error',e);
    return json(500,{error:'Errore backend nel collegamento alla scuola',detail:String(e?.message||e)});
  }
};
