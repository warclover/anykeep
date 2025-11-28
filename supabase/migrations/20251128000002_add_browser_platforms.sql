-- ===========================================
-- 添加浏览器书签平台类型
-- ===========================================
-- 版本: 1.0.0
-- 日期: 2025-11-28
-- 说明: 扩展 bookmarks 表的 platform 约束，支持浏览器书签导入

-- -------------------------------------------
-- 1. 修改 bookmarks 表的 platform 约束
-- -------------------------------------------

-- 删除旧的 CHECK 约束
ALTER TABLE public.bookmarks DROP CONSTRAINT IF EXISTS bookmarks_platform_check;

-- 添加新的 CHECK 约束，包含浏览器平台
ALTER TABLE public.bookmarks ADD CONSTRAINT bookmarks_platform_check
    CHECK (platform IN (
        -- 原有平台
        'WECHAT_OFFICIAL_ACCOUNT',
        'BILIBILI',
        'XIAOHONGSHU',
        'UNKNOWN',
        -- 新增浏览器平台
        'BROWSER_CHROME',
        'BROWSER_EDGE',
        'BROWSER_FIREFOX',
        'BROWSER_SAFARI'
    ));

-- -------------------------------------------
-- 2. 更新注释
-- -------------------------------------------

COMMENT ON COLUMN public.bookmarks.platform IS
    '来源平台: WECHAT_OFFICIAL_ACCOUNT, BILIBILI, XIAOHONGSHU, BROWSER_CHROME, BROWSER_EDGE, BROWSER_FIREFOX, BROWSER_SAFARI, UNKNOWN';

-- -------------------------------------------
-- 完成
-- -------------------------------------------
