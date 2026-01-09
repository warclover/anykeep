# AnyKeep 意图理解增强计划

> **版本**: 1.0.0
> **日期**: 2026-01-09
> **状态**: 草案

---

## 1. 执行摘要

### 1.1 问题背景

用户测试暴露了 AI 助手意图理解的根本性问题：

**测试用例**：

```
用户输入: "结合最近三个收藏，帮我写一篇总结"
期望行为: 调用 thematic_synthesis（主题合成器），融合 3 个书签生成一篇文章
实际行为: 调用 quick_digest（快速摘要），生成 9 条独立摘要列表
```

这不是单一 bug，而是**意图理解系统的结构性缺陷**。

### 1.2 核心问题

| 问题类型         | 说明                                       | 影响                              |
| ---------------- | ------------------------------------------ | --------------------------------- |
| **关键词依赖症** | 规则只看单个词（"总结"），忽略句子整体语义 | 无法区分 "摘要列表" vs "综合文章" |
| **句法结构盲区** | "写一篇"、"结合" 等结构信号被忽略          | 用户用自然语言，AI 需要特定词汇   |
| **参数提取缺失** | "三个" 无法被解析（不支持中文数字）        | 数量限制丢失，默认处理 30 条      |
| **消歧规则不足** | 没有 digest vs synthesis 的消歧逻辑        | 总是选择先匹配的规则              |

---

## 2. 当前系统架构分析

### 2.1 意图理解流程

```
用户输入
    ↓
[1] IntentClassifier（意图分类）
    ├─ 110+ 条规则按权重排序匹配
    ├─ 第一个匹配的规则决定意图
    └─ LLM 兜底（置信度 < 0.6 时）
    ↓
[2] ComplexityEvaluator（复杂度评估）
    └─ 5 因素加权计算 → simple/medium/complex
    ↓
[3] ModeSelector（模式选择）
    ├─ simple → atomic（LLM 多轮对话）
    └─ medium/complex + 有Skill → orchestration（编排模式）
    ↓
[4] Skill 执行
```

### 2.2 关键规则对比

```typescript
// digest 规则（被错误匹配）
{
  pattern: /摘要|总结|概括|速览|summarize|summary/i,
  type: "create",
  subType: "digest",
  weight: 70,  // ← "总结" 触发此规则
}

// synthesis 规则（未被触发）
{
  pattern: /综述|合成|整合.{0,5}(收藏|文章)|归纳.{0,5}(收藏|文章)/,
  type: "create",
  subType: "synthesis",
  weight: 90,  // ← 用户没说 "综述"/"合成"，不触发
}
```

### 2.3 系统优势

- ✅ 规则优先，延迟低（< 15ms）
- ✅ 可解释性强，每个决策有明确规则
- ✅ LLM 兜底，覆盖规则盲区
- ✅ 多候选 + 消歧机制（11 条规则）

### 2.4 系统瓶颈

- ❌ **词汇级匹配**：只看关键词，不理解句子结构
- ❌ **静态规则**：需要预测所有用户表达方式
- ❌ **消歧不足**：只有 11 条规则，主要处理 organize vs create
- ❌ **实体提取弱**：不支持中文数字、复杂时间表达

---

## 3. 高频用户交互场景

### 3.1 场景分类矩阵

基于收藏管理工具的核心功能，用户最高频的交互可分为 6 大类：

| 类别         | 用户意图           | 预期频率   | 当前支持度 |
| ------------ | ------------------ | ---------- | ---------- |
| **搜索查找** | 找到特定内容       | ⭐⭐⭐⭐⭐ | ✅ 较好    |
| **内容理解** | 总结/综合/提取知识 | ⭐⭐⭐⭐   | ⚠️ 有歧义  |
| **整理归档** | 分类/标签/清理     | ⭐⭐⭐⭐   | ✅ 较好    |
| **数据统计** | 统计/分析/报告     | ⭐⭐⭐     | ✅ 较好    |
| **导出分享** | 导出/分享/备份     | ⭐⭐⭐     | ✅ 较好    |
| **学习复习** | 复习/记忆/学习路径 | ⭐⭐       | ✅ 较好    |

### 3.2 高频场景测试用例集

#### 3.2.1 搜索查找类（最高频）

| ID  | 用户表达                       | 期望意图     | 期望 Skill    |
| --- | ------------------------------ | ------------ | ------------- |
| S01 | "找一下关于 React 的文章"      | query:search | atomic search |
| S02 | "我收藏过一篇讲 TypeScript 的" | query:search | atomic search |
| S03 | "最近收藏的视频在哪"           | query:list   | atomic search |
| S04 | "有没有 B站 的收藏"            | query:search | atomic search |
| S05 | "找出所有技术类的"             | query:search | atomic search |
| S06 | "帮我找那篇讲架构的"           | query:search | atomic search |
| S07 | "上周收藏了什么"               | query:list   | atomic search |
| S08 | "工作文件夹里有什么"           | query:list   | atomic search |

#### 3.2.2 内容理解类（歧义高发区）

| ID      | 用户表达                   | 期望意图         | 期望 Skill         | 当前问题               |
| ------- | -------------------------- | ---------------- | ------------------ | ---------------------- |
| **U01** | "帮我总结一下这几篇"       | create:synthesis | thematic_synthesis | ⚠️ 路由到 digest       |
| **U02** | "把这些内容整合成一篇文章" | create:synthesis | thematic_synthesis | ⚠️ 可能路由到 organize |
| **U03** | "结合最近三个收藏写个总结" | create:synthesis | thematic_synthesis | ❌ 路由到 digest       |
| U04     | "生成这些书签的摘要"       | create:digest    | quick_digest       | ✅ 正确                |
| U05     | "给我看看每篇的要点"       | create:digest    | quick_digest       | ✅ 正确                |
| **U06** | "写一篇关于这个主题的综述" | create:synthesis | thematic_synthesis | ⚠️ 需要 "综述" 关键词  |
| **U07** | "帮我把这些知识点融合一下" | create:synthesis | thematic_synthesis | ⚠️ "融合" 未覆盖       |
| U08     | "快速过一遍这些内容"       | create:digest    | quick_digest       | ✅ 正确                |

#### 3.2.3 整理归档类

| ID  | 用户表达             | 期望意图          | 期望 Skill        |
| --- | -------------------- | ----------------- | ----------------- |
| O01 | "整理一下我的收藏"   | organize:cleanup  | batch_organize    |
| O02 | "给这些打上标签"     | action:tag        | atomic tag        |
| O03 | "移到学习文件夹"     | action:move       | atomic move       |
| O04 | "清理重复的书签"     | organize:dedupe   | duplicate_cleanup |
| O05 | "帮我分类一下"       | organize:classify | smart_tagging     |
| O06 | "把过期的链接找出来" | organize:expire   | link_health_check |

#### 3.2.4 数据统计类

| ID  | 用户表达               | 期望意图        | 期望 Skill      |
| --- | ---------------------- | --------------- | --------------- |
| A01 | "我有多少收藏"         | query:count     | atomic count    |
| A02 | "分析一下我的阅读习惯" | analyze:insight | insight_report  |
| A03 | "生成本周的阅读报告"   | analyze:report  | periodic_report |
| A04 | "看看各平台的分布"     | analyze:insight | insight_report  |

#### 3.2.5 导出分享类

| ID  | 用户表达           | 期望意图     | 期望 Skill   |
| --- | ------------------ | ------------ | ------------ |
| E01 | "导出成 Markdown"  | create:share | data_export  |
| E02 | "分享这几篇给朋友" | create:share | share_bundle |
| E03 | "备份我的收藏"     | create:share | data_export  |

#### 3.2.6 学习复习类

| ID  | 用户表达                | 期望意图                  | 期望 Skill       |
| --- | ----------------------- | ------------------------- | ---------------- |
| L01 | "开始复习"              | learn:active_recall_start | active_recall    |
| L02 | "帮我制定学习计划"      | learn:path                | learning_path    |
| L03 | "复习一下 React 相关的" | learn:review              | knowledge_review |

### 3.3 关键歧义场景深度分析

#### 场景 U03：结合...写一篇...总结

```
输入: "结合最近三个收藏，帮我写一篇总结"

语言信号分析:
┌─────────────┬──────────────────────────────────────┐
│ 信号        │ 语义暗示                              │
├─────────────┼──────────────────────────────────────┤
│ "结合"      │ 需要融合多个内容（synthesis 信号）    │
│ "最近"      │ 时间范围过滤                          │
│ "三个"      │ 数量限制（中文数字）                  │
│ "写一篇"    │ 生成完整文章（非列表）                │
│ "总结"      │ 歧义词：摘要 or 综合文章             │
└─────────────┴──────────────────────────────────────┘

当前系统处理:
- 只看到 "总结" → 匹配 digest 规则 (weight 70)
- "结合"、"写一篇" 被忽略
- "三个" 无法解析（不支持中文数字）
- 路由到 quick_digest，处理 30 条（默认）
```

#### 场景 U01：帮我总结一下这几篇

```
输入: "帮我总结一下这几篇"

歧义分析:
- 解读 A：用户想要每篇的独立摘要（digest）
- 解读 B：用户想要一个融合多篇的综合总结（synthesis）

区分信号:
- "这几篇"：暗示有上下文选择，可能是 synthesis
- "一下"：口语化，降低正式度
- 缺少 "写成一篇" / "整合成" 等明确融合信号

决策建议:
- 如果有附件书签 → 倾向 synthesis
- 如果书签数量 ≤ 5 → 询问用户意图
- 如果书签数量 > 5 → 倾向 digest
```

---

## 4. 改进方案

### 4.1 短期改进（1-2 周）

#### 4.1.1 增强 synthesis 规则覆盖

```typescript
// 新增规则：融合式总结
{
  id: "synthesis-combine-write",
  pattern: /(结合|融合|整合|汇总).{0,15}(写|生成|做).{0,5}(总结|报告|文章)/,
  type: "create",
  subType: "synthesis",
  weight: 95,  // 高于 digest (70)
}

// 新增规则："写一篇" 结构
{
  id: "synthesis-write-article",
  pattern: /写一篇.{0,10}(总结|报告|综述|文章)/,
  type: "create",
  subType: "synthesis",
  weight: 92,
}

// 新增规则：知识融合
{
  id: "synthesis-knowledge-fusion",
  pattern: /(知识|内容|要点).{0,5}(融合|合成|整合)/,
  type: "create",
  subType: "synthesis",
  weight: 90,
}
```

#### 4.1.2 添加 digest vs synthesis 消歧规则

```typescript
// 新增消歧规则
{
  id: "digest-vs-synthesis",
  conflictTypes: ["create"],
  subTypes: ["digest", "synthesis"],
  pattern: /(结合|融合|写一篇|整合成|合成为)/,
  winner: "synthesis",
  priority: 100,
  reason: "融合信号指向综合性输出而非列表"
}
```

#### 4.1.3 支持中文数字

```typescript
// 中文数字映射
const CHINESE_NUMBER_MAP: Record<string, number> = {
  '一': 1, '二': 2, '两': 2, '三': 3, '四': 4, '五': 5,
  '六': 6, '七': 7, '八': 8, '九': 9, '十': 10,
  '十一': 11, '十二': 12, '几': 5, // "几个" 默认 5
};

// 数量提取规则增强
{
  id: "limit-chinese-number",
  pattern: /(最近|前)?([一二三四五六七八九十两几]+)[个篇条]/,
  filterType: "limit",
  extract: (match) => ({
    type: "limit",
    count: parseChineseNumber(match[2]),
    expression: match[0],
  }),
  priority: 75,
}
```

### 4.2 中期改进（1-2 月）

#### 4.2.1 引入语义消歧义层

在规则匹配后、Skill 选择前，增加一个语义分析层：

```typescript
interface SemanticAnalysisResult {
  // 句子结构分析
  hasCompoundStructure: boolean; // "结合...写..."
  hasArticleMarker: boolean; // "一篇"、"一份"
  hasFusionVerb: boolean; // "结合"、"融合"、"整合"
  hasListMarker: boolean; // "每个"、"分别"、"逐条"

  // 输出期望推断
  expectedOutputType: "single_article" | "multiple_items" | "unknown";

  // Skill 倾向调整
  skillBias: {
    skillId: string;
    adjustment: number; // -0.3 ~ +0.3
  }[];
}

class SemanticAnalyzer {
  analyze(
    message: string,
    candidates: IntentCandidate[],
  ): SemanticAnalysisResult {
    // 分析句子结构
    // 调整 Skill 选择倾向
  }
}
```

#### 4.2.2 LLM 辅助消歧义

当规则消歧无法决断时（置信度差值 < 0.15），调用 LLM 进行决策：

```typescript
// LLM 消歧义 Prompt
const disambiguationPrompt = `
用户说：${message}

有两种可能的理解：
1. quick_digest（快速摘要）：生成多条独立的摘要列表
2. thematic_synthesis（主题合成）：融合多个内容生成一篇综合文章

请判断用户更可能想要哪种输出？

分析要点：
- 用户是否提到 "写一篇"、"融合"、"整合" 等词？
- 用户是否期望一篇连贯的文章？
- 用户是否期望逐条的摘要列表？

返回格式：{"skill": "quick_digest" | "thematic_synthesis", "confidence": 0-1, "reason": "..."}
`;
```

#### 4.2.3 Skill 参数推断增强

每个 Skill 的 `parseInput` 方法应该能从上下文推断参数：

```typescript
class ThematicSynthesisSkill {
  async parseInput(message: string, context: OrchestrationContext) {
    const input: ThematicSynthesisInput = {
      /* defaults */
    };

    // 1. 优先使用附件书签
    if (context.attachmentBookmarkIds?.length > 0) {
      input.sourceType = "selection";
      input.bookmarkIds = context.attachmentBookmarkIds;
    }

    // 2. 从消息中提取数量限制（新增）
    const limitMatch = extractLimit(message); // 支持中文数字
    if (limitMatch) {
      input.limit = limitMatch.count;
    }

    // 3. 从消息中提取时间范围
    const timeMatch = extractTimeRange(message);
    if (timeMatch) {
      input.timeRange = timeMatch;
    }

    // 4. 如果没有附件但有数量，查询最近 N 条
    if (!input.bookmarkIds && input.limit) {
      input.sourceType = "recent";
      // 将由 Skill 执行时查询最近 N 条
    }

    return input;
  }
}
```

### 4.3 长期改进（3-6 月）

#### 4.3.1 意图理解模型微调

- 收集用户交互日志
- 标注意图分类数据（human-in-the-loop）
- 微调小型分类模型（如 MiniLM）
- 替代或增强规则引擎

#### 4.3.2 用户纠正反馈学习

```typescript
interface UserCorrection {
  originalMessage: string;
  systemInterpretation: {
    type: string;
    subType: string;
    skillId: string;
  };
  userCorrection: {
    expectedSkillId: string;
    feedback?: string;
  };
  timestamp: Date;
}

class AdaptiveLearner {
  // 从用户纠正中学习
  async learnFromCorrection(correction: UserCorrection): Promise<void> {
    // 1. 分析误判原因
    // 2. 生成候选规则或调整权重
    // 3. 人工审核后部署
  }
}
```

#### 4.3.3 上下文感知增强

- 会话历史理解：跨轮对话的指代消解
- 用户偏好学习：学习用户的常用表达方式
- 操作上下文：当前选中的书签、所在页面等

---

## 5. 实施路线图

### 5.1 Phase 1: 规则层增强（第 1-2 周）

| 任务                              | 优先级 | 预估工时 |
| --------------------------------- | ------ | -------- |
| 新增 3-5 条 synthesis 规则        | P0     | 4h       |
| 添加 digest vs synthesis 消歧规则 | P0     | 2h       |
| 支持中文数字提取                  | P0     | 4h       |
| 更新 Skill parseInput 逻辑        | P0     | 4h       |
| 编写测试用例（高频场景）          | P0     | 8h       |

**交付物**：

- 更新的意图分类规则
- 中文数字解析模块
- 50+ 个测试用例覆盖高频场景

### 5.2 Phase 2: 语义分析层（第 3-4 周）

| 任务                       | 优先级 | 预估工时 |
| -------------------------- | ------ | -------- |
| 设计 SemanticAnalyzer 接口 | P1     | 4h       |
| 实现句子结构分析           | P1     | 8h       |
| 实现 Skill 倾向调整        | P1     | 4h       |
| 集成到意图路由流程         | P1     | 4h       |
| 测试和调优                 | P1     | 8h       |

**交付物**：

- SemanticAnalyzer 模块
- 句子结构分析能力

### 5.3 Phase 3: LLM 消歧义（第 5-6 周）

| 任务                   | 优先级 | 预估工时 |
| ---------------------- | ------ | -------- |
| 设计 LLM 消歧义 Prompt | P1     | 4h       |
| 实现 LLM 消歧义服务    | P1     | 8h       |
| 添加缓存和降级策略     | P1     | 4h       |
| 集成到路由流程         | P1     | 4h       |
| 测试和调优             | P1     | 8h       |

**交付物**：

- LLM 消歧义服务
- 复杂意图处理能力提升

### 5.4 Phase 4: 持续优化（持续）

| 任务               | 优先级 | 说明               |
| ------------------ | ------ | ------------------ |
| 监控意图分类准确率 | P2     | 建立指标看板       |
| 收集用户纠正数据   | P2     | 为模型训练准备数据 |
| 定期规则审计       | P2     | 每月审查规则覆盖率 |
| 用户反馈驱动优化   | P2     | 基于实际使用调整   |

---

## 6. 成功指标

### 6.1 短期指标（1 个月内）

| 指标                           | 当前 | 目标            |
| ------------------------------ | ---- | --------------- |
| 高频场景意图正确率             | ~70% | ≥90%            |
| digest vs synthesis 歧义解决率 | ~50% | ≥85%            |
| 中文数字识别率                 | 0%   | ≥95%            |
| 意图分类 P99 延迟              | 15ms | ≤20ms（规则层） |

### 6.2 中期指标（3 个月内）

| 指标                       | 当前 | 目标 |
| -------------------------- | ---- | ---- |
| 整体意图正确率             | ~75% | ≥92% |
| 用户纠正率                 | 未知 | ≤8%  |
| 复杂意图（含消歧义）正确率 | ~60% | ≥85% |

### 6.3 长期指标（6 个月内）

| 指标                       | 当前 | 目标   |
| -------------------------- | ---- | ------ |
| 整体意图正确率             | ~75% | ≥95%   |
| 零样本（新表达）泛化能力   | 差   | 良好   |
| 用户满意度（意图理解相关） | 未知 | ≥4.2/5 |

---

## 7. 风险与缓解

| 风险               | 可能性 | 影响 | 缓解措施                 |
| ------------------ | ------ | ---- | ------------------------ |
| 新规则引入冲突     | 中     | 高   | 完善测试用例，CI 门禁    |
| LLM 消歧义增加延迟 | 高     | 中   | 缓存、降级、并行         |
| 规则膨胀难以维护   | 中     | 中   | 定期审计、工具辅助       |
| 过拟合特定表达     | 中     | 低   | 泛化测试、用户多样性测试 |

---

## 8. 附录

### 8.1 现有规则统计

- 总规则数：110+
- 意图类型：8 种
- 子意图：100+
- 消歧规则：11 条
- 权重范围：10-95

### 8.2 Skill 映射表

| 意图键                    | Skill ID           | 名称                 |
| ------------------------- | ------------------ | -------------------- |
| create:digest             | quick_digest       | 快速摘要             |
| create:synthesis          | thematic_synthesis | 主题合成器           |
| create:synthesis_folder   | thematic_synthesis | 主题合成器（文件夹） |
| create:synthesis_recent   | thematic_synthesis | 主题合成器（最近）   |
| organize:cleanup          | batch_organize     | 智能整理             |
| organize:dedupe           | duplicate_cleanup  | 重复清理             |
| analyze:insight           | insight_report     | 洞察报告             |
| learn:active_recall_start | active_recall      | 主动复习             |
| ...                       | ...                | ...                  |

### 8.3 相关文档

- [CLAUDE.md](../../CLAUDE.md) - 项目总览
- [AI_CAPABILITY_CONFIG.md](../AI_CAPABILITY_CONFIG.md) - AI 能力配置
- [任务理解层 v2.0 规范](task-understanding-v2-implementation.md) - 任务理解层设计

---

**文档维护者**: AI 助手
**最后更新**: 2026-01-09
