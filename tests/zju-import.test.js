const test=require('node:test'),assert=require('node:assert/strict'),Z=require('../miniprogram/shared/zju-import');
const header=['课程代码','课程名称','教师姓名','学期','上课时间','上课地点','选课时间'];
const row=(time,place='西1-101')=>['CS1','示例程序设计','无需保留','秋冬',time,place,'无需保留'];
test('official export duplicate rows merge; odd-week labs remain distinct',()=>{
 const d=Z.parseRows([['标题'],header,row('周二第3,4节;周四第9,10节{单周}','西1-101;机房'),row('周二第3,4节')]);
 assert.equal(d.courses.length,1);assert.equal(d.courses[0].meetings.length,2);assert.equal(d.courses[0].meetings[1].parity,'odd');assert.equal(d.courses[0].meetings[1].end,'17:50');assert.equal(d.status,'needs-calendar-review');assert.ok(!JSON.stringify(d).includes('无需保留'));
});
test('nonconsecutive sections split and laboratory end times are exact',()=>{const d=Z.parseRows([header,row('周三第3,4,5节'),row('周一第6,8节')]);assert.equal(d.courses[0].meetings[0].end,'12:25');assert.equal(d.courses[0].meetings.length,3);});
test('unknown week syntax, ambiguous places and unscheduled courses are flagged, never guessed',()=>{
 const d=Z.parseRows([header,row('周三第1,2节{第2-7周}'),['CS2','短学期实践','','短','',''],['CS3','另一门课','','秋','周一第1节;周二第2节','教室']]);
 assert.equal(d.issues.length,3);assert.ok(d.courses.every(c=>!c.meetings.length));assert.throws(()=>Z.parseRows([['其他表格']]));
});
