export async function changeAccreditation({school,code,action,confirmation,write,now=()=>new Date().toISOString()}){
  const statuses={suspend:'suspended',reactivate:'active','revoke-accreditation':'revoked'};
  const status=statuses[action];
  if(!status)return {status:400,error:'Azione accreditamento non riconosciuta'};
  if(school.status===status)return {status:200,ok:true,school,unchanged:true};
  if(action==='revoke-accreditation'&&confirmation!==`REVOCA ACCREDITO ${code}`)
    return {status:400,error:`Conferma obbligatoria: REVOCA ACCREDITO ${code}`};
  const timestamp=now();
  const updated={...school,status,statusChangedAt:timestamp,
    ...(status==='revoked'?{accreditationRevokedAt:timestamp}:{})};
  await write(`schools/${code}`,updated);
  return {status:200,ok:true,school:updated};
}
