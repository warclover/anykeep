-- =============================================================================
-- Migration: article-images Storage RLS Policies
-- Description: 微信文章图片存储 RLS 策略（Bucket 需通过 Dashboard 创建）
-- Version: V4.2.2
-- Date: 2025-12-21
-- =============================================================================

-- 注意：Storage Bucket 必须通过 Supabase Dashboard 创建
-- Dashboard -> Storage -> New Bucket:
--   Name: article-images
--   Public: true
--   File size limit: 5242880 (5MB)
--   Allowed MIME types: image/jpeg, image/png, image/gif, image/webp

-- -----------------------------------------------------------------------------
-- RLS 策略
-- -----------------------------------------------------------------------------

-- 删除已存在的策略（避免冲突）
DROP POLICY IF EXISTS "Users can upload article images" ON storage.objects;
DROP POLICY IF EXISTS "Public can view article images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own article images" ON storage.objects;
DROP POLICY IF EXISTS "Service role full access to article images" ON storage.objects;

-- 允许认证用户上传图片
CREATE POLICY "Users can upload article images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'article-images'
    AND (storage.foldername(name))[1] = 'wechat'
);

-- 允许公开读取图片
CREATE POLICY "Public can view article images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'article-images');

-- 允许 Service Role 完全访问（用于后端服务）
CREATE POLICY "Service role full access to article images"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'article-images')
WITH CHECK (bucket_id = 'article-images');

-- 允许用户删除自己上传的图片（通过快照关联验证）
CREATE POLICY "Users can delete own article images"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'article-images'
    AND EXISTS (
        SELECT 1 FROM bookmark_snapshots bs
        WHERE bs.user_id = auth.uid()
          AND name LIKE 'wechat/' || bs.id::text || '/%'
    )
);
