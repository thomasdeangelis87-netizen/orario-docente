import {currentUser,getJSON,json,setJSON} from './_lib.js';
import {lookupIdentityAccount} from './_member_ops.js';
import {accountEmailChangeStatus,requestAccountEmailChange} from './_account_email_change.js';

export default async (req,context={})=>{
  try{
    const user=await currentUser(req,context);
    if(!user)return json(401,{error:'Accesso richiesto'});
    const {admin}=await import('@netlify/identity');
    if(req.method==='GET'){
      const result=await accountEmailChangeStatus({user,read:getJSON,write:setJSON,identityAdmin:admin});
      const {status,...body}=result;return json(status,body);
    }
    if(req.method!=='POST')return json(405,{error:'Metodo non consentito'});
    let body;try{body=await req.json()}catch{return json(400,{error:'Dati non validi'})}
    const result=await requestAccountEmailChange({user,newEmail:body.newEmail,read:getJSON,write:setJSON,
      identityAdmin:admin,findByEmail:lookupIdentityAccount});
    const {status,...response}=result;return json(status,response);
  }catch(error){
    console.error('account email change failure',{requestId:context.requestId||'',message:String(error?.message||error).slice(0,200)});
    return json(500,{error:'Non è stato possibile cambiare l’e-mail. Riprova più tardi.'});
  }
};
