# 智能分类迁移指南

**版本**: v2.0
**更新日期**: 2026-01-24

---

## 一、迁移概述

本指南帮助您从旧版分类系统迁移到新的双策略架构。

### 主要变更

| 变更项        | 旧版                       | 新版                                     |
| ------------- | -------------------------- | ---------------------------------------- |
| 入口函数      | `classifyBookmarkV2()`     | `getClassificationFacade().classify()`   |
| API 端点      | `/api/classification/v5/*` | `/api/classification/v2/*`               |
| Feature Flags | 分散在多个文件             | 统一到 `infrastructure/feature-flags.ts` |
| V3 代码       | 存在但不使用               | 已删除                                   |
| V5.5 晶体生长 | 独立目录                   | 整合到 `strategies/modern/crystal/`      |

---

## 二、代码迁移

### 2.1 分类调用迁移

**旧版**:

```typescript
import { classifyBookmarkV2 } from "@/lib/classification";

const result = await classifyBookmarkV2(
  bookmarkId,
  title,
  summary,
  tags,
  userId,
);

if (result.classified) {
  // 自动分类成功
}
```

**新版**:

```typescript
import { getClassificationFacade } from "@/lib/classification";

const facade = getClassificationFacade();
const result = await facade.classify({
  userId,
  bookmarkId: String(bookmarkId),
  title,
  summary,
  tags,
  url,
});

if (result.confidence >= 0.8) {
  // 高置信度，可自动分类
}
```

### 2.2 向后兼容

旧版 `classifyBookmarkV2()` 函数仍然可用，但已标记为 `@deprecated`：

```typescript
/** @deprecated 使用 getClassificationFacade().classify() 代替 */
export async function classifyBookmarkV2(
  bookmarkId: number,
  title: string,
  summary: string | null,
  tags: string[],
  userId: string,
): Promise<LegacyClassificationResult> {
  // 内部调用新 API
}
```

**建议**: 在 2026-04-01 前完成迁移。

### 2.3 Feature Flags 迁移

**旧版** (分散):

```typescript
// config/feature-flags.ts
import { FEATURE_FLAGS } from "@/lib/classification/config/feature-flags";

if (FEATURE_FLAGS.V3_ENABLE_COT_PROMPT) { ... }

// rollout/feature-flag.ts
import { isUserInV5Rollout } from "@/lib/classification/v5/rollout/feature-flag";

if (isUserInV5Rollout(userId)) { ... }
```

**新版** (统一):

```typescript
import { getFeatureFlagService } from "@/lib/classification/infrastructure/feature-flags";

const flags = getFeatureFlagService();

// 检查功能开关
if (flags.get("enableCoTPrompt")) { ... }

// 检查用户是否启用 Modern 策略
if (flags.isEnabledForUser(userId)) { ... }
```

### 2.4 晶体生长迁移

**旧版**:

```typescript
import { QuotaService } from "@/lib/classification/v5.5/quota";
import type { SilentNotification } from "@/lib/classification/v5.5/notification";
```

**新版**:

```typescript
import { UnifiedQuotaService } from "@/lib/classification/strategies/modern/crystal/quota";
import type { SilentNotification } from "@/lib/classification/strategies/modern/crystal/notification";
```

---

## 三、API 端点迁移

### 3.1 重定向配置

旧端点已配置 308 永久重定向：

| 旧端点                                  | 新端点                            | 废弃日期   |
| --------------------------------------- | --------------------------------- | ---------- |
| `/api/classification/classify`          | `/api/classification/v2/classify` | 2026-04-01 |
| `/api/classification/v5/classify`       | `/api/classification/v2/classify` | 2026-04-01 |
| `/api/classification/v5/classify-batch` | `/api/classification/v2/batch`    | 2026-04-01 |
| `/api/classification/feedback`          | `/api/classification/v2/feedback` | 2026-04-01 |
| `/api/classification/v5/feedback`       | `/api/classification/v2/feedback` | 2026-04-01 |

### 3.2 前端调用更新

```typescript
// 旧版
const response = await fetch("/api/classification/v5/classify", {
  method: "POST",
  body: JSON.stringify({ ... }),
});

// 新版
const response = await fetch("/api/classification/v2/classify", {
  method: "POST",
  body: JSON.stringify({ ... }),
});
```

---

## 四、环境变量迁移

### 4.1 变量名变更

| 旧变量名                  | 新变量名                         |
| ------------------------- | -------------------------------- |
| `V5_ROLLOUT_PERCENT`      | `CLASSIFICATION_ROLLOUT_STAGE`   |
| `V5_ENABLE_L0_RULES`      | `CLASSIFICATION_ENABLE_L0_RULES` |
| `V5_ENABLE_T1_CORRECTION` | `CLASSIFICATION_ENABLE_T1`       |

### 4.2 新增变量

```bash
# 默认策略选择
CLASSIFICATION_DEFAULT_STRATEGY=modern

# 晶体生长整合
CLASSIFICATION_ENABLE_CRYSTAL=false
```

---

## 五、测试迁移

### 5.1 Mock 更新

```typescript
// 旧版 Mock
jest.mock("@/lib/classification", () => ({
  classifyBookmarkV2: jest.fn(),
}));

// 新版 Mock
jest.mock("@/lib/classification", () => ({
  getClassificationFacade: () => ({
    classify: jest.fn(),
    classifyBatch: jest.fn(),
    classifyQuick: jest.fn(),
  }),
}));
```

### 5.2 依赖注入测试

```typescript
import {
  createContainer,
  TYPES,
} from "@/lib/classification/infrastructure/container";

describe("ClassificationFacade", () => {
  let container: Container;

  beforeEach(() => {
    const mockLLM = { generate: jest.fn() };
    const mockEmbedding = { embed: jest.fn() };

    container = createContainer(mockSupabase, {
      LLMService: mockLLM,
      EmbeddingService: mockEmbedding,
    });
  });

  test("should classify correctly", async () => {
    const facade = container.get(TYPES.ClassificationFacade);
    // ...
  });
});
```

---

## 六、回滚方案

如果迁移后出现问题，可以快速回滚：

### 6.1 强制使用 Classic 策略

```bash
CLASSIFICATION_VERSION=v4.1
```

### 6.2 关闭特定功能

```bash
CLASSIFICATION_ENABLE_T1=false
CLASSIFICATION_ENABLE_CRYSTAL=false
```

### 6.3 Git 回滚

```bash
# 回滚到 Phase 5 之前
git revert b0e5f8bc
```

---

## 七、迁移检查清单

- [ ] 更新 `classifyBookmarkV2()` 调用为新 API
- [ ] 更新 Feature Flags 导入路径
- [ ] 更新晶体生长相关导入
- [ ] 更新 API 端点调用
- [ ] 更新环境变量配置
- [ ] 更新测试 Mock
- [ ] 运行完整测试套件
- [ ] 验证生产构建成功

---

## 八、常见问题

### Q: 旧版 API 还能用多久？

A: 旧版 API 将在 2026-04-01 后移除，请尽快迁移。

### Q: 迁移后性能有变化吗？

A: 新架构通过统一缓存和优化的策略选择，性能应该持平或略有提升。

### Q: 如何验证迁移成功？

A: 运行以下命令验证：

```bash
npm run type-check
npm test -- --testPathPattern=classification
```
