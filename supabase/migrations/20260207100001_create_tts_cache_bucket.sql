-- TTS 音频缓存 Storage Bucket
-- 用于缓存已合成的 TTS 音频，避免重复调用阿里云 API
--
-- @version 1.0.0
-- @since 2026-02-07

-- 创建 tts-cache bucket（如果不存在）
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tts-cache',
  'tts-cache',
  false,  -- 私有 bucket
  10485760,  -- 10MB 文件大小限制
  ARRAY['audio/mpeg', 'application/json']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- RLS 策略：用户只能访问自己的缓存文件
-- 路径格式：{userId}/{bookmarkId}/{filename}

-- 允许用户读取自己的缓存
CREATE POLICY "Users can read own TTS cache"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'tts-cache'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 允许用户上传到自己的目录
CREATE POLICY "Users can upload own TTS cache"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'tts-cache'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 允许用户更新自己的缓存（upsert）
CREATE POLICY "Users can update own TTS cache"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'tts-cache'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 允许用户删除自己的缓存
CREATE POLICY "Users can delete own TTS cache"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'tts-cache'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 添加注释
COMMENT ON POLICY "Users can read own TTS cache" ON storage.objects IS
  'TTS 缓存读取策略：用户只能读取自己目录下的音频文件';
COMMENT ON POLICY "Users can upload own TTS cache" ON storage.objects IS
  'TTS 缓存上传策略：用户只能上传到自己的目录';
COMMENT ON POLICY "Users can update own TTS cache" ON storage.objects IS
  'TTS 缓存更新策略：用户只能更新自己的缓存文件';
COMMENT ON POLICY "Users can delete own TTS cache" ON storage.objects IS
  'TTS 缓存删除策略：用户只能删除自己的缓存文件';
