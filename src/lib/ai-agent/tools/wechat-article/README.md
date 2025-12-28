# Wechat Article Tools

> **Version**: 1.0.0
> **Since**: 2025-12-28
> **Module**: `src/lib/ai-agent/tools/wechat-article/`

---

## 概述

微信文章统计 AI Agent Tool，提供微信公众号文章的统计概览功能。

**核心能力**:

- 获取微信文章统计数据（文章数、图片数、存储使用）

**注意**: `list_wechat_articles` Tool 已在 `query` 模块中实现，提供更完整的文章列表功能。

---

## 架构集成

### 调用流程

```
用户消息
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│  IntentClassifier (意图分类)                              │
│  └─ Pattern: /微信.{0,3}(文章|收藏).{0,3}(统计|概览)/     │
│      → subType: "wechat_article_stats"                  │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│  KnowledgeAgent (原子模式执行)                            │
│  └─ 调用 get_wechat_article_stats Tool                   │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│  WechatArticleService.getUserStats()                     │
│  └─ RPC: get_wechat_article_stats                        │
└─────────────────────────────────────────────────────────┘
```

### 注册方式

```typescript
// src/lib/ai-agent/tools/index.ts
import { wechatArticleTools } from "./wechat-article";

export function registerDefaultTools(): void {
  // ...
  toolRegistry.registerAll(wechatArticleTools); // v2.4.0 新增
}
```

---

## Tools 清单

| Tool 名称                  | 类型  | 功能                 | 确认 |
| -------------------------- | ----- | -------------------- | ---- |
| `get_wechat_article_stats` | query | 获取微信文章统计概览 | 否   |

---

## Tool 详细说明

### get_wechat_article_stats

**功能**: 获取用户的微信文章统计概览

**参数**: 无必填参数

**返回**:

```typescript
{
  totalArticles: number; // 总文章数
  totalImages: number; // 总图片数
  successImages: number; // 成功持久化的图片数
  failedImages: number; // 持久化失败的图片数
  storageUsed: number; // 存储空间使用（字节）
  storageUsedFormatted: string; // 存储空间使用（友好格式）
  imageSuccessRate: string; // 图片成功率
  message: string; // 友好消息
}
```

**触发语句**:

- "我的微信文章统计"
- "微信文章占用多少存储"
- "图片保存成功率多少"
- "有多少微信文章"

---

## 意图分类规则

```typescript
// src/lib/ai-skills/router/intent-classifier.ts

{
  pattern: /微信.{0,3}(文章|收藏).{0,3}(统计|概览|数据)|公众号.{0,3}(统计|多少)/,
  type: "query",
  subType: "wechat_article_stats",
  complexity: "simple",
  weight: 74,
}
```

---

## 依赖服务

- `WechatArticleService.getUserStats()`: 获取用户微信文章统计

**服务位置**: `src/lib/wechat-article/wechat-article.service.ts`

**数据库依赖**:

- RPC 函数: `get_wechat_article_stats(p_user_id UUID)`

---

## 文件结构

```
src/lib/ai-agent/tools/wechat-article/
├── README.md                          # 本文档
├── types.ts                           # 类型定义和工具函数
├── get-wechat-article-stats.tool.ts   # 统计概览 Tool
└── index.ts                           # 模块导出
```

---

## 相关 Tools

`list_wechat_articles` Tool 位于 `query` 模块：

```
src/lib/ai-agent/tools/query/
└── list-wechat-articles.tool.ts
```

提供更完整的功能：

- 按公众号分组
- 时间筛选
- 仅统计模式
- 排序选项

---

## 版本历史

| 版本  | 日期       | 变更                |
| ----- | ---------- | ------------------- |
| 1.0.0 | 2025-12-28 | 初始版本，1 个 Tool |
