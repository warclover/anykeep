-- ============================================================================
-- 检查评估数据质量
-- 目的：确认书签数据是真实用户数据还是测试数据
-- ============================================================================

-- 1. 查看各用户的书签数量和分布
SELECT '========== 1. 各用户书签概况 ==========' as section;

SELECT
  b.user_id,
  COUNT(*) as total_bookmarks,
  COUNT(CASE WHEN b.folder_id IS NOT NULL THEN 1 END) as classified,
  COUNT(DISTINCT b.folder_id) as folder_count,
  COUNT(DISTINCT b.platform) as platform_count,
  MIN(b.created_at)::date as first_bookmark,
  MAX(b.created_at)::date as last_bookmark
FROM bookmarks b
WHERE b.user_id IN (
  SELECT DISTINCT user_id FROM classification_folder_profiles_v5
)
GROUP BY b.user_id
ORDER BY total_bookmarks DESC;

-- 2. 查看书签标题样本（检查是否像测试数据）
SELECT '========== 2. 书签标题样本（按用户分组）==========' as section;

SELECT
  b.user_id,
  b.title,
  f.name as folder_name,
  b.platform,
  LENGTH(b.title) as title_length,
  b.url
FROM bookmarks b
LEFT JOIN folders f ON b.folder_id = f.id
WHERE b.user_id IN (
  SELECT DISTINCT user_id FROM classification_folder_profiles_v5
)
AND b.folder_id IS NOT NULL
ORDER BY b.user_id, b.created_at DESC
LIMIT 50;

-- 3. 检查标题模式（是否有测试数据特征）
SELECT '========== 3. 标题模式分析 ==========' as section;

SELECT
  b.user_id,
  COUNT(*) as total,
  COUNT(CASE WHEN LENGTH(b.title) < 10 THEN 1 END) as very_short_titles,
  COUNT(CASE WHEN b.title ~ '^[\u4e00-\u9fa5]+\s[\u4e00-\u9fa5]+\s[\u4e00-\u9fa5]+$' THEN 1 END) as three_word_pattern,
  COUNT(CASE WHEN b.url LIKE '%mp.weixin.qq.com%' THEN 1 END) as wechat_articles,
  COUNT(CASE WHEN b.url LIKE '%bilibili.com%' THEN 1 END) as bilibili_videos,
  COUNT(CASE WHEN b.url LIKE '%github.com%' THEN 1 END) as github_repos
FROM bookmarks b
WHERE b.user_id IN (
  SELECT DISTINCT user_id FROM classification_folder_profiles_v5
)
GROUP BY b.user_id;

-- 4. 查看实际的文件夹分布
SELECT '========== 4. 文件夹分布（按用户）==========' as section;

SELECT
  b.user_id,
  f.name as folder_name,
  COUNT(*) as bookmark_count
FROM bookmarks b
JOIN folders f ON b.folder_id = f.id
WHERE b.user_id IN (
  SELECT DISTINCT user_id FROM classification_folder_profiles_v5
)
GROUP BY b.user_id, f.name
ORDER BY b.user_id, bookmark_count DESC;

-- 5. 检查可疑的分类（如 Vue 内容被分到 React 文件夹）
SELECT '========== 5. 可疑分类检查 ==========' as section;

SELECT
  b.id,
  b.title,
  f.name as folder_name,
  b.user_id,
  CASE
    WHEN b.title ILIKE '%vue%' AND f.name ILIKE '%react%' THEN '⚠️ Vue→React'
    WHEN b.title ILIKE '%angular%' AND f.name ILIKE '%react%' THEN '⚠️ Angular→React'
    WHEN b.title ILIKE '%java%' AND f.name ILIKE '%node%' THEN '⚠️ Java→Node'
    WHEN b.title ILIKE '%python%' AND f.name ILIKE '%node%' THEN '⚠️ Python→Node'
    ELSE 'OK'
  END as mismatch_check
FROM bookmarks b
JOIN folders f ON b.folder_id = f.id
WHERE b.user_id IN (
  SELECT DISTINCT user_id FROM classification_folder_profiles_v5
)
AND (
  (b.title ILIKE '%vue%' AND f.name ILIKE '%react%')
  OR (b.title ILIKE '%angular%' AND f.name ILIKE '%react%')
  OR (b.title ILIKE '%java%' AND f.name ILIKE '%node%')
  OR (b.title ILIKE '%python%' AND f.name ILIKE '%node%')
)
LIMIT 20;
