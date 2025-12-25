# Phase 1 最佳实践参考

> **版本**: 1.0.0
> **日期**: 2025-12-25
> **用途**: 为 Phase 1 各任务提供业界最佳实践参考

---

## 1.1 多候选收集机制

### 业界参考

#### Rasa NLU 的意图分类策略

Rasa 使用多阶段分类：

1. **TF-IDF + SVM** 初筛候选
2. **DIET (Dual Intent and Entity Transformer)** 深度学习模型
3. **Fallback 策略** 当置信度 < 阈值时请求澄清

**关键设计**:

```python
# Rasa 返回多候选示例
{
  "intent": {"name": "greet", "confidence": 0.85},
  "intent_ranking": [
    {"name": "greet", "confidence": 0.85},
    {"name": "goodbye", "confidence": 0.10},
    {"name": "affirm", "confidence": 0.05}
  ]
}
```

**应用到 AnyKeep**:

```typescript
interface ClassificationResult {
  primary: IntentCandidate; // 最高置信度
  candidates: IntentCandidate[]; // 所有候选（按置信度排序）
  needsDisambiguation: boolean; // 是否需要消歧
}
```

#### Dialogflow 的消歧机制

当多个意图置信度接近时（差距 < 0.1），Dialogflow 会：

1. 检查是否有消歧规则
2. 无规则时返回 "Did you mean..." 提示

**应用建议**:

- 设置消歧阈值：当 top1 和 top2 置信度差 < 0.2 时触发消歧
- 记录消歧日志用于后续规则优化

---

## 1.2 消歧规则引擎

### 设计模式参考

#### 规则优先级策略

借鉴 CSS 选择器优先级计算：

```typescript
interface DisambiguationRule {
  id: string;
  conflicts: IntentType[]; // 冲突的意图类型
  pattern: RegExp; // 匹配模式
  winner: IntentType; // 胜出意图
  priority: number; // 优先级（越高越先匹配）
  reason: string; // 解释
}

// 优先级计算：
// - 语法结构规则（动词+宾语）: 100
// - 关键词规则（"导出"）: 50
// - 默认规则: 10
```

#### 消歧规则设计原则

1. **明确性原则**: 规则条件越具体，优先级越高
2. **可解释性**: 每条规则必须有 `reason` 字段
3. **可测试性**: 每条规则至少 3 个测试用例

### 推荐规则集

```typescript
export const DISAMBIGUATION_RULES: DisambiguationRule[] = [
  // 语法结构规则（高优先级）
  {
    id: "verb-object-create",
    conflicts: ["organize", "create"],
    pattern: /(梳理|整理).*(总结|纪要|笔记)/,
    winner: "create",
    priority: 100,
    reason: "动词+宾语结构：行为是创建产出物",
  },
  {
    id: "verb-object-organize",
    conflicts: ["organize", "create"],
    pattern: /(总结|归纳).*(整理|分类|归档)/,
    winner: "organize",
    priority: 100,
    reason: "动词+宾语结构：行为是组织内容",
  },

  // 关键词规则（中优先级）
  {
    id: "export-keyword",
    conflicts: ["export", "create"],
    pattern: /导出|输出|下载/,
    winner: "export",
    priority: 50,
    reason: "明确的导出动作词",
  },
  {
    id: "search-keyword",
    conflicts: ["query", "organize"],
    pattern: /找|搜|查|有多少|哪些/,
    winner: "query",
    priority: 50,
    reason: "明确的搜索/查询动作词",
  },

  // 场景规则（低优先级）
  {
    id: "recent-reference",
    conflicts: ["query", "manage"],
    pattern: /最近|上周|昨天/,
    winner: "query",
    priority: 30,
    reason: "时间修饰词通常表示搜索意图",
  },
];
```

---

## 1.3 响应自然化

### Anthropic Prompt Engineering 指南

#### 禁用短语清单

```typescript
export const BANNED_PHRASES = [
  "根据您的请求",
  "我将为您",
  "我已经为您",
  "请问您是否需要",
  "如您所愿",
  "我来帮您",
  "好的，我",
  "没问题，我",
  "当然可以",
  "作为AI助手",
];
```

#### 直接响应模板

**搜索结果**:

```typescript
// ❌ 不好的响应
"根据您的搜索请求，我为您找到了以下5篇关于AI的文章...";

// ✅ 好的响应
"找到 5 篇 AI 相关文章：\n\n1. 《深度学习入门》- 3天前\n...";
```

**统计结果**:

```typescript
// ❌ 不好的响应
"根据您的请求，我已经统计了您的收藏数据...";

// ✅ 好的响应
"本周收藏了 12 篇文章，AI 主题最多（7 篇）";
```

#### 跟进建议设计

```typescript
interface FollowUpSuggestion {
  text: string; // 显示文本
  action: string; // 点击后发送的消息
  icon?: string; // 可选图标
}

// 搜索结果后的跟进建议
const SEARCH_FOLLOW_UPS: FollowUpSuggestion[] = [
  { text: "继续找", action: "还有其他相关的吗？" },
  { text: "看详情", action: "展开第一篇的摘要" },
  { text: "整理这些", action: "把这些整理到一个文件夹" },
];
```

---

## 1.4 前端集成

### React 组件设计参考

#### 跟进建议按钮组件

参考 ChatGPT 的建议按钮设计：

```tsx
interface FollowUpSuggestionsProps {
  suggestions: FollowUpSuggestion[];
  onSelect: (action: string) => void;
}

export function FollowUpSuggestions({
  suggestions,
  onSelect,
}: FollowUpSuggestionsProps) {
  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {suggestions.map((suggestion, index) => (
        <button
          key={index}
          onClick={() => onSelect(suggestion.action)}
          className="px-3 py-1.5 text-sm rounded-full
                     bg-secondary hover:bg-secondary/80
                     transition-colors"
        >
          {suggestion.icon && <span className="mr-1">{suggestion.icon}</span>}
          {suggestion.text}
        </button>
      ))}
    </div>
  );
}
```

**交互细节**:

- 点击后按钮应有 loading 状态
- 发送消息后建议按钮消失
- 键盘可访问（Tab 导航 + Enter 触发）

---

## 2.1 会话状态管理

### LangChain Memory 模块参考

#### 会话状态数据结构

```typescript
interface ConversationState {
  conversationId: string;
  createdAt: Date;
  lastActiveAt: Date;

  // 消息历史（最近 N 条）
  messages: Message[];

  // 最近输出（用于"刚才"解析）
  lastOutput: {
    type: "search_results" | "summary" | "list" | "action_result";
    data: unknown;
    timestamp: Date;
  } | null;

  // 提及的实体（用于"那个"解析）
  mentions: {
    bookmarks: Bookmark[];
    folders: Folder[];
    tags: string[];
  };

  // 搜索结果缓存（用于"这些"解析）
  lastSearchResults: Bookmark[] | null;
}
```

#### 存储策略

```typescript
class SessionMemory {
  private store: Map<string, ConversationState> = new Map();
  private readonly MAX_SESSIONS = 100;
  private readonly SESSION_TTL_MS = 30 * 60 * 1000; // 30 分钟

  // 定期清理过期会话
  private cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [id, state] of this.store) {
      if (now - state.lastActiveAt.getTime() > this.SESSION_TTL_MS) {
        this.store.delete(id);
      }
    }
  }, 60 * 1000); // 每分钟检查一次
}
```

---

## 2.2 指代词解析

### 共指消解 (Coreference Resolution) 简化版

#### 指代词模式匹配

```typescript
const REFERENCE_PATTERNS = {
  // 时间指代
  lastOutput: [/刚才的?/, /刚刚的?/, /上次的?/, /之前的?/],

  // 复数指代
  lastSearchResults: [/这些/, /这几个/, /它们/, /上面的/, /这批/],

  // 单数指代 - 书签
  lastMentionedBookmark: [/那篇/, /那个文章/, /这篇/],

  // 单数指代 - 文件夹
  lastMentionedFolder: [/那个文件夹/, /那个目录/, /这个文件夹/],
};
```

#### 解析优先级

当多个模式匹配时的优先级：

1. **最近优先**: 优先解析为最近一轮的输出/提及
2. **类型匹配**: 根据动词推断期望类型（"保存" → 书签/内容，"移到" → 书签）
3. **请求澄清**: 无法确定时返回澄清请求

```typescript
interface ResolvedReference {
  type: "bookmark" | "folder" | "content" | "results";
  data: unknown;
  confidence: number;
  originalText: string;
}

// 低置信度时的澄清请求
interface ClarificationRequest {
  question: string;
  options: string[];
}
```

---

## 2.4 前端集成

### conversationId 管理

#### 生成策略

```typescript
// 使用 uuid v4 生成会话 ID
import { v4 as uuidv4 } from "uuid";

export function useConversationId() {
  const [conversationId, setConversationId] = useState<string>(() => {
    // 优先从 sessionStorage 恢复
    const stored = sessionStorage.getItem("ai-conversation-id");
    return stored || uuidv4();
  });

  // 同步到 sessionStorage
  useEffect(() => {
    sessionStorage.setItem("ai-conversation-id", conversationId);
  }, [conversationId]);

  const resetConversation = useCallback(() => {
    const newId = uuidv4();
    setConversationId(newId);
    sessionStorage.setItem("ai-conversation-id", newId);
  }, []);

  return { conversationId, resetConversation };
}
```

#### 记忆指示器 UI

参考 Notion AI 的上下文提示：

```tsx
export function MemoryIndicator({
  referenceResolved,
}: {
  referenceResolved: boolean;
}) {
  if (!referenceResolved) return null;

  return (
    <div className="flex items-center gap-1 text-xs text-muted-foreground">
      <Brain className="h-3 w-3" />
      <span>AI 记住了上下文</span>
    </div>
  );
}
```

---

## 验证脚本参考

### 消歧规则验证

```typescript
// scripts/validate-disambiguation.ts

interface TestCase {
  input: string;
  expected: IntentType;
  description: string;
}

const TEST_CASES: TestCase[] = [
  {
    input: "梳理一下我收藏的内容，总结成纪要",
    expected: "create",
    description: "动词+宾语结构",
  },
  {
    input: "帮我整理下最近收藏的文章",
    expected: "organize",
    description: "单一意图",
  },
  {
    input: "找一下上周看的那篇AI文章",
    expected: "query",
    description: "搜索意图",
  },
  { input: "导出成Markdown格式", expected: "export", description: "导出意图" },
  // ... 更多用例
];

async function validateDisambiguation() {
  const classifier = new IntentClassifier();
  let passed = 0;
  let failed = 0;

  for (const testCase of TEST_CASES) {
    const result = await classifier.classify(testCase.input);
    if (result.primary.type === testCase.expected) {
      passed++;
      console.log(`✅ ${testCase.description}: ${testCase.input}`);
    } else {
      failed++;
      console.log(`❌ ${testCase.description}: ${testCase.input}`);
      console.log(
        `   Expected: ${testCase.expected}, Got: ${result.primary.type}`,
      );
    }
  }

  console.log(
    `\nResults: ${passed}/${passed + failed} passed (${((passed / (passed + failed)) * 100).toFixed(1)}%)`,
  );

  // 验收标准：≥ 95%
  if (passed / (passed + failed) < 0.95) {
    process.exit(1);
  }
}
```

---

## 参考资料

1. [Rasa NLU Documentation](https://rasa.com/docs/rasa/nlu-training-data/)
2. [Dialogflow Intent Detection](https://cloud.google.com/dialogflow/docs/intents-overview)
3. [LangChain Memory](https://python.langchain.com/docs/modules/memory/)
4. [Anthropic Prompt Engineering](https://docs.anthropic.com/claude/docs/prompt-engineering)
5. [SpaCy Coreference Resolution](https://spacy.io/universe/project/neuralcoref)
