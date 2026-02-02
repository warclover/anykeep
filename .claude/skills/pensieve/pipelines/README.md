# Pipelines（流程）

可执行的工作流程。定义从输入到验证的完整回路。

## 目的

Pipeline 存在的理由是**构建可验证的执行回路**。

Pipeline 不是步骤清单，而是符合大模型工作方式的闭环系统：

```
输入 → 执行 → 验证 → 输出
         ↑      ↓
         └──反馈──┘
```

### 好的 Pipeline 特征

| 特征 | 为什么重要（大模型视角） |
|------|--------------------------|
| **闭环** | 大模型容易发散，需要明确的起点和终点 |
| **实际指标** | 通过真实输出验证，不从代码推演 |
| **文件式日志** | 可追溯，出问题能定位到具体步骤 |
| **可测试** | 验证执行正确性，不靠"感觉" |
| **可工具化** | 识别可以用工具消除不确定性的环节 |

### 验证必须基于实际反馈

**反模式**：模型读代码 → "觉得"逻辑正确 → 继续

**正确方式**：执行代码 → 产生实际输出 → 读取输出 → 验证

| 验证类型 | 实际反馈来源 |
|----------|--------------|
| 编译/构建 | 编译器输出、构建日志 |
| 测试 | 测试运行结果、覆盖率报告 |
| 运行时 | 应用日志、错误堆栈 |
| 集成 | API 响应、数据库状态 |

**关键**：生产函数的实际反馈，而不是从代码中推演。系统不会骗你，模型推演会。

## 沉淀判断

问自己：**这个流程如果不固化，会重复决策什么？**

### 是否需要新增 Pipeline？

**先问**：能否通过编排现有 pipeline 的顺序解决？

| 情况 | 动作 |
|------|------|
| 现有 pipeline 组合能解决 | 编排顺序，不新增 |
| 缺少某个验证环节 | 补充到现有 pipeline |
| 完全不同的执行回路 | 新增 pipeline |

### 沉淀信号

| 信号 | 说明 |
|------|------|
| 多个 loop 的 tasks 结构相似 | 步骤顺序已稳定，可提炼 |
| 某类任务总是遗漏同一步 | 需要清单保证完整性 |
| 执行依赖多个 knowledge 的组合 | 需要 pipeline 串联知识 |

### 演进路径

```
先可达成（baseline）→ 再精细化（工具、编排优化）
```

1. **Baseline**：能跑通，有基本验证，哪怕手动
2. **工具化**：识别重复/易错环节，制作工具消除不确定性
3. **编排优化**：调整顺序减少回退，提高效率

**反模式**：一开始就追求完美的 pipeline，没跑过就优化。

## 关系与演化

| 方向 | 说明 |
|------|------|
| Pipeline ← Knowledge | 外部标准作为执行依据 |
| Pipeline → Tasks | Pipeline 定义回路，Tasks 是具体行动 |
| Pipeline ↔ Decision | 执行中形成的决策可能改进 pipeline |

### Pipeline vs Tasks

| 类型 | 本质 | 关注点 |
|------|------|--------|
| Pipeline | 执行回路 | "怎么验证"（闭环 + 指标） |
| Tasks | 具体行动 | "做什么"（当前步骤） |

Pipeline 定义回路，Tasks 是回路中的具体行动。

## 编写指南

### 目录结构

```
pipelines/
├── _self-improve.md    # 内置（下划线前缀）
├── review.md           # 用户定义
└── {name}.md
```

### 命名约定

| 前缀 | 类型 | 说明 |
|------|------|------|
| `_` | 内置 | pensieve 系统核心流程，如 `_self-improve.md` |
| 无 | 用户定义 | 项目/业务相关流程，如 `review.md` |

### 文件格式

```markdown
# Pipeline Name

---
description: 简要描述。当用户说"触发词1"、"触发词2"时触发。
---

角色定位：You are [doing what]...

## Core Principles

- **原则1**: 说明
- **原则2**: 说明

---

## Phase 1: 阶段名

**Goal**: 这个阶段要达成什么

**Actions**:
1. 具体动作
2. 具体动作

**验证**：[如何验证这一步完成]

---

## Phase 2: 阶段名

**Goal**: 这个阶段要达成什么

**CRITICAL**: 关键警告（如果有）

**Actions**:
1. 具体动作
2. **Present to user and wait for confirmation**

---

## Related Files

- `相关文件路径` — 说明
```

### 格式要点

| 元素 | 说明 |
|------|------|
| `description` | 在 frontmatter 中，包含触发词 |
| 角色定位 | "You are..." 开头，明确 Claude 的角色 |
| Core Principles | 3-5 条核心原则，前置 |
| Phase（而非 Step） | 每个阶段用 `---` 分隔 |
| **Goal** | 每个 Phase 必须有目标 |
| **Actions** | 编号列表，具体动作 |
| **CRITICAL** / **DO NOT SKIP** | 关键步骤的强标记 |
| 用户确认点 | "Wait for confirmation" 明确标注 |

### 示例

```markdown
# Review Pipeline

---
description: 代码审查流程。当用户说"审查代码"、"review"、"帮我看看这个改动"时触发。
---

You are conducting a systematic code review, balancing thoroughness with pragmatism.

## Core Principles

- **Evidence-based**: Every issue must cite specific code
- **Severity-aware**: Distinguish critical bugs from nitpicks
- **Actionable**: Provide concrete fix suggestions

---

## Phase 1: Understand Changes

**Goal**: Get complete picture of what changed

**Actions**:
1. Read the diff or specified commits
2. List all modified files
3. Identify the scope (single feature, refactor, bugfix, etc.)

**验证**：能列出所有变更的文件和变更类型

---

## Phase 2: Systematic Review

**Goal**: Check each file against review criteria

**Actions**:
1. Load review knowledge: `knowledge/taste-review/`
2. For each file, check against criteria
3. Record findings with severity: PASS / WARNING / CRITICAL

**CRITICAL**: Every WARNING/CRITICAL must cite specific line numbers.

**验证**：每个检查项都有结论

---

## Phase 3: Report

**Goal**: Deliver actionable review summary

**Actions**:
1. Summarize findings by severity
2. Provide overall assessment
3. **Present report to user**

**验证**：报告包含所有发现和改进建议

---

## Related Files

- `knowledge/taste-review/` — Review criteria and checklist
```

## 注意事项

- Pipeline 必须**贴合项目实际** — 不存在通用最佳 pipeline
- 项目初期：pipeline 简单，验证宽松
- 项目成熟：pipeline 精细，验证严格
- 改进来自实际执行反馈，不凭空优化
