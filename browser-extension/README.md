# AnyKeep 浏览器扩展

一键保存网页到 AnyKeep，AI 自动生成摘要和标签。

## 功能特性

- 🔖 一键收藏当前网页
- 🎯 自动检测平台（微信公众号、B站、小红书）
- 🔐 与 Web 应用无缝认证
- ✨ 优雅的保存成功动画

## 开发环境安装

### 1. 构建扩展

```bash
cd browser-extension
npm install
npm run build
```

### 2. 在 Chrome 中加载

1. 打开 Chrome，访问 `chrome://extensions/`
2. 开启右上角的「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择 `browser-extension/.output/chrome-mv3` 目录
5. 扩展图标将出现在浏览器工具栏

### 3. 配置扩展 ID（可选）

开发环境下，如果需要 Web 应用与扩展通信：

1. 在 `chrome://extensions/` 页面找到 AnyKeep 扩展的 ID
2. 在主项目创建 `.env.local` 文件：
   ```
   NEXT_PUBLIC_EXTENSION_ID=your-extension-id-here
   ```

## 开发命令

```bash
# 开发模式（热重载）
npm run dev

# 构建 Chrome 版本
npm run build

# 构建 Firefox 版本
npm run build:firefox

# 打包 zip 文件
npm run zip
```

## 目录结构

```
browser-extension/
├── entrypoints/
│   ├── popup/          # Popup 页面
│   │   ├── index.html
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   └── style.css
│   └── background.ts   # Service Worker
├── public/
│   └── icon.svg        # 扩展图标
├── wxt.config.ts       # WXT 配置
├── tailwind.config.js  # Tailwind 配置
└── package.json
```

## 认证流程

1. 用户在 AnyKeep Web 应用登录
2. Web 应用通过 `chrome.runtime.sendMessage` 发送认证信息到扩展
3. 扩展存储认证信息到 `browser.storage.local`
4. 用户点击扩展图标，显示当前页面信息
5. 点击「收藏」调用 API 保存书签

## 技术栈

- **框架**: WXT (WebExtension Tooling)
- **UI**: React + Tailwind CSS
- **图标**: Lucide React
- **构建**: Vite
