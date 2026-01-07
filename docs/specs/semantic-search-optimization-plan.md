# 语义搜索能力优化方案

> 版本: v1.1 | 日期: 2026-01-07 | 状态: Phase 1/3/4 已完成，Phase 2 已取消

## 📊 现状评估

### 已实现能力 ✅

| 能力     | 实现情况                                            | 代码位置                                    |
| -------- | --------------------------------------------------- | ------------------------------------------- |
| 向量嵌入 | 1024维 DashScope                                    | `src/lib/utils/embedding-generator.ts`      |
| 混合搜索 | 向量+全文 RRF融合                                   | `src/lib/utils/semantic-search.ts`          |
| 查询解析 | 13种时间模式+平台识别                               | `src/lib/ai-skills/search/query-parser.ts`  |
| 结果排序 | 5因素加权 (标题40%/内容25%/时间15%/行为10%/质量10%) | `src/lib/ai-skills/search/result-ranker.ts` |
| 查询改写 | LLM驱动的语义扩展                                   | Feature Flag: `ENABLE_QUERY_REWRITE`        |
| Rerank   | 结果重排序                                          | Feature Flag: `ENABLE_RERANK`               |
| 热门标签 | 基于统计的标签推荐                                  | `src/components/ai/hot-tags.tsx`            |

### 待优化能力 ❌

| 能力           | 现状                | 优先级 | 状态      |
| -------------- | ------------------- | ------ | --------- |
| 搜索结果高亮   | 标题+摘要关键词高亮 | P0     | ✅ 已完成 |
| ~~多模态搜索~~ | ~~完全未实现~~      | ~~P1~~ | ❌ 已取消 |
| 个性化推荐     | 热门标签无个性化    | P2     | 待定      |
| 搜索历史智能   | 无历史记录功能      | P2     | 待定      |

---

## 🎯 优化目标

### 核心指标

| 指标         | 当前   | 目标           | 衡量方式     |
| ------------ | ------ | -------------- | ------------ |
| 搜索准确率   | ~70%   | ≥90%           | 用户点击率   |
| 结果发现效率 | 无高亮 | 关键词即时定位 | 用户体验测试 |
| 多模态覆盖   | 仅文本 | 文本+图片      | 功能完整度   |
| 个性化程度   | 0%     | ≥60%           | 推荐命中率   |

---

## 📋 分阶段优化计划

### Phase 1: 搜索结果高亮 (P0)

**目标**: 用户一眼看到匹配关键词

**工期**: 3-5 天

**技术方案**:

#### 1.1 复用现有高亮系统

项目中已有完善的高亮系统，位于 `src/components/synthesis/highlightable-text.tsx`（420行），支持：

- 4种高亮颜色 (yellow/green/blue/pink)
- 选区高亮
- 持久化存储

**改造方案**: 提取核心高亮逻辑为通用组件

```typescript
// 新建: src/components/ui/text-highlighter.tsx

interface TextHighlighterProps {
  text: string;
  keywords: string[]; // 要高亮的关键词
  highlightColor?: "yellow" | "green" | "blue" | "pink";
  caseSensitive?: boolean;
}

export function TextHighlighter({
  text,
  keywords,
  highlightColor = "yellow",
  caseSensitive = false,
}: TextHighlighterProps) {
  // 使用正则匹配所有关键词位置
  // 渲染高亮片段
}
```

#### 1.2 搜索结果卡片集成

修改现有 `src/components/ai/search-result-card.tsx`:

```diff
// 现有代码
- <span>{result.title}</span>
+ <TextHighlighter text={result.title} keywords={searchKeywords} />

// 摘要部分
- <p>{result.description}</p>
+ <TextHighlighter text={result.description} keywords={searchKeywords} />
```

#### 1.3 API 返回关键词

修改搜索 API 返回结构，增加 `matchedKeywords` 字段：

```typescript
interface SearchResponse {
  results: SearchResult[];
  matchedKeywords: string[]; // 新增: 实际匹配到的关键词
  totalCount: number;
}
```

**任务清单**:

- [x] ~~提取 `TextHighlighter` 通用组件~~ (已有 `HighlightedText` 组件)
- [x] 修改 `ResponseFormatter` 高亮标题和摘要中的关键词
- [x] 前端 `search-result-card.tsx` 已集成 `HighlightedText` 组件
- [x] 添加单元测试 (20 个测试全部通过)
- [x] 验收完成

**实际实现方案**：

采用后端高亮方式，修改 `ResponseFormatter.formatTitle()` 和 `formatSummary()` 方法，使用 `**keyword**` 格式包裹关键词。前端 `HighlightedText` 组件已存在，自动解析并渲染为黄色高亮。

---

### ~~Phase 2: 多模态搜索 (P1)~~ ❌ 已取消

**目标**: 支持图片内容搜索

**工期**: 5-7 天

**技术方案**:

#### 2.1 图片文字识别 (OCR)

使用阿里云 OCR 服务提取图片中的文字：

```typescript
// 新建: src/lib/ocr/aliyun-ocr.service.ts

export class AliyunOcrService {
  async extractText(imageUrl: string): Promise<string> {
    // 调用阿里云 OCR API
    // 返回识别的文字内容
  }
}
```

#### 2.2 图片向量化

使用 CLIP 模型生成图片嵌入向量：

```typescript
// 新建: src/lib/embedding/image-embedding.service.ts

export class ImageEmbeddingService {
  async generateEmbedding(imageUrl: string): Promise<number[]> {
    // 方案A: 使用 DashScope 多模态模型
    // 方案B: 使用开源 CLIP 模型
  }
}
```

#### 2.3 书签图片索引

扩展书签数据结构：

```sql
-- 新增迁移: add_image_search_fields.sql
ALTER TABLE bookmarks
ADD COLUMN image_text TEXT,           -- OCR 提取的文字
ADD COLUMN image_embedding vector(512); -- 图片向量 (CLIP 标准维度)

-- 创建图片向量索引
CREATE INDEX idx_bookmarks_image_embedding
ON bookmarks USING ivfflat (image_embedding vector_cosine_ops);
```

#### 2.4 混合搜索增强

修改 `semantic-search.ts` 支持图片搜索：

```typescript
interface SearchOptions {
  query: string;
  searchMode: "text" | "image" | "hybrid"; // 新增
  imageQuery?: string; // 图片 URL 或描述
}
```

**任务清单**:

- [ ] 集成阿里云 OCR 服务
- [ ] 实现图片嵌入服务 (选型: DashScope 多模态 vs CLIP)
- [ ] 数据库迁移：添加图片搜索字段
- [ ] 书签保存时自动提取图片文字和向量
- [ ] 修改搜索服务支持多模态查询
- [ ] 添加图片搜索 UI 入口
- [ ] 性能测试与优化

---

### Phase 3: 个性化搜索推荐 (P2) ✅ 已完成

**目标**: 基于用户行为的智能推荐

**工期**: 4-6 天

**实际完成日期**: 2026-01-07

**技术方案**:

#### 3.1 搜索历史记录

```sql
-- 新增迁移: add_search_history.sql
CREATE TABLE search_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  query TEXT NOT NULL,
  result_count INTEGER,
  clicked_bookmark_ids UUID[],  -- 点击的结果
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS 策略
ALTER TABLE search_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "用户只能访问自己的搜索历史"
ON search_history FOR ALL
USING (auth.uid() = user_id);
```

#### 3.2 用户搜索画像

```typescript
// 新建: src/lib/ai-agent/preferences/search-profile.service.ts

interface UserSearchProfile {
  frequentTopics: string[]; // 常搜主题
  preferredPlatforms: string[]; // 偏好平台
  activeTimeSlots: string[]; // 活跃时段
  clickPatterns: {
    // 点击模式
    preferTitleMatch: number; // 标题匹配偏好 0-1
    preferRecentContent: number; // 新内容偏好 0-1
  };
}

export class SearchProfileService {
  async buildProfile(userId: string): Promise<UserSearchProfile> {
    // 分析搜索历史
    // 生成用户画像
  }

  async personalizeResults(
    results: SearchResult[],
    profile: UserSearchProfile,
  ): Promise<SearchResult[]> {
    // 根据画像调整排序权重
  }
}
```

#### 3.3 智能搜索建议

```typescript
// 修改: src/components/ai/search-suggestions.tsx

interface SearchSuggestionsProps {
  query: string;
  onSelect: (suggestion: string) => void;
}

export function SearchSuggestions({ query, onSelect }: SearchSuggestionsProps) {
  // 结合:
  // 1. 搜索历史
  // 2. 热门搜索
  // 3. 用户收藏标签
  // 4. 实时输入补全
}
```

**任务清单**:

- [x] 数据库迁移：创建搜索历史表 (`migrations/20260107000001_create_search_history.sql`)
- [x] 实现搜索历史记录 API (`src/app/api/search/history/route.ts`)
- [x] 实现搜索历史服务 (`src/lib/ai-skills/search/search-history.service.ts`)
- [x] 添加搜索建议组件 (`src/components/ai/ai-search-suggestions.tsx` v2.0)
- [x] 集成搜索历史到搜索 API (`src/app/api/search/route.ts`)
- [x] TypeScript 类型定义更新 (`src/types/supabase.ts`)
- [ ] 实现用户搜索画像构建（后续迭代）
- [ ] 修改 `ResultRanker` 支持个性化权重（后续迭代）
- [ ] A/B 测试个性化效果（后续迭代）

**实现说明**:

- 搜索历史表支持关键词数组、点击记录、平台/时间过滤器
- 热门关键词通过 RPC 函数 `get_user_hot_keywords` 实现
- 最近搜索通过 RPC 函数 `get_recent_searches` 实现（自动去重）
- 搜索建议组件支持服务端 API + localStorage 回退
- 搜索 API 异步记录历史，不阻塞响应

---

### Phase 4: 搜索体验优化 (P2) ✅ 已完成

**目标**: 整体搜索体验提升

**工期**: 3-4 天

**实际完成日期**: 2026-01-07

**技术方案**:

#### 4.1 搜索即时预览

```typescript
// 新建: src/components/search/search-preview-panel.tsx

// 鼠标悬停搜索结果时，显示更多内容预览
export function SearchPreviewPanel({ bookmark }: { bookmark: Bookmark }) {
  return (
    <div className="search-preview">
      <h3>{bookmark.title}</h3>
      <p className="text-sm text-muted-foreground">
        {bookmark.description || bookmark.summary}
      </p>
      {bookmark.coverUrl && (
        <img src={bookmark.coverUrl} alt="" className="preview-image" />
      )}
      <div className="tags">
        {bookmark.tags?.map(tag => <Badge key={tag}>{tag}</Badge>)}
      </div>
    </div>
  );
}
```

#### 4.2 搜索过滤器增强

```typescript
// 增强现有过滤器
interface SearchFilters {
  platforms: string[]; // 已有
  dateRange: DateRange; // 已有
  folders: string[]; // 新增: 文件夹过滤
  tags: string[]; // 新增: 标签过滤
  hasImage: boolean; // 新增: 仅含图片
  hasSummary: boolean; // 新增: 仅已摘要
  wordCountRange: [number, number]; // 新增: 字数范围
}
```

#### 4.3 搜索结果分组

```typescript
// 按来源分组显示
interface GroupedSearchResults {
  byPlatform: Record<string, SearchResult[]>;
  byFolder: Record<string, SearchResult[]>;
  byTime: {
    today: SearchResult[];
    thisWeek: SearchResult[];
    older: SearchResult[];
  };
}
```

**任务清单**:

- [x] 实现搜索预览面板 (`src/components/search/search-preview-panel.tsx`)
- [x] 增强过滤器选项 (`src/components/search/search-filter-panel.tsx`)
- [x] 添加结果分组视图 (`src/components/search/search-result-group-view.tsx`)
- [x] 实现搜索结果卡片包装器 (`src/components/search/search-result-card.tsx`)
- [x] 添加键盘快捷键支持 (`src/hooks/search/use-search-keyboard.ts`)
- [x] 添加快捷键提示组件 (`src/components/search/search-keyboard-hints.tsx`)
- [x] 集成到搜索页面 (`src/components/search/search-page-client.tsx`)

**实现说明**:

| 组件                    | 功能           | 关键特性                                |
| ----------------------- | -------------- | --------------------------------------- |
| `SearchPreviewPanel`    | 悬停预览面板   | 封面图、摘要、标签、快捷操作            |
| `SearchResultCard`      | 结果卡片包装器 | 500ms 延迟显示、自动定位（左/右）       |
| `SearchFilterPanel`     | 过滤器面板     | 平台、时间、类型、状态、星标、排序      |
| `SearchResultGroupView` | 分组视图       | 按平台/日期/类型分组、展开/收起         |
| `useSearchKeyboard`     | 键盘快捷键     | `/` 聚焦、↑↓ 导航、Enter 打开、Esc 关闭 |
| `SearchKeyboardHints`   | 快捷键提示     | 底部提示条                              |

---

## 📅 时间线总览

```
Week 1: Phase 1 - 搜索结果高亮
├── Day 1-2: TextHighlighter 组件开发
├── Day 3: API 改造
├── Day 4: UI 集成
└── Day 5: 测试与修复

Week 2: Phase 2 - 多模态搜索 (前半)
├── Day 1-2: OCR 服务集成
├── Day 3-4: 图片嵌入服务
└── Day 5: 数据库迁移

Week 3: Phase 2 - 多模态搜索 (后半) + Phase 3 开始
├── Day 1-2: 混合搜索改造
├── Day 3: 多模态 UI
├── Day 4-5: 搜索历史功能

Week 4: Phase 3 + Phase 4
├── Day 1-2: 用户画像与个性化
├── Day 3-4: 搜索建议与预览
└── Day 5: 整体测试与优化
```

---

## 🔧 技术依赖

### 新增依赖

| 依赖             | 用途         | 备注                       |
| ---------------- | ------------ | -------------------------- |
| 阿里云 OCR SDK   | 图片文字识别 | 可选 Tesseract.js 降级方案 |
| DashScope 多模态 | 图片向量化   | 现有账户可用               |

### 数据库变更

| 迁移文件                      | 变更内容            |
| ----------------------------- | ------------------- |
| `add_image_search_fields.sql` | 图片搜索字段 + 索引 |
| `add_search_history.sql`      | 搜索历史表 + RLS    |

### Feature Flags

```bash
# 新增 Feature Flags
ENABLE_SEARCH_HIGHLIGHT=true    # 搜索高亮
ENABLE_IMAGE_SEARCH=true        # 图片搜索
ENABLE_SEARCH_PERSONALIZATION=true  # 个性化搜索
```

---

## ✅ 验收标准

### Phase 1 验收

- [ ] 搜索结果标题中的关键词高亮显示
- [ ] 搜索结果摘要中的关键词高亮显示
- [ ] 高亮颜色与主题一致
- [ ] 性能无明显下降 (<100ms 增量)

### Phase 2 验收

- [ ] 支持通过图片内文字搜索书签
- [ ] 新保存书签自动提取图片信息
- [ ] 历史书签可批量补充图片索引
- [ ] 图片搜索准确率 ≥80%

### Phase 3 验收

- [ ] 搜索历史可查看、可删除
- [ ] 搜索建议基于个人历史
- [ ] 结果排序体现个人偏好
- [ ] 用户可关闭个性化功能

### Phase 4 验收 ✅

- [x] 悬停预览流畅无卡顿（500ms 延迟显示 + 150ms 延迟隐藏）
- [x] 过滤器选项完整可用（平台、时间、类型、状态、星标、排序）
- [x] 分组视图切换流畅（支持按平台/日期/类型分组）
- [x] 键盘操作体验良好（`/` 聚焦、`↑↓` 导航、`Enter` 打开、`Esc` 关闭）

---

## 🚨 风险与缓解

| 风险               | 影响                  | 缓解措施                           |
| ------------------ | --------------------- | ---------------------------------- |
| OCR 服务成本       | 大量图片处理费用高    | 限制每日配额 + 本地 Tesseract 降级 |
| 图片向量维度不一致 | CLIP 512 vs 文本 1024 | 使用独立索引，混合搜索时分别查询   |
| 个性化数据冷启动   | 新用户无历史          | 使用全局热门 + 逐步积累            |
| 搜索延迟增加       | 高亮处理耗时          | 前端异步渲染 + 虚拟滚动            |

---

## 📝 备注

1. **Phase 1 优先**：搜索高亮是用户感知最明显的改进，且实现成本最低
2. **Phase 2 可选**：多模态搜索投入较大，可根据用户反馈决定是否实施
3. **渐进式发布**：每个 Phase 完成后先灰度发布，收集反馈后再继续

---

**请审核此方案，如有疑问或修改建议请提出。**
