// CAS-compatible RSA encoding. Plaintext remains in device memory; no storage.
function encrypt(password,key){
 if(typeof password!=='string'||!password.length||password.length>128)throw new Error('密码长度不正确');
 if(!key||!/^([a-f\d]{4}){32,128}$/i.test(key.modulus)||!/^0*10001$/i.test(key.exponent))throw new Error('学校加密参数已变化，请重试');
 const n=key.modulus.match(/.{4}/g).reverse().map(x=>parseInt(x,16));while(n.length>1&&!n[n.length-1])n.pop();
 const size=n.length,zero=()=>Array(size).fill(0);
 function cmp(a,b){for(let i=size-1;i>=0;i--)if(a[i]!==b[i])return a[i]-b[i];return 0;}
 function add(a,b){const c=zero();let carry=0;for(let i=0;i<size;i++){const v=a[i]+b[i]+carry;c[i]=v&65535;carry=v>>>16;}if(carry||cmp(c,n)>=0){let borrow=0;for(let i=0;i<size;i++){let v=c[i]-n[i]-borrow;borrow=v<0?1:0;c[i]=(v+65536)&65535;}}return c;}
 function mul(a,b){let out=zero(),v=a;for(let i=0;i<size;i++)for(let bit=0;bit<16;bit++){if((b[i]>>>bit)&1)out=add(out,v);v=add(v,v);}return out;}
 const chars=password.split('').reverse().map(c=>c.charCodeAt(0)),chunk=2*(size-1),blocks=[];
 for(let k=0;k<chars.length;k+=chunk){let base=zero();for(let i=0;i<chunk;i+=2)base[i/2]=(chars[k+i]||0)+((chars[k+i+1]||0)<<8);if(base.some(x=>x>65535))throw new Error('密码含暂不支持的字符，请使用学校网页登录');let out=zero();out[0]=1;let e=65537;while(e){if(e&1)out=mul(out,base);e>>>=1;if(e)base=mul(base,base);}while(out.length>1&&!out[out.length-1])out.pop();blocks.push(out.reverse().map(x=>x.toString(16).padStart(4,'0')).join(''));}
 return blocks.join(' ');
}
module.exports={encrypt};
