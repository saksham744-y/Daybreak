(function(){
'use strict';

/* ---------- constants ---------- */
const KEY='daybreak.planner.v1';
const GUIDE_KEY='daybreak.guide.seen';
const ALL=[0,1,2,3,4,5,6];
const WEEK_ORDER=[1,2,3,4,5,6,0];
const DAY_SHORT=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const DAY_LONG=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
const KIND_LABEL={study:'Study',class:'Class',meal:'Meal',break:'Break',routine:'Routine',other:'Other'};
const KINDS=Object.keys(KIND_LABEL);
const DEFAULT_SUMMARY='wake up 9 am\nsleep 8 pm';
const TEST_TEXT='This is test notification send by dayBreak';
const LEADS=[0,5,10,15,30];
const TAB_IDS=['add','day','function'];
const TABS=[['add','Add'],['day','Day'],['function','Function']];
const ACCENTS=[
  {name:'Blue',light:'#2646DB',lightSoft:'#E2E7FE',dark:'#8FA2FF',darkSoft:'#1E2A57'},
  {name:'Teal',light:'#0C8577',lightSoft:'#D6F3EF',dark:'#3CC6B7',darkSoft:'#123530'},
  {name:'Violet',light:'#6D45D6',lightSoft:'#EBE4FB',dark:'#B9A0F5',darkSoft:'#2B2250'},
  {name:'Rose',light:'#C2377A',lightSoft:'#FBE0EE',dark:'#F27AB1',darkSoft:'#45182F'},
  {name:'Orange',light:'#C2570C',lightSoft:'#FDE9D4',dark:'#F0A25C',darkSoft:'#3F2410'}
];
/* Twelve tick/untick sounds, made with the Web Audio API (nothing is downloaded). */
const SOUNDS=[
  {name:'Pop',type:'sine',base:700,ms:120,glide:1.15,decay:3,harm:[]},
  {name:'Soft',type:'triangle',base:600,ms:160,glide:1.10,decay:3,harm:[]},
  {name:'Bubble',type:'sine',base:420,ms:150,glide:1.35,decay:4,harm:[]},
  {name:'Click',type:'square',base:1200,ms:60,glide:1,decay:0,harm:[],lp:1800},
  {name:'Bell',type:'sine',base:880,ms:380,glide:1.02,decay:3.5,harm:[[2.4,0.4],[5.1,0.15]]},
  {name:'Chime',type:'sine',base:1320,ms:520,glide:1.02,decay:3,harm:[[2.4,0.4],[5.1,0.15]]},
  {name:'Marimba',type:'sine',base:660,ms:240,glide:1.03,decay:6,harm:[[4,0.25]]},
  {name:'Wood',type:'sine',base:330,ms:180,glide:1.05,decay:8,harm:[[4,0.25]]},
  {name:'Blip',type:'square',base:990,ms:85,glide:1.05,decay:4,harm:[],lp:2000},
  {name:'Harp',type:'triangle',base:784,ms:320,glide:1.04,decay:4,harm:[]},
  {name:'Glass',type:'sine',base:1760,ms:280,glide:1.02,decay:5,harm:[[2.4,0.4]]},
  {name:'Drop',type:'sine',base:1000,ms:200,glide:1.6,decay:3,harm:[]}
];
const CHECK='<svg viewBox="0 0 16 16" aria-hidden="true"><path class="ck" pathLength="1" d="M3 8.5l3.2 3.2L13 5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const CHEV='<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const EMPTY={done:{},subs:{},extra:{},notes:{},skip:{}};

/* ---------- helpers ---------- */
const $=s=>document.querySelector(s);
const sum=a=>a.reduce((x,y)=>x+y,0);
const byTime=(a,b)=>a.start-b.start||a.end-b.end;
const ico=s=>{const t=document.createElement('template');t.innerHTML=s.trim();return t.content.firstChild;};
function h(tag,attrs,...kids){
  const e=document.createElement(tag);
  if(attrs) for(const [k,v] of Object.entries(attrs)){
    if(v==null||v===false) continue;
    if(k==='class') e.className=v;
    else if(k.startsWith('on')&&typeof v==='function') e.addEventListener(k.slice(2),v);
    else if(v===true) e.setAttribute(k,'');
    else e.setAttribute(k,v);
  }
  for(const kid of kids.flat()){
    if(kid==null||kid===false) continue;
    e.append(kid.nodeType?kid:document.createTextNode(String(kid)));
  }
  return e;
}
const dkey=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const todayKey=()=>dkey(new Date());
const startOfDay=d=>{const x=new Date(d);x.setHours(0,0,0,0);return x;};
const addDays=(d,n)=>{const x=new Date(d);x.setDate(x.getDate()+n);return x;};
const weekStart=d=>addDays(startOfDay(d),-((d.getDay()+6)%7));
const toIn=m=>{m=((m%1440)+1440)%1440;return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');};
const fromIn=s=>{const p=String(s).split(':').map(Number);return ((p[0]||0)*60+(p[1]||0))%1440;};
const defaultStart=()=>{const n=new Date();return (Math.ceil((n.getHours()*60+n.getMinutes())/5)*5)%1440;};
const curKey=()=>dkey(ui.date);
const leadLabel=()=>state.remind.lead===0?'at start':state.remind.lead+' min before';
const isEditing=()=>{const a=document.activeElement;return !!a&&/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName);};
function daysLabel(ds){
  const set=new Set(ds);
  if(set.size===7) return 'Every day';
  if(set.size===0) return 'Not scheduled';
  if(set.size===6&&!set.has(0)) return 'Mon–Sat';
  if(set.size===5&&!set.has(0)&&!set.has(6)) return 'Weekdays';
  if(set.size===2&&set.has(0)&&set.has(6)) return 'Weekends';
  return WEEK_ORDER.filter(d=>set.has(d)).map(d=>DAY_SHORT[d]).join(', ');
}
const mq=window.matchMedia('(prefers-color-scheme: dark)');
const isStandalone=()=>window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
const isIOS=()=>/iphone|ipad|ipod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const canUseSW=()=>'serviceWorker' in navigator&&(location.protocol==='https:'||location.hostname==='localhost'||location.hostname==='127.0.0.1');

/* ---------- state ---------- */
function freshState(){
  const p=parseSummary(DEFAULT_SUMMARY);
  return {v:2,summary:DEFAULT_SUMMARY,days:[...ALL],total:p.total,tasks:p.tasks.map(t=>({...t,days:[...ALL]})),dates:{},dayNotes:{},
    remind:{on:true,lead:5,sound:true,system:false,awake:false},
    settings:{theme:'system',accent:0,haptics:true,tickSound:true,tickIdx:0,untickIdx:1},fired:{}};
}
function load(){
  try{
    const raw=localStorage.getItem(KEY); if(!raw) return null;
    const s=JSON.parse(raw);
    if(s&&Array.isArray(s.tasks)&&s.dates&&typeof s.dates==='object') return s;
  }catch(e){}
  return null;
}
function normalize(){
  if(!Array.isArray(state.days)||!state.days.length) state.days=[...ALL];
  if(typeof state.summary!=='string') state.summary=DEFAULT_SUMMARY;
  if(!state.dayNotes||typeof state.dayNotes!=='object') state.dayNotes={};
  state.remind=Object.assign({on:true,lead:5,sound:true,system:false,awake:false},state.remind||{});
  state.settings=Object.assign({theme:'system',accent:0,haptics:true,tickSound:true,tickIdx:0,untickIdx:1},state.settings||{});
  const todayK=todayKey(),fired={};
  if(state.fired&&typeof state.fired==='object') for(const k of Object.keys(state.fired)) if(k.startsWith(todayK)) fired[k]=1;
  state.fired=fired;
  state.tasks=(Array.isArray(state.tasks)?state.tasks:[]).map(t=>({...t,
    days:Array.isArray(t.days)?t.days:[...ALL],subs:Array.isArray(t.subs)?t.subs:[],focus:+t.focus||0,kind:KIND_LABEL[t.kind]?t.kind:'other'}));
}
let state=load()||freshState();
normalize();
let saveT;
function save(){ clearTimeout(saveT); saveT=setTimeout(()=>{ try{ localStorage.setItem(KEY,JSON.stringify(state)); }catch(e){} },150); }
const rec=dk=>state.dates[dk]||(state.dates[dk]={done:{},subs:{},extra:{},notes:{},skip:{}});
const peek=dk=>state.dates[dk]||EMPTY;

/* ---------- UI state ---------- */
const ui={
  view:'day', date:startOfDay(new Date()), open:new Set(), lastKey:'', animId:null, focusId:null, sheet:null,
  form:{open:false,title:'',start:null,end:null,kind:'auto',days:[...ALL]}
};
{ const hv=location.hash.slice(1); if(TAB_IDS.includes(hv)) ui.view=hv; }

/* ---------- toast and undo ---------- */
let toastT;
function hideToast(){ $('#toast').classList.remove('show'); }
function toast(msg,action){
  const t=$('#toast');
  t.replaceChildren(h('span',null,msg),action?h('button',{type:'button',class:'tbtn',onclick:()=>{action.fn();hideToast();}},action.label):null);
  t.classList.add('show'); clearTimeout(toastT); toastT=setTimeout(hideToast,8000);
}
function restore(snap){ state=JSON.parse(snap); normalize(); save(); render(); }

/* ---------- sound and feel ---------- */
let AC=null;
function audio(){
  try{
    if(!AC){ const C=window.AudioContext||window.webkitAudioContext; if(!C) return null; AC=new C(); }
    if(AC.state==='suspended') AC.resume();
    return AC;
  }catch(e){ return null; }
}
document.addEventListener('pointerdown',()=>audio(),{passive:true});
function playSound(idx,up){
  const ctx=audio(); if(!ctx) return;
  const p=SOUNDS[Math.min(Math.max(idx|0,0),SOUNDS.length-1)];
  const t0=ctx.currentTime+0.01, dur=p.ms/1000;
  const start=up?p.base/p.glide:p.base*p.glide, end=up?p.base*p.glide:p.base/p.glide;
  const master=ctx.createGain(); master.gain.value=0.9; master.connect(ctx.destination);
  let out=master;
  if(p.lp){ const f=ctx.createBiquadFilter(); f.type='lowpass'; f.frequency.value=p.lp; f.connect(master); out=f; }
  const tau=Math.max(0.008,dur/(p.decay||4));
  const voices=[{r:1,a:0.22,tau}].concat(p.harm.map(([r,a])=>({r,a:a*0.22,tau:tau*0.5})));
  voices.forEach(v=>{
    const o=ctx.createOscillator(), g=ctx.createGain();
    o.type=p.type;
    o.frequency.setValueAtTime(start*v.r,t0); o.frequency.linearRampToValueAtTime(end*v.r,t0+dur);
    g.gain.setValueAtTime(0.0001,t0); g.gain.exponentialRampToValueAtTime(v.a,t0+0.008); g.gain.setTargetAtTime(0.0001,t0+0.008,v.tau);
    o.connect(g); g.connect(out); o.start(t0); o.stop(t0+dur+0.05);
  });
}
function feedback(on){
  const s=state.settings;
  if(s.haptics&&navigator.vibrate){ try{ navigator.vibrate(on?14:7); }catch(e){} }
  if(s.tickSound) playSound(on?s.tickIdx:s.untickIdx,on);
}

/* ---------- mutations ---------- */
function toggleDone(id){
  const r=rec(curKey()); const on=!r.done[id]; r.done[id]=on;
  ui.animId=id; save(); feedback(on); render();
}
function toggleSub(sid){ const r=rec(curKey()); r.subs[sid]=!r.subs[sid]; save(); render(); }
function toggleSkip(id){ const r=rec(curKey()); r.skip[id]=!r.skip[id]; save(); render(); }
function addExtra(id,text){
  text=String(text||'').trim(); if(!text) return;
  const r=rec(curKey()); (r.extra[id]=r.extra[id]||[]).push({id:uid(),title:text,done:false});
  ui.focusId='step-'+id; save(); render();
}
function toggleExtra(id,xid){ const x=(rec(curKey()).extra[id]||[]).find(e=>e.id===xid); if(x){ x.done=!x.done; save(); render(); } }
function removeExtra(id,xid){ const r=rec(curKey()); r.extra[id]=(r.extra[id]||[]).filter(e=>e.id!==xid); save(); render(); }
function setNote(id,text){ rec(curKey()).notes[id]=text; save(); }
function setDayNote(dk,text){
  if(!text.trim()) delete state.dayNotes[dk]; else state.dayNotes[dk]=text;
  save(); renderDrawer();
}
function toggleDay(id,wd){
  const t=state.tasks.find(x=>x.id===id); if(!t) return;
  const i=t.days.indexOf(wd); if(i>=0) t.days.splice(i,1); else t.days.push(wd);
  save(); render();
}
function deleteTask(id){
  const snap=JSON.stringify(state);
  state.tasks=state.tasks.filter(t=>t.id!==id); save(); render();
  toast('Task removed.',{label:'Undo',fn:()=>restore(snap)});
}

/* ---------- day view ---------- */
const chip=kind=>h('span',{class:'chip k-'+kind},h('i'),KIND_LABEL[kind]||'Other');
function stepRow(label,checked,onToggle,onRemove){
  return h('li',{class:'step'+(checked?' is-done':'')},
    h('button',{type:'button',class:'sbox',role:'checkbox','aria-checked':String(checked),'aria-label':label,onclick:onToggle},ico(CHECK)),
    h('span',{class:'stext'},label),
    onRemove?h('button',{type:'button',class:'rm','aria-label':'Remove '+label,onclick:onRemove},'×'):null);
}
function statFor(date){
  const wd=date.getDay(),d=peek(dkey(date));
  const act=state.tasks.filter(t=>t.days.includes(wd)&&!d.skip[t.id]);
  return {total:act.length,done:act.filter(t=>d.done[t.id]).length};
}
function detailFor(t,d){
  const subs=t.subs||[],extra=d.extra[t.id]||[];
  const dl=DAY_LONG[ui.date.getDay()]+' '+ui.date.getDate();
  return h('div',{class:'detail'},
    subs.length?h('div',null,h('h4',null,'Steps in this block'),
      h('ul',{class:'steps'},subs.map(s=>stepRow(s.title,!!d.subs[s.id],()=>toggleSub(s.id))))):null,
    h('div',null,h('h4',null,'Only for '+dl),
      extra.length?h('ul',{class:'steps'},extra.map(x=>stepRow(x.title,x.done,()=>toggleExtra(t.id,x.id),()=>removeExtra(t.id,x.id)))):h('p',{class:'hint'},'Add steps that apply to this date only.'),
      h('form',{class:'addstep',onsubmit:e=>{e.preventDefault();addExtra(t.id,e.target.elements.step.value);}},
        h('input',{class:'inp',name:'step',id:'step-'+t.id,placeholder:'Add a step for this date','aria-label':'New step for this date',autocomplete:'off'}),
        h('button',{class:'btn small',type:'submit'},'Add'))),
    h('div',null,h('label',{for:'note-'+t.id},'Note for this date'),
      h('textarea',{class:'inp',id:'note-'+t.id,rows:'2',oninput:e=>setNote(t.id,e.target.value)},d.notes[t.id]||'')),
    h('div',{class:'dact'},
      h('button',{type:'button',class:'btn small',onclick:()=>toggleSkip(t.id)},'Skip on this date'),
      h('button',{type:'button',class:'btn small',onclick:()=>deleteTask(t.id)},'Delete task')));
}
function taskItem(t,d,now,nx){
  const done=!!d.done[t.id],open=ui.open.has(t.id),point=t.end<=t.start;
  const isNow=now>=0&&!point&&now>=t.start&&now<t.end;
  const subs=t.subs||[],extra=d.extra[t.id]||[];
  const subTotal=subs.length+extra.length;
  const subDone=subs.filter(s=>d.subs[s.id]).length+extra.filter(x=>x.done).length;
  const ov=nx?t.end-nx.start:0;
  const pop=ui.animId===t.id;
  return h('li',{class:'task k-'+t.kind+(done?' done':'')+(isNow?' now':'')+(point?' point':'')},
    h('div',{class:'tm'},h('span',{class:'a'},fmt(t.start)),point?null:h('span',null,fmt(t.end))),
    h('div',{class:'card'},
      h('div',{class:'row'},
        h('button',{type:'button',class:'chk'+(pop?' pop':''),role:'checkbox','aria-checked':String(done),'aria-label':t.title,onclick:()=>toggleDone(t.id)},ico(CHECK)),
        h('div',{class:'ttl'},h('h3',null,t.title),
          h('div',{class:'meta'},chip(t.kind),
            t.focus>0?h('span',{class:'chip focus'},'Focus '+fmtDur(t.focus)):(!point?h('span',{class:'chip'},fmtDur(t.end-t.start)):null),
            isNow?h('span',{class:'chip now'},'Now'):null,
            ov>0?h('span',{class:'chip warn'},'Overlaps '+nx.title+' by '+fmtDur(ov)):null,
            t.flag?h('span',{class:'chip warn',title:t.flag},'Check time'):null)),
        h('button',{type:'button',class:'more','aria-expanded':String(open),'aria-label':'Details for '+t.title,
          onclick:()=>{ if(open) ui.open.delete(t.id); else ui.open.add(t.id); render(); }},
          h('span',null,subTotal?subDone+'/'+subTotal:'Details'),ico(CHEV))),
      open?detailFor(t,d):null));
}
function dayView(){
  const date=ui.date,dk=dkey(date),wd=date.getDay(),d=peek(dk);
  const isToday=dk===todayKey();
  const all=state.tasks.filter(t=>t.days.includes(wd)).sort(byTime);
  const act=all.filter(t=>!d.skip[t.id]);
  const fp=sum(act.map(t=>t.focus)),fd=sum(act.filter(t=>d.done[t.id]).map(t=>t.focus));
  const dn=act.filter(t=>d.done[t.id]).length;
  const nd=new Date();
  const now=isToday?nd.getHours()*60+nd.getMinutes():-1;
  const pct=fp?fd/fp:(act.length?dn/act.length:0);
  const ws=weekStart(date);
  const sub=act.length?dn+' of '+act.length+' done'+(fp?' · Focus '+(fmtDur(fd)||'0 min')+' of '+fmtDur(fp):''):'Nothing is set for this day';
  const items=[];
  all.forEach(t=>{
    if(d.skip[t.id]){
      items.push(h('li',{class:'skipped'},h('span',null,t.title+' · skipped on this date'),h('button',{type:'button',class:'btn quiet small',onclick:()=>toggleSkip(t.id)},'Restore')));
      return;
    }
    const nx=act[act.indexOf(t)+1];
    items.push(taskItem(t,d,now,nx));
    if(nx){ const g=nx.start-t.end; if(g>=20) items.push(h('li',{class:'gap'},fmtDur(g)+' free until '+fmt(nx.start))); }
  });
  const dates=[...Array(7)].map((_,i)=>{
    const day=addDays(ws,i),st=statFor(day),sel=dkey(day)===dk;
    return h('button',{type:'button',class:'datebtn'+(dkey(day)===todayKey()?' today':''),'aria-pressed':String(sel),'aria-label':DAY_LONG[day.getDay()]+' '+day.getDate(),
      onclick:()=>{ui.date=day;render();}},
      h('span',{class:'wd'},DAY_SHORT[day.getDay()]),h('span',{class:'dn'},day.getDate()),h('span',{class:'dc'},st.total?st.done+'/'+st.total:'–'));
  });
  return h('div',{class:'view'},
    h('div',{class:'mh'},
      h('div',null,
        h('h1',null,DAY_LONG[wd]+', '+date.getDate()+' '+MONTHS[date.getMonth()]+(isToday?' · Today':'')),
        h('p',{class:'sub'},sub),
        h('div',{style:'margin-top:8px'},
          h('button',{type:'button',class:'btn quiet small',style:'padding-left:0',onclick:()=>go('function')},
            state.remind.on?'Reminders on · '+leadLabel():'Reminders off'))),
      h('div',{class:'nav'},
        h('button',{type:'button',class:'iconbtn','aria-label':'Previous week',onclick:()=>{ui.date=addDays(ui.date,-7);render();}},'‹'),
        h('button',{type:'button',class:'iconbtn',onclick:()=>{ui.date=startOfDay(new Date());render();}},'Today'),
        h('button',{type:'button',class:'iconbtn','aria-label':'Next week',onclick:()=>{ui.date=addDays(ui.date,7);render();}},'›'))),
    h('div',{class:'dates',role:'group','aria-label':'Days of this week'},dates),
    h('div',{class:'prog',role:'progressbar','aria-label':'Progress for the day','aria-valuemin':'0','aria-valuemax':'100','aria-valuenow':String(Math.round(pct*100))},
      h('span',{style:'width:'+Math.round(pct*100)+'%'})),
    all.length?h('ul',{class:'list'},items):
      h('div',{class:'empty'},h('p',null,'No tasks are set to show on '+DAY_LONG[wd]+'s.'),
        h('button',{type:'button',class:'btn',onclick:()=>go('add')},'Add tasks')));
}

/* ---------- add view ---------- */
function plusButton(){
  const open=ui.form.open;
  return h('button',{type:'button',class:'plus'+(open?' open':''),'aria-expanded':String(open),'aria-label':open?'Close the new task form':'Add one task',title:'Add one task',
    onclick:()=>{
      const f=ui.form; f.open=!f.open;
      if(f.open){ f.start=defaultStart(); f.days=[...state.days]; f.end=null; f.kind='auto'; ui.focusId='nt-title'; }
      render();
    }},'+');
}
function autoHint(){
  const f=ui.form; return f.title.trim()?'Looks like: '+KIND_LABEL[kindOf(f.title)]:'Type a title to see the type.';
}
function newTaskForm(){
  const f=ui.form;
  const kindChips=[['auto','Auto'],...KINDS.map(k=>[k,KIND_LABEL[k]])].map(([k,l])=>
    h('button',{type:'button',class:'dchip','aria-pressed':String(f.kind===k),onclick:()=>{f.kind=k;render();}},l));
  const dayChips=WEEK_ORDER.map(wd=>h('button',{type:'button',class:'dchip','aria-pressed':String(f.days.includes(wd)),
    onclick:()=>{ const i=f.days.indexOf(wd); if(i>=0){ if(f.days.length>1) f.days.splice(i,1); } else f.days.push(wd); render(); }},DAY_SHORT[wd]));
  const start=f.start==null?defaultStart():f.start;
  const endField=f.end==null
    ? h('button',{type:'button',class:'btn small',onclick:()=>{f.end=(start+60)%1440;render();}},'Add end time')
    : h('div',{class:'field'},h('span',null,'Ends'),
        h('div',{class:'chips'},
          h('input',{class:'inp',type:'time',value:toIn(f.end),onchange:e=>{if(e.target.value) f.end=fromIn(e.target.value);}}),
          h('button',{type:'button',class:'btn quiet small',onclick:()=>{f.end=null;render();}},'No end time')));
  return h('section',{class:'newtask'},
    h('h3',null,'New task'),
    h('div',{class:'field'},h('span',null,'Task'),
      h('input',{class:'inp',id:'nt-title',value:f.title,placeholder:'e.g. Chemistry revision',autocomplete:'off',
        oninput:e=>{f.title=e.target.value; const hint=$('#autohint'); if(hint) hint.textContent=autoHint();}})),
    h('div',{class:'grid2'},
      h('div',{class:'field'},h('span',null,'Starts'),
        h('input',{class:'inp',type:'time',value:toIn(start),onchange:e=>{if(e.target.value) f.start=fromIn(e.target.value);}})),
      endField),
    h('p',{class:'autohint',id:'autohint'},autoHint()),
    h('span',{class:'field-label'},'Type'),
    h('div',{class:'chips'},kindChips),
    h('span',{class:'field-label'},'Show on'),
    h('div',{class:'chips'},dayChips),
    h('div',{class:'actions'},
      h('button',{type:'button',class:'btn primary',onclick:addTaskFromForm},'Add task'),
      h('button',{type:'button',class:'btn',onclick:()=>{f.open=false;render();}},'Done')));
}
function addTaskFromForm(){
  const f=ui.form, title=f.title.trim();
  if(!title){ toast('Give the task a title first.'); ui.focusId='nt-title'; render(); return; }
  const start=f.start==null?defaultStart():f.start;
  let end=f.end==null?start:f.end; if(end<start) end=start;
  const kind=f.kind==='auto'?kindOf(title):f.kind;
  const focus=kind==='study'&&end>start?end-start:0;
  const snap=JSON.stringify(state);
  state.tasks.push({id:uid(),title,start,end,kind,focus,subs:[],days:[...f.days].sort((a,b)=>a-b)});
  save();
  f.title=''; f.start=end; f.end=null;
  ui.focusId='nt-title';
  render();
  toast('Added “'+title+'”.',{label:'Undo',fn:()=>restore(snap)});
}
function addView(){
  const setDays=ds=>()=>{state.days=[...ds];save();render();};
  const dayChips=WEEK_ORDER.map(wd=>h('button',{type:'button',class:'dchip','aria-pressed':String(state.days.includes(wd)),
    onclick:()=>{ const i=state.days.indexOf(wd); if(i>=0){ if(state.days.length>1) state.days.splice(i,1); } else state.days.push(wd); save(); render(); }},DAY_SHORT[wd]));
  return h('div',{class:'view'},
    h('div',{class:'mh'},
      h('div',null,h('h1',null,'Add tasks'),
        h('p',{class:'lead'},'Paste a whole schedule or type a single task. Time ranges (“4:20 to 6:10”), lengths (“+2 hr”), comma lists and a “total” line are read for you.')),
      plusButton()),
    ui.form.open?newTaskForm():null,
    h('label',{class:'field-label',for:'summary'},'Task summary'),
    h('textarea',{class:'summary',id:'summary',spellcheck:'false',rows:'12',
      oninput:e=>{state.summary=e.target.value;save();renderPreview();}},state.summary),
    h('span',{class:'field-label'},'Show on'),
    h('div',{class:'chips',role:'group','aria-label':'Show on'},dayChips),
    h('div',{class:'presets'},
      h('button',{type:'button',class:'btn quiet small',onclick:setDays(ALL)},'Every day'),
      h('button',{type:'button',class:'btn quiet small',onclick:setDays([1,2,3,4,5,6])},'Mon–Sat'),
      h('button',{type:'button',class:'btn quiet small',onclick:setDays([1,2,3,4,5])},'Weekdays')),
    h('div',{class:'actions'},
      h('button',{type:'button',id:'btnReplace',class:'btn primary',onclick:()=>applyPlan('replace')},'Replace my plan'),
      h('button',{type:'button',id:'btnAppend',class:'btn',onclick:()=>applyPlan('append')},'Add to plan'),
      h('button',{type:'button',class:'btn quiet',onclick:()=>{state.summary=SAMPLE;save();render();}},'Use example')),
    h('div',{class:'prev',id:'preview','aria-live':'polite'}),
    h('p',{class:'fine'},'Your plan, ticks and notes are saved in this browser only.'));
}
function renderPreview(){
  const box=$('#preview'); if(!box) return;
  const p=parseSummary(state.summary), n=p.tasks.length;
  const rb=$('#btnReplace'), ab=$('#btnAppend');
  if(rb) rb.disabled=!n; if(ab) ab.disabled=!n;
  if(!n){ box.replaceChildren(h('p',{class:'hint'},'Nothing recognised yet. Try “Chemistry 5 to 6:30 pm” on its own line.')); return; }
  const fo=sum(p.tasks.map(t=>t.focus));
  const rows=[...p.tasks].sort(byTime).map(t=>h('div',{class:'prow k-'+t.kind},
    h('span',{class:'pt'},t.end>t.start?fmt(t.start)+' – '+fmt(t.end):fmt(t.start)),
    h('span',{class:'pn'},h('b',null,t.title),' ',chip(t.kind),t.focus?h('span',{class:'hint'},' focus '+fmtDur(t.focus)):null),
    t.flag?h('span',{class:'pflag'},t.flag):null));
  const nodes=[h('h3',null,'What I found · '+n+(n===1?' task':' tasks')),...rows];
  if(p.total!=null) nodes.push(h('p',{class:'callout '+(p.total===fo?'good':'warn')},
    p.total===fo?'Focus adds up to '+fmtDur(fo)+', matching your total.':'Your total says '+fmtDur(p.total)+', but focus adds up to '+(fmtDur(fo)||'0 min')+'.'));
  box.replaceChildren(...nodes);
}
function applyPlan(mode){
  const p=parseSummary(state.summary); if(!p.tasks.length) return;
  const snap=JSON.stringify(state);
  const nt=p.tasks.map(t=>({...t,days:[...state.days]}));
  if(mode==='replace'){ state.tasks=nt; state.dates={}; state.total=p.total; }
  else { state.tasks=state.tasks.concat(nt); if(p.total!=null) state.total=p.total; }
  save();
  go('day');
  toast((mode==='replace'?'Plan replaced with ':'Added ')+nt.length+(nt.length===1?' task.':' tasks.'),{label:'Undo',fn:()=>restore(snap)});
}

/* ---------- function view ---------- */
function notifState(){ return 'Notification' in window ? Notification.permission : 'unsupported'; }
function notifText(p){
  if(p==='granted') return 'Allowed. Reminders also show as device notifications.';
  if(p==='denied') return 'Blocked in this browser. Allow notifications in the site settings.';
  if(p==='unsupported') return 'Not available in this browser. Banners still appear here.';
  return 'Not allowed yet. Reminders still show as banners on this page.';
}
async function askPermission(){
  try{
    if(!('Notification' in window)) return false;
    let p=Notification.permission;
    if(p==='default') p=await Notification.requestPermission();
    return p==='granted';
  }catch(e){ return false; }
}
async function testNotify(){
  if(notifState()==='default') await askPermission();
  notify('Test notification',TEST_TEXT,null);
  render();
}
let wakeLock=null, offlineReady=false, deferredInstall=null;
async function setAwake(on){
  const R=state.remind;
  if(!on){ try{ if(wakeLock) await wakeLock.release(); }catch(e){} wakeLock=null; R.awake=false; save(); render(); return; }
  try{
    if(!navigator.wakeLock) throw new Error('unsupported');
    wakeLock=await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release',()=>{wakeLock=null;});
    R.awake=true;
  }catch(e){ R.awake=false; toast('This browser cannot keep the screen awake here.'); }
  save(); render();
}
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='visible'&&state.remind.awake&&!wakeLock) setAwake(true);
});
function installText(){
  if(isStandalone()) return 'Installed. You are using the app.';
  if(deferredInstall) return 'Add Daybreak to your home screen or desktop.';
  if(isIOS()) return 'In Safari, tap Share, then Add to Home Screen.';
  if(!canUseSW()) return 'Open this page over https to install it.';
  return 'Use your browser menu: Install app or Add to Home screen.';
}
async function installApp(){
  if(!deferredInstall) return;
  try{ deferredInstall.prompt(); await deferredInstall.userChoice; }catch(e){}
  deferredInstall=null; render();
}
function sw(on,label,fn){ return h('button',{type:'button',class:'switch',role:'switch','aria-checked':String(!!on),'aria-label':label,onclick:fn}); }
function srow(title,sub,control){ return h('div',{class:'srow'},h('div',{class:'st'},h('b',null,title),sub?h('small',null,sub):null),control); }
function block(title,content){ return h('div',{class:'stack'},h('div',{class:'label-h'},title),content); }
function soundPick(title,sub,sel,tick){
  const S=state.settings;
  return h('div',{class:'pick'},
    h('div',null,h('b',null,title),h('small',null,sub)),
    h('div',{class:'chips sound-chips'},SOUNDS.map((s,i)=>h('button',{type:'button',class:'dchip','aria-pressed':String(sel===i),
      onclick:()=>{ if(tick) S.tickIdx=i; else S.untickIdx=i; save(); playSound(i,tick); render(); }},s.name))));
}
function resolvedDark(){
  const t=state.settings.theme;
  return t==='dark'||(t==='system'&&mq.matches);
}
function applyTheme(){
  const root=document.documentElement, a=ACCENTS[state.settings.accent]||ACCENTS[0], dark=resolvedDark();
  root.dataset.mode=dark?'dark':'light';
  root.style.setProperty('--accent',dark?a.dark:a.light);
  root.style.setProperty('--accent-soft',dark?a.darkSoft:a.lightSoft);
  root.style.setProperty('--accent-ink',dark?'#0B111F':'#FFFFFF');
  const m=$('#themeMeta'); if(m) m.setAttribute('content',dark?'#0B111F':'#F2F4F9');
}
function functionView(){
  const R=state.remind, S=state.settings, perm=notifState();
  const nd=new Date(), wd=nd.getDay(), now=nd.getHours()*60+nd.getMinutes(), d=peek(dkey(nd));
  const up=state.tasks.filter(t=>t.notify!==false&&t.days.includes(wd)&&!d.skip[t.id]&&!d.done[t.id]&&t.start>now).sort(byTime).slice(0,6);
  const leads=LEADS.map(l=>h('button',{type:'button',class:'dchip','aria-pressed':String(R.lead===l),
    onclick:()=>{R.lead=l;save();render();}},l===0?'At start':l+' min'));
  const themeBtn=(id,label)=>h('button',{type:'button',class:'theme','aria-pressed':String(S.theme===id),
    onclick:()=>{S.theme=id;save();applyTheme();render();}},
    h('div',{class:'mini '+(id==='system'?'split':id)},h('i'),h('i'),h('i')),h('span',null,label));
  return h('div',{class:'stack'},
    h('div',{class:'mh'},h('div',null,h('h1',null,'Function'),h('p',{class:'sub'},'Reminders, feedback, sounds and the look of the app.'))),
    block('Reminders',h('div',{class:'panel'},
      srow('Reminders','Turn all reminders on or off.',sw(R.on,'Reminders',()=>{R.on=!R.on;save();render();})),
      h('div',{class:'pick'},h('div',null,h('b',null,'Remind me'),h('small',null,'How early to warn you.')),h('div',{class:'chips'},leads)),
      srow('Sound','A chime with each reminder.',sw(R.sound,'Reminder sound',()=>{R.sound=!R.sound;save();render();})),
      srow('Notifications',notifText(perm),perm==='granted'?null:h('button',{type:'button',class:'btn small primary',onclick:async()=>{await askPermission();render();}},'Allow')),
      srow('Keep screen awake',R.awake?'On. The screen stays lit while this page is open.':'Off.',sw(R.awake,'Keep screen awake',()=>setAwake(!R.awake))),
      srow('Try it','See how a reminder looks and sounds.',h('button',{type:'button',class:'btn small',onclick:testNotify},'Send a test')))),
    block('Feel',h('div',{class:'panel'},
      srow('Haptic feedback','A small tap when you tick a task.',sw(S.haptics,'Haptic feedback',()=>{S.haptics=!S.haptics;save();render();if(S.haptics) feedback(true);})),
      srow('Tick sound','A soft pop when you tick or untick a task.',sw(S.tickSound,'Tick sound',()=>{S.tickSound=!S.tickSound;save();render();if(S.tickSound) playSound(S.tickIdx,true);})))),
    block('Sounds',h('div',{class:'panel'},
      soundPick('When you tick a task','Tap a sound to hear it and keep it.',S.tickIdx,true),
      soundPick('When you untick a task','Tap a sound to hear it and keep it.',S.untickIdx,false))),
    block('Coming up today',h('div',{class:'panel'},
      up.length?h('ul',{class:'upnext'},up.map(t=>h('li',null,h('span',null,t.title),h('span',{class:'ut'},R.on?'Reminder '+fmt(t.start-R.lead):'Starts '+fmt(t.start))))):
        h('p',{class:'hint',style:'padding:14px 0'},'No more reminders for today.'))),
    block('App',h('div',{class:'panel'},
      srow('Install to home screen',installText(),deferredInstall&&!isStandalone()?h('button',{type:'button',class:'btn small primary install-btn',onclick:installApp},'Install'):null),
      srow('Works offline',offlineReady?'Ready. The planner opens without a connection.':(canUseSW()?'Getting ready. Keep this page open for a moment.':'Needs https or localhost.'),null))),
    block('Appearance',h('div',{class:'panel'},
      h('div',{class:'pick'},h('div',null,h('b',null,'Theme'),h('small',null,'Applies to the whole app.')),
        h('div',{class:'themes'},themeBtn('light','Light'),themeBtn('dark','Dark'),themeBtn('system','System')),
        h('p',{class:'hint'},S.theme==='light'?'Always light.':S.theme==='dark'?'Always dark.':"Follows your device's light and dark setting.")),
      h('div',{class:'pick'},h('div',null,h('b',null,'Accent colour'),h('small',null,'Buttons, highlights and the progress bar.')),
        h('div',{class:'swatches'},ACCENTS.map((a,i)=>h('button',{type:'button',class:'swatch','aria-pressed':String(S.accent===i),'aria-label':a.name,
          style:'--c:'+(resolvedDark()?a.dark:a.light),
          onclick:()=>{S.accent=i;save();applyTheme();render();}}))))))
  );
}

/* ---------- reminders ---------- */
const bannerFor=(title,body,taskId)=>{
  const box=$('#banners');
  let el=null;
  el=h('div',{class:'alert',role:'alert'},
    h('div',null,h('b',null,title),h('small',null,body)),
    h('div',{class:'abtns'},
      taskId?h('button',{type:'button',class:'abtn',onclick:()=>{rec(todayKey()).done[taskId]=true;save();el.remove();render();}},'Mark done'):null,
      h('button',{type:'button',class:'abtn p',onclick:()=>el.remove()},'Dismiss')));
  box.append(el);
};
async function showSystem(title,body,tag){
  if(notifState()!=='granted') return;
  const opts={body,icon:'icons/icon-192.png',badge:'icons/icon-192.png',tag:tag||'daybreak'};
  try{
    const reg=('serviceWorker' in navigator)?await navigator.serviceWorker.getRegistration():null;
    if(reg&&reg.showNotification){ await reg.showNotification(title,opts); return; }
    new Notification(title,opts);
  }catch(e){}
}
function notify(title,body,taskId){
  bannerFor(title,body,taskId);
  if(state.remind.sound) playSound(5,true);
  showSystem(title,body,taskId||undefined);
}
function checkReminders(){
  const R=state.remind; if(!R.on) return;
  const nd=new Date(), dk=dkey(nd), wd=nd.getDay(), now=nd.getHours()*60+nd.getMinutes()+nd.getSeconds()/60, d=peek(dk);
  let changed=false;
  state.tasks.forEach(t=>{
    if(t.notify===false||!t.days.includes(wd)||d.skip[t.id]||d.done[t.id]) return;
    if(now<t.start-R.lead||now>=t.start+10) return;
    const k=dk+'|'+t.id+'|'+R.lead;
    if(state.fired[k]) return;
    state.fired[k]=1; changed=true;
    const diff=t.start-now;
    const head=diff>0.5?'Starts in '+Math.round(diff)+' min':(diff>-1?'Starting now':'Started '+Math.round(-diff)+' min ago');
    notify(head,t.title+' · '+fmt(t.start)+(t.end>t.start?' – '+fmt(t.end):''),t.id);
  });
  if(changed){ save(); if(ui.view==='day') render(); }
}

/* ---------- day notes: the thin line at the bottom ---------- */
function renderDrawer(){
  const note=state.dayNotes[curKey()];
  $('#drawer').classList.toggle('has-note',!!(note&&note.trim()));
}
function openSheet(){
  if(ui.sheet) return;
  const dk=curKey(), date=ui.date;
  const sheet=h('div',{class:'sheet',onclick:e=>{ if(e.target===sheet) closeSheet(); }},
    h('div',{class:'sheet-card'},
      h('div',{class:'sheet-grip'}),
      h('div',{class:'sheet-head'},
        h('div',null,h('h3',null,'Note for '+DAY_LONG[date.getDay()]+' '+date.getDate()+' '+MONTHS[date.getMonth()]),
          h('p',{class:'hint'},'Saved in this browser, for this date only.')),
        h('button',{type:'button',class:'btn small',onclick:closeSheet},'Done')),
      h('textarea',{class:'inp note',rows:'8',placeholder:'Anything for this day…',
        oninput:e=>setDayNote(dk,e.target.value)},state.dayNotes[dk]||'')));
  document.body.append(sheet); ui.sheet=sheet;
  requestAnimationFrame(()=>sheet.classList.add('show'));
  setTimeout(()=>{ const t=sheet.querySelector('textarea'); if(t) t.focus(); },260);
}
function closeSheet(){
  const s=ui.sheet; if(!s) return;
  ui.sheet=null; s.classList.remove('show');
  setTimeout(()=>s.remove(),260);
  renderDrawer();
}
{
  const dr=$('#drawer');
  let startY=null, moved=0;
  dr.addEventListener('pointerdown',e=>{ startY=e.clientY; moved=0; dr.setPointerCapture(e.pointerId); });
  dr.addEventListener('pointermove',e=>{
    if(startY==null) return;
    moved=startY-e.clientY;
    dr.style.transform='translateY('+(-Math.max(0,Math.min(moved,40)))+'px)';
  });
  const end=()=>{
    if(startY==null) return;
    const up=moved>24||Math.abs(moved)<6;
    startY=null; dr.style.transform='';
    if(up) openSheet();
  };
  dr.addEventListener('pointerup',end);
  dr.addEventListener('pointercancel',()=>{ startY=null; dr.style.transform=''; });
  dr.addEventListener('keydown',e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); openSheet(); } });
}

/* ---------- guide ---------- */
const ICON_BELL='<svg class="bell" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/></svg>';
let guideIdx=0, guideTimers=[];
const clearGuideTimers=()=>{ guideTimers.forEach(clearInterval); guideTimers=[]; };
const GUIDE=[
  {title:'Welcome to Daybreak',
   body:'Turn a plain list of tasks into a timed day. Get a nudge before each one, tick them off, and keep a note for every day.',
   art:()=>[h('div',{class:'sea'}),h('div',{class:'sun'})]},
  {title:'Write your day in plain words',
   body:'Each task goes on its own line. “maths 4 pm +2 hr” is maths from 4 to 6 pm. “4:20 to 6:10 revision” is a time range. A “total” line sets a focus goal.',
   art:()=>{
     const lines=['wake up at 9 am','maths 4 pm +2 hr','4:20 to 6:10 revision'];
     const box=h('div',{class:'typed'},h('span',{class:'caret'}));
     let li=0,ci=0,hold=0;
     guideTimers.push(setInterval(()=>{
       const line=lines[li];
       if(ci<line.length) ci++; else if(++hold>14){ hold=0; ci=0; li=(li+1)%lines.length; }
       box.replaceChildren(lines[li].slice(0,ci),h('span',{class:'caret'}));
     },70));
     return [box];
   }},
  {title:'Add tasks',
   body:'Paste a whole schedule on the Add tab, or tap the round + to add one task: a title, a start time, an optional end time, a type and the days it shows on. The form stays open for the next one.',
   art:()=>[h('div',{class:'demo-add'},h('div',{class:'demo-row'},'maths'),h('div',{class:'demo-row'},'4:00 PM · +2 hr'),h('div',{class:'demo-row'},'Chemistry')),h('div',{class:'demo-plus'},'+')]},
  {title:'Tick them off',
   body:'Tap the box beside a task when it is done. You feel a small tap, hear a sound, and the progress bar fills. Details holds steps, a note for that date and Skip.',
   art:()=>{
     const box=h('span',{class:'demo-box'},ico(CHECK));
     guideTimers.push(setInterval(()=>box.classList.toggle('on'),1400));
     return [h('div',{class:'demo-tick'},
       h('div',{class:'demo-task'},box,h('span',null,'Maths · 4:00 PM')),
       h('div',{class:'demo-task'},h('span',{class:'demo-box on'},ico(CHECK)),h('span',{style:'text-decoration:line-through;color:var(--muted)'},'Wake up')))];
   }},
  {title:'A note for every day',
   body:'Drag up the thin line at the bottom of the screen to open a note for the day you are looking at.',
   art:()=>[h('div',{class:'demo-phone'},h('div',{class:'demo-sheet'},h('div',{style:'padding:12px;color:var(--muted);font-size:12px'},'Note for this day')),h('div',{class:'demo-line'},h('span',{class:'grip'}))),h('div',{class:'demo-arrow'},'↑')]},
  {title:'Reminders',
   body:'You get a banner a few minutes before each task. Change how early on the Function tab. Reminders work while this page is open, so keep it open or pinned, or install the app to your home screen.',
   art:()=>[ico(ICON_BELL)]},
  {title:'Make it yours',
   body:'On the Function tab choose light, dark or system, pick an accent, and choose the sound for ticking and unticking a task. The Guide button opens this again any time.',
   art:()=>[h('div',{class:'swatch-demo'},ACCENTS.map(a=>h('i',{style:'--c:'+a.light})))]}
];
function renderGuide(dir){
  let g=$('#guide');
  if(!g){ g=h('div',{id:'guide',class:'guide',role:'dialog','aria-modal':'true','aria-label':'How to use Daybreak'}); document.body.append(g); }
  clearGuideTimers();
  const page=GUIDE[guideIdx], last=guideIdx===GUIDE.length-1, enter=dir>=0?'in-r':'in-l';
  g.replaceChildren(h('div',{class:'guide-card'},
    h('div',{class:'guide-top'},h('span',{class:'hint'},(guideIdx+1)+' of '+GUIDE.length),h('button',{type:'button',class:'btn quiet small',onclick:closeGuide},'Skip')),
    h('div',{class:'stage '+enter},page.art()),
    h('div',{class:'guide-txt '+enter},h('h2',null,page.title),h('p',null,page.body)),
    h('div',{class:'dots'},GUIDE.map((_,i)=>h('button',{type:'button','aria-label':'Page '+(i+1),'aria-current':String(i===guideIdx),onclick:()=>goGuide(i)}))),
    h('div',{class:'guide-nav'},
      h('button',{type:'button',class:'btn',disabled:guideIdx===0?true:null,onclick:()=>goGuide(guideIdx-1)},'Back'),
      h('button',{type:'button',class:'btn primary',onclick:()=>last?closeGuide():goGuide(guideIdx+1)},last?'Start planning':'Next'))));
}
function goGuide(i){
  if(i<0||i>=GUIDE.length) return;
  const dir=i>guideIdx?1:-1; guideIdx=i; renderGuide(dir);
}
function openGuide(){ guideIdx=0; renderGuide(1); }
function closeGuide(){
  clearGuideTimers();
  const g=$('#guide'); if(g) g.remove();
  try{ localStorage.setItem(GUIDE_KEY,'1'); }catch(e){}
}

/* ---------- views, tabs, render ---------- */
function renderTabs(){
  $('#tabs').replaceChildren(...TABS.map(([id,label])=>h('button',{type:'button',class:'tab',role:'tab','aria-selected':String(ui.view===id),onclick:()=>go(id)},label)));
}
function go(id){
  ui.view=id;
  try{ history.replaceState(null,'','#'+id); }catch(e){}
  render();
  window.scrollTo({top:0});
}
function render(){
  renderTabs();
  const main=$('#main'), cur=ui.view;
  const node=cur==='add'?addView():cur==='function'?functionView():dayView();
  main.replaceChildren(node);
  const key=cur+'|'+curKey();
  if(key!==ui.lastKey){
    ui.lastKey=key;
    main.classList.remove('enter'); void main.offsetWidth; main.classList.add('enter');
  }
  if(cur==='add') renderPreview();
  renderDrawer();
  if(ui.focusId){ const el=document.getElementById(ui.focusId); if(el) el.focus(); ui.focusId=null; }
  ui.animId=null;
}

/* ---------- PWA ---------- */
function registerSW(){
  if(!canUseSW()) return;
  window.addEventListener('load',()=>{
    navigator.serviceWorker.register('sw.js').catch(()=>{});
    navigator.serviceWorker.ready.then(()=>{ offlineReady=true; if(ui.view==='function') render(); }).catch(()=>{});
  });
}
window.addEventListener('beforeinstallprompt',e=>{ e.preventDefault(); deferredInstall=e; if(ui.view==='function') render(); });
window.addEventListener('appinstalled',()=>{ deferredInstall=null; if(ui.view==='function') render(); });

/* ---------- start ---------- */
mq.addEventListener('change',()=>{ if(state.settings.theme==='system'){ applyTheme(); render(); } });
window.addEventListener('hashchange',()=>{ const hv=location.hash.slice(1); if(TAB_IDS.includes(hv)&&hv!==ui.view){ ui.view=hv; render(); } });
$('#guideBtn').addEventListener('click',openGuide);
setInterval(checkReminders,15000);
setInterval(()=>{ if(ui.view==='day'&&!ui.sheet&&!isEditing()) render(); },60000);
applyTheme();
render();
checkReminders();
if(state.remind.awake) setAwake(true);
registerSW();
let seenGuide=false; try{ seenGuide=!!localStorage.getItem(GUIDE_KEY); }catch(e){}
if(!seenGuide) openGuide();
})();
