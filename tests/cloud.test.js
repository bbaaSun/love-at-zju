const test=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');const crypto=require('node:crypto');const D=require('../cloudfunctions/api/domain');
const clone=x=>x==null?x:JSON.parse(JSON.stringify(x));
function harness(){let now=Date.now();let user='a';let data=new Map();let queue=Promise.resolve();
function source(store){return {collection(name){return {doc(id){return {async get(){if(!store.has(name+'/'+id))throw new Error('document does not exist');return {data:clone(store.get(name+'/'+id))};},async set({data:d}){store.set(name+'/'+id,clone(d));},async remove(){store.delete(name+'/'+id);}};},where(query){return {orderBy(field){return {limit(n){return {async get(){return {data:[...store.entries()].filter(([k,v])=>k.startsWith(name+'/')&&Object.entries(query).every(([key,value])=>v[key]===value)).map(x=>clone(x[1])).sort((a,b)=>b[field]-a[field]).slice(0,n)};}};}};}};}};}};}
const db={collection:n=>source(data).collection(n),runTransaction(fn){const next=queue.then(async()=>{const copy=new Map([...data].map(([k,v])=>[k,clone(v)]));const result=await fn(source(copy));data=copy;return result;});queue=next.catch(()=>{});return next;}};
const cloud={init(){},DYNAMIC_CURRENT_ENV:'test',database:()=>db,getWXContext:()=>({OPENID:user})};
class Clock extends Date{static now(){return now;}}
const context={Date:Clock,require:n=>n==='wx-server-sdk'?cloud:n==='crypto'?crypto:n==='./timetable'?require('../cloudfunctions/api/timetable'):n==='./season'?require('../cloudfunctions/api/season'):D,exports:{},console:{error(){}}};vm.runInNewContext(fs.readFileSync(require.resolve('../cloudfunctions/api/index'),'utf8'),context);
return {setTime:t=>{now=t;},async call(who,action,payload={}){user=who;return context.exports.main({action,payload});},entries:()=>data};}
test('cloud pairs two distinct users, rejects reused invite, keeps spaces private',async()=>{const h=harness();assert.equal((await h.call('a','snapshot')).ok,true);await h.call('b','snapshot');await h.call('c','snapshot');const invited=await h.call('a','invite');const code=invited.data.room.invite.code;assert.match(code,/^[A-F0-9]{12}$/);const joined=await h.call('b','joinRoom',{code});assert.equal(joined.ok,true);assert.equal(joined.data.room.members.length,2);assert.equal((await h.call('c','joinRoom',{code})).ok,false);assert.equal((await h.call('c','snapshot')).data.room.members.length,1);});
test('cloud derives actor from OPENID, ignores forged actor, rejects demo controls',async()=>{const h=harness();await h.call('a','snapshot');await h.call('b','snapshot');const code=(await h.call('a','invite')).data.room.invite.code;await h.call('b','joinRoom',{code});const started=await h.call('a','start',{type:'music'});const id=started.data.room.active.id;const b=(await h.call('b','snapshot')).data.room.me;assert.equal((await h.call('a','joinActivity',{id,actor:b})).data.room.active.startedAt,null);assert.equal((await h.call('a','finish',{id,actor:b})).ok,false);assert.equal((await h.call('a','advance')).ok,false);assert.equal((await h.call('a','demoPair')).ok,false);assert.equal((await h.call('','snapshot')).ok,false);});
test('cloud scores only once and publishes sanitized opt-in leaderboard',async()=>{const h=harness();await h.call('a','snapshot');await h.call('b','snapshot');const code=(await h.call('a','invite')).data.room.invite.code;await h.call('b','joinRoom',{code});const id=(await h.call('a','start',{type:'music'})).data.room.active.id;await h.call('b','joinActivity',{id});await h.call('a','finish',{id});const result=await h.call('b','finish',{id});assert.equal(result.data.room.total,4);assert.equal((await h.call('a','finish',{id})).data.room.total,4);assert.equal((await h.call('a','vote',{value:true})).data.board.length,0);const board=(await h.call('b','vote',{value:true})).data.board;assert.equal(board.length,1);assert.deepEqual(Object.keys(board[0]).sort(),['id','label','points']);assert.equal((await h.call('a','vote',{value:false})).data.board.length,0);});

test('cloud weekly claims reject forged weeks, persist across Monday and are idempotent for both partners',async()=>{
 const h=harness(),mon=Date.parse('2026-09-21T00:00:00+08:00');h.setTime(mon);
 await h.call('a','snapshot');await h.call('b','snapshot');const code=(await h.call('a','invite')).data.room.invite.code;await h.call('b','joinRoom',{code});
 const id=(await h.call('a','start',{type:'music'})).data.room.active.id;await h.call('b','joinActivity',{id});await h.call('a','finish',{id});await h.call('b','finish',{id});
 await h.call('a','vote',{value:true});await h.call('b','vote',{value:true});
 assert.equal((await h.call('a','claim',{current:true,key:'2026-09-21',points:9999})).ok,false);
 h.setTime(mon+7*86400000);const report=(await h.call('a','season')).data.season;assert.equal(report.points,4);assert.equal(report.rank,1);assert.equal(report.canClaim,true);
 assert.equal((await h.call('a','claim')).data.season.claimed,true);assert.equal((await h.call('b','claim')).data.season.claimed,true);
 assert.equal([...h.entries().keys()].filter(k=>k.startsWith('rewardClaims/')).length,1);
 await h.call('c','snapshot');assert.equal((await h.call('c','claim',{roomId:report.id})).ok,false);
 const current=(await h.call('a','season',{current:true})).data.season;assert.equal(current.points,0);assert.equal(current.canClaim,false);
 h.setTime(mon+14*86400000);const archived=(await h.call('b','season',{key:'2026-09-21'})).data.season;assert.equal(archived.points,4);assert.equal(archived.claimed,true);assert.equal((await h.call('b','claim',{key:'2026-09-21'})).data.season.claimed,true);
});

test('revoked invitations cannot bind; names persist across joining',async()=>{
 const h=harness();await h.call('a','snapshot');await h.call('b','snapshot');
 assert.equal((await h.call('b','profile',{name:'小鹿'})).ok,true);
 assert.equal((await h.call('b','profile',{name:' '})).ok,false);
 const code=(await h.call('a','invite')).data.room.invite.code;
 assert.equal((await h.call('a','revokeInvite')).data.room.invite,null);
 assert.equal((await h.call('b','joinRoom',{code})).ok,false);
 h.setTime(Date.now()+4000);const fresh=(await h.call('a','invite')).data.room.invite.code;
 assert.notEqual(code,fresh);const joined=await h.call('b','joinRoom',{code:fresh});assert.equal(joined.ok,true);
 assert.equal(joined.data.room.members[1].name,'小鹿');
});
test('leaving preserves private archives, cancels activity, removes current rank and permits new partner',async()=>{
 const h=harness();await h.call('a','snapshot');await h.call('b','snapshot');await h.call('c','snapshot');
 const code=(await h.call('a','invite')).data.room.invite.code;await h.call('b','joinRoom',{code});
 const id=(await h.call('a','start',{type:'music'})).data.room.active.id;await h.call('b','joinActivity',{id});await h.call('a','finish',{id});await h.call('b','finish',{id});
 await h.call('a','vote',{value:true});const paired=await h.call('b','vote',{value:true}),roomId=paired.data.room.id;
 await h.call('a','start',{type:'walk'});
 assert.equal((await h.call('a','leave',{roomId:'forged'})).ok,false);
 assert.equal((await h.call('a','leave',{roomId})).data.room.paired,false);
 assert.equal((await h.call('b','snapshot')).data.room.paired,false);
 assert.equal((await h.call('a','leave',{roomId})).ok,false);
 assert.equal((await h.call('a','board')).data.board.length,0);
 for(const person of ['a','b']){const archive=(await h.call(person,'archives')).data.archives.items[0];assert.equal(archive.id,roomId);assert.equal(archive.active,null);assert.equal(archive.records[0].points,4);}
 const newCode=(await h.call('a','invite')).data.room.invite.code;await h.call('c','joinRoom',{code:newCode});
 assert.equal((await h.call('c','archives',{roomId,offset:0})).data.archives.items.length,0);
 assert.equal((await h.call('a','note',{id,note:'cannot edit old archive'})).ok,false);
 const second=(await h.call('a','start',{type:'music'})).data.room.active.id;await h.call('c','joinActivity',{id:second});await h.call('a','finish',{id:second});
 assert.equal((await h.call('c','finish',{id:second})).data.room.weekPoints,0,'rebinding cannot reset same-day type limit');
});

test('timetables are owner-written, explicitly shared, revocable and never inherited by a new partner',async()=>{
 const h=harness();for(const u of ['a','b','c'])await h.call(u,'snapshot');
 const code=(await h.call('a','invite')).data.room.invite.code;const r=(await h.call('b','joinRoom',{code})).data.room;
 const courses=[{date:'2026-10-08',start:'08:00',end:'09:35',title:'私密课程',place:'东1'}];
 assert.equal((await h.call('a','saveTimetable',{roomId:'forged',courses})).ok,false);
 const saved=await h.call('a','saveTimetable',{roomId:r.id,courses,actor:r.members[1].id});assert.equal(saved.ok,true);assert.equal(saved.data.timetable.sharing,false);
 assert.equal((await h.call('b','timetable')).data.timetable.partner,null);
 assert.equal((await h.call('b','timetable')).data.timetable.mine,null);
 await h.call('a','shareTimetable',{roomId:r.id,value:true});assert.equal((await h.call('b','timetable')).data.timetable.partner.courses[0].title,'私密课程');
 assert.equal((await h.call('c','timetable',{roomId:r.id})).data.timetable.partner,null);
 await h.call('a','shareTimetable',{roomId:r.id,value:false});assert.equal((await h.call('b','timetable')).data.timetable.partner,null);
 await h.call('a','shareTimetable',{roomId:r.id,value:true});await h.call('a','leave',{roomId:r.id});
 assert.equal((await h.call('b','timetable')).data.timetable.partner,null);
 const fresh=(await h.call('a','invite')).data.room.invite.code;await h.call('c','joinRoom',{code:fresh});
 assert.equal((await h.call('c','timetable')).data.timetable.partner,null);
 const own=(await h.call('a','timetable'));assert.equal(own.data.timetable.mine.courses.length,1);assert.equal(own.data.timetable.sharing,false);
 assert.equal((await h.call('a','clearTimetable',{roomId:own.data.room.id})).data.timetable.mine,null);
});

test('cloud validates and persists coverage, shares it only with consent, and supports legacy clients',async()=>{
 const h=harness();await h.call('a','snapshot');await h.call('b','snapshot');const code=(await h.call('a','invite')).data.room.invite.code;const r=(await h.call('b','joinRoom',{code})).data.room;
 const courses=[{date:'2026-10-08',start:'08:00',end:'09:35',title:'课程',place:''}],coverage=[{start:'2026-10-01',end:'2026-10-11'}];
 assert.equal((await h.call('a','saveTimetable',{roomId:r.id,courses,coverage:[{start:'2026-02-30',end:'2026-10-11'}]})).ok,false);
 assert.equal((await h.call('a','timetable')).data.timetable.mine,null);
 const saved=await h.call('a','saveTimetable',{roomId:r.id,courses,coverage});assert.deepEqual(saved.data.timetable.mine.coverage,coverage);
 assert.equal((await h.call('b','timetable')).data.timetable.partner,null);
 await h.call('a','shareTimetable',{roomId:r.id,value:true});assert.deepEqual((await h.call('b','timetable')).data.timetable.partner.coverage,coverage);
 const legacy=await h.call('a','saveTimetable',{roomId:r.id,courses});assert.equal(legacy.ok,true);assert.deepEqual(legacy.data.timetable.mine.coverage,[{start:'2026-10-08',end:'2026-10-08'}]);
});
