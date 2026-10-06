# 0.25.0 团队交接

## 当前版本
2026-10-06 已上传微信体验版 0.25.0。情侣榜、约会、情侣课表、情侣空间统一为香槟象牙色系，页面各保留自己的主体。回忆收进情侣空间。

## 开发入口
- 原生页面：`miniprogram/pages/index/index.wxml`、`index.js`。
- 视觉样式：`miniprogram/styles/visual.wxss`，文件末尾 Champagne Ivory 段是当前主题，前部保留历史规则，修改时注意优先级。
- 界面辅助：`miniprogram/utils/visual-ui.js`。
- 业务规则：`miniprogram/shared/domain.js`；云端对应 `cloudfunctions/api/domain.js`，共享逻辑修改后执行 `npm run sync`。
- 项目根目录导入微信开发者工具；当前 config 保留 cloud 模式。团队成员需要对应小程序开发者与云环境权限。
- `npm test` 运行项目测试；浏览器预览通过 `npm run preview`，端口以终端输出为准。浏览器预览不能替代原生编译与真机验证。

## 验证与边界
本轮 WXML/WXSS 编译通过；约会发起、双方完成、记录详情、课表导航、空间回忆及 320/430/1280 宽度检查通过。原生重开后无运行错误。两台真实设备同步尚未完整验证。云函数沿用此前部署，本轮没有修改云端。

## 不纳入仓库的文件
个人教务导入草稿 `local-data/`、开发工具个人配置 `project.private.config.json`、环境变量及私钥。获取代码后不要把个人凭据或导入原文提交到仓库。

## 交接时完整测试结果
2026-10-06 执行 `npm test`：86 项中 70 通过、16 失败。失败项集中在两组旧测试：
- `tests/demo.test.js` 的 2 项仍断言旧演示榜单数量 8/9，当前演示榜为前 100 对。
- `tests/page.test.js` 的 14 项测试加载器没有处理新增 `utils/visual-ui` 包装器，加载时抛出 `require(...) is not a function`，尚未进入对应断言。
保留原测试，未跳过或降低断言。请先更新测试加载器和榜单预期，再做后续回归；当前完整测试套件并非全绿。
