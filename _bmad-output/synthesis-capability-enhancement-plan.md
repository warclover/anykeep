# AnyKeep 知识萃取能力增强方案

> **版本**: 2.0.0
> **日期**: 2026-01-01
> **作者**: BMad Master
> **状态**: 待审核
> **类型**: 核心能力增强 + 交互完善 + 竞品最佳实践 + 系统集成

---

## 目录

1. [问题诊断](#1-问题诊断)
2. [核心能力增强](#2-核心能力增强)
3. [页面交互完善](#3-页面交互完善)
4. [竞品最佳实践补充](#4-竞品最佳实践补充)
5. [实施计划](#5-实施计划)
6. [可落地开发方案](#6-可落地开发方案)

---

## 1. 问题诊断

基于代码深度审查，Master 识别出以下核心问题：

### 1.1 核心能力层面

#### 问题 A: 内容输入质量不足

**现状**:

- 当前仅使用书签的 `ai_summary` 或 `description` 字段（通常 100-300 字）
- Prompt 中 `content` 字段实际是摘要，而非原文

**代码证据** ([synthesis-prompts.ts:246-252](src/lib/ai-skills/skills/thematic-synthesis/synthesis-prompts.ts#L246-L252)):

```typescript
const documents = bookmarks
  .map(
    (b, i) => `### 【${i + 1}】${b.title} [ID: ${b.id}]
平台：${b.platform}
内容：${b.content}`, // content 实际是摘要，不是原文
  )
  .join("\n\n---\n\n");
```

---

#### 问题 B: 来源书签选择流程不完整

**现状**:

- `SynthesisNewPageClient` 中来源选择是**占位符**状态
- 选择标签/文件夹后直接跳到步骤 2，没有书签预览和选择

**代码证据** ([synthesis-new-page-client.tsx:181-185](src/components/synthesis/synthesis-new-page-client.tsx#L181-L185)):

```typescript
const handleSourceTypeSelect = useCallback((type: SynthesisSourceType) => {
  setSourceType(type);
  // TODO: 根据类型展示选择器   ← 未实现
  setStep(2);
}, []);
```

---

#### 问题 C: 生成质量控制缺失

**现状**:

- 无最小内容量检查
- 无内容相关性预检
- 无生成结果质量评估

---

#### 问题 D: 盲区功能仅"发现"不"行动"

**现状**:

- 盲区发现后，只显示建议搜索关键词
- 没有"一键搜索补充"功能

---

### 1.2 页面交互层面

#### 问题 E: 创建流程交互缺失

| 缺失功能   | 描述                           | 严重性 |
| ---------- | ------------------------------ | ------ |
| 来源选择器 | 选择标签/文件夹时无具体选择 UI | 🔴 高  |
| 书签预览   | 无法预览选中的书签列表         | 🔴 高  |
| 书签筛选   | 无法从列表中排除特定书签       | 🟡 中  |
| 内容量提示 | 无法看到内容总量和质量评估     | 🟡 中  |

#### 问题 F: 详情页交互不足

| 缺失功能     | 描述                     | 严重性 |
| ------------ | ------------------------ | ------ |
| 来源书签列表 | 无法查看被综述的书签列表 | 🔴 高  |
| 盲区行动     | 搜索关键词不可点击搜索   | 🔴 高  |
| 重新生成选项 | 无法带参数重新生成       | 🟡 中  |

---

## 2. 核心能力增强

### 2.1 [E1] 来源书签选择器

**优先级**: 🔴 P0 | **估算**: 1.5 周

**目标**: 让用户在创建综述前能够预览和筛选书签

### 2.2 [E2] 内容质量预检

**优先级**: 🔴 P0 | **估算**: 1 周

**目标**: 在生成前评估内容质量，避免低质量综述

### 2.3 [E3] 盲区一键补充

**优先级**: 🟡 P1 | **估算**: 1 周

**目标**: 发现盲区后，支持一键搜索和收藏补充内容

### 2.4 [E4] 来源书签详情面板

**优先级**: 🔴 P0 | **估算**: 0.5 周

**目标**: 在详情页显示被综述的书签列表

---

## 3. 页面交互完善

### 3.1 [I1] 创建页面完善

**优先级**: 🔴 P0 | **估算**: 0.5 周

### 3.2 [I2] 详情页增强

**优先级**: 🔴 P0 | **估算**: 0.5 周

### 3.3 [I3] 引用交互增强

**优先级**: 🟡 P1 | **估算**: 0.5 周

### 3.4 [I4] 生成体验优化

**优先级**: 🟡 P1 | **估算**: 0.5 周

---

## 4. 竞品最佳实践补充

基于 NotebookLM、Elicit、Consensus、Mem.ai 等竞品分析，新增以下增强项：

### 4.1 [S1] 综述风格选择 ⭐ 新增

**优先级**: 🔴 P0 | **估算**: 0.5 周

**竞品参考**: NotebookLM 的 Deep Dive / Brief / Debate / Critique

**功能设计**:

在创建综述时，增加**风格选择**：

| 风格       | 描述         | 输出特点             |
| ---------- | ------------ | -------------------- |
| **概要式** | 快速了解要点 | 简洁要点列表         |
| **叙事式** | 像讲故事一样 | 自然段落，有起承转合 |
| **对比式** | 强调异同     | 突出共识与分歧       |
| **批判式** | 质疑论点     | 更多分歧和盲区分析   |

---

### 4.2 [S2] 自然语言触发综述 ⭐ 新增

**优先级**: 🔴 P0 | **估算**: 1 周

**竞品参考**: Consensus 的搜索框式入口

**功能设计**:

用户可以在 AI 对话中直接用自然语言触发综述：

```
用户: 帮我综述一下最近收藏的关于 AI Agent 的文章
AI: 我发现您有 12 篇关于 AI Agent 的收藏，要生成综述吗？
    [生成综述] [查看书签列表]
```

---

### 4.3 [S3] 综述进度中实时提问 ⭐ 新增

**优先级**: 🔴 P0 | **估算**: 1.5 周

**竞品参考**: NotebookLM 的 Interactive Mode

**功能设计**:

在综述生成过程中，用户可以：

1. 点击"问一个问题"按钮
2. 输入问题（如"重点关注商业化方面"）
3. AI 在后续步骤中考虑该问题

---

### 4.4 AnyKeep 差异化定位

```
NotebookLM: 学术研究 + 多模态输出 (音频/视频)
Elicit: 系统性文献综述 + 极高精度
Consensus: 科学共识查询 + 即时答案
─────────────────────────────────────
AnyKeep: 跨平台内容聚合 + 观点对抗分析 + 知识闭环
```

---

## 5. 实施计划

### 5.1 阶段划分（更新版）

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    知识萃取能力增强 实施计划（v2.0）                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   Phase 1: 核心流程修复 + 风格选择（2.5 周）                             │
│   ├── [E1] 来源书签选择器 ──────────────────────────── 1.5 周           │
│   ├── [I1] 创建页面完善 ────────────────────────────── 0.5 周           │
│   └── [S1] 综述风格选择 ⭐ ────────────────────────── 0.5 周 (并行)     │
│                                                                         │
│   Phase 2: 详情页增强（1.5 周）                                          │
│   ├── [E4] 来源书签详情面板 ────────────────────────── 0.5 周           │
│   ├── [I2] 详情页增强 ──────────────────────────────── 0.5 周           │
│   └── [I3] 引用交互增强 ────────────────────────────── 0.5 周           │
│                                                                         │
│   Phase 3: 质量与体验 + 实时提问（2.5 周）                               │
│   ├── [E2] 内容质量预检 ────────────────────────────── 1 周             │
│   ├── [I4] 生成体验优化 ────────────────────────────── 0.5 周           │
│   └── [S3] 实时提问功能 ⭐ ────────────────────────── 1 周 (并行)       │
│                                                                         │
│   Phase 4: 闭环增强 + 自然语言触发（2 周）                               │
│   ├── [E3] 盲区一键补充 ────────────────────────────── 1 周             │
│   └── [S2] 自然语言触发 ⭐ ────────────────────────── 1 周 (并行)       │
│                                                                         │
│   总计: 8.5 周（原 6 周 + S1/S2/S3 并行 2.5 周）                         │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 5.2 优先级总结

| ID     | 功能                | 类型         | 优先级 | 估算       | 阶段        |
| ------ | ------------------- | ------------ | ------ | ---------- | ----------- |
| E1     | 来源书签选择器      | 核心能力     | P0     | 1.5 周     | Phase 1     |
| E2     | 内容质量预检        | 核心能力     | P0     | 1 周       | Phase 3     |
| E3     | 盲区一键补充        | 核心能力     | P1     | 1 周       | Phase 4     |
| E4     | 来源书签详情面板    | 核心能力     | P0     | 0.5 周     | Phase 2     |
| I1     | 创建页面完善        | 交互完善     | P0     | 0.5 周     | Phase 1     |
| I2     | 详情页增强          | 交互完善     | P0     | 0.5 周     | Phase 2     |
| I3     | 引用交互增强        | 交互完善     | P1     | 0.5 周     | Phase 2     |
| I4     | 生成体验优化        | 交互完善     | P1     | 0.5 周     | Phase 3     |
| **S1** | **综述风格选择** ⭐ | **最佳实践** | **P0** | **0.5 周** | **Phase 1** |
| **S2** | **自然语言触发** ⭐ | **最佳实践** | **P0** | **1 周**   | **Phase 4** |
| **S3** | **实时提问功能** ⭐ | **最佳实践** | **P0** | **1.5 周** | **Phase 3** |

### 5.3 验收标准

#### Phase 1 验收标准

- [ ] 用户可选择文件夹/标签作为来源
- [ ] 用户可预览即将被综述的书签列表
- [ ] 用户可排除特定书签
- [ ] 显示内容量预估
- [ ] ⭐ 用户可选择综述风格（概要/叙事/对比/批判）

#### Phase 2 验收标准

- [ ] 详情页显示来源书签列表
- [ ] 点击来源可跳转到书签详情
- [ ] 盲区关键词可点击触发搜索
- [ ] 引用悬停显示预览卡

#### Phase 3 验收标准

- [ ] 内容量不足时阻止生成并提示
- [ ] 显示内容质量评估卡片
- [ ] 生成进度显示预估剩余时间
- [ ] ⭐ 用户可在生成过程中输入问题影响后续分析

#### Phase 4 验收标准

- [ ] 盲区关键词可一键搜索
- [ ] 搜索结果可直接收藏
- [ ] 收藏后提示重新生成综述
- [ ] ⭐ 用户可通过自然语言对话触发综述创建

---

## 6. 可落地开发方案

本章节提供可直接开始开发的技术规格，包括系统集成方案。

### 6.1 系统集成架构

#### 6.1.1 现有系统概览

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         AnyKeep 综述模块现有架构                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  页面层 (src/app/(main)/synthesis/)                                     │
│  ├── page.tsx ─────────────────────→ SynthesisListPageClient            │
│  ├── new/page.tsx ─────────────────→ SynthesisNewPageClient             │
│  └── [id]/page.tsx ────────────────→ SynthesisDetailPageClient          │
│                                                                         │
│  组件层 (src/components/synthesis/)                                     │
│  ├── synthesis-new-page-client.tsx   # 创建向导 (3步骤)                  │
│  ├── synthesis-progress.tsx          # 进度组件 (SSE)                   │
│  ├── synthesis-detail-page-client.tsx # 详情页                          │
│  ├── synthesis-list-page-client.tsx   # 列表页                          │
│  ├── synthesis-recommend-bubble.tsx   # 推荐气泡                        │
│  └── highlightable-text.tsx           # 可高亮文本                      │
│                                                                         │
│  服务层 (src/lib/)                                                      │
│  ├── synthesis/                       # 类型 + 常量                      │
│  │   ├── types.ts                     # SynthesisReport, SSE 事件等     │
│  │   └── constants.ts                 # Token 限制, 超时配置等          │
│  └── ai-skills/skills/thematic-synthesis/                               │
│      ├── thematic-synthesis.skill.ts  # 核心 Skill                      │
│      ├── synthesis-prompts.ts         # Prompt 模板                     │
│      └── types.ts                     # ThematicSynthesisOutput         │
│                                                                         │
│  API 层 (src/app/api/synthesis/)                                        │
│  ├── route.ts                         # POST 创建综述                   │
│  ├── [id]/route.ts                    # GET/DELETE 详情                 │
│  └── generate/route.ts                # POST 生成 (SSE)                 │
│                                                                         │
│  AI Agent 层 (src/lib/ai-agent/)                                        │
│  └── personas/inference/intent-rules.ts  # 意图规则系统                 │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

#### 6.1.2 集成后架构

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       增强后架构（新增部分用 ⭐ 标记）                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  组件层新增 (src/components/synthesis/)                                 │
│  ├── source-selector/           ⭐ 来源选择器模块                        │
│  │   ├── folder-picker.tsx         # 文件夹选择器                       │
│  │   ├── tag-picker.tsx            # 标签选择器                         │
│  │   ├── manual-selector.tsx       # 手动选择书签                       │
│  │   └── index.ts                                                       │
│  ├── style-selector.tsx         ⭐ 风格选择器 [S1]                       │
│  ├── bookmark-preview-list.tsx  ⭐ 书签预览列表                          │
│  ├── quality-assessment.tsx     ⭐ 质量评估卡片                          │
│  ├── question-input.tsx         ⭐ 实时提问输入 [S3]                     │
│  ├── source-bookmarks-section.tsx ⭐ 来源书签区块                        │
│  └── blindspot-search-dialog.tsx  ⭐ 盲区搜索弹窗                        │
│                                                                         │
│  服务层新增 (src/lib/)                                                  │
│  ├── synthesis/                                                         │
│  │   └── services/                                                      │
│  │       ├── quality-assessment.service.ts ⭐ 质量评估服务               │
│  │       └── synthesis-nlp.service.ts      ⭐ 自然语言服务 [S2]          │
│  └── ai-agent/tools/synthesis/   ⭐ 综述 Tool 模块 [S2]                  │
│      ├── create-synthesis.tool.ts  # 创建综述 Tool                      │
│      └── index.ts                                                       │
│                                                                         │
│  API 层新增 (src/app/api/synthesis/)                                    │
│  ├── preview/route.ts            ⭐ 书签预览 API                         │
│  ├── assess-quality/route.ts     ⭐ 质量评估 API                         │
│  └── [id]/question/route.ts      ⭐ 实时提问 API [S3]                    │
│                                                                         │
│  数据库新增 (supabase/migrations/)                                      │
│  └── YYYYMMDD_add_synthesis_style.sql ⭐ 风格字段 [S1]                   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### 6.2 [S1] 综述风格选择 - 详细开发规格

#### 6.2.1 类型定义

**文件**: `src/lib/synthesis/types.ts` (追加)

```typescript
/**
 * 综述输出风格
 */
export type SynthesisOutputStyle =
  | "summary" // 概要式：简洁要点列表
  | "narrative" // 叙事式：自然段落，有起承转合
  | "comparison" // 对比式：突出共识与分歧
  | "critical"; // 批判式：更多分歧和盲区分析

/**
 * 风格配置
 */
export interface SynthesisStyleConfig {
  id: SynthesisOutputStyle;
  name: string;
  description: string;
  icon: string;
  promptModifier: string;
}

/**
 * 预定义风格配置
 */
export const SYNTHESIS_STYLE_CONFIGS: Record<
  SynthesisOutputStyle,
  SynthesisStyleConfig
> = {
  summary: {
    id: "summary",
    name: "概要式",
    description: "快速要点列表",
    icon: "📋",
    promptModifier:
      "请以简洁的要点列表形式输出，每个要点一句话，突出核心信息。",
  },
  narrative: {
    id: "narrative",
    name: "叙事式",
    description: "故事化叙述",
    icon: "📖",
    promptModifier:
      "请以流畅的叙事风格输出，使用自然段落，有起承转合，像讲故事一样。",
  },
  comparison: {
    id: "comparison",
    name: "对比式",
    description: "强调异同",
    icon: "⚖️",
    promptModifier:
      "请重点突出不同来源之间的共识与分歧，使用对比结构呈现观点差异。",
  },
  critical: {
    id: "critical",
    name: "批判式",
    description: "质疑分析",
    icon: "🔍",
    promptModifier:
      "请以批判性思维分析内容，质疑论点的合理性，重点挖掘分歧和知识盲区。",
  },
};
```

#### 6.2.2 数据库变更

**文件**: `supabase/migrations/YYYYMMDD000001_add_synthesis_style.sql`

```sql
-- 添加综述风格字段
ALTER TABLE synthesis_reports
ADD COLUMN output_style TEXT DEFAULT 'summary'
CHECK (output_style IN ('summary', 'narrative', 'comparison', 'critical'));

COMMENT ON COLUMN synthesis_reports.output_style IS '综述输出风格';
```

#### 6.2.3 UI 组件

**文件**: `src/components/synthesis/style-selector.tsx`

```typescript
"use client";

import { cn } from "@/lib/utils";
import { SYNTHESIS_STYLE_CONFIGS, type SynthesisOutputStyle } from "@/lib/synthesis";

interface StyleSelectorProps {
  value: SynthesisOutputStyle;
  onChange: (style: SynthesisOutputStyle) => void;
  disabled?: boolean;
}

export function StyleSelector({ value, onChange, disabled }: StyleSelectorProps) {
  const styles = Object.values(SYNTHESIS_STYLE_CONFIGS);

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium">选择综述风格</label>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {styles.map((style) => (
          <button
            key={style.id}
            type="button"
            disabled={disabled}
            onClick={() => onChange(style.id)}
            className={cn(
              "flex flex-col items-center gap-1 rounded-lg border p-4 transition-colors",
              "hover:bg-accent hover:text-accent-foreground",
              value === style.id && "border-primary bg-primary/5",
              disabled && "cursor-not-allowed opacity-50"
            )}
          >
            <span className="text-2xl">{style.icon}</span>
            <span className="text-sm font-medium">{style.name}</span>
            <span className="text-xs text-muted-foreground">{style.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
```

#### 6.2.4 现有组件集成点

**文件**: `src/components/synthesis/synthesis-new-page-client.tsx`

**改动位置**: 步骤 2 深度选择部分，在深度选择后添加风格选择

```typescript
// 新增状态
const [outputStyle, setOutputStyle] = useState<SynthesisOutputStyle>("summary");

// 步骤 2 中添加（在深度选择 RadioGroup 后）
<StyleSelector
  value={outputStyle}
  onChange={setOutputStyle}
  disabled={isCreating}
/>

// 创建请求中添加
body: JSON.stringify({
  sourceType,
  sourceId,
  bookmarkIds: selectedBookmarkIds.length > 0 ? selectedBookmarkIds : undefined,
  depthMode,
  outputStyle,  // 新增
}),
```

#### 6.2.5 Prompt 集成

**文件**: `src/lib/ai-skills/skills/thematic-synthesis/synthesis-prompts.ts`

```typescript
import {
  SYNTHESIS_STYLE_CONFIGS,
  type SynthesisOutputStyle,
} from "@/lib/synthesis";

// 修改 buildSynthesisPrompt 函数签名
export function buildSynthesisPrompt(
  bookmarks: BookmarkSource[],
  depthMode: SynthesisDepthMode,
  outputStyle: SynthesisOutputStyle = "summary", // 新增参数
): string {
  const styleConfig = SYNTHESIS_STYLE_CONFIGS[outputStyle];

  const basePrompt = buildBasePrompt(bookmarks, depthMode);

  // 在基础 Prompt 后追加风格指令
  return `${basePrompt}\n\n## 输出风格要求\n${styleConfig.promptModifier}`;
}
```

---

### 6.3 [S2] 自然语言触发综述 - 详细开发规格

#### 6.3.1 意图规则集成

**文件**: `src/lib/ai-agent/personas/inference/intent-rules.ts`

**集成位置**: 在文件末尾添加综述意图规则

```typescript
// =============================================================================
// 综述意图规则 (新增)
// =============================================================================

/**
 * 综述意图规则
 */
export const SYNTHESIS_INTENT_RULES: PersonaIntentRule[] = [
  {
    id: "synthesis-create",
    personas: [
      "pm",
      "consultant",
      "teacher",
      "analyst",
      "researcher",
      "lifelong_learner",
    ],
    pattern:
      /综述|合成|整合|归纳|总结.*(收藏|文章|内容)|把.*(综合|整理)|生成.*报告/,
    intentType: "create",
    intentSubtype: "synthesis",
    confidenceBoost: 1.6,
    contextHint: "用户想要创建知识综述",
    responseStyle: "structured",
    priority: 95,
  },
  {
    id: "synthesis-query",
    personas: [
      "pm",
      "consultant",
      "teacher",
      "analyst",
      "researcher",
      "lifelong_learner",
    ],
    pattern: /我的综述|综述列表|看看综述|综述历史/,
    intentType: "query",
    intentSubtype: "synthesis_list",
    confidenceBoost: 1.4,
    contextHint: "用户想要查看综述列表",
    responseStyle: "concise",
    priority: 85,
  },
];

// 追加到 ALL_PERSONA_INTENT_RULES
export const ALL_PERSONA_INTENT_RULES: PersonaIntentRule[] = [
  ...PHASE1_INTENT_RULES,
  ...PHASE2_INTENT_RULES,
  ...PHASE3_INTENT_RULES,
  ...COMMON_PERSONA_RULES,
  ...SYNTHESIS_INTENT_RULES, // 新增
];
```

#### 6.3.2 Tool 定义

**文件**: `src/lib/ai-agent/tools/synthesis/create-synthesis.tool.ts`

```typescript
import { z } from "zod";
import type {
  Tool,
  ToolExecuteContext,
  ToolResult,
} from "@/lib/ai-agent/types";
import { SynthesisNLPService } from "@/lib/synthesis/services/synthesis-nlp.service";

export const createSynthesisToolSchema = z.object({
  topic: z.string().describe("综述主题或关键词"),
  sourceType: z
    .enum(["folder", "tag", "search"])
    .optional()
    .describe("来源类型"),
  sourceId: z.string().optional().describe("文件夹或标签 ID"),
  depthMode: z
    .enum(["quick", "standard", "academic"])
    .optional()
    .describe("深度模式"),
  outputStyle: z
    .enum(["summary", "narrative", "comparison", "critical"])
    .optional()
    .describe("输出风格"),
});

export type CreateSynthesisParams = z.infer<typeof createSynthesisToolSchema>;

export const createSynthesisTool: Tool<CreateSynthesisParams> = {
  name: "create_synthesis",
  description: "根据用户指定的主题创建知识综述",
  category: "synthesis",
  riskLevel: "medium",
  schema: createSynthesisToolSchema,

  async execute(
    params: CreateSynthesisParams,
    context: ToolExecuteContext,
  ): Promise<ToolResult> {
    const nlpService = new SynthesisNLPService();

    // 1. 根据 topic 搜索匹配的书签
    const matchingBookmarks = await nlpService.findBookmarksByTopic(
      params.topic,
      context.userId,
      20,
    );

    if (matchingBookmarks.length < 3) {
      return {
        success: false,
        message: `只找到 ${matchingBookmarks.length} 篇关于「${params.topic}」的相关收藏，建议至少 3 篇才能生成有价值的综述`,
        data: {
          bookmarkCount: matchingBookmarks.length,
          bookmarks: matchingBookmarks
            .slice(0, 5)
            .map((b) => ({ id: b.id, title: b.title })),
        },
        suggestions: ["收藏更多相关内容后再试", "尝试更宽泛的关键词"],
      };
    }

    // 2. 返回确认信息
    return {
      success: true,
      message: `找到 ${matchingBookmarks.length} 篇关于「${params.topic}」的收藏`,
      data: {
        bookmarkCount: matchingBookmarks.length,
        sampleBookmarks: matchingBookmarks
          .slice(0, 5)
          .map((b) => ({ id: b.id, title: b.title })),
        suggestedDepth: matchingBookmarks.length > 10 ? "standard" : "quick",
        redirectUrl: `/synthesis/new?topic=${encodeURIComponent(params.topic)}&bookmarkIds=${matchingBookmarks.map((b) => b.id).join(",")}`,
      },
      actions: [
        {
          label: "生成综述",
          action: "redirect",
          url: `/synthesis/new?topic=${encodeURIComponent(params.topic)}`,
        },
        { label: "查看书签列表", action: "show_bookmarks" },
      ],
    };
  },
};
```

#### 6.3.3 Tool 注册

**文件**: `src/lib/ai-agent/tools/register.ts`

```typescript
import { createSynthesisTool } from "./synthesis/create-synthesis.tool";

// 在现有 tools 数组中添加
export const registeredTools: Tool[] = [
  // ... 现有 tools
  createSynthesisTool, // 新增
];
```

#### 6.3.4 服务层

**文件**: `src/lib/synthesis/services/synthesis-nlp.service.ts`

```typescript
import { createClient } from "@/lib/supabase/server";
import type { BookmarkSource } from "@/lib/synthesis";

export class SynthesisNLPService {
  /**
   * 根据自然语言主题查找匹配的书签
   */
  async findBookmarksByTopic(
    topic: string,
    userId: string,
    limit = 20,
  ): Promise<BookmarkSource[]> {
    const supabase = await createClient();

    // 1. 尝试标签匹配
    const { data: tagMatch } = await supabase
      .from("bookmark_tags")
      .select("bookmark_id")
      .eq("user_id", userId)
      .ilike("tag_name", `%${topic}%`)
      .limit(limit);

    if (tagMatch && tagMatch.length >= 3) {
      return this.getBookmarksByIds(
        tagMatch.map((t) => t.bookmark_id),
        userId,
      );
    }

    // 2. 尝试文件夹名称匹配
    const { data: folderMatch } = await supabase
      .from("folders")
      .select("id")
      .eq("user_id", userId)
      .ilike("name", `%${topic}%`)
      .maybeSingle();

    if (folderMatch) {
      return this.getBookmarksByFolderId(folderMatch.id, userId, limit);
    }

    // 3. 标题模糊搜索
    const { data: titleMatch } = await supabase
      .from("bookmarks")
      .select("id, title, url, ai_summary, platform, created_at")
      .eq("user_id", userId)
      .or(`title.ilike.%${topic}%,ai_summary.ilike.%${topic}%`)
      .limit(limit);

    if (titleMatch && titleMatch.length > 0) {
      return titleMatch.map(this.mapToBookmarkSource);
    }

    // 4. 如果都没有匹配，返回空数组
    return [];
  }

  private async getBookmarksByIds(
    ids: string[],
    userId: string,
  ): Promise<BookmarkSource[]> {
    const supabase = await createClient();
    const { data } = await supabase
      .from("bookmarks")
      .select("id, title, url, ai_summary, platform, created_at")
      .eq("user_id", userId)
      .in("id", ids);

    return (data || []).map(this.mapToBookmarkSource);
  }

  private async getBookmarksByFolderId(
    folderId: string,
    userId: string,
    limit: number,
  ): Promise<BookmarkSource[]> {
    const supabase = await createClient();
    const { data } = await supabase
      .from("bookmarks")
      .select("id, title, url, ai_summary, platform, created_at")
      .eq("user_id", userId)
      .eq("folder_id", folderId)
      .limit(limit);

    return (data || []).map(this.mapToBookmarkSource);
  }

  private mapToBookmarkSource(row: any): BookmarkSource {
    return {
      id: row.id,
      title: row.title,
      url: row.url,
      content: row.ai_summary || "",
      platform: row.platform,
      createdAt: row.created_at,
    };
  }
}
```

---

### 6.4 [S3] 实时提问功能 - 详细开发规格

#### 6.4.1 类型定义

**文件**: `src/lib/synthesis/types.ts` (追加)

```typescript
/**
 * 用户在生成过程中的提问
 */
export interface SynthesisUserQuestion {
  id: string;
  content: string;
  askedAtStep: SynthesisStepId;
  askedAtPercent: number;
  askedAt: string;
}

/**
 * 增强的生成上下文
 */
export interface SynthesisGenerationContext {
  reportId: string;
  userId: string;
  userQuestions: SynthesisUserQuestion[];
  currentStep: SynthesisStepId;
  currentPercent: number;
}

// 扩展 SSE 事件
export interface SynthesisQuestionAckData {
  questionId: string;
  content: string;
  acknowledgment: string;
}

// 在 SynthesisSSEEvent 联合类型中添加
export type SynthesisSSEEvent =
  | { type: "progress"; data: SynthesisProgressData }
  | { type: "overview"; data: SynthesisOverviewData }
  | { type: "consensus"; data: SynthesisConsensusData }
  | { type: "divergence"; data: SynthesisDivergenceData }
  | { type: "blindspot"; data: SynthesisBlindSpotData }
  | { type: "complete"; data: SynthesisCompleteData }
  | { type: "error"; data: SynthesisErrorData }
  | { type: "question_ack"; data: SynthesisQuestionAckData }; // 新增
```

#### 6.4.2 API 端点

**文件**: `src/app/api/synthesis/[id]/question/route.ts`

```typescript
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { nanoid } from "nanoid";

interface QuestionRequest {
  content: string;
}

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/synthesis/[id]/question - 在生成过程中提交问题
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const { id: reportId } = await context.params;
  const supabase = await createClient();

  // 1. 验证用户
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. 验证报告状态
  const { data: report } = await supabase
    .from("synthesis_reports")
    .select("status, generation_context")
    .eq("id", reportId)
    .eq("user_id", user.id)
    .single();

  if (!report || report.status !== "generating") {
    return NextResponse.json(
      { error: "Report is not currently generating" },
      { status: 400 },
    );
  }

  // 3. 解析问题
  const body: QuestionRequest = await request.json();
  const question = {
    id: nanoid(),
    content: body.content,
    askedAtStep: report.generation_context?.currentStep || "prepare",
    askedAtPercent: report.generation_context?.currentPercent || 0,
    askedAt: new Date().toISOString(),
  };

  // 4. 追加到生成上下文
  const existingQuestions = report.generation_context?.userQuestions || [];
  await supabase
    .from("synthesis_reports")
    .update({
      generation_context: {
        ...report.generation_context,
        userQuestions: [...existingQuestions, question],
      },
    })
    .eq("id", reportId);

  return NextResponse.json({
    success: true,
    questionId: question.id,
    acknowledgment: `已收到您的问题「${body.content}」，将在后续分析中考虑`,
  });
}
```

#### 6.4.3 UI 组件

**文件**: `src/components/synthesis/question-input.tsx`

```typescript
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageSquare, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface QuestionInputProps {
  reportId: string;
  disabled?: boolean;
  onQuestionSubmit?: (questionId: string) => void;
}

export function QuestionInput({
  reportId,
  disabled,
  onQuestionSubmit,
}: QuestionInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!content.trim()) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/synthesis/${reportId}/question`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });

      const data = await response.json();
      if (data.success) {
        toast.success(data.acknowledgment);
        setContent("");
        setIsOpen(false);
        onQuestionSubmit?.(data.questionId);
      } else {
        toast.error(data.error || "提交失败");
      }
    } catch (error) {
      toast.error("提交问题时发生错误");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        disabled={disabled}
      >
        <MessageSquare className="mr-2 h-4 w-4" />
        问一个问题
      </Button>
    );
  }

  return (
    <div className="flex gap-2 items-center">
      <Input
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="例如：重点关注实际应用案例"
        disabled={isSubmitting}
        className="flex-1"
        onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
      />
      <Button
        onClick={handleSubmit}
        disabled={isSubmitting || !content.trim()}
        size="sm"
      >
        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "提交"}
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setIsOpen(false)}>
        取消
      </Button>
    </div>
  );
}
```

#### 6.4.4 进度组件集成

**文件**: `src/components/synthesis/synthesis-progress.tsx`

**集成位置**: 在取消按钮区域添加提问输入

```typescript
import { QuestionInput } from "./question-input";

// 在 isGenerating 条件块中添加
{isGenerating && (
  <div className="flex justify-between items-center gap-4">
    {/* 新增提问输入 */}
    <QuestionInput
      reportId={reportId}
      disabled={isCancelling}
      onQuestionSubmit={(qId) => {
        console.log("Question submitted:", qId);
      }}
    />

    {/* 原有取消按钮 */}
    <Button
      variant="outline"
      size="sm"
      onClick={handleCancel}
      disabled={isCancelling}
    >
      {/* ... */}
    </Button>
  </div>
)}
```

#### 6.4.5 Prompt 整合

**文件**: `src/lib/ai-skills/skills/thematic-synthesis/synthesis-prompts.ts`

```typescript
import type { SynthesisUserQuestion } from "@/lib/synthesis";

/**
 * 将用户问题整合到 Prompt 中
 */
export function integrateUserQuestions(
  basePrompt: string,
  questions: SynthesisUserQuestion[],
): string {
  if (questions.length === 0) return basePrompt;

  const questionsSection = questions
    .map((q, i) => `${i + 1}. ${q.content}`)
    .join("\n");

  return `${basePrompt}

## 用户关注点

用户在生成过程中提出了以下问题，请在分析中特别关注：

${questionsSection}

请确保综述内容能够回答或涉及上述问题。`;
}
```

---

### 6.5 文件清单汇总

#### 新增文件

| 文件路径                                                       | 功能          | 所属功能 |
| -------------------------------------------------------------- | ------------- | -------- |
| `src/components/synthesis/style-selector.tsx`                  | 风格选择器 UI | S1       |
| `src/components/synthesis/source-selector/folder-picker.tsx`   | 文件夹选择器  | E1       |
| `src/components/synthesis/source-selector/tag-picker.tsx`      | 标签选择器    | E1       |
| `src/components/synthesis/source-selector/manual-selector.tsx` | 手动选择书签  | E1       |
| `src/components/synthesis/source-selector/index.ts`            | 模块导出      | E1       |
| `src/components/synthesis/bookmark-preview-list.tsx`           | 书签预览列表  | E1       |
| `src/components/synthesis/quality-assessment.tsx`              | 质量评估卡片  | E2       |
| `src/components/synthesis/question-input.tsx`                  | 问题输入组件  | S3       |
| `src/components/synthesis/source-bookmarks-section.tsx`        | 来源书签区块  | E4       |
| `src/components/synthesis/blindspot-search-dialog.tsx`         | 盲区搜索弹窗  | E3       |
| `src/lib/ai-agent/tools/synthesis/create-synthesis.tool.ts`    | 创建综述 Tool | S2       |
| `src/lib/ai-agent/tools/synthesis/index.ts`                    | 模块导出      | S2       |
| `src/lib/synthesis/services/quality-assessment.service.ts`     | 质量评估服务  | E2       |
| `src/lib/synthesis/services/synthesis-nlp.service.ts`          | 自然语言服务  | S2       |
| `src/app/api/synthesis/preview/route.ts`                       | 书签预览 API  | E1       |
| `src/app/api/synthesis/assess-quality/route.ts`                | 质量评估 API  | E2       |
| `src/app/api/synthesis/[id]/question/route.ts`                 | 问题提交 API  | S3       |
| `supabase/migrations/YYYYMMDD_add_synthesis_style.sql`         | 数据库迁移    | S1       |

#### 修改文件

| 文件路径                                                           | 改动内容                 | 所属功能 |
| ------------------------------------------------------------------ | ------------------------ | -------- |
| `src/lib/synthesis/types.ts`                                       | 新增类型定义             | S1/S3    |
| `src/lib/ai-skills/skills/thematic-synthesis/synthesis-prompts.ts` | 风格/问题 Prompt         | S1/S3    |
| `src/components/synthesis/synthesis-new-page-client.tsx`           | 集成来源选择器、风格选择 | E1/S1    |
| `src/components/synthesis/synthesis-progress.tsx`                  | 集成问题输入             | S3       |
| `src/components/synthesis/synthesis-detail-page-client.tsx`        | 来源书签、盲区搜索       | E4/E3    |
| `src/lib/ai-agent/personas/inference/intent-rules.ts`              | 新增综述意图规则         | S2       |
| `src/lib/ai-agent/tools/register.ts`                               | 注册新 Tool              | S2       |
| `src/app/api/synthesis/route.ts`                                   | 支持 outputStyle 参数    | S1       |
| `src/app/api/synthesis/[id]/route.ts`                              | 返回来源书签详情         | E4       |

---

## 审核清单

### 问题诊断

- [ ] 核心能力问题是否准确？
- [ ] 交互缺失问题是否完整？
- [ ] 优先级排序是否合理？

### 竞品最佳实践补充

- [ ] S1 综述风格选择设计是否合理？
- [ ] S2 自然语言触发实现方案是否可行？
- [ ] S3 实时提问交互是否流畅？

### 系统集成

- [ ] 现有组件集成点是否清晰？
- [ ] 新增文件与现有结构一致？
- [ ] API 设计符合现有模式？

### 实施计划

- [ ] 阶段划分是否合理？
- [ ] 时间估算是否可接受？（原 6 周 → 8.5 周）
- [ ] 验收标准是否清晰？

### 开发规格

- [ ] 类型定义是否完整？
- [ ] 代码示例是否可直接使用？
- [ ] 测试用例覆盖是否充分？

---

_报告结束 v2.0_
