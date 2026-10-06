const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const file=path.resolve(__dirname,'../miniprogram/pages/index/index.js');
function page(){let p;const calls=[];vm.runInNewContext(fs.readFileSync(file,'utf8'),{Page:x=>p=x,require:n=>n.endsWith('/config')?{mode:'demo'}:require(path.resolve(path.dirname(file),n)),wx:{showModal:async options=>{assert.ok(!options.confirmText||options.confirmText.length<=4,'native modal confirmText is limited to four characters');return {confirm:true};},showToast:()=>{},pageScrollTo:()=>{},nextTick:f=>f()},Date,setInterval,clearInterval});p.setData=function(x){Object.assign(p.data,x);};p.data.room={id:'r'};p.request=async(a,b)=>{calls.push({a,b});return true;};return {p,calls};}
test('preview is automatic; saving preserves other terms and clears local private draft',async()=>{const {p,calls}=page();p.importSource={courses:[{code:'A',title:'课程',term:'秋',meetings:[{weekday:1,start:'08:00',end:'09:35',parity:'all',place:'教室'}],unresolved:[]}]};p.setData({importTerm:'秋',importStart:'2026-09-14',importEnd:'2026-09-20',importRules:[{code:'A',first:1,last:1}],timetable:{mine:{courses:[{date:'2026-11-09',start:'08:00',end:'09:35',title:'冬课',place:''},{date:'2026-09-14',start:'10:00',end:'11:35',title:'旧课',place:''}]}}});p.previewImport();assert.equal(p.data.courseDraft.length,1);p.importField({currentTarget:{dataset:{field:'importEnd'}},detail:{value:'2026-09-21'}});assert.equal(p.data.courseDraft,null);assert.equal(p.data.calendarReviewed,false);p.data.calendarReviewed=true;p.previewImport();await p.saveImportedCourses();assert.equal(calls.length,1);assert.deepEqual(calls[0].b.courses.map(c=>c.title),['课程','冬课']);assert.equal(p.importSource,null);assert.equal(p.data.courseDraft,null);});
test('malformed date settings cannot be saved',async()=>{const {p,calls}=page();p.importSource={courses:[]};p.setData({calendarReviewed:true,importStart:'invalid',importEnd:'2026-09-20'});p.previewImport();await p.saveImportedCourses();assert.equal(calls.length,0);assert.ok(p.data.error);});

test('leaving timetable clears private drafts and re-enables background refresh',()=>{const {p}=page();p.data.room={id:'r',paired:true};p.data.courseEditing=true;p.data.courseDraft=[{}];p.importSource={courses:[{}]};p.tab({currentTarget:{dataset:{tab:'journal'}}});assert.equal(p.data.courseEditing,false);assert.equal(p.data.courseDraft,null);assert.equal(p.importSource,null);assert.equal(p.data.tab,'journal');});

test('known fall term previews immediately; unknown year requires explicit dates',()=>{
 const {p}=page();const source={academicYear:2026,issues:[],courses:[{code:'A',title:'课程',term:'秋',unresolved:[],meetings:[{weekday:1,start:'08:00',end:'09:35',parity:'all',place:'教室'}]}]};
 p.importSource=source;p.setImportTerm('秋');assert.ok(p.data.courseDraft.length>0);assert.equal(p.data.importAdvanced,false);
 source.academicYear=2025;p.setImportTerm('秋');assert.equal(p.data.courseDraft,null);assert.equal(p.data.importAdvanced,true);assert.equal(p.data.importStart,'');
});

test('first file import saves explicit coverage even with no previous table',async()=>{
 const {p,calls}=page();p.data.courseDraft=[{date:'2026-10-08',start:'08:00',end:'09:35',title:'课程',place:''}];p.importPeriod={start:'2026-09-14',end:'2026-11-08'};p.data.timetable={mine:null};
 await p.saveImportedCourses();assert.equal(calls.length,1);assert.deepEqual(calls[0].b.coverage,[{start:'2026-09-14',end:'2026-11-08'}]);
});
test('timetable opened from dates returns there, and week navigation preserves weekday',async()=>{
 const {p}=page();p.data.tab='activities';await p.openTimetable();assert.equal(p.data.courseReturn,'activities');
 const T=require('../miniprogram/shared/timetable');p.data.courseDate=T.week(Date.now(),0)[3].date;p.courseShift({currentTarget:{dataset:{delta:1}}});assert.equal(p.data.courseDate,T.week(Date.now(),1)[3].date);
 p.courseToday();assert.equal(p.data.courseWeek,0);p.courseBack();assert.equal(p.data.tab,'activities');
});
