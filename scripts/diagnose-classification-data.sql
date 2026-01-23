-- ============================================================================
-- 智能分类数据诊断脚本 (修正版)
-- 目的：找出实际可用于评估的数据
-- ============================================================================

-- 1. classification_metrics 表基本情况
SELECT '========== 1. classification_metrics 表状态 ==========' as section;

SELECT
  COUNT(*) as "总记录数",
  COUNT(DISTINCT user_id) as "用户数",
  COUNT(CASE WHEN user_feedback IS NOT NULL THEN 1 END) as "有反馈记录数",
  COUNT(CASE WHEN user_feedback = 'accept' THEN 1 END) as "accept数",
  COUNT(CASE WHEN user_feedback = 'reject' THEN 1 END) as "reject数",
  COUNT(CASE WHEN user_feedback = 'modify' THEN 1 END) as "modify数"
FROM classification_metrics;

-- 2. 查看最近的分类记录样本
SELECT '========== 2. 最近10条分类记录 ==========' as section;

SELECT
  id,
  created_at::date as "日期",
  action,
  folder_name,
  confidence,
  tier,
  user_feedback,
  ai_called
FROM classification_metrics
ORDER BY created_at DESC
LIMIT 10;

-- 3. 检查 bookmarks 表是否有分类信息
SELECT '========== 3. bookmarks 表分类情况 ==========' as section;

SELECT
  COUNT(*) as "总书签数",
  COUNT(CASE WHEN folder_id IS NOT NULL THEN 1 END) as "已分类数",
  COUNT(CASE WHEN folder_id IS NULL THEN 1 END) as "未分类数(Inbox)"
FROM bookmarks;

-- 4. 检查 folders 表情况
SELECT '========== 4. folders 表情况 ==========' as section;

SELECT
  COUNT(*) as "总文件夹数",
  COUNT(DISTINCT user_id) as "用户数"
FROM folders;

-- 5. 检查 classification_decisions 表 (用户反馈)
SELECT '========== 5. classification_decisions 用户反馈 ==========' as section;

SELECT
  COUNT(*) as "总记录数",
  COUNT(CASE WHEN user_action IS NOT NULL THEN 1 END) as "有反馈数",
  COUNT(CASE WHEN user_action = 'accepted' THEN 1 END) as "accepted",
  COUNT(CASE WHEN user_action = 'rejected' THEN 1 END) as "rejected",
  COUNT(CASE WHEN user_action = 'changed_folder' THEN 1 END) as "changed_folder",
  COUNT(CASE WHEN user_action = 'undo' THEN 1 END) as "undo"
FROM classification_decisions;

-- 6. 检查 classification_suggestions 表
SELECT '========== 6. classification_suggestions 建议状态 ==========' as section;

SELECT
  COUNT(*) as "总建议数",
  COUNT(CASE WHEN status = 'accepted' THEN 1 END) as "已接受",
  COUNT(CASE WHEN status = 'rejected' THEN 1 END) as "已拒绝",
  COUNT(CASE WHEN status = 'pending' THEN 1 END) as "待处理",
  COUNT(CASE WHEN status = 'expired' THEN 1 END) as "已过期"
FROM classification_suggestions;

-- 7. 如果 classification_decisions 有数据，计算准确率
SELECT '========== 7. 基于 classification_decisions 的准确率 ==========' as section;

SELECT
  COUNT(*) FILTER (WHERE user_action IS NOT NULL) as "总反馈数",
  COUNT(*) FILTER (WHERE user_action = 'accepted') as "用户接受",
  COUNT(*) FILTER (WHERE user_action IN ('rejected', 'changed_folder', 'undo')) as "用户拒绝/修改",
  ROUND(
    COUNT(*) FILTER (WHERE user_action = 'accepted')::numeric /
    NULLIF(COUNT(*) FILTER (WHERE user_action IS NOT NULL), 0) * 100, 2
  ) as "准确率(%)",
  ROUND(
    COUNT(*) FILTER (WHERE user_action IN ('rejected', 'changed_folder', 'undo'))::numeric /
    NULLIF(COUNT(*) FILTER (WHERE user_action IS NOT NULL), 0) * 100, 2
  ) as "纠错率(%)"
FROM classification_decisions;

-- 8. 如果 classification_suggestions 有数据，计算准确率
SELECT '========== 8. 基于 classification_suggestions 的准确率 ==========' as section;

SELECT
  COUNT(*) FILTER (WHERE status IN ('accepted', 'rejected')) as "总反馈数",
  COUNT(*) FILTER (WHERE status = 'accepted') as "用户接受",
  COUNT(*) FILTER (WHERE status = 'rejected') as "用户拒绝",
  ROUND(
    COUNT(*) FILTER (WHERE status = 'accepted')::numeric /
    NULLIF(COUNT(*) FILTER (WHERE status IN ('accepted', 'rejected')), 0) * 100, 2
  ) as "准确率(%)"
FROM classification_suggestions;

-- 9. 汇总可用评估数据
SELECT '========== 9. 可用评估数据汇总 ==========' as section;

WITH data_sources AS (
  SELECT 'classification_metrics.user_feedback' as source,
         COUNT(CASE WHEN user_feedback IS NOT NULL THEN 1 END) as count
  FROM classification_metrics
  UNION ALL
  SELECT 'classification_decisions.user_action',
         COUNT(CASE WHEN user_action IS NOT NULL THEN 1 END)
  FROM classification_decisions
  UNION ALL
  SELECT 'classification_suggestions.status',
         COUNT(CASE WHEN status IN ('accepted', 'rejected') THEN 1 END)
  FROM classification_suggestions
)
SELECT
  source as "数据源",
  count as "可用记录数",
  CASE WHEN count > 0 THEN '✅ 可用' ELSE '❌ 无数据' END as "状态"
FROM data_sources;
