-- ===========================================
-- 添加收藏评级和锁定功能
-- ===========================================
-- 版本: 1.0.0
-- 日期: 2025-12-02
-- 说明: 为 bookmarks 表添加 rating 和 is_locked 字段

-- -------------------------------------------
-- 1. 添加字段
-- -------------------------------------------

-- 添加评级字段（0-5星，0表示未评级）
ALTER TABLE public.bookmarks
ADD COLUMN IF NOT EXISTS rating INTEGER DEFAULT 0 CHECK (rating >= 0 AND rating <= 5);

-- 添加锁定字段（防止误删）
ALTER TABLE public.bookmarks
ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT false;

-- -------------------------------------------
-- 2. 添加注释
-- -------------------------------------------

COMMENT ON COLUMN public.bookmarks.rating IS '收藏评级: 0-未评级, 1-5星评级';
COMMENT ON COLUMN public.bookmarks.is_locked IS '是否锁定（锁定后无法删除）';

-- -------------------------------------------
-- 3. 创建索引（优化查询性能）
-- -------------------------------------------

-- 评级索引（用于按评级筛选和排序）
CREATE INDEX IF NOT EXISTS idx_bookmarks_rating ON public.bookmarks(rating)
  WHERE deleted_at IS NULL AND rating > 0;

-- 锁定状态索引（用于快速查询已锁定收藏）
CREATE INDEX IF NOT EXISTS idx_bookmarks_is_locked ON public.bookmarks(is_locked)
  WHERE deleted_at IS NULL AND is_locked = true;

-- -------------------------------------------
-- 4. RLS 策略验证
-- -------------------------------------------

-- 现有的 RLS 策略已经覆盖了这些字段：
-- - "Users can update own bookmarks" 允许用户更新自己的收藏（包括 rating 和 is_locked）
-- - "Users can delete own bookmarks" 需要在应用层检查 is_locked 状态

-- 无需额外的 RLS 策略，数据安全由现有策略保障

-- -------------------------------------------
-- 完成
-- -------------------------------------------

-- 迁移完成后，所有现有收藏的 rating 默认为 0，is_locked 默认为 false
