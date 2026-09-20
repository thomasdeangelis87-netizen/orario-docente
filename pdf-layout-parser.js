const DAY_NAMES=['LUNEDI','MARTEDI','MERCOLEDI','GIOVEDI','VENERDI','SABATO'];

function norm(value){return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[’']/g,' ').replace(/[^A-Z0-9]+/gi,' ').trim().toUpperCase()}
function minutes(value){const m=String(value||'').match(/\b([01]?\d|2[0-3])\s*(?:[:hH.]\s*)?([0-5]\d)\b/);return m?Number(m[1])*60+Number(m[2]):null}
function timeStrings(value){const matches=String(value||'').match(/\b(?:[01]?\d|2[0-3])\s*(?:[:hH.]\s*)[0-5]\d\b/g)||[];return matches.map(v=>{const n=minutes(v);return `${String(Math.floor(n/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`})}
function median(values){const v=values.filter(Number.isFinite).sort((a,b)=>a-b);return v.length?v[Math.floor(v.length/2)]:0}
function groupLines(items,tolerance=3){const lines=[];items.slice().sort((a,b)=>a.y-b.y||a.x-b.x).forEach(item=>{let line=lines.find(l=>Math.abs(l.y-item.y)<=tolerance);if(!line){line={y:item.y,items:[]};lines.push(line)}line.items.push(item);line.y=(line.y*(line.items.length-1)+item.y)/line.items.length});return lines.sort((a,b)=>a.y-b.y).map(l=>({...l,items:l.items.sort((a,b)=>a.x-b.x),text:l.items.map(i=>i.str).join(' ')}))}
function tokens(value){return norm(value).split(' ').filter(t=>t.length>1)}
function profileTokens(profile){return [...new Set(tokens(profile.fullName||[profile.firstName,profile.lastName].filter(Boolean).join(' ')))]}
function detectTeacherHeader(page){const lines=groupLines(page.items),days=[];for(const line of lines){if(DAY_NAMES.some(d=>norm(line.text).replace(/ /g,'').startsWith(d)))days.push(line.y)}if(!days.length)return null;const dayY=Math.min(...days),candidates=lines.filter(line=>line.y>Math.max(0,dayY-32)&&line.y<dayY-3).map(line=>{const unique=[...new Set(line.items.map(i=>String(i.str||'').trim()).filter(Boolean))].join(' '),text=unique.replace(/\s*-\s*EDT\s*\d+.*$/i,'').replace(/\s+/g,' ').trim();return{line,text,name:norm(text)}}).filter(c=>{const ts=tokens(c.name);return ts.length>=1&&!/\d/.test(c.name)&&/[A-Z]/.test(c.name)&&c.line.items.some(i=>i.x>page.width*.18&&i.x<page.width*.82)}).sort((a,b)=>b.line.y-a.line.y);if(!candidates.length)return null;const c=candidates[0];return{name:c.text,normalized:c.name,pageNumber:page.number,y:c.line.y}}
export function listDetectedTeachers(pages){return pages.map(detectTeacherHeader).filter(Boolean)}
function tokenSimilarity(wanted,actual){if(wanted===actual)return 100;if(wanted.length===1&&actual.startsWith(wanted))return 72;if(actual.length===1&&wanted.startsWith(actual))return 72;if(Math.min(wanted.length,actual.length)>=4&&(wanted.startsWith(actual)||actual.startsWith(wanted)||wanted.endsWith(actual)||actual.endsWith(wanted)))return 82;return 0}
function headerScore(header,profile){const ht=tokens(header.normalized),first=tokens(profile.firstName||''),last=tokens(profile.lastName||'');if(!last.length){const all=profileTokens(profile);if(!all.length)return 0;const scores=all.map(w=>Math.max(0,...ht.map(a=>tokenSimilarity(w,a))));return scores.every(Boolean)?scores.reduce((a,b)=>a+b,0):0}const lastScores=last.map(w=>Math.max(0,...ht.map(a=>tokenSimilarity(w,a))));if(lastScores.some(s=>s<100))return 0;if(!first.length)return 100*last.length;const firstScore=Math.max(...first.map(w=>Math.max(0,...ht.map(a=>tokenSimilarity(w,a)))));return firstScore?100*last.length+firstScore:0}
export function resolveTeacherPage(pages,profile){const teachers=listDetectedTeachers(pages),ranked=teachers.map(t=>({...t,score:headerScore(t,profile)})).filter(t=>t.score>0).sort((a,b)=>b.score-a.score);if(!ranked.length)return{status:'not_found',teachers};const best=ranked[0],second=ranked[1];if(second&&best.score-second.score<15)return{status:'ambiguous',teachers,candidates:ranked.filter(t=>best.score-t.score<15)};return{status:'matched',pageNumber:best.pageNumber,name:best.name,score:best.score,teachers}}
function selectTeacherPage(pages,profile,pageNumber){if(pageNumber!=null){const chosen=pages.find(p=>Number(p.number)===Number(pageNumber));if(!chosen)throw new Error('La pagina docente selezionata non è disponibile.');return chosen}const match=resolveTeacherPage(pages,profile);if(match.status!=='matched')throw new Error(match.status==='ambiguous'?'La corrispondenza del docente è ambigua.':'Il docente del profilo non è stato trovato con certezza nel PDF.');return pages.find(p=>p.number===match.pageNumber)}
function findDayColumns(page,lines){const candidates=[];for(const line of lines){for(const item of line.items){const n=norm(item.str).replace(/ /g,'');const day=DAY_NAMES.findIndex(d=>n===d||n.startsWith(d));if(day>=0)candidates.push({day,x:item.x+(item.width||0)/2,y:item.y})}}const headerBand=candidates.length?median(candidates.map(c=>c.y)):0;const headers=DAY_NAMES.map((_,day)=>candidates.filter(c=>c.day===day).sort((a,b)=>Math.abs(a.y-headerBand)-Math.abs(b.y-headerBand))[0]).filter(Boolean).sort((a,b)=>a.x-b.x);if(headers.length<5)throw new Error('La pagina del docente è stata trovata, ma non riconosco le colonne dei giorni.');const bounds=headers.map((h,i)=>({day:h.day,left:i?((headers[i-1].x+h.x)/2):Math.max(0,h.x-(headers[i+1].x-h.x)/2),right:i<headers.length-1?((h.x+headers[i+1].x)/2):Math.min(page.width,h.x+(h.x-headers[i-1].x)/2),headerY:h.y}));return bounds}
function findTimeRows(page,lines,gridLeft,headerY,maxPeriods){const timeLines=[];for(const line of lines){if(line.y<=headerY+4)continue;const gutter=line.items.filter(i=>i.x+(i.width||0)/2<gridLeft-1);if(!gutter.length)continue;const raw=gutter.map(i=>i.str).join(' '),ts=timeStrings(raw);if(ts.length)timeLines.push({y:line.y,times:ts,raw})}const ranged=timeLines.filter(t=>t.times.length>=2&&minutes(t.times[1])>minutes(t.times[0])).sort((a,b)=>a.y-b.y);if(ranged.length>=2)return ranged.slice(0,maxPeriods).map((r,i)=>({period:i,top:i?((ranged[i-1].y+r.y)/2):Math.max(headerY+4,r.y-(ranged[i+1].y-r.y)/2),bottom:i<ranged.length-1?((r.y+ranged[i+1].y)/2):r.y+(r.y-ranged[i-1].y)/2,time:`${r.times[0]} – ${r.times[1]}`}));const points=timeLines.filter(t=>t.times.length===1).sort((a,b)=>a.y-b.y).filter((t,i,a)=>!i||Math.abs(t.y-a[i-1].y)>2).filter((t,i,a)=>!i||minutes(t.times[0])>minutes(a[i-1].times[0]));if(points.length>=2)return points.slice(0,maxPeriods+1).reduce((rows,p,i,a)=>{if(i<a.length-1)rows.push({period:i,top:p.y,bottom:a[i+1].y,time:`${p.times[0]} – ${a[i+1].times[0]}`});return rows},[]);const gridBottom=page.height*.94,rowHeight=(gridBottom-(headerY+4))/Math.max(6,maxPeriods);return Array.from({length:maxPeriods},(_,i)=>({period:i,top:headerY+4+i*rowHeight,bottom:headerY+4+(i+1)*rowHeight,time:''}))}
function parseClass(text){const m=String(text).match(/\b([1-5])\s*[°º^]?\s*([A-Z]{1,5})(?:\s+([A-Z]{1,3}))?\b/i);return m?`${m[1]}°${m[2].toUpperCase()}${m[3]?' '+m[3].toUpperCase():''}`:''}
function parseRoom(lines){for(const line of lines){let m=line.match(/\b(?:AULA|LABORATORIO|PALESTRA|SALA)\s*[:#-]?\s*([A-Z0-9][A-Z0-9 ._-]{0,24})/i);if(m)return m[1].trim();m=line.trim().match(/^([A-Z]\d+(?:\.\d+)+|[A-Z]\d{1,3}[A-Z]?)$/i);if(m)return m[1].toUpperCase()}return''}
function looksLikePerson(text){const clean=String(text||'').trim();return /^[A-ZÀ-ÖØ-Ý][A-ZÀ-ÖØ-Ý'.-]+(?:\s+[A-ZÀ-ÖØ-Ý][A-ZÀ-ÖØ-Ý'.-]+)*\s+[A-ZÀ-ÖØ-Ý]\.$/i.test(clean)}
function lessonFromItems(items,day,row,profile){const lines=groupLines(items,Math.max(2,median(items.map(i=>i.height))*.65)).map(l=>l.text.replace(/^[^\p{L}\p{N}]+/u,'').trim()).filter(Boolean);if(!lines.length)return null;const ownerTokens=profileTokens(profile),filtered=lines.filter(line=>{const n=norm(line),compact=n.replace(/ /g,'');return !DAY_NAMES.some(d=>compact.startsWith(d))&&!timeStrings(line).length&&!ownerTokens.every(t=>n.includes(t))});if(!filtered.length)return null;const classIndex=filtered.findIndex(line=>!!parseClass(line)),className=classIndex>=0?parseClass(filtered[classIndex]):'';const coTeachers=(classIndex>=0?filtered.slice(0,classIndex):[]).filter(looksLikePerson);let room='';if(classIndex>=0){const after=filtered.slice(classIndex+1);room=parseRoom(after)||after.filter(line=>!looksLikePerson(line)).join(' · ').trim()}else room=parseRoom(filtered);const subjectLines=(classIndex>=0?filtered.slice(0,classIndex):filtered).filter(line=>!looksLikePerson(line)&&!parseRoom([line]));const subject=subjectLines.join(' · ').replace(/\s+/g,' ').trim();if(!subject&&!className)return null;return{day,period:row.period,time:row.time,className,subject,room,coTeachers}}
function rowsCoveredByLessonBox(page,col,row,items,rows){if(!page.boxes||!page.boxes.length||!items.length)return[row];const x=median(items.map(i=>i.x+(i.width||0)/2)),y=median(items.map(i=>i.y-(i.height||0)/2)),columnWidth=col.right-col.left,rowHeight=median(rows.map(r=>r.bottom-r.top));const candidates=page.boxes.filter(b=>x>=b.left-2&&x<=b.right+2&&y>=b.top-2&&y<=b.bottom+2&&(b.right-b.left)<=columnWidth*1.15&&(b.right-b.left)>=columnWidth*.25&&(b.bottom-b.top)>=rowHeight*.65).sort((a,b)=>(a.right-a.left)*(a.bottom-a.top)-(b.right-b.left)*(b.bottom-b.top));if(!candidates.length)return[row];const box=candidates[0],covered=rows.filter(r=>{const center=(r.top+r.bottom)/2;return center>=box.top-2&&center<=box.bottom+2});return covered.length?covered:[row]}
function lessonBoxes(page,col,rows){if(!page.boxes||!page.boxes.length)return[];const rowHeight=median(rows.map(r=>r.bottom-r.top)),columnWidth=col.right-col.left,gridTop=rows[0].top,gridBottom=rows[rows.length-1].bottom;return page.boxes.filter(b=>b.left>=col.left-3&&b.right<=col.right+3&&b.top>=gridTop-3&&b.bottom<=gridBottom+3&&(b.right-b.left)>=columnWidth*.65&&(b.bottom-b.top)>=rowHeight*.55&&(b.bottom-b.top)<=rowHeight*6.1)}
function detectedSchoolPeriods(pages,maxPeriods){let last=-1;for(const page of pages){try{const lines=groupLines(page.items),columns=findDayColumns(page,lines),gridLeft=Math.min(...columns.map(c=>c.left)),headerY=median(columns.map(c=>c.headerY)),rows=findTimeRows(page,lines,gridLeft,headerY,maxPeriods);for(const col of columns)for(const box of lessonBoxes(page,col,rows))for(const row of rows){const center=(row.top+row.bottom)/2;if(center>=box.top-2&&center<=box.bottom+2)last=Math.max(last,row.period)}}catch(e){/* una pagina non riconoscibile non deve bloccare le altre */}}return last+1}
function parseTeacherPage(pages,page,profile,maxPeriods,knownSchoolPeriods){const lines=groupLines(page.items),columns=findDayColumns(page,lines),gridLeft=Math.min(...columns.map(c=>c.left)),headerY=median(columns.map(c=>c.headerY)),allRows=findTimeRows(page,lines,gridLeft,headerY,maxPeriods),schoolPeriods=knownSchoolPeriods==null?detectedSchoolPeriods(pages,maxPeriods):knownSchoolPeriods,rows=schoolPeriods?allRows.slice(0,schoolPeriods):allRows,lessons=[],seen=new Set();for(const col of columns){for(const box of lessonBoxes(page,col,rows)){const items=page.items.filter(i=>{const cx=i.x+(i.width||0)/2,cy=i.y-(i.height||0)/2;return cx>box.left&&cx<box.right&&cy>box.top&&cy<box.bottom});const covered=rows.filter(r=>{const center=(r.top+r.bottom)/2;return center>=box.top-2&&center<=box.bottom+2});if(!covered.length)continue;const lesson=lessonFromItems(items,col.day,covered[0],profile);if(!lesson)continue;for(const r of covered){const key=`${col.day}-${r.period}`;if(!seen.has(key)){seen.add(key);lessons.push({...lesson,period:r.period,time:r.time})}}}for(const row of rows){const key=`${col.day}-${row.period}`;if(seen.has(key))continue;const items=page.items.filter(i=>{const cx=i.x+(i.width||0)/2,cy=i.y-(i.height||0)/2;return cx>=col.left&&cx<col.right&&cy>row.top&&cy<row.bottom});const lesson=lessonFromItems(items,col.day,row,profile);if(!lesson)continue;for(const covered of rowsCoveredByLessonBox(page,col,row,items,rows)){const k=`${col.day}-${covered.period}`;if(seen.has(k))continue;seen.add(k);lessons.push({...lesson,period:covered.period,time:covered.time})}}}return{pageNumber:page.number,lessons,periodTimes:rows.map(r=>r.time),detectedMaxPeriods:rows.length}}

export function parseIndexEducationPages(pages,profile,options={}){if(!Array.isArray(pages)||!pages.length)throw new Error('Il PDF non contiene pagine leggibili.');const maxPeriods=Math.max(1,Number(options.maxPeriods)||10),page=selectTeacherPage(pages,profile,options.pageNumber);return parseTeacherPage(pages,page,profile,maxPeriods)}

export function parseIndexEducationSchoolPages(pages,options={}){
 if(!Array.isArray(pages)||!pages.length)throw new Error('Il PDF non contiene pagine leggibili.');
 const maxPeriods=Math.max(1,Number(options.maxPeriods)||10),headers=listDetectedTeachers(pages);
 if(!headers.length)throw new Error('Non riesco a rilevare le intestazioni dei docenti nel PDF.');
 const schoolPeriods=detectedSchoolPeriods(pages,maxPeriods),teachers=[],entries=[],classCells=[],failures=[];let detectedTimes=[];
 for(const header of headers){
  const page=pages.find(p=>Number(p.number)===Number(header.pageNumber));
  if(!page)continue;
  try{
   const profile={fullName:header.name};
   const result=parseTeacherPage(pages,page,profile,maxPeriods,schoolPeriods);
   if(!detectedTimes.length&&result.periodTimes.some(Boolean))detectedTimes=result.periodTimes.slice();
   if(!result.lessons.length){failures.push({pageNumber:page.number,name:header.name});continue}
   const subject=[...new Set(result.lessons.map(l=>l.subject).filter(Boolean))].join(' / ');
   teachers.push({name:header.name,subject});
   for(const lesson of result.lessons){
    const activity=lesson.className||lesson.subject||'Lezione',period=lesson.period+1;
    entries.push({teacher:header.name,subject:lesson.subject||'',day:lesson.day,period,time:lesson.time||'',activity,room:lesson.room||'',coTeachers:lesson.coTeachers||[]});
    if(lesson.className)classCells.push({className:lesson.className,day:lesson.day,period,time:lesson.time||'',teacher:header.name,subject:lesson.subject||'',room:lesson.room||''});
   }
  }catch(e){failures.push({pageNumber:page.number,name:header.name,error:String(e?.message||e)})}
 }
 if(!entries.length)throw new Error('Il PDF è stato letto, ma non trovo lezioni nelle pagine dei docenti.');
 const periodTimes={};for(let d=0;d<6;d++)periodTimes[d]=detectedTimes.slice();
 return{teachers,entries,classCells,maxPeriods:Math.max(1,schoolPeriods||Math.max(...entries.map(e=>e.period))),periodTimes,failures,pagesAnalyzed:headers.length};
}

// Timetables exported as one wide matrix: teachers on rows and one column for
// each period (typically 5 days x 5 periods). This is deliberately separate
// from the Index Education page-per-teacher parser above.
function matrixCellBounds(centers,index,step){const center=centers[index];return{left:index?((centers[index-1]+center)/2):center-step/2,right:index<centers.length-1?((center+centers[index+1])/2):center+step/2}}
function hasMatrixVerticalBoundary(page,x,top,bottom,step){const tolerance=Math.max(1.5,step*.08),mid=(top+bottom)/2;return(page.lines||[]).some(line=>{const x1=Number(line.x1),x2=Number(line.x2),y1=Number(line.y1),y2=Number(line.y2);if(![x1,x2,y1,y2].every(Number.isFinite)||Math.abs(x1-x2)>1.5)return false;return Math.abs((x1+x2)/2-x)<=tolerance&&Math.min(y1,y2)<=mid+1&&Math.max(y1,y2)>=mid-1})}
function matrixMergedColumns(page,column,centers,periodsPerDay,step,top,bottom){if(!page.lines?.length)return[column];const dayStart=Math.floor(column/periodsPerDay)*periodsPerDay,dayEnd=dayStart+periodsPerDay-1;let start=column,end=column;while(start>dayStart){const boundary=(centers[start-1]+centers[start])/2;if(hasMatrixVerticalBoundary(page,boundary,top,bottom,step))break;start--}while(end<dayEnd){const boundary=(centers[end]+centers[end+1])/2;if(hasMatrixVerticalBoundary(page,boundary,top,bottom,step))break;end++}return Array.from({length:end-start+1},(_,i)=>start+i)}
export function parseTeacherMatrixSchoolPages(pages,options={}){
 if(!Array.isArray(pages)||!pages.length)throw new Error('Il PDF non contiene pagine leggibili.');
 const maxPeriods=Math.max(1,Number(options.maxPeriods)||10),teachersMap=new Map(),entries=[],classCells=[];
 for(const page of pages){
  const lines=groupLines(page.items,2.5),docHeader=page.items.find(i=>norm(i.str)==='DOCENTE'&&i.x<page.width*.12);
  if(!docHeader)continue;
  const dayHeaders=page.items.map(i=>({item:i,day:DAY_NAMES.findIndex(d=>norm(i.str).replace(/ /g,'').startsWith(d))})).filter(x=>x.day>=0);
  if(dayHeaders.length<5)continue;
  const headerBottom=Math.max(docHeader.y,...dayHeaders.map(x=>x.item.y))+18;
  const hourItems=page.items.filter(i=>i.y<=headerBottom&&i.x>page.width*.055&&/^\s*\d{1,2}\s*[ªºa]?\s*$/i.test(i.str)).sort((a,b)=>a.x-b.x);
  const centers=[];for(const item of hourItems){const x=item.x+(item.width||0)/2;if(!centers.some(v=>Math.abs(v-x)<3))centers.push(x)}
  if(centers.length<10||centers.length%dayHeaders.length!==0)continue;
  const periodsPerDay=Math.min(maxPeriods,Math.round(centers.length/dayHeaders.length));
  const usedCenters=centers.slice(0,periodsPerDay*dayHeaders.length),first=usedCenters[0],step=median(usedCenters.slice(1).map((x,i)=>x-usedCenters[i]));
  const gutterRight=first-step*.52;
  const teacherLines=lines.filter(l=>l.y>headerBottom&&l.items.some(i=>i.x<gutterRight)).map(l=>({y:l.y,name:l.items.filter(i=>i.x<gutterRight).map(i=>i.str).join(' ').replace(/\s+/g,' ').trim()})).filter(x=>x.name&&/[A-ZÀ-ÖØ-Ý]/i.test(x.name));
  for(let r=0;r<teacherLines.length;r++){
   const row=teacherLines[r],top=r?((teacherLines[r-1].y+row.y)/2):headerBottom,bottom=r<teacherLines.length-1?((row.y+teacherLines[r+1].y)/2):Math.min(page.height,row.y+(row.y-(teacherLines[r-1]?.y||headerBottom))/2);
   const key=norm(row.name);if(!teachersMap.has(key))teachersMap.set(key,{name:row.name,subject:''});
   const occupied=new Set();
   for(let c=0;c<usedCenters.length;c++){
    if(occupied.has(c))continue;
    const initial=matrixCellBounds(usedCenters,c,step),initialItems=page.items.filter(i=>{const x=i.x+(i.width||0)/2,y=i.y-(i.height||0)/2;return x>=initial.left&&x<initial.right&&y>top&&y<bottom});
    if(!initialItems.length)continue;
    const covered=matrixMergedColumns(page,c,usedCenters,periodsPerDay,step,top,bottom),firstCovered=matrixCellBounds(usedCenters,covered[0],step),lastCovered=matrixCellBounds(usedCenters,covered[covered.length-1],step);
    const cellLines=groupLines(page.items.filter(i=>{const x=i.x+(i.width||0)/2,y=i.y-(i.height||0)/2;return x>=firstCovered.left&&x<lastCovered.right&&y>top&&y<bottom}),2.5).map(l=>l.text.trim()).filter(Boolean);
    if(!cellLines.length)continue;
    const classLine=cellLines.find(v=>/^\s*[1-5]\s*[A-Z]{1,4}(?:\s+[A-Z]{1,3})?\s*$/i.test(v));
    const className=classLine?classLine.replace(/\s+/g,'').toUpperCase():'';
    const nonClass=cellLines.filter(v=>v!==classLine),raw=nonClass.join(' · ').trim();
    if(!raw&&!className)continue;
    const availability=/\bDISP(?:ONIBILITA)?\.?\b/i.test(raw),activity=className||(availability?'DISPOSIZIONE':raw),subject=availability?'DISPOSIZIONE':raw;
    for(const column of covered){occupied.add(column);const day=Math.floor(column/periodsPerDay),period=column%periodsPerDay+1;entries.push({teacher:row.name,subject,day,period,time:'',activity,room:'',coTeachers:[]});if(className)classCells.push({className,day,period,time:'',teacher:row.name,subject,room:''})}
   }
  }
 }
 if(!entries.length)throw new Error('Il PDF è stato letto, ma non riconosco lezioni nella matrice docenti.');
 for(const teacher of teachersMap.values())teacher.subject=[...new Set(entries.filter(e=>norm(e.teacher)===norm(teacher.name)).map(e=>e.subject).filter(Boolean))].join(' / ');
 return{teachers:[...teachersMap.values()],entries,classCells,maxPeriods:Math.max(...entries.map(e=>e.period)),periodTimes:{},failures:[],pagesAnalyzed:pages.length,matrixFormat:true};
}

export const _test={norm,minutes,timeStrings,groupLines,detectTeacherHeader,headerScore,selectTeacherPage,findDayColumns,findTimeRows,detectedSchoolPeriods,parseClass,parseRoom,matrixMergedColumns};
