# PRD: AnyKeep 5.0 - 研究助理升级计划

**版本:** V1.3
**文档所有者:** Product Management (PM Agent)
**创建日期:** 2025-12-31
**最后更新:** 2025-12-31 (F10 降至 P2，移至 Q3)
**目标受众:** 产品设计、研发团队、产品决策层

---

## 📑 文档导航

1. [战略背景与愿景](#1-战略背景与愿景)
2. [竞品分析与定位](#2-竞品分析与定位)
3. [功能升级清单](#3-功能升级清单)
4. [模块详细设计](#4-模块详细设计)
5. [架构融合方案](#5-架构融合方案)
6. [优先级与路线图](#6-优先级与路线图)
7. [风险与边界](#7-风险与边界)

---

## 1. 战略背景与愿景

### 1.1 核心愿景转型

> **一句话愿景转变：**
>
> AnyKeep 不应该只是你的"外部硬盘"（只负责存），而应该是你的**"研究助理"**——它记得你的研究方向，并在你遗忘时轻轻拍一下你的肩膀。

### 1.2 战略定位澄清

| 维度         | Get 笔记（竞品）                    | AnyKeep（我们）                              |
| ------------ | ----------------------------------- | -------------------------------------------- |
| **定位**     | "学习桌" - 深度阅读、做笔记、画重点 | "传送门 + 第二大脑皮层" - 快速收藏、智能索引 |
| **用户假设** | 用户打开App是为了深度阅读           | 用户很忙，没空读，只想先存下来               |
| **AI目标**   | 帮用户把书读薄                      | 帮用户建立索引和唤醒记忆                     |
| **核心体验** | 沉浸式阅读 + 高亮标注               | 零整理压力 + 语义检索                        |

### 1.3 知识消化过程定位

```
阶段 1: 吞噬 (Ingest)     ← AnyKeep 主战场 (极速、无压力、全格式)
阶段 2: 咀嚼 (Digest)     ← AnyKeep 边界 (只做辅助，不做重度阅读器)
阶段 3: 内化 (Synthesize) ← AnyKeep 出口 (作为数据源，同步给 Obsidian/Notion)
```

### 1.4 战略红线 🚨

**AnyKeep 绝对不做：**

| 禁止功能     | 原因                 | 替代方案                     |
| ------------ | -------------------- | ---------------------------- |
| 富文本编辑器 | 进入 Notion 死亡赛道 | 保持轻量，提供 Markdown 导出 |
| 沉浸式阅读器 | 进入 Get 笔记赛道    | Deep Link 跳转原平台         |
| 双向链接笔记 | 进入 Obsidian 赛道   | 作为数据源同步到 Obsidian    |
| 思维导图编辑 | 增加复杂度           | 知识图谱可视化（只读）       |

---

## 2. 竞品分析与定位

### 2.1 Get 笔记借鉴点分析

| 借鉴点       | Get 笔记做法                  | AnyKeep 改良策略                           | 差异化优势                |
| ------------ | ----------------------------- | ------------------------------------------ | ------------------------- |
| **金句卡片** | 用户划线高亮生成分享图片      | AI 提取精彩内容 → 一键生成潮流卡片         | 无需手动划线，AI 自动识别 |
| **概念提取** | AI 分析文章提取实体概念并高亮 | 隐性知识关联 → 搜索时自动扩展相关概念      | 不增加阅读界面复杂度      |
| **双向同步** | 笔记同步到 Notion/Obsidian    | 最强中转站 → 自动格式化 Summary + Metadata | 专注"淘金"不做"金库"      |

### 2.2 AnyKeep 差异化必杀技

| 必杀技           | 竞品软肋                             | AnyKeep 机会                     | 实现价值                           |
| ---------------- | ------------------------------------ | -------------------------------- | ---------------------------------- |
| **视频一等公民** | Get 笔记是"文字优先"，视频只是转字幕 | 视觉优先 + 时间轴空降 + 台词搜索 | 年轻用户在 B站/小红书/YouTube 学习 |
| **零整理压力**   | Get 笔记有待读列表压力               | 海马体不需要压力，需要时问我就行 | 助理不催老板读书                   |

---

## 3. 功能升级清单

### 3.1 总览

| 序号 | 功能模块                  | 战略来源 | 优先级    | 复杂度 | 现有基础                       |
| ---- | ------------------------- | -------- | --------- | ------ | ------------------------------ |
| F01  | **金句卡片生成器**        | 借鉴点一 | **P0** ⬆️ | 中     | TTS Skill 可复用               |
| F02  | **概念关联搜索**          | 借鉴点二 | P1        | 高     | 向量搜索已实现                 |
| F03  | **知识中转站 (Pipeline)** | 借鉴点三 | P0        | 中     | 导出功能已支持 Obsidian        |
| F04  | **视频 X-Ray 增强**       | 必杀技一 | **P2** ⬇️ | 高     | bilibili_transcript Skill 存在 |
| F05  | **时间轴空降**            | 必杀技一 | P2 ⬇️     | 中     | Deep Link 已实现               |
| F06  | **台词/字幕搜索**         | 必杀技一 | **P3** ⬇️ | 高     | 语义搜索已实现                 |
| F07  | **松弛感体验优化**        | 必杀技二 | P0        | 低     | UI 组件已完善                  |
| F08  | **记忆唤醒推送**          | 必杀技二 | P1        | 中     | Brain-Sync Skill 存在          |
| F09  | **研究助理主动提示**      | 愿景核心 | **P1** ⬆️ | 高     | AI Agent 架构已完成            |
| F10  | **数据源同步能力** 🆕     | 新增需求 | **P2** ⬇️ | 中     | 导出系统、API 架构             |

> **优先级调整说明 (V1.3)**:
>
> - F01 金句卡片: P1 → P0 (病毒式传播，战略价值高)
> - F09 研究助理提示: P2 → P1 (愿景核心功能)
> - F04/F05 视频功能: P1 → P2 (先做好文字功能)
> - F06 台词搜索: P2 → P3 (依赖视频功能，延后)
> - F10 数据源同步: 🆕 **P2** (延后，聚焦核心功能)
> - F03 知识中转站: 保持独立，不合并入 F10

### 3.2 功能与现有架构融合分析

| 功能模块          | 依赖的现有组件                  | 需要新增的组件                             | 融合复杂度 |
| ----------------- | ------------------------------- | ------------------------------------------ | ---------- |
| 金句卡片          | TTS Skill, 摘要系统             | CardGenerator Service, ShareCard Component | 低         |
| 概念关联搜索      | 向量搜索, 标签系统              | ConceptExpander, SemanticLinker            | 中         |
| 知识中转站        | 导出系统 (Obsidian/Notion)      | AutoSync Service, FormatAdapter            | 低         |
| **数据源同步** 🆕 | 导出系统, API 架构              | DataSourceAPI, SyncWebhook, TargetAdapters | 中         |
| 视频 X-Ray        | bilibili_transcript Skill       | TimelineExtractor, VideoAnalyzer           | 中         |
| 时间轴空降        | Deep Link 系统                  | TimestampRouter, VideoSeekHandler          | 低         |
| 台词搜索          | 语义搜索, Embedding             | TranscriptIndexer, SubtitleSearch          | 高         |
| 松弛感体验        | UI 组件库                       | RelaxedFeedback, NoGuiltCopy               | 低         |
| 记忆唤醒          | Brain-Sync, active_recall Skill | SmartReminder, ContextualPush              | 中         |
| 研究助理提示      | AI Agent, System-Reminder       | ResearchTracker, ProactiveAgent            | 高         |

---

## 4. 模块详细设计

### 4.1 F01: 金句卡片生成器 (Quote Card Generator)

#### 4.1.1 功能概述

AI 自动识别书签内容中的精彩片段（视频台词、文章金句、核心观点），生成可分享的视觉卡片，用于社交传播。

#### 4.1.2 用户故事

```gherkin
作为 内容创作者
我想要 一键生成书签中精彩内容的分享卡片
以便于 在朋友圈/小红书展示，增加社交传播

验收标准:
  Given 我有一个已收藏的 B站视频书签
  When 我点击"生成金句卡片"
  Then AI 应提取 3-5 个精彩台词/观点
  And 每个金句生成一张视觉卡片
  And 卡片风格可选（胶片风/Notion风/年轻潮流）
  And 支持一键保存到相册或分享
```

#### 4.1.3 技术设计

```
┌─────────────────────────────────────────────────────────┐
│                 金句卡片生成流程                          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│   书签内容 ──▶ AI 金句提取 ──▶ 卡片模板渲染 ──▶ 图片生成  │
│      │              │              │              │      │
│      ▼              ▼              ▼              ▼      │
│   [现有]        [新增]         [新增]         [新增]     │
│  TTS Skill    QuoteExtractor  CardTemplates  ImageGen   │
│  摘要系统                       Figma风格      html2canvas│
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**新增组件：**

| 组件                   | 路径                                        | 职责           |
| ---------------------- | ------------------------------------------- | -------------- |
| `QuoteExtractorSkill`  | `src/lib/ai-skills/skills/quote-extractor/` | AI 提取金句    |
| `CardTemplateService`  | `src/lib/card-generator/templates/`         | 卡片模板管理   |
| `CardGeneratorService` | `src/lib/card-generator/generator.ts`       | 图片生成       |
| `QuoteCardDialog`      | `src/components/quote-card/`                | 卡片预览与分享 |

**与现有架构融合：**

- 复用 `TTS Skill` 的内容提取逻辑
- 复用 `摘要系统` 的 AI 调用链路
- 复用 `OrchestrationSkill` 基类

#### 4.1.4 数据模型

```typescript
interface QuoteCard {
  id: string;
  bookmarkId: string;
  quote: string; // 金句内容
  source: string; // 来源（视频标题/文章标题）
  author?: string; // 作者
  timestamp?: string; // 视频时间戳
  templateId: string; // 使用的模板
  imageUrl?: string; // 生成的图片 URL
  createdAt: Date;
}
```

#### 4.1.5 UI/UX 设计要点

- **入口**: 书签详情页 → "生成金句卡片" 按钮
- **模板风格**: 胶片风、Notion 简约风、潮流渐变风
- **品牌水印**: 可选显示 "Saved by AnyKeep"
- **分享渠道**: 保存到相册、复制图片、分享到微信

---

### 4.2 F02: 概念关联搜索 (Concept Expansion Search)

#### 4.2.1 功能概述

搜索时自动扩展相关概念，即使标题中没有完全匹配的关键词，也能通过隐性知识关联找到相关内容。

#### 4.2.2 用户故事

```gherkin
作为 研究者
我想要 搜索"增长"时也能找到标题只写了"PLG"的内容
以便于 不遗漏任何相关的收藏内容

验收标准:
  Given 我收藏了一篇标题为"PLG 实战指南"的文章
  When 我搜索"增长策略"
  Then "PLG 实战指南"应出现在搜索结果中
  And 搜索结果显示"通过概念关联匹配"的标识
  And 显示关联概念："PLG ↔ 产品驱动增长 ↔ 增长策略"
```

#### 4.2.3 技术设计

```
┌────────────────────────────────────────────────────────────┐
│                   概念关联搜索流程                           │
├────────────────────────────────────────────────────────────┤
│                                                            │
│   用户查询 ──▶ 概念扩展 ──▶ 向量搜索 ──▶ 结果融合 ──▶ 排序  │
│      │           │           │           │           │     │
│      ▼           ▼           ▼           ▼           ▼     │
│   "增长"    [ConceptExpander] [现有]    [ResultFuser] [现有]│
│            ├─ 同义词库       向量搜索   加权融合      排序   │
│            ├─ LLM 扩展                                     │
│            └─ 知识图谱                                     │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

**新增组件：**

| 组件                   | 路径                                           | 职责         |
| ---------------------- | ---------------------------------------------- | ------------ |
| `ConceptExpander`      | `src/lib/ai-skills/search/concept-expander.ts` | 概念扩展服务 |
| `ConceptKnowledgeBase` | `src/lib/knowledge/concept-kb.ts`              | 概念同义词库 |
| `ResultFuser`          | `src/lib/ai-skills/search/result-fuser.ts`     | 多路召回融合 |

**与现有架构融合：**

- 复用 `query-parser.ts` 的查询解析
- 复用 `result-ranker.ts` 的排序逻辑
- 扩展 `response-formatter.ts` 添加关联标识

#### 4.2.4 概念知识库设计

```typescript
interface ConceptMapping {
  concept: string;           // 核心概念
  synonyms: string[];        // 同义词
  relatedConcepts: string[]; // 相关概念
  embedding: number[];       // 概念向量
  domain: string;            // 领域（科技/商业/设计...）
}

// 预置概念映射示例
const conceptMappings: ConceptMapping[] = [
  {
    concept: "PLG",
    synonyms: ["Product-Led Growth", "产品驱动增长"],
    relatedConcepts: ["增长策略", "SaaS", "免费增值"],
    embedding: [...],
    domain: "商业"
  },
  // ...
];
```

---

### 4.3 F03: 知识中转站 (Knowledge Pipeline)

#### 4.3.1 功能概述

AnyKeep 作为"淘金者"，将收藏内容的精华（摘要 + 元数据）自动格式化为 Markdown，同步到用户的 Obsidian/Notion 知识库。

> Slogan: "AnyKeep 负责帮你把沙子淘成金子，然后送进你的金库 (Obsidian)。"

#### 4.3.2 用户故事

```gherkin
作为 Obsidian 用户
我想要 AnyKeep 自动把收藏内容同步到我的 Obsidian 库
以便于 在 Obsidian 中进行深度整理和知识管理

验收标准:
  Given 我已配置 Obsidian 同步目录
  When 我在 AnyKeep 收藏一篇新文章
  Then 5 分钟内该文章的摘要 Markdown 出现在 Obsidian 指定目录
  And Markdown 包含：标题、URL、AI 摘要、标签、收藏时间
  And 标签格式兼容 Obsidian (#tag 格式)
  And 支持手动触发立即同步
```

#### 4.3.3 技术设计

```
┌────────────────────────────────────────────────────────────┐
│                   知识中转站流程                             │
├────────────────────────────────────────────────────────────┤
│                                                            │
│   新收藏 ──▶ AI 摘要 ──▶ 格式化 ──▶ 同步适配器 ──▶ 目标库   │
│      │         │          │           │             │      │
│      ▼         ▼          ▼           ▼             ▼      │
│   [现有]    [现有]      [新增]      [新增]        [外部]    │
│   收藏API   摘要系统  MarkdownFormatter  SyncAdapter       │
│                        └─ ObsidianFormat               │
│                        └─ NotionFormat                 │
│                                                            │
│   同步方式:                                                │
│   ├─ Local Folder (Obsidian 本地库)                        │
│   ├─ Notion API (官方集成)                                  │
│   └─ WebDAV (通用协议)                                     │
└────────────────────────────────────────────────────────────┘
```

**新增组件：**

| 组件                | 路径                                      | 职责              |
| ------------------- | ----------------------------------------- | ----------------- |
| `PipelineService`   | `src/lib/pipeline/pipeline.service.ts`    | 同步编排服务      |
| `ObsidianFormatter` | `src/lib/pipeline/formatters/obsidian.ts` | Obsidian 格式适配 |
| `NotionAdapter`     | `src/lib/pipeline/adapters/notion.ts`     | Notion API 适配   |
| `SyncScheduler`     | `src/lib/pipeline/scheduler.ts`           | 定时同步调度      |

**与现有架构融合：**

- 复用 `src/lib/export/formatters/obsidian.formatter.ts`
- 扩展 `data_export` Skill 添加自动同步能力
- 复用摘要系统的 AI 处理结果

#### 4.3.4 配置界面设计

```typescript
interface PipelineConfig {
  enabled: boolean;
  target: "obsidian" | "notion" | "logseq";
  syncMode: "auto" | "manual";
  syncInterval: number; // 分钟
  obsidianConfig?: {
    vaultPath: string; // 本地库路径
    folderName: string; // 保存目录
    template: string; // Markdown 模板
  };
  notionConfig?: {
    apiKey: string;
    databaseId: string;
  };
  filters: {
    platforms?: string[]; // 只同步特定平台
    folders?: string[]; // 只同步特定文件夹
    minRating?: number; // 只同步高评分内容
  };
}
```

---

### 4.4 F04: 视频 X-Ray 增强

#### 4.4.1 功能概述

将视频内容从"链接+封面"升级为结构化的时间轴数据，用户可以看到视频的关键时间点、章节、精彩片段，并一键跳转到指定位置播放。

#### 4.4.2 用户故事

```gherkin
作为 B站学习者
我想要 看到收藏视频的章节结构和关键时间点
以便于 快速定位到我想复习的部分

验收标准:
  Given 我收藏了一个1小时的技术教程视频
  When 我打开书签详情
  Then 显示 AI 提取的时间轴（如 03:20 - 环境搭建, 15:40 - 核心原理...）
  And 点击任意时间点可跳转到 B站 App 的对应位置
  And 可以搜索视频内的台词内容
```

#### 4.4.3 技术设计

```
┌────────────────────────────────────────────────────────────┐
│                   视频 X-Ray 处理流程                        │
├────────────────────────────────────────────────────────────┤
│                                                            │
│   视频 URL ──▶ 字幕获取 ──▶ AI 分析 ──▶ 时间轴提取 ──▶ 存储│
│      │           │           │           │            │    │
│      ▼           ▼           ▼           ▼            ▼    │
│   [识别]      [新增]      [新增]      [新增]       [扩展]   │
│   平台识别   SubtitleFetcher  VideoAnalyzer  TimelineGen  bookmarks│
│   BV号提取   ├─ B站 API                               ai_timeline│
│              ├─ YouTube API                                │
│              └─ 通用字幕                                   │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

**新增组件：**

| 组件                | 路径                                      | 职责           |
| ------------------- | ----------------------------------------- | -------------- |
| `VideoXRaySkill`    | `src/lib/ai-skills/skills/video-xray/`    | 视频分析编排   |
| `SubtitleFetcher`   | `src/lib/video/subtitle-fetcher.ts`       | 多平台字幕获取 |
| `TimelineGenerator` | `src/lib/video/timeline-generator.ts`     | 时间轴生成     |
| `VideoTimeline`     | `src/components/video/video-timeline.tsx` | 时间轴 UI 组件 |

**与现有架构融合：**

- 扩展 `bilibili_transcript` Skill
- 复用 `OrchestrationSkill` 基类
- 扩展 `bookmarks` 表的 `ai_timeline` 字段

#### 4.4.4 数据模型

```typescript
interface VideoTimeline {
  bookmarkId: string;
  duration: number; // 视频总时长（秒）
  chapters: VideoChapter[]; // 章节列表
  highlights: VideoHighlight[]; // 精彩片段
  transcript?: string; // 完整字幕文本
  transcriptIndexed: boolean; // 是否已索引（用于搜索）
}

interface VideoChapter {
  timestamp: number; // 开始时间（秒）
  title: string; // 章节标题
  summary?: string; // AI 生成的章节摘要
}

interface VideoHighlight {
  timestamp: number;
  text: string; // 精彩台词/观点
  importance: number; // 重要度评分 0-1
}
```

---

### 4.5 F05: 时间轴空降

#### 4.5.1 功能概述

点击视频时间轴的任意时间点，通过 Deep Link 直接跳转到原生 App 的对应播放位置。

#### 4.5.2 技术设计

**Deep Link 格式：**

| 平台    | Deep Link 格式                                | 示例                                              |
| ------- | --------------------------------------------- | ------------------------------------------------- |
| B站     | `bilibili://video/{bvid}?start_progress={ms}` | `bilibili://video/BV1xx...?start_progress=200000` |
| YouTube | `youtube://watch?v={id}&t={seconds}`          | `youtube://watch?v=xxx&t=200`                     |
| 小红书  | `xhsdiscover://item/{id}`                     | 暂不支持时间戳                                    |

**新增组件：**

| 组件                | 路径                                         | 职责                  |
| ------------------- | -------------------------------------------- | --------------------- |
| `TimestampDeepLink` | `src/lib/deep-link/timestamp-deep-link.ts`   | 时间戳 Deep Link 生成 |
| `VideoSeekButton`   | `src/components/video/video-seek-button.tsx` | 跳转按钮组件          |

---

### 4.6 F06: 台词/字幕搜索

#### 4.6.1 功能概述

在语义搜索中加入视频字幕的全文索引，用户可以通过记忆中的台词片段找到对应视频。

#### 4.6.2 用户故事

```gherkin
作为 内容消费者
我想要 搜索"法律的生命在于经验"找到罗翔的视频
以便于 找回那个记不清标题但记得台词的视频

验收标准:
  Given 我收藏了多个罗翔的法律科普视频
  When 我搜索"法律的生命在于经验"
  Then 包含这句台词的视频出现在搜索结果中
  And 显示匹配的台词片段和对应时间戳
  And 点击可跳转到该时间点播放
```

#### 4.6.3 技术设计

**索引策略：**

1. 视频字幕文本存入 `ai_timeline.transcript`
2. 字幕文本生成向量存入专门的索引表 `bookmark_transcript_embeddings`
3. 搜索时同时查询标题向量和字幕向量，融合结果

---

### 4.7 F07: 松弛感体验优化

#### 4.7.1 功能概述

从 UI 文案、交互反馈、视觉设计全方位传递"无压力"的产品气质，消除用户的收藏焦虑。

#### 4.7.2 设计要点

| 优化点           | 原有设计               | 松弛感设计                              |
| ---------------- | ---------------------- | --------------------------------------- |
| **空状态文案**   | "你还没有收藏任何内容" | "海马体空空如也，去发现有趣的东西吧 🧠" |
| **收藏成功反馈** | "收藏成功"             | "已记住！需要时问我就行"                |
| **未读提醒**     | "你有 23 条未读收藏"   | 不显示未读数量，改为"最近收藏"          |
| **整理提示**     | "建议整理你的收藏"     | 不主动提示整理                          |
| **加载状态**     | Loading 动画           | 呼吸灯效果，暗示"助理正在思考"          |

#### 4.7.3 新增组件

| 组件              | 路径                                      | 职责           |
| ----------------- | ----------------------------------------- | -------------- |
| `RelaxedToast`    | `src/components/ui/relaxed-toast.tsx`     | 松弛风格的通知 |
| `BreathingLoader` | `src/components/ui/breathing-loader.tsx`  | 呼吸灯加载效果 |
| `NoGuiltEmpty`    | `src/components/empty/no-guilt-empty.tsx` | 无压力空状态   |

---

### 4.8 F08: 记忆唤醒推送

#### 4.8.1 功能概述

基于用户的收藏历史和使用习惯，在合适的时机主动"轻拍肩膀"，提醒用户遗忘的收藏。

#### 4.8.2 用户故事

```gherkin
作为 内容消费者
我想要 AnyKeep 在合适时机提醒我遗忘的收藏
以便于 不浪费之前收藏的好内容

验收标准:
  Given 我 3 个月前收藏了一个"学习 Rust"的视频但从未打开
  When 我最近搜索了"编程语言"相关内容
  Then AnyKeep 在首页显示"记忆唤醒"卡片
  And 提示"你可能忘了这个：3个月前你对 Rust 感兴趣"
  And 提供"查看"和"不再提醒"选项
```

#### 4.8.3 技术设计

**唤醒触发规则：**

| 触发条件        | 唤醒策略                             |
| --------------- | ------------------------------------ |
| 搜索主题相关    | 搜索"编程"时，唤醒相关但未访问的收藏 |
| 周期性回顾      | 每周推荐 3-5 个被遗忘的收藏          |
| 热点关联        | 当收藏内容成为热点时推送             |
| Brain-Sync 整合 | 与 active_recall Skill 联动          |

**与现有架构融合：**

- 复用 `Brain-Sync` (active_recall Skill) 的记忆算法
- 复用 `System-Reminder` 注入机制
- 扩展首页的推荐卡片区

---

### 4.9 F09: 研究助理主动提示

#### 4.9.1 功能概述

AI 作为"研究助理"，主动识别用户的研究方向，在用户需要时提供相关收藏的提示。

#### 4.9.2 技术设计

**主动提示场景：**

| 场景         | 提示内容                               |
| ------------ | -------------------------------------- |
| AI 对话时    | "根据你的收藏，你可能对 XX 主题感兴趣" |
| 搜索无结果时 | "你之前收藏过相关内容，要不要看看？"   |
| 收藏新内容时 | "这个和你之前收藏的 XX 很相关"         |

**与现有架构融合：**

- 复用 `AI Agent` 的 `System-Reminder` 机制
- 复用 `enhanced-confidence.ts` 的上下文评估
- 扩展 `prompt-injector.ts` 添加研究方向上下文

---

### 4.10 F10: 数据源同步能力 (Data Source Sync) 🆕

#### 4.10.1 功能概述

将 AnyKeep 定位为知识生态的**"数据源"**，为 Obsidian、Notion、Get 笔记、Logseq 等知识管理工具提供标准化的数据同步能力。

> **核心理念**：AnyKeep 是"淘金者"，负责收集和提炼；其他工具是"金库"，负责深度整理。

#### 4.10.2 战略价值

| 维度         | 价值说明                                            |
| ------------ | --------------------------------------------------- |
| **生态定位** | 不与 Obsidian/Notion 竞争，而是成为它们的上游数据源 |
| **用户粘性** | 用户建立同步后，迁移成本极高                        |
| **差异化**   | 竞品（Cubox、Get笔记）同步能力较弱或需手动          |
| **商业模式** | 高级同步功能可作为 Pro 付费点                       |

#### 4.10.3 用户故事

```gherkin
作为 Obsidian 用户
我想要 AnyKeep 的收藏自动同步到 Obsidian
以便于 在 Obsidian 中进行深度整理和双向链接

验收标准:
  Given 我已配置 Obsidian 同步（本地文件夹 / Obsidian Publish）
  When 我在 AnyKeep 收藏新内容
  Then 5 分钟内 Markdown 文件出现在 Obsidian 指定目录
  And 包含：标题、URL、AI 摘要、标签（#tag 格式）、元数据
  And 支持自定义模板（Obsidian Properties / YAML frontmatter）
```

```gherkin
作为 Notion 用户
我想要 AnyKeep 的收藏自动同步到 Notion Database
以便于 在 Notion 中与其他内容关联

验收标准:
  Given 我已通过 OAuth 授权 Notion 集成
  When 我在 AnyKeep 收藏新内容
  Then Notion Database 中新增一条记录
  And 字段映射：Title, URL, Summary, Tags, Platform, Created
  And 支持选择同步到哪个 Database
```

```gherkin
作为 Get 笔记用户
我想要 将 AnyKeep 的收藏导入 Get 笔记深度阅读
以便于 在 Get 笔记中进行高亮标注

验收标准:
  Given Get 笔记支持导入功能
  When 我选择从 AnyKeep 导入
  Then Get 笔记可读取 AnyKeep 的公开 API
  And 内容包含原始 URL 和 AnyKeep 生成的摘要
```

#### 4.10.4 同步目标平台

| 平台         | 同步方式             | 优先级    | 技术方案                              |
| ------------ | -------------------- | --------- | ------------------------------------- |
| **Notion**   | 官方 API             | **P0** ⭐ | OAuth + Database API                  |
| **Obsidian** | 本地文件夹           | P1        | 写入 Markdown 到用户指定目录          |
| **Obsidian** | Obsidian Sync (间接) | P1        | 通过本地文件夹，由 Obsidian Sync 同步 |
| **Logseq**   | 本地文件夹           | P2        | Markdown 格式兼容                     |
| **Get 笔记** | 开放 API             | P2        | 提供 API 供 Get 笔记调用              |
| **Readwise** | API 集成             | P2        | Readwise API 推送                     |
| **通用**     | Webhook              | P1        | 用户自定义 Webhook URL                |
| **通用**     | RSS 订阅             | P1        | 提供用户专属 RSS Feed                 |

#### 4.10.5 技术设计

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      数据源同步架构                                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌───────────┐                                                         │
│   │  AnyKeep  │                                                         │
│   │  收藏数据  │                                                         │
│   └─────┬─────┘                                                         │
│         │                                                               │
│         ▼                                                               │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                    DataSourceService (核心)                       │   │
│   │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │   │
│   │  │ SyncScheduler│  │ FormatEngine │  │ DeliveryMgr  │           │   │
│   │  │ (定时/事件)   │  │ (格式转换)    │  │ (投递管理)   │           │   │
│   │  └──────────────┘  └──────────────┘  └──────────────┘           │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│         │                                                               │
│         ├──────────────────────────────────────────────────────────┐    │
│         │                                                          │    │
│         ▼                                                          ▼    │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│   │  Obsidian   │  │   Notion    │  │   Webhook   │  │  RSS Feed   │   │
│   │  Adapter    │  │   Adapter   │  │   Adapter   │  │   Adapter   │   │
│   ├─────────────┤  ├─────────────┤  ├─────────────┤  ├─────────────┤   │
│   │ • LocalFile │  │ • OAuth     │  │ • POST JSON │  │ • XML Gen   │   │
│   │ • Template  │  │ • DB API    │  │ • Retry     │  │ • Atom/RSS2 │   │
│   │ • YAML FM   │  │ • PropMap   │  │ • Signature │  │ • Paginate  │   │
│   └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘   │
│         │                │                │                │           │
│         ▼                ▼                ▼                ▼           │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                      外部目标平台                                  │   │
│   │  Obsidian Vault │ Notion DB │ Logseq │ Get笔记 │ Readwise │ ...  │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

#### 4.10.6 新增组件

| 组件                | 路径                                               | 职责                       |
| ------------------- | -------------------------------------------------- | -------------------------- |
| `DataSourceService` | `src/lib/data-source/data-source.service.ts`       | 同步编排核心服务           |
| `SyncScheduler`     | `src/lib/data-source/scheduler.ts`                 | 同步调度（实时/定时/手动） |
| `FormatEngine`      | `src/lib/data-source/format-engine.ts`             | 多格式转换引擎             |
| `ObsidianAdapter`   | `src/lib/data-source/adapters/obsidian.adapter.ts` | Obsidian 同步适配          |
| `NotionAdapter`     | `src/lib/data-source/adapters/notion.adapter.ts`   | Notion API 适配            |
| `WebhookAdapter`    | `src/lib/data-source/adapters/webhook.adapter.ts`  | 通用 Webhook 适配          |
| `RssFeedAdapter`    | `src/lib/data-source/adapters/rss.adapter.ts`      | RSS Feed 生成              |
| `DataSourceAPI`     | `src/app/api/data-source/`                         | 开放 API 端点              |

#### 4.10.7 数据模型

```typescript
// 同步目标配置
interface SyncTargetConfig {
  id: string;
  userId: string;
  targetType: "obsidian" | "notion" | "logseq" | "webhook" | "rss";
  name: string; // 用户自定义名称
  enabled: boolean;
  syncMode: "realtime" | "hourly" | "daily" | "manual";

  // Obsidian 配置
  obsidianConfig?: {
    vaultPath: string; // 本地 Vault 路径
    folderName: string; // 保存目录
    templateId: string; // Markdown 模板
    filenamePattern: string; // 文件名模式 {{title}}-{{date}}
    useYamlFrontmatter: boolean; // 使用 YAML 元数据
  };

  // Notion 配置
  notionConfig?: {
    accessToken: string; // OAuth Token
    databaseId: string; // 目标 Database
    propertyMapping: Record<string, string>; // 字段映射
  };

  // Webhook 配置
  webhookConfig?: {
    url: string;
    headers?: Record<string, string>;
    secretKey?: string; // 签名密钥
  };

  // 筛选条件
  filters: {
    platforms?: string[]; // 只同步特定平台
    folders?: string[]; // 只同步特定文件夹
    tags?: string[]; // 只同步带特定标签的
    minRating?: number; // 最低评分
  };

  // 状态
  lastSyncAt?: Date;
  syncStatus: "idle" | "syncing" | "error";
  errorMessage?: string;
  syncedCount: number;
}

// 同步记录
interface SyncRecord {
  id: string;
  targetConfigId: string;
  bookmarkId: string;
  syncedAt: Date;
  status: "success" | "failed" | "pending";
  externalId?: string; // 目标平台的 ID
  errorMessage?: string;
}

// Obsidian Markdown 模板
interface ObsidianTemplate {
  id: string;
  name: string;
  template: string; // Handlebars 模板
  isDefault: boolean;
}

// 默认模板示例
const defaultObsidianTemplate = `---
title: "{{title}}"
url: {{url}}
platform: {{platform}}
tags: [{{#each tags}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}]
created: {{createdAt}}
synced: {{syncedAt}}
---

# {{title}}

> [原文链接]({{url}})

## AI 摘要

{{summary}}

## 标签

{{#each tags}}#{{this}} {{/each}}

---
*由 AnyKeep 同步于 {{syncedAt}}*
`;
```

#### 4.10.8 开放 API 设计

```typescript
// GET /api/data-source/bookmarks
// 获取用户书签列表（供第三方应用调用）
interface DataSourceBookmarksRequest {
  apiKey: string; // 用户 API Key
  since?: string; // 增量同步时间戳
  limit?: number; // 分页大小
  cursor?: string; // 分页游标
  platforms?: string[]; // 平台筛选
  folders?: string[]; // 文件夹筛选
}

interface DataSourceBookmarksResponse {
  bookmarks: DataSourceBookmark[];
  nextCursor?: string;
  hasMore: boolean;
}

interface DataSourceBookmark {
  id: string;
  title: string;
  url: string;
  platform: string;
  summary?: string;
  tags: string[];
  folder?: string;
  createdAt: string;
  updatedAt: string;
}

// GET /api/data-source/rss/:userId
// 用户专属 RSS Feed
// 返回 Atom/RSS2 格式的 XML
```

#### 4.10.9 UI/UX 设计要点

**设置入口**: 设置 → 数据同步 → 添加同步目标

**配置流程**:

1. 选择目标平台（Obsidian / Notion / Webhook / RSS）
2. 配置连接方式（本地路径 / OAuth / API Key）
3. 设置同步规则（实时/定时、筛选条件）
4. 选择/自定义模板
5. 测试同步
6. 启用

**同步状态面板**:

- 显示各同步目标状态
- 最后同步时间
- 已同步/待同步数量
- 手动触发同步按钮
- 同步日志查看

#### 4.10.10 与 F03 知识中转站的关系

F03（知识中转站）和 F10（数据源同步）**保持独立**，各有侧重：

| 维度           | F03 知识中转站            | F10 数据源同步                    |
| -------------- | ------------------------- | --------------------------------- |
| **核心目标**   | 自动化同步到个人知识库    | 开放生态，成为数据源              |
| **范围**       | Obsidian/Notion 深度集成  | 全平台（含开放 API/Webhook/RSS）  |
| **用户场景**   | "我想自动同步到 Obsidian" | "我想让其他工具读取 AnyKeep 数据" |
| **触发方式**   | 自动/定时同步             | 自动 + 被动 API 调用              |
| **实现优先级** | **Q1 (P0)**               | **Q3 (P2)**                       |

**实现建议**:

- F03 专注 **推送同步**（AnyKeep 主动推到目标）- Q1 优先
- F10 专注 **开放能力**（提供 API/Webhook/RSS 供外部拉取）- Q3 与视频一起
- 两者共享底层 `FormatEngine` 和 `SyncScheduler` 组件

---

## 5. 架构融合方案

### 5.1 整体架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                       AnyKeep 5.0 架构全景                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   ┌──────────────────┐   ┌──────────────────┐   ┌────────────────┐ │
│   │   展示层 (UI)     │   │   交互层 (UX)     │   │  新增: 分享层  │ │
│   ├──────────────────┤   ├──────────────────┤   ├────────────────┤ │
│   │ • 首页瀑布流      │   │ • 松弛感反馈      │   │ • 金句卡片     │ │
│   │ • 书签详情       │   │ • 呼吸灯加载      │   │ • 社交分享     │ │
│   │ • 视频时间轴     │   │ • 无压力空状态    │   │ • 品牌水印     │ │
│   └────────┬─────────┘   └────────┬─────────┘   └───────┬────────┘ │
│            │                      │                      │          │
│            ▼                      ▼                      ▼          │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                     业务逻辑层 (Services)                     │   │
│   ├─────────────────────────────────────────────────────────────┤   │
│   │  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐ │   │
│   │  │ 收藏服务   │  │ 搜索服务   │  │ AI Skills │  │ 新增服务  │ │   │
│   │  │ (现有)    │  │ (扩展)    │  │ (扩展)    │  │           │ │   │
│   │  ├───────────┤  ├───────────┤  ├───────────┤  ├───────────┤ │   │
│   │  │ • 书签CRUD │  │ • 概念扩展 │  │ • QuoteExt │  │ • Pipeline│ │   │
│   │  │ • 批量操作 │  │ • 字幕搜索 │  │ • VideoXRay│  │ • CardGen │ │   │
│   │  │ • 导入导出 │  │ • 融合排序 │  │ • MemoryWake│ │ • Reminder│ │   │
│   │  └───────────┘  └───────────┘  └───────────┘  └───────────┘ │   │
│   └──────────────────────────┬──────────────────────────────────┘   │
│                              │                                      │
│                              ▼                                      │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │                     数据层 (Database)                         │   │
│   ├─────────────────────────────────────────────────────────────┤   │
│   │  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐ │   │
│   │  │ bookmarks │  │ embeddings│  │ 新增:     │  │ 新增:     │ │   │
│   │  │ (扩展)    │  │ (扩展)    │  │ transcripts│ │ concepts  │ │   │
│   │  ├───────────┤  ├───────────┤  ├───────────┤  ├───────────┤ │   │
│   │  │+ai_timeline│ │+transcript │ │ 字幕索引  │  │ 概念映射  │ │   │
│   │  │+video_meta│  │ embeddings│  │           │  │           │ │   │
│   │  └───────────┘  └───────────┘  └───────────┘  └───────────┘ │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 5.2 新增数据库表

```sql
-- 1. 视频字幕索引表
CREATE TABLE bookmark_transcripts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  bookmark_id UUID REFERENCES bookmarks(id) ON DELETE CASCADE,
  transcript TEXT NOT NULL,           -- 完整字幕
  transcript_embedding vector(1536),  -- 字幕向量
  chapters JSONB,                     -- 章节数据
  highlights JSONB,                   -- 精彩片段
  duration INTEGER,                   -- 视频时长（秒）
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_bookmark_transcript UNIQUE(bookmark_id)
);

-- 2. 概念知识库表
CREATE TABLE concept_mappings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  concept VARCHAR(100) NOT NULL,
  synonyms TEXT[],
  related_concepts TEXT[],
  concept_embedding vector(1536),
  domain VARCHAR(50),
  source VARCHAR(50) DEFAULT 'system',  -- system/user-contributed
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_concept UNIQUE(concept)
);

-- 3. 金句卡片表
CREATE TABLE quote_cards (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  bookmark_id UUID REFERENCES bookmarks(id) ON DELETE CASCADE,
  quote TEXT NOT NULL,
  source VARCHAR(500),
  author VARCHAR(200),
  timestamp_seconds INTEGER,
  template_id VARCHAR(50) NOT NULL,
  image_url VARCHAR(500),
  share_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 同步管道配置表
CREATE TABLE pipeline_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  target VARCHAR(50) NOT NULL,        -- obsidian/notion/logseq
  config JSONB NOT NULL,
  enabled BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMPTZ,
  sync_status VARCHAR(20) DEFAULT 'idle',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_user_target UNIQUE(user_id, target)
);

-- 5. 记忆唤醒记录表
CREATE TABLE memory_wake_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  bookmark_id UUID REFERENCES bookmarks(id) ON DELETE CASCADE,
  trigger_type VARCHAR(50) NOT NULL,  -- search/periodic/hotspot/brain-sync
  triggered_at TIMESTAMPTZ DEFAULT NOW(),
  user_action VARCHAR(20),            -- viewed/dismissed/snoozed
  action_at TIMESTAMPTZ
);
```

### 5.3 新增 AI Skills

| Skill ID          | 名称     | 基类               | 步骤数 | Feature Flag             |
| ----------------- | -------- | ------------------ | ------ | ------------------------ |
| `quote_extractor` | 金句提取 | OrchestrationSkill | 3      | `ENABLE_QUOTE_EXTRACTOR` |
| `video_xray`      | 视频X光  | OrchestrationSkill | 5      | `ENABLE_VIDEO_XRAY`      |
| `memory_wake`     | 记忆唤醒 | OrchestrationSkill | 4      | `ENABLE_MEMORY_WAKE`     |
| `concept_expand`  | 概念扩展 | BaseSkill (atomic) | -      | `ENABLE_CONCEPT_EXPAND`  |

---

## 6. 优先级与路线图

### 6.1 Phase 1: 基础升级 (2025 Q1) - 文字功能优先

**目标：** 夯实"研究助理"基础能力

| 功能                  | 优先级 | 工时 | 依赖      |
| --------------------- | ------ | ---- | --------- |
| F07 松弛感体验优化    | P0     | 1周  | 无        |
| F01 金句卡片生成器 ⬆️ | P0     | 2周  | TTS Skill |
| F03 知识中转站 (独立) | P0     | 1周  | 导出系统  |

### 6.2 Phase 2: 智能增强 (2025 Q2)

**目标：** 提升检索智能和主动服务能力

| 功能                    | 优先级 | 工时 | 依赖       |
| ----------------------- | ------ | ---- | ---------- |
| F09 研究助理主动提示 ⬆️ | P1     | 3周  | AI Agent   |
| F08 记忆唤醒推送        | P1     | 2周  | Brain-Sync |
| F02 概念关联搜索        | P1     | 3周  | 向量搜索   |

### 6.3 Phase 3: 视频 + 生态 (2025 Q3)

**目标：** 建立视频内容的差异化优势 + 数据源生态

| 功能                                | 优先级 | 工时 | 依赖                |
| ----------------------------------- | ------ | ---- | ------------------- |
| F04 视频 X-Ray 增强 ⬇️              | P2     | 3周  | bilibili_transcript |
| F05 时间轴空降 ⬇️                   | P2     | 1周  | Deep Link, F04      |
| F10 数据源同步能力 (Notion 优先) ⬇️ | P2     | 2周  | API 架构            |

### 6.4 Phase 4: 长期规划 (2025 Q4+)

| 功能                 | 优先级 | 工时 | 依赖     |
| -------------------- | ------ | ---- | -------- |
| F06 台词/字幕搜索 ⬇️ | P3     | 2周  | F04 完成 |

### 6.5 路线图可视化（调整后）

```
2025 Q1              2025 Q2              2025 Q3              2025 Q4+
    │                    │                    │                    │
    ▼                    ▼                    ▼                    ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Phase 1    │───▶│   Phase 2    │───▶│   Phase 3    │───▶│   Phase 4    │
│    基础      │    │   智能增强    │    │  视频 + 生态  │    │   长期规划    │
├──────────────┤    ├──────────────┤    ├──────────────┤    ├──────────────┤
│ F07 松弛感   │    │ F09 研究助理  │    │ F04 X-Ray   │    │ F06 台词搜索 │
│ F01 金句卡片 │    │ F08 记忆唤醒  │    │ F05 时间轴   │    │              │
│ F03 知识中转 │    │ F02 概念搜索  │    │ F10 数据源 🆕│    │              │
└──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
       │
       │  ★ 聚焦核心功能优先
       └──────────────────────────────────────────────────────────────→
```

### 6.6 优先级调整理由

| 调整           | 原优先级 | 新优先级 | 理由                                |
| -------------- | -------- | -------- | ----------------------------------- |
| F01 金句卡片   | P1       | **P0**   | 病毒式传播价值高，早期获客关键      |
| F09 研究助理   | P2       | **P1**   | 愿景核心，差异化定位关键            |
| F10 数据源     | 无       | **P2**   | 延后，聚焦核心功能；Q3 与视频一起做 |
| F03 知识中转   | -        | **P0**   | 保持独立，专注推送同步              |
| F04 视频 X-Ray | P1       | **P2**   | 先做好文字功能，视频延后            |
| F05 时间轴     | P1       | **P2**   | 依赖 F04，一起延后                  |
| F06 台词搜索   | P2       | **P3**   | 依赖视频功能，进一步延后            |

---

## 7. 风险与边界

### 7.1 技术风险

| 风险              | 概率 | 影响 | 缓解措施                          |
| ----------------- | ---- | ---- | --------------------------------- |
| B站 API 限制/变更 | 中   | 高   | 多源字幕获取备案、缓存策略        |
| 概念知识库冷启动  | 中   | 中   | 预置 1000+ 常见概念、允许用户贡献 |
| 卡片生成性能      | 低   | 中   | 异步生成、CDN 缓存                |
| Notion API 限额   | 低   | 低   | 批量同步、本地缓存                |

### 7.2 产品边界

**再次强调战略红线：**

| 绝对不做     | 原因               | 用户需求如何满足   |
| ------------ | ------------------ | ------------------ |
| 富文本编辑   | 进入 Notion 赛道   | 同步到 Notion 编辑 |
| 沉浸式阅读器 | 进入 Get 笔记赛道  | Deep Link 到原平台 |
| 双向链接     | 进入 Obsidian 赛道 | 同步到 Obsidian    |
| 思维导图编辑 | 增加复杂度         | 知识图谱只读查看   |

### 7.3 成功指标

| 功能模块     | 核心指标                       | 目标值         |
| ------------ | ------------------------------ | -------------- |
| 金句卡片     | 分享率（生成卡片后分享的比例） | > 30%          |
| 知识中转站   | 同步启用率                     | > 20% 活跃用户 |
| 视频 X-Ray   | 时间轴使用率（点击跳转）       | > 50% 视频书签 |
| 松弛感体验   | NPS 提升                       | +10 分         |
| 记忆唤醒     | 唤醒点击率                     | > 15%          |
| 概念关联搜索 | 搜索成功率提升                 | +15%           |

---

## 附录 A: 用户研究验证点

在开发前，建议验证以下假设：

1. **金句卡片需求验证**
   - 问卷：用户是否有分享收藏内容到社交平台的习惯？
   - 访谈：现有分享流程的痛点是什么？

2. **知识中转站需求验证**
   - 调研：用户同时使用 AnyKeep + Obsidian/Notion 的比例
   - 测试：提供手动导出 vs 自动同步的偏好

3. **视频场景优先级验证**
   - 数据分析：视频类书签在总量中的占比
   - 用户访谈：视频收藏后的使用场景

---

## 附录 B: 竞品功能对比更新

| 功能         | AnyKeep 5.0    | Get 笔记    | Cubox   | Pocket  |
| ------------ | -------------- | ----------- | ------- | ------- |
| 金句卡片     | ✅ AI 自动生成 | ✅ 手动划线 | ❌      | ❌      |
| 概念关联搜索 | ✅ 隐性关联    | ✅ 实体高亮 | ❌      | ❌      |
| 知识中转站   | ✅ 自动同步    | ✅ 手动同步 | ✅ 手动 | ❌      |
| 视频 X-Ray   | ✅ 时间轴+台词 | ⚡ 仅字幕   | ❌      | ❌      |
| 松弛感设计   | ✅ 核心理念    | ❌ 有压力   | ⚡ 中性 | ⚡ 中性 |

---

**文档结束** | 待审核确认后进入架构设计阶段 📋
