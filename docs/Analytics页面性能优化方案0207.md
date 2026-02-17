# Analytics 页面性能优化方案

> 创建日期：2026-02-07
> 状态：待审核

---

## 一、问题概述

### 1.1 现象

Analytics 数据统计页面加载缓慢，用户体验差。

### 1.2 根因分析

| 问题                | 影响程度 | 描述                                       |
| ------------------- | -------- | ------------------------------------------ |
| **全量数据查询**    | 🔴 严重  | 一次性加载用户所有书签到内存，书签越多越慢 |
| **内存聚合计算**    | 🔴 严重  | 6 类统计全部在 Node.js 内存遍历计算        |
| **禁用缓存**        | 🔴 严重  | `force-dynamic` 导致每次访问都重新查询     |
| **已有 API 未使用** | 🟡 中等  | `/api/analytics/stats` 已优化但页面未调用  |
| **缺少客户端缓存**  | 🟡 中等  | 无 localStorage 持久化缓存                 |

### 1.3 当前数据流

```
┌─────────────────────────────────────────────────────────────────────┐
│ 页面加载                                                              │
└──────────────────────────────┬──────────────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│ AnalyticsService.getFullAnalytics()                                  │
│ ├── Repository.getForAnalytics() ──→ 返回 N 条书签（全量）            │
│ ├── fetchFolders()                                                   │
│ ├── fetchClassificationStats()                                       │
│ └── fetchSkillsStats()                                               │
└──────────────────────────────┬──────────────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│ 内存计算（遍历 N 次）                                                 │
│ ├── calculateStats()              → 基础统计                         │
│ ├── calculateTrendData()          → 30天趋势（遍历全量）              │
│ ├── calculatePlatformDistribution() → 平台分布                       │
│ ├── calculateFolderDistribution()   → 文件夹分布                     │
│ ├── calculateTagStats()           → 标签统计（展开数组）              │
│ ├── calculateTypeStats()          → 内容类型                         │
│ └── calculateComparison()         → 时间对比（6次过滤）               │
└─────────────────────────────────────────────────────────────────────┘
```

**性能问题**：用户有 5000 条书签时，需要传输 5000 条记录 + 多次内存遍历。

---

## 二、优化目标

| 指标            | 当前           | 目标           | 提升幅度 |
| --------------- | -------------- | -------------- | -------- |
| 首次加载时间    | 3-5s           | < 500ms        | 6-10x    |
| 数据库查询次数  | 4 次           | 1-2 次         | 50-75%   |
| 网络传输数据量  | N 条原始记录   | ~20 条聚合结果 | 99%+     |
| 服务端 CPU 占用 | 高（遍历计算） | 低（直接返回） | 90%+     |

---

## 三、优化方案

### 3.1 方案架构

```
┌─────────────────────────────────────────────────────────────────────┐
│ Phase 1: 快速修复（1小时）                                           │
│ ├── 启用 HTTP 缓存（移除 force-dynamic）                              │
│ └── 添加客户端 SWR 缓存（2分钟）                                      │
└─────────────────────────────────────────────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Phase 2: 数据库聚合（2-3小时）                                        │
│ ├── 创建 SQL 聚合函数 get_user_analytics()                           │
│ ├── 单次 RPC 调用返回所有统计                                         │
│ └── 删除内存计算逻辑                                                  │
└─────────────────────────────────────────────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Phase 3: 增量优化（可选）                                             │
│ ├── 添加 localStorage 持久化缓存                                      │
│ ├── 分块加载（基础统计优先，图表延迟）                                 │
│ └── 后台预计算（物化视图）                                            │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 四、Phase 1: 快速修复

### 4.1 启用 HTTP 缓存

**文件**: `src/app/(main)/analytics/page.tsx`

```diff
- export const dynamic = "force-dynamic";
- export const revalidate = 0;
+ // 启用 5 分钟缓存，统计数据不需要实时
+ export const revalidate = 300;
```

**预期效果**：5 分钟内的重复访问直接返回缓存，无需数据库查询。

### 4.2 添加客户端缓存

**文件**: `src/hooks/data/use-page-data.ts` 的 `useAnalyticsData`

```typescript
// 使用 SWR 配置
const SWR_CONFIG = {
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
  dedupingInterval: 120000, // 2 分钟内去重
  staleTime: 120000, // 2 分钟内认为数据新鲜
};
```

---

## 五、Phase 2: 数据库聚合（核心优化）

### 5.1 新建 SQL 聚合函数

**迁移文件**: `supabase/migrations/20260207100001_analytics_aggregate_function.sql`

```sql
-- Analytics 数据库聚合函数
-- 将所有统计计算下推到 PostgreSQL，避免全量数据传输和内存计算

-- 浏览器平台常量
CREATE OR REPLACE FUNCTION is_browser_platform(p_platform TEXT)
RETURNS BOOLEAN AS $$
  SELECT p_platform IN ('BROWSER_CHROME', 'BROWSER_EDGE', 'BROWSER_FIREFOX', 'BROWSER_SAFARI');
$$ LANGUAGE sql IMMUTABLE;

-- 主聚合函数
CREATE OR REPLACE FUNCTION get_user_analytics(
  p_user_id UUID,
  p_merge_browser_platforms BOOLEAN DEFAULT TRUE,
  p_trend_days INTEGER DEFAULT 30,
  p_top_tags_count INTEGER DEFAULT 10,
  p_top_folders_count INTEGER DEFAULT 10
)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
  v_now TIMESTAMP WITH TIME ZONE := NOW();
  v_beijing_now TIMESTAMP := (v_now AT TIME ZONE 'Asia/Shanghai');
  v_today_start TIMESTAMP := DATE_TRUNC('day', v_beijing_now);
  v_yesterday_start TIMESTAMP := v_today_start - INTERVAL '1 day';
  v_this_week_start TIMESTAMP := DATE_TRUNC('week', v_beijing_now);
  v_last_week_start TIMESTAMP := v_this_week_start - INTERVAL '1 week';
  v_this_month_start TIMESTAMP := DATE_TRUNC('month', v_beijing_now);
  v_last_month_start TIMESTAMP := v_this_month_start - INTERVAL '1 month';
  v_trend_start TIMESTAMP := v_today_start - (p_trend_days - 1) * INTERVAL '1 day';
BEGIN
  SELECT jsonb_build_object(
    -- 1. 基础统计
    'stats', (
      SELECT jsonb_build_object(
        'totalBookmarks', COUNT(*),
        'contentBookmarks', COUNT(*) FILTER (WHERE NOT is_browser_platform(platform)),
        'browserBookmarks', COUNT(*) FILTER (WHERE is_browser_platform(platform)),
        'todayCount', COUNT(*) FILTER (
          WHERE (created_at AT TIME ZONE 'Asia/Shanghai') >= v_today_start
        ),
        'weekCount', COUNT(*) FILTER (
          WHERE (created_at AT TIME ZONE 'Asia/Shanghai') >= v_this_week_start
        ),
        'last30DaysCount', COUNT(*) FILTER (
          WHERE created_at >= v_now - INTERVAL '30 days'
        ),
        'unclassifiedCount', COUNT(*) FILTER (WHERE folder_id IS NULL),
        'classificationRate', CASE
          WHEN COUNT(*) = 0 THEN 0
          ELSE ROUND((COUNT(*) FILTER (WHERE folder_id IS NOT NULL))::NUMERIC / COUNT(*) * 100, 1)
        END
      )
      FROM bookmarks
      WHERE user_id = p_user_id AND deleted_at IS NULL
    ),

    -- 2. 30天趋势数据
    'trendData', (
      WITH date_series AS (
        SELECT generate_series(
          v_trend_start::date,
          v_today_start::date,
          '1 day'::interval
        )::date AS date
      ),
      daily_counts AS (
        SELECT
          ((created_at AT TIME ZONE 'Asia/Shanghai')::date) AS date,
          COUNT(*) FILTER (WHERE NOT is_browser_platform(platform)) AS content_count,
          COUNT(*) FILTER (WHERE is_browser_platform(platform)) AS browser_count
        FROM bookmarks
        WHERE user_id = p_user_id
          AND deleted_at IS NULL
          AND created_at >= (v_trend_start AT TIME ZONE 'Asia/Shanghai' AT TIME ZONE 'UTC')
        GROUP BY 1
      )
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'date', TO_CHAR(ds.date, 'YYYY-MM-DD'),
          'count', COALESCE(dc.content_count, 0),
          'browserCount', COALESCE(dc.browser_count, 0),
          'total', COALESCE(dc.content_count, 0) + COALESCE(dc.browser_count, 0)
        ) ORDER BY ds.date
      ), '[]'::jsonb)
      FROM date_series ds
      LEFT JOIN daily_counts dc ON ds.date = dc.date
    ),

    -- 3. 平台分布
    'platformDistribution', (
      WITH platform_counts AS (
        SELECT
          CASE
            WHEN p_merge_browser_platforms AND is_browser_platform(platform) THEN 'BROWSER'
            ELSE platform
          END AS display_platform,
          COUNT(*) AS value
        FROM bookmarks
        WHERE user_id = p_user_id AND deleted_at IS NULL
        GROUP BY 1
      ),
      total AS (SELECT SUM(value) AS total FROM platform_counts)
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'platform', pc.display_platform,
          'value', pc.value,
          'percentage', CASE WHEN t.total > 0 THEN ROUND(pc.value::NUMERIC / t.total * 100, 0) ELSE 0 END
        ) ORDER BY pc.value DESC
      ), '[]'::jsonb)
      FROM platform_counts pc
      CROSS JOIN total t
    ),

    -- 4. 文件夹分布（Top N + 未分类）
    'folderDistribution', (
      WITH folder_counts AS (
        SELECT
          folder_id,
          COUNT(*) AS value
        FROM bookmarks
        WHERE user_id = p_user_id AND deleted_at IS NULL
        GROUP BY folder_id
      ),
      total AS (SELECT SUM(value) AS total FROM folder_counts),
      ranked AS (
        SELECT
          fc.folder_id,
          COALESCE(f.name, '未分类') AS name,
          fc.value,
          CASE WHEN t.total > 0 THEN ROUND(fc.value::NUMERIC / t.total * 100, 0) ELSE 0 END AS percentage,
          ROW_NUMBER() OVER (ORDER BY fc.value DESC) AS rn
        FROM folder_counts fc
        CROSS JOIN total t
        LEFT JOIN folders f ON fc.folder_id = f.id AND f.user_id = p_user_id
      )
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'folderId', folder_id,
          'name', name,
          'value', value,
          'percentage', percentage
        ) ORDER BY value DESC
      ), '[]'::jsonb)
      FROM ranked
      WHERE rn <= p_top_folders_count OR folder_id IS NULL
    ),

    -- 5. 热门标签（仅内容收藏）
    'tagStats', (
      WITH tag_counts AS (
        SELECT
          tag,
          COUNT(*) AS count
        FROM bookmarks,
        LATERAL jsonb_array_elements_text(COALESCE(ai_tags, '[]'::jsonb)) AS tag
        WHERE user_id = p_user_id
          AND deleted_at IS NULL
          AND NOT is_browser_platform(platform)
        GROUP BY tag
        ORDER BY count DESC
        LIMIT p_top_tags_count
      )
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object('tag', tag, 'count', count)
        ORDER BY count DESC
      ), '[]'::jsonb)
      FROM tag_counts
    ),

    -- 6. 内容类型统计
    'typeStats', (
      WITH content_types AS (
        SELECT
          CASE
            WHEN platform = 'BILIBILI' THEN '视频'
            WHEN platform = 'XIAOHONGSHU' THEN '图文'
            ELSE '文章'
          END AS type
        FROM bookmarks
        WHERE user_id = p_user_id
          AND deleted_at IS NULL
          AND NOT is_browser_platform(platform)
      ),
      type_counts AS (
        SELECT type, COUNT(*) AS count
        FROM content_types
        GROUP BY type
      ),
      total AS (SELECT SUM(count) AS total FROM type_counts)
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'type', tc.type,
          'count', tc.count,
          'percentage', CASE WHEN t.total > 0 THEN ROUND(tc.count::NUMERIC / t.total * 100, 0) ELSE 0 END
        ) ORDER BY tc.count DESC
      ), '[]'::jsonb)
      FROM type_counts tc
      CROSS JOIN total t
      WHERE tc.count > 0
    ),

    -- 7. 时间对比（日/周/月环比）
    'comparison', (
      WITH counts AS (
        SELECT
          COUNT(*) FILTER (
            WHERE (created_at AT TIME ZONE 'Asia/Shanghai') >= v_today_start
              AND NOT is_browser_platform(platform)
          ) AS today_count,
          COUNT(*) FILTER (
            WHERE (created_at AT TIME ZONE 'Asia/Shanghai') >= v_yesterday_start
              AND (created_at AT TIME ZONE 'Asia/Shanghai') < v_today_start
              AND NOT is_browser_platform(platform)
          ) AS yesterday_count,
          COUNT(*) FILTER (
            WHERE (created_at AT TIME ZONE 'Asia/Shanghai') >= v_this_week_start
              AND NOT is_browser_platform(platform)
          ) AS this_week_count,
          COUNT(*) FILTER (
            WHERE (created_at AT TIME ZONE 'Asia/Shanghai') >= v_last_week_start
              AND (created_at AT TIME ZONE 'Asia/Shanghai') < v_this_week_start
              AND NOT is_browser_platform(platform)
          ) AS last_week_count,
          COUNT(*) FILTER (
            WHERE (created_at AT TIME ZONE 'Asia/Shanghai') >= v_this_month_start
              AND NOT is_browser_platform(platform)
          ) AS this_month_count,
          COUNT(*) FILTER (
            WHERE (created_at AT TIME ZONE 'Asia/Shanghai') >= v_last_month_start
              AND (created_at AT TIME ZONE 'Asia/Shanghai') < v_this_month_start
              AND NOT is_browser_platform(platform)
          ) AS last_month_count
        FROM bookmarks
        WHERE user_id = p_user_id
          AND deleted_at IS NULL
          AND created_at >= (v_last_month_start AT TIME ZONE 'Asia/Shanghai' AT TIME ZONE 'UTC')
      )
      SELECT jsonb_build_object(
        'daily', jsonb_build_object(
          'current', today_count,
          'previous', yesterday_count,
          'change', today_count - yesterday_count,
          'changePercent', CASE
            WHEN yesterday_count = 0 THEN CASE WHEN today_count > 0 THEN 100 ELSE 0 END
            ELSE ROUND((today_count - yesterday_count)::NUMERIC / yesterday_count * 100, 1)
          END
        ),
        'weekly', jsonb_build_object(
          'current', this_week_count,
          'previous', last_week_count,
          'change', this_week_count - last_week_count,
          'changePercent', CASE
            WHEN last_week_count = 0 THEN CASE WHEN this_week_count > 0 THEN 100 ELSE 0 END
            ELSE ROUND((this_week_count - last_week_count)::NUMERIC / last_week_count * 100, 1)
          END
        ),
        'monthly', jsonb_build_object(
          'current', this_month_count,
          'previous', last_month_count,
          'change', this_month_count - last_month_count,
          'changePercent', CASE
            WHEN last_month_count = 0 THEN CASE WHEN this_month_count > 0 THEN 100 ELSE 0 END
            ELSE ROUND((this_month_count - last_month_count)::NUMERIC / last_month_count * 100, 1)
          END
        )
      )
      FROM counts
    ),

    -- 元数据
    'generatedAt', TO_CHAR(v_now, 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE;

-- 添加函数注释
COMMENT ON FUNCTION get_user_analytics IS
'Analytics 数据聚合函数，一次调用返回所有统计数据。
参数：
  - p_user_id: 用户 ID
  - p_merge_browser_platforms: 是否合并浏览器平台为 BROWSER
  - p_trend_days: 趋势数据天数（默认30天）
  - p_top_tags_count: 热门标签数量（默认10个）
  - p_top_folders_count: 热门文件夹数量（默认10个）
返回：JSONB 格式的统计数据';

-- 授权 RPC 调用
GRANT EXECUTE ON FUNCTION get_user_analytics TO authenticated;
```

### 5.2 添加性能索引

**迁移文件**: `supabase/migrations/20260207100002_analytics_performance_indexes.sql`

```sql
-- Analytics 查询性能索引
-- 支持按用户+时间范围+平台的快速聚合查询

-- 复合索引：用户 + 删除状态 + 创建时间 + 平台
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookmarks_analytics_composite
ON bookmarks(user_id, created_at DESC, platform)
WHERE deleted_at IS NULL;

-- 复合索引：用户 + 文件夹（用于分类统计）
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookmarks_user_folder
ON bookmarks(user_id, folder_id)
WHERE deleted_at IS NULL;

-- GIN 索引：ai_tags 数组（用于标签统计）
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bookmarks_ai_tags_gin
ON bookmarks USING gin(ai_tags jsonb_path_ops)
WHERE deleted_at IS NULL AND ai_tags IS NOT NULL;

COMMENT ON INDEX idx_bookmarks_analytics_composite IS 'Analytics 聚合查询优化索引';
COMMENT ON INDEX idx_bookmarks_user_folder IS '文件夹分布统计优化索引';
COMMENT ON INDEX idx_bookmarks_ai_tags_gin IS '标签统计优化索引';
```

### 5.3 修改服务层调用

**文件**: `src/lib/analytics/analytics.service.ts`

```typescript
// 新增方法：使用数据库聚合函数
async getAnalyticsViaRPC(): Promise<AnalyticsData> {
  const { data, error } = await this.supabase.rpc('get_user_analytics', {
    p_user_id: this.userId,
    p_merge_browser_platforms: this.config.mergeBrowserPlatforms ?? true,
    p_trend_days: 30,
    p_top_tags_count: 10,
    p_top_folders_count: 10,
  });

  if (error) {
    throw new Error(`Analytics RPC failed: ${error.message}`);
  }

  // 补充前端需要的额外字段（平台名称、颜色等）
  return this.enrichAnalyticsData(data);
}

// 数据增强：添加平台名称、颜色等前端展示字段
private enrichAnalyticsData(rawData: RawAnalyticsData): AnalyticsData {
  return {
    ...rawData,
    platformDistribution: rawData.platformDistribution.map(item => ({
      ...item,
      name: getPlatformName(item.platform),
      color: getPlatformHexColor(item.platform),
    })),
    // AI Skills 统计需要单独查询（如果开启）
    classificationStats: null,
    skillsStats: null,
  };
}
```

### 5.4 修改页面调用

**文件**: `src/app/(main)/analytics/page.tsx`

```diff
- export const dynamic = "force-dynamic";
- export const revalidate = 0;
+ export const revalidate = 300; // 5分钟缓存

  // 使用新的 RPC 方法
- const analyticsData = await getAnalyticsData(supabase, userId, {
-   mergeBrowserPlatforms: true,
-   includeComparison: true,
-   includeAIStats: true,
-   includeSkillsStats: true,
- });
+ const analyticsData = await analyticsService.getAnalyticsViaRPC();
```

---

## 六、Phase 3: 增量优化（可选）

### 6.1 localStorage 持久化缓存

```typescript
// src/hooks/data/use-analytics-data.ts
const CACHE_KEY = "analytics_cache";
const CACHE_TTL = 2 * 60 * 1000; // 2分钟

function useAnalyticsData() {
  const [data, setData] = useState<AnalyticsData | null>(() => {
    // 从 localStorage 恢复
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < CACHE_TTL) {
        return data;
      }
    }
    return null;
  });

  // 更新时同步到 localStorage
  useEffect(() => {
    if (data) {
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({
          data,
          timestamp: Date.now(),
        }),
      );
    }
  }, [data]);
}
```

### 6.2 分块加载策略

```typescript
// 优先加载基础统计，图表延迟加载
const [basicStats, setBasicStats] = useState(null); // 立即加载
const [chartData, setChartData] = useState(null); // 延迟 100ms
const [aiStats, setAiStats] = useState(null); // 用户滚动到时加载
```

### 6.3 物化视���（大数据量用户）

```sql
-- 每小时刷新的物化视图
CREATE MATERIALIZED VIEW mv_user_analytics_hourly AS
SELECT
  user_id,
  COUNT(*) as total_bookmarks,
  COUNT(*) FILTER (WHERE NOT is_browser_platform(platform)) as content_count,
  -- ... 其他聚合
FROM bookmarks
WHERE deleted_at IS NULL
GROUP BY user_id;

-- 创建唯一索引支持并发刷新
CREATE UNIQUE INDEX ON mv_user_analytics_hourly(user_id);

-- 定时刷新（需要 pg_cron 扩展或 Supabase Edge Function）
SELECT cron.schedule('refresh-analytics', '0 * * * *',
  'REFRESH MATERIALIZED VIEW CONCURRENTLY mv_user_analytics_hourly');
```

---

## 七、优化前后对比

### 7.1 数据流对比

**优化前**：

```
PostgreSQL ──(5000条记录)──→ Node.js ──(6次遍历)──→ 统计结果
            ~500KB 传输         ~200ms CPU
```

**优化后**：

```
PostgreSQL ──(1条JSONB)──→ Node.js ──(直接返回)──→ 统计结果
            ~5KB 传输          ~0ms CPU
```

### 7.2 查询计划对比

**优化前（全表扫描）**：

```sql
EXPLAIN SELECT * FROM bookmarks WHERE user_id = $1 AND deleted_at IS NULL;
-- Seq Scan on bookmarks (cost=0.00..xxx rows=5000)
```

**优化后（索引扫描 + 聚合）**：

```sql
EXPLAIN SELECT get_user_analytics($1);
-- Index Scan using idx_bookmarks_analytics_composite
-- Aggregate (cost=xxx rows=1)
```

---

## 八、实施计划

| 阶段      | 任务                           | 预估时间     | 风险         |
| --------- | ------------------------------ | ------------ | ------------ |
| Phase 1.1 | 移除 `force-dynamic`，启用缓存 | 5min         | 低           |
| Phase 1.2 | 添加客户端 SWR 缓存配置        | 15min        | 低           |
| Phase 2.1 | 创建 SQL 聚合函数迁移          | 30min        | 中（需测试） |
| Phase 2.2 | 创建性能索引迁移               | 10min        | 低           |
| Phase 2.3 | 修改 analytics.service.ts      | 30min        | 中           |
| Phase 2.4 | 修改页面调用方式               | 15min        | 低           |
| Phase 2.5 | 本地测试验证                   | 30min        | -            |
| **总计**  |                                | **~2.5小时** |              |

---

## 九、验收标准

1. **性能指标**：
   - [ ] 首次加载时间 < 500ms（从 3-5s 优化）
   - [ ] 网络传输数据量 < 10KB（从 ~500KB 优化）
   - [ ] 数据库查询时间 < 100ms

2. **功能完整性**：
   - [ ] 所有统计数据正确显示
   - [ ] 趋势图表数据准确
   - [ ] 时区处理正确（北京时间）
   - [ ] 平台合并逻辑正常

3. **缓存行为**：
   - [ ] 5分钟内重复访问使用缓存
   - [ ] 刷新后数据正常更新

---

## 十、回滚方案

如果优化后出现问题，可以快速回滚：

1. **回滚 Phase 1**：恢复 `force-dynamic` 配置
2. **回滚 Phase 2**：
   - 保留 SQL 函数（无副作用）
   - 将服务层调用改回原方法 `getFullAnalytics()`

```typescript
// 回滚开关
const USE_RPC_ANALYTICS = process.env.NEXT_PUBLIC_USE_RPC_ANALYTICS === "true";

const analyticsData = USE_RPC_ANALYTICS
  ? await analyticsService.getAnalyticsViaRPC()
  : await analyticsService.getFullAnalytics();
```

---

## 十一、待确认事项

请审核以下决策点：

1. **缓存时间**：建议 5 分钟，是否合适？
2. **AI Skills 统计**：是否需要包含在 RPC 中，还是单独懒加载？
3. **索引创建**：是否使用 `CONCURRENTLY`（不锁表但更慢）？
4. **Phase 3 优先级**：是否需要实施 localStorage 缓存和物化视图？

---

> 审核通过后，我将按照 Phase 1 → Phase 2 顺序实施。
