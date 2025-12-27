# AI 上下文增强 v2.0 - 深化设计方案

> **状态**: 待审核
> **创建日期**: 2025-12-27
> **版本**: v2.0

---

## 1. 问题诊断

### 1.1 意图误分类问题

**测试场景**:

```
用户输入: "刚才搜到的 Claude 文章里，关于 Claude Code 的有哪几篇？"
期望行为: 筛选之前搜索结果中关于 Claude Code 的文章
实际行为: 触发 insight_report 编排 Skill，生成完整分析报告
```

**根因分析**:

1. **缺失意图类型**: 现有 `IntentClassifier` 没有 `filter`/`refine` 意图类型
2. **规则优先级问题**: "有哪几篇" 被 `analyze` 类规则误捕获
3. **上下文不感知**: 分类器不考虑用户是否在引用之前的结果

**影响范围**: 所有基于之前结果的跟进查询

---

### 1.2 指代解析歧义问题

**测试场景**:

```
用户输入: "第一篇是什么？"
期望行为: 返回之前搜索 Claude 文章中的第一篇
实际行为: 返回收藏列表中最近的第一篇
```

**根因分析**:

1. **缺失序数模式**: `ReferenceResolver` 不处理 "第N个/篇" 模式
2. **搜索结果未持久化**: `lastSearchResults` 可能未正确存储或过期
3. **优先级问题**: 当无法解析序数指代时，AI 回退到 `list_recent` 工具

**影响范围**: 所有需要引用之前结果中特定项的场景

---

### 1.3 React Key 警告问题

**问题**: 控制台大量 "Encountered two children with the same key" 错误

**根因**: 消息列表渲染时 key 生成逻辑存在重复

**影响范围**: 前端性能和开发体验

---

## 2. 解决方案设计

### 2.1 方案 A: 新增 "筛选/细化" 意图类型

#### 2.1.1 设计目标

在 `IntentClassifier` 中新增 `refine` 意图类型，专门处理：

- 基于之前搜索结果的筛选
- 对之前结果的进一步限定
- 跟进式查询

#### 2.1.2 新增规则

```typescript
// 文件: src/lib/ai-skills/router/intent-classifier.ts

// 新增意图类型
type IntentType =
  | "query"
  | "action"
  | "analyze"
  | "create"
  | "organize"
  | "learn"
  | "chitchat"
  | "refine"; // 新增

// 新增规则（插入到查询类之前，权重 65）
const REFINE_RULES: IntentRule[] = [
  {
    pattern: /(?:刚才|之前|上面)(?:搜到|找到|的).{0,10}(?:里|中|有)/,
    type: "refine",
    subType: "filter",
    complexity: "simple",
    weight: 65,
  },
  {
    pattern: /(?:其中|里面|当中).{0,5}(?:有|哪些|几篇)/,
    type: "refine",
    subType: "filter",
    complexity: "simple",
    weight: 65,
  },
  {
    pattern: /(?:筛选|过滤|只要|只看).{0,10}(?:的|相关)/,
    type: "refine",
    subType: "filter",
    complexity: "simple",
    weight: 70,
  },
  {
    pattern: /(?:这些|那些|上面).{0,5}(?:关于|有关|包含)/,
    type: "refine",
    subType: "narrow",
    complexity: "simple",
    weight: 65,
  },
];
```

#### 2.1.3 路由映射

```typescript
// 文件: src/lib/ai-skills/router/intent-skill-router.ts

const INTENT_TO_SKILL_MAP = {
  // 现有映射...
  refine: {
    filter: "atomic", // 使用原子模式，调用 search_bookmarks 带条件
    narrow: "atomic",
    default: "atomic",
  },
};
```

#### 2.1.4 工具调用增强

当 `refine` 意图触发时，AI 应：

1. 从 `SessionMemory` 获取 `lastSearchResults.resultIds`
2. 在这些 ID 范围内执行二次搜索
3. 返回筛选后的结果

```typescript
// 新增工具参数
interface SearchBookmarksParams {
  query: string;
  // 新增：限定搜索范围的书签 ID 列表
  withinIds?: number[];
  // 新增：是否为跟进搜索
  isFollowUp?: boolean;
}
```

---

### 2.2 方案 B: 增强指代解析 - 支持序数引用

#### 2.2.1 设计目标

扩展 `ReferenceResolver` 支持：

- 序数指代："第一篇"、"第二个"、"最后一篇"
- 范围指代："前三篇"、"后五个"
- 基于搜索结果的序数引用

#### 2.2.2 新增指代模式

```typescript
// 文件: src/lib/ai-memory/reference-resolver.ts

// 新增序数指代模式
const ORDINAL_PATTERNS: ReferencePattern[] = [
  // 第N篇/个 → lastSearchResults[N-1]
  {
    patterns: [/第[一二三四五六七八九十\d]+(?:篇|个|条)(?:文章|内容|结果)?/g],
    type: "ordinal_result",
    resolve: (match, state) => {
      if (
        !state.lastSearchResults ||
        state.lastSearchResults.resultIds.length === 0
      ) {
        return null;
      }

      const ordinal = extractOrdinal(match); // 提取序数
      const ids = state.lastSearchResults.resultIds;

      if (ordinal > 0 && ordinal <= ids.length) {
        return [
          {
            type: "bookmark" as const,
            id: ids[ordinal - 1],
            name: `搜索结果第 ${ordinal} 篇`,
            mentionedAt: Date.now(),
          },
        ];
      }
      return null;
    },
    priority: 0, // 最高优先级
  },

  // 最后一篇/个
  {
    patterns: [/最后(?:一)?(?:篇|个|条)(?:文章|内容|结果)?/g],
    type: "last_result",
    resolve: (match, state) => {
      if (
        !state.lastSearchResults ||
        state.lastSearchResults.resultIds.length === 0
      ) {
        return null;
      }

      const ids = state.lastSearchResults.resultIds;
      return [
        {
          type: "bookmark" as const,
          id: ids[ids.length - 1],
          name: `搜索结果最后一篇`,
          mentionedAt: Date.now(),
        },
      ];
    },
    priority: 0,
  },

  // 前N篇/后N篇
  {
    patterns: [
      /前[一二三四五六七八九十\d]+(?:篇|个|条)/g,
      /后[一二三四五六七八九十\d]+(?:篇|个|条)/g,
    ],
    type: "range_result",
    resolve: (match, state) => {
      if (!state.lastSearchResults) return null;

      const { count, isFromEnd } = extractRange(match);
      const ids = state.lastSearchResults.resultIds;

      const selectedIds = isFromEnd ? ids.slice(-count) : ids.slice(0, count);

      return selectedIds.map((id, i) => ({
        type: "bookmark" as const,
        id,
        name: `搜索结果第 ${isFromEnd ? ids.length - count + i + 1 : i + 1} 篇`,
        mentionedAt: Date.now(),
      }));
    },
    priority: 1,
  },
];

// 辅助函数：提取序数
function extractOrdinal(match: string): number {
  const chineseNums: Record<string, number> = {
    一: 1,
    二: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
    十: 10,
  };

  const numMatch = match.match(/[一二三四五六七八九十\d]+/);
  if (!numMatch) return 0;

  const numStr = numMatch[0];
  if (/^\d+$/.test(numStr)) {
    return parseInt(numStr, 10);
  }

  return chineseNums[numStr] || 0;
}
```

#### 2.2.3 类型扩展

```typescript
// 文件: src/lib/ai-memory/types.ts

// 扩展指代类型
export type ReferenceType =
  | "last_output"
  | "these_results"
  | "that_folder"
  | "that_bookmark"
  | "previous"
  | "mentioned"
  | "ordinal_result" // 新增：第N个
  | "last_result" // 新增：最后一个
  | "range_result"; // 新增：前N个/后N个
```

---

### 2.3 方案 C: 搜索结果持久化增强

#### 2.3.1 问题

当前搜索结果可能：

1. 未正确存储到 `SessionMemory.lastSearchResults`
2. 存储了但未包含必要信息

#### 2.3.2 解决方案

确保每次 `search_bookmarks` 工具调用后，更新会话状态：

```typescript
// 文件: src/lib/ai-agent/tools/query/search-bookmarks.ts

// 工具执行后的回调
async function onToolComplete(result: SearchResult, context: ToolContext) {
  if (result.bookmarks && result.bookmarks.length > 0) {
    // 更新会话状态
    await sessionMemory.updateState(context.conversationId, {
      lastSearchResults: {
        query: context.params.query,
        resultCount: result.bookmarks.length,
        resultIds: result.bookmarks.map((b) => b.id),
        searchedAt: Date.now(),
        // 新增：存储结果摘要供后续引用
        resultSummaries: result.bookmarks.slice(0, 10).map((b) => ({
          id: b.id,
          title: b.title,
          summary: b.ai_summary?.substring(0, 100),
        })),
      },
      lastOutput: {
        type: "list",
        summary: `搜索"${context.params.query}"找到 ${result.bookmarks.length} 条结果`,
        relatedEntityIds: result.bookmarks.map((b) => b.id),
        outputAt: Date.now(),
      },
    });
  }
}
```

#### 2.3.3 类型扩展

```typescript
// 文件: src/lib/ai-memory/types.ts

export interface SearchResultSummary {
  query: string;
  resultCount: number;
  resultIds: number[];
  searchedAt: number;
  sourceMessageId?: string;
  // 新增：结果摘要（便于序数引用时提供上下文）
  resultSummaries?: Array<{
    id: number;
    title: string;
    summary?: string;
  }>;
}
```

---

### 2.4 方案 D: React Key 修复

#### 2.4.1 问题定位

在消息列表组件中，key 可能使用了 message.id 或索引，但存在重复。

#### 2.4.2 解决方案

```typescript
// 文件: src/components/ai-assistant/message-list.tsx

// 使用复合 key 确保唯一性
{messages.map((message, index) => (
  <MessageItem
    key={`${message.id}-${message.role}-${index}`}
    message={message}
  />
))}

// 或者生成唯一 ID
import { nanoid } from 'nanoid';

// 在消息创建时确保有唯一 ID
const createMessage = (content: string, role: MessageRole) => ({
  id: nanoid(),
  content,
  role,
  timestamp: Date.now(),
});
```

---

## 3. 实施计划

### 3.1 优先级排序

| 优先级 | 方案                     | 原因                 | 预估工作量 |
| ------ | ------------------------ | -------------------- | ---------- |
| P0     | 方案 C: 搜索结果持久化   | 其他方案的基础依赖   | 2h         |
| P0     | 方案 B: 序数指代解析     | 直接解决"第一篇"问题 | 3h         |
| P1     | 方案 A: 新增 refine 意图 | 解决筛选意图误分类   | 4h         |
| P2     | 方案 D: React Key 修复   | 优化级别，不影响功能 | 1h         |

### 3.2 实施步骤

#### Phase 1: 搜索结果持久化 (P0)

1. 扩展 `SearchResultSummary` 类型，添加 `resultSummaries` 字段
2. 修改 `search_bookmarks` 工具，在执行后更新 `SessionMemory`
3. 验证会话状态正确存储

**验收标准**: 搜索后，`lastSearchResults` 包含完整的结果 ID 列表

#### Phase 2: 序数指代解析 (P0)

1. 新增 `ReferenceType`: `ordinal_result`, `last_result`, `range_result`
2. 实现 `extractOrdinal` 和 `extractRange` 辅助函数
3. 添加新的指代模式到 `ReferenceResolver`
4. 编写单元测试覆盖所有序数场景

**验收标准**:

- "第一篇是什么" → 返回搜索结果中的第一篇
- "最后两篇" → 返回搜索结果中的最后两篇

#### Phase 3: 新增 refine 意图 (P1)

1. 扩展 `IntentType` 类型
2. 添加 `REFINE_RULES` 规则集
3. 更新 `IntentToSkillRouter` 映射
4. 修改 AI 提示词，支持 `withinIds` 参数
5. 编写集成测试

**验收标准**:

- "刚才搜到的里面关于 XXX 的有哪些" → 识别为 `refine/filter` 意图
- 执行二次筛选而非重新搜索

#### Phase 4: React Key 修复 (P2)

1. 定位消息列表组件
2. 修改 key 生成逻辑
3. 验证控制台无警告

---

## 4. 测试用例

### 4.1 序数指代测试

```typescript
describe("Ordinal Reference Resolution", () => {
  const mockState = {
    lastSearchResults: {
      query: "Claude",
      resultCount: 5,
      resultIds: [101, 102, 103, 104, 105],
      searchedAt: Date.now(),
    },
    // ...其他状态
  };

  it('should resolve "第一篇" to first search result', () => {
    const result = resolver.resolve("第一篇是什么？", mockState);
    expect(result.references[0].resolvedEntities[0].id).toBe(101);
  });

  it('should resolve "第三个" to third search result', () => {
    const result = resolver.resolve("第三个讲了什么？", mockState);
    expect(result.references[0].resolvedEntities[0].id).toBe(103);
  });

  it('should resolve "最后一篇" to last search result', () => {
    const result = resolver.resolve("最后一篇是关于什么的？", mockState);
    expect(result.references[0].resolvedEntities[0].id).toBe(105);
  });

  it('should resolve "前三篇" to first three results', () => {
    const result = resolver.resolve("前三篇有什么共同点？", mockState);
    expect(result.references[0].resolvedEntities.map((e) => e.id)).toEqual([
      101, 102, 103,
    ]);
  });
});
```

### 4.2 Refine 意图测试

```typescript
describe("Refine Intent Classification", () => {
  it("should classify follow-up filter as refine/filter", async () => {
    const result = await classifier.classify(
      "刚才搜到的 Claude 文章里，关于 Claude Code 的有哪几篇？",
    );
    expect(result.type).toBe("refine");
    expect(result.subType).toBe("filter");
  });

  it('should classify "其中有多少是..." as refine/filter', async () => {
    const result = await classifier.classify("其中有多少是关于编程的？");
    expect(result.type).toBe("refine");
  });

  it("should not classify standalone search as refine", async () => {
    const result = await classifier.classify("帮我找 Claude 相关的文章");
    expect(result.type).toBe("query");
  });
});
```

---

## 5. 风险评估

| 风险                     | 可能性 | 影响 | 缓解措施                   |
| ------------------------ | ------ | ---- | -------------------------- |
| 新规则与现有规则冲突     | 中     | 中   | 添加消歧规则，设置合理权重 |
| 搜索结果过期导致序数失效 | 低     | 低   | 设置合理过期时间，提示用户 |
| 性能影响（额外正则匹配） | 低     | 低   | 正则已预编译，影响可忽略   |

---

## 6. 审核清单

- [ ] 方案 A: 新增 refine 意图类型
- [ ] 方案 B: 序数指代解析增强
- [ ] 方案 C: 搜索结果持久化
- [ ] 方案 D: React Key 修复
- [ ] 实施优先级排序是否合理
- [ ] 测试用例是否充分

---

**请审核以上设计方案，确认后我将按优先级顺序实施。**
