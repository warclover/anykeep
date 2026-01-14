# 时间槽位全面修复方案

> **举一反三**：不仅修复 count，还修复所有缺失 timeRange 槽位的意图和工具

## 问题概述

用户问「我今天有多少收藏？」时，AI 返回总数而非当天数据。根因分析发现这是系统性问题：

1. **槽位定义层**：多个意图缺少 `timeRange` 可选槽位
2. **工具实现层**：多个工具没有时间范围参数
3. **集成层**：时间槽位提取框架（`slot-extractor.ts`）与工具参数断层

## 影响范围分析

### 需要添加 timeRange 的槽位定义

| 意图类型 | 当前槽位 | 缺失 | 典型用户表达 |
|---------|---------|------|-------------|
| `query:count` | folder, tags, platform | ❌ timeRange | "今天有多少收藏" |
| `query:list` | folder, tags, platform, limit | ❌ timeRange | "列出本周的收藏" |
| `query:search` | query, filters, limit, sortBy | ❌ timeRange | "搜索最近的文章" |
| `create:export` | format, bookmarkIds, fields | ❌ timeRange | "导出本月收藏" |
| `create:digest` | bookmarkIds, scope, format | ❌ timeRange | "今天收藏的摘要" |
| `create:synthesis` | bookmarkIds, topic, format | ❌ timeRange | "合成最近的内容" |
| `analyze:insight` | scope, dimension | ❌ timeRange | "最近的收藏趋势" |
| `learn:review` | scope, mode | ❌ timeRange | "复习今天学的" |
| `organize:cleanup` | scope, strategy, dryRun | ❌ timeRange | "清理最近的重复" |
| `organize:classify` | scope, autoTag | ❌ timeRange | "整理本月收藏" |

### 需要添加 timeRange 参数的工具

| 工具 | 当前参数 | 问题 |
|------|---------|------|
| `count_total` | 无 | 只能查总数 |
| `count_by_folder` | folder_id | 无法按时间过滤 |
| `count_by_platform` | platform | 无法按时间过滤 |
| `list_recent` | limit | 只能按时间排序，不能指定范围 |
| `list_by_folder` | folder_id | 无法按时间过滤 |
| `list_by_platform` | platform, limit | 无法按时间过滤 |
| `get_stats` | include_* | 硬编码7天/30天 |

---

## 修复方案

### Phase 1: 共享时间范围工具模块（P0）

**文件**：`src/lib/ai-agent/tools/shared/time-range.utils.ts`（新建）

```typescript
/**
 * 共享时间范围工具
 *
 * 统一所有工具的时间范围处理逻辑
 */

import { z } from "zod";

// ============================================
// 时间范围枚举
// ============================================

export const TIME_RANGE_VALUES = [
  "today",      // 今天
  "yesterday",  // 昨天
  "week",       // 本周
  "last_week",  // 上周
  "month",      // 本月
  "last_month", // 上月
  "quarter",    // 本季度
  "year",       // 今年
  "all",        // 全部（默认）
] as const;

export type TimeRangeValue = (typeof TIME_RANGE_VALUES)[number];

// ============================================
// Zod Schema（可复用）
// ============================================

export const timeRangeSchema = z
  .enum(TIME_RANGE_VALUES)
  .optional()
  .default("all")
  .describe("统计/查询时间范围，默认为全部");

// ============================================
// 时间范围转换
// ============================================

export interface DateRange {
  start?: Date;
  end?: Date;
}

/**
 * 将时间范围枚举转换为具体日期
 */
export function getTimeRangeDates(timeRange: TimeRangeValue): DateRange {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  switch (timeRange) {
    case "today":
      return { start: today, end: tomorrow };

    case "yesterday": {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return { start: yesterday, end: today };
    }

    case "week": {
      // 本周一
      const weekStart = new Date(today);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
      if (weekStart > today) weekStart.setDate(weekStart.getDate() - 7);
      return { start: weekStart };
    }

    case "last_week": {
      const lastWeekEnd = new Date(today);
      lastWeekEnd.setDate(lastWeekEnd.getDate() - lastWeekEnd.getDay() + 1);
      if (lastWeekEnd > today) lastWeekEnd.setDate(lastWeekEnd.getDate() - 7);
      const lastWeekStart = new Date(lastWeekEnd);
      lastWeekStart.setDate(lastWeekStart.getDate() - 7);
      return { start: lastWeekStart, end: lastWeekEnd };
    }

    case "month": {
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      return { start: monthStart };
    }

    case "last_month": {
      const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      return { start: lastMonthStart, end: lastMonthEnd };
    }

    case "quarter": {
      const quarterMonth = Math.floor(today.getMonth() / 3) * 3;
      const quarterStart = new Date(today.getFullYear(), quarterMonth, 1);
      return { start: quarterStart };
    }

    case "year": {
      const yearStart = new Date(today.getFullYear(), 0, 1);
      return { start: yearStart };
    }

    case "all":
    default:
      return {};
  }
}

/**
 * 为 Supabase 查询添加时间范围过滤
 */
export function applyTimeRangeFilter<T>(
  query: T,
  timeRange: TimeRangeValue,
  column: string = "created_at"
): T {
  const { start, end } = getTimeRangeDates(timeRange);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let result = query as any;

  if (start) {
    result = result.gte(column, start.toISOString());
  }
  if (end) {
    result = result.lt(column, end.toISOString());
  }

  return result as T;
}

/**
 * 获取时间范围的人类可读描述
 */
export function getTimeRangeLabel(timeRange: TimeRangeValue): string {
  const labels: Record<TimeRangeValue, string> = {
    today: "今天",
    yesterday: "昨天",
    week: "本周",
    last_week: "上周",
    month: "本月",
    last_month: "上月",
    quarter: "本季度",
    year: "今年",
    all: "全部",
  };
  return labels[timeRange] || "全部";
}
```

**估时**：30min

---

### Phase 2: 更新槽位定义（P0）

**文件**：`src/lib/ai-skills/router/slot-schemas.ts`

**变更**：

```typescript
export const INTENT_SLOT_DEFINITIONS: Record<...> = {
  // ============================================
  // 查询类 - 添加 timeRange
  // ============================================
  "query:search": {
    required: ["query"],
    optional: ["filters", "limit", "sortBy", "timeRange"], // +timeRange
    description: "搜索书签（支持时间范围过滤）",
  },
  "query:list": {
    required: [],
    optional: ["folder", "tags", "platform", "limit", "timeRange"], // +timeRange
    description: "列出书签（支持时间范围过滤）",
  },
  "query:count": {
    required: [],
    optional: ["folder", "tags", "platform", "timeRange"], // +timeRange
    description: "统计书签数量（支持时间范围过滤）",
  },

  // ============================================
  // 创建类 - 添加 timeRange
  // ============================================
  "create:export": {
    required: ["format"],
    optional: ["bookmarkIds", "fields", "outputPath", "timeRange"], // +timeRange
    description: "导出书签（支持时间范围过滤）",
  },
  "create:digest": {
    required: [],
    optional: ["bookmarkIds", "scope", "format", "timeRange"], // +timeRange
    description: "生成摘要（支持时间范围过滤）",
  },
  "create:synthesis": {
    required: [],
    optional: ["bookmarkIds", "topic", "format", "timeRange"], // +timeRange
    description: "主题合成（支持时间范围过滤）",
  },

  // ============================================
  // 分析类 - 添加 timeRange
  // ============================================
  "analyze:report": {
    required: [],
    optional: ["scope", "period", "format", "timeRange"], // +timeRange
    description: "生成分析报告（支持时间范围过滤）",
  },
  "analyze:insight": {
    required: [],
    optional: ["scope", "dimension", "timeRange"], // +timeRange
    description: "生成洞察分析（支持时间范围过滤）",
  },

  // ============================================
  // 学习类 - 添加 timeRange
  // ============================================
  "learn:review": {
    required: [],
    optional: ["scope", "mode", "timeRange"], // +timeRange
    description: "知识回顾（支持时间范围过滤）",
  },

  // ============================================
  // 整理类 - 添加 timeRange
  // ============================================
  "organize:cleanup": {
    required: [],
    optional: ["scope", "strategy", "dryRun", "timeRange"], // +timeRange
    description: "清理书签（支持时间范围过滤）",
  },
  "organize:classify": {
    required: [],
    optional: ["scope", "autoTag", "timeRange"], // +timeRange
    description: "自动分类书签（支持时间范围过滤）",
  },
  "organize:dedupe": {
    required: [],
    optional: ["scope", "strategy", "timeRange"], // +timeRange
    description: "去除重复书签（支持时间范围过滤）",
  },
  "organize:tag": {
    required: ["tags"],
    optional: ["bookmarkIds", "scope", "timeRange"], // +timeRange
    description: "为书签添加标签（支持时间范围过滤）",
  },
  "organize:move": {
    required: ["targetFolder"],
    optional: ["sourceFolder", "bookmarkIds", "filter", "timeRange"], // +timeRange
    description: "批量移动书签（支持时间范围过滤）",
  },

  // refine:filter 已有 timeRange，保持不变
};
```

**估时**：15min

---

### Phase 3: 修复 Count 系列工具（P0）

**文件 1**：`src/lib/ai-agent/tools/query/count-total.tool.ts`

```typescript
import {
  timeRangeSchema,
  applyTimeRangeFilter,
  getTimeRangeLabel,
  type TimeRangeValue,
} from "../shared/time-range.utils";

const paramsSchema = z.object({
  timeRange: timeRangeSchema,
});

type CountTotalParams = z.infer<typeof paramsSchema>;

// execute 中：
async execute(params: CountTotalParams, context: ToolContext) {
  const { timeRange = "all" } = params;

  let query = supabase
    .from("bookmarks")
    .select("id", { count: "exact", head: true })
    .eq("user_id", context.userId)
    .is("deleted_at", null);

  // 应用时间过滤
  query = applyTimeRangeFilter(query, timeRange);

  const { count, error } = await query;

  // 返回结果时包含时间范围标签
  return {
    success: true,
    data: {
      total: count ?? 0,
      timeRange,
      timeRangeLabel: getTimeRangeLabel(timeRange),
    },
  };
}
```

**文件 2**：`src/lib/ai-agent/tools/query/count-by-folder.tool.ts`

```typescript
const paramsSchema = z.object({
  folder_id: z.number().int().positive(),
  timeRange: timeRangeSchema, // 新增
});

// execute 中同样应用 applyTimeRangeFilter
```

**文件 3**：`src/lib/ai-agent/tools/query/count-by-platform.tool.ts`

```typescript
const paramsSchema = z.object({
  platform: z.string(),
  timeRange: timeRangeSchema, // 新增
});

// execute 中同样应用 applyTimeRangeFilter
```

**估时**：45min（3 个文件）

---

### Phase 4: 修复 List 系列工具（P0）

**文件 1**：`src/lib/ai-agent/tools/query/list-recent.tool.ts`

重命名为 `list-bookmarks.tool.ts`（更通用），或添加 timeRange 参数：

```typescript
const paramsSchema = z.object({
  limit: z.number().int().min(1).max(50).optional().default(10),
  timeRange: timeRangeSchema, // 新增
});

// execute 中：
async execute(params: ListParams, context: ToolContext) {
  const { limit = 10, timeRange = "all" } = params;

  let query = supabase
    .from("bookmarks")
    .select("id, title, url, platform, user_tags, created_at", { count: "exact" })
    .eq("user_id", context.userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  // 应用时间过滤
  query = applyTimeRangeFilter(query, timeRange);

  const { data, count, error } = await query;
  // ...
}
```

**文件 2 & 3**：`list-by-folder.tool.ts`、`list-by-platform.tool.ts`

同样添加 `timeRange` 参数。

**估时**：45min（3 个文件）

---

### Phase 5: 修复 get_stats 工具（P1）

**文件**：`src/lib/ai-agent/tools/query/get-stats.tool.ts`

```typescript
const paramsSchema = z.object({
  timeRange: timeRangeSchema, // 新增：统计指定时间范围
  include_trends: z.boolean().optional().default(true),
  include_tags: z.boolean().optional().default(true),
  include_platforms: z.boolean().optional().default(true),
  tags_limit: z.number().int().min(5).max(50).optional().default(20),
});

// execute 中：
// 根据 timeRange 过滤 bookmarks 查询
let bookmarksQuery = supabase
  .from("bookmarks")
  .select("id, platform, user_tags, rating, created_at")
  .eq("user_id", context.userId)
  .is("deleted_at", null)
  .not("platform", "in", browserFilter);

if (timeRange !== "all") {
  bookmarksQuery = applyTimeRangeFilter(bookmarksQuery, timeRange);
}
```

**估时**：30min

---

### Phase 6: 意图分类规则增强（P0）

**文件**：`src/lib/ai-skills/router/intent-classifier.ts`

添加时间词 + 统计/列表组合规则：

```typescript
// 在 count 规则附近添加
{
  // 时间词 + 统计意图
  // 示例: "今天有多少收藏"、"本周新增几条"、"这个月收藏了多少"
  pattern: /(今天|昨天|本周|这周|本月|这个月|今年|最近).{0,5}(有多少|多少条|几条|几个|新增|收藏了|添加了)/,
  type: "query",
  subType: "count",
  complexity: "simple",
  weight: 75, // 高于普通 count 规则 (65)
},
{
  // 统计意图 + 后置时间
  // 示例: "多少条是今天的"、"收藏了多少今天的"
  pattern: /(有多少|多少条|几条).{0,5}(今天|昨天|本周|这周|本月|这个月)/,
  type: "query",
  subType: "count",
  complexity: "simple",
  weight: 75,
},
```

**估时**：20min

---

### Phase 7: 槽位提取与工具参数集成（P0）

**文件**：`src/lib/ai-skills/router/intent-analyzer.ts`

在意图分析完成后，自动提取时间槽位：

```typescript
import { extractSlot, TIME_RANGE_SLOT } from "../extraction/slot-extractor";
import type { TimeRangeValue } from "../../ai-agent/tools/shared/time-range.utils";

// 在 analyze 方法中，意图分类后：
private extractTimeRangeSlot(message: string, intentType: string, subType?: string): IntentSlots {
  const slots: IntentSlots = {};

  // 需要时间槽位的意图类型
  const timeRangeIntents = [
    "query:count", "query:list", "query:search",
    "create:export", "create:digest", "create:synthesis",
    "analyze:report", "analyze:insight",
    "learn:review",
    "organize:cleanup", "organize:classify", "organize:dedupe", "organize:tag", "organize:move",
  ];

  const intentKey = subType ? `${intentType}:${subType}` : intentType;

  if (timeRangeIntents.includes(intentKey)) {
    // 使用现有的 TIME_RANGE_SLOT 提取
    const timeRange = extractSlot<TimeRangeValue>(message, "timeRange");

    // 只有明确提取到的才添加（排除默认值 "week"）
    if (timeRange && this.isExplicitTimeRange(message, timeRange)) {
      slots.timeRange = {
        value: timeRange,
        type: "string",
        confidence: 0.9,
        source: "extracted",
      };
    }
  }

  return slots;
}

// 判断是否是明确的时间范围（而非默认值）
private isExplicitTimeRange(message: string, value: TimeRangeValue): boolean {
  const timePatterns: Record<TimeRangeValue, RegExp> = {
    today: /今天|今日/,
    yesterday: /昨天|昨日/,
    week: /本周|这周|一周/,
    last_week: /上周/,
    month: /本月|这个月|一个月/,
    last_month: /上月|上个月/,
    quarter: /本季度|这季度/,
    year: /今年|本年/,
    all: /全部|所有|全量/,
  };

  return timePatterns[value]?.test(message) ?? false;
}
```

**估时**：45min

---

### Phase 8: 更新工具描述模板（P1）

**文件**：`src/lib/ai-agent/tools/tool-description-templates.ts`

```typescript
export const QUERY_TOOL_DESCRIPTIONS = {
  count_total: `统计用户收藏总数。
支持参数：
- timeRange: 统计时间范围
  - "today" - 今天
  - "yesterday" - 昨天
  - "week" - 本周
  - "last_week" - 上周
  - "month" - 本月
  - "last_month" - 上月
  - "year" - 今年
  - "all" - 全部（默认）

示例：
- "我有多少收藏" → timeRange: "all"
- "今天收藏了多少" → timeRange: "today"
- "本周新增几条" → timeRange: "week"`,

  list_recent: `获取用户的书签列表。
支持参数：
- limit: 返回数量，默认 10，最大 50
- timeRange: 查询时间范围（同 count_total）

示例：
- "最近的收藏" → timeRange: "all", limit: 10
- "今天的收藏" → timeRange: "today"
- "列出本周添加的" → timeRange: "week"`,

  // ... 其他工具描述
};
```

**估时**：20min

---

### Phase 9: 测试用例（P0）

**文件 1**：`src/lib/ai-agent/tools/query/__tests__/count-total.tool.test.ts`

```typescript
describe("count_total with timeRange", () => {
  it.each([
    ["today", "今天"],
    ["yesterday", "昨天"],
    ["week", "本周"],
    ["month", "本月"],
    ["all", "全部"],
  ])("should count bookmarks for timeRange=%s", async (timeRange, label) => {
    const result = await countTotalTool.execute({ timeRange }, mockContext);
    expect(result.success).toBe(true);
    expect(result.data?.timeRangeLabel).toBe(label);
  });

  it("should default to 'all' when no timeRange specified", async () => {
    const result = await countTotalTool.execute({}, mockContext);
    expect(result.success).toBe(true);
    expect(result.data?.timeRange).toBe("all");
  });
});
```

**文件 2**：`src/lib/ai-skills/router/__tests__/intent-classifier-time-range.test.ts`

```typescript
describe("Intent classification with time range", () => {
  // Count 意图
  it.each([
    ["我今天有多少收藏", "query", "count"],
    ["今天收藏了几条", "query", "count"],
    ["本周新增多少", "query", "count"],
    ["这个月有多少条", "query", "count"],
    ["有多少是今天的", "query", "count"],
  ])("should classify '%s' as %s:%s", async (input, type, subType) => {
    const result = await classifier.classify(input);
    expect(result.type).toBe(type);
    expect(result.subType).toBe(subType);
  });

  // List 意图
  it.each([
    ["列出今天的收藏", "query", "list"],
    ["本周添加的书签", "query", "list"],
    ["显示最近的", "query", "list"],
  ])("should classify '%s' as %s:%s", async (input, type, subType) => {
    const result = await classifier.classify(input);
    expect(result.type).toBe(type);
    expect(result.subType).toBe(subType);
  });
});
```

**文件 3**：`src/lib/ai-skills/router/__tests__/time-range-slot-extraction.test.ts`

```typescript
describe("Time range slot extraction", () => {
  it.each([
    ["今天有多少收藏", "today"],
    ["本周新增几条", "week"],
    ["这个月收藏了什么", "month"],
    ["昨天添加的", "yesterday"],
  ])("should extract timeRange '%s' from '%s'", async (input, expected) => {
    const result = await analyzer.analyze(input);
    expect(result.slots?.timeRange?.value).toBe(expected);
  });

  it("should not extract timeRange when not explicitly mentioned", async () => {
    const result = await analyzer.analyze("有多少收藏");
    expect(result.slots?.timeRange).toBeUndefined();
  });
});
```

**估时**：45min

---

## 实现计划

| Phase | 任务 | 估时 | 优先级 | 依赖 |
|-------|------|------|--------|------|
| 1 | 创建共享时间范围工具模块 | 30min | P0 | - |
| 2 | 更新槽位定义 | 15min | P0 | - |
| 3 | 修复 Count 系列工具 | 45min | P0 | Phase 1 |
| 4 | 修复 List 系列工具 | 45min | P0 | Phase 1 |
| 5 | 修复 get_stats 工具 | 30min | P1 | Phase 1 |
| 6 | 意图分类规则增强 | 20min | P0 | - |
| 7 | 槽位提取与工具参数集成 | 45min | P0 | Phase 1-2 |
| 8 | 更新工具描述模板 | 20min | P1 | Phase 3-4 |
| 9 | 测试用例 | 45min | P0 | Phase 1-7 |

**总计**：~5.5 小时

---

## 验收标准

### 功能验收

1. ✅ "今天有多少收藏" → 返回当天收藏数
2. ✅ "本周收藏了几条" → 返回本周收藏数
3. ✅ "列出今天的收藏" → 返回当天收藏列表
4. ✅ "导出本月收藏" → 导出本月数据
5. ✅ "有多少收藏" → 返回总数（保持现有行为）

### 技术验收

1. ✅ 所有现有测试通过
2. ✅ 新增测试全部通过
3. ✅ TypeScript 类型检查通过
4. ✅ 生产构建成功

---

## 风险评估

| 风险 | 等级 | 缓解措施 |
|------|------|---------|
| 向后兼容性 | 低 | timeRange 默认为 "all"，不影响现有行为 |
| 性能影响 | 低 | 时间过滤使用数据库索引 |
| 测试覆盖 | 中 | 新增 30+ 测试用例 |

---

## 后续优化（P2）

1. **自定义日期范围**：支持「最近 3 天」「上个月到这个月」等
2. **响应模板优化**：AI 回答时明确说明时间范围（如「今天（1月10日）您收藏了 5 条」）
3. **时间范围建议**：当结果为 0 时，建议扩大时间范围
