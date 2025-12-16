# AnyKeep 智能分类系统优化方案

> 借鉴推荐系统原理，全面提升分类准确率和用户体验

**版本**: v1.0
**日期**: 2024-12-17
**状态**: 待审核

---

## 目录

1. [执行摘要](#1-执行摘要)
2. [现状分析](#2-现状分析)
3. [推荐系统原理借鉴](#3-推荐系统原理借鉴)
4. [优化方案设计](#4-优化方案设计)
5. [数据库设计](#5-数据库设计)
6. [服务层设计](#6-服务层设计)
7. [实施路线图](#7-实施路线图)
8. [风险评估](#8-风险评估)
9. [成功指标](#9-成功指标)

---

## 1. 执行摘要

### 1.1 核心洞察

AnyKeep 的智能分类本质上是一个**逆向推荐系统**：

- 传统推荐：Item → User（推荐内容给用户）
- AnyKeep：Item → Folder（推荐分类给内容）

### 1.2 当前系统评估

| 模块          | 完成度 | 主要差距                         |
| ------------- | ------ | -------------------------------- |
| 文件夹向量化  | 95%    | 缺少增量更新触发器               |
| 反馈闭环      | 70%    | 学习事件未持久化、数据关联不完整 |
| 在线学习      | 40%    | 仅内存缓存、无自动化流程         |
| 置信度校准    | 20%    | 有数据无分析                     |
| 探索-利用平衡 | 0%     | 未实现                           |

### 1.3 优化目标

| 指标         | 当前值 | 目标值 | 提升 |
| ------------ | ------ | ------ | ---- |
| 分类准确率   | ~65%   | 85%+   | +20% |
| 用户确认率   | ~50%   | 75%+   | +25% |
| 建议采纳率   | ~40%   | 65%+   | +25% |
| 冷启动准确率 | ~30%   | 60%+   | +30% |

---

## 2. 现状分析

### 2.1 文件夹向量化系统 ✅ 基本完善

```
已实现:
├── profile_embedding (1024维) - 文件夹内容聚合向量
├── name_embedding (1024维) - 文件夹名称向量（冷启动）
├── core_embedding - 聚类中心向量
├── edge_embedding - 边界点向量
├── 加权平均: name(30%) + content(70%)
├── HNSW 向量索引
├── search_folders_unified() 统一搜索
└── 版本追踪系统

缺失:
├── 增量更新触发器（书签变动自动更新）
├── 向量质量监控
└── 向量漂移检测
```

### 2.2 反馈闭环系统 ⚠️ 需要完善

```
已实现:
├── classification_suggestions - 建议存储
├── classification_feedback - 用户反馈
├── classification_outcomes - 准确率追踪
├── classification_decisions - 决策上下文
├── FeedbackLoopService - 反馈处理
├── PreferenceLearner - 偏好学习
├── LearningEventHandler - 事件监听
└── NegativeSampleService - 负样本学习

缺失:
├── 学习事件持久化表
├── feedback ↔ outcomes 关联
├── 自动化处理流程
├── 置信度校准分析
└── 用户可见的优化效果
```

### 2.3 推荐系统核心组件对比

| 推荐系统组件         | AnyKeep 现状           | 差距评估 |
| -------------------- | ---------------------- | -------- |
| 召回层 (Recall)      | ✅ 向量搜索 + 规则匹配 | 完整     |
| 粗排层 (Pre-ranking) | ⚠️ 简单阈值过滤        | 需增强   |
| 精排层 (Ranking)     | ⚠️ 单一置信度排序      | 需多因素 |
| 重排层 (Re-ranking)  | ❌ 无                  | 需新建   |
| 实时特征             | ⚠️ 部分（热度）        | 需补充   |
| 用户画像             | ⚠️ 来源画像            | 需扩展   |
| 反馈闭环             | ⚠️ 70%完成             | 需完善   |

---

## 3. 推荐系统原理借鉴

### 3.1 双塔模型 (Two-Tower Model)

**原理**：将用户和物品分别编码为向量，通过向量相似度计算匹配分数。

**应用到 AnyKeep**：

```
┌─────────────────┐         ┌─────────────────┐
│   书签塔        │         │   文件夹塔      │
│   (Item Tower)  │         │  (Folder Tower) │
├─────────────────┤         ├─────────────────┤
│ • 内容 embedding│         │ • profile_embedding
│ • 标题 embedding│         │ • name_embedding │
│ • 标签特征      │         │ • 热度特征      │
│ • 来源特征      │         │ • 使用频率      │
│ • 时间特征      │         │ • 用户偏好权重  │
└────────┬────────┘         └────────┬────────┘
         │                           │
         └───────────┬───────────────┘
                     │
              ┌──────▼──────┐
              │  多因素融合  │
              │  排序模型   │
              └──────┬──────┘
                     │
              ┌──────▼──────┐
              │  最终推荐   │
              └─────────────┘
```

### 3.2 多目标排序 (Multi-Objective Ranking)

**原理**：综合多个目标函数，平衡准确性、多样性、新颖性。

**应用到 AnyKeep**：

```typescript
// 当前：单一目标
score = similarity;

// 优化后：多目标融合
score =
  w1 * similarity + // 内容相似度
  w2 * folder_accuracy + // 文件夹历史准确率
  w3 * folder_heat + // 文件夹热度（活跃度）
  w4 * user_preference + // 用户对该文件夹的偏好
  w5 * freshness - // 文件夹新鲜度（避免僵尸文件夹）
  w6 * rejection_penalty; // 该书签特征被拒绝的惩罚
```

### 3.3 置信度校准 (Confidence Calibration)

**原理**：模型输出的置信度应该与实际准确率一致。

**问题示例**：

```
模型说 90% 置信度的预测，实际只有 70% 准确率
→ 模型过于自信，需要校准
```

**校准方法**：

```typescript
// Platt Scaling 或 温度缩放
calibrated_confidence = sigmoid(a * raw_confidence + b);

// 参数 a, b 通过历史数据拟合
// 目标：calibrated_confidence ≈ actual_accuracy
```

### 3.4 探索-利用平衡 (Exploration-Exploitation)

**原理**：在"选择已知最优"和"尝试新选项"之间平衡。

**应用到 AnyKeep**：

```typescript
// 问题：总是推荐高置信度的老文件夹
//      新创建的文件夹永远得不到机会

// 解决：Epsilon-Greedy 或 Thompson Sampling
if (random() < epsilon) {
  // 探索：给低置信度但合理的文件夹一个机会
  return sampleFromCandidates(candidates, exploration_weight);
} else {
  // 利用：选择最高置信度的文件夹
  return candidates[0];
}
```

### 3.5 实时特征 (Real-time Features)

**原理**：利用用户当前会话的行为信号。

**应用到 AnyKeep**：

```typescript
// 会话级特征
session_features = {
  recent_folders: [最近10分钟操作的文件夹],
  recent_tags: [最近收藏内容的标签],
  current_context: "工作" | "学习" | "娱乐",
  time_of_day: "morning" | "afternoon" | "evening",
};

// 融入排序
score += w * session_relevance(folder, session_features);
```

---

## 4. 优化方案设计

### 4.1 整体架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                        智能分类系统 V5.0                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐           │
│  │  召回层  │→│  粗排层  │→│  精排层  │→│  重排层  │           │
│  │ Recall   │  │Pre-rank  │  │ Ranking  │  │Re-rank   │           │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘           │
│       │             │             │             │                  │
│       ▼             ▼             ▼             ▼                  │
│  ┌─────────────────────────────────────────────────────┐           │
│  │                   特征服务层                         │           │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐   │           │
│  │  │书签特征 │ │文件夹特征│ │用户特征 │ │会话特征 │   │           │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘   │           │
│  └─────────────────────────────────────────────────────┘           │
│                              │                                      │
│                              ▼                                      │
│  ┌─────────────────────────────────────────────────────┐           │
│  │                   反馈闭环层                         │           │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐   │           │
│  │  │事件采集 │→│学习引擎 │→│模型更新 │→│效果评估 │   │           │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘   │           │
│  └─────────────────────────────────────────────────────┘           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.2 模块详细设计

#### 4.2.1 召回层增强

**当前**：向量搜索 + 规则匹配

**优化**：多路召回融合

```typescript
interface RecallStrategy {
  name: string;
  weight: number;
  recall(bookmark: Bookmark, limit: number): Promise<FolderCandidate[]>;
}

// 召回策略
const strategies: RecallStrategy[] = [
  { name: "vector_similarity", weight: 0.4, recall: vectorRecall },
  { name: "tag_matching", weight: 0.2, recall: tagRecall },
  { name: "source_history", weight: 0.2, recall: sourceHistoryRecall },
  { name: "recent_usage", weight: 0.1, recall: recentUsageRecall },
  { name: "collaborative", weight: 0.1, recall: collaborativeRecall },
];

// 融合召回结果
function multiRecall(bookmark: Bookmark): FolderCandidate[] {
  const allCandidates = await Promise.all(
    strategies.map((s) => s.recall(bookmark, 20)),
  );
  return mergeAndDedupe(
    allCandidates,
    strategies.map((s) => s.weight),
  );
}
```

#### 4.2.2 精排层：多因素排序模型

```typescript
interface RankingFeatures {
  // 相似度特征
  vector_similarity: number; // 向量余弦相似度
  name_similarity: number; // 名称语义相似度
  tag_overlap: number; // 标签重叠率

  // 文件夹特征
  folder_accuracy: number; // 该文件夹历史准确率
  folder_heat: number; // 文件夹热度 (0-100)
  folder_size: number; // 文件夹书签数量
  folder_freshness: number; // 最近使用时间衰减

  // 用户偏好特征
  user_folder_preference: number; // 用户对该文件夹的偏好度
  user_tag_affinity: number; // 用户对该标签组合的亲和度

  // 负向特征
  rejection_count: number; // 该特征组合被拒绝次数
  similar_rejection: number; // 相似书签被拒绝到该文件夹的次数
}

// 排序模型（初期使用线性模型，后期可升级为 GBDT/NN）
function rankScore(features: RankingFeatures): number {
  const weights = {
    vector_similarity: 0.25,
    folder_accuracy: 0.2,
    folder_heat: 0.1,
    user_folder_preference: 0.15,
    tag_overlap: 0.1,
    folder_freshness: 0.05,
    rejection_penalty: -0.15, // 负权重
  };

  return Object.entries(weights).reduce((score, [key, weight]) => {
    return score + weight * (features[key] || 0);
  }, 0);
}
```

#### 4.2.3 重排层：多样性和探索

```typescript
interface ReRankingConfig {
  // 多样性控制
  diversity_weight: number; // 多样性权重 (0-1)
  max_same_parent: number; // 同一父文件夹最多推荐几个

  // 探索控制
  exploration_rate: number; // 探索率 (epsilon)
  new_folder_boost: number; // 新文件夹加成
  cold_start_threshold: number; // 冷启动阈值（书签数）
}

function reRank(
  candidates: RankedCandidate[],
  config: ReRankingConfig,
): RankedCandidate[] {
  // 1. 多样性过滤：避免同类文件夹霸榜
  let diverse = applyDiversity(candidates, config);

  // 2. 探索注入：给新/冷门文件夹机会
  if (Math.random() < config.exploration_rate) {
    diverse = injectExploration(diverse, config);
  }

  // 3. 冷启动加成：新文件夹需要更多曝光
  diverse = applyColdStartBoost(diverse, config);

  return diverse;
}
```

#### 4.2.4 置信度校准系统

```typescript
interface CalibrationBucket {
  confidence_range: [number, number]; // e.g., [80, 90]
  prediction_count: number;
  correct_count: number;
  actual_accuracy: number;
}

class ConfidenceCalibrator {
  private buckets: CalibrationBucket[];
  private calibrationParams: { a: number; b: number };

  // 更新校准数据
  async updateFromFeedback(
    predictedConfidence: number,
    isCorrect: boolean,
  ): Promise<void> {
    const bucket = this.findBucket(predictedConfidence);
    bucket.prediction_count++;
    if (isCorrect) bucket.correct_count++;
    bucket.actual_accuracy = bucket.correct_count / bucket.prediction_count;

    // 定期重新拟合校准参数
    if (this.shouldRefit()) {
      await this.fitCalibrationParams();
    }
  }

  // 校准置信度
  calibrate(rawConfidence: number): number {
    const { a, b } = this.calibrationParams;
    return sigmoid(a * rawConfidence + b);
  }

  // 获取校准报告
  getCalibrationReport(): CalibrationReport {
    return {
      buckets: this.buckets,
      expectedCalibrationError: this.computeECE(),
      isWellCalibrated: this.computeECE() < 0.05,
    };
  }
}
```

### 4.3 反馈闭环完善

#### 4.3.1 数据采集完整链路

```
用户操作
    │
    ├── 接受建议 ──────────────────────────┐
    │                                      │
    ├── 拒绝建议 ──────────────────────────┤
    │                                      │
    ├── 修改分类（选择其他文件夹）──────────┤
    │                                      │
    ├── 手动移动书签 ──────────────────────┤
    │                                      │
    ├── 删除书签 ──────────────────────────┤
    │                                      ▼
    │                           ┌──────────────────┐
    │                           │  learning_events │
    │                           │  (持久化存储)    │
    │                           └────────┬─────────┘
    │                                    │
    └── 忽略建议（7天过期）───────────────┤
                                         │
                                         ▼
                              ┌─────────────────────┐
                              │   学习引擎处理      │
                              ├─────────────────────┤
                              │ • 更新文件夹准确率  │
                              │ • 更新用户偏好      │
                              │ • 更新负样本库      │
                              │ • 触发权重调整      │
                              │ • 更新校准参数      │
                              └─────────────────────┘
```

#### 4.3.2 学习信号权重

```typescript
const LEARNING_SIGNAL_WEIGHTS = {
  // 强信号（用户明确表态）
  explicit_accept: 1.0, // 明确接受
  explicit_reject: 1.0, // 明确拒绝
  explicit_modify: 0.9, // 修改为其他文件夹

  // 中等信号（用户行为推断）
  manual_move: 0.7, // 手动移动（可能是纠错）
  quick_accept: 0.6, // 快速接受（<3秒，可能未仔细看）

  // 弱信号（隐式反馈）
  ignore_then_manual: 0.5, // 忽略后手动分类
  long_dwell_accept: 0.8, // 长时间查看后接受
  delete_after_classify: 0.3, // 分类后删除（可能内容问题，非分类问题）

  // 负向信号
  repeated_rejection: 1.5, // 重复拒绝同一模式（加重惩罚）
  undo_accept: 1.2, // 接受后撤销
};
```

---

## 5. 数据库设计

### 5.1 新增表

#### 5.1.1 learning_events（学习事件持久化）

```sql
-- 学习事件表：持久化所有用户反馈和行为
CREATE TABLE public.learning_events (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 事件类型
  event_type VARCHAR(50) NOT NULL,
  -- classification_confirmed | classification_rejected | classification_modified
  -- manual_move | bookmark_deleted | suggestion_ignored | undo_action

  -- 关联实体
  bookmark_id BIGINT REFERENCES bookmarks(id) ON DELETE SET NULL,
  suggestion_id BIGINT REFERENCES classification_suggestions(id) ON DELETE SET NULL,
  outcome_id BIGINT REFERENCES classification_outcomes(id) ON DELETE SET NULL,

  -- 文件夹信息
  original_folder_id BIGINT REFERENCES folders(id) ON DELETE SET NULL,
  target_folder_id BIGINT REFERENCES folders(id) ON DELETE SET NULL,
  predicted_folder_id BIGINT REFERENCES folders(id) ON DELETE SET NULL,

  -- 预测信息
  predicted_confidence SMALLINT,  -- 0-100

  -- 上下文
  signal_weight DECIMAL(3,2) DEFAULT 1.0,  -- 学习信号权重
  context JSONB DEFAULT '{}',
  -- { source_id, tags, time_to_decision_ms, session_id, ... }

  -- 时间戳
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- 索引
  CONSTRAINT chk_event_type CHECK (event_type IN (
    'classification_confirmed', 'classification_rejected', 'classification_modified',
    'manual_move', 'bookmark_deleted', 'suggestion_ignored', 'undo_action'
  ))
);

-- 索引
CREATE INDEX idx_learning_events_user ON learning_events(user_id);
CREATE INDEX idx_learning_events_type ON learning_events(event_type);
CREATE INDEX idx_learning_events_time ON learning_events(user_id, created_at DESC);
CREATE INDEX idx_learning_events_folder ON learning_events(target_folder_id);
CREATE INDEX idx_learning_events_context ON learning_events USING GIN (context);

-- RLS
ALTER TABLE learning_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY learning_events_user_policy ON learning_events
  FOR ALL USING (auth.uid() = user_id);
```

#### 5.1.2 folder_accuracy_stats（文件夹准确率统计）

```sql
-- 文件夹准确率统计表（物化视图的持久化版本）
CREATE TABLE public.folder_accuracy_stats (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  folder_id BIGINT NOT NULL REFERENCES folders(id) ON DELETE CASCADE,

  -- 基础统计
  total_predictions INT DEFAULT 0,
  correct_predictions INT DEFAULT 0,
  rejected_predictions INT DEFAULT 0,
  modified_predictions INT DEFAULT 0,

  -- 准确率
  accuracy_rate DECIMAL(5,4),  -- 0.0000-1.0000

  -- 置信度分层统计
  stats_by_confidence JSONB DEFAULT '{}',
  -- { "70-80": { total: 10, correct: 7 }, "80-90": { total: 20, correct: 18 }, ... }

  -- 时间衰减统计（近30天）
  recent_total INT DEFAULT 0,
  recent_correct INT DEFAULT 0,
  recent_accuracy_rate DECIMAL(5,4),

  -- 元数据
  last_prediction_at TIMESTAMPTZ,
  computed_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, folder_id)
);

-- 索引
CREATE INDEX idx_folder_accuracy_user ON folder_accuracy_stats(user_id);
CREATE INDEX idx_folder_accuracy_rate ON folder_accuracy_stats(user_id, accuracy_rate DESC);
```

#### 5.1.3 confidence_calibration（置信度校准）

```sql
-- 置信度校准表
CREATE TABLE public.confidence_calibration (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 校准桶
  confidence_bucket VARCHAR(10) NOT NULL,  -- '0-50', '50-60', '60-70', '70-80', '80-90', '90-100'

  -- 统计
  prediction_count INT DEFAULT 0,
  correct_count INT DEFAULT 0,
  actual_accuracy DECIMAL(5,4),

  -- 校准参数（Platt Scaling）
  calibration_a DECIMAL(10,6),
  calibration_b DECIMAL(10,6),

  -- 元数据
  computed_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, confidence_bucket)
);

-- 索引
CREATE INDEX idx_confidence_calibration_user ON confidence_calibration(user_id);
```

#### 5.1.4 user_classification_preferences（用户分类偏好）

```sql
-- 用户分类偏好表
CREATE TABLE public.user_classification_preferences (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 全局偏好
  auto_confirm_threshold SMALLINT DEFAULT 85,  -- 自动确认阈值
  preferred_exploration_rate DECIMAL(3,2) DEFAULT 0.1,  -- 探索率

  -- 分类风格
  classification_style VARCHAR(20) DEFAULT 'balanced',
  -- conservative（保守，高阈值） | balanced（平衡） | aggressive（激进，低阈值）

  -- 文件夹偏好（JSON）
  folder_weights JSONB DEFAULT '{}',
  -- { "folder_id_1": 1.2, "folder_id_2": 0.8, ... }  -- 权重调整因子

  -- 负样本规则
  exclusion_rules JSONB DEFAULT '[]',
  -- [{ "type": "tag", "value": "临时", "excluded_folder_ids": [1, 2] }, ...]

  -- 学习参数
  learning_rate DECIMAL(4,3) DEFAULT 0.1,  -- 学习率

  -- 元数据
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id)
);
```

### 5.2 表结构修改

#### 5.2.1 classification_feedback 增加关联

```sql
-- 添加 outcome_id 关联
ALTER TABLE classification_feedback
ADD COLUMN outcome_id BIGINT REFERENCES classification_outcomes(id) ON DELETE SET NULL;

-- 添加索引
CREATE INDEX idx_classification_feedback_outcome ON classification_feedback(outcome_id);
```

#### 5.2.2 classification_outcomes 增加字段

```sql
-- 添加更多上下文字段
ALTER TABLE classification_outcomes
ADD COLUMN ranking_position SMALLINT,  -- 该文件夹在推荐列表中的位置
ADD COLUMN candidates_count SMALLINT,  -- 候选文件夹总数
ADD COLUMN time_to_feedback_ms INT,    -- 用户反馈耗时
ADD COLUMN session_id UUID;            -- 会话ID
```

#### 5.2.3 folder_profiles 增加准确率字段

```sql
-- 添加准确率缓存字段（避免每次查询统计表）
ALTER TABLE folder_profiles
ADD COLUMN accuracy_rate DECIMAL(5,4),
ADD COLUMN accuracy_sample_size INT DEFAULT 0,
ADD COLUMN accuracy_updated_at TIMESTAMPTZ;
```

### 5.3 核心函数

#### 5.3.1 record_learning_event()

```sql
CREATE OR REPLACE FUNCTION record_learning_event(
  p_user_id UUID,
  p_event_type VARCHAR(50),
  p_bookmark_id BIGINT DEFAULT NULL,
  p_suggestion_id BIGINT DEFAULT NULL,
  p_original_folder_id BIGINT DEFAULT NULL,
  p_target_folder_id BIGINT DEFAULT NULL,
  p_predicted_folder_id BIGINT DEFAULT NULL,
  p_predicted_confidence SMALLINT DEFAULT NULL,
  p_signal_weight DECIMAL DEFAULT 1.0,
  p_context JSONB DEFAULT '{}'
) RETURNS BIGINT
LANGUAGE plpgsql
AS $$
DECLARE
  v_event_id BIGINT;
  v_outcome_id BIGINT;
BEGIN
  -- 1. 插入学习事件
  INSERT INTO learning_events (
    user_id, event_type, bookmark_id, suggestion_id,
    original_folder_id, target_folder_id, predicted_folder_id,
    predicted_confidence, signal_weight, context
  ) VALUES (
    p_user_id, p_event_type, p_bookmark_id, p_suggestion_id,
    p_original_folder_id, p_target_folder_id, p_predicted_folder_id,
    p_predicted_confidence, p_signal_weight, p_context
  ) RETURNING id INTO v_event_id;

  -- 2. 如果有预测文件夹，更新 classification_outcomes
  IF p_predicted_folder_id IS NOT NULL AND p_bookmark_id IS NOT NULL THEN
    UPDATE classification_outcomes
    SET
      is_correct = (p_event_type = 'classification_confirmed'),
      feedback_source = p_event_type,
      updated_at = NOW()
    WHERE user_id = p_user_id
      AND bookmark_id = p_bookmark_id
      AND is_correct IS NULL
    RETURNING id INTO v_outcome_id;

    -- 关联到学习事件
    UPDATE learning_events SET outcome_id = v_outcome_id WHERE id = v_event_id;
  END IF;

  -- 3. 触发文件夹准确率更新（异步，通过 pg_notify）
  IF p_target_folder_id IS NOT NULL OR p_predicted_folder_id IS NOT NULL THEN
    PERFORM pg_notify('folder_accuracy_update', json_build_object(
      'user_id', p_user_id,
      'folder_ids', ARRAY[p_target_folder_id, p_predicted_folder_id]
    )::text);
  END IF;

  RETURN v_event_id;
END;
$$;
```

#### 5.3.2 update_folder_accuracy()

```sql
CREATE OR REPLACE FUNCTION update_folder_accuracy(
  p_user_id UUID,
  p_folder_id BIGINT
) RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_total INT;
  v_correct INT;
  v_rejected INT;
  v_modified INT;
  v_accuracy DECIMAL(5,4);
  v_recent_total INT;
  v_recent_correct INT;
  v_recent_accuracy DECIMAL(5,4);
  v_stats_by_confidence JSONB;
BEGIN
  -- 计算总体统计
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE event_type = 'classification_confirmed'),
    COUNT(*) FILTER (WHERE event_type = 'classification_rejected'),
    COUNT(*) FILTER (WHERE event_type = 'classification_modified')
  INTO v_total, v_correct, v_rejected, v_modified
  FROM learning_events
  WHERE user_id = p_user_id
    AND (target_folder_id = p_folder_id OR predicted_folder_id = p_folder_id);

  -- 计算准确率
  IF v_total > 0 THEN
    v_accuracy := v_correct::DECIMAL / v_total;
  END IF;

  -- 计算近30天统计
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE event_type = 'classification_confirmed')
  INTO v_recent_total, v_recent_correct
  FROM learning_events
  WHERE user_id = p_user_id
    AND (target_folder_id = p_folder_id OR predicted_folder_id = p_folder_id)
    AND created_at > NOW() - INTERVAL '30 days';

  IF v_recent_total > 0 THEN
    v_recent_accuracy := v_recent_correct::DECIMAL / v_recent_total;
  END IF;

  -- 计算置信度分层统计
  SELECT jsonb_object_agg(bucket, stats)
  INTO v_stats_by_confidence
  FROM (
    SELECT
      CASE
        WHEN predicted_confidence < 70 THEN '0-70'
        WHEN predicted_confidence < 80 THEN '70-80'
        WHEN predicted_confidence < 90 THEN '80-90'
        ELSE '90-100'
      END as bucket,
      jsonb_build_object(
        'total', COUNT(*),
        'correct', COUNT(*) FILTER (WHERE event_type = 'classification_confirmed')
      ) as stats
    FROM learning_events
    WHERE user_id = p_user_id
      AND (target_folder_id = p_folder_id OR predicted_folder_id = p_folder_id)
      AND predicted_confidence IS NOT NULL
    GROUP BY bucket
  ) t;

  -- 更新或插入统计
  INSERT INTO folder_accuracy_stats (
    user_id, folder_id, total_predictions, correct_predictions,
    rejected_predictions, modified_predictions, accuracy_rate,
    stats_by_confidence, recent_total, recent_correct, recent_accuracy_rate,
    computed_at
  ) VALUES (
    p_user_id, p_folder_id, v_total, v_correct,
    v_rejected, v_modified, v_accuracy,
    COALESCE(v_stats_by_confidence, '{}'), v_recent_total, v_recent_correct, v_recent_accuracy,
    NOW()
  )
  ON CONFLICT (user_id, folder_id) DO UPDATE SET
    total_predictions = EXCLUDED.total_predictions,
    correct_predictions = EXCLUDED.correct_predictions,
    rejected_predictions = EXCLUDED.rejected_predictions,
    modified_predictions = EXCLUDED.modified_predictions,
    accuracy_rate = EXCLUDED.accuracy_rate,
    stats_by_confidence = EXCLUDED.stats_by_confidence,
    recent_total = EXCLUDED.recent_total,
    recent_correct = EXCLUDED.recent_correct,
    recent_accuracy_rate = EXCLUDED.recent_accuracy_rate,
    computed_at = NOW();

  -- 同步更新 folder_profiles 缓存
  UPDATE folder_profiles
  SET
    accuracy_rate = v_accuracy,
    accuracy_sample_size = v_total,
    accuracy_updated_at = NOW()
  WHERE user_id = p_user_id AND folder_id = p_folder_id;
END;
$$;
```

#### 5.3.3 get_ranking_features()

```sql
CREATE OR REPLACE FUNCTION get_ranking_features(
  p_user_id UUID,
  p_bookmark_embedding vector(1024),
  p_bookmark_tags TEXT[],
  p_limit INT DEFAULT 10
) RETURNS TABLE (
  folder_id BIGINT,
  folder_name VARCHAR,
  -- 相似度特征
  vector_similarity DECIMAL,
  name_similarity DECIMAL,
  tag_overlap DECIMAL,
  -- 文件夹特征
  folder_accuracy DECIMAL,
  folder_heat DECIMAL,
  folder_size INT,
  folder_freshness DECIMAL,
  -- 用户偏好特征
  user_preference_weight DECIMAL,
  -- 负向特征
  rejection_count INT
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  WITH folder_candidates AS (
    -- 向量召回
    SELECT
      fp.folder_id,
      f.name as folder_name,
      1 - (fp.profile_embedding <=> p_bookmark_embedding) as vec_sim,
      1 - (fp.name_embedding <=> p_bookmark_embedding) as name_sim,
      fp.bookmark_count,
      fp.heat_score,
      fp.top_tags,
      fp.accuracy_rate,
      EXTRACT(EPOCH FROM (NOW() - COALESCE(fp.updated_at, fp.computed_at))) / 86400.0 as days_since_update
    FROM folder_profiles fp
    JOIN folders f ON f.id = fp.folder_id
    WHERE fp.user_id = p_user_id
      AND fp.profile_embedding IS NOT NULL
    ORDER BY fp.profile_embedding <=> p_bookmark_embedding
    LIMIT p_limit * 2  -- 多召回一些，后面精排
  ),
  user_prefs AS (
    SELECT
      folder_weights,
      exclusion_rules
    FROM user_classification_preferences
    WHERE user_id = p_user_id
  ),
  rejection_stats AS (
    SELECT
      predicted_folder_id as folder_id,
      COUNT(*) as reject_count
    FROM learning_events
    WHERE user_id = p_user_id
      AND event_type = 'classification_rejected'
      AND created_at > NOW() - INTERVAL '30 days'
    GROUP BY predicted_folder_id
  )
  SELECT
    fc.folder_id,
    fc.folder_name,
    fc.vec_sim::DECIMAL as vector_similarity,
    COALESCE(fc.name_sim, 0)::DECIMAL as name_similarity,
    COALESCE(
      array_length(ARRAY(SELECT unnest(fc.top_tags) INTERSECT SELECT unnest(p_bookmark_tags)), 1)::DECIMAL /
      GREATEST(array_length(p_bookmark_tags, 1), 1),
      0
    )::DECIMAL as tag_overlap,
    COALESCE(fc.accuracy_rate, 0.5)::DECIMAL as folder_accuracy,
    COALESCE(fc.heat_score / 100.0, 0.5)::DECIMAL as folder_heat,
    fc.bookmark_count as folder_size,
    GREATEST(0, 1 - fc.days_since_update / 30.0)::DECIMAL as folder_freshness,
    COALESCE((up.folder_weights->>fc.folder_id::text)::DECIMAL, 1.0) as user_preference_weight,
    COALESCE(rs.reject_count, 0)::INT as rejection_count
  FROM folder_candidates fc
  LEFT JOIN user_prefs up ON true
  LEFT JOIN rejection_stats rs ON rs.folder_id = fc.folder_id
  ORDER BY fc.vec_sim DESC
  LIMIT p_limit;
END;
$$;
```

---

## 6. 服务层设计

### 6.1 服务架构

```
src/lib/classification/
├── v5/                              # V5 推荐系统增强版
│   ├── services/
│   │   ├── recall.service.ts        # 多路召回服务
│   │   ├── ranking.service.ts       # 精排服务
│   │   ├── reranking.service.ts     # 重排服务
│   │   ├── calibration.service.ts   # 置信度校准服务
│   │   └── exploration.service.ts   # 探索-利用服务
│   │
│   ├── features/
│   │   ├── bookmark-features.ts     # 书签特征提取
│   │   ├── folder-features.ts       # 文件夹特征提取
│   │   ├── user-features.ts         # 用户特征提取
│   │   └── session-features.ts      # 会话特征提取
│   │
│   ├── learning/
│   │   ├── event-recorder.ts        # 学习事件记录器
│   │   ├── accuracy-tracker.ts      # 准确率追踪器
│   │   ├── preference-updater.ts    # 偏好更新器
│   │   └── weight-adjuster.ts       # 权重调整器
│   │
│   └── index.ts                     # 统一导出
│
├── learning/                        # 现有学习模块（保留）
└── repositories/                    # 现有仓库（保留）
```

### 6.2 核心服务实现

#### 6.2.1 RankingService

```typescript
// src/lib/classification/v5/services/ranking.service.ts

import { SupabaseClient } from "@supabase/supabase-js";

interface RankingFeatures {
  folder_id: number;
  folder_name: string;
  vector_similarity: number;
  name_similarity: number;
  tag_overlap: number;
  folder_accuracy: number;
  folder_heat: number;
  folder_size: number;
  folder_freshness: number;
  user_preference_weight: number;
  rejection_count: number;
}

interface RankingConfig {
  weights: {
    vector_similarity: number;
    folder_accuracy: number;
    folder_heat: number;
    user_preference: number;
    tag_overlap: number;
    folder_freshness: number;
    rejection_penalty: number;
  };
}

const DEFAULT_CONFIG: RankingConfig = {
  weights: {
    vector_similarity: 0.25,
    folder_accuracy: 0.2,
    folder_heat: 0.1,
    user_preference: 0.15,
    tag_overlap: 0.1,
    folder_freshness: 0.05,
    rejection_penalty: -0.15,
  },
};

export class RankingService {
  constructor(
    private supabase: SupabaseClient,
    private config: RankingConfig = DEFAULT_CONFIG,
  ) {}

  /**
   * 获取排序特征并计算最终分数
   */
  async rankFolders(
    userId: string,
    bookmarkEmbedding: number[],
    bookmarkTags: string[],
    limit: number = 5,
  ): Promise<RankedFolder[]> {
    // 1. 获取排序特征
    const { data: features, error } = await this.supabase.rpc(
      "get_ranking_features",
      {
        p_user_id: userId,
        p_bookmark_embedding: bookmarkEmbedding,
        p_bookmark_tags: bookmarkTags,
        p_limit: limit * 2,
      },
    );

    if (error) throw error;

    // 2. 计算排序分数
    const ranked = features.map((f: RankingFeatures) => ({
      ...f,
      score: this.computeScore(f),
    }));

    // 3. 排序并截取
    ranked.sort((a, b) => b.score - a.score);
    return ranked.slice(0, limit);
  }

  /**
   * 计算排序分数
   */
  private computeScore(features: RankingFeatures): number {
    const { weights } = this.config;

    let score = 0;
    score += weights.vector_similarity * features.vector_similarity;
    score += weights.folder_accuracy * features.folder_accuracy;
    score += weights.folder_heat * features.folder_heat;
    score += weights.user_preference * features.user_preference_weight;
    score += weights.tag_overlap * features.tag_overlap;
    score += weights.folder_freshness * features.folder_freshness;

    // 负向：拒绝惩罚（归一化后应用）
    const rejection_penalty = Math.min(features.rejection_count / 10, 1);
    score += weights.rejection_penalty * rejection_penalty;

    return Math.max(0, Math.min(1, score));
  }

  /**
   * 动态调整权重（基于用户反馈）
   */
  async adjustWeights(userId: string): Promise<void> {
    // 获取用户近期反馈统计
    const { data: stats } = await this.supabase
      .from("learning_events")
      .select("event_type")
      .eq("user_id", userId)
      .gte(
        "created_at",
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      );

    if (!stats || stats.length < 10) return; // 样本太少，不调整

    const total = stats.length;
    const rejectRate =
      stats.filter((s) => s.event_type === "classification_rejected").length /
      total;
    const modifyRate =
      stats.filter((s) => s.event_type === "classification_modified").length /
      total;

    // 根据拒绝率调整
    if (rejectRate > 0.3) {
      // 拒绝率高：降低向量相似度权重，提高准确率权重
      this.config.weights.vector_similarity = Math.max(
        0.15,
        this.config.weights.vector_similarity - 0.05,
      );
      this.config.weights.folder_accuracy = Math.min(
        0.3,
        this.config.weights.folder_accuracy + 0.05,
      );
    }

    // 根据修改率调整
    if (modifyRate > 0.2) {
      // 修改率高：提高用户偏好权重
      this.config.weights.user_preference = Math.min(
        0.25,
        this.config.weights.user_preference + 0.05,
      );
    }
  }
}
```

#### 6.2.2 CalibrationService

```typescript
// src/lib/classification/v5/services/calibration.service.ts

interface CalibrationBucket {
  bucket: string;
  prediction_count: number;
  correct_count: number;
  actual_accuracy: number;
}

export class CalibrationService {
  private calibrationParams: { a: number; b: number } = { a: 1, b: 0 };

  constructor(private supabase: SupabaseClient) {}

  /**
   * 校准置信度
   */
  calibrate(rawConfidence: number): number {
    const { a, b } = this.calibrationParams;
    const calibrated = this.sigmoid((a * rawConfidence) / 100 + b) * 100;
    return Math.round(calibrated);
  }

  /**
   * 更新校准参数
   */
  async updateCalibration(userId: string): Promise<void> {
    // 获取校准数据
    const { data: buckets } = await this.supabase
      .from("confidence_calibration")
      .select("*")
      .eq("user_id", userId);

    if (!buckets || buckets.length < 3) return; // 数据不足

    // 简化版 Platt Scaling：线性回归
    const points = buckets.map((b) => ({
      x: this.bucketMidpoint(b.confidence_bucket) / 100,
      y: b.actual_accuracy || 0.5,
    }));

    const { a, b } = this.fitLinearRegression(points);
    this.calibrationParams = { a, b };

    // 保存校准参数
    await this.supabase.from("confidence_calibration").upsert({
      user_id: userId,
      confidence_bucket: "global",
      calibration_a: a,
      calibration_b: b,
      computed_at: new Date().toISOString(),
    });
  }

  /**
   * 记录预测结果用于校准
   */
  async recordPrediction(
    userId: string,
    confidence: number,
    isCorrect: boolean,
  ): Promise<void> {
    const bucket = this.getBucket(confidence);

    await this.supabase.rpc("update_calibration_bucket", {
      p_user_id: userId,
      p_bucket: bucket,
      p_is_correct: isCorrect,
    });
  }

  /**
   * 获取校准报告
   */
  async getCalibrationReport(userId: string): Promise<CalibrationReport> {
    const { data: buckets } = await this.supabase
      .from("confidence_calibration")
      .select("*")
      .eq("user_id", userId)
      .neq("confidence_bucket", "global");

    const ece = this.computeECE(buckets || []);

    return {
      buckets: buckets || [],
      expectedCalibrationError: ece,
      isWellCalibrated: ece < 0.05,
      recommendation:
        ece > 0.1
          ? "模型过于自信，建议降低自动确认阈值"
          : ece < 0.02
            ? "校准良好"
            : "校准基本正常",
    };
  }

  private sigmoid(x: number): number {
    return 1 / (1 + Math.exp(-x));
  }

  private getBucket(confidence: number): string {
    if (confidence < 50) return "0-50";
    if (confidence < 60) return "50-60";
    if (confidence < 70) return "60-70";
    if (confidence < 80) return "70-80";
    if (confidence < 90) return "80-90";
    return "90-100";
  }

  private bucketMidpoint(bucket: string): number {
    const map: Record<string, number> = {
      "0-50": 25,
      "50-60": 55,
      "60-70": 65,
      "70-80": 75,
      "80-90": 85,
      "90-100": 95,
    };
    return map[bucket] || 50;
  }

  private fitLinearRegression(points: { x: number; y: number }[]): {
    a: number;
    b: number;
  } {
    const n = points.length;
    const sumX = points.reduce((s, p) => s + p.x, 0);
    const sumY = points.reduce((s, p) => s + p.y, 0);
    const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
    const sumX2 = points.reduce((s, p) => s + p.x * p.x, 0);

    const a = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const b = (sumY - a * sumX) / n;

    return { a: isNaN(a) ? 1 : a, b: isNaN(b) ? 0 : b };
  }

  private computeECE(buckets: CalibrationBucket[]): number {
    const totalCount = buckets.reduce((s, b) => s + b.prediction_count, 0);
    if (totalCount === 0) return 0;

    return buckets.reduce((ece, b) => {
      const midpoint = this.bucketMidpoint(b.bucket) / 100;
      const accuracy = b.actual_accuracy || 0;
      const weight = b.prediction_count / totalCount;
      return ece + weight * Math.abs(accuracy - midpoint);
    }, 0);
  }
}
```

#### 6.2.3 LearningEventRecorder

```typescript
// src/lib/classification/v5/learning/event-recorder.ts

interface LearningEventInput {
  eventType:
    | "classification_confirmed"
    | "classification_rejected"
    | "classification_modified"
    | "manual_move"
    | "bookmark_deleted"
    | "suggestion_ignored"
    | "undo_action";
  bookmarkId?: number;
  suggestionId?: number;
  originalFolderId?: number;
  targetFolderId?: number;
  predictedFolderId?: number;
  predictedConfidence?: number;
  context?: Record<string, unknown>;
}

const SIGNAL_WEIGHTS: Record<string, number> = {
  classification_confirmed: 1.0,
  classification_rejected: 1.0,
  classification_modified: 0.9,
  manual_move: 0.7,
  bookmark_deleted: 0.3,
  suggestion_ignored: 0.5,
  undo_action: 1.2,
};

export class LearningEventRecorder {
  constructor(
    private supabase: SupabaseClient,
    private calibrationService: CalibrationService,
    private accuracyTracker: AccuracyTracker,
  ) {}

  /**
   * 记录学习事件
   */
  async recordEvent(
    userId: string,
    input: LearningEventInput,
  ): Promise<number> {
    const signalWeight = SIGNAL_WEIGHTS[input.eventType] || 1.0;

    // 1. 调用数据库函数记录事件
    const { data, error } = await this.supabase.rpc("record_learning_event", {
      p_user_id: userId,
      p_event_type: input.eventType,
      p_bookmark_id: input.bookmarkId,
      p_suggestion_id: input.suggestionId,
      p_original_folder_id: input.originalFolderId,
      p_target_folder_id: input.targetFolderId,
      p_predicted_folder_id: input.predictedFolderId,
      p_predicted_confidence: input.predictedConfidence,
      p_signal_weight: signalWeight,
      p_context: input.context || {},
    });

    if (error) throw error;

    // 2. 更新校准数据
    if (input.predictedConfidence && input.predictedFolderId) {
      const isCorrect = input.eventType === "classification_confirmed";
      await this.calibrationService.recordPrediction(
        userId,
        input.predictedConfidence,
        isCorrect,
      );
    }

    // 3. 触发准确率更新（异步）
    const folderIds = [input.targetFolderId, input.predictedFolderId].filter(
      Boolean,
    );
    if (folderIds.length > 0) {
      this.accuracyTracker.scheduleUpdate(userId, folderIds as number[]);
    }

    return data as number;
  }

  /**
   * 批量记录事件
   */
  async recordEvents(
    userId: string,
    inputs: LearningEventInput[],
  ): Promise<number[]> {
    const results = await Promise.all(
      inputs.map((input) => this.recordEvent(userId, input)),
    );
    return results;
  }
}
```

### 6.3 集成到现有分类流程

```typescript
// src/lib/classification/v5/index.ts

import { RankingService } from "./services/ranking.service";
import { CalibrationService } from "./services/calibration.service";
import { ExplorationService } from "./services/exploration.service";
import { LearningEventRecorder } from "./learning/event-recorder";
import { AccuracyTracker } from "./learning/accuracy-tracker";

export class ClassificationServiceV5 {
  private rankingService: RankingService;
  private calibrationService: CalibrationService;
  private explorationService: ExplorationService;
  private eventRecorder: LearningEventRecorder;

  constructor(private supabase: SupabaseClient) {
    this.calibrationService = new CalibrationService(supabase);
    this.rankingService = new RankingService(supabase);
    this.explorationService = new ExplorationService(supabase);

    const accuracyTracker = new AccuracyTracker(supabase);
    this.eventRecorder = new LearningEventRecorder(
      supabase,
      this.calibrationService,
      accuracyTracker,
    );
  }

  /**
   * 分类书签（V5 增强版）
   */
  async classifyBookmark(
    userId: string,
    bookmark: {
      id: number;
      embedding: number[];
      tags: string[];
    },
  ): Promise<ClassificationResult> {
    // 1. 多因素排序
    const rankedFolders = await this.rankingService.rankFolders(
      userId,
      bookmark.embedding,
      bookmark.tags,
    );

    if (rankedFolders.length === 0) {
      return { action: "to_inbox", confidence: 0, candidates: [] };
    }

    // 2. 重排（探索注入）
    const rerankedFolders = await this.explorationService.rerank(
      userId,
      rankedFolders,
    );

    // 3. 置信度校准
    const topFolder = rerankedFolders[0];
    const rawConfidence = topFolder.score * 100;
    const calibratedConfidence =
      this.calibrationService.calibrate(rawConfidence);

    // 4. 获取用户偏好阈值
    const threshold = await this.getUserThreshold(userId);

    // 5. 决策
    if (calibratedConfidence >= threshold) {
      return {
        action: "auto_classify",
        folderId: topFolder.folder_id,
        folderName: topFolder.folder_name,
        confidence: calibratedConfidence,
        candidates: rerankedFolders.slice(0, 3),
      };
    } else if (calibratedConfidence >= threshold - 15) {
      return {
        action: "suggest",
        folderId: topFolder.folder_id,
        folderName: topFolder.folder_name,
        confidence: calibratedConfidence,
        candidates: rerankedFolders.slice(0, 3),
      };
    } else {
      return {
        action: "to_inbox",
        confidence: calibratedConfidence,
        candidates: rerankedFolders.slice(0, 3),
      };
    }
  }

  /**
   * 记录用户反馈
   */
  async recordFeedback(
    userId: string,
    input: LearningEventInput,
  ): Promise<void> {
    await this.eventRecorder.recordEvent(userId, input);
  }

  private async getUserThreshold(userId: string): Promise<number> {
    const { data } = await this.supabase
      .from("user_classification_preferences")
      .select("auto_confirm_threshold")
      .eq("user_id", userId)
      .single();

    return data?.auto_confirm_threshold || 85;
  }
}
```

---

## 7. 实施路线图

### 7.1 总览

```
┌─────────────────────────────────────────────────────────────────────┐
│                        实施路线图                                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Phase 1 (Week 1-2)         Phase 2 (Week 3-4)                     │
│  ┌─────────────────┐        ┌─────────────────┐                    │
│  │ 数据基础设施    │   ──▶  │ 多因素排序      │                    │
│  │ • learning_events       │ • 特征提取      │                    │
│  │ • feedback关联          │ • 排序模型      │                    │
│  │ • 准确率统计            │ • 权重调整      │                    │
│  └─────────────────┘        └─────────────────┘                    │
│           │                          │                              │
│           ▼                          ▼                              │
│  Phase 3 (Week 5-6)         Phase 4 (Week 7-8)                     │
│  ┌─────────────────┐        ┌─────────────────┐                    │
│  │ 置信度校准      │   ──▶  │ 用户体验优化    │                    │
│  │ • 校准系统      │        │ • 效果展示      │                    │
│  │ • 探索-利用     │        │ • 反馈引导      │                    │
│  │ • 自动调整      │        │ • 仪表板        │                    │
│  └─────────────────┘        └─────────────────┘                    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 7.2 Phase 1: 数据基础设施（Week 1-2）

**目标**：完善反馈闭环数据链路

| 任务                                    | 优先级 | 预估工时 | 依赖     |
| --------------------------------------- | ------ | -------- | -------- |
| 创建 learning_events 表                 | P0     | 2h       | 无       |
| 创建 folder_accuracy_stats 表           | P0     | 2h       | 无       |
| 创建 confidence_calibration 表          | P0     | 1h       | 无       |
| 创建 user_classification_preferences 表 | P0     | 1h       | 无       |
| 添加 classification_feedback.outcome_id | P0     | 1h       | 无       |
| 实现 record_learning_event() 函数       | P0     | 3h       | 表创建   |
| 实现 update_folder_accuracy() 函数      | P0     | 3h       | 表创建   |
| 实现 LearningEventRecorder 服务         | P0     | 4h       | 函数     |
| 集成到现有反馈 API                      | P0     | 4h       | 服务     |
| 数据迁移：历史反馈 → learning_events    | P1     | 4h       | 表和函数 |

**交付物**：

- 4 个新数据库表
- 2 个核心数据库函数
- 1 个 TypeScript 服务
- 完整的反馈→学习数据链路

### 7.3 Phase 2: 多因素排序（Week 3-4）

**目标**：实现推荐系统风格的多因素排序模型

| 任务                             | 优先级 | 预估工时 | 依赖    |
| -------------------------------- | ------ | -------- | ------- |
| 实现 get_ranking_features() 函数 | P0     | 4h       | Phase 1 |
| 实现 RankingService              | P0     | 6h       | 函数    |
| 实现 BookmarkFeatures 提取器     | P1     | 3h       | 无      |
| 实现 FolderFeatures 提取器       | P1     | 3h       | 无      |
| 实现 UserFeatures 提取器         | P1     | 3h       | 无      |
| 权重配置管理                     | P1     | 2h       | 服务    |
| 集成到 ClassificationService     | P0     | 4h       | 服务    |
| 单元测试                         | P1     | 4h       | 集成    |
| 性能测试和优化                   | P1     | 4h       | 测试    |

**交付物**：

- RankingService 完整实现
- 特征提取器
- 集成到现有分类流程

### 7.4 Phase 3: 置信度校准与探索（Week 5-6）

**目标**：实现置信度校准和探索-利用平衡

| 任务                    | 优先级 | 预估工时 | 依赖        |
| ----------------------- | ------ | -------- | ----------- |
| 实现 CalibrationService | P0     | 6h       | Phase 1     |
| 实现校准数据库函数      | P0     | 3h       | Phase 1     |
| 实现 ExplorationService | P0     | 4h       | 无          |
| 实现 ReRankingService   | P1     | 4h       | Exploration |
| 实现 AccuracyTracker    | P0     | 4h       | Phase 1     |
| 动态阈值调整逻辑        | P1     | 3h       | 校准        |
| 集成到分类流程          | P0     | 4h       | 所有服务    |
| 校准报告 API            | P1     | 3h       | 校准服务    |

**交付物**：

- CalibrationService 完整实现
- ExplorationService 完整实现
- 校准报告功能

### 7.5 Phase 4: 用户体验优化（Week 7-8）

**目标**：让用户看到系统优化效果，提高反馈参与度

| 任务               | 优先级 | 预估工时 | 依赖    |
| ------------------ | ------ | -------- | ------- |
| 反馈后效果提示组件 | P0     | 4h       | Phase 1 |
| 个人准确率仪表板   | P1     | 6h       | Phase 1 |
| 文件夹准确率展示   | P1     | 3h       | Phase 2 |
| 校准状态展示       | P2     | 3h       | Phase 3 |
| 学习进度可视化     | P2     | 4h       | Phase 1 |
| 周报/月报生成      | P2     | 4h       | 所有    |
| 反馈引导优化       | P1     | 3h       | 无      |

**交付物**：

- 效果反馈 UI 组件
- 准确率仪表板
- 学习进度可视化

---

## 8. 风险评估

### 8.1 技术风险

| 风险               | 可能性 | 影响 | 缓解措施                  |
| ------------------ | ------ | ---- | ------------------------- |
| 排序模型过拟合     | 中     | 高   | 正则化、交叉验证、A/B测试 |
| 校准数据不足       | 中     | 中   | 冷启动默认值、渐进式校准  |
| 探索策略导致差体验 | 低     | 中   | 限制探索率、质量门槛      |
| 数据库性能问题     | 中     | 高   | 索引优化、缓存、异步处理  |
| 特征计算延迟       | 中     | 中   | 预计算、缓存、降级策略    |

### 8.2 产品风险

| 风险                   | 可能性 | 影响 | 缓解措施                         |
| ---------------------- | ------ | ---- | -------------------------------- |
| 用户不愿提供反馈       | 高     | 高   | 简化反馈流程、展示效果、激励机制 |
| 准确率提升不明显       | 中     | 高   | 渐进式优化、A/B测试验证          |
| 系统复杂度增加维护成本 | 中     | 中   | 模块化设计、充分文档             |

### 8.3 缓解策略

1. **渐进式发布**：每个 Phase 独立可用，可提前发布
2. **特性开关**：新功能可通过配置开关控制
3. **回退机制**：保留 V4 分类逻辑，可快速回退
4. **监控告警**：关键指标实时监控，异常自动告警

---

## 9. 成功指标

### 9.1 核心指标

| 指标       | 定义                      | 当前基线 | Phase 2 目标 | Phase 4 目标 |
| ---------- | ------------------------- | -------- | ------------ | ------------ |
| 分类准确率 | 确认数 / (确认+拒绝+修改) | ~65%     | 75%          | 85%          |
| 建议采纳率 | 接受数 / 展示数           | ~40%     | 55%          | 65%          |
| 用户确认率 | 确认数 / 分类总数         | ~50%     | 60%          | 75%          |
| 反馈参与率 | 反馈用户数 / 活跃用户数   | ~10%     | 20%          | 30%          |

### 9.2 辅助指标

| 指标                 | 定义                         | 目标    |
| -------------------- | ---------------------------- | ------- |
| 置信度校准误差 (ECE) | 预测置信度与实际准确率的差异 | < 5%    |
| 冷启动准确率         | 新文件夹前10次分类的准确率   | > 60%   |
| 探索有效率           | 探索推荐被接受的比例         | > 30%   |
| 反馈处理延迟         | 从反馈到应用的时间           | < 1分钟 |

### 9.3 监控仪表板

```
┌─────────────────────────────────────────────────────────────────┐
│                    智能分类系统监控                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  准确率趋势 (30天)                    置信度校准曲线             │
│  ┌─────────────────────┐            ┌─────────────────────┐    │
│  │     ↗ 85%           │            │    ──── 理想        │    │
│  │   ↗                 │            │    .... 实际        │    │
│  │ ↗  75%              │            │  /                  │    │
│  │                     │            │ /                   │    │
│  │ 65%                 │            │.                    │    │
│  └─────────────────────┘            └─────────────────────┘    │
│                                                                 │
│  反馈分布                            文件夹准确率排行            │
│  ┌─────────────────────┐            ┌─────────────────────┐    │
│  │ 确认 ████████ 60%   │            │ 1. 技术文章  92%    │    │
│  │ 拒绝 ███     20%    │            │ 2. 工作资料  88%    │    │
│  │ 修改 ██      15%    │            │ 3. 学习笔记  85%    │    │
│  │ 忽略 █        5%    │            │ ...                 │    │
│  └─────────────────────┘            └─────────────────────┘    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 附录

### A. 相关文档

- [现有分类系统文档](./classification-v4.md)
- [文件夹向量化设计](./folder-embedding-design.md)
- [反馈系统设计](./feedback-system-design.md)

### B. 参考资料

1. YouTube 推荐系统论文: "Deep Neural Networks for YouTube Recommendations"
2. 阿里巴巴推荐系统: "Billion-scale Commodity Embedding for E-commerce Recommendation in Alibaba"
3. 置信度校准: "On Calibration of Modern Neural Networks"
4. 探索-利用: "Exploration and Exploitation in Multi-Armed Bandits"

### C. 术语表

| 术语              | 说明                                             |
| ----------------- | ------------------------------------------------ |
| ECE               | Expected Calibration Error，期望校准误差         |
| Platt Scaling     | 一种置信度校准方法                               |
| Thompson Sampling | 一种探索-利用平衡算法                            |
| HNSW              | Hierarchical Navigable Small World，向量索引算法 |
| Cold Start        | 冷启动，新用户/新文件夹的推荐问题                |

---

**文档结束**

请审核此方案，如有问题或需要调整，请告知。
