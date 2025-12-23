# AnyKeep AI Skills 架构设计

> 版本：1.0.0
> 日期：2025-12-22
> 状态：待审核

---

## 一、设计理念

### 1.1 核心理念

> **AnyKeep = 知识管理平台 + AI Skills 生态**

```
传统书签工具：工具 → 用户操作 → 结果
AnyKeep：平台 + Skills → Agent 调度 → 自动化 + 用户介入 → 结果
```

### 1.2 战略定位

```
┌─────────────────────────────────────────────────────────────┐
│                    AnyKeep 产品架构                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Layer 3: 用户界面                                          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  对话界面  │  内容管理  │  知识图谱  │  学习中心      │   │
│  └─────────────────────────────────────────────────────┘   │
│                          ▲                                  │
│  Layer 2: AI Agent + Skills                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Agent (调度) ←→ Skills Registry ←→ Skills Pool      │   │
│  └─────────────────────────────────────────────────────┘   │
│                          ▲                                  │
│  Layer 1: 数据平台                                          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  多平台收藏  │  向量索引  │  知识图谱  │  用户数据    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 二、Skill 标准规范

### 2.1 Skill 定义

每个 Skill 必须实现以下标准接口：

```typescript
// src/lib/ai/skills/types.ts

/**
 * Skill 元数据
 */
export interface SkillMetadata {
  /** 唯一标识符 */
  id: string;

  /** 显示名称 */
  name: string;

  /** 详细描述（供 Agent 理解） */
  description: string;

  /** 版本号 */
  version: string;

  /** 所属分类 */
  category: SkillCategory;

  /** 图标 */
  icon: string;

  /** 作者 */
  author: string;

  /** 是否启用 */
  enabled: boolean;

  /** 依赖的其他 Skills */
  dependencies?: string[];

  /** 配置项定义 */
  configSchema?: z.ZodSchema;
}

/**
 * Skill 分类
 */
export type SkillCategory =
  | "understanding" // 理解类：摘要、解读、问答
  | "organizing" // 整理类：分类、标签、文件夹
  | "connecting" // 关联类：知识图谱、关联发现
  | "learning" // 学习类：复习、记忆、笔记
  | "utility"; // 工具类：搜索、导出、统计

/**
 * Skill 执行上下文
 */
export interface SkillContext {
  /** 用户 ID */
  userId: string;

  /** 会话 ID */
  conversationId?: string;

  /** 前置 Skill 的输出 */
  previousOutputs?: Record<string, SkillOutput>;

  /** 用户配置 */
  userConfig?: Record<string, unknown>;

  /** 系统配置 */
  systemConfig: SystemConfig;
}

/**
 * Skill 输出
 */
export interface SkillOutput<T = unknown> {
  /** 是否成功 */
  success: boolean;

  /** 输出数据 */
  data?: T;

  /** 错误信息 */
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };

  /** 元数据 */
  metadata: {
    skillId: string;
    executionTime: number;
    tokensUsed?: number;
    cacheHit?: boolean;
  };

  /** 后续建议（供 Agent 决策） */
  suggestions?: SkillSuggestion[];
}

/**
 * Skill 建议（用于 Agent 决策）
 */
export interface SkillSuggestion {
  /** 建议调用的 Skill */
  skillId: string;

  /** 建议的参数 */
  params?: Record<string, unknown>;

  /** 建议理由 */
  reason: string;

  /** 置信度 0-1 */
  confidence: number;
}

/**
 * Skill 基类
 */
export abstract class BaseSkill<TInput, TOutput> {
  abstract readonly metadata: SkillMetadata;
  abstract readonly inputSchema: z.ZodSchema<TInput>;
  abstract readonly outputSchema: z.ZodSchema<TOutput>;

  /**
   * 执行 Skill
   */
  abstract execute(
    input: TInput,
    context: SkillContext,
  ): Promise<SkillOutput<TOutput>>;

  /**
   * 验证输入
   */
  validateInput(input: unknown): TInput {
    return this.inputSchema.parse(input);
  }

  /**
   * 验证输出
   */
  validateOutput(output: unknown): TOutput {
    return this.outputSchema.parse(output);
  }

  /**
   * 获取 Tool 定义（供 Vercel AI SDK 使用）
   */
  toTool(): Tool {
    return tool({
      description: this.metadata.description,
      parameters: this.inputSchema,
      execute: async (input, context) => {
        const result = await this.execute(input as TInput, context);
        return result;
      },
    });
  }
}
```

### 2.2 Skill 示例实现

#### 智能分类 Skill

```typescript
// src/lib/ai/skills/classify.skill.ts

import { z } from "zod";
import { BaseSkill, SkillMetadata, SkillContext, SkillOutput } from "./types";

/**
 * 输入参数
 */
const ClassifyInputSchema = z.object({
  bookmarkId: z.number().describe("待分类的书签ID"),
  autoApply: z.boolean().default(false).describe("是否自动应用分类结果"),
});

type ClassifyInput = z.infer<typeof ClassifyInputSchema>;

/**
 * 输出结果
 */
const ClassifyOutputSchema = z.object({
  suggestedFolder: z
    .object({
      id: z.number(),
      name: z.string(),
      path: z.string(),
      confidence: z.number(),
    })
    .nullable(),
  suggestedTags: z.array(
    z.object({
      name: z.string(),
      isNew: z.boolean(),
      confidence: z.number(),
    }),
  ),
  reasoning: z.string(),
  applied: z.boolean(),
});

type ClassifyOutput = z.infer<typeof ClassifyOutputSchema>;

/**
 * 智能分类 Skill
 *
 * 功能：
 * - 分析书签内容
 * - 推荐最匹配的文件夹
 * - 生成标签建议
 * - 可选自动应用
 */
export class ClassifySkill extends BaseSkill<ClassifyInput, ClassifyOutput> {
  readonly metadata: SkillMetadata = {
    id: "classify",
    name: "智能分类",
    description: "分析书签内容，推荐合适的文件夹和标签。可以自动应用分类结果。",
    version: "1.0.0",
    category: "organizing",
    icon: "folder-tree",
    author: "AnyKeep",
    enabled: true,
  };

  readonly inputSchema = ClassifyInputSchema;
  readonly outputSchema = ClassifyOutputSchema;

  async execute(
    input: ClassifyInput,
    context: SkillContext,
  ): Promise<SkillOutput<ClassifyOutput>> {
    const startTime = Date.now();

    try {
      // 1. 获取书签内容
      const bookmark = await this.getBookmark(input.bookmarkId, context.userId);
      if (!bookmark) {
        return this.errorOutput("BOOKMARK_NOT_FOUND", "书签不存在", startTime);
      }

      // 2. 获取用户的文件夹结构和标签体系
      const [folders, existingTags] = await Promise.all([
        this.getUserFolders(context.userId),
        this.getUserTags(context.userId),
      ]);

      // 3. AI 分析生成分类建议
      const analysis = await this.analyzeContent(
        bookmark,
        folders,
        existingTags,
      );

      // 4. 如果需要自动应用
      let applied = false;
      if (input.autoApply && analysis.suggestedFolder) {
        await this.applyClassification(
          input.bookmarkId,
          analysis.suggestedFolder.id,
          analysis.suggestedTags.map((t) => t.name),
          context.userId,
        );
        applied = true;
      }

      return {
        success: true,
        data: {
          ...analysis,
          applied,
        },
        metadata: {
          skillId: this.metadata.id,
          executionTime: Date.now() - startTime,
          tokensUsed: analysis.tokensUsed,
        },
        suggestions: this.generateSuggestions(analysis, applied),
      };
    } catch (error) {
      return this.errorOutput(
        "EXECUTION_ERROR",
        error instanceof Error ? error.message : "执行失败",
        startTime,
      );
    }
  }

  private async analyzeContent(
    bookmark: Bookmark,
    folders: Folder[],
    existingTags: string[],
  ): Promise<ClassifyOutput & { tokensUsed: number }> {
    const prompt = this.buildClassifyPrompt(bookmark, folders, existingTags);

    const result = await generateObject({
      model: deepseek("deepseek-chat"),
      schema: z.object({
        folderId: z.number().nullable(),
        folderReason: z.string(),
        tags: z.array(z.string()),
        tagReasons: z.array(z.string()),
      }),
      prompt,
    });

    // 转换为输出格式
    const suggestedFolder = result.object.folderId
      ? this.findFolder(folders, result.object.folderId)
      : null;

    return {
      suggestedFolder: suggestedFolder
        ? {
            id: suggestedFolder.id,
            name: suggestedFolder.name,
            path: this.getFolderPath(folders, suggestedFolder.id),
            confidence: 0.85,
          }
        : null,
      suggestedTags: result.object.tags.map((tag) => ({
        name: tag,
        isNew: !existingTags.includes(tag),
        confidence: 0.8,
      })),
      reasoning: result.object.folderReason,
      applied: false,
      tokensUsed: result.usage?.totalTokens || 0,
    };
  }

  private generateSuggestions(
    analysis: ClassifyOutput,
    applied: boolean,
  ): SkillSuggestion[] {
    const suggestions: SkillSuggestion[] = [];

    // 如果没有自动应用，建议用户确认
    if (!applied && analysis.suggestedFolder) {
      suggestions.push({
        skillId: "classify",
        params: { autoApply: true },
        reason: "用户可以确认后自动应用分类",
        confidence: 0.7,
      });
    }

    // 如果有新标签，建议创建
    const newTags = analysis.suggestedTags.filter((t) => t.isNew);
    if (newTags.length > 0) {
      suggestions.push({
        skillId: "create-tags",
        params: { tags: newTags.map((t) => t.name) },
        reason: `建议创建 ${newTags.length} 个新标签`,
        confidence: 0.6,
      });
    }

    return suggestions;
  }

  private buildClassifyPrompt(
    bookmark: Bookmark,
    folders: Folder[],
    existingTags: string[],
  ): string {
    return `
你是一个智能分类助手。请分析以下内容，推荐最合适的文件夹和标签。

## 内容信息
标题：${bookmark.title}
来源：${bookmark.platform}
摘要：${bookmark.ai_summary || bookmark.content?.slice(0, 500)}

## 现有文件夹结构
${this.formatFolderTree(folders)}

## 现有标签
${existingTags.join(", ") || "暂无标签"}

## 要求
1. 选择最匹配的文件夹（如果没有合适的返回 null）
2. 推荐 2-5 个标签（优先使用现有标签，必要时创建新标签）
3. 解释你的分类理由
`;
  }

  // ... 其他辅助方法
}

// 导出单例
export const classifySkill = new ClassifySkill();
```

#### AI 摘要 Skill

```typescript
// src/lib/ai/skills/summary.skill.ts

import { z } from "zod";
import { BaseSkill, SkillMetadata, SkillContext, SkillOutput } from "./types";

const SummaryInputSchema = z.object({
  bookmarkId: z.number().describe("书签ID"),
  style: z.enum(["brief", "detailed", "bullet", "academic"]).default("brief"),
  maxLength: z.number().min(50).max(1000).default(300),
  language: z.enum(["zh", "en", "auto"]).default("auto"),
  saveToBookmark: z.boolean().default(true),
});

type SummaryInput = z.infer<typeof SummaryInputSchema>;

const SummaryOutputSchema = z.object({
  summary: z.string(),
  keyPoints: z.array(z.string()),
  keywords: z.array(z.string()),
  readingTime: z.number(),
  saved: z.boolean(),
});

type SummaryOutput = z.infer<typeof SummaryOutputSchema>;

export class SummarySkill extends BaseSkill<SummaryInput, SummaryOutput> {
  readonly metadata: SkillMetadata = {
    id: "summary",
    name: "AI 摘要",
    description: "为书签内容生成智能摘要，支持多种风格和语言。",
    version: "1.0.0",
    category: "understanding",
    icon: "file-text",
    author: "AnyKeep",
    enabled: true,
  };

  readonly inputSchema = SummaryInputSchema;
  readonly outputSchema = SummaryOutputSchema;

  async execute(
    input: SummaryInput,
    context: SkillContext,
  ): Promise<SkillOutput<SummaryOutput>> {
    const startTime = Date.now();

    try {
      // 1. 获取书签内容
      const bookmark = await this.getBookmark(input.bookmarkId, context.userId);
      if (!bookmark) {
        return this.errorOutput("BOOKMARK_NOT_FOUND", "书签不存在", startTime);
      }

      // 2. 检查缓存
      const cacheKey = this.getCacheKey(input);
      const cached = await this.getCache(cacheKey);
      if (cached) {
        return {
          success: true,
          data: cached,
          metadata: {
            skillId: this.metadata.id,
            executionTime: Date.now() - startTime,
            cacheHit: true,
          },
        };
      }

      // 3. 生成摘要
      const result = await this.generateSummary(bookmark.content, input);

      // 4. 保存到书签
      let saved = false;
      if (input.saveToBookmark) {
        await this.saveToBookmark(
          input.bookmarkId,
          result.summary,
          context.userId,
        );
        saved = true;
      }

      // 5. 设置缓存
      await this.setCache(cacheKey, { ...result, saved });

      return {
        success: true,
        data: { ...result, saved },
        metadata: {
          skillId: this.metadata.id,
          executionTime: Date.now() - startTime,
          tokensUsed: result.tokensUsed,
        },
        suggestions: [
          {
            skillId: "classify",
            params: { bookmarkId: input.bookmarkId },
            reason: "摘要生成后可以进行智能分类",
            confidence: 0.8,
          },
        ],
      };
    } catch (error) {
      return this.errorOutput(
        "EXECUTION_ERROR",
        error instanceof Error ? error.message : "执行失败",
        startTime,
      );
    }
  }

  private async generateSummary(
    content: string,
    options: SummaryInput,
  ): Promise<SummaryOutput & { tokensUsed: number }> {
    const stylePrompts = {
      brief: "简洁明了，突出核心观点",
      detailed: "详细完整，保留重要细节",
      bullet: "要点列表，条理清晰",
      academic: "学术风格，严谨准确",
    };

    const result = await generateObject({
      model: deepseek("deepseek-chat"),
      schema: z.object({
        summary: z.string(),
        keyPoints: z.array(z.string()),
        keywords: z.array(z.string()),
      }),
      prompt: `
请为以下内容生成摘要。

## 要求
- 风格：${stylePrompts[options.style]}
- 最大长度：${options.maxLength} 字
- 语言：${options.language === "auto" ? "与原文一致" : options.language === "zh" ? "中文" : "英文"}

## 输出
1. summary: 核心摘要
2. keyPoints: 3-5 个关键要点
3. keywords: 3-5 个关键词

## 内容
${content}
`,
    });

    return {
      summary: result.object.summary,
      keyPoints: result.object.keyPoints,
      keywords: result.object.keywords,
      readingTime: Math.ceil(content.length / 500), // 估算阅读时间（分钟）
      saved: false,
      tokensUsed: result.usage?.totalTokens || 0,
    };
  }
}

export const summarySkill = new SummarySkill();
```

---

## 三、Skills 注册与管理

### 3.1 Skills Registry

```typescript
// src/lib/ai/skills/registry.ts

import { BaseSkill, SkillMetadata, SkillCategory } from "./types";

/**
 * Skills 注册表
 *
 * 职责：
 * - 管理所有已注册的 Skills
 * - 提供 Skill 发现和查找
 * - 支持动态启用/禁用
 */
export class SkillsRegistry {
  private skills: Map<string, BaseSkill<unknown, unknown>> = new Map();

  /**
   * 注册 Skill
   */
  register(skill: BaseSkill<unknown, unknown>): void {
    if (this.skills.has(skill.metadata.id)) {
      console.warn(
        `Skill ${skill.metadata.id} already registered, overwriting.`,
      );
    }
    this.skills.set(skill.metadata.id, skill);
  }

  /**
   * 批量注册
   */
  registerAll(skills: BaseSkill<unknown, unknown>[]): void {
    skills.forEach((skill) => this.register(skill));
  }

  /**
   * 获取 Skill
   */
  get(id: string): BaseSkill<unknown, unknown> | undefined {
    return this.skills.get(id);
  }

  /**
   * 获取所有已启用的 Skills
   */
  getEnabled(): BaseSkill<unknown, unknown>[] {
    return Array.from(this.skills.values()).filter(
      (skill) => skill.metadata.enabled,
    );
  }

  /**
   * 按分类获取 Skills
   */
  getByCategory(category: SkillCategory): BaseSkill<unknown, unknown>[] {
    return Array.from(this.skills.values()).filter(
      (skill) => skill.metadata.category === category && skill.metadata.enabled,
    );
  }

  /**
   * 获取所有 Skill 的 Tool 定义
   */
  getTools(): Record<string, Tool> {
    const tools: Record<string, Tool> = {};
    for (const skill of this.getEnabled()) {
      tools[skill.metadata.id] = skill.toTool();
    }
    return tools;
  }

  /**
   * 获取所有 Skill 元数据
   */
  getMetadata(): SkillMetadata[] {
    return Array.from(this.skills.values()).map((skill) => skill.metadata);
  }

  /**
   * 启用/禁用 Skill
   */
  setEnabled(id: string, enabled: boolean): boolean {
    const skill = this.skills.get(id);
    if (skill) {
      skill.metadata.enabled = enabled;
      return true;
    }
    return false;
  }
}

// 创建全局注册表
export const skillsRegistry = new SkillsRegistry();

// 注册内置 Skills
import { classifySkill } from "./classify.skill";
import { summarySkill } from "./summary.skill";
import { searchSkill } from "./search.skill";
import { statsSkill } from "./stats.skill";
import { tagsSkill } from "./tags.skill";
import { folderSkill } from "./folder.skill";
import { connectionSkill } from "./connection.skill";
import { reviewSkill } from "./review.skill";

skillsRegistry.registerAll([
  classifySkill,
  summarySkill,
  searchSkill,
  statsSkill,
  tagsSkill,
  folderSkill,
  connectionSkill,
  reviewSkill,
]);
```

### 3.2 Agent 与 Skills 集成

```typescript
// src/lib/ai/agent/index.ts

import { generateText, streamText } from "ai";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { skillsRegistry } from "../skills/registry";
import { getSystemPrompt } from "../prompts/system";

const deepseek = createDeepSeek({
  apiKey: process.env.DEEPSEEK_API_KEY,
});

/**
 * 知识助手 Agent
 *
 * 职责：
 * - 理解用户意图
 * - 调度合适的 Skills
 * - 编排多步骤执行
 * - 返回统一结果
 */
export class KnowledgeAgent {
  private model = deepseek("deepseek-chat");

  /**
   * 处理用户请求
   */
  async process(
    message: string,
    context: AgentContext,
  ): Promise<AgentResponse> {
    // 获取所有可用的 Skills 作为 Tools
    const tools = skillsRegistry.getTools();

    const result = await generateText({
      model: this.model,
      system: getSystemPrompt(context),
      messages: context.history,
      tools,
      maxSteps: 10, // 最多执行 10 个 Skills
      onStepFinish: (step) => {
        // 记录每一步的执行情况
        this.logStep(step, context);
      },
    });

    return this.formatResponse(result, context);
  }

  /**
   * 流式处理
   */
  async *streamProcess(
    message: string,
    context: AgentContext,
  ): AsyncGenerator<StreamChunk> {
    const tools = skillsRegistry.getTools();

    const result = await streamText({
      model: this.model,
      system: getSystemPrompt(context),
      messages: [...context.history, { role: "user", content: message }],
      tools,
      maxSteps: 10,
    });

    // 流式返回工具调用状态
    for await (const part of result.fullStream) {
      if (part.type === "tool-call") {
        yield {
          type: "skill-start",
          skillId: part.toolName,
          params: part.args,
        };
      } else if (part.type === "tool-result") {
        yield {
          type: "skill-end",
          skillId: part.toolName,
          result: part.result,
        };
      } else if (part.type === "text-delta") {
        yield {
          type: "text",
          content: part.textDelta,
        };
      }
    }
  }
}

export const knowledgeAgent = new KnowledgeAgent();
```

---

## 四、主逻辑与 Skills 映射

### 4.1 主逻辑各环节的 Skills

```
┌─────────────────────────────────────────────────────────────────────┐
│                    主逻辑 → Skills 映射                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  知识收藏                                                           │
│  ├── 内容解析 Skill（提取正文、元数据）                               │
│  ├── AI 摘要 Skill（生成摘要）                                       │
│  └── 自动标签 Skill（初步标签）                                       │
│                                                                     │
│  内容分类                                                           │
│  ├── 智能分类 Skill（推荐文件夹）                                     │
│  ├── 标签管理 Skill（完善标签体系）                                   │
│  └── 文件夹整理 Skill（自动归档）                                     │
│                                                                     │
│  知识图谱                                                           │
│  ├── 关联发现 Skill（找出内容关联）                                   │
│  ├── 概念提取 Skill（提取核心概念）                                   │
│  └── 图谱构建 Skill（生成可视化图谱）                                 │
│                                                                     │
│  复盘学习                                                           │
│  ├── 学习计划 Skill（生成学习路径）                                   │
│  ├── 复习调度 Skill（间隔重复）                                       │
│  ├── 笔记生成 Skill（自动生成笔记）                                   │
│  └── 知识测验 Skill（检验理解程度）                                   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.2 Skills 依赖关系

```
                    ┌───────────────┐
                    │  内容解析      │
                    │  (入口 Skill)  │
                    └───────┬───────┘
                            │
            ┌───────────────┼───────────────┐
            ▼               ▼               ▼
    ┌───────────┐   ┌───────────┐   ┌───────────┐
    │ AI 摘要   │   │ 自动标签   │   │ 智能分类   │
    └─────┬─────┘   └─────┬─────┘   └─────┬─────┘
          │               │               │
          └───────────────┼───────────────┘
                          ▼
                  ┌───────────────┐
                  │  关联发现      │
                  └───────┬───────┘
                          │
            ┌─────────────┼─────────────┐
            ▼             ▼             ▼
    ┌───────────┐ ┌───────────┐ ┌───────────┐
    │ 学习计划   │ │ 复习调度   │ │ 笔记生成   │
    └───────────┘ └───────────┘ └───────────┘
```

---

## 五、商用级别设计

### 5.1 Skill 质量标准

每个 Skill 必须满足：

| 维度         | 要求                | 验收标准       |
| ------------ | ------------------- | -------------- |
| **功能测试** | 单元测试覆盖        | > 80% 覆盖率   |
| **集成测试** | 与 Agent 集成测试   | 10+ 场景用例   |
| **性能测试** | 响应时间            | P95 < 3s       |
| **错误处理** | 优雅降级            | 所有异常有兜底 |
| **日志监控** | 结构化日志          | 可追溯、可分析 |
| **文档**     | API 文档 + 使用示例 | 完整清晰       |

### 5.2 监控与告警

```typescript
// src/lib/ai/skills/monitoring.ts

/**
 * Skill 执行监控
 */
export class SkillMonitor {
  /**
   * 记录执行指标
   */
  async recordExecution(
    skillId: string,
    result: SkillOutput<unknown>,
    context: SkillContext,
  ): Promise<void> {
    const metrics = {
      skill_id: skillId,
      user_id: context.userId,
      success: result.success,
      execution_time: result.metadata.executionTime,
      tokens_used: result.metadata.tokensUsed || 0,
      cache_hit: result.metadata.cacheHit || false,
      error_code: result.error?.code,
      timestamp: new Date().toISOString(),
    };

    // 写入监控表
    await supabase.from("ai_skill_metrics").insert(metrics);

    // 检查告警条件
    await this.checkAlerts(skillId, result);
  }

  /**
   * 检查告警
   */
  private async checkAlerts(
    skillId: string,
    result: SkillOutput<unknown>,
  ): Promise<void> {
    // 执行时间过长
    if (result.metadata.executionTime > 5000) {
      await this.sendAlert({
        type: "performance",
        skillId,
        message: `Skill ${skillId} 执行时间过长: ${result.metadata.executionTime}ms`,
      });
    }

    // 连续失败
    if (!result.success) {
      const recentFailures = await this.getRecentFailures(skillId);
      if (recentFailures >= 5) {
        await this.sendAlert({
          type: "reliability",
          skillId,
          message: `Skill ${skillId} 连续失败 ${recentFailures} 次`,
        });
      }
    }
  }
}
```

### 5.3 版本管理

```typescript
// src/lib/ai/skills/versioning.ts

/**
 * Skill 版本管理
 *
 * 支持：
 * - 多版本共存
 * - 灰度发布
 * - 回滚
 */
export class SkillVersionManager {
  /**
   * 获取用户应使用的 Skill 版本
   */
  async getVersion(skillId: string, userId: string): Promise<string> {
    // 检查用户是否在灰度组
    const userGroup = await this.getUserGroup(userId);

    // 获取该组应使用的版本
    const version = await this.getGroupVersion(skillId, userGroup);

    return version || "stable";
  }

  /**
   * 灰度发布
   */
  async grayRelease(
    skillId: string,
    version: string,
    percentage: number,
  ): Promise<void> {
    await supabase.from("ai_skill_gray_release").insert({
      skill_id: skillId,
      version,
      percentage,
      status: "active",
    });
  }

  /**
   * 回滚
   */
  async rollback(skillId: string): Promise<void> {
    await supabase
      .from("ai_skill_gray_release")
      .update({ status: "rolled_back" })
      .eq("skill_id", skillId)
      .eq("status", "active");
  }
}
```

---

## 六、生态化路线图

### 6.1 三阶段规划

```
Phase 1: 内置 Skills（2025 Q1-Q2）
├── 完成 12 个核心 Skills
├── 打磨 Agent 调度能力
└── 建立质量标准

Phase 2: 可配置 Skills（2025 Q3）
├── 用户可配置 Skill 参数
├── 自定义 Prompt 模板
└── Skill 组合（Workflow）

Phase 3: 开放生态（2025 Q4+）
├── 第三方 Skill 开发 SDK
├── Skill 市场
└── 社区贡献机制
```

### 6.2 未来扩展点

| 扩展方向         | 说明                      | 价值     |
| ---------------- | ------------------------- | -------- |
| **第三方 Skill** | 开放开发接口              | 生态扩展 |
| **Skill 市场**   | 用户可购买/订阅高级 Skill | 商业模式 |
| **Workflow**     | 多 Skill 组合为自动化流程 | 效率提升 |
| **私有 Skill**   | 企业可开发内部 Skill      | ToB 场景 |

---

## 七、数据库扩展

### 7.1 Skills 相关表

```sql
-- 20250101000010_add_skills_tables.sql

-- Skill 配置表
CREATE TABLE ai_skill_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  skill_id TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, skill_id)
);

-- Skill 执行记录表
CREATE TABLE ai_skill_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES ai_conversations(id) ON DELETE SET NULL,
  skill_id TEXT NOT NULL,
  input JSONB NOT NULL,
  output JSONB,
  success BOOLEAN NOT NULL,
  error JSONB,
  execution_time INT NOT NULL, -- ms
  tokens_used INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Skill 指标表（时序数据）
CREATE TABLE ai_skill_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  success BOOLEAN NOT NULL,
  execution_time INT NOT NULL,
  tokens_used INT DEFAULT 0,
  cache_hit BOOLEAN DEFAULT false,
  error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_skill_configs_user ON ai_skill_configs(user_id);
CREATE INDEX idx_skill_executions_user ON ai_skill_executions(user_id, created_at DESC);
CREATE INDEX idx_skill_metrics_skill ON ai_skill_metrics(skill_id, created_at DESC);
CREATE INDEX idx_skill_metrics_time ON ai_skill_metrics(created_at DESC);

-- RLS
ALTER TABLE ai_skill_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_skill_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own skill configs"
  ON ai_skill_configs FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users view own skill executions"
  ON ai_skill_executions FOR SELECT
  USING (auth.uid() = user_id);
```

---

## 八、总结

### 8.1 核心设计原则

1. **Skill 是能力原子**：每个 Skill 做一件事，做好一件事
2. **Agent 是调度中心**：理解意图，编排 Skills，返回结果
3. **平台是基础设施**：提供数据、权限、监控支撑
4. **生态是终极目标**：从工具到平台到生态

### 8.2 与原方案的关系

| 原方案概念 | Skills 架构映射          |
| ---------- | ------------------------ |
| 阅读助手   | Understanding 类 Skills  |
| 整理专家   | Organizing 类 Skills     |
| 学习伙伴   | Learning 类 Skills       |
| Agent      | KnowledgeAgent（调度层） |
| Tools      | Skills（能力层）         |

### 8.3 关键成功因素

1. **Skill 质量**：每个 Skill 都达到商用级别
2. **Agent 智能**：准确理解意图，合理调度 Skills
3. **用户体验**：流畅、可预测、有价值
4. **持续迭代**：每个 Skill 可独立优化升级

---

_文档版本: 1.0.0_
_更新日期: 2025-12-22_
_状态: 待审核_
