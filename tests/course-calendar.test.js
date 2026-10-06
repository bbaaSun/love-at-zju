const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../miniprogram/shared/course-calendar'),Z=require('../miniprogram/shared/zju-import');
function draft(){return Z.parseRows([['2026-2027 学年'],['课程代码','课程名称','学期','上课时间','上课地点'],['A','单周实验','秋冬','周四第9,10节{单周}','实验室'],['B','理论课','秋','周二第1,2节','教室'],['C','未排课','短','','']]);}
const settings={term:'秋',start:'2026-09-14',end:'2026-11-08',parityOffset:0};
test('real export semantics: academic year, odd weeks, term filter, ranges and partial week cutoff',()=>{
 const d=draft();assert.equal(d.academicYear,2026);const r=C.expand(d,{...settings,ranges:{A:{first:3,last:5},B:{first:2,last:3}}});assert.equal(r.courses.filter(c=>c.title==='单周实验').length,2);assert.deepEqual(r.courses.filter(c=>c.title==='单周实验').map(c=>c.date),['2026-10-01','2026-10-15']);assert.equal(r.warnings.length,1);
 const winter=C.expand(d,{term:'冬',start:'2026-11-09',end:'2026-11-19'});assert.ok(winter.courses.every(c=>c.title==='单周实验'));assert.equal(winter.courses.length,1);
});
test('holiday cancellation and swapped dates use source week parity, never destination parity or chained moves',()=>{
 const r=C.expand(draft(),{...settings,exceptions:'2026-09-20 | 2026-10-06\n2026-10-06 | 2026-09-20\n2026-10-01 | 停课\n2026-10-10 | 2026-10-01'});
 assert.ok(r.courses.some(c=>c.date==='2026-09-20'&&c.title==='理论课'));assert.ok(!r.courses.some(c=>c.date==='2026-10-06'||c.date==='2026-10-01'));assert.ok(r.courses.some(c=>c.date==='2026-10-10'&&c.title==='单周实验'));
});
test('calendar refuses invalid dates, duplicate overrides, invalid weeks and missing term data',()=>{
 for(const patch of [{start:'2026-09-15'},{end:'2026-02-30'},{end:'2026-09-13'},{term:'夏'},{exceptions:'2026-10-01 | 2027-01-01'},{exceptions:'2026-10-01 | 停课\n2026-10-01 | 停课'},{ranges:{A:{first:4,last:2}}}])assert.throws(()=>C.expand(draft(),{...settings,...patch}));
 assert.equal(C.defaults('秋',2025).start,'');assert.equal(C.defaults('冬',2026).end,'');
});

// School notice: holiday weekends keep their normal classes unless explicitly cancelled.
test('2026 school holiday defaults preserve weekend classes and swap both directions',()=>{
 const d=Z.parseRows([['课程代码','课程名称','学期','上课时间','上课地点'],['A','周末课','秋','周日第1,2节','教室'],['B','周六课','秋','周六第1,2节','教室']]);
 const r=C.expand(d,{term:'秋',...C.defaults('秋',2026)});
 for(const day of ['2026-09-26','2026-09-27','2026-10-04','2026-10-06','2026-10-07'])assert.ok(r.courses.some(c=>c.date===day),day);
 assert.ok(!r.courses.some(c=>c.date==='2026-10-03'));
});
