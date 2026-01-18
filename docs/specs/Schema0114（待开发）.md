# InteractiveSlotFilling Schema 设计规范

> **版本**: 1.0.0
> **日期**: 2026-01-14
> **作者**: 首席架构师
> **状态**: 待实现

---

## 目录

1. [架构概述](#一架构概述)
2. [类型系统设计](#二类型系统设计)
3. [10 个核心 Schema 定义](#三10-个核心-schema-定义)
4. [SlotFilling 引擎设计](#四slotfilling-引擎设计)
5. [集成方案](#五集成方案)
6. [前端组件（可选）](#六前端组件可选)
7. [测试策略](#七测试策略)
8. [实现路线图](#八实现路线图)

---

## 一、架构概述

### 1.1 问题背景

当前 AnyKeep 的 AI 系统存在以下问题：

1. **参数收集不完整**：用户说"导出书签"，系统直接执行，缺少格式、范围等必要参数
2. **追问体验差**：缺乏结构化的追问机制，对话流程不连贯
3. **无状态管理**：多轮对话中无法追踪已收集的参数

### 1.2 解决方案

引入 **InteractiveSlotFilling** 机制：

```
┌─────────────────────────────────────────────────────────────────────┐
│                         用户输入                                     │
│                  "帮我导出最近一周的书签"                             │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                      IntentClassifier                                │
│                    识别意图: data_export                              │
└──────────────────────────────┬───────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                 SlotExtractor (参数提取器)                            │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  从用户消息中提取:                                              │  │
│  │  - scope: "date_range" ✅ (从"最近一周"推断)                   │  │
│  │  - date_range: "last_7_days" ✅                                │  │
│  │  - format: ❓ 未提取                                           │  │
│  └────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────┬───────────────────────────────────────┘
                               │
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                   SlotFillingEngine (槽位填充引擎)                    │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  评估 Schema: data_export                                      │  │
│  │  - format: required=true, filled=false → 需要追问              │  │
│  │  - scope: required=true, filled=true ✅                        │  │
│  │  - date_range: dependsOn scope="date_range", filled=true ✅    │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                               │                                      │
│                               ▼                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  生成追问: "请选择导出格式：CSV、JSON、Markdown、HTML？"        │  │
│  └────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
                               │
                               ▼ (用户回复 "markdown")
┌──────────────────────────────────────────────────────────────────────┐
│                      Workflow Executor                               │
│            执行 data_export(format="markdown", ...)                  │
└──────────────────────────────────────────────────────────────────────┘
```

### 1.3 设计目标

| 目标 | 描述 | 度量指标 |
|------|------|----------|
| **完整性** | 确保执行前参数完整 | 必填槽位填充率 100% |
| **自然性** | 追问对话流畅自然 | 用户满意度 > 4.0/5.0 |
| **高效性** | 尽量从首轮消息提取参数 | 平均追问轮次 < 1.5 |
| **可扩展** | 易于添加新 Schema | 新增 Schema < 30 分钟 |

---

## 二、类型系统设计

### 2.1 核心类型定义

```typescript
// 文件: src/lib/slot-filling/types/slot.types.ts

/**
 * 槽位值类型
 */
export type SlotValueType =
  | "text"        // 自由文本
  | "number"      // 数值
  | "boolean"     // 布尔值
  | "date"        // 日期
  | "date_range"  // 日期范围
  | "enum"        // 单选枚举
  | "multi_enum"  // 多选枚举
  | "folder"      // 文件夹选择
  | "tags"        // 标签列表
  | "bookmarks";  // 书签选择

/**
 * 槽位验证规则
 */
export interface SlotValidation {
  /** 最小值（number 类型） */
  min?: number;
  /** 最大值（number 类型） */
  max?: number;
  /** 最小长度（text/tags 类型） */
  minLength?: number;
  /** 最大长度（text/tags 类型） */
  maxLength?: number;
  /** 正则模式（text 类型） */
  pattern?: string;
  /** 自定义验证函数名 */
  customValidator?: string;
}

/**
 * 槽位依赖条件
 */
export interface SlotDependency {
  /** 依赖的槽位 ID */
  slot: string;
  /** 条件类型 */
  condition: "equals" | "not_equals" | "exists" | "not_exists" | "in" | "not_in";
  /** 条件值（equals/not_equals/in/not_in 时使用） */
  value?: unknown;
}

/**
 * 追问模板
 */
export interface SlotPromptTemplates {
  /** 首次询问模板 */
  ask: string;
  /** 澄清确认模板 */
  clarify: string;
  /** 值无效时的提示 */
  invalid: string;
  /** 可选：快捷选项提示 */
  quickOptions?: string;
}

/**
 * 槽位定义
 */
export interface SlotDefinition {
  /** 槽位 ID（唯一标识） */
  id: string;
  /** 显示名称 */
  name: string;
  /** 槽位描述（用于 LLM 理解） */
  description?: string;
  /** 值类型 */
  type: SlotValueType;
  /** 是否必填 */
  required: boolean;
  /** 默认值 */
  default?: unknown;
  /** 枚举选项（enum/multi_enum 类型） */
  options?: SlotOption[];
  /** 依赖条件 */
  dependsOn?: SlotDependency;
  /** 验证规则 */
  validation?: SlotValidation;
  /** 追问模板 */
  promptTemplates: SlotPromptTemplates;
  /** 提取器提示（帮助 LLM 从自然语言提取值） */
  extractionHints?: string[];
  /** 同义词映射 */
  synonyms?: Record<string, unknown>;
  /** 优先级（影响追问顺序，数值越小越优先） */
  priority?: number;
}

/**
 * 枚举选项
 */
export interface SlotOption {
  /** 选项值 */
  value: string;
  /** 显示标签 */
  label: string;
  /** 选项描述 */
  description?: string;
  /** 是否为默认选项 */
  isDefault?: boolean;
}

/**
 * 风险等级
 */
export type RiskLevel = "low" | "medium" | "high";

/**
 * 工作流槽位 Schema
 */
export interface WorkflowSlotSchema {
  /** Schema ID（与 workflowId 一致） */
  schemaId: string;
  /** 工作流 ID */
  workflowId: string;
  /** Schema 名称 */
  name: string;
  /** Schema 描述 */
  description: string;
  /** Schema 版本 */
  version: string;
  /** 触发意图模式（关键词列表） */
  intentPatterns: string[];
  /** 语义匹配文本（用于向量相似度匹配） */
  semanticPatterns?: string[];
  /** 槽位定义列表 */
  slots: SlotDefinition[];
  /** 是否需要确认 */
  confirmationRequired: boolean;
  /** 确认消息模板（支持 {slot_id} 变量替换） */
  confirmationMessage?: string;
  /** 风险等级 */
  riskLevel: RiskLevel;
  /** 动态风险评估规则（可选） */
  dynamicRiskRules?: DynamicRiskRule[];
}

/**
 * 动态风险评估规则
 */
export interface DynamicRiskRule {
  /** 条件表达式 */
  condition: string;
  /** 满足条件时的风险等级 */
  riskLevel: RiskLevel;
  /** 满足条件时是否需要确认 */
  requiresConfirmation: boolean;
}
```

### 2.2 引擎相关类型

```typescript
// 文件: src/lib/slot-filling/types/engine.types.ts

/**
 * 槽位填充状态
 */
export interface SlotFillingState {
  /** Schema ID */
  schemaId: string;
  /** 已填充的槽位值 */
  filledSlots: Record<string, unknown>;
  /** 当前正在询问的槽位 */
  currentSlot?: string;
  /** 对话历史（用于上下文） */
  conversationHistory: ConversationTurn[];
  /** 状态 */
  status: "collecting" | "confirming" | "ready" | "cancelled";
  /** 创建时间 */
  createdAt: string;
  /** 更新时间 */
  updatedAt: string;
}

/**
 * 对话轮次
 */
export interface ConversationTurn {
  /** 角色 */
  role: "user" | "assistant";
  /** 消息内容 */
  content: string;
  /** 提取的槽位（user 角色时） */
  extractedSlots?: Record<string, unknown>;
  /** 询问的槽位（assistant 角色时） */
  askedSlot?: string;
  /** 时间戳 */
  timestamp: string;
}

/**
 * 槽位填充动作
 */
export type SlotFillingAction =
  | { type: "ask"; slotId: string; prompt: string; options?: SlotOption[] }
  | { type: "clarify"; slotId: string; prompt: string; currentValue: unknown }
  | { type: "confirm"; message: string; summary: Record<string, unknown> }
  | { type: "ready"; slots: Record<string, unknown> }
  | { type: "error"; message: string; code: string };

/**
 * 槽位提取结果
 */
export interface SlotExtractionResult {
  /** 提取的槽位值 */
  slots: Record<string, unknown>;
  /** 提取置信度 */
  confidence: Record<string, number>;
  /** 原始消息 */
  rawMessage: string;
  /** 提取耗时（ms） */
  extractionTimeMs: number;
}

/**
 * 槽位验证结果
 */
export interface SlotValidationResult {
  /** 是否有效 */
  valid: boolean;
  /** 错误消息（无效时） */
  errorMessage?: string;
  /** 建议值（可选） */
  suggestedValue?: unknown;
}
```

---

## 三、10 个核心 Schema 定义

### 3.1 Schema 总览

| # | Schema ID | 名称 | 槽位数 | 必填 | 条件依赖 | 确认 | 风险 |
|---|-----------|------|--------|------|----------|------|------|
| 1 | `search_and_filter` | 智能搜索 | 3 | 1 | ❌ | ❌ | 低 |
| 2 | `data_export` | 数据导出 | 5 | 2 | ✅ | ❌ | 低 |
| 3 | `batch_tag` | 批量标签 | 4 | 3 | ✅ | ✅ | 中 |
| 4 | `batch_move` | 批量移动 | 3 | 2 | ❌ | ✅ | 中 |
| 5 | `duplicate_cleanup` | 重复清理 | 4 | 2 | ❌ | ✅ | 高 |
| 6 | `reading_plan` | 阅读计划 | 6 | 3 | ✅ | ❌ | 低 |
| 7 | `periodic_report` | 周期报告 | 5 | 2 | ❌ | ❌ | 低 |
| 8 | `thematic_synthesis` | 主题合成 | 4 | 2 | ❌ | ❌ | 低 |
| 9 | `backup_restore` | 备份恢复 | 5 | 1 | ✅ | ✅ | 高 |
| 10 | `health_check` | 健康检查 | 4 | 1 | ❌ | 动态 | 动态 |

### 3.2 Schema 详细定义

#### Schema 1: 智能搜索 (search_and_filter)

```typescript
export const searchAndFilterSchema: WorkflowSlotSchema = {
  schemaId: "search_and_filter",
  workflowId: "search_and_filter",
  name: "智能搜索",
  description: "搜索并筛选书签，支持语义搜索和关键词匹配",
  version: "1.0.0",
  intentPatterns: [
    "搜索", "查找", "找一下", "有没有", "哪些", "搜一下",
    "帮我找", "查一查", "看看有没有"
  ],
  semanticPatterns: [
    "我想找关于某个主题的收藏",
    "帮我搜索之前保存的内容",
    "有没有相关的书签"
  ],
  slots: [
    {
      id: "query",
      name: "搜索词",
      description: "用户想要搜索的关键词或主题",
      type: "text",
      required: true,
      priority: 1,
      validation: {
        minLength: 1,
        maxLength: 200
      },
      extractionHints: [
        "搜索 X", "找 X", "关于 X", "X 相关"
      ],
      promptTemplates: {
        ask: "请问您想搜索什么内容？",
        clarify: "您是想搜索「{value}」相关的内容吗？",
        invalid: "搜索词不能为空，请告诉我您想找什么"
      }
    },
    {
      id: "search_mode",
      name: "搜索模式",
      description: "搜索匹配方式",
      type: "enum",
      required: false,
      default: "semantic",
      priority: 2,
      options: [
        { value: "semantic", label: "语义搜索", description: "理解语义，找相关内容", isDefault: true },
        { value: "keyword", label: "关键词匹配", description: "精确匹配关键词" },
        { value: "title_only", label: "仅搜标题", description: "只在标题中搜索" }
      ],
      synonyms: {
        "智能": "semantic",
        "精确": "keyword",
        "标题": "title_only"
      },
      promptTemplates: {
        ask: "您想用哪种搜索方式？语义搜索（推荐）、关键词匹配、还是仅搜标题？",
        clarify: "确认使用「{value}」模式搜索？",
        invalid: "请选择有效的搜索模式"
      }
    },
    {
      id: "limit",
      name: "结果数量",
      description: "返回的搜索结果数量",
      type: "number",
      required: false,
      default: 20,
      priority: 3,
      validation: { min: 1, max: 100 },
      extractionHints: [
        "前 N 条", "N 个结果", "最多 N 条"
      ],
      promptTemplates: {
        ask: "需要返回多少条结果？（默认 20 条）",
        clarify: "确认返回 {value} 条结果？",
        invalid: "结果数量需在 1-100 之间"
      }
    }
  ],
  confirmationRequired: false,
  riskLevel: "low"
};
```

#### Schema 2: 数据导出 (data_export)

```typescript
export const dataExportSchema: WorkflowSlotSchema = {
  schemaId: "data_export",
  workflowId: "data_export",
  name: "数据导出",
  description: "将书签数据导出为指定格式",
  version: "1.0.0",
  intentPatterns: [
    "导出", "备份", "下载", "保存到本地", "输出",
    "导出数据", "备份书签", "下载书签"
  ],
  semanticPatterns: [
    "我想把书签导出来",
    "帮我备份一下收藏",
    "把数据下载到本地"
  ],
  slots: [
    {
      id: "format",
      name: "导出格式",
      description: "导出文件的格式",
      type: "enum",
      required: true,
      priority: 1,
      options: [
        { value: "csv", label: "CSV", description: "表格格式，Excel 可打开" },
        { value: "json", label: "JSON", description: "结构化数据，开发者友好" },
        { value: "markdown", label: "Markdown", description: "文档格式，适合笔记" },
        { value: "html", label: "HTML", description: "网页格式，可导入浏览器" },
        { value: "obsidian", label: "Obsidian", description: "Obsidian 笔记格式" }
      ],
      synonyms: {
        "表格": "csv",
        "excel": "csv",
        "笔记": "markdown",
        "md": "markdown",
        "网页": "html",
        "浏览器": "html"
      },
      promptTemplates: {
        ask: "请选择导出格式：CSV（表格）、JSON、Markdown（笔记）、HTML（浏览器）、Obsidian？",
        clarify: "确认导出为 {value} 格式？",
        invalid: "请选择有效的导出格式",
        quickOptions: "常用：Markdown、CSV"
      }
    },
    {
      id: "scope",
      name: "导出范围",
      description: "要导出的书签范围",
      type: "enum",
      required: true,
      default: "all",
      priority: 2,
      options: [
        { value: "all", label: "全部", description: "导出所有书签", isDefault: true },
        { value: "selected", label: "当前选中", description: "仅导出选中的书签" },
        { value: "folder", label: "指定文件夹", description: "导出某个文件夹" },
        { value: "tagged", label: "指定标签", description: "导出带某标签的书签" },
        { value: "date_range", label: "时间范围", description: "导出指定时间段" }
      ],
      synonyms: {
        "所有": "all",
        "全部书签": "all",
        "这些": "selected",
        "选中的": "selected",
        "最近": "date_range"
      },
      promptTemplates: {
        ask: "导出哪些书签？全部、当前选中、指定文件夹、带特定标签、还是指定时间？",
        clarify: "确认导出「{value}」范围的书签？",
        invalid: "请选择有效的导出范围"
      }
    },
    {
      id: "folder_id",
      name: "目标文件夹",
      description: "要导出的文件夹",
      type: "folder",
      required: false,
      priority: 3,
      dependsOn: { slot: "scope", condition: "equals", value: "folder" },
      promptTemplates: {
        ask: "请选择要导出的文件夹",
        clarify: "确认导出「{value}」文件夹下的书签？",
        invalid: "请选择有效的文件夹"
      }
    },
    {
      id: "date_range",
      name: "时间范围",
      description: "要导出的时间范围",
      type: "enum",
      required: false,
      priority: 3,
      dependsOn: { slot: "scope", condition: "equals", value: "date_range" },
      options: [
        { value: "last_7_days", label: "最近 7 天", isDefault: true },
        { value: "last_30_days", label: "最近 30 天" },
        { value: "last_90_days", label: "最近 90 天" },
        { value: "this_year", label: "今年" },
        { value: "all_time", label: "全部时间" }
      ],
      synonyms: {
        "一周": "last_7_days",
        "一个月": "last_30_days",
        "三个月": "last_90_days"
      },
      promptTemplates: {
        ask: "选择时间范围：最近 7 天、30 天、90 天、今年、还是全部？",
        clarify: "确认导出「{value}」的书签？",
        invalid: "请选择有效的时间范围"
      }
    },
    {
      id: "include_fields",
      name: "包含字段",
      description: "导出时包含的字段",
      type: "multi_enum",
      required: false,
      default: ["title", "url", "tags", "created_at"],
      priority: 4,
      options: [
        { value: "title", label: "标题" },
        { value: "url", label: "链接" },
        { value: "summary", label: "摘要" },
        { value: "tags", label: "标签" },
        { value: "folder", label: "文件夹" },
        { value: "created_at", label: "创建时间" },
        { value: "platform", label: "来源平台" }
      ],
      promptTemplates: {
        ask: "需要导出哪些字段？（默认：标题、链接、标签、创建时间）",
        clarify: "确认导出字段：{value}？",
        invalid: "请选择至少一个导出字段"
      }
    }
  ],
  confirmationRequired: false,
  riskLevel: "low"
};
```

#### Schema 3: 批量标签 (batch_tag)

```typescript
export const batchTagSchema: WorkflowSlotSchema = {
  schemaId: "batch_tag",
  workflowId: "batch_tag",
  name: "批量标签",
  description: "为多个书签批量添加或移除标签",
  version: "1.0.0",
  intentPatterns: [
    "批量打标签", "批量添加标签", "给这些加标签", "统一打标",
    "批量标签", "加标签", "打标签", "移除标签", "删除标签"
  ],
  semanticPatterns: [
    "给这些书签都加上某个标签",
    "批量给收藏打标签",
    "把这些的标签都删掉"
  ],
  slots: [
    {
      id: "action",
      name: "操作类型",
      description: "标签操作类型",
      type: "enum",
      required: true,
      default: "add",
      priority: 1,
      options: [
        { value: "add", label: "添加", description: "添加新标签", isDefault: true },
        { value: "remove", label: "移除", description: "移除指定标签" },
        { value: "replace", label: "替换", description: "替换所有标签" }
      ],
      synonyms: {
        "加": "add",
        "打": "add",
        "删": "remove",
        "去掉": "remove"
      },
      promptTemplates: {
        ask: "您想添加标签、移除标签、还是替换标签？",
        clarify: "确认执行「{value}」标签操作？",
        invalid: "请选择：添加、移除、替换"
      }
    },
    {
      id: "tags",
      name: "标签列表",
      description: "要操作的标签",
      type: "tags",
      required: true,
      priority: 2,
      validation: { minLength: 1, maxLength: 20 },
      extractionHints: [
        "标签 X", "打上 X", "加 X 标签"
      ],
      promptTemplates: {
        ask: "请输入要{action}的标签（多个标签用逗号分隔）",
        clarify: "确认{action}标签：{value}？",
        invalid: "请至少输入一个标签，最多 20 个"
      }
    },
    {
      id: "scope",
      name: "操作范围",
      description: "批量操作的书签范围",
      type: "enum",
      required: true,
      priority: 3,
      options: [
        { value: "selected", label: "当前选中", description: "操作选中的书签" },
        { value: "folder", label: "指定文件夹", description: "操作文件夹内书签" },
        { value: "search_result", label: "搜索结果", description: "操作搜索结果" },
        { value: "untagged", label: "无标签书签", description: "操作所有无标签书签" }
      ],
      promptTemplates: {
        ask: "对哪些书签操作？当前选中、指定文件夹、搜索结果、还是所有无标签书签？",
        clarify: "确认对「{value}」范围的书签操作？",
        invalid: "请选择有效的操作范围"
      }
    },
    {
      id: "folder_id",
      name: "目标文件夹",
      description: "要操作的文件夹",
      type: "folder",
      required: false,
      priority: 4,
      dependsOn: { slot: "scope", condition: "equals", value: "folder" },
      promptTemplates: {
        ask: "请选择目标文件夹",
        clarify: "确认对「{value}」文件夹下的书签操作？",
        invalid: "请选择有效的文件夹"
      }
    }
  ],
  confirmationRequired: true,
  confirmationMessage: "即将对 {count} 个书签{action} {tags_count} 个标签：{tags}，确认执行？",
  riskLevel: "medium"
};
```

#### Schema 4: 批量移动 (batch_move)

```typescript
export const batchMoveSchema: WorkflowSlotSchema = {
  schemaId: "batch_move",
  workflowId: "batch_move",
  name: "批量移动",
  description: "将书签批量移动到指定文件夹",
  version: "1.0.0",
  intentPatterns: [
    "移动到", "放到", "归到", "挪到", "整理到",
    "批量移动", "移到", "搬到"
  ],
  semanticPatterns: [
    "把这些书签移动到某个文件夹",
    "整理到一个文件夹里",
    "归类到指定位置"
  ],
  slots: [
    {
      id: "target_folder",
      name: "目标文件夹",
      description: "移动的目标文件夹",
      type: "folder",
      required: true,
      priority: 1,
      extractionHints: [
        "移动到 X", "放到 X", "X 文件夹"
      ],
      promptTemplates: {
        ask: "请选择要移动到的目标文件夹",
        clarify: "确认移动到「{value}」文件夹？",
        invalid: "请选择有效的目标文件夹"
      }
    },
    {
      id: "source",
      name: "来源书签",
      description: "要移动的书签来源",
      type: "enum",
      required: true,
      default: "selected",
      priority: 2,
      options: [
        { value: "selected", label: "当前选中", isDefault: true },
        { value: "search_result", label: "搜索结果" },
        { value: "current_folder", label: "当前文件夹" },
        { value: "unorganized", label: "未整理书签" }
      ],
      promptTemplates: {
        ask: "移动哪些书签？当前选中、搜索结果、当前文件夹、还是未整理书签？",
        clarify: "确认移动「{value}」的书签？",
        invalid: "请选择有效的来源"
      }
    },
    {
      id: "duplicate_handling",
      name: "重复处理",
      description: "目标文件夹已有相同书签时的处理方式",
      type: "enum",
      required: false,
      default: "skip",
      priority: 3,
      options: [
        { value: "skip", label: "跳过", description: "保留原有，不移动重复项", isDefault: true },
        { value: "overwrite", label: "覆盖", description: "用新书签覆盖旧书签" },
        { value: "keep_both", label: "都保留", description: "同时保留新旧书签" }
      ],
      promptTemplates: {
        ask: "如果目标文件夹已有相同书签，如何处理？跳过、覆盖、还是都保留？",
        clarify: "确认重复时「{value}」？",
        invalid: "请选择：跳过、覆盖、都保留"
      }
    }
  ],
  confirmationRequired: true,
  confirmationMessage: "即将移动 {count} 个书签到「{target_folder}」，确认执行？",
  riskLevel: "medium"
};
```

#### Schema 5: 重复清理 (duplicate_cleanup)

```typescript
export const duplicateCleanupSchema: WorkflowSlotSchema = {
  schemaId: "duplicate_cleanup",
  workflowId: "duplicate_cleanup",
  name: "重复清理",
  description: "检测并清理重复的书签",
  version: "1.0.0",
  intentPatterns: [
    "去重", "清理重复", "重复的书签", "有重复吗", "删除重复",
    "查重", "重复检测", "找重复"
  ],
  semanticPatterns: [
    "帮我看看有没有重复的书签",
    "清理一下重复收藏",
    "把重复的删掉"
  ],
  slots: [
    {
      id: "detection_mode",
      name: "检测模式",
      description: "如何判断书签重复",
      type: "enum",
      required: true,
      default: "url",
      priority: 1,
      options: [
        { value: "url", label: "相同链接", description: "URL 完全相同", isDefault: true },
        { value: "title", label: "相同标题", description: "标题完全相同" },
        { value: "content", label: "相似内容", description: "内容相似度 > 80%" },
        { value: "smart", label: "智能检测", description: "综合判断（推荐）" }
      ],
      synonyms: {
        "链接": "url",
        "网址": "url",
        "智能": "smart",
        "自动": "smart"
      },
      promptTemplates: {
        ask: "用什么方式检测重复？相同链接（默认）、相同标题、相似内容、还是智能检测？",
        clarify: "确认使用「{value}」模式检测？",
        invalid: "请选择检测模式"
      }
    },
    {
      id: "scope",
      name: "检测范围",
      description: "检测重复的范围",
      type: "enum",
      required: false,
      default: "all",
      priority: 2,
      options: [
        { value: "all", label: "全部书签", isDefault: true },
        { value: "folder", label: "指定文件夹" },
        { value: "platform", label: "指定平台" }
      ],
      promptTemplates: {
        ask: "检测范围？全部书签、指定文件夹、还是指定平台？",
        clarify: "确认检测「{value}」范围？",
        invalid: "请选择检测范围"
      }
    },
    {
      id: "keep_strategy",
      name: "保留策略",
      description: "发现重复时保留哪个",
      type: "enum",
      required: true,
      default: "newest",
      priority: 3,
      options: [
        { value: "newest", label: "保留最新", description: "保留最近添加的", isDefault: true },
        { value: "oldest", label: "保留最旧", description: "保留最早添加的" },
        { value: "most_tags", label: "保留标签最多", description: "保留标签最丰富的" },
        { value: "manual", label: "手动选择", description: "逐个确认保留哪个" }
      ],
      promptTemplates: {
        ask: "发现重复时保留哪个？最新、最旧、标签最多的、还是手动选择？",
        clarify: "确认保留「{value}」的书签？",
        invalid: "请选择保留策略"
      }
    },
    {
      id: "auto_execute",
      name: "自动执行",
      description: "是否自动删除重复书签",
      type: "boolean",
      required: false,
      default: false,
      priority: 4,
      promptTemplates: {
        ask: "是否自动删除重复书签？（否则先预览再确认）",
        clarify: "确认{value}执行删除？",
        invalid: "请回答是或否"
      }
    }
  ],
  confirmationRequired: true,
  confirmationMessage: "检测到 {duplicate_count} 组重复书签（共 {total_count} 个待删除），确认按「{keep_strategy}」策略清理？\n\n⚠️ 此操作不可撤销",
  riskLevel: "high"
};
```

#### Schema 6: 阅读计划 (reading_plan)

```typescript
export const readingPlanSchema: WorkflowSlotSchema = {
  schemaId: "reading_plan",
  workflowId: "reading_plan",
  name: "阅读计划",
  description: "制定个性化阅读计划",
  version: "1.0.0",
  intentPatterns: [
    "制定阅读计划", "安排阅读", "什么时候看", "帮我规划阅读",
    "阅读计划", "读书计划", "学习计划"
  ],
  semanticPatterns: [
    "帮我安排一下阅读时间",
    "规划一下这些内容的学习",
    "制定一个阅读计划"
  ],
  slots: [
    {
      id: "source",
      name: "书签来源",
      description: "用于制定计划的书签来源",
      type: "enum",
      required: true,
      priority: 1,
      options: [
        { value: "unread", label: "未读书签", description: "所有未读内容", isDefault: true },
        { value: "folder", label: "指定文件夹", description: "某个文件夹的内容" },
        { value: "tagged", label: "指定标签", description: "带某标签的内容" },
        { value: "selected", label: "当前选中", description: "选中的书签" },
        { value: "all", label: "全部", description: "所有书签" }
      ],
      promptTemplates: {
        ask: "基于哪些书签制定计划？未读书签、指定文件夹、带特定标签、当前选中、还是全部？",
        clarify: "确认基于「{value}」制定计划？",
        invalid: "请选择书签来源"
      }
    },
    {
      id: "duration",
      name: "计划周期",
      description: "阅读计划的时间跨度",
      type: "enum",
      required: true,
      default: "week",
      priority: 2,
      options: [
        { value: "day", label: "一天" },
        { value: "week", label: "一周", isDefault: true },
        { value: "month", label: "一个月" },
        { value: "custom", label: "自定义" }
      ],
      synonyms: {
        "今天": "day",
        "本周": "week",
        "这个月": "month"
      },
      promptTemplates: {
        ask: "计划周期是多久？一天、一周、一个月、还是自定义？",
        clarify: "确认制定「{value}」的阅读计划？",
        invalid: "请选择计划周期"
      }
    },
    {
      id: "daily_time",
      name: "每日时间",
      description: "每天计划阅读的时间（分钟）",
      type: "number",
      required: true,
      default: 30,
      priority: 3,
      validation: { min: 10, max: 480 },
      extractionHints: [
        "每天 N 分钟", "N 分钟", "半小时", "一小时"
      ],
      synonyms: {
        "半小时": 30,
        "一小时": 60,
        "两小时": 120
      },
      promptTemplates: {
        ask: "每天计划阅读多少分钟？（默认 30 分钟）",
        clarify: "确认每天阅读 {value} 分钟？",
        invalid: "阅读时间需在 10-480 分钟之间"
      }
    },
    {
      id: "priority",
      name: "优先策略",
      description: "阅读顺序的优先策略",
      type: "enum",
      required: false,
      default: "smart",
      priority: 4,
      options: [
        { value: "smart", label: "智能推荐", description: "AI 推荐最佳顺序", isDefault: true },
        { value: "newest_first", label: "最新优先", description: "先读最近添加的" },
        { value: "oldest_first", label: "最旧优先", description: "先读最早添加的" },
        { value: "shortest_first", label: "短文优先", description: "先读短的内容" },
        { value: "by_topic", label: "按主题", description: "相同主题连续阅读" }
      ],
      promptTemplates: {
        ask: "阅读优先级？智能推荐、最新优先、最旧优先、短文优先、还是按主题分组？",
        clarify: "确认按「{value}」排序阅读？",
        invalid: "请选择优先级策略"
      }
    },
    {
      id: "reminder",
      name: "开启提醒",
      description: "是否开启阅读提醒",
      type: "boolean",
      required: false,
      default: true,
      priority: 5,
      promptTemplates: {
        ask: "是否开启阅读提醒？",
        clarify: "确认{value}提醒？",
        invalid: "请回答是或否"
      }
    },
    {
      id: "reminder_time",
      name: "提醒时间",
      description: "每天的提醒时间",
      type: "enum",
      required: false,
      default: "20:00",
      priority: 6,
      dependsOn: { slot: "reminder", condition: "equals", value: true },
      options: [
        { value: "08:00", label: "早上 8 点" },
        { value: "12:00", label: "中午 12 点" },
        { value: "18:00", label: "下午 6 点" },
        { value: "20:00", label: "晚上 8 点", isDefault: true },
        { value: "21:00", label: "晚上 9 点" }
      ],
      promptTemplates: {
        ask: "每天几点提醒您阅读？",
        clarify: "确认每天 {value} 提醒？",
        invalid: "请选择提醒时间"
      }
    }
  ],
  confirmationRequired: false,
  riskLevel: "low"
};
```

#### Schema 7: 周期报告 (periodic_report)

```typescript
export const periodicReportSchema: WorkflowSlotSchema = {
  schemaId: "periodic_report",
  workflowId: "periodic_report",
  name: "周期报告",
  description: "生成知识库使用分析报告",
  version: "1.0.0",
  intentPatterns: [
    "生成报告", "周报", "月报", "使用统计", "活跃度报告",
    "总结一下", "数据分析", "使用分析"
  ],
  semanticPatterns: [
    "帮我生成一份使用报告",
    "看看这段时间的收藏情况",
    "分析一下我的使用习惯"
  ],
  slots: [
    {
      id: "period",
      name: "报告周期",
      description: "报告覆盖的时间周期",
      type: "enum",
      required: true,
      priority: 1,
      options: [
        { value: "daily", label: "日报" },
        { value: "weekly", label: "周报", isDefault: true },
        { value: "monthly", label: "月报" },
        { value: "quarterly", label: "季报" },
        { value: "yearly", label: "年报" },
        { value: "custom", label: "自定义" }
      ],
      synonyms: {
        "今天": "daily",
        "本周": "weekly",
        "这周": "weekly",
        "本月": "monthly",
        "这个月": "monthly"
      },
      promptTemplates: {
        ask: "生成什么周期的报告？日报、周报、月报、季报、年报、还是自定义？",
        clarify: "确认生成「{value}」？",
        invalid: "请选择报告周期"
      }
    },
    {
      id: "report_type",
      name: "报告类型",
      description: "报告包含的分析内容",
      type: "multi_enum",
      required: true,
      default: ["activity", "insights"],
      priority: 2,
      options: [
        { value: "activity", label: "活跃度", description: "收藏数量、频率统计" },
        { value: "insights", label: "洞察", description: "内容主题、偏好分析" },
        { value: "trends", label: "趋势", description: "时间趋势变化" },
        { value: "recommendations", label: "推荐", description: "优化建议" },
        { value: "comparison", label: "对比", description: "与上期对比" }
      ],
      promptTemplates: {
        ask: "报告包含哪些内容？活跃度、洞察、趋势、推荐、对比（可多选）",
        clarify: "确认报告包含：{value}？",
        invalid: "请至少选择一个报告类型"
      }
    },
    {
      id: "scope",
      name: "数据范围",
      description: "分析的数据范围",
      type: "enum",
      required: false,
      default: "all",
      priority: 3,
      options: [
        { value: "all", label: "全部数据", isDefault: true },
        { value: "folder", label: "指定文件夹" },
        { value: "platform", label: "指定平台" },
        { value: "tagged", label: "指定标签" }
      ],
      promptTemplates: {
        ask: "分析范围？全部数据、指定文件夹、指定平台、还是带特定标签？",
        clarify: "确认分析「{value}」范围？",
        invalid: "请选择数据范围"
      }
    },
    {
      id: "output_format",
      name: "输出格式",
      description: "报告的输出格式",
      type: "enum",
      required: false,
      default: "markdown",
      priority: 4,
      options: [
        { value: "markdown", label: "Markdown", isDefault: true },
        { value: "html", label: "HTML" },
        { value: "json", label: "JSON" },
        { value: "email", label: "邮件" }
      ],
      promptTemplates: {
        ask: "报告格式？Markdown、HTML、JSON、还是发送到邮箱？",
        clarify: "确认输出为「{value}」格式？",
        invalid: "请选择输出格式"
      }
    },
    {
      id: "include_charts",
      name: "包含图表",
      description: "是否在报告中包含数据图表",
      type: "boolean",
      required: false,
      default: true,
      priority: 5,
      promptTemplates: {
        ask: "是否包含数据图表？",
        clarify: "确认{value}图表？",
        invalid: "请回答是或否"
      }
    }
  ],
  confirmationRequired: false,
  riskLevel: "low"
};
```

#### Schema 8: 主题合成 (thematic_synthesis)

```typescript
export const thematicSynthesisSchema: WorkflowSlotSchema = {
  schemaId: "thematic_synthesis",
  workflowId: "thematic_synthesis",
  name: "主题合成",
  description: "将多个相关书签合成主题报告",
  version: "1.0.0",
  intentPatterns: [
    "主题合成", "综合报告", "汇总这些", "合并成文章",
    "生成主题", "整合内容", "综述"
  ],
  semanticPatterns: [
    "把这些内容整合成一篇文章",
    "生成一个关于某主题的综述",
    "帮我汇总这些相关资料"
  ],
  slots: [
    {
      id: "topic",
      name: "合成主题",
      description: "合成报告的主题",
      type: "text",
      required: true,
      priority: 1,
      validation: { minLength: 2, maxLength: 100 },
      extractionHints: [
        "关于 X", "X 主题", "X 相关"
      ],
      promptTemplates: {
        ask: "请输入合成的主题（如：人工智能发展趋势）",
        clarify: "确认以「{value}」为主题进行合成？",
        invalid: "请输入 2-100 字的主题描述"
      }
    },
    {
      id: "source_mode",
      name: "来源方式",
      description: "如何选择用于合成的书签",
      type: "enum",
      required: true,
      priority: 2,
      options: [
        { value: "auto_search", label: "自动搜索", description: "AI 自动搜索相关内容", isDefault: true },
        { value: "selected", label: "当前选中", description: "使用选中的书签" },
        { value: "folder", label: "指定文件夹", description: "使用文件夹内容" },
        { value: "tagged", label: "指定标签", description: "使用带标签的书签" }
      ],
      promptTemplates: {
        ask: "如何选择要合成的书签？自动搜索相关内容、使用当前选中、指定文件夹、还是带特定标签？",
        clarify: "确认从「{value}」获取书签？",
        invalid: "请选择来源方式"
      }
    },
    {
      id: "synthesis_depth",
      name: "合成深度",
      description: "合成报告的详细程度",
      type: "enum",
      required: false,
      default: "standard",
      priority: 3,
      options: [
        { value: "quick", label: "快速摘要", description: "简洁的要点总结" },
        { value: "standard", label: "标准综述", description: "适中的详细程度", isDefault: true },
        { value: "deep", label: "深度分析", description: "详尽的分析报告" }
      ],
      synonyms: {
        "简单": "quick",
        "详细": "deep",
        "深入": "deep"
      },
      promptTemplates: {
        ask: "合成深度？快速摘要、标准综述、还是深度分析？",
        clarify: "确认使用「{value}」深度？",
        invalid: "请选择合成深度"
      }
    },
    {
      id: "output_structure",
      name: "输出结构",
      description: "合成报告的结构形式",
      type: "enum",
      required: false,
      default: "article",
      priority: 4,
      options: [
        { value: "bullet_points", label: "要点列表", description: "简洁的要点形式" },
        { value: "article", label: "完整文章", description: "结构完整的文章", isDefault: true },
        { value: "mind_map", label: "思维导图", description: "层级结构的导图" },
        { value: "timeline", label: "时间线", description: "按时间顺序组织" }
      ],
      promptTemplates: {
        ask: "输出什么结构？要点列表、完整文章、思维导图、还是时间线？",
        clarify: "确认输出「{value}」结构？",
        invalid: "请选择输出结构"
      }
    }
  ],
  confirmationRequired: false,
  riskLevel: "low"
};
```

#### Schema 9: 备份恢复 (backup_restore)

```typescript
export const backupRestoreSchema: WorkflowSlotSchema = {
  schemaId: "backup_restore",
  workflowId: "backup_restore",
  name: "备份恢复",
  description: "创建数据备份或从备份恢复",
  version: "1.0.0",
  intentPatterns: [
    "备份", "恢复", "还原", "回退到", "创建备份",
    "恢复数据", "数据恢复", "还原数据"
  ],
  semanticPatterns: [
    "帮我备份一下数据",
    "恢复到之前的状态",
    "把数据还原回去"
  ],
  slots: [
    {
      id: "action",
      name: "操作类型",
      description: "备份或恢复操作",
      type: "enum",
      required: true,
      priority: 1,
      options: [
        { value: "backup", label: "创建备份", description: "备份当前数据" },
        { value: "restore", label: "恢复数据", description: "从备份恢复" },
        { value: "list_backups", label: "查看备份", description: "列出所有备份" },
        { value: "delete_backup", label: "删除备份", description: "删除指定备份" }
      ],
      synonyms: {
        "创建": "backup",
        "生成": "backup",
        "还原": "restore",
        "回退": "restore",
        "查看": "list_backups",
        "列表": "list_backups"
      },
      promptTemplates: {
        ask: "您想创建备份、恢复数据、查看备份列表、还是删除备份？",
        clarify: "确认执行「{value}」操作？",
        invalid: "请选择操作类型"
      }
    },
    {
      id: "backup_scope",
      name: "备份范围",
      description: "备份包含的数据范围",
      type: "enum",
      required: false,
      default: "all",
      priority: 2,
      dependsOn: { slot: "action", condition: "equals", value: "backup" },
      options: [
        { value: "all", label: "全部数据", description: "书签+文件夹+设置", isDefault: true },
        { value: "bookmarks_only", label: "仅书签", description: "只备份书签数据" },
        { value: "folders_only", label: "仅文件夹", description: "只备份文件夹结构" },
        { value: "settings_only", label: "仅设置", description: "只备份用户设置" }
      ],
      promptTemplates: {
        ask: "备份哪些内容？全部、仅书签、仅文件夹结构、还是仅设置？",
        clarify: "确认备份「{value}」？",
        invalid: "请选择备份范围"
      }
    },
    {
      id: "backup_id",
      name: "备份标识",
      description: "要恢复或删除的备份",
      type: "text",
      required: false,
      priority: 2,
      dependsOn: { slot: "action", condition: "in", value: ["restore", "delete_backup"] },
      extractionHints: [
        "备份 ID", "编号", "最近一次"
      ],
      synonyms: {
        "最近": "latest",
        "最新": "latest",
        "上一次": "latest"
      },
      promptTemplates: {
        ask: "请选择要{action}的备份（输入备份 ID 或「最近一次」）",
        clarify: "确认{action}备份「{value}」？",
        invalid: "请输入有效的备份 ID"
      }
    },
    {
      id: "restore_mode",
      name: "恢复模式",
      description: "恢复时如何处理现有数据",
      type: "enum",
      required: false,
      default: "merge",
      priority: 3,
      dependsOn: { slot: "action", condition: "equals", value: "restore" },
      options: [
        { value: "merge", label: "合并", description: "保留现有数据，合并备份", isDefault: true },
        { value: "overwrite", label: "覆盖", description: "清空现有，完全恢复" },
        { value: "selective", label: "选择性", description: "逐项确认是否恢复" }
      ],
      promptTemplates: {
        ask: "恢复方式？合并（保留现有）、覆盖（替换现有）、还是选择性恢复？",
        clarify: "确认使用「{value}」方式恢复？",
        invalid: "请选择恢复模式"
      }
    },
    {
      id: "backup_name",
      name: "备份名称",
      description: "为备份指定的名称",
      type: "text",
      required: false,
      priority: 3,
      dependsOn: { slot: "action", condition: "equals", value: "backup" },
      validation: { maxLength: 50 },
      promptTemplates: {
        ask: "给这个备份起个名字（可选，默认使用日期时间）",
        clarify: "确认备份命名为「{value}」？",
        invalid: "备份名称不能超过 50 个字符"
      }
    }
  ],
  confirmationRequired: true,
  confirmationMessage: "⚠️ 即将{action}，{risk_description}。确认执行？",
  riskLevel: "high",
  dynamicRiskRules: [
    {
      condition: "action === 'backup'",
      riskLevel: "low",
      requiresConfirmation: false
    },
    {
      condition: "action === 'list_backups'",
      riskLevel: "low",
      requiresConfirmation: false
    },
    {
      condition: "action === 'restore' && restore_mode === 'overwrite'",
      riskLevel: "high",
      requiresConfirmation: true
    },
    {
      condition: "action === 'delete_backup'",
      riskLevel: "medium",
      requiresConfirmation: true
    }
  ]
};
```

#### Schema 10: 健康检查 (health_check)

```typescript
export const healthCheckSchema: WorkflowSlotSchema = {
  schemaId: "health_check",
  workflowId: "health_check",
  name: "健康检查",
  description: "检查书签和文件夹的健康状况",
  version: "1.0.0",
  intentPatterns: [
    "健康检查", "检查一下", "有没有问题", "诊断", "巡检",
    "检测问题", "系统检查", "查问题"
  ],
  semanticPatterns: [
    "帮我检查一下书签有没有问题",
    "看看有没有失效的链接",
    "诊断一下我的收藏库"
  ],
  slots: [
    {
      id: "check_types",
      name: "检查项目",
      description: "要检查的问题类型",
      type: "multi_enum",
      required: true,
      default: ["broken_links", "duplicates"],
      priority: 1,
      options: [
        { value: "broken_links", label: "失效链接", description: "检测无法访问的链接" },
        { value: "duplicates", label: "重复书签", description: "检测重复的书签" },
        { value: "empty_folders", label: "空文件夹", description: "检测没有内容的文件夹" },
        { value: "orphan_tags", label: "孤立标签", description: "检测未使用的标签" },
        { value: "stale_content", label: "过期内容", description: "检测长期未访问的内容" }
      ],
      promptTemplates: {
        ask: "检查哪些项目？失效链接、重复书签、空文件夹、孤立标签、过期内容（可多选）",
        clarify: "确认检查：{value}？",
        invalid: "请至少选择一个检查项目"
      }
    },
    {
      id: "scope",
      name: "检查范围",
      description: "检查的数据范围",
      type: "enum",
      required: false,
      default: "all",
      priority: 2,
      options: [
        { value: "all", label: "全部书签", isDefault: true },
        { value: "folder", label: "指定文件夹" },
        { value: "recent", label: "最近添加" }
      ],
      promptTemplates: {
        ask: "检查范围？全部书签、指定文件夹、还是仅最近添加？",
        clarify: "确认检查「{value}」范围？",
        invalid: "请选择检查范围"
      }
    },
    {
      id: "auto_fix",
      name: "自动修复",
      description: "是否自动修复发现的问题",
      type: "boolean",
      required: false,
      default: false,
      priority: 3,
      promptTemplates: {
        ask: "发现问题后是否自动修复？（否则先报告再确认）",
        clarify: "确认{value}修复？",
        invalid: "请回答是或否"
      }
    },
    {
      id: "notification",
      name: "结果通知",
      description: "检查结果的通知方式",
      type: "enum",
      required: false,
      default: "in_app",
      priority: 4,
      options: [
        { value: "in_app", label: "应用内", isDefault: true },
        { value: "email", label: "邮件" },
        { value: "both", label: "两者都要" },
        { value: "none", label: "不通知" }
      ],
      promptTemplates: {
        ask: "检查结果如何通知？应用内、邮件、两者都要、还是不通知？",
        clarify: "确认通过「{value}」通知？",
        invalid: "请选择通知方式"
      }
    }
  ],
  confirmationRequired: false,
  riskLevel: "low",
  dynamicRiskRules: [
    {
      condition: "auto_fix === true && check_types.includes('broken_links')",
      riskLevel: "medium",
      requiresConfirmation: true
    },
    {
      condition: "auto_fix === true && check_types.includes('duplicates')",
      riskLevel: "high",
      requiresConfirmation: true
    }
  ]
};
```

### 3.3 Schema 注册表

```typescript
// 文件: src/lib/slot-filling/schemas/index.ts

import { WorkflowSlotSchema } from "../types/slot.types";
import { searchAndFilterSchema } from "./search-and-filter.schema";
import { dataExportSchema } from "./data-export.schema";
import { batchTagSchema } from "./batch-tag.schema";
import { batchMoveSchema } from "./batch-move.schema";
import { duplicateCleanupSchema } from "./duplicate-cleanup.schema";
import { readingPlanSchema } from "./reading-plan.schema";
import { periodicReportSchema } from "./periodic-report.schema";
import { thematicSynthesisSchema } from "./thematic-synthesis.schema";
import { backupRestoreSchema } from "./backup-restore.schema";
import { healthCheckSchema } from "./health-check.schema";

/**
 * Schema 注册表
 */
export const SLOT_SCHEMAS: Record<string, WorkflowSlotSchema> = {
  search_and_filter: searchAndFilterSchema,
  data_export: dataExportSchema,
  batch_tag: batchTagSchema,
  batch_move: batchMoveSchema,
  duplicate_cleanup: duplicateCleanupSchema,
  reading_plan: readingPlanSchema,
  periodic_report: periodicReportSchema,
  thematic_synthesis: thematicSynthesisSchema,
  backup_restore: backupRestoreSchema,
  health_check: healthCheckSchema,
};

/**
 * 获取 Schema
 */
export function getSchema(schemaId: string): WorkflowSlotSchema | undefined {
  return SLOT_SCHEMAS[schemaId];
}

/**
 * 获取所有 Schema ID
 */
export function getAllSchemaIds(): string[] {
  return Object.keys(SLOT_SCHEMAS);
}

// 导出所有 Schema
export {
  searchAndFilterSchema,
  dataExportSchema,
  batchTagSchema,
  batchMoveSchema,
  duplicateCleanupSchema,
  readingPlanSchema,
  periodicReportSchema,
  thematicSynthesisSchema,
  backupRestoreSchema,
  healthCheckSchema,
};
```

---

## 四、SlotFilling 引擎设计

### 4.1 引擎架构

```
┌──────────────────────────────────────────────────────────────────────┐
│                        SlotFillingEngine                             │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌────────────────┐    ┌────────────────┐    ┌────────────────┐     │
│  │ SlotExtractor  │    │ SlotValidator  │    │ PromptBuilder  │     │
│  │                │    │                │    │                │     │
│  │ - 规则提取     │    │ - 类型验证     │    │ - 追问生成     │     │
│  │ - LLM 提取     │    │ - 范围验证     │    │ - 确认生成     │     │
│  │ - 同义词映射   │    │ - 依赖验证     │    │ - 模板渲染     │     │
│  └────────────────┘    └────────────────┘    └────────────────┘     │
│           │                    │                    │                │
│           └────────────────────┼────────────────────┘                │
│                                │                                     │
│                                ▼                                     │
│                    ┌────────────────────┐                           │
│                    │   StateManager     │                           │
│                    │                    │                           │
│                    │ - 状态持久化       │                           │
│                    │ - 会话管理         │                           │
│                    │ - 超时处理         │                           │
│                    └────────────────────┘                           │
│                                │                                     │
│                                ▼                                     │
│                    ┌────────────────────┐                           │
│                    │  ActionDecider     │                           │
│                    │                    │                           │
│                    │ - 下一步决策       │                           │
│                    │ - 风险评估         │                           │
│                    │ - 确认判断         │                           │
│                    └────────────────────┘                           │
└──────────────────────────────────────────────────────────────────────┘
```

### 4.2 核心接口

```typescript
// 文件: src/lib/slot-filling/engine/slot-filling-engine.ts

import {
  WorkflowSlotSchema,
  SlotDefinition,
  SlotFillingState,
  SlotFillingAction,
  SlotExtractionResult,
  SlotValidationResult
} from "../types";

export interface SlotFillingEngineConfig {
  /** 最大追问轮次 */
  maxTurns: number;
  /** 会话超时时间（毫秒） */
  sessionTimeoutMs: number;
  /** 是否启用 LLM 提取 */
  enableLLMExtraction: boolean;
  /** LLM 提取置信度阈值 */
  llmConfidenceThreshold: number;
}

export class SlotFillingEngine {
  private config: SlotFillingEngineConfig;
  private stateManager: StateManager;
  private extractor: SlotExtractor;
  private validator: SlotValidator;
  private promptBuilder: PromptBuilder;

  constructor(config: Partial<SlotFillingEngineConfig> = {}) {
    this.config = {
      maxTurns: 5,
      sessionTimeoutMs: 5 * 60 * 1000, // 5 分钟
      enableLLMExtraction: true,
      llmConfidenceThreshold: 0.7,
      ...config
    };

    this.stateManager = new StateManager();
    this.extractor = new SlotExtractor(this.config);
    this.validator = new SlotValidator();
    this.promptBuilder = new PromptBuilder();
  }

  /**
   * 处理用户消息，返回下一步动作
   */
  async process(
    schema: WorkflowSlotSchema,
    userMessage: string,
    sessionId: string,
    context?: Record<string, unknown>
  ): Promise<SlotFillingAction> {
    // 1. 获取或创建会话状态
    let state = await this.stateManager.getState(sessionId);
    if (!state) {
      state = this.createInitialState(schema.schemaId);
    }

    // 2. 从用户消息中提取槽位值
    const extraction = await this.extractor.extract(
      userMessage,
      schema,
      state.filledSlots,
      context
    );

    // 3. 合并并验证槽位
    const mergedSlots = { ...state.filledSlots, ...extraction.slots };
    const validationResults = await this.validateSlots(schema, mergedSlots);

    // 4. 更新有效的槽位
    for (const [slotId, result] of Object.entries(validationResults)) {
      if (result.valid) {
        state.filledSlots[slotId] = mergedSlots[slotId];
      }
    }

    // 5. 决定下一步动作
    const action = await this.decideNextAction(schema, state, validationResults);

    // 6. 更新状态
    state.conversationHistory.push({
      role: "user",
      content: userMessage,
      extractedSlots: extraction.slots,
      timestamp: new Date().toISOString()
    });

    if (action.type === "ask" || action.type === "clarify") {
      state.currentSlot = action.slotId;
      state.conversationHistory.push({
        role: "assistant",
        content: action.prompt,
        askedSlot: action.slotId,
        timestamp: new Date().toISOString()
      });
    }

    state.updatedAt = new Date().toISOString();
    await this.stateManager.saveState(sessionId, state);

    return action;
  }

  /**
   * 决定下一步动作
   */
  private async decideNextAction(
    schema: WorkflowSlotSchema,
    state: SlotFillingState,
    validationResults: Record<string, SlotValidationResult>
  ): Promise<SlotFillingAction> {
    // 1. 检查是否有无效值需要澄清
    for (const [slotId, result] of Object.entries(validationResults)) {
      if (!result.valid && state.filledSlots[slotId] !== undefined) {
        const slot = schema.slots.find(s => s.id === slotId)!;
        return {
          type: "clarify",
          slotId,
          prompt: this.promptBuilder.buildInvalidPrompt(slot, result.errorMessage!),
          currentValue: state.filledSlots[slotId]
        };
      }
    }

    // 2. 检查必填槽位是否完整
    const missingRequired = this.getMissingRequiredSlots(schema, state.filledSlots);
    if (missingRequired.length > 0) {
      const nextSlot = missingRequired[0];
      return {
        type: "ask",
        slotId: nextSlot.id,
        prompt: this.promptBuilder.buildAskPrompt(nextSlot, state.filledSlots),
        options: nextSlot.options
      };
    }

    // 3. 评估风险等级，决定是否需要确认
    const riskLevel = this.evaluateRisk(schema, state.filledSlots);
    const needsConfirmation = this.needsConfirmation(schema, riskLevel);

    if (needsConfirmation && state.status !== "confirming") {
      state.status = "confirming";
      return {
        type: "confirm",
        message: this.promptBuilder.buildConfirmationMessage(schema, state.filledSlots),
        summary: this.buildSummary(schema, state.filledSlots)
      };
    }

    // 4. 所有槽位已就绪
    state.status = "ready";
    return {
      type: "ready",
      slots: this.applyDefaults(schema, state.filledSlots)
    };
  }

  /**
   * 获取缺失的必填槽位（考虑依赖关系）
   */
  private getMissingRequiredSlots(
    schema: WorkflowSlotSchema,
    filledSlots: Record<string, unknown>
  ): SlotDefinition[] {
    return schema.slots
      .filter(slot => slot.required)
      .filter(slot => filledSlots[slot.id] === undefined)
      .filter(slot => this.isDependencySatisfied(slot, filledSlots))
      .sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));
  }

  /**
   * 检查槽位依赖是否满足
   */
  private isDependencySatisfied(
    slot: SlotDefinition,
    filledSlots: Record<string, unknown>
  ): boolean {
    if (!slot.dependsOn) return true;

    const { slot: depSlot, condition, value } = slot.dependsOn;
    const depValue = filledSlots[depSlot];

    switch (condition) {
      case "equals":
        return depValue === value;
      case "not_equals":
        return depValue !== value;
      case "exists":
        return depValue !== undefined;
      case "not_exists":
        return depValue === undefined;
      case "in":
        return Array.isArray(value) && value.includes(depValue);
      case "not_in":
        return Array.isArray(value) && !value.includes(depValue);
      default:
        return true;
    }
  }

  /**
   * 评估风险等级
   */
  private evaluateRisk(
    schema: WorkflowSlotSchema,
    filledSlots: Record<string, unknown>
  ): RiskLevel {
    // 检查动态风险规则
    if (schema.dynamicRiskRules) {
      for (const rule of schema.dynamicRiskRules) {
        if (this.evaluateCondition(rule.condition, filledSlots)) {
          return rule.riskLevel;
        }
      }
    }
    return schema.riskLevel;
  }

  /**
   * 判断是否需要确认
   */
  private needsConfirmation(
    schema: WorkflowSlotSchema,
    riskLevel: RiskLevel
  ): boolean {
    if (schema.confirmationRequired) return true;

    // 动态规则中的确认要求
    if (schema.dynamicRiskRules) {
      for (const rule of schema.dynamicRiskRules) {
        if (rule.requiresConfirmation) return true;
      }
    }

    // 高风险操作必须确认
    return riskLevel === "high";
  }
}
```

### 4.3 槽位提取器

```typescript
// 文件: src/lib/slot-filling/engine/slot-extractor.ts

export class SlotExtractor {
  private config: SlotFillingEngineConfig;

  constructor(config: SlotFillingEngineConfig) {
    this.config = config;
  }

  /**
   * 从用户消息中提取槽位值
   */
  async extract(
    message: string,
    schema: WorkflowSlotSchema,
    currentSlots: Record<string, unknown>,
    context?: Record<string, unknown>
  ): Promise<SlotExtractionResult> {
    const startTime = Date.now();
    const extracted: Record<string, unknown> = {};
    const confidence: Record<string, number> = {};

    // 1. 规则提取（优先级最高）
    for (const slot of schema.slots) {
      const ruleResult = this.extractByRules(message, slot);
      if (ruleResult.value !== undefined) {
        extracted[slot.id] = ruleResult.value;
        confidence[slot.id] = ruleResult.confidence;
      }
    }

    // 2. 同义词映射
    for (const slot of schema.slots) {
      if (extracted[slot.id] === undefined && slot.synonyms) {
        const synonymResult = this.extractBySynonyms(message, slot);
        if (synonymResult.value !== undefined) {
          extracted[slot.id] = synonymResult.value;
          confidence[slot.id] = synonymResult.confidence;
        }
      }
    }

    // 3. LLM 提取（兜底）
    if (this.config.enableLLMExtraction) {
      const unfilledSlots = schema.slots.filter(
        s => extracted[s.id] === undefined &&
             this.isDependencySatisfied(s, { ...currentSlots, ...extracted })
      );

      if (unfilledSlots.length > 0) {
        const llmResult = await this.extractByLLM(message, unfilledSlots, context);
        for (const [slotId, result] of Object.entries(llmResult)) {
          if (result.confidence >= this.config.llmConfidenceThreshold) {
            extracted[slotId] = result.value;
            confidence[slotId] = result.confidence;
          }
        }
      }
    }

    return {
      slots: extracted,
      confidence,
      rawMessage: message,
      extractionTimeMs: Date.now() - startTime
    };
  }

  /**
   * 基于规则提取
   */
  private extractByRules(
    message: string,
    slot: SlotDefinition
  ): { value?: unknown; confidence: number } {
    const normalizedMessage = message.toLowerCase();

    // 枚举类型：直接匹配选项
    if (slot.type === "enum" && slot.options) {
      for (const option of slot.options) {
        if (normalizedMessage.includes(option.value.toLowerCase()) ||
            normalizedMessage.includes(option.label.toLowerCase())) {
          return { value: option.value, confidence: 0.95 };
        }
      }
    }

    // 多选枚举
    if (slot.type === "multi_enum" && slot.options) {
      const matched: string[] = [];
      for (const option of slot.options) {
        if (normalizedMessage.includes(option.value.toLowerCase()) ||
            normalizedMessage.includes(option.label.toLowerCase())) {
          matched.push(option.value);
        }
      }
      if (matched.length > 0) {
        return { value: matched, confidence: 0.9 };
      }
    }

    // 数值类型：提取数字
    if (slot.type === "number") {
      const numberMatch = message.match(/(\d+)/);
      if (numberMatch) {
        return { value: parseInt(numberMatch[1], 10), confidence: 0.85 };
      }
    }

    // 布尔类型
    if (slot.type === "boolean") {
      if (/是|要|开启|启用|true|yes/.test(normalizedMessage)) {
        return { value: true, confidence: 0.9 };
      }
      if (/否|不|关闭|禁用|false|no/.test(normalizedMessage)) {
        return { value: false, confidence: 0.9 };
      }
    }

    // 使用提取提示
    if (slot.extractionHints) {
      for (const hint of slot.extractionHints) {
        const pattern = hint.replace("X", "(.+?)").replace("N", "(\\d+)");
        const regex = new RegExp(pattern, "i");
        const match = message.match(regex);
        if (match && match[1]) {
          return { value: match[1].trim(), confidence: 0.85 };
        }
      }
    }

    return { confidence: 0 };
  }

  /**
   * 基于同义词提取
   */
  private extractBySynonyms(
    message: string,
    slot: SlotDefinition
  ): { value?: unknown; confidence: number } {
    if (!slot.synonyms) return { confidence: 0 };

    const normalizedMessage = message.toLowerCase();

    for (const [synonym, value] of Object.entries(slot.synonyms)) {
      if (normalizedMessage.includes(synonym.toLowerCase())) {
        return { value, confidence: 0.85 };
      }
    }

    return { confidence: 0 };
  }

  /**
   * 基于 LLM 提取
   */
  private async extractByLLM(
    message: string,
    slots: SlotDefinition[],
    context?: Record<string, unknown>
  ): Promise<Record<string, { value: unknown; confidence: number }>> {
    // 构建 LLM Prompt
    const prompt = this.buildExtractionPrompt(message, slots, context);

    // 调用 LLM
    // const response = await llmService.complete(prompt);
    // return this.parseExtractionResponse(response, slots);

    // 占位返回
    return {};
  }
}
```

---

## 五、集成方案

### 5.1 与现有系统的集成点

```
┌─────────────────────────────────────────────────────────────────────┐
│                      现有系统                                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────┐                                                │
│  │ IntentRouter    │ ──────────────────────────────────────────┐    │
│  │ (意图路由器)     │                                           │    │
│  └────────┬────────┘                                           │    │
│           │                                                    │    │
│           ▼                                                    │    │
│  ┌─────────────────┐    ┌─────────────────────────────────┐   │    │
│  │ IntentAnalyzer  │───▶│ SlotFillingEngine (新增)        │   │    │
│  │ (意图分析器)     │    │                                 │   │    │
│  └────────┬────────┘    │ - 参数完整性检查                │   │    │
│           │             │ - 缺失槽位追问                   │   │    │
│           │             │ - 参数验证                       │   │    │
│           │             └─────────────────────────────────┘   │    │
│           │                           │                       │    │
│           │                           │ 参数完整              │    │
│           ▼                           ▼                       │    │
│  ┌─────────────────┐    ┌─────────────────────────────────┐   │    │
│  │ ExecutionCoord  │◀───│ 填充完成的参数                   │   │    │
│  │ (执行协调器)     │    └─────────────────────────────────┘   │    │
│  └─────────────────┘                                           │    │
│                                                                 │    │
└─────────────────────────────────────────────────────────────────────┘
```

### 5.2 API 端点设计

```typescript
// 文件: src/app/api/agent/slot-filling/route.ts

import { NextRequest, NextResponse } from "next/server";
import { SlotFillingEngine } from "@/lib/slot-filling";
import { getSchema } from "@/lib/slot-filling/schemas";

export async function POST(request: NextRequest) {
  const { schemaId, message, sessionId, context } = await request.json();

  // 1. 获取 Schema
  const schema = getSchema(schemaId);
  if (!schema) {
    return NextResponse.json(
      { error: "Schema not found", code: "SCHEMA_NOT_FOUND" },
      { status: 404 }
    );
  }

  // 2. 处理槽位填充
  const engine = new SlotFillingEngine();
  const action = await engine.process(schema, message, sessionId, context);

  // 3. 返回动作
  return NextResponse.json(action);
}
```

### 5.3 修改 IntentRouter 集成

```typescript
// 文件: src/lib/ai-skills/router/intent-router.ts (修改)

import { SlotFillingEngine } from "@/lib/slot-filling";
import { getSchema } from "@/lib/slot-filling/schemas";

export class IntentRouter {
  private slotFillingEngine: SlotFillingEngine;

  constructor() {
    this.slotFillingEngine = new SlotFillingEngine();
  }

  async route(
    message: string,
    context: ExecutionContext
  ): Promise<RoutingResult> {
    // 1. 分析意图
    const intent = await this.intentAnalyzer.analyze(message, context);

    // 2. 检查是否有对应的 SlotSchema
    const schema = getSchema(intent.workflowId);

    if (schema) {
      // 3. 执行槽位填充
      const slotAction = await this.slotFillingEngine.process(
        schema,
        message,
        context.sessionId,
        { userId: context.userId }
      );

      // 4. 根据动作类型返回结果
      if (slotAction.type === "ask" || slotAction.type === "clarify") {
        return {
          type: "slot_filling",
          action: slotAction,
          needsMoreInput: true
        };
      }

      if (slotAction.type === "confirm") {
        return {
          type: "confirmation",
          action: slotAction,
          needsConfirmation: true
        };
      }

      if (slotAction.type === "ready") {
        // 5. 参数完整，继续执行
        return {
          type: "execute",
          workflowId: intent.workflowId,
          params: slotAction.slots
        };
      }
    }

    // 无 Schema，使用原有逻辑
    return this.routeWithoutSlotFilling(intent, context);
  }
}
```

---

## 六、前端组件（可选）

> **优先级**: P2（可选实现）
> **建议**: Phase 1 使用纯对话式，验证价值后按需实现

### 6.1 实现模式对比

SlotFilling 支持两种前端交互模式：

```
┌─────────────────────────────────────────────────────────────────────┐
│                    模式 A: 纯对话式（零前端改动）                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  用户: 导出书签                                                      │
│  AI:   请选择导出格式：CSV、JSON、Markdown、HTML、Obsidian？         │
│  用户: markdown                                                      │
│  AI:   导出哪些书签？全部、最近添加、指定文件夹？                     │
│  用户: 最近一周                                                      │
│  AI:   ✅ 正在导出最近一周的书签为 Markdown 格式...                  │
│                                                                     │
│  ✅ 优点: 零前端改动，快速上线                                       │
│  ⚠️ 缺点: 某些槽位（如选文件夹）纯文字交互不便                       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                    模式 B: 混合式（对话 + UI 组件）                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  用户: 导出书签                                                      │
│  AI:   请选择导出格式：                                              │
│        ┌─────────────────────────────────────────┐                  │
│        │ [CSV] [JSON] [Markdown✓] [HTML] [Obsidian] │               │
│        └─────────────────────────────────────────┘                  │
│  用户: (点击 Markdown)                                               │
│  AI:   导出哪些书签？                                                │
│        ┌─────────────────────────────────────────┐                  │
│        │ ○ 全部  ○ 最近添加  ● 指定文件夹         │                  │
│        │ 📁 选择文件夹: [技术文章    ▼]          │                  │
│        └─────────────────────────────────────────┘                  │
│                                                                     │
│  ✅ 优点: 交互直观，减少输入错误                                     │
│  ⚠️ 缺点: 需要前端开发工作量                                        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 6.2 分阶段实现建议

```
Phase 1: 纯对话式（0 前端改动）          ← 先上线验证价值
    ↓
Phase 2: 增强型消息组件（轻量）          ← 体验优化
    ↓
Phase 3: 复杂槽位专用组件（按需）        ← 按需实现
```

### 6.3 Phase 2 组件：快捷选项消息

**工作量**: 0.5 天

当 SlotFilling 返回 `options` 时，渲染为可点击按钮：

```typescript
// 文件: src/components/ai/slot-options-message.tsx

import { Button } from "@/components/ui/button";
import { SlotOption } from "@/lib/slot-filling/types";

interface SlotOptionsMessageProps {
  /** 追问文本 */
  prompt: string;
  /** 可选项列表 */
  options: SlotOption[];
  /** 选择回调 */
  onSelect: (value: string) => void;
  /** 是否允许自由输入（默认 true） */
  allowFreeInput?: boolean;
}

export function SlotOptionsMessage({
  prompt,
  options,
  onSelect,
  allowFreeInput = true
}: SlotOptionsMessageProps) {
  return (
    <div className="ai-message space-y-3">
      <p className="text-sm">{prompt}</p>

      {/* 快捷选项按钮 */}
      <div className="flex flex-wrap gap-2">
        {options.map(opt => (
          <Button
            key={opt.value}
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => onSelect(opt.value)}
          >
            {opt.label}
          </Button>
        ))}
      </div>

      {/* 自由输入提示 */}
      {allowFreeInput && (
        <p className="text-xs text-muted-foreground">
          💬 或直接输入其他选项...
        </p>
      )}
    </div>
  );
}
```

**渲染效果**:

```
┌─────────────────────────────────────────────────────────┐
│  请选择导出格式：                                        │
│                                                         │
│  [CSV] [JSON] [Markdown] [HTML] [Obsidian]              │
│                                                         │
│  💬 或直接输入其他选项...                                │
└─────────────────────────────────────────────────────────┘
```

### 6.4 Phase 2 组件：确认卡片

**工作量**: 0.5 天

高风险操作的确认展示：

```typescript
// 文件: src/components/ai/slot-confirmation-card.tsx

import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { RiskLevel } from "@/lib/slot-filling/types";

interface SlotConfirmationCardProps {
  /** 确认标题 */
  title: string;
  /** 参数摘要 */
  summary: Record<string, string | number>;
  /** 风险等级 */
  riskLevel: RiskLevel;
  /** 确认回调 */
  onConfirm: () => void;
  /** 取消回调 */
  onCancel: () => void;
}

const riskConfig = {
  low: {
    icon: CheckCircle,
    color: "border-l-green-500",
    buttonVariant: "default" as const
  },
  medium: {
    icon: Info,
    color: "border-l-yellow-500",
    buttonVariant: "default" as const
  },
  high: {
    icon: AlertTriangle,
    color: "border-l-red-500",
    buttonVariant: "destructive" as const
  },
};

export function SlotConfirmationCard({
  title,
  summary,
  riskLevel,
  onConfirm,
  onCancel
}: SlotConfirmationCardProps) {
  const config = riskConfig[riskLevel];
  const Icon = config.icon;

  return (
    <Card className={cn("border-l-4", config.color)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className={cn("h-5 w-5", {
            "text-green-500": riskLevel === "low",
            "text-yellow-500": riskLevel === "medium",
            "text-red-500": riskLevel === "high",
          })} />
          {title}
        </CardTitle>
      </CardHeader>

      <CardContent className="pb-3">
        <dl className="space-y-2 text-sm">
          {Object.entries(summary).map(([key, value]) => (
            <div key={key} className="flex justify-between">
              <dt className="text-muted-foreground">{key}</dt>
              <dd className="font-medium">{value}</dd>
            </div>
          ))}
        </dl>

        {riskLevel === "high" && (
          <p className="mt-3 text-xs text-red-600">
            ⚠️ 此操作不可撤销，请确认后再执行
          </p>
        )}
      </CardContent>

      <CardFooter className="flex gap-2 justify-end pt-0">
        <Button variant="outline" size="sm" onClick={onCancel}>
          取消
        </Button>
        <Button variant={config.buttonVariant} size="sm" onClick={onConfirm}>
          确认执行
        </Button>
      </CardFooter>
    </Card>
  );
}
```

**渲染效果**:

```
┌─────────────────────────────────────────────────────────┐
│ ⚠️ 确认清理重复书签                                      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  检测模式        智能检测                                │
│  重复组数        12 组                                   │
│  待删除数量      23 个                                   │
│  保留策略        保留最新                                │
│                                                         │
│  ⚠️ 此操作不可撤销，请确认后再执行                       │
│                                                         │
│                              [取消]  [确认执行]          │
└─────────────────────────────────────────────────────────┘
```

### 6.5 Phase 3 组件：复杂槽位选择器

按需实现，优先级从高到低：

| 槽位类型 | 组件名称 | 工作量 | 优先级 | 说明 |
|---------|---------|--------|--------|------|
| `folder` | `FolderSlotPicker` | 1 天 | P1 | 文件夹树选择器 |
| `tags` | `TagsSlotInput` | 0.5 天 | P1 | 带自动补全的标签输入 |
| `date_range` | `DateRangeSlotPicker` | 0.5 天 | P2 | 日期范围选择 |
| `bookmarks` | `BookmarkSlotSelector` | 1 天 | P2 | 书签多选列表 |
| `multi_enum` | `MultiSelectSlotGroup` | 0.5 天 | P3 | 多选复选框组 |

#### 6.5.1 文件夹选择器

```typescript
// 文件: src/components/ai/folder-slot-picker.tsx

import { FolderTree } from "@/components/folder/folder-tree";
import { useFolders } from "@/hooks/use-folders";

interface FolderSlotPickerProps {
  prompt: string;
  onSelect: (folderId: number, folderName: string) => void;
  onCancel: () => void;
}

export function FolderSlotPicker({ prompt, onSelect, onCancel }: FolderSlotPickerProps) {
  const { folders, isLoading } = useFolders();

  return (
    <div className="ai-message space-y-3">
      <p className="text-sm">{prompt}</p>

      <div className="border rounded-md p-2 max-h-64 overflow-y-auto">
        {isLoading ? (
          <div className="text-center py-4 text-muted-foreground">加载中...</div>
        ) : (
          <FolderTree
            folders={folders}
            onSelect={(folder) => onSelect(folder.id, folder.name)}
            selectable
          />
        )}
      </div>

      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          取消选择
        </Button>
      </div>
    </div>
  );
}
```

#### 6.5.2 标签输入器

```typescript
// 文件: src/components/ai/tags-slot-input.tsx

import { TagInput } from "@/components/ui/tag-input";
import { usePopularTags } from "@/hooks/use-popular-tags";

interface TagsSlotInputProps {
  prompt: string;
  onSubmit: (tags: string[]) => void;
  maxTags?: number;
}

export function TagsSlotInput({ prompt, onSubmit, maxTags = 20 }: TagsSlotInputProps) {
  const [tags, setTags] = useState<string[]>([]);
  const { popularTags } = usePopularTags();

  return (
    <div className="ai-message space-y-3">
      <p className="text-sm">{prompt}</p>

      <TagInput
        value={tags}
        onChange={setTags}
        suggestions={popularTags}
        maxTags={maxTags}
        placeholder="输入标签，按回车添加..."
      />

      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={() => setTags([])}>
          清空
        </Button>
        <Button size="sm" onClick={() => onSubmit(tags)} disabled={tags.length === 0}>
          确认 ({tags.length})
        </Button>
      </div>
    </div>
  );
}
```

### 6.6 集成到聊天界面

```typescript
// 文件: src/components/ai/chat-message.tsx (修改)

import { SlotOptionsMessage } from "./slot-options-message";
import { SlotConfirmationCard } from "./slot-confirmation-card";
import { FolderSlotPicker } from "./folder-slot-picker";
import { TagsSlotInput } from "./tags-slot-input";

interface ChatMessageProps {
  message: Message;
  slotAction?: SlotFillingAction;
  onSlotSelect?: (value: unknown) => void;
  onConfirm?: () => void;
  onCancel?: () => void;
}

export function ChatMessage({
  message,
  slotAction,
  onSlotSelect,
  onConfirm,
  onCancel
}: ChatMessageProps) {
  // 普通消息
  if (!slotAction) {
    return <div className="ai-message">{message.content}</div>;
  }

  // SlotFilling 追问消息
  switch (slotAction.type) {
    case "ask":
      // 根据槽位类型选择组件
      if (slotAction.slotType === "folder") {
        return (
          <FolderSlotPicker
            prompt={slotAction.prompt}
            onSelect={(id, name) => onSlotSelect?.({ id, name })}
            onCancel={() => onCancel?.()}
          />
        );
      }
      if (slotAction.slotType === "tags") {
        return (
          <TagsSlotInput
            prompt={slotAction.prompt}
            onSubmit={(tags) => onSlotSelect?.(tags)}
          />
        );
      }
      // 默认：快捷选项
      if (slotAction.options) {
        return (
          <SlotOptionsMessage
            prompt={slotAction.prompt}
            options={slotAction.options}
            onSelect={(value) => onSlotSelect?.(value)}
          />
        );
      }
      // 纯文本追问
      return <div className="ai-message">{slotAction.prompt}</div>;

    case "confirm":
      return (
        <SlotConfirmationCard
          title={slotAction.title || "确认执行"}
          summary={slotAction.summary}
          riskLevel={slotAction.riskLevel || "medium"}
          onConfirm={() => onConfirm?.()}
          onCancel={() => onCancel?.()}
        />
      );

    default:
      return <div className="ai-message">{message.content}</div>;
  }
}
```

### 6.7 工作量汇总

| 阶段 | 组件 | 工作量 | 优先级 | 状态 |
|------|------|--------|--------|------|
| Phase 1 | 无需前端改动 | 0 | - | ✅ 默认 |
| Phase 2 | SlotOptionsMessage | 0.5 天 | P1 | 📋 可选 |
| Phase 2 | SlotConfirmationCard | 0.5 天 | P1 | 📋 可选 |
| Phase 3 | FolderSlotPicker | 1 天 | P2 | 📋 可选 |
| Phase 3 | TagsSlotInput | 0.5 天 | P2 | 📋 可选 |
| Phase 3 | DateRangeSlotPicker | 0.5 天 | P3 | 📋 可选 |
| Phase 3 | BookmarkSlotSelector | 1 天 | P3 | 📋 可选 |
| - | ChatMessage 集成 | 0.5 天 | - | 📋 可选 |
| **合计** | - | **5 天** | - | - |

### 6.8 文件清单

```
src/components/ai/
├── slot-options-message.tsx       # 快捷选项消息 (Phase 2)
├── slot-confirmation-card.tsx     # 确认卡片 (Phase 2)
├── folder-slot-picker.tsx         # 文件夹选择器 (Phase 3)
├── tags-slot-input.tsx            # 标签输入器 (Phase 3)
├── date-range-slot-picker.tsx     # 日期选择器 (Phase 3)
├── bookmark-slot-selector.tsx     # 书签选择器 (Phase 3)
└── chat-message.tsx               # 消息组件集成 (修改)
```

---

## 七、测试策略

### 7.1 测试金字塔

```
                    ┌─────────────────┐
                    │   E2E 测试      │  10 个完整对话流程
                    │   (10 场景)     │
                    └────────┬────────┘
                             │
              ┌──────────────┴──────────────┐
              │        集成测试              │  30+ 用例
              │  (Engine + Extractor +      │
              │   Validator + Schema)        │
              └──────────────┬──────────────┘
                             │
    ┌────────────────────────┴────────────────────────┐
    │                   单元测试                       │  200+ 用例
    │  - SlotExtractor: 50+ 用例                      │
    │  - SlotValidator: 40+ 用例                      │
    │  - PromptBuilder: 30+ 用例                      │
    │  - StateManager: 20+ 用例                       │
    │  - 每个 Schema: 10+ 用例                        │
    └─────────────────────────────────────────────────┘
```

### 7.2 测试用例设计

#### 7.2.1 每个 Schema 的必备测试

| 用例类型 | 描述 | 示例 |
|---------|------|------|
| **完整输入** | 一句话包含所有必填参数 | "导出最近一周的书签为 markdown 格式" |
| **最小输入** | 仅触发词，验证追问顺序 | "导出书签" |
| **部分输入** | 每个必填槽位缺失一次 | "导出为 csv" (缺 scope) |
| **无效输入** | 每个有验证规则的槽位 | "返回 200 条结果" (超出 100 上限) |
| **条件分支** | 依赖槽位的激活/不激活 | scope=folder 时询问 folder_id |
| **同义词** | 同义词正确映射 | "表格" → "csv" |
| **确认流程** | 确认通过/拒绝 | 高风险操作确认 |

#### 7.2.2 测试文件结构

```
src/lib/slot-filling/__tests__/
├── unit/
│   ├── slot-extractor.test.ts
│   ├── slot-validator.test.ts
│   ├── prompt-builder.test.ts
│   ├── state-manager.test.ts
│   └── schemas/
│       ├── search-and-filter.schema.test.ts
│       ├── data-export.schema.test.ts
│       ├── batch-tag.schema.test.ts
│       ├── batch-move.schema.test.ts
│       ├── duplicate-cleanup.schema.test.ts
│       ├── reading-plan.schema.test.ts
│       ├── periodic-report.schema.test.ts
│       ├── thematic-synthesis.schema.test.ts
│       ├── backup-restore.schema.test.ts
│       └── health-check.schema.test.ts
├── integration/
│   ├── slot-filling-engine.test.ts
│   └── intent-router-integration.test.ts
└── e2e/
    └── slot-filling-flows.e2e.test.ts
```

#### 7.2.3 示例测试用例

```typescript
// 文件: src/lib/slot-filling/__tests__/unit/schemas/data-export.schema.test.ts

import { SlotFillingEngine } from "../../engine/slot-filling-engine";
import { dataExportSchema } from "../../schemas/data-export.schema";

describe("DataExport Schema", () => {
  let engine: SlotFillingEngine;

  beforeEach(() => {
    engine = new SlotFillingEngine();
  });

  describe("完整输入", () => {
    it("应该从一句话中提取所有必填参数", async () => {
      const result = await engine.process(
        dataExportSchema,
        "导出最近一周的书签为 markdown 格式",
        "session-1"
      );

      expect(result.type).toBe("ready");
      expect(result.slots).toMatchObject({
        format: "markdown",
        scope: "date_range",
        date_range: "last_7_days"
      });
    });
  });

  describe("最小输入", () => {
    it("应该先询问 format", async () => {
      const result = await engine.process(
        dataExportSchema,
        "导出我的书签",
        "session-2"
      );

      expect(result.type).toBe("ask");
      expect(result.slotId).toBe("format");
    });

    it("format 填充后应该询问 scope", async () => {
      // 第一轮
      await engine.process(dataExportSchema, "导出书签", "session-3");

      // 第二轮
      const result = await engine.process(
        dataExportSchema,
        "csv",
        "session-3"
      );

      expect(result.type).toBe("ask");
      expect(result.slotId).toBe("scope");
    });
  });

  describe("条件槽位", () => {
    it("scope=folder 时应该询问 folder_id", async () => {
      await engine.process(dataExportSchema, "导出", "session-4");
      await engine.process(dataExportSchema, "csv", "session-4");

      const result = await engine.process(
        dataExportSchema,
        "指定文件夹",
        "session-4"
      );

      expect(result.type).toBe("ask");
      expect(result.slotId).toBe("folder_id");
    });

    it("scope=all 时不应该询问 folder_id", async () => {
      await engine.process(dataExportSchema, "导出", "session-5");
      await engine.process(dataExportSchema, "csv", "session-5");

      const result = await engine.process(
        dataExportSchema,
        "全部",
        "session-5"
      );

      expect(result.type).toBe("ready");
      expect(result.slots.folder_id).toBeUndefined();
    });
  });

  describe("同义词映射", () => {
    it.each([
      ["表格", "csv"],
      ["excel", "csv"],
      ["笔记", "markdown"],
      ["md", "markdown"],
      ["网页", "html"],
    ])("'%s' 应该映射为 '%s'", async (input, expected) => {
      const result = await engine.process(
        dataExportSchema,
        `导出为${input}`,
        `session-synonym-${input}`
      );

      // 继续填充其他槽位
      if (result.type === "ask") {
        const finalResult = await engine.process(
          dataExportSchema,
          "全部",
          `session-synonym-${input}`
        );
        expect(finalResult.type).toBe("ready");
        expect(finalResult.slots.format).toBe(expected);
      }
    });
  });

  describe("默认值", () => {
    it("include_fields 应该使用默认值", async () => {
      await engine.process(dataExportSchema, "导出", "session-6");
      await engine.process(dataExportSchema, "json", "session-6");

      const result = await engine.process(
        dataExportSchema,
        "全部",
        "session-6"
      );

      expect(result.type).toBe("ready");
      expect(result.slots.include_fields).toEqual([
        "title", "url", "tags", "created_at"
      ]);
    });
  });
});
```

### 7.3 测试覆盖目标

| 模块 | 覆盖率目标 | 关键指标 |
|------|-----------|----------|
| SlotExtractor | > 90% | 规则提取、同义词、LLM 提取 |
| SlotValidator | > 95% | 类型验证、范围验证、依赖验证 |
| PromptBuilder | > 85% | 模板渲染、变量替换 |
| StateManager | > 90% | 状态持久化、会话管理 |
| 每个 Schema | > 85% | 完整流程、边界条件 |

---

## 八、实现路线图

### 8.1 阶段划分

```
Phase 1: 基础框架 (3 天)
├── Day 1: 类型定义 + Schema 定义
├── Day 2: SlotExtractor 核心逻辑
└── Day 3: SlotValidator + StateManager

Phase 2: 引擎实现 (4 天)
├── Day 4-5: SlotFillingEngine 主流程
├── Day 6: PromptBuilder
└── Day 7: 单元测试 (70%+ 覆盖)

Phase 3: 集成 (3 天)
├── Day 8: IntentRouter 集成
├── Day 9: API 端点 + 前端适配
└── Day 10: 集成测试

Phase 4: 优化 (2 天)
├── Day 11: LLM 提取优化
└── Day 12: E2E 测试 + 文档
```

### 8.2 关键里程碑

| 里程碑 | 时间 | 交付物 |
|--------|------|--------|
| M1 | Day 3 | 类型系统 + 10 个 Schema 定义完成 |
| M2 | Day 7 | SlotFillingEngine 核心功能可用 |
| M3 | Day 10 | 与现有系统集成完成 |
| M4 | Day 12 | 全部测试通过，文档完成 |

### 8.3 风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| LLM 提取准确率不足 | 中 | 优先使用规则提取，LLM 作为兜底 |
| 多轮对话状态丢失 | 高 | 使用 Redis 或数据库持久化状态 |
| 追问过多影响体验 | 中 | 优化提取算法，增加同义词覆盖 |
| 与现有系统冲突 | 低 | 渐进式集成，Feature Flag 控制 |

### 8.4 文件清单

```
src/lib/slot-filling/
├── types/
│   ├── slot.types.ts              # 槽位类型定义
│   ├── engine.types.ts            # 引擎类型定义
│   └── index.ts                   # 类型导出
├── schemas/
│   ├── search-and-filter.schema.ts
│   ├── data-export.schema.ts
│   ├── batch-tag.schema.ts
│   ├── batch-move.schema.ts
│   ├── duplicate-cleanup.schema.ts
│   ├── reading-plan.schema.ts
│   ├── periodic-report.schema.ts
│   ├── thematic-synthesis.schema.ts
│   ├── backup-restore.schema.ts
│   ├── health-check.schema.ts
│   └── index.ts                   # Schema 注册表
├── engine/
│   ├── slot-filling-engine.ts     # 核心引擎
│   ├── slot-extractor.ts          # 槽位提取器
│   ├── slot-validator.ts          # 槽位验证器
│   ├── prompt-builder.ts          # 追问生成器
│   ├── state-manager.ts           # 状态管理器
│   └── index.ts                   # 引擎导出
├── __tests__/
│   ├── unit/                      # 单元测试
│   ├── integration/               # 集成测试
│   └── e2e/                       # E2E 测试
└── index.ts                       # 模块导出

src/app/api/agent/slot-filling/
└── route.ts                       # API 端点
```

---

## 附录

### A. 术语表

| 术语 | 定义 |
|------|------|
| **Slot** | 槽位，工作流执行所需的一个参数 |
| **Schema** | 模式，定义工作流所有槽位的结构 |
| **SlotFilling** | 槽位填充，从用户输入中提取并验证参数的过程 |
| **Extraction** | 提取，从自然语言中识别参数值 |
| **Dependency** | 依赖，槽位之间的条件关系 |

### B. 参考资料

- [Rasa Slot Filling](https://rasa.com/docs/rasa/slot-filling/)
- [Dialogflow CX Parameters](https://cloud.google.com/dialogflow/cx/docs/concept/parameter)
- [Amazon Lex Slot Types](https://docs.aws.amazon.com/lex/latest/dg/howitworks-slot-types.html)

---

**文档版本**: 1.0.0
**最后更新**: 2026-01-14
**下一步**: 等待审核后开始 Phase 1 实现
