# 测试指南

## 待添加测试的核心模块

按优先级排序：

1. **classification.service.ts** - 核心分类逻辑
2. **bookmark.repository.ts** - 数据访问层
3. **merge.service.ts** - 合并逻辑
4. **split.service.ts** - 分拆逻辑

## 测试模式

参考现有测试：

- `__tests__/folder-health.test.ts`
- `__tests__/score-aggregator.test.ts`

### Mock 模式

```typescript
// Mock logger
jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock Supabase
const mockSupabase: any = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  // ...
};
```

### 核心类型

```typescript
import type { MatchResult, ClassificationResult, BookmarkInput } from "../types";

// MatchResult
{
  folderId: number;
  folderName: string;
  score: number;
  confidence: number;
  reason: string;
}

// ClassificationResult
{
  folderId: number | null;
  folderName: string;
  confidence: number;
  reason: string;
  action: ClassificationAction;
  scores: { vectorScore, historyScore, aiScore };
}

// BookmarkInput
{
  id?: number;
  title: string;
  summary?: string;
  tags?: string[];
  embedding?: number[];
  url?: string;
}
```

## 运行测试

```bash
npm run test                    # 运行所有测试
npm run test -- --watch        # 监视模式
npm run test -- path/to/test   # 运行特定测试
```

## 测试覆盖率目标

- 核心服务: > 80%
- Repository: > 70%
- 工具函数: > 90%
