/* Exact dated meetings: no invented teaching-week or bell-time assumptions. */
const DAY=86400000;
function validDate(s){if(typeof s!=='string'||!/^20\d{2}-\d{2}-\d{2}$/.test(s))return false;const t=Date.parse(s+'T12:00:00+08:00');return Number.isFinite(t)&&new Date(t+8*3600000).toISOString().slice(0,10)===s;}
function minute(s){if(typeof s!=='string'||!/^\d{2}:\d{2}$/.test(s))return NaN;const [h,m]=s.split(':').map(Number);return h<24&&m<60?h*60+m:NaN;}
function time(n){return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');}
function normalize(rows){
 if(!Array.isArray(rows)||rows.length>400)throw new Error('每次最多导入 400 次课程');
 const seen=new Set();return rows.map((r,i)=>{
  if(!r||!validDate(r.date)||!Number.isFinite(minute(r.start))||!Number.isFinite(minute(r.end))||minute(r.end)<=minute(r.start))throw new Error('第 '+(i+1)+' 行的日期或起止时间有误');
  if(typeof r.title!=='string'||!r.title.trim()||r.title.trim().length>60)throw new Error('第 '+(i+1)+' 行课程名应为 1–60 字');
  if(r.place!=null&&(typeof r.place!=='string'||r.place.length>80))throw new Error('第 '+(i+1)+' 行地点过长');
  return {date:r.date,start:r.start,end:r.end,title:r.title.trim(),place:(r.place||'').trim()};
 }).filter(r=>{const key=JSON.stringify(r);if(seen.has(key))return false;seen.add(key);return true;}).sort((a,b)=>(a.date+a.start).localeCompare(b.date+b.start));
}
function parse(text){
 if(typeof text!=='string'||text.length>100000)throw new Error('导入文本过长');
 const lines=text.trim().split(/\r?\n/).filter(s=>s.trim());if(!lines.length)throw new Error('请先粘贴课程数据');
 return normalize(lines.map((line,i)=>{const p=line.split(/[|\t]/).map(x=>x.trim());if(p.length<4||p.length>5)throw new Error('第 '+(i+1)+' 行请按 日期 | 开始 | 结束 | 课程 | 地点 填写');return {date:p[0],start:p[1],end:p[2],title:p[3],place:p[4]||''};}));
}
// Coverage describes confirmed calendar dates, including days with zero courses.
// Legacy/manual rows prove only their own dates, never the gap between semesters.
function coverage(ranges,courses){
 if(ranges!==undefined&&(!Array.isArray(ranges)||ranges.length>400))throw new Error('课表日期范围无效');
 const rows=(ranges||[]).concat((courses||[]).map(c=>({start:c.date,end:c.date})));
 const sorted=rows.map(r=>{if(!r||!validDate(r.start)||!validDate(r.end)||r.end<r.start||Date.parse(r.end)-Date.parse(r.start)>366*DAY)throw new Error('课表日期范围无效');return {start:r.start,end:r.end};}).sort((a,b)=>a.start.localeCompare(b.start));
 const result=[];for(const r of sorted){const last=result[result.length-1];if(last&&Date.parse(r.start)-Date.parse(last.end)<=DAY&&Date.parse(r.end>last.end?r.end:last.end)-Date.parse(last.start)<=366*DAY){if(r.end>last.end)last.end=r.end;}else result.push(r);}
 if(result.length>400)throw new Error('课表日期范围过多');return result;
}
function exportView(table,allowed){return allowed&&table?{courses:table.courses,coverage:coverage(table.coverage,table.courses),updatedAt:table.updatedAt}:null;}
function view(room,actor,profiles){
 const mine=profiles.find(p=>p.id===actor),other=profiles.find(p=>p.id!==actor);
 const own=mine&&mine.timetable,partner=other&&other.timetable;
 return {mine:exportView(own,true),partner:exportView(partner,!!partner&&partner.sharedRoomId===room.id),sharing:!!own&&own.sharedRoomId===room.id,paired:room.members.length===2};
}
function week(now,offset){const d=new Date(now+8*3600000);const weekday=(d.getUTCDay()+6)%7;const monday=Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate())-(weekday-offset*7)*DAY;return Array.from({length:7},(_,i)=>({date:new Date(monday+i*DAY).toISOString().slice(0,10),label:['一','二','三','四','五','六','日'][i],day:new Date(monday+i*DAY).getUTCDate()}));}
function covers(table,date){return !!table&&validDate(date)&&coverage(table.coverage,table.courses).some(r=>r.start<=date&&r.end>=date);}
function freeSlots(mine,partner,date){
 if(!covers(mine,date)||!covers(partner,date))return [];
 const occupied=mine.courses.concat(partner.courses).filter(r=>r.date===date).map(r=>[Math.max(480,minute(r.start)),Math.min(1320,minute(r.end))]).filter(([s,e])=>e>s).sort((a,b)=>a[0]-b[0]);
 const free=[];let cursor=480;for(const [s,e] of occupied){if(s-cursor>=30)free.push({start:time(cursor),end:time(s)});cursor=Math.max(cursor,e);}if(1320-cursor>=30)free.push({start:time(cursor),end:'22:00'});return free;
}
module.exports={normalize,parse,view,week,freeSlots,covers,coverage};
