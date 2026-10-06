const test=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto'),vm=require('node:vm'),fs=require('node:fs');
const RSA=require('../miniprogram/utils/school-rsa');
const P=require('../cloudfunctions/api/school-parse');
const H=require('../cloudfunctions/api/school-http');
const S=require('../cloudfunctions/api/school');
function power(x,e,n){let r=1n;while(e){if(e&1n)r=r*x%n;x=x*x%n;e>>=1n;}return r;}
test('device RSA matches school reverse/little-endian block convention without BigInt runtime',()=>{
 const key={modulus:'d3'+crypto.randomBytes(63).toString('hex'),exponent:'10001'};
 for(const pass of ['Abc_123!','x'.repeat(100)]){const c=pass.split('').reverse().map(c=>c.charCodeAt(0)),out=[];for(let k=0;k<c.length;k+=62){let b=0n;for(let i=61;i>=0;i--)b=(b<<8n)+BigInt(c[k+i]||0);let h=power(b,65537n,BigInt('0x'+key.modulus)).toString(16);h=h.padStart(Math.ceil(h.length/4)*4,'0');out.push(h);}assert.equal(RSA.encrypt(pass,key),out.join(' '));}
});
test('invalid key and empty password rejected',()=>{assert.throws(()=>RSA.encrypt('',{}));assert.throws(()=>RSA.encrypt('pass',{modulus:'1',exponent:'3'}));});
test('only two official HTTPS hosts allowed, even in redirects',()=>{for(const url of ['http://zjuam.zju.edu.cn/cas/','https://zjuam.zju.edu.cn.evil.test/','https://evil@zdbk.zju.edu.cn/','https://zdbk.zju.edu.cn:444/','http://127.0.0.1/'])assert.throws(()=>H.checked(url));assert.equal(H.checked('https://zdbk.zju.edu.cn/jwglxt/').hostname,'zdbk.zju.edu.cn');});
const row={sfqd:'1',xqj:'4',djj:'9',skcd:'2',dsz:'0',kcb:'课程甲zwf秋冬{第2-6周|2节/单周}zwf教师zwf东1-101zwf考试安排'};
test('grid response preserves teaching weeks, parity and period boundaries',()=>{const d=P.parse({kbList:[row,row],xkkg:true},2026,'秋');assert.equal(d.courses.length,1);assert.equal(d.courses[0].meetings.length,1);assert.deepEqual(d.courses[0].meetings[0],{weekday:4,start:'16:15',end:'17:50',parity:'odd',place:'东1-101',weeks:{first:2,last:6}});assert.ok(!JSON.stringify(d).includes('教师'));});
test('unrecognized and tentative courses never silently become busy time',()=>{assert.throws(()=>P.parse({kbList:[{...row,sfqd:'0'}]},2026,'秋'));const d=P.parse({kbList:[row,{...row,kcb:'未知格式'}]},2026,'秋');assert.equal(d.issues.length,1);assert.throws(()=>P.parse({kbList:[],xkkg:false},2026,'秋'));});
test('hidden execution decoded independent of attribute order',()=>assert.equal(S.execution('<input value="a&amp;b" name="execution" type="hidden">'),'a&b'));
test('import rejects plaintext and invalid account selection',()=>{assert.throws(()=>S.valid({password:'secret'}));assert.throws(()=>S.valid({username:'12345678',encryptedPassword:'abc',year:2026,term:'秋',sessionId:'0'.repeat(32)}));});
test('calendar applies per-meeting week range from school',()=>{const C=require('../miniprogram/shared/course-calendar');const d=P.parse({kbList:[row]},2026,'秋');const p=C.defaults('秋',2026);const r=C.expand(d,{...p,term:'秋',ranges:{}});assert.ok(r.courses.length>0);assert.ok(r.courses.every(c=>c.date>='2026-09-21'&&c.date<='2026-10-25'));});
test('authenticated import session consumed once and bound to server identity',async()=>{
 const profiles={a:{schoolAuth:{id:'0'.repeat(32),expires:Date.now()+10000,cookies:[],execution:'test'}},b:{}};
 const db={runTransaction:fn=>fn({})},read=async(_,col,id)=>structuredClone(profiles[id]),write=async(_,col,id,data)=>{profiles[id]=data};
 const payload={sessionId:'0'.repeat(32),username:'12345678',encryptedPassword:'abcd',year:2026,term:'秋'};
 await assert.rejects(S.handle('importSchool',payload,'b',db,read,write),/过期/);
 // Simulate school network failure without making any external login attempt.
 const source=fs.readFileSync(require.resolve('../cloudfunctions/api/school'),'utf8'),mod={exports:{}};
 vm.runInNewContext(source,{module:mod,exports:mod.exports,require:id=>id==='./school-http'?{SchoolHTTP:class{request(){throw Error('学校连接失败');}}}:id==='./school-parse'?P:require(id),URL,Date});
 await assert.rejects(mod.exports.handle('importSchool',payload,'a',db,read,write),/学校连接失败/);
 assert.equal(profiles.a.schoolAuth,undefined);
 await assert.rejects(mod.exports.handle('importSchool',payload,'a',db,read,write),/过期/);
});
function schoolPage(call){let page;const path=require('node:path'),file=path.resolve(__dirname,'../miniprogram/pages/index/index.js');vm.runInNewContext(fs.readFileSync(file,'utf8'),{Page:p=>page=p,require:n=>n.endsWith('/services/api')?{call}:require(path.resolve(path.dirname(file),n)),wx:{pageScrollTo(){},nextTick:fn=>fn()},Date,setInterval,clearInterval});page.setData=x=>Object.assign(page.data,x);page.data.room={id:'r'};page.data.tab='timetable';return page;}
test('password is not placed in page data or sent in plaintext; success requires preview not autosave',async()=>{
 const key={modulus:'d3'+crypto.randomBytes(63).toString('hex'),exponent:'10001'},calls=[];
 const page=schoolPage(async(a,p)=>{calls.push({a,p});if(a==='beginSchool')return {sessionId:'0'.repeat(32),key,captcha:''};if(a==='importSchool')return {term:'秋',draft:P.parse({kbList:[row]},2026,'秋')};return {};});
 page.openSchool();page.schoolConsent({detail:{value:true}});await page.connectSchool();page.data.schoolUsername='12345678';page.schoolSecret({detail:{value:'Abc123!'}});assert.ok(!JSON.stringify(page.data).includes('Abc123!'));await page.importSchool();
 assert.equal(page.schoolPassword,'');assert.equal(page.schoolSession,null);assert.ok(page.data.courseDraft.length>0);assert.ok(!JSON.stringify(calls).includes('Abc123!'));assert.ok(!calls.some(c=>c.a==='saveTimetable'));assert.equal(page.data.schoolForm,false);
});
test('leaving page clears secrets and ignores late authentication response',async()=>{
 let resolve;const page=schoolPage(a=>a==='beginSchool'?new Promise(r=>resolve=r):Promise.resolve({}));page.openSchool();page.data.schoolConsent=true;const work=page.connectSchool();page.schoolSecret({detail:{value:'secret'}});page.onHide();resolve({sessionId:'0'.repeat(32),key:{},captcha:''});await work;assert.equal(page.schoolPassword,'');assert.equal(page.schoolSession,undefined);assert.equal(page.data.schoolReady,false);assert.equal(page.data.schoolForm,false);
});
test('SSO flow derives query identity from authenticated school page',async()=>{
 const calls=[],source=fs.readFileSync(require.resolve('../cloudfunctions/api/school'),'utf8'),mod={exports:{}};
 class HTTP{async request(url,form){calls.push({url,form});if(form)return {url:'https://zdbk.zju.edu.cn/jwglxt/xtgl/login_ssologin.html',text:''};return {text:'<input value="12345678" id="xsxh" type="hidden">'};}async json(url,form){calls.push({url,form});return {kbList:[row]};}}
 vm.runInNewContext(source,{module:mod,exports:mod.exports,require:id=>id==='./school-http'?{SchoolHTTP:HTTP}:id==='./school-parse'?P:require(id),URL,Date});
 const result=await mod.exports.fetchCourses({cookies:[],execution:'token'},{username:'87654321',encryptedPassword:'abcd',year:2026,term:'秋'});
 assert.equal(result.courses.length,1);assert.ok(calls[2].url.endsWith('&su=12345678'));assert.equal(calls[2].form.xqm,'1|秋');assert.equal(calls[2].form.xnm,'2026-2027');assert.equal(calls[0].form.rememberMe,undefined);
});
test('local login sessions are isolated between tabs and expire without consuming another tab',()=>{
 const Sessions=require('../scripts/school-sessions');let clock=1000;const sessions=new Sessions(()=>clock),a=sessions.put({id:'a'}),b=sessions.put({id:'b'});assert.equal(sessions.take(a.sessionId).id,'a');assert.throws(()=>sessions.take(a.sessionId));assert.equal(sessions.take(b.sessionId).id,'b');const c=sessions.put({id:'c'});clock+=300001;assert.throws(()=>sessions.take(c.sessionId),/失效/);
});
test('expired native login preparation refreshes before encryption and does not retry password login',async()=>{
 const calls=[],key={modulus:'d3'+crypto.randomBytes(63).toString('hex'),exponent:'10001'};
 const page=schoolPage(async(a,p)=>{calls.push({a,p});if(a==='beginSchool')return {sessionId:'1'.repeat(32),expires:Date.now()+300000,key,captcha:''};if(a==='importSchool')return {term:'秋',draft:P.parse({kbList:[row]},2026,'秋')};return {};});
 page.openSchool();page.schoolSession={sessionId:'0'.repeat(32),expires:1,key,captcha:''};page.data.schoolConsent=true;page.data.schoolUsername='12345678';page.schoolSecret({detail:{value:'Password1'}});await page.importSchool();assert.equal(calls.filter(c=>c.a==='importSchool').length,1);assert.equal(calls.find(c=>c.a==='importSchool').p.sessionId,'1'.repeat(32));assert.ok(page.data.courseDraft.length);
});
test('school parent-domain CSRF cookie is retained and sent, unrelated domains rejected',async()=>{
 const {EventEmitter}=require('node:events'),calls=[];let step=0;
 const https={request(url,opts,onResponse){calls.push({url:String(url),headers:opts.headers});const req=new EventEmitter();req.setTimeout=()=>{};req.write=()=>{};req.destroy=()=>{};req.end=()=>{const res=new EventEmitter();res.statusCode=200;res.headers=step++===0?{'set-cookie':['_csrf=test-csrf; Domain=zju.edu.cn; Path=/','JSESSIONID=test-session; Path=/cas; HttpOnly','evil=bad; Domain=evil.test; Path=/']}:{'content-type':'text/plain'};onResponse(res);queueMicrotask(()=>{res.emit('data',Buffer.from('ok'));res.emit('end');});};return req;}};
 const mod={exports:{}};vm.runInNewContext(fs.readFileSync(require.resolve('../cloudfunctions/api/school-http'),'utf8'),{module:mod,require:n=>n==='https'?https:require(n),URL,URLSearchParams,Buffer,Date});
 const client=new mod.exports.SchoolHTTP();await client.request('https://zjuam.zju.edu.cn/cas/login');await client.request('https://zjuam.zju.edu.cn/cas/login',{username:'test'});await client.request('https://zdbk.zju.edu.cn/jwglxt/');
 assert.equal(client.cookies.length,2);assert.match(calls[1].headers.Cookie,/_csrf=test-csrf/);assert.match(calls[1].headers.Cookie,/JSESSIONID=test-session/);assert.equal(calls[2].headers.Cookie,'_csrf=test-csrf');await assert.rejects(client.request('https://other.zju.edu.cn/'));
});
