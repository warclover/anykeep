# 智能分类 V3.0 解耦实施

## 设计原则

1. **新增不修改** - 所有 V3.0 功能都在 `v3/` 目录下新建文件
2. **策略模式** - 新策略实现现有 `IMatcher` 接口，可无缝集成
3. **配置开关** - 通过 `v3-config.ts` 控制功能启用/禁用
4. **渐进迁移** - V2 和 V3 可并行运行，逐步切换

## 目录结构

```
src/lib/classification/v3/
├── README.md                    # 本文档
├── config.ts                    # V3 功能开关配置
├── constants/
│   └── universal-categories.ts  # 30 个通用分类定义
├── prompts/
│   └── cot-prompt.ts            # CoT 思维链 Prompt
├── strategies/
│   ├── knn-direct-matcher.ts    # k-NN 直接锁定
│   ├── tag-matcher.ts           # Tag-to-Tag 匹配
│   └── universal-matcher.ts     # 通用分类匹配
├── services/
│   ├── folder-fingerprint.ts    # 文件夹意图指纹
│   ├── backfill-classification.ts # 回溯分类
│   └── ai-librarian.ts          # 整理大师
└── index.ts                     # V3 模块入口
```

## 集成方式

V3 策略通过依赖注入集成到现有 `ClassificationService`：

```typescript
// 在 container.ts 中配置
import { V3_CONFIG } from "./v3/config";
import { KnnDirectMatcher } from "./v3/strategies/knn-direct-matcher";

if (V3_CONFIG.enableKnnDirect) {
  // 添加 k-NN 作为第一个匹配器（优先级最高）
  matchers.unshift(new KnnDirectMatcher());
}
```

## 功能开关

```typescript
// v3/config.ts
export const V3_CONFIG = {
  // P0
  enableCoTPrompt: true, // CoT 思维链 Prompt

  // P1
  enableUniversalCategories: true, // 30 个通用分类
  enableBackfillClassification: true, // 回溯分类

  // P2
  enableKnnDirect: true, // k-NN 直接锁定
  enableFolderFingerprint: true, // 文件夹意图指纹
  enableTagMatcher: true, // Tag-to-Tag 匹配

  // P3
  enableAILibrarian: true, // 整理大师
};
```

## 回滚方案

如果 V3 功能出现问题，只需在 `config.ts` 中关闭对应开关，系统自动回退到 V2 逻辑。
