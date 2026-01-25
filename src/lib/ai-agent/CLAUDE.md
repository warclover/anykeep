[根目录](../../../CLAUDE.md) > [src](../../) > [lib](../) > **ai-agent**

# AI Agent 核心模块

## 模块职责

`src/lib/ai-agent` 负责 AI 系统的底层能力和原子交互，提供最基础的 Tool 调用、上下文管理和配置控制。它是 "Atomic Mode" 的主要执行载体。

## 目录结构

- `core/`: 核心逻辑
  - `ai-sdk-types.ts`: AI SDK 类型定义
  - `confirmation-handler.ts`: 敏感操作确认处理器
  - `error-messages.ts`: 统一错误消息
- `tools/`: 原子工具集（120+ Tools）
  - `read/`: 读取书签、列表等
  - `smart-list/`: 智能列表管理
  - `settings/`: 用户偏好与分类设置
  - `import/`, `export/`, `bookmark/` 等
- `config/`: 配置管理
  - `feature-flags.ts`: 功能开关
  - `cost-controller.ts`: 成本控制
- `context/`: 上下文增强
  - `dynamic-context-builder.ts`: 动态构建 Prompt 上下文
  - `system-reminder-injector.ts`: 系统主动提醒注入

## 关键依赖

- Vercel AI SDK (`ai`, `@ai-sdk/*`)
- Supabase Client
- Zod (Schema 验证)

## 测试策略

- **单元测试**: `__tests__` 目录覆盖核心逻辑（如 `confirmation-handler.test.ts`）。
- **E2E 测试**: 位于 `src/__tests__/e2e/ai-capabilities/`。

## 变更记录

- **2025-12-27**: 信任模式智能化 (Trust Mode)
- **2025-12-26**: Token 持久化与 Feature Flags 机制
