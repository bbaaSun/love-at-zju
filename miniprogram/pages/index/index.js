const CourseFile=require('../../utils/course-file');
const Calendar=require('../../shared/course-calendar');
const api=require('../../services/api');
const D=require('../../shared/domain');
const config=require('../../config');
const S=require('../../shared/season');
const Poster=require('../../utils/poster');
const T=require('../../shared/timetable');
const IDEAS = {
 walk:['沿启真湖走一圈，交换今天的小事','晚饭后，不看手机走十五分钟'],
 read:['各选一段喜欢的文字，读给对方听','带上正在读的书，交换一条读书笔记'],
 study:['找两个相邻座位，专注一个番茄钟','各定一个小目标，结束后互相分享'],
 sport:['一起慢跑，再做十分钟拉伸','带上球拍，来一场轻松的双打'],
 movie:['重看一部彼此喜欢的电影','挑一部没看过的电影，聊聊最喜欢的镜头'],
 music:['各分享一首歌，说说喜欢它的原因','一起听一张专辑，留下今天的单曲']
};
function enrich(records){return records.map(x=>Object.assign({},x,{month:x.date.slice(5,7)+'月',day:x.date.slice(8,10)}));}

Page(require('../../utils/visual-ui')({
 data:{importGrid:null,importPreviewWeek:0,courseView:'week',courseGrid:[],courseGridTicks:[],courseGridHeaders:[],courseGridOutside:[],schoolForm:false,schoolBusy:false,schoolReady:false,schoolCaptcha:'',schoolUsername:'',schoolCode:'',schoolYear:'2026',schoolTerms:['秋','冬','春','夏'],schoolTermIndex:0,schoolError:'',schoolConsent:false,releaseVersion:'0.25.0',trialSteps:[],trialProgress:'width:0%;',feedbackText:'',courseReturn:'activities',myDateKnown:false,partnerDateKnown:false,importAdvanced:false,importBusy:false,importView:false,importRulesOpen:false,importCount:0,importYear:'',importIssues:[],importTerm:'秋',importStart:'',importEnd:'',importExceptions:'',importParity:0,importRules:[],calendarReviewed:false,timetable:null,courseWeek:0,courseDays:[],courseDate:'',courseMode:'mine',myCourses:[],partnerCourses:[],freeSlots:[],freeReady:false,courseText:'',courseDraft:null,courseEditing:false,courseLoading:false,nickname:'',archives:[],archiveOffset:null,archiveDetail:null,pairSuccess:false,inviteExpired:false,scoreMotion:0,podium:[],historyWeeks:[],seasonKey:'',detail:null,season:null,seasonCurrent:false,posterPath:'',posterTheme:'lake',posterBusy:false,posterError:'',rewardLevels:S.REWARDS,completion:null,dateLabel:'',myRank:0,rankGap:0,weekLabel:'',scoreRows:[],weekDays:[],weekCount:0,visibleRecords:[],ideas:IDEAS.walk,ideaIndex:0,showDemo:false,selectedType:D.TYPES[0],tabs:[{id:'board',icon:'board',label:'情侣榜'},{id:'activities',icon:'plus',label:'约会'},{id:'timetable',icon:'journal',label:'情侣课表'},{id:'home',icon:'home',label:'情侣空间'}],tab:'board',types:D.TYPES,room:null,board:[],busy:false,error:'',demo:config.mode==='demo',selected:'walk',place:'',code:'',note:'',editor:false,recordId:'',filter:'all'},
 onLoad(options){if(options&&options.code)this.setData({code:options.code,tab:'pair'});const d=new Date();this.setData({dateLabel:(d.getMonth()+1)+'月'+d.getDate()+'日 · 星期'+['日','一','二','三','四','五','六'][d.getDay()]});this.refresh();},
 onShow(){clearInterval(this.timer);if(this.data.room)this.refresh();this.timer=setInterval(()=>{if(!this.data.busy&&!this.data.editor&&!this.data.courseEditing&&!this.data.posterBusy&&!this.data.importBusy&&!this.data.schoolForm)this.refresh();},15000);},
 onHide(){clearInterval(this.timer);this.closeSchool();},
 onUnload(){clearInterval(this.timer);this.closeSchool();},
 async onPullDownRefresh(){await this.refresh();wx.stopPullDownRefresh();},
 async request(action,payload){if(this.data.busy){if(this.pendingRead){await this.pendingRead;return this.request(action,payload);}return false;}this.setData({busy:true,error:''});try{const work=api.call(action,payload);if(['snapshot','board','season','timetable'].includes(action))this.pendingRead=work.catch(()=>{});const data=await work;const ranked=D.rankBoard(data.board||[]);const maxPoints=Math.max(1,...ranked.map(x=>x.points));const board=ranked.map((x,i)=>Object.assign({},x,{meterStyle:'width:'+Math.round(x.points/maxPoints*100)+'%;',rowStyle:'animation-delay:'+Math.min(i,6)*45+'ms;'}));const own=board.find(x=>x.id===data.room.id);const higher=board.filter(x=>x.points>data.room.weekPoints);const rankGap=higher.length?higher[higher.length-1].points-data.room.weekPoints+1:0;const records=enrich(data.room.records);const clock=data.now||Date.now();const today=D.day(clock);const monday=D.week(clock);const start=Date.parse(monday+'T00:00:00+08:00');const weekDays=Array.from({length:7},(_,i)=>{const key=D.day(start+i*86400000);return {key,label:['一','二','三','四','五','六','日'][i],day:key.slice(8),done:records.some(r=>D.day(r.at)===key),today:key===today};});const end=D.day(start+6*86400000);const scoreRows=D.TYPES.map(t=>Object.assign({},t,{earned:data.room.seasonLedger&&data.room.seasonLedger.key===monday?(data.room.seasonLedger.types.find(x=>x.id===t.id)||{}).points||0:records.filter(r=>r.type===t.id&&D.week(r.at)===monday).reduce((sum,r)=>sum+r.points,0)}));const historyWeeks=Array.from({length:12},(_,i)=>{const key=D.week(start-(i+1)*7*86400000);return {key,label:key+' 当周'};});const cd=new Date(clock+8*3600000);const remain=start+7*86400000-clock;const settleLabel=remain>=86400000?'距结算 '+Math.ceil(remain/86400000)+' 天':'距结算 '+Math.max(1,Math.ceil(remain/3600000))+' 小时';const result={settleLabel,inviteExpired:!!(data.room.invite&&data.room.invite.expiresAt<=clock),scoreMotion:this.data.scoreMotion+(this.data.room && this.data.room.weekKey===data.room.weekKey && data.room.weekPoints>this.data.room.weekPoints ? 1 : 0),historyWeeks,dateLabel:(cd.getUTCMonth()+1)+'月'+cd.getUTCDate()+'日 · 星期'+['日','一','二','三','四','五','六'][cd.getUTCDay()]};if(this.data.tab==='couple'&&this.data.detail){const updated=board.find(x=>x.id===this.data.detail.id);result.detail=updated||Object.assign({},this.data.detail,{rank:0,unavailable:this.data.detail.id!==data.room.id});}if(data.season)result.season=data.season;if(data.timetable!==undefined)result.timetable=data.timetable;if(this.data.room&&this.data.room.id!==data.room.id){result.timetable=null;result.courseDraft=null;result.courseEditing=false;result.importView=false;result.calendarReviewed=false;this.importSource=null;this.importPeriod=null;}if(data.archives){result.archives=payload&&payload.offset?this.data.archives.concat(data.archives.items):data.archives.items;result.archiveOffset=data.archives.nextOffset;}if(this.data.room&&this.data.room.paired&&!data.room.paired){result.tab='pair';result.completion=null;result.editor=false;result.detail=null;}if(this.data.room&&!this.data.room.paired&&data.room.paired&&this.data.tab==='pair')result.pairSuccess=true;const prior=this.data.room&&this.data.room.active;if(prior&&!data.room.active){const done=data.room.records.find(x=>x.id===prior.id);if(done)result.completion=done;}this.setData(Object.assign(result,{room:data.room,board,podium:board.slice(0,3).map((x,i)=>Object.assign({},x,{slot:i,monogram:x.label.slice(0,1)})).sort((a,b)=>[1,0,2].indexOf(a.slot)-[1,0,2].indexOf(b.slot)),myRank:own?own.rank:0,rankGap,weekLabel:monday.slice(5).replace('-','.')+' — '+end.slice(5).replace('-','.'),scoreRows,visibleRecords:this.data.filter==='all'?records:records.filter(r=>r.type===this.data.filter),weekDays,weekCount:weekDays.filter(x=>x.done).length}));if(this.data.tab==='timetable')this.updateCourses();if(this.data.tab==='trial')this.updateTrial();return true;}catch(e){this.setData(Object.assign({error:e.message||'网络暂时不可用，请重试'},action==='timetable'?{timetable:null,myCourses:[],partnerCourses:[],freeSlots:[]}:{}));return false;}finally{this.pendingRead=null;this.setData({busy:false});}},
 async refresh(){if(!this.data.room){if(!await this.request('snapshot'))return false;if(!this.data.room.paired&&this.data.tab==='board')this.setData({tab:'pair'});if(this.data.room.active&&this.data.tab==='board')this.setData({tab:'activities'});}if(this.data.tab==='timetable')return this.request('timetable');if(['season','poster'].includes(this.data.tab))return this.request('season',{current:this.data.seasonCurrent,key:this.data.seasonKey||undefined});return this.request(['board','couple'].includes(this.data.tab)?'board':'snapshot');},
 updateCourses(){const days=T.week(Date.now(),this.data.courseWeek);const date=days.some(x=>x.date===this.data.courseDate)?this.data.courseDate:days[0].date;const t=this.data.timetable;const grid=require('../../shared/course-grid').layout(t,days,this.data.courseMode);this.setData({courseGrid:grid.events,courseGridTicks:grid.ticks,courseGridHeaders:grid.headers,courseGridOutside:grid.outside,courseDays:days,courseDate:date,myDateKnown:!!t&&T.covers(t.mine,date),partnerDateKnown:!!t&&T.covers(t.partner,date),myCourses:t&&t.mine?t.mine.courses.filter(x=>x.date===date):[],partnerCourses:t&&t.partner?t.partner.courses.filter(x=>x.date===date):[],freeReady:!!t&&T.covers(t.mine,date)&&T.covers(t.partner,date),freeSlots:t?T.freeSlots(t.mine,t.partner,date):[]});},
 async openTimetable(){const from=this.data.tab==='timetable'?this.data.courseReturn:this.data.tab==='activities'?'activities':'home';this.importSource=null;this.importPeriod=null;this.setData({importView:false,courseDraft:null,calendarReviewed:false,courseReturn:from,tab:'timetable',timetable:null,courseLoading:true,courseEditing:false,courseDate:D.day(Date.now()),courseWeek:0,error:''});this.updateCourses();wx.pageScrollTo({scrollTop:0,duration:0});await this.request('timetable');this.setData({courseLoading:false});},
 courseDay(e){this.setData({courseDate:e.currentTarget.dataset.date});this.updateCourses();},
 courseShift(e){const next=Math.max(-26,Math.min(26,this.data.courseWeek+Number(e.currentTarget.dataset.delta)));const days=T.week(Date.now(),this.data.courseWeek),index=Math.max(0,days.findIndex(d=>d.date===this.data.courseDate));this.setData({courseWeek:next,courseDate:T.week(Date.now(),next)[index].date});this.updateCourses();},
 courseToday(){this.setData({courseWeek:0,courseDate:D.day(Date.now())});this.updateCourses();},
 courseBack(){this.tab({currentTarget:{dataset:{tab:this.data.courseReturn}}});},
 courseMode(e){this.setData({courseMode:e.currentTarget.dataset.mode});this.updateCourses();},
 setCourseView(e){this.setData({courseView:e.currentTarget.dataset.view});},
 showCourse(e){const item=this.data.courseGrid.find(c=>c.id===e.currentTarget.dataset.id);if(item)wx.showModal({title:item.title,content:(item.owner==='mine'?'我的课程':'TA 的课程')+' · '+item.date+'\n'+item.time+'\n'+(item.place||'地点未填'),showCancel:false,confirmText:'知道了'});},
 openSchool(){
  if(this.data.demo){this.setData({error:'请在连接云端的微信小程序中使用教务导入'});return;}
  this.schoolPassword='';this.setData({schoolForm:true,schoolError:'',schoolCode:'',schoolConsent:false,schoolReady:false});
  wx.nextTick(()=>wx.pageScrollTo({selector:'#school-login',duration:200}));
 },
 schoolSecret(e){this.schoolPassword=e.detail.value;},
 schoolConsent(e){this.setData({schoolConsent:e.detail.value});},
 schoolTerm(e){this.setData({schoolTermIndex:Number(e.detail.value)});},
 async connectSchool(){
  if(this.data.schoolBusy)return;
  if(!this.data.schoolConsent){this.setData({schoolError:'请先阅读并同意本次导入说明'});return;}
  this.schoolPassword='';
  const epoch=this.schoolEpoch=(this.schoolEpoch||0)+1;
  this.setData({schoolBusy:true,schoolReady:false,schoolError:''});
  try{const result=await api.call('beginSchool');if(epoch!==this.schoolEpoch){api.call('cancelSchool',{sessionId:result.sessionId}).catch(()=>{});return;}
   this.schoolSession=result;this.setData({schoolReady:true,schoolCaptcha:result.captcha,schoolCode:''});
  }catch(e){if(epoch===this.schoolEpoch)this.setData({schoolError:e.message||'连接教务网失败，请重试'});}
  finally{if(epoch===this.schoolEpoch)this.setData({schoolBusy:false});}
 },
 closeSchool(){
  this.schoolEpoch=(this.schoolEpoch||0)+1;this.schoolPassword='';
  if(this.schoolSession){api.call('cancelSchool',{sessionId:this.schoolSession.sessionId}).catch(()=>{});this.schoolSession=null;}
  this.setData({schoolForm:false,schoolBusy:false,schoolReady:false,schoolCaptcha:'',schoolUsername:'',schoolCode:'',schoolError:'',schoolConsent:false});
 },
 async importSchool(){
  if(this.data.schoolBusy||!this.schoolSession||!this.data.schoolConsent)return;
  const epoch=this.schoolEpoch,roomId=this.data.room.id;let session=this.schoolSession;
  try{
   const username=this.data.schoolUsername.trim(),year=Number(this.data.schoolYear),term=this.data.schoolTerms[this.data.schoolTermIndex];
   if(!/^\d{8,14}$/.test(username))throw new Error('请填写本科教务学号');
   if(!Number.isInteger(year)||year<2020||year>2100)throw new Error('请填写学年起始年份，例如 2026');
   if(session.captcha&&!this.data.schoolCode.trim())throw new Error('请填写图片中的验证码');
   if(session.expires&&session.expires<Date.now()+15000){
    this.setData({schoolBusy:true,schoolError:''});const fresh=await api.call('beginSchool');
    if(epoch!==this.schoolEpoch){api.call('cancelSchool',{sessionId:fresh.sessionId}).catch(()=>{});return;}
    session=this.schoolSession=fresh;this.setData({schoolCaptcha:fresh.captcha,schoolCode:''});
    if(fresh.captcha){this.setData({schoolError:'连接已更新，请填写新的图片验证码后再提交'});return;}
   }
   const encryptedPassword=require('../../utils/school-rsa').encrypt(this.schoolPassword,session.key);
   this.schoolPassword='';this.schoolSession=null;this.setData({schoolBusy:true,schoolReady:false,schoolError:''});
   const result=await api.call('importSchool',{sessionId:session.sessionId,username,encryptedPassword,captcha:this.data.schoolCode.trim(),year,term});
   if(epoch!==this.schoolEpoch||this.data.tab!=='timetable'||this.data.room.id!==roomId)return;
   this.closeSchool();this.importSource=result.draft;
   this.setData({courseEditing:true,importView:true,courseDraft:null,importCount:result.draft.courses.length,importYear:year+'–'+(year+1),importIssues:result.draft.issues.map(x=>x.course+'：'+x.reason),calendarReviewed:false});
   this.setImportTerm(result.term);wx.nextTick(()=>wx.pageScrollTo({selector:'#course-editor',duration:200}));
  }catch(e){if(epoch===this.schoolEpoch)this.setData({schoolError:e.message||'导入失败，请重新连接教务网'});}
  finally{if(epoch===this.schoolEpoch)this.setData({schoolBusy:false});}
 },
 async chooseCourseFile(){
  if(this.data.importBusy||this.data.busy)return;
  if(!wx.chooseMessageFile){this.setData({error:'请在微信小程序中选择文件，网页预览不支持微信文件导入'});return;}
  const roomId=this.data.room.id;this.setData({importBusy:true,error:''});
  try{
   const result=await new Promise((resolve,reject)=>wx.chooseMessageFile({count:1,type:'file',extension:['xlsx'],success:resolve,fail:reject}));
   const draft=await CourseFile.read(result.tempFiles[0]);
   if(!this.data.room||this.data.room.id!==roomId||this.data.tab!=='timetable')return;
   this.importSource=draft;
   const term=draft.courses.some(c=>c.term.includes('秋'))?'秋':draft.courses.some(c=>c.term.includes('春'))?'春':draft.courses.some(c=>c.term.includes('冬'))?'冬':'夏';
   this.setData({courseEditing:true,importView:true,courseDraft:null,importCount:draft.courses.length,importYear:draft.academicYear?draft.academicYear+'–'+(draft.academicYear+1):'文件未标注学年',importIssues:draft.issues.map(x=>x.course+'：'+x.reason),importTerm:term,calendarReviewed:false});
   this.setImportTerm(term);
   wx.nextTick(()=>wx.pageScrollTo({selector:'#course-editor',duration:200}));
  }catch(e){if(!/cancel/i.test(e.errMsg||''))this.setData({error:e.message||'读取失败，请重新选择教务网导出的 XLSX 文件'});}
  finally{this.setData({importBusy:false});}
 },
 toggleImportRules(){this.setData({importRulesOpen:!this.data.importRulesOpen});},
 setImportTerm(term){const preset=Calendar.defaults(term,this.importSource.academicYear);const weeks=preset.end?8:'';this.setData({importIssues:this.importSource.issues.map(x=>x.course+'：'+x.reason),importAdvanced:!preset.end,importRulesOpen:false,importTerm:term,importStart:preset.start,importEnd:preset.end,importExceptions:preset.exceptions,importParity:0,calendarReviewed:false,courseDraft:null,importRules:this.importSource.courses.filter(c=>c.term.includes(term)).map(c=>({code:c.code,title:c.title,summary:c.meetings.map(m=>'周'+['一','二','三','四','五','六','日'][m.weekday-1]+' '+m.start+'–'+m.end+(m.parity==='all'?'':m.parity==='odd'?' 单周':' 双周')).join('；'),first:1,last:weeks}))});if(preset.start&&preset.end)this.buildImportPreview(false);},
 pickImportTerm(e){this.setImportTerm(e.currentTarget.dataset.term);},
 importField(e){const field=e.currentTarget.dataset.field;this.setData({[field]:e.detail.value,courseDraft:null,calendarReviewed:false});if(['importStart','importEnd'].includes(field)){const weeks=Math.ceil((Date.parse(this.data.importEnd)-Date.parse(this.data.importStart)+86400000)/604800000);if(weeks>0&&weeks<=20)this.setData({importRules:this.data.importRules.map(r=>Object.assign({},r,{last:r.last||weeks}))});}},
 importRange(e){const i=Number(e.currentTarget.dataset.index),field=e.currentTarget.dataset.field;if(!['first','last'].includes(field))return;this.setData({['importRules['+i+'].'+field]:e.detail.value,courseDraft:null,calendarReviewed:false});},
 importParity(e){this.setData({importParity:e.detail.value?1:0,calendarReviewed:false,courseDraft:null});},
 reviewCalendar(e){this.setData({calendarReviewed:e.detail.value,courseDraft:null});},
 toggleImportAdvanced(){this.setData({importAdvanced:!this.data.importAdvanced});},
 previewImport(){this.buildImportPreview(true);},
 buildImportPreview(scroll){try{
  const ranges={};for(const r of this.data.importRules)ranges[r.code]={first:Number(r.first),last:Number(r.last)};
  const result=Calendar.expand(this.importSource,{term:this.data.importTerm,start:this.data.importStart,end:this.data.importEnd,exceptions:this.data.importExceptions,parityOffset:this.data.importParity,ranges});
  this.importPeriod={start:result.start,end:result.end};
  this.setData({courseDraft:result.courses,importIssues:result.warnings,error:'',importPreviewWeek:0});this.updateImportGrid();
  if(scroll)wx.nextTick(()=>wx.pageScrollTo({selector:'#import-preview',duration:200}));
 }catch(e){this.setData({courseDraft:null,error:e.message,importAdvanced:true});}},

 updateImportGrid(){if(!this.data.courseDraft||!this.importPeriod)return;const days=T.week(Date.parse(this.importPeriod.start+'T12:00:00+08:00'),this.data.importPreviewWeek);this.setData({importGrid:require('../../shared/course-grid').layout({mine:{courses:this.data.courseDraft}},days,'mine'),importPreviewLabel:days[0].date+' — '+days[6].date});},
 shiftImportGrid(e){if(!this.importPeriod)return;const max=Math.floor((Date.parse(this.importPeriod.end)-Date.parse(this.importPeriod.start))/604800000);this.setData({importPreviewWeek:Math.max(0,Math.min(max,this.data.importPreviewWeek+Number(e.currentTarget.dataset.delta)))});this.updateImportGrid();},
 showImportCourse(e){const item=this.data.importGrid&&this.data.importGrid.events.find(c=>c.id===e.currentTarget.dataset.id);if(item)wx.showModal({title:item.title,content:item.date+'\n'+item.time+'\n'+(item.place||'地点未填'),showCancel:false});},
 async saveImportedCourses(){
  if(!this.data.courseDraft||!this.importPeriod||this.data.busy)return;
  try{const roomId=this.data.room.id,range=this.importPeriod,existing=this.data.timetable&&this.data.timetable.mine?this.data.timetable.mine.courses:[];
   const courses=T.normalize(existing.filter(c=>c.date<range.start||c.date>range.end).concat(this.data.courseDraft));
   const table=this.data.timetable&&this.data.timetable.mine;const coverage=T.coverage(T.coverage(table?table.coverage:undefined,existing).concat([range]),courses);
   const choice=await wx.showModal({title:'保存 '+this.data.importTerm+' 学期课表？',content:range.start+' 至 '+range.end+'，共 '+this.data.courseDraft.length+' 次课程。请确认教学周、单双周与调课已核对；未排课内容需补充。本日期范围会被替换，其他日期与共享选择保留。',confirmText:'确认保存'});if(!choice.confirm)return;
   if(!this.data.room||this.data.room.id!==roomId||!this.data.courseDraft)throw new Error('空间已变化，请重新导入');
   if(await this.request('saveTimetable',{roomId,courses,coverage})){this.cancelCourses();wx.pageScrollTo({scrollTop:0,duration:200});wx.showToast({title:'课表已保存'});}
  }catch(e){this.setData({error:e.message||e.errMsg||'保存失败，请重试'});}
 },
 editCourses(){this.setData({importView:false,courseEditing:true,courseDraft:null,courseText:this.data.timetable&&this.data.timetable.mine?this.data.timetable.mine.courses.map(r=>[r.date,r.start,r.end,r.title,r.place].join(' | ')).join('\n'):'',error:''});wx.nextTick(()=>wx.pageScrollTo({selector:'#course-editor',duration:250}));},
 previewCourses(){try{this.setData({courseDraft:T.parse(this.data.courseText),error:''});}catch(e){this.setData({error:e.message,courseDraft:null});}},
 cancelCourses(){this.importSource=null;this.importPeriod=null;this.setData({courseEditing:false,importView:false,courseDraft:null,calendarReviewed:false,error:''});},
 async saveCourses(){if(!this.data.courseDraft)return;const ok=await this.request('saveTimetable',{roomId:this.data.room.id,courses:this.data.courseDraft,coverage:T.coverage(this.data.timetable&&this.data.timetable.mine?this.data.timetable.mine.coverage:undefined,this.data.courseDraft)});if(ok){this.setData({courseEditing:false,courseDraft:null});wx.pageScrollTo({scrollTop:0,duration:200});wx.showToast({title:'课表已保存'});}},
 async shareCourses(e){if(e.detail.value){const choice=await wx.showModal({title:'将课表共享给当前伴侣？',content:'对方将看到课程、时间和地点。你可以随时关闭共享；解除绑定后不再共享给对方或新伴侣。',confirmText:'同意共享'});if(!choice.confirm){this.setData({timetable:this.data.timetable});return;}}await this.request('shareTimetable',{roomId:this.data.room.id,value:e.detail.value});},
 async clearCourses(){const choice=await wx.showModal({title:'删除我的课表？',content:'同时停止课表共享，不会删除另一半的课表。'});if(choice.confirm)await this.request('clearTimetable',{roomId:this.data.room.id});},
 planFree(e){this.setData({place:this.data.courseDate+' '+e.currentTarget.dataset.start+'–'+e.currentTarget.dataset.end+' 一起自习'});this.select({currentTarget:{dataset:{id:'study'}}});this.tab({currentTarget:{dataset:{tab:'activities'}}});wx.showToast({title:'已填入计划，到时再发起',icon:'none'});},
 updateTrial(){const r=this.data.room;if(!r)return;const steps=[{title:'与 TA 组成情侣',detail:'一人生成邀请码，另一人输入并确认。',done:!!r.paired,action:'pair'},{title:'完成第一次约会',detail:'可以先听一首歌，双方加入并确认。',done:r.records.length>0,action:'music'},{title:'在情侣榜相遇',detail:'双方都开启上榜，才能展示组合与积分。',done:!!r.listed,action:'board'}];this.setData({trialSteps:steps,trialProgress:'width:'+Math.round(steps.filter(s=>s.done).length/3*100)+'%;'});},
 trialStep(e){const action=e.currentTarget.dataset.action;if(action==='music'){if(!this.data.room.paired)return this.tab({currentTarget:{dataset:{tab:'pair'}}});return this.quick({currentTarget:{dataset:{id:'music'}}});}return this.tab({currentTarget:{dataset:{tab:action}}});},
 copyTrialFeedback(){const description=this.data.feedbackText.trim();if(!description){wx.showToast({title:'先写下遇到的问题',icon:'none'});return;}wx.setClipboardData({data:'浙天遇见你 · '+this.data.releaseVersion+' 体验反馈\n环境：'+(this.data.demo?'本机演示':'微信云端')+'\n绑定状态：'+(this.data.room.paired?'已绑定':'未绑定')+'\n问题：'+description+'\n请补充手机型号、微信版本和复现步骤；截图时遮住邀请码。'});},
 copyAcademicURL(){wx.setClipboardData({data:'https://zdbk.zju.edu.cn/'});},
 tab(e){if(e.currentTarget.dataset.tab==='timetable')return this.openTimetable();if(this.data.schoolForm)this.closeSchool();if(this.data.courseEditing)this.cancelCourses();this.setData({tab:e.currentTarget.dataset.tab==='home'&&this.data.room&&!this.data.room.paired?'pair':e.currentTarget.dataset.tab,editor:false,error:'',completion:null});wx.pageScrollTo({scrollTop:0,duration:0});if(this.data.tab==='board')this.request('board');if(this.data.tab==='activities')return this.request('snapshot');if(this.data.tab==='trial')this.updateTrial();if(this.data.tab==='settings')this.setData({nickname:(this.data.room.members.find(m=>m.id===this.data.room.me)||{}).name||''});},
 select(e){const id=e.currentTarget.dataset.id;this.setData({selected:id,selectedType:D.TYPES.find(t=>t.id===id),ideas:IDEAS[id],ideaIndex:0});},
 quick(e){this.select(e);return this.tab({currentTarget:{dataset:{tab:'activities'}}});},
 filterRecords(e){const filter=e.currentTarget.dataset.id;const records=enrich(this.data.room.records);this.setData({filter,visibleRecords:filter==='all'?records:records.filter(r=>r.type===filter)});},
 useIdea(e){this.setData({place:e.currentTarget.dataset.idea});},
 nextIdea(){this.setData({ideaIndex:(this.data.ideaIndex+1)%this.data.ideas.length});},
 enterToday(){if(!this.data.room.paired)this.tab({currentTarget:{dataset:{tab:'pair'}}});else this.tab({currentTarget:{dataset:{tab:'activities'}}});},
 focusActivity(){wx.pageScrollTo({selector:'#current-activity',duration:250});},
 toggleDemo(){this.setData({showDemo:!this.data.showDemo});},
 input(e){const field=e.currentTarget.dataset.field;this.setData(Object.assign({[field]:e.detail.value},field==='courseText'?{courseDraft:null}:{}));},
 async start(){if(await this.request('start',{type:this.data.selected,place:this.data.place})){this.setData({tab:'activities',place:''});wx.pageScrollTo({scrollTop:0,duration:200});}},
 async act(e){const action=e.currentTarget.dataset.action;const activeId=this.data.room.active&&this.data.room.active.id;if(action==='nextWeek')this.setData({seasonCurrent:false,seasonKey:''});if(['cancel','reset'].includes(action)){const result=await wx.showModal({title:action==='reset'?'清空本机演示数据？':'取消这次活动？',content:action==='reset'?'只清除这台设备上的演示记录。':'此次活动不会获得积分，也不会进入回忆。'});if(!result.confirm)return;}if(action==='cancel'&&(!this.data.room.active||this.data.room.active.id!==activeId)){wx.showToast({title:'活动已变化，请重新查看',icon:'none'});return;}await this.request(action,{id:activeId});},
 async joinRoom(){const code=this.data.code.replace(/\s/g,'').toUpperCase();if(this.data.demo){this.setData({error:'本机体验不能接受真实邀请。连接云开发后才能与另一台手机绑定。'});return false;}if(!/^[A-F0-9]{12}$/.test(code)){this.setData({error:'请输入完整的 12 位邀请码'});return false;}const result=await wx.showModal({title:'确认与邀请人组成情侣？',content:'加入后，你们将共享约会与回忆。请先向另一半核对邀请码：'+code,confirmText:'确认加入'});if(!result.confirm)return false;return this.request('joinRoom',{code});},
 invite(){return this.request('invite');},
 async revokeInvite(){const choice=await wx.showModal({title:'撤销这份邀请？',content:'已发出的卡片与邀请码将立即失效。你可以重新生成邀请。',confirmText:'撤销邀请'});if(choice.confirm)await this.request('revokeInvite');},
 async saveProfile(){if(await this.request('profile',{name:this.data.nickname}))wx.showToast({title:'昵称已保存',icon:'success'});},
 async leaveRoom(){const roomId=this.data.room.id;const choice=await wx.showModal({title:'确认解除情侣绑定？',content:'双方将回到独立空间，进行中的约会取消，本周榜单退出。已完成回忆归档为只读，原来的两人仍可查看，新伴侣无法访问。',confirmText:'解除绑定',confirmColor:'#953e4a'});if(choice.confirm&&await this.request('leave',{roomId})){this.setData({tab:'pair',code:'',pairSuccess:false,completion:null,archiveDetail:null});wx.pageScrollTo({scrollTop:0,duration:0});}},
 async openArchives(){this.setData({tab:'archives',archives:[],archiveDetail:null,archiveOffset:null});await this.request('archives');},
 async moreArchives(){if(this.data.archiveOffset!==null)await this.request('archives',{offset:this.data.archiveOffset});},
 viewArchive(e){const room=this.data.archives.find(r=>r.id===e.currentTarget.dataset.id);if(room)this.setData({archiveDetail:room});},
 closeArchive(){this.setData({archiveDetail:null});},
 copy(){if(this.data.demo||this.data.inviteExpired)return;wx.setClipboardData({data:this.data.room.invite.code});},
 vote(e){return this.request('vote',{value:e.detail.value});},
 edit(e){const id=e.currentTarget.dataset.id;const r=this.data.room;const record=r.active&&r.active.id===id?r.active:r.records.find(x=>x.id===id);this.setData({editor:true,recordId:id,note:record?record.note:''});},
 close(){this.setData({editor:false});},
 async saveNote(){if(await this.request('note',{id:this.data.recordId,note:this.data.note}))this.setData({editor:false});},
 openCouple(e){const id=e.currentTarget.dataset.id||this.data.room.id;const row=this.data.board.find(x=>x.id===id);if(id!==this.data.room.id&&!row){wx.showToast({title:'该组合已退出榜单',icon:'none'});return;}this.setData({detail:row||{id,label:'我们的共同生活',points:this.data.room.weekPoints,rank:0},tab:'couple'});wx.pageScrollTo({scrollTop:0,duration:0});},
 async openSeason(){if(this.data.busy)return;this.setData({tab:'season',seasonCurrent:false,seasonKey:'',season:null,posterPath:'',error:''});wx.pageScrollTo({scrollTop:0,duration:0});await this.request('season',{current:false});},
 async seasonPeriod(e){this.setData({seasonKey:'',seasonCurrent:e.currentTarget.dataset.current===true||e.currentTarget.dataset.current==='true',posterPath:''});await this.request('season',{current:this.data.seasonCurrent,key:this.data.seasonKey||undefined});},
 async pickHistory(e){const item=this.data.historyWeeks[Number(e.detail.value)];if(!item)return;this.setData({seasonKey:item.key,seasonCurrent:false,posterPath:''});await this.request('season',{key:item.key});},
 async claimReward(){if(await this.request('claim',{key:this.data.season.key}))wx.showToast({title:'纪念章已收入收藏',icon:'success'});},
 async openPoster(){if(!this.data.season||!this.data.season.hasData)return;this.setData({tab:'poster',posterPath:'',posterError:''});wx.pageScrollTo({scrollTop:0,duration:0});wx.nextTick(()=>this.generatePoster());},
 async generatePoster(){if(this.data.posterBusy)return;this.setData({posterBusy:true,posterError:''});try{const path=await Poster.render(this,this.data.season,this.data.posterTheme,this.data.demo);this.setData({posterPath:path});}catch(e){this.setData({posterError:e.message||'海报生成失败，请重试'});}finally{this.setData({posterBusy:false});}},
 posterTheme(e){this.setData({posterTheme:e.currentTarget.dataset.theme});this.generatePoster();},
 async savePoster(){if(!this.data.posterPath)return;try{await wx.saveImageToPhotosAlbum({filePath:this.data.posterPath});wx.showToast({title:'已保存到相册'});}catch(e){this.setData({posterError:'未保存成功。请检查相册权限后重试，也可以预览图片。'});}},
 previewPoster(){if(this.data.posterPath)wx.previewImage({urls:[this.data.posterPath],current:this.data.posterPath});},
 albumSettings(){wx.openSetting({});},
 returnSeason(){this.setData({tab:'season'});wx.pageScrollTo({scrollTop:0,duration:0});},
 closeCompletion(){this.setData({completion:null});},
 onShareAppMessage(){if(!this.data.demo&&!this.data.inviteExpired&&this.data.room&&this.data.room.invite)return {title:'邀请你，一起开启我们的校园故事',path:'/pages/index/index?code='+this.data.room.invite.code};return {imageUrl:this.data.tab==='poster'?this.data.posterPath:undefined,title:'浙天遇见你 · 一起积攒校园情侣积分',path:'/pages/index/index'};}
}));
