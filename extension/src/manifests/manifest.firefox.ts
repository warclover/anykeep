import type { ManifestV3Export } from "@crxjs/vite-plugin";

const manifest: ManifestV3Export = {
  manifest_version: 3,
  name: "AnyKeep - 智能收藏助手",
  description: "一键收藏网页，智能管理您的知识库",
  version: "1.0.0",

  // Firefox 特有: browser_specific_settings
  browser_specific_settings: {
    gecko: {
      id: "extension@anykeep.com",
      strict_min_version: "109.0",
    },
  },

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

  // Background Script (Firefox 使用 scripts 而非 service_worker)
  background: {
    scripts: ["src/background/index.ts"],
    type: "module",
  },

  // 权限
  permissions: ["storage", "tabs", "activeTab", "identity"],

  // 主机权限
  host_permissions: [
    "https://anykeep.com/*",
    "https://*.anykeep.com/*",
    "http://localhost:3000/*",
  ],

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
};

export default manifest;
