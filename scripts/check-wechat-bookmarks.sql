-- ============================================================================
-- 检查微信收藏数据情况
-- 目的：确认可用于评估的已分类书签数量
-- ============================================================================

-- 1. 检查微信平台书签总量
SELECT '========== 1. 微信收藏数据概况 ==========' as section;

SELECT
  COUNT(*) as "总书签数",
  COUNT(CASE WHEN folder_id IS NOT NULL THEN 1 END) as "已分类数",
  COUNT(CASE WHEN folder_id IS NULL THEN 1 END) as "未分类数(Inbox)",
  COUNT(DISTINCT folder_id) as "涉及文件夹数"
FROM bookmarks
WHERE platform = 'wechat' OR url LIKE '%mp.weixin.qq.com%';

-- 2. 检查所有平台的已分类书签
SELECT '========== 2. 各平台已分类书签数 ==========' as section;

SELECT
  COALESCE(platform, '未知平台') as "平台",
  COUNT(*) as "总数",
  COUNT(CASE WHEN folder_id IS NOT NULL THEN 1 END) as "已分类",
  COUNT(CASE WHEN folder_id IS NULL THEN 1 END) as "未分类"
FROM bookmarks
GROUP BY platform
ORDER BY "已分类" DESC;

-- 3. 已分类书签的文件夹分布 (Top 10)
SELECT '========== 3. 文件夹分布 (Top 10) ==========' as section;

SELECT
  f.name as "文件夹名称",
  COUNT(b.id) as "书签数"
FROM bookmarks b
JOIN folders f ON b.folder_id = f.id
WHERE b.folder_id IS NOT NULL
GROUP BY f.id, f.name
ORDER BY "书签数" DESC
LIMIT 10;

-- 4. 可用于评估的样本数据预览
SELECT '========== 4. 样本数据预览 (前10条已分类微信书签) ==========' as section;

SELECT
  b.id,
  LEFT(b.title, 40) as "标题(截断)",
  f.name as "当前文件夹",
  b.platform,
  b.created_at::date as "创建日期"
FROM bookmarks b
JOIN folders f ON b.folder_id = f.id
WHERE (b.platform = 'wechat' OR b.url LIKE '%mp.weixin.qq.com%')
  AND b.folder_id IS NOT NULL
ORDER BY b.created_at DESC
LIMIT 10;

-- 5. 统计汇总
SELECT '========== 5. 评估可行性汇总 ==========' as section;

SELECT
  '可用于评估的已分类书签' as "指标",
  COUNT(*) as "数量",
  CASE
    WHEN COUNT(*) >= 100 THEN '✅ 充足 (可进行可靠评估)'
    WHEN COUNT(*) >= 50 THEN '⚠️ 中等 (可进行初步评估)'
    WHEN COUNT(*) >= 20 THEN '⚠️ 较少 (评估结果参考性有限)'
    ELSE '❌ 不足 (需要更多数据)'
  END as "状态"
FROM bookmarks
WHERE folder_id IS NOT NULL;
