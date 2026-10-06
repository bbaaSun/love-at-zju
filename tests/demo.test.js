const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const D=require('../miniprogram/shared/domain');
const S=require('../miniprogram/shared/season');
function harness(){
 let stored;const module={exports:{}};
 class Clock extends Date{static now(){return Date.parse('2026-09-28T12:00:00+08:00');}}
 vm.runInNewContext(fs.readFileSync(require.resolve('../miniprogram/services/demo'),'utf8'),{module,require:p=>p.includes('timetable')?require('../miniprogram/shared/timetable'):p.includes('season')?S:D,Date:Clock,wx:{getStorageSync:()=>stored,setStorageSync:(k,v)=>{stored=v;},removeStorageSync:()=>{stored=undefined;}}});
 return module.exports;
}
test('demo exposes fictional competitors before opt-in and preserves tie ranks',async()=>{
 const api=harness(),r=await api.call('board'),ranked=D.rankBoard(r.board);
 assert.equal(ranked.length,8);assert.ok(ranked.every(x=>x.sample));assert.equal(ranked[0].points,28);
 assert.deepEqual(Array.from(ranked.slice(0,5),x=>x.rank),[1,2,3,3,5]);
});
test('own public rank and weekly report use the same competitors; withdrawal only removes own row',async()=>{
 const api=harness();await api.call('demoPair');await api.call('vote',{value:true});await api.call('switch');const joined=await api.call('vote',{value:true});
 assert.equal(joined.board.length,9);const current=await api.call('season',{current:true});
 assert.equal(current.season.rank,D.rankBoard(current.board).find(x=>x.id===current.room.id).rank);
 const left=await api.call('vote',{value:false});assert.equal(left.board.length,8);assert.ok(left.board.every(x=>x.sample));
});
