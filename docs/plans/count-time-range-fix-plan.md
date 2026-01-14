# Count 时间范围修复方案

## 问题描述

用户询问「我今天有多少收藏？」时，AI 返回的是总数（1389 条）和最近 7 天统计，而不是当天的收藏数量。

## 根因分析

1. **意图分类层** - count 规则不包含时间关键词
2. **槽位定义层** - `query:count` 缺少 `timeRange` 槽位
3. **工具实现层** - `count_total.tool.ts` 无时间参数
4. **数据库查询层** - 没有 `created_at` 时间过滤

## 修复清单

### P0-1: 为 count 工具添加时间范围参数（30min）

**文件**：`src/lib/ai-agent/tools/query/count-total.tool.ts`

**变更**：

```typescript
// 1. 定义时间范围类型
const timeRangeSchema = z.enum([
  "today",      // 今天
  "yesterday",  // 昨天
  "week",       // 本周
  "month",      // 本月
  "quarter",    // 本季度
  "year",       // 今年
  "all",        // 全部（默认）
]).optional().default("all");

// 2. 更新参数 Schema
const paramsSchema = z.object({
  timeRange: timeRangeSchema.describe("统计时间范围，默认为全部"),
});

// 3. 实现时间过滤函数
function getTimeRangeDates(timeRange: string): { start?: Date; end?: Date } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (timeRange) {
    case "today":
      return { start: today };
    case "yesterday": {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return { start: yesterday, end: today };
    }
    case "week": {
      const weekStart = new Date(today);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      return { start: weekStart };
    }
    case "month": {
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      return { start: monthStart };
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

// 4. 在查询中应用时间过滤
async execute(params: CountTotalParams, context: ToolContext) {
  const { timeRange = "all" } = params;
  const { start, end } = getTimeRangeDates(timeRange);

  let query = supabase
    .from("bookmarks")
    .select("id", { count: "exact", head: true })
    .eq("user_id", context.userId)
    .is("deleted_at", null);

  if (start) {
    query = query.gte("created_at", start.toISOString());
  }
  if (end) {
    query = query.lt("created_at", end.toISOString());
  }

  const { count, error } = await query;
  // ...
}
```

### P0-2: 更新槽位定义（15min）

**文件**：`src/lib/ai-skills/router/slot-schemas.ts`

**变更**：

```typescript
"query:count": {
  required: [],
  optional: ["folder", "tags", "platform", "timeRange"], // 添加 timeRange
  description: "统计书签数量（支持时间范围过滤）",
},
```

### P0-3: 增强意图分类规则（20min）

**文件**：`src/lib/ai-skills/router/intent-classifier.ts`

**变更**：

```typescript
// 在 count 规则中添加时间词组合
{
  // 统计意图 - 带时间范围
  // 示例: "今天有多少收藏"、"本周新增几条"、"这个月收藏了多少"
  pattern: /(今天|昨天|本周|这周|本月|这个月|今年).{0,5}(有多少|多少条|几条|几个|新增|收藏了)/,
  type: "query",
  subType: "count",
  complexity: "simple",
  weight: 75, // 高于普通 count 规则
},
{
  // 统计意图 - 后置时间
  // 示例: "多少条是今天的"、"有多少今天的收藏"
  pattern: /(有多少|多少条).{0,5}(今天|昨天|本周|这周|本月|这个月)/,
  type: "query",
  subType: "count",
  complexity: "simple",
  weight: 75,
},
```

### P0-4: 实现时间槽位提取集成（30min）

**文件**：`src/lib/ai-skills/router/intent-analyzer.ts`

**变更**：在意图分析时自动提取时间槽位：

```typescript
import { extractSlot, TIME_RANGE_SLOT } from "../extraction/slot-extractor";

// 在分析 query:count 意图时提取时间槽位
function extractCountSlots(message: string): IntentSlots {
  const slots: IntentSlots = {};

  // 使用现有的 TIME_RANGE_SLOT 提取时间范围
  const timeRange = extractSlot<TimeRangeValue>(message, "timeRange");
  if (timeRange && timeRange !== "week") { // week 是默认值，只有明确提取到的才添加
    slots.timeRange = {
      value: timeRange,
      type: "string",
      confidence: 0.9,
      source: "extracted",
    };
  }

  return slots;
}
```

### P0-5: 更新工具描述模板（10min）

**文件**：`src/lib/ai-agent/tools/tool-description-templates.ts`

**变更**：

```typescript
count_total: `统计用户收藏总数。
支持参数：
- timeRange: 统计时间范围
  - "today" - 今天
  - "yesterday" - 昨天
  - "week" - 本周
  - "month" - 本月
  - "year" - 今年
  - "all" - 全部（默认）

示例场景：
- "我有多少收藏" → timeRange: "all"
- "今天收藏了多少" → timeRange: "today"
- "本周新增几条" → timeRange: "week"`,
```

### P0-6: 添加测试用例（20min）

**文件**：`src/lib/ai-agent/tools/query/__tests__/count-total.tool.test.ts`

**新增测试**：

```typescript
describe("count_total with timeRange", () => {
  it("should count today's bookmarks", async () => {
    const result = await countTotalTool.execute(
      { timeRange: "today" },
      mockContext
    );
    expect(result.success).toBe(true);
    // 验证查询包含时间过滤
  });

  it("should count this week's bookmarks", async () => {
    const result = await countTotalTool.execute(
      { timeRange: "week" },
      mockContext
    );
    expect(result.success).toBe(true);
  });

  it("should default to all when no timeRange specified", async () => {
    const result = await countTotalTool.execute({}, mockContext);
    expect(result.success).toBe(true);
    // 验证无时间过滤
  });
});
```

**文件**：`src/lib/ai-skills/router/__tests__/intent-classifier.test.ts`

**新增测试**：

```typescript
describe("count intent with time range", () => {
  it.each([
    ["我今天有多少收藏", "query", "count"],
    ["今天收藏了几条", "query", "count"],
    ["本周新增多少", "query", "count"],
    ["这个月有多少条", "query", "count"],
  ])("should classify '%s' as %s:%s", (input, type, subType) => {
    const result = classifyIntent(input);
    expect(result.type).toBe(type);
    expect(result.subType).toBe(subType);
  });
});
```

## 时间估算

| 任务 | 估时 | 优先级 |
|------|------|--------|
| P0-1: count 工具添加时间参数 | 30min | P0 |
| P0-2: 槽位定义更新 | 15min | P0 |
| P0-3: 意图分类规则增强 | 20min | P0 |
| P0-4: 时间槽位提取集成 | 30min | P0 |
| P0-5: 工具描述模板更新 | 10min | P0 |
| P0-6: 测试用例 | 20min | P0 |
| **总计** | **~2h** | |

## 验收标准

1. 用户问「今天有多少收藏」→ 返回当天收藏数
2. 用户问「本周收藏了几条」→ 返回本周收藏数
3. 用户问「有多少收藏」→ 返回总数（保持现有行为）
4. 所有现有测试通过
5. 新增测试全部通过

## 风险评估

- **低风险**：改动范围明确，向后兼容（timeRange 默认为 "all"）
- **依赖**：无外部依赖
- **回滚**：可快速回滚

## 后续优化（P1）

1. 支持自定义日期范围（如「最近 3 天」「上个月」）
2. 统一其他 count 工具（count-by-folder, count-by-platform）支持时间范围
3. 考虑在响应模板中显示时间范围说明（如「今天（1月10日）您收藏了 5 条」）
