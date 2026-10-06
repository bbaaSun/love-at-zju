const T=require('./timetable');
const DAY=86400000;
function stamp(s){if(typeof s!=='string'||!/^20\d\d-\d\d-\d\d$/.test(s))throw new Error('请填写有效日期');const t=Date.parse(s+'T00:00:00Z');if(!Number.isFinite(t)||new Date(t).toISOString().slice(0,10)!==s)throw new Error('请填写有效日期');return t;}
function date(t){return new Date(t).toISOString().slice(0,10);}
// Each actual date uses either its original timetable, a referenced date, or no classes.
// Reference dates always use the unmodified teaching-week calendar (no chained moves).
function exceptions(text){const map={};for(const line of String(text||'').split('\n').filter(x=>x.trim())){const p=line.split('|').map(x=>x.trim());if(p.length!==2)throw new Error('调课格式：实际日期 | 参照日期（或“停课”）');stamp(p[0]);if(p[1]!=='停课')stamp(p[1]);if(map[p[0]])throw new Error('同一天不能重复设置调课');map[p[0]]=p[1];}if(Object.keys(map).length>60)throw new Error('最多设置 60 天调课');return map;}
function expand(draft,settings){
 const start=stamp(settings.start),end=stamp(settings.end);if(new Date(start).getUTCDay()!==1)throw new Error('第一教学周必须从星期一开始');if(end<start||end-start>140*DAY)throw new Error('结束日期应在开始后 20 周以内');
 if(!['秋','冬','春','夏'].includes(settings.term))throw new Error('请选择小学期');
 const offset=Number(settings.parityOffset||0);if(![0,1].includes(offset))throw new Error('单双周基准有误');
 const rules=exceptions(settings.exceptions),courses=[],warnings=[],active=draft.courses.filter(c=>c.term.includes(settings.term));
 if(!active.length)throw new Error('文件中没有这个小学期的课程');
 const ranges=settings.ranges||{};
 for(const c of active){const r=ranges[c.code]||{first:1,last:Math.ceil((end-start+DAY)/(7*DAY))};if(!Number.isInteger(Number(r.first))||!Number.isInteger(Number(r.last))||+r.first<1||+r.last<+r.first||+r.last>20)throw new Error(c.title+' 的起止周应为 1–20 的整数');}
 for(let t=start;t<=end;t+=DAY){const actual=date(t),ref=rules[actual]||actual;if(ref==='停课')continue;const src=stamp(ref);if(src<start||src>end)throw new Error('调课参照日期必须在当前小学期内');const week=Math.floor((src-start)/(7*DAY))+1,weekday=(new Date(src).getUTCDay()+6)%7+1;
  for(const c of active){const range=ranges[c.code]||{first:1,last:20};if(week<+range.first||week>+range.last)continue;
   for(const m of c.meetings){if(m.weeks&&(week<m.weeks.first||week>m.weeks.last))continue;if(m.weekday!==weekday||m.parity==='odd'&&(week+offset)%2!==1||m.parity==='even'&&(week+offset)%2!==0)continue;courses.push({date:actual,start:m.start,end:m.end,title:c.title,place:m.place});}
  }
 }
 for(const c of draft.courses){if(c.term===settings.term||c.term.includes(settings.term)||c.term==='短')for(const reason of c.unresolved)warnings.push(c.title+'：'+reason);}
 if(!courses.length)throw new Error('这些设置没有生成课程，请检查学期和周次');
 return {courses:T.normalize(courses),warnings,start:settings.start,end:settings.end};
}
function defaults(term,year){
 if(year===2026&&term==='秋')return {start:'2026-09-14',end:'2026-11-08',exceptions:'2026-09-20 | 2026-10-06\n2026-09-25 | 停课\n2026-10-01 | 停课\n2026-10-02 | 停课\n2026-10-03 | 停课\n2026-10-05 | 停课\n2026-10-06 | 2026-09-20\n2026-10-07 | 2026-10-10\n2026-10-10 | 2026-10-07\n2026-10-17 | 2026-10-02'};
 // Other terms require explicit dates. Do not invent winter/spring course end dates.
 return {start:year===2026&&term==='冬'?'2026-11-09':'',end:'',exceptions:''};
}
module.exports={expand,defaults,exceptions};
