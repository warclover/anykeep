# 智能分类调试工具 (Classification Debugger)

V3 vs V4 分类对比调试工具，用于开发者测试和分析智能分类算法。

## 功能概述

- **V3/V4 对比**：同时执行 V3 和 V4 分类，对比结果差异
- **测试场景**：支持冷启动、学习期、成熟用户等预设场景
- **配置预设**：默认、高精度、快速模式等多种配置
- **数据隔离**：所有测试在 dry-run 模式下执行，不影响生产数据

## 快速开始

### 1. 启用功能

在 `.env.local` 中添加：

```bash
# 前端功能开关
NEXT_PUBLIC_ENABLE_CLASSIFICATION_DEBUGGER=true

# 后端 API 开关
ENABLE_CLASSIFICATION_DEBUGGER=true
```

### 2. 访问调试工具

启动开发服务器后访问：

```
http://localhost:3000/dev/classification-debugger
```

## 目录结构

```
src/features/classification-debugger/
├── index.ts                 # 主入口，统一导出
├── README.md               # 本文档
├── types/
│   └── debugger.types.ts   # 类型定义
├── constants/
│   ├── presets.ts          # 预设配置
│   └── mock-scenarios.ts   # Mock 场景数据
├── services/
│   ├── compare.service.ts  # 对比服务
│   ├── executor.service.ts # 分类执行器
│   └── mock-context.service.ts # Mock 上下文
├── components/
│   ├── DebuggerPage.tsx    # 主页面
│   ├── BookmarkInput.tsx   # 书签输入
│   ├── ScenarioSelector.tsx # 场景选择
│   ├── ConfigPanel.tsx     # 配置面板
│   └── ResultsCompare.tsx  # 结果对比
├── hooks/
│   └── useClassificationCompare.ts # 对比 Hook
└── api/
    └── compare.ts          # API 处理函数
```

## 测试场景

| 场景            | 说明                         |
| --------------- | ---------------------------- |
| `cold-start`    | 冷启动用户，无历史数据       |
| `learning`      | 学习期用户，少量历史数据     |
| `mature`        | 成熟用户，丰富历史数据       |
| `real-readonly` | 使用当前用户真实数据（只读） |

## 预设配置

| 预设                   | 说明                        |
| ---------------------- | --------------------------- |
| `default`              | V4 推荐配置，平衡精度与速度 |
| `high-precision`       | 高精度模式，提高阈值        |
| `fast-mode`            | 快速模式，跳过部分计算      |
| `cold-start-optimized` | 冷启动优化配置              |

## API 使用

```typescript
// POST /api/dev/classification-compare
const response = await fetch("/api/dev/classification-compare", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    bookmark: {
      url: "https://example.com/article",
      title: "示例文章",
      description: "可选描述",
    },
    scenario: "learning",
    preset: "default",
  }),
});

const result = await response.json();
// result: CompareResponse
```

## 移除功能

删除以下目录和文件即可完全移除此功能：

```bash
rm -rf src/features/classification-debugger
rm src/app/(main)/dev/classification-debugger/page.tsx
rm src/app/api/dev/classification-compare/route.ts
```

同时移除环境变量中的 `ENABLE_CLASSIFICATION_DEBUGGER` 和 `NEXT_PUBLIC_ENABLE_CLASSIFICATION_DEBUGGER`。

## 注意事项

1. **仅用于开发环境**：生产环境应保持环境变量未设置或设为 `false`
2. **数据隔离**：所有测试均在 dry-run 模式下执行，不会写入数据库
3. **AI 调用成本**：每次对比需要两次 AI 调用，请控制测试频率
