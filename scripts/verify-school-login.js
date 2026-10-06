// Local integration harness. Bind only loopback; no logs, files or saved credentials.
const http=require('http'),fs=require('fs'),crypto=require('crypto');
const School=require('../cloudfunctions/api/school');
const Sessions=require('./school-sessions');const sessions=new Sessions();
const csrf=crypto.randomBytes(24).toString('hex');let last=0,result={status:'waiting'},history=[];
const html=`<!doctype html><meta charset="utf-8"><title>浙天遇见你 · 教务导入验证</title><style>body{font:16px system-ui;background:#f5f3eb;color:#213c34;max-width:520px;margin:60px auto;padding:24px}input,select,button{box-sizing:border-box;width:100%;font:inherit;padding:14px;margin:8px 0;border:1px solid #ccd3c9;border-radius:12px}button{background:#286352;color:white;cursor:pointer}small{line-height:1.8}pre{white-space:pre-wrap}img{max-width:240px}</style><h1>连接本科教务网</h1><p>验证账号密码自动导入</p><small>密码在本机按学校规则加密，仅通过这台电脑转交浙大统一认证。此页面不保存密码、登录会话或课表文件，不会上传课表到小程序云端。</small><button id="connect">连接学校</button><form hidden id="form"><input id="username" placeholder="本科生学号" autocomplete="off" required><input id="password" type="password" placeholder="统一身份认证密码" autocomplete="off" required><input id="year" value="2026" type="number"><select id="term"><option>秋</option><option>冬</option><option>春</option><option>夏</option></select><img id="pic" hidden><input id="captcha" placeholder="图片验证码" hidden><button id="submit">登录并读取课表</button></form><pre id="status">等待连接</pre><section id="timetable" hidden></section><script src="/school-preview.js"></script><script>var module={exports:{}};</script><script src="/rsa.js"></script><script>
let session;const $=id=>document.getElementById(id);async function call(path,data){const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json','X-Verify-Token':'${csrf}'},body:JSON.stringify(data)});const j=await r.json();if(j.error)throw Error(j.error);return j;}
async function prepare(){session=await call('/begin',{});$('form').hidden=false;$('pic').hidden=$('captcha').hidden=!session.captcha;$('pic').src=session.captcha;$('captcha').value='';return session;}
$('connect').onclick=async()=>{$('connect').disabled=true;$('status').textContent='正在连接学校…';try{await prepare();$('status').textContent='已连接学校，请输入账号密码';}catch(e){$('status').textContent=e.message;}finally{$('connect').disabled=false;}};
$('form').onsubmit=async e=>{e.preventDefault();$('submit').disabled=$('connect').disabled=true;let attempted=false;try{
 if(!session||session.expires<Date.now()+15000){$('status').textContent='正在自动更新登录连接…';await prepare();if(session.captcha){$('status').textContent='学校要求验证码，请填写图片验证码后再次提交';return;}}
 const encryptedPassword=module.exports.encrypt($('password').value,session.key),sessionId=session.sessionId;
 session=null;attempted=true;$('password').value='';$('status').textContent='正在登录并读取课表…';
 const j=await call('/login',{sessionId,username:$('username').value.trim(),encryptedPassword,captcha:$('captcha').value,year:Number($('year').value),term:$('term').value});
 $('form').hidden=true;$('status').textContent='成功读取 '+j.count+' 门课程、'+j.meetings+' 组上课时间。\\n'+j.titles.join('\\n')+'\\n待核对项：'+j.issues;showTimetable(j.draft);
 }catch(e){$('status').textContent=e.message+(attempted?'。密码已清除，重新填写后提交即可自动重连。':'');}finally{$('submit').disabled=$('connect').disabled=false;}};
window.addEventListener('pagehide',()=>{$('password').value='';session=null;});
</script>`;
http.createServer(async(req,res)=>{res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none'; form-action 'self'");if(req.headers.host!=='127.0.0.1:4174'){res.writeHead(403);return res.end();}
 if(req.method==='GET'&&req.url==='/'){res.setHeader('Content-Type','text/html;charset=utf-8');return res.end(html);}
 if(req.method==='GET'&&req.url==='/school-preview.js'){res.setHeader('Content-Type','application/javascript');return res.end(fs.readFileSync(require.resolve('./school-preview')));}
 if(req.method==='GET'&&req.url==='/rsa.js'){res.setHeader('Content-Type','application/javascript');return res.end(fs.readFileSync(require.resolve('../miniprogram/utils/school-rsa')));}
 if(req.method==='GET'&&req.url==='/status'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({...result,history}));}
 if(req.method!=='POST'||req.headers['x-verify-token']!==csrf||req.headers.origin!=='http://127.0.0.1:4174'){res.writeHead(403);return res.end();}
 res.setHeader('Content-Type','application/json');try{let body='';for await(const chunk of req){body+=chunk;if(body.length>4096)throw Error('请求过大');}const p=JSON.parse(body);
 if(req.url==='/begin'){if(Date.now()-last<5000)throw Error('请稍后重试');last=Date.now();const state=await School.prepare(),handle=sessions.put(state);return res.end(JSON.stringify({...handle,key:state.key,captcha:state.captcha}));}
 if(req.url==='/login'){School.valid(p);const current=sessions.take(p.sessionId);const draft=await School.fetchCourses(current.session,p);result={status:'success',count:draft.courses.length,meetings:draft.courses.reduce((n,c)=>n+c.meetings.length,0),issues:draft.issues.length};return res.end(JSON.stringify({...result,titles:draft.courses.map(c=>c.title),draft}));}res.writeHead(404);res.end('{}');
 }catch(e){result={status:'error',stage:e.stage||'prepare',error:e.message};history.push({stage:result.stage,error:e.message});history=history.slice(-5);res.end(JSON.stringify({error:e.message}));}
}).listen(4174,'127.0.0.1',()=>console.log('Local school import verification ready on port 4174'));
