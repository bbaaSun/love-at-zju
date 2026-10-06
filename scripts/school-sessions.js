const crypto=require('crypto');
class Sessions{
 constructor(now=Date.now){this.items=new Map();this.now=now;}
 put(value){for(const [id,s] of this.items)if(s.expires<=this.now())this.items.delete(id);if(this.items.size>=10)throw Error('打开的验证页面过多，请稍后重试');const id=crypto.randomBytes(16).toString('hex'),expires=this.now()+300000;this.items.set(id,{value,expires});return {sessionId:id,expires};}
 take(id){const s=this.items.get(id);this.items.delete(id);if(!s||s.expires<=this.now())throw Object.assign(Error('登录准备已失效，请重新连接学校'),{stage:'prepare'});return s.value;}
}
module.exports=Sessions;
