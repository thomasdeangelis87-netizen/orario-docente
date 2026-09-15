import {scheduleVersion} from './_schedule-version.js';

// The schedule is site-scoped and identified solely by the accredited school code.
export const scheduleKey=code=>`schedules/${String(code).trim().toUpperCase()}`;

export async function getOfficialSchedule(code, read){
  const value=await read(scheduleKey(code));
  if(value?.schoolCode && value.schoolCode!==code)
    throw new Error('School schedule ownership mismatch');
  return value||null;
}

export async function publishOfficialSchedule({code, body, read, write, now=()=>new Date().toISOString()}){
  const data=body?.schedule;
  if(!data||!Array.isArray(data.entries)||!Array.isArray(data.teachers))
    return {status:400,error:'Formato orario non valido'};
  if(data.entries.length>50000||data.teachers.length>5000)
    return {status:413,error:'Orario troppo grande'};
  // A failed read never counts as an empty store. Never write before reading.
  const previous=await getOfficialSchedule(code,read);
  const publish=body.publish===true;
  if(!publish&&!previous)return {status:409,error:'Carica prima un orario completo.'};
  const version=scheduleVersion(previous,publish);
  const validFrom=publish?String(body.validFrom||'').trim().slice(0,32):String(previous.validFrom||'');
  const timestamp=now();
  const {cloudUpdatedBy:ignored, ...schedule}=data;
  const clean={...schedule,schoolCode:code,version,validFrom,publishedAt:publish?timestamp:(previous?.publishedAt||''),cloudUpdatedAt:timestamp};
  await write(scheduleKey(code),clean);
  const verified=await getOfficialSchedule(code,read);
  if(!verified||verified.version!==version||verified.cloudUpdatedAt!==timestamp||verified.entries?.length!==clean.entries.length||verified.teachers?.length!==clean.teachers.length)
    throw new Error('School schedule readback mismatch');
  return {status:200,ok:true,schoolCode:code,storageScope:'site',entries:verified.entries.length,teachers:verified.teachers.length,updatedAt:timestamp,version,validFrom,publishedAt:clean.publishedAt};
}
