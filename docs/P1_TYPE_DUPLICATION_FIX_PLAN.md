# P1-2: 类型定义重复修复计划

**创建日期**: 2026-01-14  
**优先级**: P1  
**预计工作量**: 2-3 天

---

## 问题概述

项目中存在大量重复的类型定义，违反 DRY 原则，增加维护成本。

### 重复统计

| 类型        | 重复次数 | 影响范围                        |
| ----------- | -------- | ------------------------------- |
| BookmarkRow | 17+      | API routes, AI Skills, Handlers |
| FolderRow   | 10+      | API routes, Services            |
| IntentType  | 已修复   | 统一到 @/lib/shared/types       |

---

## 解决方案

### 1. 统一类型来源

**已创建**: `src/types/domain/index.ts`

**导出内容**:

- BookmarkRow, BookmarkInsert, BookmarkUpdate
- FolderRow, FolderInsert, FolderUpdate
- TagRow, BookmarkTagRow
- 扩展类型：BookmarkBasic, FolderBasic, FolderWithStats
- 类型工具：ExtractBookmarkFields, ExtractFolderFields

---

## 修复阶段

### 阶段 1: AI Skills 模块（10 处）✅

**文件列表**:

1. `src/lib/ai-skills/skills/duplicate-cleanup/detection/duplicate-detector.ts`
2. `src/lib/ai-skills/skills/periodic-report/collectors/types.ts`
3. `src/lib/ai-skills/skills/insight-report/types.ts`
4. `src/lib/ai-skills/skills/batch-organize/steps/types.ts`
5. `src/lib/ai-skills/skills/knowledge-review/knowledge-review.skill.ts`
6. `src/lib/ai-skills/skills/learning-path/helpers/bookmark-fetcher.ts`
7. `src/lib/ai-skills/skills/share-bundle/share-bundle.skill.ts`

**修复策略**:

```typescript
// ❌ 错误做法
interface BookmarkRow {
  id: number;
  title: string;
  url: string;
  // ...
}

// ✅ 正确做法
import type { BookmarkRow } from "@/types/domain";

// 如需部分字段
import type { BookmarkBasic } from "@/types/domain";

// 如需特定字段
import type { ExtractBookmarkFields } from "@/types/domain";
type MyBookmark = ExtractBookmarkFields<"id" | "title" | "url">;
```

### 阶段 2: API Routes（5 处）⏳

**文件列表**:

1. `src/app/api/distribution/rss/[token]/route.ts`
2. `src/app/api/reclassify/route.ts`
3. `src/app/api/plugin/bookmarks/route.ts`
4. `src/app/api/monitors/route.ts`
5. `src/app/api/synthesis/preview/route.ts`

**修复策略**:

- 删除本地 interface 定义
- 导入 `BookmarkRow` from `@/types/domain`
- 保留字段选择逻辑（`.select("id, title, url")`）

### 阶段 3: Handlers（2 处）⏳

**文件列表**:

1. `src/lib/ai-actions/handlers/tag-handlers.ts`
2. `src/lib/ai-actions/handlers/bookmark-handlers.ts`

**修复策略**:

- 使用 `Pick<BookmarkRow, "id" | "title" | "url">` 替代本地定义

---

## 验证方法

### 1. 类型冲突检测

```bash
npx ts-node scripts/check-type-duplicates.ts
```

### 2. TypeScript 编译检查

```bash
npx tsc --noEmit --project .
```

### 3. 单元测试

```bash
npm test
```

---

## 回归风险

| 风险         | 影响范围 | 缓解措施                 |
| ------------ | -------- | ------------------------ |
| 字段不匹配   | 高       | 逐个文件检查字段使用情况 |
| 类型推断失败 | 中       | 添加显式类型注解         |
| 测试失败     | 低       | 运行完整测试套件         |

---

## 执行清单

- [x] 创建统一类型导出 `src/types/domain/index.ts`
- [ ] 阶段 1: 修复 AI Skills 模块（10 处）
- [ ] 阶段 2: 修复 API Routes（5 处）
- [ ] 阶段 3: 修复 Handlers（2 处）
- [ ] 运行 TypeScript 检查
- [ ] 运行单元测试
- [ ] 更新代码审查报告

---

**修复状态**: 🟡 进行中  
**预计完成**: 2026-01-16  
**负责人**: BMad Master Agent
