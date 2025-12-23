# 智能列表 AI Skill 设计方案

> **版本**: 1.0.0
> **创建日期**: 2025-12-23
> **状态**: 设计中
> **基于**: AI Skills Phase 2 架构

---

## 一、功能概述

### 1.1 核心价值

智能列表是基于**规则的动态筛选视图**，自动聚合符合条件的书签。作为 AI Skill，它提供：

1. **预设智能列表**：系统内置的常用筛选场景
2. **自然语言建表**：用户用口语描述，AI 转换为筛选规则
3. **智能推荐**：基于用户数据分析，推荐个性化列表
4. **动态计数**：实时显示每个列表的书签数量

### 1.2 设计原则

| 层级         | 职责               | 特点                   |
| ------------ | ------------------ | ---------------------- |
| **Skill 层** | AI 理解 + 规则生成 | 调用 LLM，处理自然语言 |
| **Tool 层**  | 数据库 CRUD 操作   | 快速、可靠、无 AI 依赖 |
| **预设规则** | 内置常用场景       | 零配置、开箱即用       |

---

## 二、预设智能列表（7 个核心场景）

基于竞品分析和用户需求，设计以下预设智能列表：

### 2.1 预设列表清单

| #   | 名称         | 图标 | 规则定义                                    | 说明                 |
| --- | ------------ | ---- | ------------------------------------------- | -------------------- |
| 1   | 最近一周     | 📅   | `date_range: "7d"`                          | 最近 7 天收藏的内容  |
| 2   | 高价值收藏   | 💎   | `quality_score: { min: 80 }`                | AI 评分 ≥ 80 的内容  |
| 3   | 待阅读       | 📖   | `read_status: "unread"`                     | 未读内容             |
| 4   | 优质经验     | 🏆   | `tag_contains: ["经验", "教程", "实战"]`    | 包含经验类标签的内容 |
| 5   | 推荐关注     | 👀   | `is_ai_recommended: true`                   | AI 标记为重要的内容  |
| 6   | 值得复读     | 🔄   | `is_starred: true`                          | 用户收藏/标星的内容  |
| 7   | 我的优质内容 | ✨   | `quality_score: { min: 70 }, is_read: true` | 已读且高评分的内容   |

### 2.2 预设规则详细定义

```typescript
// src/lib/ai-agent/tools/smart-list/preset-rules.ts

export const PRESET_SMART_LISTS: PresetSmartList[] = [
  {
    id: "recent-week",
    name: "最近一周",
    icon: "📅",
    color: "#3B82F6", // blue
    description: "最近 7 天收藏的内容",
    rule: {
      date_range: "7d",
    },
    sort: { field: "created_at", order: "desc" },
    display_order: 1,
  },
  {
    id: "high-value",
    name: "高价值收藏",
    icon: "💎",
    color: "#F59E0B", // amber
    description: "AI 评分 80 分以上的优质内容",
    rule: {
      quality_score: { min: 80 },
    },
    sort: { field: "quality_score", order: "desc" },
    display_order: 2,
  },
  {
    id: "unread",
    name: "待阅读",
    icon: "📖",
    color: "#8B5CF6", // violet
    description: "还没来得及阅读的内容",
    rule: {
      read_status: "unread",
    },
    sort: { field: "created_at", order: "desc" },
    display_order: 3,
  },
  {
    id: "quality-experience",
    name: "优质经验",
    icon: "🏆",
    color: "#10B981", // emerald
    description: "包含经验、教程、实战等标签的内容",
    rule: {
      tag_contains: ["经验", "教程", "实战", "干货", "总结"],
    },
    sort: { field: "quality_score", order: "desc" },
    display_order: 4,
  },
  {
    id: "ai-recommended",
    name: "推荐关注",
    icon: "👀",
    color: "#EF4444", // red
    description: "AI 识别为重要或时效性强的内容",
    rule: {
      is_ai_recommended: true,
    },
    sort: { field: "ai_recommended_at", order: "desc" },
    display_order: 5,
  },
  {
    id: "worth-revisit",
    name: "值得复读",
    icon: "🔄",
    color: "#06B6D4", // cyan
    description: "标记为收藏/需要复习的内容",
    rule: {
      is_starred: true,
    },
    sort: { field: "starred_at", order: "desc" },
    display_order: 6,
  },
  {
    id: "my-quality-content",
    name: "我的优质内容",
    icon: "✨",
    color: "#EC4899", // pink
    description: "已读且评分较高的内容，代表你的知识库精华",
    rule: {
      quality_score: { min: 70 },
      read_status: "read",
    },
    sort: { field: "quality_score", order: "desc" },
    display_order: 7,
  },
];
```

---

## 三、架构设计

### 3.1 整体架构图

```
┌─────────────────────────────────────────────────────────────────────┐
│                      智能列表 AI Skill 架构                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                   SmartListSkill (AI 层)                     │   │
│  │                                                              │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │   │
│  │  │parse_intent │  │suggest_lists│  │optimize_rule│         │   │
│  │  │自然语言解析  │  │智能推荐列表  │  │优化筛选规则  │         │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘         │   │
│  │                                                              │   │
│  └──────────────────────────┬───────────────────────────────────┘   │
│                             │                                       │
│  ┌──────────────────────────▼───────────────────────────────────┐   │
│  │                   Smart List Tools (数据层)                   │   │
│  │                                                               │   │
│  │  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐    │   │
│  │  │create_smart_  │  │list_smart_    │  │get_smart_list_│    │   │
│  │  │list           │  │lists          │  │items          │    │   │
│  │  │创建智能列表    │  │列出所有列表    │  │获取列表内容    │    │   │
│  │  └───────────────┘  └───────────────┘  └───────────────┘    │   │
│  │                                                               │   │
│  │  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐    │   │
│  │  │update_smart_  │  │delete_smart_  │  │get_smart_list_│    │   │
│  │  │list           │  │list           │  │count          │    │   │
│  │  │更新列表规则    │  │删除列表        │  │获取列表计数    │    │   │
│  │  └───────────────┘  └───────────────┘  └───────────────┘    │   │
│  │                                                               │   │
│  └──────────────────────────┬───────────────────────────────────┘   │
│                             │                                       │
│  ┌──────────────────────────▼───────────────────────────────────┐   │
│  │                    Preset Rules (预设规则)                     │   │
│  │                                                               │   │
│  │  📅 最近一周  💎 高价值收藏  📖 待阅读  🏆 优质经验            │   │
│  │  👀 推荐关注  🔄 值得复读    ✨ 我的优质内容                    │   │
│  │                                                               │   │
│  └──────────────────────────┬───────────────────────────────────┘   │
│                             │                                       │
│  ┌──────────────────────────▼───────────────────────────────────┐   │
│  │                    Database (PostgreSQL)                      │   │
│  │                                                               │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │   │
│  │  │smart_lists  │  │ bookmarks   │  │smart_list_  │          │   │
│  │  │列表定义      │  │ 书签数据     │  │counts_cache │          │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘          │   │
│  │                                                               │   │
│  └───────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 规则 Schema 定义

```typescript
// src/lib/ai-agent/tools/smart-list/types.ts

import { z } from "zod";

/**
 * 智能列表筛选规则 Schema
 */
export const smartListRuleSchema = z.object({
  // 时间范围
  date_range: z.enum(["1d", "7d", "30d", "90d", "1y", "all"]).optional(),
  date_from: z.string().datetime().optional(), // 自定义开始日期
  date_to: z.string().datetime().optional(), // 自定义结束日期

  // 平台筛选
  platforms: z
    .array(
      z.enum([
        "WECHAT",
        "BILIBILI",
        "XIAOHONGSHU",
        "BROWSER",
        "TWITTER",
        "OTHER",
      ]),
    )
    .optional(),

  // 质量评分 (0-100)
  quality_score: z
    .object({
      min: z.number().min(0).max(100).optional(),
      max: z.number().min(0).max(100).optional(),
    })
    .optional(),

  // 标签筛选
  has_tags: z.boolean().optional(), // 是否有标签
  tag_contains: z.array(z.string()).optional(), // 包含这些标签（OR 关系）
  tag_match_all: z.array(z.string()).optional(), // 必须包含所有标签（AND 关系）

  // 关键词搜索
  keyword: z.string().optional(),
  keyword_in: z.enum(["title", "content", "all"]).optional(),

  // 阅读状态
  read_status: z.enum(["read", "unread", "all"]).optional(),

  // 收藏标记
  is_starred: z.boolean().optional(),

  // AI 推荐
  is_ai_recommended: z.boolean().optional(),

  // 文件夹筛选
  folder_ids: z.array(z.number()).optional(),
  include_subfolders: z.boolean().optional(),

  // 内容类型
  content_type: z.enum(["article", "video", "image", "link", "all"]).optional(),
});

export type SmartListRule = z.infer<typeof smartListRuleSchema>;

/**
 * 智能列表排序配置
 */
export const smartListSortSchema = z.object({
  field: z.enum([
    "created_at", // 收藏时间
    "updated_at", // 更新时间
    "quality_score", // 质量评分
    "title", // 标题
    "read_at", // 阅读时间
    "starred_at", // 收藏时间
  ]),
  order: z.enum(["asc", "desc"]),
});

export type SmartListSort = z.infer<typeof smartListSortSchema>;

/**
 * 智能列表完整定义
 */
export interface SmartList {
  id: number;
  user_id: string;
  name: string;
  description?: string;
  icon: string;
  color?: string;
  rule: SmartListRule;
  sort: SmartListSort;
  is_preset: boolean;
  display_order: number;
  cached_count?: number;
  cached_at?: string;
  created_at: string;
  updated_at: string;
}

/**
 * 预设智能列表定义
 */
export interface PresetSmartList {
  id: string; // 预设 ID (如 'recent-week')
  name: string;
  icon: string;
  color: string;
  description: string;
  rule: SmartListRule;
  sort: SmartListSort;
  display_order: number;
}
```

---

## 四、SmartListSkill 详细设计

### 4.1 Skill 定义

```typescript
// src/lib/ai-agent/skills/smart-list.skill.ts

import { BaseSkill } from "./base-skill";
import { z } from "zod";
import type { ToolContext, ToolResult } from "../tools/types";
import { smartListRuleSchema } from "../tools/smart-list/types";
import { PRESET_SMART_LISTS } from "../tools/smart-list/preset-rules";

export class SmartListSkill extends BaseSkill {
  name = "smart_list_skill";

  description = `智能列表管理技能，用于：
1. 将用户的自然语言描述转换为筛选规则
2. 基于用户收藏数据推荐个性化智能列表
3. 优化和简化现有筛选规则
4. 解释智能列表的筛选逻辑`;

  parameters = z.object({
    action: z.enum([
      "parse_intent", // 自然语言 → 筛选规则
      "suggest_lists", // 推荐智能列表
      "explain_rule", // 解释规则含义
      "optimize_rule", // 优化规则
      "match_preset", // 匹配预设列表
    ]),
    userInput: z.string().optional(),
    rule: smartListRuleSchema.optional(),
    context: z
      .object({
        existingLists: z.array(z.string()).optional(), // 已有列表名称
        userTags: z.array(z.string()).optional(), // 用户常用标签
      })
      .optional(),
  });

  async execute(
    params: z.infer<typeof this.parameters>,
    context: ToolContext,
  ): Promise<ToolResult> {
    switch (params.action) {
      case "parse_intent":
        return this.parseUserIntent(params.userInput!, context);

      case "suggest_lists":
        return this.suggestSmartLists(context);

      case "explain_rule":
        return this.explainRule(params.rule!, context);

      case "optimize_rule":
        return this.optimizeRule(params.rule!, context);

      case "match_preset":
        return this.matchPreset(params.userInput!, context);

      default:
        return { success: false, error: "未知操作" };
    }
  }

  /**
   * 将自然语言转换为筛选规则
   */
  private async parseUserIntent(
    input: string,
    context: ToolContext,
  ): Promise<ToolResult> {
    const prompt = `你是 AnyKeep 智能列表助手。用户想创建一个智能列表。

用户输入：「${input}」

请分析用户意图，生成智能列表配置。

## 可用规则字段

| 字段 | 类型 | 说明 |
|------|------|------|
| date_range | "1d"/"7d"/"30d"/"90d"/"1y"/"all" | 时间范围 |
| platforms | ["WECHAT", "BILIBILI", "XIAOHONGSHU", "BROWSER"] | 平台 |
| quality_score | { min?: 0-100, max?: 0-100 } | 质量评分范围 |
| tag_contains | string[] | 包含这些标签之一 |
| keyword | string | 关键词搜索 |
| read_status | "read"/"unread"/"all" | 阅读状态 |
| is_starred | boolean | 是否收藏 |
| is_ai_recommended | boolean | 是否 AI 推荐 |

## 输出格式（JSON）

{
  "name": "列表名称（简洁，2-6字）",
  "description": "列表描述（一句话说明）",
  "icon": "合适的 emoji",
  "rule": { /* 筛选规则 */ },
  "sort": { "field": "created_at", "order": "desc" },
  "confidence": 0.0-1.0  // 解析置信度
}

请直接输出 JSON，不要其他内容。`;

    try {
      const result = await this.callLLM(prompt);
      const parsed = JSON.parse(result);

      return {
        success: true,
        data: {
          smartList: parsed,
          originalInput: input,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: "无法解析用户意图，请尝试更具体的描述",
      };
    }
  }

  /**
   * 匹配预设列表
   */
  private async matchPreset(
    input: string,
    context: ToolContext,
  ): Promise<ToolResult> {
    const prompt = `用户想查看智能列表，输入为：「${input}」

可用的预设列表：
${PRESET_SMART_LISTS.map((p) => `- ${p.name}: ${p.description}`).join("\n")}

请判断用户想查看哪个列表，输出格式：
{
  "matched_preset_id": "preset-id 或 null",
  "confidence": 0.0-1.0,
  "reason": "匹配原因"
}`;

    try {
      const result = await this.callLLM(prompt);
      const parsed = JSON.parse(result);

      if (parsed.matched_preset_id) {
        const preset = PRESET_SMART_LISTS.find(
          (p) => p.id === parsed.matched_preset_id,
        );
        return {
          success: true,
          data: {
            preset,
            confidence: parsed.confidence,
            reason: parsed.reason,
          },
        };
      }

      return {
        success: true,
        data: {
          preset: null,
          suggestion: "没有匹配的预设列表，是否要创建新的智能列表？",
        },
      };
    } catch (error) {
      return { success: false, error: "匹配失败" };
    }
  }

  /**
   * 基于用户数据推荐智能列表
   */
  private async suggestSmartLists(context: ToolContext): Promise<ToolResult> {
    // 获取用户统计数据
    const stats = await this.getUserBookmarkStats(context.userId);

    const suggestions: SuggestedList[] = [];

    // 1. 基于平台分布推荐
    const topPlatform = this.getTopPlatform(stats.platformCounts);
    if (topPlatform && stats.platformCounts[topPlatform] > 20) {
      suggestions.push({
        name: `${this.getPlatformName(topPlatform)}精选`,
        icon: this.getPlatformIcon(topPlatform),
        rule: {
          platforms: [topPlatform],
          quality_score: { min: 70 },
        },
        reason: `您有 ${stats.platformCounts[topPlatform]} 条${this.getPlatformName(topPlatform)}内容`,
        priority: 1,
      });
    }

    // 2. 基于标签聚类推荐
    if (stats.topTags.length > 0) {
      const topTag = stats.topTags[0];
      suggestions.push({
        name: `${topTag.name}专题`,
        icon: "🏷️",
        rule: { tag_contains: [topTag.name] },
        reason: `"${topTag.name}"是您最常用的标签（${topTag.count} 次）`,
        priority: 2,
      });
    }

    // 3. 基于阅读积压推荐
    if (stats.unreadCount > 50) {
      suggestions.push({
        name: "本周必读",
        icon: "🎯",
        rule: {
          read_status: "unread",
          quality_score: { min: 75 },
          date_range: "30d",
        },
        reason: `您有 ${stats.unreadCount} 条未读，这个列表帮您筛选最值得读的`,
        priority: 1,
      });
    }

    // 4. 基于收藏习惯推荐
    if (stats.starredCount > 10) {
      suggestions.push({
        name: "复习清单",
        icon: "📚",
        rule: {
          is_starred: true,
          read_status: "read",
        },
        reason: `${stats.starredCount} 条收藏内容等待复习`,
        priority: 3,
      });
    }

    // 按优先级排序
    suggestions.sort((a, b) => a.priority - b.priority);

    return {
      success: true,
      data: {
        suggestions: suggestions.slice(0, 5), // 最多返回 5 个建议
        stats: {
          totalBookmarks: stats.totalCount,
          unreadCount: stats.unreadCount,
          topPlatform,
        },
      },
    };
  }

  /**
   * 解释规则含义
   */
  private async explainRule(
    rule: SmartListRule,
    context: ToolContext,
  ): Promise<ToolResult> {
    const conditions: string[] = [];

    if (rule.date_range) {
      const rangeMap: Record<string, string> = {
        "1d": "最近 1 天",
        "7d": "最近 7 天",
        "30d": "最近 30 天",
        "90d": "最近 3 个月",
        "1y": "最近 1 年",
      };
      conditions.push(rangeMap[rule.date_range] || "全部时间");
    }

    if (rule.platforms?.length) {
      const platformNames = rule.platforms.map((p) => this.getPlatformName(p));
      conditions.push(`来自 ${platformNames.join("、")}`);
    }

    if (rule.quality_score?.min) {
      conditions.push(`质量评分 ≥ ${rule.quality_score.min} 分`);
    }

    if (rule.tag_contains?.length) {
      conditions.push(`包含标签：${rule.tag_contains.join("、")}`);
    }

    if (rule.read_status === "unread") {
      conditions.push("未读");
    } else if (rule.read_status === "read") {
      conditions.push("已读");
    }

    if (rule.is_starred) {
      conditions.push("已收藏");
    }

    if (rule.is_ai_recommended) {
      conditions.push("AI 推荐");
    }

    if (rule.keyword) {
      conditions.push(`包含关键词「${rule.keyword}」`);
    }

    return {
      success: true,
      data: {
        explanation:
          conditions.length > 0
            ? `筛选条件：${conditions.join(" + ")}`
            : "显示全部内容（无筛选条件）",
        conditions,
        conditionCount: conditions.length,
      },
    };
  }

  // 辅助方法
  private getPlatformName(platform: string): string {
    const map: Record<string, string> = {
      WECHAT: "微信",
      BILIBILI: "B站",
      XIAOHONGSHU: "小红书",
      BROWSER: "浏览器书签",
      TWITTER: "Twitter",
    };
    return map[platform] || platform;
  }

  private getPlatformIcon(platform: string): string {
    const map: Record<string, string> = {
      WECHAT: "💚",
      BILIBILI: "📺",
      XIAOHONGSHU: "📕",
      BROWSER: "🌐",
      TWITTER: "🐦",
    };
    return map[platform] || "📄";
  }
}
```

---

## 五、Smart List Tools 详细设计

### 5.1 工具清单

| Tool 名称              | 类别   | 说明               | 需要确认 |
| ---------------------- | ------ | ------------------ | -------- |
| `create_smart_list`    | action | 创建智能列表       | 否       |
| `list_smart_lists`     | query  | 列出用户的智能列表 | 否       |
| `get_smart_list_items` | query  | 获取列表内的书签   | 否       |
| `get_smart_list_count` | query  | 获取列表书签计数   | 否       |
| `update_smart_list`    | action | 更新列表规则       | 否       |
| `delete_smart_list`    | action | 删除智能列表       | 是       |
| `reorder_smart_lists`  | action | 调整列表顺序       | 否       |

### 5.2 Tool 实现

```typescript
// src/lib/ai-agent/tools/smart-list/index.ts

export * from "./types";
export * from "./preset-rules";
export * from "./create-smart-list.tool";
export * from "./list-smart-lists.tool";
export * from "./get-smart-list-items.tool";
export * from "./get-smart-list-count.tool";
export * from "./update-smart-list.tool";
export * from "./delete-smart-list.tool";
```

```typescript
// src/lib/ai-agent/tools/smart-list/create-smart-list.tool.ts

import { z } from "zod";
import type { Tool, ToolContext, ToolResult } from "../types";
import { smartListRuleSchema, smartListSortSchema } from "./types";
import { createClient } from "@/lib/supabase/server";

const paramsSchema = z.object({
  name: z.string().min(1).max(50).describe("列表名称"),
  description: z.string().max(200).optional().describe("列表描述"),
  icon: z.string().max(10).optional().describe("图标 emoji"),
  color: z.string().optional().describe("主题色（十六进制）"),
  rule: smartListRuleSchema.describe("筛选规则"),
  sort: smartListSortSchema.optional().describe("排序配置"),
});

export const createSmartListTool: Tool<z.infer<typeof paramsSchema>> = {
  definition: {
    name: "create_smart_list",
    description: "创建一个新的智能列表。智能列表会自动聚合符合筛选规则的书签。",
    parameters: paramsSchema,
    category: "action",
    requiresConfirmation: false,
  },

  async execute(params, context): Promise<ToolResult> {
    const startTime = performance.now();

    try {
      const supabase = await createClient();

      // 检查是否已存在同名列表
      const { data: existing } = await supabase
        .from("smart_lists")
        .select("id")
        .eq("user_id", context.userId)
        .eq("name", params.name)
        .single();

      if (existing) {
        return {
          success: false,
          error: `已存在名为「${params.name}」的智能列表`,
        };
      }

      // 获取当前最大 display_order
      const { data: maxOrder } = await supabase
        .from("smart_lists")
        .select("display_order")
        .eq("user_id", context.userId)
        .order("display_order", { ascending: false })
        .limit(1)
        .single();

      const newOrder = (maxOrder?.display_order || 0) + 1;

      // 创建智能列表
      const { data, error } = await supabase
        .from("smart_lists")
        .insert({
          user_id: context.userId,
          name: params.name,
          description: params.description,
          icon: params.icon || "📋",
          color: params.color,
          rule: params.rule,
          sort: params.sort || { field: "created_at", order: "desc" },
          is_preset: false,
          display_order: newOrder,
        })
        .select()
        .single();

      if (error) throw error;

      // 计算初始计数
      const count = await this.calculateCount(params.rule, context.userId);

      return {
        success: true,
        data: {
          id: data.id,
          name: data.name,
          icon: data.icon,
          count,
          message: `智能列表「${data.name}」创建成功，当前有 ${count} 条内容`,
        },
        metadata: {
          executionTimeMs: Math.round(performance.now() - startTime),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "创建失败",
        metadata: {
          executionTimeMs: Math.round(performance.now() - startTime),
        },
      };
    }
  },

  async calculateCount(rule: SmartListRule, userId: string): Promise<number> {
    const supabase = await createClient();
    let query = supabase
      .from("bookmarks")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);

    // 应用规则... (同 get_smart_list_items)
    query = applyRuleToQuery(query, rule);

    const { count } = await query;
    return count || 0;
  },
};
```

```typescript
// src/lib/ai-agent/tools/smart-list/get-smart-list-items.tool.ts

import { z } from "zod";
import type { Tool, ToolContext, ToolResult } from "../types";
import { smartListRuleSchema } from "./types";
import { createClient } from "@/lib/supabase/server";
import { PRESET_SMART_LISTS } from "./preset-rules";

const paramsSchema = z.object({
  // 三选一：预设 ID、列表 ID、直接规则
  preset_id: z.string().optional().describe("预设列表 ID"),
  list_id: z.number().optional().describe("用户创建的列表 ID"),
  rule: smartListRuleSchema.optional().describe("直接传入规则"),

  // 分页
  limit: z.number().min(1).max(100).default(20).describe("返回数量"),
  offset: z.number().default(0).describe("偏移量"),

  // 是否只返回计数
  count_only: z.boolean().default(false).describe("仅返回计数"),
});

export const getSmartListItemsTool: Tool<z.infer<typeof paramsSchema>> = {
  definition: {
    name: "get_smart_list_items",
    description:
      "获取智能列表中的书签。可以通过预设 ID、用户列表 ID 或直接传入规则来查询。",
    parameters: paramsSchema,
    category: "query",
  },

  async execute(params, context): Promise<ToolResult> {
    const startTime = performance.now();

    try {
      const supabase = await createClient();

      // 解析规则来源
      let rule: SmartListRule;
      let sort: SmartListSort = { field: "created_at", order: "desc" };
      let listName = "临时查询";

      if (params.preset_id) {
        // 预设列表
        const preset = PRESET_SMART_LISTS.find(
          (p) => p.id === params.preset_id,
        );
        if (!preset) {
          return {
            success: false,
            error: `预设列表 "${params.preset_id}" 不存在`,
          };
        }
        rule = preset.rule;
        sort = preset.sort;
        listName = preset.name;
      } else if (params.list_id) {
        // 用户创建的列表
        const { data: list, error } = await supabase
          .from("smart_lists")
          .select("*")
          .eq("id", params.list_id)
          .eq("user_id", context.userId)
          .single();

        if (error || !list) {
          return { success: false, error: "列表不存在或无权限" };
        }
        rule = list.rule;
        sort = list.sort;
        listName = list.name;
      } else if (params.rule) {
        // 直接传入规则
        rule = params.rule;
      } else {
        return { success: false, error: "必须提供 preset_id、list_id 或 rule" };
      }

      // 构建查询
      let query = supabase
        .from("bookmarks")
        .select("*", { count: "exact" })
        .eq("user_id", context.userId);

      // 应用筛选规则
      query = applyRuleToQuery(query, rule);

      // 应用排序
      query = query.order(sort.field, { ascending: sort.order === "asc" });

      if (params.count_only) {
        const { count } = await query;
        return {
          success: true,
          data: {
            listName,
            count: count || 0,
          },
          metadata: {
            executionTimeMs: Math.round(performance.now() - startTime),
          },
        };
      }

      // 应用分页
      const { data, count, error } = await query.range(
        params.offset,
        params.offset + params.limit - 1,
      );

      if (error) throw error;

      return {
        success: true,
        data: {
          listName,
          items: data?.map((item) => ({
            id: item.id,
            title: item.title,
            url: item.url,
            platform: item.platform,
            ai_summary: item.ai_summary,
            ai_tags: item.ai_tags,
            quality_score: item.quality_score,
            is_read: item.is_read,
            is_starred: item.is_starred,
            created_at: item.created_at,
          })),
          total: count || 0,
          hasMore: (count || 0) > params.offset + params.limit,
          pagination: {
            limit: params.limit,
            offset: params.offset,
          },
        },
        metadata: {
          executionTimeMs: Math.round(performance.now() - startTime),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "查询失败",
        metadata: {
          executionTimeMs: Math.round(performance.now() - startTime),
        },
      };
    }
  },
};

/**
 * 将规则应用到 Supabase 查询
 */
function applyRuleToQuery(query: any, rule: SmartListRule): any {
  // 时间范围
  if (rule.date_range && rule.date_range !== "all") {
    const daysMap: Record<string, number> = {
      "1d": 1,
      "7d": 7,
      "30d": 30,
      "90d": 90,
      "1y": 365,
    };
    const days = daysMap[rule.date_range];
    const since = new Date(
      Date.now() - days * 24 * 60 * 60 * 1000,
    ).toISOString();
    query = query.gte("created_at", since);
  }

  if (rule.date_from) {
    query = query.gte("created_at", rule.date_from);
  }
  if (rule.date_to) {
    query = query.lte("created_at", rule.date_to);
  }

  // 平台筛选
  if (rule.platforms?.length) {
    query = query.in("platform", rule.platforms);
  }

  // 质量评分
  if (rule.quality_score?.min !== undefined) {
    query = query.gte("quality_score", rule.quality_score.min);
  }
  if (rule.quality_score?.max !== undefined) {
    query = query.lte("quality_score", rule.quality_score.max);
  }

  // 标签筛选
  if (rule.has_tags === true) {
    query = query.not("ai_tags", "is", null);
  } else if (rule.has_tags === false) {
    query = query.is("ai_tags", null);
  }

  if (rule.tag_contains?.length) {
    // OR 关系：包含任意一个标签
    query = query.overlaps("ai_tags", rule.tag_contains);
  }

  if (rule.tag_match_all?.length) {
    // AND 关系：必须包含所有标签
    query = query.contains("ai_tags", rule.tag_match_all);
  }

  // 关键词搜索
  if (rule.keyword) {
    const field = rule.keyword_in || "all";
    if (field === "title") {
      query = query.ilike("title", `%${rule.keyword}%`);
    } else if (field === "content") {
      query = query.ilike("content", `%${rule.keyword}%`);
    } else {
      query = query.or(
        `title.ilike.%${rule.keyword}%,content.ilike.%${rule.keyword}%`,
      );
    }
  }

  // 阅读状态
  if (rule.read_status === "read") {
    query = query.eq("is_read", true);
  } else if (rule.read_status === "unread") {
    query = query.eq("is_read", false);
  }

  // 收藏标记
  if (rule.is_starred !== undefined) {
    query = query.eq("is_starred", rule.is_starred);
  }

  // AI 推荐
  if (rule.is_ai_recommended !== undefined) {
    query = query.eq("is_ai_recommended", rule.is_ai_recommended);
  }

  // 文件夹筛选
  if (rule.folder_ids?.length) {
    query = query.in("folder_id", rule.folder_ids);
  }

  return query;
}
```

```typescript
// src/lib/ai-agent/tools/smart-list/list-smart-lists.tool.ts

import { z } from "zod";
import type { Tool, ToolContext, ToolResult } from "../types";
import { createClient } from "@/lib/supabase/server";
import { PRESET_SMART_LISTS } from "./preset-rules";

const paramsSchema = z.object({
  include_presets: z.boolean().default(true).describe("是否包含预设列表"),
  include_counts: z.boolean().default(true).describe("是否包含计数"),
});

export const listSmartListsTool: Tool<z.infer<typeof paramsSchema>> = {
  definition: {
    name: "list_smart_lists",
    description: "获取用户的所有智能列表，包括预设列表和自定义列表",
    parameters: paramsSchema,
    category: "query",
  },

  async execute(params, context): Promise<ToolResult> {
    const startTime = performance.now();

    try {
      const supabase = await createClient();
      const lists: SmartListWithCount[] = [];

      // 1. 添加预设列表
      if (params.include_presets) {
        for (const preset of PRESET_SMART_LISTS) {
          const count = params.include_counts
            ? await getCountForRule(preset.rule, context.userId)
            : undefined;

          lists.push({
            id: preset.id,
            name: preset.name,
            icon: preset.icon,
            color: preset.color,
            description: preset.description,
            is_preset: true,
            display_order: preset.display_order,
            count,
          });
        }
      }

      // 2. 获取用户自定义列表
      const { data: userLists, error } = await supabase
        .from("smart_lists")
        .select("*")
        .eq("user_id", context.userId)
        .order("display_order");

      if (error) throw error;

      // 3. 添加用户列表（带计数）
      for (const list of userLists || []) {
        const count = params.include_counts
          ? await getCountForRule(list.rule, context.userId)
          : list.cached_count;

        lists.push({
          id: list.id,
          name: list.name,
          icon: list.icon,
          color: list.color,
          description: list.description,
          is_preset: false,
          display_order: list.display_order + 100, // 用户列表排在预设后面
          count,
        });
      }

      // 按 display_order 排序
      lists.sort((a, b) => a.display_order - b.display_order);

      return {
        success: true,
        data: {
          lists,
          presetCount: PRESET_SMART_LISTS.length,
          customCount: userLists?.length || 0,
        },
        metadata: {
          executionTimeMs: Math.round(performance.now() - startTime),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "获取列表失败",
        metadata: {
          executionTimeMs: Math.round(performance.now() - startTime),
        },
      };
    }
  },
};
```

---

## 六、数据库设计

### 6.1 表结构

```sql
-- supabase/migrations/20251224000001_add_smart_lists.sql

-- 智能列表表
CREATE TABLE smart_lists (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 基本信息
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT '📋',
  color TEXT,  -- 主题色，如 '#3B82F6'

  -- 筛选规则 (JSONB)
  rule JSONB NOT NULL DEFAULT '{}',

  -- 排序配置
  sort JSONB DEFAULT '{"field": "created_at", "order": "desc"}',

  -- 元信息
  is_preset BOOLEAN DEFAULT FALSE,  -- 是否为系统预设
  display_order INT DEFAULT 0,      -- 显示顺序

  -- 计数缓存（减少实时查询）
  cached_count INT DEFAULT 0,
  cached_at TIMESTAMPTZ,

  -- 时间戳
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- 约束
  CONSTRAINT smart_lists_name_unique UNIQUE (user_id, name)
);

-- 索引
CREATE INDEX idx_smart_lists_user ON smart_lists(user_id);
CREATE INDEX idx_smart_lists_user_order ON smart_lists(user_id, display_order);

-- RLS 策略
ALTER TABLE smart_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "smart_lists_select_own"
  ON smart_lists FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "smart_lists_insert_own"
  ON smart_lists FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "smart_lists_update_own"
  ON smart_lists FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "smart_lists_delete_own"
  ON smart_lists FOR DELETE
  USING (auth.uid() = user_id AND is_preset = FALSE);  -- 不能删除预设

-- 更新时间触发器
CREATE TRIGGER smart_lists_updated_at
  BEFORE UPDATE ON smart_lists
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

### 6.2 bookmarks 表扩展

```sql
-- supabase/migrations/20251224000002_extend_bookmarks_for_smart_lists.sql

-- 添加智能列表所需字段
ALTER TABLE bookmarks
  ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_starred BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS starred_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_ai_recommended BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS ai_recommended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS quality_score INT CHECK (quality_score >= 0 AND quality_score <= 100);

-- 索引优化
CREATE INDEX IF NOT EXISTS idx_bookmarks_is_read ON bookmarks(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_bookmarks_is_starred ON bookmarks(user_id, is_starred);
CREATE INDEX IF NOT EXISTS idx_bookmarks_quality_score ON bookmarks(user_id, quality_score);
CREATE INDEX IF NOT EXISTS idx_bookmarks_ai_recommended ON bookmarks(user_id, is_ai_recommended);
CREATE INDEX IF NOT EXISTS idx_bookmarks_created_at ON bookmarks(user_id, created_at DESC);

-- 复合索引（常用查询组合）
CREATE INDEX IF NOT EXISTS idx_bookmarks_unread_recent
  ON bookmarks(user_id, is_read, created_at DESC)
  WHERE is_read = FALSE;

CREATE INDEX IF NOT EXISTS idx_bookmarks_high_quality
  ON bookmarks(user_id, quality_score DESC)
  WHERE quality_score >= 70;
```

---

## 七、Agent 集成

### 7.1 注册到 KnowledgeAgent

```typescript
// src/lib/ai-agent/core/knowledge-agent.ts

import { SmartListSkill } from "../skills/smart-list.skill";
import {
  createSmartListTool,
  listSmartListsTool,
  getSmartListItemsTool,
  getSmartListCountTool,
  updateSmartListTool,
  deleteSmartListTool,
} from "../tools/smart-list";

export class KnowledgeAgent {
  private skillRegistry: SkillRegistry;
  private toolRegistry: ToolRegistry;

  constructor() {
    this.skillRegistry = new SkillRegistry();
    this.toolRegistry = new ToolRegistry();

    this.registerDefaults();
  }

  private registerDefaults() {
    // 已有的 Skills
    this.skillRegistry.register(new ClassifySkill());
    this.skillRegistry.register(new SearchSkill());
    this.skillRegistry.register(new SummarySkill());

    // 新增：智能列表 Skill
    this.skillRegistry.register(new SmartListSkill());

    // 已有的 Tools
    this.toolRegistry.register(countBookmarksTool);
    this.toolRegistry.register(listBookmarksTool);
    this.toolRegistry.register(getStatsTool);

    // 新增：智能列表 Tools
    this.toolRegistry.register(createSmartListTool);
    this.toolRegistry.register(listSmartListsTool);
    this.toolRegistry.register(getSmartListItemsTool);
    this.toolRegistry.register(getSmartListCountTool);
    this.toolRegistry.register(updateSmartListTool);
    this.toolRegistry.register(deleteSmartListTool);
  }
}
```

### 7.2 系统提示词更新

```typescript
// src/lib/ai-agent/prompts/system.ts

export const SYSTEM_PROMPT = `你是 AnyKeep 的智能助手，帮助用户管理和探索他们的收藏内容。

## 智能列表能力

你可以帮助用户：
1. **查看预设列表**：最近一周、高价值收藏、待阅读、优质经验、推荐关注、值得复读、我的优质内容
2. **创建自定义列表**：用户说"帮我建一个关于 XX 的列表"，你转换为筛选规则
3. **查询列表内容**：用户说"看看我的待阅读"，你调用对应工具
4. **智能推荐列表**：基于用户数据，推荐个性化的智能列表

## 预设列表快捷指令

| 用户可能说的话 | 对应预设 ID |
|--------------|------------|
| 最近收藏、这周收藏 | recent-week |
| 高质量内容、精品 | high-value |
| 没读的、待读 | unread |
| 经验分享、干货 | quality-experience |
| 重要的、该看的 | ai-recommended |
| 收藏的、标星的 | worth-revisit |
| 我的精华、知识库 | my-quality-content |

当用户的意图匹配预设列表时，直接使用 preset_id 查询，无需创建新列表。
`;
```

---

## 八、使用场景

### 8.1 对话示例

```
用户: 看看我最近一周收藏了什么
AI: [调用 get_smart_list_items(preset_id: "recent-week")]
    您最近一周收藏了 44 条内容，以下是最新的几条：
    1. 《深入理解 React Hooks》- 微信公众号
    2. 《2024年 AI 发展趋势》- B站
    ...

用户: 帮我建一个 React 学习资料的列表
AI: [调用 SmartListSkill.parse_intent]
    [调用 create_smart_list]
    已创建智能列表「React 学习」，筛选规则：
    - 标签包含：React、前端、JavaScript
    当前有 18 条内容符合条件。

用户: 有什么推荐的智能列表吗？
AI: [调用 SmartListSkill.suggest_lists]
    基于您的收藏数据，推荐以下智能列表：
    1. 💚 微信精选 - 您有 156 条微信内容，这个列表帮您筛选高质量的
    2. 🏷️ AI专题 - "AI"是您最常用的标签（42次）
    3. 🎯 本周必读 - 您有 89 条未读，这个列表帮您筛选最值得读的

用户: 我的待阅读有多少？
AI: [调用 get_smart_list_items(preset_id: "unread", count_only: true)]
    您的待阅读列表有 999+ 条内容。建议使用「本周必读」列表，筛选出最值得优先阅读的内容。
```

---

## 九、实施计划

### 9.1 阶段划分

| 阶段        | 内容                     | 预估工时 | 状态        |
| ----------- | ------------------------ | -------- | ----------- |
| **Phase 1** | 数据库 Schema + 预设规则 | 2h       | Not Started |
| **Phase 2** | 基础 Tools (CRUD)        | 4h       | Not Started |
| **Phase 3** | SmartListSkill (AI 解析) | 4h       | Not Started |
| **Phase 4** | 前端 UI (列表侧边栏)     | 6h       | Not Started |
| **Phase 5** | 计数缓存优化             | 2h       | Not Started |
| **Phase 6** | 智能推荐功能             | 3h       | Not Started |

**总计**: ~21 小时

### 9.2 文件清单

```
src/lib/ai-agent/
├── skills/
│   └── smart-list.skill.ts          # SmartListSkill
├── tools/
│   └── smart-list/
│       ├── index.ts                  # 导出
│       ├── types.ts                  # 类型定义
│       ├── preset-rules.ts           # 预设规则
│       ├── create-smart-list.tool.ts
│       ├── list-smart-lists.tool.ts
│       ├── get-smart-list-items.tool.ts
│       ├── get-smart-list-count.tool.ts
│       ├── update-smart-list.tool.ts
│       └── delete-smart-list.tool.ts
└── prompts/
    └── system.ts                     # 更新系统提示词

supabase/migrations/
├── 20251224000001_add_smart_lists.sql
└── 20251224000002_extend_bookmarks_for_smart_lists.sql

src/components/smart-list/
├── smart-list-sidebar.tsx            # 侧边栏组件
├── smart-list-create-dialog.tsx      # 创建对话框
├── smart-list-item.tsx               # 列表项组件
└── smart-list-count-badge.tsx        # 计数徽章
```

---

## 十、成功标准

### 10.1 功能验收

- [ ] 7 个预设列表正常显示和查询
- [ ] 用户可以通过自然语言创建智能列表
- [ ] 列表计数实时准确
- [ ] AI 能正确识别用户意图并调用对应工具
- [ ] 删除保护：预设列表不可删除

### 10.2 性能指标

| 指标             | 目标    |
| ---------------- | ------- |
| 列表查询响应时间 | < 500ms |
| 计数查询响应时间 | < 200ms |
| 自然语言解析时间 | < 2s    |
| 支持书签数量     | 10,000+ |

---

## 十一、集成到现有 AI Skills 系统

### 11.1 现有系统架构分析

AnyKeep 已有完整的 AI Agent 架构：

```
src/lib/ai-agent/
├── core/
│   ├── knowledge-agent.ts    # KnowledgeAgent 主类
│   ├── agent-memory.ts       # 会话记忆管理
│   └── types.ts              # Agent 类型定义
├── tools/
│   ├── index.ts              # 工具注册入口 ⭐
│   ├── tool-registry.ts      # ToolRegistry 类
│   ├── types.ts              # Tool 类型定义
│   ├── query/                # 查询工具
│   ├── read/                 # 阅读工具
│   ├── search/               # 搜索工具
│   └── action/               # 操作工具（需确认）
└── __tests__/
```

**关键集成点**：

| 文件                      | 职责           | 集成方式                         |
| ------------------------- | -------------- | -------------------------------- |
| `tools/index.ts`          | 注册默认 Tools | 添加 `smartListTools` 导入和注册 |
| `tools/types.ts`          | Tool 类型定义  | 复用现有类型，无需修改           |
| `core/knowledge-agent.ts` | Agent 主类     | 自动获取已注册 Tools，无需修改   |

### 11.2 Tools 集成步骤

#### Step 1: 创建智能列表 Tools 目录

```
src/lib/ai-agent/tools/smart-list/
├── index.ts                      # 导出所有 Tools
├── list-smart-lists.tool.ts      # 列出智能列表
├── get-smart-list-items.tool.ts  # 获取列表内容
├── get-smart-list-count.tool.ts  # 获取列表计数
├── create-smart-list.tool.ts     # 创建智能列表（通过 AI 解析）
└── utils.ts                      # 共享工具函数（复用现有 API 逻辑）
```

#### Step 2: 实现 Tools（复用现有 API 逻辑）

```typescript
// src/lib/ai-agent/tools/smart-list/index.ts

import { listSmartListsTool } from "./list-smart-lists.tool";
import { getSmartListItemsTool } from "./get-smart-list-items.tool";
import { getSmartListCountTool } from "./get-smart-list-count.tool";
import { createSmartListTool } from "./create-smart-list.tool";
import type { Tool } from "../types";

/**
 * 智能列表相关 Tools
 */
export const smartListTools: Tool[] = [
  listSmartListsTool,
  getSmartListItemsTool,
  getSmartListCountTool,
  createSmartListTool,
];

export {
  listSmartListsTool,
  getSmartListItemsTool,
  getSmartListCountTool,
  createSmartListTool,
};
```

```typescript
// src/lib/ai-agent/tools/smart-list/list-smart-lists.tool.ts

import { z } from "zod";
import type { Tool, ToolContext, ToolResult } from "../types";
import { createClient } from "@/lib/supabase/server";
import { toSmartListClient } from "@/types/smart-list"; // 复用现有类型转换

const paramsSchema = z.object({
  includePresets: z.boolean().default(true).describe("是否包含预设列表"),
  includeCounts: z.boolean().default(true).describe("是否包含书签计数"),
});

export const listSmartListsTool: Tool<z.infer<typeof paramsSchema>> = {
  definition: {
    name: "list_smart_lists",
    description:
      '获取用户的所有智能列表，包括预设列表和自定义列表。用于回答"我有哪些智能列表"、"查看我的列表"等问题。',
    parameters: paramsSchema,
    category: "query",
  },

  async execute(params, context): Promise<ToolResult> {
    const startTime = performance.now();

    try {
      const supabase = await createClient();

      // 复用现有 API 的查询逻辑
      let query = supabase
        .from("smart_lists")
        .select("*")
        .eq("user_id", context.userId)
        .is("deleted_at", null);

      if (!params.includePresets) {
        query = query.eq("is_preset", false);
      }

      query = query
        .order("is_pinned", { ascending: false })
        .order("sort_order", { ascending: true });

      const { data: smartLists, error } = await query;

      if (error) throw error;

      // 转换为前端格式
      const lists = smartLists?.map(toSmartListClient) || [];

      return {
        success: true,
        data: {
          lists,
          total: lists.length,
          presetCount: lists.filter((l) => l.isPreset).length,
          customCount: lists.filter((l) => !l.isPreset).length,
        },
        metadata: {
          executionTimeMs: Math.round(performance.now() - startTime),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "获取智能列表失败",
        metadata: {
          executionTimeMs: Math.round(performance.now() - startTime),
        },
      };
    }
  },
};
```

```typescript
// src/lib/ai-agent/tools/smart-list/get-smart-list-items.tool.ts

import { z } from "zod";
import type { Tool, ToolContext, ToolResult } from "../types";
import { createClient } from "@/lib/supabase/server";
import type { SmartListFilters } from "@/types/smart-list"; // 复用现有类型

const paramsSchema = z.object({
  smartListId: z.number().describe("智能列表 ID"),
  limit: z.number().min(1).max(50).default(10).describe("返回数量"),
  offset: z.number().default(0).describe("偏移量"),
});

export const getSmartListItemsTool: Tool<z.infer<typeof paramsSchema>> = {
  definition: {
    name: "get_smart_list_items",
    description:
      '获取智能列表中的书签内容。用于回答"看看我的待阅读"、"最近一周收藏了什么"等问题。',
    parameters: paramsSchema,
    category: "query",
  },

  async execute(params, context): Promise<ToolResult> {
    const startTime = performance.now();

    try {
      const supabase = await createClient();

      // 1. 获取智能列表配置
      const { data: smartList, error: listError } = await supabase
        .from("smart_lists")
        .select("*")
        .eq("id", params.smartListId)
        .eq("user_id", context.userId)
        .is("deleted_at", null)
        .single();

      if (listError || !smartList) {
        return { success: false, error: "智能列表不存在或无权限" };
      }

      // 2. 复用现有的筛选逻辑（从 API route 提取）
      const filters = smartList.filters as SmartListFilters;
      const bookmarks = await queryBookmarksByFilters(
        supabase,
        filters,
        context.userId,
        params.limit,
        params.offset,
        smartList.sort_by,
      );

      return {
        success: true,
        data: {
          listName: smartList.name,
          listIcon: smartList.icon,
          items: bookmarks.data,
          total: bookmarks.count,
          hasMore: bookmarks.count > params.offset + params.limit,
        },
        metadata: {
          executionTimeMs: Math.round(performance.now() - startTime),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "查询失败",
        metadata: {
          executionTimeMs: Math.round(performance.now() - startTime),
        },
      };
    }
  },
};

/**
 * 根据筛选条件查询书签（复用自 /api/smart-lists/route.ts）
 */
async function queryBookmarksByFilters(
  supabase: SupabaseClient,
  filters: SmartListFilters,
  userId: string,
  limit: number,
  offset: number,
  sortBy: string,
) {
  // ... 复用现有的 buildFilterQuery 逻辑
}
```

#### Step 3: 注册到全局 Tools

```typescript
// src/lib/ai-agent/tools/index.ts (修改)

// 已有导出
export * from "./types";
export * from "./utils";
export { ToolRegistry, toolRegistry } from "./tool-registry";
export * from "./query";
export * from "./read";
export * from "./search";
export * from "./action";

// ✅ 新增：智能列表 Tools
export * from "./smart-list";

import { toolRegistry } from "./tool-registry";
import { queryTools } from "./query";
import { readTools } from "./read";
import { searchTools } from "./search";
import { actionTools } from "./action";
import { smartListTools } from "./smart-list"; // ✅ 新增

/**
 * 注册所有默认 Tools
 */
export function registerDefaultTools(): void {
  toolRegistry.registerAll(queryTools);
  toolRegistry.registerAll(readTools);
  toolRegistry.registerAll(searchTools);
  toolRegistry.registerAll(actionTools);
  toolRegistry.registerAll(smartListTools); // ✅ 新增
}
```

#### Step 4: 更新系统提示词

```typescript
// src/lib/ai-agent/core/knowledge-agent.ts (修改 DEFAULT_SYSTEM_PROMPT)

const DEFAULT_SYSTEM_PROMPT = `你是 AnyKeep 的 AI 知识助手，帮助用户管理收藏的内容。

## 工作方式

用户说什么，你就做什么。直接行动，少说废话。

## 可用工具

### 列表类
- list_recent(limit?) → 获取最近收藏，默认 10 条
- list_by_folder(folder_id, limit?) → 获取某文件夹的收藏
- list_by_platform(platform, limit?) → 获取某平台的收藏

### 统计类
- count_total() → 统计收藏总数
- count_by_folder(folder_id) → 统计某文件夹数量
- count_by_platform(platform) → 统计某平台数量
- get_stats() → 详细统计

### 搜索类
- search_bookmarks(query, limit?) → 搜索收藏内容

### 阅读类
- read_bookmark(bookmark_id) → 读取单个书签详情

### ⭐ 智能列表类（新增）
- list_smart_lists(includePresets?, includeCounts?) → 获取智能列表
- get_smart_list_items(smartListId, limit?, offset?) → 获取列表内容
- get_smart_list_count(smartListId) → 获取列表计数
- create_smart_list(name, description?, filters) → 创建智能列表

### 智能处理类
- classify(title, summary?, tags?) → 智能推荐分类
- summary(title, url, content?, mode?) → 生成摘要和标签

### 批量操作类
- batch_tags(bookmark_ids, tags, action) → 批量添加/移除标签
- move_bookmarks(bookmark_ids, folder_id) → 批量移动

## 智能列表快捷指令

| 用户说的话 | 对应操作 |
|----------|---------|
| 看看我的待阅读 | get_smart_list_items(待阅读列表ID) |
| 最近一周收藏了什么 | get_smart_list_items(最近一周列表ID) |
| 我有哪些智能列表 | list_smart_lists() |
| 高质量内容有多少 | get_smart_list_count(高价值列表ID) |

## 使用示例

用户: "看看我的待阅读"
→ 调用 list_smart_lists() 找到待阅读列表 ID
→ 调用 get_smart_list_items(smartListId=xxx)
→ 回复: "您的待阅读列表有 89 条，最近的几条是..."

用户: "帮我建一个 React 学习列表"
→ 调用 create_smart_list(name="React学习", filters={aiTags: ["React"]})
→ 回复: "已创建「React学习」智能列表，当前有 12 条内容"
`;
```

### 11.3 集成验证清单

```
✅ 后端集成验证
├── [ ] smartListTools 在 registerDefaultTools() 中注册
├── [ ] KnowledgeAgent 能获取智能列表 Tools
├── [ ] Tools 执行时正确获取 userId
├── [ ] 复用现有 SmartListFilters 类型
└── [ ] 错误处理和日志记录正常

✅ AI 调用验证
├── [ ] "我有哪些智能列表" → list_smart_lists
├── [ ] "看看我的待阅读" → get_smart_list_items
├── [ ] "高质量内容有多少" → get_smart_list_count
└── [ ] "帮我建一个XX列表" → create_smart_list
```

---

## 十二、前端页面集成方案

### 12.1 现有前端架构分析

AnyKeep 已有完整的智能列表前端实现：

```
src/components/smart-list/
├── smart-list-dropdown.tsx       # ✅ 侧边栏下拉组件
├── smart-list-editor-dialog.tsx  # ✅ 编辑对话框
├── smart-list-item.tsx           # ✅ 列表项组件
├── smart-list-view.tsx           # ✅ 列表视图
├── smart-list-section.tsx        # ✅ 分区组件
└── smart-list-quick-save.tsx     # ✅ 快速保存

src/hooks/
├── use-smart-lists.ts            # ✅ 智能列表数据 Hook
└── use-smart-list-bookmarks.ts   # ✅ 列表书签 Hook

src/types/
└── smart-list.ts                 # ✅ 完整类型定义

src/app/api/smart-lists/
├── route.ts                      # ✅ GET/POST API
├── [id]/route.ts                 # ✅ 单个列表 CRUD
├── preview/route.ts              # ✅ 预览计数
└── reorder/route.ts              # ✅ 重排序
```

### 12.2 AI 助手与智能列表集成

#### 集成点 1: AI 助手面板中显示智能列表

```typescript
// src/components/ai/ai-assistant-panel.tsx (增强)

import { useSmartLists } from '@/hooks/use-smart-lists';

export function AIAssistantPanel({ ... }) {
  // 获取智能列表数据，供 AI 引用
  const { smartLists } = useSmartLists({ includePresets: true });

  // 在发送消息时附带智能列表上下文
  const handleSubmit = useCallback(async () => {
    // ...
    const response = await fetch("/api/agent/chat", {
      method: "POST",
      body: JSON.stringify({
        message: userMessage.content,
        conversationId,
        bookmarkIds,
        // ✅ 新增：传递智能列表上下文
        context: {
          smartLists: smartLists.map(l => ({
            id: l.id,
            name: l.name,
            isPreset: l.isPreset,
          })),
        },
      }),
    });
    // ...
  }, [smartLists, ...]);
}
```

#### 集成点 2: AI 创建智能列表后跳转

```typescript
// src/components/ai/ai-message.tsx (增强)

import { useRouter } from "next/navigation";

export function AIMessage({ message }: AIMessageProps) {
  const router = useRouter();

  // 检测工具调用结果中的智能列表创建
  useEffect(() => {
    if (message.toolCalls) {
      const createListCall = message.toolCalls.find(
        (tc) => tc.toolName === "create_smart_list" && tc.result?.success,
      );

      if (createListCall) {
        const { id, name } = createListCall.result.data;
        // 显示创建成功提示，带跳转链接
        toast.success(`智能列表「${name}」创建成功`, {
          action: {
            label: "查看",
            onClick: () => router.push(`/home?smartList=${id}`),
          },
        });
      }
    }
  }, [message.toolCalls, router]);

  // ...
}
```

#### 集成点 3: 侧边栏智能列表与 AI 联动

```typescript
// src/components/smart-list/smart-list-dropdown.tsx (增强)

import { AIAssistantPanel } from '@/components/ai/ai-assistant-panel';

export function SmartListDropdown({ ... }) {
  const [showAIAssistant, setShowAIAssistant] = useState(false);

  // AI 创建智能列表
  const handleAICreate = useCallback(() => {
    setIsOpen(false);
    setShowAIAssistant(true);
  }, []);

  return (
    <>
      <Popover ...>
        {/* 现有内容 */}

        {/* 新增：AI 创建入口 */}
        <div className="space-y-0.5">
          <button onClick={handleCreate}>
            <Plus className="size-4" />
            <span>新建智能列表</span>
          </button>

          {/* ✅ 新增按钮 */}
          <button onClick={handleAICreate}>
            <Sparkles className="size-4" />
            <span>AI 帮我创建</span>
          </button>
        </div>
      </Popover>

      {/* AI 助手面板 */}
      <AIAssistantPanel
        open={showAIAssistant}
        onOpenChange={setShowAIAssistant}
        title="创建智能列表"
        description="告诉我你想要什么样的列表，我来帮你创建"
      />
    </>
  );
}
```

### 12.3 页面路由集成

```typescript
// src/app/(main)/home/page.tsx (确认现有集成)

// 现有逻辑已支持：/home?smartList=123
// 智能列表参数通过 searchParams 传递
// HomePageClient 组件已处理智能列表筛选
```

### 12.4 UI 增强建议

#### 建议 1: 智能列表详情页添加 AI 入口

```typescript
// src/components/smart-list/smart-list-view.tsx (增强)

export function SmartListView({ smartList }: Props) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <h2>{smartList.name}</h2>

        {/* ✅ 新增：AI 操作入口 */}
        <div className="flex gap-2">
          <Button variant="ghost" size="sm">
            <Sparkles className="size-4 mr-1" />
            AI 总结本列表
          </Button>
          <Button variant="ghost" size="sm">
            <MessageSquare className="size-4 mr-1" />
            问 AI 关于这些内容
          </Button>
        </div>
      </div>

      {/* 现有内容 */}
    </div>
  );
}
```

#### 建议 2: AI 快速操作按钮

```typescript
// src/components/ai/ai-quick-actions.tsx (增强)

// 新增智能列表相关快捷操作
const SMART_LIST_QUICK_ACTIONS = [
  {
    id: "suggest-lists",
    label: "推荐智能列表",
    icon: Lightbulb,
    prompt: "基于我的收藏数据，推荐几个适合我的智能列表",
  },
  {
    id: "explain-list",
    label: "解释筛选规则",
    icon: HelpCircle,
    prompt: "解释一下这个智能列表的筛选条件是什么意思",
  },
];
```

### 12.5 前端集成文件清单

```
需要修改的文件：
├── src/components/ai/ai-assistant-panel.tsx    # 添加智能列表上下文
├── src/components/ai/ai-message.tsx            # 处理创建结果
├── src/components/smart-list/smart-list-dropdown.tsx  # AI 创建入口
└── src/lib/ai-agent/core/knowledge-agent.ts    # 更新系统提示词

可选增强：
├── src/components/smart-list/smart-list-view.tsx      # AI 操作入口
├── src/components/ai/ai-quick-actions.tsx             # 快捷操作
└── src/app/api/agent/chat/route.ts                    # 处理上下文
```

---

## 十三、完整实施计划（更新版）

### 13.1 阶段划分

| 阶段        | 内容                           | 预估工时 | 依赖    |
| ----------- | ------------------------------ | -------- | ------- |
| **Phase 1** | 创建 Tools 目录结构 + 基础工具 | 3h       | 无      |
| **Phase 2** | 集成到 registerDefaultTools    | 1h       | Phase 1 |
| **Phase 3** | 更新系统提示词                 | 1h       | Phase 2 |
| **Phase 4** | 前端 AI 面板集成               | 2h       | Phase 3 |
| **Phase 5** | 侧边栏 AI 入口                 | 2h       | Phase 4 |
| **Phase 6** | 端到端测试验证                 | 2h       | Phase 5 |

**总计**: ~11 小时（基于现有基础设施）

### 13.2 新增文件清单（精简版）

```
新增文件：
src/lib/ai-agent/tools/smart-list/
├── index.ts                      # 导出
├── list-smart-lists.tool.ts      # 列表查询
├── get-smart-list-items.tool.ts  # 内容查询
├── get-smart-list-count.tool.ts  # 计数查询
└── create-smart-list.tool.ts     # 创建（AI 辅助）

修改文件：
├── src/lib/ai-agent/tools/index.ts            # 注册 Tools
├── src/lib/ai-agent/core/knowledge-agent.ts   # 更新提示词
├── src/components/ai/ai-assistant-panel.tsx   # 上下文传递
└── src/components/smart-list/smart-list-dropdown.tsx  # AI 入口
```

---

**文档版本**: 1.1.0
**更新日期**: 2025-12-23
**状态**: 设计中
**变更说明**: 补充集成到现有 AI 系统和前端页面集成方案
