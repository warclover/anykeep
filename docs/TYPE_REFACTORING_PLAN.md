# TypeScript 类型系统重构方案

> **版本**: 1.1.0
> **日期**: 2026-01-04
> **当前状态**: 162 个类型错误待修复
> **目标**: 建立统一的类型架构，消除类型冲突，提升代码质量
> **重要变更**: supabase.ts 采用手动维护模式（避免自动生成损坏文件）

---

## 一、问题诊断概览

### 1.1 错误分布统计

| 类别                     | 数量 | 占比 | 修复优先级 |
| ------------------------ | ---- | ---- | ---------- |
| 类型冲突（重复定义）     | 15   | 9%   | P0         |
| null vs undefined 不兼容 | 45   | 28%  | P1         |
| 测试文件类型问题         | 55   | 34%  | P2         |
| RPC 返回类型断言         | 30   | 19%  | P1         |
| 其他（缺失属性等）       | 17   | 10%  | P2         |

### 1.2 核心问题根因

```
┌─────────────────────────────────────────────────────────────┐
│                     类型系统碎片化                           │
├─────────────────────────────────────────────────────────────┤
│  1. 同一业务概念在多处重复定义（FolderWithStats 3处）        │
│  2. Supabase 生成类型与业务类型不一致（null vs undefined）   │
│  3. 测试文件类型与实现脱节（ToolContext, ToolResult）        │
│  4. RPC 函数缺乏类型安全（Json 返回需要大量断言）            │
│  5. 跨模块类型引用混乱（相对路径 vs @/ 别名）                │
└─────────────────────────────────────────────────────────────┘
```

---

## 二、重构策略：分层类型架构

### 2.1 设计原则

1. **单一真相源（Single Source of Truth）**: 每个业务概念只有一处定义
2. **分层隔离**: 数据库类型 → 领域类型 → UI 类型
3. **渐进式迁移**: 不破坏现有功能，逐步替换
4. **向后兼容**: 保留旧类型别名，标记 @deprecated

### 2.2 目标类型架构

```
src/types/
├── supabase.ts              # ⚠️ 手动维护（禁止自动生成覆盖）
├── database/                # 数据库层类型（新增）
│   ├── index.ts             # 统一导出
│   ├── tables.ts            # 表类型别名
│   ├── rpc.ts               # RPC 函数类型
│   └── transformers.ts      # DB → Domain 转换器
├── domain/                  # 领域层类型（新增）
│   ├── index.ts             # 统一导出
│   ├── bookmark.ts          # 书签领域类型
│   ├── folder.ts            # 文件夹领域类型
│   ├── synthesis.ts         # 合成报告领域类型
│   ├── knowledge-studio.ts  # 知识工作室领域类型
│   └── ai-agent.ts          # AI Agent 领域类型
├── api/                     # API 层类型（新增）
│   ├── index.ts             # 统一导出
│   ├── requests.ts          # 请求类型
│   └── responses.ts         # 响应类型
└── testing/                 # 测试辅助类型（新增）
    ├── index.ts             # 统一导出
    ├── mocks.ts             # Mock 类型
    └── fixtures.ts          # 测试数据类型
```

### 2.3 supabase.ts 手动维护规范

> ⚠️ **重要**：`supabase.ts` 不使用 `supabase gen types` 自动生成，因为自动生成会损坏现有的自定义类型定义。

#### 2.3.1 为什么禁止自动生成

1. **文件损坏风险**：自动生成会覆盖手动添加的接口和类型别名
2. **RPC 类型丢失**：自定义的 RPC 返回类型映射会被清除
3. **业务接口丢失**：如 `ImportHistoryOptions`、`OperationDetail` 等会被删除
4. **迁移时间长**：每次重新生成需要大量手动修复

#### 2.3.2 新增表/字段的标准流程

**新增数据库表时**：

```typescript
// 1. 在 Tables 接口中添加新表定义
export interface Database {
  public: {
    Tables: {
      // 现有表...

      // 新增表 ↓
      new_table_name: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          created_at: string;
          // ... 所有列
        };
        Insert: {
          id?: string; // 有默认值的列设为可选
          user_id: string;
          name: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          created_at?: string;
        };
        Relationships: [
          // 外键关系
        ];
      };
    };
  };
}
```

**新增 RPC 函数时**：

```typescript
// 2. 在 Functions 接口中添加 RPC 定义
Functions: {
  // 现有函数...

  // 新增函数 ↓
  new_rpc_function: {
    Args: {
      p_user_id: string;
      p_param: number;
    }
    Returns: {
      success: boolean;
      data: Json;
      message: string | null;
    }
    []; // 注意：单行返回用 {}，多行返回用 {}[]
  }
}
```

**新增字段时**：

```typescript
// 3. 在对应表的 Row/Insert/Update 中添加字段
existing_table: {
  Row: {
    // 现有字段...
    new_field: string | null;  // 添加新字段
  };
  Insert: {
    // 现有字段...
    new_field?: string | null;  // Insert 中通常可选
  };
  Update: {
    // 现有字段...
    new_field?: string | null;  // Update 中始终可选
  };
}
```

#### 2.3.3 类型检查验证

每次修改 `supabase.ts` 后必须运行：

```bash
# 验证类型正确性
npm run type-check

# 验证构建成功
npm run build
```

#### 2.3.4 从数据库同步类型的替代方案

如需参考数据库最新结构，可以：

```bash
# 1. 生成到临时文件（不覆盖现有文件）
npx supabase gen types typescript --local > /tmp/supabase-types-ref.ts

# 2. 手动对比并合并需要的类型
diff src/types/supabase.ts /tmp/supabase-types-ref.ts

# 3. 手动将新增的表/字段复制到 supabase.ts
```

---

## 三、Phase 1: 修复类型冲突（P0）

### 3.1 FolderWithStats 统一

**现状**：3 处重复定义，字段不一致

| 文件位置                          | is_system              | source | 其他差异 |
| --------------------------------- | ---------------------- | ------ | -------- |
| `src/components/folders/types.ts` | `boolean \| undefined` | ❌     | -        |
| `src/hooks/data/use-page-data.ts` | `boolean`              | ✅     | -        |
| Supabase 生成                     | `boolean \| null`      | ❌     | -        |

**解决方案**：

```typescript
// src/types/domain/folder.ts （新建）

import type { Database } from "@/types/supabase";

// 数据库行类型（直接从 Supabase 生成类型派生）
type FolderRow = Database["public"]["Tables"]["folders"]["Row"];

// 领域类型（统一定义）
export interface FolderWithStats extends Omit<FolderRow, "is_system"> {
  bookmark_count: number;
  today_count: number;
  is_system: boolean; // 统一为 boolean，转换时处理 null
  source?: "database" | "cache"; // 可选字段
}

// 转换器
export function toFolderWithStats(
  row: FolderRow & { bookmark_count?: number; today_count?: number },
): FolderWithStats {
  return {
    ...row,
    bookmark_count: row.bookmark_count ?? 0,
    today_count: row.today_count ?? 0,
    is_system: row.is_system ?? false, // null → false
    source: "database",
  };
}
```

**迁移步骤**：

1. 创建 `src/types/domain/folder.ts`
2. 在 `src/types/domain/index.ts` 统一导出
3. 修改 `src/components/folders/types.ts` 重新导出
4. 修改 `src/hooks/data/use-page-data.ts` 使用统一类型
5. 添加 `@deprecated` 注释到旧定义

### 3.2 ReportSuggestion 统一

**现状**：2 处定义，type 字段枚举值不一致

| 文件位置                                                      | type 枚举                                                              |
| ------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `src/types/supabase.ts`                                       | `"split" \| "merge" \| "rename" \| "archive" \| "create" \| "cleanup"` |
| `src/components/folder-evolution/report-suggestions-list.tsx` | `"split" \| "merge" \| "rename" \| "cleanup" \| undefined`             |

**解决方案**：

```typescript
// src/types/domain/synthesis.ts （新建）

export const REPORT_SUGGESTION_TYPES = [
  "split",
  "merge",
  "rename",
  "archive",
  "create",
  "cleanup",
] as const;

export type ReportSuggestionType = (typeof REPORT_SUGGESTION_TYPES)[number];

export interface ReportSuggestion {
  type: ReportSuggestionType;
  title: string;
  reason: string;
  description?: string;
  affectedBookmarks?: number[];
  confidence?: number;
}

// UI 组件可以过滤不支持的类型
export type SupportedSuggestionType = Extract<
  ReportSuggestionType,
  "split" | "merge" | "rename" | "cleanup"
>;
```

---

## 四、Phase 2: null vs undefined 统一（P1）

### 4.1 问题分析

Supabase 生成的类型使用 `| null`，而 TypeScript/React 生态更常用 `| undefined`。

**常见场景**：

```typescript
// Supabase 返回
interface DbRow {
  description: string | null;
  folder_id: number | null;
}

// 业务期望
interface DomainModel {
  description?: string; // undefined
  folderId?: number; // undefined
}
```

### 4.2 统一策略：nullToUndefined 转换器

```typescript
// src/types/database/transformers.ts

/**
 * 将对象中所有 null 值转换为 undefined
 * 用于 Supabase 数据转换
 */
export function nullToUndefined<T extends Record<string, unknown>>(
  obj: T,
): { [K in keyof T]: Exclude<T[K], null> | undefined } {
  const result = {} as { [K in keyof T]: Exclude<T[K], null> | undefined };

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      result[key] = obj[key] === null ? undefined : obj[key];
    }
  }

  return result;
}

/**
 * 类型工具：将 T 中所有 | null 替换为 | undefined
 */
export type NullToUndefined<T> = T extends null
  ? undefined
  : T extends object
    ? { [K in keyof T]: NullToUndefined<T[K]> }
    : T;
```

### 4.3 应用模式

```typescript
// 每个数据访问层使用转换器
const { data } = await supabase.from("bookmarks").select("*");
const bookmarks = data?.map((row) => nullToUndefined(row)) ?? [];

// 或在 repository 层统一处理
class BookmarkRepository {
  async findById(id: number): Promise<Bookmark | undefined> {
    const { data } = await supabase
      .from("bookmarks")
      .select("*")
      .eq("id", id)
      .single();

    return data ? this.toDomain(nullToUndefined(data)) : undefined;
  }
}
```

---

## 五、Phase 3: RPC 类型安全增强（P1）

### 5.1 问题分析

当前 RPC 调用返回 `Json` 类型，需要大量 `as unknown as` 断言：

```typescript
// 当前写法（不安全）
const { data } = await supabase.rpc("get_review_stats", { p_user_id });
const stats = data as unknown as ReviewStatsResult; // 运行时可能出错
```

### 5.2 解决方案：RPC 类型映射

```typescript
// src/types/database/rpc.ts

import type { Database } from "@/types/supabase";

// RPC 函数返回类型映射
export interface RpcReturnTypes {
  get_review_stats: ReviewStatsResult;
  get_undoable_ai_operations: UndoableOperation[];
  batch_add_tags: BatchTagResult;
  batch_remove_tags: BatchTagResult;
  // ... 其他 RPC
}

// 类型安全的 RPC 调用包装器
export async function typedRpc<K extends keyof RpcReturnTypes>(
  supabase: SupabaseClient<Database>,
  functionName: K,
  args: Database["public"]["Functions"][K]["Args"],
): Promise<{ data: RpcReturnTypes[K] | null; error: PostgrestError | null }> {
  const result = await supabase.rpc(functionName, args);
  return result as {
    data: RpcReturnTypes[K] | null;
    error: PostgrestError | null;
  };
}
```

### 5.3 使用示例

```typescript
// 类型安全调用
const { data, error } = await typedRpc(supabase, "get_review_stats", {
  p_user_id: userId,
});

// data 自动推断为 ReviewStatsResult | null
if (data) {
  console.log(data.total_flashcards); // 类型安全
}
```

---

## 六、Phase 4: 测试文件类型修复（P2）

### 6.1 问题分析

测试文件中存在大量类型错误，主要原因：

1. `ToolContext` 类型与实现不同步
2. `ToolResult` 联合类型需要类型守卫
3. 测试参数缺少必填字段

### 6.2 解决方案：测试辅助类型

```typescript
// src/types/testing/mocks.ts

import type { ToolContext, ToolResult } from "@/lib/ai-agent/tools/types";

// 测试用 ToolContext 工厂
export function createMockToolContext(
  overrides: Partial<ToolContext> = {},
): ToolContext {
  return {
    userId: "test-user-id",
    conversationId: "test-conversation-id",
    timezone: "Asia/Shanghai",
    ...overrides,
  };
}

// 类型守卫
export function isToolSuccess<T>(
  result: ToolResult<T>,
): result is { success: true; data: T } {
  return result.success === true;
}

export function isToolError(
  result: ToolResult<unknown>,
): result is { success: false; error: string; errorCode?: string } {
  return result.success === false;
}

// 测试断言辅助
export function expectSuccess<T>(
  result: ToolResult<T>,
): asserts result is { success: true; data: T } {
  if (!isToolSuccess(result)) {
    throw new Error(`Expected success but got error: ${result.error}`);
  }
}
```

### 6.3 测试文件修复模式

```typescript
// 修复前
const result = await tool.execute({ bookmarkId: 1 }, context);
expect(result.data.bookmark.id).toBe(1); // TS 错误

// 修复后
const result = await tool.execute(
  { bookmarkId: 1, permanent: false }, // 补全必填字段
  createMockToolContext(),
);
expectSuccess(result); // 类型守卫
expect(result.data.bookmark.id).toBe(1); // 类型安全
```

---

## 七、实施计划

### 7.1 阶段划分

| 阶段    | 目标                | 预计时间 | 错误减少  |
| ------- | ------------------- | -------- | --------- |
| Phase 1 | 修复类型冲突        | 2h       | 162 → 140 |
| Phase 2 | null/undefined 统一 | 3h       | 140 → 95  |
| Phase 3 | RPC 类型安全        | 2h       | 95 → 65   |
| Phase 4 | 测试文件修复        | 3h       | 65 → 0    |
| 验收    | 全量类型检查        | 1h       | 0         |

### 7.2 每阶段验收标准

- [ ] `npm run type-check` 错误数符合预期
- [ ] `npm run build` 成功
- [ ] `npm run test` 无新增失败
- [ ] 无 `@ts-ignore` 或 `as any` 新增

### 7.3 回滚策略

每阶段完成后创建 Git 标签：

```bash
git tag -a "type-refactor-phase-1" -m "Phase 1: 类型冲突修复完成"
```

如需回滚：

```bash
git revert --no-commit HEAD~N  # N = 该阶段提交数
```

---

## 八、长期维护建议

### 8.1 类型守则

1. **`supabase.ts` 只能手动维护，禁止使用 `supabase gen types` 覆盖**
2. **新增数据库表/字段时，按 2.3.2 流程手动添加类型**
3. **新类型必须定义在 `src/types/domain/`**
4. **Supabase 类型只用于数据访问层**
5. **业务代码使用领域类型**
6. **测试使用 `src/types/testing/` 辅助类型**

### 8.2 supabase.ts 维护检查清单

每次修改 `supabase.ts` 时：

- [ ] Row 类型包含所有数据库列
- [ ] Insert 类型：有默认值的列设为可选（`?`）
- [ ] Update 类型：所有列都设为可选（`?`）
- [ ] RPC Args 参数名与数据库函数参数一致
- [ ] RPC Returns 类型与实际返回结构一致
- [ ] 运行 `npm run type-check` 通过
- [ ] 运行 `npm run build` 成功

### 8.3 CI/CD 集成

```yaml
# .github/workflows/type-check.yml
- name: TypeScript Check
  run: npm run type-check -- --strict

- name: No Any Allowed
  run: |
    if grep -r "as any" src/ --include="*.ts" --include="*.tsx"; then
      echo "Error: 'as any' usage detected"
      exit 1
    fi
```

### 8.4 代码审查清单

- [ ] 新类型是否定义在正确的层级？
- [ ] 是否有重复的类型定义？
- [ ] null/undefined 处理是否使用转换器？
- [ ] RPC 调用是否使用类型安全包装器？
- [ ] 测试是否使用类型守卫？
- [ ] **supabase.ts 是否按手动维护规范修改？**

---

## 九、附录

### A. 受影响文件清单

#### Phase 1 文件

- `src/types/domain/folder.ts` (新建)
- `src/types/domain/synthesis.ts` (新建)
- `src/components/folders/types.ts` (修改)
- `src/hooks/data/use-page-data.ts` (修改)
- `src/types/supabase.ts` (手动维护修改)

#### Phase 2 文件

- `src/types/database/transformers.ts` (新建)
- `src/lib/ai-agent/tools/md-collection/*.ts` (修改)
- `src/lib/ai-agent/tools/active-recall/*.ts` (修改)

#### Phase 3 文件

- `src/types/database/rpc.ts` (新建)
- `src/lib/supabase/typed-rpc.ts` (新建)

#### Phase 4 文件

- `src/types/testing/mocks.ts` (新建)
- `src/lib/ai-agent/tools/**/__tests__/*.test.ts` (修改)

### B. 参考资料

- [TypeScript Handbook - Generics](https://www.typescriptlang.org/docs/handbook/2/generics.html)
- [Supabase Type Generation](https://supabase.com/docs/reference/javascript/typescript-support) _(仅作参考，本项目采用手动维护)_
- [Domain-Driven Design with TypeScript](https://khalilstemmler.com/articles/categories/domain-driven-design/)

### C. supabase.ts 手动维护历史

| 日期       | 变更内容                                 | 提交       |
| ---------- | ---------------------------------------- | ---------- |
| 2026-01-04 | 添加 4 个 RPC 函数、3 个表字段、业务接口 | `97c77c10` |

> 此表记录所有对 `supabase.ts` 的手动修改，便于追踪变更历史。
