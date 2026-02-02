# 双模式智能体系统 - 落地开发方案 (V4.0)

## 文档信息

| 属性         | 值                                                              |
| ------------ | --------------------------------------------------------------- |
| **版本**     | V4.0                                                            |
| **创建日期** | 2026-02-02                                                      |
| **预估周期** | 2-2.5 周                                                        |
| **开发者**   | 独立开发者                                                      |
| **前置文档** | requirements-V4.0.md, design-V4.0.md, epics-and-stories-V4.0.md |

---

## 目录

1. [环境准备](#1-环境准备)
2. [数据库迁移](#2-数据库迁移)
3. [模块结构](#3-模块结构)
4. [核心实现](#4-核心实现)
5. [UI 组件](#5-ui-组件)
6. [集成指南](#6-集成指南)
7. [测试方案](#7-测试方案)
8. [开发检查点](#8-开发检查点)

---

## 1. 环境准备

### 1.1 新增依赖

```bash
# 语言检测库 (3KB)
npm install franc-min

# 类型定义 (如需要)
npm install -D @types/franc-min
```

### 1.2 目录创建

```bash
# 创建模块目录结构
mkdir -p src/lib/fluid-agent/{prediction,execution,commands,telemetry}
mkdir -p src/lib/fluid-agent/prediction/rules
mkdir -p src/lib/fluid-agent/ui/{hooks,components}
mkdir -p src/lib/fluid-agent/__tests__
```

### 1.3 TypeScript 配置

确认 `tsconfig.json` 包含新路径：

```json
{
  "compilerOptions": {
    "paths": {
      "@/lib/fluid-agent/*": ["./src/lib/fluid-agent/*"]
    }
  }
}
```

---

## 2. 数据库迁移

### 2.1 rule_telemetry 表

**文件**: `supabase/migrations/20260202000001_create_rule_telemetry.sql`

```sql
-- =====================================================
-- 规则遥测表 - 记录规则匹配和用户决策
-- =====================================================

CREATE TABLE IF NOT EXISTS rule_telemetry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rule_id TEXT NOT NULL,
  selection_count INTEGER NOT NULL CHECK (selection_count > 0),
  matched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted BOOLEAN,  -- null=未决定, true=接受, false=忽略
  decided_at TIMESTAMPTZ,
  session_id TEXT NOT NULL,

  -- 约束
  CONSTRAINT valid_decision CHECK (
    (accepted IS NULL AND decided_at IS NULL) OR
    (accepted IS NOT NULL AND decided_at IS NOT NULL)
  )
);

-- 索引
CREATE INDEX idx_rule_telemetry_user_id ON rule_telemetry(user_id);
CREATE INDEX idx_rule_telemetry_rule_id ON rule_telemetry(rule_id);
CREATE INDEX idx_rule_telemetry_matched_at ON rule_telemetry(matched_at DESC);
CREATE INDEX idx_rule_telemetry_session ON rule_telemetry(session_id);

-- RLS 策略
ALTER TABLE rule_telemetry ENABLE ROW LEVEL SECURITY;

-- 用户只能插入自己的遥测数据
CREATE POLICY "Users can insert own telemetry"
  ON rule_telemetry FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 用户只能查看自己的数据（调试用）
CREATE POLICY "Users can view own telemetry"
  ON rule_telemetry FOR SELECT
  USING (auth.uid() = user_id);

-- 管理员可以查看所有数据（分析用）
CREATE POLICY "Service role can view all telemetry"
  ON rule_telemetry FOR SELECT
  USING (auth.role() = 'service_role');

-- 30 天自动清理
SELECT cron.schedule(
  'cleanup-old-rule-telemetry',
  '0 3 * * *',  -- 每天凌晨 3 点
  $$DELETE FROM rule_telemetry WHERE matched_at < now() - INTERVAL '30 days'$$
);

-- 聚合视图：规则效果统计
CREATE OR REPLACE VIEW rule_telemetry_stats AS
SELECT
  rule_id,
  COUNT(*) as match_count,
  COUNT(*) FILTER (WHERE accepted = true) as accept_count,
  COUNT(*) FILTER (WHERE accepted = false) as ignore_count,
  COUNT(*) FILTER (WHERE accepted IS NULL) as pending_count,
  ROUND(
    COUNT(*) FILTER (WHERE accepted = true)::NUMERIC /
    NULLIF(COUNT(*) FILTER (WHERE accepted IS NOT NULL), 0) * 100,
    2
  ) as accept_rate
FROM rule_telemetry
WHERE matched_at > now() - INTERVAL '7 days'
GROUP BY rule_id
ORDER BY match_count DESC;

COMMENT ON TABLE rule_telemetry IS '规则引擎遥测数据，用于验证规则覆盖率和用户接受度';
```

### 2.2 operation_snapshots 表扩展（如需要）

**文件**: `supabase/migrations/20260202000002_extend_operation_snapshots.sql`

```sql
-- =====================================================
-- 检查并扩展 operation_snapshots 表
-- =====================================================

-- 检查是否需要添加 entity_type 字段
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'operation_snapshots'
    AND column_name = 'entity_type'
  ) THEN
    ALTER TABLE operation_snapshots
    ADD COLUMN entity_type TEXT DEFAULT 'folder'
    CHECK (entity_type IN ('bookmark', 'folder', 'tag'));

    COMMENT ON COLUMN operation_snapshots.entity_type IS '实体类型：bookmark/folder/tag';
  END IF;
END $$;

-- 确保有过期时间索引
CREATE INDEX IF NOT EXISTS idx_operation_snapshots_expires_at
ON operation_snapshots(expires_at);

-- 确保有 Cron 清理任务
SELECT cron.schedule(
  'cleanup-expired-snapshots',
  '0 * * * *',  -- 每小时
  $$DELETE FROM operation_snapshots WHERE expires_at < now()$$
);
```

### 2.3 生成 TypeScript 类型

```bash
# 运行 Supabase 类型生成
npm run supabase:gen:types
```

---

## 3. 模块结构

### 3.1 完整目录树

```
src/lib/fluid-agent/
├── index.ts                      # 模块入口，导出所有公共 API
├── types.ts                      # 共享类型定义
│
├── prediction/                   # 规则引擎
│   ├── index.ts                  # 导出
│   ├── types.ts                  # 类型定义
│   ├── rule-registry.ts          # 规则注册表
│   ├── prediction-engine.ts      # 预测引擎
│   ├── language-detector.ts      # 语言检测
│   └── rules/                    # 规则定义
│       ├── index.ts              # 规则聚合
│       ├── language-rules.ts     # 语言相关 (3条)
│       ├── content-rules.ts      # 内容相关 (6条)
│       ├── quantity-rules.ts     # 数量相关 (2条)
│       ├── time-rules.ts         # 时间相关 (3条)
│       ├── source-rules.ts       # 来源相关 (3条)
│       └── organization-rules.ts # 标签/文件夹相关 (3条)
│
├── execution/                    # 执行引擎
│   ├── index.ts
│   ├── types.ts
│   ├── operation-executor.ts     # 操作执行器
│   └── snapshot-manager.ts       # 快照管理
│
├── commands/                     # 指令框
│   ├── index.ts
│   ├── types.ts
│   ├── command-matcher.ts        # 关键词匹配
│   └── preset-commands.ts        # 预设命令
│
├── telemetry/                    # 遥测系统
│   ├── index.ts
│   ├── types.ts
│   ├── telemetry-manager.ts      # 遥测管理器
│   └── telemetry-hooks.ts        # React Hooks
│
├── ui/                           # UI 层
│   ├── hooks/
│   │   ├── index.ts
│   │   ├── use-prediction.ts     # 预测 Hook
│   │   ├── use-agent-highlight.ts # 高亮 Hook
│   │   ├── use-battery.ts        # 电池 Hook
│   │   └── use-reduce-motion.ts  # 动效偏好 Hook
│   └── components/
│       ├── index.ts
│       ├── prediction-button.tsx # 推荐按钮
│       ├── prediction-sheet.tsx  # 推荐列表 (移动端)
│       ├── execution-status.tsx  # 状态栏
│       ├── undo-toast.tsx        # 撤销通知
│       ├── battery-indicator.tsx # 电池图标
│       ├── delete-confirm-dialog.tsx  # 删除确认
│       └── quota-exhausted-dialog.tsx # 配额耗尽
│
└── __tests__/                    # 测试
    ├── prediction-engine.test.ts
    ├── snapshot-manager.test.ts
    ├── telemetry-manager.test.ts
    ├── integration.test.ts
    └── performance.test.ts
```

### 3.2 模块入口 (index.ts)

```typescript
// src/lib/fluid-agent/index.ts

// 类型导出
export * from "./types";

// 规则引擎
export { ruleRegistry } from "./prediction/rule-registry";
export { predictionEngine } from "./prediction/prediction-engine";
export { languageDetector } from "./prediction/language-detector";

// 执行引擎
export { operationExecutor } from "./execution/operation-executor";
export { snapshotManager } from "./execution/snapshot-manager";

// 指令框
export { commandMatcher } from "./commands/command-matcher";

// 遥测
export { telemetryManager } from "./telemetry/telemetry-manager";

// Hooks
export { usePrediction } from "./ui/hooks/use-prediction";
export {
  useAgentHighlight,
  useHighlightStore,
} from "./ui/hooks/use-agent-highlight";
export { useBattery } from "./ui/hooks/use-battery";
export { useReduceMotion } from "./ui/hooks/use-reduce-motion";

// 组件
export { PredictionButton } from "./ui/components/prediction-button";
export { PredictionSheet } from "./ui/components/prediction-sheet";
export { ExecutionStatus } from "./ui/components/execution-status";
export { UndoToast } from "./ui/components/undo-toast";
export { BatteryIndicator } from "./ui/components/battery-indicator";
```

---

## 4. 核心实现

### 4.1 类型定义

**文件**: `src/lib/fluid-agent/types.ts`

```typescript
// =====================================================
// 共享类型定义
// =====================================================

import type { Bookmark } from "@/types/bookmark";

// --- 规则引擎 ---

export type RuleCategory =
  | "language"
  | "content"
  | "quantity"
  | "time"
  | "source"
  | "tag"
  | "folder";

export interface PredictionRule {
  id: string;
  name: string;
  icon: string;
  priority: number; // 0-100
  category: RuleCategory;
  enabled: boolean;
  condition: (selection: Bookmark[]) => boolean;
  action: string; // Skill 或 Tool 名称
  params?: (selection: Bookmark[]) => Record<string, unknown>;
}

export interface PredictionResult {
  ruleId: string;
  action: string;
  icon: string;
  label: string;
  confidence: number;
  affectedCount: number;
  params?: Record<string, unknown>;
}

// --- 执行引擎 ---

export type OperationStepStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed";

export interface OperationStep {
  id: string;
  name: string;
  status: OperationStepStatus;
  progress?: number;
  error?: string;
}

export interface OperationContext {
  operationId: string;
  userId: string;
  action: string;
  selection: Bookmark[];
  steps: OperationStep[];
  startedAt: Date;
  isCancelled: boolean;
}

export interface OperationResult {
  success: boolean;
  operationId: string;
  affectedCount: number;
  error?: string;
}

// --- 快照 ---

export type EntityType = "bookmark" | "folder" | "tag";

export interface SnapshotEntity {
  type: EntityType;
  id: string;
  data: unknown;
}

export interface RollbackResult {
  success: boolean;
  restoredCount: number;
  error?: string;
}

// --- 遥测 ---

export interface TelemetryEvent {
  id: string;
  userId: string;
  ruleId: string;
  selectionCount: number;
  matchedAt: Date;
  accepted: boolean | null;
  decidedAt: Date | null;
  sessionId: string;
}

export interface RuleStats {
  ruleId: string;
  matchCount: number;
  acceptCount: number;
  ignoreCount: number;
  acceptRate: number;
}

// --- 电池系统 ---

export type BatteryLevel = "full" | "medium" | "low" | "empty";

export interface BatteryState {
  level: BatteryLevel;
  remaining: number;
  total: number;
  resetAt: Date;
  isPro: boolean;
}

// --- 指令框 ---

export interface PresetCommand {
  id: string;
  keywords: string[];
  name: string;
  description: string;
  icon: string;
  action: string;
  tools: string[];
  requiresSelection: boolean;
}
```

### 4.2 规则注册表

**文件**: `src/lib/fluid-agent/prediction/rule-registry.ts`

```typescript
import type { PredictionRule } from "../types";

class RuleRegistry {
  private rules: Map<string, PredictionRule> = new Map();
  private sortedRules: PredictionRule[] = [];
  private isDirty = true;

  /**
   * 注册单条规则
   */
  register(rule: PredictionRule): void {
    this.rules.set(rule.id, rule);
    this.isDirty = true;
  }

  /**
   * 批量注册规则
   */
  registerMany(rules: PredictionRule[]): void {
    rules.forEach((rule) => this.rules.set(rule.id, rule));
    this.isDirty = true;
  }

  /**
   * 获取规则 by ID
   */
  getById(ruleId: string): PredictionRule | undefined {
    return this.rules.get(ruleId);
  }

  /**
   * 获取所有启用的规则（按优先级排序）
   */
  getEnabled(): PredictionRule[] {
    if (this.isDirty) {
      this.rebuildSortedList();
    }
    return this.sortedRules.filter((r) => r.enabled);
  }

  /**
   * 获取所有规则
   */
  getAll(): PredictionRule[] {
    if (this.isDirty) {
      this.rebuildSortedList();
    }
    return [...this.sortedRules];
  }

  /**
   * 启用/禁用规则
   */
  setEnabled(ruleId: string, enabled: boolean): void {
    const rule = this.rules.get(ruleId);
    if (rule) {
      rule.enabled = enabled;
    }
  }

  /**
   * 动态调整优先��
   */
  setPriority(ruleId: string, priority: number): void {
    const rule = this.rules.get(ruleId);
    if (rule) {
      rule.priority = Math.max(0, Math.min(100, priority));
      this.isDirty = true;
    }
  }

  /**
   * 按类别获取规则
   */
  getByCategory(category: PredictionRule["category"]): PredictionRule[] {
    return this.getEnabled().filter((r) => r.category === category);
  }

  /**
   * 清空所有规则（测试用）
   */
  clear(): void {
    this.rules.clear();
    this.sortedRules = [];
    this.isDirty = false;
  }

  private rebuildSortedList(): void {
    this.sortedRules = Array.from(this.rules.values()).sort(
      (a, b) => b.priority - a.priority,
    );
    this.isDirty = false;
  }
}

// 单例导出
export const ruleRegistry = new RuleRegistry();
```

### 4.3 语言检测器

**文件**: `src/lib/fluid-agent/prediction/language-detector.ts`

```typescript
import { franc } from "franc-min";

export type LanguageCode = "en" | "zh" | "ja" | "ko" | "unknown";

export interface LanguageDetectionResult {
  code: LanguageCode;
  confidence: number;
}

// franc 代码到简化代码的映射
const LANG_MAPPING: Record<string, LanguageCode> = {
  eng: "en",
  cmn: "zh",
  jpn: "ja",
  kor: "ko",
};

class LanguageDetector {
  private cache: Map<string, LanguageDetectionResult> = new Map();
  private readonly MIN_TEXT_LENGTH = 10;
  private readonly CACHE_SIZE = 1000;

  /**
   * 检测单个文本的语言
   */
  detect(text: string): LanguageDetectionResult {
    if (!text || text.length < this.MIN_TEXT_LENGTH) {
      return { code: "unknown", confidence: 0 };
    }

    // 检查缓存
    const cached = this.cache.get(text);
    if (cached) {
      return cached;
    }

    // 执行检测
    const langCode = franc(text);
    const result: LanguageDetectionResult = {
      code: LANG_MAPPING[langCode] || "unknown",
      confidence: langCode === "und" ? 0 : 0.8,
    };

    // 更新缓存
    this.updateCache(text, result);

    return result;
  }

  /**
   * 批量检测并判断是否全部为某语言
   */
  isAllLanguage(texts: string[], targetLang: LanguageCode): boolean {
    if (texts.length === 0) return false;
    return texts.every((text) => this.detect(text).code === targetLang);
  }

  /**
   * 检测是否为混合语言
   */
  isMixedLanguage(texts: string[]): boolean {
    if (texts.length < 2) return false;

    const langs = new Set(
      texts.map((t) => this.detect(t).code).filter((c) => c !== "unknown"),
    );

    return langs.size > 1;
  }

  /**
   * 获取文本数组中的主要语言
   */
  getDominantLanguage(texts: string[]): LanguageCode {
    const counts: Record<LanguageCode, number> = {
      en: 0,
      zh: 0,
      ja: 0,
      ko: 0,
      unknown: 0,
    };

    texts.forEach((text) => {
      const { code } = this.detect(text);
      counts[code]++;
    });

    let dominant: LanguageCode = "unknown";
    let maxCount = 0;

    for (const [lang, count] of Object.entries(counts)) {
      if (count > maxCount && lang !== "unknown") {
        maxCount = count;
        dominant = lang as LanguageCode;
      }
    }

    return dominant;
  }

  /**
   * 清理缓存
   */
  clearCache(): void {
    this.cache.clear();
  }

  private updateCache(text: string, result: LanguageDetectionResult): void {
    // LRU 简化实现：超出大小时清空一半
    if (this.cache.size >= this.CACHE_SIZE) {
      const keys = Array.from(this.cache.keys());
      keys.slice(0, this.CACHE_SIZE / 2).forEach((k) => this.cache.delete(k));
    }
    this.cache.set(text, result);
  }
}

export const languageDetector = new LanguageDetector();
```

### 4.4 预测引擎

**文件**: `src/lib/fluid-agent/prediction/prediction-engine.ts`

```typescript
import type { Bookmark } from "@/types/bookmark";
import type { PredictionResult } from "../types";
import { ruleRegistry } from "./rule-registry";
import { telemetryManager } from "../telemetry/telemetry-manager";

class PredictionEngine {
  /**
   * ��据选中内容预测推荐操作
   * @param selection 选中的书签
   * @param limit 返回数量限制
   */
  predict(selection: Bookmark[], limit: number = 3): PredictionResult[] {
    if (selection.length === 0) {
      return [];
    }

    const enabledRules = ruleRegistry.getEnabled();
    const matches: PredictionResult[] = [];

    for (const rule of enabledRules) {
      // 已达到限制，停止匹配
      if (matches.length >= limit) {
        break;
      }

      try {
        // 执行规则条件判断
        if (rule.condition(selection)) {
          const result: PredictionResult = {
            ruleId: rule.id,
            action: rule.action,
            icon: rule.icon,
            label: rule.name,
            confidence: rule.priority,
            affectedCount: selection.length,
            params: rule.params?.(selection),
          };

          matches.push(result);

          // 记录遥测（异步，不阻塞）
          telemetryManager.recordMatch(rule.id, selection.length).catch(() => {
            // 静默失败，不影响主流程
          });
        }
      } catch (error) {
        // 单条规则执行失败不影响其他规则
        console.error(`[PredictionEngine] Rule ${rule.id} failed:`, error);
      }
    }

    return matches;
  }

  /**
   * 记录用户对推荐的反馈
   */
  async recordFeedback(ruleId: string, accepted: boolean): Promise<void> {
    // 遥测记录
    await telemetryManager.recordDecision(ruleId, accepted);

    // 本地存储（用于未来权重学习）
    try {
      const key = `rule_feedback_${ruleId}`;
      const current = JSON.parse(
        localStorage.getItem(key) || '{"accept":0,"reject":0}',
      );

      if (accepted) {
        current.accept++;
      } else {
        current.reject++;
      }

      localStorage.setItem(key, JSON.stringify(current));
    } catch {
      // localStorage 不可用时静默失败
    }
  }

  /**
   * 获取规则的本地反馈统计
   */
  getLocalFeedback(ruleId: string): { accept: number; reject: number } {
    try {
      const key = `rule_feedback_${ruleId}`;
      return JSON.parse(localStorage.getItem(key) || '{"accept":0,"reject":0}');
    } catch {
      return { accept: 0, reject: 0 };
    }
  }
}

export const predictionEngine = new PredictionEngine();
```

### 4.5 初始规则集

**文件**: `src/lib/fluid-agent/prediction/rules/language-rules.ts`

```typescript
import type { PredictionRule } from "../../types";
import { languageDetector } from "../language-detector";

export const languageRules: PredictionRule[] = [
  {
    id: "lang_all_english",
    name: "翻译为中文",
    icon: "🌐",
    priority: 95,
    category: "language",
    enabled: true,
    condition: (selection) => {
      const titles = selection.map((b) => b.title);
      return languageDetector.isAllLanguage(titles, "en");
    },
    action: "translate_batch",
    params: (selection) => ({
      targetLang: "zh",
      bookmarkIds: selection.map((b) => b.id),
    }),
  },
  {
    id: "lang_all_chinese",
    name: "生成摘要",
    icon: "📝",
    priority: 80,
    category: "language",
    enabled: true,
    condition: (selection) => {
      const titles = selection.map((b) => b.title);
      return languageDetector.isAllLanguage(titles, "zh");
    },
    action: "generate_summary",
    params: (selection) => ({
      bookmarkIds: selection.map((b) => b.id),
    }),
  },
  {
    id: "lang_mixed",
    name: "统一翻译",
    icon: "🌐",
    priority: 85,
    category: "language",
    enabled: true,
    condition: (selection) => {
      const titles = selection.map((b) => b.title);
      return languageDetector.isMixedLanguage(titles);
    },
    action: "translate_batch",
    params: (selection) => ({
      targetLang: "zh",
      bookmarkIds: selection.map((b) => b.id),
    }),
  },
];
```

**文件**: `src/lib/fluid-agent/prediction/rules/content-rules.ts`

```typescript
import type { PredictionRule } from "../../types";

export const contentRules: PredictionRule[] = [
  {
    id: "content_duplicates",
    name: "去重清理",
    icon: "🧹",
    priority: 88,
    category: "content",
    enabled: true,
    condition: (selection) => {
      // 检查是否有重复 URL
      const urls = selection.map((b) => b.url);
      return urls.length !== new Set(urls).size;
    },
    action: "deduplicate",
    params: (selection) => ({
      bookmarkIds: selection.map((b) => b.id),
    }),
  },
  {
    id: "content_all_pdf",
    name: "提取文本",
    icon: "📄",
    priority: 90,
    category: "content",
    enabled: true,
    condition: (selection) => {
      return selection.every(
        (b) =>
          b.url?.toLowerCase().endsWith(".pdf") || b.content_type === "pdf",
      );
    },
    action: "extract_pdf_text",
  },
  {
    id: "content_all_video",
    name: "提取字幕",
    icon: "🎬",
    priority: 88,
    category: "content",
    enabled: true,
    condition: (selection) => {
      const videoHosts = ["youtube.com", "bilibili.com", "youtu.be"];
      return selection.every((b) =>
        videoHosts.some((host) => b.url?.includes(host)),
      );
    },
    action: "extract_subtitles",
  },
  {
    id: "content_all_article",
    name: "生成摘要",
    icon: "📝",
    priority: 85,
    category: "content",
    enabled: true,
    condition: (selection) => {
      return selection.every(
        (b) => b.content_type === "article" || b.ai_content_type === "article",
      );
    },
    action: "generate_summary",
  },
  {
    id: "content_tech",
    name: "技术摘要",
    icon: "💻",
    priority: 75,
    category: "content",
    enabled: true,
    condition: (selection) => {
      const techKeywords = ["github", "stackoverflow", "dev.to", "medium.com"];
      return selection.every((b) =>
        techKeywords.some((kw) => b.url?.includes(kw)),
      );
    },
    action: "generate_tech_summary",
  },
  {
    id: "content_news",
    name: "新闻简报",
    icon: "📰",
    priority: 72,
    category: "content",
    enabled: true,
    condition: (selection) => {
      const newsHosts = ["news.", "bbc.", "cnn.", "reuters."];
      return selection.every((b) =>
        newsHosts.some((host) => b.url?.includes(host)),
      );
    },
    action: "generate_news_brief",
  },
];
```

**文件**: `src/lib/fluid-agent/prediction/rules/quantity-rules.ts`

```typescript
import type { PredictionRule } from "../../types";

export const quantityRules: PredictionRule[] = [
  {
    id: "qty_gt_10",
    name: "批量整理",
    icon: "📦",
    priority: 70,
    category: "quantity",
    enabled: true,
    condition: (selection) => selection.length > 10,
    action: "batch_organize",
  },
  {
    id: "qty_gt_50",
    name: "智能分类",
    icon: "🏷️",
    priority: 72,
    category: "quantity",
    enabled: true,
    condition: (selection) => selection.length > 50,
    action: "smart_classify",
  },
];
```

**文件**: `src/lib/fluid-agent/prediction/rules/time-rules.ts`

```typescript
import type { PredictionRule } from "../../types";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export const timeRules: PredictionRule[] = [
  {
    id: "time_unread_7d",
    name: "生成摘要",
    icon: "📝",
    priority: 65,
    category: "time",
    enabled: true,
    condition: (selection) => {
      const now = Date.now();
      return selection.every((b) => {
        const created = new Date(b.created_at).getTime();
        return !b.is_read && now - created > SEVEN_DAYS_MS;
      });
    },
    action: "generate_summary",
  },
  {
    id: "time_this_week",
    name: "生成周报",
    icon: "📊",
    priority: 68,
    category: "time",
    enabled: true,
    condition: (selection) => {
      const weekStart = getWeekStart();
      return selection.every((b) => {
        const created = new Date(b.created_at);
        return created >= weekStart;
      });
    },
    action: "generate_weekly_report",
  },
  {
    id: "time_today",
    name: "今日回顾",
    icon: "📅",
    priority: 60,
    category: "time",
    enabled: true,
    condition: (selection) => {
      const todayStart = getTodayStart();
      return selection.every((b) => {
        const created = new Date(b.created_at);
        return created >= todayStart;
      });
    },
    action: "generate_daily_review",
  },
];

function getWeekStart(): Date {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const weekStart = new Date(now);
  weekStart.setDate(diff);
  weekStart.setHours(0, 0, 0, 0);
  return weekStart;
}

function getTodayStart(): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}
```

**文件**: `src/lib/fluid-agent/prediction/rules/source-rules.ts`

```typescript
import type { PredictionRule } from "../../types";

export const sourceRules: PredictionRule[] = [
  {
    id: "source_same_domain",
    name: "归档到来源文件夹",
    icon: "🗂️",
    priority: 82,
    category: "source",
    enabled: true,
    condition: (selection) => {
      if (selection.length < 2) return false;
      const domains = selection.map((b) => extractDomain(b.url));
      return new Set(domains).size === 1;
    },
    action: "archive_by_source",
    params: (selection) => ({
      domain: extractDomain(selection[0].url),
      bookmarkIds: selection.map((b) => b.id),
    }),
  },
  {
    id: "source_same_author",
    name: "创建作者合集",
    icon: "👤",
    priority: 78,
    category: "source",
    enabled: true,
    condition: (selection) => {
      if (selection.length < 2) return false;
      const authors = selection.map((b) => b.author).filter(Boolean);
      return authors.length > 0 && new Set(authors).size === 1;
    },
    action: "create_author_collection",
    params: (selection) => ({
      author: selection[0].author,
      bookmarkIds: selection.map((b) => b.id),
    }),
  },
  {
    id: "source_same_platform",
    name: "按平台整理",
    icon: "📱",
    priority: 75,
    category: "source",
    enabled: true,
    condition: (selection) => {
      if (selection.length < 2) return false;
      const platforms = selection.map((b) => b.platform).filter(Boolean);
      return platforms.length > 0 && new Set(platforms).size === 1;
    },
    action: "organize_by_platform",
  },
];

function extractDomain(url: string | null | undefined): string {
  if (!url) return "";
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}
```

**文件**: `src/lib/fluid-agent/prediction/rules/organization-rules.ts`

```typescript
import type { PredictionRule } from "../../types";

export const organizationRules: PredictionRule[] = [
  {
    id: "tag_none",
    name: "智能标签",
    icon: "🏷️",
    priority: 78,
    category: "tag",
    enabled: true,
    condition: (selection) => {
      return selection.every((b) => !b.tags || b.tags.length === 0);
    },
    action: "smart_tagging",
  },
  {
    id: "tag_same",
    name: "合并到文件夹",
    icon: "🗂️",
    priority: 70,
    category: "tag",
    enabled: true,
    condition: (selection) => {
      if (selection.length < 2) return false;
      const tagSets = selection.map((b) => new Set(b.tags || []));
      if (tagSets.some((s) => s.size === 0)) return false;

      // 检查是否有共同标签
      const commonTags = [...tagSets[0]].filter((tag) =>
        tagSets.every((s) => s.has(tag)),
      );
      return commonTags.length > 0;
    },
    action: "merge_to_folder",
  },
  {
    id: "folder_none",
    name: "智能归档",
    icon: "📁",
    priority: 80,
    category: "folder",
    enabled: true,
    condition: (selection) => {
      return selection.every((b) => !b.folder_id);
    },
    action: "smart_archive",
  },
];
```

**文件**: `src/lib/fluid-agent/prediction/rules/index.ts`

```typescript
import { ruleRegistry } from "../rule-registry";
import { languageRules } from "./language-rules";
import { contentRules } from "./content-rules";
import { quantityRules } from "./quantity-rules";
import { timeRules } from "./time-rules";
import { sourceRules } from "./source-rules";
import { organizationRules } from "./organization-rules";

// 聚合所有规则
export const allRules = [
  ...languageRules,
  ...contentRules,
  ...quantityRules,
  ...timeRules,
  ...sourceRules,
  ...organizationRules,
];

// 注册所有规则
export function registerAllRules(): void {
  ruleRegistry.registerMany(allRules);
}

// 模块加载时自动注册
registerAllRules();

// 导出各规则集
export {
  languageRules,
  contentRules,
  quantityRules,
  timeRules,
  sourceRules,
  organizationRules,
};
```

### 4.6 遥测管理器

**文件**: `src/lib/fluid-agent/telemetry/telemetry-manager.ts`

```typescript
import { createClient } from "@/lib/supabase/client";
import type { TelemetryEvent, RuleStats } from "../types";

class TelemetryManager {
  private sessionId: string;
  private pendingMatches: Map<string, Partial<TelemetryEvent>> = new Map();
  private batchQueue: Partial<TelemetryEvent>[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly FLUSH_INTERVAL = 5000; // 5秒批量刷新
  private readonly BATCH_SIZE = 50;

  constructor() {
    this.sessionId = this.generateSessionId();
  }

  /**
   * 记录规则匹配事件
   */
  async recordMatch(ruleId: string, selectionCount: number): Promise<void> {
    const event: Partial<TelemetryEvent> = {
      id: crypto.randomUUID(),
      ruleId,
      selectionCount,
      matchedAt: new Date(),
      accepted: null,
      decidedAt: null,
      sessionId: this.sessionId,
    };

    this.pendingMatches.set(ruleId, event);
    this.scheduleBatchFlush();
  }

  /**
   * 记录用户决策
   */
  async recordDecision(ruleId: string, accepted: boolean): Promise<void> {
    const pending = this.pendingMatches.get(ruleId);

    if (pending) {
      pending.accepted = accepted;
      pending.decidedAt = new Date();
      this.pendingMatches.delete(ruleId);
      this.batchQueue.push(pending);
    } else {
      // 如果没有匹配记录，创建新的决策记录
      this.batchQueue.push({
        id: crypto.randomUUID(),
        ruleId,
        selectionCount: 0,
        matchedAt: new Date(),
        accepted,
        decidedAt: new Date(),
        sessionId: this.sessionId,
      });
    }

    this.scheduleBatchFlush();
  }

  /**
   * 获取规则统计数据
   */
  async getRuleStats(ruleId?: string): Promise<RuleStats[]> {
    const supabase = createClient();

    // 使用视图查询
    let query = supabase.from("rule_telemetry_stats").select("*");

    if (ruleId) {
      query = query.eq("rule_id", ruleId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("[TelemetryManager] Failed to get stats:", error);
      return [];
    }

    return (data || []).map((row) => ({
      ruleId: row.rule_id,
      matchCount: row.match_count,
      acceptCount: row.accept_count,
      ignoreCount: row.ignore_count,
      acceptRate: row.accept_rate || 0,
    }));
  }

  /**
   * 强制刷新队列
   */
  async flush(): Promise<void> {
    if (this.batchQueue.length === 0) {
      return;
    }

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      console.warn("[TelemetryManager] No user, skipping flush");
      return;
    }

    const events = this.batchQueue.splice(0, this.BATCH_SIZE).map((e) => ({
      id: e.id,
      user_id: user.id,
      rule_id: e.ruleId,
      selection_count: e.selectionCount,
      matched_at: e.matchedAt?.toISOString(),
      accepted: e.accepted,
      decided_at: e.decidedAt?.toISOString(),
      session_id: e.sessionId,
    }));

    const { error } = await supabase.from("rule_telemetry").insert(events);

    if (error) {
      console.error("[TelemetryManager] Flush failed:", error);
      // 失败的事件重新入队（��多重试一次）
    }
  }

  /**
   * 重置会话
   */
  resetSession(): void {
    this.sessionId = this.generateSessionId();
    this.pendingMatches.clear();
  }

  private scheduleBatchFlush(): void {
    if (this.flushTimer) {
      return;
    }

    this.flushTimer = setTimeout(async () => {
      await this.flush();
      this.flushTimer = null;

      // 如果还有剩余，继续调度
      if (this.batchQueue.length > 0) {
        this.scheduleBatchFlush();
      }
    }, this.FLUSH_INTERVAL);
  }

  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }
}

export const telemetryManager = new TelemetryManager();
```

### 4.7 快照管理器

**文件**: `src/lib/fluid-agent/execution/snapshot-manager.ts`

```typescript
import { createClient } from "@/lib/supabase/client";
import type { SnapshotEntity, RollbackResult, EntityType } from "../types";

class SnapshotManager {
  private readonly EXPIRY_HOURS = 24;

  /**
   * 创建操作快照
   */
  async createSnapshot(
    operationId: string,
    entities: SnapshotEntity[],
  ): Promise<void> {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("User not authenticated");
    }

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + this.EXPIRY_HOURS);

    const snapshots = entities.map((entity) => ({
      operation_id: operationId,
      user_id: user.id,
      entity_type: entity.type,
      entity_id: entity.id,
      before_state: entity.data,
      expires_at: expiresAt.toISOString(),
    }));

    const { error } = await supabase
      .from("operation_snapshots")
      .insert(snapshots);

    if (error) {
      throw new Error(`Failed to create snapshot: ${error.message}`);
    }
  }

  /**
   * 执行回滚（覆盖式恢复）
   */
  async rollback(operationId: string): Promise<RollbackResult> {
    const supabase = createClient();

    try {
      // 1. 获取快照
      const { data: snapshots, error: fetchError } = await supabase
        .from("operation_snapshots")
        .select("*")
        .eq("operation_id", operationId);

      if (fetchError) {
        throw fetchError;
      }

      if (!snapshots || snapshots.length === 0) {
        return {
          success: false,
          restoredCount: 0,
          error: "No snapshots found",
        };
      }

      // 2. 按实体类型分组恢复
      let restoredCount = 0;

      for (const snapshot of snapshots) {
        const tableName = this.getTableName(snapshot.entity_type);

        if (tableName) {
          const { error: upsertError } = await supabase
            .from(tableName)
            .upsert(snapshot.before_state);

          if (!upsertError) {
            restoredCount++;
          }
        }
      }

      // 3. 恢复软删除的实体
      await supabase
        .from("bookmarks")
        .update({ deleted_at: null })
        .match({ operation_id: operationId })
        .not("deleted_at", "is", null);

      // 4. 标记快照为已使用（或删除）
      await supabase
        .from("operation_snapshots")
        .delete()
        .eq("operation_id", operationId);

      return { success: true, restoredCount };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      console.error("[SnapshotManager] Rollback failed:", error);
      return { success: false, restoredCount: 0, error: message };
    }
  }

  /**
   * 检查操作是否可回滚
   */
  async canRollback(operationId: string): Promise<boolean> {
    const supabase = createClient();

    const { count, error } = await supabase
      .from("operation_snapshots")
      .select("id", { count: "exact", head: true })
      .eq("operation_id", operationId)
      .gt("expires_at", new Date().toISOString());

    return !error && (count ?? 0) > 0;
  }

  /**
   * 手动清理过期快照
   */
  async cleanup(): Promise<number> {
    const supabase = createClient();

    const { data, error } = await supabase
      .from("operation_snapshots")
      .delete()
      .lt("expires_at", new Date().toISOString())
      .select("id");

    if (error) {
      console.error("[SnapshotManager] Cleanup failed:", error);
      return 0;
    }

    return data?.length || 0;
  }

  private getTableName(entityType: EntityType): string | null {
    const mapping: Record<EntityType, string> = {
      bookmark: "bookmarks",
      folder: "folders",
      tag: "tags",
    };
    return mapping[entityType] || null;
  }
}

export const snapshotManager = new SnapshotManager();
```

### 4.8 操作执行器

**文件**: `src/lib/fluid-agent/execution/operation-executor.ts`

```typescript
import type { Bookmark } from "@/types/bookmark";
import type {
  OperationContext,
  OperationResult,
  OperationStep,
} from "../types";
import { snapshotManager } from "./snapshot-manager";

type OperationCallback = (context: OperationContext) => void;

class OperationExecutor {
  private activeOperations: Map<string, OperationContext> = new Map();
  private subscribers: Map<string, Set<OperationCallback>> = new Map();

  /**
   * 执行操作
   */
  async execute(
    action: string,
    selection: Bookmark[],
    params?: Record<string, unknown>,
  ): Promise<OperationResult> {
    const operationId = crypto.randomUUID();

    const context: OperationContext = {
      operationId,
      userId: "", // 将在后续步骤中填充
      action,
      selection,
      steps: this.buildSteps(action),
      startedAt: new Date(),
      isCancelled: false,
    };

    this.activeOperations.set(operationId, context);
    this.notifySubscribers(operationId);

    try {
      // Step 1: 创建快照
      this.updateStepStatus(context, 0, "running");
      this.notifySubscribers(operationId);

      await snapshotManager.createSnapshot(
        operationId,
        selection.map((b) => ({ type: "bookmark", id: b.id, data: b })),
      );

      this.updateStepStatus(context, 0, "completed");
      this.notifySubscribers(operationId);

      // Step 2: 模拟 AI 思考延迟
      this.updateStepStatus(context, 1, "running");
      this.notifySubscribers(operationId);

      await this.simulateThinking();

      this.updateStepStatus(context, 1, "completed");
      this.notifySubscribers(operationId);

      // Step 3: 执行操作
      this.updateStepStatus(context, 2, "running");

      let affectedCount = 0;

      for (let i = 0; i < selection.length; i++) {
        // 检查取消
        if (context.isCancelled) {
          await snapshotManager.rollback(operationId);
          return {
            success: false,
            operationId,
            affectedCount: i,
            error: "Operation cancelled",
          };
        }

        const bookmark = selection[i];

        // TODO: 执行实际操作（调用对应的 Tool/Skill）
        await this.executeAction(action, bookmark, params);

        affectedCount++;

        // 更新进度
        context.steps[2].progress = Math.round(
          ((i + 1) / selection.length) * 100,
        );
        this.notifySubscribers(operationId);
      }

      this.updateStepStatus(context, 2, "completed");
      this.notifySubscribers(operationId);

      return { success: true, operationId, affectedCount };
    } catch (error) {
      // 操作失败，自动回滚
      await snapshotManager.rollback(operationId);

      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      return {
        success: false,
        operationId,
        affectedCount: 0,
        error: errorMessage,
      };
    } finally {
      // 清理
      setTimeout(() => {
        this.activeOperations.delete(operationId);
        this.subscribers.delete(operationId);
      }, 60000); // 1 分钟后清理
    }
  }

  /**
   * 取消操作
   */
  async cancel(operationId: string): Promise<void> {
    const context = this.activeOperations.get(operationId);
    if (context) {
      context.isCancelled = true;
      this.notifySubscribers(operationId);
    }
  }

  /**
   * 获取操作状态
   */
  getStatus(operationId: string): OperationContext | null {
    return this.activeOperations.get(operationId) || null;
  }

  /**
   * 订阅操作状态变化
   */
  subscribe(operationId: string, callback: OperationCallback): () => void {
    if (!this.subscribers.has(operationId)) {
      this.subscribers.set(operationId, new Set());
    }
    this.subscribers.get(operationId)!.add(callback);

    return () => {
      this.subscribers.get(operationId)?.delete(callback);
    };
  }

  /**
   * 检查是否有活跃操作
   */
  hasActiveOperation(): boolean {
    return this.activeOperations.size > 0;
  }

  private buildSteps(action: string): OperationStep[] {
    return [
      { id: "snapshot", name: "保存状态", status: "pending" },
      { id: "analyze", name: "分析内容", status: "pending" },
      {
        id: "execute",
        name: `执行${this.getActionLabel(action)}`,
        status: "pending",
      },
    ];
  }

  private getActionLabel(action: string): string {
    const labels: Record<string, string> = {
      translate_batch: "翻译",
      generate_summary: "摘要生成",
      deduplicate: "去重",
      smart_archive: "归档",
      smart_tagging: "标签",
    };
    return labels[action] || "操作";
  }

  private updateStepStatus(
    context: OperationContext,
    stepIndex: number,
    status: OperationStep["status"],
  ): void {
    if (context.steps[stepIndex]) {
      context.steps[stepIndex].status = status;
    }
  }

  private async simulateThinking(): Promise<void> {
    const delay = 300 + Math.random() * 200; // 300-500ms
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  private async executeAction(
    action: string,
    bookmark: Bookmark,
    params?: Record<string, unknown>,
  ): Promise<void> {
    // TODO: 根据 action 调用对应的 Tool/Skill
    // 这里先用模拟延迟代替
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  private notifySubscribers(operationId: string): void {
    const context = this.activeOperations.get(operationId);
    if (!context) return;

    this.subscribers.get(operationId)?.forEach((callback) => {
      try {
        callback({ ...context });
      } catch (error) {
        console.error("[OperationExecutor] Subscriber callback failed:", error);
      }
    });
  }
}

export const operationExecutor = new OperationExecutor();
```

---

## 5. UI 组件

### 5.1 usePrediction Hook

**文件**: `src/lib/fluid-agent/ui/hooks/use-prediction.ts`

```typescript
import { useMemo, useCallback } from "react";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import type { Bookmark } from "@/types/bookmark";
import type { PredictionResult } from "../../types";
import { predictionEngine } from "../../prediction/prediction-engine";

interface UsePredictionOptions {
  limit?: number;
  debounceMs?: number;
}

interface UsePredictionReturn {
  predictions: PredictionResult[];
  isLoading: boolean;
  recordFeedback: (ruleId: string, accepted: boolean) => Promise<void>;
}

export function usePrediction(
  selection: Bookmark[],
  options: UsePredictionOptions = {},
): UsePredictionReturn {
  const { limit = 3, debounceMs = 100 } = options;

  // 防抖处理选择变化
  const debouncedSelection = useDebouncedValue(selection, debounceMs);

  // 计算预测结果
  const predictions = useMemo(() => {
    if (debouncedSelection.length === 0) {
      return [];
    }
    return predictionEngine.predict(debouncedSelection, limit);
  }, [debouncedSelection, limit]);

  // 记录反馈
  const recordFeedback = useCallback(
    async (ruleId: string, accepted: boolean) => {
      await predictionEngine.recordFeedback(ruleId, accepted);
    },
    [],
  );

  return {
    predictions,
    isLoading: selection !== debouncedSelection,
    recordFeedback,
  };
}
```

### 5.2 useAgentHighlight Hook

**文件**: `src/lib/fluid-agent/ui/hooks/use-agent-highlight.ts`

```typescript
import { create } from "zustand";
import { useReduceMotion } from "./use-reduce-motion";

type HighlightType = "processing" | "completed";

interface HighlightEntry {
  type: HighlightType;
  expiresAt: number;
}

interface HighlightState {
  highlights: Map<string, HighlightEntry>;
  highlight: (entityId: string, type: HighlightType) => void;
  highlightMany: (entityIds: string[], type: HighlightType) => void;
  clear: (entityId: string) => void;
  clearAll: () => void;
}

const HIGHLIGHT_DURATION = 1500;

export const useHighlightStore = create<HighlightState>((set, get) => ({
  highlights: new Map(),

  highlight: (entityId, type) => {
    const expiresAt = Date.now() + HIGHLIGHT_DURATION;

    set((state) => {
      const newHighlights = new Map(state.highlights);
      newHighlights.set(entityId, { type, expiresAt });
      return { highlights: newHighlights };
    });

    // 自动清理
    setTimeout(() => {
      get().clear(entityId);
    }, HIGHLIGHT_DURATION);
  },

  highlightMany: (entityIds, type) => {
    const expiresAt = Date.now() + HIGHLIGHT_DURATION;

    set((state) => {
      const newHighlights = new Map(state.highlights);
      entityIds.forEach((id) => {
        newHighlights.set(id, { type, expiresAt });
      });
      return { highlights: newHighlights };
    });

    setTimeout(() => {
      entityIds.forEach((id) => get().clear(id));
    }, HIGHLIGHT_DURATION);
  },

  clear: (entityId) => {
    set((state) => {
      const newHighlights = new Map(state.highlights);
      newHighlights.delete(entityId);
      return { highlights: newHighlights };
    });
  },

  clearAll: () => {
    set({ highlights: new Map() });
  },
}));

// 便捷 Hook
export function useAgentHighlight(entityId: string) {
  const highlights = useHighlightStore((state) => state.highlights);
  const reduceMotion = useReduceMotion();

  const entry = highlights.get(entityId);
  const isHighlighted = entry ? Date.now() < entry.expiresAt : false;
  const highlightType = isHighlighted ? (entry?.type ?? null) : null;

  // 生成高亮样式类名
  const highlightClassName = getHighlightClassName(highlightType, reduceMotion);

  return {
    isHighlighted,
    highlightType,
    highlightClassName,
  };
}

function getHighlightClassName(
  type: HighlightType | null,
  reduceMotion: boolean,
): string {
  if (!type) return "";

  const baseStyles: Record<HighlightType, string> = {
    processing: "ring-2 ring-blue-400 ring-opacity-75",
    completed: "ring-2 ring-green-400 ring-opacity-75",
  };

  const animation =
    reduceMotion || type === "completed" ? "" : " animate-pulse";

  return baseStyles[type] + animation;
}
```

### 5.3 useReduceMotion Hook

**文件**: `src/lib/fluid-agent/ui/hooks/use-reduce-motion.ts`

```typescript
import { useState, useEffect } from "react";

const STORAGE_KEY = "fluid-agent-reduce-motion";

export function useReduceMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    // 1. 检查用户设置
    const userPref = localStorage.getItem(STORAGE_KEY);
    if (userPref !== null) {
      setReduceMotion(userPref === "true");
      return;
    }

    // 2. 检查系统偏好
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(mediaQuery.matches);

    // 3. 监听系统偏好变化
    const handler = (e: MediaQueryListEvent) => {
      const userPref = localStorage.getItem(STORAGE_KEY);
      if (userPref === null) {
        setReduceMotion(e.matches);
      }
    };

    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  return reduceMotion;
}

/**
 * 设置用户动效偏好
 */
export function setReduceMotionPreference(value: boolean): void {
  localStorage.setItem(STORAGE_KEY, String(value));
  window.dispatchEvent(new Event("reduce-motion-change"));
}

/**
 * 清除用户偏好，跟随系统
 */
export function clearReduceMotionPreference(): void {
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event("reduce-motion-change"));
}
```

### 5.4 useBattery Hook

**文件**: `src/lib/fluid-agent/ui/hooks/use-battery.ts`

```typescript
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { BatteryState, BatteryLevel } from "../../types";

const FREE_DAILY_LIMIT = 5;

export function useBattery() {
  const [state, setState] = useState<BatteryState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // 获取配额状态
  const fetchState = useCallback(async () => {
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setState(null);
        return;
      }

      // 检查是否为 Pro 用户
      const { data: entitlements } = await supabase
        .from("user_entitlements")
        .select("plan_tier, ai_quota_daily_limit")
        .eq("user_id", user.id)
        .single();

      const isPro = entitlements?.plan_tier !== "free";

      if (isPro) {
        setState({
          level: "full",
          remaining: -1,
          total: -1,
          resetAt: new Date(),
          isPro: true,
        });
        return;
      }

      // 获取今日使用量
      const { data: quota } = await supabase
        .from("user_quota_usage")
        .select("ai_calls_today, last_call_date")
        .eq("user_id", user.id)
        .single();

      const today = getLocalDateString();
      const lastCallDate = quota?.last_call_date;
      const dailyLimit = entitlements?.ai_quota_daily_limit || FREE_DAILY_LIMIT;

      // 如果日期变了，重置计数
      let todayUsed = quota?.ai_calls_today || 0;
      if (lastCallDate !== today) {
        todayUsed = 0;
      }

      const remaining = Math.max(0, dailyLimit - todayUsed);

      setState({
        level: calculateLevel(remaining, dailyLimit),
        remaining,
        total: dailyLimit,
        resetAt: getNextResetTime(),
        isPro: false,
      });
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error("Failed to fetch battery state"),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // 消耗一次配额
  const consume = useCallback(async (): Promise<boolean> => {
    if (!state) return false;
    if (state.isPro) return true;
    if (state.remaining <= 0) return false;

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return false;

      const today = getLocalDateString();

      await supabase.from("user_quota_usage").upsert(
        {
          user_id: user.id,
          ai_calls_today: state.total - state.remaining + 1,
          last_call_date: today,
        },
        { onConflict: "user_id" },
      );

      // 更新本地状态
      setState((prev) =>
        prev
          ? {
              ...prev,
              remaining: prev.remaining - 1,
              level: calculateLevel(prev.remaining - 1, prev.total),
            }
          : null,
      );

      return true;
    } catch {
      return false;
    }
  }, [state]);

  // 初始化
  useEffect(() => {
    fetchState();
  }, [fetchState]);

  return {
    level: state?.level || "full",
    remaining: state?.remaining || 0,
    total: state?.total || FREE_DAILY_LIMIT,
    resetAt: state?.resetAt || new Date(),
    isPro: state?.isPro || false,
    loading,
    error,
    canUse: state ? state.isPro || state.remaining > 0 : true,
    consume,
    refresh: fetchState,
  };
}

function calculateLevel(remaining: number, total: number): BatteryLevel {
  if (remaining <= 0) return "empty";
  const ratio = remaining / total;
  if (ratio > 0.5) return "full";
  if (ratio > 0.2) return "medium";
  return "low";
}

function getLocalDateString(): string {
  return new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD
}

function getNextResetTime(): Date {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return tomorrow;
}
```

### 5.5 PredictionButton 组件

**文件**: `src/lib/fluid-agent/ui/components/prediction-button.tsx`

```typescript
'use client';

import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import type { PredictionResult } from '../../types';

interface PredictionButtonProps {
  prediction: PredictionResult;
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
}

export function PredictionButton({
  prediction,
  onClick,
  loading = false,
  disabled = false,
}: PredictionButtonProps) {
  return (
    <Button
      variant="secondary"
      size="sm"
      className="gap-2 bg-gradient-to-r from-purple-500/10 to-blue-500/10 hover:from-purple-500/20 hover:to-blue-500/20 border border-purple-200/50"
      onClick={onClick}
      disabled={loading || disabled}
    >
      <span className="text-base">{prediction.icon}</span>
      <span className="flex items-center gap-1">
        <span className="text-purple-600">✨</span>
        {prediction.label}
      </span>
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
    </Button>
  );
}
```

### 5.6 ExecutionStatus 组件

**文件**: `src/lib/fluid-agent/ui/components/execution-status.tsx`

```typescript
'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import type { OperationContext } from '../../types';
import { operationExecutor } from '../../execution/operation-executor';

interface ExecutionStatusProps {
  operationId: string;
  onCancel?: () => void;
}

export function ExecutionStatus({ operationId, onCancel }: ExecutionStatusProps) {
  const [context, setContext] = useState<OperationContext | null>(null);

  useEffect(() => {
    // 获取初始状态
    setContext(operationExecutor.getStatus(operationId));

    // 订阅更新
    const unsubscribe = operationExecutor.subscribe(operationId, ctx => {
      setContext({ ...ctx });
    });

    return unsubscribe;
  }, [operationId]);

  if (!context) return null;

  const currentStep = context.steps.find(s => s.status === 'running');
  const completedCount = context.steps.filter(s => s.status === 'completed').length;
  const totalSteps = context.steps.length;
  const progress = currentStep?.progress;

  const handleCancel = () => {
    operationExecutor.cancel(operationId);
    onCancel?.();
  };

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4">
      <Card className="flex items-center gap-4 px-4 py-3 shadow-lg bg-background/95 backdrop-blur">
        <span className="text-lg">✨</span>
        <div className="flex flex-col">
          <span className="text-sm font-medium">
            {currentStep?.name || '处理中'}...
            {progress !== undefined && ` ${progress}%`}
          </span>
          <span className="text-xs text-muted-foreground">
            步骤 {completedCount + 1}/{totalSteps}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          onClick={handleCancel}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">取消</span>
        </Button>
      </Card>
    </div>
  );
}
```

### 5.7 UndoToast 组件

**文件**: `src/lib/fluid-agent/ui/components/undo-toast.tsx`

```typescript
"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { snapshotManager } from "../../execution/snapshot-manager";

interface UndoToastOptions {
  operationId: string;
  message: string;
  duration?: number;
  onUndo?: () => void;
}

/**
 * 显示带撤销功能的 Toast
 */
export function showUndoToast({
  operationId,
  message,
  duration = 10000,
  onUndo,
}: UndoToastOptions): void {
  let dismissed = false;

  const toastId = toast.success(message, {
    duration,
    action: {
      label: "撤销",
      onClick: async () => {
        if (dismissed) return;
        dismissed = true;

        // 显示撤销中状态
        toast.loading("正在撤销...", { id: toastId });

        try {
          const result = await snapshotManager.rollback(operationId);

          if (result.success) {
            toast.success("已撤销，恢复到操作前状态", { id: toastId });
            onUndo?.();
          } else {
            toast.error(`撤销失败: ${result.error}`, { id: toastId });
          }
        } catch (error) {
          toast.error("撤销失败，请刷新页面", { id: toastId });
        }
      },
    },
  });
}

/**
 * React 组件版本（可选）
 */
export function UndoToastProvider() {
  // 可用于管理多个撤销 Toast 的状态
  return null;
}
```

### 5.8 BatteryIndicator 组件

**文件**: `src/lib/fluid-agent/ui/components/battery-indicator.tsx`

```typescript
'use client';

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useBattery } from '../hooks/use-battery';

export function BatteryIndicator() {
  const { level, remaining, total, resetAt, isPro, loading } = useBattery();

  // 满电/中电时不显示
  if (loading || level === 'full' || level === 'medium' || isPro) {
    return null;
  }

  const icon = level === 'low' ? '🪫' : '⚡';
  const message = level === 'low'
    ? `今日智能推荐次数即将用完 (${remaining}/${total})`
    : `今日智能推荐次数已用完，${formatResetTime(resetAt)} 重置`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="text-lg cursor-help" role="status" aria-label={message}>
          {icon}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <p>{message}</p>
      </TooltipContent>
    </Tooltip>
  );
}

function formatResetTime(date: Date): string {
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `${hours}小时${minutes}分钟后`;
  }
  return `${minutes}分钟后`;
}
```

---

## 6. 集成指南

### 6.1 初始化模块

**文件**: `src/lib/fluid-agent/init.ts`

```typescript
// 确保规则被注册
import "./prediction/rules";

// 导出初始化状态
export const isInitialized = true;
```

在应用入口处引入：

```typescript
// src/app/layout.tsx 或 src/app/providers.tsx
import "@/lib/fluid-agent/init";
```

### 6.2 集成到书签列表

```typescript
// src/components/bookmark/bookmark-list.tsx

import { usePrediction, useAgentHighlight, PredictionButton } from '@/lib/fluid-agent';

function BookmarkList() {
  const [selectedBookmarks, setSelectedBookmarks] = useState<Bookmark[]>([]);
  const { predictions, recordFeedback } = usePrediction(selectedBookmarks);

  const handlePredictionClick = async (prediction: PredictionResult) => {
    // 记录接受反馈
    await recordFeedback(prediction.ruleId, true);

    // 执行操作
    // ...
  };

  return (
    <div>
      {/* Action Bar with Predictions */}
      {selectedBookmarks.length > 0 && predictions.length > 0 && (
        <div className="action-bar">
          {predictions.map(p => (
            <PredictionButton
              key={p.ruleId}
              prediction={p}
              onClick={() => handlePredictionClick(p)}
            />
          ))}
        </div>
      )}

      {/* Bookmark Items */}
      {bookmarks.map(bookmark => (
        <BookmarkItem
          key={bookmark.id}
          bookmark={bookmark}
          selected={selectedBookmarks.some(b => b.id === bookmark.id)}
        />
      ))}
    </div>
  );
}

// 单个书签项（带高亮）
function BookmarkItem({ bookmark, selected }: { bookmark: Bookmark; selected: boolean }) {
  const { highlightClassName } = useAgentHighlight(bookmark.id);

  return (
    <div className={cn('bookmark-item', highlightClassName, selected && 'selected')}>
      {/* ... */}
    </div>
  );
}
```

### 6.3 集成操作执行

```typescript
// 执行推荐操作的完整流程
import {
  operationExecutor,
  useBattery,
  showUndoToast,
  ExecutionStatus,
} from "@/lib/fluid-agent";

function useExecutePrediction() {
  const { canUse, consume } = useBattery();
  const [activeOperationId, setActiveOperationId] = useState<string | null>(
    null,
  );

  const execute = async (
    prediction: PredictionResult,
    selection: Bookmark[],
  ) => {
    // 1. 检查配额
    if (!canUse) {
      // 显示配额耗尽弹窗
      return;
    }

    // 2. 消耗配额
    const consumed = await consume();
    if (!consumed) {
      toast.error("配额不足");
      return;
    }

    // 3. 执行操作
    const result = await operationExecutor.execute(
      prediction.action,
      selection,
      prediction.params,
    );

    setActiveOperationId(result.operationId);

    // 4. 显示结果
    if (result.success) {
      showUndoToast({
        operationId: result.operationId,
        message: `已${prediction.label} ${result.affectedCount} 项`,
        onUndo: () => {
          // 刷新列表
          queryClient.invalidateQueries(["bookmarks"]);
        },
      });
    } else {
      toast.error(`操作失败: ${result.error}`);
    }

    setActiveOperationId(null);
  };

  return { execute, activeOperationId };
}
```

---

## 7. 测试方案

### 7.1 单元测试示例

**文件**: `src/lib/fluid-agent/__tests__/prediction-engine.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { ruleRegistry } from "../prediction/rule-registry";
import { predictionEngine } from "../prediction/prediction-engine";
import { telemetryManager } from "../telemetry/telemetry-manager";
import type { Bookmark } from "@/types/bookmark";

// Mock telemetry
vi.mock("../telemetry/telemetry-manager", () => ({
  telemetryManager: {
    recordMatch: vi.fn().mockResolvedValue(undefined),
    recordDecision: vi.fn().mockResolvedValue(undefined),
  },
}));

describe("PredictionEngine", () => {
  beforeEach(() => {
    ruleRegistry.clear();
    vi.clearAllMocks();
  });

  it("should return empty array for empty selection", () => {
    const results = predictionEngine.predict([]);
    expect(results).toHaveLength(0);
  });

  it("should match rules and return sorted by priority", () => {
    // 注册测试规则
    ruleRegistry.registerMany([
      {
        id: "low_priority",
        name: "Low",
        icon: "📝",
        priority: 10,
        category: "content",
        enabled: true,
        condition: () => true,
        action: "low_action",
      },
      {
        id: "high_priority",
        name: "High",
        icon: "🔥",
        priority: 90,
        category: "content",
        enabled: true,
        condition: () => true,
        action: "high_action",
      },
    ]);

    const selection: Bookmark[] = [
      { id: "1", title: "Test", url: "https://example.com" } as Bookmark,
    ];

    const results = predictionEngine.predict(selection, 2);

    expect(results).toHaveLength(2);
    expect(results[0].ruleId).toBe("high_priority");
    expect(results[1].ruleId).toBe("low_priority");
  });

  it("should respect limit parameter", () => {
    ruleRegistry.registerMany([
      {
        id: "r1",
        name: "R1",
        icon: "1",
        priority: 90,
        category: "content",
        enabled: true,
        condition: () => true,
        action: "a1",
      },
      {
        id: "r2",
        name: "R2",
        icon: "2",
        priority: 80,
        category: "content",
        enabled: true,
        condition: () => true,
        action: "a2",
      },
      {
        id: "r3",
        name: "R3",
        icon: "3",
        priority: 70,
        category: "content",
        enabled: true,
        condition: () => true,
        action: "a3",
      },
    ]);

    const selection: Bookmark[] = [{ id: "1", title: "Test" } as Bookmark];
    const results = predictionEngine.predict(selection, 2);

    expect(results).toHaveLength(2);
  });

  it("should record telemetry for matched rules", async () => {
    ruleRegistry.register({
      id: "test_rule",
      name: "Test",
      icon: "📝",
      priority: 50,
      category: "content",
      enabled: true,
      condition: () => true,
      action: "test_action",
    });

    const selection: Bookmark[] = [{ id: "1", title: "Test" } as Bookmark];
    predictionEngine.predict(selection);

    // 等待异步操作
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(telemetryManager.recordMatch).toHaveBeenCalledWith("test_rule", 1);
  });

  it("should skip disabled rules", () => {
    ruleRegistry.register({
      id: "disabled_rule",
      name: "Disabled",
      icon: "❌",
      priority: 100,
      category: "content",
      enabled: false,
      condition: () => true,
      action: "disabled_action",
    });

    const selection: Bookmark[] = [{ id: "1", title: "Test" } as Bookmark];
    const results = predictionEngine.predict(selection);

    expect(results).toHaveLength(0);
  });

  it("should handle rule condition errors gracefully", () => {
    ruleRegistry.registerMany([
      {
        id: "error_rule",
        name: "Error",
        icon: "❌",
        priority: 100,
        category: "content",
        enabled: true,
        condition: () => {
          throw new Error("Test error");
        },
        action: "error_action",
      },
      {
        id: "normal_rule",
        name: "Normal",
        icon: "✅",
        priority: 50,
        category: "content",
        enabled: true,
        condition: () => true,
        action: "normal_action",
      },
    ]);

    const selection: Bookmark[] = [{ id: "1", title: "Test" } as Bookmark];
    const results = predictionEngine.predict(selection);

    // 应该跳过错误规则，返回正常规则
    expect(results).toHaveLength(1);
    expect(results[0].ruleId).toBe("normal_rule");
  });
});
```

### 7.2 性能测试

**文件**: `src/lib/fluid-agent/__tests__/performance.test.ts`

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { ruleRegistry } from "../prediction/rule-registry";
import { predictionEngine } from "../prediction/prediction-engine";
import type { Bookmark } from "@/types/bookmark";

describe("Performance", () => {
  beforeEach(() => {
    ruleRegistry.clear();
  });

  it("should match 100 rules within 10ms", () => {
    // 注册 100 条规则
    const rules = Array.from({ length: 100 }, (_, i) => ({
      id: `rule_${i}`,
      name: `Rule ${i}`,
      icon: "📝",
      priority: i,
      category: "content" as const,
      enabled: true,
      condition: () => Math.random() > 0.5,
      action: `action_${i}`,
    }));

    ruleRegistry.registerMany(rules);

    // 创建测试选择
    const selection: Bookmark[] = Array.from(
      { length: 10 },
      (_, i) =>
        ({
          id: `${i}`,
          title: `Bookmark ${i}`,
          url: `https://example.com/${i}`,
        }) as Bookmark,
    );

    // 计时
    const start = performance.now();
    predictionEngine.predict(selection, 3);
    const duration = performance.now() - start;

    console.log(`100 rules matching took ${duration.toFixed(2)}ms`);
    expect(duration).toBeLessThan(10);
  });

  it("should handle large selection (100 items) efficiently", () => {
    ruleRegistry.register({
      id: "test_rule",
      name: "Test",
      icon: "📝",
      priority: 50,
      category: "content",
      enabled: true,
      condition: (selection) => selection.length > 50,
      action: "test_action",
    });

    const selection: Bookmark[] = Array.from(
      { length: 100 },
      (_, i) =>
        ({
          id: `${i}`,
          title: `Bookmark ${i}`,
        }) as Bookmark,
    );

    const start = performance.now();
    predictionEngine.predict(selection);
    const duration = performance.now() - start;

    console.log(`Large selection (100 items) took ${duration.toFixed(2)}ms`);
    expect(duration).toBeLessThan(10);
  });
});
```

---

## 8. 开发检查点

### 8.1 Sprint 1 检查点 (Day 3)

- [ ] 数据库迁移完成并测试
- [ ] RuleRegistry 单元测试通过
- [ ] LanguageDetector 单元测试通过
- [ ] PredictionEngine 单元测试通过
- [ ] 20 条规则全部实现并测试
- [ ] TelemetryManager 单元测试通过
- [ ] 性能测试通过 (<10ms)

**验收标准**:

```bash
# 运行测试
npm test -- --filter="fluid-agent"

# 检查类型
npm run type-check

# 运行迁移
npm run supabase:db:push
```

### 8.2 Sprint 2 检查点 (Day 6)

- [ ] usePrediction Hook 工作正常
- [ ] useAgentHighlight Hook 工作正常
- [ ] PredictionButton 组件渲染正确
- [ ] ActionBar 集成完成
- [ ] FAB 组件实现完成
- [ ] SnapshotManager 单元测试通过
- [ ] OperationExecutor 单元测试通过

**验收标准**:

```bash
# 启动开发服务器
npm run dev

# 手动测试流程
1. 选中多个书签
2. 查看推荐按钮出现
3. 点击推荐按钮
4. 查看执行进度
```

### 8.3 Sprint 3 检查点 (Day 9)

- [ ] ExecutionStatus 组件工作正常
- [ ] UndoToast 撤销功能正常
- [ ] BatteryIndicator 显示正确
- [ ] 配额耗尽弹窗显示正确
- [ ] Command Dialog 工作正常
- [ ] 集成测试通过
- [ ] 端到端流程测试通过

**最终验收**:

```bash
# 完整测试套件
npm test

# 构建检查
npm run build

# Lighthouse 性��检查
npm run lighthouse
```

---

## 附录

### A. 文件清单

| 文件                                                           | 类型 | 优先级 |
| -------------------------------------------------------------- | ---- | ------ |
| `supabase/migrations/20260202000001_create_rule_telemetry.sql` | 迁移 | P0     |
| `src/lib/fluid-agent/types.ts`                                 | 类型 | P0     |
| `src/lib/fluid-agent/prediction/rule-registry.ts`              | 核心 | P0     |
| `src/lib/fluid-agent/prediction/language-detector.ts`          | 核心 | P0     |
| `src/lib/fluid-agent/prediction/prediction-engine.ts`          | 核心 | P0     |
| `src/lib/fluid-agent/prediction/rules/*.ts`                    | 规则 | P0     |
| `src/lib/fluid-agent/telemetry/telemetry-manager.ts`           | 核心 | P0     |
| `src/lib/fluid-agent/execution/snapshot-manager.ts`            | 核心 | P0     |
| `src/lib/fluid-agent/execution/operation-executor.ts`          | 核心 | P0     |
| `src/lib/fluid-agent/ui/hooks/*.ts`                            | Hook | P0     |
| `src/lib/fluid-agent/ui/components/*.tsx`                      | UI   | P1     |
| `src/lib/fluid-agent/__tests__/*.ts`                           | 测试 | P0     |

### B. 命令速查

```bash
# 安装依赖
npm install franc-min

# 创建目录
mkdir -p src/lib/fluid-agent/{prediction/rules,execution,commands,telemetry,ui/{hooks,components},__tests__}

# 运行迁移
npm run supabase:db:push

# 生成类型
npm run supabase:gen:types

# 运行测试
npm test -- --filter="fluid-agent"

# 类型检查
npm run type-check

# 开发服务器
npm run dev
```

### C. 相关文档

- [requirements-V4.0.md](.spec-workflow/specs/dual-mode-agent/requirements-V4.0.md)
- [design-V4.0.md](.spec-workflow/specs/dual-mode-agent/design-V4.0.md)
- [epics-and-stories-V4.0.md](.spec-workflow/specs/dual-mode-agent/epics-and-stories-V4.0.md)
- [架构图](../_bmad-output/excalidraw-diagrams/dual-mode-agent-architecture-v4.excalidraw)
