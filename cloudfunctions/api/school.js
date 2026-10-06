const crypto=require('crypto');
const {SchoolHTTP}=require('./school-http');
const {parse,decode}=require('./school-parse');
const CAS='https://zjuam.zju.edu.cn/cas/';
const JW='https://zdbk.zju.edu.cn/jwglxt/';
const LOGIN=CAS+'login?service='+encodeURIComponent(JW+'xtgl/login_ssologin.html');
function execution(html){for(const tag of html.match(/<input\b[^>]*>/gi)||[]){if(/name=["']execution["']/.test(tag)){const m=/value=["']([^"']+)["']/.exec(tag);if(m)return decode(m[1]);}}throw new Error('学校登录页面已变化，请稍后重试');}
async function prepare(){const http=new SchoolHTTP();await http.request(JW+'xtgl/login_cxSsoLoginUrl.html',{});const page=await http.request(LOGIN);const token=execution(page.text);const status=await http.json(CAS+'v2/getKaptchaStatus');const key=await http.json(CAS+'v2/getPubKey');if(!key||!/^[a-f\d]{128,512}$/i.test(key.modulus)||!/^0*10001$/i.test(key.exponent))throw new Error('学校加密参数已变化');let captcha='';if(status===true||status===1||status==='true'){const r=await http.request(CAS+'kaptcha?time='+Date.now());const mime=String(r.headers['content-type']||'').split(';')[0];if(!['image/jpeg','image/png','image/gif'].includes(mime)||r.body.length>200000)throw new Error('验证码加载失败');captcha='data:'+mime+';base64,'+r.body.toString('base64');}return {session:{cookies:http.cookies,execution:token},key,captcha};}
async function fetchCourses(session,p){
 let stage='认证';try{
 const http=new SchoolHTTP(session.cookies);
 const page=await http.request(LOGIN,{username:p.username,password:p.encryptedPassword,authcode:p.captcha||'',execution:session.execution,_eventId:'submit'});
 if(new URL(page.url).hostname!=='zdbk.zju.edu.cn')throw new Error('学校未完成登录，请核对账号密码和验证码；如需二次验证，请先在教务网完成');
 stage='教务会话';
 const index=await http.request(JW+'kbcx/xskbcx_cxXskbcxIndex.html?gnmkdm=N253508&layout=default');
 const input=(index.text.match(/<input\b[^>]*>/gi)||[]).find(tag=>/id=["']xsxh["']/.test(tag));
 const account=input&&/value=["'](\d{8,14})["']/.exec(input);
 if(!account)throw new Error('教务登录未生效，请重新登录');
 const form={xnm:p.year+'-'+(p.year+1),xqm:('秋冬'.includes(p.term)?'1':'2')+'|'+p.term,xqmmc:p.term,xxqf:'0',xsfs:'0'};
 stage='课表查询';
 const data=await http.json(JW+'kbcx/xskbcx_cxXsKb.html?gnmkdm=N253508&su='+encodeURIComponent(account[1]),form);
 stage='课表解析';
 return parse(data,p.year,p.term);
 }catch(e){throw Object.assign(new Error(stage+'：'+e.message),{stage});}
}
function valid(p){if(typeof p.username!=='string'||!/^\d{8,14}$/.test(p.username)||typeof p.encryptedPassword!=='string'||! /^[a-f0-9]{4,512}(?: [a-f0-9]{4,512})?$/.test(p.encryptedPassword)||typeof p.sessionId!=='string'||!/^[a-f0-9]{32}$/.test(p.sessionId)||!Number.isInteger(p.year)||p.year<2020||p.year>2100||!['秋','冬','春','夏'].includes(p.term)||p.captcha&& !/^[a-zA-Z0-9]{1,10}$/.test(p.captcha))throw new Error('请检查学号、密码、验证码和学期');}
// Only unauthenticated CAS state is retained, in a server-only profile field.
// Each attempt consumes it atomically before contacting school; authenticated cookies never persist.
async function handle(action,p,user,db,read,write){
 if(action==='beginSchool'){
  const sessionId=crypto.randomBytes(16).toString('hex'),now=Date.now();
  await db.runTransaction(async tx=>{const profile=await read(tx,'profiles',user);if(!profile)throw new Error('请先打开首页');const rate=profile.schoolRate||{start:now,count:0};if(now-rate.start>600000){rate.start=now;rate.count=0;}if(rate.count>=6)throw new Error('登录尝试过于频繁，请十分钟后再试');rate.count++;profile.schoolRate=rate;delete profile.schoolAuth;await write(tx,'profiles',user,profile);});
  const result=await prepare();
  await db.runTransaction(async tx=>{const profile=await read(tx,'profiles',user);profile.schoolAuth={...result.session,id:sessionId,expires:Date.now()+300000};await write(tx,'profiles',user,profile);});
  return {sessionId,key:result.key,captcha:result.captcha,expires:Date.now()+300000};
 }
 if(action==='cancelSchool'){await db.runTransaction(async tx=>{const profile=await read(tx,'profiles',user);if(profile&&profile.schoolAuth&&profile.schoolAuth.id===p.sessionId){delete profile.schoolAuth;await write(tx,'profiles',user,profile);}});return {};}
 valid(p);const session=await db.runTransaction(async tx=>{const profile=await read(tx,'profiles',user),s=profile&&profile.schoolAuth;if(!s||s.id!==p.sessionId||s.expires<Date.now())throw new Error('登录页面已过期，请重新连接教务网');delete profile.schoolAuth;await write(tx,'profiles',user,profile);return s;});
 return {draft:await fetchCourses(session,p),term:p.term};
}
module.exports={handle,prepare,fetchCourses,execution,valid};
