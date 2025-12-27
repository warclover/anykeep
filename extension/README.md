# AnyKeep Browser Extension

AnyKeep 智能收藏助手的浏览器扩展，支持 Chrome、Edge 和 Firefox。

## 功能特性

- 🔖 **一键保存** - 点击图标即刻保存当前页面
- 📚 **最近收藏** - 快速查看最近保存的内容
- 🔍 **快速搜索** - 在扩展中搜索所有收藏
- 🏷️ **标签管理** - 保存时添加标签分类
- 🔄 **离线队列** - 网络不佳时自动排队，恢复后自动同步
- 🤖 **Agent 集成** - 支持 AI Agent 调用浏览器能力 (Phase 2)

## 开发环境

### 前置要求

- Node.js 20+
- npm 或 pnpm

### 安装依赖

```bash
cd extension
npm install
```

### 开发模式

```bash
# Chrome/Edge
npm run dev

# Firefox
npm run dev:firefox
```

### 构建

```bash
# 构建所有浏览器版本
npm run build

# 仅 Chrome
npm run build:chrome

# 仅 Firefox
npm run build:firefox
```

构建输出位于 `dist/chrome/` 和 `dist/firefox/` 目录。

## 加载扩展

### Chrome / Edge

1. 打开 `chrome://extensions/` 或 `edge://extensions/`
2. 启用"开发者模式"
3. 点击"加载已解压的扩展程序"
4. 选择 `dist/chrome/` 目录

### Firefox

1. 打开 `about:debugging#/runtime/this-firefox`
2. 点击"加载临时附加组件"
3. 选择 `dist/firefox/manifest.json`

## 项目结构

```
extension/
├── src/
│   ├── background/          # Service Worker
│   │   ├── index.ts         # 入口
│   │   ├── auth.ts          # OAuth 认证
│   │   ├── api.ts           # API 通信
│   │   ├── badge.ts         # 图标徽章
│   │   └── offline-queue.ts # 离线队列
│   ├── popup/               # Popup UI
│   │   ├── App.tsx          # 主组件
│   │   ├── views/           # 视图组件
│   │   └── components/      # 通用组件
│   ├── manifests/           # 浏览器 Manifest
│   │   ├── manifest.chrome.ts
│   │   └── manifest.firefox.ts
│   ├── styles/              # 样式
│   └── assets/              # 静态资源
├── dist/                    # 构建输出
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json
```

## 认证流程

扩展使用 OAuth 2.0 + PKCE 进行认证：

1. 用户点击"登录"
2. 打开 AnyKeep 网页进行授权
3. 获取 authorization code
4. 使用 PKCE 交换 access token 和 refresh token
5. Token 安全存储在 `chrome.storage.local`

## API 端点

扩展使用以下专用 API：

| 方法 | 端点                           | 说明                |
| ---- | ------------------------------ | ------------------- |
| POST | `/api/auth/plugin/authorize`   | 获取授权码          |
| POST | `/api/auth/plugin/token`       | 交换/刷新 Token     |
| POST | `/api/plugin/bookmarks`        | 创建收藏            |
| GET  | `/api/plugin/bookmarks/recent` | 获取最近收藏        |
| GET  | `/api/plugin/bookmarks/search` | 搜索收藏            |
| GET  | `/api/plugin/bookmarks/check`  | 检查 URL 是否已保存 |

## License

Copyright © 2024 AnyKeep. All rights reserved.
