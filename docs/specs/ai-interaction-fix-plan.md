# AI 交互问题修复计划

> 版本: 1.0.0
> 日期: 2025-12-26
> 状态: 待审核

## 问题诊断摘要

用户在对话中报告了三个核心问题：

| 问题       | 用户输入                  | 期望行为                    | 实际行为                           | 严重度 |
| ---------- | ------------------------- | --------------------------- | ---------------------------------- | ------ |
| 意图误判   | "把这些整理到一个文件夹"  | 移动5篇搜索结果到指定文件夹 | 触发 batch_organize，处理500条书签 | P0     |
| 取消无效   | "取消整理"                | 停止执行，返回正常状态      | 未停止，又执行了一次               | P0     |
| 上下文丢失 | "这些" (指代前文搜索结果) | 记住之前找到的5篇书签       | 忘记上下文，处理全部书签           | P1     |

---

## 问题1: 意图误判 (P0)

### 根本原因

1. **意图规则权重失衡**
   - `整理` 关键词 → `organize:cleanup` 权重 80
   - `移动/放到` 关键词 → `action:move` 权重 50
   - 用户说"整理到...文件夹"时，`整理`优先匹配

2. **模板引擎未覆盖此模式**
   - `moveToFolderTemplate` 模式：`/移(?:动)?到\s*(?<folder>...)/`
   - 不匹配 "整理到" 的表达

3. **"到文件夹" 上下文未被利用**
   - 用户意图中有明确目标"一个文件夹"，但意图分类器忽略了

### 修复方案

#### 1.1 增强模板匹配 (task-understanding/templates/templates.ts)

```typescript
// 新增：整理到文件夹模板（实际是移动操作）
export const organizeToFolderTemplate: TaskTemplate = {
  id: "organize_to_folder",
  name: "整理到文件夹",
  taskType: "move", // 注意：taskType 是 move，不是 organize
  patterns: [
    /^(?:把)?(?:这些?)?整理到\s*(?<folder>[^\s]+?)(?:文件夹)?$/i,
    /^(?:把)?(?:这些?)?归(?:档|类)到\s*(?<folder>[^\s]+?)(?:文件夹)?$/i,
    /^(?:这些?)?放到\s*(?<folder>[^\s]+?)(?:文件夹|目录)?(?:里)?$/i,
  ],
  keywords: ["整理到", "归档到", "归类到"],
  goalTemplate: "将选中的书签整理到「{folder}」文件夹",
  reasoningTemplate: "用户希望将当前选中/搜索到的书签移动到指定文件夹",
  executionPlanTemplate: [
    {
      descriptionTemplate: "确认目标文件夹「{folder}」",
      action: "find_or_create_folder",
      paramsTemplate: { folderName: "{folder}" },
    },
    {
      descriptionTemplate: "移动选中的书签",
      action: "move_bookmarks",
      paramsTemplate: { targetFolder: "{folder}" },
    },
  ],
  riskLevel: "medium",
  baseConfidence: 0.9,
  requiresConfirmation: false,
  priority: 105, // 高于 moveToFolderTemplate (100) 和 organizeGeneralTemplate (90)
  enabled: true,
};

// 更新：通用整理模板增加排除词
export const organizeGeneralTemplate: TaskTemplate = {
  // ... 现有配置
  excludeKeywords: ["按时间", "按平台", "按作者", "到文件夹", "到目录"], // 新增排除
};
```

#### 1.2 增强意图分类规则 (ai-skills/router/intent-classifier.ts)

```typescript
// 在规则数组中，增加高优先级的"移动到文件夹"规则
{
  pattern: /(?:整理|放|归[档类])到.{1,10}(?:文件夹|目录)/,
  type: "action",
  subType: "move",
  complexity: "simple",
  weight: 90,  // 高于通用"整理"的80
},
```

#### 1.3 更新默认模板列表 (task-understanding/templates/templates.ts)

```typescript
export const defaultTemplates: TaskTemplate[] = [
  // 搜索
  searchSimpleTemplate,
  // 整理到文件夹（优先于通用整理）
  organizeToFolderTemplate, // 新增
  // 整理
  organizeGeneralTemplate,
  organizeByTimeTemplate,
  // ... 其他
];
```

---

## 问题2: 取消操作无效 (P0)

### 根本原因

1. **取消只改状态，不中断执行**
   - `cancelConfirmation()` 只设置 `status = 'cancelled'`
   - 正在运行的 AsyncGenerator 没有检查取消信号

2. **Skill 执行无中断点**
   - `batch-organize.skill.ts` 的 `executeStream()` 一旦启动，无法停止

3. **前端重复请求**
   - 用户点"取消"后，可能触发新的API请求

### 修复方案

#### 2.1 添加取消信号机制 (ai-skills/orchestration/types.ts)

```typescript
// 新增：取消令牌接口
export interface CancellationToken {
  readonly isCancelled: boolean;
  readonly reason?: string;
  onCancel(callback: () => void): void;
}

// 扩展 OrchestrationContext
export interface OrchestrationContext {
  // ... 现有字段
  cancellationToken?: CancellationToken;
}
```

#### 2.2 实现取消令牌 (ai-skills/orchestration/cancellation-token.ts)

```typescript
/**
 * 取消令牌实现
 */
export class CancellationTokenSource {
  private _isCancelled = false;
  private _reason?: string;
  private callbacks: (() => void)[] = [];

  get token(): CancellationToken {
    return {
      isCancelled: this._isCancelled,
      reason: this._reason,
      onCancel: (callback) => {
        if (this._isCancelled) {
          callback();
        } else {
          this.callbacks.push(callback);
        }
      },
    };
  }

  cancel(reason?: string): void {
    if (this._isCancelled) return;
    this._isCancelled = true;
    this._reason = reason;
    this.callbacks.forEach((cb) => cb());
  }
}
```

#### 2.3 修改 batch-organize Skill (ai-skills/skills/batch-organize/batch-organize.skill.ts)

```typescript
async *executeStream(
  context: OrchestrationContext,
): AsyncGenerator<OrchestrationStreamChunk> {
  const startTime = Date.now();
  const input = context.params as BatchOrganizeInput;
  this.initProgress(ORGANIZE_STEPS);

  try {
    // Step 1: 收集数据
    yield* this.collectData(context.userId, input);

    // 检查取消信号
    if (context.cancellationToken?.isCancelled) {
      yield this.createCancelledChunk("用户取消了整理操作");
      return;
    }

    // Step 2: 获取书签
    const bookmarks = await fetchBookmarks(context.userId, input);

    // 检查取消信号
    if (context.cancellationToken?.isCancelled) {
      yield this.createCancelledChunk("用户取消了整理操作");
      return;
    }

    // ... 每个步骤后都检查取消信号
  } catch (error) {
    // ...
  }
}

private createCancelledChunk(message: string): OrchestrationStreamChunk {
  return {
    type: "cancelled",
    data: { message, timestamp: new Date().toISOString() },
  };
}
```

#### 2.4 修改 API 路由支持取消 (app/api/agent/unified/route.ts)

```typescript
// 添加取消端点
export async function DELETE(request: NextRequest) {
  const { conversationId, reason } = await request.json();

  // 获取当前会话的取消令牌
  const tokenSource = activeCancellationTokens.get(conversationId);
  if (tokenSource) {
    tokenSource.cancel(reason || "用户取消");
    activeCancellationTokens.delete(conversationId);
    return NextResponse.json({ success: true, message: "已取消" });
  }

  return NextResponse.json({ success: false, message: "无活动操作" });
}

// 在 POST 中创建取消令牌
const tokenSource = new CancellationTokenSource();
activeCancellationTokens.set(conversationId, tokenSource);

// 传递给引擎
const result = unifiedEngine.execute(message, context, {
  cancellationToken: tokenSource.token,
});
```

#### 2.5 添加取消意图模板 (task-understanding/templates/templates.ts)

```typescript
export const cancelOperationTemplate: TaskTemplate = {
  id: "cancel_operation",
  name: "取消操作",
  taskType: "cancel",
  patterns: [
    /^取消(?:整理|操作|执行)?$/i,
    /^(?:不要|别)(?:整理|执行|继续)了?$/i,
    /^停(?:止|下来)?$/i,
  ],
  keywords: ["取消", "停止", "不要了", "算了"],
  goalTemplate: "取消当前正在执行的操作",
  reasoningTemplate: "用户希望中止当前操作",
  executionPlanTemplate: [
    {
      descriptionTemplate: "中止当前操作",
      action: "cancel_current_operation",
    },
  ],
  riskLevel: "low",
  baseConfidence: 0.95,
  requiresConfirmation: false,
  priority: 200, // 最高优先级
  enabled: true,
};
```

---

## 问题3: 上下文丢失 (P1)

### 根本原因

1. **搜索结果未记录到会话**
   - `search_bookmarks` 工具返回结果后，没有调用 `sessionMemory.recordSearchResults()`

2. **后续消息未检查上下文**
   - `batch-organize.parseInput()` 不检查 `context.bookmarkIds`
   - 默认使用 `scope: "all"` 或 `"uncategorized"`

3. **指代词"这些"未解析**
   - 系统不理解"这些"指代之前搜索到的书签

### 修复方案

#### 3.1 搜索工具记录结果 (ai-agent/tools/query/search-bookmarks.tool.ts)

```typescript
// 在 execute 方法中，搜索完成后记录结果
const searchResults = await searchService.search(params);

// 新增：记录搜索结果到会话内存
if (context.sessionMemory && context.conversationId) {
  context.sessionMemory.recordSearchResults(context.conversationId, {
    query: params.query,
    bookmarkIds: searchResults.map((b) => b.id),
    count: searchResults.length,
    timestamp: new Date(),
  });
}

return searchResults;
```

#### 3.2 增强 batch-organize 输入解析 (ai-skills/skills/batch-organize/batch-organize.skill.ts)

```typescript
async parseInput(
  message: string,
  context: OrchestrationContext,
): Promise<BatchOrganizeInput> {
  const actions: OrganizeAction[] = [];

  // 解析操作类型
  if (/整理|分类|归类/.test(message)) {
    actions.push("auto-categorize");
  }
  // ... 其他操作解析

  // 新增：检查上下文中的书签选择
  let scope: BatchOrganizeInput["scope"] = "uncategorized";
  let specificBookmarkIds: number[] | undefined;

  // 优先级1：检查显式传入的 bookmarkIds
  if (context.bookmarkIds && context.bookmarkIds.length > 0) {
    specificBookmarkIds = context.bookmarkIds;
    scope = "specific";
  }
  // 优先级2：检查指代词，关联会话中的搜索结果
  else if (/这些?|它们|上面的|刚才的/.test(message)) {
    const lastSearch = context.sessionMemory?.getLastSearchResults(
      context.conversationId,
    );
    if (lastSearch?.bookmarkIds?.length) {
      specificBookmarkIds = lastSearch.bookmarkIds;
      scope = "specific";
    }
  }
  // 优先级3：解析消息中的范围关键词
  else if (/全部|所有/.test(message)) {
    scope = "all";
  } else if (/未分类/.test(message)) {
    scope = "uncategorized";
  }

  return {
    actions,
    scope,
    specificBookmarkIds,  // 新增字段
    requireConfirmation: DEFAULT_ORGANIZE_CONFIG.requireConfirmation,
    autoExecute: DEFAULT_ORGANIZE_CONFIG.autoExecute,
  };
}
```

#### 3.3 扩展 BatchOrganizeInput 类型

```typescript
export interface BatchOrganizeInput {
  actions: OrganizeAction[];
  scope: "all" | "uncategorized" | "untagged" | "specific"; // 新增 specific
  specificBookmarkIds?: number[]; // 新增：指定的书签ID列表
  requireConfirmation: boolean;
  autoExecute: boolean;
}
```

#### 3.4 修改 fetchBookmarks 函数

```typescript
async function fetchBookmarks(
  userId: string,
  input: BatchOrganizeInput,
): Promise<Bookmark[]> {
  // 新增：如果有具体书签ID，直接查询这些书签
  if (input.scope === "specific" && input.specificBookmarkIds?.length) {
    return await bookmarkService.getByIds(userId, input.specificBookmarkIds);
  }

  // 现有逻辑...
  switch (input.scope) {
    case "all":
      return await bookmarkService.getAll(userId);
    case "uncategorized":
      return await bookmarkService.getUncategorized(userId);
    case "untagged":
      return await bookmarkService.getUntagged(userId);
  }
}
```

---

## 实施计划

### 阶段1: 意图修复 (预计 2h)

| 步骤 | 文件                          | 改动                                                       |
| ---- | ----------------------------- | ---------------------------------------------------------- |
| 1.1  | `templates/templates.ts`      | 新增 `organizeToFolderTemplate`、`cancelOperationTemplate` |
| 1.2  | `templates/templates.ts`      | 更新 `organizeGeneralTemplate` 排除词                      |
| 1.3  | `router/intent-classifier.ts` | 增加"移动到文件夹"高优先级规则                             |
| 1.4  | `templates/types.ts`          | 新增 `cancel` 任务类型                                     |
| 1.5  | 单元测试                      | 覆盖新模板匹配场景                                         |

### 阶段2: 取消机制 (预计 3h)

| 步骤 | 文件                                            | 改动                          |
| ---- | ----------------------------------------------- | ----------------------------- |
| 2.1  | `orchestration/types.ts`                        | 新增 `CancellationToken` 接口 |
| 2.2  | `orchestration/cancellation-token.ts`           | 新建取消令牌实现              |
| 2.3  | `skills/batch-organize/batch-organize.skill.ts` | 增加取消检查点                |
| 2.4  | `app/api/agent/unified/route.ts`                | 支持 DELETE 取消端点          |
| 2.5  | `orchestration/base-skill.ts`                   | 基类增加取消支持              |
| 2.6  | 集成测试                                        | 验证取消流程                  |

### 阶段3: 上下文保持 (预计 2h)

| 步骤 | 文件                                            | 改动                                |
| ---- | ----------------------------------------------- | ----------------------------------- |
| 3.1  | `tools/query/search-bookmarks.tool.ts`          | 搜索后记录结果                      |
| 3.2  | `skills/batch-organize/types.ts`                | 扩展 `BatchOrganizeInput`           |
| 3.3  | `skills/batch-organize/batch-organize.skill.ts` | 解析指代词、检查上下文              |
| 3.4  | `ai-memory/session-memory.ts`                   | 确保 `recordSearchResults` 正常工作 |
| 3.5  | 集成测试                                        | 验证上下文传递                      |

---

## 测试用例

### 意图识别测试

```typescript
describe("意图识别修复", () => {
  it("'把这些整理到一个文件夹' 应识别为 move 意图", () => {
    const result = templateEngine.match("把这些整理到一个文件夹", context);
    expect(result.template?.taskType).toBe("move");
  });

  it("'整理收藏' 应识别为 organize 意图", () => {
    const result = templateEngine.match("整理收藏", context);
    expect(result.template?.taskType).toBe("organize");
  });

  it("'取消整理' 应识别为 cancel 意图", () => {
    const result = templateEngine.match("取消整理", context);
    expect(result.template?.taskType).toBe("cancel");
  });
});
```

### 取消机制测试

```typescript
describe("取消机制", () => {
  it("取消令牌应正确传递取消信号", () => {
    const source = new CancellationTokenSource();
    expect(source.token.isCancelled).toBe(false);
    source.cancel("用户取消");
    expect(source.token.isCancelled).toBe(true);
    expect(source.token.reason).toBe("用户取消");
  });

  it("Skill 应在取消后停止执行", async () => {
    const source = new CancellationTokenSource();
    const context = { cancellationToken: source.token, ... };

    const chunks: any[] = [];
    const generator = skill.executeStream(context);

    // 启动后立即取消
    setTimeout(() => source.cancel(), 100);

    for await (const chunk of generator) {
      chunks.push(chunk);
      if (chunk.type === "cancelled") break;
    }

    expect(chunks.some(c => c.type === "cancelled")).toBe(true);
  });
});
```

### 上下文保持测试

```typescript
describe("上下文保持", () => {
  it("搜索结果应记录到会话内存", async () => {
    await searchTool.execute({ query: "claude" }, context);

    const lastSearch = sessionMemory.getLastSearchResults(conversationId);
    expect(lastSearch?.bookmarkIds.length).toBeGreaterThan(0);
  });

  it("'这些' 应关联到上次搜索结果", async () => {
    // 模拟搜索
    sessionMemory.recordSearchResults(conversationId, {
      bookmarkIds: [1, 2, 3, 4, 5],
      query: "claude",
      count: 5,
    });

    const input = await skill.parseInput(
      "把这些整理到学习文件夹",
      { conversationId, sessionMemory, ... },
    );

    expect(input.scope).toBe("specific");
    expect(input.specificBookmarkIds).toEqual([1, 2, 3, 4, 5]);
  });
});
```

---

## 风险评估

| 风险                       | 概率 | 影响 | 缓解措施               |
| -------------------------- | ---- | ---- | ---------------------- |
| 模板优先级调整影响其他场景 | 中   | 中   | 增加全面的回归测试     |
| 取消机制可能导致资源泄漏   | 低   | 高   | 确保取消后正确清理     |
| 上下文过期问题             | 中   | 低   | 设置合理的上下文有效期 |

---

## 审核确认

请审核以上修复计划，确认后我将开始实施。

- [ ] 阶段1: 意图修复 - 批准实施
- [ ] 阶段2: 取消机制 - 批准实施
- [ ] 阶段3: 上下文保持 - 批准实施
