# Phase 3 验证用例

> **版本**: 1.0.0
> **日期**: 2025-12-25
> **用途**: Phase 3 各任务的验证用例和测试场景
> **关联**: [README.md](./README.md) | [best-practices.md](./best-practices.md)

---

## 目录

- [Batch 5: 知识萃取验证](#batch-5-知识萃取验证)
  - [5.1 内容提取引擎测试](#51-内容提取引擎测试)
  - [5.2 输出格式化测试](#52-输出格式化测试)
  - [5.3 Skill 集成测试](#53-skill-集成测试)
  - [5.4 前端集成测试](#54-前端集成测试)
- [Batch 6: 自我进化验证](#batch-6-自我进化验证)
  - [6.1 纠错学习机制测试](#61-纠错学习机制测试)
  - [6.2 分类器集成测试](#62-分类器集成测试)
  - [6.3 前端集成测试](#63-前端集成测试)
- [端到端场景测试](#端到端场景测试)
- [性能基准测试](#性能基准测试)

---

## Batch 5: 知识萃取验证

### 5.1 内容提取引擎测试

#### 5.1.1 主题识别测试

```typescript
// __tests__/knowledge-extractor/topic-identification.test.ts

describe("KnowledgeExtractor.identifyTopic", () => {
  const testCases: TopicTestCase[] = [
    {
      name: "同一主题的多篇文章",
      input: [
        {
          title: "GPT-4o 发布：多模态能力升级",
          summary: "OpenAI发布GPT-4o，支持图像和语音...",
        },
        {
          title: "Claude 3.5 Sonnet 评测",
          summary: "Anthropic最新模型性能对比...",
        },
        {
          title: "Gemini 2.0 Flash 实测",
          summary: "Google推出新一代多模态模型...",
        },
      ],
      expectedTopic: "AI 大模型",
      acceptableTopics: ["AI 模型", "大语言模型", "LLM", "人工智能"],
    },
    {
      name: "混合主题文章",
      input: [
        {
          title: "React 19 新特性",
          summary: "React Compiler、Server Components...",
        },
        { title: "Next.js 15 发布", summary: "Turbopack、新路由系统..." },
        { title: "Tailwind CSS 4.0", summary: "全新配置系统、性能优化..." },
      ],
      expectedTopic: "前端开发",
      acceptableTopics: ["前端技术", "Web 开发", "React 生态"],
    },
    {
      name: "单篇文章",
      input: [
        {
          title: "Rust 内存安全原理",
          summary: "所有权、借用检查器、生命周期...",
        },
      ],
      expectedTopic: "Rust",
      acceptableTopics: ["Rust 编程", "系统编程", "内存安全"],
    },
  ];

  test.each(testCases)(
    "$name",
    async ({ input, expectedTopic, acceptableTopics }) => {
      const extractor = new KnowledgeExtractor(mockLLM, mockBookmarkService);
      const topic = await extractor.identifyTopic(input);

      const isAcceptable =
        topic === expectedTopic ||
        acceptableTopics.some((t) => topic.includes(t) || t.includes(topic));

      expect(isAcceptable).toBe(true);
    },
  );
});
```

#### 5.1.2 要点提取测试

```typescript
// __tests__/knowledge-extractor/key-point-extraction.test.ts

describe("KnowledgeExtractor.extractKeyPoints", () => {
  const testCases: KeyPointTestCase[] = [
    {
      name: "标准多文档要点提取",
      input: {
        contents: [
          {
            bookmarkId: 1,
            title: "AI Agent 开发指南",
            content:
              "1. Agent 需要具备工具调用能力\n2. 规划能力是核心\n3. 记忆系统不可或缺",
          },
          {
            bookmarkId: 2,
            title: "LangChain Agent 实践",
            content: "Agent 的核心是 ReAct 模式：推理+行动循环",
          },
        ],
        topic: "AI Agent",
        options: { maxKeyPoints: 5 },
      },
      expectedOutput: {
        minKeyPoints: 3,
        maxKeyPoints: 5,
        requirements: [
          "每个要点必须有 citations 数组",
          "每个 citation 必须有有效的 sourceId",
          "importance 必须是 high 或 medium",
        ],
      },
    },
    {
      name: "综合推断要点",
      input: {
        contents: [
          { bookmarkId: 1, title: "文章A", content: "A观点：性能很重要" },
          { bookmarkId: 2, title: "文章B", content: "B观点：可维护性更重要" },
        ],
        topic: "软件设计",
        options: { maxKeyPoints: 3 },
      },
      expectedOutput: {
        hasSynthesizedPoint: true, // 至少有一个综合推断点
        requirements: [
          "综合推断点的 synthesized 应为 true",
          "综合推断点应引用多个来源",
        ],
      },
    },
  ];

  test.each(testCases)("$name", async ({ input, expectedOutput }) => {
    const extractor = new KnowledgeExtractor(mockLLM, mockBookmarkService);
    const keyPoints = await extractor.extractKeyPoints(
      input.contents,
      input.topic,
      input.options,
    );

    // 数量验证
    expect(keyPoints.length).toBeGreaterThanOrEqual(
      expectedOutput.minKeyPoints || 1,
    );
    expect(keyPoints.length).toBeLessThanOrEqual(
      expectedOutput.maxKeyPoints || 7,
    );

    // 结构验证
    keyPoints.forEach((kp) => {
      expect(kp.id).toBeDefined();
      expect(kp.content).toBeTruthy();
      expect(kp.citations).toBeInstanceOf(Array);
      expect(kp.citations.length).toBeGreaterThan(0);
      expect(["high", "medium"]).toContain(kp.importance);
      expect(typeof kp.synthesized).toBe("boolean");

      // 引用验证
      kp.citations.forEach((citation) => {
        expect(citation.sourceId).toBeDefined();
        expect(citation.sourceTitle).toBeTruthy();
        expect(citation.confidence).toBeGreaterThan(0);
        expect(citation.confidence).toBeLessThanOrEqual(1);
      });
    });

    // 综合推断验证
    if (expectedOutput.hasSynthesizedPoint) {
      const hasSynthesized = keyPoints.some((kp) => kp.synthesized);
      expect(hasSynthesized).toBe(true);
    }
  });
});
```

#### 5.1.3 概念提取测试

```typescript
// __tests__/knowledge-extractor/concept-extraction.test.ts

describe("KnowledgeExtractor.extractConcepts", () => {
  test("从技术文章提取核心概念", async () => {
    const contents = [
      {
        bookmarkId: 1,
        title: "RAG 技术详解",
        summary:
          "RAG (Retrieval-Augmented Generation) 是结合检索和生成的技术...",
      },
      {
        bookmarkId: 2,
        title: "向量数据库入门",
        summary: "向量数据库存储 embedding，支持语义搜索...",
      },
    ];

    const extractor = new KnowledgeExtractor(mockLLM, mockBookmarkService);
    const concepts = await extractor.extractConcepts(contents, "RAG 技术");

    expect(concepts.length).toBeGreaterThanOrEqual(2);
    expect(concepts.length).toBeLessThanOrEqual(5);

    concepts.forEach((concept) => {
      expect(concept.term).toBeTruthy();
      expect(concept.definition).toBeTruthy();
      expect(concept.definition.length).toBeGreaterThan(10);
      expect(concept.sourceIds).toBeInstanceOf(Array);
      expect(concept.sourceIds.length).toBeGreaterThan(0);
    });

    // 验证提取了关键概念
    const termNames = concepts.map((c) => c.term.toLowerCase());
    const hasRagConcept = termNames.some(
      (t) => t.includes("rag") || t.includes("检索增强"),
    );
    expect(hasRagConcept).toBe(true);
  });

  test("空内容返回空数组", async () => {
    const extractor = new KnowledgeExtractor(mockLLM, mockBookmarkService);
    const concepts = await extractor.extractConcepts([], "未知主题");

    expect(concepts).toEqual([]);
  });
});
```

#### 5.1.4 引用标注格式测试

```typescript
// __tests__/knowledge-extractor/citation-format.test.ts

describe("Citation Format (Perplexity Style)", () => {
  test("引用编号连续且从 1 开始", async () => {
    const extraction = await extractor.extract({
      bookmarkIds: [1, 2, 3, 4, 5],
      format: "memo",
    });

    const allCitationIds = extraction.keyPoints
      .flatMap((kp) => kp.citations)
      .map((c) => c.id);

    const uniqueIds = [...new Set(allCitationIds)].sort((a, b) => a - b);

    // 验证从 1 开始
    expect(uniqueIds[0]).toBe(1);

    // 验证连续性（无跳跃）
    for (let i = 1; i < uniqueIds.length; i++) {
      expect(uniqueIds[i] - uniqueIds[i - 1]).toBe(1);
    }
  });

  test("来源列表与引用编号匹配", async () => {
    const extraction = await extractor.extract({
      bookmarkIds: [1, 2, 3],
      format: "summary",
    });

    // 每个 source 都有唯一的 index
    const sourceIndices = extraction.sources.map((s) => s.index);
    expect(new Set(sourceIndices).size).toBe(extraction.sources.length);

    // 每个引用的 id 都能在 sources 中找到对应
    extraction.keyPoints.forEach((kp) => {
      kp.citations.forEach((citation) => {
        const source = extraction.sources.find((s) => s.index === citation.id);
        expect(source).toBeDefined();
        expect(source?.id).toBe(citation.sourceId);
      });
    });
  });
});
```

---

### 5.2 输出格式化测试

#### 5.2.1 Summary 格式测试

```typescript
// __tests__/extraction-formatter/summary-format.test.ts

describe("ExtractionFormatter.formatSummary", () => {
  const sampleExtraction: KnowledgeExtraction = {
    id: "test-1",
    title: "前端框架趋势总结",
    topic: "前端开发",
    keyPoints: [
      {
        id: "kp-1",
        content: "React Server Components 改变了前端架构",
        citations: [
          { id: 1, sourceId: 101, sourceTitle: "RSC 指南", confidence: 0.9 },
        ],
        importance: "high",
        synthesized: false,
      },
      {
        id: "kp-2",
        content: "边缘渲染成为新趋势",
        citations: [
          { id: 1, sourceId: 101, sourceTitle: "RSC 指南", confidence: 0.8 },
          {
            id: 2,
            sourceId: 102,
            sourceTitle: "Vercel 博客",
            confidence: 0.85,
          },
        ],
        importance: "medium",
        synthesized: true,
      },
    ],
    concepts: [],
    conclusion: "前端正在向服务端渲染和边缘计算演进",
    sources: [
      {
        id: 101,
        index: 1,
        title: "RSC 指南",
        url: "https://...",
        platform: "blog",
        savedAt: new Date(),
      },
      {
        id: 102,
        index: 2,
        title: "Vercel 博客",
        url: "https://...",
        platform: "blog",
        savedAt: new Date(),
      },
    ],
    metadata: {
      sourceCount: 2,
      extractedAt: new Date(),
      format: "summary",
      llmModel: "claude-3-sonnet",
      processingTimeMs: 1500,
    },
  };

  test("包含必需的结构元素", () => {
    const formatter = new ExtractionFormatter();
    const output = formatter.format(sampleExtraction, "summary");

    // 标题
    expect(output).toContain("# 前端框架趋势总结");

    // TL;DR
    expect(output).toMatch(/>\s*\*\*TL;DR\*\*:/);

    // 核心要点
    expect(output).toContain("## 核心要点");
    expect(output).toContain("React Server Components");

    // 引用标注
    expect(output).toMatch(/\[1\]/);
    expect(output).toMatch(/\[2\]/);

    // 结论
    expect(output).toContain("## 结论");

    // 来源列表
    expect(output).toContain("**来源**");
    expect(output).toContain("[RSC 指南]");
  });

  test("引用链接格式正确", () => {
    const formatter = new ExtractionFormatter();
    const output = formatter.format(sampleExtraction, "summary");

    // 验证 Markdown 链接格式
    expect(output).toMatch(/\[RSC 指南\]\(https:\/\//);
    expect(output).toMatch(/\[Vercel 博客\]\(https:\/\//);
  });
});
```

#### 5.2.2 Memo 格式测试

```typescript
// __tests__/extraction-formatter/memo-format.test.ts

describe("ExtractionFormatter.formatMemo", () => {
  test("包含学习纪要特有元素", () => {
    const formatter = new ExtractionFormatter();
    const output = formatter.format(sampleExtraction, "memo");

    // 元信息
    expect(output).toMatch(/整理日期：/);
    expect(output).toMatch(/来源：\d+ 篇收藏/);

    // 主题概览
    expect(output).toContain("## 主题概览");

    // 分节要点
    expect(output).toContain("### 1.");
    expect(output).toContain("### 2.");

    // 概念表格
    expect(output).toContain("| 概念 | 定义 | 来源 |");

    // 来源文档
    expect(output).toContain("## 来源文档");
  });

  test("行动建议可选渲染", () => {
    const formatter = new ExtractionFormatter();

    // 无行动建议
    const outputWithout = formatter.format(sampleExtraction, "memo");
    expect(outputWithout).not.toContain("## 学习建议");

    // 有行动建议
    const extractionWithActions = {
      ...sampleExtraction,
      actionItems: ["深入学习 RSC", "尝试 Vercel Edge Functions"],
    };
    const outputWith = formatter.format(extractionWithActions, "memo");
    expect(outputWith).toContain("## 学习建议");
    expect(outputWith).toContain("1. 深入学习 RSC");
    expect(outputWith).toContain("2. 尝试 Vercel Edge Functions");
  });
});
```

#### 5.2.3 Outline 格式测试

```typescript
// __tests__/extraction-formatter/outline-format.test.ts

describe("ExtractionFormatter.formatOutline", () => {
  test("层级结构正确", () => {
    const formatter = new ExtractionFormatter();
    const output = formatter.format(sampleExtraction, "outline");

    // 一级标题
    expect(output).toContain("## 一、主题概述");
    expect(output).toContain("## 二、核心要点");
    expect(output).toContain("## 三、关键概念");
    expect(output).toContain("## 四、结论");

    // 二级缩进
    expect(output).toMatch(/\s{2}\d+\./); // 两个空格 + 数字 + 点
    expect(output).toMatch(/\s{2}-\s\*\*/); // 两个空格 + 短横 + 粗体
  });

  test("大纲格式紧凑", () => {
    const formatter = new ExtractionFormatter();
    const summary = formatter.format(sampleExtraction, "summary");
    const outline = formatter.format(sampleExtraction, "outline");

    // Outline 应该比 Summary 更短
    expect(outline.length).toBeLessThan(summary.length);
  });
});
```

---

### 5.3 Skill 集成测试

#### 5.3.1 Skill 定义验证

```typescript
// __tests__/skills/knowledge-extract/definition.test.ts

describe("KNOWLEDGE_EXTRACT_SKILL Definition", () => {
  test("必需字段完整", () => {
    expect(KNOWLEDGE_EXTRACT_SKILL.id).toBe("knowledge_extract");
    expect(KNOWLEDGE_EXTRACT_SKILL.name).toBeTruthy();
    expect(KNOWLEDGE_EXTRACT_SKILL.description).toBeTruthy();
    expect(KNOWLEDGE_EXTRACT_SKILL.icon).toBeTruthy();
    expect(KNOWLEDGE_EXTRACT_SKILL.category).toBe("create");
  });

  test("触发模式有效", () => {
    const triggers = KNOWLEDGE_EXTRACT_SKILL.triggers;
    expect(triggers.length).toBeGreaterThan(0);

    // 验证能匹配预期输入
    const testInputs = [
      "从这些收藏中提取知识",
      "帮我总结一下这几篇文章",
      "知识萃取",
    ];

    testInputs.forEach((input) => {
      const matches = triggers.some((pattern) => pattern.test(input));
      expect(matches).toBe(true);
    });

    // 验证不会误匹配
    const negativeInputs = ["搜索 AI 文章", "删除这个收藏", "创建文件夹"];

    negativeInputs.forEach((input) => {
      const matches = triggers.some((pattern) => pattern.test(input));
      expect(matches).toBe(false);
    });
  });

  test("步骤进度权重合计 100%", () => {
    const totalWeight = KNOWLEDGE_EXTRACT_SKILL.steps.reduce(
      (sum, step) => sum + step.progressWeight,
      0,
    );
    expect(totalWeight).toBe(100);
  });
});
```

#### 5.3.2 Skill 执行器测试

```typescript
// __tests__/skills/knowledge-extract/executor.test.ts

describe("KnowledgeExtractSkillExecutor", () => {
  let executor: KnowledgeExtractSkillExecutor;
  let mockReporter: ProgressReporter;

  beforeEach(() => {
    executor = new KnowledgeExtractSkillExecutor(mockExtractor, mockFormatter);
    mockReporter = createMockProgressReporter();
  });

  test("执行完整 5 步骤流程", async () => {
    const context: SkillExecutionContext = {
      input: {
        bookmarkIds: [1, 2, 3],
        format: "memo",
      },
      userId: "test-user",
      stepData: {},
    };

    const chunks: SkillChunk[] = [];
    for await (const chunk of executor.execute(context, mockReporter)) {
      chunks.push(chunk);
    }

    // 验证进度报告
    const progressChunks = chunks.filter((c) => c.type === "progress");
    expect(progressChunks.length).toBe(5); // 5 个步骤

    // 验证交付物
    const deliverableChunk = chunks.find((c) => c.type === "deliverable");
    expect(deliverableChunk).toBeDefined();
    expect(deliverableChunk?.data.format).toBe("extraction");
    expect(deliverableChunk?.data.content).toBeTruthy();
  });

  test("错误处理 - 无效书签 ID", async () => {
    const context: SkillExecutionContext = {
      input: {
        bookmarkIds: [99999], // 不存在的 ID
        format: "memo",
      },
      userId: "test-user",
      stepData: {},
    };

    const chunks: SkillChunk[] = [];
    for await (const chunk of executor.execute(context, mockReporter)) {
      chunks.push(chunk);
    }

    const errorChunk = chunks.find((c) => c.type === "error");
    expect(errorChunk).toBeDefined();
    expect(errorChunk?.data.message).toContain("书签");
  });
});
```

---

### 5.4 前端集成测试

#### 5.4.1 萃取结果卡片测试

```typescript
// __tests__/components/extraction-result-card.test.tsx

describe('ExtractionResultCard', () => {
  test('渲染萃取结果基本信息', () => {
    render(
      <ExtractionResultCard
        extraction={mockExtraction}
        onSourceClick={jest.fn()}
        onExport={jest.fn()}
        onSave={jest.fn()}
      />
    );

    expect(screen.getByText(mockExtraction.title)).toBeInTheDocument();
    expect(screen.getByText(/基于 \d+ 篇收藏/)).toBeInTheDocument();
    expect(screen.getByText(/\d+ 个要点/)).toBeInTheDocument();
  });

  test('格式切换功能', async () => {
    render(
      <ExtractionResultCard
        extraction={mockExtraction}
        onSourceClick={jest.fn()}
        onExport={jest.fn()}
        onSave={jest.fn()}
      />
    );

    // 默认是 memo 格式
    expect(screen.getByRole('tab', { name: /纪要/ })).toHaveAttribute('data-state', 'active');

    // 切换到 summary
    await userEvent.click(screen.getByRole('tab', { name: /摘要/ }));
    expect(screen.getByRole('tab', { name: /摘要/ })).toHaveAttribute('data-state', 'active');

    // 切换到 outline
    await userEvent.click(screen.getByRole('tab', { name: /大纲/ }));
    expect(screen.getByRole('tab', { name: /大纲/ })).toHaveAttribute('data-state', 'active');
  });

  test('来源点击回调', async () => {
    const onSourceClick = jest.fn();
    render(
      <ExtractionResultCard
        extraction={mockExtraction}
        onSourceClick={onSourceClick}
        onExport={jest.fn()}
        onSave={jest.fn()}
      />
    );

    // 展开来源列表
    await userEvent.click(screen.getByText(/查看来源/));

    // 点击第一个来源
    await userEvent.click(screen.getByText(/\[1\]/));

    expect(onSourceClick).toHaveBeenCalledWith(mockExtraction.sources[0].id);
  });

  test('导出和保存按钮', () => {
    render(
      <ExtractionResultCard
        extraction={mockExtraction}
        onSourceClick={jest.fn()}
        onExport={jest.fn()}
        onSave={jest.fn()}
      />
    );

    expect(screen.getByRole('button', { name: /导出/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /保存/ })).toBeInTheDocument();
  });
});
```

---

## Batch 6: 自我进化验证

### 6.1 纠错学习机制测试

#### 6.1.1 纠正信号检测测试

```typescript
// __tests__/ai-learning/correction-detector.test.ts

describe("CorrectionDetector.detect", () => {
  const detector = new CorrectionDetector();

  const testCases: CorrectionTestCase[] = [
    // 直接否定
    {
      name: '明确的"不对"',
      currentInput: "不对，我是要整理收藏",
      previousOutput: { intent: "query", wasSuccessful: true },
      expectedSignal: "explicit_wrong",
      expectedConfidence: { min: 0.9, max: 1.0 },
    },
    {
      name: '明确的"错了"',
      currentInput: "错了，搞混了",
      previousOutput: { intent: "organize", wasSuccessful: true },
      expectedSignal: "explicit_wrong",
      expectedConfidence: { min: 0.9, max: 1.0 },
    },

    // 纠正句式
    {
      name: '"我要的是...不是..."句式',
      currentInput: "我要的是搜索文章，不是整理",
      previousOutput: { intent: "organize", wasSuccessful: true },
      expectedSignal: "correction_follow",
      expectedConfidence: { min: 0.85, max: 1.0 },
    },
    {
      name: '"应该是"句式',
      currentInput: "应该是导出功能",
      previousOutput: { intent: "query", wasSuccessful: true },
      expectedSignal: "correction_follow",
      expectedConfidence: { min: 0.75, max: 0.9 },
    },

    // 重新表述
    {
      name: "重新说一遍",
      currentInput: "我再说一遍，帮我找上周的文章",
      previousOutput: { intent: "organize", wasSuccessful: false },
      expectedSignal: "reformulation",
      expectedConfidence: { min: 0.7, max: 0.85 },
    },

    // 非纠正
    {
      name: "正常的后续问题",
      currentInput: "还有其他的吗",
      previousOutput: { intent: "query", wasSuccessful: true },
      expectedSignal: null,
    },
  ];

  test.each(testCases)(
    "$name",
    async ({
      currentInput,
      previousOutput,
      expectedSignal,
      expectedConfidence,
    }) => {
      const context = { lastUserInput: "帮我整理收藏" };

      const result = detector.detect(
        currentInput,
        previousOutput as AIOutput,
        context as ConversationState,
      );

      if (expectedSignal === null) {
        expect(result).toBeNull();
      } else {
        expect(result).not.toBeNull();
        expect(result!.signal).toBe(expectedSignal);
        expect(result!.confidence).toBeGreaterThanOrEqual(
          expectedConfidence!.min,
        );
        expect(result!.confidence).toBeLessThanOrEqual(expectedConfidence!.max);
      }
    },
  );
});
```

#### 6.1.2 意图推断测试

```typescript
// __tests__/ai-learning/intent-inference.test.ts

describe("CorrectionDetector.inferCorrectIntent", () => {
  const detector = new CorrectionDetector();

  const inferenceTestCases = [
    // "我是要...，不是..."句式
    {
      name: "明确的搜索意图",
      input: "我是要搜索文章，不是整理",
      wrongIntent: "organize",
      expectedIntent: "query",
    },
    {
      name: "明确的整理意图",
      input: "我想要整理，而不是搜索",
      wrongIntent: "query",
      expectedIntent: "organize",
    },
    {
      name: "明确的导出意图",
      input: "我要的是导出功能",
      wrongIntent: "query",
      expectedIntent: "export",
    },

    // 基于否定推断
    {
      name: "否定搜索推断整理",
      input: "不是搜索",
      wrongIntent: "query",
      expectedIntent: "organize", // 或 create/export
    },
    {
      name: "否定整理推断搜索",
      input: "不是整理",
      wrongIntent: "organize",
      expectedIntent: "query",
    },

    // 无法推断
    {
      name: "模糊纠正无法推断",
      input: "不对",
      wrongIntent: "query",
      expectedIntent: null,
    },
  ];

  test.each(inferenceTestCases)(
    "$name",
    async ({ input, wrongIntent, expectedIntent }) => {
      const result = detector.inferCorrectIntent(
        input,
        wrongIntent as IntentType,
      );

      if (expectedIntent === null) {
        expect(result).toBeNull();
      } else {
        expect(result).toBe(expectedIntent);
      }
    },
  );
});
```

#### 6.1.3 纠正记录存储测试

```typescript
// __tests__/ai-learning/correction-learner.test.ts

describe("CorrectionLearner.recordCorrection", () => {
  let learner: CorrectionLearner;
  let mockDb: jest.Mocked<SupabaseClient>;
  let mockEmbedder: jest.Mocked<EmbeddingService>;

  beforeEach(() => {
    mockDb = createMockSupabaseClient();
    mockEmbedder = createMockEmbedder();
    learner = new CorrectionLearner(mockDb, mockEmbedder);
  });

  test("正确存储纠正记录", async () => {
    await learner.recordCorrection({
      userId: "user-123",
      originalMessage: "帮我整理收藏",
      wrongIntent: "query",
      correctIntent: "organize",
      signal: {
        signal: "explicit_wrong",
        confidence: 0.95,
        originalInput: "帮我整理收藏",
        wrongIntent: "query",
        correctionInput: "不对，是整理",
      },
    });

    // 验证嵌入向量生成
    expect(mockEmbedder.embed).toHaveBeenCalledWith("帮我整理收藏");

    // 验证数据库插入
    expect(mockDb.from).toHaveBeenCalledWith("intent_corrections");
    expect(mockDb.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-123",
        original_input: "帮我整理收藏",
        wrong_intent: "query",
        correct_intent: "organize",
        signal: "explicit_wrong",
        confidence: 0.95,
      }),
    );
  });
});
```

#### 6.1.4 相似纠正查询测试

```typescript
// __tests__/ai-learning/similar-correction.test.ts

describe("CorrectionLearner.findSimilarCorrection", () => {
  test("找到高相似度纠正记录", async () => {
    mockDb.rpc.mockResolvedValue({
      data: [
        {
          id: "corr-1",
          original_input: "帮我整理一下收藏",
          correct_intent: "organize",
          similarity: 0.92,
        },
      ],
      error: null,
    });

    const result = await learner.findSimilarCorrection(
      "帮我整理收藏",
      "user-123",
    );

    expect(result).not.toBeNull();
    expect(result!.correctIntent).toBe("organize");
    expect(result!.similarity).toBeGreaterThan(0.85);
  });

  test("无匹配返回 null", async () => {
    mockDb.rpc.mockResolvedValue({ data: [], error: null });

    const result = await learner.findSimilarCorrection(
      "完全不相关的输入",
      "user-123",
    );

    expect(result).toBeNull();
  });

  test("相似度低于阈值返回 null", async () => {
    mockDb.rpc.mockResolvedValue({
      data: [{ similarity: 0.6 }], // 低于 0.8 阈值
      error: null,
    });

    const result = await learner.findSimilarCorrection("部分相关", "user-123");

    expect(result).toBeNull();
  });
});
```

---

### 6.2 分类器集成测试

#### 6.2.1 增强分类器测试

```typescript
// __tests__/router/intent-classifier-with-learning.test.ts

describe("IntentClassifierWithLearning", () => {
  let classifier: IntentClassifierWithLearning;

  beforeEach(() => {
    classifier = new IntentClassifierWithLearning(
      mockCorrectionLearner,
      mockCorrectionDetector,
      defaultConfig,
    );
  });

  test("检测到纠正时记录并应用", async () => {
    // 设置：之前的输出是 query，用户说"不对"
    const context: ConversationState = {
      lastUserInput: "帮我整理收藏",
      previousOutput: { intent: "query", wasSuccessful: true },
    };

    mockCorrectionDetector.detect.mockReturnValue({
      signal: "explicit_wrong",
      confidence: 0.95,
      originalInput: "帮我整理收藏",
      wrongIntent: "query",
      correctionInput: "不对，是整理",
    });

    mockCorrectionDetector.inferCorrectIntent.mockReturnValue("organize");

    const result = await classifier.classify(
      "不对，是整理",
      "user-123",
      context,
    );

    expect(result.primary.type).toBe("organize");
    expect(result.correctionApplied).toBe(true);
    expect(mockCorrectionLearner.recordCorrection).toHaveBeenCalled();
  });

  test("应用历史学习结果", async () => {
    mockCorrectionLearner.findSimilarCorrection.mockResolvedValue({
      id: "learned-1",
      originalInput: "帮我整理收藏",
      correctIntent: "organize",
      similarity: 0.9,
    });

    const result = await classifier.classify("帮我整理一下收藏", "user-123");

    expect(result.primary.type).toBe("organize");
    expect(result.learningApplied).toBe(true);
    expect(result.learningSource).toBe("learned-1");
    expect(mockCorrectionLearner.recordApplication).toHaveBeenCalledWith(
      "learned-1",
    );
  });

  test("无学习记录时使用默认分类", async () => {
    mockCorrectionLearner.findSimilarCorrection.mockResolvedValue(null);

    const result = await classifier.classify("搜索 AI 文章", "user-123");

    expect(result.learningApplied).toBe(false);
    expect(result.correctionApplied).toBe(false);
    // 验证调用了父类的 classify 方法
  });
});
```

#### 6.2.2 学习应用优先级测试

```typescript
// __tests__/router/learning-priority.test.ts

describe("Learning Application Priority", () => {
  test("当前会话纠正 > 历史学习 > 默认分类", async () => {
    // 场景：存在历史学习记录，但当前会话有新纠正
    mockCorrectionLearner.findSimilarCorrection.mockResolvedValue({
      correctIntent: "export", // 历史学习说是 export
      similarity: 0.9,
    });

    mockCorrectionDetector.detect.mockReturnValue({
      signal: "explicit_wrong",
      confidence: 0.95,
    });
    mockCorrectionDetector.inferCorrectIntent.mockReturnValue("organize"); // 当前纠正说是 organize

    const result = await classifier.classify("...", "user-123", context);

    // 当前会话纠正优先
    expect(result.primary.type).toBe("organize");
    expect(result.correctionApplied).toBe(true);
  });

  test("学习相似度阈值 0.85", async () => {
    // 相似度 0.84 - 不应用
    mockCorrectionLearner.findSimilarCorrection.mockResolvedValue({
      correctIntent: "organize",
      similarity: 0.84,
    });

    const result = await classifier.classify("帮我整理", "user-123");

    expect(result.learningApplied).toBe(false);
  });
});
```

---

### 6.3 前端集成测试

#### 6.3.1 纠错检测提示测试

```typescript
// __tests__/components/correction-detected-toast.test.tsx

describe('CorrectionDetectedToast', () => {
  test('显示纠错确认信息', () => {
    render(
      <CorrectionDetectedToast
        wrongIntent="query"
        correctIntent="organize"
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />
    );

    expect(screen.getByText(/检测到意图纠正/)).toBeInTheDocument();
    expect(screen.getByText(/搜索.*→.*整理/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /确认/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /取消/ })).toBeInTheDocument();
  });

  test('确认后回调', async () => {
    const onConfirm = jest.fn();
    render(
      <CorrectionDetectedToast
        wrongIntent="query"
        correctIntent="organize"
        onConfirm={onConfirm}
        onCancel={jest.fn()}
      />
    );

    await userEvent.click(screen.getByRole('button', { name: /确认/ }));
    expect(onConfirm).toHaveBeenCalled();
  });
});
```

#### 6.3.2 学习确认提示测试

```typescript
// __tests__/components/learning-confirmation.test.tsx

describe('LearningConfirmation', () => {
  test('显示学习成功提示', () => {
    render(<LearningConfirmation />);

    expect(screen.getByText(/已学习/)).toBeInTheDocument();
    expect(screen.getByText(/下次更准确/)).toBeInTheDocument();
  });

  test('自动消失', async () => {
    jest.useFakeTimers();
    const { container } = render(<LearningConfirmation />);

    expect(container.firstChild).toBeInTheDocument();

    jest.advanceTimersByTime(3000);

    await waitForElementToBeRemoved(() => container.firstChild);
    jest.useRealTimers();
  });
});
```

---

## 端到端场景测试

### 场景 1: 知识萃取完整流程

```typescript
// e2e/knowledge-extraction-flow.spec.ts

test("用户从多篇收藏中提取知识", async ({ page }) => {
  // 1. 登录
  await page.goto("/login");
  await page.fill('[name="email"]', "test@example.com");
  await page.fill('[name="password"]', "password");
  await page.click('button[type="submit"]');

  // 2. 选择书签
  await page.goto("/home");
  await page.click('[data-testid="bookmark-1"]');
  await page.click('[data-testid="bookmark-2"]');
  await page.click('[data-testid="bookmark-3"]');

  // 3. 发起萃取请求
  await page.fill('[data-testid="ai-input"]', "从这些文章提取关于 AI 的知识");
  await page.click('[data-testid="ai-send"]');

  // 4. 等待进度完成
  await expect(page.locator('[data-testid="progress-collect"]')).toBeVisible();
  await expect(page.locator('[data-testid="progress-extract"]')).toBeVisible();
  await expect(page.locator('[data-testid="progress-done"]')).toBeVisible();

  // 5. 验证萃取结果
  await expect(
    page.locator('[data-testid="extraction-result-card"]'),
  ).toBeVisible();
  await expect(page.locator('[data-testid="key-points"]')).toContainText("[1]"); // 有引用
  await expect(page.locator('[data-testid="sources-list"]')).toContainText(
    "3 篇",
  );

  // 6. 切换格式
  await page.click('[data-testid="tab-outline"]');
  await expect(page.locator('[data-testid="content"]')).toContainText(
    "## 一、",
  );

  // 7. 导出
  await page.click('[data-testid="export-button"]');
  await expect(page.locator('[data-testid="export-dialog"]')).toBeVisible();
});
```

### 场景 2: 纠错学习流程

```typescript
// e2e/correction-learning-flow.spec.ts

test("用户纠正 AI 意图后 AI 学习", async ({ page }) => {
  // 1. 首次请求被误判
  await page.fill('[data-testid="ai-input"]', "帮我整理一下收藏");
  await page.click('[data-testid="ai-send"]');

  // AI 误解为搜索
  await expect(page.locator('[data-testid="search-results"]')).toBeVisible();

  // 2. 用户纠正
  await page.fill('[data-testid="ai-input"]', "不对，我是要整理，不是搜索");
  await page.click('[data-testid="ai-send"]');

  // 3. 纠正检测提示
  await expect(page.locator('[data-testid="correction-toast"]')).toBeVisible();
  await page.click('[data-testid="confirm-correction"]');

  // 4. 学习确认
  await expect(
    page.locator('[data-testid="learning-confirmation"]'),
  ).toBeVisible();

  // 5. 验证整理结果
  await expect(page.locator('[data-testid="organize-preview"]')).toBeVisible();

  // 6. 下次相同请求
  await page.reload();
  await page.fill('[data-testid="ai-input"]', "帮我整理收藏内容");
  await page.click('[data-testid="ai-send"]');

  // 这次直接是整理（学习生效）
  await expect(page.locator('[data-testid="organize-preview"]')).toBeVisible();
  await expect(
    page.locator('[data-testid="learning-applied-badge"]'),
  ).toBeVisible();
});
```

---

## 性能基准测试

### 5 篇文章萃取性能

```typescript
// benchmark/extraction-performance.test.ts

describe("Extraction Performance Benchmarks", () => {
  test("5 篇文章萃取 < 30 秒", async () => {
    const bookmarkIds = [1, 2, 3, 4, 5];

    const start = performance.now();
    await extractor.extract({
      bookmarkIds,
      format: "memo",
    });
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(30000); // 30 秒
    console.log(`5 篇文章萃取耗时: ${(duration / 1000).toFixed(2)}s`);
  });

  test("10 篇文章萃取 < 60 秒", async () => {
    const bookmarkIds = Array.from({ length: 10 }, (_, i) => i + 1);

    const start = performance.now();
    await extractor.extract({
      bookmarkIds,
      format: "summary",
    });
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(60000); // 60 秒
    console.log(`10 篇文章萃取耗时: ${(duration / 1000).toFixed(2)}s`);
  });
});
```

### 纠正匹配性能

```typescript
// benchmark/correction-matching.test.ts

describe("Correction Matching Performance", () => {
  test("相似纠正查询 < 200ms", async () => {
    // 预置 1000 条纠正记录
    await seedCorrectionRecords(1000);

    const start = performance.now();
    await learner.findSimilarCorrection("帮我整理收藏", "user-123");
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(200); // 200ms
    console.log(`相似纠正查询耗时: ${duration.toFixed(2)}ms`);
  });

  test("纠正检测 < 10ms", async () => {
    const start = performance.now();
    detector.detect("不对，是整理", previousOutput, context);
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(10); // 10ms
  });
});
```

---

## 验证清单汇总

### Batch 5 验证清单

| #     | 验证项           | 类型 | 文件                              | 状态 |
| ----- | ---------------- | ---- | --------------------------------- | ---- |
| 5.1.1 | 主题识别测试     | 单元 | `topic-identification.test.ts`    | ⬜   |
| 5.1.2 | 要点提取测试     | 单元 | `key-point-extraction.test.ts`    | ⬜   |
| 5.1.3 | 概念提取测试     | 单元 | `concept-extraction.test.ts`      | ⬜   |
| 5.1.4 | 引用格式测试     | 单元 | `citation-format.test.ts`         | ⬜   |
| 5.2.1 | Summary 格式测试 | 单元 | `summary-format.test.ts`          | ⬜   |
| 5.2.2 | Memo 格式测试    | 单元 | `memo-format.test.ts`             | ⬜   |
| 5.2.3 | Outline 格式测试 | 单元 | `outline-format.test.ts`          | ⬜   |
| 5.3.1 | Skill 定义验证   | 单元 | `definition.test.ts`              | ⬜   |
| 5.3.2 | Skill 执行器测试 | 集成 | `executor.test.ts`                | ⬜   |
| 5.4.1 | 萃取结果卡片测试 | 组件 | `extraction-result-card.test.tsx` | ⬜   |

### Batch 6 验证清单

| #     | 验证项           | 类型 | 文件                                      | 状态 |
| ----- | ---------------- | ---- | ----------------------------------------- | ---- |
| 6.1.1 | 纠正信号检测测试 | 单元 | `correction-detector.test.ts`             | ⬜   |
| 6.1.2 | 意图推断测试     | 单元 | `intent-inference.test.ts`                | ⬜   |
| 6.1.3 | 纠正记录存储测试 | 单元 | `correction-learner.test.ts`              | ⬜   |
| 6.1.4 | 相似纠正查询测试 | 单元 | `similar-correction.test.ts`              | ⬜   |
| 6.2.1 | 增强分类器测试   | 集成 | `intent-classifier-with-learning.test.ts` | ⬜   |
| 6.2.2 | 学习优先级测试   | 集成 | `learning-priority.test.ts`               | ⬜   |
| 6.3.1 | 纠错提示测试     | 组件 | `correction-detected-toast.test.tsx`      | ⬜   |
| 6.3.2 | 学习确认测试     | 组件 | `learning-confirmation.test.tsx`          | ⬜   |

### E2E 验证清单

| #     | 场景             | 文件                                | 状态 |
| ----- | ---------------- | ----------------------------------- | ---- |
| E2E-1 | 知识萃取完整流程 | `knowledge-extraction-flow.spec.ts` | ⬜   |
| E2E-2 | 纠错学习流程     | `correction-learning-flow.spec.ts`  | ⬜   |

### 性能基准清单

| #      | 基准          | 目标    | 状态 |
| ------ | ------------- | ------- | ---- |
| PERF-1 | 5 篇文章萃取  | < 30 秒 | ⬜   |
| PERF-2 | 10 篇文章萃取 | < 60 秒 | ⬜   |
| PERF-3 | 相似纠正查询  | < 200ms | ⬜   |
| PERF-4 | 纠正检测      | < 10ms  | ⬜   |

---

## 参考资料

1. [Jest 官方文档](https://jestjs.io/)
2. [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
3. [Playwright E2E 测试](https://playwright.dev/)
4. [pgvector 性能优化](https://github.com/pgvector/pgvector#performance)
