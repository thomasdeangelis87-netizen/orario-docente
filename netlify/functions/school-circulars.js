import {json,currentUser,requireMember,getJSON,setJSON,setBlob,deleteJSON} from './_lib.js';
import {normalizeActivity,profileClassNames,visibleTo} from './_school_activities.js';
import {normalizeCircular,sortCirculars} from './_school_circulars.js';

const listKey=code=>`school-circulars/${code}`;
const activitiesKey=code=>`school-activities/${code}`;
const fileKey=(code,id)=>`school-circular-files/${code}/${id}`;
const allowedFiles={
  pdf:'application/pdf',doc:'application/msword',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
};

function extension(name=''){return String(name).toLowerCase().split('.').pop()||''}
async function visibleCirculars(items,membership,user){
  if(['admin','coordinator'].includes(membership.role))return items;
  const profile=await getJSON(`profiles-by-user/${encodeURIComponent(user.id)}`);
  const classes=profileClassNames(profile);
  return items.filter(item=>visibleTo(item,membership,classes));
}

export default async (req,context)=>{
  try{
    const user=await currentUser(req,context);
    if(!user)return json(401,{error:'Accesso richiesto'});
    const access=await requireMember(user);
    if(access.error)return access.error;
    const {membership,school}=access,canManage=['admin','coordinator'].includes(membership.role);
    const stored=await getJSON(listKey(membership.code)),all=Array.isArray(stored)?stored:[];
    if(req.method==='GET')return json(200,{school,membership,canManage,circulars:sortCirculars(await visibleCirculars(all,membership,user))});
    if(req.method!=='POST')return json(405,{error:'Metodo non consentito'});
    if(!canManage)return json(403,{error:'Solo amministratori e referenti possono gestire le circolari.'});

    const type=String(req.headers.get('content-type')||'');
    let body={},upload=null;
    if(type.includes('multipart/form-data')){
      const form=await req.formData();
      try{body=JSON.parse(String(form.get('meta')||'{}'))}catch{return json(400,{error:'Dati della circolare non validi'});}
      const candidate=form.get('file');if(candidate&&typeof candidate.arrayBuffer==='function'&&candidate.size)upload=candidate;
    }else{try{body=await req.json()}catch{return json(400,{error:'Dati non validi'});}}

    if(body.action==='delete'){
      const index=all.findIndex(item=>item.id===String(body.id||''));if(index<0)return json(404,{error:'Circolare non trovata'});
      const removed=all[index],next=all.filter((_,i)=>i!==index);
      await setJSON(listKey(membership.code),next);
      if(removed.fileKey)await deleteJSON(removed.fileKey);
      if(removed.activityId){const activities=(await getJSON(activitiesKey(membership.code)))||[];await setJSON(activitiesKey(membership.code),activities.filter(item=>item.id!==removed.activityId));}
      return json(200,{ok:true,circulars:sortCirculars(next)});
    }
    if(body.action!=='upsert')return json(400,{error:'Azione non valida'});
    const input=body.circular||{},requestedId=String(input.id||''),index=requestedId?all.findIndex(item=>item.id===requestedId):-1;
    if(requestedId&&index<0)return json(404,{error:'Circolare non trovata'});
    const previous=index>=0?all[index]:null;
    let circular;try{circular=normalizeCircular(input,previous,user)}catch(error){return json(400,{error:error.message});}
    if(upload){
      const ext=extension(upload.name),expected=allowedFiles[ext];
      if(!expected)return json(400,{error:'Sono ammessi soltanto file PDF, DOC e DOCX.'});
      if(upload.size>4*1024*1024)return json(413,{error:'Il file supera il limite di 4 MB.'});
      circular.fileKey=fileKey(membership.code,circular.id);circular.fileName=String(upload.name).replace(/[\r\n"]/g,'').slice(0,180);circular.contentType=expected;circular.fileSize=upload.size;
      await setBlob(circular.fileKey,await upload.arrayBuffer(),{metadata:{contentType:expected,fileName:circular.fileName,schoolCode:membership.code}});
    }else if(input.removeFile===true&&circular.fileKey){await deleteJSON(circular.fileKey);circular.fileKey='';circular.fileName='';circular.contentType='';circular.fileSize=0;}
    if(!circular.fileKey&&!circular.externalUrl)return json(400,{error:'Carica un file PDF/Word oppure inserisci il link alla circolare.'});

    const storedActivities=await getJSON(activitiesKey(membership.code)),activities=Array.isArray(storedActivities)?storedActivities:[];
    const activityIndex=circular.activityId?activities.findIndex(item=>item.id===circular.activityId):-1;
    if(circular.calendarEnabled){
      const title=`${circular.number?`Circolare ${circular.number} – `:''}${circular.title}`;
      const activity=normalizeActivity({title,date:circular.calendarDate,startTime:circular.calendarStart,endTime:circular.calendarEnd,type:'Altro',description:circular.description,audienceType:circular.audienceType,teacherIds:circular.teacherIds,classNames:circular.classNames,circularId:circular.id,source:'circular'},activityIndex>=0?activities[activityIndex]:null,user);
      circular.activityId=activity.id;if(activityIndex>=0)activities[activityIndex]=activity;else activities.push(activity);
    }else if(activityIndex>=0){activities.splice(activityIndex,1);circular.activityId='';}
    await setJSON(activitiesKey(membership.code),activities);
    if(index>=0)all[index]=circular;else all.push(circular);
    if(all.length>3000)return json(409,{error:'Limite massimo di circolari raggiunto.'});
    await setJSON(listKey(membership.code),all);
    return json(200,{ok:true,circular,circulars:sortCirculars(all)});
  }catch(error){console.error('school-circulars error',error);return json(500,{error:'Errore nella gestione delle circolari',detail:String(error?.message||error)});}
};
