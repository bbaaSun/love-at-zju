const test=require('node:test');const assert=require('node:assert/strict');const D=require('../miniprogram/shared/domain');
const T=Date.parse('2026-09-26T02:00:00Z');
function paired(){const r=D.room('r',{id:'a'},T);r.members.push({id:'b'});return r;}
function completed(r,type,id='x',at=T){r=D.apply(r,'a','start',{type},at,id);r=D.apply(r,'b','joinActivity',{id},at,id);const end=at+D.TYPES.find(t=>t.id===type).minutes*60000;r=D.apply(r,'a','finish',{id},end,id);return D.apply(r,'b','finish',{id},end,id);}
test('cannot start alone or act as outsider',()=>{assert.throws(()=>D.apply(D.room('r',{id:'a'},T),'a','start',{type:'walk'},T,'x'));assert.throws(()=>D.apply(paired(),'c','vote',{value:true},T,'x'));});
test('both join and minimum elapsed time required',()=>{let r=D.apply(paired(),'a','start',{type:'walk'},T,'x');assert.throws(()=>D.apply(r,'a','finish',{id:'x'},T,'x'));r=D.apply(r,'b','joinActivity',{id:'x'},T+60000,'x');assert.throws(()=>D.apply(r,'a','finish',{id:'x'},T+15*60000,'x'));});
test('same actor cannot complete for partner, repeated finish is idempotent',()=>{let r=D.apply(paired(),'a','start',{type:'music'},T,'x');r=D.apply(r,'b','joinActivity',{id:'x'},T,'x');r=D.apply(r,'a','finish',{id:'x'},T,'x');r=D.apply(r,'a','finish',{id:'x'},T,'x');assert.equal(r.total,0);r=D.apply(r,'b','finish',{id:'x'},T,'x');assert.equal(r.total,4);r=D.apply(r,'b','finish',{id:'x'},T,'x');assert.equal(r.total,4);assert.equal(r.records.length,1);});
test('per category and 30 points daily cap',()=>{let r=paired();for(const [i,type] of ['study','sport','read','movie','music','walk','study'].entries())r=completed(r,type,'id'+i,T+i*1800000);assert.equal(r.total,30);assert.equal(r.records.length,7);assert.equal(r.records[0].points,0);assert.equal(r.daily.points,30);});
test('daily cap survives history truncation',()=>{let r=paired();r=completed(r,'music','first');for(let i=0;i<310;i++)r=completed(r,'music','repeat'+i);assert.equal(r.total,4);assert.equal(r.records.length,300);});
test('daily reset uses China time',()=>{let r=completed(paired(),'music','first',Date.parse('2026-09-26T15:59:00Z'));r=completed(r,'music','second',Date.parse('2026-09-26T16:01:00Z'));assert.equal(r.total,8);assert.equal(r.daily.points,4);});
test('week resets on Monday China time and snapshot clears stale week',()=>{let r=completed(paired(),'music','first',Date.parse('2026-09-27T15:59:00Z'));const next=Date.parse('2026-09-27T16:01:00Z');assert.equal(D.view(r,'a',next).weekPoints,0);r=completed(r,'music','second',next);assert.equal(r.weekPoints,4);assert.equal(r.total,8);});
test('ranking requires two votes and either can withdraw',()=>{let r=paired();r=D.apply(r,'a','vote',{value:true},T);assert.equal(r.listed,false);r=D.apply(r,'b','vote',{value:true},T);assert.equal(r.listed,true);r=D.apply(r,'a','vote',{value:false},T);assert.equal(r.listed,false);});
test('stale activity id cannot cancel or finish current activity',()=>{let r=D.apply(paired(),'a','start',{type:'music'},T,'new');assert.throws(()=>D.apply(r,'a','cancel',{id:'old'},T));assert.throws(()=>D.apply(r,'a','finish',{id:'old'},T));});
test('note validation and immutability',()=>{let r=completed(paired(),'music');const updated=D.apply(r,'a','note',{id:'x',note:' 今天的歌 '},T);assert.equal(updated.records[0].note,'今天的歌');assert.equal(r.records[0].note,'');assert.throws(()=>D.apply(r,'a','note',{id:'x',note:'a'.repeat(301)},T));});
test('location rejects stale, poor accuracy and invalid inputs',()=>{const p={lat:30.3,lng:120.1,accuracy:15,at:T};assert.equal(D.locationVerdict(p,p,T),'near');assert.equal(D.locationVerdict(p,{...p,lat:30.31},T),'far');for(const bad of [{...p,accuracy:300},{...p,at:T-40000},{...p,at:T+1},{...p,lat:NaN},{...p,lat:100}])assert.equal(D.locationVerdict(p,bad,T),'retry');});
test('cloud rules are identical to client rules',()=>{const fs=require('node:fs');assert.equal(fs.readFileSync(require.resolve('../miniprogram/shared/domain'),'utf8'),fs.readFileSync(require.resolve('../cloudfunctions/api/domain'),'utf8'));});

test('leaderboard uses competition ranks, deterministic ties and does not mutate rows',()=>{
 const rows=[{id:'c',points:8},{id:'b',points:20},{id:'a',points:20},{id:'d',points:0}];
 const ranked=D.rankBoard(rows);
 assert.deepEqual(ranked.map(x=>x.id),['a','b','c','d']);
 assert.deepEqual(ranked.map(x=>x.rank),[1,1,3,4]);
 assert.equal(rows[0].id,'c');assert.equal(rows[0].rank,undefined);
});
