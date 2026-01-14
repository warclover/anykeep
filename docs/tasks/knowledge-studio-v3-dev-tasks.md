# Knowledge Studio V3 开发任务清单

> **基于 PRD**: v2.1.0
> **创建日期**: 2026-01-07
> **预计工时**: 13 个工作日（2.5 周）
> **状态**: 📋 待开发

---

## 一、任务总览

### 1.1 开发阶段划分

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  Week 1: 核心流程 (Day 1-5)                                         │
│  ├── T1.1 基础架构搭建                                              │
│  ├── T1.2 Step 1 输入组件                                           │
│  ├── T1.3 Step 2 选择组件（默认层）                                  │
│  └── T1.4 Step 3 结果组件                                           │
│                                                                     │
│  Week 2: 高级选项 + 获取功能 (Day 1-5)                               │
│  ├── T2.1 高级选项折叠区                                            │
│  ├── T2.2 蓝图选择器集成                                            │
│  ├── T2.3 Briefing 问答集成                                         │
│  ├── T2.4 大纲编辑器集成                                            │
│  └── T2.5 复制/导出功能                                             │
│                                                                     │
│  Week 3 前半: 完善与上线 (Day 1-3)                                   │
│  ├── T3.1 TTS/一稿多发集成                                          │
│  ├── T3.2 历史记录                                                  │
│  └── T3.3 测试与上线                                                │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.2 V2 组件复用分析

| 组件 | 文件路径 | 复用方式 | 备注 |
|------|----------|----------|------|
| **蓝图选择器** | `v2/blueprint-selector.tsx` | 直接复用 | 14 个蓝图完整保留 |
| **Briefing 向导** | `v2/briefing-wizard.tsx` | 直接复用 | 问答面板 |
| **大纲编辑器** | `v2/outline-editor.tsx` | 直接复用 | 拖拽编辑 |
| **平台风格选择** | `v2/platform-style-selector.tsx` | 直接复用 | 3 种风格 |
| **导出对话框** | `v2/export-result-dialog.tsx` | 直接复用 | MD/TXT/HTML |
| **一稿多发** | `v2/multi-platform-dialog.tsx` | 直接复用 | 平台适配 |
| **输出查看器** | `v2/structured-output-viewer.tsx` | 适配复用 | 需简化 |

| Hook | 文件路径 | 复用方式 |
|------|----------|----------|
| **生成逻辑** | `use-generation.ts` | 直接复用 |
| **风格适配** | `use-adapt-style.ts` | 直接复用 |
| **TTS 播放** | `use-ks-tts-player.ts` | 直接复用 |

---

## 二、详细任务列表

### Week 1: 核心流程

---

#### T1.1 基础架构搭建

**工时**: 0.5 天
**优先级**: P0
**依赖**: 无

**任务描述**:
搭建 V3 模块基础目录结构、类型定义、页面路由。

**技术要点**:
```
src/app/(main)/knowledge-studio/v3/
├── page.tsx                    # 主页面
├── history/page.tsx            # 历史页
└── layout.tsx                  # 布局

src/components/knowledge-studio/v3/
├── index.ts                    # 导出

src/lib/knowledge-studio/v3/
├── types.ts                    # 类型定义
├── constants.ts                # 常量
└── index.ts                    # 导出

src/hooks/knowledge-studio/v3/
├── use-workshop.ts             # 核心状态
└── index.ts                    # 导出
```

**核心类型**:
```typescript
// types.ts
export type OutputType = "article" | "summary" | "digest" | "proposal";
export type ArticleStyle = "wechat" | "xiaohongshu" | "general";

export interface WorkshopInput {
  mode: "materials" | "text";
  materialIds?: string[];
  textContent?: string;
}

export interface AdvancedOptions {
  useBlueprint: boolean;
  blueprintId?: string;
  enableBriefing: boolean;
  briefingAnswers?: Record<string, string>;
  enableOutlineEdit: boolean;
  customOutline?: OutlineNode[];
}

export interface WorkshopConfig {
  outputType: OutputType;
  articleStyle?: ArticleStyle;
  advanced: AdvancedOptions;
}

export interface WorkshopResult {
  id: string;
  content: string;
  wordCount: number;
  outputType: OutputType;
  blueprintId?: string;
  articleStyle?: ArticleStyle;
  createdAt: Date;
}
```

**验收标准**:
- [ ] 目录结构创建完成
- [ ] 类型定义完整且无 TS 错误
- [ ] 页面路由可访问
- [ ] 基础布局渲染正常

---

#### T1.2 Step 1 输入组件

**工时**: 1.5 天
**优先级**: P0
**依赖**: T1.1

**任务描述**:
实现 Step 1 输入组件，支持「素材选择」和「直接输入」两种模式。

**子任务**:

| # | 子任务 | 工时 |
|---|--------|------|
| 1.2.1 | 素材选择器（搜索 + 列表 + 多选） | 0.5 天 |
| 1.2.2 | 文本输入框（粘贴 + 字数统计） | 0.3 天 |
| 1.2.3 | 模式切换（素材/文本 Tab） | 0.2 天 |
| 1.2.4 | 输入验证（非空检查 + 下一步按钮） | 0.3 天 |
| 1.2.5 | 响应式布局（移动端适配） | 0.2 天 |

**文件清单**:
```
src/components/knowledge-studio/v3/
├── step-input.tsx              # Step 1 主组件
├── material-picker.tsx         # 素材选择器（可复用 V2）
└── text-input.tsx              # 文本输入框
```

**组件接口**:
```typescript
interface StepInputProps {
  value: WorkshopInput | null;
  onChange: (input: WorkshopInput) => void;
  onNext: () => void;
  disabled?: boolean;
}
```

**验收标准**:
- [ ] 可从收藏中搜索并选择 2-5 篇素材
- [ ] 可直接粘贴/输入文本，显示字数统计
- [ ] 素材模式和文本模式可切换
- [ ] 输入为空时「下一步」按钮禁用
- [ ] 移动端布局正常

---

#### T1.3 Step 2 选择组件（默认层）

**工时**: 1.5 天
**优先级**: P0
**依赖**: T1.2

**任务描述**:
实现 Step 2 输出类型选择，包含 4 种输出类型卡片和文章风格子选项。

**子任务**:

| # | 子任务 | 工时 |
|---|--------|------|
| 1.3.1 | 输出类型卡片（4 种） | 0.5 天 |
| 1.3.2 | 文章风格选择（3 种，条件显示） | 0.3 天 |
| 1.3.3 | 高级选项入口（折叠区占位） | 0.2 天 |
| 1.3.4 | 生成按钮 + 加载状态 | 0.3 天 |
| 1.3.5 | 响应式布局（2x2 网格适配） | 0.2 天 |

**文件清单**:
```
src/components/knowledge-studio/v3/
├── step-select.tsx             # Step 2 主组件
└── output-card.tsx             # 输出类型卡片
```

**输出类型配置**:
```typescript
const OUTPUT_TYPES: Record<OutputType, {
  label: string;
  icon: LucideIcon;
  description: string;
  useCase: string;
}> = {
  article: {
    label: "文章",
    icon: FileText,
    description: "完整的文章草稿，可直接发布",
    useCase: "适合: 公众号、博客",
  },
  summary: {
    label: "摘要",
    icon: AlignLeft,
    description: "精简的内容概要，快速了解核心",
    useCase: "适合: 快速阅读",
  },
  digest: {
    label: "总结",
    icon: List,
    description: "结构化要点提炼，逻辑清晰易记",
    useCase: "适合: 学习笔记",
  },
  proposal: {
    label: "方案",
    icon: BarChart3,
    description: "专业分析报告，有理有据的建议",
    useCase: "适合: 决策参考",
  },
};
```

**验收标准**:
- [ ] 4 种输出类型卡片清晰展示
- [ ] 选择「文章」后显示风格子选项
- [ ] 「高级选项」折叠入口可见
- [ ] 点击「开始生成」触发生成流程
- [ ] 响应式网格布局正常

---

#### T1.4 Step 3 结果组件

**工时**: 1.5 天
**优先级**: P0
**依赖**: T1.3, AI 生成 API

**任务描述**:
实现 Step 3 结果展示，包含内容预览、统计信息、操作按钮。

**子任务**:

| # | 子任务 | 工时 |
|---|--------|------|
| 1.4.1 | 结果预览区（Markdown 渲染） | 0.5 天 |
| 1.4.2 | 统计信息（字数、阅读时间） | 0.2 天 |
| 1.4.3 | 操作按钮栏（复制/导出/朗读占位） | 0.3 天 |
| 1.4.4 | 重新生成 / 返回按钮 | 0.2 天 |
| 1.4.5 | 生成中状态（流式输出 + 进度） | 0.3 天 |

**文件清单**:
```
src/components/knowledge-studio/v3/
├── step-result.tsx             # Step 3 主组件
├── result-preview.tsx          # 内容预览
└── result-actions.tsx          # 操作按钮栏
```

**验收标准**:
- [ ] 生成内容正确渲染 Markdown
- [ ] 显示字数和预计阅读时间
- [ ] 复制/导出/朗读按钮可见（功能 Week 2 实现）
- [ ] 可点击「重新生成」或「返回」
- [ ] 流式输出时显示实时内容和进度

---

### Week 2: 高级选项 + 获取功能

---

#### T2.1 高级选项折叠区

**工时**: 0.5 天
**优先级**: P0
**依赖**: T1.3

**任务描述**:
实现高级选项折叠区 UI，包含蓝图选择、Briefing 开关、大纲编辑开关。

**文件清单**:
```
src/components/knowledge-studio/v3/
└── advanced-options.tsx        # 高级选项折叠区
```

**组件接口**:
```typescript
interface AdvancedOptionsProps {
  value: AdvancedOptions;
  onChange: (options: AdvancedOptions) => void;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  blueprints: BlueprintListItem[];
  disabled?: boolean;
}
```

**UI 结构**:
```
▼ 高级选项
  ┌─────────────────────────────────────────────────────┐
  │ 🎯 选择专业蓝图（替代默认输出类型）                   │
  │   [蓝图网格...]                                     │
  │                                                     │
  │ 💬 Briefing 问答                         [○ 关闭]  │
  │    让 AI 更懂你的需求                               │
  │                                                     │
  │ 📝 生成后编辑大纲                        [○ 关闭]  │
  │    生成前先看大纲，可调整结构                       │
  └─────────────────────────────────────────────────────┘
```

**验收标准**:
- [ ] 折叠/展开动画流畅（Collapsible）
- [ ] 蓝图网格可点击选择
- [ ] Briefing/大纲编辑开关可切换
- [ ] 选择蓝图后自动禁用默认输出类型

---

#### T2.2 蓝图选择器集成

**工时**: 1 天
**优先级**: P0
**依赖**: T2.1

**任务描述**:
在高级选项中集成 V2 蓝图选择器，支持 14 个专业蓝图选择。

**复用组件**:
- `v2/blueprint-selector.tsx`

**集成要点**:
```typescript
// 在 advanced-options.tsx 中
import { BlueprintSelectorV2 } from "@/components/knowledge-studio/v2";

// 当 useBlueprint = true 时，显示蓝图选择器
{value.useBlueprint && (
  <BlueprintSelectorV2
    blueprints={blueprints}
    value={value.blueprintId}
    onChange={(id) => onChange({ ...value, blueprintId: id })}
    userTier={userTier}
  />
)}
```

**验收标准**:
- [ ] 14 个蓝图正确显示
- [ ] 蓝图分类 Tab 可切换
- [ ] 选择蓝图后，输出类型自动切换到蓝图模式
- [ ] Pro 蓝图显示锁定标识

---

#### T2.3 Briefing 问答集成

**工时**: 1 天
**优先级**: P0
**依赖**: T2.2

**任务描述**:
在开启 Briefing 后，在生成前显示问答面板。

**复用组件**:
- `v2/briefing-wizard.tsx`

**交互流程**:
```
Step 2 选择类型
    ↓ 开启 Briefing
Step 2.1 Briefing 问答（1-3 题）
    ↓ 提交答案
Step 2 返回选择页，携带答案
    ↓ 点击生成
Step 3 结果
```

**集成要点**:
```typescript
// 在 step-select.tsx 中
const [showBriefing, setShowBriefing] = useState(false);

// 点击生成时检查
const handleGenerate = () => {
  if (advanced.enableBriefing && !advanced.briefingAnswers) {
    setShowBriefing(true);
    return;
  }
  onGenerate();
};

// Briefing 面板
{showBriefing && (
  <BriefingWizard
    blueprintName={currentBlueprint?.displayName}
    questions={currentBlueprint?.briefingQuestions}
    onSubmit={(context) => {
      setAdvanced({ ...advanced, briefingAnswers: context.answers });
      setShowBriefing(false);
    }}
    onSkip={() => setShowBriefing(false)}
  />
)}
```

**验收标准**:
- [ ] 开启 Briefing 开关后，生成前弹出问答
- [ ] 问题类型正确渲染（单选/多选/文本）
- [ ] 可跳过 Briefing
- [ ] 答案正确传递到生成 API

---

#### T2.4 大纲编辑器集成

**工时**: 1 天
**优先级**: P0
**依赖**: T2.3

**任务描述**:
在开启大纲编辑后，先生成大纲，用户可拖拽调整后再生成内容。

**复用组件**:
- `v2/outline-editor.tsx`

**交互流程**:
```
Step 2 选择类型
    ↓ 开启大纲编辑
Step 2 点击生成
    ↓ 调用大纲生成 API
Step 2.2 大纲编辑面板
    ↓ 用户调整大纲
Step 2 点击「按此大纲生成」
    ↓
Step 3 结果（基于自定义大纲）
```

**新增 API**:
```typescript
// POST /api/knowledge-studio/v3/outline
interface GenerateOutlineRequest {
  input: WorkshopInput;
  outputType: OutputType;
  blueprintId?: string;
  briefingAnswers?: Record<string, string>;
}

interface GenerateOutlineResponse {
  outline: BlueprintOutline;
}
```

**验收标准**:
- [ ] 开启大纲编辑后，点击生成先获取大纲
- [ ] 大纲可拖拽排序
- [ ] 节点可编辑标题
- [ ] 可添加/删除节点
- [ ] 按自定义大纲生成内容

---

#### T2.5 复制/导出功能

**工时**: 1 天
**优先级**: P0
**依赖**: T1.4

**任务描述**:
实现结果页的复制和导出功能。

**子任务**:

| # | 子任务 | 工时 |
|---|--------|------|
| 2.5.1 | 一键复制（富文本） | 0.4 天 |
| 2.5.2 | 导出对话框集成（MD/TXT/HTML） | 0.3 天 |
| 2.5.3 | 导出 Word（.docx） | 0.3 天 |

**复用组件**:
- `v2/export-result-dialog.tsx`

**富文本复制实现**:
```typescript
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";

async function copyAsRichText(markdown: string) {
  const html = await unified()
    .use(remarkParse)
    .use(remarkRehype)
    .use(rehypeStringify)
    .process(markdown);

  const blob = new Blob([String(html)], { type: "text/html" });
  await navigator.clipboard.write([
    new ClipboardItem({
      "text/html": blob,
      "text/plain": new Blob([markdown], { type: "text/plain" }),
    }),
  ]);
}
```

**验收标准**:
- [ ] 一键复制保留格式，粘贴到公众号格式正确
- [ ] 可导出 Markdown / 纯文本 / HTML
- [ ] 可导出 Word 文档
- [ ] 导出文件名包含时间戳

---

### Week 3 前半: 完善与上线

---

#### T3.1 TTS/一稿多发集成

**工时**: 1 天
**优先级**: P1
**依赖**: T2.5

**任务描述**:
集成 TTS 语音朗读和一稿多发功能。

**复用组件**:
- `v2/multi-platform-dialog.tsx`
- TTS 组件（现有）

**复用 Hook**:
- `use-ks-tts-player.ts`
- `use-adapt-style.ts`

**验收标准**:
- [ ] 点击「朗读」可播放 TTS 语音
- [ ] 点击「适配其他平台」打开一稿多发对话框
- [ ] 可选择目标平台并生成适配内容
- [ ] 适配内容可复制

---

#### T3.2 历史记录

**工时**: 1 天
**优先级**: P1
**依赖**: T1.4

**任务描述**:
实现简单的历史记录列表页面。

**文件清单**:
```
src/app/(main)/knowledge-studio/v3/history/
└── page.tsx

src/components/knowledge-studio/v3/
└── history-list.tsx
```

**数据结构**:
```typescript
interface HistoryItem {
  id: string;
  title: string;           // 提取的标题或前 50 字
  outputType: OutputType;
  blueprintId?: string;
  wordCount: number;
  createdAt: Date;
  preview: string;         // 前 200 字
}
```

**验收标准**:
- [ ] 历史记录按时间倒序展示
- [ ] 显示输出类型、字数、时间
- [ ] 可点击查看完整内容
- [ ] 可删除历史记录

---

#### T3.3 测试与上线

**工时**: 1 天
**优先级**: P0
**依赖**: 全部

**任务描述**:
全流程测试、Bug 修复、上线准备。

**测试清单**:

| # | 测试场景 | 验收标准 |
|---|----------|----------|
| 1 | 默认路径完整流程 | 3 步完成，耗时 < 2 分钟 |
| 2 | 高级路径 + 蓝图 | 蓝图选择后生成正确 |
| 3 | 高级路径 + Briefing | 答案正确影响输出 |
| 4 | 高级路径 + 大纲编辑 | 自定义大纲生效 |
| 5 | 复制富文本 | 粘贴公众号格式正确 |
| 6 | 导出 Word | 文件可正常打开 |
| 7 | TTS 朗读 | 语音播放正常 |
| 8 | 一稿多发 | 适配内容风格正确 |
| 9 | 历史记录 | 可查看/删除 |
| 10 | 移动端 | 全流程可用 |

**上线清单**:
- [ ] TypeScript 类型检查通过
- [ ] ESLint 无错误
- [ ] 生产构建成功
- [ ] 灰度开关配置
- [ ] 监控埋点配置

---

## 三、依赖关系图

```
T1.1 基础架构
  ↓
T1.2 Step 1 输入
  ↓
T1.3 Step 2 选择 ────────────────────────────────────┐
  ↓                                                  │
T1.4 Step 3 结果 ←───────────────────────────────────┤
  ↓                                                  │
  ├── T2.5 复制/导出                                 │
  ↓                                                  │
T2.1 高级选项折叠区 ←────────────────────────────────┘
  ↓
T2.2 蓝图选择器
  ↓
T2.3 Briefing 问答
  ↓
T2.4 大纲编辑器
  ↓
T3.1 TTS/一稿多发
  ↓
T3.2 历史记录
  ↓
T3.3 测试与上线
```

---

## 四、API 端点清单

| 端点 | 方法 | 功能 | 优先级 |
|------|------|------|--------|
| `/api/knowledge-studio/v3/generate` | POST | 生成内容 | P0 |
| `/api/knowledge-studio/v3/outline` | POST | 生成大纲 | P0 |
| `/api/knowledge-studio/v3/history` | GET | 获取历史 | P1 |
| `/api/knowledge-studio/v3/history/[id]` | GET | 获取单条历史 | P1 |
| `/api/knowledge-studio/v3/history/[id]` | DELETE | 删除历史 | P1 |
| `/api/knowledge-studio/v3/export` | POST | 导出文件 | P0 |

---

## 五、风险与缓解

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| V2 组件 Props 不兼容 | 中 | 中 | 创建适配层或调整 Props |
| 流式输出性能问题 | 低 | 中 | 复用 V2 已验证的流式方案 |
| Word 导出兼容性 | 中 | 低 | 使用成熟库 docx，覆盖主流 Office 版本 |
| 富文本复制兼容性 | 中 | 中 | 降级到纯文本复制 |

---

## 六、成功指标

| 指标 | 定义 | 目标 | 测量方式 |
|------|------|------|----------|
| **完成率** | Step 1 → Step 3 | ≥ 90% | 埋点统计 |
| **默认路径耗时** | 从输入到获取结果 | ≤ 2 分钟 | 埋点统计 |
| **高级选项使用率** | 展开高级选项的比例 | 15-25% | 埋点统计 |
| **复制率** | 完成生成后点击复制 | ≥ 70% | 埋点统计 |

---

## 七、附录

### 7.1 任务工时汇总

| 阶段 | 任务数 | 工时 |
|------|--------|------|
| Week 1: 核心流程 | 4 | 5 天 |
| Week 2: 高级选项 | 5 | 5 天 |
| Week 3 前半: 完善 | 3 | 3 天 |
| **总计** | **12** | **13 天** |

### 7.2 每日任务安排建议

| 日期 | 任务 | 交付物 |
|------|------|--------|
| Day 1 | T1.1 + T1.2 开始 | 基础架构 + 素材选择器 |
| Day 2 | T1.2 完成 | Step 1 完整可用 |
| Day 3 | T1.3 开始 | 输出类型卡片 |
| Day 4 | T1.3 完成 | Step 2 默认层完整 |
| Day 5 | T1.4 | Step 3 结果展示 |
| Day 6 | T2.1 + T2.2 开始 | 高级选项 UI + 蓝图 |
| Day 7 | T2.2 完成 | 蓝图选择器集成 |
| Day 8 | T2.3 | Briefing 问答集成 |
| Day 9 | T2.4 | 大纲编辑器集成 |
| Day 10 | T2.5 | 复制/导出功能 |
| Day 11 | T3.1 | TTS/一稿多发 |
| Day 12 | T3.2 | 历史记录 |
| Day 13 | T3.3 | 测试与上线 |

---

## 八、前端页面完整梳理

### 8.1 现有 V2 页面结构

```
/knowledge-studio/
├── page.tsx                         # 旧版入口（重定向）
├── billing/
│   └── page.tsx                     # 计费页面
├── reports/
│   └── page.tsx                     # 报告页面
└── v2/
    ├── page.tsx                     # V2 主页面（蓝图 + 素材选择）
    ├── [blueprintId]/
    │   └── page.tsx                 # 蓝图工作流页面
    └── history/
        └── page.tsx                 # 历史记录页面
```

**V2 页面职责**:

| 页面 | 路由 | 职责 | 核心组件 |
|------|------|------|----------|
| **主页面** | `/knowledge-studio/v2` | 蓝图选择 → 素材选择 | BlueprintSelectorV2, MaterialSelector |
| **工作流页面** | `/knowledge-studio/v2/[blueprintId]` | Briefing → 大纲 → 生成 → 结果 | BriefingWizard, OutlineEditorV2, StructuredOutputViewer |
| **历史页面** | `/knowledge-studio/v2/history` | 历史记录列表 | HistoryPageClient |

### 8.2 V3 目标页面结构

```
/knowledge-studio/
├── page.tsx                         # 旧版入口（保留兼容）
├── billing/                         # 保持不变
├── reports/                         # 保持不变
├── v2/                              # 保留（灰度期间）
└── v3/                              # 新增
    ├── page.tsx                     # V3 主页面（三步流程）
    ├── layout.tsx                   # V3 布局
    └── history/
        └── page.tsx                 # V3 历史记录
```

**V3 页面职责**:

| 页面 | 路由 | 职责 | 核心组件 |
|------|------|------|----------|
| **主页面** | `/knowledge-studio/v3` | 三步流程：输入 → 选择 → 结果 | StepInput, StepSelect, StepResult |
| **历史页面** | `/knowledge-studio/v3/history` | 简化历史列表 | HistoryList |

### 8.3 页面对比与差异分析

#### 8.3.1 主页面对比

| 维度 | V2 现状 | V3 目标 | 变更类型 |
|------|---------|---------|----------|
| **页面数量** | 2 个（主页 + 工作流页） | 1 个（三步单页） | 合并 |
| **步骤数** | 5-6 步（蓝图→素材→Briefing→大纲→生成→结果） | 3 步（输入→选择→结果） | 简化 |
| **蓝图选择** | 必选（Step 1） | 可选（高级选项） | 降级 |
| **Briefing** | 必经（蓝图有问题时） | 可选（高级选项开关） | 降级 |
| **大纲编辑** | 必经 | 可选（高级选项开关） | 降级 |
| **输出类型** | 由蓝图决定 | 4 种默认类型 + 蓝图可选 | 新增 |
| **文章风格** | 平台风格选择器 | 3 种风格（文章类型专属） | 简化 |

#### 8.3.2 组件复用关系

```
V2 组件                              V3 使用方式
─────────────────────────────────    ─────────────────────────────────
BlueprintSelectorV2                  → 高级选项折叠区内复用
BriefingWizard                       → 高级选项开启时弹出
OutlineEditorV2                      → 高级选项开启时显示
PlatformStyleSelector                → 简化为 3 种风格卡片
StructuredOutputViewer               → 适配为 ResultPreview
ExportResultDialog                   → 直接复用
MultiPlatformDialog                  → 直接复用
MaterialSelector                     → 复用到 StepInput
GenerationEstimatePanel              → 删除（V3 不需要）
ScenarioQuickEntry                   → 删除（V3 不需要）
BlueprintRecommendations             → 删除（V3 不需要）
MaterialRecommendations              → 删除（V3 不需要）
FeedbackDialog                       → 延后到 V3.1
DraftVersionPanel                    → 删除（V3 不需要）
CondenseSlider                       → 延后到 V3.1
OutlineTemplateManager               → 延后到 V3.1
ContentDiffViewer                    → 延后到 V3.1
```

### 8.4 页面级开发任务

---

#### T0.1 侧边栏导航更新

**工时**: 0.2 天
**优先级**: P0
**依赖**: 无

**任务描述**:
更新侧边栏导航，添加 V3 入口，配置灰度切换。

**修改文件**:
- `src/components/layout/app-sidebar.tsx`

**修改内容**:
```typescript
// 学习中心导航项
const learningCenterItems: NavItem[] = [
  // ... 其他项
  {
    name: "知识工坊",
    href: "/knowledge-studio/v3",  // 改为 V3 路由
    icon: Sparkles,
    isPro: true,
  },
  // 灰度期间保留 V2 入口
  {
    name: "工坊 Beta",
    href: "/knowledge-studio/v2",
    icon: FlaskConical,
    isPro: true,
  },
];
```

**验收标准**:
- [ ] 侧边栏显示「知识工坊」指向 V3
- [ ] 灰度期间「工坊 Beta」指向 V2
- [ ] 图标和样式一致

---

#### T0.2 V3 页面布局

**工时**: 0.3 天
**优先级**: P0
**依赖**: T1.1

**任务描述**:
创建 V3 专属布局，包含页面标题、步骤指示器容器。

**新增文件**:
- `src/app/(main)/knowledge-studio/v3/layout.tsx`

**布局结构**:
```tsx
export default function KnowledgeStudioV3Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="container max-w-4xl py-8 space-y-6">
      {/* 页面标题 */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">知识工坊</h1>
        <p className="text-muted-foreground">
          三步出稿，你的专家秘书
        </p>
      </div>

      {/* 主内容 */}
      {children}
    </div>
  );
}
```

**验收标准**:
- [ ] 布局居中，最大宽度 4xl
- [ ] 标题和副标题正确显示
- [ ] 子页面正确嵌套

---

#### T0.3 V3 主页面容器

**工时**: 0.5 天
**优先级**: P0
**依赖**: T0.2

**任务描述**:
创建 V3 主页面，集成三步流程组件。

**新增文件**:
- `src/app/(main)/knowledge-studio/v3/page.tsx`
- `src/app/(main)/knowledge-studio/v3/workshop-client.tsx`

**页面结构**:
```tsx
// page.tsx
export const metadata = {
  title: "知识工坊 | AnyKeep",
  description: "三步出稿，你的专家秘书",
};

export default function KnowledgeStudioV3Page() {
  return (
    <Suspense fallback={<WorkshopSkeleton />}>
      <WorkshopClient />
    </Suspense>
  );
}

// workshop-client.tsx
export function WorkshopClient() {
  const {
    step,
    input,
    config,
    result,
    isGenerating,
    // ... 其他状态
  } = useWorkshop();

  return (
    <div className="space-y-8">
      {/* 步骤指示器 */}
      <StepIndicator currentStep={step} />

      {/* 步骤内容 */}
      <AnimatePresence mode="wait">
        {step === 1 && <StepInput ... />}
        {step === 2 && <StepSelect ... />}
        {step === 3 && <StepResult ... />}
      </AnimatePresence>
    </div>
  );
}
```

**验收标准**:
- [ ] 页面路由可访问
- [ ] 三步切换动画流畅
- [ ] Suspense 骨架屏正常显示

---

#### T0.4 步骤指示器组件

**工时**: 0.3 天
**优先级**: P0
**依赖**: T0.3

**任务描述**:
创建三步流程的步骤指示器。

**新增文件**:
- `src/components/knowledge-studio/v3/step-indicator.tsx`

**组件设计**:
```tsx
interface StepIndicatorProps {
  currentStep: 1 | 2 | 3;
  completedSteps?: number[];
}

const STEPS = [
  { step: 1, label: "输入内容", icon: FileInput },
  { step: 2, label: "选择类型", icon: Sparkles },
  { step: 3, label: "获取草稿", icon: FileCheck },
];
```

**UI 样式**:
```
  ○─────────○─────────○
  输入内容    选择类型    获取草稿

  ●─────────○─────────○  (Step 1 激活)
  ✓─────────●─────────○  (Step 2 激活，Step 1 完成)
```

**验收标准**:
- [ ] 当前步骤高亮
- [ ] 已完成步骤显示勾选
- [ ] 连接线颜色正确
- [ ] 移动端布局正常

---

### 8.5 组件级开发任务

---

#### T0.5 V3 组件目录初始化

**工时**: 0.2 天
**优先级**: P0
**依赖**: T1.1

**任务描述**:
创建 V3 组件目录结构和导出索引。

**目录结构**:
```
src/components/knowledge-studio/v3/
├── index.ts                    # 导出索引
├── step-indicator.tsx          # 步骤指示器
├── step-input.tsx              # Step 1 输入
├── step-select.tsx             # Step 2 选择
├── step-result.tsx             # Step 3 结果
├── output-card.tsx             # 输出类型卡片
├── advanced-options.tsx        # 高级选项折叠区
├── text-input.tsx              # 文本输入框
├── result-preview.tsx          # 结果预览
├── result-actions.tsx          # 结果操作栏
└── history-list.tsx            # 历史列表
```

**导出索引**:
```typescript
// index.ts
export { StepIndicator } from "./step-indicator";
export { StepInput } from "./step-input";
export { StepSelect } from "./step-select";
export { StepResult } from "./step-result";
export { OutputCard } from "./output-card";
export { AdvancedOptions } from "./advanced-options";
export { TextInput } from "./text-input";
export { ResultPreview } from "./result-preview";
export { ResultActions } from "./result-actions";
export { HistoryList } from "./history-list";
```

**验收标准**:
- [ ] 目录结构创建完成
- [ ] 导出索引无 TS 错误
- [ ] 组件占位符可导入

---

### 8.6 Hook 级开发任务

---

#### T0.6 useWorkshop 核心 Hook

**工时**: 0.5 天
**优先级**: P0
**依赖**: T1.1

**任务描述**:
创建 V3 核心状态管理 Hook。

**新增文件**:
- `src/hooks/knowledge-studio/v3/use-workshop.ts`
- `src/hooks/knowledge-studio/v3/index.ts`

**Hook 接口**:
```typescript
interface UseWorkshopReturn {
  // 步骤状态
  step: 1 | 2 | 3;
  goToStep: (step: 1 | 2 | 3) => void;
  nextStep: () => void;
  prevStep: () => void;

  // 输入状态
  input: WorkshopInput | null;
  setInput: (input: WorkshopInput) => void;

  // 配置状态
  config: WorkshopConfig;
  setConfig: (config: WorkshopConfig) => void;

  // 高级选项
  showAdvanced: boolean;
  toggleAdvanced: () => void;
  advanced: AdvancedOptions;
  setAdvanced: (options: AdvancedOptions) => void;

  // 生成状态
  isGenerating: boolean;
  progress: GenerationProgress;
  result: WorkshopResult | null;

  // 操作
  generate: () => Promise<void>;
  regenerate: () => Promise<void>;
  reset: () => void;
}
```

**验收标准**:
- [ ] 步骤切换正常
- [ ] 状态持久化到 sessionStorage
- [ ] 生成流程可触发
- [ ] reset 清空所有状态

---

#### T0.7 useAdvancedOptions Hook

**工时**: 0.3 天
**优先级**: P0
**依赖**: T0.6

**任务描述**:
创建高级选项状态管理 Hook。

**新增文件**:
- `src/hooks/knowledge-studio/v3/use-advanced-options.ts`

**Hook 接口**:
```typescript
interface UseAdvancedOptionsReturn {
  // 展开状态
  expanded: boolean;
  setExpanded: (expanded: boolean) => void;
  toggle: () => void;

  // 选项状态
  options: AdvancedOptions;
  setOptions: (options: AdvancedOptions) => void;

  // 快捷方法
  enableBlueprint: (blueprintId: string) => void;
  disableBlueprint: () => void;
  toggleBriefing: () => void;
  toggleOutlineEdit: () => void;

  // 验证
  isValid: boolean;
  validationErrors: string[];
}
```

**验收标准**:
- [ ] 展开/折叠状态正确
- [ ] 蓝图选择后输出类型自动切换
- [ ] Briefing/大纲开关独立控制
- [ ] 验证逻辑正确

---

### 8.7 API 路由开发任务

---

#### T0.8 V3 生成 API

**工时**: 0.5 天
**优先级**: P0
**依赖**: T1.1

**任务描述**:
创建 V3 内容生成 API，支持默认路径和高级路径。

**新增文件**:
- `src/app/api/knowledge-studio/v3/generate/route.ts`

**API 设计**:
```typescript
// POST /api/knowledge-studio/v3/generate
interface GenerateRequest {
  input: WorkshopInput;
  outputType: OutputType;
  articleStyle?: ArticleStyle;

  // 高级选项
  blueprintId?: string;
  briefingAnswers?: Record<string, string>;
  customOutline?: OutlineNode[];
}

interface GenerateResponse {
  // SSE 流式响应
  type: "progress" | "content" | "done" | "error";
  data: {
    step?: string;
    percent?: number;
    content?: string;
    result?: WorkshopResult;
    error?: string;
  };
}
```

**复用逻辑**:
- 复用 V2 的 Prompt 模板
- 复用 V2 的流式输出逻辑
- 复用 V2 的蓝图配置

**验收标准**:
- [ ] 默认路径（4 种输出类型）生成正确
- [ ] 高级路径（蓝图）生成正确
- [ ] 流式输出正常
- [ ] 错误处理完善

---

#### T0.9 V3 大纲 API

**工时**: 0.3 天
**优先级**: P0
**依赖**: T0.8

**任务描述**:
创建 V3 大纲生成 API。

**新增文件**:
- `src/app/api/knowledge-studio/v3/outline/route.ts`

**API 设计**:
```typescript
// POST /api/knowledge-studio/v3/outline
interface OutlineRequest {
  input: WorkshopInput;
  outputType: OutputType;
  blueprintId?: string;
  briefingAnswers?: Record<string, string>;
}

interface OutlineResponse {
  outline: BlueprintOutline;
}
```

**验收标准**:
- [ ] 大纲结构正确
- [ ] 节点层级正确
- [ ] 与生成 API 大纲格式兼容

---

### 8.8 页面任务汇总

| 任务 ID | 任务名称 | 工时 | 优先级 | 依赖 |
|---------|----------|------|--------|------|
| T0.1 | 侧边栏导航更新 | 0.2 天 | P0 | 无 |
| T0.2 | V3 页面布局 | 0.3 天 | P0 | T1.1 |
| T0.3 | V3 主页面容器 | 0.5 天 | P0 | T0.2 |
| T0.4 | 步骤指示器组件 | 0.3 天 | P0 | T0.3 |
| T0.5 | V3 组件目录初始化 | 0.2 天 | P0 | T1.1 |
| T0.6 | useWorkshop 核心 Hook | 0.5 天 | P0 | T1.1 |
| T0.7 | useAdvancedOptions Hook | 0.3 天 | P0 | T0.6 |
| T0.8 | V3 生成 API | 0.5 天 | P0 | T1.1 |
| T0.9 | V3 大纲 API | 0.3 天 | P0 | T0.8 |

**页面任务总工时**: 3.1 天

---

### 8.9 更新后的任务依赖图

```
T0.1 侧边栏更新 ─────────────────────────────────────────────────┐
                                                                  │
T1.1 基础架构 ───────────────────────────────────────────────────┤
  ├── T0.2 页面布局                                               │
  │     └── T0.3 主页面容器                                       │
  │           └── T0.4 步骤指示器                                 │
  ├── T0.5 组件目录                                               │
  ├── T0.6 useWorkshop ─────┐                                     │
  │     └── T0.7 useAdvanced │                                    │
  └── T0.8 生成 API ─────────┘                                    │
        └── T0.9 大纲 API                                         │
                                                                  │
  ↓                                                               │
T1.2 Step 1 输入 ←────────────────────────────────────────────────┤
  ↓                                                               │
T1.3 Step 2 选择 ────────────────────────────────────────────────┤
  ↓                                                               │
T1.4 Step 3 结果 ←───────────────────────────────────────────────┤
  ↓                                                               │
T2.1 高级选项 ←──────────────────────────────────────────────────┘
  ↓
T2.2 蓝图 → T2.3 Briefing → T2.4 大纲 → T2.5 复制/导出
  ↓
T3.1 TTS/一稿多发 → T3.2 历史 → T3.3 测试上线
```

---

### 8.10 更新后的工时汇总

| 阶段 | 任务数 | 工时 |
|------|--------|------|
| **Week 0: 页面基础** | 9 | 3.1 天 |
| Week 1: 核心流程 | 4 | 5 天 |
| Week 2: 高级选项 | 5 | 5 天 |
| Week 3 前半: 完善 | 3 | 3 天 |
| **总计** | **21** | **16.1 天** |

> **注**: 页面基础任务 (T0.x) 可与 Week 1 任务并行执行，不影响总体周期。

---

**文档结束**

*此任务清单由 PM John 于 2026-01-07 创建*
*基于 PRD v2.1.0 - 渐进式复杂度设计*
*更新：增加前端页面完整梳理（8.1-8.10）*
