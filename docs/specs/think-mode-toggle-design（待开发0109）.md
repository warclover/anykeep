# Think 模式开关设计方案

## 1. 需求概述

在 AI 助手面板中添加 **Think 模式开关**，允许用户切换 DeepSeek 模型：

| 状态             | 模型                | 说明                     |
| ---------------- | ------------------- | ------------------------ |
| **关闭**（默认） | `deepseek-chat`     | 标准对话模型，响应快     |
| **开启**         | `deepseek-reasoner` | 推理增强模型，思考更深入 |

---

## 2. 架构设计

### 2.1 数据流

```
┌─────────────────────────────────────────────────────────────────┐
│                        前端 (React)                              │
├─────────────────────────────────────────────────────────────────┤
│  AIPanelContentEnhanced                                         │
│    ├── [新增] ThinkModeToggle (开关按钮)                         │
│    │     └── state: thinkMode (boolean)                         │
│    ├── ToolSelector                                             │
│    └── AIInputEnhanced                                          │
│                    │                                            │
│                    │ thinkMode: true/false                      │
│                    ▼                                            │
└─────────────────────────────────────────────────────────────────┘
                     │
                     │ POST /api/agent/unified
                     │ { ..., options: { thinkMode: boolean } }
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                        后端 (Next.js API)                        │
├─────────────────────────────────────────────────────────────────┤
│  /api/agent/unified/route.ts                                    │
│    └── 解析 options.thinkMode                                   │
│                    │                                            │
│                    ▼                                            │
│  KnowledgeAgentStreamExecutor                                   │
│    └── [修改] selectProvider({ thinkMode })                     │
│                    │                                            │
│                    ▼                                            │
│  AIProviderRouter                                               │
│    └── [新增] 根据 thinkMode 选择模型                            │
│         ├── thinkMode=false → deepseek-chat                     │
│         └── thinkMode=true  → deepseek-reasoner                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 核心组件

| 层级     | 组件                           | 修改内容                   |
| -------- | ------------------------------ | -------------------------- |
| **UI**   | `ThinkModeToggle`              | 新增开关按钮组件           |
| **UI**   | `AIPanelContentEnhanced`       | 集成开关状态               |
| **API**  | `/api/agent/unified`           | 扩展 schema 支持 thinkMode |
| **Core** | `KnowledgeAgentStreamExecutor` | 传递 thinkMode 到模型选择  |
| **Core** | `AIProviderRouter`             | 根据 thinkMode 选择模型    |
| **Type** | `types.ts`                     | 新增 thinkMode 类型定义    |

---

## 3. 详细设计

### 3.1 新增组件: ThinkModeToggle

**文件**: `src/components/ai/phase4/think-mode-toggle.tsx`

```tsx
/**
 * Think 模式开关组件
 *
 * 功能：
 * - 切换 DeepSeek 模型（chat ↔ reasoner）
 * - 显示当前状态和说明
 * - 支持 Tooltip 提示
 */

interface ThinkModeToggleProps {
  value: boolean;
  onChange: (enabled: boolean) => void;
  disabled?: boolean;
  className?: string;
}

export const ThinkModeToggle = memo(function ThinkModeToggle({
  value,
  onChange,
  disabled = false,
  className,
}: ThinkModeToggleProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange(!value)}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5",
              "text-sm font-medium transition-all duration-200",
              value
                ? "bg-gradient-to-r from-purple-100 to-indigo-100 text-purple-600"
                : "text-gray-400 hover:text-gray-600",
              disabled && "opacity-50 cursor-not-allowed",
              className,
            )}
          >
            <Brain className={cn("h-4 w-4", value && "animate-pulse")} />
            <span className="text-xs">Think</span>
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <div className="flex flex-col gap-0.5">
            <span className="font-medium">
              {value ? "深度思考模式" : "标准模式"}
            </span>
            <span className="text-xs text-gray-300">
              {value
                ? "使用推理增强模型，适合复杂问题"
                : "使用标准模型，响应更快"}
            </span>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});
```

**UI 布局位置**: 放置在工具选择器右侧

```
┌─────────────────────────────────────────────────────────────┐
│  AI 知识助手                                           [X]  │
├─────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────┐  ┌──────────────┐   │
│  │ ✨智能  🔍搜索  📂整理  ✍️创作  📤导出│  │ 🧠 Think    │   │
│  └───────────────────────────────────┘  └──────────────┘   │
│                                              ↑              │
│                                         新增开关按钮        │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 修改: AIPanelContentEnhanced

**文件**: `src/components/ai/ai-panel-content-enhanced.tsx`

```tsx
// 新增状态
const [thinkMode, setThinkMode] = useState(false);

// 在 handleSubmit 中传递 thinkMode
const handleSubmit = async () => {
  // ...
  const response = await fetch("/api/agent/unified", {
    method: "POST",
    body: JSON.stringify({
      message,
      conversationId,
      // ...其他参数
      options: {
        enableUnified: true,
        streaming: true,
        thinkMode, // 新增
      },
    }),
  });
};

// UI 部分：在 ToolSelector 旁边添加 ThinkModeToggle
<div className="flex items-center gap-2">
  <ToolSelector value={selectedTool} onChange={setSelectedTool} />
  <ThinkModeToggle
    value={thinkMode}
    onChange={setThinkMode}
    disabled={isLoading}
  />
</div>;
```

### 3.3 修改: API Schema

**文件**: `src/app/api/agent/unified/route.ts`

```typescript
// 扩展 options schema
const optionsSchema = z.object({
  enableUnified: z.boolean().default(true),
  streaming: z.boolean().default(true),
  forceMode: z.enum(["atomic", "orchestration"]).optional(),
  thinkMode: z.boolean().default(false), // 新增
});

// 在处理逻辑中传递
const agent = new KnowledgeAgent({
  // ...
  executeOptions: {
    thinkMode: body.options?.thinkMode ?? false,
  },
});
```

### 3.4 修改: KnowledgeAgentStreamExecutor

**文件**: `src/lib/ai-agent/core/knowledge-agent-stream.ts`

```typescript
// 扩展 executeStream 方法
async *executeStream(
  input: string,
  context: AgentContext,
  options: Partial<AgentExecuteOptions> = {},
): AsyncGenerator<AgentStreamChunk> {
  // ...

  // 根据 thinkMode 选择模型
  const selection = aiProviderRouter.selectProvider({
    taskType: "tool_calling",
    requiresToolCalling: true,
    requiresStreaming: true,
    thinkMode: options.thinkMode ?? false, // 新增
  });

  // ...
}
```

### 3.5 修改: AIProviderRouter

**文件**: `src/lib/ai-providers/provider-router.ts`

```typescript
// 扩展 RoutingDecisionInput 类型
interface RoutingDecisionInput {
  taskType: AITaskType;
  requiresToolCalling?: boolean;
  requiresStreaming?: boolean;
  maxCostFactor?: number;
  thinkMode?: boolean; // 新增
}

// 修改 selectProvider 方法
selectProvider(input: RoutingDecisionInput): ProviderSelection | null {
  const { thinkMode = false, ...rest } = input;

  // 获取 DeepSeek provider
  const provider = this.getHealthyProvider("deepseek");
  if (!provider) {
    return this.fallbackSelection(rest);
  }

  // 根据 thinkMode 选择模型
  const modelId = thinkMode ? "deepseek-reasoner" : "deepseek-chat";

  const model = this.createModel(provider, modelId);

  return {
    provider,
    model,
    modelId,
    reason: thinkMode
      ? "Think mode enabled - using deepseek-reasoner"
      : "Standard mode - using deepseek-chat",
  };
}
```

### 3.6 类型定义

**文件**: `src/lib/ai-agent/core/types.ts`

```typescript
// 扩展 AgentExecuteOptions
export interface AgentExecuteOptions {
  maxTokens?: number;
  temperature?: number;
  maxToolRounds?: number;
  signal?: AbortSignal;
  thinkMode?: boolean; // 新增
}
```

**文件**: `src/components/ai/phase4/types.ts`

```typescript
// 导出 ThinkModeToggle 的 props 类型
export interface ThinkModeToggleProps {
  value: boolean;
  onChange: (enabled: boolean) => void;
  disabled?: boolean;
  className?: string;
}
```

---

## 4. 实现步骤

### Phase 1: 类型定义（0.5h）

1. 扩展 `AgentExecuteOptions` 类型
2. 扩展 `RoutingDecisionInput` 类型
3. 添加 `ThinkModeToggleProps` 类型

### Phase 2: 后端逻辑（1h）

1. 修改 `AIProviderRouter.selectProvider()` 支持 thinkMode
2. 修改 `KnowledgeAgentStreamExecutor` 传递 thinkMode
3. 扩展 `/api/agent/unified` schema

### Phase 3: 前端组件（1h）

1. 创建 `ThinkModeToggle` 组件
2. 集成到 `AIPanelContentEnhanced`
3. 添加状态管理和 API 调用

### Phase 4: 测试（0.5h）

1. 单元测试：ThinkModeToggle 组件
2. 集成测试：API 模型选择
3. E2E 测试：开关功能

---

## 5. UI/UX 细节

### 5.1 视觉设计

| 状态     | 样式                                  |
| -------- | ------------------------------------- |
| **关闭** | 灰色图标 + 灰色文字，透明背景         |
| **开启** | 紫色渐变背景 + 紫色文字，图标轻微动画 |
| **禁用** | 50% 透明度，禁止点击                  |

### 5.2 交互行为

- **点击切换**: 单击即切换状态
- **Tooltip**: 悬停显示当前模式说明
- **加载中禁用**: AI 响应时禁止切换
- **状态持久化**: 可选 - 记住用户偏好

### 5.3 位置布局

```
┌─────────────────────────────────────────────────────────────────┐
│  标题栏                                                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  工具选择器区域                                                   │
│  ┌──────────────────────────────────────┐ ┌─────────────────┐   │
│  │ ✨ 🔍 📂 ✍️ 📤                         │ │ 🧠 Think        │   │
│  │ 工具选择器 (ToolSelector)             │ │ 思考模式开关     │   │
│  └──────────────────────────────────────┘ └─────────────────┘   │
│                                                                  │
│  消息列表区域                                                     │
│  ...                                                             │
│                                                                  │
│  输入区域                                                         │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ 输入框 (AIInputEnhanced)                                  │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. 注意事项

### 6.1 兼容性

- `deepseek-reasoner` 可能有更长的响应时间（12-30s vs 1.5-4s）
- 需要在 UI 上提示用户等待

### 6.2 成本控制

- `deepseek-reasoner` 成本约为 `deepseek-chat` 的 4 倍
- 可考虑添加使用统计或限制

### 6.3 错误处理

- 如果 `deepseek-reasoner` 不可用，自动降级到 `deepseek-chat`
- 显示友好的错误提示

### 6.4 Feature Flag（可选）

```typescript
// feature-flags.ts
ENABLE_THINK_MODE: process.env.ENABLE_THINK_MODE !== "false", // 默认开启
```

---

## 7. 文件变更清单

| 文件                                              | 操作     | 说明           |
| ------------------------------------------------- | -------- | -------------- |
| `src/components/ai/phase4/think-mode-toggle.tsx`  | **新增** | Think 开关组件 |
| `src/components/ai/phase4/index.ts`               | 修改     | 导出新组件     |
| `src/components/ai/phase4/types.ts`               | 修改     | 添加类型定义   |
| `src/components/ai/ai-panel-content-enhanced.tsx` | 修改     | 集成开关       |
| `src/app/api/agent/unified/route.ts`              | 修改     | 扩展 schema    |
| `src/lib/ai-agent/core/types.ts`                  | 修改     | 扩展选项类型   |
| `src/lib/ai-agent/core/knowledge-agent-stream.ts` | 修改     | 传递 thinkMode |
| `src/lib/ai-providers/provider-router.ts`         | 修改     | 模型选择逻辑   |
| `src/lib/ai-providers/types.ts`                   | 修改     | 扩展输入类型   |

---

## 8. 测试用例

### 8.1 单元测试

```typescript
describe("ThinkModeToggle", () => {
  it("should render in off state by default");
  it("should toggle state on click");
  it("should be disabled when disabled prop is true");
  it("should call onChange with new value");
});
```

### 8.2 集成测试

```typescript
describe("AIProviderRouter with thinkMode", () => {
  it("should select deepseek-chat when thinkMode is false");
  it("should select deepseek-reasoner when thinkMode is true");
  it("should fallback to deepseek-chat if reasoner unavailable");
});
```

---

**审核问题**:

1. 开关位置是否合适？（目前设计在工具选择器右侧）
2. 是否需要状态持久化（localStorage/用户偏好）？
3. 是否需要 Feature Flag 控制？
4. 是否需要使用限制或成本提示？
