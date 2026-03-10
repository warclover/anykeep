# Classification Module

## 模块概述

智能书签分类系统，基于多策略混合匹配实现自动分类。

**文件统计**: 130+ TypeScript 文件
**核心版本**: V4.1 (SimpleClassificationService)

## 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                    Classification Module                     │
├─────────────────────────────────────────────────────────────┤
│  integration.ts  ←── 入口层：API 调用入口                    │
├─────────────────────────────────────────────────────────────┤
│  container.ts    ←── 依赖注入容器                            │
├─────────────────────────────────────────────────────────────┤
│  services/                                                   │
│  ├── simple-classification.service.ts  (V4.1 主服务)        │
│  ├── classification.service.ts         (V3 备用)            │
│  ├── smart-sorting.service.ts          (V4.2 智能分拣)      │
│  └── inbox-organizer.service.ts        (收件箱整理)         │
├─────────────────────────────────────────────────────────────┤
│  strategies/                                                 │
│  ├── ai-recommender.ts      (AI 推荐)                       │
│  ├── history-matcher.ts     (历史匹配)                      │
│  └── score-aggregator.ts    (分数聚合)                      │
├─────────────────────────────────────────────────────────────┤
│  v3/                                                         │
│  ├── services/              (V3 服务层)                     │
│  ├── strategies/            (V3 匹配策略)                   │
│  └── prompts/               (V3 AI 提示词)                  │
├─────────────────────────────────────────────────────────────┤
│  calibration/               (准确率追踪)                     │
│  learning/                  (反馈学习)                       │
│  profile/                   (用户画像)                       │
│  utils/                     (工具函数)                       │
└─────────────────────────────────────────────────────────────┘
```

## 核心 API

### 入口函数

```typescript
// 推荐使用：V4.1 分类入口
import { classifyBookmarkV2 } from "@/lib/classification/integration";

const result = await classifyBookmarkV2(
  bookmarkId,
  title,
  summary,
  tags,
  userId,
);
```

### 容器模式

```typescript
import { ClassificationContainer } from "@/lib/classification";

const container = ClassificationContainer.initialize(supabase);
const service = container.getClassificationService();
```

## 目录结构

| 目录            | 职责            | 文件数 |
| --------------- | --------------- | ------ |
| `services/`     | 核心服务类      | ~20    |
| `strategies/`   | 匹配策略        | ~5     |
| `v3/`           | V3 分类系统     | ~40    |
| `types/`        | TypeScript 类型 | ~10    |
| `utils/`        | 工具函数        | ~5     |
| `constants/`    | 常量定义        | ~3     |
| `repositories/` | 数据访问层      | ~5     |
| `calibration/`  | 准确率追踪      | ~3     |
| `learning/`     | 反馈学习        | ~5     |
| `prompts/`      | AI 提示词       | ~3     |

## 版本历史

| 版本 | 特性                           | 状态         |
| ---- | ------------------------------ | ------------ |
| V3   | 5层匹配器（KNN + 指纹 + 通用） | 备用         |
| V4.1 | SimpleClassificationService    | **当前默认** |
| V4.2 | 智能分拣 + 聚类确认            | 增强功能     |

## 重构机会

### 高优先级

1. **integration.ts (860行)** - 可拆分为：
   - `classification-executor.ts` - 分类执行逻辑
   - `confirmation-handler.ts` - 确认消息处理
   - `profile-updater.ts` - 画像更新逻辑

2. **smart-sorting.service.ts** - 超大服务，可按功能拆分

### 中优先级

1. V3 子模块可考虑独立为 `@/lib/classification-v3`
2. 通用工具函数可提取到 `@/lib/utils/vector`

## 配置

```bash
# 环境变量
CLASSIFICATION_VERSION=v4.1  # v3 或 v4.1
```

## 测试

```bash
# 运行分类模块测试
npm test -- --testPathPattern="classification"
```

## 相关文档

- [AnyKeep 复杂度治理方案](../../../docs/AnyKeep%20复杂度治理方案.md)
- [分类系统设计文档](./docs/)

---

_最后更新: 2025-12-14_
