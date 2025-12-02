# RLS 策略修复操作指南

## 问题描述

DELETE API 因为 RLS 策略缺少 `WITH CHECK` 子句而失败，错误信息：

```
new row violates row-level security policy for table bookmarks (code 42501)
```

## 修复步骤

### 方法 1: Supabase Dashboard（推荐）

1. **打开 Supabase Dashboard**
   - 访问: https://supabase.com/dashboard
   - 选择项目: `anykeep` (guwtnzcumkqsdcwrmdta)

2. **打开 SQL Editor**
   - 左侧菜单 -> SQL Editor
   - 点击 "New query"

3. **复制并执行以下 SQL**

   ```sql
   -- Fix RLS UPDATE policy for bookmarks table
   -- Problem: Original policy missing WITH CHECK clause, causing soft deletes to fail

   -- Drop the incomplete UPDATE policy
   DROP POLICY IF EXISTS "Users can update own bookmarks" ON public.bookmarks;

   -- Recreate with both USING and WITH CHECK clauses
   CREATE POLICY "Users can update own bookmarks" ON public.bookmarks
       FOR UPDATE
       USING (auth.uid() = user_id)
       WITH CHECK (auth.uid() = user_id);
   ```

4. **点击 "Run" 按钮执行**

5. **验证结果**
   - 应该看到 "Success. No rows returned" 消息
   - 表示策略已成功更新

### 方法 2: 使用迁移文件

如果你有 Supabase CLI 访问权限：

```bash
# 复制迁移 SQL 到 Dashboard 的 SQL Editor
cat supabase/migrations/20251124000001_fix_bookmarks_update_policy.sql
```

## 修复原理

### 问题根源

原始的 UPDATE 策略：

```sql
CREATE POLICY "Users can update own bookmarks" ON public.bookmarks
    FOR UPDATE USING (auth.uid() = user_id);
```

**缺陷**: 只有 `USING` 子句，没有 `WITH CHECK` 子句

### 修复后的策略

```sql
CREATE POLICY "Users can update own bookmarks" ON public.bookmarks
    FOR UPDATE
    USING (auth.uid() = user_id)       -- 检查当前行的所有权
    WITH CHECK (auth.uid() = user_id);  -- 检查更新后行的所有权
```

**关键差异**:

- `USING`: 确定哪些行可以被更新（必须是用户自己的收藏）
- `WITH CHECK`: 验证更新后的行是否仍然满足策略（user_id 不能被改变）

### 为什么软删除会失败？

软删除通过 UPDATE 设置 `deleted_at` 字段：

```sql
UPDATE bookmarks
SET deleted_at = NOW()
WHERE id = ? AND user_id = ?
```

没有 `WITH CHECK` 时，PostgreSQL 无法验证更新后的行是否仍然符合 RLS 策略，因此抛出错误。

## 验证修复

执行 SQL 后，可以通过以下方式验证：

### 1. 查看策略配置

```sql
SELECT * FROM pg_policies WHERE tablename = 'bookmarks' AND policyname = 'Users can update own bookmarks';
```

应该看到 `with_check` 列不为空。

### 2. 测试 DELETE 功能

- 在应用中创建一个测试收藏
- 尝试删除该收藏
- 应该成功删除（软删除）

## 后续步骤

修复应用后：

1. ✅ 测试 DELETE API 功能
2. ✅ 验证软删除逻辑（`deleted_at` 正确设置）
3. ✅ 检查收藏列表不再显示已删除项
4. ✅ 验证存储统计正确更新
5. ❌ 删除临时文件：
   - `src/app/api/admin/apply-migration/route.ts`
   - `scripts/apply-rls-fix.ts`
   - `FIX_RLS_GUIDE.md`

## 参考资源

- [Supabase RLS 文档](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL Policy 文档](https://www.postgresql.org/docs/current/sql-createpolicy.html)
- [项目迁移文件](./supabase/migrations/20251124000001_fix_bookmarks_update_policy.sql)
