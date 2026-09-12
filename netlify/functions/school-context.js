const {json,userFromContext,requireMember,getJSON}=require('./_lib');
exports.handler=async(event,context)=>{
  if(event.httpMethod!=='GET') return json(405,{error:'Metodo non consentito'});
  const user=userFromContext(context); if(!user) return json(401,{error:'Accesso richiesto'});
  const r=await requireMember(user); if(r.error) return r.error;
  const schedule=await getJSON(`schedules/${r.membership.code}`);
  return json(200,{school:r.school,membership:r.membership,schedule:schedule||null});
};
