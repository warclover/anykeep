# AnyKeep 智能分类系统架构优化方案

**版本**: 2.0
**编写者**: Winston (Architect)
**日期**: 2025-12-11
**基于**: 头脑风暴会议结论 + 现有代码架构分析 + 托管模式需求

---

## 一、设计哲学

### 1.1 核心价值主张

> **"只管收藏，后续 0 操心 0 干预"**

AnyKeep 的设计初衷是让用户专注于发现和收藏有价值的内容，而将整理、分类、组织的工作完全交给 AI。这是产品的核心竞争力，所有架构设计都服务于这一目标。

### 1.2 设计原则

| 原则           | 说明                           |
| -------------- | ------------------------------ |
| **智能优先**   | 默认启用完全托管，AI 自主决策  |
| **渐进式介入** | 用户可选择介入程度，但不强制   |
| **学习闭环**   | 从用户行为中持续学习，越用越准 |
| **透明可解释** | 每个决策都有理由，用户可追溯   |
| **容错友好**   | 分错可纠正，纠正会学习         |

---

## 二、托管模式设计 (Trust Mode)

### 2.1 三种托管模式

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        托管模式 (Trust Mode)                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐               │
│  │  完全托管   │     │   半托管    │     │   不托管    │               │
│  │ (Full Auto) │     │ (Semi Auto) │     │  (Manual)   │               │
│  │   ⭐默认    │     │             │     │             │               │
│  └──────┬──────┘     └──────┬──────┘     └──────┬──────┘               │
│         │                   │                   │                       │
│         ▼                   ▼                   ▼                       │
│  ┌────────────┐      ┌────────────┐      ┌────────────┐                │
│  │ 0 干预     │      │ 消息确认   │      │ 完全手动   │                │
│  │ AI 全权    │      │ 重要事项   │      │ AI 仅辅助  │                │
│  │ 自动进化   │      │ 征求意见   │      │ 按需使用   │                │
│  └────────────┘      └────────────┘      └────────────┘                │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 模式详细定义

#### 完全托管模式 (Full Auto) - 默认

**理念**: 用户只管收藏，AI 全权负责整理

| 特性                | 行为                             |
| ------------------- | -------------------------------- |
| **智能分类**        | 自动执行，无需确认               |
| **低置信度**        | 自动放入待整理，后台聚类处理     |
| **文件夹创建**      | AI 自动创建（每日上限保护）      |
| **文件夹合并/拆分** | AI 自动执行（可撤销）            |
| **重命名**          | AI 自动优化命名                  |
| **用户通知**        | 仅重大变更（如批量重组）         |
| **学习方式**        | 被动学习（从用户手动操作中学习） |

```typescript
// 完全托管模式配置
const FULL_AUTO_CONFIG: TrustModeConfig = {
  mode: "full_auto",

  classification: {
    autoClassify: true,
    requireConfirmation: false,
    lowConfidenceAction: "auto_inbox_then_cluster",
  },

  folderManagement: {
    autoCreate: true,
    autoMerge: true,
    autoSplit: true,
    autoRename: true,
    dailyCreateLimit: 6,
  },

  notification: {
    onClassification: false,
    onFolderCreate: false,
    onMajorReorganization: true, // 仅重大变更通知
  },

  learning: {
    learnFromManualMoves: true,
    learnFromDeletions: true,
    askForFeedback: false,
  },
};
```

#### 半托管模式 (Semi Auto)

**理念**: AI 做初步决策，重要/不确定的事项征求用户意见

| 特性                | 行为                                 |
| ------------------- | ------------------------------------ |
| **智能分类**        | 自动执行高置信度，低置信度发消息确认 |
| **低置信度**        | 暂存 + 发送消息征求意见              |
| **文件夹创建**      | 发送建议消息，用户确认后创建         |
| **文件夹合并/拆分** | 发送建议消息，用户确认后执行         |
| **重命名**          | 发送建议消息，用户确认后执行         |
| **用户通知**        | 所有需要确认的事项                   |
| **学习方式**        | 主动询问 + 被动学习                  |

```typescript
// 半托管模式配置
const SEMI_AUTO_CONFIG: TrustModeConfig = {
  mode: "semi_auto",

  classification: {
    autoClassify: true,
    requireConfirmation: false,
    lowConfidenceAction: "pending_with_message",
    confirmationThreshold: 60, // 低于此置信度需确认
  },

  folderManagement: {
    autoCreate: false,
    autoMerge: false,
    autoSplit: false,
    autoRename: false,
    suggestAndWait: true, // 发送建议，等待用户确认
  },

  notification: {
    onClassification: false, // 高置信度不通知
    onLowConfidence: true, // 低置信度通知
    onFolderSuggestion: true, // 文件夹建议通知
  },

  learning: {
    learnFromManualMoves: true,
    learnFromDeletions: true,
    askForFeedback: true, // 主动询问反馈
  },
};
```

#### 不托管模式 (Manual)

**理念**: 用户完全控制，AI 仅作为辅助工具按需使用

| 特性           | 行为                             |
| -------------- | -------------------------------- |
| **智能分类**   | 禁用自动分类，收藏默认进入待整理 |
| **AI 摘要**    | 可选启用（仅生成摘要，不分类）   |
| **文件夹管理** | 完全手动创建、命名、组织         |
| **AI 建议**    | 用户主动请求时提供               |
| **用户通知**   | 无自动通知                       |
| **学习方式**   | 不主动学习                       |

```typescript
// 不托管模式配置
const MANUAL_CONFIG: TrustModeConfig = {
  mode: "manual",

  classification: {
    autoClassify: false,
    defaultDestination: "inbox", // 默认进入待整理
    aiSummaryOnly: true, // 仅生成摘要
  },

  folderManagement: {
    autoCreate: false,
    autoMerge: false,
    autoSplit: false,
    autoRename: false,
    suggestOnDemand: true, // 用户请求时才提供建议
  },

  notification: {
    enabled: false,
  },

  learning: {
    learnFromManualMoves: false, // 不主动学习
    preservePreferences: true, // 保留用户偏好以备切换模式
  },
};
```

### 2.3 模式切换与迁移

```
┌─────────────────────────────────────────────────────────────────┐
│                      模式切换流程                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Manual ──────────────────▶ Semi Auto ──────────────▶ Full Auto │
│    │                           │                          │     │
│    │  切换时:                  │  切换时:                 │     │
│    │  • 保留所有文件夹         │  • 清空待确认队列        │     │
│    │  • 待整理内容保持         │  • 自动处理待整理        │     │
│    │  • 开始学习用户偏好       │  • 启用自动进化          │     │
│    │                           │                          │     │
│    ◀──────────────────────────┴──────────────────────────┘     │
│                                                                 │
│  任意模式可互相切换，数据和学习结果保留                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.4 数据模型

```sql
-- 用户托管模式配置表
CREATE TABLE user_trust_mode (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users UNIQUE,

  -- 当前模式
  trust_mode VARCHAR(20) DEFAULT 'full_auto', -- 'full_auto' | 'semi_auto' | 'manual'

  -- 细粒度开关 (覆盖模式默认值)
  overrides JSONB DEFAULT '{}',

  -- 模式切换历史
  mode_history JSONB DEFAULT '[]',

  -- 统计信息
  auto_decisions_count INT DEFAULT 0,      -- AI 自动决策次数
  user_corrections_count INT DEFAULT 0,    -- 用户纠正次数
  pending_confirmations_count INT DEFAULT 0, -- 待确认数量

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 待确认队列 (半托管模式使用)
CREATE TABLE pending_confirmations (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users,

  -- 确认类型
  confirmation_type VARCHAR(50), -- 'classification' | 'folder_create' | 'folder_merge' | 'folder_split' | 'rename'

  -- 关联对象
  bookmark_id BIGINT,
  folder_id BIGINT,

  -- AI 建议
  suggestion JSONB, -- { folderId, folderName, confidence, reason, alternatives }

  -- 状态
  status VARCHAR(20) DEFAULT 'pending', -- 'pending' | 'confirmed' | 'rejected' | 'expired'

  -- 用户响应
  user_choice JSONB, -- { selectedFolderId, feedback, timestamp }

  -- 过期时间 (7天后自动按建议执行或放入待整理)
  expires_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- 索引
CREATE INDEX idx_pending_confirmations_user_status
  ON pending_confirmations(user_id, status);
CREATE INDEX idx_pending_confirmations_expires
  ON pending_confirmations(expires_at) WHERE status = 'pending';
```

---

## 三、问题诊断总结

### 3.1 当前系统问题

| 问题域         | 现状         | 根因                       | 影响         |
| -------------- | ------------ | -------------------------- | ------------ |
| **分类准确率** | ~70%         | 单向量匹配 + 画像边界模糊  | 用户信任度低 |
| **响应速度**   | 4s+          | 所有内容走相同路径         | 体验差       |
| **置信度失效** | 高置信也分错 | 评估模型与实际效果脱节     | 决策不可信   |
| **冷启动**     | 新用户效果差 | 无初始画像数据             | 首印象差     |
| **三系统协同** | 松散耦合     | 事件驱动有框架但未深度利用 | 能力浪费     |

### 3.2 头脑风暴关键洞察

- **多环节问题叠加**: 输入质量差 + 画像不准 + 匹配粗糙 = 问题放大
- **用户体验优先**: 不确定时交给用户比强行分类更好 (半托管模式)
- **分层策略关键**: 简单问题简单处理，复杂问题精细处理
- **负样本价值**: 知道"不是什么"和知道"是什么"同样重要
- **渐进式优化**: 快速见效方案先上，长期方案持续迭代

---

## 四、架构改进总体设计

### 4.1 统一智能引擎架构

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    统一智能引擎 (Unified AI Engine)                      │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │                    托管模式控制器 (Trust Mode Controller)          │  │
│  │      ┌──────────┐      ┌──────────┐      ┌──────────┐              │  │
│  │      │Full Auto │      │Semi Auto │      │ Manual   │              │  │
│  │      └────┬─────┘      └────┬─────┘      └────┬─────┘              │  │
│  └───────────┼─────────────────┼─────────────────┼────────────────────┘  │
│              │                 │                 │                        │
│              └─────────────────┼─────────────────┘                        │
│                                ▼                                          │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │                  共享特征层 (Shared Feature Layer)                 │  │
│  │    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐   │  │
│  │    │多向量表征│     │来源画像  │     │标签图谱  │     │用户偏好  │   │  │
│  │    └──────────┘    └──────────┘    └──────────┘    └──────────┘   │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                │                                          │
│              ┌─────────────────┼─────────────────┐                        │
│              ▼                 ▼                 ▼                        │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐          │
│  │     AI 摘要      │ │    智能分类      │ │  文件夹自组织    │          │
│  │  (AI Summary)    │ │ (Classification) │ │ (Self-Organize)  │          │
│  └────────┬─────────┘ └────────┬─────────┘ └────────┬─────────┘          │
│           │                    │                    │                     │
│           └────────────────────┼────────────────────┘                     │
│                                ▼                                          │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │               事件驱动反馈环 (Event-Driven Feedback Loop)          │  │
│  │                                                                    │  │
│  │   用户行为 ──▶ 负样本学习 ──▶ 画像演化 ──▶ 分类优化 ──▶ 更准确   │  │
│  │                                                                    │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

**核心理念**:

- **托管模式控制器** 位于最顶层，统一控制三个子系统的行为
- **共享特征层** 让三个系统共用同一套高质量特征
- **事件驱动反馈环** 形成正向飞轮，越用越准

### 4.2 托管模式对各系统的影响

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         托管模式行为矩阵                                    │
├─────────────────┬───────────────┬───────────────┬───────────────────────────┤
│     功能        │   Full Auto   │   Semi Auto   │        Manual             │
├─────────────────┼───────────────┼───────────────┼───────────────────────────┤
│ 自动分类        │ ✅ 全自动     │ ✅ 高置信自动 │ ❌ 禁用                   │
│ 低置信处理      │ 自动待整理    │ 消息确认      │ 直接待整理                │
│ 文件夹创建      │ ✅ AI 自动    │ 📩 消息确认   │ ❌ 手动创建               │
│ 文件夹合并      │ ✅ AI 自动    │ 📩 消息确认   │ ❌ 手动操作               │
│ 文件夹拆分      │ ✅ AI 自动    │ 📩 消息确认   │ ❌ 手动操作               │
│ 智能重命名      │ ✅ AI 自动    │ 📩 消息确认   │ ❌ 手动命名               │
│ AI 摘要         │ ✅ 启用       │ ✅ 启用       │ ⚙️ 可选启用               │
│ 消息通知        │ 仅重大变更    │ 所有待确认项  │ 无                        │
│ 学习模式        │ 被动学习      │ 主动+被动     │ 不学习                    │
│ 待整理箱处理    │ 自动聚类分配  │ 建议+确认     │ 手动处理                  │
├─────────────────┴───────────────┴───────────────┴───────────────────────────┤
│  ✅ = 自动执行   📩 = 发消息确认   ⚙️ = 用户配置   ❌ = 禁用/手动          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 五、共享特征层设计

### 5.1 来源画像 (Source Profile)

**目标**: 将公众号/网站作为强信号，同来源内容大概率属于同领域

```typescript
interface SourceProfile {
  sourceId: string; // 公众号ID / 域名
  sourceName: string; // 公众号名称 / 网站名
  domains: string[]; // 关联领域 ['技术', 'AI', '编程']
  trustScore: number; // 来源可信度 0-100
  contentType: "article" | "news" | "tutorial" | "opinion";
  frequentFolders: number[]; // 用户历史归类的高频文件夹
  sampleCount: number; // 样本数量
}
```

```sql
-- 来源画像表
CREATE TABLE source_profiles (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users,
  source_id VARCHAR(255),        -- mp.weixin.qq.com/xxx 或 domain
  source_name VARCHAR(255),
  domains TEXT[],
  trust_score INT DEFAULT 50,
  content_type VARCHAR(50),
  frequent_folders INT[],
  sample_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, source_id)
);

-- 索引
CREATE INDEX idx_source_profiles_user_source ON source_profiles(user_id, source_id);
CREATE INDEX idx_source_profiles_domains ON source_profiles USING GIN(domains);
```

**收益**:

- 同一公众号的文章自动获得领域标签
- 分类时可直接查询 `frequent_folders` 作为强信号
- 预期准确率提升 **5-10%**

### 5.2 多向量表征 (Multi-Vector Representation)

**目标**: 解决单向量语义模糊问题，不同场景使用不同向量

```typescript
interface BookmarkVectors {
  titleEmbedding: number[]; // 标题向量 (快速匹配，256维)
  contentEmbedding: number[]; // 内容向量 (语义理解，1024维)
  tagEmbedding: number[]; // 标签向量 (分类匹配，256维)
  combinedEmbedding: number[]; // 加权融合向量 (兼容现有，1024维)
}

interface EnhancedFolderProfile {
  // 现有字段
  profileEmbedding: number[];
  topTags: string[];

  // 核心区 (Core Zone) - 典型内容
  coreEmbedding: number[]; // 核心内容向量均值
  coreTags: string[]; // 核心高频标签
  coreBookmarkIds: number[]; // 代表性书签 ID

  // 边缘区 (Edge Zone) - 边界内容
  edgeEmbedding: number[]; // 边缘内容向量均值
  edgeTags: string[]; // 边缘低频标签

  // 排除区 (Exclusion Zone) - 负样本
  excludedTags: string[]; // 明确不属于此文件夹的标签
  excludedSources: string[]; // 明确排除的来源
  excludedEmbeddings: number[][]; // 排除的向量样本
}
```

```sql
-- 扩展 bookmarks 表
ALTER TABLE bookmarks
  ADD COLUMN title_embedding VECTOR(256),
  ADD COLUMN content_embedding VECTOR(1024),
  ADD COLUMN tag_embedding VECTOR(256),
  ADD COLUMN source_id VARCHAR(255);

-- 扩展 folder_profiles 表
ALTER TABLE folder_profiles
  ADD COLUMN core_embedding VECTOR(1024),
  ADD COLUMN edge_embedding VECTOR(1024),
  ADD COLUMN core_tags TEXT[],
  ADD COLUMN core_bookmark_ids INT[],
  ADD COLUMN excluded_tags TEXT[],
  ADD COLUMN excluded_sources TEXT[];
```

**使用场景**:

- **标题向量**: 快速路径粗筛
- **内容向量**: 精准路径深度匹配
- **标签向量**: 与文件夹画像标签匹配
- **核心区**: 高置信度匹配判断
- **边缘区**: 模糊匹配参考
- **排除区**: 负样本过滤

**收益**: 预期准确率提升 **10-15%**

### 5.3 标签图谱 (Tag Graph)

**目标**: 建立标签之间的关联关系，支持语义扩展

```typescript
interface TagRelation {
  tagA: string;
  tagB: string;
  relationType: "synonym" | "parent" | "child" | "related";
  strength: number; // 0-1 关联强度
}

// 示例
const tagRelations: TagRelation[] = [
  { tagA: "AI", tagB: "人工智能", relationType: "synonym", strength: 1.0 },
  { tagA: "AI", tagB: "机器学习", relationType: "parent", strength: 0.8 },
  { tagA: "机器学习", tagB: "深度学习", relationType: "parent", strength: 0.9 },
  { tagA: "React", tagB: "前端", relationType: "child", strength: 0.7 },
];
```

**Phase 2 实现**，优先级较低。

---

## 六、快慢双路径架构

### 6.1 路由决策器

```
                    ┌─────────────────────────────────────┐
                    │        路由决策器                   │
                    │  (ContentComplexityRouter)          │
                    └──────────────┬──────────────────────┘
                                   │
            ┌──────────────────────┴──────────────────────┐
            │                                              │
            ▼                                              ▼
    ┌───────────────┐                            ┌────────────────┐
    │   快速路径    │                            │    精准路径    │
    │  (Fast Path)  │                            │ (Accurate Path)│
    │   目标<300ms  │                            │   目标<2s      │
    └───────┬───────┘                            └────────┬───────┘
            │                                              │
    ┌───────┴───────┐                            ┌────────┴────────┐
    │               │                            │                 │
┌───▼───┐     ┌─────▼─────┐                ┌─────▼─────┐    ┌──────▼──────┐
│来源   │     │ 规则/标签 │                │  向量深搜 │    │  AI 确认   │
│直匹配 │     │   匹配    │                │  + KNN    │    │ (DeepSeek) │
│<50ms  │     │  <100ms   │                │  <500ms   │    │   <1.5s    │
└───────┘     └───────────┘                └───────────┘    └─────────────┘
```

### 6.2 路由策略

```typescript
interface ContentComplexitySignals {
  hasKnownSource: boolean; // 已知来源
  sourceFrequency: number; // 来源历史分类次数
  tagOverlapRatio: number; // 标签与现有文件夹重叠度
  contentLength: number; // 内容长度
  folderCount: number; // 用户文件夹数量
  recentSimilarClassifications: number; // 最近类似分类次数
  userTrustMode: TrustMode; // 用户托管模式
}

function routeClassification(
  signals: ContentComplexitySignals,
): "fast" | "accurate" {
  // 不托管模式: 不进行自动分类
  if (signals.userTrustMode === "manual") {
    return "skip"; // 直接放入待整理
  }

  // 快速路径条件 (任一满足)
  if (signals.hasKnownSource && signals.sourceFrequency >= 5) return "fast";
  if (signals.tagOverlapRatio >= 0.8) return "fast";
  if (signals.recentSimilarClassifications >= 3) return "fast";

  // 精准路径
  return "accurate";
}
```

### 6.3 快速路径匹配器

```typescript
class FastPathMatcher {
  async match(
    context: MatcherContext,
    trustMode: TrustMode,
  ): Promise<ClassificationResult> {
    // Step 1: 来源直接匹配 (<50ms)
    const sourceMatch = await this.matchBySource(context);
    if (sourceMatch && sourceMatch.confidence >= 85) {
      return this.createResult(sourceMatch, "source_direct");
    }

    // Step 2: 纠错缓存匹配 (<10ms)
    const correctionMatch = await this.matchByCorrection(context);
    if (correctionMatch) {
      return this.createResult(correctionMatch, "correction_cache");
    }

    // Step 3: 标签规则匹配 (<100ms)
    const tagMatch = await this.matchByTags(context);
    if (tagMatch && tagMatch.confidence >= 80) {
      return this.createResult(tagMatch, "tag_rule");
    }

    // Step 4: 标题向量快速搜索 (<150ms)
    const titleVectorMatch = await this.matchByTitleVector(context);
    if (titleVectorMatch && titleVectorMatch.confidence >= 80) {
      return this.createResult(titleVectorMatch, "title_vector");
    }

    // 快速路径无法确定，交给精准路径
    return null;
  }
}
```

### 6.4 性能预期

| 路径         | 占比 | 响应时间 | 准确率  |
| ------------ | ---- | -------- | ------- |
| 快速路径     | 60%  | <300ms   | 85%     |
| 精准路径     | 40%  | <2s      | 90%     |
| **加权平均** | 100% | **<1s**  | **87%** |

---

## 七、置信度与确认机制

### 7.1 置信度重新校准

当前问题：置信度与实际准确率不匹配

```typescript
interface CalibratedConfidence {
  rawScore: number; // 原始得分
  calibratedScore: number; // 校准后得分
  factors: {
    matcherAgreement: number; // 多匹配器一致性
    sourceReliability: number; // 来源可信度
    historicalAccuracy: number; // 历史准确率
    contentClarity: number; // 内容清晰度
  };
}

function calibrateConfidence(
  result: ClassificationResult,
): CalibratedConfidence {
  let calibrated = result.confidence;

  // 因素1: 多匹配器一致性
  const matcherAgreement = calculateMatcherAgreement(result.matchDetails);
  if (matcherAgreement < 0.5) calibrated *= 0.8; // 不一致降分

  // 因素2: 来源可信度
  const sourceReliability = result.sourceProfile?.trustScore ?? 50;
  calibrated *= 0.7 + 0.3 * (sourceReliability / 100);

  // 因素3: 历史准确率 (该文件夹的历史准确率)
  const folderAccuracy = getFolderHistoricalAccuracy(result.folderId);
  calibrated *= 0.8 + 0.2 * folderAccuracy;

  // 因素4: Top2 分数差距
  if (result.candidates?.length >= 2) {
    const scoreDiff = result.candidates[0].score - result.candidates[1].score;
    if (scoreDiff < 10) calibrated *= 0.7; // 模糊匹配降分
  }

  return {
    rawScore: result.confidence,
    calibratedScore: Math.round(calibrated),
    factors: {
      matcherAgreement,
      sourceReliability,
      historicalAccuracy: folderAccuracy,
      contentClarity: 1,
    },
  };
}
```

### 7.2 托管模式下的确认机制

```typescript
async function handleClassificationResult(
  result: ClassificationResult,
  trustMode: TrustMode,
  userId: string,
): Promise<ClassificationOutcome> {
  const calibrated = calibrateConfidence(result);

  switch (trustMode) {
    case "full_auto":
      // 完全托管: 全自动，不确认
      if (calibrated.calibratedScore >= 60) {
        return { action: "classify", folderId: result.folderId };
      } else {
        return { action: "inbox", reason: "low_confidence_auto" };
      }

    case "semi_auto":
      // 半托管: 高置信自动，低置信发消息确认
      if (calibrated.calibratedScore >= 75) {
        return { action: "classify", folderId: result.folderId };
      } else if (calibrated.calibratedScore >= 50) {
        // 创建待确认消息
        await createPendingConfirmation(userId, result, calibrated);
        return { action: "pending", message: "confirmation_sent" };
      } else {
        return { action: "inbox", reason: "very_low_confidence" };
      }

    case "manual":
      // 不托管: 直接放入待整理
      return { action: "inbox", reason: "manual_mode" };
  }
}
```

### 7.3 待确认消息设计 (半托管模式)

```typescript
interface PendingConfirmationMessage {
  id: string;
  type: "classification_confirm";
  bookmark: {
    id: number;
    title: string;
    url: string;
    summary: string;
  };
  suggestion: {
    folderId: number;
    folderName: string;
    confidence: number;
    reason: string;
  };
  alternatives: Array<{
    folderId: number;
    folderName: string;
    confidence: number;
  }>;
  actions: {
    confirm: { label: "确认"; action: "accept_suggestion" };
    selectOther: { label: "选择其他"; action: "show_alternatives" };
    createNew: { label: "新建文件夹"; action: "create_folder" };
    toInbox: { label: "放入待整理"; action: "move_to_inbox" };
  };
  // 记忆选项
  rememberSource: boolean; // 是否记住来源偏好
  expiresAt: string; // 过期时间 (7天后按建议执行)
}
```

**消息展示 UI**:

```
┌─────────────────────────────────────────────────────────────┐
│  📚 帮我确认一下这篇内容的分类                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  "深度学习在自动驾驶中的应用"                                │
│  来源: 机器之心                                             │
│                                                             │
│  我建议放入:                                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  📁 人工智能  (72% 匹配)                            │   │
│  │  理由: 标签匹配 "深度学习"、"AI"                    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  其他选择:                                                  │
│  ○ 汽车科技 (65% 匹配)                                     │
│  ○ 其他文件夹...                                           │
│  ○ 新建文件夹: [________________]                          │
│  ○ 放入待整理                                              │
│                                                             │
│  ☐ 记住: "机器之心" 的内容优先归到此分类                    │
│                                                             │
│         [ 7天后自动按建议处理 ]          [ 确认 ]           │
└─────────────────────────────────────────────────────────────┘
```

---

## 八、负样本学习机制

### 8.1 负样本来源

| 用户行为                   | 学习动作                   | 托管模式  |
| -------------------------- | -------------------------- | --------- |
| 从文件夹A移到文件夹B       | A 记录负样本               | Full/Semi |
| 半托管确认时选择"不是这个" | 记录到排除规则             | Semi      |
| 批量移出某类内容           | 自动识别共同特征，批量记录 | Full/Semi |
| 删除分类错误的书签         | 分析删除原因，记录负样本   | Full/Semi |

### 8.2 数据模型

```sql
-- 文件夹排除规则表
CREATE TABLE folder_exclusions (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users,
  folder_id BIGINT REFERENCES folders(id) ON DELETE CASCADE,

  -- 排除类型
  exclusion_type VARCHAR(50), -- 'tag' | 'source' | 'embedding' | 'keyword'

  -- 排除值 (根据类型填充)
  excluded_tag VARCHAR(100),
  excluded_source_id VARCHAR(255),
  excluded_keyword VARCHAR(100),
  excluded_embedding VECTOR(1024),

  -- 权重 (0-1, 越高越强排除)
  weight FLOAT DEFAULT 0.5,

  -- 来源
  created_from VARCHAR(50), -- 'user_move' | 'user_reject' | 'bulk_move' | 'auto_learn'
  original_bookmark_id BIGINT,

  -- 有效期 (可选，用于衰减)
  expires_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_folder_exclusions_folder ON folder_exclusions(folder_id);
CREATE INDEX idx_folder_exclusions_tag ON folder_exclusions(excluded_tag) WHERE exclusion_type = 'tag';
CREATE INDEX idx_folder_exclusions_source ON folder_exclusions(excluded_source_id) WHERE exclusion_type = 'source';
```

### 8.3 负样本匹配器

```typescript
class NegativeSampleMatcher implements Matcher {
  async match(context: MatcherContext): Promise<MatchResult[]> {
    // 只在 Full Auto 和 Semi Auto 模式下启用
    if (context.trustMode === "manual") {
      return context.candidates;
    }

    const exclusions = await this.loadExclusions(context.userId);

    return context.candidates.map((candidate) => {
      const penalty = this.calculateExclusionPenalty(
        context,
        candidate.folderId,
        exclusions,
      );

      if (penalty > 0) {
        return {
          ...candidate,
          score: candidate.score * (1 - penalty),
          reason: `${candidate.reason} (排除规则: -${Math.round(penalty * 100)}%)`,
          metadata: { ...candidate.metadata, exclusionPenalty: penalty },
        };
      }

      return candidate;
    });
  }

  private calculateExclusionPenalty(
    context: MatcherContext,
    folderId: number,
    exclusions: FolderExclusion[],
  ): number {
    const folderExclusions = exclusions.filter((e) => e.folderId === folderId);
    if (folderExclusions.length === 0) return 0;

    let totalPenalty = 0;

    for (const exclusion of folderExclusions) {
      switch (exclusion.exclusionType) {
        case "tag":
          if (context.tags.includes(exclusion.excludedTag!)) {
            totalPenalty += 0.3 * exclusion.weight;
          }
          break;

        case "source":
          if (context.sourceId === exclusion.excludedSourceId) {
            totalPenalty += 0.4 * exclusion.weight;
          }
          break;

        case "embedding":
          const similarity = cosineSimilarity(
            context.embedding,
            exclusion.excludedEmbedding!,
          );
          if (similarity > 0.85) {
            totalPenalty += 0.5 * exclusion.weight * similarity;
          }
          break;

        case "keyword":
          if (
            context.title.includes(exclusion.excludedKeyword!) ||
            context.summary?.includes(exclusion.excludedKeyword!)
          ) {
            totalPenalty += 0.2 * exclusion.weight;
          }
          break;
      }
    }

    return Math.min(totalPenalty, 0.9); // 最多降 90%
  }
}
```

### 8.4 学习触发逻辑

```typescript
// 监听用户纠正事件
eventBus.on("correction:applied", async (event: CorrectionAppliedEvent) => {
  // 只在 Full Auto 和 Semi Auto 模式下学习
  const trustMode = await getUserTrustMode(event.userId);
  if (trustMode === "manual") return;

  // 记录负样本到原文件夹
  if (event.fromFolderId) {
    await recordNegativeSample({
      userId: event.userId,
      folderId: event.fromFolderId,
      bookmark: event.bookmarkFeatures,
      createdFrom: event.correctionType,
    });
  }

  // 更新来源画像的高频文件夹
  if (event.bookmarkFeatures.sourceId) {
    await updateSourceProfile(event.userId, event.bookmarkFeatures.sourceId, {
      addFrequentFolder: event.toFolderId,
      removeFrequentFolder: event.fromFolderId,
    });
  }
});

async function recordNegativeSample(params: {
  userId: string;
  folderId: number;
  bookmark: BookmarkFeatures;
  createdFrom: string;
}) {
  const { userId, folderId, bookmark, createdFrom } = params;

  // 记录标签排除
  for (const tag of bookmark.tags) {
    await upsertExclusion({
      userId,
      folderId,
      exclusionType: "tag",
      excludedTag: tag,
      weight: 0.5,
      createdFrom,
    });
  }

  // 记录来源排除
  if (bookmark.sourceId) {
    await upsertExclusion({
      userId,
      folderId,
      exclusionType: "source",
      excludedSourceId: bookmark.sourceId,
      weight: 0.6,
      createdFrom,
    });
  }

  // 记录向量排除 (相似度高的内容)
  await upsertExclusion({
    userId,
    folderId,
    exclusionType: "embedding",
    excludedEmbedding: bookmark.embedding,
    weight: 0.4,
    createdFrom,
  });
}
```

---

## 九、三系统深度协同

### 9.1 统一事件流

```
┌──────────────────────────────────────────────────────────────────────────┐
│                     统一事件流 (Unified Event Stream)                    │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  [用户收藏] ───────────────────────────────────────────────────────────▶ │
│       │                                                                  │
│       ▼                                                                  │
│  [AI 摘要完成] ─────┬───────────────────────────────────────────────────▶│
│       │            │                                                     │
│       │    summary:completed                                             │
│       │            │                                                     │
│       │            ▼                                                     │
│       │    [特征提取] ────────────────────────────────────────────────▶  │
│       │         │                                                        │
│       │  feature:extracted                                               │
│       │         │                                                        │
│       │         ▼                                                        │
│       └───▶ [智能分类] ───────────────────────────────────────────────▶  │
│                 │                                                        │
│      classification:completed                                            │
│                 │                                                        │
│       ┌─────────┴─────────┐                                              │
│       ▼                   ▼                                              │
│  [画像增量更新]     [待确认消息] (Semi Auto)                             │
│       │                   │                                              │
│  profile:updated    confirmation:created                                 │
│       │                   │                                              │
│       ▼                   ▼                                              │
│  [健康检查]         [用户响应]                                           │
│       │                   │                                              │
│       │           confirmation:resolved                                  │
│       │                   │                                              │
│       ├───────────────────┘                                              │
│       ▼                                                                  │
│  [自组织建议] ───────────────────────────────────────────────────────▶   │
│       │                                                                  │
│  suggestion:generated                                                    │
│       │                                                                  │
│       ▼ (Full Auto: 自动执行 / Semi Auto: 发消息)                        │
│  [执行或确认]                                                            │
│       │                                                                  │
│  organization:executed                                                   │
│       │                                                                  │
│       ▼                                                                  │
│  [用户纠正] (如有) ──────────────────────────────────────────────────▶   │
│       │                                                                  │
│  correction:applied                                                      │
│       │                                                                  │
│       ▼                                                                  │
│  [负样本学习] ───────────────────────────────────────────────────────▶   │
│       │                                                                  │
│  learning:completed                                                      │
│       │                                                                  │
│       └───────▶ [画像优化] ──────▶ [更准确的分类] ──────▶ 正向飞轮      │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### 9.2 新增事件类型

```typescript
// 扩展 event-types.ts
interface EnhancedEventTypes extends EventTypes {
  // ============ AI 摘要事件 ============
  "summary:completed": {
    userId: string;
    bookmarkId: number;
    summary: string;
    extractedTags: string[];
    sourceId: string;
    sourceName: string;
    contentType: string;
    timestamp: string;
  };

  // ============ 特征提取事件 ============
  "feature:extracted": {
    userId: string;
    bookmarkId: number;
    titleEmbedding: number[];
    contentEmbedding: number[];
    tagEmbedding: number[];
    sourceProfile: SourceProfile | null;
    timestamp: string;
  };

  // ============ 待确认事件 (半托管模式) ============
  "confirmation:created": {
    userId: string;
    confirmationId: string;
    bookmarkId: number;
    type: "classification" | "folder_create" | "folder_merge";
    suggestion: object;
    expiresAt: string;
    timestamp: string;
  };

  "confirmation:resolved": {
    userId: string;
    confirmationId: string;
    resolution: "accepted" | "rejected" | "alternative" | "expired";
    userChoice: object;
    timestamp: string;
  };

  // ============ 用户纠正事件 (增强版) ============
  "correction:applied": {
    userId: string;
    bookmarkId: number;
    fromFolderId: number | null;
    toFolderId: number;
    correctionType: "manual_move" | "confirm_reject" | "bulk_move";
    bookmarkFeatures: {
      tags: string[];
      sourceId: string;
      embedding: number[];
    };
    timestamp: string;
  };

  // ============ 学习事件 ============
  "learning:negative_sample_recorded": {
    userId: string;
    folderId: number;
    exclusionType: string;
    source: string;
    timestamp: string;
  };

  "learning:source_profile_updated": {
    userId: string;
    sourceId: string;
    changes: object;
    timestamp: string;
  };
}
```

### 9.3 协同策略

```typescript
// 托管模式感知的事件处理器
class TrustModeAwareEventHandler {
  async handleClassificationCompleted(event: BookmarkClassifiedEvent) {
    const trustMode = await getUserTrustMode(event.userId);

    // 1. 无论什么模式，都更新画像
    await this.updateFolderProfile(event);

    // 2. 根据模式决定后续动作
    switch (trustMode) {
      case "full_auto":
        // 自动执行健康检查和自组织
        await this.scheduleHealthCheck(event.userId, event.folderId);
        break;

      case "semi_auto":
        // 检查是否需要发送确认消息
        if (event.confidence < 75) {
          await this.createConfirmationMessage(event);
        } else {
          await this.scheduleHealthCheck(event.userId, event.folderId);
        }
        break;

      case "manual":
        // 不做额外处理
        break;
    }
  }

  async handleSuggestionGenerated(event: SuggestionGeneratedEvent) {
    const trustMode = await getUserTrustMode(event.userId);

    switch (trustMode) {
      case "full_auto":
        // 自动执行建议
        await this.autoExecuteSuggestion(event);
        break;

      case "semi_auto":
        // 发送确认消息
        await this.createSuggestionConfirmation(event);
        break;

      case "manual":
        // 不发送，用户主动查看时才显示
        break;
    }
  }
}
```

---

## 十、消息系统集成

### 10.1 消息类型设计

```typescript
// 与托管模式集成的消息类型
interface TrustModeMessage {
  // 基础字段
  id: string;
  userId: string;
  type: MessageType;
  title: string;
  content: string;
  createdAt: string;

  // 托管模式相关
  trustModeRelevant: boolean; // 是否与托管模式相关
  confirmationId?: string; // 关联的待确认 ID (半托管)

  // 动作
  actions?: MessageAction[];

  // 过期处理
  expiresAt?: string;
  expiredAction?: "auto_execute" | "discard";
}

type MessageType =
  | "classification_confirm" // 分类确认 (半托管)
  | "folder_suggestion" // 文件夹建议 (半托管)
  | "major_reorganization" // 重大重组通知 (完全托管)
  | "learning_milestone" // 学习里程碑
  | "system_info"; // 系统信息
```

### 10.2 各模式消息策略

| 消息类型      | Full Auto     | Semi Auto     | Manual          |
| ------------- | ------------- | ------------- | --------------- |
| 分类确认      | ❌ 不发送     | ✅ 发送       | ❌ 不发送       |
| 文件夹创建    | ❌ 静默执行   | ✅ 发送确认   | ❌ 不发送       |
| 合并/拆分建议 | ✅ 执行后通知 | ✅ 确认后执行 | ❌ 用户主动查看 |
| 重大重组      | ✅ 通知       | ✅ 通知       | ❌ 不发送       |
| 学习里程碑    | ✅ 通知       | ✅ 通知       | ❌ 不发送       |

### 10.3 消息触发逻辑

```typescript
class MessageTriggerService {
  async onClassificationCompleted(event: BookmarkClassifiedEvent) {
    const trustMode = await getUserTrustMode(event.userId);

    if (trustMode === "semi_auto" && event.confidence < 75) {
      await this.createMessage({
        userId: event.userId,
        type: "classification_confirm",
        title: "帮我确认一下分类",
        content: `"${event.bookmarkTitle}" 建议放入 "${event.folderName}"`,
        confirmationId: event.confirmationId,
        actions: [
          { label: "确认", action: "accept" },
          { label: "选择其他", action: "select_other" },
          { label: "放入待整理", action: "to_inbox" },
        ],
        expiresAt: addDays(new Date(), 7),
        expiredAction: "auto_execute",
      });
    }
  }

  async onMajorReorganization(event: ReorganizationEvent) {
    const trustMode = await getUserTrustMode(event.userId);

    if (trustMode !== "manual") {
      await this.createMessage({
        userId: event.userId,
        type: "major_reorganization",
        title: "文件夹整理完成",
        content: `已自动合并 ${event.mergedCount} 个相似文件夹，创建 ${event.createdCount} 个新文件夹`,
        actions: [
          { label: "查看详情", action: "view_details" },
          { label: "撤销", action: "undo", confirmRequired: true },
        ],
      });
    }
  }
}
```

---

## 十一、设置界面设计

### 11.1 托管模式设置 UI

```
┌─────────────────────────────────────────────────────────────────┐
│  ⚙️ 智能分类设置                                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  托管模式                                                       │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ◉ 完全托管 (推荐)                                       │   │
│  │   只管收藏，AI 全权负责整理                             │   │
│  │   • 自动分类到合适的文件夹                              │   │
│  │   • 自动创建、合并、优化文件夹                          │   │
│  │   • 仅在重大变更时通知                                  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ○ 半托管                                                │   │
│  │   AI 辅助，重要决定征求你的意见                         │   │
│  │   • 高置信度自动分类，低置信度发消息确认                │   │
│  │   • 文件夹变更前会发消息询问                            │   │
│  │   • 7天未响应按 AI 建议执行                             │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ○ 不托管                                                │   │
│  │   完全手动控制，AI 仅生成摘要                           │   │
│  │   • 所有收藏默认进入待整理                              │   │
│  │   • 手动创建文件夹和分类                                │   │
│  │   • 可随时切换回托管模式                                │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  高级设置 ▼                                                    │
│                                                                 │
│  每日自动创建文件夹上限: [6] 个                                 │
│  低置信度阈值: [60] %                                           │
│  待确认消息过期时间: [7] 天                                     │
│                                                                 │
│                               [ 恢复默认 ]    [ 保存 ]          │
└─────────────────────────────────────────────────────────────────┘
```

### 11.2 模式切换确认

```
┌─────────────────────────────────────────────────────────────────┐
│  切换到「不托管」模式?                                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  切换后:                                                        │
│  • 智能分类将停用，新收藏默认进入待整理                         │
│  • 已有分类和文件夹结构保持不变                                 │
│  • AI 学习数据会保留，随时可切回托管模式                        │
│                                                                 │
│  你的待整理箱当前有 23 条内容，切换后需要手动处理               │
│                                                                 │
│               [ 取消 ]                [ 确认切换 ]              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 十二、数据库迁移清单

### Phase 0: 立即实施

```sql
-- 1. 用户托管模式配置表
CREATE TABLE user_trust_mode (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users UNIQUE,
  trust_mode VARCHAR(20) DEFAULT 'full_auto',
  overrides JSONB DEFAULT '{}',
  mode_history JSONB DEFAULT '[]',
  auto_decisions_count INT DEFAULT 0,
  user_corrections_count INT DEFAULT 0,
  pending_confirmations_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 待确认队列表
CREATE TABLE pending_confirmations (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users,
  confirmation_type VARCHAR(50),
  bookmark_id BIGINT,
  folder_id BIGINT,
  suggestion JSONB,
  status VARCHAR(20) DEFAULT 'pending',
  user_choice JSONB,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX idx_pending_confirmations_user_status
  ON pending_confirmations(user_id, status);
CREATE INDEX idx_pending_confirmations_expires
  ON pending_confirmations(expires_at) WHERE status = 'pending';

-- 3. 来源画像表
CREATE TABLE source_profiles (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users,
  source_id VARCHAR(255),
  source_name VARCHAR(255),
  domains TEXT[],
  trust_score INT DEFAULT 50,
  content_type VARCHAR(50),
  frequent_folders INT[],
  sample_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, source_id)
);

CREATE INDEX idx_source_profiles_user_source ON source_profiles(user_id, source_id);
```

### Phase 1: 核心优化

```sql
-- 4. 文件夹排除规则表
CREATE TABLE folder_exclusions (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users,
  folder_id BIGINT REFERENCES folders(id) ON DELETE CASCADE,
  exclusion_type VARCHAR(50),
  excluded_tag VARCHAR(100),
  excluded_source_id VARCHAR(255),
  excluded_keyword VARCHAR(100),
  excluded_embedding VECTOR(1024),
  weight FLOAT DEFAULT 0.5,
  created_from VARCHAR(50),
  original_bookmark_id BIGINT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_folder_exclusions_folder ON folder_exclusions(folder_id);
CREATE INDEX idx_folder_exclusions_tag ON folder_exclusions(excluded_tag)
  WHERE exclusion_type = 'tag';
CREATE INDEX idx_folder_exclusions_source ON folder_exclusions(excluded_source_id)
  WHERE exclusion_type = 'source';

-- 5. 扩展 folder_profiles 表 (核心区/边缘区)
ALTER TABLE folder_profiles
  ADD COLUMN core_embedding VECTOR(1024),
  ADD COLUMN edge_embedding VECTOR(1024),
  ADD COLUMN core_tags TEXT[],
  ADD COLUMN core_bookmark_ids INT[],
  ADD COLUMN excluded_tags TEXT[],
  ADD COLUMN excluded_sources TEXT[];
```

### Phase 2: 深度优化

```sql
-- 6. 扩展 bookmarks 表 (多向量)
ALTER TABLE bookmarks
  ADD COLUMN title_embedding VECTOR(256),
  ADD COLUMN content_embedding VECTOR(1024),
  ADD COLUMN tag_embedding VECTOR(256),
  ADD COLUMN source_id VARCHAR(255);

-- 7. 向量索引
CREATE INDEX idx_bookmarks_title_embedding_hnsw ON bookmarks
  USING hnsw (title_embedding vector_cosine_ops);
CREATE INDEX idx_folder_profiles_core_embedding_hnsw ON folder_profiles
  USING hnsw (core_embedding vector_cosine_ops);
```

---

## 十三、实施路线图

### Phase 0: 立即可做 (1周内)

| 任务                  | 工作量 | 收益         | 优先级 |
| --------------------- | ------ | ------------ | ------ |
| 托管模式配置表        | 1天    | 架构基础     | P0     |
| 托管模式设置 UI       | 2天    | 用户可配置   | P0     |
| 来源画像表 + 基础逻辑 | 2天    | 准确率+5%    | P0     |
| 快慢路径路由器        | 2天    | 响应时间-60% | P0     |

### Phase 1: 核心优化 (2-3周)

| 任务                    | 工作量 | 收益           | 优先级 |
| ----------------------- | ------ | -------------- | ------ |
| 待确认消息系统 (半托管) | 5天    | 半托管核心能力 | P1     |
| 负样本学习机制          | 5天    | 避免重复错误   | P1     |
| 核心区/边缘区画像       | 5天    | 准确率+10%     | P1     |
| 置信度校准系统          | 3天    | 决策可信       | P1     |

### Phase 2: 深度优化 (3-4周)

| 任务               | 工作量 | 收益       | 优先级 |
| ------------------ | ------ | ---------- | ------ |
| 多向量表征系统     | 10天   | 准确率+15% | P2     |
| 三系统事件深度协同 | 7天    | 系统协同   | P2     |
| 标签图谱           | 5天    | 语义扩展   | P2     |

---

## 十四、成功指标

| 指标                 | 当前值 | Phase 0 目标 | Phase 1 目标 | Phase 2 目标 |
| -------------------- | ------ | ------------ | ------------ | ------------ |
| **分类准确率**       | ~70%   | ≥75%         | ≥82%         | ≥87%         |
| **平均响应时间**     | 4s+    | <1.5s        | <1s          | <800ms       |
| **用户纠正率**       | ~30%   | <25%         | <18%         | <13%         |
| **完全托管用户占比** | N/A    | ≥70%         | ≥75%         | ≥80%         |
| **半托管确认响应率** | N/A    | N/A          | ≥60%         | ≥70%         |

---

## 十五、风险与缓解

| 风险                       | 影响             | 缓解措施                   |
| -------------------------- | ---------------- | -------------------------- |
| 完全托管模式下 AI 频繁出错 | 用户流失         | 渐进式开放，先小范围验证   |
| 半托管消息过多骚扰用户     | 切换到不托管     | 智能聚合，控制消息频率     |
| 负样本学习过拟合           | 文件夹覆盖面缩小 | 设置排除规则上限，定期清理 |
| 多向量存储成本增加         | 成本上升         | 渐进式迁移，可按需启用     |
| 模式切换数据迁移问题       | 用户困惑         | 保留所有数据，无损切换     |

---

## 十六、总结

本架构优化方案以 **"只管收藏，后续 0 操心 0 干预"** 的产品理念为核心，通过引入托管模式机制，实现了：

1. **灵活性**: 用户可选择适合自己的托管程度
2. **智能性**: 完全托管模式下 AI 全权负责，持续学习进化
3. **可控性**: 半托管模式保留用户决策权，重要事项征求意见
4. **包容性**: 不托管模式兼容传统使用习惯

同时，通过 **共享特征层**、**快慢双路径**、**负样本学习**、**三系统深度协同** 等技术手段，显著提升智能分类的准确率和响应速度。

**核心价值**:

- 完全托管 = AnyKeep 的差异化竞争力
- 半托管 = 用户信任培养过渡期
- 不托管 = 兜底方案，确保产品可用

建议从 Phase 0 开始实施，快速验证托管模式的核心价值，再逐步深化优化。

---

## 十七、完整任务清单与分段实施计划

### 17.1 任务总览

本次架构升级共涉及 **68 项开发任务**，分为 4 个阶段实施：

| 阶段        | 时间     | 任务数 | 核心目标         | 预期收益     |
| ----------- | -------- | ------ | ---------------- | ------------ |
| **Phase 0** | 第1-2周  | 18项   | 托管模式基础架构 | 框架搭建完成 |
| **Phase 1** | 第3-5周  | 24项   | 半托管+学习机制  | 准确率+12%   |
| **Phase 2** | 第6-8周  | 18项   | 深度优化+协同    | 准确率+15%   |
| **Phase 3** | 第9-10周 | 8项    | 打磨与测试       | 稳定上线     |

---

### 17.2 Phase 0: 托管模式基础架构 (第1-2周)

**目标**: 搭建托管模式的核心框架，用户可选择模式，基础分流生效

#### Sprint 0.1: 数据库与类型基础 (第1周前半)

| ID    | 任务                            | 类型 | 文件/位置                     | 工作量 | 依赖 |
| ----- | ------------------------------- | ---- | ----------------------------- | ------ | ---- |
| P0-01 | 创建 `user_trust_mode` 表       | DB   | `supabase/migrations/`        | 2h     | -    |
| P0-02 | 创建 `pending_confirmations` 表 | DB   | `supabase/migrations/`        | 2h     | -    |
| P0-03 | 创建 `source_profiles` 表       | DB   | `supabase/migrations/`        | 2h     | -    |
| P0-04 | 定义 TrustMode 类型             | 类型 | `src/types/trust-mode.ts`     | 2h     | -    |
| P0-05 | 定义 Confirmation 类型          | 类型 | `src/types/confirmation.ts`   | 2h     | -    |
| P0-06 | 定义 SourceProfile 类型         | 类型 | `src/types/source-profile.ts` | 1h     | -    |
| P0-07 | 定义 Learning 类型              | 类型 | `src/types/learning.ts`       | 1h     | -    |

**交付物**: 3 个数据库表 + 4 个类型定义文件

#### Sprint 0.2: 后端服务层 (第1周后半)

| ID    | 任务                  | 类型 | 文件/位置                                                   | 工作量 | 依赖     |
| ----- | --------------------- | ---- | ----------------------------------------------------------- | ------ | -------- |
| P0-08 | TrustModeService 服务 | 后端 | `src/lib/trust-mode/trust-mode.service.ts`                  | 4h     | P0-01,04 |
| P0-09 | TrustModeRepository   | 后端 | `src/lib/trust-mode/trust-mode.repository.ts`               | 2h     | P0-01    |
| P0-10 | 托管模式配置常量      | 后端 | `src/lib/trust-mode/config.ts`                              | 2h     | P0-04    |
| P0-11 | 分类服务集成托管模式  | 后端 | `src/lib/classification/services/classification.service.ts` | 4h     | P0-08    |
| P0-12 | 快慢路径路由器        | 后端 | `src/lib/classification/router/content-router.ts`           | 6h     | P0-11    |
| P0-13 | 来源画像服务          | 后端 | `src/lib/source-profile/source-profile.service.ts`          | 4h     | P0-03,06 |

**交付物**: 托管模式核心服务 + 快慢路径路由 + 来源画像基础

#### Sprint 0.3: API 路由层 (第2周前半)

| ID    | 任务                  | 类型 | 文件/位置                                      | 工作量 | 依赖  |
| ----- | --------------------- | ---- | ---------------------------------------------- | ------ | ----- |
| P0-14 | 托管模式 GET/PUT API  | API  | `src/app/api/user/trust-mode/route.ts`         | 3h     | P0-08 |
| P0-15 | 托管模式 PATCH API    | API  | `src/app/api/user/trust-mode/route.ts`         | 2h     | P0-08 |
| P0-16 | 来源画像 GET API      | API  | `src/app/api/sources/route.ts`                 | 2h     | P0-13 |
| P0-17 | 分类 API 集成托管模式 | API  | `src/app/api/classification/classify/route.ts` | 3h     | P0-11 |

**交付物**: 4 个 API 端点

#### Sprint 0.4: 前端设置页面 (第2周后半)

| ID    | 任务                 | 类型 | 文件/位置                                              | 工作量 | 依赖     |
| ----- | -------------------- | ---- | ------------------------------------------------------ | ------ | -------- |
| P0-18 | 托管模式设置卡片组件 | 前端 | `src/components/settings/trust-mode-settings-card.tsx` | 8h     | P0-14    |
| P0-19 | 模式切换确认对话框   | 前端 | `src/components/settings/trust-mode-switch-dialog.tsx` | 4h     | P0-18    |
| P0-20 | 设置页面集成托管模式 | 前端 | `src/components/settings/settings-page-client.tsx`     | 3h     | P0-18,19 |
| P0-21 | 托管模式状态 Hook    | 前端 | `src/hooks/use-trust-mode.ts`                          | 3h     | P0-14    |

**交付物**: 托管模式设置完整 UI

#### Phase 0 验收标准

- [ ] 用户可在设置页面选择三种托管模式
- [ ] 模式切换有确认对话框
- [ ] 分类服务根据模式走不同路径
- [ ] 来源画像可正常保存和查询
- [ ] 快速路径响应时间 < 300ms

---

### 17.3 Phase 1: 半托管与学习机制 (第3-5周)

**目标**: 实现半托管模式的完整消息确认流程，建立负样本学习机制

#### Sprint 1.1: 待确认消息后端 (第3周)

| ID    | 任务                          | 类型 | 文件/位置                                                   | 工作量 | 依赖  |
| ----- | ----------------------------- | ---- | ----------------------------------------------------------- | ------ | ----- |
| P1-01 | PendingConfirmationService    | 后端 | `src/lib/confirmation/confirmation.service.ts`              | 6h     | P0-02 |
| P1-02 | PendingConfirmationRepository | 后端 | `src/lib/confirmation/confirmation.repository.ts`           | 3h     | P0-02 |
| P1-03 | 确认消息过期处理 Cron         | 后端 | `src/lib/confirmation/confirmation-expiry.cron.ts`          | 4h     | P1-01 |
| P1-04 | 消息触发服务                  | 后端 | `src/lib/messages/message-trigger.service.ts`               | 4h     | P1-01 |
| P1-05 | 待确认消息 GET API            | API  | `src/app/api/confirmations/route.ts`                        | 3h     | P1-01 |
| P1-06 | 待确认消息响应 PUT API        | API  | `src/app/api/confirmations/[id]/route.ts`                   | 4h     | P1-01 |
| P1-07 | 半托管分类流程集成            | 后端 | `src/lib/classification/services/classification.service.ts` | 4h     | P1-04 |

**交付物**: 待确认消息完整后端服务

#### Sprint 1.2: 待确认消息前端 (第4周前半)

| ID    | 任务               | 类型 | 文件/位置                                                 | 工作量 | 依赖  |
| ----- | ------------------ | ---- | --------------------------------------------------------- | ------ | ----- |
| P1-08 | 确认消息组件       | 前端 | `src/components/messages/confirmation-message-item.tsx`   | 10h    | P1-05 |
| P1-09 | 文件夹选择器对话框 | 前端 | `src/components/messages/folder-selector-dialog.tsx`      | 6h     | P1-08 |
| P1-10 | 消息列表改造       | 前端 | `src/components/messages/message-list.tsx`                | 4h     | P1-08 |
| P1-11 | 消息项改造         | 前端 | `src/components/messages/message-item.tsx`                | 3h     | P1-08 |
| P1-12 | 待确认筛选标签     | 前端 | `src/components/messages/pending-confirmation-filter.tsx` | 3h     | P1-08 |
| P1-13 | 消息类型扩展       | 前端 | `src/lib/messages/types.ts`                               | 2h     | -     |

**交付物**: 半托管消息确认完整 UI

#### Sprint 1.3: 负样本学习机制 (第4周后半)

| ID    | 任务                        | 类型 | 文件/位置                                                      | 工作量 | 依赖  |
| ----- | --------------------------- | ---- | -------------------------------------------------------------- | ------ | ----- |
| P1-14 | 创建 `folder_exclusions` 表 | DB   | `supabase/migrations/`                                         | 2h     | -     |
| P1-15 | NegativeSampleService       | 后端 | `src/lib/learning/negative-sample.service.ts`                  | 6h     | P1-14 |
| P1-16 | NegativeSampleMatcher       | 后端 | `src/lib/classification/strategies/negative-sample-matcher.ts` | 6h     | P1-15 |
| P1-17 | 学习触发事件监听            | 后端 | `src/lib/learning/learning-event-handler.ts`                   | 4h     | P1-15 |
| P1-18 | 负样本学习 API              | API  | `src/app/api/learning/negative/route.ts`                       | 3h     | P1-15 |
| P1-19 | 分类服务集成负样本匹配      | 后端 | `src/lib/classification/services/classification.service.ts`    | 3h     | P1-16 |

**交付物**: 负样本学习完整机制

#### Sprint 1.4: 学习反馈 UI (第5周)

| ID    | 任务               | 类型 | 文件/位置                                             | 工作量 | 依赖  |
| ----- | ------------------ | ---- | ----------------------------------------------------- | ------ | ----- |
| P1-20 | 学习反馈 Toast     | 前端 | `src/components/bookmark/learning-feedback-toast.tsx` | 4h     | P1-18 |
| P1-21 | 来源信息徽章       | 前端 | `src/components/bookmark/source-badge.tsx`            | 6h     | P0-16 |
| P1-22 | 移动对话框改造     | 前端 | `src/components/bookmark/move-to-folder-dialog.tsx`   | 4h     | P1-20 |
| P1-23 | 书签详情页改造     | 前端 | `src/components/bookmark/bookmark-detail-client.tsx`  | 4h     | P1-21 |
| P1-24 | 待整理页面模式感知 | 前端 | `src/components/inbox/inbox-page-client.tsx`          | 3h     | P0-21 |

**交付物**: 学习反馈完整 UI

#### Phase 1 验收标准

- [ ] 半托管模式下低置信度分类触发确认消息
- [ ] 用户可在消息中心确认/拒绝/选择其他
- [ ] 确认消息 7 天后自动按建议执行
- [ ] 用户移动书签后系统学习并显示反馈
- [ ] 来源信息在书签卡片/详情页显示

---

### 17.4 Phase 2: 深度优化与协同 (第6-8周)

**目标**: 实现多向量表征、核心区/边缘区画像、三系统深度协同

#### Sprint 2.1: 置信度校准 (第6周前半)

| ID    | 任务                         | 类型 | 文件/位置                                                              | 工作量 | 依赖  |
| ----- | ---------------------------- | ---- | ---------------------------------------------------------------------- | ------ | ----- |
| P2-01 | ConfidenceCalibrationService | 后端 | `src/lib/classification/calibration/confidence-calibration.service.ts` | 8h     | -     |
| P2-02 | 多匹配器一致性评估           | 后端 | `src/lib/classification/calibration/matcher-agreement.ts`              | 4h     | P2-01 |
| P2-03 | 历史准确率统计服务           | 后端 | `src/lib/classification/calibration/accuracy-tracker.service.ts`       | 4h     | P2-01 |
| P2-04 | 分类服务集成置信度校准       | 后端 | `src/lib/classification/services/classification.service.ts`            | 3h     | P2-01 |

**交付物**: 置信度校准完整机制

#### Sprint 2.2: 核心区/边缘区画像 (第6周后半-第7周前半)

| ID    | 任务                    | 类型 | 文件/位置                                                          | 工作量 | 依赖  |
| ----- | ----------------------- | ---- | ------------------------------------------------------------------ | ------ | ----- |
| P2-05 | 扩展 folder_profiles 表 | DB   | `supabase/migrations/`                                             | 2h     | -     |
| P2-06 | CoreEdgeProfileService  | 后端 | `src/lib/classification/profile/core-edge-profile.service.ts`      | 8h     | P2-05 |
| P2-07 | 核心区计算算法          | 后端 | `src/lib/classification/profile/core-zone-calculator.ts`           | 6h     | P2-06 |
| P2-08 | 边缘区计算算法          | 后端 | `src/lib/classification/profile/edge-zone-calculator.ts`           | 4h     | P2-06 |
| P2-09 | 画像增量更新优化        | 后端 | `src/lib/classification/services/profile-event-handler.service.ts` | 4h     | P2-06 |
| P2-10 | 向量匹配器集成核心区    | 后端 | `src/lib/classification/strategies/vector-matcher.ts`              | 4h     | P2-06 |

**交付物**: 核心区/边缘区画像完整机制

#### Sprint 2.3: 多向量表征 (第7周后半-第8周)

| ID    | 任务                        | 类型 | 文件/位置                                             | 工作量 | 依赖  |
| ----- | --------------------------- | ---- | ----------------------------------------------------- | ------ | ----- |
| P2-11 | 扩展 bookmarks 表 (多向量)  | DB   | `supabase/migrations/`                                | 3h     | -     |
| P2-12 | MultiVectorEmbeddingService | 后端 | `src/lib/embedding/multi-vector-embedding.service.ts` | 8h     | P2-11 |
| P2-13 | 标题向量生成器              | 后端 | `src/lib/embedding/title-embedding-generator.ts`      | 4h     | P2-12 |
| P2-14 | 内容向量生成器              | 后端 | `src/lib/embedding/content-embedding-generator.ts`    | 4h     | P2-12 |
| P2-15 | 标签向量生成器              | 后端 | `src/lib/embedding/tag-embedding-generator.ts`        | 4h     | P2-12 |
| P2-16 | 快速路径集成标题向量        | 后端 | `src/lib/classification/router/content-router.ts`     | 4h     | P2-13 |
| P2-17 | 向量索引创建                | DB   | `supabase/migrations/`                                | 2h     | P2-11 |
| P2-18 | 存量数据多向量迁移脚本      | 后端 | `scripts/migrate-multi-vector.ts`                     | 6h     | P2-12 |

**交付物**: 多向量表征完整系统

#### Phase 2 验收标准

- [ ] 置信度与实际准确率差异 < 10%
- [ ] 核心区匹配准确率 > 90%
- [ ] 多向量存储正常工作
- [ ] 快速路径使用标题向量
- [ ] 存量数据迁移完成

---

### 17.5 Phase 3: 打磨与测试 (第9-10周)

**目标**: 新用户引导、性能优化、全面测试、上线准备

#### Sprint 3.1: 用户引导与体验优化 (第9周)

| ID    | 任务             | 类型 | 文件/位置                                                 | 工作量 | 依赖  |
| ----- | ---------------- | ---- | --------------------------------------------------------- | ------ | ----- |
| P3-01 | 托管模式引导组件 | 前端 | `src/components/onboarding/trust-mode-guide.tsx`          | 6h     | P0-18 |
| P3-02 | 首次使用引导流程 | 前端 | `src/components/onboarding/first-time-setup.tsx`          | 4h     | P3-01 |
| P3-03 | 待确认消息专页   | 前端 | `src/app/(main)/messages/pending/page.tsx`                | 6h     | P1-08 |
| P3-04 | 托管模式统计 API | API  | `src/app/api/user/trust-mode/stats/route.ts`              | 3h     | P0-08 |
| P3-05 | 分类决策理由 API | API  | `src/app/api/classification/[bookmarkId]/reason/route.ts` | 3h     | -     |

**交付物**: 完整用户引导 + 统计能力

#### Sprint 3.2: 测试与上线 (第10周)

| ID    | 任务               | 类型 | 文件/位置                                   | 工作量 | 依赖   |
| ----- | ------------------ | ---- | ------------------------------------------- | ------ | ------ |
| P3-06 | 托管模式单元测试   | 测试 | `src/lib/trust-mode/__tests__/`             | 8h     | All P0 |
| P3-07 | 半托管流程集成测试 | 测试 | `src/lib/confirmation/__tests__/`           | 6h     | All P1 |
| P3-08 | 性能测试与优化     | 测试 | -                                           | 8h     | All    |
| P3-09 | A/B 测试配置       | 后端 | `src/lib/trust-mode/ab-test.config.ts`      | 4h     | -      |
| P3-10 | 监控指标埋点       | 后端 | `src/lib/metrics/classification-metrics.ts` | 4h     | -      |
| P3-11 | 上线文档编写       | 文档 | `docs/trust-mode-release.md`                | 3h     | -      |
| P3-12 | 灰度发布配置       | 运维 | -                                           | 2h     | -      |

**交付物**: 测试覆盖 + 监控 + 上线准备

#### Phase 3 验收标准

- [ ] 新用户可完成托管模式引导
- [ ] 核心流程测试覆盖率 > 80%
- [ ] 性能指标达标（准确率、响应时间）
- [ ] 监控告警配置完成
- [ ] 灰度发布 10% 用户运行正常

---

### 17.6 任务依赖关系图

```
Phase 0 (基础架构)
├── P0-01~07 (数据库+类型) ─────────────────┐
│                                           │
├── P0-08~13 (后端服务) ◀───────────────────┤
│   ├── P0-08 TrustModeService ◀── P0-01,04 │
│   ├── P0-11 分类服务集成 ◀── P0-08        │
│   ├── P0-12 快慢路径 ◀── P0-11            │
│   └── P0-13 来源画像 ◀── P0-03,06         │
│                                           │
├── P0-14~17 (API) ◀────────────────────────┤
│   └── P0-14~17 ◀── P0-08,11,13            │
│                                           │
└── P0-18~21 (前端) ◀── P0-14               │
                                            │
Phase 1 (半托管+学习)                        │
├── P1-01~07 (确认消息后端) ◀── P0-02 ◀─────┘
│   └── P1-07 ◀── P1-04 ◀── P1-01
│
├── P1-08~13 (确认消息前端) ◀── P1-05
│
├── P1-14~19 (负样本学习) ◀── P1-14 (新表)
│   └── P1-19 ◀── P1-16 ◀── P1-15
│
└── P1-20~24 (学习反馈UI) ◀── P1-18, P0-16

Phase 2 (深度优化)
├── P2-01~04 (置信度校准) ◀── Phase 1 完成
│
├── P2-05~10 (核心区/边缘区) ◀── P2-05 (表扩展)
│   └── P2-10 ◀── P2-06
│
└── P2-11~18 (多向量) ◀── P2-11 (表扩展)
    └── P2-16 ◀── P2-13

Phase 3 (打磨测试)
├── P3-01~05 (引导+API) ◀── Phase 0-2 完成
│
└── P3-06~12 (测试上线) ◀── All phases
```

---

### 17.7 里程碑与检查点

| 里程碑               | 日期     | 检查项                         | 决策点           |
| -------------------- | -------- | ------------------------------ | ---------------- |
| **M0: 基础完成**     | 第2周末  | 托管模式可选择、快慢路径生效   | 是否进入 Phase 1 |
| **M1: 半托管可用**   | 第5周末  | 确认消息流程完整、学习机制生效 | 是否小范围灰度   |
| **M2: 深度优化完成** | 第8周末  | 多向量+核心区生效、准确率达标  | 是否扩大灰度     |
| **M3: 上线就绪**     | 第10周末 | 测试通过、监控完善             | 全量发布         |

---

### 17.8 资源需求

| 角色         | Phase 0 | Phase 1 | Phase 2 | Phase 3 | 合计    |
| ------------ | ------- | ------- | ------- | ------- | ------- |
| **后端开发** | 1人     | 1人     | 1人     | 0.5人   | ~9周    |
| **前端开发** | 0.5人   | 1人     | 0.5人   | 0.5人   | ~6周    |
| **QA测试**   | -       | 0.5人   | 0.5人   | 1人     | ~3周    |
| **合计**     | 1.5人   | 2.5人   | 2人     | 2人     | ~18人周 |

---

### 17.9 风险与应对

| 风险                 | 概率 | 影响 | 应对措施                         | 负责人 |
| -------------------- | ---- | ---- | -------------------------------- | ------ |
| 多向量存储成本超预期 | 中   | 高   | Phase 2 开始前评估，可选择性启用 | 后端   |
| 半托管消息过多       | 高   | 中   | 设置消息频率上限，智能聚合       | 后端   |
| 负样本过拟合         | 中   | 中   | 设置排除规则上限，定期清理       | 后端   |
| 置信度校准不准       | 中   | 高   | A/B 测试验证，渐进式调整         | 后端   |
| 前端体验不佳         | 中   | 高   | 早期用户测试，快速迭代           | 前端   |

---

## 十八、前端配合改动清单

### 18.1 改动概览

基于架构升级，前端需要配合的改动分为以下几类：

| 类别              | 改动数量 | 优先级 | 工作量预估 |
| ----------------- | -------- | ------ | ---------- |
| **新增组件**      | 8 个     | P0-P1  | 5-7天      |
| **改造组件**      | 6 个     | P0-P1  | 3-4天      |
| **新增页面/路由** | 1 个     | P2     | 1天        |
| **API 路由**      | 6 个     | P0-P1  | 2-3天      |
| **类型定义**      | 4 个     | P0     | 1天        |

**总计前端工作量**: 约 12-16 人天

---

### 17.2 新增组件

#### 17.2.1 托管模式设置卡片 (P0)

**文件**: `src/components/settings/trust-mode-settings-card.tsx`

**功能**:

- 三种托管模式的可视化选择（完全托管/半托管/不托管）
- 当前模式高亮显示，推荐标识
- 模式切换确认对话框
- 高级设置折叠面板（阈值、限额等）

**UI 结构**:

```
┌─────────────────────────────────────────────────────────────────┐
│  🤖 托管模式                                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ◉ 完全托管 (推荐)                              ⭐默认   │   │
│  │   只管收藏，AI 全权负责整理                             │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ○ 半托管                                                │   │
│  │   AI 辅助，重要决定征求你的意见                         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ○ 不托管                                                │   │
│  │   完全手动控制，AI 仅生成摘要                           │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ▶ 高级设置                                                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Props 接口**:

```typescript
interface TrustModeSettingsCardProps {
  currentMode: "full_auto" | "semi_auto" | "manual";
  onModeChange: (mode: TrustMode) => Promise<void>;
  overrides?: TrustModeOverrides;
  onOverridesChange?: (overrides: TrustModeOverrides) => void;
  stats?: {
    autoDecisionsCount: number;
    userCorrectionsCount: number;
    pendingConfirmationsCount: number;
  };
}
```

---

#### 17.2.2 模式切换确认对话框 (P0)

**文件**: `src/components/settings/trust-mode-switch-dialog.tsx`

**功能**:

- 切换模式时的二次确认
- 展示切换后的影响说明
- 当前待处理项提醒（如待整理数量）

**触发场景**:

- 从完全托管切换到半托管/不托管
- 从半托管切换到不托管

---

#### 17.2.3 可交互确认消息组件 (P0)

**文件**: `src/components/messages/confirmation-message-item.tsx`

**功能**:

- 半托管模式下的分类确认消息
- 内嵌操作按钮（确认/选择其他/放入待整理）
- 倒计时显示（7天后自动执行）
- 记忆来源偏好复选框

**UI 结构**:

```
┌─────────────────────────────────────────────────────────────────┐
│  📚 帮我确认一下分类                                  2小时前   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  "深度学习在自动驾驶中的应用"                                    │
│  来源: 机器之心                                                 │
│                                                                 │
│  建议: 📁 人工智能  (72% 匹配)                                  │
│                                                                 │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐                  │
│  │   确认     │ │ 选择其他   │ │ 放入待整理 │                  │
│  └────────────┘ └────────────┘ └────────────┘                  │
│                                                                 │
│  ☐ 记住: "机器之心" 的内容优先归到此分类                        │
│                                                                 │
│  ⏱️ 6天23小时后自动按建议处理                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Props 接口**:

```typescript
interface ConfirmationMessageItemProps {
  message: ConfirmationMessage;
  onConfirm: (messageId: number, choice: ConfirmationChoice) => Promise<void>;
  onSelectAlternative: (messageId: number) => void;
  onRememberSource: (sourceId: string, folderId: number) => Promise<void>;
}

interface ConfirmationChoice {
  action: "accept" | "select_other" | "to_inbox" | "create_folder";
  folderId?: number;
  newFolderName?: string;
  rememberSource?: boolean;
}
```

---

#### 17.2.4 文件夹选择器对话框 (P1)

**文件**: `src/components/messages/folder-selector-dialog.tsx`

**功能**:

- 确认消息中"选择其他"时弹出
- 显示所有文件夹列表（按相似度排序）
- 支持搜索过滤
- 支持快捷新建文件夹
- 显示每个文件夹的匹配度百分比

---

#### 17.2.5 学习反馈提示组件 (P1)

**文件**: `src/components/bookmark/learning-feedback-toast.tsx`

**功能**:

- 用户移动书签后显示"AI 已学习此偏好"提示
- 显示学习内容（来源/标签/向量）
- 可选"撤销学习"操作

**UI**:

```
┌─────────────────────────────────────────────────────────────┐
│  ✅ 已移动到「人工智能」                                    │
│     AI 已学习: 来自"机器之心"的内容优先归到此分类          │
│                                    [ 撤销学习 ]             │
└─────────────────────────────────────────────────────────────┘
```

---

#### 17.2.6 来源信息徽章组件 (P1)

**文件**: `src/components/bookmark/source-badge.tsx`

**功能**:

- 在书签卡片/详情页显示来源信息
- Hover 显示来源画像详情（领域、可信度、高频文件夹）
- 点击可快速筛选同来源内容

**UI**:

```
┌──────────────────┐
│ 📰 机器之心      │ ← 来源名称徽章
└────────┬─────────┘
         │ hover
         ▼
┌─────────────────────────────────────────┐
│ 机器之心                                │
│ ─────────────────────────────────────── │
│ 领域: AI · 机器学习 · 深度学习          │
│ 可信度: 85%                             │
│ 常归类到: 人工智能 (12次) · 技术文章 (5次) │
│                                         │
│ [ 查看该来源所有内容 ]                   │
└─────────────────────────────────────────┘
```

---

#### 17.2.7 待确认消息筛选标签 (P1)

**文件**: `src/components/messages/pending-confirmation-filter.tsx`

**功能**:

- 消息列表新增"待确认"筛选标签
- 显示待确认数量角标
- 快捷批量处理入口

---

#### 17.2.8 托管模式引导组件 (P2)

**文件**: `src/components/onboarding/trust-mode-guide.tsx`

**功能**:

- 新用户首次使用时的模式选择引导
- 三种模式的优劣对比说明
- 默认推荐完全托管

---

### 17.3 改造组件

#### 17.3.1 设置页面 (P0)

**文件**: `src/components/settings/settings-page-client.tsx`

**改动**:

1. 新增托管模式设置卡片（插入到"智能分类设置"之前）
2. 根据托管模式动态显示/隐藏相关设置项
3. 托管模式变更后刷新相关状态

**代码位置**:

```typescript
// 在 ClassificationSettingsCard 之前插入
<TrustModeSettingsCard
  currentMode={settings.trustMode}
  onModeChange={handleTrustModeChange}
  stats={trustModeStats}
/>

// 智能分类设置 - V3.0
<ClassificationSettingsCard />
```

---

#### 17.3.2 消息列表组件 (P0)

**文件**: `src/components/messages/message-list.tsx`

**改动**:

1. 新增消息类型判断，确认类消息使用 `ConfirmationMessageItem`
2. 新增待确认消息分组/筛选
3. 支持批量确认操作

**新增消息类型**:

```typescript
// 新增到 message-item.tsx 的 TYPE_ICONS
const TYPE_ICONS = {
  // ... 现有类型

  // 托管模式确认消息 (新增)
  classification_confirm: HelpCircle, // 分类确认
  folder_create_confirm: FolderPlus, // 文件夹创建确认
  folder_merge_confirm: GitMerge, // 合并确认
  folder_split_confirm: Scissors, // 分拆确认
  folder_rename_confirm: Pencil, // 重命名确认
};
```

---

#### 17.3.3 消息项组件 (P0)

**文件**: `src/components/messages/message-item.tsx`

**改动**:

1. 识别确认类消息，渲染可交互按钮
2. 新增确认消息的特殊样式（蓝色边框、倒计时显示）
3. 新增 `onConfirm` 回调支持

---

#### 17.3.4 移动到文件夹对话框 (P1)

**文件**: `src/components/bookmark/move-to-folder-dialog.tsx`

**改动**:

1. 移动完成后触发学习反馈 Toast
2. 新增"记住来源偏好"复选框选项
3. 传递来源信息用于负样本学习

---

#### 17.3.5 书签详情页 (P1)

**文件**: `src/components/bookmark/bookmark-detail-client.tsx`

**改动**:

1. 显示来源信息徽章
2. 显示分类决策理由（可折叠）
3. 显示"AI 学习记录"（该书签贡献的学习数据）

---

#### 17.3.6 待整理页面 (P1)

**文件**: `src/components/inbox/inbox-page-client.tsx`

**改动**:

1. 根据托管模式显示不同的引导文案
2. 完全托管：显示"AI 正在自动处理..."
3. 半托管：显示待确认消息入口
4. 不托管：显示手动整理引导

---

### 17.4 新增页面/路由

#### 17.4.1 待确认消息专页 (P2)

**路由**: `/messages/pending`

**文件**: `src/app/(main)/messages/pending/page.tsx`

**功能**:

- 专门展示所有待确认消息
- 支持批量确认/批量放入待整理
- 按类型分组（分类确认/文件夹建议）
- 过期时间排序

---

### 17.5 API 路由新增

#### 17.5.1 托管模式 API (P0)

**路由**: `src/app/api/user/trust-mode/route.ts`

```typescript
// GET - 获取当前托管模式
// PUT - 更新托管模式
// PATCH - 更新模式覆盖设置

interface TrustModeResponse {
  mode: "full_auto" | "semi_auto" | "manual";
  overrides: TrustModeOverrides;
  stats: {
    autoDecisionsCount: number;
    userCorrectionsCount: number;
    pendingConfirmationsCount: number;
  };
}
```

---

#### 17.5.2 待确认消息 API (P0)

**路由**: `src/app/api/confirmations/route.ts`

```typescript
// GET - 获取待确认列表
// POST - 批量创建确认消息（内部调用）

interface PendingConfirmation {
  id: string;
  type: "classification" | "folder_create" | "folder_merge" | "folder_split";
  bookmarkId?: number;
  folderId?: number;
  suggestion: {
    folderId: number;
    folderName: string;
    confidence: number;
    reason: string;
    alternatives: Array<{
      folderId: number;
      folderName: string;
      confidence: number;
    }>;
  };
  expiresAt: string;
  status: "pending" | "confirmed" | "rejected" | "expired";
}
```

**路由**: `src/app/api/confirmations/[id]/route.ts`

```typescript
// PUT - 响应确认消息
// DELETE - 取消确认（放入待整理）

interface ConfirmationResponse {
  action: "accept" | "select_other" | "to_inbox" | "create_folder";
  selectedFolderId?: number;
  newFolderName?: string;
  rememberSource?: boolean;
}
```

---

#### 17.5.3 来源画像 API (P1)

**路由**: `src/app/api/sources/route.ts`

```typescript
// GET - 获取用户所有来源画像
// GET ?sourceId=xxx - 获取单个来源画像

interface SourceProfile {
  sourceId: string;
  sourceName: string;
  domains: string[];
  trustScore: number;
  frequentFolders: Array<{
    folderId: number;
    folderName: string;
    count: number;
  }>;
  sampleCount: number;
}
```

**路由**: `src/app/api/sources/[sourceId]/remember/route.ts`

```typescript
// POST - 记住来源偏好
// DELETE - 取消来源偏好记忆

interface RememberSourceRequest {
  folderId: number;
  strength: "weak" | "strong"; // weak: 优先 / strong: 始终
}
```

---

#### 17.5.4 负样本学习 API (P1)

**路由**: `src/app/api/learning/negative/route.ts`

```typescript
// POST - 记录负样本
// DELETE - 撤销负样本学习

interface NegativeSampleRequest {
  folderId: number;
  bookmarkId: number;
  exclusionType: "tag" | "source" | "embedding";
  source: "user_move" | "confirm_reject";
}
```

---

#### 17.5.5 分类决策理由 API (P1)

**路由**: `src/app/api/classification/[bookmarkId]/reason/route.ts`

```typescript
// GET - 获取书签的分类决策理由

interface ClassificationReason {
  primary: string;
  secondary?: string;
  confidenceExplanation: string;
  matcherScores: Array<{
    matcherName: string;
    score: number;
    contribution: string;
  }>;
  timestamp: string;
}
```

---

#### 17.5.6 托管模式统计 API (P2)

**路由**: `src/app/api/user/trust-mode/stats/route.ts`

```typescript
// GET - 获取托管模式统计数据

interface TrustModeStats {
  totalClassifications: number;
  autoClassifications: number;
  userCorrections: number;
  correctionRate: number;
  averageConfidence: number;
  topCorrectedFolders: Array<{
    folderId: number;
    folderName: string;
    count: number;
  }>;
  learningMilestones: Array<{ date: string; event: string }>;
}
```

---

### 17.6 类型定义新增

**文件**: `src/types/trust-mode.ts`

```typescript
/**
 * 托管模式类型定义
 */

export type TrustMode = "full_auto" | "semi_auto" | "manual";

export interface TrustModeConfig {
  mode: TrustMode;
  overrides: TrustModeOverrides;
}

export interface TrustModeOverrides {
  // 分类相关
  confirmationThreshold?: number; // 低于此置信度需确认 (半托管)
  autoInboxThreshold?: number; // 低于此置信度放入待整理

  // 文件夹管理
  dailyFolderCreateLimit?: number; // 每日自动创建上限
  autoMergeEnabled?: boolean; // 是否启用自动合并
  autoSplitEnabled?: boolean; // 是否启用自动分拆
  autoRenameEnabled?: boolean; // 是否启用自动重命名

  // 消息相关
  confirmationExpiryDays?: number; // 确认消息过期天数
  notifyOnMajorChanges?: boolean; // 重大变更通知
}

export interface TrustModeStats {
  autoDecisionsCount: number;
  userCorrectionsCount: number;
  pendingConfirmationsCount: number;
  correctionRate: number;
  lastModeChange?: string;
}
```

**文件**: `src/types/confirmation.ts`

```typescript
/**
 * 确认消息类型定义
 */

export type ConfirmationType =
  | "classification"
  | "folder_create"
  | "folder_merge"
  | "folder_split"
  | "folder_rename";

export type ConfirmationStatus =
  | "pending"
  | "confirmed"
  | "rejected"
  | "expired";

export interface PendingConfirmation {
  id: string;
  userId: string;
  type: ConfirmationType;
  bookmarkId?: number;
  folderId?: number;
  suggestion: ConfirmationSuggestion;
  status: ConfirmationStatus;
  userChoice?: ConfirmationChoice;
  expiresAt: string;
  createdAt: string;
  resolvedAt?: string;
}

export interface ConfirmationSuggestion {
  folderId: number;
  folderName: string;
  confidence: number;
  reason: string;
  alternatives: Array<{
    folderId: number;
    folderName: string;
    confidence: number;
  }>;
}

export interface ConfirmationChoice {
  action: "accept" | "select_other" | "to_inbox" | "create_folder";
  selectedFolderId?: number;
  newFolderName?: string;
  rememberSource?: boolean;
  feedback?: string;
}
```

**文件**: `src/types/source-profile.ts`

```typescript
/**
 * 来源画像类型定义
 */

export interface SourceProfile {
  id: number;
  userId: string;
  sourceId: string;
  sourceName: string;
  domains: string[];
  trustScore: number;
  contentType: "article" | "news" | "tutorial" | "opinion" | "unknown";
  frequentFolders: number[];
  sampleCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SourcePreference {
  sourceId: string;
  folderId: number;
  strength: "weak" | "strong";
  createdAt: string;
}
```

**文件**: `src/types/learning.ts`

```typescript
/**
 * 学习相关类型定义
 */

export type ExclusionType = "tag" | "source" | "embedding" | "keyword";
export type ExclusionSource =
  | "user_move"
  | "user_reject"
  | "bulk_move"
  | "auto_learn";

export interface FolderExclusion {
  id: number;
  userId: string;
  folderId: number;
  exclusionType: ExclusionType;
  excludedTag?: string;
  excludedSourceId?: string;
  excludedKeyword?: string;
  weight: number;
  createdFrom: ExclusionSource;
  originalBookmarkId?: number;
  expiresAt?: string;
  createdAt: string;
}

export interface LearningFeedback {
  type: "negative_sample" | "source_preference" | "correction";
  action: "created" | "updated" | "deleted";
  details: string;
  timestamp: string;
}
```

---

### 17.7 消息类型扩展

**文件**: `src/lib/messages/types.ts`

```typescript
// 新增消息类型
export type MessageType =
  | // ... 现有类型

  // 托管模式确认消息 (新增)
  | 'classification_confirm'     // 分类确认
  | 'folder_create_confirm'      // 文件夹创建确认
  | 'folder_merge_confirm'       // 合并确认
  | 'folder_split_confirm'       // 分拆确认
  | 'folder_rename_confirm'      // 重命名确认

  // 学习反馈消息 (新增)
  | 'learning_recorded'          // 学习记录
  | 'learning_milestone';        // 学习里程碑
```

---

### 17.8 前端实施路线图

#### Phase 0: 基础架构 (与后端同步，1周内)

| 任务             | 文件                                                   | 工作量 |
| ---------------- | ------------------------------------------------------ | ------ |
| 类型定义         | `src/types/trust-mode.ts` 等                           | 0.5天  |
| 托管模式 API     | `src/app/api/user/trust-mode/`                         | 1天    |
| 托管模式设置卡片 | `src/components/settings/trust-mode-settings-card.tsx` | 1.5天  |
| 设置页面集成     | `src/components/settings/settings-page-client.tsx`     | 0.5天  |
| 模式切换对话框   | `src/components/settings/trust-mode-switch-dialog.tsx` | 0.5天  |

#### Phase 1: 确认消息系统 (2周)

| 任务           | 文件                                                      | 工作量 |
| -------------- | --------------------------------------------------------- | ------ |
| 待确认消息 API | `src/app/api/confirmations/`                              | 1.5天  |
| 确认消息组件   | `src/components/messages/confirmation-message-item.tsx`   | 2天    |
| 文件夹选择器   | `src/components/messages/folder-selector-dialog.tsx`      | 1天    |
| 消息列表改造   | `src/components/messages/message-list.tsx`                | 1天    |
| 消息筛选标签   | `src/components/messages/pending-confirmation-filter.tsx` | 0.5天  |

#### Phase 2: 学习反馈与增强 (2周)

| 任务           | 文件                                                  | 工作量 |
| -------------- | ----------------------------------------------------- | ------ |
| 来源画像 API   | `src/app/api/sources/`                                | 1天    |
| 来源信息徽章   | `src/components/bookmark/source-badge.tsx`            | 1天    |
| 学习反馈 Toast | `src/components/bookmark/learning-feedback-toast.tsx` | 0.5天  |
| 移动对话框改造 | `src/components/bookmark/move-to-folder-dialog.tsx`   | 1天    |
| 书签详情改造   | `src/components/bookmark/bookmark-detail-client.tsx`  | 1天    |
| 待整理页面改造 | `src/components/inbox/inbox-page-client.tsx`          | 0.5天  |
| 新用户引导     | `src/components/onboarding/trust-mode-guide.tsx`      | 1天    |

---

### 17.9 前端测试要点

#### 功能测试

| 测试场景             | 预期行为                             |
| -------------------- | ------------------------------------ |
| 切换托管模式         | 确认对话框显示，切换后相关设置更新   |
| 半托管下收到确认消息 | 消息列表显示可交互确认卡片           |
| 点击"确认"按钮       | 书签移动到建议文件夹，消息标记已处理 |
| 点击"选择其他"       | 弹出文件夹选择器                     |
| 选中"记住来源偏好"   | 后续同来源内容自动使用此分类         |
| 确认消息过期         | 自动按建议执行，发送通知             |
| 移动书签后           | 显示学习反馈 Toast                   |
| 撤销学习             | Toast 消失，负样本记录删除           |

#### 边界测试

| 测试场景         | 预期行为             |
| ---------------- | -------------------- |
| 大量待确认消息   | 虚拟滚动，性能正常   |
| 确认消息加载失败 | 显示重试选项         |
| 网络断开时确认   | 本地缓存，恢复后同步 |
| 托管模式切换中断 | 事务回滚，保持原模式 |

#### 响应式测试

| 设备   | 测试要点              |
| ------ | --------------------- |
| 桌面端 | 托管模式卡片横向布局  |
| 平板端 | 确认消息卡片自适应    |
| 移动端 | 底部 Sheet 替代对话框 |

---

### 17.10 前端与后端协作接口

#### 事件同步

前端需要监听以下后端事件（通过 WebSocket 或轮询）：

| 事件                   | 触发场景                 | 前端响应               |
| ---------------------- | ------------------------ | ---------------------- |
| `confirmation:created` | 半托管模式下分类完成     | 消息列表刷新，角标更新 |
| `confirmation:expired` | 确认消息过期自动执行     | 显示通知，刷新书签列表 |
| `learning:recorded`    | 负样本学习完成           | 显示反馈 Toast         |
| `folder:auto_created`  | 完全托管下自动创建文件夹 | 刷新文件夹列表         |
| `trust_mode:changed`   | 托管模式变更             | 刷新整体状态           |

#### 状态同步

| 状态         | 存储位置          | 同步策略               |
| ------------ | ----------------- | ---------------------- |
| 当前托管模式 | 服务端 + 本地缓存 | 启动时加载，变更时同步 |
| 待确认数量   | 服务端            | 轮询 / WebSocket 推送  |
| 来源画像缓存 | 本地 IndexedDB    | 按需加载，5分钟过期    |

---

_文档版本: 2.1 | 最后更新: 2025-12-11_
