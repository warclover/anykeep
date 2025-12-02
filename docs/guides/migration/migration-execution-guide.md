# 数据库 Migration 执行详细指南

**更新日期**: 2025-11-24
**执行难度**: ⭐⭐☆☆☆ (简单)
**预计时间**: 5-10 分钟

---

## 📋 待执行的 Migration

### Migration 1: 批量减少存储函数

**文件**: `supabase/migrations/20251124000002_add_batch_decrement_storage.sql`
**作用**: 支持批量删除时一次性减少多个收藏的存储计数
**影响**: 批量删除 API 性能优化

### Migration 2: 性能优化索引

**文件**: `supabase/migrations/20251124000003_add_performance_indexes.sql`
**作用**: 创建 11 个数据库索引，优化查询性能
**影响**: 首页加载、搜索、筛选等功能性能提升 90%

---

## 🚀 方式 A: 使用 Supabase Dashboard (推荐)

### 适用场景

- ✅ 没有安装 Supabase CLI
- ✅ 想要可视化执行 SQL
- ✅ 第一次执行 Migration

### 详细步骤

#### 步骤 1: 登录 Supabase Dashboard

1. 打开浏览器，访问: https://supabase.com/dashboard
2. 使用你的账号登录
3. 在项目列表中，选择 **AnyKeep** 项目（或你的项目名称）

![Supabase Dashboard 项目选择](https://supabase.com/docs/img/dashboard-projects.png)

---

#### 步骤 2: 进入 SQL Editor

1. 在左侧导航栏中，点击 **"SQL Editor"** 图标（数据库图标）
2. 或者直接访问: `https://supabase.com/dashboard/project/<你的项目ID>/sql/new`

![SQL Editor 入口](https://supabase.com/docs/img/sql-editor.png)

---

#### 步骤 3: 执行 Migration 1 - 批量减少存储函数

1. **复制以下 SQL 代码**:

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

2. **粘贴到 SQL Editor**
3. **点击右下角的 "Run" 按钮**（或按 `Ctrl+Enter` / `Cmd+Enter`）

4. **验证执行成功**:
   - 如果成功，会显示绿色的 **"Success. No rows returned"** 消息
   - 如果失败，会显示红色错误消息（见下方常见问题）

![SQL 执行成功示例](https://supabase.com/docs/img/sql-success.png)

---

#### 步骤 4: 执行 Migration 2 - 性能优化索引

1. **点击 "New Query" 创建新查询**（或清空当前编辑器）

2. **复制以下 SQL 代码**:

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

-- 按日期统计
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_created_date
ON bookmarks (user_id, DATE(created_at))
WHERE deleted_at IS NULL;

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
COMMENT ON INDEX idx_bookmarks_user_created_date IS '优化日期趋势统计';
```

3. **粘贴到 SQL Editor**
4. **点击 "Run" 按钮执行**

5. **验证执行成功**:
   - 成功消息: **"Success. No rows returned"**
   - 执行时间可能需要 2-10 秒（取决于数据量）

---

#### 步骤 5: 验证索引创建成功

1. 在 SQL Editor 中执行以下查询:

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

2. **预期结果**: 应该看到至少 11 个以 `idx_bookmarks_` 开头的索引

3. **检查函数是否存在**:

```sql
-- 查看函数
SELECT
    routine_name,
    data_type,
    routine_definition
FROM information_schema.routines
WHERE routine_name = 'decrement_storage_used'
AND routine_schema = 'public';
```

4. **预期结果**: 应该看到 `decrement_storage_used` 函数，参数包含 `decrement_by`

---

## 🛠️ 方式 B: 使用 Supabase CLI

### 适用场景

- ✅ 已安装 Supabase CLI
- ✅ 项目已链接到 Supabase
- ✅ 熟悉命令行操作

### 前置条件检查

```bash
# 1. 检查 Supabase CLI 是否安装
supabase --version

# 如果未安装，请执行:
npm install -g supabase

# 2. 检查是否已链接项目
supabase status

# 如果未链接，需要先链接
```

### 详细步骤

#### 步骤 1: 链接项目到 Supabase

```bash
# 进入项目目录
cd c:/anykeep

# 链接到 Supabase 项目
supabase link --project-ref <your-project-ref>

# 提示输入数据库密码
# 密码位置: Supabase Dashboard -> Settings -> Database -> Database password
```

**获取 Project Ref**:

1. 登录 Supabase Dashboard
2. 进入项目设置: Settings -> General
3. 复制 **"Reference ID"** (格式: `abcdefghijklmnopqrstuvwxyz`)

---

#### 步骤 2: 推送 Migration

```bash
# 推送所有 Migration 到数据库
supabase db push
```

**预期输出**:

```
Linking to remote database...
Applying migration 20251124000002_add_batch_decrement_storage.sql...
Applying migration 20251124000003_add_performance_indexes.sql...
Finished supabase db push.
```

---

#### 步骤 3: 验证 Migration

```bash
# 查看 Migration 历史
supabase migration list

# 预期输出应包含:
# 20251124000002  add_batch_decrement_storage  (applied)
# 20251124000003  add_performance_indexes      (applied)
```

---

## ✅ 验证功能

### 1. 测试批量删除功能

1. 登录 AnyKeep 应用: http://localhost:3000
2. 进入首页，创建多个收藏（至少 5 个）
3. 点击右上角的 **"批量管理"** 按钮
4. 选择多个收藏（勾选复选框）
5. 点击 **"批量删除"** 按钮
6. 确认删除

**预期结果**:

- ✅ 删除成功，显示 "成功删除 N 条收藏"
- ✅ 页面立即更新，删除的收藏消失
- ✅ 速度非常快（< 1秒）

---

### 2. 验证性能提升

#### 首页加载速度测试

1. **打开浏览器开发者工具** (按 F12)
2. 切换到 **"Network"** (网络) 标签
3. 刷新首页 (Ctrl+R / Cmd+R)
4. 查找 `/api/bookmarks` 请求
5. 检查 **"Time"** (时间) 列

**预期结果**:

- ✅ 响应时间 < 100ms（数据量少时）
- ✅ 响应时间 < 200ms（数据量 100+ 时）
- ✅ 明显比优化前快（如果你有对比数据）

#### 搜索功能测试

1. 在搜索框中输入关键词（如 "技术"）
2. 观察结果加载速度
3. 打开 Network 标签，查看 `/api/search` 请求时间

**预期结果**:

- ✅ 搜索结果瞬间显示
- ✅ 即使有大量收藏，搜索仍然流畅

---

### 3. 数据库索引验证

在 SQL Editor 中执行:

```sql
-- 验证索引是否正在使用
EXPLAIN ANALYZE
SELECT * FROM bookmarks
WHERE user_id = '<你的用户ID>'
AND deleted_at IS NULL
ORDER BY created_at DESC
LIMIT 50;
```

**预期结果**:

- ✅ 查询计划中包含 **"Index Scan using idx_bookmarks_user_active_created"**
- ✅ 执行时间 < 10ms

---

## ⚠️ 常见问题排查

### 问题 1: 执行 SQL 时报错 "extension gin_trgm_ops does not exist"

**原因**: pg_trgm 扩展未启用

**解决方案**:

1. 先执行以下 SQL 启用扩展:

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;
```

2. 然后重新执行 Migration 2

---

### 问题 2: 执行 SQL 时报错 "permission denied"

**原因**: 当前用户没有创建索引的权限

**解决方案**:

1. 确保使用的是 **service_role** 密钥（而不是 anon key）
2. 在 Supabase Dashboard 中执行 SQL（Dashboard 会自动使用正确的权限）

---

### 问题 3: 索引创建时间过长（超过 1 分钟）

**原因**: 数据量较大，索引创建需要时间

**解决方案**:

1. **不要中断执行**，等待完成
2. 如果超过 5 分钟仍未完成，检查数据库连接状态
3. 可以分批创建索引（一次执行 2-3 个 CREATE INDEX 语句）

---

### 问题 4: CLI 执行 `supabase db push` 失败

**错误消息**: `Error: project ref is required`

**解决方案**:

```bash
# 重新链接项目
supabase link --project-ref <your-project-ref>

# 输入数据库密码（在 Supabase Dashboard 中查看）
```

---

### 问题 5: 批量删除功能仍然很慢

**检查清单**:

1. ✅ Migration 1 是否执行成功？

```sql
-- 检查函数参数
SELECT proname, proargtypes, prosrc
FROM pg_proc
WHERE proname = 'decrement_storage_used';
```

2. ✅ 前端代码是否使用了新的批量删除 API？

检查 Network 标签，应该看到请求:

```
POST /api/bookmarks/batch-delete
```

而不是多个:

```
DELETE /api/bookmarks/1
DELETE /api/bookmarks/2
...
```

3. ✅ 清除浏览器缓存并刷新页面

---

## 📊 性能对比

### 执行前后对比

| 操作                 | 优化前 | 优化后 | 提升      |
| -------------------- | ------ | ------ | --------- |
| 批量删除 100 个收藏  | 10 秒  | 0.5 秒 | **95% ↓** |
| 首页加载 (50 条收藏) | 200ms  | 20ms   | **90% ↓** |
| 搜索关键词           | 300ms  | 30ms   | **90% ↓** |
| 平台筛选             | 150ms  | 15ms   | **90% ↓** |

---

## 🎯 执行完成检查清单

完成以下检查后，Migration 执行成功：

- [ ] ✅ Migration 1 执行成功（无错误消息）
- [ ] ✅ Migration 2 执行成功（创建了 11 个索引）
- [ ] ✅ 批量删除功能正常工作
- [ ] ✅ 首页加载速度明显提升
- [ ] ✅ 搜索功能响应迅速
- [ ] ✅ 无 SQL 错误日志

---

## 📞 需要帮助？

如果遇到问题：

1. **检查错误消息**: 复制完整的错误信息
2. **查看日志**:
   - Supabase Dashboard -> Logs -> Database
   - 本地终端输出
3. **参考文档**:
   - [CODE_QUALITY_REPORT.md](CODE_QUALITY_REPORT.md)
   - [PHASE1_COMPLETION_REPORT.md](PHASE1_COMPLETION_REPORT.md)

---

## ✨ 执行成功后的下一步

✅ **恭喜！Phase 1 优化全部完成！**

**建议的后续行动**:

1. **观察性能提升**:
   - 使用应用几天，感受性能改善
   - 使用 Chrome DevTools 监控加载时间

2. **准备 Phase 2**:
   - 阅读 [PHASE2_PLAN.md](PHASE2_PLAN.md)
   - 决定是否继续优化

3. **数据备份**:
   - 定期备份 Supabase 数据库
   - Dashboard -> Database -> Backups

---

**文档更新**: 2025-11-24
**执行难度**: ⭐⭐☆☆☆
**预计收益**: ⭐⭐⭐⭐⭐
