# AnyKeep AI 架构优化设计 (v4.0 Strategy)

> **版本**: v2.1 (生产环境优化版)  
> **创建日期**: 2026-01-12  
> **最后更新**: 2026-01-12  
> **状态**: 设计阶段（已纳入架构评审意见 + 生产环境优化建议）  
> **预计周期**: 6-8 周  
> **基于**: [AI 架构演进战略路线图 (v4.0 Strategy)](d:\HuaweiMoveData\Users\xiafe\Desktop\AI 架构演进战略路线图 (v4.0 Strategy)0112.md)

---

## 📋 执行摘要

本设计文档基于战略路线图，将 AnyKeep AI 架构从"功能数量导向"转向"性能与可靠性导向"，解决四大核心问题：

1. **工具空间爆炸**：122+ Tools 扁平堆放，LLM 上下文污染严重
2. **路由竞态**：意图识别慢、参数提取丢失
3. **异步黑盒**：异步任务状态不可见、触发器逻辑不一致
4. **性能瓶颈**：重复问题重复算、响应卡顿

**核心设计哲学**：
- **分层降维**：能用规则不用模型，能用小模型不用大模型
- **控制反转**：从"AI 决定怎么做"转向"Schema 定义怎么做，AI 负责填空"
- **悲观执行，乐观反馈**：后端严格校验，前端即时响应
- **多态执行**：根据任务复杂度选择最合适的执行原语，避免过度抽象
- **动态合成**：工具胶囊动态组合，支持跨域复杂意图
- **补偿事务**：使用 Saga 模式而非状态快照，降低 I/O 开销

---

## 🎯 架构评审意见 (Architectural Review Comments)

> **评审人**: 首席架构师  
> **评审日期**: 2026-01-12  
> **最后更新**: 2026-01-12（补充生产环境优化建议）  
> **评审结论**: 原设计在工程落地层面已非常成熟，但需从**更根本（Fundamental）**、**更深层（Deep-Level）**的角度审视系统的"有机性"和长期维护的"熵增"问题。

### 核心问题诊断

原设计方案更像是一个**"补丁集合"**（为了解决慢所以加 L0，为了解决乱所以加胶囊，为了解决撤销所以加事务）。我们需要一个**统一的元架构（Meta-Architecture）**思想来贯穿这些改动。

### 5 项根本性优化建议

| 原设计概念 | **深层优化概念** | **核心收益** | **章节** |
| --- | --- | --- | --- |
| **Unified DAG** | **多态执行 (Polymorphic Exec)** | 避免简单操作的性能损耗，系统更灵动 | [1.2](#12-多态执行引擎-polymorphic-execution-engine) |
| **静态胶囊** | **动态合成 (Dynamic Fusion)** | 解决跨域复杂意图，提升工具召回率 | [1.1](#11-动态胶囊合成-dynamic-capsule-fusion) |
| **状态快照回滚** | **补偿事务 (Saga/Compensating)** | 极大降低 I/O 开销，提升回滚可靠性 | [1.3](#13-补偿事务与回滚-saga-compensating-transactions) |
| **硬编码 L0** | **声明式意图定义 (DSL)** | 统一维护，避免逻辑割裂，易于扩展 | [2.1](#21-声明式意图定义-declarative-intent-definition) |
| **线性两阶段路由** | **交互式槽位状态机** | 处理参数缺失，支持"追问"，体验更智能 | [2.2](#22-交互式槽位填充-interactive-slot-filling) |

**修订说明**: 本 v2.0 版本已全面纳入上述 5 项深层优化建议，确保架构的"有机性"和长期可维护性。

---

### 🛡️ 生产环境优化建议 (Production Hardening)

> **评审人**: 首席架构师  
> **评审日期**: 2026-01-12  
> **状态**: ✅ 全部接受并纳入设计

在深入审查设计方案后，发现3个潜在的生产环境风险点，已全部接受并纳入优化方案：

| 风险点 | **优化建议** | **状态** | **章节** |
| --- | --- | --- | --- |
| **胶囊合成冷启动** | 预测性预加载 (Predictive Pre-loading) | ✅ 已接受 | [1.1.5](#115-预测性预加载-predictive-pre-loading) |
| **Saga 部分失败** | 幂等补偿与死信队列 (Idempotent Compensation & DLQ) | ✅ 已接受 | [1.3.5](#135-幂等补偿与死信队列-idempotent-compensation--dlq) |
| **L0 规则误杀** | 置信度逃逸机制 (Confidence Escape) | ✅ 已接受 | [2.1.5](#215-l0-置信度逃逸机制-confidence-escape) |

**执行建议**：
- ✅ Phase 1 先行：胶囊化和多态引擎是地基，必须打牢
- ✅ Schema 为王：先定义核心 10 个 Workflow Schema，作为测试集
- ✅ 监控跟上：上线 L0 规则时，埋点统计"L0 命中率"和"L0 撤销率"

---

## 🎯 战略目标

| **维度** | **指标** | **当前值** | **目标值 (v4.0)** |
|---------|---------|-----------|------------------|
| **性能** | L0/L1 操作响应延迟 (P95) | ~500ms | **< 100ms** |
| **性能** | L2 复杂意图路由耗时 | ~2000ms | **< 800ms** |
| **质量** | 工作流参数提取成功率 | ~85% | **> 98%** |
| **成本** | 单次交互 Token 消耗 | 基准 | **下降 40%** |
| **稳定** | 异步任务进度丢失率 | ~5% | **0%** |

---

## 📅 Phase 1: 瘦身与治理 (Foundation & Governance)

**周期**: 第 1-2 周  
**目标**: 解决工具爆炸、幻觉调用、不可逆操作风险

---

### 1.1 动态胶囊合成 (Dynamic Capsule Fusion)

#### 问题分析

**现状**：
- 122+ Tools 扁平堆放在 `ToolRegistry` 中
- 每次 LLM 调用需要加载所有工具定义（~50KB Token）
- 工具选择准确率受上下文污染影响

**深层隐患**（架构评审发现）：
- **跨域难题**：用户指令："查找(Search)所有关于 React 的书签并删除(File)它们"
- **死锁风险**：如果 Router 选了 `SearchCapsule`，就没法删除；选了 `FileCapsule`，就没法搜索
- **静态隔离导致复杂意图无法处理**：静态胶囊会导致跨域意图被错误拆分

**影响**：
- Token 消耗高（单次 ~50KB）
- 工具选择错误率高（~15%）
- 跨域复杂意图处理失败（~20%）
- 新增工具成本高（影响所有调用）

#### 设计方案

**核心概念：动态胶囊合成 (Dynamic Capsule Fusion)**

Router 不应只选择一个胶囊，而应根据意图的**语义投影**，动态"挂载"多个胶囊。支持跨域复杂意图的完整处理。

```
┌─────────────────────────────────────────────────────────────┐
│                    ToolCapsuleRegistry                        │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ SearchCapsule│  │ FileCapsule  │  │WorkflowCapsule│      │
│  │              │  │              │  │              │      │
│  │ - search     │  │ - move       │  │ - trigger    │      │
│  │ - filter     │  │ - delete    │  │ - get_status │      │
│  │ - lookup     │  │ - tag        │  │ - cancel     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ QueryCapsule │  │ ExportCapsule│  │ FolderCapsule│      │
│  │              │  │              │  │              │      │
│  │ - list       │  │ - export_csv │  │ - create     │      │
│  │ - count      │  │ - export_md │  │ - move       │      │
│  │ - get        │  │ - export_json│ │ - delete     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

#### 实现方案

**1. 创建胶囊定义（支持能力标签）**

```typescript
// src/lib/ai-agent/tools/capsules/types.ts

export type CapabilityTag = 
  | "query"           // 查询能力
  | "modification"     // 修改能力
  | "search"           // 搜索能力
  | "export"           // 导出能力
  | "workflow"         // 工作流能力
  | "folder"           // 文件夹能力
  | "tag"              // 标签能力
  | "statistics";      // 统计能力

export interface ToolCapsule {
  id: string;                    // 胶囊 ID
  name: string;                  // 胶囊名称
  description: string;           // 胶囊描述
  toolIds: string[];             // 包含的工具 ID
  capabilityTags: CapabilityTag[]; // 能力标签（用于动态合成）
  intentTypes: IntentType[];     // 适用的意图类型（向后兼容）
  priority: number;              // 优先级（0-100）
}

export interface CapsuleRegistry {
  registerCapsule(capsule: ToolCapsule): void;
  getCapsulesForIntent(intent: IntentType): ToolCapsule[];  // 向后兼容
  getCapsulesByTags(tags: CapabilityTag[]): ToolCapsule[];  // 新增：按标签查找
  resolveCapsules(userPrompt: string, context: EngineContext): Promise<ToolCapsule[]>;  // 新增：动态解析
  getCapsuleById(id: string): ToolCapsule | null;
  getAllCapsules(): ToolCapsule[];
}
```

**2. 定义胶囊映射（包含能力标签）**

```typescript
// src/lib/ai-agent/tools/capsules/capsule-definitions.ts

export const TOOL_CAPSULES: ToolCapsule[] = [
  {
    id: "search",
    name: "搜索胶囊",
    description: "关键词搜索、语义搜索、过滤查询",
    toolIds: ["search", "filter", "lookup", "semantic_search"],
    capabilityTags: ["search", "query"],  // 能力标签
    intentTypes: ["search", "query"],     // 向后兼容
    priority: 90,
  },
  {
    id: "file",
    name: "文件操作胶囊",
    description: "书签移动、删除、标签管理",
    toolIds: ["move_bookmark", "delete_bookmark", "add_tag", "remove_tag"],
    capabilityTags: ["modification", "tag"],  // 能力标签
    intentTypes: ["manage", "action"],
    priority: 85,
  },
  {
    id: "workflow",
    name: "工作流胶囊",
    description: "工作流触发、状态查询、取消",
    toolIds: ["trigger_workflow", "get_workflow_status", "cancel_workflow"],
    capabilityTags: ["workflow"],
    intentTypes: ["workflow"],
    priority: 80,
  },
  // ... 更多胶囊
];
```

**3. 实现动态胶囊合成逻辑**

```typescript
// src/lib/ai-agent/tools/capsules/capsule-registry.ts

export class CapsuleRegistry implements CapsuleRegistry {
  private capsules: Map<string, ToolCapsule> = new Map();
  private tagIndex: Map<CapabilityTag, Set<string>> = new Map();

  /**
   * 动态解析胶囊：根据用户提示词分析所需能力，返回匹配的胶囊并集
   */
  async resolveCapsules(
    userPrompt: string,
    context: EngineContext
  ): Promise<ToolCapsule[]> {
    // 1. LLM 分析意图，输出需要的能力标签
    const requiredTags = await this.analyzeCapabilityTags(userPrompt, context);
    
    // 2. 根据标签返回所有匹配胶囊的并集
    const matchedCapsules = this.getCapsulesByTags(requiredTags);
    
    // 3. Context Window Optimization：如果并集工具过多，启用二级精选
    if (this.countTotalTools(matchedCapsules) > 15) {
      return this.reRankCapsules(matchedCapsules, userPrompt, context);
    }
    
    return matchedCapsules;
  }

  /**
   * 分析用户提示词所需的能力标签
   */
  private async analyzeCapabilityTags(
    prompt: string,
    context: EngineContext
  ): Promise<CapabilityTag[]> {
    // 使用轻量级 LLM（fast tier）分析能力需求
    const response = await llmClient.chat({
      model: "deepseek-chat",
      messages: [
        {
          role: "system",
          content: `你是一个能力分析器。分析用户提示词需要哪些能力标签。
可用标签：query, modification, search, export, workflow, folder, tag, statistics
仅返回 JSON 数组，例如：["search", "modification"]`,
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.content);
    return result.tags || [];
  }

  /**
   * 根据能力标签获取胶囊
   */
  getCapsulesByTags(tags: CapabilityTag[]): ToolCapsule[] {
    const capsuleIds = new Set<string>();
    
    for (const tag of tags) {
      const ids = this.tagIndex.get(tag) || new Set();
      ids.forEach(id => capsuleIds.add(id));
    }
    
    return Array.from(capsuleIds)
      .map(id => this.capsules.get(id))
      .filter((c): c is ToolCapsule => c !== undefined);
  }

  /**
   * 二级精选：如果工具过多，使用 Re-ranking 选择最相关的
   */
  private async reRankCapsules(
    capsules: ToolCapsule[],
    prompt: string,
    context: EngineContext
  ): Promise<ToolCapsule[]> {
    // 使用语义相似度对胶囊进行排序
    const scores = await Promise.all(
      capsules.map(async (capsule) => {
        const similarity = await this.calculateSimilarity(
          prompt,
          capsule.description
        );
        return { capsule, score: similarity };
      })
    );

    // 按分数排序，选择前 N 个，确保总工具数不超过 15
    scores.sort((a, b) => b.score - a.score);
    
    const selected: ToolCapsule[] = [];
    let totalTools = 0;
    
    for (const { capsule } of scores) {
      if (totalTools + capsule.toolIds.length <= 15) {
        selected.push(capsule);
        totalTools += capsule.toolIds.length;
      } else {
        break;
      }
    }
    
    return selected;
  }
}
```

**4. 修改 IntentRouter 使用动态合成**

```typescript
// src/lib/ai-skills/router/intent-router.ts

class IntentRouter {
  private capsuleRegistry: CapsuleRegistry;

  async route(request: UserRequest): Promise<RouteResult> {
    // 1. 动态解析胶囊（不再使用静态 getCapsulesForIntent）
    const capsules = await this.capsuleRegistry.resolveCapsules(
      request.message,
      request.context
    );
    
    // 2. 加载胶囊内的工具并集
    const tools = this.loadToolsFromCapsules(capsules);
    
    // 3. 继续后续路由逻辑...
  }

  private loadToolsFromCapsules(capsules: ToolCapsule[]): Tool[] {
    const toolIds = new Set<string>();
    for (const capsule of capsules) {
      capsule.toolIds.forEach(id => toolIds.add(id));
    }
    return toolRegistry.getToolsByIds(Array.from(toolIds));
  }
}
```

**4. 修改 KnowledgeAgent 工具加载**

```typescript
// src/lib/ai-agent/core/knowledge-agent.ts

class KnowledgeAgent {
  async execute(input: string, context: EngineContext) {
    // 从上下文获取已加载的胶囊工具（而非全部工具）
    const tools = context.capsuleTools || this.getDefaultTools();
    
    // 使用胶囊工具执行...
  }
}
```

#### 文件结构

```
src/lib/ai-agent/tools/
├── capsules/
│   ├── types.ts                    # 胶囊类型定义
│   ├── capsule-registry.ts         # 胶囊注册表
│   ├── capsule-definitions.ts      # 胶囊定义（10-15 个胶囊）
│   └── __tests__/
│       ├── capsule-registry.test.ts
│       └── capsule-definitions.test.ts
├── tool-registry.ts                # 现有工具注册表（保持不变）
└── index.ts                         # 导出胶囊相关 API
```

#### 验收标准

| 指标 | 目标值 | 验证方法 |
|------|--------|---------|
| 单次 LLM 调用 Tool Definition Token | < 15KB（原 50KB） | 日志统计 |
| 工具选择准确率 | > 92% | A/B 测试 |
| 胶囊加载时间 | < 10ms | 性能测试 |

---

### 1.1.5 预测性预加载 (Predictive Pre-loading)

#### 问题分析

**潜在暗礁**（生产环境发现）：
- **延迟叠加**：`resolveCapsules` 方法需要先调用轻量级 LLM 分析 Tags（~200ms），再加上后续主 LLM 调用，总延迟可能增加
- **冷启动问题**：首次请求需要等待 LLM 分析，影响首字延迟（TTFT）
- **风险**：为了省 Token 而牺牲了响应速度

#### 优化方案

**核心概念：预测性预加载 (Predictive Pre-loading)**

利用前端用户行为轨迹来掩盖 LLM 分析的延迟，在用户实际输入前预先加载胶囊。

**实现策略**：

1. **交互点预加载**：
   - 用户鼠标悬停在"搜索框" → 预加载 `SearchCapsule`
   - 用户进入"批量管理"页面 → 预加载 `FileCapsule`
   - 用户点击"工作流"菜单 → 预加载 `WorkflowCapsule`

2. **热缓存机制**：
   - 预加载的胶囊存储在热缓存中（内存 + Redis）
   - 缓存有效期：5 分钟
   - 缓存键：`capsule:${userId}:${capsuleId}`

#### 实现方案

**1. 在 IntentRouter 中增加 warmup 接口**

```typescript
// src/lib/ai-skills/router/intent-router.ts

export class IntentRouter {
  private capsuleRegistry: CapsuleRegistry;
  private warmCache: Map<string, ToolCapsule[]> = new Map();

  /**
   * 预热胶囊（预测性预加载）
   * 
   * @param context - 用户上下文（包含页面路径、交互元素等）
   */
  async warmup(context: WarmupContext): Promise<void> {
    // 1. 根据上下文预测可能需要的胶囊
    const predictedCapsules = this.predictCapsules(context);
    
    // 2. 异步预加载（不阻塞）
    this.preloadCapsules(predictedCapsules, context.userId);
  }

  /**
   * 根据用户行为预测需要的胶囊
   */
  private predictCapsules(context: WarmupContext): string[] {
    const predictions: string[] = [];

    // 基于页面路径预测
    if (context.pagePath === "/search" || context.hoverElement === "search-input") {
      predictions.push("search");
    }
    if (context.pagePath === "/batch" || context.hoverElement === "batch-button") {
      predictions.push("file");
    }
    if (context.pagePath === "/workflow") {
      predictions.push("workflow");
    }

    // 基于历史行为预测（可选）
    if (context.userHistory) {
      const frequentCapsules = this.analyzeFrequentCapsules(context.userHistory);
      predictions.push(...frequentCapsules);
    }

    return [...new Set(predictions)];  // 去重
  }

  /**
   * 预加载胶囊到热缓存
   */
  private async preloadCapsules(
    capsuleIds: string[],
    userId: string
  ): Promise<void> {
    for (const capsuleId of capsuleIds) {
      const cacheKey = `capsule:${userId}:${capsuleId}`;
      
      // 检查缓存
      if (this.warmCache.has(cacheKey)) {
        continue;  // 已缓存，跳过
      }

      // 异步预加载（不阻塞主流程）
      this.loadCapsuleAsync(capsuleId, cacheKey);
    }
  }

  private async loadCapsuleAsync(capsuleId: string, cacheKey: string): Promise<void> {
    try {
      // 模拟 LLM 分析（实际中这里会调用轻量级 LLM）
      const capsule = await this.capsuleRegistry.getCapsuleById(capsuleId);
      if (capsule) {
        this.warmCache.set(cacheKey, [capsule]);
        
        // 同时存储到 Redis（跨实例共享）
        await redis.setex(
          cacheKey,
          300,  // 5 分钟过期
          JSON.stringify(capsule)
        );
      }
    } catch (error) {
      // 预加载失败不影响主流程
      logger.warn({ capsuleId, error }, "Capsule preload failed");
    }
  }

  /**
   * 修改 resolveCapsules，优先使用热缓存
   */
  async resolveCapsules(
    userPrompt: string,
    context: EngineContext
  ): Promise<ToolCapsule[]> {
    // 1. 先检查热缓存
    const cachedCapsules = this.getCachedCapsules(context.userId);
    if (cachedCapsules.length > 0) {
      // 缓存命中，直接返回（零延迟）
      logger.debug({ userId: context.userId }, "Capsule cache hit");
      return cachedCapsules;
    }

    // 2. 缓存未命中，走正常流程（LLM 分析）
    return this.capsuleRegistry.resolveCapsules(userPrompt, context);
  }

  private getCachedCapsules(userId: string): ToolCapsule[] {
    const capsules: ToolCapsule[] = [];
    
    // 从内存缓存获取
    for (const [key, value] of this.warmCache.entries()) {
      if (key.startsWith(`capsule:${userId}:`)) {
        capsules.push(...value);
      }
    }
    
    return capsules;
  }
}

/**
 * 预热上下文
 */
export interface WarmupContext {
  userId: string;
  pagePath?: string;           // 当前页面路径
  hoverElement?: string;        // 鼠标悬停的元素 ID
  userHistory?: {              // 用户历史行为（可选）
    recentCapsules: string[];
    frequentActions: string[];
  };
}
```

**2. 前端集成（关键交互点调用 warmup）**

```typescript
// src/components/search/search-input.tsx

export function SearchInput() {
  const router = useRouter();

  // 鼠标悬停时预热
  const handleMouseEnter = useCallback(async () => {
    await fetch("/api/agent/warmup", {
      method: "POST",
      body: JSON.stringify({
        pagePath: router.pathname,
        hoverElement: "search-input",
      }),
    });
  }, [router.pathname]);

  return (
    <Input
      placeholder="搜索..."
      onMouseEnter={handleMouseEnter}  // 悬停时预热
    />
  );
}

// src/app/(main)/batch/page.tsx

export default function BatchPage() {
  useEffect(() => {
    // 页面加载时预热
    fetch("/api/agent/warmup", {
      method: "POST",
      body: JSON.stringify({
        pagePath: "/batch",
      }),
    });
  }, []);

  return <BatchPageClient />;
}
```

**3. 后端 API 端点**

```typescript
// src/app/api/agent/warmup/route.ts

export async function POST(request: Request) {
  const { userId } = await getAuthenticatedUser(request);
  const body = await request.json();

  const intentRouter = getIntentRouter();
  await intentRouter.warmup({
    userId,
    ...body,
  });

  return Response.json({ success: true });
}
```

#### 文件结构更新

```
src/lib/ai-skills/router/
├── intent-router.ts              # 添加 warmup() 方法
└── warmup/
    ├── warmup-context.ts         # 预热上下文类型
    └── capsule-predictor.ts      # 胶囊预测器

src/app/api/agent/
└── warmup/route.ts               # 预热 API 端点
```

#### 验收标准

| 指标 | 目标值 | 验证方法 |
|------|--------|---------|
| 预加载命中率 | > 60% | 日志统计 |
| 首字延迟（TTFT）改善 | 减少 150-200ms | 性能测试 |
| 预加载失败不影响主流程 | 100% | 错误注入测试 |

#### 预计工时

- 胶囊定义与注册表：4 小时
- IntentRouter 集成：3 小时
- KnowledgeAgent 修改：2 小时
- 预测性预加载实现：4 小时
- 测试与验证：3 小时
- **总计**: 16 小时（约 2-3 个工作日）

---

### 1.2 多态执行引擎 (Polymorphic Execution Engine)

#### 问题分析

**现状**：
- 三套执行逻辑并行：Atomic、Orchestration、Workflow
- 各自实现日志、重试、状态管理
- 代码重复，维护成本高

**深层隐患**（架构评审发现）：
- **过度抽象风险**：将一个简单的"点个赞"或"删个书签"强行封装成 DAG（图结构），会引入不必要的调度开销（拓扑排序、状态持久化、数据库读写）
- **延迟累积**：DAG 引擎通常是重状态的，对于毫秒级要求的原子操作，这是不可接受的
- **性能损耗**：为了杀一只鸡，启动了一条完整的工业流水线

**影响**：
- 状态管理不一致
- 错误处理逻辑分散
- 简单操作性能损耗（不必要的 DAG 开销）
- 新增执行模式需要重复实现基础设施

#### 设计方案

**核心概念：多态执行原语 (Polymorphic Execution Primitives)**

不要强制统一为 DAG，而是建立**分级执行原语**，根据任务复杂度选择最合适的执行方式：

- **Level 1: Direct Invocation (函数指针)**
  - 对应 L0/L1 操作
  - 不走 DAG，不走持久化，不走状态机
  - 直接函数调用
  - *适用于*：UI 交互、简单查询（如"有多少收藏"）

- **Level 2: Linear Pipeline (管道)**
  - 简单的 `A -> B -> C` 链式调用
  - 内存中执行，不需要复杂的图调度
  - *适用于*：简单的意图处理（如：搜 -> 过滤 -> 返回）

- **Level 3: Persistent DAG (持久化图)**
  - 对应真正的工作流
  - 需要断点续传、可视化、人工干预
  - *适用于*：生成周报、批量清洗数据

```
┌─────────────────────────────────────────────────────────────┐
│                  Polymorphic Execution Engine                 │
│                                                               │
│  Request ──┐                                                 │
│            │                                                  │
│            ├──► Router ──┐                                   │
│            │              │                                  │
│            │              ├──► Atomic ──► ⚡ DirectExecutor   │
│            │              │              (函数指针调用)      │
│            │              │                                  │
│            │              ├──► Chain ──► 🔗 PipelineExecutor │
│            │              │              (线性管道)          │
│            │              │                                  │
│            │              └──► Workflow ──► 🕸️ DAGEngine     │
│            │                              (持久化图)          │
│            │                                                  │
│            └──► 共享基础设施                                  │
│                  - 日志记录                                   │
│                  - 错误处理                                   │
│                  - 性能监控                                   │
└─────────────────────────────────────────────────────────────┘
```

#### 实现方案

**1. 定义多态执行原语接口**

```typescript
// src/lib/ai-skills/execution/primitives/types.ts

/**
 * 执行原语类型
 */
export type ExecutionPrimitive = "direct" | "pipeline" | "dag";

/**
 * 执行原语接口（统一接口，不同实现）
 */
export interface ExecutionPrimitiveBase {
  /**
   * 执行原语
   */
  execute(
    definition: ExecutionDefinition,
    context: ExecutionContext
  ): AsyncGenerator<ExecutionEvent>;
  
  /**
   * 是否支持该定义
   */
  supports(definition: ExecutionDefinition): boolean;
  
  /**
   * 估算执行时间（用于选择最优原语）
   */
  estimateDuration(definition: ExecutionDefinition): number;
}

/**
 * Level 1: Direct Invocation（直接调用）
 */
export interface DirectExecutionDefinition {
  type: "direct";
  toolId: string;
  params: Record<string, unknown>;
}

/**
 * Level 2: Linear Pipeline（线性管道）
 */
export interface PipelineExecutionDefinition {
  type: "pipeline";
  steps: Array<{
    toolId: string;
    params: Record<string, unknown>;
    transform?: (prevResult: unknown) => Record<string, unknown>;  // 参数转换
  }>;
}

/**
 * Level 3: Persistent DAG（持久化图）
 */
export interface DAGExecutionDefinition {
  type: "dag";
  nodes: DAGNode[];
  edges: DAGEdge[];
  persistState: boolean;  // 是否需要持久化状态
}

export type ExecutionDefinition =
  | DirectExecutionDefinition
  | PipelineExecutionDefinition
  | DAGExecutionDefinition;
```

**2. 实现三种执行原语**

```typescript
// src/lib/ai-skills/execution/primitives/direct-executor.ts

/**
 * Level 1: Direct Invocation Executor
 * 直接函数调用，零开销
 */
export class DirectExecutor implements ExecutionPrimitiveBase {
  supports(definition: ExecutionDefinition): boolean {
    return definition.type === "direct";
  }

  estimateDuration(definition: ExecutionDefinition): number {
    // 直接调用通常 < 50ms
    return 50;
  }

  async *execute(
    definition: DirectExecutionDefinition,
    context: ExecutionContext
  ): AsyncGenerator<ExecutionEvent> {
    const tool = toolRegistry.getTool(definition.toolId);
    if (!tool) {
      throw new Error(`Tool ${definition.toolId} not found`);
    }

    // 直接调用，不走任何中间层
    const result = await tool.execute(definition.params, context);
    
    yield {
      type: "complete",
      result,
      duration: Date.now() - context.startTime,
    };
  }
}

// src/lib/ai-skills/execution/primitives/pipeline-executor.ts

/**
 * Level 2: Linear Pipeline Executor
 * 内存中的链式调用，轻量级
 */
export class PipelineExecutor implements ExecutionPrimitiveBase {
  supports(definition: ExecutionDefinition): boolean {
    return definition.type === "pipeline";
  }

  estimateDuration(definition: ExecutionDefinition): number {
    // 每个步骤约 100ms
    return (definition as PipelineExecutionDefinition).steps.length * 100;
  }

  async *execute(
    definition: PipelineExecutionDefinition,
    context: ExecutionContext
  ): AsyncGenerator<ExecutionEvent> {
    let prevResult: unknown = null;

    for (let i = 0; i < definition.steps.length; i++) {
      const step = definition.steps[i];
      
      yield {
        type: "step_start",
        stepIndex: i,
        toolId: step.toolId,
      };

      const tool = toolRegistry.getTool(step.toolId);
      if (!tool) {
        throw new Error(`Tool ${step.toolId} not found`);
      }

      // 参数转换（如果有）
      const params = step.transform
        ? step.transform(prevResult)
        : step.params;

      const result = await tool.execute(params, context);
      prevResult = result;

      yield {
        type: "step_complete",
        stepIndex: i,
        result,
      };
    }

    yield {
      type: "complete",
      result: prevResult,
      duration: Date.now() - context.startTime,
    };
  }
}

// src/lib/ai-skills/execution/primitives/dag-executor.ts

/**
 * Level 3: Persistent DAG Executor
 * 完整的 DAG 执行引擎，支持持久化
 */
export class DAGExecutor implements ExecutionPrimitiveBase {
  private stateManager: DAGStateManager;
  private nodeExecutor: NodeExecutor;

  supports(definition: ExecutionDefinition): boolean {
    return definition.type === "dag";
  }

  estimateDuration(definition: ExecutionDefinition): number {
    // DAG 执行时间取决于节点数和复杂度
    const dag = definition as DAGExecutionDefinition;
    return dag.nodes.length * 200;  // 每个节点约 200ms
  }

  async *execute(
    definition: DAGExecutionDefinition,
    context: ExecutionContext
  ): AsyncGenerator<ExecutionEvent> {
    // 1. 拓扑排序
    const executionOrder = this.topologicalSort(definition);
    
    // 2. 初始化状态（仅当需要持久化时）
    let executionId: string | null = null;
    if (definition.persistState) {
      executionId = await this.stateManager.createExecution(
        definition.id || `dag-${Date.now()}`,
        context
      );
    }
    
    // 3. 按顺序执行节点
    for (const nodeId of executionOrder) {
      const node = definition.nodes.find(n => n.id === nodeId)!;
      
      // 检查依赖是否完成
      if (executionId && !this.checkDependencies(node, executionId)) {
        continue;
      }
      
      yield* this.executeNode(node, definition, executionId, context);
    }
  }

  private async *executeNode(
    node: DAGNode,
    dag: DAGExecutionDefinition,
    executionId: string | null,
    context: ExecutionContext
  ): AsyncGenerator<ExecutionEvent> {
    yield { type: "node_start", nodeId: node.id };
    
    try {
      const result = await this.nodeExecutor.execute(node, context);
      
      // 仅当需要持久化时保存状态
      if (executionId) {
        await this.stateManager.saveNodeResult(executionId, node.id, result);
      }
      
      yield { type: "node_complete", nodeId: node.id, result };
    } catch (error) {
      yield { type: "node_error", nodeId: node.id, error };
      
      // 错误处理策略
      if (node.onError === "stop") {
        throw error;
      } else if (node.onError === "skip") {
        // 跳过此节点，继续执行
      } else if (node.onError === "continue") {
        // 记录错误但继续
      }
    }
  }
}
```

**3. 实现多态执行引擎（自动选择最优原语）**

```typescript
// src/lib/ai-skills/execution/polymorphic-engine.ts

export class PolymorphicExecutionEngine {
  private executors: ExecutionPrimitiveBase[];

  constructor() {
    // 注册所有执行原语
    this.executors = [
      new DirectExecutor(),
      new PipelineExecutor(),
      new DAGExecutor(),
    ];
  }

  /**
   * 根据执行定义自动选择最优执行原语
   */
  async *execute(
    definition: ExecutionDefinition,
    context: ExecutionContext
  ): AsyncGenerator<ExecutionEvent> {
    // 1. 选择最优执行原语
    const executor = this.selectBestExecutor(definition);
    
    // 2. 使用选中的执行原语执行
    yield* executor.execute(definition, context);
  }

  /**
   * 选择最优执行原语
   */
  private selectBestExecutor(
    definition: ExecutionDefinition
  ): ExecutionPrimitiveBase {
    // 1. 找到所有支持该定义的原语
    const candidates = this.executors.filter(e => e.supports(definition));
    
    if (candidates.length === 0) {
      throw new Error(`No executor supports definition type: ${definition.type}`);
    }

    // 2. 选择执行时间最短的原语
    const best = candidates.reduce((prev, curr) => {
      const prevDuration = prev.estimateDuration(definition);
      const currDuration = curr.estimateDuration(definition);
      return currDuration < prevDuration ? curr : prev;
    });

    return best;
  }
}
```

**4. 修改 ExecutionCoordinator 使用多态引擎**

```typescript
// src/lib/ai-skills/engine/execution-coordinator.ts

class ExecutionCoordinator {
  private polymorphicEngine: PolymorphicExecutionEngine;

  async *execute(
    input: string,
    context: EngineContext,
    options: ExecuteOptions
  ): AsyncGenerator<UnifiedStreamChunk> {
    // 1. 根据模式转换为执行定义（而非 DAG）
    const definition = this.convertToDefinition(input, context, options);
    
    // 2. 使用多态引擎自动选择最优执行原语
    for await (const event of this.polymorphicEngine.execute(definition, context)) {
      // 3. 转换为 UnifiedStreamChunk
      yield this.adaptEventToStreamChunk(event);
    }
  }

  private convertToDefinition(
    input: string,
    context: EngineContext,
    options: ExecuteOptions
  ): ExecutionDefinition {
    if (options.mode === "atomic") {
      // 原子模式：直接调用
      return {
        type: "direct",
        toolId: options.toolId!,
        params: options.params || {},
      };
    } else if (options.mode === "orchestration") {
      // 编排模式：线性管道（如果步骤简单）或 DAG（如果复杂）
      const skill = this.getSkill(options.skillId!);
      
      // 判断是简单管道还是复杂 DAG
      if (skill.steps.length <= 3 && !skill.hasConditionalSteps) {
        return {
          type: "pipeline",
          steps: skill.steps.map(step => ({
            toolId: step.toolId,
            params: step.params,
            transform: step.transform,
          })),
        };
      } else {
        // 复杂情况使用 DAG
        return {
          type: "dag",
          nodes: skill.steps.map(step => ({
            id: step.id,
            type: step.type,
            config: step.config,
            dependencies: step.dependencies || [],
          })),
          edges: this.buildEdges(skill.steps),
          persistState: false,  // 编排模式不需要持久化
        };
      }
    } else if (options.mode === "workflow") {
      // 工作流模式：持久化 DAG
      const workflow = this.getWorkflow(options.workflowId!);
      return {
        type: "dag",
        nodes: workflow.steps.map(step => ({
          id: step.id,
          type: this.mapStepType(step.type),
          config: step.config,
          dependencies: step.dependencies || [],
        })),
        edges: this.buildEdges(workflow.steps),
        persistState: true,  // 工作流需要持久化
      };
    }
    throw new Error("Unknown execution mode");
  }
}
```

#### 文件结构

```
src/lib/ai-skills/
├── dag/
│   ├── types.ts                    # DAG 类型定义
│   ├── dag-runner.ts               # DAG 执行器
│   ├── state-manager.ts            # DAG 状态管理
│   ├── node-executor.ts            # 节点执行器
│   ├── adapters/
│   │   ├── atomic-adapter.ts       # 原子模式适配器
│   │   ├── orchestration-adapter.ts # 编排模式适配器
│   │   └── workflow-adapter.ts     # 工作流适配器
│   └── __tests__/
│       ├── dag-runner.test.ts
│       └── adapters/
│           └── atomic-adapter.test.ts
└── engine/
    └── execution-coordinator.ts    # 修改为使用 DAGRunner
```

#### 验收标准

| 指标 | 目标值 | 验证方法 |
|------|--------|---------|
| 三种模式共享同一套日志 | 100% | 代码审查 |
| 错误处理逻辑统一 | 100% | 测试覆盖 |
| 状态管理一致性 | 100% | 集成测试 |

#### 预计工时

- DAG 数据结构设计：3 小时
- DAGRunner 实现：8 小时
- 三种模式适配器：6 小时
- ExecutionCoordinator 重构：4 小时
- 测试与验证：5 小时
- **总计**: 26 小时（约 4 个工作日）

---

### 1.3 补偿事务与回滚 (Saga Compensating Transactions)

#### 问题分析

**现状**：
- AI 执行操作后无法撤销
- 批量删除等高风险操作缺乏安全保障
- 用户缺乏"后悔药"

**深层隐患**（架构评审发现）：
- **性能黑洞**：如果用户批量移动了 1000 个书签，保存这 1000 个书签移动前的完整 JSON 快照，数据库 I/O 会瞬间爆炸
- **一致性风险**：在快照恢复期间，如果有新数据写入怎么办？
- **存储开销**：状态快照占用大量存储空间

**影响**：
- 用户信任度低
- 高风险操作使用率低
- 错误操作无法恢复
- 批量操作性能差（快照开销）

#### 设计方案

**核心概念：Saga 模式与补偿事务 (Saga Pattern & Compensating Transactions)**

借鉴微服务架构的 Saga 模式。我们不存数据快照，我们只存**逻辑逆操作**（Write-Ahead Log）。

```
┌─────────────────────────────────────────────────────────────┐
│                    SagaTransactionManager                     │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │          Write-Ahead Log (WAL)                       │   │
│  │                                                       │   │
│  │  [                                                     │   │
│  │    {                                                    │   │
│  │      id: "op-1",                                       │   │
│  │      tool: "delete_bookmark",                        │   │
│  │      params: { id: "bookmark-123" },                  │   │
│  │      compensatingCommand: {                          │   │
│  │        tool: "restore_bookmark",                      │   │
│  │        params: { id: "bookmark-123", folder: "old" } │   │
│  │      }                                                 │   │
│  │    }                                                   │   │
│  │  ]                                                     │   │
│  │  (仅存储参数，不存储完整数据快照)                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │           补偿命令生成器 (CompensatingGenerator)        │   │
│  │                                                       │   │
│  │  - 执行前生成反向命令（而非快照）                      │   │
│  │  - 存储极其轻量（只存参数）                            │   │
│  │  - 逻辑更清晰，易于维护                                │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

#### 实现方案

**1. 定义补偿事务接口（Saga 模式）**

```typescript
// src/lib/ai-agent/effects/saga/types.ts

/**
 * 补偿命令（Compensating Command）
 * 存储反向操作的参数，而非完整数据快照
 */
export interface CompensatingCommand {
  toolId: string;
  params: Record<string, unknown>;
}

/**
 * Saga 操作记录（Write-Ahead Log 条目）
 */
export interface SagaOperation {
  id: string;
  toolId: string;
  params: Record<string, unknown>;
  result?: unknown;  // 执行结果（可选，用于调试）
  compensatingCommand: CompensatingCommand;  // 补偿命令（必需）
  executedAt: Date;
}

/**
 * Saga 事务
 */
export interface SagaTransaction {
  id: string;
  userId: string;
  operations: SagaOperation[];  // WAL 日志
  status: "pending" | "committed" | "compensated";
  createdAt: Date;
  committedAt?: Date;
  compensatedAt?: Date;
}

export interface SagaTransactionManager {
  beginTransaction(userId: string): Promise<SagaTransaction>;
  addOperation(
    transactionId: string,
    operation: Omit<SagaOperation, "id" | "executedAt">
  ): Promise<void>;
  commit(transactionId: string): Promise<void>;
  compensate(transactionId: string): Promise<void>;  // 补偿（而非回滚）
  getTransaction(id: string): Promise<SagaTransaction | null>;
}
```

**2. 修改 Tool 接口，要求写操作生成补偿命令**

```typescript
// src/lib/ai-agent/tools/types.ts

export interface Tool<TParams, TResult> {
  id: string;
  name: string;
  description: string;
  execute(params: TParams, context: ToolContext): Promise<TResult>;
  
  // 新增：生成补偿命令（仅写操作需要）
  // 返回反向操作的参数，而非执行回滚
  generateCompensatingCommand?(
    params: TParams,
    result: TResult,
    context: ToolContext
  ): Promise<CompensatingCommand>;
  
  // 新增：是否为写操作
  isWriteOperation?: boolean;
}

// 示例：delete_bookmark 工具的补偿命令生成
const deleteBookmarkTool: Tool<DeleteBookmarkParams, DeleteBookmarkResult> = {
  id: "delete_bookmark",
  // ... 其他字段
  
  async generateCompensatingCommand(params, result, context) {
    // 在执行删除前，我们已经知道要删除的书签信息
    // 生成恢复命令（而非保存完整快照）
    return {
      toolId: "restore_bookmark",
      params: {
        id: params.id,
        folderId: result.originalFolderId,  // 从执行结果获取
        // 仅存储必要的恢复参数，不存储完整书签数据
      },
    };
  },
};
```

**3. 实现 SagaTransactionManager（补偿事务管理器）**

```typescript
// src/lib/ai-agent/effects/saga/saga-transaction-manager.ts

export class SagaTransactionManager implements SagaTransactionManager {
  private transactions: Map<string, SagaTransaction> = new Map();
  private toolRegistry: ToolRegistry;

  async beginTransaction(userId: string): Promise<SagaTransaction> {
    const transaction: SagaTransaction = {
      id: `saga-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userId,
      operations: [],
      status: "pending",
      createdAt: new Date(),
    };
    
    this.transactions.set(transaction.id, transaction);
    return transaction;
  }

  async addOperation(
    transactionId: string,
    operation: Omit<SagaOperation, "id" | "executedAt">
  ): Promise<void> {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) {
      throw new Error(`Transaction ${transactionId} not found`);
    }
    
    // 添加到 WAL（Write-Ahead Log）
    const sagaOp: SagaOperation = {
      id: `op-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...operation,
      executedAt: new Date(),
    };
    
    transaction.operations.push(sagaOp);
    
    // 持久化 WAL（轻量级，只存参数）
    await this.persistWAL(transactionId, sagaOp);
  }

  async commit(transactionId: string): Promise<void> {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) {
      throw new Error(`Transaction ${transactionId} not found`);
    }
    
    transaction.status = "committed";
    transaction.committedAt = new Date();
    
    // 持久化事务状态（可选，用于审计）
    await this.persistTransaction(transaction);
  }

  /**
   * 补偿（Compensate）：按逆序执行补偿命令
   */
  async compensate(transactionId: string): Promise<void> {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) {
      throw new Error(`Transaction ${transactionId} not found`);
    }
    
    // 按逆序执行补偿命令（Saga 模式）
    for (let i = transaction.operations.length - 1; i >= 0; i--) {
      const op = transaction.operations[i];
      const compensatingCommand = op.compensatingCommand;
      
      const tool = this.toolRegistry.getTool(compensatingCommand.toolId);
      if (tool) {
        try {
          await tool.execute(compensatingCommand.params, {
            userId: transaction.userId,
          });
        } catch (error) {
          // 补偿失败，记录日志但继续执行其他补偿
          logger.error(
            { transactionId, operationId: op.id, error },
            "Compensation failed, continuing with other compensations"
          );
        }
      }
    }
    
    transaction.status = "compensated";
    transaction.compensatedAt = new Date();
    await this.persistTransaction(transaction);
  }

  /**
   * 持久化 WAL（轻量级，只存参数）
   */
  private async persistWAL(
    transactionId: string,
    operation: SagaOperation
  ): Promise<void> {
    // 存储到数据库（仅参数，不存储完整数据快照）
    await supabase.from("saga_wal").insert({
      transaction_id: transactionId,
      operation_id: operation.id,
      tool_id: operation.toolId,
      params: operation.params,  // JSONB，轻量级
      compensating_command: operation.compensatingCommand,  // JSONB
      executed_at: operation.executedAt,
    });
  }
}
```

**4. 修改 EffectManager 集成补偿事务**

```typescript
// src/lib/ai-agent/effects/effect-manager.ts

class EffectManager {
  private sagaManager: SagaTransactionManager;

  async executeTool(
    tool: Tool,
    params: Record<string, unknown>,
    context: EngineContext
  ): Promise<ToolResult> {
    // 如果是写操作，开启 Saga 事务
    let transactionId: string | null = null;
    if (tool.isWriteOperation) {
      const transaction = await this.sagaManager.beginTransaction(
        context.userId
      );
      transactionId = transaction.id;
    }
    
    try {
      // 执行前生成补偿命令（Write-Ahead Log）
      let compensatingCommand: CompensatingCommand | null = null;
      if (transactionId && tool.generateCompensatingCommand) {
        // 注意：这里需要先执行才能获取结果，但为了生成补偿命令
        // 我们需要在执行前就准备好补偿参数
        // 实际实现中，可能需要工具提供"预览"功能
        compensatingCommand = await this.prepareCompensatingCommand(
          tool,
          params,
          context
        );
      }
      
      // 执行操作
      const result = await tool.execute(params, context);
      
      // 记录到 WAL（Write-Ahead Log）
      if (transactionId && compensatingCommand) {
        await this.sagaManager.addOperation(transactionId, {
          toolId: tool.id,
          params,
          result,  // 可选，用于调试
          compensatingCommand,
        });
        await this.sagaManager.commit(transactionId);
      }
      
      return result;
    } catch (error) {
      // 执行失败，自动补偿
      if (transactionId) {
        await this.sagaManager.compensate(transactionId);
      }
      throw error;
    }
  }

  /**
   * 准备补偿命令（在执行前）
   */
  private async prepareCompensatingCommand(
    tool: Tool,
    params: Record<string, unknown>,
    context: EngineContext
  ): Promise<CompensatingCommand> {
    // 如果工具实现了 generateCompensatingCommand，需要先"预览"执行结果
    // 或者工具提供"预览"方法
    if (tool.generateCompensatingCommand) {
      // 方案1：工具提供预览功能
      if ("preview" in tool && typeof tool.preview === "function") {
        const previewResult = await tool.preview(params, context);
        return tool.generateCompensatingCommand(params, previewResult, context);
      }
      
      // 方案2：使用预定义的补偿映射
      return this.getDefaultCompensatingCommand(tool.id, params);
    }
    
    // 默认补偿命令
    return this.getDefaultCompensatingCommand(tool.id, params);
  }
}
```

**5. 前端 UI 集成撤销按钮**

```typescript
// src/components/ai/undo-button.tsx

export function UndoButton({ transactionId }: { transactionId: string }) {
  const handleUndo = async () => {
    await fetch("/api/agent/transactions/rollback", {
      method: "POST",
      body: JSON.stringify({ transactionId }),
    });
  };

  return (
    <Button onClick={handleUndo} variant="outline">
      撤销
    </Button>
  );
}
```

#### 文件结构

```
src/lib/ai-agent/effects/
├── transaction/
│   ├── types.ts                    # 事务类型定义
│   ├── transaction-manager.ts     # 事务管理器
│   ├── rollback-generator.ts      # 回滚操作生成器
│   └── __tests__/
│       └── transaction-manager.test.ts
└── effect-manager.ts              # 修改为集成事务

src/app/api/agent/transactions/
├── rollback/route.ts               # 回滚 API
└── history/route.ts                # 事务历史 API
```

#### 验收标准

| 指标 | 目标值 | 验证方法 |
|------|--------|---------|
| 写操作工具实现 rollback | 100% | 代码审查 |
| 批量删除可一键回滚 | 100% | 手动测试 |
| 回滚成功率 | > 99% | 集成测试 |

---

### 1.3.5 幂等补偿与死信队列 (Idempotent Compensation & DLQ)

#### 问题分析

**潜在暗礁**（生产环境发现）：
- **部分失败风险**：如果补偿操作本身失败了（例如网络断开），数据将处于"半回滚"的脏状态
- **重复触发风险**：用户疯狂点击"撤销"按钮，导致重复触发补偿，可能造成数据不一致
- **风险**：Saga 模式要求所有补偿操作必须是幂等的，且需要处理部分失败场景

#### 优化方案

**核心概念：幂等补偿与死信队列**

1. **幂等性保证**：所有 restore 工具必须实现幂等性（执行 1 次和执行 10 次结果相同）
2. **死信队列 (DLQ)**：补偿失败时推入 DLQ，由后台守护进程重试

#### 实现方案

**1. 工具接口增加幂等性要求**

```typescript
// src/lib/ai-agent/tools/types.ts

export interface Tool<TParams, TResult> {
  id: string;
  name: string;
  description: string;
  execute(params: TParams, context: ToolContext): Promise<TResult>;
  
  /**
   * 生成补偿命令
   */
  generateCompensatingCommand?(
    params: TParams,
    result: TResult,
    context: ToolContext
  ): Promise<CompensatingCommand>;
  
  /**
   * 是否为写操作
   */
  isWriteOperation?: boolean;
  
  /**
   * 是否为幂等操作（补偿操作必须是幂等的）
   */
  isIdempotent?: boolean;
  
  /**
   * 幂等键生成器（用于去重）
   */
  getIdempotencyKey?: (params: TParams) => string;
}
```

**2. 增强 SagaTransactionManager 支持幂等性和 DLQ**

```typescript
// src/lib/ai-agent/effects/saga/saga-transaction-manager.ts

export class SagaTransactionManager implements SagaTransactionManager {
  private deadLetterQueue: DeadLetterQueue;
  private idempotencyStore: IdempotencyStore;  // 幂等性存储

  /**
   * 补偿（增强版：支持幂等性和失败重试）
   */
  async compensate(transactionId: string): Promise<void> {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) {
      throw new Error(`Transaction ${transactionId} not found`);
    }

    // 检查是否已经补偿过（幂等性检查）
    if (transaction.status === "compensated") {
      logger.warn({ transactionId }, "Transaction already compensated, skipping");
      return;
    }

    // 按逆序执行补偿命令
    const failedCompensations: Array<{
      operationId: string;
      command: CompensatingCommand;
      error: Error;
    }> = [];

    for (let i = transaction.operations.length - 1; i >= 0; i--) {
      const op = transaction.operations[i];
      
      try {
        // 幂等性检查
        const idempotencyKey = this.getIdempotencyKey(op.compensatingCommand);
        if (await this.idempotencyStore.isProcessed(idempotencyKey)) {
          logger.debug({ idempotencyKey }, "Compensation already processed, skipping");
          continue;
        }

        // 执行补偿
        await this.executeCompensation(op.compensatingCommand, transaction.userId);
        
        // 标记为已处理（幂等性）
        await this.idempotencyStore.markProcessed(idempotencyKey);
      } catch (error) {
        // 补偿失败，记录到失败列表
        logger.error(
          { transactionId, operationId: op.id, error },
          "Compensation failed, will retry via DLQ"
        );
        
        failedCompensations.push({
          operationId: op.id,
          command: op.compensatingCommand,
          error: error as Error,
        });
      }
    }

    // 如果有失败的补偿，推入死信队列
    if (failedCompensations.length > 0) {
      await this.deadLetterQueue.enqueue({
        transactionId,
        failedCompensations,
        retryCount: 0,
        maxRetries: 10,
      });
    }

    // 更新事务状态
    transaction.status = failedCompensations.length > 0
      ? "compensating_partial"  // 部分补偿
      : "compensated";          // 完全补偿
    
    transaction.compensatedAt = new Date();
    await this.persistTransaction(transaction);
  }

  /**
   * 执行补偿命令（带重试）
   */
  private async executeCompensation(
    command: CompensatingCommand,
    userId: string
  ): Promise<void> {
    const tool = this.toolRegistry.getTool(command.toolId);
    if (!tool) {
      throw new Error(`Tool ${command.toolId} not found`);
    }

    // 检查工具是否支持幂等性
    if (!tool.isIdempotent) {
      logger.warn(
        { toolId: command.toolId },
        "Compensation tool is not marked as idempotent"
      );
    }

    // 执行补偿（带重试）
    let lastError: Error | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await tool.execute(command.params, { userId });
        return;  // 成功，退出
      } catch (error) {
        lastError = error as Error;
        if (attempt < 2) {
          // 指数退避重试
          await this.sleep(Math.pow(2, attempt) * 1000);
        }
      }
    }

    // 所有重试都失败，抛出错误
    throw lastError || new Error("Compensation execution failed");
  }

  /**
   * 生成幂等键
   */
  private getIdempotencyKey(command: CompensatingCommand): string {
    // 使用工具 ID + 参数哈希生成唯一键
    const paramsHash = crypto
      .createHash("sha256")
      .update(JSON.stringify(command.params))
      .digest("hex");
    
    return `${command.toolId}:${paramsHash}`;
  }
}
```

**3. 实现死信队列和后台守护进程**

```typescript
// src/lib/ai-agent/effects/saga/dead-letter-queue.ts

export interface DLQEntry {
  transactionId: string;
  failedCompensations: Array<{
    operationId: string;
    command: CompensatingCommand;
    error: Error;
  }>;
  retryCount: number;
  maxRetries: number;
  nextRetryAt: Date;
}

export class DeadLetterQueue {
  private queue: DLQEntry[] = [];
  private sagaManager: SagaTransactionManager;

  /**
   * 入队失败补偿
   */
  async enqueue(entry: DLQEntry): Promise<void> {
    entry.nextRetryAt = new Date(Date.now() + this.calculateBackoff(entry.retryCount));
    this.queue.push(entry);
    
    // 持久化到数据库
    await this.persistDLQEntry(entry);
  }

  /**
   * 后台守护进程：定期重试失败的补偿
   */
  async startDaemon(): Promise<void> {
    setInterval(async () => {
      await this.processDLQ();
    }, 60000);  // 每分钟执行一次
  }

  private async processDLQ(): Promise<void> {
    const now = new Date();
    const readyEntries = this.queue.filter(
      entry => entry.nextRetryAt <= now && entry.retryCount < entry.maxRetries
    );

    for (const entry of readyEntries) {
      try {
        // 重试补偿
        await this.sagaManager.compensate(entry.transactionId);
        
        // 成功，从队列移除
        this.queue = this.queue.filter(e => e.transactionId !== entry.transactionId);
        await this.removeDLQEntry(entry.transactionId);
      } catch (error) {
        // 重试失败，增加重试计数
        entry.retryCount++;
        entry.nextRetryAt = new Date(
          Date.now() + this.calculateBackoff(entry.retryCount)
        );
        
        logger.warn(
          { transactionId: entry.transactionId, retryCount: entry.retryCount },
          "DLQ retry failed, will retry later"
        );
      }
    }
  }

  /**
   * 计算退避时间（指数退避）
   */
  private calculateBackoff(retryCount: number): number {
    return Math.min(Math.pow(2, retryCount) * 60000, 3600000);  // 最大 1 小时
  }
}
```

**4. 幂等性存储实现**

```typescript
// src/lib/ai-agent/effects/saga/idempotency-store.ts

export class IdempotencyStore {
  private redis: RedisClient;
  private ttl = 86400;  // 24 小时

  /**
   * 检查是否已处理
   */
  async isProcessed(key: string): Promise<boolean> {
    const result = await this.redis.get(`idempotency:${key}`);
    return result !== null;
  }

  /**
   * 标记为已处理
   */
  async markProcessed(key: string): Promise<void> {
    await this.redis.setex(`idempotency:${key}`, this.ttl, "1");
  }
}
```

#### 文件结构更新

```
src/lib/ai-agent/effects/saga/
├── saga-transaction-manager.ts   # 增强：幂等性和 DLQ 支持
├── dead-letter-queue.ts           # 死信队列
├── idempotency-store.ts          # 幂等性存储
└── daemon.ts                     # 后台守护进程
```

#### 验收标准

| 指标 | 目标值 | 验证方法 |
|------|--------|---------|
| 补偿操作幂等性 | 100% | 重复执行测试 |
| DLQ 重试成功率 | > 95% | 错误注入测试 |
| 部分失败恢复率 | > 99% | 网络故障模拟 |
| 重复撤销防护 | 100% | 并发测试 |

#### 预计工时

- 事务接口设计：2 小时
- SagaTransactionManager 实现：6 小时
- 幂等性支持实现：4 小时
- 死信队列实现：4 小时
- 后台守护进程：2 小时
- Tool 接口修改与适配：4 小时
- EffectManager 集成：3 小时
- 前端 UI 集成：3 小时
- 测试与验证：6 小时
- **总计**: 34 小时（约 5 个工作日）

---

### Phase 1 总结

| 任务 | 工时 | 依赖 | 优先级 |
|------|------|------|--------|
| 1.1 动态胶囊合成 | 16h | - | P0 |
| 1.2 多态执行引擎 | 28h | - | P0 |
| 1.3 补偿事务与回滚 | 34h | - | P1 |

**Phase 1 总工时**: 78 小时（约 10-11 个工作日）

---

## 📅 Phase 2: 极速路由与意图重构 (Speed & Precision)

**周期**: 第 3-4 周  
**目标**: 解决意图识别慢、参数提取丢失、响应卡顿

---

### 2.1 声明式意图定义 (Declarative Intent Definition)

#### 问题分析

**现状**：
- 所有请求都走 LLM，响应慢（~500ms）
- 高频指令（如 `/search`、UI 按钮点击）也走完整路由流程

**深层隐患**（架构评审发现）：
- **维护噩梦**：在代码里写死 `L0_RULES` 数组，随着功能增加，这个文件会变成几千行的 `if-else` 垃圾堆
- **知识割裂**：产品经理定义的意图，开发者得手动翻译成正则，容易出错
- **扩展困难**：新增意图需要修改代码并重新部署

**影响**：
- 用户体验差（等待时间长）
- 成本高（不必要的 LLM 调用）
- 维护成本高（硬编码规则）
- 意图定义与代码实现割裂

#### 设计方案

**核心概念：声明式意图定义 (Declarative Intent Definition)**

建立一个统一的 **Intent DSL (领域特定语言)** 或配置中心，L0、L1、L2 的规则源头统一，只是执行策略不同。

```
┌─────────────────────────────────────────────────────────────┐
│              Intent DSL Configuration Center                  │
│                                                               │
│  intents.yaml (声明式配置)                                    │
│  ├── intent: search                                          │
│  │   ├── matchers: [regex, keyword]                         │
│  │   ├── strategy: L0                                        │
│  │   └── capsule: search                                    │
│  │                                                           │
│  ├── intent: generate_report                                │
│  │   ├── matchers: [semantic]                               │
│  │   ├── strategy: L2                                       │
│  │   └── schema: {...}                                     │
│  └── ...                                                     │
│                                                               │
│  Build Time: YAML → TypeScript Code / Trie Tree              │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                    UnifiedEngine                              │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │         Intent Matcher (编译后的高效代码)              │   │
│  │                                                       │   │
│  │  - 根据 strategy 选择执行层 (L0/L1/L2)               │   │
│  │  - 统一的匹配逻辑（regex/keyword/semantic）          │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

#### 实现方案

**1. 定义 Intent DSL（YAML 配置）**

```yaml
# config/intents.yaml

intents:
  # L0 策略：高频指令，零延迟
  - id: search
    name: "搜索"
    strategy: L0  # 明确指定走 L0
    matchers:
      - type: regex
        pattern: "^/search\\s+(.+)$"
        extract:
          query: "$1"
      - type: keyword
        keywords: ["搜索", "查找", "找"]
    capsule: search
    toolId: search

  - id: count_total
    name: "统计总数"
    strategy: L0
    matchers:
      - type: regex
        pattern: "^有多少收藏$"
      - type: keyword
        keywords: ["总数", "有多少", "统计"]
    toolId: count_total

  # L1 策略：规则匹配，轻量级
  - id: list_recent
    name: "最近收藏"
    strategy: L1
    matchers:
      - type: regex
        pattern: "^最近(\\d+)条$"
        extract:
          limit: "$1"
    toolId: list_recent

  # L2 策略：LLM 路由，复杂意图
  - id: generate_report
    name: "生成报告"
    strategy: L2
    matchers:
      - type: semantic
        referenceTexts:
          - "生成周报"
          - "生成月度报告"
          - "帮我做个总结"
    schema:
      period: 
        type: enum
        values: [week, month]
        description: "报告周期"
      format:
        type: enum
        values: [markdown, html]
        description: "报告格式"
    workflowId: periodic-report
```

**2. 编译时生成 TypeScript 代码**

```typescript
// scripts/build-intents.ts

import { readFileSync } from "fs";
import { parse } from "yaml";
import { compile } from "./intent-compiler";

const intentsYaml = readFileSync("config/intents.yaml", "utf-8");
const intents = parse(intentsYaml);

// 编译为高效的 TypeScript 代码
const compiledCode = compile(intents);

// 输出到 src/lib/ai-skills/router/intents.generated.ts
writeFileSync(
  "src/lib/ai-skills/router/intents.generated.ts",
  compiledCode
);
```

**3. Intent 编译器实现**

```typescript
// scripts/intent-compiler.ts

export function compile(intents: IntentDefinition[]): string {
  const code: string[] = [];
  
  code.push("// Auto-generated from config/intents.yaml");
  code.push("// DO NOT EDIT MANUALLY");
  code.push("");
  code.push("import type { RouteResult } from './types';");
  code.push("");
  
  // 按 strategy 分组
  const l0Intents = intents.filter(i => i.strategy === "L0");
  const l1Intents = intents.filter(i => i.strategy === "L1");
  const l2Intents = intents.filter(i => i.strategy === "L2");
  
  // 生成 L0 匹配器（Trie 树或正则数组）
  code.push("export class L0IntentMatcher {");
  code.push("  match(input: string): RouteResult | null {");
  
  for (const intent of l0Intents) {
    for (const matcher of intent.matchers) {
      if (matcher.type === "regex") {
        code.push(`    if (${generateRegexCheck(matcher.pattern, intent)}) {`);
        code.push(`      return ${generateRouteResult(intent, matcher)};`);
        code.push("    }");
      } else if (matcher.type === "keyword") {
        code.push(`    if (${generateKeywordCheck(matcher.keywords, intent)}) {`);
        code.push(`      return ${generateRouteResult(intent, matcher)};`);
        code.push("    }");
      }
    }
  }
  
  code.push("    return null;");
  code.push("  }");
  code.push("}");
  
  return code.join("\n");
}

function generateRegexCheck(pattern: string, intent: IntentDefinition): string {
  const regex = pattern.replace(/\//g, "\\/");
  return `input.match(/^${regex}$/)`;
}

function generateKeywordCheck(keywords: string[], intent: IntentDefinition): string {
  const checks = keywords.map(k => `input.includes("${k}")`).join(" || ");
  return checks;
}

function generateRouteResult(intent: IntentDefinition, matcher: Matcher): string {
  return `{
    mode: "atomic",
    intent: { type: "${intent.id}", confidence: 0.95 },
    suggestedTool: "${intent.toolId}",
    suggestedParams: ${generateParamsExtractor(matcher)},
  }`;
}
```

**4. 统一的 Intent Matcher（运行时使用编译后的代码）**

```typescript
// src/lib/ai-skills/router/intent-matcher.ts

import { L0IntentMatcher } from "./intents.generated";  // 编译生成的代码
import { L1IntentMatcher } from "./intents.generated";
import { L2IntentMatcher } from "./intents.generated";

export class UnifiedIntentMatcher {
  private l0Matcher: L0IntentMatcher;
  private l1Matcher: L1IntentMatcher;
  private l2Matcher: L2IntentMatcher;

  /**
   * 匹配意图，自动选择最优策略（L0 → L1 → L2）
   */
  async match(
    input: string,
    context: EngineContext
  ): Promise<RouteResult> {
    // 1. L0 匹配（最快，零延迟）
    const l0Result = this.l0Matcher.match(input);
    if (l0Result) {
      return l0Result;
    }

    // 2. L1 匹配（规则匹配，轻量级）
    const l1Result = this.l1Matcher.match(input);
    if (l1Result) {
      return l1Result;
    }

    // 3. L2 匹配（LLM 路由，复杂意图）
    return await this.l2Matcher.match(input, context);
  }
}
```

**5. 修改 UnifiedEngine 使用统一匹配器**

```typescript
// src/lib/ai-skills/engine/unified-engine.ts

class UnifiedEngine {
  private intentMatcher: UnifiedIntentMatcher;

  async *execute(
    input: string,
    context: EngineContext
  ): AsyncGenerator<UnifiedStreamChunk> {
    // 1. 统一意图匹配（自动选择 L0/L1/L2）
    const routeResult = await this.intentMatcher.match(input, context);
    
    // 2. 根据策略执行
    if (routeResult.strategy === "L0") {
      // L0：直接执行，零延迟
      yield* this.executeAtomicDirectly(routeResult);
    } else if (routeResult.strategy === "L1") {
      // L1：规则路由
      yield* this.executeRouted(input, context, routeResult);
    } else {
      // L2：LLM 路由
      yield* this.executeRouted(input, context);
    }
  }
}
```

#### 文件结构

```
config/
└── intents.yaml                    # 声明式意图定义（DSL）

scripts/
├── build-intents.ts                # 编译脚本
└── intent-compiler.ts              # Intent 编译器

src/lib/ai-skills/router/
├── intents.generated.ts            # 编译生成的代码（自动生成，不手动编辑）
├── intent-matcher.ts               # 统一意图匹配器
└── __tests__/
    └── intent-matcher.test.ts
```

#### 验收标准

| 指标 | 目标值 | 验证方法 |
|------|--------|---------|
| L0 操作 P95 延迟 | < 50ms | 性能测试 |
| L0 规则覆盖率 | > 60% | 日志统计 |
| LLM 调用减少率 | > 40% | 成本统计 |
| 新增意图无需修改代码 | 100% | 流程验证 |
| 意图定义与实现统一 | 100% | 代码审查 |

---

### 2.1.5 L0 置信度逃逸机制 (Confidence Escape)

#### 问题分析

**潜在暗礁**（生产环境发现）：
- **误杀风险**：用户输入 `/search 如何删除书签`
  - 正则 `^/search\s+(.+)$` 会匹配
  - L0 会直接调用搜索工具，搜索关键词 "如何删除书签"
  - 但用户可能其实想问 AI："教我怎么删书签"，直接搜索可能不是最佳答案
- **过于霸道**：L0 规则优先级最高，可能拦截了需要 AI 思考的复杂问题
- **风险**：L0 规则写得太死，导致用户体验下降

#### 优化方案

**核心概念：置信度逃逸机制 (Confidence Escape)**

L0 不应是绝对的独裁者，需要增加"逃逸"机制，在特定条件下跳过 L0，强制走 L1/L2。

**逃逸策略**：

1. **长度逃逸**：如果用户输入很长（> 20 字），大概率是复杂问题，跳过 L0
2. **结果逃逸**：如果 L0 的搜索结果为空，自动升级为 L2 的 AI 问答
3. **用户选择逃逸**：L0 返回结果时，附带"Ask AI"快捷入口

#### 实现方案

**1. 在 Intent DSL 中增加逃逸规则**

```yaml
# config/intents.yaml

intents:
  - id: search
    name: "搜索"
    strategy: L0
    matchers:
      - type: regex
        pattern: "^/search\\s+(.+)$"
        extract:
          query: "$1"
    escape:
      # 长度逃逸：输入超过 20 字，跳过 L0
      maxLength: 20
      # 结果逃逸：搜索结果为空时，升级为 L2
      emptyResultUpgrade: true
      # 用户选择逃逸：显示"Ask AI"按钮
      showAskAIButton: true
    capsule: search
    toolId: search
```

**2. 修改 L0IntentMatcher 支持逃逸**

```typescript
// src/lib/ai-skills/router/intents.generated.ts (编译生成)

export class L0IntentMatcher {
  match(input: string): RouteResult | null {
    // 1. 长度逃逸检查
    if (input.length > 20) {
      logger.debug({ input, length: input.length }, "L0 escaped: input too long");
      return null;  // 跳过 L0，走 L1/L2
    }

    // 2. 尝试匹配 L0 规则
    const match = this.tryMatch(input);
    if (!match) {
      return null;
    }

    // 3. 返回结果（带逃逸标记）
    return {
      mode: "atomic",
      intent: {
        type: match.intent,
        confidence: 0.95,
      },
      suggestedTool: match.toolId,
      suggestedParams: match.params,
      escape: {
        maxLength: 20,
        emptyResultUpgrade: true,
        showAskAIButton: true,
      },
    };
  }
}
```

**3. 在 UnifiedEngine 中实现结果逃逸**

```typescript
// src/lib/ai-skills/engine/unified-engine.ts

class UnifiedEngine {
  async *execute(
    input: string,
    context: EngineContext
  ): AsyncGenerator<UnifiedStreamChunk> {
    // 1. L0 匹配
    const l0Result = this.intentMatcher.match(input);
    
    if (l0Result && l0Result.escape) {
      // 2. 执行 L0 操作
      const toolResult = await this.executeAtomicDirectly(l0Result);
      
      // 3. 检查结果逃逸条件
      if (l0Result.escape.emptyResultUpgrade && this.isEmptyResult(toolResult)) {
        // 结果为空，升级为 L2
        logger.debug({ input }, "L0 result empty, upgrading to L2");
        yield {
          type: "text",
          data: {
            text: "未找到相关结果。让我用 AI 帮您分析一下...",
            showAskAIButton: true,  // 显示"Ask AI"按钮
          },
        };
        
        // 继续走 L2 路由
        yield* this.executeRouted(input, context);
        return;
      }
      
      // 4. 返回 L0 结果（带"Ask AI"按钮）
      yield {
        type: "text",
        data: {
          text: this.formatToolResult(toolResult),
          showAskAIButton: l0Result.escape.showAskAIButton,
        },
      };
      return;
    }

    // 5. 继续正常路由流程...
    yield* this.executeRouted(input, context);
  }

  private isEmptyResult(result: unknown): boolean {
    if (Array.isArray(result)) {
      return result.length === 0;
    }
    if (typeof result === "object" && result !== null) {
      return Object.keys(result).length === 0;
    }
    return false;
  }
}
```

**4. 前端集成（"Ask AI"按钮）**

```typescript
// src/components/ai/search-result-with-ai.tsx

export function SearchResultWithAI({
  results,
  query,
  showAskAIButton,
}: {
  results: SearchResult[];
  query: string;
  showAskAIButton?: boolean;
}) {
  const handleAskAI = async () => {
    // 用户点击"Ask AI"，发送到 L2 路由
    await fetch("/api/agent/unified", {
      method: "POST",
      body: JSON.stringify({
        message: query,
        forceMode: "orchestration",  // 强制走编排模式
      }),
    });
  };

  return (
    <div>
      {results.length === 0 ? (
        <EmptyState>
          <p>未找到相关结果</p>
          {showAskAIButton && (
            <Button onClick={handleAskAI}>
              🤖 让 AI 帮您分析
            </Button>
          )}
        </EmptyState>
      ) : (
        <>
          <SearchResultList results={results} />
          {showAskAIButton && (
            <Button variant="outline" onClick={handleAskAI}>
              🤖 用 AI 进一步分析
            </Button>
          )}
        </>
      )}
    </div>
  );
}
```

**5. 监控埋点（L0 命中率和撤销率）**

```typescript
// src/lib/ai-skills/router/intent-matcher.ts

export class UnifiedIntentMatcher {
  async match(
    input: string,
    context: EngineContext
  ): Promise<RouteResult> {
    // L0 匹配
    const l0Result = this.l0Matcher.match(input);
    
    if (l0Result) {
      // 埋点：L0 命中
      analytics.track("l0_hit", {
        userId: context.userId,
        input,
        intent: l0Result.intent.type,
      });
    }

    return l0Result || /* ... */;
  }
}

// 前端：用户点击"Ask AI"时埋点
analytics.track("l0_escape", {
  userId,
  originalQuery: query,
  reason: "user_clicked_ask_ai",
});
```

#### 文件结构更新

```
config/
└── intents.yaml                    # 增加 escape 配置

src/lib/ai-skills/router/
├── intents.generated.ts            # 编译生成：支持逃逸检查
└── escape/
    ├── escape-checker.ts           # 逃逸检查器
    └── escape-analytics.ts         # 逃逸分析埋点
```

#### 验收标准

| 指标 | 目标值 | 验证方法 |
|------|--------|---------|
| L0 误杀率 | < 5% | 用户反馈统计 |
| L0 撤销率（用户点击 Ask AI） | < 10% | 埋点统计 |
| 长度逃逸准确率 | > 90% | A/B 测试 |
| 结果逃逸触发率 | > 80%（当结果为空时） | 日志统计 |

#### 预计工时

- Intent DSL 设计：4 小时
- Intent 编译器实现：6 小时
- 统一匹配器实现：3 小时
- L0 逃逸机制实现：4 小时
- 前端集成（Ask AI 按钮）：2 小时
- 监控埋点：2 小时
- UnifiedEngine 集成：2 小时
- 测试与验证：4 小时
- **总计**: 27 小时（约 4 个工作日）

---

### 2.2 交互式槽位填充 (Interactive Slot Filling)

#### 问题分析

**现状**：
- 意图分类与参数提取混在一起
- 工作流因参数缺失导致运行失败（~15%）

**深层隐患**（架构评审发现）：
- **歧义困境**：如果用户说"生成报告"，Schema 要求 `period`。Phase 2 发现用户没给 `period`。此时 LLM 会瞎填（幻觉）或者报错
- **僵硬**：用户无法在对话中补充信息
- **线性流程**：Match → Fill 是单向管道，无法处理参数缺失

**影响**：
- 复杂工作流成功率低
- 参数提取不准确
- 用户体验差（无法追问补充信息）

#### 设计方案

**核心概念：交互式槽位状态机 (Interactive Slot Filling State Machine)**

Phase 2 不应该只是一个"填充器"，而是一个**"状态机"**，支持参数缺失时的追问和上下文恢复。

```
┌─────────────────────────────────────────────────────────────┐
│            Interactive Slot Filling State Machine            │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Phase 1: Intent Matching                │   │
│  │  Input: "帮我生成周报"                                │   │
│  │  Output: { intent: "workflow", workflowId: "..." }   │   │
│  └─────────────────────────────────────────────────────┘   │
│                      │                                        │
│                      ▼                                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │         Phase 2: Interactive Slot Filling            │   │
│  │                                                       │   │
│  │  1. 加载 Schema                                       │   │
│  │  2. 尝试提取参数                                      │   │
│  │  3. 验证完备性 (schema.safeParse())                  │   │
│  │                                                       │   │
│  │  ┌───────────────────────────────────────────────┐  │   │
│  │  │  状态: ClarificationRequired                   │  │   │
│  │  │  返回: "请问您是想生成周报还是月报？"            │  │   │
│  │  └───────────────────────────────────────────────┘  │   │
│  │                      │                                │   │
│  │                      ▼ (用户回复)                    │   │
│  │  ┌───────────────────────────────────────────────┐  │   │
│  │  │  恢复上下文，继续填充                          │  │   │
│  │  │  状态: Filling → Complete                      │  │   │
│  │  └───────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

#### 实现方案

**1. 定义 Schema 系统**

```typescript
// src/lib/ai-skills/router/schema/types.ts

import { z } from "zod";

export interface IntentSchema {
  intentType: IntentType;
  schema: z.ZodObject<any>;        // Zod Schema
  description: string;              // Schema 描述（用于 LLM Prompt）
  examples: Array<{
    input: string;
    output: Record<string, unknown>;
  }>;
}

// 示例：工作流 Schema
export const WORKFLOW_SCHEMAS: Record<string, IntentSchema> = {
  "periodic-report": {
    intentType: "workflow",
    schema: z.object({
      period: z.enum(["week", "month"]).describe("报告周期"),
      format: z.enum(["markdown", "html"]).describe("报告格式"),
      includeStats: z.boolean().optional().describe("是否包含统计"),
    }),
    description: "周期报告工作流参数",
    examples: [
      {
        input: "帮我生成周报",
        output: { period: "week", format: "markdown" },
      },
      {
        input: "生成月度报告，要 HTML 格式",
        output: { period: "month", format: "html" },
      },
    ],
  },
  // ... 更多 Schema
};
```

**2. 实现交互式槽位状态机**

```typescript
// src/lib/ai-skills/router/interactive-slot-filling.ts

/**
 * 槽位填充状态
 */
export type SlotFillingState =
  | "matching"              // 意图匹配中
  | "filling"                // 参数填充中
  | "clarification_required" // 需要澄清
  | "complete"               // 完成
  | "failed";                // 失败

/**
 * 槽位填充上下文（支持状态恢复）
 */
export interface SlotFillingContext {
  state: SlotFillingState;
  intentType: IntentType;
  targetId: string;          // workflowId 或 skillId
  schema: IntentSchema;
  extractedParams: Record<string, unknown>;  // 已提取的参数
  missingSlots: string[];    // 缺失的槽位
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }>;
  clarificationQuestion?: string;  // 澄清问题
}

export class InteractiveSlotFillingStateMachine {
  private schemaRegistry: SchemaRegistry;
  private contextStore: Map<string, SlotFillingContext> = new Map();

  /**
   * 处理用户输入（支持状态恢复）
   */
  async process(
    input: string,
    context: EngineContext,
    sessionId?: string  // 会话 ID，用于恢复上下文
  ): Promise<SlotFillingResult> {
    // 1. 恢复或创建上下文
    let fillingContext = sessionId
      ? this.contextStore.get(sessionId)
      : null;

    if (!fillingContext) {
      // 新会话：Phase 1 意图匹配
      const intentResult = await this.matchIntent(input, context);
      if (!intentResult) {
        return { type: "fallback", reason: "Intent not matched" };
      }

      // 加载 Schema
      const schema = this.schemaRegistry.getSchema(
        intentResult.intentType,
        intentResult.targetId
      );

      if (!schema) {
        return { type: "fallback", reason: "Schema not found" };
      }

      fillingContext = {
        state: "filling",
        intentType: intentResult.intentType,
        targetId: intentResult.targetId,
        schema,
        extractedParams: {},
        missingSlots: [],
        conversationHistory: [{ role: "user", content: input }],
      };

      if (sessionId) {
        this.contextStore.set(sessionId, fillingContext);
      }
    } else {
      // 恢复会话：添加用户回复到历史
      fillingContext.conversationHistory.push({
        role: "user",
        content: input,
      });
    }

    // 2. 尝试填充参数
    const fillResult = await this.fillSlots(fillingContext);

    // 3. 验证参数完备性
    const validationResult = this.validateCompleteness(
      fillResult.params,
      fillingContext.schema
    );

    if (validationResult.isComplete) {
      // 参数完备，完成
      fillingContext.state = "complete";
      if (sessionId) {
        this.contextStore.delete(sessionId);  // 清理上下文
      }
      return {
        type: "complete",
        params: validationResult.params,
        intentType: fillingContext.intentType,
        targetId: fillingContext.targetId,
      };
    } else {
      // 参数缺失，需要澄清
      fillingContext.state = "clarification_required";
      fillingContext.missingSlots = validationResult.missingSlots;
      fillingContext.clarificationQuestion = this.generateClarificationQuestion(
        validationResult.missingSlots,
        fillingContext.schema
      );

      if (sessionId) {
        this.contextStore.set(sessionId, fillingContext);
      }

      return {
        type: "clarification_required",
        question: fillingContext.clarificationQuestion!,
        missingSlots: validationResult.missingSlots,
        sessionId: sessionId || this.generateSessionId(),
      };
    }
  }

  /**
   * 填充槽位
   */
  private async fillSlots(
    context: SlotFillingContext
  ): Promise<{ params: Record<string, unknown> }> {
    // 使用 LLM 提取参数（考虑对话历史）
    const prompt = this.buildSlotFillingPrompt(context);
    
    const response = await llmClient.chat({
      model: "deepseek-chat",
      messages: [
        {
          role: "system",
          content: prompt,
        },
        ...context.conversationHistory.map(msg => ({
          role: msg.role,
          content: msg.content,
        })),
      ],
      response_format: { type: "json_object" },
    });

    const params = JSON.parse(response.content);
    
    // 合并已提取的参数
    return {
      params: {
        ...context.extractedParams,
        ...params,
      },
    };
  }

  /**
   * 验证参数完备性
   */
  private validateCompleteness(
    params: Record<string, unknown>,
    schema: IntentSchema
  ): { isComplete: boolean; params?: Record<string, unknown>; missingSlots: string[] } {
    const result = schema.schema.safeParse(params);
    
    if (result.success) {
      return {
        isComplete: true,
        params: result.data,
        missingSlots: [],
      };
    } else {
      // 提取缺失的字段
      const missingSlots = result.error.errors
        .filter(e => e.code === "invalid_type" && e.received === "undefined")
        .map(e => e.path.join("."));

      return {
        isComplete: false,
        missingSlots,
      };
    }
  }

  /**
   * 生成澄清问题
   */
  private generateClarificationQuestion(
    missingSlots: string[],
    schema: IntentSchema
  ): string {
    // 根据缺失的槽位生成友好的澄清问题
    if (missingSlots.length === 1) {
      const slot = missingSlots[0];
      const field = schema.schema.shape[slot];
      if (field && "options" in field._def) {
        // 枚举类型，提供选项
        const options = field._def.values;
        return `请问您是想${options.map((o: string) => `"${o}"`).join("还是")}？`;
      }
      return `请问${schema.description}中的"${slot}"是什么？`;
    } else {
      return `为了完成操作，我还需要以下信息：${missingSlots.join("、")}。请告诉我这些信息。`;
    }
  }
}
```

// Phase 1: 轻量级匹配器
class Phase1Matcher {
  async match(
    input: string,
    context: EngineContext
  ): Promise<Phase1Result | null> {
    // 1. 规则匹配（最快）
    const ruleMatch = this.tryRuleMatch(input);
    if (ruleMatch) return ruleMatch;

    // 2. 轻量级 LLM 分类（仅判断意图类型）
    const llmMatch = await this.tryLLMMatch(input);
    return llmMatch;
  }

  private async tryLLMMatch(input: string): Promise<Phase1Result | null> {
    // 使用小模型（fast tier）仅做意图分类
    const response = await llmClient.chat({
      model: "deepseek-chat",  // fast tier
      messages: [
        {
          role: "system",
          content: "你是一个意图分类器。仅返回意图类型，不要提取参数。",
        },
        {
          role: "user",
          content: input,
        },
      ],
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.content);
    return {
      intentType: result.intent,
      targetId: result.targetId,  // workflowId 或 skillId
      requiresParams: result.requiresParams,
      confidence: result.confidence,
    };
  }
}

// Phase 2: Schema 填充器
class Phase2Filler {
  async fill(
    input: string,
    schema: IntentSchema,
    context: EngineContext
  ): Promise<Record<string, unknown>> {
    // 使用标准模型（standard tier）进行精准参数提取
    const prompt = this.buildSlotFillingPrompt(input, schema);
    
    const response = await llmClient.chat({
      model: "deepseek-chat",  // standard tier
      messages: [
        {
          role: "system",
          content: prompt,
        },
        {
          role: "user",
          content: input,
        },
      ],
      response_format: { type: "json_object" },
    });

    const params = JSON.parse(response.content);
    
    // Zod 验证
    const validated = schema.schema.parse(params);
    return validated;
  }

  private buildSlotFillingPrompt(
    input: string,
    schema: IntentSchema
  ): string {
    return `
你是一个参数提取器。根据用户输入和 Schema 定义，提取参数。

Schema 定义：
${JSON.stringify(schema.schema._def, null, 2)}

Schema 描述：
${schema.description}

示例：
${schema.examples.map(e => `输入: ${e.input}\n输出: ${JSON.stringify(e.output)}`).join("\n\n")}

用户输入: ${input}

请返回 JSON 格式的参数。
`;
  }
}
```

**3. 修改 IntentRouter 使用交互式槽位填充**

```typescript
// src/lib/ai-skills/router/intent-router.ts

class IntentRouter {
  private slotFillingStateMachine: InteractiveSlotFillingStateMachine;

  async route(
    request: UserRequest,
    sessionId?: string  // 会话 ID，用于状态恢复
  ): Promise<RouteResult> {
    // 使用交互式槽位填充状态机
    const result = await this.slotFillingStateMachine.process(
      request.message,
      request.context,
      sessionId
    );

    if (result.type === "complete") {
      // 参数完备，返回路由结果
      return {
        mode: "workflow",  // 或 "orchestration"
        intent: {
          type: result.intentType,
          confidence: 0.95,
        },
        workflowId: result.targetId,
        params: result.params,
      };
    } else if (result.type === "clarification_required") {
      // 需要澄清，返回特殊状态
      return {
        mode: "clarification",
        clarification: {
          question: result.question,
          missingSlots: result.missingSlots,
          sessionId: result.sessionId,
        },
      };
    } else {
      // 回退到传统路由
      return this.fallbackRoute(request.message, request.context);
    }
  }
}
```

**4. 前端集成（支持追问）**

```typescript
// src/components/ai/clarification-dialog.tsx

export function ClarificationDialog({
  question,
  missingSlots,
  sessionId,
  onAnswer,
}: {
  question: string;
  missingSlots: string[];
  sessionId: string;
  onAnswer: (answer: string) => void;
}) {
  return (
    <Dialog>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>需要更多信息</DialogTitle>
        </DialogHeader>
        <p>{question}</p>
        <Input
          placeholder="请输入..."
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onAnswer(e.currentTarget.value);
            }
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

// 使用示例
const handleUserInput = async (input: string) => {
  const result = await fetch("/api/agent/unified", {
    method: "POST",
    body: JSON.stringify({
      message: input,
      sessionId: currentSessionId,  // 传递会话 ID
    }),
  });

  const routeResult = await result.json();

  if (routeResult.mode === "clarification") {
    // 显示澄清对话框
    setClarificationDialog({
      question: routeResult.clarification.question,
      sessionId: routeResult.clarification.sessionId,
    });
  }
};
```

#### 文件结构

```
src/lib/ai-skills/router/
├── two-phase-router.ts            # 两阶段路由器
├── phase1-matcher.ts              # Phase 1 匹配器
├── phase2-filler.ts               # Phase 2 填充器
├── schema/
│   ├── types.ts                   # Schema 类型定义
│   ├── schema-registry.ts         # Schema 注册表
│   └── workflow-schemas.ts         # 工作流 Schema 定义
└── __tests__/
    ├── two-phase-router.test.ts
    └── phase2-filler.test.ts
```

#### 验收标准

| 指标 | 目标值 | 验证方法 |
|------|--------|---------|
| 工作流参数提取成功率 | > 98% | 集成测试 |
| Phase 1 匹配耗时 | < 200ms | 性能测试 |
| Phase 2 填充耗时 | < 600ms | 性能测试 |

#### 预计工时

- Schema 系统设计：4 小时
- TwoPhaseRouter 实现：6 小时
- Phase1Matcher 实现：4 小时
- Phase2Filler 实现：6 小时
- IntentRouter 集成：2 小时
- 测试与验证：4 小时
- **总计**: 26 小时（约 4 个工作日）

---

### 2.3 语义缓存与推测执行 (Caching & Speculative)

#### 问题分析

**现状**：
- 重复问题重复算
- 用户等待时间长

**影响**：
- 成本高（重复 LLM 调用）
- 用户体验差

#### 设计方案

**核心概念：Semantic Cache + Optimistic UI**

- **后端**: pgvector + Redis 实现语义缓存
- **前端**: Optimistic UI（AI 思考时先显示预搜索结果）

#### 实现方案

**1. 语义缓存实现**

```typescript
// src/lib/ai-skills/cache/semantic-cache.ts

export class SemanticCache {
  private vectorStore: VectorStore;  // pgvector
  private redisCache: RedisCache;     // Redis

  async get(input: string): Promise<CachedResult | null> {
    // 1. Redis 快速查找（精确匹配）
    const exactMatch = await this.redisCache.get(input);
    if (exactMatch) return exactMatch;

    // 2. 向量相似度查找（语义匹配）
    const similar = await this.vectorStore.findSimilar(input, {
      threshold: 0.85,  // 相似度阈值
      limit: 1,
    });

    if (similar.length > 0) {
      return similar[0].result;
    }

    return null;
  }

  async set(input: string, result: RouteResult): Promise<void> {
    // 1. 存储到 Redis（精确匹配）
    await this.redisCache.set(input, result, { ttl: 3600 });

    // 2. 存储到向量数据库（语义匹配）
    await this.vectorStore.upsert({
      id: `cache-${Date.now()}`,
      text: input,
      embedding: await this.generateEmbedding(input),
      metadata: { result },
    });
  }
}
```

**2. 前端 Optimistic UI**

```typescript
// src/components/ai/optimistic-search.tsx

export function OptimisticSearch({ query }: { query: string }) {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 1. 立即显示关键词匹配结果（乐观 UI）
    const keywordResults = performKeywordSearch(query);
    setResults(keywordResults);

    // 2. 异步等待 AI 意图确认
    fetch("/api/agent/unified", {
      method: "POST",
      body: JSON.stringify({ message: query }),
    }).then(async (response) => {
      const aiResults = await parseAIResponse(response);
      
      // 3. 无感刷新（仅更新差异部分）
      setResults(mergeResults(keywordResults, aiResults));
      setIsLoading(false);
    });
  }, [query]);

  return (
    <div>
      {results.map(result => (
        <SearchResultCard key={result.id} result={result} />
      ))}
      {isLoading && <LoadingIndicator />}
    </div>
  );
}
```

#### 文件结构

```
src/lib/ai-skills/cache/
├── semantic-cache.ts              # 语义缓存主类
├── vector-store.ts                # pgvector 封装
├── redis-cache.ts                  # Redis 封装
└── __tests__/
    └── semantic-cache.test.ts
```

#### 验收标准

| 指标 | 目标值 | 验证方法 |
|------|--------|---------|
| 重复意图响应时间 | < 20ms | 性能测试 |
| 缓存命中率 | > 30% | 日志统计 |
| 前端预搜索结果准确率 | > 70% | A/B 测试 |

#### 预计工时

- 语义缓存实现：6 小时
- 向量存储集成：4 小时
- Redis 缓存集成：2 小时
- 前端 Optimistic UI：4 小时
- 测试与验证：4 小时
- **总计**: 20 小时（约 3 个工作日）

---

### Phase 2 总结

| 任务 | 工时 | 依赖 | 优先级 |
|------|------|------|--------|
| 2.1 声明式意图定义 | 27h | - | P0 |
| 2.2 交互式槽位填充 | 32h | - | P0 |
| 2.3 语义缓存与推测执行 | 20h | - | P1 |

**Phase 2 总工时**: 79 小时（约 10-11 个工作日）

---

## 📅 Phase 3: 工作流闭环与可观测性 (Reliability)

**周期**: 第 5-6 周  
**目标**: 解决异步任务黑盒、触发器逻辑不一致、长任务超时

---

### 3.1 统一入口层 (Unified Entry Point)

#### 问题分析

**现状**：
- 定时任务直接调用执行器，绕过安全检查
- 用户审计日志不完整

#### 设计方案

**核心概念：Virtual Request（虚拟请求）**

定时任务构造虚拟请求，注入 UnifiedEngine，享受完整的安全检查和日志记录。

#### 实现方案

```typescript
// src/lib/workflow/triggers/trigger-scheduler.ts

class TriggerScheduler {
  private unifiedEngine: UnifiedEngine;

  async triggerScheduledWorkflow(workflowId: string, userId: string) {
    // 构造虚拟请求
    const virtualRequest: VirtualRequest = {
      message: `执行工作流: ${workflowId}`,
      context: {
        userId,
        conversationId: `scheduled-${workflowId}-${Date.now()}`,
        triggerType: "schedule",
        triggerContext: {
          workflowId,
          scheduledAt: new Date(),
        },
      },
      metadata: {
        isVirtual: true,
        source: "trigger_scheduler",
      },
    };

    // 注入 UnifiedEngine（享受完整流程）
    for await (const chunk of this.unifiedEngine.execute(
      virtualRequest.message,
      virtualRequest.context
    )) {
      // 处理响应...
    }
  }
}
```

#### 预计工时

- Virtual Request 设计：2 小时
- TriggerScheduler 重构：4 小时
- 测试与验证：2 小时
- **总计**: 8 小时（约 1 个工作日）

---

### 3.2 实时反馈管道 (Live Feedback Pipeline)

#### 问题分析

**现状**：
- 长任务前端转圈，不知道进度
- 无法取消正在执行的任务

#### 设计方案

**核心概念：EventBus + SSE**

后端实现 EventBus（基于 Redis Pub/Sub），前端接入 SSE，实时推送任务进度。

#### 实现方案

```typescript
// src/lib/ai-skills/feedback/event-bus.ts

export class EventBus {
  private redis: RedisClient;

  async publish(event: ExecutionEvent): Promise<void> {
    await this.redis.publish(
      `execution:${event.executionId}`,
      JSON.stringify(event)
    );
  }

  subscribe(executionId: string, callback: (event: ExecutionEvent) => void) {
    this.redis.subscribe(`execution:${executionId}`, (message) => {
      const event = JSON.parse(message) as ExecutionEvent;
      callback(event);
    });
  }
}

// src/app/api/agent/stream/route.ts

export async function GET(request: Request) {
  const { executionId } = await request.json();

  const stream = new ReadableStream({
    async start(controller) {
      const eventBus = new EventBus();
      
      eventBus.subscribe(executionId, (event) => {
        controller.enqueue(
          `data: ${JSON.stringify(event)}\n\n`
        );
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
    },
  });
}
```

#### 预计工时

- EventBus 实现：4 小时
- SSE 端点实现：3 小时
- 前端集成：3 小时
- 测试与验证：2 小时
- **总计**: 12 小时（约 2 个工作日）

---

### Phase 3 总结

| 任务 | 工时 | 依赖 | 优先级 |
|------|------|------|--------|
| 3.1 统一入口层 | 8h | Phase 1 | P1 |
| 3.2 实时反馈管道 | 12h | Phase 1 | P1 |

**Phase 3 总工时**: 20 小时（约 3 个工作日）

---

## 📊 总体时间线

```
Week 1-2: Phase 1 (瘦身与治理)
├── Week 1: 工具胶囊化 + DAG 引擎设计
└── Week 2: DAG 引擎实现 + 事务与回滚

Week 3-4: Phase 2 (极速路由)
├── Week 3: L0 规则直通车 + 两阶段路由设计
└── Week 4: 两阶段路由实现 + 语义缓存

Week 5-6: Phase 3 (可观测性)
├── Week 5: 统一入口层 + 实时反馈管道
└── Week 6: 测试与优化

Week 7-8: 缓冲 + 回归测试
├── 处理遗留问题
├── 全量回归测试
└── 发布准备
```

**总工时**: 177 小时（约 22-23 个工作日，6-8 周）

---

## 🛡️ 架构师的"军规" (Technical Constitution)

为防止系统再次腐化，严格执行以下**5 条铁律**：

1. **No Raw Text Output**: 除去闲聊模式，AI 的所有输出必须是 **Structured JSON** (通过 Zod Schema 约束)

2. **Schema First**: 新增任何 Workflow，必须先定义 Input Schema，否则禁止上线

3. **Capsule Isolation**: 任何 LLM 调用，单次加载工具不得超过 **15 个**

4. **Async by Default**: 耗时超过 500ms 的操作，必须返回 `Job ID` 走异步通知，禁止 HTTP 长连接等待

5. **Reversible**: 任何涉及数据修改的 Action，必须有对应的 Undo 逻辑

---

## 📈 成功验收指标

| **维度** | **指标** | **当前值** | **目标值 (v4.0)** |
|---------|---------|-----------|------------------|
| **性能** | L0/L1 操作响应延迟 (P95) | ~500ms | **< 100ms** |
| **性能** | L2 复杂意图路由耗时 | ~2000ms | **< 800ms** |
| **质量** | 工作流参数提取成功率 | ~85% | **> 98%** |
| **成本** | 单次交互 Token 消耗 | 基准 | **下降 40%** |
| **稳定** | 异步任务进度丢失率 | ~5% | **0%** |

---

## 🔗 相关文档

- [AI 架构演进战略路线图](../AI 架构演进战略路线图 (v4.0 Strategy)0112.md)
- [AI 架构优化执行计划](./AI_ARCHITECTURE_OPTIMIZATION_PLAN.md)
- [Workflow 系统架构](../architecture/workflow-system.md)

---

## ⚖️ 架构复杂度评估：完整版 vs 简化版

> **评估日期**: 2026-01-12  
> **评估结论**: ⚠️ **对于轻量化个人 AI 应用，完整版可能过度设计**

### 现实检查

**AnyKeep 的实际情况**：
- 5人小团队
- MVP 验证期（10-20 用户）
- 资源有限，需要快速迭代
- 技术债务容忍度较高

**完整版架构的假设**：
- 企业级团队
- 大规模并发场景
- 充足资源，长期规划
- 追求完美架构

**复杂度差距**: 2-3 个层级

### 简化版实施路径（推荐）

> **详细评估**: 参见 [架构复杂度评估文档](./AI_ARCHITECTURE_V4_OPTIMIZATION_DESIGN_CRITIQUE.md)

**核心原则**：
- **YAGNI**: 不要实现未来可能需要的功能
- **KISS**: 选择最简单的可行方案
- **渐进式增强**: 先实现基础版本，需要时再优化

**简化版 Phase 1（推荐）**：

| 任务 | 完整版 | **简化版** | 节省 |
|------|--------|-----------|------|
| 1.1 胶囊化 | 动态合成 + 预加载 | **静态映射** | -8h |
| 1.2 执行引擎 | 3种原语 | **Direct + DAG** | -12h |
| 1.3 事务回滚 | Saga + DLQ | **简单撤销栈** | -20h |
| 2.1 意图定义 | DSL + 编译器 | **YAML → 简单生成** | -6h |
| 2.2 槽位填充 | 交互式状态机 | **参数缺失报错** | -20h |
| 2.3 语义缓存 | 向量相似度 | **仅精确匹配** | -8h |

**简化版总工时**: 74 小时（约 10 个工作日）  
**完整版总工时**: 177 小时（约 22-23 个工作日）  
**节省**: 103 小时（58%）

**何时升级到完整版**：
- 用户量 > 1000
- 并发请求 > 100 QPS
- 工作流使用频率 > 10%
- 批量操作频率 > 5%

---

## ✅ 最终批准意见与执行建议

> **评审人**: 首席架构师  
> **评审日期**: 2026-01-12  
> **结论**: ✅ **批准执行（建议采用简化版）**

### 批准意见

这份文档逻辑闭环、风险可控、收益明确。所有深层优化建议和生产环境优化建议已全部纳入设计，架构的"有机性"和长期可维护性得到保障。

### 执行建议

#### 1. Phase 1 先行（优先级最高）

**胶囊化和多态引擎是地基，必须打牢。**

- ✅ **1.1 动态胶囊合成**：先实现基础版本，再优化预加载
- ✅ **1.2 多态执行引擎**：这是架构的核心，必须优先完成
- ⚠️ **1.3 补偿事务**：可以先实现基础版本，幂等性和 DLQ 可以 Phase 2 补充

**建议顺序**：
1. Week 1-2: 1.1 + 1.2 基础版本
2. Week 3: 1.3 基础版本
3. Week 4: 1.1.5 预加载优化 + 1.3.5 幂等性优化

#### 2. Schema 为王（测试驱动）

**请架构组先定义出核心的 10 个 Workflow Schema，作为 InteractiveSlotFilling 的测试集。**

**核心 Schema 清单**：

| Schema ID | 工作流名称 | 复杂度 | 优先级 |
|-----------|-----------|--------|--------|
| `periodic-report` | 周期报告 | 中 | P0 |
| `bookmark-health` | 书签健康检查 | 中 | P0 |
| `daily-digest` | 每日摘要 | 低 | P0 |
| `duplicate-cleanup` | 重复清理 | 高 | P1 |
| `batch-organize` | 批量整理 | 高 | P1 |
| `folder-cleanup` | 文件夹清理 | 中 | P1 |
| `topic-deep-dive` | 主题深挖 | 高 | P2 |
| `share-bundle` | 分享包 | 低 | P2 |
| `learning-path` | 学习路径 | 高 | P2 |
| `thematic-synthesis` | 主题合成 | 高 | P2 |

**Schema 定义模板**：

```yaml
# config/workflow-schemas.yaml

schemas:
  - id: periodic-report
    name: "周期报告"
    description: "生成周期性的收藏活动报告"
    schema:
      period:
        type: enum
        values: [week, month]
        required: true
        description: "报告周期"
      format:
        type: enum
        values: [markdown, html]
        required: false
        default: markdown
        description: "报告格式"
      includeStats:
        type: boolean
        required: false
        default: true
        description: "是否包含统计信息"
    examples:
      - input: "帮我生成周报"
        output: { period: "week", format: "markdown", includeStats: true }
      - input: "生成月度报告，要 HTML 格式"
        output: { period: "month", format: "html", includeStats: true }
```

#### 3. 监控跟上（数据驱动）

**在上线 L0 规则时，务必埋点统计"L0 命中率"和"L0 撤销率"，以防止 L0 规则写得太死。**

**关键指标**：

| 指标 | 目标值 | 监控频率 | 告警阈值 |
|------|--------|---------|---------|
| L0 命中率 | 60-70% | 实时 | < 50% 或 > 80% |
| L0 撤销率 | < 10% | 实时 | > 15% |
| L0 误杀率 | < 5% | 每日 | > 8% |
| L0 平均响应时间 | < 50ms | 实时 | > 100ms |

**监控 Dashboard**：

```typescript
// src/lib/analytics/l0-metrics.ts

export interface L0Metrics {
  hitRate: number;           // 命中率
  escapeRate: number;        // 逃逸率（用户点击 Ask AI）
  falsePositiveRate: number; // 误杀率（用户反馈）
  avgResponseTime: number;   // 平均响应时间
  totalRequests: number;     // 总请求数
}

export class L0MetricsCollector {
  async collectMetrics(timeRange: TimeRange): Promise<L0Metrics> {
    // 从数据库/日志收集指标
    // ...
  }
}
```

**告警规则**：

- **L0 撤销率 > 15%**：说明 L0 规则过于激进，需要调整
- **L0 命中率 < 50%**：说明 L0 规则覆盖不足，需要补充
- **L0 误杀率 > 8%**：说明 L0 规则误判严重，需要优化逃逸机制

#### 4. 风险控制

**渐进式上线策略**：

1. **灰度发布**：先对 10% 用户开放新架构
2. **A/B 测试**：对比新旧架构的性能和准确率
3. **回滚预案**：保留旧架构代码，支持快速回滚
4. **监控告警**：关键指标异常时自动告警

**质量门禁**：

- ✅ 所有单元测试通过（> 95% 覆盖率）
- ✅ 集成测试通过（核心流程 100% 覆盖）
- ✅ 性能测试通过（P95 延迟 < 目标值）
- ✅ 代码审查通过（至少 2 人审查）

---

**备注**: 本设计文档将根据实施过程中的实际情况进行调整和优化。所有优化建议已全部接受并纳入设计，确保架构的"有机性"和长期可维护性。
