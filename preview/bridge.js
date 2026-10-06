(async function(){
 const D=window.LoveDomain;
 window.wx={getStorageSync:k=>JSON.parse(localStorage.getItem(k)||'null'),setStorageSync:(k,v)=>localStorage.setItem(k,JSON.stringify(v)),removeStorageSync:k=>localStorage.removeItem(k),showModal:async o=>({confirm:window.confirm(o.title+'\n'+o.content)}),setClipboardData:async o=>{try{await navigator.clipboard.writeText(o.data);}catch(e){window.prompt('复制邀请码',o.data);}},stopPullDownRefresh:()=>{},pageScrollTo:o=>{const scroller=document.querySelector('.phone-screen');const target=o.selector&&document.querySelector(o.selector);scroller.scrollTop=target?target.offsetTop:0;}};
 async function moduleAt(url,require){const src=await(await fetch(url)).text();const module={exports:{}};new Function('module','exports','require',src)(module,module.exports,require);return module.exports;}
 const T=await moduleAt('/miniprogram/shared/timetable.js',()=>{});
 const Calendar=await moduleAt('/miniprogram/shared/course-calendar.js',()=>T);
 const S=await moduleAt('/miniprogram/shared/season.js',()=>D);
 const demo=await moduleAt('/miniprogram/services/demo.js',p=>p.includes('timetable')?T:p.includes('season')?S:D);
 const Poster=await moduleAt('/miniprogram/utils/poster.js',()=>{});
 wx.nextTick=fn=>setTimeout(fn,0);wx.showToast=o=>{const notice=document.createElement('div');notice.textContent=o.title;notice.setAttribute('role','status');notice.style.cssText='position:fixed;bottom:100px;left:50%;transform:translateX(-50%);background:#284d39;color:white;padding:12px 20px;z-index:9999;border-radius:8px';document.body.append(notice);setTimeout(()=>notice.remove(),2200);};
 wx.previewImage=o=>window.open(o.current,'_blank');wx.openSetting=()=>wx.showToast({title:'浏览器预览无需相册授权，请在微信中验收权限'});
 wx.saveImageToPhotosAlbum=async o=>{const a=document.createElement('a');a.href=o.filePath;a.download='浙天遇见你-周纪念.png';a.click();};
 wx.canvasToTempFilePath=o=>{try{o.success({tempFilePath:o.canvas.toDataURL('image/png')});}catch(e){o.fail(e);}};
 wx.createSelectorQuery=()=>{let selector;const q={in:()=>q,select:s=>{selector=s;return q;},fields:()=>q,exec:fn=>{const canvas=document.querySelector(selector);if(canvas)canvas.createImage=()=>{const img=new Image();const prop=Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,'src');Object.defineProperty(img,'src',{set:v=>prop.set.call(img,v.startsWith('/assets/')?'/miniprogram'+v:v),get:()=>prop.get.call(img)});return img;};fn(canvas?[{node:canvas}]:[]);}};return q;};
 let page;
 window.Page=definition=>{page=definition;page.setData=function(next,callback){Object.assign(this.data,next);if(!Object.keys(next).every(k=>['code','place','note','courseText'].includes(k)))render();if(callback)callback();};};
 const markup=await(await fetch('/miniprogram/pages/index/index.wxml')).text();
 let css=await(await fetch('/miniprogram/styles/base.wxss')).text();
 const sharedStyle=await(await fetch('/miniprogram/styles/system.wxss')).text();
 css+='\n'+sharedStyle+'\n'+await(await fetch('/miniprogram/styles/light.wxss')).text()+'\n'+await(await fetch('/miniprogram/styles/board.wxss')).text()+'\n'+await(await fetch('/miniprogram/styles/timetable.wxss')).text()+'\n'+await(await fetch('/miniprogram/styles/trial.wxss')).text();
 document.getElementById('native-style').textContent=css.replace(/\bpage\s*\{/g,'.phone{').replace(/(\d+(?:\.\d+)?)rpx/g,(_,v)=>Number(v)/2+'px').replace(/\bview\b/g,'div').replace(/\btext(?=[\s{:.#>+,\[])/g,'span');
 const template=document.createElement('template');template.innerHTML=markup.replace(/<input([^>]*?)\/>/g,'<input$1>').replace(/<switch([^>]*?)\/>/g,'<switch$1></switch>');
 function expr(s,scope){return new Function('s','with(s){return ('+s+')}')(scope);}
 function val(s,scope){if(/^{{[\s\S]*}}$/.test(s)&&s.indexOf('}}')===s.length-2)return expr(s.slice(2,-2),scope);return s.replace(/{{([\s\S]*?)}}/g,(_,x)=>{const v=expr(x,scope);return v==null?'':String(v);});}
 function children(parent,target,scope){let branch=false;for(const node of parent.childNodes){if(node.nodeType===3){target.appendChild(document.createTextNode(val(node.textContent,scope)));continue;}if(node.nodeType!==1)continue;
  if(node.hasAttribute('wx:for')){const list=val(node.getAttribute('wx:for'),scope)||[];list.forEach((item,index)=>{const c=node.cloneNode(true);c.removeAttribute('wx:for');if(c.hasAttribute('wx:if')&&!val(c.getAttribute('wx:if'),Object.assign({},scope,{item,index})))return;append(c,target,Object.assign({},scope,{item,index}));});continue;}
  if(node.hasAttribute('wx:if')){branch=!!val(node.getAttribute('wx:if'),scope);if(!branch)continue;}
  else if(node.hasAttribute('wx:elif')){if(branch)continue;branch=!!val(node.getAttribute('wx:elif'),scope);if(!branch)continue;}
  else if(node.hasAttribute('wx:else')){if(branch)continue;branch=true;}
  else branch=false;
  append(node,target,scope);
 }}
 function append(node,target,scope){if(node.tagName.toLowerCase()==='picker'){const isDate=node.getAttribute('mode')==='date';const el=document.createElement(isDate?'input':'select');el.className=isDate?'date-field':'history-picker';if(isDate){el.type='date';el.value=val(node.getAttribute('value')||'',scope);}else{const items=val(node.getAttribute('range'),scope)||[];items.forEach((x,i)=>{const op=document.createElement('option');op.value=i;op.textContent=x.label||x;el.append(op);});}for(const a of node.attributes)if(a.name.startsWith('data-'))el.setAttribute(a.name,val(a.value,scope));el.addEventListener('change',()=>page[node.getAttribute('bindchange')].call(page,{currentTarget:el,detail:{value:el.value}}));target.append(el);return;}const tag=({view:'div',text:'span',block:'div','scroll-view':'div',switch:'input',image:'img'})[node.tagName.toLowerCase()]||node.tagName.toLowerCase();const el=document.createElement(tag);if(node.tagName.toLowerCase()==='switch')el.type='checkbox';
  for(const attr of node.attributes){const name=attr.name;if(name.startsWith('wx:'))continue;if(name.startsWith('bind')){const ev=({bindtap:'click',bindinput:'input',bindchange:'change'})[name];if(ev){el.addEventListener(ev,event=>{const value=el.type==='checkbox'?el.checked:el.value;page[attr.value].call(page,{currentTarget:el,detail:{value},target:el});});if(name==='bindtap'&&tag!=='button'){el.tabIndex=0;el.setAttribute('role','button');el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();el.click();}});}}continue;}const value=val(attr.value,scope);if(name==='disabled'||name==='checked'){el[name]=!!value;}else if(name==='value'){el.value=value||'';}else if(name==='src'&&tag==='img')el.setAttribute('src',String(value).startsWith('/assets/')?'/miniprogram'+value:value);else el.setAttribute(name,String(value));}
  if(node.getAttribute('open-type')==='share')el.addEventListener('click',()=>wx.showToast({title:'请在微信小程序中使用分享入口'}));
  children(node,el,scope);target.appendChild(el);
 }
 function render(){const target=document.getElementById('app');const frag=document.createDocumentFragment();children(template.content,frag,page.data);target.replaceChildren(frag);const nav=target.querySelector('.bottom-nav');document.getElementById('nav-root').replaceChildren(...(nav?[nav]:[]));const overlay=target.querySelector('.overlay');document.getElementById('modal-root').replaceChildren(...(overlay?[overlay]:[]));}
 const pageSource=await(await fetch('/miniprogram/pages/index/index.js')).text();new Function('require',pageSource)(p=>p.includes('course-file')?{}:p.includes('course-calendar')?Calendar:p.includes('timetable')?T:p.includes('season')?S:p.includes('poster')?Poster:p.includes('shared')?D:p.includes('config')?{mode:'demo'}:{call:demo.call});
 window.__lovePage=page;render();page.onLoad();
})();
