# folderId 类型统一修复方案

> 创建日期: 2026-01-23
> 优先级: P1
> 预估工时: 2.5 天

## 问题分析

### 当前状态

| 类型               | 文件数  | 主要分布                                  |
| ------------------ | ------- | ----------------------------------------- |
| `folderId: string` | ~70 处  | classification v5 模块、部分 components   |
| `folderId: number` | ~265 处 | repositories、services、API routes、hooks |
| **数据库层**       | -       | `folder_id: number` (bigint/int8)         |

### 根本原因

1. **数据库定义**: Supabase 生成的类型明确定义 `folder_id: number`
2. **历史遗留**: classification v5 模块在开发时使用了 `string` 类型
3. **混用场景**: 部分代码在 string/number 之间隐式转换

### 影响范围

```
受影响模块:
├── src/lib/classification/v5/          # 主要问题区域 (~50 处 string)
│   ├── classification-pipeline/
│   ├── folder-profiler/
│   ├── gardener/
│   └── shared/
├── src/components/home/types.ts        # 3 处 string
├── scripts/                            # 测试脚本 (~10 处 string)
└── src/lib/workflow/                   # 1 处 string
```

---

## 修复方案

### 决策：统一为 `number` 类型

**理由**:

1. 数据库层使用 `bigint` → TypeScript 映射为 `number`
2. 265 处使用 `number` vs 70 处使用 `string`，`number` 是主流
3. 避免运行时 `parseInt`/`toString` 转换开销

---

### Phase 1: 类型定义统一 (P0 - 1天)

**目标**: 创建统一类型定义，作为单一真相来源

**文件**: `src/lib/shared/types/folder.ts`

```typescript
/**
 * 文件夹 ID 统一类型
 * 与数据库 folders.id (bigint) 保持一致
 */
export type FolderId = number;

/**
 * 可空文件夹 ID（用于书签未分类场景）
 */
export type NullableFolderId = FolderId | null;

/**
 * 文件夹 ID 数组
 */
export type FolderIdList = FolderId[];
```

**更新 `src/lib/shared/types/index.ts`**:

```typescript
export type { FolderId, NullableFolderId, FolderIdList } from "./folder";
```

---

### Phase 2: Classification V5 模块修复 (P1 - 2天)

**受影响文件** (~50 处):

| 子模块                     | 文件数 | 优先级 |
| -------------------------- | ------ | ------ |
| `classification-pipeline/` | 15     | 高     |
| `folder-profiler/`         | 5      | 高     |
| `gardener/`                | 8      | 中     |
| `shared/`                  | 3      | 中     |
| `__tests__/`               | 5      | 低     |

**修复策略**:

```typescript
// 修复前
interface FolderCandidate {
  folderId: string; // ❌
  confidence: number;
}

// 修复后
import type { FolderId } from "@/lib/shared/types";

interface FolderCandidate {
  folderId: FolderId; // ✅ number
  confidence: number;
}
```

**关键文件清单**:

```
src/lib/classification/v5/classification-pipeline/
├── types.ts                        # 8 处 string → number
├── folder-context-provider.ts      # 3 处
├── folder-alias-manager.ts         # 12 处
├── tag-trust-filter.ts             # 5 处
├── hybrid-retriever.ts             # 2 处
└── classification-pipeline.service.ts  # 2 处

src/lib/classification/v5/folder-profiler/
├── types.ts                        # 1 处
├── folder-profiler.service.ts      # 3 处
└── dual-source-builder.ts          # 1 处

src/lib/classification/v5/gardener/
├── types.ts                        # 4 处
├── naming-engine.ts                # 2 处
├── synonym-detector.ts             # 3 处
└── folder-suggester.ts             # 1 处

src/lib/classification/v5/shared/
├── vector-search/types.ts          # 1 处
└── llm/types.ts                    # 1 处
```

---

### Phase 3: Components 修复 (P2 - 0.5天)

**文件**: `src/components/home/types.ts`

```typescript
// 修复前
interface FilterState {
  folderId: string; // ❌
}

// 修复后
import type { FolderId } from "@/lib/shared/types";

interface FilterState {
  folderId: FolderId; // ✅
}
```

---

### Phase 4: 脚本与测试修复 (P3 - 0.5天)

**文件清单**:

```
scripts/
├── test-classification-simple.ts
├── classification-realistic-test/types.ts
├── classification-realistic-test/index.ts
└── migrate-classification-v4-to-v5.ts

src/lib/workflow/triggers/event-emitter.ts
```

---

### Phase 5: 类型冲突检测脚本 (P2 - 0.5天)

**新增脚本**: `scripts/check-folder-id-types.ts`

```typescript
/**
 * 检测 folderId 类型不一致
 * 在 CI 中运行，发现 string 类型则失败
 */
import { execSync } from "child_process";

const stringPattern = "folderId:\\s*string";
const result = execSync(
  `grep -r "${stringPattern}" src/ --include="*.ts" || true`,
  { encoding: "utf-8" },
);

if (result.trim()) {
  console.error("❌ Found folderId: string usage:");
  console.error(result);
  process.exit(1);
}

console.log("✅ All folderId types are consistent (number)");
```

**集成到 package.json**:

```json
{
  "scripts": {
    "check:folder-id-types": "ts-node scripts/check-folder-id-types.ts",
    "precommit": "npm run check:folder-id-types && npm run type-check"
  }
}
```

---

## 执行计划

| 阶段         | 任务            | 工时            | 风险             |
| ------------ | --------------- | --------------- | ---------------- |
| Phase 1      | 统一类型定义    | 2h              | 低               |
| Phase 2      | V5 模块修复     | 8h              | 中（需回归测试） |
| Phase 3      | Components 修复 | 2h              | 低               |
| Phase 4      | 脚本修复        | 2h              | 低               |
| Phase 5      | 检测脚本        | 2h              | 低               |
| **回归测试** | 全量测试        | 4h              | -                |
| **总计**     | -               | **20h (2.5天)** | -                |

---

## 风险与缓解

| 风险           | 缓解措施                                       |
| -------------- | ---------------------------------------------- |
| 运行时类型错误 | 添加 Zod 验证层，确保 API 边界类型正确         |
| 测试失败       | 分批提交，每批运行完整测试套件                 |
| 隐式转换遗漏   | 添加 ESLint 规则禁止 `parseInt(folderId)` 模式 |

---

## 验收标准

1. ✅ `npm run type-check` 通过
2. ✅ `npm run check:folder-id-types` 无 string 类型
3. ✅ 所有单元测试通过 (1851+)
4. ✅ Classification V5 功能回归测试通过
5. ✅ 无运行时类型错误

---

## 附录：详细文件清单

### 使用 `folderId: string` 的文件 (~70 处)

<details>
<summary>展开查看完整列表</summary>

```
scripts/test-classification-simple.ts:27
scripts/classification-realistic-test/types.ts:81
scripts/migrate-classification-v4-to-v5.ts:26, 209, 231
scripts/classification-realistic-test/index.ts:50, 582, 623
src/components/home/types.ts:63, 260, 280
src/lib/workflow/triggers/event-emitter.ts:113
src/lib/classification/v5/__tests__/synthetic-lab/types.ts:126, 190, 208
src/lib/classification/v5/__tests__/synthetic-lab/dataset-generator.ts:103, 128
src/lib/classification/v5/shared/vector-search/types.ts:30
src/lib/classification/v5/shared/llm/types.ts:56
src/lib/classification/v5/gardener/types.ts:81, 102, 117
src/lib/classification/v5/gardener/synonym-detector.ts:16, 188, 245
src/lib/classification/v5/gardener/naming-engine.ts:119, 175
src/lib/classification/v5/gardener/folder-suggester.ts:20
src/lib/classification/v5/folder-profiler/types.ts:42
src/lib/classification/v5/folder-profiler/folder-profiler.service.ts:98, 136, 319
src/lib/classification/v5/folder-profiler/dual-source-builder.ts:152
src/lib/classification/v5/classification-pipeline/types.ts:32, 37, 54, 82, 101, 180, 248
src/lib/classification/v5/classification-pipeline/tag-trust-filter.ts:354, 409, 507, 562
src/lib/classification/v5/classification-pipeline/tag-match-metrics.ts:119
src/lib/classification/v5/classification-pipeline/l0-rule-matcher.ts:21
src/lib/classification/v5/classification-pipeline/hybrid-retriever.ts:438, 443
src/lib/classification/v5/classification-pipeline/folder-context-provider.ts:11, 33, 98
src/lib/classification/v5/classification-pipeline/folder-alias-manager.ts:25, 157, 212, 233, 255, 308, 360, 470, 496
src/lib/classification/v5/classification-pipeline/classification-pipeline.service.ts:30, 369
src/lib/classification/v5/classification-pipeline/ai-tag-matcher.ts:427
src/lib/cache/cache-config.ts:103
src/lib/classification/client/folder-cache-sync.ts:284, 298
src/lib/cache/unified-cache.ts:185
src/lib/classification/client/tag-pre-matcher.ts:22
src/app/api/classification/v5/folder-profile/[folderId]/update/route.ts:25
src/app/api/classification/v5/folder-profile/[folderId]/route.ts:20
src/lib/ai-agent/task-understanding/undo/undo-service.ts:428
```

</details>

### 使用 `folderId: number` 的文件 (~265 处)

主要分布在以下目录，均符合数据库类型定义：

- `src/repositories/` - 数据访问层
- `src/services/` - 业务服务层
- `src/lib/classification/` (非 v5) - 分类服务
- `src/lib/ai-agent/tools/` - AI 工具
- `src/lib/ai-skills/` - AI 技能
- `src/app/api/` - API 路由
- `src/hooks/` - React Hooks
- `src/components/` (非 home/types.ts)
