# AnyKeep Agent 能力升级 - 遗留任务 Issue 清单

> **生成日期**: 2025-12-26
> **更新日期**: 2025-12-26
> **基于文档**: AGENT_UPGRADE_PLAN_V3_20251225.md
> **状态**: ✅ 全部完成 (10/10)

---

## 概述

本文档记录 Agent 能力升级方案 V3 中尚未完成的任务，按优先级排序。

### 完成度汇总

| Batch | 模块       | 完成度 | 主要遗留            |
| ----- | ---------- | ------ | ------------------- |
| 1     | 意图精准化 | 100%   | ✅ 响应自然化已完成 |
| 2     | 上下文记忆 | 100%   | ✅ 持久化存储已完成 |
| 3     | 搜索体验   | 95%    | -                   |
| 4     | 整理体验   | 95%    | -                   |
| 5     | 知识萃取   | 90%    | -                   |
| 6     | 自我进化   | 95%    | ✅ Embedding 已集成 |
| 7     | AI 交互 UI | 100%   | ✅ 全部集成完成     |
| 7B    | 后端支撑   | 100%   | ✅ 服务层全部完成   |

---

## P0 - 核心功能缺失（立即处理）

### Issue #1: CorrectionLearner 集成 Embedding 向量生成 ✅ 已完成

**优先级**: P0
**影响范围**: Batch 6 自我进化
**完成日期**: 2025-12-26

**解决方案实施**:

1. ✅ 在 `CorrectionLearner.recordCorrection()` 中集成 `generateEmbedding`
2. ✅ 使用 DashScope API 生成 1024 维向量（项目统一配置）
3. ✅ 创建迁移修复向量维度：`20251226000002_fix_embedding_dimension.sql`
4. ✅ 实现向量搜索失败时的文本匹配回退

**相关文件**:

- `src/lib/ai-learning/correction-learner.ts` (已更新)
- `supabase/migrations/20251226000002_fix_embedding_dimension.sql` (已创建)

**验收标准**:

- [x] 记录纠正时自动生成 Embedding
- [x] `find_similar_corrections` 能返回相似纠正
- [x] 向量搜索失败时回退到文本匹配

---

### Issue #2: 会话记忆数据库持久化 ✅ 已完成

**优先级**: P0
**影响范围**: Batch 2 上下文记忆
**完成日期**: 2025-12-26

**解决方案实施**:

1. ✅ 创建 `ai_session_memory` 数据库表
2. ✅ 实现 `MemoryPersistence` 持久化服务（防抖写入）
3. ✅ 实现 `PersistentSessionMemory` 支持持久化的会话记忆类
4. ✅ 添加 7 天自动过期清理（数据库触发器 + RPC 函数）

**相关文件**:

- `supabase/migrations/20251226100001_add_ai_session_memory.sql` (已创建)
- `src/lib/ai-memory/persistence.ts` (已创建)
- `src/lib/ai-memory/persistent-session-memory.ts` (已创建)
- `src/lib/ai-memory/index.ts` (已更新)

**验收标准**:

- [x] 会话状态保存到数据库
- [x] 服务重启后可恢复会话
- [x] 7 天自动过期清理

---

## P1 - 功能完整性（本迭代完成）

### Issue #3: 创建 FeedbackService 服务层 ✅ 已完成

**优先级**: P1
**影响范围**: Batch 7B
**完成日期**: 2025-12-26

**解决方案实施**:

- ✅ 创建 `src/lib/ai-feedback/` 模块（types.ts, feedback.service.ts, index.ts）
- ✅ 创建 `src/lib/ai-skills/services/feedback.service.ts` 服务层
- ✅ 与 `/api/agent/feedback` 端点集成

**验收标准**:

- [x] 服务层封装完成
- [x] 与 `/api/agent/feedback` 端点集成
- [x] 支持反馈统计和分析

---

### Issue #4: 创建 SnapshotManager 服务层 ✅ 已完成

**优先级**: P1
**影响范围**: Batch 7B
**完成日期**: 2025-12-26

**解决方案实施**:

- ✅ 创建 `src/lib/ai-snapshot/` 模块（types.ts, snapshot.manager.ts, index.ts）
- ✅ 创建 `src/lib/ai-skills/services/snapshot.manager.ts` 服务层
- ✅ 与 `/api/agent/undo` 端点集成

**验收标准**:

- [x] 服务层封装完成
- [x] 与 `/api/agent/undo` 端点集成
- [x] 支持操作快照和撤销功能

---

### Issue #5: 创建 NoteService 服务层 ✅ 已完成

**优先级**: P1
**影响范围**: Batch 7B
**完成日期**: 2025-12-26

**解决方案实施**:

- ✅ 创建 `src/lib/ai-notes/` 模块（types.ts, note.service.ts, index.ts）
- ✅ 创建 `src/lib/ai-skills/services/note.service.ts` 服务层
- ✅ 支持全文搜索

**验收标准**:

- [x] 服务层封装完成
- [x] 与 Quick Actions 保存按钮集成
- [x] 支持全文搜索

---

### Issue #6: 创建 ContextManager 服务层 ✅ 已完成

**优先级**: P1
**影响范围**: Batch 7B
**完成日期**: 2025-12-26

**解决方案实施**:

- ✅ 已实现于 `src/lib/ai-skills/services/context.manager.ts`
- ✅ 支持书签、文件夹、标签、搜索结果、前次输出上下文
- ✅ 与 SessionMemory 集成获取前次输出

**验收标准**:

- [x] 服务层封装完成
- [x] 与 `/api/agent/context` 端点集成
- [x] 与 Context Panel 组件集成

---

### Issue #7: 验证 Phase4 UI 组件集成 ✅ 已完成

**优先级**: P1
**影响范围**: Batch 7
**完成日期**: 2025-12-26

**验证结果**:

- [x] ToolSelector 已集成到输入框 → `ai-input-enhanced.tsx:111`
- [x] QuickActions (MessageActionsBar) 已集成到消息组件 → `ai-message-enhanced.tsx:21`
- [x] 执行确认已实现 → 使用 `ActionConfirmInline` 组件
- [x] ContextPanel 显示当前引用内容 → `ai-panel-content-enhanced.tsx:823`
- [x] IntentCorrectionDialog 在纠正时弹出 → `ai-panel-content-enhanced.tsx:915`

**相关文件**:

- `src/components/ai/phase4/` (所有 Phase4 组件)
- `src/components/ai/ai-panel-content-enhanced.tsx` (主面板)

---

## P2 - 体验优化（下迭代）

### Issue #8: 配置 pg_cron 定时清理任务 ✅ 已完成

**优先级**: P2
**影响范围**: Batch 7B
**完成日期**: 2025-12-26

**解决方案实施**:
在 Supabase Dashboard 配置以下 cron 任务：

- `cleanup-ai-snapshots`: 每天 4:00 UTC 清理过期快照
- `cleanup-session-memory`: 每天 4:30 UTC 清理过期会话记忆

**验收标准**:

- [x] pg_cron 定时任务配置完成
- [x] 过期快照自动清理

---

### Issue #9: 响应自然化模板优化 ✅ 已完成

**优先级**: P2
**影响范围**: Batch 1
**完成日期**: 2025-12-26

**解决方案实施**:

1. ✅ 增强 `src/lib/ai-skills/response/style-config.ts`
2. ✅ 扩展禁用短语列表（60+ 条）
3. ✅ 添加正则替换规则（PHRASE_REPLACEMENTS）
4. ✅ 完善响应模板（查询、操作、分析、创建、整理、学习类）
5. ✅ 添加操作类跟进建议（move, delete, tag, star, archive, undo）

**相关文件**:

- `src/lib/ai-skills/response/style-config.ts` (已更新)

**验收标准**:

- [x] 响应不含程序化短语（removeBannedPhrases 函数）
- [x] 响应简洁直接（RESPONSE_TEMPLATES 模板）
- [x] 有下一步引导（FOLLOW_UP_CONFIGS 跟进建议）

---

## 执行计划

### 第一阶段 ✅ 已完成

1. ✅ Issue #1: CorrectionLearner Embedding 集成
2. ✅ Issue #3-6: 创建 4 个服务层目录
3. ✅ Issue #7: Phase4 UI 集成验证

### 第二阶段 ✅ 已完成

1. ✅ Issue #2: 会话记忆持久化

### 第三阶段 ✅ 已完成

1. ✅ Issue #8: pg_cron 配置

### 第四阶段 ✅ 已完成

1. ✅ Issue #9: 响应自然化模板优化

---

## 变更日志

| 日期       | 变更                                                     |
| ---------- | -------------------------------------------------------- |
| 2025-12-26 | 完成 Issue #9: 响应自然化模板优化；全部 10 个 Issue 完成 |
| 2025-12-26 | 完成 Issue #8: pg_cron 定时清理配置                      |
| 2025-12-26 | 完成 Issue #2: 会话记忆持久化；更新完成度汇总 8/9        |
| 2025-12-26 | 完成 Issue #1, #3-7；更新完成度汇总                      |
| 2025-12-26 | 初始创建，基于代码库分析                                 |
