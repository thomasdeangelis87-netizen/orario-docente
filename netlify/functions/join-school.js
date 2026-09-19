import {json,currentUser,getMembership,getJSON,setJSON,setMembership,normalizeCode,normalizeEmail,memberIdKey} from './_lib.js';
import {inspectPreviousOwners,replaceOrphanedEmailRows} from './_join_school_core.js';
import {requestAccountChange} from './_account_change.js';

export default async (req,context={}) => {
  let stage='identity';
  try{
    if(req.method!=='POST') return json(405,{error:'Metodo non consentito'});
    const user=await currentUser(req,context);
    if(!user) return json(401,{error:'Accesso richiesto'});

    let body={};
    try{body=await req.json();}catch{return json(400,{error:'Dati non validi'});}
    const code=normalizeCode(body.code);
    if(!code) return json(400,{error:'Inserisci il codice scuola'});

    stage='school';
    const school=await getJSON(`schools/${code}`);
    if(!school||school.status!=='active') return json(404,{error:'Codice scuola non valido o scuola non ancora attiva'});

    if(!user.id)return json(403,{error:'ID account non disponibile'});
    stage='membership';
    const prior=await getJSON(memberIdKey(user.id));
    if(prior?.status==='revoked')return json(403,{error:'Accesso revocato: contatta un amministratore della scuola per ripristinarlo.'});
    const current=await getMembership(user);
    if(current && current.code!==code)
      return json(409,{error:'Questo account è già collegato a un’altra scuola. Scollegalo prima di cambiare istituto.'});

    if(current && current.code===code && current.status==='active'){
      return json(200,{ok:true,school,membership:current,alreadyConnected:true});
    }

    const invitation=await getMembership(user.email);
    const list=(await getJSON(`school-members/${code}`))||[];
    stage='previous-identity';
    let ownership;
    try{
      const {admin}=await import('@netlify/identity');
      ownership=await inspectPreviousOwners({email:user.email,currentId:user.id,invitation,list,
        getIdentityUser:id=>admin.getUser(id)});
    }catch(error){
      console.warn('join-school previous Identity lookup unavailable',{
        requestId:context.requestId||'',code,status:error?.status,name:error?.name});
      // A code holder can still request an explicit platform review. The
      // old membership is never transferred by an unverified lookup.
      ownership={allowed:false,reason:'identity-check-unavailable'};
    }
    if(!ownership.allowed){
      console.warn('join-school previous owner blocked',{requestId:context.requestId||'',code,reason:ownership.reason});
      const request=await requestAccountChange({user,code,school,read:getJSON,write:setJSON});
      return json(202,{ok:true,pending:true,request,
        message:'Richiesta di cambio account inviata al pannello amministrativo. Dopo l’approvazione potrai accedere all’orario della scuola.'});
    }
    const invited=invitation?.code===code&&invitation.status==='pending'&&!!invitation.assignedBy&&invitation.userId===user.id;
    const membership={
      userId:user.id,email:user.email,code,role:(current&&current.role)||(invited&&invitation.role)||'teacher',status:'active',
      joinedAt:new Date().toISOString(),displayName:String(body.displayName||'').slice(0,120)
    };
    stage='write-membership';
    await setMembership(user.email,membership);
    const requestKey=`link-requests-by-user/${encodeURIComponent(user.id)}`;
    const oldRequest=await getJSON(requestKey);
    if(oldRequest?.status==='pending'){
      const requestCode=normalizeCode(oldRequest.code);
      const requests=(await getJSON(`school-link-requests/${requestCode}`))||[];
      const requestIx=requests.findIndex(x=>normalizeEmail(x.email)===user.email);
      oldRequest.status=requestCode===code?'approved':'cancelled';
      oldRequest.decidedAt=new Date().toISOString();oldRequest.decidedBy='school-code';
      if(requestIx>=0){requests[requestIx]=oldRequest;await setJSON(`school-link-requests/${requestCode}`,requests)}
      await setJSON(requestKey,oldRequest);
    }

    stage='write-roster';
    await setJSON(`school-members/${code}`,replaceOrphanedEmailRows(list,user.email,membership).slice(0,1500));

    return json(200,{ok:true,school,membership});
  }catch(e){
    console.error('join-school error',{requestId:context.requestId||'',stage,name:e?.name,status:e?.status,
      message:String(e?.message||e).slice(0,240)});
    return json(500,{error:'Errore backend nel collegamento alla scuola',stage,requestId:context.requestId||''});
  }
};
