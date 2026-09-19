import {normalizeCode,normalizeEmail} from './_lib.js';

export function requestedSchoolCode(url){
  return normalizeCode(new URL(url).searchParams.get('code')||'');
}

function projectedSchool(approval,code){
  return {code,name:approval.schoolName||'Scuola accreditata',
    mechanicalCode:String(approval.mechanicalCode||'').trim().toUpperCase(),
    city:approval.city||'',province:approval.province||'',
    status:'active',createdAt:approval.approvedAt||approval.createdAt||'',
    approvedAt:approval.approvedAt||'',accreditationId:approval.id};
}
function projectedManager(approval,code){
  return {email:normalizeEmail(approval.accountEmail),userId:approval.accountUserId||'',
    code,role:'admin',status:'active',joinedAt:approval.approvedAt||approval.createdAt||'',
    displayName:[approval.contactFirstName,approval.contactLastName].filter(Boolean).join(' '),
    assignedBy:'platform-admin'};
}
function codeFromKey(key,prefix){
  return normalizeCode(String(key||'').startsWith(prefix)?String(key).slice(prefix.length):'');
}

export async function accreditedCatalog({read,write,list},selectedCode=''){
  const schoolsIndex=await read('schools-index');
  const approvalsIndex=await read('accreditations-index');
  const byCode=new Map(),codes=new Set(Array.isArray(schoolsIndex)?schoolsIndex.map(normalizeCode):[]);
  for(const id of Array.isArray(approvalsIndex)?approvalsIndex.slice(0,2000):[]){
    const record=await read(`accreditations/${id}`);
    const code=normalizeCode(record?.schoolCode);
    if(record?.status==='approved'&&code){byCode.set(code,record);codes.add(code)}
  }
  // Old versions did not always keep schools-index in sync. Discover every
  // school that still owns a document, members or an official schedule so it
  // can be recovered from the platform panel instead of remaining invisible.
  if(list){
    const groups=await Promise.all(['schools/','school-members/','schedules/'].map(prefix=>list(prefix)));
    groups.forEach((keys,index)=>keys.forEach(key=>{
      const code=codeFromKey(key,['schools/','school-members/','schedules/'][index]);
      if(code)codes.add(code);
    }));
  }
  if(selectedCode)codes.add(normalizeCode(selectedCode));
  const result=[];
  for(const code of codes){
    if(!code||selectedCode&&code!==normalizeCode(selectedCode))continue;
    const approval=byCode.get(code)||null;
    let school=await read(`schools/${code}`);
    const storedMembers=await read(`school-members/${code}`);
    const schedule=await read(`schedules/${code}`);
    if(!school&&!approval&&!Array.isArray(storedMembers)&&!schedule)continue;
    const missingSchool=!school;
    if(!school)school=approval?projectedSchool(approval,code):{
      code,name:schedule?.schoolName||schedule?.school||`Scuola legacy ${code}`,
      mechanicalCode:'',city:'',province:'',status:'legacy',createdAt:'',
      recoveryNeeded:true,inviteCode:code
    };
    // Existing school document is always authoritative: never overwrite a
    // revoked state or a previously uploaded schedule with an approval record.
    const missingMembers=!Array.isArray(storedMembers);
    const members=Array.isArray(storedMembers)?storedMembers:
      approval?.accountEmail?[projectedManager(approval,code)]:[];
    if(write){
      if(missingSchool)await write(`schools/${code}`,school);
      if(missingMembers&&members.length)await write(`school-members/${code}`,members);
    }
    const managerList=members.filter(m=>['admin','coordinator'].includes(m.role)&&m.status==='active');
    result.push({school:{...school,
      mechanicalCode:school.mechanicalCode||approval?.mechanicalCode||'',
      approvedAt:school.approvedAt||approval?.approvedAt||school.createdAt||''},
      members,managers:managerList,
      administrativeEmail:managerList.find(m=>m.role==='admin')?.email||
        normalizeEmail(approval?.accountEmail||''),hasSchedule:!!schedule,recoveryNeeded:school.recoveryNeeded===true});
  }
  return result;
}
