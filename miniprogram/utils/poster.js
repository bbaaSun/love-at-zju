// Native Canvas 2D; visual layout only. Existing render/export contract is retained.
function label(c,text,x,y,size,color){c.fillStyle=color;c.font=size+'px sans-serif';c.fillText(String(text),x,y);}
async function render(page,report,theme,demo){
 const canvas=await new Promise((resolve,reject)=>wx.createSelectorQuery().in(page).select('#reward-canvas').fields({node:true,size:true}).exec(r=>r[0]&&r[0].node?resolve(r[0].node):reject(new Error('画布未准备好，请再试一次'))));
 canvas.width=720;canvas.height=1200;const c=canvas.getContext('2d');c.scale(2,2);
 const paper=theme==='paper',bg=paper?'#fbf5e7':'#244c40',ink=paper?'#344f3c':'#f6edd8',muted=paper?'#6e755e':'#c5d1bb';
 const load=src=>new Promise((resolve,reject)=>{const im=canvas.createImage();im.onload=()=>resolve(im);im.onerror=()=>reject(new Error('图片加载失败，请重试'));im.src=src;});
 const types=report.types||[];
 const images=await Promise.all(['/assets/lakeside-editorial.jpg','/assets/visual/medal.png',...types.map(t=>'/assets/visual/'+t.id+'.png')].map(load));
 c.fillStyle=bg;c.fillRect(0,0,360,600);label(c,'浙天遇见你',24,32,13,ink);c.textAlign='right';label(c,report.finished?'每周纪念':'本周进度',336,32,11,muted);c.textAlign='left';
 const photo=images[0];c.save();c.beginPath();c.rect(20,52,320,211);c.clip();const scale=Math.max(320/photo.width,211/photo.height);c.drawImage(photo,20+(320-photo.width*scale)/2,52+(211-photo.height*scale)/2,photo.width*scale,photo.height*scale);c.restore();
 c.fillStyle='#fcf9ef';c.fillRect(20,263,320,287);c.drawImage(images[1],140,221,80,80);
 c.textAlign='center';label(c,report.reward?report.reward.name:'待点亮',180,326,23,'#4d6248');label(c,report.period,180,348,12,'#858269');
 const xs=[75,180,285],vals=[report.points,report.days,report.count],names=['共同积分','同行天数','完成活动'];
 for(let i=0;i<3;i++){label(c,vals[i],xs[i],399,36,'#466448');label(c,names[i],xs[i],421,11,'#76816b');}
 c.strokeStyle='#e3ddc9';c.beginPath();c.moveTo(36,438);c.lineTo(324,438);c.stroke();
 types.forEach((t,i)=>{const x=30+i*50;c.globalAlpha=t.earned?1:.38;c.drawImage(images[i+2],x,450,44,44);c.globalAlpha=1;label(c,t.earned?'+'+t.earned:'—',x+22,517,12,t.earned?'#42654f':'#a4aa9a');});
 label(c,report.rank?'周榜 #'+report.rank:'未参与排名',180,579,12,ink);c.textAlign='left';label(c,demo?'演示':report.finished?'已结算':'未结算',24,579,10,muted);
 return new Promise((resolve,reject)=>wx.canvasToTempFilePath({canvas,destWidth:720,destHeight:1200,fileType:'png',success:r=>resolve(r.tempFilePath),fail:()=>reject(new Error('海报导出失败，请重试'))},page));
}
module.exports={render};
