const https=require('https');
const HOSTS=new Set(['zjuam.zju.edu.cn','zdbk.zju.edu.cn']);
function checked(raw){const u=new URL(raw);if(u.protocol!=='https:'||!HOSTS.has(u.hostname)||u.username||u.password||u.port&&u.port!=='443')throw new Error('学校返回了不支持的登录地址');return u;}
class SchoolHTTP{
 constructor(cookies=[]){this.cookies=cookies;this.deadline=Date.now()+45000;}
 async request(raw,form,redirects=0){
  const u=checked(raw);if(redirects>8||Date.now()>this.deadline)throw new Error('学校响应超时，请稍后重试');
  const body=form?new URLSearchParams(form).toString():null;
  const cookie=this.cookies.filter(c=>(u.hostname===c.domain||u.hostname.endsWith('.'+c.domain))&&(u.pathname===c.path||u.pathname.startsWith(c.path.endsWith('/')?c.path:c.path+'/'))&&(!c.expires||c.expires>Date.now())).map(c=>c.name+'='+c.value).join('; ');
  const result=await new Promise((resolve,reject)=>{const req=https.request(u,{method:form?'POST':'GET',headers:{'User-Agent':'Mozilla/5.0','Accept-Encoding':'identity',Accept:'*/*',...(form&&u.hostname==='zdbk.zju.edu.cn'?{'X-Requested-With':'XMLHttpRequest'}:{}),...(cookie?{Cookie:cookie}:{}),...(form?{'Content-Type':'application/x-www-form-urlencoded','Content-Length':Buffer.byteLength(body),Origin:u.origin,Referer:u.origin+'/'}:{})}},res=>{const chunks=[];let len=0;res.on('data',b=>{len+=b.length;if(len>2*1024*1024)req.destroy(new Error('学校响应过大'));else chunks.push(b);});res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks)}));res.on('error',()=>reject(new Error('读取学校响应失败')));});req.setTimeout(Math.min(12000,Math.max(1,this.deadline-Date.now())),()=>req.destroy(new Error('学校连接超时')));req.on('error',()=>reject(new Error('暂时无法连接学校，请稍后重试')));if(body)req.write(body);req.end();});
  for(const line of result.headers['set-cookie']||[]){const parts=line.split(';').map(x=>x.trim()),first=parts.shift(),eq=first.indexOf('=');if(eq<1)continue;const attrs={};for(const p of parts){const i=p.indexOf('=');attrs[(i<0?p:p.slice(0,i)).toLowerCase()]=i<0?'':p.slice(i+1);}const domain=(attrs.domain||u.hostname).replace(/^\./,'');if(!(u.hostname===domain||u.hostname.endsWith('.'+domain))||!(HOSTS.has(domain)||domain==='zju.edu.cn'))continue;const c={name:first.slice(0,eq),value:first.slice(eq+1),domain,path:attrs.path||u.pathname.slice(0,u.pathname.lastIndexOf('/')+1)||'/'};if(attrs['max-age'])c.expires=Date.now()+Number(attrs['max-age'])*1000;else if(attrs.expires)c.expires=Date.parse(attrs.expires)||0;this.cookies=this.cookies.filter(x=>!(x.name===c.name&&x.domain===c.domain&&x.path===c.path));if(!c.expires||c.expires>Date.now())this.cookies.push(c);}
  if([301,302,303,307,308].includes(result.status)&&result.headers.location){const next=checked(new URL(result.headers.location,u).href);if(form&&[307,308].includes(result.status))throw new Error('登录跳转方式已变化，请使用教务网页');return this.request(next.href,null,redirects+1);}
  if(result.status!==200)throw new Error('学校服务暂不可用，请稍后重试');return {...result,url:u.href,text:result.body.toString('utf8')};
 }
 async json(url,form){const r=await this.request(url,form);try{return JSON.parse(r.text);}catch{throw new Error('学校登录已失效或返回格式变化，请重新登录');}}
}
module.exports={SchoolHTTP,checked};
