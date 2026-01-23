-- ============================================================================
-- V5.1 智能分类准确率评估报告
-- 执行时间: 请在 Supabase SQL Editor 或 psql 中运行
-- ============================================================================

-- ============================================================================
-- 1. 数据概览
-- ============================================================================
SELECT '========== 1. 数据概览 ==========' as section;

SELECT
  COUNT(*) as "总分类记录数",
  COUNT(DISTINCT user_id) as "涉及用户数",
  COUNT(CASE WHEN user_feedback IS NOT NULL THEN 1 END) as "有反馈的记录数",
  MIN(created_at)::date as "最早记录日期",
  MAX(created_at)::date as "最新记录日期"
FROM classification_metrics;

-- ============================================================================
-- 2. V5.1 核心准确率指标
-- ============================================================================
SELECT '========== 2. V5.1 核心准确率 ==========' as section;

SELECT
  COUNT(*) FILTER (WHERE user_feedback IS NOT NULL) as "总反馈数",
  COUNT(*) FILTER (WHERE user_feedback = 'accept') as "用户接受数",
  COUNT(*) FILTER (WHERE user_feedback = 'reject') as "用户拒绝数",
  COUNT(*) FILTER (WHERE user_feedback = 'modify') as "用户修改数",
  ROUND(
    COUNT(*) FILTER (WHERE user_feedback = 'accept')::numeric /
    NULLIF(COUNT(*) FILTER (WHERE user_feedback IS NOT NULL), 0) * 100, 2
  ) as "准确率(%)",
  ROUND(
    COUNT(*) FILTER (WHERE user_feedback IN ('reject', 'modify'))::numeric /
    NULLIF(COUNT(*) FILTER (WHERE user_feedback IS NOT NULL), 0) * 100, 2
  ) as "纠错率(%)"
FROM classification_metrics;

-- ============================================================================
-- 3. 按 Tier 分层的准确率
-- ============================================================================
SELECT '========== 3. 按 Tier 分层准确率 ==========' as section;

SELECT
  tier as "分层",
  CASE tier
    WHEN 0 THEN 'Inbox (未分类)'
    WHEN 1 THEN 'Tier1 (快速匹配)'
    WHEN 2 THEN 'Tier2 (AI 确认)'
    WHEN 3 THEN 'Tier3 (自动创建)'
  END as "分层说明",
  COUNT(*) as "总记录数",
  COUNT(*) FILTER (WHERE user_feedback IS NOT NULL) as "有反馈数",
  COUNT(*) FILTER (WHERE user_feedback = 'accept') as "接受数",
  ROUND(
    COUNT(*) FILTER (WHERE user_feedback = 'accept')::numeric /
    NULLIF(COUNT(*) FILTER (WHERE user_feedback IS NOT NULL), 0) * 100, 2
  ) as "准确率(%)"
FROM classification_metrics
GROUP BY tier
ORDER BY tier;

-- ============================================================================
-- 4. 按置信度区间的准确率（置信度校准）
-- ============================================================================
SELECT '========== 4. 置信度校准分析 ==========' as section;

SELECT
  CASE
    WHEN confidence >= 90 THEN '90-100 (高置信度)'
    WHEN confidence >= 70 THEN '70-89 (中置信度)'
    WHEN confidence >= 50 THEN '50-69 (低置信度)'
    ELSE '0-49 (极低置信度)'
  END as "置信度区间",
  COUNT(*) as "总记录数",
  COUNT(*) FILTER (WHERE user_feedback IS NOT NULL) as "有反馈数",
  COUNT(*) FILTER (WHERE user_feedback = 'accept') as "接受数",
  ROUND(
    COUNT(*) FILTER (WHERE user_feedback = 'accept')::numeric /
    NULLIF(COUNT(*) FILTER (WHERE user_feedback IS NOT NULL), 0) * 100, 2
  ) as "实际准确率(%)",
  ROUND(AVG(confidence), 2) as "平均置信度"
FROM classification_metrics
GROUP BY
  CASE
    WHEN confidence >= 90 THEN '90-100 (高置信度)'
    WHEN confidence >= 70 THEN '70-89 (中置信度)'
    WHEN confidence >= 50 THEN '50-69 (低置信度)'
    ELSE '0-49 (极低置信度)'
  END
ORDER BY "平均置信度" DESC;

-- ============================================================================
-- 5. AI 调用情况分析
-- ============================================================================
SELECT '========== 5. AI 调用分析 ==========' as section;

SELECT
  ai_called as "是否调用AI",
  COUNT(*) as "记录数",
  COUNT(*) FILTER (WHERE user_feedback IS NOT NULL) as "有反馈数",
  ROUND(
    COUNT(*) FILTER (WHERE user_feedback = 'accept')::numeric /
    NULLIF(COUNT(*) FILTER (WHERE user_feedback IS NOT NULL), 0) * 100, 2
  ) as "准确率(%)",
  ROUND(AVG(execution_time_ms), 2) as "平均耗时(ms)"
FROM classification_metrics
GROUP BY ai_called
ORDER BY ai_called;

-- ============================================================================
-- 6. 缓存命中分析
-- ============================================================================
SELECT '========== 6. 缓存命中分析 ==========' as section;

SELECT
  cache_hit as "缓存命中",
  COUNT(*) as "记录数",
  ROUND(COUNT(*)::numeric / (SELECT COUNT(*) FROM classification_metrics) * 100, 2) as "占比(%)",
  ROUND(
    COUNT(*) FILTER (WHERE user_feedback = 'accept')::numeric /
    NULLIF(COUNT(*) FILTER (WHERE user_feedback IS NOT NULL), 0) * 100, 2
  ) as "准确率(%)",
  ROUND(AVG(execution_time_ms), 2) as "平均耗时(ms)"
FROM classification_metrics
GROUP BY cache_hit;

-- ============================================================================
-- 7. 性能指标
-- ============================================================================
SELECT '========== 7. 性能指标 ==========' as section;

SELECT
  ROUND(AVG(execution_time_ms), 2) as "平均耗时(ms)",
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY execution_time_ms)::numeric, 2) as "P50耗时(ms)",
  ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY execution_time_ms)::numeric, 2) as "P95耗时(ms)",
  ROUND(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY execution_time_ms)::numeric, 2) as "P99耗时(ms)",
  MAX(execution_time_ms) as "最大耗时(ms)"
FROM classification_metrics;

-- ============================================================================
-- 8. 按文件夹的准确率 (Top 10 低准确率文件夹)
-- ============================================================================
SELECT '========== 8. 低准确率文件夹 Top 10 ==========' as section;

SELECT
  folder_name as "文件夹名称",
  COUNT(*) as "总分类数",
  COUNT(*) FILTER (WHERE user_feedback IS NOT NULL) as "有反馈数",
  COUNT(*) FILTER (WHERE user_feedback = 'accept') as "接受数",
  ROUND(
    COUNT(*) FILTER (WHERE user_feedback = 'accept')::numeric /
    NULLIF(COUNT(*) FILTER (WHERE user_feedback IS NOT NULL), 0) * 100, 2
  ) as "准确率(%)"
FROM classification_metrics
WHERE folder_name IS NOT NULL
GROUP BY folder_name
HAVING COUNT(*) FILTER (WHERE user_feedback IS NOT NULL) >= 3  -- 至少3条反馈
ORDER BY "准确率(%)" ASC NULLS LAST
LIMIT 10;

-- ============================================================================
-- 9. 近期趋势 (按周)
-- ============================================================================
SELECT '========== 9. 近期趋势 (按周) ==========' as section;

SELECT
  DATE_TRUNC('week', created_at)::date as "周",
  COUNT(*) as "分类数",
  COUNT(*) FILTER (WHERE user_feedback IS NOT NULL) as "反馈数",
  ROUND(
    COUNT(*) FILTER (WHERE user_feedback = 'accept')::numeric /
    NULLIF(COUNT(*) FILTER (WHERE user_feedback IS NOT NULL), 0) * 100, 2
  ) as "准确率(%)",
  ROUND(AVG(execution_time_ms), 2) as "平均耗时(ms)",
  ROUND(
    COUNT(*) FILTER (WHERE ai_called)::numeric / COUNT(*) * 100, 2
  ) as "AI调用率(%)"
FROM classification_metrics
GROUP BY DATE_TRUNC('week', created_at)
ORDER BY "周" DESC
LIMIT 8;

-- ============================================================================
-- 10. 失败案例分析 (最近的拒绝/修改)
-- ============================================================================
SELECT '========== 10. 最近失败案例 (Top 20) ==========' as section;

SELECT
  created_at::date as "日期",
  folder_name as "预测文件夹",
  confidence as "置信度",
  tier as "分层",
  user_feedback as "用户反馈",
  match_type as "匹配类型",
  LEFT(decision_reason, 50) as "决策原因(截断)"
FROM classification_metrics
WHERE user_feedback IN ('reject', 'modify')
ORDER BY created_at DESC
LIMIT 20;

-- ============================================================================
-- 11. V6.0 目标对比
-- ============================================================================
SELECT '========== 11. V5.1 vs V6.0 目标对比 ==========' as section;

WITH current_metrics AS (
  SELECT
    ROUND(
      COUNT(*) FILTER (WHERE user_feedback = 'accept')::numeric /
      NULLIF(COUNT(*) FILTER (WHERE user_feedback IS NOT NULL), 0) * 100, 2
    ) as accuracy,
    ROUND(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY execution_time_ms)::numeric, 2) as p99_latency,
    ROUND(
      COUNT(*) FILTER (WHERE NOT ai_called AND tier > 0)::numeric /
      NULLIF(COUNT(*) FILTER (WHERE tier > 0), 0) * 100, 2
    ) as l1_hit_rate,
    ROUND(
      COUNT(*) FILTER (WHERE user_feedback IN ('reject', 'modify'))::numeric /
      NULLIF(COUNT(*) FILTER (WHERE user_feedback IS NOT NULL), 0) * 100, 2
    ) as error_rate
  FROM classification_metrics
)
SELECT
  '准确率' as "指标",
  accuracy || '%' as "V5.1 当前值",
  '> 95%' as "V6.0 目标",
  CASE WHEN accuracy >= 95 THEN '✅ 达标' ELSE '❌ 未达标' END as "状态"
FROM current_metrics
UNION ALL
SELECT
  'P99延迟',
  p99_latency || 'ms',
  '< 50ms',
  CASE WHEN p99_latency <= 50 THEN '✅ 达标' ELSE '❌ 未达标' END
FROM current_metrics
UNION ALL
SELECT
  'L1命中率',
  COALESCE(l1_hit_rate || '%', 'N/A'),
  '≥ 70%',
  CASE WHEN l1_hit_rate >= 70 THEN '✅ 达标' ELSE '❌ 未达标' END
FROM current_metrics
UNION ALL
SELECT
  '用户纠错率',
  error_rate || '%',
  '< 5%',
  CASE WHEN error_rate <= 5 THEN '✅ 达标' ELSE '❌ 未达标' END
FROM current_metrics;
