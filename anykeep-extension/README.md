# AnyKeep Browser Extension

AnyKeep 浏览器扩展 - 一键收藏微信公众号文章

## 功能特性

- 🔖 **一键保存** - 在微信公众号文章页面一键保存到 AnyKeep
- 🎯 **智能检测** - 自动检测微信公众号文章页面
- 📱 **浮动按钮** - 页面内浮动保存按钮，方便操作
- 📋 **弹窗预览** - 点击扩展图标预览文章信息
- 📶 **离线队列** - 网络不稳定时自动加入离线队列，恢复后同步
- 🔄 **自动同步** - 定时同步离线队列内容

## 安装方法

### Chrome / Edge / Brave

1. 打开浏览器，进入扩展管理页面
   - Chrome: `chrome://extensions/`
   - Edge: `edge://extensions/`
   - Brave: `brave://extensions/`

2. 开启"开发者模式"

3. 点击"加载已解压的扩展程序"

4. 选择 `anykeep-extension` 文件夹

5. 扩展安装完成！

## 使用说明

### 1. 登录

首次使用时，点击扩展图标，然后点击"登录 AnyKeep"按钮进行登录。

### 2. 保存文章

**方式一：浮动按钮**

- 打开任意微信公众号文章
- 页面右下角会出现"保存到 AnyKeep"浮动按钮
- 点击按钮即可保存

**方式二：弹窗保存**

- 打开微信公众号文章
- 点击浏览器工具栏中的 AnyKeep 图标
- 在弹窗中点击"保存到 AnyKeep"按钮

### 3. 离线队列

当网络不稳定时，文章会自动加入离线队列。您可以：

- 在弹窗中查看待同步文章数量
- 点击"立即同步"手动同步
- 扩展会每 5 分钟自动尝试同步

## 目录结构

```
anykeep-extension/
├── manifest.json           # 扩展配置文件
├── content/
│   ├── wechat-capture.js   # 微信文章页面内容脚本
│   └── styles.css          # 页面注入样式
├── popup/
│   ├── popup.html          # 弹窗页面
│   └── popup.js            # 弹窗逻辑
├── background/
│   └── service-worker.js   # 后台服务
├── icons/                  # 扩展图标
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

## 开发说明

### 技术栈

- Chrome Extension Manifest V3
- Vanilla JavaScript (无框架依赖)
- Chrome Storage API (本地存储)
- Chrome Alarms API (定时任务)

### 调试

1. 在扩展管理页面点击"检查视图"下的链接
2. 查看 background service worker 控制台
3. 在微信文章页面按 F12 查看 content script 日志

### API 配置

修改 `background/service-worker.js` 中的 CONFIG 对象：

```javascript
const CONFIG = {
  apiBaseUrl: "https://anykeep.app", // 生产环境 API
  loginUrl: "https://anykeep.app/login",
  // ...
};
```

## 注意事项

1. **权限说明**
   - `storage`: 存储认证信息和离线队列
   - `activeTab`: 访问当前标签页内容
   - `tabs`: 查询标签页信息
   - `alarms`: 定时同步离线队列

2. **支持的页面**
   - `https://mp.weixin.qq.com/s/*` (微信公众号文章)

3. **已知限制**
   - 需要登录 AnyKeep 账号才能保存
   - 部分加密或特殊文章可能无法完整提取

## 更新日志

### v1.0.0 (2025-12-21)

- 初始版本
- 支持微信公众号文章保存
- 浮动按钮和弹窗两种保存方式
- 离线队列支持
