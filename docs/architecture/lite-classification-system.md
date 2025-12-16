# AnyKeep 轻量化智能分类系统设计

> 专为小样本场景（<10,000 书签）优化的精准分类方案

**版本**: v1.0
**日期**: 2024-12-17
**状态**: 待审核

---

## 1. 设计哲学

### 1.1 小样本场景的本质

| 特点     | 影响             | 应对策略               |
| -------- | ---------------- | ---------------------- |
| 数据稀疏 | 统计不可靠       | **依赖语义，而非统计** |
| 文件夹少 | 分类空间有限     | **全量比对，无需召回** |
| 反馈少   | 无法训练复杂模型 | **规则 > 模型**        |
| 用户稳定 | 行为模式明确     | **少量规则高覆盖**     |

### 1.2 核心原则

```
┌─────────────────────────────────────────────────────────────┐
│                     轻量化设计原则                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. 语义优先：向量相似度 + 名称匹配 > 统计特征              │
│                                                             │
│  2. 规则兜底：少量硬规则覆盖边界情况                        │
│                                                             │
│  3. 即时学习：每次反馈立即生效，无需批量训练                │
│                                                             │
│  4. 简单可解释：用户能理解为什么推荐这个文件夹              │
│                                                             │
│  5. 零配置：开箱即用，无需调参                              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 1.3 与复杂推荐系统的对比

| 维度       | 复杂推荐系统          | 轻量化系统        |
| ---------- | --------------------- | ----------------- |
| **召回**   | 多路召回（5+策略）    | 单路向量召回      |
| **排序**   | 多因素模型（10+特征） | 3因素加权         |
| **校准**   | Platt Scaling         | 直接乘以准确率    |
| **探索**   | Thompson Sampling     | 简单随机（可选）  |
| **学习**   | 批量训练              | 即时更新计数器    |
| **代码量** | ~3000行               | ~500行            |
| **依赖表** | 5+新表                | 1个新表 + 2个字段 |

---

## 2. 系统架构

### 2.1 极简架构图

```
┌─────────────────────────────────────────────────────────────┐
│                    轻量化分类系统                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   输入: 书签 (embedding, tags, source)                      │
│                          │                                  │
│                          ▼                                  │
│              ┌─────────────────────┐                       │
│              │   向量相似度搜索    │  ← folder_profiles     │
│              │  (已有 HNSW 索引)   │     .profile_embedding │
│              └──────────┬──────────┘                       │
│                         │                                  │
│                         ▼                                  │
│              ┌─────────────────────┐                       │
│              │   三因素加权排序    │                       │
│              │  sim × acc × heat   │                       │
│              └──────────┬──────────┘                       │
│                         │                                  │
│                         ▼                                  │
│              ┌─────────────────────┐                       │
│              │    规则过滤/加成    │  ← 负样本排除          │
│              │                     │  ← 标签精确匹配加成    │
│              └──────────┬──────────┘                       │
│                         │                                  │
│                         ▼                                  │
│              ┌─────────────────────┐                       │
│              │    阈值决策        │                        │
│              │  ≥80: 自动分类     │                        │
│              │  ≥60: 建议         │                        │
│              │  <60: 收件箱       │                        │
│              └─────────────────────┘                       │
│                                                             │
│   反馈: 接受/拒绝 → 更新 accept_count/reject_count         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 数据流

```
书签收藏
    │
    ▼
┌─────────────────┐
│ 生成 embedding  │ ← 已有流程
└────────┬────────┘
         │
         ▼
┌─────────────────┐      ┌─────────────────┐
│ 搜索相似文件夹  │ ───▶ │ folder_profiles │
│ (Top 5)         │      │ (已有，无需修改) │
└────────┬────────┘      └─────────────────┘
         │
         ▼
┌─────────────────┐      ┌─────────────────┐
│ 计算最终分数    │ ───▶ │ folder_stats    │
│ score = f(sim,  │      │ (新增，极简)    │
│   accuracy,     │      │ • accept_count  │
│   heat)         │      │ • reject_count  │
└────────┬────────┘      └─────────────────┘
         │
         ▼
┌─────────────────┐
│ 应用规则调整    │
│ • 负样本排除    │
│ • 标签加成      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 输出分类结果    │
└─────────────────┘
```

---

## 3. 核心算法

### 3.1 评分公式（极简版）

```typescript
/**
 * 轻量化评分公式
 *
 * 核心思想：语义相似度为主，准确率和热度为辅
 */
function computeScore(
  similarity: number, // 向量相似度 [0, 1]
  accuracyRate: number, // 文件夹历史准确率 [0, 1]，默认 0.7
  heatScore: number, // 文件夹热度 [0, 1]，默认 0.5
  tagBonus: number = 0, // 标签精确匹配加成 [0, 0.15]
  rejectionPenalty: number = 0, // 拒绝惩罚 [0, 0.3]
): number {
  // 基础分 = 相似度 × 70% + 准确率 × 20% + 热度 × 10%
  const baseScore = similarity * 0.7 + accuracyRate * 0.2 + heatScore * 0.1;

  // 应用加成和惩罚
  const finalScore = baseScore + tagBonus - rejectionPenalty;

  // 归一化到 [0, 1]
  return Math.max(0, Math.min(1, finalScore));
}
```

### 3.2 准确率计算（带衰减）

```typescript
/**
 * 计算文件夹准确率
 *
 * 特点：
 * 1. 样本少时回退到默认值（贝叶斯先验）
 * 2. 近期反馈权重更高（时间衰减）
 */
function computeAccuracyRate(
  acceptCount: number,
  rejectCount: number,
  recentAcceptCount: number, // 近30天
  recentRejectCount: number, // 近30天
): number {
  const total = acceptCount + rejectCount;
  const recentTotal = recentAcceptCount + recentRejectCount;

  // 贝叶斯先验：假设默认准确率 70%，等价于 7 次接受 + 3 次拒绝
  const priorAccept = 7;
  const priorReject = 3;

  // 全量准确率（带先验）
  const overallRate =
    (acceptCount + priorAccept) / (total + priorAccept + priorReject);

  // 近期准确率（如果样本足够）
  if (recentTotal >= 5) {
    const recentRate = recentAcceptCount / recentTotal;
    // 近期权重 60%，全量权重 40%
    return recentRate * 0.6 + overallRate * 0.4;
  }

  return overallRate;
}
```

### 3.3 标签匹配加成

```typescript
/**
 * 标签精确匹配加成
 *
 * 小样本场景下，标签是非常强的信号
 */
function computeTagBonus(
  bookmarkTags: string[],
  folderTopTags: string[],
): number {
  if (!bookmarkTags.length || !folderTopTags.length) return 0;

  const matchCount = bookmarkTags.filter((t) =>
    folderTopTags.includes(t),
  ).length;

  // 每匹配一个标签 +5%，最多 +15%
  return Math.min(0.15, matchCount * 0.05);
}
```

### 3.4 拒绝惩罚（负样本）

```typescript
/**
 * 拒绝惩罚计算
 *
 * 如果用户曾拒绝将某类书签放入此文件夹，降低推荐概率
 */
function computeRejectionPenalty(
  bookmarkSourceId: number | null,
  bookmarkTags: string[],
  folderRejectionPatterns: RejectionPattern[],
): number {
  let penalty = 0;

  for (const pattern of folderRejectionPatterns) {
    // 来源匹配
    if (pattern.type === "source" && pattern.value === bookmarkSourceId) {
      penalty += 0.15 * pattern.weight;
    }
    // 标签匹配
    if (pattern.type === "tag" && bookmarkTags.includes(pattern.value)) {
      penalty += 0.1 * pattern.weight;
    }
  }

  // 最多惩罚 30%
  return Math.min(0.3, penalty);
}
```

### 3.5 决策阈值

```typescript
/**
 * 分类决策
 *
 * 简单三档阈值，无需复杂校准
 */
function makeDecision(
  score: number,
  autoThreshold: number = 0.8, // 自动分类阈值
  suggestThreshold: number = 0.6, // 建议阈值
): ClassificationDecision {
  const confidence = Math.round(score * 100);

  if (score >= autoThreshold) {
    return { action: "auto_classify", confidence };
  }
  if (score >= suggestThreshold) {
    return { action: "suggest", confidence };
  }
  return { action: "to_inbox", confidence };
}
```

---

## 4. 数据库设计（极简）

### 4.1 新增表：folder_stats

```sql
-- 文件夹统计表（极简版）
-- 只存储分类准确率相关的计数器
CREATE TABLE public.folder_stats (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  folder_id BIGINT NOT NULL REFERENCES folders(id) ON DELETE CASCADE,

  -- 总计数
  accept_count INT DEFAULT 0,
  reject_count INT DEFAULT 0,

  -- 近30天计数（定期重算或触发器维护）
  recent_accept_count INT DEFAULT 0,
  recent_reject_count INT DEFAULT 0,

  -- 负样本模式（JSON 数组，最多保留 20 条）
  rejection_patterns JSONB DEFAULT '[]',
  -- [{ "type": "source", "value": 123, "weight": 1.0, "created_at": "..." }, ...]

  -- 时间戳
  last_accept_at TIMESTAMPTZ,
  last_reject_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, folder_id)
);

-- 索引
CREATE INDEX idx_folder_stats_user ON folder_stats(user_id);
CREATE INDEX idx_folder_stats_folder ON folder_stats(folder_id);

-- RLS
ALTER TABLE folder_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY folder_stats_user_policy ON folder_stats
  FOR ALL USING (auth.uid() = user_id);

-- 注释
COMMENT ON TABLE folder_stats IS '文件夹分类统计（轻量化版）';
COMMENT ON COLUMN folder_stats.rejection_patterns IS '负样本模式：记录被拒绝的来源/标签组合';
```

### 4.2 修改：folder_profiles（可选，复用已有字段）

```sql
-- 如果不想新建表，可以直接在 folder_profiles 上添加字段
-- 但建议单独建表，保持职责分离

-- 方案 B：在 folder_profiles 添加字段
ALTER TABLE folder_profiles
ADD COLUMN IF NOT EXISTS accept_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS reject_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS rejection_patterns JSONB DEFAULT '[]';
```

### 4.3 核心函数

#### 4.3.1 记录反馈

```sql
CREATE OR REPLACE FUNCTION record_classification_feedback(
  p_user_id UUID,
  p_folder_id BIGINT,
  p_is_accepted BOOLEAN,
  p_bookmark_source_id BIGINT DEFAULT NULL,
  p_bookmark_tags TEXT[] DEFAULT '{}'
) RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_patterns JSONB;
  v_new_pattern JSONB;
BEGIN
  -- 1. 更新计数器
  INSERT INTO folder_stats (user_id, folder_id, accept_count, reject_count, last_accept_at, last_reject_at)
  VALUES (
    p_user_id,
    p_folder_id,
    CASE WHEN p_is_accepted THEN 1 ELSE 0 END,
    CASE WHEN p_is_accepted THEN 0 ELSE 1 END,
    CASE WHEN p_is_accepted THEN NOW() ELSE NULL END,
    CASE WHEN NOT p_is_accepted THEN NOW() ELSE NULL END
  )
  ON CONFLICT (user_id, folder_id) DO UPDATE SET
    accept_count = folder_stats.accept_count + CASE WHEN p_is_accepted THEN 1 ELSE 0 END,
    reject_count = folder_stats.reject_count + CASE WHEN p_is_accepted THEN 0 ELSE 1 END,
    recent_accept_count = folder_stats.recent_accept_count + CASE WHEN p_is_accepted THEN 1 ELSE 0 END,
    recent_reject_count = folder_stats.recent_reject_count + CASE WHEN p_is_accepted THEN 0 ELSE 1 END,
    last_accept_at = CASE WHEN p_is_accepted THEN NOW() ELSE folder_stats.last_accept_at END,
    last_reject_at = CASE WHEN NOT p_is_accepted THEN NOW() ELSE folder_stats.last_reject_at END,
    updated_at = NOW();

  -- 2. 如果是拒绝，记录负样本模式
  IF NOT p_is_accepted THEN
    SELECT rejection_patterns INTO v_patterns
    FROM folder_stats
    WHERE user_id = p_user_id AND folder_id = p_folder_id;

    -- 添加来源模式
    IF p_bookmark_source_id IS NOT NULL THEN
      v_new_pattern := jsonb_build_object(
        'type', 'source',
        'value', p_bookmark_source_id,
        'weight', 1.0,
        'created_at', NOW()
      );

      -- 检查是否已存在，存在则增加权重
      IF EXISTS (
        SELECT 1 FROM jsonb_array_elements(v_patterns) elem
        WHERE elem->>'type' = 'source' AND (elem->>'value')::BIGINT = p_bookmark_source_id
      ) THEN
        v_patterns := (
          SELECT jsonb_agg(
            CASE
              WHEN elem->>'type' = 'source' AND (elem->>'value')::BIGINT = p_bookmark_source_id
              THEN jsonb_set(elem, '{weight}', to_jsonb(LEAST((elem->>'weight')::FLOAT + 0.5, 3.0)))
              ELSE elem
            END
          )
          FROM jsonb_array_elements(v_patterns) elem
        );
      ELSE
        v_patterns := v_patterns || jsonb_build_array(v_new_pattern);
      END IF;
    END IF;

    -- 添加标签模式（取前2个标签）
    IF array_length(p_bookmark_tags, 1) > 0 THEN
      FOR i IN 1..LEAST(array_length(p_bookmark_tags, 1), 2) LOOP
        v_new_pattern := jsonb_build_object(
          'type', 'tag',
          'value', p_bookmark_tags[i],
          'weight', 0.5,
          'created_at', NOW()
        );

        IF NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements(v_patterns) elem
          WHERE elem->>'type' = 'tag' AND elem->>'value' = p_bookmark_tags[i]
        ) THEN
          v_patterns := v_patterns || jsonb_build_array(v_new_pattern);
        END IF;
      END LOOP;
    END IF;

    -- 限制最多 20 条模式（保留权重最高的）
    IF jsonb_array_length(v_patterns) > 20 THEN
      v_patterns := (
        SELECT jsonb_agg(elem ORDER BY (elem->>'weight')::FLOAT DESC)
        FROM (
          SELECT elem
          FROM jsonb_array_elements(v_patterns) elem
          ORDER BY (elem->>'weight')::FLOAT DESC
          LIMIT 20
        ) t
      );
    END IF;

    -- 更新
    UPDATE folder_stats
    SET rejection_patterns = v_patterns
    WHERE user_id = p_user_id AND folder_id = p_folder_id;
  END IF;
END;
$$;
```

#### 4.3.2 获取分类候选

```sql
CREATE OR REPLACE FUNCTION get_lite_classification_candidates(
  p_user_id UUID,
  p_embedding vector(1024),
  p_tags TEXT[] DEFAULT '{}',
  p_source_id BIGINT DEFAULT NULL,
  p_limit INT DEFAULT 5
) RETURNS TABLE (
  folder_id BIGINT,
  folder_name VARCHAR,
  similarity FLOAT,
  accuracy_rate FLOAT,
  heat_score FLOAT,
  top_tags TEXT[],
  rejection_patterns JSONB
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    fp.folder_id,
    f.name as folder_name,
    (1 - (fp.profile_embedding <=> p_embedding))::FLOAT as similarity,
    -- 准确率计算（带贝叶斯先验）
    COALESCE(
      (COALESCE(fs.accept_count, 0) + 7)::FLOAT /
      (COALESCE(fs.accept_count, 0) + COALESCE(fs.reject_count, 0) + 10),
      0.7
    )::FLOAT as accuracy_rate,
    COALESCE(fp.heat_score / 100.0, 0.5)::FLOAT as heat_score,
    fp.top_tags,
    COALESCE(fs.rejection_patterns, '[]'::JSONB) as rejection_patterns
  FROM folder_profiles fp
  JOIN folders f ON f.id = fp.folder_id
  LEFT JOIN folder_stats fs ON fs.user_id = fp.user_id AND fs.folder_id = fp.folder_id
  WHERE fp.user_id = p_user_id
    AND fp.profile_embedding IS NOT NULL
    AND f.is_system = false  -- 排除系统文件夹
  ORDER BY fp.profile_embedding <=> p_embedding
  LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION get_lite_classification_candidates IS '轻量化分类候选获取：向量搜索 + 准确率 + 热度';
```

#### 4.3.3 定期重置近期计数

```sql
-- 每周运行一次，重置近期计数
CREATE OR REPLACE FUNCTION reset_recent_folder_stats()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE folder_stats
  SET
    recent_accept_count = 0,
    recent_reject_count = 0,
    updated_at = NOW()
  WHERE updated_at < NOW() - INTERVAL '30 days';
END;
$$;

-- 或者用更精确的方式：基于 learning_events 重新计算
-- 但为了轻量化，简单重置即可
```

---

## 5. 服务层实现

### 5.1 LiteClassificationService

```typescript
// src/lib/classification/lite/lite-classification.service.ts

import { SupabaseClient } from "@supabase/supabase-js";

interface ClassificationCandidate {
  folder_id: number;
  folder_name: string;
  similarity: number;
  accuracy_rate: number;
  heat_score: number;
  top_tags: string[];
  rejection_patterns: RejectionPattern[];
}

interface RejectionPattern {
  type: "source" | "tag";
  value: string | number;
  weight: number;
}

interface ClassificationResult {
  action: "auto_classify" | "suggest" | "to_inbox";
  folderId?: number;
  folderName?: string;
  confidence: number;
  reason: string;
  candidates: ScoredCandidate[];
}

interface ScoredCandidate {
  folderId: number;
  folderName: string;
  score: number;
  breakdown: {
    similarity: number;
    accuracyRate: number;
    heatScore: number;
    tagBonus: number;
    rejectionPenalty: number;
  };
}

export class LiteClassificationService {
  // 配置常量
  private readonly AUTO_THRESHOLD = 0.8;
  private readonly SUGGEST_THRESHOLD = 0.6;
  private readonly WEIGHTS = {
    similarity: 0.7,
    accuracy: 0.2,
    heat: 0.1,
  };

  constructor(private supabase: SupabaseClient) {}

  /**
   * 分类书签（轻量化版）
   */
  async classify(
    userId: string,
    bookmark: {
      embedding: number[];
      tags: string[];
      sourceId?: number;
    },
  ): Promise<ClassificationResult> {
    // 1. 获取候选文件夹
    const { data: candidates, error } = await this.supabase.rpc(
      "get_lite_classification_candidates",
      {
        p_user_id: userId,
        p_embedding: bookmark.embedding,
        p_tags: bookmark.tags,
        p_source_id: bookmark.sourceId,
        p_limit: 5,
      },
    );

    if (error) throw error;
    if (!candidates || candidates.length === 0) {
      return {
        action: "to_inbox",
        confidence: 0,
        reason: "没有找到合适的文件夹",
        candidates: [],
      };
    }

    // 2. 计算最终分数
    const scoredCandidates = candidates.map((c: ClassificationCandidate) =>
      this.scoreCandidate(c, bookmark.tags, bookmark.sourceId),
    );

    // 3. 排序
    scoredCandidates.sort((a, b) => b.score - a.score);

    // 4. 决策
    const top = scoredCandidates[0];
    const decision = this.makeDecision(top.score);

    return {
      action: decision.action,
      folderId: decision.action !== "to_inbox" ? top.folderId : undefined,
      folderName: decision.action !== "to_inbox" ? top.folderName : undefined,
      confidence: decision.confidence,
      reason: this.generateReason(top, decision.action),
      candidates: scoredCandidates.slice(0, 3),
    };
  }

  /**
   * 计算单个候选的分数
   */
  private scoreCandidate(
    candidate: ClassificationCandidate,
    bookmarkTags: string[],
    bookmarkSourceId?: number,
  ): ScoredCandidate {
    // 标签加成
    const tagBonus = this.computeTagBonus(bookmarkTags, candidate.top_tags);

    // 拒绝惩罚
    const rejectionPenalty = this.computeRejectionPenalty(
      bookmarkSourceId,
      bookmarkTags,
      candidate.rejection_patterns,
    );

    // 基础分
    const baseScore =
      candidate.similarity * this.WEIGHTS.similarity +
      candidate.accuracy_rate * this.WEIGHTS.accuracy +
      candidate.heat_score * this.WEIGHTS.heat;

    // 最终分
    const score = Math.max(
      0,
      Math.min(1, baseScore + tagBonus - rejectionPenalty),
    );

    return {
      folderId: candidate.folder_id,
      folderName: candidate.folder_name,
      score,
      breakdown: {
        similarity: candidate.similarity,
        accuracyRate: candidate.accuracy_rate,
        heatScore: candidate.heat_score,
        tagBonus,
        rejectionPenalty,
      },
    };
  }

  /**
   * 标签匹配加成
   */
  private computeTagBonus(
    bookmarkTags: string[],
    folderTags: string[],
  ): number {
    if (!bookmarkTags?.length || !folderTags?.length) return 0;
    const matchCount = bookmarkTags.filter((t) =>
      folderTags.includes(t),
    ).length;
    return Math.min(0.15, matchCount * 0.05);
  }

  /**
   * 拒绝惩罚
   */
  private computeRejectionPenalty(
    sourceId: number | undefined,
    tags: string[],
    patterns: RejectionPattern[],
  ): number {
    if (!patterns?.length) return 0;

    let penalty = 0;
    for (const pattern of patterns) {
      if (pattern.type === "source" && pattern.value === sourceId) {
        penalty += 0.15 * pattern.weight;
      }
      if (pattern.type === "tag" && tags.includes(pattern.value as string)) {
        penalty += 0.1 * pattern.weight;
      }
    }
    return Math.min(0.3, penalty);
  }

  /**
   * 决策
   */
  private makeDecision(score: number): {
    action: "auto_classify" | "suggest" | "to_inbox";
    confidence: number;
  } {
    const confidence = Math.round(score * 100);
    if (score >= this.AUTO_THRESHOLD) {
      return { action: "auto_classify", confidence };
    }
    if (score >= this.SUGGEST_THRESHOLD) {
      return { action: "suggest", confidence };
    }
    return { action: "to_inbox", confidence };
  }

  /**
   * 生成可解释的理由
   */
  private generateReason(candidate: ScoredCandidate, action: string): string {
    const { breakdown } = candidate;
    const parts: string[] = [];

    if (breakdown.similarity > 0.7) {
      parts.push("内容高度相似");
    } else if (breakdown.similarity > 0.5) {
      parts.push("内容相似");
    }

    if (breakdown.tagBonus > 0) {
      parts.push("标签匹配");
    }

    if (breakdown.accuracyRate > 0.8) {
      parts.push("该文件夹准确率高");
    }

    if (breakdown.rejectionPenalty > 0) {
      parts.push("(存在历史拒绝记录)");
    }

    if (action === "to_inbox") {
      return "未找到足够匹配的文件夹";
    }

    return parts.join("，") || "综合评分最高";
  }

  /**
   * 记录反馈（即时生效）
   */
  async recordFeedback(
    userId: string,
    folderId: number,
    isAccepted: boolean,
    bookmarkSourceId?: number,
    bookmarkTags?: string[],
  ): Promise<void> {
    const { error } = await this.supabase.rpc(
      "record_classification_feedback",
      {
        p_user_id: userId,
        p_folder_id: folderId,
        p_is_accepted: isAccepted,
        p_bookmark_source_id: bookmarkSourceId,
        p_bookmark_tags: bookmarkTags || [],
      },
    );

    if (error) throw error;
  }
}
```

### 5.2 使用示例

```typescript
// 使用示例
const liteService = new LiteClassificationService(supabase);

// 分类
const result = await liteService.classify(userId, {
  embedding: bookmarkEmbedding,
  tags: ["技术", "React"],
  sourceId: 123,
});

console.log(result);
// {
//   action: 'auto_classify',
//   folderId: 456,
//   folderName: '前端技术',
//   confidence: 85,
//   reason: '内容高度相似，标签匹配',
//   candidates: [...]
// }

// 记录反馈
await liteService.recordFeedback(
  userId,
  456, // folderId
  true, // 接受
  123, // sourceId
  ["技术", "React"], // tags
);
```

---

## 6. 与现有系统的对比

### 6.1 代码量对比

| 模块           | 原方案  | 轻量化方案 | 简化比例 |
| -------------- | ------- | ---------- | -------- |
| 数据库表       | 5个新表 | 1个新表    | 80% ↓    |
| SQL函数        | 8个     | 3个        | 62% ↓    |
| 服务类         | 6个     | 1个        | 83% ↓    |
| TypeScript代码 | ~3000行 | ~300行     | 90% ↓    |
| 配置项         | 20+     | 3          | 85% ↓    |

### 6.2 功能对比

| 功能       | 原方案           | 轻量化方案  | 说明           |
| ---------- | ---------------- | ----------- | -------------- |
| 向量相似度 | ✅               | ✅          | 相同           |
| 准确率追踪 | ✅ 复杂统计      | ✅ 简单计数 | 简化但够用     |
| 负样本学习 | ✅ 复杂模式      | ✅ JSON数组 | 简化但够用     |
| 置信度校准 | ✅ Platt Scaling | ❌          | 小样本下不需要 |
| 探索-利用  | ✅ Thompson      | ❌          | 小样本下不需要 |
| 多路召回   | ✅ 5路           | ❌          | 全量比对即可   |
| 实时特征   | ✅ 会话级        | ⚠️ 热度     | 简化           |
| 可解释性   | ⚠️ 复杂          | ✅ 简单     | 更易理解       |

### 6.3 预期效果对比

| 指标       | 原方案目标 | 轻量化目标 | 说明         |
| ---------- | ---------- | ---------- | ------------ |
| 分类准确率 | 85%        | 80%        | 略低但足够   |
| 开发时间   | 8周        | 2周        | 75% ↓        |
| 维护成本   | 高         | 低         | 代码少=bug少 |
| 迭代速度   | 慢         | 快         | 简单=易改    |

---

## 7. 实施计划

### 7.1 一周完成计划

| 天    | 任务                                         | 产出            |
| ----- | -------------------------------------------- | --------------- |
| Day 1 | 创建 folder_stats 表 + 索引 + RLS            | 数据库迁移文件  |
| Day 2 | 实现 record_classification_feedback 函数     | SQL 函数        |
| Day 3 | 实现 get_lite_classification_candidates 函数 | SQL 函数        |
| Day 4 | 实现 LiteClassificationService               | TypeScript 服务 |
| Day 5 | 集成到现有 API + 测试                        | 完整可用        |

### 7.2 迁移策略

```typescript
// 特性开关：渐进式迁移
const USE_LITE_CLASSIFICATION = process.env.USE_LITE_CLASSIFICATION === "true";

async function classifyBookmark(userId: string, bookmark: Bookmark) {
  if (USE_LITE_CLASSIFICATION) {
    return liteClassificationService.classify(userId, bookmark);
  } else {
    return existingClassificationService.classify(userId, bookmark);
  }
}
```

### 7.3 回退方案

如果轻量化方案效果不佳：

1. 关闭特性开关，回退到原系统
2. 分析失败案例，针对性优化
3. 考虑混合方案：简单场景用轻量化，复杂场景用原方案

---

## 8. 后续优化方向

### 8.1 如果准确率不达标

```typescript
// 优化 1：增加语义匹配维度
score =
  similarity * 0.5 + // 降低向量权重
  nameMatchScore * 0.2 + // 增加文件夹名称匹配
  accuracy * 0.2 +
  heat * 0.1;

// 优化 2：来源画像加成
if (sourceProfile.preferredFolderIds.includes(folderId)) {
  score += 0.1;
}

// 优化 3：时间上下文
if (isWorkingHours && folder.category === "work") {
  score += 0.05;
}
```

### 8.2 如果需要更强的学习能力

```typescript
// 可选升级：简单的在线学习
class SimpleLearner {
  // 每 100 次反馈后，重新计算权重
  async maybeUpdateWeights(userId: string) {
    const stats = await this.getStats(userId);
    if (stats.totalFeedback % 100 === 0) {
      // 简单的权重调整
      if (stats.rejectRate > 0.3) {
        this.weights.similarity += 0.05;
        this.weights.accuracy -= 0.05;
      }
    }
  }
}
```

### 8.3 功能扩展路径

```
Level 1 (当前):
  向量 + 准确率 + 热度 + 负样本

Level 2 (如果需要):
  + 文件夹名称语义匹配
  + 来源画像偏好

Level 3 (如果还需要):
  + 简单在线学习
  + 时间上下文

Level 4 (大样本场景):
  回到原方案的复杂推荐系统
```

---

## 9. 总结

### 9.1 轻量化方案的核心优势

| 优势           | 说明                            |
| -------------- | ------------------------------- |
| **简单**       | 300行代码 vs 3000行，维护成本低 |
| **快速**       | 1-2周完成 vs 8周                |
| **可解释**     | 用户能理解推荐理由              |
| **即时生效**   | 反馈立即影响下次分类            |
| **低风险**     | 简单逻辑，不易出错              |
| **适合小样本** | 不依赖大数据统计                |

### 9.2 适用场景

✅ **适合**：

- 单用户书签 < 10,000
- 文件夹数量 < 100
- 追求快速迭代
- 团队规模小

❌ **不适合**：

- 需要跨用户协同过滤
- 书签量 > 100,000
- 需要复杂的个性化策略

### 9.3 决策建议

```
如果你追求：
├── 快速上线 → 选择轻量化方案 ✓
├── 极致准确率 → 选择原方案
├── 平衡方案 → 先用轻量化，后续按需升级
└── 验证想法 → 轻量化方案足够 ✓
```

---

**文档结束**

请审核此轻量化方案，如有问题或需要调整，请告知。
