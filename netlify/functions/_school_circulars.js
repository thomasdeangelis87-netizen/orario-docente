import crypto from 'node:crypto';

const clean=(value,max=240)=>String(value??'').replace(/\s+/g,' ').trim().slice(0,max);
const allowedUrl=value=>{
  const url=clean(value,1000);
  if(!url)return'';
  try{const parsed=new URL(url);return ['http:','https:'].includes(parsed.protocol)?parsed.toString():''}catch{return''}
};

function normalizeCircular(input={},previous=null,actor={}){
  const title=clean(input.title,180),publishedDate=clean(input.publishedDate,10),number=clean(input.number,60);
  if(!title)throw new Error('Inserisci il titolo della circolare.');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(publishedDate)||Number.isNaN(Date.parse(`${publishedDate}T00:00:00`)))throw new Error('Inserisci una data di pubblicazione valida.');
  const audienceType=['all','teachers','classes'].includes(input.audienceType)?input.audienceType:'all';
  const teacherIds=[...new Set((Array.isArray(input.teacherIds)?input.teacherIds:[]).map(x=>clean(x,120)).filter(Boolean))].slice(0,1500);
  const classNames=[...new Set((Array.isArray(input.classNames)?input.classNames:[]).map(x=>clean(x,80)).filter(Boolean))].slice(0,300);
  if(audienceType==='teachers'&&!teacherIds.length)throw new Error('Seleziona almeno un docente.');
  if(audienceType==='classes'&&!classNames.length)throw new Error('Seleziona almeno una classe o attività.');
  const externalUrl=allowedUrl(input.externalUrl);
  if(clean(input.externalUrl)&&!externalUrl)throw new Error('Il link della circolare non è valido.');
  const calendarEnabled=input.calendarEnabled===true||input.calendarEnabled==='true';
  const calendarDate=clean(input.calendarDate,10),calendarStart=clean(input.calendarStart,5),calendarEnd=clean(input.calendarEnd,5);
  if(calendarEnabled){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(calendarDate))throw new Error('Inserisci la data dell’impegno da mostrare nel calendario.');
    if(!/^\d{2}:\d{2}$/.test(calendarStart))throw new Error('Inserisci l’orario dell’impegno.');
    if(calendarEnd&&(!/^\d{2}:\d{2}$/.test(calendarEnd)||calendarEnd<=calendarStart))throw new Error('L’orario finale dell’impegno non è valido.');
  }
  const now=new Date().toISOString();
  return {
    id:previous?.id||crypto.randomUUID(),number,title,publishedDate,
    description:clean(input.description,1600),externalUrl,
    audienceType,teacherIds:audienceType==='teachers'?teacherIds:[],classNames:audienceType==='classes'?classNames:[],
    fileName:previous?.fileName||'',contentType:previous?.contentType||'',fileSize:Number(previous?.fileSize)||0,fileKey:previous?.fileKey||'',
    calendarEnabled,calendarDate:calendarEnabled?calendarDate:'',calendarStart:calendarEnabled?calendarStart:'',calendarEnd:calendarEnabled?calendarEnd:'',
    activityId:previous?.activityId||'',createdAt:previous?.createdAt||now,createdBy:previous?.createdBy||actor.id||'',updatedAt:now,updatedBy:actor.id||''
  };
}

function sortCirculars(items=[]){return items.slice().sort((a,b)=>String(b.publishedDate).localeCompare(String(a.publishedDate))||String(b.createdAt).localeCompare(String(a.createdAt)))}

export {normalizeCircular,sortCirculars};
