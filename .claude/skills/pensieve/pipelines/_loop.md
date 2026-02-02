# Loop Pipeline

---
description: 自动循环执行任务。当用户说"用 loop"、"loop 执行"、"使用 loop 模式"时触发。
---

You are orchestrating an automated task execution loop. Break down complex work into discrete tasks, then execute them via subagents while the Stop Hook handles continuation.

## Core Principles

- **Context isolation**: Each task runs in a subagent to prevent main window context explosion
- **Atomic tasks**: Each task should be independently executable and verifiable
- **User confirmation**: Always confirm context understanding before generating tasks
- **Clean handoff**: Subagents execute one task and return; Stop Hook triggers next

> **路径说明**：以下脚本路径相对于插件根目录（`skills/pensieve/` 的上级）。脚本内部已自定位，支持从任意工作目录调用。

---

## Phase 0: 简单任务判断

**在启动 loop 之前，先评估任务复杂度。**

如果任务满足以下条件，**主动建议直接完成**：
- 只涉及 1-2 个文件
- 改动范围清晰，无需探索
- 预估 1 个 task 即可完成

**建议话术**：
> 这个任务比较简单，直接完成会更快。要直接做还是走 loop？

用户选择直接完成 → 不走 loop，直接执行
用户坚持用 loop → 继续 Phase 1

---

## Phase 1: Initialize

**Goal**: Create task list and loop directory structure

**Actions**:
1. Create placeholder task to obtain task list ID:
   ```
   TaskCreate subject="初始化 loop" description="1. 初始化 loop 目录 2. 为任务构建上下文 3. 后台观测任务进度"
   # Returns { taskListId: "abc-123-uuid", taskId: "1" }
   ```
   ⚠️ **必须使用返回的真实 taskListId**（如 `5e600100-9157-4888-...`），不是 "default"。

2. Run init script to create loop directory:
   ```bash
   ./skills/pensieve/scripts/init-loop.sh <taskListId> <slug>
   ```
   脚本输出（记住这两个值）：
   ```
   TASK_LIST_ID=abc-123-uuid
   LOOP_DIR=skills/pensieve/loop/2026-01-27-login
   ```

---

## Phase 2: Activate Stop Hook

**Goal**: Start background binding so Stop Hook can detect active loop

**Actions**:
1. 用 Phase 1 的 `TASK_LIST_ID` 和 `LOOP_DIR` 启动后台绑定：

   ✅ **正确**（两个参数 + 后台运行）：
   ```
   Bash(
     command: "./skills/pensieve/scripts/bind-loop.sh ${TASK_LIST_ID} ${LOOP_DIR}",
     run_in_background: true
   )
   ```

   ❌ **错误 1**（缺少 LOOP_DIR）：
   ```
   Bash(command: "./skills/pensieve/scripts/bind-loop.sh ${TASK_LIST_ID}")
   ```

   ❌ **错误 2**（没有 run_in_background，会阻塞 30+ 秒）：
   ```
   Bash(command: "./skills/pensieve/scripts/bind-loop.sh ${TASK_LIST_ID} ${LOOP_DIR}")
   ```

---

## Phase 3: Capture Context

**Goal**: Document the conversation context before task generation

**Actions**:
1. Write to loop 目录下的 `_context.md`（模板由 Phase 1 生成）:

```markdown
# 对话上下文

## 事前 Context

### 交互历史
| 轮次 | 模型尝试 | 用户反馈 |
|------|----------|----------|
| 1 | ... | ... |

### 最终共识
- 目标：XXX
- 范围：YYY
- 约束：ZZZ

### 理解与假设
- 预计涉及的模块
- 预计的实现方式
- 预计的难点

### 文档引用
| 类型 | 路径 |
|------|------|
| requirements | 无需 / 路径 |
| design | 无需 / 路径 |
| plan | 无需 / 路径 |
```

2. **Present context summary to user and confirm understanding before proceeding**

3. **按需创建 requirements/design**（参考模板）:

   | 条件 | 需要 | 模板 |
   |------|------|------|
   | 预估 6+ tasks / 跨多天 / 多模块联动 | requirements | `loop/REQUIREMENTS.template.md` |
   | 多方案权衡 / 决策影响后续开发 | design | `loop/DESIGN.template.md` |

   创建后将路径填入 `_context.md` 的"文档引用"。

---

## Phase 4: Generate Tasks

**Goal**: Break down work into atomic, executable tasks

**CRITICAL**: Do not proceed without user confirmation from Phase 3.

### 任务粒度标准

**核心判断：agent 能否不问问题就执行？**

- 能 → 粒度合格
- 不能 → 需要拆分或补充细节

每个 task 必须：
- 指明需要创建/修改的文件或组件
- 涉及具体的写代码、改代码或测代码活动

### Actions

1. 拆分任务，确保每个 task 符合上述粒度标准
2. 创建 tasks，增量构建（每个 task 在前一个基础上推进）
3. **末尾加自优化 task**：
   ```
   TaskCreate subject="自优化" description="由主窗口执行，不调用 agent。读取 _self-improve.md 执行闭环学习。"
   ```
4. **Present task list to user for confirmation**

---

## Phase 5: Execute Tasks

**Goal**: Run each task via isolated subagent

**Actions**:
1. Launch a general-purpose agent for the first pending task:

```
Task(
  subagent_type: "general-purpose",
  prompt: "Read skills/pensieve/loop/{date}-{slug}/_agent-prompt.md and execute task_id={id}"
)
```

Agent prompt 模板（`_agent-prompt.md`）由 init-loop.sh 生成，包含：
- 角色定义（Linus Torvalds）
- Context 和准则文件路径
- 执行流程和约束

2. Subagent 自行读取模板 → TaskGet 获取任务 → 执行 → 返回
3. Stop Hook 检测 pending tasks → 注入简化指令 → 主窗口机械执行

---

## Phase 6: Wrap Up

**Goal**: End loop and self-improve based on execution experience

**Actions**:
1. End the loop（`<taskListId>` 是 Phase 1 获取的 ID）:

   ✅ **正确**：
   ```bash
   ./skills/pensieve/scripts/end-loop.sh <taskListId>
   ```

   ❌ **错误**（缺少 task_list_id 参数）：
   ```bash
   ./skills/pensieve/scripts/end-loop.sh
   ```

2. Route to `_self-improve.md`:
   - Compare before/after context
   - Ask user if anything should be captured
   - Execute capture if confirmed

---

## Phase Selection Guide

| Task characteristics | Phase combination |
|---------------------|-------------------|
| Clear, small scope | tasks |
| Need code understanding | plan → tasks |
| Need technical design | plan → design → tasks |
| Unclear requirements | plan → requirements → design → tasks |

---

## Related Files

- `loop/README.md` — Detailed documentation
- `scripts/init-loop.sh` — Initialize loop directory
- `scripts/bind-loop.sh` — Background binding (activates Stop Hook)
- `scripts/end-loop.sh` — End loop manually
