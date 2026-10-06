const D=require('./domain');
const REWARDS=[{min:100,name:'闪光同行',subtitle:'把平凡的日子，过成共同的光',mark:'光'},{min:40,name:'默契生长',subtitle:'陪伴在一件件小事里生长',mark:'伴'},{min:1,name:'初见微光',subtitle:'每一次一起，都值得被珍藏',mark:'初'}];
function previous(now){return D.week(Date.parse(D.week(now)+'T00:00:00+08:00')-1);}
function resolveKey(p,now,claim){
 const key=p.key||(p.current&&!claim?D.week(now):previous(now));
 const stamp=Date.parse(key+'T00:00:00+08:00');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(key)||!Number.isFinite(stamp)||D.week(stamp)!==key||key>D.week(now)||stamp<Date.parse(D.week(now)+'T00:00:00+08:00')-12*7*86400000||(claim&&key>=D.week(now)))throw new Error('请选择最近 12 周内已结束的周次');
 return key;
}
function ledger(r,now){
 const key=D.week(now),old=r.seasonLedger;
 if(old&&old.key===key)return old;
 const records=r.records.filter(x=>D.week(x.at)===key);
 return {key,points:r.weekKey===key?r.weekPoints:0,count:records.length,days:[...new Set(records.map(x=>D.day(x.at)))],types:D.TYPES.map(t=>({id:t.id,points:records.filter(x=>x.type===t.id).reduce((n,x)=>n+x.points,0)}))};
}
function track(before,after,now){
 const l=JSON.parse(JSON.stringify(ledger(before,now)));
 if(before.active&&!after.active){const record=after.records.find(x=>x.id===before.active.id);if(record&&!before.records.some(x=>x.id===record.id)){l.points+=record.points;l.count++;const date=D.day(record.at);if(!l.days.includes(date))l.days.push(date);l.types.find(x=>x.id===record.type).points+=record.points;}}
 after.seasonLedger=l;return after;
}
function row(r,now,label){const l=ledger(r,now);return {id:r.id,key:l.key,label,points:l.points,count:l.count,days:l.days.length,types:l.types,listed:r.listed};}
function report(row,rows,key,now,claimed){
 const finished=key<D.week(now),ranked=D.rankBoard(rows.map(x=>({id:x.id,points:x.points}))),own=row&&ranked.find(x=>x.id===row.id);
 const points=row?row.points:0,reward=REWARDS.find(x=>points>=x.min)||null;
 const end=D.day(Date.parse(key+'T00:00:00+08:00')+6*86400000);
 return {key,period:key.slice(5).replace('-','.')+' — '+end.slice(5).replace('-','.'),finished,points,count:row?row.count:0,days:row?row.days:0,types:D.TYPES.map(t=>({...t,earned:row?(row.types.find(x=>x.id===t.id)||{}).points||0:0})),rank:own?own.rank:0,rankLabel:own?'第 '+own.rank+' 名':row&&row.listed?'前 100 名之外':'未参与排名',reward,claimed:!!claimed,canClaim:finished&&!!reward&&!claimed,hasData:!!row};
}
module.exports={REWARDS,previous,resolveKey,ledger,track,row,report};
