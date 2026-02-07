-- Analytics 数据库聚合函数
-- 将所有统计计算下推到 PostgreSQL，避免全量数据传输和内存计算
--
-- 优化效果：
--   - 数据传输：从 ~500KB (N条记录) 降至 ~5KB (1条JSONB)
--   - 查询次数：从 4 次降至 1 次
--   - CPU 计算：从 Node.js 内存遍历改为数据库原生聚合

-- 辅助函数：判断是否为浏览器平台
CREATE OR REPLACE FUNCTION is_browser_platform(p_platform TEXT)
RETURNS BOOLEAN AS $$
  SELECT p_platform IN ('BROWSER_CHROME', 'BROWSER_EDGE', 'BROWSER_FIREFOX', 'BROWSER_SAFARI');
$$ LANGUAGE sql IMMUTABLE;

COMMENT ON FUNCTION is_browser_platform IS '判断平台是否为浏览器书签类型';

-- 主聚合函数：一次调用返回所有统计数据
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
  v_this_week_start TIMESTAMP := DATE_TRUNC('week', v_beijing_now) + INTERVAL '1 day'; -- 周一开始
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
          WHERE (created_at AT TIME ZONE 'Asia/Shanghai')::timestamp >= v_today_start
        ),
        'weekCount', COUNT(*) FILTER (
          WHERE (created_at AT TIME ZONE 'Asia/Shanghai')::timestamp >= v_this_week_start
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

    -- 2. 趋势数据（最近 N 天）
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
          AND (created_at AT TIME ZONE 'Asia/Shanghai')::timestamp >= v_trend_start
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
          ROW_NUMBER() OVER (
            ORDER BY
              CASE WHEN fc.folder_id IS NULL THEN 1 ELSE 0 END,
              fc.value DESC
          ) AS rn
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
        ) ORDER BY
          CASE WHEN folder_id IS NULL THEN 1 ELSE 0 END,
          value DESC
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
        LATERAL unnest(COALESCE(ai_tags, ARRAY[]::text[])) AS tag
        WHERE user_id = p_user_id
          AND deleted_at IS NULL
          AND NOT is_browser_platform(platform)
          AND ai_tags IS NOT NULL
          AND array_length(ai_tags, 1) > 0
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
            WHERE (created_at AT TIME ZONE 'Asia/Shanghai')::timestamp >= v_today_start
              AND NOT is_browser_platform(platform)
          ) AS today_count,
          COUNT(*) FILTER (
            WHERE (created_at AT TIME ZONE 'Asia/Shanghai')::timestamp >= v_yesterday_start
              AND (created_at AT TIME ZONE 'Asia/Shanghai')::timestamp < v_today_start
              AND NOT is_browser_platform(platform)
          ) AS yesterday_count,
          COUNT(*) FILTER (
            WHERE (created_at AT TIME ZONE 'Asia/Shanghai')::timestamp >= v_this_week_start
              AND NOT is_browser_platform(platform)
          ) AS this_week_count,
          COUNT(*) FILTER (
            WHERE (created_at AT TIME ZONE 'Asia/Shanghai')::timestamp >= v_last_week_start
              AND (created_at AT TIME ZONE 'Asia/Shanghai')::timestamp < v_this_week_start
              AND NOT is_browser_platform(platform)
          ) AS last_week_count,
          COUNT(*) FILTER (
            WHERE (created_at AT TIME ZONE 'Asia/Shanghai')::timestamp >= v_this_month_start
              AND NOT is_browser_platform(platform)
          ) AS this_month_count,
          COUNT(*) FILTER (
            WHERE (created_at AT TIME ZONE 'Asia/Shanghai')::timestamp >= v_last_month_start
              AND (created_at AT TIME ZONE 'Asia/Shanghai')::timestamp < v_this_month_start
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
    'generatedAt', TO_CHAR(v_now, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE;

-- 添加函数注释
COMMENT ON FUNCTION get_user_analytics IS 'Analytics 数据聚合函数，一次调用返回所有统计数据。
参数：
  - p_user_id: 用户 ID
  - p_merge_browser_platforms: 是否合并浏览器平台为 BROWSER (默认 true)
  - p_trend_days: 趋势数据天数 (默认 30)
  - p_top_tags_count: 热门标签数量 (默认 10)
  - p_top_folders_count: 热门文件夹数量 (默认 10)
返回：JSONB 格式的统计数据，包含 stats/trendData/platformDistribution/folderDistribution/tagStats/typeStats/comparison';

-- 授权 RPC 调用
GRANT EXECUTE ON FUNCTION is_browser_platform TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_analytics TO authenticated;
