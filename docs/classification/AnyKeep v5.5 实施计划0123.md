# AnyKeep v5.5 实施计划

> **版本**: v5.5 晶体生长过渡版（零接管模式）
> **创建日期**: 2026-01-23
> **更新日期**: 2026-01-23
> **基于文档**: [晶体生长算法 v6.5](./晶体0122.md)
> **状态**: 待审核

---

## 核心设计原则

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        AnyKeep 设计哲学                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   🎯 零接管 (Zero Takeover)                                             │
│   ══════════════════════════                                            │
│   用户只管收藏，剩下的交给 AnyKeep                                        │
│                                                                         │
│   🔕 免打扰 (Non-Intrusive)                                             │
│   ══════════════════════════                                            │
│   AI 静默工作，仅在必要时轻声汇报                                         │
│                                                                         │
│   🤖 先做后报告 (Act First, Report Later)                                │
│   ══════════════════════════                                            │
│   不问"要不要做"，而是告诉"已经做了什么"                                   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**v5.5 核心承诺**：用户收藏完成后，无需任何额外操作，AI 自动完成分类或创建新文件夹。

---

## 版本定位

```
┌─────────────────────────────────────────────────────────────────────────┐
│  v5.5: 静默晶体生长 + 配额治理                                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  核心特性:                                                               │
│  ✓ AI 静默自动创建文件夹（用户无需确认）                                   │
│  ✓ 三层弹性配额制（防止文件夹爆炸）                                        │
│  ✓ 混沌池晶核检测（智能聚类）                                             │
│  ✓ 轻量汇报机制（已完成通知，非请求确认）                                  │
│                                                                         │
│  用户体验:                                                               │
│  • 收藏 → 自动分类/创建 → 轻提示"已为您创建「XXX」文件夹"                  │
│  • 无弹窗、无确认、无干扰                                                 │
│  • 仅在配额耗尽时才需要用户介入                                           │
│                                                                         │
│  与 v6.0 的差异:                                                         │
│  × 不自动重结晶（分裂/合并需用户触发）                                     │
│  × 不推送园丁报告（仅页面内展示）                                          │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 一、风险评估与缓解措施

### 1.1 高风险 (P0)

| 风险             | 影响                                           | 缓解措施                                                     |
| ---------------- | ---------------------------------------------- | ------------------------------------------------------------ |
| **数据双轨存储** | 书签同时存在于 inbox 和 chaos_pool，数据不一致 | ✅ **chaos_pool 仅存引用**，不改变 folder_id，书签仍在 inbox |
| **配额逻辑冲突** | 现有 daily_limit 与新 aiHardCap 冲突           | ✅ **UnifiedQuotaService** 统一配额检查入口                  |
| **现有服务失效** | SmartSorting 与 v5.5 并行运行产生冲突          | ✅ **协同模式**：v5.5 实时 + SmartSorting 兜底，互斥处理     |
| **LLM 命名延迟** | 影响收藏响应速度                               | ✅ **异步命名**：先用临时名称，后台更新                      |

### 1.2 中风险 (P1)

| 风险                    | 影响                     | 缓解措施                                               |
| ----------------------- | ------------------------ | ------------------------------------------------------ |
| **autonomy_level 语义** | Level 2/3 用户期望确认   | ✅ **保留语义**：仅 Level 1 静默创建，Level 2/3 需确认 |
| **历史文件夹无法追溯**  | 无法统计 AI 创建的文件夹 | ✅ **迁移脚本**：基于创建时间/命名模式推断标记         |
| **实时检测性能**        | 每次收藏增加延迟         | ✅ **后台异步**：收藏立即返回，检测后台进行            |
| **空文件夹积累**        | AI 创建后用户未使用      | ✅ **健康度门控**：空文件夹 >3 暂停创建                |

### 1.3 低风险 (P2)

| 风险             | 影响                              | 缓解措施                                               |
| ---------------- | --------------------------------- | ------------------------------------------------------ |
| **定时任务冲突** | SmartSorting 与 v5.5 处理相同书签 | ✅ **互斥标记**：chaos_pool 中的书签 SmartSorting 跳过 |
| **回滚困难**     | 功能回退时状态混乱                | ✅ **Feature Flag** 精细控制，可随时关闭               |

---

## 二、与现有系统集成方案

### 2.1 现有系统架构

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     现有文件夹自组织系统                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  用户收藏                                                                │
│      ↓                                                                  │
│  ClassificationPipeline (L0→T0→T1)                                      │
│      ↓                                                                  │
│  命中文件夹? ─── 是 ──→ 归类完成                                         │
│      │                                                                  │
│      └── 否 ──→ 进入 Inbox                                              │
│                    ↓                                                    │
│              SmartSorting (每日凌晨)                                     │
│                    ↓                                                    │
│              DBSCAN 聚类 → 自动创建/建议                                  │
│                                                                         │
│  问题:                                                                   │
│  • 最长等待 24 小时才能形成新文件夹                                       │
│  • 定时批处理，非实时响应                                                 │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 v5.5 集成架构

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     v5.5 集成架构（协同模式）                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  用户收藏                                                                │
│      ↓                                                                  │
│  ClassificationPipeline (L0→T0→T1) ← 现有逻辑不变                        │
│      ↓                                                                  │
│  命中文件夹? ─── 是 ──→ 归类完成                                         │
│      │                                                                  │
│      └── 否 ──→ 进入 Inbox + 🆕 写入 chaos_pool                         │
│                    │                                                    │
│      ┌─────────────┴─────────────┐                                      │
│      ↓                           ↓                                      │
│  🆕 CrystalGrowth            SmartSorting                               │
│  (实时后台检测)              (每日兜底)                                   │
│      │                           │                                      │
│      ├── 形成晶核?               ├── chaos_pool 中的跳过                 │
│      │   是 → 静默创建文件夹     │                                      │
│      │       + 轻提示            └── 处理剩余 inbox                      │
│      │                                                                  │
│      └── 否 → 保留 chaos_pool                                           │
│               等待更多相似书签                                           │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.3 协同机制

```typescript
// 互斥处理逻辑
interface BookmarkProcessingState {
  in_chaos_pool: boolean;      // 是否在混沌池
  crystal_processed: boolean;  // v5.5 是否已处理
  smart_sorting_skip: boolean; // SmartSorting 是否跳过
}

// SmartSorting 改造
async processInboxCache(userId: string) {
  const inboxBookmarks = await this.getInboxBookmarks(userId);

  // 🆕 排除已在 chaos_pool 中的书签
  const chaosPoolIds = await this.chaosPoolManager.getBookmarkIds(userId);
  const toProcess = inboxBookmarks.filter(b => !chaosPoolIds.includes(b.id));

  // 处理剩余书签...
}
```

---

## 三、三层弹性配额制

### 3.1 配额模型

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    文件夹配额��理模型                                    │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Layer 1: 系统硬上限 (Hard Cap)                                          │
│  ════════════════════════════                                           │
│  • AI 创建上限: 30 个                                                    │
│  • 用户手动创建: 无限制                                                  │
│  • 总文件夹上限: 50 个 (AI + 手动)                                       │
│                                                                         │
│  Layer 2: 动态软上限 (Soft Cap)                                          │
│  ════════════════════════════                                           │
│  • 公式: min(书签数 × 15%, 硬上限)                                       │
│  • 书签 < 50  → AI 上限 5 个                                             │
│  • 书签 50-200 → AI 上限 15 个                                           ��
│  • 书签 > 200 → AI 上限 30 个                                            │
│                                                                         │
│  Layer 3: 健康度门控 (Health Gate)                                       │
│  ════════════════════════════                                           │
│  • 空文件夹 > 3 个 → 暂停创建，轻提示用户整理                             │
│  • 触发后自动恢复：用户整理后下次收藏自动检测                              │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.2 统一配额服务

```typescript
// src/lib/classification/v5.5/quota/unified-quota.service.ts

export class UnifiedQuotaService {
  /**
   * 统一配额检查入口
   * 合并现有 daily_limit 和新的三层配额
   */
  async checkQuota(userId: string): Promise<UnifiedQuotaResult> {
    const [dailyStats, quotaStats, healthStats] = await Promise.all([
      this.getDailyCreatedCount(userId), // 现有逻辑
      this.getAIFolderStats(userId), // 新��逻辑
      this.getHealthGateStats(userId), // 新增逻辑
    ]);

    const settings = await this.getAIFolderSettings(userId);
    const dailyLimit = settings?.daily_create_limit ?? 5;

    // 三重检查
    const dailyAllowed = dailyStats.count < dailyLimit;
    const totalAllowed =
      quotaStats.aiCount < this.calculateDynamicCap(quotaStats.bookmarkCount);
    const healthAllowed = healthStats.emptyFolders <= 3;

    return {
      allowed: dailyAllowed && totalAllowed && healthAllowed,

      daily: {
        used: dailyStats.count,
        limit: dailyLimit,
        remaining: Math.max(0, dailyLimit - dailyStats.count),
      },

      total: {
        aiCreated: quotaStats.aiCount,
        limit: this.calculateDynamicCap(quotaStats.bookmarkCount),
        remaining: Math.max(
          0,
          this.calculateDynamicCap(quotaStats.bookmarkCount) -
            quotaStats.aiCount,
        ),
      },

      health: {
        passed: healthAllowed,
        emptyFolders: healthStats.emptyFolders,
        reason: healthAllowed
          ? undefined
          : `存在 ${healthStats.emptyFolders} 个空文件夹`,
      },
    };
  }

  private calculateDynamicCap(bookmarkCount: number): number {
    const calculated = Math.ceil(bookmarkCount * 0.15);
    return Math.max(5, Math.min(calculated, 30));
  }
}
```

---

## 四、模块结构

```
src/lib/classification/v5.5/
├── crystal-growth/                  # 核心：晶体生长服务
│   ├── crystal-growth.service.ts        # 主服务（静默自动创建）
│   ├── chaos-pool.manager.ts            # 混沌池管理
│   ├── nucleus-detector.ts              # 晶核检测器
│   ├── folder-name-generator.ts         # MECE 命名器
│   ├── async-naming-queue.ts            # 🆕 异步命名队列
│   └── types.ts
│
├── quota/                           # 配额治理
│   ├── unified-quota.service.ts         # 🆕 统一配额服务
│   ├── folder-quota.config.ts
│   ├── health-gate.ts
│   └── types.ts
│
├── notification/                    # 🆕 轻量通知
│   ├── silent-notifier.ts               # 静默通知器
│   └── types.ts
│
├── integration/                     # 集成层
│   ├── v55-classifier.ts
│   ├── v55-feature-flag.ts
│   └── smart-sorting-adapter.ts         # 🆕 SmartSorting 适配器
│
└── __tests__/
```

---

## 五、数据库迁移

### 5.1 混沌池表（仅存引用）

```sql
-- Migration: 20260123000001_add_chaos_pool.sql

CREATE TABLE IF NOT EXISTS chaos_pool (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bookmark_id BIGINT NOT NULL REFERENCES bookmarks(id) ON DELETE CASCADE,

  -- 处理状态
  crystal_processed BOOLEAN DEFAULT FALSE,  -- v5.5 是否已处理
  processed_at TIMESTAMPTZ,                 -- 处理时间
  result_folder_id BIGINT,                  -- 结果文件夹 ID

  -- TTL
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),

  CONSTRAINT chaos_pool_unique UNIQUE(user_id, bookmark_id)
);

-- 索引：用于晶核检测的邻居搜索
CREATE INDEX idx_chaos_pool_user_unprocessed
  ON chaos_pool (user_id, created_at DESC)
  WHERE crystal_processed = FALSE;

CREATE INDEX idx_chaos_pool_expires
  ON chaos_pool (expires_at)
  WHERE expires_at IS NOT NULL;

-- RLS
ALTER TABLE chaos_pool ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own chaos pool" ON chaos_pool
  FOR ALL USING (auth.uid() = user_id);

COMMENT ON TABLE chaos_pool IS
  'V5.5 混沌池：存储未分类书签引用，用于晶核检测。书签本身仍在 inbox。';
```

### 5.2 文件夹表扩展

```sql
-- Migration: 20260123000002_extend_folders_v55.sql

-- AI 生成标记
ALTER TABLE folders ADD COLUMN IF NOT EXISTS
  is_ai_generated BOOLEAN DEFAULT FALSE;

ALTER TABLE folders ADD COLUMN IF NOT EXISTS
  ai_generation_source TEXT CHECK (
    ai_generation_source IN ('CRYSTAL_GROWTH', 'SMART_SORTING', 'SUGGESTION', 'MERGE', 'SPLIT')
  );

-- 晶体元数据
ALTER TABLE folders ADD COLUMN IF NOT EXISTS
  crystal_birth_time TIMESTAMPTZ;

ALTER TABLE folders ADD COLUMN IF NOT EXISTS
  origin_bookmark_ids BIGINT[];

-- 临时名称标记（异步命名用）
ALTER TABLE folders ADD COLUMN IF NOT EXISTS
  is_naming_pending BOOLEAN DEFAULT FALSE;

-- 索引
CREATE INDEX idx_folders_ai_generated
  ON folders (user_id, is_ai_generated)
  WHERE is_ai_generated = TRUE;

CREATE INDEX idx_folders_naming_pending
  ON folders (user_id)
  WHERE is_naming_pending = TRUE;
```

### 5.3 迁移脚本：标记历史 AI 文件夹

```sql
-- Migration: 20260123000003_migrate_historical_ai_folders.sql

-- 基于 SmartSorting 创建时间推断标记
-- 规则：凌晨 4-5 点创建的非系统文件夹，大概率是 SmartSorting 自动创建

UPDATE folders
SET
  is_ai_generated = TRUE,
  ai_generation_source = 'SMART_SORTING'
WHERE
  is_system = FALSE
  AND deleted_at IS NULL
  AND is_ai_generated IS NULL
  AND EXTRACT(HOUR FROM created_at) BETWEEN 4 AND 5
  AND created_at > NOW() - INTERVAL '90 days';

-- 记录迁移结果
DO $$
DECLARE
  migrated_count INT;
BEGIN
  SELECT COUNT(*) INTO migrated_count
  FROM folders
  WHERE ai_generation_source = 'SMART_SORTING';

  RAISE NOTICE 'Migrated % folders as AI-generated', migrated_count;
END $$;
```

### 5.4 晶核检测函数

```sql
-- Migration: 20260123000004_add_nucleus_detection.sql

-- 查找混沌池中的邻居（用于晶核检测）
CREATE OR REPLACE FUNCTION find_chaos_pool_neighbors(
  p_user_id UUID,
  p_bookmark_id BIGINT,
  p_radius FLOAT DEFAULT 0.20,
  p_limit INT DEFAULT 10
)
RETURNS TABLE (
  bookmark_id BIGINT,
  title TEXT,
  similarity FLOAT
) AS $$
BEGIN
  RETURN QUERY
  WITH target AS (
    SELECT b.embedding
    FROM bookmarks b
    WHERE b.id = p_bookmark_id AND b.user_id = p_user_id
  )
  SELECT
    cp.bookmark_id,
    b.title,
    1 - (b.embedding <=> t.embedding) AS similarity
  FROM chaos_pool cp
  JOIN bookmarks b ON b.id = cp.bookmark_id
  CROSS JOIN target t
  WHERE cp.user_id = p_user_id
    AND cp.bookmark_id != p_bookmark_id
    AND cp.crystal_processed = FALSE  -- 只搜索未处理的
    AND b.embedding IS NOT NULL
    AND 1 - (b.embedding <=> t.embedding) > (1 - p_radius)
  ORDER BY similarity DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- 统一配额统计函数
CREATE OR REPLACE FUNCTION get_unified_quota_stats(p_user_id UUID)
RETURNS TABLE (
  ai_folder_count INT,
  total_folder_count INT,
  empty_folder_count INT,
  total_bookmark_count BIGINT,
  today_created_count INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*) FILTER (WHERE f.is_ai_generated = TRUE)::INT AS ai_folder_count,
    COUNT(*)::INT AS total_folder_count,
    COUNT(*) FILTER (WHERE NOT EXISTS (
      SELECT 1 FROM bookmarks bm WHERE bm.folder_id = f.id AND bm.deleted_at IS NULL
    ))::INT AS empty_folder_count,
    (SELECT COUNT(*) FROM bookmarks WHERE user_id = p_user_id AND deleted_at IS NULL) AS total_bookmark_count,
    (SELECT COUNT(*) FROM folders
     WHERE user_id = p_user_id
       AND is_ai_generated = TRUE
       AND created_at >= CURRENT_DATE
       AND deleted_at IS NULL)::INT AS today_created_count
  FROM folders f
  WHERE f.user_id = p_user_id
    AND f.deleted_at IS NULL
    AND f.is_system = FALSE;
END;
$$ LANGUAGE plpgsql STABLE;
```

---

## 六、核心服务实现

### 6.1 晶体生长服务（静默自动创建）

```typescript
// src/lib/classification/v5.5/crystal-growth/crystal-growth.service.ts

import type { SupabaseClient } from "@supabase/supabase-js";
import { UnifiedQuotaService } from "../quota/unified-quota.service";
import { ChaosPoolManager } from "./chaos-pool.manager";
import { NucleusDetector } from "./nucleus-detector";
import { FolderNameGenerator } from "./folder-name-generator";
import { AsyncNamingQueue } from "./async-naming-queue";
import { SilentNotifier } from "../notification/silent-notifier";
import { logger } from "@/lib/logger";

export interface CrystalGrowthResult {
  action: "CLASSIFIED" | "CRYSTALLIZED" | "POOLED" | "QUOTA_BLOCKED";
  folderId?: number;
  folderName?: string;
  isNewFolder?: boolean;
  notification?: {
    type: "success" | "info" | "warning";
    message: string;
  };
}

export class CrystalGrowthService {
  private quotaService: UnifiedQuotaService;
  private chaosPoolManager: ChaosPoolManager;
  private nucleusDetector: NucleusDetector;
  private nameGenerator: FolderNameGenerator;
  private namingQueue: AsyncNamingQueue;
  private notifier: SilentNotifier;

  private readonly NUCLEATION_THRESHOLD = 3;

  constructor(private supabase: SupabaseClient) {
    this.quotaService = new UnifiedQuotaService(supabase);
    this.chaosPoolManager = new ChaosPoolManager(supabase);
    this.nucleusDetector = new NucleusDetector(supabase);
    this.nameGenerator = new FolderNameGenerator(supabase);
    this.namingQueue = new AsyncNamingQueue(supabase);
    this.notifier = new SilentNotifier();
  }

  /**
   * 处理进入 Inbox 的书签
   * 核心原则：静默自动，用户无需任何操作
   */
  async processInboxBookmark(
    userId: string,
    bookmark: { id: number; title: string; url?: string },
  ): Promise<CrystalGrowthResult> {
    const startTime = performance.now();

    try {
      // Step 1: 检查配额
      const quota = await this.quotaService.checkQuota(userId);

      if (!quota.allowed) {
        // 配额不足：静默进入 Inbox，不打扰用户
        // 仅在健康度问题时轻提示
        if (!quota.health.passed) {
          return {
            action: "QUOTA_BLOCKED",
            notification: {
              type: "info",
              message: `智能分类已暂停：${quota.health.reason}`,
            },
          };
        }

        logger.info(
          { userId, quota },
          "V5.5: Quota exceeded, staying in inbox",
        );
        return { action: "POOLED" };
      }

      // Step 2: 加入混沌池
      await this.chaosPoolManager.add(userId, bookmark.id);

      // Step 3: 检测晶核
      const nucleus = await this.nucleusDetector.detect(
        userId,
        bookmark.id,
        this.NUCLEATION_THRESHOLD,
      );

      if (!nucleus.formed) {
        // 未形成晶核：静默等待更多相似书签
        logger.debug(
          {
            userId,
            bookmarkId: bookmark.id,
            neighborsFound: nucleus.neighborsCount,
            latencyMs: performance.now() - startTime,
          },
          "V5.5: Nucleus not formed, pooled",
        );

        return { action: "POOLED" };
      }

      // Step 4: 晶核形成 → 静默创建文件夹
      const result = await this.crystallize(userId, nucleus);

      logger.info(
        {
          userId,
          bookmarkId: bookmark.id,
          folderId: result.folderId,
          folderName: result.folderName,
          clusterSize: nucleus.clusterBookmarkIds.length,
          latencyMs: performance.now() - startTime,
        },
        "V5.5: Crystallized - folder created silently",
      );

      return result;
    } catch (error) {
      logger.error({ userId, bookmark, error }, "V5.5: Crystal growth failed");
      return { action: "POOLED" };
    }
  }

  /**
   * 结晶：静默创建文件夹并移动书签
   */
  private async crystallize(
    userId: string,
    nucleus: NucleusResult,
  ): Promise<CrystalGrowthResult> {
    // 生成临时名称（快速响应）
    const tempName = this.generateTempName(nucleus.clusterTitles);

    // 创建文件夹
    const { data: folder, error } = await this.supabase
      .from("folders")
      .insert({
        user_id: userId,
        name: tempName,
        is_ai_generated: true,
        ai_generation_source: "CRYSTAL_GROWTH",
        crystal_birth_time: new Date().toISOString(),
        origin_bookmark_ids: nucleus.clusterBookmarkIds,
        is_naming_pending: true, // 标记需要优化命名
      })
      .select("id, name")
      .single();

    if (error || !folder) {
      throw new Error(`Failed to create folder: ${error?.message}`);
    }

    // 移动书签到新文件夹
    await this.supabase
      .from("bookmarks")
      .update({ folder_id: folder.id })
      .in("id", nucleus.clusterBookmarkIds);

    // 标记混沌池记录已处理
    await this.chaosPoolManager.markProcessed(
      userId,
      nucleus.clusterBookmarkIds,
      folder.id,
    );

    // 异步优化命名（后台进行，不阻塞）
    this.namingQueue.enqueue({
      folderId: folder.id,
      userId,
      clusterTitles: nucleus.clusterTitles,
    });

    return {
      action: "CRYSTALLIZED",
      folderId: folder.id,
      folderName: tempName,
      isNewFolder: true,
      notification: {
        type: "success",
        message: `已为您创建「${tempName}」文件夹，收录 ${nucleus.clusterBookmarkIds.length} 条相关内容`,
      },
    };
  }

  /**
   * 生成临时名称（毫秒级响应）
   */
  private generateTempName(titles: string[]): string {
    // 提取高频词作为临时名称
    const allWords = titles.join(" ").split(/[\s,，、：:]+/);
    const wordCounts = new Map<string, number>();

    for (const word of allWords) {
      if (word.length >= 2 && word.length <= 10) {
        wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
      }
    }

    let maxWord = "新主题";
    let maxCount = 0;

    for (const [word, count] of wordCounts) {
      if (count > maxCount && !this.isStopWord(word)) {
        maxCount = count;
        maxWord = word;
      }
    }

    return maxWord;
  }

  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      "的",
      "是",
      "在",
      "有",
      "和",
      "与",
      "了",
      "为",
      "以",
      "the",
      "a",
      "an",
      "is",
      "are",
      "of",
      "to",
      "and",
    ]);
    return stopWords.has(word.toLowerCase());
  }
}
```

### 6.2 异步命名队列

```typescript
// src/lib/classification/v5.5/crystal-growth/async-naming-queue.ts

import type { SupabaseClient } from "@supabase/supabase-js";
import { FolderNameGenerator } from "./folder-name-generator";
import { logger } from "@/lib/logger";

interface NamingTask {
  folderId: number;
  userId: string;
  clusterTitles: string[];
}

export class AsyncNamingQueue {
  private generator: FolderNameGenerator;
  private processing = false;
  private queue: NamingTask[] = [];

  constructor(private supabase: SupabaseClient) {
    this.generator = new FolderNameGenerator(supabase);
  }

  /**
   * 入队命名任务（非阻塞）
   */
  enqueue(task: NamingTask): void {
    this.queue.push(task);
    this.processNext();
  }

  private async processNext(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;
    const task = this.queue.shift()!;

    try {
      // 生成 MECE 名称
      const optimizedName = await this.generator.generate(
        task.userId,
        task.clusterTitles,
      );

      // 更新文件夹名称
      await this.supabase
        .from("folders")
        .update({
          name: optimizedName,
          is_naming_pending: false,
        })
        .eq("id", task.folderId);

      logger.info(
        {
          folderId: task.folderId,
          optimizedName,
        },
        "V5.5: Folder name optimized",
      );
    } catch (error) {
      logger.error({ task, error }, "V5.5: Async naming failed");

      // 失败时移除 pending 标记，保留临时名称
      await this.supabase
        .from("folders")
        .update({ is_naming_pending: false })
        .eq("id", task.folderId);
    } finally {
      this.processing = false;
      this.processNext();
    }
  }
}
```

### 6.3 静默通知器

```typescript
// src/lib/classification/v5.5/notification/silent-notifier.ts

export interface SilentNotification {
  type: "success" | "info" | "warning";
  message: string;
  duration?: number; // 毫秒，默认 3000
  action?: {
    label: string;
    href: string;
  };
}

export class SilentNotifier {
  /**
   * 生成静默通知配置
   * 特点：不打断用户，右下角轻提示，自动消失
   */
  createNotification(params: {
    action: string;
    folderName?: string;
    count?: number;
    reason?: string;
  }): SilentNotification | null {
    switch (params.action) {
      case "CRYSTALLIZED":
        return {
          type: "success",
          message: `已创建「${params.folderName}」，收录 ${params.count} 条内容`,
          duration: 3000,
          action: {
            label: "查看",
            href: `/folders?highlight=${params.folderName}`,
          },
        };

      case "QUOTA_BLOCKED":
        return {
          type: "info",
          message: params.reason || "智能分类已暂停",
          duration: 5000,
          action: {
            label: "整理",
            href: "/folders?action=cleanup",
          },
        };

      default:
        return null; // 静默，无通知
    }
  }
}
```

### 6.4 SmartSorting 适配器

```typescript
// src/lib/classification/v5.5/integration/smart-sorting-adapter.ts

import type { SupabaseClient } from "@supabase/supabase-js";
import { ChaosPoolManager } from "../crystal-growth/chaos-pool.manager";
import { FeatureFlags } from "./v55-feature-flag";

/**
 * SmartSorting 适配器
 * 确保 v5.5 与现有 SmartSorting 协同工作
 */
export class SmartSortingAdapter {
  private chaosPoolManager: ChaosPoolManager;

  constructor(private supabase: SupabaseClient) {
    this.chaosPoolManager = new ChaosPoolManager(supabase);
  }

  /**
   * 过滤 SmartSorting 应该处理的书签
   * 排除已在 chaos_pool 中的书签
   */
  async filterBookmarksForSmartSorting(
    userId: string,
    inboxBookmarks: { id: number }[],
  ): Promise<{ id: number }[]> {
    if (!FeatureFlags.V55_ENABLED) {
      return inboxBookmarks; // v5.5 未启用，返回全部
    }

    const chaosPoolIds = await this.chaosPoolManager.getBookmarkIds(userId);
    const chaosPoolSet = new Set(chaosPoolIds);

    return inboxBookmarks.filter((b) => !chaosPoolSet.has(b.id));
  }

  /**
   * 标记 SmartSorting 创建的文件夹
   */
  async markSmartSortingFolder(folderId: number): Promise<void> {
    await this.supabase
      .from("folders")
      .update({
        is_ai_generated: true,
        ai_generation_source: "SMART_SORTING",
      })
      .eq("id", folderId);
  }
}
```

---

## 七、API 端点

### 7.1 配额查询 API

```typescript
// src/app/api/folders/quota/route.ts

import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { UnifiedQuotaService } from "@/lib/classification/v5.5/quota/unified-quota.service";

export async function GET() {
  const supabase = createRouteHandlerClient({ cookies });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const quotaService = new UnifiedQuotaService(supabase);
  const result = await quotaService.checkQuota(user.id);

  return NextResponse.json({
    allowed: result.allowed,
    daily: result.daily,
    total: result.total,
    health: result.health,
  });
}
```

### 7.2 晶体生长触发点集成

```typescript
// src/lib/classification/v5/classification-pipeline/t0-generator.ts
// 修改现有文件，添加 chaos_pool 写入

import { ChaosPoolManager } from "../../v5.5/crystal-growth/chaos-pool.manager";
import { FeatureFlags } from "../../v5.5/integration/v55-feature-flag";

// 在 generate 方法中添加
async generate(request: T0Request): Promise<T0Result> {
  const result = await this.hybridRetrieval(request);

  // 🆕 v5.5 集成：进入 inbox 时写入 chaos_pool
  if (result.folderId === request.defaultFolderId && FeatureFlags.V55_ENABLED) {
    const chaosPoolManager = new ChaosPoolManager(this.supabase);
    await chaosPoolManager.add(request.userId, request.bookmarkId);

    // 异步触发晶核检测（不阻塞响应）
    this.triggerCrystalGrowthAsync(request.userId, request.bookmarkId);
  }

  return result;
}

private triggerCrystalGrowthAsync(userId: string, bookmarkId: number): void {
  // 使用 queueMicrotask 确保不阻塞主流程
  queueMicrotask(async () => {
    try {
      const crystalService = new CrystalGrowthService(this.supabase);
      await crystalService.processInboxBookmark(userId, {
        id: bookmarkId,
        title: "", // 会从数据库重新获取
      });
    } catch (error) {
      logger.error({ userId, bookmarkId, error }, "V5.5: Async crystal growth failed");
    }
  });
}
```

---

## 八、前端组件

### 8.1 配额进度条（轻量展示）

```typescript
// src/components/folders/folder-quota-bar.tsx

"use client";

import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Sparkles } from "lucide-react";
import { useFolderQuota } from "@/hooks/use-folder-quota";

export function FolderQuotaBar() {
  const { data: quota, isLoading } = useFolderQuota();

  if (isLoading || !quota) return null;

  // 只在接近上限时显示
  const usage = quota.total.aiCreated / quota.total.limit;
  if (usage < 0.6) return null;

  const isWarning = usage >= 0.8;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground">
          <Sparkles className={`h-3 w-3 ${isWarning ? "text-amber-500" : ""}`} />
          <Progress
            value={usage * 100}
            className="h-1.5 w-16"
          />
          <span>{quota.total.remaining}</span>
        </div>
      </TooltipTrigger>
      <TooltipContent>
        <p>AI 文件夹额度：{quota.total.aiCreated}/{quota.total.limit}</p>
        {quota.health.reason && (
          <p className="text-amber-500">{quota.health.reason}</p>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
```

### 8.2 静默 Toast 通知

```typescript
// src/components/folders/crystal-growth-toast.tsx

"use client";

import { toast } from "sonner";
import { Sparkles, FolderPlus } from "lucide-react";
import type { SilentNotification } from "@/lib/classification/v5.5/notification/silent-notifier";

/**
 * 静默通知 Toast
 * 特点：不打断用户，右下角轻提示，自动消失
 */
export function showCrystalGrowthToast(notification: SilentNotification) {
  const Icon = notification.type === "success" ? FolderPlus : Sparkles;

  toast(notification.message, {
    icon: <Icon className="h-4 w-4" />,
    duration: notification.duration || 3000,
    position: "bottom-right",
    action: notification.action
      ? {
          label: notification.action.label,
          onClick: () => {
            window.location.href = notification.action!.href;
          },
        }
      : undefined,
  });
}
```

---

## 九、实施时间表

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    v5.5 实施时间表 (3 周)                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Week 1: 基础设施（无功能变化）                                          │
│  ═══════════════════════════                                            │
│                                                                         │
│  Day 1-2: 数据库迁移                                                     │
│  ├─ [ ] chaos_pool 表（仅存引用）                                       │
│  ├─ [ ] folders 扩展字段                                                │
│  ├─ [ ] 统一配额 RPC 函数                                               │
│  └─ [ ] 历史 AI 文件夹迁移标记                                          │
│                                                                         │
│  Day 3-4: 统一配额服务                                                   │
│  ├─ [ ] UnifiedQuotaService                                             │
│  ├─ [ ] 集成现有 daily_limit 逻辑                                       │
│  └─ [ ] 配额查询 API                                                    │
│                                                                         │
│  Day 5: SmartSorting 适配                                               │
│  ├─ [ ] SmartSortingAdapter                                             │
│  └─ [ ] 互斥处理逻辑                                                    │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  Week 2: 影子模式（记录不执行）                                          │
│  ═══════════════════════════                                            │
│                                                                         │
│  Day 1-2: 核心服务开发                                                   │
│  ├─ [ ] ChaosPoolManager                                                │
│  ├─ [ ] NucleusDetector                                                 │
│  ├─ [ ] CrystalGrowthService（影子模式）                                │
│  └─ [ ] 单元测试 (≥80% 覆盖)                                            │
│                                                                         │
│  Day 3-4: 影子模式运行                                                   │
│  ├─ [ ] 集成到 T0Generator（仅记录日志）                                │
│  ├─ [ ] 对比 SmartSorting 建议质量                                      │
│  └─ [ ] 收集晶核形成率数据                                              │
│                                                                         │
│  Day 5: 阈值调优                                                        │
│  ├─ [ ] 分析影子模式数据                                                │
│  └─ [ ] 调整 NUCLEATION_THRESHOLD                                       │
│                                                                         │
│  ─────────────────────────────────────────────────────────────────────  │
│                                                                         │
│  Week 3: 灰度发布                                                        │
│  ═══════════════════════════                                            │
│                                                                         │
│  Day 1: 前端组件                                                        │
│  ├─ [ ] FolderQuotaBar                                                  │
│  ├─ [ ] showCrystalGrowthToast                                          │
│  └─ [ ] 集成到 FolderNavPanel                                           │
│                                                                         │
│  Day 2-3: 1% 灰度                                                       │
│  ├─ [ ] 启用 V55_ENABLED (1% 用户)                                      │
│  ├─ [ ] 监控静默创建成功率                                              │
│  └─ [ ] 收集用户反馈                                                    │
│                                                                         │
│  Day 4-5: 扩大灰度                                                      │
│  ├─ [ ] 10% → 50% → 100%                                               │
│  ├─ [ ] 更新 CLAUDE.md                                                  │
│  └─ [ ] 完成文档                                                        │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 十、Feature Flags

```bash
# .env.local

# v5.5 主开关
V55_ENABLED=false

# 灰度比例 (0-100)
V55_ROLLOUT_PERCENT=0

# 子功能开关
V55_CHAOS_POOL_ENABLED=true        # 混沌池写��
V55_CRYSTAL_GROWTH_ENABLED=true    # 晶体生长（静默创建）
V55_ASYNC_NAMING_ENABLED=true      # 异步命名优化
V55_SILENT_NOTIFICATION=true       # 静默通知

# 配额配置
AI_FOLDER_HARD_CAP=30
TOTAL_FOLDER_HARD_CAP=50
FOLDER_SOFT_CAP_RATIO=0.15

# 调试开关
V55_SHADOW_MODE=true               # 影子模式（仅记录不执行）
V55_DEBUG_LOG=false                # 详细日志
```

---

## 十一、成功标准

| 指标               | 目标    | 测量方式              |
| ------------------ | ------- | --------------------- |
| **静默创建成功率** | ≥ 95%   | 成功创建 / 触发创建   |
| **用户无感知率**   | ≥ 90%   | 未点击通知 / 总通知   |
| **晶核形成率**     | ≥ 30%   | 形成晶核 / 进入混沌池 |
| **命名满意度**     | ≥ 80%   | 用户未重命名比例      |
| **系统延迟**       | < 100ms | 收藏响应时间增量      |
| **配额触发率**     | < 5%    | 被配额阻止 / 总收藏   |

---

## 十二、回滚方案

```typescript
// 紧急回滚脚本
async function rollbackV55() {
  // 1. 关闭 Feature Flag
  process.env.V55_ENABLED = "false";

  // 2. chaos_pool 数据保留（不删除）
  // 书签本身仍在 inbox，数据一致性不受影响

  // 3. AI 生成的文件夹保留
  // is_ai_generated = true 的文件夹正常使用

  // 4. SmartSorting 恢复全量处理
  // SmartSortingAdapter 检测到 V55_ENABLED=false 后自��恢复

  // 5. 日志记录
  logger.warn("V5.5 Crystal Growth rolled back to SmartSorting only");
}
```

---

## 十三、与现有系统的关键差异总结

| 维度         | 现有系统         | v5.5               | 风险等级 | 缓解措施            |
| ------------ | ---------------- | ------------------ | -------- | ------------------- |
| **创建时机** | 定时批处理       | 实时后台           | 🟢 低    | 异步不阻塞          |
| **用户交互** | Level 2/3 需确认 | 静默自动           | 🟢 低    | 保留 autonomy_level |
| **数据存储** | 仅 inbox         | inbox + chaos_pool | 🟡 中    | chaos_pool 仅存引用 |
| **配额机制** | daily_limit      | 三层弹性           | 🟡 中    | UnifiedQuotaService |
| **命名方式** | 关键词提取       | LLM MECE           | 🟢 低    | 异步 + 降级         |

---

## 附录：autonomy_level 行为矩阵

为保持向后兼容，v5.5 根据 autonomy_level 调整行为：

| Level | 现有行为         | v5.5 行为         | 用户体验  |
| ----- | ---------------- | ----------------- | --------- |
| 1     | 全自动创建       | 静默创建 + 轻通知 | 无变化 ✅ |
| 2     | 创建建议，需确认 | 创建建议，需确认  | 无变化 ✅ |
| 3     | 保守模式，需确认 | 保守模式，需确认  | 无变化 ✅ |

```typescript
// 根据 autonomy_level 决定行为
async processBookmark(userId: string, bookmark: Bookmark) {
  const settings = await this.getAIFolderSettings(userId);
  const autonomyLevel = settings?.autonomy_level ?? 1;  // 默��全自动

  if (autonomyLevel === 1) {
    // 全自动：静默创建
    return this.crystalGrowthService.processInboxBookmark(userId, bookmark);
  } else {
    // 半自动/保守：生成建议，等用户确认（保留现有逻辑）
    return this.smartSortingService.generateSuggestion(userId, bookmark);
  }
}
```
