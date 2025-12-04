-- 修复平台检测问题：将被错误标记为 UNKNOWN 的微信收藏更正为 WECHAT_OFFICIAL_ACCOUNT
-- 问题原因：之前的检测逻辑只支持 mp.weixin.qq.com，遗漏了其他微信域名变种
-- 修复日期：2025-12-04

-- 修复被错误标记为 UNKNOWN 但 URL 包含微信域名的收藏
UPDATE bookmarks
SET
  platform = 'WECHAT_OFFICIAL_ACCOUNT',
  updated_at = NOW()
WHERE
  platform = 'UNKNOWN'
  AND (
    url LIKE '%weixin.qq.com%'
    OR url LIKE '%mp.weixin.qq.com%'
  );

-- 记录修复的数量（可选，用于调试）
DO $$
DECLARE
  affected_count INTEGER;
BEGIN
  GET DIAGNOSTICS affected_count = ROW_COUNT;
  RAISE NOTICE '已修复 % 条微信收藏的平台标签', affected_count;
END $$;
