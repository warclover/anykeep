# AnyKeep 浏览器插件完整实施方案

> **版本**: v2.0.0
> **日期**: 2025-12-27
> **状态**: 待审核
> **作者**: BMad Master for Xiafe
> **更新**: 增加分层能力模型、Agent 集成、Native Messaging 备选

---

## 一、项目概述

### 1.1 目标

开发跨浏览器插件（Chrome/Edge/Firefox），实现：

- **一键保存**: 点击图标即保存当前页面，无感后台运行
- **最近收藏**: 查看最近保存的书签
- **快速搜索**: 在插件内搜索已收藏内容
- **🆕 AI Agent 集成**: 插件能力可被 AI Agent 调用（Skills/Tools 化）

### 1.2 核心架构：分层能力模型

```
┌─────────────────────────────────────────────────────────────────────┐
│                        AnyKeep 能力分层模型                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    L1: Core Skills (共享能力)                │   │
│  │  ─────────────────────────────────────────────────────────  │   │
│  │  通过 REST API 实现，所有客户端共享                          │   │
│  │  • bookmark:create    • bookmark:search    • bookmark:delete│   │
│  │  • ai:classify        • ai:summarize       • batch:*        │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              ▲                                      │
│          ┌──────────────────┼──────────────────┐                   │
│          │                  │                  │                    │
│     ┌────┴────┐        ┌────┴────┐        ┌────┴────┐              │
│     │ Web App │        │ AI Agent│        │  插件   │              │
│     └─────────┘        └─────────┘        └────┬────┘              │
│                                                │                    │
│  ┌─────────────────────────────────────────────▼───────────────┐   │
│  │              L2: Browser Context Tools (浏览器上下文)        │   │
│  │  ─────────────────────────────────────────────────────────  │   │
│  │  仅插件可执行，Agent 通过 WebSocket 指令调用                  │   │
│  │  • browser:getCurrentTab     • browser:getAllTabs           │   │
│  │  • browser:getSelection      • browser:extractContent       │   │
│  │  • browser:getRecentHistory  • browser:captureScreenshot    │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    L3: User Interaction (用户交互)           │   │
│  │  ─────────────────────────────────────────────────────────  │   │
│  │  仅用户可触发                                                │   │
│  │  • 点击图标    • 键盘快捷键    • 右键菜单    • Popup UI      │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.3 能力调用方式对比

| 层级   | 能力类型         | 调用方式       | 谁能调用                 |
| ------ | ---------------- | -------------- | ------------------------ |
| **L1** | Core Skills      | REST API       | Web / App / Agent / 插件 |
| **L2** | Browser Context  | WebSocket 指令 | Agent → 插件执行         |
| **L3** | User Interaction | 用户操作       | 仅用户                   |

### 1.4 Agent 调用流程示例

```
用户对 AI 说: "保存我正在看的这个页面"
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│  AI Agent 识别意图                                               │
│  → 需要获取"当前页面" = L2 能力 (browser:getCurrentTab)          │
│  → 需要保存书签 = L1 能力 (bookmark:create)                      │
└─────────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 1: 调用 L2 能力                                            │
│  POST /api/agent/browser-command                                │
│  { userId, command: "browser:getCurrentTab", correlationId }   │
│  ↓                                                               │
│  Server 推送到用户的浏览器插件 (WebSocket)                       │
│  ↓                                                               │
│  插件执行 chrome.tabs.query() 并返回结果                         │
└─────────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│  Step 2: 调用 L1 能力                                            │
│  POST /api/bookmarks                                            │
│  { url: "https://...", title: "页面标题" }                      │
└─────────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│  AI Agent 返回结果                                               │
│  "已为您保存：《页面标题》"                                       │
└─────────────────────────────────────────────────────────────────┘
```

### 1.5 技术选型

| 组件          | 技术方案           | 理由                       |
| ------------- | ------------------ | -------------------------- |
| 插件框架      | Manifest V3        | Chrome 强制要求，Edge 兼容 |
| Firefox 兼容  | WebExtension API   | 与 MV3 高度兼容            |
| 构建工具      | Vite + CRXJS       | 热更新开发，多浏览器构建   |
| UI 框架       | React 18           | 与主项目一致               |
| 样式          | Tailwind CSS       | 与主项目一致               |
| 认证          | OAuth 2.0 + PKCE   | 安全的跨域认证             |
| 存储          | Chrome Storage API | 加密同步存储               |
| 🆕 Agent 通信 | WebSocket          | 实时双向，低延迟           |
| 🆕 备选通信   | Native Messaging   | 离线支持，本地能力扩展     |

### 1.6 项目结构

```
anykeep-extension/              # 独立仓库或 monorepo 子包
├── src/
│   ├── background/            # Service Worker
│   │   ├── index.ts           # 主入口
│   │   ├── auth.ts            # OAuth 处理
│   │   ├── api.ts             # API 客户端
│   │   ├── offline-queue.ts   # 离线队列
│   │   ├── badge.ts           # 图标状态
│   │   ├── agent-bridge.ts    # 🆕 Agent 通信桥接
│   │   └── native-host.ts     # 🆕 Native Messaging 处理
│   ├── popup/                 # 弹出页面
│   │   ├── App.tsx
│   │   ├── pages/
│   │   │   ├── Home.tsx       # 主页（保存+最近）
│   │   │   ├── Search.tsx     # 搜索页
│   │   │   ├── Settings.tsx   # 设置页
│   │   │   └── Login.tsx      # 登录页
│   │   └── components/
│   ├── content/               # Content Script（可选）
│   ├── shared/                # 共享代码
│   │   ├── types.ts
│   │   ├── constants.ts
│   │   ├── browser-tools.ts   # 🆕 L2 能力定义
│   │   └── utils.ts
│   └── assets/                # 图标等资源
├── native-host/               # 🆕 Native Messaging Host
│   ├── src/
│   │   ├── main.ts            # 主程序
│   │   ├── mcp-server.ts      # MCP 协议实现
│   │   └── bridge.ts          # 与插件通信
│   ├── package.json
│   └── install.js             # 跨平台安装脚本
├── public/
│   └── manifest.json          # 插件清单（模板）
├── scripts/
│   ├── build-chrome.ts
│   ├── build-edge.ts
│   └── build-firefox.ts
├── package.json
├── vite.config.ts
└── tailwind.config.js
```

---

## 二、OAuth 2.0 + PKCE 认证流程

### 2.1 流程图

```
┌─────────────────────────────────────────────────────────────────┐
│                        用户点击"登录"                            │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  1. 插件生成 PKCE 参数                                           │
│     ├─ code_verifier: 随机 128 字符                              │
│     ├─ code_challenge: SHA256(code_verifier) → Base64URL        │
│     └─ state: 随机 32 字符 (CSRF 防护)                           │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  2. 打开授权页面 (chrome.identity.launchWebAuthFlow)            │
│     URL: https://anykeep.app/api/plugin/oauth/authorize         │
│     参数:                                                        │
│     ├─ client_id=anykeep-browser-extension                      │
│     ├─ redirect_uri=https://<extension-id>.chromiumapp.org/     │
│     ├─ response_type=code                                       │
│     ├─ code_challenge={code_challenge}                          │
│     ├─ code_challenge_method=S256                               │
│     └─ state={state}                                            │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  3. 服务端重定向到 Supabase 登录                                 │
│     → 用户完成邮箱/密码登录或 OAuth 登录                         │
│     → Supabase 返回授权码                                        │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  4. 服务端重定向回插件                                           │
│     URL: https://<extension-id>.chromiumapp.org/?code=xxx&state=│
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  5. 插件验证 state，交换 Token                                   │
│     POST /api/plugin/oauth/token                                │
│     {                                                            │
│       grant_type: "authorization_code",                         │
│       code: "xxx",                                               │
│       code_verifier: "原始 verifier",                            │
│       client_id: "anykeep-browser-extension"                    │
│     }                                                            │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  6. 服务端返回 Token                                             │
│     {                                                            │
│       access_token: "eyJhbGc...",                               │
│       refresh_token: "xxx",                                      │
│       expires_in: 3600,                                          │
│       user: { id, email, name }                                  │
│     }                                                            │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  7. 插件安全存储 Token                                           │
│     chrome.storage.local.set({ auth: encryptedToken })          │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Token 生命周期管理

```typescript
// Token 刷新策略
const TOKEN_REFRESH_THRESHOLD = 5 * 60 * 1000; // 5分钟前刷新

class TokenManager {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private expiresAt: number = 0;

  async getAccessToken(): Promise<string> {
    // 检查是否需要刷新
    if (this.shouldRefresh()) {
      await this.refresh();
    }
    return this.accessToken!;
  }

  private shouldRefresh(): boolean {
    return Date.now() > this.expiresAt - TOKEN_REFRESH_THRESHOLD;
  }

  async refresh(): Promise<void> {
    const response = await fetch("/api/plugin/oauth/refresh", {
      method: "POST",
      body: JSON.stringify({
        grant_type: "refresh_token",
        refresh_token: this.refreshToken,
        client_id: CLIENT_ID,
      }),
    });

    const data = await response.json();
    await this.saveTokens(data);
  }

  async logout(): Promise<void> {
    // 服务端撤销
    await fetch("/api/plugin/oauth/revoke", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.accessToken}` },
    });

    // 本地清除
    await chrome.storage.local.remove(["auth"]);
    this.accessToken = null;
    this.refreshToken = null;
  }
}
```

---

## 三、后端 API 设计

### 3.1 新增 API 端点

#### 3.1.1 OAuth 端点

| 端点                          | 方法 | 描述                 | 认证          |
| ----------------------------- | ---- | -------------------- | ------------- |
| `/api/plugin/oauth/authorize` | GET  | 启动 OAuth 流程      | 无            |
| `/api/plugin/oauth/token`     | POST | 交换授权码获取 Token | 无            |
| `/api/plugin/oauth/refresh`   | POST | 刷新 Access Token    | Refresh Token |
| `/api/plugin/oauth/revoke`    | POST | 撤销 Token（登出）   | Access Token  |

#### 3.1.2 插件专用端点

| 端点                           | 方法 | 描述                | 认证         |
| ------------------------------ | ---- | ------------------- | ------------ |
| `/api/plugin/bookmarks`        | POST | 快速创建书签        | Bearer Token |
| `/api/plugin/bookmarks/check`  | GET  | 检查 URL 是否已存在 | Bearer Token |
| `/api/plugin/bookmarks/recent` | GET  | 获取最近收藏        | Bearer Token |
| `/api/plugin/bookmarks/search` | GET  | 搜索书签            | Bearer Token |
| `/api/plugin/user/profile`     | GET  | 获取用户信息        | Bearer Token |

### 3.2 API 详细设计

#### POST `/api/plugin/oauth/authorize`

```typescript
// 请求（Query Parameters）
interface AuthorizeRequest {
  client_id: string; // "anykeep-browser-extension"
  redirect_uri: string; // Chrome: https://<ext-id>.chromiumapp.org/
  response_type: "code";
  code_challenge: string; // PKCE
  code_challenge_method: "S256";
  state: string; // CSRF 防护
  scope?: string; // 可选，默认 "bookmarks:read bookmarks:write"
}

// 响应：302 重定向到 Supabase 登录页
// 登录成功后重定向回 redirect_uri?code=xxx&state=xxx
```

#### POST `/api/plugin/oauth/token`

```typescript
// 请求
interface TokenRequest {
  grant_type: "authorization_code" | "refresh_token";
  code?: string; // authorization_code 时必填
  code_verifier?: string; // authorization_code 时必填（PKCE）
  refresh_token?: string; // refresh_token 时必填
  client_id: string;
}

// 响应
interface TokenResponse {
  access_token: string; // JWT，1小时有效
  refresh_token: string; // 30天有效
  token_type: "Bearer";
  expires_in: number; // 秒
  scope: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    avatar_url: string | null;
  };
}
```

#### POST `/api/plugin/bookmarks`

```typescript
// 请求
interface CreateBookmarkRequest {
  url: string; // 必填
  title?: string; // 可选，自动抓取
  description?: string; // 可选
  favicon?: string; // 可选，页面 favicon
}

// 响应
interface CreateBookmarkResponse {
  success: true;
  data: {
    id: number;
    url: string;
    title: string;
    status: "PROCESSING" | "COMPLETED";
    created_at: string;
  };
  duplicate?: boolean; // 是否为重复收藏
}

// 错误响应
interface ErrorResponse {
  success: false;
  error: {
    code: "UNAUTHORIZED" | "DUPLICATE" | "QUOTA_EXCEEDED" | "INVALID_URL";
    message: string;
  };
}
```

#### GET `/api/plugin/bookmarks/recent`

```typescript
// 请求（Query Parameters）
interface RecentRequest {
  limit?: number; // 默认 10，最大 50
  offset?: number; // 分页偏移
}

// 响应
interface RecentResponse {
  data: Array<{
    id: number;
    url: string;
    title: string;
    favicon: string | null;
    platform: string;
    created_at: string;
  }>;
  total: number;
  has_more: boolean;
}
```

#### GET `/api/plugin/bookmarks/search`

```typescript
// 请求（Query Parameters）
interface SearchRequest {
  q: string; // 搜索关键词
  limit?: number; // 默认 20
  mode?: "keyword" | "semantic"; // 默认 keyword
}

// 响应
interface SearchResponse {
  data: Array<{
    id: number;
    url: string;
    title: string;
    description: string | null;
    favicon: string | null;
    platform: string;
    relevance_score?: number; // 语义搜索时返回
    created_at: string;
  }>;
  total: number;
  search_mode: "keyword" | "semantic";
}
```

### 3.3 安全中间件

```typescript
// src/lib/plugin-auth/middleware.ts

import { verifyJwtLocally } from "@/lib/auth/jwt-verifier";

const ALLOWED_ORIGINS = [
  /^chrome-extension:\/\/[a-z]{32}$/,
  /^moz-extension:\/\/[a-f0-9-]{36}$/,
  /^https:\/\/[a-z]{32}\.chromiumapp\.org$/,
];

export async function validatePluginRequest(
  request: Request,
): Promise<{ valid: boolean; user?: User; error?: string }> {
  // 1. 验证 Origin
  const origin = request.headers.get("Origin");
  if (!origin || !ALLOWED_ORIGINS.some((pattern) => pattern.test(origin))) {
    return { valid: false, error: "Invalid origin" };
  }

  // 2. 验证 Authorization
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { valid: false, error: "Missing authorization" };
  }

  const token = authHeader.slice(7);

  // 3. 验证 JWT（复用现有逻辑）
  const result = await verifyJwtLocally(token);
  if (!result.valid) {
    return { valid: false, error: "Invalid token" };
  }

  // 4. 检查 Token 类型（必须是插件签发的）
  if (result.payload?.aud !== "anykeep-plugin") {
    return { valid: false, error: "Invalid token audience" };
  }

  return {
    valid: true,
    user: { id: result.payload.sub, email: result.payload.email },
  };
}
```

### 3.4 CORS 配置

```typescript
// src/app/api/plugin/[...path]/route.ts

const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // 插件验证通过 Origin 头
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Authorization, Content-Type, X-Plugin-Version",
  "Access-Control-Max-Age": "86400",
};

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

export async function POST(request: Request) {
  // 验证插件请求
  const auth = await validatePluginRequest(request);
  if (!auth.valid) {
    return Response.json(
      { success: false, error: { code: "UNAUTHORIZED", message: auth.error } },
      { status: 401, headers: corsHeaders },
    );
  }

  // 处理请求...
  return Response.json(result, { headers: corsHeaders });
}
```

---

## 四、数据库变更

### 4.1 新增表

```sql
-- 插件授权记录表
CREATE TABLE plugin_authorizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Token 信息
  refresh_token_hash TEXT NOT NULL,          -- SHA256 哈希
  access_token_jti UUID NOT NULL,            -- JWT ID，用于撤销

  -- 元数据
  browser TEXT NOT NULL,                      -- chrome | edge | firefox
  extension_version TEXT,
  user_agent TEXT,

  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,            -- Refresh Token 过期时间
  revoked_at TIMESTAMPTZ,                     -- 撤销时间

  -- 索引
  CONSTRAINT unique_refresh_token UNIQUE (refresh_token_hash)
);

-- 索引
CREATE INDEX idx_plugin_auth_user ON plugin_authorizations(user_id);
CREATE INDEX idx_plugin_auth_jti ON plugin_authorizations(access_token_jti);
CREATE INDEX idx_plugin_auth_expires ON plugin_authorizations(expires_at)
  WHERE revoked_at IS NULL;

-- RLS 策略
ALTER TABLE plugin_authorizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own authorizations"
  ON plugin_authorizations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can revoke own authorizations"
  ON plugin_authorizations FOR UPDATE
  USING (auth.uid() = user_id);
```

### 4.2 PKCE 授权码临时存储

```sql
-- 使用 Redis 或数据库临时表（5分钟过期）
CREATE TABLE oauth_authorization_codes (
  code TEXT PRIMARY KEY,
  user_id UUID NOT NULL,
  code_challenge TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  scope TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ
);

-- 自动清理过期记录（可选，使用 pg_cron）
-- SELECT cron.schedule('cleanup-oauth-codes', '*/5 * * * *',
--   $$DELETE FROM oauth_authorization_codes WHERE expires_at < NOW()$$);
```

---

## 五、插件功能设计

### 5.1 用户界面设计

#### 5.1.1 Popup 页面结构

```
┌────────────────────────────────────┐
│  ┌──────────────────────────────┐  │
│  │  🔖 AnyKeep                  │  │  ← Header
│  │       [用户头像] [设置]       │  │
│  └──────────────────────────────┘  │
│                                    │
│  ┌──────────────────────────────┐  │
│  │  [🔍 搜索收藏...]            │  │  ← 搜索栏
│  └──────────────────────────────┘  │
│                                    │
│  ┌──────────────────────────────┐  │
│  │  📌 当前页面                  │  │  ← 当前页面卡片
│  │  ─────────────────────────── │  │
│  │  [favicon] 页面标题           │  │
│  │  example.com                  │  │
│  │                               │  │
│  │  [ ✅ 已收藏 ] or [ + 收藏 ]  │  │
│  └──────────────────────────────┘  │
│                                    │
│  ┌──────────────────────────────┐  │
│  │  📚 最近收藏                  │  │  ← 最近收藏列表
│  │  ─────────────────────────── │  │
│  │  [favicon] 标题1        2分前 │  │
│  │  [favicon] 标题2       10分前 │  │
│  │  [favicon] 标题3        1小时 │  │
│  │  [favicon] 标题4          昨天 │  │
│  │            ...                │  │
│  │                               │  │
│  │  [查看全部 →]                 │  │
│  └──────────────────────────────┘  │
└────────────────────────────────────┘
```

#### 5.1.2 搜索页面

```
┌────────────────────────────────────┐
│  [←] 搜索结果                      │
│                                    │
│  ┌──────────────────────────────┐  │
│  │  [🔍 关键词...]    [语义搜索] │  │
│  └──────────────────────────────┘  │
│                                    │
│  找到 23 条结果                    │
│                                    │
│  ┌──────────────────────────────┐  │
│  │  [favicon] 标题                │  │
│  │  摘要文本...                   │  │
│  │  example.com · 3天前          │  │
│  └──────────────────────────────┘  │
│  ┌──────────────────────────────┐  │
│  │  [favicon] 标题                │  │
│  │  摘要文本...                   │  │
│  │  another.com · 1周前          │  │
│  └──────────────────────────────┘  │
│            ...                     │
└────────────────────────────────────┘
```

#### 5.1.3 设置页面

```
┌────────────────────────────────────┐
│  [←] 设置                          │
│                                    │
│  ┌──────────────────────────────┐  │
│  │  👤 账户                       │  │
│  │  user@example.com             │  │
│  │  [退出登录]                   │  │
│  └──────────────────────────────┘  │
│                                    │
│  ┌──────────────────────────────┐  │
│  │  ⚡ 快捷键                     │  │
│  │  一键收藏: Alt+Shift+S        │  │
│  │  [修改]                       │  │
│  └──────────────────────────────┘  │
│                                    │
│  ┌──────────────────────────────┐  │
│  │  🔔 通知                       │  │
│  │  收藏成功提示  [开关: ON]     │  │
│  │  重复收藏提示  [开关: ON]     │  │
│  └──────────────────────────────┘  │
│                                    │
│  ┌──────────────────────────────┐  │
│  │  📊 统计                       │  │
│  │  已收藏: 1,234 条             │  │
│  │  本月新增: 56 条              │  │
│  └──────────────────────────────┘  │
│                                    │
│  v1.0.0 · AnyKeep.app             │
└────────────────────────────────────┘
```

### 5.2 核心功能实现

#### 5.2.1 一键保存

```typescript
// src/background/save-bookmark.ts

interface SaveResult {
  success: boolean;
  duplicate?: boolean;
  bookmark?: { id: number; title: string };
  error?: string;
}

export async function saveCurrentTab(): Promise<SaveResult> {
  // 1. 获取当前标签页
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) {
    return { success: false, error: "No active tab" };
  }

  // 2. 过滤特殊页面
  if (isSpecialUrl(tab.url)) {
    return { success: false, error: "Cannot save this page type" };
  }

  // 3. 更新图标状态
  await setBadge("saving");

  try {
    // 4. 检查是否已收藏
    const existing = await api.checkBookmark(tab.url);
    if (existing.exists) {
      await setBadge("duplicate");
      return { success: true, duplicate: true, bookmark: existing.bookmark };
    }

    // 5. 创建书签
    const result = await api.createBookmark({
      url: tab.url,
      title: tab.title,
      favicon: tab.favIconUrl,
    });

    // 6. 更新图标状态
    await setBadge("success");

    // 7. 显示通知
    await showNotification("收藏成功", result.data.title);

    return { success: true, bookmark: result.data };
  } catch (error) {
    await setBadge("error");

    // 8. 离线时加入队列
    if (isNetworkError(error)) {
      await offlineQueue.add({ url: tab.url, title: tab.title });
      await setBadge("pending");
      return { success: true, error: "Saved offline, will sync later" };
    }

    return { success: false, error: error.message };
  }
}

function isSpecialUrl(url: string): boolean {
  return (
    url.startsWith("chrome://") ||
    url.startsWith("chrome-extension://") ||
    url.startsWith("edge://") ||
    url.startsWith("about:") ||
    url.startsWith("moz-extension://") ||
    url.startsWith("file://")
  );
}
```

#### 5.2.2 图标状态管理

```typescript
// src/background/badge.ts

type BadgeState =
  | "idle"
  | "saving"
  | "success"
  | "error"
  | "duplicate"
  | "pending"
  | "logged-out";

const BADGE_CONFIG: Record<BadgeState, { text: string; color: string }> = {
  idle: { text: "", color: "#4F46E5" }, // 无状态
  saving: { text: "...", color: "#F59E0B" }, // 保存中 - 黄色
  success: { text: "✓", color: "#10B981" }, // 成功 - 绿色
  error: { text: "!", color: "#EF4444" }, // 错误 - 红色
  duplicate: { text: "◉", color: "#6366F1" }, // 重复 - 紫色
  pending: { text: "⏳", color: "#F59E0B" }, // 待同步 - 黄色
  "logged-out": { text: "?", color: "#9CA3AF" }, // 未登录 - 灰色
};

export async function setBadge(
  state: BadgeState,
  tabId?: number,
): Promise<void> {
  const config = BADGE_CONFIG[state];

  await chrome.action.setBadgeText({ text: config.text, tabId });
  await chrome.action.setBadgeBackgroundColor({ color: config.color, tabId });

  // 成功/重复状态 3 秒后恢复
  if (state === "success" || state === "duplicate") {
    setTimeout(() => setBadge("idle", tabId), 3000);
  }
}
```

#### 5.2.3 离线队列

```typescript
// src/background/offline-queue.ts

interface QueueItem {
  url: string;
  title: string;
  favicon?: string;
  addedAt: number;
  retryCount: number;
}

class OfflineQueue {
  private readonly STORAGE_KEY = "offline_queue";
  private readonly MAX_RETRIES = 3;

  async add(item: Omit<QueueItem, "addedAt" | "retryCount">): Promise<void> {
    const queue = await this.getQueue();
    queue.push({
      ...item,
      addedAt: Date.now(),
      retryCount: 0,
    });
    await this.saveQueue(queue);
  }

  async sync(): Promise<{ success: number; failed: number }> {
    const queue = await this.getQueue();
    let success = 0;
    let failed = 0;
    const remaining: QueueItem[] = [];

    for (const item of queue) {
      try {
        await api.createBookmark({
          url: item.url,
          title: item.title,
          favicon: item.favicon,
        });
        success++;
      } catch (error) {
        if (item.retryCount < this.MAX_RETRIES) {
          remaining.push({ ...item, retryCount: item.retryCount + 1 });
        } else {
          failed++;
        }
      }
    }

    await this.saveQueue(remaining);
    return { success, failed };
  }

  async getCount(): Promise<number> {
    const queue = await this.getQueue();
    return queue.length;
  }

  private async getQueue(): Promise<QueueItem[]> {
    const result = await chrome.storage.local.get(this.STORAGE_KEY);
    return result[this.STORAGE_KEY] || [];
  }

  private async saveQueue(queue: QueueItem[]): Promise<void> {
    await chrome.storage.local.set({ [this.STORAGE_KEY]: queue });
  }
}

export const offlineQueue = new OfflineQueue();

// 监听网络恢复
chrome.runtime.onStartup.addListener(async () => {
  const count = await offlineQueue.getCount();
  if (count > 0) {
    await offlineQueue.sync();
  }
});
```

#### 5.2.4 键盘快捷键

```json
// manifest.json
{
  "commands": {
    "save-bookmark": {
      "suggested_key": {
        "default": "Alt+Shift+S",
        "mac": "Alt+Shift+S"
      },
      "description": "快速保存当前页面"
    },
    "_execute_action": {
      "suggested_key": {
        "default": "Alt+Shift+A"
      },
      "description": "打开 AnyKeep 弹窗"
    }
  }
}
```

```typescript
// src/background/commands.ts

chrome.commands.onCommand.addListener(async (command) => {
  if (command === "save-bookmark") {
    await saveCurrentTab();
  }
});
```

---

## 六、多浏览器适配

### 6.1 Manifest 差异处理

```typescript
// scripts/build-manifest.ts

interface ManifestBase {
  manifest_version: 3;
  name: string;
  version: string;
  description: string;
  permissions: string[];
  action: object;
  background: object;
  icons: object;
}

const baseManifest: ManifestBase = {
  manifest_version: 3,
  name: "AnyKeep - 智能收藏助手",
  version: "1.0.0",
  description: "一键保存，随时搜索，跨平台同步",
  permissions: ["storage", "activeTab", "notifications"],
  action: {
    default_popup: "popup.html",
    default_icon: {
      16: "icons/icon-16.png",
      48: "icons/icon-48.png",
      128: "icons/icon-128.png",
    },
  },
  background: {
    service_worker: "background.js",
    type: "module",
  },
  icons: {
    16: "icons/icon-16.png",
    48: "icons/icon-48.png",
    128: "icons/icon-128.png",
  },
};

// Chrome/Edge 特有
const chromeManifest = {
  ...baseManifest,
  oauth2: {
    client_id: "YOUR_CLIENT_ID",
    scopes: ["openid", "email", "profile"],
  },
  key: "YOUR_EXTENSION_KEY", // 固定 Extension ID
};

// Firefox 特有
const firefoxManifest = {
  ...baseManifest,
  browser_specific_settings: {
    gecko: {
      id: "anykeep@anykeep.app",
      strict_min_version: "109.0",
    },
  },
  background: {
    scripts: ["background.js"], // Firefox MV3 使用 scripts 而非 service_worker
  },
};
```

### 6.2 API 兼容层

```typescript
// src/shared/browser-api.ts

interface BrowserAPI {
  storage: typeof chrome.storage;
  tabs: typeof chrome.tabs;
  runtime: typeof chrome.runtime;
  action: typeof chrome.action;
  identity: {
    launchWebAuthFlow: (options: {
      url: string;
      interactive: boolean;
    }) => Promise<string>;
  };
}

// 统一 API（Chrome 和 Firefox 差异封装）
export const browserAPI: BrowserAPI = {
  storage: chrome.storage,
  tabs: chrome.tabs,
  runtime: chrome.runtime,
  action: chrome.action,
  identity: {
    async launchWebAuthFlow(options) {
      if (typeof chrome !== "undefined" && chrome.identity) {
        // Chrome/Edge
        return chrome.identity.launchWebAuthFlow(options);
      } else {
        // Firefox - 使用 browser.identity
        return (browser as any).identity.launchWebAuthFlow(options);
      }
    },
  },
};
```

### 6.3 构建配置

```typescript
// vite.config.ts

import { defineConfig } from "vite";
import { crx } from "@crxjs/vite-plugin";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const browser = process.env.BROWSER || "chrome";
  const manifest = getManifest(browser);

  return {
    plugins: [react(), crx({ manifest })],
    build: {
      outDir: `dist/${browser}`,
      rollupOptions: {
        input: {
          popup: "src/popup/index.html",
          background: "src/background/index.ts",
        },
      },
    },
    define: {
      __BROWSER__: JSON.stringify(browser),
    },
  };
});
```

```json
// package.json scripts
{
  "scripts": {
    "dev": "BROWSER=chrome vite",
    "dev:firefox": "BROWSER=firefox vite",
    "build": "npm run build:chrome && npm run build:edge && npm run build:firefox",
    "build:chrome": "BROWSER=chrome vite build",
    "build:edge": "BROWSER=edge vite build",
    "build:firefox": "BROWSER=firefox vite build",
    "package:chrome": "cd dist/chrome && zip -r ../anykeep-chrome.zip .",
    "package:edge": "cd dist/edge && zip -r ../anykeep-edge.zip .",
    "package:firefox": "cd dist/firefox && web-ext build"
  }
}
```

---

## 七、安全设计

### 7.1 安全清单

| 安全措施       | 实现方式                       | 优先级 |
| -------------- | ------------------------------ | ------ |
| PKCE 防护      | code_verifier + code_challenge | P0     |
| CSRF 防护      | state 参数 + 验证              | P0     |
| Token 加密存储 | Chrome Storage API (自动加密)  | P0     |
| Origin 验证    | 服务端白名单                   | P0     |
| Rate Limiting  | IP + User 联合限制             | P0     |
| Token 自动刷新 | 过期前 5 分钟刷新              | P1     |
| Token 撤销     | 登出时撤销所有 Token           | P1     |
| CSP 策略       | 限制脚本和连接来源             | P1     |
| 输入验证       | Zod Schema 验证                | P1     |

### 7.2 Content Security Policy

```json
// manifest.json
{
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'; connect-src https://anykeep.app https://*.supabase.co"
  }
}
```

### 7.3 敏感数据处理

```typescript
// Token 存储（利用 Chrome Storage 自动加密）
async function storeTokens(tokens: TokenResponse): Promise<void> {
  await chrome.storage.local.set({
    auth: {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: Date.now() + tokens.expires_in * 1000,
      user: tokens.user,
    },
  });
}

// 敏感信息不记录日志
function sanitizeForLogging(data: any): any {
  const sensitive = [
    "accessToken",
    "refreshToken",
    "access_token",
    "refresh_token",
  ];
  return Object.fromEntries(
    Object.entries(data).map(([k, v]) => [
      k,
      sensitive.includes(k) ? "[REDACTED]" : v,
    ]),
  );
}
```

---

## 八、测试策略

### 8.1 测试分层

| 层级     | 工具                           | 覆盖范围                       |
| -------- | ------------------------------ | ------------------------------ |
| 单元测试 | Vitest                         | API 客户端、工具函数、状态管理 |
| 组件测试 | React Testing Library          | Popup UI 组件                  |
| 集成测试 | Playwright + Extension Testing | 完整流程                       |
| E2E 测试 | 手动 + 自动化                  | 多浏览器兼容                   |

### 8.2 关键测试用例

```typescript
// __tests__/background/save-bookmark.test.ts

describe("saveCurrentTab", () => {
  it("should save current tab successfully", async () => {
    // Mock chrome.tabs.query
    chrome.tabs.query = vi.fn().mockResolvedValue([
      {
        url: "https://example.com",
        title: "Example",
        favIconUrl: "https://example.com/favicon.ico",
      },
    ]);

    // Mock API
    api.checkBookmark = vi.fn().mockResolvedValue({ exists: false });
    api.createBookmark = vi.fn().mockResolvedValue({
      data: { id: 1, title: "Example", url: "https://example.com" },
    });

    const result = await saveCurrentTab();

    expect(result.success).toBe(true);
    expect(result.duplicate).toBeUndefined();
    expect(api.createBookmark).toHaveBeenCalledWith({
      url: "https://example.com",
      title: "Example",
      favicon: "https://example.com/favicon.ico",
    });
  });

  it("should detect duplicate bookmarks", async () => {
    chrome.tabs.query = vi.fn().mockResolvedValue([
      {
        url: "https://example.com",
        title: "Example",
      },
    ]);

    api.checkBookmark = vi.fn().mockResolvedValue({
      exists: true,
      bookmark: { id: 1, title: "Example" },
    });

    const result = await saveCurrentTab();

    expect(result.success).toBe(true);
    expect(result.duplicate).toBe(true);
    expect(api.createBookmark).not.toHaveBeenCalled();
  });

  it("should queue offline when network fails", async () => {
    chrome.tabs.query = vi.fn().mockResolvedValue([
      {
        url: "https://example.com",
        title: "Example",
      },
    ]);

    api.checkBookmark = vi.fn().mockResolvedValue({ exists: false });
    api.createBookmark = vi.fn().mockRejectedValue(new NetworkError());

    const result = await saveCurrentTab();

    expect(result.success).toBe(true);
    expect(result.error).toContain("offline");
    expect(offlineQueue.add).toHaveBeenCalled();
  });

  it("should reject special URLs", async () => {
    chrome.tabs.query = vi.fn().mockResolvedValue([
      {
        url: "chrome://settings",
        title: "Settings",
      },
    ]);

    const result = await saveCurrentTab();

    expect(result.success).toBe(false);
    expect(result.error).toContain("Cannot save");
  });
});
```

### 8.3 E2E 测试矩阵

| 场景       | Chrome | Edge | Firefox |
| ---------- | ------ | ---- | ------- |
| 首次登录   | ✓      | ✓    | ✓       |
| Token 刷新 | ✓      | ✓    | ✓       |
| 一键保存   | ✓      | ✓    | ✓       |
| 重复检测   | ✓      | ✓    | ✓       |
| 离线保存   | ✓      | ✓    | ✓       |
| 离线同步   | ✓      | ✓    | ✓       |
| 搜索功能   | ✓      | ✓    | ✓       |
| 语义搜索   | ✓      | ✓    | ✓       |
| 退出登录   | ✓      | ✓    | ✓       |
| 快捷键     | ✓      | ✓    | ✓       |

---

## 九、发布策略

### 9.1 发布渠道

| 浏览器  | 商店                   | 审核时间 | 注意事项                       |
| ------- | ---------------------- | -------- | ------------------------------ |
| Chrome  | Chrome Web Store       | 1-3 天   | 需要 $5 开发者注册费           |
| Edge    | Microsoft Edge Add-ons | 1-3 天   | 免费，支持 Chrome 扩展直接上传 |
| Firefox | Firefox Add-ons        | 1-7 天   | 免费，需要源码审核             |

### 9.2 发布流程

```
1. 代码冻结 (Code Freeze)
   ↓
2. 版本号更新 (package.json, manifest.json)
   ↓
3. 构建所有浏览器版本
   ↓
4. 内部测试 (1-2天)
   ↓
5. 提交 Chrome Web Store (优先)
   ↓
6. 同步提交 Edge Add-ons
   ↓
7. 同步提交 Firefox Add-ons
   ↓
8. 等待审核通过
   ↓
9. 发布公告
```

### 9.3 版本策略

```
v1.0.0 - MVP 发布
  ├─ 一键保存
  ├─ OAuth 登录
  ├─ 最近收藏（10条）
  └─ 基础搜索

v1.1.0 - 功能增强
  ├─ 语义搜索
  ├─ 离线队列
  └─ 自定义快捷键

v1.2.0 - 体验优化
  ├─ 右键菜单保存
  ├─ 批量保存（选中链接）
  └─ 标签管理
```

---

## 十、实施计划

### 10.1 Phase 1: 后端基础设施 (5天)

| 任务 | 描述                                   | 负责    | 天数 |
| ---- | -------------------------------------- | ------- | ---- |
| 1.1  | 创建 `plugin_authorizations` 表 + 迁移 | Backend | 0.5  |
| 1.2  | 实现 OAuth authorize 端点              | Backend | 1    |
| 1.3  | 实现 OAuth token 端点 (含 PKCE)        | Backend | 1    |
| 1.4  | 实现 OAuth refresh/revoke 端点         | Backend | 0.5  |
| 1.5  | 实现插件专用 API 端点                  | Backend | 1.5  |
| 1.6  | 添加 CORS 配置和安全中间件             | Backend | 0.5  |

### 10.2 Phase 2: 插件核心开发 (7天)

| 任务 | 描述                              | 负责     | 天数 |
| ---- | --------------------------------- | -------- | ---- |
| 2.1  | 项目初始化 (Vite + CRXJS + React) | Frontend | 0.5  |
| 2.2  | OAuth 登录流程实现                | Frontend | 1.5  |
| 2.3  | Token 管理器实现                  | Frontend | 1    |
| 2.4  | 一键保存功能                      | Frontend | 1    |
| 2.5  | Popup UI - 主页                   | Frontend | 1    |
| 2.6  | Popup UI - 搜索页                 | Frontend | 1    |
| 2.7  | 离线队列实现                      | Frontend | 1    |

### 10.3 Phase 3: 多浏览器适配 (3天)

| 任务 | 描述             | 负责     | 天数 |
| ---- | ---------------- | -------- | ---- |
| 3.1  | Chrome 版本完善  | Frontend | 0.5  |
| 3.2  | Edge 版本适配    | Frontend | 0.5  |
| 3.3  | Firefox 版本适配 | Frontend | 1.5  |
| 3.4  | 构建脚本优化     | Frontend | 0.5  |

### 10.4 Phase 4: 测试与发布 (5天)

| 任务 | 描述              | 负责 | 天数 |
| ---- | ----------------- | ---- | ---- |
| 4.1  | 单元测试编写      | QA   | 1    |
| 4.2  | 集成测试          | QA   | 1    |
| 4.3  | 多浏览器 E2E 测试 | QA   | 1.5  |
| 4.4  | Bug 修复          | All  | 1    |
| 4.5  | 商店提交准备      | PM   | 0.5  |

### 10.5 总计

| 阶段              | 天数            |
| ----------------- | --------------- |
| Phase 1: 后端     | 5 天            |
| Phase 2: 插件核心 | 7 天            |
| Phase 3: 多浏览器 | 3 天            |
| Phase 4: 测试发布 | 5 天            |
| **总计**          | **20 个工作日** |

---

## 十一、风险评估

| 风险             | 可能性 | 影响 | 缓解措施                                         |
| ---------------- | ------ | ---- | ------------------------------------------------ |
| Chrome MV3 限制  | 中     | 高   | 提前研究 API 限制，使用 offscreen documents 替代 |
| Firefox 兼容问题 | 高     | 中   | 使用 webextension-polyfill，早期测试             |
| 商店审核拒绝     | 中     | 中   | 遵循官方指南，准备申诉材料                       |
| OAuth 安全漏洞   | 低     | 高   | 严格实现 PKCE，安全审计                          |
| 性能问题         | 低     | 中   | 使用 Service Worker 缓存，优化 API 调用          |

---

## 十二、成功指标

| 指标         | 目标           | 测量方式            |
| ------------ | -------------- | ------------------- |
| 安装转化率   | >30%           | 商店页面访问 → 安装 |
| 日活跃用户   | >500 (1个月后) | 每日至少使用一次    |
| 收藏成功率   | >99%           | 成功/总尝试         |
| 平均响应时间 | <500ms         | 从点击到完成        |
| 用户满意度   | >4.5星         | 商店评分            |

---

## 附录 A: 文件清单

```
后端变更:
├── supabase/migrations/
│   └── 20251228000001_add_plugin_authorization.sql
├── src/app/api/plugin/
│   ├── oauth/
│   │   ├── authorize/route.ts
│   │   ├── token/route.ts
│   │   ├── refresh/route.ts
│   │   └── revoke/route.ts
│   └── bookmarks/
│       ├── route.ts              # POST (create)
│       ├── check/route.ts        # GET (duplicate check)
│       ├── recent/route.ts       # GET (recent list)
│       └── search/route.ts       # GET (search)
├── src/lib/plugin-auth/
│   ├── middleware.ts
│   ├── pkce.ts
│   └── types.ts
└── src/lib/validation/
    └── plugin-schemas.ts

插件新建:
anykeep-extension/
├── src/
│   ├── background/
│   ├── popup/
│   ├── content/ (可选)
│   └── shared/
├── public/
├── scripts/
├── __tests__/
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json
```

---

## 附录 B: 决策记录

| 决策     | 选项                     | 选择           | 理由                  |
| -------- | ------------------------ | -------------- | --------------------- |
| 认证方式 | API Token vs OAuth       | OAuth + PKCE   | 更安全，支持会话管理  |
| 插件框架 | Plasmo vs CRXJS          | CRXJS          | 更轻量，Vite 原生支持 |
| UI 框架  | Vue vs React             | React          | 与主项目一致          |
| 状态管理 | Redux vs Zustand         | Zustand        | 轻量，适合小型应用    |
| 存储方案 | IndexedDB vs Storage API | Chrome Storage | 自动加密，跨设备同步  |

---

## 十三、🆕 Agent 集成设计 (分层能力模型实现)

### 13.1 L2 Browser Context Tools 定义

```typescript
// src/shared/browser-tools.ts

/**
 * L2 浏览器上下文能力 - 仅插件可执行，Agent 通过 WebSocket 调用
 */
export const BrowserContextTools = {
  // ========== 当前页面 ==========
  "browser:getCurrentTab": {
    name: "browser:getCurrentTab",
    description: "获取用户当前浏览的页面信息",
    parameters: {},
    returns: {
      url: "string",
      title: "string",
      favicon: "string | null",
      status: "'loading' | 'complete'",
    },
    execute: async () => {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      return {
        url: tab.url,
        title: tab.title,
        favicon: tab.favIconUrl || null,
        status: tab.status,
      };
    },
  },

  // ========== 所有标签页 ==========
  "browser:getAllTabs": {
    name: "browser:getAllTabs",
    description: "获取所有打开的标签页",
    parameters: {
      windowId: "number | undefined", // 可选，指定窗口
      excludeSpecial: "boolean", // 是否排除 chrome:// 等特殊页面
    },
    returns: {
      tabs: "Array<{ id, url, title, favicon, windowId }>",
    },
    execute: async (params: {
      windowId?: number;
      excludeSpecial?: boolean;
    }) => {
      const query: chrome.tabs.QueryInfo = params.windowId
        ? { windowId: params.windowId }
        : {};
      let tabs = await chrome.tabs.query(query);

      if (params.excludeSpecial !== false) {
        tabs = tabs.filter(
          (t) =>
            t.url &&
            !t.url.startsWith("chrome://") &&
            !t.url.startsWith("edge://") &&
            !t.url.startsWith("about:"),
        );
      }

      return {
        tabs: tabs.map((t) => ({
          id: t.id,
          url: t.url,
          title: t.title,
          favicon: t.favIconUrl,
          windowId: t.windowId,
        })),
      };
    },
  },

  // ========== 选中内容 ==========
  "browser:getSelection": {
    name: "browser:getSelection",
    description: "获取用户在页面中选中的文本和链接",
    parameters: {},
    returns: {
      text: "string | null",
      html: "string | null",
      links: "string[]",
    },
    execute: async () => {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!tab.id) return { text: null, html: null, links: [] };

      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const selection = window.getSelection();
          if (!selection || selection.rangeCount === 0) {
            return { text: null, html: null, links: [] };
          }

          const range = selection.getRangeAt(0);
          const container = document.createElement("div");
          container.appendChild(range.cloneContents());

          const links = Array.from(container.querySelectorAll("a"))
            .map((a) => a.href)
            .filter(Boolean);

          return {
            text: selection.toString(),
            html: container.innerHTML,
            links,
          };
        },
      });

      return results[0]?.result || { text: null, html: null, links: [] };
    },
  },

  // ========== 页面内容提取 ==========
  "browser:extractContent": {
    name: "browser:extractContent",
    description: "提取当前页面的正文内容（使用 Readability 算法）",
    parameters: {
      includeImages: "boolean", // 是否包含图片
    },
    returns: {
      title: "string",
      content: "string",
      textContent: "string",
      excerpt: "string",
      byline: "string | null",
      length: "number",
      images: "string[]",
    },
    execute: async (params: { includeImages?: boolean }) => {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!tab.id) throw new Error("No active tab");

      // 注入 Readability 库并提取
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (includeImages: boolean) => {
          // 简化版正文提取（实际使用 @mozilla/readability）
          const article = document.querySelector("article") || document.body;
          const images = includeImages
            ? Array.from(article.querySelectorAll("img")).map((img) => img.src)
            : [];

          return {
            title: document.title,
            content: article.innerHTML,
            textContent: article.textContent?.trim() || "",
            excerpt: article.textContent?.slice(0, 200) || "",
            byline: document
              .querySelector('meta[name="author"]')
              ?.getAttribute("content"),
            length: article.textContent?.length || 0,
            images,
          };
        },
        args: [params.includeImages ?? false],
      });

      return results[0]?.result;
    },
  },

  // ========== 浏览历史 ==========
  "browser:getRecentHistory": {
    name: "browser:getRecentHistory",
    description: "获取最近的浏览历史",
    parameters: {
      limit: "number", // 最多返回条数
      startTime: "number", // 开始时间戳（可选）
      text: "string", // 搜索关键词（可选）
    },
    returns: {
      history: "Array<{ url, title, visitTime, visitCount }>",
    },
    execute: async (params: {
      limit?: number;
      startTime?: number;
      text?: string;
    }) => {
      const results = await chrome.history.search({
        text: params.text || "",
        startTime: params.startTime || Date.now() - 7 * 24 * 60 * 60 * 1000, // 默认7天
        maxResults: params.limit || 20,
      });

      return {
        history: results.map((item) => ({
          url: item.url,
          title: item.title,
          visitTime: item.lastVisitTime,
          visitCount: item.visitCount,
        })),
      };
    },
  },

  // ========== 截图 ==========
  "browser:captureScreenshot": {
    name: "browser:captureScreenshot",
    description: "截取当前可见区域的截图",
    parameters: {
      format: "'png' | 'jpeg'",
      quality: "number", // JPEG 质量 0-100
    },
    returns: {
      dataUrl: "string", // Base64 Data URL
      width: "number",
      height: "number",
    },
    execute: async (params: { format?: "png" | "jpeg"; quality?: number }) => {
      const dataUrl = await chrome.tabs.captureVisibleTab(undefined, {
        format: params.format || "png",
        quality: params.quality || 90,
      });

      // 解析尺寸
      const img = new Image();
      await new Promise((resolve) => {
        img.onload = resolve;
        img.src = dataUrl;
      });

      return {
        dataUrl,
        width: img.width,
        height: img.height,
      };
    },
  },
} as const;

export type BrowserToolName = keyof typeof BrowserContextTools;
export type BrowserToolResult<T extends BrowserToolName> = ReturnType<
  (typeof BrowserContextTools)[T]["execute"]
>;
```

### 13.2 WebSocket Agent Bridge

```typescript
// src/background/agent-bridge.ts

import { BrowserContextTools, BrowserToolName } from "../shared/browser-tools";
import { tokenManager } from "./auth";

interface AgentCommand {
  correlationId: string;
  command: BrowserToolName;
  parameters?: Record<string, unknown>;
  timestamp: number;
}

interface AgentResponse {
  correlationId: string;
  success: boolean;
  result?: unknown;
  error?: string;
  executionTime: number;
}

class AgentBridge {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private readonly MAX_RECONNECT_ATTEMPTS = 5;
  private readonly RECONNECT_DELAY = 3000;
  private pendingCommands = new Map<
    string,
    { resolve: Function; reject: Function }
  >();

  /**
   * 初始化 WebSocket 连接
   */
  async connect(): Promise<void> {
    const token = await tokenManager.getAccessToken();
    if (!token) {
      console.log("[AgentBridge] Not logged in, skip connection");
      return;
    }

    const wsUrl = `wss://anykeep.app/api/plugin/ws?token=${token}`;

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log("[AgentBridge] Connected");
      this.reconnectAttempts = 0;

      // 发送心跳
      this.startHeartbeat();
    };

    this.ws.onmessage = (event) => {
      this.handleMessage(JSON.parse(event.data));
    };

    this.ws.onclose = (event) => {
      console.log("[AgentBridge] Disconnected", event.code);
      this.stopHeartbeat();

      if (
        event.code !== 1000 &&
        this.reconnectAttempts < this.MAX_RECONNECT_ATTEMPTS
      ) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = (error) => {
      console.error("[AgentBridge] Error", error);
    };
  }

  /**
   * 处理来自 Agent 的命令
   */
  private async handleMessage(
    message: AgentCommand | { type: string },
  ): Promise<void> {
    // 心跳响应
    if ("type" in message && message.type === "pong") {
      return;
    }

    const command = message as AgentCommand;
    const startTime = Date.now();

    console.log("[AgentBridge] Received command:", command.command);

    try {
      // 验证命令是否存在
      const tool = BrowserContextTools[command.command];
      if (!tool) {
        throw new Error(`Unknown command: ${command.command}`);
      }

      // 执行命令
      const result = await tool.execute(command.parameters || {});

      // 发送成功响应
      this.sendResponse({
        correlationId: command.correlationId,
        success: true,
        result,
        executionTime: Date.now() - startTime,
      });
    } catch (error) {
      // 发送错误响应
      this.sendResponse({
        correlationId: command.correlationId,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executionTime: Date.now() - startTime,
      });
    }
  }

  /**
   * 发送响应到服务器
   */
  private sendResponse(response: AgentResponse): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: "command_response",
          ...response,
        }),
      );
    }
  }

  /**
   * 心跳机制
   */
  private heartbeatInterval: number | null = null;

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: "ping" }));
      }
    }, 30000) as unknown as number;
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * 重连逻辑
   */
  private scheduleReconnect(): void {
    this.reconnectAttempts++;
    const delay =
      this.RECONNECT_DELAY * Math.pow(2, this.reconnectAttempts - 1);

    console.log(
      `[AgentBridge] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`,
    );

    setTimeout(() => this.connect(), delay);
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close(1000, "User logout");
      this.ws = null;
    }
  }

  /**
   * 获取连接状态
   */
  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

export const agentBridge = new AgentBridge();

// 登录后自动连接
chrome.storage.onChanged.addListener((changes) => {
  if (changes.auth) {
    if (changes.auth.newValue) {
      agentBridge.connect();
    } else {
      agentBridge.disconnect();
    }
  }
});
```

### 13.3 后端 WebSocket Hub

```typescript
// src/app/api/plugin/ws/route.ts (Next.js WebSocket 示例)

import { WebSocketServer, WebSocket } from "ws";
import { verifyJwtLocally } from "@/lib/auth/jwt-verifier";

// 用户连接映射
const userConnections = new Map<string, Set<WebSocket>>();

// 待处理命令
const pendingCommands = new Map<
  string,
  {
    resolve: (result: unknown) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  }
>();

export function setupWebSocketServer(server: any): void {
  const wss = new WebSocketServer({ server, path: "/api/plugin/ws" });

  wss.on("connection", async (ws, req) => {
    // 验证 Token
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const token = url.searchParams.get("token");

    if (!token) {
      ws.close(4001, "Missing token");
      return;
    }

    const auth = await verifyJwtLocally(token);
    if (!auth.valid) {
      ws.close(4002, "Invalid token");
      return;
    }

    const userId = auth.payload!.sub;

    // 注册连接
    if (!userConnections.has(userId)) {
      userConnections.set(userId, new Set());
    }
    userConnections.get(userId)!.add(ws);

    console.log(`[WS] User ${userId} connected`);

    ws.on("message", (data) => {
      const message = JSON.parse(data.toString());

      if (message.type === "ping") {
        ws.send(JSON.stringify({ type: "pong" }));
        return;
      }

      if (message.type === "command_response") {
        const pending = pendingCommands.get(message.correlationId);
        if (pending) {
          clearTimeout(pending.timeout);
          pendingCommands.delete(message.correlationId);

          if (message.success) {
            pending.resolve(message.result);
          } else {
            pending.reject(new Error(message.error));
          }
        }
      }
    });

    ws.on("close", () => {
      userConnections.get(userId)?.delete(ws);
      console.log(`[WS] User ${userId} disconnected`);
    });
  });
}

/**
 * 发送命令到用户的浏览器插件
 */
export async function sendBrowserCommand(
  userId: string,
  command: string,
  parameters?: Record<string, unknown>,
  timeout = 10000,
): Promise<unknown> {
  const connections = userConnections.get(userId);

  if (!connections || connections.size === 0) {
    throw new Error("No browser extension connected");
  }

  const correlationId = crypto.randomUUID();
  const ws = connections.values().next().value; // 取第一个连接

  return new Promise((resolve, reject) => {
    const timeoutHandle = setTimeout(() => {
      pendingCommands.delete(correlationId);
      reject(new Error("Command timeout"));
    }, timeout);

    pendingCommands.set(correlationId, {
      resolve,
      reject,
      timeout: timeoutHandle,
    });

    ws.send(
      JSON.stringify({
        correlationId,
        command,
        parameters,
        timestamp: Date.now(),
      }),
    );
  });
}
```

### 13.4 Agent 工具注册

```typescript
// src/lib/ai-agent/tools/browser-context-tools.ts

import { sendBrowserCommand } from "@/app/api/plugin/ws/route";

/**
 * 注册到 AI Agent 的浏览器上下文工具
 */
export const browserContextAgentTools = [
  {
    name: "save_current_page",
    description: "保存用户当前正在浏览的页面到收藏",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
    execute: async (params: {}, context: { userId: string }) => {
      // 1. 获取当前页面
      const tab = (await sendBrowserCommand(
        context.userId,
        "browser:getCurrentTab",
      )) as { url: string; title: string };

      // 2. 保存书签
      const result = await createBookmark({
        userId: context.userId,
        url: tab.url,
        title: tab.title,
      });

      return {
        success: true,
        message: `已保存：${result.title}`,
        bookmark: result,
      };
    },
  },

  {
    name: "save_all_open_tabs",
    description: "批量保存用户打开的所有标签页",
    parameters: {
      type: "object",
      properties: {
        filter: {
          type: "string",
          description: "可选的关键词过滤",
        },
      },
    },
    execute: async (
      params: { filter?: string },
      context: { userId: string },
    ) => {
      // 1. 获取所有标签
      const { tabs } = (await sendBrowserCommand(
        context.userId,
        "browser:getAllTabs",
        { excludeSpecial: true },
      )) as { tabs: Array<{ url: string; title: string }> };

      // 2. 过滤
      const filtered = params.filter
        ? tabs.filter(
            (t) =>
              t.title?.includes(params.filter!) ||
              t.url.includes(params.filter!),
          )
        : tabs;

      // 3. 批量保存
      const results = await batchCreateBookmarks({
        userId: context.userId,
        bookmarks: filtered.map((t) => ({ url: t.url, title: t.title })),
      });

      return {
        success: true,
        message: `已保存 ${results.length} 个页面`,
        saved: results.length,
        total: tabs.length,
      };
    },
  },

  {
    name: "save_selected_content",
    description: "保存用户在页面中选中的内容和链接",
    parameters: {
      type: "object",
      properties: {},
    },
    execute: async (params: {}, context: { userId: string }) => {
      // 1. 获取选中内容
      const selection = (await sendBrowserCommand(
        context.userId,
        "browser:getSelection",
      )) as { text: string | null; links: string[] };

      if (!selection.text && selection.links.length === 0) {
        return {
          success: false,
          message: "没有选中任何内容",
        };
      }

      const results = [];

      // 2. 保存选中的链接
      if (selection.links.length > 0) {
        for (const link of selection.links) {
          const result = await createBookmark({
            userId: context.userId,
            url: link,
          });
          results.push(result);
        }
      }

      return {
        success: true,
        message: `已保存 ${results.length} 个链接`,
        text: selection.text,
        savedLinks: results,
      };
    },
  },

  {
    name: "get_recent_browsing_history",
    description: "获取用户最近的浏览历史，帮助推荐相关内容",
    parameters: {
      type: "object",
      properties: {
        limit: { type: "number", default: 10 },
        keyword: { type: "string", description: "搜索关键词" },
      },
    },
    execute: async (
      params: { limit?: number; keyword?: string },
      context: { userId: string },
    ) => {
      const { history } = (await sendBrowserCommand(
        context.userId,
        "browser:getRecentHistory",
        { limit: params.limit || 10, text: params.keyword },
      )) as {
        history: Array<{ url: string; title: string; visitTime: number }>;
      };

      return {
        success: true,
        history: history.map((h) => ({
          url: h.url,
          title: h.title,
          visitedAt: new Date(h.visitTime).toISOString(),
        })),
      };
    },
  },
];
```

---

## 十四、🆕 Native Messaging 备选方案

### 14.1 架构概述

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Native Messaging 架构                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────┐     Native Messaging     ┌───────────────────┐    │
│  │ 浏览器插件   │ ◄───────────────────────► │ Native Host       │    │
│  │             │         JSON stdio        │ (Node.js/Go/Rust) │    │
│  └─────────────┘                           └─────────┬─────────┘    │
│                                                      │              │
│                                                      │ MCP Protocol│
│                                                      ▼              │
│                                            ┌───────────────────┐    │
│                                            │ Claude Code / AI  │    │
│                                            │ Agent (MCP Client)│    │
│                                            └───────────────────┘    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 14.2 使用场景

| 场景       | WebSocket 方案 | Native Messaging 方案  |
| ---------- | -------------- | ---------------------- |
| 需要网络   | ✅ 是          | ❌ 否（纯本地）        |
| Agent 类型 | 云端 AI Agent  | 本地 AI（Claude Code） |
| 延迟       | ~50-200ms      | ~5-20ms                |
| 离线支持   | ❌             | ✅                     |
| 安装复杂度 | 低             | 中（需安装本地程序）   |
| 适用平台   | 所有           | 桌面端                 |

### 14.3 Native Host 实现

```typescript
// native-host/src/main.ts

import { NativeMessaging } from "./native-messaging";
import { MCPServer } from "./mcp-server";

const messaging = new NativeMessaging();
const mcpServer = new MCPServer();

// 从浏览器插件接收消息
messaging.onMessage(async (message) => {
  const { type, data } = message;

  switch (type) {
    case "mcp:call":
      // MCP 工具调用
      const result = await mcpServer.handleToolCall(data.tool, data.params);
      messaging.send({
        type: "mcp:result",
        correlationId: data.correlationId,
        result,
      });
      break;

    case "browser:result":
      // 浏览器命令结果
      mcpServer.resolvePendingCommand(data.correlationId, data.result);
      break;
  }
});

// 启动 MCP Server
mcpServer.start();
```

```typescript
// native-host/src/mcp-server.ts

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

export class MCPServer {
  private server: Server;
  private pendingCommands = new Map<
    string,
    { resolve: Function; reject: Function }
  >();

  constructor() {
    this.server = new Server(
      { name: "anykeep-browser", version: "1.0.0" },
      { capabilities: { tools: {} } },
    );

    this.registerTools();
  }

  private registerTools(): void {
    // 注册浏览器上下文工具
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "browser_get_current_tab",
          description: "获取用户当前浏览的页面",
          inputSchema: { type: "object", properties: {} },
        },
        {
          name: "browser_get_all_tabs",
          description: "获取所有打开的标签页",
          inputSchema: {
            type: "object",
            properties: {
              excludeSpecial: { type: "boolean", default: true },
            },
          },
        },
        {
          name: "browser_save_bookmark",
          description: "保存当前页面到 AnyKeep",
          inputSchema: { type: "object", properties: {} },
        },
        // ... 更多工具
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      // 发送到浏览器插件执行
      const result = await this.sendBrowserCommand(name, args);

      return { content: [{ type: "text", text: JSON.stringify(result) }] };
    });
  }

  async sendBrowserCommand(command: string, params: unknown): Promise<unknown> {
    const correlationId = crypto.randomUUID();

    return new Promise((resolve, reject) => {
      this.pendingCommands.set(correlationId, { resolve, reject });

      // 通过 Native Messaging 发送到浏览器插件
      process.stdout.write(
        JSON.stringify({
          type: "browser:command",
          correlationId,
          command: this.mapToolToBrowserCommand(command),
          params,
        }),
      );

      // 超时处理
      setTimeout(() => {
        if (this.pendingCommands.has(correlationId)) {
          this.pendingCommands.delete(correlationId);
          reject(new Error("Browser command timeout"));
        }
      }, 10000);
    });
  }

  private mapToolToBrowserCommand(tool: string): string {
    const mapping: Record<string, string> = {
      browser_get_current_tab: "browser:getCurrentTab",
      browser_get_all_tabs: "browser:getAllTabs",
      browser_save_bookmark: "browser:saveCurrentPage",
    };
    return mapping[tool] || tool;
  }

  resolvePendingCommand(correlationId: string, result: unknown): void {
    const pending = this.pendingCommands.get(correlationId);
    if (pending) {
      this.pendingCommands.delete(correlationId);
      pending.resolve(result);
    }
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("[MCP Server] Started");
  }
}
```

### 14.4 插件端 Native Messaging

```typescript
// src/background/native-host.ts

class NativeHostBridge {
  private port: chrome.runtime.Port | null = null;
  private readonly HOST_NAME = "com.anykeep.native_host";

  /**
   * 连接到 Native Host
   */
  connect(): void {
    try {
      this.port = chrome.runtime.connectNative(this.HOST_NAME);

      this.port.onMessage.addListener((message) => {
        this.handleMessage(message);
      });

      this.port.onDisconnect.addListener(() => {
        console.log(
          "[NativeHost] Disconnected:",
          chrome.runtime.lastError?.message,
        );
        this.port = null;
      });

      console.log("[NativeHost] Connected");
    } catch (error) {
      console.error("[NativeHost] Connection failed:", error);
    }
  }

  /**
   * 处理来自 Native Host 的消息
   */
  private async handleMessage(message: {
    type: string;
    correlationId: string;
    command: string;
    params?: unknown;
  }): void {
    if (message.type === "browser:command") {
      // 执行浏览器命令
      const tool = BrowserContextTools[message.command as BrowserToolName];
      if (!tool) {
        this.sendResult(
          message.correlationId,
          null,
          `Unknown command: ${message.command}`,
        );
        return;
      }

      try {
        const result = await tool.execute(message.params || {});
        this.sendResult(message.correlationId, result);
      } catch (error) {
        this.sendResult(message.correlationId, null, String(error));
      }
    }
  }

  /**
   * 发送结果回 Native Host
   */
  private sendResult(
    correlationId: string,
    result: unknown,
    error?: string,
  ): void {
    if (this.port) {
      this.port.postMessage({
        type: "browser:result",
        correlationId,
        result,
        error,
      });
    }
  }

  /**
   * 检查 Native Host 是否可用
   */
  async isAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        const port = chrome.runtime.connectNative(this.HOST_NAME);
        port.onMessage.addListener(() => {
          port.disconnect();
          resolve(true);
        });
        port.onDisconnect.addListener(() => {
          resolve(false);
        });
        port.postMessage({ type: "ping" });
      } catch {
        resolve(false);
      }
    });
  }
}

export const nativeHostBridge = new NativeHostBridge();
```

### 14.5 Native Host 安装脚本

```javascript
// native-host/install.js

const fs = require("fs");
const path = require("path");
const os = require("os");

const HOST_NAME = "com.anykeep.native_host";
const EXTENSION_IDS = [
  "chrome-extension://YOUR_EXTENSION_ID/", // Chrome
  "chrome-extension://YOUR_EDGE_ID/", // Edge
];

function getManifestPath() {
  const platform = os.platform();

  if (platform === "darwin") {
    return path.join(
      os.homedir(),
      "Library/Application Support/Google/Chrome/NativeMessagingHosts",
      `${HOST_NAME}.json`,
    );
  } else if (platform === "win32") {
    return path.join(
      process.env.LOCALAPPDATA,
      "Google/Chrome/User Data/NativeMessagingHosts",
      `${HOST_NAME}.json`,
    );
  } else {
    return path.join(
      os.homedir(),
      ".config/google-chrome/NativeMessagingHosts",
      `${HOST_NAME}.json`,
    );
  }
}

function install() {
  const hostPath = path.resolve(__dirname, "dist/native-host");
  const manifestPath = getManifestPath();

  const manifest = {
    name: HOST_NAME,
    description: "AnyKeep Browser Extension Native Host",
    path: hostPath + (os.platform() === "win32" ? ".exe" : ""),
    type: "stdio",
    allowed_origins: EXTENSION_IDS,
  };

  // 创建目录
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });

  // 写入 manifest
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  console.log(`Native host manifest installed at: ${manifestPath}`);

  // Windows: 添加注册表项
  if (os.platform() === "win32") {
    const { execSync } = require("child_process");
    execSync(
      `reg add "HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\${HOST_NAME}" /ve /t REG_SZ /d "${manifestPath}" /f`,
    );
    console.log("Windows registry updated");
  }
}

install();
```

---

## 十五、🆕 更新后的实施计划

### 15.1 Phase 1: MVP 基础功能 (20天)

> 与原计划一致，实现传统插件功能

| 阶段             | 任务                       | 天数 |
| ---------------- | -------------------------- | ---- |
| 1.1 后端基础设施 | OAuth + 插件 API           | 5    |
| 1.2 插件核心开发 | 一键保存 + 最近收藏 + 搜索 | 7    |
| 1.3 多浏览器适配 | Chrome/Edge/Firefox        | 3    |
| 1.4 测试与发布   | 单元/E2E 测试 + 商店提交   | 5    |

**交付物**：

- ✅ 可发布的浏览器插件 v1.0.0
- ✅ OAuth 认证系统
- ✅ 插件专用 API

---

### 15.2 Phase 2: Agent 集成 (10天) ⭐ 高优先级

> MVP 发布后立即实施

| 任务 | 描述                                   | 天数 |
| ---- | -------------------------------------- | ---- |
| 2.1  | **WebSocket Hub 后端**                 | 2    |
|      | - 创建 `/api/plugin/ws` WebSocket 端点 |      |
|      | - 用户连接管理 (userConnections Map)   |      |
|      | - 命令队列和超时处理                   |      |
|      | - 心跳机制和重连逻辑                   |      |
| 2.2  | **Agent Bridge 插件端**                | 2    |
|      | - WebSocket 客户端连接                 |      |
|      | - 命令处理器 (handleCommand)           |      |
|      | - 自动重连机制                         |      |
|      | - 登录状态变更监听                     |      |
| 2.3  | **L2 Browser Tools 实现**              | 2    |
|      | - browser:getCurrentTab                |      |
|      | - browser:getAllTabs                   |      |
|      | - browser:getSelection                 |      |
|      | - browser:extractContent               |      |
|      | - browser:getRecentHistory             |      |
|      | - browser:captureScreenshot            |      |
| 2.4  | **Agent 工具注册**                     | 2    |
|      | - save_current_page                    |      |
|      | - save_all_open_tabs                   |      |
|      | - save_selected_content                |      |
|      | - get_recent_browsing_history          |      |
|      | - 集成到现有 AI Agent                  |      |
| 2.5  | **测试与文档**                         | 2    |
|      | - WebSocket 连接测试                   |      |
|      | - Agent 调用 E2E 测试                  |      |
|      | - 更新 API 文档                        |      |

**交付物**：

- ✅ 插件 v1.1.0 (Agent 集成版)
- ✅ 4 个 Agent 可调用的浏览器工具
- ✅ WebSocket 实时通信

**用户体验升级**：

```
之前: "帮我保存一个网页" → Agent: "请提供 URL"
之后: "帮我保存正在看的页面" → Agent: 自动获取当前页面并保存 ✅
```

---

### 15.3 Phase 3: Native Messaging - ⏸️ 暂缓

> **状态**: 暂不开发，后续按需启动
>
> 支持本地 AI Agent (Claude Code) 的高级功能，待 Phase 1/2 稳定后评估

| 任务 | 描述                       | 天数 |
| ---- | -------------------------- | ---- |
| 3.1  | Native Host 开发 (Node.js) | 2    |
| 3.2  | MCP Server 实现            | 1.5  |
| 3.3  | 跨平台安装脚本             | 0.5  |
| 3.4  | Claude Code 集成测试       | 1    |

**交付物**（暂缓）：

- ⏸️ Native Host 程序
- ⏸️ MCP Server (支持 Claude Code 调用)
- ⏸️ Windows/Mac/Linux 安装脚本

---

### 15.4 总计时间表

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         实施时间线                                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Week 1-4: Phase 1 MVP                                                  │
│  ═══════════════════════════════════════                                │
│  [████████████████████████████████████████] 20 天  ← 开始开发           │
│                                                                         │
│  Week 5-6: Phase 2 Agent 集成 ⭐                                         │
│  ════════════════════════════                                           │
│  [████████████████████] 10 天  ← 开始开发                               │
│                                                                         │
│  Phase 3 暂缓 ⏸️                                                         │
│                                                                         │
│  当前计划: 30 个工作日                                                   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

| 阶段                      | 天数  | 累计  | 状态            |
| ------------------------- | ----- | ----- | --------------- |
| Phase 1: MVP              | 20 天 | 20 天 | 🚀 **开始开发** |
| Phase 2: Agent 集成       | 10 天 | 30 天 | 🚀 **开始开发** |
| Phase 3: Native Messaging | 5 天  | -     | ⏸️ 暂缓         |

---

## 十六、附录 C: 新增文件清单

```
后端新增 (Phase 2):
├── src/app/api/plugin/
│   └── ws/
│       └── route.ts                 # WebSocket Hub
├── src/lib/ai-agent/tools/
│   └── browser-context-tools.ts     # Agent 工具注册
└── src/lib/plugin/
    ├── ws-manager.ts                # WebSocket 连接管理
    └── browser-command.ts           # 浏览器命令发送

插件新增 (Phase 2):
├── src/background/
│   ├── agent-bridge.ts              # WebSocket Agent 桥接
│   └── native-host.ts               # Native Messaging 处理
├── src/shared/
│   └── browser-tools.ts             # L2 能力定义
└── native-host/                     # Native Messaging Host
    ├── src/
    │   ├── main.ts
    │   ├── mcp-server.ts
    │   └── native-messaging.ts
    ├── package.json
    └── install.js
```

---

## 十七、决策记录更新

| 决策          | 选项                      | 选择                      | 理由                       |
| ------------- | ------------------------- | ------------------------- | -------------------------- |
| 认证方式      | API Token vs OAuth        | OAuth + PKCE              | 更安全，支持会话管理       |
| 插件框架      | Plasmo vs CRXJS           | CRXJS                     | 更轻量，Vite 原生支持      |
| UI 框架       | Vue vs React              | React                     | 与主项目一致               |
| 状态管理      | Redux vs Zustand          | Zustand                   | 轻量，适合小型应用         |
| 存储方案      | IndexedDB vs Storage API  | Chrome Storage            | 自动加密，跨设备同步       |
| 🆕 Agent 通信 | REST Polling vs WebSocket | **WebSocket**             | 实时双向，低延迟           |
| 🆕 能力分层   | 单一 API vs 分层模型      | **分层模型 (L1/L2/L3)**   | 清晰的职责边界             |
| 🆕 本地 Agent | 无 vs Native Messaging    | **Native Messaging 备选** | 支持 Claude Code 等本地 AI |

---

**文档结束 v2.0.0**

> Xiafe，方案已更新完毕，增加了：
>
> 1. ✅ 分层能力模型 (L1/L2/L3)
> 2. ✅ Agent 集成设计 (WebSocket + Browser Tools)
> 3. ✅ Native Messaging 备选方案 (MCP Server)
> 4. ✅ 更新后的实施计划 (Phase 2 高优先级)
>
> 请审阅此方案。如有任何问题或需要调整的部分，请告知 BMad Master。 🧙
