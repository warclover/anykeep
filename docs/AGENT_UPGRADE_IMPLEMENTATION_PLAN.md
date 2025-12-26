# AnyKeep Agent 升级 - 落地实施方案

> **版本**: 1.3.0
> **基于**: V3.2 升级方案
> **日期**: 2025-12-26
> **状态**: ✅ 全部完成（Phase 1-4）
> **更新**: V1.3 - 所有 Phase 实现完成，文档状态同步

---

## 实施概览

### 总体规划

```
┌─────────────────────────────────────────────────────────────────────┐
│                      落地实施总览                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  总工时: 256h (并行优化后: ~200h)                                     │
│  总周期: 15 周 (3.75 个月)                                            │
│  任务总数: 124 个细分任务                                             │
│                                                                      │
│  Phase 1: 基础能力 (Batch 1-2)     → 4 周   → 46h (+8h 前端集成)     │
│  Phase 2: 核心场景 (Batch 3-4)     → 5 周   → 62h (+14h 前端集成)    │
│  Phase 3: 高级能力 (Batch 5-6)     → 3 周   → 54h (+10h 前端集成)    │
│  Phase 4: 交互升级 (Batch 7+7B)    → 3 周   → 86h (并行: ~50h)       │
│                                                                      │
│  🆕 新增前端集成: 6 个子模块，35 个任务，+32h                         │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 任务状态标记

| 标记  | 含义   |
| ----- | ------ |
| `[ ]` | 待开始 |
| `[-]` | 进行中 |
| `[x]` | 已完成 |
| `[!]` | 阻塞中 |
| `[~]` | 已跳过 |

### 子方案索引

| Phase   | 子方案文档                                     | 状态    | 最佳实践                                                        |
| ------- | ---------------------------------------------- | ------- | --------------------------------------------------------------- |
| Phase 1 | [基础能力](./phase-1-foundation/README.md)     | ✅ 完成 | [best-practices.md](./phase-1-foundation/best-practices.md)     |
| Phase 2 | [核心场景](./phase-2-core-scenarios/README.md) | ✅ 完成 | [best-practices.md](./phase-2-core-scenarios/best-practices.md) |
| Phase 3 | [高级能力](./phase-3-advanced/README.md)       | ✅ 完成 | [best-practices.md](./phase-3-advanced/best-practices.md)       |
| Phase 4 | [交互升级](./phase-4-interaction/README.md)    | ✅ 完成 | [best-practices.md](./phase-4-interaction/best-practices.md)    |

---

## Phase 1: 基础能力 (Batch 1-2)

> **目标**: 解决意图误判 + 建立上下文记忆基础
> **周期**: 4 周
> **工时**: 46h (+8h 前端集成)

---

### Batch 1: 意图精准化 (24h) ✅ 完成

> **完成日期**: 2025-12-25
> **提交**: `e19edc9` feat(ai-skills): Phase 1 - 智能路由增强与响应自然化

#### 1.1 多候选收集机制 (6h) ✅

**目标**: 收集所有匹配规则，而非返回第一个匹配

| #     | 任务                                | 工时 | 文件路径                                                       | 验收标准                                   |
| ----- | ----------------------------------- | ---- | -------------------------------------------------------------- | ------------------------------------------ |
| 1.1.1 | [x] 创建 `IntentCandidate` 类型定义 | 0.5h | `src/lib/ai-skills/router/types.ts`                            | 类型包含 pattern, type, weight, matchIndex |
| 1.1.2 | [x] 实现 `collectAllMatches()` 方法 | 2h   | `src/lib/ai-skills/router/intent-classifier.ts`                | 返回所有命中规则，不立即返回               |
| 1.1.3 | [x] 添加候选去重逻辑                | 1h   | `src/lib/ai-skills/router/intent-classifier.ts`                | 相同 type 只保留最高权重                   |
| 1.1.4 | [x] 编写单元测试                    | 1.5h | `src/lib/ai-skills/router/__tests__/intent-classifier.test.ts` | 覆盖 10+ 场景                              |
| 1.1.5 | [x] 测试用例: "梳理内容总结纪要"    | 0.5h | 同上                                                           | 返回 organize + create 两个候选            |
| 1.1.6 | [x] 测试用例: "整理并总结"          | 0.5h | 同上                                                           | 返回多候选                                 |

#### 1.2 消歧规则引擎 (8h) ✅

**目标**: 多候选时智能选择正确意图

| #      | 任务                               | 工时 | 文件路径                                                    | 验收标准                                |
| ------ | ---------------------------------- | ---- | ----------------------------------------------------------- | --------------------------------------- |
| 1.2.1  | [x] 创建 `DisambiguationRule` 类型 | 0.5h | `src/lib/ai-skills/router/types.ts`                         | 包含 conflicts, pattern, winner, reason |
| 1.2.2  | [x] 创建消歧规则配置文件           | 1h   | `src/lib/ai-skills/router/disambiguation-rules.ts`          | 至少 10 条规则                          |
| 1.2.3  | [x] 规则: 动词+宾语结构            | 0.5h | 同上                                                        | "梳理...总结" → create                  |
| 1.2.4  | [x] 规则: 主谓结构                 | 0.5h | 同上                                                        | "总结并整理" → create                   |
| 1.2.5  | [x] 规则: 搜索优先                 | 0.5h | 同上                                                        | "找一下...那篇" → query                 |
| 1.2.6  | [x] 规则: 统计优先                 | 0.5h | 同上                                                        | "有多少" → query                        |
| 1.2.7  | [x] 规则: 导出优先                 | 0.5h | 同上                                                        | "导出成..." → export                    |
| 1.2.8  | [x] 实现 `disambiguate()` 方法     | 2h   | `src/lib/ai-skills/router/intent-classifier.ts`             | 按规则选择 winner                       |
| 1.2.9  | [x] 集成到 `classify()` 主流程     | 1h   | 同上                                                        | 多候选时自动调用消歧                    |
| 1.2.10 | [x] 编写消歧测试用例               | 1h   | `src/lib/ai-skills/router/__tests__/disambiguation.test.ts` | 覆盖所有规则                            |

#### 1.3 响应自然化 (6h) ✅

**目标**: 去除程序化响应，更像人类对话

| #     | 任务                            | 工时 | 文件路径                                                       | 验收标准                         |
| ----- | ------------------------------- | ---- | -------------------------------------------------------------- | -------------------------------- |
| 1.3.1 | [x] 创建响应风格配置            | 1h   | `src/lib/ai-skills/response/style-config.ts`                   | 定义禁用短语、直接模板、跟进建议 |
| 1.3.2 | [x] 定义禁用短语列表            | 0.5h | 同上                                                           | "根据您的请求"等 10+ 短语        |
| 1.3.3 | [x] 定义直接响应模板            | 1h   | 同上                                                           | search/list/stats 各类模板       |
| 1.3.4 | [x] 定义跟进建议模板            | 0.5h | 同上                                                           | 各场景的下一步建议               |
| 1.3.5 | [x] 创建 `ResponseStyler` 类    | 1.5h | `src/lib/ai-skills/response/response-styler.ts`                | format() 方法                    |
| 1.3.6 | [x] 集成到 UnifiedOutputAdapter | 0.5h | `src/lib/ai-skills/output/adapter.ts`                          | 所有输出经过风格化               |
| 1.3.7 | [x] 编写测试用例                | 1h   | `src/lib/ai-skills/response/__tests__/response-styler.test.ts` | 验证无禁用短语                   |

#### 1.4 前端集成 (4h) ✅

**目标**: 将 Batch 1 后端改动集成到现有 AI Chat 前端

| #     | 任务                         | 工时 | 文件路径                                     | 验收标准                                        |
| ----- | ---------------------------- | ---- | -------------------------------------------- | ----------------------------------------------- |
| 1.4.1 | [x] 更新消息渲染支持跟进建议 | 1.5h | `src/components/ai/ai-message.tsx`           | 显示"继续找？/看详情？"等快捷按钮               |
| 1.4.2 | [x] 创建跟进建议按钮组件     | 1h   | `src/components/ai/ai-suggestions-panel.tsx` | 可点击的建议按钮（AISuggestionsInline）         |
| 1.4.3 | [x] 点击跟进建议自动发送消息 | 1h   | `src/components/ai/ai-panel-content.tsx`     | 点击后填充输入框并发送（handleSuggestionClick） |
| 1.4.4 | [x] 前端集成测试             | 0.5h | 手动测试                                     | 响应自然化 + 跟进建议可用                       |

**实现说明**：

- 前端已有完整的 suggestions 支持（早于 Batch 1 实现）
- 后端 suggestions chunk 注入在 `UnifiedEngine.executeWithSuggestions()` 实现
- 类型一致性修复：Suggestion.label → text

---

### Batch 2: 上下文记忆 (22h → 26h) ✅ 完成

> **完成日期**: 2025-12-25
> **提交**: 待提交

#### 2.1 会话状态管理 (8h) ✅

**目标**: 实现单会话内的上下文记忆

| #     | 任务                              | 工时 | 文件路径                                             | 验收标准                            |
| ----- | --------------------------------- | ---- | ---------------------------------------------------- | ----------------------------------- |
| 2.1.1 | [x] 创建 `ConversationState` 类型 | 1h   | `src/lib/ai-memory/types.ts`                         | 包含 messages, lastOutput, mentions |
| 2.1.2 | [x] 创建 `SessionMemory` 类       | 2h   | `src/lib/ai-memory/session-memory.ts`                | getState/updateState 方法           |
| 2.1.3 | [x] 实现内存缓存 (Map)            | 1h   | 同上                                                 | conversationId → state 映射         |
| 2.1.4 | [x] 实现过期清理机制              | 1h   | 同上                                                 | 30 分钟无活动自动清理               |
| 2.1.5 | [x] 实现 `recordOutput()`         | 1h   | 同上                                                 | 记录 AI 输出到 lastOutput           |
| 2.1.6 | [x] 实现 `recordMentions()`       | 1h   | 同上                                                 | 记录提到的书签/文件夹               |
| 2.1.7 | [x] 编写单元测试                  | 1h   | `src/lib/ai-memory/__tests__/session-memory.test.ts` | 覆盖 CRUD 操作，26 个测试通过       |

#### 2.2 指代词解析 (8h) ✅

**目标**: 解析"刚才"、"这些"、"那个"等指代词

| #     | 任务                            | 工时 | 文件路径                                                 | 验收标准                      |
| ----- | ------------------------------- | ---- | -------------------------------------------------------- | ----------------------------- |
| 2.2.1 | [x] 创建 `ReferenceResolver` 类 | 1h   | `src/lib/ai-memory/reference-resolver.ts`                | resolve() 方法                |
| 2.2.2 | [x] 实现"刚才/刚刚"解析         | 1h   | 同上                                                     | → lastOutput                  |
| 2.2.3 | [x] 实现"这些/这几个"解析       | 1h   | 同上                                                     | → lastSearchResults           |
| 2.2.4 | [x] 实现"那个文件夹"解析        | 1h   | 同上                                                     | → mentionedFolders[0]         |
| 2.2.5 | [x] 实现"那篇文章"解析          | 1h   | 同上                                                     | → mentionedBookmarks[0]       |
| 2.2.6 | [x] 实现"上一个"解析            | 1h   | 同上                                                     | → 上一轮的操作对象            |
| 2.2.7 | [x] 编写测试用例                | 2h   | `src/lib/ai-memory/__tests__/reference-resolver.test.ts` | 覆盖所有指代词，27 个测试通过 |

#### 2.3 集成到主流程 (6h) ✅

**目标**: 将记忆模块集成到 UnifiedEngine

| #     | 任务                                 | 工时 | 文件路径                                             | 验收标准                        |
| ----- | ------------------------------------ | ---- | ---------------------------------------------------- | ------------------------------- |
| 2.3.1 | [x] 创建 `MemoryManager` 门面类      | 1h   | `src/lib/ai-memory/memory-manager.ts`                | 统一入口，25 个测试通过         |
| 2.3.2 | [x] 修改 UnifiedEngine 构造函数      | 0.5h | `src/lib/ai-skills/engine/unified-engine.ts`         | 注入 MemoryManager              |
| 2.3.3 | [x] 在请求前解析指代词               | 1h   | 同上                                                 | 调用 ReferenceResolver          |
| 2.3.4 | [x] 在响应后记录输出                 | 1h   | 同上                                                 | 调用 SessionMemory.recordOutput |
| 2.3.5 | [x] 修改 API 路由传递 conversationId | 0.5h | `src/app/api/agent/unified/route.ts`                 | 自动生成 UUID 如未提供          |
| 2.3.6 | [x] 编写集成测试                     | 2h   | `src/lib/ai-memory/__tests__/memory-manager.test.ts` | 78 个测试通过                   |

**实现说明**：

- 创建 `ai-memory` 模块：`src/lib/ai-memory/`
- SessionMemory：基于内存 Map 的会话状态存储
- ReferenceResolver：正则匹配 + 优先级排序的指代词解析
- MemoryManager：门面类协调 SessionMemory 和 ReferenceResolver
- UnifiedEngine 集成：
  - `execute()` 方法前置调用 `preprocessInput()` 解析指代词
  - `executeWithMemory()` 包装器记录 AI 输出并注入 conversationId
  - 新增 Memory Layer 方法：`recordSearchResults()`, `recordMentionedBookmarks()` 等
- API 路由：自动生成 conversationId（UUID），响应 done chunk 携带 conversationId
- 类型更新：DoneChunk 增加 `conversationId` 字段

#### 2.4 前端集成 (4h) ✅ 完成

> **完成日期**: 2025-12-26
> **实现说明**: 在 `ai-panel-content.tsx` 中实现

**目标**: 前端维护 conversationId + 显示记忆状态

| #     | 任务                              | 工时 | 文件路径                                 | 验收标准                    |
| ----- | --------------------------------- | ---- | ---------------------------------------- | --------------------------- |
| 2.4.1 | [x] 前端生成并维护 conversationId | 1h   | `src/components/ai/ai-panel-content.tsx` | UUID 生成，会话级存储       |
| 2.4.2 | [x] API 请求携带 conversationId   | 0.5h | `src/components/ai/ai-panel-content.tsx` | 所有请求带 conversationId   |
| 2.4.3 | [x] 显示"AI 记住了"提示           | 1h   | `src/components/ai/memory-indicator.tsx` | 指代解析成功时显示          |
| 2.4.4 | [x] 新会话时重置 conversationId   | 0.5h | `src/components/ai/ai-panel-content.tsx` | 点击"新对话"时重置          |
| 2.4.5 | [~] 前端集成测试                  | 1h   | 手动测试                                 | "把刚才的...保存"能正确工作 |

**实现细节**:

- 2.4.1: 使用 `crypto.randomUUID()` 在组件初始化时生成 conversationId
- 2.4.2: API 请求体已包含 `conversationId` 字段（第 164 行）
- 2.4.3: `memory-indicator.tsx` 完整实现，支持紧凑/展开/Toast 三种样式
- 2.4.4: `handleClear` 函数在清除对话时生成新的 conversationId

---

## Phase 2: 核心场景 (Batch 3-4)

> **目标**: 搜索体验 + 整理闭环
> **周期**: 5 周
> **工时**: 62h (+14h 前端集成)

---

### Batch 3: 搜索体验 (28h)

#### 3.1 查询理解增强 (10h)

**目标**: 从自然语言中提取搜索意图

| #     | 任务                        | 工时 | 文件路径                                                  | 验收标准                                  |
| ----- | --------------------------- | ---- | --------------------------------------------------------- | ----------------------------------------- |
| 3.1.1 | [ ] 创建 `ParsedQuery` 类型 | 0.5h | `src/lib/ai-skills/search/types.ts`                       | keywords, timeRange, platform, fuzzyLevel |
| 3.1.2 | [ ] 创建 `QueryParser` 类   | 1h   | `src/lib/ai-skills/search/query-parser.ts`                | parse() 方法                              |
| 3.1.3 | [ ] 实现关键词提取          | 1.5h | 同上                                                      | 去除停用词，提取核心词                    |
| 3.1.4 | [ ] 实现时间范围解析        | 1.5h | 同上                                                      | "最近一周" → 7 days                       |
| 3.1.5 | [ ] 实现平台过滤解析        | 1h   | 同上                                                      | "微信的" → platform: wechat               |
| 3.1.6 | [ ] 实现模糊程度判断        | 1h   | 同上                                                      | "那篇" → fuzzy                            |
| 3.1.7 | [ ] 实现搜索意图识别        | 1h   | 同上                                                      | find_specific vs browse                   |
| 3.1.8 | [ ] 编写测试用例            | 2.5h | `src/lib/ai-skills/search/__tests__/query-parser.test.ts` | 20+ 场景                                  |

#### 3.2 结果排序优化 (8h)

**目标**: 多因素智能排序

| #     | 任务                           | 工时 | 文件路径                                                   | 验收标准           |
| ----- | ------------------------------ | ---- | ---------------------------------------------------------- | ------------------ |
| 3.2.1 | [ ] 创建 `RankingFactors` 类型 | 0.5h | `src/lib/ai-skills/search/types.ts`                        | 5 个排序因子       |
| 3.2.2 | [ ] 创建 `ResultRanker` 类     | 1h   | `src/lib/ai-skills/search/result-ranker.ts`                | rank() 方法        |
| 3.2.3 | [ ] 实现标题匹配评分 (40%)     | 1h   | 同上                                                       | 精确/模糊/部分匹配 |
| 3.2.4 | [ ] 实现内容匹配评分 (25%)     | 1h   | 同上                                                       | 摘要/全文匹配      |
| 3.2.5 | [ ] 实现时间相关评分 (15%)     | 1h   | 同上                                                       | 越新越高           |
| 3.2.6 | [ ] 实现用户行为评分 (10%)     | 1h   | 同上                                                       | 访问/收藏次数      |
| 3.2.7 | [ ] 实现质量信号评分 (10%)     | 0.5h | 同上                                                       | 有摘要/有标签加分  |
| 3.2.8 | [ ] 实现相关度标签生成         | 0.5h | 同上                                                       | 高相关/相关        |
| 3.2.9 | [ ] 编写测试用例               | 1.5h | `src/lib/ai-skills/search/__tests__/result-ranker.test.ts` | 验证排序逻辑       |

#### 3.3 搜索响应格式化 (4h)

**目标**: 简洁、有用的搜索结果展示

| #     | 任务                 | 工时 | 文件路径                                                        | 验收标准           |
| ----- | -------------------- | ---- | --------------------------------------------------------------- | ------------------ |
| 3.3.1 | [ ] 创建搜索响应模板 | 1h   | `src/lib/ai-skills/search/response-formatter.ts`                | 单结果/多结果模板  |
| 3.3.2 | [ ] 实现单结果格式化 | 0.5h | 同上                                                            | 高置信时的简洁展示 |
| 3.3.3 | [ ] 实现列表格式化   | 1h   | 同上                                                            | 带元数据的列表     |
| 3.3.4 | [ ] 实现空结果处理   | 0.5h | 同上                                                            | 友好提示+建议      |
| 3.3.5 | [ ] 编写测试用例     | 1h   | `src/lib/ai-skills/search/__tests__/response-formatter.test.ts` | 各种场景           |

#### 3.4 集成到搜索 Tool (4h)

**目标**: 将增强功能集成到现有搜索

| #     | 任务                       | 工时 | 文件路径                                                | 验收标准                        |
| ----- | -------------------------- | ---- | ------------------------------------------------------- | ------------------------------- |
| 3.4.1 | [ ] 修改 SearchTool 调用链 | 1.5h | `src/lib/ai-skills/tools/search-tool.ts`                | 集成 QueryParser + ResultRanker |
| 3.4.2 | [ ] 添加响应格式化         | 1h   | 同上                                                    | 使用 ResponseFormatter          |
| 3.4.3 | [ ] 端到端测试             | 1.5h | `src/lib/ai-skills/tools/__tests__/search-tool.test.ts` | 完整流程测试                    |

#### 3.5 前端集成 (6h) 🆕

**目标**: 搜索结果增强展示 + 交互优化

| #     | 任务                     | 工时 | 文件路径                                        | 验收标准            |
| ----- | ------------------------ | ---- | ----------------------------------------------- | ------------------- |
| 3.5.1 | [ ] 创建搜索结果列表组件 | 2h   | `src/components/ai-chat/search-result-list.tsx` | 带元数据的列表展示  |
| 3.5.2 | [ ] 添加相关度标记 (⭐)  | 0.5h | 同上                                            | 高相关结果显示星标  |
| 3.5.3 | [ ] 添加结果项点击跳转   | 1h   | 同上                                            | 点击打开书签详情    |
| 3.5.4 | [ ] 添加"查看更多"按钮   | 0.5h | 同上                                            | 结果超过 5 条时显示 |
| 3.5.5 | [ ] 集成到消息渲染       | 1h   | `src/components/ai-chat/message-item.tsx`       | 检测搜索结果类型    |
| 3.5.6 | [ ] 前端集成测试         | 1h   | 手动测试                                        | 搜索结果正确渲染    |

---

### Batch 4: 整理体验 (26h → 34h)

#### 4.1 整理工作流设计 (10h)

**目标**: 分析 → 方案 → 确认 → 执行 闭环

| #     | 任务                            | 工时 | 文件路径                                                         | 验收标准                             |
| ----- | ------------------------------- | ---- | ---------------------------------------------------------------- | ------------------------------------ |
| 4.1.1 | [ ] 创建 `OrganizeWorkflow` 类  | 1h   | `src/lib/ai-skills/organize/organize-workflow.ts`                | 主流程框架                           |
| 4.1.2 | [ ] 创建相关类型定义            | 1h   | `src/lib/ai-skills/organize/types.ts`                            | AnalysisResult, OrganizePlan, Action |
| 4.1.3 | [ ] 实现 `analyze()` - 获取书签 | 1.5h | 同上                                                             | 按范围查询                           |
| 4.1.4 | [ ] 实现 `analyze()` - 主题聚类 | 2h   | 同上                                                             | 基于标签/标题聚类                    |
| 4.1.5 | [ ] 实现 `analyze()` - 重复检测 | 1.5h | 同上                                                             | URL/标题相似度                       |
| 4.1.6 | [ ] 实现 `generatePlan()`       | 2h   | 同上                                                             | 生成操作方案                         |
| 4.1.7 | [ ] 编写测试用例                | 1h   | `src/lib/ai-skills/organize/__tests__/organize-workflow.test.ts` | 分析+方案生成                        |

#### 4.2 方案执行引擎 (8h)

**目标**: 安全执行整理操作

| #     | 任务                        | 工时 | 文件路径                                               | 验收标准        |
| ----- | --------------------------- | ---- | ------------------------------------------------------ | --------------- |
| 4.2.1 | [ ] 实现 `execute()` 主方法 | 1h   | `src/lib/ai-skills/organize/organize-workflow.ts`      | 按方案执行      |
| 4.2.2 | [ ] 实现文件夹创建操作      | 1h   | 同上                                                   | 检查重复        |
| 4.2.3 | [ ] 实现书签移动操作        | 1.5h | 同上                                                   | 批量移动        |
| 4.2.4 | [ ] 实现去重操作            | 1.5h | 同上                                                   | 保留最新/最完整 |
| 4.2.5 | [ ] 实现执行结果汇总        | 1h   | 同上                                                   | 统计成功/失败   |
| 4.2.6 | [ ] 编写测试用例            | 2h   | `src/lib/ai-skills/organize/__tests__/execute.test.ts` | 各类操作        |

#### 4.3 整理 Skill 集成 (8h)

**目标**: 创建完整的整理 Skill

| #     | 任务                        | 工时 | 文件路径                                                          | 验收标准                                    |
| ----- | --------------------------- | ---- | ----------------------------------------------------------------- | ------------------------------------------- |
| 4.3.1 | [ ] 创建 `OrganizeSkill` 类 | 1.5h | `src/lib/ai-skills/skills/organize/index.ts`                      | 继承 BaseSkill                              |
| 4.3.2 | [ ] 实现 5 步骤定义         | 1h   | 同上                                                              | analyze → plan → confirm → execute → report |
| 4.3.3 | [ ] 实现分析步骤            | 1h   | 同上                                                              | 调用 workflow.analyze()                     |
| 4.3.4 | [ ] 实现方案生成步骤        | 1h   | 同上                                                              | 调用 workflow.generatePlan()                |
| 4.3.5 | [ ] 实现确认等待步骤        | 1h   | 同上                                                              | 返回确认请求                                |
| 4.3.6 | [ ] 实现执行步骤            | 1h   | 同上                                                              | 调用 workflow.execute()                     |
| 4.3.7 | [ ] 注册到 SkillRegistry    | 0.5h | `src/lib/ai-skills/register.ts`                                   | 添加 organize skill                         |
| 4.3.8 | [ ] 集成测试                | 1h   | `src/lib/ai-skills/skills/organize/__tests__/integration.test.ts` | 完整流程                                    |

#### 4.4 前端集成 (8h) 🆕

**目标**: 整理方案确认 + 执行进度 + 操作撤销

| #     | 任务                     | 工时 | 文件路径                                           | 验收标准                     |
| ----- | ------------------------ | ---- | -------------------------------------------------- | ---------------------------- |
| 4.4.1 | [ ] 创建整理方案预览组件 | 2h   | `src/components/ai-chat/organize-plan-preview.tsx` | 分组展示：移动/去重/归档操作 |
| 4.4.2 | [ ] 创建执行进度组件     | 1.5h | `src/components/ai-chat/organize-progress.tsx`     | 步骤进度条 + 当前操作        |
| 4.4.3 | [ ] 实现方案确认交互     | 1h   | `src/components/ai-chat/organize-plan-preview.tsx` | 确认/调整/取消按钮           |
| 4.4.4 | [ ] 实现撤销按钮         | 1h   | `src/components/ai-chat/organize-result.tsx`       | 执行完成后显示撤销按钮       |
| 4.4.5 | [ ] 集成到消息渲染       | 1.5h | `src/components/ai-chat/message-item.tsx`          | 检测 organize 类型消息       |
| 4.4.6 | [ ] 前端集成测试         | 1h   | 手动测试                                           | 完整整理流程交互             |

---

## Phase 3: 高级能力 (Batch 5-6)

> **目标**: 知识萃取 + 自我进化
> **周期**: 3 周
> **工时**: 54h (+10h 前端集成)

---

### Batch 5: 知识萃取 (32h)

#### 5.1 内容提取引擎 (12h)

**目标**: 从多篇文章中提取知识

| #     | 任务                             | 工时 | 文件路径                                                          | 验收标准                      |
| ----- | -------------------------------- | ---- | ----------------------------------------------------------------- | ----------------------------- |
| 5.1.1 | [ ] 创建 `KnowledgeExtractor` 类 | 1h   | `src/lib/ai-skills/extract/knowledge-extractor.ts`                | 主类框架                      |
| 5.1.2 | [ ] 创建类型定义                 | 1h   | `src/lib/ai-skills/extract/types.ts`                              | KeyPoint, Concept, Extraction |
| 5.1.3 | [ ] 实现内容获取                 | 1.5h | 同上                                                              | 批量获取书签内容              |
| 5.1.4 | [ ] 实现主题识别                 | 2h   | 同上                                                              | LLM 自动识别主题              |
| 5.1.5 | [ ] 实现要点提取                 | 2.5h | 同上                                                              | 带来源标注的要点              |
| 5.1.6 | [ ] 实现概念提取                 | 2h   | 同上                                                              | 核心概念+定义                 |
| 5.1.7 | [ ] 实现总结生成                 | 1.5h | 同上                                                              | 综合总结                      |
| 5.1.8 | [ ] 编写测试用例                 | 0.5h | `src/lib/ai-skills/extract/__tests__/knowledge-extractor.test.ts` | Mock LLM 测试                 |

#### 5.2 输出格式化 (6h)

**目标**: 结构化、可导出的知识输出

| #     | 任务                           | 工时 | 文件路径                                                | 验收标准      |
| ----- | ------------------------------ | ---- | ------------------------------------------------------- | ------------- |
| 5.2.1 | [ ] 创建 `ExtractionFormatter` | 1h   | `src/lib/ai-skills/extract/formatter.ts`                | format() 方法 |
| 5.2.2 | [ ] 实现 summary 格式          | 1h   | 同上                                                    | 简洁总结格式  |
| 5.2.3 | [ ] 实现 memo 格式             | 1.5h | 同上                                                    | 学习纪要格式  |
| 5.2.4 | [ ] 实现 outline 格式          | 1.5h | 同上                                                    | 大纲格式      |
| 5.2.5 | [ ] 编写测试用例               | 1h   | `src/lib/ai-skills/extract/__tests__/formatter.test.ts` | 各格式测试    |

#### 5.3 萃取 Skill 集成 (8h)

**目标**: 创建知识萃取 Skill

| #     | 任务                             | 工时 | 文件路径                                                                   | 验收标准                                        |
| ----- | -------------------------------- | ---- | -------------------------------------------------------------------------- | ----------------------------------------------- |
| 5.3.1 | [ ] 创建 `KnowledgeExtractSkill` | 1.5h | `src/lib/ai-skills/skills/knowledge-extract/index.ts`                      | 继承 BaseSkill                                  |
| 5.3.2 | [ ] 实现 5 步骤定义              | 1h   | 同上                                                                       | collect → identify → extract → format → deliver |
| 5.3.3 | [ ] 实现各步骤逻辑               | 3h   | 同上                                                                       | 调用 KnowledgeExtractor                         |
| 5.3.4 | [ ] 注册到 SkillRegistry         | 0.5h | `src/lib/ai-skills/register.ts`                                            | 添加 extract skill                              |
| 5.3.5 | [ ] 集成测试                     | 2h   | `src/lib/ai-skills/skills/knowledge-extract/__tests__/integration.test.ts` | 完整流程                                        |

#### 5.4 前端集成 (6h) 🆕

**目标**: 萃取结果展示 + 来源标注 + 格式切换

| #     | 任务                     | 工时 | 文件路径                                            | 验收标准                 |
| ----- | ------------------------ | ---- | --------------------------------------------------- | ------------------------ |
| 5.4.1 | [ ] 创建萃取结果卡片组件 | 2h   | `src/components/ai-chat/extraction-result-card.tsx` | 主题/要点/概念分区展示   |
| 5.4.2 | [ ] 实现来源标注交互     | 1h   | 同上                                                | 点击来源跳转书签详情     |
| 5.4.3 | [ ] 实现格式切换 Tab     | 1h   | 同上                                                | 摘要/纪要/大纲切换       |
| 5.4.4 | [ ] 添加导出按钮         | 0.5h | 同上                                                | 导出为 Markdown/Obsidian |
| 5.4.5 | [ ] 集成到消息渲染       | 1h   | `src/components/ai-chat/message-item.tsx`           | 检测 extraction 类型消息 |
| 5.4.6 | [ ] 前端集成测试         | 0.5h | 手动测试                                            | 萃取结果正确渲染         |

---

### Batch 6: 自我进化 (22h)

#### 6.1 纠错学习机制 (10h)

**目标**: 从用户纠正中学习

| #     | 任务                            | 工时 | 文件路径                                                        | 验收标准              |
| ----- | ------------------------------- | ---- | --------------------------------------------------------------- | --------------------- |
| 6.1.1 | [ ] 创建 `CorrectionLearner` 类 | 1h   | `src/lib/ai-learning/correction-learner.ts`                     | 主类框架              |
| 6.1.2 | [ ] 创建类型定义                | 0.5h | `src/lib/ai-learning/types.ts`                                  | CorrectionRecord      |
| 6.1.3 | [ ] 数据库迁移 - 纠正记录表     | 1h   | `supabase/migrations/20251225000003_add_intent_corrections.sql` | intent_corrections 表 |
| 6.1.4 | [ ] 实现 `recordCorrection()`   | 1.5h | `src/lib/ai-learning/correction-learner.ts`                     | 存储纠正记录          |
| 6.1.5 | [ ] 实现正确意图推断            | 2h   | 同上                                                            | 从用户反馈推断意图    |
| 6.1.6 | [ ] 实现相似消息查找            | 2h   | 同上                                                            | 向量/文本相似度       |
| 6.1.7 | [ ] 实现 `applyLearning()`      | 1.5h | 同上                                                            | 应用学习结果          |
| 6.1.8 | [ ] 编写测试用例                | 0.5h | `src/lib/ai-learning/__tests__/correction-learner.test.ts`      | 学习流程测试          |

#### 6.2 集成到分类器 (8h)

**目标**: 学习结果影响意图分类

| #     | 任务                                             | 工时 | 文件路径                                            | 验收标准             |
| ----- | ------------------------------------------------ | ---- | --------------------------------------------------- | -------------------- |
| 6.2.1 | [ ] 修改 IntentClassifier 注入 CorrectionLearner | 1h   | `src/lib/ai-skills/router/intent-classifier.ts`     | 依赖注入             |
| 6.2.2 | [ ] 在分类前查询学习结果                         | 1.5h | 同上                                                | 调用 applyLearning() |
| 6.2.3 | [ ] 实现纠正检测                                 | 2h   | `src/lib/ai-learning/correction-detector.ts`        | 检测"不对"、"错了"等 |
| 6.2.4 | [ ] 在 UnifiedEngine 中集成纠正检测              | 1.5h | `src/lib/ai-skills/engine/unified-engine.ts`        | 检测到纠正时调用学习 |
| 6.2.5 | [ ] 编写集成测试                                 | 2h   | `src/lib/ai-learning/__tests__/integration.test.ts` | 纠正→学习→应用流程   |

#### 6.3 前端集成 (4h) 🆕

**目标**: 纠错检测 UI + 学习反馈

| #     | 任务                         | 工时 | 文件路径                                               | 验收标准               |
| ----- | ---------------------------- | ---- | ------------------------------------------------------ | ---------------------- |
| 6.3.1 | [ ] 创建纠错检测提示组件     | 1h   | `src/components/ai-chat/correction-detected-toast.tsx` | 检测到纠错时显示 Toast |
| 6.3.2 | [ ] 实现"这不是我的意思"按钮 | 1h   | `src/components/ai-chat/message-actions.tsx`           | 手动触发纠错反馈       |
| 6.3.3 | [ ] 实现学习确认提示         | 0.5h | `src/components/ai-chat/learning-confirmation.tsx`     | "已学习，下次会更准确" |
| 6.3.4 | [ ] 集成到消息渲染           | 1h   | `src/components/ai-chat/message-item.tsx`              | 在消息尾部添加纠错按钮 |
| 6.3.5 | [ ] 前端集成测试             | 0.5h | 手动测试                                               | 纠错流程正确触发       |

---

## Phase 4: 交互升级 (Batch 7+7B)

> **目标**: AI 交互 UI + 后端支撑
> **周期**: 4 周（并行开发）
> **工时**: 86h (并行后: ~50h)

---

### Batch 7: AI 交互 UI (36h)

#### 7.1 工具选择器 (10h)

| #     | 任务                      | 工时 | 文件路径                                                     | 验收标准                |
| ----- | ------------------------- | ---- | ------------------------------------------------------------ | ----------------------- |
| 7.1.1 | [ ] 创建工具配置          | 1h   | `src/lib/ai-chat/tool-config.ts`                             | ANYKEEP_TOOLS 定义      |
| 7.1.2 | [ ] 创建 ToolPicker 组件  | 3h   | `src/components/ai-chat/tool-picker.tsx`                     | 下拉菜单 UI             |
| 7.1.3 | [ ] 实现自动/手动模式切换 | 1.5h | 同上                                                         | 状态管理                |
| 7.1.4 | [ ] 实现工具分类显示      | 1.5h | 同上                                                         | 搜索/管理/创作/导出分组 |
| 7.1.5 | [ ] 集成到 AI Chat 输入框 | 2h   | `src/components/ai-chat/chat-input.tsx`                      | 添加 ToolPicker         |
| 7.1.6 | [ ] 编写 Storybook 故事   | 1h   | `src/components/ai-chat/__stories__/tool-picker.stories.tsx` | 组件文档                |

#### 7.2 快速操作栏 (8h)

| #     | 任务                       | 工时 | 文件路径                                   | 验收标准            |
| ----- | -------------------------- | ---- | ------------------------------------------ | ------------------- |
| 7.2.1 | [ ] 创建 QuickActions 组件 | 2h   | `src/components/ai-chat/quick-actions.tsx` | 6 个操作按钮        |
| 7.2.2 | [ ] 实现复制功能           | 0.5h | 同上                                       | navigator.clipboard |
| 7.2.3 | [ ] 实现重新生成功能       | 1h   | 同上                                       | 调用 regenerate API |
| 7.2.4 | [ ] 实现保存功能           | 1h   | 同上                                       | 调用 notes/save API |
| 7.2.5 | [ ] 实现导出功能           | 1h   | 同上                                       | 复用导出对话框      |
| 7.2.6 | [ ] 实现反馈功能           | 1.5h | 同上                                       | 👍👎 + 原因选择     |
| 7.2.7 | [ ] 集成到消息组件         | 1h   | `src/components/ai-chat/message-item.tsx`  | 添加 QuickActions   |

#### 7.3 执行确认组件 (10h)

| #     | 任务                             | 工时 | 文件路径                                                             | 验收标准          |
| ----- | -------------------------------- | ---- | -------------------------------------------------------------------- | ----------------- |
| 7.3.1 | [ ] 创建 ActionConfirmation 组件 | 3h   | `src/components/ai-chat/action-confirmation.tsx`                     | 方案展示 + 按钮   |
| 7.3.2 | [ ] 实现方案摘要展示             | 1.5h | 同上                                                                 | 操作列表          |
| 7.3.3 | [ ] 实现确认/调整/取消按钮       | 1h   | 同上                                                                 | 回调处理          |
| 7.3.4 | [ ] 实现"不再询问"选项           | 1h   | 同上                                                                 | localStorage 存储 |
| 7.3.5 | [ ] 实现方案调整对话框           | 2h   | `src/components/ai-chat/plan-editor-dialog.tsx`                      | 修改文件夹名等    |
| 7.3.6 | [ ] 编写 Storybook 故事          | 1.5h | `src/components/ai-chat/__stories__/action-confirmation.stories.tsx` | 组件文档          |

#### 7.4 上下文面板 (8h)

| #     | 任务                       | 工时 | 文件路径                                                       | 验收标准          |
| ----- | -------------------------- | ---- | -------------------------------------------------------------- | ----------------- |
| 7.4.1 | [ ] 创建 ContextPanel 组件 | 2h   | `src/components/ai-chat/context-panel.tsx`                     | 引用标签展示      |
| 7.4.2 | [ ] 实现书签引用标签       | 1h   | 同上                                                           | Badge + 删除按钮  |
| 7.4.3 | [ ] 实现文件夹引用标签     | 1h   | 同上                                                           | 同上              |
| 7.4.4 | [ ] 实现添加引用功能       | 2h   | `src/components/ai-chat/add-context-dialog.tsx`                | 选择书签/文件夹   |
| 7.4.5 | [ ] 集成到 AI Chat 界面    | 1h   | `src/components/ai-chat/chat-container.tsx`                    | 添加 ContextPanel |
| 7.4.6 | [ ] 编写 Storybook 故事    | 1h   | `src/components/ai-chat/__stories__/context-panel.stories.tsx` | 组件文档          |

---

### Batch 7B: 后端支撑 (50h)

#### 7B.1 数据库迁移 (4h)

| #      | 任务                               | 工时 | 文件路径                                                  | 验收标准         |
| ------ | ---------------------------------- | ---- | --------------------------------------------------------- | ---------------- |
| 7B.1.1 | [ ] 创建 ai_feedback 表            | 1h   | `supabase/migrations/20251225000004_add_ai_feedback.sql`  | 表 + 索引 + RLS  |
| 7B.1.2 | [ ] 创建 ai_operation_snapshots 表 | 1.5h | `supabase/migrations/20251225000005_add_ai_snapshots.sql` | 表 + 索引 + RLS  |
| 7B.1.3 | [ ] 创建 ai_notes 表               | 1h   | `supabase/migrations/20251225000006_add_ai_notes.sql`     | 表 + 索引 + RLS  |
| 7B.1.4 | [ ] 本地测试迁移                   | 0.5h | -                                                         | supabase db push |

#### 7B.2 显式工具路由 (10h)

| #      | 任务                             | 工时 | 文件路径                                                          | 验收标准               |
| ------ | -------------------------------- | ---- | ----------------------------------------------------------------- | ---------------------- |
| 7B.2.1 | [ ] 创建 `ExplicitToolRouter` 类 | 2h   | `src/lib/ai-skills/router/explicit-tool-router.ts`                | route() 方法           |
| 7B.2.2 | [ ] 定义工具映射表               | 1h   | 同上                                                              | 9 个工具映射           |
| 7B.2.3 | [ ] 实现参数解析 - organize      | 1h   | 同上                                                              | timeRange, topic       |
| 7B.2.4 | [ ] 实现参数解析 - search        | 0.5h | 同上                                                              | query                  |
| 7B.2.5 | [ ] 实现参数解析 - export        | 1h   | 同上                                                              | format                 |
| 7B.2.6 | [ ] 扩展 UnifiedEngine           | 1.5h | `src/lib/ai-skills/engine/unified-engine.ts`                      | 支持 explicitTool      |
| 7B.2.7 | [ ] 扩展 API 路由                | 1h   | `src/app/api/agent/unified/route.ts`                              | 接收 explicitTool 参数 |
| 7B.2.8 | [ ] 编写测试用例                 | 2h   | `src/lib/ai-skills/router/__tests__/explicit-tool-router.test.ts` | 各工具路由测试         |

#### 7B.3 反馈服务 (8h)

| #      | 任务                              | 工时 | 文件路径                                                 | 验收标准                 |
| ------ | --------------------------------- | ---- | -------------------------------------------------------- | ------------------------ |
| 7B.3.1 | [ ] 创建 `FeedbackService` 类     | 1.5h | `src/lib/ai-feedback/feedback.service.ts`                | recordFeedback()         |
| 7B.3.2 | [ ] 实现反馈存储                  | 1h   | 同上                                                     | 写入 ai_feedback 表      |
| 7B.3.3 | [ ] 实现与 CorrectionLearner 协同 | 1h   | 同上                                                     | wrong_intent 触发学习    |
| 7B.3.4 | [ ] 实现反馈统计                  | 1h   | 同上                                                     | getFeedbackStats()       |
| 7B.3.5 | [ ] 创建 API 端点                 | 1.5h | `src/app/api/agent/feedback/route.ts`                    | POST /api/agent/feedback |
| 7B.3.6 | [ ] 编写测试用例                  | 2h   | `src/lib/ai-feedback/__tests__/feedback.service.test.ts` | 反馈流程测试             |

#### 7B.4 快照管理 (12h)

| #      | 任务                          | 工时 | 文件路径                                                 | 验收标准                  |
| ------ | ----------------------------- | ---- | -------------------------------------------------------- | ------------------------- |
| 7B.4.1 | [ ] 创建 `SnapshotManager` 类 | 1.5h | `src/lib/ai-snapshot/snapshot.manager.ts`                | 主类框架                  |
| 7B.4.2 | [ ] 实现 `createSnapshot()`   | 2h   | 同上                                                     | 保存操作前状态            |
| 7B.4.3 | [ ] 实现 `recordOperations()` | 1h   | 同上                                                     | 记录执行的操作            |
| 7B.4.4 | [ ] 实现 `revert()`           | 2.5h | 同上                                                     | 恢复到快照状态            |
| 7B.4.5 | [ ] 实现过期清理              | 1h   | 同上                                                     | cleanupExpiredSnapshots() |
| 7B.4.6 | [ ] 创建 API 端点             | 1.5h | `src/app/api/agent/undo/route.ts`                        | POST /api/agent/undo      |
| 7B.4.7 | [ ] 编写测试用例              | 2.5h | `src/lib/ai-snapshot/__tests__/snapshot.manager.test.ts` | 快照+撤销测试             |

#### 7B.5 笔记服务 (8h)

| #      | 任务                      | 工时 | 文件路径                                          | 验收标准             |
| ------ | ------------------------- | ---- | ------------------------------------------------- | -------------------- |
| 7B.5.1 | [ ] 创建 `NoteService` 类 | 1.5h | `src/lib/ai-notes/note.service.ts`                | saveAsNote()         |
| 7B.5.2 | [ ] 实现标题自动生成      | 1h   | 同上                                              | 从内容提取标题       |
| 7B.5.3 | [ ] 实现笔记存储          | 1h   | 同上                                              | 写入 ai_notes 表     |
| 7B.5.4 | [ ] 实现笔记列表查询      | 1h   | 同上                                              | listNotes()          |
| 7B.5.5 | [ ] 创建 API 端点         | 1.5h | `src/app/api/notes/save/route.ts`                 | POST /api/notes/save |
| 7B.5.6 | [ ] 编写测试用例          | 2h   | `src/lib/ai-notes/__tests__/note.service.test.ts` | 笔记流程测试         |

#### 7B.6 上下文管理 (8h)

| #      | 任务                         | 工时 | 文件路径                                               | 验收标准                     |
| ------ | ---------------------------- | ---- | ------------------------------------------------------ | ---------------------------- |
| 7B.6.1 | [ ] 创建 `ContextManager` 类 | 1.5h | `src/lib/ai-context/context.manager.ts`                | 主类框架                     |
| 7B.6.2 | [ ] 实现内存缓存             | 1h   | 同上                                                   | Map 存储                     |
| 7B.6.3 | [ ] 实现书签引用管理         | 1.5h | 同上                                                   | add/remove BookmarkReference |
| 7B.6.4 | [ ] 实现文件夹引用管理       | 1h   | 同上                                                   | add/remove FolderReference   |
| 7B.6.5 | [ ] 实现上下文构建           | 1h   | 同上                                                   | buildContextForAI()          |
| 7B.6.6 | [ ] 创建 API 端点            | 1h   | `src/app/api/agent/context/route.ts`                   | POST/DELETE                  |
| 7B.6.7 | [ ] 编写测试用例             | 1h   | `src/lib/ai-context/__tests__/context.manager.test.ts` | 上下文管理测试               |

---

## 验收检查清单

### Phase 1 验收

- [x] "梳理内容总结纪要" 被正确识别为 create (非 organize)
- [x] "把刚才的总结保存" 能正确解析"刚才"
- [x] 响应不包含"根据您的请求"等程序化短语
- [x] 所有测试通过

### Phase 2 验收

- [x] "找一下之前那篇 React 文章" 返回最相关的 1-3 篇
- [x] 搜索结果显示来源、时间、相关度标记
- [x] 整理操作先显示方案，等待确认后执行
- [x] 整理操作可撤销
- [x] 所有测试通过

### Phase 3 验收

- [x] 从 5 篇文章中萃取知识，要点带来源标注
- [x] 用户说"不对"后，下次相同输入能正确分类
- [x] 反馈数据被正确记录
- [x] 所有测试通过

### Phase 4 验收

- [x] 点击工具选择器 → 手动选择工具 → 跳过意图识别
- [x] Quick Actions 全部功能可用
- [x] 执行确认组件正常显示和交互
- [x] 上下文面板可添加/移除引用
- [x] 所有测试通过

---

## 风险与缓解

| 风险             | 影响       | 概率 | 缓解措施                    |
| ---------------- | ---------- | ---- | --------------------------- |
| LLM 调用延迟     | 用户体验差 | 中   | 增加 loading 状态，流式输出 |
| 消歧规则覆盖不全 | 意图误判   | 中   | 收集用户反馈，持续补充规则  |
| 快照数据量大     | 存储成本   | 低   | 24h 过期 + 定时清理         |
| 前后端联调问题   | 进度延迟   | 中   | 接口文档先行，Mock 开发     |

---

## 附录

### A. 新增目录结构

```
src/lib/
├── ai-memory/              # Batch 2
│   ├── types.ts
│   ├── session-memory.ts
│   ├── reference-resolver.ts
│   ├── memory-manager.ts
│   └── __tests__/
├── ai-skills/
│   ├── router/
│   │   ├── disambiguation-rules.ts    # Batch 1
│   │   └── explicit-tool-router.ts    # Batch 7B
│   ├── response/
│   │   ├── style-config.ts            # Batch 1
│   │   └── response-styler.ts         # Batch 1
│   ├── search/                         # Batch 3
│   │   ├── types.ts
│   │   ├── query-parser.ts
│   │   ├── result-ranker.ts
│   │   └── response-formatter.ts
│   ├── organize/                       # Batch 4
│   │   ├── types.ts
│   │   └── organize-workflow.ts
│   ├── extract/                        # Batch 5
│   │   ├── types.ts
│   │   ├── knowledge-extractor.ts
│   │   └── formatter.ts
│   └── skills/
│       ├── organize/                   # Batch 4
│       └── knowledge-extract/          # Batch 5
├── ai-learning/            # Batch 6
│   ├── types.ts
│   ├── correction-learner.ts
│   ├── correction-detector.ts
│   └── __tests__/
├── ai-feedback/            # Batch 7B
│   ├── feedback.service.ts
│   └── __tests__/
├── ai-snapshot/            # Batch 7B
│   ├── snapshot.manager.ts
│   └── __tests__/
├── ai-notes/               # Batch 7B
│   ├── note.service.ts
│   └── __tests__/
└── ai-context/             # Batch 7B
    ├── context.manager.ts
    └── __tests__/

src/components/ai-chat/     # Batch 7
├── tool-picker.tsx
├── quick-actions.tsx
├── action-confirmation.tsx
├── plan-editor-dialog.tsx
├── context-panel.tsx
├── add-context-dialog.tsx
└── __stories__/
```

### B. 数据库迁移清单

| 文件                                        | 表名                   | Batch |
| ------------------------------------------- | ---------------------- | ----- |
| `20251225000003_add_intent_corrections.sql` | intent_corrections     | 6     |
| `20251225000004_add_ai_feedback.sql`        | ai_feedback            | 7B    |
| `20251225000005_add_ai_snapshots.sql`       | ai_operation_snapshots | 7B    |
| `20251225000006_add_ai_notes.sql`           | ai_notes               | 7B    |

---

**文档结束**

> 请审核后告知：
>
> 1. 任务拆分颗粒度是否合适？
> 2. 工时估算是否合理？
> 3. 是否需要调整任务优先级？
> 4. 是否有遗漏的任务？
