# Phase 3: 浏览器扩展开发 - 集成方案与实施计划

**文档版本**: 1.0.0
**创建日期**: 2025-11-24
**预计工期**: 1-2 周
**优先级**: 🔴 最高（竞争力关键）

---

## 📋 目录

- [一、方案概述](#一方案概述)
- [二、技术架构](#二技术架构)
- [三、项目结构](#三项目结构)
- [四、核心功能设计](#四核心功能设计)
- [五、与现有项目集成](#五与现有项目集成)
- [六、实施计划](#六实施计划)
- [七、风险评估](#七风险评估)

---

## 一、方案概述

### 1.1 目标

开发 Chrome/Edge/Firefox 浏览器扩展，实现：
- ✅ 右键菜单一键收藏当前页面
- ✅ 自动提取页面元数据（标题、描述、图片）
- ✅ 快捷键快速收藏 (Ctrl+Shift+S)
- ✅ 侧边栏快速浏览收藏
- ✅ 批量导入浏览器书签

### 1.2 核心价值

**对比 LinkLibrary.ai 的必要性**:
- LinkLibrary.ai 的核心入口就是浏览器扩展
- 用户在浏览网页时随时保存，无需切换应用
- 降低使用门槛，提升用户留存率

**AnyKeep 的差异化**:
- 支持中文平台深度识别（微信、B站、小红书）
- AI 自动摘要和标签（已有能力）
- 与移动端、Web 端无缝同步

### 1.3 技术选型

| 技术 | 选择 | 理由 |
|------|------|------|
| **Manifest** | V3 | Chrome/Edge 强制要求，Firefox 也支持 |
| **框架** | React + TypeScript | 与主项目保持一致 |
| **构建工具** | Vite | 快速、支持 HMR、配置简单 |
| **UI 库** | Shadcn UI (精简版) | 复用现有组件，保持视觉一致 |
| **状态管理** | Zustand (轻量) | 比 Redux 更轻量，适合扩展 |
| **跨域通信** | Chrome Extension API | 原生支持，无需 CORS |

---

## 二、技术架构

### 2.1 整体架构图

```
┌─────────────────────────────────────────────────────────────┐
│                      浏览器扩展 (Extension)                   │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Popup     │  │   Sidebar   │  │  Options    │        │
│  │  (React)    │  │   (React)   │  │   (React)   │        │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘        │
│         │                 │                 │                │
│         └─────────────────┼─────────────────┘                │
│                           │                                  │
│                    ┌──────▼──────┐                          │
│                    │  Background │                          │
│                    │   Service   │                          │
│                    │   Worker    │                          │
│                    └──────┬──────┘                          │
│                           │                                  │
│         ┌─────────────────┼─────────────────┐              │
│         │                 │                 │              │
│  ┌──────▼──────┐   ┌─────▼─────┐   ┌──────▼──────┐       │
│  │   Content   │   │  Context  │   │   Offscreen │       │
│  │   Script    │   │   Menu    │   │   Document  │       │
│  │ (页面注入)   │   │ (右键菜单) │   │  (AI处理)   │       │
│  └─────────────┘   └───────────┘   └─────────────┘       │
│                                                               │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ HTTP + Auth Cookie
                         │
┌────────────────────────▼────────────────────────────────────┐
│                   AnyKeep Web 后端                           │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Next.js API Routes                       │  │
│  │  /api/bookmarks (POST/GET) - 复用现有 API           │  │
│  │  /api/extension/auth (GET) - 扩展专用认证检查        │  │
│  │  /api/extension/scrape (POST) - 元数据提取增强       │  │
│  │  /api/extension/import (POST) - 批量导入书签         │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                   Supabase                            │  │
│  │  - Auth: 认证状态同步                                 │  │
│  │  - Database: bookmarks 表 (复用)                      │  │
│  │  - Edge Functions: AI 处理 (复用)                     │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 数据流设计

#### 2.2.1 收藏流程

```
用户点击扩展图标 / 右键菜单 / 快捷键
        ↓
Content Script 提取页面元数据
  (标题、URL、描述、图片、作者)
        ↓
发送到 Background Service Worker
        ↓
Background 调用 /api/bookmarks (POST)
  - 携带 Supabase Auth Cookie
  - 自动触发 AI 处理 (已有能力)
        ↓
返回结果到 Popup / 显示通知
        ↓
同步到 Web/移动端 (Supabase 实时)
```

#### 2.2.2 认证流程

```
用户首次安装扩展
        ↓
打开 Options 页面
        ↓
点击"登录"按钮
        ↓
跳转到 anykeep.app/extension-auth
  (主站的专用认证页)
        ↓
用户登录 (Supabase Auth)
        ↓
认证成功后设置 Cookie (httpOnly)
        ↓
跳转回扩展 Options 页
        ↓
Extension 调用 /api/extension/auth
  验证登录状态
        ↓
存储用户信息到 chrome.storage.local
```

### 2.3 关键技术点

#### 2.3.1 跨域通信

**问题**: 扩展无法直接访问 httpOnly Cookie

**解决方案**:
```typescript
// 使用 chrome.cookies API 读取认证 Cookie
async function getAuthCookie(): Promise<string | null> {
  const cookies = await chrome.cookies.getAll({
    url: 'https://anykeep.app',
    name: 'sb-access-token'
  })

  return cookies[0]?.value || null
}

// 在请求时携带
async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const token = await getAuthCookie()

  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
      'X-Extension-Version': EXTENSION_VERSION
    }
  })
}
```

#### 2.3.2 元数据提取

**平台特殊处理**:
```typescript
// shared/metadata-extractor.ts (复用主项目逻辑)
export function extractMetadata(): PageMetadata {
  // 1. 优先使用 Open Graph 标签
  const og = {
    title: getMeta('og:title'),
    description: getMeta('og:description'),
    image: getMeta('og:image'),
    url: getMeta('og:url')
  }

  // 2. 特殊平台识别
  const platform = detectPlatform(window.location.href)

  if (platform === 'wechat') {
    return extractWechatMetadata()
  } else if (platform === 'bilibili') {
    return extractBilibiliMetadata()
  } else if (platform === 'xiaohongshu') {
    return extractXiaohongshuMetadata()
  }

  // 3. 通用提取
  return {
    title: og.title || document.title,
    url: og.url || window.location.href,
    description: og.description || getMeta('description'),
    cover_image: og.image || findLargestImage(),
    author: extractAuthor(),
    platform
  }
}
```

#### 2.3.3 代码共享策略

**共享内容**:
- ✅ TypeScript 类型定义 (`src/types/`)
- ✅ 工具函数 (`src/lib/utils/`)
- ✅ 平台配置 (`src/lib/platform-utils.ts`)
- ✅ Validation Schema (`src/lib/validation.ts`)

**独立内容**:
- ❌ React 组件 (扩展使用精简版)
- ❌ API Routes (扩展直接调用)
- ❌ 构建配置 (独立 Vite 配置)

---

## 三、项目结构

### 3.1 目录结构

```
anykeep/
├── src/                          # 现有 Next.js 项目
│   ├── app/
│   ├── components/
│   ├── lib/                      # 共享库（扩展会引用）
│   │   ├── utils/
│   │   ├── platform-utils.ts
│   │   └── validation.ts
│   └── types/                    # 共享类型（扩展会引用）
│       └── supabase.ts
│
├── extension/                    # 🆕 浏览器扩展代码
│   ├── public/                   # 静态资源
│   │   ├── icons/
│   │   │   ├── icon-16.png
│   │   │   ├── icon-48.png
│   │   │   └── icon-128.png
│   │   └── manifest.json         # Manifest V3 配置
│   │
│   ├── src/
│   │   ├── background/           # Background Service Worker
│   │   │   ├── index.ts          # 主入口
│   │   │   ├── message-handler.ts
│   │   │   ├── context-menu.ts   # 右键菜单
│   │   │   └── shortcuts.ts      # 快捷键
│   │   │
│   │   ├── content/              # Content Scripts
│   │   │   ├── index.ts          # 注入到页面
│   │   │   ├── metadata-extractor.ts
│   │   │   └── platform-handlers/ # 平台特殊处理
│   │   │       ├── wechat.ts
│   │   │       ├── bilibili.ts
│   │   │       └── xiaohongshu.ts
│   │   │
│   │   ├── popup/                # 弹出窗口 (点击图标)
│   │   │   ├── index.tsx
│   │   │   ├── App.tsx
│   │   │   ├── components/
│   │   │   └── styles.css
│   │   │
│   │   ├── sidebar/              # 侧边栏 (可选)
│   │   │   ├── index.tsx
│   │   │   ├── App.tsx
│   │   │   └── components/
│   │   │
│   │   ├── options/              # 设置页面
│   │   │   ├── index.tsx
│   │   │   ├── App.tsx
│   │   │   └── components/
│   │   │
│   │   ├── shared/               # 扩展内共享代码
│   │   │   ├── api-client.ts     # API 调用封装
│   │   │   ├── auth.ts           # 认证逻辑
│   │   │   ├── storage.ts        # chrome.storage 封装
│   │   │   ├── messaging.ts      # 消息通信
│   │   │   └── types.ts          # 扩展专用类型
│   │   │
│   │   └── lib/                  # 符号链接 → ../../src/lib
│   │       └── (共享主项目代码)
│   │
│   ├── vite.config.ts            # Vite 构建配置
│   ├── tsconfig.json             # TypeScript 配置
│   ├── package.json              # 依赖管理
│   └── README.md
│
├── package.json                  # 根项目（Monorepo 配置）
└── docs/
    └── PHASE3_BROWSER_EXTENSION_PLAN.md  # 本文档
```

### 3.2 Manifest V3 配置

```json
// extension/public/manifest.json
{
  "manifest_version": 3,
  "name": "AnyKeep - 智能收藏助手",
  "version": "1.0.0",
  "description": "一键保存网页到 AnyKeep，支持 AI 摘要和智能标签",

  "icons": {
    "16": "icons/icon-16.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  },

  "action": {
    "default_popup": "popup.html",
    "default_title": "保存到 AnyKeep"
  },

  "background": {
    "service_worker": "background.js",
    "type": "module"
  },

  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content.js"],
      "run_at": "document_idle"
    }
  ],

  "permissions": [
    "activeTab",
    "contextMenus",
    "cookies",
    "storage",
    "tabs"
  ],

  "host_permissions": [
    "https://anykeep.app/*",
    "https://*.anykeep.app/*"
  ],

  "commands": {
    "save-bookmark": {
      "suggested_key": {
        "default": "Ctrl+Shift+S",
        "mac": "Command+Shift+S"
      },
      "description": "快速保存当前页面"
    }
  },

  "options_page": "options.html",

  "web_accessible_resources": [
    {
      "resources": ["assets/*"],
      "matches": ["<all_urls>"]
    }
  ]
}
```

---

## 四、核心功能设计

### 4.1 右键菜单收藏

**实现** (`extension/src/background/context-menu.ts`):
```typescript
import { saveBookmark } from '../shared/api-client'

// 创建右键菜单
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'save-to-anykeep',
    title: '保存到 AnyKeep',
    contexts: ['page', 'link', 'image', 'selection']
  })

  chrome.contextMenus.create({
    id: 'save-with-folder',
    title: '保存到文件夹...',
    contexts: ['page', 'link'],
    parentId: 'save-to-anykeep'
  })
})

// 处理右键菜单点击
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id) return

  // 获取页面元数据
  const metadata = await chrome.tabs.sendMessage(tab.id, {
    type: 'GET_METADATA',
    url: info.linkUrl || info.pageUrl
  })

  // 保存书签
  try {
    await saveBookmark({
      ...metadata,
      notes: info.selectionText || null
    })

    // 显示通知
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon-48.png',
      title: 'AnyKeep',
      message: '保存成功！'
    })
  } catch (error) {
    console.error('Save failed:', error)
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon-48.png',
      title: 'AnyKeep',
      message: '保存失败，请稍后重试'
    })
  }
})
```

### 4.2 快捷键收藏

**实现** (`extension/src/background/shortcuts.ts`):
```typescript
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'save-bookmark') {
    // 获取当前活动标签页
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true
    })

    if (!tab?.id) return

    // 提取元数据并保存
    const metadata = await chrome.tabs.sendMessage(tab.id, {
      type: 'GET_METADATA'
    })

    await saveBookmark(metadata)

    // 显示保存成功提示
    await chrome.tabs.sendMessage(tab.id, {
      type: 'SHOW_TOAST',
      message: '✓ 已保存到 AnyKeep'
    })
  }
})
```

### 4.3 侧边栏快速浏览

**实现** (`extension/src/sidebar/App.tsx`):
```typescript
import { useState, useEffect } from 'react'
import { fetchRecentBookmarks } from '../shared/api-client'
import { BookmarkCard } from './components/BookmarkCard'

export function App() {
  const [bookmarks, setBookmarks] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadBookmarks()
  }, [])

  async function loadBookmarks() {
    try {
      const data = await fetchRecentBookmarks({ limit: 20 })
      setBookmarks(data)
    } catch (error) {
      console.error('Load bookmarks failed:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="sidebar">
      <header>
        <h1>最近收藏</h1>
        <button onClick={loadBookmarks}>刷新</button>
      </header>

      {loading ? (
        <div>加载中...</div>
      ) : (
        <div className="bookmark-list">
          {bookmarks.map(bookmark => (
            <BookmarkCard
              key={bookmark.id}
              bookmark={bookmark}
              onDelete={() => loadBookmarks()}
            />
          ))}
        </div>
      )}
    </div>
  )
}
```

### 4.4 批量导入浏览器书签

**实现** (`extension/src/options/components/ImportBookmarks.tsx`):
```typescript
async function handleImportBookmarks() {
  setImporting(true)

  try {
    // 1. 获取浏览器所有书签
    const bookmarkTree = await chrome.bookmarks.getTree()

    // 2. 扁平化书签树
    const bookmarks = flattenBookmarks(bookmarkTree[0])

    // 3. 批量导入（分批，每批 50 条）
    const BATCH_SIZE = 50
    for (let i = 0; i < bookmarks.length; i += BATCH_SIZE) {
      const batch = bookmarks.slice(i, i + BATCH_SIZE)

      await fetch('https://anykeep.app/api/extension/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await getAuthToken()}`
        },
        body: JSON.stringify({ bookmarks: batch })
      })

      // 更新进度
      setProgress(Math.round((i + batch.length) / bookmarks.length * 100))
    }

    toast.success(`成功导入 ${bookmarks.length} 条书签！`)
  } catch (error) {
    console.error('Import failed:', error)
    toast.error('导入失败，请重试')
  } finally {
    setImporting(false)
  }
}

function flattenBookmarks(node: chrome.bookmarks.BookmarkTreeNode): Bookmark[] {
  const result: Bookmark[] = []

  if (node.url) {
    result.push({
      title: node.title,
      url: node.url,
      created_at: node.dateAdded ? new Date(node.dateAdded) : new Date()
    })
  }

  if (node.children) {
    for (const child of node.children) {
      result.push(...flattenBookmarks(child))
    }
  }

  return result
}
```

---

## 五、与现有项目集成

### 5.1 API 层集成

#### 5.1.1 复用现有 API

扩展直接调用现有 API Routes:
```typescript
// extension/src/shared/api-client.ts
const API_BASE = 'https://anykeep.app/api'

export async function saveBookmark(data: CreateBookmarkInput) {
  const token = await getAuthToken()

  // 复用现有的 POST /api/bookmarks
  const response = await fetch(`${API_BASE}/bookmarks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'X-Extension-Version': EXTENSION_VERSION
    },
    body: JSON.stringify(data)
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || 'Save failed')
  }

  return response.json()
}
```

#### 5.1.2 新增扩展专用 API

**认证检查** (`src/app/api/extension/auth/route.ts`):
```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()

  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return NextResponse.json(
      { authenticated: false },
      { status: 401 }
    )
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      id: user.id,
      email: user.email,
      nickname: user.user_metadata?.nickname
    }
  })
}
```

**批量导入** (`src/app/api/extension/import/route.ts`):
```typescript
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { createBookmarkSchema } from '@/lib/validation'
import { logger } from '@/lib/logger'

export async function POST(req: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { bookmarks } = await req.json()

  // 批量插入（忽略重复 URL）
  const { data, error } = await supabase
    .from('bookmarks')
    .upsert(
      bookmarks.map((b: any) => ({
        user_id: user.id,
        title: b.title,
        url: b.url,
        platform: 'browser_import',
        created_at: b.created_at
      })),
      {
        onConflict: 'user_id,url',
        ignoreDuplicates: true
      }
    )

  if (error) {
    logger.error('Import bookmarks failed', { error, userId: user.id })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  logger.info('Import bookmarks success', {
    userId: user.id,
    count: bookmarks.length
  })

  return NextResponse.json({
    success: true,
    imported: data?.length || 0
  })
}
```

### 5.2 类型共享

**方案**: 使用 TypeScript Project References

```json
// extension/tsconfig.json
{
  "extends": "../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "baseUrl": "./src",
    "paths": {
      "@/*": ["../src/*"],           // 引用主项目
      "@extension/*": ["./src/*"]    // 扩展内部
    }
  },
  "include": ["src/**/*"],
  "references": [
    { "path": "../tsconfig.json" }
  ]
}
```

**使用示例**:
```typescript
// extension/src/content/metadata-extractor.ts
import type { Bookmark } from '@/types/supabase'  // 复用主项目类型
import { getPlatformConfig } from '@/lib/platform-utils'  // 复用工具函数
import { createBookmarkSchema } from '@/lib/validation'  // 复用验证

export function extractMetadata(): Partial<Bookmark> {
  const url = window.location.href
  const platform = getPlatformConfig(url).name

  return {
    title: document.title,
    url,
    platform,
    // ...
  }
}
```

### 5.3 构建集成

**根 package.json** (Monorepo 配置):
```json
{
  "name": "anykeep-monorepo",
  "private": true,
  "workspaces": [
    ".",
    "extension"
  ],
  "scripts": {
    "dev": "next dev",
    "dev:extension": "cd extension && npm run dev",
    "build": "next build",
    "build:extension": "cd extension && npm run build",
    "build:all": "npm run build && npm run build:extension"
  }
}
```

**扩展 package.json**:
```json
{
  "name": "@anykeep/extension",
  "version": "1.0.0",
  "scripts": {
    "dev": "vite build --watch --mode development",
    "build": "vite build",
    "package": "npm run build && cd dist && zip -r ../anykeep-extension.zip ."
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "zustand": "^5.0.2"
  },
  "devDependencies": {
    "@types/chrome": "^0.0.277",
    "@vitejs/plugin-react": "^4.3.1",
    "vite": "^6.0.0",
    "vite-plugin-web-extension": "^4.1.6"
  }
}
```

**Vite 配置** (`extension/vite.config.ts`):
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import webExtension from 'vite-plugin-web-extension'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    react(),
    webExtension({
      manifest: './public/manifest.json',
      additionalInputs: [
        'src/popup/index.html',
        'src/options/index.html',
        'src/sidebar/index.html'
      ]
    })
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, '../src'),  // 引用主项目
      '@extension': resolve(__dirname, './src')
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        background: 'src/background/index.ts',
        content: 'src/content/index.ts'
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name].[hash].js'
      }
    }
  }
})
```

---

## 六、实施计划

### 6.1 任务分解（WBS）

```
Phase 3.1: 基础架构搭建 (2-3 天)
├─ Task 1.1: 初始化扩展项目结构
├─ Task 1.2: 配置 Vite + TypeScript
├─ Task 1.3: 创建 Manifest V3 配置
├─ Task 1.4: 设置 Monorepo 工作区
└─ Task 1.5: 实现 Background Service Worker

Phase 3.2: 核心功能开发 (4-5 天)
├─ Task 2.1: 实现 Content Script 元数据提取
│   ├─ 2.1.1: 通用元数据提取
│   ├─ 2.1.2: 微信公众号适配
│   ├─ 2.1.3: B站适配
│   └─ 2.1.4: 小红书适配
├─ Task 2.2: 实现右键菜单保存
├─ Task 2.3: 实现快捷键保存
├─ Task 2.4: 实现认证流程
└─ Task 2.5: 实现 API 通信

Phase 3.3: UI 界面开发 (2-3 天)
├─ Task 3.1: Popup 弹出窗口
├─ Task 3.2: Options 设置页面
└─ Task 3.3: Sidebar 侧边栏（可选）

Phase 3.4: 高级功能 (2-3 天)
├─ Task 4.1: 批量导入浏览器书签
├─ Task 4.2: 快速搜索功能
└─ Task 4.3: 离线缓存支持

Phase 3.5: 测试与优化 (2 天)
├─ Task 5.1: 功能测试
├─ Task 5.2: 兼容性测试 (Chrome/Edge/Firefox)
├─ Task 5.3: 性能优化
└─ Task 5.4: 文档编写

Phase 3.6: 发布准备 (1 天)
├─ Task 6.1: 准备商店素材 (图标、截图、描述)
├─ Task 6.2: 打包扩展
└─ Task 6.3: 提交审核
```

### 6.2 详细时间表

| 阶段 | 任务 | 预计工时 | 开始日期 | 结束日期 | 负责人 | 状态 |
|------|------|---------|---------|---------|--------|------|
| **Phase 3.1** | 基础架构搭建 | 16-24h | Day 1 | Day 3 | - | ⏳ 待开始 |
| 1.1 | 初始化项目结构 | 2h | Day 1 | Day 1 | - | ⏳ |
| 1.2 | 配置 Vite + TS | 3h | Day 1 | Day 1 | - | ⏳ |
| 1.3 | Manifest V3 配置 | 2h | Day 2 | Day 2 | - | ⏳ |
| 1.4 | Monorepo 工作区 | 3h | Day 2 | Day 2 | - | ⏳ |
| 1.5 | Background Worker | 6h | Day 2-3 | Day 3 | - | ⏳ |
| **Phase 3.2** | 核心功能开发 | 32-40h | Day 4 | Day 8 | - | ⏳ 待开始 |
| 2.1 | 元数据提取 | 12h | Day 4-5 | Day 5 | - | ⏳ |
| 2.2 | 右键菜单 | 4h | Day 6 | Day 6 | - | ⏳ |
| 2.3 | 快捷键 | 3h | Day 6 | Day 6 | - | ⏳ |
| 2.4 | 认证流程 | 8h | Day 7 | Day 7 | - | ⏳ |
| 2.5 | API 通信 | 5h | Day 8 | Day 8 | - | ⏳ |
| **Phase 3.3** | UI 界面开发 | 16-24h | Day 9 | Day 11 | - | ⏳ 待开始 |
| 3.1 | Popup 窗口 | 8h | Day 9 | Day 9 | - | ⏳ |
| 3.2 | Options 页面 | 6h | Day 10 | Day 10 | - | ⏳ |
| 3.3 | Sidebar 侧边栏 | 6h | Day 11 | Day 11 | - | ⏳ |
| **Phase 3.4** | 高级功能 | 16-24h | Day 12 | Day 14 | - | ⏳ 待开始 |
| 4.1 | 批量导入书签 | 8h | Day 12 | Day 12 | - | ⏳ |
| 4.2 | 快速搜索 | 6h | Day 13 | Day 13 | - | ⏳ |
| 4.3 | 离线缓存 | 6h | Day 14 | Day 14 | - | ⏳ |
| **Phase 3.5** | 测试与优化 | 16h | Day 15 | Day 16 | - | ⏳ 待开始 |
| 5.1 | 功能测试 | 6h | Day 15 | Day 15 | - | ⏳ |
| 5.2 | 兼容性测试 | 4h | Day 15 | Day 15 | - | ⏳ |
| 5.3 | 性能优化 | 4h | Day 16 | Day 16 | - | ⏳ |
| 5.4 | 文档编写 | 2h | Day 16 | Day 16 | - | ⏳ |
| **Phase 3.6** | 发布准备 | 8h | Day 17 | Day 17 | - | ⏳ 待开始 |
| 6.1 | 商店素材 | 3h | Day 17 | Day 17 | - | ⏳ |
| 6.2 | 打包扩展 | 2h | Day 17 | Day 17 | - | ⏳ |
| 6.3 | 提交审核 | 3h | Day 17 | Day 17 | - | ⏳ |
| **总计** | | **104-136h** | **Day 1** | **Day 17** | | **13-17 工作日** |

### 6.3 里程碑

| 里程碑 | 日期 | 交付物 | 验收标准 |
|--------|------|--------|---------|
| **M1: 架构完成** | Day 3 | 项目结构、构建流程 | ✅ 能够成功构建扩展 |
| **M2: MVP 完成** | Day 8 | 右键保存、快捷键保存 | ✅ 能够保存当前页面到后端 |
| **M3: UI 完成** | Day 11 | Popup、Options 页面 | ✅ UI 交互流畅，视觉统一 |
| **M4: 功能完整** | Day 14 | 批量导入、搜索、缓存 | ✅ 所有核心功能可用 |
| **M5: 测试通过** | Day 16 | 测试报告、优化报告 | ✅ 无 P0/P1 bug |
| **M6: 发布就绪** | Day 17 | 打包文件、商店素材 | ✅ 提交到 Chrome Web Store |

---

## 七、风险评估

### 7.1 技术风险

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| Manifest V3 API 限制 | 中 | 高 | 提前验证 POC，查阅官方文档 |
| 跨域认证复杂性 | 中 | 中 | 使用 chrome.cookies API，提前测试 |
| 平台元数据提取失败 | 高 | 中 | 降级到通用提取，逐步适配 |
| 浏览器兼容性问题 | 中 | 中 | 优先 Chrome，Firefox 后续支持 |

### 7.2 业务风险

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| 用户学习成本高 | 低 | 中 | 提供引导教程，快捷键提示 |
| 审核不通过 | 低 | 高 | 提前阅读商店政策，准备申诉材料 |
| 性能问题（内存、CPU） | 中 | 中 | 性能测试，异步处理，节流防抖 |

### 7.3 依赖风险

| 依赖项 | 风险 | 缓解措施 |
|--------|------|---------|
| Supabase Auth Cookie | 中 | 提供备用认证方式（OAuth） |
| 现有 API 稳定性 | 低 | API 版本化，向后兼容 |
| Chrome Extension API 变更 | 低 | 关注官方公告，及时更新 |

---

## 八、成功指标

### 8.1 技术指标

| 指标 | 目标值 | 测量方式 |
|------|--------|---------|
| **安装包大小** | < 2MB | 打包后文件大小 |
| **内存占用** | < 50MB | Chrome Task Manager |
| **保存响应时间** | < 1s | Performance API |
| **元数据提取准确率** | > 90% | 手动测试 100 个页面 |
| **兼容性** | Chrome 90+, Edge 90+, Firefox 100+ | 实际测试 |

### 8.2 业务指标

| 指标 | 目标值 | 测量方式 |
|------|--------|---------|
| **7 天安装留存** | > 40% | 扩展统计 |
| **DAU/MAU 比** | > 20% | 活跃用户数 |
| **平均每日保存数** | > 3 条/用户 | 后端统计 |
| **用户评分** | > 4.5 星 | Chrome Web Store 评分 |

---

## 九、发布计划

### 9.1 Chrome Web Store

**准备清单**:
- [x] 开发者账号注册 ($5)
- [ ] 128x128 图标
- [ ] 440x280 宣传图 (至少 1 张)
- [ ] 1280x800 或 640x400 截图 (至少 1 张)
- [ ] 隐私政策页面
- [ ] 详细描述 (中英文)
- [ ] 打包的 .zip 文件

**审核周期**: 1-3 天

### 9.2 Edge Add-ons

**准备清单**:
- [ ] Microsoft Partner Center 账号
- [ ] 图标、截图（同 Chrome）
- [ ] 详细描述

**审核周期**: 1-2 天

### 9.3 Firefox Add-ons

**准备清单**:
- [ ] Firefox 开发者账号
- [ ] 调整 Manifest V3 兼容性
- [ ] 图标、截图

**审核周期**: 1-7 天

---

## 十、后续优化计划

### 10.1 Phase 3.5 (v1.1)

**功能增强**:
- 📝 富文本编辑器（保存时添加笔记）
- 🏷️ 快速标签选择（常用标签）
- 📂 文件夹快速选择
- 🔍 扩展内全文搜索
- 📊 统计看板（每日保存趋势）

**性能优化**:
- 🚀 Service Worker 缓存策略
- 🗜️ 元数据提取性能优化
- 💾 离线模式完善

### 10.2 Phase 3.6 (v1.2)

**高级功能**:
- 🤖 AI 智能分类（本地模型）
- 📸 整页截图保存
- 🔗 相关推荐（基于当前页面）
- 👥 分享到社交平台
- 🌐 多语言支持（英文）

---

## 十一、参考资料

### 11.1 官方文档

- [Chrome Extension Manifest V3](https://developer.chrome.com/docs/extensions/mv3/)
- [Chrome Extension API Reference](https://developer.chrome.com/docs/extensions/reference/)
- [Vite Plugin Web Extension](https://github.com/aklinker1/vite-plugin-web-extension)
- [Supabase Auth](https://supabase.com/docs/guides/auth)

### 11.2 竞品参考

- [LinkLibrary.ai Extension](https://chrome.google.com/webstore/detail/linklibrary) - 功能对标
- [Pocket](https://getpocket.com/) - 保存体验参考
- [Raindrop.io](https://raindrop.io/) - UI 设计参考

### 11.3 项目文档

- [PHASE2_COMPLETION_REPORT.md](./PHASE2_COMPLETION_REPORT.md) - Phase 2 完成报告
- [COMPARISON_LINKLIBRARY.md](./COMPARISON_LINKLIBRARY.md) - LinkLibrary 竞品分析
- [anykeep1121.md](../anykeep1121.md) - 产品需求文档

---

**文档维护**:
- **创建**: 2025-11-24
- **最后更新**: 2025-11-24
- **下次审查**: Phase 3.1 完成后
- **负责人**: Development Team

---

## 附录 A: 快速启动指南

### A.1 开发环境设置

```bash
# 1. 初始化扩展项目
mkdir extension && cd extension
npm init -y

# 2. 安装依赖
npm install react react-dom zustand
npm install -D @types/chrome @types/react @types/react-dom
npm install -D vite @vitejs/plugin-react vite-plugin-web-extension
npm install -D typescript

# 3. 复制项目结构模板
cp -r ../docs/templates/extension/* ./

# 4. 启动开发服务器
npm run dev

# 5. 在 Chrome 中加载扩展
# chrome://extensions/ → 开启"开发者模式" → "加载已解压的扩展程序" → 选择 dist/ 目录
```

### A.2 调试技巧

**Background Service Worker**:
```
chrome://extensions/ → AnyKeep → "Service Worker" → 点击查看日志
```

**Content Script**:
```
打开任意网页 → F12 → Console → 选择 Content Script 上下文
```

**Popup/Options**:
```
右键扩展图标 → "检查弹出内容"
```

---

## 附录 B: 常见问题 FAQ

**Q1: 扩展无法保存到后端？**
A: 检查认证状态，确保 Cookie 正确获取。

**Q2: 元数据提取不准确？**
A: 检查 Content Script 是否正确注入，查看 Console 日志。

**Q3: 构建后扩展无法加载？**
A: 检查 manifest.json 配置，确保所有文件路径正确。

**Q4: 如何支持 Firefox？**
A: 使用 `webextension-polyfill` 库，兼容 Manifest V2/V3。

---

**准备好开始了吗？** 🚀

让我们从 Phase 3.1 开始，逐步实现这个强大的浏览器扩展！
