# 智能分类系统架构文档

**版本**: v2.0 (重构后)
**更新日期**: 2026-01-24

---

## 一、系统概览

AnyKeep 智能分类系统采用**双策略架构**，通过统一门面（Facade）对外提供服务，内部根据用户分桶和 Feature Flags 动��选择执行策略。

```
┌─────────────────────────────────────────────────────────────────────┐
│                      ClassificationFacade                            │
│                      (统一门面 - 单一公开 API)                         │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
┌───────────────────────────────▼─────────────────────────────────────┐
│                      StrategyResolver                                │
│                      (策略解析器)                                     │
│  - Feature Flags 统一管理                                            │
│  - 用户分桶 (MD5 Hash)                                               │
│  - 环境变量覆盖                                                       │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
          ┌─────────────────────┴─────────────────────┐
          ▼                                           ▼
┌──────────────────────┐                   ┌──────────────────────┐
│   ClassicStrategy    │                   │   ModernStrategy     │
│   (原 V4.1)          │                   │   (原 V5.0 + V5.5)   │
│                      │                   │                      │
│ - 向量相似度匹配     │                   │ - L0 规则匹配        │
│ - AI 选择题模式      │                   │ - T0 快速生成        │
│ - 历史行为学习       │                   │ - T1 LLM 纠正        │
│                      │                   │ - 晶体生长 (可选)    │
└──────────────────────┘                   └──────────────────────┘
```

---

## 二、目录结构

```
src/lib/classification/
├── index.ts                      # 公开 API 导出
├── facade.ts                     # 统一门面
├── strategy-resolver.ts          # 策略解析器
│
├── core/                         # 核心抽象层
│   ├── types.ts                  # 统一类型定义
│   ├── interfaces.ts             # 服务接口
│   ├── constants.ts              # 常量（阈值等）
│   └── errors.ts                 # 错误类型
│
├── strategies/                   # 策略实现层
│   ├── classic/                  # Classic 策略
│   │   ├── index.ts
│   │   ├── vector-matcher.ts
│   │   ├── history-matcher.ts
│   │   ├── ai-recommender.ts
│   │   └── score-aggregator.ts
│   │
│   └── modern/                   # Modern 策略
│       ├── index.ts
│       ├── classification-pipeline.service.ts
│       ├── l0-rule-matcher.ts
│       ├── t0-generator.ts
│       ├── t1-corrector.ts
│       ├── hybrid-retriever.ts
│       ├── folder-profiler/      # 文件夹画像
│       ├── gardener/             # 文件夹园丁
│       └── crystal/              # 晶体生长
│           ├── crystal-growth/
│           ├── integration/
│           ├── quota/
│           └── notification/
│
├── infrastructure/               # 基础设施层
│   ├── container.ts              # 依赖注入容器
│   ├── feature-flags.ts          # 统一 Feature Flags
│   ├── repositories/             # 数据访问层
│   └── shared/                   # 共享服务
│       ├── embedding/
│       ├── llm/
│       ├── vector-search/
│       └── logger/
│
└── api/                          # API 适配层（可选）
    ├── classify.handler.ts
    ├── feedback.handler.ts
    └── rules.handler.ts
```

---

## 三、核心组件

### 3.1 ClassificationFacade

统一门面，对外提供单一 API 入口。

```typescript
import { getClassificationFacade } from "@/lib/classification";

const facade = getClassificationFacade();
const result = await facade.classify({
  userId: "user-123",
  bookmarkId: "456",
  title: "React 18 新特性详解",
  summary: "介绍 React 18 的并发渲染...",
  tags: ["react", "前端"],
  url: "https://example.com/article",
});
```

### 3.2 StrategyResolver

策略解析器，根据用户和配置选择执行策略。

**选择逻辑**:

1. 环境变量 `CLASSIFICATION_VERSION=v4.1` → 强制使用 Classic
2. 用户在黑名单 → Classic
3. 用户在白名单 → Modern
4. 按灰度比例分桶 → Classic 或 Modern

### 3.3 Modern Pipeline

L0 → T0 → T1 三阶段流水线：

| 阶段 | 说明                         | 延迟       |
| ---- | ---------------------------- | ---------- |
| L0   | 规则匹配（域名/标签/关键词） | < 10ms     |
| T0   | 向量检索 + 快速决策          | 50-100ms   |
| T1   | LLM 纠正（低置信度时触发）   | 500-2000ms |

### 3.4 晶体生长 (Crystal Growth)

V5.5 功能，用于 Inbox 书签的自动聚类和文件夹创建。

**Feature Flag**: `CLASSIFICATION_ENABLE_CRYSTAL=true`

---

## 四、数据流

```
用户收藏书签
      │
      ▼
┌─────────────────┐
│ ClassificationFacade.classify()
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ StrategyResolver.resolve(userId)
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
 Classic   Modern
    │         │
    │    ┌────┴────┐
    │    ▼         ▼
    │   L0       T0→T1
    │    │         │
    └────┴────┬────┘
              ▼
      ClassificationResult
      {
        folderId: "123",
        confidence: 0.85,
        usedT1: false,
        ...
      }
```

---

## 五、相关文档

- [API 参考](./api.md)
- [配置指南](./configuration.md)
- [迁移指南](./migration-guide.md)

---

## 六、版本历史

| 版本 | 日期       | 变更                                               |
| ---- | ---------- | -------------------------------------------------- |
| v2.0 | 2026-01-24 | 架构重构：双策略架构、统一门面、Feature Flags 合并 |
| v1.0 | 2025-12-01 | 初始版本                                           |
