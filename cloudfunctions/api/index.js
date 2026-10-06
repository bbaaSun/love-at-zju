const cloud = require('wx-server-sdk');
const crypto = require('crypto');
const D = require('./domain');
const S = require('./season');
const T = require('./timetable');
cloud.init({env:cloud.DYNAMIC_CURRENT_ENV});
const db = cloud.database();
const hash = s => crypto.createHash('sha256').update(s).digest('hex').slice(0,32);
async function read(source,col,id) {
  try { const res=await source.collection(col).doc(id).get(); return res.data || null; }
  catch(e) { if(/DOCUMENT_NOT_EXIST|document.*not.*exist|document.*not.*found/i.test(String(e.errCode)+' '+e.message+' '+e.errMsg))return null;throw e; }
}
function write(source,col,id,data){const clean=Object.assign({},data);delete clean._id;return source.collection(col).doc(id).set({data:clean});}
function boardRow(r) { return {id:r.id,label:'校园组合 '+hash(r.id).slice(0,6).toUpperCase(),points:r.weekPoints}; }
async function getBoard(now) {
 const res=await db.collection('weeklyScores').where({listed:true,key:D.week(now)}).orderBy('points','desc').limit(100).get();
 return res.data.map(r=>({id:r.id,label:r.label,points:r.points}));
}
async function getRoom(user) {
 const profile=await read(db,'profiles',user);
 if(!profile)throw new Error('请先打开首页');
 const r=await read(db,'couples',profile.roomId);
 if(!r)throw new Error('空间不存在，请联系管理员');
 return r;
}
exports.main=async event=>{
 try {
  const openid=cloud.getWXContext().OPENID;
  if(!openid)throw new Error('请从微信小程序登录');
  const user=hash(openid), now=Date.now();
  const action=event.action, p=event.payload || {};
  if(['beginSchool','importSchool','cancelSchool'].includes(action)){
   try{return {ok:true,data:await require('./school').handle(action,p,user,db,read,write)};}
   catch(e){return {ok:false,error:e.message&&!/database|collection|transaction|cloud|https|cookie|execution/i.test(e.message)?e.message:'连接教务服务失败，请稍后重试'};}
  }
  if(!['snapshot','board','invite','joinRoom','start','joinActivity','finish','cancel','note','vote','season','claim','profile','revokeInvite','leave','archives','timetable','saveTimetable','shareTimetable','clearTimetable'].includes(action))throw new Error('不支持这个操作');
  const actionId=crypto.randomBytes(12).toString('hex');
  if(action==='snapshot') {
   await db.runTransaction(async tx=>{
    const profile=await read(tx,'profiles',user);
    if(!profile){const id='r'+user;await write(tx,'couples',id,D.room(id,{id:user,name:'同学'},now));await write(tx,'profiles',user,{roomId:id});}
   });
  } else if(['saveTimetable','shareTimetable','clearTimetable'].includes(action)) {
   await db.runTransaction(async tx=>{
    const profile=await read(tx,'profiles',user);if(!profile)throw new Error('请先打开首页');
    const r=await read(tx,'couples',profile.roomId);D.view(r,user,now);
    if(p.roomId!==r.id)throw new Error('情侣空间已变化，请刷新课表');
    if(action==='saveTimetable'){
     const courses=T.normalize(p.courses);if(!courses.length)throw new Error('课表为空，请使用清空操作');
     // An import does not grant consent or accept a client-supplied owner.
     profile.timetable={courses,coverage:T.coverage(p.coverage,courses),updatedAt:now,sharedRoomId:profile.timetable&&profile.timetable.sharedRoomId===r.id?r.id:null};
    }else if(action==='clearTimetable')delete profile.timetable;
    else {if(!profile.timetable)throw new Error('请先导入自己的课表');if(p.value!==true&&p.value!==false)throw new Error('共享状态无效');if(p.value&&r.members.length!==2)throw new Error('先绑定另一半再共享');profile.timetable.sharedRoomId=p.value?r.id:null;}
    await write(tx,'profiles',user,profile);
   });
  } else if(action==='profile') {
   const name=typeof p.name==='string'?p.name.trim():'';
   if(!name||name.length>16)throw new Error('昵称请填写 1–16 个字');
   await db.runTransaction(async tx=>{
    const profile=await read(tx,'profiles',user);if(!profile)throw new Error('请先打开首页');
    const r=await read(tx,'couples',profile.roomId);D.view(r,user,now);
    r.members.find(m=>m.id===user).name=name;
    await write(tx,'profiles',user,Object.assign({},profile,{name}));
    await write(tx,'couples',r.id,r);
   });
  } else if(action==='revokeInvite') {
   await db.runTransaction(async tx=>{
    const profile=await read(tx,'profiles',user);if(!profile)throw new Error('请先打开首页');
    const r=await read(tx,'couples',profile.roomId);D.view(r,user,now);
    if(r.invite){const invitation=await read(tx,'invites',r.invite.code);if(invitation)await write(tx,'invites',r.invite.code,Object.assign({},invitation,{used:true}));}
    r.invite=null;await write(tx,'couples',r.id,r);
   });
  } else if(action==='leave') {
   await db.runTransaction(async tx=>{
    const profile=await read(tx,'profiles',user);if(!profile)throw new Error('请先打开首页');
    const r=await read(tx,'couples',profile.roomId);D.view(r,user,now);
    if(r.id!==p.roomId)throw new Error('空间已经变化，请重新确认');
    if(r.members.length!==2)throw new Error('当前尚未绑定另一半');
    // Both users move atomically. The old room remains read-only for its original members.
    const profiles=[];for(const member of r.members)profiles.push(await read(tx,'profiles',member.id));
    if(profiles.some(x=>!x||x.roomId!==r.id))throw new Error('空间状态已变化，请刷新');
    r.archivedAt=now;r.active=null;r.listed=false;r.votes={};r.invite=null;
    await write(tx,'couples',r.id,r);
    await write(tx,'weeklyScores',r.id+'_'+D.week(now),S.row(r,now,boardRow(r).label));
    for(let i=0;i<r.members.length;i++){
     const member=r.members[i],prior=profiles[i],id='r'+hash(member.id+actionId);
     const fresh=D.room(id,member,now);fresh.daily=r.daily;await write(tx,'couples',id,fresh);
     await write(tx,'profiles',member.id,Object.assign({},prior,{roomId:id,archives:[r.id].concat(prior.archives||[])}));
    }
   });
  } else if(action==='invite') {
   const code=crypto.randomBytes(6).toString('hex').toUpperCase();
   await db.runTransaction(async tx=>{
    const profile=await read(tx,'profiles',user);if(!profile)throw new Error('请先打开首页');
    const r=await read(tx,'couples',profile.roomId);D.view(r,user,now);
    if(r.members.length!==1)throw new Error('你们已经绑定，无需再邀请');
    if(r.invite&&r.invite.expiresAt>now)return;
    r.invite={code,expiresAt:now+86400000};
    await write(tx,'invites',code,{roomId:r.id,expiresAt:r.invite.expiresAt,used:false});
    await write(tx,'couples',r.id,r);
   });
  } else if(action==='joinRoom') {
   if(typeof p.code!=='string'||! /^[A-F0-9]{12}$/.test(p.code))throw new Error('请输入 12 位有效邀请码');
   // Persist attempt throttling separately: failed joins must not roll it back.
   await db.runTransaction(async tx=>{
    const profile=await read(tx,'profiles',user);if(!profile)throw new Error('请先打开首页');
    if(profile.lastJoinAttempt && now-profile.lastJoinAttempt<3000)throw new Error('请稍等几秒再试');
    await write(tx,'profiles',user,Object.assign({},profile,{lastJoinAttempt:now}));
   });
   await db.runTransaction(async tx=>{
    const profile=await read(tx,'profiles',user);
    const own=await read(tx,'couples',profile.roomId);D.view(own,user,now);
    if(own.members.length!==1||own.records.length||own.active)throw new Error('当前空间已有伴侣或记录，不能加入其他空间');
    const invite=await read(tx,'invites',p.code);
    if(!invite||invite.used||invite.expiresAt<=now)throw new Error('邀请码不存在或已失效');
    if(invite.roomId===own.id)throw new Error('不能加入自己的邀请码');
    const target=await read(tx,'couples',invite.roomId);
    if(!target||target.members.length!==1||!target.invite||target.invite.code!==p.code)throw new Error('邀请已失效');
    target.members.push({id:user,name:profile.name||'同学'});target.invite=null;
    await write(tx,'couples',target.id,target);
    await write(tx,'profiles',user,Object.assign({},profile,{roomId:target.id}));
    await write(tx,'invites',p.code,Object.assign({},invite,{used:true}));
    await tx.collection('couples').doc(own.id).remove();
   });
  } else if(action==='claim') {
   await db.runTransaction(async tx=>{
    const profile=await read(tx,'profiles',user);if(!profile)throw new Error('请先打开首页');
    const r=await read(tx,'couples',profile.roomId);D.view(r,user,now);
    const key=S.resolveKey(p,now,true),id=r.id+'_'+key;
    const score=await read(tx,'weeklyScores',id);
    if(!score||score.points<1)throw new Error('上一周还没有可领取的纪念章');
    if(!await read(tx,'rewardClaims',id))await write(tx,'rewardClaims',id,{roomId:r.id,key,claimedAt:now});
   });
  } else if(!['board','season','archives','timetable'].includes(action)) {
   await db.runTransaction(async tx=>{
    const profile=await read(tx,'profiles',user);if(!profile)throw new Error('请先打开首页');
    const r=await read(tx,'couples',profile.roomId);if(!r)throw new Error('空间不存在');
    // Daily limits follow people across rebinding, not just the current room.
    const original=JSON.parse(JSON.stringify(r)),people=[];
    if(action==='finish'){
     for(const member of r.members)people.push({id:member.id,profile:await read(tx,'profiles',member.id)});
     const ledgers=[r.daily].concat(people.map(x=>x.profile.daily)).filter(x=>x&&x.key===D.day(now));
     r.daily={key:D.day(now),points:Math.max(0,...ledgers.map(x=>x.points)),types:[...new Set(ledgers.flatMap(x=>x.types))]};
    }
    const next=S.track(original,D.apply(r,user,action,p,now,actionId),now);
    if(action==='finish'&&original.active&&!next.active){
     const record=next.records.find(x=>x.id===original.active.id);
     for(const person of people){const before=person.profile.daily&&person.profile.daily.key===D.day(now)?person.profile.daily:{key:D.day(now),points:0,types:[]};
      const legacy=original.daily&&original.daily.key===D.day(now)?original.daily:{points:0,types:[]};
      const daily={key:D.day(now),points:Math.min(30,Math.max(before.points,legacy.points)+record.points),types:[...new Set(before.types.concat(legacy.types,record.points?[record.type]:[]))]};
      await write(tx,'profiles',person.id,Object.assign({},person.profile,{daily}));
     }
    }
    await write(tx,'weeklyScores',r.id+'_'+D.week(now),S.row(next,now,boardRow(next).label));
    await write(tx,'couples',r.id,next);
   });
  }
  // Current-week snapshots are stored independently of the bounded journal.
  await db.runTransaction(async tx=>{
   const profile=await read(tx,'profiles',user);const r=await read(tx,'couples',profile.roomId);D.view(r,user,now);
   const id=r.id+'_'+D.week(now),next=S.row(r,now,boardRow(r).label),existing=await read(tx,'weeklyScores',id);
   if(existing)delete existing._id;
   if(JSON.stringify(existing)!==JSON.stringify(next))await write(tx,'weeklyScores',id,next);
  });
  const r=await getRoom(user);
  const board=action==='board'||action==='vote'?await getBoard(now):[];
  let season=null;
  if(action==='season'||action==='claim'){
   const key=S.resolveKey(p,now,action==='claim'),id=r.id+'_'+key;
   const score=await read(db,'weeklyScores',id);
   const ranked=await db.collection('weeklyScores').where({key,listed:true}).orderBy('points','desc').limit(100).get();
   season=S.report(score,ranked.data,key,now,await read(db,'rewardClaims',id));
  }
  let archives=null;
  if(action==='archives'){
   const profile=await read(db,'profiles',user),ids=profile.archives||[];
   const offset=Math.max(0,Math.floor(Number(p.offset)||0));
   archives={items:[],nextOffset:null};
   // Bound each response to five rooms; no arbitrary room ID is accepted from clients.
   for(const id of ids.slice(offset,offset+5)){
    const old=await read(db,'couples',id);
    if(old&&old.archivedAt&&old.members.some(m=>m.id===user))archives.items.push(D.view(old,user,now));
   }
   if(offset+5<ids.length)archives.nextOffset=offset+5;
  }
  let timetable;
  if(['timetable','saveTimetable','shareTimetable','clearTimetable'].includes(action)){
   // Read room membership and sharing consent together to avoid unlink races.
   timetable=await db.runTransaction(async tx=>{
    const current=await read(tx,'profiles',user),room=await read(tx,'couples',current.roomId);D.view(room,user,now);
    if(room.id!==r.id)throw new Error('空间已变化，请重新加载');
    const profiles=[];for(const m of room.members){const p=await read(tx,'profiles',m.id);profiles.push({id:m.id,timetable:p&&p.roomId===room.id?p.timetable:null});}
    return T.view(room,user,profiles);
   });
  }
  return {ok:true,data:{room:D.view(r,user,now),board,mode:'cloud',now,season,archives,timetable}};
 } catch(e){ console.error('api failure',e);return {ok:false,error:e.message&& !/database|collection|transaction|cloud/i.test(e.message)?e.message:'服务暂时不可用，请检查云环境配置后重试'}; }
};
