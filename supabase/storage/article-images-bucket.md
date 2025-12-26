# Supabase Storage Bucket: article-images

## Bucket Configuration

在 Supabase Dashboard 或通过 API 创建此 bucket：

### 基本设置

| 配置项                 | 值                                             | 说明                         |
| ---------------------- | ---------------------------------------------- | ---------------------------- |
| **Bucket Name**        | `article-images`                               | 存储微信文章图片             |
| **Public**             | `true`                                         | 允许公开访问（图片展示需要） |
| **File Size Limit**    | `5MB`                                          | 单张图片最大 5MB             |
| **Allowed MIME Types** | `image/jpeg, image/png, image/gif, image/webp` | 仅允许常见图片格式           |

### 文件路径结构

```
article-images/
└── wechat/
    └── {snapshot_id}/
        ├── {timestamp}_0.jpg
        ├── {timestamp}_1.png
        └── ...
```

### 创建命令 (Supabase CLI)

```bash
# 需要在 Supabase Dashboard 手动创建，或使用管理 API
```

### RLS 策略 (SQL)

```sql
-- 允许认证用户上传
CREATE POLICY "Users can upload article images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'article-images'
  AND (storage.foldername(name))[1] = 'wechat'
);

-- 允许公开读取
CREATE POLICY "Public can view article images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'article-images');

-- 允许用户删除自己的图片（通过快照关联）
CREATE POLICY "Users can delete own article images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'article-images'
  AND EXISTS (
    SELECT 1 FROM bookmark_snapshots bs
    WHERE bs.user_id = auth.uid()
      AND name LIKE 'wechat/' || bs.id || '/%'
  )
);
```

### 环境变量 (可选)

如果需要自定义 bucket 名称：

```env
WECHAT_ARTICLE_IMAGES_BUCKET=article-images
```

### 清理策略

建议配置定期清理任务：

- 删除关联快照已删除的图片
- 删除上传超过 24 小时但未关联的图片
