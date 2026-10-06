// Display only the draft returned by the user's current import; never persist it.
function showTimetable(draft){
 const root=document.getElementById('timetable');root.replaceChildren();root.hidden=false;
 const heading=document.createElement('h2');heading.textContent='我的周课表';root.append(heading);
 const select=document.createElement('select');select.setAttribute('aria-label','教学周');
 const max=Math.max(8,...draft.courses.flatMap(c=>c.meetings.map(m=>m.weeks?m.weeks.last:8)));
 for(let i=1;i<=max;i++){const option=document.createElement('option');option.value=i;option.textContent='第 '+i+' 教学周';select.append(option);}root.append(select);
 const note=document.createElement('p');note.textContent='按教务教学周与单双周展示，未叠加节假日调课。点击课程查看完整信息。';root.append(note);
 const pane=document.createElement('div');pane.style.cssText='overflow:auto;background:#fff;border-radius:16px';root.append(pane);
 const bells=[['08:00','08:45'],['08:50','09:35'],['10:00','10:45'],['10:50','11:35'],['11:40','12:25'],['13:25','14:10'],['14:15','15:00'],['15:05','15:50'],['16:15','17:00'],['17:05','17:50'],['18:50','19:35'],['19:40','20:25'],['20:30','21:15']];
 function render(){pane.replaceChildren();const grid=document.createElement('div');grid.style.cssText='display:grid;grid-template-columns:48px repeat(7,110px);grid-template-rows:42px repeat(13,75px);width:818px;gap:2px';pane.append(grid);
 function cell(text,col,row,span=1,course=false){const el=document.createElement(course?'button':'div');el.textContent=text;el.style.cssText='box-sizing:border-box;white-space:pre-line;overflow:hidden;margin:0;padding:6px;border:0;border-radius:8px;font-size:12px;line-height:1.5;grid-column:'+col+';grid-row:'+row+' / span '+span+';background:'+(course?'#deebdf':'#f5f7f2')+';color:#244d3b';grid.append(el);return el;}
 ['一','二','三','四','五','六','日'].forEach((d,i)=>cell('周'+d,i+2,1));bells.forEach((b,i)=>cell(b[0]+'\n'+(i+1),1,i+2));
 const week=Number(select.value);for(const c of draft.courses)for(const m of c.meetings){if(m.weeks&&(week<m.weeks.first||week>m.weeks.last)||m.parity==='odd'&&week%2===0||m.parity==='even'&&week%2===1)continue;const start=bells.findIndex(b=>b[0]===m.start),end=bells.findIndex(b=>b[1]===m.end);if(start<0||end<start)continue;const text=c.title+'\n'+(m.place||'地点待定')+'\n'+m.start+'–'+m.end;const el=cell(text,m.weekday+1,start+2,end-start+1,true);el.onclick=()=>{detail.textContent=text;detail.scrollIntoView({block:'nearest'});};}
 }
 const detail=document.createElement('pre');root.append(detail);select.onchange=render;render();
}
