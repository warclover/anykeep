# 技术实现方案：自习工坊 v2.0 升级

> **版本**: 1.0
> **日期**: 2026-01-01
> **关联 PRD**: [prd-brain-sync-upgrade-v2.md](./prd-brain-sync-upgrade-v2.md)
> **状态**: 可落地开发

---

## 1. 实施概览

### 1.1 改动范围

```
src/
├── lib/ai-skills/shared/review/
│   ├── flashcard-generator.ts     [重构] Prompt 升级
│   ├── types.ts                   [修改] 类型扩展
│   └── __tests__/
│       └── flashcard-generator.test.ts [新增] 测试用例
├── components/brain-sync/
│   ├── flashcard-review-card.tsx  [重构] 交互升级
│   ├── related-bookmarks.tsx      [新增] 延伸阅读组件
│   └── review-session.tsx         [修改] 集成新组件
├── app/api/brain-sync/
│   ├── generate/route.ts          [修改] 返回扩展字段
│   ├── response/route.ts          [修改] 接收新字段
│   └── related/route.ts           [新增] 相关书签 API
└── types/
    └── brain-sync.ts              [修改] 类型定义

supabase/migrations/
├── 20260101000001_extend_flashcards_table.sql    [新增]
├── 20260101000002_extend_review_sessions.sql     [新增]
└── 20260101000003_add_related_bookmarks_rpc.sql  [新增]
```

### 1.2 开发顺序

```
Phase 1 (数据层) ──→ Phase 2 (业务层) ──→ Phase 3 (UI层) ──→ Phase 4 (集成)
    │                    │                    │                    │
    ▼                    ▼                    ▼                    ▼
 数据库迁移           Prompt 重构          组件重构            端到端测试
 类型定义             API 修改             延伸阅读
```

---

## 2. Phase 1：数据层改动

### 2.1 数据库迁移脚本

#### 迁移 1：扩展 flashcards 表

**文件**: `supabase/migrations/20260101000001_extend_flashcards_table.sql`

```sql
-- ============================================================================
-- Migration: 扩展 flashcards 表以支持深度问题和思考提示
-- ============================================================================

-- 1. 新增问题深度字段
ALTER TABLE flashcards
ADD COLUMN IF NOT EXISTS question_depth VARCHAR(20) DEFAULT 'understand';

-- 2. 添加约束
ALTER TABLE flashcards
ADD CONSTRAINT flashcards_question_depth_check
CHECK (question_depth IN ('understand', 'apply', 'analyze', 'evaluate'));

-- 3. 新增思考提示字段
ALTER TABLE flashcards
ADD COLUMN IF NOT EXISTS thinking_hint TEXT;

-- 4. 新增参考要点字段（数组）
ALTER TABLE flashcards
ADD COLUMN IF NOT EXISTS key_points TEXT[];

-- 5. 为已存在的卡片设置默认值
UPDATE flashcards
SET
  question_depth = 'understand',
  key_points = ARRAY[answer]
WHERE question_depth IS NULL;

-- 6. 添加注释
COMMENT ON COLUMN flashcards.question_depth IS '问题认知层次：understand/apply/analyze/evaluate';
COMMENT ON COLUMN flashcards.thinking_hint IS '思考方向提示，帮助用户思考而非直接给答案';
COMMENT ON COLUMN flashcards.key_points IS '参考要点数组，用户思考后可对照';
```

#### 迁移 2：扩展 review_sessions 表

**文件**: `supabase/migrations/20260101000002_extend_review_sessions.sql`

```sql
-- ============================================================================
-- Migration: 扩展 review_sessions 表以支持理解深度评估
-- ============================================================================

-- 1. 新增理解深度字段
ALTER TABLE review_sessions
ADD COLUMN IF NOT EXISTS comprehension VARCHAR(20);

-- 2. 添加约束
ALTER TABLE review_sessions
ADD CONSTRAINT review_sessions_comprehension_check
CHECK (comprehension IN ('new_insight', 'reinforced', 'still_confused', 'skipped'));

-- 3. 新增用户笔记字段
ALTER TABLE review_sessions
ADD COLUMN IF NOT EXISTS user_note TEXT;

-- 4. 添加注释
COMMENT ON COLUMN review_sessions.comprehension IS '理解深度反馈：new_insight(有新理解)/reinforced(巩固已知)/still_confused(仍不清楚)/skipped(跳过)';
COMMENT ON COLUMN review_sessions.user_note IS '用户的思考记录';
```

#### 迁移 3：新增相关书签 RPC 函数

**文件**: `supabase/migrations/20260101000003_add_related_bookmarks_rpc.sql`

```sql
-- ============================================================================
-- Migration: 新增获取相关书签的 RPC 函数
-- ============================================================================

CREATE OR REPLACE FUNCTION get_related_bookmarks(
  p_bookmark_id BIGINT,
  p_user_id UUID,
  p_limit INT DEFAULT 3
)
RETURNS TABLE (
  id BIGINT,
  title TEXT,
  relevance_reason TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_source_embedding vector(1536);
  v_source_folder_id BIGINT;
BEGIN
  -- 权限验证
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- 获取源书签的 embedding 和文件夹
  SELECT embedding, folder_id
  INTO v_source_embedding, v_source_folder_id
  FROM bookmarks
  WHERE id = p_bookmark_id AND user_id = p_user_id;

  IF v_source_embedding IS NULL THEN
    -- 如果没有 embedding，返回同文件夹的书签
    RETURN QUERY
    SELECT
      b.id,
      b.title,
      '同一文件夹'::TEXT AS relevance_reason,
      0.5::FLOAT AS similarity
    FROM bookmarks b
    WHERE b.user_id = p_user_id
      AND b.id != p_bookmark_id
      AND b.folder_id = v_source_folder_id
    ORDER BY b.created_at DESC
    LIMIT p_limit;
  ELSE
    -- 使用向量相似度 + 标签匹配
    RETURN QUERY
    SELECT
      b.id,
      b.title,
      CASE
        -- 优先显示共同标签
        WHEN EXISTS (
          SELECT 1 FROM bookmark_tags bt1
          JOIN bookmark_tags bt2 ON bt1.tag_id = bt2.tag_id
          WHERE bt1.bookmark_id = p_bookmark_id
          AND bt2.bookmark_id = b.id
        ) THEN '共同标签：' || (
          SELECT string_agg(t.name, '、' ORDER BY t.name)
          FROM (
            SELECT DISTINCT t.name
            FROM bookmark_tags bt1
            JOIN bookmark_tags bt2 ON bt1.tag_id = bt2.tag_id
            JOIN tags t ON t.id = bt1.tag_id
            WHERE bt1.bookmark_id = p_bookmark_id
            AND bt2.bookmark_id = b.id
            LIMIT 2
          ) t
        )
        -- 其次显示同文件夹
        WHEN b.folder_id = v_source_folder_id THEN '同一文件夹'
        -- 最后显示内容相似
        ELSE '内容相似'
      END AS relevance_reason,
      (1 - (b.embedding <=> v_source_embedding))::FLOAT AS similarity
    FROM bookmarks b
    WHERE b.user_id = p_user_id
      AND b.id != p_bookmark_id
      AND b.embedding IS NOT NULL
    ORDER BY b.embedding <=> v_source_embedding
    LIMIT p_limit;
  END IF;
END;
$$;

-- 添加函数注释
COMMENT ON FUNCTION get_related_bookmarks IS '获取与指定书签相关的其他书签，基于向量相似度和标签匹配';
```

### 2.2 类型定义更新

**文件**: `src/types/brain-sync.ts`

```typescript
// ============================================================================
// Brain-Sync v2.0 类型定义
// ============================================================================

/**
 * 问题认知层次
 * 基于布鲁姆认知分类法
 */
export type QuestionDepth =
  | "understand" // 理解层：用自己的话解释
  | "apply" // 应用层：场景应用
  | "analyze" // 分析层：假设/局限分析
  | "evaluate"; // 评价层：比较评价

/**
 * 理解深度反馈
 */
export type ComprehensionLevel =
  | "new_insight" // 有新理解
  | "reinforced" // 巩固已知
  | "still_confused" // 仍不清楚
  | "skipped"; // 跳过

/**
 * Flashcard v2 结构
 */
export interface FlashcardV2 {
  id: number;
  bookmarkId: number;
  userId: string;

  // 问题层面
  questionDepth: QuestionDepth;
  question: string;
  thinkingHint: string | null;

  // 答案层面
  answer: string; // 保留，兼容旧版
  keyPoints: string[]; // 新增，参考要点
  sourceParagraph: string | null;

  // SM-2 参数
  status: "pending" | "learning" | "mastered" | "archived";
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  nextReviewAt: string | null;
  lastReviewedAt: string | null;

  // 元数据
  difficulty: "easy" | "medium" | "hard";
  createdAt: string;
  updatedAt: string;
}

/**
 * 复习会话记录 v2
 */
export interface ReviewSessionV2 {
  id: number;
  userId: string;
  flashcardId: number;

  // 用户反馈
  response: "mastered" | "fuzzy" | "forgotten";
  comprehension: ComprehensionLevel | null; // 新增
  userNote: string | null; // 新增
  responseTimeMs: number | null;

  // SM-2 参数变化
  prevInterval: number;
  newInterval: number;
  prevEase: number;
  newEase: number;

  // 会话上下文
  sessionType: "scheduled" | "manual" | "chat";
  createdAt: string;
}

/**
 * 相关书签推荐
 */
export interface RelatedBookmark {
  id: number;
  title: string;
  relevanceReason: string; // "共同标签：React, 性能" | "内容相似" | "同一文件夹"
  similarity: number; // 0-1
}

/**
 * 复习响应请求 v2
 */
export interface ReviewResponseRequestV2 {
  flashcardId: number;
  response: "mastered" | "fuzzy" | "forgotten";
  comprehension?: ComprehensionLevel;
  userNote?: string;
}

/**
 * 生成的 Flashcard（LLM 输出）
 */
export interface GeneratedFlashcardV2 {
  questionDepth: QuestionDepth;
  question: string;
  thinkingHint: string;
  keyPoints: string[];
  sourceParagraph: string;
}
```

---

## 3. Phase 2：业务层改动

### 3.1 Prompt 重构

**文件**: `src/lib/ai-skills/shared/review/flashcard-generator.ts`

```typescript
/**
 * Flashcard 生成器 v2
 * 支持多层次深度问题生成
 */

import { generateText } from "ai";
import { logger } from "@/lib/logger";
import { aiProviderRouter } from "@/lib/ai-providers";
import type {
  FlashcardGenerationInput,
  GeneratedFlashcardV2,
  QuestionDepth,
} from "./types";

/**
 * v2 Prompt 模板 - 深度问题生成
 */
const FLASHCARD_GENERATION_PROMPT_V2 = `你是一位擅长促进深度思考的导师，专门帮助高认知群体真正理解和内化知识。

## 任务
基于以下内容，生成 {count} 个能促进深度理解的复习题。

## 内容信息
标题：{title}
摘要：{summary}
原文：{content}

## 问题生成规则

### 问题层次要求（必须覆盖多种层次）

**L1 - understand（理解层）** - 必须至少 1 题
- 问题模式："用你自己的话解释..."、"如果要向非专业人士说明..."
- 目的：检验是否真正理解，而非死记硬背
- 示例："用你自己的话解释为什么 MoE 选择只激活部分专家，假设对方没有技术背景"

**L2 - apply（应用层）** - 必须至少 1 题
- 问题模式："在...场景下如何应用..."、"如果要在...中使用，需要考虑什么"
- 目的：从理论到实践的思考
- 示例："如果你要在一个延迟敏感的在线服务中应用 MoE 架构，会面临什么挑战？"

**L3 - analyze（分析层）** - 可选
- 问题模式："...的前提假设是什么"、"...在什么情况下会失效"
- 目的：批判性思考，理解边界
- 示例："MoE 架构的有效性依赖于哪些前提假设？如果这些假设不成立会怎样？"

**L4 - evaluate（评价层）** - 可选
- 问题模式："与...相比，优劣势是什么"、"如何评估...的效果"
- 目的：比较和判断
- 示例："与传统的稠密模型相比，MoE 在训练和推理上各有什么 trade-off？"

### 每道题必须包含

1. **questionDepth**: 问题层次（understand/apply/analyze/evaluate）
2. **question**: 问题本身（开放式，需要思考才能回答）
3. **thinkingHint**: 思考方向提示（不是答案，是引导思考的方向，1-2句话）
4. **keyPoints**: 参考要点数组（用户思考后可对照，3-5 个要点）
5. **sourceParagraph**: 相关原文片段（不超过 100 字）

### 禁止生成的问题类型

- ❌ 可直接从原文复制答案的问题
- ❌ 是非题、选择题、填空题
- ❌ "列举 N 个..."这类清单记忆题
- ❌ 只需要背诵定义的问题
- ❌ 答案唯一确定的问题

### 质量标准

- ✅ 问题需要用户调动思考才能回答
- ✅ 答案可以有多种合理解读
- ✅ 思考提示是方向性的，不是直接答案
- ✅ 要点是对照参考，不是标准答案

## 输出格式（严格 JSON 数组，不要有其他内容）

\`\`\`json
[
  {
    "questionDepth": "understand",
    "question": "用你自己的话解释...",
    "thinkingHint": "思考方向：考虑...和...的关系",
    "keyPoints": ["要点1", "要点2", "要点3"],
    "sourceParagraph": "原文相关片段..."
  },
  {
    "questionDepth": "apply",
    "question": "在...场景下如何应用...",
    "thinkingHint": "思考方向：关注...约束",
    "keyPoints": ["要点1", "要点2", "要点3"],
    "sourceParagraph": "原文相关片段..."
  }
]
\`\`\`

请只输出 JSON 数组，不要有任何额外的解释或文字。`;

/**
 * 难度对应的层次分布
 */
const DEPTH_DISTRIBUTION: Record<string, QuestionDepth[]> = {
  easy: ["understand", "understand", "apply"],
  medium: ["understand", "apply", "analyze"],
  hard: ["understand", "apply", "analyze", "evaluate"],
};

/**
 * 生成 Flashcards v2
 */
export async function generateFlashcardsV2(
  input: FlashcardGenerationInput,
): Promise<{
  success: boolean;
  flashcards: GeneratedFlashcardV2[];
  error?: string;
}> {
  const { title, summary, content, count, difficulty } = input;

  // 限制内容长度
  const maxContentLength = 4000;
  const truncatedContent =
    content.length > maxContentLength
      ? content.slice(0, maxContentLength) + "..."
      : content;

  // 构建 prompt
  const prompt = FLASHCARD_GENERATION_PROMPT_V2.replace(
    "{count}",
    count.toString(),
  )
    .replace("{title}", title)
    .replace("{summary}", summary || "无摘要")
    .replace("{content}", truncatedContent);

  try {
    const selection = aiProviderRouter.selectProvider({ taskType: "chat" });

    if (!selection?.model) {
      logger.error(
        { title },
        "Flashcard generation failed: No model available",
      );
      return {
        success: false,
        flashcards: [],
        error: "No AI model available",
      };
    }

    const { text } = await generateText({
      model: selection.model,
      prompt,
      temperature: 0.7,
    });

    const flashcards = parseFlashcardsResponseV2(text);

    if (flashcards.length === 0) {
      logger.warn({ title }, "Flashcard generation returned empty result");
      return {
        success: false,
        flashcards: [],
        error: "Failed to generate flashcards",
      };
    }

    // 验证层次分布
    const validatedFlashcards = validateDepthDistribution(
      flashcards,
      difficulty,
    );

    logger.info(
      { title, count: validatedFlashcards.length },
      "Flashcards v2 generated successfully",
    );

    return {
      success: true,
      flashcards: validatedFlashcards,
    };
  } catch (error) {
    logger.error(
      { error: error instanceof Error ? error.message : String(error) },
      "Flashcard generation failed",
    );
    return {
      success: false,
      flashcards: [],
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * 解析 LLM 响应
 */
function parseFlashcardsResponseV2(text: string): GeneratedFlashcardV2[] {
  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((fc): fc is GeneratedFlashcardV2 => {
        return (
          fc &&
          typeof fc.questionDepth === "string" &&
          ["understand", "apply", "analyze", "evaluate"].includes(
            fc.questionDepth,
          ) &&
          typeof fc.question === "string" &&
          fc.question.trim().length > 10 &&
          typeof fc.thinkingHint === "string" &&
          Array.isArray(fc.keyPoints) &&
          fc.keyPoints.length >= 2
        );
      })
      .map((fc) => ({
        questionDepth: fc.questionDepth as QuestionDepth,
        question: fc.question.trim(),
        thinkingHint: fc.thinkingHint.trim(),
        keyPoints: fc.keyPoints.map((p: string) => p.trim()).filter(Boolean),
        sourceParagraph: fc.sourceParagraph?.trim() || "",
      }));
  } catch (error) {
    logger.error({ error }, "Failed to parse flashcards JSON");
    return [];
  }
}

/**
 * 验证层次分布
 */
function validateDepthDistribution(
  flashcards: GeneratedFlashcardV2[],
  difficulty: string,
): GeneratedFlashcardV2[] {
  const hasUnderstand = flashcards.some(
    (f) => f.questionDepth === "understand",
  );
  const hasApply = flashcards.some((f) => f.questionDepth === "apply");

  // 必须至少有 understand 和 apply 各一题
  if (!hasUnderstand || !hasApply) {
    logger.warn(
      { hasUnderstand, hasApply },
      "Flashcards missing required depth levels",
    );
  }

  return flashcards;
}

/**
 * 验证单个 Flashcard 质量 v2
 */
export function validateFlashcardQualityV2(
  flashcard: GeneratedFlashcardV2,
): boolean {
  // 问题长度检查
  if (flashcard.question.length < 15 || flashcard.question.length > 500) {
    return false;
  }

  // 思考提示检查
  if (!flashcard.thinkingHint || flashcard.thinkingHint.length < 10) {
    return false;
  }

  // 要点数量检查
  if (flashcard.keyPoints.length < 2 || flashcard.keyPoints.length > 7) {
    return false;
  }

  // 检查是否是有效的开放式问题
  const openQuestionPatterns = [
    /^(用你|如果|在.*场景|假设|为什么|如何|怎么|什么情况|与.*相比)/,
    /\?$/,
  ];

  return openQuestionPatterns.some((pattern) =>
    pattern.test(flashcard.question),
  );
}
```

### 3.2 API 修改

#### 3.2.1 修改 generate API

**文件**: `src/app/api/brain-sync/generate/route.ts`

在现有基础上修改，使用 `generateFlashcardsV2`：

```typescript
// 关键修改点
import { generateFlashcardsV2 } from "@/lib/ai-skills/shared/review/flashcard-generator";

// 在 POST handler 中
const result = await generateFlashcardsV2({
  title: bookmark.title,
  summary: bookmark.ai_summary || "",
  content: bookmark.content || bookmark.ai_summary || "",
  count: count,
  difficulty: difficulty,
});

// 保存时包含新字段
const flashcardsToInsert = result.flashcards.map((fc) => ({
  user_id: user.id,
  bookmark_id: bookmarkId,
  question: fc.question,
  answer: fc.keyPoints.join("\n"), // 兼容旧版
  question_depth: fc.questionDepth,
  thinking_hint: fc.thinkingHint,
  key_points: fc.keyPoints,
  source_paragraph: fc.sourceParagraph,
  difficulty: difficulty,
  status: "pending",
  ease_factor: 2.5,
  interval_days: 1,
  repetitions: 0,
  next_review_at: new Date().toISOString(),
}));
```

#### 3.2.2 修改 response API

**文件**: `src/app/api/brain-sync/response/route.ts`

新增接收 comprehension 和 userNote：

```typescript
// 请求体类型扩展
interface ReviewResponseBody {
  flashcardId: number;
  response: "mastered" | "fuzzy" | "forgotten";
  comprehension?: "new_insight" | "reinforced" | "still_confused" | "skipped";
  userNote?: string;
}

// 在插入 review_sessions 时包含新字段
const { error: sessionError } = await supabase.from("review_sessions").insert({
  user_id: user.id,
  flashcard_id: flashcardId,
  response: response,
  comprehension: comprehension || null,
  user_note: userNote || null,
  prev_interval: flashcard.interval_days,
  new_interval: result.newInterval,
  prev_ease: flashcard.ease_factor,
  new_ease: result.newEaseFactor,
  session_type: "scheduled",
});
```

#### 3.2.3 新增 related API

**文件**: `src/app/api/brain-sync/related/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCachedUser } from "@/lib/auth/cached-user";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  try {
    const { user, error: authError } = await getCachedUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const bookmarkId = request.nextUrl.searchParams.get("bookmarkId");
    if (!bookmarkId) {
      return NextResponse.json(
        { error: "Missing bookmarkId parameter" },
        { status: 400 },
      );
    }

    const supabase = await createClient();

    const { data, error: dbError } = await supabase.rpc(
      "get_related_bookmarks",
      {
        p_bookmark_id: parseInt(bookmarkId, 10),
        p_user_id: user.id,
        p_limit: 3,
      },
    );

    if (dbError) {
      logger.error({ error: dbError }, "Failed to get related bookmarks");
      return NextResponse.json(
        { error: "Failed to get related bookmarks" },
        { status: 500 },
      );
    }

    // 转换字段名为 camelCase
    const relatedBookmarks = (data || []).map(
      (item: {
        id: number;
        title: string;
        relevance_reason: string;
        similarity: number;
      }) => ({
        id: item.id,
        title: item.title,
        relevanceReason: item.relevance_reason,
        similarity: item.similarity,
      }),
    );

    return NextResponse.json({ relatedBookmarks });
  } catch (error) {
    logger.error({ error }, "Unexpected error in related bookmarks API");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
```

---

## 4. Phase 3：UI 层改动

### 4.1 延伸阅读组件

**文件**: `src/components/brain-sync/related-bookmarks.tsx`

```tsx
"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { BookOpen, ChevronDown, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RelatedBookmark } from "@/types/brain-sync";

interface RelatedBookmarksProps {
  bookmarkId: number;
}

export function RelatedBookmarks({ bookmarkId }: RelatedBookmarksProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [relatedBookmarks, setRelatedBookmarks] = useState<RelatedBookmark[]>(
    [],
  );
  const [hasFetched, setHasFetched] = useState(false);

  const fetchRelatedBookmarks = useCallback(async () => {
    if (hasFetched) return;

    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/brain-sync/related?bookmarkId=${bookmarkId}`,
      );
      if (response.ok) {
        const data = await response.json();
        setRelatedBookmarks(data.relatedBookmarks || []);
      }
    } catch (error) {
      console.error("Failed to fetch related bookmarks:", error);
    } finally {
      setIsLoading(false);
      setHasFetched(true);
    }
  }, [bookmarkId, hasFetched]);

  const handleToggle = () => {
    if (!isExpanded && !hasFetched) {
      fetchRelatedBookmarks();
    }
    setIsExpanded(!isExpanded);
  };

  return (
    <div className="border-t pt-3 mt-4">
      <button
        onClick={handleToggle}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full"
      >
        <BookOpen className="h-4 w-4" />
        <span>延伸阅读</span>
        <span className="text-xs">（3篇相关收藏）</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 ml-auto transition-transform",
            isExpanded && "rotate-180",
          )}
        />
      </button>

      {isExpanded && (
        <div className="mt-3 space-y-2">
          {isLoading ? (
            <div className="text-sm text-muted-foreground py-2">加载中...</div>
          ) : relatedBookmarks.length > 0 ? (
            relatedBookmarks.map((bookmark) => (
              <Link
                key={bookmark.id}
                href={`/bookmarks/${bookmark.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-3 p-3 rounded-lg border hover:bg-accent transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm line-clamp-1 group-hover:text-primary">
                    {bookmark.title}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    相关度：{bookmark.relevanceReason}
                  </div>
                </div>
                <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
              </Link>
            ))
          ) : (
            <div className="text-sm text-muted-foreground py-2">
              暂无相关收藏
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

### 4.2 复习卡片组件重构

**文件**: `src/components/brain-sync/flashcard-review-card.tsx`

```tsx
"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, BookOpen, ChevronRight, SkipForward } from "lucide-react";
import { cn } from "@/lib/utils";
import { RelatedBookmarks } from "./related-bookmarks";
import type { FlashcardV2, ComprehensionLevel } from "@/types/brain-sync";

interface FlashcardReviewCardProps {
  flashcard: FlashcardV2;
  currentIndex: number;
  totalCount: number;
  bookmarkTitle: string;
  onResponse: (response: {
    flashcardId: number;
    response: "mastered" | "fuzzy" | "forgotten";
    comprehension: ComprehensionLevel;
    userNote?: string;
  }) => void;
  onSkip: () => void;
}

const DEPTH_LABELS: Record<string, string> = {
  understand: "理解",
  apply: "应用",
  analyze: "分析",
  evaluate: "评价",
};

const DEPTH_COLORS: Record<string, string> = {
  understand: "bg-blue-100 text-blue-800",
  apply: "bg-green-100 text-green-800",
  analyze: "bg-purple-100 text-purple-800",
  evaluate: "bg-orange-100 text-orange-800",
};

export function FlashcardReviewCard({
  flashcard,
  currentIndex,
  totalCount,
  bookmarkTitle,
  onResponse,
  onSkip,
}: FlashcardReviewCardProps) {
  const [showAnswer, setShowAnswer] = useState(false);
  const [userNote, setUserNote] = useState("");

  const handleComprehensionSelect = (
    comprehension: ComprehensionLevel,
    response: "mastered" | "fuzzy" | "forgotten",
  ) => {
    onResponse({
      flashcardId: flashcard.id,
      response,
      comprehension,
      userNote: userNote.trim() || undefined,
    });
    // 重置状态
    setShowAnswer(false);
    setUserNote("");
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">🧠</span>
            <span className="font-medium">深度复习</span>
          </div>
          <span className="text-sm text-muted-foreground">
            {currentIndex + 1} / {totalCount}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <span className="text-sm text-muted-foreground">📄 来源：</span>
          <span className="text-sm font-medium line-clamp-1">
            {bookmarkTitle}
          </span>
        </div>
        <Badge
          variant="secondary"
          className={cn("w-fit mt-2", DEPTH_COLORS[flashcard.questionDepth])}
        >
          {DEPTH_LABELS[flashcard.questionDepth]}层问题
        </Badge>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* 问题 */}
        <div className="text-lg font-medium leading-relaxed">
          ❓ {flashcard.question}
        </div>

        {/* 思考提示 */}
        {flashcard.thinkingHint && (
          <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
            <Lightbulb className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-medium text-amber-800 dark:text-amber-200">
                思考方向
              </div>
              <div className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                {flashcard.thinkingHint}
              </div>
            </div>
          </div>
        )}

        {/* 用户输入区（可选） */}
        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">
            ✍️ 我的理解（可选）：
          </label>
          <Textarea
            placeholder="写下你的思考..."
            value={userNote}
            onChange={(e) => setUserNote(e.target.value)}
            className="min-h-[80px] resize-none"
          />
        </div>

        {/* 操作按钮 */}
        {!showAnswer ? (
          <div className="flex items-center gap-3">
            <Button onClick={() => setShowAnswer(true)} className="flex-1">
              <BookOpen className="h-4 w-4 mr-2" />
              查看参考要点
            </Button>
            <Button variant="ghost" onClick={onSkip}>
              <SkipForward className="h-4 w-4 mr-2" />
              跳过
            </Button>
          </div>
        ) : (
          <>
            {/* 参考要点 */}
            <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
              <div className="font-medium flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                参考要点：
              </div>
              <ul className="space-y-2">
                {flashcard.keyPoints.map((point, index) => (
                  <li key={index} className="flex items-start gap-2 text-sm">
                    <span className="text-primary">•</span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>

              {/* 原文片段 */}
              {flashcard.sourceParagraph && (
                <div className="mt-3 pt-3 border-t">
                  <div className="text-xs text-muted-foreground mb-1">
                    📝 原文片段：
                  </div>
                  <div className="text-sm italic text-muted-foreground">
                    "{flashcard.sourceParagraph}"
                  </div>
                </div>
              )}
            </div>

            {/* 理解深度评估 */}
            <div className="space-y-3">
              <div className="text-sm font-medium">🎯 这次复习对你的帮助：</div>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant="outline"
                  className="flex flex-col items-center gap-1 h-auto py-3 hover:bg-green-50 hover:border-green-300"
                  onClick={() =>
                    handleComprehensionSelect("new_insight", "mastered")
                  }
                >
                  <span className="text-lg">😊</span>
                  <span className="text-xs">有新理解</span>
                </Button>
                <Button
                  variant="outline"
                  className="flex flex-col items-center gap-1 h-auto py-3 hover:bg-yellow-50 hover:border-yellow-300"
                  onClick={() =>
                    handleComprehensionSelect("reinforced", "fuzzy")
                  }
                >
                  <span className="text-lg">😐</span>
                  <span className="text-xs">巩固已知</span>
                </Button>
                <Button
                  variant="outline"
                  className="flex flex-col items-center gap-1 h-auto py-3 hover:bg-red-50 hover:border-red-300"
                  onClick={() =>
                    handleComprehensionSelect("still_confused", "forgotten")
                  }
                >
                  <span className="text-lg">😕</span>
                  <span className="text-xs">仍不清楚</span>
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>

      {/* 延伸阅读 */}
      <CardFooter className="flex-col items-stretch pt-0">
        <RelatedBookmarks bookmarkId={flashcard.bookmarkId} />
      </CardFooter>
    </Card>
  );
}
```

### 4.3 导出组件

**文件**: `src/components/brain-sync/index.ts`

```typescript
export { RelatedBookmarks } from "./related-bookmarks";
export { FlashcardReviewCard } from "./flashcard-review-card";
// ... 其他现有导出
```

---

## 5. 测试计划

### 5.1 单元测试

**文件**: `src/lib/ai-skills/shared/review/__tests__/flashcard-generator-v2.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  generateFlashcardsV2,
  validateFlashcardQualityV2,
} from "../flashcard-generator";

describe("FlashcardGeneratorV2", () => {
  describe("generateFlashcardsV2", () => {
    it("should generate flashcards with required depth levels", async () => {
      // Mock AI response
      vi.mock("ai", () => ({
        generateText: vi.fn().mockResolvedValue({
          text: JSON.stringify([
            {
              questionDepth: "understand",
              question: "用你自己的话解释什么是 MoE 架构？",
              thinkingHint: "考虑稀疏激活的核心思想",
              keyPoints: ["专家分工", "按需激活", "计算效率"],
              sourceParagraph: "MoE 通过路由机制...",
            },
            {
              questionDepth: "apply",
              question: "在延迟敏感场景下如何应用 MoE？",
              thinkingHint: "关注路由开销和专家选择",
              keyPoints: ["预热策略", "缓存优化", "专家剪枝"],
              sourceParagraph: "实际部署时...",
            },
          ]),
        }),
      }));

      const result = await generateFlashcardsV2({
        title: "MoE 架构详解",
        summary: "混合专家模型介绍",
        content: "MoE 是一种稀疏激活的模型架构...",
        count: 2,
        difficulty: "medium",
      });

      expect(result.success).toBe(true);
      expect(result.flashcards).toHaveLength(2);
      expect(result.flashcards[0].questionDepth).toBe("understand");
      expect(result.flashcards[1].questionDepth).toBe("apply");
    });
  });

  describe("validateFlashcardQualityV2", () => {
    it("should reject questions that are too short", () => {
      const flashcard = {
        questionDepth: "understand" as const,
        question: "什么是 MoE？", // 太短
        thinkingHint: "考虑稀疏激活",
        keyPoints: ["要点1", "要点2"],
        sourceParagraph: "",
      };

      expect(validateFlashcardQualityV2(flashcard)).toBe(false);
    });

    it("should reject questions without thinking hint", () => {
      const flashcard = {
        questionDepth: "understand" as const,
        question: "用你自己的话解释 MoE 架构的核心思想？",
        thinkingHint: "", // 空的思考提示
        keyPoints: ["要点1", "要点2"],
        sourceParagraph: "",
      };

      expect(validateFlashcardQualityV2(flashcard)).toBe(false);
    });

    it("should accept valid flashcards", () => {
      const flashcard = {
        questionDepth: "understand" as const,
        question:
          "用你自己的话解释为什么 MoE 选择只激活部分专家，而不是让所有专家都参与计算？",
        thinkingHint: "考虑计算资源的约束和专家之间的分工",
        keyPoints: ["计算效率", "专业分工", "容量扩展"],
        sourceParagraph: "DeepSeek-V3 采用了 Top-2 路由策略...",
      };

      expect(validateFlashcardQualityV2(flashcard)).toBe(true);
    });
  });
});
```

### 5.2 API 测试

**文件**: `src/app/api/brain-sync/__tests__/related-api.test.ts`

```typescript
import { describe, it, expect, vi } from "vitest";
import { GET } from "../related/route";
import { NextRequest } from "next/server";

describe("GET /api/brain-sync/related", () => {
  it("should return 401 for unauthenticated requests", async () => {
    vi.mock("@/lib/auth/cached-user", () => ({
      getCachedUser: vi
        .fn()
        .mockResolvedValue({ user: null, error: "No session" }),
    }));

    const request = new NextRequest(
      "http://localhost/api/brain-sync/related?bookmarkId=1",
    );
    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it("should return 400 for missing bookmarkId", async () => {
    vi.mock("@/lib/auth/cached-user", () => ({
      getCachedUser: vi
        .fn()
        .mockResolvedValue({ user: { id: "user-1" }, error: null }),
    }));

    const request = new NextRequest("http://localhost/api/brain-sync/related");
    const response = await GET(request);

    expect(response.status).toBe(400);
  });

  it("should return related bookmarks for valid request", async () => {
    vi.mock("@/lib/auth/cached-user", () => ({
      getCachedUser: vi
        .fn()
        .mockResolvedValue({ user: { id: "user-1" }, error: null }),
    }));

    vi.mock("@/lib/supabase/server", () => ({
      createClient: vi.fn().mockResolvedValue({
        rpc: vi.fn().mockResolvedValue({
          data: [
            {
              id: 2,
              title: "相关书签1",
              relevance_reason: "共同标签：React",
              similarity: 0.85,
            },
            {
              id: 3,
              title: "相关书签2",
              relevance_reason: "内容相似",
              similarity: 0.72,
            },
          ],
          error: null,
        }),
      }),
    }));

    const request = new NextRequest(
      "http://localhost/api/brain-sync/related?bookmarkId=1",
    );
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.relatedBookmarks).toHaveLength(2);
    expect(data.relatedBookmarks[0].relevanceReason).toBe("共同标签：React");
  });
});
```

---

## 6. 部署清单

### 6.1 数据库迁移顺序

```bash
# 1. 先部署表结构变更
supabase db push --include-migrations 20260101000001_extend_flashcards_table.sql
supabase db push --include-migrations 20260101000002_extend_review_sessions.sql

# 2. 再部署 RPC 函数
supabase db push --include-migrations 20260101000003_add_related_bookmarks_rpc.sql
```

### 6.2 代码部署顺序

1. **类型定义** → `src/types/brain-sync.ts`
2. **业务逻辑** → `flashcard-generator.ts`
3. **API 层** → `generate/route.ts`, `response/route.ts`, `related/route.ts`
4. **UI 组件** → `related-bookmarks.tsx`, `flashcard-review-card.tsx`

### 6.3 回滚方案

```sql
-- 回滚表结构变更
ALTER TABLE flashcards DROP COLUMN IF EXISTS question_depth;
ALTER TABLE flashcards DROP COLUMN IF EXISTS thinking_hint;
ALTER TABLE flashcards DROP COLUMN IF EXISTS key_points;

ALTER TABLE review_sessions DROP COLUMN IF EXISTS comprehension;
ALTER TABLE review_sessions DROP COLUMN IF EXISTS user_note;

DROP FUNCTION IF EXISTS get_related_bookmarks;
```

---

## 7. 监控指标

### 7.1 关键指标

| 指标           | 采集方式   | 告警阈值 |
| -------------- | ---------- | -------- |
| 卡片生成成功率 | API 日志   | < 90%    |
| 平均生成耗时   | API 日志   | > 5s     |
| 延伸阅读点击率 | 前端埋点   | 参考基线 |
| 理解深度分布   | 数据库统计 | 参考基线 |

### 7.2 埋点事件

```typescript
// 前端埋点
const EVENTS = {
  REVIEW_START: "brain_sync_review_start",
  REVIEW_COMPLETE: "brain_sync_review_complete",
  SHOW_ANSWER: "brain_sync_show_answer",
  COMPREHENSION_SELECT: "brain_sync_comprehension_select",
  RELATED_EXPAND: "brain_sync_related_expand",
  RELATED_CLICK: "brain_sync_related_click",
  USER_NOTE_SUBMIT: "brain_sync_user_note_submit",
};
```

---

## 8. 文档更新

实施完成后需更新：

1. `CLAUDE.md` - 更新 Brain-Sync 功能描述
2. `docs/复习实验室1229-技术架构.md` - 更新技术架构
3. API 文档 - 新增 `/api/brain-sync/related` 接口说明

---

**文档状态**: 可落地开发
**预计工期**: 13 个工作日
**下一步**: 技术评审 → 开发排期
