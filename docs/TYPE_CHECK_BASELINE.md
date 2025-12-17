# 类型检查基线

**记录日期**: 2025-12-18
**分支**: refactor/home-page-performance
**用途**: Phase 0.3 - 重构前类型错误基线，用于监控重构过程中的类型健康

---

## 基线概要

| 指标                    | 值   |
| ----------------------- | ---- |
| 总错误数                | 16   |
| 涉及文件数              | 7    |
| home 模块错误           | 0 ✅ |
| md-collections 模块错误 | 16   |

---

## 按模块分类

### ✅ home 模块 (0 错误)

重构目标模块无类型错误，状态良好。

### ⚠️ md-collections 模块 (16 错误)

> 注意：这些错误与本次重构无关，是独立功能模块的待修复问题。

| 文件                                                          | 错误数 | 错误类型       |
| ------------------------------------------------------------- | ------ | -------------- |
| `src/app/(main)/md-collections/page-client.tsx`               | 1      | TS2353         |
| `src/app/api/md-collections/search/route.ts`                  | 3      | TS2345, TS2352 |
| `src/app/api/md-collections/upload/route.ts`                  | 2      | TS2345         |
| `src/features/md-collections/components/md-renderer.tsx`      | 2      | TS2339         |
| `src/features/md-collections/hooks/use-md-collections.ts`     | 4      | TS2339         |
| `src/features/md-collections/hooks/use-md-view-preference.ts` | 3      | TS2339         |
| `src/features/md-collections/lib/ai-processor.ts`             | 1      | TS2322         |

---

## 完整错误列表

```
src/app/(main)/md-collections/page-client.tsx(140,7): error TS2353: Object literal may only specify known properties, and 'contentType' does not exist in type 'MdCollectionCreateRequest'.

src/app/api/md-collections/search/route.ts(59,7): error TS2345: Argument of type '"search_md_collections_semantic"' is not assignable to parameter of type '"accept_classification_suggestions" | "add_custom_interest_atomic" | ...'.

src/app/api/md-collections/search/route.ts(76,20): error TS2352: Conversion of type 'number' to type 'MdSearchResult[]' may be a mistake because neither type sufficiently overlaps with the other.

src/app/api/md-collections/search/route.ts(166,32): error TS2345: Argument of type '"MD 收藏搜索功能仅限 Pro 用户使用"' is not assignable to parameter of type '"请先登录"'.

src/app/api/md-collections/upload/route.ts(99,38): error TS2345: Argument of type 'string' is not assignable to parameter of type '".md" | ".markdown" | ".txt"'.

src/app/api/md-collections/upload/route.ts(103,50): error TS2345: Argument of type 'string' is not assignable to parameter of type '"text/markdown" | "text/plain" | "text/x-markdown"'.

src/features/md-collections/components/md-renderer.tsx(40,22): error TS2339: Property 'oneDark' does not exist on type '{ default: typeof import("..."); ... }'.

src/features/md-collections/components/md-renderer.tsx(41,23): error TS2339: Property 'oneLight' does not exist on type '{ default: typeof import("..."); ... }'.

src/features/md-collections/hooks/use-md-collections.ts(48,5): error TS2339: Property 'contentType' does not exist on type 'UseMdCollectionsOptions'.

src/features/md-collections/hooks/use-md-collections.ts(49,5): error TS2339: Property 'keyword' does not exist on type 'UseMdCollectionsOptions'.

src/features/md-collections/hooks/use-md-collections.ts(51,5): error TS2339: Property 'isRead' does not exist on type 'UseMdCollectionsOptions'.

src/features/md-collections/hooks/use-md-collections.ts(52,5): error TS2339: Property 'isStarred' does not exist on type 'UseMdCollectionsOptions'.

src/features/md-collections/hooks/use-md-view-preference.ts(35,56): error TS2339: Property 'VIEW_PREFERENCE' does not exist on type '{ readonly viewMode: "md-collections-view-mode"; }'.

src/features/md-collections/hooks/use-md-view-preference.ts(52,43): error TS2339: Property 'VIEW_PREFERENCE' does not exist on type '{ readonly viewMode: "md-collections-view-mode"; }'.

src/features/md-collections/hooks/use-md-view-preference.ts(69,34): error TS2339: Property 'VIEW_PREFERENCE' does not exist on type '{ readonly viewMode: "md-collections-view-mode"; }'.

src/features/md-collections/lib/ai-processor.ts(103,11): error TS2322: Type '"markdown"' is not assignable to type 'ContentType | undefined'.
```

---

## 重构过程监控标准

### 🟢 健康状态

- home 模块错误数 = 0
- 总错误数 ≤ 16（不增加新错误）

### 🟡 警告状态

- home 模块错误数 1-3
- 总错误数 17-20

### 🔴 阻塞状态（必须停止重构）

- home 模块错误数 > 3
- 总错误数 > 20

---

## 检查命令

```bash
# 快速类型检查
npm run type-check

# 详细输出
npx tsc --noEmit --project tsconfig.json

# 统计错误数
npx tsc --noEmit --project tsconfig.json 2>&1 | grep -c "error TS"

# 仅检查 home 模块
npx tsc --noEmit --project tsconfig.json 2>&1 | grep "src/components/home"
```

---

## 变更记录

| 日期       | 阶段           | home 错误 | 总错误 | 状态 | 备注              |
| ---------- | -------------- | --------- | ------ | ---- | ----------------- |
| 2025-12-18 | Phase 0 (基线) | 0         | 16     | 🟢   | 初始状态          |
| 2025-12-18 | Phase 1        | 0         | 16     | 🟢   | 删除 217 行死代码 |
|            | Phase 2        |           |        |      |                   |
|            | Phase 3        |           |        |      |                   |
|            | Phase 4        |           |        |      |                   |
|            | Phase 5        |           |        |      |                   |
