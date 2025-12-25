# AI Skills Architecture - Phase 2

> **Version**: 2.0.0
> **Date**: 2025-12-24
> **Author**: Winston (System Architect)
> **Status**: Approved for Implementation

---

## 1. Executive Summary

This document defines the architecture for implementing the remaining 5 P0/P1 Skills as outlined in the original implementation plan. The existing architecture (L1) is fully implemented and provides a solid foundation.

### Scope

| Priority | Skill               | Description                           | Estimated Hours |
| -------- | ------------------- | ------------------------------------- | --------------- |
| **P0**   | `duplicate_cleanup` | Smart duplicate detection and cleanup | 15h             |
| **P0**   | `quick_digest`      | Batch summarization with clustering   | 14h             |
| **P1**   | `smart_tagging`     | AI-powered tag recommendations        | 12h             |
| **P1**   | `reading_planner`   | Reading schedule generation           | 10h             |
| **P1**   | `related_discovery` | Semantic similarity finding           | 12h             |

**Total**: 63h (~2 weeks)

---

## 2. Architecture Overview

### 2.1 System Context

```
┌────────────────────────────────────────────────────────────────────────┐
│                         UnifiedEngine (Existing)                        │
├────────────────────────────────────────────────────────────────────────┤
│  IntentRouter ──► ModeSelector ──► OrchestrationEngine                 │
│                                            │                           │
│  ┌─────────────────────────────────────────┴────────────────────────┐  │
│  │                    Registered Skills                              │  │
│  ├───────────────────────────────────────────────────────────────────┤  │
│  │  ✅ knowledge_review    ✅ data_export                            │  │
│  │  ✅ insight_report      ✅ batch_organize                         │  │
│  │  ──────────────────── Phase 2 (New) ─────────────────────────     │  │
│  │  🆕 duplicate_cleanup   🆕 quick_digest                           │  │
│  │  🆕 smart_tagging       🆕 reading_planner                        │  │
│  │  🆕 related_discovery                                             │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Skill Classification

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Skill Categories                             │
├──────────────────┬──────────────────┬───────────────────────────────┤
│   Understanding  │    Organizing    │         Learning              │
├──────────────────┼──────────────────┼───────────────────────────────┤
│ quick_digest     │ duplicate_cleanup│ reading_planner               │
│ related_discovery│ smart_tagging    │ knowledge_review (existing)   │
│                  │ batch_organize ✅ │                               │
└──────────────────┴──────────────────┴───────────────────────────────┘
```

---

## 3. Skill Specifications

### 3.1 DuplicateCleanupSkill

**ID**: `duplicate_cleanup`
**Category**: `organizing`
**Priority**: P0

#### Purpose

Intelligently detect and clean duplicate bookmarks using multiple strategies:

- Exact URL matching
- Normalized URL matching (remove tracking params, www, etc.)
- Semantic similarity (optional, for near-duplicates)

#### Input Schema

```typescript
interface DuplicateCleanupInput {
  scope: "all" | "folder" | "selected";
  folderId?: number;
  bookmarkIds?: number[];
  strategy: "exact" | "normalized" | "semantic";
  semanticThreshold?: number; // 0.8-0.99, default 0.9
  autoCleanup: boolean; // Default false, require confirmation
  keepStrategy: "oldest" | "newest" | "most_complete";
}
```

#### Output Schema

```typescript
interface DuplicateCleanupOutput {
  stats: {
    totalScanned: number;
    duplicateGroupsFound: number;
    totalDuplicates: number;
    spaceRecoverable: number; // Estimated
  };
  duplicateGroups: Array<{
    id: string;
    strategy: "exact" | "normalized" | "semantic";
    similarity?: number;
    bookmarks: Array<{
      id: number;
      title: string;
      url: string;
      createdAt: string;
      folderName?: string;
      completeness: number; // 0-100, based on tags, summary, etc.
    }>;
    recommendedKeep: number; // Bookmark ID to keep
    reason: string;
  }>;
  actionsExecuted: Array<{
    action: "deleted" | "merged";
    bookmarkId: number;
    mergedInto?: number;
  }>;
  summary: string;
  generatedAt: string;
}
```

#### Execution Steps

| Step         | Weight | Description                    |
| ------------ | ------ | ------------------------------ |
| 1. Collect   | 15%    | Fetch bookmarks based on scope |
| 2. Normalize | 20%    | Normalize URLs for comparison  |
| 3. Detect    | 30%    | Group duplicates by strategy   |
| 4. Analyze   | 15%    | Calculate completeness scores  |
| 5. Confirm   | 10%    | Request user confirmation      |
| 6. Execute   | 10%    | Perform cleanup actions        |

#### URL Normalization Rules

```typescript
function normalizeUrl(url: string): string {
  const parsed = new URL(url);

  // Remove tracking parameters
  const trackingParams = [
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "fbclid",
    "gclid",
    "ref",
    "source",
    "from",
  ];
  trackingParams.forEach((p) => parsed.searchParams.delete(p));

  // Normalize
  return (
    parsed.host.replace(/^www\./, "").toLowerCase() +
    parsed.pathname.replace(/\/$/, "") +
    (parsed.searchParams.toString() ? "?" + parsed.searchParams.toString() : "")
  );
}
```

#### Intent Triggers

```typescript
const TRIGGERS = [
  /重复|去重|清理重复/,
  /duplicate|clean.*dup/i,
  /合并.*书签|书签.*合并/,
];
```

---

### 3.2 QuickDigestSkill

**ID**: `quick_digest`
**Category**: `understanding`
**Priority**: P0

#### Purpose

Generate batch summaries of bookmarks with intelligent topic clustering, outputting in multiple formats.

#### Input Schema

```typescript
interface QuickDigestInput {
  scope: "today" | "week" | "month" | "folder" | "selected";
  folderId?: number;
  bookmarkIds?: number[];
  outputFormat: "markdown" | "mindmap" | "cards" | "outline";
  groupBy: "topic" | "platform" | "date" | "none";
  maxItems: number; // 10-100, default 30
  summaryLength: "brief" | "standard" | "detailed";
  includeInsights: boolean;
}
```

#### Output Schema

```typescript
interface QuickDigestOutput {
  stats: {
    totalProcessed: number;
    topicsIdentified: number;
    platformDistribution: Record<string, number>;
    dateRange: { start: string; end: string };
  };
  digest: {
    title: string;
    generatedAt: string;
    format: string;
    content: string; // Formatted output
  };
  topics: Array<{
    name: string;
    count: number;
    keywords: string[];
    bookmarks: Array<{
      id: number;
      title: string;
      summary: string;
      url: string;
    }>;
  }>;
  insights?: Array<{
    type: "trend" | "gap" | "recommendation";
    content: string;
  }>;
  suggestions: string[];
}
```

#### Execution Steps

| Step         | Weight | Description                       |
| ------------ | ------ | --------------------------------- |
| 1. Collect   | 15%    | Fetch bookmarks with summaries    |
| 2. Cluster   | 25%    | Group by topics using AI          |
| 3. Summarize | 30%    | Generate per-topic summaries      |
| 4. Format    | 20%    | Format output by chosen format    |
| 5. Deliver   | 10%    | Generate downloadable deliverable |

#### Topic Clustering Algorithm

```typescript
async function clusterByTopic(bookmarks: Bookmark[]): Promise<TopicGroup[]> {
  // 1. Extract keywords from titles and tags
  const keywordMap = extractKeywords(bookmarks);

  // 2. Build similarity matrix
  const similarity = buildSimilarityMatrix(bookmarks);

  // 3. Apply hierarchical clustering
  const clusters = hierarchicalClustering(similarity, {
    minClusterSize: 2,
    maxClusters: 10,
    threshold: 0.3,
  });

  // 4. Name clusters using most common keywords
  return nameClusters(clusters, keywordMap);
}
```

#### Output Formats

**Markdown**:

```markdown
# 本周阅读摘要

> 生成时间: 2025-12-24

## 📚 主题: React 性能优化 (5篇)

关键词: memo, useMemo, 渲染优化

### 核心要点

- React.memo 用于组件缓存
- useMemo 用于计算结果缓存
  ...
```

**Mindmap** (Markmap format):

```markdown
# 本周摘要

## React 性能优化

- memo
- useMemo
- useCallback

## TypeScript 技巧

- 类型推断
- 泛型
```

**Cards** (JSON):

```json
{
  "cards": [
    {
      "topic": "React 性能优化",
      "summary": "...",
      "keyPoints": ["...", "..."],
      "sources": [...]
    }
  ]
}
```

---

### 3.3 SmartTaggingSkill

**ID**: `smart_tagging`
**Category**: `organizing`
**Priority**: P1

#### Purpose

AI-powered tag recommendation system that analyzes content and suggests relevant tags.

#### Input Schema

```typescript
interface SmartTaggingInput {
  scope: "untagged" | "all" | "selected";
  bookmarkIds?: number[];
  mode: "suggest" | "auto-apply" | "normalize";
  maxTagsPerBookmark: number; // 3-10, default 5
  useExistingTags: boolean; // Prefer user's existing tag vocabulary
  normalizeOptions?: {
    mergeSimilar: boolean; // Merge "React" and "react"
    removeRare: boolean; // Remove tags used only once
    translateToLanguage?: string;
  };
}
```

#### Output Schema

```typescript
interface SmartTaggingOutput {
  stats: {
    totalProcessed: number;
    suggestionsGenerated: number;
    tagsNormalized: number;
    tagsApplied: number;
  };
  suggestions: Array<{
    bookmarkId: number;
    bookmarkTitle: string;
    currentTags: string[];
    suggestedTags: Array<{
      tag: string;
      confidence: number;
      reason: string;
    }>;
  }>;
  normalization?: {
    mergedTags: Array<{
      original: string[];
      normalized: string;
      affectedBookmarks: number;
    }>;
    removedTags: Array<{
      tag: string;
      reason: string;
    }>;
  };
  tagStatistics: {
    totalUniqueTags: number;
    topTags: Array<{ tag: string; count: number }>;
    suggestedNewTags: string[];
  };
  summary: string;
}
```

#### Execution Steps

| Step        | Weight | Description                       |
| ----------- | ------ | --------------------------------- |
| 1. Analyze  | 20%    | Analyze bookmark content          |
| 2. Extract  | 25%    | Extract keywords and entities     |
| 3. Match    | 20%    | Match against existing vocabulary |
| 4. Generate | 25%    | Generate tag suggestions          |
| 5. Report   | 10%    | Generate summary report           |

#### Tag Generation Strategy

```typescript
async function generateTagSuggestions(
  bookmark: Bookmark,
): Promise<TagSuggestion[]> {
  const suggestions: TagSuggestion[] = [];

  // 1. Platform-based tags
  const platformTags = PLATFORM_TAG_MAP[bookmark.platform];

  // 2. AI-generated tags (from ai_tags field)
  const aiTags = bookmark.ai_tags || [];

  // 3. Title keyword extraction
  const titleKeywords = extractKeywords(bookmark.title);

  // 4. Summary keyword extraction
  const summaryKeywords = extractKeywords(bookmark.ai_summary);

  // 5. Score and rank
  return rankTags([
    ...platformTags,
    ...aiTags,
    ...titleKeywords,
    ...summaryKeywords,
  ]);
}
```

---

### 3.4 ReadingPlannerSkill

**ID**: `reading_planner`
**Category**: `learning`
**Priority**: P1

#### Purpose

Create personalized reading plans based on available time, reading speed, and content priorities.

#### Input Schema

```typescript
interface ReadingPlannerInput {
  goal: "clear_backlog" | "learn_topic" | "daily_routine" | "custom";
  topic?: string;
  timeAvailable: {
    dailyMinutes: number; // 15-120
    daysPerWeek: number; // 1-7
    totalWeeks?: number; // 1-12
  };
  preferences: {
    prioritizeBy: "date" | "importance" | "reading_time" | "topic";
    includeReview: boolean;
    groupByTopic: boolean;
  };
  scope?: {
    folderId?: number;
    tags?: string[];
    unreadOnly?: boolean;
  };
}
```

#### Output Schema

```typescript
interface ReadingPlannerOutput {
  plan: {
    id: string;
    name: string;
    goal: string;
    createdAt: string;
    duration: {
      startDate: string;
      endDate: string;
      totalDays: number;
    };
  };
  schedule: Array<{
    day: number;
    date: string;
    estimatedMinutes: number;
    items: Array<{
      bookmarkId: number;
      title: string;
      estimatedReadTime: number;
      priority: "high" | "medium" | "low";
      isReview: boolean;
    }>;
  }>;
  stats: {
    totalItems: number;
    totalReadingTime: number;
    averagePerDay: number;
    topicCoverage: Record<string, number>;
  };
  milestones: Array<{
    day: number;
    description: string;
    itemsCompleted: number;
  }>;
  summary: string;
  suggestions: string[];
}
```

#### Execution Steps

| Step          | Weight | Description               |
| ------------- | ------ | ------------------------- |
| 1. Assess     | 20%    | Assess reading backlog    |
| 2. Estimate   | 20%    | Estimate reading times    |
| 3. Prioritize | 20%    | Rank by priority criteria |
| 4. Schedule   | 30%    | Generate daily schedule   |
| 5. Report     | 10%    | Generate plan report      |

#### Reading Time Estimation

```typescript
function estimateReadTime(bookmark: Bookmark): number {
  // Base estimates by platform (minutes)
  const PLATFORM_ESTIMATES: Record<string, number> = {
    wechat: 8, // WeChat articles
    bilibili: 15, // Video content
    zhihu: 10, // Q&A
    github: 20, // Code repos
    twitter: 2, // Short posts
    medium: 12, // Blog posts
    default: 10,
  };

  let estimate =
    PLATFORM_ESTIMATES[bookmark.platform] || PLATFORM_ESTIMATES.default;

  // Adjust by content length if available
  if (bookmark.content_length) {
    const wordsPerMinute = 200;
    estimate = Math.ceil(bookmark.content_length / wordsPerMinute);
  }

  return Math.max(2, Math.min(60, estimate));
}
```

#### Database Migration Required

```sql
-- reading_plans table
CREATE TABLE reading_plans (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  goal TEXT NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
  config JSONB NOT NULL,
  total_items INTEGER NOT NULL,
  completed_items INTEGER DEFAULT 0,
  total_minutes INTEGER NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- reading_plan_items table
CREATE TABLE reading_plan_items (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  plan_id BIGINT NOT NULL REFERENCES reading_plans(id) ON DELETE CASCADE,
  bookmark_id BIGINT NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,
  scheduled_day INTEGER NOT NULL,
  scheduled_date DATE NOT NULL,
  estimated_minutes INTEGER NOT NULL,
  priority TEXT DEFAULT 'medium',
  is_review BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'skipped')),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_reading_plans_user ON reading_plans(user_id);
CREATE INDEX idx_reading_plans_status ON reading_plans(status);
CREATE INDEX idx_reading_plan_items_plan ON reading_plan_items(plan_id);
CREATE INDEX idx_reading_plan_items_date ON reading_plan_items(scheduled_date);
```

---

### 3.5 RelatedDiscoverySkill

**ID**: `related_discovery`
**Category**: `understanding`
**Priority**: P1

#### Purpose

Find semantically related bookmarks using vector similarity search and build knowledge connections.

#### Input Schema

```typescript
interface RelatedDiscoveryInput {
  source: "bookmark" | "topic" | "query";
  bookmarkId?: number;
  topic?: string;
  query?: string;
  limit: number; // 5-50, default 20
  minSimilarity: number; // 0.5-0.95, default 0.7
  includeExplanation: boolean;
  groupByCluster: boolean;
}
```

#### Output Schema

```typescript
interface RelatedDiscoveryOutput {
  source: {
    type: string;
    bookmark?: { id: number; title: string; url: string };
    topic?: string;
    query?: string;
  };
  relatedItems: Array<{
    bookmarkId: number;
    title: string;
    url: string;
    platform: string;
    similarity: number;
    explanation?: string;
    sharedTopics: string[];
    cluster?: string;
  }>;
  clusters?: Array<{
    name: string;
    count: number;
    avgSimilarity: number;
    bookmarkIds: number[];
  }>;
  knowledgeGraph?: {
    nodes: Array<{ id: number; title: string; type: string }>;
    edges: Array<{ source: number; target: number; weight: number }>;
  };
  stats: {
    totalFound: number;
    avgSimilarity: number;
    topicsDiscovered: string[];
  };
  suggestions: string[];
}
```

#### Execution Steps

| Step       | Weight | Description               |
| ---------- | ------ | ------------------------- |
| 1. Embed   | 20%    | Get/generate embeddings   |
| 2. Search  | 30%    | Vector similarity search  |
| 3. Cluster | 20%    | Group similar items       |
| 4. Explain | 20%    | Generate explanations     |
| 5. Report  | 10%    | Generate discovery report |

#### Vector Search Implementation

```typescript
async function findRelated(
  userId: string,
  embedding: number[],
  options: { limit: number; minSimilarity: number },
): Promise<RelatedBookmark[]> {
  const supabase = await createClient();

  // Use pgvector similarity search
  const { data, error } = await supabase.rpc("match_bookmarks", {
    query_embedding: embedding,
    match_threshold: options.minSimilarity,
    match_count: options.limit,
    p_user_id: userId,
  });

  if (error) throw error;
  return data;
}

// SQL Function (if not exists)
/*
CREATE OR REPLACE FUNCTION match_bookmarks(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  p_user_id uuid
)
RETURNS TABLE (
  id bigint,
  title text,
  url text,
  platform text,
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
    b.platform,
    1 - (b.embedding <=> query_embedding) as similarity
  FROM bookmarks b
  WHERE b.user_id = p_user_id
    AND b.embedding IS NOT NULL
    AND b.deleted_at IS NULL
    AND 1 - (b.embedding <=> query_embedding) > match_threshold
  ORDER BY b.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
*/
```

---

## 4. Implementation Plan

### 4.1 Phase 2 Timeline

```
Week 1 (P0 Skills)
├── Day 1-2: duplicate_cleanup
│   ├── Create types and schemas
│   ├── Implement URL normalization
│   └── Implement duplicate detection
├── Day 3-4: duplicate_cleanup
│   ├── Implement confirmation flow
│   ├── Implement cleanup execution
│   └── Write tests
├── Day 5: quick_digest
│   ├── Create types and schemas
│   └── Implement data collection

Week 2 (P0 + P1 Skills)
├── Day 1-2: quick_digest
│   ├── Implement topic clustering
│   ├── Implement format generators
│   └── Write tests
├── Day 3: smart_tagging
│   ├── Create types and schemas
│   └── Implement tag extraction
├── Day 4-5: smart_tagging
│   ├── Implement tag suggestions
│   ├── Implement normalization
│   └── Write tests

Week 3 (P1 Skills)
├── Day 1-2: reading_planner
│   ├── Database migration
│   ├── Create types and schemas
│   └── Implement time estimation
├── Day 3: reading_planner
│   ├── Implement schedule generation
│   └── Write tests
├── Day 4-5: related_discovery
│   ├── Create types and schemas
│   ├── Implement vector search
│   └── Implement clustering
│   └── Write tests
```

### 4.2 File Structure

```
src/lib/ai-skills/skills/
├── duplicate-cleanup/
│   ├── duplicate-cleanup.skill.ts
│   ├── url-normalizer.ts
│   ├── similarity-detector.ts
│   ├── types.ts
│   ├── index.ts
│   └── __tests__/
│       └── duplicate-cleanup.skill.test.ts
│
├── quick-digest/
│   ├── quick-digest.skill.ts
│   ├── topic-clusterer.ts
│   ├── formatters/
│   │   ├── markdown.formatter.ts
│   │   ├── mindmap.formatter.ts
│   │   ├── cards.formatter.ts
│   │   └── index.ts
│   ├── types.ts
│   ├── index.ts
│   └── __tests__/
│       └── quick-digest.skill.test.ts
│
├── smart-tagging/
│   ├── smart-tagging.skill.ts
│   ├── tag-extractor.ts
│   ├── tag-normalizer.ts
│   ├── types.ts
│   ├── index.ts
│   └── __tests__/
│       └── smart-tagging.skill.test.ts
│
├── reading-planner/
│   ├── reading-planner.skill.ts
│   ├── time-estimator.ts
│   ├── schedule-generator.ts
│   ├── types.ts
│   ├── index.ts
│   └── __tests__/
│       └── reading-planner.skill.test.ts
│
└── related-discovery/
    ├── related-discovery.skill.ts
    ├── embedding-service.ts
    ├── cluster-analyzer.ts
    ├── types.ts
    ├── index.ts
    └── __tests__/
        └── related-discovery.skill.test.ts
```

### 4.3 Database Migrations

```
supabase/migrations/
├── 20251224100001_add_reading_plans.sql
└── 20251224100002_add_vector_search_function.sql
```

---

## 5. Intent Router Updates

### 5.1 New Intent Mappings

```typescript
// Update intent-classifier.ts

const SKILL_INTENT_MAP: Record<string, string[]> = {
  // Existing
  knowledge_review: ["复习", "回顾", "review"],
  data_export: ["导出", "下载", "export"],
  insight_report: ["报告", "统计", "分析"],
  batch_organize: ["整理", "分类", "organize"],

  // Phase 2 - New
  duplicate_cleanup: ["重复", "去重", "清理重复", "duplicate", "合并书签"],
  quick_digest: ["摘要", "总结", "digest", "汇总", "概览"],
  smart_tagging: ["打标", "标签", "tag", "加标签"],
  reading_planner: ["阅读计划", "阅读安排", "reading plan", "每日阅读"],
  related_discovery: ["相关", "关联", "类似", "similar", "推荐相似"],
};
```

### 5.2 Complexity Evaluation Updates

```typescript
// Update complexity-evaluator.ts

const SKILL_COMPLEXITY_MAP: Record<string, ComplexityLevel> = {
  // P0 Skills
  duplicate_cleanup: "medium", // Needs confirmation
  quick_digest: "medium", // Multi-step processing

  // P1 Skills
  smart_tagging: "simple", // Can be quick suggestions
  reading_planner: "complex", // Multi-day planning
  related_discovery: "medium", // Vector search
};
```

---

## 6. Frontend Components (Phase 2)

### 6.1 Required Components

| Component             | Skill             | Priority |
| --------------------- | ----------------- | -------- |
| `DuplicatePreview`    | duplicate_cleanup | P0       |
| `DigestView`          | quick_digest      | P0       |
| `MindmapViewer`       | quick_digest      | P1       |
| `TagSuggestionList`   | smart_tagging     | P1       |
| `ReadingPlanCalendar` | reading_planner   | P1       |
| `RelatedGraph`        | related_discovery | P2       |

### 6.2 Component Specifications

```
src/components/ai/skills/
├── duplicate-cleanup/
│   ├── DuplicateGroupCard.tsx
│   ├── DuplicatePreview.tsx
│   └── index.ts
│
├── quick-digest/
│   ├── DigestView.tsx
│   ├── TopicCard.tsx
│   ├── MindmapViewer.tsx (optional)
│   └── index.ts
│
├── smart-tagging/
│   ├── TagSuggestionList.tsx
│   ├── TagChip.tsx
│   └── index.ts
│
├── reading-planner/
│   ├── ReadingPlanCalendar.tsx
│   ├── DailyReadingCard.tsx
│   └── index.ts
│
└── related-discovery/
    ├── RelatedList.tsx
    ├── RelatedGraph.tsx (optional)
    └── index.ts
```

---

## 7. Testing Strategy

### 7.1 Unit Tests

Each Skill must have:

- Input parsing tests
- Step execution tests
- Output validation tests
- Error handling tests

### 7.2 Integration Tests

```typescript
// Example integration test
describe("DuplicateCleanupSkill Integration", () => {
  it("should detect URL duplicates", async () => {
    // Setup test bookmarks with duplicate URLs
    const context = createTestContext({
      userId: testUserId,
      params: {
        scope: "all",
        strategy: "normalized",
      },
    });

    const chunks = [];
    for await (const chunk of skill.executeStream(context)) {
      chunks.push(chunk);
    }

    expect(chunks.some((c) => c.type === "progress")).toBe(true);
    expect(chunks.some((c) => c.type === "deliverable")).toBe(true);
  });
});
```

---

## 8. Acceptance Criteria

### 8.1 Per-Skill Criteria

| Skill               | Criteria                                  |
| ------------------- | ----------------------------------------- |
| `duplicate_cleanup` | Detects >95% of URL duplicates            |
| `quick_digest`      | Generates meaningful topic clusters       |
| `smart_tagging`     | Suggests relevant tags with >80% accuracy |
| `reading_planner`   | Creates balanced daily schedules          |
| `related_discovery` | Returns semantically similar items        |

### 8.2 Overall Criteria

- [ ] All 5 Skills registered in UnifiedEngine
- [ ] Intent routing works for all new Skills
- [ ] Unit test coverage >80%
- [ ] No P0/P1 bugs
- [ ] Documentation updated

---

## 9. Risks and Mitigations

| Risk                          | Probability | Impact | Mitigation                     |
| ----------------------------- | ----------- | ------ | ------------------------------ |
| Vector search performance     | Medium      | High   | Add indexes, implement caching |
| Topic clustering accuracy     | Medium      | Medium | Use existing AI tags as hints  |
| Reading time estimation       | Low         | Low    | Allow user adjustment          |
| Semantic similarity threshold | Medium      | Medium | Make configurable              |

---

## 10. Appendix

### A. Intent Trigger Patterns

```typescript
export const PHASE2_TRIGGERS = {
  duplicate_cleanup: [
    /重复.*书签|书签.*重复/,
    /去重|清理重复|合并.*重复/,
    /duplicate|clean.*dup/i,
  ],
  quick_digest: [
    /摘要|总结|汇总/,
    /digest|summary|overview/i,
    /本周.*阅读|阅读.*总结/,
  ],
  smart_tagging: [/打标|标签|加标签/, /tag|label/i, /智能.*标签|自动.*标签/],
  reading_planner: [/阅读计划|阅读安排/, /reading.*plan/i, /每日阅读|安排阅读/],
  related_discovery: [
    /相关|类似|关联/,
    /similar|related|recommend/i,
    /找.*相似|推荐.*相关/,
  ],
};
```

### B. Configuration Constants

```typescript
// src/lib/ai-skills/config/skill-config.ts

export const PHASE2_CONFIG = {
  DUPLICATE_CLEANUP: {
    MAX_BOOKMARKS: 1000,
    SEMANTIC_THRESHOLD_DEFAULT: 0.9,
    TRACKING_PARAMS: [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "fbclid",
      "gclid",
    ],
  },
  QUICK_DIGEST: {
    MAX_ITEMS: 100,
    MIN_CLUSTER_SIZE: 2,
    MAX_CLUSTERS: 10,
  },
  SMART_TAGGING: {
    MAX_TAGS_PER_BOOKMARK: 10,
    MIN_TAG_CONFIDENCE: 0.6,
  },
  READING_PLANNER: {
    DEFAULT_READING_SPEED: 200, // words per minute
    MAX_DAILY_MINUTES: 120,
    MAX_PLAN_WEEKS: 12,
  },
  RELATED_DISCOVERY: {
    DEFAULT_SIMILARITY: 0.7,
    MAX_RESULTS: 50,
    EMBEDDING_DIMENSION: 1536,
  },
};
```

---

**Document End**

> This architecture document is ready for implementation. Start with P0 Skills (`duplicate_cleanup`, `quick_digest`) and proceed to P1 Skills after validation.
