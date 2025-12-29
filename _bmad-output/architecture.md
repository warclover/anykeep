---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
inputDocuments:
  - "_bmad-output/prd.md"
workflowType: "architecture"
lastStep: 8
project_name: "Thematic Synthesizer"
user_name: "Xiafe"
date: "2025-12-29"
feature_name: "主题合成器"
status: "complete"
---

# Architecture Decision Document - Thematic Synthesizer

> **产品愿景**: 将 AnyKeep 从"信息仓库"推向"智慧大脑"，通过对抗性合成 Prompt 策略，帮助重度用户解决"看不过来"和"连不起来"的痛点。

---

## 1. Project Context Analysis

### 1.1 PRD 核心需求提炼

| 维度         | 需求要点                                         |
| ------------ | ------------------------------------------------ |
| **核心价值** | 多源内容综述、观点冲突识别、知识盲区发现         |
| **入口模式** | UI 左键触发、Agent 对话、AI 主动推荐             |
| **深度选择** | 快读 (3-5句) / 标准 (500-800字) / 学术 (1500+字) |
| **输出结构** | 四维：概述、核心共识、观点分歧、知识盲区         |
| **来源类型** | 文件夹、标签、手动选择、AI 推荐                  |

### 1.2 现有架构约束

基于 AnyKeep 现有技术栈：

| 约束类型     | 具体内容                                          |
| ------------ | ------------------------------------------------- |
| **前端框架** | Next.js 14+ App Router (Server Components)        |
| **UI 组件**  | Shadcn UI + Radix UI + Tailwind CSS 4             |
| **后端服务** | Supabase (PostgreSQL + pgvector + Edge Functions) |
| **AI 架构**  | UnifiedEngine + OrchestrationSkill 编排模式       |
| **状态管理** | React Hooks + Context (无 Redux)                  |
| **API 模式** | Next.js API Routes + SSE 流式响应                 |

### 1.3 关键技术挑战

1. **长内容合成**: 多篇文章聚合可能超出 LLM Token 限制
2. **冲突检测准确性**: AI 识别观点分歧的可靠性
3. **流式输出体验**: 四维结构的渐进式呈现
4. **性能优化**: 大量书签的向量检索与相似度计算

---

## 2. Technology Stack Decisions

### 2.1 核心技术选型

| 层级           | 技术选择                 | 决策理由                               |
| -------------- | ------------------------ | -------------------------------------- |
| **LLM 模型**   | DeepSeek (deepseek-chat) | 成本可控，中文能力强，已有集成         |
| **深度推理**   | DeepSeek Reasoner        | 学术模式需要更深入的分析能力           |
| **向量存储**   | pgvector (Supabase)      | 复用现有基础设施，支持相似度搜索       |
| **流式传输**   | Server-Sent Events (SSE) | 单向流式，浏览器原生支持，复用现有实现 |
| **状态持久化** | Supabase PostgreSQL      | 结构化存储 + JSONB 灵活字段            |

### 2.2 模型分层策略

```typescript
// 模型选择逻辑
const MODEL_TIER_MAP = {
  quick: "fast", // deepseek-chat, 快速响应
  standard: "standard", // deepseek-chat, 平衡模式
  academic: "deep", // deepseek-reasoner, 深度分析
} as const;
```

### 2.3 不采用的方案

| 方案               | 不采用理由                         |
| ------------------ | ---------------------------------- |
| **WebSocket**      | 过度设计，SSE 已满足单向流式需求   |
| **独立 Vector DB** | 额外运维成本，pgvector 已满足需求  |
| **Redis 缓存**     | MVP 阶段不需要，数据库已有足够性能 |
| **GraphQL**        | 团队无经验，REST + JSON 更简单     |

---

## 3. Core Architectural Decisions

### Decision 1: 综述报告存储结构

**决策**: 采用结构化字段 + Markdown 双存储模式

**理由**:

- 结构化字段支持快速查询和筛选
- 完整 Markdown 支持富文本展示和导出
- JSONB 字段提供灵活的扩展能力

**数据库表设计**:

```sql
CREATE TABLE synthesis_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 基础信息
  title TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('folder', 'tag', 'selection', 'ai_recommend')),
  source_id UUID,                    -- folder_id 或 tag_id
  source_bookmark_ids UUID[],        -- 手动选择的书签 ID 列表
  depth_mode TEXT NOT NULL DEFAULT 'standard' CHECK (depth_mode IN ('quick', 'standard', 'academic')),

  -- 四维结构化输出
  overview TEXT,                     -- 概述
  consensus JSONB DEFAULT '[]',      -- [{point: string, sources: [{id, title}]}]
  divergence JSONB DEFAULT '[]',     -- [{point_a, sources_a, point_b, sources_b, analysis}]
  blind_spots JSONB DEFAULT '[]',    -- [{topic, suggestion, related_bookmarks}]

  -- 完整输出
  full_markdown TEXT,                -- 完整 Markdown 文本

  -- 向量与搜索
  embedding vector(1536),            -- 综述内容向量

  -- 状态与元数据
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'completed', 'failed')),
  error_message TEXT,
  source_count INTEGER DEFAULT 0,    -- 参与合成的书签数量
  word_count INTEGER DEFAULT 0,      -- 生成字数

  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- 索引
CREATE INDEX idx_synthesis_reports_user_id ON synthesis_reports(user_id);
CREATE INDEX idx_synthesis_reports_status ON synthesis_reports(status);
CREATE INDEX idx_synthesis_reports_source_type ON synthesis_reports(source_type);
CREATE INDEX idx_synthesis_reports_created_at ON synthesis_reports(created_at DESC);

-- RLS 策略
ALTER TABLE synthesis_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own reports" ON synthesis_reports
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own reports" ON synthesis_reports
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reports" ON synthesis_reports
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own reports" ON synthesis_reports
  FOR DELETE USING (auth.uid() = user_id);
```

---

### Decision 2: JSONB 结构定义

**共识点结构 (consensus)**:

```typescript
interface ConsensusPoint {
  point: string; // 共识观点
  confidence: number; // 置信度 0-1
  sources: Array<{
    id: string; // 书签 ID
    title: string; // 书签标题
    quote?: string; // 支持引文
  }>;
}
```

**分歧点结构 (divergence)**:

```typescript
interface DivergencePoint {
  topic: string; // 分歧主题
  point_a: string; // 观点 A
  sources_a: Array<{ id: string; title: string; quote?: string }>;
  point_b: string; // 观点 B
  sources_b: Array<{ id: string; title: string; quote?: string }>;
  analysis: string; // AI 分析（不做价值判断）
}
```

**知识盲区结构 (blind_spots)**:

```typescript
interface BlindSpot {
  topic: string; // 盲区主题
  suggestion: string; // 建议补充方向
  search_keywords: string[]; // 建议搜索关键词
  related_bookmarks?: Array<{ id: string; title: string }>;
}
```

---

### Decision 3: OrchestrationSkill 五步流程

**决策**: 复用现有 OrchestrationSkill 架构，实现五步合成流程

```typescript
// ThematicSynthesisSkill 步骤定义
const SYNTHESIS_STEPS = [
  {
    id: "prepare",
    name: "准备阶段",
    description: "收集源书签、提取内容、预处理",
    weight: 15,
  },
  {
    id: "analyze",
    name: "分析阶段",
    description: "内容聚类、主题提取、关系建立",
    weight: 20,
  },
  {
    id: "synthesize",
    name: "合成阶段",
    description: "生成概述和共识点",
    weight: 30,
  },
  {
    id: "conflict",
    name: "冲突检测",
    description: "识别观点分歧、对抗性分析",
    weight: 20,
  },
  {
    id: "blindspot",
    name: "盲区发现",
    description: "识别知识缺口、生成建议",
    weight: 15,
  },
] as const;
```

**流程图**:

```
┌─────────────────────────────────────────────────────────────────┐
│                    ThematicSynthesisSkill                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐                  │
│  │ prepare  │───▶│ analyze  │───▶│synthesize│                  │
│  │ (15%)    │    │ (20%)    │    │ (30%)    │                  │
│  └──────────┘    └──────────┘    └──────────┘                  │
│                                       │                         │
│                                       ▼                         │
│                  ┌──────────┐    ┌──────────┐                  │
│                  │ blindspot│◀───│ conflict │                  │
│                  │ (15%)    │    │ (20%)    │                  │
│                  └──────────┘    └──────────┘                  │
│                       │                                         │
│                       ▼                                         │
│              ┌────────────────┐                                 │
│              │  SSE Output    │                                 │
│              │  (四维结构)     │                                 │
│              └────────────────┘                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### Decision 4: SSE 流式输出方案

**决策**: 采用分段式 SSE 输出，按四维结构渐进呈现

**SSE 事件类型定义**:

```typescript
type SynthesisSSEEvent =
  | {
      type: "progress";
      data: { step: string; percent: number; message: string };
    }
  | { type: "overview"; data: { content: string; isComplete: boolean } }
  | {
      type: "consensus";
      data: { items: ConsensusPoint[]; isComplete: boolean };
    }
  | {
      type: "divergence";
      data: { items: DivergencePoint[]; isComplete: boolean };
    }
  | { type: "blindspot"; data: { items: BlindSpot[]; isComplete: boolean } }
  | { type: "complete"; data: { reportId: string; wordCount: number } }
  | { type: "error"; data: { message: string; code: string } };
```

**前端消费示例**:

```typescript
// useSynthesisStream hook
function useSynthesisStream() {
  const [state, setState] = useState<SynthesisState>(initialState);

  const startSynthesis = useCallback(async (params: SynthesisParams) => {
    const response = await fetch("/api/synthesis/generate", {
      method: "POST",
      body: JSON.stringify(params),
    });

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const lines = decoder.decode(value).split("\n");
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const event = JSON.parse(line.slice(6));
          handleEvent(event, setState);
        }
      }
    }
  }, []);

  return { state, startSynthesis };
}
```

---

### Decision 5: 页面和组件结构

**决策**: 三页面架构 + 模块化组件

**页面结构**:

```
src/app/(main)/synthesis/
├── page.tsx              # 综述列表页
├── [id]/page.tsx         # 综述详情页
└── new/page.tsx          # 创建综述页（含进度展示）
```

**组件层级**:

```typescript
// 列表页组件
<SynthesisListPage>
  <SynthesisListHeader />        // 标题 + 筛选
  <SynthesisListFilters />       // 来源类型/深度模式筛选
  <SynthesisReportList>          // 报告列表
    <SynthesisReportCard />      // 单个报告卡片
  </SynthesisReportList>
  <SynthesisEmptyState />        // 空状态
</SynthesisListPage>

// 详情页组件
<SynthesisDetailPage>
  <SynthesisDetailHeader />      // 标题 + 元信息 + 操作
  <SynthesisSourceList />        // 来源书签列表
  <SynthesisOverview />          // 概述区块
  <SynthesisConsensus />         // 共识区块
  <SynthesisDivergence />        // 分歧区块
  <SynthesisBlindSpots />        // 盲区区块
  <SynthesisExportActions />     // 导出操作
</SynthesisDetailPage>

// 创建页组件
<SynthesisCreatePage>
  <SynthesisSourceSelector />    // 来源选择器
  <SynthesisDepthSelector />     // 深度选择器
  <SynthesisGenerateButton />    // 开始生成
  <SynthesisProgress />          // 进度展示
  <SynthesisStreamPreview />     // 流式预览
</SynthesisCreatePage>
```

---

### Decision 6: 状态管理方案

**决策**: React Context + Custom Hooks，不引入 Redux

**理由**:

- 项目已有成熟的 Hooks 模式
- 综述功能状态相对独立
- 避免增加新的状态管理复杂度

**状态结构**:

```typescript
interface SynthesisContextState {
  // 列表状态
  reports: SynthesisReport[];
  listLoading: boolean;
  listError: Error | null;

  // 筛选状态
  filters: {
    sourceType: SourceType | "all";
    depthMode: DepthMode | "all";
    dateRange: DateRange | null;
  };

  // 生成状态
  generating: boolean;
  currentProgress: {
    step: string;
    percent: number;
    message: string;
  } | null;
  streamingContent: {
    overview: string;
    consensus: ConsensusPoint[];
    divergence: DivergencePoint[];
    blindSpots: BlindSpot[];
  };
}

// Context Provider
const SynthesisContext = createContext<SynthesisContextValue | null>(null);

// Custom Hooks
export function useSynthesisList() {
  /* ... */
}
export function useSynthesisDetail(id: string) {
  /* ... */
}
export function useSynthesisGenerate() {
  /* ... */
}
export function useSynthesisStream() {
  /* ... */
}
```

---

### Decision 7: API 端点设计

**决策**: RESTful API + SSE 流式端点

| 端点                         | 方法   | 功能                       |
| ---------------------------- | ------ | -------------------------- |
| `/api/synthesis`             | GET    | 获取综述列表（分页、筛选） |
| `/api/synthesis`             | POST   | 创建综述（异步）           |
| `/api/synthesis/[id]`        | GET    | 获取综述详情               |
| `/api/synthesis/[id]`        | DELETE | 删除综述                   |
| `/api/synthesis/generate`    | POST   | 生成综述（SSE 流式）       |
| `/api/synthesis/[id]/export` | GET    | 导出综述                   |
| `/api/synthesis/recommend`   | GET    | 获取 AI 推荐的合成候选     |

**API 实现示例**:

```typescript
// src/app/api/synthesis/generate/route.ts
export async function POST(request: Request) {
  const { sourceType, sourceId, bookmarkIds, depthMode } = await request.json();

  // 创建 SSE 响应
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      const sendEvent = (event: SynthesisSSEEvent) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
        );
      };

      try {
        // 1. 准备阶段
        sendEvent({
          type: "progress",
          data: { step: "prepare", percent: 0, message: "收集源内容..." },
        });
        const sources = await collectSources(sourceType, sourceId, bookmarkIds);

        // 2. 调用 ThematicSynthesisSkill
        const skill = new ThematicSynthesisSkill();
        await skill.execute({
          sources,
          depthMode,
          onProgress: sendEvent,
        });

        sendEvent({
          type: "complete",
          data: { reportId: skill.reportId, wordCount: skill.wordCount },
        });
      } catch (error) {
        sendEvent({
          type: "error",
          data: { message: error.message, code: "SYNTHESIS_ERROR" },
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
```

---

### Decision 8: API Response Format

**列表响应**:

```typescript
interface SynthesisListResponse {
  data: SynthesisReportSummary[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    hasMore: boolean;
  };
}

interface SynthesisReportSummary {
  id: string;
  title: string;
  sourceType: SourceType;
  depthMode: DepthMode;
  sourceCount: number;
  wordCount: number;
  status: SynthesisStatus;
  createdAt: string;
  completedAt: string | null;
  // 预览字段
  overviewPreview: string; // 前 200 字
  consensusCount: number;
  divergenceCount: number;
  blindSpotCount: number;
}
```

**详情响应**:

```typescript
interface SynthesisDetailResponse {
  data: SynthesisReport;
}

interface SynthesisReport extends SynthesisReportSummary {
  overview: string;
  consensus: ConsensusPoint[];
  divergence: DivergencePoint[];
  blindSpots: BlindSpot[];
  fullMarkdown: string;
  sourceBookmarks: Array<{
    id: string;
    title: string;
    url: string;
    platform: string;
  }>;
}
```

---

### Decision 9: 书签系统集成

**决策**: 通过现有书签 API 获取来源内容

**来源收集逻辑**:

```typescript
async function collectSources(
  sourceType: SourceType,
  sourceId?: string,
  bookmarkIds?: string[],
): Promise<BookmarkSource[]> {
  switch (sourceType) {
    case "folder":
      // 获取文件夹内所有书签
      return await getBookmarksByFolder(sourceId!);

    case "tag":
      // 获取标签关联的所有书签
      return await getBookmarksByTag(sourceId!);

    case "selection":
      // 获取手动选择的书签
      return await getBookmarksByIds(bookmarkIds!);

    case "ai_recommend":
      // AI 推荐的相关书签（基于向量相似度）
      return await getRecommendedBookmarks(sourceId!);
  }
}

interface BookmarkSource {
  id: string;
  title: string;
  url: string;
  content: string; // 书签内容/摘要
  aiSummary?: string; // AI 生成的摘要
  platform: string;
  createdAt: string;
}
```

**Token 限制处理**:

```typescript
// 内容截断策略
const MAX_TOTAL_TOKENS = 100000; // 预留 Token 给输出
const MAX_PER_SOURCE_TOKENS = 8000;

function truncateSourceContent(sources: BookmarkSource[]): BookmarkSource[] {
  const tokenBudgetPerSource = Math.min(
    MAX_PER_SOURCE_TOKENS,
    Math.floor(MAX_TOTAL_TOKENS / sources.length),
  );

  return sources.map((source) => ({
    ...source,
    content: truncateToTokens(source.content, tokenBudgetPerSource),
  }));
}
```

---

### Decision 10: UnifiedEngine 集成

**决策**: ThematicSynthesisSkill 作为 OrchestrationSkill 注册到 UnifiedEngine

**Skill 注册**:

```typescript
// src/lib/ai-skills/register.ts
import { ThematicSynthesisSkill } from "./skills/thematic-synthesis";

export const ORCHESTRATION_SKILLS = {
  knowledge_review: KnowledgeReviewSkill,
  data_export: DataExportSkill,
  insight_report: InsightReportSkill,
  batch_organize: BatchOrganizeSkill,
  thematic_synthesis: ThematicSynthesisSkill, // 新增
} as const;
```

**意图路由配置**:

```typescript
// 意图分类规则
const SYNTHESIS_INTENT_RULES = [
  {
    patterns: ["综述", "合成", "综合分析", "汇总观点", "总结这些"],
    intent: "synthesize",
    subType: "thematic_synthesis",
  },
  {
    patterns: ["比较", "对比", "不同观点", "分歧", "冲突"],
    intent: "synthesize",
    subType: "thematic_synthesis",
  },
  {
    patterns: ["知识盲区", "还缺什么", "补充什么"],
    intent: "synthesize",
    subType: "thematic_synthesis",
  },
];
```

---

## 4. Implementation Patterns & Consistency Rules

### 4.1 文件命名规范

```
# 组件文件
synthesis-list-page.tsx        # 页面组件
synthesis-report-card.tsx      # 展示组件
synthesis-source-selector.tsx  # 交互组件
use-synthesis-stream.ts        # Hook 文件

# 服务文件
synthesis.service.ts           # 业务逻辑
synthesis-api.ts               # API 调用
synthesis.types.ts             # 类型定义

# Skill 文件
thematic-synthesis.skill.ts    # Skill 主文件
prepare.step.ts                # 步骤实现
synthesis.prompts.ts           # Prompt 模板
```

### 4.2 组件结构规范

```typescript
// 组件文件结构
'use client';

import { /* dependencies */ } from '...';

// Types
interface SynthesisReportCardProps {
  report: SynthesisReportSummary;
  onDelete?: (id: string) => void;
}

// Component
export function SynthesisReportCard({ report, onDelete }: SynthesisReportCardProps) {
  // Hooks
  const router = useRouter();

  // Handlers
  const handleClick = () => router.push(`/synthesis/${report.id}`);

  // Render
  return (
    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={handleClick}>
      {/* ... */}
    </Card>
  );
}
```

### 4.3 Prompt 模板规范

```typescript
// 对抗性合成 Prompt
export const SYNTHESIS_SYSTEM_PROMPT = `你是一个客观的内容分析师，专门进行多源内容综述。

## 核心原则
1. **观点中立**: 不做价值判断，只呈现事实和观点
2. **冲突敏感**: 主动识别不同来源间的观点分歧
3. **结构清晰**: 按四维结构组织输出
4. **引用明确**: 每个观点都标注来源

## 输出结构
1. **概述**: 简明扼要的主题总结
2. **核心共识**: 多数来源认同的观点
3. **观点分歧**: 不同来源的对立观点（不评判对错）
4. **知识盲区**: 现有内容未覆盖但相关的主题`;

export const DIVERGENCE_DETECTION_PROMPT = `分析以下内容中的观点分歧：

## 来源内容
{{sources}}

## 任务
1. 识别观点相互矛盾或对立的主题
2. 提取每方观点的核心论点
3. 标注支持每方观点的来源
4. 提供客观分析，不做价值判断

## 输出格式
返回 JSON 数组：
[{
  "topic": "分歧主题",
  "point_a": "观点A",
  "sources_a": [{"id": "xxx", "title": "xxx", "quote": "原文引用"}],
  "point_b": "观点B",
  "sources_b": [{"id": "xxx", "title": "xxx", "quote": "原文引用"}],
  "analysis": "客观分析"
}]`;
```

### 4.4 错误处理规范

```typescript
// 统一错误类型
export class SynthesisError extends Error {
  constructor(
    message: string,
    public code: SynthesisErrorCode,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "SynthesisError";
  }
}

export enum SynthesisErrorCode {
  SOURCE_NOT_FOUND = "SOURCE_NOT_FOUND",
  INSUFFICIENT_CONTENT = "INSUFFICIENT_CONTENT",
  TOKEN_LIMIT_EXCEEDED = "TOKEN_LIMIT_EXCEEDED",
  LLM_ERROR = "LLM_ERROR",
  GENERATION_TIMEOUT = "GENERATION_TIMEOUT",
}

// 错误处理
try {
  await generateSynthesis(params);
} catch (error) {
  if (error instanceof SynthesisError) {
    switch (error.code) {
      case SynthesisErrorCode.INSUFFICIENT_CONTENT:
        // 提示用户添加更多内容
        break;
      case SynthesisErrorCode.TOKEN_LIMIT_EXCEEDED:
        // 自动降级处理
        break;
      default:
      // 通用错误处理
    }
  }
}
```

---

## 5. Project Structure & Boundaries

### 5.1 完整目录结构

```
src/
├── app/
│   └── (main)/
│       └── synthesis/
│           ├── page.tsx                    # 综述列表页
│           ├── [id]/
│           │   └── page.tsx                # 综述详情页
│           └── new/
│               └── page.tsx                # 创建综述页
│
├── components/
│   └── synthesis/
│       ├── list/
│       │   ├── synthesis-list-header.tsx
│       │   ├── synthesis-list-filters.tsx
│       │   ├── synthesis-report-list.tsx
│       │   ├── synthesis-report-card.tsx
│       │   └── synthesis-empty-state.tsx
│       │
│       ├── detail/
│       │   ├── synthesis-detail-header.tsx
│       │   ├── synthesis-source-list.tsx
│       │   ├── synthesis-overview.tsx
│       │   ├── synthesis-consensus.tsx
│       │   ├── synthesis-divergence.tsx
│       │   ├── synthesis-blind-spots.tsx
│       │   └── synthesis-export-actions.tsx
│       │
│       ├── generate/
│       │   ├── synthesis-source-selector.tsx
│       │   ├── synthesis-depth-selector.tsx
│       │   ├── synthesis-generate-button.tsx
│       │   ├── synthesis-progress.tsx
│       │   └── synthesis-stream-preview.tsx
│       │
│       ├── shared/
│       │   ├── synthesis-status-badge.tsx
│       │   ├── synthesis-source-tag.tsx
│       │   └── synthesis-depth-badge.tsx
│       │
│       └── entry-points/
│           ├── folder-synthesis-trigger.tsx    # 文件夹右键菜单入口
│           ├── tag-synthesis-trigger.tsx       # 标签右键菜单入口
│           └── selection-synthesis-trigger.tsx # 批量选择工具栏入口
│
├── hooks/
│   └── synthesis/
│       ├── use-synthesis-list.ts
│       ├── use-synthesis-detail.ts
│       ├── use-synthesis-generate.ts
│       ├── use-synthesis-stream.ts
│       └── index.ts
│
├── lib/
│   └── synthesis/
│       ├── types.ts                    # 类型定义
│       ├── constants.ts                # 常量
│       ├── api/
│       │   ├── synthesis-api.ts        # API 调用
│       │   └── index.ts
│       ├── services/
│       │   ├── synthesis.service.ts    # 业务逻辑
│       │   ├── source-collector.ts     # 来源收集
│       │   └── index.ts
│       └── utils/
│           ├── token-estimator.ts      # Token 估算
│           ├── content-truncator.ts    # 内容截断
│           └── index.ts
│
└── lib/
    └── ai-skills/
        └── skills/
            └── thematic-synthesis/
                ├── index.ts                     # Skill 导出
                ├── thematic-synthesis.skill.ts  # Skill 主类
                ├── steps/
                │   ├── prepare.step.ts          # 准备步骤
                │   ├── analyze.step.ts          # 分析步骤
                │   ├── synthesize.step.ts       # 合成步骤
                │   ├── conflict.step.ts         # 冲突检测
                │   └── blindspot.step.ts        # 盲区发现
                ├── prompts/
                │   ├── system.prompt.ts         # 系统提示词
                │   ├── overview.prompt.ts       # 概述生成
                │   ├── consensus.prompt.ts      # 共识提取
                │   ├── divergence.prompt.ts     # 分歧检测
                │   └── blindspot.prompt.ts      # 盲区发现
                └── __tests__/
                    ├── thematic-synthesis.skill.test.ts
                    └── steps/

# API Routes
src/app/api/synthesis/
├── route.ts                    # GET 列表, POST 创建
├── [id]/
│   ├── route.ts                # GET 详情, DELETE 删除
│   └── export/
│       └── route.ts            # GET 导出
├── generate/
│   └── route.ts                # POST 生成 (SSE)
└── recommend/
    └── route.ts                # GET AI 推荐
```

### 5.2 模块边界定义

```
┌─────────────────────────────────────────────────────────────────┐
│                         Synthesis Module                         │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │    Pages     │  │  Components  │  │    Hooks     │          │
│  │  (App Router)│  │   (React)    │  │   (State)    │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                 │                 │                   │
│         └─────────────────┼─────────────────┘                   │
│                           │                                     │
│                   ┌───────▼───────┐                             │
│                   │   Services    │                             │
│                   │ (lib/synthesis)│                            │
│                   └───────┬───────┘                             │
│                           │                                     │
│  ┌────────────────────────┼────────────────────────┐           │
│  │                        │                        │           │
│  │  ┌─────────────────────▼─────────────────────┐ │           │
│  │  │         ThematicSynthesisSkill            │ │           │
│  │  │        (lib/ai-skills/skills/)            │ │           │
│  │  └───────────────────────────────────────────┘ │           │
│  │                                                │           │
│  │                  AI Skills Module              │           │
│  └────────────────────────────────────────────────┘           │
│                           │                                     │
└───────────────────────────┼─────────────────────────────────────┘
                            │
            ┌───────────────┼───────────────┐
            │               │               │
    ┌───────▼───────┐ ┌─────▼─────┐ ┌───────▼───────┐
    │   Supabase    │ │ Bookmarks │ │  UnifiedEngine │
    │  (Database)   │ │  Module   │ │   (AI Core)    │
    └───────────────┘ └───────────┘ └───────────────┘
```

### 5.3 依赖关系规则

| 模块       | 可依赖                      | 不可依赖            |
| ---------- | --------------------------- | ------------------- |
| Pages      | Components, Hooks, Services | AI Skills 直接      |
| Components | Hooks, Types                | Services, AI Skills |
| Hooks      | Services, API               | AI Skills           |
| Services   | API, Types, Utils           | Components          |
| AI Skills  | Core AI, Prompts            | UI Components       |

---

## 6. Architecture Validation

### 6.1 PRD 覆盖度检查

| PRD 功能需求                             | 架构支持                          | 验证状态 |
| ---------------------------------------- | --------------------------------- | -------- |
| FR15: 用户可以对文件夹内书签生成主题综述 | API + Skill + 入口组件            | ✅       |
| FR16: 用户可以选择综述深度               | depth_mode 字段 + 选择器组件      | ✅       |
| FR17: 系统自动识别观点分歧               | conflict.step + divergence 结构   | ✅       |
| FR18: 系统可以发现知识盲区               | blindspot.step + blind_spots 结构 | ✅       |
| FR19: 用户可以查看综述报告列表           | 列表页 + API                      | ✅       |
| FR20: 用户可以导出综述报告               | 导出 API + 多格式支持             | ✅       |
| FR21: 用户通过 Agent 对话触发综述        | UnifiedEngine 意图路由            | ✅       |

### 6.2 技术约束验证

| 约束       | 解决方案            | 验证状态 |
| ---------- | ------------------- | -------- |
| Token 限制 | 内容截断 + 分段处理 | ✅       |
| 流式输出   | SSE + 四维分段事件  | ✅       |
| 向量搜索   | 复用 pgvector       | ✅       |
| RLS 安全   | 完整策略定义        | ✅       |
| 状态管理   | Context + Hooks     | ✅       |

### 6.3 现有架构集成验证

| 集成点        | 方案                  | 验证状态 |
| ------------- | --------------------- | -------- |
| UnifiedEngine | Skill 注册 + 意图路由 | ✅       |
| 书签系统      | 复用现有 API          | ✅       |
| UI 组件       | Shadcn UI 规范        | ✅       |
| 导出系统      | 复用现有 Formatter    | ✅       |

### 6.4 风险评估

| 风险               | 等级 | 缓解措施                |
| ------------------ | ---- | ----------------------- |
| LLM 冲突检测准确性 | 中   | 多轮验证 + 人工审核选项 |
| 长内容 Token 超限  | 中   | 智能截断 + 分批处理     |
| 流式输出中断       | 低   | 断点续传 + 状态持久化   |
| 性能瓶颈           | 低   | 异步处理 + 进度反馈     |

---

## 7. Implementation Roadmap

### Phase 1: 基础设施 (Week 1)

- [ ] 数据库迁移：synthesis_reports 表
- [ ] 类型定义：types.ts
- [ ] API 路由基础框架
- [ ] ThematicSynthesisSkill 骨架

### Phase 2: 核心功能 (Week 2)

- [ ] 五步流程实现（prepare → blindspot）
- [ ] SSE 流式输出
- [ ] 列表页和详情页
- [ ] 基础 UI 组件

### Phase 3: 入口集成 (Week 3)

- [ ] 文件夹右键菜单入口
- [ ] 标签右键菜单入口
- [ ] 批量选择工具栏入口
- [ ] UnifiedEngine 意图路由

### Phase 4: 优化与测试 (Week 4)

- [ ] 性能优化（Token 估算、内容截断）
- [ ] 错误处理完善
- [ ] 单元测试和集成测试
- [ ] 文档和示例

---

## 8. Architecture Completion Summary

### 8.1 文档产出

| 文档         | 状态    | 说明                |
| ------------ | ------- | ------------------- |
| 核心架构决策 | ✅ 完成 | 10 个关键决策       |
| 数据库设计   | ✅ 完成 | 表结构 + RLS + 索引 |
| API 设计     | ✅ 完成 | 7 个端点            |
| 组件结构     | ✅ 完成 | 完整目录树          |
| Skill 设计   | ✅ 完成 | 五步流程            |

### 8.2 实现准备度

- **数据库**: 可直接执行迁移 SQL
- **类型定义**: 完整 TypeScript 接口
- **API 框架**: 路由结构清晰
- **组件拆分**: 模块边界明确
- **Skill 流程**: 步骤和 Prompt 已定义

### 8.3 下一步建议

1. **优先执行数据库迁移** - 建立数据基础
2. **实现 ThematicSynthesisSkill 核心流程** - 验证技术可行性
3. **搭建最小可用 UI** - 端到端验证
4. **逐步完善入口点** - 提升用户体验

---

> **架构文档完成时间**: 2025-12-29
> **PRD 版本**: v1.0 (主题合成器)
> **下一工作流**: Epic 创建 或 UX 设计
