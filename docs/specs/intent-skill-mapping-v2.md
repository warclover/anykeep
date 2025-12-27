# 统一意图→Skill 映射 v2.0

> **设计原则**: 轻量化 + 免打扰 + 渐进式

## 1. 问题分析

### 1.1 当前架构

```
用户输入
    ↓
IntentClassifier (intent-classifier.ts)
    ↓ IntentClassification
ComplexityEvaluator (complexity-evaluator.ts)
    ↓ ComplexityEvaluation
ModeSelector (mode-selector.ts)
    ↓ ModeSelection
ExecutionCoordinator
```

### 1.2 现有问题

| 问题                            | 影响         | 轻量化方案            |
| ------------------------------- | ------------ | --------------------- |
| 配置分散在 3 个文件             | 维护困难     | 合并为单一配置        |
| 硬编码 `DEFAULT_RULES`          | 修改需重部署 | 配置外置              |
| 硬编码 `DEFAULT_SKILL_MAPPINGS` | 扩展不便     | 统一映射表            |
| 无用户偏好                      | 个性化受限   | 复用 `ai_preferences` |

## 2. 轻量化设计

### 2.1 设计目标

```
┌────────────────────────────────────────────────────────────┐
│                    设计原则                                  │
├────────────────────────────────────────────────────────────┤
│ ✅ 轻量化：复用现有组件，不新建复杂抽象层                    │
│ ✅ 免打扰：减少代码改动点，渐进式替换                        │
│ ✅ 配置化：映射关系可配置，无需改代码                        │
│ ✅ 兼容性：保持现有 API 不变                                 │
└────────────────────────────────────────────────────────────┘
```

### 2.2 最小改动方案

**不新建文件**，仅重构现有文件：

```
src/lib/ai-skills/
├── config/                          # 新增：配置目录
│   ├── types.ts                     # 类型定义
│   ├── intent-patterns.ts           # 意图模式配置
│   ├── skill-mappings.ts            # Skill 映射配置
│   └── index.ts                     # 统一导出
├── router/
│   ├── intent-classifier.ts         # 修改：引用配置
│   ├── mode-selector.ts             # 修改：引用配置
│   └── intent-router.ts             # 保持不变
└── ...
```

## 3. 配置结构

### 3.1 意图模式配置

```typescript
// src/lib/ai-skills/config/intent-patterns.ts

/**
 * 意图模式定义
 *
 * 从 intent-classifier.ts 的 DEFAULT_RULES 提取
 */
export interface IntentPattern {
  /** 意图类型 */
  type: IntentType;
  /** 子类型 */
  subType: string;
  /** 匹配模式（正则字符串） */
  pattern: string;
  /** 权重 0-100 */
  weight: number;
  /** 默认复杂度 */
  complexity: "simple" | "medium" | "complex";
}

/**
 * 默认意图模式
 */
export const INTENT_PATTERNS: IntentPattern[] = [
  // ===== 学习类（最高权重） =====
  {
    type: "learn",
    subType: "review",
    pattern: "复习|回顾|巩固",
    weight: 90,
    complexity: "complex",
  },
  {
    type: "learn",
    subType: "path",
    pattern: "学习路径|学习计划|怎么学",
    weight: 85,
    complexity: "complex",
  },
  {
    type: "learn",
    subType: "plan",
    pattern: "阅读计划|读书计划",
    weight: 80,
    complexity: "medium",
  },

  // ===== 整理类 =====
  {
    type: "organize",
    subType: "dedupe",
    pattern: "去重|重复|删除重复",
    weight: 85,
    complexity: "complex",
  },
  {
    type: "organize",
    subType: "cleanup",
    pattern: "整理|清理|规整",
    weight: 80,
    complexity: "complex",
  },
  {
    type: "organize",
    subType: "classify",
    pattern: "分类|归类|打标签",
    weight: 75,
    complexity: "medium",
  },

  // ===== 分析类 =====
  {
    type: "analyze",
    subType: "report",
    pattern: "周报|月报|报告",
    weight: 80,
    complexity: "complex",
  },
  {
    type: "analyze",
    subType: "insight",
    pattern: "分析|洞察|趋势",
    weight: 75,
    complexity: "complex",
  },
  {
    type: "analyze",
    subType: "discover",
    pattern: "发现|推荐|相关",
    weight: 70,
    complexity: "medium",
  },

  // ===== 创建类 =====
  {
    type: "create",
    subType: "digest",
    pattern: "摘要|总结|速览",
    weight: 70,
    complexity: "medium",
  },
  {
    type: "create",
    subType: "export",
    pattern: "导出|下载|保存为",
    weight: 65,
    complexity: "simple",
  },
  {
    type: "create",
    subType: "share",
    pattern: "分享|发送",
    weight: 60,
    complexity: "medium",
  },

  // ===== 查询类（基础） =====
  {
    type: "query",
    subType: "search",
    pattern: "搜索|搜|找|查",
    weight: 50,
    complexity: "simple",
  },
  {
    type: "query",
    subType: "list",
    pattern: "列出|列表|显示|看看",
    weight: 45,
    complexity: "simple",
  },
  {
    type: "query",
    subType: "count",
    pattern: "有多少|数量|统计",
    weight: 40,
    complexity: "simple",
  },

  // ===== 操作类 =====
  {
    type: "action",
    subType: "delete",
    pattern: "删除|移除|清除",
    weight: 50,
    complexity: "simple",
  },
  {
    type: "action",
    subType: "move",
    pattern: "移动|移到|放到",
    weight: 45,
    complexity: "simple",
  },
  {
    type: "action",
    subType: "tag",
    pattern: "加标签|打标签|标记",
    weight: 45,
    complexity: "simple",
  },
];
```

### 3.2 Skill 映射配置

```typescript
// src/lib/ai-skills/config/skill-mappings.ts

/**
 * Skill 映射定义
 *
 * 从 mode-selector.ts 的 DEFAULT_SKILL_MAPPINGS 提取
 */
export interface SkillMapping {
  /** 映射键：intentType:subType */
  key: string;
  /** Skill ID */
  skillId: string;
  /** 显示名称 */
  name: string;
  /** 执行模式 */
  mode: "atomic" | "orchestration";
  /** 最低复杂度要求 */
  minComplexity?: "simple" | "medium" | "complex";
  /** 是否启用 */
  enabled: boolean;
}

/**
 * 默认 Skill 映射
 *
 * 格式：intentType:subType → SkillId
 */
export const SKILL_MAPPINGS: SkillMapping[] = [
  // ===== 学习类 → 编排模式 =====
  {
    key: "learn:review",
    skillId: "knowledge_review",
    name: "知识回顾助手",
    mode: "orchestration",
    minComplexity: "medium",
    enabled: true,
  },
  {
    key: "learn:path",
    skillId: "learning_path",
    name: "学习路径规划",
    mode: "orchestration",
    minComplexity: "complex",
    enabled: true,
  },
  {
    key: "learn:plan",
    skillId: "reading_planner",
    name: "阅读计划助手",
    mode: "orchestration",
    minComplexity: "medium",
    enabled: true,
  },

  // ===== 整理类 → 编排模式 =====
  {
    key: "organize:cleanup",
    skillId: "batch_organize",
    name: "智能整理助手",
    mode: "orchestration",
    minComplexity: "medium",
    enabled: true,
  },
  {
    key: "organize:dedupe",
    skillId: "duplicate_cleanup",
    name: "重复清理助手",
    mode: "orchestration",
    minComplexity: "medium",
    enabled: true,
  },
  {
    key: "organize:classify",
    skillId: "smart_tagging",
    name: "智能标签助手",
    mode: "orchestration",
    minComplexity: "medium",
    enabled: true,
  },

  // ===== 分析类 → 编排模式 =====
  {
    key: "analyze:report",
    skillId: "periodic_report",
    name: "周期报告生成",
    mode: "orchestration",
    minComplexity: "complex",
    enabled: true,
  },
  {
    key: "analyze:insight",
    skillId: "insight_report",
    name: "收藏洞察分析",
    mode: "orchestration",
    minComplexity: "medium",
    enabled: true,
  },
  {
    key: "analyze:discover",
    skillId: "related_discovery",
    name: "相关发现助手",
    mode: "orchestration",
    minComplexity: "medium",
    enabled: true,
  },

  // ===== 创建类 → 混合模式 =====
  {
    key: "create:digest",
    skillId: "quick_digest",
    name: "快速摘要生成",
    mode: "orchestration",
    minComplexity: "simple",
    enabled: true,
  },
  {
    key: "create:export",
    skillId: "data_export",
    name: "数据导出助手",
    mode: "orchestration",
    minComplexity: "simple",
    enabled: true,
  },
  {
    key: "create:share",
    skillId: "share_bundle",
    name: "分享包生成",
    mode: "orchestration",
    minComplexity: "medium",
    enabled: true,
  },

  // ===== 查询类 → 原子模式 =====
  {
    key: "query:search",
    skillId: "search",
    name: "搜索",
    mode: "atomic",
    enabled: true,
  },
  {
    key: "query:list",
    skillId: "search",
    name: "列表",
    mode: "atomic",
    enabled: true,
  },
  {
    key: "query:count",
    skillId: "search",
    name: "统计",
    mode: "atomic",
    enabled: true,
  },

  // ===== 操作类 → 原子模式 =====
  {
    key: "action:delete",
    skillId: "delete",
    name: "删除",
    mode: "atomic",
    enabled: true,
  },
  {
    key: "action:move",
    skillId: "move",
    name: "移动",
    mode: "atomic",
    enabled: true,
  },
  {
    key: "action:tag",
    skillId: "tag",
    name: "打标签",
    mode: "atomic",
    enabled: true,
  },
];

/**
 * 显式工具映射（UI 直接触发）
 */
export const EXPLICIT_TOOL_MAPPINGS: Record<
  string,
  { skillId: string; mode: "atomic" | "orchestration" }
> = {
  search: { skillId: "search", mode: "atomic" },
  organize: { skillId: "batch_organize", mode: "orchestration" },
  dedupe: { skillId: "duplicate_cleanup", mode: "orchestration" },
  tag: { skillId: "smart_tagging", mode: "orchestration" },
  stats: { skillId: "insight_report", mode: "orchestration" },
  review: { skillId: "knowledge_review", mode: "orchestration" },
  export: { skillId: "data_export", mode: "orchestration" },
  summarize: { skillId: "quick_digest", mode: "orchestration" },
};
```

### 3.3 配置索引

```typescript
// src/lib/ai-skills/config/index.ts

export { INTENT_PATTERNS, type IntentPattern } from "./intent-patterns";
export {
  SKILL_MAPPINGS,
  EXPLICIT_TOOL_MAPPINGS,
  type SkillMapping,
} from "./skill-mappings";

/**
 * 构建映射索引（O(1) 查找）
 */
export function buildMappingIndex(
  mappings: SkillMapping[],
): Map<string, SkillMapping> {
  const index = new Map<string, SkillMapping>();
  for (const mapping of mappings) {
    if (mapping.enabled) {
      index.set(mapping.key, mapping);
    }
  }
  return index;
}

/**
 * 查找映射
 *
 * 优先级：精确匹配 > 类型通配 > 默认兜底
 */
export function findMapping(
  index: Map<string, SkillMapping>,
  intentType: string,
  subType: string,
): SkillMapping | null {
  // 1. 精确匹配
  const exactKey = `${intentType}:${subType}`;
  if (index.has(exactKey)) {
    return index.get(exactKey)!;
  }

  // 2. 类型通配
  const wildcardKey = `${intentType}:*`;
  if (index.has(wildcardKey)) {
    return index.get(wildcardKey)!;
  }

  // 3. 无匹配
  return null;
}
```

## 4. 免打扰原则

### 4.1 确认门槛

| 操作类型  | 影响数量 | 处理方式     |
| --------- | -------- | ------------ |
| 查询类    | 任意     | 静默执行     |
| 标签/移动 | ≤50      | 静默执行     |
| 标签/移动 | >50      | 显示数量确认 |
| 删除      | ≤5       | 简短确认     |
| 删除      | >5       | 列表确认     |

### 4.2 置信度执行策略

```typescript
// 复用现有 response-templates.ts 的风险分级

/**
 * 基于置信度的执行策略
 */
export function getExecutionStrategy(
  confidence: number,
  riskLevel: RiskLevel,
): "silent" | "brief" | "confirm" {
  // 高置信度 + 低风险 → 静默执行
  if (confidence >= 0.85 && riskLevel === "low") {
    return "silent";
  }

  // 中置信度 或 中风险 → 简短说明
  if (confidence >= 0.6 || riskLevel === "medium") {
    return "brief";
  }

  // 低置信度 或 高风险 → 确认
  return "confirm";
}
```

### 4.3 用户偏好覆盖

```typescript
// 复用现有 ai_preferences 表

interface UserMappingPreference {
  /** 用户自定义的意图→Skill 偏好 */
  customMappings?: Record<string, string>;
  /** 禁用的 Skill ID 列表 */
  disabledSkills?: string[];
  /** 确认阈值覆盖 */
  confirmThreshold?: number;
}

/**
 * 合并用户偏好
 */
export function mergeUserPreferences(
  defaultMappings: Map<string, SkillMapping>,
  userPrefs: UserMappingPreference,
): Map<string, SkillMapping> {
  const merged = new Map(defaultMappings);

  // 应用自定义映射
  if (userPrefs.customMappings) {
    for (const [key, skillId] of Object.entries(userPrefs.customMappings)) {
      const existing = merged.get(key);
      if (existing) {
        merged.set(key, { ...existing, skillId });
      }
    }
  }

  // 移除禁用的 Skill
  if (userPrefs.disabledSkills) {
    for (const [key, mapping] of merged) {
      if (userPrefs.disabledSkills.includes(mapping.skillId)) {
        merged.delete(key);
      }
    }
  }

  return merged;
}
```

## 5. 实施计划

### Phase 1：配置抽取（本次实施）

**目标**：将硬编码配置抽取到独立文件

**改动文件**：

1. 新增 `src/lib/ai-skills/config/types.ts`
2. 新增 `src/lib/ai-skills/config/intent-patterns.ts`
3. 新增 `src/lib/ai-skills/config/skill-mappings.ts`
4. 新增 `src/lib/ai-skills/config/index.ts`

**不改动**：

- `intent-classifier.ts` - 暂不修改，保持兼容
- `mode-selector.ts` - 暂不修改，保持兼容

### Phase 2：引用替换

**目标**：让现有组件引用新配置

**改动文件**：

1. 修改 `intent-classifier.ts` - 引用 `INTENT_PATTERNS`
2. 修改 `mode-selector.ts` - 引用 `SKILL_MAPPINGS`

### Phase 3：用户偏好集成（可选）

**目标**：支持用户自定义映射

**改动文件**：

1. 扩展 `ai_preferences` 表
2. 修改 `preferences-service.ts`

## 6. 映射全景图

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           意图 → Skill 映射全景                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  用户输入                                                                    │
│      │                                                                      │
│      ▼                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 意图分类 (IntentClassifier)                                          │   │
│  │                                                                      │   │
│  │  INTENT_PATTERNS 配置驱动                                            │   │
│  │  ┌──────────────┬──────────────┬──────────────┬──────────────┐      │   │
│  │  │ learn:review │ organize:*   │ analyze:*    │ query:*      │      │   │
│  │  │ weight: 90   │ weight: 75-85│ weight: 70-80│ weight: 40-50│      │   │
│  │  └──────────────┴──────────────┴──────────────┴──────────────┘      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│      │                                                                      │
│      ▼ IntentClassification                                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 模式选择 (ModeSelector)                                               │   │
│  │                                                                      │   │
│  │  SKILL_MAPPINGS 配置驱动                                             │   │
│  │  ┌─────────────────────────────────────────────────────────────┐    │   │
│  │  │ learn:review  → knowledge_review  (orchestration)           │    │   │
│  │  │ organize:*    → batch_organize    (orchestration)           │    │   │
│  │  │ analyze:*     → insight_report    (orchestration)           │    │   │
│  │  │ query:*       → search            (atomic)                  │    │   │
│  │  │ action:*      → [direct tool]     (atomic)                  │    │   │
│  │  └─────────────────────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│      │                                                                      │
│      ▼ ModeSelection                                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 执行协调 (ExecutionCoordinator)                                       │   │
│  │                                                                      │   │
│  │  mode = "atomic"        │  mode = "orchestration"                   │   │
│  │  ─────────────────────  │  ────────────────────────────            │   │
│  │  KnowledgeAgent         │  OrchestrationEngine                      │   │
│  │  └─ Tools 调用          │  └─ Skill.executeStream()                 │   │
│  │     • search            │     • knowledge_review (5步)              │   │
│  │     • classify          │     • batch_organize (6步)                │   │
│  │     • summary           │     • insight_report (5步)                │   │
│  │                         │     • data_export (4步)                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 7. 总结

| 维度     | 当前            | 改进后                   |
| -------- | --------------- | ------------------------ |
| 配置位置 | 分散在 3 个文件 | 集中在 `config/` 目录    |
| 修改方式 | 改代码          | 改配置                   |
| 用户偏好 | 不支持          | 复用 `ai_preferences`    |
| 确认门槛 | 20 条           | 50 条（已调整）          |
| 扩展性   | 低              | 高（新增映射只需加配置） |
| 兼容性   | -               | 100%（渐进式）           |
