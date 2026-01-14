# AnyKeep AI 架构优化执行计划

> **创建日期**: 2026-01-11
> **状态**: 执行中 ✅ Phase 1 & 2 已完成
> **预计总工期**: 3-4 周
> **最后更新**: 2026-01-11

---

## 执行摘要

本计划旨在解决 AI 助手代码审计中发现的核心问题：
- 8 个 Feature Flags 未真正生效
- 16+ 个重复类型定义
- 3 套分类器并存导致决策不一致
- API 参数透传和响应格式不统一

**核心策略**: 先激活已有能力，再收敛架构，最后建立长效机制。

---

## 阶段一：核心链路修复（第 1-2 周） ✅ 已完成

### 目标
激活已开发但未连接的核心功能，实现"零接管"用户体验的基础能力。

**完成日期**: 2026-01-11
**提交引用**: `2ef14281` feat(ai): Phase 1 & 2 架构优化

---

### 1.1 隐含意图推理集成 [P0] ✅

**问题**: `implicit-intent-rules.ts` 定义了 8 条规则但从未被调用

**修改文件**:
| 文件 | 修改内容 |
|------|---------|
| `src/lib/ai-skills/router/intent-analyzer.ts` | 导入并调用 `matchImplicitIntent()` |
| `src/lib/ai-agent/context/prompt-injector.ts` | 注入 `IMPLICIT_INTENT_RULES_PROMPT` 到 System Prompt |

**具体任务**:
- [x] 1.1.1 在 `IntentAnalyzer.analyze()` 中，规则匹配后调用 `matchImplicitIntent()`
- [x] 1.1.2 将匹配到的隐含意图规则追加到分析结果的 `metadata` 中
- [x] 1.1.3 在 `PromptInjector.mergeSystemPromptAsync()` 中检查 `ENABLE_IMPLICIT_INTENT` 并注入规则提示
- [x] 1.1.4 添加集成测试：输入"太多了帮我整理" → 验证不建议删除

**验收标准**:
```bash
# 用户输入测试
输入: "收藏太多了，帮我整理一下"
预期: AI 建议分类/归档，而非删除
预期: 响应中包含 implicitIntent: "too-many-not-delete"
```

**预计工时**: 4 小时

---

### 1.2 增强置信度计算激活 [P0] ✅

**问题**: `enhanced-confidence.ts` 已实现但 `UnifiedEngine` 从未调用

**修改文件**:
| 文件 | 修改内容 |
|------|---------|
| `src/lib/ai-skills/engine/unified-engine.ts` | 调用 `calculateEnhancedConfidence()` |
| `src/lib/ai-skills/router/intent-router.ts` | 传递增强置信度到路由决策 |

**具体任务**:
- [x] 1.2.1 在 `UnifiedEngine.executeRouted()` 中，检查 `ENABLE_ENHANCED_CONFIDENCE`
- [x] 1.2.2 调用 `calculateEnhancedConfidence()` 并传入必要上下文
- [x] 1.2.3 使用增强置信度替代原始规则置信度进行后续决策
- [x] 1.2.4 添加日志记录置信度计算过程（debug 级别）

**验收标准**:
```typescript
// 日志输出验证
{
  originalConfidence: 0.75,
  enhancedConfidence: 0.82,
  factors: {
    ruleMatch: 0.75,      // 40%
    contextRelevance: 0.9, // 20%
    entityCompleteness: 0.8, // 15%
    messageClarity: 0.85,  // 15%
    historyMatch: 0.7      // 10%
  }
}
```

**预计工时**: 3 小时

---

### 1.3 置信度分层执行策略连接 [P0] ✅

**问题**: `response-templates.ts` 定义了执行策略但未在流程中应用

**修改文件**:
| 文件 | 修改内容 |
|------|---------|
| `src/lib/ai-skills/engine/unified-engine.ts` | 根据置信度选择执行策略 |
| `src/lib/ai-skills/output/adapter.ts` | 应用不同策略的响应模板 |

**具体任务**:
- [x] 1.3.1 检查 `ENABLE_CONFIDENCE_TIERING` Feature Flag
- [x] 1.3.2 根据增强置信度获取 `suggestedStrategy`
- [x] 1.3.3 高置信度 (≥80%): 静默执行，返回简短结果
- [x] 1.3.4 中置信度 (60-79%): 执行 + 解释为什么这样做
- [x] 1.3.5 低置信度 (<60%): 生成澄清选项而非直接执行
- [x] 1.3.6 添加端到端测试验证三种策略

**验收标准**:
```bash
# 高置信度
输入: "有多少收藏"
预期: "您共有 156 条收藏。" (无额外解释)

# 中置信度
输入: "整理一下"
预期: "已按日期对收藏进行分组。我选择日期分组是因为..." (带解释)

# 低置信度
输入: "那个"
预期: "您指的是哪一个？\n1. 上次搜索的结果\n2. 最近添加的收藏\n3. 其他..." (请求澄清)
```

**预计工时**: 5 小时

---

### 1.4 SKILL_MAPPINGS 统一 [P0] ✅

**问题**: `intent-analyzer.ts` 和 `skill-mappings.ts` 双重定义，且前者缺少 6 个新 Skills

**修改文件**:
| 文件 | 修改内容 |
|------|---------|
| `src/lib/ai-skills/router/intent-analyzer.ts` | 删除本地 SKILL_MAPPINGS，改为导入 |
| `src/lib/ai-skills/config/skill-mappings.ts` | 添加工具函数支持按 key 查找 |

**具体任务**:
- [x] 1.4.1 在 `skill-mappings.ts` 添加 `getSkillMappingByKey(key: string)` 函数
- [x] 1.4.2 在 `skill-mappings.ts` 添加 `SKILL_MAPPINGS_BY_KEY` 索引对象
- [x] 1.4.3 删除 `intent-analyzer.ts` 中的本地 `SKILL_MAPPINGS` 定义（约 130 行）
- [x] 1.4.4 修改 `IntentAnalyzer` 使用导入的映射
- [x] 1.4.5 验证 6 个新 Skills 可被正确路由

**验收标准**:
```bash
# 新 Skills 路由测试
输入: "帮我分拣收件箱"
预期: 路由到 inbox_triage Skill

输入: "哪个文件夹适合这个"
预期: 路由到 folder_recommend Skill
```

**预计工时**: 3 小时

---

### 1.5 偏好学习 V1 调用链修复 [P1] ✅

**问题**: `learning-service.ts` 的 `recordToolUsage()` 从未被调用

**修改文件**:
| 文件 | 修改内容 |
|------|---------|
| `src/lib/ai-agent/core/knowledge-agent.ts` | 工具执行后调用 recordToolUsage |
| `src/lib/ai-skills/engine/execution-coordinator.ts` | Skill 执行后调用 recordToolUsage |

**具体任务**:
- [x] 1.5.1 在 `KnowledgeAgent` 工具执行成功后调用 `recordToolUsage()`
- [x] 1.5.2 在 `ExecutionCoordinator` Skill 执行成功后调用 `recordToolUsage()`
- [x] 1.5.3 检查 `ENABLE_PREFERENCE_LEARNING` Flag
- [x] 1.5.4 添加测试验证偏好记录被正确写入

**验收标准**:
```typescript
// 数据库验证
// 用户多次使用 search 工具后
await supabase.from('profiles').select('ai_preferences');
// 预期: ai_preferences.learned.frequentTools 包含 "search"
```

**预计工时**: 3 小时

---

### 1.6 SSE 响应格式统一 [P1] ✅

**问题**: UnifiedEngine 和 KnowledgeAgent 的 error chunk 格式不一致

**修改文件**:
| 文件 | 修改内容 |
|------|---------|
| `src/app/api/agent/unified/route.ts` | 统一 error chunk 格式 |
| `src/lib/ai-agent/core/knowledge-agent.ts` | 适配统一格式 |

**具体任务**:
- [x] 1.6.1 定义统一的 `ErrorChunk` 接口
- [x] 1.6.2 修改 KnowledgeAgent 回退模式的 error chunk: `{ type: "error", error: string }` → `{ type: "error", data: { message, retryable } }`
- [x] 1.6.3 更新前端错误处理代码适配新格式
- [x] 1.6.4 添加 SSE 响应格式测试

**验收标准**:
```typescript
// 所有 error chunks 统一为
{ type: "error", data: { message: string, retryable?: boolean } }
```

**预计工时**: 2 小时

---

### 1.7 API 参数透传修复 [P1] ✅

**问题**: `maxToolRounds` 和 `temperature` 未传递到 UnifiedEngine

**修改文件**:
| 文件 | 修改内容 |
|------|---------|
| `src/lib/ai-skills/engine/types.ts` | EngineExecuteOptions 添加字段 |
| `src/app/api/agent/unified/route.ts` | handleUnifiedEngine 传递参数 |

**具体任务**:
- [x] 1.7.1 在 `EngineExecuteOptions` 接口添加 `maxToolRounds?: number` 和 `temperature?: number`
- [x] 1.7.2 在 `handleUnifiedEngine` 中从请求体提取并传递这些参数
- [x] 1.7.3 在 `UnifiedEngine.execute()` 中应用这些参数
- [x] 1.7.4 添加 API 参数传递测试

**验收标准**:
```bash
# API 调用验证
curl -X POST /api/agent/unified \
  -d '{"message": "搜索AI", "options": {"temperature": 0.3, "maxToolRounds": 5}}'
# 验证内部 LLM 调用使用了 temperature=0.3
```

**预计工时**: 2 小时

---

### 阶段一总结

| 任务 | 优先级 | 工时 | 依赖 | 状态 |
|------|--------|------|------|------|
| 1.1 隐含意图集成 | P0 | 4h | - | ✅ |
| 1.2 增强置信度激活 | P0 | 3h | - | ✅ |
| 1.3 置信度分层连接 | P0 | 5h | 1.2 | ✅ |
| 1.4 SKILL_MAPPINGS 统一 | P0 | 3h | - | ✅ |
| 1.5 偏好学习调用链 | P1 | 3h | - | ✅ |
| 1.6 SSE 格式统一 | P1 | 2h | - | ✅ |
| 1.7 API 参数透传 | P1 | 2h | - | ✅ |

**阶段一总工时**: 22 小时（约 3-4 个工作日）

---

## 阶段二：架构收敛（第 2-3 周） ✅ 已完成

### 目标
消除重复定义，统一数据源，废弃旧组件。

**完成日期**: 2026-01-11
**提交引用**: `2ef14281` feat(ai): Phase 1 & 2 架构优化

---

### 2.1 类型定义统一 [P1] ✅

**问题**: 16+ 个类型在多个文件中重复定义

**新建文件**:
```
src/lib/shared/types/
├── core.ts          # AgentType, MessageRole
├── intent.ts        # IntentType, ComplexityLevel, ExecutionMode
├── confidence.ts    # 所有置信度阈值常量
├── stream.ts        # UnifiedStreamChunk, ErrorChunk
└── index.ts         # 统一导出
```

**具体任务**:
- [x] 2.1.1 创建 `src/lib/shared/types/` 目录结构
- [x] 2.1.2 将 `IntentType` 统一定义移至 `intent.ts`
- [x] 2.1.3 将 `MessageRole` 统一定义移至 `core.ts`
- [x] 2.1.4 将 `ComplexityLevel`, `ExecutionMode` 移至 `intent.ts`
- [x] 2.1.5 将所有置信度阈值常量移至 `confidence.ts`
- [x] 2.1.6 更新所有引用这些类型的文件，改为从 shared 导入
- [x] 2.1.7 删除各模块中的重复定义
- [x] 2.1.8 运行全量类型检查确保无破坏

**影响范围评估**:
```
需修改的文件（估计）:
- src/lib/ai-skills/router/*.ts (5 文件)
- src/lib/ai-skills/config/*.ts (2 文件)
- src/lib/ai-agent/core/*.ts (3 文件)
- src/lib/ai-agent/context/*.ts (2 文件)
- src/lib/ai-memory/*.ts (1 文件)
```

**预计工时**: 6 小时

---

### 2.2 置信度阈值常量统一 [P1] ✅

**问题**: `CONFIDENCE_THRESHOLDS` 在多处定义且值不一致

**修改策略**:
```typescript
// src/lib/shared/types/confidence.ts

export const CONFIDENCE_THRESHOLDS = {
  // 执行策略阈值（已统一为 0.80）
  HIGH: 0.80,           // 静默执行
  MEDIUM: 0.60,         // 执行+解释
  LOW: 0.60,            // 以下请求澄清

  // 规则匹配阈值
  RULE_HIGH: 0.80,      // 规则高置信度

  // 边界值
  MIN: 0.50,
  MAX: 1.00,

  // LLM 回退
  LLM_FALLBACK: 0.60,
} as const;

export type ConfidenceLevel = 'high' | 'medium' | 'low';
```

**具体任务**:
- [x] 2.2.1 创建统一的 `CONFIDENCE_THRESHOLDS` 常量
- [x] 2.2.2 更新 `intent-analyzer.ts` 导入统一常量
- [x] 2.2.3 更新 `response-templates.ts` 导入统一常量
- [x] 2.2.4 更新 `confidence-calibrator.ts` 导入统一常量
- [x] 2.2.5 删除各处重复定义

**预计工时**: 2 小时

---

### 2.3 分类器收敛 [P2] ✅

**问题**: 三套分类器并存（IntentClassifier, HybridIntentClassifier, IntentAnalyzer）

**收敛策略**:
```
保留: IntentAnalyzer (统一分析器)
废弃: IntentClassifier, HybridIntentClassifier
```

**具体任务**:
- [x] 2.3.1 为 `IntentClassifier` 添加 `@deprecated` 注释
- [x] 2.3.2 为 `HybridIntentClassifier` 添加 `@deprecated` 注释
- [x] 2.3.3 将 `IntentClassifier` 的独有规则迁移到 `IntentAnalyzer.UNIFIED_RULES`
- [x] 2.3.4 将 `HybridIntentClassifier` 的语义匹配逻辑迁移到 `IntentAnalyzer`
- [x] 2.3.5 修改 `IntentRouter` 默认使用 `IntentAnalyzer`
- [x] 2.3.6 更新 `ENABLE_HYBRID_INTENT_CLASSIFIER` Flag 说明（已废弃）
- [x] 2.3.7 添加迁移测试确保分类结果一致

**预计工时**: 8 小时

---

### 2.4 UserPreferences 类型分化 [P2] ✅

**问题**: 三个不同语义的 `UserPreferences` 类型

**修改策略**:
```typescript
// 重命名为更具体的名称
SkillExecutionPreferences    // ai-skills/core - Skill 执行偏好
TaskUserContext              // task-understanding - 任务上下文
ClassificationPreferences    // classification - 分类学习偏好
```

**具体任务**:
- [x] 2.4.1 重命名 `ai-skills/core/types.ts` 中的 `UserPreferences` → `SkillExecutionPreferences`
- [x] 2.4.2 重命名 `task-understanding/types.ts` 中的 `UserPreferences` → `TaskUserContext`
- [x] 2.4.3 重命名 `classification/learning` 中的类型 → `ClassificationPreferences`
- [x] 2.4.4 更新所有引用

**预计工时**: 3 小时

---

### 2.5 API 常量补全 [P2] ✅

**问题**: `API_AGENT` 常量仅定义 4 个端点，实际存在 14+ 个

**修改文件**: `src/lib/constants/api-paths.ts`

**具体任务**:
- [x] 2.5.1 补全所有 Agent API 端点定义
- [x] 2.5.2 更新所有硬编码 API 路径为常量引用
- [x] 2.5.3 添加 API 路径一致性检查脚本

**预计工时**: 2 小时

---

### 阶段二总结

| 任务 | 优先级 | 工时 | 依赖 | 状态 |
|------|--------|------|------|------|
| 2.1 类型定义统一 | P1 | 6h | 阶段一完成 | ✅ |
| 2.2 置信度阈值统一 | P1 | 2h | 2.1 | ✅ |
| 2.3 分类器收敛 | P2 | 8h | 1.4 | ✅ |
| 2.4 UserPreferences 分化 | P2 | 3h | 2.1 | ✅ |
| 2.5 API 常量补全 | P2 | 2h | - | ✅ |

**阶段二总工时**: 21 小时（约 3-4 个工作日）

---

## 阶段三：长效机制建立（第 3-4 周） ✅ 已完成

### 目标
建立防止问题复发的机制和监控。

**完成日期**: 2026-01-11

---

### 3.1 Feature Flags 治理机制 [P2] ✅

**新建文件**: `src/lib/ai-agent/config/feature-flag-registry.ts`

**具体任务**:
- [x] 3.1.1 创建 `FeatureFlagDefinition` 接口（含 integrationPoints 字段）
- [x] 3.1.2 创建 `FEATURE_FLAG_REGISTRY` 注册所有 Flags
- [x] 3.1.3 创建启动时验证函数 `validateFeatureFlags()`
- [x] 3.1.4 添加 CI 检查：Flag 启用但无集成点时警告

**预计工时**: 4 小时

---

### 3.2 端到端验收测试 [P2] ✅

**新建目录**: `src/__tests__/e2e/ai-capabilities/`

**具体任务**:
- [x] 3.2.1 创建隐含意图端到端测试
- [x] 3.2.2 创建置信度分层端到端测试
- [x] 3.2.3 创建 Skill 路由端到端测试
- [x] 3.2.4 创建偏好学习端到端测试
- [x] 3.2.5 集成到 CI 流程

**预计工时**: 6 小时

---

### 3.3 类型冲突检测脚本 [P3] ✅

**新建文件**: `scripts/check-type-duplicates.ts`

**具体任务**:
- [x] 3.3.1 实现扫描所有 `types.ts` 文件
- [x] 3.3.2 检测同名但不同定义的类型
- [x] 3.3.3 生成冲突报告
- [x] 3.3.4 集成到 CI pre-commit 检查

**预计工时**: 3 小时

---

### 3.4 AI 能力成熟度仪表盘 [P3] ✅

**新建文件**: `scripts/ai-capability-metrics.ts`

**具体任务**:
- [x] 3.4.1 实现 Feature Flags 集成率计算
- [x] 3.4.2 实现重复类型数检测
- [x] 3.4.3 实现映射冲突数检测
- [x] 3.4.4 生成 Markdown 报告
- [x] 3.4.5 集成到 CI 并输出到 PR 评论

**预计工时**: 4 小时

---

### 3.5 文档更新 [P2] ✅

**修改文件**: `CLAUDE.md`

**具体任务**:
- [x] 3.5.1 更新变更记录
- [x] 3.5.2 更新 AI Skills 章节，说明统一架构
- [x] 3.5.3 添加 Feature Flags 使用指南章节
- [x] 3.5.4 添加类型定义规范章节

**预计工时**: 2 小时

---

### 阶段三总结

| 任务 | 优先级 | 工时 | 依赖 | 状态 |
|------|--------|------|------|------|
| 3.1 Feature Flags 治理 | P2 | 4h | 阶段一完成 | ✅ |
| 3.2 端到端验收测试 | P2 | 6h | 阶段一完成 | ✅ |
| 3.3 类型冲突检测 | P3 | 3h | 阶段二完成 | ✅ |
| 3.4 能力成熟度仪表盘 | P3 | 4h | 阶段二完成 | ✅ |
| 3.5 文档更新 | P2 | 2h | 全部完成 | ✅ |

**阶段三总工时**: 19 小时（约 3 个工作日）

---

## 总体时间线

```
Week 1: 阶段一 (核心链路修复)
├── Day 1-2: 任务 1.1-1.3 (隐含意图 + 置信度)
├── Day 3: 任务 1.4 (SKILL_MAPPINGS 统一)
└── Day 4-5: 任务 1.5-1.7 (偏好学习 + API 修复)

Week 2: 阶段二 (架构收敛)
├── Day 1-2: 任务 2.1-2.2 (类型统一)
└── Day 3-5: 任务 2.3-2.5 (分类器收敛 + 清理)

Week 3: 阶段三 (长效机制)
├── Day 1-2: 任务 3.1-3.2 (治理 + 测试)
├── Day 3-4: 任务 3.3-3.4 (检测 + 仪表盘)
└── Day 5: 任务 3.5 (文档)

Week 4: 缓冲 + 回归测试
├── 处理遗留问题
├── 全量回归测试
└── 发布准备
```

---

## 风险与缓解

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|---------|
| 分类器迁移导致意图识别退化 | 中 | 高 | 保留旧分类器 1 周作为回退，AB 测试 |
| 类型重构破坏现有功能 | 低 | 中 | 增量修改，每次提交后运行全量测试 |
| 工时估算不准确 | 中 | 低 | 预留 Week 4 作为缓冲 |

---

## 成功指标

| 指标 | 当前值 | 目标值 |
|------|--------|--------|
| Feature Flags 集成率 | 37.5% | 100% |
| 重复类型数 | 16+ | 0 |
| 分类器数量 | 3 | 1 |
| 端到端测试覆盖 | 未知 | 核心路径 100% |

---

## 审批

- [x] 产品负责人审批 ✅ 2026-01-11
- [x] 技术负责人审批 ✅ 2026-01-11
- [x] 开始执行 ✅ 2026-01-11

---

## 关键决策记录

| 决策点 | 决定 | 日期 |
|--------|------|------|
| 分类器收敛策略 | 接受，统一到 IntentAnalyzer | 2026-01-11 |
| 置信度阈值统一 | 统一为 **0.80** | 2026-01-11 |
| 执行节奏 | 完整执行三阶段 | 2026-01-11 |

---

**备注**: 本计划可根据实际情况调整。建议每完成一个阶段进行回顾和调整。
