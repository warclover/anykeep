# AnyKeep MVP 产品需求文档（AI开发版 - Supabase技术栈）

**版本**: V4.2-AI-Supabase
**日期**: 2025-11-25
**状态**: 开发中
**目标**: 为AI辅助开发提供清晰、可执行的产品需求（设计师转全栈专用版）

---

## 📝 版本更新记录

| 版本 | 日期 | 更新内容 |
|------|------|----------|
| V1.0 | 2025-01-XX | 初始版本 |
| V4.2 | 2025-11-25 | 新增智能分类系统需求（临时文件夹、自动归类、智能更新、思维导图索引） |

---

## 📋 文档导航

1. [产品概述](#1-产品概述)
2. [核心功能清单](#2-核心功能清单)
3. [数据模型](#3-数据模型)
4. [API接口规范](#4-api接口规范)
5. [用户故事与验收标准](#5-用户故事与验收标准)
6. [技术实现要求](#6-技术实现要求)
7. [测试用例](#7-测试用例)
8. [开发优先级](#8-开发优先级)

---

## 1. 产品概述

### 1.1 产品定位

**AnyKeep** 是一款跨平台智能内容聚合工具，帮助用户统一管理微信、B站、小红书等平台的收藏内容。

**MVP核心功能**：
- ✅ 用户注册/登录
- ✅ 3个平台支持（微信公众号、B站、小红书）
- ✅ 一键收藏（系统分享菜单）
- ✅ 基础搜索（关键词）
- ✅ 文件夹/标签管理
- ✅ 跨设备同步

### 1.2 技术栈（设计师转全栈专用版）

#### 1.2.1 前端技术栈

**框架**: Next.js 14+ (App Router)
- **理由**: 全球最主流的 React 框架，AI 训练数据最丰富，Claude 写 Next.js 代码几乎不出错
- **特性**: Server Components、RSC、文件路由

**样式库**: Tailwind CSS
- **理由**: 不需要写传统 CSS 文件，直接用自然语言让 AI 写"圆角红色按钮"即可生成代码
- **特性**: 原子化CSS、JIT编译、响应式设计

**UI 组件库**: Shadcn UI
- **理由**: 关键选择。它有对应的 Figma Kit，您可以实现"Figma 设计 -> AI 代码"的像素级复刻
- **特性**: 基于 Radix UI、可定制、TypeScript支持

#### 1.2.2 后端技术栈

**核心平台**: Supabase
- **数据库**: PostgreSQL（内置）+ pgvector（向量搜索插件）
- **文件存储**: Supabase Storage（图片和封面存储）
- **身份认证**: Supabase Auth（登录/注册/微信登录）
- **实时功能**: Supabase Realtime（实时同步）

**理由**: 
- 零服务器运维，不需要买云服务器，不需要配 Nginx
- AI 写 SQL 非常强，不用手动建表
- pgvector 直接解决 AnyKeep 的核心"语义搜索"需求，无需额外部署 Milvus

#### 1.2.3 逻辑层技术栈

**运行环境**: Supabase Edge Functions (Deno/TypeScript)
- **用途**: 爬虫服务、AI调用（DeepSeek/OpenAI）
- **理由**: 零服务器运维。只写一个函数（如 crawl-url），上传到 Supabase 即可运行

#### 1.2.4 移动端技术栈

**工具**: Capacitor
- **理由**: 降维打击。先把 Next.js 网页版做好，然后用 Capacitor 一键"套壳"生成 Android APK 和 iOS IPA
- **特性**: 原生插件支持、PWA兼容

---

## 2. 核心功能清单

### 2.1 功能模块总览

| 模块 | 功能点 | 优先级 | 状态 |
|------|--------|--------|------|
| **用户系统** | 注册/登录（Supabase Auth） | P0 | ✅ |
| | 用户信息管理 | P0 | ✅ |
| **平台授权** | 微信授权 | P0 | ⏳ |
| | B站授权 | P0 | ⏳ |
| | 小红书授权 | P0 | ⏳ |
| **内容收藏** | 一键收藏 | P0 | ⏳ |
| | 元数据提取（Edge Function） | P0 | ⏳ |
| | AI摘要生成（Edge Function） | P1 | ⏳ |
| | AI标签生成（Edge Function） | P1 | ⏳ |
| **内容管理** | 文件夹管理 | P0 | ⏳ |
| | 标签管理 | P0 | ⏳ |
| | 收藏列表 | P0 | ⏳ |
| | 收藏详情 | P0 | ⏳ |
| **搜索功能** | 关键词搜索 | P0 | ⏳ |
| | 语义搜索（pgvector） | P1 | ⏳ |
| | 筛选功能 | P0 | ⏳ |
| **同步功能** | 跨设备同步（Supabase Realtime） | P0 | ⏳ |
| **智能分类** | 默认临时文件夹（待整理） | P0 | ⏳ |
| | 自动归类（置信度分层） | P0 | ⏳ |
| | 智能更新分类（定时/定量触发） | P1 | 🔜 |
| | 思维导图式索引可视化 | P2 | 🔜 |

---

## 3. 数据模型

### 3.1 Supabase 数据库设计

#### 3.1.1 用户表 (users)

**说明**: Supabase Auth 自动管理用户表（auth.users），我们只需要创建扩展表（public.profiles）

```sql
-- 用户扩展表（关联 auth.users）
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    phone VARCHAR(20) UNIQUE,
    nickname VARCHAR(50),
    avatar_url TEXT,
    membership_type VARCHAR(20) DEFAULT 'FREE', -- FREE, PRO
    storage_quota INT DEFAULT 500,
    storage_used INT DEFAULT 0,
    settings JSONB DEFAULT '{"theme": "auto", "auto_tag": true}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 启用 Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 用户只能查看和更新自己的资料
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);
```

**字段说明**：
- `id`: 关联 auth.users.id（UUID）
- `membership_type`: 会员类型（FREE免费，PRO付费）
- `storage_quota`: 存储配额（免费用户500条）
- `storage_used`: 已使用数量

---

#### 3.1.2 收藏表 (bookmarks)

```sql
CREATE TABLE public.bookmarks (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- 基础信息
    title VARCHAR(500) NOT NULL,
    url TEXT NOT NULL,
    description TEXT,
    cover_url TEXT, -- Supabase Storage URL
    
    -- 平台信息
    platform VARCHAR(50) NOT NULL, -- WECHAT_OFFICIAL_ACCOUNT, BILIBILI, XIAOHONGSHU
    platform_content_id VARCHAR(200),
    
    -- AI生成内容
    ai_summary TEXT, -- AI生成的摘要（50字内）
    ai_tags TEXT[], -- AI生成的标签数组
    
    -- 用户管理
    folder_id BIGINT REFERENCES folders(id) ON DELETE SET NULL,
    user_tags TEXT[], -- 用户手动添加的标签
    notes TEXT, -- 用户备注
    
    -- 元数据
    author VARCHAR(200),
    publish_time TIMESTAMP WITH TIME ZONE,
    content_type VARCHAR(50), -- ARTICLE, VIDEO, IMAGE
    
    -- 向量搜索（pgvector）
    embedding vector(1536), -- OpenAI embedding向量
    
    -- 状态
    status VARCHAR(20) DEFAULT 'PROCESSING', -- PROCESSING, COMPLETED, FAILED
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- 启用 RLS
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;

-- 用户只能查看自己的收藏
CREATE POLICY "Users can view own bookmarks" ON public.bookmarks
    FOR SELECT USING (auth.uid() = user_id AND deleted_at IS NULL);

-- 用户只能创建自己的收藏
CREATE POLICY "Users can create own bookmarks" ON public.bookmarks
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 用户只能更新自己的收藏
CREATE POLICY "Users can update own bookmarks" ON public.bookmarks
    FOR UPDATE USING (auth.uid() = user_id);

-- 用户只能删除自己的收藏
CREATE POLICY "Users can delete own bookmarks" ON public.bookmarks
    FOR DELETE USING (auth.uid() = user_id);

-- 索引
CREATE INDEX idx_bookmarks_user_id ON public.bookmarks(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_bookmarks_platform ON public.bookmarks(platform) WHERE deleted_at IS NULL;
CREATE INDEX idx_bookmarks_folder_id ON public.bookmarks(folder_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_bookmarks_created_at ON public.bookmarks(created_at DESC) WHERE deleted_at IS NULL;

-- 全文搜索索引（PostgreSQL 内置）
CREATE INDEX idx_bookmarks_title_gin ON public.bookmarks USING gin(to_tsvector('jiebacfg', title));
CREATE INDEX idx_bookmarks_description_gin ON public.bookmarks USING gin(to_tsvector('jiebacfg', description));

-- 向量搜索索引（pgvector）
CREATE INDEX idx_bookmarks_embedding ON public.bookmarks USING hnsw (embedding vector_cosine_ops);
```

**字段说明**：
- `user_id`: 关联 auth.users.id（UUID）
- `platform`: 平台类型（枚举值）
- `ai_summary`: AI生成的摘要
- `ai_tags`: AI生成的标签数组
- `embedding`: 向量嵌入（用于语义搜索）
- `cover_url`: Supabase Storage URL

---

#### 3.1.3 文件夹表 (folders)

```sql
CREATE TABLE public.folders (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    parent_id BIGINT REFERENCES folders(id) ON DELETE CASCADE,
    sort_order INT DEFAULT 0,
    is_system BOOLEAN DEFAULT FALSE,  -- V4.2新增：系统文件夹标识（如"待整理"）
    system_type VARCHAR(50),          -- V4.2新增：系统文件夹类型（INBOX等）
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- 启用 RLS
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;

-- 用户只能管理自己的文件夹
CREATE POLICY "Users can manage own folders" ON public.folders
    FOR ALL USING (auth.uid() = user_id AND deleted_at IS NULL);

-- 索引
CREATE INDEX idx_folders_user_id ON public.folders(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_folders_system ON public.folders(user_id, is_system) WHERE deleted_at IS NULL;
```

**V4.2 新增字段说明**：
- `is_system`: 系统文件夹标识，系统文件夹不可删除、不可重命名
- `system_type`: 系统文件夹类型
  - `INBOX`: 待整理文件夹（默认临时文件夹）

---

#### 3.1.4 平台授权表 (platform_authorizations)

```sql
CREATE TABLE public.platform_authorizations (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL, -- WECHAT, BILIBILI, XIAOHONGSHU
    access_token TEXT,
    refresh_token TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'ACTIVE', -- ACTIVE, EXPIRED, REVOKED
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id, platform)
);

-- 启用 RLS
ALTER TABLE public.platform_authorizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own authorizations" ON public.platform_authorizations
    FOR ALL USING (auth.uid() = user_id);
```

---

### 3.2 Supabase Storage 配置

**存储桶设计**:
- `covers`: 收藏封面图片
- `avatars`: 用户头像

**访问策略**:
```sql
-- 用户只能上传自己的封面
CREATE POLICY "Users can upload own covers" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'covers' AND
        auth.uid()::text = (storage.foldername(name))[1]
    );

-- 用户只能查看自己的封面
CREATE POLICY "Users can view own covers" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'covers' AND
        auth.uid()::text = (storage.foldername(name))[1]
    );
```

---

## 4. API接口规范

### 4.1 Supabase 客户端使用

**Next.js 客户端初始化**:
```typescript
// lib/supabase/client.ts
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Database } from '@/types/supabase'

export const supabase = createClientComponentClient<Database>()
```

**服务端初始化**:
```typescript
// lib/supabase/server.ts
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export const supabase = createServerComponentClient<Database>({ cookies })
```

---

### 4.2 认证接口（Supabase Auth）

#### 4.2.1 用户注册

**实现方式**: 使用 Supabase Auth

```typescript
// app/api/auth/register/route.ts
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function POST(request: Request) {
  const supabase = createRouteHandlerClient({ cookies })
  const { email, password, phone } = await request.json()

  // 注册用户
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    phone,
  })

  if (error) {
    return Response.json({ code: 400, message: error.message }, { status: 400 })
  }

  // 创建用户扩展资料
  const { error: profileError } = await supabase
    .from('profiles')
    .insert({
      id: data.user!.id,
      phone,
      membership_type: 'FREE',
      storage_quota: 500,
      storage_used: 0,
    })

  return Response.json({
    code: 200,
    message: '注册成功',
    data: {
      userId: data.user!.id,
      user: data.user,
    },
  })
}
```

**响应数据**:
```json
{
  "code": 200,
  "message": "注册成功",
  "data": {
    "userId": "uuid",
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "phone": "13800138000"
    }
  }
}
```

---

#### 4.2.2 用户登录

```typescript
// app/api/auth/login/route.ts
export async function POST(request: Request) {
  const supabase = createRouteHandlerClient({ cookies })
  const { email, password } = await request.json()

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return Response.json({ code: 401, message: error.message }, { status: 401 })
  }

  // 获取用户资料
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', data.user.id)
    .single()

  return Response.json({
    code: 200,
    message: '登录成功',
    data: {
      userId: data.user.id,
      user: { ...data.user, ...profile },
    },
  })
}
```

---

### 4.3 收藏接口（Supabase REST API）

#### 4.3.1 创建收藏

**接口**: `POST /api/bookmarks`

**实现方式**: Next.js API Route + Supabase Edge Function

```typescript
// app/api/bookmarks/route.ts
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function POST(request: Request) {
  const supabase = createRouteHandlerClient({ cookies })
  
  // 获取当前用户
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ code: 401, message: '未授权' }, { status: 401 })
  }

  const { url, folderId, tags, notes } = await request.json()

  // 检查存储配额
  const { data: profile } = await supabase
    .from('profiles')
    .select('storage_quota, storage_used')
    .eq('id', user.id)
    .single()

  if (profile!.storage_used >= profile!.storage_quota) {
    return Response.json(
      { code: 1001, message: '存储空间不足，请升级会员' },
      { status: 400 }
    )
  }

  // 创建收藏记录
  const { data: bookmark, error } = await supabase
    .from('bookmarks')
    .insert({
      user_id: user.id,
      url,
      title: '处理中...', // 临时标题
      status: 'PROCESSING',
      folder_id: folderId,
      user_tags: tags,
      notes,
    })
    .select()
    .single()

  if (error) {
    return Response.json({ code: 500, message: error.message }, { status: 500 })
  }

  // 调用 Edge Function 异步处理
  const { error: functionError } = await supabase.functions.invoke('crawl-content', {
    body: { bookmarkId: bookmark.id, url },
  })

  return Response.json({
    code: 200,
    message: '收藏成功，正在处理...',
    data: bookmark,
  })
}
```

**请求参数**:
```json
{
  "url": "https://mp.weixin.qq.com/s/xxxxx",
  "folderId": 1,
  "tags": ["工作", "产品"],
  "notes": "这是一篇关于产品的文章"
}
```

**响应数据**:
```json
{
  "code": 200,
  "message": "收藏成功，正在处理...",
  "data": {
    "id": 1,
    "title": "处理中...",
    "url": "https://mp.weixin.qq.com/s/xxxxx",
    "platform": "WECHAT_OFFICIAL_ACCOUNT",
    "status": "PROCESSING",
    "created_at": "2025-01-20T10:00:00Z"
  }
}
```

---

#### 4.3.2 获取收藏列表

**接口**: `GET /api/bookmarks?page=1&size=20&platform=BILIBILI`

**实现方式**: 直接使用 Supabase 查询

```typescript
// app/api/bookmarks/route.ts
export async function GET(request: Request) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return Response.json({ code: 401, message: '未授权' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') || '1')
  const size = parseInt(searchParams.get('size') || '20')
  const platform = searchParams.get('platform')
  const folderId = searchParams.get('folderId')
  const keyword = searchParams.get('keyword')

  // 构建查询
  let query = supabase
    .from('bookmarks')
    .select('*, folders(name)', { count: 'exact' })
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range((page - 1) * size, page * size - 1)

  // 筛选条件
  if (platform) {
    query = query.eq('platform', platform)
  }
  if (folderId) {
    query = query.eq('folder_id', folderId)
  }
  if (keyword) {
    query = query.or(`title.ilike.%${keyword}%,description.ilike.%${keyword}%`)
  }

  const { data, error, count } = await query

  if (error) {
    return Response.json({ code: 500, message: error.message }, { status: 500 })
  }

  return Response.json({
    code: 200,
    message: '查询成功',
    data: {
      list: data,
      pagination: {
        page,
        size,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / size),
      },
    },
  })
}
```

---

#### 4.3.3 搜索收藏（语义搜索）

**接口**: `POST /api/bookmarks/search`

**实现方式**: 使用 pgvector 向量搜索

```typescript
// app/api/bookmarks/search/route.ts
export async function POST(request: Request) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return Response.json({ code: 401, message: '未授权' }, { status: 401 })
  }

  const { query, mode = 'HYBRID', platform, folderId, page = 1, size = 20 } = await request.json()

  if (mode === 'SEMANTIC' || mode === 'HYBRID') {
    // 1. 生成查询向量（调用 Edge Function）
    const { data: embeddingData } = await supabase.functions.invoke('generate-embedding', {
      body: { text: query },
    })

    // 2. 向量搜索
    const { data: semanticResults } = await supabase.rpc('search_bookmarks_semantic', {
      query_embedding: embeddingData.embedding,
      user_id: user.id,
      match_threshold: 0.7,
      match_count: size,
    })

    // 3. 如果混合搜索，结合关键词搜索
    if (mode === 'HYBRID') {
      const { data: keywordResults } = await supabase
        .from('bookmarks')
        .select('*')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
        .limit(size)

      // 合并结果并去重
      const combined = [...semanticResults, ...keywordResults]
      const unique = Array.from(new Map(combined.map(item => [item.id, item])).values())

      return Response.json({
        code: 200,
        message: '搜索成功',
        data: {
          list: unique.slice(0, size),
          pagination: { page, size, total: unique.length },
        },
      })
    }

    return Response.json({
      code: 200,
      message: '搜索成功',
      data: {
        list: semanticResults,
        pagination: { page, size, total: semanticResults.length },
      },
    })
  } else {
    // 关键词搜索
    const { data, error } = await supabase
      .from('bookmarks')
      .select('*')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
      .order('created_at', { ascending: false })
      .range((page - 1) * size, page * size - 1)

    return Response.json({
      code: 200,
      message: '搜索成功',
      data: {
        list: data || [],
        pagination: { page, size, total: data?.length || 0 },
      },
    })
  }
}
```

**数据库函数（pgvector搜索）**:
```sql
-- 创建向量搜索函数
CREATE OR REPLACE FUNCTION search_bookmarks_semantic(
  query_embedding vector(1536),
  user_id uuid,
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id bigint,
  title varchar,
  url text,
  description text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.id,
    b.title,
    b.url,
    b.description,
    1 - (b.embedding <=> query_embedding) as similarity
  FROM bookmarks b
  WHERE b.user_id = search_bookmarks_semantic.user_id
    AND b.deleted_at IS NULL
    AND b.embedding IS NOT NULL
    AND 1 - (b.embedding <=> query_embedding) > match_threshold
  ORDER BY b.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

---

### 4.4 Supabase Edge Functions

#### 4.4.1 爬取内容函数

**文件**: `supabase/functions/crawl-content/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

serve(async (req) => {
  const { bookmarkId, url } = await req.json()
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    // 1. 识别平台
    const platform = detectPlatform(url)

    // 2. 爬取内容
    const metadata = await crawlContent(url, platform)

    // 3. 调用AI生成摘要和标签
    const { summary, tags } = await generateAIContent(metadata.title, metadata.description)

    // 4. 生成向量嵌入
    const embedding = await generateEmbedding(`${metadata.title} ${summary}`)

    // 5. 上传封面到 Supabase Storage（如果有）
    let coverUrl = null
    if (metadata.coverImage) {
      const { data: uploadData } = await supabase.storage
        .from('covers')
        .upload(`${bookmarkId}/${Date.now()}.jpg`, metadata.coverImage, {
          contentType: 'image/jpeg',
        })
      coverUrl = uploadData?.path
    }

    // 6. 更新收藏记录
    const { error } = await supabase
      .from('bookmarks')
      .update({
        title: metadata.title,
        description: metadata.description,
        cover_url: coverUrl,
        platform: platform,
        platform_content_id: metadata.contentId,
        author: metadata.author,
        publish_time: metadata.publishTime,
        content_type: metadata.contentType,
        ai_summary: summary,
        ai_tags: tags,
        embedding: embedding,
        status: 'COMPLETED',
        updated_at: new Date().toISOString(),
      })
      .eq('id', bookmarkId)

    // 7. 更新用户存储使用量
    await supabase.rpc('increment_storage_used', { user_id: metadata.userId })

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    // 更新状态为失败
    await supabase
      .from('bookmarks')
      .update({ status: 'FAILED' })
      .eq('id', bookmarkId)

    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})

// 辅助函数
function detectPlatform(url: string): string {
  if (url.includes('mp.weixin.qq.com')) return 'WECHAT_OFFICIAL_ACCOUNT'
  if (url.includes('bilibili.com')) return 'BILIBILI'
  if (url.includes('xiaohongshu.com')) return 'XIAOHONGSHU'
  return 'UNKNOWN'
}

async function crawlContent(url: string, platform: string) {
  // 实现爬虫逻辑
  // 返回 { title, description, coverImage, author, publishTime, contentType, contentId }
}

async function generateAIContent(title: string, description: string) {
  // 调用 OpenAI/DeepSeek API
  // 返回 { summary, tags }
}

async function generateEmbedding(text: string) {
  // 调用 OpenAI Embedding API
  // 返回向量数组
}
```

---

#### 4.4.2 生成向量嵌入函数

**文件**: `supabase/functions/generate-embedding/index.ts`

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

serve(async (req) => {
  const { text } = await req.json()
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!

  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-ada-002',
      input: text,
    }),
  })

  const data = await response.json()
  return new Response(JSON.stringify({ embedding: data.data[0].embedding }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
```

---

## 5. 用户故事与验收标准

### 5.1 用户注册（Supabase Auth）

**用户故事**:
> 作为新用户，我希望能够通过邮箱/手机号注册账号，以便使用AnyKeep服务。

**验收标准**:
- [ ] 用户可以通过邮箱+密码注册
- [ ] 用户可以通过手机号+验证码注册
- [ ] Supabase Auth 自动处理验证邮件/短信
- [ ] 注册成功后自动创建 profiles 记录
- [ ] 返回用户信息和 session token

**实现代码**:
```typescript
// app/register/page.tsx (Next.js + Shadcn UI)
'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

export default function RegisterPage() {
  const supabase = createClientComponentClient()

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault()
    const { data, error } = await supabase.auth.signUp({
      email: formData.email,
      password: formData.password,
    })
    // 处理结果...
  }

  return (
    <form onSubmit={handleRegister}>
      <Input type="email" placeholder="邮箱" />
      <Input type="password" placeholder="密码" />
      <Button type="submit">注册</Button>
    </form>
  )
}
```

---

### 5.2 一键收藏

**用户故事**:
> 作为用户，我希望能够通过系统分享菜单一键收藏内容，以便快速保存感兴趣的内容。

**验收标准**:
- [ ] 用户可以通过系统分享菜单选择AnyKeep
- [ ] 自动识别平台（微信/B站/小红书）
- [ ] 创建收藏记录（状态：PROCESSING）
- [ ] 调用 Edge Function 异步处理
- [ ] 处理完成后更新状态（COMPLETED）
- [ ] 检查存储配额（免费用户500条）

**实现代码**:
```typescript
// app/api/bookmarks/route.ts (已在上文提供)
```

---

## 6. 技术实现要求

### 6.1 前端实现（Next.js + Tailwind + Shadcn UI）

#### 6.1.1 项目结构

```
anykeep/
├── app/                    # Next.js App Router
│   ├── (auth)/            # 认证相关页面
│   │   ├── login/
│   │   └── register/
│   ├── (main)/            # 主应用页面
│   │   ├── home/          # 首页（收藏列表）
│   │   ├── bookmark/[id]/ # 收藏详情
│   │   ├── search/        # 搜索页
│   │   └── folders/       # 文件夹管理
│   ├── api/               # API Routes
│   │   ├── auth/
│   │   ├── bookmarks/
│   │   └── search/
│   └── layout.tsx
├── components/            # React 组件
│   ├── ui/               # Shadcn UI 组件
│   ├── bookmark/         # 收藏相关组件
│   └── layout/           # 布局组件
├── lib/                  # 工具函数
│   ├── supabase/         # Supabase 客户端
│   └── utils.ts
├── types/                # TypeScript 类型
│   └── supabase.ts       # Supabase 类型生成
└── tailwind.config.js
```

#### 6.1.2 Shadcn UI 组件使用

```typescript
// components/bookmark/bookmark-card.tsx
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export function BookmarkCard({ bookmark }) {
  return (
    <Card className="rounded-lg border shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">{bookmark.title}</CardTitle>
        <CardDescription>{bookmark.ai_summary}</CardDescription>
        <div className="flex gap-2 mt-2">
          {bookmark.ai_tags.map(tag => (
            <Badge key={tag} variant="secondary">{tag}</Badge>
          ))}
        </div>
      </CardHeader>
    </Card>
  )
}
```

---

### 6.2 后端实现（Supabase）

#### 6.2.1 数据库迁移

**使用 Supabase CLI**:
```bash
# 初始化 Supabase 项目
supabase init

# 创建迁移文件
supabase migration new create_bookmarks_table

# 应用迁移
supabase db push
```

#### 6.2.2 Edge Functions 部署

```bash
# 创建 Edge Function
supabase functions new crawl-content

# 部署到 Supabase
supabase functions deploy crawl-content
```

---

### 6.3 移动端打包（Capacitor）

#### 6.3.1 安装 Capacitor

```bash
npm install @capacitor/core @capacitor/cli
npm install @capacitor/ios @capacitor/android

# 初始化
npx cap init
```

#### 6.3.2 构建和打包

```bash
# 构建 Next.js
npm run build

# 同步到 Capacitor
npx cap sync

# 打开 iOS/Android 项目
npx cap open ios
npx cap open android
```

---

## 7. 测试用例

### 7.1 前端测试（Next.js）

```typescript
// __tests__/bookmark-card.test.tsx
import { render, screen } from '@testing-library/react'
import { BookmarkCard } from '@/components/bookmark/bookmark-card'

test('renders bookmark card', () => {
  const bookmark = {
    id: 1,
    title: '测试标题',
    ai_summary: '测试摘要',
    ai_tags: ['标签1', '标签2'],
  }
  
  render(<BookmarkCard bookmark={bookmark} />)
  
  expect(screen.getByText('测试标题')).toBeInTheDocument()
  expect(screen.getByText('测试摘要')).toBeInTheDocument()
})
```

---

### 7.2 数据库测试（Supabase）

```sql
-- 测试向量搜索
SELECT * FROM search_bookmarks_semantic(
  (SELECT embedding FROM bookmarks WHERE id = 1),
  'user-uuid',
  0.7,
  10
);
```

---

## 8. 开发优先级

### 8.1 MVP阶段（0-3个月）

**Week 1-2: 项目初始化**
- [ ] 创建 Next.js 项目
- [ ] 配置 Tailwind CSS + Shadcn UI
- [ ] 初始化 Supabase 项目
- [ ] 创建数据库表结构
- [ ] 配置 Supabase Auth

**Week 3-4: 收藏功能**
- [ ] 实现收藏创建 API
- [ ] 开发 Edge Function (crawl-content)
- [ ] 实现平台识别和爬取
- [ ] 开发收藏列表页面

**Week 5-6: AI功能**
- [ ] 开发 Edge Function (generate-embedding)
- [ ] 集成 OpenAI/DeepSeek API
- [ ] 实现AI摘要和标签生成
- [ ] 实现向量嵌入存储

**Week 7-8: 搜索功能**
- [ ] 实现关键词搜索
- [ ] 实现语义搜索（pgvector）
- [ ] 实现混合搜索
- [ ] 开发搜索页面

**Week 9-10: 管理功能**
- [ ] 实现文件夹管理
- [ ] 实现标签管理
- [ ] 开发收藏详情页
- [ ] 实现收藏编辑/删除

**Week 11-12: 前端完善**
- [ ] 开发登录/注册页
- [ ] 开发首页（收藏列表）
- [ ] 开发搜索页
- [ ] 开发设置页
- [ ] 响应式设计优化

**Week 13-14: 移动端打包**
- [ ] 配置 Capacitor
- [ ] 打包 Android APK
- [ ] 打包 iOS IPA（需要 Mac）
- [ ] 测试移动端功能

---

## 9. 部署要求

### 9.1 Supabase 配置

**环境变量**:
```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
OPENAI_API_KEY=your-openai-key
```

**Supabase 设置**:
- 启用 pgvector 扩展
- 配置 Row Level Security (RLS)
- 创建 Storage 存储桶
- 部署 Edge Functions

---

### 9.2 Next.js 部署

**Vercel 部署**（推荐）:
```bash
# 安装 Vercel CLI
npm i -g vercel

# 部署
vercel
```

**环境变量配置**:
- 在 Vercel 项目设置中添加 Supabase 环境变量
- 配置 OpenAI API Key

---

### 9.3 移动端发布

**Android**:
- 使用 Android Studio 构建 APK
- 上传到 Google Play Console

**iOS**:
- 使用 Xcode 构建 IPA
- 上传到 App Store Connect

---

## 10. 验收标准总结

### 10.1 功能验收

- [ ] 用户可以注册/登录（Supabase Auth）
- [ ] 用户可以收藏微信/B站/小红书内容
- [ ] 用户可以搜索收藏内容（关键词+语义）
- [ ] 用户可以管理文件夹
- [ ] AI自动生成摘要和标签
- [ ] 搜索耗时<500ms

### 10.2 性能验收

- [ ] Next.js 页面加载<2s
- [ ] API 响应时间<200ms（P95）
- [ ] 语义搜索耗时<500ms
- [ ] 支持100并发用户

### 10.3 质量验收

- [ ] TypeScript 类型检查通过
- [ ] Tailwind CSS 样式正确
- [ ] Shadcn UI 组件正常
- [ ] Supabase RLS 策略正确
- [ ] Edge Functions 正常运行

---

**文档结束**

---

## 11. 智能分类系统需求（V4.2 新增）

### 11.1 需求概述

智能分类系统旨在帮助用户自动整理收藏内容，减少手动分类的工作量，提升收藏管理效率。

### 11.2 功能模块

#### 11.2.1 默认临时文件夹（P0）

**需求描述**：
- 每个用户自动拥有一个名为「待整理」的系统文件夹
- 新收藏或 AI 置信度较低的内容自动放入此文件夹
- 系统文件夹不可删除、不可重命名

**触发条件**：
- 用户创建收藏时未指定文件夹
- AI 文件夹推荐置信度 < 60%
- 用户首次创建收藏时自动创建「待整理」文件夹

**技术实现**：
```typescript
// 获取或创建用户的待整理文件夹
async function getOrCreateInboxFolder(userId: string): Promise<Folder> {
  // 1. 查找现有待整理文件夹
  const existing = await supabase
    .from('folders')
    .select('*')
    .eq('user_id', userId)
    .eq('is_system', true)
    .eq('system_type', 'INBOX')
    .single()

  if (existing.data) return existing.data

  // 2. 不存在则创建
  const { data } = await supabase
    .from('folders')
    .insert({
      user_id: userId,
      name: '待整理',
      is_system: true,
      system_type: 'INBOX',
      sort_order: -1,  // 排在最前面
    })
    .select()
    .single()

  return data
}
```

---

#### 11.2.2 自动归类（置信度分层）（P0）

**需求描述**：
根据 AI 推荐置信度自动决定归类行为：

| 置信度范围 | 行为 | 用户感知 |
|-----------|------|---------|
| ≥ 80% | 自动归类到推荐文件夹 | 静默执行，显示轻量通知 |
| 60-79% | 显示推荐 Toast | 用户可确认/拒绝/自定义 |
| < 60% | 放入「待整理」 | 无打扰 |

**技术实现**：
```typescript
// 自动归类逻辑
async function autoClassifyBookmark(
  bookmarkId: number,
  recommendation: FolderRecommendation,
  userId: string
): Promise<void> {
  const { confidence, folderId, suggestNew, folderName } = recommendation

  if (confidence >= 80) {
    // 高置信度：自动归类
    let targetFolderId = folderId

    if (suggestNew && folderName) {
      // 自动创建新文件夹
      const { data: newFolder } = await supabase
        .from('folders')
        .insert({ user_id: userId, name: folderName })
        .select()
        .single()
      targetFolderId = newFolder.id
    }

    // 更新书签文件夹
    await supabase
      .from('bookmarks')
      .update({ folder_id: targetFolderId })
      .eq('id', bookmarkId)

    // 记录自动归类日志（支持撤销）
    await logAutoClassification(bookmarkId, targetFolderId, confidence)

  } else if (confidence < 60) {
    // 低置信度：放入待整理
    const inboxFolder = await getOrCreateInboxFolder(userId)
    await supabase
      .from('bookmarks')
      .update({ folder_id: inboxFolder.id })
      .eq('id', bookmarkId)
  }
  // 60-79%：不自动处理，由前端 Toast 处理
}
```

---

#### 11.2.3 智能更新分类（P1 - 暂缓）

**需求描述**：
- 定期分析「待整理」文件夹中的内容
- 基于标签聚类提供分类建议
- 支持批量确认/拒绝建议

**触发机制**：
- 时间维度：每周一次
- 数量维度：「待整理」达到 N 条时触发

**数据模型**：
```sql
-- 分类建议表（P1实现时添加）
CREATE TABLE classification_suggestions (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users,
  bookmark_id BIGINT REFERENCES bookmarks,
  suggested_folder_id BIGINT REFERENCES folders,
  suggested_folder_name VARCHAR(100),
  confidence DECIMAL(5,2),
  status VARCHAR(20) DEFAULT 'pending', -- pending/accepted/rejected
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

#### 11.2.4 思维导图式索引（P2 - 暂缓）

**需求描述**：
- 以思维导图形式展示文件夹、标签、书签的关系
- 支持缩放、拖拽、点击跳转
- 可视化展示收藏结构

**技术选型**：
- ReactFlow（推荐）
- D3.js（备选）

---

### 11.3 用户故事

**US-11.1 默认临时文件夹**
> 作为用户，我希望新收藏自动放入「待整理」文件夹，这样我可以稍后统一整理，而不必在收藏时做决定。

**验收标准**：
- [ ] 用户首次创建收藏时自动创建「待整理」文件夹
- [ ] 未指定文件夹的收藏自动放入「待整理」
- [ ] 「待整理」文件夹显示在文件夹列表最前面
- [ ] 「待整理」文件夹不可删除、不可重命名

**US-11.2 自动归类**
> 作为用户，我希望系统能够智能判断收藏内容的分类，高置信度时自动归类，减少我的操作负担。

**验收标准**：
- [ ] 置信度≥80%时自动归类，显示轻量通知
- [ ] 置信度60-79%时显示推荐Toast
- [ ] 置信度<60%时静默放入「待整理」
- [ ] 自动归类记录可查看和撤销

---

### 11.4 实施计划

| 阶段 | 内容 | 预计工期 | 状态 |
|------|------|---------|------|
| Phase 1 | 默认临时文件夹 | 0.5天 | 🔄 进行中 |
| Phase 1 | 自动归类（置信度分层） | 1天 | ⏳ 待开始 |
| Phase 2 | 智能更新分类 | 2-3天 | 🔜 暂缓 |
| Phase 3 | 思维导图式索引 | 3-5天 | 🔜 暂缓 |

---

## 附录：开发检查清单

### 前端开发（Next.js）
- [ ] Next.js 项目初始化
- [ ] Tailwind CSS 配置
- [ ] Shadcn UI 组件安装
- [ ] Supabase 客户端配置
- [ ] 页面路由配置
- [ ] API Routes 实现
- [ ] 组件开发
- [ ] 响应式设计
- [ ] 错误处理
- [ ] 加载状态

### 后端开发（Supabase）
- [ ] 数据库表创建
- [ ] RLS 策略配置
- [ ] Storage 存储桶配置
- [ ] Edge Functions 开发
- [ ] 数据库函数（向量搜索）
- [ ] 索引优化

### AI功能
- [ ] Edge Function (generate-embedding)
- [ ] Edge Function (crawl-content)
- [ ] OpenAI/DeepSeek API 集成
- [ ] 摘要生成
- [ ] 标签生成
- [ ] 向量嵌入

### 移动端
- [ ] Capacitor 配置
- [ ] 原生插件配置
- [ ] Android 打包
- [ ] iOS 打包（需要 Mac）

---

**此文档专为AI辅助开发设计，使用 Supabase + Next.js 技术栈，零服务器运维。**

