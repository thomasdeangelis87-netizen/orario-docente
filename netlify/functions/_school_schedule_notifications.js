import {getJSON,setJSON} from './_lib.js';
import {sendSchoolScheduleUpdateEmail} from './_brevo.js';

const clean=value=>String(value??'').trim().replace(/\s+/g,' ');
const norm=value=>clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();
const profileKey=userId=>`profiles-by-user/${encodeURIComponent(String(userId||''))}`;
const markerKey=(code,version,userId)=>`schedule-update-emails/${String(code).toUpperCase()}/${Number(version)}/${encodeURIComponent(String(userId||''))}`;

function teacherLabelContains(label,teacher){
  const target=norm(teacher),whole=norm(label);
  if(!target||!whole)return false;
  if(whole===target)return true;
  return String(label||'').split(/\s*(?:\+|\/|&|;|\n)\s*/).map(norm).filter(Boolean).includes(target);
}

export function teacherEntries(entries,teacher){
  return (entries||[]).filter(entry=>teacherLabelContains(entry.teacher,teacher));
}

export function scheduleFingerprint(entries){
  return JSON.stringify((entries||[]).map(entry=>({
    day:Number(entry.day),period:Number(entry.period),activity:clean(entry.activity),subject:clean(entry.subject),
    teacher:clean(entry.teacher),time:clean(entry.time),room:clean(entry.room)
  })).sort((a,b)=>a.day-b.day||a.period-b.period||JSON.stringify(a).localeCompare(JSON.stringify(b))));
}

export async function notifyChangedTeachers({code,school,schedule,read=getJSON,write=setJSON,send=sendSchoolScheduleUpdateEmail,now=()=>new Date().toISOString()}){
  const version=Number(schedule?.version)||0;
  if(!version||!Array.isArray(schedule?.entries))return {eligible:0,sent:0,failed:0,skipped:0};
  const members=(await read(`school-members/${String(code).toUpperCase()}`))||[];
  const active=members.filter(member=>member?.status==='active'&&member.userId&&String(member.email||'').includes('@'));
  const result={eligible:0,sent:0,failed:0,skipped:0};

  for(const member of active){
    try{
      const marker=await read(markerKey(code,version,member.userId));
      if(marker){result.skipped++;continue}
      const profile=await read(profileKey(member.userId));
      const meta=profile?.state?.meta||{};
      const teacher=clean(meta.schoolTeacherName||'');
      const previousVersion=Number(meta.schoolScheduleVersion)||0;
      const previousFingerprint=clean(meta.schoolScheduleFingerprint)||scheduleFingerprint(meta.schoolScheduleEntries||[]);
      if(!teacher||!previousVersion||previousVersion>=version||!previousFingerprint){result.skipped++;continue}
      const latest=scheduleFingerprint(teacherEntries(schedule.entries,teacher));
      if(latest===previousFingerprint){result.skipped++;continue}
      result.eligible++;
      await send({to:member.email,schoolName:school?.name||meta.school||'la tua scuola',validFrom:schedule.validFrom||'',contactName:clean(meta.firstName||profile.fullName||'')});
      await write(markerKey(code,version,member.userId),{schoolCode:String(code).toUpperCase(),version,userId:member.userId,sentAt:now()});
      result.sent++;
    }catch(error){
      result.failed++;
      console.error('school schedule update email failed',{schoolCode:String(code).toUpperCase(),version,userId:member.userId,code:error?.code||'',message:String(error?.message||error).slice(0,180)});
    }
  }
  console.info('school schedule update notifications',{schoolCode:String(code).toUpperCase(),version,...result});
  return result;
}

export const schoolScheduleNotificationKeys={profileKey,markerKey};
