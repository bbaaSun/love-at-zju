(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.LoveDomain = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const TYPES = [
    { id: 'walk', name: '一起散步', label: '走走', glyph: '↗', points: 8, minutes: 15, hint: '沿着校园，慢慢走一段' },
    { id: 'read', name: '一起读书', label: '读书', glyph: '册', points: 8, minutes: 20, hint: '交换一页，也交换一个想法' },
    { id: 'study', name: '一起自习', label: '自习', glyph: '✎', points: 10, minutes: 25, hint: '各自努力，也彼此陪伴' },
    { id: 'sport', name: '一起锻炼', label: '运动', glyph: '↟', points: 10, minutes: 20, hint: '把好天气留给操场' },
    { id: 'movie', name: '一起看电影', label: '电影', glyph: '▷', points: 4, minutes: 0, hint: '记住片名，也记住此刻' },
    { id: 'music', name: '一起听歌', label: '听歌', glyph: '♫', points: 4, minutes: 0, hint: '今天的心情，有了共同旋律' }
  ];
  function fail(message) { throw new Error(message); }
  function day(ms) { return new Date(ms + 8 * 3600000).toISOString().slice(0, 10); }
  function week(ms) { const d = new Date(ms + 8 * 3600000); d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7); return d.toISOString().slice(0, 10); }
  function text(v, max, required) { const s = typeof v === 'string' ? v.trim() : ''; if (s.length > max) fail('文字太长了，请缩短一些'); if (required && !s) fail('请先填写内容'); return s; }
  function room(id, member, now) { return { id, members: [member], createdAt: now, active: null, records: [], total: 0, daily: { key: day(now), points: 0, types: [] }, weekKey: week(now), weekPoints: 0, votes: {}, listed: false, invite: null }; }
  function memberOf(r, actor) { if (!r.members.some(m => m.id === actor)) fail('你还没有加入这个情侣空间'); }
  function apply(original, actor, action, payload, now, id) {
    const r = JSON.parse(JSON.stringify(original)); payload = payload || {}; memberOf(r, actor);
    if (r.archivedAt) fail('已解除的空间仅可查看');
    if (action === 'start') {
      if (r.members.length !== 2) fail('请先邀请另一半加入');
      if (r.active) fail('请先完成或取消正在进行的活动');
      const type = TYPES.find(t => t.id === payload.type); if (!type) fail('请选择一种活动');
      r.active = { id, type: type.id, createdAt: now, startedAt: null, joined: [actor], finished: [], place: text(payload.place, 40, false), note: '', initiator: actor };
    } else if (action === 'joinActivity') {
      const a = r.active; if (!a || a.id !== payload.id) fail('这次活动已经结束，请刷新');
      if (!a.joined.includes(actor)) a.joined.push(actor);
      if (a.joined.length === 2 && a.startedAt === null) a.startedAt = now;
    } else if (action === 'finish') {
      const a = r.active;
      if (!a) { if (r.records.some(x => x.id === payload.id)) return r; fail('没有正在进行的活动'); }
      if (a.id !== payload.id) fail('活动已变化，请刷新后重试');
      if (a.startedAt === null) fail('等待另一半加入后才能完成');
      const type = TYPES.find(t => t.id === a.type);
      if (now - a.startedAt < type.minutes * 60000) fail('还没有达到活动时长，可以继续陪伴或取消活动');
      if (a.finished.includes(actor)) return r;
      a.finished.push(actor);
      if (a.finished.length === 2) {
        if (!r.daily || r.daily.key !== day(now)) r.daily = { key: day(now), points: 0, types: [] };
        const earned = r.daily.points;
        const repeated = r.daily.types.includes(type.id);
        const points = repeated ? 0 : Math.min(type.points, Math.max(0, 30 - earned));
        const reason = repeated ? '今天同类活动已得分，回忆照常保存' : points === 0 ? '今日积分已达上限，回忆照常保存' : '双方确认完成';
        r.records.unshift({ id: a.id, type: a.type, place: a.place, note: a.note, at: now, points, reason, proof: '双人确认', duration: Math.floor((now - a.startedAt) / 60000) });
        // Keep a bounded recent journal; daily and total ledgers are stored separately.
        if (r.records.length > 300) r.records = r.records.slice(0, 300);
        r.daily.points += points; if (points > 0) r.daily.types.push(type.id);
        r.total += points;
        if (r.weekKey !== week(now)) { r.weekKey = week(now); r.weekPoints = 0; }
        r.weekPoints += points; r.active = null;
      }
    } else if (action === 'cancel') {
      if (r.active && r.active.id !== payload.id) fail('活动已变化，请刷新后重试'); r.active = null;
    } else if (action === 'note') {
      const note = text(payload.note, 300, false);
      if (r.active && r.active.id === payload.id) r.active.note = note;
      else { const record = r.records.find(x => x.id === payload.id); if (!record) fail('没有找到这条回忆'); record.note = note; }
    } else if (action === 'spaceSpark') {
      if(r.members.length!==2) fail('请先邀请另一半加入');
      const today=day(now), space=r.space||(r.space={});
      if(!space.spark||space.spark.day!==today)space.spark={day:today,actors:[]};
      if(!space.spark.actors.includes(actor))space.spark.actors.push(actor);
      if(space.spark.actors.length===2&&space.lastLit!==today){space.streak=space.lastLit===day(now-86400000)?(space.streak||0)+1:1;space.totalDays=(space.totalDays||0)+1;space.lastLit=today;}
    } else if (action === 'spaceAnniversary') {
      const value=payload.date;
      if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value+'T00:00:00+08:00'))||day(Date.parse(value+'T00:00:00+08:00'))!==value||value<'1900-01-01'||value>day(now))fail('请选择有效的相恋日期，不能晚于今天');
      (r.space||(r.space={})).anniversary=value;
    } else if (action === 'spaceWish') {
      if(r.members.length!==2)fail('请先邀请另一半加入');
      const space=r.space||(r.space={}),wishes=space.wishes||(space.wishes=[]);
      if(payload.id){const wish=wishes.find(x=>x.id===payload.id);if(!wish)fail('心愿已不存在');if(payload.remove)space.wishes=wishes.filter(x=>x.id!==payload.id);else wish.done=payload.done===true;}
      else {if(wishes.length>=20)fail('最多保存 20 个心愿，完成后可移除');wishes.unshift({id,text:text(payload.text,40,true),done:false,at:now});}
    } else if (action === 'vote') {
      r.votes[actor] = payload.value === true; r.listed = r.members.length === 2 && r.members.every(m => r.votes[m.id] === true);
    } else fail('暂不支持这个操作');
    return r;
  }
  function view(r, actor, now) {
    if (!r) return {};
    memberOf(r, actor);
    const a = r.active;
    const active = a ? Object.assign({}, a, { name: TYPES.find(t => t.id === a.type).name, canJoin: !a.joined.includes(actor), hasFinished: a.finished.includes(actor), remaining: a.startedAt === null ? 0 : Math.max(0, Math.ceil((TYPES.find(t => t.id === a.type).minutes * 60000 - (now - a.startedAt)) / 60000)), status: a.startedAt === null ? '等待另一半加入' : a.finished.length ? '等待双方完成确认' : '正在一起进行' }) : null;
    const space=r.space||{},today=day(now),spark=space.spark&&space.spark.day===today?space.spark:{actors:[]};
    const sparkDays=space.totalDays||0,level=Math.min(5,1+Math.floor(sparkDays/7));
    const spaceView={anniversary:space.anniversary||'',days:space.anniversary?Math.floor((Date.parse(today+'T00:00:00+08:00')-Date.parse(space.anniversary+'T00:00:00+08:00'))/86400000)+1:Math.floor((now-r.createdAt)/86400000)+1,sparkMine:spark.actors.includes(actor),sparkPartner:spark.actors.some(x=>x!==actor),lit:spark.actors.length===2,streak:[today,day(now-86400000)].includes(space.lastLit)?space.streak||0:0,totalDays:sparkDays,level,progress:level===5?100:Math.round(sparkDays%7/7*100),remaining:level===5?0:7-sparkDays%7,wishes:space.wishes||[]};
    return Object.assign({}, r, { spaceView, active, me: actor, paired: r.members.length === 2, myVote: !!r.votes[actor], days: Math.floor((now - r.createdAt) / 86400000) + 1, weekPoints: r.weekKey === week(now) ? r.weekPoints : 0, todayPoints: r.daily && r.daily.key === day(now) ? r.daily.points : 0, records: r.records.map(x => Object.assign({}, x, { name: TYPES.find(t => t.id === x.type).name, date: day(x.at).replace(/-/g, '.') })) });
  }
  function rankBoard(rows) {
    const sorted = rows.slice().sort((a,b)=>b.points-a.points || String(a.id).localeCompare(String(b.id)));
    return sorted.map((row,i)=>Object.assign({},row,{rank:sorted.findIndex(x=>x.points===row.points)+1}));
  }
  function locationVerdict(a, b, now) {
    if (![a,b].every(p => p && Number.isFinite(p.lat) && Math.abs(p.lat) <= 90 && Number.isFinite(p.lng) && Math.abs(p.lng) <= 180 && Number.isFinite(p.accuracy) && p.accuracy >= 0 && p.accuracy <= 50 && Number.isFinite(p.at) && p.at <= now && now-p.at <= 30000)) return 'retry';
    if (Math.abs(a.at-b.at)>15000) return 'retry';
    const rad = x => x * Math.PI/180;
    const h = Math.sin(rad(b.lat-a.lat)/2)**2 + Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(rad(b.lng-a.lng)/2)**2;
    const d = 6371000*2*Math.asin(Math.sqrt(Math.min(1,h)));
    return d <= 100 ? 'near' : d >= 300 ? 'far' : 'retry';
  }
  return { TYPES, day, week, room, apply, view, rankBoard, locationVerdict };
});
