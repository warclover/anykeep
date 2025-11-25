/**
 * Supabase Storage Buckets 配置
 * 创建用于存储用户上传文件的 bucket
 */

-- 1. 创建 covers bucket（用于存储收藏的封面图）
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'covers',
  'covers',
  true,  -- 公开访问
  5242880,  -- 5MB 限制
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- 2. 创建 avatars bucket（用于存储用户头像）
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  2097152,  -- 2MB 限制
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- 3. 设置 covers bucket 的 RLS 策略
-- 允许认证用户上传文件
CREATE POLICY "Authenticated users can upload covers"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'covers' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- 允许所有人读取公开的封面图
CREATE POLICY "Public covers are accessible"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'covers');

-- 允许用户删除自己上传的封面图
CREATE POLICY "Users can delete their own covers"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'covers' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- 4. 设置 avatars bucket 的 RLS 策略
-- 允许认证用户上传头像
CREATE POLICY "Authenticated users can upload avatars"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- 允许所有人读取公开的头像
CREATE POLICY "Public avatars are accessible"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'avatars');

-- 允许用户更新自己的头像
CREATE POLICY "Users can update their own avatars"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- 允许用户删除自己的头像
CREATE POLICY "Users can delete their own avatars"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
