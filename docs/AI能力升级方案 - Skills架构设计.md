# AnyKeep AI 能力升级方案 - Skills 架构设计

> **版本**: 1.0.0 (待审核)
> **日期**: 2025-12-23
> **作者**: 首席架构师
> **状态**: 🟡 待审核

---

## 目录

1. [现状分析](#1-现状分析)
2. [升级愿景](#2-升级愿景)
3. [Skills 架构设计](#3-skills-架构设计)
4. [核心 Skills 规划](#4-核心-skills-规划)
5. [技术实现路径](#5-技术实现路径)
6. [用户体验设计](#6-用户体验设计)
7. [实施路线图](#7-实施路线图)

---

## 1. 现状分析

### 1.1 当前 AI 能力

| 能力层     | 现状                               | 问题        |
| ---------- | ---------------------------------- | ----------- |
| **工具层** | 40+ Tools（查询/操作/文件夹/导出） | ✅ 功能完整 |
| **分类层** | 智能分类 v4.2（Embedding + 聚类）  | ✅ 技术先进 |
| **交互层** | AI 助手面板 + 确认对话框           | ⚠️ 偏命令式 |
| **理解层** | 基础意图识别                       | ❌ 能力不足 |
| **主动层** | 无                                 | ❌ 完全缺失 |

### 1.2 核心问题

```
┌─────────────────────────────────────────────────────────────┐
│                    当前模式：命令执行器                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   用户 ──────► 明确指令 ──────► AI 执行 ──────► 返回结果      │
│                                                             │
│   "移动书签到前端文件夹"  →  move_bookmark  →  "已移动"      │
│                                                             │
└─────────────────────────────────────────────────────────────┘

问题：
1. 用户必须知道"能做什么"才能发出指令
2. AI 是被动的"工具"，不是主动的"助手"
3. 无法处理模糊需求："帮我整理一下"
4. 无法提供洞察："你的收藏有什么问题"
5. 无法端到端交付："帮我准备面试资料"
```

### 1.3 与竞品差距

| 能力         | 传统书签工具 | 当前 AnyKeep | AI 时代标杆 |
| ------------ | ------------ | ------------ | ----------- |
| 收藏管理     | ✅           | ✅           | ✅          |
| 智能分类     | ❌           | ✅           | ✅          |
| 自然语言交互 | ❌           | ⚠️ 基础      | ✅ 深度     |
| 意图理解     | ❌           | ❌           | ✅          |
| 主动建议     | ❌           | ❌           | ✅          |
| 端到端交付   | ❌           | ❌           | ✅          |
| 情境感知     | ❌           | ❌           | ✅          |

---

## 2. 升级愿景

### 2.1 目标定位

```
┌─────────────────────────────────────────────────────────────┐
│                    目标模式：AI 知识伙伴                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   用户 ──────► 模糊意图 ──────► AI 理解+规划+执行 ──────► 交付成果  │
│                                                             │
│   "准备前端面试"  →  理解意图 → 筛选资料 → 生成摘要 → 导出文档  │
│                                                             │
│   特点：                                                     │
│   • 理解模糊需求，主动澄清                                    │
│   • 自动编排多步骤任务                                        │
│   • 提供可交付的最终成果                                      │
│   • 主动发现问题并建议优化                                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 核心转变

| 维度         | 从 (Tools 模式) | 到 (Skills 模式) |
| ------------ | --------------- | ---------------- |
| **交互方式** | 命令式指令      | 自然对话         |
| **任务粒度** | 单步操作        | 端到端任务       |
| **AI 角色**  | 执行者          | 协作伙伴         |
| **价值交付** | 操作完成        | 成果交付         |
| **智能程度** | 被动响应        | 主动洞察         |

### 2.3 用户感知目标

> **"这不是一个带 AI 功能的书签工具，而是一个理解我需求的 AI 助手，书签只是它帮我管理知识的方式之一。"**

---

## 3. Skills 架构设计

### 3.1 分层架构

```
┌─────────────────────────────────────────────────────────────┐
│                     用户交互层 (UI)                          │
│         自然语言输入 / 快捷操作 / 上下文感知                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   意图理解层 (Intent)                        │
│         意图分类 / 实体提取 / 上下文补全 / 歧义消解            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Skills 编排层 (Orchestration)              │
│         任务规划 / Skills 选择 / 执行调度 / 结果聚合          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Skills 执行层 (Skills)                     │
│    ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│    │ 整理助手  │  │ 研究助手  │  │ 学习助手  │  │ 洞察分析  │  │
│    └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Tools 原子层 (Tools)                       │
│         40+ 原子操作（查询/读取/搜索/操作/导出）               │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   数据层 (Data)                              │
│         Supabase / pgvector / Embeddings                    │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Skills vs Tools 对比

| 特性       | Tools (原子操作) | Skills (高级能力) |
| ---------- | ---------------- | ----------------- |
| **粒度**   | 单一操作         | 多步骤任务        |
| **输入**   | 结构化参数       | 自然语言意图      |
| **输出**   | 操作结果         | 可交付成果        |
| **上下文** | 无状态           | 有状态 + 记忆     |
| **编排**   | 无               | 自动规划执行      |
| **交互**   | 一次调用         | 可多轮澄清        |

### 3.3 Skill 定义结构

```typescript
interface Skill {
  // 基础信息
  id: string;
  name: string;
  description: string;

  // 意图匹配
  intents: string[]; // 触发意图列表
  examples: string[]; // 示例用户输入

  // 能力声明
  capabilities: string[]; // 能解决的问题类型
  requiredTools: string[]; // 依赖的 Tools

  // 执行配置
  maxSteps: number; // 最大步骤数
  requiresConfirmation: boolean;

  // 输出定义
  outputFormats: OutputFormat[]; // 支持的输出格式

  // 执行函数
  execute: (context: SkillContext) => Promise<SkillResult>;
}

interface SkillContext {
  userId: string;
  intent: ParsedIntent;
  conversationHistory: Message[];
  userPreferences: UserPreferences;
  currentState: AppState;
}

interface SkillResult {
  success: boolean;
  deliverable?: Deliverable; // 可交付成果
  summary: string; // 执行摘要
  nextSuggestions?: string[]; // 后续建议
}
```

---

## 4. 核心 Skills 规划

### 4.1 Skills 全景图

```
┌─────────────────────────────────────────────────────────────┐
│                      AnyKeep Skills                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  整理类      │  │  研究类      │  │  学习类      │         │
│  ├─────────────┤  ├─────────────┤  ├─────────────┤         │
│  │ • 智能整理   │  │ • 主题研究   │  │ • 面试准备   │         │
│  │ • 收藏清理   │  │ • 竞品分析   │  │ • 知识梳理   │         │
│  │ • 文件夹优化 │  │ • 趋势追踪   │  │ • 学习路径   │         │
│  │ • 重复检测   │  │ • 信息聚合   │  │ • 复习计划   │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  洞察类      │  │  创作类      │  │  协作类      │         │
│  ├─────────────┤  ├─────────────┤  ├─────────────┤         │
│  │ • 收藏分析   │  │ • 内容摘要   │  │ • 知识分享   │         │
│  │ • 兴趣画像   │  │ • 报告生成   │  │ • 资源推荐   │         │
│  │ • 阅读统计   │  │ • 笔记整理   │  │ • 团队同步   │         │
│  │ • 价值评估   │  │ • 文档导出   │  │ • 协作空间   │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Phase 1: MVP Skills (6 个)

#### Skill 1: 智能整理助手 `smart_organize`

```yaml
名称: 智能整理助手
触发意图:
  - "帮我整理一下收藏"
  - "收藏太乱了"
  - "清理下我的书签"

能力:
  - 分析收藏现状（分布、重复、过期）
  - 提出整理建议
  - 执行批量整理
  - 汇报整理成果

执行流程: 1. 分析 → 调用 get_stats, list_folders, count_bookmarks
  2. 诊断 → 识别问题（重复、未分类、过期链接）
  3. 建议 → 生成整理方案
  4. 确认 → 用户审核方案
  5. 执行 → 批量操作（移动、删除、合并）
  6. 报告 → 整理成果摘要

交付物:
  - 整理报告（Markdown）
  - 操作日志
  - 后续建议
```

#### Skill 2: 主题研究助手 `topic_research`

```yaml
名称: 主题研究助手
触发意图:
  - "帮我整理关于 React 的资料"
  - "我想研究下 AI Agent"
  - "把前端相关的都找出来"

能力:
  - 语义搜索相关内容
  - 内容聚类和去重
  - 生成主题摘要
  - 导出研究资料

执行流程: 1. 理解 → 解析研究主题和范围
  2. 搜索 → semantic_search + list_by_tags
  3. 分析 → 对结果聚类、评估相关性
  4. 整理 → 按子主题组织
  5. 摘要 → 生成主题概览
  6. 导出 → 输出研究文档

交付物:
  - 主题研究报告
  - 资料清单（含摘要）
  - 知识图谱（关联关系）
```

#### Skill 3: 面试准备助手 `interview_prep`

```yaml
名称: 面试准备助手
触发意图:
  - "我要准备前端面试"
  - "帮我整理 Java 面试资料"
  - "下周有技术面，帮我准备下"

能力:
  - 识别面试方向和技术栈
  - 筛选相关学习资料
  - 生成知识点清单
  - 创建复习计划

执行流程: 1. 澄清 → 确认面试方向、时间、级别
  2. 筛选 → 搜索相关技术收藏
  3. 评估 → 按重要性和难度分级
  4. 组织 → 生成知识点结构
  5. 计划 → 制定复习时间表
  6. 导出 → 面试资料包

交付物:
  - 知识点清单（分级）
  - 核心资料列表
  - 复习计划表
  - Obsidian/Markdown 导出
```

#### Skill 4: 收藏洞察分析 `collection_insights`

```yaml
名称: 收藏洞察分析
触发意图:
  - "分析下我的收藏习惯"
  - "我都收藏了什么"
  - "给我一个收藏报告"

能力:
  - 统计收藏分布
  - 分析兴趣变化趋势
  - 评估收藏价值
  - 发现潜在问题

执行流程: 1. 统计 → 数量、分布、时间线
  2. 分析 → 主题聚类、兴趣画像
  3. 评估 → 阅读率、价值评分
  4. 洞察 → 发现模式和问题
  5. 建议 → 个性化优化建议
  6. 报告 → 可视化报告

交付物:
  - 收藏分析报告
  - 兴趣画像
  - 优化建议清单
```

#### Skill 5: 内容摘要生成 `content_digest`

```yaml
名称: 内容摘要生成
触发意图:
  - "把这个文件夹的内容总结一下"
  - "生成本周收藏摘要"
  - "帮我写个阅读笔记"

能力:
  - 批量阅读内容
  - 提取关键信息
  - 生成结构化摘要
  - 多格式输出

执行流程: 1. 范围 → 确定摘要范围（文件夹/时间/标签）
  2. 读取 → 获取书签内容和元数据
  3. 分析 → 提取核心观点
  4. 组织 → 按主题/时间结构化
  5. 生成 → 创建摘要文档
  6. 导出 → 支持多格式

交付物:
  - 内容摘要文档
  - 关键观点列表
  - 引用来源索引
```

#### Skill 6: 文件夹健康检查 `folder_health_check`

```yaml
名称: 文件夹健康检查
触发意图:
  - "检查下我的文件夹"
  - "哪些文件夹需要整理"
  - "文件夹有什么问题"

能力:
  - 检查文件夹结构
  - 识别问题文件夹
  - 建议合并/拆分
  - 执行优化操作

执行流程: 1. 扫描 → 遍历所有文件夹
  2. 评估 → 计算健康指标
  3. 诊断 → 识别问题（过大/过小/相似/空置）
  4. 建议 → 生成优化方案
  5. 执行 → 用户确认后执行
  6. 验证 → 检查优化效果

交付物:
  - 文件夹健康报告
  - 问题清单（含建议）
  - 优化执行日志
```

### 4.3 Phase 2: 扩展 Skills (6 个)

| Skill                 | 描述                                | 优先级 |
| --------------------- | ----------------------------------- | ------ |
| `learning_path`       | 学习路径规划 - 基于收藏生成学习计划 | 🟡 中  |
| `trend_tracking`      | 趋势追踪 - 监控特定主题的新内容     | 🟡 中  |
| `knowledge_graph`     | 知识图谱 - 构建收藏间的关联网络     | 🟡 中  |
| `weekly_digest`       | 周报生成 - 自动生成周度阅读报告     | 🟡 中  |
| `smart_recommend`     | 智能推荐 - 基于兴趣推荐整理建议     | 🟢 低  |
| `collaborative_share` | 协作分享 - 打包分享专题收藏         | 🟢 低  |

---

## 5. 技术实现路径

### 5.1 意图理解层

```typescript
// src/lib/ai-agent/intent/intent-parser.ts

interface ParsedIntent {
  type: IntentType; // skill_trigger | tool_command | question | chitchat
  skillId?: string; // 匹配的 Skill ID
  entities: Entity[]; // 提取的实体（主题、时间、范围等）
  confidence: number; // 置信度
  clarifications?: string[]; // 需要澄清的点
}

enum IntentType {
  SKILL_TRIGGER = "skill_trigger", // 触发 Skill
  TOOL_COMMAND = "tool_command", // 直接执行 Tool
  QUESTION = "question", // 知识问答
  CHITCHAT = "chitchat", // 闲聊
}

class IntentParser {
  async parse(
    userInput: string,
    context: ConversationContext,
  ): Promise<ParsedIntent> {
    // 1. 使用 LLM 进行意图分类
    // 2. 实体提取（时间、主题、范围等）
    // 3. 上下文补全
    // 4. 歧义检测
  }
}
```

### 5.2 Skills 编排层

```typescript
// src/lib/ai-agent/skills/skill-orchestrator.ts

class SkillOrchestrator {
  private skills: Map<string, Skill>;
  private toolRegistry: ToolRegistry;

  async execute(
    intent: ParsedIntent,
    context: SkillContext,
  ): Promise<SkillResult> {
    const skill = this.skills.get(intent.skillId);

    // 1. 验证前置条件
    await this.validatePrerequisites(skill, context);

    // 2. 规划执行步骤
    const plan = await this.planExecution(skill, intent, context);

    // 3. 执行并追踪
    const result = await this.executeWithTracking(plan, context);

    // 4. 聚合结果
    return this.aggregateResults(result);
  }

  private async planExecution(
    skill: Skill,
    intent: ParsedIntent,
    context: SkillContext,
  ) {
    // 使用 LLM 动态规划执行步骤
    // 根据用户意图和上下文调整 Skill 执行计划
  }
}
```

### 5.3 Skill 基类实现

```typescript
// src/lib/ai-agent/skills/base-skill.ts

abstract class BaseSkill implements Skill {
  abstract id: string;
  abstract name: string;
  abstract intents: string[];

  protected toolRegistry: ToolRegistry;
  protected llm: LanguageModel;

  // 执行 Tool 的便捷方法
  protected async executeTool<T>(
    toolName: string,
    params: Record<string, unknown>,
    context: ToolContext,
  ): Promise<ToolResult<T>> {
    return this.toolRegistry.execute(toolName, params, context);
  }

  // 多轮澄清
  protected async clarify(questions: string[]): Promise<ClarificationResult> {
    // 返回澄清问题，等待用户回答
  }

  // 进度报告
  protected async reportProgress(step: string, progress: number): void {
    // 实时更新执行进度
  }

  // 生成交付物
  protected async generateDeliverable(
    type: DeliverableType,
    content: unknown,
  ): Promise<Deliverable> {
    // 根据类型生成可交付成果
  }
}
```

### 5.4 示例 Skill 实现

```typescript
// src/lib/ai-agent/skills/smart-organize.skill.ts

export class SmartOrganizeSkill extends BaseSkill {
  id = "smart_organize";
  name = "智能整理助手";
  intents = ["整理", "清理", "收拾", "规整"];

  async execute(context: SkillContext): Promise<SkillResult> {
    // Step 1: 分析现状
    this.reportProgress("分析收藏现状...", 10);
    const stats = await this.analyzeCurrent(context);

    // Step 2: 识别问题
    this.reportProgress("识别问题...", 30);
    const issues = await this.identifyIssues(stats);

    // Step 3: 生成建议
    this.reportProgress("生成整理建议...", 50);
    const suggestions = await this.generateSuggestions(issues);

    // Step 4: 用户确认
    const confirmed = await this.confirmWithUser(suggestions);
    if (!confirmed) {
      return { success: false, summary: "用户取消整理" };
    }

    // Step 5: 执行整理
    this.reportProgress("执行整理操作...", 70);
    const results = await this.executeOrganization(confirmed.actions, context);

    // Step 6: 生成报告
    this.reportProgress("生成整理报告...", 90);
    const report = await this.generateReport(results);

    return {
      success: true,
      deliverable: report,
      summary: `整理完成：移动 ${results.moved} 项，删除 ${results.deleted} 项，合并 ${results.merged} 个文件夹`,
      nextSuggestions: [
        "查看整理报告",
        "继续优化文件夹结构",
        "设置自动整理规则",
      ],
    };
  }

  private async analyzeCurrent(context: SkillContext) {
    const [stats, folders, unclassified] = await Promise.all([
      this.executeTool("get_stats", {}, context),
      this.executeTool("list_folders", { includeArchived: true }, context),
      this.executeTool("count_bookmarks", { folderId: null }, context),
    ]);
    return { stats, folders, unclassified };
  }

  private async identifyIssues(stats: AnalysisResult) {
    // 使用 LLM 分析问题
    const prompt = `分析以下收藏统计，识别需要整理的问题：
      - 未分类书签: ${stats.unclassified}
      - 文件夹数量: ${stats.folders.length}
      - 空文件夹: ${stats.emptyFolders}
      - 重复书签: ${stats.duplicates}

      返回 JSON 格式的问题列表。`;

    return this.llm.generate(prompt);
  }
}
```

### 5.5 目录结构

```
src/lib/ai-agent/
├── core/                           # 核心逻辑（现有）
├── tools/                          # 原子 Tools（现有，40+）
├── intent/                         # 意图理解层（新增）
│   ├── intent-parser.ts            # 意图解析器
│   ├── entity-extractor.ts         # 实体提取
│   └── context-manager.ts          # 上下文管理
├── skills/                         # Skills 层（新增）
│   ├── types.ts                    # Skill 类型定义
│   ├── base-skill.ts               # Skill 基类
│   ├── skill-registry.ts           # Skill 注册表
│   ├── skill-orchestrator.ts       # Skill 编排器
│   ├── organize/                   # 整理类 Skills
│   │   └── smart-organize.skill.ts
│   ├── research/                   # 研究类 Skills
│   │   └── topic-research.skill.ts
│   ├── learning/                   # 学习类 Skills
│   │   └── interview-prep.skill.ts
│   ├── insights/                   # 洞察类 Skills
│   │   └── collection-insights.skill.ts
│   └── content/                    # 内容类 Skills
│       └── content-digest.skill.ts
└── services/                       # 辅助服务（现有）
```

---

## 6. 用户体验设计

### 6.1 交互模式升级

#### 模式 1: 自然对话式

```
用户: 我下周有个前端面试，帮我准备下

AI: 好的！我来帮你准备前端面试。先确认几个信息：
    1. 面试级别：初级/中级/高级？
    2. 主要方向：React/Vue/综合？
    3. 准备时间：还有几天？

用户: 高级，React 方向，还有 5 天

AI: 明白了。我正在分析你收藏的 React 相关资料...

    📊 找到 47 篇相关收藏，分析完成：

    ✅ 覆盖较好的知识点：
    • React Hooks (12 篇)
    • 状态管理 (8 篇)
    • 性能优化 (6 篇)

    ⚠️ 建议补充的知识点：
    • React 18 新特性
    • 服务端渲染 (SSR)
    • 测试实践

    我为你生成了 5 天复习计划，是否查看？

用户: 好的，导出成 Markdown

AI: 已生成面试准备资料包：
    📄 [React 高级面试准备.md] - 已下载

    包含：
    • 知识点清单（按优先级排序）
    • 5 天复习计划表
    • 核心资料链接（23 篇精选）
    • 高频面试题整理

    祝面试顺利！还需要什么帮助吗？
```

#### 模式 2: 主动洞察式

```
AI: 👋 早上好！我注意到一些可以优化的地方：

    📊 本周收藏分析：
    • 新增 23 篇收藏
    • 15 篇在「待整理」中
    • 发现 3 篇可能重复

    💡 建议：
    1. 「前端」和「React」文件夹内容重叠度 78%，建议合并
    2. 有 5 篇去年的文章可能已过时，要检查一下吗？

    [一键整理] [稍后提醒] [不再提醒]
```

#### 模式 3: 快捷操作式

```
┌─────────────────────────────────────────────────────────────┐
│  AI 助手                                              [···] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ⚡ 快捷 Skills                                             │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐          │
│  │ 📋 整理  │ │ 🔍 研究  │ │ 📊 分析  │ │ 📝 摘要  │          │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘          │
│                                                             │
│  💬 或输入你的需求...                                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 帮我准备下周的技术分享...                             │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 进度可视化

```
┌─────────────────────────────────────────────────────────────┐
│  🎯 智能整理助手                                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ████████████░░░░░░░░  60%                                 │
│                                                             │
│  ✅ 1. 分析收藏现状              完成                        │
│  ✅ 2. 识别问题                  完成                        │
│  ✅ 3. 生成建议                  完成                        │
│  🔄 4. 执行整理操作              进行中... (12/20)           │
│  ⏳ 5. 生成整理报告              等待中                      │
│                                                             │
│  📍 当前：移动「React 性能优化」到「前端/性能」               │
│                                                             │
│  [暂停] [取消]                                              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 6.3 交付物展示

```
┌─────────────────────────────────────────────────────────────┐
│  📦 交付物：前端面试准备资料包                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  📄 文档内容：                                              │
│  ├── 📋 知识点清单.md                                      │
│  ├── 📅 5天复习计划.md                                     │
│  ├── 📚 核心资料索引.md                                    │
│  └── ❓ 高频面试题.md                                      │
│                                                             │
│  📊 统计：                                                  │
│  • 覆盖知识点：32 个                                        │
│  • 精选资料：23 篇                                          │
│  • 预计阅读时间：8 小时                                      │
│                                                             │
│  导出格式：                                                  │
│  [Markdown] [Obsidian] [PDF] [Notion]                       │
│                                                             │
│  [下载] [发送到邮箱] [保存到文件夹]                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. 实施路线图

### 7.1 Phase 1: 基础设施 (2 周)

| 任务           | 说明                           | 交付物                     |
| -------------- | ------------------------------ | -------------------------- |
| 意图理解层     | IntentParser + EntityExtractor | `src/lib/ai-agent/intent/` |
| Skill 基础架构 | BaseSkill + SkillRegistry      | `src/lib/ai-agent/skills/` |
| Skill 编排器   | SkillOrchestrator 基础版       | `skill-orchestrator.ts`    |
| UI 组件升级    | 进度条、交付物展示             | `src/components/ai/`       |

### 7.2 Phase 2: MVP Skills (3 周)

| 周次    | Skills                                   | 说明      |
| ------- | ---------------------------------------- | --------- |
| 第 1 周 | `smart_organize` + `folder_health_check` | 整理类    |
| 第 2 周 | `topic_research` + `content_digest`      | 研究类    |
| 第 3 周 | `interview_prep` + `collection_insights` | 学习+洞察 |

### 7.3 Phase 3: 体验优化 (2 周)

| 任务     | 说明                |
| -------- | ------------------- |
| 主动洞察 | 后台分析 + 推送建议 |
| 快捷入口 | Skill 快捷操作面板  |
| 记忆系统 | 用户偏好学习        |
| 多轮对话 | 上下文保持          |

### 7.4 里程碑

```
Week 1-2: 基础设施
    │
    ▼
Week 3-5: MVP Skills (6 个)
    │
    ▼
Week 6-7: 体验优化
    │
    ▼
Week 8: 发布 & 迭代
```

---

## 8. 预期收益

### 8.1 用户价值

| 指标         | 当前             | 目标            | 提升     |
| ------------ | ---------------- | --------------- | -------- |
| 任务完成效率 | 手动多步操作     | 一句话交付      | 10x      |
| 整理频率     | 被动（用户发起） | 主动（AI 建议） | 5x       |
| 信息利用率   | 收藏后遗忘       | 定期摘要复习    | 3x       |
| 用户满意度   | 工具级           | 助手级          | 显著提升 |

### 8.2 竞争壁垒

1. **意图理解深度** - 不只是关键词匹配，而是真正理解用户需求
2. **端到端交付** - 从意图到可用成果的完整闭环
3. **主动智能** - AI 主动发现问题并提供价值
4. **知识积累** - 用户使用越多，AI 越懂用户

---

## 9. 待审核要点

请审核以下关键决策：

### 9.1 架构决策

- [ ] Skills 分层架构是否合理？
- [ ] 意图理解层的设计是否满足需求？
- [ ] Tool 与 Skill 的边界划分是否清晰？

### 9.2 MVP 范围

- [ ] 6 个 MVP Skills 的选择是否合适？
- [ ] 是否有更高优先级的 Skill？
- [ ] 交付物格式是否满足用户需求？

### 9.3 用户体验

- [ ] 交互模式是否符合预期？
- [ ] 进度可视化是否足够？
- [ ] 主动洞察是否过于打扰？

### 9.4 实施计划

- [ ] 7 周的时间规划是否合理？
- [ ] 资源投入是否可行？
- [ ] 优先级排序是否正确？

---

**请提供您的审核意见，我将根据反馈进行调整。**
