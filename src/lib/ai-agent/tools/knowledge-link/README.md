# Knowledge Link Tools

> **Version**: 1.0.0
> **Since**: 2025-12-28
> **Module**: `src/lib/ai-agent/tools/knowledge-link/`

---

## 概述

知识图谱 AI Agent Tools，提供知识关联查询和主题聚类功能。

**核心能力**:

- 获取用户的知识图谱数据（节点、边、统计）
- 基于主题聚类查找相关书签

---

## 架构集成

### 调用流程

```
用户消息
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│  IntentClassifier (意图分类)                              │
│  ├─ Pattern: /知识.{0,3}(图谱|网络|关系)/                │
│  │   → subType: "knowledge_graph"                       │
│  └─ Pattern: /相关.{0,3}(内容|书签|文章)/                │
│      → subType: "related_by_topic"                      │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│  ModeSelector (模式选择)                                  │
│  complexity: "simple" → mode: "atomic"                  │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│  KnowledgeAgent (原子模式执行)                            │
│  ├─ 加载所有注册的 Tools (包含 knowledgeLinkTools)       │
│  └─ LLM 根据 Tool 描述自动选择调用                        │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│  Knowledge Link Tools                                    │
│  ├─ get_knowledge_graph                                 │
│  └─ find_related_by_topic                               │
└─────────────────────────────────────────────────────────┘
```

### 注册方式

```typescript
// src/lib/ai-agent/tools/index.ts
import { knowledgeLinkTools } from "./knowledge-link";

export function registerDefaultTools(): void {
  // ...
  toolRegistry.registerAll(knowledgeLinkTools); // v2.4.0 新增
}
```

---

## Tools 清单

| Tool 名称               | 类型  | 功能               | 确认 |
| ----------------------- | ----- | ------------------ | ---- |
| `get_knowledge_graph`   | query | 获取知识图谱数据   | 否   |
| `find_related_by_topic` | query | 按主题查找相关书签 | 否   |

---

## Tool 详细说明

### 1. get_knowledge_graph

**功能**: 获取用户的知识图谱数据

**参数**:
| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| minStrength | number | 否 | 0.3 | 最小关联强度 (0-1) |
| maxNodes | number | 否 | 200 | 最大节点数 (10-500) |
| linkTypes | string[] | 否 | - | 关联类型筛选 |
| includeIsolated | boolean | 否 | false | 是否包含孤立节点 |

**关联类型**:

- `semantic`: 语义相似（基于向量相似度）
- `entity`: 共享实体
- `tag`: 共享标签
- `topic`: 同主题（基于聚类）

**返回**:

```typescript
{
  nodes: KnowledgeGraphNode[];  // 节点列表
  edges: KnowledgeGraphEdge[];  // 边列表
  stats: KnowledgeGraphStatsResult;  // 统计信息
  message: string;              // 友好消息
}
```

**触发语句**:

- "展示我的知识图谱"
- "我的收藏有哪些关联"
- "哪些书签联系最紧密"

---

### 2. find_related_by_topic

**功能**: 基于主题聚类查找与指定书签相关的内容

**参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| bookmarkId | number | 是 | 要查找相关内容的书签 ID |
| limit | number | 否 | 返回数量，默认 10 |

**返回**:

```typescript
{
  bookmarkId: number;
  cluster: TopicClusterInfo | null;  // 所属聚类信息
  relatedBookmarks: RelatedBookmarkByTopic[];  // 相关书签
  message: string;
}
```

**触发语句**:

- "和这篇文章类似的内容"
- "找到同主题的收藏"
- "有哪些书签和 ID xxx 属于同一主题"

---

## 意图分类规则

```typescript
// src/lib/ai-skills/router/intent-classifier.ts

// 知识图谱查询
{
  pattern: /知识.{0,3}(图谱|网络|关系)|关联.{0,3}(图|网络|分析)/,
  type: "query",
  subType: "knowledge_graph",
  complexity: "simple",
  weight: 78,
}

// 主题关联查询
{
  pattern: /相关.{0,3}(内容|书签|文章)|同.{0,3}主题|主题.{0,3}(聚类|分组)/,
  type: "query",
  subType: "related_by_topic",
  complexity: "simple",
  weight: 75,
}
```

---

## 依赖服务

- `GraphBuilderService`: 知识图谱构建服务
- `TopicClustererService`: 主题聚类服务

**服务位置**: `src/lib/knowledge-link/services/`

---

## 文件结构

```
src/lib/ai-agent/tools/knowledge-link/
├── README.md                       # 本文档
├── types.ts                        # 共享类型和转换函数
├── get-knowledge-graph.tool.ts     # 知识图谱 Tool
├── find-related-by-topic.tool.ts   # 主题关联 Tool
└── index.ts                        # 模块导出
```

---

## 类型定义

### KnowledgeGraphNode

```typescript
interface KnowledgeGraphNode {
  id: number;
  title: string;
  url: string;
  platform: string | null;
  connectionCount: number;
  avgStrength: number;
}
```

### KnowledgeGraphEdge

```typescript
interface KnowledgeGraphEdge {
  source: number;
  target: number;
  type: LinkType;
  typeLabel: string; // 关联类型显示名称
  strength: number;
}
```

### TopicClusterInfo

```typescript
interface TopicClusterInfo {
  clusterId: string;
  label: string;
  bookmarkCount: number;
  cohesion: number; // 聚类内聚度 (0-1)
  representativeTags: string[];
}
```

---

## 版本历史

| 版本  | 日期       | 变更                 |
| ----- | ---------- | -------------------- |
| 1.0.0 | 2025-12-28 | 初始版本，2 个 Tools |
