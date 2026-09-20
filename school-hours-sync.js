(function(root){
 function clean(value){return String(value??'').trim().replace(/\s+/g,' ')}
 function normalizedHours(school){
  const times={};
  for(let day=0;day<6;day++)times[day]=Array.isArray(school?.periodTimes?.[day])?school.periodTimes[day].map(clean):[];
  const breaks={};
  for(let day=0;day<6;day++)breaks[day]=Array.isArray(school?.breaks?.[day])?school.breaks[day].map(item=>({enabled:item?.enabled!==false,start:clean(item?.start),end:clean(item?.end)})):[];
  return {maxPeriods:Number(school?.maxPeriods)||0,periodTimes:times,breaks};
 }
 function fingerprint(school){return JSON.stringify(normalizedHours(school))}
 function eligible(state,school){
  const meta=state?.meta||{};
  if(!meta.schoolCode||!meta.schoolTeacherName||!Number(meta.schoolScheduleVersion))return false;
  return !school?.schoolCode||clean(school.schoolCode).toUpperCase()===clean(meta.schoolCode).toUpperCase();
 }
 function apply(state,school){
  if(!eligible(state,school))return {eligible:false,changed:false,timeChanged:false,fingerprint:''};
  const nextFingerprint=fingerprint(school),meta=state.meta;
  let changed=meta.schoolHoursFingerprint!==nextFingerprint,timeChanged=false;
  Object.entries(state.slots||{}).forEach(([key,value])=>{
   if(!Array.isArray(value)||!value[0])return;
   const [day,period]=key.split('-').map(Number);
   const next=clean(school?.periodTimes?.[day]?.[period]);
   if(!next||clean(value[1])===next)return;
   value[1]=next;changed=true;timeChanged=true;
  });
  meta.schoolHoursFingerprint=nextFingerprint;
  meta.schoolHoursUpdatedAt=clean(school?.cloudUpdatedAt||school?.updatedAt||'');
  return {eligible:true,changed,timeChanged,fingerprint:nextFingerprint};
 }
 root.OrarioSchoolHoursSync={fingerprint,apply};
})(typeof window!=='undefined'?window:globalThis);
