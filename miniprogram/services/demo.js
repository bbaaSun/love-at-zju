const D = require('../shared/domain');
const S = require('../shared/season');
const T = require('../shared/timetable');
const KEY = require('../config').demoStorageKey || 'love-zju-demo-v1';
// Fictional rivals exist only in the local demo adapter, never in cloud data.
function sampleBoard(key, now) {
 const days=Math.max(0,Math.min(7,Math.floor((now-Date.parse(key+'T00:00:00+08:00'))/86400000)+1));
 const names=['湖畔慢慢走','晚风和你','同桌的我们','一起追日落','两杯热可可','晴天收集员','并肩看世界','今天也心动'];
 const daily=[28,26,24,24,20,16,12,8];
 return Array.from({length:100},(_,i)=>({id:'sample-'+String(i).padStart(3,'0'),label:i<names.length?names[i]:['月色','晚风','山海','湖光','晨曦','星河','青禾','长夏'][i%8]+'同行 '+String(i+1).padStart(3,'0'),points:(i<daily.length?daily[i]:Math.floor(7*(100-i)/92))*days,sample:true,key,listed:true}));
}
function load() { return wx.getStorageSync(KEY) || { actor:'demo-a', clock:0, room:D.room('demo-room',{id:'demo-a',name:'我'},Date.now()) }; }
function save(s) { wx.setStorageSync(KEY,s); }
async function call(action,payload) {
 let s=load(), now=Date.now()+s.clock; payload=payload||{}; s.weeks=s.weeks||{};s.claims=s.claims||{};s.archives=s.archives||[];
 s.weeks[D.week(now)]=S.row(s.room,now,'我们的共同生活');
 s.tables=s.tables||{};
 if(action==='saveTimetable'){const courses=T.normalize(payload.courses);if(!courses.length)throw new Error('课表为空');s.tables[s.actor]={courses,coverage:T.coverage(payload.coverage,courses),updatedAt:now,sharedRoomId:s.tables[s.actor]&&s.tables[s.actor].sharedRoomId||null};}
 else if(action==='clearTimetable')delete s.tables[s.actor];
 else if(action==='shareTimetable'){if(!s.tables[s.actor])throw new Error('请先导入课表');if(payload.value&&s.room.members.length!==2)throw new Error('先绑定另一半再共享');s.tables[s.actor].sharedRoomId=payload.value?s.room.id:null;}
 else if(action==='profile'){const name=typeof payload.name==='string'?payload.name.trim():'';if(!name||name.length>16)throw new Error('昵称请填写 1–16 个字');s.room.members.find(x=>x.id===s.actor).name=name;}
 else if(action==='revokeInvite')s.room.invite=null;
 else if(action==='leave'){if(s.room.id!==payload.roomId||s.room.members.length!==2)throw new Error('空间状态已变化');const old=s.room;old.archivedAt=now;old.active=null;old.listed=false;old.votes={};old.invite=null;s.archives.unshift(old);const member=old.members.find(x=>x.id===s.actor);s.room=D.room('demo-room-'+now,member,now);s.room.daily=old.daily;s.weeks={};s.claims={};}
 else if(action==='invite') { s.room.invite={code:'ZJU-DEMO',expiresAt:now+86400000}; }
 else if(action==='demoPair') { if(s.room.members.length===1) s.room.members.push({id:'demo-b',name:'另一半'}); s.room.invite=null; }
 else if(action==='switch') s.actor=s.actor==='demo-a'?'demo-b':'demo-a';
 else if(action==='advance') s.clock+=30*60000;
 else if(action==='nextWeek') s.clock=Date.parse(D.week(now)+'T00:00:00+08:00')+7*86400000-Date.now();
 else if(action==='claim'){const key=S.resolveKey(payload,now,true),row=s.weeks[key];if(!row||row.points<1)throw new Error('上一周还没有可领取的纪念章');s.claims[key]=true;}
 else if(action==='reset') { wx.removeStorageSync(KEY); return call('snapshot'); }
 else if(action==='joinRoom') throw new Error('演示邀请码不跨设备使用，请点击“模拟另一半加入”');
 else if(!['snapshot','board','season','archives','timetable'].includes(action)) s.room=S.track(s.room,D.apply(s.room,s.actor,action,payload,now,'demo-'+now+'-'+Math.random().toString(36).slice(2,8)),now);
 now=Date.now()+s.clock; s.weeks[D.week(now)]=S.row(s.room,now,'我们的共同生活');save(s);
 const key=S.resolveKey(payload,now,action==='claim');const row=s.weeks[key];const season=S.report(row,D.rankBoard(sampleBoard(key,now).concat(row&&row.listed?[row]:[])).slice(0,100),key,now,s.claims[key]);
 return { timetable:T.view(s.room,s.actor,s.room.members.map(m=>({id:m.id,timetable:s.tables[m.id]}))),room:D.view(s.room,s.actor,now), board:D.rankBoard(sampleBoard(D.week(now),now).concat(s.room.listed?[{id:s.room.id,label:'我们的共同生活',points:s.room.weekKey===D.week(now)?s.room.weekPoints:0}]:[])).slice(0,100), mode:'demo',now,season,archives:action==='archives'?{items:s.archives.filter(x=>x.members.some(m=>m.id===s.actor)).map(x=>D.view(x,s.actor,now)),nextOffset:null}:null };
}
module.exports={call};
