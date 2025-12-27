# Plugin Authorization Tools

> **Version**: 1.0.0
> **Since**: 2025-12-28
> **Module**: `src/lib/ai-agent/tools/plugin-auth/`

---

## 概述

浏览器插件授权管理工具集，提供插件 OAuth 授权的查询、撤销和统计功能。

**核心能力**:

- 查询用户的插件授权列表（支持状态/浏览器筛选）
- 撤销单个或全部授权
- 获取授权统计概览

---

## 架构集成

### 调用流程

```
用户消息
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│  IntentClassifier (意图分类)                              │
│  ├─ Pattern: /插件.{0,5}(授权|登录|设备)/                 │
│  │   → subType: "plugin_auth" (query)                   │
│  └─ Pattern: /退出.{0,5}(插件|所有设备)/                  │
│      → subType: "revoke_plugin_auth" (action)           │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│  ModeSelector (模式选择)                                  │
│  complexity: "simple" → mode: "atomic"                  │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│  KnowledgeAgent (原子模式执行)                            │
│  ├─ 加载所有注册的 Tools (包含 pluginAuthTools)          │
│  └─ LLM 根据 Tool 描述自动选择调用                        │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│  Plugin Auth Tools                                       │
│  ├─ list_plugin_authorizations                          │
│  ├─ revoke_plugin_authorization                         │
│  ├─ revoke_all_plugin_authorizations                    │
│  └─ get_plugin_auth_stats                               │
└─────────────────────────────────────────────────────────┘
```

### 注册方式

```typescript
// src/lib/ai-agent/tools/index.ts
import { pluginAuthTools } from "./plugin-auth";

export function registerDefaultTools(): void {
  // ...
  toolRegistry.registerAll(pluginAuthTools); // v2.3.0 新增
}
```

---

## Tools 清单

| Tool 名称                          | 类型   | 功能         | 确认   |
| ---------------------------------- | ------ | ------------ | ------ |
| `list_plugin_authorizations`       | query  | 列出授权记录 | 否     |
| `revoke_plugin_authorization`      | action | 撤销单个授权 | 否     |
| `revoke_all_plugin_authorizations` | action | 撤销全部授权 | **是** |
| `get_plugin_auth_stats`            | query  | 获取统计概览 | 否     |

---

## Tool 详细说明

### 1. list_plugin_authorizations

**功能**: 列出用户的浏览器插件授权记录

**参数**:
| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| status | enum | 否 | "active" | active/expired/revoked/all |
| browser | enum | 否 | - | chrome/edge/firefox/other |
| limit | number | 否 | 20 | 1-50 |

**返回**:

```typescript
{
  authorizations: PluginAuthorization[];  // 授权列表
  total: number;                          // 总数
  activeCount: number;                    // 活跃数
  message: string;                        // 友好消息
}
```

**触发语句**:

- "查看我的插件授权"
- "我有多少个设备登录了插件"
- "Chrome 插件最后什么时候用的"
- "哪些插件授权已过期"

---

### 2. revoke_plugin_authorization

**功能**: 撤销单个浏览器插件授权

**参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| authorizationId | string (UUID) | 是 | 要撤销的授权 ID |

**返回**:

```typescript
{
  revokedId: string; // 被撤销的授权 ID
  browser: string; // 浏览器类型
  browserLabel: string; // 浏览器显示名称
  message: string; // 友好消息
}
```

**错误码**:
| 错误码 | 说明 |
|--------|------|
| NOT_FOUND | 授权不存在或无权操作 |
| ALREADY_REVOKED | 授权已被撤销 |
| DB_ERROR | 数据库错误 |

**触发语句**:

- "撤销 ID 为 xxx 的授权"
- "退出这个 Chrome 插件"

---

### 3. revoke_all_plugin_authorizations

**功能**: 撤销用户所有（或指定浏览器的）插件授权

⚠️ **高风险操作** - 需要用户确认 (`requiresConfirmation: true`)

**参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| browser | enum | 否 | 仅撤销指定浏览器的授权 |
| confirmReason | string | 否 | 确认原因（安全审计用） |

**返回**:

```typescript
{
  revokedCount: number; // 撤销数量
  browser: string | null; // 筛选的浏览器（null 表示全部）
  message: string; // 友好消息
}
```

**触发语句**:

- "退出所有浏览器插件"
- "我怀疑账号被盗，撤销所有授权"
- "只退出 Chrome 的所有插件"

**数据库依赖**:

- 使用 RPC 函数 `revoke_all_plugin_authorizations(p_user_id UUID)`

---

### 4. get_plugin_auth_stats

**功能**: 获取插件授权统计概览

**参数**: 无必填参数

**返回**:

```typescript
{
  totalAuthorizations: number;  // 总授权数
  activeCount: number;          // 活跃数
  expiredCount: number;         // 过期数
  revokedCount: number;         // 已撤销数
  byBrowser: BrowserStats[];    // 按浏览器分组
  oldestActiveDate: string | null;
  newestActiveDate: string | null;
  message: string;
}
```

**触发语句**:

- "插件授权概览"
- "我有几个设备在用插件"
- "哪个浏览器用得最多"

---

## 意图分类规则

```typescript
// src/lib/ai-skills/router/intent-classifier.ts

// 查询类
{
  pattern: /插件.{0,5}(授权|登录|设备)|设备.{0,5}(登录|授权)|浏览器.{0,5}(插件|授权)/,
  type: "query",
  subType: "plugin_auth",
  complexity: "simple",
  weight: 75,
}

// 操作类
{
  pattern: /退出.{0,5}(插件|所有设备)|撤销.{0,5}(授权|插件)|登出.{0,5}(插件|设备)/,
  type: "action",
  subType: "revoke_plugin_auth",
  complexity: "simple",
  weight: 80,
}
```

**复杂度**: `simple` → 使用原子模式 (Atomic Mode)，由 LLM 自动选择 Tool

---

## 数据库表结构

```sql
-- supabase/migrations/20251228000001_add_plugin_authorization.sql

CREATE TABLE plugin_authorizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  refresh_token_hash TEXT NOT NULL,
  access_token_jti TEXT NOT NULL,
  browser TEXT NOT NULL CHECK (browser IN ('chrome', 'edge', 'firefox', 'other')),
  extension_version TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ
);

-- RPC 函数
CREATE OR REPLACE FUNCTION revoke_all_plugin_authorizations(p_user_id UUID)
RETURNS INTEGER AS $$
  -- 批量撤销所有有效授权
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 文件结构

```
src/lib/ai-agent/tools/plugin-auth/
├── README.md                                    # 本文档
├── types.ts                                     # 共享类型和工具函数
├── list-plugin-authorizations.tool.ts           # 列表查询 Tool
├── revoke-plugin-authorization.tool.ts          # 单个撤销 Tool
├── revoke-all-plugin-authorizations.tool.ts     # 批量撤销 Tool
├── get-plugin-auth-stats.tool.ts                # 统计概览 Tool
├── index.ts                                     # 模块导出
└── __tests__/                                   # 单元测试
    ├── list-plugin-authorizations.tool.test.ts
    ├── revoke-plugin-authorization.tool.test.ts
    ├── revoke-all-plugin-authorizations.tool.test.ts
    └── get-plugin-auth-stats.tool.test.ts
```

---

## 测试覆盖

```bash
npm test -- --testPathPattern="plugin-auth"

# 结果
Test Suites: 4 passed, 4 total
Tests:       42 passed, 42 total
```

---

## 类型定义

### PluginAuthorization

```typescript
interface PluginAuthorization {
  id: string;
  browser: BrowserType;
  browserLabel: string; // "Chrome" | "Edge" | "Firefox" | "其他"
  extensionVersion: string | null;
  createdAt: string;
  lastUsedAt: string;
  lastUsedDescription: string; // "3小时前"
  expiresAt: string;
  status: AuthorizationStatus; // "active" | "expired" | "revoked"
}
```

### BrowserType

```typescript
type BrowserType = "chrome" | "edge" | "firefox" | "other";

const BROWSER_DISPLAY_NAMES: Record<BrowserType, string> = {
  chrome: "Chrome",
  edge: "Edge",
  firefox: "Firefox",
  other: "其他",
};
```

---

## 版本历史

| 版本  | 日期       | 变更                            |
| ----- | ---------- | ------------------------------- |
| 1.0.0 | 2025-12-28 | 初始版本，4 个 Tools，42 个测试 |
