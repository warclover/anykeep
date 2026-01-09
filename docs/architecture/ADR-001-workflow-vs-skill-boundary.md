# ADR-001: Workflow vs Skill 边界指南

**状态**: 已批准
**日期**: 2026-01-09
**决策者**: CTO / 架构团队

---

## 背景

AnyKeep AI 系统采用三层执行模式架构：

```
用户请求 → IntentRouter → 执行模式选择
                              │
           ┌──────────────────┼──────────────────┐
           ▼                  ▼                  ▼
      Workflow            Skill             Tool
      (工作流)          (编排模式)        (原子模式)
```

当前问题：

1. 开发者不清楚何时创建 Workflow vs 多步 Skill
2. 功能边界模糊导致重复实现
3. 缺乏统一的决策框架

---

## 决策

### 核心原则

> **Workflow = 用户可感知的场景编排**
> **Skill = 单一意图的多步执行**
> **Tool = 原子操作**

### 选择决策树

```
                 用户请求
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
   是否涉及多个           否 → Tool
   独立的业务目标?              (原子模式)
        │
   ┌────┴────┐
   ▼         ▼
  是        否
   │         │
   ▼         ▼
Workflow   是否需要多步
           才能完成单一目标?
               │
          ┌────┴────┐
          ▼         ▼
         是        否
          │         │
          ▼         ▼
       Skill     Tool
```

### 详细边界定义

#### 使用 Workflow 的场景

| 特征              | 说明                           | 示例                                                  |
| ----------------- | ------------------------------ | ----------------------------------------------------- |
| **多目标组合**    | 一次请求完成多个独立业务目标   | "每日精选"：获取未读 → 智能排序 → 生成推荐 → 发送通知 |
| **用户可见流程**  | 用户明确知道"正在执行一个流程" | "新用户导入整理"：分析 → 去重 → 分类 → 打标签 → 报告  |
| **定时/事件触发** | 需要 schedule/event 类型触发   | 定期备份、浏览器导入完成后自动整理                    |
| **需要中间确认**  | 流程中需要用户确认才能继续     | 文件夹清理：展示分析 → 确认删除 → 执行                |
| **跨 Skill 编排** | 需要协调多个 Skill 协同工作    | 主题深潜：搜索 → 分类 → 生成路径 → 创建报告           |

**Workflow 特征码**：

```
✅ 多个独立子目标
✅ 步骤间有显式依赖
✅ 需要进度报告
✅ 可能需要用户中途决策
✅ 有明确的"完成"概念
```

#### 使用 Skill 的场景

| 特征         | 说明                         | 示例                                     |
| ------------ | ---------------------------- | ---------------------------------------- |
| **单一意图** | 用户有一个明确的目标         | "帮我去重" → duplicate_cleanup           |
| **内部多步** | 多步骤但用户不关心中间过程   | 智能标签：分析内容 → 生成候选 → 排序推荐 |
| **无需确认** | 自动完成，无需中途干预       | 快速摘要：提取 → 压缩 → 格式化           |
| **可复用**   | 可被 Workflow 调用的原子能力 | data_export 被 periodic_backup 调用      |
| **即时响应** | 用户期望快速得到结果         | 搜索、计数、列表                         |

**Skill 特征码**：

```
✅ 单一用户意图
✅ 内部步骤对用户透明
✅ 可被 Workflow 调用
✅ 有明确的输入/输出契约
✅ 执行时间相对可控（< 30秒）
```

#### 使用 Tool 的场景

| 特征             | 说明                  | 示例                                     |
| ---------------- | --------------------- | ---------------------------------------- |
| **原子操作**     | 单一、不可再分的操作  | add_tag、delete_bookmark、move_to_folder |
| **即时执行**     | 执行时间 < 2秒        | count_bookmarks、get_folder_list         |
| **无副作用查询** | 纯查询操作            | search、list、get                        |
| **直接映射 API** | 对应后端单一 API 调用 | 数据库 CRUD 操作                         |

**Tool 特征码**：

```
✅ 单一 API 调用
✅ 执行时间 < 2秒
✅ 输入输出简单
✅ 无需上下文理解
✅ 可直接由 LLM 调用
```

---

## 映射规则速查表

### 按用户表达映射

| 用户表达       | 推荐模式                       | 原因                       |
| -------------- | ------------------------------ | -------------------------- |
| "帮我整理"     | Workflow (new_user_onboarding) | 涉及去重+分类+打标签多目标 |
| "去重"         | Skill (duplicate_cleanup)      | 单一意图                   |
| "删除这个书签" | Tool (delete_bookmark)         | 原子操作                   |
| "今天读什么"   | Workflow (daily_digest)        | 多步骤+推荐算法            |
| "搜索 React"   | Tool (semantic_search)         | 即时查询                   |
| "生成学习路径" | Workflow (topic_deep_dive)     | 搜索+分析+生成多目标       |
| "给这个打标签" | Tool (add_tag)                 | 原子操作                   |
| "智能打标签"   | Skill (smart_tagging)          | 内部多步但单一意图         |
| "备份数据"     | Workflow (periodic_backup)     | 统计+导出多格式+清理       |
| "导出 JSON"    | Skill (data_export)            | 单一意图                   |

### 按复杂度映射

| 复杂度 | 步骤数 | 执行时间 | 推荐模式 |
| ------ | ------ | -------- | -------- |
| 简单   | 1      | < 2秒    | Tool     |
| 中等   | 2-4    | 2-30秒   | Skill    |
| 复杂   | 5+     | > 30秒   | Workflow |

---

## 实现指南

### 创建 Workflow 检查清单

```markdown
□ 是否涉及 2+ 个独立业务目标？
□ 是否需要定时/事件触发？
□ 是否需要中途用户确认？
□ 是否需要进度报告？
□ 执行时间是否可能 > 30秒？
□ 是否需要编排多个 Skill？

如果 ≥ 3 项为是 → 创建 Workflow
```

### 创建 Skill 检查清单

```markdown
□ 是否有单一明确的用户意图？
□ 内部步骤是否对用户透明？
□ 是否可能被 Workflow 复用？
□ 是否有明确的输入/输出契约？
□ 执行时间是否 < 30秒？

如果 ≥ 4 项为是 → 创建 Skill
```

### 创建 Tool 检查清单

```markdown
□ 是否为单一 API 调用？
□ 执行时间是否 < 2秒？
□ 输入输出是否简单明确？
□ 是否为原子操作（不可再分）？

如果 4 项全为是 → 创建 Tool
```

---

## 边界案例处理

### 案例 1: "整理我的书签"

**分析**:

- 意图模糊，可能是去重、分类、或全面整理
- 涉及多个潜在目标

**决策**:

- 如果用户是新用户/刚导入 → 触发 `new_user_onboarding` Workflow
- 如果用户收藏较少 → 调用 `batch_organize` Skill
- 如果用户明确说"去重" → 调用 `duplicate_cleanup` Skill

### 案例 2: "检查链接"

**分析**:

- 单一意图（检查链接有效性）
- 可能涉及大量链接，耗时较长

**决策**:

- 如果书签量 < 100 → 调用 `link_health_check` Skill
- 如果书签量 > 100 → 触发 `bookmark_health` Workflow（带进度报告）

### 案例 3: "导出数据"

**分析**:

- 单一意图（导出）
- 可能涉及多种格式

**决策**:

- 单格式导出 → 调用 `data_export` Skill
- 多格式 + 清理旧备份 → 触发 `periodic_backup` Workflow

---

## 命名规范

### Workflow 命名

```
格式: {场景}-{动作}.workflow.ts
示例:
- daily-digest.workflow.ts
- bookmark-health.workflow.ts
- new-user-onboarding.workflow.ts
```

### Skill 命名

```
格式: {能力}.skill.ts
示例:
- duplicate-cleanup.skill.ts
- smart-tagging.skill.ts
- data-export.skill.ts
```

### Tool 命名

```
格式: {动作}_{对象}.tool.ts
示例:
- add_tag.tool.ts
- delete_bookmark.tool.ts
- search_bookmarks.tool.ts
```

---

## 架构约束

1. **Workflow 可调用 Skill**，但 Skill 不可调用 Workflow
2. **Skill 可调用 Tool**，但 Tool 不可调用 Skill
3. **每个 Skill 必须有明确的 inputMapping/outputMapping**
4. **Workflow 步骤之间通过上下文变量传递数据**
5. **Tool 必须是无状态的**

---

## 后果

### 正面影响

- 开发者有清晰的决策框架
- 减少功能重复实现
- 提高代码复用性
- 用户体验一致性

### 负面影响

- 需要重构部分现有 Skill 为 Workflow
- 增加初期学习成本

### 风险

- 边界案例仍需人工判断
- 可能需要根据实际使用调整阈值

---

## 参考

- [UnifiedEngine 源码](../src/lib/ai-skills/engine/unified-engine.ts)
- [ModeSelector 源码](../src/lib/ai-skills/router/mode-selector.ts)
- [Workflow 类型定义](../src/lib/workflow/types.ts)
- [Skill 基类](../src/lib/ai-skills/orchestration/base-skill.ts)

---

## 变更记录

| 日期       | 版本 | 变更     |
| ---------- | ---- | -------- |
| 2026-01-09 | 1.0  | 初始版本 |
