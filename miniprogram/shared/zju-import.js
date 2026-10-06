/* Structure verified against the official undergraduate timetable XLSX export.
 * Preserve recurrence rules. Resolving dates requires a separately verified calendar.
 */
const BELLS=[['08:00','08:45'],['08:50','09:35'],['10:00','10:45'],['10:50','11:35'],['11:40','12:25'],['13:25','14:10'],['14:15','15:00'],['15:05','15:50'],['16:15','17:00'],['17:05','17:50'],['18:50','19:35'],['19:40','20:25'],['20:30','21:15']];
const HEADERS=['课程代码','课程名称','学期','上课时间','上课地点'];
function parseRows(rows){
 if(!Array.isArray(rows)||rows.length>500)throw new Error('课表文件内容过多或格式不正确');
 const head=rows.findIndex(row=>Array.isArray(row)&&HEADERS.every(h=>row.includes(h)));
 if(head<0)throw new Error('不是已支持的本科教务课表列表，请从“列表—导出”下载');
 const titleText=rows.slice(0,head).flat().join(' '),yearMatch=/(20\d{2})\s*[-—–]\s*(20\d{2})/.exec(titleText);
 const academicYear=yearMatch&&Number(yearMatch[2])===Number(yearMatch[1])+1?Number(yearMatch[1]):null;
 const columns=HEADERS.map(h=>rows[head].indexOf(h)),courses=new Map(),issues=[];
 for(const row of rows.slice(head+1)){
  if(!Array.isArray(row))throw new Error('课程行格式不正确');
  const [code,title,term,rawTime,rawPlace]=columns.map(i=>String(row[i]||'').trim());
  if(!code&&!title)continue;
  if(!/^[A-Za-z0-9_-]{1,40}$/.test(code)||!title||title.length>60)throw new Error('存在无法识别的课程行，请核对文件');
  const key=code+'|'+term;
  let course=courses.get(key);if(course&&course.title!==title)throw new Error('同一课程代码对应不同名称，请核对');
  if(!course){course={code,title,term,meetings:[],unresolved:[]};courses.set(key,course);}
  if(!['秋','冬','秋冬','春','夏','春夏','短'].includes(term)){course.unresolved.push('未知学期：'+term);continue;}
  if(!rawTime){course.unresolved.push('未安排上课时间');continue;}
  const times=rawTime.split(/[;；\n]+/).filter(Boolean),places=rawPlace.split(/[;；\n]+/).filter(Boolean);
  if(places.length!==times.length){course.unresolved.push('上课时间与地点数量不一致');continue;}
  for(let i=0;i<times.length;i++){
   const text=times[i].trim(),m=/^周([一二三四五六日天])第(\d+(?:[,，]\d+)*)节(?:\{(单周|双周)\})?$/.exec(text);
   if(!m){course.unresolved.push('待核对时间：'+text);continue;}
   const sections=m[2].split(/[,，]/).map(Number);
   if(sections.some((x,i)=>x<1||x>13||(i>0&&x<=sections[i-1]))){course.unresolved.push('无效节次：'+text);continue;}
   // Split non-consecutive lessons instead of treating the intervening period as occupied.
   const runs=[];for(const n of sections){const last=runs[runs.length-1];if(last&&last[last.length-1]===n-1)last.push(n);else runs.push([n]);}
   for(const run of runs){const meeting={weekday:'一二三四五六日'.indexOf(m[1]==='天'?'日':m[1])+1,sections:run,start:BELLS[run[0]-1][0],end:BELLS[run[run.length-1]-1][1],parity:m[3]==='单周'?'odd':m[3]==='双周'?'even':'all',place:places[i]};
    if(!course.meetings.some(x=>JSON.stringify(x)===JSON.stringify(meeting)))course.meetings.push(meeting);
   }
  }
 }
 for(const course of courses.values()){
  course.unresolved=[...new Set(course.unresolved)];
  for(const reason of course.unresolved)issues.push({course:course.title,reason});
 }
 if(!courses.size)throw new Error('文件没有可识别的课程');
 return {schema:'zju-recurring-draft-v1',status:'needs-calendar-review',source:'本科教务网官方列表导出',academicYear,courses:[...courses.values()],issues,calendarRequired:['各小学期第一教学周的星期一日期','每门课程起止周与单双周基准','节假日停课和补课安排'],note:'此文件保留课程规则，尚未转换为具体上课日期，不可直接用于空闲计算。'};
}
module.exports={parseRows,BELLS};
