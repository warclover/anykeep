# Loop（执行层）

结合 Claude Code Task 系统和本地追踪目录，实现自动循环执行。

## 职责划分

| 角色 | 职责 |
|------|------|
| **主窗口** | Planning：初始化 → 填充 context → 生成 tasks → 调用 task-executor |
| **task-executor** | 执行 tasks：读 context → 按需加载知识库 → 执行 → 按需沉淀 |
| **Stop Hook** | 自动循环：检查 pending task → 注入强化信息 → 继续执行 |

## 启动流程（主窗口执行）

### Step 1: 创建占位任务

```
TaskCreate subject="初始化 loop" description="1. 初始化 loop 目录 2. 为任务构建上下文 3. 后台观测任务进度"
# 返回 { taskListId: "abc-123-uuid", taskId: "1" }
```

### Step 2: 初始化 loop 目录

```bash
./skills/pensieve/scripts/init-loop.sh <taskListId> <slug>
# 例如：
./skills/pensieve/scripts/init-loop.sh abc-123-uuid login-feature
```

### Step 3: 填充 context（主窗口负责）

在 loop 目录（`loop/{date}-{slug}/`）下：

1. **填充 `_context.md`**（见下方格式）
2. **按需创建文档**
   - `requirements.md` — 需求定义（预估 6+ tasks 时）
   - `design.md` — 方案设计（有多个方案需权衡时）
   - `plan.md` — 代码探索结果（需了解现有代码时）

### _context.md 格式

```markdown
# 对话上下文

## 事前 Context

### 交互历史
[记录进入 loop 前的对话过程]

| 轮次 | 模型尝试 | 用户反馈 |
|------|----------|----------|
| 1 | 提出方案 A | 否决，要求更简单 |
| 2 | 改用方案 B | 同意，进入 loop |

### 最终共识
[进入 loop 时双方达成的理解]
- 目标：XXX
- 范围：YYY
- 约束：ZZZ

### 理解与假设
[模型对任务的预判]
- 预计涉及的模块
- 预计的实现方式
- 预计的难点

### 文档引用
| 类型 | 路径 |
|------|------|
| requirements | 无需 / 路径 |
| design | 无需 / 路径 |
| plan | 无需 / 路径 |

---

## 事后 Context

> 如果执行过程与计划一致，此部分留空或标记"无偏差"。

### 理解偏差
[事前假设 vs 实际情况]
- 开始前理解：XXX
- 开发中发现：YYY
- 调整：ZZZ

### 干预记录
[执行过程中的人工干预]
```

### Step 4: 生成 tasks（主窗口负责）

根据 context 生成 tasks：

| 工作量 | tasks 数 |
|--------|----------|
| 改几行 | 1 |
| 改一个模块 | 2-3 |
| 改多个模块 | 4-6 |

每个 task 包含：
- subject（命令式，如"实现用户登录"）
- description（来源 + 做什么 + 完成条件）
- activeForm（进行时，如"实现用户登录中"）

### Step 5: 执行 tasks

对每个 task 调用 agent：

```
Task agent=task-executor prompt="
task_id: 1
context: skills/pensieve/loop/{date}-{slug}/_context.md
skill_root: skills/pensieve
"
```

Agent 执行完一个 task 返回。Stop Hook 检测到 pending task 会强化注入，主窗口继续调用 agent 执行下一个。

## 两套存储的分工

| 存储 | 内容 | 用途 |
|------|------|------|
| `~/.claude/tasks/<uuid>/` | 任务状态（JSON） | Claude Code 原生 |
| `loop/{date}-{slug}/` | 元数据 + 文档 | 追踪执行，沉淀改进 |

## 目录结构

```
~/.claude/tasks/<uuid>/          # Claude Code Task（任务状态）
    ├── 1.json
    ├── 2.json
    └── ...

skills/pensieve/loop/            # 本地追踪（元数据 + 沉淀）
    └── 2026-01-23-login/        # 每个 loop 独立目录
        ├── _meta.md             # 元数据（目标、pipeline）
        ├── _context.md          # 对话上下文、干预记录
        ├── requirements.md      # 需求文档（如有）
        └── design.md            # 设计文档（如有）
```

## 自动循环机制

Stop Hook 在每次 Claude 停止时触发：

```
Agent 执行 → 停止
    ↓
loop-controller.sh 检查
    ↓
├── 有 pending task → block + 注入强化信息 → 继续执行
└── 全部完成 → 正常结束
```

## 强化信息

每次继续执行时注入：

```markdown
## Loop 继续

**Pipeline**: develop
**进度**: [2/5] completed
**当前任务**: #3 实现用户登录

---

## Task 内容
{任务描述}

---

**执行要求**:
1. 完成任务
2. TaskUpdate 标记 completed
3. 如有干预，记录到 _context.md
```

## 阶段判断

| 任务特征 | 阶段组合 |
|----------|----------|
| 明确、小范围 | tasks |
| 需要了解代码 | plan → tasks |
| 需要技术设计 | plan → design → tasks |
| 需求不明确 | plan → requirements → design → tasks |

## 闭环学习机制（主窗口负责）

Agent 返回后，主窗口执行自改进：

```
事前假设 → 执行验证 → 事后偏差 → 沉淀改进
```

### 流程

1. 读取 `pipelines/_self-improve.md`
2. 对比 `_context.md` 事前/事后部分
3. 填写事后 Context（偏差记录）
4. 如有实质偏差，询问用户是否沉淀
5. 用户同意后，按 README 格式写入

### 事后 Context 示例

| 事前理解 | 实际发现 | 调整 |
|----------|----------|------|
| 两处代码完全相同 | RPWindow 多了图标和样式 | 增加 variant 属性 |
| 9 个组件各自独立 | 辅助组件无复用价值 | 只拆分 3 个窗口组件 |

### 沉淀判断

**实质偏差**（值得沉淀）：
- 架构假设错误
- 边界情况遗漏
- 工具/框架限制未预判

**非实质偏差**（不沉淀）：
- typo、小调整
- 一次性的特殊情况
