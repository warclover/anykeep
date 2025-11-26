import { defineConfig } from 'wxt'

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'AnyKeep - 智能收藏助手',
    description: '一键保存网页到 AnyKeep，AI 自动生成摘要和标签',
    version: '1.0.0',
    permissions: ['activeTab', 'storage', 'contextMenus', 'bookmarks', 'notifications'],
    host_permissions: ['<all_urls>'],
    // 图标配置 - WXT 会自动从 SVG 生成多尺寸 PNG
    icons: {
      16: '/icon/16.png',
      32: '/icon/32.png',
      48: '/icon/48.png',
      96: '/icon/96.png',
      128: '/icon/128.png',
    },
    // 快捷键配置
    commands: {
      'save-current-page': {
        suggested_key: {
          default: 'Ctrl+Shift+S',
          mac: 'Command+Shift+S',
        },
        description: '快速保存当前页面到 AnyKeep',
      },
    },
    // Action 配置
    action: {
      default_icon: {
        16: '/icon/16.png',
        32: '/icon/32.png',
        48: '/icon/48.png',
      },
    },
    // 允许 Web 应用与扩展通信
    externally_connectable: {
      matches: [
        'http://localhost:*/*',
        'https://*.anykeep.app/*',
        'https://anykeep.vercel.app/*',
      ],
    },
  },
  webExt: {
    startUrls: ['https://mp.weixin.qq.com/'],
  },
  // 发布配置
  zip: {
    // 生成的 zip 文件名格式
    artifactTemplate: '{{name}}-{{version}}-{{browser}}.zip',
  },
})
