# Phase 3 最佳实践参考

> **版本**: 1.0.0
> **日期**: 2025-12-25
> **用途**: 为 Phase 3 各任务提供业界最佳实践参考

---

## 目录

1. [5.1 内容提取引擎](#51-内容提取引擎)
2. [5.2 输出格式化](#52-输出格式化)
3. [5.3 萃取 Skill 设计](#53-萃取-skill-设计)
4. [6.1 纠错学习机制](#61-纠错学习机制)
5. [6.2 学习结果应用](#62-学习结果应用)
6. [验证脚本参考](#验证脚本参考)
7. [参考资料](#参考资料)

---

## 5.1 内容提取引擎

### 业界参考

#### Claude Artifacts 的多文档处理策略

Claude 在处理多文档时采用以下策略：

1. **分块处理**: 将长文档分割为语义完整的块
2. **并行提取**: 对每个文档独立提取要点
3. **交叉验证**: 对比不同文档的观点，标记共识与分歧
4. **层级聚合**: 从细节到主题逐层汇总

**关键设计**:

```typescript
interface DocumentChunk {
  id: string;
  documentId: string;
  content: string;
  startOffset: number;
  endOffset: number;
  metadata: {
    title?: string;
    section?: string;
    importance: "high" | "medium" | "low";
  };
}

interface ExtractionContext {
  chunks: DocumentChunk[];
  globalTopics: string[]; // 跨文档识别的主题
  conflictingPoints: ConflictPoint[]; // 观点冲突
}
```

**应用到 AnyKeep**:

```typescript
class KnowledgeExtractor {
  // 第一阶段：文档预处理
  async preprocessDocuments(bookmarks: Bookmark[]): Promise<DocumentChunk[]> {
    const chunks: DocumentChunk[] = [];

    for (const bookmark of bookmarks) {
      const content = await this.fetchContent(bookmark);
      const docChunks = this.splitIntoChunks(content, {
        maxTokens: 1000,
        preserveParagraphs: true,
        includeContext: true, // 保留上下文信息
      });
      chunks.push(...docChunks);
    }

    return chunks;
  }

  // 第二阶段：并行提取
  async extractFromChunks(chunks: DocumentChunk[]): Promise<ChunkExtraction[]> {
    // 使用 Promise.all 并行处理，但限制并发数
    const batchSize = 5;
    const results: ChunkExtraction[] = [];

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map((chunk) => this.extractFromChunk(chunk)),
      );
      results.push(...batchResults);
    }

    return results;
  }

  // 第三阶段：聚合与去重
  async aggregateExtractions(
    extractions: ChunkExtraction[],
  ): Promise<AggregatedKnowledge> {
    // 1. 合并相似要点
    const mergedKeyPoints = this.mergeKeyPoints(extractions);

    // 2. 识别核心概念
    const concepts = this.identifyConcepts(extractions);

    // 3. 构建知识图谱片段
    const relationships = this.findRelationships(mergedKeyPoints, concepts);

    return {
      keyPoints: mergedKeyPoints,
      concepts,
      relationships,
      sources: this.buildSourceIndex(extractions),
    };
  }
}
```

#### Perplexity 风格的引用机制

Perplexity AI 的引用系统核心特点：

1. **内联引用**: 在生成文本时即时标注来源 `[1]`
2. **来源预览**: hover 显示来源标题和摘要
3. **可验证性**: 每个声明都可追溯到原始来源

**引用数据结构**:

```typescript
interface Citation {
  id: number; // 引用编号 [1], [2]...
  sourceId: string; // 来源书签 ID
  sourceTitle: string; // 来源标题
  sourceUrl: string; // 来源 URL
  quotedText: string; // 原文引用
  contextStart: number; // 在原文中的位置
  contextEnd: number;
  confidence: number; // 引用置信度 0-1
}

interface CitedKeyPoint {
  content: string; // 要点内容
  citations: Citation[]; // 支撑该要点的引用
  synthesized: boolean; // 是否为综合推断
}
```

**引用生成 Prompt 设计**:

```typescript
const EXTRACTION_PROMPT = `
你是一个知识萃取专家。从以下文档中提取关键要点，并为每个要点标注来源。

## 输入文档
{{documents}}

## 输出格式要求
对于每个要点：
1. 用简洁的语言总结核心观点
2. 在要点后用 [来源X] 标注来源
3. 如果是综合多个来源得出的结论，标注所有相关来源

## 输出示例
- GPT-4 在代码生成任务上达到了 92% 的准确率 [来源1]
- 大模型的涌现能力与模型规模呈非线性关系 [来源1, 来源2]
- 相比之下，Claude 在推理任务上表现更优 [来源2]（综合推断）

## 请提取以下内容：
1. 核心要点（3-7 个）
2. 关键概念（附定义）
3. 重要数据/结论
`.trim();
```

### 推荐实现

#### 主题识别算法

采用**两阶段主题识别**：

```typescript
class TopicIdentifier {
  // 阶段1：基于 LLM 的语义主题识别
  async identifyTopicsWithLLM(documents: DocumentContent[]): Promise<Topic[]> {
    const prompt = this.buildTopicPrompt(documents);
    const response = await this.llm.complete(prompt);
    return this.parseTopics(response);
  }

  // 阶段2：基于标签/标题的统计验证
  validateWithStatistics(
    llmTopics: Topic[],
    documents: DocumentContent[],
  ): Topic[] {
    // 提取所有标签和标题关键词
    const tagCounts = new Map<string, number>();
    documents.forEach((doc) => {
      doc.tags?.forEach((tag) => {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      });
    });

    // 验证 LLM 识别的主题是否与高频标签一致
    return llmTopics.map((topic) => ({
      ...topic,
      confidence: this.calculateConfidence(topic, tagCounts),
      supportingTags: this.findSupportingTags(topic, tagCounts),
    }));
  }
}
```

#### 要点提取与去重

```typescript
interface KeyPointExtraction {
  raw: string; // 原始提取
  normalized: string; // 标准化后
  embedding?: number[]; // 语义向量
  sources: Citation[];
}

class KeyPointDeduplicator {
  private readonly SIMILARITY_THRESHOLD = 0.85;

  async deduplicate(
    keyPoints: KeyPointExtraction[],
  ): Promise<KeyPointExtraction[]> {
    // 计算所有要点的嵌入向量
    const embeddings = await this.embedder.embedBatch(
      keyPoints.map((kp) => kp.normalized),
    );

    // 使用相似度聚类
    const clusters = this.clusterBySimilarity(keyPoints, embeddings);

    // 每个聚类选择代表性要点
    return clusters.map((cluster) => this.selectRepresentative(cluster));
  }

  private selectRepresentative(
    cluster: KeyPointExtraction[],
  ): KeyPointExtraction {
    // 选择来源最多、表述最完整的作为代表
    return cluster.reduce((best, current) => {
      const bestScore = best.sources.length * 2 + best.normalized.length / 100;
      const currentScore =
        current.sources.length * 2 + current.normalized.length / 100;
      return currentScore > bestScore ? current : best;
    });
  }
}
```

---

## 5.2 输出格式化

### 三种格式设计

#### Summary (摘要) 格式

适用场景：快速了解、5 分钟阅读

```typescript
interface SummaryFormat {
  title: string; // 自动生成的标题
  tldr: string; // 一句话总结（≤50字）
  keyPoints: string[]; // 3-5 个核心要点
  conclusion: string; // 综合结论
  sources: SourceInfo[]; // 来源列表
}

// 模板
const SUMMARY_TEMPLATE = `
# {{title}}

> **TL;DR**: {{tldr}}

## 核心要点

{{#each keyPoints}}
- {{this.content}} {{#each this.citations}}[{{this.id}}]{{/each}}
{{/each}}

## 结论

{{conclusion}}

---
**来源**
{{#each sources}}
{{this.index}}. [{{this.title}}]({{this.url}})
{{/each}}
`;
```

#### Memo (纪要) 格式

适用场景：学习记录、知识复盘

```typescript
interface MemoFormat {
  title: string;
  date: string;
  topics: TopicSection[]; // 按主题组织
  concepts: ConceptDefinition[]; // 概念定义表
  insights: string[]; // 个人洞察（可选）
  actionItems: string[]; // 行动项（可选）
  sources: SourceInfo[];
}

// 模板
const MEMO_TEMPLATE = `
# {{title}}
> 整理日期：{{date}}

## 主题概览

{{#each topics}}
### {{this.name}}

{{this.summary}}

**要点详解：**
{{#each this.keyPoints}}
1. **{{this.title}}**
   {{this.detail}}
   > 来源：{{this.source}}
{{/each}}

{{/each}}

## 核心概念

| 概念 | 定义 | 来源 |
|-----|------|-----|
{{#each concepts}}
| {{this.term}} | {{this.definition}} | [{{this.sourceId}}] |
{{/each}}

## 来源文档

{{#each sources}}
{{this.index}}. [{{this.title}}]({{this.url}}) - {{this.platform}}
{{/each}}
`;
```

#### Outline (大纲) 格式

适用场景：结构梳理、PPT 素材

```typescript
interface OutlineFormat {
  title: string;
  structure: OutlineNode[]; // 树形结构
  sources: SourceInfo[];
}

interface OutlineNode {
  level: 1 | 2 | 3; // 层级
  content: string;
  children: OutlineNode[];
  citations?: Citation[];
}

// 模板
const OUTLINE_TEMPLATE = `
# {{title}}

{{#each structure}}
{{#if (eq level 1)}}## {{content}}{{/if}}
{{#if (eq level 2)}}  - {{content}}{{/if}}
{{#if (eq level 3)}}    - {{content}}{{/if}}
{{#each children}}
{{> outlineNode}}
{{/each}}
{{/each}}

---
来源：{{#each sources}}[{{this.index}}]{{/each}}
`;
```

### 格式选择策略

```typescript
class FormatSelector {
  selectFormat(
    extraction: AggregatedKnowledge,
    userHint?: string,
  ): "summary" | "memo" | "outline" {
    // 1. 用户明确指定
    if (userHint) {
      const formatMap: Record<string, "summary" | "memo" | "outline"> = {
        摘要: "summary",
        总结: "summary",
        简要: "summary",
        纪要: "memo",
        笔记: "memo",
        学习: "memo",
        大纲: "outline",
        结构: "outline",
        PPT: "outline",
      };
      for (const [keyword, format] of Object.entries(formatMap)) {
        if (userHint.includes(keyword)) return format;
      }
    }

    // 2. 根据内容特征自动选择
    const { keyPoints, concepts, relationships } = extraction;

    // 概念多 → memo（适合学习）
    if (concepts.length >= 5) return "memo";

    // 层级关系清晰 → outline
    if (relationships.length >= 3 && this.hasHierarchy(relationships)) {
      return "outline";
    }

    // 默认 → summary
    return "summary";
  }
}
```

---

## 5.3 萃取 Skill 设计

### Skill 步骤定义

```typescript
const KNOWLEDGE_EXTRACT_SKILL: SkillDefinition = {
  id: "knowledge_extract",
  name: "知识萃取",
  description: "从多篇文章中提取、整合知识",

  steps: [
    {
      id: "collect",
      name: "收集内容",
      description: "获取目标书签的内容",
      action: async (ctx) => {
        const bookmarks = await ctx.resolveBookmarks(ctx.input.scope);
        const contents = await ctx.fetchContents(bookmarks);
        return { bookmarks, contents };
      },
    },
    {
      id: "identify",
      name: "识别主题",
      description: "分析文档，识别共同主题",
      action: async (ctx, prev) => {
        const topics = await ctx.extractor.identifyTopics(prev.contents);
        return { topics, ...prev };
      },
    },
    {
      id: "extract",
      name: "提取知识",
      description: "提取要点、概念、结论",
      action: async (ctx, prev) => {
        const extraction = await ctx.extractor.extract(prev.contents, {
          topics: prev.topics,
          withCitations: true,
        });
        return { extraction, ...prev };
      },
    },
    {
      id: "format",
      name: "格式化输出",
      description: "按选定格式生成输出",
      action: async (ctx, prev) => {
        const format = ctx.formatSelector.selectFormat(
          prev.extraction,
          ctx.input.formatHint,
        );
        const output = ctx.formatter.format(prev.extraction, format);
        return { output, format, ...prev };
      },
    },
    {
      id: "deliver",
      name: "交付结果",
      description: "返回萃取结果",
      action: async (ctx, prev) => {
        return {
          type: "deliverable",
          format: "extraction",
          content: prev.output,
          metadata: {
            sourceCount: prev.bookmarks.length,
            topicCount: prev.topics.length,
            keyPointCount: prev.extraction.keyPoints.length,
            outputFormat: prev.format,
          },
        };
      },
    },
  ],

  // 交付物 Schema
  deliverableSchema: z.object({
    title: z.string(),
    format: z.enum(["summary", "memo", "outline"]),
    content: z.string(),
    keyPoints: z.array(
      z.object({
        content: z.string(),
        citations: z.array(
          z.object({
            id: z.number(),
            sourceTitle: z.string(),
            sourceUrl: z.string(),
          }),
        ),
      }),
    ),
    concepts: z
      .array(
        z.object({
          term: z.string(),
          definition: z.string(),
        }),
      )
      .optional(),
    sources: z.array(
      z.object({
        id: z.number(),
        title: z.string(),
        url: z.string(),
      }),
    ),
  }),
};
```

---

## 6.1 纠错学习机制

### 业界参考

#### 用户反馈闭环设计（参考 Notion AI、Jasper）

**核心原则**：

1. **低摩擦反馈**: 一键"不对"比填表单有效 10x
2. **即时学习**: 用户纠正后立即应用，无需等待模型更新
3. **透明反馈**: 告知用户"下次会更准确"

**反馈信号分类**：

```typescript
enum FeedbackSignal {
  // 显式反馈
  EXPLICIT_WRONG = "explicit_wrong", // "不对" / "错了"
  EXPLICIT_CORRECT = "explicit_correct", // "对的" / "这个好"
  THUMBS_DOWN = "thumbs_down", // 👎 按钮
  THUMBS_UP = "thumbs_up", // 👍 按钮

  // 隐式反馈
  IMMEDIATE_RETRY = "immediate_retry", // 立即重新输入相似内容
  REFORMULATION = "reformulation", // 换种说法重试
  ABANDONMENT = "abandonment", // 放弃交互
  CORRECTION_FOLLOW = "correction_follow", // "我是要...，不是..."
}
```

### 纠正检测算法

```typescript
class CorrectionDetector {
  private readonly CORRECTION_PATTERNS = [
    // 直接否定
    { pattern: /^(不对|错了|不是这个|搞错了)/i, signal: "explicit_wrong" },
    { pattern: /^(不|错|否)/i, signal: "explicit_wrong", minConfidence: 0.7 },

    // 纠正句式
    { pattern: /我(说的|要的|想要的)是.*不是/i, signal: "correction_follow" },
    { pattern: /不是.*是/i, signal: "correction_follow" },
    { pattern: /应该是/i, signal: "correction_follow" },

    // 重新表述
    { pattern: /我(再|重新)说一遍/i, signal: "reformulation" },
    { pattern: /换个说法/i, signal: "reformulation" },
  ];

  detect(
    currentInput: string,
    previousOutput: AIOutput,
    conversationContext: ConversationState,
  ): CorrectionSignal | null {
    // 1. 模式匹配
    for (const { pattern, signal, minConfidence } of this.CORRECTION_PATTERNS) {
      if (pattern.test(currentInput)) {
        return {
          signal,
          confidence: minConfidence ?? 0.9,
          originalInput: conversationContext.lastUserInput,
          wrongIntent: previousOutput.intent,
          correctionInput: currentInput,
        };
      }
    }

    // 2. 语义相似度检测（用户换种说法重试）
    if (conversationContext.lastUserInput) {
      const similarity = this.computeSimilarity(
        currentInput,
        conversationContext.lastUserInput,
      );

      // 高相似度 + 上次执行失败 = 可能的纠正
      if (similarity > 0.7 && previousOutput.wasSuccessful === false) {
        return {
          signal: "reformulation",
          confidence: similarity,
          originalInput: conversationContext.lastUserInput,
          wrongIntent: previousOutput.intent,
          correctionInput: currentInput,
        };
      }
    }

    return null;
  }

  // 提取正确意图
  inferCorrectIntent(
    correctionInput: string,
    wrongIntent: IntentType,
  ): IntentType | null {
    // 从"我是要...，不是..."句式中提取
    const match = correctionInput.match(
      /我(?:是要|想要?|要的是)(.+?)(?:不是|而不是)/,
    );
    if (match) {
      const desiredAction = match[1].trim();
      return this.mapActionToIntent(desiredAction);
    }

    // 基于否定推断：用户说"不是搜索"，可能是其他常见意图
    if (
      correctionInput.includes("不是搜索") ||
      correctionInput.includes("不是找")
    ) {
      // 返回最可能的替代意图
      return wrongIntent === "query" ? "organize" : null;
    }

    return null;
  }
}
```

### 纠正记录数据模型

```typescript
interface CorrectionRecord {
  id: string;
  userId: string;
  createdAt: Date;

  // 原始场景
  originalInput: string; // 原始用户输入
  originalInputEmbedding: number[]; // 用于相似度匹配
  wrongIntent: IntentType; // 错误的意图

  // 纠正信息
  correctionInput: string; // 纠正时的用户输入
  correctIntent: IntentType; // 正确的意图

  // 元数据
  signal: FeedbackSignal; // 纠正信号类型
  confidence: number; // 纠正置信度
  appliedCount: number; // 该纠正被应用的次数
  lastAppliedAt: Date | null; // 最后应用时间
}
```

### 数据库设计

```sql
-- supabase/migrations/20251225000003_add_intent_corrections.sql

CREATE TABLE intent_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- 原始场景
  original_input TEXT NOT NULL,
  original_input_embedding vector(1536), -- 用于相似度搜索
  wrong_intent TEXT NOT NULL,

  -- 纠正信息
  correction_input TEXT NOT NULL,
  correct_intent TEXT NOT NULL,

  -- 元数据
  signal TEXT NOT NULL,
  confidence FLOAT NOT NULL DEFAULT 0.9,
  applied_count INTEGER NOT NULL DEFAULT 0,
  last_applied_at TIMESTAMP WITH TIME ZONE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_corrections_user_intent
  ON intent_corrections(user_id, wrong_intent);

CREATE INDEX idx_corrections_embedding
  ON intent_corrections
  USING ivfflat (original_input_embedding vector_cosine_ops)
  WITH (lists = 100);

-- RLS
ALTER TABLE intent_corrections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own corrections"
  ON intent_corrections
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id);
```

---

## 6.2 学习结果应用

### 集成到分类器

```typescript
class IntentClassifierWithLearning extends IntentClassifier {
  constructor(
    private correctionLearner: CorrectionLearner,
    private config: ClassifierConfig,
  ) {
    super(config);
  }

  async classify(input: string, userId: string): Promise<ClassificationResult> {
    // 1. 先检查是否有学习记录
    const learnedCorrection =
      await this.correctionLearner.findSimilarCorrection(input, userId);

    if (learnedCorrection && learnedCorrection.similarity > 0.85) {
      // 应用学习结果
      await this.correctionLearner.recordApplication(learnedCorrection.id);

      return {
        primary: {
          type: learnedCorrection.correctIntent,
          confidence: learnedCorrection.similarity,
          source: "learned", // 标记来源为学习结果
        },
        candidates: [],
        needsDisambiguation: false,
        learningApplied: true,
        learningSource: learnedCorrection.id,
      };
    }

    // 2. 正常分类流程
    return super.classify(input);
  }
}
```

### 相似度搜索

```typescript
class CorrectionLearner {
  async findSimilarCorrection(
    input: string,
    userId: string,
  ): Promise<SimilarCorrection | null> {
    // 1. 生成输入的嵌入向量
    const embedding = await this.embedder.embed(input);

    // 2. 向量相似度搜索
    const { data: corrections } = await this.supabase.rpc(
      "find_similar_corrections",
      {
        query_embedding: embedding,
        user_id: userId,
        similarity_threshold: 0.7,
        limit_count: 5,
      },
    );

    if (!corrections || corrections.length === 0) {
      return null;
    }

    // 3. 选择最相关的纠正记录
    // 考虑因素：相似度、应用次数、最近应用时间
    const ranked = corrections
      .map((c) => ({
        ...c,
        score: this.computeRelevanceScore(c),
      }))
      .sort((a, b) => b.score - a.score);

    return ranked[0];
  }

  private computeRelevanceScore(correction: CorrectionRecord): number {
    const { similarity, appliedCount, lastAppliedAt } = correction;

    // 基础分 = 相似度
    let score = similarity;

    // 应用次数加成（最多 +0.1）
    score += Math.min(appliedCount * 0.02, 0.1);

    // 时效性加成（最近应用的优先）
    if (lastAppliedAt) {
      const daysSinceApplied =
        (Date.now() - new Date(lastAppliedAt).getTime()) /
        (1000 * 60 * 60 * 24);
      if (daysSinceApplied < 7) {
        score += 0.05;
      }
    }

    return score;
  }
}
```

### 数据库函数

```sql
-- 相似度搜索函数
CREATE OR REPLACE FUNCTION find_similar_corrections(
  query_embedding vector(1536),
  target_user_id UUID,
  similarity_threshold FLOAT DEFAULT 0.7,
  limit_count INTEGER DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  original_input TEXT,
  wrong_intent TEXT,
  correct_intent TEXT,
  applied_count INTEGER,
  last_applied_at TIMESTAMP WITH TIME ZONE,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.original_input,
    c.wrong_intent,
    c.correct_intent,
    c.applied_count,
    c.last_applied_at,
    1 - (c.original_input_embedding <=> query_embedding) AS similarity
  FROM intent_corrections c
  WHERE c.user_id = target_user_id
    AND 1 - (c.original_input_embedding <=> query_embedding) > similarity_threshold
  ORDER BY similarity DESC
  LIMIT limit_count;
END;
$$;
```

---

## 验证脚本参考

### 知识萃取验证

```typescript
// scripts/validate-extraction.ts

interface ExtractionTestCase {
  name: string;
  bookmarkUrls: string[]; // 测试用的书签 URL
  expectedTopicCount: number; // 期望识别的主题数
  expectedKeyPointRange: [number, number]; // 期望的要点数范围
  mustContainConcepts: string[]; // 必须包含的概念
}

const TEST_CASES: ExtractionTestCase[] = [
  {
    name: "AI 技术文章萃取",
    bookmarkUrls: [
      "https://example.com/article-1",
      "https://example.com/article-2",
      "https://example.com/article-3",
    ],
    expectedTopicCount: 2,
    expectedKeyPointRange: [3, 7],
    mustContainConcepts: ["大模型", "Transformer"],
  },
  // ... 更多用例
];

async function validateExtraction() {
  const extractor = new KnowledgeExtractor();
  let passed = 0;
  let failed = 0;

  for (const testCase of TEST_CASES) {
    console.log(`\n测试: ${testCase.name}`);

    try {
      // 执行萃取
      const result = await extractor.extract(testCase.bookmarkUrls);

      // 验证主题数
      if (result.topics.length >= testCase.expectedTopicCount) {
        console.log(
          `  ✅ 主题数: ${result.topics.length} >= ${testCase.expectedTopicCount}`,
        );
      } else {
        console.log(
          `  ❌ 主题数: ${result.topics.length} < ${testCase.expectedTopicCount}`,
        );
        failed++;
        continue;
      }

      // 验证要点数
      const [min, max] = testCase.expectedKeyPointRange;
      if (result.keyPoints.length >= min && result.keyPoints.length <= max) {
        console.log(
          `  ✅ 要点数: ${result.keyPoints.length} 在 [${min}, ${max}] 范围内`,
        );
      } else {
        console.log(
          `  ❌ 要点数: ${result.keyPoints.length} 不在 [${min}, ${max}] 范围内`,
        );
        failed++;
        continue;
      }

      // 验证概念
      const conceptNames = result.concepts.map((c) => c.term);
      const missingConcepts = testCase.mustContainConcepts.filter(
        (c) => !conceptNames.some((name) => name.includes(c)),
      );
      if (missingConcepts.length === 0) {
        console.log(
          `  ✅ 概念包含: ${testCase.mustContainConcepts.join(", ")}`,
        );
      } else {
        console.log(`  ❌ 缺少概念: ${missingConcepts.join(", ")}`);
        failed++;
        continue;
      }

      // 验证引用
      const hasValidCitations = result.keyPoints.every(
        (kp) => kp.citations.length > 0,
      );
      if (hasValidCitations) {
        console.log(`  ✅ 所有要点都有引用`);
      } else {
        console.log(`  ❌ 部分要点缺少引用`);
        failed++;
        continue;
      }

      passed++;
    } catch (error) {
      console.log(`  ❌ 执行失败: ${error.message}`);
      failed++;
    }
  }

  console.log(`\n结果: ${passed}/${passed + failed} 通过`);

  if (passed / (passed + failed) < 0.8) {
    process.exit(1);
  }
}
```

### 纠错学习验证

```typescript
// scripts/validate-correction-learning.ts

interface CorrectionTestCase {
  name: string;
  originalInput: string;
  wrongIntent: IntentType;
  correctionInput: string;
  expectedCorrectIntent: IntentType;
  shouldDetect: boolean;
}

const TEST_CASES: CorrectionTestCase[] = [
  {
    name: '显式否定 - "不对"',
    originalInput: "整理这些文章",
    wrongIntent: "query",
    correctionInput: "不对，我是要整理，不是搜索",
    expectedCorrectIntent: "organize",
    shouldDetect: true,
  },
  {
    name: '显式否定 - "错了"',
    originalInput: "总结一下收藏",
    wrongIntent: "organize",
    correctionInput: "错了，我要的是生成总结，不是整理",
    expectedCorrectIntent: "create",
    shouldDetect: true,
  },
  {
    name: "重新表述",
    originalInput: "找一下 AI 文章",
    wrongIntent: "organize",
    correctionInput: "我说的是搜索 AI 相关的文章",
    expectedCorrectIntent: "query",
    shouldDetect: true,
  },
  {
    name: "非纠正 - 正常对话",
    originalInput: "搜索 AI 文章",
    wrongIntent: "query",
    correctionInput: "还有其他的吗？",
    expectedCorrectIntent: "query",
    shouldDetect: false,
  },
];

async function validateCorrectionLearning() {
  const detector = new CorrectionDetector();
  const learner = new CorrectionLearner();

  let passed = 0;
  let failed = 0;

  for (const testCase of TEST_CASES) {
    console.log(`\n测试: ${testCase.name}`);

    // 构造上下文
    const context: ConversationState = {
      lastUserInput: testCase.originalInput,
      messages: [],
      // ...
    };

    const previousOutput: AIOutput = {
      intent: testCase.wrongIntent,
      wasSuccessful: false,
    };

    // 检测纠正
    const correction = detector.detect(
      testCase.correctionInput,
      previousOutput,
      context,
    );

    if (testCase.shouldDetect) {
      if (!correction) {
        console.log(`  ❌ 未检测到纠正`);
        failed++;
        continue;
      }

      const inferredIntent = detector.inferCorrectIntent(
        testCase.correctionInput,
        testCase.wrongIntent,
      );

      if (inferredIntent === testCase.expectedCorrectIntent) {
        console.log(`  ✅ 正确推断意图: ${inferredIntent}`);
        passed++;
      } else {
        console.log(
          `  ❌ 意图推断错误: 期望 ${testCase.expectedCorrectIntent}, 得到 ${inferredIntent}`,
        );
        failed++;
      }
    } else {
      if (!correction) {
        console.log(`  ✅ 正确忽略非纠正输入`);
        passed++;
      } else {
        console.log(`  ❌ 错误地将正常对话检测为纠正`);
        failed++;
      }
    }
  }

  console.log(`\n结果: ${passed}/${passed + failed} 通过`);

  // 验收标准：≥ 90%
  if (passed / (passed + failed) < 0.9) {
    process.exit(1);
  }
}
```

### 学习应用验证

```typescript
// scripts/validate-learning-application.ts

async function validateLearningApplication() {
  const classifier = new IntentClassifierWithLearning(
    new CorrectionLearner(),
    defaultConfig,
  );

  // 模拟场景：用户之前纠正过"整理文章"应该是 organize 而非 query
  const mockCorrection: CorrectionRecord = {
    id: "test-correction-1",
    userId: "test-user",
    originalInput: "整理这些文章",
    wrongIntent: "query",
    correctIntent: "organize",
    // ...
  };

  // 插入模拟数据
  await insertMockCorrection(mockCorrection);

  // 测试 1: 相同输入应该应用学习结果
  const result1 = await classifier.classify("整理这些文章", "test-user");
  console.assert(result1.primary.type === "organize", "应该应用学习结果");
  console.assert(result1.learningApplied === true, "应该标记学习已应用");

  // 测试 2: 相似输入应该应用学习结果
  const result2 = await classifier.classify("帮我整理文章", "test-user");
  console.assert(result2.primary.type === "organize", "相似输入应该应用学习");

  // 测试 3: 不相似输入不应用学习
  const result3 = await classifier.classify("搜索 React 教程", "test-user");
  console.assert(result3.learningApplied !== true, "不相似输入不应用学习");

  // 清理
  await deleteMockCorrection(mockCorrection.id);

  console.log("✅ 学习应用验证通过");
}
```

---

## 参考资料

### 知识萃取

1. [LangChain Document Loaders](https://python.langchain.com/docs/modules/data_connection/document_loaders/) - 多文档处理模式
2. [Perplexity AI](https://www.perplexity.ai/) - 引用机制参考
3. [RAG (Retrieval-Augmented Generation)](https://arxiv.org/abs/2005.11401) - 检索增强生成论文
4. [Claude 多文档处理最佳实践](https://docs.anthropic.com/claude/docs/multi-document-analysis)

### 用户反馈学习

5. [Implicit vs Explicit Feedback](https://dl.acm.org/doi/10.1145/1015330.1015425) - 反馈信号分类
6. [Online Learning from User Feedback](https://arxiv.org/abs/1907.05012) - 在线学习
7. [RLHF (Reinforcement Learning from Human Feedback)](https://arxiv.org/abs/2203.02155) - 人类反馈强化学习
8. [Semantic Similarity Search with pgvector](https://supabase.com/docs/guides/ai/vector-columns)

### 文本相似度

9. [Sentence Transformers](https://www.sbert.net/) - 语义相似度模型
10. [OpenAI Embeddings](https://platform.openai.com/docs/guides/embeddings) - 嵌入向量 API

---

## 附录：Prompt 模板

### A. 知识萃取 Prompt

```markdown
# 知识萃取任务

你是一个专业的知识管理专家。请从以下 {{documentCount}} 篇文档中提取核心知识。

## 输入文档

{{#each documents}}

### 文档 {{@index}}: {{this.title}}

来源: {{this.url}}
平台: {{this.platform}}
保存时间: {{this.savedAt}}

{{this.content}}

---

{{/each}}

## 提取要求

1. **主题识别**: 识别文档的共同主题和各自独特观点
2. **要点提取**: 提取 3-7 个核心要点，每个要点标注来源 [文档N]
3. **概念定义**: 提取文档中的核心概念并给出简明定义
4. **综合结论**: 基于所有文档给出一个综合性结论

## 输出格式

请按以下 JSON 格式输出：

\`\`\`json
{
"topics": ["主题1", "主题2"],
"keyPoints": [
{
"content": "要点内容",
"citations": [0, 1],
"importance": "high|medium"
}
],
"concepts": [
{
"term": "概念名",
"definition": "定义"
}
],
"conclusion": "综合结论"
}
\`\`\`
```

### B. 纠正意图推断 Prompt

```markdown
# 意图纠正分析

用户刚才说了 "{{originalInput}}"，系统理解为 "{{wrongIntent}}" 意图。

用户现在说 "{{correctionInput}}"，这表明系统理解错误。

请分析用户真正想要的意图类型：

- query: 搜索/查找内容
- organize: 整理/归类内容
- create: 生成/创作内容
- export: 导出/下载内容
- manage: 管理操作（删除/移动等）

## 分析步骤

1. 识别用户的纠正信号（"不对"/"错了"/"我是要..."等）
2. 提取用户想要的真正动作
3. 映射到正确的意图类型

## 输出

请只输出意图类型名称，如：organize
```
