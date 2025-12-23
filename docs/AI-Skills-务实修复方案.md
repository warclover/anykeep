# AnyKeep AI 助手 - 务实修复方案

> **版本**: 1.0.0
> **创建日期**: 2025-12-23
> **状态**: 待审核
> **定位**: 先修复现有问题，再谈扩展

---

## 一、真实问题诊断

### 1.1 核心发现

**代码存在 ≠ 功能可用**

| 表象               | 真实问题                             |
| ------------------ | ------------------------------------ |
| "有 12+ 个 Tools"  | LLM 因系统提示词过度警告，倾向不调用 |
| "有 3 个 Skills"   | Tool/Skill 参数过多，LLM 经常调错    |
| "有确认流程"       | 确认机制说明不清，LLM 理解混乱       |
| "有 21 个 UI 组件" | 前后端状态同步有问题，体验割裂       |

### 1.2 根本原因

```
┌─────────────────────────────────────────────────────────────────────┐
│                      问题根因分析                                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. 系统提示词设计失败                                               │
│     ├── "危险操作"、"非常重要"、"绝对不要" 频繁出现                  │
│     ├── LLM 进入"过度谨慎模式"，倾向回避调用工具                     │
│     └── 结果：用户问"给这个加标签"，LLM 只回复"您可以..."            │
│                                                                     │
│  2. Tool 调用门槛过高                                                │
│     ├── 单个 Tool 有 7+ 个可选参数                                  │
│     ├── 参数描述太长，LLM 不会完整读取                               │
│     ├── 没有常见用法示例                                             │
│     └── 结果：LLM 宁可对话也不愿调用 Tool                            │
│                                                                     │
│  3. 确认流程"讲不清"                                                 │
│     ├── 系统提示词说"不要重复确认"                                   │
│     ├── 但 LLM 不理解前端会自动弹出确认对话框                        │
│     └── 结果：LLM 反复说"需要您确认"或完全不提                       │
│                                                                     │
│  4. 缺少端到端验证                                                   │
│     ├── 单元测试通过，但没有真实场景测试                             │
│     └── 结果：开发者以为没问题，用户实际体验差                       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 二、修复优先级

> **原则：先让现有功能真正可用，再谈扩展**

### 2.1 修复优先级排序

| 优先级 | 问题           | 影响 | 修复成本 |
| ------ | -------------- | ---- | -------- |
| **P0** | 系统提示词重写 | 致命 | 低 (4h)  |
| **P0** | Tool 参数简化  | 严重 | 中 (8h)  |
| **P1** | 确认流程重设计 | 严重 | 中 (6h)  |
| **P1** | 错误处理改善   | 中等 | 低 (4h)  |
| **P2** | 端到端测试用例 | 中等 | 中 (8h)  |

### 2.2 不做的事情（暂时）

| 功能         | 理由                           |
| ------------ | ------------------------------ |
| 学习能力模块 | 基础都没修好，加新功能只会更乱 |
| 主动感知模块 | 同上                           |
| 工作流编排   | 同上                           |
| 知识图谱 UI  | 同上                           |

---

## 三、P0 修复：系统提示词重写

### 3.1 当前问题

```typescript
// 当前系统提示词（问题版本）
const CURRENT_SYSTEM_PROMPT = `
你是 AnyKeep 的 AI 知识助手...

**可用工具**：
- count_bookmarks: 统计书签数量...
- list_bookmarks: 获取书签列表...
... (7 个工具的详细说明)

⚠️ 批量操作注意事项（非常重要）：
- batch_tags 和 move_bookmarks 是危险操作，会修改多个书签
- 调用这些工具后，系统会自动在界面上显示确认对话框
- 你不需要也不应该再通过对话要求用户确认...
- 绝对不要反复询问用户"请确认"或"确认吗"...

⚠️ 重要：始终使用中文回复...
`;
```

**问题**：

- "危险"、"非常重要"、"绝对不要" 激活 LLM 的过度谨慎
- 工具说明太长，LLM 不会完整读取
- 负面指令太多，LLM 不知道该做什么

### 3.2 修复方案

```typescript
// 新系统提示词（修复版本）
const NEW_SYSTEM_PROMPT = `
你是 AnyKeep 的 AI 知识助手，帮助用户管理收藏的内容。

## 你的工作方式

用户说什么，你就做什么。不需要过多解释或询问。

## 可用工具

### 查询类（随时使用）
- count_bookmarks(folder_id?, platform?) → 统计数量
- list_bookmarks(limit?, folder_id?) → 获取列表
- get_stats() → 收藏统计概览

### 搜索类
- semantic_search(query) → 语义搜索
- search(query, mode?) → 关键词/语义/混合搜索

### 操作类（需用户点击确认按钮）
- batch_tags(bookmark_ids, tags, action) → 批量加/减标签
- move_bookmarks(bookmark_ids, folder_id) → 批量移动

操作类工具调用后，界面会自动弹出确认按钮。你只需说"已准备好，请点击确认"。

## 示例

用户: "我有多少收藏"
你: [调用 count_bookmarks] 你有 156 条收藏。

用户: "找一下关于 React 的"
你: [调用 semantic_search query="React"] 找到 8 条相关收藏：...

用户: "给这几个加上学习标签"
你: [调用 batch_tags] 已准备好为 3 条书签添加"学习"标签，请点击确认。

## 注意

- 直接行动，少说废话
- 用中文回复
- 调用工具时参数尽量简洁
`;
```

### 3.3 关键改变

| 改变                       | 理由                        |
| -------------------------- | --------------------------- |
| 删除所有"危险"、"警告"措辞 | 避免激活 LLM 的过度谨慎模式 |
| 工具说明精简到一行         | LLM 能快速理解              |
| 添加具体示例               | 示范正确的调用方式          |
| "直接行动，少说废话"       | 明确期望的行为风格          |
| 正面指令替代负面指令       | "只需说..."替代"不要说..."  |

### 3.4 实施任务

| 任务               | 文件                        | 预估 |
| ------------------ | --------------------------- | ---- |
| 重写系统提示词     | `knowledge-agent.ts:37-83`  | 2h   |
| 调整工具描述格式   | `knowledge-agent.ts:85-120` | 1h   |
| 测试 10 个常见场景 | 手动测试                    | 1h   |

---

## 四、P0 修复：Tool 参数简化

### 4.1 当前问题

```typescript
// 当前 list_bookmarks 参数（问题版本）
const paramsSchema = z.object({
  folder_id: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("指定文件夹 ID，仅返回该文件夹下的书签"),
  platform: z
    .string()
    .optional()
    .describe("指定平台，如 WECHAT、BROWSER_CHROME、BILIBILI 等"),
  tags: z
    .array(z.string())
    .optional()
    .describe("按标签筛选，返回包含指定标签的书签"),
  date_from: z
    .string()
    .optional()
    .describe("起始日期（ISO 格式），筛选该日期之后创建的书签"),
  date_to: z
    .string()
    .optional()
    .describe("结束日期（ISO 格式），筛选该日期之前创建的书签"),
  has_summary: z.boolean().optional().describe("是否有 AI 摘要"),
  sort_by: z.enum(["created_at", "updated_at", "title"]).optional(),
  sort_order: z.enum(["asc", "desc"]).optional(),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});
// 10 个参数！LLM 很难正确使用
```

### 4.2 修复方案：分层 Tool 设计

**策略：一个复杂 Tool 拆成多个简单 Tool**

```typescript
// 新设计：简单 Tool 组合

// Tool 1: 最常用 - 只需 1 个必填参数
const listRecentTool = {
  name: "list_recent",
  description: "获取最近的书签（最多 20 条）",
  parameters: z.object({
    limit: z.number().default(10).describe("数量，默认 10"),
  }),
};

// Tool 2: 按文件夹查 - 1 个必填参数
const listByFolderTool = {
  name: "list_by_folder",
  description: "获取某文件夹下的书签",
  parameters: z.object({
    folder_id: z.number().describe("文件夹 ID"),
    limit: z.number().default(20),
  }),
};

// Tool 3: 按平台查 - 1 个必填参数
const listByPlatformTool = {
  name: "list_by_platform",
  description: "获取某平台的书签（WECHAT/BILIBILI/BROWSER_CHROME）",
  parameters: z.object({
    platform: z.string().describe("平台名称"),
    limit: z.number().default(20),
  }),
};

// Tool 4: 高级搜索 - 保留给复杂场景
const listAdvancedTool = {
  name: "list_advanced",
  description: "高级筛选（多条件组合）",
  parameters: z.object({
    folder_id: z.number().optional(),
    platform: z.string().optional(),
    tags: z.array(z.string()).optional(),
    date_from: z.string().optional(),
    limit: z.number().default(20),
  }),
};
```

### 4.3 参数简化原则

| 原则           | 说明                                  |
| -------------- | ------------------------------------- |
| **80/20 法则** | 80% 的使用场景只需要 20% 的参数       |
| **单一职责**   | 一个 Tool 做一件事，参数不超过 3 个   |
| **合理默认值** | 大部分参数都有默认值                  |
| **清晰命名**   | Tool 名称即用途，不需要读 description |

### 4.4 需要简化的 Tools

| 当前 Tool         | 参数数 | 改进方案           |
| ----------------- | ------ | ------------------ |
| `list_bookmarks`  | 10     | 拆成 4 个简单 Tool |
| `count_bookmarks` | 5      | 拆成 3 个简单 Tool |
| `semantic_search` | 6      | 保留 2 个核心参数  |
| `batch_tags`      | 3      | 保持（已经简单）   |

### 4.5 实施任务

| 任务                       | 文件                 | 预估 |
| -------------------------- | -------------------- | ---- |
| 拆分 list_bookmarks        | `tools/query/`       | 3h   |
| 拆分 count_bookmarks       | `tools/query/`       | 2h   |
| 简化 semantic_search       | `tools/search/`      | 1h   |
| 更新 Tool 注册             | `tool-registry.ts`   | 1h   |
| 更新系统提示词中的工具列表 | `knowledge-agent.ts` | 1h   |

---

## 五、P1 修复：确认流程重设计

### 5.1 当前问题

```
当前流程（混乱）：
1. 用户说"给这几个加标签"
2. LLM 调用 batch_tags
3. Tool 返回 { __pendingConfirmation: {...} }
4. 前端弹出确认对话框
5. LLM 同时在对话中说"需要您确认吗？"（重复确认）
   或者完全不提（用户困惑为什么没反应）
```

### 5.2 修复方案

**方案：前端驱动确认，LLM 只负责描述**

```typescript
// 新的确认流程设计

// Step 1: Tool 返回结构化的待确认信息
interface PendingConfirmation {
  id: string;
  toolName: string;
  action: string; // "add_tags" | "remove_tags" | "move"
  affectedCount: number; // 影响的书签数量
  details: {
    bookmarkTitles: string[]; // 受影响书签的标题（前 3 个）
    targetValue: string; // 目标值（标签名或文件夹名）
  };
  expiresAt: string; // 过期时间
}

// Step 2: 前端收到确认信息后，自动弹出对话框
// 对话框内容：
// ┌────────────────────────────────────────┐
// │ 确认操作                                │
// │                                        │
// │ 为 3 条书签添加标签 "学习"              │
// │                                        │
// │ 受影响的书签：                          │
// │ • React 入门教程                       │
// │ • Vue3 组合式 API                      │
// │ • TypeScript 高级特性                  │
// │                                        │
// │ [取消]                    [确认执行]    │
// └────────────────────────────────────────┘

// Step 3: LLM 只需要简单说明
// "已准备好为 3 条书签添加"学习"标签，请点击上方的确认按钮。"
```

### 5.3 系统提示词中的确认说明

```typescript
// 新的确认说明（清晰版本）
const CONFIRMATION_INSTRUCTION = `
## 关于批量操作

当你调用 batch_tags 或 move_bookmarks 时：
1. 系统会自动在对话上方显示确认按钮
2. 你只需说："已准备好，请点击确认按钮"
3. 不需要询问用户"确定吗？"——按钮已经在那里了

示例回复：
✓ "已准备好为 3 条书签添加"学习"标签，请点击确认。"
✗ "您确定要为这 3 条书签添加标签吗？请回复'确认'。"
`;
```

### 5.4 前端改进

```typescript
// ai-assistant-panel.tsx 改进

// 当收到 confirmation 事件时，不只是显示对话框
// 还要在消息流中插入一个明显的提示

// 新增：确认提示组件
const ConfirmationPrompt = ({ confirmation }) => (
  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 my-2">
    <div className="flex items-center gap-2">
      <AlertCircle className="h-5 w-5 text-amber-500" />
      <span className="font-medium">等待确认</span>
    </div>
    <p className="text-sm text-amber-700 mt-1">
      {confirmation.action === 'add_tags'
        ? `为 ${confirmation.affectedCount} 条书签添加标签 "${confirmation.details.targetValue}"`
        : `将 ${confirmation.affectedCount} 条书签移动到 "${confirmation.details.targetValue}"`
      }
    </p>
    <div className="flex gap-2 mt-2">
      <Button variant="outline" size="sm" onClick={() => handleCancel(confirmation.id)}>
        取消
      </Button>
      <Button size="sm" onClick={() => handleConfirm(confirmation.id)}>
        确认执行
      </Button>
    </div>
  </div>
);
```

### 5.5 实施任务

| 任务                          | 文件                     | 预估 |
| ----------------------------- | ------------------------ | ---- |
| 改进 PendingConfirmation 结构 | `tools/action/*.ts`      | 2h   |
| 更新系统提示词确认说明        | `knowledge-agent.ts`     | 1h   |
| 新增 ConfirmationPrompt 组件  | `ai-assistant-panel.tsx` | 2h   |
| 集成测试确认流程              | 手动测试                 | 1h   |

---

## 六、P1 修复：错误处理改善

### 6.1 当前问题

```typescript
// 当前错误处理（问题版本）
catch (error) {
  const errorMessage = error instanceof Error ? error.message : "Unknown error";
  yield { type: "error", error: errorMessage };
  // 用户看到："Unknown error" 或 "PGRST301"
}
```

### 6.2 修复方案

```typescript
// 新的错误处理（友好版本）

// 错误类型映射
const ERROR_MESSAGES: Record<string, string> = {
  'PGRST301': '数据库连接超时，请稍后重试',
  'PGRST204': '没有找到符合条件的内容',
  'AUTH_ERROR': '登录已过期，请刷新页面',
  'RATE_LIMIT': 'AI 服务繁忙，请稍后重试',
  'TOOL_TIMEOUT': '操作超时，请重试',
  'VALIDATION_ERROR': '参数不正确，请换个说法',
};

function getUserFriendlyError(error: Error): string {
  // 检查已知错误码
  for (const [code, message] of Object.entries(ERROR_MESSAGES)) {
    if (error.message.includes(code)) {
      return message;
    }
  }

  // 网络错误
  if (error.message.includes('fetch') || error.message.includes('network')) {
    return '网络连接出现问题，请检查网络后重试';
  }

  // 默认错误
  return '操作遇到问题，请稍后重试';
}

// 使用
catch (error) {
  const friendlyMessage = getUserFriendlyError(error);
  logger.error({ error, originalMessage: error.message }, 'Tool execution failed');
  yield { type: "error", error: friendlyMessage };
}
```

### 6.3 实施任务

| 任务                | 文件                     | 预估 |
| ------------------- | ------------------------ | ---- |
| 创建错误消息映射    | `core/error-messages.ts` | 1h   |
| 改进 Agent 错误处理 | `knowledge-agent.ts`     | 1h   |
| 改进前端错误显示    | `ai-assistant-panel.tsx` | 1h   |
| 测试各类错误场景    | 手动测试                 | 1h   |

---

## 七、P2 修复：端到端测试用例

### 7.1 测试场景设计

```typescript
// tests/e2e/ai-assistant.spec.ts

describe("AI 助手核心功能", () => {
  // 基础查询
  test('问"我有多少收藏"返回准确数量', async () => {
    await page.fill('[data-testid="ai-input"]', "我有多少收藏");
    await page.click('[data-testid="ai-send"]');

    // 等待 LLM 调用 count_bookmarks
    await expect(
      page.locator('[data-testid="tool-call-count_bookmarks"]'),
    ).toBeVisible();

    // 验证回复包含数字
    const response = await page
      .locator('[data-testid="ai-response"]')
      .textContent();
    expect(response).toMatch(/\d+/);
  });

  // 搜索功能
  test('问"找一下关于React的"返回搜索结果', async () => {
    await page.fill('[data-testid="ai-input"]', "找一下关于React的");
    await page.click('[data-testid="ai-send"]');

    await expect(
      page.locator('[data-testid="tool-call-semantic_search"]'),
    ).toBeVisible();

    const response = await page
      .locator('[data-testid="ai-response"]')
      .textContent();
    expect(response).toContain("React");
  });

  // 批量操作 + 确认流程
  test("批量加标签显示确认按钮", async () => {
    // 先选中几个书签
    await page.click('[data-testid="bookmark-1"] [data-testid="checkbox"]');
    await page.click('[data-testid="bookmark-2"] [data-testid="checkbox"]');

    await page.fill('[data-testid="ai-input"]', "给选中的加上学习标签");
    await page.click('[data-testid="ai-send"]');

    // 验证确认组件出现
    await expect(
      page.locator('[data-testid="confirmation-prompt"]'),
    ).toBeVisible();
    await expect(page.locator('[data-testid="confirm-button"]')).toBeVisible();

    // 点击确认
    await page.click('[data-testid="confirm-button"]');

    // 验证成功提示
    await expect(page.locator('[data-testid="success-toast"]')).toBeVisible();
  });

  // 错误处理
  test("网络错误显示友好提示", async () => {
    // 模拟网络错误
    await page.route("**/api/agent/chat", (route) => route.abort());

    await page.fill('[data-testid="ai-input"]', "我有多少收藏");
    await page.click('[data-testid="ai-send"]');

    const error = await page.locator('[data-testid="ai-error"]').textContent();
    expect(error).toContain("网络");
    expect(error).not.toContain("fetch"); // 不应显示技术错误
  });
});
```

### 7.2 测试覆盖目标

| 场景类型 | 测试数量 | 覆盖率目标 |
| -------- | -------- | ---------- |
| 基础查询 | 5        | 100%       |
| 搜索功能 | 3        | 100%       |
| 批量操作 | 4        | 100%       |
| 错误处理 | 4        | 100%       |
| 边界情况 | 4        | 80%        |

### 7.3 实施任务

| 任务                  | 文件                             | 预估 |
| --------------------- | -------------------------------- | ---- |
| 创建 E2E 测试文件     | `tests/e2e/ai-assistant.spec.ts` | 4h   |
| 添加 data-testid 属性 | 相关组件                         | 2h   |
| 运行并修复失败测试    | -                                | 2h   |

---

## 八、实施时间线

### 8.1 总体规划

```
┌─────────────────────────────────────────────────────────────────────┐
│                      务实修复时间线 (2 周)                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Week 1: P0 核心修复                                                │
│  ├── Day 1-2: 系统提示词重写 + 测试                                 │
│  ├── Day 3-4: Tool 参数简化 (list/count)                            │
│  └── Day 5: Tool 参数简化 (search) + 集成测试                        │
│                                                                     │
│  Week 2: P1/P2 改进                                                 │
│  ├── Day 1-2: 确认流程重设计                                        │
│  ├── Day 3: 错误处理改善                                            │
│  ├── Day 4-5: E2E 测试 + 修复                                       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 8.2 工作量汇总

| 模块           | 工时    | 占比 |
| -------------- | ------- | ---- |
| 系统提示词重写 | 4h      | 13%  |
| Tool 参数简化  | 8h      | 27%  |
| 确认流程重设计 | 6h      | 20%  |
| 错误处理改善   | 4h      | 13%  |
| E2E 测试       | 8h      | 27%  |
| **总计**       | **30h** | 100% |

**预估周期**: 2 周（按每周 15h 有效工作时间）

---

## 九、成功标准

### 9.1 功能验收

| 测试场景          | 预期结果                            |
| ----------------- | ----------------------------------- |
| "我有多少收藏"    | 立即调用 count Tool，返回准确数字   |
| "找关于 React 的" | 立即调用 search Tool，返回结果列表  |
| "最近收藏了什么"  | 立即调用 list_recent Tool，返回列表 |
| "给这个加标签"    | 调用 batch_tags，显示确认按钮       |
| 网络错误时        | 显示"网络连接出现问题"而非技术错误  |

### 9.2 用户体验指标

| 指标               | 当前      | 目标 |
| ------------------ | --------- | ---- |
| Tool 调用成功率    | ~30% (估) | >90% |
| 用户问题首次解决率 | ~20% (估) | >70% |
| 确认流程完成率     | ~50% (估) | >95% |
| 平均响应时间       | ~5s       | <3s  |

---

## 十、风险与备选方案

### 10.1 风险评估

| 风险                     | 概率 | 影响 | 缓解措施                   |
| ------------------------ | ---- | ---- | -------------------------- |
| LLM 仍不调用工具         | 中   | 高   | 进一步简化提示词，增加示例 |
| 拆分 Tool 导致兼容性问题 | 低   | 中   | 保留旧 Tool 作为别名       |
| E2E 测试不稳定           | 中   | 低   | 增加重试和等待时间         |

### 10.2 备选方案

**如果修复后仍不理想**：

1. **降级到 Claude 3.5 Sonnet**：Tool calling 能力更强
2. **使用 Function Calling 而非 Tool Calling**：某些场景下更稳定
3. **预设指令按钮**：减少对 LLM 理解能力的依赖

---

## 十一、审核确认项

### 11.1 修复范围

- [ ] **确认**: 先修复现有功能，暂不添加新功能
- [ ] **确认**: P0 系统提示词 + Tool 简化优先

### 11.2 技术方案

- [ ] **确认**: 拆分复杂 Tool 为多个简单 Tool
- [ ] **确认**: 确认按钮内嵌到消息流中
- [ ] **确认**: 错误消息友好化处理

### 11.3 测试策略

- [ ] **确认**: 添加 E2E 测试覆盖核心场景
- [ ] **确认**: 每次修改后手动测试 10 个场景

### 11.4 时间投入

- [ ] **确认**: 30h 工作量，2 周周期

---

## 十二、与原 Phase 3 规划的关系

| 原规划内容     | 本方案态度    | 理由               |
| -------------- | ------------- | ------------------ |
| 学习能力模块   | **推迟**      | 基础不牢，地动山摇 |
| 主动感知模块   | **推迟**      | 同上               |
| 工作流编排     | **推迟**      | 同上               |
| 系统提示词优化 | **提前到 P0** | 根本问题必须先解决 |
| Tool 参数设计  | **提前到 P0** | 同上               |

**修复完成后**，再按原 Phase 3 规划继续扩展功能。

---

**文档状态**: 待审核
**下一步**: 用户确认后，立即开始 P0 修复（系统提示词重写）
