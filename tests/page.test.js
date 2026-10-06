const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const D=require('../miniprogram/shared/domain');
function pageFor(room,call,wxExtra={}){
 let page;const scrolls=[];
 vm.runInNewContext(fs.readFileSync(require.resolve('../miniprogram/pages/index/index.js'),'utf8'),{
  require:p=>p.includes('course-grid')?require('../miniprogram/shared/course-grid'):p.includes('timetable')?require('../miniprogram/shared/timetable'):p.includes('season')?require('../miniprogram/shared/season'):p.includes('poster')?{}:p.includes('shared')?D:p.includes('config')?{mode:'demo'}:{call:call||(async()=>({room,board:[]}))},
  Page:p=>{page=p;},wx:{pageScrollTo:o=>scrolls.push(o),...wxExtra},Date,setInterval,clearInterval
 });
 page.setData=function(values){Object.assign(this.data,values);};return {page,scrolls};
}
const event=id=>({currentTarget:{dataset:{id}}});
test('journal keeps category filter after refresh and reports empty category',async()=>{
 const records=[{id:'a',type:'walk',date:'2026.09.26',at:Date.parse('2026-09-26T08:00:00+08:00')},{id:'b',type:'read',date:'2026.09.25',at:Date.parse('2026-09-25T08:00:00+08:00')}];
 const {page}=pageFor({records});await page.refresh();page.filterRecords(event('read'));assert.equal(page.data.visibleRecords.length,1);assert.equal(page.data.visibleRecords[0].id,'b');await page.refresh();assert.equal(page.data.visibleRecords[0].id,'b');page.filterRecords(event('sport'));assert.equal(page.data.visibleRecords.length,0);
});
test('quick activity selects matching ideas; applying one fills the plan without starting it',()=>{
 const {page,scrolls}=pageFor({records:[]});page.quick(event('music'));assert.equal(page.data.tab,'activities');assert.equal(page.data.selectedType.id,'music');const first=page.data.ideas[0];page.nextIdea();assert.equal(page.data.ideaIndex,1);const idea=page.data.ideas[1];assert.notEqual(idea,first);page.useIdea({currentTarget:{dataset:{idea}}});assert.equal(page.data.place,idea);assert.equal(scrolls.length,1);
});
test('week strip counts distinct completed days within current China-time week',async()=>{
 const start=Date.parse(D.week(Date.now())+'T00:00:00+08:00');const times=[start,start+3600000,start-1];const records=times.map((at,i)=>({id:String(i),type:'walk',date:D.day(at).replace(/-/g,'.'),at}));
 const {page}=pageFor({records});await page.refresh();assert.equal(page.data.weekDays.length,7);assert.equal(page.data.weekCount,1);assert.equal(page.data.weekDays[0].done,true);
});
test('earned-score emphasis only advances for real increases within the same week',async()=>{
 const room={records:[],weekKey:D.week(Date.now()),weekPoints:4};const {page}=pageFor(room);
 await page.refresh();assert.equal(page.data.scoreMotion,0);
 // A new server snapshot must not share the old page-room object.
 page.data.room={...room};room.weekPoints=12;await page.refresh();assert.equal(page.data.scoreMotion,1);
 await page.refresh();assert.equal(page.data.scoreMotion,1);
 page.data.room={...room};room.weekKey='2027-01-04';room.weekPoints=20;await page.refresh();assert.equal(page.data.scoreMotion,1);
});

test('date starts, both join and finish in the date tab; completion offers another date',async()=>{
 let now=Date.now(),actor='a',r=D.room('date-room',{id:'a',name:'我'},now);r.members.push({id:'b',name:'你'});
 const call=async(action,payload)=>{if(!['snapshot','board'].includes(action))r=D.apply(r,actor,action,payload||{},now,'date-1');return {room:D.view(r,actor,now),board:[],now};};
 const {page}=pageFor(null,call);await page.refresh();await page.quick(event('music'));await page.start();assert.equal(page.data.tab,'activities');assert.ok(page.data.room.active);assert.equal(page.data.room.active.canJoin,false);
 actor='b';await page.refresh();assert.equal(page.data.room.active.canJoin,true);await page.act({currentTarget:{dataset:{action:'joinActivity'}}});await page.act({currentTarget:{dataset:{action:'finish'}}});assert.equal(page.data.tab,'activities');assert.equal(page.data.room.active.hasFinished,true);assert.equal(page.data.room.weekPoints,0);
 actor='a';await page.refresh();await page.act({currentTarget:{dataset:{action:'finish'}}});assert.equal(page.data.tab,'activities');assert.equal(page.data.room.active,null);assert.equal(page.data.completion.points,4);
 page.tab({currentTarget:{dataset:{tab:'activities'}}});assert.equal(page.data.completion,null);
});
test('opening with an unfinished date resumes the date tab and a failed start does not navigate',async()=>{
 const now=Date.now();let r=D.room('resume-room',{id:'a',name:'我'},now);r.members.push({id:'b',name:'你'});r=D.apply(r,'a','start',{type:'walk'},now,'resume-date');
 const {page}=pageFor(D.view(r,'a',now));await page.refresh();assert.equal(page.data.tab,'activities');
 page.setData({tab:'activities',place:'启真湖'});page.request=async()=>false;await page.start();assert.equal(page.data.tab,'activities');assert.equal(page.data.place,'启真湖');
});

test('fresh user lands at pairing; all home invitations resolve there, paired users keep home',async()=>{
 const now=Date.now(),r=D.view(D.room('new',{id:'a',name:'我'},now),'a',now);const {page}=pageFor(r);await page.refresh();assert.equal(page.data.tab,'pair');page.tab({currentTarget:{dataset:{tab:'board'}}});assert.equal(page.data.tab,'board');page.tab({currentTarget:{dataset:{tab:'home'}}});assert.equal(page.data.tab,'pair');page.data.room.paired=true;page.tab({currentTarget:{dataset:{tab:'home'}}});assert.equal(page.data.tab,'home');
});
test('local demo refuses real invite instead of pretending to bind remotely',async()=>{
 const {page}=pageFor({records:[]});page.setData({code:'ABCDEF123456'});assert.equal(await page.joinRoom(),false);assert.match(page.data.error,/本机体验不能接受真实邀请/);
});
test('expired invites cannot be shared as valid invitations',async()=>{
 const now=Date.now(),r=D.room('expired',{id:'a',name:'我'},now);r.invite={code:'ABCDEF123456',expiresAt:now-1};const {page}=pageFor(D.view(r,'a',now));await page.refresh();assert.equal(page.data.inviteExpired,true);assert.equal(page.onShareAppMessage().path,'/pages/index/index');
});

test('mutation waits for an in-flight background refresh instead of dropping the click',async()=>{
 let release;const calls=[];const now=Date.now();const room=D.room('queue',{id:'a',name:'我'},now);room.members.push({id:'b',name:'你'});
 const {page}=pageFor(null,async action=>{calls.push(action);if(action==='snapshot')await new Promise(resolve=>release=resolve);return {room:D.view(room,'a',now),board:[],now};});
 const reading=page.request('snapshot');const writing=page.request('start',{type:'music'});release();await Promise.all([reading,writing]);assert.deepEqual(calls,['snapshot','start']);assert.equal(page.data.busy,false);
});
test('partner unlink detected during refresh returns to safe pairing state',async()=>{
 const now=Date.now(),r=D.room('new',{id:'a',name:'我'},now);const {page}=pageFor(D.view(r,'a',now));page.data.room={id:'old',paired:true,records:[],active:{id:'old-date'}};page.data.tab='activities';await page.refresh();assert.equal(page.data.tab,'pair');assert.equal(page.data.completion,null);
});

test('timetable read waits for background snapshot rather than disappearing on navigation',async()=>{
 let release;const calls=[];const now=Date.now(),room=D.room('queue-course',{id:'a',name:'我'},now);
 const {page}=pageFor(null,async action=>{calls.push(action);if(action==='snapshot')await new Promise(resolve=>release=resolve);return {room:D.view(room,'a',now),board:[],now,...(action==='timetable'?{timetable:{mine:{courses:[]},partner:null}}:{})};});
 const reading=page.request('snapshot'),courseRead=page.request('timetable');release();await Promise.all([reading,courseRead]);
 assert.deepEqual(calls,['snapshot','timetable']);assert.ok(page.data.timetable);assert.equal(page.data.busy,false);
});
test('trial checklist follows account progress and unpaired users cannot skip pairing',async()=>{
 const now=Date.now(),room=D.view(D.room('trial',{id:'a',name:'我'},now),'a',now);const {page}=pageFor(room);await page.refresh();
 page.tab({currentTarget:{dataset:{tab:'trial'}}});assert.equal(page.data.trialSteps.filter(s=>s.done).length,0);
 page.trialStep({currentTarget:{dataset:{action:'music'}}});assert.equal(page.data.tab,'pair');
 page.data.room={...room,paired:true,listed:true,records:[{id:'done'}]};page.updateTrial();assert.equal(page.data.trialSteps.filter(s=>s.done).length,3);assert.equal(page.data.trialProgress,'width:100%;');
});

test('cancel confirmation never cancels a replacement activity',async()=>{
 let confirm;const calls=[];const {page}=pageFor(null,async action=>{calls.push(action);}, {showModal:()=>new Promise(resolve=>confirm=resolve),showToast:()=>{}});
 page.data.room={active:{id:'old'}};const pending=page.act({currentTarget:{dataset:{action:'cancel'}}});page.data.room.active={id:'new'};confirm({confirm:true});await pending;assert.equal(calls.length,0);
});
