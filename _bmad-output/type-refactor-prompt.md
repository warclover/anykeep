# Classification 模块类型重构任务

## 背景

项目进行了 classification 模块目录结构重构（Phase 2.4），但存在 23 个文件仍引用旧的 v5 路径，导致 704 个类型错误。

## 目标

创建 v5 兼容层（重导出文件），使旧路径指向新位置，无需修改业务代码。

## 当前目录结构

```
src/lib/classification/
├── strategies/modern/           # 新位置 - 已存在
│   ├── chat-to-rule/
│   ├── gardener/
│   ├── shared/
│   │   ├── embedding/
│   │   ├── feature-flag/
│   │   ├── llm/
│   │   ├── logger/
│   │   └── vector-search/
│   └── *.ts (各种服务)
├── infrastructure/
│   ├── shared-services/         # 新位置 - 已存在
│   │   ├── embedding/
│   │   ├── feature-flag/
│   │   ├── llm/
│   │   ├── logger/
│   │   └── vector-search/
│   └── rollout/
├── v5/                          # 旧路径 - 需要创建兼容层
│   ├── chat-to-rule/types.ts    # ✅ 已存在
│   ├── gardener/types.ts        # ✅ 已存在
│   ├── rollout/                 # ❌ 需要创建
│   ├── shared/                  # ❌ 需要创建
│   └── classification-pipeline/ # ❌ 需要创建
└── v5.5/                        # ✅ 已存在
    ├── notification.ts
    └── quota.ts
```

## 路径映射表

| 旧路径                                                                            | 新路径                                                                   | 创建文件                                                        |
| --------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------- |
| `@/lib/classification/v5/rollout/feature-flag`                                    | `@/lib/classification/infrastructure/shared-services/feature-flag`       | `v5/rollout/feature-flag.ts`                                    |
| `@/lib/classification/v5/shared/logger`                                           | `@/lib/classification/infrastructure/shared-services/logger`             | `v5/shared/logger.ts`                                           |
| `@/lib/classification/v5/shared/llm`                                              | `@/lib/classification/infrastructure/shared-services/llm`                | `v5/shared/llm.ts`                                              |
| `@/lib/classification/v5/shared/vector-search`                                    | `@/lib/classification/infrastructure/shared-services/vector-search`      | `v5/shared/vector-search.ts`                                    |
| `@/lib/classification/v5/shared/embedding`                                        | `@/lib/classification/infrastructure/shared-services/embedding`          | `v5/shared/embedding/index.ts`                                  |
| `@/lib/classification/v5/shared/embedding/dashscope-embedding-adapter`            | `@/lib/classification/infrastructure/shared-services/embedding`          | `v5/shared/embedding/dashscope-embedding-adapter.ts`            |
| `@/lib/classification/v5/classification-pipeline/classification-pipeline.service` | `@/lib/classification/strategies/modern/classification-pipeline.service` | `v5/classification-pipeline/classification-pipeline.service.ts` |
| `@/lib/classification/v5/classification-pipeline/pipeline-factory`                | `@/lib/classification/strategies/modern/pipeline-factory`                | `v5/classification-pipeline/pipeline-factory.ts`                |
| `@/lib/classification/v5/classification-pipeline/types`                           | `@/lib/classification/strategies/modern/types`                           | `v5/classification-pipeline/types.ts`                           |

## 执行步骤

### Step 1: 创建目录结构

```bash
mkdir -p src/lib/classification/v5/rollout
mkdir -p src/lib/classification/v5/shared/embedding
mkdir -p src/lib/classification/v5/classification-pipeline
```

### Step 2: 创建重导出文件

每个文件格式如下：

```typescript
/**
 * 兼容性重导出
 * @deprecated 请使用新路径导入
 */
export * from "新路径";
```

### Step 3: 需要创建的文件列表

1. `src/lib/classification/v5/rollout/feature-flag.ts`

   ```typescript
   export * from "@/lib/classification/infrastructure/shared-services/feature-flag";
   ```

2. `src/lib/classification/v5/rollout/index.ts`

   ```typescript
   export * from "./feature-flag";
   ```

3. `src/lib/classification/v5/shared/logger.ts`

   ```typescript
   export * from "@/lib/classification/infrastructure/shared-services/logger";
   ```

4. `src/lib/classification/v5/shared/llm.ts`

   ```typescript
   export * from "@/lib/classification/infrastructure/shared-services/llm";
   ```

5. `src/lib/classification/v5/shared/vector-search.ts`

   ```typescript
   export * from "@/lib/classification/infrastructure/shared-services/vector-search";
   ```

6. `src/lib/classification/v5/shared/embedding/index.ts`

   ```typescript
   export * from "@/lib/classification/infrastructure/shared-services/embedding";
   ```

7. `src/lib/classification/v5/shared/embedding/dashscope-embedding-adapter.ts`

   ```typescript
   export * from "@/lib/classification/infrastructure/shared-services/embedding";
   ```

8. `src/lib/classification/v5/shared/index.ts`

   ```typescript
   export * from "./logger";
   export * from "./llm";
   export * from "./vector-search";
   export * from "./embedding";
   ```

9. `src/lib/classification/v5/classification-pipeline/classification-pipeline.service.ts`

   ```typescript
   export * from "@/lib/classification/strategies/modern/classification-pipeline.service";
   ```

10. `src/lib/classification/v5/classification-pipeline/pipeline-factory.ts`

    ```typescript
    export * from "@/lib/classification/strategies/modern/pipeline-factory";
    ```

11. `src/lib/classification/v5/classification-pipeline/types.ts`

    ```typescript
    export * from "@/lib/classification/strategies/modern/types";
    ```

12. `src/lib/classification/v5/classification-pipeline/index.ts`
    ```typescript
    export * from "./classification-pipeline.service";
    export * from "./pipeline-factory";
    export * from "./types";
    ```

### Step 4: 更新 tsconfig.json 排除废弃模块

在 `tsconfig.json` 的 `exclude` 数组中添加：

```json
{
  "exclude": ["src/lib/classification/_deprecated_v3/**"]
}
```

### Step 5: 验证

```bash
npm run type-check 2>&1 | grep -c "error TS"
```

预期：错误数从 704 降至 ~500

## 其他需要修复的问题

### 1. 缺失的 hook

文件 `src/hooks/domain/classification/use-tag-pre-match.ts` 引用了不存在的 `@/hooks/use-user`。

检查是否存在类似的 hook：

```bash
ls src/hooks/ | grep -i user
```

可能需要创建或更新导入路径。

### 2. Capacitor 依赖

文件 `src/components/distribution/obsidian-config-form.tsx` 引用 `@capacitor/filesystem`。

如果不需要移动端功能，可以：

- 添加条件导入
- 或安装依赖：`npm install @capacitor/filesystem`

## 完成标准

- [ ] 所有 v5 兼容层文件已创建
- [ ] tsconfig.json 已更新
- [ ] `npm run type-check` 错误数 < 500
- [ ] 无循环依赖错误
