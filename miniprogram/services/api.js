const config=require('../config');
const demo=require('./demo');
module.exports={ async call(action,payload) {
 if(config.mode==='demo') return demo.call(action,payload||{});
 if(config.mode!=='cloud')throw new Error('运行模式配置无效，请联系开发者');
 if(!config.cloudEnv)throw new Error('双人服务尚未连接，请先配置云开发环境');
 if(!wx.cloud)throw new Error('当前微信版本不支持云开发，请升级微信后重试');
 const res=await wx.cloud.callFunction({name:'api',data:{action,payload:payload||{}}});
 if(!res.result || !res.result.ok) throw new Error(res.result && res.result.error || '连接失败，请稍后重试');
 return res.result.data;
}};
