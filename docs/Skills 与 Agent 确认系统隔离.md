针对这条：#3 Skills 与 Agent 确认系统隔离 🔴 严重 🟡 设计如此；你有什么深度建议？

这是一个架构层面的深度问题。让我分析当前状态和提出建议：
当前确认系统架构分析

---

Read c:\anykeep\src\lib\ai-agent\core\confirmation-handler.ts

Read c:\anykeep\src\lib\ai-skills\orchestration\confirmation-handler.ts

Read c:\anykeep\src\app\api\agent\confirm\route.ts

Grep "emitConfirmation|requestConfirmation" (in src/lib/ai-skills)

4 lines of output
深度分析：确认系统隔离问题

---

### 当前架构对比

| 维度         | Agent 确认系统                          | Skills 确认系统                                   |
| ------------ | --------------------------------------- | ------------------------------------------------- |
| **位置**     | `ai-agent/core/confirmation-handler.ts` | `ai-skills/orchestration/confirmation-handler.ts` |
| **API**      | `/api/agent/confirm`                    | 无独立 API（嵌入流式响应）                        |
| **触发方式** | Tool 标记 `requiresConfirmation`        | Skill 调用 `emitConfirmation()`                   |
| **状态枚举** | `pending/confirmed/cancelled/expired`   | `pending/confirmed/rejected/expired/cancelled`    |
| **存储**     | 内存 Map + TTL                          | 内存 Map + TTL                                    |
| **使用场景** | 单次工具调用（删除、批量操作）          | 多步骤编排中间确认                                |

### 问题根源

    ┌─────────────────────────────────────────────────────────────────┐
    │                      前端 (AI Panel)                             │
    ├─────────────────────────────────────────────────────────────────┤
    │  handleConfirmation()  ← 需要识别两种不同的确认格式              │
    └───────────────┬─────────────────────────┬───────────────────────┘
                    │                         │
           ┌────────▼────────┐       ┌────────▼────────┐
           │ /api/agent/     │       │ /api/agent/     │
           │    confirm      │       │    unified      │
           │ (Tool 确认)     │       │ (流式确认)      │
           └────────┬────────┘       └────────┬────────┘
                    │                         │
           ┌────────▼────────┐       ┌────────▼────────┐
           │ Agent           │       │ Skills          │
           │ Confirmation    │       │ Confirmation    │
           │ Handler         │       │ Handler         │
           └─────────────────┘       └─────────────────┘
                    │                         │
                    └────────── 隔离 ──────────┘

### 深度建议：三种方案

#### 方案 A：统一到流式确认（推荐）

**核心思路**：废弃 `/api/agent/confirm`，所有确认都通过流式响应处理
// 统一确认协议
interface UnifiedConfirmation {
type: "confirmation";
data: {
id: string;
source: "tool" | "skill"; // 来源标识
title: string;
message: string;
options: ConfirmOption[];
preview?: unknown;
contextData?: Record<string, unknown>;
expiresAt: string;
};
}

**优点**：

- 前端只需处理一种确认格式
- 用户体验一致（都在对话流中确认）
- 代码复用最大化

**实现步骤**：

1. 将 Agent 的 `requiresConfirmation` Tool 改为在流中发出确认请求
2. 统一 `ConfirmationHandler` 到 Skills 层
3. `/api/agent/unified` 处理所有确认响应

#### 方案 B：双轨并行 + 统一前端适配器（保守）

**核心思路**：保持后端隔离，但在前端统一处理
// 前端统一适配器
class ConfirmationAdapter {
// 识别确认来源
detectSource(chunk: StreamChunk): "tool" | "skill" | null {
if (chunk.type === "confirmation") return "skill";
if (chunk.type === "tool_call" && chunk.requiresConfirmation) return "tool";
return null;
}

      // 统一确认处理
      async handleConfirmation(
        confirmation: ToolConfirmation | SkillConfirmation,
        userResponse: boolean
      ): Promise<void> {
        const source = this.detectSource(confirmation);
        if (source === "tool") {
          await fetch("/api/agent/confirm", { ... });
        } else {
          // 通过流式响应返回确认结果
          await this.sendConfirmationResponse(confirmation.id, userResponse);
        }
      }
    }

**优点**：

- 后端改动最小
- 渐进式迁移

**缺点**：

- 前端复杂度增加
- 两套后端代码仍需维护

#### 方案 C：统一到 Tool 确认（不推荐）

将 Skills 确认改为调用 Tool，通过 `/api/agent/confirm` 处理。

 

**缺点**：

- 破坏 Skills 的流式编排特性
- 确认后无法恢复多步骤执行上下文

### 我的建议

**短期（当前版本）**：采用 **方案 B** 的策略，在前端创建适配层
// src/hooks/domain/ai/use-confirmation.ts
export function useConfirmation() {
const handleConfirmation = useCallback(async (
chunk: StreamChunk,
confirmed: boolean
) => {
// Tool 确认
if (chunk.toolName && chunk.confirmationId) {
return fetch("/api/agent/confirm", {
method: "POST",
body: JSON.stringify({
confirmationId: chunk.confirmationId,
toolName: chunk.toolName,
params: chunk.params,
action: confirmed ? "confirm" : "cancel",
}),
});
}

        // Skill 确认 - 直接返回用户选择
        // Skills 通过流式响应接收并处理
        return { confirmed, optionId: confirmed ? "confirm" : "cancel" };
      }, []);

      return { handleConfirmation };
    }

**中期（下一版本）**：采用 **方案 A**，重构为统一流式确认

1. 创建统一的 `ConfirmationService`
2. Tool 确认改为发出流式 `confirmation` 事件
3. 废弃 `/api/agent/confirm`
4. 前端统一处理确认 UI

### 优先级评估

| 指标           | 当前状态 | 方案 A | 方案 B |
| -------------- | -------- | ------ | ------ |
| 实现复杂度     | -        | 高     | 中     |
| 用户体验一致性 | ❌       | ✅     | ✅     |
| 代码维护成本   | 高       | 低     | 中     |
| 向后兼容       | -        | 需迁移 | 兼容   |

**结论**：建议先实现方案 B 的前端适配器作为过渡，下一个迭代周期再重构为方案 A。这样可以：

1. 立即提升用户体验一致性
2. 不影响当前版本发布进度
3. 为完整重构积累经验
