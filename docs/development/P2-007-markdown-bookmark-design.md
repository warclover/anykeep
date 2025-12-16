# P2-007: Markdown 内容收藏 - 技术设计方案

> **版本**: v2.1 (待审核)
> **制定日期**: 2025-12-16
> **工时估算**: 9 天
> **前置依赖**: P1-004 (核心流程)
> **定位**: 独立付费功能模块（完全解耦）

---

## 一、功能定位

### 1.1 核心场景

```
用户在使用 ChatGPT/Claude/Cursor 等 AI 工具时：

1. 获得一段有价值的 AI 回复（代码/教程/分析）
2. 想要长期保存这段内容
3. 希望后续能搜索到、能问答引用

当前痛点：
- 复制到笔记应用 → 找不到、难搜索
- 截图保存 → 无法复制代码、无法搜索
- 浏览器书签 → AI 对话会过期/删除

AnyKeep 解法：
- 粘贴/上传/拖拽 Markdown → 永久保存
- AI 自动生成摘要/标签 → 快速定位
- 语义搜索 + 全库问答 → 知识复用
- 专业阅读界面 → 舒适体验
```

### 1.2 功能边界（红线）

| ✅ 做（收藏站定位） | ❌ 不做（笔记本定位） |
| ------------------- | --------------------- |
| MD 内容粘贴收藏     | Markdown 编辑器       |
| MD 文件上传/拖拽    | 双向链接/反向链接     |
| **专业级阅读界面**  | 版本历史/协作编辑     |
| AI 摘要/标签生成    | 实时预览编辑          |
| 语义搜索/全库问答   | 导出为其他格式        |
| 代码语法高亮 + 复制 | 图片上传嵌入          |

**定位口号**：「收藏站，不是笔记本」

### 1.3 付费功能设计

```typescript
// 功能模块完全解耦，便于付费控制
const MD_FEATURE_CONFIG = {
  free: {
    enabled: false, // 免费用户不可用
    limit: 0,
  },
  pro: {
    enabled: true,
    limit: 500, // Pro: 500 条
  },
  proPlus: {
    enabled: true,
    limit: -1, // Pro+: 无限制
  },
};
```

### 1.4 标签系统集成策略（v2.1 新增）

**设计决策**: 采用「标签库共享」方案

```
┌─────────────────────────────────────────────────────────────────┐
│                        用户标签库                                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  工作  前端  React  Python  AI  学习  收藏  ...         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│              ┌───────────────┼───────────────┐                  │
│              ▼               ▼               ▼                  │
│      ┌───────────┐   ┌───────────┐   ┌───────────┐             │
│      │ bookmarks │   │md_collect │   │ 未来模块  │             │
│      │ user_tags │   │ user_tags │   │ user_tags │             │
│      └───────────┘   └───────────┘   └───────────┘             │
└─────────────────────────────────────────────────────────────────┘
```

**实现方式**:

```typescript
// 1. 标签库表设计（可选，Phase 2 优化）
// 当前阶段：直接使用 user_tags TEXT[] 字段
// 后续优化：统一标签库 + 标签使用统计

// 2. 标签选择组件复用
// 复用现有 TagSelector 组件，支持：
// - AI 自动生成标签 (ai_tags)
// - 用户手动添加标签 (user_tags)
// - 从历史标签中选择（跨 bookmarks 和 md_collections）

// 3. 获取用户历史标签
async function getUserTagLibrary(userId: string): Promise<string[]> {
  const [bookmarkTags, mdTags] = await Promise.all([
    // 从 bookmarks 获取
    supabase
      .from("bookmarks")
      .select("user_tags")
      .eq("user_id", userId)
      .not("user_tags", "is", null),
    // 从 md_collections 获取
    supabase
      .from("md_collections")
      .select("user_tags")
      .eq("user_id", userId)
      .not("user_tags", "is", null),
  ]);

  // 合并去重
  const allTags = new Set<string>();
  [...bookmarkTags.data, ...mdTags.data].forEach((item) => {
    item.user_tags?.forEach((tag) => allTags.add(tag));
  });

  return Array.from(allTags).sort();
}
```

**标签功能特性**:

| 功能         | MD 收藏支持 | 说明             |
| ------------ | ----------- | ---------------- |
| AI 自动标签  | ✅          | 基于内容智能生成 |
| 用户手动标签 | ✅          | 支持自定义添加   |
| 历史标签选择 | ✅          | 跨模块共享标签库 |
| 按标签筛选   | ✅          | MD 列表页支持    |
| 预设使用标签 | ✅          | 复用现有预设标签 |

### 1.5 文件夹分类支持（v2.1 确认）

**设计决策**: 复用现有 `folders` 表

```sql
-- md_collections.folder_id 字段
folder_id BIGINT REFERENCES folders(id) ON DELETE SET NULL,
```

**用户体验**:

- 创建 MD 收藏时可选择目标文件夹
- 可在文件夹页面查看该文件夹下的 MD 收藏
- 支持拖拽移动到不同文件夹

### 1.6 AI 能力支持（v2.1 确认）

| AI 功能  | 支持状态 | 实现方式                           |
| -------- | -------- | ---------------------------------- |
| 智能摘要 | ✅       | 异步 AI 处理，存入 ai_summary 字段 |
| 自动标签 | ✅       | AI 生成，存入 ai_tags 数组         |
| 内容分类 | ✅       | 检测内容类型（教程/代码/分析等）   |
| 语义搜索 | ✅       | 1536 维向量嵌入，支持相似度检索    |
| 全库问答 | ✅       | 基于 embedding 的 RAG 检索         |

---

## 二、模块解耦架构

### 2.1 目录结构（完全独立）

```
src/
├── features/                          # 功能模块目录
│   └── md-collections/                # MD 收藏功能模块（完全独立）
│       ├── components/                # 模块专属组件
│       │   ├── md-collection-page.tsx     # 主页面
│       │   ├── md-reader-view.tsx         # 专业阅读视图
│       │   ├── md-upload-zone.tsx         # 拖拽上传区
│       │   ├── md-paste-dialog.tsx        # 粘贴对话框
│       │   ├── md-list-view.tsx           # 列表视图
│       │   ├── md-card-view.tsx           # 卡片视图（v2.1 新增）
│       │   ├── md-card-item.tsx           # 卡片组件
│       │   ├── md-view-toggle.tsx         # 视图切换（v2.1 新增）
│       │   ├── md-empty-state.tsx         # 空状态
│       │   └── index.ts
│       ├── lib/                       # 模块专属逻辑
│       │   ├── md-parser.ts               # MD 解析器
│       │   ├── md-sanitizer.ts            # XSS 清理
│       │   ├── md-processor.ts            # 预处理器
│       │   ├── feature-gate.ts            # 功能开关门控
│       │   └── index.ts
│       ├── hooks/                     # 模块专属 Hooks
│       │   ├── use-md-collections.ts      # 数据获取
│       │   ├── use-md-upload.ts           # 上传逻辑
│       │   └── index.ts
│       ├── types/                     # 模块专属类型
│       │   └── index.ts
│       ├── constants/                 # 模块常量
│       │   └── index.ts
│       └── index.ts                   # 模块入口
├── app/
│   └── (main)/
│       └── md-collections/            # 独立路由
│           ├── page.tsx               # 列表页
│           └── [id]/
│               └── page.tsx           # 阅读页
└── components/
    └── markdown/                      # 共享 MD 渲染组件
        ├── markdown-renderer.tsx
        ├── markdown-code-block.tsx
        └── index.ts
```

### 2.2 模块入口设计

```typescript
// src/features/md-collections/index.ts
// 统一导出，便于功能开关控制

export { MdCollectionPage } from "./components/md-collection-page";
export { MdReaderView } from "./components/md-reader-view";
export { MdUploadZone } from "./components/md-upload-zone";
export { MdPasteDialog } from "./components/md-paste-dialog";

export { useMdCollections } from "./hooks/use-md-collections";
export { useMdUpload } from "./hooks/use-md-upload";

export type { MdCollection, MdCollectionCreate } from "./types";

// 功能开关检查
export { isMdFeatureEnabled, getMdFeatureLimit } from "./lib/feature-gate";
```

### 2.3 功能开关门控

```typescript
// src/features/md-collections/lib/feature-gate.ts

import { MembershipType } from "@/types/supabase";

const FEATURE_CONFIG: Record<
  MembershipType,
  { enabled: boolean; limit: number }
> = {
  free: { enabled: false, limit: 0 },
  pro: { enabled: true, limit: 500 },
  pro_plus: { enabled: true, limit: -1 },
};

export function isMdFeatureEnabled(membership: MembershipType): boolean {
  return FEATURE_CONFIG[membership]?.enabled ?? false;
}

export function getMdFeatureLimit(membership: MembershipType): number {
  return FEATURE_CONFIG[membership]?.limit ?? 0;
}

export function canCreateMdCollection(
  membership: MembershipType,
  currentCount: number,
): { allowed: boolean; reason?: string } {
  if (!isMdFeatureEnabled(membership)) {
    return { allowed: false, reason: "此功能需要升级到 Pro 版本" };
  }

  const limit = getMdFeatureLimit(membership);
  if (limit !== -1 && currentCount >= limit) {
    return {
      allowed: false,
      reason: `已达到 ${limit} 条限制，请升级到 Pro+ 解锁无限制`,
    };
  }

  return { allowed: true };
}
```

---

## 三、数据库设计

### 3.1 独立表设计（完全解耦）

**设计理念**: 使用独立表而非扩展 bookmarks 表，实现完全解耦

```sql
-- Migration: 20251220000001_create_md_collections.sql

-- 创建独立的 MD 收藏表（与 bookmarks 表完全解耦）
CREATE TABLE IF NOT EXISTS md_collections (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 基础信息
  title VARCHAR(500) NOT NULL,
  raw_content TEXT NOT NULL,
  content_hash VARCHAR(64) NOT NULL,  -- SHA-256 去重

  -- 元数据
  word_count INTEGER DEFAULT 0,
  code_block_count INTEGER DEFAULT 0,
  reading_time_minutes INTEGER DEFAULT 0,

  -- AI 生成内容
  ai_summary TEXT,
  ai_tags TEXT[],
  content_type VARCHAR(50),           -- TUTORIAL, CODE_SNIPPET, ANALYSIS 等
  content_type_confidence REAL,

  -- 向量嵌入
  embedding vector(1536),

  -- 组织
  folder_id BIGINT REFERENCES folders(id) ON DELETE SET NULL,
  user_tags TEXT[],
  notes TEXT,

  -- 状态
  processing_status VARCHAR(20) DEFAULT 'pending'
    CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),

  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- 索引
CREATE INDEX idx_md_collections_user_id ON md_collections(user_id)
  WHERE deleted_at IS NULL;
CREATE INDEX idx_md_collections_content_hash ON md_collections(user_id, content_hash)
  WHERE deleted_at IS NULL;
CREATE INDEX idx_md_collections_folder ON md_collections(folder_id)
  WHERE deleted_at IS NULL;
CREATE INDEX idx_md_collections_created ON md_collections(created_at DESC)
  WHERE deleted_at IS NULL;

-- 向量索引（用于语义搜索）
CREATE INDEX idx_md_collections_embedding ON md_collections
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)
  WHERE deleted_at IS NULL AND embedding IS NOT NULL;

-- RLS 策略
ALTER TABLE md_collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own md_collections"
  ON md_collections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own md_collections"
  ON md_collections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own md_collections"
  ON md_collections FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own md_collections"
  ON md_collections FOR DELETE
  USING (auth.uid() = user_id);

-- 触发器：更新时间戳
CREATE TRIGGER update_md_collections_updated_at
  BEFORE UPDATE ON md_collections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

### 3.2 存储容量估算

```
单条 MD 收藏：
- raw_content: 平均 5KB（约 2000 字）
- embedding: 6KB (1536 维 float32)
- 其他字段: ~1KB
- 总计: ~12KB/条

Pro 用户限制：500 条 → ~6MB
Pro+ 用户：无限制（监控使用量）
```

---

## 四、API 设计

### 4.1 独立 API 路由

```
src/app/api/md-collections/
├── route.ts                    # GET (列表) / POST (创建)
├── [id]/
│   └── route.ts                # GET / PATCH / DELETE
├── upload/
│   └── route.ts                # POST (文件上传)
├── check-duplicate/
│   └── route.ts                # POST (去重检测)
└── search/
    └── route.ts                # POST (语义搜索)
```

### 4.2 创建 MD 收藏

**端点**: `POST /api/md-collections`

```typescript
interface CreateMdCollectionRequest {
  rawContent: string; // 必填：Markdown 原始内容
  title?: string; // 可选：用户输入标题（自动提取）
  folderId?: number; // 可选：目标文件夹
  userTags?: string[]; // 可选：用户标签
  notes?: string; // 可选：备注
}

// 响应
interface CreateMdCollectionResponse {
  success: true;
  data: {
    id: number;
    title: string;
    wordCount: number;
    codeBlockCount: number;
    readingTimeMinutes: number;
    processingStatus: "pending"; // AI 异步处理中
    createdAt: string;
  };
}
```

### 4.3 上传 MD 文件

**端点**: `POST /api/md-collections/upload`

```typescript
// FormData 请求
interface UploadMdFileRequest {
  file: File; // .md 文件
  title?: string; // 可选：覆盖文件名
  folderId?: number;
  userTags?: string[];
}

// 文件限制
const UPLOAD_LIMITS = {
  maxFileSize: 1 * 1024 * 1024, // 1MB
  allowedExtensions: [".md", ".markdown", ".txt"],
  maxFilesPerRequest: 10, // 批量上传
};
```

### 4.4 获取列表

**端点**: `GET /api/md-collections`

```typescript
interface GetMdCollectionsParams {
  page?: number; // 默认 1
  limit?: number; // 默认 20
  folderId?: number; // 文件夹筛选
  search?: string; // 标题搜索
  sort?: "created_desc" | "created_asc" | "title_asc" | "title_desc";
}
```

### 4.5 语义搜索

**端点**: `POST /api/md-collections/search`

```typescript
interface SemanticSearchRequest {
  query: string; // 搜索文本
  limit?: number; // 默认 10
  threshold?: number; // 相似度阈值，默认 0.7
}

interface SemanticSearchResponse {
  success: true;
  data: Array<{
    id: number;
    title: string;
    snippet: string; // 相关片段
    similarity: number; // 相似度分数
  }>;
}
```

---

## 五、前端页面设计

### 5.1 侧边栏菜单集成

**位置**: 主导航区域（首页下方）

```typescript
// src/components/layout/app-sidebar.tsx 修改

import { FileText } from 'lucide-react'

// 在主导航配置中添加（作为独立链接，非 Keep-Alive 页面）
// 位于"首页"下方

<Link
  href="/md-collections"
  className={cn(
    "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors",
    pathname === "/md-collections" || pathname?.startsWith("/md-collections/")
      ? "bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
      : "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800/50"
  )}
>
  <FileText className="size-5" />
  <span className="flex-1">MD收藏</span>
  <span className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-600 rounded">
    Pro
  </span>
</Link>
```

**菜单效果**:

```
┌─────────────────────────────────────┐
│  AnyKeep                            │
│  智能收藏管理                        │
├─────────────────────────────────────┤
│  🏠 首页                            │
│  📄 MD收藏              PRO         │  ← 新增入口
│  🔍 搜索                            │
│  📁 收藏夹                          │
│  🔔 消息                            │
│  📊 数据                            │
│  ⚙️ 设置                            │
├─────────────────────────────────────┤
│  系统文件夹                          │
│  ...                                │
└─────────────────────────────────────┘
```

### 5.2 MD 收藏列表页

**路由**: `/md-collections`

**页面布局**:

```
┌────────────────────────────────────────────────────────────────────────┐
│  📄 MD 收藏                                          [粘贴内容] [上传]  │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌─ 拖拽上传区域 ──────────────────────────────────────────────────┐  │
│  │                                                                  │  │
│  │        📁 拖拽 .md 文件到此处上传                                │  │
│  │           或点击选择文件                                         │  │
│  │                                                                  │  │
│  │        支持 .md, .markdown, .txt 格式，单文件最大 1MB            │  │
│  │                                                                  │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│  ── 最近收藏 (12 条) ─────────────────────────────────────────────────  │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │ 📄 React 性能优化技巧                              2 分钟前       │ │
│  │    💡 讲解 useMemo、useCallback 的使用场景和注意事项...          │ │
│  │    📊 1,234 字 | 📝 3 代码块 | 📖 5 分钟                         │ │
│  │    🏷️ React  性能优化  前端                                      │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │ 📄 Python 异步编程指南                              1 小时前      │ │
│  │    💡 详细介绍 asyncio 库的使用方法和最佳实践...                 │ │
│  │    📊 2,567 字 | 📝 8 代码块 | 📖 12 分钟                        │ │
│  │    🏷️ Python  异步  教程                                         │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

### 5.3 专业阅读视图（核心亮点）

**路由**: `/md-collections/[id]`

**设计理念**: 专注阅读、舒适体验、代码友好、优美排版

```
┌────────────────────────────────────────────────────────────────────────┐
│  ← 返回列表                        📄 React 性能优化技巧      [删除]   │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌─ AI 智能摘要 ─────────────────────────────────────────────────────┐│
│  │ 💡 本文介绍了 React 性能优化的核心技巧，包括 useMemo、useCallback │ │
│  │    的正确使用场景，以及如何避免不必要的重渲染。适合有一定 React   │ │
│  │    基础的开发者阅读。                                            │ │
│  └───────────────────────────────────────────────────────────────────┘│
│                                                                        │
│  ┌─ 阅读区域（专业 prose 排版）───────────────────────────────────────┐
│  │                                                                    │
│  │  # React 性能优化技巧                                              │
│  │                                                                    │
│  │  本文将介绍几个实用的 React 性能优化技巧，帮助你构建更流畅的      │
│  │  用户体验。                                                        │
│  │                                                                    │
│  │  ## 1. useMemo 使用场景                                            │
│  │                                                                    │
│  │  useMemo 用于缓存计算结果，避免每次渲染都重新计算昂贵的操作。     │
│  │                                                                    │
│  │  ┌─ typescript ──────────────────────────────────────────┐ [复制] │
│  │  │  1 │ const memoizedValue = useMemo(() => {            │        │
│  │  │  2 │   return computeExpensiveValue(a, b);            │        │
│  │  │  3 │ }, [a, b]);                                      │        │
│  │  └───────────────────────────────────────────────────────┘        │
│  │                                                                    │
│  │  ### 何时使用 useMemo                                              │
│  │                                                                    │
│  │  • 计算量大的派生数据                                              │
│  │  • 需要保持引用稳定的对象/数组                                     │
│  │  • 作为其他 Hook 的依赖项                                          │
│  │                                                                    │
│  │  ## 2. useCallback 最佳实践                                        │
│  │                                                                    │
│  │  useCallback 用于缓存函数引用，常与 React.memo 配合使用。          │
│  │                                                                    │
│  └────────────────────────────────────────────────────────────────────┘
│                                                                        │
│  ┌─ 元信息 ──────────────────────────────────────────────────────────┐│
│  │ 📊 1,234 字 | 📝 3 代码块 | 📖 约 5 分钟阅读                      │ │
│  │ 🏷️ React  性能优化  前端  useMemo                                 │ │
│  │ 📅 收藏于 2025-12-16 10:30                                        │ │
│  └───────────────────────────────────────────────────────────────────┘│
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

### 5.4 阅读视图特性配置

```typescript
// src/features/md-collections/constants/index.ts

export const READER_CONFIG = {
  // 排版配置
  typography: {
    maxWidth: "65ch", // 最佳阅读宽度（约 65 个字符）
    lineHeight: 1.75, // 舒适的行高
    fontSize: "16px", // 基础字号
    paragraphSpacing: "1.25em", // 段落间距
  },

  // 代码块配置
  codeBlock: {
    theme: "one-dark", // 暗色主题
    showLineNumbers: true, // 显示行号
    copyButton: true, // 复制按钮
    languageLabel: true, // 语言标签
    maxHeight: "500px", // 最大高度（超出滚动）
  },

  // 功能配置
  features: {
    aiSummaryExpanded: true, // AI 摘要默认展开
    tableOfContents: true, // 长文档显示目录
    readingProgress: true, // 顶部阅读进度条
    smoothScroll: true, // 平滑滚动
  },
};
```

### 5.5 粘贴对话框

````
┌─────────────────────────────────────────────────────────┐
│  ╳ 粘贴 Markdown 内容                        [上传文件] │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ 粘贴 Markdown 内容...                           │   │
│  │                                                 │   │
│  │ # 在这里粘贴 AI 生成的内容                      │   │
│  │                                                 │   │
│  │ 支持 ChatGPT、Claude、Cursor 等工具的输出       │   │
│  │                                                 │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  标题: [自动从 # 标题提取，可编辑        ]             │
│                                                         │
│  ▼ 更多选项                                            │
│    ├─ 文件夹: [技术学习          ▼]                    │
│    └─ 标签:   [React] [性能优化] [+ 添加]              │
│                                                         │
│  ┌─ 实时预览 ─────────────────────────────────────┐   │
│  │ # React 性能优化笔记                            │   │
│  │ ## 1. useMemo 使用场景                          │   │
│  │ ```typescript                                   │   │
│  │ const memoizedValue = useMemo(() => {...})     │   │
│  │ ```                                            │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  📊 1,234 字  |  📝 3 代码块  |  📖 约 5 分钟          │
│                                                         │
│           [取消]                    [保存收藏]          │
└─────────────────────────────────────────────────────────┘
````

### 5.6 拖拽上传区组件

```typescript
// src/features/md-collections/components/md-upload-zone.tsx

interface MdUploadZoneProps {
  onUpload: (files: File[]) => Promise<void>
  disabled?: boolean
  className?: string
}

export function MdUploadZone({ onUpload, disabled, className }: MdUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [uploadingFiles, setUploadingFiles] = useState<Map<string, number>>(new Map())
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDrop = useCallback(async (e: DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const files = Array.from(e.dataTransfer?.files || [])
      .filter(file => ALLOWED_EXTENSIONS.some(ext => file.name.endsWith(ext)))

    if (files.length > 0) {
      await onUpload(files)
    }
  }, [onUpload])

  return (
    <div
      className={cn(
        "relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200",
        isDragging
          ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20 scale-[1.02]"
          : "border-gray-200 hover:border-gray-300 dark:border-gray-700",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
      onDragEnter={() => setIsDragging(true)}
      onDragLeave={() => setIsDragging(false)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".md,.markdown,.txt"
        multiple
        className="hidden"
        onChange={handleFileSelect}
      />

      <div className="flex flex-col items-center gap-4">
        <div className={cn(
          "w-16 h-16 rounded-full flex items-center justify-center transition-colors",
          isDragging ? "bg-purple-100 dark:bg-purple-800" : "bg-gray-100 dark:bg-gray-800"
        )}>
          <Upload className={cn(
            "w-8 h-8 transition-colors",
            isDragging ? "text-purple-500" : "text-gray-400"
          )} />
        </div>

        <div>
          <p className="text-lg font-medium text-gray-900 dark:text-white">
            {isDragging ? "松开鼠标上传文件" : "拖拽 .md 文件到此处"}
          </p>
          <p className="mt-1 text-sm text-gray-500">
            或{' '}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="text-purple-500 hover:text-purple-600 hover:underline"
            >
              点击选择文件
            </button>
          </p>
        </div>

        <p className="text-xs text-gray-400">
          支持 .md, .markdown, .txt 格式，单文件最大 1MB
        </p>
      </div>

      {/* 上传进度指示器 */}
      {uploadingFiles.size > 0 && (
        <div className="mt-4 space-y-2">
          {Array.from(uploadingFiles).map(([filename, progress]) => (
            <UploadProgressBar key={filename} filename={filename} progress={progress} />
          ))}
        </div>
      )}
    </div>
  )
}
```

### 5.7 空状态设计

```typescript
// src/features/md-collections/components/md-empty-state.tsx

export function MdEmptyState({ onPaste, onUpload }: MdEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-24 h-24 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mb-6">
        <FileText className="w-12 h-12 text-purple-500" />
      </div>

      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
        开始收藏 AI 内容
      </h3>

      <p className="text-gray-500 dark:text-gray-400 max-w-md mb-8">
        保存 ChatGPT、Claude、Cursor 等 AI 工具生成的有价值内容，
        让知识永不丢失。
      </p>

      <div className="flex gap-4">
        <button
          onClick={onPaste}
          className="px-6 py-3 bg-purple-500 text-white rounded-lg font-medium hover:bg-purple-600 transition-colors flex items-center gap-2"
        >
          <ClipboardPaste className="w-5 h-5" />
          粘贴内容
        </button>

        <button
          onClick={onUpload}
          className="px-6 py-3 bg-white border border-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors flex items-center gap-2"
        >
          <Upload className="w-5 h-5" />
          上传文件
        </button>
      </div>

      <div className="mt-12 grid grid-cols-3 gap-8 max-w-2xl">
        <FeatureCard
          icon={<Sparkles className="w-6 h-6 text-amber-500" />}
          title="AI 智能摘要"
          description="自动生成内容摘要和标签"
        />
        <FeatureCard
          icon={<Search className="w-6 h-6 text-blue-500" />}
          title="语义搜索"
          description="用自然语言找到需要的内容"
        />
        <FeatureCard
          icon={<Code className="w-6 h-6 text-green-500" />}
          title="代码高亮"
          description="专业的代码展示和一键复制"
        />
      </div>
    </div>
  )
}
```

### 5.8 卡片视图组件（v2.1 新增）

**设计理念**: 提供与普通收藏一致的卡片浏览体验，突出 MD 内容特色

**卡片布局效果**:

```
┌─────────────────────────────────────────────────────────────────────────┐
│  📄 MD 收藏                              [列表] [卡片]  [粘贴] [上传]     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌──────────────────┐ │
│  │ 📝 TUTORIAL         │  │ 📝 CODE_SNIPPET     │  │ 📝 ANALYSIS      │ │
│  │                     │  │                     │  │                  │ │
│  │ React 性能优化技巧   │  │ Python 装饰器详解   │  │ 系统架构分析     │ │
│  │                     │  │                     │  │                  │ │
│  │ 讲解 useMemo、      │  │ 详细介绍装饰器的    │  │ 微服务架构的     │ │
│  │ useCallback 的使用  │  │ 原理和高级用法...   │  │ 优缺点对比...    │ │
│  │ 场景和注意事项...   │  │                     │  │                  │ │
│  │                     │  │                     │  │                  │ │
│  │ ─────────────────── │  │ ─────────────────── │  │ ──────────────── │ │
│  │ 📊 1,234 字 | 📝 3  │  │ 📊 2,567 字 | 📝 8  │  │ 📊 3,421 字      │ │
│  │ 🏷️ React 性能       │  │ 🏷️ Python 装饰器   │  │ 🏷️ 架构 微服务   │ │
│  │ 📅 2 分钟前         │  │ 📅 1 小时前        │  │ 📅 昨天          │ │
│  └─────────────────────┘  └─────────────────────┘  └──────────────────┘ │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**卡片组件实现**:

```typescript
// src/features/md-collections/components/md-card-item.tsx

interface MdCardItemProps {
  item: MdCollection
  onClick: () => void
  onDelete?: () => void
}

export function MdCardItem({ item, onClick, onDelete }: MdCardItemProps) {
  return (
    <div
      onClick={onClick}
      className="group bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 hover:shadow-lg hover:border-purple-200 dark:hover:border-purple-800 transition-all cursor-pointer"
    >
      {/* 内容类型标签 */}
      <div className="flex items-center justify-between mb-3">
        <ContentTypeBadge type={item.content_type} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-100 rounded">
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={onDelete}>
              <Trash2 className="w-4 h-4 mr-2" />
              删除
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* 标题 */}
      <h3 className="font-semibold text-gray-900 dark:text-white mb-2 line-clamp-2">
        {item.title}
      </h3>

      {/* AI 摘要预览 */}
      {item.ai_summary && (
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 line-clamp-3">
          {item.ai_summary}
        </p>
      )}

      {/* 元信息 */}
      <div className="flex items-center gap-3 text-xs text-gray-400 mb-2">
        <span className="flex items-center gap-1">
          <FileText className="w-3 h-3" />
          {item.word_count.toLocaleString()} 字
        </span>
        {item.code_block_count > 0 && (
          <span className="flex items-center gap-1">
            <Code className="w-3 h-3" />
            {item.code_block_count} 代码块
          </span>
        )}
      </div>

      {/* 标签 */}
      {(item.ai_tags?.length > 0 || item.user_tags?.length > 0) && (
        <div className="flex flex-wrap gap-1 mb-2">
          {[...(item.ai_tags || []), ...(item.user_tags || [])].slice(0, 3).map(tag => (
            <span
              key={tag}
              className="px-2 py-0.5 text-xs bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 rounded"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* 时间 */}
      <div className="text-xs text-gray-400">
        {formatRelativeTime(item.created_at)}
      </div>
    </div>
  )
}

// 内容类型徽章
function ContentTypeBadge({ type }: { type: string | null }) {
  const config: Record<string, { label: string; color: string }> = {
    TUTORIAL: { label: '教程', color: 'bg-blue-100 text-blue-600' },
    CODE_SNIPPET: { label: '代码', color: 'bg-green-100 text-green-600' },
    ANALYSIS: { label: '分析', color: 'bg-amber-100 text-amber-600' },
    SUMMARY: { label: '摘要', color: 'bg-purple-100 text-purple-600' },
    QA: { label: '问答', color: 'bg-pink-100 text-pink-600' },
  }

  const { label, color } = config[type || ''] || { label: '文档', color: 'bg-gray-100 text-gray-600' }

  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded ${color}`}>
      📝 {label}
    </span>
  )
}
```

### 5.9 视图切换组件（v2.1 新增）

**设计理念**: 用户可根据偏好选择列表或卡片视图，记住用户选择

```typescript
// src/features/md-collections/components/md-view-toggle.tsx

type ViewMode = 'list' | 'card'

interface MdViewToggleProps {
  value: ViewMode
  onChange: (mode: ViewMode) => void
}

export function MdViewToggle({ value, onChange }: MdViewToggleProps) {
  return (
    <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
      <button
        onClick={() => onChange('list')}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
          value === 'list'
            ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
            : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
        )}
      >
        <List className="w-4 h-4" />
        列表
      </button>
      <button
        onClick={() => onChange('card')}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
          value === 'card'
            ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
            : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
        )}
      >
        <LayoutGrid className="w-4 h-4" />
        卡片
      </button>
    </div>
  )
}

// 使用 Hook 管理视图偏好
export function useMdViewPreference() {
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('md-view-mode') as ViewMode) || 'list'
    }
    return 'list'
  })

  const updateViewMode = useCallback((mode: ViewMode) => {
    setViewMode(mode)
    localStorage.setItem('md-view-mode', mode)
  }, [])

  return [viewMode, updateViewMode] as const
}
```

**卡片视图容器**:

```typescript
// src/features/md-collections/components/md-card-view.tsx

interface MdCardViewProps {
  items: MdCollection[]
  onItemClick: (id: number) => void
  onItemDelete?: (id: number) => void
}

export function MdCardView({ items, onItemClick, onItemDelete }: MdCardViewProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {items.map(item => (
        <MdCardItem
          key={item.id}
          item={item}
          onClick={() => onItemClick(item.id)}
          onDelete={onItemDelete ? () => onItemDelete(item.id) : undefined}
        />
      ))}
    </div>
  )
}
```

### 5.10 列表页完整布局（v2.1 更新）

```typescript
// src/features/md-collections/components/md-collection-page.tsx

export function MdCollectionPage() {
  const [viewMode, setViewMode] = useMdViewPreference()
  const [isPasteOpen, setIsPasteOpen] = useState(false)
  const { data: collections, isLoading } = useMdCollections()
  const router = useRouter()

  return (
    <div className="container mx-auto px-4 py-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <FileText className="w-6 h-6 text-purple-500" />
          <h1 className="text-xl font-bold">MD 收藏</h1>
          <span className="text-sm text-gray-400">
            {collections?.length || 0} 条
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* 视图切换 */}
          <MdViewToggle value={viewMode} onChange={setViewMode} />

          {/* 操作按钮 */}
          <button
            onClick={() => setIsPasteOpen(true)}
            className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors flex items-center gap-2"
          >
            <ClipboardPaste className="w-4 h-4" />
            粘贴内容
          </button>
          <button className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2">
            <Upload className="w-4 h-4" />
            上传
          </button>
        </div>
      </div>

      {/* 拖拽上传区 */}
      <MdUploadZone className="mb-6" />

      {/* 内容区域 */}
      {isLoading ? (
        <LoadingSpinner />
      ) : collections?.length === 0 ? (
        <MdEmptyState
          onPaste={() => setIsPasteOpen(true)}
          onUpload={() => {/* trigger upload */}}
        />
      ) : viewMode === 'list' ? (
        <MdListView
          items={collections}
          onItemClick={(id) => router.push(`/md-collections/${id}`)}
        />
      ) : (
        <MdCardView
          items={collections}
          onItemClick={(id) => router.push(`/md-collections/${id}`)}
        />
      )}

      {/* 粘贴对话框 */}
      <MdPasteDialog open={isPasteOpen} onOpenChange={setIsPasteOpen} />
    </div>
  )
}
```

---

## 六、Markdown 渲染组件

### 6.1 技术选型

```json
{
  "react-markdown": "^9.0.0",
  "remark-gfm": "^4.0.0",
  "rehype-sanitize": "^6.0.0",
  "rehype-slug": "^6.0.0",
  "rehype-autolink-headings": "^7.0.0",
  "react-syntax-highlighter": "^15.5.0"
}
```

### 6.2 阅读视图渲染器

```tsx
// src/components/markdown/markdown-renderer.tsx

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import { MarkdownCodeBlock } from "./markdown-code-block";
import { SANITIZE_SCHEMA } from "./sanitize-schema";

interface MarkdownRendererProps {
  content: string;
  className?: string;
  variant?: "default" | "reader" | "preview";
}

export function MarkdownRenderer({
  content,
  className,
  variant = "default",
}: MarkdownRendererProps) {
  return (
    <ReactMarkdown
      className={cn(
        // 基础 prose 样式
        "prose prose-gray dark:prose-invert max-w-none",
        // 阅读模式：更大字号、更舒适间距
        variant === "reader" && [
          "prose-lg",
          "prose-headings:scroll-mt-20",
          "prose-headings:font-semibold",
          "prose-p:leading-relaxed",
          "prose-li:leading-relaxed",
          "prose-a:text-purple-600 dark:prose-a:text-purple-400",
          "prose-a:no-underline hover:prose-a:underline",
          "prose-code:before:content-none prose-code:after:content-none",
          "prose-code:bg-gray-100 dark:prose-code:bg-gray-800",
          "prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded",
        ],
        // 预览模式：紧凑样式
        variant === "preview" && ["prose-sm", "line-clamp-6"],
        className,
      )}
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[
        [rehypeSanitize, SANITIZE_SCHEMA],
        rehypeSlug,
        [rehypeAutolinkHeadings, { behavior: "wrap" }],
      ]}
      components={{
        code: MarkdownCodeBlock,
        table: ({ children }) => (
          <div className="overflow-x-auto my-6 rounded-lg border border-gray-200 dark:border-gray-700">
            <table className="w-full">{children}</table>
          </div>
        ),
        img: ({ src, alt }) => (
          <img
            src={src}
            alt={alt || ""}
            className="rounded-lg max-w-full h-auto shadow-sm"
            loading="lazy"
          />
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-4 border-purple-500 bg-purple-50 dark:bg-purple-900/20 pl-4 py-2 my-4 rounded-r-lg">
            {children}
          </blockquote>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
```

### 6.3 代码块高亮组件

```tsx
// src/components/markdown/markdown-code-block.tsx

import { useState, useCallback } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Check, Copy } from "lucide-react";

interface CodeBlockProps {
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export function MarkdownCodeBlock({
  inline,
  className,
  children,
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  // 解析语言
  const match = /language-(\w+)/.exec(className || "");
  const language = match ? match[1] : "text";
  const code = String(children).replace(/\n$/, "");

  // 复制功能
  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  // 行内代码
  if (inline) {
    return (
      <code className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-sm font-mono text-purple-600 dark:text-purple-400">
        {children}
      </code>
    );
  }

  return (
    <div className="relative group my-6 rounded-lg overflow-hidden shadow-sm">
      {/* 顶部工具栏 */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        {/* 语言标签 */}
        <span className="text-xs text-gray-400 font-mono uppercase">
          {language}
        </span>

        {/* 复制按钮 */}
        <button
          onClick={handleCopy}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-all",
            copied
              ? "bg-green-500/20 text-green-400"
              : "bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-white",
          )}
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5" />
              已复制
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              复制
            </>
          )}
        </button>
      </div>

      {/* 代码区域 */}
      <SyntaxHighlighter
        style={oneDark}
        language={language}
        showLineNumbers
        customStyle={{
          margin: 0,
          borderRadius: 0,
          padding: "1rem",
          fontSize: "0.875rem",
        }}
        lineNumberStyle={{
          minWidth: "2.5em",
          paddingRight: "1em",
          color: "#6b7280",
          userSelect: "none",
        }}
        codeTagProps={{
          style: {
            fontFamily:
              "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          },
        }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}
```

---

## 七、AI 处理流程

### 7.1 异步处理流程

```
用户粘贴/上传/拖拽 Markdown
         │
         ▼
┌─────────────────┐
│ 1. 验证 + 去重  │ ← 检查 content_hash
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 2. 保存收藏    │ ← processing_status = 'pending'
│    (同步)       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 3. 返回响应    │ ← 用户立即看到收藏
└────────┬────────┘
         │
         │ (后台任务队列)
         ▼
┌─────────────────────────────────────────┐
│ 4. AI 处理 (Edge Function)              │
│    ├─ 提取纯文本（去除代码块）          │
│    ├─ 生成摘要                          │
│    ├─ 生成标签                          │
│    ├─ 检测内容类型                      │
│    └─ 生成向量 embedding                │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────┐
│ 5. 更新收藏    │ ← processing_status = 'completed'
└─────────────────┘
```

### 7.2 Markdown 预处理

````typescript
// src/features/md-collections/lib/md-processor.ts

export function preprocessMarkdownForAI(content: string): {
  processedText: string;
  metadata: {
    wordCount: number;
    codeBlockCount: number;
    readingTimeMinutes: number;
    extractedTitle: string | null;
  };
} {
  let processedText = content;

  // 1. 提取标题
  const titleMatch = content.match(/^#\s+(.+)$/m);
  const extractedTitle = titleMatch ? titleMatch[1].trim() : null;

  // 2. 统计代码块
  const codeBlocks = content.match(/```[\s\S]*?```/g) || [];
  const codeBlockCount = codeBlocks.length;

  // 3. 替换代码块为占位符（减少 token）
  processedText = processedText.replace(
    /```(\w+)?\n[\s\S]*?```/g,
    (_, lang) => `[代码块: ${lang || "代码"}]`,
  );

  // 4. 替换行内代码
  processedText = processedText.replace(/`[^`]+`/g, "[代码]");

  // 5. 计算字数
  const pureText = processedText
    .replace(/\[代码块:.*?\]/g, "")
    .replace(/\[代码\]/g, "")
    .trim();

  const wordCount = countWords(pureText);
  const readingTimeMinutes = Math.ceil(wordCount / 200);

  return {
    processedText: processedText.trim(),
    metadata: {
      wordCount,
      codeBlockCount,
      readingTimeMinutes,
      extractedTitle,
    },
  };
}

function countWords(text: string): number {
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const englishWords = text
    .replace(/[\u4e00-\u9fa5]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0).length;

  return chineseChars + englishWords;
}
````

---

## 八、安全设计

### 8.1 XSS 防护配置

```typescript
// src/components/markdown/sanitize-schema.ts

import { defaultSchema } from "rehype-sanitize";

export const SANITIZE_SCHEMA = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames || []),
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "p",
    "br",
    "hr",
    "ul",
    "ol",
    "li",
    "blockquote",
    "pre",
    "code",
    "table",
    "thead",
    "tbody",
    "tr",
    "th",
    "td",
    "a",
    "img",
    "strong",
    "em",
    "del",
    "s",
    "mark",
    "details",
    "summary",
    "sup",
    "sub",
  ],
  attributes: {
    ...defaultSchema.attributes,
    code: ["className"],
    a: ["href", "title"],
    img: ["src", "alt", "title"],
    th: ["align"],
    td: ["align"],
  },
  protocols: {
    href: ["http", "https", "mailto"],
    src: ["http", "https", "data"],
  },
};
```

### 8.2 内容限制

```typescript
// src/features/md-collections/constants/index.ts

export const MD_COLLECTION_LIMITS = {
  maxContentLength: 100 * 1024, // 100KB
  maxTitleLength: 500,
  maxFileSize: 1 * 1024 * 1024, // 1MB
  maxTagCount: 10,
  maxTagLength: 20,
};
```

---

## 九、实施计划

### 9.1 子任务分解

| 子任务ID  | 任务内容                                | 工时  | 依赖                |
| --------- | --------------------------------------- | ----- | ------------------- |
| P2-007-1  | 数据库 Schema（独立 md_collections 表） | 0.5d  | -                   |
| P2-007-2  | 功能模块目录结构搭建                    | 0.25d | -                   |
| P2-007-3  | API 路由：创建/列表/详情                | 1d    | P2-007-1            |
| P2-007-4  | API 路由：文件上传/去重检测             | 0.5d  | P2-007-1            |
| P2-007-5  | 侧边栏菜单集成                          | 0.25d | -                   |
| P2-007-6  | MD 列表页面                             | 1d    | P2-007-3            |
| P2-007-7  | 拖拽上传区组件                          | 0.5d  | P2-007-4            |
| P2-007-8  | 粘贴对话框组件                          | 0.5d  | P2-007-3            |
| P2-007-9  | Markdown 渲染组件（共享）               | 1d    | -                   |
| P2-007-10 | 代码块高亮 + 复制                       | 0.5d  | P2-007-9            |
| P2-007-11 | **专业阅读视图页面**                    | 1d    | P2-007-9, P2-007-10 |
| P2-007-12 | AI 摘要/标签生成适配                    | 0.5d  | P2-007-3            |
| P2-007-13 | 功能开关门控                            | 0.25d | -                   |
| P2-007-14 | 卡片视图组件（v2.1 新增）               | 0.5d  | P2-007-6            |
| P2-007-15 | 视图切换功能（v2.1 新增）               | 0.25d | P2-007-14           |
| P2-007-16 | 标签库共享 API（v2.1 新增）             | 0.25d | P2-007-3            |
| P2-007-17 | 集成测试                                | 0.5d  | All                 |

**总计**: 9 天

### 9.2 关键风险与缓解

| 风险                 | 可能性 | 影响 | 缓解措施                        |
| -------------------- | ------ | ---- | ------------------------------- |
| XSS 注入             | 中     | 高   | rehype-sanitize 白名单 + CSP 头 |
| 内容过大影响性能     | 中     | 中   | 虚拟滚动 + 懒加载               |
| AI 处理成本高        | 低     | 中   | 代码块预处理减少 token          |
| 功能蔓延（想做编辑） | 中     | 中   | 严格功能边界 + 代码审查         |
| 模块耦合             | 低     | 高   | 独立目录 + 独立表 + 统一导出    |

---

## 十、验收标准

### 10.1 功能验收

- [ ] 侧边栏显示「MD收藏」菜单项（带 Pro 标签）
- [ ] 支持粘贴 Markdown 文本收藏
- [ ] 支持上传 .md 文件收藏
- [ ] **支持拖拽 .md 文件收藏**
- [ ] **专业阅读视图**（优美排版、代码高亮、一键复制）
- [ ] AI 自动生成摘要和标签
- [ ] 可通过语义搜索找到 MD 内容
- [ ] Pro 专属功能，免费用户看到升级引导

### 10.1.1 v2.1 新增验收项

- [ ] **视图切换**：支持列表/卡片视图切换
- [ ] **卡片视图**：展示内容类型徽章、标题、摘要、标签、元信息
- [ ] **视图偏好**：用户视图选择自动持久化（localStorage）
- [ ] **标签系统**：支持 AI 标签和用户标签
- [ ] **标签库共享**：可从 bookmarks 历史标签中选择
- [ ] **文件夹分类**：创建时可选择目标文件夹
- [ ] **按标签筛选**：列表页支持标签筛选功能

### 10.2 模块解耦验收

- [ ] 所有代码位于 `src/features/md-collections/`
- [ ] 使用独立数据表 `md_collections`
- [ ] 功能开关可独立控制
- [ ] 不影响现有 bookmarks 功能
- [ ] 可单独删除模块而不破坏其他功能

### 10.3 阅读体验验收

- [ ] 排版美观（prose 样式、合适行高、65ch 宽度）
- [ ] 代码块语法高亮（支持 20+ 语言）
- [ ] 代码块一键复制（带视觉反馈）
- [ ] 响应式设计（移动端适配）
- [ ] 暗色模式支持

### 10.4 安全验收

- [ ] 无 XSS 安全漏洞
- [ ] 内容大小限制生效
- [ ] 配额限制正确执行

---

## 十一、回滚策略

如果 MD 功能导致问题：

1. **数据层**: 独立表 `md_collections`，不影响 `bookmarks`
2. **前端**: 隐藏菜单项，功能完全不可见
3. **API**: 返回 `{ error: "FEATURE_DISABLED" }`
4. **代码**: 可直接删除 `src/features/md-collections/` 目录

---

## 附录

### A. 依赖包清单

```json
{
  "react-markdown": "^9.0.0",
  "remark-gfm": "^4.0.0",
  "rehype-sanitize": "^6.0.0",
  "rehype-slug": "^6.0.0",
  "rehype-autolink-headings": "^7.0.0",
  "react-syntax-highlighter": "^15.5.0"
}
```

### B. 新增文件清单

```
新增文件:
src/features/md-collections/                    # 功能模块目录（完全独立）
├── components/
│   ├── md-collection-page.tsx
│   ├── md-reader-view.tsx
│   ├── md-upload-zone.tsx
│   ├── md-paste-dialog.tsx
│   ├── md-list-view.tsx
│   ├── md-card-view.tsx                        # v2.1 新增
│   ├── md-card-item.tsx
│   ├── md-view-toggle.tsx                      # v2.1 新增
│   ├── md-empty-state.tsx
│   └── index.ts
├── lib/
│   ├── md-parser.ts
│   ├── md-sanitizer.ts
│   ├── md-processor.ts
│   ├── feature-gate.ts
│   ├── tag-library.ts                          # v2.1 新增：标签库共享
│   └── index.ts
├── hooks/
│   ├── use-md-collections.ts
│   ├── use-md-upload.ts
│   ├── use-md-view-preference.ts               # v2.1 新增：视图偏好
│   └── index.ts
├── types/
│   └── index.ts
├── constants/
│   └── index.ts
└── index.ts

src/components/markdown/                        # 共享渲染组件
├── markdown-renderer.tsx
├── markdown-code-block.tsx
├── sanitize-schema.ts
└── index.ts

src/app/(main)/md-collections/                  # 路由页面
├── page.tsx                                    # 列表页
└── [id]/
    └── page.tsx                                # 阅读页

src/app/api/md-collections/                     # API 路由
├── route.ts
├── [id]/route.ts
├── upload/route.ts
├── check-duplicate/route.ts
└── search/route.ts

supabase/migrations/
└── 20251220000001_create_md_collections.sql

修改文件:
- src/components/layout/app-sidebar.tsx         # 添加菜单项
```

---

**文档状态**: 📝 待审核 (v2.1)
**制定者**: Claude
**审核者**: [待填写]

**v2.0 更新说明**:

- ✅ 完全解耦架构（独立模块目录）
- ✅ 独立数据表（md_collections）
- ✅ 独立页面（/md-collections）
- ✅ 侧边栏菜单入口
- ✅ 拖拽上传支持
- ✅ 专业阅读视图设计
- ✅ 功能开关门控（付费功能）
- ✅ 工时更新为 8 天

**v2.1 更新说明**:

- ✅ 标签系统集成（方案 B：标签库共享）
- ✅ 卡片视图组件设计（md-card-view.tsx, md-card-item.tsx）
- ✅ 视图切换功能（列表/卡片，带偏好持久化）
- ✅ 内容类型徽章（TUTORIAL/CODE_SNIPPET/ANALYSIS 等）
- ✅ 文件夹分类支持确认
- ✅ AI 能力支持确认（摘要、标签、语义搜索）
- ✅ 新增 3 个子任务（P2-007-14 ~ P2-007-16）
- ✅ 新增 7 个验收项
- ✅ 工时更新为 9 天
