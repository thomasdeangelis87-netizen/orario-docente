import crypto from 'node:crypto';

const TYPES=['Collegio docenti','Dipartimento','Consiglio di classe','Riunione','Formazione','Scrutinio','Altro'];
const AUDIENCES=['all','teachers','classes'];
const clean=(value,max=240)=>String(value??'').replace(/\s+/g,' ').trim().slice(0,max);
const norm=value=>clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]/g,'');

function normalizeActivity(input={},previous=null,actor={}){
  const title=clean(input.title,160),date=clean(input.date,10),startTime=clean(input.startTime,5),endTime=clean(input.endTime,5);
  if(!title)throw new Error('Inserisci il titolo dell’impegno.');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(`${date}T00:00:00`)))throw new Error('Inserisci una data valida.');
  if(!/^\d{2}:\d{2}$/.test(startTime))throw new Error('Inserisci l’orario di inizio.');
  if(endTime&&!/^\d{2}:\d{2}$/.test(endTime))throw new Error('L’orario di fine non è valido.');
  if(endTime&&endTime<=startTime)throw new Error('L’orario di fine deve essere successivo a quello di inizio.');
  const audienceType=AUDIENCES.includes(input.audienceType)?input.audienceType:'all';
  const teacherIds=[...new Set((Array.isArray(input.teacherIds)?input.teacherIds:[]).map(x=>clean(x,120)).filter(Boolean))].slice(0,1500);
  const classNames=[...new Set((Array.isArray(input.classNames)?input.classNames:[]).map(x=>clean(x,80)).filter(Boolean))].slice(0,300);
  if(audienceType==='teachers'&&!teacherIds.length)throw new Error('Seleziona almeno un docente.');
  if(audienceType==='classes'&&!classNames.length)throw new Error('Seleziona almeno una classe o attività.');
  const now=new Date().toISOString();
  return {
    id:previous?.id||crypto.randomUUID(),title,date,startTime,endTime,
    type:TYPES.includes(input.type)?input.type:'Altro',
    location:clean(input.location,160),description:clean(input.description,1200),
    audienceType,teacherIds:audienceType==='teachers'?teacherIds:[],classNames:audienceType==='classes'?classNames:[],
    circularId:clean(input.circularId||previous?.circularId,120),source:clean(input.source||previous?.source,40),
    createdAt:previous?.createdAt||now,createdBy:previous?.createdBy||actor.id||'',
    updatedAt:now,updatedBy:actor.id||''
  };
}

function profileClassNames(profile){
  const slots=profile?.state?.slots||profile?.slots||{};
  return [...new Set(Object.values(slots).map(slot=>clean(Array.isArray(slot)?slot[0]:'',80)).filter(Boolean))];
}

function visibleTo(activity,membership,classes=[]){
  if(['admin','coordinator'].includes(membership?.role))return true;
  if(activity.audienceType==='all')return true;
  if(activity.audienceType==='teachers')return (activity.teacherIds||[]).includes(membership?.userId);
  if(activity.audienceType==='classes'){
    const mine=new Set(classes.map(norm).filter(Boolean));
    return (activity.classNames||[]).some(name=>mine.has(norm(name)));
  }
  return false;
}

function sortActivities(items=[]){
  return items.slice().sort((a,b)=>`${a.date}T${a.startTime}`.localeCompare(`${b.date}T${b.startTime}`)||a.title.localeCompare(b.title,'it'));
}

export {TYPES,AUDIENCES,normalizeActivity,profileClassNames,visibleTo,sortActivities};
