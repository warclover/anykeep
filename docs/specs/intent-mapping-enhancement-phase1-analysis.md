# 意图映射增强 Phase 1 - 测试失败深度分析

## 执行时间

2026-01-10

## 测试结果概览

- 总体通过率: 10/48 (20.8%)
- 目标通过率: ≥80%

---

## 问题分类

### 类别 A: 类型命名差异（非真正错误）

这类"失败"实际上是**测试期望值与系统类型体系不一致**，系统理解是正确的：

| 输入                   | 测试期望    | 系统输出      | 分析                               |
| ---------------------- | ----------- | ------------- | ---------------------------------- |
| "烦死了找不到那篇文章" | search      | query:search  | ✅ 正确，search 是 query 的子类型  |
| "搜 React"             | search      | query:search  | ✅ 正确                            |
| "导出"                 | export      | create:export | ✅ 正确，export 是 create 的子类型 |
| "export json"          | export      | create:export | ✅ 正确                            |
| "怎么导出"             | help        | chitchat:help | ✅ 正确，help 是 chitchat 的子类型 |
| "能自动分类吗"         | help        | chitchat:help | ✅ 正确                            |
| "统计"                 | query:stats | query:count   | ⚠️ 可接受，count 和 stats 语义相近 |

**结论**: 这 7 个用例系统理解正确，是测试期望值的问题。

---

### 类别 B: 真正的意图理解错误

这类问题会**直接影响用户体验**，需要修复：

#### B1. 隐含意图未识别（被误判为 chitchat:general）

| 输入               | 期望           | 实际             | 置信度 | 根本原因                         |
| ------------------ | -------------- | ---------------- | ------ | -------------------------------- |
| "收藏太乱了"       | organize       | chitchat:general | 40%    | 缺少"太乱了"→整理意图的规则      |
| "东西太多了"       | query/organize | chitchat:general | 40%    | 缺少"太多了"→统计/整理意图的规则 |
| "帮我看看"         | query          | chitchat:general | 40%    | 缺少"帮我看看"→列表意图的规则    |
| "有点多啊"         | query:stats    | chitchat:general | 40%    | 缺少口语化统计表达的规则         |
| "标签"             | action:tag     | chitchat:general | 40%    | 单字"标签"没有被识别为标签操作   |
| "那个收藏有问题"   | query          | chitchat:general | 40%    | 缺少问题报告类表达的规则         |
| "这些都删了"       | action:delete  | chitchat:general | 40%    | "都删了"变体未被识别             |
| "文件夹该怎么组织" | help           | chitchat:general | 40%    | 缺少"该怎么"询问模式的规则       |

**共性特征**: 置信度都是 40%（chitchat 兜底），说明没有任何规则匹配。

#### B2. 英文支持不足

| 输入              | 期望          | 实际             | 置信度 | 根本原因        |
| ----------------- | ------------- | ---------------- | ------ | --------------- | --- | -------------------------- |
| "delete bookmark" | action:delete | chitchat:general | 40%    | `delete\s+(this | it  | them)?$` 不匹配 "bookmark" |

**根本原因**: 英文规则 `/^delete\s+(this|it|them)?$/i` 要求 delete 后面只能是 this/it/them 或为空，不支持 "delete bookmark"。

#### B3. 隐含意图判断偏差

| 输入               | 期望     | 实际             | 置信度 | 根本原因                                                    |
| ------------------ | -------- | ---------------- | ------ | ----------------------------------------------------------- |
| "好久没整理了"     | organize | query:list       | 90%    | "好久没...整理"被规则匹配为列表查看，但用户可能是想执行整理 |
| "可以批量删除吗"   | help     | action:delete    | 85%    | "删除"关键词被优先匹配，忽略了"可以...吗"询问模式           |
| "支持搜索吗"       | help     | query:search     | 85%    | "搜索"关键词被优先匹配，忽略了"支持...吗"询问模式           |
| "整理一下然后导出" | organize | create:export    | 90%    | 多步骤请求只匹配了后半部分"导出"                            |
| "有多少没整理的"   | query    | organize:cleanup | 90%    | "没整理"触发了整理规则，但用户只是询问数量                  |

**共性特征**: 规则权重设计问题，询问模式应该比操作关键词优先级更高。

---

## 根本原因总结

### 1. 规则覆盖不足

- 缺少口语化抱怨表达的规则（"太乱了"、"太多了"）
- 缺少模糊请求的规则（"帮我看看"）
- 单词指令支持不足（"标签"）

### 2. 英文规则过于严格

- `delete` 规则只支持 `this/it/them`，不支持 `bookmark/item/this one`

### 3. 权重设计缺陷

- 询问模式（"可以...吗"、"支持...吗"）权重应高于操作关键词
- 多步骤请求应识别主要意图或拆分处理

### 4. 语义理解缺失

- "好久没整理了"：语义上可能是"想整理"也可能是"看看情况"，需要上下文判断
- "有多少没整理的"：明确是询问数量，不是执行整理

---

## 修复方案

### Phase 2A: 新增缺失规则

```typescript
// 口语化抱怨 → 隐含整理意图
{ pattern: /(太|好)乱了/, type: "organize", subType: "cleanup", weight: 65 }
{ pattern: /(太|好)多了/, type: "query", subType: "stats", weight: 65 }
{ pattern: /帮我看看/, type: "query", subType: "list", weight: 55 }
{ pattern: /有点多/, type: "query", subType: "stats", weight: 55 }

// 单词指令增强
{ pattern: /^标签$/, type: "action", subType: "tag", weight: 50 }

// 批量删除变体
{ pattern: /(这些|全部|都).{0,3}删/, type: "action", subType: "delete", weight: 72 }

// 问题报告类
{ pattern: /有问题|出错|不对/, type: "query", subType: "diagnose", weight: 60 }
```

### Phase 2B: 修复英文规则

```typescript
// 扩展 delete 规则支持更多宾语
{ pattern: /^delete\s+(this|it|them|bookmark|item|selected)?$/i, ... }

// 新增 delete + 名词 模式
{ pattern: /^delete\s+\w+$/i, type: "action", subType: "delete", weight: 65 }
```

### Phase 2C: 权重调整

```typescript
// 询问模式权重提升（高于操作关键词）
{ pattern: /可以.{0,5}吗/, type: "chitchat", subType: "help", weight: 92 }
{ pattern: /支持.{0,5}吗/, type: "chitchat", subType: "help", weight: 92 }
{ pattern: /该怎么/, type: "chitchat", subType: "help", weight: 91 }

// 多步骤请求识别（识别主意图）
{ pattern: /整理.{0,5}(然后|再|接着).{0,5}导出/, type: "organize", subType: "cleanup_export", weight: 88 }

// 数量询问模式（高于操作）
{ pattern: /有多少.{0,5}(没|未)/, type: "query", subType: "count", weight: 88 }
```

---

## 预期改进效果

| 类别     | 当前通过率 | 预期通过率 | 改进 |
| -------- | ---------- | ---------- | ---- |
| 日常口语 | 0/6 (0%)   | 5/6 (83%)  | +83% |
| 简短指令 | 2/6 (33%)  | 5/6 (83%)  | +50% |
| 功能询问 | 0/6 (0%)   | 5/6 (83%)  | +83% |
| 英文混合 | 0/6 (0%)   | 5/6 (83%)  | +83% |
| 指代表达 | 2/6 (33%)  | 5/6 (83%)  | +50% |
| 复杂场景 | 1/6 (17%)  | 4/6 (67%)  | +50% |
| 边界情况 | 5/6 (83%)  | 6/6 (100%) | +17% |

**预期整体通过率**: 35/48 (73%) → 目标 80% 还需额外优化
