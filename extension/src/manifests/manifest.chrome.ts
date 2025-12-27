import type { ManifestV3Export } from "@crxjs/vite-plugin";

const manifest: ManifestV3Export = {
  manifest_version: 3,
  name: "AnyKeep - 智能收藏助手",
  description: "一键收藏网页，智能管理您的知识库",
  version: "1.0.0",

  // 图标
  icons: {
    16: "assets/icons/icon-16.png",
    32: "assets/icons/icon-32.png",
    48: "assets/icons/icon-48.png",
    128: "assets/icons/icon-128.png",
  },

  // 点击图标触发 Popup
  action: {
    default_popup: "src/popup/index.html",
    default_icon: {
      16: "assets/icons/icon-16.png",
      32: "assets/icons/icon-32.png",
      48: "assets/icons/icon-48.png",
    },
    default_title: "AnyKeep",
  },

  // Background Service Worker (Manifest V3)
  background: {
    service_worker: "src/background/index.ts",
    type: "module",
  },

  // Content Script
  content_scripts: [
    {
      matches: ["<all_urls>"],
      js: ["src/content/index.ts"],
      run_at: "document_idle",
    },
  ],

  // 权限
  permissions: [
    "storage", // 本地存储
    "tabs", // 访问标签页信息
    "activeTab", // 访问当前活动标签页
    "identity", // OAuth 认证
    "contextMenus", // 右键菜单
    "scripting", // 脚本注入
  ],

  // 主机权限 - AnyKeep API
  host_permissions: [
    "https://anykeep.com/*",
    "https://*.anykeep.com/*",
    "http://localhost:3000/*", // 开发环境
  ],

  // OAuth2 配置
  oauth2: {
    client_id: "anykeep-extension",
    scopes: ["bookmarks:read", "bookmarks:write"],
  },

  // 内容安全策略
  content_security_policy: {
    extension_pages: "script-src 'self'; object-src 'self'",
  },

  // Web Accessible Resources
  web_accessible_resources: [
    {
      resources: ["assets/*"],
      matches: ["<all_urls>"],
    },
  ],

  // 最低 Chrome 版本
  minimum_chrome_version: "116",
};

export default manifest;
