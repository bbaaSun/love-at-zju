const test=require('node:test'),assert=require('node:assert/strict'),T=require('../miniprogram/shared/timetable');
const c=(start,end)=>({date:'2026-10-08',start,end,title:'高数',place:'东1'});
test('dated import rejects invalid dates, reverse time and malformed rows; deduplicates safely',()=>{
 assert.throws(()=>T.parse('2026-02-30 | 08:00 | 09:00 | 高数'));
 assert.throws(()=>T.parse('2026-10-08 | 09:00 | 08:00 | 高数'));
 assert.throws(()=>T.parse('周四 1-2节 高数'));
 const line='2026-10-08 | 08:00 | 09:35 | 高数 | 东1';assert.equal(T.parse(line+'\n'+line).length,1);
 assert.throws(()=>T.normalize(Array(401).fill(c('08:00','10:00'))));
});
test('free periods merge overlaps, omit tiny gaps, clip day bounds; unknown data never means free',()=>{
 const mine={courses:[c('07:00','09:00'),c('10:00','11:30')]},partner={courses:[c('08:00','10:15'),c('11:45','23:00')]};
 assert.deepEqual(T.freeSlots(mine,partner,'2026-10-08'),[]);
 assert.deepEqual(T.freeSlots(mine,null,'2026-10-08'),[]);
 assert.deepEqual(T.freeSlots({courses:[c('09:00','10:00')]},{courses:[c('09:15','10:00')]},'2026-10-08'),[{start:'08:00',end:'09:00'},{start:'10:00',end:'22:00'}]);
});
test('week uses China timezone at Sunday/Monday rollover',()=>{assert.equal(T.week(Date.parse('2026-10-04T15:59:00Z'),0)[0].date,'2026-09-28');assert.equal(T.week(Date.parse('2026-10-04T16:00:00Z'),0)[0].date,'2026-10-05');});

test('dates outside imported range are unknown, never all-day free',()=>{assert.deepEqual(T.freeSlots({courses:[c('09:00','10:00')]},{courses:[c('09:00','10:00')]},'2026-11-01'),[]);});

test('separate confirmed terms never invent coverage in the gap; empty weekends inside a term are known',()=>{
 const table={courses:[c('09:00','10:00'),{...c('09:00','10:00'),date:'2026-11-10'}],coverage:[{start:'2026-10-01',end:'2026-10-11'},{start:'2026-11-09',end:'2026-11-15'}]};
 assert.equal(T.covers(table,'2026-10-10'),true);assert.equal(T.covers(table,'2026-10-25'),false);
 assert.deepEqual(T.freeSlots(table,table,'2026-10-25'),[]);
 assert.deepEqual(T.freeSlots(table,table,'2026-10-10'),[{start:'08:00',end:'22:00'}]);
 assert.equal(T.covers({courses:table.courses},'2026-10-10'),false);
});
test('coverage validates bounds and merges only overlapping or consecutive ranges',()=>{
 assert.deepEqual(T.coverage([{start:'2026-10-01',end:'2026-10-05'},{start:'2026-10-06',end:'2026-10-10'},{start:'2026-11-01',end:'2026-11-02'}],[]),[{start:'2026-10-01',end:'2026-10-10'},{start:'2026-11-01',end:'2026-11-02'}]);
 for(const ranges of [null,{},[{start:'2026-02-30',end:'2026-03-01'}],[{start:'2026-10-10',end:'2026-10-01'}],[{start:'2026-01-01',end:'2028-01-01'}]])assert.throws(()=>T.coverage(ranges,[]));
});

test('multi-year coverage remains valid after normalization and subsequent reads',()=>{const ranges=[{start:'2026-01-01',end:'2026-12-31'},{start:'2027-01-01',end:'2027-12-31'}];const once=T.coverage(ranges,[]);assert.deepEqual(T.coverage(once,[]),once);assert.equal(T.covers({coverage:once,courses:[]},'2027-10-01'),true);});
