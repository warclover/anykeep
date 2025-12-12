# 内容类型自适应摘要系统（方案3）详细设计

## 📋 概要

**目标**：根据不同类型的内容，采用最适合该类型的摘要策略，提高 AI 摘要的质量和针对性。

**核心理念**：不同内容类型有不同的结构和价值点，需要差异化的摘要方式。

---

## 🔬 行业调研总结

### 1. 同类产品的做法

| 产品                | 内容类型处理                        | 核心方法                                                          |
| ------------------- | ----------------------------------- | ----------------------------------------------------------------- |
| **Readwise Reader** | 支持 Web/PDF/YouTube/Tweet 等多类型 | Ghostreader 可定制 Prompt，支持 TL;DR / Haiku 等多种摘要风格      |
| **Feedly Leo**      | 新闻为主，支持技术文章              | AI Summary（单文章）vs AI Overview（多文章综合），可训练偏好      |
| **Mozilla AI**      | 研究表明模型需匹配内容类型          | 发现专门针对新闻训练的模型在新闻上表现更好（CNN/DailyMail数据集） |
| **Notion AI**       | 通用场景                            | 支持"Summary"/"Key points"/"Table" 等多种输出格式                 |
| **Cubox**           | 文章收藏                            | 两步法：先提取关键内容，再 AI 生成摘要                            |

**来源**：

- [Readwise Reader Review](https://tutorialswithai.com/tools/readwise-reader/)
- [Feedly AI and Summarization](https://feedly.com/new-features/posts/feedly-ai-and-summarization)
- [Mozilla AI Guide on Summarization](https://blog.mozilla.ai/on-model-selection-for-text-summarization/)

### 2. 学术研究结论

| 内容类型     | 特征                       | 最佳摘要策略                        |
| ------------ | -------------------------- | ----------------------------------- |
| **新闻文章** | 短（~700词），倒金字塔结构 | 首段优先，100词左右摘要             |
| **学术论文** | 长（3000+词），IMRaD 结构  | 分节摘要，200-400词，保留方法和结论 |
| **教程内容** | 步骤导向，代码/示例多      | 提取步骤列表，保留必要前置条件      |
| **视频内容** | 时间轴结构，口语化         | 多模态（字幕+关键帧），时间戳标记   |
| **工具介绍** | 功能点散布，有对比         | 功能列表 + 使用场景 + 优劣势        |

**来源**：

- [Automatic Text Summarization Methods: A Comprehensive Review](https://arxiv.org/pdf/2204.01849)
- [Domain-Specific Text Summarization](https://www.sciencedirect.com/science/article/abs/pii/S030645730700074X)
- [Prompt Engineering Guide - Summarization](https://www.promptingguide.ai/prompts/text-summarization)

### 3. Prompt 工程最佳实践

1. **角色设定（Role Prompting）**：让 LLM 扮演特定领域专家
2. **结构化模板**：不同类型使用不同输出结构
3. **少样本学习（Few-shot）**：提供该类型的优秀摘要示例
4. **长度和格式控制**：根据类型调整摘要长度和格式

**来源**：

- [Microsoft ISE - LLM Prompt Engineering for Summarization](https://devblogs.microsoft.com/ise/gpt-summary-prompt-engineering/)
- [PromptLayer Guide to Summarization](https://blog.promptlayer.com/prompt-engineering-guide-to-summarization/)

---

## 🏗️ 系统架构设计

### 总体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        输入层                                    │
│  title + description + content + url + html                     │
└────────────────────────────┬────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    内容类型检测器                                 │
│  ContentTypeDetector.detect(input) → ContentType                │
│  - 基于 URL 域名                                                 │
│  - 基于标题/描述关键词                                            │
│  - 基于 HTML 结构特征                                             │
│  - 基于内容长度和格式                                             │
└────────────────────────────┬────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                   摘要策略选择器                                  │
│  SummaryStrategySelector.select(contentType) → Strategy         │
└────────────────────────────┬────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                   类型专用 Prompt 构建器                          │
│  TypeSpecificPromptBuilder.build(strategy, content)             │
│  - 类型专用系统提示                                               │
│  - 类型专用输出结构                                               │
│  - 类型专用少样本示例                                             │
└────────────────────────────┬────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    DeepSeek API 调用                             │
│  temperature / max_tokens 根据类型调整                           │
└────────────────────────────┬────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                   类型专用响应解析器                              │
│  TypeSpecificResponseParser.parse(response, contentType)        │
│  - 验证输出结构                                                   │
│  - 完整性检测                                                     │
│  - 质量评分                                                       │
└────────────────────────────┬────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                        输出层                                    │
│  { summary, tags, structure, quality_score }                    │
└─────────────────────────────────────────────────────────────────┘
```

### 内容类型分类

```typescript
enum ContentType {
  // 主要类型（P0）
  ARTICLE = "article", // 通用文章（新闻、博客、观点）
  TUTORIAL = "tutorial", // 教程/指南（步骤导向）
  VIDEO = "video", // 视频内容（B站、YouTube）
  TOOL = "tool", // 工具/产品介绍

  // 扩展类型（P1）
  ACADEMIC = "academic", // 学术论文/研究报告
  NEWS = "news", // 新闻资讯
  DISCUSSION = "discussion", // 讨论帖子（知乎、Reddit）
  DOCUMENTATION = "documentation", // 技术文档

  // 特殊类型（P2）
  RECIPE = "recipe", // 菜谱/食谱
  REVIEW = "review", // 评测/评论
  LIST = "list", // 清单类文章（Top 10、推荐列表）
}
```

---

## 📝 各类型摘要策略详解

### 1. 文章类型 (Article) - 默认策略

**特征**：

- 一般 500-3000 词
- 有论点和论据
- 结构较灵活

**摘要策略**：

- 长度：150-300 字
- 结构：核心观点 → 关键论据 → 价值/启示
- 温度：0.7（允许适度改写）

**Prompt 模板**：

```
你是一个专业的内容编辑，擅长提炼文章核心观点。

【摘要要求】
1. 核心观点（1句话）：作者的主要论点或结论
2. 关键论据（2-4点）：支撑观点的关键事实或数据
3. 价值启示（可选）：对读者的意义或行动建议

【输出示例】
本文提出了 XXX 的观点。作者通过 YYY 论证了这一点：第一，...; 第二，...; 第三，...。对于读者而言，ZZZ。
```

### 2. 教程类型 (Tutorial)

**特征**：

- 步骤导向
- 包含代码/命令/配置
- 有前置条件和最终目标

**摘要策略**：

- 长度：200-400 字
- 结构：目标 → 前置条件 → 核心步骤（编号列表） → 预期结果
- 温度：0.3（保持精确）
- 特殊：保留关键代码片段或命令

**Prompt 模板**：

```
你是一个技术文档专家，擅长总结技术教程的核心步骤。

【摘要要求】
1. 教程目标（1句话）：本教程最终实现什么
2. 前置条件（列表）：需要的环境、知识、工具
3. 核心步骤（编号列表）：3-5 个关键步骤，每步 1 句话
4. 预期结果：完成后能达到什么效果

【输出格式】
目标：[一句话描述]
前置条件：[工具/环境/知识]
步骤：
1. [步骤1]
2. [步骤2]
3. [步骤3]
结果：[预期效果]

【重要】如果教程包含关键命令或代码，请在相关步骤中保留。
```

### 3. 视频类型 (Video)

**特征**：

- 来自 B站、YouTube 等平台
- 有字幕/转录文本
- 时间轴结构
- 口语化表达

**摘要策略**：

- 长度：150-250 字
- 结构：视频主旨 → 核心内容点（时间轴可选） → 推荐观众
- 温度：0.5（平衡流畅与准确）
- 特殊：如果有时间戳，保留关键时间点

**Prompt 模板**：

```
你是一个视频内容分析师，擅长总结视频的核心信息。

【摘要要求】
1. 视频主旨（1句话）：这个视频讲什么
2. 核心内容（2-4点）：视频中最重要的几个点
3. 推荐观众（可选）：适合什么人观看

【注意】
- 视频内容可能口语化，请用书面语总结
- 如果内容包含时间节点，可以标注"[XX:XX]"
- 忽略开场白、赞助广告等非核心内容
```

### 4. 工具类型 (Tool)

**特征**：

- 产品/工具/服务介绍
- 功能点散布
- 有定价/对比信息

**摘要策略**：

- 长度：150-300 字
- 结构：工具定位 → 核心功能（列表） → 使用场景 → 定价/替代品（如有）
- 温度：0.3（保持客观）

**Prompt 模板**：

```
你是一个产品分析师，擅长评估工具和服务。

【摘要要求】
1. 工具定位（1句话）：这是什么工具，解决什么问题
2. 核心功能（3-5点）：最重要的功能点
3. 适用场景（1-2句）：适合什么人、什么场景使用
4. 附加信息（可选）：定价模式、替代品、注意事项

【输出格式】
[工具名] 是一款 [定位] 的工具。
核心功能：
• [功能1]
• [功能2]
• [功能3]
适合 [使用场景]。[附加信息]
```

### 5. 学术类型 (Academic) - P1 扩展

**特征**：

- 长（3000+ 词）
- IMRaD 结构
- 专业术语多
- 有引用/数据

**摘要策略**：

- 长度：300-500 字
- 结构：研究问题 → 方法 → 关键发现 → 结论/意义
- 温度：0.2（高精确度）
- 特殊：保留关键数据和术语

**Prompt 模板**：

```
你是一个学术研究助手，擅长总结科研论文。

【摘要要求】
1. 研究问题（1句话）：本研究解决什么问题
2. 研究方法（1-2句）：使用什么方法
3. 关键发现（2-4点）：最重要的研究结果，保留关键数据
4. 结论与意义：这项研究说明什么，有什么应用价值

【重要】
- 保留专业术语，不要过度简化
- 如果有关键数据/比例/统计结果，必须保留
- 区分"研究发现"和"作者观点"
```

### 6. 新闻类型 (News) - P1 扩展

**特征**：

- 短（500-1000 词）
- 倒金字塔结构
- 时效性强
- 5W1H

**摘要策略**：

- 长度：80-150 字
- 结构：核心事件（5W1H） → 背景/影响
- 温度：0.3（客观报道）

**Prompt 模板**：

```
你是一个新闻编辑，擅长快速提取新闻要点。

【摘要要求】
用 2-3 句话回答：什么人(Who)、在什么时间(When)、什么地点(Where)、做了什么(What)、为什么(Why)、如何发生的(How)。

如果新闻有后续影响或背景信息，简要补充。

【重要】
- 保持客观，不添加评论
- 优先报道最新/最重要的信息
- 保留关键数字和名称
```

---

## 🔧 技术实现方案

### Phase 1: 增强内容类型检测（P0）

**目标**：提高检测准确率从 ~70% 到 ~90%

**改进点**：

1. **URL 域名规则**

```typescript
const URL_TYPE_RULES: Record<string, ContentType> = {
  // 视频平台
  "bilibili.com": ContentType.VIDEO,
  "youtube.com": ContentType.VIDEO,
  "youtu.be": ContentType.VIDEO,
  "douyin.com": ContentType.VIDEO,

  // 新闻媒体
  "36kr.com": ContentType.NEWS,
  "thepaper.cn": ContentType.NEWS,
  "sina.com.cn": ContentType.NEWS,

  // 技术文档
  "docs.": ContentType.DOCUMENTATION,
  "developer.": ContentType.DOCUMENTATION,
  "readthedocs.io": ContentType.DOCUMENTATION,

  // 论文/学术
  "arxiv.org": ContentType.ACADEMIC,
  "pubmed.": ContentType.ACADEMIC,
  "nature.com": ContentType.ACADEMIC,

  // 讨论社区
  "zhihu.com": ContentType.DISCUSSION,
  "reddit.com": ContentType.DISCUSSION,
  "v2ex.com": ContentType.DISCUSSION,

  // 工具平台
  "producthunt.com": ContentType.TOOL,
  "alternativeto.net": ContentType.TOOL,
};
```

2. **HTML 结构特征检测**

```typescript
interface HTMLFeatures {
  hasCodeBlocks: boolean; // <pre>, <code>
  hasStepsList: boolean; // <ol>, 步骤相关 class
  hasVideoEmbed: boolean; // <video>, iframe[youtube/bilibili]
  hasDataTable: boolean; // <table> with data
  hasRecipeSchema: boolean; // Schema.org/Recipe
  hasArticleSchema: boolean; // Schema.org/Article
  hasProductSchema: boolean; // Schema.org/Product
}
```

3. **内容特征分析**

```typescript
interface ContentFeatures {
  wordCount: number;
  codeRatio: number; // 代码占比
  listItemCount: number; // 列表项数量
  headingStructure: string[]; // 标题结构 [H1, H2, H2, H3...]
  hasTimeMarkers: boolean; // 时间戳 (00:00)
  sentenceStyle: "formal" | "casual" | "technical";
}
```

4. **多信号综合评分**

```typescript
function detectContentType(input: DetectionInput): ContentTypeResult {
  const scores: Record<ContentType, number> = {};

  // URL 信号 (权重: 40%)
  scores[urlType] += 40;

  // 标题关键词 (权重: 25%)
  scores[titleType] += 25;

  // HTML 结构 (权重: 20%)
  scores[htmlType] += 20;

  // 内容特征 (权重: 15%)
  scores[contentType] += 15;

  return {
    type: getMaxScoreType(scores),
    confidence: calculateConfidence(scores),
    signals: collectSignals(),
  };
}
```

### Phase 2: 类型专用 Prompt 系统（P0）

**文件结构**：

```
src/lib/classification/
├── prompts/
│   ├── article-prompt.ts
│   ├── tutorial-prompt.ts
│   ├── video-prompt.ts
│   ├── tool-prompt.ts
│   ├── academic-prompt.ts
│   ├── news-prompt.ts
│   └── index.ts
├── strategies/
│   ├── base-strategy.ts
│   ├── article-strategy.ts
│   ├── tutorial-strategy.ts
│   └── ...
└── content-type-detector.ts
```

**Prompt 模板接口**：

```typescript
interface TypePromptTemplate {
  contentType: ContentType;
  systemPrompt: string;
  userPromptTemplate: string;
  outputSchema: JSONSchema;
  fewShotExamples: FewShotExample[];
  apiParams: {
    temperature: number;
    maxTokens: number;
  };
}
```

### Phase 3: 质量监控与反馈（P1）

**质量评分维度**：

```typescript
interface SummaryQuality {
  completeness: number; // 是否完整结束 (0-100)
  structureMatch: number; // 是否符合类型结构 (0-100)
  lengthRatio: number; // 长度是否合适 (0-100)
  keywordCoverage: number; // 关键词覆盖率 (0-100)
  overall: number; // 综合分数
}
```

**日志增强**：

```typescript
logger.info(
  {
    contentType: detectedType,
    confidence: typeConfidence,
    summaryLength: result.summary.length,
    qualityScore: quality.overall,
    apiLatency: latencyMs,
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
  },
  "AI Summary Generated",
);
```

---

## 📅 实施计划

### Phase 1: 核心功能（预计 2 天）

| 任务 | 描述                                           | 优先级 | 工时 |
| ---- | ---------------------------------------------- | ------ | ---- |
| 1.1  | 增强 `detectContentType()` 函数，添加 URL 规则 | P0     | 2h   |
| 1.2  | 创建 Prompt 模板文件结构                       | P0     | 1h   |
| 1.3  | 实现文章(Article)类型专用 Prompt               | P0     | 1h   |
| 1.4  | 实现教程(Tutorial)类型专用 Prompt              | P0     | 2h   |
| 1.5  | 实现视频(Video)类型专用 Prompt                 | P0     | 1h   |
| 1.6  | 实现工具(Tool)类型专用 Prompt                  | P0     | 1h   |
| 1.7  | 重构 `buildPrompt()` 使用策略模式              | P0     | 3h   |
| 1.8  | 添加类型专用响应解析                           | P0     | 2h   |

### Phase 2: 扩展类型（预计 1 天）

| 任务 | 描述                            | 优先级 | 工时 |
| ---- | ------------------------------- | ------ | ---- |
| 2.1  | 实现学术(Academic)类型 Prompt   | P1     | 2h   |
| 2.2  | 实现新闻(News)类型 Prompt       | P1     | 1h   |
| 2.3  | 实现讨论(Discussion)类型 Prompt | P1     | 1h   |
| 2.4  | 添加 HTML 结构特征检测          | P1     | 2h   |

### Phase 3: 质量保证（预计 1 天）

| 任务 | 描述               | 优先级 | 工时 |
| ---- | ------------------ | ------ | ---- |
| 3.1  | 实现质量评分系统   | P1     | 2h   |
| 3.2  | 添加详细日志和监控 | P1     | 1h   |
| 3.3  | 编写单元测试       | P1     | 2h   |
| 3.4  | 文档更新           | P2     | 1h   |

---

## ✅ 验收标准

### 功能验收

1. **类型检测准确率** ≥ 85%
   - 使用 100 个样本测试
   - 覆盖所有主要类型

2. **摘要质量提升**
   - 用户满意度调查 ≥ 4/5
   - 截断率降低 50%
   - 结构匹配率 ≥ 90%

3. **系统稳定性**
   - API 成功率 ≥ 99%
   - P95 延迟 ≤ 3s
   - 回退机制正常工作

### 技术验收

1. **代码质量**
   - TypeScript 类型完整
   - 单元测试覆盖率 ≥ 80%
   - 符合项目编码规范

2. **可维护性**
   - 新增类型只需添加 Prompt 文件
   - 配置与代码分离
   - 详细的代码注释

---

## 🔄 迭代优化方向

1. **用户反馈学习**：收集用户对摘要的编辑行为，用于优化 Prompt

2. **A/B 测试**：对比不同 Prompt 版本的效果

3. **多模型支持**：为不同类型选择最优模型（如学术用 Claude，新闻用 GPT-4o-mini）

4. **实时调优**：基于质量评分自动调整参数

---

## 📎 附录

### 当前代码位置

- 主文件：`src/lib/utils/ai-generator.ts`
- 类型检测：`detectContentType()` 函数（第 135-186 行）
- 标签要求：`getTagRequirementsByType()` 函数（第 191-230 行）
- Prompt 构建：`buildPrompt()` 函数（第 236-336 行）

### 参考资源

- [Prompt Engineering Guide - Summarization](https://www.promptingguide.ai/prompts/text-summarization)
- [Readwise Reader Ghostreader](https://bearwith.ai/readwise-reader-ai/)
- [Feedly Leo AI](https://feedly.com/new-features/posts/leo-and-summarization)
- [Mozilla AI Model Selection](https://blog.mozilla.ai/on-model-selection-for-text-summarization/)
