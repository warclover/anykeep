# AnyKeep V4.2 性能瓶颈根因分析方案

> 基于代码深度分析制定
> 状态：待执行
> 创建日期：2025-12-12

---

## 一、问题定位总览

通过代码分析，已定位到以下**核心性能瓶颈**：

```
性能瓶颈热力图：

/api/classification/inbox  [11-22s] ████████████████████ 最严重
├── inbox-organizer.service.ts
│   ├── clusterBookmarks()      [1-5s]  聚类计算
│   └── matchClusterToFolder()  [N×50ms] N+1 查询 ⚠️
├── classification.service.ts
│   └── 匹配器顺序执行           [300-500ms]
└── 无持久化缓存                  [每次重算]

/api/bookmarks             [5.2s / 815KB]
├── count: "exact"          [200-500ms] 全表扫描
├── SELECT *                [过度获取]
└── 无分页                  [一次性加载]

/api/folders               [4.9-6.2s]
├── 树结构递归查询           [复杂度高]
└── 无缓存                  [重复查询]

/api/folders/[id]/lock     [2-7s × 8次]
└── 串行请求                [应批量化]
```

---

## 二、根因诊断实施计划

### Phase 0: 性能监控基线建立 (Day 0.5)

#### 0.1 添加 API 性能埋点

**目标**：量化每个阶段的耗时，建立基线数据

**实施步骤**：

```typescript
// 1. 创建性能监控工具
// src/lib/utils/performance-monitor.ts

export interface PerformanceMetric {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata?: Record<string, unknown>;
}

export class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private requestId: string;

  constructor(requestId?: string) {
    this.requestId = requestId || crypto.randomUUID();
  }

  mark(name: string, metadata?: Record<string, unknown>): () => void {
    const metric: PerformanceMetric = {
      name,
      startTime: performance.now(),
      metadata,
    };
    this.metrics.push(metric);

    return () => {
      metric.endTime = performance.now();
      metric.duration = metric.endTime - metric.startTime;
    };
  }

  getReport(): {
    requestId: string;
    totalDuration: number;
    breakdown: PerformanceMetric[];
  } {
    const totalDuration = this.metrics.reduce(
      (sum, m) => sum + (m.duration || 0),
      0,
    );
    return {
      requestId: this.requestId,
      totalDuration,
      breakdown: this.metrics,
    };
  }

  log(): void {
    const report = this.getReport();
    console.log(`[PERF] Request ${report.requestId}`);
    console.log(`[PERF] Total: ${report.totalDuration.toFixed(2)}ms`);
    report.breakdown.forEach((m) => {
      console.log(`[PERF]   ${m.name}: ${m.duration?.toFixed(2)}ms`);
    });
  }
}
```

#### 0.2 埋点位置清单

| 文件                                                         | 埋点位置    | 监控内容   |
| ------------------------------------------------------------ | ----------- | ---------- |
| `src/app/api/classification/inbox/route.ts`                  | GET handler | 总响应时间 |
| `src/lib/classification/services/inbox-organizer.service.ts` | analyze()   | 各阶段耗时 |
| `src/lib/classification/services/classification.service.ts`  | classify()  | 匹配器耗时 |
| `src/app/api/bookmarks/route.ts`                             | GET handler | 查询耗时   |
| `src/app/api/folders/route.ts`                               | GET handler | 查询耗时   |

#### 0.3 预期产出

```json
// 性能报告示例
{
  "requestId": "abc-123",
  "endpoint": "/api/classification/inbox",
  "totalDuration": 14523,
  "breakdown": [
    { "name": "auth_check", "duration": 12 },
    { "name": "fetch_inbox_bookmarks", "duration": 234 },
    { "name": "cluster_bookmarks", "duration": 3421 },
    { "name": "match_cluster_to_folder", "duration": 8234 },
    { "name": "generate_suggestions", "duration": 2156 },
    { "name": "save_to_database", "duration": 466 }
  ]
}
```

---

### Phase 1: `/api/classification/inbox` 根因诊断 (Day 1)

#### 1.1 已识别的问题链

```
问题链分析：

1. [根因] inbox-organizer.service.ts:analyze()
   │
   ├─ [症状1] clusterBookmarks() 同步计算
   │  └─ 原因: 对大量书签进行向量聚类，复杂度 O(n²)
   │  └─ 影响: 100+ 书签时耗时 1-5s
   │
   ├─ [症状2] matchClusterToFolder() 循环调用
   │  └─ 原因: 每个 cluster 单独查询数据库
   │  └─ 影响: 10 个 cluster = 10 次 DB 查询 = 500ms-2s
   │  └─ 类型: N+1 查询问题 ⚠️
   │
   └─ [症状3] 无结果缓存
      └─ 原因: 每次访问都重新计算
      └─ 影响: 重复访问无法利用缓存
```

#### 1.2 诊断脚本

创建诊断脚本验证假设：

```typescript
// scripts/diagnose-inbox-performance.ts
import { createClient } from "@supabase/supabase-js";

async function diagnoseInboxPerformance(userId: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  console.log("=== Inbox Performance Diagnosis ===\n");

  // 1. 检查 inbox 书签数量
  const t1 = performance.now();
  const { count: inboxCount } = await supabase
    .from("bookmarks")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("folder_id", null);
  const t2 = performance.now();
  console.log(`[1] Inbox bookmark count: ${inboxCount}`);
  console.log(`    Query time: ${(t2 - t1).toFixed(2)}ms\n`);

  // 2. 检查有 embedding 的书签数量
  const t3 = performance.now();
  const { count: embeddingCount } = await supabase
    .from("bookmarks")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("folder_id", null)
    .not("embedding", "is", null);
  const t4 = performance.now();
  console.log(`[2] Bookmarks with embedding: ${embeddingCount}`);
  console.log(`    Query time: ${(t4 - t3).toFixed(2)}ms\n`);

  // 3. 检查 folder 数量
  const t5 = performance.now();
  const { count: folderCount } = await supabase
    .from("folders")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_system", false);
  const t6 = performance.now();
  console.log(`[3] User folder count: ${folderCount}`);
  console.log(`    Query time: ${(t6 - t5).toFixed(2)}ms\n`);

  // 4. 检查 folder_profiles 数量
  const t7 = performance.now();
  const { count: profileCount } = await supabase
    .from("folder_profiles")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  const t8 = performance.now();
  console.log(`[4] Folder profiles count: ${profileCount}`);
  console.log(`    Query time: ${(t8 - t7).toFixed(2)}ms\n`);

  // 5. 模拟 N+1 查询影响
  const { data: clusters } = await supabase
    .from("bookmarks")
    .select("id")
    .eq("user_id", userId)
    .is("folder_id", null)
    .limit(10);

  const t9 = performance.now();
  for (const cluster of clusters || []) {
    await supabase
      .from("folder_profiles")
      .select("folder_id, computed_embedding")
      .eq("user_id", userId)
      .limit(1);
  }
  const t10 = performance.now();
  console.log(`[5] N+1 simulation (10 queries): ${(t10 - t9).toFixed(2)}ms`);
  console.log(`    Per query avg: ${((t10 - t9) / 10).toFixed(2)}ms\n`);

  // 6. 批量查询对比
  const t11 = performance.now();
  await supabase
    .from("folder_profiles")
    .select("folder_id, computed_embedding")
    .eq("user_id", userId);
  const t12 = performance.now();
  console.log(`[6] Batch query (1 query all): ${(t12 - t11).toFixed(2)}ms\n`);

  console.log("=== Diagnosis Complete ===");
  console.log("\nRecommendations:");
  if ((inboxCount || 0) > 50) {
    console.log("- High inbox count: Consider pagination for clustering");
  }
  if ((t10 - t9) / (t12 - t11) > 3) {
    console.log(
      "- N+1 issue confirmed: Batch queries would save " +
        `${(t10 - t9 - (t12 - t11)).toFixed(0)}ms`,
    );
  }
}

// 执行: npx tsx scripts/diagnose-inbox-performance.ts
```

#### 1.3 修复方案

**修复 1: N+1 查询问题**

```typescript
// src/lib/classification/services/inbox-organizer.service.ts

// BEFORE (N+1 问题)
async analyze(userId: string): Promise<OrganizationAnalysis> {
  const clusters = clusterBookmarks(...);

  // ❌ N+1: 每个 cluster 单独查询
  for (const cluster of clusters) {
    const matchedFolder = await this.matchClusterToFolder(
      cluster.centroid,
      userId
    );
    // ...
  }
}

// AFTER (批量查询)
async analyze(userId: string): Promise<OrganizationAnalysis> {
  const clusters = clusterBookmarks(...);

  // ✅ 批量获取所有 folder profiles
  const allFolderProfiles = await this.folderProfileRepo.findByUserId(userId);

  // 在内存中匹配
  const suggestions = clusters.map(cluster => {
    const matchedFolder = this.matchClusterInMemory(
      cluster.centroid,
      allFolderProfiles
    );
    return { cluster, matchedFolder };
  });
}

// 新增内存匹配方法
private matchClusterInMemory(
  centroid: number[],
  profiles: FolderProfile[]
): FolderProfile | null {
  let bestMatch: FolderProfile | null = null;
  let bestSimilarity = 0;

  for (const profile of profiles) {
    if (!profile.computed_embedding) continue;
    const similarity = cosineSimilarity(centroid, profile.computed_embedding);
    if (similarity > bestSimilarity && similarity > 0.7) {
      bestSimilarity = similarity;
      bestMatch = profile;
    }
  }

  return bestMatch;
}
```

**预期改进**: 10 个 cluster 从 ~1000ms 降至 ~100ms (90% 提升)

---

**修复 2: 聚类计算优化**

```typescript
// src/lib/classification/utils/clustering.ts

// BEFORE: 同步计算，阻塞主线程
export function clusterBookmarks(
  bookmarks: BookmarkForClustering[],
  similarityThreshold: number,
  minClusterSize: number,
): Cluster[] {
  // ... 复杂的聚类算法
}

// AFTER: 增加数量限制 + 渐进式处理
export function clusterBookmarks(
  bookmarks: BookmarkForClustering[],
  similarityThreshold: number,
  minClusterSize: number,
  options: {
    maxBookmarks?: number; // 限制处理数量
    timeoutMs?: number; // 超时保护
  } = {},
): Cluster[] {
  const { maxBookmarks = 200, timeoutMs = 3000 } = options;
  const startTime = Date.now();

  // 1. 数量限制：只处理最近的 N 个
  const limitedBookmarks = bookmarks
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, maxBookmarks);

  // 2. 超时保护
  const clusters: Cluster[] = [];
  for (const bookmark of limitedBookmarks) {
    if (Date.now() - startTime > timeoutMs) {
      console.warn(`[Clustering] Timeout after ${timeoutMs}ms`);
      break;
    }
    // ... 聚类逻辑
  }

  return clusters;
}
```

**预期改进**: 聚类时间从 1-5s 降至 <1s

---

**修复 3: 结果缓存**

```typescript
// src/lib/classification/services/inbox-organizer.service.ts

interface CachedAnalysis {
  analysis: OrganizationAnalysis;
  bookmarkHash: string;
  timestamp: number;
}

export class InboxOrganizerService {
  // 内存缓存 (可替换为 Redis)
  private analysisCache = new Map<string, CachedAnalysis>();
  private CACHE_TTL = 5 * 60 * 1000; // 5 分钟

  async analyze(userId: string): Promise<OrganizationAnalysis> {
    // 1. 检查缓存
    const cached = this.analysisCache.get(userId);
    const currentHash = await this.computeBookmarkHash(userId);

    if (
      cached &&
      cached.bookmarkHash === currentHash &&
      Date.now() - cached.timestamp < this.CACHE_TTL
    ) {
      return cached.analysis;
    }

    // 2. 执行分析
    const analysis = await this.performAnalysis(userId);

    // 3. 更新缓存
    this.analysisCache.set(userId, {
      analysis,
      bookmarkHash: currentHash,
      timestamp: Date.now(),
    });

    return analysis;
  }

  private async computeBookmarkHash(userId: string): Promise<string> {
    // 基于 inbox 书签的 count + max(updated_at) 生成快速哈希
    const { data } = await this.supabase
      .from("bookmarks")
      .select("id, updated_at")
      .eq("user_id", userId)
      .is("folder_id", null)
      .order("updated_at", { ascending: false })
      .limit(1);

    const count = await this.getInboxCount(userId);
    const latestUpdate = data?.[0]?.updated_at || "";
    return `${count}-${latestUpdate}`;
  }
}
```

**预期改进**: 重复访问从 11-22s 降至 <100ms

---

### Phase 2: `/api/bookmarks` 根因诊断 (Day 1.5)

#### 2.1 已识别的问题

```
问题分析：

1. [根因] count: "exact" 触发 COUNT(*) 查询
   └─ 影响: 大数据集下 200-500ms

2. [根因] SELECT * 获取所有字段
   └─ 影响: 单条书签 ~16KB，100 条 = 1.6MB

3. [根因] 无分页，一次性返回所有
   └─ 影响: 815KB 数据传输
```

#### 2.2 修复方案

```typescript
// src/app/api/bookmarks/route.ts

// BEFORE
let query = supabase
  .from("bookmarks")
  .select("*, folders(name)", { count: "exact" }) // ❌
  .eq("user_id", user.id);

// AFTER
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const cursor = searchParams.get("cursor");
  const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);

  // 1. 只选择列表必要的字段
  const listFields = `
    id,
    title,
    url,
    platform,
    cover_url,
    favicon_url,
    created_at,
    folder_id,
    folders(name)
  `;

  let query = supabase
    .from("bookmarks")
    .select(listFields) // ✅ 精简字段
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit + 1); // 多取一条判断是否有下一页

  // 2. 游标分页
  if (cursor) {
    const [cursorTime, cursorId] = cursor.split("_");
    query = query.or(
      `created_at.lt.${cursorTime},and(created_at.eq.${cursorTime},id.lt.${cursorId})`,
    );
  }

  const { data: bookmarks, error } = await query;

  // 3. 计算下一页游标
  const hasMore = bookmarks && bookmarks.length > limit;
  const items = hasMore ? bookmarks.slice(0, limit) : bookmarks;
  const nextCursor = hasMore
    ? `${items[items.length - 1].created_at}_${items[items.length - 1].id}`
    : null;

  return successResponse({
    items,
    nextCursor,
    hasMore,
  });
}
```

**预期改进**:

- 数据量: 815KB → ~50KB (首屏)
- 响应时间: 5.2s → <1s

---

### Phase 3: 并行化优化 (Day 2)

#### 3.1 匹配器并行执行

```typescript
// src/lib/classification/services/classification.service.ts

// BEFORE: 顺序执行
async classify(request: ClassificationRequest): Promise<ClassificationResult> {
  const results: MatchResult[] = [];

  for (const matcher of this.matchers) {
    const result = await matcher.match(request);
    results.push(result);
  }

  return this.aggregateResults(results);
}

// AFTER: 并行执行
async classify(request: ClassificationRequest): Promise<ClassificationResult> {
  // 并行执行所有匹配器
  const results = await Promise.all(
    this.matchers.map(matcher =>
      matcher.match(request).catch(error => {
        console.error(`[Matcher] ${matcher.name} failed:`, error);
        return null;  // 单个匹配器失败不影响整体
      })
    )
  );

  // 过滤失败的结果
  const validResults = results.filter((r): r is MatchResult => r !== null);

  return this.aggregateResults(validResults);
}
```

**预期改进**: 300-500ms → 150-200ms (最慢的匹配器决定总时间)

---

## 三、验证检查清单

### 3.1 诊断阶段验证

- [ ] 性能监控工具已部署
- [ ] 基线数据已收集 (至少 10 次请求)
- [ ] 瓶颈点已量化确认
- [ ] 诊断脚本已执行

### 3.2 修复阶段验证

| 修复项   | 验证方法     | 目标指标   |
| -------- | ------------ | ---------- |
| N+1 修复 | 诊断脚本     | 查询数 ≤ 3 |
| 聚类优化 | 性能埋点     | <1s        |
| 缓存实现 | 重复访问测试 | <100ms     |
| 分页实现 | 响应体大小   | <100KB     |
| 并行化   | 性能埋点     | <200ms     |

### 3.3 回归测试

- [ ] 所有现有功能正常
- [ ] 无新增 TypeScript 错误
- [ ] 无数据一致性问题
- [ ] 边界情况处理正确

---

## 四、实施时间表

```
Day 0.5: 性能监控基线
├── 创建 PerformanceMonitor 工具
├── 埋点 5 个关键 API
└── 收集基线数据

Day 1: inbox API 根因诊断与修复
├── 执行诊断脚本
├── 修复 N+1 查询
├── 实现结果缓存
└── 优化聚类算法

Day 1.5: bookmarks API 优化
├── 实现游标分页
├── 精简返回字段
└── 前端适配

Day 2: 并行化与收尾
├── 匹配器并行执行
├── 性能验证测试
└── 文档更新
```

---

## 五、风险与回退

| 风险               | 概率 | 缓解措施           |
| ------------------ | ---- | ------------------ |
| 缓存导致数据不一致 | 中   | 短 TTL + hash 校验 |
| 聚类精度下降       | 低   | 保留原算法作为回退 |
| 分页影响用户体验   | 低   | 无限滚动 + 预加载  |

**回退方案**: 所有修改通过 feature flag 控制，可随时回退

---

**文档作者**: Winston (Architect Agent)
**创建日期**: 2025-12-12
**预计工时**: 2.5 人天
