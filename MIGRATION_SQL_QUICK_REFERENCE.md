# Migration SQL 快速参考

**用途**: 快速复制粘贴到 Supabase SQL Editor
**详细指南**: 查看 [MIGRATION_EXECUTION_GUIDE.md](MIGRATION_EXECUTION_GUIDE.md)

---

## 🔹 Migration 1: 批量减少存储函数

**复制以下代码并在 SQL Editor 中执行**:

```sql
-- ===========================================
-- 批量减少存储使用量函数
-- ===========================================
-- 版本: 1.0.0
-- 日期: 2025-11-24
-- 说明: 支持批量删除时一次性减少多个收藏的存储计数

-- 覆盖原有的 decrement_storage_used 函数，添加可选的 decrement_by 参数
CREATE OR REPLACE FUNCTION decrement_storage_used(
    target_user_id uuid,
    decrement_by integer DEFAULT 1
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.profiles
    SET storage_used = GREATEST(storage_used - decrement_by, 0),
        updated_at = NOW()
    WHERE id = target_user_id;
END;
$$;

COMMENT ON FUNCTION decrement_storage_used(uuid, integer) IS '减少用户存储使用量，支持批量减少';
```

**执行后预期**: ✅ "Success. No rows returned"

---

## 🔹 Migration 2: 性能优化索引

**复制以下代码并在 SQL Editor 中执行**:

```sql
-- ===========================================
-- 性能优化索引
-- ===========================================
-- 版本: 1.0.0
-- 日期: 2025-11-24
-- 说明: 优化收藏查询、筛选、搜索等核心功能的性能

-- -------------------------------------------
-- 1. 收藏表核心查询索引
-- -------------------------------------------

-- 用户收藏列表查询（按创建时间倒序）
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_active_created
ON bookmarks (user_id, created_at DESC)
WHERE deleted_at IS NULL;

-- 平台筛选查询
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_platform
ON bookmarks (user_id, platform)
WHERE deleted_at IS NULL;

-- 文件夹筛选查询
CREATE INDEX IF NOT EXISTS idx_bookmarks_folder
ON bookmarks (folder_id)
WHERE deleted_at IS NULL;

-- -------------------------------------------
-- 2. 全文搜索索引（GIN 索引）
-- -------------------------------------------

-- 标题全文搜索（使用三元组）
CREATE INDEX IF NOT EXISTS idx_bookmarks_title_trgm
ON bookmarks USING GIN (title extensions.gin_trgm_ops);

-- 描述全文搜索（使用三元组）
CREATE INDEX IF NOT EXISTS idx_bookmarks_description_trgm
ON bookmarks USING GIN (description extensions.gin_trgm_ops);

-- -------------------------------------------
-- 3. 用户标签索引（GIN 索引）
-- -------------------------------------------

-- 用户标签数组索引
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_tags
ON bookmarks USING GIN (user_tags);

-- AI 标签数组索引
CREATE INDEX IF NOT EXISTS idx_bookmarks_ai_tags
ON bookmarks USING GIN (ai_tags);

-- -------------------------------------------
-- 4. 复合索引（优化特定查询组合）
-- -------------------------------------------

-- 用户 + 平台 + 创建时间
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_platform_created
ON bookmarks (user_id, platform, created_at DESC)
WHERE deleted_at IS NULL;

-- 用户 + 文件夹 + 创建时间
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_folder_created
ON bookmarks (user_id, folder_id, created_at DESC)
WHERE deleted_at IS NULL;

-- -------------------------------------------
-- 5. 统计分析索引
-- -------------------------------------------

-- 按平台统计
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_platform_count
ON bookmarks (user_id, platform)
WHERE deleted_at IS NULL;

-- 按日期统计（已移除 - 可以直接使用 created_at 查询）
-- CREATE INDEX IF NOT EXISTS idx_bookmarks_user_created_date
-- ON bookmarks (user_id, DATE(created_at))
-- WHERE deleted_at IS NULL;

-- -------------------------------------------
-- 注释和说明
-- -------------------------------------------

COMMENT ON INDEX idx_bookmarks_user_active_created IS '优化用户收藏列表查询（按创建时间倒序）';
COMMENT ON INDEX idx_bookmarks_user_platform IS '优化平台筛选查询';
COMMENT ON INDEX idx_bookmarks_folder IS '优化文件夹收藏查询';
COMMENT ON INDEX idx_bookmarks_title_trgm IS '优化标题全文搜索（三元组索引）';
COMMENT ON INDEX idx_bookmarks_description_trgm IS '优化描述全文搜索（三元组索引）';
COMMENT ON INDEX idx_bookmarks_user_tags IS '优化用户标签筛选';
COMMENT ON INDEX idx_bookmarks_ai_tags IS '优化 AI 标签筛选';
COMMENT ON INDEX idx_bookmarks_user_platform_created IS '优化用户+平台+时间组合查询';
COMMENT ON INDEX idx_bookmarks_user_folder_created IS '优化用户+文件夹+时间组合查询';
COMMENT ON INDEX idx_bookmarks_user_platform_count IS '优化平台统计查询';
-- COMMENT ON INDEX idx_bookmarks_user_created_date IS '优化日期趋势统计'; -- 已移除
```

**执行后预期**: ✅ "Success. No rows returned"（可能需要 2-10 秒）

---

## 🔍 验证查询

### 验证索引已创建

```sql
-- 查看所有索引
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'bookmarks'
ORDER BY indexname;
```

**预期结果**: 应该看到 10 个以 `idx_bookmarks_` 开头的索引

---

### 验证函数已更新

```sql
-- 查看函数详情
SELECT
    routine_name,
    routine_definition
FROM information_schema.routines
WHERE routine_name = 'decrement_storage_used'
AND routine_schema = 'public';
```

**预期结果**: 函数定义中应包含 `decrement_by integer DEFAULT 1`

---

### 测试索引性能

```sql
-- 查看查询计划（替换为你的用户 ID）
EXPLAIN ANALYZE
SELECT * FROM bookmarks
WHERE user_id = 'your-user-id-here'
AND deleted_at IS NULL
ORDER BY created_at DESC
LIMIT 50;
```

**预期结果**:
- 查询计划包含 `Index Scan using idx_bookmarks_user_active_created`
- 执行时间 < 10ms

---

## ⚠️ 常见错误及解决

### 错误 1: `extension gin_trgm_ops does not exist`

**解决**: 先执行以下 SQL

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;
```

然后重新执行 Migration 2

---

### 错误 2: `permission denied for schema public`

**解决**: 确保在 Supabase Dashboard 的 SQL Editor 中执行（而不是使用 anon key）

---

## 📊 执行清单

- [ ] ✅ 执行 Migration 1 成功
- [ ] ✅ 执行 Migration 2 成功
- [ ] ✅ 验证索引已创建（10 个）
- [ ] ✅ 验证函数已更新
- [ ] ✅ 测试批量删除功能
- [ ] ✅ 观察性能提升

---

## 📖 相关文档

- 📘 [MIGRATION_EXECUTION_GUIDE.md](MIGRATION_EXECUTION_GUIDE.md) - 详细执行指南（含截图）
- 📊 [PHASE1_COMPLETION_REPORT.md](PHASE1_COMPLETION_REPORT.md) - Phase 1 完成报告
- 📝 [WORK_SUMMARY.md](WORK_SUMMARY.md) - 工作总结

---

**快速参考 | 更新时间: 2025-11-24**
