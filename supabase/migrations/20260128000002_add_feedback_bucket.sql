-- 初始化反馈附件存储桶
-- 注意：需要启用 storage 扩展（通常默认启用）

-- 1. 创建存储桶 (如果不存在)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'feedback-attachments',
  'feedback-attachments',
  true,
  5242880, -- 5MB limit (5 * 1024 * 1024)
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']::text[];

-- 2. 策略：允许认证用户上传文件到 feedback-attachments
-- 限制用户只能上传到自己的目录 (user_id/*)
-- 注意：storage.objects 默认已启用 RLS，无需手动 ALTER TABLE
CREATE POLICY "Users can upload feedback attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'feedback-attachments' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- 4. 策略：允许公开查看 feedback-attachments 中的文件
-- 因为我们将 bucket 设为 public，所以可以通过 public URL 访问
-- 但如果使用 supabase.storage.download()，则需要 SELECT 权限
CREATE POLICY "Public can view feedback attachments"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'feedback-attachments');

-- 5. 策略：允许用户删除自己的文件
CREATE POLICY "Users can delete own feedback attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'feedback-attachments' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
