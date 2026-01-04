# 智能蓝图系统增强方案 (Blueprints System Enhancement PRD)

> **文档版本**: v1.1
> **创建日期**: 2026-01-04
> **更新日期**: 2026-01-04
> **作者**: John (PM Agent)
> **状态**: ✅ 已批准

---

## 1. 执行摘要 (Executive Summary)

### 1.1 背景

AnyKeep 当前的 Knowledge Studio 已实现 5 种基础蓝图（debater, blogger, thread, tutorial, feynman），但这些蓝图过于通用，无法满足高净值用户群体的**职业化工作流**需求。

### 1.2 核心问题

| 问题            | 影响                                           |
| --------------- | ---------------------------------------------- |
| 蓝图类型单一    | 无法覆盖创作者、商业决策者、技术人员等细分场景 |
| "One-Shot" 生成 | 用户只能被动接受结果，无法参与创作过程         |
| 缺乏个性化      | 所有用户的输出风格雷同，缺乏"专家味"           |
| 输出质量不稳定  | 缺乏结构化约束，AI 容易"跑偏"                  |

### 1.3 解决方案

将 Knowledge Studio 从"内容生成器"升级为**"智能咨询助手"**：

1. **扩展蓝图矩阵** - 新增 14 个高价值职业蓝图
2. **引入 Briefing 机制** - 生成前收集关键上下文（精简版 Alignment）
3. **大纲优先模式** - 用户确认骨架后再填充内容（精简版 Evaluation）
4. **结构化输出** - 强制 AI 返回 Schema 约束的结构化数据

### 1.4 预期收益

- **付费转化率提升** - 高价值蓝图作为 Pro 功能
- **用户留存提升** - 深度融入用户职业工作流
- **口碑传播** - 硬核用户成为产品布道者

---

## 2. 用户画像与蓝图矩阵

### 2.1 目标用户分层

```
┌─────────────────────────────────────────────────────────────┐
│  塔尖 (5%) - 硬核极客                                        │
│  开发者、架构师、PM、AI 博主                                  │
│  特征：系统思维、深度定制、Obsidian/VS Code 用户             │
│  付费意愿：极高（工具即生产力）                               │
├─────────────────────────────────────────────────────────────┤
│  塔中 (25%) - 专业人士                                       │
│  投资人、产品经理、市场分析师、研究员                        │
│  特征：数据驱动、效率优先、决策导向                          │
│  付费意愿：高（时间成本敏感）                                │
├─────────────────────────────────────────────────────────────┤
│  塔底 (70%) - 内容创作者                                     │
│  UP主、播客主、公众号作者、自媒体                            │
│  特征：持续输出压力、素材管理需求                            │
│  付费意愿：中等（看到直接产出价值）                          │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 蓝图矩阵 (14 个新增蓝图)

#### 第一梯队：创作者与媒体人 (The Creators)

| ID  | 名称           | 英文标识         | 目标用户          | 核心价值          |
| --- | -------------- | ---------------- | ----------------- | ----------------- |
| C1  | 视频脚本架构师 | `scriptwriter`   | B站UP主、YouTuber | 素材→分镜脚本     |
| C2  | 周刊主编       | `newsletter`     | Newsletter作者    | 碎片→结构化周刊   |
| C3  | 播客访谈策划   | `interview_prep` | 播客主播、记者    | 嘉宾资料→深度提纲 |

#### 第二梯队：商业与决策者 (The Business Minds)

| ID  | 名称       | 英文标识           | 目标用户       | 核心价值             |
| --- | ---------- | ------------------ | -------------- | -------------------- |
| B1  | 竞品情报官 | `competitor_scout` | PM、创业者     | 竞品资料→SWOT分析    |
| B2  | 投资尽调员 | `due_diligence`    | 投资人、分析师 | 财报/新闻→风险备忘录 |
| B3  | 融资故事家 | `pitch_narrative`  | 创业者         | 碎片想法→BP逐字稿    |

#### 第三梯队：技术与学术 (The Intellectuals)

| ID  | 名称         | 英文标识            | 目标用户         | 核心价值         |
| --- | ------------ | ------------------- | ---------------- | ---------------- |
| T1  | 技术选型顾问 | `tech_decider`      | CTO、架构师      | 技术文章→ADR文档 |
| T2  | 文献综述助理 | `literature_matrix` | 研究生、科研人员 | 论文→综述矩阵    |

#### 第四梯队：营销与教育 (The Amplifiers)

| ID  | 名称        | 英文标识            | 目标用户     | 核心价值          |
| --- | ----------- | ------------------- | ------------ | ----------------- |
| M1  | SEO霸屏专家 | `seo_pillar`        | SEO专员      | 碎片→长青内容大纲 |
| M2  | 课程设计师  | `workshop_designer` | 培训师、讲师 | 资料→工作坊流程表 |

#### 第五梯队：极客与构建者 (The Hardcore Builders) 🔥 **最高优先级**

| ID  | 名称           | 英文标识               | 目标用户           | 核心价值             | 优先级 |
| --- | -------------- | ---------------------- | ------------------ | -------------------- | ------ |
| G1  | 论文实战解码器 | `arxiv_decoder`        | AI博主、算法工程师 | 论文+代码→实战评测   | 🔥 P0  |
| G2  | 技术教程架构师 | `tutorial_architect`   | 科技博主、DevRel   | 文档+问答→MDX教程    | 🔥 P0  |
| G3  | 系统架构评审官 | `system_design_review` | 架构师             | 技术博客→ADR决策文档 | 🔥 P0  |
| G4  | PRD大师        | `prd_master`           | PM、独立开发者     | 反馈/会议→PRD文档    | 🔥 P0  |

---

## 3. 核心功能设计

### 3.1 Briefing 机制（精简版 Alignment）

#### 设计原则

- **快速**：30秒内完成
- **必要**：只问影响输出质量的关键问题
- **智能**：根据蓝图类型动态调整问题

#### Briefing 问题模板

每个蓝图最多 **3 个问题**，分为：

| 类型         | 说明       | 示例                              |
| ------------ | ---------- | --------------------------------- |
| `audience`   | 目标受众   | "这份报告是给谁看的？"            |
| `objective`  | 核心目标   | "你希望读者看完后做什么？"        |
| `tone`       | 语气风格   | "正式学术 / 轻松友好 / 犀利批判"  |
| `constraint` | 特殊约束   | "有没有必须避免的话题？"          |
| `context`    | 补充上下文 | "AI检测到素材缺少X，需要补充吗？" |

#### 数据结构

```typescript
interface BriefingQuestion {
  id: string;
  type: "audience" | "objective" | "tone" | "constraint" | "context";
  question: string; // 问题文本
  questionType: "select" | "multiselect" | "text" | "confirm";
  options?: BriefingOption[]; // 选项（select/multiselect）
  default?: string; // 默认值
  required: boolean; // 是否必填
  dynamicCondition?: string; // 动态显示条件（基于素材分析）
}

interface BriefingOption {
  value: string;
  label: string;
  description?: string; // 选项说明
  promptInjection: string; // 注入到 Prompt 的文本
}

interface BriefingConfig {
  blueprintType: string;
  questions: BriefingQuestion[];
  skipCondition?: string; // 快速模式跳过条件
}
```

#### 示例：竞品情报官 (competitor_scout)

```typescript
const competitorScoutBriefing: BriefingConfig = {
  blueprintType: "competitor_scout",
  questions: [
    {
      id: "analysis_focus",
      type: "objective",
      question: "这份分析的核心目的是？",
      questionType: "select",
      options: [
        {
          value: "find_weakness",
          label: "💀 寻找致命弱点",
          description: "重点挖掘竞品的缺陷和漏洞",
          promptInjection:
            "Focus on identifying critical weaknesses, gaps in features, and user complaints.",
        },
        {
          value: "differentiation",
          label: "🎯 寻找差异化定位",
          description: "找到我们可以占领的独特位置",
          promptInjection:
            "Focus on identifying unserved niches and differentiation opportunities.",
        },
        {
          value: "comprehensive",
          label: "📊 全面客观分析",
          description: "平衡展示优缺点",
          promptInjection:
            "Provide a balanced analysis covering strengths, weaknesses, opportunities, and threats.",
        },
      ],
      required: true,
    },
    {
      id: "audience",
      type: "audience",
      question: "这份报告的主要读者是？",
      questionType: "select",
      options: [
        {
          value: "exec",
          label: "高管/投资人",
          promptInjection:
            "Write for executives: focus on strategic implications and market positioning.",
        },
        {
          value: "pm",
          label: "产品团队",
          promptInjection:
            "Write for product teams: focus on feature comparison and user experience details.",
        },
        {
          value: "sales",
          label: "销售团队",
          promptInjection:
            "Write for sales: focus on competitive talking points and objection handling.",
        },
      ],
      required: true,
    },
    {
      id: "pricing_analysis",
      type: "constraint",
      question: "是否需要定价策略分析？",
      questionType: "confirm",
      default: "true",
      required: false,
    },
  ],
};
```

### 3.2 大纲优先模式（精简版 Evaluation）

#### 两阶段生成流程

```
┌─────────────────────────────────────────────────────────────┐
│  Stage 1: Outline Generation (大纲生成)                     │
│                                                             │
│  用户选择素材 + 蓝图 + 完成 Briefing                         │
│           ↓                                                 │
│  AI 生成结构化大纲（H1/H2/H3 + 每节预计内容摘要）            │
│           ↓                                                 │
│  用户操作：                                                  │
│  - ✅ 确认大纲，开始生成                                     │
│  - 📝 编辑大纲（拖拽排序、删除章节、添加要点）               │
│  - 🔄 重新生成大纲                                          │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  Stage 2: Content Generation (内容生成)                     │
│                                                             │
│  基于确认的大纲，逐节生成内容                                │
│           ↓                                                 │
│  流式输出，实时显示进度                                      │
│           ↓                                                 │
│  完成后可用 Chat-to-Edit 微调                               │
└─────────────────────────────────────────────────────────────┘
```

#### 大纲数据结构

```typescript
interface OutlineNode {
  id: string;
  level: 1 | 2 | 3; // H1/H2/H3
  title: string; // 章节标题
  summary: string; // 预计内容摘要（1-2句）
  estimatedWords: number; // 预计字数
  citations: string[]; // 计划引用的书签ID
  children?: OutlineNode[]; // 子章节
  userEdited?: boolean; // 用户是否编辑过
}

interface OutlineDocument {
  blueprintType: string;
  briefingResponses: Record<string, string>;
  rootNodes: OutlineNode[];
  totalEstimatedWords: number;
  generatedAt: string;
  version: number;
}
```

#### 大纲编辑器 UI 交互

| 操作      | 说明                       |
| --------- | -------------------------- |
| 拖拽排序  | 调整章节顺序               |
| 删除章节  | 点击 × 删除（确认后）      |
| 展开/收起 | 点击标题展开查看预计内容   |
| 编辑标题  | 双击标题进入编辑模式       |
| 添加要点  | 在章节下添加必须包含的要点 |
| 更换引用  | 点击引用标签，选择其他书签 |

### 3.3 结构化输出（Schema 约束）

#### 设计原则

不同蓝图需要不同的输出格式。通过 **JSON Schema** 约束 AI 返回结构化数据，前端再渲染为漂亮的 UI。

#### 蓝图输出 Schema 示例

**竞品情报官输出 Schema**：

```typescript
interface CompetitorScoutOutput {
  executive_summary: string; // 执行摘要（3-5句）
  competitors: {
    name: string;
    positioning: string; // 定位描述
    strengths: string[]; // 优势（3-5条）
    weaknesses: string[]; // 劣势（3-5条）
    pricing: {
      model: string; // 定价模式
      range: string; // 价格区间
      hidden_costs?: string; // 隐性成本
    };
    target_audience: string;
  }[];
  feature_matrix: {
    feature: string;
    [competitorName: string]: string | boolean; // 支持/不支持/部分支持
  }[];
  swot_analysis: {
    strengths: string[];
    weaknesses: string[];
    opportunities: string[];
    threats: string[];
  };
  recommendations: {
    immediate_actions: string[]; // 立即行动
    strategic_moves: string[]; // 战略布局
  };
  citations: Citation[];
}
```

**视频脚本架构师输出 Schema**：

```typescript
interface ScriptwriterOutput {
  title: string;
  hook: {
    // 开头钩子
    text: string;
    duration_seconds: number;
    visual_suggestion: string;
  };
  sections: {
    timestamp: string; // "00:30"
    title: string;
    script: string; // 逐字稿
    visual_notes: string; // 画面建议
    b_roll_suggestions: string[]; // B-roll 素材建议
    engagement_cue?: string; // 互动提示（求关注等）
  }[];
  outro: {
    text: string;
    call_to_action: string;
  };
  metadata: {
    estimated_duration: string; // "8:30"
    difficulty: "easy" | "medium" | "hard";
    equipment_needed: string[];
  };
  citations: Citation[];
}
```

### 3.4 蓝图引擎架构

#### 扩展现有 OrchestrationSkill

```typescript
// src/lib/knowledge-studio/blueprint/enhanced-blueprint.ts

export abstract class EnhancedBlueprintEngine<
  TOutput extends StructuredOutput,
> extends OrchestrationSkill<EnhancedBlueprintInput, TOutput> {
  // 蓝图元数据
  abstract readonly blueprintId: string;
  abstract readonly displayName: string;
  abstract readonly description: string;
  abstract readonly icon: string;
  abstract readonly tier: "free" | "pro" | "enterprise";
  abstract readonly targetUsers: string[];

  // Briefing 配置
  abstract readonly briefingConfig: BriefingConfig;

  // 输出 Schema
  abstract readonly outputSchema: JSONSchema;

  // 生成步骤定义
  protected readonly steps: StepDefinition[] = [
    { id: "briefing", name: "Briefing", weight: 5 },
    { id: "outline", name: "生成大纲", weight: 15 },
    { id: "outline_confirm", name: "等待确认", weight: 0 }, // 用户交互步骤
    { id: "content", name: "生成内容", weight: 60 },
    { id: "structure", name: "结构化处理", weight: 15 },
    { id: "finalize", name: "最终处理", weight: 5 },
  ];

  // 核心生成方法
  async *executeStream(
    context: OrchestrationContext,
  ): AsyncGenerator<OrchestrationEvent> {
    // 1. Briefing 注入
    const briefingContext = this.buildBriefingContext(
      context.input.briefingResponses,
    );

    // 2. 生成大纲
    yield* this.generateOutline(context, briefingContext);

    // 3. 等待用户确认大纲（通过 requestConfirmation）
    const confirmedOutline = yield* this.requestOutlineConfirmation(context);

    // 4. 基于大纲生成内容
    yield* this.generateContent(context, confirmedOutline, briefingContext);

    // 5. 结构化处理
    const structuredOutput = yield* this.structureOutput(context);

    // 6. 最终处理和保存
    yield* this.finalize(context, structuredOutput);
  }

  // 子类实现
  protected abstract generateOutline(
    context: OrchestrationContext,
    briefingContext: string,
  ): AsyncGenerator<OrchestrationEvent>;

  protected abstract generateContent(
    context: OrchestrationContext,
    outline: OutlineDocument,
    briefingContext: string,
  ): AsyncGenerator<OrchestrationEvent>;

  protected abstract structureOutput(
    context: OrchestrationContext,
  ): AsyncGenerator<OrchestrationEvent, TOutput>;
}
```

---

## 4. 技术实现方案

### 4.1 文件结构规划

```
src/lib/knowledge-studio/
├── blueprint/
│   ├── base/
│   │   ├── enhanced-blueprint.ts      # 增强蓝图基类
│   │   ├── briefing-types.ts          # Briefing 类型定义
│   │   ├── outline-types.ts           # 大纲类型定义
│   │   └── output-schemas.ts          # 输出 Schema 集合
│   ├── creators/                      # 创作者蓝图
│   │   ├── scriptwriter.ts
│   │   ├── newsletter.ts
│   │   └── interview-prep.ts
│   ├── business/                      # 商业蓝图
│   │   ├── competitor-scout.ts
│   │   ├── due-diligence.ts
│   │   └── pitch-narrative.ts
│   ├── tech/                          # 技术蓝图
│   │   ├── tech-decider.ts
│   │   └── literature-matrix.ts
│   ├── marketing/                     # 营销蓝图
│   │   ├── seo-pillar.ts
│   │   └── workshop-designer.ts
│   └── geek/                          # 极客蓝图
│       ├── arxiv-decoder.ts
│       ├── tutorial-architect.ts
│       ├── system-design-review.ts
│       └── prd-master.ts
├── briefing/
│   ├── briefing-engine.ts             # Briefing 引擎
│   ├── briefing-configs/              # 各蓝图 Briefing 配置
│   └── briefing-analyzer.ts           # 素材分析（动态问题）
├── outline/
│   ├── outline-generator.ts           # 大纲生成器
│   ├── outline-validator.ts           # 大纲验证器
│   └── outline-renderer.ts            # 大纲渲染（Markdown）
└── output/
    ├── schema-validator.ts            # Schema 验证
    └── output-renderer.ts             # 结构化输出渲染
```

### 4.2 前端组件规划

```
src/components/knowledge-studio/
├── briefing/
│   ├── briefing-dialog.tsx            # Briefing 对话框
│   ├── briefing-question.tsx          # 单个问题组件
│   └── briefing-progress.tsx          # Briefing 进度
├── outline/
│   ├── outline-editor.tsx             # 大纲编辑器（主组件）
│   ├── outline-node.tsx               # 大纲节点
│   ├── outline-actions.tsx            # 操作按钮
│   └── outline-citation-picker.tsx    # 引用选择器
├── output/
│   ├── structured-output-renderer.tsx # 结构化输出渲染器
│   ├── feature-matrix-table.tsx       # 功能对比表格
│   ├── swot-card.tsx                  # SWOT 卡片
│   └── script-timeline.tsx            # 脚本时间线
└── blueprint-selector-v2.tsx          # 蓝图选择器（支持分类）
```

### 4.3 API 端点规划

| 端点                                     | 方法 | 功能                             |
| ---------------------------------------- | ---- | -------------------------------- |
| `/api/knowledge-studio/blueprints`       | GET  | 获取蓝图列表（含 Briefing 配置） |
| `/api/knowledge-studio/briefing/analyze` | POST | 分析素材，返回动态问题           |
| `/api/knowledge-studio/outline/generate` | POST | 生成大纲（SSE）                  |
| `/api/knowledge-studio/outline/confirm`  | POST | 确认大纲                         |
| `/api/knowledge-studio/generate/v2`      | POST | 基于大纲生成内容（SSE）          |

### 4.4 数据库变更

```sql
-- 新增 briefing_responses 字段到 synthesis_reports 表
ALTER TABLE synthesis_reports
ADD COLUMN briefing_responses JSONB DEFAULT '{}';

-- 新增 outline_document 字段
ALTER TABLE synthesis_reports
ADD COLUMN outline_document JSONB DEFAULT NULL;

-- 新增 structured_output 字段（存储结构化数据）
ALTER TABLE synthesis_reports
ADD COLUMN structured_output JSONB DEFAULT NULL;

-- 新增 generation_mode 字段
ALTER TABLE synthesis_reports
ADD COLUMN generation_mode VARCHAR(20) DEFAULT 'standard'
CHECK (generation_mode IN ('standard', 'outline_first', 'quick'));

-- 扩展 blueprint_type 枚举
-- 注意：需要先删除旧约束再添加新值
```

---

## 5. 实施计划

### Phase 1: 基础架构 (Week 1-2)

**目标**：搭建增强蓝图的基础框架

| 任务                                       | 优先级 | 预计工时 |
| ------------------------------------------ | ------ | -------- |
| 定义增强蓝图基类 `EnhancedBlueprintEngine` | P0     | 8h       |
| 实现 Briefing 类型系统和引擎               | P0     | 8h       |
| 实现大纲类型系统和生成器                   | P0     | 8h       |
| 前端 Briefing Dialog 组件                  | P0     | 6h       |
| 数据库迁移                                 | P0     | 2h       |
| 单元测试                                   | P0     | 8h       |

**交付物**：

- EnhancedBlueprintEngine 基类
- Briefing 完整流程
- 大纲生成和确认流程

### Phase 2: 首批蓝图实现 (Week 3-4)

**目标**：实现 4 个高优先级蓝图（极客蓝图优先）

| 蓝图                   | 选择理由                     | 预计工时 |
| ---------------------- | ---------------------------- | -------- |
| `arxiv_decoder`        | 🔥 极客核心需求，AI 博主首选 | 12h      |
| `tutorial_architect`   | 🔥 科技博主、DevRel 刚需     | 12h      |
| `prd_master`           | 🔥 PM/独立开发者核心工具     | 12h      |
| `system_design_review` | 🔥 架构师决策支持            | 10h      |

**交付物**：

- 4 个极客蓝图完整可用
- 对应的 Briefing 配置
- 对应的输出 Schema 和渲染组件

### Phase 3: 大纲编辑器 (Week 5)

**目标**：实现可视化大纲编辑

| 任务                | 优先级 | 预计工时 |
| ------------------- | ------ | -------- |
| 大纲编辑器主组件    | P0     | 12h      |
| 拖拽排序（dnd-kit） | P1     | 6h       |
| 引用选择器          | P1     | 4h       |
| 大纲版本管理        | P2     | 4h       |

**交付物**：

- 完整的大纲编辑器
- 用户可交互确认/修改大纲

### Phase 4: 剩余蓝图 (Week 6-8)

**目标**：完成剩余 10 个蓝图

| 周     | 蓝图                                                                     | 用户群体      |
| ------ | ------------------------------------------------------------------------ | ------------- |
| Week 6 | `competitor_scout`, `scriptwriter`, `tech_decider`                       | 商业 + 创作者 |
| Week 7 | `newsletter`, `due_diligence`, `pitch_narrative`                         | 创作者 + 商业 |
| Week 8 | `interview_prep`, `literature_matrix`, `seo_pillar`, `workshop_designer` | 全覆盖        |

### Phase 5: 优化与打磨 (Week 9-10)

| 任务         | 说明                                 |
| ------------ | ------------------------------------ |
| 性能优化     | 大纲生成 < 5s，内容生成首 token < 3s |
| 配额策略     | 增强蓝图消耗更多配额                 |
| A/B 测试     | Briefing vs 直接生成对比             |
| 用户反馈收集 | 蓝图质量评分机制                     |

---

## 6. 配额与定价策略

### 6.1 蓝图分层

| 层级       | 蓝图               | 用户         |
| ---------- | ------------------ | ------------ |
| Free       | debater (现有)     | 所有用户     |
| Pro        | 所有 14 个新增蓝图 | Pro 订阅用户 |
| Enterprise | 自定义蓝图 + API   | 企业用户     |

### 6.2 配额消耗

| 蓝图类型           | 配额消耗  | 说明                            |
| ------------------ | --------- | ------------------------------- |
| 基础蓝图           | 1 credit  | debater, blogger 等             |
| 增强蓝图（创作者） | 2 credits | scriptwriter, newsletter        |
| 增强蓝图（商业）   | 3 credits | competitor_scout, due_diligence |
| 增强蓝图（极客）   | 3 credits | arxiv_decoder, prd_master       |

### 6.3 Free 用户限制

- 每月 3 次增强蓝图试用
- 仅可使用 `scriptwriter` 和 `competitor_scout` 试用
- 大纲编辑功能不可用（只能确认/重新生成）

---

## 7. 成功指标

### 7.1 核心指标

| 指标            | 目标                 | 衡量方式                 |
| --------------- | -------------------- | ------------------------ |
| 增强蓝图使用率  | 40% 生成来自增强蓝图 | 后台统计                 |
| Briefing 完成率 | > 85%                | 开始 Briefing → 完成生成 |
| 大纲编辑率      | > 30%                | 用户编辑大纲的比例       |
| 生成满意度      | > 4.0/5.0            | 用户评分                 |
| Pro 转化率      | 提升 20%             | 增强蓝图作为 Pro 卖点    |

### 7.2 质量指标

| 指标             | 目标             | 衡量方式          |
| ---------------- | ---------------- | ----------------- |
| 首 Token 延迟    | < 3s             | P95 延迟          |
| 大纲生成时间     | < 5s             | P95 延迟          |
| 完整生成时间     | < 60s（20 书签） | P95 延迟          |
| 结构化输出合规率 | > 98%            | Schema 验证通过率 |

---

## 8. 风险与缓解

| 风险                         | 影响       | 缓解措施                        |
| ---------------------------- | ---------- | ------------------------------- |
| Briefing 流程太长，用户放弃  | 转化率下降 | 提供"快速模式"跳过 Briefing     |
| 大纲编辑增加复杂度           | 用户困惑   | 默认"一键确认"，编辑为可选      |
| 14 个蓝图开发周期长          | 延期交付   | 分批发布，优先高价值蓝图        |
| Token 消耗增加（两阶段生成） | 成本上升   | 大纲使用轻量模型（GPT-4o-mini） |
| 结构化输出失败               | 体验下降   | 降级为纯文本输出 + 重试         |

---

## 9. 决策记录 (已确认)

### 9.1 产品决策

| #   | 问题                     | 决策            | 理由                     |
| --- | ------------------------ | --------------- | ------------------------ |
| 1   | 大纲确认是否必须？       | ✅ **可跳过**   | 高级用户可开启"自动继续" |
| 2   | Briefing 问题数量上限？  | ✅ **3 个**     | 保持极简，降低用户流失   |
| 3   | 是否支持用户自定义蓝图？ | ✅ **Phase 6+** | 作为 Enterprise 功能     |
| 4   | 大纲编辑是否消耗配额？   | ✅ **不消耗**   | 只有内容生成消耗         |

### 9.2 技术决策

| #   | 问题                   | 决策             | 理由               |
| --- | ---------------------- | ---------------- | ------------------ |
| 1   | 大纲生成使用哪个模型？ | ✅ **轻量模型**  | GPT-4o-mini 降成本 |
| 2   | 结构化输出方案？       | ✅ **JSON Mode** | 更灵活             |
| 3   | 大纲编辑器拖拽库？     | ✅ **dnd-kit**   | 更现代、维护活跃   |

### 9.3 优先级决策

| 决策       | 详情                                                                        |
| ---------- | --------------------------------------------------------------------------- |
| 蓝图优先级 | 🔥 **极客蓝图 (G1-G4) 最高优先级**，Week 3-4 首批实现                       |
| 首批蓝图   | `arxiv_decoder`, `tutorial_architect`, `prd_master`, `system_design_review` |

---

## 10. 审批记录

**审批人**: Xiafe
**审批日期**: 2026-01-04
**审批结果**: ✅ 通过

### 审批确认项

- [x] **蓝图矩阵**：14 个蓝图的定义和优先级 - 极客蓝图 (G1-G4) 优先
- [x] **Briefing 机制**：最多 3 个问题
- [x] **大纲优先模式**：可跳过，高级用户可开启自动继续
- [x] **输出 Schema**：结构化输出方向确认
- [x] **实施计划**：10 周时间线确认
- [x] **配额策略**：增强蓝图消耗 2-3 credits 确认
- [x] **决策事项**：全部决策点已确认

---

_文档结束_

> 📋 **PM Note**: PRD v1.1 已获批准。极客蓝图 (arxiv_decoder, tutorial_architect, prd_master, system_design_review) 作为首批实现目标，Briefing 精简为最多 3 个问题。AC-R-E 中的 "Context (风格DNA)" 和 "Reasoning (批判者Agent)" 移至 Phase 6+ 作为高级功能。
