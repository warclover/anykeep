# AnyKeep 项目全局功能检查报告

**生成日期**: 2025-12-17
**项目版本**: feature/classification-v4.2
**检查范围**: API 路由、数据库 Schema、类型定义、RLS 策略

---

## 📊 项目概览

| 指标            | 数量       |
| --------------- | ---------- |
| API 路由        | 158 个     |
| 数据库迁移      | 95 个      |
| 数据库表        | 44 个      |
| TypeScript 文件 | ~169 个    |
| 代码行数        | ~33,451 行 |

---

## ✅ 检查通过项

### 1. 数据库 RLS 策略完整性

**状态**: ✅ 通过

所有 44 个数据库表均已启用 Row Level Security (RLS)：

- 核心表: `profiles`, `folders`, `bookmarks`, `md_collections`
- 功能表: `messages`, `smart_lists`, `classification_decisions` 等
- 系统表: `job_queue`, `classification_config_audit` 等

### 2. 平台类型约束

**状态**: ✅ 通过

`bookmarks.platform` 字段约束已正确更新，支持：

- 原有平台: `WECHAT_OFFICIAL_ACCOUNT`, `BILIBILI`, `XIAOHONGSHU`, `UNKNOWN`
- 浏览器平台: `BROWSER_CHROME`, `BROWSER_EDGE`, `BROWSER_FIREFOX`, `BROWSER_SAFARI`

### 3. API 认证机制

**状态**: ✅ 通过

抽查的 API 路由均包含正确的认证检查：

```typescript
const {
  data: { user },
  error: authError,
} = await supabase.auth.getUser();
if (authError || !user) {
  return unauthorizedError();
}
```

### 4. 数据验证 Schema

**状态**: ✅ 通过

使用 Zod 进行输入验证，覆盖所有关键 API：

- `createBookmarkSchema` - 创建收藏
- `createMdCollectionSchema` - 创建 MD 收藏
- `getBookmarksQuerySchema` - 查询参数
- 其他 15+ 验证 Schema

---

## ⚠️ 需要关注的问题

### 1. Supabase 类型定义未更新 (中优先级)

**文件**: `src/types/supabase.ts`

**问题**: `md_collections` 表未在生成的类型文件中定义

**影响**:

- 使用 Supabase 客户端查询 `md_collections` 表时无类型提示
- 可能导致运行时错误

**建议修复**:

```bash
npx supabase gen types typescript --local > src/types/supabase.ts
```

### 2. React Hooks 规范违规 (高优先级)

**文件**: `src/components/messages/folder-selector-dialog.tsx:145`

**问题**: 在渲染期间访问/更新 ref

```typescript
// ❌ 错误：渲染期间访问 ref
if (open && !prevOpenRef.current) {
  setSelectedId(currentFolderId ?? null);
}
prevOpenRef.current = open;
```

**建议修复**:

```typescript
// ✅ 正确：使用 useEffect
useEffect(() => {
  if (open) {
    setSelectedId(currentFolderId ?? null);
    setSearchQuery("");
    setNewFolderName("");
  }
}, [open, currentFolderId]);
```

### 3. Next.js Image 优化建议 (低优先级)

**文件**: `src/features/md-collections/components/md-renderer.tsx:335`

**问题**: 使用原生 `<img>` 标签
**建议**: 考虑使用 `next/image` 组件优化图片加载

### 4. 空函数警告 (低优先级)

**文件**: `src/lib/utils/api-health.ts:95`

**问题**: `onStatusChange` 方法为空
**建议**: 添加默认实现或移除

---

## 🔍 数据一致性检查

### 前后端类型映射

| 数据库字段                         | TypeScript 类型      | 状态    |
| ---------------------------------- | -------------------- | ------- |
| `bookmarks.platform`               | `string`             | ✅ 匹配 |
| `bookmarks.ai_tags`                | `string[] \| null`   | ✅ 匹配 |
| `md_collections.processing_status` | `MdProcessingStatus` | ✅ 匹配 |
| `md_collections.content_type`      | `MdContentType`      | ✅ 匹配 |

### Zod 验证与数据库约束

| 验证字段            | Zod 约束  | 数据库约束  | 状态        |
| ------------------- | --------- | ----------- | ----------- |
| `platform`          | enum 5 值 | CHECK 8 值  | ⚠️ 不一致\* |
| `contentType`       | enum 5 值 | VARCHAR(50) | ✅ 兼容     |
| `processing_status` | enum 4 值 | CHECK 4 值  | ✅ 匹配     |

> \*注: Zod 验证使用 `browser` 作为统一浏览器入口，后端转换为具体平台类型

---

## 📁 关键文件清单

### 需要修复的文件

1. [folder-selector-dialog.tsx](src/components/messages/folder-selector-dialog.tsx) - React Hooks 问题

### 建议优化的文件

1. [md-renderer.tsx](src/features/md-collections/components/md-renderer.tsx) - 图片优化
2. [api-health.ts](src/lib/utils/api-health.ts) - 空函数处理

### 需要重新生成的文件

1. [supabase.ts](src/types/supabase.ts) - 运行 `supabase gen types`

---

## 🎯 修复状态

| 优先级 | 问题                | 状态      | 修复日期   |
| ------ | ------------------- | --------- | ---------- |
| P0     | React Hooks 违规    | ✅ 已修复 | 2025-12-17 |
| P1     | Supabase 类型未更新 | ✅ 已修复 | 2025-12-17 |
| P2     | Next.js Image 优化  | ✅ 已修复 | 2025-12-17 |
| P3     | 空函数警告          | ✅ 已修复 | 2025-12-17 |

---

## ✨ 总结

项目健康状况 **优秀**：

- **安全性**: RLS 策略完整，认证机制正确
- **一致性**: 前后端数据模型匹配
- **代码质量**: ESLint 检查通过，0 错误 0 警告

**所有问题已修复** ✅
