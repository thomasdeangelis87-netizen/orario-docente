(function(root){
 function clean(value){return String(value??'').trim().replace(/\s+/g,' ')}
 function normalized(entries){
  return (entries||[]).map(e=>({day:Number(e.day),period:Number(e.period),activity:clean(e.activity),subject:clean(e.subject),teacher:clean(e.teacher),time:clean(e.time),room:clean(e.room),coTeachers:(Array.isArray(e.coTeachers)?e.coTeachers:[]).map(clean),sourceLines:(Array.isArray(e.sourceLines)?e.sourceLines:[]).map(clean)}))
    .sort((a,b)=>a.day-b.day||a.period-b.period||JSON.stringify(a).localeCompare(JSON.stringify(b)));
 }
 function fingerprint(entries){return JSON.stringify(normalized(entries))}
 function changes(before,after){
  const old=normalized(before),next=normalized(after);
  const key=e=>`${e.day}-${e.period}:${e.teacher}:${e.activity}:${e.subject}:${e.time}:${e.room}:${e.coTeachers.join('|')}:${e.sourceLines.join('|')}`;
  const existing=new Set(old.map(key)),current=new Set(next.map(key));
  return {added:next.filter(e=>!existing.has(key(e))),removed:old.filter(e=>!current.has(key(e)))};
 }
 root.OrarioSchoolUpdate={fingerprint,changes};
})(typeof window!=='undefined'?window:globalThis);
