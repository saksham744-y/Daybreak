/*PARSER_START*/
const SAMPLE = `school 7:30 to 1 pm
i have to go at 7

redy start from 6+ - 6:10

wake up at 4 +  - 4:30    -> math (Olympiad)        + 1:30 hr

-+ 1:45 home
- 2 : 30  all done
 |
 v
++ physics , pw class , chemistry        +2 hr
4 : 20 to 6: 10 coaching

6 :  10 to 6: 30 fun

7 to 8 :30 class
8 30 to 9 dinner
9 to 10 subjective        + 1hr

===========================================================
total ++        4 : 30 hr`;

const uid=()=>Math.random().toString(36).slice(2,9);
const fmt=m=>{m=((Math.round(m)%1440)+1440)%1440;let hh=Math.floor(m/60);const mm=m%60;const ap=hh>=12?'PM':'AM';hh=hh%12||12;return hh+':'+String(mm).padStart(2,'0')+' '+ap;};
const fmtDur=m=>{m=Math.round(m);if(m<=0)return '';const hh=Math.floor(m/60),mm=m%60;return [hh?hh+' hr':'',mm?mm+' min':''].filter(Boolean).join(' ');};

const MORNING=/\b(wake|wakeup|ready|redy|get up|brush|bath|breakfast|school|bus|leave|go|morning|assembly)\b/i;
const EVENING=/\b(dinner|supper|night|evening|sleep|bed)\b/i;

function parseDuration(text){
  const re=/(?<![\d:])\+?\s*(\d+)(?:\s*:\s*(\d{1,2}))?\s*(hours?|hrs?|h|minutes?|mins?)\b/i;
  const m=re.exec(text);
  if(!m) return {min:null,rest:text};
  const isHour=m[3][0].toLowerCase()==='h';
  const min=isHour?(+m[1])*60+(m[2]?+m[2]:0):+m[1];
  return {min,rest:text.slice(0,m.index)+' '+text.slice(m.index+m[0].length)};
}

function findTimes(text){
  const re=/(?<![\d:.])(\d{1,2})(?:\s*:\s*(\d{2})|\s+([0-5]\d)(?!\d))?(?:\s*(a\.?m\.?|p\.?m\.?)(?![a-z]))?/gi;
  const out=[];let m;
  while((m=re.exec(text))){
    const h=+m[1];
    const mi=m[2]!=null?+m[2]:(m[3]!=null?+m[3]:0);
    let ap=m[4]?m[4][0].toLowerCase()+'m':null;
    const before=text.slice(0,m.index);
    const after=text.slice(m.index+m[0].length);
    const ok=m[2]!=null||m[3]!=null||ap
      ||/(?:\b(?:at|from|to|till|until|by|upto)|@|[-–—>])\s*$/i.test(before)
      ||/^\s*(?:to\b|till\b|until\b|[-–—])\s*\d/i.test(after);
    if(!ok||h>23||mi>59) continue;
    if(h===0||h>12) ap='24';
    out.push({h,m:mi,ap,idx:m.index,len:m[0].length});
  }
  return out;
}

function cleanTitle(s){
  s=s.replace(/\s+/g,' ').trim();
  for(let i=0;i<4;i++){
    s=s.replace(/^[\s,;:.\-–—]+|[\s,;:.\-–—]+$/g,'')
       .replace(/^(?:at|from|to|till|until|by)\s+/i,'')
       .replace(/\s+(?:at|from|to|till|until|by)$/i,'')
       .replace(/^(?:at|from|to|till|until|by)$/i,'');
  }
  s=s.replace(/^(?:i|we)\s+(?:have|need|want)\s+to\s+/i,'').replace(/^(?:i|we)\s+(?:must|should|will)\s+/i,'');
  return s.trim();
}

function niceTitle(t){
  const k=t.toLowerCase().replace(/\s+/g,' ').trim();
  if(/^(?:redy|ready)(?: start)?$/.test(k)) return 'Get ready';
  if(/^(?:go|leave)$/.test(k)) return 'Leave home';
  if(k==='home') return 'Reach home';
  t=t.replace(/\bredy\b/gi,'ready').replace(/\bpw\b/gi,'PW');
  return t.charAt(0).toUpperCase()+t.slice(1);
}

function kindOf(t){
  t=t.toLowerCase();
  if(/\b(dinner|lunch|breakfast|snack|tiffin|meal)\b/.test(t)) return 'meal';
  if(/\b(fun|break|play|game|games|relax|rest|walk|tv|chill|music)\b/.test(t)) return 'break';
  if(/\b(wake|ready|home|leave|bath|sleep|bed|done|brush)\b/.test(t)) return 'routine';
  if(/(math|physics|chem|bio|science|olympiad|study|revis|homework|practice|subjective|reading|notes|problem|solve|assignment|test|exam)/.test(t)) return 'study';
  if(/(school|class|coaching|tuition|lecture|lab|college|session)/.test(t)) return 'class';
  return 'other';
}

function cands(t){
  if(t.ap==='24') return [t.h*60+t.m];
  const b=(t.h%12)*60+t.m;
  if(t.ap==='am') return [b];
  if(t.ap==='pm') return [b+720];
  return [b,b+720];
}
function resolveOne(t,hint,prevEnd){
  let cs=cands(t);
  if(t.ap==null&&hint){ const b=(t.h%12)*60+t.m; cs=[hint==='am'?b:b+720]; }
  if(cs.length===1) return cs[0];
  if(prevEnd!=null){
    const ok=cs.filter(c=>c>=prevEnd-30);
    return ok.length?Math.min(...ok):Math.min(...cs);
  }
  const mer=(t.h===12||(t.h>=1&&t.h<=3))?1:0;
  return cs[mer];
}
function resolveRange(a,b,hint,prevEnd){
  let s,e;
  if(a.ap==null&&b.ap!=null){
    e=cands(b)[0];
    const cs=cands(a).filter(c=>c<e);
    s=cs.length?Math.max(...cs):Math.min(...cands(a));
  }else{
    s=resolveOne(a,hint,prevEnd);
    const eb=cands(b); const cs=eb.filter(c=>c>s);
    e=cs.length?Math.min(...cs):Math.min(...eb)+1440;
  }
  return [s,e];
}

function parsePart(p){
  p=p.replace(/[+|]/g,' ');
  const times=findTimes(p);
  let s=p;
  for(let i=times.length-1;i>=0;i--) s=s.slice(0,times[i].idx)+' '+s.slice(times[i].idx+times[i].len);
  return {times:times.slice(0,2),title:cleanTitle(s)};
}

function buildTask(seg,dur,prevEnd){
  if(seg.title.length<2&&!seg.times.length) return null;
  const raw=seg.title||'Task';
  const low=raw.toLowerCase();
  const hint=MORNING.test(low)?'am':(EVENING.test(low)?'pm':null);
  const tm=seg.times;
  let start,end,flag='';
  if(tm.length>=2){ [start,end]=resolveRange(tm[0],tm[1],hint,prevEnd); }
  else if(tm.length===1){ start=resolveOne(tm[0],hint,prevEnd); end=start+(dur||0); }
  else{
    if(prevEnd!=null) start=prevEnd; else { start=540; flag='No time found, so 9:00 AM was used.'; }
    end=start+(dur||30);
    if(dur==null) flag=(flag?flag+' ':'')+'No length found, so 30 min was used.';
  }
  const parts=raw.split(/\s*,\s*/).filter(Boolean);
  let title,subs=[];
  if(parts.length>=2&&parts.length<=8){
    const nice=parts.map(niceTitle);
    title=nice.join(' · ');
    subs=nice.map(t=>({id:uid(),title:t}));
  }else title=niceTitle(raw);
  const kind=kindOf(title);
  const focus=kind==='study'?(dur!=null?dur:Math.max(0,end-start)):0;
  return {id:uid(),title,start,end,kind,focus,subs,flag};
}

function parseSummary(src){
  const tasks=[];let total=null;let prevEnd=null;
  for(const rawLine of String(src).split(/\r?\n/)){
    let line=rawLine.replace(/[=_~]{3,}/g,' ');
    if(/^\W*total\b/i.test(line)){ const d=parseDuration(line).min; if(d!=null) total=d; continue; }
    line=line.replace(/^[\s\-+*•>|=~#.]+/,'');
    if(!line.trim()) continue;
    const du=parseDuration(line); const dur=du.min; line=du.rest;
    const segs=line.split(/\s*(?:-+>|=+>|→)\s*/).map(parsePart);
    for(let i=0;i<segs.length-1;i++){
      if(!segs[i].title&&segs[i].times.length&&!segs[i+1].times.length){ segs[i+1].times=segs[i].times; segs[i].times=[]; }
    }
    const real=segs.filter(s=>s.title||s.times.length);
    real.forEach((seg,i)=>{
      const t=buildTask(seg,i===real.length-1?dur:null,prevEnd);
      if(!t) return;
      tasks.push(t); prevEnd=t.end;
    });
  }
  return {tasks,total};
}
/*PARSER_END*/
