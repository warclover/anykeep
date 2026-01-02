# PRD: 知识分发中心 (Knowledge Distribution Hub)

> **版本**: 1.1.0-draft
> **状态**: 待审核
> **创建日期**: 2026-01-01
> **更新日期**: 2026-01-01
> **作者**: John (PM Agent) + Xiafe

---

## 变更记录

| 版本  | 日期       | 变更内容                                                        |
| ----- | ---------- | --------------------------------------------------------------- |
| 1.1.0 | 2026-01-01 | 增加解耦架构设计、RSS 参数筛选、Obsidian 平台限制、导出融合策略 |
| 1.0.0 | 2026-01-01 | 初稿：合并 F03/F10，统一知识分发功能                            |

---

## 1. Executive Summary

### 1.1 背景与问题

当前 PRD 中存在 **三个功能** 处理"数据流出 AnyKeep"的场景：

| 功能                  | 定位                       | 问题                  |
| --------------------- | -------------------------- | --------------------- |
| **数据导出** (已实现) | 手动下载文件               | 单次操作，无自动化    |
| **F03 知识中转站**    | 自动同步到 Obsidian/Notion | 与 F10 重叠，边界模糊 |
| **F10 数据源同步**    | 开放 API/Webhook/RSS       | 与 F03 重叠，组件冗余 |

**核心问题**：

1. 用户视角：三个入口做类似的事，认知负担高
2. 技术视角：`FormatEngine`、`SyncScheduler` 等组件重复规划
3. 产品视角：功能边界不清晰，难以向用户解释差异

### 1.2 解决方案

**合并为一个统一功能**：**知识分发中心 (Knowledge Distribution Hub)**

> **核心理念**：AnyKeep 是知识的"淘金者"，知识分发中心是"物流系统"——无论你要把金子送到哪个金库，都在这里配置。

### 1.3 战略价值

| 维度         | 价值                                                   |
| ------------ | ------------------------------------------------------ |
| **用户体验** | 一个入口管理所有数据流出，降低学习成本                 |
| **生态定位** | 明确 AnyKeep 为"上游数据源"，不与 Obsidian/Notion 竞争 |
| **用户粘性** | 建立同步后迁移成本极高                                 |
| **商业模式** | 高级分发能力（多目标、实时同步）可作为 Pro 付费点      |
| **技术复用** | 统一架构，避免组件重复                                 |

---

## 2. 用户故事

### 2.1 核心用户故事

```gherkin
作为 AnyKeep 用户
我想要 在一个地方管理所有数据流出配置
以便于 轻松将收藏同步到我使用的各种工具

验收标准:
  Given 我进入"知识分发中心"设置页
  Then 我能看到所有已配置的分发目标
  And 我能添加新的分发目标（Obsidian/Notion/Webhook/RSS 等）
  And 我能为每个目标配置触发方式（手动/自动/定时）
  And 我能查看分发状态和历史记录
```

### 2.2 Obsidian 用户故事

```gherkin
作为 Obsidian 用户
我想要 AnyKeep 收藏自动同步到我的 Obsidian Vault
以便于 在 Obsidian 中进行深度整理和双向链接

验收标准:
  Given 我已配置 Obsidian 本地文件夹路径
  When 我在 AnyKeep 收藏新内容
  Then 5 分钟内 Markdown 文件出现在指定目录
  And 包含：标题、URL、AI 摘要、标签（#tag 格式）、YAML frontmatter
  And 支持自定义 Markdown 模板
  And 支持手动触发立即同步
```

### 2.3 Notion 用户故事

```gherkin
作为 Notion 用户
我想要 AnyKeep 收藏自动同步到 Notion Database
以便于 在 Notion 中与其他内容关联

验收标准:
  Given 我已通过 OAuth 授权 Notion 集成
  When 我在 AnyKeep 收藏新内容
  Then Notion Database 中新增一条记录
  And 字段映射：Title, URL, Summary, Tags, Platform, Created
  And 支持选择同步到哪个 Database
  And 支持自定义属性映射
```

### 2.4 自动化用户故事

```gherkin
作为 技术型用户
我想要 通过 Webhook 将 AnyKeep 数据推送到我的自动化流程
以便于 与 n8n/Zapier/自建服务集成

验收标准:
  Given 我已配置 Webhook URL
  When 我在 AnyKeep 收藏新内容
  Then 我的 Webhook 端点收到 POST 请求
  And 包含完整的书签数据（JSON 格式）
  And 包含签名用于验证来源
  And 支持重试机制（3 次）
```

### 2.5 手动导出用户故事

```gherkin
作为 普通用户
我想要 手动导出我的收藏数据
以便于 备份或迁移到其他工具

验收标准:
  Given 我在分发中心选择"手动导出"
  When 我选择导出格式和范围
  Then 我能下载 CSV/Markdown/JSON/HTML 文件
  And 支持选择导出字段
  And 支持按文件夹/标签/平台筛选
```

---

## 3. 功能优先级

### 3.1 MVP 范围 (Q1)

| 优先级 | 功能              | 说明                                | 平台支持               | 复用现有           |
| ------ | ----------------- | ----------------------------------- | ---------------------- | ------------------ |
| **P0** | 手动导出          | 保留现有导出功能，整合到分发中心 UI | Web + Mobile + Desktop | ✅ 100%            |
| **P0** | Notion 同步       | OAuth + Database API，实时/定时同步 | Web + Mobile + Desktop | 新增               |
| **P0** | Obsidian 本地同步 | 写入 Markdown 到用户指定目录        | **⚠️ 仅桌面端**        | 部分复用 Formatter |
| **P1** | Webhook 推送      | 通用自动化接口                      | Web + Mobile + Desktop | 新增               |
| **P1** | RSS Feed          | 用户专属订阅源（支持 URL 参数筛选） | Web + Mobile + Desktop | 新增               |

> **⚠️ Obsidian 平台限制说明**：
>
> - Obsidian 同步依赖本地文件系统写入，仅支持 **Electron 桌面客户端**
> - Web 端和移动端用户看到 Obsidian 选项时，显示提示："请使用桌面客户端配置 Obsidian 同步"
> - 未来可考虑通过 Obsidian 社区插件实现 Web 端支持（P3）

### 3.2 延期功能 (Q2+)

| 优先级 | 功能                 | 延期原因                                   |
| ------ | -------------------- | ------------------------------------------ |
| P2     | Logseq 同步          | Markdown 格式兼容 Obsidian，用户可自行配置 |
| P2     | Readwise 集成        | 可通过 Webhook 实现，非核心需求            |
| P2     | Get 笔记集成         | 需 Get 笔记开放 API，非自主可控            |
| P3     | 开放 API（被动拉取） | Q3 再评估需求                              |

### 3.3 砍掉的功能

| 功能                   | 砍掉原因                           |
| ---------------------- | ---------------------------------- |
| WebDAV 同步            | 复杂度高，用户覆盖面窄             |
| Obsidian Sync 间接支持 | 本地文件夹方案已覆盖，无需单独支持 |
| 多模板市场             | MVP 阶段提供默认模板 + 自定义即可  |

---

## 4. 统一数据模型

### 4.1 分发目标配置

```typescript
/**
 * 分发目标配置 - 统一管理所有数据流出目标
 */
interface DistributionTarget {
  id: string;
  userId: string;

  // 目标类型
  targetType: "obsidian" | "notion" | "webhook" | "rss" | "manual_export";

  // 基础配置
  name: string; // 用户自定义名称，如 "我的 Obsidian 库"
  enabled: boolean;

  // 触发方式
  trigger: {
    mode: "realtime" | "scheduled" | "manual";
    scheduleInterval?: number; // 分钟，仅 scheduled 模式
    scheduleCron?: string; // 可选 cron 表达式
  };

  // 筛选条件（可选）
  filters?: {
    platforms?: string[]; // 只分发特定平台
    folders?: string[]; // 只分发特定文件夹
    tags?: string[]; // 只分发带特定标签的
    includeAiSummary?: boolean; // 是否包含 AI 摘要
  };

  // 目标特定配置
  obsidianConfig?: ObsidianTargetConfig;
  notionConfig?: NotionTargetConfig;
  webhookConfig?: WebhookTargetConfig;
  rssConfig?: RssTargetConfig;

  // 状态
  status: "idle" | "syncing" | "error";
  lastSyncAt?: Date;
  lastError?: string;
  syncedCount: number;

  createdAt: Date;
  updatedAt: Date;
}

interface ObsidianTargetConfig {
  vaultPath: string; // 本地 Vault 路径
  folderName: string; // 保存目录，如 "AnyKeep"
  filenamePattern: string; // 文件名模式，如 "{{title}}-{{date}}"
  template: string; // Markdown 模板（Handlebars）
  useYamlFrontmatter: boolean;
}

interface NotionTargetConfig {
  accessToken: string; // OAuth Token（加密存储）
  workspaceId: string;
  databaseId: string;
  propertyMapping: {
    title: string; // 映射到 Notion 属性名
    url: string;
    summary?: string;
    tags?: string;
    platform?: string;
    createdAt?: string;
  };
}

interface WebhookTargetConfig {
  url: string;
  method: "POST" | "PUT";
  headers?: Record<string, string>;
  secretKey?: string; // 用于生成签名
  retryCount: number; // 默认 3
}

interface RssTargetConfig {
  feedFormat: "rss2" | "atom";
  itemCount: number; // Feed 中最大条目数，默认 50
  includeContent: boolean; // 是否包含摘要内容
  feedToken: string; // 唯一 Token，用于 URL 访问
}
```

### 4.4 RSS Feed URL 参数筛选设计

RSS Feed 采用 **默认全部 + URL 参数筛选** 策略，兼顾简单用户和高级用户需求：

```typescript
// RSS Feed URL 格式
// GET /api/distribution/rss/:feedToken

// 支持的 URL 参数
interface RssFeedQueryParams {
  platform?: string; // 平台筛选，如 ?platform=wechat
  folder?: string; // 文件夹 ID 筛选
  tag?: string; // 标签筛选
  limit?: number; // 条目数量，默认 50，最大 100
  since?: string; // 增量获取，ISO 时间戳
}

// 使用示例
// 默认：        /api/distribution/rss/abc123
// 仅微信：      /api/distribution/rss/abc123?platform=wechat
// 仅特定文件夹：/api/distribution/rss/abc123?folder=uuid-xxx
// 组合筛选：    /api/distribution/rss/abc123?platform=bilibili&limit=20
// 增量获取：    /api/distribution/rss/abc123?since=2026-01-01T00:00:00Z
```

**设计优势**：

- **零配置**：用户只需复制 RSS URL，无需额外设置
- **灵活筛选**：通过 URL 参数实现任意筛选，无需存储额外配置
- **无状态**：服务端不存储 RSS 筛选配置，简化架构

### 4.5 分发记录

```typescript
/**
 * 分发记录 - 追踪每次同步状态
 */
interface DistributionRecord {
  id: string;
  targetId: string;
  bookmarkId: string;

  status: "pending" | "success" | "failed";
  distributedAt?: Date;

  // 目标平台返回的 ID（用于去重和更新）
  externalId?: string;

  // 错误信息
  errorMessage?: string;
  retryCount: number;

  createdAt: Date;
}
```

### 4.3 默认 Obsidian 模板

```handlebars
--- title: "{{title}}" url:
{{url}}
platform:
{{platform}}
tags: [{{#each tags}}"{{this}}"{{#unless @last}}, {{/unless}}{{/each}}] created:
{{createdAt}}
synced:
{{syncedAt}}
source: AnyKeep --- #
{{title}}

> [原文链接]({{url}})

{{#if summary}}
  ## AI 摘要

  {{summary}}

{{/if}}
## 标签

{{#each tags}}#{{this}} {{/each}}

--- *由 AnyKeep 同步于
{{syncedAt}}*
```

---

## 5. 技术架构

### 5.1 设计原则：完全解耦

知识分发中心采用 **完全解耦架构**，确保模块独立、可测试、易扩展：

| 原则           | 说明                                 | 实现方式                              |
| -------------- | ------------------------------------ | ------------------------------------- |
| **依赖倒置**   | 核心服务依赖抽象接口，不依赖具体实现 | 定义 `IAdapter`、`IFormatter` 接口    |
| **适配器模式** | 每个目标平台一个适配器，实现统一接口 | `ObsidianAdapter`、`NotionAdapter` 等 |
| **策略模式**   | 格式化逻辑可插拔替换                 | 复用现有 `formatters/`                |
| **事件驱动**   | 通过事件触发分发，解耦触发源         | `DistributionEventBus`                |
| **配置驱动**   | 所有行为通过配置决定，不硬编码       | `DistributionTarget` 配置             |

### 5.2 与现有导出模块的融合策略

**核心原则**：**复用，不重写**

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         融合策略示意图                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                    src/lib/export/ (现有模块)                    │   │
│   │                        【保持不变】                              │   │
│   │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │   │
│   │  │ csv.formatter│  │ md.formatter │  │obsidian.fmt  │  ...     │   │
│   │  └──────────────┘  └──────────────┘  └──────────────┘          │   │
│   │  ┌──────────────┐                                               │   │
│   │  │export.service│  ← 现有导出 API 入口                          │   │
│   │  └──────────────┘                                               │   │
│   └────────────────────────────┬────────────────────────────────────┘   │
│                                │                                        │
│                                │ 复用（import）                         │
│                                ▼                                        │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                   src/lib/distribution/ (新模块)                 │   │
│   │                        【新增】                                  │   │
│   │                                                                 │   │
│   │  ┌─────────────────────────────────────────────────────────┐   │   │
│   │  │                    interfaces/                           │   │   │
│   │  │  adapter.interface.ts    formatter.interface.ts          │   │   │
│   │  │  scheduler.interface.ts  event-bus.interface.ts          │   │   │
│   │  └─────────────────────────────────────────────────────────┘   │   │
│   │                                                                 │   │
│   │  ┌─────────────────────────────────────────────────────────┐   │   │
│   │  │                    core/                                 │   │   │
│   │  │  distribution.service.ts   ← 核心编排（依赖接口）         │   │   │
│   │  │  distribution.scheduler.ts ← 调度器                       │   │   │
│   │  │  distribution.registry.ts  ← 适配器注册表                 │   │   │
│   │  │  distribution.event-bus.ts ← 事件总线                     │   │   │
│   │  └─────────────────────────────────────────────────────────┘   │   │
│   │                                                                 │   │
│   │  ┌─────────────────────────────────────────────────────────┐   │   │
│   │  │                    adapters/                             │   │   │
│   │  │  obsidian.adapter.ts  ← 调用 export/formatters           │   │   │
│   │  │  notion.adapter.ts    ← Notion API                       │   │   │
│   │  │  webhook.adapter.ts   ← HTTP POST                        │   │   │
│   │  │  rss.adapter.ts       ← XML 生成                         │   │   │
│   │  │  manual-export.adapter.ts ← 包装 export.service          │   │   │
│   │  └─────────────────────────────────────────────────────────┘   │   │
│   │                                                                 │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**融合要点**：

| 现有模块                                    | 融合方式     | 说明                               |
| ------------------------------------------- | ------------ | ---------------------------------- |
| `src/lib/export/formatters/*`               | **直接复用** | `ObsidianAdapter` 内部 import 使用 |
| `src/lib/export/services/export.service.ts` | **包装复用** | `ManualExportAdapter` 包装调用     |
| `src/components/export/*`                   | **UI 整合**  | 移动到分发中心页面内               |
| `src/app/api/export/*`                      | **保留**     | 现有 API 保持兼容，内部调用新架构  |

### 5.3 解耦架构详图

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    知识分发中心 (Knowledge Distribution Hub)              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌───────────────────────────────────────────────────────────────┐     │
│   │                    DistributionService (核心)                   │     │
│   │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │     │
│   │  │  Scheduler   │  │ FormatEngine │  │ DeliveryMgr  │         │     │
│   │  │ (触发调度)    │  │ (格式转换)    │  │ (投递管理)   │         │     │
│   │  └──────────────┘  └──────────────┘  └──────────────┘         │     │
│   └───────────────────────────────────────────────────────────────┘     │
│                                    │                                    │
│         ┌──────────────────────────┼──────────────────────────┐         │
│         │                          │                          │         │
│         ▼                          ▼                          ▼         │
│   ┌─────────────┐           ┌─────────────┐           ┌─────────────┐   │
│   │  Obsidian   │           │   Notion    │           │   Webhook   │   │
│   │  Adapter    │           │   Adapter   │           │   Adapter   │   │
│   ├─────────────┤           ├─────────────┤           ├─────────────┤   │
│   │ • LocalFile │           │ • OAuth     │           │ • POST JSON │   │
│   │ • Template  │           │ • DB API    │           │ • Retry     │   │
│   │ • YAML FM   │           │ • PropMap   │           │ • Signature │   │
│   └─────────────┘           └─────────────┘           └─────────────┘   │
│         │                          │                          │         │
│         ▼                          ▼                          ▼         │
│   ┌─────────────┐           ┌─────────────┐           ┌─────────────┐   │
│   │   RSS Feed  │           │   Manual    │           │   未来扩展   │   │
│   │   Adapter   │           │   Export    │           │   Logseq等   │   │
│   ├─────────────┤           ├─────────────┤           └─────────────┘   │
│   │ • Atom/RSS2 │           │ • CSV/JSON  │                             │
│   │ • Paginate  │           │ • MD/HTML   │                             │
│   └─────────────┘           │ • ZIP       │                             │
│                             └─────────────┘                             │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 5.4 模块划分

| 模块                    | 路径                                                     | 职责                 |
| ----------------------- | -------------------------------------------------------- | -------------------- |
| `DistributionService`   | `src/lib/distribution/core/distribution.service.ts`      | 分发编排核心         |
| `DistributionScheduler` | `src/lib/distribution/core/scheduler.ts`                 | 定时/实时触发        |
| `DistributionRegistry`  | `src/lib/distribution/core/registry.ts`                  | 适配器注册表         |
| `DistributionEventBus`  | `src/lib/distribution/core/event-bus.ts`                 | 事件总线             |
| `ObsidianAdapter`       | `src/lib/distribution/adapters/obsidian.adapter.ts`      | Obsidian 适配        |
| `NotionAdapter`         | `src/lib/distribution/adapters/notion.adapter.ts`        | Notion OAuth + API   |
| `WebhookAdapter`        | `src/lib/distribution/adapters/webhook.adapter.ts`       | Webhook 推送         |
| `RssFeedAdapter`        | `src/lib/distribution/adapters/rss.adapter.ts`           | RSS 生成             |
| `ManualExportAdapter`   | `src/lib/distribution/adapters/manual-export.adapter.ts` | 手动导出（复用现有） |

### 5.5 接口定义

```typescript
// src/lib/distribution/interfaces/adapter.interface.ts

/**
 * 分发适配器接口 - 所有目标平台必须实现此接口
 */
export interface IDistributionAdapter {
  /** 适配器唯一标识 */
  readonly type: DistributionTargetType;

  /** 适配器显示名称 */
  readonly displayName: string;

  /** 支持的平台 */
  readonly supportedPlatforms: ("web" | "mobile" | "desktop")[];

  /**
   * 初始化适配器（如 OAuth 连接）
   */
  initialize(config: DistributionTarget): Promise<void>;

  /**
   * 执行分发
   * @param bookmarks 待分发的书签列表
   * @param config 分发目标配置
   * @returns 分发结果
   */
  distribute(
    bookmarks: Bookmark[],
    config: DistributionTarget,
  ): Promise<DistributionResult>;

  /**
   * 验证配置是否有效
   */
  validateConfig(config: DistributionTarget): Promise<ValidationResult>;

  /**
   * 测试连接
   */
  testConnection(config: DistributionTarget): Promise<TestConnectionResult>;
}

/**
 * 分发结果
 */
export interface DistributionResult {
  success: boolean;
  distributedCount: number;
  failedCount: number;
  records: DistributionRecord[];
  errors?: DistributionError[];
}

/**
 * 分发事件
 */
export type DistributionEvent =
  | { type: "bookmark_created"; bookmarkId: string; userId: string }
  | { type: "bookmark_updated"; bookmarkId: string; userId: string }
  | { type: "manual_trigger"; targetId: string; userId: string }
  | { type: "scheduled_trigger"; targetId: string; userId: string };
```

```typescript
// src/lib/distribution/interfaces/event-bus.interface.ts

/**
 * 事件总线接口 - 解耦事件发布和订阅
 */
export interface IDistributionEventBus {
  /**
   * 发布事件
   */
  publish(event: DistributionEvent): Promise<void>;

  /**
   * 订阅事件
   */
  subscribe(
    eventType: DistributionEvent["type"],
    handler: (event: DistributionEvent) => Promise<void>,
  ): () => void; // 返回取消订阅函数
}
```

### 5.6 目录结构

```
src/lib/distribution/
├── index.ts                           # 公共 API 导出
├── types.ts                           # 类型定义
│
├── interfaces/                        # 接口定义（依赖倒置的核心）
│   ├── adapter.interface.ts           # 适配器接口
│   ├── scheduler.interface.ts         # 调度器接口
│   └── event-bus.interface.ts         # 事件总线接口
│
├── core/                              # 核心服务
│   ├── distribution.service.ts        # 分发编排（依赖接口）
│   ├── distribution.scheduler.ts      # 调度器实现
│   ├── distribution.registry.ts       # 适配器注册表
│   └── distribution.event-bus.ts      # 事件总线实现
│
├── adapters/                          # 适配器实现
│   ├── obsidian.adapter.ts            # Obsidian（调用 export/formatters）
│   ├── notion.adapter.ts              # Notion（OAuth + API）
│   ├── webhook.adapter.ts             # Webhook（HTTP POST）
│   ├── rss.adapter.ts                 # RSS（XML 生成）
│   └── manual-export.adapter.ts       # 手动导出（包装 export.service）
│
└── __tests__/                         # 测试
    ├── distribution.service.test.ts
    ├── adapters/
    │   ├── obsidian.adapter.test.ts
    │   ├── notion.adapter.test.ts
    │   └── ...
    └── integration/
        └── distribution.integration.test.ts
```

### 5.7 事件驱动流程

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         事件驱动分发流程                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌──────────────┐                                                      │
│   │ 收藏 API     │──▶ 发布 bookmark_created 事件                        │
│   └──────────────┘                                                      │
│          │                                                              │
│          ▼                                                              │
│   ┌──────────────────────────────────────────────────────────────────┐  │
│   │                    DistributionEventBus                           │  │
│   │  订阅者:                                                          │  │
│   │  ├─ DistributionScheduler (realtime 模式目标)                     │  │
│   │  └─ 其他订阅者...                                                 │  │
│   └──────────────────────────────────────────────────────────────────┘  │
│          │                                                              │
│          ▼                                                              │
│   ┌──────────────────────────────────────────────────────────────────┐  │
│   │                    DistributionScheduler                          │  │
│   │  1. 查询启用的 realtime 目标                                      │  │
│   │  2. 筛选匹配的目标（platform/folder/tags）                        │  │
│   │  3. 调用 DistributionService.distribute()                         │  │
│   └──────────────────────────────────────────────────────────────────┘  │
│          │                                                              │
│          ▼                                                              │
│   ┌──────────────────────────────────────────────────────────────────┐  │
│   │                    DistributionService                            │  │
│   │  1. 从 Registry 获取对应 Adapter                                  │  │
│   │  2. 调用 adapter.distribute(bookmarks, config)                    │  │
│   │  3. 记录 DistributionRecord                                       │  │
│   │  4. 更新 DistributionTarget 状态                                  │  │
│   └──────────────────────────────────────────────────────────────────┘  │
│          │                                                              │
│          ▼                                                              │
│   ┌──────────────────────────────────────────────────────────────────┐  │
│   │                    具体 Adapter                                   │  │
│   │  ObsidianAdapter: 写入本地 Markdown 文件                          │  │
│   │  NotionAdapter: 调用 Notion Database API                          │  │
│   │  WebhookAdapter: POST 到用户 URL                                  │  │
│   └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 5.8 与现有模块关系（更新版）

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        模块依赖关系图                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   src/lib/export/ (现有 - 保持不变)                                      │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │  formatters/                                                    │   │
│   │  ├── csv.formatter.ts                                           │   │
│   │  ├── markdown.formatter.ts                                      │   │
│   │  ├── obsidian.formatter.ts  ◄──────────────────────────────┐    │   │
│   │  ├── json.formatter.ts                                     │    │   │
│   │  └── html.formatter.ts                                     │    │   │
│   │                                                            │    │   │
│   │  services/                                                 │    │   │
│   │  └── export.service.ts  ◄───────────────────────────────┐  │    │   │
│   └─────────────────────────────────────────────────────────│──│────┘   │
│                                                             │  │        │
│   src/lib/distribution/ (新增 - 解耦设计)                    │  │        │
│   ┌─────────────────────────────────────────────────────────│──│────┐   │
│   │                                                         │  │    │   │
│   │  interfaces/  (抽象层)                                  │  │    │   │
│   │  ├── adapter.interface.ts                               │  │    │   │
│   │  └── event-bus.interface.ts                             │  │    │   │
│   │                                                         │  │    │   │
│   │  core/  (编排层 - 依赖接口，不依赖具体实现)               │  │    │   │
│   │  ├── distribution.service.ts                            │  │    │   │
│   │  ├── distribution.scheduler.ts                          │  │    │   │
│   │  └── distribution.registry.ts                           │  │    │   │
│   │                                                         │  │    │   │
│   │  adapters/  (实现层)                                    │  │    │   │
│   │  ├── obsidian.adapter.ts ───────────────────────────────│──┘    │   │
│   │  │   └── import { ObsidianFormatter }                   │       │   │
│   │  ├── manual-export.adapter.ts ──────────────────────────┘       │   │
│   │  │   └── import { ExportService }                               │   │
│   │  ├── notion.adapter.ts    (独立实现)                            │   │
│   │  ├── webhook.adapter.ts   (独立实现)                            │   │
│   │  └── rss.adapter.ts       (独立实现)                            │   │
│   │                                                                 │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│   依赖方向: distribution → export (单向依赖，export 模块无需修改)       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**解耦保证**：

| 保证项             | 说明                                                 |
| ------------------ | ---------------------------------------------------- |
| **现有模块零修改** | `src/lib/export/` 代码完全不变                       |
| **单向依赖**       | distribution → export，无反向依赖                    |
| **接口隔离**       | 核心服务只依赖 `IDistributionAdapter` 接口           |
| **可独立测试**     | 每个 Adapter 可 mock 依赖独立测试                    |
| **可独立部署**     | 可按需加载 Adapter（如移动端不加载 ObsidianAdapter） |

---

## 6. UI/UX 设计

### 6.1 入口设计

**主入口**：侧边栏 → **知识分发** (或 设置 → 知识分发)

**图标建议**：📤 或 🔗

### 6.2 页面结构

```
知识分发中心
├── 分发目标列表
│   ├── [已配置目标卡片 1] - Obsidian - 已启用 - 最后同步: 5分钟前
│   ├── [已配置目标卡片 2] - Notion - 已启用 - 同步中...
│   └── [+ 添加分发目标] 按钮
│
├── 快速操作
│   ├── [手动导出] - 下载 CSV/MD/JSON
│   ├── [立即同步全部] - 触发所有启用目标
│   └── [查看同步日志]
│
└── 统计概览
    ├── 今日分发: 23 条
    ├── 本周分发: 156 条
    └── 总分发量: 1,234 条
```

### 6.3 添加分发目标流程

```
Step 1: 选择目标类型
┌─────────────────────────────────────────────────┐
│  选择分发目标                                    │
│                                                 │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│  │ Obsidian│  │ Notion  │  │ Webhook │        │
│  │   📝    │  │   📄    │  │   🔗    │        │
│  │ 本地库  │  │ Database│  │ 自动化  │        │
│  └─────────┘  └─────────┘  └─────────┘        │
│                                                 │
│  ┌─────────┐  ┌─────────┐                      │
│  │   RSS   │  │  导出   │                      │
│  │   📡    │  │   📥    │                      │
│  │ 订阅源  │  │ 手动下载│                      │
│  └─────────┘  └─────────┘                      │
└─────────────────────────────────────────────────┘

Step 2: 配置连接（以 Notion 为例）
┌─────────────────────────────────────────────────┐
│  连接 Notion                                     │
│                                                 │
│  [连接 Notion 账户] ← OAuth 按钮                 │
│                                                 │
│  ✅ 已连接: workspace-name                      │
│                                                 │
│  选择 Database:                                 │
│  ┌─────────────────────────────────────────┐   │
│  │ 📊 我的收藏库                            │   │
│  │ 📊 阅读清单                              │   │
│  │ 📊 知识库                                │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  [下一步]                                       │
└─────────────────────────────────────────────────┘

Step 3: 配置同步规则
┌─────────────────────────────────────────────────┐
│  同步规则                                        │
│                                                 │
│  触发方式:                                       │
│  ○ 实时同步 (收藏后立即同步)                     │
│  ● 定时同步 (每 [5] 分钟)                        │
│  ○ 仅手动触发                                    │
│                                                 │
│  筛选条件 (可选):                                │
│  □ 仅同步特定平台: [微信公众号 ▼]               │
│  □ 仅同步特定文件夹: [选择文件夹...]            │
│  □ 仅同步带标签的内容                           │
│  ☑ 包含 AI 摘要                                 │
│                                                 │
│  [测试连接] [保存并启用]                         │
└─────────────────────────────────────────────────┘
```

### 6.4 分发目标卡片设计

```
┌─────────────────────────────────────────────────────────────┐
│  📝 Obsidian - 我的知识库                        [启用 ●]   │
├─────────────────────────────────────────────────────────────┤
│  路径: C:\Users\Xiafe\Obsidian\AnyKeep                      │
│  触发: 每 5 分钟自动同步                                    │
│  状态: ✅ 正常 | 最后同步: 2 分钟前 | 已同步: 234 条        │
├─────────────────────────────────────────────────────────────┤
│  [立即同步] [编辑] [查看日志] [删除]                        │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. API 设计

### 7.1 分发目标管理

```typescript
// GET /api/distribution/targets
// 获取用户所有分发目标

// POST /api/distribution/targets
// 创建新分发目标

// PUT /api/distribution/targets/:id
// 更新分发目标配置

// DELETE /api/distribution/targets/:id
// 删除分发目标

// POST /api/distribution/targets/:id/sync
// 手动触发同步

// GET /api/distribution/targets/:id/logs
// 获取分发日志
```

### 7.2 Notion OAuth

```typescript
// GET /api/distribution/notion/auth
// 发起 Notion OAuth 授权

// GET /api/distribution/notion/callback
// Notion OAuth 回调

// GET /api/distribution/notion/databases
// 获取用户的 Notion Databases 列表
```

### 7.3 RSS Feed

```typescript
// GET /api/distribution/rss/:feedToken
// 用户专属 RSS Feed（无需认证，通过 feedToken 作为访问凭证）

// 支持的查询参数（见 4.4 节详细设计）
// ?platform=wechat        - 平台筛选
// ?folder=uuid            - 文件夹筛选
// ?tag=技术               - 标签筛选
// ?limit=20               - 条目数量（默认 50，最大 100）
// ?since=2026-01-01T00:00:00Z - 增量获取

// 响应格式：RSS 2.0 或 Atom（根据 Accept header 或配置）
// Content-Type: application/rss+xml 或 application/atom+xml
```

### 7.4 手动导出（复用现有）

```typescript
// POST /api/distribution/export
// 手动导出，复用现有 export API 逻辑
```

---

## 8. 数据库设计

### 8.1 新增表

```sql
-- 分发目标配置表
CREATE TABLE distribution_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  target_type TEXT NOT NULL CHECK (target_type IN ('obsidian', 'notion', 'webhook', 'rss', 'manual_export')),
  name TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,

  -- 触发配置
  trigger_mode TEXT NOT NULL DEFAULT 'manual' CHECK (trigger_mode IN ('realtime', 'scheduled', 'manual')),
  schedule_interval_minutes INTEGER,

  -- 筛选条件
  filter_platforms TEXT[],
  filter_folders UUID[],
  filter_tags TEXT[],
  include_ai_summary BOOLEAN DEFAULT true,

  -- 目标特定配置 (JSONB)
  target_config JSONB NOT NULL DEFAULT '{}',

  -- 状态
  status TEXT DEFAULT 'idle' CHECK (status IN ('idle', 'syncing', 'error')),
  last_sync_at TIMESTAMPTZ,
  last_error TEXT,
  synced_count INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS 策略
ALTER TABLE distribution_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own targets"
  ON distribution_targets
  FOR ALL
  USING (auth.uid() = user_id);

-- 分发记录表
CREATE TABLE distribution_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_id UUID NOT NULL REFERENCES distribution_targets(id) ON DELETE CASCADE,
  bookmark_id UUID NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,

  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
  distributed_at TIMESTAMPTZ,
  external_id TEXT,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE (target_id, bookmark_id)
);

-- RLS 策略
ALTER TABLE distribution_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own records"
  ON distribution_records
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM distribution_targets
      WHERE id = distribution_records.target_id
      AND user_id = auth.uid()
    )
  );

-- 索引
CREATE INDEX idx_distribution_targets_user ON distribution_targets(user_id);
CREATE INDEX idx_distribution_records_target ON distribution_records(target_id);
CREATE INDEX idx_distribution_records_status ON distribution_records(status) WHERE status = 'pending';
```

---

## 9. 实现计划

### 9.1 Phase 1: 基础架构 + 手动导出迁移 (Week 1)

| 任务                                  | 说明         |
| ------------------------------------- | ------------ |
| 创建 `src/lib/distribution/` 模块结构 | 统一目录     |
| 实现 `DistributionService` 核心       | 分发编排     |
| 迁移手动导出到 `ManualExportAdapter`  | 复用现有代码 |
| 创建分发中心 UI 页面                  | 基础布局     |
| 数据库迁移                            | 创建表和索引 |

### 9.2 Phase 2: Obsidian 同步 (Week 2)

| 任务                              | 说明               |
| --------------------------------- | ------------------ |
| 实现 `ObsidianAdapter`            | 本地文件写入       |
| 实现 `FormatEngine` Obsidian 模板 | 复用 formatter     |
| 添加 Obsidian 配置 UI             | 路径选择、模板编辑 |
| 实现 `DistributionScheduler`      | 定时触发           |
| 测试 Windows/Mac 路径兼容性       | 跨平台             |

### 9.3 Phase 3: Notion 同步 (Week 3)

| 任务                   | 说明         |
| ---------------------- | ------------ |
| 实现 Notion OAuth 流程 | 授权回调     |
| 实现 `NotionAdapter`   | Database API |
| 属性映射 UI            | 可视化配置   |
| 错误处理和重试         | API 限流     |

### 9.4 Phase 4: Webhook + RSS (Week 4)

| 任务                  | 说明             |
| --------------------- | ---------------- |
| 实现 `WebhookAdapter` | POST 推送 + 签名 |
| 实现 `RssFeedAdapter` | Atom/RSS2 生成   |
| RSS 端点和缓存        | 性能优化         |
| 分发日志和统计        | UI 完善          |

---

## 10. 成功指标

| 指标                | 目标     | 说明                                        |
| ------------------- | -------- | ------------------------------------------- |
| 配置转化率          | > 30%    | 进入分发中心的用户中，完成至少 1 个目标配置 |
| Notion 连接成功率   | > 95%    | OAuth 流程完成率                            |
| Obsidian 同步成功率 | > 99%    | 文件写入成功率                              |
| 平均同步延迟        | < 5 分钟 | 实时模式下，收藏到同步完成                  |
| 用户留存提升        | +10%     | 配置同步后的 7 日留存                       |

---

## 11. 风险与对策

| 风险                  | 影响     | 对策                      |
| --------------------- | -------- | ------------------------- |
| Notion API 限流       | 同步失败 | 实现队列和指数退避重试    |
| Obsidian 路径权限问题 | 无法写入 | 清晰的权限说明 + 路径验证 |
| 大量书签同步性能      | 卡顿     | 分批处理 + 后台任务       |
| 用户 OAuth Token 过期 | 同步中断 | Token 刷新 + 用户通知     |

---

## 12. 附录：砍掉功能的理由

| 功能                     | 砍掉理由               | 替代方案                             |
| ------------------------ | ---------------------- | ------------------------------------ |
| **WebDAV**               | 配置复杂，用户群小     | 用户可用 Webhook + 自建服务          |
| **Logseq 专用**          | Markdown 兼容 Obsidian | 用户配置 Obsidian 同步到 Logseq 目录 |
| **Get 笔记**             | 依赖第三方开放 API     | 后续评估，可用开放 API               |
| **Readwise**             | 非核心用户群           | Webhook 推送到 Readwise API          |
| **模板市场**             | MVP 阶段无必要         | 提供默认模板 + 自定义                |
| **开放 API（被动拉取）** | Q3 再评估              | Webhook 推送覆盖多数场景             |

---

## 13. 审核清单

请 Xiafe 确认以下内容：

### 功能决策

- [ ] 功能合并方向是否正确？（三合一 → 知识分发中心）
- [ ] 优先级排序是否合理？（Notion P0 是否正确）
- [ ] 砍掉的功能是否可接受？（WebDAV、Logseq专用、模板市场）

### 平台限制

- [ ] Obsidian 仅桌面端支持是否可接受？
- [ ] Web/移动端显示"请使用桌面客户端"提示是否合理？

### RSS 设计

- [ ] RSS URL 参数筛选方案是否合理？
- [ ] 默认 50 条、最大 100 条限制是否合适？

### 架构设计

- [ ] 完全解耦架构是否满足需求？
- [ ] 现有导出模块零修改的融合策略是否可行？
- [ ] 事件驱动的分发触发机制是否合理？

### 实现计划

- [ ] 4 周时间估算是否合理？
- [ ] Phase 优先级是否正确？

### 其他

- [ ] 是否有遗漏的重要场景？
- [ ] 是否需要调整或补充？

---

_文档结束_
