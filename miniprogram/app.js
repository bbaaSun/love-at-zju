const config = require('./config');
App({ onLaunch() {
 // Missing deployment configuration is shown by the page, not an app-launch crash.
 if (config.mode === 'cloud' && config.cloudEnv && wx.cloud) {
  wx.cloud.init({ env: config.cloudEnv, traceUser: false });
 }
} });
