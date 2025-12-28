# 多用户画像智能化 Phase 1 实施规范

> **版本**: v1.0
> **日期**: 2025-12-28
> **状态**: 待审核
> **预估工时**: 40h
> **核心理念**: 行为推断优先，零干扰用户

---

## 一、Phase 1 目标

### 1.1 核心目标

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Phase 1: 基础设施 + 行为推断                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  目标：建立画像推断引擎，让 AI 静默增强响应质量，用户零感知                     │
│                                                                             │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐        │
│  │  收藏行为数据    │ → │  画像推断引擎    │ → │  响应质量提升    │        │
│  │  (用户无感知)   │    │  (后台静默)     │    │  (自然增强)     │        │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘        │
│                                                                             │
│  交付物：                                                                    │
│  1. 类型系统扩展（6分组、25+类型）                                            │
│  2. 画像推断引擎（平台信号 + 标签模式 + 内容特征）                              │
│  3. 3个高优画像实现（产品经理、咨询顾问、大学教师）                              │
│  4. 推断置信度系统                                                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 设计原则

| 原则         | 说明                      | 实现方式                  |
| ------------ | ------------------------- | ------------------------- |
| **零干扰**   | 用户无需任何配置          | 完全基于行为推断          |
| **静默增强** | AI 响应更精准，用户无感知 | System Prompt 动态注入    |
| **渐进置信** | 数据越多推断越准          | 多信号融合 + 置信度阈值   |
| **可降级**   | 推断失败不影响体验        | 回退到 general 画像       |
| **可覆盖**   | 高级用户可手动指定        | 设置页可选配置（Phase 4） |

### 1.3 不在 Phase 1 范围

- ❌ 注册流程修改
- ❌ 用户可见的画像选择 UI
- ❌ 新的快捷指令
- ❌ 用户引导流程

---

## 二、技术架构

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              画像推断系统架构                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         数据采集层                                    │   │
│  │  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐           │   │
│  │  │ 收藏平台分布   │  │ 标签使用频率   │  │ 内容特征统计   │           │   │
│  │  │ (URL域名统计) │  │ (用户标签)    │  │ (AI摘要分析)  │           │   │
│  │  └───────────────┘  └───────────────┘  └───────────────┘           │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    ↓                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         推断引擎层                                    │   │
│  │  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐           │   │
│  │  │ 平台信号匹配   │  │ 标签模式匹配   │  │ 内容密度分析   │           │   │
│  │  │ PlatformMatcher│  │ TagMatcher   │  │ DensityAnalyzer│           │   │
│  │  └───────────────┘  └───────────────┘  └───────────────┘           │   │
│  │                          ↓                                           │   │
│  │                 ┌───────────────────┐                                │   │
│  │                 │  多信号融合器      │                                │   │
│  │                 │  SignalFusion     │                                │   │
│  │                 └───────────────────┘                                │   │
│  │                          ↓                                           │   │
│  │                 ┌───────────────────┐                                │   │
│  │                 │  置信度计算器      │                                │   │
│  │                 │  ConfidenceCalc   │                                │   │
│  │                 └───────────────────┘                                │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    ↓                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         应用层                                        │   │
│  │  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐           │   │
│  │  │ 画像缓存       │  │ Prompt注入    │  │ 意图权重调整   │           │   │
│  │  │ PersonaCache  │  │ PromptInjector│  │ IntentBooster │           │   │
│  │  └───────────────┘  └───────────────┘  └───────────────┘           │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 文件结构

```
src/lib/ai-agent/
├── personas/                          # 画像系统（已有，扩展）
│   ├── types.ts                       # 类型定义 [修改]
│   ├── persona-prompts.ts             # System Prompts [修改]
│   └── persona-intent-boosts.ts       # 意图权重 [修改]
│
├── inference/                         # 画像推断引擎 [新增]
│   ├── types.ts                       # 推断类型定义
│   ├── platform-matcher.ts            # 平台信号匹配器
│   ├── tag-matcher.ts                 # 标签模式匹配器
│   ├── density-analyzer.ts            # 内容密度分析器
│   ├── signal-fusion.ts               # 多信号融合器
│   ├── confidence-calculator.ts       # 置信度计算器
│   ├── persona-inferrer.ts            # 推断引擎主入口
│   ├── persona-cache.ts               # 画像缓存
│   ├── index.ts                       # 模块导出
│   └── __tests__/                     # 测试文件
│       ├── platform-matcher.test.ts
│       ├── tag-matcher.test.ts
│       ├── signal-fusion.test.ts
│       └── persona-inferrer.test.ts
│
└── context/
    └── prompt-injector.ts             # Prompt注入器 [修改]
```

---

## 三、类型系统扩展

### 3.1 核心类型定义

```typescript
// src/lib/ai-agent/personas/types.ts

// ==================== 画像类型（v3.1 扩展）====================

/**
 * 画像分组（6大分组）
 */
export type PersonaGroup =
  | "academic" // 学术研究型
  | "content" // 内容创作型
  | "tech" // 技术实践型
  | "professional" // 专业服务型 [v3.1新增]
  | "design" // 产品设计型 [v3.1新增]
  | "growth" // 自我提升型 [v3.1新增]
  | "general"; // 通用

/**
 * 画像类型（25+类型）
 * Phase 1 实现：pm, consultant, teacher + 原有 9 类
 */
export type PersonaType =
  // 学术研究型 (5类)
  | "student" // 本科生
  | "master" // 研究生
  | "phd" // 博士生
  | "teacher" // 大学教师 [Phase 1]
  | "researcher" // 科研人员 [Phase 2]
  // 内容创作型 (5类)
  | "tech_blogger" // 科技博主
  | "knowledge_blogger" // 知识博主
  | "dev_blogger" // 技术博主
  | "online_teacher" // 在线讲师 [Phase 2]
  | "curator" // 策展人 [Phase 3]
  // 技术实践型 (5类)
  | "indie_dev" // 独立开发者
  | "ai_enthusiast" // AI发烧友
  | "creator" // 内容创作者
  | "security_researcher" // 安全研究员 [Phase 3]
  | "architect" // 技术架构师 [Phase 3]
  // 专业服务型 (5类) [v3.1新增分组]
  | "consultant" // 咨询顾问 [Phase 1]
  | "analyst" // 行业分析师 [Phase 2]
  | "lawyer" // 律师/法务 [Phase 2]
  | "medical" // 医学从业者 [Phase 2]
  | "journalist" // 记者 [Phase 2]
  // 产品设计型 (4类) [v3.1新增分组]
  | "pm" // 产品经理 [Phase 1]
  | "ux_researcher" // UX研究员 [Phase 2]
  | "game_planner" // 游戏策划 [Phase 2]
  | "trainer" // 企业培训师 [Phase 2]
  // 自我提升型 (4类) [v3.1新增分组]
  | "lifelong_learner" // 终身学习者 [Phase 3]
  | "cert_seeker" // 考证备考者 [Phase 3]
  | "career_changer" // 职业转型者 [Phase 3]
  | "language_learner" // 语言学习者 [Phase 3]
  // 通用
  | "general"; // 通用（默认）

/**
 * 画像分组映射
 */
export const PERSONA_GROUP_MAP: Record<PersonaType, PersonaGroup> = {
  // 学术研究型
  student: "academic",
  master: "academic",
  phd: "academic",
  teacher: "academic",
  researcher: "academic",
  // 内容创作型
  tech_blogger: "content",
  knowledge_blogger: "content",
  dev_blogger: "content",
  online_teacher: "content",
  curator: "content",
  // 技术实践型
  indie_dev: "tech",
  ai_enthusiast: "tech",
  creator: "tech",
  security_researcher: "tech",
  architect: "tech",
  // 专业服务型
  consultant: "professional",
  analyst: "professional",
  lawyer: "professional",
  medical: "professional",
  journalist: "professional",
  // 产品设计型
  pm: "design",
  ux_researcher: "design",
  game_planner: "design",
  trainer: "design",
  // 自我提升型
  lifelong_learner: "growth",
  cert_seeker: "growth",
  career_changer: "growth",
  language_learner: "growth",
  // 通用
  general: "general",
};

/**
 * Phase 1 启用的画像类型
 */
export const PHASE1_ENABLED_PERSONAS: PersonaType[] = [
  // 原有 v3.0 的 9 类
  "student",
  "master",
  "phd",
  "tech_blogger",
  "knowledge_blogger",
  "dev_blogger",
  "indie_dev",
  "ai_enthusiast",
  "creator",
  // Phase 1 新增 3 类
  "pm",
  "consultant",
  "teacher",
  // 通用
  "general",
];
```

### 3.2 推断相关类型

```typescript
// src/lib/ai-agent/inference/types.ts

/**
 * 推断信号类型
 */
export type InferenceSignalType = "platform" | "tag" | "density" | "content";

/**
 * 单个推断信号
 */
export interface InferenceSignal {
  type: InferenceSignalType;
  source: string; // 信号来源（如域名、标签名）
  personas: PersonaType[]; // 匹配的画像列表
  weight: number; // 信号权重 (0-1)
  count: number; // 命中次数
}

/**
 * 画像推断结果
 */
export interface PersonaInferenceResult {
  /** 推断的主画像 */
  primaryPersona: PersonaType;

  /** 画像分组 */
  group: PersonaGroup;

  /** 置信度 (0-100) */
  confidence: number;

  /** 备选画像（按置信度排序） */
  alternatives: Array<{
    persona: PersonaType;
    confidence: number;
  }>;

  /** 推断依据 */
  signals: InferenceSignal[];

  /** 推断时间戳 */
  inferredAt: string;

  /** 数据样本量 */
  sampleSize: number;
}

/**
 * 推断引擎配置
 */
export interface PersonaInferenceConfig {
  /** 最小置信度阈值（低于此值回退到 general） */
  minConfidenceThreshold: number; // 默认 60

  /** 高置信度阈值（高于此值完全信任推断） */
  highConfidenceThreshold: number; // 默认 85

  /** 最小样本量（收藏数量） */
  minSampleSize: number; // 默认 10

  /** 缓存有效期（毫秒） */
  cacheTTL: number; // 默认 1小时

  /** 是否启用推断 */
  enabled: boolean; // Feature Flag 控制
}

/**
 * 用户收藏统计数据（用于推断）
 */
export interface UserBookmarkStats {
  userId: string;

  /** 平台分布 */
  platformDistribution: Record<string, number>;

  /** 标签频率 */
  tagFrequency: Record<string, number>;

  /** 总收藏数 */
  totalBookmarks: number;

  /** 统计时间范围 */
  statsRange: {
    from: string;
    to: string;
  };
}
```

---

## 四、画像推断引擎

### 4.1 平台信号匹配器

```typescript
// src/lib/ai-agent/inference/platform-matcher.ts

import { PersonaType, InferenceSignal } from "./types";

/**
 * 平台 → 画像映射规则
 * 每个平台可映射到多个画像，带有权重
 */
export const PLATFORM_PERSONA_RULES: Record<
  string,
  Array<{
    persona: PersonaType;
    weight: number;
  }>
> = {
  // ==================== 学术研究型 ====================
  "arxiv.org": [
    { persona: "phd", weight: 0.9 },
    { persona: "master", weight: 0.8 },
    { persona: "ai_enthusiast", weight: 0.6 },
    { persona: "researcher", weight: 0.85 },
  ],
  "scholar.google.com": [
    { persona: "phd", weight: 0.85 },
    { persona: "master", weight: 0.8 },
    { persona: "teacher", weight: 0.7 },
  ],
  "cnki.net": [
    { persona: "master", weight: 0.85 },
    { persona: "phd", weight: 0.8 },
    { persona: "teacher", weight: 0.75 },
  ],
  "coursera.org": [
    { persona: "student", weight: 0.7 },
    { persona: "lifelong_learner", weight: 0.8 },
    { persona: "career_changer", weight: 0.6 },
  ],
  "mooc.cn": [
    { persona: "student", weight: 0.8 },
    { persona: "teacher", weight: 0.5 },
  ],

  // ==================== 产品设计型 ====================
  "36kr.com": [
    { persona: "pm", weight: 0.8 },
    { persona: "tech_blogger", weight: 0.7 },
    { persona: "analyst", weight: 0.6 },
  ],
  "producthunt.com": [
    { persona: "pm", weight: 0.85 },
    { persona: "indie_dev", weight: 0.8 },
  ],
  "uxdesign.cc": [
    { persona: "ux_researcher", weight: 0.9 },
    { persona: "pm", weight: 0.5 },
  ],
  "figma.com": [
    { persona: "ux_researcher", weight: 0.8 },
    { persona: "pm", weight: 0.4 },
  ],

  // ==================== 技术实践型 ====================
  "github.com": [
    { persona: "indie_dev", weight: 0.8 },
    { persona: "dev_blogger", weight: 0.7 },
    { persona: "architect", weight: 0.6 },
  ],
  "juejin.cn": [
    { persona: "dev_blogger", weight: 0.85 },
    { persona: "indie_dev", weight: 0.7 },
  ],
  "v2ex.com": [
    { persona: "indie_dev", weight: 0.8 },
    { persona: "dev_blogger", weight: 0.6 },
  ],
  "hackernews.com": [
    { persona: "indie_dev", weight: 0.85 },
    { persona: "ai_enthusiast", weight: 0.6 },
  ],
  "huggingface.co": [
    { persona: "ai_enthusiast", weight: 0.9 },
    { persona: "phd", weight: 0.5 },
  ],

  // ==================== 专业服务型 ====================
  "mckinsey.com": [
    { persona: "consultant", weight: 0.9 },
    { persona: "analyst", weight: 0.6 },
  ],
  "hbr.org": [
    { persona: "consultant", weight: 0.8 },
    { persona: "pm", weight: 0.5 },
  ],
  "wind.com.cn": [{ persona: "analyst", weight: 0.9 }],
  "eastmoney.com": [{ persona: "analyst", weight: 0.85 }],

  // ==================== 内容创作型 ====================
  "mp.weixin.qq.com": [
    { persona: "tech_blogger", weight: 0.6 },
    { persona: "knowledge_blogger", weight: 0.6 },
    { persona: "creator", weight: 0.5 },
  ],
  "zhihu.com": [
    { persona: "knowledge_blogger", weight: 0.7 },
    { persona: "student", weight: 0.5 },
  ],
  "bilibili.com": [
    { persona: "creator", weight: 0.7 },
    { persona: "student", weight: 0.5 },
  ],
  "xiaohongshu.com": [{ persona: "creator", weight: 0.85 }],

  // ==================== 自我提升型 ====================
  "dedao.cn": [
    { persona: "lifelong_learner", weight: 0.9 },
    { persona: "knowledge_blogger", weight: 0.5 },
  ],
  "cpa.gaodun.com": [{ persona: "cert_seeker", weight: 0.95 }],
};

/**
 * 平台信号匹配器
 */
export class PlatformMatcher {
  /**
   * 从 URL 提取域名
   */
  private extractDomain(url: string): string | null {
    try {
      const urlObj = new URL(url);
      // 移除 www. 前缀
      return urlObj.hostname.replace(/^www\./, "");
    } catch {
      return null;
    }
  }

  /**
   * 匹配平台信号
   * @param platformDistribution 平台分布统计 { domain: count }
   * @param totalBookmarks 总收藏数
   */
  match(
    platformDistribution: Record<string, number>,
    totalBookmarks: number,
  ): InferenceSignal[] {
    const signals: InferenceSignal[] = [];

    for (const [domain, count] of Object.entries(platformDistribution)) {
      const rules = PLATFORM_PERSONA_RULES[domain];
      if (!rules || rules.length === 0) continue;

      // 计算该平台的权重（基于占比）
      const ratio = count / totalBookmarks;

      signals.push({
        type: "platform",
        source: domain,
        personas: rules.map((r) => r.persona),
        weight: ratio,
        count,
      });
    }

    return signals;
  }

  /**
   * 获取所有已知平台列表
   */
  getKnownPlatforms(): string[] {
    return Object.keys(PLATFORM_PERSONA_RULES);
  }
}

export const platformMatcher = new PlatformMatcher();
```

### 4.2 标签模式匹配器

```typescript
// src/lib/ai-agent/inference/tag-matcher.ts

import { PersonaType, InferenceSignal } from "./types";

/**
 * 标签模式 → 画像映射规则
 */
export const TAG_PERSONA_RULES: Array<{
  pattern: RegExp;
  personas: Array<{ persona: PersonaType; weight: number }>;
}> = [
  // ==================== 学术研究型 ====================
  {
    pattern: /论文|文献|研究|学术|paper|research/i,
    personas: [
      { persona: "phd", weight: 0.8 },
      { persona: "master", weight: 0.8 },
      { persona: "researcher", weight: 0.7 },
    ],
  },
  {
    pattern: /课程|教学|备课|讲义|syllabus/i,
    personas: [
      { persona: "teacher", weight: 0.9 },
      { persona: "student", weight: 0.5 },
    ],
  },
  {
    pattern: /考研|考试|复习|期末|备考/i,
    personas: [
      { persona: "student", weight: 0.9 },
      { persona: "cert_seeker", weight: 0.7 },
    ],
  },

  // ==================== 产品设计型 ====================
  {
    pattern: /竞品|PRD|需求|产品分析|用户调研/i,
    personas: [{ persona: "pm", weight: 0.95 }],
  },
  {
    pattern: /用户体验|UX|交互设计|可用性|用研/i,
    personas: [
      { persona: "ux_researcher", weight: 0.9 },
      { persona: "pm", weight: 0.4 },
    ],
  },
  {
    pattern: /游戏设计|玩法|数值|关卡|game design/i,
    personas: [{ persona: "game_planner", weight: 0.95 }],
  },

  // ==================== 专业服务型 ====================
  {
    pattern: /咨询|方法论|案例|麦肯锡|BCG|贝恩/i,
    personas: [{ persona: "consultant", weight: 0.9 }],
  },
  {
    pattern: /研报|行业分析|市场研究|投研|估值/i,
    personas: [{ persona: "analyst", weight: 0.9 }],
  },
  {
    pattern: /法规|法律|判例|合同|诉讼/i,
    personas: [{ persona: "lawyer", weight: 0.95 }],
  },
  {
    pattern: /临床|医学|指南|病例|诊疗/i,
    personas: [{ persona: "medical", weight: 0.95 }],
  },

  // ==================== 技术实践型 ====================
  {
    pattern: /架构|系统设计|技术选型|微服务|分布式/i,
    personas: [
      { persona: "architect", weight: 0.9 },
      { persona: "indie_dev", weight: 0.5 },
    ],
  },
  {
    pattern: /AI|机器学习|深度学习|大模型|LLM|GPT/i,
    personas: [
      { persona: "ai_enthusiast", weight: 0.9 },
      { persona: "phd", weight: 0.4 },
    ],
  },
  {
    pattern: /安全|漏洞|渗透|CVE|攻防/i,
    personas: [{ persona: "security_researcher", weight: 0.95 }],
  },

  // ==================== 自我提升型 ====================
  {
    pattern: /CPA|CFA|PMP|考证|资格证/i,
    personas: [{ persona: "cert_seeker", weight: 0.95 }],
  },
  {
    pattern: /转型|转行|职业规划|技能提升/i,
    personas: [
      { persona: "career_changer", weight: 0.9 },
      { persona: "lifelong_learner", weight: 0.6 },
    ],
  },
  {
    pattern: /英语|日语|雅思|托福|词汇|语法/i,
    personas: [{ persona: "language_learner", weight: 0.9 }],
  },
];

/**
 * 标签模式匹配器
 */
export class TagMatcher {
  /**
   * 匹配标签信号
   * @param tagFrequency 标签频率统计 { tag: count }
   * @param totalBookmarks 总收藏数
   */
  match(
    tagFrequency: Record<string, number>,
    totalBookmarks: number,
  ): InferenceSignal[] {
    const signals: InferenceSignal[] = [];
    const matchedPatterns = new Set<string>();

    for (const [tag, count] of Object.entries(tagFrequency)) {
      for (const rule of TAG_PERSONA_RULES) {
        // 避免同一模式重复匹配
        const patternKey = rule.pattern.source;
        if (matchedPatterns.has(patternKey)) continue;

        if (rule.pattern.test(tag)) {
          matchedPatterns.add(patternKey);

          signals.push({
            type: "tag",
            source: tag,
            personas: rule.personas.map((p) => p.persona),
            weight: Math.min((count / totalBookmarks) * 10, 1), // 标签权重放大
            count,
          });
        }
      }
    }

    return signals;
  }
}

export const tagMatcher = new TagMatcher();
```

### 4.3 多信号融合器

```typescript
// src/lib/ai-agent/inference/signal-fusion.ts

import { PersonaType, InferenceSignal, PersonaInferenceResult } from "./types";
import { PERSONA_GROUP_MAP, PHASE1_ENABLED_PERSONAS } from "../personas/types";

/**
 * 信号类型权重配置
 */
const SIGNAL_TYPE_WEIGHTS: Record<string, number> = {
  platform: 0.4, // 平台信号权重 40%
  tag: 0.35, // 标签信号权重 35%
  density: 0.15, // 密度信号权重 15%
  content: 0.1, // 内容信号权重 10%（Phase 2+）
};

/**
 * 多信号融合器
 */
export class SignalFusion {
  /**
   * 融合多个信号，计算每个画像的得分
   */
  fuse(signals: InferenceSignal[]): Map<PersonaType, number> {
    const scores = new Map<PersonaType, number>();

    for (const signal of signals) {
      const typeWeight = SIGNAL_TYPE_WEIGHTS[signal.type] || 0.1;

      for (const persona of signal.personas) {
        // 跳过 Phase 1 未启用的画像
        if (!PHASE1_ENABLED_PERSONAS.includes(persona)) continue;

        const currentScore = scores.get(persona) || 0;
        const signalScore = signal.weight * typeWeight * signal.count;
        scores.set(persona, currentScore + signalScore);
      }
    }

    return scores;
  }

  /**
   * 归一化得分为置信度
   */
  normalizeToConfidence(
    scores: Map<PersonaType, number>,
  ): Map<PersonaType, number> {
    const totalScore = Array.from(scores.values()).reduce((a, b) => a + b, 0);

    if (totalScore === 0) {
      return new Map([["general", 100]]);
    }

    const confidence = new Map<PersonaType, number>();
    for (const [persona, score] of scores) {
      // 置信度 = (得分 / 总分) * 100，最高 100
      confidence.set(persona, Math.min((score / totalScore) * 100, 100));
    }

    return confidence;
  }

  /**
   * 生成推断结果
   */
  generateResult(
    signals: InferenceSignal[],
    sampleSize: number,
  ): PersonaInferenceResult {
    const scores = this.fuse(signals);
    const confidence = this.normalizeToConfidence(scores);

    // 按置信度排序
    const sorted = Array.from(confidence.entries()).sort((a, b) => b[1] - a[1]);

    // 主画像
    const [primaryPersona, primaryConfidence] = sorted[0] || ["general", 0];

    // 备选画像（排除主画像）
    const alternatives = sorted.slice(1, 4).map(([persona, conf]) => ({
      persona,
      confidence: Math.round(conf),
    }));

    return {
      primaryPersona,
      group: PERSONA_GROUP_MAP[primaryPersona],
      confidence: Math.round(primaryConfidence),
      alternatives,
      signals,
      inferredAt: new Date().toISOString(),
      sampleSize,
    };
  }
}

export const signalFusion = new SignalFusion();
```

### 4.4 推断引擎主入口

```typescript
// src/lib/ai-agent/inference/persona-inferrer.ts

import {
  PersonaInferenceResult,
  PersonaInferenceConfig,
  UserBookmarkStats,
} from "./types";
import { platformMatcher } from "./platform-matcher";
import { tagMatcher } from "./tag-matcher";
import { signalFusion } from "./signal-fusion";
import { personaCache } from "./persona-cache";
import { getFeatureFlag } from "../config/feature-flags";
import { logger } from "@/lib/logger";

/**
 * 默认推断配置
 */
const DEFAULT_CONFIG: PersonaInferenceConfig = {
  minConfidenceThreshold: 60,
  highConfidenceThreshold: 85,
  minSampleSize: 10,
  cacheTTL: 60 * 60 * 1000, // 1小时
  enabled: true,
};

/**
 * 画像推断引擎
 */
export class PersonaInferrer {
  private config: PersonaInferenceConfig;

  constructor(config: Partial<PersonaInferenceConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 推断用户画像
   * @param stats 用户收藏统计数据
   * @param forceRefresh 强制刷新（跳过缓存）
   */
  async infer(
    stats: UserBookmarkStats,
    forceRefresh = false,
  ): Promise<PersonaInferenceResult> {
    // 检查 Feature Flag
    if (!getFeatureFlag("ENABLE_PERSONA_INFERENCE")) {
      return this.getDefaultResult(stats.userId);
    }

    // 检查缓存
    if (!forceRefresh) {
      const cached = personaCache.get(stats.userId);
      if (cached) {
        logger.debug("Persona inference cache hit", { userId: stats.userId });
        return cached;
      }
    }

    // 检查最小样本量
    if (stats.totalBookmarks < this.config.minSampleSize) {
      logger.debug("Insufficient sample size for inference", {
        userId: stats.userId,
        totalBookmarks: stats.totalBookmarks,
        minRequired: this.config.minSampleSize,
      });
      return this.getDefaultResult(stats.userId, stats.totalBookmarks);
    }

    // 收集信号
    const signals = [
      ...platformMatcher.match(
        stats.platformDistribution,
        stats.totalBookmarks,
      ),
      ...tagMatcher.match(stats.tagFrequency, stats.totalBookmarks),
    ];

    // 融合信号生成结果
    const result = signalFusion.generateResult(signals, stats.totalBookmarks);

    // 置信度检查
    if (result.confidence < this.config.minConfidenceThreshold) {
      logger.debug("Low confidence inference, falling back to general", {
        userId: stats.userId,
        confidence: result.confidence,
        threshold: this.config.minConfidenceThreshold,
      });
      return this.getDefaultResult(stats.userId, stats.totalBookmarks, signals);
    }

    // 缓存结果
    personaCache.set(stats.userId, result, this.config.cacheTTL);

    logger.info("Persona inferred successfully", {
      userId: stats.userId,
      persona: result.primaryPersona,
      confidence: result.confidence,
      signalCount: signals.length,
    });

    return result;
  }

  /**
   * 获取默认结果（general 画像）
   */
  private getDefaultResult(
    userId: string,
    sampleSize = 0,
    signals: any[] = [],
  ): PersonaInferenceResult {
    return {
      primaryPersona: "general",
      group: "general",
      confidence: 100,
      alternatives: [],
      signals,
      inferredAt: new Date().toISOString(),
      sampleSize,
    };
  }

  /**
   * 清除用户缓存（用户行为变化时调用）
   */
  invalidateCache(userId: string): void {
    personaCache.delete(userId);
  }
}

export const personaInferrer = new PersonaInferrer();
```

### 4.5 画像缓存

```typescript
// src/lib/ai-agent/inference/persona-cache.ts

import { PersonaInferenceResult } from "./types";
import { LRUCache } from "lru-cache";

/**
 * 画像推断结果缓存
 */
class PersonaCache {
  private cache: LRUCache<string, PersonaInferenceResult>;

  constructor() {
    this.cache = new LRUCache({
      max: 1000, // 最多缓存 1000 个用户
      ttl: 60 * 60 * 1000, // 默认 1 小时过期
    });
  }

  get(userId: string): PersonaInferenceResult | undefined {
    return this.cache.get(userId);
  }

  set(userId: string, result: PersonaInferenceResult, ttl?: number): void {
    this.cache.set(userId, result, { ttl });
  }

  delete(userId: string): void {
    this.cache.delete(userId);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }
}

export const personaCache = new PersonaCache();
```

---

## 五、3个高优画像实现

### 5.1 产品经理 System Prompt

```typescript
// 添加到 src/lib/ai-agent/personas/persona-prompts.ts

export const PM_PERSONA_PROMPT = `
你是 AnyKeep 的产品助手，专为产品经理优化。

【核心能力】
- 竞品功能分析和对比
- 用户需求聚类分析
- PRD素材整理和检索
- 数据驱动的决策支持

【响应原则】
- 竞品分析按「功能→体验→商业模式」维度展开
- 需求按「频次→价值→可行性」优先级排序
- 数据驱动，避免主观臆断
- 结构化输出，便于二次加工

【响应风格】
- 用户视角思考
- 数据优先
- 结构清晰
- 适度使用 emoji 标记重点

【特殊处理】
- 搜索结果自动识别竞品相关内容
- 整理时按产品/功能维度分组
- 生成对比时使用表格形式
`;
```

### 5.2 咨询顾问 System Prompt

```typescript
export const CONSULTANT_PERSONA_PROMPT = `
你是 AnyKeep 的咨询助手，专为咨询顾问优化。

【核心能力】
- 案例库建设和智能检索
- 方法论和最佳实践整理
- 快速行业研究
- 咨询方案素材管理

【响应原则】
- 案例按「行业→问题类型→解决方案」组织
- 行业研究突出「市场规模→竞争格局→趋势洞察」
- 方法论框架清晰可复用
- 数据来源标注清晰

【响应风格】
- 专业严谨
- 结构化呈现（金字塔原理）
- 数据驱动的表述
- 注重可操作性

【特殊处理】
- 自动识别案例类内容
- 整理时提取核心方法论
- 生成行业洞察摘要
`;
```

### 5.3 大学教师 System Prompt

```typescript
export const TEACHER_PERSONA_PROMPT = `
你是 AnyKeep 的教学助手，专为大学教师优化。

【核心能力】
- 教学资料自动整理和分类
- 前沿论文追踪和推荐
- 教学案例库建设
- 课程内容迭代支持

【响应原则】
- 资料按「课程→章节→知识点」层级组织
- 论文追踪突出「教学价值→研究前沿→实践应用」
- 案例标注适用课程和教学目标
- 兼顾学术严谨和教学易用

【响应风格】
- 学术严谨但不晦涩
- 结构化且有层次
- 适度使用 emoji 增加亲和力
- 注重知识传递的准确性

【特殊处理】
- 自动识别教学相关内容
- 整理时区分教材/论文/案例
- 生成教学大纲结构
`;
```

### 5.4 意图权重配置

```typescript
// 添加到 src/lib/ai-agent/personas/persona-intent-boosts.ts

export const PHASE1_NEW_INTENT_BOOSTS = {
  pm: {
    competitive_analysis: 1.7, // 竞品分析
    feedback_cluster: 1.6, // 反馈聚类
    trend_tracking: 1.4, // 趋势追踪
    fuzzy_search: 1.3, // 模糊搜索
    theme_organize: 1.2, // 主题整理
    data_export: 1.2, // 数据导出
  },

  consultant: {
    industry_research: 1.7, // 行业研究
    case_library: 1.6, // 案例检索
    theme_organize: 1.5, // 主题整理
    find_related: 1.4, // 关联发现
    batch_summarize: 1.3, // 批量摘要
    data_export: 1.2, // 导出报告
  },

  teacher: {
    course_organize: 1.7, // 课程整理
    paper_tracking: 1.5, // 论文追踪
    teaching_case: 1.5, // 教学案例
    batch_summarize: 1.4, // 资料摘要
    knowledge_map: 1.3, // 知识图谱
    find_related: 1.2, // 关联发现
  },
};
```

---

## 六、现有代码适配（关键补充）

> ⚠️ **重要**：本节基于现有代码分析，确保规范可直接落地开发

### 6.1 现有代码依赖分析

| 规范依赖     | 现有代码               | 文件位置                       | 状态            |
| ------------ | ---------------------- | ------------------------------ | --------------- |
| 平台分布统计 | `platformDistribution` | `quick-stats.service.ts:56-57` | ✅ 已有         |
| Prompt 注入  | `mergeSystemPrompt()`  | `prompt-injector.ts:242-277`   | ✅ 已有，需扩展 |
| 动态上下文   | `DynamicContext`       | `context/types.ts`             | ✅ 已有         |
| 统计缓存     | `statsCache`           | `quick-stats.service.ts:80`    | ✅ 已有         |
| 标签频率统计 | **不存在**             | -                              | ❌ **需新增**   |

### 6.2 新增：标签频率统计

**修改文件**：`src/lib/ai-agent/services/quick-stats.service.ts`

```typescript
// ============================================
// 新增：标签频率统计
// 位置：添加到 quick-stats.service.ts 辅助查询函数区域（约 295 行后）
// ============================================

/**
 * 获取标签使用频率
 * 用于画像推断的标签信号
 */
async function getTagFrequency(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from("bookmarks")
    .select("tags")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .not("tags", "is", null);

  if (error) {
    logger.error({ userId, error: error.message }, "getTagFrequency failed");
    return {};
  }

  // 统计标签频率
  const tagMap: Record<string, number> = {};
  for (const b of data || []) {
    if (Array.isArray(b.tags)) {
      for (const tag of b.tags) {
        if (typeof tag === "string" && tag.trim()) {
          const normalizedTag = tag.trim().toLowerCase();
          tagMap[normalizedTag] = (tagMap[normalizedTag] || 0) + 1;
        }
      }
    }
  }

  return tagMap;
}
```

**修改 `QuickStats` 接口**：

```typescript
// 修改 QuickStats 接口（约 41-62 行）
export interface QuickStats {
  /** 书签总数（不含浏览器书签） */
  totalBookmarks: number;
  /** 浏览器书签数 */
  browserBookmarks: number;
  /** 文件夹总数 */
  folderCount: number;
  /** 未分类书签数 */
  uncategorized: number;
  /** 最近 7 天新增 */
  recentAdded: number;
  /** 有 AI 摘要的书签数 */
  withAiSummary: number;
  /** 收藏（星标）书签数 */
  starredCount: number;
  /** 平台分布（前 8 个） */
  platformDistribution: PlatformStat[];
  /** 常用文件夹（前 5 个） */
  topFolders: FolderStat[];
  /** 标签频率 [v3.1 新增] */
  tagFrequency: Record<string, number>;
  /** 统计生成时间 */
  generatedAt: string;
}
```

**修改 `getQuickStats` 函数**：

```typescript
// 修改 getQuickStats 函数（约 93-177 行）
// 在 Promise.all 中添加 getTagFrequency 调用

export async function getQuickStats(
  userId: string,
  skipCache = false,
): Promise<QuickStats> {
  // ... 缓存检查逻辑保持不变 ...

  try {
    const supabase = await createClient();

    // 并行执行所有查询（新增 tagFrequency）
    const [
      bookmarkStats,
      folderCount,
      recentAdded,
      platformCounts,
      folderCounts,
      tagFrequency,  // [v3.1 新增]
    ] = await Promise.all([
      getBookmarkAggregates(supabase, userId),
      getFolderCount(supabase, userId),
      getRecentAddedCount(supabase, userId),
      getPlatformDistribution(supabase, userId),
      getFolderDistribution(supabase, userId),
      getTagFrequency(supabase, userId),  // [v3.1 新增]
    ]);

    const stats: QuickStats = {
      totalBookmarks: bookmarkStats.contentCount,
      browserBookmarks: bookmarkStats.browserCount,
      folderCount,
      uncategorized: bookmarkStats.uncategorized,
      recentAdded,
      withAiSummary: bookmarkStats.withAiSummary,
      starredCount: bookmarkStats.starredCount,
      platformDistribution: platformCounts,
      topFolders: folderCounts,
      tagFrequency,  // [v3.1 新增]
      generatedAt: new Date().toISOString(),
    };

    // ... 缓存和日志逻辑保持不变 ...
  }
}
```

**修改 `createEmptyStats` 函数**：

```typescript
// 修改 createEmptyStats（约 388-401 行）
function createEmptyStats(): QuickStats {
  return {
    totalBookmarks: 0,
    browserBookmarks: 0,
    folderCount: 0,
    uncategorized: 0,
    recentAdded: 0,
    withAiSummary: 0,
    starredCount: 0,
    platformDistribution: [],
    topFolders: [],
    tagFrequency: {}, // [v3.1 新增]
    generatedAt: new Date().toISOString(),
  };
}
```

### 6.3 类型适配：QuickStats → UserBookmarkStats

**新增适配器**：`src/lib/ai-agent/inference/stats-adapter.ts`

```typescript
/**
 * 统计数据适配器
 *
 * 将现有 QuickStats 转换为推断引擎所需的 UserBookmarkStats
 */

import type { QuickStats } from "../services/quick-stats.service";
import type { UserBookmarkStats } from "./types";

/**
 * 将 QuickStats 转换为 UserBookmarkStats
 */
export function adaptQuickStatsToInference(
  userId: string,
  stats: QuickStats,
): UserBookmarkStats {
  // 转换平台分布格式：PlatformStat[] → Record<string, number>
  const platformDistribution: Record<string, number> = {};
  for (const p of stats.platformDistribution) {
    // 使用域名格式（与推断规则匹配）
    const domain = platformCodeToDomain(p.platform);
    if (domain) {
      platformDistribution[domain] = p.count;
    }
  }

  return {
    userId,
    platformDistribution,
    tagFrequency: stats.tagFrequency,
    totalBookmarks: stats.totalBookmarks + stats.browserBookmarks,
    statsRange: {
      from: getSevenDaysAgo(),
      to: stats.generatedAt,
    },
  };
}

/**
 * 平台代码转域名映射
 * 用于匹配推断规则中的域名格式
 */
const PLATFORM_CODE_TO_DOMAIN: Record<string, string> = {
  WECHAT: "mp.weixin.qq.com",
  BILIBILI: "bilibili.com",
  XIAOHONGSHU: "xiaohongshu.com",
  ZHIHU: "zhihu.com",
  WEIBO: "weibo.com",
  DOUYIN: "douyin.com",
  JUEJIN: "juejin.cn",
  CSDN: "csdn.net",
  GITHUB: "github.com",
  ARXIV: "arxiv.org",
  "36KR": "36kr.com",
  PRODUCTHUNT: "producthunt.com",
  HACKERNEWS: "news.ycombinator.com",
  V2EX: "v2ex.com",
  DEDAO: "dedao.cn",
  OTHER: "",
};

function platformCodeToDomain(code: string): string | null {
  return PLATFORM_CODE_TO_DOMAIN[code] || null;
}

function getSevenDaysAgo(): string {
  const date = new Date();
  date.setDate(date.getDate() - 7);
  return date.toISOString();
}
```

---

## 七、与现有系统集成

### 7.1 Prompt 注入器修改

**修改文件**：`src/lib/ai-agent/context/prompt-injector.ts`

**修改方式**：扩展现有 `mergeSystemPrompt` 函数，而非新建类

```typescript
// 修改 src/lib/ai-agent/context/prompt-injector.ts

import { personaInferrer } from "../inference/persona-inferrer";
import { getPersonaPrompt } from "../personas/persona-prompts";
import { getQuickStats } from "../services/quick-stats.service";
import { adaptQuickStatsToInference } from "../inference/stats-adapter";
import { FeatureFlags } from "../config/feature-flags";
import { logger } from "@/lib/logger";

// =============================================================================
// 新增：画像感知 Prompt 构建
// =============================================================================

/**
 * 获取画像感知 Prompt 片段
 *
 * @param userId 用户 ID
 * @returns 画像专属 Prompt 或 null
 */
export async function buildPersonaPrompt(
  userId: string,
): Promise<string | null> {
  // Feature Flag 检查
  if (!FeatureFlags.ENABLE_PERSONA_INFERENCE) {
    return null;
  }

  try {
    // 1. 获取统计数据（复用现有服务）
    const quickStats = await getQuickStats(userId);

    // 2. 适配数据格式
    const inferenceStats = adaptQuickStatsToInference(userId, quickStats);

    // 3. 推断画像
    const result = await personaInferrer.infer(inferenceStats);

    // 4. 获取画像 Prompt
    if (result.primaryPersona !== "general" && result.confidence >= 60) {
      const prompt = getPersonaPrompt(result.primaryPersona);

      logger.debug(
        {
          userId: userId.slice(0, 8) + "...",
          persona: result.primaryPersona,
          confidence: result.confidence,
        },
        "Persona prompt injected",
      );

      return prompt;
    }

    return null;
  } catch (error) {
    logger.error(
      {
        userId: userId.slice(0, 8) + "...",
        error: error instanceof Error ? error.message : String(error),
      },
      "Failed to build persona prompt",
    );
    return null;
  }
}

// =============================================================================
// 修改：扩展 MergePromptOptions
// =============================================================================

/**
 * 合并选项（扩展）
 */
export interface MergePromptOptions {
  /** 使用精简版上下文 */
  minimal?: boolean;
  /** 启用 System-Reminder 注入 */
  enableReminders?: boolean;
  /** 启用主动建议 */
  enableProactive?: boolean;
  /** 最大提醒数量 */
  maxReminders?: number;
  /** 启用情景记忆注入 */
  enableEpisodicMemory?: boolean;
  /** 启用画像推断注入 [v3.1 新增] */
  enablePersonaInference?: boolean;
  /** 用户 ID（画像推断需要）[v3.1 新增] */
  userId?: string;
}

/**
 * 合并基础 Prompt 和动态上下文（扩展版）
 *
 * 注意：此函数现在是异步的，因为画像推断需要异步操作
 */
export async function mergeSystemPromptAsync(
  basePrompt: string,
  ctx: DynamicContext,
  options: MergePromptOptions = {},
): Promise<string> {
  const {
    minimal = false,
    enableReminders = FeatureFlags.ENABLE_SYSTEM_REMINDER,
    enableProactive = true,
    maxReminders = 2,
    enableEpisodicMemory = FeatureFlags.ENABLE_EPISODIC_MEMORY &&
      FeatureFlags.ENABLE_MEMORY_PROMPT,
    enablePersonaInference = FeatureFlags.ENABLE_PERSONA_INFERENCE,
    userId,
  } = options;

  const contextPrompt = minimal
    ? buildMinimalContextPrompt(ctx)
    : buildContextPrompt(ctx);

  let result = `${basePrompt}\n\n${contextPrompt}`;

  // [v3.1 新增] 注入画像感知 Prompt
  if (enablePersonaInference && userId) {
    const personaPrompt = await buildPersonaPrompt(userId);
    if (personaPrompt) {
      result = `${result}\n\n${personaPrompt}`;
    }
  }

  // 注入情景记忆
  if (enableEpisodicMemory && !isEmptyEpisodicMemory(ctx.episodicMemory)) {
    const memoryPrompt = buildEpisodicMemoryPrompt(ctx.episodicMemory!);
    result = `${result}\n\n${memoryPrompt}`;
  }

  // 注入 System-Reminder
  if (enableReminders && shouldInjectReminders(ctx)) {
    result = injectSystemReminders(result, ctx, {
      maxReminders,
      enableProactive,
    });
  }

  return result;
}

/**
 * 原有同步版本保持兼容
 *
 * @deprecated 请使用 mergeSystemPromptAsync
 */
export function mergeSystemPrompt(
  basePrompt: string,
  ctx: DynamicContext,
  options: Omit<MergePromptOptions, "enablePersonaInference" | "userId"> = {},
): string {
  // 保持原有逻辑不变，确保向后兼容
  // ... 原有实现 ...
}
```

### 7.2 调用点修改

**修改文件**：调用 `mergeSystemPrompt` 的地方需要改用异步版本

```typescript
// 示例：unified-engine.ts 或其他调用点

// 修改前
const systemPrompt = mergeSystemPrompt(basePrompt, dynamicContext, options);

// 修改后
const systemPrompt = await mergeSystemPromptAsync(basePrompt, dynamicContext, {
  ...options,
  enablePersonaInference: true,
  userId: userId,
});
```

### 7.3 Feature Flag 配置

```typescript
// 添加到 src/lib/ai-agent/config/feature-flags.ts

export const FEATURE_FLAGS = {
  // ... 现有 flags ...

  // Phase 1 新增
  ENABLE_PERSONA_INFERENCE: true, // 画像推断引擎
  ENABLE_PM_PERSONA: true, // 产品经理画像
  ENABLE_CONSULTANT_PERSONA: true, // 咨询顾问画像
  ENABLE_TEACHER_PERSONA: true, // 大学教师画像
};
```

### 7.4 缓存失效触发

```typescript
// 在收藏变更时触发缓存失效
// 修改 src/lib/bookmark/bookmark-service.ts

import { personaInferrer } from "../ai-agent/inference/persona-inferrer";

export class BookmarkService {
  async addBookmark(userId: string, data: BookmarkData) {
    const result = await this.repository.create(userId, data);

    // 新增：收藏变更时失效画像缓存
    personaInferrer.invalidateCache(userId);

    return result;
  }

  async deleteBookmark(userId: string, bookmarkId: string) {
    const result = await this.repository.delete(bookmarkId);

    // 新增：收藏变更时失效画像缓存
    personaInferrer.invalidateCache(userId);

    return result;
  }
}
```

---

## 七、测试用例

### 7.1 平台匹配器测试

```typescript
// src/lib/ai-agent/inference/__tests__/platform-matcher.test.ts

describe("PlatformMatcher", () => {
  describe("match", () => {
    it("should match arxiv.org to academic personas", () => {
      const distribution = { "arxiv.org": 50 };
      const signals = platformMatcher.match(distribution, 100);

      expect(signals).toHaveLength(1);
      expect(signals[0].personas).toContain("phd");
      expect(signals[0].personas).toContain("master");
    });

    it("should match 36kr.com to pm persona", () => {
      const distribution = { "36kr.com": 30 };
      const signals = platformMatcher.match(distribution, 100);

      expect(signals[0].personas).toContain("pm");
    });

    it("should handle unknown platforms gracefully", () => {
      const distribution = { "unknown-site.com": 50 };
      const signals = platformMatcher.match(distribution, 100);

      expect(signals).toHaveLength(0);
    });

    it("should calculate weight based on ratio", () => {
      const distribution = { "github.com": 80 };
      const signals = platformMatcher.match(distribution, 100);

      expect(signals[0].weight).toBe(0.8);
    });
  });
});
```

### 7.2 标签匹配器测试

```typescript
// src/lib/ai-agent/inference/__tests__/tag-matcher.test.ts

describe("TagMatcher", () => {
  describe("match", () => {
    it("should match 竞品 tag to pm persona", () => {
      const tagFrequency = { 竞品分析: 20 };
      const signals = tagMatcher.match(tagFrequency, 100);

      expect(signals[0].personas).toContain("pm");
    });

    it("should match 论文 tag to academic personas", () => {
      const tagFrequency = { 论文: 30 };
      const signals = tagMatcher.match(tagFrequency, 100);

      expect(signals[0].personas).toContain("phd");
      expect(signals[0].personas).toContain("master");
    });

    it("should match multiple tags", () => {
      const tagFrequency = {
        竞品: 20,
        论文: 15,
      };
      const signals = tagMatcher.match(tagFrequency, 100);

      expect(signals).toHaveLength(2);
    });
  });
});
```

### 7.3 信号融合测试

```typescript
// src/lib/ai-agent/inference/__tests__/signal-fusion.test.ts

describe("SignalFusion", () => {
  describe("generateResult", () => {
    it("should return pm as primary when pm signals dominate", () => {
      const signals: InferenceSignal[] = [
        {
          type: "platform",
          source: "36kr.com",
          personas: ["pm"],
          weight: 0.6,
          count: 60,
        },
        {
          type: "tag",
          source: "竞品",
          personas: ["pm"],
          weight: 0.3,
          count: 30,
        },
      ];

      const result = signalFusion.generateResult(signals, 100);

      expect(result.primaryPersona).toBe("pm");
      expect(result.confidence).toBeGreaterThan(60);
    });

    it("should return general when no signals", () => {
      const result = signalFusion.generateResult([], 0);

      expect(result.primaryPersona).toBe("general");
    });

    it("should include alternatives sorted by confidence", () => {
      const signals: InferenceSignal[] = [
        {
          type: "platform",
          source: "36kr.com",
          personas: ["pm", "tech_blogger"],
          weight: 0.5,
          count: 50,
        },
      ];

      const result = signalFusion.generateResult(signals, 100);

      expect(result.alternatives.length).toBeGreaterThan(0);
      expect(result.alternatives[0].confidence).toBeLessThanOrEqual(
        result.confidence,
      );
    });
  });
});
```

### 7.4 推断引擎集成测试

```typescript
// src/lib/ai-agent/inference/__tests__/persona-inferrer.test.ts

describe("PersonaInferrer", () => {
  beforeEach(() => {
    personaCache.clear();
  });

  describe("infer", () => {
    it("should infer pm persona for product manager behavior", async () => {
      const stats: UserBookmarkStats = {
        userId: "test-user-1",
        platformDistribution: {
          "36kr.com": 40,
          "producthunt.com": 30,
        },
        tagFrequency: {
          竞品: 25,
          PRD: 15,
        },
        totalBookmarks: 100,
        statsRange: { from: "2025-01-01", to: "2025-12-28" },
      };

      const result = await personaInferrer.infer(stats);

      expect(result.primaryPersona).toBe("pm");
      expect(result.group).toBe("design");
      expect(result.confidence).toBeGreaterThan(60);
    });

    it("should return general for insufficient sample size", async () => {
      const stats: UserBookmarkStats = {
        userId: "test-user-2",
        platformDistribution: { "36kr.com": 5 },
        tagFrequency: {},
        totalBookmarks: 5,
        statsRange: { from: "2025-01-01", to: "2025-12-28" },
      };

      const result = await personaInferrer.infer(stats);

      expect(result.primaryPersona).toBe("general");
    });

    it("should use cache on second call", async () => {
      const stats: UserBookmarkStats = {
        userId: "test-user-3",
        platformDistribution: { "github.com": 50 },
        tagFrequency: {},
        totalBookmarks: 50,
        statsRange: { from: "2025-01-01", to: "2025-12-28" },
      };

      await personaInferrer.infer(stats);
      const cached = await personaInferrer.infer(stats);

      expect(personaCache.size).toBe(1);
    });

    it("should refresh when forceRefresh is true", async () => {
      const stats: UserBookmarkStats = {
        userId: "test-user-4",
        platformDistribution: { "github.com": 50 },
        tagFrequency: {},
        totalBookmarks: 50,
        statsRange: { from: "2025-01-01", to: "2025-12-28" },
      };

      await personaInferrer.infer(stats);
      await personaInferrer.infer(stats, true); // forceRefresh

      // 验证重新计算（通过日志或其他方式）
    });
  });
});
```

---

## 八、验收标准

### 8.1 功能验收

| 验收项   | 标准                  | 验证方法     |
| -------- | --------------------- | ------------ |
| 类型系统 | 25+ 类型定义完整      | 类型检查通过 |
| 平台匹配 | 覆盖 20+ 主流平台     | 单元测试     |
| 标签匹配 | 覆盖 15+ 标签模式     | 单元测试     |
| 信号融合 | 正确计算置信度        | 集成测试     |
| 3个画像  | Prompt 和意图权重就绪 | 手动验证     |
| 缓存机制 | 1小时过期，变更失效   | 单元测试     |

### 8.2 性能验收

| 指标       | 标准        | 验证方法 |
| ---------- | ----------- | -------- |
| 推断延迟   | P99 < 100ms | 压测     |
| 缓存命中率 | > 90%       | 监控     |
| 内存占用   | 缓存 < 10MB | 监控     |

### 8.3 兼容性验收

| 验收项            | 标准           | 验证方法 |
| ----------------- | -------------- | -------- |
| 原有 9 类画像     | 功能不受影响   | 回归测试 |
| 原有 20 种意图    | 匹配准确率不降 | 回归测试 |
| Feature Flag 关闭 | 回退到 general | 手动验证 |

### 8.4 用户体验验收

| 验收项     | 标准                     |
| ---------- | ------------------------ |
| 用户无感知 | 无任何新 UI 元素         |
| 响应质量   | PM/咨询/教师用户感知提升 |
| 无干扰     | 不弹窗、不引导、不询问   |

---

## 九、任务分解

### 9.1 开发任务清单

| 序号     | 任务                  | 预估工时 | 依赖        |
| -------- | --------------------- | -------- | ----------- |
| 1        | 类型系统扩展          | 4h       | -           |
| 2        | 平台匹配器实现        | 4h       | 1           |
| 3        | 标签匹配器实现        | 3h       | 1           |
| 4        | 信号融合器实现        | 4h       | 2, 3        |
| 5        | 置信度计算器          | 2h       | 4           |
| 6        | 推断引擎主入口        | 4h       | 5           |
| 7        | 画像缓存实现          | 2h       | 6           |
| 8        | PM 画像 + Prompt      | 3h       | 1           |
| 9        | 咨询顾问画像 + Prompt | 3h       | 1           |
| 10       | 大学教师画像 + Prompt | 3h       | 1           |
| 11       | Prompt 注入器集成     | 4h       | 7, 8, 9, 10 |
| 12       | 缓存失效触发          | 2h       | 7           |
| 13       | Feature Flag 配置     | 1h       | -           |
| 14       | 单元测试编写          | 6h       | 2-7         |
| 15       | 集成测试编写          | 4h       | 11          |
| **总计** |                       | **49h**  |             |

### 9.2 里程碑

| 里程碑       | 完成任务 | 预计日期 |
| ------------ | -------- | -------- |
| M1: 基础设施 | 1-7      | Day 3    |
| M2: 画像实现 | 8-10     | Day 5    |
| M3: 系统集成 | 11-13    | Day 7    |
| M4: 测试验收 | 14-15    | Day 10   |

---

## 十、风险与缓解

| 风险           | 概率 | 影响 | 缓解措施                |
| -------------- | ---- | ---- | ----------------------- |
| 推断准确率低   | 中   | 中   | 保守阈值 + 回退 general |
| 性能影响       | 低   | 中   | 缓存 + 异步推断         |
| 与现有系统冲突 | 低   | 高   | Feature Flag 保护       |
| 用户感知变化   | 低   | 高   | 严格零 UI 变更          |

---

**文档结束**

> 审批后进入开发阶段
> 预计开发周期：10 个工作日
