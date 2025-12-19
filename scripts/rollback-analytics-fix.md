# 数据页面一致性修复 - 回滚指南

> 创建时间：2024-12-19
> 适用版本：feature/interaction-upgrade-v4.2.26

---

## 一键回滚命令

### 回滚 Phase 1（代码修改）

```bash
# 回滚 AnalyticsService 和测试文件
git checkout HEAD~1 -- src/lib/analytics/analytics.service.ts
git checkout HEAD~1 -- src/lib/analytics/__tests__/analytics.service.test.ts
```

### 回滚 Phase 2（数据库视图）

```bash
# 方式 1：直接删除视图（推荐）
# 在 Supabase Studio SQL 编辑器中执行：
DROP VIEW IF EXISTS v_invalid_bookmarks;
DROP VIEW IF EXISTS v_trashed_bookmarks;
DROP VIEW IF EXISTS v_active_bookmarks;

# 方式 2：删除迁移文件并重置
rm supabase/migrations/20251219000001_create_bookmark_views.sql
npx supabase db reset  # 仅本地开发环境
```

### 完整回滚（Phase 1 + 2）

```bash
# 1. 回滚代码
git checkout HEAD~1 -- src/lib/analytics/analytics.service.ts
git checkout HEAD~1 -- src/lib/analytics/__tests__/analytics.service.test.ts

# 2. 删除迁移文件
rm supabase/migrations/20251219000001_create_bookmark_views.sql

# 3. 删除视图（如已部署）
# 在数据库中执行：
# DROP VIEW IF EXISTS v_invalid_bookmarks, v_trashed_bookmarks, v_active_bookmarks;
```

---

## 修改前原始代码备份

### 文件 1: analytics.service.ts (Line 116-129)

```typescript
// 原始代码 - fetchAllBookmarks 方法
private async fetchAllBookmarks(): Promise<Bookmark[]> {
  const { data, error } = await this.supabase
    .from("bookmarks")
    .select("*")
    .eq("user_id", this.userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch bookmarks: ${error.message}`);
  }

  return (data as Bookmark[]) || [];
}
```

### 修改内容

添加 `.eq("is_in_trash", false)` 条件

---

## 验证回滚成功

```bash
# 1. 检查代码是否回滚
git diff src/lib/analytics/analytics.service.ts

# 2. 运行测试确认功能正常
npm test -- --testPathPattern="analytics.service"

# 3. 启动开发服务器验证
npm run dev
```

---

## 联系方式

如有问题，请查看 git log 或联系开发团队。
