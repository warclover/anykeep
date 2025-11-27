# AnyKeep 下一阶段任务规划

**日期**: 2025-11-27
**版本**: V4.4
**基于**: 产品需求文档 V4.2-AI-Supabase

---

## ✅ 已完成功能

- **用户系统**: 注册/登录（Supabase Auth）
- **文件夹分组管理** (V4.4)
  - 5类分组管理（工作/学习/生活/娱乐/其他）
  - 菜单式排序（左移/右移/置顶/置底）
  - 跨类别移动功能
  - 系统文件夹特殊标识

---

## 🎯 Phase 1: 智能分类系统基础 (P0 - 预计 1.5天)

### Task 1.1: 默认临时文件夹("待整理") ⏰ 0.5天

**目标**: 为每个用户自动创建系统文件夹

**子任务**:

1. ✅ 数据库已支持 `is_system` 和 `system_type` 字段
2. 创建用户注册时自动创建"待整理"文件夹的触发器
3. 修改收藏创建逻辑：未指定文件夹时默认放入"待整理"
4. UI 显示：系统文件夹特殊标识（不可删除/重命名）

**验收标准**:

- [ ] 新用户注册后自动拥有"待整理"文件夹
- [ ] 系统文件夹显示特殊图标和"系统"标识
- [ ] 系统文件夹的删除/重命名按钮置灰
- [ ] 新收藏默认进入"待整理"文件夹

**技术要点**:

```sql
-- 用户注册时自动创建"待整理"文件夹的触发器
CREATE OR REPLACE FUNCTION create_inbox_folder()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO folders (user_id, name, is_system, system_type, sort_order)
  VALUES (NEW.id, '待整理', TRUE, 'INBOX', 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_inbox_folder();
```

---

### Task 1.2: 自动归类（置信度分层） ⏰ 1天

**目标**: AI推荐文件夹 + 置信度自动判断

**子任务**:

1. 创建 `classification_suggestions` 表
2. Edge Function: AI文件夹推荐
   - 输入：书签标题、摘要、标签
   - 输出：推荐文件夹 + 置信度
3. 自动归类逻辑：
   - ≥80%: 自动归类 + 轻量通知
   - 60-79%: 显示Toast让用户确认
   - <60%: 放入"待整理"
4. 前端Toast组件：显示推荐并支持确认/拒绝

**验收标准**:

- [ ] AI能根据内容推荐文件夹并返回置信度
- [ ] 高置信度(≥80%)自动归类成功
- [ ] 中置信度(60-79%)显示Toast推荐
- [ ] 低置信度(<60%)自动进入"待整理"
- [ ] 用户可以撤销自动归类

**技术要点**:

```sql
-- 分类建议表
CREATE TABLE classification_suggestions (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  bookmark_id BIGINT REFERENCES bookmarks(id) ON DELETE CASCADE,
  suggested_folder_id BIGINT REFERENCES folders(id),
  suggested_folder_name VARCHAR(100),
  confidence DECIMAL(5,2),
  status VARCHAR(20) DEFAULT 'pending', -- pending/accepted/rejected/expired
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_suggestions_user_status ON classification_suggestions(user_id, status);
CREATE INDEX idx_suggestions_bookmark ON classification_suggestions(bookmark_id);
```

**置信度分层逻辑**:

```typescript
async function handleClassification(
  bookmarkId: number,
  suggestedFolderId: number,
  confidence: number
) {
  if (confidence >= 80) {
    // 自动归类
    await supabase
      .from('bookmarks')
      .update({ folder_id: suggestedFolderId })
      .eq('id', bookmarkId);

    // 显示轻量通知
    toast.success(`已自动归类到「${folderName}」`, {
      action: {
        label: '撤销',
        onClick: () => undoClassification(bookmarkId)
      }
    });
  } else if (confidence >= 60) {
    // 显示Toast让用户确认
    toast.info(
      <div>
        <p>推荐归类到「{folderName}」</p>
        <p className="text-xs text-muted-foreground">
          置信度: {confidence}%
        </p>
      </div>,
      {
        action: {
          label: '确认',
          onClick: () => confirmClassification(bookmarkId, suggestedFolderId)
        }
      }
    );
  } else {
    // 放入"待整理"
    const inboxFolder = await getInboxFolder(userId);
    await supabase
      .from('bookmarks')
      .update({ folder_id: inboxFolder.id })
      .eq('id', bookmarkId);
  }
}
```

---

## 🎯 Phase 2: 收藏功能核心流程 (P0 - 预计 3天)

### Task 2.1: 一键收藏 ⏰ 1天

**目标**: 通过分享菜单快速保存内容

**子任务**:

1. 创建收藏 API (`POST /api/bookmarks`)
2. 解析URL获取元数据（标题、描述、封面）
3. 前端表单：手动输入 + URL自动填充
4. 支持3大平台识别（微信/B站/小红书）

**API 设计**:

```typescript
// POST /api/bookmarks
interface CreateBookmarkRequest {
  url: string;
  title?: string;
  description?: string;
  folder_id?: number;
  user_tags?: string[];
}

interface CreateBookmarkResponse {
  success: boolean;
  data: {
    id: number;
    title: string;
    url: string;
    platform: string;
    folder_id: number;
  };
}
```

**验收标准**:

- [ ] 用户可以通过URL创建收藏
- [ ] 自动提取页面标题和描述
- [ ] 收藏成功后跳转到收藏列表
- [ ] 支持手动选择文件夹
- [ ] 自动识别平台类型

**平台识别逻辑**:

```typescript
function detectPlatform(url: string): Platform {
  if (url.includes("mp.weixin.qq.com")) return "WECHAT_OFFICIAL_ACCOUNT";
  if (url.includes("bilibili.com")) return "BILIBILI";
  if (url.includes("xiaohongshu.com")) return "XIAOHONGSHU";
  return "OTHER";
}
```

---

### Task 2.2: 收藏列表展示 ⏰ 1天

**目标**: 展示用户的所有收藏

**子任务**:

1. 创建收藏列表页面 (`/bookmarks`)
2. API: `GET /api/bookmarks` (分页、筛选)
3. 卡片式布局：封面图 + 标题 + 摘要 + 标签
4. 筛选功能：按文件夹、按平台、按标签

**API 设计**:

```typescript
// GET /api/bookmarks?page=1&limit=20&folder_id=1&platform=BILIBILI
interface GetBookmarksParams {
  page?: number;
  limit?: number;
  folder_id?: number;
  platform?: Platform;
  tags?: string[];
}

interface GetBookmarksResponse {
  success: boolean;
  data: {
    bookmarks: Bookmark[];
    total: number;
    page: number;
    limit: number;
  };
}
```

**验收标准**:

- [ ] 显示所有收藏（分页加载）
- [ ] 点击卡片可跳转详情页
- [ ] 支持按文件夹筛选
- [ ] 支持按平台筛选
- [ ] 支持按标签筛选
- [ ] 响应式设计（移动端适配）

**UI 组件结构**:

```tsx
<BookmarksList>
  <BookmarksFilters />
  <BookmarksGrid>
    <BookmarkCard
      cover={bookmark.cover_url}
      title={bookmark.title}
      description={bookmark.ai_summary}
      tags={bookmark.ai_tags}
      platform={bookmark.platform}
    />
  </BookmarksGrid>
  <Pagination />
</BookmarksList>
```

---

### Task 2.3: 收藏详情页 ⏰ 0.5天

**目标**: 查看单个收藏的详细信息

**子任务**:

1. 创建详情页 (`/bookmarks/[id]`)
2. API: `GET /api/bookmarks/[id]`
3. 显示完整信息：标题、描述、标签、笔记
4. 编辑功能：修改文件夹、添加标签、添加笔记

**验收标准**:

- [ ] 显示收藏的所有字段
- [ ] 可以点击原文链接跳转
- [ ] 支持编辑文件夹和标签
- [ ] 支持添加/编辑笔记
- [ ] 显示创建时间和更新时间

---

### Task 2.4: 元数据提取 (Edge Function) ⏰ 0.5天

**目标**: 爬取URL获取更丰富的元数据

**子任务**:

1. 创建 Edge Function (`crawl-url`)
2. 支持 Open Graph 标签提取
3. 保存封面图到 Supabase Storage
4. 异步处理：创建收藏后后台爬取

**Edge Function 结构**:

```typescript
// supabase/functions/crawl-url/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import * as cheerio from "https://esm.sh/cheerio@1.0.0-rc.12";

serve(async (req) => {
  const { url } = await req.json();

  // 获取页面内容
  const response = await fetch(url);
  const html = await response.text();
  const $ = cheerio.load(html);

  // 提取元数据
  const metadata = {
    title: $('meta[property="og:title"]').attr("content") || $("title").text(),
    description: $('meta[property="og:description"]').attr("content"),
    cover_url: $('meta[property="og:image"]').attr("content"),
    author: $('meta[name="author"]').attr("content"),
  };

  // 上传封面到 Supabase Storage
  if (metadata.cover_url) {
    const coverBlob = await fetch(metadata.cover_url).then((r) => r.blob());
    const fileName = `covers/${Date.now()}.jpg`;

    const { data: uploadData } = await supabase.storage
      .from("bookmarks")
      .upload(fileName, coverBlob);

    metadata.cover_url = uploadData.path;
  }

  return new Response(JSON.stringify(metadata), {
    headers: { "Content-Type": "application/json" },
  });
});
```

**验收标准**:

- [ ] 能提取页面标题、描述、封面
- [ ] 封面图上传到 Supabase Storage
- [ ] 爬取失败时有降级处理
- [ ] 支持异步后台爬取

---

## 🎯 Phase 3: 标签管理与搜索 (P0 - 预计 2天)

### Task 3.1: 标签管理 ⏰ 1天

**目标**: 用户可以管理自己的标签

**子任务**:

1. 创建标签列表页 (`/tags`)
2. API: 标签CRUD操作
3. 标签与收藏的关联关系
4. 标签统计（使用次数）

**API 设计**:

```typescript
// GET /api/tags - 获取用户所有标签
// POST /api/tags - 创建标签
// PUT /api/tags/[id] - 更新标签
// DELETE /api/tags/[id] - 删除标签

interface Tag {
  id: number;
  name: string;
  color: string;
  usage_count: number;
}
```

**验收标准**:

- [ ] 显示所有标签及使用次数
- [ ] 点击标签筛选相关收藏
- [ ] 支持创建、编辑、删除标签
- [ ] 标签支持颜色自定义

---

### Task 3.2: 关键词搜索 ⏰ 0.5天

**目标**: 基础的全文搜索

**子任务**:

1. API: `GET /api/bookmarks/search?q=keyword`
2. PostgreSQL 全文搜索 (tsvector)
3. 搜索结果高亮显示

**数据库优化**:

```sql
-- 添加全文搜索索引
ALTER TABLE bookmarks
ADD COLUMN search_vector tsvector
GENERATED ALWAYS AS (
  setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('simple', coalesce(description, '')), 'B') ||
  setweight(to_tsvector('simple', coalesce(ai_summary, '')), 'C')
) STORED;

CREATE INDEX idx_bookmarks_search ON bookmarks USING GIN (search_vector);

-- 搜索查询
SELECT * FROM bookmarks
WHERE search_vector @@ plainto_tsquery('simple', '关键词')
ORDER BY ts_rank(search_vector, plainto_tsquery('simple', '关键词')) DESC;
```

**验收标准**:

- [ ] 支持标题、描述、摘要全文搜索
- [ ] 搜索结果按相关度排序
- [ ] 搜索关键词高亮显示
- [ ] 搜索性能良好（< 100ms）

---

### Task 3.3: 筛选功能 ⏰ 0.5天

**目标**: 多维度筛选收藏

**子任务**:

1. 按文件夹筛选
2. 按标签筛选
3. 按平台筛选
4. 按时间范围筛选

**UI 组件**:

```tsx
<FiltersPanel>
  <FolderFilter folders={folders} selected={selectedFolderId} />
  <TagFilter tags={tags} selected={selectedTags} />
  <PlatformFilter platforms={platforms} selected={selectedPlatform} />
  <DateRangeFilter startDate={startDate} endDate={endDate} />
</FiltersPanel>
```

**验收标准**:

- [ ] 支持多条件组合筛选
- [ ] 筛选条件实时生效
- [ ] 显示筛选结果数量
- [ ] 支持清除筛选条件

---

## 📊 工作量预估

| 阶段              | 任务数 | 预计工期  | 优先级 | 状态      |
| ----------------- | ------ | --------- | ------ | --------- |
| Phase 1: 智能分类 | 2      | 1.5天     | P0     | ⏳ 待开始 |
| Phase 2: 收藏核心 | 4      | 3天       | P0     | ⏳ 待开始 |
| Phase 3: 标签搜索 | 3      | 2天       | P0     | ⏳ 待开始 |
| **总计**          | **9**  | **6.5天** | -      | -         |

---

## 🚀 推荐执行顺序

### 第一周: Phase 1 - 智能分类系统基础

**目标**: 完成"待整理"文件夹和AI自动归类

**Day 1-2**:

- Task 1.1: 默认临时文件夹
- Task 1.2: 自动归类（置信度分层）

**交付物**:

- [ ] 新用户自动拥有"待整理"文件夹
- [ ] AI能根据置信度自动归类收藏
- [ ] Toast通知和撤销功能

---

### 第二周: Phase 2 - 收藏功能核心流程

**目标**: 完成收藏的创建、展示、详情功能

**Day 3-5**:

- Task 2.1: 一键收藏
- Task 2.2: 收藏列表展示
- Task 2.3: 收藏详情页
- Task 2.4: 元数据提取

**交付物**:

- [ ] 用户可以创建收藏
- [ ] 收藏列表卡片展示
- [ ] 收藏详情页查看和编辑
- [ ] 自动提取页面元数据

---

### 第三周: Phase 3 - 标签管理与搜索

**目标**: 完成标签管理和搜索筛选功能

**Day 6-7**:

- Task 3.1: 标签管理
- Task 3.2: 关键词搜索
- Task 3.3: 筛选功能

**交付物**:

- [ ] 标签CRUD功能
- [ ] 全文搜索
- [ ] 多维度筛选

---

## 📌 开发注意事项

### 数据库迁移

- 使用 Supabase 迁移文件管理数据库变更
- 每个迁移文件命名格式：`YYYYMMDDHHMMSS_description.sql`
- 测试环境先执行，确认无误后再应用到生产环境

### API 规范

- 统一使用 Next.js App Router 的 Route Handlers
- 错误响应格式统一：`{ success: false, error: { code, message } }`
- 成功响应格式统一：`{ success: true, data: {...} }`
- 所有API都需要用户认证和RLS检查

### 测试策略

- 单元测试：关键业务逻辑（AI分类、置信度判断）
- 集成测试：API端到端测试
- E2E测试：关键用户流程（创建收藏、搜索筛选）

### 性能优化

- 收藏列表使用分页加载
- 搜索结果缓存（Redis / Supabase Cache）
- 封面图使用 Supabase Storage CDN
- 数据库查询优化（索引、explain分析）

---

## 🎯 MVP 完成标志

当以上3个阶段全部完成后，AnyKeep MVP 将具备以下核心能力：

✅ **用户体验闭环**:

1. 用户注册 → 自动创建"待整理"文件夹
2. 一键收藏 → AI自动分类 → 文件夹管理
3. 搜索筛选 → 查看详情 → 编辑笔记

✅ **核心功能完整**:

- 收藏管理（创建、查看、编辑）
- 智能分类（AI推荐、置信度分层）
- 文件夹管理（5类分组、排序）
- 标签管理（CRUD、统计）
- 搜索筛选（全文搜索、多维度筛选）

✅ **技术架构稳固**:

- Next.js 14 + Supabase 后端
- PostgreSQL + pgvector 数据库
- Edge Functions AI服务
- Shadcn UI 组件库

---

## 📝 后续规划 (P1 - 暂缓)

### Phase 4: AI增强功能

- AI摘要生成
- AI标签生成
- 语义搜索（pgvector）

### Phase 5: 平台集成

- 微信公众号授权
- B站授权
- 小红书授权

### Phase 6: 高级功能

- 智能更新分类
- 思维导图式索引
- 收藏数据导出

---

**更新日期**: 2025-11-27
**下次更新**: 完成 Phase 1 后
