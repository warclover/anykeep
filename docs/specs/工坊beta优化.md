# Knowledge Studio Beta 优化方案

> 版本：v1.2
> 日期：2026-01-06
> 状态：Phase 1-3 已完成

## 实施状态

### Phase 1 ✅ 已完成 (2026-01-06)

| 任务                          | 状态 | 备注                                            |
| ----------------------------- | ---- | ----------------------------------------------- |
| P0-1: platformStyle 会话缓存  | ✅   | 添加 PLATFORM_STYLE 到 CACHE_KEYS，缓存用户选择 |
| P0-2: 生成记录 platform_style | ✅   | 添加 platform_style 到 generation_metadata      |

**修改文件**:

- `blueprint-workflow-client.tsx`: 添加 platformStyle 缓存逻辑
- `generate/route.ts`: 添加 platform_style 到报告元数据

### Phase 2 ✅ 已完成 (2026-01-06)

| 任务                 | 状态 | 备注                                                    |
| -------------------- | ---- | ------------------------------------------------------- |
| 2.1 数据库迁移       | ✅   | 创建 ks_usage_stats, ks_blueprint_popularity 表         |
| 2.2 蓝图推荐 API     | ✅   | GET /api/knowledge-studio/v2/recommendations/blueprints |
| 2.3 素材推荐 API     | ✅   | POST /api/knowledge-studio/v2/recommendations/materials |
| 2.4 使用记录 API     | ✅   | POST /api/knowledge-studio/v2/usage/record              |
| 2.5 场景快速入口组件 | ✅   | ScenarioQuickEntry 组件                                 |
| 2.6 蓝图推荐组件     | ✅   | BlueprintRecommendations 组件                           |
| 2.7 主页面集成       | ✅   | knowledge-studio-v2-page-client.tsx 集成                |

**快速改进**:

- ✅ 生成取消按钮（handleCancelGeneration 回调 + UI）
- ✅ 分段复制功能（CopyButton 组件 + SectionsRenderer 增强）
- ✅ 使用统计记录（成功/失败/取消 三种状态）

**新建文件**:

- `supabase/migrations/20260106000001_create_ks_usage_stats.sql`
- `src/app/api/knowledge-studio/v2/recommendations/blueprints/route.ts`
- `src/app/api/knowledge-studio/v2/recommendations/materials/route.ts`
- `src/app/api/knowledge-studio/v2/usage/record/route.ts`
- `src/components/knowledge-studio/v2/scenario-quick-entry.tsx`
- `src/components/knowledge-studio/v2/blueprint-recommendations.tsx`

**修改文件**:

- `src/components/knowledge-studio/v2/index.ts`: 导出新组件
- `src/components/knowledge-studio/v2/structured-output-viewer.tsx`: 添加复制功能
- `src/app/(main)/knowledge-studio/v2/knowledge-studio-v2-page-client.tsx`: 集成新组件
- `src/app/(main)/knowledge-studio/v2/[blueprintId]/blueprint-workflow-client.tsx`: 取消按钮 + 使用统计

### Phase 3 ✅ 已完成 (2026-01-06)

| 任务               | 状态 | 备注                                                        |
| ------------------ | ---- | ----------------------------------------------------------- |
| 3.1 平台风格选择器 | ✅   | PlatformStyleSelector 组件，支持 wechat/xiaohongshu/general |
| 3.2 一键精简服务   | ✅   | condense-service.ts 已存在，支持流式精简                    |
| 3.3 精简 API 端点  | ✅   | POST /api/knowledge-studio/v2/condense (SSE)                |
| 3.4 结果页精简按钮 | ✅   | 800/1500/2000 字三档精简选项                                |

**新建文件**:

- `src/app/api/knowledge-studio/v2/condense/route.ts`: 精简 API 端点（SSE 流式响应）

**修改文件**:

- `src/app/(main)/knowledge-studio/v2/[blueprintId]/blueprint-workflow-client.tsx`:
  - 添加 handleCondense 回调函数
  - 添加精简操作栏 UI（800/1500/2000 字三档）
  - 添加精简后内容展示卡片
  - 添加精简进度条
  - 更新 cleanup useEffect 清理 condenseAbortRef

**精简功能特性**:

- 支持三档精简：800 字（小红书）、1500 字（公众号短文）、2000 字（标准）
- SSE 流式返回精简内容
- 实时进度显示
- 精简后可切换查看原文

### Phase 4: 进行中

| 任务                 | 状态 | 备注                                        |
| -------------------- | ---- | ------------------------------------------- |
| 4.1 草稿版本管理器   | ⏳   | DraftVersionManager 类，最多保留 3 个版本   |
| 4.2 反馈收集服务     | ⏳   | FeedbackCollector 服务，支持评分+文本反馈   |
| 4.3 迭代 API 端点    | ⏳   | POST /api/knowledge-studio/v2/iterate (SSE) |
| 4.4 版本历史面板组件 | ⏳   | DraftVersionPanel 组件                      |
| 4.5 反馈对话框组件   | ⏳   | FeedbackDialog 组件                         |
| 4.6 工作流客户端集成 | ⏳   | blueprint-workflow-client.tsx 集成          |

---

## 背景

Knowledge Studio v2（工坊 Beta）当前存在以下体验问题：

1. 输入/输出限制不透明，用户不知道上限
2. 预估时间静态，用户盲目等待
3. 进度条不够准确（已修复）
4. 未针对公众号/小红书等主要使用场景优化

## 目标用户场景

- **主要场景**：生成公众号文章、小红书笔记
- **次要场景**：深度长文（专业用户）
- **不考虑**：上万字论文式文章

---

## Phase 1: 快速优化（P0）

### 1.1 素材数量限制优化

**当前状态**：

- 最少 2 篇，最多 5 篇
- 无推荐提示，用户可能堆砌素材

**优化方案**：

```typescript
// src/lib/knowledge-studio/v2/constants.ts

/** 素材数量限制 */
export const MATERIAL_LIMITS = {
  /** 最少素材数 */
  MIN: 2,
  /** 推荐上限（超过显示提示） */
  RECOMMENDED_MAX: 3,
  /** 硬上限 */
  HARD_MAX: 5,
  /** 警告阈值（超过显示黄色警告） */
  WARNING_THRESHOLD: 4,
} as const;

/** 素材选择器 UI 文案 */
export const MATERIAL_SELECTOR_TEXT = {
  LABEL: "精选 2-3 篇核心素材（最多 5 篇）",
  HINT: "素材越精准，生成质量越高",
  WARNING_TOO_MANY: "素材过多可能导致内容发散，建议精选 2-3 篇核心素材",
} as const;
```

**UI 变更**：

- 素材选择器标题改为：「精选 2-3 篇核心素材（最多 5 篇）」
- 选择 4+ 篇时显示黄色警告提示
- 每篇素材显示字数标签

**涉及文件**：

- `src/lib/knowledge-studio/v2/constants.ts`
- `src/components/knowledge-studio/v2/material-selector.tsx`（如有）
- `src/components/knowledge-studio/v2/briefing-wizard.tsx`

---

### 1.2 输出字数限制调整

**当前状态**：

- 大纲生成：maxOutputTokens = 4096
- 内容生成：maxOutputTokens = 8192
- 无明确字数限制，可能生成过长内容

**优化方案**：

```typescript
// src/lib/knowledge-studio/v2/constants.ts

/** 输出长度模式配置 */
export const LENGTH_MODE_CONFIG = {
  short: {
    label: "简洁",
    description: "适合小红书、公众号短文",
    minWords: 1200,
    maxWords: 1800,
    maxOutputTokens: 3000,
    visible: true,
  },
  medium: {
    label: "标准",
    description: "适合公众号标准文章",
    minWords: 2000,
    maxWords: 2800,
    maxOutputTokens: 5000,
    visible: true,
  },
  long: {
    label: "详细",
    description: "适合深度长文（专业用户）",
    minWords: 3500,
    maxWords: 5000,
    maxOutputTokens: 8192,
    visible: false, // 默认隐藏，需展开高级选项
  },
} as const;

export type LengthMode = keyof typeof LENGTH_MODE_CONFIG;
```

**Prompt 调整**：
在 content.prompt.ts 中增加字数约束指令：

```typescript
// 根据 targetLength 注入字数限制
const wordLimitInstruction = {
  short: "请控制总字数在 1200-1800 字之间，语言简洁有力。",
  medium: "请控制总字数在 2000-2800 字之间，内容充实但不冗长。",
  long: "请控制总字数在 3500-5000 字之间，可以深入展开论述。",
};
```

**涉及文件**：

- `src/lib/knowledge-studio/v2/constants.ts`
- `src/lib/knowledge-studio/blueprint/prompts/content.prompt.ts`
- `src/lib/knowledge-studio/blueprint/content-generator.ts`

---

## Phase 2: 体验增强（P1）

### 2.1 生成前预估信息展示

在点击「开始生成」前，显示预估面板：

```
┌─────────────────────────────────────────┐
│  📊 生成预估                             │
├─────────────────────────────────────────┤
│  素材：3 篇                              │
│  模式：标准（约 2000-2800 字）            │
│  预计时间：约 1-2 分钟                    │
│                                         │
│  💡 生成过程中请勿关闭页面                │
└─────────────────────────────────────────┘
```

**涉及文件**：

- `src/components/knowledge-studio/v2/generation-estimate-panel.tsx`（新建）
- `src/app/(main)/knowledge-studio/v2/[blueprintId]/blueprint-workflow-client.tsx`

---

### 2.2 大纲阶段预估字数

在大纲确认步骤显示：

```
大纲结构（共 5 个章节）
预估生成字数：约 2,400 字

💡 删减章节可缩短最终字数
```

**实现方式**：

```typescript
// 根据大纲章节数和 targetLength 估算字数
function estimateOutputWords(
  outline: BlueprintOutline,
  targetLength: LengthMode,
): { min: number; max: number } {
  const sectionCount = countSections(outline);
  const config = LENGTH_MODE_CONFIG[targetLength];

  // 每章节约 300-500 字
  const perSectionWords = {
    short: 300,
    medium: 450,
    long: 600,
  };

  const estimated = sectionCount * perSectionWords[targetLength];
  return {
    min: Math.max(config.minWords, estimated * 0.8),
    max: Math.min(config.maxWords, estimated * 1.2),
  };
}
```

**涉及文件**：

- `src/lib/knowledge-studio/v2/time-estimator.ts`（新建）
- `src/components/knowledge-studio/v2/outline-editor-v2.tsx`

---

### 2.3 进度条增强

生成过程中显示更详细信息：

```
┌─────────────────────────────────────────┐
│  ⏳ 正在生成内容...                       │
├─────────────────────────────────────────┤
│  ████████████░░░░░░░░░░░  58%           │
│                                         │
│  已生成：1,847 字                        │
│  已用时间：48 秒                          │
└─────────────────────────────────────────┘
```

**涉及文件**：

- `src/app/(main)/knowledge-studio/v2/[blueprintId]/blueprint-workflow-client.tsx`

---

## Phase 3: 平台适配（P2）

### 3.1 输出风格选项

新增平台风格选择：

| 风格       | 特点                         | 字数范围     |
| ---------- | ---------------------------- | ------------ |
| 公众号风格 | 标题吸睛、分段清晰、适当留白 | 1500-3000 字 |
| 小红书风格 | 短段落、emoji 点缀、口语化   | 600-1500 字  |
| 通用风格   | 正式书面语、结构完整         | 2000-5000 字 |

**涉及文件**：

- `src/lib/knowledge-studio/v2/constants.ts`
- `src/lib/knowledge-studio/blueprint/prompts/content.prompt.ts`
- `src/components/knowledge-studio/v2/briefing-wizard.tsx`

---

### 3.2 生成后「一键精简」

草稿生成完成后提供精简选项：

```
草稿已生成（2,847 字）

[📋 复制全文]  [✂️ 精简到 1500 字]  [📤 导出]
```

**涉及文件**：

- `src/lib/knowledge-studio/refinement/condense-service.ts`（新建）
- `src/components/knowledge-studio/report-editor.tsx`

---

## 实施计划

| 阶段        | 任务                           | 预估工时 | 优先级 |
| ----------- | ------------------------------ | -------- | ------ |
| **Phase 1** |                                |          |        |
| 1.1         | 素材数量限制常量 + UI 文案     | 0.5h     | P0     |
| 1.2         | 输出字数限制常量 + Prompt 调整 | 1h       | P0     |
| **Phase 2** |                                |          |        |
| 2.1         | 生成前预估信息面板             | 1h       | P1     |
| 2.2         | 大纲阶段预估字数显示           | 1h       | P1     |
| 2.3         | 进度条显示已生成字数           | 0.5h     | P1     |
| **Phase 3** |                                |          |        |
| 3.1         | 平台风格选项                   | 2h       | P2     |
| 3.2         | 一键精简功能                   | 3h       | P2     |

**总计**：约 9 小时

---

## 验收标准

### Phase 1 验收

- [ ] 素材选择器显示「精选 2-3 篇核心素材（最多 5 篇）」
- [ ] 选择 4+ 篇素材时显示黄色警告
- [ ] 简洁模式生成内容 ≤ 2000 字
- [ ] 标准模式生成内容 ≤ 3000 字

### Phase 2 验收

- [ ] 生成前显示预估时间和字数范围
- [ ] 大纲确认步骤显示预估字数
- [ ] 进度条显示已生成字数

### Phase 3 验收

- [ ] 可选择公众号/小红书风格
- [ ] 生成后可一键精简内容

---

## 关联文件清单

| 文件路径                                                                         | 变更类型 |
| -------------------------------------------------------------------------------- | -------- |
| `src/lib/knowledge-studio/v2/constants.ts`                                       | 修改     |
| `src/lib/knowledge-studio/blueprint/prompts/content.prompt.ts`                   | 修改     |
| `src/lib/knowledge-studio/blueprint/content-generator.ts`                        | 修改     |
| `src/components/knowledge-studio/v2/briefing-wizard.tsx`                         | 修改     |
| `src/components/knowledge-studio/v2/outline-editor-v2.tsx`                       | 修改     |
| `src/app/(main)/knowledge-studio/v2/[blueprintId]/blueprint-workflow-client.tsx` | 修改     |
| `src/lib/knowledge-studio/v2/time-estimator.ts`                                  | 新建     |
| `src/components/knowledge-studio/v2/generation-estimate-panel.tsx`               | 新建     |

---

## Phase 4: 迭代支持（P3）

### 4.1 草稿版本管理器

基于现有 `OutlineVersionManager` 模式，创建草稿版本管理器：

```typescript
// src/lib/knowledge-studio/iteration/draft-version-manager.ts

/** 最大保留版本数 */
export const MAX_DRAFT_VERSIONS = 3;

/**
 * 草稿版本快照
 */
export interface DraftVersion {
  /** 版本 ID */
  id: string;
  /** 版本号 */
  version: number;
  /** 创建时间戳 */
  timestamp: number;
  /** 草稿内容 */
  content: string;
  /** 字数 */
  wordCount: number;
  /** 来源：initial（首次生成）| iteration（迭代）| condense（精简） */
  source: "initial" | "iteration" | "condense";
  /** 用户反馈（如果有） */
  feedback?: DraftFeedback;
}

/**
 * 用户反馈
 */
export interface DraftFeedback {
  /** 评分 1-5 */
  rating: number;
  /** 反馈类型 */
  type: "too_long" | "too_short" | "off_topic" | "style_issue" | "other";
  /** 具体反馈文本 */
  comment?: string;
}
```

### 4.2 反馈收集服务

```typescript
// src/lib/knowledge-studio/iteration/feedback-collector.ts

/**
 * 反馈类型配置
 */
export const FEEDBACK_TYPES = {
  too_long: { label: "内容太长", icon: "📏", action: "condense" },
  too_short: { label: "内容太短", icon: "📝", action: "expand" },
  off_topic: { label: "偏离主题", icon: "🎯", action: "refocus" },
  style_issue: { label: "风格不符", icon: "🎨", action: "restyle" },
  other: { label: "其他问题", icon: "💬", action: "custom" },
} as const;

export type FeedbackType = keyof typeof FEEDBACK_TYPES;
```

### 4.3 迭代 API 端点

```typescript
// POST /api/knowledge-studio/v2/iterate
// 基于反馈重新生成内容

interface IterateRequest {
  /** 原始内容 */
  originalContent: string;
  /** 用户反馈 */
  feedback: DraftFeedback;
  /** 蓝图 ID */
  blueprintId: string;
  /** 平台风格 */
  platformStyle?: PlatformStyle;
  /** 大纲（保持结构一致） */
  outline?: BlueprintOutline;
}

// SSE 响应格式与 generate API 一致
```

### 4.4 版本历史面板组件

```
┌─────────────────────────────────────────┐
│  📚 版本历史                             │
├─────────────────────────────────────────┤
│  ✅ v3 - 迭代优化版 (当前)     2,156 字   │
│     来自反馈：内容太长                    │
│                                         │
│  ○ v2 - 精简版               1,847 字    │
│     精简到 2000 字                       │
│                                         │
│  ○ v1 - 初始版               2,847 字    │
│     首次生成                            │
├─────────────────────────────────────────┤
│  [恢复到此版本]  [对比版本]               │
└─────────────────────────────────────────┘
```

### 4.5 反馈对话框组件

```
┌─────────────────────────────────────────┐
│  📝 内容反馈                             │
├─────────────────────────────────────────┤
│  请评价生成质量：                         │
│  ⭐⭐⭐⭐☆  (4/5)                        │
│                                         │
│  主要问题：                              │
│  [📏 太长] [📝 太短] [🎯 偏题] [🎨 风格]   │
│                                         │
│  补充说明（可选）：                       │
│  ┌─────────────────────────────────┐    │
│  │ 请加强第二部分的论证...          │    │
│  └─────────────────────────────────┘    │
│                                         │
│  [取消]            [🔄 基于反馈重新生成]   │
└─────────────────────────────────────────┘
```

### 4.6 工作流集成

结果页新增操作栏：

```
草稿已生成（2,847 字）

[📋 复制] [✂️ 精简] [📝 反馈优化] [📚 版本历史] [📤 导出]
```

### 涉及文件

| 文件路径                                                                         | 变更类型 |
| -------------------------------------------------------------------------------- | -------- |
| `src/lib/knowledge-studio/iteration/types.ts`                                    | 新建     |
| `src/lib/knowledge-studio/iteration/draft-version-manager.ts`                    | 新建     |
| `src/lib/knowledge-studio/iteration/feedback-collector.ts`                       | 新建     |
| `src/lib/knowledge-studio/iteration/index.ts`                                    | 新建     |
| `src/app/api/knowledge-studio/v2/iterate/route.ts`                               | 新建     |
| `src/components/knowledge-studio/v2/draft-version-panel.tsx`                     | 新建     |
| `src/components/knowledge-studio/v2/feedback-dialog.tsx`                         | 新建     |
| `src/components/knowledge-studio/v2/index.ts`                                    | 修改     |
| `src/app/(main)/knowledge-studio/v2/[blueprintId]/blueprint-workflow-client.tsx` | 修改     |

### 验收标准

- [ ] 草稿生成后可保存版本（最多 3 个）
- [ ] 可查看版本历史并恢复
- [ ] 可提交反馈（评分 + 类型 + 文本）
- [ ] 基于反馈重新生成内容
- [ ] 迭代后自动保存新版本
