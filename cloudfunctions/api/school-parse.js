const {createHash}=require('crypto');
const BELLS=[['08:00','08:45'],['08:50','09:35'],['10:00','10:45'],['10:50','11:35'],['11:40','12:25'],['13:25','14:10'],['14:15','15:00'],['15:05','15:50'],['16:15','17:00'],['17:05','17:50'],['18:50','19:35'],['19:40','20:25'],['20:30','21:15']];
function decode(s){return String(s||'').replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(+n)).replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').trim();}
function parse(data,year,term){
 if(!data||!Array.isArray(data.kbList)||data.kbList.length>500)throw new Error('教务课表格式已变化，未覆盖现有课表');
 if(data.xkkg===false||data.xkkg==='false')throw new Error('教务网暂未开放该学期课表');
 if(!data.kbList.length)throw new Error('该学期没有已安排的课程，未覆盖现有课表');
 const courses=new Map(),issues=[];
 for(const item of data.kbList){
  const lines=String(item.kcb||'').replace(/<br\s*\/?\s*>|zwf/gi,'\n').replace(/<[^>]*>/g,'').split('\n').map(decode).filter(Boolean);
  const title=lines[0]||'未识别课程',rule=lines[1]||'',m=/^(秋冬|春夏|秋|冬|春|夏)\{第(\d+)-(\d+)周\|\d+节\/(?:单周|双周|周)\}$/.exec(rule);
  const weekday=Number(item.xqj),first=Number(item.djj),count=Number(item.skcd),parity=String(item.dsz);
  if(!m||title.length>60||lines.length<4||![0,1,2].includes(Number(parity))||!Number.isInteger(weekday)||weekday<1||weekday>7||!Number.isInteger(first)||!Number.isInteger(count)||first<1||count<1||first+count>14||+m[2]<1||+m[3]>20||+m[3]<+m[2]){issues.push({course:title,reason:'教务返回的周次或时间格式待核对，未自动排课'});continue;}
  if(String(item.sfqd)!=='1'){issues.push({course:title,reason:'教务标记为待定课程，未自动排课'});continue;}
  const code=createHash('sha256').update(title+'|'+m[1]).digest('hex').slice(0,16);
  if(!courses.has(code))courses.set(code,{code,title,term,meetings:[],unresolved:[]});
  const meeting={weekday,start:BELLS[first-1][0],end:BELLS[first+count-2][1],parity:parity==='2'?'all':parity==='0'?'odd':'even',place:lines[3].slice(0,120),weeks:{first:+m[2],last:+m[3]}};
  const course=courses.get(code);if(!course.meetings.some(x=>JSON.stringify(x)===JSON.stringify(meeting)))course.meetings.push(meeting);
 }
 for(const name of ['fKbList','sjkList','xskList','ywkList','jxkList'])if(Array.isArray(data[name])&&data[name].length)issues.push({course:'其他教学安排',reason:'包含实践、线上或待安排课程，请在教务网核对'});
 if(!courses.size)throw new Error('课表暂无法可靠解析，未覆盖现有课表');
 return {academicYear:year,courses:[...courses.values()],issues,source:'本科教务网',schema:'zju-recurring-draft-v1'};
}
module.exports={parse,decode};
