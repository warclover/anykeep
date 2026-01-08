# AnyKeep AI Feature Flags 配置指南

本文档详细说明 AnyKeep AI 功能的 Feature Flags 配置。所有开关通过环境变量控制，支持热切换和回滚。

## 快速开始

在 `.env.local` 文件中配置：

```bash
# 默认启用的功能无需配置
# 只需配置要禁用的功能或启用默认关闭的功能

# 禁用某功能
ENABLE_DYNAMIC_CONTEXT=false

# 启用默认关闭的功能
ENABLE_REACT_LOOP=true
```

---

## 功能开关一览

### 核心 AI 能力

| 环境变量                     | 默认值 | 说明                                 |
| ---------------------------- | ------ | ------------------------------------ |
| `ENABLE_DYNAMIC_CONTEXT`     | `true` | 动态上下文注入（收藏统计、时间感知） |
| `ENABLE_MODEL_TIERING`       | `true` | 模型分层策略（fast/standard/deep）   |
| `ENABLE_REACT_PROMPT`        | `true` | ReAct 风格 Prompt                    |
| `ENABLE_REASONING`           | `true` | 记录 AI 决策理由                     |
| `ENABLE_ERROR_RECOVERY`      | `true` | 智能错误恢复和重试                   |
| `ENABLE_PREFERENCE_LEARNING` | `true` | 用户偏好学习                         |
| `ENABLE_COST_CONTROL`        | `true` | Token 预算管理                       |

---

### 任务理解层 v1（零接管模式）

| 环境变量                        | 默认值 | 说明                           |
| ------------------------------- | ------ | ------------------------------ |
| `ENABLE_TASK_UNDERSTANDING`     | `true` | 深度任务理解能力（总开关）     |
| `ENABLE_SMART_DEFAULTS`         | `true` | AI 自主决策参数                |
| `ENABLE_ZERO_TAKEOVER`          | `true` | 静默理解 → 直接执行 → 事后撤销 |
| `ENABLE_UNDO_SERVICE`           | `true` | 操作回滚支持                   |
| `ENABLE_PREFERENCE_LEARNING_V2` | `true` | 从撤销/调整行为学习            |

---

### 任务理解层 v2.0

| 环境变量                     | 默认值 | 说明                     |
| ---------------------------- | ------ | ------------------------ |
| `ENABLE_V2_PROMPT`           | `true` | 增强版 System Prompt     |
| `ENABLE_CONFIDENCE_TIERING`  | `true` | 置信度分层执行策略       |
| `ENABLE_IMPLICIT_INTENT`     | `true` | 隐含意图推断             |
| `ENABLE_SYSTEM_REMINDER`     | `true` | System-Reminder 动态注入 |
| `ENABLE_ENHANCED_CONFIDENCE` | `true` | 多因素置信度计算         |

**置信度分层策略**：

- ≥85%：静默执行，完成后简短汇报
- 60-84%：执行 + 简要解释
- <60%：轻量级选项式澄清

---

### 情景记忆（Episodic Memory）

| 环境变量                         | 默认值 | 说明                     |
| -------------------------------- | ------ | ------------------------ |
| `ENABLE_EPISODIC_MEMORY`         | `true` | 跨会话记忆能力（总开关） |
| `ENABLE_INTERACTION_LOGGING`     | `true` | 记录用户交互行为         |
| `ENABLE_MEMORY_PROMPT`           | `true` | 情景记忆注入 Prompt      |
| `ENABLE_PENDING_INTENT_REMINDER` | `true` | 未完成意图提醒           |

---

### 上下文管理

| 环境变量                          | 默认值 | 说明           |
| --------------------------------- | ------ | -------------- |
| `ENABLE_CONVERSATION_COMPRESSION` | `true` | 长对话自动压缩 |

---

### ReAct 循环与引用追踪

| 环境变量                   | 默认值      | 说明                                 |
| -------------------------- | ----------- | ------------------------------------ |
| `ENABLE_REACT_LOOP`        | **`false`** | Think → Act → Observe 循环（灰度中） |
| `ENABLE_CITATION_TRACKING` | `true`      | 搜索结果 [^N] 格式引用               |

---

### 多用户画像

| 环境变量                      | 默认值      | 说明                         |
| ----------------------------- | ----------- | ---------------------------- |
| `ENABLE_MULTI_PERSONA`        | **`false`** | 多画像功能（主开关，灰度中） |
| `ENABLE_PERSONA_INFERENCE`    | `true`      | 自动推断用户画像             |
| `ENABLE_PERSONA_PROMPTS`      | `true`      | 画像专属 Prompt              |
| `ENABLE_PERSONA_INTENT_BOOST` | `true`      | 画像意图权重加成             |
| `ENABLE_PERSONA_SETTINGS_UI`  | **`false`** | 设置页面画像入口             |
| `ENABLE_PM_PERSONA`           | `true`      | 产品经理画像                 |
| `ENABLE_CONSULTANT_PERSONA`   | `true`      | 咨询顾问画像                 |
| `ENABLE_TEACHER_PERSONA`      | `true`      | 大学教师画像                 |
| `PERSONA_ROLLOUT_PERCENTAGE`  | `0`         | 灰度发布百分比（0-100）      |

---

### RAG 能力增强

#### Phase 1

| 环境变量                         | 默认值 | 说明                     |
| -------------------------------- | ------ | ------------------------ |
| `ENABLE_QUERY_REWRITE`           | `true` | LLM 查询改写（语义扩展） |
| `ENABLE_RERANK`                  | `true` | 交叉编码器重排序         |
| `ENABLE_VECTOR_CACHE`            | `true` | 向量缓存加速             |
| `ENABLE_SMART_FILTER_EXTRACTION` | `true` | 自然语言过滤条件提取     |

#### Phase 2

| 环境变量                       | 默认值 | 说明                        |
| ------------------------------ | ------ | --------------------------- |
| `ENABLE_PARENT_CHILD_CHUNKING` | `true` | Parent-Child 文档切片       |
| `ENABLE_RRF_FUSION`            | `true` | Reciprocal Rank Fusion 算法 |

#### Phase 3

| 环境变量                | 默认值 | 说明               |
| ----------------------- | ------ | ------------------ |
| `ENABLE_RAG_MONITORING` | `true` | RAG 系统监控告警   |
| `ENABLE_RAG_EVALUATION` | `true` | RAGAS 风格质量评估 |

---

### AI 秘书进化

| 环境变量                       | 默认值      | 说明               |
| ------------------------------ | ----------- | ------------------ |
| `ENABLE_PROACTIVE_BRIEFING`    | `true`      | 用户上线主动简报   |
| `ENABLE_GLOBAL_INSIGHT`        | **`false`** | 知识库宏观画像     |
| `ENABLE_CROSS_SESSION_MEMORY`  | **`false`** | 跨会话对话上下文   |
| `ENABLE_SLOW_THINKING`         | **`false`** | System 2 深度推理  |
| `ENABLE_SLOW_THINKING_VISIBLE` | `true`      | UI 展示思考过程    |
| `ENABLE_INTENT_PREDICTION`     | **`false`** | 基于历史预测意图   |
| `ENABLE_RULE_LEARNING`         | **`false`** | 从纠正行为学习规则 |
| `ENABLE_ASYNC_ANALYSIS`        | **`false`** | 后台异步分析任务   |

---

## 配置示例

### 开发环境（全功能）

```bash
# .env.local
# 启用所有实验性功能
ENABLE_REACT_LOOP=true
ENABLE_MULTI_PERSONA=true
ENABLE_PERSONA_SETTINGS_UI=true
ENABLE_GLOBAL_INSIGHT=true
ENABLE_SLOW_THINKING=true
```

### 生产环境（稳定）

```bash
# .env.production
# 使用默认配置，仅覆盖必要项
PERSONA_ROLLOUT_PERCENTAGE=10  # 10% 用户灰度
```

### 性能优化

```bash
# 禁用高开销功能
ENABLE_SLOW_THINKING=false
ENABLE_GLOBAL_INSIGHT=false
ENABLE_ASYNC_ANALYSIS=false
```

### 调试模式

```bash
# 启用所有日志和追踪
ENABLE_REASONING=true
ENABLE_RAG_MONITORING=true
ENABLE_RAG_EVALUATION=true
```

---

## 代码使用

```typescript
import { FeatureFlags, isFeatureEnabled } from "@/lib/ai-agent/config";

// 方式 1：直接访问
if (FeatureFlags.ENABLE_REACT_LOOP) {
  // 执行 ReAct 循环
}

// 方式 2：使用辅助函数
if (isFeatureEnabled("ENABLE_DYNAMIC_CONTEXT")) {
  // 注入动态上下文
}

// 获取所有开关状态
const allFlags = getAllFeatureFlags();
console.log(allFlags);
```

---

## 注意事项

1. **默认值规则**：
   - `!== "false"` → 默认启用，设为 `false` 可禁用
   - `=== "true"` → 默认禁用，设为 `true` 可启用

2. **灰度发布**：
   - 使用 `PERSONA_ROLLOUT_PERCENTAGE` 控制画像功能灰度
   - 范围 0-100，表示启用用户百分比

3. **依赖关系**：
   - `ENABLE_SLOW_THINKING_VISIBLE` 依赖 `ENABLE_SLOW_THINKING`
   - 画像相关功能依赖 `ENABLE_MULTI_PERSONA` 主开关

4. **性能影响**：
   - `ENABLE_SLOW_THINKING`：显著增加响应时间
   - `ENABLE_GLOBAL_INSIGHT`：后台计算开销较大
   - `ENABLE_ASYNC_ANALYSIS`：需要任务队列支持

---

## 源码位置

```
src/lib/ai-agent/config/feature-flags.ts
```

---

_最后更新：2026-01-08_
