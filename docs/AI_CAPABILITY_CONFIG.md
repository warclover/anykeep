# AI 能力升级 v4.3 - 环境变量配置指南

## Feature Flags（功能开关）

所有功能默认启用，通过设置环境变量为 `"false"` 可禁用特定功能。

| 环境变量                     | 默认值  | 说明                             |
| ---------------------------- | ------- | -------------------------------- |
| `ENABLE_DYNAMIC_CONTEXT`     | `true`  | 动态上下文注入（P0-1）           |
| `ENABLE_MODEL_TIERING`       | `true`  | 模型分层策略（P0-2）             |
| `ENABLE_REACT_PROMPT`        | `true`  | 轻量版 ReAct Prompt（P1-5）      |
| `ENABLE_REASONING`           | `true`  | reasoning 参数记录（P1-7）       |
| `ENABLE_ERROR_RECOVERY`      | `true`  | 智能错误恢复（P1-6）             |
| `ENABLE_PREFERENCE_LEARNING` | `true`  | 偏好自动学习（P2-9）             |
| `ENABLE_COST_CONTROL`        | `true`  | 成本控制（P2-10）                |
| `ENABLE_REACT_LOOP`          | `false` | ReAct 循环执行（灰度发布中）     |
| `ENABLE_CITATION_TRACKING`   | `true`  | 引用追踪系统（搜索结果自动引用） |

### 使用示例

```bash
# .env.local

# 禁用动态上下文（回滚到旧模式）
ENABLE_DYNAMIC_CONTEXT=false

# 禁用模型分层（始终使用默认模型）
ENABLE_MODEL_TIERING=false

# 禁用偏好学习（不记录用户行为）
ENABLE_PREFERENCE_LEARNING=false
```

### 快速回滚

如果新功能出现问题，可以通过设置环境变量快速回滚：

```bash
# 完全回滚到旧模式
ENABLE_DYNAMIC_CONTEXT=false
ENABLE_MODEL_TIERING=false
ENABLE_REACT_PROMPT=false
ENABLE_REASONING=false
ENABLE_ERROR_RECOVERY=false
ENABLE_PREFERENCE_LEARNING=false
ENABLE_COST_CONTROL=false
ENABLE_REACT_LOOP=false
ENABLE_CITATION_TRACKING=false
```

## ReAct 循环配置

ReAct (Reasoning + Acting) 循环让 AI 在执行任务时进行多轮思考-行动-观察。

| 参数                | 默认值 | 说明             |
| ------------------- | ------ | ---------------- |
| `maxRounds`         | 5      | 最大循环轮次     |
| `showThinking`      | true   | 是否输出思考过程 |
| `thinkingTimeoutMs` | 5000   | 思考阶段超时时间 |

### 启用 ReAct 循环

```bash
# .env.local
ENABLE_REACT_LOOP=true
```

## 引用追踪配置

引用追踪系统自动为搜索结果建立引用索引，在 AI 回答中插入脚注。

| 参数               | 默认值   | 说明                   |
| ------------------ | -------- | ---------------------- |
| `autoAnnotate`     | true     | 自动标注序数引用       |
| `appendReferences` | true     | 追加引用列表到响应末尾 |
| `referencesTitle`  | 参考来源 | 引用列表标题           |
| `minConfidence`    | 0.3      | 最低置信度阈值         |

### 禁用引用追踪

```bash
# .env.local
ENABLE_CITATION_TRACKING=false
```

## Token 预算配置

默认预算配置（在 `cost-controller.ts` 中定义）：

| 参数                       | 默认值    | 说明                |
| -------------------------- | --------- | ------------------- |
| `maxTokensPerConversation` | 8,000     | 单次会话 Token 上限 |
| `dailyBudget`              | 100,000   | 每日 Token 预算     |
| `monthlyBudget`            | 3,000,000 | 每月 Token 预算     |
| `warningThreshold`         | 0.8 (80%) | 预算警告阈值        |

### 模型成本因子

| 模型                | 成本因子 | 说明             |
| ------------------- | -------- | ---------------- |
| `gpt-4o-mini`       | 0.3      | 快速层，低成本   |
| `gpt-4o`            | 1.0      | 标准层，基准成本 |
| `gpt-4-turbo`       | 1.5      | 深度层，高成本   |
| `claude-3-haiku`    | 0.25     | 快速层，最低成本 |
| `claude-3-5-sonnet` | 1.2      | 标准/深度层      |

## 代码中使用

```typescript
import {
  FeatureFlags,
  isFeatureEnabled,
  getAllFeatureFlags,
} from "@/lib/ai-agent/config";

// 检查单个功能
if (FeatureFlags.ENABLE_DYNAMIC_CONTEXT) {
  // 构建动态上下文
}

// 使用函数检查
if (isFeatureEnabled("ENABLE_MODEL_TIERING")) {
  // 使用模型分层
}

// 获取所有开关状态
const flags = getAllFeatureFlags();
console.log(flags);
// {
//   ENABLE_DYNAMIC_CONTEXT: true,
//   ENABLE_MODEL_TIERING: true,
//   ...
// }
```

## 数据库迁移

运行以下 SQL 添加 AI 偏好字段（如果尚未迁移）：

```bash
# 使用 Supabase CLI
supabase db push

# 或在 Supabase Dashboard SQL Editor 中执行
# 见 supabase/migrations/20251226200001_add_ai_preferences.sql
```

## 验证配置

启动开发服务器后，检查控制台日志：

```bash
npm run dev
```

正常输出示例：

```
INFO: FeatureFlags loaded - all enabled
INFO: CostController initialized with default budget
INFO: PreferenceLearningService ready
```

## 故障排查

### 问题：动态上下文不生效

1. 检查环境变量：`ENABLE_DYNAMIC_CONTEXT` 是否为 `false`
2. 检查数据库：`profiles.ai_preferences` 字段是否存在
3. 检查日志：查找 `DynamicContext: build failed` 错误

### 问题：偏好学习不工作

1. 确认 `ENABLE_PREFERENCE_LEARNING=true`
2. 确认数据库迁移已执行
3. 检查 RPC 函数 `update_ai_learned_preferences` 是否存在

### 问题：成本控制不生效

1. 确认 `ENABLE_COST_CONTROL=true`
2. 检查 `CostController` 是否正确实例化
3. 查看日志中的 Token 使用记录
