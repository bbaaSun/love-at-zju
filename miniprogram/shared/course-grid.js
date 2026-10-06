const {BELLS}=require('./zju-import');
const minutes=s=>Number(s.slice(0,2))*60+Number(s.slice(3));
const ROW=100,LEFT=68,COLUMN=136;
function position(value){const v=minutes(value);if(v<=minutes(BELLS[0][0]))return 0;for(let i=0;i<BELLS.length;i++){const [a,b]=BELLS[i].map(minutes);if(v<a)return i*ROW;if(v<=b)return (i+(v-a)/(b-a))*ROW;}return BELLS.length*ROW;}
function layout(table,days,mode){
 const rows=[],outside=[];for(const owner of ['mine','partner']){if(mode!=='both'&&mode!==owner)continue;for(const c of table&&table[owner]?table[owner].courses:[]){const day=days.findIndex(d=>d.date===c.date);if(day<0)continue;if(c.start<'08:00'||c.end>'21:15'){outside.push({...c,owner});continue;}rows.push({...c,owner,day});}}
 rows.sort((a,b)=>a.day-b.day||a.start.localeCompare(b.start)||a.end.localeCompare(b.end));
 // The school splits afternoon periods into adjacent blocks. Rejoin equal courses.
 const merged=[];for(const c of rows){const prior=merged.find(x=>x.day===c.day&&x.owner===c.owner&&x.title===c.title&&x.place===c.place&&position(x.end)===position(c.start)&&minutes(c.start)>=minutes(x.end));if(prior)prior.end=c.end;else merged.push({...c});}
 const events=[];for(let day=0;day<7;day++){
  const items=merged.filter(c=>c.day===day).sort((a,b)=>a.start.localeCompare(b.start));let group=[],end=-1;
  function flush(){const lanes=[];for(const c of group){let lane=lanes.findIndex(e=>e<=minutes(c.start));if(lane<0)lane=lanes.length;lanes[lane]=minutes(c.end);c.lane=lane;}for(const c of group){const width=COLUMN/lanes.length,top=position(c.start),height=Math.max(28,position(c.end)-top-5);events.push({...c,id:c.owner+'-'+events.length,time:c.start+'–'+c.end,style:'left:'+(LEFT+day*COLUMN+c.lane*width+3)+'rpx;top:'+(top+3)+'rpx;width:'+(width-6)+'rpx;height:'+height+'rpx;'});}group=[];end=-1;}
  for(const c of items){if(group.length&&minutes(c.start)>=end)flush();group.push(c);end=Math.max(end,minutes(c.end));}if(group.length)flush();
 }
 return {events,outside,ticks:BELLS.map((b,i)=>({section:i+1,start:b[0],style:'top:'+(i*ROW)+'rpx;'})),headers:days.map((d,i)=>({...d,style:'left:'+(LEFT+i*COLUMN)+'rpx;width:'+COLUMN+'rpx;'})),width:LEFT+7*COLUMN,height:BELLS.length*ROW};
}
module.exports={layout,position};
