# AI 摘要深度优化方案 (Sprint 1 深化)

## 背景

当前 AnyKeep 已经实现了：

- ✅ 结构化 JSON 摘要（tldr、key_points、keywords、sentiment、reading_time、action_items）
- ✅ 卡片翻转交互（桌面端 hover、移动端点击）
- ✅ Jina Reader 内容清洗
- ✅ 类型自适应 Prompt（Article/Tutorial/Video/Tool）

基于现有基础，本文档提出**更深层次的优化方向**，旨在让 AI 摘要从"能用"升级到"好用"再到"智能"。

---

## 一、摘要质量评估与自动优化 (Quality Assessment & Auto-Optimization)

### 1.1 问题定义

**现状**：AI 生成的摘要质量参差不齐，但系统无法自动识别"差摘要"并优化。

**目标**：建立摘要质量评估体系，基于用户行为自动优化。

### 1.2 质量评估指标

```typescript
interface SummaryQualityMetrics {
  // 用户行为指标
  clickThroughRate: number; // 点击详情页的比例
  averageViewTime: number; // 用户在详情页停留时间（秒）
  feedbackScore: number; // 用户反馈分数（-1 到 1）

  // 内容质量指标
  tldrLength: number; // TL;DR 长度（理想：30-50字）
  keyPointsCount: number; // 关键点数量（理想：3-5个）
  keywordsRelevance: number; // 关键词与内容的相关度（0-1）

  // 综合评分
  overallScore: number; // 0-100 分
}
```

### 1.3 自动优化策略

**A. 低质量摘要自动重试**

当检测到摘要质量低于阈值（如 `overallScore < 60`）时：

1. **触发条件**：
   - 用户点击详情页后 3 秒内返回（说明摘要不吸引人）
   - 用户反馈"摘要不准确"
   - TL;DR 长度异常（< 20 字或 > 100 字）

2. **重试机制**：
   - 使用更严格的 Prompt（降低 temperature 到 0.3）
   - 增加内容上下文（从 10k tokens 扩展到 15k）
   - 如果重试 2 次仍失败，标记为"需要人工审核"

**B. 基于用户反馈的 Prompt 调优**

```typescript
// 伪代码示例
async function optimizePromptFromFeedback(
  bookmarkId: number,
  feedback: "helpful" | "not_helpful",
) {
  // 收集该用户的历史反馈
  const userFeedbackHistory = await getUserFeedbackHistory(userId);

  // 分析：哪些类型的摘要用户更满意？
  // 例如：用户更喜欢"技术细节"还是"核心观点"？

  // 动态调整 Prompt 模板
  const personalizedPrompt = buildPersonalizedPrompt(
    userFeedbackHistory,
    contentType,
  );

  // 重新生成摘要（后台任务）
  await regenerateSummary(bookmarkId, personalizedPrompt);
}
```

---

## 二、个性化摘要生成 (Personalized Summarization)

### 2.1 用户画像构建

**目标**：基于用户历史收藏，构建"兴趣画像"，让摘要更贴合用户偏好。

```typescript
interface UserInterestProfile {
  // 技术栈偏好
  techStack: string[]; // ["React", "Next.js", "TypeScript"]

  // 内容类型偏好
  contentTypeWeights: Record<ContentType, number>;
  // { "Tutorial": 0.8, "Article": 0.6, "Video": 0.4 }

  // 摘要风格偏好
  summaryStyle: "concise" | "detailed" | "actionable";
  // concise: 更短，直击要点
  // detailed: 更详细，包含背景
  // actionable: 强调行动项

  // 领域标签
  domainTags: string[]; // ["前端开发", "性能优化", "设计模式"]
}
```

### 2.2 个性化 Prompt 注入

在生成摘要时，将用户画像注入 Prompt：

```markdown
【用户偏好上下文】

- 技术栈：React, Next.js, TypeScript
- 摘要风格：actionable（偏好可执行的步骤）
- 关注领域：前端性能优化、设计模式

【摘要要求】

- 请重点突出与 React/Next.js 相关的技术细节
- action_items 必须包含具体的代码示例或配置步骤
- keywords 必须包含至少 2 个用户关注的技术栈标签
```

### 2.3 实施建议

1. **Phase 1**：收集用户行为数据（点击、停留时间、文件夹分类）
2. **Phase 2**：构建初始用户画像（基于前 10 条收藏）
3. **Phase 3**：在 Prompt 中注入个性化上下文
4. **Phase 4**：A/B 测试对比个性化 vs 通用摘要的用户满意度

---

## 三、摘要的渐进式展示 (Progressive Disclosure)

### 3.1 问题

**现状**：卡片背面一次性展示所有信息（TL;DR + Key Points），信息过载。

**目标**：采用"渐进式展示"，让用户按需深入。

### 3.2 交互设计

**卡片背面（第一层）**：

- 仅显示 **TL;DR**（大号字体，居中）
- 底部显示 **3 个核心标签**（keywords 的前 3 个）
- 右上角显示 **阅读时间** 和 **情感倾向图标**（😊/😐/😞）

**详情页（第二层）**：

- 完整展示 **Key Points**（带 emoji 图标）
- 展示 **Action Items**（如果有）
- 展示 **完整标签列表**

**交互优化**：

- 卡片背面增加"展开更多"按钮（点击后卡片轻微放大，显示前 2 个 Key Points）
- 详情页增加"收起摘要"按钮（快速回到卡片视图）

### 3.3 视觉设计建议

```css
/* 卡片背面 - 极简风格 */
.flip-card-back {
  /* 背景色根据 sentiment 微调 */
  background: sentiment === "positive"
    ? "linear-gradient(to br, #f0fdf4, #ffffff)"
    : sentiment === "negative"
    ? "linear-gradient(to br, #fef2f2, #ffffff)"
    : "linear-gradient(to br, #f9fafb, #ffffff)";
}

/* TL;DR 大号字体，类似 MyMind 风格 */
.tldr-text {
  font-size: 1.25rem;
  font-weight: 500;
  line-height: 1.6;
  color: #111827;
  text-align: center;
  padding: 2rem 1.5rem;
}
```

---

## 四、摘要的时效性与更新 (Temporal Awareness)

### 4.1 问题

**现状**：摘要生成后永久不变，但原内容可能已更新（如技术文章修正、视频重新上传）。

**目标**：检测内容变化，自动重新生成摘要。

### 4.2 实施策略

**A. 内容指纹 (Content Fingerprint)**

```typescript
interface ContentFingerprint {
  url: string;
  titleHash: string; // 标题的 MD5
  contentHash: string; // 正文前 5k 字符的 MD5
  lastCheckedAt: Date;
  lastUpdatedAt: Date;
}
```

**B. 定期检查机制**

1. **轻量级检查**（每天）：
   - 仅检查标题和描述是否变化
   - 如果变化，标记为"需要重新生成摘要"

2. **深度检查**（每周）：
   - 重新抓取内容，计算 contentHash
   - 如果变化 > 30%，触发摘要重新生成

3. **用户触发**：
   - 详情页增加"刷新摘要"按钮
   - 用户点击后立即重新生成

**C. 版本管理**

```typescript
interface SummaryVersion {
  version: number;
  generatedAt: Date;
  contentHash: string; // 对应的内容指纹
  summary: string; // JSON 格式的摘要
  qualityScore?: number; // 质量评分
}
```

保留历史版本，允许用户"查看旧版摘要"（如果新摘要质量下降）。

---

## 五、多模态摘要增强 (Multimodal Enhancement)

### 5.1 图片内容提取

**目标**：对于图片密集的文章（如设计稿、流程图），提取图片的 alt 文本和描述。

**实施**：

1. 使用 Jina Reader 提取 Markdown 中的图片信息
2. 在 Prompt 中注入图片描述：
   ```markdown
   【图片信息】

   1. [图片: React 组件架构图] - 展示了组件层级关系
   2. [图片: 性能对比图表] - 优化前后 FPS 对比
   ```
3. AI 在生成摘要时，可以引用图片信息：
   ```json
   {
     "key_points": [
       "📊 性能优化后 FPS 提升 40%（见对比图）",
       "🏗️ 组件架构采用三层设计（见架构图）"
     ]
   }
   ```

### 5.2 视频时间戳摘要

**目标**：对于 B站/YouTube 视频，生成"带时间戳的摘要"。

**实施**：

1. 提取视频字幕（已有规划）
2. 在 Prompt 中要求 AI 标注关键时间点：
   ```json
   {
     "key_points": [
       "🎬 02:30 - 介绍了 React Server Components 的核心概念",
       "💡 05:15 - 演示了 Next.js 13 的路由优化",
       "⚠️ 08:45 - 提到了 SSR 的性能陷阱"
     ]
   }
   ```
3. 前端渲染时，时间戳可点击，跳转到视频对应位置

---

## 六、摘要的语义理解与推荐 (Semantic Understanding)

### 6.1 相似内容推荐

**目标**：基于摘要的语义向量，推荐"相似收藏"。

**实施**：

1. 摘要生成后，同时生成**语义向量**（使用 Supabase pgvector）
2. 在详情页底部显示"相似收藏"：
   ```typescript
   // 伪代码
   const similarBookmarks = await supabase
     .from("bookmarks")
     .select("*")
     .match({ embedding: summaryEmbedding })
     .limit(5);
   ```

### 6.2 主题聚类

**目标**：自动发现用户的"收藏主题"，形成知识图谱。

**实施**：

1. 定期（每周）对用户的所有摘要进行聚类分析
2. 识别出 3-5 个主要主题（如"前端性能优化"、"设计模式"）
3. 在首页展示"你的知识主题"，点击后筛选相关收藏

---

## 七、摘要的跨语言支持 (Multilingual Support)

### 7.1 问题

**现状**：用户可能收藏英文技术文档，但摘要用中文生成，可能丢失关键术语。

**目标**：检测内容语言，使用对应语言生成摘要。

### 7.2 实施策略

**A. 语言检测**

```typescript
// 使用简单的启发式规则（或接入语言检测 API）
function detectContentLanguage(content: string): "zh" | "en" | "mixed" {
  const chineseCharCount = (content.match(/[\u4e00-\u9fa5]/g) || []).length;
  const totalCharCount = content.length;
  const chineseRatio = chineseCharCount / totalCharCount;

  if (chineseRatio > 0.5) return "zh";
  if (chineseRatio < 0.1) return "en";
  return "mixed";
}
```

**B. 多语言 Prompt**

```markdown
【语言要求】

- 如果内容主要是英文，摘要也用英文生成
- 如果内容是中英混合，摘要用中文，但保留关键英文术语（如 "React Hooks"、"Server Components"）
```

---

## 八、摘要的元数据增强 (Metadata Enhancement)

### 8.1 提取额外信息

**目标**：从内容中提取作者、发布时间、来源网站等元数据。

**实施**：

1. **作者提取**：
   - 从 HTML `<meta name="author">` 提取
   - 或从 Markdown 标题下的"作者：XXX"提取
   - 存储到 `bookmarks.author` 字段

2. **发布时间提取**：
   - 从 `<time>` 标签或 `<meta property="article:published_time">` 提取
   - 用于判断内容"新鲜度"（3 个月前的技术文章可能已过时）

3. **来源网站信息**：
   - 提取网站 favicon、描述
   - 用于"同源内容推荐"（"来自同一网站的其他文章"）

### 8.2 摘要中引用元数据

```json
{
  "tldr": "本文由 React 核心团队成员 Dan Abramov 撰写，介绍了 React 19 的新特性...",
  "metadata": {
    "author": "Dan Abramov",
    "publishedAt": "2024-12-01",
    "sourceSite": "react.dev"
  }
}
```

---

## 九、摘要的智能缓存 (Smart Caching)

### 9.1 问题

**现状**：相同 URL 的收藏，每次都重新生成摘要，浪费 API 成本。

**目标**：相同 URL 的摘要可以复用（但需考虑用户个性化差异）。

### 9.2 实施策略

**A. 全局摘要缓存**

```typescript
interface GlobalSummaryCache {
  url: string;
  contentHash: string; // 内容指纹
  summary: string; // 通用摘要（无个性化）
  generatedAt: Date;
  qualityScore: number;
  usageCount: number; // 被复用的次数
}
```

**B. 缓存策略**

1. **完全匹配**：URL + contentHash 完全一致 → 直接复用
2. **个性化增强**：复用通用摘要，但根据用户画像调整 keywords 和 action_items
3. **缓存失效**：contentHash 变化或超过 30 天 → 重新生成

**C. 成本优化**

- 假设 1000 个用户收藏了同一篇热门文章
- 无缓存：1000 次 API 调用 = 1000 元成本
- 有缓存：1 次 API 调用 + 999 次个性化调整 = 约 10 元成本
- **节省 99% 成本**

---

## 十、实施优先级建议

### P0 (立即实施)

1. **摘要质量评估体系**（第 1 节）
2. **卡片背面的渐进式展示**（第 3 节）
3. **摘要的智能缓存**（第 9 节）

### P1 (1-2 周内)

4. **个性化摘要生成**（第 2 节）
5. **摘要的时效性检查**（第 4 节）
6. **视频时间戳摘要**（第 5.2 节）

### P2 (1 个月内)

7. **多模态摘要增强**（第 5.1 节）
8. **语义理解与推荐**（第 6 节）
9. **跨语言支持**（第 7 节）
10. **元数据增强**（第 8 节）

---

## 十一、技术实现建议

### 11.1 数据库 Schema 扩展

```sql
-- 摘要质量指标表
CREATE TABLE summary_quality_metrics (
  id BIGSERIAL PRIMARY KEY,
  bookmark_id BIGINT REFERENCES bookmarks(id),
  user_id UUID REFERENCES auth.users(id),
  click_through_rate DECIMAL(5,2),
  average_view_time INTEGER,  -- 秒
  feedback_score DECIMAL(3,2), -- -1 到 1
  overall_score INTEGER,       -- 0-100
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 全局摘要缓存表
CREATE TABLE global_summary_cache (
  id BIGSERIAL PRIMARY KEY,
  url TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  summary JSONB NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  quality_score INTEGER,
  usage_count INTEGER DEFAULT 0,
  UNIQUE(url, content_hash)
);

-- 用户兴趣画像表
CREATE TABLE user_interest_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  tech_stack TEXT[],
  content_type_weights JSONB,
  summary_style TEXT,  -- 'concise' | 'detailed' | 'actionable'
  domain_tags TEXT[],
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 11.2 API 端点设计

```typescript
// 重新生成摘要（带质量评估）
POST /api/bookmarks/:id/regenerate-summary
Body: { reason: "low_quality" | "content_updated" | "user_request" }

// 提交摘要反馈
POST /api/bookmarks/:id/summary-feedback
Body: { helpful: boolean, comment?: string }

// 获取相似收藏
GET /api/bookmarks/:id/similar
Query: { limit?: number }

// 刷新摘要（检查内容更新）
POST /api/bookmarks/:id/refresh-summary
```

---

## 十二、成功指标 (Success Metrics)

### 12.1 质量指标

- **摘要准确率**：用户反馈"有帮助"的比例 > 80%
- **点击率提升**：有摘要的收藏，详情页点击率提升 30%
- **平均停留时间**：详情页平均停留时间 > 60 秒

### 12.2 成本指标

- **API 调用减少**：通过缓存，API 调用减少 70%
- **重试率降低**：低质量摘要自动重试后，重试率 < 5%

### 12.3 用户满意度

- **NPS 提升**：摘要功能相关的 NPS 提升 20 分
- **使用频率**：用户每周查看摘要的次数 > 10 次

---

## 总结

这 10 个优化方向，从"质量评估"到"智能缓存"，形成了一个完整的 AI 摘要优化闭环。建议优先实施 **P0 级别的 3 个功能**，它们能带来最直接的体验提升和成本优化。

**下一步行动**：

1. 评审本方案，确定优先级
2. 设计数据库 Schema 扩展
3. 实现摘要质量评估体系（MVP 版本）
4. 优化卡片背面的渐进式展示
