# Phase 3: 高级能力 - 子方案

> **版本**: 2.3.0
> **父方案**: [AGENT_UPGRADE_IMPLEMENTATION_PLAN.md](../AGENT_UPGRADE_IMPLEMENTATION_PLAN.md)
> **V3 参考**: [AGENT_UPGRADE_PLAN_V3_20251225.md](../AGENT_UPGRADE_PLAN_V3_20251225.md)
> **日期**: 2025-12-26
> **状态**: ✅ 完成（Batch 5 + Batch 6 全部完成，包括前端集成）
> **更新**: V2.3 - Batch 6.3 前端集成完成：学习组件 + 意图纠正 UI + API 端点

---

## 概览

| 属性         | 值                                      |
| ------------ | --------------------------------------- |
| **目标**     | 知识萃取能力 + 自我进化机制             |
| **周期**     | 3 周                                    |
| **工时**     | 54h (+10h 前端集成)                     |
| **Batch**    | Batch 5 (知识萃取) + Batch 6 (自我进化) |
| **前置依赖** | Phase 2 完成                            |

### 与 V3 升级方案的对应关系

```
V3 升级方案                          Phase 3 子方案
────────────                         ────────────
Batch 4: 知识萃取 (26h)    ──────▶   Batch 5: 知识萃取 (32h)
  └─ KnowledgeExtractor                └─ 5.1 内容提取引擎
  └─ 格式化输出                         └─ 5.2 输出格式化
                                        └─ 5.3 Skill 集成
                                        └─ 5.4 前端集成

Batch 6: 自我进化 (18h)    ──────▶   Batch 6: 自我进化 (22h)
  └─ CorrectionLearner                 └─ 6.1 纠错学习机制
  └─ 应用学习结果                       └─ 6.2 集成到分类器
                                        └─ 6.3 前端集成
```

---

## 核心问题

### 问题 1: 知识碎片化

**现象**: 用户收藏了大量内容，但无法快速提炼知识

**用户痛点**:

- "我收藏了 20 篇 AI 文章，不知道讲了什么"
- "想写个总结，但手动整理太费时间"
- "记不清哪篇文章提到了某个概念"

**解决方案**:

- 多文档摘要（跨文档知识整合）
- 要点提取 + 来源标注（Perplexity 风格引用）
- 多种输出格式（摘要/纪要/大纲）

### 问题 2: 意图误判无法改进

**现象**: 同样的误判反复发生

**用户痛点**:

- "每次说'整理'它都理解成'搜索'"
- "纠正了也没用，下次还是错"
- "感觉 AI 不会学习"

**解决方案**:

- 检测用户纠正（"不对"/"错了"等信号）
- 记录纠正模式（向量相似度匹配）
- 应用到后续分类（学习结果优先）

---

## Batch 5: 知识萃取 (32h) ✅ 已完成

> **完成日期**: 2025-12-25
> **实际工时**: ~28h
> **关键交付物**:
>
> - `src/lib/ai-skills/skills/knowledge-extract/` - 完整 Skill 实现
> - `src/components/ai/deliverables/extraction-result-card.tsx` - 前端组件
> - 26 个单元测试全部通过

### 5.1 内容提取引擎 (12h)

**目标**: 从多篇文章中提取知识，对标 YouMind 的格式转化能力

#### 5.1.1 核心数据结构

```typescript
// src/lib/ai-skills/extract/types.ts

/**
 * 知识萃取请求
 */
export interface ExtractionRequest {
  bookmarkIds: number[]; // 目标书签 ID
  topic?: string; // 可选：指定主题
  format: ExtractionFormat; // 输出格式
  options?: {
    maxKeyPoints?: number; // 最大要点数（默认 7）
    includeConceptDefinitions?: boolean; // 是否包含概念定义
    includeActionItems?: boolean; // 是否包含行动项
  };
}

export type ExtractionFormat = "summary" | "memo" | "outline";

/**
 * 萃取结果
 */
export interface KnowledgeExtraction {
  id: string;
  title: string; // 自动生成的标题
  topic: string; // 识别/指定的主题

  // 核心萃取内容
  keyPoints: KeyPoint[]; // 核心要点（3-7 个）
  concepts: ConceptDefinition[]; // 核心概念
  conclusion: string; // 综合结论
  actionItems?: string[]; // 可选：行动建议

  // 来源信息
  sources: SourceInfo[]; // 来源书签列表

  // 元数据
  metadata: {
    sourceCount: number;
    extractedAt: Date;
    format: ExtractionFormat;
    llmModel: string;
    processingTimeMs: number;
  };
}

/**
 * 带来源标注的要点
 */
export interface KeyPoint {
  id: string;
  content: string; // 要点内容
  citations: Citation[]; // 支撑引用
  importance: "high" | "medium"; // 重要性
  synthesized: boolean; // 是否为综合推断
}

/**
 * 引用标注（Perplexity 风格）
 */
export interface Citation {
  id: number; // 引用编号 [1], [2]...
  sourceId: number; // 来源书签 ID
  sourceTitle: string; // 来源标题
  quotedText?: string; // 原文引用（可选）
  confidence: number; // 引用置信度 0-1
}

/**
 * 概念定义
 */
export interface ConceptDefinition {
  term: string; // 概念名称
  definition: string; // 定义
  relatedConcepts?: string[]; // 相关概念
  sourceIds: number[]; // 来源书签 ID
}

/**
 * 来源信息
 */
export interface SourceInfo {
  id: number; // 书签 ID
  index: number; // 引用编号 [1]
  title: string;
  url: string;
  platform: string;
  savedAt: Date;
}
```

#### 5.1.2 KnowledgeExtractor 类实现

```typescript
// src/lib/ai-skills/extract/knowledge-extractor.ts

export class KnowledgeExtractor {
  constructor(
    private readonly llm: LLMClient,
    private readonly bookmarkService: BookmarkService,
  ) {}

  /**
   * 知识萃取主流程
   */
  async extract(request: ExtractionRequest): Promise<KnowledgeExtraction> {
    const startTime = Date.now();

    // 1. 获取书签内容
    const contents = await this.fetchContents(request.bookmarkIds);

    // 2. 识别主题（如未指定）
    const topic = request.topic || (await this.identifyTopic(contents));

    // 3. 提取要点（带来源）
    const keyPoints = await this.extractKeyPoints(
      contents,
      topic,
      request.options,
    );

    // 4. 提取概念定义
    const concepts =
      request.options?.includeConceptDefinitions !== false
        ? await this.extractConcepts(contents, topic)
        : [];

    // 5. 生成综合结论
    const conclusion = await this.generateConclusion(
      keyPoints,
      concepts,
      topic,
    );

    // 6. 可选：生成行动建议
    const actionItems = request.options?.includeActionItems
      ? await this.generateActionItems(keyPoints, topic)
      : undefined;

    return {
      id: generateId(),
      title: this.generateTitle(topic, contents.length),
      topic,
      keyPoints,
      concepts,
      conclusion,
      actionItems,
      sources: this.buildSourceList(contents),
      metadata: {
        sourceCount: contents.length,
        extractedAt: new Date(),
        format: request.format,
        llmModel: this.llm.model,
        processingTimeMs: Date.now() - startTime,
      },
    };
  }

  /**
   * 主题识别
   */
  private async identifyTopic(contents: BookmarkContent[]): Promise<string> {
    const prompt = `分析以下 ${contents.length} 篇文章的标题和摘要，识别它们的共同主题。

文章列表：
${contents.map((c, i) => `${i + 1}. ${c.title}\n   摘要：${c.summary?.substring(0, 200) || "无"}`).join("\n")}

请直接输出主题名称（2-6 个字），不要其他解释。
例如：AI 编程、前端开发、产品设计`;

    return (await this.llm.complete(prompt)).trim();
  }

  /**
   * 要点提取（带来源标注）
   */
  private async extractKeyPoints(
    contents: BookmarkContent[],
    topic: string,
    options?: ExtractionRequest["options"],
  ): Promise<KeyPoint[]> {
    const maxPoints = options?.maxKeyPoints ?? 7;

    const prompt = `你是一个知识萃取专家。从以下 ${contents.length} 篇关于「${topic}」的内容中提取核心要点。

## 输入文档

${contents
  .map(
    (c, i) => `
### 【${i + 1}】${c.title}
${c.content?.substring(0, 2000) || c.summary || "内容不可用"}
`,
  )
  .join("\n---\n")}

## 提取要求

1. 提取 3-${maxPoints} 个核心要点
2. 每个要点用 [来源N] 标注出处
3. 如果是综合多个来源得出的结论，标注所有相关来源，并标记为综合推断
4. 合并相似观点，避免重复
5. 按重要性排序

## 输出格式（JSON）

{
  "keyPoints": [
    {
      "content": "要点内容描述",
      "citations": [1, 3],
      "importance": "high",
      "synthesized": false
    }
  ]
}`;

    const response = await this.llm.generateJSON<{ keyPoints: RawKeyPoint[] }>(
      prompt,
    );

    return response.keyPoints.map((kp, idx) => ({
      id: `kp-${idx + 1}`,
      content: kp.content,
      citations: kp.citations.map((srcIdx) => ({
        id: srcIdx,
        sourceId: contents[srcIdx - 1]?.bookmarkId,
        sourceTitle: contents[srcIdx - 1]?.title,
        confidence: 0.9,
      })),
      importance: kp.importance,
      synthesized: kp.synthesized || false,
    }));
  }

  /**
   * 概念提取
   */
  private async extractConcepts(
    contents: BookmarkContent[],
    topic: string,
  ): Promise<ConceptDefinition[]> {
    const prompt = `从以下关于「${topic}」的文章中，提取 3-5 个核心概念及其定义。

${contents.map((c, i) => `【${i + 1}】${c.title}: ${c.summary || ""}`).join("\n")}

输出 JSON：
{
  "concepts": [
    { "term": "概念名", "definition": "简明定义", "sourceIds": [1, 2] }
  ]
}`;

    const response = await this.llm.generateJSON<{
      concepts: ConceptDefinition[];
    }>(prompt);
    return response.concepts;
  }

  /**
   * 生成综合结论
   */
  private async generateConclusion(
    keyPoints: KeyPoint[],
    concepts: ConceptDefinition[],
    topic: string,
  ): Promise<string> {
    const prompt = `基于以下关于「${topic}」的要点和概念，生成一段综合结论（50-100 字）：

要点：
${keyPoints.map((kp) => `- ${kp.content}`).join("\n")}

核心概念：
${concepts.map((c) => `- ${c.term}: ${c.definition}`).join("\n")}

直接输出结论，不要额外解释。`;

    return (await this.llm.complete(prompt)).trim();
  }
}
```

#### 5.1.3 任务清单（细化）

| #     | 任务                           | 工时 | 文件路径                                           | 验收标准             |
| ----- | ------------------------------ | ---- | -------------------------------------------------- | -------------------- |
| 5.1.1 | 创建类型定义                   | 1h   | `src/lib/ai-skills/extract/types.ts`               | 包含所有上述类型     |
| 5.1.2 | 创建 KnowledgeExtractor 类框架 | 1h   | `src/lib/ai-skills/extract/knowledge-extractor.ts` | 主方法签名           |
| 5.1.3 | 实现 fetchContents             | 1h   | 同上                                               | 获取书签内容         |
| 5.1.4 | 实现 identifyTopic             | 1.5h | 同上                                               | LLM 主题识别         |
| 5.1.5 | 实现 extractKeyPoints          | 2.5h | 同上                                               | 带来源标注的要点提取 |
| 5.1.6 | 实现 extractConcepts           | 1.5h | 同上                                               | 概念+定义提取        |
| 5.1.7 | 实现 generateConclusion        | 1h   | 同上                                               | 综合结论生成         |
| 5.1.8 | 实现 generateActionItems       | 0.5h | 同上                                               | 可选行动建议         |
| 5.1.9 | 编写单元测试                   | 2h   | `__tests__/knowledge-extractor.test.ts`            | Mock LLM，覆盖主流程 |

---

### 5.2 输出格式化 (6h)

**目标**: 结构化、可导出的知识输出

#### 5.2.1 格式化器设计

```typescript
// src/lib/ai-skills/extract/formatter.ts

export class ExtractionFormatter {
  /**
   * 格式化萃取结果
   */
  format(extraction: KnowledgeExtraction, format: ExtractionFormat): string {
    switch (format) {
      case "summary":
        return this.formatSummary(extraction);
      case "memo":
        return this.formatMemo(extraction);
      case "outline":
        return this.formatOutline(extraction);
      default:
        throw new Error(`Unknown format: ${format}`);
    }
  }

  /**
   * Summary 格式（快速了解）
   */
  private formatSummary(e: KnowledgeExtraction): string {
    const tldr = e.conclusion.substring(0, 100);

    return `# ${e.title}

> **TL;DR**: ${tldr}

## 核心要点

${e.keyPoints
  .map(
    (kp) => `- ${kp.content} ${kp.citations.map((c) => `[${c.id}]`).join("")}`,
  )
  .join("\n")}

## 结论

${e.conclusion}

---
**来源** (${e.sources.length} 篇)
${e.sources.map((s) => `${s.index}. [${s.title}](${s.url})`).join("\n")}
`;
  }

  /**
   * Memo 格式（学习纪要）
   */
  private formatMemo(e: KnowledgeExtraction): string {
    return `# ${e.title}
> 整理日期：${e.metadata.extractedAt.toLocaleDateString("zh-CN")}
> 来源：${e.sources.length} 篇收藏

## 主题概览

${e.conclusion}

## 核心要点

${e.keyPoints
  .map(
    (kp, i) => `
### ${i + 1}. ${kp.content.split("，")[0]}

${kp.content}

> 来源：${kp.citations.map((c) => `[${c.sourceTitle}]`).join("、")}
`,
  )
  .join("\n")}

## 核心概念

| 概念 | 定义 | 来源 |
|-----|------|-----|
${e.concepts
  .map(
    (c) =>
      `| **${c.term}** | ${c.definition} | ${c.sourceIds.map((id) => `[${id}]`).join("")} |`,
  )
  .join("\n")}

${
  e.actionItems
    ? `
## 学习建议

${e.actionItems.map((item, i) => `${i + 1}. ${item}`).join("\n")}
`
    : ""
}

---
## 来源文档

${e.sources.map((s) => `${s.index}. [${s.title}](${s.url}) - ${s.platform}`).join("\n")}
`;
  }

  /**
   * Outline 格式（大纲）
   */
  private formatOutline(e: KnowledgeExtraction): string {
    return `# ${e.title}

## 一、主题概述
- ${e.topic}
- 来源：${e.sources.length} 篇收藏

## 二、核心要点
${e.keyPoints.map((kp, i) => `  ${i + 1}. ${kp.content}`).join("\n")}

## 三、关键概念
${e.concepts.map((c) => `  - **${c.term}**: ${c.definition}`).join("\n")}

## 四、结论
- ${e.conclusion}

${
  e.actionItems
    ? `
## 五、行动项
${e.actionItems.map((item, i) => `  ${i + 1}. ${item}`).join("\n")}
`
    : ""
}

---
来源: ${e.sources.map((s) => `[${s.index}]`).join(" ")}
`;
  }
}
```

#### 5.2.2 任务清单

| #     | 任务                        | 工时 | 文件路径                                 | 验收标准            |
| ----- | --------------------------- | ---- | ---------------------------------------- | ------------------- |
| 5.2.1 | 创建 ExtractionFormatter 类 | 0.5h | `src/lib/ai-skills/extract/formatter.ts` | 主方法签名          |
| 5.2.2 | 实现 formatSummary          | 1.5h | 同上                                     | TL;DR + 要点 + 来源 |
| 5.2.3 | 实现 formatMemo             | 2h   | 同上                                     | 完整学习纪要格式    |
| 5.2.4 | 实现 formatOutline          | 1h   | 同上                                     | 大纲层级格式        |
| 5.2.5 | 编写测试用例                | 1h   | `__tests__/formatter.test.ts`            | 各格式输出验证      |

---

### 5.3 萃取 Skill 集成 (8h)

**目标**: 创建 KnowledgeExtractSkill，注册到 SkillRegistry

#### 5.3.1 Skill 定义

```typescript
// src/lib/ai-skills/skills/knowledge-extract/index.ts

export const KNOWLEDGE_EXTRACT_SKILL: SkillDefinition = {
  id: "knowledge_extract",
  name: "知识萃取",
  description: "从多篇收藏中提取、整合知识",
  icon: "💡",
  category: "create",

  // 触发条件
  triggers: [
    /从.*?(收藏|文章|内容).*?(提取|萃取|总结|归纳)/,
    /帮我(总结|整理|归纳).*?(收藏|文章)/,
    /知识(萃取|提炼)/,
  ],

  steps: [
    {
      id: "collect",
      name: "收集内容",
      description: "获取目标书签的内容",
      progressWeight: 15,
    },
    {
      id: "identify",
      name: "识别主题",
      description: "分析文档，识别共同主题",
      progressWeight: 15,
    },
    {
      id: "extract",
      name: "提取知识",
      description: "提取要点、概念、结论",
      progressWeight: 40,
    },
    {
      id: "format",
      name: "格式化输出",
      description: "按选定格式生成输出",
      progressWeight: 20,
    },
    {
      id: "deliver",
      name: "交付结果",
      description: "返回萃取结果",
      progressWeight: 10,
    },
  ],

  // 交付物类型
  deliverableType: "extraction",

  // 前端组件提示
  uiHints: {
    showFormatSelector: true,
    showExportButton: true,
    showSourceList: true,
  },
};
```

#### 5.3.2 Skill 执行器

```typescript
// src/lib/ai-skills/skills/knowledge-extract/executor.ts

export class KnowledgeExtractSkillExecutor extends BaseSkillExecutor {
  constructor(
    private readonly extractor: KnowledgeExtractor,
    private readonly formatter: ExtractionFormatter,
  ) {
    super(KNOWLEDGE_EXTRACT_SKILL);
  }

  async execute(
    context: SkillExecutionContext,
    reporter: ProgressReporter,
  ): AsyncGenerator<SkillChunk> {
    // Step 1: 收集内容
    yield* this.executeStep('collect', reporter, async () => {
      const bookmarkIds = await this.resolveBookmarkIds(context);
      const contents = await this.extractor.fetchContents(bookmarkIds);
      context.stepData.contents = contents;
      return { bookmarkCount: contents.length };
    });

    // Step 2: 识别主题
    yield* this.executeStep('identify', reporter, async () => {
      const topic = context.input.topic ||
        await this.extractor.identifyTopic(context.stepData.contents);
      context.stepData.topic = topic;
      return { topic };
    });

    // Step 3: 提取知识
    yield* this.executeStep('extract', reporter, async () => {
      const extraction = await this.extractor.extract({
        bookmarkIds: context.stepData.contents.map(c => c.bookmarkId),
        topic: context.stepData.topic,
        format: context.input.format || 'memo',
      });
      context.stepData.extraction = extraction;
      return {
        keyPointCount: extraction.keyPoints.length,
        conceptCount: extraction.concepts.length,
      };
    });

    // Step 4: 格式化输出
    yield* this.executeStep('format', reporter, async () => {
      const format = context.input.format || 'memo';
      const formatted = this.formatter.format(context.stepData.extraction, format);
      context.stepData.formatted = formatted;
      return { format };
    });

    // Step 5: 交付结果
    yield {
      type: 'deliverable',
      data: {
        format: 'extraction',
        content: context.stepData.formatted,
        metadata: {
          ...context.stepData.extraction.metadata,
          title: context.stepData.extraction.title,
        },
        // 供前端使用的结构化数据
        structured: context.stepData.extraction,
      },
    };
  }
}
```

#### 5.3.3 任务清单

| #     | 任务                               | 工时 | 文件路径                               | 验收标准               |
| ----- | ---------------------------------- | ---- | -------------------------------------- | ---------------------- |
| 5.3.1 | 创建 Skill 定义                    | 1h   | `skills/knowledge-extract/index.ts`    | 完整 SkillDefinition   |
| 5.3.2 | 实现 KnowledgeExtractSkillExecutor | 3h   | `skills/knowledge-extract/executor.ts` | 5 步骤执行             |
| 5.3.3 | 实现 resolveBookmarkIds            | 1h   | 同上                                   | 从上下文解析书签       |
| 5.3.4 | 注册到 SkillRegistry               | 0.5h | `src/lib/ai-skills/register.ts`        | 添加 knowledge_extract |
| 5.3.5 | 编写集成测试                       | 2.5h | `__tests__/integration.test.ts`        | 完整流程测试           |

---

### 5.4 前端集成 (6h)

**目标**: 萃取结果展示 + 格式切换 + 导出功能

#### 5.4.1 与 Phase 4 (Batch 7) 的协同

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Phase 3 + Phase 4 协同                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   Phase 3: 后端能力                       Phase 4: 前端组件          │
│   ─────────────                          ─────────────              │
│                                                                      │
│   KnowledgeExtractor ────────────────▶ ExtractionResultCard         │
│   (知识萃取引擎)                         (萃取结果卡片)               │
│                                          • 要点展示                   │
│                                          • 来源标注交互               │
│                                          • 格式切换 Tab               │
│                                                                      │
│   ExtractionFormatter ───────────────▶ FormatSelector               │
│   (格式化器)                             (格式选择器)                 │
│                                          • summary/memo/outline      │
│                                                                      │
│   deliverable chunk ─────────────────▶ QuickActions                 │
│   (交付物)                               (快速操作栏)                 │
│                                          • 📋 复制                   │
│                                          • 💾 保存                   │
│                                          • 📤 导出                   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

#### 5.4.2 前端组件设计

```typescript
// src/components/ai-chat/extraction-result-card.tsx

interface ExtractionResultCardProps {
  extraction: KnowledgeExtraction;
  onSourceClick: (bookmarkId: number) => void;
  onExport: (format: ExportFormat) => void;
  onSave: () => void;
}

export function ExtractionResultCard({
  extraction,
  onSourceClick,
  onExport,
  onSave,
}: ExtractionResultCardProps) {
  const [activeFormat, setActiveFormat] = useState<ExtractionFormat>('memo');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-yellow-500" />
          {extraction.title}
        </CardTitle>
        <CardDescription>
          基于 {extraction.sources.length} 篇收藏 ·
          {extraction.keyPoints.length} 个要点 ·
          {extraction.concepts.length} 个概念
        </CardDescription>
      </CardHeader>

      <CardContent>
        {/* 格式切换 Tab */}
        <Tabs value={activeFormat} onValueChange={setActiveFormat}>
          <TabsList>
            <TabsTrigger value="summary">📝 摘要</TabsTrigger>
            <TabsTrigger value="memo">📋 纪要</TabsTrigger>
            <TabsTrigger value="outline">🗂️ 大纲</TabsTrigger>
          </TabsList>

          <TabsContent value={activeFormat}>
            {/* 渲染格式化内容 */}
            <MarkdownRenderer
              content={formatExtraction(extraction, activeFormat)}
            />
          </TabsContent>
        </Tabs>

        {/* 来源列表 */}
        <Collapsible>
          <CollapsibleTrigger className="flex items-center gap-2 text-sm">
            <ChevronRight className="h-4 w-4" />
            查看来源 ({extraction.sources.length})
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="space-y-2 mt-2">
              {extraction.sources.map(source => (
                <button
                  key={source.id}
                  onClick={() => onSourceClick(source.id)}
                  className="flex items-center gap-2 text-sm text-primary hover:underline"
                >
                  [{source.index}] {source.title}
                </button>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>

      {/* Quick Actions */}
      <CardFooter className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={() => onExport('markdown')}>
          <Download className="h-4 w-4 mr-1" />
          导出
        </Button>
        <Button variant="ghost" size="sm" onClick={onSave}>
          <Bookmark className="h-4 w-4 mr-1" />
          保存
        </Button>
      </CardFooter>
    </Card>
  );
}
```

#### 5.4.3 任务清单

| #     | 任务                      | 工时 | 文件路径                                        | 验收标准             |
| ----- | ------------------------- | ---- | ----------------------------------------------- | -------------------- |
| 5.4.1 | 创建 ExtractionResultCard | 2h   | `components/ai-chat/extraction-result-card.tsx` | 完整卡片 UI          |
| 5.4.2 | 实现格式切换 Tab          | 1h   | 同上                                            | 3 种格式切换         |
| 5.4.3 | 实现来源标注交互          | 1h   | 同上                                            | 点击跳转书签详情     |
| 5.4.4 | 集成导出功能              | 0.5h | 同上                                            | 复用 ExportDialogV2  |
| 5.4.5 | 集成到消息渲染            | 1h   | `components/ai-chat/message-item.tsx`           | 检测 extraction 类型 |
| 5.4.6 | 前端集成测试              | 0.5h | 手动测试                                        | 萃取结果正确渲染     |

---

## Batch 6: 自我进化 (22h) ✅ 已完成

> **完成日期**: 2025-12-25
> **实际工时**: ~20h
> **关键交付物**:
>
> - `src/lib/ai-learning/` - 完整自我进化模块
>   - `correction-detector.ts` - 纠正信号检测器
>   - `correction-learner.ts` - 纠正学习器（数据库持久化）
>   - `learning-aware-classifier.ts` - 学习感知分类器
>   - `feedback-integration.ts` - 前端反馈集成
> - `supabase/migrations/20251225000002_add_intent_corrections.sql` - 数据库迁移
> - 23 个单元测试全部通过

### 6.1 纠错学习机制 (10h)

**目标**: 从用户纠正中学习，解决重复误判问题

#### 6.1.1 纠正检测算法

```typescript
// src/lib/ai-learning/correction-detector.ts

export class CorrectionDetector {
  private readonly CORRECTION_PATTERNS = [
    // 直接否定
    {
      pattern: /^(不对|错了|不是这个|搞错了)/i,
      signal: "explicit_wrong",
      confidence: 0.95,
    },
    { pattern: /^(不|否)/i, signal: "explicit_wrong", confidence: 0.7 },

    // 纠正句式
    {
      pattern: /我(说的|要的|想要的)是.*不是/i,
      signal: "correction_follow",
      confidence: 0.9,
    },
    { pattern: /不是.*是/i, signal: "correction_follow", confidence: 0.85 },
    { pattern: /应该是/i, signal: "correction_follow", confidence: 0.8 },

    // 重新表述
    {
      pattern: /我(再|重新)说一遍/i,
      signal: "reformulation",
      confidence: 0.75,
    },
    { pattern: /换个说法/i, signal: "reformulation", confidence: 0.75 },
  ];

  /**
   * 检测是否为纠正信号
   */
  detect(
    currentInput: string,
    previousOutput: AIOutput,
    context: ConversationState,
  ): CorrectionSignal | null {
    // 1. 模式匹配
    for (const { pattern, signal, confidence } of this.CORRECTION_PATTERNS) {
      if (pattern.test(currentInput)) {
        return {
          signal,
          confidence,
          originalInput: context.lastUserInput,
          wrongIntent: previousOutput.intent,
          correctionInput: currentInput,
        };
      }
    }

    // 2. 语义相似度检测（用户换种说法重试）
    if (context.lastUserInput && previousOutput.wasSuccessful === false) {
      const similarity = this.computeSimilarity(
        currentInput,
        context.lastUserInput,
      );
      if (similarity > 0.7) {
        return {
          signal: "reformulation",
          confidence: similarity,
          originalInput: context.lastUserInput,
          wrongIntent: previousOutput.intent,
          correctionInput: currentInput,
        };
      }
    }

    return null;
  }

  /**
   * 推断正确意图
   */
  inferCorrectIntent(
    correctionInput: string,
    wrongIntent: IntentType,
  ): IntentType | null {
    // 从"我是要...，不是..."句式中提取
    const match = correctionInput.match(
      /我(?:是要|想要?|要的是)(.+?)(?:不是|而不是)/,
    );
    if (match) {
      return this.mapActionToIntent(match[1].trim());
    }

    // 基于否定推断
    const intentNegations: Record<string, IntentType[]> = {
      不是搜索: ["organize", "create", "export"],
      不是整理: ["query", "create"],
      不是总结: ["query", "organize"],
    };

    for (const [negation, alternatives] of Object.entries(intentNegations)) {
      if (correctionInput.includes(negation)) {
        // 返回最可能的替代意图（排除当前错误意图）
        return alternatives.find((i) => i !== wrongIntent) || null;
      }
    }

    return null;
  }

  private mapActionToIntent(action: string): IntentType | null {
    const actionMap: Record<string, IntentType> = {
      整理: "organize",
      分类: "organize",
      搜索: "query",
      查找: "query",
      总结: "create",
      摘要: "create",
      导出: "export",
    };

    for (const [keyword, intent] of Object.entries(actionMap)) {
      if (action.includes(keyword)) return intent;
    }
    return null;
  }
}
```

#### 6.1.2 纠正学习器

```typescript
// src/lib/ai-learning/correction-learner.ts

export class CorrectionLearner {
  constructor(
    private readonly db: SupabaseClient,
    private readonly embedder: EmbeddingService,
  ) {}

  /**
   * 记录用户纠正
   */
  async recordCorrection(params: {
    userId: string;
    originalMessage: string;
    wrongIntent: IntentType;
    correctIntent: IntentType;
    signal: CorrectionSignal;
  }): Promise<void> {
    // 1. 生成嵌入向量（用于后续相似度匹配）
    const embedding = await this.embedder.embed(params.originalMessage);

    // 2. 存储纠正记录
    await this.db.from("intent_corrections").insert({
      user_id: params.userId,
      original_input: params.originalMessage,
      original_input_embedding: embedding,
      wrong_intent: params.wrongIntent,
      correct_intent: params.correctIntent,
      signal: params.signal.signal,
      confidence: params.signal.confidence,
    });
  }

  /**
   * 查找相似的纠正记录
   */
  async findSimilarCorrection(
    input: string,
    userId: string,
  ): Promise<SimilarCorrection | null> {
    const embedding = await this.embedder.embed(input);

    const { data } = await this.db.rpc("find_similar_corrections", {
      query_embedding: embedding,
      target_user_id: userId,
      similarity_threshold: 0.8,
      limit_count: 1,
    });

    if (!data || data.length === 0) return null;

    return {
      id: data[0].id,
      originalInput: data[0].original_input,
      correctIntent: data[0].correct_intent,
      similarity: data[0].similarity,
    };
  }

  /**
   * 记录学习应用
   */
  async recordApplication(correctionId: string): Promise<void> {
    await this.db
      .from("intent_corrections")
      .update({
        applied_count: this.db.raw("applied_count + 1"),
        last_applied_at: new Date().toISOString(),
      })
      .eq("id", correctionId);
  }
}
```

#### 6.1.3 数据库迁移

```sql
-- supabase/migrations/20251225000003_add_intent_corrections.sql

CREATE TABLE intent_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- 原始场景
  original_input TEXT NOT NULL,
  original_input_embedding vector(1536),
  wrong_intent TEXT NOT NULL,

  -- 纠正信息
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
CREATE INDEX idx_corrections_user ON intent_corrections(user_id);
CREATE INDEX idx_corrections_embedding ON intent_corrections
  USING ivfflat (original_input_embedding vector_cosine_ops) WITH (lists = 100);

-- RLS
ALTER TABLE intent_corrections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own corrections"
  ON intent_corrections FOR ALL TO authenticated
  USING (auth.uid() = user_id);

-- 相似度搜索函数
CREATE OR REPLACE FUNCTION find_similar_corrections(
  query_embedding vector(1536),
  target_user_id UUID,
  similarity_threshold FLOAT DEFAULT 0.8,
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
LANGUAGE plpgsql AS $$
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

#### 6.1.4 任务清单

| #     | 任务                       | 工时 | 文件路径                                     | 验收标准               |
| ----- | -------------------------- | ---- | -------------------------------------------- | ---------------------- |
| 6.1.1 | 创建 CorrectionDetector 类 | 1.5h | `src/lib/ai-learning/correction-detector.ts` | 模式匹配 + 推断        |
| 6.1.2 | 实现纠正模式匹配           | 1h   | 同上                                         | 10+ 模式覆盖           |
| 6.1.3 | 实现意图推断逻辑           | 1.5h | 同上                                         | 从纠正文本推断         |
| 6.1.4 | 创建 CorrectionLearner 类  | 1h   | `src/lib/ai-learning/correction-learner.ts`  | 主类框架               |
| 6.1.5 | 实现 recordCorrection      | 1h   | 同上                                         | 存储 + 嵌入向量        |
| 6.1.6 | 实现 findSimilarCorrection | 1.5h | 同上                                         | 向量相似度搜索         |
| 6.1.7 | 数据库迁移                 | 1h   | `supabase/migrations/`                       | 表 + 索引 + RLS + 函数 |
| 6.1.8 | 编写单元测试               | 1.5h | `__tests__/correction-*.test.ts`             | 检测 + 学习流程        |

---

### 6.2 集成到分类器 (8h)

**目标**: 学习结果优先于默认分类

#### 6.2.1 增强版意图分类器

```typescript
// src/lib/ai-skills/router/intent-classifier-with-learning.ts

export class IntentClassifierWithLearning extends IntentClassifier {
  constructor(
    private readonly correctionLearner: CorrectionLearner,
    private readonly correctionDetector: CorrectionDetector,
    config: ClassifierConfig,
  ) {
    super(config);
  }

  /**
   * 增强版分类（带学习）
   */
  async classify(
    input: string,
    userId: string,
    context?: ConversationState,
  ): Promise<ClassificationResultWithLearning> {
    // 1. 检测是否为纠正信号
    if (context?.previousOutput) {
      const correction = this.correctionDetector.detect(
        input,
        context.previousOutput,
        context,
      );

      if (correction) {
        const correctIntent = this.correctionDetector.inferCorrectIntent(
          input,
          correction.wrongIntent,
        );

        if (correctIntent) {
          // 记录学习
          await this.correctionLearner.recordCorrection({
            userId,
            originalMessage: correction.originalInput,
            wrongIntent: correction.wrongIntent,
            correctIntent,
            signal: correction,
          });

          return {
            primary: { type: correctIntent, confidence: 0.95 },
            candidates: [],
            needsDisambiguation: false,
            correctionApplied: true,
            correctionSource: "current_session",
          };
        }
      }
    }

    // 2. 查询历史学习记录
    const learned = await this.correctionLearner.findSimilarCorrection(
      input,
      userId,
    );

    if (learned && learned.similarity > 0.85) {
      // 应用学习结果
      await this.correctionLearner.recordApplication(learned.id);

      return {
        primary: {
          type: learned.correctIntent,
          confidence: learned.similarity,
        },
        candidates: [],
        needsDisambiguation: false,
        learningApplied: true,
        learningSource: learned.id,
      };
    }

    // 3. 正常分类流程
    const result = await super.classify(input);

    return {
      ...result,
      learningApplied: false,
      correctionApplied: false,
    };
  }
}

interface ClassificationResultWithLearning extends ClassificationResult {
  learningApplied?: boolean;
  learningSource?: string;
  correctionApplied?: boolean;
  correctionSource?: string;
}
```

#### 6.2.2 与 Phase 4 (Batch 7B) 的协同

```
┌─────────────────────────────────────────────────────────────────────┐
│              Phase 3 Batch 6 + Phase 4 Batch 7B 协同                  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   Phase 3 Batch 6                        Phase 4 Batch 7/7B         │
│   ──────────────                         ──────────────             │
│                                                                      │
│   CorrectionDetector ─────────────────▶ QuickActions 👎              │
│   (纠正检测)                             (负面反馈触发)               │
│                                          "哪里不对？"                 │
│                                          • 理解错了我的意图           │
│                                          • 结果不准确                 │
│                                                                      │
│   CorrectionLearner ──────────────────▶ FeedbackService              │
│   (纠正学习)                             (反馈服务)                   │
│                                          wrong_intent → 触发学习     │
│                                                                      │
│   IntentClassifierWithLearning ───────▶ 消息标记                     │
│   (增强分类器)                           "AI 记住了你的偏好"           │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

#### 6.2.3 任务清单

| #     | 任务                              | 工时 | 文件路径                                    | 验收标准             |
| ----- | --------------------------------- | ---- | ------------------------------------------- | -------------------- |
| 6.2.1 | 创建 IntentClassifierWithLearning | 1.5h | `router/intent-classifier-with-learning.ts` | 继承 + 增强          |
| 6.2.2 | 实现纠正检测集成                  | 1.5h | 同上                                        | 检测 → 学习 → 重分类 |
| 6.2.3 | 实现历史学习应用                  | 1.5h | 同上                                        | 查询 → 应用 → 记录   |
| 6.2.4 | 修改 UnifiedEngine                | 1h   | `engine/unified-engine.ts`                  | 注入增强分类器       |
| 6.2.5 | 修改 API 路由                     | 0.5h | `api/agent/unified/route.ts`                | 传递 userId          |
| 6.2.6 | 编写集成测试                      | 2h   | `__tests__/learning-integration.test.ts`    | 纠正→学习→应用       |

---

### 6.3 前端集成 (4h)

**目标**: 纠错检测 UI + 学习反馈提示

#### 6.3.1 任务清单

| #     | 任务                         | 工时 | 文件路径                                           | 验收标准             |
| ----- | ---------------------------- | ---- | -------------------------------------------------- | -------------------- |
| 6.3.1 | 创建 CorrectionDetectedToast | 1h   | `components/ai-chat/correction-detected-toast.tsx` | 检测到纠错时显示     |
| 6.3.2 | 实现"这不是我的意思"按钮     | 1h   | `components/ai-chat/message-actions.tsx`           | 手动触发纠错         |
| 6.3.3 | 实现学习确认提示             | 0.5h | `components/ai-chat/learning-confirmation.tsx`     | "已学习，下次更准确" |
| 6.3.4 | 集成到消息渲染               | 1h   | `components/ai-chat/message-item.tsx`              | 尾部添加纠错按钮     |
| 6.3.5 | 前端测试                     | 0.5h | 手动测试                                           | 纠错流程正确触发     |

---

## 验收标准（完整）

### Batch 5 完成标准

| 标准                               | 验证方法            | 优先级 |
| ---------------------------------- | ------------------- | ------ |
| 从 5 篇文章提取要点 + 来源标注     | 单元测试 + 手动验证 | P0     |
| 每个要点至少有 1 个引用标注        | 自动化测试          | P0     |
| 支持 summary/memo/outline 三种格式 | 格式切换测试        | P0     |
| 萃取结果可导出为 Markdown          | 导出功能测试        | P1     |
| 概念定义提取准确                   | 人工评估            | P1     |
| 处理时间 < 30 秒（5 篇文章）       | 性能测试            | P2     |

### Batch 6 完成标准

| 标准                        | 验证方法     | 优先级 |
| --------------------------- | ------------ | ------ |
| 检测"不对"/"错了"等纠正信号 | 模式匹配测试 | P0     |
| 正确推断用户意图            | 推断测试用例 | P0     |
| 纠正记录持久化              | 数据库验证   | P0     |
| 后续相似输入应用学习结果    | 集成测试     | P0     |
| 相似度阈值 > 0.85 时应用    | 参数验证     | P1     |
| 学习应用次数正确递增        | 数据库验证   | P2     |

---

## 相关文档

- [最佳实践参考](./best-practices.md) ✅ 已创建
- [验证用例](./validation-cases.md) ✅ 已创建
- [Phase 2 子方案](../phase-2-core-scenarios/README.md)
- [Phase 4 交互升级](../phase-4-interaction/README.md) - Batch 7/7B 协同
- [V3 升级方案](../AGENT_UPGRADE_PLAN_V3_20251225.md) - 详细参考
